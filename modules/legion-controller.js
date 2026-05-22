// =================================================================================
// SHADOWRECON ULTIMATE – LEGION CONTROLLER MODULE
// ফাইল: legion-controller.js | মোট টুলস: ৭০০+ | ডিস্ট্রিবিউটেড স্ক্যানিং ও প্রতিরক্ষা আর্মি
// সতর্কতা: শুধুমাত্র অনুমতিপ্রাপ্ত নোড ও আইনি কাজে ব্যবহার করুন
// =================================================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const http = require('http');
const https = require('https');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 12) { return crypto.randomBytes(len).toString('hex').slice(0, len); }

// ========== ১. লিজিয়ন নোড (একটি সদস্য কম্পিউটার) ==========
class LegionNode {
  constructor(id, host, port, apiKey) {
    this.id = id;
    this.host = host;
    this.port = port;
    this.apiKey = apiKey;
    this.status = 'offline';   // offline, online, busy
    this.lastSeen = null;
    this.capabilities = {
      cpu: 0,
      ram: 0,
      tasksCompleted: 0
    };
  }

  async ping() {
    const url = `http://${this.host}:${this.port}/status`;
    try {
      const res = await this._request(url);
      if (res && res.status === 'ok') {
        this.status = 'online';
        this.lastSeen = getTimestamp();
        this.capabilities = res.capabilities;
        return true;
      }
    } catch(e) {}
    this.status = 'offline';
    return false;
  }

  async assignTask(task) {
    if (this.status !== 'online') return { success: false, reason: 'node offline' };
    const url = `http://${this.host}:${this.port}/task`;
    try {
      const res = await this._request(url, 'POST', { task });
      if (res && res.accepted) {
        this.capabilities.tasksCompleted++;
        return { success: true, result: res.result };
      }
    } catch(e) {}
    return { success: false, reason: 'task rejected' };
  }

  _request(url, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const options = { method, headers: { 'X-API-Key': this.apiKey } };
      if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
      const req = http.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch(e) { resolve(null); }
        });
      });
      req.on('error', reject);
      if (body) req.write(options.body);
      req.end();
    });
  }
}

// ========== ২. লিজিয়ন কন্ট্রোলার (সেনাপতি) ==========
class LegionController {
  constructor() {
    this.nodes = new Map();          // id -> LegionNode
    this.tasks = [];
    this.results = [];
    this.masterApiKey = randomString(32);
  }

  // নোড রেজিস্ট্রেশন (অনুমতি নেওয়ার পর)
  registerNode(id, host, port, apiKey) {
    if (this.nodes.has(id)) return false;
    const node = new LegionNode(id, host, port, apiKey);
    this.nodes.set(id, node);
    return true;
  }

  // সব নোডের স্ট্যাটাস চেক
  async scanNodes() {
    const promises = [];
    for (let node of this.nodes.values()) {
      promises.push(node.ping());
    }
    await Promise.all(promises);
    return Array.from(this.nodes.values()).map(n => ({ id: n.id, status: n.status, capabilities: n.capabilities }));
  }

  // একটি টাস্ক সব অনলাইন নোডে বিতরণ করা
  async broadcastTask(task) {
    const onlineNodes = Array.from(this.nodes.values()).filter(n => n.status === 'online');
    const promises = onlineNodes.map(node => node.assignTask(task));
    const results = await Promise.all(promises);
    const succeeded = results.filter(r => r.success).length;
    return { total: onlineNodes.length, succeeded, results };
  }

  // ডিস্ট্রিবিউটেড স্ক্যান (ওয়েব স্ক্যানার কাজ ভাগ করা)
  async distributedWebScan(targets) {
    const chunks = this._splitArray(targets, this.nodes.size);
    let index = 0;
    const tasks = [];
    for (let node of this.nodes.values()) {
      if (node.status === 'online' && index < chunks.length) {
        tasks.push(node.assignTask({ type: 'web_scan', targets: chunks[index] }));
        index++;
      }
    }
    const results = await Promise.all(tasks);
    const allFindings = results.filter(r => r.success).flatMap(r => r.result.findings || []);
    return { findings: allFindings, nodesUsed: index };
  }

  _splitArray(arr, parts) {
    const chunkSize = Math.ceil(arr.length / parts);
    const chunks = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
      chunks.push(arr.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // আক্রমণকারীর আইপি ব্লক করার জন্য নোডগুলোর রেট লিমিটিং কনফিগার
  async deployDefense(attackerIP, durationMinutes = 10) {
    const task = { type: 'block_ip', ip: attackerIP, duration: durationMinutes };
    const result = await this.broadcastTask(task);
    return { blocked: result.succeeded > 0, nodes: result.succeeded };
  }

  // নোড থেকে সংগৃহীত ফলাফল একত্রিত করা
  aggregateResults() {
    const aggregated = {};
    for (let node of this.nodes.values()) {
      // সিমুলেটেড
      aggregated[node.id] = { tasks: node.capabilities.tasksCompleted };
    }
    return aggregated;
  }

  // ক্লাস্টারের স্বাস্থ্য রিপোর্ট
  healthReport() {
    const online = Array.from(this.nodes.values()).filter(n => n.status === 'online').length;
    const offline = this.nodes.size - online;
    return {
      totalNodes: this.nodes.size,
      online,
      offline,
      timestamp: getTimestamp()
    };
  }
}

// ========== ৩. লিজিয়ন নোড সার্ভার (প্রত্যেক সদস্য কম্পিউটারে চলে) ==========
class LegionNodeServer {
  constructor(port, apiKey, masterHost, masterPort) {
    this.port = port;
    this.apiKey = apiKey;
    this.masterHost = masterHost;
    this.masterPort = masterPort;
    this.server = null;
    this.isRunning = false;
  }

  start() {
    this.server = http.createServer((req, res) => {
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== this.apiKey) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (req.url === '/status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          capabilities: {
            cpu: os.cpus().length,
            ram: os.totalmem(),
            tasksCompleted: 0
          }
        }));
      } else if (req.url === '/task' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { task } = JSON.parse(body);
            // টাস্ক প্রসেসিং সিমুলেটেড
            const result = this._processTask(task);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ accepted: true, result }));
          } catch(e) {
            res.writeHead(400);
            res.end('Invalid task');
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    this.server.listen(this.port, () => {
      this.isRunning = true;
      console.log(`Legion node listening on port ${this.port}`);
      this._registerWithMaster();
    });
  }

  _processTask(task) {
    // সিমুলেটেড: বিভিন্ন ধরনের টাস্ক
    if (task.type === 'web_scan') {
      return { findings: task.targets.map(t => ({ target: t, vulnerability: 'test' })) };
    }
    if (task.type === 'block_ip') {
      // বাস্তবে ফায়ারওয়াল রুল যোগ করবে
      return { blocked: true, ip: task.ip, duration: task.duration };
    }
    return { status: 'unknown_task' };
  }

  _registerWithMaster() {
    const url = `http://${this.masterHost}:${this.masterPort}/register`;
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey }
    };
    const req = http.request(url, options, (res) => {});
    req.write(JSON.stringify({ nodeId: os.hostname(), host: this.getLocalIP(), port: this.port }));
    req.end();
  }

  getLocalIP() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) return net.address;
      }
    }
    return '127.0.0.1';
  }

  stop() {
    if (this.server) this.server.close();
    this.isRunning = false;
  }
}

// ========== ৪. লিজিয়ন ম্যানেজার (মাস্টার কন্ট্রোল ইউআই/কমান্ড) ==========
class LegionManager {
  constructor() {
    this.controller = new LegionController();
    this.nodeServers = []; // যদি অ্যাপ নিজেও নোড হিসেবে চলে
  }

  // নিজের কম্পিউটারকে নোড হিসেবে যোগ করা
  addSelfAsNode(port) {
    const nodeId = `self_${os.hostname()}`;
    const apiKey = randomString(32);
    const server = new LegionNodeServer(port, apiKey, '127.0.0.1', 9876);
    server.start();
    this.nodeServers.push(server);
    this.controller.registerNode(nodeId, '127.0.0.1', port, apiKey);
    return { nodeId, port, apiKey };
  }

  // দূরবর্তী নোড যোগ করা (API কী দিয়ে)
  addRemoteNode(id, host, port, apiKey) {
    return this.controller.registerNode(id, host, port, apiKey);
  }

  async health() { return this.controller.healthReport(); }
  async scanNodes() { return this.controller.scanNodes(); }
  async broadcast(task) { return this.controller.broadcastTask(task); }
  async distributedScan(targets) { return this.controller.distributedWebScan(targets); }
  async blockAttacker(ip) { return this.controller.deployDefense(ip); }
}

// ========== ৫. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runLegionController(fusionData, emitFeed) {
  emitFeed('info', '🛡️ লিজিয়ন কন্ট্রোলার সক্রিয় – ডিস্ট্রিবিউটেড ডিফেন্স আর্মি গঠিত হচ্ছে');
  const manager = new LegionManager();
  // নিজের মেশিনকে নোড হিসেবে যোগ (ঐচ্ছিক)
  const selfNode = manager.addSelfAsNode(8765);
  emitFeed('info', `➕ নিজের মেশিন নোড হিসেবে যোগ: পোর্ট ${selfNode.port}`);
  
  // কয়েকটি ডেমো রিমোট নোড (শুধু সিমুলেশন, বাস্তবে এপিআই দরকার)
  manager.addRemoteNode('demo1', '192.168.1.101', 8765, 'demo-key');
  manager.addRemoteNode('demo2', '192.168.1.102', 8765, 'demo-key');
  
  await manager.scanNodes();
  const health = await manager.health();
  emitFeed('info', `📊 নোড স্বাস্থ্য: অনলাইন ${health.online}, অফলাইন ${health.offline}`);
  
  // ডিস্ট্রিবিউটেড স্ক্যান ডেমো
  const targets = ['example.com', 'test.com', 'demo.org', 'shadowrecon.local'];
  const scanResult = await manager.distributedScan(targets);
  emitFeed('info', `🌐 ডিস্ট্রিবিউটেড স্ক্যান সম্পন্ন: ${scanResult.findings.length} ফলাফল`);
  
  fusionData.custom.results.legionController = {
    health,
    selfNode,
    distributedScanResult: scanResult.findings.slice(0,5),
    nodesRegistered: manager.controller.nodes.size
  };
  return { ok: true, manager };
}

// ========== ৬. এক্সপোর্ট ==========
module.exports = {
  LegionNode,
  LegionController,
  LegionNodeServer,
  LegionManager,
  runLegionController
};

console.log('✅ legion-controller.js লোড হয়েছে – লিজিয়ন কন্ট্রোলার প্রস্তুত');
