// v1013 문의하기 — 바탕화면 "설정함 UI 및 에셋/문의하기 UI/MOLE_PANG_문의하기_화면_최종_명세서" 기준.
// 순서: 문의 유형(드롭다운) → 문의 내용(여러 줄) → 답변받을 이메일 → 문의 보내기. 글자는 모두 코드(i18n).
// 전송 = 휴대폰 메일 앱을 내용이 채워진 채로 열기(mailto) — 별도 서버 없음(기존 문의하기 방식 유지).
(function (root) {
  'use strict';
  var TO = 'mrkyp@hanmail.net';
  var TYPES = ['mole.ct.typeGame', 'mole.ct.typeBug', 'mole.ct.typeIdea', 'mole.ct.typeEtc'];
  var A = 'assets/contact/';

  function create(opts) {
    var el = opts.root, T = function (k) { return root.FGH.I18N.t(k); };
    var type = 0;
    el.classList.add('ct-screen', 'shop-coin-choice-dialog');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'ct-popup-title');
    // V1531 C 사용자: 오른쪽 위 8px 에 X(닫기) 버튼 — 점수·일일 화면과 같은 공용 game-close.
    el.innerHTML =
      '<div class="shop-coin-choice-card ct-popup-card">' +
        '<button type="button" class="game-close" data-ct-close aria-label="닫기"><img src="assets/score/icon-close-red.svg" alt=""></button>' +
        '<img class="shop-coin-choice-art" src="' + A + 'plane.png" alt="">' +
        '<b class="ct-popup-title" id="ct-popup-title" data-k="mole.more.contact"></b>' +
        '<div class="ct-panel">' +
          '<section class="ct-sec"><b class="ct-lbl" data-k="mole.ct.type"></b>' +
            '<button type="button" class="ct-drop" data-ct-drop><span data-ct-type></span><i>▼</i></button>' +
            '<div class="ct-menu" data-ct-menu hidden></div></section>' +
          '<section class="ct-sec ct-sec--grow"><b class="ct-lbl" data-k="mole.ct.body"></b>' +
            '<textarea class="ct-field ct-area" data-ct-body maxlength="1000"></textarea></section>' +
          '<section class="ct-sec"><b class="ct-lbl" data-k="mole.ct.email"></b>' +
            '<input class="ct-field ct-mail" data-ct-mail type="email" inputmode="email" autocomplete="email" maxlength="80"></section>' +
          '<p class="ct-err" data-ct-err></p>' +
        '</div>' +
          '<div class="shop-coin-choice-actions"><button type="button" class="shop-card-btn shop-coin-choice-action ws-action-frame shop-buy-frame" data-choice-action="confirm" data-ct-send><span data-k="mole.ct.send"></span></button></div>' +
      '</div>';
    var $ = function (s) { return el.querySelector(s); };
    var previousFocus = null;
    function close() {
      el.hidden = true;
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    }
    $('[data-ct-close]').addEventListener('click', close);
    el.addEventListener('click', function (event) { if (event.target === el) close(); });
    el.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === 'Tab') {
        var items = Array.from(el.querySelectorAll('button,input,textarea')).filter(function (item) { return !item.closest('[hidden]'); });
        var first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    var menu = $('[data-ct-menu]'), err = $('[data-ct-err]'), body = $('[data-ct-body]'), mail = $('[data-ct-mail]');

    function paint() {
      el.querySelectorAll('[data-k]').forEach(function (n) { n.textContent = T(n.getAttribute('data-k')); });
      body.placeholder = T('mole.ct.bodyHint'); mail.placeholder = T('mole.ct.emailHint');
      $('[data-ct-close]').setAttribute('aria-label', root.FGH.Settings.get('lang') === 'en' ? 'Close' : '닫기');
      $('[data-ct-type]').textContent = T(TYPES[type]);
      menu.innerHTML = TYPES.map(function (k, i) { return '<button type="button" data-i="' + i + '"' + (i === type ? ' class="is-on"' : '') + '>' + T(k) + '</button>'; }).join('');
    }
    $('[data-ct-drop]').addEventListener('click', function () { menu.hidden = !menu.hidden; });
    menu.addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (!b) return; type = +b.getAttribute('data-i'); menu.hidden = true; paint(); });
    $('[data-ct-send]').addEventListener('click', function () {
      var text = body.value.trim(), addr = mail.value.trim();
      if (!text) { err.textContent = T('mole.ct.needBody'); body.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { err.textContent = T('mole.ct.needEmail'); mail.focus(); return; }
      err.textContent = '';
      var ver = (document.getElementById('build-tag') || {}).textContent || '';
      var subject = '[MOLE PANG] ' + T(TYPES[type]);
      var msg = text + '\n\n---\n' + T('mole.ct.email') + ': ' + addr + '\n' + ver + ' / ' + navigator.userAgent;
      root.location.href = 'mailto:' + TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(msg);
      var t = document.createElement('div'); t.className = 'st2-toast ct-toast'; t.textContent = T('mole.ct.done');
      t.style.left = '50%'; t.style.top = '45%'; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 1500);
    });
    return { show: function () {
      previousFocus = document.activeElement;
      var settings = document.getElementById('settings-screen');
      if (el.parentNode !== settings) settings.appendChild(el);
      type = 0; body.value = ''; mail.value = ''; err.textContent = ''; menu.hidden = true;
      paint(); el.hidden = false; $('[data-ct-close]').focus();
    } };
  }

  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Contact = api; }
})(typeof window !== 'undefined' ? window : null);
