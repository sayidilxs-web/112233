// =================================================================================
// SHADOWRECON ULTIMATE – MAIN PROCESS (FULLY COMPATIBLE WITH ALL TOOL FORMATS)
// ফাইল: main.js | সকল টুল ফাংশনের সাথে সামঞ্জস্যপূর্ণ
// =================================================================================

const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// গ্লোবাল ফিউশন ডাটা
global.fusionData = {
  meta: { appTitle: 'ShadowRecon Ultimate', version: app.getVersion(), createdAt: new Date().toISOString() },
  target: { url: '', host: '', origin: '' },
  traffic: { events: [], totalRequests: 0, totalResponses: 0 },
  defensive: { results: {}, recommendations: [] },
  custom: { results: {}, logs: [] },
  reportsIndex: []
};

// ========================== সব মডিউল লোড করা ==========================
const loadedModules = {};
const allTools = [];

function loadAllModules() {
  const modulesDir = path.join(__dirname, 'modules');
  if (!fs.existsSync(modulesDir)) {
    console.warn('modules folder not found');
    return;
  }
  const files = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = require(path.join(modulesDir, file));
      loadedModules[file] = mod;
      for (const [key, value] of Object.entries(mod)) {
        if (typeof value === 'function' && !key.startsWith('run')) {
          allTools.push({
            id: `${file}_${key}`,
            name: `${key} (${file})`,
            category: file.replace('.js', ''),
            fn: value
          });
        }
      }
      for (const [key, value] of Object.entries(mod)) {
        if (typeof value === 'function' && key.startsWith('run')) {
          allTools.push({
            id: `${file}_${key}`,
            name: `${key} (Full Scanner)`,
            category: file.replace('.js', ''),
            fn: value,
            isScanner: true
          });
        }
      }
    } catch (err) {
      console.error(`Failed to load ${file}:`, err);
    }
  }
  console.log(`Total tools loaded: ${allTools.length}`);
}

// ========================== কাস্টম ফাইল ডিরেক্টরি ==========================
function getCustomDir() { return path.join(app.getPath('userData'), 'shadowrecon_custom'); }
function ensureCustomFilesExist() {
  const dir = getCustomDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const customModulesPath = path.join(dir, 'customModules.js');
  const toolRunnerPath = path.join(dir, 'toolRunner.js');
  if (!fs.existsSync(customModulesPath)) {
    fs.writeFileSync(customModulesPath, `// customModules.js\nasync function getCustomModules() { return {}; }\nmodule.exports = { getCustomModules };`);
  }
  if (!fs.existsSync(toolRunnerPath)) {
    fs.writeFileSync(toolRunnerPath, `// toolRunner.js\nasync function runCustomTools({ modules, fusionData, emitFeed }) { return { ok: true }; }\nmodule.exports = { runCustomTools };`);
  }
  return { dir, customModulesPath, toolRunnerPath };
}

// ========================== ডিফেন্সিভ চেক (স্টাব – আগের কোড বসাতে পারেন) ==========================
async function runDefensiveChecks(win, targetUrl) {
  console.log('Defensive checks on', targetUrl);
  return { baseName: 'demo_report' };
}
async function compressAllReports(win) {
  console.log('Compressing reports');
  return { ok: true, path: 'dummy.zip' };
}

// ========================== ট্রাফিক অবজার্ভার ==========================
function setupTrafficObservation(win, wcSession) {
  wcSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    const entry = { ts: new Date().toISOString(), type: 'request', url: details.url, method: details.method };
    global.fusionData.traffic.events.push(entry);
    if (global.fusionData.traffic.events.length > 5000) global.fusionData.traffic.events.shift();
    win.webContents.send('traffic:event', entry);
    callback({ cancel: false });
  });
  wcSession.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
    const entry = { ts: new Date().toISOString(), type: 'response', url: details.url, status: details.statusCode };
    global.fusionData.traffic.events.push(entry);
    if (global.fusionData.traffic.events.length > 5000) global.fusionData.traffic.events.shift();
    win.webContents.send('traffic:event', entry);
    callback({ cancel: false });
  });
}

// ========================== উইন্ডো তৈরি ==========================
let mainWindow = null;
let trafficHookedSessions = new Set();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600, height: 1000,
    backgroundColor: '#0b0f14',
    title: 'ShadowRecon Ultimate – 20,000+ Tools',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.loadFile('index.html');
  mainWindow.maximize();
  // mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-attach-webview', (event, webviewWebContents) => {
    const s = webviewWebContents.session;
    const key = s.id || crypto.randomUUID();
    if (!trafficHookedSessions.has(key)) {
      trafficHookedSessions.add(key);
      setupTrafficObservation(mainWindow, s);
    }
  });
  const s0 = mainWindow.webContents.session;
  if (s0 && !trafficHookedSessions.has(s0.id)) {
    trafficHookedSessions.add(s0.id);
    setupTrafficObservation(mainWindow, s0);
  }
}

// ========================== IPC হ্যান্ডলার (স্মার্ট টুল কল) ==========================
ipcMain.handle('tool:list', async (event, category = null) => {
  if (category) return allTools.filter(t => t.category === category).map(t => ({ id: t.id, name: t.name, category: t.category }));
  return allTools.map(t => ({ id: t.id, name: t.name, category: t.category }));
});

ipcMain.handle('tool:run', async (event, toolId) => {
  const tool = allTools.find(t => t.id === toolId);
  if (!tool) return { error: 'Tool not found' };
  try {
    const targetUrl = global.fusionData.target.url || 'https://example.com';
    const emit = (level, msg) => {
      mainWindow?.webContents.send('feed:item', { level, message: msg });
    };
    let result;
    // চেষ্টা ১: অবজেক্ট ডিস্ট্রাকচারিং ({ targetUrl, fusionData, emitFeed })
    try {
      result = await tool.fn({ targetUrl, fusionData: global.fusionData, emitFeed: emit });
    } catch (err) {
      // চেষ্টা ২: আলাদা আর্গুমেন্ট (targetUrl, fusionData, emitFeed)
      try {
        result = await tool.fn(targetUrl, global.fusionData, emit);
      } catch (err2) {
        // চেষ্টা ৩: শুধু targetUrl (targetUrl, callback) – কিছু পুরনো টুল
        try {
          result = await tool.fn(targetUrl, emit);
        } catch (err3) {
          throw new Error(`Cannot call tool function: ${err.message || err2.message || err3.message}`);
        }
      }
    }
    return { success: true, output: result, tool: tool.name };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('defensive:run', async (event, { targetUrl }) => {
  if (!mainWindow) return { ok: false };
  try {
    const artifacts = await runDefensiveChecks(mainWindow, targetUrl);
    return { ok: true, artifacts };
  } catch(e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('reports:compress', async () => {
  if (!mainWindow) return { ok: false };
  return await compressAllReports(mainWindow);
});

ipcMain.handle('custom:run', async () => {
  const { customModulesPath, toolRunnerPath } = ensureCustomFilesExist();
  try {
    const customMod = require(customModulesPath);
    const toolRunner = require(toolRunnerPath);
    if (!customMod.getCustomModules || !toolRunner.runCustomTools) throw new Error('Invalid custom files');
    const modules = await customMod.getCustomModules();
    const result = await toolRunner.runCustomTools({ modules, fusionData: global.fusionData, emitFeed: (level, msg) => {
      mainWindow?.webContents.send('feed:item', { level, message: msg });
    } });
    return { ok: true, result };
  } catch(e) { return { ok: false, message: e.message }; }
});

ipcMain.handle('fusion:get', async () => global.fusionData);
ipcMain.handle('fusion:setTarget', async (event, url) => {
  try { const u = new URL(url); global.fusionData.target = { url: u.href, host: u.hostname, origin: u.origin }; return { ok: true }; }
  catch(e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('settings:get', () => {
  const { dir, customModulesPath, toolRunnerPath } = ensureCustomFilesExist();
  return { customDir: dir, customModulesPath, toolRunnerPath };
});
ipcMain.handle('settings:read', async (event, { kind }) => {
  const { customModulesPath, toolRunnerPath } = ensureCustomFilesExist();
  const filePath = kind === 'customModules' ? customModulesPath : toolRunnerPath;
  try { const content = fs.readFileSync(filePath, 'utf8'); return { ok: true, content }; }
  catch(e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('settings:write', async (event, { kind, content }) => {
  const { customModulesPath, toolRunnerPath } = ensureCustomFilesExist();
  const filePath = kind === 'customModules' ? customModulesPath : toolRunnerPath;
  try { fs.writeFileSync(filePath, content, 'utf8'); return { ok: true }; }
  catch(e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('settings:open', async (event, { kind }) => {
  const { dir, customModulesPath, toolRunnerPath } = ensureCustomFilesExist();
  let target = kind === 'dir' ? dir : (kind === 'customModules' ? customModulesPath : toolRunnerPath);
  return shell.openPath(target);
});

// অতিরিক্ত ডামি হ্যান্ডলার (ক্র্যাশ এড়াতে)
ipcMain.handle('exploit:list', async () => []);
ipcMain.handle('exploit:run', async () => ({}));
ipcMain.handle('system:info', async () => ({ platform: os.platform(), arch: os.arch(), cpus: os.cpus().length }));
ipcMain.handle('system:command', async (event, cmd) => ({ stdout: '', stderr: '', error: null }));
ipcMain.handle('threat:check', async (event, ip) => ({ level: 'safe', score: 10 }));
ipcMain.handle('report:generate', async () => ({ baseName: 'report' }));

// ========================== অ্যাপ লাইফসাইকেল ==========================
app.whenReady().then(() => {
  loadAllModules();
  ensureCustomFilesExist();
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

console.log(`✅ main.js loaded. Total tools: ${allTools.length}`);
