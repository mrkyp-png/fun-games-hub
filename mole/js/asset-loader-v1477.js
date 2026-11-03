/* Keep the transition cover until artwork is ready; recover failed requests underneath. */
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
            if (absolute(im.getAttribute('src')) === current.url && im.complete && !im.naturalWidth) {
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
        var replacements = [];
        var changed = bg.replace(/url\(["']?([^"')]+)["']?\)/g, function (full, path) {
          var url = absolute(path), task = url && tasks.get(url);
          if (!task || task.state !== 'ready' || task.attempts < 2) return full;
          var fresh = new URL(url); fresh.searchParams.set('_asset_retry', '1582'); replacements.push(fresh.href); return 'url("' + fresh.href + '")';
        });
        if (changed !== bg) {
          refreshed.set(el, bg);
          Promise.all(replacements.map(readyUrl)).then(function () {
            if (!el.isConnected || getComputedStyle(el).backgroundImage !== bg) return;
            el.style.setProperty('background-image', changed, 'important'); refreshed.set(el, changed);
          }).catch(function () { refreshed.delete(el); });
        }
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
        // V1534 C: 플레이 중(game-screen 이 홈 상태가 아닐 때) 두더지·효과 그림 교체는 제외 — 매번 화면 전체 훑기 → 버벅임.
        if (r.type === 'attributes' && r.attributeName === 'src' && el.tagName === 'IMG') return !(screen && screen.id === 'game-screen' && !screen.classList.contains('is-start'));
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
  // V1561 C 사용자: 화면 전환 때 그림이 따로따로 뜨는 문제 — 화면을 가려 둔 채 그 화면의 모든 그림(img·CSS 배경·::before/::after·border-image)을
  // 받아 디코드한 뒤 한 번에 보여준다. 늦어도 maxMs 안에는 보여줘서 화면이 멈추지 않게.
  var revealTicket = new WeakMap();
  function screenUrls(container) {
    var urls = new Set(), imgs = [];
    [container].concat(Array.from(container.querySelectorAll('*'))).forEach(function (el) {
      if (!el.getClientRects().length) return;
      if (!container.classList.contains('shop-pane-staged') && el.closest('.shop-pane-staged')) return;
      if (el.tagName === 'IMG') { if (el.loading === 'lazy') el.loading = 'eager'; imgs.push(el); return; }
      [null, '::before', '::after'].forEach(function (pseudo) {
        var st = getComputedStyle(el, pseudo);
        if (pseudo && (st.content === 'none' || st.content === 'normal' || st.display === 'none')) return;
        [st.backgroundImage, st.borderImageSource, st.maskImage, st.webkitMaskImage].forEach(function (v) {
          var m, re = /url\(["']?([^"')]+)["']?\)/g;
          while ((m = re.exec(v || ''))) { if (absolute(m[1])) urls.add(m[1]); }
        });
      });
    });
    return { urls: Array.from(urls), imgs: imgs };
  }
  function decodeImg(im) { return im.decode ? im.decode().catch(function () {}) : Promise.resolve(); }
  // 한 번 디코드한 그림은 기억해 두고 다시 기다리지 않음(미리 데워 둔 그림 포함)
  var decodedSet = new Set();
  function absUrl(u) { try { return new URL(u, location.href).href; } catch (e) { return u; } }
  function decodeUrl(u) { var a = absUrl(u); if (decodedSet.has(a)) return Promise.resolve(); var im = new Image(); im.decoding = 'async'; im.src = u; return decodeImg(im).then(function () { decodedSet.add(a); }); }
  // 화면 열 때 기다리는 것 = 그림 받기(load)까지만. 디코드까지 기다리면 큰 그림마다 0.5초씩 걸려 덮개가 오래 머묾(V1561 C 실측)
  function loadedImg(im) { return im.complete ? Promise.resolve() : new Promise(function (r) { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); }); }
  function loadedUrl(u) { var a = absUrl(u); if (decodedSet.has(a)) return Promise.resolve(); var im = new Image(); im.src = u; warmRefs.push(im); return loadedImg(im); }
  var decodedWork = new Map();
  function readyImage(img) {
    if (!img.currentSrc && !img.getAttribute('src')) return Promise.resolve();
    img.loading = 'eager';
    function unavailable() {
      var error = new Error('Image unavailable'), source = img.currentSrc || img.getAttribute('src') || '';
      error.asset = /^data:/.test(source) ? '[inline image]' : source;
      return error;
    }
    // Wait for the actual load first. decode() may reject while lazy loading
    // switches requests even though the valid image is still arriving.
    var work = new Promise(function (resolve, reject) {
      if (img.complete) { if (img.naturalWidth) resolve(); else reject(unavailable()); return; }
      function cleanup() { img.removeEventListener('load', loaded); img.removeEventListener('error', failed); }
      function loaded() { cleanup(); if (img.naturalWidth) resolve(); else reject(unavailable()); }
      function failed() { cleanup(); reject(unavailable()); }
      img.addEventListener('load', loaded, {once:true}); img.addEventListener('error', failed, {once:true});
    });
    return work.then(function () { return img.decode ? Promise.resolve().then(function () { return img.decode(); }).catch(function () {}) : null; }).then(function () {
      if (!img.naturalWidth) { if (!img.complete) return readyImage(img); throw unavailable(); }
    });
  }
  function readyUrl(url) {
    var key = absUrl(url);
    if (!decodedWork.has(key)) {
      var image = new Image(); image.src = url; warmRefs.push(image);
      decodedWork.set(key, readyImage(image).catch(function (error) { decodedWork.delete(key); throw error; }));
    }
    return decodedWork.get(key);
  }
  function prepareContent(el) {
    var found = screenUrls(el);
    return bounded(Promise.all(found.imgs.map(readyImage).concat(found.urls.map(readyUrl))), 10000, false).then(function (result) {
      if (result === false) throw new Error('Artwork preparation timed out');
    });
  }
  function preparePaths(paths) {
    return bounded(Promise.all(paths.map(readyUrl)), 10000, false).then(function (result) {
      if (result === false) throw new Error('Core artwork preparation timed out');
    });
  }
  function revealWhenReady(el, maxMs) {
    if (!el) return Promise.resolve();
    var ticket = {}; revealTicket.set(el, ticket);
    var oldError = el.querySelector(':scope > .screen-asset-error'); if (oldError) oldError.remove();
    el.classList.remove('asset-failed', 'glitch-in', 'diagonal-wipe-in', 'asset-pop');
    el.classList.add('asset-preparing');
    return new Promise(function (resolve) {
      var retryTimer = 0, stopPolling = function () {};
      function cancelled() { return el.hidden || revealTicket.get(el) !== ticket; }
      function finish() {
        clearTimeout(retryTimer); stopPolling();
        if (revealTicket.get(el) === ticket) el.classList.remove('asset-preparing');
        resolve();
      }
      function attempt() {
        if (cancelled()) { finish(); return; }
        var found = screenUrls(el), hookFailed = false;
        rememberScreen(el.id, found);
        var work = [prepareContent(el)];
        if (el._moleReady) work.push(Promise.resolve(el._moleReady).catch(function (error) { hookFailed = true; throw error; }));
        if (document.fonts && document.fonts.ready) work.push(document.fonts.ready);
        var models = Array.from(el.querySelectorAll('[data-model-weapon]')).filter(function (host) {
          var box = host.getBoundingClientRect();
          return !host.closest('.shop-pane-staged') && box.width && box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight;
        });
        if (models.length) work.push(new Promise(function (ready, reject) {
          var frame = 0, timer = setTimeout(function () { end(new Error('Model still preparing')); }, 10000);
          function end(error) { clearTimeout(timer); cancelAnimationFrame(frame); stopPolling = function () {}; if (error) reject(error); else ready(); }
          stopPolling = function () { end(); };
          function check() {
            if (cancelled()) { end(); return; }
            if (models.some(function (host) { return host.hasAttribute('data-model-error'); })) { end(new Error('Model retry needed')); return; }
            if (models.every(function (host) { return host.classList.contains('shop-model-ready'); })) { end(); return; }
            frame = requestAnimationFrame(check);
          }
          check();
        }));
        bounded(Promise.all(work), maxMs || 10500, false).then(function (result) {
          if (result === false) throw new Error('Preparation pending');
          return new Promise(function (paint) { requestAnimationFrame(function () { requestAnimationFrame(paint); }); });
        }).then(function () {
          if (cancelled()) { finish(); return; }
          el.classList.remove('asset-preparing');
          if (el._moleOnReveal) el._moleOnReveal();
          if (el.hasAttribute('data-reveal-pop')) { el.classList.add('asset-pop'); setTimeout(function () { el.classList.remove('asset-pop'); }, 320); }
          finish();
        }).catch(function (error) {
          stopPolling();
          if (cancelled()) { finish(); return; }
          el._molePreparationFailure = {message:error && error.message, asset:error && error.asset, at:Date.now()};
          // Keep the original cloud cover. Retry failed resources underneath it;
          // neither an error page nor a timeout is a successful screen reveal.
          found.imgs.forEach(function (image) {
            var url = absolute(image.getAttribute('src'));
            if (!url || !image.complete || image.naturalWidth) return;
            var fresh = new URL(url); fresh.searchParams.set('_asset_retry', Date.now()); image.src = fresh.href;
          });
          if ((hookFailed || models.some(function (host) { return host.hasAttribute('data-model-error'); })) && el._moleRetry) el._moleRetry();
          else if (models.some(function (host) { return host.hasAttribute('data-model-error'); }) && root.MoleGame && root.MoleGame.WeaponModels && root.MoleGame.WeaponModels.retryWithin) root.MoleGame.WeaponModels.retryWithin(el);
          retryTimer = setTimeout(attempt, 400);
        });
      }
      requestAnimationFrame(function () { requestAnimationFrame(attempt); });
    });
  }

  var WARM_KEY = 'mole.warmUrls.v1', warmRefs = [], warmed = false;
  function readWarm() { try { return JSON.parse(localStorage.getItem(WARM_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function rememberScreen(id, found) {
    if (!id) return;
    var list = found.urls.concat(found.imgs.map(function (im) { return im.currentSrc || im.src; })).filter(function (u) { return u && !/^(data|blob):/.test(u); });
    var all = readWarm(); all[id] = Array.from(new Set(list)).slice(0, 300);
    try { localStorage.setItem(WARM_KEY, JSON.stringify(all)); } catch (e) {}
  }
  function staticUrls(container) {
    var urls = [];
    [container].concat(Array.from(container.querySelectorAll('*'))).forEach(function (el) {
      if (el.tagName === 'IMG') { var a = el.getAttribute('src'); if (a && !/^data:/.test(a)) urls.push(a); return; }
      [null, '::before', '::after'].forEach(function (pseudo) {
        var st = getComputedStyle(el, pseudo), m, re = /url\(["']?([^"')]+)["']?\)/g;
        while ((m = re.exec(st.backgroundImage || ''))) { if (!/^data:/.test(m[1])) urls.push(m[1]); }
      });
    });
    return urls;
  }
  function warmScreens(ids) {
    if (warmed) return; warmed = true;
    if (root.MoleGame && root.MoleGame.WeaponModels && root.MoleGame.WeaponModels.preload) root.MoleGame.WeaponModels.preload().catch(function () {});
    var saved = readWarm(), urls = new Set();
    ids.forEach(function (id) {
      (saved[id] || []).forEach(function (u) { urls.add(u); });
      var el = document.getElementById(id); if (el) staticUrls(el).forEach(function (u) { urls.add(u); });
    });
    var list = Array.from(urls), i = 0;
    // 한 번에 4장씩, 쉬는 틈에 — 홈 화면 터치·애니메이션 방해 안 하게
    (function step() {
      if (i >= list.length) return;
      var batch = list.slice(i, i + 4); i += 4;
      Promise.all(batch.map(function (u) { var im = new Image(); im.decoding = 'async'; im.src = u; warmRefs.push(im); return decodeImg(im).then(function () { decodedSet.add(absUrl(u)); }); })).then(function () {
        (root.requestIdleCallback || function (f) { setTimeout(f, 60); })(step, { timeout: 400 });
      });
    })();
  }
  root.prepareMoleAssets = prepare;
  root.MoleAssetLoader = { collect: collect, ensure: ensure, watchScreens: watchScreens, startBackground: startBackground, preparePaths:preparePaths, prepareContent:prepareContent, revealWhenReady: revealWhenReady, warmScreens: warmScreens,
    isReady: function (paths) { return paths.map(absolute).filter(Boolean).every(function (u) { return tasks.get(u) && tasks.get(u).state === 'ready'; }); }
  };
})(window);
