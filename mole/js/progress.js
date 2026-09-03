(function (root) {
  'use strict';
  // 챕터 진행/해금 (설계 2026-09-04).
  //  - 축: 챕터(콘텐츠 1~3) × 라이트(힌트 on/dim/off).
  //  - 라이트 3종은 처음부터 다 선택 가능. 챕터는 라이트별로 각각 순차 해금:
  //    (챕터N, 라이트L) 클리어 → (챕터N+1, 라이트L) 열림.
  //  - 클리어 = 그 판 누적점수 ≥ CLEAR_TARGET[챕터] (완벽 플레이의 90%).
  //  - 저장: localStorage 'mole.progress' = { "c<ch>-<light>": { cleared, best } }
  //  - 개발용: localStorage 'mole.unlockAll' === '1' → 전부 열림.

  var K = 'mole.progress';
  var LIGHTS = ['easy', 'mid', 'legend']; // = ON / DIM / OFF
  var MAX_CHAPTER = 3;

  // ⚠️ 임시 테스트값 (챕터 전환 흐름 테스트용 — 매번 10라운드 5분 + 목표 못 넘으면
  //    성공 연출도 못 봄). 출시 전 반드시 원복:
  //      실제 잠정값 = { 1: 130000, 2: 145000, 3: 160000 }
  //      (봇 천장 ≈ 170,000. 저글 축소 v60 · 헛방 콤보리셋 v61 이후 기준. 폰 테스트 후 확정)
  var CLEAR_TARGET = { 1: 1000, 2: 1000, 3: 1000 };

  function ls() { return (typeof localStorage !== 'undefined') ? localStorage : null; }
  function key(ch, light) { return 'c' + ch + '-' + light; }

  function all() {
    try { return JSON.parse(ls().getItem(K)) || {}; } catch (e) { return {}; }
  }
  function save(obj) { if (ls()) ls().setItem(K, JSON.stringify(obj)); }

  function get(ch, light) {
    var rec = all()[key(ch, light)];
    return { cleared: !!(rec && rec.cleared), best: (rec && rec.best) || 0 };
  }

  function unlockAll() { return ls() && ls().getItem('mole.unlockAll') === '1'; }

  function isUnlocked(ch, light) {
    if (ch < 1 || ch > MAX_CHAPTER) return false;
    if (unlockAll() || ch === 1) return true;
    return get(ch - 1, light).cleared;
  }

  // 그 라이트에서 열려 있는 가장 높은 챕터 (시작 버튼이 플레이할 챕터).
  function maxChapterFor(light) {
    var n = 1;
    while (n < MAX_CHAPTER && isUnlocked(n + 1, light)) n++;
    return n;
  }

  function target(ch) { return CLEAR_TARGET[ch] || CLEAR_TARGET[1]; }

  // 한 판 끝났을 때 호출. best 갱신 + 목표 달성 시 cleared. 반환: 이번 판 결과 요약.
  function record(ch, light, score) {
    var obj = all();
    var k = key(ch, light);
    var rec = obj[k] || { cleared: false, best: 0 };
    var wasCleared = rec.cleared;
    if (score > rec.best) rec.best = score;
    var passed = score >= target(ch);
    if (passed) rec.cleared = true;
    obj[k] = rec;
    save(obj);
    return {
      best: rec.best,
      target: target(ch),
      passed: passed,
      newClear: passed && !wasCleared,
      unlockedNext: passed && !wasCleared && ch < MAX_CHAPTER
    };
  }

  var api = {
    LIGHTS: LIGHTS, MAX_CHAPTER: MAX_CHAPTER, CLEAR_TARGET: CLEAR_TARGET,
    key: key, get: get, isUnlocked: isUnlocked, maxChapterFor: maxChapterFor,
    target: target, record: record
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Progress: api };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Progress = api; }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
