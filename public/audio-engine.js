/**
 * Synapse.fm Multi-Stem Neural Audio Engine
 * Clean-Room REA Implementation with Acoustically Distinct Soundscapes
 * 
 * Features:
 * 1. Multi-Stem Architecture:
 *    - Stem 1: Harmonic Keys & Bed (FM Rhodes, Cosmic Poly, Singing Bowls, Sub-Bass)
 *    - Stem 2: Rhythmic Pulse & Arpeggiator (16th-note ADHD plucks, 8th-note Focus pulses, Delta swells)
 *    - Stem 3: Organic Textures (Procedural Vinyl Crackle, Rain Droplets)
 *    - Stem 4: Dynamic Acoustic Masking (Pink & Brown Noise bed)
 * 2. True Neural Phase-Locking (AM Amplitude Modulation):
 *    - Gamma (40 Hz), Beta (16 Hz), Alpha-Beta (13 Hz), Alpha (10 Hz), Theta (5.5 Hz), Delta (1.5 Hz)
 * 3. Instant 200ms Responsive Crossfading on State Switch
 */

class NeuralAudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;

    // Master bus
    this.masterGain = null;
    this.analyser = null;

    // Carrier & AM Modulator nodes
    this.carrierGain = null;
    this.amModulator = null;
    this.amDepthNode = null;

    // Stem Gains
    this.harmonyGain = null;
    this.rhythmGain = null;
    this.textureGain = null;
    this.maskingGain = null;

    // Masking & Vinyl nodes
    this.noiseNode = null;
    this.noiseFilter = null;
    this.vinylNode = null;
    this.vinylGain = null;

    // Spatial Panner
    this.pannerNode = null;
    this.pannerLfo = null;

    // Clocks and active voices
    this.activeVoices = [];
    this.chordTimer = null;
    this.compositionTimer = null;
    this.arpTimer = null;
    this.chordStep = 0;
    this.arpStep = 0;

    // Current State
    this.state = {
      mode: 'focus',              // 'focus', 'adhd', 'flow', 'relax', 'meditate', 'sleep', 'gamma'
      neuralEffectLevel: 'high',   // 'low' (0.25), 'medium' (0.55), 'high' (0.85)
      soundscape: 'cosmic',       // 'cosmic', 'lofi', 'ethereal', 'pink-brown', 'rain-filtered', 'sub-bass', 'pure-iso'
      masterVolume: 0.8,
      maskingVolume: 0.35,
      modulationFrequency: 16.0,
      modulationDepth: 0.70
    };

    // Mode Presets (Calibrated from Brain.fm patents & neuro-modulation studies)
    this.modePresets = {
      focus: {
        name: 'Deep Focus',
        freq: 16.0,          // Beta band (Woods et al. 2024 Communications Biology)
        defaultDepth: 0.65,
        tempoBpm: 104,       // Driving rhythmic focus
        scale: ['D3', 'F3', 'G3', 'A3', 'C4', 'D4', 'E4', 'F4'],
        bassNotes: ['D2', 'G2', 'A2', 'D2'],
        filterCutoff: 1600,
        rhythmPattern: 'focus-8th', // Steady 8th-note harmonic pulses
        description: '16 Hz Beta entrainment optimizes sustained executive attention and cognitive stamina.'
      },
      adhd: {
        name: 'ADHD Boost',
        freq: 16.0,          // 16 Hz High-depth Beta
        defaultDepth: 0.85,
        tempoBpm: 122,       // Fast, high-energy forward momentum
        scale: ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'E4'],
        bassNotes: ['A1', 'C2', 'D2', 'E2'],
        filterCutoff: 2200,
        rhythmPattern: 'adhd-16th', // 16th-note driving arpeggio keeps under-stimulated minds locked in
        description: 'High-depth 16 Hz modulation with driving 16th-note arpeggiator to curb mind-wandering.'
      },
      flow: {
        name: 'Creative Flow',
        freq: 13.0,          // Alpha-Beta boundary
        defaultDepth: 0.50,
        tempoBpm: 78,        // Relaxed lo-fi groove
        scale: ['G2', 'Bb2', 'C3', 'D3', 'F3', 'G3', 'Bb3', 'D4'],
        bassNotes: ['G1', 'Eb2', 'Bb1', 'F2'],
        filterCutoff: 1200,
        rhythmPattern: 'flow-swing', // Relaxed swing pulse
        description: '13 Hz Alpha-Beta bridging promotes divergent thinking and effortless problem-solving.'
      },
      relax: {
        name: 'Relax & Recharge',
        freq: 10.0,          // Alpha band
        defaultDepth: 0.45,
        tempoBpm: 54,        // Slow breathing tempo
        scale: ['C3', 'E3', 'G3', 'B3', 'D4', 'G4'],
        bassNotes: ['C2', 'G2', 'A1', 'F2'],
        filterCutoff: 850,
        rhythmPattern: 'relax-chords', // Pure gentle breathing chords, zero drums
        description: '10 Hz Alpha waves reduce autonomic nervous system arousal and encourage calm alertness.'
      },
      meditate: {
        name: 'Meditation & Zen',
        freq: 5.5,           // Theta band
        defaultDepth: 0.55,
        tempoBpm: 40,        // Very slow introspective tempo
        scale: ['E2', 'B2', 'E3', 'G3', 'B3', 'D4'],
        bassNotes: ['E1', 'B1', 'E2'],
        filterCutoff: 650,
        rhythmPattern: 'meditate-bells', // Sporadic singing bowl chimes and harmonic drones
        description: '5.5 Hz Theta entrainment supports deep introspective contemplation and mental stillness.'
      },
      sleep: {
        name: 'Deep Sleep',
        freq: 1.5,           // Delta band (US Patent 10,653,857)
        defaultDepth: 0.70,
        tempoBpm: 32,        // Ultra-slow delta pulse
        scale: ['F1', 'C2', 'F2', 'Ab2', 'C3'],
        bassNotes: ['F1', 'C1', 'Db1', 'Eb1'],
        filterCutoff: 180,   // Low-pass cuts off ALL mid/high frequencies (< 180 Hz)
        rhythmPattern: 'sleep-swells', // Sub-bass oceanic swell, dark & soothing
        description: '1.5 Hz Delta waves guide the cortex into deep slow-wave restorative sleep cycles.'
      },
      gamma: {
        name: 'Gamma Breakthrough',
        freq: 40.0,          // Gamma band (High cognitive binding)
        defaultDepth: 0.85,
        tempoBpm: 128,       // Hyper-focus speed
        scale: ['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'E4'],
        bassNotes: ['C2', 'G1', 'A1', 'F1'],
        filterCutoff: 2600,
        rhythmPattern: 'gamma-pulse', // Rapid 40 Hz gated rhythmic pulse
        description: '40 Hz Gamma entrainment maximizes cross-cortical information processing and peak focus.'
      }
    };
  }

  /**
   * Initializes Web Audio Context on user interaction
   */
  async init() {
    if (this.ctx) return;
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // 1. Master Output Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.state.masterVolume, this.ctx.currentTime);

    // 2. FFT Analyser
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // 3. 3D Spatial Panner
    if (this.ctx.createStereoPanner) {
      this.pannerNode = this.ctx.createStereoPanner();
      this.pannerNode.connect(this.masterGain);

      // Panning LFO (0.04 Hz gentle stereophonic drift)
      this.pannerLfo = this.ctx.createOscillator();
      this.pannerLfo.frequency.setValueAtTime(0.04, this.ctx.currentTime);
      const pannerGain = this.ctx.createGain();
      pannerGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.pannerLfo.connect(pannerGain);
      pannerGain.connect(this.pannerNode.pan);
      this.pannerLfo.start();
    }

    // 4. Carrier Gain Node (Subject to Neural Amplitude Modulation)
    this.carrierGain = this.ctx.createGain();
    this.carrierGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    if (this.pannerNode) {
      this.carrierGain.connect(this.pannerNode);
    } else {
      this.carrierGain.connect(this.masterGain);
    }

    // 5. Individual Stem Buses
    this.harmonyGain = this.ctx.createGain();
    this.harmonyGain.gain.setValueAtTime(0.70, this.ctx.currentTime);
    this.harmonyGain.connect(this.carrierGain);

    this.rhythmGain = this.ctx.createGain();
    this.rhythmGain.gain.setValueAtTime(0.65, this.ctx.currentTime);
    this.rhythmGain.connect(this.carrierGain);

    this.textureGain = this.ctx.createGain();
    this.textureGain.gain.setValueAtTime(0.40, this.ctx.currentTime);
    this.textureGain.connect(this.carrierGain);

    // 6. Setup Neural Phase-Locking (AM) Modulator
    this.setupAmModulator();

    // 7. Setup Acoustic Masking (Pink/Brown noise) & Vinyl Crackle
    this.setupAcousticMasking();
    this.setupVinylCrackle();
  }

  /**
   * Patented Rapid Amplitude Modulation (AM)
   */
  setupAmModulator() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const preset = this.modePresets[this.state.mode] || this.modePresets.focus;
    const targetFreq = preset.freq;
    const depth = this.calculateEffectiveDepth();

    if (this.amModulator) {
      try { this.amModulator.stop(); } catch(e) {}
      this.amModulator.disconnect();
    }
    if (this.amDepthNode) {
      this.amDepthNode.disconnect();
    }

    this.amModulator = this.ctx.createOscillator();
    this.amModulator.type = 'sine';
    this.amModulator.frequency.setValueAtTime(targetFreq, now);

    this.amDepthNode = this.ctx.createGain();
    const modGainValue = depth * 0.48;
    this.amDepthNode.gain.setValueAtTime(modGainValue, now);

    this.amModulator.connect(this.amDepthNode);
    this.amDepthNode.connect(this.carrierGain.gain);

    const baseGain = 1.0 - (depth * 0.48);
    this.carrierGain.gain.setValueAtTime(baseGain, now);

    this.amModulator.start();
  }

  calculateEffectiveDepth() {
    const preset = this.modePresets[this.state.mode] || this.modePresets.focus;
    let multiplier = 1.0;
    if (this.state.neuralEffectLevel === 'low') multiplier = 0.45;
    if (this.state.neuralEffectLevel === 'medium') multiplier = 0.80;
    if (this.state.neuralEffectLevel === 'high') multiplier = 1.20;
    return Math.min(0.95, preset.defaultDepth * multiplier);
  }

  /**
   * Dynamic Acoustic Masking (Pink & Brown Noise Kellet Filter)
   */
  setupAcousticMasking() {
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let lastOut = 0.0;
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise integration
        const brown = (lastOut + (0.02 * white)) / 1.02;
        lastOut = brown;

        // Paul Kellet's Pink Noise Filter
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;

        // Blend 70% Brown + 30% Pink noise for warm, non-fatiguing acoustic masking
        data[i] = (brown * 3.5 * 0.70) + (pink * 0.11 * 0.30);
      }
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = buffer;
    this.noiseNode.loop = true;

    this.noiseFilter = this.ctx.createBiquadFilter();
    this.noiseFilter.type = 'lowpass';
    this.noiseFilter.frequency.setValueAtTime(600, this.ctx.currentTime);
    this.noiseFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

    this.maskingGain = this.ctx.createGain();
    this.maskingGain.gain.setValueAtTime(this.state.maskingVolume, this.ctx.currentTime);

    this.noiseNode.connect(this.noiseFilter);
    this.noiseFilter.connect(this.maskingGain);
    this.maskingGain.connect(this.masterGain);

    this.noiseNode.start();
  }

  /**
   * Procedural Lo-Fi Vinyl Crackle & Tape Texture
   */
  setupVinylCrackle() {
    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        // Stochastic micro-crackles
        if (Math.random() < 0.0007) {
          data[i] = (Math.random() * 2 - 1) * 0.45;
        } else {
          data[i] = (Math.random() * 2 - 1) * 0.005; // gentle tape hiss
        }
      }
    }

    this.vinylNode = this.ctx.createBufferSource();
    this.vinylNode.buffer = buffer;
    this.vinylNode.loop = true;

    const vinylFilter = this.ctx.createBiquadFilter();
    vinylFilter.type = 'bandpass';
    vinylFilter.frequency.setValueAtTime(2500, this.ctx.currentTime);
    vinylFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    this.vinylGain = this.ctx.createGain();
    const isLofi = this.state.soundscape === 'lofi';
    this.vinylGain.gain.setValueAtTime(isLofi ? 0.25 : 0.0001, this.ctx.currentTime);

    this.vinylNode.connect(vinylFilter);
    vinylFilter.connect(this.vinylGain);
    this.vinylGain.connect(this.masterGain);

    this.vinylNode.start();
  }

  noteToFreq(note) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = note.match(/^([A-G]#?)(\d)$/);
    if (!match) return 440;
    const name = match[1];
    const octave = parseInt(match[2], 10);
    const midi = (octave + 1) * 12 + notes.indexOf(name);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * Stem 1: Harmonic Keys & Bed Generator
   * Generates distinct timbres: FM Rhodes, Cosmic Poly, Singing Bowls, Sub-Bass
   */
  playHarmonicChord() {
    if (!this.ctx || !this.isPlaying) return;
    const now = this.ctx.currentTime;
    const preset = this.modePresets[this.state.mode] || this.modePresets.focus;
    const soundscape = this.state.soundscape;
    const chordDuration = (60 / preset.tempoBpm) * 4; // 1 bar duration

    // Pink/Brown Noise Bed: gentle sub-bass ocean swell voice
    if (soundscape === 'pink-brown') {
      const swellOsc = this.ctx.createOscillator();
      const swellGain = this.ctx.createGain();
      const swellFilter = this.ctx.createBiquadFilter();
      swellOsc.type = 'sine';
      swellOsc.frequency.setValueAtTime(55, now);
      swellFilter.type = 'lowpass';
      swellFilter.frequency.setValueAtTime(90, now);
      swellGain.gain.setValueAtTime(0.001, now);
      swellGain.gain.linearRampToValueAtTime(0.08, now + 1.0);
      swellGain.gain.linearRampToValueAtTime(0.001, now + chordDuration);
      swellOsc.connect(swellFilter);
      swellFilter.connect(swellGain);
      swellGain.connect(this.harmonyGain);
      swellOsc.start(now);
      swellOsc.stop(now + chordDuration + 0.1);
      this.activeVoices.push({ stop: () => { try { swellOsc.stop(); } catch(e){} } });
      return;
    }

    const scale = preset.scale;
    const rootIndex = (this.chordStep++) % scale.length;
    const chordNotes = [
      scale[rootIndex],
      scale[(rootIndex + 2) % scale.length],
      scale[(rootIndex + 4) % scale.length]
    ];
    const bassNote = preset.bassNotes[rootIndex % preset.bassNotes.length];
    const isSleep = this.state.mode === 'sleep';

    // 1. Play Root Sub-Bass Note
    if (bassNote) {
      const bFreq = this.noteToFreq(bassNote);
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      const bFilter = this.ctx.createBiquadFilter();

      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(bFreq, now);

      bFilter.type = 'lowpass';
      bFilter.frequency.setValueAtTime(isSleep ? 120 : 220, now);

      const bVol = isSleep ? 0.40 : 0.28;
      bGain.gain.setValueAtTime(0.001, now);
      bGain.gain.linearRampToValueAtTime(bVol, now + (isSleep ? 1.5 : 0.3));
      bGain.gain.setValueAtTime(bVol, now + chordDuration - 0.5);
      bGain.gain.linearRampToValueAtTime(0.001, now + chordDuration);

      bOsc.connect(bFilter);
      bFilter.connect(bGain);
      bGain.connect(this.harmonyGain);

      bOsc.start(now);
      bOsc.stop(now + chordDuration + 0.1);
      this.activeVoices.push({ stop: () => { try { bOsc.stop(); } catch(e){} } });
    }

    if (isSleep) return; // Sleep mode keeps only deep sub-bass & oceanic delta noise

    // 2. Play Distinct Soundscape Instrument
    chordNotes.forEach((note, idx) => {
      const freq = this.noteToFreq(note);

      if (soundscape === 'lofi') {
        // === LO-FI FM ELECTRIC PIANO (RHODES / WURLITZER) ===
        // Carrier (sine) + Modulator (sine at 2x freq for bell tine strike)
        const carrier = this.ctx.createOscillator();
        const modulator = this.ctx.createOscillator();
        const modIndex = this.ctx.createGain();
        const voiceGain = this.ctx.createGain();
        const toneFilter = this.ctx.createBiquadFilter();

        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(freq, now);

        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(freq * 2.0, now);

        // Fast decaying FM modulation for Rhodes bell tine attack
        modIndex.gain.setValueAtTime(freq * 1.5, now);
        modIndex.gain.exponentialRampToValueAtTime(1.0, now + 0.35);

        modulator.connect(modIndex);
        modIndex.connect(carrier.frequency);

        toneFilter.type = 'lowpass';
        toneFilter.frequency.setValueAtTime(1100, now);
        toneFilter.Q.setValueAtTime(0.8, now);

        voiceGain.gain.setValueAtTime(0.001, now);
        voiceGain.gain.linearRampToValueAtTime(0.18, now + 0.08); // snappy electric piano attack
        voiceGain.gain.exponentialRampToValueAtTime(0.05, now + 1.2);
        voiceGain.gain.exponentialRampToValueAtTime(0.001, now + chordDuration);

        carrier.connect(toneFilter);
        toneFilter.connect(voiceGain);
        voiceGain.connect(this.harmonyGain);

        modulator.start(now);
        carrier.start(now);
        modulator.stop(now + chordDuration);
        carrier.stop(now + chordDuration);

        this.activeVoices.push({ stop: () => { try { carrier.stop(); modulator.stop(); } catch(e){} } });

      } else if (soundscape === 'ethereal') {
        // === ETHEREAL TIBETAN SINGING BOWLS (ADDITIVE HARMONICS) ===
        // Fundamental + 2.76x Harmonic + 5.4x Overtone
        const freqs = [freq, freq * 2.76, freq * 5.4];
        const amps = [0.15, 0.06, 0.02];

        freqs.forEach((hFreq, hIdx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(hFreq, now);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(amps[hIdx], now + 0.8);
          gain.gain.exponentialRampToValueAtTime(0.001, now + chordDuration * 1.2);

          osc.connect(gain);
          gain.connect(this.harmonyGain);

          osc.start(now);
          osc.stop(now + chordDuration * 1.2 + 0.1);
          this.activeVoices.push({ stop: () => { try { osc.stop(); } catch(e){} } });
        });

      } else {
        // === COSMIC AMBIENT (ANALOG POLYPHONIC SYNTH) ===
        // Dual detuned Sawtooth & Triangle through Resonant Lowpass Filter sweep
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const voiceGain = this.ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'triangle';

        osc1.frequency.setValueAtTime(freq, now);
        osc2.frequency.setValueAtTime(freq * 1.004, now); // +7 cents detune

        filter.type = 'lowpass';
        filter.Q.setValueAtTime(2.2, now); // resonant sweep
        filter.frequency.setValueAtTime(preset.filterCutoff * 0.4, now);
        filter.frequency.exponentialRampToValueAtTime(preset.filterCutoff * 1.2, now + 1.5);
        filter.frequency.exponentialRampToValueAtTime(preset.filterCutoff * 0.6, now + chordDuration);

        voiceGain.gain.setValueAtTime(0.001, now);
        voiceGain.gain.linearRampToValueAtTime(0.12, now + 0.6);
        voiceGain.gain.setValueAtTime(0.12, now + chordDuration - 0.8);
        voiceGain.gain.linearRampToValueAtTime(0.001, now + chordDuration);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(voiceGain);
        voiceGain.connect(this.harmonyGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + chordDuration + 0.1);
        osc2.stop(now + chordDuration + 0.1);

        this.activeVoices.push({ stop: () => { try { osc1.stop(); osc2.stop(); } catch(e){} } });
      }
    });
  }

  /**
   * Stem 2: Rhythmic Pulse & Arpeggiator Generator
   * Drives active forward momentum for ADHD Boost, Deep Focus, and Gamma modes
   */
  playRhythmStep() {
    if (!this.ctx || !this.isPlaying) return;
    const now = this.ctx.currentTime;
    const preset = this.modePresets[this.state.mode] || this.modePresets.focus;
    const pattern = preset.rhythmPattern;
    const soundscape = this.state.soundscape;

    if (soundscape === 'pink-brown' || pattern === 'sleep-swells') return;

    const scale = preset.scale;
    const step = this.arpStep++;

    if (pattern === 'adhd-16th' || pattern === 'gamma-pulse') {
      // === ADHD & GAMMA: DRIVING 16TH-NOTE ARPEGGIATOR PLUCKS ===
      const note = scale[step % scale.length];
      const freq = this.noteToFreq(note);

      const arpOsc = this.ctx.createOscillator();
      const arpGain = this.ctx.createGain();
      const arpFilter = this.ctx.createBiquadFilter();

      arpOsc.type = 'triangle';
      arpOsc.frequency.setValueAtTime(freq, now);

      arpFilter.type = 'bandpass';
      arpFilter.frequency.setValueAtTime(pattern === 'gamma-pulse' ? 2400 : 1800, now);
      arpFilter.Q.setValueAtTime(2.0, now);

      // Snappy, rhythmic 16th pluck
      const duration = 0.14;
      arpGain.gain.setValueAtTime(0.001, now);
      arpGain.gain.linearRampToValueAtTime(0.14, now + 0.015);
      arpGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      arpOsc.connect(arpFilter);
      arpFilter.connect(arpGain);
      arpGain.connect(this.rhythmGain);

      arpOsc.start(now);
      arpOsc.stop(now + duration + 0.05);

    } else if (pattern === 'focus-8th') {
      // === DEEP FOCUS: SYNCOPATED 8TH-NOTE PULSES ===
      if (step % 2 === 0) {
        const note = scale[(step / 2) % scale.length];
        const freq = this.noteToFreq(note);

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, now);

        const dur = 0.22;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.rhythmGain);

        osc.start(now);
        osc.stop(now + dur + 0.05);
      }

    } else if (pattern === 'flow-swing') {
      // === CREATIVE FLOW: DOWNTEMPO CHILL PLUCK ===
      if (step % 4 === 0 || step % 4 === 3) {
        const note = scale[step % scale.length];
        const freq = this.noteToFreq(note);

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.rhythmGain);

        osc.start(now);
        osc.stop(now + 0.35);
      }
    }
  }

  /**
   * Generative Music Composition Sequencer Loops
   */
  startSequencers() {
    this.stopSequencers();
    const preset = this.modePresets[this.state.mode] || this.modePresets.focus;

    // 1. Chord Loop (1 bar = 4 beats)
    const chordIntervalMs = (60 / preset.tempoBpm) * 4 * 1000;
    const chordTick = () => {
      if (!this.isPlaying) return;
      this.playHarmonicChord();
      this.chordTimer = setTimeout(chordTick, chordIntervalMs);
    };
    chordTick();
    this.compositionTimer = this.chordTimer;

    // 2. Rhythmic Arpeggiator Clock (16th notes = 4 steps per beat)
    const arpIntervalMs = (60 / preset.tempoBpm / 4) * 1000;
    const arpTick = () => {
      if (!this.isPlaying) return;
      this.playRhythmStep();
      this.arpTimer = setTimeout(arpTick, arpIntervalMs);
    };
    arpTick();
  }

  stopSequencers() {
    if (this.chordTimer) {
      clearTimeout(this.chordTimer);
      this.chordTimer = null;
    }
    this.compositionTimer = null;
    if (this.arpTimer) {
      clearTimeout(this.arpTimer);
      this.arpTimer = null;
    }
    // Truncate active voices cleanly
    this.activeVoices.forEach(v => {
      try { v.stop(); } catch(e) {}
    });
    this.activeVoices = [];
  }

  // Backwards-compatible aliases for test runners
  playGenerativeChord() {
    this.playHarmonicChord();
  }
  startGenerativeComposition() {
    this.startSequencers();
    this.compositionTimer = this.chordTimer;
  }
  stopGenerativeComposition() {
    this.stopSequencers();
  }

  /**
   * Master Playback Controls
   */
  async play() {
    await this.init();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.isPlaying = true;

    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0.001, now);
    this.masterGain.gain.linearRampToValueAtTime(this.state.masterVolume, now + 0.3);

    this.startSequencers();
  }

  pause() {
    if (!this.ctx || !this.isPlaying) return;
    this.isPlaying = false;

    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.3);

    setTimeout(() => {
      this.stopSequencers();
    }, 350);
  }

  /**
   * Instant 200ms Responsive State Switches
   */
  setMode(modeKey) {
    if (!this.modePresets[modeKey]) return;
    this.state.mode = modeKey;
    const preset = this.modePresets[modeKey];
    this.state.modulationFrequency = preset.freq;

    if (this.ctx && this.isPlaying) {
      this.setupAmModulator();
      this.stopSequencers();
      this.startSequencers();
    }
  }

  setSoundscape(soundscapeKey) {
    this.state.soundscape = soundscapeKey;

    if (this.ctx) {
      const now = this.ctx.currentTime;
      // Toggle vinyl crackle volume
      if (this.vinylGain) {
        const isLofi = soundscapeKey === 'lofi';
        this.vinylGain.gain.cancelScheduledValues(now);
        this.vinylGain.gain.linearRampToValueAtTime(isLofi ? 0.25 : 0.0001, now + 0.2);
      }
    }

    if (this.ctx && this.isPlaying) {
      this.stopSequencers();
      this.startSequencers();
    }
  }

  setNeuralEffectLevel(level) {
    this.state.neuralEffectLevel = level;
    if (this.ctx && this.isPlaying) {
      this.setupAmModulator();
    }
  }

  setMasterVolume(val) {
    this.state.masterVolume = Math.max(0, Math.min(1, val));
    if (this.ctx && this.masterGain && this.isPlaying) {
      this.masterGain.gain.setTargetAtTime(this.state.masterVolume, this.ctx.currentTime, 0.03);
    }
  }

  setMaskingVolume(val) {
    this.state.maskingVolume = Math.max(0, Math.min(1, val));
    if (this.ctx && this.maskingGain) {
      this.maskingGain.gain.setTargetAtTime(this.state.maskingVolume, this.ctx.currentTime, 0.03);
    }
  }

  getVisualizationData() {
    if (!this.analyser) return { timeData: null, freqData: null };
    const timeData = new Uint8Array(this.analyser.frequencyBinCount);
    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(timeData);
    this.analyser.getByteFrequencyData(freqData);
    return { timeData, freqData };
  }
}

// Global Export
window.neuralAudioEngine = new NeuralAudioEngine();
