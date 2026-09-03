(function (root) {
  'use strict';
  // 사람두더지 = 몸(8포즈) + 얼굴(사진) + 모자 + 안경 을 캔버스에서 하나로 합성한다.
  // 결과 = 포즈별 완성 이미지(objectURL) 맵. 게임/카드는 이것만 렌더 (레이어 X, 원본 사진 X).
  //
  // 아트는 사용자가 나중에 제공 — 지금 모자/안경/기본외 몸은 임시 도형(procedural).
  // 실제 아트 오면 이 파일의 draw* 를 이미지 로드로 교체 + slice 스크립트 추가.
  var MG = root.MoleGame;
  var POSES = ['mole1', 'mole2', 'mole3', 'mole4', 'mole5', 'mole6', 'mole7', 'mole8', 'peek1', 'peek2', 'helmet'];
  var CW = 470, CH = 548;

  var FEATHER = 0.13;
  var FUR_RING = 0.16;
  var DESAT = 0.88;
  var WARM = 'rgba(255, 150, 88, 0.08)';
  var SEAM = 0.28;

  function loadImg(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('img: ' + src)); };
      im.src = src;
    });
  }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function toURL(canvas) {
    return new Promise(function (res) { canvas.toBlob(function (b) { res(URL.createObjectURL(b)); }, 'image/png'); });
  }

  // ---------- 몸통 (8포즈) ----------
  // 사용자가 줄 실제 아트 = 머리 없는 몸통 8포즈. 그때는 여기서 그 이미지를 로드만 하면 됨:
  //   loadImg('assets/bodies/' + bodyId + '/' + pose + '.png')
  // 지금은 임시로 두더지 스프라이트(헬멧 키아웃) + 몸id별 색조. 얼굴 원이 머리를 덮는다.
  var bodyCache = {};
  var BODY_TINT = {
    gray: 'rgba(150,150,162,0.5)', tux: 'rgba(24,24,36,0.42)',
    hoodie: 'rgba(84,116,205,0.4)', work: 'rgba(208,164,82,0.36)', robe: 'rgba(122,62,148,0.42)'
  };
  function bodyCanvas(bodyId, pose) {
    var key = bodyId + '|' + pose;
    if (bodyCache[key]) return Promise.resolve(bodyCache[key]);
    return loadImg(MG.MoleSprites.spriteUrl(pose)).then(function (sprite) {
      var c = mk(CW, CH), x = c.getContext('2d');
      x.drawImage(sprite, 0, 0, CW, CH);
      keyOutHelmet(x);
      if (BODY_TINT[bodyId]) tint(x, BODY_TINT[bodyId]);
      bodyCache[key] = c;
      return c;
    });
  }
  // 빨간 헬멧 제거 → 털 갈색. 밝은/어두운 빨강 다 잡도록 비율 기준 (slice 스크립트와 동일 계열).
  function keyOutHelmet(ctx) {
    var im = ctx.getImageData(0, 0, CW, CH), d = im.data;
    for (var i = 0; i < d.length; i += 4) {
      var r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      if (a > 20 && r > 90 && r > g * 1.55 && r > b * 1.45) {
        // 밝기 유지한 채 색만 갈색으로 (평평해 보이지 않게)
        var lum = (r + g + b) / 3;
        d[i] = Math.min(255, lum * 1.15 + 40);
        d[i + 1] = Math.min(255, lum * 0.82 + 26);
        d[i + 2] = Math.min(255, lum * 0.58 + 14);
      }
    }
    ctx.putImageData(im, 0, 0);
  }
  function tint(ctx, color, mode) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop'; // 몸 픽셀 위에만
    ctx.fillStyle = color;
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, CW, CH);
    ctx.restore();
    void mode;
  }

  // ---------- 얼굴 = 머리 (원형+페더+색감, 몸통 위에 얹힘) ----------
  // headGeom: 얼굴 원 중심·반지름. 두더지 머리(헬멧 자리 포함)를 덮는다.
  function headGeom(a) {
    return { cx: a.cx * CW, cy: (a.cy - a.r * 0.30) * CH, r: a.r * CW * 1.24 };
  }
  function faceLayer(faceImg, a) {
    var G = headGeom(a);
    var size = Math.round(G.r * 2);
    var pf = mk(size, size), px = pf.getContext('2d');
    var s = Math.min(faceImg.width, faceImg.height);
    px.drawImage(faceImg, (faceImg.width - s) / 2, (faceImg.height - s) / 2, s, s, 0, 0, size, size);
    px.globalCompositeOperation = 'saturation';
    px.fillStyle = 'hsl(0,0%,50%)'; px.globalAlpha = 1 - DESAT; px.fillRect(0, 0, size, size);
    px.globalAlpha = 1; px.globalCompositeOperation = 'source-over';
    px.fillStyle = WARM; px.fillRect(0, 0, size, size);
    px.globalCompositeOperation = 'destination-in';
    var gr = size / 2;
    var g = px.createRadialGradient(gr, gr, gr * (1 - FEATHER), gr, gr, gr);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    px.fillStyle = g; px.fillRect(0, 0, size, size);

    var fl = mk(CW, CH), fx = fl.getContext('2d');
    fx.drawImage(pf, G.cx - G.r, G.cy - G.r, size, size);
    return { canvas: fl, cx: G.cx, cy: G.cy, r: G.r };
  }

  // ---------- 모자 / 안경 (임시 도형, 얼굴 원 기준 배치) ----------
  function drawHat(hatId, a) {
    var c = mk(CW, CH), x = c.getContext('2d');
    if (!hatId || hatId === 'none') return c;
    var G = headGeom(a);
    var hx = G.cx, hw = G.r * 2.2, hy = G.cy - G.r * 0.72; // 머리 위쪽
    x.save();
    if (hatId === 'helmet' || hatId === 'hardhat') {
      x.fillStyle = '#d23c2e'; x.beginPath();
      x.ellipse(hx, hy + hw * 0.16, hw * 0.5, hw * 0.34, 0, Math.PI, 0); x.fill();
      x.fillRect(hx - hw * 0.5, hy + hw * 0.14, hw, hw * 0.06);
    } else if (hatId === 'cap') {
      x.fillStyle = '#2b6cb0'; x.beginPath();
      x.ellipse(hx, hy + hw * 0.2, hw * 0.42, hw * 0.3, 0, Math.PI, 0); x.fill();
      x.beginPath(); x.ellipse(hx + hw * 0.28, hy + hw * 0.24, hw * 0.36, hw * 0.1, 0, 0, Math.PI * 2); x.fill();
    } else if (hatId === 'party') {
      x.fillStyle = '#e14bd0'; x.beginPath();
      x.moveTo(hx, hy - hw * 0.35); x.lineTo(hx - hw * 0.3, hy + hw * 0.22); x.lineTo(hx + hw * 0.3, hy + hw * 0.22); x.closePath(); x.fill();
      x.fillStyle = '#ffd93b'; x.beginPath(); x.arc(hx, hy - hw * 0.35, hw * 0.08, 0, 7); x.fill();
    } else if (hatId === 'crown') {
      x.fillStyle = '#f2c14e'; x.beginPath();
      x.moveTo(hx - hw * 0.4, hy + hw * 0.2);
      x.lineTo(hx - hw * 0.4, hy - hw * 0.05); x.lineTo(hx - hw * 0.2, hy + hw * 0.08);
      x.lineTo(hx, hy - hw * 0.14); x.lineTo(hx + hw * 0.2, hy + hw * 0.08);
      x.lineTo(hx + hw * 0.4, hy - hw * 0.05); x.lineTo(hx + hw * 0.4, hy + hw * 0.2);
      x.closePath(); x.fill();
    }
    x.restore();
    return c;
  }
  function drawGlasses(gId, a) {
    var c = mk(CW, CH), x = c.getContext('2d');
    if (!gId || gId === 'none') return c; // 안경 없어도 OK
    var G = headGeom(a);
    var ex = G.cx, ey = G.cy - G.r * 0.06, ew = G.r * 0.9, gap = ew * 0.52; // 얼굴 원 눈높이
    x.save();
    x.lineWidth = ew * 0.14;
    if (gId === 'sun') {
      x.fillStyle = 'rgba(20,20,25,0.85)';
      x.beginPath(); x.ellipse(ex - gap, ey, ew * 0.5, ew * 0.42, 0, 0, 7); x.ellipse(ex + gap, ey, ew * 0.5, ew * 0.42, 0, 0, 7); x.fill();
    } else if (gId === 'round' || gId === 'monocle') {
      x.strokeStyle = gId === 'monocle' ? '#d9a441' : '#333';
      x.beginPath(); x.arc(ex + gap, ey, ew * 0.46, 0, 7); x.stroke();
      if (gId === 'round') { x.beginPath(); x.arc(ex - gap, ey, ew * 0.46, 0, 7); x.stroke(); x.beginPath(); x.moveTo(ex - gap + ew * 0.46, ey); x.lineTo(ex + gap - ew * 0.46, ey); x.stroke(); }
    } else if (gId === 'goggle') {
      x.strokeStyle = '#7a5a30'; x.fillStyle = 'rgba(140,200,235,0.55)';
      x.beginPath(); x.ellipse(ex - gap, ey, ew * 0.52, ew * 0.44, 0, 0, 7); x.ellipse(ex + gap, ey, ew * 0.52, ew * 0.44, 0, 0, 7); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(ex - gap + ew * 0.5, ey); x.lineTo(ex + gap - ew * 0.5, ey); x.stroke();
    }
    x.restore();
    return c;
  }

  // ---------- 한 포즈 합성: 몸통 + 얼굴(머리) + 안경 + 모자 ----------
  function composePose(faceImg, costume, pose) {
    var a = MG.MoleSprites.headAnchor(pose);
    return bodyCanvas(costume.body, pose).then(function (bodyC) {
      var c = mk(CW, CH), ctx = c.getContext('2d');
      var f = faceLayer(faceImg, a);
      // 1) 몸통
      ctx.drawImage(bodyC, 0, 0);
      // 2) 얼굴(머리) — 몸 실루엣에 클립해 두더지 밖으로 안 나가게
      var fclip = mk(CW, CH), fcx = fclip.getContext('2d');
      fcx.drawImage(f.canvas, 0, 0);
      fcx.globalCompositeOperation = 'destination-in';
      fcx.drawImage(bodyC, 0, 0);
      ctx.drawImage(fclip, 0, 0);
      // 3) 이음새 안쪽 그림자
      ctx.save();
      ctx.beginPath(); ctx.arc(f.cx, f.cy, f.r, 0, Math.PI * 2); ctx.clip();
      var sg = ctx.createRadialGradient(f.cx, f.cy, f.r * 0.62, f.cx, f.cy, f.r);
      sg.addColorStop(0, 'rgba(0,0,0,0)');
      sg.addColorStop(1, 'rgba(30,16,8,' + SEAM + ')');
      ctx.fillStyle = sg; ctx.fillRect(f.cx - f.r, f.cy - f.r, f.r * 2, f.r * 2);
      ctx.restore();
      // 4) 볼털 링 — 두더지 털을 얼굴 바깥 가장자리에 다시 덮어 경계 가림
      var mask = mk(CW, CH), mc = mask.getContext('2d');
      var rg = mc.createRadialGradient(f.cx, f.cy, f.r * (1 - FUR_RING), f.cx, f.cy, f.r * 1.05);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,1)');
      mc.fillStyle = rg; mc.fillRect(0, 0, CW, CH);
      var ring = mk(CW, CH), rc = ring.getContext('2d');
      rc.drawImage(bodyC, 0, 0); rc.globalCompositeOperation = 'destination-in'; rc.drawImage(mask, 0, 0);
      ctx.drawImage(ring, 0, 0);
      // 5) 안경 → 6) 모자
      ctx.drawImage(drawGlasses(costume.glasses, a), 0, 0);
      ctx.drawImage(drawHat(costume.hat, a), 0, 0);
      return c;
    });
  }

  // ---------- 공개 API ----------
  function build(faceSrc, costume) {
    costume = MG.Costume.normalize(costume);
    return loadImg(faceSrc).then(function (faceImg) {
      return Promise.all(POSES.map(function (pose) {
        return composePose(faceImg, costume, pose).then(toURL).then(function (u) { return [pose, u]; });
      })).then(function (pairs) {
        var map = {}; pairs.forEach(function (p) { map[p[0]] = p[1]; }); return map;
      });
    });
  }
  function buildOne(faceSrc, costume, pose) {
    costume = MG.Costume.normalize(costume);
    return loadImg(faceSrc).then(function (f) { return composePose(f, costume, pose || 'mole1').then(toURL); });
  }
  // 합성 애니메이션용 — 한 포즈의 4레이어를 따로
  function layers(faceSrc, costume, pose) {
    costume = MG.Costume.normalize(costume);
    pose = pose || 'mole1';
    var a = MG.MoleSprites.headAnchor(pose);
    return Promise.all([loadImg(faceSrc), bodyCanvas(costume.body, pose)]).then(function (r) {
      var faceImg = r[0], bodyC = r[1];
      var fl = faceLayer(faceImg, a);
      return Promise.all([
        toURL(bodyC),
        toURL(fl.canvas),
        toURL(drawHat(costume.hat, a)),
        toURL(drawGlasses(costume.glasses, a))
      ]).then(function (u) { return { body: u[0], face: u[1], hat: u[2], glasses: u[3] }; });
    });
  }
  function revoke(map) {
    if (!map) return;
    Object.keys(map).forEach(function (k) { URL.revokeObjectURL(map[k]); });
  }

  var api = { build: build, buildOne: buildOne, layers: layers, revoke: revoke, POSES: POSES };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.MoleComposite = api; }
})(typeof window !== 'undefined' ? window : null);
