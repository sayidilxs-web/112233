// =================================================================================
// SHADOWRECON ULTIMATE – GHOST REFLECTOR MODULE
// ফাইল: ghost-reflector.js | মোট টুলস: ৬৫০+ | প্রতারণামূলক প্রতিক্রিয়া ও বিভ্রান্তি সৃষ্টি
// সতর্কতা: শুধুমাত্র নৈতিক প্রতিরক্ষায় ব্যবহার করুন, নিজের অনুমতিপ্রাপ্ত সিস্টেমে
// =================================================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const https = require('https');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 16) { return crypto.randomBytes(len).toString('hex').slice(0, len); }

// ========== ১. ঘোস্ট পেলোড জেনারেটর (বিভ্রান্তিকর পেলোড) ==========
class GhostPayloadGenerator {
  constructor() {
    this.mimicPatterns = [
      { name: 'sqli', pattern: /('|"|;|--|#|%27|%22)/i },
      { name: 'xss', pattern: /(<script|javascript:|onload=|alert\()/i },
      { name: 'lfi', pattern: /(\.\.\/|\.\.%2f|etc\/passwd)/i }
    ];
  }

  // আসল পেলোডের চেহারা অনুকরণ করে জাল পেলোড তৈরি
  generateMimicPayload(originalPayload) {
    let fake = originalPayload;
    for (let mp of this.mimicPatterns) {
      if (mp.pattern.test(originalPayload)) {
        fake = this._mutatePayload(originalPayload);
        break;
      }
    }
    return fake;
  }

  _mutatePayload(payload) {
    const mutations = [
      (p) => p.replace(/'/g, '"'),
      (p) => p.toUpperCase(),
      (p) => p.split('').reverse().join(''),
      (p) => p + randomString(5),
      (p) => encodeURIComponent(p)
    ];
    const mutator = mutations[Math.floor(Math.random() * mutations.length)];
    return mutator(payload);
  }

  // সম্পূর্ণ জাল HTTP রিকোয়েস্ট তৈরি (যাতে আক্রমণকারী ভুল পথে চলে যায়)
  generateFakeRequest(targetHost, fakePath) {
    return {
      method: 'GET',
      url: `http://${targetHost}${fakePath}`,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'X-Fake-Header': randomString(12)
      }
    };
  }
}

// ========== ২. ভুতুড়ে প্রতিক্রিয়া তৈরি (জাল রেসপন্স) ==========
class GhostResponseFactory {
  constructor() {
    this.templates = {
      sqli: {
        status: 200,
        body: '<html><body><h1>Database Error</h1><p>You have an error in your SQL syntax</p><pre>MySQL: You have an error near \'OR 1=1-- \' at line 1</pre></body></html>'
      },
      xss: {
        status: 200,
        body: '<html><body><script>alert("XSS Success"); document.cookie="session=ghost_session"</script><h1>Welcome</h1></body></html>'
      },
      lfi: {
        status: 200,
        body: 'root:x:0:0:root:/root:/bin/bash\n daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n (fake passwd file)'
      },
      login: {
        status: 302,
        headers: { 'Location': '/dashboard' },
        body: ''
      },
      generic: {
        status: 200,
        body: '<html><body><h1>OK</h1><p>Request processed.</p></body></html>'
      }
    };
  }

  // আক্রমণের ধরন অনুযায়ী জাল রেসপন্স তৈরি
  createResponse(attackType, additionalData = {}) {
    const template = this.templates[attackType] || this.templates.generic;
    const response = {
      status: template.status,
      headers: { 'Content-Type': 'text/html', 'Server': 'Apache/2.4.41 (Ubuntu)', ...template.headers },
      body: template.body
    };
    if (additionalData.inject) {
      response.body = response.body.replace('</body>', `<div style="display:none">${additionalData.inject}</div></body>`);
    }
    return response;
  }

  // লুপ তৈরি: এমন প্রতিক্রিয়া যা আক্রমণকারীকে বারবার একই জায়গায় ফিরিয়ে দেয়
  createInfiniteLoopResponse(redirectUrl) {
    return {
      status: 302,
      headers: { 'Location': redirectUrl },
      body: ''
    };
  }
}

// ========== ৩. বিভ্রান্তিকর নেটওয়ার্ক স্তর (ডিকয় ট্রাফিক) ==========
class DeceptionNetworkLayer {
  constructor() {
    this.decoyPorts = [22, 80, 443, 8080, 3389, 5900];
    this.activeDecoys = new Map();
  }

  startDecoyServer(port, responseFactory, attackType = 'generic') {
    const server = net.createServer((socket) => {
      const clientIP = socket.remoteAddress;
      socket.write(HTTP_RESPONSE_TEMPLATE(responseFactory.createResponse(attackType)));
      socket.end();
    });
    server.listen(port, () => {});
    this.activeDecoys.set(port, server);
    return server;
  }

  stopDecoyServer(port) {
    const server = this.activeDecoys.get(port);
    if (server) server.close();
    this.activeDecoys.delete(port);
  }
}

// সহজ HTTP রেসপন্স টেমপ্লেট
function HTTP_RESPONSE_TEMPLATE(response) {
  let headers = '';
  for (let [k,v] of Object.entries(response.headers)) {
    headers += `${k}: ${v}\r\n`;
  }
  return `HTTP/1.1 ${response.status} OK\r\n${headers}\r\n${response.body}`;
}

// ========== ৪. ঘোস্ট রিফ্লেক্টর ইঞ্জিন ==========
class GhostReflectorEngine {
  constructor() {
    this.payloadGen = new GhostPayloadGenerator();
    this.respFactory = new GhostResponseFactory();
    this.deceptionNet = new DeceptionNetworkLayer();
    this.reflectionLog = [];
  }

  // আক্রমণকারীর পেলোড বিশ্লেষণ করে উপযুক্ত জাল প্রতিক্রিয়া তৈরি
  reflect(originalPayload, attackType = null) {
    const detectedType = attackType || this._detectAttackType(originalPayload);
    const fakePayload = this.payloadGen.generateMimicPayload(originalPayload);
    const fakeResponse = this.respFactory.createResponse(detectedType);
    this.reflectionLog.push({
      timestamp: getTimestamp(),
      original: originalPayload.substring(0, 100),
      fake: fakePayload,
      response: fakeResponse.status,
      type: detectedType
    });
    return { fakePayload, fakeResponse };
  }

  _detectAttackType(payload) {
    const lower = payload.toLowerCase();
    if (lower.includes('union') || lower.includes('select') || lower.includes('or 1=1')) return 'sqli';
    if (lower.includes('<script') || lower.includes('alert') || lower.includes('onload')) return 'xss';
    if (lower.includes('../') || lower.includes('etc/passwd')) return 'lfi';
    if (lower.includes('login') || lower.includes('password')) return 'login';
    return 'generic';
  }

  // আক্রমণকারীকে লুপে ফাঁদানো (এক লুপে বারবার একই রেসপন্স)
  trapInLoop(redirectUrl) {
    return this.respFactory.createInfiniteLoopResponse(redirectUrl);
  }

  // বিভ্রান্তিকর ডিকয় সার্ভার স্থাপন (হানিপট)
  deployDecoy(port, attackType) {
    this.deceptionNet.startDecoyServer(port, this.respFactory, attackType);
    return { decoyDeployed: true, port, attackType };
  }

  getReflectionLog() { return this.reflectionLog; }
}

// ========== ৫. ঘোস্ট রিফ্লেক্টর কন্ট্রোলার ==========
class GhostReflectorController {
  constructor() {
    this.engine = new GhostReflectorEngine();
  }

  reflectAttack(originalPayload) {
    return this.engine.reflect(originalPayload);
  }

  deployDecoys(portsAndTypes) {
    const results = [];
    for (let { port, type } of portsAndTypes) {
      results.push(this.engine.deployDecoy(port, type));
    }
    return results;
  }

  generateConfusionReport() {
    const log = this.engine.getReflectionLog();
    return {
      totalReflections: log.length,
      lastReflection: log[log.length - 1],
      decoyPorts: Array.from(this.engine.deceptionNet.activeDecoys.keys())
    };
  }
}

// ========== ৬. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runGhostReflector(targetPayload, fusionData, emitFeed) {
  emitFeed('info', '👻 ভুতুড়ে প্রতিফলক সক্রিয় – আক্রমণকারীকে বিভ্রান্ত করা শুরু');
  const controller = new GhostReflectorController();
  
  // ডেমো: একটি পেলোড প্রতিফলিত করা
  const sqliPayload = "' OR 1=1 -- ";
  const result = controller.reflectAttack(sqliPayload);
  emitFeed('info', `🔄 আসল পেলোড: ${sqliPayload}`);
  emitFeed('info', `🎭 জাল পেলোড: ${result.fakePayload}`);
  emitFeed('info', `📡 জাল রেসপন্স: HTTP ${result.fakeResponse.status}`);
  
  // ডিকয় সার্ভার স্থাপন
  const decoys = controller.deployDecoys([
    { port: 8081, type: 'sqli' },
    { port: 8082, type: 'xss' }
  ]);
  emitFeed('info', `🕳️ ডিকয় সার্ভার স্থাপিত: পোর্ট ${decoys.map(d=>d.port).join(', ')}`);
  
  const report = controller.generateConfusionReport();
  emitFeed('success', `✅ বিভ্রান্তি লগ: ${report.totalReflections}টি ঘটনা`);
  
  fusionData.custom.results.ghostReflector = {
    reflectedPayload: result.fakePayload,
    responseStatus: result.fakeResponse.status,
    decoys: decoys,
    confusionReport: report
  };
  return { ok: true, controller };
}

// ========== ৭. এক্সপোর্ট ==========
module.exports = {
  GhostPayloadGenerator,
  GhostResponseFactory,
  DeceptionNetworkLayer,
  GhostReflectorEngine,
  GhostReflectorController,
  runGhostReflector
};

console.log('✅ ghost-reflector.js লোড হয়েছে – ভুতুড়ে প্রতিফলক প্রস্তুত');
