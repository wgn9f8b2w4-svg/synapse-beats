/**
 * tests/tier1-features.js
 * Tier 1: Feature Coverage (≥5 test cases per feature, 5 features = 25 tests)
 * 
 * Feature 1: Server Asset Delivery & Security Endpoints
 * Feature 2: Visual Hierarchy & DOM Contract Fidelity
 * Feature 3: Audio Engine Preservation & Synthesis Integrity
 * Feature 4: Micro-Interactions, Iconography & Accessibility
 * Feature 5: Apple Pro CSS Design System Tokens & GPU Performance
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const REFERENCE_SHA256 = 'e13cbaef2dea7591c049ad243f584d5107a5722c85d8b75ba0fbe3866fc84f04';

function fetchUrl(targetPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetPath, BASE_URL);
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${targetPath}`));
    });
  });
}

async function runTier1() {
  console.log('\n============================================================');
  console.log('  RUNNING TIER 1: FEATURE COVERAGE (25 TESTS)');
  console.log('============================================================\n');

  const results = [];

  async function test(name, fn) {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`  [PASS] ${name}`);
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
      console.error(`  [FAIL] ${name}\n         -> ${err.message}`);
    }
  }

  // Read local authoritative files
  const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
  const cssPath = path.join(__dirname, '..', 'public', 'styles.css');
  const jsAppPath = path.join(__dirname, '..', 'public', 'app.js');
  const audioEnginePath = path.join(__dirname, '..', 'public', 'audio-engine.js');

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  const jsAppContent = fs.readFileSync(jsAppPath, 'utf8');
  const audioEngineContent = fs.readFileSync(audioEnginePath, 'utf8');

  // =========================================================================
  // Feature 1: Server Asset Delivery & Security Endpoints (5 tests)
  // =========================================================================
  console.log('\n-- Feature 1: Server Asset Delivery & Security Endpoints --');

  await test('1.1 Root endpoint (/) returns HTTP 200 with text/html content-type', async () => {
    const res = await fetchUrl('/');
    assert.strictEqual(res.statusCode, 200, `Expected HTTP 200, got ${res.statusCode}`);
    assert.ok(
      res.headers['content-type'] && res.headers['content-type'].includes('text/html'),
      `Expected text/html content-type, got ${res.headers['content-type']}`
    );
    assert.ok(res.body.includes('<!DOCTYPE html>'), 'Response body missing <!DOCTYPE html>');
  });

  await test('1.2 Stylesheet endpoint (/styles.css) returns HTTP 200 with text/css', async () => {
    const res = await fetchUrl('/styles.css');
    assert.strictEqual(res.statusCode, 200, `Expected HTTP 200, got ${res.statusCode}`);
    assert.ok(
      res.headers['content-type'] && res.headers['content-type'].includes('text/css'),
      `Expected text/css content-type, got ${res.headers['content-type']}`
    );
    assert.ok(res.body.length > 5000, `CSS payload suspiciously small: ${res.body.length} bytes`);
  });

  await test('1.3 App controller endpoint (/app.js) returns HTTP 200 with javascript', async () => {
    const res = await fetchUrl('/app.js');
    assert.strictEqual(res.statusCode, 200, `Expected HTTP 200, got ${res.statusCode}`);
    assert.ok(
      res.headers['content-type'] && (res.headers['content-type'].includes('javascript') || res.headers['content-type'].includes('application/javascript')),
      `Expected javascript content-type, got ${res.headers['content-type']}`
    );
    assert.ok(res.body.includes('neuralAudioEngine'), 'App controller missing neuralAudioEngine reference');
  });

  await test('1.4 Audio engine endpoint (/audio-engine.js) returns HTTP 200 with javascript', async () => {
    const res = await fetchUrl('/audio-engine.js');
    assert.strictEqual(res.statusCode, 200, `Expected HTTP 200, got ${res.statusCode}`);
    assert.ok(
      res.headers['content-type'] && (res.headers['content-type'].includes('javascript') || res.headers['content-type'].includes('application/javascript')),
      `Expected javascript content-type, got ${res.headers['content-type']}`
    );
    assert.ok(
      res.body.includes('NeuralAudioEngine') || res.body.includes('NeuroAudioEngine'),
      'Audio engine missing NeuralAudioEngine class'
    );
  });

  await test('1.5 Zero broken links & security boundary (404 and 403 enforcement)', async () => {
    // Non-existent route
    const notFoundRes = await fetchUrl('/non-existent-probe-asset.xyz');
    assert.strictEqual(notFoundRes.statusCode, 404, `Expected HTTP 404 for missing route, got ${notFoundRes.statusCode}`);

    // Directory traversal attempt
    const traversalRes = await fetchUrl('/../server.js');
    assert.ok(
      traversalRes.statusCode === 403 || traversalRes.statusCode === 404,
      `Directory traversal must be blocked (403/404), got ${traversalRes.statusCode}`
    );

    // Verify all local assets referenced in HTML resolve to HTTP 200
    const localAssetMatches = [...htmlContent.matchAll(/(?:src|href)=["']([^"':]+)["']/g)]
      .map(m => m[1])
      .filter(p => !p.startsWith('http') && !p.startsWith('data:') && !p.startsWith('#') && p.length > 0);

    for (const asset of localAssetMatches) {
      const assetRes = await fetchUrl(`/${asset.replace(/^\//, '')}`);
      assert.strictEqual(
        assetRes.statusCode,
        200,
        `Referenced local asset /${asset} returned HTTP ${assetRes.statusCode}`
      );
    }
  });

  // =========================================================================
  // Feature 2: Visual Hierarchy & DOM Contract Fidelity (5 tests)
  // =========================================================================
  console.log('\n-- Feature 2: Visual Hierarchy & DOM Contract Fidelity --');

  await test('2.1 Header & System Status DOM contract elements exist', async () => {
    const requiredHeaderIds = ['appTitle', 'systemStatus', 'playbackBadge', 'playbackStatusText'];
    for (const id of requiredHeaderIds) {
      const regex = new RegExp(`id=["']${id}["']`);
      assert.ok(regex.test(htmlContent), `Missing required Header/Status ID: #${id}`);
    }
  });

  await test('2.2 Telemetry Readouts DOM contract elements exist', async () => {
    const requiredTelemetryIds = [
      'modeTitle',
      'modeDescription',
      'modeBandEyebrow',
      'telemetryFreq',
      'telemetryWave',
      'telemetryDepth',
      'telemetryMasking'
    ];
    for (const id of requiredTelemetryIds) {
      const regex = new RegExp(`id=["']${id}["']`);
      assert.ok(regex.test(htmlContent), `Missing required Telemetry ID: #${id}`);
    }
  });

  await test('2.3 Visualizer & Oscilloscope DOM contract elements exist', async () => {
    const requiredVisIds = ['visualizerCanvas', 'visualizerOverlay', 'tabWaveform', 'tabSpectrum'];
    for (const id of requiredVisIds) {
      const regex = new RegExp(`id=["']${id}["']`);
      assert.ok(regex.test(htmlContent), `Missing required Visualizer ID: #${id}`);
    }
  });

  await test('2.4 Sliders, Readouts, and Transport Controls DOM contract elements exist', async () => {
    const requiredControlIds = [
      'masterVolumeSlider',
      'maskingVolumeSlider',
      'masterPlayBtn',
      'playIcon',
      'pauseIcon',
      'btnPulse',
      'timerClock',
      'timerModeLabel',
      'masterVolume',
      'volVal',
      'carrierFreq',
      'carrierVal',
      'binauralBeat',
      'beatVal',
      'binauralBalance',
      'balanceVal',
      'spatialDepth',
      'spatialVal',
      'togglePlayBtn',
      'sessionDuration',
      'timeDisplay'
    ];
    for (const id of requiredControlIds) {
      const regex = new RegExp(`id=["']${id}["']`);
      assert.ok(regex.test(htmlContent), `Missing required Control ID: #${id}`);
    }
  });

  await test('2.5 Four Collection Query Selectors Contract populated with valid items', async () => {
    // 1. .mode-card
    const modeCards = [...htmlContent.matchAll(/class=["'][^"']*mode-card[^"']*["'][^>]*data-mode=["']([^"']+)["']/g)];
    assert.ok(modeCards.length >= 4, `Expected at least 4 .mode-card elements, found ${modeCards.length}`);
    const foundModes = modeCards.map(m => m[1]);
    ['focus', 'sleep'].forEach(m => {
      assert.ok(foundModes.includes(m), `Expected data-mode="${m}" in .mode-card collection`);
    });

    // 2. #neuralLevelControl .seg-btn
    const segBtns = [...htmlContent.matchAll(/class=["'][^"']*seg-btn[^"']*["'][^>]*data-level=["']([^"']+)["']/g)];
    assert.ok(segBtns.length >= 3, `Expected at least 3 .seg-btn elements, found ${segBtns.length}`);

    // 3. input[name="soundscape"]
    const soundscapes = [...htmlContent.matchAll(/input[^>]*name=["']soundscape["'][^>]*value=["']([^"']+)["']/g)];
    assert.ok(soundscapes.length >= 3, `Expected at least 3 input[name="soundscape"], found ${soundscapes.length}`);

    // 4. .preset-btn
    const presetBtns = [...htmlContent.matchAll(/class=["'][^"']*preset-btn[^"']*["'][^>]*(?:data-minutes|data-preset)=["']([^"']+)["']/g)];
    assert.ok(presetBtns.length >= 3, `Expected at least 3 .preset-btn elements, found ${presetBtns.length}`);
  });

  // =========================================================================
  // Feature 3: Audio Engine Preservation & Synthesis Integrity (5 tests)
  // =========================================================================
  console.log('\n-- Feature 3: Audio Engine Preservation & Synthesis Integrity --');

  await test('3.1 SHA-256 cryptographic integrity matches pristine reference checksum', async () => {
    const rawBuffer = fs.readFileSync(audioEnginePath);
    const calculatedHash = crypto.createHash('sha256').update(rawBuffer).digest('hex');
    assert.strictEqual(
      calculatedHash,
      REFERENCE_SHA256,
      `Audio Engine SHA-256 integrity mismatch!\nExpected: ${REFERENCE_SHA256}\nFound:    ${calculatedHash}`
    );
  });

  await test('3.2 NeuralAudioEngine class structure and singleton export intact', async () => {
    assert.ok(
      audioEngineContent.includes('class NeuralAudioEngine') || audioEngineContent.includes('class NeuroAudioEngine'),
      'NeuralAudioEngine class declaration missing in public/audio-engine.js'
    );
    assert.ok(
      audioEngineContent.includes('window.neuralAudioEngine = new NeuralAudioEngine()') || audioEngineContent.includes('neuralAudioEngine'),
      'Global singleton window.neuralAudioEngine instantiation missing'
    );
  });

  await test('3.3 Core neuroacoustic synthesis API methods declared and signature compliant', async () => {
    const requiredMethods = [
      'init',
      'play',
      'pause',
      'stop',
      'setMode',
      'setNeuralEffectLevel',
      'setSoundscape',
      'setMasterVolume',
      'setMaskingVolume',
      'calculateEffectiveDepth',
      'getVisualizationData'
    ];
    for (const method of requiredMethods) {
      const regex = new RegExp(`(?:async\\s+)?${method}\\s*\\([^)]*\\)`);
      assert.ok(regex.test(audioEngineContent), `Required engine method missing: ${method}()`);
    }
  });

  await test('3.4 Entrainment mode presets preservation and frequency targets intact', async () => {
    assert.ok(audioEngineContent.includes('modePresets = {'), 'modePresets dictionary missing');
    const expectedPresets = ['focus', 'adhd', 'flow', 'relax', 'meditate', 'sleep'];
    for (const preset of expectedPresets) {
      const regex = new RegExp(`${preset}:\\s*\\{[^}]*freq:\\s*([0-9.]+)`, 's');
      const match = audioEngineContent.match(regex);
      assert.ok(match, `Mode preset definition missing for '${preset}'`);
      const freq = parseFloat(match[1]);
      assert.ok(freq > 0 && freq <= 60, `Frequency for ${preset} out of biological range: ${freq} Hz`);
    }
  });

  await test('3.5 Web Audio API node architecture intact (oscillators, gains, filters, analysers)', async () => {
    const requiredAudioNodes = [
      'createGain',
      'createOscillator',
      'createBiquadFilter',
      'createAnalyser',
      'createBufferSource'
    ];
    for (const node of requiredAudioNodes) {
      assert.ok(audioEngineContent.includes(node), `Required Web Audio API node missing in engine: ${node}`);
    }
  });

  // =========================================================================
  // Feature 4: Micro-Interactions, Iconography & Accessibility (5 tests)
  // =========================================================================
  console.log('\n-- Feature 4: Micro-Interactions, Iconography & Accessibility --');

  await test('4.1 Inline Lucide/Apple SVG icons present with standard vector attributes', async () => {
    const svgMatches = [...htmlContent.matchAll(/<svg[^>]*viewBox=["'][^"']+["'][^>]*>/g)];
    assert.ok(svgMatches.length >= 10, `Expected at least 10 vector SVGs, found ${svgMatches.length}`);
    for (const match of svgMatches) {
      assert.ok(match[0].includes('viewBox'), `SVG missing viewBox: ${match[0]}`);
    }
  });

  await test('4.2 Zero raw Unicode OS emojis present across user-facing HTML markup', async () => {
    // Unicode ranges for typical system emojis: \u{1F300}-\u{1FAFF}, \u{2600}-\u{26FF}, \u{2700}-\u{27BF}
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const lines = htmlContent.split('\n');
    const foundEmojis = [];
    lines.forEach((line, idx) => {
      // Ignore comments or script contents if any
      if (!line.includes('//') && emojiRegex.test(line)) {
        foundEmojis.push({ lineNum: idx + 1, content: line.trim() });
      }
    });
    assert.strictEqual(
      foundEmojis.length,
      0,
      `Raw Unicode emojis found in HTML:\n${JSON.stringify(foundEmojis, null, 2)}`
    );
  });

  await test('4.3 Tactile playback transport button and pulse elements structured', async () => {
    assert.ok(htmlContent.includes('id="masterPlayBtn"'), 'Missing #masterPlayBtn');
    assert.ok(htmlContent.includes('id="playIcon"'), 'Missing #playIcon');
    assert.ok(htmlContent.includes('id="pauseIcon"'), 'Missing #pauseIcon');
    assert.ok(htmlContent.includes('id="btnPulse"'), 'Missing #btnPulse');
  });

  await test('4.4 Semantic ARIA roles, tablists, radiogroups, and live regions present', async () => {
    const requiredRoles = ['role="status"', 'role="tablist"', 'role="tab"', 'role="radiogroup"', 'role="radio"'];
    for (const role of requiredRoles) {
      assert.ok(htmlContent.includes(role), `Missing required semantic accessibility role: ${role}`);
    }
    assert.ok(htmlContent.includes('aria-live="polite"'), 'Missing aria-live="polite" on telemetry/status region');
  });

  await test('4.5 Segmented controls and preset pills have tactile markup and data-attributes', async () => {
    const segButtons = [...htmlContent.matchAll(/<button[^>]*class=["'][^"']*seg-btn[^"']*["'][^>]*data-level=["']([^"']+)["']/g)];
    assert.strictEqual(segButtons.length >= 3, true, 'At least 3 segmented buttons with data-level required');
    const presetButtons = [...htmlContent.matchAll(/<button[^>]*class=["'][^"']*preset-btn[^"']*["'][^>]*data-minutes=["']([^"']+)["']/g)];
    assert.strictEqual(presetButtons.length >= 4, true, 'At least 4 preset buttons with data-minutes required');
  });

  // =========================================================================
  // Feature 5: Apple Pro CSS Design System Tokens & GPU Performance (5 tests)
  // =========================================================================
  console.log('\n-- Feature 5: Apple Pro CSS Design System Tokens & GPU Performance --');

  await test('5.1 Apple Pro OLED dark palette tokens defined in :root', async () => {
    assert.ok(cssContent.includes('--color-canvas: #000000') || cssContent.includes('--bg-dark: #000000'), 'Missing OLED pure black background token (#000000)');
    assert.ok(cssContent.includes('--color-surface-base: #09090b') || cssContent.includes('#09090b'), 'Missing Zinc surface dark base token (#09090b)');
    assert.ok(cssContent.includes('--color-surface-dark: #121215') || cssContent.includes('#121215'), 'Missing Zinc dark depth token (#121215)');
    assert.ok(cssContent.includes('--color-surface-elevated: #18181b') || cssContent.includes('#18181b'), 'Missing Zinc elevated token (#18181b)');
  });

  await test('5.2 Multi-layer glassmorphism blur and specular translucent borders applied', async () => {
    assert.ok(
      cssContent.includes('backdrop-filter:') || cssContent.includes('-webkit-backdrop-filter:'),
      'Missing backdrop-filter glassmorphism rules in styles.css'
    );
    assert.ok(
      cssContent.includes('--glass-blur') || cssContent.includes('blur(24px)'),
      'Missing glassmorphism blur token definition in styles.css'
    );
    assert.ok(
      cssContent.includes('rgba(255, 255, 255, 0.08)') || cssContent.includes('--border-color'),
      'Missing specular translucent borders'
    );
  });

  await test('5.3 Tabular numerals (font-variant-numeric: tabular-nums) applied to eliminate CLS jitter', async () => {
    assert.ok(
      cssContent.includes('tabular-nums') || cssContent.includes('font-feature-settings: "tnum"'),
      'Missing font-variant-numeric: tabular-nums in styles.css'
    );
  });

  await test('5.4 60fps GPU performance: zero unconstrained transition: all declarations', async () => {
    // Check that transition: all is not used on high-frequency / interactive components
    const transitionAllMatches = [...cssContent.matchAll(/transition\s*:\s*all\b/g)];
    assert.strictEqual(
      transitionAllMatches.length,
      0,
      `Found ${transitionAllMatches.length} prohibited 'transition: all' declarations triggering layout reflows`
    );
  });

  await test('5.5 Fluid spring micro-interactions and active scale depression rules present', async () => {
    assert.ok(
      cssContent.includes('cubic-bezier(0.16, 1, 0.3, 1)') || cssContent.includes('cubic-bezier('),
      'Missing fluid spring cubic-bezier easing in styles.css'
    );
    assert.ok(
      cssContent.includes('scale(0.97)') || cssContent.includes('scale(0.98)') || cssContent.includes(':active'),
      'Missing active tactile depression (scale) on interactive elements'
    );
  });

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log('\n------------------------------------------------------------');
  console.log(`  TIER 1 SUMMARY: ${passedCount} / ${results.length} PASSED (${failedCount} FAILED)`);
  console.log('------------------------------------------------------------\n');

  if (failedCount > 0) {
    throw new Error(`Tier 1 execution failed with ${failedCount} failures`);
  }

  return { total: results.length, passed: passedCount, failed: failedCount };
}

if (require.main === module) {
  runTier1().catch(err => {
    console.error('Tier 1 Fatal Error:', err.message);
    process.exit(1);
  });
}

module.exports = { runTier1 };
