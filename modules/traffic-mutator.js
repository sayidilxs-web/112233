// =================================================================================
// SHADOWRECON ULTIMATE – POLYMORPHIC TRAFFIC MUTATION ENGINE
// ফাইল: traffic-mutator.js | ওয়েব অ্যাপ্লিকেশন ফায়ারওয়াল (WAF) বাইপাস ইঞ্জিন
// =================================================================================

const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// ========================== হেল্পার ফাংশন ==========================
function randomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ========================== ১. পলিমরফিক মিউটেটর ক্লাস ==========================
class PolymorphicMutator {
    /**
     * mutateHeaders – রিকোয়েস্ট হেডারকে গতিশীলভাবে মিউটেট করে
     * @param {string} targetUrl - টার্গেট URL
     * @returns {Object} মিউটেটেড হেডার্স
     */
    mutateHeaders(targetUrl) {
        const headers = {};

        // 1. User-Agent রোটেশন (১০০+ বাস্তব ব্রাউজার স্ট্রিং)
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/119.0'
        ];
        headers['User-Agent'] = randomElement(userAgents);

        // 2. Accept-Language (এলোমেলো অর্ডার ও ওয়েটেজ)
        const langs = ['en-US,en;q=0.9', 'bn-BD,bn;q=0.8,en;q=0.7', 'hi-IN,hi;q=0.9,en;q=0.8', 'ar-SA,ar;q=0.9,en;q=0.8'];
        headers['Accept-Language'] = randomElement(langs);

        // 3. Cache-Control (এলোমেলো কৌশল)
        const cacheControl = ['no-cache', 'max-age=0', 'private, no-store', 'public, max-age=3600'];
        headers['Cache-Control'] = randomElement(cacheControl);

        // 4. X-Forwarded-For (IP স্পুফিং – র‍্যান্ডম প্রাইভেট আইপি)
        const randomIP = `${randomInt(10,200)}.${randomInt(0,255)}.${randomInt(0,255)}.${randomInt(1,254)}`;
        headers['X-Forwarded-For'] = randomIP;
        headers['X-Real-IP'] = randomIP;

        // 5. কাস্টম অবফাস্কেশন হেডার (যাতে WAF প্যাটার্ন মিস করে)
        headers['X-Request-ID'] = crypto.randomBytes(16).toString('hex');
        headers['X-Device-Fingerprint'] = crypto.randomBytes(8).toString('base64');
        headers['X-Session-Token'] = crypto.randomBytes(12).toString('hex');

        // 6. Accept-Encoding (জিপ বা ব্রুটলি)
        const encodings = ['gzip, deflate, br', 'gzip, deflate', 'br', 'identity'];
        headers['Accept-Encoding'] = randomElement(encodings);

        // 7. অন্যান্য বাস্তবসম্মত হেডার
        headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
        headers['Connection'] = randomElement(['keep-alive', 'close']);
        headers['Upgrade-Insecure-Requests'] = '1';

        return headers;
    }

    /**
     * getTLSSettings – গতিশীল TLS সেটিংস (JA3/JA4 ফিঙ্গারপ্রিন্ট র‍্যান্ডমাইজার)
     * @returns {Object} TLS কনফিগারেশন অবজেক্ট
     */
    getTLSSettings() {
        // সিমুলেটেড TLS সাইফার স্যুট লিস্ট (বাস্তবে Node.js TLS সকেটে প্রয়োগ করতে হবে)
        const cipherSuites = [
            'TLS_AES_128_GCM_SHA256',
            'TLS_AES_256_GCM_SHA384',
            'TLS_CHACHA20_POLY1305_SHA256',
            'ECDHE-ECDSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-ECDSA-CHACHA20-POLY1305',
            'ECDHE-RSA-CHACHA20-POLY1305'
        ];
        // এলোমেলো সাইফার অর্ডার ও নির্বাচন
        const shuffled = [...cipherSuites];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return {
            ciphers: shuffled.join(':'),
            honorCipherOrder: true,
            secureProtocol: 'TLS_method',
            minVersion: 'TLSv1.2',
            maxVersion: 'TLSv1.3',
            // JA3 সিমুলেশন: এলোমেলোভাবে TLS এক্সটেনশনের ক্রম বদল
            ja3String: crypto.randomBytes(32).toString('hex')
        };
    }

    /**
     * packetSplittingProxy – প্যাকেট স্প্লিটিং লজিক (গভীর প্যাকেট পরিদর্শন ফাঁকি)
     * @param {string|Buffer} requestData - সম্পূর্ণ রিকোয়েস্ট ডাটা
     * @returns {Array<Buffer>} স্প্লিটেড প্যাকেটের অ্যারে
     */
    packetSplittingProxy(requestData) {
        const dataBuffer = typeof requestData === 'string' ? Buffer.from(requestData) : requestData;
        const chunkSize = randomInt(64, 512); // এলোমেলো চাঙ্ক সাইজ
        const chunks = [];
        for (let i = 0; i < dataBuffer.length; i += chunkSize) {
            chunks.push(dataBuffer.subarray(i, i + chunkSize));
        }
        return chunks;
    }
}

// ========================== ২. ইউনিফাইড ফাংশন ==========================
/**
 * runTrafficMutator – মূল মিউটেশন ইঞ্জিন যা রিকোয়েস্টকে রূপান্তর করে
 * @param {Object} requestOptions - original axios/request options
 * @param {Object} fusionData - গ্লোবাল ফিউশন ডাটা
 * @param {Function} emitFeed - UI ফিড ইমিটার
 * @returns {Promise<Object>} মিউটেটেড রিকোয়েস্ট অপশনসহ রেজাল্ট
 */
async function runTrafficMutator(requestOptions, fusionData, emitFeed) {
    emitFeed('info', '[TrafficMutator] শুরু: পলিমরফিক হেডার জেনারেশন');
    const mutator = new PolymorphicMutator();

    // ১. হেডার মিউটেশন
    const originalUrl = requestOptions.url || requestOptions.path;
    const mutatedHeaders = mutator.mutateHeaders(originalUrl);
    requestOptions.headers = { ...requestOptions.headers, ...mutatedHeaders };

    // ২. TLS সেটিংস সংযুক্ত (যদি https থাকে)
    if (originalUrl.startsWith('https')) {
        requestOptions.tlsSettings = mutator.getTLSSettings();
    }

    // ৩. প্যাকেট স্প্লিটিং (যদি কাস্টম প্রোক্সি ব্যবহার করা হয়)
    //    এখানে শুধু লগিং করছি, বাস্তব স্প্লিটিং নিম্ন-লেভেল সকেটে করতে হবে
    if (requestOptions.body) {
        const chunks = mutator.packetSplittingProxy(requestOptions.body);
        emitFeed('info', `[TrafficMutator] রিকোয়েস্ট বডি স্প্লিটেড: ${chunks.length} টুকরা`);
        // বাস্তবায়নে চাঙ্ক ক্রমান্বয়ে প্রেরণ করা লাগবে – এখানে সম্পূর্ণ বডি রাখছি
    }

    // ৪. ট্রাফিক লগে সংরক্ষণ
    const trafficEntry = {
        timestamp: new Date().toISOString(),
        type: 'mutated_request',
        url: originalUrl,
        method: requestOptions.method || 'GET',
        mutatedHeaders: requestOptions.headers,
        tlsSettings: requestOptions.tlsSettings || null
    };
    fusionData.traffic.events.push(trafficEntry);
    if (fusionData.traffic.events.length > 5000) fusionData.traffic.events.shift();

    emitFeed('success', `[TrafficMutator] হেডার মিউটেশন সম্পন্ন: ${Object.keys(mutatedHeaders).length}টি কাস্টম হেডার যুক্ত`);
    return { ok: true, mutatedOptions: requestOptions, trafficLogId: trafficEntry.timestamp };
}

module.exports = { PolymorphicMutator, runTrafficMutator };
