(function (root) {
  'use strict';
  var HEART_MAX = 5;
  var REGEN_MS = 20 * 60 * 1000;
  var K = { hearts: 'mole.hearts', heartsAt: 'mole.heartsAt', coins: 'mole.coins' };

  // 순수: 저장된 하트/타임스탬프 + 현재시각 → 충전 반영한 새 상태.
  function regen(stored, at, now, opts) {
    var max = (opts && opts.max) || HEART_MAX;
    var step = (opts && opts.regenMs) || REGEN_MS;
    stored = Math.max(0, Math.min(max, stored | 0));
    at = at | 0;
    if (stored >= max) return { hearts: max, at: now };
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
  function spendHeart() {
    var r = _syncHearts();
    if (r.hearts <= 0) return false;
    var now = Date.now();
    // 만땅에서 처음 소비하면 그때부터 충전 타이머 시작.
    var at = r.hearts >= HEART_MAX ? now : readInt(K.heartsAt, now);
    if (ls()) { ls().setItem(K.hearts, String(r.hearts - 1)); ls().setItem(K.heartsAt, String(at)); }
    return true;
  }
  function addHearts(n) {
    var r = _syncHearts();
    var hearts = Math.min(HEART_MAX, r.hearts + (n | 0));
    if (ls()) ls().setItem(K.hearts, String(hearts));
    return hearts;
  }
  function nextHeartMs() {
    var now = Date.now();
    var stored = readInt(K.hearts, HEART_MAX);
    if (stored >= HEART_MAX) return 0;
    var at = readInt(K.heartsAt, now);
    var into = (now - at) % REGEN_MS;
    return Math.max(0, REGEN_MS - into);
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
    HEART_MAX: HEART_MAX, REGEN_MS: REGEN_MS,
    regen: regen, getHearts: getHearts, canPlay: canPlay, spendHeart: spendHeart,
    addHearts: addHearts, nextHeartMs: nextHeartMs,
    getCoins: getCoins, addCoins: addCoins, spendCoins: spendCoins
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Economy: api };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Economy = api; }
})(typeof window !== 'undefined' ? window : null);
