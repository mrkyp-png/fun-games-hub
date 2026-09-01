const assert = require('assert');

function makeStorage(seed) {
  const map = Object.assign({}, seed);
  return { getItem: (k) => (k in map ? map[k] : null), setItem: (k, v) => { map[k] = String(v); }, removeItem: (k) => { delete map[k]; } };
}
global.window = global;
global.localStorage = makeStorage({ appLang: 'ko' });
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'ko-KR' }, configurable: true, writable: true
});
global.addEventListener = () => {};
// i18n.js 는 settings.js 에 의존
require('../settings.js');
const { I18N } = require('../i18n.js');

// 1) register + t + 언어 선택
I18N.register({ ko: { hi: '안녕', bye: '잘가' }, en: { hi: 'hi', bye: 'bye' } });
assert.strictEqual(I18N.lang, 'ko');
assert.strictEqual(I18N.t('hi'), '안녕');

// 2) 없는 키 → en 폴백 → key 폴백
I18N.register({ en: { onlyEn: 'only-en' } });
assert.strictEqual(I18N.t('onlyEn'), 'only-en', 'falls back to en when ko missing');
assert.strictEqual(I18N.t('missing'), 'missing', 'falls back to the key itself');

// 3) {n} 치환
I18N.register({ ko: { pts: '{n}점' }, en: { pts: '{n} pts' } });
assert.strictEqual(I18N.t('pts', { n: 120 }), '120점');

// 4) setLang → 즉시 반영
I18N.setLang('en');
assert.strictEqual(I18N.lang, 'en');
assert.strictEqual(I18N.t('hi'), 'hi');
assert.strictEqual(localStorage.getItem('appLang'), 'en');

// 5) register 병합/덮어쓰기
I18N.register({ en: { hi: 'HELLO' } });
assert.strictEqual(I18N.t('hi'), 'HELLO', 'later register wins for the same key');
assert.strictEqual(I18N.t('bye'), 'bye', 'earlier keys survive the merge');

// 6) onChange
let langs = [];
const off = I18N.onChange((l) => langs.push(l));
I18N.setLang('ko');
assert.deepStrictEqual(langs, ['ko']);
off();

console.log('test-i18n.js: all assertions passed');
