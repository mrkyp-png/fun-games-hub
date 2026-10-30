(function (root) {
  'use strict';
  var S = root.FGH.Settings;
  var I18N = root.FGH.I18N;
  var T = function (k) { return I18N.t(k); };

  // v1010 설정 화면 — 바탕화면 "설정함 UI 및 에셋/MOLE_PANG_설정화면_최종_명세서" 3×3 카드(순서 고정, §7).
  // 카드 = 노란 박스 + 나무판 뒤 아이콘 + 갈색 이름판(글자는 코드) + 아래 칸(토글 / ▼ / ›). 에셋은 assets/settings2 각각 독립.
  var A = 'assets/settings2/';

  function create(opts) {
    var el = opts.root;
    el.classList.add('st2-screen');
    el.innerHTML =
      '<div class="mb-frame st2-frame">' +
        '<div class="st2-grid" data-set-list></div>' +
      '</div>';
    var list = el.querySelector('[data-set-list]');

    function card(icon, labelKey, bottomHtml, onClick, bottomClass) {
      var c = document.createElement('div');
      c.className = 'st2-card';
      c.innerHTML =
        '<img class="st2-card-bg" src="' + A + 'card.png" alt="">' +
        '<div class="st2-art"><img class="st2-wood" src="' + A + 'wood.png" alt=""><img class="st2-ic" src="' + A + 'ic-' + icon + '-2x.png" alt=""></div>' +
        '<div class="st2-plank"><img src="' + A + 'plank.png" alt=""><span class="st2-lbl"></span></div>' +
        '<button type="button" class="st2-bottom">' + bottomHtml + '</button>';
      c.querySelector('.st2-lbl').textContent = T(labelKey);
      if (bottomClass) c.querySelector('.st2-bottom').className += ' ' + bottomClass;
      if (onClick) c.querySelector('.st2-bottom').addEventListener('click', onClick);
      list.appendChild(c);
      return c;
    }

    function toggleCard(icon, labelKey, settingName) {
      var c = card(icon, labelKey, '<span class="st2-switch-label"></span><span class="st2-switch-knob" aria-hidden="true"></span>');
      var b = c.querySelector('.st2-bottom');
      b.classList.add('ws-action-frame', 'st2-switch');
      b.dataset.setting = settingName;
      b.setAttribute('aria-label', T(labelKey));
      function paint() {
        var on = S.get(settingName);
        b.classList.toggle('is-on', !!on);
        b.querySelector('.st2-switch-label').textContent = on ? 'ON' : 'OFF';
        b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', on ? 'true' : 'false');
      }
      b.addEventListener('click', function () {
        S.set(settingName, !S.get(settingName)); paint();
        if (settingName === 'vibration' && S.get('vibration')) S.vibrate(30);
      });
      paint();
    }

    // 아래 박스: ON/OFF 버튼과 같은 프레임(그림 대신 CSS 프레임 + 기호)
    var DROP = '<svg class="st2-glyph" viewBox="0 0 16 10" aria-hidden="true"><path d="M1 1h14L8 9z"/></svg>';
    var ARROW = '<svg class="st2-glyph" viewBox="0 0 10 16" aria-hidden="true"><path d="M2 2l6 6-6 6"/></svg>';
    var GO = 'ws-action-frame st2-nav-frame';

    function langCard() {
      var flag = function () { return S.get('lang') === 'en' ? '🇺🇸' : '🇰🇷'; };
      var c = card('globe', 'mole.set.lang', DROP + '<span class="st2-flag"></span>', function () {
        var v = document.createElement('div');
        v.className = 'ad-overlay';
        v.innerHTML = '<div class="ad-overlay-card quit-card"><img class="quit-ico" src="' + A + 'ic-globe.png" alt=""><div class="quit-title"></div><div class="quit-btns">' +
          '<button type="button" class="quit-yes" data-lang="ko">🇰🇷 한국어</button><button type="button" class="quit-yes" data-lang="en">🇺🇸 English</button></div></div>';
        v.querySelector('.quit-title').textContent = T('mole.set.lang');
        v.addEventListener('click', function (e) {
          var l = e.target.closest('[data-lang]');
          if (l) { S.set('lang', l.getAttribute('data-lang')); v.remove(); rebuild(); }
          else if (e.target === v) v.remove();
        });
        document.body.appendChild(v);
      }, GO);
      c.querySelector('.st2-flag').textContent = flag();
    }

    // v1011(사용자 지정 3번): 준비 중 = 작은 말풍선이 잠깐 떴다 사라짐
    function soon(e) {
      var host = (e && e.currentTarget) || el, r = host.getBoundingClientRect();
      var t = document.createElement('div');
      t.className = 'st2-toast'; t.textContent = T('mole.inv.soon');
      t.style.left = (r.left + r.width / 2) + 'px'; t.style.top = (r.top - 6) + 'px';
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 1500);
    }

    // 데이터 초기화 — 바로 지우지 않고 확인 팝업(명세 §6⑨)
    function confirmReset() {
      var v = document.createElement('div');
      v.className = 'ad-overlay';
      v.innerHTML = '<div class="ad-overlay-card quit-card"><img class="quit-ico" src="' + A + 'ic-trash.png" alt=""><div class="quit-title"></div>' +
        '<div class="quit-btns"><button type="button" data-q="no"></button><button type="button" class="quit-yes quit-danger" data-q="yes"></button></div></div>';
      v.querySelector('.quit-title').textContent = T('mole.set.resetConfirm');
      v.querySelector('[data-q="no"]').textContent = T('mole.skl.restoreCancel');
      v.querySelector('[data-q="yes"]').textContent = T('mole.set.reset');
      v.querySelector('[data-q="no"]').addEventListener('click', function () { v.remove(); });
      v.querySelector('[data-q="yes"]').addEventListener('click', function () {
        try { localStorage.clear(); } catch (e) {}
        if (root.indexedDB && root.indexedDB.deleteDatabase) root.indexedDB.deleteDatabase('moleFaces');
        location.reload();
      });
      document.body.appendChild(v);
    }

    function rebuild() {
      list.innerHTML = '';
      toggleCard('music', 'mole.set.bgm', 'music');
      toggleCard('sound', 'mole.set.sfx', 'sound');
      toggleCard('vib', 'mole.set.vib', 'vibration');
      langCard();
      card('guide', 'mole.more.help', ARROW, opts.onHelp || soon, GO);
      card('contact', 'mole.more.contact', ARROW, opts.onContact || soon, GO);
      var noad = card('noad', 'mole.set.adfree', ARROW, null, GO); noad.classList.add('is-off'); // v1011(사용자 지정): 광고 제거 = 회색만, 누름 없음
      noad.dataset.soon = T('mole.inv.soon'); // V1369 C: 회색만이면 고장처럼 보여 '🔒 준비 중' 리본
      card('shield', 'mole.more.privacy', ARROW, opts.onPrivacy || soon, GO);
      card('trash', 'mole.set.reset', ARROW, confirmReset, GO);
      // 이름판 글자 "…" 없이 판 안에 한 줄
      requestAnimationFrame(function () {
        list.querySelectorAll('.st2-lbl').forEach(function (t) {
          var room = t.parentNode.clientWidth * 0.82; if (!room || t.scrollWidth <= room) return;
          t.style.transform = 'scaleX(' + Math.max(room / t.scrollWidth, 0.5).toFixed(3) + ')';
        });
      });
    }

    return { show: rebuild };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.SettingsScreen = api; }
})(typeof window !== 'undefined' ? window : null);
