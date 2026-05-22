// =================================================================================
// SHADOWRECON ULTIMATE – APP LAUNCHER MODULE
// ফাইল: app-launcher.js | মোট টুলস: ৮০+ | যেকোনো অ্যাপ্লিকেশন লঞ্চ ও ম্যানেজ
// নির্ভরতা: Node.js built-in child_process, fs, os
// সতর্কতা: শুধুমাত্র নৈতিক ব্যবহারের জন্য, নিজের সিস্টেমে
// =================================================================================

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 8) { return crypto.randomBytes(len).toString('hex').slice(0, len); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ========== ১. প্ল্যাটফর্ম শনাক্তকারী ==========
class PlatformDetector {
  static getPlatform() { return os.platform(); }
  static isWindows() { return this.getPlatform() === 'win32'; }
  static isMac() { return this.getPlatform() === 'darwin'; }
  static isLinux() { return this.getPlatform() === 'linux'; }
}

// ========== ২. অ্যাপ্লিকেশন লঞ্চার বেস ক্লাস ==========
class AppLauncher {
  constructor() {
    this.platform = PlatformDetector.getPlatform();
    this.history = [];
  }

  // সাধারণ অ্যাপ লঞ্চ (এক্সিকিউটেবল পাথ দিয়ে)
  launchApp(executablePath, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn(executablePath, args, {
        detached: options.detached || false,
        stdio: options.stdio || 'ignore',
        shell: false,
        env: { ...process.env, ...options.env }
      });
      if (options.detached) proc.unref();
      proc.on('error', (err) => reject(err));
      proc.on('spawn', () => {
        this.addToHistory(executablePath, args);
        resolve({ success: true, pid: proc.pid });
      });
    });
  }

  // সিস্টেম কমান্ড ব্যবহার করে লঞ্চ (উদাহরণ: start, open, xdg-open)
  launchSystemCommand(appName, args = []) {
    let command = '';
    if (PlatformDetector.isWindows()) {
      command = `start "" "${appName}" ${args.join(' ')}`;
    } else if (PlatformDetector.isMac()) {
      command = `open -a "${appName}" ${args.join(' ')}`;
    } else {
      command = `${appName} ${args.join(' ')} &`;
    }
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve({ success: true, stdout, stderr });
      });
    });
  }

  // নির্দিষ্ট URL ব্রাউজারে খোলা (ডিফল্ট ব্রাউজার)
  openUrl(url) {
    let command = '';
    if (PlatformDetector.isWindows()) {
      command = `start "${url}"`;
    } else if (PlatformDetector.isMac()) {
      command = `open "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }
    return new Promise((resolve, reject) => {
      exec(command, (error) => {
        if (error) reject(error);
        else resolve({ success: true, url });
      });
    });
  }

  // অ্যাপ্লিকেশন বন্ধ করা (পিআইডি দ্বারা)
  killApp(pid) {
    try {
      if (PlatformDetector.isWindows()) {
        exec(`taskkill /PID ${pid} /F`);
      } else {
        process.kill(pid);
      }
      return { success: true, pid };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ইতিহাস সংরক্ষণ
  addToHistory(appPath, args) {
    this.history.push({ appPath, args, timestamp: getTimestamp() });
    if (this.history.length > 100) this.history.shift();
  }
  getHistory() { return this.history; }
}

// ========== ৩. প্রি-ডিফাইনড অ্যাপ্লিকেশন শর্টকাট ==========
class ShortcutLauncher {
  constructor(appLauncher) {
    this.launcher = appLauncher;
  }

  // সাধারণ অ্যাপ্লিকেশন
  async notepad() {
    if (PlatformDetector.isWindows()) return this.launcher.launchApp('notepad.exe');
    if (PlatformDetector.isMac()) return this.launcher.launchSystemCommand('TextEdit');
    return this.launcher.launchSystemCommand('gedit');
  }

  async calculator() {
    if (PlatformDetector.isWindows()) return this.launcher.launchApp('calc.exe');
    if (PlatformDetector.isMac()) return this.launcher.launchSystemCommand('Calculator');
    return this.launcher.launchSystemCommand('gnome-calculator');
  }

  async chrome(url = '') {
    const args = url ? [url] : [];
    if (PlatformDetector.isWindows()) return this.launcher.launchApp('chrome.exe', args);
    if (PlatformDetector.isMac()) return this.launcher.launchSystemCommand('Google Chrome', args);
    return this.launcher.launchSystemCommand('google-chrome', args);
  }

  async vscode(filePath = '') {
    const args = filePath ? [filePath] : [];
    if (PlatformDetector.isWindows()) return this.launcher.launchApp('code', args);
    if (PlatformDetector.isMac()) return this.launcher.launchSystemCommand('Visual Studio Code', args);
    return this.launcher.launchSystemCommand('code', args);
  }

  async terminal() {
    if (PlatformDetector.isWindows()) return this.launcher.launchApp('cmd.exe');
    if (PlatformDetector.isMac()) return this.launcher.launchSystemCommand('Terminal');
    return this.launcher.launchSystemCommand('gnome-terminal');
  }

  async fileExplorer() {
    if (PlatformDetector.isWindows()) return this.launcher.launchApp('explorer.exe');
    if (PlatformDetector.isMac()) return this.launcher.launchSystemCommand('Finder');
    return this.launcher.launchSystemCommand('nautilus');
  }

  async settings() {
    if (PlatformDetector.isWindows()) return this.launcher.launchApp('ms-settings:');
    if (PlatformDetector.isMac()) return this.launcher.launchSystemCommand('System Preferences');
    return this.launcher.launchSystemCommand('gnome-control-center');
  }
}

// ========== ৪. অ্যাপ্লিকেশন রেজিস্ট্রি (কাস্টম পাথ সংরক্ষণ) ==========
class AppRegistry {
  constructor() {
    this.registry = new Map(); // নাম -> { path, args }
    this.configFile = path.join(os.homedir(), '.shadowrecon_apps.json');
    this.load();
  }

  // অ্যাপ নিবন্ধন
  register(name, executablePath, defaultArgs = []) {
    this.registry.set(name, { path: executablePath, args: defaultArgs });
    this.save();
    return { success: true };
  }

  // নিবন্ধিত অ্যাপ লঞ্চ
  launch(name, additionalArgs = []) {
    const entry = this.registry.get(name);
    if (!entry) throw new Error(`App "${name}" not registered`);
    const allArgs = [...entry.args, ...additionalArgs];
    const launcher = new AppLauncher();
    return launcher.launchApp(entry.path, allArgs);
  }

  // সব নিবন্ধিত অ্যাপের তালিকা
  list() { return Array.from(this.registry.keys()); }

  // কনফিগ ফাইল থেকে লোড
  load() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        for (const [name, entry] of Object.entries(data)) {
          this.registry.set(name, entry);
        }
      }
    } catch(e) {}
  }
  save() {
    const data = Object.fromEntries(this.registry);
    fs.writeFileSync(this.configFile, JSON.stringify(data, null, 2));
  }
}

// ========== ৫. অ্যাপ লঞ্চার কন্ট্রোলার (মূল ক্লাস) ==========
class AppLauncherController {
  constructor() {
    this.launcher = new AppLauncher();
    this.shortcuts = new ShortcutLauncher(this.launcher);
    this.registry = new AppRegistry();
  }

  // সরাসরি অ্যাপ লঞ্চ (পাথ দিয়ে)
  launchApp(path, args = []) { return this.launcher.launchApp(path, args); }
  // সিস্টেম কমান্ড ব্যবহার করে
  launchSystem(appName, args = []) { return this.launcher.launchSystemCommand(appName, args); }
  // ইউআরএল খোলা
  openUrl(url) { return this.launcher.openUrl(url); }
  // পিআইডি দ্বারা অ্যাপ বন্ধ
  killApp(pid) { return this.launcher.killApp(pid); }

  // শর্টকাট
  openNotepad() { return this.shortcuts.notepad(); }
  openCalculator() { return this.shortcuts.calculator(); }
  openBrowser(url) { return this.shortcuts.chrome(url); }
  openVSCode(file) { return this.shortcuts.vscode(file); }
  openTerminal() { return this.shortcuts.terminal(); }
  openFileExplorer() { return this.shortcuts.fileExplorer(); }
  openSettings() { return this.shortcuts.settings(); }

  // কাস্টম অ্যাপ নিবন্ধন ও লঞ্চ
  registerApp(name, path, args = []) { return this.registry.register(name, path, args); }
  launchRegisteredApp(name, args = []) { return this.registry.launch(name, args); }
  listRegisteredApps() { return this.registry.list(); }
}

// ========== ৬. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runAppLauncher(fusionData, emitFeed) {
  emitFeed('info', '🚀 অ্যাপ লঞ্চার সক্রিয় – যেকোনো অ্যাপ্লিকেশন চালানোর জন্য প্রস্তুত');
  const controller = new AppLauncherController();
  
  // টেস্ট: নোটপ্যাড খোলা (উইন্ডোজে), অন্যথায় টেক্সট এডিটর
  try {
    await controller.openNotepad();
    emitFeed('success', '✅ নোটপ্যাড/টেক্সট এডিটর চালু করা হয়েছে');
  } catch (err) {
    emitFeed('warn', `⚠️ নোটপ্যাড চালু করতে ব্যর্থ: ${err.message}`);
  }
  
  // একটি কাস্টম অ্যাপ নিবন্ধন (উদাহরণ)
  controller.registerApp('myapp', 'C:\\Windows\\System32\\calc.exe');
  emitFeed('info', `📝 নিবন্ধিত অ্যাপ: ${controller.listRegisteredApps().join(', ')}`);
  
  fusionData.custom.results.appLauncher = {
    status: 'ready',
    registeredApps: controller.listRegisteredApps(),
    platform: PlatformDetector.getPlatform()
  };
  return { ok: true, controller };
}

// ========== ৭. এক্সপোর্ট ==========
module.exports = {
  PlatformDetector,
  AppLauncher,
  ShortcutLauncher,
  AppRegistry,
  AppLauncherController,
  runAppLauncher
};

console.log('✅ app-launcher.js লোড হয়েছে – অ্যাপ লঞ্চার প্রস্তুত');
