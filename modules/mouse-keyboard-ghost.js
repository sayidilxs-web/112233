// =================================================================================
// SHADOWRECON ULTIMATE – MOUSE & KEYBOARD GHOST MODULE
// ফাইল: mouse-keyboard-ghost.js | মোট টুলস: ১০০+ | মাউস ও কীবোর্ড সিমুলেশন
// নির্ভরতা: robotjs (npm install robotjs) – Windows, macOS, Linux সমর্থিত
// সতর্কতা: শুধুমাত্র নৈতিক ব্যবহারের জন্য, নিজের সিস্টেমে
// =================================================================================

const robot = require('robotjs');
const os = require('os');
const crypto = require('crypto');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 8) { return crypto.randomBytes(len).toString('hex').slice(0, len); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ========== ১. মাউস কন্ট্রোলার ==========
class MouseController {
  constructor() {
    this.screenSize = robot.getScreenSize();
  }

  // মাউসের বর্তমান অবস্থান
  getPosition() {
    const pos = robot.getMousePos();
    return { x: pos.x, y: pos.y };
  }

  // মাউস সরানো (পরম স্থানাঙ্কে)
  moveTo(x, y, smooth = false) {
    if (smooth) {
      const current = this.getPosition();
      const steps = 20;
      for (let i = 1; i <= steps; i++) {
        const tx = current.x + (x - current.x) * (i / steps);
        const ty = current.y + (y - current.y) * (i / steps);
        robot.moveMouse(tx, ty);
        delay(2);
      }
    } else {
      robot.moveMouse(x, y);
    }
    return { success: true, position: { x, y } };
  }

  // বর্তমান অবস্থান থেকে আপেক্ষিক সরানো
  moveRelative(dx, dy, smooth = false) {
    const current = this.getPosition();
    return this.moveTo(current.x + dx, current.y + dy, smooth);
  }

  // ক্লিক (left, right, middle)
  click(button = 'left', double = false) {
    if (double) {
      robot.mouseClick(button, true);
    } else {
      robot.mouseClick(button);
    }
    return { success: true, button, double };
  }

  // মাউস বোতাম চেপে ধরা
  mouseDown(button = 'left') { robot.mouseToggle('down', button); return { success: true }; }
  // মাউস বোতাম ছেড়ে দেওয়া
  mouseUp(button = 'left') { robot.mouseToggle('up', button); return { success: true }; }

  // স্ক্রল (আপ: ধনাত্মক, ডাউন: ঋণাত্মক)
  scroll(amount, direction = 'vertical') {
    if (direction === 'vertical') robot.scrollMouse(0, amount);
    else robot.scrollMouse(amount, 0);
    return { success: true, amount, direction };
  }

  // ড্র্যাগ (মাউস চেপে ধরে সরানো)
  drag(x, y, button = 'left') {
    this.mouseDown(button);
    delay(50);
    this.moveTo(x, y);
    delay(50);
    this.mouseUp(button);
    return { success: true };
  }

  // স্ক্রিন রেজোলিউশন
  getScreenSize() { return this.screenSize; }
}

// ========== ২. কীবোর্ড কন্ট্রোলার ==========
class KeyboardController {
  // একটি কীবোর্ড কী ট্যাপ করা
  tap(key, modifiers = []) {
    if (modifiers.length > 0) {
      robot.keyTap(key, modifiers);
    } else {
      robot.keyTap(key);
    }
    return { success: true, key, modifiers };
  }

  // একটি কী চেপে ধরা
  keyDown(key) { robot.keyToggle(key, 'down'); return { success: true }; }
  // একটি কী ছেড়ে দেওয়া
  keyUp(key) { robot.keyToggle(key, 'up'); return { success: true }; }

  // টেক্সট টাইপ করা (সাধারণ অক্ষর)
  type(text, delayMs = 10) {
    // robotjs-এর typeString ASCII অক্ষরের জন্য ভালো কাজ করে, ইউনিকোডের জন্য অন্যান্য পদ্ধতি ব্যবহার করতে হবে
    // কিন্তু আমরা ধরে নিচ্ছি ইংরেজি অক্ষর
    robot.typeString(text);
    return { success: true, length: text.length };
  }

  // ধীরে ধীরে টাইপ (মানুষের মতো)
  async typeHuman(text, delayBetween = 50) {
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      // শুধু ASCII অক্ষর সমর্থন করে robotjs
      robot.typeString(char);
      await delay(delayBetween + Math.random() * 30);
    }
    return { success: true, length: text.length };
  }

  // মডিফায়ার সহ শর্টকাট (যেমন Ctrl+C)
  shortcut(keys) {
    // keys: ['control', 'c'] অথবা 'control+c'
    let keyArray;
    if (typeof keys === 'string') {
      keyArray = keys.split('+');
    } else {
      keyArray = keys;
    }
    const mainKey = keyArray.pop();
    const modifiers = keyArray;
    robot.keyTap(mainKey, modifiers);
    return { success: true };
  }
}

// ========== ৩. ক্লিপবোর্ড কন্ট্রোলার (পড়া ও লেখা) ==========
class ClipboardController {
  // টেক্সট ক্লিপবোর্ডে কপি (প্ল্যাটফর্ম নির্ভর)
  static async copy(text) {
    const { exec } = require('child_process');
    const platform = os.platform();
    let cmd;
    if (platform === 'win32') {
      cmd = `echo ${text.replace(/[&|<>]/g, '^$&')} | clip`;
    } else if (platform === 'darwin') {
      cmd = `echo "${text.replace(/["\\]/g, '\\$&')}" | pbcopy`;
    } else {
      cmd = `echo "${text.replace(/["\\]/g, '\\$&')}" | xclip -selection clipboard`;
    }
    return new Promise((resolve) => {
      exec(cmd, (err) => {
        if (err) resolve({ success: false, error: err.message });
        else resolve({ success: true });
      });
    });
  }

  // ক্লিপবোর্ড থেকে টেক্সট পড়া
  static async paste() {
    const { exec } = require('child_process');
    const platform = os.platform();
    let cmd;
    if (platform === 'win32') {
      cmd = 'powershell -Command "Get-Clipboard"';
    } else if (platform === 'darwin') {
      cmd = 'pbpaste';
    } else {
      cmd = 'xclip -selection clipboard -o';
    }
    return new Promise((resolve) => {
      exec(cmd, (err, stdout) => {
        if (err) resolve({ success: false, error: err.message, text: '' });
        else resolve({ success: true, text: stdout });
      });
    });
  }
}

// ========== ৪. মাউস ও কীবোর্ড ভুত কন্ট্রোলার (সবকিছু একত্রে) ==========
class MouseKeyboardGhostController {
  constructor() {
    this.mouse = new MouseController();
    this.keyboard = new KeyboardController();
  }

  // সহজে মাউস সরানো
  moveMouse(x, y) { return this.mouse.moveTo(x, y); }
  moveMouseRelative(dx, dy) { return this.mouse.moveRelative(dx, dy); }
  clickLeft() { return this.mouse.click('left'); }
  clickRight() { return this.mouse.click('right'); }
  doubleClick() { return this.mouse.click('left', true); }
  scrollDown(amount = 3) { return this.mouse.scroll(-amount); }
  scrollUp(amount = 3) { return this.mouse.scroll(amount); }

  // কীবোর্ড
  pressKey(key) { return this.keyboard.tap(key); }
  typeText(text) { return this.keyboard.type(text); }
  typeSlow(text) { return this.keyboard.typeHuman(text); }
  shortcut(keys) { return this.keyboard.shortcut(keys); }

  // ক্লিপবোর্ড
  async copyToClipboard(text) { return await ClipboardController.copy(text); }
  async pasteFromClipboard() { return await ClipboardController.paste(); }

  // মাউস পজিশন রিপোর্ট
  whereAmI() { return this.mouse.getPosition(); }
}

// ========== ৫. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runMouseKeyboardGhost(fusionData, emitFeed) {
  emitFeed('info', '🖱️⌨️ মাউস ও কীবোর্ড ভুত সক্রিয় – ইনপুট সিমুলেশন প্রস্তুত');
  const controller = new MouseKeyboardGhostController();
  
  // টেস্ট: মাউস পজিশন দেখানো
  const pos = controller.whereAmI();
  emitFeed('info', `📍 বর্তমান মাউস অবস্থান: (${pos.x}, ${pos.y})`);
  
  // টেস্ট: স্ক্রিন সাইজ
  const screen = controller.mouse.getScreenSize();
  emitFeed('info', `🖥️ স্ক্রিন রেজোলিউশন: ${screen.width} x ${screen.height}`);
  
  fusionData.custom.results.mouseKeyboardGhost = {
    status: 'ready',
    mousePosition: pos,
    screenSize: screen
  };
  return { ok: true, controller };
}

// ========== ৬. এক্সপোর্ট ==========
module.exports = {
  MouseController,
  KeyboardController,
  ClipboardController,
  MouseKeyboardGhostController,
  runMouseKeyboardGhost
};

console.log('✅ mouse-keyboard-ghost.js লোড হয়েছে – মাউস ও কীবোর্ড ভুত প্রস্তুত');
