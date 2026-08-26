// 순수 로직 모듈(레벨데이터/RNG/먹이배치/지렁이/적AI/충돌/카메라) 6개 테스트를 순서대로 실행.
// 색칠앱의 validate-all.js와 같은 "전부 통과해야 다음 단계로" 컨벤션.
const { execFileSync } = require('child_process');
const path = require('path');

const tests = [
  'test-levels.js',
  'test-rng-food-placement.js',
  'test-worm.js',
  'test-enemy-ai.js',
  'test-collision.js',
  'test-camera.js',
  'test-star-rating.js'
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
console.log('\n✓ all snake game logic tests passed');
