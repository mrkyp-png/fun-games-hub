// V1727 C 사용자: 담배 두더지 → 방귀 두더지. 원본 담배 두더지(v1694)에서 뼈·몸은 그대로, 부품·동작만 바꿈(GLB 직접 수정)
//  0~1.1초: 올라오면 뒤로 홱 돌아(엉덩이가 앞) '뿡!' 방귀 구름 → 다시 앞으로 돌아 안착
//  1.25초~: 오른손으로 코를 쥐고, 눈은 질끈(> <), 얼굴 둘레에 방귀 연기가 맴돎(렌더러가 1.5~3.0초 구간만 반복)
//  볼 = 기본 두더지 색, 시가·불씨·입 연기 고리 없음
const fs = require('fs'), path = require('path');
const A = path.join(__dirname, '..', 'mole', 'assets');
const SRC = path.join(A, 'characters-v1694', 'behavior-smoke.glb');
const OUT = path.join(A, 'characters-v1728', 'behavior-smoke.glb'); // V1728 C: 점프·큰 구름(폰 캐시 때문에 새 폴더)
function read(f) { const b = fs.readFileSync(f), jl = b.readUInt32LE(12), json = JSON.parse(b.slice(20, 20 + jl).toString('utf8')), bo = 20 + jl; return { json, bin: b.slice(bo + 8, bo + 8 + b.readUInt32LE(bo)) }; }
function write(f, json, bin) {
  const pad = (buf, c) => Buffer.concat([buf, Buffer.alloc((4 - buf.length % 4) % 4, c)]);
  json.buffers = [{ byteLength: bin.length }];
  const j = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20), bb = pad(bin, 0), h = Buffer.alloc(12);
  h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + j.length + 8 + bb.length, 8);
  const ch = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.concat([h, ch(j.length, 0x4E4F534A), j, ch(bb.length, 0x004E4942), bb]));
}
const d = read(SRC), g = d.json;
let bin = d.bin;
function addBytes(bytes) { const off = Math.ceil(bin.length / 4) * 4; bin = Buffer.concat([bin, Buffer.alloc(off - bin.length), bytes]); return g.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: bytes.length }) - 1; }
function addFloat(arr, type, withMinMax) {
  const f = Float32Array.from(arr), n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type], acc = { bufferView: addBytes(Buffer.from(f.buffer)), componentType: 5126, count: f.length / n, type };
  if (withMinMax) { acc.min = [Math.min(...f)]; acc.max = [Math.max(...f)]; }
  return g.accessors.push(acc) - 1;
}
const lin = (hex, a = 1) => [1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).concat(a);
const idx = (name) => g.nodes.findIndex((n) => n.name === name), node = (name) => g.nodes[idx(name)];
const mat = (name) => g.materials.find((m) => m.name === name);

// ---- 수학 ----
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qaxis = (ax, ang) => { const s = Math.sin(ang / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; };
const qrot = (q, v) => { const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), [-q[0], -q[1], -q[2], q[3]]); return [p[0], p[1], p[2]]; };
const qnorm = (q) => { const n = Math.hypot(...q); return q.map((v) => v / n); };
function qslerp(a, b, t) { let c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; if (c < 0) { b = b.map((v) => -v); c = -c; } if (c > 0.9995) return qnorm(a.map((v, i) => v + (b[i] - v) * t)); const th = Math.acos(c), s = Math.sin(th); return a.map((v, i) => (v * Math.sin((1 - t) * th) + b[i] * Math.sin(t * th)) / s); }
function arc(u, v) { const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], w = 1 + u[0] * v[0] + u[1] * v[1] + u[2] * v[2]; return qnorm([c[0], c[1], c[2], w]); }
const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]), len = (a) => Math.hypot(...a), unit = (a) => a.map((v) => v / len(a));
const ease = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ---- 부품 정리 ----
['Cigarette ash', 'Cigarette band gold', 'Cigarette band red', 'Cigarette ember', 'Cigarette filter', 'Cigarette paper', 'Ember glow',
 'Mouth smoke ring 0', 'Mouth smoke ring 1', 'Mouth smoke ring 2', 'Dazed ivory eye 1', 'Dazed ivory eye -1', 'Round pupil 1', 'Round pupil -1'].forEach((n) => { delete node(n).mesh; });
mat('Cheek rose').baseColorFactor; mat('Cheek rose').pbrMetallicRoughness.baseColorFactor = [0.8549926280975342, 0.2541520893573761, 0.22696587443351746, 1];
const gas = mat('Smoke soft gray'); gas.name = 'Fart gas'; gas.pbrMetallicRoughness.baseColorFactor = lin('#B7CF4A', 0.62);
gas.pbrMetallicRoughness.roughnessFactor = 0.9;
const puffMesh = node('Tip smoke 0').mesh;
const puffs = ['Tip smoke 0', 'Tip smoke 1', 'Tip smoke 2', 'Tip smoke 3'].map(idx);       // 뿡! 구름
const face = [];                                                                         // 얼굴 둘레 연기
for (let k = 0; k < 7; k++) { const i = g.nodes.push({ name: 'Fart cloud ' + k, mesh: puffMesh }) - 1; g.scenes[0].nodes.push(i); face.push(i); }

// ---- 동작 ----
const anim = g.animations.find((a) => a.name === 'Behavior');
const DUR = 3, FPS = 24, T = Array.from({ length: DUR * FPS + 1 }, (_, i) => i / FPS);
function setTrack(nodeIndex, pathName, values) {
  anim.channels = anim.channels.filter((c) => !(c.target.node === nodeIndex && c.target.path === pathName));
  const sampler = anim.samplers.push({ input: addFloat(T, 'SCALAR', true), output: addFloat(values.flat(), pathName === 'rotation' ? 'VEC4' : 'VEC3'), interpolation: 'LINEAR' }) - 1;
  anim.channels.push({ sampler, target: { node: nodeIndex, path: pathName } });
}
// 원래 채널 값(첫 키) 읽기
function firstKey(nodeIndex, pathName) {
  const c = anim.channels.find((x) => x.target.node === nodeIndex && x.target.path === pathName), a = g.accessors[anim.samplers[c.sampler].output], v = g.bufferViews[a.bufferView], n = a.type === 'VEC4' ? 4 : 3, o = (v.byteOffset || 0) + (a.byteOffset || 0);
  return Array.from({ length: n }, (_, k) => bin.readFloatLE(o + k * 4));
}
function keyAt(nodeIndex, pathName, frame) {
  const c = anim.channels.find((x) => x.target.node === nodeIndex && x.target.path === pathName), a = g.accessors[anim.samplers[c.sampler].output], v = g.bufferViews[a.bufferView], n = a.type === 'VEC4' ? 4 : 3, o = (v.byteOffset || 0) + (a.byteOffset || 0);
  return Array.from({ length: n }, (_, k) => bin.readFloatLE(o + (frame * n + k) * 4));
}

// 몸 돌기: 0~0.35 뒤로(180°), 0.35~0.8 뒤 보고 뿡, 0.8~1.1 다시 앞으로(360°). 뿡 때 살짝 들썩
const ROOT = idx('Root'), ROOT_T = firstKey(ROOT, 'translation');
// V1728 C 사용자: 높게 점프하며 뒤로 돌고(0.12~0.45) 꼭대기에서 뿡 → 내려와(0.9) 다시 앞으로(0.95~1.25)
const yaw = (t) => t < 0.12 ? 0 : t < 0.45 ? Math.PI * ease((t - 0.12) / 0.33) : t < 0.95 ? Math.PI : t < 1.25 ? Math.PI + Math.PI * ease((t - 0.95) / 0.3) : 2 * Math.PI;
setTrack(ROOT, 'rotation', T.map((t) => qaxis([0, 1, 0], yaw(t))));
const JUMP = 0.75;
setTrack(ROOT, 'translation', T.map((t) => { const b = t < 0.12 ? -0.08 * Math.sin(Math.PI * t / 0.12) : t < 0.45 ? JUMP * (1 - Math.pow(1 - (t - 0.12) / 0.33, 2)) : t < 0.62 ? JUMP : t < 0.9 ? JUMP * (1 - Math.pow((t - 0.62) / 0.28, 2)) : t < 1.05 ? -0.07 * Math.sin(Math.PI * (t - 0.9) / 0.15) : 0; return [ROOT_T[0], ROOT_T[1] + b, ROOT_T[2]]; }));

// 오른손: 처음엔 가슴 앞(원래 시가 든 자세), 1.1~1.4초에 코로 가져가 쥠
const HAND = idx('Hand.R'), UARM = idx('UpperArm.R'), SHOULDER = node('UpperArm.R').translation;
const H0 = keyAt(HAND, 'translation', 0), Q0 = keyAt(HAND, 'rotation', 0), U0 = keyAt(UARM, 'rotation', 0), S0 = keyAt(UARM, 'scale', 0);
const QM = keyAt(HAND, 'rotation', 48);                         // 시가를 입에 댄 손 방향
const GRIP = [-0.09, 0.39, 0.13];                               // 손가락 사이(시가 쥔 자리), 손 기준
const NOSE = [0, 1.22 + 0.27, 0.92 + 0.13];                     // 코끝(몸 기준)
const H1 = sub(NOSE, qrot(QM, GRIP));
const UNIT = len(sub(H0, SHOULDER)) / S0[1];                    // 팔 길이(배율 1일 때)
const reach = (t) => ease((t - 1.25) / 0.25);
const handPos = (t) => { const w = t > 1.5 ? 0.012 * Math.sin(2 * Math.PI * (t - 1.5) / 0.5) : 0; return add(mix(H0, H1, reach(t)), [0, w, 0]); };
setTrack(HAND, 'translation', T.map(handPos));
setTrack(HAND, 'rotation', T.map((t) => qslerp(Q0, QM, reach(t))));
// 가운뎃손가락: 굽힘이 달라 손등 쪽으로 밀려 보임 → 검지와 같은 굽힘(길이는 그대로)
{ const c1 = keyAt(idx('Finger1.R_Curl'), 'rotation', 0), r1 = keyAt(idx('Finger1.R'), 'rotation', 0); setTrack(idx('Finger2.R_Curl'), 'rotation', T.map(() => c1)); setTrack(idx('Finger2.R'), 'rotation', T.map(() => r1)); }
const dir0 = unit(sub(H0, SHOULDER));
setTrack(UARM, 'rotation', T.map((t) => qnorm(qmul(arc(dir0, unit(sub(handPos(t), SHOULDER))), U0))));
setTrack(UARM, 'scale', T.map((t) => [S0[0], len(sub(handPos(t), SHOULDER)) / UNIT, S0[2]]));

// 머리: 코 막은 뒤 '으~' 하고 좌우로 살짝 도리도리
const HEAD = idx('Head');
setTrack(HEAD, 'rotation', T.map((t) => t < 1.5 ? [0, 0, 0, 1] : qaxis([0, 1, 0], 0.09 * Math.sin(2 * Math.PI * (t - 1.5) / 0.75))));

// 눈: 질끈(> <) — 이 모델엔 눈 부품이 없어 진한 갈색 꺾쇠 눈을 새로 만들어 머리에 붙임
{
  const espresso = g.materials.findIndex((m) => m.name === 'Espresso'), RAD = 0.024, SEG = 10;
  function chevron(sg) { // 화면 왼쪽 눈 '>', 오른쪽 눈 '<' (꼭짓점이 코 쪽)
    const pts = [[sg * 0.075, 0.075, -0.012], [-sg * 0.065, 0, 0.012], [sg * 0.075, -0.075, -0.012]], pos = [], nor = [], ind = [];
    const sphere = (c) => { const b = pos.length / 3; for (let i = 0; i <= 6; i++) { const th = Math.PI * i / 6; for (let k = 0; k < SEG; k++) { const ph = 2 * Math.PI * k / SEG, n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; pos.push(c[0] + n[0] * RAD, c[1] + n[1] * RAD, c[2] + n[2] * RAD); nor.push(...n); } } for (let i = 0; i < 6; i++) for (let k = 0; k < SEG; k++) { const a = b + i * SEG + k, c2 = b + i * SEG + (k + 1) % SEG; ind.push(a, a + SEG, c2, c2, a + SEG, c2 + SEG); } };
    const tube = (p, q) => { const ax = unit(sub(q, p)), up = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; let u = [ax[1] * up[2] - ax[2] * up[1], ax[2] * up[0] - ax[0] * up[2], ax[0] * up[1] - ax[1] * up[0]]; u = unit(u); const v = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]], b = pos.length / 3; for (const e of [p, q]) for (let k = 0; k < SEG; k++) { const ph = 2 * Math.PI * k / SEG, n = [0, 1, 2].map((j) => u[j] * Math.cos(ph) + v[j] * Math.sin(ph)); pos.push(...e.map((x, j) => x + n[j] * RAD)); nor.push(...n); } for (let k = 0; k < SEG; k++) { const a = b + k, c2 = b + (k + 1) % SEG; ind.push(a, c2, a + SEG, c2, c2 + SEG, a + SEG); } };
    pts.forEach(sphere); tube(pts[0], pts[1]); tube(pts[1], pts[2]);
    const P = addFloat(pos, 'VEC3'); g.accessors[P].min = [0, 1, 2].map((j) => Math.min(...pos.filter((_, i) => i % 3 === j))); g.accessors[P].max = [0, 1, 2].map((j) => Math.max(...pos.filter((_, i) => i % 3 === j)));
    const I = g.accessors.push({ bufferView: addBytes(Buffer.from(Uint32Array.from(ind).buffer)), componentType: 5125, count: ind.length, type: 'SCALAR' }) - 1;
    return g.meshes.push({ name: 'Squeeze eye', primitives: [{ attributes: { POSITION: P, NORMAL: addFloat(nor, 'VEC3') }, indices: I, material: espresso }] }) - 1;
  }
  const head = idx('Head');
  for (const [sg, x] of [[-1, -0.275], [1, 0.275]]) { const i = g.nodes.push({ name: 'Squeeze eye ' + (sg < 0 ? 'L' : 'R'), mesh: chevron(sg), translation: [x, 0.57, 0.715] }) - 1; g.nodes[head].children.push(i); }
}

// 뿡! 구름: 0.42초부터 엉덩이(돌아선 뒤 앞쪽 아래)에서 퍼지며 위로, 1.3초쯤 사라짐
const BURST = [0, 0.1, 0.35]; // V1728 C 사용자: 큰 방귀 구름이 구멍에서 솟아오름
const burstDir = [[-0.5, 1.2, 0.3], [0.5, 1.3, 0.25], [-0.15, 1.7, 0.4], [0.25, 1.9, 0.2]];
puffs.forEach((ni, k) => {
  const t0 = 0.45 + k * 0.05;
  const p = (t) => Math.max(0, Math.min(1, (t - t0) / 0.9));
  setTrack(ni, 'translation', T.map((t) => add(BURST, burstDir[k].map((v) => v * (0.25 + ease(p(t)) * 0.9)))));
  setTrack(ni, 'scale', T.map((t) => { const q = p(t), s = t < t0 ? 0 : q < 0.25 ? 0.68 * ease(q / 0.25) : 0.68 * (1 - ease((q - 0.25) / 0.75)) + 0.08 * (1 - q); return [s, s * 0.85, s]; }));
});
// 얼굴 둘레 연기: 0.9초부터 피어나 머리 둘레를 천천히 돌며 부풀었다 줄었다(1.2~3.0 반복 구간에서 자연스럽게 이어지게 1.8초 주기)
const HEADC = [0, ROOT_T[1] + 0.3 + 1.22 + 0.45, 0.25];
face.forEach((ni, k) => {
  const a0 = k / face.length * 2 * Math.PI, yo = [0.05, -0.25, 0.25, -0.1, 0.15, -0.3, 0.3][k], r = 0.95 + 0.08 * (k % 3);
  const pos = (t) => { const a = a0 + 2 * Math.PI * (t - 1.5) / 1.5; return [Math.sin(a) * r, HEADC[1] + yo + 0.06 * Math.sin(2 * Math.PI * (t - 1.5) / 0.75 + k), HEADC[2] + Math.cos(a) * r * 0.75]; };
  setTrack(ni, 'translation', T.map(pos));
  setTrack(ni, 'scale', T.map((t) => { const grow = ease((t - 1.0 - k * 0.04) / 0.35), s = (0.2 + 0.05 * Math.sin(2 * Math.PI * (t - 1.5) / 0.75 + k * 1.7)) * grow; return [s, s * 0.9, s]; }));
});
// 쓰지 않는 부품 채널 정리(불씨·입 연기 고리)
const gone = new Set(['Ember glow', 'Mouth smoke ring 0', 'Mouth smoke ring 1', 'Mouth smoke ring 2'].map(idx));
anim.channels = anim.channels.filter((c) => !gone.has(c.target.node));
const usedS = [...new Set(anim.channels.map((c) => c.sampler))].sort((a, b) => a - b), remap = new Map(usedS.map((s, i) => [s, i]));
anim.samplers = usedS.map((s) => anim.samplers[s]); anim.channels.forEach((c) => { c.sampler = remap.get(c.sampler); });

write(OUT, g, bin);
console.log('저장', OUT, '손 코 위치', H1.map((v) => v.toFixed(2)).join(','), '팔 길이', UNIT.toFixed(3));
