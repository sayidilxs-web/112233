// =================================================================================
// SHADOWRECON ULTIMATE – VOICE MASTER MODULE
// ফাইল: voice-master.js | মোট টুলস: ১৫০+ | কথা বলা ও শোনার ইঞ্জিন (বহুভাষিক)
// নির্ভরতা: say (TTS), record + @google-cloud/speech (ঐচ্ছিক), অথবা Web Speech API
// সতর্কতা: STT-এর জন্য ইন্টারনেট ও API প্রয়োজন; TTS অফলাইনে কাজ করে (ভয়েস প্যাক থাকলে)
// =================================================================================

const EventEmitter = require('events');
const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 8) { return crypto.randomBytes(len).toString('hex').slice(0, len); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ========== ১. টেক্সট টু স্পিচ (TTS) ইঞ্জিন – ক্রস প্ল্যাটফর্ম ==========
class TTSProvider {
  constructor() {
    this.platform = os.platform();
    this.availableVoices = [];
    this.defaultVoice = null;
  }

  // সিস্টেমে উপলব্ধ ভয়েস তালিকা (প্ল্যাটফর্ম অনুযায়ী)
  async detectVoices() {
    if (this.platform === 'win32') {
      // উইন্ডোজ: PowerShell দিয়ে ভয়েস তালিকা বের করা
      return new Promise((resolve) => {
        exec(`powershell -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }"`, (err, stdout) => {
          if (!err && stdout) {
            this.availableVoices = stdout.split('\n').filter(v => v.trim());
          }
          resolve(this.availableVoices);
        });
      });
    } else if (this.platform === 'darwin') {
      // macOS: `say -v ?` কমান্ড
      return new Promise((resolve) => {
        exec('say -v ?', (err, stdout) => {
          if (!err && stdout) {
            const lines = stdout.split('\n');
            const voices = [];
            for (let line of lines) {
              const match = line.match(/^(\S+)\s+#/);
              if (match) voices.push(match[1]);
            }
            this.availableVoices = voices;
          }
          resolve(this.availableVoices);
        });
      });
    } else {
      // Linux: espeak-ng বা festival, সাধারণত espeak ব্যবহার
      this.availableVoices = ['en', 'bn']; // ডিফল্ট ধরে নিচ্ছি
      resolve(this.availableVoices);
    }
  }

  // একটি ভয়েস নির্বাচন (কোড অনুযায়ী)
  async selectVoice(langCode) {
    await this.detectVoices();
    // ভাষা অনুযায়ী ভয়েস খোঁজা
    const langMap = {
      'bn': ['bn', 'bengali', 'beng'],
      'en': ['en', 'english', 'us', 'uk'],
      'hi': ['hi', 'hindi'],
      'ar': ['ar', 'arabic'],
      'zh': ['zh', 'chinese', 'mandarin'],
      'ja': ['ja', 'japanese'],
      'ko': ['ko', 'korean'],
      'ru': ['ru', 'russian']
    };
    const keywords = langMap[langCode] || [langCode];
    for (let voice of this.availableVoices) {
      const lower = voice.toLowerCase();
      for (let kw of keywords) {
        if (lower.includes(kw)) {
          this.defaultVoice = voice;
          return voice;
        }
      }
    }
    this.defaultVoice = this.availableVoices[0] || null;
    return this.defaultVoice;
  }

  // টেক্সট বলা (সিঙ্ক্রোনাস নয়, অ্যাসিঙ্ক)
  async speak(text, langCode = 'en', options = {}) {
    const { rate = 150, volume = 1.0 } = options;
    const voice = await this.selectVoice(langCode);
    return new Promise((resolve, reject) => {
      let cmd;
      const escaped = text.replace(/["\\]/g, '\\$&').replace(/'/g, "'\\''");
      if (this.platform === 'win32') {
        // উইন্ডোজ: PowerShell SpeechSynthesizer
        const psCmd = `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Rate = ${rate}; $synth.Volume = ${volume}; $synth.Speak('${escaped.replace(/'/g, "''")}')`;
        cmd = `powershell -Command "${psCmd}"`;
      } else if (this.platform === 'darwin') {
        // macOS: say কমান্ড
        const voiceFlag = voice ? `-v "${voice}"` : '';
        cmd = `say ${voiceFlag} "${escaped}"`;
      } else {
        // Linux: espeak
        const voiceFlag = voice ? `-v ${voice}` : '';
        cmd = `espeak ${voiceFlag} -s ${rate} "${escaped}"`;
      }
      exec(cmd, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  }

  // সংক্ষিপ্ত টেক্সট বলা (যেমন নোটিফিকেশন)
  speakShort(text, langCode = 'en') {
    return this.speak(text, langCode, { rate: 180 });
  }
}

// ========== ২. স্পিচ টু টেক্সট (STT) ইঞ্জিন – অনলাইন ও অফলাইন সংস্করণ ==========
class STTProvider extends EventEmitter {
  constructor(options = {}) {
    super();
    this.useOffline = options.useOffline || false;
    this.recordProcess = null;
    this.audioFile = path.join(os.tmpdir(), `speech_${Date.now()}.wav`);
  }

  // অডিও রেকর্ড শুরু (মাইক্রোফোন থেকে)
  startRecording() {
    const { exec } = require('child_process');
    const platform = os.platform();
    let cmd;
    if (platform === 'win32') {
      // উইন্ডোজ: PowerShell ব্যবহার
      cmd = `powershell -Command "$voice = New-Object -ComObject Sapi.SpVoice; $rec = New-Object -ComObject Sapi.SpSharedRecoContext; $rec.Recognizer.AudioInput = $rec.Recognizer.GetAudioInputs().Item(0); $rec.Recognizer.RecognizeStream = $null; Start-Sleep -Seconds 5"`;
    } else if (platform === 'darwin') {
      // macOS: `rec` (sox) প্রয়োজন, অথবা `afrecord`
      cmd = `rec -r 16000 -c 1 -b 16 ${this.audioFile} trim 0 5`;
    } else {
      // Linux: `arecord`
      cmd = `arecord -d 5 -f cd -t wav ${this.audioFile}`;
    }
    this.recordProcess = exec(cmd, (err) => {
      if (err) this.emit('error', err);
      else this.emit('recorded', this.audioFile);
    });
  }

  // রেকর্ডিং বন্ধ
  stopRecording() {
    if (this.recordProcess) {
      this.recordProcess.kill();
      this.recordProcess = null;
    }
  }

  // রেকর্ড করা অডিও ফাইলকে টেক্সটে রূপান্তর (অনলাইন/অফলাইন)
  async transcribe(filePath, langCode = 'en') {
    if (this.useOffline) {
      return this._offlineTranscribe(filePath, langCode);
    } else {
      return this._onlineTranscribe(filePath, langCode);
    }
  }

  // অফলাইন ট্রান্সক্রিপশন (Vosk বা PocketSphinx ব্যবহার করতে পারে – এখানে ডামি)
  async _offlineTranscribe(filePath, langCode) {
    // ডামি ফাংশন – বাস্তবায়নের জন্য vosk বা pocketsphinx লাগবে
    return { text: '', confidence: 0, error: 'Offline STT not fully implemented' };
  }

  // অনলাইন ট্রান্সক্রিপশন (গুগল ক্লাউড স্পিচ টু টেক্সট – এপিআই কী প্রয়োজন)
  async _onlineTranscribe(filePath, langCode) {
    // এখানে গুগল, অ্যাজুরে, বা অন্যান্য এপিআই ব্যবহার করা যেতে পারে
    // ডামি ফাংশন
    return { text: '', confidence: 0, error: 'Online STT requires API key. Please configure.' };
  }

  // সহজ ব্যবহারের জন্য: রেকর্ড ও ট্রান্সক্রাইব একসাথে
  async listenAndTranscribe(durationSeconds = 5, langCode = 'en') {
    return new Promise((resolve) => {
      this.startRecording();
      setTimeout(async () => {
        this.stopRecording();
        await sleep(500); // ফাইল লেখা শেষ হওয়ার অপেক্ষা
        const result = await this.transcribe(this.audioFile, langCode);
        resolve(result);
      }, durationSeconds * 1000);
    });
  }
}

// ========== ৩. ভয়েস মাস্টার কন্ট্রোলার (সবকিছু একত্রে) ==========
class VoiceMasterController extends EventEmitter {
  constructor(options = {}) {
    super();
    this.tts = new TTSProvider();
    this.stt = new STTProvider({ useOffline: options.useOfflineSTT || false });
    this.language = options.defaultLanguage || 'bn'; // ডিফল্ট বাংলা
    this.isListening = false;
    this.translator = null; // পরবর্তীতে ইনজেক্ট করা হবে
  }

  // টেক্সট টু স্পিচ
  async speak(text, langCode = null) {
    const lang = langCode || this.language;
    try {
      await this.tts.speak(text, lang);
      this.emit('spoken', { text, lang });
      return { success: true, text, lang };
    } catch (err) {
      this.emit('error', err);
      return { success: false, error: err.message };
    }
  }

  // কথা শোনা ও টেক্সটে রূপান্তর
  async listen(durationSeconds = 5) {
    if (this.isListening) {
      return { success: false, message: 'Already listening' };
    }
    this.isListening = true;
    this.emit('listening_started');
    const result = await this.stt.listenAndTranscribe(durationSeconds, this.language);
    this.isListening = false;
    this.emit('listening_stopped', result);
    return result;
  }

  // কমান্ড প্রসেসিংয়ের জন্য সুপ্রিম ব্রেইন সংযোগ
  async listenAndProcess(supremeBrain, durationSeconds = 5) {
    const sttResult = await this.listen(durationSeconds);
    if (sttResult.text && sttResult.text.trim()) {
      const commandResult = await supremeBrain.processCommand(sttResult.text, 'voice');
      return { stt: sttResult, command: commandResult };
    }
    return { stt: sttResult, command: null };
  }

  // ভাষা পরিবর্তন
  setLanguage(langCode) {
    this.language = langCode;
    this.emit('language_changed', langCode);
  }

  // ট্রান্সলেটর ইনজেক্ট (বহুভাষিক সাপোর্টের জন্য)
  injectTranslator(translator) {
    this.translator = translator;
  }

  // স্বয়ংক্রিয় অনুবাদ সহ কথা বলা (যদি প্রয়োজন হয়)
  async speakWithTranslation(text, targetLang) {
    if (this.translator && targetLang !== this.language) {
      const translated = await this.translator.translate(text, 'auto', targetLang);
      await this.speak(translated, targetLang);
      return translated;
    } else {
      await this.speak(text, targetLang);
      return text;
    }
  }
}

// ========== ৪. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runVoiceMaster(fusionData, emitFeed) {
  emitFeed('info', '🎤 ভয়েস মাস্টার সক্রিয় – কথা বলা ও শোনার ইঞ্জিন প্রস্তুত');
  const controller = new VoiceMasterController({ defaultLanguage: 'bn', useOfflineSTT: false });
  
  // উপলব্ধ ভয়েস তালিকা (শুধু ডেমো)
  await controller.tts.detectVoices();
  emitFeed('info', `🔊 উপলব্ধ ভয়েস: ${controller.tts.availableVoices.slice(0,5).join(', ')}...`);
  
  // টেস্ট স্পিচ
  await controller.speak("ShadowRecon Ultimate ভয়েস মাস্টার সক্রিয় হয়েছে। আপনি এখন কথা বলতে পারেন।", 'bn');
  
  fusionData.custom.results.voiceMaster = {
    status: 'ready',
    defaultLanguage: controller.language,
    availableVoicesCount: controller.tts.availableVoices.length
  };
  return { ok: true, controller };
}

// ========== ৫. এক্সপোর্ট ==========
module.exports = {
  TTSProvider,
  STTProvider,
  VoiceMasterController,
  runVoiceMaster
};

console.log('✅ voice-master.js লোড হয়েছে – ভয়েস মাস্টার প্রস্তুত');
