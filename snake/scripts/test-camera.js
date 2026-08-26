const assert = require('assert');
const { create } = require('../js/camera.js');

// 부드러운 추적: 목표가 멀리 있어도 한 프레임에 순간이동하지 않고, 여러 프레임 지나면 수렴해야 함
const cam = create({ mapWidth: 5000, mapHeight: 3000, viewWidth: 800, viewHeight: 600, smoothing: 0.2 });
const first = cam.update(2000, 1500);
assert.ok(first.x < 2000 - 400, 'camera should not jump instantly to the target on the first frame');

let pos;
for (let i = 0; i < 200; i++) pos = cam.update(2000, 1500);
const desiredX = 2000 - 800 / 2;
const desiredY = 1500 - 600 / 2;
assert.ok(Math.abs(pos.x - desiredX) < 1, `camera x should converge near ${desiredX}, got ${pos.x}`);
assert.ok(Math.abs(pos.y - desiredY) < 1, `camera y should converge near ${desiredY}, got ${pos.y}`);

// 맵 경계를 벗어나지 않아야 함 — 플레이어가 맵 모서리(0,0)에 있어도 카메라는 음수로 안 나감
const camEdge = create({ mapWidth: 5000, mapHeight: 3000, viewWidth: 800, viewHeight: 600, smoothing: 0.5 });
let edgePos;
for (let i = 0; i < 50; i++) edgePos = camEdge.update(0, 0);
assert.ok(edgePos.x >= 0 && edgePos.y >= 0, 'camera must clamp to map bounds near the top-left corner');

// 반대쪽 모서리(맵 끝)에서도 뷰포트가 맵 밖을 보여주지 않아야 함
const camFar = create({ mapWidth: 5000, mapHeight: 3000, viewWidth: 800, viewHeight: 600, smoothing: 0.5 });
let farPos;
for (let i = 0; i < 50; i++) farPos = camFar.update(5000, 3000);
assert.ok(farPos.x <= 5000 - 800, 'camera must clamp so the view never crosses the right edge');
assert.ok(farPos.y <= 3000 - 600, 'camera must clamp so the view never crosses the bottom edge');

console.log('test-camera.js: all assertions passed');
