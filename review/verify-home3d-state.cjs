// 3D 홈 상태 제어기 검사 (작업 2). 실행: node review/verify-home3d-state.cjs
const assert = require('assert');
const S = require('../mole/js/home3d-state.js');

const log = [];
const h = S.create({ onEnter: (s) => log.push('+' + s), onLeave: (s) => log.push('-' + s) });
assert.strictEqual(h.state, null);

// 앱 켤 때마다 첫 장면
assert.strictEqual(h.boot(), true);
assert.strictEqual(h.state, 'INTRO');
assert.strictEqual(h.inputEnabled(), false);
assert.strictEqual(h.openFeature('shop'), false, '첫 장면 중 기능 열기 무시');
assert.strictEqual(h.state, 'INTRO');

assert.strictEqual(h.introDone(), true);
assert.strictEqual(h.state, 'EXPLORE');
assert.strictEqual(h.inputEnabled(), true);
assert.strictEqual(h.introDone(), false, 'EXPLORE 에서 introDone 은 무시');

// 기능 열기 → 닫기 = 같은 시점
const v = { x: 1.5, z: -2, yaw: 0.7, pitch: 0.3 };
h.saveView(v);
assert.strictEqual(h.openFeature('lightMode'), true, '라운드 지도도 기능 화면');
assert.strictEqual(h.state, 'FEATURE');
assert.strictEqual(h.feature, 'lightMode');
assert.strictEqual(h.inputEnabled(), false);
assert.strictEqual(h.homeShown(), true);
assert.strictEqual(h.state, 'EXPLORE');
assert.strictEqual(h.feature, null);
assert.deepStrictEqual(h.view(), v);
assert.notStrictEqual(h.view(), v, 'view 는 복사본');

// 게임 → 홈 = INTRO 아님, 시점 유지
h.openFeature('lightMode');
assert.strictEqual(h.gameStarted(), true);
assert.strictEqual(h.state, 'GAMEPLAY');
assert.strictEqual(h.homeShown(), true);
assert.strictEqual(h.state, 'EXPLORE');
assert.deepStrictEqual(h.view(), v);

// 이미 광장일 때 homeShown 은 무시(중복 알림)
assert.strictEqual(h.homeShown(), false);
// 잘못된 action
assert.strictEqual(h.openFeature('nope'), false);
// 첫 장면 중 게임 시작은 GAMEPLAY 로(어떤 상태에서도)
const g = S.create({});
g.boot();
assert.strictEqual(g.gameStarted(), true);
assert.strictEqual(g.state, 'GAMEPLAY');

assert.deepStrictEqual(log.slice(0, 4), ['+INTRO', '-INTRO', '+EXPLORE', '-EXPLORE']);
console.log('verify-home3d-state: ok');
