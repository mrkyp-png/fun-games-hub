(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k) { return root.FGH.I18N.t(k); };

  function create(opts) {
    var el = opts.root;
    var grid = el.querySelector('[data-fl-grid]');
    var empty = el.querySelector('[data-fl-empty]');
    var urls = [];

    el.querySelector('[data-fl-close]').addEventListener('click', opts.onClose);
    el.querySelector('[data-fl-new]').addEventListener('click', opts.onMake);

    function revoke() { urls.forEach(URL.revokeObjectURL); urls = []; }

    function show() {
      revoke();
      grid.innerHTML = '';
      MG.FaceStore.listFaces().then(function (faces) {
        empty.hidden = faces.length > 0;
        var activeId = MG.FaceStore.getActiveId();
        faces.forEach(function (f) {
          var url = URL.createObjectURL(f.blob);
          urls.push(url);
          var card = document.createElement('div');
          card.className = 'fl-card' + (f.id === activeId ? ' fl-card--active' : '');
          card.innerHTML =
            '<div class="fl-thumb"><img class="fl-thumb-img" alt=""></div><div class="fl-name"></div>' +
            '<div class="fl-actions">' +
            '<button type="button" data-act="use">' + T('mole.fl.use') + '</button>' +
            '<button type="button" data-act="edit">' + T('mole.fl.edit') + '</button>' +
            '<button type="button" data-act="rename">' + T('mole.fl.rename') + '</button>' +
            '<button type="button" data-act="del">' + T('mole.fl.del') + '</button></div>';
          // 원본 사진 안 보이게 — 몸+얼굴+모자+안경 합성 완료 이미지 하나만
          MG.MoleComposite.buildOne(url, f.costume, 'mole1', f.shape).then(function (composed) {
            urls.push(composed);
            var img = card.querySelector('.fl-thumb-img');
            if (img) img.src = composed;
          });
          card.querySelector('.fl-name').textContent = f.name || (f.id === activeId ? T('mole.fl.active') : '');
          card.querySelector('[data-act="use"]').addEventListener('click', function () {
            MG.FaceStore.setActive(f.id); opts.onPick(f.id);
          });
          card.querySelector('[data-act="edit"]').addEventListener('click', function () {
            opts.onEdit(f);
          });
          card.querySelector('[data-act="rename"]').addEventListener('click', function () {
            var name = prompt(T('mole.fl.rename'), f.name || '');
            if (name != null) MG.FaceStore.renameFace(f.id, name.trim().slice(0, 12)).then(show);
          });
          card.querySelector('[data-act="del"]').addEventListener('click', function () {
            if (confirm(T('mole.fl.delConfirm'))) MG.FaceStore.deleteFace(f.id).then(show);
          });
          grid.appendChild(card);
        });
      });
    }
    return { show: show };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.FaceLocker = api; }
})(typeof window !== 'undefined' ? window : null);
