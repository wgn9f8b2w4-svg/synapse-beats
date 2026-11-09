/**
 * Synapse.fm UI Controller & Real-Time Audio Visualizer
 */

document.addEventListener('DOMContentLoaded', () => {
  const engine = window.neuralAudioEngine;

  // DOM Elements
  const masterPlayBtn = document.getElementById('masterPlayBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const btnPulse = document.getElementById('btnPulse');
  const playbackBadge = document.getElementById('playbackBadge');
  const playbackStatusText = document.getElementById('playbackStatusText');

  // Telemetry & Headings
  const modeTitle = document.getElementById('modeTitle');
  const modeDescription = document.getElementById('modeDescription');
  const modeBandEyebrow = document.getElementById('modeBandEyebrow');
  const telemetryFreq = document.getElementById('telemetryFreq');
  const telemetryWave = document.getElementById('telemetryWave');
  const telemetryDepth = document.getElementById('telemetryDepth');
  const telemetryMasking = document.getElementById('telemetryMasking');

  // Sliders
  const masterVolumeSlider = document.getElementById('masterVolumeSlider');
  const maskingVolumeSlider = document.getElementById('maskingVolumeSlider');

  // Visualizer
  const canvas = document.getElementById('visualizerCanvas');
  const ctx = canvas.getContext('2d');
  const visualizerOverlay = document.getElementById('visualizerOverlay');
  const tabWaveform = document.getElementById('tabWaveform');
  const tabSpectrum = document.getElementById('tabSpectrum');
  let currentVisTab = 'waveform'; // 'waveform' or 'spectrum'

  // Timer
  const timerClock = document.getElementById('timerClock');
  const timerModeLabel = document.getElementById('timerModeLabel');
  let sessionMinutes = 0; // 0 = infinite
  let sessionSecondsRemaining = 0;
  let timerInterval = null;

  // Controls & Presets
  const modeCards = document.querySelectorAll('.mode-card');
  const segBtns = document.querySelectorAll('#neuralLevelControl .seg-btn');
  const soundscapeRadios = document.querySelectorAll('input[name="soundscape"]');
  const timerDurationBtns = document.querySelectorAll('.timer-presets .preset-btn');
  const quickProtocolBtns = document.querySelectorAll('.quick-presets-row .quick-protocol-btn');

  // Scale canvas resolution for high-DPI screens
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Update Telemetry Display
  function updateTelemetry() {
    const preset = engine.modePresets[engine.state.mode] || engine.modePresets.focus;
    const depthPercent = Math.round(engine.calculateEffectiveDepth() * 100);
    const maskingPercent = Math.round(engine.state.maskingVolume * 100);

    modeTitle.textContent = preset.name;
    modeDescription.textContent = preset.description;
    telemetryFreq.innerHTML = `${preset.freq.toFixed(1)} <small>Hz</small>`;
    telemetryDepth.innerHTML = `${depthPercent} <small>%</small>`;
    telemetryMasking.innerHTML = `${maskingPercent} <small>%</small>`;

    // Dynamic Cognitive State Accent Colors
    const modeColors = {
      focus: { accent: '#38bdf8', glow: 'rgba(56, 189, 248, 0.28)' },
      adhd: { accent: '#a855f7', glow: 'rgba(168, 85, 247, 0.28)' },
      flow: { accent: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.28)' },
      relax: { accent: '#34d399', glow: 'rgba(52, 211, 153, 0.28)' },
      meditate: { accent: '#fbbf24', glow: 'rgba(251, 191, 36, 0.28)' },
      sleep: { accent: '#818cf8', glow: 'rgba(129, 140, 248, 0.28)' },
      gamma: { accent: '#f43f5e', glow: 'rgba(244, 63, 94, 0.28)' }
    };
    const c = modeColors[engine.state.mode] || modeColors.focus;
    document.documentElement.style.setProperty('--active-accent', c.accent);
    document.documentElement.style.setProperty('--active-glow', c.glow);

    // Update Eyebrow and Subtitle
    if (preset.freq >= 35) {
      modeBandEyebrow.textContent = 'GAMMA WAVE TARGET (35 - 45 Hz)';
      telemetryWave.textContent = 'Gamma Rhythm';
    } else if (preset.freq >= 13) {
      modeBandEyebrow.textContent = 'BETA WAVE TARGET (13 - 30 Hz)';
      telemetryWave.textContent = 'Beta Rhythm';
    } else if (preset.freq >= 8) {
      modeBandEyebrow.textContent = 'ALPHA WAVE TARGET (8 - 12 Hz)';
      telemetryWave.textContent = 'Alpha Rhythm';
    } else if (preset.freq >= 4) {
      modeBandEyebrow.textContent = 'THETA WAVE TARGET (4 - 7 Hz)';
      telemetryWave.textContent = 'Theta Rhythm';
    } else {
      modeBandEyebrow.textContent = 'DELTA WAVE TARGET (0.5 - 3 Hz)';
      telemetryWave.textContent = 'Delta Rhythm';
    }

    // Update Mini Dock and Zen HUD elements
    const miniModeTitle = document.getElementById('miniModeTitle');
    const miniFreqBadge = document.getElementById('miniFreqBadge');
    if (miniModeTitle) miniModeTitle.textContent = preset.name.toUpperCase();
    if (miniFreqBadge) miniFreqBadge.textContent = `${preset.freq.toFixed(1)} Hz ${telemetryWave.textContent.replace(' Rhythm', '')}`;

    const zenTitle = document.getElementById('zenTitle');
    const zenSub = document.getElementById('zenSub');
    const zenModeBadge = document.getElementById('zenModeBadge');
    if (zenTitle) zenTitle.textContent = preset.name;
    if (zenSub) zenSub.textContent = `${preset.freq.toFixed(1)} Hz Cortical Phase-Locking`;
    if (zenModeBadge) zenModeBadge.textContent = modeBandEyebrow.textContent;

    // Sync button pulse animation duration with entrainment frequency
    const periodSeconds = 1.0 / preset.freq;
    const clampedPeriod = Math.max(0.4, Math.min(2.5, periodSeconds * (preset.freq > 10 ? 4 : 1)));
    btnPulse.style.animationDuration = `${clampedPeriod.toFixed(2)}s`;
  }

  // UI Sync Helpers
  function syncUiMode(targetMode) {
    modeCards.forEach(card => {
      const mode = card.getAttribute('data-mode');
      if (mode === targetMode) {
        card.classList.add('active');
        card.setAttribute('aria-checked', 'true');
      } else {
        card.classList.remove('active');
        card.setAttribute('aria-checked', 'false');
      }
    });

    // Sync Zen mode pills
    document.querySelectorAll('#zenModesPills .zen-pill').forEach(p => {
      if (p.getAttribute('data-mode') === targetMode) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
  }

  function syncUiSoundscape(targetSoundscape) {
    soundscapeRadios.forEach(radio => {
      if (radio.value === targetSoundscape) {
        radio.checked = true;
      }
    });
  }

  function syncUiNeuralLevel(targetLevel) {
    segBtns.forEach(btn => {
      if (btn.getAttribute('data-level') === targetLevel) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Toggle Play / Pause
  async function togglePlay() {
    const miniPlayIcon = document.getElementById('miniPlayIcon');
    const miniPauseIcon = document.getElementById('miniPauseIcon');
    const zenPlayIcon = document.getElementById('zenPlayIcon');
    const zenPauseIcon = document.getElementById('zenPauseIcon');

    if (!engine.isPlaying) {
      await engine.play();
      masterPlayBtn.classList.add('playing');
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      if (miniPlayIcon) miniPlayIcon.style.display = 'none';
      if (miniPauseIcon) miniPauseIcon.style.display = 'block';
      if (zenPlayIcon) zenPlayIcon.style.display = 'none';
      if (zenPauseIcon) zenPauseIcon.style.display = 'block';
      playbackBadge.classList.add('active');
      playbackStatusText.textContent = 'Engine Active';
      visualizerOverlay.classList.add('hidden');
      startSessionTimer();
    } else {
      engine.pause();
      masterPlayBtn.classList.remove('playing');
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      if (miniPlayIcon) miniPlayIcon.style.display = 'block';
      if (miniPauseIcon) miniPauseIcon.style.display = 'none';
      if (zenPlayIcon) zenPlayIcon.style.display = 'block';
      if (zenPauseIcon) zenPauseIcon.style.display = 'none';
      playbackBadge.classList.remove('active');
      playbackStatusText.textContent = 'Engine Paused';
      visualizerOverlay.classList.remove('hidden');
      pauseSessionTimer();
    }
    updateTelemetry();
  }

  masterPlayBtn.addEventListener('click', togglePlay);

  // Mode Selection Cards
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      syncUiMode(card.getAttribute('data-mode'));
      quickProtocolBtns.forEach(b => b.classList.remove('active'));
      const mode = card.getAttribute('data-mode');
      engine.setMode(mode);
      updateTelemetry();
    });
  });

  // Neural Effect Intensity Selection
  segBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      segBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const level = btn.getAttribute('data-level');
      engine.setNeuralEffectLevel(level);
      updateTelemetry();
    });
  });

  // Soundscape Selection
  soundscapeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      engine.setSoundscape(radio.value);
    });
  });

  // Audio Sliders
  masterVolumeSlider.addEventListener('input', (e) => {
    engine.setMasterVolume(parseFloat(e.target.value));
  });

  maskingVolumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    engine.setMaskingVolume(val);
    updateTelemetry();
  });

  // Visualizer Tab Switching
  tabWaveform.addEventListener('click', () => {
    tabWaveform.classList.add('active');
    tabSpectrum.classList.remove('active');
    currentVisTab = 'waveform';
  });

  tabSpectrum.addEventListener('click', () => {
    tabSpectrum.classList.add('active');
    tabWaveform.classList.remove('active');
    currentVisTab = 'spectrum';
  });

  // Timer Duration Presets
  timerDurationBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      timerDurationBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sessionMinutes = parseInt(btn.getAttribute('data-minutes'), 10);
      initTimer();
    });
  });

  // Dedicated Neural Quick Presets Protocol Handler
  quickProtocolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      quickProtocolBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const presetKey = btn.getAttribute('data-preset');
      const minutes = parseInt(btn.getAttribute('data-minutes') || '25', 10);

      if (presetKey === 'gamma-breakthrough') {
        engine.setMode('gamma');
        engine.setSoundscape('cosmic');
        engine.setNeuralEffectLevel('high');
        syncUiMode('adhd');
        syncUiSoundscape('cosmic');
        syncUiNeuralLevel('high');
      } else if (presetKey === 'theta-renewal') {
        engine.setMode('meditate');
        engine.setSoundscape('ethereal');
        engine.setNeuralEffectLevel('medium');
        syncUiMode('meditate');
        syncUiSoundscape('ethereal');
        syncUiNeuralLevel('medium');
      } else if (presetKey === 'delta-reset') {
        engine.setMode('sleep');
        engine.setSoundscape('pink-brown');
        engine.setNeuralEffectLevel('high');
        syncUiMode('sleep');
        syncUiSoundscape('pink-brown');
        syncUiNeuralLevel('high');
      }

      // Sync Timer Minutes
      sessionMinutes = minutes;
      sessionSecondsRemaining = sessionMinutes * 60;
      updateTimerDisplay();
      timerModeLabel.textContent = `${sessionMinutes}m Session`;

      timerDurationBtns.forEach(b => {
        if (parseInt(b.getAttribute('data-minutes'), 10) === minutes) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });

      updateTelemetry();
    });
  });

  function initTimer() {
    const miniTimer = document.getElementById('miniTimer');
    const zenTimer = document.getElementById('zenTimer');
    if (sessionMinutes === 0) {
      timerClock.textContent = '--:--';
      timerModeLabel.textContent = 'Infinite Stream';
      if (miniTimer) miniTimer.textContent = '--:--';
      if (zenTimer) zenTimer.textContent = '--:--';
      if (timerInterval) clearInterval(timerInterval);
    } else {
      sessionSecondsRemaining = sessionMinutes * 60;
      updateTimerDisplay();
      timerModeLabel.textContent = `${sessionMinutes}m Session`;
    }
  }

  function startSessionTimer() {
    if (sessionMinutes === 0) return;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (sessionSecondsRemaining > 0) {
        sessionSecondsRemaining--;
        updateTimerDisplay();
      } else {
        clearInterval(timerInterval);
        togglePlay();
        alert('Your focus session is complete! Take a restorative break.');
        initTimer();
      }
    }, 1000);
  }

  function pauseSessionTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    const mins = Math.floor(sessionSecondsRemaining / 60);
    const secs = sessionSecondsRemaining % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    timerClock.textContent = formatted;
    const miniTimer = document.getElementById('miniTimer');
    const zenTimer = document.getElementById('zenTimer');
    if (miniTimer) miniTimer.textContent = formatted;
    if (zenTimer) zenTimer.textContent = formatted;
  }

  // Real-Time Canvas Render Loop
  function renderVisualizer() {
    requestAnimationFrame(renderVisualizer);

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    if (!engine.isPlaying || !engine.analyser) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }

    const { timeData, freqData } = engine.getVisualizationData();
    if (!timeData || !freqData) return;

    if (currentVisTab === 'waveform') {
      // Oscilloscope showing AM modulation envelope
      ctx.beginPath();
      ctx.lineWidth = 2.5;

      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, '#00f2fe');
      gradient.addColorStop(0.5, '#4facfe');
      gradient.addColorStop(1, '#b026ff');
      ctx.strokeStyle = gradient;

      const sliceWidth = w / timeData.length;
      let x = 0;

      for (let i = 0; i < timeData.length; i++) {
        const v = timeData[i] / 128.0;
        const y = (v * h) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();

      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(0, 242, 254, 0.5)';
      ctx.stroke();
      ctx.shadowBlur = 0;

    } else {
      // Acoustic FFT Spectrum
      const bufferLength = freqData.length;
      const barCount = 64;
      const barWidth = (w / barCount) - 2;

      for (let i = 0; i < barCount; i++) {
        const freqIndex = Math.floor(Math.pow(i / barCount, 2.0) * (bufferLength / 2));
        const val = freqData[freqIndex] || 0;
        const barHeight = (val / 255) * (h - 10);

        const x = i * (barWidth + 2);
        const y = h - barHeight;

        const barGradient = ctx.createLinearGradient(0, h, 0, 0);
        barGradient.addColorStop(0, 'rgba(0, 242, 254, 0.4)');
        barGradient.addColorStop(1, 'rgba(176, 38, 255, 0.9)');

        ctx.fillStyle = barGradient;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    }

    // Render Winamp Mini Scope (if visible)
    if (miniCtx && miniCanvas && miniDock && !miniDock.hidden) {
      const mw = 80;
      const mh = 26;
      miniCtx.fillStyle = '#000000';
      miniCtx.fillRect(0, 0, mw, mh);

      if (timeData && engine.isPlaying) {
        miniCtx.beginPath();
        miniCtx.lineWidth = 1.5;
        miniCtx.strokeStyle = '#38bdf8';
        const sliceW = mw / timeData.length;
        let mx = 0;
        for (let i = 0; i < timeData.length; i++) {
          const v = timeData[i] / 128.0;
          const my = (v * mh) / 2;
          if (i === 0) miniCtx.moveTo(mx, my);
          else miniCtx.lineTo(mx, my);
          mx += sliceW;
        }
        miniCtx.stroke();
      } else {
        miniCtx.beginPath();
        miniCtx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        miniCtx.moveTo(0, mh / 2);
        miniCtx.lineTo(mw, mh / 2);
        miniCtx.stroke();
      }
    }

    // Render Brain.fm Zen Kinetic Flow Visualizer (if visible)
    if (zenCtx && zenCanvas && zenOverlay && !zenOverlay.hidden) {
      const zw = window.innerWidth;
      const zh = window.innerHeight;
      zenCtx.clearRect(0, 0, zw, zh);

      const now = performance.now() * 0.001;
      const preset = engine.modePresets[engine.state.mode] || engine.modePresets.focus;
      const freq = preset.freq || 16;
      const pulseRate = freq * 0.25; // scaled for optical comfort
      const pulseScale = 1.0 + (Math.sin(now * pulseRate * Math.PI) * 0.08);

      const cx = zw / 2;
      const cy = zh / 2;
      const baseRadius = Math.min(zw, zh) * 0.22 * pulseScale;

      // Outer breathing aura ring
      const grad = zenCtx.createRadialGradient(cx, cy, baseRadius * 0.4, cx, cy, baseRadius * 1.5);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
      grad.addColorStop(0.5, 'rgba(168, 85, 247, 0.08)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      zenCtx.fillStyle = grad;
      zenCtx.beginPath();
      zenCtx.arc(cx, cy, baseRadius * 1.6, 0, Math.PI * 2);
      zenCtx.fill();

      // Kinetic sacred geometry orbital nodes
      if (engine.isPlaying && timeData) {
        const rings = 3;
        for (let r = 0; r < rings; r++) {
          zenCtx.beginPath();
          zenCtx.strokeStyle = r === 0 ? 'rgba(56, 189, 248, 0.5)' : (r === 1 ? 'rgba(168, 85, 247, 0.35)' : 'rgba(45, 212, 191, 0.3)');
          zenCtx.lineWidth = 1.5;

          const points = 36;
          for (let p = 0; p <= points; p++) {
            const angle = (p / points) * Math.PI * 2 + (now * (r % 2 === 0 ? 0.3 : -0.3));
            const dataIdx = Math.floor((p / points) * (timeData.length - 1));
            const audioOffset = ((timeData[dataIdx] - 128) / 128) * 16 * (r + 1);
            const radius = (baseRadius + (r * 28)) + audioOffset;
            const px = cx + Math.cos(angle) * radius;
            const py = cy + Math.sin(angle) * radius;

            if (p === 0) zenCtx.moveTo(px, py);
            else zenCtx.lineTo(px, py);
          }
          zenCtx.closePath();
          zenCtx.stroke();
        }
      }
    }
  }

  // =========================================================================
  // Header Navigation & Section Smooth Scroll
  // =========================================================================
  const navNeuralStream = document.getElementById('navNeuralStream');
  const navBinauralLab = document.getElementById('navBinauralLab');
  const btnToggleMiniPlayer = document.getElementById('btnToggleMiniPlayer');
  const btnToggleZen = document.getElementById('btnToggleZen');
  const visZenBtn = document.getElementById('visZenBtn');

  if (navNeuralStream) {
    navNeuralStream.addEventListener('click', () => {
      navNeuralStream.classList.add('active');
      if (navBinauralLab) navBinauralLab.classList.remove('active');
      const panel = document.querySelector('.player-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (navBinauralLab) {
    navBinauralLab.addEventListener('click', () => {
      navBinauralLab.classList.add('active');
      if (navNeuralStream) navNeuralStream.classList.remove('active');
      const bl = document.getElementById('binauralLab');
      if (bl) bl.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // =========================================================================
  // myNoise Multi-Stem Acoustic Mixer Rack
  // =========================================================================
  const stemSliders = {
    harmony: document.getElementById('stemHarmonySlider'),
    rhythm: document.getElementById('stemRhythmSlider'),
    texture: document.getElementById('stemTextureSlider'),
    masking: document.getElementById('stemMaskingSlider')
  };
  const stemMutes = {
    harmony: document.getElementById('muteStemHarmony'),
    rhythm: document.getElementById('muteStemRhythm'),
    texture: document.getElementById('muteStemTexture'),
    masking: document.getElementById('muteStemMasking')
  };
  const stemVals = {
    harmony: document.getElementById('stemHarmonyVal'),
    rhythm: document.getElementById('stemRhythmVal'),
    texture: document.getElementById('stemTextureVal'),
    masking: document.getElementById('stemMaskingVal')
  };

  const stemGains = {
    harmony: 0.8,
    rhythm: 0.65,
    texture: 0.4,
    masking: 0.35
  };

  function updateStemGain(stemName, val) {
    stemGains[stemName] = val;
    if (stemVals[stemName]) stemVals[stemName].textContent = `${Math.round(val * 100)}%`;

    if (engine.ctx && engine.isPlaying) {
      const now = engine.ctx.currentTime;
      if (stemName === 'harmony' && engine.harmonyGain) {
        engine.harmonyGain.gain.setTargetAtTime(val, now, 0.03);
      } else if (stemName === 'rhythm' && engine.rhythmGain) {
        engine.rhythmGain.gain.setTargetAtTime(val, now, 0.03);
      } else if (stemName === 'texture' && engine.textureGain) {
        engine.textureGain.gain.setTargetAtTime(val, now, 0.03);
        if (engine.vinylGain) engine.vinylGain.gain.setTargetAtTime(val * 0.6, now, 0.03);
      } else if (stemName === 'masking' && engine.maskingGain) {
        engine.setMaskingVolume(val);
        if (maskingVolumeSlider) maskingVolumeSlider.value = val;
        const sv = document.getElementById('spatialVal');
        if (sv) sv.textContent = `${Math.round(val * 100)}%`;
      }
    }
  }

  Object.keys(stemSliders).forEach(key => {
    const slider = stemSliders[key];
    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        updateStemGain(key, val);
        if (stemMutes[key]) stemMutes[key].classList.remove('is-muted');
      });
    }

    const muteBtn = stemMutes[key];
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const isMuted = muteBtn.classList.toggle('is-muted');
        if (isMuted) {
          if (engine.ctx) {
            const now = engine.ctx.currentTime;
            if (key === 'harmony' && engine.harmonyGain) engine.harmonyGain.gain.setTargetAtTime(0.0001, now, 0.03);
            if (key === 'rhythm' && engine.rhythmGain) engine.rhythmGain.gain.setTargetAtTime(0.0001, now, 0.03);
            if (key === 'texture' && engine.textureGain) engine.textureGain.gain.setTargetAtTime(0.0001, now, 0.03);
            if (key === 'masking' && engine.maskingGain) engine.maskingGain.gain.setTargetAtTime(0.0001, now, 0.03);
          }
          if (stemVals[key]) stemVals[key].textContent = '0%';
        } else {
          updateStemGain(key, stemGains[key]);
        }
      });
    }
  });

  // =========================================================================
  // Winamp Windowshade / Floating Mini-Player Dock
  // =========================================================================
  const miniDock = document.getElementById('miniDock');
  const miniPlayBtn = document.getElementById('miniPlayBtn');
  const miniPrevMode = document.getElementById('miniPrevMode');
  const miniNextMode = document.getElementById('miniNextMode');
  const miniVolumeSlider = document.getElementById('miniVolumeSlider');
  const miniExpandBtn = document.getElementById('miniExpandBtn');
  const miniCanvas = document.getElementById('miniVisualizer');
  const miniCtx = miniCanvas ? miniCanvas.getContext('2d') : null;

  const modesSequence = ['focus', 'adhd', 'flow', 'relax', 'meditate', 'sleep'];

  function toggleMiniDock(forceState) {
    if (!miniDock) return;
    const shouldShow = forceState !== undefined ? forceState : miniDock.hidden;
    miniDock.hidden = !shouldShow;
    if (btnToggleMiniPlayer) {
      btnToggleMiniPlayer.classList.toggle('active', shouldShow);
    }
  }

  if (btnToggleMiniPlayer) {
    btnToggleMiniPlayer.addEventListener('click', () => toggleMiniDock());
  }

  if (miniPlayBtn) {
    miniPlayBtn.addEventListener('click', togglePlay);
  }

  if (miniVolumeSlider) {
    miniVolumeSlider.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      engine.setMasterVolume(v);
      if (masterVolumeSlider) masterVolumeSlider.value = v;
      const vv = document.getElementById('volVal');
      if (vv) vv.textContent = `${Math.round(v * 100)}%`;
    });
  }

  function cycleMode(delta) {
    let idx = modesSequence.indexOf(engine.state.mode);
    if (idx === -1) idx = 0;
    idx = (idx + delta + modesSequence.length) % modesSequence.length;
    const next = modesSequence[idx];
    engine.setMode(next);
    syncUiMode(next);
    updateTelemetry();
  }

  if (miniPrevMode) miniPrevMode.addEventListener('click', () => cycleMode(-1));
  if (miniNextMode) miniNextMode.addEventListener('click', () => cycleMode(1));
  if (miniExpandBtn) miniExpandBtn.addEventListener('click', () => toggleMiniDock(false));

  // =========================================================================
  // Brain.fm Full-Screen Zen Immersion Mode
  // =========================================================================
  const zenOverlay = document.getElementById('zenOverlay');
  const zenPlayBtn = document.getElementById('zenPlayBtn');
  const zenCloseBtn = document.getElementById('zenCloseBtn');
  const zenControls = document.getElementById('zenControls');
  const zenCanvas = document.getElementById('zenCanvas');
  const zenCtx = zenCanvas ? zenCanvas.getContext('2d') : null;

  function resizeZenCanvas() {
    if (!zenCanvas) return;
    zenCanvas.width = window.innerWidth * window.devicePixelRatio;
    zenCanvas.height = window.innerHeight * window.devicePixelRatio;
    if (zenCtx) zenCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }
  window.addEventListener('resize', resizeZenCanvas);

  function toggleZenMode(forceState) {
    if (!zenOverlay) return;
    const shouldShow = forceState !== undefined ? forceState : zenOverlay.hidden;
    zenOverlay.hidden = !shouldShow;
    if (btnToggleZen) btnToggleZen.classList.toggle('active', shouldShow);
    if (shouldShow) {
      resizeZenCanvas();
      updateTelemetry();
    }
  }

  if (btnToggleZen) btnToggleZen.addEventListener('click', () => toggleZenMode());
  if (visZenBtn) visZenBtn.addEventListener('click', () => toggleZenMode(true));
  if (zenCloseBtn) zenCloseBtn.addEventListener('click', () => toggleZenMode(false));
  if (zenPlayBtn) zenPlayBtn.addEventListener('click', togglePlay);

  document.querySelectorAll('#zenModesPills .zen-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const mode = pill.getAttribute('data-mode');
      engine.setMode(mode);
      syncUiMode(mode);
      updateTelemetry();
    });
  });

  // Auto-hide Zen floating transport pill after 3s of mouse inactivity
  let zenHideTimer = null;
  if (zenOverlay) {
    zenOverlay.addEventListener('mousemove', () => {
      if (zenControls) zenControls.classList.remove('is-hidden');
      if (zenHideTimer) clearTimeout(zenHideTimer);
      zenHideTimer = setTimeout(() => {
        if (!zenOverlay.hidden && zenControls) {
          zenControls.classList.add('is-hidden');
        }
      }, 3000);
    });
  }

  function isTextEditingTarget(target) {
    if (!target) return false;
    const tag = (target.tagName || '').toUpperCase();
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      const type = (target.type || 'text').toLowerCase();
      return ['text', 'search', 'number', 'email', 'password', 'tel', 'url'].includes(type);
    }
    return target.isContentEditable === true;
  }

  // Keyboard Shortcuts: Space (Play), M (Mini Player), F (Zen), Esc (Exit Zen/Mini)
  window.addEventListener('keydown', (e) => {
    if (isTextEditingTarget(e.target)) return;

    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      toggleMiniDock();
    } else if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleZenMode();
    } else if (e.code === 'Escape' || e.key === 'Escape') {
      if (zenOverlay && !zenOverlay.hidden) {
        toggleZenMode(false);
      } else if (miniDock && !miniDock.hidden) {
        toggleMiniDock(false);
      }
    }
  });

  // Initial setup
  updateTelemetry();
  renderVisualizer();
});
