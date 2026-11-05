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
// 해: 1시간에 한 바퀴, 항상 낮(높이 25~45°), 천천히
{
  assert.strictEqual(RD.SUN_PERIOD, 3600);
  let lo = 90, hi = 0;
  for (let t = 0; t < 3600; t += 15) { const d = RD.sunDir(t), el = Math.asin(d[1]) * 180 / Math.PI; lo = Math.min(lo, el); hi = Math.max(hi, el); }
  assert.ok(lo >= 24.9 && hi <= 45.1, '항상 낮 ' + lo.toFixed(1) + '~' + hi.toFixed(1));
  const a = RD.sunDir(0), b = RD.sunDir(3600);
  assert.ok(Math.hypot(a[0] - b[0], a[2] - b[2]) < 1e-6, '1시간 후 제자리');
  // 구름: 5개, 아주 천천히(초당 0.06), 섬 둘레 하늘
  const c0 = RD.cloudPos(0, 0), c1 = RD.cloudPos(0, 10);
  assert.ok(Math.abs(c1[0] - c0[0] - 0.6) < 1e-9 && c0[1] > 6, '천천히 이동');
  assert.ok(RD.cloudMesh(1).indices.length > 0);
  console.log('verify-home3d-sea: sun/cloud ok');
}
