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
    { p: '익숙했던 두더지 게임이 새로운 모습으로 다시 시작됩니다.' }
  ];

  function shouldShow() {
    return true; // ⚠️ 개발용 — 매번 표시(사용자 확인). 출시 전 아래로 원복:
    // try { return !localStorage.getItem(SEEN_KEY); } catch (e) { return true; }
  }

  function tick() {
    try { var H = root.MoleGame && root.MoleGame.HitFx; if (H && H.typeTick) H.typeTick(); } catch (e) { /* 무시 */ }
  }

  // 잔잔한 인트로 브금 — Web Audio 로 부드러운 패드(사인 화음) + 아주 느린 필터 스윕. (파일 없음)
  //   Am → F → C → G 를 9초마다 천천히 옮겨간다.
  function makeAmbient() {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return { stop: function () {} };
    var ctx;
    try { ctx = new AC(); } catch (e) { return { stop: function () {} }; }
    if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) {} }
    var t0 = ctx.currentTime;

    var master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 0.4; lp.connect(master);
    var lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.045; lfoG.gain.value = 280;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();

    function voice(freq) {
      var o = ctx.createOscillator(), d = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; d.type = 'sine';
      o.frequency.value = freq; d.frequency.value = freq * 1.004; // 살짝 디튠 = 따뜻함
      g.gain.value = 0.17; o.connect(g); d.connect(g); g.connect(lp);
      o.start(); d.start();
      return function set(f) {
        o.frequency.setTargetAtTime(f, ctx.currentTime, 1.4);
        d.frequency.setTargetAtTime(f * 1.004, ctx.currentTime, 1.4);
      };
    }
    var CH = [
      [220.00, 261.63, 329.63], // Am
      [174.61, 220.00, 261.63], // F
      [130.81, 196.00, 246.94], // C
      [196.00, 246.94, 293.66]  // G
    ];
    var setters = CH[0].map(voice);
    master.gain.setTargetAtTime(0.12, t0, 3.5); // 아주 천천히 페이드인
    var ci = 0;
    var iv = setInterval(function () {
      ci = (ci + 1) % CH.length;
      CH[ci].forEach(function (f, k) { setters[k] && setters[k](f); });
    }, 9000);

    return {
      stop: function () {
        clearInterval(iv);
        try { master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5); } catch (e) {}
        setTimeout(function () { try { ctx.close(); } catch (e) {} }, 900);
      }
    };
  }

  function play(onDone) {
    var done = false, killed = false;
    var timers = [];
    function after(ms, fn) { var t = setTimeout(fn, ms); timers.push(t); return t; }

    // 홈 브금은 잠깐 멈추고, 잔잔한 인트로 앰비언트를 깐다.
    var homeBgm = document.getElementById('bgm');
    var homeWasPlaying = homeBgm && !homeBgm.paused;
    if (homeBgm) { try { homeBgm.pause(); } catch (e) { /* 무시 */ } }
    var amb = makeAmbient();

    function finish() {
      if (done) return;
      done = true; killed = true;
      timers.forEach(clearTimeout);
      if (raf) cancelAnimationFrame(raf);
      try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* 무시 */ }
      try { amb.stop(); } catch (e) { /* 무시 */ }
      if (homeBgm && homeWasPlaying) { var hp = homeBgm.play(); if (hp && hp.catch) hp.catch(function () {}); }
      scr.classList.add('intro--out');
      setTimeout(function () { scr.remove(); if (onDone) onDone(); }, 320);
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
    function startTyping(el, text) {
      el.textContent = '';
      var i = 0;
      (function step() {
        if (killed) return;
        if (i >= text.length) return;
        el.textContent += text.charAt(i);
        if (text.charAt(i) !== ' ' && (i & 1)) tick();
        i += 1;
        after(CHAR_MS, step);
      })();
    }

    // 화면(=.intro-col)은 SPEED 로 계속 천천히 위로 올라간다. 블록 top 이 TRIGGER 선을
    // 넘어오는 순간 그 블록 타이핑을 시작 → "올라가는 도중에 타이핑".
    var y = vh();          // translateY (아래에서 시작)
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
        if (txt) startTyping(el, txt);
      }

      var lastEl = els[els.length - 1];
      if (startedUpTo >= BLOCKS.length - 1 &&
          y + lastEl.offsetTop + lastEl.offsetHeight < vh() * 0.20) { finish(); return; }

      raf = requestAnimationFrame(loop);
    }
    after(300, function () { y = vh(); lastTs = 0; raf = requestAnimationFrame(loop); });
  }

  var api = { shouldShow: shouldShow, play: play };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Intro = api; }
})(typeof window !== 'undefined' ? window : null);
