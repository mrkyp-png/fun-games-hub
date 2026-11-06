// 3D 홈 ↔ 기존 게임 연결 검사 (작업 3). 실행: node review/verify-home3d-bridge.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 브라우저 대신 최소 전역
global.window = global;
global.MoleGame = {};
global.location = { search: '' };
global.FGH = { I18N: { t: (k) => k, lang: 'ko', onChange() {} } };
require('../mole/js/home3d-layout.js');
require('../mole/js/home3d-state.js');
const H = require('../mole/js/home3d.js');
global.MoleGame.Home3DState = require('../mole/js/home3d-state.js');
global.MoleGame.Home3DLayout = require('../mole/js/home3d-layout.js');

// 1) 정식 교체(작업 9): ?home3d=0 이면 구형 홈(비교용), 그 외엔 3D 홈
global.location.search = '?home3d=0';
assert.strictEqual(H.create({ homeAction: () => {} }), null);
// 검토용 훅은 ?h3debug=1 일 때만
global.location.search = '';
H.create({ homeAction: () => {} });
assert.strictEqual(global.__home3d, undefined, '공개 주소엔 검토 훅 없음');

// 2) 기본 = 켜짐
global.location.search = '';
const calls = [];
let result = undefined;
const h = H.create({ homeAction: (a) => { calls.push(a); return result; } });
assert.ok(h);
assert.strictEqual(h.state(), 'INTRO');
h.introDone();
assert.strictEqual(h.state(), 'EXPLORE');

// 기능 열기 = 기존 homeAction 그대로 호출
assert.strictEqual(h.open('shop'), true);
const atOpen = h.view();
assert.ok(atOpen && typeof atOpen.x === 'number', '열 때 현재 시점 저장');
assert.deepStrictEqual(calls, ['shop']);
assert.strictEqual(h.state(), 'FEATURE');
assert.strictEqual(h.renderAllowed(), false, '기능 화면 중 렌더 정지');
// 닫기(showStartScreenNow) → 광장, 시점 유지
h.homeShown();
assert.strictEqual(h.state(), 'EXPLORE');
assert.strictEqual(h.renderAllowed(), true);
assert.deepStrictEqual(h.view(), atOpen);

// 기존 경로가 열기를 거절(false)하면 광장 상태로 되돌림
result = false;
assert.strictEqual(h.open('daily'), false);
assert.strictEqual(h.state(), 'EXPLORE');
result = undefined;

// 게임 시작 → GAMEPLAY, 게임 끝나 홈 복귀 → 처음 시작 구멍(INTRO)에서 다시(V1622 C 사용자)
h.open('lightMode');
h.gameStarted();
assert.strictEqual(h.state(), 'GAMEPLAY');
h.homeShown();
assert.strictEqual(h.state(), 'INTRO');

// 3) game.js 연결 지점(정적 확인)
const src = fs.readFileSync(path.join(__dirname, '../mole/js/game.js'), 'utf8');
assert.ok(/function homeAction\(action\)/.test(src), 'homeAction 함수');
assert.ok(/onHomeAction: homeAction/.test(src), 'onHomeAction 이 homeAction 사용');
assert.strictEqual((src.match(/home3d\.homeShown\(\)/g) || []).length, 2, 'homeShown 알림 2곳(홈 복귀·리듬팡 닫기)');
assert.strictEqual((src.match(/home3d\.gameStarted\(\)/g) || []).length, 1, 'gameStarted 알림 1곳');
assert.ok(!/Home3DLocal/.test(src), '초안 iframe 연결 제거');
// 하트 확인이 gameStarted 알림보다 먼저(하트 0 안내창 유지)
const bg = src.slice(src.indexOf('function beginGame('));
assert.ok(bg.indexOf('showNoHeartModal') < bg.indexOf('home3d.gameStarted()'), '하트 확인 뒤에 알림');

const html = fs.readFileSync(path.join(__dirname, '../mole/index.html'), 'utf8');
assert.ok(!/home-3d-local\.js/.test(html), 'index.html 초안 스크립트 제거');
for (const f of ['home3d-layout.js', 'home3d-state.js', 'home3d.js']) assert.ok(html.includes('js/' + f), 'index.html 에 ' + f);

console.log('verify-home3d-bridge: ok');
