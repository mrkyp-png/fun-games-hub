(function (root) {
  'use strict';

  // 무기(뿅망치/골드해머/캐논/알리펀치) 애니메이션 모듈은 전부 같은 인터페이스를 쓴다
  // (create(opts) → { strike, update, isBusy, home, clear, [meet], [demo], [spinIn], [popIn] }).
  // 동시에 여러 구멍이 눌리면(멀티터치) 그 모듈을 여러 개 생성해 각자 독립적으로 스윙시킨다.
  // 무기 모듈 내부(스윙 좌표·타이밍)는 건드리지 않고, 이 파일이 인스턴스 배열만 관리한다.

  const DEFAULT_MAX_CONCURRENT = 8; // 실기기 확인 — 화면에서 8개까지 동시터치 인식됨(사용자 지정)
  const DEFAULT_PRUNE_AFTER_MS = 1500;

  function create(WeaponMod, opts, poolOpts) {
    const maxConcurrent = (poolOpts && poolOpts.maxConcurrent) || DEFAULT_MAX_CONCURRENT;
    const pruneAfterMs = (poolOpts && poolOpts.pruneAfterMs != null) ? poolOpts.pruneAfterMs : DEFAULT_PRUNE_AFTER_MS;
    const now = (poolOpts && poolOpts.now) || Date.now;

    function makeEntry() {
      return { inst: WeaponMod.create(opts), lastStrikeAt: now() };
    }

    const entries = [makeEntry()]; // entries[0] = 기본 인스턴스, 절대 제거 안 함

    function findFree() {
      for (let i = 0; i < entries.length; i++) {
        if (!entries[i].inst.isBusy()) return entries[i];
      }
      return null;
    }

    function strike(targetXFrac, targetYFrac, onImpact, frameKey, regionId) {
      let entry = findFree();
      if (!entry) {
        if (entries.length < maxConcurrent) {
          entry = makeEntry();
          entries.push(entry);
        } else {
          entry = entries[0]; // 캡 초과 — 가장 오래된 인스턴스를 새 목표로 리다이렉트(기존 단일 인스턴스 동작과 동일)
        }
      }
      entry.lastStrikeAt = now();
      entry.inst.strike(targetXFrac, targetYFrac, onImpact, frameKey, regionId);
    }

    function update(dt) {
      entries.forEach((e) => e.inst.update(dt));
      const t = now();
      for (let i = entries.length - 1; i >= 1; i--) {
        const e = entries[i];
        if (!e.inst.isBusy() && (t - e.lastStrikeAt) > pruneAfterMs) {
          e.inst.clear();
          entries.splice(i, 1);
        }
      }
    }

    function isBusy() { return entries.some((e) => e.inst.isBusy()); }

    function home() {
      entries.forEach((e) => e.inst.home());
      for (let i = entries.length - 1; i >= 1; i--) {
        entries[i].inst.clear();
        entries.splice(i, 1);
      }
    }

    function clear() {
      entries.forEach((e) => e.inst.clear());
      entries.length = 0;
    }

    function delegateToPrimary(name) {
      return function () {
        const primary = entries[0] && entries[0].inst;
        if (primary && typeof primary[name] === 'function') return primary[name].apply(primary, arguments);
      };
    }

    const result = { strike, update, isBusy, home, clear };
    ['meet', 'demo', 'spinIn', 'popIn'].forEach((name) => {
      if (typeof entries[0].inst[name] === 'function') {
        result[name] = delegateToPrimary(name);
      }
    });
    return result;
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.WeaponPool = api; }
})(typeof window !== 'undefined' ? window : null);
