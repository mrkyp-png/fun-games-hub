/* One resumable foreground queue. Completed responses survive reloads. */
(function (root) {
  'use strict';
  root.prepareMoleAssets = async function (options) {
    var cache = root.caches ? await root.caches.open('mole-game-v1466-G') : null;
    var report = options.report || function () {};
    var sleep = options.sleep || function (ms) {
      return new Promise(function (resolve) {
        var timer = setTimeout(finish, ms);
        function finish() { clearTimeout(timer); root.removeEventListener('online', finish); resolve(); }
        root.addEventListener('online', finish, { once: true });
      });
    };
    async function download(url) {
      var controller = new AbortController();
      // Reset on each chunk: slow progress is allowed; a stalled request is retried.
      var timer;
      function touch() { clearTimeout(timer); timer = setTimeout(function () { controller.abort(); }, 45000); }
      touch();
      try {
        var response = await fetch(url, { signal: controller.signal, headers: { 'X-Mole-Asset-Preparation': '1' } });
        if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + url);
        if (!response.body || !response.body.getReader) {
          var blob = await response.blob();
          return new Response(blob, { headers: response.headers });
        }
        var reader = response.body.getReader(), chunks = [];
        while (true) {
          var part = await reader.read();
          if (part.done) break;
          chunks.push(part.value); touch();
          report({ phase: 'receiving', url: url, bytes: part.value.byteLength });
        }
        return new Response(new Blob(chunks), { headers: response.headers });
      } finally { clearTimeout(timer); }
    }
    async function retry(operation, url) {
      var attempts = 0;
      while (true) {
        try { return await operation(); }
        catch (error) {
          report({ phase: 'retry', url: url, error: String(error) });
          await sleep(Math.min(30000, 1000 * Math.pow(2, Math.min(attempts++, 5))));
        }
      }
    }
    var manifestUrl = new URL('assets/game-image-manifest-v1470.json', location.href).href;
    var manifest = await retry(async function () {
      var response = cache && await cache.match(manifestUrl);
      if (!response) response = await download(manifestUrl);
      var list = await response.clone().json();
      if (!Array.isArray(list) || !list.length || list.some(function (p) { return typeof p !== 'string'; })) throw new Error('Invalid image manifest');
      if (cache) await cache.put(manifestUrl, response);
      return list;
    }, manifestUrl);
    var urls = Array.from(new Set(manifest.concat(options.extra || []).map(function (path) {
      return new URL(path, location.href).href;
    }))).filter(function (url) { return new URL(url).origin === location.origin; });
    var pending = [], done = 0;
    for (var url of urls) {
      if (cache && await cache.match(url, { ignoreSearch: true })) done++;
      else pending.push(url);
    }
    report({ phase: 'progress', done: done, total: urls.length });
    // Each successful file is committed independently. Failed files go to the tail.
    var failures = 0;
    while (pending.length) {
      var current = pending.shift();
      try {
        var response = await download(current);
        if (/\.(png|jpe?g|webp|gif|svg)(?:$|\?)/i.test(current)) {
          var blob = await response.clone().blob();
          var objectUrl = URL.createObjectURL(blob);
          try {
            await new Promise(function (resolve, reject) {
              var image = new Image();
              image.onload = function () { resolve(); };
              image.onerror = function () { reject(new Error('Invalid image: ' + current)); };
              image.src = objectUrl;
            });
          } finally { URL.revokeObjectURL(objectUrl); }
        }
        if (cache) await cache.put(current, response);
        done++; failures = 0;
        report({ phase: 'progress', done: done, total: urls.length });
      } catch (error) {
        pending.push(current); failures++;
        report({ phase: 'retry', done: done, total: urls.length, url: current, error: String(error) });
        await sleep(Math.min(30000, 1000 * Math.pow(2, Math.min(failures - 1, 5))));
      }
    }
    report({ phase: 'complete', done: done, total: urls.length });
  };
})(window);
