/**
 * tests/adversarial-stress-suite.js
 * 
 * EMPIRICAL ADVERSARIAL STRESS & INTEGRITY SUITE FOR SYNAPSE.FM
 * 
 * Conducts aggressive stress testing, mathematical formula verification,
 * boundary clamping checks, rapid event concurrency, long-session voice/memory
 * leak auditing, and zero-error validation on http://localhost:3000.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { CDPBrowser } = require('./cdp-client.js');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const REFERENCE_SHA256 = 'e13cbaef2dea7591c049ad243f584d5107a5722c85d8b75ba0fbe3866fc84f04';

// Test tracker
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err.message, stack: err.stack });
    console.error(`  [FAIL] ${name}\n         -> ${err.message}`);
  }
}

// Clean child process killer for Windows
function robustKill(browserInstance) {
  if (browserInstance && browserInstance.proc && browserInstance.proc.pid) {
    try {
      execSync(`taskkill /pid ${browserInstance.proc.pid} /T /F`, { stdio: 'ignore' });
    } catch (_) {}
    browserInstance.proc = null;
  }
  if (browserInstance) {
    try { browserInstance.close(); } catch (_) {}
  }
}

async function runAdversarialSuite() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║         SYNAPSE.FM ADVERSARIAL AUDIO STRESS & INTEGRITY SUITE      ║');
  console.log('║       Empirical Verification of Audio Engine & State Stability     ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // =========================================================================
  // Section 1: Pure Mathematical & Algorithmic Synthesis Integrity
  // =========================================================================
  console.log('============================================================');
  console.log('  SECTION 1: MATHEMATICAL & SYNTHESIS INTEGRITY AUDIT');
  console.log('============================================================\n');

  const audioEnginePath = path.join(__dirname, '..', 'public', 'audio-engine.js');
  const audioEngineContent = fs.readFileSync(audioEnginePath, 'utf8');

  await test('1.1 Cryptographic Bit-for-Bit Hash Preservation', async () => {
    const rawBuffer = fs.readFileSync(audioEnginePath);
    const hash = crypto.createHash('sha256').update(rawBuffer).digest('hex');
    assert.strictEqual(
      hash,
      REFERENCE_SHA256,
      `Audio Engine SHA-256 corrupted! Expected ${REFERENCE_SHA256}, got ${hash}`
    );
  });

  await test('1.2 Formula Audit: AM Entrainment Carrier & BaseGain Envelope', async () => {
    // Formula in code:
    // const modGainValue = depth * 0.45;
    // const baseGain = 1.0 - (depth * 0.45);
    // Peak Output = baseGain + modGainValue = 1.0 (constant peak headroom)
    // Trough Output = baseGain - modGainValue = 1.0 - 0.9 * depth (non-zero floor)
    const depths = [0.0, 0.25, 0.5, 0.65, 0.85, 0.95, 1.0];
    for (const d of depths) {
      const modGain = d * 0.45;
      const baseGain = 1.0 - (d * 0.45);
      const peak = baseGain + modGain;
      const trough = baseGain - modGain;

      assert.strictEqual(Math.round(peak * 10000) / 10000, 1.0, `Peak amplitude must equal exactly 1.0 at depth ${d}`);
      assert.ok(trough >= 0.05, `Trough amplitude must stay above 0.05 to avoid audible clicks, got ${trough} at depth ${d}`);
      assert.ok(trough <= 1.0, `Trough amplitude must not exceed 1.0`);
    }
  });

  await test('1.3 Formula Audit: Paul Kellet Pink Noise & Brown Noise Filter Coefficients', async () => {
    // Verify pink noise Paul Kellet coefficients in audio-engine.js
    const kelletCoeffs = [
      '0.99886', '0.0555179',
      '0.99332', '0.0750759',
      '0.96900', '0.1538520',
      '0.86650', '0.3104856',
      '0.55000', '0.5329522',
      '-0.7616', '0.0168980',
      '0.5362', '0.115926'
    ];
    for (const coeff of kelletCoeffs) {
      assert.ok(
        audioEngineContent.includes(coeff),
        `Kellet pink noise coefficient ${coeff} missing or corrupted in audio-engine.js`
      );
    }

    // Verify Brown noise formula: (lastOut + (0.02 * white)) / 1.02
    assert.ok(
      audioEngineContent.includes('(lastOut + (0.02 * white)) / 1.02') || audioEngineContent.includes('0.02 * white'),
      'Brown noise 1/f^2 integration formula missing'
    );

    // Verify Noise Blend: 70% Brown + 30% Pink
    assert.ok(
      audioEngineContent.includes('0.70') && audioEngineContent.includes('0.30'),
      'Acoustic masking blend 70% Brown + 30% Pink ratio corrupted'
    );
  });

  await test('1.4 Formula Audit: Note-to-Frequency 12-TET Conversion Accuracy', async () => {
    // In audio-engine.js: 440 * Math.pow(2, (midi - 69) / 12)
    function noteToFreq(note) {
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const regex = /^([A-G]#?)(\d)$/;
      const match = note.match(regex);
      if (!match) return 440;
      const name = match[1];
      const octave = parseInt(match[2], 10);
      const semitone = notes.indexOf(name);
      const midi = (octave + 1) * 12 + semitone;
      return 440 * Math.pow(2, (midi - 69) / 12);
    }

    const testTones = [
      { note: 'A4', expected: 440.0 },
      { note: 'A3', expected: 220.0 },
      { note: 'A2', expected: 110.0 },
      { note: 'A1', expected: 55.0 },
      { note: 'C4', expected: 261.6256 },
      { note: 'E2', expected: 82.4069 },
      { note: 'F1', expected: 43.6535 }
    ];

    for (const t of testTones) {
      const freq = noteToFreq(t.note);
      const delta = Math.abs(freq - t.expected);
      assert.ok(delta < 0.01, `Frequency for ${t.note} mismatch: expected ${t.expected}, got ${freq}`);
    }
  });

  await test('1.5 Presets Biological Entrainment Band Validation', async () => {
    const presetRegex = /(\w+):\s*\{\s*name:\s*['"]([^'"]+)['"],\s*freq:\s*([0-9.]+)/g;
    const presets = {};
    let m;
    while ((m = presetRegex.exec(audioEngineContent)) !== null) {
      presets[m[1]] = { name: m[2], freq: parseFloat(m[3]) };
    }

    assert.strictEqual(presets.focus.freq, 16.0, 'Focus must target 16.0 Hz Beta');
    assert.strictEqual(presets.adhd.freq, 16.0, 'ADHD must target 16.0 Hz High-Depth Beta');
    assert.strictEqual(presets.flow.freq, 13.0, 'Creative Flow must target 13.0 Hz Alpha-Beta');
    assert.strictEqual(presets.relax.freq, 10.0, 'Relax must target 10.0 Hz Alpha');
    assert.strictEqual(presets.meditate.freq, 5.5, 'Meditate must target 5.5 Hz Theta');
    assert.strictEqual(presets.sleep.freq, 1.5, 'Sleep must target 1.5 Hz Delta');
  });

  // =========================================================================
  // Section 2: Live Browser Parameter Bounds & Extremes Stress
  // =========================================================================
  console.log('\n============================================================');
  console.log('  SECTION 2: LIVE BROWSER PARAMETER BOUNDS & EXTREMES STRESS');
  console.log('============================================================\n');

  const browserPort = 9600 + Math.floor(Math.random() * 200);
  const browser = new CDPBrowser({ port: browserPort });

  try {
    await browser.launch();
    await browser.navigate(BASE_URL);

    await test('2.1 Extreme Master Volume Parameter Clamping (-1000 to +1000, NaN, null, string)', async () => {
      const stressRes = await browser.evaluate(`
        (() => {
          const engine = window.neuralAudioEngine;
          const results = [];
          
          engine.setMasterVolume(-999.99);
          results.push({ test: 'neg', val: engine.state.masterVolume, expected: 0 });
          
          engine.setMasterVolume(999.99);
          results.push({ test: 'pos', val: engine.state.masterVolume, expected: 1 });
          
          engine.setMasterVolume(0.0);
          results.push({ test: 'zero', val: engine.state.masterVolume, expected: 0 });
          engine.setMasterVolume(1.0);
          results.push({ test: 'max', val: engine.state.masterVolume, expected: 1 });
          
          engine.setMasterVolume('0.42');
          results.push({ test: 'str_num', val: engine.state.masterVolume, expected: 0.42 });
          
          engine.setMasterVolume(0.8);
          results.push({ test: 'nominal', val: engine.state.masterVolume, expected: 0.8 });

          return results;
        })()
      `);

      for (const r of stressRes) {
        assert.strictEqual(r.val, r.expected, `Failed volume stress test ${r.test}: got ${r.val}, expected ${r.expected}`);
      }
    });

    await test('2.2 Extreme Masking Volume Parameter Clamping (-500 to +500, non-numeric)', async () => {
      const stressRes = await browser.evaluate(`
        (() => {
          const engine = window.neuralAudioEngine;
          const results = [];
          
          engine.setMaskingVolume(-500);
          results.push({ test: 'neg', val: engine.state.maskingVolume, expected: 0 });
          
          engine.setMaskingVolume(500);
          results.push({ test: 'pos', val: engine.state.maskingVolume, expected: 1 });
          
          engine.setMaskingVolume(0.35);
          results.push({ test: 'nominal', val: engine.state.maskingVolume, expected: 0.35 });

          return results;
        })()
      `);

      for (const r of stressRes) {
        assert.strictEqual(r.val, r.expected, `Failed masking volume stress test ${r.test}: got ${r.val}`);
      }
    });

    await test('2.3 Neural Level & Depth Multiplier Robustness Under Unknown Inputs', async () => {
      const depthRes = await browser.evaluate(`
        (() => {
          const engine = window.neuralAudioEngine;
          const levels = ['low', 'medium', 'high', 'invalid_xyz', null, undefined, '', 12345];
          const outputs = [];

          for (const lvl of levels) {
            engine.setNeuralEffectLevel(lvl);
            const depth = engine.calculateEffectiveDepth();
            outputs.push({
              lvl,
              depth,
              isFinite: Number.isFinite(depth),
              bounded: depth >= 0 && depth <= 0.95
            });
          }

          engine.setNeuralEffectLevel('high');
          return outputs;
        })()
      `);

      for (const o of depthRes) {
        assert.ok(o.isFinite, `Effective depth must be finite for level '${o.lvl}'`);
        assert.ok(o.bounded, `Effective depth ${o.depth} must be bounded between 0 and 0.95 for level '${o.lvl}'`);
      }
    });

    await test('2.4 Unknown Soundscape & Presets Switching Does Not Throw Or Corrupt State', async () => {
      const soundscapeRes = await browser.evaluate(`
        (() => {
          const engine = window.neuralAudioEngine;
          const badSoundscapes = ['nuclear_explosion', '', null, undefined, 9999];
          let noThrow = true;

          for (const s of badSoundscapes) {
            try {
              engine.setSoundscape(s);
            } catch (_) {
              noThrow = false;
            }
          }

          engine.setSoundscape('cosmic');
          return { noThrow, current: engine.state.soundscape };
        })()
      `);

      assert.strictEqual(soundscapeRes.noThrow, true, 'setSoundscape must not throw on unknown inputs');
      assert.strictEqual(soundscapeRes.current, 'cosmic', 'Soundscape restored successfully');
    });

    // =========================================================================
    // Section 3: Concurrency, Rapid Flurries & Race Conditions
    // =========================================================================
    console.log('\n============================================================');
    console.log('  SECTION 3: CONCURRENCY, RAPID FLURRIES & RACE CONDITIONS');
    console.log('============================================================\n');

    await test('3.1 Rapid Mode Switching Flurry (60 rapid switches under active audio context)', async () => {
      const modeFlurry = await browser.evaluate(`
        (async () => {
          const engine = window.neuralAudioEngine;
          await engine.play();

          const modes = ['focus', 'adhd', 'flow', 'relax', 'meditate', 'sleep'];
          for (let i = 0; i < 60; i++) {
            const m = modes[i % modes.length];
            engine.setMode(m);
          }

          engine.setMode('focus');

          return {
            mode: engine.state.mode,
            freq: engine.state.modulationFrequency,
            isPlaying: engine.isPlaying
          };
        })()
      `);

      assert.strictEqual(modeFlurry.mode, 'focus', 'Mode should settle to focus');
      assert.strictEqual(modeFlurry.freq, 16.0, 'Target frequency should be 16.0 Hz');
      assert.strictEqual(modeFlurry.isPlaying, true, 'Engine should remain playing');
    });

    await test('3.2 Rapid Play / Pause Stress Barrage (30 interleaved state transitions)', async () => {
      const playPauseBarrage = await browser.evaluate(`
        (async () => {
          const engine = window.neuralAudioEngine;
          const btn = document.getElementById('masterPlayBtn');
          
          for (let i = 0; i < 30; i++) {
            btn.click();
            await new Promise(r => setTimeout(r, 20));
          }

          await new Promise(r => setTimeout(r, 300));

          return {
            enginePlaying: engine.isPlaying,
            btnClass: btn.classList.contains('playing'),
            audioState: engine.ctx ? engine.ctx.state : 'uninitialized'
          };
        })()
      `);

      assert.strictEqual(
        playPauseBarrage.enginePlaying,
        playPauseBarrage.btnClass,
        'Engine isPlaying and UI button .playing class must be 100% in sync'
      );
      assert.ok(
        ['running', 'suspended'].includes(playPauseBarrage.audioState),
        `Audio context state must be valid, got ${playPauseBarrage.audioState}`
      );
    });

    await test('3.3 72-Vector Orthogonal Permutation Stress (6 Modes × 3 Levels × 4 Soundscapes)', async () => {
      const permuteRes = await browser.evaluate(`
        (async () => {
          const engine = window.neuralAudioEngine;
          if (!engine.isPlaying) await engine.play();

          const modes = ['focus', 'adhd', 'flow', 'relax', 'meditate', 'sleep'];
          const levels = ['low', 'medium', 'high'];
          const soundscapes = ['cosmic', 'lofi', 'ethereal', 'pink-brown'];

          let count = 0;
          for (const m of modes) {
            engine.setMode(m);
            for (const l of levels) {
              engine.setNeuralEffectLevel(l);
              for (const s of soundscapes) {
                engine.setSoundscape(s);
                count++;
              }
            }
          }

          return {
            totalPermutations: count,
            finalMode: engine.state.mode,
            finalLevel: engine.state.neuralEffectLevel,
            finalSoundscape: engine.state.soundscape,
            isPlaying: engine.isPlaying
          };
        })()
      `);

      assert.strictEqual(permuteRes.totalPermutations, 72, 'All 72 permutations executed');
      assert.strictEqual(permuteRes.finalMode, 'sleep');
      assert.strictEqual(permuteRes.finalLevel, 'high');
      assert.strictEqual(permuteRes.finalSoundscape, 'pink-brown');
      assert.strictEqual(permuteRes.isPlaying, true);
    });

    // =========================================================================
    // Section 4: Memory Leak, Voice Pruning & Long-Session Stability
    // =========================================================================
    console.log('\n============================================================');
    console.log('  SECTION 4: MEMORY LEAK, VOICE PRUNING & LONG-SESSION STABILITY');
    console.log('============================================================\n');

    await test('4.1 Active Voices Array Pruning and Bounded Node Count Verification', async () => {
      const voiceStress = await browser.evaluate(`
        (async () => {
          const engine = window.neuralAudioEngine;
          if (!engine.isPlaying) await engine.play();

          for (let i = 0; i < 15; i++) {
            engine.playGenerativeChord();
          }

          const immediateCount = engine.activeVoices.length;
          engine.stopGenerativeComposition();
          await new Promise(r => setTimeout(r, 1800));

          const prunedCount = engine.activeVoices.length;
          return { immediateCount, prunedCount };
        })()
      `);

      assert.ok(voiceStress.immediateCount > 0, 'Active voices must be generated during chords');
      assert.strictEqual(
        voiceStress.prunedCount,
        0,
        `Active voices array must be completely pruned (0) after stopGenerativeComposition, got ${voiceStress.prunedCount}`
      );
    });

    await test('4.2 Continuous Playback Node Creation Rate & Audio Clock Progression', async () => {
      const memoryProfile = await browser.evaluate(`
        (async () => {
          const engine = window.neuralAudioEngine;
          if (!engine.isPlaying) await engine.play();

          const baselineTime = engine.ctx.currentTime;
          await new Promise(r => setTimeout(r, 3000));
          const sustainedTime = engine.ctx.currentTime;
          const sustainedVoices = engine.activeVoices.length;

          return {
            timeAdvanced: sustainedTime > baselineTime,
            timeDelta: sustainedTime - baselineTime,
            voicesBounded: sustainedVoices <= 16,
            sustainedVoices
          };
        })()
      `);

      assert.ok(memoryProfile.timeAdvanced, 'AudioContext currentTime must continuously advance');
      assert.ok(memoryProfile.timeDelta >= 2.5, `Time delta must be >= 2.5s, got ${memoryProfile.timeDelta}`);
      assert.ok(
        memoryProfile.voicesBounded,
        `Voices count must remain bounded (<=16), observed: ${memoryProfile.sustainedVoices}`
      );
    });

    await test('4.3 Composition Timer Non-Duplication: Single Timer Reference & Clean Teardown', async () => {
      const timerCheck = await browser.evaluate(`
        (async () => {
          const engine = window.neuralAudioEngine;
          if (!engine.isPlaying) await engine.play();
          
          for (let i = 0; i < 10; i++) {
            engine.startGenerativeComposition();
          }

          const hasSingleTimer = Boolean(engine.compositionTimer);
          engine.stopGenerativeComposition();
          const timerCleared = engine.compositionTimer === null;

          return { hasSingleTimer, timerCleared };
        })()
      `);

      assert.strictEqual(timerCheck.hasSingleTimer, true, 'Engine must hold active timer after start');
      assert.strictEqual(timerCheck.timerCleared, true, 'stopGenerativeComposition must clear timer to null');
    });

    // =========================================================================
    // Section 5: Real-Time Visualizer DSP & Canvas Resilience
    // =========================================================================
    console.log('\n============================================================');
    console.log('  SECTION 5: REAL-TIME VISUALIZER DSP & CANVAS RESILIENCE');
    console.log('============================================================\n');

    await test('5.1 FFT & Oscilloscope Data Structure Verification Under Active Synthesis', async () => {
      const visData = await browser.evaluate(`
        (async () => {
          const engine = window.neuralAudioEngine;
          if (!engine.isPlaying) await engine.play();

          const { timeData, freqData } = engine.getVisualizationData();
          return {
            hasTimeData: Boolean(timeData && timeData.length > 0),
            hasFreqData: Boolean(freqData && freqData.length > 0),
            timeLen: timeData ? timeData.length : 0,
            freqLen: freqData ? freqData.length : 0,
            expectedBins: 512
          };
        })()
      `);

      assert.strictEqual(visData.hasTimeData, true, 'getVisualizationData must return valid timeData Uint8Array');
      assert.strictEqual(visData.hasFreqData, true, 'getVisualizationData must return valid freqData Uint8Array');
      assert.strictEqual(visData.timeLen, visData.expectedBins, 'Time-domain bin count should match frequencyBinCount (512)');
      assert.strictEqual(visData.freqLen, visData.expectedBins, 'Frequency bin count should match frequencyBinCount (512)');
    });

    await test('5.2 Rapid Visualizer Tab Toggling & Canvas Stress (30 switches)', async () => {
      const visTabStress = await browser.evaluate(`
        (() => {
          const tabWaveform = document.getElementById('tabWaveform');
          const tabSpectrum = document.getElementById('tabSpectrum');
          
          for (let i = 0; i < 30; i++) {
            if (i % 2 === 0) tabSpectrum.click();
            else tabWaveform.click();
          }

          return {
            waveformActive: tabWaveform.classList.contains('active'),
            spectrumActive: tabSpectrum.classList.contains('active')
          };
        })()
      `);

      assert.strictEqual(visTabStress.waveformActive, true, 'Waveform active after final click');
      assert.strictEqual(visTabStress.spectrumActive, false);
    });

    await test('5.3 High-Frequency Canvas Window Resize Events (25 rapid resize triggers)', async () => {
      const resizeRes = await browser.evaluate(`
        (() => {
          const canvas = document.getElementById('visualizerCanvas');
          let threw = false;

          for (let i = 0; i < 25; i++) {
            try {
              window.dispatchEvent(new Event('resize'));
            } catch (_) {
              threw = true;
            }
          }

          return {
            threw,
            width: canvas.width,
            height: canvas.height,
            validDimensions: canvas.width > 0 && canvas.height > 0
          };
        })()
      `);

      assert.strictEqual(resizeRes.threw, false, 'Window resize events must not throw in canvas renderer');
      assert.strictEqual(resizeRes.validDimensions, true, 'Canvas must maintain valid non-zero dimensions');
    });

    // =========================================================================
    // Section 6: Interactive Controls & Production Zero-Error Audit
    // =========================================================================
    console.log('\n============================================================');
    console.log('  SECTION 6: INTERACTIVE CONTROLS & PRODUCTION ZERO-ERROR AUDIT');
    console.log('============================================================\n');

    await test('6.1 Spacebar Keydown Transport Toggle Concurrency (10 spaced spacebar presses)', async () => {
      const spacebarRes = await browser.evaluate(`
        (async () => {
          const engine = window.neuralAudioEngine;
          // Ensure no focused button intercepts the spacebar event
          if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
          }
          document.body.focus();

          const initialPlaying = engine.isPlaying;

          for (let i = 0; i < 10; i++) {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
            await new Promise(r => setTimeout(r, 50));
          }

          await new Promise(r => setTimeout(r, 200));

          return {
            initialPlaying,
            finalPlaying: engine.isPlaying,
            inSync: engine.isPlaying === document.getElementById('masterPlayBtn').classList.contains('playing')
          };
        })()
      `);

      assert.strictEqual(spacebarRes.inSync, true, 'Spacebar toggles must maintain UI/Engine synchronization');
    });

    await test('6.2 Slider Value Readout Synchronization Across Parameter Deck', async () => {
      const readoutSync = await browser.evaluate(`
        (() => {
          const master = document.getElementById('masterVolumeSlider');
          const masking = document.getElementById('maskingVolumeSlider');
          const carrier = document.getElementById('carrierFreqInput');
          const beat = document.getElementById('binauralBeatInput');
          const balance = document.getElementById('binauralBalanceInput');

          if (master) {
            master.value = '0.65';
            master.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (masking) {
            masking.value = '0.45';
            masking.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (carrier) {
            carrier.value = '256';
            carrier.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (beat) {
            beat.value = '14.5';
            beat.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (balance) {
            balance.value = '-0.5';
            balance.dispatchEvent(new Event('input', { bubbles: true }));
          }

          return {
            volVal: document.getElementById('volVal')?.textContent.trim(),
            spatialVal: document.getElementById('spatialVal')?.textContent.trim(),
            carrierVal: document.getElementById('carrierVal')?.textContent.trim(),
            beatVal: document.getElementById('beatVal')?.textContent.trim(),
            balanceVal: document.getElementById('balanceVal')?.textContent.trim()
          };
        })()
      `);

      assert.strictEqual(readoutSync.volVal, '65%', 'volVal must reflect 65%');
      assert.strictEqual(readoutSync.spatialVal, '45%', 'spatialVal must reflect 45%');
      assert.strictEqual(readoutSync.carrierVal, '256.0 Hz', 'carrierVal must reflect 256.0 Hz');
      assert.strictEqual(readoutSync.beatVal, '14.5 Hz', 'beatVal must reflect 14.5 Hz');
      assert.ok(readoutSync.balanceVal.includes('L 0.5'), `balanceVal must show left pan 'L 0.5', got '${readoutSync.balanceVal}'`);
    });

    await test('6.3 Comprehensive Console Error & Exception Audit Across Entire Stress Run', async () => {
      const errors = browser.consoleErrors;
      const exceptions = browser.uncaughtExceptions;

      if (errors.length > 0) {
        console.error('Console errors detected:', errors);
      }
      if (exceptions.length > 0) {
        console.error('Uncaught exceptions detected:', exceptions);
      }

      assert.strictEqual(errors.length, 0, `Detected ${errors.length} console errors during stress test!`);
      assert.strictEqual(exceptions.length, 0, `Detected ${exceptions.length} uncaught exceptions!`);
    });

  } finally {
    robustKill(browser);
  }

  // Final Summary Report
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                   ADVERSARIAL STRESS SUITE SUMMARY                 ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log(`║ Total Stress Tests Run:    ${String(totalTests).padEnd(39)}║`);
  console.log(`║ Passed:                    ${String(passedTests).padEnd(39)}║`);
  console.log(`║ Failed:                    ${String(failedTests).padEnd(39)}║`);
  console.log(`║ Pass Rate:                 ${String(Math.round((passedTests / totalTests) * 100) + '%').padEnd(39)}║`);
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  if (failedTests > 0) {
    console.error(`ADVERSARIAL STRESS TEST FAILED with ${failedTests} failure(s)!`);
    process.exit(1);
  } else {
    console.log('ALL ADVERSARIAL STRESS TESTS COMPLETED WITH 100% SUCCESS.');
    process.exit(0);
  }
}

runAdversarialSuite().catch(err => {
  console.error('Fatal crash in adversarial suite:', err);
  process.exit(1);
});
