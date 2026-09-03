(function (root) {
  'use strict';
  // 원형 크롭한 얼굴 + 두더지 포즈 스프라이트를 캔버스에서 하나로 합성한다.
  // 결과 = 포즈별 완성 두더지 PNG(objectURL) 맵. 게임은 이 이미지만 그린다 (레이어 X, 원본 사진 X).
  //
  // 핵심(사용자: 게임 성패가 갈리는 부분):
  //  - 얼굴을 "머리 전체"(헬멧 자리 포함, 이마~턱)에 얹어 헬멧이 안 보이게 한다 (A안).
  //  - 얼굴은 두더지 스프라이트 실루엣에 클립 → 배경/머리카락이 머리 밖으로 안 삐져나온다.
  //  - 볼털이 얼굴 가장자리를 페더로 덮어 경계선이 안 보이게 → "하나의 캐릭터".
  //  - 채도 살짝↓ + 따뜻한 틴트 + 이음새 안쪽 그림자로 만화 두더지와 톤을 맞춘다.
  var MG = root.MoleGame;
  var POSES = ['mole1', 'mole2', 'mole3', 'mole4', 'mole5', 'mole6', 'mole7', 'mole8', 'peek1', 'peek2', 'helmet'];
  var CW = 470, CH = 548;

  // 얼굴 원을 face 앵커에서 위로 올리고 키운다 = 머리 전체(헬멧 자리 포함).
  var HEAD_UP = 0.28;    // face 반지름 대비 위로 이동 (헬멧 자리 덮기)
  var HEAD_SCALE = 1.22; // face 반지름 대비 확대
  var FEATHER = 0.15;    // 얼굴 원 가장자리 페더
  var FUR_RING = 0.17;   // 볼털이 얼굴 바깥 가장자리를 덮는 폭
  var DESAT = 0.86;      // 채도 (1 = 원본)
  var WARM = 'rgba(255, 148, 88, 0.09)';
  var SEAM = 0.32;       // 이음새 안쪽 그림자 세기

  function loadImg(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('img load: ' + src)); };
      im.src = src;
    });
  }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // 얼굴 사진 → 원형+페더 마스크 + 색감 다듬은 정사각 캔버스
  function prepFace(faceImg, size) {
    var c = mk(size, size), x = c.getContext('2d');
    var s = Math.min(faceImg.width, faceImg.height);
    x.drawImage(faceImg, (faceImg.width - s) / 2, (faceImg.height - s) / 2, s, s, 0, 0, size, size);
    // 채도↓
    x.globalCompositeOperation = 'saturation';
    x.fillStyle = 'hsl(0,0%,50%)';
    x.globalAlpha = 1 - DESAT;
    x.fillRect(0, 0, size, size);
    // 따뜻한 틴트
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = WARM;
    x.fillRect(0, 0, size, size);
    // 원형 + 페더
    x.globalCompositeOperation = 'destination-in';
    var r = size / 2;
    var g = x.createRadialGradient(r, r, r * (1 - FEATHER), r, r, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
    x.globalCompositeOperation = 'source-over';
    return c;
  }

  function drawPose(faceImg, spriteImg, pose) {
    var a = MG.MoleSprites.headAnchor(pose);
    var cx = a.cx * CW;
    var cy = (a.cy - a.r * HEAD_UP) * CH;     // 머리 중심 (face 보다 위)
    var r = a.r * CW * HEAD_SCALE;            // 머리 반지름 (헬멧~턱)
    var size = Math.round(r * 2);

    var c = mk(CW, CH), ctx = c.getContext('2d');
    ctx.drawImage(spriteImg, 0, 0, CW, CH);   // 1) 두더지 몸체

    // 2) 얼굴 (두더지 실루엣에 클립 — 배경/머리카락이 머리 밖으로 안 나오게)
    var faceLayer = mk(CW, CH), fl = faceLayer.getContext('2d');
    fl.drawImage(prepFace(faceImg, size), cx - r, cy - r, size, size);
    fl.globalCompositeOperation = 'destination-in';
    fl.drawImage(spriteImg, 0, 0, CW, CH);
    ctx.drawImage(faceLayer, 0, 0);

    // 3) 이음새 안쪽 그림자 (얼굴 가장자리가 두더지 밑으로 들어간 느낌)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    var sg = ctx.createRadialGradient(cx, cy, r * 0.66, cx, cy, r);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(1, 'rgba(38,20,10,' + SEAM + ')');
    ctx.fillStyle = sg;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    // 4) 볼털: 두더지 스프라이트를 얼굴 바깥 가장자리 링에만 다시 덮는다
    var mask = mk(CW, CH), mc = mask.getContext('2d');
    var rg = mc.createRadialGradient(cx, cy, r * (1 - FUR_RING), cx, cy, r * 1.04);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(0,0,0,1)');
    mc.fillStyle = rg;
    mc.fillRect(0, 0, CW, CH);
    var ring = mk(CW, CH), rc = ring.getContext('2d');
    rc.drawImage(spriteImg, 0, 0, CW, CH);
    rc.globalCompositeOperation = 'destination-in';
    rc.drawImage(mask, 0, 0);
    ctx.drawImage(ring, 0, 0);

    return new Promise(function (res) {
      c.toBlob(function (blob) { res(URL.createObjectURL(blob)); }, 'image/png');
    });
  }

  function build(faceSrc) {
    return loadImg(faceSrc).then(function (faceImg) {
      return Promise.all(POSES.map(function (pose) {
        return loadImg(MG.MoleSprites.spriteUrl(pose))
          .then(function (spriteImg) { return drawPose(faceImg, spriteImg, pose); })
          .then(function (url) { return [pose, url]; });
      })).then(function (pairs) {
        var map = {};
        pairs.forEach(function (p) { map[p[0]] = p[1]; });
        return map;
      });
    });
  }

  function buildOne(faceSrc, pose) {
    return Promise.all([loadImg(faceSrc), loadImg(MG.MoleSprites.spriteUrl(pose))])
      .then(function (r) { return drawPose(r[0], r[1], pose); });
  }

  function revoke(map) {
    if (!map) return;
    Object.keys(map).forEach(function (k) { URL.revokeObjectURL(map[k]); });
  }

  var api = { build: build, buildOne: buildOne, revoke: revoke, POSES: POSES };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.MoleComposite = api; }
})(typeof window !== 'undefined' ? window : null);
