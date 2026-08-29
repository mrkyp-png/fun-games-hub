const assert = require('assert');
const { create, comboToPoints, computeStars } = require('../js/combo-score.js');

// 1) 콤보 점수표 (스펙 §12)
assert.strictEqual(comboToPoints(1), 100);
assert.strictEqual(comboToPoints(2), 120);
assert.strictEqual(comboToPoints(3), 140);
assert.strictEqual(comboToPoints(4), 160);
assert.strictEqual(comboToPoints(5), 200);
assert.strictEqual(comboToPoints(9), 200, '5콤보 이상은 모두 200점(MAX)');

// 2) 연속 성공 시 콤보/점수 누적, MAX COMBO 판정
{
  const cs = create();
  for (let i = 0; i < 5; i++) cs.onMoleHit();
  assert.strictEqual(cs.combo, 5);
  assert.strictEqual(cs.score, 100 + 120 + 140 + 160 + 200);
  assert.ok(cs.isMaxCombo(), '5콤보 이상은 MAX COMBO');
}

// 3) 방해물 터치 시 콤보만 초기화, 점수는 유지
{
  const cs = create();
  cs.onMoleHit(); cs.onMoleHit();
  const scoreBefore = cs.score;
  cs.onObstacleHit();
  assert.strictEqual(cs.combo, 0, '방해물 터치 시 콤보 초기화');
  assert.strictEqual(cs.score, scoreBefore, '방해물 터치는 점수에 영향 없음');
  assert.ok(!cs.isMaxCombo());
}

// 4) 별 등급 (§15, Claude 결정: 남은 목숨 기준)
assert.strictEqual(computeStars(3, 3), 3, '목숨 그대로면 3별');
assert.strictEqual(computeStars(2, 3), 2, '1번 잃으면 2별');
assert.strictEqual(computeStars(1, 3), 1, '2번 이상 잃으면 1별');
assert.strictEqual(computeStars(0, 3), 1, '목숨 0(직전)이어도 최저 1별');

console.log('test-combo-score.js: all assertions passed');
