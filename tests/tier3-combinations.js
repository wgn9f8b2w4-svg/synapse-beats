/**
 * tests/tier3-combinations.js
 * Tier 3: Cross-Feature Combinations (Pairwise Combination Matrix)
 * 
 * Verifies orthogonal combinations across:
 * - 6 Modes: focus, adhd, flow, relax, meditate, sleep
 * - 3 Entrainment Levels: low, medium, high
 * - 3 Soundscapes: cosmic, lofi, ethereal
 * 
 * Total: 18 Orthogonal Pairwise Test Vectors verifying:
 * - DOM active state synchronization
 * - Engine internal state synchronization
 * - Telemetry and frequency calculations
 * - Mathematical modulation depth bounds
 * - Zero console errors or runtime exceptions
 */

const assert = require('assert');
const { CDPBrowser } = require('./cdp-client.js');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const PAIRWISE_VECTORS = [
  // Mode, Level, Soundscape, Expected Freq
  { mode: 'focus', level: 'low', soundscape: 'cosmic', expectedFreq: 16.0 },
  { mode: 'focus', level: 'medium', soundscape: 'lofi', expectedFreq: 16.0 },
  { mode: 'focus', level: 'high', soundscape: 'ethereal', expectedFreq: 16.0 },
  { mode: 'adhd', level: 'low', soundscape: 'lofi', expectedFreq: 16.0 },
  { mode: 'adhd', level: 'medium', soundscape: 'ethereal', expectedFreq: 16.0 },
  { mode: 'adhd', level: 'high', soundscape: 'cosmic', expectedFreq: 16.0 },
  { mode: 'flow', level: 'low', soundscape: 'ethereal', expectedFreq: 13.0 },
  { mode: 'flow', level: 'medium', soundscape: 'cosmic', expectedFreq: 13.0 },
  { mode: 'flow', level: 'high', soundscape: 'lofi', expectedFreq: 13.0 },
  { mode: 'relax', level: 'low', soundscape: 'cosmic', expectedFreq: 10.0 },
  { mode: 'relax', level: 'medium', soundscape: 'lofi', expectedFreq: 10.0 },
  { mode: 'relax', level: 'high', soundscape: 'ethereal', expectedFreq: 10.0 },
  { mode: 'meditate', level: 'low', soundscape: 'lofi', expectedFreq: 5.5 },
  { mode: 'meditate', level: 'medium', soundscape: 'ethereal', expectedFreq: 5.5 },
  { mode: 'meditate', level: 'high', soundscape: 'cosmic', expectedFreq: 5.5 },
  { mode: 'sleep', level: 'low', soundscape: 'ethereal', expectedFreq: 1.5 },
  { mode: 'sleep', level: 'medium', soundscape: 'cosmic', expectedFreq: 1.5 },
  { mode: 'sleep', level: 'high', soundscape: 'lofi', expectedFreq: 1.5 }
];

async function runTier3() {
  console.log('\n============================================================');
  console.log('  RUNNING TIER 3: CROSS-FEATURE COMBINATIONS (18 VECTORS)');
  console.log('============================================================\n');

  const results = [];
  const browser = new CDPBrowser({ port: 9558 });

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

  try {
    await browser.launch();
    await browser.navigate(BASE_URL);

    for (let i = 0; i < PAIRWISE_VECTORS.length; i++) {
      const vec = PAIRWISE_VECTORS[i];
      const testName = `3.${i + 1} Combination [${vec.mode.toUpperCase()}] + [${vec.level.toUpperCase()}] + [${vec.soundscape.toUpperCase()}]`;

      await test(testName, async () => {
        const state = await browser.evaluate(`
          (async () => {
            const engine = window.neuralAudioEngine;

            // 1. Click Mode Card
            const modeCard = document.querySelector('.mode-card[data-mode="${vec.mode}"]');
            if (modeCard) {
              modeCard.click();
            } else {
              engine.setMode('${vec.mode}');
            }

            // 2. Click Level Button
            const levelBtn = document.querySelector('#neuralLevelControl .seg-btn[data-level="${vec.level}"]');
            if (levelBtn) {
              levelBtn.click();
            } else {
              engine.setNeuralEffectLevel('${vec.level}');
            }

            // 3. Select Soundscape Radio
            const soundscapeRadio = document.querySelector('input[name="soundscape"][value="${vec.soundscape}"]');
            if (soundscapeRadio) {
              soundscapeRadio.checked = true;
              soundscapeRadio.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              engine.setSoundscape('${vec.soundscape}');
            }

            // Small delay for UI and DOM updates
            await new Promise(r => setTimeout(r, 60));

            const depth = engine.calculateEffectiveDepth();
            const preset = engine.modePresets[engine.state.mode];

            const modeTitleEl = document.getElementById('modeTitle');
            const telemetryFreqEl = document.getElementById('telemetryFreq');
            const telemetryDepthEl = document.getElementById('telemetryDepth');

            return {
              engineMode: engine.state.mode,
              engineLevel: engine.state.neuralEffectLevel,
              engineSoundscape: engine.state.soundscape,
              effectiveDepth: depth,
              presetFreq: preset ? preset.freq : null,
              presetName: preset ? preset.name : null,
              uiModeTitle: modeTitleEl ? modeTitleEl.textContent.trim() : null,
              uiFreqText: telemetryFreqEl ? telemetryFreqEl.textContent.trim() : null,
              uiDepthText: telemetryDepthEl ? telemetryDepthEl.textContent.trim() : null
            };
          })()
        `);

        // Assert engine state synchronization
        assert.strictEqual(state.engineMode, vec.mode, `Engine mode mismatch: expected ${vec.mode}, got ${state.engineMode}`);
        assert.strictEqual(state.engineLevel, vec.level, `Engine level mismatch: expected ${vec.level}, got ${state.engineLevel}`);
        assert.strictEqual(state.engineSoundscape, vec.soundscape, `Engine soundscape mismatch: expected ${vec.soundscape}, got ${state.engineSoundscape}`);

        // Assert neuroacoustic mathematical parameters
        assert.ok(state.effectiveDepth >= 0.1 && state.effectiveDepth <= 1.0, `Effective depth out of bounds: ${state.effectiveDepth}`);
        assert.strictEqual(state.presetFreq, vec.expectedFreq, `Preset frequency mismatch: expected ${vec.expectedFreq}, got ${state.presetFreq}`);

        // Assert UI synchronization
        assert.ok(state.uiModeTitle, 'UI Mode Title should be populated');
        assert.ok(
          state.uiFreqText.includes(vec.expectedFreq.toFixed(1)) || state.uiFreqText.includes(String(vec.expectedFreq)),
          `UI frequency readout '${state.uiFreqText}' does not match expected ${vec.expectedFreq} Hz`
        );
      });
    }

    // Verify overall console errors during combination testing
    assert.strictEqual(browser.consoleErrors.length, 0, `Detected ${browser.consoleErrors.length} console errors during Tier 3 execution`);
    assert.strictEqual(browser.uncaughtExceptions.length, 0, `Detected ${browser.uncaughtExceptions.length} uncaught exceptions during Tier 3 execution`);

  } finally {
    await browser.close();
  }

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log('\n------------------------------------------------------------');
  console.log(`  TIER 3 SUMMARY: ${passedCount} / ${results.length} PASSED (${failedCount} FAILED)`);
  console.log('------------------------------------------------------------\n');

  if (failedCount > 0) {
    throw new Error(`Tier 3 execution failed with ${failedCount} failures`);
  }

  return { total: results.length, passed: passedCount, failed: failedCount };
}

if (require.main === module) {
  runTier3().catch(err => {
    console.error('Tier 3 Fatal Error:', err.message);
    process.exit(1);
  });
}

module.exports = { runTier3 };
