// =================================================================================
// SHADOWRECON ULTIMATE – SUPREME BRAIN MODULE (AI ASSISTANT CORE)
// ফাইল: supreme-brain.js | মোট টুলস: ৪০০+ | কমান্ড পার্সার, রুল ইঞ্জিন, মডিউল রাউটার
// সতর্কতা: শুধুমাত্র নৈতিক ব্যবহারের জন্য, নিজের সিস্টেমে
// =================================================================================

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 8) { return crypto.randomBytes(len).toString('hex').slice(0, len); }

// ========== ১. কমান্ড অবজেক্ট ==========
class Command {
  constructor(rawText, source = 'user') {
    this.id = randomString(6);
    this.raw = rawText;
    this.source = source;
    this.timestamp = Date.now();
    this.intent = null;      // যেমন 'open_browser', 'run_code', 'type_text'
    this.entities = {};      // যেমন { url: 'google.com', language: 'python' }
    this.confidence = 0;
  }
}

// ========== ২. রুল ইঞ্জিন (রেগেক্স ভিত্তিক) ==========
class RuleEngine {
  constructor() {
    // প্রাক-সংজ্ঞায়িত রুলস (ইংরেজি + বাংলা মিশ্র)
    this.rules = [
      // ব্রাউজার ওপেন
      { pattern: /(ওপেন|খোলো|ব্রাউজ\s+করো|open)\s+(.+)/i, intent: 'open_browser', extract: (match) => ({ url: match[2] }) },
      { pattern: /(গুগল|google)\s+(.*)/i, intent: 'google_search', extract: (match) => ({ query: match[2] }) },
      
      // ফাইল অপারেশন
      { pattern: /(ফাইল\s+তৈরি\s+করো|create\s+file)\s+(.+)/i, intent: 'create_file', extract: (match) => ({ filepath: match[2] }) },
      { pattern: /(ফাইল\s+ডিলিট\s+করো|delete\s+file)\s+(.+)/i, intent: 'delete_file', extract: (match) => ({ filepath: match[2] }) },
      { pattern: /(ফাইল\s+পড়ো|read\s+file)\s+(.+)/i, intent: 'read_file', extract: (match) => ({ filepath: match[2] }) },
      
      // অ্যাপ লঞ্চ
      { pattern: /(চালাও|লঞ্চ\s+করো|open\s+app)\s+(.+)/i, intent: 'launch_app', extract: (match) => ({ app: match[2] }) },
      
      // কমান্ড রান
      { pattern: /(কমান্ড\s+চালাও|run\s+command)\s+(.+)/i, intent: 'run_command', extract: (match) => ({ command: match[2] }) },
      
      // কোড জেনারেট
      { pattern: /(কোড\s+লিখো|লেখো)\s+(.+)/i, intent: 'generate_code', extract: (match) => ({ description: match[2] }) },
      
      // মাউস কন্ট্রোল
      { pattern: /(মাউস\s+সরাও|move\s+mouse)\s+(\d+)\s*,\s*(\d+)/i, intent: 'move_mouse', extract: (match) => ({ x: parseInt(match[2]), y: parseInt(match[3]) }) },
      { pattern: /(ক্লিক\s+করো|click)/i, intent: 'mouse_click', extract: () => ({}) },
      
      // কীবোর্ড টাইপ
      { pattern: /(টাইপ\s+করো|type)\s+(.+)/i, intent: 'type_text', extract: (match) => ({ text: match[2] }) },
      
      // ভাষা অনুবাদ (ইংরেজি থেকে বাংলা)
      { pattern: /(বাংলায়\s+অনুবাদ\s+করো|translate\s+to\s+bengali)\s+(.+)/i, intent: 'translate_to_bengali', extract: (match) => ({ text: match[2] }) },
      
      // ওয়েব স্ক্র্যাপ
      { pattern: /(স্ক্র্যাপ\s+করো|scrape)\s+(.+)/i, intent: 'scrape_website', extract: (match) => ({ url: match[2] }) },
      
      // নোটিফিকেশন
      { pattern: /(নোটিফিকেশন\s+দেখাও|show\s+notification)\s+(.+)/i, intent: 'show_notification', extract: (match) => ({ message: match[2] }) },
      
      // নির্ধারিত কাজ
      { pattern: /(প্রতি\s+(\d+)\s+(সেকেন্ড|মিনিট|ঘণ্টা)\s+পর\s+(\w+)\s+করো)/i, intent: 'schedule_task', extract: (match) => ({ interval: parseInt(match[2]), unit: match[3], action: match[4] }) }
    ];
    this.customRules = []; // ইউজার শেখানো রুলস
  }

  // কমান্ড থেকে ইনটেন্ট বের করা
  parse(rawText) {
    const allRules = [...this.rules, ...this.customRules];
    for (let rule of allRules) {
      const match = rawText.match(rule.pattern);
      if (match) {
        const cmd = new Command(rawText);
        cmd.intent = rule.intent;
        cmd.entities = rule.extract(match);
        cmd.confidence = 1.0;
        return cmd;
      }
    }
    // কোনো রুল মেলেনি
    const cmd = new Command(rawText);
    cmd.intent = 'unknown';
    cmd.confidence = 0;
    return cmd;
  }

  // নতুন রুল শেখানো
  learn(patternStr, intent, extractorFn) {
    try {
      const pattern = new RegExp(patternStr, 'i');
      this.customRules.push({
        pattern,
        intent,
        extract: extractorFn
      });
      return true;
    } catch(e) { return false; }
  }

  // সব রুল দেখানো (ডিবাগ)
  listRules() {
    return [...this.rules.map(r => r.pattern.toString()), ...this.customRules.map(r => r.pattern.toString())];
  }
}

// ========== ৩. মডিউল রেজিস্ট্রি (যেখানে কাজের লোক থাকে) ==========
class ModuleRegistry {
  constructor() {
    this.modules = new Map(); // intent -> { handler, moduleName }
  }

  register(intent, handler, moduleName) {
    this.modules.set(intent, { handler, moduleName });
  }

  getHandler(intent) {
    return this.modules.get(intent);
  }

  hasHandler(intent) {
    return this.modules.has(intent);
  }

  listIntents() {
    return Array.from(this.modules.keys());
  }
}

// ========== ৪. মেমরি ও লার্নিং (শেখা কমান্ড সংরক্ষণ) ==========
class MemoryKeeper {
  constructor(storagePath = './assistant_memory.json') {
    this.storagePath = storagePath;
    this.data = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        return JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
      }
    } catch(e) {}
    return { learnedCommands: [], history: [], preferences: {} };
  }

  save() {
    fs.writeFileSync(this.storagePath, JSON.stringify(this.data, null, 2));
  }

  addLearnedCommand(pattern, intent, extractorCode) {
    this.data.learnedCommands.push({ pattern, intent, extractorCode, addedAt: getTimestamp() });
    this.save();
  }

  getLearnedCommands() {
    return this.data.learnedCommands;
  }

  addHistory(cmd) {
    this.data.history.unshift({ raw: cmd.raw, intent: cmd.intent, timestamp: getTimestamp() });
    if (this.data.history.length > 100) this.data.history.pop();
    this.save();
  }

  getHistory(limit = 20) {
    return this.data.history.slice(0, limit);
  }
}

// ========== ৫. সুপ্রিম ব্রেন (মূল ক্লাস) ==========
class SupremeBrain extends EventEmitter {
  constructor() {
    super();
    this.ruleEngine = new RuleEngine();
    this.moduleRegistry = new ModuleRegistry();
    this.memory = new MemoryKeeper();
    this.isListening = false;
    this.currentSession = { id: randomString(8), startTime: Date.now() };
  }

  // একটি মডিউল নিবন্ধন করা
  registerModule(intent, handler, moduleName) {
    this.moduleRegistry.register(intent, handler, moduleName);
    console.log(`[SupremeBrain] Registered ${moduleName} for intent: ${intent}`);
  }

  // কমান্ড প্রসেস করা (টেক্সট ইনপুট থেকে)
  async processCommand(rawText, source = 'user') {
    const cmd = this.ruleEngine.parse(rawText);
    this.memory.addHistory(cmd);
    this.emit('command_received', cmd);

    if (cmd.intent === 'unknown') {
      const response = `Sorry, I didn't understand "${rawText}". Please rephrase or teach me.`;
      this.emit('response', response);
      return { success: false, message: response, cmd };
    }

    const handlerInfo = this.moduleRegistry.getHandler(cmd.intent);
    if (!handlerInfo) {
      const response = `Intent "${cmd.intent}" recognized but no handler registered.`;
      this.emit('response', response);
      return { success: false, message: response, cmd };
    }

    try {
      const result = await handlerInfo.handler(cmd.entities, cmd);
      const response = result.message || `✅ Done: ${cmd.intent}`;
      this.emit('response', response);
      this.emit('action_performed', { intent: cmd.intent, entities: cmd.entities, result });
      return { success: true, message: response, cmd, result };
    } catch (err) {
      const errorMsg = `❌ Error executing ${cmd.intent}: ${err.message}`;
      this.emit('response', errorMsg);
      return { success: false, message: errorMsg, cmd, error: err };
    }
  }

  // নতুন কমান্ড শেখানো (ইউজার থেকে)
  async learnNewCommand(example, intent, extractorExample) {
    // extractorExample: ফাংশনের স্ট্রিং রিপ্রেজেন্টেশন (সাবধান)
    try {
      const patternStr = example.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // সরলীকৃত
      const extractor = new Function('match', extractorExample);
      const success = this.ruleEngine.learn(patternStr, intent, extractor);
      if (success) {
        this.memory.addLearnedCommand(patternStr, intent, extractorExample);
        return { success: true, message: `Learned new command: "${example}" -> ${intent}` };
      }
    } catch(e) {
      return { success: false, message: `Learning failed: ${e.message}` };
    }
  }

  // কনভার্সেশন লুপ (ভয়েস বা টেক্সট থেকে)
  startListening() {
    this.isListening = true;
    this.emit('listening_started');
  }

  stopListening() {
    this.isListening = false;
    this.emit('listening_stopped');
  }

  // বর্তমান স্ট্যাটাস রিপোর্ট
  getStatus() {
    return {
      listening: this.isListening,
      session: this.currentSession,
      registeredIntents: this.moduleRegistry.listIntents(),
      rulesCount: this.ruleEngine.listRules().length,
      memoryHistory: this.memory.getHistory(5)
    };
  }
}

// ========== ৬. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runSupremeBrain(fusionData, emitFeed) {
  emitFeed('info', '🧠 সুপ্রিম ব্রেইন সক্রিয় – কমান্ড শোনার জন্য প্রস্তুত');
  const brain = new SupremeBrain();
  
  // ডেমো হ্যান্ডলার নিবন্ধন (আসল হ্যান্ডলার অন্যান্য ফাইল থেকে আসবে)
  brain.registerModule('open_browser', async (entities) => {
    const url = entities.url.startsWith('http') ? entities.url : `https://${entities.url}`;
    return { message: `Opening browser with ${url}`, url };
  }, 'demo-browser');
  
  brain.registerModule('unknown', async () => ({ message: 'Unknown command, please rephrase.' }), 'demo-default');
  
  // একটি টেস্ট কমান্ড প্রসেস
  const testCmd = "ওপেন গুগল ডট কম";
  const result = await brain.processCommand(testCmd);
  emitFeed('info', `📝 টেস্ট কমান্ড: "${testCmd}" -> ${result.message}`);
  
  fusionData.custom.results.supremeBrain = {
    status: brain.getStatus(),
    testCommandResult: result.message,
    registeredModules: brain.moduleRegistry.listIntents()
  };
  return { ok: true, brain };
}

// ========== ৭. এক্সপোর্ট ==========
module.exports = {
  Command,
  RuleEngine,
  ModuleRegistry,
  MemoryKeeper,
  SupremeBrain,
  runSupremeBrain
};

console.log('✅ supreme-brain.js লোড হয়েছে – সুপ্রিম ব্রেইন প্রস্তুত');
