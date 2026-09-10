(function (root) {
  'use strict';
  var HEART_MAX = 3;                    // 무료 충전 상한 (콤보/광고로는 초과 가능)
  var REGEN_MS = 4 * 60 * 60 * 1000;    // 생명 2개 이하일 때 4시간마다 +1, 3개 도달 시 리셋
  // 챕터 입장권: 챕터 입장 1회 = 1장 차감. 2시간마다 +1, 상한까지 자동 충전.
  var TICKET_MAX = 10000;               // ⚠️ 개발용 값 — 출시 목표 = 10 (하루 정액)
  var TICKET_REGEN_MS = 2 * 60 * 60 * 1000;
  // 생명은 허브 공유 — 어떤 게임이든 이 생명으로 플레이한다.
  var K = { hearts: 'fgh.lives', heartsAt: 'fgh.livesAt', coins: 'mole.coins',
            tickets: 'mole.tickets', ticketsAt: 'mole.ticketsAt' };

  // 순수: 저장된 하트/타임스탬프 + 현재시각 → 충전 반영한 새 상태.
  function regen(stored, at, now, opts) {
    var max = (opts && opts.max) || HEART_MAX;
    var step = (opts && opts.regenMs) || REGEN_MS;
    stored = Math.max(0, stored | 0); // 상한 클램프 안 함 — 콤보/광고로 max 초과 보유 가능
    at = +at || 0; // ⚠️ `at | 0` 쓰면 안 됨 — 13자리 타임스탬프가 32비트로 잘림
    if (stored >= max) return { hearts: stored, at: now }; // max 이상이면 충전 안 함(타이머 정지)
    var elapsed = Math.max(0, now - at);
    var gained = Math.floor(elapsed / step);
    if (gained <= 0) return { hearts: stored, at: at };
    var hearts = Math.min(max, stored + gained);
    var newAt = hearts >= max ? now : at + gained * step;
    return { hearts: hearts, at: newAt };
  }

  function ls() { return (typeof localStorage !== 'undefined') ? localStorage : null; }
  function readInt(key, dflt) {
    var s = ls() && ls().getItem(key);
    var v = parseInt(s, 10);
    return Number.isFinite(v) ? v : dflt;
  }

  function _syncHearts() {
    var now = Date.now();
    var stored = readInt(K.hearts, HEART_MAX);
    var at = readInt(K.heartsAt, now);
    var r = regen(stored, at, now);
    if (ls()) { ls().setItem(K.hearts, String(r.hearts)); ls().setItem(K.heartsAt, String(r.at)); }
    return r;
  }
  function getHearts() { return _syncHearts().hearts; }
  function canPlay() { return getHearts() > 0; }

  // 생명을 특정 값으로 설정 — 게임이 목숨을 직접 깎거나(동물 -1) 콤보 보너스(+1)를 반영할 때.
  // 상한 없음(콤보/광고로 3 초과 가능). 3 미만으로 내려오면 그 시점부터 4시간 타이머 시작.
  function setHearts(n) {
    n = Math.max(0, n | 0);
    var now = Date.now();
    var prev = getHearts(); // regen 반영된 현재값
    var at = (n >= HEART_MAX || prev >= HEART_MAX) ? now : readInt(K.heartsAt, now);
    if (ls()) { ls().setItem(K.hearts, String(n)); ls().setItem(K.heartsAt, String(at)); }
    return n;
  }
  function spendHeart() {
    var cur = getHearts();
    if (cur <= 0) return false;
    setHearts(cur - 1);
    return true;
  }
  function addHearts(n) { return setHearts(getHearts() + (n | 0)); }
  function nextHeartMs() {
    var now = Date.now();
    var stored = readInt(K.hearts, HEART_MAX);
    if (stored >= HEART_MAX) return 0;
    var at = readInt(K.heartsAt, now);
    var into = (now - at) % REGEN_MS;
    return Math.max(0, REGEN_MS - into);
  }

  // 챕터 입장권 — 하트와 같은 리젠 로직(regen 재사용, 2시간 스텝, 상한 TICKET_MAX).
  function _syncTickets() {
    var now = Date.now();
    var stored = readInt(K.tickets, TICKET_MAX);          // 첫 실행 = 풀
    var at = readInt(K.ticketsAt, now);
    var r = regen(stored, at, now, { max: TICKET_MAX, regenMs: TICKET_REGEN_MS });
    if (ls()) { ls().setItem(K.tickets, String(r.hearts)); ls().setItem(K.ticketsAt, String(r.at)); }
    return r.hearts;
  }
  function getTickets() { return _syncTickets(); }
  function spendTicket() {
    var cur = _syncTickets();
    if (cur <= 0) return false;
    var now = Date.now();
    var at = (cur >= TICKET_MAX) ? now : readInt(K.ticketsAt, now); // 풀에서 처음 쓰면 그때부터 타이머
    if (ls()) { ls().setItem(K.tickets, String(cur - 1)); ls().setItem(K.ticketsAt, String(at)); }
    return true;
  }
  function addTickets(n) {
    var v = Math.min(TICKET_MAX, _syncTickets() + Math.max(0, n | 0));
    var at = (v >= TICKET_MAX) ? Date.now() : readInt(K.ticketsAt, Date.now());
    if (ls()) { ls().setItem(K.tickets, String(v)); ls().setItem(K.ticketsAt, String(at)); }
    return v;
  }
  function nextTicketMs() {
    var stored = readInt(K.tickets, TICKET_MAX);
    if (stored >= TICKET_MAX) return 0;
    var at = readInt(K.ticketsAt, Date.now());
    var into = (Date.now() - at) % TICKET_REGEN_MS;
    return Math.max(0, TICKET_REGEN_MS - into);
  }

  function getCoins() { return Math.max(0, readInt(K.coins, 0)); }
  function addCoins(n) {
    var v = getCoins() + Math.max(0, n | 0);
    if (ls()) ls().setItem(K.coins, String(v));
    return v;
  }
  function spendCoins(n) {
    n = Math.max(0, n | 0);
    var v = getCoins();
    if (v < n) return false;
    if (ls()) ls().setItem(K.coins, String(v - n));
    return true;
  }

  var api = {
    HEART_MAX: HEART_MAX, REGEN_MS: REGEN_MS, TICKET_MAX: TICKET_MAX, TICKET_REGEN_MS: TICKET_REGEN_MS,
    regen: regen, getHearts: getHearts, canPlay: canPlay, spendHeart: spendHeart,
    setHearts: setHearts, addHearts: addHearts, nextHeartMs: nextHeartMs,
    getTickets: getTickets, spendTicket: spendTicket, addTickets: addTickets, nextTicketMs: nextTicketMs,
    getCoins: getCoins, addCoins: addCoins, spendCoins: spendCoins
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Economy: api };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Economy = api; }
})(typeof window !== 'undefined' ? window : null);
