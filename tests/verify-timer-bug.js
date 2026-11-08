/**
 * Empirical reproduction script for timer freeze bug
 */
const { CDPBrowser } = require('./cdp-client.js');
const assert = require('assert');

async function verifyTimerBug() {
  const browser = new CDPBrowser({ port: 9560 });
  try {
    await browser.launch();
    await browser.navigate('http://localhost:3000');

    console.log('Testing Scenario A: Preset selected while playback is ACTIVE');
    const resultA = await browser.evaluate(`
      (async () => {
        const engine = window.neuralAudioEngine;
        // 1. Start playback on Infinite stream
        const playBtn = document.getElementById('masterPlayBtn');
        if (!engine.isPlaying) playBtn.click();
        await new Promise(r => setTimeout(r, 400));

        // 2. Click 25m preset while playing
        const p25 = document.querySelector('.preset-btn[data-minutes="25"]');
        p25.click();
        const initialClock = document.getElementById('timerClock').textContent.trim();

        // 3. Wait 2.2 seconds
        await new Promise(r => setTimeout(r, 2200));
        const afterClock = document.getElementById('timerClock').textContent.trim();

        return { initialClock, afterClock, ticked: initialClock !== afterClock };
      })()
    `);
    console.log('Scenario A (preset during playback):', resultA);

    console.log('\nTesting Scenario B: Preset selected while playback is IDLE, then play clicked');
    const resultB = await browser.evaluate(`
      (async () => {
        const engine = window.neuralAudioEngine;
        // 1. Pause playback
        const playBtn = document.getElementById('masterPlayBtn');
        if (engine.isPlaying) playBtn.click();
        await new Promise(r => setTimeout(r, 400));

        // 2. Click 25m preset while idle
        const p25 = document.querySelector('.preset-btn[data-minutes="25"]');
        p25.click();
        const initialClock = document.getElementById('timerClock').textContent.trim();

        // 3. Click play
        playBtn.click();
        await new Promise(r => setTimeout(r, 2200));
        const afterClock = document.getElementById('timerClock').textContent.trim();

        return { initialClock, afterClock, ticked: initialClock !== afterClock };
      })()
    `);
    console.log('Scenario B (preset before playback):', resultB);

  } finally {
    await browser.close();
  }
}

verifyTimerBug().catch(console.error);
