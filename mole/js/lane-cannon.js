(function (root) {
  'use strict';

  // 무기 스킨: 대포. lane-hammer.js 와 같은 인터페이스
  // (create({layer}) → { strike, update, isBusy, home, clear }).
  //
  // 본체(cannon.png) = 항상 같은 스프라이트·크기. 우하단 모서리 고정(화면 밖으로 나가도 됨).
  // 발사 = 본체 반동 + 포구 화염/연기(CSS 애니, 프레임레이트 독립) + 포탄이 그 구멍으로
  // (CSS transition). 명중감은 game.js HitFx (impactCb = 포탄 도착 시).

  const REST_X = 0.90, REST_Y = 1.00;      // 캐리지 바닥 가운데 앵커 (보드 분수)
  const CANNON_W = 0.17;                    // 본체 폭 (절반 크기)
  const MUZZLE_DX = -0.075, MUZZLE_DY = -0.135; // 앵커 대비 포구 위치
  const BARREL_DEG = -35;
  const RECOIL = [0.010, 0.022, 0.040];
  const KICK_SEC = 0.06, SETTLE_SEC = 0.30;
  const BALL_MS = 95;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(k) { return k * k; }
  function easeOut(k) { return 1 - (1 - k) * (1 - k); }

  function create({ layer }) {
    const el = document.createElement('div');
    el.className = 'lane-cannon';
    el.innerHTML =
      '<img class="lc-smoke" alt="" src="assets/weapons/cannon-smoke.png">' +
      '<img class="lc-flash" alt="" src="assets/weapons/cannon-flash.png">' +
      '<img class="lc-ball" alt="" src="assets/weapons/cannon-ball.png">' +
      '<img class="lc-body" alt="" src="assets/weapons/cannon.png">';
    layer.appendChild(el);
    const body = el.querySelector('.lc-body');
    const flash = el.querySelector('.lc-flash');
    const smoke = el.querySelector('.lc-smoke');
    const ball = el.querySelector('.lc-ball');

    body.style.width = (CANNON_W * 100).toFixed(2) + '%';
    const MX = REST_X + MUZZLE_DX, MY = REST_Y + MUZZLE_DY;
    [flash, smoke].forEach((im) => {
      im.style.left = (MX * 100).toFixed(2) + '%';
      im.style.top = (MY * 100).toFixed(2) + '%';
    });

    let phase = 'home', t = 0, recoilAmt = 0;
    let timers = [];
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function after(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function strike(targetXFrac, targetYFrac, onImpact) {
      const tx = (typeof targetXFrac === 'number') ? targetXFrac : 0.5;
      const ty = (typeof targetYFrac === 'number') ? targetYFrac : 0.35;
      recoilAmt = RECOIL[Math.floor(Math.random() * RECOIL.length)];
      phase = 'kick'; t = 0;
      placeBody(recoilAmt);
      clearTimers();

      // 화염 (CSS 애니 재시작)
      flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on');
      after(90, () => { smoke.classList.remove('is-on'); void smoke.offsetWidth; smoke.classList.add('is-on'); });

      // 포탄: 포구 → 목표 (CSS transition). 각 구멍 각도대로.
      ball.style.transition = 'none';
      ball.style.left = (MX * 100).toFixed(2) + '%';
      ball.style.top = (MY * 100).toFixed(2) + '%';
      ball.style.opacity = '1';
      ball.style.transform = 'translate(-50%,-50%) scale(1)';
      void ball.offsetWidth;
      ball.style.transition = 'left ' + BALL_MS + 'ms linear, top ' + BALL_MS + 'ms linear, transform ' + BALL_MS + 'ms linear';
      ball.style.left = (tx * 100).toFixed(2) + '%';
      ball.style.top = (ty * 100).toFixed(2) + '%';
      ball.style.transform = 'translate(-50%,-50%) scale(0.7)';
      after(BALL_MS, () => {
        ball.style.opacity = '0';
        if (onImpact) onImpact();
      });
    }

    function update(dt) {
      if (phase === 'kick') {
        t += dt;
        placeBody(recoilAmt * ease(clamp01(t / KICK_SEC)));
        if (t >= KICK_SEC) { phase = 'settle'; t = 0; }
      } else if (phase === 'settle') {
        t += dt;
        placeBody(recoilAmt * (1 - easeOut(clamp01(t / SETTLE_SEC))));
        if (t >= SETTLE_SEC) { phase = 'home'; t = 0; placeBody(0); }
      }
    }

    function placeBody(amt) {
      const rad = (BARREL_DEG + 180) * Math.PI / 180;
      const dx = Math.cos(rad) * amt, dy = Math.sin(rad) * amt;
      body.style.left = ((REST_X + dx) * 100).toFixed(2) + '%';
      body.style.top = ((REST_Y + dy) * 100).toFixed(2) + '%';
    }

    function isBusy() { return phase === 'kick'; }

    function home() {
      clearTimers();
      phase = 'home'; t = 0;
      flash.classList.remove('is-on'); smoke.classList.remove('is-on');
      ball.style.opacity = '0';
      placeBody(0);
    }

    function clear() { clearTimers(); el.remove(); }

    placeBody(0);
    return { strike, update, isBusy, home, clear };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneCannon = api; }
})(typeof window !== 'undefined' ? window : null);
