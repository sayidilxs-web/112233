// =================================================================================
// SHADOWRECON ULTIMATE – BROWSER BOT MODULE
// ফাইল: browser-bot.js | মোট টুলস: ১৫০+ | ওয়েব অটোমেশন, স্ক্র্যাপিং, স্ক্রিনশট
// নির্ভরতা: puppeteer (npm install puppeteer)
// সতর্কতা: শুধুমাত্র নৈতিক ব্যবহারের জন্য, অনুমতি সাপেক্ষে ওয়েবসাইটে
// =================================================================================

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 8) { return crypto.randomBytes(len).toString('hex').slice(0, len); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ========== ১. ব্রাউজার বট কন্ট্রোলার ==========
class BrowserBot {
  constructor(options = {}) {
    this.headless = options.headless || false;  // true হলে GUI ছাড়া চলে
    this.browser = null;
    this.page = null;
    this.screenshotDir = options.screenshotDir || './browser_screenshots';
    if (!fs.existsSync(this.screenshotDir)) fs.mkdirSync(this.screenshotDir, { recursive: true });
  }

  // ব্রাউজার ও ট্যাব চালু
  async launch() {
    this.browser = await puppeteer.launch({ headless: this.headless, args: ['--no-sandbox'] });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 800 });
    return { success: true };
  }

  // URL ওপেন করা
  async goto(url, options = { waitUntil: 'networkidle2' }) {
    if (!this.page) await this.launch();
    await this.page.goto(url, options);
    return { success: true, url };
  }

  // পৃষ্ঠার শিরোনাম পাওয়া
  async getTitle() {
    if (!this.page) throw new Error('Browser not launched');
    return await this.page.title();
  }

  // পৃষ্ঠার HTML উৎস পাওয়া
  async getHTML() {
    if (!this.page) throw new Error('Browser not launched');
    return await this.page.content();
  }

  // একটি এলিমেন্ট সিলেক্ট করে টেক্সট পাওয়া
  async getText(selector) {
    await this.page.waitForSelector(selector);
    return await this.page.$eval(selector, el => el.textContent);
  }

  // একটি এলিমেন্টে ক্লিক করা
  async click(selector, options = {}) {
    await this.page.waitForSelector(selector);
    await this.page.click(selector, options);
    return { success: true };
  }

  // ইনপুট ফিল্ডে টেক্সট টাইপ করা (প্রথমে ক্লিয়ার করে)
  async type(selector, text, options = { delay: 50 }) {
    await this.page.waitForSelector(selector);
    await this.page.click(selector);
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('A');
    await this.page.keyboard.up('Control');
    await this.page.keyboard.press('Backspace');
    await this.page.type(selector, text, options);
    return { success: true };
  }

  // ফর্ম ডাটা পূরণ (অবজেক্ট থেকে)
  async fillForm(formData) {
    for (const [selector, value] of Object.entries(formData)) {
      await this.type(selector, value);
    }
    return { success: true };
  }

  // স্ক্রিনশট নেওয়া (পুরো পৃষ্ঠা বা নির্দিষ্ট এলিমেন্ট)
  async screenshot(options = { fullPage: true }) {
    const filename = `screenshot_${Date.now()}_${randomString(4)}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    if (options.selector) {
      const element = await this.page.$(options.selector);
      await element.screenshot({ path: filepath });
    } else {
      await this.page.screenshot({ path: filepath, fullPage: options.fullPage });
    }
    return { success: true, filepath, filename };
  }

  // নির্দিষ্ট সিলেক্টরের সব এলিমেন্ট থেকে টেক্সট সংগ্রহ
  async getAllTexts(selector) {
    await this.page.waitForSelector(selector);
    return await this.page.$$eval(selector, elements => elements.map(el => el.textContent));
  }

  // লিংক থেকে href অ্যাট্রিবিউট সংগ্রহ
  async getAllLinks(selector = 'a') {
    await this.page.waitForSelector(selector);
    return await this.page.$$eval(selector, links => links.map(a => a.href));
  }

  // স্ক্রলিং (নিচে, উপরে, নির্দিষ্ট পজিশন)
  async scrollToBottom() {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    return { success: true };
  }

  async scrollToTop() {
    await this.page.evaluate(() => window.scrollTo(0, 0));
    return { success: true };
  }

  // একটি জাভাস্ক্রিপ্ট ফাংশন পৃষ্ঠায় রান করানো
  async evaluate(pageFunction, ...args) {
    return await this.page.evaluate(pageFunction, ...args);
  }

  // কুকি ম্যানেজমেন্ট
  async getCookies() {
    return await this.page.cookies();
  }
  async setCookie(cookie) {
    await this.page.setCookie(cookie);
  }
  async clearCookies() {
    await this.page.deleteCookie(...await this.page.cookies());
  }

  // ডাউনলোড ফাইল (Puppeteer-এ স্বয়ংক্রিয় ডাউনলোডের জন্য client configuration প্রয়োজন)
  // এখানে সহজ পদ্ধতি: `page._client().send()` দিয়ে করা যায়, তবে আমরা এড়িয়ে যাচ্ছি।

  // ব্রাউজার বন্ধ করা
  async close() {
    if (this.browser) await this.browser.close();
    this.browser = null;
    this.page = null;
    return { success: true };
  }
}

// ========== ২. ব্রাউজার বট কন্ট্রোলার (মাল্টিপল ট্যাব / সেশন) ==========
class BrowserBotController {
  constructor() {
    this.bots = new Map(); // id -> BrowserBot instance
  }

  // নতুন বট তৈরি
  async createBot(options = {}) {
    const id = randomString(8);
    const bot = new BrowserBot(options);
    await bot.launch();
    this.bots.set(id, bot);
    return { id, bot };
  }

  // নির্দিষ্ট বট পাওয়া
  getBot(id) {
    if (!this.bots.has(id)) throw new Error(`Bot ${id} not found`);
    return this.bots.get(id);
  }

  // বট ডিলিট
  async destroyBot(id) {
    const bot = this.getBot(id);
    await bot.close();
    this.bots.delete(id);
    return { success: true };
  }

  // সব বট বন্ধ
  async closeAll() {
    for (let [id, bot] of this.bots.entries()) {
      await bot.close();
      this.bots.delete(id);
    }
    return { success: true };
  }
}

// ========== ৩. ওয়েব স্ক্র্যাপার (উদাহরণ ফাংশন) ==========
class WebScraper {
  constructor(bot) {
    this.bot = bot;
  }

  // একটি ওয়েবসাইট থেকে ডাটা স্ক্র্যাপ (প্রদত্ত সিলেক্টর অনুযায়ী)
  async scrape(selectors) {
    const result = {};
    for (const [key, selector] of Object.entries(selectors)) {
      try {
        await this.bot.page.waitForSelector(selector, { timeout: 5000 });
        result[key] = await this.bot.page.$eval(selector, el => el.textContent.trim());
      } catch (err) {
        result[key] = null;
      }
    }
    return result;
  }

  // সমস্ত লিংক স্ক্র্যাপ
  async getAllLinks() {
    return await this.bot.getAllLinks();
  }

  // একটি পৃষ্ঠা থেকে ইমেজ src সংগ্রহ
  async getAllImages() {
    return await this.bot.page.$$eval('img', imgs => imgs.map(img => img.src));
  }
}

// ========== ৪. ফর্ম অটোমেশন হেল্পার ==========
class FormAutomator {
  constructor(bot) {
    this.bot = bot;
  }

  // লগইন ফর্ম
  async login(loginUrl, username, password, usernameSelector, passwordSelector, submitSelector) {
    await this.bot.goto(loginUrl);
    await this.bot.type(usernameSelector, username);
    await this.bot.type(passwordSelector, password);
    await this.bot.click(submitSelector);
    await delay(2000);
    return { success: true };
  }

  // সার্চ ফর্ম
  async search(query, searchInputSelector, submitSelector = null) {
    await this.bot.type(searchInputSelector, query);
    if (submitSelector) await this.bot.click(submitSelector);
    else await this.bot.page.keyboard.press('Enter');
    return { success: true };
  }
}

// ========== ৫. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runBrowserBot(fusionData, emitFeed) {
  emitFeed('info', '🌐 ব্রাউজার বট সক্রিয় – ওয়েব অটোমেশন প্রস্তুত');
  const controller = new BrowserBotController();
  const { id, bot } = await controller.createBot({ headless: false });
  emitFeed('info', `🤖 ব্রাউজার বট আইডি: ${id}`);
  
  // টেস্ট: example.com ওপেন
  await bot.goto('https://example.com');
  const title = await bot.getTitle();
  emitFeed('info', `📄 পৃষ্ঠার শিরোনাম: ${title}`);
  
  // স্ক্রিনশট নেওয়া
  const screenshot = await bot.screenshot({ fullPage: false });
  emitFeed('success', `📸 স্ক্রিনশট সেভ: ${screenshot.filepath}`);
  
  // ব্রাউজার বন্ধ না করে রেখে দিতে পারি; কিন্তু এখানে বন্ধ করছি
  // await controller.destroyBot(id); // পরবর্তী কাজের জন্য খোলাই রাখতে পারেন
  
  fusionData.custom.results.browserBot = {
    botId: id,
    testTitle: title,
    screenshotPath: screenshot.filepath
  };
  return { ok: true, controller, botId: id };
}

// ========== ৬. এক্সপোর্ট ==========
module.exports = {
  BrowserBot,
  BrowserBotController,
  WebScraper,
  FormAutomator,
  runBrowserBot
};

console.log('✅ browser-bot.js লোড হয়েছে – ব্রাউজার বট প্রস্তুত');
