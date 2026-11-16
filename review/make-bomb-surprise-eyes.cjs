// V1727 C 사용자: 폭탄 든 두더지 = 놀란 눈(흰자위 + 작은 눈동자). 기본 두더지 모델(v1692)에 담배 두더지의 눈 부품을 머리에 붙여 v1727 로 저장.
// 렌더러는 'Surprise ' 로 시작하는 부품을 폭탄 든 두더지일 때만 그림.
const fs = require('fs'), path = require('path');
const A = path.join(__dirname, '..', 'mole', 'assets');
const SRC = path.join(A, 'characters-v1692', 'mole-game-smile.glb'), DONOR = path.join(A, 'characters-v1694', 'behavior-smoke.glb');
const OUT = path.join(A, 'characters-v1727', 'mole-game-smile.glb');
function read(f) { const b = fs.readFileSync(f), jl = b.readUInt32LE(12), json = JSON.parse(b.slice(20, 20 + jl).toString('utf8')), bo = 20 + jl; return { json, bin: b.slice(bo + 8, bo + 8 + b.readUInt32LE(bo)) }; }
function write(f, json, bin) {
  const pad = (buf, c) => Buffer.concat([buf, Buffer.alloc((4 - buf.length % 4) % 4, c)]);
  json.buffers = [{ byteLength: bin.length }];
  const j = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20), bb = pad(bin, 0), h = Buffer.alloc(12);
  h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + j.length + 8 + bb.length, 8);
  const ch = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.concat([h, ch(j.length, 0x4E4F534A), j, ch(bb.length, 0x004E4942), bb]));
}
const d = read(SRC), s = read(DONOR), g = d.json;
let bin = d.bin;
function addBytes(bytes, target) { const off = Math.ceil(bin.length / 4) * 4; bin = Buffer.concat([bin, Buffer.alloc(off - bin.length), bytes]); return g.bufferViews.push(Object.assign({ buffer: 0, byteOffset: off, byteLength: bytes.length }, target ? { target } : {})) - 1; }
function copyAccessor(ai) { const a = s.json.accessors[ai], v = s.json.bufferViews[a.bufferView]; const bytes = s.bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); return g.accessors.push(Object.assign({}, a, { bufferView: addBytes(bytes, v.target) })) - 1; }
const matMap = new Map();
function copyMat(mi) { if (!matMap.has(mi)) { const m = JSON.parse(JSON.stringify(s.json.materials[mi])); m.name = 'Surprise ' + m.name; matMap.set(mi, g.materials.push(m) - 1); } return matMap.get(mi); }
const head = g.nodes.findIndex((n) => n.name === 'Head');
for (const [from, to, pupil] of [['Dazed ivory eye 1', 'Surprise ivory eye 1'], ['Dazed ivory eye -1', 'Surprise ivory eye -1'], ['Round pupil 1', 'Surprise pupil 1', 1], ['Round pupil -1', 'Surprise pupil -1', 1]]) {
  const sn = s.json.nodes.find((n) => n.name === from), sm = s.json.meshes[sn.mesh];
  const mesh = g.meshes.push({ name: to, primitives: sm.primitives.map((p) => ({ mode: p.mode, material: copyMat(p.material), indices: p.indices == null ? undefined : copyAccessor(p.indices), attributes: Object.fromEntries(Object.entries(p.attributes).map(([k, v]) => [k, copyAccessor(v)])) })) }) - 1;
  const n = { name: to, mesh, translation: sn.translation, rotation: sn.rotation, scale: sn.scale };
  if (pupil) n.scale = [sn.scale[0] * 0.6, sn.scale[1] * 0.6, sn.scale[2]]; // 놀란 눈 = 작은 눈동자
  const i = g.nodes.push(n) - 1; g.nodes[head].children.push(i);
}
write(OUT, g, bin);
console.log('저장', OUT, g.nodes.length);
