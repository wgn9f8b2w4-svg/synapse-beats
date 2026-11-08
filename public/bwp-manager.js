/**
 * .bwp (BrainWave Preset) manager
 *
 * Schema (JSON, schemaVersion 1):
 * {
 *   "schemaVersion": 1,
 *   "presetName": "Deep Focus",          // 1-40 chars
 *   "carrierHz": 220,                    // 50-1000
 *   "beatHz": 14,                        // 0.1-100
 *   "mode": "symmetric" | "offset",      // L = c - b/2, R = c + b/2  |  L = c, R = c + b
 *   "waveform": "sine" | "triangle" | "square" | "sawtooth",
 *   "layerMix": { "binaural": 1, "isochronic": 0, "noise": 0 },   // each 0-1
 *   "notes": "free text (max 500 chars)"
 * }
 *
 * Also reads the legacy key=value format used by the open-source BrainWave app
 * (name= / desc= / carrier= / beat=).
 */
(function (global) {
  'use strict';

  const B = global.SynapseBinaural;
  const SCHEMA_VERSION = 1;
  const STORE_KEY = 'synapse.bwp.v1';
  const MAX_NAME = 40;
  const MAX_NOTES = 500;
  const MAX_FILE_BYTES = 100 * 1024;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const BUILTIN_PRESETS = [
    { presetName: 'Deep Focus', carrierHz: 220, beatHz: 14, mode: 'symmetric', waveform: 'sine', layerMix: { binaural: 1, isochronic: 0, noise: 0.15 }, notes: 'Low beta. Sustained attention for reading or coding.' },
    { presetName: 'Alpha Calm', carrierHz: 200, beatHz: 10, mode: 'symmetric', waveform: 'sine', layerMix: { binaural: 1, isochronic: 0, noise: 0.25 }, notes: 'Relaxed wakefulness.' },
    { presetName: 'Theta Drift', carrierHz: 150, beatHz: 6, mode: 'symmetric', waveform: 'sine', layerMix: { binaural: 1, isochronic: 0, noise: 0.3 }, notes: 'Meditative, hypnagogic range.' },
    { presetName: 'Delta Sleep', carrierHz: 100, beatHz: 2, mode: 'symmetric', waveform: 'sine', layerMix: { binaural: 0.9, isochronic: 0, noise: 0.5 }, notes: 'Slow delta with a pink-noise cushion for winding down.' },
    { presetName: 'Gamma Pulse', carrierHz: 432, beatHz: 40, mode: 'symmetric', waveform: 'sine', layerMix: { binaural: 0.7, isochronic: 0.6, noise: 0 }, notes: '40 Hz. Beats this fast are weak as binaural tones, so an isochronic pulse is layered in.' },
    { presetName: 'Solfeggio 528', carrierHz: 528, beatHz: 7.83, mode: 'symmetric', waveform: 'sine', layerMix: { binaural: 1, isochronic: 0, noise: 0.1 }, notes: '528 Hz carrier with a 7.83 Hz (Schumann-resonance value) beat.' }
  ];

  /** Validates and normalises any preset-like object. Throws Error with a user-facing message. */
  function normalizePreset(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Preset must be a JSON object.');
    const name = typeof raw.presetName === 'string' ? raw.presetName.trim() : '';
    if (!name) throw new Error('Preset is missing "presetName".');
    if (name.length > MAX_NAME) throw new Error('Preset name is too long (max ' + MAX_NAME + ' characters).');
    const carrier = Number(raw.carrierHz);
    const beat = Number(raw.beatHz);
    if (!Number.isFinite(carrier)) throw new Error('"carrierHz" must be a number.');
    if (!Number.isFinite(beat)) throw new Error('"beatHz" must be a number.');
    const mix = raw.layerMix && typeof raw.layerMix === 'object' ? raw.layerMix : {};
    const mixVal = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? clamp(Number(v), 0, 1) : d);
    return {
      schemaVersion: SCHEMA_VERSION,
      presetName: name,
      carrierHz: clamp(carrier, B.LIMITS.carrierMin, B.LIMITS.carrierMax),
      beatHz: clamp(beat, B.LIMITS.beatMin, B.LIMITS.beatMax),
      mode: B.MODES.includes(raw.mode) ? raw.mode : 'symmetric',
      waveform: B.WAVEFORMS.includes(raw.waveform) ? raw.waveform : 'sine',
      layerMix: {
        binaural: mixVal(mix.binaural, 1),
        isochronic: mixVal(mix.isochronic, 0),
        noise: mixVal(mix.noise, 0)
      },
      notes: typeof raw.notes === 'string' ? raw.notes.trim().slice(0, MAX_NOTES) : ''
    };
  }

  function parseLegacyText(text) {
    const kv = {};
    text.split(/\r?\n/).forEach((line) => {
      const ln = line.trim();
      if (!ln || ln.startsWith('#') || !ln.includes('=')) return;
      const i = ln.indexOf('=');
      kv[ln.slice(0, i).trim().toLowerCase()] = ln.slice(i + 1).trim();
    });
    return { presetName: kv.name, carrierHz: kv.carrier, beatHz: kv.beat, notes: kv.desc };
  }

  /** Parses .bwp text (JSON, or the legacy key=value format). */
  function parseBwp(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('File is empty.');
    const trimmed = text.replace(/^\uFEFF/, '').trim();
    let raw;
    if (trimmed.startsWith('{')) {
      try { raw = JSON.parse(trimmed); } catch (e) { throw new Error('File is not valid JSON.'); }
    } else {
      raw = parseLegacyText(trimmed);
    }
    return normalizePreset(raw);
  }

  function serializeBwp(preset) {
    return JSON.stringify(normalizePreset(preset), null, 2) + '\n';
  }

  function bwpFilename(name) {
    const slug = String(name || 'preset').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return (slug || 'preset') + '.bwp';
  }

  function makeStorage() {
    try {
      const probe = '__synapse_probe__';
      global.localStorage.setItem(probe, '1');
      global.localStorage.removeItem(probe);
      return global.localStorage;
    } catch (e) {
      const mem = {};
      return { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
    }
  }

  /** Built-in + user presets cached in localStorage (falls back to memory if unavailable). */
  class PresetStore {
    constructor() {
      this.storage = makeStorage();
      this.data = this._load();
    }

    _load() {
      let stored = null;
      try { stored = JSON.parse(this.storage.getItem(STORE_KEY) || 'null'); } catch (e) { stored = null; }
      const user = [];
      if (stored && Array.isArray(stored.user)) {
        stored.user.forEach((p) => { try { user.push(normalizePreset(p)); } catch (e) { /* drop invalid */ } });
      }
      const data = { version: SCHEMA_VERSION, builtin: BUILTIN_PRESETS.map(normalizePreset), user };
      this._persist(data);
      return data;
    }

    _persist(data) {
      try { this.storage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* quota or privacy mode */ }
    }

    builtin() { return this.data.builtin.slice(); }
    user() { return this.data.user.slice(); }

    /** Adds or replaces (case-insensitive name match) a user preset. */
    saveUser(preset) {
      const p = normalizePreset(preset);
      const key = p.presetName.toLowerCase();
      const i = this.data.user.findIndex((u) => u.presetName.toLowerCase() === key);
      if (i >= 0) this.data.user[i] = p; else this.data.user.push(p);
      this._persist(this.data);
      return p;
    }

    deleteUser(name) {
      const key = String(name).toLowerCase();
      const before = this.data.user.length;
      this.data.user = this.data.user.filter((u) => u.presetName.toLowerCase() !== key);
      this._persist(this.data);
      return this.data.user.length !== before;
    }
  }

  global.SynapseBWP = {
    SCHEMA_VERSION, MAX_FILE_BYTES, BUILTIN_PRESETS,
    normalizePreset, parseBwp, serializeBwp, bwpFilename, PresetStore
  };
})(window);
