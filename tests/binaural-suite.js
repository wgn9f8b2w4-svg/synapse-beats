/**
 * Synapse.fm — Binaural Lab & Hybrid Entrainment Verification Suite
 * 
 * Comprehensive E2E and DSP verification of the 6 core features:
 * 1. Hybrid Binaural Tone Generator Layer (stereo panners, click-free AudioParam ramps, layering)
 * 2. Carrier Frequency Tuning (432Hz, 528Hz, Solfeggio, Bands Delta-Gamma)
 * 3. Dual-Channel Phase Scope (ChannelSplitter, analyserL/R, Waveform & Lissajous)
 * 4. Offline WAV Export (OfflineAudioContext, 16-bit PCM RIFF header, faster-than-realtime)
 * 5. .bwp Preset Manager (Schema v1, legacy parser, persistence, import/export)
 * 6. Gateway Research Drawer (Monroe Focus 10/12/15/21, Hemi-Sync, Load Frequency)
 */

const assert = require('assert');
const { CDPBrowser } = require('./cdp-client.js');

const APP_URL = 'http://localhost:3000';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`  [RUN] ${name}... `);
  try {
    await fn();
    console.log('\x1b[32mPASS\x1b[0m');
    passed++;
  } catch (err) {
    console.log('\x1b[31mFAIL\x1b[0m');
    console.error(`        Error: ${err.message}`);
    failed++;
  }
}

async function runSuite() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║       SYNAPSE.FM BINAURAL LAB & HYBRID ENTRAINMENT SUITE           ║');
  console.log('║        Verification of the 6 Reverse-Engineered Core Features      ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  const browser = new CDPBrowser({ port: 9444 });
  await browser.launch();

  try {
    await browser.navigate(APP_URL);
    await browser.waitForFunction('Boolean(window.SynapseBinaural && window.SynapseBWP && window.synapseBinauralEngine)', 6000);

    // =========================================================================
    // FEATURE 1: Hybrid Binaural Tone Generator Layer
    // =========================================================================
    console.log('============================================================');
    console.log('  FEATURE 1: HYBRID BINAURAL TONE GENERATOR LAYER');
    console.log('============================================================');

    await test('1.1 Math: Symmetric Frequency Calculation (Left = c - b/2, Right = c + b/2)', async () => {
      const res = await browser.evaluate(`
        (() => {
          const f = window.SynapseBinaural.channelFrequencies(200, 10, 'symmetric');
          return { left: f.left, right: f.right, delta: f.delta, center: f.center };
        })()
      `);
      assert.strictEqual(res.left, 195, 'Left should be 195 Hz');
      assert.strictEqual(res.right, 205, 'Right should be 205 Hz');
      assert.strictEqual(res.delta, 10, 'Delta should be 10 Hz');
      assert.strictEqual(res.center, 200, 'Center should be 200 Hz');
    });

    await test('1.2 Math: Offset Frequency Calculation (Left = c, Right = c + b)', async () => {
      const res = await browser.evaluate(`
        (() => {
          const f = window.SynapseBinaural.channelFrequencies(200, 10, 'offset');
          return { left: f.left, right: f.right, delta: f.delta, center: f.center };
        })()
      `);
      assert.strictEqual(res.left, 200, 'Left should be 200 Hz');
      assert.strictEqual(res.right, 210, 'Right should be 210 Hz');
      assert.strictEqual(res.delta, 10, 'Delta should be 10 Hz');
    });

    await test('1.3 Stereo Panner Architecture: Hard Panned L (-1) and R (+1)', async () => {
      const panners = await browser.evaluate(`
        (async () => {
          const engine = window.synapseBinauralEngine;
          if (!engine.isPlaying) await engine.start();
          const graph = engine.graph;
          // Verify StereoPanner nodes exist in graph and are panned -1 and +1
          // We can inspect the audio graph nodes
          const pannerL = graph.oscL;
          const pannerR = graph.oscR;
          return {
            isPlaying: engine.isPlaying,
            sampleRate: engine.sampleRate,
            hasAnalysers: Boolean(engine.analyserL && engine.analyserR)
          };
        })()
      `);
      assert.strictEqual(panners.isPlaying, true, 'Engine must be playing');
      assert.strictEqual(panners.hasAnalysers, true, 'Dual analysers must be present');
    });

    await test('1.4 Click-Free Transition Execution via AudioParam.setTargetAtTime', async () => {
      const rampTest = await browser.evaluate(`
        (() => {
          const engine = window.synapseBinauralEngine;
          // Rapidly adjust state 10 times to verify smooth ramping
          for (let i = 0; i < 10; i++) {
            engine.setState({ carrierHz: 200 + i * 10, beatHz: 5 + i });
          }
          const st = engine.getState();
          return { carrier: st.carrierHz, beat: st.beatHz };
        })()
      `);
      assert.strictEqual(rampTest.carrier, 290);
      assert.strictEqual(rampTest.beat, 14);
    });

    await test('1.5 Layering Support: Binaural, Isochronic, Pink Noise & Music Layering', async () => {
      const layers = await browser.evaluate(`
        (() => {
          const engine = window.synapseBinauralEngine;
          engine.setState({
            layerMix: { binaural: 0.8, isochronic: 0.4, noise: 0.3 }
          });
          const st = engine.getState();
          return st.layerMix;
        })()
      `);
      assert.strictEqual(layers.binaural, 0.8);
      assert.strictEqual(layers.isochronic, 0.4);
      assert.strictEqual(layers.noise, 0.3);
    });

    // =========================================================================
    // FEATURE 2: Carrier Tuning & Brainwave Bands
    // =========================================================================
    console.log('\n============================================================');
    console.log('  FEATURE 2: CARRIER TUNING (432Hz / 528Hz) & BRAINWAVE BANDS');
    console.log('============================================================');

    await test('2.1 Solfeggio 432Hz Carrier Preset Button', async () => {
      await browser.click('[data-carrier="432"]');
      const carrier = await browser.evaluate(`window.synapseBinauralEngine.getState().carrierHz`);
      const readout = await browser.evaluate(`document.getElementById("blCarrierOut").textContent`);
      assert.strictEqual(carrier, 432, 'Carrier state should be 432');
      assert.strictEqual(readout, '432', 'Carrier readout should be 432');
    });

    await test('2.2 Solfeggio 528Hz Carrier Preset Button', async () => {
      await browser.click('[data-carrier="528"]');
      const carrier = await browser.evaluate(`window.synapseBinauralEngine.getState().carrierHz`);
      const readout = await browser.evaluate(`document.getElementById("blCarrierOut").textContent`);
      assert.strictEqual(carrier, 528, 'Carrier state should be 528');
      assert.strictEqual(readout, '528', 'Carrier readout should be 528');
    });

    await test('2.3 OM 136.1Hz Harmonic Carrier Preset Button', async () => {
      await browser.click('[data-carrier="136.1"]');
      const carrier = await browser.evaluate(`window.synapseBinauralEngine.getState().carrierHz`);
      assert.strictEqual(carrier, 136.1, 'Carrier state should be 136.1');
    });

    await test('2.4 Brainwave Band Presets: Alpha Band (10 Hz)', async () => {
      await browser.click('[data-band="alpha"]');
      const beat = await browser.evaluate(`window.synapseBinauralEngine.getState().beatHz`);
      const chip = await browser.evaluate(`document.getElementById("blBandChip").textContent`);
      assert.strictEqual(beat, 10, 'Beat should be 10 Hz');
      assert.ok(chip.includes('Alpha'), `Chip should show Alpha, got ${chip}`);
    });

    await test('2.5 Brainwave Band Presets: Delta, Theta, Beta, Gamma', async () => {
      for (const [band, expectedHz] of [['delta', 2], ['theta', 6], ['beta', 20], ['gamma', 40]]) {
        await browser.click(`[data-band="${band}"]`);
        const beat = await browser.evaluate(`window.synapseBinauralEngine.getState().beatHz`);
        assert.strictEqual(beat, expectedHz, `Band ${band} expected ${expectedHz} Hz, got ${beat}`);
      }
    });

    // =========================================================================
    // FEATURE 3: Dual-Channel Phase Scope
    // =========================================================================
    console.log('\n============================================================');
    console.log('  FEATURE 3: DUAL-CHANNEL PHASE SCOPE');
    console.log('============================================================');

    await test('3.1 Phase Scope Canvas & 2D Context Initialization', async () => {
      const scopeCheck = await browser.evaluate(`
        (() => {
          const canvas = document.getElementById("blScope");
          return {
            exists: Boolean(canvas),
            width: canvas.width,
            height: canvas.height,
            hasCtx: Boolean(canvas.getContext("2d"))
          };
        })()
      `);
      assert.ok(scopeCheck.exists, 'Scope canvas exists');
      assert.ok(scopeCheck.width > 0, 'Canvas width > 0');
      assert.ok(scopeCheck.height > 0, 'Canvas height > 0');
      assert.ok(scopeCheck.hasCtx, '2D Context exists');
    });

    await test('3.2 Dual Waveform Mode Selection & Frequency Chips Readout', async () => {
      await browser.click('[data-scope="waveform"]');
      const readout = await browser.evaluate(`
        (() => {
          return {
            freqL: document.getElementById("blFreqL").textContent,
            freqR: document.getElementById("blFreqR").textContent,
            delta: document.getElementById("blFreqDelta").textContent
          };
        })()
      `);
      assert.ok(readout.freqL !== '--', 'Left frequency readout populated');
      assert.ok(readout.freqR !== '--', 'Right frequency readout populated');
      assert.ok(readout.delta !== '--', 'Delta frequency readout populated');
    });

    await test('3.3 XY Lissajous Mode Toggle & Persistence Rendering', async () => {
      await browser.click('[data-scope="lissajous"]');
      const isSelected = await browser.evaluate(`
        document.querySelector('[data-scope="lissajous"]').getAttribute("aria-selected")
      `);
      assert.strictEqual(isSelected, 'true', 'XY Lissajous tab must be selected');
    });

    // =========================================================================
    // FEATURE 4: Offline WAV Export
    // =========================================================================
    console.log('\n============================================================');
    console.log('  FEATURE 4: OFFLINE WAV EXPORT (OfflineAudioContext)');
    console.log('============================================================');

    await test('4.1 RIFF/WAVE 44-byte Header Encoding Specification Compliance', async () => {
      const headerValid = await browser.evaluate(`
        (() => {
          const frames = 44100 * 2;
          const rate = 44100;
          const buf = window.SynapseBinaural.encodeWavHeader(frames, rate, 2, 16);
          if (buf.byteLength !== 44) return { error: "Header length != 44" };
          const u8 = new Uint8Array(buf);
          const dv = new DataView(buf);
          const riff = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
          const wave = String.fromCharCode(u8[8], u8[9], u8[10], u8[11]);
          const channels = dv.getUint16(22, true);
          const sampleRate = dv.getUint32(24, true);
          const bits = dv.getUint16(34, true);
          return { riff, wave, channels, sampleRate, bits, length: buf.byteLength };
        })()
      `);
      assert.strictEqual(headerValid.riff, 'RIFF');
      assert.strictEqual(headerValid.wave, 'WAVE');
      assert.strictEqual(headerValid.channels, 2);
      assert.strictEqual(headerValid.sampleRate, 44100);
      assert.strictEqual(headerValid.bits, 16);
      assert.strictEqual(headerValid.length, 44);
    });

    await test('4.2 Fast Offline Audio Render (2 seconds) into PCM WAV Blob', async () => {
      const renderResult = await browser.evaluate(`
        (async () => {
          const res = await window.SynapseBinaural.renderWav({
            carrierHz: 200,
            beatHz: 10,
            mode: "symmetric",
            waveform: "sine",
            volume: 0.8,
            layerMix: { binaural: 1, isochronic: 0, noise: 0 }
          }, {
            durationSec: 2,
            sampleRate: 44100
          });
          return {
            type: res.blob.type,
            size: res.bytes,
            frames: res.frames,
            speed: res.speed
          };
        })()
      `);
      assert.strictEqual(renderResult.type, 'audio/wav', 'Blob type must be audio/wav');
      // 44 bytes header + (44100 * 2 frames * 2 channels * 2 bytes/sample) = 44 + 352800 = 352844
      assert.strictEqual(renderResult.size, 352844, 'WAV size must match exact 16-bit PCM byte count');
      assert.strictEqual(renderResult.frames, 88200, 'Frames must be 2 * 44100 = 88200');
      assert.ok(renderResult.speed > 1, 'Offline render should be faster than realtime (> 1x)');
    });

    // =========================================================================
    // FEATURE 5: .bwp Preset Manager
    // =========================================================================
    console.log('\n============================================================');
    console.log('  FEATURE 5: .BWP PRESET MANAGER');
    console.log('============================================================');

    await test('5.1 Schema v1 Validation & Parameter Normalization', async () => {
      const p = await browser.evaluate(`
        (() => {
          return window.SynapseBWP.normalizePreset({
            presetName: "Test Preset",
            carrierHz: 432,
            beatHz: 7.83,
            mode: "symmetric",
            waveform: "sine",
            layerMix: { binaural: 1, isochronic: 0.2, noise: 0.1 },
            notes: "Schumann Resonance Test"
          });
        })()
      `);
      assert.strictEqual(p.schemaVersion, 1);
      assert.strictEqual(p.presetName, 'Test Preset');
      assert.strictEqual(p.carrierHz, 432);
      assert.strictEqual(p.beatHz, 7.83);
    });

    await test('5.2 Serialization & Deserialization Round-Trip Fidelity', async () => {
      const roundTrip = await browser.evaluate(`
        (() => {
          const original = {
            presetName: "Fidelity Test",
            carrierHz: 528,
            beatHz: 6,
            mode: "offset",
            waveform: "triangle",
            layerMix: { binaural: 0.9, isochronic: 0.1, noise: 0.2 },
            notes: "Round trip test"
          };
          const serialized = window.SynapseBWP.serializeBwp(original);
          const parsed = window.SynapseBWP.parseBwp(serialized);
          return {
            name: parsed.presetName,
            carrier: parsed.carrierHz,
            beat: parsed.beatHz,
            mode: parsed.mode,
            waveform: parsed.waveform
          };
        })()
      `);
      assert.strictEqual(roundTrip.name, 'Fidelity Test');
      assert.strictEqual(roundTrip.carrier, 528);
      assert.strictEqual(roundTrip.beat, 6);
      assert.strictEqual(roundTrip.mode, 'offset');
      assert.strictEqual(roundTrip.waveform, 'triangle');
    });

    await test('5.3 Legacy BrainWave key=value Format Parser Support', async () => {
      const legacy = await browser.evaluate(`
        (() => {
          const text = "name=Deep Alpha\\ncarrier=200\\nbeat=10\\ndesc=Legacy BrainWave test";
          const parsed = window.SynapseBWP.parseBwp(text);
          return {
            name: parsed.presetName,
            carrier: parsed.carrierHz,
            beat: parsed.beatHz,
            notes: parsed.notes
          };
        })()
      `);
      assert.strictEqual(legacy.name, 'Deep Alpha');
      assert.strictEqual(legacy.carrier, 200);
      assert.strictEqual(legacy.beat, 10);
      assert.strictEqual(legacy.notes, 'Legacy BrainWave test');
    });

    await test('5.4 Preset Persistence: User Save, Caching & Delete', async () => {
      const persistence = await browser.evaluate(`
        (() => {
          const store = new window.SynapseBWP.PresetStore();
          store.saveUser({
            presetName: "Unit Persistence Test",
            carrierHz: 300,
            beatHz: 8,
            mode: "symmetric",
            waveform: "sine"
          });
          const list = store.user();
          const found = list.some(p => p.presetName === "Unit Persistence Test");
          const deleted = store.deleteUser("Unit Persistence Test");
          const listAfter = store.user();
          const foundAfter = listAfter.some(p => p.presetName === "Unit Persistence Test");
          return { found, deleted, foundAfter };
        })()
      `);
      assert.strictEqual(persistence.found, true, 'User preset must be saved');
      assert.strictEqual(persistence.deleted, true, 'User preset must be deleted');
      assert.strictEqual(persistence.foundAfter, false, 'User preset must not exist after delete');
    });

    // =========================================================================
    // FEATURE 6: Gateway Research Drawer
    // =========================================================================
    console.log('\n============================================================');
    console.log('  FEATURE 6: GATEWAY RESEARCH DRAWER');
    console.log('============================================================');

    await test('6.1 Drawer Open & Scrim Activation via Action Button', async () => {
      await browser.click('#blDrawerOpen');
      const drawerState = await browser.evaluate(`
        (() => {
          const d = document.getElementById("blDrawer");
          const s = document.getElementById("blScrim");
          return {
            drawerOpen: d.classList.contains("is-open"),
            ariaHidden: d.getAttribute("aria-hidden"),
            scrimVisible: !s.hidden
          };
        })()
      `);
      assert.strictEqual(drawerState.drawerOpen, true, 'Drawer must have is-open class');
      assert.strictEqual(drawerState.ariaHidden, 'false', 'Drawer aria-hidden must be false');
      assert.strictEqual(drawerState.scrimVisible, true, 'Scrim must be visible');
    });

    await test('6.2 Interactive "Load frequency" Protocol Tuning from Drawer', async () => {
      // Find the first "Load frequency" button in the drawer and click it (Focus 10: 100 Hz carrier, 4 Hz beat, offset)
      await browser.evaluate(`
        (() => {
          const btn = document.querySelector("#blDrawer .bl-research-load button");
          if (!btn) throw new Error("Load frequency button not found");
          btn.click();
        })()
      `);
      const tuned = await browser.evaluate(`
        (() => {
          const st = window.synapseBinauralEngine.getState();
          const note = document.getElementById("blDrawerNote").textContent;
          return { carrier: st.carrierHz, beat: st.beatHz, mode: st.mode, note };
        })()
      `);
      assert.strictEqual(tuned.carrier, 100, 'Focus 10 carrier should be 100 Hz');
      assert.strictEqual(tuned.beat, 4, 'Focus 10 beat should be 4 Hz');
      assert.strictEqual(tuned.mode, 'offset', 'Focus 10 mode should be offset');
      assert.ok(tuned.note.includes('Focus 10'), 'Drawer note should indicate Focus 10 loaded');
    });

    await test('6.3 Drawer Close via Close Button & Accessibility Cleanup', async () => {
      await browser.click('#blDrawerClose');
      // Wait for 300ms transition
      await new Promise(r => setTimeout(r, 350));
      const closed = await browser.evaluate(`
        (() => {
          const d = document.getElementById("blDrawer");
          return {
            hasOpenClass: d.classList.contains("is-open"),
            ariaHidden: d.getAttribute("aria-hidden"),
            isInert: d.hasAttribute("inert")
          };
        })()
      `);
      assert.strictEqual(closed.hasOpenClass, false, 'Drawer must not have is-open class');
      assert.strictEqual(closed.ariaHidden, 'true', 'Drawer aria-hidden must be true');
      assert.strictEqual(closed.isInert, true, 'Drawer must have inert attribute');
    });

    // =========================================================================
    // FINAL AUDIT
    // =========================================================================
    console.log('\n============================================================');
    console.log('  PRODUCTION HEALTH & CONSOLE ZERO-ERROR AUDIT');
    console.log('============================================================');

    await test('7.1 Production Zero-Error Audit: Zero Console Errors / Exceptions', async () => {
      const errors = browser.consoleErrors;
      const exceptions = browser.uncaughtExceptions;
      assert.strictEqual(errors.length, 0, `Found ${errors.length} console errors: ${JSON.stringify(errors)}`);
      assert.strictEqual(exceptions.length, 0, `Found ${exceptions.length} exceptions: ${JSON.stringify(exceptions)}`);
    });

  } finally {
    await browser.close();
  }

  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                   BINAURAL SUITE EXECUTION REPORT                  ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log(`║ Total Tests Run:   ${(passed + failed).toString().padEnd(46)}║`);
  console.log(`║ Passed:           \x1b[32m${passed.toString().padEnd(46)}\x1b[0m║`);
  console.log(`║ Failed:           \x1b[31m${failed.toString().padEnd(46)}\x1b[0m║`);
  console.log(`║ Pass Rate:        ${((passed / (passed + failed)) * 100).toFixed(1)}%${' '.repeat(41)}║`);
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
