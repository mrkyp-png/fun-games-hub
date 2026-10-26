/* Bounded foreground preparation; optional art never gates launch. */
(function (root) {
  'use strict';
  var tasks = new Map(), pending = [], active = 0, backgroundActive = 0;
  var foreground = 0, backgroundStarted = false, watched = false, cachePromise;
  function bounded(promise, ms, fallback) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { resolve(fallback); }, ms);
      Promise.resolve(promise).then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
    });
  }
  function cacheStore() {
    if (!cachePromise) cachePromise = bounded(root.caches ? root.caches.open('mole-game-v1466-G') : null, 2000, null).catch(function () { return null; });
    return cachePromise;
  }
  function absolute(path) {
    try {
      var u = new URL(path, location.href);
      if (u.origin !== location.origin || !/\.(png|jpe?g|webp|gif|svg)(?:$|\?)/i.test(u.href)) return null;
      u.searchParams.delete('_asset_retry'); return u.href;
    } catch (e) { return null; }
  }
  async function download(url) {
    var controller = new AbortController(), timer;
    var hardTimer = setTimeout(function () { controller.abort(); }, 120000);
    function touch() { clearTimeout(timer); timer = setTimeout(function () { controller.abort(); }, 15000); }
    touch();
    try {
      var r = await fetch(url, { signal: controller.signal, headers: { 'X-Mole-Asset-Preparation': '1' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var blob;
      if (r.body && r.body.getReader) {
        var reader = r.body.getReader(), chunks = [];
        while (true) { var part = await reader.read(); if (part.done) break; chunks.push(part.value); touch(); }
        blob = new Blob(chunks, { type: r.headers.get('Content-Type') || '' });
      } else blob = await r.blob();
      var objectURL = URL.createObjectURL(blob);
      try {
        var im = new Image(); im.src = objectURL;
        if (!await bounded(im.decode().then(function () { return true; }), 4000, false)) throw new Error('decode timeout');
      } finally { URL.revokeObjectURL(objectURL); }
      return new Response(blob, { headers: r.headers });
    } finally { clearTimeout(timer); clearTimeout(hardTimer); }
  }
  async function load(task) {
    var cache = await cacheStore();
    var cached = cache && await bounded(cache.match(task.url, { ignoreSearch: true }), 1500, null).catch(function () { return null; });
    if (!cached) {
      var response = await download(task.url);
      // Storage failure must not redownload a successful file forever.
      if (cache) await bounded(cache.put(task.url, response), 2000, null).catch(function () {});
    }
  }
  function pump() {
    pending.sort(function (a, b) { return b.priority - a.priority; });
    while (active < 3 && pending.length) {
      var index = pending.findIndex(function (t) { return t.priority > 0 || (!foreground && backgroundActive < 1); });
      if (index < 0) return;
      var task = pending.splice(index, 1)[0], bg = task.priority === 0;
      active++; if (bg) backgroundActive++; task.state = 'loading';
      (function (current, wasBackground) {
        load(current).then(function () {
          current.state = 'ready'; current.resolve(true);
          if (root.dispatchEvent) root.dispatchEvent(new Event('mole-assets-updated'));
          document.querySelectorAll('img[src]').forEach(function (im) {
            if (absolute(im.getAttribute('src')) === current.url && (!im.complete || !im.naturalWidth)) {
              var u = new URL(current.url); u.searchParams.set('_asset_retry', Date.now()); im.src = u.href;
            }
          });
        }, function () {
          current.state = 'failed'; current.resolve(false);
          if (current.attempts < 3) setTimeout(function () {
            if (tasks.get(current.url) === current && current.state === 'failed') ensure(current.url, current.priority, true);
          }, 2000 * current.attempts);
        }).finally(function () {
          active--; if (wasBackground) backgroundActive--; pump();
        });
      })(task, bg);
    }
  }
  function ensure(path, priority, retry) {
    var url = absolute(path);
    if (!url) return Promise.resolve(true);
    var task = tasks.get(url);
    var attempts = task ? task.attempts : 0;
    if (task && task.state === 'ready') return Promise.resolve(true);
    if (task && task.state === 'failed' && retry) { tasks.delete(url); task = null; }
    if (!task) {
      task = { url: url, priority: priority || 0, state: 'pending', attempts: attempts + 1 };
      task.promise = new Promise(function (resolve) { task.resolve = resolve; });
      tasks.set(url, task); pending.push(task);
    } else task.priority = Math.max(task.priority, priority || 0);
    pump(); return task.promise;
  }
  function collect(container) {
    var urls = new Set();
    [container].concat(Array.from(container.querySelectorAll('*'))).forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;
      if (getComputedStyle(el).visibility === 'hidden') return;
      if (el.tagName === 'IMG') { var src = absolute(el.getAttribute('src')); if (src) { urls.add(src); el.loading = 'eager'; } }
      [null, '::before', '::after'].forEach(function (pseudo) {
        var s = getComputedStyle(el, pseudo);
        [s.backgroundImage, s.borderImageSource, s.maskImage, s.webkitMaskBoxImageSource].forEach(function (v) {
          var m, re = /url\(["']?([^"')]+)["']?\)/g;
          while ((m = re.exec(v || ''))) { var u = absolute(m[1]); if (u) urls.add(u); }
        });
      });
    });
    return Array.from(urls);
  }
  async function prepare(options) {
    options = options || {};
    var urls = Array.from(new Set((options.required || []).map(absolute).filter(Boolean)));
    var report = options.report || function () {}, done = 0, released = false;
    foreground++;
    var work = urls.map(function (u) { return ensure(u, 2, true).then(function (ok) {
      if (ok) done++; if (!released) report({ phase: 'progress', done: done, total: urls.length }); return ok;
    }); });
    try {
      await bounded(Promise.all(work), options.deadlineMs || 12000, null);
      var missing = urls.filter(function (u) { return !tasks.get(u) || tasks.get(u).state !== 'ready'; });
      released = true;
      report({ phase: missing.length ? 'partial' : 'complete', done: done, total: urls.length, missing: missing });
      Promise.all(work).then(function () { if (done === urls.length && missing.length) report({ phase: 'recovered', done: done, total: urls.length }); });
      return { missing: missing, total: urls.length };
    } finally { foreground--; pump(); }
  }
  function watchScreens() {
    if (watched) return; watched = true;
    var timer = 0, refreshed = new WeakMap();
    function refreshCSS(container) {
      [container].concat(Array.from(container.querySelectorAll('*'))).forEach(function (el) {
        // Round and fever classes own this background; an inline URL freezes it.
        if (el.id === 'mole-board') return;
        // The scan starts at game-screen, so exclude the actual shop subtree.
        if (el.closest('#shop-screen')) return;
        if (!el.getClientRects().length) return;
        var bg = getComputedStyle(el).backgroundImage;
        if (!bg || bg === 'none' || refreshed.get(el) === bg) return;
        var changed = bg.replace(/url\(["']?([^"')]+)["']?\)/g, function (full, path) {
          var url = absolute(path), task = url && tasks.get(url);
          if (!task || task.state !== 'ready') return full;
          var fresh = new URL(url); fresh.searchParams.set('_asset_retry', '1477'); return 'url("' + fresh.href + '")';
        });
        if (changed !== bg) { el.style.setProperty('background-image', changed, 'important'); refreshed.set(el, changed); }
      });
    }
    function scan() {
      timer = 0;
      document.querySelectorAll('.screen:not([hidden])').forEach(function (screen) {
        var urls = collect(screen);
        if (urls.length) Promise.all(urls.map(function (u) { return ensure(u, 1, false); })).then(function () {
          refreshCSS(screen);
        });
      });
    }
    function schedule() { if (!timer) timer = setTimeout(scan, 150); }
    new MutationObserver(function (records) {
      // Gameplay sprite/class churn must not trigger a whole-screen style scan.
      if (records.some(function (r) {
        var el = r.target, screen = el.closest && el.closest('.screen');
        if (r.type === 'attributes' && r.attributeName === 'src' && el.tagName === 'IMG') return true;
        return el.classList && el.classList.contains('screen') || (screen && screen.id !== 'game-screen');
      })) schedule();
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'src', 'class'] });
    root.addEventListener('resize', schedule);
    root.addEventListener('mole-assets-updated', schedule);
    root.addEventListener('online', function () { tasks.forEach(function (t, u) { if (t.state === 'failed') ensure(u, 1, true); }); schedule(); });
    schedule();
  }
  async function startBackground() {
    if (backgroundStarted) return; backgroundStarted = true; watchScreens();
    try {
      var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 5000), list;
      try {
        var response = await fetch('assets/game-image-manifest-v1470.json', { signal: controller.signal, cache: 'no-cache' });
        if (!response.ok) throw new Error('manifest'); list = await response.json();
      } finally { clearTimeout(timer); }
      if (Array.isArray(list)) list.forEach(function (path) { ensure(path, 0, false); });
    } catch (e) { /* Optional manifest failure cannot hold launch or screen entry. */ }
  }
  root.prepareMoleAssets = prepare;
  root.MoleAssetLoader = { collect: collect, ensure: ensure, watchScreens: watchScreens, startBackground: startBackground,
    isReady: function (paths) { return paths.map(absolute).filter(Boolean).every(function (u) { return tasks.get(u) && tasks.get(u).state === 'ready'; }); }
  };
})(window);
