(function (root) {
  'use strict';

  // V1722 C: '순서대로 잡아라' — 규칙·제시어 생성·판정·점수·하트·재배치·해금 저장(화면과 무관한 순수 로직).
  // 게임판 16구멍에 두더지 16마리가 서 있고, 제시어 순서대로 버튼으로 잡는다. 화면 연결은 game.js.
  const COLORS = ['red', 'blue', 'yellow', 'green', 'purple'];
  const HAIRS = ['bald', 'mohawk', 'curly', 'spiky', 'forelock'];
  const BEHAVIORS = ['smoke', 'drink', 'phone', 'thief'];
  // 설정 표(밸런스 조정은 여기서)
  const CONFIG = {
    roundSeconds: 90,
    hearts: 3,                    // 착한 두더지 오타격 3회 = 종료(하트와 실수 횟수는 한 값)
    goodCount: 3,                 // 16마리 중 착한(일반) 두더지 수
    clues: [0, 3, 4, 5, 6, 7, 8, 9, 10], // 라운드별 미션당 제시어 수
    // 라운드별 제시어 종류 비율 [단일, 2개 조합, 3개 조합, 부정]
    mix: { 1: [1, 0, 0, 0], 2: [0.8, 0.2, 0, 0], 3: [0.5, 0.5, 0, 0], 4: [0.2, 0.8, 0, 0], 5: [0, 0.6, 0.4, 0], 6: [0, 0.4, 0.3, 0.3], 7: [0, 0.2, 0.4, 0.4], 8: [0.2, 0.25, 0.25, 0.3] },
    score: { single: 100, combo: 150, neg: 200, missionPerClue: 100 },
    target: [0, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500], // 라운드별 해금 목표 점수
    sinkSeconds: 0.6,             // 내려가는 시간
    riseSeconds: 0.45,            // 올라와 자리 잡는 시간(이 뒤부터 입력 받음)
    impactTimeout: 0.5,           // 망치 도착 신호가 안 오면 강제로 맞은 것으로
    maxGenerateTries: 20
  };
  const MAX_ROUND = 8;
  const STORE_KEY = 'mole.order.v1';

  const pick = (arr, rnd) => arr[Math.min(arr.length - 1, Math.floor(rnd() * arr.length))];
  const pickExcept = (arr, not, rnd) => pick(arr.filter((v) => v !== not), rnd);

  function matches(m, c) {
    if (!m || m.good) return false; // 착한 두더지는 어떤 제시어에도 정답이 아님
    if (c.color && m.color !== c.color) return false;
    if (c.hair && m.hair !== c.hair) return false;
    if (c.beh && m.beh !== c.beh) return false;
    if (c.notColor && m.color === c.notColor) return false;
    if (c.notHair && m.hair === c.notHair) return false;
    return true;
  }
  function clueKey(c) { return [c.color, c.hair, c.beh, c.notColor, c.notHair].map((v) => v || '').join('|'); }
  function clueKind(c) { if (c.notColor || c.notHair) return 'neg'; return [c.color, c.hair, c.beh].filter(Boolean).length > 1 ? 'combo' : 'single'; }

  function makeClue(round, rnd) {
    const w = CONFIG.mix[round] || CONFIG.mix[1]; let r = rnd() * (w[0] + w[1] + w[2] + w[3]), type = 0;
    for (let i = 0; i < 4; i++) { if (r < w[i]) { type = i; break; } r -= w[i]; type = i; }
    const c = {};
    const put = (attr) => { if (attr === 'color') c.color = pick(COLORS, rnd); else if (attr === 'hair') c.hair = pick(HAIRS, rnd); else c.beh = pick(BEHAVIORS, rnd); };
    const attrs = ['color', 'hair', 'beh'];
    if (type === 0) put(pick(attrs, rnd));
    else if (type === 1) { const skip = pick(attrs, rnd); attrs.filter((a) => a !== skip).forEach(put); }
    else if (type === 2) attrs.forEach(put);
    else { // 부정: '빨강 아닌 도둑' / '파마 아닌 술' / '파랑 아닌 모히칸 도둑'
      if (rnd() < 0.5) { c.notColor = pick(COLORS, rnd); c.beh = pick(BEHAVIORS, rnd); if (round >= 7 && rnd() < 0.5) c.hair = pick(HAIRS, rnd); }
      else { c.notHair = pick(HAIRS, rnd); c.beh = pick(BEHAVIORS, rnd); if (round >= 7 && rnd() < 0.5) c.color = pick(COLORS, rnd); }
    }
    c.kind = clueKind(c); c.points = CONFIG.score[c.kind];
    return c;
  }
  function makeMission(round, rnd) {
    const n = CONFIG.clues[round] || 3, clues = [];
    for (let i = 0; i < n; i++) { let c = makeClue(round, rnd), tries = 0; while (i && clueKey(c) === clueKey(clues[i - 1]) && tries++ < 8) c = makeClue(round, rnd); clues.push(c); }
    return clues;
  }
  // 무한 재시도 방지용 안전한 대체 미션: 행동 하나짜리 제시어만
  function fallbackMission(round) { const n = CONFIG.clues[round] || 3; return Array.from({ length: n }, (_, i) => { const c = { beh: BEHAVIORS[i % BEHAVIORS.length] }; c.kind = 'single'; c.points = CONFIG.score.single; return c; }); }

  function answerFor(c, rnd) { // 그 제시어에 맞는 나쁜 두더지 한 마리
    return { good: false, color: c.color || (c.notColor ? pickExcept(COLORS, c.notColor, rnd) : pick(COLORS, rnd)), hair: c.hair || (c.notHair ? pickExcept(HAIRS, c.notHair, rnd) : pick(HAIRS, rnd)), beh: c.beh || pick(BEHAVIORS, rnd) };
  }
  function randomBad(rnd) { return { good: false, color: pick(COLORS, rnd), hair: pick(HAIRS, rnd), beh: pick(BEHAVIORS, rnd) }; }
  function randomGood(rnd) { return { good: true, color: null, hair: pick(HAIRS, rnd), beh: null }; }

  // 제시어(clues) 각각에 서로 다른 두더지(moles)를 짝지음. 반환 = 짝 못 찾은 제시어 번호들 + 쓰인 두더지 번호들
  function assign(clues, moles) {
    const owner = new Array(moles.length).fill(-1);
    function tryClue(ci, seen) {
      for (let mi = 0; mi < moles.length; mi++) {
        if (seen[mi] || !matches(moles[mi], clues[ci])) continue; seen[mi] = true;
        if (owner[mi] < 0 || tryClue(owner[mi], seen)) { owner[mi] = ci; return true; }
      }
      return false;
    }
    const unmatched = [];
    clues.forEach((_, ci) => { if (!tryClue(ci, new Array(moles.length).fill(false))) unmatched.push(ci); });
    return { unmatched, used: owner.map((o) => o >= 0) };
  }

  // 16마리 배치: 제시어마다 정답 1마리 + 착한 두더지 + 나머지 무작위, 자리는 섞음
  function makeBoard(clues, count, rnd) {
    const list = clues.map((c) => answerFor(c, rnd));
    for (let i = 0; i < CONFIG.goodCount && list.length < count; i++) list.push(randomGood(rnd));
    while (list.length < count) list.push(randomBad(rnd));
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t; }
    return list;
  }
  function generate(round, count, rnd) {
    for (let k = 0; k < CONFIG.maxGenerateTries; k++) {
      const clues = makeMission(round, rnd), board = makeBoard(clues, count, rnd);
      if (!assign(clues, board).unmatched.length) return { clues, board };
    }
    const clues = fallbackMission(round); return { clues, board: makeBoard(clues, count, rnd) };
  }

  function create(opts) {
    const round = Math.max(1, Math.min(MAX_ROUND, opts.round | 0)), rnd = opts.random || Math.random;
    const points = opts.spawnPoints.slice().sort((a, b) => a.regionId - b.regionId);
    const holes = points.map((p) => ({ p, pop: null, next: null, respawnAt: -1 })); // next = 다음에 올라올 두더지 특징(없으면 그때 정함)
    const stats = { score: 0, missions: 0, hits: 0, wrong: 0, goodHits: 0 };
    let time = 0, nextId = 1, lives = CONFIG.hearts, clues = [], progress = 0, phase = 'idle', phaseAt = 0, pending = null;

    function popFor(hole, traits) {
      const hair = traits.hair === 'bald' ? 'mohawk' : traits.hair;
      return { id: nextId++, type: 'mole', x: hole.p.x, y: hole.p.y, regionId: hole.p.regionId, poseIndex: 0, remaining: 99, hitsRequired: 1, hitsTaken: 0,
        dying: false, killed: false, good: traits.good, behavior: traits.beh, tint: traits.good ? null : COLORS.indexOf(traits.color), appearance: hair, bald: traits.hair === 'bald',
        traits, readyAt: time + CONFIG.riseSeconds, hitAt: -1, goneAt: -1 };
    }
    const live = (h) => h.pop && !h.pop.dying && h.pop.hitAt < 0;
    function deployAll() {
      const g = generate(round, holes.length, rnd);
      clues = g.clues; progress = 0;
      holes.forEach((h, i) => { h.next = null; h.respawnAt = -1; h.pop = popFor(h, g.board[i]); });
      phase = 'rising'; phaseAt = time;
    }
    // 남은 제시어가 전부 풀리게 유지: 모자라면 비어 있는(곧 올라올) 구멍에 정답을 넣고, 그래도 모자라면 정답 아닌 나쁜 두더지를 최소로 교체
    function repair() {
      const rest = clues.slice(progress), slots = holes.filter((h) => live(h) || h.next);
      const res = assign(rest, slots.map((h) => (live(h) ? h.pop.traits : h.next)));
      if (!res.unmatched.length) return;
      const used = new Set(slots.filter((_, i) => res.used[i]));
      res.unmatched.forEach((ci) => {
        let h = holes.find((x) => !live(x) && !x.next && (!x.pop || x.pop.dying || x.pop.hitAt >= 0) && !x.keepGood);
        if (!h) { h = holes.find((x) => live(x) && !x.pop.traits.good && !used.has(x)); if (!h) return; h.pop.dying = true; h.pop.goneAt = time + CONFIG.sinkSeconds; h.respawnAt = h.pop.goneAt; }
        h.next = answerFor(rest[ci], rnd); used.add(h);
      });
    }
    function kill(pop) { pop.dying = true; pop.goneAt = time + CONFIG.sinkSeconds; const h = holes.find((x) => x.pop === pop); if (h) h.respawnAt = pop.goneAt; }
    function impact(popId) {
      const h = holes.find((x) => x.pop && x.pop.id === popId); if (!h || h.pop.dying || h.pop.hitAt < 0) return;
      kill(h.pop);
      if (pending && pending.popId === popId) { // 미션의 마지막 정답이 맞은 순간: 나머지도 함께 내려감
        pending = null; phase = 'sinking'; phaseAt = time;
        holes.forEach((x) => { if (x.pop && !x.pop.dying) { x.pop.dying = true; x.pop.goneAt = time + CONFIG.sinkSeconds; } x.respawnAt = -1; x.next = null; });
      }
    }
    // 버튼 입력 1번 = 판정 1번. 반환 kind: ignored(무시) / correct / wrong(진행도 0) / good(하트-1)
    function press(regionId) {
      const h = holes.find((x) => x.p.regionId === regionId);
      if (!h || phase !== 'play' || lives <= 0 || !live(h) || time < h.pop.readyAt) return { kind: 'ignored' };
      const pop = h.pop, out = { popId: pop.id, x: pop.x, y: pop.y, regionId };
      pop.hitAt = time; pop.killed = true; pop.hitsTaken = 1; h.keepGood = !!pop.traits.good; // 맞은 표정은 망치 닿는 때에 맞춰 pop-elements 가 처리, 내려가기는 impact() 부터
      if (pop.traits.good) { lives -= 1; stats.goodHits += 1; out.kind = 'good'; out.lives = lives; return out; } // 진행도 유지
      if (matches(pop.traits, clues[progress])) {
        const c = clues[progress]; progress += 1; stats.hits += 1; stats.score += c.points; out.kind = 'correct'; out.points = c.points;
        if (progress >= clues.length) { // 미션 성공: 보너스 1번만, 이후 재배치 끝날 때까지 입력 무시
          out.missionDone = true; out.bonus = clues.length * CONFIG.score.missionPerClue; stats.score += out.bonus; stats.missions += 1; phase = 'clearing'; pending = { popId: pop.id };
        } else repair();
        return out;
      }
      progress = 0; stats.wrong += 1; out.kind = 'wrong'; repair();
      return out;
    }
    function tick(dt) {
      time += dt;
      holes.forEach((h) => { if (h.pop && h.pop.hitAt >= 0 && !h.pop.dying && time - h.pop.hitAt > CONFIG.impactTimeout) impact(h.pop.id); });
      if (phase === 'rising' && time - phaseAt >= CONFIG.riseSeconds) phase = 'play';
      if (phase === 'sinking') { if (time - phaseAt >= CONFIG.sinkSeconds) deployAll(); return; }
      holes.forEach((h) => {
        if (h.pop && h.pop.dying && time >= h.pop.goneAt) h.pop = null;
        if (!h.pop && h.respawnAt >= 0 && time >= h.respawnAt) {
          const traits = h.next || (h.keepGood ? randomGood(rnd) : randomBad(rnd));
          h.next = null; h.respawnAt = -1; h.keepGood = false; h.pop = popFor(h, traits);
        }
      });
    }
    return {
      round, tick, press, impact, deploy: deployAll,
      getActivePops: () => holes.filter((h) => h.pop).map((h) => h.pop),
      mission: () => ({ clues, progress }),
      inputOpen: () => phase === 'play',
      phase: () => phase,
      lives: () => lives,
      stats
    };
  }

  // 라운드별 최고 점수·해금 저장
  function load() { try { const v = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); return { unlocked: Math.max(1, Math.min(MAX_ROUND, v.unlocked | 0 || 1)), best: v.best || {} }; } catch (e) { return { unlocked: 1, best: {} }; } }
  function record(round, score) {
    const s = load(), old = s.best[round] | 0, target = CONFIG.target[round], passed = score >= target;
    const out = { best: Math.max(old, score), newBest: score > old, target, passed, unlockedNext: false };
    s.best[round] = out.best;
    if (passed && round < MAX_ROUND && s.unlocked < round + 1) { s.unlocked = round + 1; out.unlockedNext = true; }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* 저장 불가 환경 무시 */ }
    return out;
  }

  const LABEL = {
    ko: { red: '빨강', blue: '파랑', yellow: '노랑', green: '초록', purple: '보라', bald: '대머리', mohawk: '모히칸', curly: '파마', spiky: '가시', forelock: '한가닥', smoke: '담배', drink: '술', phone: '게임', thief: '도둑', not: ' 아닌' },
    en: { red: 'Red', blue: 'Blue', yellow: 'Yellow', green: 'Green', purple: 'Purple', bald: 'Bald', mohawk: 'Mohawk', curly: 'Curly', spiky: 'Spiky', forelock: 'One hair', smoke: 'Smoker', drink: 'Drinker', phone: 'Gamer', thief: 'Thief', not: '' }
  };
  function clueLabel(c, lang) {
    const L = LABEL[lang === 'ko' ? 'ko' : 'en'], ko = lang === 'ko', parts = [];
    if (c.notColor) parts.push(ko ? L[c.notColor] + L.not : 'Not ' + L[c.notColor].toLowerCase());
    if (c.notHair) parts.push(ko ? L[c.notHair] + L.not : 'Not ' + L[c.notHair].toLowerCase());
    if (c.color) parts.push(L[c.color]);
    if (c.hair) parts.push(L[c.hair]);
    if (c.beh) parts.push(L[c.beh]);
    return parts.join(' ');
  }

  const api = { CONFIG, COLORS, HAIRS, BEHAVIORS, MAX_ROUND, create, matches, makeMission, generate, assign, load, record, clueLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.OrderGame = api; }
})(typeof window !== 'undefined' ? window : null);
