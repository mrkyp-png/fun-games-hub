// 띠 화면 전환(Motion Prompt #018) — V1621 C: 라운드 지도(round-map.js) 삭제로 따로 떼어 냄. 게임 시작·화면 준비 대기에 씀.
(function (root) {
  'use strict';
  // V1325 C 화면 전환 = Motion Prompt #018 "Shape transition"(MIT, (c) 2026 Shohei Ohtaki, showheyohtaki.github.io/motion-prompt/#018).
  // 원본 그대로: 가로 띠 4개(끝 80px 기울기, 539px 폭 기준 비율), 덮기 0.31초 → 다 덮이고 준비되면 onCovered(화면 교체) → 0.06초 뒤 걷기 0.315초(원본의 2배 속도, 사용자 지정),
  // 띠마다 14% 지연·구간 58% 동안 cubic ease-in-out. 색만 노랑·초록·빨강·보라(사용자 지정). dir 1 = 좌→우, -1 = 거울. 준비 대기는 최대 1.6초.
  var BAND_COLORS = ['#ffd84a', '#70f58b', '#ff4a3a', '#a66bff'];
  // V1332 C: 매번 화면 크기 캔버스를 만들어 매 프레임 칠하던 것 → 미리 만든 띠 4개(평행사변형 clip-path)를 transform 으로만 이동.
  // transform 애니메이션은 폰 그래픽 쪽(컴포지터)이 따로 처리해, 전환 순간 메인 처리가 바빠도 띠는 끊기지 않는다.
  // 띠 한 개 = 아래변 길이 span 의 평행사변형: translateX -span(왼쪽 밖) → 0(덮음) → +span(오른쪽 밖) 이 원래 앞변·뒷변 이동과 같다.
  var bandHost = null, bandEls = [];
  function shapeTransition(dir, onCovered, isReady, onDone, holdOpen) {
    if (!bandHost) {
      bandHost = document.createElement('div');
      bandHost.className = 'rm-shape-transition';
      BAND_COLORS.forEach(function (c) { var b = document.createElement('i'); b.style.background = c; bandHost.appendChild(b); bandEls.push(b); });
      document.body.appendChild(bandHost);
    }
    var w = root.innerWidth, h = root.innerHeight, sk = w * 80 / 539, span = w + sk + 20, bh = h / 4 + 1;
    var EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'; // 원본 eIO(cubic ease-in-out)
    bandHost.style.transform = dir < 0 ? 'scaleX(-1)' : '';
    bandEls.forEach(function (b, i) {
      b.style.top = (i * h / 4) + 'px'; b.style.height = bh + 'px';
      b.style.left = (-sk - 10) + 'px'; b.style.width = (span + sk) + 'px';
      b.style.clipPath = 'polygon(' + sk + 'px 0, 100% 0, calc(100% - ' + sk + 'px) 100%, 0 100%)';
      b.getAnimations().forEach(function (a) { a.cancel(); });
      b.style.transform = 'translateX(' + (-span) + 'px)';
    });
    bandHost.style.visibility = 'visible';
    function run(from, to, base, delay0) {
      return bandEls.map(function (b, i) {
        return b.animate([{ transform: 'translateX(' + from + 'px)' }, { transform: 'translateX(' + to + 'px)' }],
          { duration: 0.58 * base, delay: delay0 + i * 0.14 * base, easing: EASE, fill: 'forwards' });
      });
    }
    run(-span, 0, 310, 0);
    var t0 = performance.now(), firstSwap = 0;
    root.setTimeout(function wait() {
      var now = performance.now();
      if (!firstSwap) {
        if (isReady && !isReady() && now - t0 < 1600) { root.requestAnimationFrame(function () { wait(); }); return; }
        firstSwap = now; onCovered();
      }
      if (holdOpen && holdOpen()) { root.requestAnimationFrame(function () { wait(); }); return; } // Keep the cover until the replacement screen is actually ready.
      var last = run(0, span, 315, 0).pop();
      last.onfinish = function () { bandHost.style.visibility = 'hidden'; if (onDone) onDone(); };
    }, 310);
  }
  root.MoleGame = root.MoleGame || {};
  root.MoleGame.ShapeTransition = { run: shapeTransition };
})(window);
