(function (root) {
  'use strict';
  // Phase 1 = 스텁. Phase 2 에서 banner/interstitial/rewarded 본문만 Capacitor AdMob 호출로 교체
  // (호출부는 그대로 둔다).
  function banner(el) {
    if (!el) return;
    el.classList.add('ad-banner');
    el.textContent = '광고';
    el.setAttribute('aria-hidden', 'true');
  }

  // 가짜 전면/리워드 오버레이. rewardMode=true 면 resolve 값이 boolean.
  function fakeAd(rewardMode) {
    return new Promise(function (resolve) {
      var v = document.createElement('div');
      v.className = 'ad-overlay';
      v.innerHTML = '<div class="ad-overlay-card">' +
        '<div class="ad-overlay-tag">광고</div>' +
        '<div class="ad-overlay-bar"><i></i></div>' +
        '<button type="button" class="ad-overlay-x" aria-label="닫기">✕</button></div>';
      document.body.appendChild(v);
      var done = false;
      function finish(val) {
        if (done) return;
        done = true;
        v.remove();
        resolve(val);
      }
      v.querySelector('.ad-overlay-x').addEventListener('click', function () {
        finish(rewardMode ? false : undefined);
      });
      setTimeout(function () { finish(rewardMode ? true : undefined); }, 1600);
    });
  }
  function interstitial() { return fakeAd(false); }
  function rewarded() { return fakeAd(true); }

  var api = { banner: banner, interstitial: interstitial, rewarded: rewarded };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Ads = api; }
})(typeof window !== 'undefined' ? window : null);
