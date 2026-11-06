// 3D 홈 광장 배치 데이터 검사 (작업 1). 실행: node review/verify-home3d-layout.cjs
const assert = require('assert');
const L = require('../mole/js/home3d-layout.js');

const actions = L.SITES.map((s) => s.action).sort();
assert.deepStrictEqual(actions, ['daily', 'inventory', 'lightMode', 'locker', 'quest', 'rhythm', 'score', 'shop']);
assert.strictEqual(L.ISLAND_R, 12);
assert.deepStrictEqual(L.SPAWN, { x: 0, z: 0 });
assert.ok(!L.allowed(0, 0), '집 구멍 안으로는 걸어 들어갈 수 없음(점프로만 나옴)');
assert.ok(!L.allowed(1.2, 0), '구멍 테두리 안쪽도 막힘');
assert.ok(L.allowed(1.6, 0), '구멍 바로 밖은 걸을 수 있음');
assert.ok(L.HOLE_R > 1.2 && L.HOLE_R < 1.6);
assert.ok(!L.allowed(11.5, 0), '걷기 반지름(11) 밖은 막힘');
assert.ok(!L.allowed(0, -9), '건물 몸체 안은 막힘');

for (const s of L.SITES) {
  assert.ok(['building', 'prop'].includes(s.kind), s.action + ' kind');
  assert.ok(typeof s.labelKey === 'string' && s.labelKey.startsWith('mole.'), s.action + ' labelKey');
  // 진입 지점(건물 앞, 섬 중심 쪽)이 걸을 수 있고, 그 자리에서 nearest 가 자기 자신
  const e = L.entryPoint(s);
  assert.ok(L.allowed(e.x, e.z), s.action + ' 진입 지점이 걸을 수 있어야 함');
  assert.strictEqual(L.nearest(e.x, e.z) && L.nearest(e.x, e.z).action, s.action, s.action + ' 진입 지점 nearest');
}
assert.strictEqual(L.nearest(0, -6.4).action, 'lightMode', '건물에 닿으면 진입(게임기 body 3.2)');
assert.strictEqual(L.nearest(0, -4.8), null, '건물에서 떨어져 있으면 안 들어감');
assert.strictEqual(L.nearest(0, 0), null, '가운데 집 구멍에서는 아무 진입도 안 잡힘');

// slide: 막히면 그 축만 멈춤
const p = L.slide({ x: 10.9, z: 0 }, 0.5, 0.2);
assert.ok(L.allowed(p.x, p.z));

console.log('verify-home3d-layout: ok (' + L.SITES.length + ' sites)');

// 작업 5: 광장 GLB 의 간판 글자판(Sign_<action>)이 각 건물/사물 정면(섬 중심 쪽)에 있는지
{
  const fs = require('fs'), path = require('path');
  const RM = require('../mole/js/clay-rig-math.js');
  const buf = fs.readFileSync(path.join(__dirname, '../mole/assets/home3d/plaza.glb'));
  const glb = RM.parseGLB(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  for (const s of L.SITES) {
    if (s.action === 'lightMode') { const g = glb.json.nodes.find((x) => x.name === 'Sign_lightMode'); assert.ok(g && Math.hypot(g.translation[0] - s.x, g.translation[2] - s.z) < 0.3, '두더지팡 글자 = 기계 위 간판 상자'); continue; }
    const n = glb.json.nodes.find((x) => x.name === 'Sign_' + s.action);
    assert.ok(n && n.translation, s.action + ' 간판 노드');
    const [x, , z] = n.translation;
    assert.ok(Math.hypot(x - s.x, z - s.z) < 1.3, s.action + ' 간판이 건물 가까이');
    assert.ok(Math.hypot(x, z) < Math.hypot(s.x, s.z), s.action + ' 간판이 섬 중심 쪽(정면)');
  }
  const prims = glb.json.meshes.reduce((a, m) => a + m.primitives.length, 0);
  assert.ok(prims <= 16, '정적 그리기 ' + prims + ' ≤ 16');
  console.log('verify-home3d-layout: glb ok (' + prims + ' draws)');
}

// 자동 걷기 경로: 구멍을 가로지르면 옆으로 돌아가는 중간 지점
{
  const via = L.pathVia({ x: 0, z: 2 }, { x: 0, z: -6 });
  assert.strictEqual(via.length, 1, '구멍을 지나면 돌아갈 지점 1개');
  assert.ok(Math.hypot(via[0].x, via[0].z) > L.HOLE_R && L.allowed(via[0].x, via[0].z));
  assert.deepStrictEqual(L.pathVia({ x: 3, z: 2 }, { x: 3, z: -6 }), [], '구멍을 안 지나면 그대로');
  console.log('verify-home3d-layout: path ok');
}
{ // 옆면에 닿아도 그 건물
  const g = L.SITES.find((s) => s.action === 'daily');
  assert.strictEqual(L.nearest(g.x, g.z + g.body + 0.3).action, 'daily', '뒤/옆에서 닿아도');
  console.log('verify-home3d-layout: touch-any-side ok');
}
// 놀이기구 2개(장식): 통과 못 하고, 진입 대상(nearest)은 아님
{
  assert.deepStrictEqual(L.RIDES.map((r) => r.id).sort(), ['disco']); // V1630 C: 바이킹 놀이기구 → 바다 배(L.BOAT)
  for (const r of L.RIDES) {
    assert.ok(!L.allowed(r.x, r.z), r.id + ' 몸체는 막힘');
    assert.ok(Math.hypot(r.x, r.z) + r.body <= L.ISLAND_R, r.id + ' 섬 안');
    for (const s of L.SITES) assert.ok(Math.hypot(r.x - s.x, r.z - s.z) > r.body + s.body, r.id + ' 와 ' + s.action + ' 겹치지 않음');
    assert.strictEqual(L.nearest(r.x + r.body + 0.2, r.z), null, r.id + ' 옆에서 진입 버튼 안 뜸');
  }
  console.log('verify-home3d-layout: rides ok');
}
// 놀이기구 타기: 닿으면 nearestRide, 내릴 곳은 걸을 수 있는 곳
{
  for (const rd of L.RIDES) {
    const e = L.rideExit(rd);
    assert.ok(L.allowed(e.x, e.z), rd.id + ' 내리는 곳은 걸을 수 있음');
    assert.strictEqual(L.nearestRide(e.x, e.z) && L.nearestRide(e.x, e.z).id, rd.id, rd.id + ' 내리는 곳에서 다시 탈 수 있음');
  }
  assert.strictEqual(L.nearestRide(0, 0), null);
  console.log('verify-home3d-layout: ride-touch ok');
}
