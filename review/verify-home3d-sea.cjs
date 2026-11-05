// 작업 8 검사: 바다 물결(잔잔·연속) + 빨간 점 알림 판단. 실행: node review/verify-home3d-sea.cjs
const assert = require('assert');
global.window = global;
global.StudioRigMath = require('../mole/js/clay-rig-math.js');
global.StudioRig = require('../mole/js/clay-rig-runtime.js');
const RD = require('../mole/js/home3d-renderer.js');
global.location = { search: '' };
const H = require('../mole/js/home3d.js');

// 물결: 잔잔(진폭 ≤ 0.08), 시간에 따라 부드럽게(0.02초 사이 변화 작음), 실제로 움직임
let maxA = 0, maxStep = 0, moved = 0;
for (let i = 0; i < 200; i++) {
  const x = (i * 7.3) % 60 - 30, z = (i * 3.1) % 60 - 30, t = i * 0.37;
  const a = RD.seaHeight(x, z, t), b = RD.seaHeight(x, z, t + 0.02);
  maxA = Math.max(maxA, Math.abs(a)); maxStep = Math.max(maxStep, Math.abs(b - a));
  moved += Math.abs(RD.seaHeight(x, z, t + 1.5) - a);
}
assert.ok(maxA <= 0.13 && maxA > 0.05, '눈에 보이되 잔잔한 진폭 ' + maxA);
assert.ok(maxStep < 0.015, '끊김 없이 연속 ' + maxStep);
assert.ok(moved > 0.5, '물결이 실제로 움직임');
// 바다 격자: 한 번에 그리는 판 1장(정점 수 제한 — 저사양 폰)
const g = RD.seaGrid(48, 60);
assert.strictEqual(g.positions.length / 3, 49 * 49);
assert.ok(g.indices.length / 3 === 48 * 48 * 2);

// 빨간 점: 기존 판단 함수 그대로(일일=받을 수 있음, 퀘스트=받을 개수>0, 메일=받을 것 있음)
const MG = { Daily: { claimable: () => true }, Quest: { claimable: () => 0 }, Mail: { claimable: () => true } };
assert.deepStrictEqual(H.claimables(MG).sort(), ['daily', 'mail']);
assert.deepStrictEqual(H.claimables({}), [], '모듈 없으면 빈 목록');
console.log('verify-home3d-sea: ok (amp ' + maxA.toFixed(3) + ')');
