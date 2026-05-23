// =================================================================================
// SHADOWRECON ULTIMATE – FORENSIC EVIDENCE CHAMBER
// ফাইল: evidence-chamber.js | টেম্পার-প্রুফ পিওসি রিপোর্ট জেনারেটর
// =================================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// রিপোর্ট ডিরেক্টরি
const REPORTS_DIR = path.join(process.cwd(), 'reports', 'h1_submissions');
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

// ========================== ১. ফরেনসিক এভিডেন্স চেম্বার ক্লাস ==========================
class ForensicEvidenceChamber {
    /**
     * captureState – সম্পূর্ণ অনুরোধ ও প্রতিক্রিয়ার স্ন্যাপশট নেয়
     * @param {string} toolId - যে টুল প্রমাণ তৈরি করেছে
     * @param {Object} rawRequest - { url, method, headers, body }
     * @param {Object} rawResponse - { status, headers, body }
     * @returns {Object} টেম্পার-প্রুফ এভিডেন্স অবজেক্ট
     */
    captureState(toolId, rawRequest, rawResponse) {
        const evidence = {
            id: crypto.randomUUID(),
            toolId: toolId,
            timestamp: new Date().toISOString(),
            request: {
                url: rawRequest.url,
                method: rawRequest.method,
                headers: rawRequest.headers,
                body: rawRequest.body ? rawRequest.body.substring(0, 2000) : null,
                fullHash: crypto.createHash('sha256').update(JSON.stringify(rawRequest)).digest('hex')
            },
            response: {
                status: rawResponse.status,
                headers: rawResponse.headers,
                body: rawResponse.body ? rawResponse.body.substring(0, 2000) : null,
                fullHash: crypto.createHash('sha256').update(JSON.stringify(rawResponse)).digest('hex')
            },
            combinedHash: null
        };
        evidence.combinedHash = crypto.createHash('sha256').update(evidence.request.fullHash + evidence.response.fullHash).digest('hex');
        return evidence;
    }

    /**
     * signEvidenceWithBlockchain – হাইপেরিয়ন কোর ব্যবহার করে ব্লকচেইনে হ্যাশ সংরক্ষণ
     * @param {Object} evidenceObject - পূর্বে ক্যাপচার করা এভিডেন্স
     * @param {Object} hyperionCore - হাইপেরিয়ন কোর ইন্সট্যান্স (global থেকে নেওয়া)
     * @returns {Promise<Object>}
     */
    async signEvidenceWithBlockchain(evidenceObject, hyperionCore) {
        if (!hyperionCore || typeof hyperionCore.logEvent !== 'function') {
            throw new Error('Hyperion core not available for blockchain signature');
        }
        const block = await hyperionCore.logEvent('evidence', {
            evidenceId: evidenceObject.id,
            hash: evidenceObject.combinedHash,
            toolId: evidenceObject.toolId,
            timestamp: evidenceObject.timestamp
        });
        return { blockHash: block.hash, chainIndex: block.index };
    }

    /**
     * generateMarkdownPoC – প্রফেশনাল পিওসি ডকুমেন্ট তৈরি করে
     * @param {string} target - টার্গেট ইউআরএল
     * @param {Object} chainData - এক্সপ্লয়েট চেইনের ডাটা
     * @param {Array<Object>} evidences - এভিডেন্স অবজেক্টের অ্যারে
     * @returns {string} মার্কডাউন কন্টেন্ট
     */
    generateMarkdownPoC(target, chainData, evidences) {
        let md = `# 🔍 ShadowRecon Ultimate – Proof of Concept Report\n\n`;
        md += `**Target:** ${target}\n`;
        md += `**Report Date:** ${new Date().toISOString()}\n`;
        md += `**Chain ID:** ${chainData.chainId}\n\n`;
        md += `## Executive Summary\n`;
        md += `A multi‑step vulnerability chain was identified that could lead to ${chainData.finalPayload.includes('rce') ? 'Remote Code Execution' : 'Account Takeover'}. The following steps detail the reproduction.\n\n`;
        md += `## Technical Details\n`;
        for (const step of chainData.steps) {
            md += `### Step ${step.order}: ${step.vulnerabilityType}\n`;
            md += `- **Action:** ${step.action}\n`;
            md += `- **Target:** ${step.target}\n`;
            const relevantEvidence = evidences.filter(e => e.toolId === step.vulnerabilityType);
            if (relevantEvidence.length) {
                md += `- **Evidence Request Hash:** \`${relevantEvidence[0].request.fullHash}\`\n`;
                md += `- **Response Hash:** \`${relevantEvidence[0].response.fullHash}\`\n`;
            }
            md += `\n`;
        }
        md += `## Steps to Reproduce (curl)\n\`\`\`bash\n`;
        // উদাহরণ কমান্ড জেনারেশন
        for (const step of chainData.steps) {
            md += `# ${step.action}\n`;
            md += `curl -X GET "${step.target}" -H "X-Exploit: ${chainData.finalPayload}"\n\n`;
        }
        md += `\`\`\`\n## Remediation\n`;
        md += `- Apply input validation and access control checks at every endpoint.\n`;
        md += `- Implement proper session management and least privilege principle.\n`;
        md += `- Review the entire chain and patch each vulnerability individually.\n`;
        md += `\n---\n*Report generated automatically by ShadowRecon Ultimate Evidence Chamber.*\n`;
        return md;
    }
}

// ========================== ২. ইউনিফাইড ফাংশন ==========================
/**
 * runEvidenceChamber – যখন ক্রিটিক্যাল ভলনারেবিলি কনফার্ম হয়, রিপোর্ট জেনারেট ও সেভ করে
 * @param {Object} exploitData - { target, chainData, evidencesArray }
 * @param {Object} fusionData - গ্লোবাল ফিউশন ডাটা
 * @param {Function} emitFeed - UI ফিড
 * @returns {Promise<Object>}
 */
async function runEvidenceChamber(exploitData, fusionData, emitFeed) {
    emitFeed('info', '[EvidenceChamber] শুরু: ফরেনসিক এভিডেন্স ক্যাপচার');
    const chamber = new ForensicEvidenceChamber();

    const { target, chainData, evidencesArray } = exploitData;
    if (!evidencesArray || evidencesArray.length === 0) {
        emitFeed('error', '[EvidenceChamber] কোনো এভিডেন্স নেই, রিপোর্ট তৈরি অসম্ভব');
        return { ok: false, reason: 'no evidence' };
    }

    // ব্লকচেইনে সাইন (যদি hyperion-core উপলব্ধ থাকে)
    const hyperion = global.hyperionCoreInstance; // main.js থেকে set করতে হবে
    let blockchainSig = null;
    if (hyperion) {
        try {
            blockchainSig = await chamber.signEvidenceWithBlockchain(evidencesArray[0], hyperion);
            emitFeed('success', `[EvidenceChamber] ব্লকচেইনে স্বাক্ষর সংরক্ষিত: ${blockchainSig.blockHash}`);
        } catch (err) {
            emitFeed('warn', `[EvidenceChamber] ব্লকচেইন সাইন ব্যর্থ: ${err.message}`);
        }
    }

    // মার্কডাউন পিওসি তৈরি
    const markdown = chamber.generateMarkdownPoC(target, chainData, evidencesArray);
    const timestamp = Date.now();
    const reportBaseName = `shadowrecon_poc_${target.replace(/[^a-z0-9]/gi, '_')}_${timestamp}`;
    const mdPath = path.join(REPORTS_DIR, `${reportBaseName}.md`);
    const jsonPath = path.join(REPORTS_DIR, `${reportBaseName}.json`);

    fs.writeFileSync(mdPath, markdown, 'utf8');
    const jsonReport = {
        target, chainData, evidences: evidencesArray, blockchainSignature: blockchainSig,
        generatedAt: new Date().toISOString()
    };
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf8');

    emitFeed('success', `[EvidenceChamber] পিওসি রিপোর্ট সেভ: ${mdPath}`);
    emitFeed('info', `JSON আর্কাইভ: ${jsonPath}`);

    // ফিউশন ডাটাতে রিপোর্ট রেকর্ড
    fusionData.reportsIndex.push({
        baseName: reportBaseName,
        mdPath, jsonPath,
        type: 'evidence_chain',
        timestamp: new Date().toISOString()
    });

    return { ok: true, mdPath, jsonPath, blockchainSignature: blockchainSig };
}

module.exports = { ForensicEvidenceChamber, runEvidenceChamber };
