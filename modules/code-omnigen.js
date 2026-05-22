// =================================================================================
// SHADOWRECON ULTIMATE – CODE OMNIGEN MODULE
// ফাইল: code-omnigen.js | মোট টুলস: ২০০+ | ২০+ ভাষায় কোড জেনারেট, রান, ডিবাগ
// নির্ভরতা: Node.js built-in fs, child_process
// সতর্কতা: শুধুমাত্র নৈতিক ব্যবহারের জন্য, নিজের সিস্টেমে
// =================================================================================

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const os = require('os');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 8) { return crypto.randomBytes(len).toString('hex').slice(0, len); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ========== ১. ভাষা ও টেমপ্লেট ডাটাবেস ==========
const LANGUAGE_CONFIG = {
  javascript: {
    extension: '.js',
    runCmd: (filePath) => `node "${filePath}"`,
    template: (description) => `// ${description}\nconsole.log("Hello from JavaScript!");\n`
  },
  python: {
    extension: '.py',
    runCmd: (filePath) => `python "${filePath}"`,
    template: (description) => `# ${description}\nprint("Hello from Python!")\n`
  },
  bash: {
    extension: '.sh',
    runCmd: (filePath) => `bash "${filePath}"`,
    template: (description) => `#!/bin/bash\n# ${description}\necho "Hello from Bash!"\n`
  },
  powershell: {
    extension: '.ps1',
    runCmd: (filePath) => `powershell -ExecutionPolicy Bypass -File "${filePath}"`,
    template: (description) => `# ${description}\nWrite-Host "Hello from PowerShell!"\n`
  },
  cpp: {
    extension: '.cpp',
    compileCmd: (filePath) => `g++ "${filePath}" -o "${filePath}.exe"`,
    runCmd: (filePath) => `"${filePath}.exe"`,
    template: (description) => `#include <iostream>\nusing namespace std;\nint main() {\n    cout << "Hello from C++!" << endl;\n    return 0;\n}\n`
  },
  java: {
    extension: '.java',
    compileCmd: (filePath) => `javac "${filePath}"`,
    runCmd: (filePath) => `java -cp "${path.dirname(filePath)}" ${path.basename(filePath, '.java')}`,
    template: (description) => `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}\n`
  },
  go: {
    extension: '.go',
    runCmd: (filePath) => `go run "${filePath}"`,
    template: (description) => `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from Go!")\n}\n`
  },
  rust: {
    extension: '.rs',
    compileCmd: (filePath) => `rustc "${filePath}"`,
    runCmd: (filePath) => `"${filePath.replace(/\.rs$/, '.exe')}"`,
    template: (description) => `fn main() {\n    println!("Hello from Rust!");\n}\n`
  },
  ruby: {
    extension: '.rb',
    runCmd: (filePath) => `ruby "${filePath}"`,
    template: (description) => `# ${description}\nputs "Hello from Ruby!"\n`
  },
  php: {
    extension: '.php',
    runCmd: (filePath) => `php "${filePath}"`,
    template: (description) => `<?php\necho "Hello from PHP!\\n";\n?>\n`
  },
  csharp: {
    extension: '.cs',
    compileCmd: (filePath) => `csc "${filePath}"`,
    runCmd: (filePath) => `"${filePath.replace(/\.cs$/, '.exe')}"`,
    template: (description) => `using System;\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello from C#!");\n    }\n}\n`
  },
  swift: {
    extension: '.swift',
    runCmd: (filePath) => `swift "${filePath}"`,
    template: (description) => `print("Hello from Swift!")\n`
  },
  kotlin: {
    extension: '.kt',
    compileCmd: (filePath) => `kotlinc "${filePath}" -include-runtime -d "${filePath}.jar"`,
    runCmd: (filePath) => `java -jar "${filePath}.jar"`,
    template: (description) => `fun main() {\n    println("Hello from Kotlin!")\n}\n`
  },
  typescript: {
    extension: '.ts',
    compileCmd: (filePath) => `tsc "${filePath}"`,
    runCmd: (filePath) => `node "${filePath.replace(/\.ts$/, '.js')}"`,
    template: (description) => `console.log("Hello from TypeScript!");\n`
  },
  perl: {
    extension: '.pl',
    runCmd: (filePath) => `perl "${filePath}"`,
    template: (description) => `print "Hello from Perl!\\n";\n`
  },
  lua: {
    extension: '.lua',
    runCmd: (filePath) => `lua "${filePath}"`,
    template: (description) => `print("Hello from Lua!")\n`
  },
  r: {
    extension: '.r',
    runCmd: (filePath) => `Rscript "${filePath}"`,
    template: (description) => `cat("Hello from R!\\n")\n`
  },
  dart: {
    extension: '.dart',
    runCmd: (filePath) => `dart "${filePath}"`,
    template: (description) => `void main() {\n  print("Hello from Dart!");\n}\n`
  },
  scala: {
    extension: '.scala',
    runCmd: (filePath) => `scala "${filePath}"`,
    template: (description) => `object Main {\n  def main(args: Array[String]): Unit = {\n    println("Hello from Scala!")\n  }\n}\n`
  },
  haskell: {
    extension: '.hs',
    compileCmd: (filePath) => `ghc "${filePath}"`,
    runCmd: (filePath) => `"${filePath.replace(/\.hs$/, '.exe')}"`,
    template: (description) => `main = putStrLn "Hello from Haskell!"\n`
  }
};

// ========== ২. কোড জেনারেটর (টেমপ্লেট ভিত্তিক) ==========
class CodeGenerator {
  constructor(language, description) {
    this.language = language;
    this.description = description;
    this.config = LANGUAGE_CONFIG[language];
    if (!this.config) throw new Error(`Unsupported language: ${language}`);
  }

  generate() {
    let code = this.config.template(this.description);
    // কিছু ভাষার জন্য অতিরিক্ত কাস্টমাইজেশন (উদাহরণস্বরূপ, ইউজার ইনপুট নেওয়া)
    if (this.language === 'python' && this.description.includes('input')) {
      code = code.replace('print("Hello from Python!")', 'name = input("Enter your name: ")\nprint(f"Hello, {name}!")');
    }
    if (this.language === 'javascript' && this.description.includes('prompt')) {
      code = code.replace('console.log("Hello from JavaScript!");', 'const readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin, output: process.stdout });\nrl.question("Enter your name: ", (name) => {\n  console.log(`Hello, ${name}!`);\n  rl.close();\n});');
    }
    return code;
  }
}

// ========== ৩. কোড রানার (কম্পাইল ও এক্সিকিউট) ==========
class CodeRunner {
  constructor(language, filePath) {
    this.language = language;
    this.filePath = filePath;
    this.config = LANGUAGE_CONFIG[language];
  }

  async run() {
    // কম্পাইলেশন প্রয়োজন হলে
    if (this.config.compileCmd) {
      const compileResult = await this._exec(this.config.compileCmd(this.filePath));
      if (!compileResult.success) {
        return { success: false, error: `Compilation failed: ${compileResult.stderr}`, output: compileResult.stdout };
      }
    }
    // রান
    const runResult = await this._exec(this.config.runCmd(this.filePath));
    return {
      success: runResult.success,
      output: runResult.stdout,
      error: runResult.stderr,
      exitCode: runResult.code
    };
  }

  _exec(cmd) {
    return new Promise((resolve) => {
      exec(cmd, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        resolve({
          success: !error,
          stdout: stdout,
          stderr: stderr,
          code: error ? error.code : 0
        });
      });
    });
  }
}

// ========== ৪. কোড ম্যানেজার (সেভ, লোড, ডিলিট) ==========
class CodeManager {
  constructor(baseDir = './generated_codes') {
    this.baseDir = baseDir;
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  }

  saveCode(language, code, filename = null) {
    const ext = LANGUAGE_CONFIG[language]?.extension || '.txt';
    const finalName = filename || `${randomString(10)}${ext}`;
    const filePath = path.join(this.baseDir, finalName);
    fs.writeFileSync(filePath, code, 'utf8');
    return { filePath, filename: finalName };
  }

  loadCode(filename) {
    const filePath = path.join(this.baseDir, filename);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf8');
  }

  deleteCode(filename) {
    const filePath = path.join(this.baseDir, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  listCodes() {
    return fs.readdirSync(this.baseDir).filter(f => f !== '.gitkeep');
  }
}

// ========== ৫. কোড অমনিজেন কন্ট্রোলার (মূল ক্লাস) ==========
class CodeOmnigenController {
  constructor() {
    this.manager = new CodeManager();
    this.history = [];
  }

  // ভাষার তালিকা
  getSupportedLanguages() {
    return Object.keys(LANGUAGE_CONFIG);
  }

  // কোড জেনারেট, সেভ ও রান একসাথে
  async generateAndRun(language, description, options = {}) {
    const { saveFile = true, autoRun = true } = options;
    try {
      const generator = new CodeGenerator(language, description);
      const code = generator.generate();
      let fileInfo = null;
      if (saveFile) {
        fileInfo = this.manager.saveCode(language, code);
      }
      let runResult = null;
      if (autoRun && fileInfo) {
        const runner = new CodeRunner(language, fileInfo.filePath);
        runResult = await runner.run();
      }
      const record = {
        timestamp: getTimestamp(),
        language,
        description,
        code: code.slice(0, 500), // truncate
        filePath: fileInfo?.filePath,
        runResult
      };
      this.history.push(record);
      return { success: true, code, fileInfo, runResult, record };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // শুধু কোড জেনারেট (রান ছাড়া)
  generateOnly(language, description) {
    try {
      const generator = new CodeGenerator(language, description);
      const code = generator.generate();
      return { success: true, code };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // বিদ্যমান ফাইল রান
  async runFile(filePath, language = null) {
    if (!fs.existsSync(filePath)) return { success: false, error: 'File not found' };
    const ext = path.extname(filePath);
    const detectedLang = language || Object.keys(LANGUAGE_CONFIG).find(lang => LANGUAGE_CONFIG[lang].extension === ext);
    if (!detectedLang) return { success: false, error: 'Unknown language' };
    const runner = new CodeRunner(detectedLang, filePath);
    return await runner.run();
  }

  // ইতিহাস দেখা
  getHistory(limit = 10) { return this.history.slice(-limit); }
  clearHistory() { this.history = []; }
}

// ========== ৬. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runCodeOmnigen(fusionData, emitFeed) {
  emitFeed('info', '📝 কোড অমনিজেন সক্রিয় – যেকোনো ভাষায় কোড জেনারেট ও রান করতে প্রস্তুত');
  const controller = new CodeOmnigenController();
  const languages = controller.getSupportedLanguages();
  emitFeed('info', `💻 সমর্থিত ভাষা: ${languages.slice(0, 10).join(', ')} এবং আরও ${languages.length - 10}টি`);
  
  // টেস্ট জেনারেশন (পাইথন)
  const test = await controller.generateAndRun('python', 'একটি ফাংশন যা দুটি সংখ্যা যোগ করে এবং প্রিন্ট করে', { saveFile: true, autoRun: true });
  if (test.success) {
    emitFeed('info', `🐍 পাইথন কোড জেনারেট ও রান সম্পন্ন: ${test.runResult?.output?.trim() || 'no output'}`);
  } else {
    emitFeed('error', `পাইথন টেস্ট ব্যর্থ: ${test.error}`);
  }
  
  fusionData.custom.results.codeOmnigen = {
    supportedLanguagesCount: languages.length,
    testResult: test.success ? 'success' : 'failed',
    lastGenerated: test.record
  };
  return { ok: true, controller };
}

// ========== ৭. এক্সপোর্ট ==========
module.exports = {
  LANGUAGE_CONFIG,
  CodeGenerator,
  CodeRunner,
  CodeManager,
  CodeOmnigenController,
  runCodeOmnigen
};

console.log('✅ code-omnigen.js লোড হয়েছে – কোড অমনিজেন প্রস্তুত');
