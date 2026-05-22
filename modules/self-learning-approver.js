// =================================================================================
// SHADOWRECON ULTIMATE – SELF-LEARNING APPROVER MODULE
// ফাইল: self-learning-approver.js | মোট টুলস: ১০০+ | সবকিছু শেখে, যেকোনো কাজের আগে অনুমতি চায়
// সতর্কতা: শুধুমাত্র নৈতিক ব্যবহারের জন্য
// =================================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 8) { return crypto.randomBytes(len).toString('hex').slice(0, len); }

// ========== ১. লার্নিং ডাটাবেস (কমান্ড ও ফলাফল লগ) ==========
class LearningDatabase {
    constructor(storageFile = './learning_db.json') {
        this.storageFile = storageFile;
        this.data = this.load();
        // data structure: { commandHash: { command, successCount, failCount, lastUsed, userApprovalHistory } }
    }

    load() {
        try {
            if (fs.existsSync(this.storageFile)) {
                return JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
            }
        } catch(e) {}
        return {};
    }

    save() {
        fs.writeFileSync(this.storageFile, JSON.stringify(this.data, null, 2));
    }

    getKey(command) {
        // একটি কম্যান্ডের জন্য ইউনিক কী (সংক্ষিপ্তকরণ)
        const normalized = command.toLowerCase().replace(/\s+/g, ' ').trim();
        return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
    }

    recordApproval(command, approved, success = null) {
        const key = this.getKey(command);
        if (!this.data[key]) {
            this.data[key] = {
                command: command,
                successCount: 0,
                failCount: 0,
                lastUsed: getTimestamp(),
                approvalHistory: [],
                lastApproved: null,
                lastDenied: null
            };
        }
        const entry = this.data[key];
        entry.approvalHistory.push({ approved, timestamp: getTimestamp() });
        if (approved) {
            entry.lastApproved = getTimestamp();
        } else {
            entry.lastDenied = getTimestamp();
        }
        if (success !== null) {
            if (success) entry.successCount++;
            else entry.failCount++;
        }
        entry.lastUsed = getTimestamp();
        // শুধু সর্বশেষ ২০টি ইতিহাস রাখি
        if (entry.approvalHistory.length > 20) entry.approvalHistory.shift();
        this.save();
    }

    shouldAutoApprove(command) {
        const key = this.getKey(command);
        const entry = this.data[key];
        if (!entry) return false;
        // যদি গত ৫ বার মধ্যে ৪ বার অনুমোদিত হয়, তাহলে স্বয়ংক্রিয় অনুমোদন হতে পারে (ব্যবহারকারী অভ্যস্ত)
        const recent = entry.approvalHistory.slice(-5);
        const approvedCount = recent.filter(h => h.approved === true).length;
        if (approvedCount >= 4) return true;
        return false;
    }

    getStats(command) {
        const key = this.getKey(command);
        const entry = this.data[key];
        if (!entry) return null;
        return {
            successRate: entry.successCount + entry.failCount === 0 ? 0 : (entry.successCount / (entry.successCount + entry.failCount) * 100).toFixed(1),
            lastUsed: entry.lastUsed,
            approvalRatio: entry.approvalHistory.length === 0 ? 0 : (entry.approvalHistory.filter(h => h.approved).length / entry.approvalHistory.length * 100).toFixed(1)
        };
    }
}

// ========== ২. অনুমতি ব্যবস্থাপক (প্রশ্ন ও অপেক্ষা) ==========
class ApprovalManager extends EventEmitter {
    constructor() {
        super();
        this.pendingRequests = new Map(); // requestId -> { command, resolve, reject, timeout }
        this.learningDB = new LearningDatabase();
        this.autoApproveThreshold = 0.8; // 80% সাফল্যের পর স্বয়ংক্রিয় অনুমোদন
    }

    // একটি কাজের অনুমতি চাওয়া
    async requestApproval(command, context = {}) {
        // স্বয়ংক্রিয় অনুমোদন চেক
        if (this.learningDB.shouldAutoApprove(command)) {
            this.emit('auto_approved', command);
            return { approved: true, auto: true };
        }
        const requestId = randomString(8);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Approval timeout'));
                }
            }, 60000); // 60 সেকেন্ড সময়
            this.pendingRequests.set(requestId, { command, context, resolve, reject, timeout });
            this.emit('ask_approval', { requestId, command, context });
        });
    }

    // ব্যবহারকারীর উত্তর দেওয়া
    respond(requestId, approved) {
        const pending = this.pendingRequests.get(requestId);
        if (!pending) return false;
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);
        // লার্নিং ডাটাবেসে রেকর্ড (সফলতা এখনো জানি না, পরে আপডেট হবে)
        this.learningDB.recordApproval(pending.command, approved);
        if (approved) {
            pending.resolve({ approved: true, auto: false });
        } else {
            pending.resolve({ approved: false, auto: false });
        }
        return true;
    }

    // কাজ শেষে ফলাফল রিপোর্ট (সফল/ব্যর্থ)
    reportResult(command, success) {
        this.learningDB.recordApproval(command, true, success);
    }

    getStats(command) {
        return this.learningDB.getStats(command);
    }
}

// ========== ৩. সেলফ লার্নিং অ্যাপ্রুভার ইঞ্জিন ==========
class SelfLearningApproverEngine {
    constructor() {
        this.approvalManager = new ApprovalManager();
        this.supremeBrain = null;
    }

    attachSupremeBrain(supremeBrain) {
        this.supremeBrain = supremeBrain;
        // সুপ্রিম ব্রেইনের প্রসেসকমান্ডকে র‍্যাপ করা
        const originalProcess = supremeBrain.processCommand.bind(supremeBrain);
        supremeBrain.processCommand = async (rawText, source) => {
            // প্রথমে অনুমতি চাওয়া
            const approval = await this.approvalManager.requestApproval(rawText);
            if (!approval.approved) {
                return { success: false, message: 'Command not approved by user.', command: rawText };
            }
            // অনুমোদিত হলে কমান্ড রান
            try {
                const result = await originalProcess(rawText, source);
                // সফলতা রিপোর্ট (যদি result.success থাকে)
                if (result && result.success !== undefined) {
                    this.approvalManager.reportResult(rawText, result.success);
                } else {
                    // ডিফল্ট সফল ধরে নিচ্ছি
                    this.approvalManager.reportResult(rawText, true);
                }
                return result;
            } catch (err) {
                this.approvalManager.reportResult(rawText, false);
                throw err;
            }
        };
    }

    getApprovalManager() { return this.approvalManager; }
}

// ========== ৪. সেলফ লার্নিং অ্যাপ্রুভার কন্ট্রোলার ==========
class SelfLearningApproverController {
    constructor() {
        this.engine = new SelfLearningApproverEngine();
    }

    attachSupremeBrain(supremeBrain) {
        this.engine.attachSupremeBrain(supremeBrain);
    }

    // ব্যবহারকারীর উত্তর দেওয়ার জন্য
    respondToApproval(requestId, approved) {
        return this.engine.getApprovalManager().respond(requestId, approved);
    }

    // কোনো কমান্ডের পরিসংখ্যান দেখা
    getCommandStats(command) {
        return this.engine.getApprovalManager().getStats(command);
    }

    // ইভেন্ট লিসেনার (UI এর জন্য)
    on(event, callback) {
        this.engine.getApprovalManager().on(event, callback);
    }
}

// ========== ৫. ইউনিফাইড ফাংশন ==========
async function runSelfLearningApprover(fusionData, emitFeed) {
    emitFeed('info', '🧠 সেলফ লার্নিং অ্যাপ্রুভার সক্রিয় – সব কাজের আগে অনুমতি চাইবে, দিনে দিনে শিখবে');
    const controller = new SelfLearningApproverController();
    emitFeed('success', '✅ অ্যাপ্রুভার প্রস্তুত: যেকোনো কাজ করার আগে জিজ্ঞাসা করবে, হ্যাঁ বললেই করবে');
    fusionData.custom.results.selfLearningApprover = { status: 'active', learningDB: true };
    return { ok: true, controller };
}

module.exports = {
    LearningDatabase,
    ApprovalManager,
    SelfLearningApproverEngine,
    SelfLearningApproverController,
    runSelfLearningApprover
};

console.log('✅ self-learning-approver.js লোড হয়েছে – সবকিছু শেখে, কাজের আগে অনুমতি চায়');
