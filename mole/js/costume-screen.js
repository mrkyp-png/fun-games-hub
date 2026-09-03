(function (root) {
  'use strict';
  // 사람두더지 꾸미기: 미리보기 + 4줄(모자/얼굴/몸/안경) 스크롤 + [합성] 애니메이션 → [저장].
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var ICONS = MG.CostumeArt; // 칩 썸네일 (임시 도형)

  function create(opts) {
    var el = opts.root;
    var stage = el.querySelector('[data-cs-stage]');
    var rowsBox = el.querySelector('[data-cs-rows]');
    var composeBtn = el.querySelector('[data-cs-compose]');
    var result = el.querySelector('[data-cs-result]');

    var faceUrl = null;      // 활성 얼굴 크롭 objectURL
    var faceId = null;
    var faceShape = null;    // 얼굴 윤곽 (있으면 합성이 윤곽대로 자름)
    var sel = { hat: 'helmet', body: 'default', glasses: 'none' };
    var layerUrls = [];      // revoke 관리
    var resultUrl = null;

    el.querySelector('[data-cs-back]').addEventListener('click', function () { cleanup(); opts.onClose(); });

    function cleanup() {
      layerUrls.forEach(URL.revokeObjectURL); layerUrls = [];
      if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
    }

    // faceRec: { id, blob, name, costume, shape }
    function open(faceRec) {
      cleanup();
      faceId = faceRec.id;
      faceShape = faceRec.shape || null;
      if (faceUrl) URL.revokeObjectURL(faceUrl);
      faceUrl = URL.createObjectURL(faceRec.blob);
      sel = MG.Costume.normalize(faceRec.costume);
      result.hidden = true;
      composeBtn.hidden = false;
      buildRows();
      refreshStage();
    }

    function buildRows() {
      rowsBox.innerHTML = '';
      // 얼굴 줄은 고정 사진 1개 (지금은 편집 진입한 그 얼굴). + 새로 만들기 버튼.
      addRow('face', [{ id: '__self', owned: true }], '__self', function () {});
      MG.Costume.CATS.forEach(function (cat) {
        addRow(cat, MG.Costume.items(cat), sel[cat], function (id) {
          var it = MG.Costume.items(cat).filter(function (i) { return i.id === id; })[0];
          if (!it || it.owned) { sel[cat] = id; markRow(cat); refreshStage(); return; }
          // 잠김 → 세트 구매 유도
          if (confirm(T('mole.cos.locked', { s: it.setName, p: it.price }))) {
            if (MG.Costume.buySet(it.setId)) { sel[cat] = id; buildRows(); refreshStage(); }
            else alert(T('mole.shop.noCoin'));
          }
        });
      });
    }
    function addRow(cat, items, selectedId, onPick) {
      var row = document.createElement('div');
      row.className = 'cs-row';
      row.setAttribute('data-cat', cat);
      var lbl = document.createElement('span');
      lbl.className = 'cs-row-lbl';
      lbl.textContent = T('mole.cos.' + cat);
      row.appendChild(lbl);
      var strip = document.createElement('div');
      strip.className = 'cs-strip';
      items.forEach(function (it) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'cs-chip' + (it.id === selectedId ? ' cs-chip--on' : '') + (it.owned ? '' : ' cs-chip--lock');
        chip.setAttribute('data-id', it.id);
        var thumb = (cat === 'face')
          ? '<img src="' + faceUrl + '" alt="">'
          : ICONS.chip(cat, it.id);
        chip.innerHTML = thumb + (it.owned ? '' : '<span class="cs-lock">🔒</span>');
        chip.addEventListener('click', function () { onPick(it.id); });
        strip.appendChild(chip);
      });
      row.appendChild(strip);
      rowsBox.appendChild(row);
    }
    function markRow(cat) {
      var row = rowsBox.querySelector('.cs-row[data-cat="' + cat + '"]');
      if (!row) return;
      row.querySelectorAll('.cs-chip').forEach(function (c) {
        c.classList.toggle('cs-chip--on', c.getAttribute('data-id') === sel[cat]);
      });
    }

    // 미리보기: 4부위를 상/하/좌/우 사각 박스에 넣어 보여준다. [합성] 누르면 가운데로 모여 합쳐짐.
    var built = false;
    function ensureSlots() {
      if (built) return;
      stage.innerHTML =
        '<div class="cs-slot cs-slot--hat" data-slot="hat"><img alt=""></div>' +
        '<div class="cs-slot cs-slot--face" data-slot="face"><img alt=""></div>' +
        '<div class="cs-slot cs-slot--glasses" data-slot="glasses"><img alt=""></div>' +
        '<div class="cs-slot cs-slot--body" data-slot="body"><img alt=""></div>';
      built = true;
    }
    function refreshStage() {
      ensureSlots();
      stage.classList.remove('cs-stage--merge');
      // 얼굴 박스 = 사진, 나머지 = 아이템 칩
      var faceBox = stage.querySelector('.cs-slot--face');
      faceBox.innerHTML = '<img alt="" src="' + faceUrl + '">';
      ['hat', 'body', 'glasses'].forEach(function (k) {
        stage.querySelector('.cs-slot--' + k).innerHTML = ICONS.chip(k, sel[k]);
      });
    }

    // [합성] — 상/하/좌/우 박스가 가운데로 모이는 애니메이션 → 짜잔 결과 카드
    composeBtn.addEventListener('click', function () {
      composeBtn.disabled = true;
      stage.classList.add('cs-stage--merge'); // CSS transition 이 4박스를 가운데로 모음
      setTimeout(function () {
        MG.MoleComposite.buildOne(faceUrl, sel, 'mole1', faceShape).then(function (url) {
          resultUrl = url;
          result.querySelector('[data-cs-card]').src = url;
          result.hidden = false;
          result.classList.remove('cs-result--in');
          void result.offsetWidth;
          result.classList.add('cs-result--in'); // 짜잔 pop + sparkle
          composeBtn.hidden = true;
          composeBtn.disabled = false;
        });
      }, 620);
    });

    result.querySelector('[data-cs-redo]').addEventListener('click', function () {
      result.hidden = true;
      composeBtn.hidden = false;
      refreshStage();
    });
    result.querySelector('[data-cs-save]').addEventListener('click', function () {
      opts.onSave(faceId, { hat: sel.hat, body: sel.body, glasses: sel.glasses });
    });

    return { open: open };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.CostumeScreen = api; }
})(typeof window !== 'undefined' ? window : null);
