# Synapse.fm — Local Brain.fm Clean-Room Rebuild

A 100% offline, privacy-first, zero-dependency functional audio engine and generative music synthesizer built locally based on reverse-engineering findings of Brain.fm's patented neural phase-locking technology.

---

## 🔬 Core Scientific & Acoustic Architecture

1. **Neural Phase-Locking (Auditory Entrainment)**
   * **16.0 Hz Beta (Deep Focus & ADHD Boost)**: Uses rapid amplitude modulation (AM) to synchronize cortical firing patterns in the frontoparietal attention networks (*validated in Woods et al., 2024 Communications Biology*).
   * **13.0 Hz Alpha-Beta (Creative Flow)**: Enhances divergent thinking and relaxed executive control.
   * **10.0 Hz Alpha (Relax & Recharge)**: Decreases sympathetic nervous system arousal and quietens cognitive anxiety.
   * **5.5 Hz Theta (Meditation)**: Drives slow theta rhythms for introspective mindfulness and deep stillness.
   * **1.5 Hz Delta (Deep Sleep)**: Modulates slow delta frequencies to deepen slow-wave sleep cycles (*US Patent 10,653,857*).

2. **Dynamic Acoustic Salience Reduction**
   * Eliminates vocal ranges, abrupt transient spikes, and distracting hooks.
   * Applies smooth 2000ms attack and 3000ms decay envelopes to all harmonic transitions to prevent auditory startle responses.

3. **Continuous Acoustic Masking**
   * Generates real-time, non-repeating **Brown Noise ($1/f^2$)** and **Pink Noise ($1/f$)** beds to dynamically mask ambient room disruptions (refrigerators, traffic, talking).

4. **Procedural Generative Synth Engine**
   * Uses Web Audio API dual-oscillator arrays with warm biquad lowpass filtering and modal chords (Dorian, Lydian, Aeolian).
   * Infinite and non-repetitive: continuously evolves chords in real-time on your computer without internet access or subscriptions.

5. **3D Spatial Panning**
   * Employs subtle 0.04 Hz stereophonic panning LFOs to engage spatial auditory networks and eliminate listening fatigue.

---

## 🚀 How to Run Locally

### Option 1: Native Node Server (Zero Dependencies)
Run from the project root:
```bash
npm start
```
or:
```bash
node server.js
```
Then open: **`http://localhost:3000`** in any web browser (Chrome, Edge, Firefox, Brave, Safari).

### Option 2: Direct Offline Launch (No Server Needed)
You can double-click and open `public/index.html` directly in your browser.

---

## 🎛️ Features & Controls

* **Cognitive State Selector**: Deep Focus, ADHD Boost, Creative Flow, Relax & Unwind, Meditation, Deep Sleep.
* **Neural Effect Level**: Low (25%), Medium (50%), High (75%) modulation depth.
* **Acoustic Soundscapes**: Cosmic Ambient, Lo-Fi Warmth, Ethereal Sine Wash.
* **Session Timers**: Continuous / Infinite, 25m Pomodoro, 45m Deep Work, 90m Ultradian Cycle.
* **Real-Time Visualizer**: Dual-mode canvas showing the active **Neural Phase Waveform** (oscilloscope) and the **Acoustic FFT Spectrum**.
* **Shortcut**: Press **`Spacebar`** anywhere to quickly play or pause.
