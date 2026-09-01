const { execFileSync } = require('child_process');
const path = require('path');

const tests = ['test-settings.js', 'test-i18n.js'];
let failed = false;
for (const t of tests) {
  try {
    process.stdout.write(execFileSync('node', [path.join(__dirname, t)], { encoding: 'utf8' }));
  } catch (e) {
    failed = true;
    console.error(`FAILED: ${t}`);
    console.error(e.stdout || e.message);
  }
}
if (failed) { console.error('\n✗ common tests failed'); process.exit(1); }
console.log('\n✓ all common tests passed');
