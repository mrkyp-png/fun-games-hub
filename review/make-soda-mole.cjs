// V1724 C 사용자: 술 두더지 → 음료 두더지. 동작·뼈는 그대로, 부품만 바꿈(GLB 를 직접 고침, 블렌더 다시 내보내기 없음)
//  ① 병: 초록 술병 → 주황 음료병(상표·글자 없음, 흰 라벨) ② 눈: 소용돌이 눈동자 → 담배 두더지의 동그란 눈동자 ③ 볼: 취한 빨간 볼 → 기본 두더지 볼 색
const fs = require('fs'), path = require('path');
const A = path.join(__dirname, '..', 'mole', 'assets');
const SRC = path.join(A, 'characters-v1694', 'behavior-drink.glb'), DONOR = path.join(A, 'characters-v1694', 'behavior-smoke.glb');
const OUT = path.join(A, 'characters-v1724', 'behavior-drink.glb');
function read(f) {
  const b = fs.readFileSync(f), jl = b.readUInt32LE(12), json = JSON.parse(b.slice(20, 20 + jl).toString('utf8'));
  const bo = 20 + jl, bl = b.readUInt32LE(bo); return { json, bin: b.slice(bo + 8, bo + 8 + bl) };
}
function write(f, json, bin) {
  const pad = (buf, c) => Buffer.concat([buf, Buffer.alloc((4 - buf.length % 4) % 4, c)]);
  json.buffers = [{ byteLength: bin.length }];
  const j = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20), bb = pad(bin, 0);
  const h = Buffer.alloc(12); h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + j.length + 8 + bb.length, 8);
  const ch = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, Buffer.concat([h, ch(j.length, 0x4E4F534A), j, ch(bb.length, 0x004E4942), bb]));
}
const lin = (hex) => [1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).concat(1);
const d = read(SRC), s = read(DONOR), g = d.json;
const mat = (name) => g.materials.find((m) => m.name === name);
// ① 병 색
mat('Bottle deep jade').pbrMetallicRoughness.baseColorFactor = lin('#FF8A1E');   // 주황 음료
mat('Bottle cream label').pbrMetallicRoughness.baseColorFactor = lin('#FFFFFF'); // 흰 라벨(글자 없음)
mat('Bottle gold rim').pbrMetallicRoughness.baseColorFactor = lin('#F2F2F2');    // 흰 병 입구
const node = (name) => g.nodes.find((n) => n.name === name);
delete node('Alcohol lettering curved onto bottle').mesh; // '술' 글자 없앰
// ③ 볼 = 기본 두더지(mole-game-smile.glb) Cheek rose 색
mat('Cheek rose').pbrMetallicRoughness.baseColorFactor = [0.8549926280975342, 0.2541520893573761, 0.22696587443351746, 1];
// ② 눈동자: 담배 두더지의 Round pupil 메시를 가져와 소용돌이 자리에 넣음(같은 뼈대·같은 자리)
let bin = d.bin;
function copyAccessor(ai) {
  const a = s.json.accessors[ai], v = s.json.bufferViews[a.bufferView];
  const bytes = s.bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength), off = Math.ceil(bin.length / 4) * 4;
  bin = Buffer.concat([bin, Buffer.alloc(off - bin.length), bytes]);
  const vi = g.bufferViews.push(Object.assign({}, v, { buffer: 0, byteOffset: off })) - 1;
  return g.accessors.push(Object.assign({}, a, { bufferView: vi })) - 1;
}
const espresso = g.materials.findIndex((m) => m.name === 'Espresso');
for (const [from, to] of [['Round pupil 1', 'Spiral pupil 1'], ['Round pupil -1', 'Spiral pupil -1']]) {
  const sn = s.json.nodes.find((n) => n.name === from), dn = node(to), sm = s.json.meshes[sn.mesh];
  const prims = sm.primitives.map((p) => ({ mode: p.mode, material: espresso, indices: p.indices == null ? undefined : copyAccessor(p.indices), attributes: Object.fromEntries(Object.entries(p.attributes).map(([k, v]) => [k, copyAccessor(v)])) }));
  dn.mesh = g.meshes.push({ name: from, primitives: prims }) - 1;
  ['translation', 'rotation', 'scale'].forEach((k) => { if (sn[k]) dn[k] = sn[k]; else delete dn[k]; });
  dn.name = from;
}
write(OUT, g, bin);
console.log('저장', OUT, bin.length);
