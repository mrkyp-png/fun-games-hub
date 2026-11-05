// 작업 7 검사: v44 = v43 + 동작 2개(모양·색 데이터 불변), 첫 장면 단계·점프. 실행: node review/verify-home3d-intro.cjs
const assert = require('assert');
const fs = require('fs'), path = require('path');
const RM = require('../mole/js/clay-rig-math.js');
const read = (f) => { const b = fs.readFileSync(path.join(__dirname, '../mole/assets/checkerboard-v1590', f)); return { raw: b, glb: RM.parseGLB(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)) }; };
const v43 = read('mole-clay-v43.glb'), v44 = read('mole-clay-v44.glb');

// 1) 모양·색·뼈대 데이터 동일: 모든 메시 primitive 의 attribute/indices 값이 같다
const g3 = v43.glb.json, g4 = v44.glb.json;
assert.strictEqual(g4.meshes.length, g3.meshes.length);
for (let m = 0; m < g3.meshes.length; m++) for (let p = 0; p < g3.meshes[m].primitives.length; p++) {
  const a = g3.meshes[m].primitives[p], b = g4.meshes[m].primitives[p];
  for (const k of [...Object.keys(a.attributes), 'indices']) {
    const ia = k === 'indices' ? a.indices : a.attributes[k], ib = k === 'indices' ? b.indices : b.attributes[k];
    if (ia === undefined) continue;
    assert.strictEqual(g4.accessors[ib].type, g3.accessors[ia].type, k + ' type');
    assert.deepStrictEqual(Array.from(RM.accessor(v44.glb, ib)), Array.from(RM.accessor(v43.glb, ia)), 'mesh ' + m + '/' + p + ' ' + k);
  }
}
assert.deepStrictEqual(g4.skins.map((s) => s.joints), g3.skins.map((s) => s.joints), '뼈대 동일');
assert.deepStrictEqual(g4.nodes.map((n) => [n.name, n.translation, n.rotation, n.scale]), g3.nodes.map((n) => [n.name, n.translation, n.rotation, n.scale]), '노드 기본 자세 동일');

// 2) 기존 17개 + 새 2개
const names = g4.animations.map((a) => a.name);
for (const a of g3.animations) assert.ok(names.includes(a.name), '기존 동작 유지 ' + a.name);
for (const n of ['Jump', 'WalkFwd']) assert.ok(names.includes(n), '새 동작 ' + n);
assert.strictEqual(names.length, g3.animations.length + 2);
// 새 동작이 실제로 뼈를 움직이고 유효한 값(NaN 없음)
global.window = global; global.StudioRigMath = RM;
const RT = require('../mole/js/clay-rig-runtime.js');
const rig = RT.prepare(v44.glb);
for (const n of ['Jump', 'WalkFwd']) {
  const a = RT.pose(rig, n, 0, false), b = RT.pose(rig, n, 0.5, false);
  let diff = 0;
  for (const k in a) for (let i = 0; i < 16; i++) { assert.ok(Number.isFinite(b[k][i]), n + ' 유효 값'); diff += Math.abs(a[k][i] - b[k][i]); }
  assert.ok(diff > 0.01, n + ' 이 실제로 움직임');
}

// 3) 시작 = 구멍 안, 점프로만 나옴 / 점프 높이
const L = require('../mole/js/home3d-layout.js');
const I = require('../mole/js/home3d-intro.js');
const h = I.create();
assert.strictEqual(h.inHole, true, '시작은 구멍 안');
assert.deepStrictEqual(h.start, { x: 0, z: 0, heading: 0 }, '구멍 가운데, 정면(+z, 화면 쪽)을 봄');
const out = I.hopOut(0);   // 정면으로 뛰어나옴
assert.ok(Math.hypot(out.x, out.z) > L.HOLE_R && L.allowed(out.x, out.z), '착지점은 구멍 밖 걸을 수 있는 곳');
const side = I.hopOut(Math.PI / 2);
assert.ok(L.allowed(side.x, side.z));
const J = I.jump;
assert.strictEqual(J.height(0), 0); assert.ok(Math.abs(J.height(J.T)) < 1e-9); assert.ok(J.height(J.T / 2) > 0.9);
assert.strictEqual(J.height(J.T + 1), 0);
console.log('verify-home3d-intro: ok (' + names.length + ' animations)');
