// 3D 홈 입력·카메라 검사 (작업 4). 실행: node review/verify-home3d-input.cjs
const assert = require('assert');
global.window = global;
global.StudioRigMath = require('../mole/js/clay-rig-math.js');
global.StudioRig = require('../mole/js/clay-rig-runtime.js');
const L = require('../mole/js/home3d-layout.js');
const UI = require('../mole/js/home3d-ui.js');
const RD = require('../mole/js/home3d-renderer.js');

// --- 입력 모델 ---
const inp = UI.createInput();
inp.stickDown(1, 0, -40, 40);          // 스틱 손가락 1: 위로 끝까지
assert.ok(Math.abs(inp.joy.y + 1) < 1e-9 && Math.abs(inp.joy.x) < 1e-9);
inp.stickDown(2, 0, 0, 40);            // 두 번째 손가락은 스틱이 무시
assert.ok(Math.abs(inp.joy.y + 1) < 1e-9);
// 회전 손가락 2 는 별도 ID
inp.lookDown(2, 100, 100);
const d = inp.lookMove(2, 130, 100);
assert.ok(d.dyaw !== 0, '회전 손가락이 시점을 돌림');
assert.ok(Math.abs(inp.joy.y + 1) < 1e-9, '회전이 이동을 건드리지 않음');
assert.strictEqual(inp.lookUp(2, 130, 100), null, '끌었으면 탭 아님');
// 짧게 누르면 탭
inp.lookDown(3, 50, 50);
assert.deepStrictEqual(inp.lookUp(3, 52, 51), { x: 52, y: 51 });
// 다른 손가락이 떼도 스틱 유지
inp.stickUp(9);
assert.ok(Math.abs(inp.joy.y + 1) < 1e-9);
// blur/cancel/기능화면 진입 = reset → 이동 0
inp.reset();
assert.deepStrictEqual(inp.joy, { x: 0, y: 0 });
inp.stickDown(4, 30, 0, 40);
inp.setEnabled(false);
assert.deepStrictEqual(inp.joy, { x: 0, y: 0 }, '비활성화하면 눌린 스틱 해제');
inp.stickDown(5, 30, 0, 40);
assert.deepStrictEqual(inp.joy, { x: 0, y: 0 }, '비활성 중 입력 무시');
inp.setEnabled(true);

// --- 카메라: 세로·가로 모두 초점 = 두더지, 시점 값 불변 ---
const view = { x: 1, z: -2, heading: 0.5, yaw: 0.3, pitch: 0.48 };
const copy = JSON.parse(JSON.stringify(view));
const a = RD.camera(view, 390, 844), b = RD.camera(view, 844, 390);
assert.deepStrictEqual(view, copy, 'camera 가 view 를 바꾸지 않음');
assert.deepStrictEqual(Array.from(a.focus), Array.from(b.focus));
assert.ok(Math.abs(a.focus[0] - 1) < 1e-9 && Math.abs(a.focus[2] + 2) < 1e-9);

// --- 건물 터치 판정 ---
const cam = RD.camera({ x: 0, z: 0, heading: Math.PI, yaw: 0, pitch: 0.48 }, 390, 844);
const mole = L.SITES.find((s) => s.action === 'lightMode');
const p = RD.project(cam.vp, [mole.x, 1.5, mole.z]);
assert.ok(p, '앞쪽 두더지팡 건물이 화면에 투영됨');
const px = { x: (p[0] + 1) / 2 * 390, y: (1 - p[1]) / 2 * 844 };
assert.strictEqual(RD.pickSite(cam.vp, L.SITES, px.x, px.y, 390, 844).action, 'lightMode');
assert.strictEqual(RD.pickSite(cam.vp, L.SITES, 5, 840, 390, 844), null, '빈 곳은 없음');

console.log('verify-home3d-input: ok');
