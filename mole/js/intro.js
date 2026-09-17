(function (root) {
  'use strict';
  // 앱 최초 1회 인트로 — "두더지 게임의 역사".
  // 글이 화면 아래에서 한 줄씩 타이핑되며 위로 올라온다 (천천히). 사진 3장 사이사이.
  // 로딩 GET NOW 탭 뒤에 뜨고, 끝나거나 [건너뛰기] → mole.introSeen 저장 → 바로 홈.

  var SEEN_KEY = 'mole.introSeen';
  var CHAR_MS = 42;    // 타이핑 속도
  var SPEED = 42;      // 화면 크롤 속도 px/sec (천천히, 계속 올라감)
  var TRIGGER = 0.82;  // 블록 top 이 뷰포트 이 비율 위로 오면 그 블록 타이핑 시작

  var BLOCKS_KO = [
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

  var BLOCKS_EN = [
    { title: 'The History of Whac-A-Mole' },
    { img: 'assets/intro/1.jpg', cap: '1975 · Japan “Mogura Taiji”' },
    { p: 'Mole-whacking games began in Japan in the 1970s.' },
    { p: 'In 1975, the Japanese amusement-machine maker TOGO unveiled an electro-mechanical mole game called “Mogura Taiji” (もぐら退治).' },
    { p: 'A mole would pop out of a hole without warning, and the player whacked it with a mallet — that was the whole idea.' },
    { p: 'But the thrill of “see it → judge it → react at once” made it a hit in Japanese arcades, and it soon spread overseas.' },
    { img: 'assets/intro/2.jpg', cap: '1976 · USA “Whac-A-Mole”' },
    { p: 'In the United States it became known as Whac-A-Mole and grew into a signature reaction game at amusement parks and arcades.' },
    { img: 'assets/intro/3.jpg', cap: '2000s · Arcades in Korea' },
    { p: 'And now, fifty years later.' },
    { p: 'We have rebuilt this long-loved mole game in a brand-new way.' },
    { p: 'Sixteen holes full of ever-changing situations — not only moles, but animals, obstacles, and fresh rules.' },
    { p: 'More than tapping fast: a new mole game about watching, judging, and choosing.' },
    { p: 'The mole game you knew begins again, in a whole new form.' },
    { p: 'Thank you so much for stopping by!' }
  ];

  function pickBlocks() {
    var I = root.FGH && root.FGH.I18N;
    return (I && I.lang === 'en') ? BLOCKS_EN : BLOCKS_KO;
  }
  function skipLabel() {
    var I = root.FGH && root.FGH.I18N;
    return (I && I.lang === 'en') ? 'Skip ›' : '건너뛰기 ›';
  }

  function shouldShow() {
    return true; // ⚠️ 개발용 — 매번 표시(사용자 확인). 출시 전 아래로 원복:
    // try { return !localStorage.getItem(SEEN_KEY); } catch (e) { return true; }
  }

  function tick() {
    try { var H = root.MoleGame && root.MoleGame.HitFx; if (H && H.typeTick) H.typeTick(); } catch (e) { /* 무시 */ }
  }

  function play(onDone) {
    var done = false, killed = false;
    var BLOCKS = pickBlocks();   // 앱 언어에 맞춰 ko / en
    var timers = [];
    function after(ms, fn) { var t = setTimeout(fn, ms); timers.push(t); return t; }

    // 브금은 인트로 중엔 재생 안 함(사용자 지정) — 인트로가 끝나 홈화면이 실제로 드러나는
    // 시점에 index.html 이 window.FGH.startHomeBgm() 을 불러 시작한다.

    // 2026-09-18(사용자 지정): 예전엔 인트로가 서서히 밝아지며 홈이 "배어나오는" 디졸브
    // 였는데, 이제 index.html 의 새 전환 효과(검은 점으로 흡수→2초 암전→점에서 홈 확장,
    // z-index 9999 > 인트로 9998)가 전체 리빌을 전담한다. onDone 을 그 디졸브(1.7s/0.3s)가
    // 끝날 때까지 기다리면 디졸브 도중 홈이 먼저 비쳐버려(사용자 리포트: "홈화면 보여주지
    // 말고 바로 검은색으로 흡수") 두 효과가 겹쳐 보였다 — onDone 을 즉시 불러 새 효과가 곧장
    // 인트로 마지막 프레임 위를 덮게 한다. scr 자체는 어차피 그 아래 가려지니 정리만 뒤에 한다.
    function outro() {
      if (done) return;
      done = true; killed = true;
      timers.forEach(clearTimeout);
      if (raf) cancelAnimationFrame(raf);
      try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* 무시 */ }
      if (onDone) onDone();
      setTimeout(function () { scr.remove(); }, 1800);
    }
    function skip() {
      if (done) return;
      done = true; killed = true;
      timers.forEach(clearTimeout);
      if (raf) cancelAnimationFrame(raf);
      try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* 무시 */ }
      if (onDone) onDone();
      setTimeout(function () { scr.remove(); }, 300);
    }

    var scr = document.createElement('div');
    scr.id = 'intro-screen';
    scr.innerHTML =
      '<button type="button" class="intro-skip">' + skipLabel() + '</button>' +
      '<div class="intro-view"><div class="intro-col"></div></div>';
    document.body.appendChild(scr); // 바로 불투명하게 뜬다 (홈 안 비치게) — 페이드는 나갈 때만

    var view = scr.querySelector('.intro-view');
    var col = scr.querySelector('.intro-col');
    scr.querySelector('.intro-skip').addEventListener('click', skip);

    // 블록 DOM 을 미리 다 만들어 둔다 (텍스트는 빈 채). 이미지는 바로 src.
    // 사진 3장은 등장 순서대로 서로 다른 연출(사용자 지정, intro-photo-anim.html 후보 4/5/9번):
    // 1번 사진=블러→포커스, 2번 사진=흑백→컬러, 3번 사진=모서리 펼쳐짐(3D).
    var PHOTO_EFFECTS = ['intro-fig--blur', 'intro-fig--bw', 'intro-fig--unroll'];
    var photoIdx = 0;
    var els = BLOCKS.map(function (b) {
      var e = document.createElement('div');
      if (b.title) { e.className = 'intro-title'; }
      else if (b.img) {
        e.className = 'intro-fig ' + (PHOTO_EFFECTS[photoIdx] || '');
        photoIdx += 1;
        e.innerHTML = '<img alt="" src="' + b.img + '">' + (b.cap ? '<figcaption>' + b.cap + '</figcaption>' : '');
      } else { e.className = 'intro-p'; }
      // 글자 블록(title/p)은 타이핑되며 줄바꿈이 늘어날 때마다 키가 커져 아래 블록(특히 사진)이
      // 그때마다 한 칸씩 밀려 "툭툭 치는" 느낌이 났다(사용자 지적) — 타이핑 시작 전에 완성된
      // 텍스트로 먼저 실측해 높이를 고정해두면, 타이핑 중엔 레이아웃이 안 흔들려 스크롤이 매끄럽다.
      var full = b.title || b.p;
      if (full) {
        e.textContent = full;
        col.appendChild(e);
        e.style.minHeight = e.offsetHeight + 'px';
        e.textContent = '';
        col.removeChild(e);
      }
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
        el.classList.add('is-visible'); // 사진 전용 연출(blur/bw/unroll) 트리거 — 아래 style.css 참고
        var txt = BLOCKS[i].title || BLOCKS[i].p;
        var isLast = i === BLOCKS.length - 1;
        // 마지막 문구("...감사합니다!") 타이핑이 끝나면 잠깐 뒤 → 밝아지며 홈으로.
        if (txt) startTyping(el, txt, isLast ? function () { after(2400, outro); } : null);
        else if (isLast) after(2400, outro);
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
