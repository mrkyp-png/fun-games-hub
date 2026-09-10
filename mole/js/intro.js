(function (root) {
  'use strict';
  // 앱 최초 1회 인트로 — "두더지 게임의 역사".
  // 글이 화면 아래에서 한 줄씩 타이핑되며 위로 올라온다 (천천히). 사진 3장 사이사이.
  // 로딩 GET NOW 탭 뒤에 뜨고, 끝나거나 [건너뛰기] → mole.introSeen 저장 → 바로 홈.

  var SEEN_KEY = 'mole.introSeen';
  var CHAR_MS = 42;    // 타이핑 속도
  var SPEED = 42;      // 화면 크롤 속도 px/sec (천천히, 계속 올라감)
  var TRIGGER = 0.82;  // 블록 top 이 뷰포트 이 비율 위로 오면 그 블록 타이핑 시작

  var BLOCKS = [
    { title: '두더지 게임의 역사' },
    { img: 'assets/intro/1.jpg', cap: '1975 · 일본 「もぐら退治」' },
    { p: '두더지 잡기 게임은 1970년대 일본에서 시작되었습니다.' },
    { p: '1975년, 일본의 오락기 제조업체 TOGO가 「もぐら退治(Mogura Taiji)」라는 전기기계식 두더지 잡기 게임을 선보였습니다.' },
    { p: '구멍에서 두더지가 갑자기 나타나면 플레이어가 망치로 두더지를 잡는 단순한 방식이었습니다.' },
    { p: '하지만 “보고 → 판단하고 → 즉시 반응한다”는 재미 덕분에 일본 오락실에서 인기를 얻었고, 이후 해외로도 퍼져 나갔습니다.' },
    { img: 'assets/intro/2.jpg', cap: '1976 · 미국 「Whac-A-Mole」' },
    { p: '미국에서는 Whac-A-Mole 이라는 이름으로 알려지면서 놀이공원과 오락시설의 대표적인 반응형 게임으로 자리 잡았습니다.' },
    { img: 'assets/intro/3.jpg', cap: '2000년대 · 대한민국 오락실' },
    { p: '그리고 50년이 지난 지금.' },
    { p: '오랜 시간 사랑받아 온 두더지 잡기 게임을 새로운 방식으로 다시 구성했습니다.' },
    { p: '16개의 구멍에서 펼쳐지는 다양한 상황과 두더지뿐만 아니라 여러 동물과 방해 요소, 그리고 새로운 게임 규칙.' },
    { p: '단순히 빠르게 두드리는 게임을 넘어 보고, 판단하고, 선택하는 새로운 두더지 게임.' },
    { p: '익숙했던 두더지 게임이 새로운 모습으로 다시 시작됩니다.' },
    { p: '방문해주셔서 대단히 감사합니다!' }
  ];

  function shouldShow() {
    return true; // ⚠️ 개발용 — 매번 표시(사용자 확인). 출시 전 아래로 원복:
    // try { return !localStorage.getItem(SEEN_KEY); } catch (e) { return true; }
  }

  function tick() {
    try { var H = root.MoleGame && root.MoleGame.HitFx; if (H && H.typeTick) H.typeTick(); } catch (e) { /* 무시 */ }
  }

  function play(onDone) {
    var done = false, killed = false;
    var timers = [];
    function after(ms, fn) { var t = setTimeout(fn, ms); timers.push(t); return t; }

    // 브금은 홈 브금(밝은 곡)을 그대로 깔고 간다 — 인트로→홈 전환 때 음악이 안 끊긴다.
    // (GET NOW 탭에서 game.js 가 #bgm 을 시작함. 혹시 멈춰 있으면 켠다.)
    var homeBgm = document.getElementById('bgm');
    if (homeBgm && homeBgm.paused) { var bp = homeBgm.play(); if (bp && bp.catch) bp.catch(function () {}); }

    function finish() {
      if (done) return;
      done = true; killed = true;
      timers.forEach(clearTimeout);
      if (raf) cancelAnimationFrame(raf);
      try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* 무시 */ }
      scr.classList.add('intro--out'); // 흰색으로 밝아지며 글자 사라짐 → 홈(흰 몸체)과 자연 연결
      setTimeout(function () { scr.remove(); if (onDone) onDone(); }, 760);
    }

    var scr = document.createElement('div');
    scr.id = 'intro-screen';
    scr.innerHTML =
      '<button type="button" class="intro-skip">건너뛰기 ›</button>' +
      '<div class="intro-view"><div class="intro-col"></div></div>';
    document.body.appendChild(scr); // 바로 불투명하게 뜬다 (홈 안 비치게) — 페이드는 나갈 때만

    var view = scr.querySelector('.intro-view');
    var col = scr.querySelector('.intro-col');
    scr.querySelector('.intro-skip').addEventListener('click', finish);

    // 블록 DOM 을 미리 다 만들어 둔다 (텍스트는 빈 채). 이미지는 바로 src.
    var els = BLOCKS.map(function (b) {
      var e = document.createElement('div');
      if (b.title) { e.className = 'intro-title'; }
      else if (b.img) {
        e.className = 'intro-fig';
        e.innerHTML = '<img alt="" src="' + b.img + '">' + (b.cap ? '<figcaption>' + b.cap + '</figcaption>' : '');
      } else { e.className = 'intro-p'; }
      e.style.opacity = '0';
      col.appendChild(e);
      return e;
    });

    function vh() { return view.clientHeight; }

    // 한 블록 타이핑 (스크롤과 독립 — 스크롤은 아래 loop 가 계속 돌린다).
    function startTyping(el, text, cb) {
      el.textContent = '';
      var i = 0;
      (function step() {
        if (killed) return;
        if (i >= text.length) { if (cb) cb(); return; }
        el.textContent += text.charAt(i);
        if (text.charAt(i) !== ' ' && (i & 1)) tick();
        i += 1;
        after(CHAR_MS, step);
      })();
    }

    // 화면(=.intro-col)은 SPEED 로 계속 천천히 위로 올라간다. 블록 top 이 TRIGGER 선을
    // 넘어오는 순간 그 블록 타이핑을 시작 → "올라가는 도중에 타이핑".
    var y = 0;             // 아래 after() 에서 세팅
    var startedUpTo = -1;
    var lastTs = 0, raf = 0;
    function loop(ts) {
      if (killed) return;
      if (!lastTs) lastTs = ts;
      var dt = Math.min(0.05, (ts - lastTs) / 1000); lastTs = ts;
      y -= SPEED * dt;
      col.style.transform = 'translate(-50%, ' + y.toFixed(1) + 'px)';

      for (var i = startedUpTo + 1; i < BLOCKS.length; i++) {
        var el = els[i];
        if (y + el.offsetTop > vh() * TRIGGER) break; // 아직 트리거 선 아래
        startedUpTo = i;
        el.style.opacity = '1';
        var txt = BLOCKS[i].title || BLOCKS[i].p;
        var isLast = i === BLOCKS.length - 1;
        // 마지막 문구("...감사합니다!") 타이핑이 끝나면 잠깐 뒤 → 밝아지며 홈으로.
        if (txt) startTyping(el, txt, isLast ? function () { after(1400, finish); } : null);
        else if (isLast) after(1400, finish);
      }

      raf = requestAnimationFrame(loop);
    }
    // 첫 줄(제목)이 트리거 선 바로 위에서 출발 → 어두운 대기 없이 첫 프레임부터 글자가 쳐진다.
    after(90, function () {
      y = vh() * 0.80 - els[0].offsetTop;
      col.style.transform = 'translate(-50%, ' + y.toFixed(1) + 'px)';
      lastTs = 0; raf = requestAnimationFrame(loop);
    });
  }

  var api = { shouldShow: shouldShow, play: play };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Intro = api; }
})(typeof window !== 'undefined' ? window : null);
