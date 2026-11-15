// V1725 C 사용자: 쥬스 → 콜라. 원본 술 두더지(v1694)에서 동작·뼈는 그대로 두고 부품만 바꿈(GLB 직접 수정)
//  병 = 투명 유리 + 안에 콜라(몸통까지) + 찰랑이는 거품 윗면, 라벨 없음, 병에 바로 글자 '콜라'(ko)/'COLA'(en)
//  눈 = 담배 두더지의 동그란 눈동자, 볼 = 기본 두더지 볼 색
const fs = require('fs'), path = require('path');
const A = path.join(__dirname, '..', 'mole', 'assets');
const SRC = path.join(A, 'characters-v1694', 'behavior-drink.glb'), DONOR = path.join(A, 'characters-v1694', 'behavior-smoke.glb');
const OUT = path.join(A, 'characters-v1725', 'behavior-drink.glb');
const TEXT = JSON.parse(fs.readFileSync(path.join(__dirname, 'cola-text.json'), 'utf8'));
function read(f) { const b = fs.readFileSync(f), jl = b.readUInt32LE(12), json = JSON.parse(b.slice(20, 20 + jl).toString('utf8')), bo = 20 + jl; return { json, bin: b.slice(bo + 8, bo + 8 + b.readUInt32LE(bo)) }; }
function write(f, json, bin) {
  const pad = (buf, c) => Buffer.concat([buf, Buffer.alloc((4 - buf.length % 4) % 4, c)]);
  json.buffers = [{ byteLength: bin.length }];
  const j = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20), bb = pad(bin, 0), h = Buffer.alloc(12);
  h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + j.length + 8 + bb.length, 8);
  const ch = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.concat([h, ch(j.length, 0x4E4F534A), j, ch(bb.length, 0x004E4942), bb]));
}
const lin = (hex, a = 1) => [1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).concat(a);
const d = read(SRC), s = read(DONOR), g = d.json;
let bin = d.bin;
function addBytes(bytes, target) { const off = Math.ceil(bin.length / 4) * 4; bin = Buffer.concat([bin, Buffer.alloc(off - bin.length), bytes]); return g.bufferViews.push(Object.assign({ buffer: 0, byteOffset: off, byteLength: bytes.length }, target ? { target } : {})) - 1; }
function addFloat(arr, type, target, withMinMax) {
  const f = Float32Array.from(arr), n = type === 'VEC3' ? 3 : type === 'VEC4' ? 4 : type === 'VEC2' ? 2 : 1, acc = { bufferView: addBytes(Buffer.from(f.buffer), target), componentType: 5126, count: f.length / n, type };
  if (withMinMax) { acc.min = []; acc.max = []; for (let k = 0; k < n; k++) { let lo = Infinity, hi = -Infinity; for (let i = k; i < f.length; i += n) { lo = Math.min(lo, f[i]); hi = Math.max(hi, f[i]); } acc.min.push(lo); acc.max.push(hi); } }
  return g.accessors.push(acc) - 1;
}
function addIndex(arr) { const u = Uint32Array.from(arr); return g.accessors.push({ bufferView: addBytes(Buffer.from(u.buffer), 34963), componentType: 5125, count: u.length, type: 'SCALAR' }) - 1; }
function readFloat(model, ai) { const a = model.json.accessors[ai], v = model.json.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type]; if (v.byteStride && v.byteStride !== n * 4) throw Error('stride'); const off = (v.byteOffset || 0) + (a.byteOffset || 0), out = new Float32Array(a.count * n); for (let i = 0; i < out.length; i++) out[i] = model.bin.readFloatLE(off + i * 4); return out; }
function copyAccessor(model, ai) { const a = model.json.accessors[ai], v = model.json.bufferViews[a.bufferView]; const bytes = model.bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); return g.accessors.push(Object.assign({}, a, { bufferView: addBytes(bytes, v.target) })) - 1; }
const node = (name) => g.nodes.find((n) => n.name === name), nodeIndex = (name) => g.nodes.findIndex((n) => n.name === name);
const addMat = (m) => g.materials.push(m) - 1;
const mat = (name) => g.materials.find((m) => m.name === name);
const holder = nodeIndex('FrontHeldBottle');
function addChild(n) { const i = g.nodes.push(n) - 1; g.nodes[holder].children = (g.nodes[holder].children || []).concat(i); return i; }

// 얼굴: 동그란 눈동자(담배 두더지 것), 볼 = 기본 두더지 색
const espresso = g.materials.findIndex((m) => m.name === 'Espresso');
for (const [from, to] of [['Round pupil 1', 'Spiral pupil 1'], ['Round pupil -1', 'Spiral pupil -1']]) {
  const sn = s.json.nodes.find((n) => n.name === from), dn = node(to), sm = s.json.meshes[sn.mesh];
  dn.mesh = g.meshes.push({ name: from, primitives: sm.primitives.map((p) => ({ mode: p.mode, material: espresso, indices: p.indices == null ? undefined : copyAccessor(s, p.indices), attributes: Object.fromEntries(Object.entries(p.attributes).map(([k, v]) => [k, copyAccessor(s, v)])) })) }) - 1;
  ['translation', 'rotation', 'scale'].forEach((k) => { if (sn[k]) dn[k] = sn[k]; else delete dn[k]; }); dn.name = from;
}
mat('Cheek rose').pbrMetallicRoughness.baseColorFactor = [0.8549926280975342, 0.2541520893573761, 0.22696587443351746, 1];

// 병: 라벨·옛 글자 없앰, 몸통 = 콜라(불투명), 어깨·목 = 빈 유리(원래 메시는 숨기고 유리 껍데기로)
delete node('Alcohol lettering curved onto bottle').mesh;
delete node('Curved cream alcohol label').mesh;
mat('Bottle deep jade').pbrMetallicRoughness.baseColorFactor = lin('#3A1608');   // 콜라
mat('Bottle gold rim').pbrMetallicRoughness.baseColorFactor = lin('#D9DEE3');    // 병 입구(유리 테)
const shoulderMesh = node('Bottle shoulder').mesh, neckMesh = node('Bottle neck').mesh;
delete node('Bottle shoulder').mesh; delete node('Bottle neck').mesh;

// 거품 윗면(찰랑임): 콜라 몸통 윗면(y -0.27) 바로 위 원판, 유리보다 먼저 그려지게 먼저 추가
const foamMat = addMat({ name: 'Cola foam', pbrMetallicRoughness: { baseColorFactor: lin('#C9925A'), metallicFactor: 0, roughnessFactor: 0.6 }, doubleSided: true });
{
  const pos = [0, 0, 0], nor = [0, 1, 0], idx = [], N = 32, RAD = 0.262;
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; pos.push(Math.sin(a) * RAD, 0, Math.cos(a) * RAD); nor.push(0, 1, 0); }
  for (let i = 0; i < N; i++) idx.push(0, 1 + i, 1 + (i + 1) % N);
  const mesh = g.meshes.push({ name: 'Bottle cola foam', primitives: [{ attributes: { POSITION: addFloat(pos, 'VEC3', 34962, true), NORMAL: addFloat(nor, 'VEC3', 34962) }, indices: addIndex(idx), material: foamMat }] }) - 1;
  const fi = addChild({ name: 'Bottle cola foam', mesh, translation: [0, -0.262, 0] });
  // 찰랑찰랑: 마시는 동작(Behavior, 5.5초 반복)에 윗면 기울기 흔들림을 더함
  const anim = g.animations.find((a) => a.name === 'Behavior'), T = [], Q = [];
  const dur = Math.max(...anim.samplers.map((sp) => g.accessors[sp.input].max[0]));
  const quat = (ax, az) => { const qx = [Math.sin(ax / 2), 0, 0, Math.cos(ax / 2)], qz = [0, 0, Math.sin(az / 2), Math.cos(az / 2)]; return [qx[3] * qz[0] + qx[0] * qz[3] + qx[1] * qz[2] - qx[2] * qz[1], qx[3] * qz[1] - qx[0] * qz[2] + qx[1] * qz[3] + qx[2] * qz[0], qx[3] * qz[2] + qx[0] * qz[1] - qx[1] * qz[0] + qx[2] * qz[3], qx[3] * qz[3] - qx[0] * qz[0] - qx[1] * qz[1] - qx[2] * qz[2]]; };
  for (let i = 0; i <= Math.round(dur * 20); i++) { const t = i / 20; T.push(t); Q.push(...quat(Math.PI / 180 * 9 * Math.sin(2 * Math.PI * t / 0.7), Math.PI / 180 * 6 * Math.sin(2 * Math.PI * t / 1.05 + 1))); }
  const sampler = anim.samplers.push({ input: addFloat(T, 'SCALAR', null, true), output: addFloat(Q, 'VEC4'), interpolation: 'LINEAR' }) - 1;
  anim.channels.push({ sampler, target: { node: fi, path: 'rotation' } });
}

// 유리 껍데기: 몸통·어깨·목을 옆으로 5% 키워 투명하게(안의 콜라·거품이 비침)
const glassMat = addMat({ name: 'Bottle glass clear', pbrMetallicRoughness: { baseColorFactor: [0.86, 0.94, 1, 0.26], metallicFactor: 0, roughnessFactor: 0.08 }, alphaMode: 'BLEND' });
for (const [src, meshIndex] of [['Bottle body', node('Bottle body').mesh], ['Bottle shoulder', shoulderMesh], ['Bottle neck', neckMesh]]) {
  const sn = node(src), prims = g.meshes[meshIndex].primitives.map((p) => {
    const P = readFloat(d, p.attributes.POSITION); for (let i = 0; i < P.length; i += 3) { P[i] *= 1.05; P[i + 2] *= 1.05; }
    return { attributes: { POSITION: addFloat(P, 'VEC3', 34962, true), NORMAL: copyAccessor(d, p.attributes.NORMAL) }, indices: p.indices == null ? undefined : copyAccessor(d, p.indices), material: glassMat };
  });
  const mesh = g.meshes.push({ name: 'Bottle glass ' + src, primitives: prims }) - 1;
  addChild(Object.assign({ name: 'Bottle glass ' + src.split(' ')[1], mesh }, sn.translation ? { translation: sn.translation } : {}, sn.rotation ? { rotation: sn.rotation } : {}));
}

// 글자: 병에 바로(라벨 없음). 게임 설정 언어에 맞는 것 하나만 그림(clay-round1-local.js)
const textMat = addMat({ name: 'Cola text', pbrMetallicRoughness: { baseColorFactor: lin('#FFD84A'), metallicFactor: 0, roughnessFactor: 0.45 } });
for (const key of ['ko', 'en']) {
  const t = TEXT[key];
  const mesh = g.meshes.push({ name: 'Bottle text ' + key, primitives: [{ attributes: { POSITION: addFloat(t.pos, 'VEC3', 34962, true), NORMAL: addFloat(t.nor, 'VEC3', 34962) }, indices: addIndex(t.idx), material: textMat }] }) - 1;
  addChild({ name: 'Bottle text ' + key, mesh });
}
write(OUT, g, bin);
console.log('저장', OUT, bin.length);
