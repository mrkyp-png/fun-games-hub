const assert = require('assert');
const { Worm } = require('../js/worm.js');

// 이동: 방향(1,0), 속도 100 → 1초 후 head.x가 100 늘어나야 함
const w = new Worm(0, 0, { speed: 100, initialLength: 3, maxLength: 30, segmentSpacing: 14 });
w.setDirection(1, 0);
w.update(1);
assert.ok(Math.abs(w.head.x - 100) < 1e-6, `head.x should be ~100, got ${w.head.x}`);
assert.ok(Math.abs(w.head.y - 0) < 1e-6, `head.y should stay ~0, got ${w.head.y}`);

// setDirection은 정규화되어야 함 (3,4) → 길이 5 방향벡터
const w2 = new Worm(0, 0, { speed: 10, initialLength: 3, maxLength: 30, segmentSpacing: 14 });
w2.setDirection(3, 4);
w2.update(1);
assert.ok(Math.abs(dist(w2.head, { x: 6, y: 8 })) < 1e-6, 'direction must be normalized before moving');

// 세그먼트: 초기 길이만큼 반환, 머리가 [0]
const w3 = new Worm(0, 0, { speed: 50, initialLength: 3, maxLength: 30, segmentSpacing: 14 });
w3.setDirection(1, 0);
for (let i = 0; i < 20; i++) w3.update(0.1); // 몸통이 trail을 따라 자리잡을 시간을 줌
let segs = w3.getSegments();
assert.strictEqual(segs.length, 3, 'segments length must equal current length');
assert.deepStrictEqual(segs[0], w3.head, 'segments[0] must be the head');

// 성장: grow()는 length를 늘리고 maxLength에서 멈춰야 함
const w4 = new Worm(0, 0, { speed: 50, initialLength: 3, maxLength: 5, segmentSpacing: 14 });
w4.grow(10);
assert.strictEqual(w4.length, 5, 'length must cap at maxLength even if grow amount is larger');

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

console.log('test-worm.js: all assertions passed');
