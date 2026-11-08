/**
 * Binaural Lab UI controller
 * Wires binaural-engine.js and bwp-manager.js to the #binauralLab section:
 * tuning controls, phase scope (dual waveform + XY Lissajous), WAV export,
 * .bwp preset manager and the Gateway research drawer.
 */
(function () {
  'use strict';

  const B = window.SynapseBinaural;
  const W = window.SynapseBWP;
  const root = document.getElementById('binauralLab');
  if (!B || !W || !root) return;

  const $ = (id) => document.getElementById(id);
  const engine = new B.BinauralEngine();
  const store = new W.PresetStore();
  window.synapseBinauralEngine = engine; // exposed for debugging / automated tests

  const BEAT_UI_MIN = 0.5;
  const BEAT_UI_MAX = 100;
  const beatFromPos = (pos) => BEAT_UI_MIN * Math.pow(BEAT_UI_MAX / BEAT_UI_MIN, pos / 1000);
  const posFromBeat = (beat) => Math.round(1000 * Math.log(Math.max(beat, BEAT_UI_MIN) / BEAT_UI_MIN) / Math.log(BEAT_UI_MAX / BEAT_UI_MIN));
  const round2 = (v) => Math.round(v * 100) / 100;
  const fmtHz = (v) => (Math.abs(v - Math.round(v)) < 0.005 ? String(Math.round(v)) : v.toFixed(2));
  const pct = (v) => Math.round(v * 100) + '%';

  // ---------------------------------------------------------------------------
  // Status line
  // ---------------------------------------------------------------------------
  const statusEl = $('blStatus');
  let statusTimer = null;
  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.dataset.kind = kind || '';
    clearTimeout(statusTimer);
    if (msg) statusTimer = setTimeout(() => { statusEl.textContent = ''; statusEl.dataset.kind = ''; }, 7000);
  }

  // ---------------------------------------------------------------------------
  // Phase scope
  // ---------------------------------------------------------------------------
  class PhaseScope {
    constructor(canvas) {
      this.canvas = canvas;
      this.g = canvas.getContext('2d');
      this.mode = 'waveform';
      this.w = 0; this.h = 0;
      this.bufL = new Float32Array(2048);
      this.bufR = new Float32Array(2048);
      this.peak = 0.2;
      this.dirty = true;
      this.visible = true;
      this.loop = this.loop.bind(this);
      new ResizeObserver(() => this.resize()).observe(canvas);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; }).observe(canvas);
      }
      this.resize();
      requestAnimationFrame(this.loop);
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      const r = this.canvas.getBoundingClientRect();
      this.w = Math.max(1, r.width);
      this.h = Math.max(1, r.height);
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.dirty = true;
    }

    setMode(mode) { this.mode = mode; this.dirty = true; }
    invalidate() { this.dirty = true; }

    drawGrid() {
      const { g, w, h } = this;
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(56, 189, 248, 0.07)';
      g.beginPath();
      for (let x = 0; x <= w; x += 40) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); }
      for (let y = 0; y <= h; y += 40) { g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); }
      g.stroke();
      g.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      g.beginPath();
      g.moveTo(0, h / 2 + 0.5); g.lineTo(w, h / 2 + 0.5);
      g.moveTo(w / 2 + 0.5, 0); g.lineTo(w / 2 + 0.5, h);
      g.stroke();
    }

    drawIdle() {
      const { g, w, h } = this;
      g.fillStyle = '#04070c';
      g.fillRect(0, 0, w, h);
      this.drawGrid();
      if (this.mode === 'waveform') {
        g.strokeStyle = 'rgba(255,255,255,0.18)';
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.font = '12px ui-monospace, Consolas, monospace';
      g.textAlign = 'center';
      g.fillText('Start the tone to see the L / R phase relationship', w / 2, h - 14);
    }

    loop() {
      requestAnimationFrame(this.loop);
      if (document.hidden || !this.visible) return;
      if (!engine.isPlaying || !engine.analyserL) {
        if (this.dirty) { this.drawIdle(); this.dirty = false; }
        return;
      }
      this.dirty = true; // redraw idle after stopping
      engine.analyserL.getFloatTimeDomainData(this.bufL);
      engine.analyserR.getFloatTimeDomainData(this.bufR);
      let pk = 0;
      for (let i = 0; i < this.bufL.length; i++) {
        const a = Math.abs(this.bufL[i]); const b = Math.abs(this.bufR[i]);
        if (a > pk) pk = a;
        if (b > pk) pk = b;
      }
      this.peak = Math.max(pk, this.peak * 0.97, 0.05);
      if (this.mode === 'lissajous') this.drawLissajous(); else this.drawWaveform();
    }

    drawWaveform() {
      const { g, w, h, bufL, bufR } = this;
      g.fillStyle = '#04070c';
      g.fillRect(0, 0, w, h);
      this.drawGrid();
      const st = engine.getState();
      const N = Math.min(1400, Math.max(128, Math.round((engine.sampleRate / st.carrierHz) * 4)));
      let start = 0;
      for (let i = 1; i < bufL.length - N; i++) {
        if (bufL[i - 1] < 0 && bufL[i] >= 0) { start = i; break; } // common rising-edge trigger on L
      }
      const amp = (h / 2) * 0.85 / this.peak;
      const trace = (buf, color) => {
        g.strokeStyle = color;
        g.shadowColor = color;
        g.shadowBlur = 6;
        g.lineWidth = 1.75;
        g.beginPath();
        for (let i = 0; i < N; i++) {
          const x = (i / (N - 1)) * w;
          const y = h / 2 - buf[start + i] * amp;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
        g.shadowBlur = 0;
      };
      trace(bufL, '#22d3ee');
      trace(bufR, '#ff5fd2');
    }

    drawLissajous() {
      const { g, w, h, bufL, bufR } = this;
      if (this.firstLiss !== false || this.lastMode !== 'lissajous') {
        g.fillStyle = '#04070c';
        g.fillRect(0, 0, w, h);
        this.firstLiss = false;
      }
      this.lastMode = 'lissajous';
      g.fillStyle = 'rgba(4, 7, 12, 0.2)'; // phosphor persistence
      g.fillRect(0, 0, w, h);
      this.drawGrid();
      const half = (Math.min(w, h) / 2) * 0.88;
      const cx = w / 2; const cy = h / 2;
      const k = half / this.peak;
      g.strokeStyle = 'rgba(94, 234, 212, 0.9)';
      g.lineWidth = 1.2;
      g.shadowColor = '#2dd4bf';
      g.shadowBlur = 5;
      g.beginPath();
      for (let i = 0; i < bufL.length; i++) {
        const x = cx + bufL[i] * k;
        const y = cy - bufR[i] * k;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      g.shadowBlur = 0;
    }
  }

  const scope = new PhaseScope($('blScope'));
  const origSetMode = scope.setMode.bind(scope);
  scope.setMode = (m) => { scope.firstLiss = true; scope.lastMode = null; origSetMode(m); };

  // ---------------------------------------------------------------------------
  // Element refs
  // ---------------------------------------------------------------------------
  const el = {
    play: $('blPlay'), playLabel: $('blPlayLabel'), layerMusic: $('blLayerMusic'),
    carrier: $('blCarrier'), carrierOut: $('blCarrierOut'),
    beat: $('blBeat'), beatNum: $('blBeatNum'), beatHint: $('blBeatHint'),
    mixBin: $('blMixBinaural'), mixBinOut: $('blMixBinauralOut'),
    mixIso: $('blMixIso'), mixIsoOut: $('blMixIsoOut'),
    mixNoise: $('blMixNoise'), mixNoiseOut: $('blMixNoiseOut'),
    vol: $('blVolume'), volOut: $('blVolumeOut'),
    freqL: $('blFreqL'), freqR: $('blFreqR'), freqDelta: $('blFreqDelta'), bandChip: $('blBandChip'),
    presetSelect: $('blPresetSelect'), presetName: $('blPresetName'), presetNotes: $('blPresetNotes'),
    presetDelete: $('blPresetDelete'), presetFile: $('blPresetFile'),
    expDuration: $('blExportDuration'), expRate: $('blExportRate'), expSize: $('blExportSize'),
    expBtn: $('blExportBtn'), expCancel: $('blExportCancel'), expProgress: $('blExportProgress')
  };
  const modeBtns = root.querySelectorAll('[data-mode]');
  const waveBtns = root.querySelectorAll('[data-wave]');
  const scopeBtns = root.querySelectorAll('[data-scope]');
  const carrierPills = root.querySelectorAll('[data-carrier]');
  const bandPills = root.querySelectorAll('[data-band]');

  // ---------------------------------------------------------------------------
  // Render (engine state -> UI). The engine is the single source of truth.
  // ---------------------------------------------------------------------------
  function setIfIdle(input, value) {
    if (document.activeElement !== input) input.value = value;
  }

  function render(st) {
    const f = engine.frequencies();
    const band = B.bandForBeat(st.beatHz);

    setIfIdle(el.carrier, st.carrierHz);
    el.carrierOut.textContent = fmtHz(st.carrierHz);
    setIfIdle(el.beat, posFromBeat(st.beatHz));
    setIfIdle(el.beatNum, round2(st.beatHz));
    setIfIdle(el.mixBin, st.layerMix.binaural);
    setIfIdle(el.mixIso, st.layerMix.isochronic);
    setIfIdle(el.mixNoise, st.layerMix.noise);
    setIfIdle(el.vol, st.volume);
    el.mixBinOut.textContent = pct(st.layerMix.binaural);
    el.mixIsoOut.textContent = pct(st.layerMix.isochronic);
    el.mixNoiseOut.textContent = pct(st.layerMix.noise);
    el.volOut.textContent = pct(st.volume);

    el.freqL.textContent = fmtHz(f.left);
    el.freqR.textContent = fmtHz(f.right);
    el.freqDelta.textContent = fmtHz(f.delta);
    el.bandChip.textContent = band.label + ' band';
    el.bandChip.dataset.band = band.id;

    carrierPills.forEach((b) => b.classList.toggle('is-active', Math.abs(parseFloat(b.dataset.carrier) - st.carrierHz) < 0.05));
    bandPills.forEach((b) => b.classList.toggle('is-active', b.dataset.band === band.id));
    modeBtns.forEach((b) => { const on = b.dataset.mode === st.mode; b.classList.toggle('is-active', on); b.setAttribute('aria-checked', String(on)); });
    waveBtns.forEach((b) => { const on = b.dataset.wave === st.waveform; b.classList.toggle('is-active', on); b.setAttribute('aria-checked', String(on)); });

    let hint = '';
    if (st.beatHz > 30) hint = 'Binaural beats above ~30 Hz are rarely perceived. Raise the isochronic layer for a clearer pulse.';
    else if (st.mode === 'symmetric' && st.carrierHz - st.beatHz / 2 < 20) hint = 'Left tone is clamped to 20 Hz. Raise the carrier or lower the beat.';
    el.beatHint.textContent = hint;
    el.beatHint.hidden = !hint;

    const playing = engine.isPlaying;
    el.play.setAttribute('aria-pressed', String(playing));
    el.play.classList.toggle('is-live', playing);
    el.playLabel.textContent = playing ? 'Stop Tone' : 'Start Tone';
    el.play.firstElementChild.innerHTML = playing
      ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'
      : '<polygon points="6,4 20,12 6,20"/>';
    scope.invalidate();
  }
  engine.onChange(render);

  function markCustom() {
    el.presetSelect.value = '';
    el.presetDelete.disabled = true;
  }

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------
  el.carrier.addEventListener('input', () => { engine.setState({ carrierHz: parseFloat(el.carrier.value) }); markCustom(); });
  el.beat.addEventListener('input', () => { engine.setState({ beatHz: round2(beatFromPos(parseFloat(el.beat.value))) }); markCustom(); });
  el.beatNum.addEventListener('input', () => {
    const v = parseFloat(el.beatNum.value);
    if (Number.isFinite(v) && v > 0) { engine.setState({ beatHz: v }); markCustom(); }
  });
  el.beatNum.addEventListener('change', () => { el.beatNum.value = round2(engine.getState().beatHz); });
  el.mixBin.addEventListener('input', () => { engine.setState({ layerMix: { binaural: parseFloat(el.mixBin.value) } }); markCustom(); });
  el.mixIso.addEventListener('input', () => { engine.setState({ layerMix: { isochronic: parseFloat(el.mixIso.value) } }); markCustom(); });
  el.mixNoise.addEventListener('input', () => { engine.setState({ layerMix: { noise: parseFloat(el.mixNoise.value) } }); markCustom(); });
  el.vol.addEventListener('input', () => { engine.setState({ volume: parseFloat(el.vol.value) }); markCustom(); });

  carrierPills.forEach((b) => b.addEventListener('click', () => { engine.setState({ carrierHz: parseFloat(b.dataset.carrier) }); markCustom(); }));
  bandPills.forEach((b) => b.addEventListener('click', () => { engine.setState({ beatHz: parseFloat(b.dataset.beat) }); markCustom(); }));
  modeBtns.forEach((b) => b.addEventListener('click', () => { engine.setState({ mode: b.dataset.mode }); markCustom(); }));
  waveBtns.forEach((b) => b.addEventListener('click', () => { engine.setState({ waveform: b.dataset.wave }); markCustom(); }));
  scopeBtns.forEach((b) => b.addEventListener('click', () => {
    scopeBtns.forEach((o) => { const on = o === b; o.classList.toggle('is-active', on); o.setAttribute('aria-selected', String(on)); });
    scope.setMode(b.dataset.scope);
  }));

  // Space inside the lab must not toggle the main player (app.js listens on window).
  root.addEventListener('keydown', (e) => { if (e.code === 'Space') e.stopPropagation(); });

  // ---------------------------------------------------------------------------
  // Transport (+ optional layering with the Synapse music engine)
  // ---------------------------------------------------------------------------
  let musicStartedByLab = false;
  let transportBusy = false;
  const mainPlayBtn = $('masterPlayBtn');
  const music = () => window.neuralAudioEngine;

  el.play.addEventListener('click', async () => {
    if (transportBusy) return;
    transportBusy = true;
    try {
      if (engine.isPlaying) {
        engine.stop();
        if (musicStartedByLab && music() && music().isPlaying && mainPlayBtn) mainPlayBtn.click();
        musicStartedByLab = false;
      } else {
        await engine.start();
        if (el.layerMusic.checked && music() && !music().isPlaying && mainPlayBtn) {
          mainPlayBtn.click();
          musicStartedByLab = true;
        }
      }
    } catch (err) {
      setStatus('Could not start audio: ' + err.message, 'error');
    } finally {
      transportBusy = false;
    }
  });

  // ---------------------------------------------------------------------------
  // Presets
  // ---------------------------------------------------------------------------
  function option(value, text) {
    const o = document.createElement('option');
    o.value = value; o.textContent = text;
    return o;
  }

  function refreshPresetSelect(selectKey) {
    const sel = el.presetSelect;
    sel.innerHTML = '';
    sel.appendChild(option('', 'Custom (unsaved)'));
    const gb = document.createElement('optgroup'); gb.label = 'Built-in';
    store.builtin().forEach((p) => gb.appendChild(option('b:' + p.presetName, p.presetName + '  -  ' + fmtHz(p.carrierHz) + ' / ' + fmtHz(p.beatHz) + ' Hz')));
    sel.appendChild(gb);
    const users = store.user();
    if (users.length) {
      const gu = document.createElement('optgroup'); gu.label = 'Saved';
      users.forEach((p) => gu.appendChild(option('u:' + p.presetName, p.presetName + '  -  ' + fmtHz(p.carrierHz) + ' / ' + fmtHz(p.beatHz) + ' Hz')));
      sel.appendChild(gu);
    }
    sel.value = selectKey || '';
    if (sel.value !== (selectKey || '')) sel.value = '';
    el.presetDelete.disabled = !sel.value.startsWith('u:');
  }

  function applyPreset(p) {
    engine.setState({ carrierHz: p.carrierHz, beatHz: p.beatHz, mode: p.mode, waveform: p.waveform, layerMix: p.layerMix });
    el.presetName.value = p.presetName;
    el.presetNotes.value = p.notes || '';
  }

  function findPreset(key) {
    const name = key.slice(2).toLowerCase();
    const list = key.startsWith('b:') ? store.builtin() : store.user();
    return list.find((p) => p.presetName.toLowerCase() === name);
  }

  function currentAsPreset(name) {
    const st = engine.getState();
    return { presetName: name, carrierHz: st.carrierHz, beatHz: round2(st.beatHz), mode: st.mode, waveform: st.waveform, layerMix: st.layerMix, notes: el.presetNotes.value };
  }

  el.presetSelect.addEventListener('change', () => {
    const key = el.presetSelect.value;
    el.presetDelete.disabled = !key.startsWith('u:');
    if (!key) return;
    const p = findPreset(key);
    if (p) { applyPreset(p); setStatus('Loaded "' + p.presetName + '".', 'ok'); }
  });

  $('blPresetSave').addEventListener('click', () => {
    const name = el.presetName.value.trim();
    if (!name) { setStatus('Enter a preset name first.', 'error'); el.presetName.focus(); return; }
    if (store.builtin().some((p) => p.presetName.toLowerCase() === name.toLowerCase())) {
      setStatus('That name belongs to a built-in preset. Choose another name.', 'error');
      return;
    }
    try {
      const saved = store.saveUser(currentAsPreset(name));
      refreshPresetSelect('u:' + saved.presetName);
      setStatus('Saved "' + saved.presetName + '" to this browser.', 'ok');
    } catch (err) { setStatus(err.message, 'error'); }
  });

  $('blPresetExport').addEventListener('click', () => {
    const name = el.presetName.value.trim() || 'Custom Preset';
    try {
      const text = W.serializeBwp(currentAsPreset(name));
      B.downloadBlob(new Blob([text], { type: 'application/json' }), W.bwpFilename(name));
      setStatus('Exported ' + W.bwpFilename(name) + '.', 'ok');
    } catch (err) { setStatus(err.message, 'error'); }
  });

  $('blPresetDelete').addEventListener('click', () => {
    const key = el.presetSelect.value;
    if (!key.startsWith('u:')) return;
    const name = key.slice(2);
    store.deleteUser(name);
    refreshPresetSelect('');
    setStatus('Deleted "' + name + '".', 'ok');
  });

  $('blPresetImport').addEventListener('click', () => el.presetFile.click());
  el.presetFile.addEventListener('change', () => { importFiles(el.presetFile.files); el.presetFile.value = ''; });

  async function importFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let ok = 0; let lastKey = ''; const errors = [];
    for (const file of files) {
      try {
        if (file.size > W.MAX_FILE_BYTES) throw new Error('file is larger than 100 KB');
        const preset = W.parseBwp(await file.text());
        let toSave = preset;
        if (store.builtin().some((p) => p.presetName.toLowerCase() === preset.presetName.toLowerCase())) {
          toSave = { ...preset, presetName: (preset.presetName + ' (imported)').slice(0, 40) };
        }
        const saved = store.saveUser(toSave);
        applyPreset(saved);
        lastKey = 'u:' + saved.presetName;
        ok++;
      } catch (err) { errors.push(file.name + ': ' + err.message); }
    }
    if (ok) refreshPresetSelect(lastKey);
    if (errors.length) setStatus('Import problem: ' + errors.join(' | ') + (ok ? ' (' + ok + ' imported)' : ''), 'error');
    else setStatus('Imported ' + ok + ' preset' + (ok === 1 ? '' : 's') + '.', 'ok');
  }

  // Drag and drop anywhere on the lab.
  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  root.addEventListener('dragenter', (e) => { if (hasFiles(e)) { dragDepth++; root.classList.add('is-dragover'); } });
  root.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  root.addEventListener('dragleave', (e) => { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; root.classList.remove('is-dragover'); } });
  root.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    root.classList.remove('is-dragover');
    importFiles(e.dataTransfer.files);
  });

  // ---------------------------------------------------------------------------
  // Offline WAV export
  // ---------------------------------------------------------------------------
  let exportAbort = null;

  function updateExportSize() {
    const bytes = parseInt(el.expDuration.value, 10) * parseInt(el.expRate.value, 10) * 4;
    el.expSize.textContent = '~' + (bytes / 1048576).toFixed(0) + ' MB';
  }
  el.expDuration.addEventListener('change', updateExportSize);
  el.expRate.addEventListener('change', updateExportSize);

  function setExporting(on) {
    el.expBtn.disabled = on;
    el.expDuration.disabled = on;
    el.expRate.disabled = on;
    el.expCancel.hidden = !on;
    if (!on) el.expProgress.value = 0;
  }

  el.expBtn.addEventListener('click', async () => {
    if (exportAbort) return;
    const durationSec = parseInt(el.expDuration.value, 10);
    const sampleRate = parseInt(el.expRate.value, 10);
    const st = engine.getState();
    exportAbort = new AbortController();
    setExporting(true);
    setStatus('Rendering ' + durationSec / 60 + ' min offline...', '');
    try {
      const res = await B.renderWav(st, {
        durationSec, sampleRate, signal: exportAbort.signal,
        onProgress: (p) => { el.expProgress.value = p; }
      });
      const name = 'synapse-binaural-' + Math.round(st.carrierHz) + 'hz-' + round2(st.beatHz) + 'hz-' + durationSec / 60 + 'min.wav';
      B.downloadBlob(res.blob, name);
      setStatus('Exported ' + name + ' (' + (res.bytes / 1048576).toFixed(1) + ' MB, rendered ' + res.speed.toFixed(0) + 'x faster than realtime).', 'ok');
    } catch (err) {
      if (err && err.name === 'AbortError') setStatus('Export cancelled.', '');
      else setStatus('Export failed: ' + (err && err.message ? err.message : err), 'error');
    } finally {
      exportAbort = null;
      setExporting(false);
    }
  });
  el.expCancel.addEventListener('click', () => { if (exportAbort) exportAbort.abort(); });

  // ---------------------------------------------------------------------------
  // Gateway research drawer
  // ---------------------------------------------------------------------------
  const RESEARCH = [
    {
      title: 'Monroe Institute Focus levels',
      intro: 'The Gateway Experience describes numbered "Focus" states. The Load buttons below are illustrative tunings built from the published level descriptions. Monroe\'s actual Hemi-Sync signals are proprietary layered audio and are not reproduced here.',
      cards: [
        { name: 'Focus 10', tag: 'Mind awake, body asleep', body: 'A deeply relaxed state in which the body is asleep while awareness stays clear. The usual starting point of the Gateway program.', load: { carrierHz: 100, beatHz: 4, mode: 'offset', label: 'L 100 Hz / R 104 Hz (4 Hz)' } },
        { name: 'Focus 12', tag: 'Expanded awareness', body: 'Described as awareness extending beyond ordinary physical perception, usually explored from a stable Focus 10.', load: { carrierHz: 100, beatHz: 7, mode: 'offset', label: 'L 100 Hz / R 107 Hz (7 Hz)' } },
        { name: 'Focus 15', tag: 'No time', body: 'Described as a state beyond the usual sense of time, reached through very slow rhythms.', load: { carrierHz: 100, beatHz: 3, mode: 'offset', label: 'L 100 Hz / R 103 Hz (3 Hz)' } },
        { name: 'Focus 21', tag: 'Edge of time-space', body: 'In Monroe\'s model, the bridge to other energy systems. Associated with the slowest, deepest rhythms.', load: { carrierHz: 100, beatHz: 1.5, mode: 'offset', label: 'L 100 Hz / R 101.5 Hz (1.5 Hz)' } }
      ]
    },
    {
      title: 'Hemi-Sync mechanics',
      cards: [
        { name: 'How a binaural beat forms', tag: 'Brainstem processing', body: 'Each ear receives a steady pure tone at a slightly different frequency. The brainstem (superior olivary complex) combines them, and you perceive a pulse at the difference frequency. The mechanism is thought to involve the frequency-following response. Stereo headphones are required: speakers mix the channels in the air and the effect disappears.', load: { carrierHz: 100, beatHz: 4, mode: 'offset', label: 'Classic 100 Hz / 104 Hz pair' } },
        { name: 'Practical limits', tag: 'Carrier and beat range', body: 'Carriers below roughly 1000 Hz work best. The perceived beat is clearest below about 30 Hz, so faster targets (gamma) are better served by an isochronic pulse layered on top. Hemi-Sync is Monroe\'s trademarked method that blends such tones with music or noise.' },
        { name: '1983 Army assessment', tag: 'Historical document', body: '"Analysis and Assessment of the Gateway Process" (Wayne M. McDonnell, 1983) is a declassified US Army Intelligence report evaluating the Gateway technique using holographic and quantum language. It is a speculative assessment, not experimental validation.' }
      ]
    },
    {
      title: 'Brainwave frequency correlates',
      intro: 'Typical associations only. Individual response varies widely.',
      cards: [
        { name: 'Delta  0.5-4 Hz', tag: 'Deep sleep', body: 'Dominant in dreamless slow-wave sleep and physical restoration.', load: { carrierHz: 200, beatHz: 2, mode: 'symmetric', label: '200 Hz carrier, 2 Hz beat' } },
        { name: 'Theta  4-8 Hz', tag: 'Drowsy, meditative', body: 'Seen in light sleep onset, deep meditation and hypnagogic imagery.', load: { carrierHz: 200, beatHz: 6, mode: 'symmetric', label: '200 Hz carrier, 6 Hz beat' } },
        { name: 'Alpha  8-14 Hz', tag: 'Relaxed wakefulness', body: 'Prominent with eyes closed and calm, alert rest.', load: { carrierHz: 200, beatHz: 10, mode: 'symmetric', label: '200 Hz carrier, 10 Hz beat' } },
        { name: 'Beta  14-30 Hz', tag: 'Active thinking', body: 'Associated with alertness, concentration and problem solving.', load: { carrierHz: 220, beatHz: 16, mode: 'symmetric', label: '220 Hz carrier, 16 Hz beat' } },
        { name: 'Gamma  30-100 Hz', tag: 'High-frequency cognition', body: 'Studied in attention and perceptual binding. 40 Hz is the most common target.', load: { carrierHz: 432, beatHz: 40, mode: 'symmetric', layerMix: { isochronic: 0.6 }, label: '432 Hz carrier, 40 Hz beat + isochronic' } }
      ]
    },
    {
      title: 'Evidence and safety',
      cards: [
        { name: 'Mixed evidence', tag: 'Read with care', body: 'Literature reviews of binaural beats and isochronic tones report inconsistent effects across studies, with small samples and varied protocols. Treat this as a relaxation and attention aid, not a treatment.' },
        { name: 'Safe listening', tag: 'Comfort first', body: 'Keep the volume comfortable, do not use while driving or operating machinery, and stop if you feel unwell. If you have a seizure disorder, check with a clinician first.' }
      ]
    }
  ];

  const drawer = $('blDrawer');
  const scrim = $('blScrim');
  const drawerBody = $('blDrawerBody');
  const drawerOpenBtn = $('blDrawerOpen');
  const drawerCloseBtn = $('blDrawerClose');

  function buildDrawer() {
    const note = document.createElement('p');
    note.className = 'bl-drawer-note';
    note.id = 'blDrawerNote';
    note.setAttribute('role', 'status');
    note.setAttribute('aria-live', 'polite');
    drawerBody.appendChild(note);

    RESEARCH.forEach((section) => {
      const s = document.createElement('section');
      s.className = 'bl-research-section';
      const h = document.createElement('h3');
      h.textContent = section.title;
      s.appendChild(h);
      if (section.intro) {
        const p = document.createElement('p');
        p.className = 'bl-hint';
        p.textContent = section.intro;
        s.appendChild(p);
      }
      section.cards.forEach((c) => {
        const card = document.createElement('article');
        card.className = 'bl-research-card';
        const head = document.createElement('header');
        const name = document.createElement('h4'); name.textContent = c.name;
        const tag = document.createElement('span'); tag.className = 'bl-tag'; tag.textContent = c.tag;
        head.append(name, tag);
        const body = document.createElement('p'); body.textContent = c.body;
        card.append(head, body);
        if (c.load) {
          const row = document.createElement('div'); row.className = 'bl-research-load';
          const spec = document.createElement('code'); spec.textContent = c.load.label;
          const btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'bl-btn bl-btn-ghost bl-btn-sm'; btn.textContent = 'Load frequency';
          btn.addEventListener('click', () => {
            const patch = { carrierHz: c.load.carrierHz, beatHz: c.load.beatHz, mode: c.load.mode };
            if (c.load.layerMix) patch.layerMix = c.load.layerMix;
            engine.setState(patch);
            markCustom();
            const msg = 'Tuned to ' + c.name.replace(/\s{2,}.*/, '') + ': ' + c.load.label + (engine.isPlaying ? '.' : '. Press Start Tone to listen.');
            $('blDrawerNote').textContent = msg;
            setStatus(msg, 'ok');
            btn.textContent = 'Loaded';
            setTimeout(() => { btn.textContent = 'Load frequency'; }, 1400);
          });
          row.append(spec, btn);
          card.appendChild(row);
        }
        s.appendChild(card);
      });
      drawerBody.appendChild(s);
    });
  }
  buildDrawer();

  function focusables() {
    return Array.from(drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((n) => !n.disabled);
  }

  function openDrawer() {
    drawer.removeAttribute('inert');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.add('is-open');
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add('is-open'));
    drawerOpenBtn.setAttribute('aria-expanded', 'true');
    drawerCloseBtn.focus();
  }

  function closeDrawer() {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    drawerOpenBtn.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!drawer.classList.contains('is-open')) scrim.hidden = true; }, 260);
    drawerOpenBtn.focus();
  }

  drawerOpenBtn.addEventListener('click', openDrawer);
  drawerCloseBtn.addEventListener('click', closeDrawer);
  scrim.addEventListener('click', closeDrawer);
  drawer.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.stopPropagation();
    if (e.key === 'Escape') { e.stopPropagation(); closeDrawer(); return; }
    if (e.key === 'Tab') {
      const items = focusables();
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  refreshPresetSelect('');
  updateExportSize();
  render(engine.getState());
})();
