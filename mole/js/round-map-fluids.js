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
  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('Fluid asset: ' + src)); };
      image.src = src;
    });
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
      var rect = canvas.getBoundingClientRect(), ratio = Math.min(root.devicePixelRatio || 1, 1.5);
      var width = Math.max(1, Math.round(rect.width * ratio));
      var height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      if (scene && atlas && mask) paint();
    }
    function drawCell(index, zone, alpha) {
      var cellWidth = atlas.naturalWidth / scene.columns, cellHeight = atlas.naturalHeight / scene.rows;
      var crop = scene.crop || [0, 0, 1, 1];
      ctx.globalAlpha = alpha * (zone.opacity === undefined ? scene.opacity : zone.opacity);
      ctx.drawImage(atlas, (index % scene.columns + crop[0]) * cellWidth,
        (Math.floor(index / scene.columns) + crop[1]) * cellHeight,
        crop[2] * cellWidth, crop[3] * cellHeight,
        zone.x + (scene.alignX ? scene.alignX[index] * zone.width : 0),
        zone.y + (scene.alignY ? scene.alignY[index] * zone.height : 0), zone.width, zone.height);
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
      ctx.drawImage(mask, 0, 0, 941, 1672);
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
  var api = { create: create, sample: sample };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.RoundMapFluids = api; }
})(typeof window !== 'undefined' ? window : null);
