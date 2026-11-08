/**
 * tests/e2e-suite.js
 * Master Automated E2E Test Suite for Synapse.fm
 * 
 * Executes all 4 Tiers:
 * - Tier 1: Feature Coverage (25 tests)
 * - Tier 2: Boundary & Corner Cases (25 tests)
 * - Tier 3: Cross-Feature Combinations (18 tests)
 * - Tier 4: Real-World Workload Simulation (12 tests)
 * 
 * Total: 80 Automated Tests
 */

const { runTier1 } = require('./tier1-features.js');
const { runTier2 } = require('./tier2-boundaries.js');
const { runTier3 } = require('./tier3-combinations.js');
const { runTier4 } = require('./tier4-workload.js');

async function main() {
  const overallStart = Date.now();

  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║               SYNAPSE.FM E2E AUTOMATED TEST SUITE                  ║');
  console.log('║       Opaque-Box Architectural, Functional & Performance Tests     ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`Execution started at: ${new Date().toISOString()}`);

  const tierStats = [];

  try {
    // -------------------------------------------------------------
    // Tier 1: Feature Coverage
    // -------------------------------------------------------------
    const t1Start = Date.now();
    const t1 = await runTier1();
    tierStats.push({
      tier: 'Tier 1: Feature Coverage',
      total: t1.total,
      passed: t1.passed,
      failed: t1.failed,
      durationMs: Date.now() - t1Start
    });
    await new Promise(r => setTimeout(r, 600));

    // -------------------------------------------------------------
    // Tier 2: Boundary & Corner Cases
    // -------------------------------------------------------------
    const t2Start = Date.now();
    const t2 = await runTier2();
    tierStats.push({
      tier: 'Tier 2: Boundary & Corner Cases',
      total: t2.total,
      passed: t2.passed,
      failed: t2.failed,
      durationMs: Date.now() - t2Start
    });
    await new Promise(r => setTimeout(r, 600));

    // -------------------------------------------------------------
    // Tier 3: Cross-Feature Combinations
    // -------------------------------------------------------------
    const t3Start = Date.now();
    const t3 = await runTier3();
    tierStats.push({
      tier: 'Tier 3: Cross-Feature Combinations',
      total: t3.total,
      passed: t3.passed,
      failed: t3.failed,
      durationMs: Date.now() - t3Start
    });
    await new Promise(r => setTimeout(r, 600));

    // -------------------------------------------------------------
    // Tier 4: Real-World Workload Simulation
    // -------------------------------------------------------------
    const t4Start = Date.now();
    const t4 = await runTier4();
    tierStats.push({
      tier: 'Tier 4: Real-World Workload Simulation',
      total: t4.total,
      passed: t4.passed,
      failed: t4.failed,
      durationMs: Date.now() - t4Start
    });

  } catch (err) {
    console.error('\n[FATAL SUITE ERROR]:', err.message);
    process.exit(1);
  }

  const totalDuration = ((Date.now() - overallStart) / 1000).toFixed(2);
  const totalTests = tierStats.reduce((sum, t) => sum + t.total, 0);
  const totalPassed = tierStats.reduce((sum, t) => sum + t.passed, 0);
  const totalFailed = tierStats.reduce((sum, t) => sum + t.failed, 0);

  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                     FINAL TEST EXECUTION REPORT                    ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  tierStats.forEach(t => {
    const status = t.failed === 0 ? 'PASS' : 'FAIL';
    const line = `║ [${status}] ${t.tier.padEnd(42)} ${t.passed}/${t.total} (${(t.durationMs / 1000).toFixed(1)}s)`;
    console.log(line.padEnd(69) + '║');
  });
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log(`║ OVERALL RESULT: ${totalFailed === 0 ? '100% PASSED' : 'FAILED'} (${totalPassed}/${totalTests} tests) in ${totalDuration}s`.padEnd(69) + '║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}
