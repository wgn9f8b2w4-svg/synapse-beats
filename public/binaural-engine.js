/**
 * Synapse.fm Binaural Engine
 *
 * 1. Live hybrid layer: stereo oscillator pair (hard-panned L/R) + optional
 *    isochronic pulse + seamless pink-noise bed, all click-free (setTargetAtTime).
 * 2. Carrier / beat tuning maths (symmetric or offset mode).
 * 3. Dual-channel analysers (ChannelSplitter -> analyserL / analyserR).
 * 4. Faster-than-realtime OfflineAudioContext renderer (phase-continuous chunks)
 *    + 16-bit PCM RIFF/WAVE encoder.
 *
 * The live and offline paths share one graph builder (buildGraph), so an
 * exported file is the same signal chain you hear.
 */
(function (global) {
  'use strict';

  const LIMITS = Object.freeze({ carrierMin: 50, carrierMax: 1000, beatMin: 0.1, beatMax: 100 });
  const WAVEFORMS = Object.freeze(['sine', 'triangle', 'square', 'sawtooth']);
  const MODES = Object.freeze(['symmetric', 'offset']);
  const WAVE_SCALE = Object.freeze({ sine: 1, triangle: 0.95, square: 0.45, sawtooth: 0.55 });
  const MIN_HZ = 20;
  const SMOOTH_TC = 0.04; // seconds, setTargetAtTime time constant

  const BANDS = Object.freeze([
    { id: 'delta', label: 'Delta', min: 0, max: 4 },
    { id: 'theta', label: 'Theta', min: 4, max: 8 },
    { id: 'alpha', label: 'Alpha', min: 8, max: 14 },
    { id: 'beta', label: 'Beta', min: 14, max: 30 },
    { id: 'gamma', label: 'Gamma', min: 30, max: Infinity }
  ]);

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

  function bandForBeat(beatHz) {
    return BANDS.find((b) => beatHz < b.max) || BANDS[BANDS.length - 1];
  }

  /** Left/right oscillator frequencies for a carrier + beat pair. */
  function channelFrequencies(carrierHz, beatHz, mode) {
    const l = mode === 'offset' ? carrierHz : carrierHz - beatHz / 2;
    const r = mode === 'offset' ? carrierHz + beatHz : carrierHz + beatHz / 2;
    const left = Math.max(MIN_HZ, l);
    const right = Math.max(MIN_HZ, r);
    return { left, right, center: (left + right) / 2, delta: right - left };
  }

  /** Sets an AudioParam smoothly from wherever it currently is (no zipper noise, no jumps). */
  function smoothSet(param, value, ctx, tc) {
    const t = ctx.currentTime;
    if (typeof param.cancelAndHoldAtTime === 'function') {
      param.cancelAndHoldAtTime(t);
    } else {
      const cur = param.value;
      param.cancelScheduledValues(t);
      param.setValueAtTime(cur, t);
    }
    param.setTargetAtTime(value, t, tc === undefined ? SMOOTH_TC : tc);
  }

  // ---------------------------------------------------------------------------
  // Phase-controllable periodic waves (needed for phase-continuous offline chunks)
  // ---------------------------------------------------------------------------
  const HARMONICS = 128;

  function harmonicSeries(type) {
    const a = new Float32Array(HARMONICS + 1);
    for (let n = 1; n <= HARMONICS; n++) {
      if (type === 'sine') a[n] = n === 1 ? 1 : 0;
      else if (type === 'square') a[n] = n % 2 ? 4 / (Math.PI * n) : 0;
      else if (type === 'triangle') a[n] = n % 2 ? ((8 / (Math.PI * Math.PI * n * n)) * (((n - 1) / 2) % 2 === 0 ? 1 : -1)) : 0;
      else a[n] = ((2 / (Math.PI * n)) * (n % 2 ? 1 : -1)); // sawtooth
    }
    return a;
  }

  /** sin(w t + phase) style wave: each harmonic n is rotated by n * phase. */
  function createPhasedWave(ctx, type, phaseRad) {
    const series = harmonicSeries(type);
    const real = new Float32Array(HARMONICS + 1);
    const imag = new Float32Array(HARMONICS + 1);
    for (let n = 1; n <= HARMONICS; n++) {
      const amp = series[n];
      if (!amp) continue;
      imag[n] = amp * Math.cos(n * phaseRad);
      real[n] = amp * Math.sin(n * phaseRad);
    }
    return ctx.createPeriodicWave(real, imag);
  }

  // ---------------------------------------------------------------------------
  // Seamless pink-noise loop (Paul Kellet filter + equal-power loop crossfade)
  // ---------------------------------------------------------------------------
  function makePinkLoopBuffer(sampleRate, ctxFactory, seconds) {
    const n = Math.floor(sampleRate * (seconds || 8));
    const xf = Math.floor(sampleRate * 0.5);
    const raw = new Float32Array(n + xf);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < raw.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
    }
    const out = new Float32Array(n);
    out.set(raw.subarray(0, n));
    for (let i = 0; i < xf; i++) {
      const p = (i / xf) * (Math.PI / 2);
      out[i] = raw[i] * Math.sin(p) + raw[n + i] * Math.cos(p);
    }
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
    const norm = peak > 0 ? 0.8 / peak : 1;
    for (let i = 0; i < n; i++) out[i] *= norm;

    const buf = typeof global.AudioBuffer === 'function'
      ? new global.AudioBuffer({ length: n, sampleRate, numberOfChannels: 1 })
      : ctxFactory().createBuffer(1, n, sampleRate);
    buf.copyToChannel(out, 0);
    return buf;
  }

  // ---------------------------------------------------------------------------
  // Parameter normalisation
  // ---------------------------------------------------------------------------
  function normalizeParams(raw) {
    const p = raw || {};
    const mix = p.layerMix || {};
    return {
      carrierHz: clamp(num(p.carrierHz, 200), LIMITS.carrierMin, LIMITS.carrierMax),
      beatHz: clamp(num(p.beatHz, 10), LIMITS.beatMin, LIMITS.beatMax),
      mode: MODES.includes(p.mode) ? p.mode : 'symmetric',
      waveform: WAVEFORMS.includes(p.waveform) ? p.waveform : 'sine',
      volume: clamp(num(p.volume, 0.6), 0, 1),
      layerMix: {
        binaural: clamp(num(mix.binaural, 1), 0, 1),
        isochronic: clamp(num(mix.isochronic, 0), 0, 1),
        noise: clamp(num(mix.noise, 0), 0, 1)
      }
    };
  }

  function levels(p) {
    return {
      binaural: p.layerMix.binaural * 0.5 * (WAVE_SCALE[p.waveform] || 1),
      isochronic: p.layerMix.isochronic * 0.35,
      noise: p.layerMix.noise * 0.5
    };
  }

  // ---------------------------------------------------------------------------
  // Shared graph builder (live + offline)
  // ---------------------------------------------------------------------------
  function buildGraph(ctx, p, opts) {
    const live = !!opts.live;
    const t0 = opts.t0 || 0;
    const f = channelFrequencies(p.carrierHz, p.beatHz, p.mode);
    const lv = levels(p);
    const oscs = [];

    function makeOsc(freq, type) {
      const o = ctx.createOscillator();
      o.frequency.value = freq;
      if (live) o.type = type;
      else o.setPeriodicWave(createPhasedWave(ctx, type, 2 * Math.PI * ((freq * t0) % 1)));
      oscs.push(o);
      return o;
    }

    const master = ctx.createGain();
    master.gain.value = live ? 0 : p.volume;

    // Primary binaural pair: independent L (pan -1) and R (pan +1) voices.
    const binGain = ctx.createGain();
    binGain.gain.value = lv.binaural;
    const oscL = makeOsc(f.left, p.waveform);
    const oscR = makeOsc(f.right, p.waveform);
    const panL = ctx.createStereoPanner();
    const panR = ctx.createStereoPanner();
    panL.pan.value = -1;
    panR.pan.value = 1;
    oscL.connect(panL).connect(binGain);
    oscR.connect(panR).connect(binGain);
    binGain.connect(master);

    // Isochronic layer: centre tone gated by a soft sine LFO at the beat rate.
    const isoOsc = makeOsc(f.center, 'sine');
    const isoVca = ctx.createGain();
    isoVca.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = p.beatHz;
    if (live) lfo.type = 'sine';
    else lfo.setPeriodicWave(createPhasedWave(ctx, 'sine', 2 * Math.PI * ((p.beatHz * t0) % 1)));
    oscs.push(lfo);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.5;
    const isoLevel = ctx.createGain();
    isoLevel.gain.value = lv.isochronic;
    lfo.connect(lfoDepth).connect(isoVca.gain);
    isoOsc.connect(isoVca).connect(isoLevel).connect(master);

    // Pink noise bed (always wired so level changes are just gain ramps).
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = opts.noiseBuffer;
    noiseSrc.loop = true;
    const noiseLp = ctx.createBiquadFilter();
    noiseLp.type = 'lowpass';
    noiseLp.frequency.value = 2200;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = lv.noise;
    noiseSrc.connect(noiseLp).connect(noiseGain).connect(master);

    return {
      master, binGain, isoLevel, noiseGain, oscL, oscR, isoOsc, lfo, noiseSrc, oscs,
      start(when, noiseOffsetSec) {
        oscs.forEach((o) => o.start(when));
        noiseSrc.start(when, noiseOffsetSec || 0);
      },
      stop(when) {
        oscs.forEach((o) => { try { o.stop(when); } catch (e) { /* already stopped */ } });
        try { noiseSrc.stop(when); } catch (e) { /* already stopped */ }
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Live engine
  // ---------------------------------------------------------------------------
  class BinauralEngine {
    constructor() {
      this.state = normalizeParams({});
      this.ctx = null;
      this.graph = null;
      this.analyserL = null;
      this.analyserR = null;
      this._listeners = new Set();
      this._waveToken = 0;
      this._noiseBuffers = new Map();
    }

    get isPlaying() { return !!this.graph; }
    get sampleRate() { return this.ctx ? this.ctx.sampleRate : 44100; }

    onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
    _emit() { this._listeners.forEach((fn) => { try { fn(this.getState()); } catch (e) { console.error(e); } }); }

    getState() {
      return { ...this.state, layerMix: { ...this.state.layerMix } };
    }

    frequencies() {
      return channelFrequencies(this.state.carrierHz, this.state.beatHz, this.state.mode);
    }

    async start() {
      if (this.graph) return;
      const Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) throw new Error('Web Audio API is not supported in this browser.');
      const ctx = new Ctx({ latencyHint: 'playback' });
      if (ctx.state === 'suspended') await ctx.resume();

      let noise = this._noiseBuffers.get(ctx.sampleRate);
      if (!noise) {
        noise = makePinkLoopBuffer(ctx.sampleRate, () => ctx);
        this._noiseBuffers.set(ctx.sampleRate, noise);
      }

      const graph = buildGraph(ctx, this.state, { live: true, noiseBuffer: noise });
      const splitter = ctx.createChannelSplitter(2);
      const aL = ctx.createAnalyser();
      const aR = ctx.createAnalyser();
      aL.fftSize = aR.fftSize = 2048;
      aL.smoothingTimeConstant = aR.smoothingTimeConstant = 0;
      graph.master.connect(ctx.destination);
      graph.master.connect(splitter);
      splitter.connect(aL, 0);
      splitter.connect(aR, 1);

      const now = ctx.currentTime + 0.03;
      graph.start(now, 0);
      graph.master.gain.setValueAtTime(0, now);
      graph.master.gain.setTargetAtTime(this.state.volume, now, 0.08); // gentle fade-in

      this.ctx = ctx;
      this.graph = graph;
      this._wavePending = false;
      this.analyserL = aL;
      this.analyserR = aR;
      this._emit();
    }

    stop() {
      const { ctx, graph } = this;
      if (!graph) return;
      this.graph = null;
      this.ctx = null;
      this.analyserL = null;
      this.analyserR = null;
      smoothSet(graph.master.gain, 0, ctx, 0.07); // fade-out, then tear down
      setTimeout(() => {
        graph.stop(0);
        ctx.close().catch(() => {});
      }, 600);
      this._emit();
    }

    setState(patch) {
      const prev = this.state;
      const merged = normalizeParams({
        ...prev,
        ...patch,
        layerMix: { ...prev.layerMix, ...((patch && patch.layerMix) || {}) }
      });
      this.state = merged;
      if (this.graph) this._applyLive(prev.waveform !== merged.waveform);
      this._emit();
    }

    _applyLive(waveformChanged) {
      const { ctx, graph } = this;
      const f = this.frequencies();
      const lv = levels(this.state);
      smoothSet(graph.oscL.frequency, f.left, ctx);
      smoothSet(graph.oscR.frequency, f.right, ctx);
      smoothSet(graph.isoOsc.frequency, f.center, ctx);
      smoothSet(graph.lfo.frequency, this.state.beatHz, ctx);
      smoothSet(graph.isoLevel.gain, lv.isochronic, ctx);
      smoothSet(graph.noiseGain.gain, lv.noise, ctx);
      smoothSet(graph.master.gain, this.state.volume, ctx);

      if (waveformChanged) {
        // Duck, swap oscillator type while silent, restore: no click on timbre change.
        const token = ++this._waveToken;
        this._wavePending = true;
        smoothSet(graph.binGain.gain, 0, ctx, 0.012);
        setTimeout(() => {
          if (token !== this._waveToken || this.graph !== graph) return;
          graph.oscL.type = this.state.waveform;
          graph.oscR.type = this.state.waveform;
          this._wavePending = false;
          smoothSet(graph.binGain.gain, levels(this.state).binaural, ctx, 0.02);
        }, 80);
      } else if (!this._wavePending) {
        smoothSet(graph.binGain.gain, lv.binaural, ctx);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // WAV encoding + offline rendering
  // ---------------------------------------------------------------------------
  function encodeWavHeader(frames, sampleRate, channels, bits) {
    const bytesPerSample = bits / 8;
    const dataBytes = frames * channels * bytesPerSample;
    const buf = new ArrayBuffer(44);
    const v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF');
    v.setUint32(4, 36 + dataBytes, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    v.setUint32(16, 16, true);                                   // PCM fmt chunk size
    v.setUint16(20, 1, true);                                    // PCM
    v.setUint16(22, channels, true);
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * channels * bytesPerSample, true); // byte rate
    v.setUint16(32, channels * bytesPerSample, true);            // block align
    v.setUint16(34, bits, true);
    str(36, 'data');
    v.setUint32(40, dataBytes, true);
    return buf;
  }

  function smoothstep(x) { return x * x * (3 - 2 * x); }

  /**
   * Renders `durationSec` of the current signal faster than realtime.
   * Works in phase-continuous chunks so long exports stay within memory limits,
   * applies 2 s fade-in / fade-out, and returns a 16-bit PCM WAV Blob.
   */
  async function renderWav(rawParams, options) {
    const o = options || {};
    const p = normalizeParams(rawParams);
    const sampleRate = o.sampleRate === 48000 ? 48000 : 44100;
    const durationSec = clamp(num(o.durationSec, 60), 1, 3600);
    const chunkFrames = sampleRate * 30;
    const totalFrames = Math.round(durationSec * sampleRate);
    const fadeFrames = Math.min(sampleRate * 2, Math.floor(totalFrames / 2));
    const Offline = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    if (!Offline) throw new Error('OfflineAudioContext is not supported in this browser.');

    const noiseSeconds = 8;
    const noise = makePinkLoopBuffer(sampleRate, () => new Offline(1, 1, sampleRate), noiseSeconds);
    const parts = [encodeWavHeader(totalFrames, sampleRate, 2, 16)];
    const started = performance.now();

    let done = 0;
    while (done < totalFrames) {
      if (o.signal && o.signal.aborted) throw new DOMException('Render cancelled', 'AbortError');
      const frames = Math.min(chunkFrames, totalFrames - done);
      const t0 = done / sampleRate;
      const ctx = new Offline(2, frames, sampleRate);
      const graph = buildGraph(ctx, p, { live: false, t0, noiseBuffer: noise });
      graph.master.connect(ctx.destination);
      graph.start(0, t0 % noiseSeconds);
      const rendered = await ctx.startRendering();

      const L = rendered.getChannelData(0);
      const R = rendered.getChannelData(1);
      const pcm = new Int16Array(frames * 2);
      for (let i = 0; i < frames; i++) {
        const g = done + i;
        let env = 1;
        if (g < fadeFrames) env = smoothstep(g / fadeFrames);
        else if (g >= totalFrames - fadeFrames) env = smoothstep((totalFrames - g) / fadeFrames);
        const l = clamp(L[i] * env, -1, 1);
        const r = clamp(R[i] * env, -1, 1);
        pcm[2 * i] = l < 0 ? l * 32768 : l * 32767;
        pcm[2 * i + 1] = r < 0 ? r * 32768 : r * 32767;
      }
      parts.push(pcm);
      done += frames;
      if (o.onProgress) o.onProgress(done / totalFrames);
      await new Promise((r) => setTimeout(r, 0)); // keep the UI responsive
    }

    const blob = new Blob(parts, { type: 'audio/wav' });
    const seconds = (performance.now() - started) / 1000;
    return { blob, frames: totalFrames, sampleRate, bytes: blob.size, renderSeconds: seconds, speed: durationSec / Math.max(seconds, 0.001) };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  global.SynapseBinaural = {
    LIMITS, WAVEFORMS, MODES, BANDS,
    BinauralEngine, bandForBeat, channelFrequencies, normalizeParams,
    renderWav, encodeWavHeader, downloadBlob
  };
})(window);
