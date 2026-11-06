// 광장 게시판 칸 3개 내용 검사 (V1650 C). 실행: node review/verify-home3d-board.cjs
const assert = require('assert');
const B = require('../mole/js/home3d-board.js');

assert.deepStrictEqual(B.KINDS, ['score', 'daily', 'quest']);

// 기록 없음·받을 것 없음 → 빨간 점 없음
const none = B.panelData({ ScoreScreen: { myBest: () => null }, Daily: { claimable: () => false }, Quest: { claimable: () => 0 } }, true);
assert.strictEqual(none.score.line, '첫 기록에 도전!');
assert.strictEqual(none.daily.dot, false);
assert.strictEqual(none.quest.dot, false);

// 기록·오늘 선물·퀘스트 보상 2개 → 내용과 빨간 점
const some = B.panelData({ ScoreScreen: { myBest: () => ({ round: 3, score: 12500 }) }, Daily: { claimable: () => true }, Quest: { claimable: () => 2 } }, true);
assert.strictEqual(some.score.line, '3라운드 · 12,500점');
assert.strictEqual(some.daily.dot, true);
assert.strictEqual(some.quest.line, '보상 2개 받기');
assert.strictEqual(some.quest.dot, true);

// 기능 모듈이 없어도 깨지지 않음
const empty = B.panelData({}, false);
assert.strictEqual(empty.daily.dot, false);
assert.strictEqual(empty.score.title, 'Score');

console.log('verify-home3d-board: ok');
// 스코어 칸 = 두더지팡·리듬팡 비치·네온 여러 장, 장마다 1~5위 + 내 순위·점수(사용자)
{ const S = { myBest: () => ({ round: 2, score: 900 }), RankingSource: { top: (id) => id === 'mole_pang' ? [{ playerName: 'A', highestRound: 5, highestScore: 3000 }] : [] }, sortRanking: (l) => l.slice().sort((a, b) => b.highestRound - a.highestRound),
    rpMyBest: (type, id) => type === 'A' && id === 's2' ? { diff: 'N', grade: 'A', score: 7700 } : null, rpCmp: (a, b) => b.score - a.score };
  const d = B.panelData({ ScoreScreen: S, Rhythm: { rules: { config: { bSongs: [{ id: 's1' }, { id: 's2' }] } } } }, true);
  assert.strictEqual(d.score.pages.length, 3);
  const m = d.score.pages[0]; assert.strictEqual(m.title, '두더지팡'); assert.strictEqual(m.rows.length, 5); assert.strictEqual(m.rows[0].name, 'A'); assert.deepStrictEqual(m.mine, { rank: 2, score: '900' }); assert.strictEqual(m.rows[4].name, '—');
  const b = d.score.pages[1]; assert.strictEqual(b.title, '리듬팡 비치'); assert.deepStrictEqual(b.mine, { rank: 1, score: '7,700' });
  const nn = d.score.pages[2]; assert.strictEqual(nn.title, '리듬팡 네온'); assert.strictEqual(nn.mine, null); }
console.log('verify-home3d-board: pages ok');
