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
    if (!engine.isPlaying) {
      await engine.play();
      masterPlayBtn.classList.add('playing');
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      playbackBadge.classList.add('active');
      playbackStatusText.textContent = 'Engine Active';
      visualizerOverlay.classList.add('hidden');
      startSessionTimer();
    } else {
      engine.pause();
      masterPlayBtn.classList.remove('playing');
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      playbackBadge.classList.remove('active');
      playbackStatusText.textContent = 'Engine Paused';
      visualizerOverlay.classList.remove('hidden');
      pauseSessionTimer();
    }
    updateTelemetry();
  }

  masterPlayBtn.addEventListener('click', togglePlay);

  // Keyboard shortcut: Spacebar toggles playback
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      togglePlay();
    }
  });

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
    if (sessionMinutes === 0) {
      timerClock.textContent = '--:--';
      timerModeLabel.textContent = 'Infinite Stream';
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
    timerClock.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
  }

  // Initial setup
  updateTelemetry();
  renderVisualizer();
});
