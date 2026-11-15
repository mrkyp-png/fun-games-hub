// 성공·실패 화면 장면용: 게임과 같은 칠(머리 모양·색)로 주인공 두더지 + 나쁜 두더지 4종 GLB 를 뽑음
const fs = require('fs'), vm = require('vm'), R = require('../mole/js/clay-rig-runtime.js');
const dir = 'review/result-scene'; fs.mkdirSync(dir, { recursive: true });
const read = (file) => { const b = fs.readFileSync('mole/' + file); return R.parseGLB(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const window = { StudioRig: R, MoleGame: {} }, ctx = { window, console, fetch: async (file) => { const b = fs.readFileSync('mole/' + file); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; } };
vm.runInNewContext(fs.readFileSync('mole/js/mole-appearances.js', 'utf8'), ctx);
function save(m, name) {
  let j = Buffer.from(JSON.stringify(m.json)); j = Buffer.concat([j, Buffer.alloc((4 - j.length % 4) % 4, 32)]);
  let b = Buffer.from(m.bin); b = Buffer.concat([b, Buffer.alloc((4 - b.length % 4) % 4)]);
  const out = Buffer.alloc(28 + j.length + b.length); out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(j.length, 12); out.writeUInt32LE(0x4e4f534a, 16); j.copy(out, 20); out.writeUInt32LE(b.length, 20 + j.length); out.writeUInt32LE(0x004e4942, 24 + j.length); b.copy(out, 28 + j.length);
  fs.writeFileSync(dir + '/' + name + '.glb', out); console.log('saved', name);
}
(async () => {
  const AP = window.MoleGame.MoleAppearances;
  const raw = (f) => { const g = read(f); g.json.animations = g.json.animations || []; return g; };
  save(AP.paint(await AP.prepare(raw('assets/characters-v1692/mole-clay-v47-smile.glb'), ['mohawk']), 'mohawk'), 'hero');
  const plan = { drink: 'curly', smoke: 'spiky', phone: 'forelock', thief: 'mohawk' };
  for (const [k, style] of Object.entries(plan)) save(AP.paint(await AP.prepare(raw('assets/characters-v1694/behavior-' + k + '.glb'), [style]), 'mohawk'), 'bad-' + k); // 게임처럼 몸은 베이지(모히칸 칠) 통일, 머리 모양만 다름
})().catch((e) => { console.error(e); process.exitCode = 1; });
