(function () {
  'use strict';
  var script = document.currentScript;
  var base = new URL('../assets/rhythm/type-lights-v1569/', script.src);
  var root = document.getElementById('rhythm-screen');
  var panel = root && root.querySelector('[data-rp-types]');
  if (!panel) return;
  var selections = [panel, root.querySelector('[data-rp-songs]'), root.querySelector('[data-rp-select]')].filter(Boolean);
  // Preserve the original ::after flowers/leaves; the rim sweep sits below them.
  selections.forEach(function (selection) {
    var card = selection.querySelector('.rx-card');
    if (!card || card.querySelector('.rp-selection-frame-light')) return;
    var rim = document.createElement('i');
    rim.className = 'rp-selection-frame-light';
    rim.setAttribute('aria-hidden', 'true');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('focusable', 'false');
    var edge = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    edge.setAttribute('x', '7'); edge.setAttribute('y', '7');
    edge.setAttribute('rx', '14'); edge.setAttribute('fill', 'none');
    edge.setAttribute('pathLength', '100');
    svg.appendChild(edge); rim.appendChild(svg);
    card.appendChild(rim);
  });

  var canvas = document.createElement('canvas');
  canvas.className = 'rp-type-lighting';
  canvas.setAttribute('aria-hidden', 'true');
  panel.insertBefore(canvas, panel.firstChild);
  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  // Only translucent beams cross the cards. Hardware and scenery remain behind them.
  var front = document.createElement('canvas');
  front.className = 'rp-type-lighting rp-type-lighting-front';
  front.setAttribute('aria-hidden', 'true');
  panel.appendChild(front);
  var frontCtx = front.getContext('2d', { alpha: true });
  var mask = document.createElement('canvas');
  var maskCtx = mask.getContext('2d');
  var lit = document.createElement('canvas');
  var litCtx = lit.getContext('2d');
  var W = 941, H = 1672, scale = 1, ox = 0, oy = 0;
  var ready = false, frame = 0, lastDraw = -100, elapsed = 0, previous = 0;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var images = {};
  var keys = ['stage-dark', 'mount', 'heads-six-poses', 'beams-four', 'stars-eight'];
  var lamps = [
    { x: 98, y: 98, phase: 0, speed: .27, beam: 0, star: 1 },
    { x: 842, y: 98, phase: 2.1, speed: .22, beam: 2, star: 3 }
  ];
  // Measured on the shipped WebP atlases, in CELL pixels (not sheet pixels).
  // Each bright lens center, beam apex and lens highlight shares one emitter point.
  var calibration = {
    "headCell": [256, 256],
    "heads": [
      [161, 55, 116.51, 182.14], [128, 51, 127.55, 192.35], [97, 55, 137.78, 182.45],
      [161, 55, 112.27, 170.52], [128, 49, 127.50, 183.26], [98, 49, 142.57, 170.90]
    ],
    "beamCell": [384, 384],
    "beams": [[202.22, 61.46, 352], [181.42, 64.67, 352], [202.42, 40.54, 321], [181.31, 39.72, 324]],
    "mountHinge": [64, 246],
    "emitterDistance": 35
  };
  var stars = [
    [292,21,6,0], [354,38,5,1.8], [401,11,8,2.7], [455,53,6,.7],
    [509,24,7,3.1], [556,46,5,2], [605,14,8,4], [660,31,6,1.1],
    [374,60,4,3.7], [490,6,5,2.3], [580,65,4,.2], [701,13,5,4.4]
  ];

  function visible() {
    return ready && !root.hidden && !panel.hidden &&
      selections.every(function (p) { return p === panel || p.hidden; }) && !document.hidden;
  }
  function setDesignTransform(c) { c.setTransform(scale, 0, 0, scale, ox, oy); }
  function clear(c) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height); }

  function resize() {
    var bounds = panel.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    // A bounded backing store and 30 fps keep the decorative scene cheap on phones.
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var width = Math.max(1, Math.round(bounds.width * dpr));
    var height = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width === width && canvas.height === height && lit.width === width) return;
    canvas.width = front.width = mask.width = lit.width = width;
    canvas.height = front.height = mask.height = lit.height = height;
    scale = Math.max(width / W, height / H);
    ox = (width - W * scale) / 2;
    oy = (height - H * scale) / 2;
    if (!ready) return;
    setDesignTransform(litCtx);
    litCtx.filter = 'brightness(2.5) saturate(1.12)';
    litCtx.drawImage(images['stage-dark'], 0, 0, W, H);
    litCtx.filter = 'none';
    render(elapsed);
  }

  function lampState(lamp, t, index) {
    var targetX = index === 0
      ? 545 + 295 * Math.sin(t * lamp.speed + lamp.phase)
      : 395 + 305 * Math.sin(t * lamp.speed + lamp.phase);
    var targetY = 1455 + 65 * Math.sin(t * .19 + index * 2.2);
    var dx = targetX - lamp.x, dy = targetY - lamp.y;
    var distance = Math.hypot(dx, dy), ux = dx / distance, uy = dy / distance;
    return {
      lamp: lamp, targetX: targetX, targetY: targetY,
      angle: Math.atan2(dy, dx), aim: Math.atan2(dx, dy),
      x: lamp.x + ux * calibration.emitterDistance, y: lamp.y + uy * calibration.emitterDistance,
      distance: distance - calibration.emitterDistance,
      width: 235 + 32 * Math.sin(t * .31 + index),
      intensity: .83 + .1 * Math.sin(t * .43 + lamp.phase),
      pitch: .5 + .45 * Math.sin(t * .29 + lamp.phase)
    };
  }

  function drawBeam(c, state, opacity) {
    var sprite = images['beams-four'];
    var sw = sprite.width / 2, sh = sprite.height / 2;
    var cell = state.lamp.beam;
    var anchor = calibration.beams[cell];
    var apexX = anchor[0] / calibration.beamCell[0];
    var apexY = anchor[1] / calibration.beamCell[1];
    var footY = anchor[2] / calibration.beamCell[1];
    var height = state.distance / (footY - apexY);
    c.save();
    c.translate(state.x, state.y);
    c.rotate(state.angle - Math.PI / 2);
    // Atlas glow above its apex must not leak backwards over the lamp housing.
    c.beginPath(); c.rect(-state.width, 0, state.width * 2, height); c.clip();
    c.globalAlpha = opacity * state.intensity;
    c.drawImage(sprite, (cell % 2) * sw, Math.floor(cell / 2) * sh, sw, sh,
      -state.width * apexX, -height * apexY, state.width, height);
    c.restore();
  }

  function drawStar(c, cell, x, y, width, height, opacity) {
    var sprite = images['stars-eight'];
    var sw = sprite.width / 4, sh = sprite.height / 2;
    c.save(); c.globalAlpha = opacity;
    c.drawImage(sprite, (cell % 4) * sw, Math.floor(cell / 4) * sh, sw, sh,
      x - width / 2, y - height / 2, width, height);
    c.restore();
  }

  // Per-frame hinge and lens anchors keep the emitter on the turning head's lens.
  function headFrame(c, index, state, alpha) {
    if (alpha < .005) return;
    var sprite = images['heads-six-poses'], sw = sprite.width / 3, sh = sprite.height / 2;
    var p = calibration.heads[index];
    var px = p[0] * sw / calibration.headCell[0], py = p[1] * sh / calibration.headCell[1];
    var lx = p[2] * sw / calibration.headCell[0], ly = p[3] * sh / calibration.headCell[1];
    var size = calibration.emitterDistance / Math.hypot(lx - px, ly - py);
    var rotation = state.angle - Math.atan2(ly - py, lx - px);
    c.save();
    c.translate(state.lamp.x, state.lamp.y);
    c.rotate(rotation);
    c.globalAlpha = alpha;
    c.filter = 'brightness(.72) saturate(.85)';
    c.drawImage(sprite, (index % 3) * sw, Math.floor(index / 3) * sh, sw, sh,
      -px * size, -py * size, sw * size, sh * size);
    c.restore();
  }

  function drawMachine(c, state) {
    c.save(); c.filter = 'brightness(.62) saturate(.85)';
    var mountScale = 24 / images.mount.width;
    c.drawImage(images.mount, state.lamp.x - calibration.mountHinge[0] * mountScale,
      state.lamp.y - calibration.mountHinge[1] * mountScale,
      images.mount.width * mountScale, images.mount.height * mountScale);
    c.restore();
    var yaw = Math.max(-1, Math.min(1, state.aim / .48));
    var outer = yaw < 0 ? 0 : 2, blend = Math.abs(yaw);
    headFrame(c, 1, state, (1 - blend) * (1 - state.pitch));
    headFrame(c, outer, state, blend * (1 - state.pitch));
    headFrame(c, 4, state, (1 - blend) * state.pitch);
    headFrame(c, outer + 3, state, blend * state.pitch);
    c.save(); c.globalCompositeOperation = 'screen';
    drawStar(c, state.lamp.star, state.x, state.y, 22, 22, .6);
    c.restore();
  }

  function render(t) {
    if (!ready || !canvas.width || !canvas.height) return;
    clear(ctx); clear(maskCtx); clear(frontCtx);
    var states = lamps.map(function (lamp, index) { return lampState(lamp, t, index); });
    setDesignTransform(maskCtx);
    // The beam alpha reveals a brighter copy of this SAME backdrop. Only hit areas brighten.
    states.forEach(function (state) { drawBeam(maskCtx, state, .8); });
    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskCtx.globalCompositeOperation = 'source-in';
    maskCtx.drawImage(lit, 0, 0);
    maskCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(mask, 0, 0);
    setDesignTransform(ctx);
    setDesignTransform(frontCtx);
    states.forEach(function (state) { drawBeam(frontCtx, state, .2); });
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    states.forEach(function (state) {
      drawStar(ctx, state.lamp.beam === 0 ? 4 : 5, state.targetX, state.targetY,
        state.width * 1.25, 75, .33 * state.intensity);
    });
    // Twinkles stay inside the upper sky opening, away from the selection card.
    ctx.save(); ctx.beginPath(); ctx.ellipse(470, -20, 285, 105, 0, 0, Math.PI * 2); ctx.clip();
    stars.forEach(function (star, i) {
      var twinkle = .13 + .7 * Math.pow((Math.sin(t * (1.1 + i % 3 * .17) + star[3]) + 1) / 2, 3);
      drawStar(ctx, i % 4, star[0], star[1], star[2] * 3, star[2] * 3, twinkle);
    });
    ctx.restore(); ctx.restore();
    states.forEach(function (state) { drawMachine(ctx, state); });
  }

  function tick(now) {
    frame = 0;
    if (!visible() || reduced.matches) { previous = 0; return; }
    if (previous) elapsed += Math.min((now - previous) / 1000, .1);
    previous = now;
    if (now - lastDraw >= 1000 / 30) { render(elapsed); lastDraw = now; }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; previous = 0;
    canvas.hidden = front.hidden = !visible();
    if (!visible()) {
      clear(ctx); clear(frontCtx);
      return;
    }
    resize(); render(elapsed);
    if (!reduced.matches) frame = requestAnimationFrame(tick);
  }

  var observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ['hidden'] });
  selections.forEach(function (p) { observer.observe(p, { attributes: true, attributeFilter: ['hidden'] }); });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', resize, { passive: true });
  if (window.ResizeObserver) {
    var sizeObserver = new ResizeObserver(resize);
    selections.forEach(function (p) { sizeObserver.observe(p); });
  }
  if (reduced.addEventListener) reduced.addEventListener('change', sync);
  else reduced.addListener(sync);

  Promise.all(keys.map(function (key) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        (img.decode ? img.decode() : Promise.resolve()).catch(function () {}).then(function () {
          images[key] = img; resolve();
        });
      };
      img.onerror = reject;
      img.src = new URL(key + '.webp?v=1570-G', base).href;
    });
  })).then(function () {
    ready = true;
    // Geometry is initialized only after the hidden type-selection panel becomes visible.
    canvas.width = canvas.height = 0;
    panel.classList.add('has-type-lighting');
    panel.style.setProperty('--rp-type-dark-stage', 'url("' + new URL('stage-dark.webp?v=1570-G', base).href + '")');
    sync();
  }).catch(function (error) {
    canvas.remove(); front.remove(); observer.disconnect();
    console.warn('Rhythm type lighting assets could not load; original scene retained.', error);
  });

  // Review tools use the actual renderer; no gameplay state is changed.
  window.MG = window.MG || {};
  window.MG.rhythmTypeLighting = {
    ready: function () { return ready; },
    snapshot: function (seconds) { if (frame) cancelAnimationFrame(frame); frame = 0; resize(); render(seconds); },
    resume: sync,
    state: function () { return { ready: ready, running: !!frame, reducedMotion: reduced.matches, width: canvas.width, height: canvas.height }; }
  };
}());
