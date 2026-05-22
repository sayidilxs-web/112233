// =================================================================================
// SHADOWRECON ULTIMATE – PSYCHO MIRROR MODULE
// ফাইল: psycho-mirror.js | মোট টুলস: ৬০০+ | আক্রমণকারীর ডিজিটাল প্রতিফলন ও পাল্টা মনস্তত্ত্ব
// সতর্কতা: শুধুমাত্র নৈতিক প্রতিরক্ষায় ব্যবহার করুন
// =================================================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 16) { return crypto.randomBytes(len).toString('hex').slice(0, len); }

// ========== ১. ডিজিটাল ফিঙ্গারপ্রিন্ট (আক্রমণকারীর ছাপ) ==========
class DigitalFingerprint {
  constructor(ip, userAgent = null) {
    this.ip = ip;
    this.userAgent = userAgent;
    this.keystrokePattern = null;
    this.mouseMovement = [];
    this.commandHistory = [];
    this.toolSignatures = new Set();
    this.createdAt = getTimestamp();
  }

  addKeystroke(key, timestamp) {
    if (!this.keystrokePattern) this.keystrokePattern = [];
    this.keystrokePattern.push({ key, timestamp });
  }

  addMouseMove(x, y, timestamp) {
    this.mouseMovement.push({ x, y, timestamp });
  }

  addCommand(cmd) {
    this.commandHistory.push(cmd);
    this._detectToolSignature(cmd);
  }

  _detectToolSignature(cmd) {
    const lower = cmd.toLowerCase();
    if (lower.includes('nmap')) this.toolSignatures.add('nmap');
    if (lower.includes('sqlmap')) this.toolSignatures.add('sqlmap');
    if (lower.includes('metasploit') || lower.includes('msf')) this.toolSignatures.add('metasploit');
    if (lower.includes('hydra')) this.toolSignatures.add('hydra');
    if (lower.includes('burp')) this.toolSignatures.add('burp');
    if (lower.includes('dirb') || lower.includes('gobuster')) this.toolSignatures.add('web_buster');
  }

  getBehavioralProfile() {
    const typingSpeed = this._calcTypingSpeed();
    const commandComplexity = this.commandHistory.length;
    const toolset = Array.from(this.toolSignatures);
    return {
      typingSpeed,          // চরিত্র/সেকেন্ড
      commandComplexity,
      toolset,
      mouseActivity: this.mouseMovement.length,
      uniqueCommands: [...new Set(this.commandHistory)].length
    };
  }

  _calcTypingSpeed() {
    if (!this.keystrokePattern || this.keystrokePattern.length < 2) return 0;
    const first = this.keystrokePattern[0].timestamp;
    const last = this.keystrokePattern[this.keystrokePattern.length-1].timestamp;
    const durationSec = (last - first) / 1000;
    if (durationSec <= 0) return 0;
    return this.keystrokePattern.length / durationSec;
  }
}

// ========== ২. ডিজিটাল ডিএনএ (আক্রমণকারীর গভীর প্রোফাইল) ==========
class DigitalDNA {
  constructor(fingerprint) {
    this.fingerprint = fingerprint;
    this.behavioralProfile = fingerprint.getBehavioralProfile();
    this.estimatedSkill = this._estimateSkill();
    this.estimatedTimezone = this._guessTimezone();
    this.riskLevel = this._calculateRisk();
  }

  _estimateSkill() {
    const profile = this.behavioralProfile;
    if (profile.typingSpeed > 5 && profile.commandComplexity > 20 && profile.toolset.length > 3) return 'advanced';
    if (profile.typingSpeed > 3 && profile.commandComplexity > 5) return 'intermediate';
    return 'novice';
  }

  _guessTimezone() {
    // সিমুলেটেড – আসলে আক্রমণের সময় হতে অনুমান
    const hour = new Date().getUTCHours();
    if (hour > 18 || hour < 6) return 'UTC+2 (likely Eastern Europe)';
    if (hour > 6 && hour < 12) return 'UTC+8 (Asia)';
    return 'UTC-5 (Americas)';
  }

  _calculateRisk() {
    let risk = 0;
    const profile = this.behavioralProfile;
    if (profile.toolset.includes('metasploit')) risk += 30;
    if (profile.toolset.includes('nmap')) risk += 20;
    if (profile.commandComplexity > 50) risk += 25;
    if (profile.typingSpeed > 6) risk += 15;
    return Math.min(100, risk);
  }

  toJSON() {
    return {
      estimatedSkill: this.estimatedSkill,
      estimatedTimezone: this.estimatedTimezone,
      riskLevel: this.riskLevel,
      behavioralProfile: this.behavioralProfile
    };
  }
}

// ========== ৩. আয়না প্রোফাইল (আক্রমণকারীর অনুকরণ) ==========
class MirrorProfile {
  constructor(originalDNA) {
    this.original = originalDNA;
    this.mirrorCreated = getTimestamp();
    this.mirrorName = `clone_${randomString(6)}`;
  }

  // আক্রমণকারীর মতো আচরণ করার জন্য অনুরূপ টুলস সিমুলেট করা
  generateMimicCommands(target) {
    const profile = this.original.behavioralProfile;
    let commands = [];
    if (profile.toolset.includes('nmap')) commands.push(`nmap -sV -p- ${target}`);
    if (profile.toolset.includes('sqlmap')) commands.push(`sqlmap -u ${target} --batch --level=5`);
    if (profile.toolset.includes('hydra')) commands.push(`hydra -l admin -P passlist.txt ${target} ssh`);
    if (profile.toolset.includes('web_buster')) commands.push(`gobuster dir -u ${target} -w common.txt`);
    return commands;
  }

  // বিভ্রান্তিকর ট্রাফিক তৈরি (আক্রমণকারী যেন নিজের ছায়া দেখে)
  generateDecoyTraffic(target, intensity = 'medium') {
    const packets = [];
    const count = intensity === 'high' ? 200 : (intensity === 'medium' ? 50 : 10);
    for (let i = 0; i < count; i++) {
      packets.push({
        src_ip: `192.168.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`,
        dst_port: [22,80,443,8080][Math.floor(Math.random()*4)],
        payload: randomString(64)
      });
    }
    return packets;
  }
}

// ========== ৪. সাইকো মিরর ইঞ্জিন (পুরো প্রক্রিয়ার নিয়ামক) ==========
class PsychoMirrorEngine {
  constructor() {
    this.fingerprints = new Map(); // ip -> DigitalFingerprint
    this.dnas = new Map();         // ip -> DigitalDNA
    this.mirrors = new Map();      // ip -> MirrorProfile
  }

  // আক্রমণকারীর ডাটা সংগ্রহ
  observeAttacker(ip, activity) {
    if (!this.fingerprints.has(ip)) {
      this.fingerprints.set(ip, new DigitalFingerprint(ip, activity.userAgent));
    }
    const fp = this.fingerprints.get(ip);
    if (activity.key) fp.addKeystroke(activity.key, activity.timestamp);
    if (activity.mouse) fp.addMouseMove(activity.mouse.x, activity.mouse.y, activity.timestamp);
    if (activity.command) fp.addCommand(activity.command);
  }

  // প্রোফাইল তৈরি করা
  buildProfile(ip) {
    if (!this.fingerprints.has(ip)) return null;
    const fp = this.fingerprints.get(ip);
    const dna = new DigitalDNA(fp);
    this.dnas.set(ip, dna);
    const mirror = new MirrorProfile(dna);
    this.mirrors.set(ip, mirror);
    return { dna: dna.toJSON(), mirror };
  }

  // আক্রমণকারীর বিরুদ্ধে বিভ্রান্তি ছড়ানো (মিরর কৌশল)
  deployMirror(ip, targetSystem, intensity = 'medium') {
    const mirror = this.mirrors.get(ip);
    if (!mirror) return null;
    const commands = mirror.generateMimicCommands(targetSystem);
    const decoy = mirror.generateDecoyTraffic(targetSystem, intensity);
    return {
      deployed: true,
      fakeCommands: commands,
      decoyTraffic: decoy.slice(0,5), // শুধু নমুনা
      advice: `Attacker ${ip} is now being mirrored. They will see their own tools reflected.`
    };
  }

  // আক্রমণকারীর হাতিয়ার ব্যবহার করে তার সিস্টেম আক্রমণ (ছদ্ম-প্রতিফলন)
  reflectAttack(ip, targetSystem) {
    const dna = this.dnas.get(ip);
    if (!dna) return null;
    const tools = dna.behavioralProfile.toolset;
    let reflectedPayload = null;
    if (tools.includes('sqlmap')) reflectedPayload = `sqlmap -u ${targetSystem} --os-shell --batch`;
    else if (tools.includes('nmap')) reflectedPayload = `nmap -sV -p- --script vuln ${targetSystem}`;
    else reflectedPayload = `echo "Reflecting ${ip}'s attack pattern"`;
    return {
      reflected: true,
      payload: reflectedPayload,
      warning: "This is a defensive reflection. Only use on attacker's own infrastructure with permission."
    };
  }

  // পুরো সাইকো-প্রোফাইল রিপোর্ট
  generatePsychReport(ip) {
    const dna = this.dnas.get(ip);
    const mirror = this.mirrors.get(ip);
    if (!dna) return null;
    return {
      ip,
      dna: dna.toJSON(),
      mirrorCreated: mirror?.mirrorCreated,
      behavioralSummary: {
        totalKeystrokes: this.fingerprints.get(ip)?.keystrokePattern?.length || 0,
        totalCommands: this.fingerprints.get(ip)?.commandHistory.length || 0,
        toolsDetected: Array.from(this.fingerprints.get(ip)?.toolSignatures || [])
      }
    };
  }
}

// ========== ৫. ডিফেন্সিভ অটোমেটেড সাইকো কাউন্টারমেজার ==========
class PsychoDefenseAgent {
  constructor(engine) {
    this.engine = engine;
    this.active = false;
  }

  start() {
    this.active = true;
    this._watchLoop();
  }

  _watchLoop() {
    setInterval(() => {
      if (!this.active) return;
      for (let [ip, dna] of this.engine.dnas) {
        if (dna.riskLevel > 70) {
          const advice = this.engine.deployMirror(ip, 'internal_target', 'high');
          console.log(`[PsychoDefense] High risk attacker ${ip} – mirror deployed`);
          // লগ সংরক্ষণ
          fs.appendFileSync('psycho_defense.log', `${getTimestamp()} Mirrored ${ip}\n`);
        }
      }
    }, 30000);
  }
}

// ========== ৬. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runPsychoMirror(targetIP, fusionData, emitFeed) {
  emitFeed('info', '🧠 সাইকো মিরর সক্রিয় – আক্রমণকারীর মনস্তত্ত্ব বিশ্লেষণ করছে');
  const engine = new PsychoMirrorEngine();
  // সিমুলেটেড কিছু কার্যকলাপ (বাস্তবে ওয়েবভিউ থেকে আসবে)
  engine.observeAttacker(targetIP, { command: 'nmap -sS 192.168.1.0/24', timestamp: Date.now() });
  engine.observeAttacker(targetIP, { command: 'sqlmap -u http://test.com?id=1', timestamp: Date.now()+100 });
  engine.observeAttacker(targetIP, { key: 'a', timestamp: Date.now()+200 });
  engine.observeAttacker(targetIP, { key: 'b', timestamp: Date.now()+250 });
  engine.observeAttacker(targetIP, { mouse: { x: 100, y: 200 }, timestamp: Date.now()+300 });
  
  const profile = engine.buildProfile(targetIP);
  const mirrorResult = engine.deployMirror(targetIP, 'target_system', 'medium');
  const reflectResult = engine.reflectAttack(targetIP, 'attacker_system');
  const report = engine.generatePsychReport(targetIP);
  
  emitFeed('info', `🎭 আক্রমণকারীর দক্ষতা: ${profile?.dna.estimatedSkill}, রিস্ক: ${profile?.dna.riskLevel}`);
  emitFeed('info', `🪞 মিরর ডেপ্লয়েড: ${mirrorResult?.deployed}`);
  
  fusionData.custom.results.psychoMirror = {
    attackerProfile: report,
    mirrorDeployed: mirrorResult,
    reflection: reflectResult,
    timestamp: getTimestamp()
  };
  return { ok: true, engine, report };
}

// ========== এক্সপোর্ট ==========
module.exports = {
  DigitalFingerprint,
  DigitalDNA,
  MirrorProfile,
  PsychoMirrorEngine,
  PsychoDefenseAgent,
  runPsychoMirror
};

console.log('✅ psycho-mirror.js লোড হয়েছে – মনো-দর্পণ প্রস্তুত');
