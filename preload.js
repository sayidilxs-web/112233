// =================================================================================
// SHADOWRECON ULTIMATE – PRELOAD SCRIPT (SECURE API BRIDGE)
// ফাইল: preload.js | লাইন: ২০০+ | রেন্ডারার ও মেইন প্রসেসের মধ্যে API এক্সপোজ
// =================================================================================

const { contextBridge, ipcRenderer } = require('electron');

// এখানে আমরা shadowRecon নামে একটি গ্লোবাল অবজেক্ট ফ্রন্টএন্ডে এক্সপোজ করব
contextBridge.exposeInMainWorld('shadowRecon', {
  // ------------------ ডিফেন্সিভ চেক ------------------
  runDefensiveChecks: (targetUrl) => ipcRenderer.invoke('defensive:run', { targetUrl }),
  
  // ------------------ রিপোর্ট কম্প্রেস ------------------
  compressReports: (pickLocation = false) => ipcRenderer.invoke('reports:compress', { pickLocation }),
  
  // ------------------ কাস্টম টুলস (ইউজার customModules.js) ------------------
  runCustomTools: () => ipcRenderer.invoke('custom:run'),
  
  // ------------------ ফিউশন ডাটা (গ্লোবাল স্টেট) ------------------
  getFusionData: () => ipcRenderer.invoke('fusion:get'),
  setTarget: (url) => ipcRenderer.invoke('fusion:setTarget', url),
  
  // ------------------ টুলস লিস্ট ও রান (মডিউল থেকে) ------------------
  listTools: (category = null) => ipcRenderer.invoke('tool:list', category),
  runTool: (toolId) => ipcRenderer.invoke('tool:run', toolId),
  
  // ------------------ এক্সপ্লয়েট (ডামি, পরে সংযোগ করা যাবে) ------------------
  listExploits: () => ipcRenderer.invoke('exploit:list'),
  runExploit: (id, target) => ipcRenderer.invoke('exploit:run', id, target),
  
  // ------------------ নেটওয়ার্ক ক্যাপচার ------------------
  startCapture: () => ipcRenderer.invoke('network:capture:start'),
  stopCapture: () => ipcRenderer.invoke('network:capture:stop'),
  getCaptureLog: () => ipcRenderer.invoke('network:capture:get'),
  exportCapture: () => ipcRenderer.invoke('network:capture:export'),
  
  // ------------------ সিস্টেম ইনফো ও কমান্ড ------------------
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  runSystemCommand: (cmd) => ipcRenderer.invoke('system:command', cmd),
  killProcess: (pid) => ipcRenderer.invoke('system:killProcess', pid),
  
  // ------------------ থ্রেট ইন্টেলিজেন্স ------------------
  checkThreat: (ip) => ipcRenderer.invoke('threat:check', ip),
  
  // ------------------ রিপোর্ট জেনারেট ------------------
  generateReport: () => ipcRenderer.invoke('report:generate'),
  
  // ------------------ সেটিংস (কাস্টম এডিটর) ------------------
  getSettings: () => ipcRenderer.invoke('settings:get'),
  openSettingsPath: (kind) => ipcRenderer.invoke('settings:open', { kind }),
  readCustomFile: (kind) => ipcRenderer.invoke('settings:read', { kind }),
  writeCustomFile: (kind, content) => ipcRenderer.invoke('settings:write', { kind, content }),
  
  // ------------------ লাইভ ইভেন্ট লিসেনার (UI আপডেটের জন্য) ------------------
  onFeedItem: (callback) => {
    ipcRenderer.removeAllListeners('feed:item');
    ipcRenderer.on('feed:item', (event, item) => callback(item));
  },
  onTrafficEvent: (callback) => {
    ipcRenderer.removeAllListeners('traffic:event');
    ipcRenderer.on('traffic:event', (event, entry) => callback(entry));
  },
  onProgress: (callback) => {
    ipcRenderer.removeAllListeners('analysis:progress');
    ipcRenderer.on('analysis:progress', (event, data) => callback(data));
  },
  onAnalysisDone: (callback) => {
    ipcRenderer.removeAllListeners('analysis:done');
    ipcRenderer.on('analysis:done', (event, data) => callback(data));
  },
  
  // ------------------ ইউটিলিটি ভার্সন ------------------
  version: () => '7.7.7',
  isElectron: true
});

// ========================== অতিরিক্ত সিস্টেম API (ঐচ্ছিক) ==========================
// কখনো কখনো ফ্রন্টএন্ডের সরাসরি নোটিফিকেশন বা ক্লিপবোর্ড দরকার হতে পারে
contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (title, body) => {
    new Notification(title, { body });
  },
  getPlatform: () => process.platform,
  getVersion: () => process.versions.electron
});

// কনসোল ট্র্যাপিং (ডিবাগিংয়ের জন্য, ঐচ্ছিক)
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
console.log = (...args) => {
  originalConsole.log(...args);
  ipcRenderer.send('console-log', args.map(String).join(' '));
};
console.warn = (...args) => {
  originalConsole.warn(...args);
  ipcRenderer.send('console-warn', args.map(String).join(' '));
};
console.error = (...args) => {
  originalConsole.error(...args);
  ipcRenderer.send('console-error', args.map(String).join(' '));
};

// প্রিলোড রেডি সিগন্যাল
ipcRenderer.send('preload-ready', { timestamp: new Date().toISOString() });

console.log('✅ preload.js লোড হয়েছে – shadowRecon API প্রস্তুত');
