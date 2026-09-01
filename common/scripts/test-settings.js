const assert = require('assert');

// --- 브라우저 전역 흉내 (모듈 로드 전에 세팅) ---
function makeStorage(seed) {
  const map = Object.assign({}, seed);
  return {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; },
    _map: map
  };
}
global.window = global;
global.localStorage = makeStorage({});
// Node 24 는 읽기 전용 navigator 전역이 있어(시스템 로케일) 그냥 대입이 안 먹는다 — defineProperty 로 덮어쓴다.
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'en-US', vibrate: null }, configurable: true, writable: true
});
global.addEventListener = () => {};

const { Settings } = require('../settings.js');

// 1) 빈 스토리지 → 기본값
assert.strictEqual(Settings.get('sound'), true, 'sound defaults on');
assert.strictEqual(Settings.get('music'), false, 'music defaults off');
assert.strictEqual(Settings.get('vibration'), true, 'vibration defaults on');
assert.strictEqual(Settings.get('lang'), 'en', 'lang follows navigator.language (en-US → en)');

// 2) 저장/복원
Settings.set('music', true);
assert.strictEqual(localStorage.getItem('musicOn'), '1', 'music true stored as "1"');
assert.strictEqual(Settings.get('music'), true);
Settings.set('sound', false);
assert.strictEqual(localStorage.getItem('soundOn'), '0');
assert.strictEqual(Settings.get('sound'), false);
Settings.set('lang', 'ko');
assert.strictEqual(localStorage.getItem('appLang'), 'ko');
assert.strictEqual(Settings.get('lang'), 'ko');

// 3) onChange 통지 + 해제
let seen = [];
const off = Settings.onChange((name, value) => seen.push([name, value]));
Settings.set('vibration', false);
assert.deepStrictEqual(seen, [['vibration', false]], 'subscriber notified');
off();
Settings.set('vibration', true);
assert.strictEqual(seen.length, 1, 'unsubscribed subscriber not notified');

// 4) 잘못된 name 무시
Settings.set('bogus', 'x');
assert.strictEqual(Settings.get('bogus'), undefined);

// 5) vibrate 게이팅
let vibed = null;
global.navigator.vibrate = (p) => { vibed = p; };
Settings.set('vibration', false);
Settings.vibrate(30);
assert.strictEqual(vibed, null, 'vibrate suppressed when vibration off');
Settings.set('vibration', true);
Settings.vibrate([10, 20]);
assert.deepStrictEqual(vibed, [10, 20], 'vibrate passes through when on');

// 6) sfxEnabled 연동
Settings.set('sound', true);
assert.strictEqual(Settings.sfxEnabled(), true);
Settings.set('sound', false);
assert.strictEqual(Settings.sfxEnabled(), false);

console.log('test-settings.js: all assertions passed');
