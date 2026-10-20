(function (root) {
  'use strict';
  function sample(seconds, fps, count, offset) {
    var phase = ((seconds * fps + (offset || 0)) % count + count) % count;
    var first = Math.floor(phase);
    var blend = phase - first;
    // Ease atlas changes gently so independent generated silhouettes do not
    // appear to snap at every cel boundary.
    blend = blend * blend * (3 - 2 * blend);
    // Close the loop over the last two cel intervals. The atlases were not
    // authored as perfect cycles, so fade the first cel in before wraparound.
    var seamStart = Math.max(0, count - 2), seam = phase > seamStart ? (phase - seamStart) / (count - seamStart) : 0;
    seam = seam * seam * (3 - 2 * seam);
    return { first: first, next: (first + 1) % count, blend: blend, seam: seam };
  }
  // V1329 C 폰 실측: 모드 전환 직후 1초간 20fps대·최장 200ms(프로 최악). 전환마다 아틀라스·SVG 마스크를 새로 받고
  // 마스크(수천 rect+blur)를 다시 래스터화했기 때문 → 그림과 래스터 결과를 모듈 전역에 캐시해 처음 한 번만, 그것도 미리(warm) 해 둔다.
  var imageCache = {}, maskRasterCache = {};
  function loadImage(src) {
    if (!imageCache[src]) imageCache[src] = new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { (image.decode ? image.decode().catch(function () {}) : Promise.resolve()).then(function () { resolve(image); }); };
      image.onerror = function () { delete imageCache[src]; reject(new Error('Fluid asset: ' + src)); };
      image.src = src;
    });
    return imageCache[src];
  }
  function maskRaster(mask, w, h) {
    var key = mask.src + '|' + w + 'x' + h;
    if (!maskRasterCache[key]) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(mask, 0, 0, w, h);
      maskRasterCache[key] = c;
    }
    return maskRasterCache[key];
  }
  // 안 보이는 동안 미리 준비: 그림 받기 + 그 크기 마스크 래스터화
  function warm(scene, w, h) {
    if (!scene || !w || !h) return Promise.resolve();
    return Promise.all([loadImage(scene.atlas), loadImage(scene.mask)]).then(function (a) { maskRaster(a[1], w, h); }).catch(function () {});
  }
  function canvasSizeFor(rect) {
    var ratio = Math.min(root.devicePixelRatio || 1, 1.5);
    return [Math.max(1, Math.round(rect.width * ratio)), Math.max(1, Math.round(rect.height * ratio))];
  }
  function create(canvas, options) {
    if (!canvas) return null;
    var ctx = canvas.getContext('2d'), host = options.root;
    var scene = null, atlas = null, mask = null, ticket = 0;
    var frameId = 0, elapsed = 0, last = 0, paintedAt = -Infinity, paused = false;
    var reduced = root.matchMedia('(prefers-reduced-motion: reduce)');
    var observer, resizeObserver;
    function visible() { return !host.hidden && !document.hidden && canvas.clientWidth > 0; }
    function stop() { if (frameId) root.cancelAnimationFrame(frameId); frameId = 0; last = 0; }
    function resize() {
      var size = canvasSizeFor(canvas.getBoundingClientRect()), width = size[0], height = size[1];
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      if (scene && atlas && mask) paint();
    }
    function drawCell(index, zone, alpha) {
      var cellWidth = atlas.naturalWidth / scene.columns, cellHeight = atlas.naturalHeight / scene.rows;
      var crop = scene.crop || [0, 0, 1, 1];
      ctx.globalAlpha = alpha * (zone.opacity === undefined ? scene.opacity : zone.opacity);
      // V1326 C zone.clip = 앞 그림에 안 가려지는 부분만(분수 [x0,y0,x1,y1]) 그림 — 같은 모습, 그리는 면적만 줄임
      var c = zone.clip || [0, 0, 1, 1];
      ctx.drawImage(atlas, (index % scene.columns + crop[0] + c[0] * crop[2]) * cellWidth,
        (Math.floor(index / scene.columns) + crop[1] + c[1] * crop[3]) * cellHeight,
        (c[2] - c[0]) * crop[2] * cellWidth, (c[3] - c[1]) * crop[3] * cellHeight,
        zone.x + (scene.alignX ? scene.alignX[index] * zone.width : 0) + c[0] * zone.width,
        zone.y + (scene.alignY ? scene.alignY[index] * zone.height : 0) + c[1] * zone.height, (c[2] - c[0]) * zone.width, (c[3] - c[1]) * zone.height);
    }
    function paint() {
      if (!scene || !atlas || !mask) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(canvas.width / 941, 0, 0, canvas.height / 1672, 0, 0);
      // Add weighted premultiplied frames to avoid a dark dip at crossfade midpoints.
      ctx.globalCompositeOperation = 'lighter';
      scene.zones.forEach(function (zone) {
        var frame = sample(elapsed, scene.fps, scene.columns * scene.rows, zone.phase);
        var loopWeight = 1 - frame.seam;
        drawCell(frame.first, zone, (1 - frame.blend) * loopWeight);
        drawCell(frame.next, zone, frame.blend * loopWeight);
        if (frame.seam > 0) drawCell(0, zone, frame.seam);
      });
      // A source-aligned liquid mask keeps every moving pixel off the rocks/entrances.
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'destination-in';
      // V1326 C: SVG 마스크(수천 개 사각형+블러)를 매 프레임 다시 그리던 것이 노말·프로 버벅임의 주원인 → 캔버스 크기별로 한 번만 래스터화해 재사용
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(maskRaster(mask, canvas.width, canvas.height), 0, 0);
      // V1330 C 뒷 배경 brightness(.55) 를 그림에 구우면서 부모 CSS filter 제거 → 뒷 유체도 같은 만큼 어둡게(scene.dim)
      if (scene.dim) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(0,0,0,' + scene.dim + ')'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.globalCompositeOperation = 'source-over';
    }
    function tick(now) {
      frameId = 0;
      if (!scene || !atlas || !mask || paused || reduced.matches || !visible()) { last = 0; return; }
      if (last) elapsed += Math.min((now - last) / 1000, .15);
      last = now;
      if (now - paintedAt >= 1000 / 30) { paint(); paintedAt = now; }
      frameId = root.requestAnimationFrame(tick);
    }
    function resume() {
      if (scene && atlas && mask && !paused && !reduced.matches && visible() && !frameId) {
        last = 0; frameId = root.requestAnimationFrame(tick);
      }
    }
    function visibility() { if (!visible() || paused || reduced.matches) stop(); else resume(); }
    async function setScene(next) {
      if (next === scene) return;
      var version = ++ticket;
      stop(); scene = next; atlas = mask = null; elapsed = 0;
      canvas.hidden = !next;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      delete canvas.dataset.fluidError;
      if (!next) return;
      try {
        var assets = await Promise.all([loadImage(next.atlas), loadImage(next.mask)]);
        if (version !== ticket) return;
        atlas = assets[0]; mask = assets[1]; resize(); paint(); resume();
      } catch (error) {
        if (version === ticket) { canvas.dataset.fluidError = error.message; canvas.hidden = true; }
      }
    }
    if (root.MutationObserver) {
      observer = new MutationObserver(visibility);
      observer.observe(host, { attributes: true, attributeFilter: ['hidden', 'class'] });
    }
    if (root.ResizeObserver) { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas); }
    document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', visibility);
    root.addEventListener('resize', resize);
    return {
      setScene: setScene,
      pause: function (value) { paused = !!value; visibility(); },
      restart: function () { elapsed = 0; last = 0; paint(); resume(); },
      destroy: function () {
        ++ticket; stop();
        if (observer) observer.disconnect(); if (resizeObserver) resizeObserver.disconnect();
        document.removeEventListener('visibilitychange', visibility);
        reduced.removeEventListener('change', visibility); root.removeEventListener('resize', resize);
      }
    };
  }
  var api = { create: create, sample: sample, warm: warm, canvasSizeFor: canvasSizeFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.RoundMapFluids = api; }
})(typeof window !== 'undefined' ? window : null);
