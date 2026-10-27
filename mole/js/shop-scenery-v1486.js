(function (root) {
  'use strict';
  var MG = root.MoleGame = root.MoleGame || {};
  var PICTURES = { day: 'assets/shop-background-v1486/day.jpg', night: 'assets/shop-background-v1486/night.jpg' };
  var CLOUD = 'M27 50C8 50 7 29 25 26C27 8 53 5 63 19C74 0 108 5 112 26C137 18 153 32 145 44C142 49 135 50 125 50Z';

  function themeAt(date) { return Math.floor(date.getHours() / 4) % 2 === 0 ? 'day' : 'night'; }
  function nextChangeAt(date) {
    var next = new Date(date.getTime());
    next.setHours((Math.floor(date.getHours() / 4) + 1) * 4, 0, 0, 0);
    return next.getTime();
  }

  function create(el) {
    var picture = el.querySelector('.shop-scenery');
    var sky = el.querySelector('.shop-sky');
    var active = false, timer = null, request = 0, images = {}, starsReady = false;
    var clouds = document.createElement('div'), stars = document.createElement('div');
    clouds.className = 'shop-cloud-field'; stars.className = 'shop-star-field';
    sky.textContent = ''; sky.appendChild(clouds); sky.appendChild(stars);
    [[4,29,54,-6,5],[18,21,67,-31,28],[32,35,83,-49,52],[47,19,61,-17,76],[63,28,93,-70,15],[78,23,77,-40,65]].forEach(function (p) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 160 60'); svg.setAttribute('class', 'shop-cloud');
      svg.style.cssText = '--cloud-top:' + p[0] + '%;--cloud-size:' + p[1] + 'cqw;--cloud-time:' + p[2] + 's;--cloud-delay:' + p[3] + 's;--cloud-rest:' + p[4] + 'cqw';
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', CLOUD); svg.appendChild(path); clouds.appendChild(svg);
    });
    function createStars() {
      if (starsReady) return;
      starsReady = true;
      var seed = 1486;
      function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
      for (var i = 0; i < 108; i++) {
        var star = document.createElement('i');
        star.className = 'shop-night-star' + (i % 7 === 0 ? ' shop-night-star--glint' : '');
        star.style.cssText = 'left:' + (3 + random() * 94).toFixed(2) + '%;top:' + (random() * 97).toFixed(2) + '%;--star-size:' + (1.3 + random() * 2.2).toFixed(2) + 'px;--star-time:' + (2.2 + random() * 3.8).toFixed(2) + 's;--star-delay:-' + (random() * 6).toFixed(2) + 's';
        stars.appendChild(star);
      }
    }
    function load(theme) {
      if (!images[theme]) images[theme] = new Promise(function (resolve, reject) {
        var image = new Image(); image.decoding = 'async'; image.fetchPriority = 'low';
        image.onload = function () {
          var decoded = image.decode ? image.decode() : Promise.resolve();
          decoded.then(function () { resolve(PICTURES[theme]); }, function () { resolve(PICTURES[theme]); });
        };
        image.onerror = function () { delete images[theme]; reject(new Error('Shop scenery unavailable: ' + theme)); };
        image.src = PICTURES[theme];
      });
      return images[theme];
    }
    function stopTimer() { if (timer !== null) { root.clearTimeout(timer); timer = null; } }
    function onShopSceneBoundary() { timer = null; refresh(); }
    function refresh() {
      stopTimer();
      if (!active || el.hidden || document.hidden) return;
      var now = new Date(), theme = themeAt(now), token = ++request;
      if (!el.dataset.shopTheme) el.dataset.shopTheme = theme;
      if (theme === 'night') createStars();
      load(theme).then(function (url) {
        if (token !== request || !active || el.hidden || document.hidden) return;
        // Decode first, then replace the background and weather together.
        picture.style.backgroundImage = 'url("' + url + '")';
        el.dataset.shopTheme = theme;
      }).catch(function () { /* Keep the last decoded background when offline. */ });
      timer = root.setTimeout(onShopSceneBoundary, Math.max(50, nextChangeAt(now) - now.getTime()));
    }
    function show() { active = true; refresh(); }
    function hide() { active = false; ++request; stopTimer(); }
    function visibilityChanged() {
      if (document.hidden) { ++request; stopTimer(); }
      else if (active && !el.hidden) refresh();
    }
    document.addEventListener('visibilitychange', visibilityChanged);
    root.addEventListener('focus', function () { if (active && !el.hidden) refresh(); });
    root.addEventListener('pageshow', function () { if (active && !el.hidden) refresh(); });
    return { show: show, hide: hide };
  }
  MG.ShopScenery = { create: create, themeAt: themeAt, nextChangeAt: nextChangeAt };
})(window);
