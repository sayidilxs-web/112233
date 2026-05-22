// =================================================================================
// SHADOWRECON ULTIMATE – SECURITY GUARD MODULE
// ফাইল: security-guard.js | মোট টুলস: ৫০+ | অথেন্টিকেশন, অ্যাক্সেস কন্ট্রোল, ভয়েস প্রিন্ট (সিম্পল)
// নির্ভরতা: Node.js built-in crypto, fs
// সতর্কতা: শুধুমাত্র নিজের সিস্টেমের সুরক্ষার জন্য ব্যবহার করুন
// =================================================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 16) { return crypto.randomBytes(len).toString('hex').slice(0, len); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ========== ১. পাসওয়ার্ড হ্যাশিং ও যাচাই ==========
class PasswordHasher {
  static hash(password, salt = null) {
    if (!salt) salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
    return { salt, hash };
  }
  static verify(password, salt, hash) {
    const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
    return testHash === hash;
  }
}

// ========== ২. ভয়েস প্রিন্ট সিমুলেটর (সাধারণ পদ্ধতি) ==========
class VoicePrintSimulator {
  constructor() {
    this.profile = null; // { features, hash }
  }

  // ভয়েস প্রিন্ট তৈরি (একটি স্ট্রিং থেকে – বাস্তবে অডিও ফিচার হবে)
  enroll(voiceSampleText) {
    const features = voiceSampleText.toLowerCase().replace(/\s+/g, ' ').trim();
    const { salt, hash } = PasswordHasher.hash(features);
    this.profile = { salt, hash };
    return { success: true };
  }

  // ভয়েস প্রিন্ট যাচাই
  verify(voiceSampleText) {
    if (!this.profile) return false;
    const features = voiceSampleText.toLowerCase().replace(/\s+/g, ' ').trim();
    return PasswordHasher.verify(features, this.profile.salt, this.profile.hash);
  }
}

// ========== ৩. সিকিউরিটি গার্ড ইঞ্জিন ==========
class SecurityGuardEngine extends EventEmitter {
  constructor(storageFile = './security_guard.json') {
    super();
    this.storageFile = storageFile;
    this.locked = true;          // শুরুতে লক করা
    this.passwordHash = null;
    this.voicePrint = new VoicePrintSimulator();
    this.attempts = 0;
    this.maxAttempts = 5;
    this.lockoutUntil = null;
    this.adminPassphrase = 'ShadowReconMaster2025'; // ডিফল্ট (পরিবর্তনযোগ্য)
    this.load();
  }

  // পাসওয়ার্ড সেট করা (প্রথমবার বা পরিবর্তন)
  setPassword(password) {
    const { salt, hash } = PasswordHasher.hash(password);
    this.passwordHash = { salt, hash };
    this.save();
    return true;
  }

  // পাসওয়ার্ড যাচাই
  verifyPassword(password) {
    if (!this.passwordHash) return false;
    return PasswordHasher.verify(password, this.passwordHash.salt, this.passwordHash.hash);
  }

  // ভয়েস প্রিন্ট এনরোল
  enrollVoice(voiceText) {
    return this.voicePrint.enroll(voiceText);
  }

  // ভয়েস প্রিন্ট যাচাই
  verifyVoice(voiceText) {
    return this.voicePrint.verify(voiceText);
  }

  // আনলক করার চেষ্টা (পাসওয়ার্ড অথবা ভয়েস)
  unlock(password = null, voiceText = null) {
    if (this.lockoutUntil && Date.now() < this.lockoutUntil) {
      this.emit('locked_out', { remaining: (this.lockoutUntil - Date.now()) / 1000 });
      return false;
    }
    let verified = false;
    if (password && this.verifyPassword(password)) verified = true;
    if (voiceText && this.verifyVoice(voiceText)) verified = true;
    if (verified) {
      this.locked = false;
      this.attempts = 0;
      this.lockoutUntil = null;
      this.save();
      this.emit('unlocked');
      return true;
    }
    this.attempts++;
    if (this.attempts >= this.maxAttempts) {
      this.lockoutUntil = Date.now() + 5 * 60 * 1000; // 5 মিনিট লক
      this.emit('locked_out_permanent');
    }
    this.save();
    this.emit('failed_attempt', { attempts: this.attempts });
    return false;
  }

  // লক করা
  lock() {
    this.locked = true;
    this.save();
    this.emit('locked');
  }

  // অবস্থা
  isLocked() { return this.locked; }
  getStatus() {
    return {
      locked: this.locked,
      attempts: this.attempts,
      lockoutUntil: this.lockoutUntil,
      hasPassword: !!this.passwordHash,
      hasVoicePrint: !!this.voicePrint.profile
    };
  }

  // কনফিগ ফাইল থেকে লোড
  load() {
    try {
      if (fs.existsSync(this.storageFile)) {
        const data = JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
        this.locked = data.locked;
        this.passwordHash = data.passwordHash;
        if (data.voicePrintProfile) {
          this.voicePrint.profile = data.voicePrintProfile;
        }
        this.attempts = data.attempts || 0;
        this.lockoutUntil = data.lockoutUntil;
      }
    } catch(e) {}
  }

  save() {
    const data = {
      locked: this.locked,
      passwordHash: this.passwordHash,
      voicePrintProfile: this.voicePrint.profile,
      attempts: this.attempts,
      lockoutUntil: this.lockoutUntil
    };
    fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2));
  }
}

// ========== ৪. নিরাপত্তা প্রহরী কন্ট্রোলার (ইউজার ফ্রেন্ডলি) ==========
class SecurityGuardController {
  constructor() {
    this.engine = new SecurityGuardEngine();
  }

  // প্রথমবার সেটআপ (পাসওয়ার্ড ও ভয়েস প্রিন্ট)
  setup(password, voiceSample) {
    this.engine.setPassword(password);
    this.engine.enrollVoice(voiceSample);
    return { success: true, message: 'Security guard configured. Now locked.' };
  }

  // আনলক করার চেষ্টা (পাসওয়ার্ড অথবা ভয়েস)
  async unlock(password = null, voiceSample = null) {
    if (!password && !voiceSample) {
      return { success: false, message: 'Provide password or voice sample' };
    }
    const unlocked = this.engine.unlock(password, voiceSample);
    if (unlocked) {
      return { success: true, message: 'Unlocked successfully' };
    } else {
      const status = this.engine.getStatus();
      return { success: false, message: 'Access denied', remainingAttempts: this.engine.maxAttempts - status.attempts };
    }
  }

  // লক করা
  lock() {
    this.engine.lock();
    return { success: true, message: 'Locked' };
  }

  // অবস্থা জানা
  status() { return this.engine.getStatus(); }

  // পাসওয়ার্ড পরিবর্তন (আনলক অবস্থায়)
  changePassword(oldPassword, newPassword) {
    if (this.engine.isLocked()) return { success: false, message: 'Must unlock first' };
    if (!this.engine.verifyPassword(oldPassword)) return { success: false, message: 'Old password incorrect' };
    this.engine.setPassword(newPassword);
    return { success: true, message: 'Password changed' };
  }

  // ভয়েস প্রিন্ট পুনরায় এনরোল
  reEnrollVoice(oldVoice, newVoice) {
    if (this.engine.isLocked()) return { success: false, message: 'Must unlock first' };
    if (!this.engine.verifyVoice(oldVoice)) return { success: false, message: 'Old voice not recognized' };
    this.engine.enrollVoice(newVoice);
    return { success: true, message: 'Voice print updated' };
  }
}

// ========== ৫. গার্ড মিডলওয়্যার (অন্যান্য মডিউলের সাথে সংযোগ) ==========
class SecurityGuardMiddleware {
  constructor(guardController) {
    this.guard = guardController;
  }

  // যেকোনো কমান্ড প্রসেস করার আগে এই ফাংশন কল করতে হবে
  async protect(action) {
    if (!this.guard.status().locked) {
      return await action();
    } else {
      return { success: false, error: 'System locked. Please unlock first.' };
    }
  }

  // সুপ্রিম ব্রেইনের সাথে সংযোগের জন্য র‍্যাপার
  wrapSupremeBrain(supremeBrain) {
    const originalProcess = supremeBrain.processCommand.bind(supremeBrain);
    supremeBrain.processCommand = async (rawText, source) => {
      const result = await this.protect(async () => originalProcess(rawText, source));
      return result;
    };
    return supremeBrain;
  }
}

// ========== ৬. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runSecurityGuard(fusionData, emitFeed) {
  emitFeed('info', '🛡️ নিরাপত্তা প্রহরী সক্রিয় – অথেন্টিকেশন প্রস্তুত');
  const controller = new SecurityGuardController();
  
  // ডেমো সেটআপ (প্রথমবারের জন্য)
  if (!controller.status().hasPassword) {
    controller.setup('your_strong_password', 'my voice sample for enrollment');
    emitFeed('info', '🔐 ডিফল্ট পাসওয়ার্ড ও ভয়েস প্রিন্ট সেট করা হয়েছে (আপনি পরিবর্তন করতে পারেন)');
  }
  
  // ডেমো: আনলক করার চেষ্টা
  const unlockResult = await controller.unlock('your_strong_password', null);
  if (unlockResult.success) {
    emitFeed('success', '✅ নিরাপত্তা প্রহরী আনলক হয়েছে – অ্যাসিস্ট্যান্ট ব্যবহারযোগ্য');
  } else {
    emitFeed('warn', `⚠️ আনলক ব্যর্থ: ${unlockResult.message}`);
  }
  
  fusionData.custom.results.securityGuard = {
    status: controller.status(),
    lastUnlockAttempt: unlockResult.success
  };
  return { ok: true, controller };
}

// ========== ৭. এক্সপোর্ট ==========
module.exports = {
  PasswordHasher,
  VoicePrintSimulator,
  SecurityGuardEngine,
  SecurityGuardController,
  SecurityGuardMiddleware,
  runSecurityGuard
};

console.log('✅ security-guard.js লোড হয়েছে – নিরাপত্তা প্রহরী প্রস্তুত');
