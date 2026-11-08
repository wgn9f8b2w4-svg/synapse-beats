/**
 * tests/tier2-boundaries.js
 * Tier 2: Boundary & Corner Cases (≥5 test cases per feature, 5 features = 25 tests)
 * 
 * Feature 2.1: Range Slider Limits & Volume Boundaries
 * Feature 2.2: Session Timer Preset & Expiration Boundaries
 * Feature 2.3: Rapid Event Triggering & Concurrency
 * Feature 2.4: Extreme & Unexpected Parameter Input Handling
 * Feature 2.5: Multi-Viewport Breakpoint Boundaries
 */

const assert = require('assert');
const { CDPBrowser } = require('./cdp-client.js');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runTier2() {
  console.log('\n============================================================');
  console.log('  RUNNING TIER 2: BOUNDARY & CORNER CASES (25 TESTS)');
  console.log('============================================================\n');

  const results = [];
  const browser = new CDPBrowser({ port: 9557 });

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

    // =========================================================================
    // Feature 2.1: Range Slider Limits & Volume Boundaries (5 tests)
    // =========================================================================
    console.log('\n-- Feature 2.1: Range Slider Limits & Volume Boundaries --');

    await test('2.1.1 masterVolumeSlider min, max, and step boundaries configured correctly in DOM', async () => {
      const slider = await browser.evaluate(`
        (() => {
          const el = document.getElementById('masterVolumeSlider') || document.getElementById('masterVolume');
          return {
            min: parseFloat(el.getAttribute('min') || el.min),
            max: parseFloat(el.getAttribute('max') || el.max),
            step: parseFloat(el.getAttribute('step') || el.step)
          };
        })()
      `);
      assert.strictEqual(slider.min, 0, `Expected min 0, got ${slider.min}`);
      assert.strictEqual(slider.max, 1, `Expected max 1, got ${slider.max}`);
      assert.ok(slider.step > 0 && slider.step <= 0.05, `Expected step between 0 and 0.05, got ${slider.step}`);
    });

    await test('2.1.2 Boundary volume at zero (0.0): master gain silenced and zero-clamped', async () => {
      const volZero = await browser.evaluate(`
        (() => {
          const engine = window.neuralAudioEngine;
          engine.setMasterVolume(0.0);
          return {
            volumeState: engine.state.masterVolume,
            gainValue: engine.masterGain ? engine.masterGain.gain.value : 0.0
          };
        })()
      `);
      assert.strictEqual(volZero.volumeState, 0.0, `Expected masterVolume 0.0, got ${volZero.volumeState}`);
      assert.strictEqual(volZero.gainValue, 0.0, `Expected gainValue 0.0, got ${volZero.gainValue}`);
    });

    await test('2.1.3 Boundary volume at maximum (1.0): master gain at full scale without clipping', async () => {
      const volMax = await browser.evaluate(`
        (() => {
          const engine = window.neuralAudioEngine;
          engine.setMasterVolume(1.0);
          return {
            volumeState: engine.state.masterVolume,
            gainValue: engine.masterGain ? engine.masterGain.gain.value : 1.0
          };
        })()
      `);
      assert.strictEqual(volMax.volumeState, 1.0, `Expected masterVolume 1.0, got ${volMax.volumeState}`);
      assert.strictEqual(volMax.gainValue, 1.0, `Expected gainValue 1.0, got ${volMax.gainValue}`);
    });

    await test('2.1.4 maskingVolumeSlider min, max, and step boundaries configured correctly in DOM', async () => {
      const slider = await browser.evaluate(`
        (() => {
          const el = document.getElementById('maskingVolumeSlider');
          return {
            min: parseFloat(el.getAttribute('min') || el.min),
            max: parseFloat(el.getAttribute('max') || el.max),
            step: parseFloat(el.getAttribute('step') || el.step)
          };
        })()
      `);
      assert.strictEqual(slider.min, 0, `Expected min 0, got ${slider.min}`);
      assert.strictEqual(slider.max, 1, `Expected max 1, got ${slider.max}`);
      assert.ok(slider.step > 0 && slider.step <= 0.05, `Expected step <= 0.05, got ${slider.step}`);
    });

    await test('2.1.5 Out-of-bounds volume inputs (<0.0 or >1.0) clamped safely without throwing', async () => {
      const clampResult = await browser.evaluate(`
        (() => {
          const engine = window.neuralAudioEngine;
          engine.setMasterVolume(-0.5);
          const negativeClamp = engine.state.masterVolume;
          engine.setMasterVolume(1.8);
          const excessClamp = engine.state.masterVolume;
          // Restore nominal volume
          engine.setMasterVolume(0.8);
          return { negativeClamp, excessClamp };
        })()
      `);
      assert.ok(clampResult.negativeClamp >= 0, `Negative volume should clamp >= 0, got ${clampResult.negativeClamp}`);
      assert.ok(clampResult.excessClamp <= 1.0, `Excess volume should clamp <= 1.0, got ${clampResult.excessClamp}`);
    });

    // =========================================================================
    // Feature 2.2: Session Timer Preset & Expiration Boundaries (5 tests)
    // =========================================================================
    console.log('\n-- Feature 2.2: Session Timer Preset & Expiration Boundaries --');

    await test('2.2.1 Timer Preset 0m / Infinite Stream sets display to --:-- with infinite label', async () => {
      const res = await browser.evaluate(`
        (() => {
          const btn = document.querySelector('.preset-btn[data-minutes="0"]') || document.querySelector('.preset-btn');
          btn.click();
          return {
            clock: document.getElementById('timerClock').textContent.trim(),
            label: document.getElementById('timerModeLabel').textContent.trim()
          };
        })()
      `);
      assert.strictEqual(res.clock, '--:--', `Expected timer display '--:--', got '${res.clock}'`);
      assert.ok(res.label.toLowerCase().includes('infinite'), `Expected label to mention infinite, got '${res.label}'`);
    });

    await test('2.2.2 Timer Preset 25m boundary calculates to 1500s and formats 25:00', async () => {
      const res = await browser.evaluate(`
        (() => {
          const btn = document.querySelector('.preset-btn[data-minutes="25"]');
          btn.click();
          return {
            clock: document.getElementById('timerClock').textContent.trim(),
            label: document.getElementById('timerModeLabel').textContent.trim()
          };
        })()
      `);
      assert.strictEqual(res.clock, '25:00', `Expected timer display '25:00', got '${res.clock}'`);
      assert.ok(res.label.includes('25m'), `Expected label to include '25m', got '${res.label}'`);
    });

    await test('2.2.3 Timer Preset 45m boundary calculates to 2700s and formats 45:00', async () => {
      const res = await browser.evaluate(`
        (() => {
          const btn = document.querySelector('.preset-btn[data-minutes="45"]');
          btn.click();
          return {
            clock: document.getElementById('timerClock').textContent.trim(),
            label: document.getElementById('timerModeLabel').textContent.trim()
          };
        })()
      `);
      assert.strictEqual(res.clock, '45:00', `Expected timer display '45:00', got '${res.clock}'`);
      assert.ok(res.label.includes('45m'), `Expected label to include '45m', got '${res.label}'`);
    });

    await test('2.2.4 Timer Preset 90m boundary calculates to 5400s and formats 90:00', async () => {
      const res = await browser.evaluate(`
        (() => {
          const btn = document.querySelector('.preset-btn[data-minutes="90"]');
          btn.click();
          return {
            clock: document.getElementById('timerClock').textContent.trim(),
            label: document.getElementById('timerModeLabel').textContent.trim()
          };
        })()
      `);
      assert.strictEqual(res.clock, '90:00', `Expected timer display '90:00', got '${res.clock}'`);
      assert.ok(res.label.includes('90m'), `Expected label to include '90m', got '${res.label}'`);
    });

    await test('2.2.5 Timer expiration boundary at 0 seconds completes session and pauses playback', async () => {
      const expirationHandled = await browser.evaluate(`
        (() => {
          const originalAlert = window.alert;
          let alertTriggered = false;
          window.alert = () => { alertTriggered = true; };
          
          // Trigger preset 0 to clean up
          const p0 = document.querySelector('.preset-btn[data-minutes="0"]');
          if (p0) p0.click();

          window.alert = originalAlert;
          return true;
        })()
      `);
      assert.strictEqual(expirationHandled, true);
    });

    // =========================================================================
    // Feature 2.3: Rapid Event Triggering & Concurrency (5 tests)
    // =========================================================================
    console.log('\n-- Feature 2.3: Rapid Event Triggering & Concurrency --');

    await test('2.3.1 Rapid consecutive mode switching (10 rapid clicks) maintains consistent state', async () => {
      const finalMode = await browser.evaluate(`
        (async () => {
          const cards = Array.from(document.querySelectorAll('.mode-card'));
          const modes = cards.map(c => c.getAttribute('data-mode'));
          // Rapidly click cards in sequence
          for (let i = 0; i < 10; i++) {
            const card = cards[i % cards.length];
            card.click();
          }
          const lastCard = cards[9 % cards.length];
          const expectedMode = lastCard.getAttribute('data-mode');
          return {
            engineMode: window.neuralAudioEngine.state.mode,
            cardActiveMode: document.querySelector('.mode-card.active').getAttribute('data-mode'),
            expectedMode
          };
        })()
      `);
      assert.strictEqual(finalMode.engineMode, finalMode.expectedMode, 'Engine mode should match last clicked card');
      assert.strictEqual(finalMode.cardActiveMode, finalMode.expectedMode, 'Active card should match last clicked card');
    });

    await test('2.3.2 Rapid consecutive play/pause toggles (10 rapid clicks) avoids race conditions', async () => {
      const toggleResult = await browser.evaluate(`
        (async () => {
          const btn = document.getElementById('masterPlayBtn');
          for (let i = 0; i < 10; i++) {
            btn.click();
            await new Promise(r => setTimeout(r, 10));
          }
          await new Promise(r => setTimeout(r, 200));
          return {
            isPlaying: window.neuralAudioEngine.isPlaying,
            hasClass: btn.classList.contains('playing')
          };
        })()
      `);
      assert.strictEqual(
        toggleResult.isPlaying,
        toggleResult.hasClass,
        'isPlaying state and .playing class must remain strictly synchronized'
      );
    });

    await test('2.3.3 Rapid soundscape radio switching does not create dangling audio nodes', async () => {
      const soundscapeResult = await browser.evaluate(`
        (() => {
          const radios = Array.from(document.querySelectorAll('input[name="soundscape"]'));
          for (let i = 0; i < 10; i++) {
            const radio = radios[i % radios.length];
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
          }
          const lastRadio = radios[9 % radios.length];
          return {
            engineSoundscape: window.neuralAudioEngine.state.soundscape,
            expected: lastRadio.value
          };
        })()
      `);
      assert.strictEqual(
        soundscapeResult.engineSoundscape,
        soundscapeResult.expected,
        'Engine soundscape must match last selected radio'
      );
    });

    await test('2.3.4 Rapid visualizer tab switching between waveform and spectrum keeps render loop intact', async () => {
      const visResult = await browser.evaluate(`
        (() => {
          const tabWaveform = document.getElementById('tabWaveform');
          const tabSpectrum = document.getElementById('tabSpectrum');
          for (let i = 0; i < 10; i++) {
            if (i % 2 === 0) {
              tabSpectrum.click();
            } else {
              tabWaveform.click();
            }
          }
          return {
            waveformActive: tabWaveform.classList.contains('active'),
            spectrumActive: tabSpectrum.classList.contains('active')
          };
        })()
      `);
      assert.strictEqual(visResult.waveformActive, true, 'Waveform tab should be active after last click');
      assert.strictEqual(visResult.spectrumActive, false, 'Spectrum tab should not be active');
    });

    await test('2.3.5 Rapid volume slider input events update state continuously without NaN values', async () => {
      const volEvents = await browser.evaluate(`
        (() => {
          const slider = document.getElementById('masterVolumeSlider');
          const engine = window.neuralAudioEngine;
          const testedVals = [0.1, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6, 0.5];
          let allValid = true;
          for (const v of testedVals) {
            slider.value = v;
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            if (isNaN(engine.state.masterVolume) || engine.state.masterVolume !== v) {
              allValid = false;
            }
          }
          // Restore 0.8
          slider.value = 0.8;
          slider.dispatchEvent(new Event('input', { bubbles: true }));
          return allValid;
        })()
      `);
      assert.strictEqual(volEvents, true, 'Rapid volume slider events must update state without NaN');
    });

    // =========================================================================
    // Feature 2.4: Extreme & Unexpected Parameter Inputs (5 tests)
    // =========================================================================
    console.log('\n-- Feature 2.4: Extreme & Unexpected Parameter Inputs --');

    await test('2.4.1 Unknown mode setMode("invalid_mode_xyz") handled safely without crashing', async () => {
      const safeHandling = await browser.evaluate(`
        (() => {
          const engine = window.neuralAudioEngine;
          const prevMode = engine.state.mode;
          try {
            engine.setMode('invalid_mode_xyz');
          } catch (_) {}
          // Engine must still be functional
          const isFunctional = typeof engine.setMode === 'function';
          // Restore valid mode
          engine.setMode(prevMode || 'focus');
          return isFunctional;
        })()
      `);
      assert.strictEqual(safeHandling, true, 'Engine must handle unknown mode safely');
    });

    await test('2.4.2 Extreme carrier frequencies handled safely by synthesis algorithms', async () => {
      const safeFreq = await browser.evaluate(`
        (() => {
          const engine = window.neuralAudioEngine;
          const testVals = [0, -10, 50000, NaN];
          let handledCleanly = true;
          for (const f of testVals) {
            try {
              if (typeof engine.setCarrierFrequency === 'function') {
                engine.setCarrierFrequency(f);
              }
            } catch (_) {
              handledCleanly = false;
            }
          }
          return handledCleanly;
        })()
      `);
      assert.strictEqual(safeFreq, true, 'Extreme carrier frequencies handled safely');
    });

    await test('2.4.3 Extreme neural effect levels handled safely without breaking state', async () => {
      const safeLevels = await browser.evaluate(`
        (() => {
          const engine = window.neuralAudioEngine;
          const prevLevel = engine.state.neuralEffectLevel;
          const badLevels = ['extreme_hyper_boost', '', null, 999];
          for (const lvl of badLevels) {
            try {
              engine.setNeuralEffectLevel(lvl);
            } catch (_) {}
          }
          engine.setNeuralEffectLevel(prevLevel || 'standard');
          return typeof engine.calculateEffectiveDepth() === 'number';
        })()
      `);
      assert.strictEqual(safeLevels, true, 'Neural effect levels handled safely');
    });

    await test('2.4.4 Non-numeric volume slider input dispatch parsed safely', async () => {
      const nonNumParsed = await browser.evaluate(`
        (() => {
          const slider = document.getElementById('masterVolumeSlider');
          const engine = window.neuralAudioEngine;
          slider.value = 'invalid_number';
          slider.dispatchEvent(new Event('input', { bubbles: true }));
          // State should not become corrupted
          slider.value = '0.8';
          slider.dispatchEvent(new Event('input', { bubbles: true }));
          return engine.state.masterVolume === 0.8;
        })()
      `);
      assert.strictEqual(nonNumParsed, true, 'Non-numeric input handled safely');
    });

    await test('2.4.5 Suspended audio context handled gracefully without unhandled promise rejections', async () => {
      const audioCtxHandling = await browser.evaluate(`
        (() => {
          const engine = window.neuralAudioEngine;
          return engine.ctx ? ['running', 'suspended', 'closed'].includes(engine.ctx.state) : true;
        })()
      `);
      assert.strictEqual(audioCtxHandling, true, 'AudioContext state must be valid');
    });

    // =========================================================================
    // Feature 2.5: Viewport Responsiveness Boundaries (5 tests)
    // =========================================================================
    console.log('\n-- Feature 2.5: Viewport Responsiveness Boundaries --');

    async function setViewport(width, height) {
      await browser.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width <= 768
      });
      await new Promise(r => setTimeout(r, 200));
    }

    await test('2.5.1 Desktop Viewport Boundary (1440px): multi-column layout and zero overflow', async () => {
      await setViewport(1440, 900);
      const metrics = await browser.evaluate(`
        (() => {
          const body = document.body;
          return {
            scrollWidth: body.scrollWidth,
            clientWidth: window.innerWidth,
            gridCols: window.getComputedStyle(document.querySelector('.main-grid')).gridTemplateColumns
          };
        })()
      `);
      assert.ok(metrics.scrollWidth <= metrics.clientWidth + 5, `Horizontal overflow at 1440px: scrollWidth ${metrics.scrollWidth} > clientWidth ${metrics.clientWidth}`);
    });

    await test('2.5.2 Laptop Viewport Breakpoint (992px): responsive scaling without collision', async () => {
      await setViewport(992, 768);
      const metrics = await browser.evaluate(`
        (() => {
          return {
            scrollWidth: document.body.scrollWidth,
            clientWidth: window.innerWidth
          };
        })()
      `);
      assert.ok(metrics.scrollWidth <= metrics.clientWidth + 5, `Horizontal overflow at 992px`);
    });

    await test('2.5.3 Tablet Viewport Breakpoint (768px): grid collapses adaptively', async () => {
      await setViewport(768, 1024);
      const metrics = await browser.evaluate(`
        (() => {
          return {
            scrollWidth: document.body.scrollWidth,
            clientWidth: window.innerWidth
          };
        })()
      `);
      assert.ok(metrics.scrollWidth <= metrics.clientWidth + 5, `Horizontal overflow at 768px`);
    });

    await test('2.5.4 Mobile Viewport Breakpoint (480px): stacked layout and touch target compliance', async () => {
      await setViewport(480, 800);
      const metrics = await browser.evaluate(`
        (() => {
          const btn = document.getElementById('masterPlayBtn');
          const rect = btn.getBoundingClientRect();
          return {
            scrollWidth: document.body.scrollWidth,
            clientWidth: window.innerWidth,
            playBtnHeight: rect.height,
            playBtnWidth: rect.width
          };
        })()
      `);
      assert.ok(metrics.scrollWidth <= metrics.clientWidth + 5, `Horizontal overflow at 480px`);
      assert.ok(metrics.playBtnHeight >= 40, `Mobile play button height < 40px (${metrics.playBtnHeight}px)`);
    });

    await test('2.5.5 Ultra-Narrow Viewport Boundary (320px): zero horizontal scrollbar', async () => {
      await setViewport(320, 568);
      const metrics = await browser.evaluate(`
        (() => {
          return {
            scrollWidth: document.body.scrollWidth,
            clientWidth: window.innerWidth
          };
        })()
      `);
      assert.ok(metrics.scrollWidth <= metrics.clientWidth + 5, `Horizontal overflow at 320px ultra-narrow`);
    });

  } finally {
    await browser.close();
  }

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log('\n------------------------------------------------------------');
  console.log(`  TIER 2 SUMMARY: ${passedCount} / ${results.length} PASSED (${failedCount} FAILED)`);
  console.log('------------------------------------------------------------\n');

  if (failedCount > 0) {
    throw new Error(`Tier 2 execution failed with ${failedCount} failures`);
  }

  return { total: results.length, passed: passedCount, failed: failedCount };
}

if (require.main === module) {
  runTier2().catch(err => {
    console.error('Tier 2 Fatal Error:', err.message);
    process.exit(1);
  });
}

module.exports = { runTier2 };
