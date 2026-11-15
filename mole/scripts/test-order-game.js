// V1722 C: '순서대로 잡아라' 규칙 검사 (node mole/scripts/test-order-game.js)
const OG = require('../js/order-game.js');
let fails = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { fails++; console.log('실패:', msg); } }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const points = Array.from({ length: 16 }, (_, i) => ({ regionId: i, x: (i % 4 + 0.5) / 4, y: (Math.floor(i / 4) + 0.5) / 4 }));
const C = OG.CONFIG;

ok(C.roundSeconds === 90, '제한 시간 90초');
for (let round = 1; round <= 8; round++) {
  const rnd = rng(1000 + round);
  // 3·5·6: 제시어 수, 정답 존재
  for (let k = 0; k < 300; k++) {
    const g = OG.generate(round, 16, rnd);
    ok(g.clues.length === C.clues[round], round + 'R 제시어 수 ' + g.clues.length);
    ok(g.board.length === 16, '16마리');
    ok(OG.assign(g.clues, g.board).unmatched.length === 0, round + 'R 모든 제시어에 서로 다른 정답');
    ok(g.clues.every((c) => !(c.kind === 'neg') || round >= 6), round + 'R 부정 조건은 6라운드부터');
    ok(g.clues.every((c) => c.color || c.hair || c.beh), '긍정 조건 1개 이상');
    if (round === 1) ok(g.clues.every((c) => c.kind === 'single'), '1R 단일 특징');
  }
  // 실제 진행: 무작위로 정답·오답·착한 두더지를 섞어 치며 언제나 풀 수 있는지 확인
  const s = OG.create({ spawnPoints: points, round, random: rnd });
  s.deploy();
  ok(s.press(0).kind === 'ignored', '올라오는 중 입력 무시');
  let lastMissions = 0, lastScore = 0;
  for (let step = 0; step < 4000 && s.lives() > 0; step++) {
    s.tick(0.05);
    const pops = s.getActivePops(), m = s.mission();
    ok(pops.length <= 16, '두더지 16마리 이하');
    if (!s.inputOpen()) { const before = s.stats.score; ok(s.press(Math.floor(rnd() * 16)).kind === 'ignored' && s.stats.score === before, '재배치 중 입력 무시'); continue; }
    const cur = m.clues[m.progress];
    const ready = pops.filter((p) => !p.dying && p.hitAt < 0);
    if (step % 7 !== 0) continue; // 사람처럼 띄엄띄엄
    const roll = rnd(); let target;
    if (roll < 0.75) target = ready.find((p) => OG.matches(p.traits, cur));
    else if (roll < 0.9) target = ready.find((p) => !p.traits.good && !OG.matches(p.traits, cur));
    else if (roll < 0.93) target = ready.find((p) => p.traits.good);
    if (!target) continue;
    const livesBefore = s.lives(), progBefore = m.progress, r = s.press(target.regionId);
    if (r.kind === 'ignored') continue; // 아직 자리 잡는 중
    if (roll < 0.75) { ok(r.kind === 'correct', '정답 판정'); ok(r.missionDone ? s.mission().progress === m.clues.length : s.mission().progress === progBefore + 1, '다음 제시어로'); }
    else if (roll < 0.9) { ok(r.kind === 'wrong' && s.mission().progress === 0, '오답 = 진행도 0'); ok(s.lives() === livesBefore, '오답은 하트 유지'); }
    else { ok(r.kind === 'good' && s.lives() === livesBefore - 1 && s.mission().progress === progBefore, '착한 두더지 = 하트-1·진행도 유지'); }
    ok(s.press(target.regionId).kind === 'ignored', '같은 타격 중복 판정 없음');
    if (rnd() < 0.8) s.impact(r.popId); // 가끔 망치 신호가 안 와도(시간 초과) 진행되는지
    if (r.kind === 'wrong') { // V1723 C: 오답 뒤 0.25초 안에 남은 제시어 정답이 모두 화면에 있음(올라오는 중 포함)
      s.impact(r.popId); for (let w = 0; w < 5; w++) s.tick(0.05);
      const mm = s.mission(), nowTraits = s.getActivePops().filter((p) => !p.dying && p.hitAt < 0).map((p) => p.traits);
      ok(OG.assign(mm.clues.slice(mm.progress), nowTraits).unmatched.length === 0, round + 'R 오답 뒤 정답 바로 보충');
    }
    if (r.missionDone) { ok(s.stats.missions === lastMissions + 1, '미션 성공 1번만'); ok(s.stats.score - lastScore >= r.bonus, '보너스 지급'); lastMissions = s.stats.missions; }
    lastScore = s.stats.score;
    // 교체가 끝날 때까지 돌린 뒤 남은 제시어가 전부 풀리는지
    for (let w = 0; w < 40; w++) s.tick(0.05);
    if (s.inputOpen()) {
      const mm = s.mission(), liveTraits = s.getActivePops().filter((p) => !p.dying && p.hitAt < 0).map((p) => p.traits);
      ok(OG.assign(mm.clues.slice(mm.progress), liveTraits).unmatched.length === 0, round + 'R 남은 제시어 해결 가능(진행 ' + mm.progress + ')');
      ok(s.getActivePops().length === 16, round + 'R 교체 뒤 16마리');
    }
  }
  ok(s.stats.missions > 0, round + 'R 미션 성공 있음');
}
// 하트 3개: 착한 두더지 3번이면 0
{
  const s = OG.create({ spawnPoints: points, round: 1, random: rng(7) }); s.deploy();
  let guard = 0;
  while (s.lives() > 0 && guard++ < 5000) { s.tick(0.05); const g = s.getActivePops().find((p) => p.traits.good && !p.dying && p.hitAt < 0); if (g && s.inputOpen()) { const r = s.press(g.regionId); if (r.kind === 'good') s.impact(r.popId); } }
  ok(s.lives() === 0 && s.stats.goodHits === 3, '착한 두더지 3번 = 하트 0');
  ok(s.press(0).kind === 'ignored', '하트 0 뒤 입력 무시');
}
// 해금·최고 점수 저장
{
  const mem = {}; global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  ok(OG.load().unlocked === 1, '처음엔 1라운드만');
  let r = OG.record(1, C.target[1] - 1); ok(!r.passed && !r.unlockedNext && OG.load().unlocked === 1, '목표 미달 = 해금 없음');
  r = OG.record(1, C.target[1]); ok(r.passed && r.unlockedNext && OG.load().unlocked === 2, '목표 달성 = 2라운드 해금');
  r = OG.record(1, 100); ok(r.best === C.target[1] && !r.newBest, '최고 점수 유지');
  for (let n = 2; n <= 8; n++) OG.record(n, C.target[n]);
  ok(OG.load().unlocked === 8, '8라운드가 마지막');
}
console.log(fails ? '실패 ' + fails + ' / ' + checks : '모두 통과 ' + checks + '개');
process.exitCode = fails ? 1 : 0;
