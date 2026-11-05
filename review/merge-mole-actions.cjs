// 작업 7: v43 에 동작 2개(Jump·WalkFwd)를 덧붙여 v44 를 만든다.
// 모양·색·뼈대 데이터는 바이트 그대로 두고 BIN 끝에 동작 데이터만 추가한다.
// 실행: node review/merge-mole-actions.cjs
// 좌표: 두더지 얼굴 = +z, 위 = +y. 팔·머리·몸 회전은 부모 공간 X축 기준(θ<0 = 앞으로/위로).
const fs = require('fs'), path = require('path');
const RM = require('../mole/js/clay-rig-math.js');
const DIR = path.join(__dirname, '../mole/assets/checkerboard-v1590');
const src = fs.readFileSync(path.join(DIR, 'mole-clay-v43.glb'));
const model = RM.parseGLB(src.buffer.slice(src.byteOffset, src.byteOffset + src.length));
const g = JSON.parse(JSON.stringify(model.json));
const node = (n) => g.nodes.findIndex((x) => x.name === n);

// ---- 수학 ----
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qx = (t) => [Math.sin(t / 2), 0, 0, Math.cos(t / 2)];
const qz = (t) => [0, 0, Math.sin(t / 2), Math.cos(t / 2)];
const ease = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const seg = (t, a, b) => ease((t - a) / (b - a)); // a→b 구간 0→1

// ---- 기본 자세: Idle 채널을 그대로 샘플 ----
const idle = g.animations.find((a) => a.name === 'Idle');
const channels = idle.channels.map((c) => {
  const s = idle.samplers[c.sampler];
  return { node: c.target.node, path: c.target.path, times: RM.accessor(model, s.input), values: RM.accessor(model, s.output) };
});
function sampleIdle(ch, t) {
  const T = ch.times, w = ch.path === 'rotation' ? 4 : 3, dur = T[T.length - 1];
  t = dur > 0 ? t % dur : 0;
  let i = 0; while (i < T.length - 2 && T[i + 1] < t) i++;
  const k = T.length > 1 ? Math.min(1, Math.max(0, (t - T[i]) / ((T[i + 1] - T[i]) || 1))) : 0;
  const a = ch.values.slice(i * w, i * w + w), b = ch.values.slice(Math.min(i + 1, T.length - 1) * w, Math.min(i + 1, T.length - 1) * w + w);
  if (w === 4 && a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0) for (let j = 0; j < 4; j++) b[j] = -b[j];
  const v = Array.from(a, (x, j) => x + (b[j] - x) * k);
  if (w === 4) { const n = Math.hypot(...v); return v.map((x) => x / n); }
  return v;
}
const REST = (n, p) => { const nd = g.nodes[node(n)]; return (nd[p] || (p === 'rotation' ? [0, 0, 0, 1] : p === 'scale' ? [1, 1, 1] : [0, 0, 0])).slice(); };
const rot = (n, th) => qmul(qx(th), REST(n, 'rotation'));      // 부모 공간 X축 회전
const addT = (n, d) => REST(n, 'translation').map((x, i) => x + d[i]);

// ---- 동작 정의: f(t) → { '노드|path': 값 } (덮어쓸 것만) ----
const CLIPS = {
  // 앞으로 걷기: 발을 들어 앞(+z)으로 내딛고, 팔은 반대쪽 다리와 엇갈려 크게 흔듦
  WalkFwd: { dur: 0.8, loop: true, f(t) {
    const p = t / 0.8 * 2 * Math.PI, A = 1.25;
    const foot = (q) => [0, Math.max(0, Math.sin(q)) * 0.13, -0.2 * Math.cos(q)];
    return {
      'Foot.L|translation': addT('Foot.L', foot(p)), 'Foot.R|translation': addT('Foot.R', foot(p + Math.PI)),
      'UpperArm.L|rotation': rot('UpperArm.L', -A * Math.cos(p)), 'UpperArm.R|rotation': rot('UpperArm.R', A * Math.cos(p)),
      'Root|translation': addT('Root', [0, 0.035 * Math.abs(Math.sin(p)), 0]),
      'Root|rotation': qz(0.03 * Math.sin(p)), 'Body|rotation': qx(0.06)
    };
  } },
  // 점프(높이는 코드): 웅크림 → 공중(팔 위로·몸 늘어남) → 착지 찌그러짐
  Jump: { dur: 0.6, loop: false, f(t) {
    const crouch = seg(t, 0, 0.1) * (1 - seg(t, 0.1, 0.16)), air = seg(t, 0.12, 0.2) * (1 - seg(t, 0.42, 0.48)), land = seg(t, 0.45, 0.5) * (1 - seg(t, 0.5, 0.6));
    const sy = 1 - 0.18 * crouch + 0.08 * air - 0.15 * land, sxz = 1 + 0.08 * crouch - 0.03 * air + 0.07 * land;
    const arm = 0.6 * crouch - 2.2 * air;
    return {
      'Body|scale': [sxz, sy, sxz],
      'UpperArm.L|rotation': rot('UpperArm.L', arm), 'UpperArm.R|rotation': rot('UpperArm.R', arm),
      // 공중에서 발을 아래로 쭉 뻗음(사용자 지정)
      'Foot.L|translation': addT('Foot.L', [0, -0.2 * air, 0]), 'Foot.R|translation': addT('Foot.R', [0, -0.2 * air, 0])
    };
  } }
};

// ---- BIN 에 덧붙이기 ----
const bin = Buffer.from(model.bin.buffer, model.bin.byteOffset, model.bin.byteLength);
const extra = [];
let offset = Math.ceil(bin.length / 4) * 4;
const padStart = offset - bin.length;
function pushAccessor(arr, type, withMinMax) {
  const f = Float32Array.from(arr), bytes = Buffer.from(f.buffer);
  const view = g.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length }) - 1;
  extra.push(bytes); offset += bytes.length;
  const acc = { bufferView: view, componentType: 5126, count: f.length / (type === 'SCALAR' ? 1 : type === 'VEC3' ? 3 : 4), type };
  if (withMinMax) { acc.min = [Math.min(...f)]; acc.max = [Math.max(...f)]; }
  return g.accessors.push(acc) - 1;
}
const FPS = 30;
for (const [name, c] of Object.entries(CLIPS)) {
  const n = Math.round(c.dur * FPS), times = Array.from({ length: n + 1 }, (_, i) => i / FPS);
  const tIn = pushAccessor(times, 'SCALAR', true);
  const anim = { name, samplers: [], channels: [] };
  const frames = times.map((t) => c.f(c.loop ? t % c.dur : t));
  for (const ch of channels) {
    const key = g.nodes[ch.node].name + '|' + ch.path;
    const vals = [];
    times.forEach((t, i) => vals.push(...(frames[i][key] || sampleIdle(ch, t))));
    const out = pushAccessor(vals, ch.path === 'rotation' ? 'VEC4' : 'VEC3', false);
    const si = anim.samplers.push({ input: tIn, output: out, interpolation: 'LINEAR' }) - 1;
    anim.channels.push({ sampler: si, target: { node: ch.node, path: ch.path } });
  }
  g.animations.push(anim);
}
const newBin = Buffer.concat([bin, Buffer.alloc(padStart), ...extra]);
g.buffers[0].byteLength = newBin.length;

// ---- GLB 쓰기 ----
let json = Buffer.from(JSON.stringify(g)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
const binPad = Buffer.concat([newBin, Buffer.alloc((4 - newBin.length % 4) % 4)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + binPad.length, 8);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
const out = Buffer.concat([head, ch(json.length, 0x4E4F534A), json, ch(binPad.length, 0x004E4942), binPad]);
fs.writeFileSync(path.join(DIR, 'mole-clay-v44.glb'), out);
console.log('mole-clay-v44.glb', out.length, 'bytes, animations', g.animations.length);
