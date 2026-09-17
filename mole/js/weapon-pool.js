(function (root) {
  'use strict';

  // 무기(뿅망치/골드해머/캐논/알리펀치) 애니메이션 모듈은 전부 같은 인터페이스를 쓴다
  // (create(opts) → { strike, update, isBusy, home, clear, [meet], [demo], [spinIn], [popIn] }).
  // 동시에 여러 구멍이 눌리면(멀티터치), 아주 짧은 시간창(같은 이벤트 루프 틱) 안에 들어온
  // 타격 요청들을 모아 랜덤 순서로 섞은 뒤 그중 하나만 실제 무기가 맡고, 나머지는
  // onOverflow(분신 연출 — game.js 가 무기별로 구현)로 넘긴다. 매번 랜덤이라 "몇 번째로
  // 눌렀는지"가 항상 같은 손가락에 유리해지지 않는다(사용자 지정).

  function create(WeaponMod, opts, poolOpts) {
    const onOverflow = (poolOpts && poolOpts.onOverflow) || function () {};
    const schedule = (poolOpts && poolOpts.schedule) || function (fn) { Promise.resolve().then(fn); };
    const rng = (poolOpts && poolOpts.rng) || Math.random;

    const inst = WeaponMod.create(opts);
    let pending = null; // 이번 배치(한 틱) 동안 모인 요청들

    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function flush() {
      const items = shuffle(pending);
      pending = null;
      items.forEach((item) => {
        if (!inst.isBusy()) {
          inst.strike(item.targetXFrac, item.targetYFrac, item.onImpact, item.frameKey, item.regionId);
        } else {
          onOverflow(item.targetXFrac, item.targetYFrac, item.onImpact, item.frameKey, item.regionId);
        }
      });
    }

    function strike(targetXFrac, targetYFrac, onImpact, frameKey, regionId) {
      if (!pending) {
        pending = [];
        schedule(flush);
      }
      pending.push({ targetXFrac, targetYFrac, onImpact, frameKey, regionId });
    }

    function update(dt) { inst.update(dt); }
    function isBusy() { return inst.isBusy(); }
    function home() { inst.home(); }
    function clear() { inst.clear(); }

    function delegateToPrimary(name) {
      return function () { return inst[name].apply(inst, arguments); };
    }

    const result = { strike, update, isBusy, home, clear };
    ['meet', 'demo', 'spinIn', 'popIn'].forEach((name) => {
      if (typeof inst[name] === 'function') result[name] = delegateToPrimary(name);
    });
    return result;
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.WeaponPool = api; }
})(typeof window !== 'undefined' ? window : null);
