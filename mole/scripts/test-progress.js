const assert = require('assert');

// progress.js 는 localStorage 를 쓴다 — 최소 스텁.
global.localStorage = {
  _d: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};

const { Progress } = require('../js/progress.js');

// 초기: 챕터1 세 라이트 다 열림, 챕터2~ 잠김
['easy', 'mid', 'legend'].forEach((l) => {
  assert.ok(Progress.isUnlocked(1, l), `챕터1 ${l} 열림`);
  assert.ok(!Progress.isUnlocked(2, l), `챕터2 ${l} 잠김`);
});
assert.deepStrictEqual(Progress.get(1, 'easy'), { cleared: false, best: 0 });

// 목표 미달 → best 만 갱신, 해금 없음
let r = Progress.record(1, 'easy', 100);
assert.ok(!r.passed && r.best === 100 && !r.newClear);
assert.ok(!Progress.isUnlocked(2, 'easy'));

// 목표 달성 → cleared + 다음 챕터 해금 (그 라이트만)
r = Progress.record(1, 'easy', Progress.target(1));
assert.ok(r.passed && r.newClear && r.unlockedNext, '목표 달성 = 클리어 + 해금');
assert.ok(Progress.isUnlocked(2, 'easy'), '챕터2 easy 열림');
assert.ok(!Progress.isUnlocked(2, 'mid'), '챕터2 mid 는 여전히 잠김 (라이트별 독립)');
assert.strictEqual(Progress.maxChapterFor('easy'), 2);
assert.strictEqual(Progress.maxChapterFor('mid'), 1);

// 재클리어는 newClear=false
r = Progress.record(1, 'easy', Progress.target(1) + 500);
assert.ok(r.passed && !r.newClear);
assert.strictEqual(Progress.get(1, 'easy').best, Progress.target(1) + 500);

// unlockAll 스위치
localStorage.setItem('mole.unlockAll', '1');
assert.ok(Progress.isUnlocked(3, 'legend'));
localStorage.removeItem('mole.unlockAll');

console.log('test-progress.js: all assertions passed');
