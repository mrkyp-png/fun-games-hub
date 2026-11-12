// 3D 간판 글자 검사 (작업 6). 실행: node review/verify-home3d-signs.cjs
const assert = require('assert');
const L = require('../mole/js/home3d-layout.js');
const Sg = require('../mole/js/home3d-signs.js');

// 가짜 WebGL / 캔버스: 텍스처 생성·삭제 수와 그린 글자를 센다
let live = 0, made = 0;
const gl = {
  TEXTURE_2D: 1, RGBA: 2, UNSIGNED_BYTE: 3, TEXTURE_MIN_FILTER: 4, TEXTURE_MAG_FILTER: 5, LINEAR: 6, LINEAR_MIPMAP_LINEAR: 7,
  TEXTURE_WRAP_S: 8, TEXTURE_WRAP_T: 9, CLAMP_TO_EDGE: 10, UNPACK_FLIP_Y_WEBGL: 11,
  createTexture() { live++; made++; return { id: made }; }, deleteTexture() { live--; },
  bindTexture() {}, texImage2D() {}, texParameteri() {}, generateMipmap() {}, pixelStorei() {}
};
const drawn = [];
const makeCanvas = () => ({ width: 0, height: 0, getContext: () => ({
  clearRect() {}, fillRect() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {},
  measureText: (s) => ({ width: s.length * 10 }), fillText: (s) => drawn.push(s), strokeText() {}
}) });
const dict = { ko: { 'mole.pad.gameMole': '두더지팡' }, en: { 'mole.pad.gameMole': 'Mole\nPang' } };
const t = (lang) => (k) => (dict[lang][k] || k);

// 글자 규칙
assert.strictEqual(Sg.labelFor(L.SITES.find((s) => s.action === 'lightMode'), 'en', t('en')), 'Mole Pang', '줄바꿈 → 한 줄');

const signs = Sg.create(gl, { makeCanvas });
const m1 = signs.build('ko', L.SITES, t('ko'));
assert.strictEqual(m1.size, 4); assert.strictEqual(live, 4);
assert.ok(drawn.includes('두더지팡'));
signs.build('en', L.SITES, t('en'));
signs.build('ko', L.SITES, t('ko'));
assert.strictEqual(live, 4, '한→영→한 후에도 살아 있는 텍스처 = 4');
assert.ok(drawn.includes('Mole Pang'));
signs.dispose();
assert.strictEqual(live, 0, 'dispose 후 0');
console.log('verify-home3d-signs: ok');
// Compare actual rendered letter heights, rather than texture pixel sizes.
const fs=require('fs'),vm=require('vm'),R=require('../mole/js/clay-rig-math.js');
const bytes=fs.readFileSync('mole/assets/home3d/plaza.glb'),model=R.parseGLB(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)),instances=R.instances(model);
globalThis.MoleGame.Home3DLayout=L;
const renderer=fs.readFileSync('mole/js/home3d-renderer.js','utf8'),begin=renderer.indexOf('  function labelWorld('),brace=renderer.indexOf('{',begin);let depth=1,end=brace+1;for(;depth;end++){if(renderer[end]==='{')depth++;if(renderer[end]==='}')depth--;}
const context={root:{MoleGame:{Home3DSigns:Sg}},R};vm.createContext(context);vm.runInContext(renderer.slice(begin,end),context);
const mole=instances.find(i=>i.name==='Sign_lightMode'),moleBounds=R.bounds(model,[mole]),moleFont=(moleBounds.high[1]-moleBounds.low[1])*96/160;
for(const action of ['shop','rhythm']){const original=instances.find(i=>i.name==='Sign_'+action),world=context.labelWorld(model,original),box=R.bounds(model,[{...original,world}]);assert(Math.abs((box.high[1]-box.low[1])*.72-moleFont)<1e-5,'Same physical letter height as Mole Pang');assert.deepStrictEqual(Array.from(world.slice(12,15)),Array.from(original.world.slice(12,15)),'Label stays centred at its building');}
console.log('verify-home3d-signs: matching world letter height, existing label centres retained');
