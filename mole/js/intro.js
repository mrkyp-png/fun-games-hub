(function (root) {
  'use strict';
  // 앱 최초 1회 인트로 — "두더지 게임의 역사" 한 페이지 (히스토리 글 + 사진 3장).
  // 로딩 GET NOW 탭 뒤에 뜨고, [시작하기] 또는 [건너뛰기] → mole.introSeen 저장 → 홈.

  var SEEN_KEY = 'mole.introSeen';

  var BLOCKS = [
    { img: 'assets/intro/1.jpg', cap: '1975 · 일본 「もぐら退治」' },
    { p: '두더지 잡기 게임은 1970년대 일본에서 시작되었습니다.' },
    { p: '1975년, 일본의 오락기 제조업체 TOGO가 「もぐら退治(Mogura Taiji)」라는 전기기계식 두더지 잡기 게임을 선보였습니다.' },
    { p: '구멍에서 두더지가 갑자기 나타나면 플레이어가 망치로 두더지를 잡는 단순한 방식이었습니다.' },
    { p: '하지만 “보고 → 판단하고 → 즉시 반응한다”는 재미 덕분에 일본 오락실에서 인기를 얻었고, 이후 해외로도 퍼져 나갔습니다.' },
    { img: 'assets/intro/2.jpg', cap: '미국 · Whac-A-Mole' },
    { p: '미국에서는 Whac-A-Mole 이라는 이름으로 알려지면서 놀이공원과 오락시설의 대표적인 반응형 게임으로 자리 잡았습니다.' },
    { img: 'assets/intro/3.jpg', cap: '한국 · 오락실 두더지 게임' },
    { p: '그리고 50년이 지난 지금.' },
    { p: '오랜 시간 사랑받아 온 두더지 잡기 게임을 새로운 방식으로 다시 구성했습니다.' },
    { p: '16개의 구멍에서 펼쳐지는 다양한 상황과 두더지뿐만 아니라 여러 동물과 방해 요소, 그리고 새로운 게임 규칙.' },
    { p: '단순히 빠르게 두드리는 게임을 넘어 보고, 판단하고, 선택하는 새로운 두더지 게임.' },
    { big: '1975 → 2026' },
    { p: '익숙한 두더지 게임이 새로운 모습으로 다시 시작됩니다.' }
  ];

  function shouldShow() {
    try { return !localStorage.getItem(SEEN_KEY); } catch (e) { return true; }
  }

  function play(onDone) {
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* 무시 */ }
      scr.classList.add('intro--out');
      setTimeout(function () { scr.remove(); if (onDone) onDone(); }, 320);
    }

    var scr = document.createElement('div');
    scr.id = 'intro-screen';

    var html = '<button type="button" class="intro-skip">건너뛰기 ›</button>' +
      '<div class="intro-scroll"><div class="intro-col">' +
      '<h1 class="intro-title">🕳️ 두더지 게임의 역사</h1>';
    BLOCKS.forEach(function (b) {
      if (b.img) {
        html += '<figure class="intro-fig"><img alt="" loading="eager" src="' + b.img + '">' +
          (b.cap ? '<figcaption>' + b.cap + '</figcaption>' : '') + '</figure>';
      } else if (b.big) {
        html += '<p class="intro-big">' + b.big + '</p>';
      } else {
        html += '<p class="intro-p">' + b.p + '</p>';
      }
    });
    html += '<button type="button" class="intro-start">시작하기</button>' +
      '</div></div>';
    scr.innerHTML = html;
    document.body.appendChild(scr);
    requestAnimationFrame(function () { scr.classList.add('intro--in'); });

    scr.querySelector('.intro-skip').addEventListener('click', finish);
    scr.querySelector('.intro-start').addEventListener('click', finish);
  }

  var api = { shouldShow: shouldShow, play: play };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Intro = api; }
})(typeof window !== 'undefined' ? window : null);
