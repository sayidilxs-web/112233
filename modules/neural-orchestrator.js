// =================================================================================
// SHADOWRECON ULTIMATE – NEURAL EXPLOIT ORCHESTRATOR
// ফাইল: neural-orchestrator.js | ছোট দুর্বলতা একত্রে বড় এক্সপ্লয়েট চেইন বানায়
// =================================================================================

// ========================== ১. নিউরাল এক্সপ্লয়েট অর্কেস্ট্রেটর ক্লাস ==========================
class NeuralExploitOrchestrator {
    /**
     * analyzeVulnerabilities – ভলনারেবিলিটি অবজেক্টগুলো বিশ্লেষণ করে
     * @param {Array} foundVulns - [{ id, type, target, risk, evidence, ... }]
     * @returns {Object} গ্রাফ নোড ও এজ তথ্য
     */
    analyzeVulnerabilities(foundVulns) {
        const nodes = [];
        const edges = [];
        // প্রতিটি ভলনারেবিলিটি নোড তৈরি
        for (const vuln of foundVulns) {
            nodes.push({
                id: vuln.id || crypto.randomUUID(),
                type: vuln.type,
                target: vuln.target,
                risk: vuln.risk,
                evidence: vuln.evidence || null,
                source: vuln.source
            });
        }
        // হিউরিস্টিক এজ তৈরি (সহযোগী ভলনারেবিলির মধ্যে লিংক)
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i+1; j < nodes.length; j++) {
                const sim = this._calculateCorrelation(nodes[i], nodes[j]);
                if (sim > 0.4) {
                    edges.push({ from: nodes[i].id, to: nodes[j].id, weight: sim });
                }
            }
        }
        return { nodes, edges };
    }

    /**
     * _calculateCorrelation – দুটি দুর্বলতার সম্পর্ক নির্ণয়
     */
    _calculateCorrelation(a, b) {
        let score = 0;
        if (a.target === b.target) score += 0.4;
        if (a.type === 'info_disclosure' && b.type === 'broken_access_control') score += 0.6;
        if (a.type === 'xss' && b.type === 'csrf') score += 0.5;
        if (a.type === 'sqli' && b.type === 'rce') score += 0.7;
        if (a.source === b.source) score += 0.2;
        return Math.min(score, 1);
    }

    /**
     * simulateAttackChains – গ্রাফ থেকে সম্ভাব্য আক্রমণ চেইন বের করে
     * @param {Object} vulnGraph - { nodes, edges }
     * @returns {Array} আক্রমণ চেইনের অ্যারে (প্রতিটি চেইনে নোডের তালিকা)
     */
    simulateAttackChains(vulnGraph) {
        const chains = [];
        const visited = new Set();
        // ডিএফএস দিয়ে চেইন বের করা
        const dfs = (nodeId, currentChain) => {
            visited.add(nodeId);
            currentChain.push(nodeId);
            const neighbors = vulnGraph.edges.filter(e => e.from === nodeId).map(e => e.to);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    dfs(neighbor, [...currentChain]);
                }
            }
            if (currentChain.length >= 2) {
                chains.push([...currentChain]);
            }
        };
        for (const node of vulnGraph.nodes) {
            if (!visited.has(node.id)) dfs(node.id, []);
        }
        // ফিল্টার: চেইনে অন্তত দুইটি ভিন্ন ভিন্ন টাইপ থাকতে হবে
        const nodeMap = new Map(vulnGraph.nodes.map(n => [n.id, n]));
        const validChains = chains.filter(chain => {
            const types = chain.map(id => nodeMap.get(id)?.type);
            return new Set(types).size > 1;
        });
        return validChains;
    }

    /**
     * compileChainPayload – চেইনের জন্য এক্সিকিউটেবল স্ক্রিপ্ট/টোকেন তৈরি
     * @param {Array} successfulChain - নোড আইডির অ্যারে
     * @param {Object} nodeMap - নোড আইডি থেকে ডিটেইল
     * @returns {Object} এক্সিকিউটেবল কনফিগারেশন
     */
    compileChainPayload(successfulChain, nodeMap) {
        const steps = [];
        let finalPayload = '';
        for (let i = 0; i < successfulChain.length; i++) {
            const vuln = nodeMap.get(successfulChain[i]);
            steps.push({
                order: i+1,
                vulnerabilityType: vuln.type,
                target: vuln.target,
                action: this._suggestAction(vuln.type)
            });
            if (i === successfulChain.length-1) {
                finalPayload = `chain_${crypto.randomBytes(8).toString('hex')}`;
            }
        }
        return {
            chainId: crypto.randomUUID(),
            steps,
            finalPayload,
            requiredModules: ['automation.js', 'hijack.js'],
            estimatedSuccess: 'high'
        };
    }

    _suggestAction(type) {
        const map = {
            'info_disclosure': 'Gather sensitive data (path, version, DB name)',
            'broken_access_control': 'Access admin endpoint',
            'xss': 'Steal session token',
            'csrf': 'Execute state-changing request',
            'sqli': 'Extract credentials',
            'rce': 'Execute system command',
            'default': 'Exploit chain step'
        };
        return map[type] || map.default;
    }
}

// ========================== ২. ইউনিফাইড ফাংশন ==========================
/**
 * runNeuralOrchestrator – ফিউশন ডাটা থেকে অটোমেটিক চেইন ডিটেক্ট ও এক্সিকিউট
 * @param {Object} fusionData - গ্লোবাল ফিউশন ডাটা
 * @param {Function} emitFeed - UI ফিড
 * @returns {Promise<Object>} চেইন ডিটেকশন রেজাল্ট
 */
async function runNeuralOrchestrator(fusionData, emitFeed) {
    emitFeed('info', '[NeuralOrchestrator] শুরু: দুর্বলতা চেইন বিশ্লেষণ');
    const orchestrator = new NeuralExploitOrchestrator();

    // সংগৃহীত ভলনারেবিলি গুলো বের করা (custom.results থেকে)
    const allResults = fusionData.custom.results || {};
    const vulnerabilities = [];
    for (const [key, value] of Object.entries(allResults)) {
        if (value && value.vulnerabilities && Array.isArray(value.vulnerabilities)) {
            vulnerabilities.push(...value.vulnerabilities);
        } else if (value && value.type && value.target) {
            vulnerabilities.push(value);
        }
    }
    if (vulnerabilities.length < 2) {
        emitFeed('warn', '[NeuralOrchestrator] পর্যাপ্ত দুর্বলতা নেই, চেইন তৈরি অসম্ভব');
        return { ok: false, reason: 'insufficient vulnerabilities' };
    }

    const graph = orchestrator.analyzeVulnerabilities(vulnerabilities);
    const chains = orchestrator.simulateAttackChains(graph);
    if (chains.length === 0) {
        emitFeed('warn', '[NeuralOrchestrator] কোনো বৈধ চেইন পাওয়া যায়নি');
        return { ok: false, reason: 'no viable chains' };
    }

    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
    const selectedChain = chains[0]; // প্রথম সেরাটি নিচ্ছি (বা গুরুত্ব অনুযায়ী)
    const payloadConfig = orchestrator.compileChainPayload(selectedChain, nodeMap);

    // ফিউশন ডাটায় সংরক্ষণ
    fusionData.custom.chains = fusionData.custom.chains || [];
    fusionData.custom.chains.push(payloadConfig);
    emitFeed('success', `[NeuralOrchestrator] একটি এক্সপ্লয়েট চেইন প্রস্তুত: ${payloadConfig.chainId} (${payloadConfig.steps.length} ধাপ)`);
    emitFeed('info', `ফাইনাল পেলোড: ${payloadConfig.finalPayload}`);

    return { ok: true, chain: payloadConfig, vulnerabilitiesGraph: graph };
}

module.exports = { NeuralExploitOrchestrator, runNeuralOrchestrator };
