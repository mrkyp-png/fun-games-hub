const { execFileSync } = require('child_process');
const path = require('path');

const tests = [
  'test-levels.js',
  'test-rng.js',
  'test-combo-score.js',
  'test-emoji-mask.js',
  'test-region-partition.js',
  'test-spawn-placement.js',
  'test-spawn-scheduler.js'
];

let failed = false;
for (const t of tests) {
  const full = path.join(__dirname, t);
  try {
    const out = execFileSync('node', [full], { encoding: 'utf8' });
    process.stdout.write(out);
  } catch (e) {
    failed = true;
    console.error(`FAILED: ${t}`);
    console.error(e.stdout || e.message);
  }
}
if (failed) {
  console.error('\n✗ one or more tests failed');
  process.exit(1);
}
console.log('\n✓ all mole game logic tests passed');
