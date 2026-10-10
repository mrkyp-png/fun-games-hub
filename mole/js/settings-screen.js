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
        '<div class="mb-head"><div class="st2-head"><img src="' + A + 'head.png" alt=""></div></div>' +
        '<div class="st2-grid" data-set-list></div>' +
      '</div>';
    var list = el.querySelector('[data-set-list]');

    function card(icon, labelKey, bottomHtml, onClick) {
      var c = document.createElement('div');
      c.className = 'st2-card';
      c.innerHTML =
        '<img class="st2-card-bg" src="' + A + 'card.png" alt="">' +
        '<div class="st2-art"><img class="st2-wood" src="' + A + 'wood.png" alt=""><img class="st2-ic" src="' + A + 'ic-' + icon + '.png" alt=""></div>' +
        '<div class="st2-plank"><img src="' + A + 'plank.png" alt=""><span class="st2-lbl"></span></div>' +
        '<button type="button" class="st2-bottom">' + bottomHtml + '</button>';
      c.querySelector('.st2-lbl').textContent = T(labelKey);
      if (onClick) c.querySelector('.st2-bottom').addEventListener('click', onClick);
      list.appendChild(c);
      return c;
    }

    function toggleCard(icon, labelKey, settingName) {
      var c = card(icon, labelKey, '<img class="st2-tog" alt="">');
      var img = c.querySelector('.st2-tog'), b = c.querySelector('.st2-bottom');
      function paint() {
        var on = S.get(settingName);
        img.src = A + (on ? 'tog-on.png' : 'tog-off.png');
        b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', on ? 'true' : 'false');
      }
      b.addEventListener('click', function () {
        S.set(settingName, !S.get(settingName)); paint();
        if (settingName === 'vibration' && S.get('vibration')) S.vibrate(30);
      });
      paint();
    }

    function slot(kind, inner) { return '<img class="st2-slot" src="' + A + 'slot-' + kind + '.png" alt="">' + (inner || ''); }

    function langCard() {
      var flag = function () { return S.get('lang') === 'en' ? '🇺🇸' : '🇰🇷'; };
      var c = card('globe', 'mole.set.lang', slot('drop', '<span class="st2-flag"></span>'), function () {
        var v = document.createElement('div');
        v.className = 'ad-overlay';
        v.innerHTML = '<div class="ad-overlay-card quit-card"><div class="quit-title"></div><div class="quit-btns">' +
          '<button type="button" data-lang="ko">🇰🇷 한국어</button><button type="button" data-lang="en">🇺🇸 English</button></div></div>';
        v.querySelector('.quit-title').textContent = T('mole.set.lang');
        v.addEventListener('click', function (e) {
          var l = e.target.closest('[data-lang]');
          if (l) { S.set('lang', l.getAttribute('data-lang')); v.remove(); rebuild(); }
          else if (e.target === v) v.remove();
        });
        document.body.appendChild(v);
      });
      c.querySelector('.st2-flag').textContent = flag();
    }

    function soon() {
      var v = document.createElement('div');
      v.className = 'ad-overlay';
      v.innerHTML = '<div class="ad-overlay-card quit-card"><div class="quit-title"></div><div class="quit-btns"><button type="button" class="quit-yes" data-q="ok">OK</button></div></div>';
      v.querySelector('.quit-title').textContent = T('mole.inv.soon');
      v.querySelector('[data-q="ok"]').addEventListener('click', function () { v.remove(); });
      document.body.appendChild(v);
    }

    // 데이터 초기화 — 바로 지우지 않고 확인 팝업(명세 §6⑨)
    function confirmReset() {
      var v = document.createElement('div');
      v.className = 'ad-overlay';
      v.innerHTML = '<div class="ad-overlay-card quit-card"><div class="quit-title"></div>' +
        '<div class="quit-btns"><button type="button" data-q="no"></button><button type="button" class="quit-yes" data-q="yes"></button></div></div>';
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
      card('guide', 'mole.more.help', slot('arrow'), opts.onHelp || soon);
      card('contact', 'mole.more.contact', slot('arrow'), opts.onContact || soon);
      card('noad', 'mole.set.adfree', slot('arrow'), soon);
      card('shield', 'mole.more.privacy', slot('arrow'), opts.onPrivacy || soon);
      card('trash', 'mole.set.reset', slot('arrow'), confirmReset);
      // 이름판 글자 "…" 없이 판 안에 한 줄
      requestAnimationFrame(function () {
        list.querySelectorAll('.st2-lbl').forEach(function (t) {
          var room = t.parentNode.clientWidth * 0.82; if (!room || t.scrollWidth <= room) return;
          t.style.transform = 'translate(-50%, -50%) scaleX(' + Math.max(room / t.scrollWidth, 0.5).toFixed(3) + ')';
        });
      });
    }

    return { show: rebuild };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.SettingsScreen = api; }
})(typeof window !== 'undefined' ? window : null);
