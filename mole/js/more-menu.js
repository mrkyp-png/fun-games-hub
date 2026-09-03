(function (root) {
  'use strict';
  // 게임 화면 좌상단 ⊞ 아이콘 뒤의 "더보기 메뉴" (#more-menu). 첫 화면은 아니다 (대화가 첫 화면).
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var DIFF_LABEL = { easy: 'mole.diff.easy', mid: 'mole.diff.mid', legend: 'mole.diff.legend' };

  function create(opts) {
    var el = opts.root;
    var on = opts.on;
    var faceUrls = [];

    el.querySelector('[data-mm-close]').addEventListener('click', on.close);
    el.querySelector('[data-mm-make]').addEventListener('click', on.make);
    el.querySelector('[data-mm-locker]').addEventListener('click', on.locker);
    el.querySelector('[data-mm-name]').addEventListener('click', on.editName);
    el.querySelector('[data-mm-avatar]').addEventListener('click', on.editAvatar);
    el.querySelector('[data-mm-start]').addEventListener('click', on.start);
    el.querySelectorAll('[data-mm-diff]').forEach(function (b) {
      b.addEventListener('click', function () { on.diff(b.getAttribute('data-mm-diff')); });
    });
    var NAV = { score: on.score, daily: on.daily, shop: on.shop, locker: on.locker,
               help: on.help, privacy: on.privacy, contact: on.contact, settings: on.settings };
    el.querySelectorAll('[data-mm-nav]').forEach(function (b) {
      b.addEventListener('click', function () {
        var fn = NAV[b.getAttribute('data-mm-nav')];
        if (fn) fn();
      });
    });

    function revokeFaces() { faceUrls.forEach(URL.revokeObjectURL); faceUrls = []; }

    function refresh() {
      el.querySelector('[data-mm-hearts] b').textContent = String(MG.Economy.getHearts());
      el.querySelector('[data-mm-coins] b').textContent = MG.Economy.getCoins().toLocaleString();

      el.querySelector('[data-mm-nick]').textContent = localStorage.getItem('mole.nick') || '두더지';
      var pic = localStorage.getItem('mole.profilePic');
      var av = el.querySelector('[data-mm-avatar]');
      av.style.backgroundImage = pic ? 'url("' + pic + '")' : 'url("assets/moles/mole1.png")';
      var diff = localStorage.getItem('mole.difficulty') || 'easy';
      var best = parseInt(localStorage.getItem('mole.best.' + diff), 10) || 0;
      el.querySelector('[data-mm-sub]').textContent = best > 0
        ? T('mole.more.profileSub', { d: T(DIFF_LABEL[diff] || 'mole.diff.easy'), n: best.toLocaleString() })
        : T('mole.more.profileSubNone');
      el.querySelectorAll('[data-mm-diff]').forEach(function (b) {
        b.classList.toggle('mm-pill--on', b.getAttribute('data-mm-diff') === diff);
      });

      MG.Ads.banner(el.querySelector('[data-mm-ad]'));

      revokeFaces();
      MG.FaceStore.listFaces().then(function (faces) {
        var box = el.querySelector('[data-mm-faces]');
        var strip = el.querySelector('[data-mm-lthumbs]');
        box.innerHTML = ''; strip.innerHTML = '';
        faces.slice(0, 4).forEach(function (f) {
          var src = URL.createObjectURL(f.blob);
          faceUrls.push(src);
          var a = mini(), s = mini();
          box.appendChild(a); strip.appendChild(s);
          // 원본 사진 안 보이게 — 얼굴+몸체 합성 완료 썸네일
          MG.MoleComposite.buildOne(src, 'mole1').then(function (url) {
            faceUrls.push(url);
            a.querySelector('img').src = url;
            s.querySelector('img').src = url;
          });
        });
      });
    }
    function mini() {
      var d = document.createElement('span');
      d.className = 'mm-mini-mole';
      d.innerHTML = '<img alt="">';
      return d;
    }
    return { refresh: refresh };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.MoreMenu = api; }
})(typeof window !== 'undefined' ? window : null);
