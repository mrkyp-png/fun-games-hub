// V1812 C 사용자: 리듬팡 비치 2~4번 두더지 = 타임 키퍼 · 연타 도장 사범(글러브 뺌) · 세이프 찬스.
// 상점 착용 미리보기(costume-preview/*-worn.glb, 기본 자세 모델 공간)에서 두더지 몸·머리카락을 빼고,
// 옷의 각 점에 '가장 가까운 두더지 몸 점'의 뼈 가중치를 옮겨 붙인다 → 소매는 팔, 몸통은 몸, 이마띠는 머리를 따라 움직임.
// 원본 파일은 바꾸지 않는다. 실행: node review/beach-costumes/export.cjs
const fs = require('node:fs'), path = require('node:path');
const R = require('../../mole/js/clay-rig-runtime.js');
const root = path.resolve(__dirname, '../..');
const load = f => { const b = fs.readFileSync(f); return R.parseGLB(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const original = load(path.join(root, 'mole/assets/characters-v1692/mole-clay-v47-smile.glb'));
// 두더지 몸(스킨) 점과 뼈 가중치 — 가까운 점 찾기용 격자
const skinNode = original.json.nodes.find(n => n.name === 'Mole_Clay_Skin'), skinJoints = original.json.skins[skinNode.skin].joints, body = { p: [], j: [], w: [] };
for (const prim of original.json.meshes[skinNode.mesh].primitives) {
  const mat = original.json.materials[prim.material]?.name || '';
  if (/Eye|Teeth|Tongue|Smile interior|Armpit/i.test(mat)) continue;
  const P = R.accessor(original, prim.attributes.POSITION), J = R.accessor(original, prim.attributes.JOINTS_0), W = R.accessor(original, prim.attributes.WEIGHTS_0);
  for (let i = 0; i < P.length / 3; i++) { body.p.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); body.j.push(J[i * 4], J[i * 4 + 1], J[i * 4 + 2], J[i * 4 + 3]); body.w.push(W[i * 4], W[i * 4 + 1], W[i * 4 + 2], W[i * 4 + 3]); }
}
// 두더지 손 중심(손·손가락 뼈 가중치가 큰 점들의 평균)과 Hand 뼈 번호
const handJoint = {}, handCenter = {}, bodyJoint = skinJoints.findIndex(n => original.json.nodes[n].name === 'Body');
for (const s of ['L', 'R']) { handJoint[s] = skinJoints.findIndex(n => original.json.nodes[n].name === 'Hand.' + s); const acc = [0, 0, 0, 0];
  for (let i = 0; i < body.p.length / 3; i++) { let w = 0; for (let q = 0; q < 4; q++) if (/^(Hand|Finger[123]|Thumb)\./.test(original.json.nodes[skinJoints[body.j[i * 4 + q]]].name) && original.json.nodes[skinJoints[body.j[i * 4 + q]]].name.endsWith(s)) w += body.w[i * 4 + q];
    if (w > .5) { acc[0] += body.p[i * 3]; acc[1] += body.p[i * 3 + 1]; acc[2] += body.p[i * 3 + 2]; acc[3]++; } }
  handCenter[s] = acc.slice(0, 3).map(v => v / acc[3]); }
const CELL = .12, grid = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
for (let i = 0; i < body.p.length / 3; i++) { const k = key(Math.floor(body.p[i * 3] / CELL), Math.floor(body.p[i * 3 + 1] / CELL), Math.floor(body.p[i * 3 + 2] / CELL)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
function nearest(x, y, z) {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
  for (let r = 1; r < 12; r++) { let best = -1, bd = Infinity;
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (const i of grid.get(key(cx + dx, cy + dy, cz + dz)) || []) {
      const d = (body.p[i * 3] - x) ** 2 + (body.p[i * 3 + 1] - y) ** 2 + (body.p[i * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = i; } }
    if (best >= 0 && Math.sqrt(bd) <= r * CELL) return best; }
  throw Error('no body point near ' + [x, y, z]);
}
for (const id of ['hold-time', 'double-hit', 'safe-chance']) {
  const src = load(path.join(root, `mole/assets/costume-preview/${id}-worn.glb`)), g = { positions: [], normals: [], colors: [], joints: [], weights: [], hand: [], indices: [] };
  for (const { name, primitive, world } of R.instances(src)) {
    if (/^(Mole_Clay_Skin|Hair_)/.test(name || '')) continue;
    // 사용자: 도복 두더지는 글러브 빼기(글러브 가죽·커프 재질만 제외)
    // 사용자(최종): 도복은 수정하지 않음 — 인벤토리처럼 권투 글러브 착용 상태 그대로. 글러브·커프는 손을 따라 턱 앞에.
    const matName = src.json.materials?.[primitive.material]?.name || '', cuff = id === 'double-hit' && /glove/i.test(matName);
    const P = R.accessor(src, primitive.attributes.POSITION), N = R.accessor(src, primitive.attributes.NORMAL), I = R.accessor(src, primitive.indices), nm = R.normals(world);
    const canvas = (src.json.materials || []).find(m => /unbleached canvas/i.test(m.name || ''))?.pbrMetallicRoughness?.baseColorFactor;
    const color = src.json.materials?.[primitive.material]?.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1], base = g.positions.length / 3;
    // 글러브: 좌우 글러브 중심을 두더지 손(Hand 뼈) 쪽 손 중심으로 옮기고 손 뼈에 100% 고정
    let shift = null;
    if (cuff) { const side = {}; for (let i = 0; i < P.length; i += 3) { const p = R.point(world, [P[i], P[i + 1], P[i + 2]]), s = p[0] < 0 ? 'L' : 'R'; (side[s] = side[s] || [0, 0, 0, 0]); side[s][0] += p[0]; side[s][1] += p[1]; side[s][2] += p[2]; side[s][3]++; }
      shift = {}; for (const s of Object.keys(side)) { const c = side[s].slice(0, 3).map(v => v / side[s][3]), h = handCenter[s]; shift[s] = [h[0] - c[0] + (s === 'L' ? -.04 : .04), h[1] - c[1] + .05, h[2] - c[2] - .06]; } }
    for (let i = 0; i < P.length; i += 3) {
      let p = R.point(world, [P[i], P[i + 1], P[i + 2]]); const sd = p[0] < 0 ? 'L' : 'R';
      g.positions.push(...p);
      const [x, y, z] = [N[i], N[i + 1], N[i + 2]]; g.normals.push(nm[0] * x + nm[3] * y + nm[6] * z, nm[1] * x + nm[4] * y + nm[7] * z, nm[2] * x + nm[5] * y + nm[8] * z);
      g.colors.push(...color); const k = nearest(p[0], p[1], p[2]);
      // 글러브는 모양·위치 그대로, 몸통 뼈에 고정(두더지 팔 뼈를 기본 자세로 두면 손이 글러브 안)
      if (shift) { g.joints.push(skinJoints.findIndex(n => original.json.nodes[n].name === 'Forearm.' + sd), 0, 0, 0); g.weights.push(1, 0, 0, 0); g.hand.push(1); continue; }
      g.joints.push(...body.j.slice(k * 4, k * 4 + 4)); g.weights.push(...body.w.slice(k * 4, k * 4 + 4));
      let hand = 0; if (cuff) for (let q = 0; q < 4; q++) if (/^(Hand|Finger[123]|Thumb|Forearm)\./.test(original.json.nodes[skinJoints[body.j[k * 4 + q]]].name)) hand += body.w[k * 4 + q]; g.hand.push(Math.min(1, hand));
    }
    for (const v of I) g.indices.push(v + base);
  }
  const json = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [] }, chunks = [];
  let offset = 0;
  const acc = (values, width, kind) => { const data = kind === 'index' ? new Uint32Array(values) : new Float32Array(values), bytes = Buffer.from(data.buffer), bv = json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length }) - 1; offset += bytes.length; chunks.push(bytes);
    const a = { bufferView: bv, componentType: kind === 'index' ? 5125 : 5126, count: values.length / width, type: width === 1 ? 'SCALAR' : 'VEC' + width };
    if (kind === 'pos') { a.min = [Infinity, Infinity, Infinity]; a.max = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < data.length; i++) { a.min[i % 3] = Math.min(a.min[i % 3], data[i]); a.max[i % 3] = Math.max(a.max[i % 3], data[i]); } }
    return json.accessors.push(a) - 1; };
  const prim = { attributes: { POSITION: acc(g.positions, 3, 'pos'), NORMAL: acc(g.normals, 3), COLOR_0: acc(g.colors, 4), JOINTS_0: acc(g.joints, 4), WEIGHTS_0: acc(g.weights, 4), _HAND: acc(g.hand, 1) }, indices: acc(g.indices, 1, 'index') };
  json.nodes.push({ name: 'Costume_Skinned', mesh: json.meshes.push({ primitives: [prim] }) - 1 });
  json.buffers.push({ byteLength: offset });
  const desc = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc((desc.length + 3) & ~3, 0x20); desc.copy(padded);
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + padded.length + 8 + offset, 8); header.writeUInt32LE(padded.length, 12); header.write('JSON', 16);
  binHeader.writeUInt32LE(offset); binHeader.write('BIN\0', 4);
  const out = path.join(root, `mole/assets/home3d/mole-costume-${id}.glb`);
  fs.writeFileSync(out, Buffer.concat([header, padded, binHeader, ...chunks]));
  console.log(id, 'verts', g.positions.length / 3, (fs.statSync(out).size / 1e6).toFixed(2) + 'MB');
}
