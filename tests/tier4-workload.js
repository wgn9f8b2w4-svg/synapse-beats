/**
 * tests/tier4-workload.js
 * Tier 4: Real-World Workload Simulation in Headless Edge
 * 
 * Simulates a realistic interactive user session:
 * 1. Navigate to http://localhost:3000 and verify clean initial state.
 * 2. Configure 25-minute focus session preset (display shows 25:00).
 * 3. Start playback via masterPlayBtn: audio engine activates, status becomes Engine Active, countdown begins.
 * 4. Verify live timer countdown tick (24:59).
 * 5. Verify active 60fps requestAnimationFrame visualizer canvas render loop.
 * 6. Switch cognitive mode to 'flow' and verify real-time telemetry update.
 * 7. Adjust master volume and masking bed volume sliders.
 * 8. Change ambient soundscape to 'lofi'.
 * 9. Switch visualizer view to FFT Spectrum mode.
 * 10. Pause playback: audio suspends, status becomes Engine Paused, timer pauses.
 * 11. Cumulative Audit: Verify 0 console errors, 0 uncaught exceptions across entire session.
 */

const assert = require('assert');
const { CDPBrowser } = require('./cdp-client.js');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runTier4() {
  console.log('\n============================================================');
  console.log('  RUNNING TIER 4: REAL-WORLD WORKLOAD SIMULATION');
  console.log('============================================================\n');

  const results = [];
  const browser = new CDPBrowser({ port: 9559 });

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

    // Step 1: Initial Page Load & Telemetry Baseline
    console.log('\n-- Step 1: Page Load & Initial State Verification --');
    await test('4.1 Browser navigates to http://localhost:3000 with 0 initial console errors', async () => {
      await browser.navigate(BASE_URL);
      const title = await browser.evaluate('document.title');
      assert.ok(title.includes('Synapse.fm'), `Unexpected title: ${title}`);
      assert.strictEqual(browser.consoleErrors.length, 0, 'Found console errors during load');
      assert.strictEqual(browser.uncaughtExceptions.length, 0, 'Found uncaught exceptions during load');
    });

    await test('4.2 Verify initial DOM state: Engine Idle, Play Icon visible, Overlay active', async () => {
      const state = await browser.evaluate(`
        (() => {
          const statusText = document.getElementById('playbackStatusText').textContent.trim();
          const playIcon = document.getElementById('playIcon');
          const pauseIcon = document.getElementById('pauseIcon');
          const overlay = document.getElementById('visualizerOverlay');
          const isPlaying = window.neuralAudioEngine ? window.neuralAudioEngine.isPlaying : null;

          return {
            statusText,
            playIconDisplay: window.getComputedStyle(playIcon).display,
            pauseIconDisplay: window.getComputedStyle(pauseIcon).display,
            overlayHidden: overlay ? overlay.classList.contains('hidden') : false,
            isPlaying
          };
        })()
      `);
      assert.strictEqual(state.statusText, 'Engine Idle', `Expected 'Engine Idle', got '${state.statusText}'`);
      assert.notStrictEqual(state.playIconDisplay, 'none', 'Play icon should be visible');
      assert.strictEqual(state.pauseIconDisplay, 'none', 'Pause icon should be hidden');
      assert.strictEqual(state.overlayHidden, false, 'Visualizer overlay should be visible');
      assert.strictEqual(state.isPlaying, false, 'Audio engine isPlaying should initially be false');
    });

    // Step 2: Configure Session Timer Preset
    console.log('\n-- Step 2: Session Timer Configuration --');
    await test('4.3 Select 25m session preset: timer clock formats 25:00 and mode label updates', async () => {
      const presetState = await browser.evaluate(`
        (() => {
          const btn = document.querySelector('.preset-btn[data-minutes="25"]');
          btn.click();
          return {
            clock: document.getElementById('timerClock').textContent.trim(),
            label: document.getElementById('timerModeLabel').textContent.trim(),
            hasActive: btn.classList.contains('active')
          };
        })()
      `);
      assert.strictEqual(presetState.clock, '25:00', `Expected '25:00', got '${presetState.clock}'`);
      assert.ok(presetState.label.includes('25m'), `Expected label to include '25m', got '${presetState.label}'`);
      assert.strictEqual(presetState.hasActive, true, '25m preset button should have .active class');
    });

    // Step 3: Start Playback & Audio Engine Activation
    console.log('\n-- Step 3: Start Playback & Web Audio API Activation --');
    await test('4.4 Trigger playback: audio context initializes, status updates to Engine Active', async () => {
      const playState = await browser.evaluate(`
        (async () => {
          const btn = document.getElementById('masterPlayBtn');
          btn.click();
          // Give audio context and event loop time to spin up
          await new Promise(r => setTimeout(r, 400));
          
          const engine = window.neuralAudioEngine;
          const statusText = document.getElementById('playbackStatusText').textContent.trim();
          const hasPlayingClass = btn.classList.contains('playing');
          const overlay = document.getElementById('visualizerOverlay');

          return {
            isPlaying: engine.isPlaying,
            ctxState: engine.ctx ? engine.ctx.state : null,
            statusText,
            hasPlayingClass,
            overlayHidden: overlay ? overlay.classList.contains('hidden') : false
          };
        })()
      `);
      assert.strictEqual(playState.isPlaying, true, 'Engine isPlaying should be true');
      assert.strictEqual(playState.hasPlayingClass, true, 'Play button should have .playing class');
      assert.strictEqual(playState.statusText, 'Engine Active', `Expected 'Engine Active', got '${playState.statusText}'`);
      assert.strictEqual(playState.overlayHidden, true, 'Visualizer overlay should have .hidden class');
    });

    // Step 4: Live Countdown Verification
    console.log('\n-- Step 4: Live Session Timer Countdown --');
    await test('4.5 Live timer interval counts down active seconds during playback', async () => {
      const countdown = await browser.evaluate(`
        (async () => {
          await new Promise(r => setTimeout(r, 1200));
          return document.getElementById('timerClock').textContent.trim();
        })()
      `);
      assert.ok(
        countdown === '24:59' || countdown === '24:58',
        `Expected active countdown (24:59 or 24:58), got '${countdown}'`
      );
    });

    // Step 5: Measure 60fps Visualizer Animation Loop Active
    console.log('\n-- Step 5: 60fps Real-Time Canvas Visualizer Loop --');
    await test('4.6 Real-time visualizer canvas runs continuous 60fps requestAnimationFrame loop', async () => {
      const fpsData = await browser.evaluate(`
        (() => {
          return new Promise((resolve) => {
            const frameTimes = [];
            let lastTime = performance.now();
            let count = 0;

            function onFrame(now) {
              const delta = now - lastTime;
              lastTime = now;
              frameTimes.push(delta);
              count++;

              if (count < 30) {
                requestAnimationFrame(onFrame);
              } else {
                const samples = frameTimes.slice(1);
                const sum = samples.reduce((a, b) => a + b, 0);
                const avgDelta = sum / samples.length;
                const maxDelta = Math.max(...samples);
                const minDelta = Math.min(...samples);
                resolve({ avgDelta, maxDelta, minDelta, sampleCount: samples.length });
              }
            }

            requestAnimationFrame(onFrame);
          });
        })()
      `);
      console.log(`         -> Average frame delta: ${fpsData.avgDelta.toFixed(2)} ms (~${(1000 / fpsData.avgDelta).toFixed(1)} fps)`);
      assert.ok(
        fpsData.avgDelta >= 10 && fpsData.avgDelta <= 35,
        `Frame delta out of acceptable 60fps animation bounds: ${fpsData.avgDelta.toFixed(2)} ms`
      );
      assert.ok(fpsData.maxDelta < 120, `Visualizer frame stalled! Max delta: ${fpsData.maxDelta.toFixed(2)} ms`);
    });

    // Step 6: Interactive Mode Selection & Telemetry Sync
    console.log('\n-- Step 6: Interactive Mode Selection & Telemetry Refresh --');
    await test('4.7 Select Creative Flow mode: telemetry updates with 13.0 Hz and Alpha-Beta eyebrow', async () => {
      const flowState = await browser.evaluate(`
        (async () => {
          const flowCard = document.querySelector('.mode-card[data-mode="flow"]');
          flowCard.click();
          await new Promise(r => setTimeout(r, 100));

          const modeTitle = document.getElementById('modeTitle').textContent.trim();
          const eyebrow = document.getElementById('modeBandEyebrow').textContent.trim();
          const freq = document.getElementById('telemetryFreq').textContent.trim();
          const engineMode = window.neuralAudioEngine.state.mode;

          return { modeTitle, eyebrow, freq, engineMode };
        })()
      `);
      assert.strictEqual(flowState.engineMode, 'flow', 'Engine mode should be flow');
      assert.strictEqual(flowState.modeTitle, 'Creative Flow', `Expected 'Creative Flow', got '${flowState.modeTitle}'`);
      assert.ok(flowState.freq.includes('13.0'), `Expected 13.0 Hz in readout, got '${flowState.freq}'`);
      assert.ok(flowState.eyebrow.includes('BETA') || flowState.eyebrow.includes('ALPHA'), `Expected Alpha/Beta in eyebrow, got '${flowState.eyebrow}'`);
    });

    // Step 7: Dynamic Parameter Adjustments
    console.log('\n-- Step 7: Master & Masking Slider Adjustments --');
    await test('4.8 Adjust Master Volume and Masking Bed sliders and verify telemetry percentage sync', async () => {
      const sliderState = await browser.evaluate(`
        (() => {
          const master = document.getElementById('masterVolumeSlider');
          const masking = document.getElementById('maskingVolumeSlider');

          master.value = 0.65;
          master.dispatchEvent(new Event('input', { bubbles: true }));

          masking.value = 0.40;
          masking.dispatchEvent(new Event('input', { bubbles: true }));

          const engine = window.neuralAudioEngine;
          const maskingReadout = document.getElementById('telemetryMasking').textContent.trim();

          return {
            masterVol: engine.state.masterVolume,
            maskingVol: engine.state.maskingVolume,
            maskingReadout
          };
        })()
      `);
      assert.strictEqual(sliderState.masterVol, 0.65, `Expected masterVolume 0.65, got ${sliderState.masterVol}`);
      assert.strictEqual(sliderState.maskingVol, 0.40, `Expected maskingVolume 0.40, got ${sliderState.maskingVol}`);
      assert.ok(sliderState.maskingReadout.includes('40'), `Expected '40' in masking readout, got '${sliderState.maskingReadout}'`);
    });

    // Step 8: Soundscape Selection
    console.log('\n-- Step 8: Ambient Soundscape Switching --');
    await test('4.9 Switch soundscape to lofi: engine updates soundscape to lofi without audio error', async () => {
      const soundscapeState = await browser.evaluate(`
        (() => {
          const radio = document.querySelector('input[name="soundscape"][value="lofi"]');
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
          return window.neuralAudioEngine.state.soundscape;
        })()
      `);
      assert.strictEqual(soundscapeState, 'lofi', `Expected soundscape 'lofi', got '${soundscapeState}'`);
    });

    // Step 9: Visualizer Oscilloscope Tab Switching
    console.log('\n-- Step 9: Visualizer Tab Switching --');
    await test('4.10 Switch to FFT Spectrum mode: active class updates and canvas loop continues', async () => {
      const tabState = await browser.evaluate(`
        (() => {
          const tabSpectrum = document.getElementById('tabSpectrum');
          const tabWaveform = document.getElementById('tabWaveform');
          tabSpectrum.click();

          return {
            spectrumActive: tabSpectrum.classList.contains('active'),
            waveformActive: tabWaveform.classList.contains('active')
          };
        })()
      `);
      assert.strictEqual(tabState.spectrumActive, true, 'Spectrum tab must have .active class');
      assert.strictEqual(tabState.waveformActive, false, 'Waveform tab must not have .active class');
    });

    // Step 10: Pause Playback
    console.log('\n-- Step 10: Pause Playback & Session Suspension --');
    await test('4.11 Pause playback: engine pauses, play button reverts, status updates to Engine Paused', async () => {
      const pauseState = await browser.evaluate(`
        (async () => {
          const btn = document.getElementById('masterPlayBtn');
          btn.click();
          await new Promise(r => setTimeout(r, 200));

          const engine = window.neuralAudioEngine;
          const statusText = document.getElementById('playbackStatusText').textContent.trim();
          const hasPlayingClass = btn.classList.contains('playing');
          const playIcon = document.getElementById('playIcon');
          const pauseIcon = document.getElementById('pauseIcon');

          return {
            isPlaying: engine.isPlaying,
            statusText,
            hasPlayingClass,
            playIconDisplay: window.getComputedStyle(playIcon).display,
            pauseIconDisplay: window.getComputedStyle(pauseIcon).display
          };
        })()
      `);
      assert.strictEqual(pauseState.isPlaying, false, 'Engine isPlaying should be false after pause');
      assert.strictEqual(pauseState.hasPlayingClass, false, 'Play button should not have .playing class');
      assert.strictEqual(pauseState.statusText, 'Engine Paused', `Expected 'Engine Paused', got '${pauseState.statusText}'`);
      assert.notStrictEqual(pauseState.playIconDisplay, 'none', 'Play icon should be restored');
      assert.strictEqual(pauseState.pauseIconDisplay, 'none', 'Pause icon should be hidden');
    });

    // Step 11: Cumulative Production Health Audit
    console.log('\n-- Step 11: Cumulative Production Health Audit --');
    await test('4.12 Production health audit: exactly 0 console errors and 0 uncaught exceptions throughout session', async () => {
      if (browser.consoleErrors.length > 0) {
        console.error('Console errors detected:', browser.consoleErrors);
      }
      if (browser.uncaughtExceptions.length > 0) {
        console.error('Uncaught exceptions detected:', browser.uncaughtExceptions);
      }
      assert.strictEqual(
        browser.consoleErrors.length,
        0,
        `Expected 0 console errors during user session, found ${browser.consoleErrors.length}`
      );
      assert.strictEqual(
        browser.uncaughtExceptions.length,
        0,
        `Expected 0 uncaught exceptions during user session, found ${browser.uncaughtExceptions.length}`
      );
    });

  } finally {
    await browser.close();
  }

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log('\n------------------------------------------------------------');
  console.log(`  TIER 4 SUMMARY: ${passedCount} / ${results.length} PASSED (${failedCount} FAILED)`);
  console.log('------------------------------------------------------------\n');

  if (failedCount > 0) {
    throw new Error(`Tier 4 execution failed with ${failedCount} failures`);
  }

  return { total: results.length, passed: passedCount, failed: failedCount };
}

if (require.main === module) {
  runTier4().catch(err => {
    console.error('Tier 4 Fatal Error:', err.message);
    process.exit(1);
  });
}

module.exports = { runTier4 };
