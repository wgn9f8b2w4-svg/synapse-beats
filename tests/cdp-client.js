/**
 * cdp-client.js
 * Lightweight, zero-dependency Chrome DevTools Protocol (CDP) client
 * for controlling Headless Edge / Chrome via native Node.js WebSocket.
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

class CDPBrowser {
  constructor(options = {}) {
    this.port = options.port || 9333;
    this.edgePath = options.executablePath || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    this.userDataDir = path.join(os.tmpdir(), `edge-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
    this.proc = null;
    this.ws = null;
    this.msgId = 1;
    this.pendingCallbacks = new Map();
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.uncaughtExceptions = [];
    this.eventListeners = new Map();
  }

  async launch() {
    // Ensure isolated temp directory
    try {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    } catch (_) {}

    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--disable-default-apps',
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
      '--hide-scrollbars',
      `--user-data-dir=${this.userDataDir}`,
      `--remote-debugging-port=${this.port}`,
      'about:blank'
    ];

    this.proc = spawn(this.edgePath, args, { stdio: 'ignore' });

    // Handle unexpected process exit
    this.proc.on('exit', () => {
      this.proc = null;
    });

    // Poll until debugging port is ready (max 8 seconds)
    const startTime = Date.now();
    let connected = false;

    while (Date.now() - startTime < 8000) {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/json/version`);
        if (res.ok) {
          connected = true;
          break;
        }
      } catch (_) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    if (!connected) {
      this.close();
      throw new Error(`Failed to connect to browser on port ${this.port} within 8s`);
    }

    // Get page targets
    const listRes = await fetch(`http://127.0.0.1:${this.port}/json/list`);
    const pages = await listRes.json();
    const targetPage = pages.find(p => p.type === 'page') || pages[0];

    if (!targetPage || !targetPage.webSocketDebuggerUrl) {
      this.close();
      throw new Error('No target page with webSocketDebuggerUrl available');
    }

    // Connect via native WebSocket
    this.ws = new WebSocket(targetPage.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pendingCallbacks.has(msg.id)) {
          const { resolve, reject } = this.pendingCallbacks.get(msg.id);
          this.pendingCallbacks.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        } else if (msg.method) {
          this._handleEvent(msg.method, msg.params);
        }
      } catch (err) {
        console.error('Error handling CDP message:', err);
      }
    };

    // Enable Runtime, Page, DOM, and Network domains
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
    await this.send('Log.enable');

    return this;
  }

  _handleEvent(method, params) {
    if (method === 'Runtime.consoleAPICalled') {
      const text = (params.args || []).map(a => a.value !== undefined ? a.value : JSON.stringify(a)).join(' ');
      const entry = { type: params.type, text, timestamp: params.timestamp };
      this.consoleMessages.push(entry);
      if (params.type === 'error') {
        this.consoleErrors.push(entry);
      }
    } else if (method === 'Runtime.exceptionThrown') {
      const desc = params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'Unknown exception';
      const entry = {
        text: desc,
        lineNumber: params.exceptionDetails?.lineNumber,
        columnNumber: params.exceptionDetails?.columnNumber,
        url: params.exceptionDetails?.url
      };
      this.uncaughtExceptions.push(entry);
    }

    if (this.eventListeners.has(method)) {
      this.eventListeners.get(method).forEach(fn => fn(params));
    }
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket is not open'));
      }
      const id = this.msgId++;
      this.pendingCallbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async navigate(url, waitTimeMs = 500) {
    await this.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, waitTimeMs));
    await this.waitForFunction('document.readyState === "complete" && Boolean(window.neuralAudioEngine)', 8000);
    // Neutralize blocking modal dialogs
    await this.evaluate('window.alert = () => {}; window.confirm = () => true; window.prompt = () => null;');
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      const err = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
      throw new Error(`Evaluation failed: ${err}`);
    }
    return res.result?.value;
  }

  async click(selector) {
    const expr = `
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error("Element not found for click: " + ${JSON.stringify(selector)});
        el.scrollIntoView({ block: "center" });
        el.click();
        return true;
      })()
    `;
    return await this.evaluate(expr);
  }

  async setInputValue(selector, value) {
    const expr = `
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error("Element not found: " + ${JSON.stringify(selector)});
        el.value = ${JSON.stringify(value)};
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return el.value;
      })()
    `;
    return await this.evaluate(expr);
  }

  async waitForFunction(fnExpression, timeoutMs = 5000, pollIntervalMs = 100) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await this.evaluate(`Boolean(${fnExpression})`);
        if (res) return true;
      } catch (_) {}
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
    throw new Error(`Timed out waiting for function: ${fnExpression}`);
  }

  async close() {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
    } catch (_) {}
    if (this.proc) {
      try {
        if (process.platform === 'win32' && this.proc.pid) {
          const { execSync } = require('child_process');
          execSync(`taskkill /pid ${this.proc.pid} /T /F`, { stdio: 'ignore' });
        } else {
          this.proc.kill('SIGTERM');
        }
      } catch (_) {}
      this.proc = null;
    }
    // Clean up temp directory
    try {
      if (fs.existsSync(this.userDataDir)) {
        fs.rmSync(this.userDataDir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}

module.exports = { CDPBrowser };
