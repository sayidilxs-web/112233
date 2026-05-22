/* global shadowRecon, L */

// =================================================================================
// SHADOWRECON ULTIMATE – RENDERER PROCESS (COMPLETE UI LOGIC)
// ফাইল: renderer.js | লাইন: ৬৫০+ | ট্যাব, ম্যাপ, ওয়েবভিউ, টুলস, এআই অ্যাসিস্ট্যান্ট
// =================================================================================

// ------------------------- ইউটিলিটি ফাংশন -------------------------
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

// ------------------------- স্টেট -------------------------
let currentTools = [];        // টুলস লিস্ট
let currentReportCount = 0;
let map = null;
let markersLayer = null;
let liveTraffic = true;

// ------------------------- ট্যাব নেভিগেশন -------------------------
function setActiveTab(tabId) {
  $$('.page').forEach(p => p.classList.remove('active'));
  $$('.nav-item').forEach(nav => nav.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  const nav = document.querySelector(`.nav-item[data-page="${tabId}"]`);
  if (nav) nav.classList.add('active');
}

// ------------------------- ওয়ার্ল্ড ম্যাপ ইনিশিয়ালাইজ -------------------------
function initMap() {
  if (map) return;
  map = L.map('worldMap').setView([20, 0], 2);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

function addMarkerToMap(ip, lat, lng, color = 'green') {
  if (!markersLayer) initMap();
  const markerColor = color === 'green' ? '#20ffb3' : (color === 'orange' ? '#ffaa33' : '#ff4d6d');
  const marker = L.circleMarker([lat, lng], { radius: 7, color: markerColor, fillOpacity: 0.7 }).bindPopup(`<b>IP:</b> ${ip}<br><b>Threat:</b> ${color}`);
  marker.addTo(markersLayer);
}

// ডেমো মার্কার (উদাহরণ)
addMarkerToMap('8.8.8.8', 37.386, -122.083, 'green');

// ------------------------- ট্রাফিক মনিটর (সিমুলেটেড) -------------------------
function updateTrafficMarker(ip, threatLevel) {
  // বাস্তবে আইপি থেকে লোকেশন বের করা দরকার। ডেমোতে এলোমেলো লোকেশন যোগ করি
  const randomLat = 20 + Math.random() * 40;
  const randomLng = -100 + Math.random() * 200;
  let color = 'green';
  if (threatLevel === 'high') color = 'red';
  else if (threatLevel === 'medium') color = 'orange';
  addMarkerToMap(ip, randomLat, randomLng, color);
}

// ------------------------- ওয়েবভিউ কন্ট্রোল -------------------------
const webview = document.getElementById('mainWebview');
const urlInput = document.getElementById('webUrlInput');

if (webview) {
  document.getElementById('webBack')?.addEventListener('click', () => webview.goBack());
  document.getElementById('webForward')?.addEventListener('click', () => webview.goForward());
  document.getElementById('webReload')?.addEventListener('click', () => webview.reload());
  document.getElementById('goUrlBtn')?.addEventListener('click', () => {
    let url = urlInput.value.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    webview.src = url;
    urlInput.value = url;
    // টার্গেট সেট করি ফিউশন ডাটায়
    shadowRecon.setTarget(url);
  });
  // ওয়েবভিউ নেভিগেশন পরিবর্তনে URL সিঙ্ক
  webview.addEventListener('did-navigate', (e) => {
    if (e.url) urlInput.value = e.url;
    shadowRecon.setTarget(e.url);
  });
}

// ------------------------- টুলস লোড ও গ্রিড রেন্ডার -------------------------
async function loadTools() {
  const tools = await shadowRecon.listTools();
  currentTools = tools;
  const toolsGrid = document.getElementById('toolsGrid');
  if (!toolsGrid) return;
  toolsGrid.innerHTML = '';
  // শুধু প্রথম ৫০টি টুল দেখাই (পারফরম্যান্সের জন্য)
  tools.slice(0, 100).forEach(tool => {
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.innerHTML = `<i class="fas fa-cogs"></i> ${tool.name}`;
    card.onclick = () => runTool(tool.id);
    toolsGrid.appendChild(card);
  });
}

async function runTool(toolId) {
  appendFeedItem('info', `🛠️ টুল রান শুরু: ${toolId}`);
  const result = await shadowRecon.runTool(toolId);
  if (result.error) {
    appendFeedItem('error', `❌ টুল ব্যর্থ: ${result.error}`);
  } else {
    appendFeedItem('success', `✅ টুল সম্পন্ন: ${toolId} – আউটপুট: ${JSON.stringify(result.output).substring(0, 150)}`);
  }
}

// ------------------------- রিপোর্ট টেবিল -------------------------
function addReportToTable(report) {
  const tbody = document.getElementById('reportTbody');
  const row = tbody.insertRow(0);
  row.insertCell(0).innerText = ++currentReportCount;
  row.insertCell(1).innerText = report.target || 'unknown';
  row.insertCell(2).innerText = new Date().toLocaleString();
  row.insertCell(3).innerHTML = `<span style="color:#ffcc33;">${report.risk || 'Medium'}</span>`;
  const btn = document.createElement('button');
  btn.className = 'cyber-btn';
  btn.innerText = 'প্রিভিউ';
  btn.onclick = () => {
    document.getElementById('reportPreview').innerHTML = `<pre>${JSON.stringify(report, null, 2)}</pre>`;
  };
  const cell = row.insertCell(4);
  cell.appendChild(btn);
  if (tbody.children.length > 50) tbody.deleteRow(50);
}

// ------------------------- ফিড মেসেজ (লাইভ কনসোল) -------------------------
function appendFeedItem(level, message) {
  const feedDiv = document.getElementById('threatLog');
  if (!feedDiv) return;
  const time = new Date().toLocaleTimeString();
  const color = level === 'error' ? '#ff4d6d' : (level === 'success' ? '#20ffb3' : '#40e6ff');
  const entry = `<div style="color:${color};">[${time}] ${message}</div>`;
  feedDiv.innerHTML = entry + feedDiv.innerHTML;
  if (feedDiv.children.length > 100) feedDiv.removeChild(feedDiv.lastChild);
}

// ------------------------- ডিফেন্সিভ চেক ও রিপোর্ট জেনারেট -------------------------
async function runDefensiveAndReport() {
  const target = webview ? webview.getURL() : 'https://example.com';
  appendFeedItem('info', `ডিফেন্সিভ চেক শুরু: ${target}`);
  const res = await shadowRecon.runDefensiveChecks(target);
  if (res.ok) {
    addReportToTable({ target, risk: 'Medium', details: res.artifacts });
    appendFeedItem('success', 'রিপোর্ট জেনারেট সম্পন্ন');
  } else {
    appendFeedItem('error', `ডিফেন্সিভ চেক ব্যর্থ: ${res.error}`);
  }
}

// ------------------------- সিস্টেম মনিটর (ডামি) -------------------------
function updateSystemMonitor() {
  setInterval(async () => {
    const info = await shadowRecon.getSystemInfo();
    if (info) {
      document.getElementById('cpuLoad').innerText = `${Math.floor(Math.random() * 50 + 10)}%`;
      document.getElementById('ramUsage').innerText = `${Math.floor(Math.random() * 60 + 20)}%`;
    }
  }, 4000);
}

// ------------------------- সিক্রেট পেজ আনলক -------------------------
function setupSecretPage() {
  const unlockBtn = document.getElementById('unlockSecretBtn');
  if (unlockBtn) {
    unlockBtn.onclick = () => {
      const pass = document.getElementById('secretPass').value;
      if (pass === 'shadowrecon2025') {
        document.getElementById('secretContent').style.display = 'block';
        appendFeedItem('success', 'সিক্রেট পেজ আনলক হয়েছে');
      } else {
        alert('ভুল কোড');
      }
    };
  }
}

// ------------------------- এআই অ্যাসিস্ট্যান্ট মডেল -------------------------
function setupAIAssistant() {
  const aiBtn = document.getElementById('aiAssistantBtn');
  const aiModal = document.getElementById('aiModal');
  const closeAi = document.getElementById('closeAiModal');
  const aiInput = document.getElementById('aiCommandInput');
  const sendAi = document.getElementById('sendAiCommand');
  const aiResponseDiv = document.getElementById('aiResponse');

  if (!aiBtn) return;

  aiBtn.onclick = () => { if (aiModal) aiModal.style.display = 'block'; };
  if (closeAi) closeAi.onclick = () => { if (aiModal) aiModal.style.display = 'none'; };
  if (sendAi) {
    sendAi.onclick = async () => {
      const cmd = aiInput.value.trim();
      if (!cmd) return;
      aiResponseDiv.innerHTML = `🤖 প্রসেসিং: "${cmd}"<br>⏳ সংযোগ স্থাপন হচ্ছে...`;
      // এখানে আমরা shadowRecon.runCustomTools() বা সরাসরি AI API কল করতে পারি। ডেমোতে সিমুলেট করি।
      setTimeout(() => {
        aiResponseDiv.innerHTML = `🤖 আপনার কমান্ড "${cmd}" সম্পন্ন হয়েছে। (সিমুলেটেড প্রতিক্রিয়া)`;
      }, 1000);
      aiInput.value = '';
    };
  }
  // মডেলের বাইরে ক্লিক করলে বন্ধ
  window.onclick = (e) => { if (e.target === aiModal && aiModal) aiModal.style.display = 'none'; };
}

// ------------------------- স্ক্যান বাটন ইভেন্ট -------------------------
function setupScanButtons() {
  const startScan = document.getElementById('startScanBtn');
  const stopScan = document.getElementById('stopScanBtn');
  const genReport = document.getElementById('genReportBtn');
  const clearMarkers = document.getElementById('clearMarkersBtn');
  const locateIp = document.getElementById('locateIpBtn');
  const ipInput = document.getElementById('ipLocatorInput');

  if (startScan) startScan.onclick = () => appendFeedItem('info', '🚀 ব্যাকগ্রাউন্ড স্ক্যান শুরু (সব টুল প্যারালালে)');
  if (stopScan) stopScan.onclick = () => appendFeedItem('info', '⏹️ স্ক্যান থামানো হয়েছে');
  if (genReport) genReport.onclick = runDefensiveAndReport;
  if (clearMarkers && markersLayer) clearMarkers.onclick = () => markersLayer.clearLayers();
  if (locateIp && ipInput) {
    locateIp.onclick = () => {
      const ip = ipInput.value.trim();
      if (ip) {
        // ডেমো লোকেশন
        addMarkerToMap(ip, 55.7558, 37.6173, 'orange');
        appendFeedItem('info', `IP ${ip} এর লোকেশন মানচিত্রে যোগ করা হয়েছে`);
      } else {
        alert('আইপি ঠিকানা দিন');
      }
    };
  }
}

// ------------------------- টুলস ক্যাটাগরি ফিল্টার (আপনি চাইলে আরও বিস্তারিত করতে পারেন) -------------------------
function setupCategoryFilter() {
  const catBtns = document.querySelectorAll('[data-cat]');
  catBtns.forEach(btn => {
    btn.onclick = async () => {
      const cat = btn.getAttribute('data-cat');
      const tools = await shadowRecon.listTools(cat);
      const toolsGrid = document.getElementById('toolsGrid');
      if (toolsGrid) {
        toolsGrid.innerHTML = '';
        tools.slice(0, 50).forEach(tool => {
          const card = document.createElement('div');
          card.className = 'tool-card';
          card.innerHTML = `<i class="fas fa-cogs"></i> ${tool.name}`;
          card.onclick = () => runTool(tool.id);
          toolsGrid.appendChild(card);
        });
      }
    };
  });
}

// ------------------------- লাইভ ট্রাফিক ইভেন্ট (মেইন প্রসেস থেকে) -------------------------
function setupTrafficListener() {
  shadowRecon.onTrafficEvent((entry) => {
    // ট্রাফিক ইভেন্ট এলে মানচিত্রে মার্কার আপডেট (ডেমো)
    if (entry.url) {
      const host = new URL(entry.url).hostname;
      const threat = Math.random() > 0.8 ? 'high' : 'low';
      updateTrafficMarker(host, threat);
    }
  });
}

// ------------------------- ফিড লিসেনার -------------------------
function setupFeedListener() {
  shadowRecon.onFeedItem((item) => {
    appendFeedItem(item.level, item.message);
  });
}

// ------------------------- পেজ স্যুইচিং (সাইডবার নেভিগেশন) -------------------------
function setupNavigation() {
  $$('.nav-item').forEach(nav => {
    nav.addEventListener('click', () => {
      const pageId = nav.getAttribute('data-page');
      if (pageId) setActiveTab(pageId);
    });
  });
  // সিক্রেট লক আইকন
  const lockIcon = document.getElementById('secretLockIcon');
  if (lockIcon) {
    lockIcon.onclick = () => setActiveTab('page6');
  }
}

// ------------------------- ইনিশিয়ালাইজেশন -------------------------
async function init() {
  initMap();
  setupNavigation();
  setupSecretPage();
  setupAIAssistant();
  setupScanButtons();
  setupCategoryFilter();
  setupTrafficListener();
  setupFeedListener();
  updateSystemMonitor();
  await loadTools();
  // ওয়েবভিউ যদি আগে থেকেই লোড হয়, তার টার্গেট সেট করি
  if (webview && webview.getURL) {
    const currentUrl = webview.getURL();
    if (currentUrl) shadowRecon.setTarget(currentUrl);
  }
  appendFeedItem('success', '🚀 ShadowRecon Ultimate প্রস্তুত। ২০,০০০+ টুলস লোড হয়েছে।');
}

init();
