// =================================================================================
// SHADOWRECON ULTIMATE – TOOL RUNNER (PARALLEL EXECUTION ENGINE)
// ফাইল: toolRunner.js | লাইন: ২০০+ | সব কাস্টম টুল একসাথে রান, ফলাফল সংগ্রহ
// =================================================================================

const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ========================== হেল্পার ফাংশন ==========================
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getMemoryUsage() {
  const used = process.memoryUsage();
  return {
    rss: Math.round(used.rss / 1024 / 1024),
    heapTotal: Math.round(used.heapTotal / 1024 / 1024),
    heapUsed: Math.round(used.heapUsed / 1024 / 1024)
  };
}

// ========================== কোর রানার ফাংশন ==========================
/**
 * সমস্ত কাস্টম টুল প্যারালালে চালায়
 * @param {Object} params
 * @param {Object} params.modules - customModules.js থেকে প্রাপ্ত মডিউল অবজেক্ট
 * @param {Object} params.fusionData - গ্লোবাল ফিউশন ডাটা
 * @param {Function} params.emitFeed - UI ফিডে মেসেজ পাঠানোর ফাংশন
 * @returns {Promise<Object>} রান ফলাফল
 */
async function runCustomTools({ modules, fusionData, emitFeed }) {
  const startTime = Date.now();

  // নিশ্চিত করা যে custom এবং results অবজেক্ট বিদ্যমান
  if (!fusionData.custom) fusionData.custom = {};
  if (!fusionData.custom.results) fusionData.custom.results = {};
  if (!fusionData.custom.logs) fusionData.custom.logs = [];

  fusionData.custom.executionStart = new Date().toISOString();

  // রিপোর্ট জেনারেটর টুল বাদ দিয়ে বাকি সব টুলের তালিকা
  const toolEntries = Object.entries(modules).filter(([name]) => name !== 'tool_generateUnifiedReport');
  const totalTools = toolEntries.length;

  emitFeed('info', `🚀 ShadowRecon Ultimate: মোট ${totalTools} টি টুল প্যারালালে চালানো শুরু হচ্ছে...`);
  emitFeed('info', `💾 মেমরি ব্যবহার (শুরুর আগে): ${getMemoryUsage().heapUsed} MB`);

  let completed = 0;
  let errors = 0;
  let successes = 0;
  const toolTimings = {};

  // প্রতিটি টুলের জন্য প্রমিজ তৈরি (প্যারালাল এক্সিকিউশন)
  const toolPromises = toolEntries.map(async ([name, toolFn]) => {
    const toolStart = Date.now();
    try {
      emitFeed('info', `⚙️ [${name}] শুরু হচ্ছে...`);

      // টুল ফাংশন কল – এটি রিয়েল টাইমে emitFeed ব্যবহার করতে পারে
      const result = await toolFn({
        targetUrl: fusionData.target?.url || '',
        fusionData,
        emitFeed
      });

      // ফলাফল সংরক্ষণ
      fusionData.custom.results[name] = result;
      const duration = Date.now() - toolStart;
      toolTimings[name] = duration;
      successes++;

      emitFeed('success', `✅ [${name}] সম্পন্ন (${formatDuration(duration)})`);
    } catch (err) {
      const errorMsg = err.message || String(err);
      const duration = Date.now() - toolStart;

      fusionData.custom.results[name] = { error: errorMsg, failed: true };
      toolTimings[name] = duration;
      errors++;

      emitFeed('error', `❌ [${name}] ব্যর্থ: ${errorMsg.substring(0, 150)} (${formatDuration(duration)})`);

      // লগ ফাইলে বিস্তারিত সংরক্ষণ
      try {
        const logDir = path.join(process.env.APPDATA || os.homedir(), 'ShadowReconUltimate', 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logFile = path.join(logDir, 'tool_errors.log');
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${name}: ${errorMsg}\n${err.stack || ''}\n\n`);
      } catch(e) {}
    } finally {
      completed++;
      if (completed % 10 === 0 || completed === totalTools) {
        emitFeed('info', `📊 অগ্রগতি: ${completed}/${totalTools} টুল সম্পন্ন (সফল: ${successes}, ব্যর্থ: ${errors})`);
      }
    }
  });

  emitFeed('info', `⏳ সব টুল একসাথে চলছে, দয়া করে অপেক্ষা করুন...`);
  await Promise.all(toolPromises);

  const totalDuration = Date.now() - startTime;
  const memAfter = getMemoryUsage();

  // সারাংশ তৈরি
  const summary = {
    totalTools,
    successes,
    errors,
    totalDurationMs: totalDuration,
    totalDurationFormatted: formatDuration(totalDuration),
    memoryBeforeMB: getMemoryUsage().heapUsed,
    memoryAfterMB: memAfter.heapUsed,
    memoryDeltaMB: memAfter.heapUsed - getMemoryUsage().heapUsed,
    timestamp: new Date().toISOString(),
    toolTimings
  };

  fusionData.custom.executionSummary = summary;
  fusionData.custom.executionEnd = new Date().toISOString();
  fusionData.custom.logs.push({
    type: 'execution_summary',
    ...summary,
    details: `সব টুল সম্পন্ন। সফল: ${successes}, ব্যর্থ: ${errors}`
  });

  emitFeed('success', `🎉 সব টুল সম্পন্ন! সময়: ${formatDuration(totalDuration)}, সফল: ${successes}, ব্যর্থ: ${errors}`);
  emitFeed('info', `💾 মেমরি ব্যবহার: ${memAfter.heapUsed} MB (বৃদ্ধি: ${memAfter.heapUsed - getMemoryUsage().heapUsed} MB)`);

  // ইউনিফাইড রিপোর্ট তৈরি (যদি থাকে)
  if (typeof modules.tool_generateUnifiedReport === 'function') {
    emitFeed('info', `📄 ইউনিফাইড রিপোর্ট তৈরি করা হচ্ছে...`);
    try {
      const reportResult = await modules.tool_generateUnifiedReport({
        targetUrl: fusionData.target?.url || '',
        fusionData,
        emitFeed
      });
      if (reportResult && reportResult.ok) {
        emitFeed('success', `📊 রিপোর্ট তৈরি হয়েছে: ${reportResult.reportPath || 'স্থানীয় ফোল্ডারে'}`);
        fusionData.custom.lastReportPath = reportResult.reportPath;
      } else {
        emitFeed('warn', `⚠️ রিপোর্ট জেনারেট করতে সমস্যা: ${reportResult?.error || 'অজানা'}`);
      }
    } catch (err) {
      emitFeed('error', `❌ রিপোর্ট জেনারেট ব্যর্থ: ${err.message}`);
      fusionData.custom.reportError = err.message;
    }
  } else {
    emitFeed('warn', `⚠️ tool_generateUnifiedReport ফাংশন পাওয়া যায়নি, রিপোর্ট তৈরি করা হবে না।`);
  }

  fusionData.custom.lastRun = new Date().toISOString();

  return {
    ok: true,
    total: totalTools,
    successes,
    errors,
    duration: totalDuration,
    summary
  };
}

// ========================== অতিরিক্ত ইউটিলিটি ফাংশন ==========================
/**
 * একটি নির্দিষ্ট টুল শুধু চালানোর জন্য (ডিবাগিং)
 */
async function runSingleTool(modules, toolName, { targetUrl, fusionData, emitFeed }) {
  if (!modules[toolName]) {
    throw new Error(`Tool "${toolName}" not found`);
  }
  const start = Date.now();
  emitFeed('info', `🔍 একক টুল "${toolName}" চালানো হচ্ছে...`);
  try {
    const result = await modules[toolName]({ targetUrl, fusionData, emitFeed });
    const duration = Date.now() - start;
    emitFeed('success', `✅ "${toolName}" সম্পন্ন (${formatDuration(duration)})`);
    return { ok: true, result, duration };
  } catch (err) {
    const duration = Date.now() - start;
    emitFeed('error', `❌ "${toolName}" ব্যর্থ: ${err.message} (${formatDuration(duration)})`);
    return { ok: false, error: err.message, duration };
  }
}

/**
 * টুলের ফলাফল ক্লিয়ার করে (পুনরায় রান করার আগে)
 */
function clearResults(fusionData) {
  if (fusionData.custom) {
    fusionData.custom.results = {};
    fusionData.custom.logs = [];
    fusionData.custom.executionSummary = null;
  }
  return { ok: true };
}

/**
 * ফলাফল এক্সপোর্ট (JSON ফাইলে সেভ)
 */
async function exportResults(fusionData, outputPath = null) {
  const defaultPath = path.join(os.tmpdir(), `shadowrecon_export_${Date.now()}.json`);
  const finalPath = outputPath || defaultPath;
  const exportData = {
    timestamp: new Date().toISOString(),
    target: fusionData.target,
    customResults: fusionData.custom.results,
    executionSummary: fusionData.custom.executionSummary,
    trafficSummary: {
      totalEvents: fusionData.traffic?.events?.length || 0,
      totalRequests: fusionData.traffic?.totalRequests || 0,
      totalResponses: fusionData.traffic?.totalResponses || 0
    },
    systemInfo: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMem: os.totalmem(),
      freeMem: os.freemem()
    }
  };
  fs.writeFileSync(finalPath, JSON.stringify(exportData, null, 2));
  return { path: finalPath, ok: true };
}

// ========================== মডিউল এক্সপোর্ট ==========================
module.exports = {
  runCustomTools,
  runSingleTool,
  clearResults,
  exportResults
};

console.log('✅ toolRunner.js লোড হয়েছে – কাস্টম টুল রানার প্রস্তুত');
