// 리듬팡(RHYTHM PANG) 1차 — 바탕화면 "리듬팡 UI 및 에셋/명세서.txt" 기준.
// 핵심: 음악 박자(targetTime) → 무기가 타겟창 진입 → 버튼 → 두더지 점프 → 두더지·무기 "실제 충돌" → SUCCESS.
// 리듬 판정(입력 시각 vs targetTime)과 물리 충돌(두더지 머리 원 ∩ 무기 원)은 따로 계산하고, 둘 다 만족해야 성공.
// 시간 기준 = Web Audio 시계(ctx.currentTime) — 일시정지는 ctx.suspend() 로 음악·노트가 함께 멈춤.
(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var A = 'assets/rhythm/';

  // ---- 튜닝 데이터(코드 하드코딩 대신 여기서만 조절) ----
  var CONFIG = {
    song: { src: 'audio/bgm-game-1.mp3', bpm: 83.0, firstBeat: 0.232 }, // BPM·첫 박 = 곡 분석값(곡 데이터가 없을 때 예비)
    bSongs: [{ id: 'le-monde-attendra-demain', title: 'Le monde attendra demain', duration: 119.96, chart: 'audio/rp/le-monde-attendra-demain.json', aChart: 'audio/rp/le-monde-attendra-demain-a.json', lyrics: 'audio/rp/le-monde-attendra-demain-lyrics.json' }, { id: 'meet-me-halfway', title: 'Meet Me Halfway', duration: 119.56, chart: 'audio/rp/meet-me-halfway.json', aChart: 'audio/rp/meet-me-halfway-a.json', lyrics: 'audio/rp/meet-me-halfway-lyrics.json' }, { id: 'paper-engine-ride', title: 'Paper-Engine Ride', duration: 119.88, chart: 'audio/rp/paper-engine-ride.json', aChart: 'audio/rp/paper-engine-ride-a.json', lyrics: 'audio/rp/paper-engine-ride-lyrics.json' }, { id: 'the-world-is-wide', title: 'The World Is Wide', duration: 119.56, chart: 'audio/rp/the-world-is-wide.json', aChart: 'audio/rp/the-world-is-wide-a.json', lyrics: 'audio/rp/the-world-is-wide-lyrics.json' }, { id: 'be-my-destiny', title: 'Be My Destiny', duration: 119.56, chart: 'audio/rp/be-my-destiny.json', aChart: 'audio/rp/be-my-destiny-a.json', lyrics: 'audio/rp/be-my-destiny-lyrics.json' }, { id: 'take-this-night-around', title: 'Take This Night Around', duration: 207.96, chart: 'audio/rp/take-this-night-around.json', aChart: 'audio/rp/take-this-night-around-a.json', lyrics: 'audio/rp/take-this-night-around-lyrics.json' }], // V1354 C 새 2곡(후렴 패턴식)
    songData: 'audio/rp/fever2.json', // v843: 곡 분석 데이터(반주·멜로디 분리 + 난이도별 노트 시각) — 맞히면 멜로디가 연주됨
    chart: { startBeat: 8, beats: 116 },           // 8박(인트로) 뒤부터 116박 = 한 판 약 90초(사용자 지정 v837, 이전 64박≈52초)
    judge: { perfectMs: 70, greatMs: 130, goodMs: 200 },
    score: { PERFECT: 300, GREAT: 200, GOOD: 100 },
    hpMax: 10,
    jumpFrameMs: 60,                                // 7프레임 × 60ms (v843: 80→60, 점프 반응 빠르게 — 사용자 지정)
    apexFrame: 3,                                   // 0부터 — 최고점 프레임(에셋 실측)
    travelSec: 1.6,                                 // 무기 출발→타겟 시간
    countIn: 3,
    songLock: false                                 // V1368 C: 곡 해금(앞 2곡 무료·앞 곡 A등급↑) — 사용자 지시 '일단은 다 해금', true 로 켜면 적용
  };
  // 난이도(명세 §30) — EASY 직선 위주·넓은 판정 / NORMAL POINT1 꺾임·반박 노트 / HARD POINT1+POINT2·빠른 연속·좁은 판정
  var DIFFS = {
    EASY:   { travel: 1.8, judge: { perfectMs: 80, greatMs: 150, goodMs: 220 }, half: 0,    turn1: 0.15, turn2: 0,    rest: 8 },
    NORMAL: { travel: 1.5, judge: { perfectMs: 65, greatMs: 120, goodMs: 180 }, half: 0.25, turn1: 0.35, turn2: 0,    rest: 8 },
    HARD:   { travel: 1.3, judge: { perfectMs: 50, greatMs: 95,  goodMs: 150 }, half: 0.5,  turn1: 0.3,  turn2: 0.35, rest: 16 }
  };
  var LAUNCH = 0.75; // 수평선에서 최상단까지 던져 올라오는 시간(초)
  var CHARS = ['cap', 'pink', 'braid', 'punk'];
  var WEAPONS = ['snow', 'boomerang', 'disc', 'heart'];
  var HOLE_SIZE = [[388,243],[368,252],[364,239],[371,241]];
  // Dense source-pixel contours keep each foreground lip fitted to its own hole.
  var HOLE_FRONT_POINTS = [
    [[0,159],[10,154],[20,145],[30,134],[40,129],[50,129],[60,132],[70,136],[80,139],[90,145],[100,150],[110,154],[120,154],[130,149],[140,138],[150,132],[160,130],[170,132],[180,134],[190,136],[200,140],[210,143],[220,145],[230,143],[240,140],[250,136],[260,130],[270,129],[280,133],[290,135],[300,133],[310,137],[320,143],[330,146],[340,149],[350,151],[360,155],[370,160],[388,164]],
    [[0,164],[10,153],[20,145],[30,143],[40,146],[50,152],[60,157],[70,156],[80,152],[90,150],[100,151],[110,154],[120,157],[130,158],[140,155],[150,149],[160,145],[170,143],[180,143],[190,143],[200,145],[210,148],[220,151],[230,153],[240,155],[250,155],[260,152],[270,148],[280,144],[290,142],[300,141],[310,143],[320,146],[330,150],[340,154],[350,157],[360,160],[368,163]],
    [[0,161],[10,154],[20,146],[30,137],[40,130],[50,126],[60,126],[70,128],[80,133],[90,138],[100,143],[110,147],[120,149],[130,148],[140,146],[150,143],[160,141],[170,142],[180,143],[190,144],[200,145],[210,144],[220,142],[230,140],[240,137],[250,134],[260,132],[270,131],[280,133],[290,137],[300,142],[310,148],[320,152],[330,156],[340,160],[350,162],[364,165]],
    [[0,164],[10,155],[20,148],[30,141],[40,137],[50,136],[60,138],[70,142],[80,147],[90,150],[100,150],[110,147],[120,144],[130,142],[140,141],[150,141],[160,142],[170,144],[180,147],[190,149],[200,149],[210,147],[220,145],[230,143],[240,141],[250,142],[260,145],[270,146],[280,142],[290,137],[300,133],[310,131],[320,131],[330,134],[340,140],[350,147],[360,154],[371,163]]
  ];
  function holeFrontPath(i) {
    var size = HOLE_SIZE[i], p = HOLE_FRONT_POINTS[i].map(function (v) { return [v[0] / size[0], v[1] / size[1]]; });
    // Hole 1 has a shallower center lip; fit its own contour without changing the sides.
    if (i === 0) p = p.map(function (v) {
      var x = v[0] * size[0], dx = Math.abs(x - 194);
      if (dx >= 80) return v;
      var centerDrop = 14 * (0.5 + 0.5 * Math.cos(Math.PI * dx / 80));
      // Press the front lip slightly over the confirmed left fringe spot.
      var leftPress = Math.abs(x - 140);
      var press = leftPress < 12 ? 6 * (0.5 + 0.5 * Math.cos(Math.PI * leftPress / 12)) : 0;
      return [v[0], (v[1] * size[1] + centerDrop - press) / size[1]];
    });
    // Hole 2's inner front edge dips lower at the center; keep the side contour unchanged.
    if (i === 1) p = p.map(function (v) {
      var x = v[0] * size[0], dx = Math.abs(x - 184);
      if (dx >= 100) return v;
      var centerDrop = 24 * (0.5 + 0.5 * Math.cos(Math.PI * dx / 100));
      return [v[0], (v[1] * size[1] + centerDrop) / size[1]];
    });
    // Hole 3's dark fringe spans the front, so lower the whole front lip smoothly.
    if (i === 2) p = p.map(function (v) {
      var x = v[0] * size[0], edge = Math.min(1, x / 24, (size[0] - x) / 24);
      edge = Math.max(0, edge);
      edge = edge * edge * (3 - 2 * edge);
      var leftStoneCorner = Math.abs(x - 130);
      var localPress = leftStoneCorner < 10 ? 3 * (0.5 + 0.5 * Math.cos(Math.PI * leftStoneCorner / 10)) : 0;
      return [v[0], (v[1] * size[1] + 12 * edge + localPress) / size[1]];
    });
    // Preserve more of hole 4's front-left stone against the mole overlap.
    if (i === 3) p = p.map(function (v) {
      var x = v[0] * size[0], leftStoneCorner = Math.abs(x - 110), gapDistance = Math.abs(x - 200);
      var lift = leftStoneCorner < 15 ? 5 * (0.5 + 0.5 * Math.cos(Math.PI * leftStoneCorner / 15)) : 0;
      var gapPress = gapDistance < 80 ? 8 * (0.5 + 0.5 * Math.cos(Math.PI * gapDistance / 80)) : 0;
      return [v[0], (v[1] * size[1] - lift + gapPress) / size[1]];
    });
    var d = 'M' + p[0][0] + ' ' + p[0][1];
    for (var j = 0; j < p.length - 1; j++) {
      var a = p[j], b = p[j + 1], prev = p[Math.max(0, j - 1)], next = p[Math.min(p.length - 1, j + 2)];
      d += ' C' + (a[0] + (b[0] - prev[0]) / 6) + ' ' + (a[1] + (b[1] - prev[1]) / 6) + ' ' + (b[0] - (next[0] - a[0]) / 6) + ' ' + (b[1] - (next[1] - a[1]) / 6) + ' ' + b[0] + ' ' + b[1];
    }
    return d + ' L1 1 L0 1 Z';
  }

  function create(opts) {
    var el = opts.root;
    function setEntryBgm(playing, fadeMs) { if (typeof opts.onEntryMusic === 'function') opts.onEntryMusic(!!playing, fadeMs); }
    var $ = function (s) { return el.querySelector(s); };
    var stage = $('[data-rp-stage]'), wlayer = $('[data-rp-weapons]');
    var lyricTicker = MG.RhythmLyrics.create(el);
    var statusFx = MG.RhythmStatusFx.create(el), buttonWaves=[];
    var beachVisual = MG.RhythmBeach.create(el), targetLanes=[], targetCue=[0,0,0,0], perfectWords=[];
    var meta = null, buffer = null, ctx = null, src = null;
    var st = null, raf = 0;
    var countEl = $('[data-rp-count]'), frameHeads = [0,1,2,3].map(function(){return {h:{x:0,y:0,r:0},jumping:false};}), frameCues=[0,0,0,0];
    var imgs = {}, diff = 'EASY';
    var bGame = null, activeB = false, resultSerial = 0;
    var selectedASong = CONFIG.bSongs[0], selectedBSong = CONFIG.bSongs[0], bSongCache = {}, bSongPending = {};
    var adRequired=false, adReady=false, adBusy=false, entryPaid=null, entryBusy=false, entryGeneration=0, entryLoadingTimer=0;
    var rhythmArtReady=null;
    function preloadRhythmArt(){
      if(rhythmArtReady)return rhythmArtReady;
      var urls=new Set(),urlPattern=/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
      function add(raw,base){if(!raw||/^data:|^blob:/i.test(raw))return;try{var u=new URL(raw,base||document.baseURI);if(/\.(?:png|jpe?g|webp|gif|svg|avif)(?:[?#]|$)/i.test(u.href))urls.add(u.href);}catch(e){}}
      function scanText(text,base){var match;urlPattern.lastIndex=0;while((match=urlPattern.exec(text||'')))add(match[1],base);}
      el.querySelectorAll('img[src],image[href], [style]').forEach(function(node){if(node.currentSrc||node.src)add(node.currentSrc||node.src);if(node.getAttribute('href'))add(node.getAttribute('href'));if(node.getAttribute('style'))scanText(node.getAttribute('style'),document.baseURI);});
      function walk(rules,base){Array.prototype.forEach.call(rules||[],function(rule){if(rule.cssRules){walk(rule.cssRules,base);return;}var selector=rule.selectorText||'';if(/\.rp-|\.rb-|\.rx-|#rhythm-screen/.test(selector))scanText(rule.cssText,base);});}
      Array.prototype.forEach.call(document.styleSheets,function(sheet){try{walk(sheet.cssRules,sheet.href||document.baseURI);}catch(e){}});
      function loadImage(src){return new Promise(function(resolve){var img=new Image();if(img.decode){img.src=src;img.decode().then(resolve,resolve);}else{img.onload=img.onerror=resolve;img.src=src;}});}
      var sources=Array.from(urls),cursor=0;
      function loadBatch(){var batch=sources.slice(cursor,cursor+6);cursor+=batch.length;return batch.length?Promise.all(batch.map(loadImage)).then(loadBatch):Promise.resolve();}
      var waits=[loadBatch()];
      if(document.fonts&&document.fonts.load)waits.push(document.fonts.load('16px Jua').catch(function(){}),document.fonts.load('16px "Lilita One"').catch(function(){}));
      rhythmArtReady=Promise.all(waits);
      return rhythmArtReady;
    }
    function albumOf(choice) { return choice.id==='fever2' ? 'assets/home2/mole-cap.png' : A+'albums-v1170/'+choice.id+'.webp?v=1376'; } // V1376 C: 같은 파일명 교체 → 폰 캐시 무효화
    function selectSong(choice){if(activeB)selectedBSong=choice;else selectedASong=choice;}
    // V1366 C: 리듬팡 티켓 — 시작할 때 1장(하루 첫 판 무료), 로딩 실패·취소면 돌려줌
    function paintTickets(){var E=MG.Economy;if(!E||!E.getTickets)return;var n=E.formatK(E.getTickets()); // V1372 C: 홈 티켓과 같은 수
      el.querySelectorAll('[data-rp-ticket-count] b').forEach(function(p){p.textContent=n;});} // 사용자: 숫자만
    function refundEntry(){if(entryPaid&&MG.Economy)MG.Economy.refundRhythmPlay(entryPaid);entryPaid=null;paintTickets();}
    function cancelEntry(){if(entryBusy)refundEntry();entryGeneration++;entryBusy=false;clearTimeout(entryLoadingTimer);$('[data-rp-preloader]').hidden=true;}
    function watchSongAd(done){
      if(adBusy||entryBusy)return;
      if(!MG.Ads||!MG.Ads.rewarded){$('[data-rp-song-message]').textContent=root.FGH.I18N.t('mole.rp.ad.notReady');return;}
      adBusy=true;var token=resultSerial;document.body.classList.add('rhythm-ad-active');
      Promise.resolve().then(function(){return MG.Ads.rewarded();}).then(function(ok){adBusy=false;if(token===resultSerial&&!el.hidden&&ok)done();else if(token===resultSerial)$('[data-rp-song-message]').textContent=root.FGH.I18N.t('mole.rp.ad.once');}).catch(function(){if(token===resultSerial)$('[data-rp-song-message]').textContent=root.FGH.I18N.t('mole.rp.ad.fail');}).finally(function(){adBusy=false;document.body.classList.remove('rhythm-ad-active');});
    }
    function launchSong(modal){
      if(entryBusy||adBusy)return;
      if(adRequired&&!adReady){watchSongAd(function(){adReady=true;launchSong(modal);});return;}
      var paid=MG.Economy&&MG.Economy.spendRhythmPlay?MG.Economy.spendRhythmPlay():'free';if(!paid){showSelect();$('[data-rp-selected-song]').textContent=(activeB?selectedBSong:selectedASong).title+' · '+root.FGH.I18N.t('mole.rp.ticket.none');return;}entryPaid=paid;paintTickets();
      var token=++entryGeneration,choice=activeB?selectedBSong:selectedASong,wasB=activeB,completed=0,total=wasB?3:5,loader=$('[data-rp-preloader]'),loaderShownAt=0;entryBusy=true;
      if(!ctx)ctx=new(root.AudioContext||root.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume();
      $('[data-rp-preload-album]').src=albumOf(choice);$('[data-rp-preload-title]').textContent=choice.title;
      $('[data-rp-preload-progress]').max=total;$('[data-rp-preload-progress]').value=0;$('[data-rp-preload-detail]').textContent=root.FGH.I18N.t('mole.rp.preload.count',{n:0,total:total});loader.hidden=true;
      clearTimeout(entryLoadingTimer);entryLoadingTimer=setTimeout(function(){if(token===entryGeneration&&entryBusy&&!el.hidden){loaderShownAt=Date.now();loader.hidden=false;}},1000);
      function track(p){return Promise.resolve(p).then(function(v){if(token===entryGeneration){completed++;$('[data-rp-preload-progress]').value=completed;$('[data-rp-preload-detail]').textContent=root.FGH.I18N.t('mole.rp.preload.count',{n:completed,total:total});}return v;});}
      var tasks=wasB?[loadBSong(),bGame.prepare(),preloadRhythmArt()]:[loadSong(),preload(),loadMeta(),loadSfx(),preloadRhythmArt()];
      Promise.all(tasks.map(track)).then(function(){if(token!==entryGeneration||el.hidden||activeB!==wasB)return false;clearTimeout(entryLoadingTimer);return new Promise(function(resolve,reject){var hold=loaderShownAt?Math.max(0,280-(Date.now()-loaderShownAt)):0;setTimeout(function(){if(token!==entryGeneration||el.hidden||activeB!==wasB){resolve(false);return;}loader.hidden=true;pushInGame(modal);Promise.resolve(wasB?bGame.open(diff,{practice:false}):start()).then(resolve,reject);},hold);});}).then(function(ok){if(token!==entryGeneration)return;clearTimeout(entryLoadingTimer);loader.hidden=true;entryBusy=false;if(ok){adReady=false;entryPaid=null;}else{refundEntry();showSelect();}}).catch(function(){if(token!==entryGeneration)return;clearTimeout(entryLoadingTimer);loader.hidden=true;entryBusy=false;refundEntry();showSelect();$('[data-rp-selected-song]').textContent=choice.title+' · '+root.FGH.I18N.t('mole.rp.err.retry');});
    }
    $('[data-rp-preload-cancel]').addEventListener('click',function(){cancelEntry();showSongs();});
    function bBestPrefix() { return selectedBSong.id === 'fever2' ? 'mole.rp.b.best.' : 'mole.rp.b.best.' + selectedBSong.id + '.'; }
    function aBestPrefix() { return selectedASong.id === 'fever2' ? 'mole.rp.best.' : 'mole.rp.best.' + selectedASong.id + '.'; }
    // 효과음(기존 게임 사운드 재사용) — 성공 = 타격음, 실패 = 두더지 아야
    var SFX = { hit: ['audio/hit1.mp3', 'audio/hit2.mp3', 'audio/hit3.mp3', 'audio/hit4.mp3'], jump: ['audio/mole-emerge.mp3'], countdown: ['audio/countdown-jump-mixkit.mp3'] }; // 카운트다운은 비치 모드 전용
    var sfxBuf = {};
    function loadSfx() {
      var all = SFX.hit.concat(SFX.jump, SFX.countdown);
      return Promise.all(all.map(function (u) {
        if (sfxBuf[u]) return null;
        return fetch(u).then(function (r) { return r.arrayBuffer(); }).then(function (ab) { return new Promise(function (res) { ctx.decodeAudioData(ab, function (b) { sfxBuf[u] = b; res(); }, function () { res(); }); }); }).catch(function () {});
      }));
    }
    function sfx(kind, when) {
      var list = SFX[kind], b = sfxBuf[list[Math.floor(Math.random() * list.length)]]; if (!b || !ctx) return;
      var s = ctx.createBufferSource(), g = ctx.createGain();
      g.gain.value = (kind === 'hit' ? 0.35 : (kind === 'countdown' ? 0.22 : 0.3)) * (!el.classList.contains('is-type-b') && (kind === 'hit' || kind === 'jump') ? 0.5 : 1);
      s.buffer = b; s.connect(g); g.connect(ctx.destination); if (typeof when === 'number') s.start(when); else s.start();
    }

    function preload() {
      var list = [];
      CHARS.forEach(function (c) { list.push(A + 'jump-' + c + '-strip.png'); });
      WEAPONS.forEach(function (w) { list.push(A + 'w-' + w + '.png'); }); list.push(A + 'w-disc-face.png');
      ['hippo-happy.webp','hippo-hurt.webp','hippo-arm.webp','sea-atlas.webp'].forEach(function(name){list.push(A+'beach-v1172/'+name);});
      return Promise.all(list.map(function (u) { if(imgs[u]&&imgs[u].complete&&imgs[u].naturalWidth)return null;var im = new Image(); im.src = u; imgs[u] = im; return im.decode ? im.decode().catch(function () {}) : null; }));
    }
    function loadMeta() { return meta ? Promise.resolve(meta) : fetch(A + 'jump-meta.json').then(function (r) { return r.json(); }).then(function (m) { meta = m; return m; }); }
    var song = null, melBuf = null, melGain = null; // v843: 연주형(맞히면 멜로디 나옴, 놓치면 끊김 — 기타히어로 방식)
    function decode(u) { return fetch(u).then(function (r) { return r.arrayBuffer(); }).then(function (ab) { return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); }); }); }
    function loadSong() {
      if (!ctx) ctx = new (root.AudioContext || root.webkitAudioContext)();
      var choice = selectedASong;
      return loadBSong({ id: choice.id, chart: choice.aChart || choice.chart, lyrics: choice.lyrics }).catch(function (error) {
        if (choice.id !== 'fever2') throw error;
        return decode(CONFIG.song.src).then(function (back) { return {ctx:ctx,back:back,melody:null,song:null}; });
      });
    }
    function loadBSong(choice) {
      choice = choice || selectedBSong;
      var cacheKey = choice.chart;
      if (bSongCache[cacheKey]) return Promise.resolve(bSongCache[cacheKey]);
      if (bSongPending[cacheKey]) return bSongPending[cacheKey];
      bSongPending[cacheKey] = fetch(choice.chart).then(function (r) { if (!r.ok) throw new Error('곡 자료를 불러오지 못했습니다.'); return r.json(); }).then(function (data) {
        var cached = Object.values(bSongCache).find(function (entry) { return entry.song.back === data.back; });
        return Promise.all([cached ? Promise.resolve(cached.back) : decode(data.back), data.melody ? (cached && cached.melody ? Promise.resolve(cached.melody) : decode(data.melody)) : Promise.resolve(null), choice.lyrics ? fetch(choice.lyrics).then(function(r){if(!r.ok)throw Error('Lyrics unavailable');return r.json();}).catch(function(){return null;}) : Promise.resolve(null)]).then(function (audio) {
          // Keep only the selected song decoded; A/B share its full-mix buffer.
          bSongCache = {};
          data.lyrics = audio[2];
          return bSongCache[cacheKey] = { ctx: ctx, back: audio[0], melody: audio[1], song: data };
        });
      }).finally(function () { delete bSongPending[cacheKey]; });
      return bSongPending[cacheKey];
    }
    function showSongs() {
      statusFx.stop(); clearButtonWaves();
      setEntryBgm(true);
      cancelEntry();
      beachVisual.stop();
      updateModeSign();
      updateACombo(0,true);
      lyricTicker.clear();
      resultSerial++;
      if (bGame) bGame.stop();
      cancelAnimationFrame(raf); try { src && src.stop(); } catch (e) {} st = null;
      $('[data-rp-select]').hidden = true; $('[data-rp-result]').hidden = true; $('[data-rp-pause]').hidden = true;
      var list = $('[data-rp-song-list]'); list.replaceChildren();
      adRequired = false; adReady = false;
      $('[data-rp-song-message]').textContent = '';
      CONFIG.bSongs.forEach(function (choice, index) {
        var card = document.createElement('article'); card.className = 'rb-song-choice'; card.style.setProperty('--song-index', index); card.dataset.songId = choice.id;
        var album = document.createElement('img'); album.className = 'rb-song-album'; album.src = albumOf(choice); album.alt = ''; album.width = album.height = 96;
        var info = document.createElement('div'); info.className = 'rb-song-info';
        var title = document.createElement('b'); title.textContent = choice.id === 'fever2' ? 'Rhythm Fever' : choice.title;
        var detail = document.createElement('small'), seconds = Math.round(choice.duration || 0);
        detail.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') + ' · ' + root.FGH.I18N.t('mole.rp.songs.diffs');
        var record = document.createElement('strong'), prefix = (activeB ? 'mole.rp.b.best.' : 'mole.rp.best.') + (choice.id === 'fever2' ? '' : choice.id + '.');
        var best = 0, grade = '';
        ['EASY','NORMAL','HARD'].forEach(function(d){var score=Number(localStorage.getItem(prefix+d))||0;if(score>best){best=score;try{grade=JSON.parse(localStorage.getItem(prefix+d+'.result')||'null').rank;}catch(e){grade='';}}});
        record.textContent = best ? 'BEST ' + best.toLocaleString('en-US') + (grade ? ' · '+grade : '') : root.FGH.I18N.t('mole.rp.songs.first');
        info.append(title, detail, record);
        var actions = document.createElement('div'); actions.className = 'rb-song-actions';
        var play = document.createElement('button'); play.type='button'; play.className='rx-btn rx-btn--y rb-song-play'; play.dataset.rpSong=choice.id; play.innerHTML=buttonTriangle(0,'-song-'+choice.id)+'<span>'+root.FGH.I18N.t('mole.rp.songs.play')+'</span>'; play.setAttribute('aria-label',root.FGH.I18N.t('mole.rp.songs.playAria',{title:choice.title}));
        play.querySelector('svg').setAttribute('viewBox','45 43 133 105');play.querySelector('svg').setAttribute('preserveAspectRatio','xMidYMid meet');
        play.addEventListener('click',function(){selectSong(choice);adRequired=false;adReady=false;showSelect();});
        var ad = document.createElement('button'); ad.type='button'; ad.className='rx-btn rx-btn--b rb-song-ad'; ad.innerHTML='<img src="assets/ui-approved-v1476/ad-icon.webp" alt="">'; ad.setAttribute('aria-label',root.FGH.I18N.t('mole.rp.songs.adAria',{title:choice.title}));
        ad.addEventListener('click',function(){watchSongAd(function(){MG.Economy.addTickets(1);paintTickets();$('[data-rp-song-message]').textContent=root.FGH.I18N.t('mole.rp.ticket.got');});}); // V1365 C: 광고 = 티켓 1장
        var lock = sharedRules.songLock(index); // V1368 C: 잠긴 곡 = 어둡게 + 조건 문구, 실행·광고 버튼 막음
        if (lock) { card.classList.add('is-locked'); play.disabled = ad.disabled = true; record.textContent = root.FGH.I18N.t('mole.rp.lock.need', { title: lock.needTitle }); }
        actions.append(play,ad);card.append(album,info,actions);list.appendChild(card);
      });
      if (!CONFIG.bSongs.length) list.textContent = root.FGH.I18N.t('mole.rp.songs.none');
      $('[data-rp-songs]').hidden = false; paintTickets();
      layoutSongRows();
      list.scrollTop = 0;
    }
    // Fit whole cards to the visible list and let native scrolling snap by card.
    // Resize-only work; no game render loop or scroll animation listener.
    function layoutSongRows() {
      var list=$('[data-rp-song-list]'),cards=list.children;
      if(!list.clientHeight||!cards.length)return;
      // V1374 C 사용자: 화면이 낮으면 박스가 줄어 사진·버튼이 박스 밖으로 넘침 → 박스 높이 = max(내용 높이, 3개 맞춤 높이). 값이 같으면 안 건드림(관찰자 무한 반복 방지)
      var gap=12,count=Math.min(3,cards.length),available=list.clientHeight-28;
      var natural=0;for(var k=0;k<cards.length;k++){var c=cards[k],keep=c.style.height;c.style.height='auto';natural=Math.max(natural,c.offsetHeight);c.style.height=keep;}
      var slot=Math.max(natural,(available-gap*(count-1))/count);
      if(list.style.getPropertyValue('--rp-song-slot')!==slot+'px')list.style.setProperty('--rp-song-slot',slot+'px');
      // V1376 G: 실제로 들어가는 온전한 카드 수 기준으로 끝 여백을 채움. 마지막 카드의 아래 margin은 CSS에서 제거.
      var wholeCount=Math.min(count,Math.max(1,Math.floor((available+gap+0.5)/(slot+gap))));
      var spare=Math.max(0,available-(slot*wholeCount+gap*(wholeCount-1)));
      var pb=(14+spare)+'px';if(list.style.paddingBottom!==pb)list.style.paddingBottom=pb;
      list.dataset.visibleCards=String(count);
    }
    var songListResize=new ResizeObserver(layoutSongRows);songListResize.observe($('[data-rp-song-list]'));
    if(document.fonts)document.fonts.ready.then(layoutSongRows);
    function melody(on) { if (melGain) melGain.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, on ? 0.01 : 0.03); }

    // ---- 레이아웃(px) ----
    var L = {};
    function layout() {
      beachVisual.layout();
      el.style.setProperty('--rp-a-lyric-bottom', ($('.rp-bottom').offsetHeight + 2) + 'px');
      var W = stage.clientWidth, H = stage.clientHeight;
      L.W = W; L.H = H; L.laneW = W / 4;
      L.laneX = [0, 1, 2, 3].map(function (i) { return L.laneW * (i + 0.5); });
      L.moleW = L.laneW * 0.92 * 0.95;
      L.moleBottom = H * 0.80;                    // 두더지 발바닥(구멍 중심) y
      L.p1 = H * 0.24; L.p2 = H * 0.40;
      L.horizonY = H * 0.37; // 해변 배경 바다 수평선 근처
      // 타겟창 = 두더지 최고점 머리 위치(가장 높이 오르는 캐릭터 기준 평균)
      // v812: 타겟창 높이 고정(무대의 71% — 사용자가 확인한 기존 위치). 최고점 머리가 여기 닿도록 기준 바닥을 역산.
      L.lift = undefined; L.moleBottom = 0;
      var heads = CHARS.map(function (c, i) { return headAt(i, CONFIG.apexFrame); });
      var K = -heads.reduce(function (s, h) { return s + h.y; }, 0) / 4;
      L.targetY = H * 0.71;
      L.moleBottom = L.targetY + K;
      L.targetR = L.laneW * 0.36;
      L.weaponR = L.laneW * 0.22;
      L.speed = 0; // 노트별 경로 길이/시간으로 계산
      // v812(사용자 지정): 두더지는 시간(HP) 바 바로 위로 내림, 타겟창은 그대로 →
      // 내려간 만큼 점프를 더 높이 띄워(lift) 최고점 머리가 여전히 타겟창에 닿게.
      var oldBottom = L.moleBottom;
      L.sink = L.laneW * 0.1; // v814: 두더지를 구멍 속으로 조금 내림(떠 보이지 않게)
      L.moleBottom = H - L.laneW * 0.3 - 4 + L.sink; // 구멍(테두리) 아래끝이 시간 바 바로 위에 오게 — 버튼과 안 겹침
      L.lift = L.moleBottom - oldBottom;
      // Keep the target, judgement point, hole, and mole aligned as one group.
      var groupShift = Math.min(32, W * 0.06);
      var beachDrop = Math.min(28, H * 0.035);
      L.targetY = L.targetY - groupShift + beachDrop;
      L.moleBottom = L.moleBottom - groupShift + beachDrop;
      // Align each measured sprite apex head top with the target upper edge.
      var targetTop = L.targetY - L.targetR * 3.05 / 2;
      L.apexLift = CHARS.map(function (c) {
        var m = meta[c], bb = m.bb[CONFIG.apexFrame], s = L.moleW / m.w;
        var apexTop = L.moleBottom - (m.h - bb[1]) * s - (L.lift || 0);
        return apexTop - targetTop;
      });
    }
    // 프레임별 추가 상승량 = (그 프레임이 대기 자세보다 오른 정도 ÷ 최고점이 오른 정도) × lift
    function liftAt(i, f) {
      if (L.lift === undefined) return 0;
      var bb = meta[CHARS[i]].bb, rise = bb[0][1] - bb[f][1], top = bb[0][1] - bb[CONFIG.apexFrame][1];
      var ratio = top > 0 ? Math.max(0, Math.min(1, rise / top)) : 0;
      return ratio * (L.lift + (L.apexLift ? L.apexLift[i] : 0));
    }
    // 두더지 i 의 프레임 f 머리 원(화면 px)
    function headAt(i, f, out) {
      var m = meta[CHARS[i]], s = L.moleW / m.w, bb = m.bb[f];
      var bw = (bb[2] - bb[0]) * s;
      var top = L.moleBottom - (m.h - bb[1]) * s - (L.lift !== undefined ? liftAt(i, f) : 0);  // 캔버스 아래 = 구멍
      out=out||{};out.x=L.laneX[i];out.y=top+bw*.36;out.r=bw*.36;return out;
    }

    // ---- 채보(EASY): 박마다 1노트, 가끔 POINT1 꺾임 ----
    function buildChart() {
      var D = DIFFS[diff], spb = 60 / CONFIG.song.bpm, notes = [], seed = (Date.now() ^ (Math.random() * 0x7fffffff)) & 0x7fffffff, id = 0, lastAt = {};
      var authored = song && song.aPatterns && song.aPatterns[diff];
      if (authored) seed = Array.from(selectedASong.id + diff).reduce(function (h,c) { return ((h*31)+c.charCodeAt(0)) & 0x7fffffff; }, 7);
      var authoredNotes = authored ? authored.flatMap(function (e) { return e.lanes.map(function (lane) { return {time:e.time,lane:lane}; }); }) : null;
      // v923(사용자 지정): 시작값이 난이도별 고정(7 + 길이)이라 판마다 무기 자리가 똑같았음 — 판마다 새 시작값
      function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
      // v843: 곡 데이터가 있으면 멜로디 소리 시작점(분석값)을 노트 시각으로 — 누르는 타이밍 = 멜로디 리듬
      var times = null;
      if (song && song.charts && song.charts[diff]) times = song.charts[diff];
      else { times = []; for (var kk = 0; kk < CONFIG.chart.beats; kk++) { if (kk % D.rest === D.rest - 1) continue; times.push(CONFIG.song.firstBeat + (CONFIG.chart.startBeat + kk) * spb); if (kk % 2 === 1 && rnd() < D.half) times.push(CONFIG.song.firstBeat + (CONFIG.chart.startBeat + kk + 0.5) * spb); } }
      if (authoredNotes) times = authoredNotes.map(function (n) { return n.time; });
      times.forEach(function (T0, noteIndex) {
        [0].forEach(function () {
          var beat = song ? T0 / (60 / song.bpm) : (T0 - CONFIG.song.firstBeat) / spb;
          var lane = authoredNotes ? authoredNotes[noteIndex].lane : Math.floor(rnd() * 4);
          // v924(사용자 지정): 같은 자리 연속 허용 — "3번 연속 금지" 규칙 삭제(점프 시간 간격 규칙만 유지)
          // 같은 레인은 두더지 점프(7프레임)가 끝날 시간 이상 간격 — 못 치는 노트 방지(v811)
          var tt = T0, gap = 7 * CONFIG.jumpFrameMs / 1000 + 0.1;
          for (var tries = 0; !authoredNotes && tries < 4 && tt - (lastAt[lane] || -9) < gap; tries++) lane = (lane + 1) % 4;
          lastAt[lane] = tt;
          var t2 = rnd() < D.turn2, t1 = t2 || rnd() < D.turn1;
          var mid = t2 ? (lane + 1 + Math.floor(rnd() * 3)) % 4 : lane;
          var start = t1 ? (mid + 1 + Math.floor(rnd() * 3)) % 4 : lane;
          if (t1 && !t2 && start === lane) start = (lane + 1) % 4;
          // v947(사용자 지정): 무기 종류가 자리(WEAPONS[lane])에 묶여 같은 무기는 늘 같은 타겟창으로 갔음 — 무기도 무작위
          notes.push({ id: id++, beatIndex: beat, targetTime: T0, startLane: start, targetLane: lane,
            midLane: mid, routePoint1: t1 ? 1 : 0, routePoint2: t2 ? 1 : 0, weaponType: WEAPONS[Math.floor(rnd() * WEAPONS.length)], difficulty: diff });
        });
      });
      return notes;
    }
    // 경로(직선→꺾임→직선): 꼭짓점 목록
    function routeOf(n) {
      var xs = L.laneX[n.startLane], xt = L.laneX[n.targetLane], y0 = L.weaponR * 1.3; // v812: 던져진 무기가 올라온 최상단
      if (!n.routePoint1) return [[xs, y0], [xt, L.targetY]];
      if (!n.routePoint2) return [[xs, y0], [xs, L.p1], [xt, L.p2], [xt, L.targetY]];
      var xm = L.laneX[n.midLane];
      return [[xs, y0], [xs, L.p1 * 0.62], [xm, L.p1 * 1.15], [xm, L.p2 * 0.95], [xt, L.p2 * 1.32], [xt, L.targetY]];
    }
    // 무기 화면 상태(위치·크기·회전·투명도). 부메랑·원반은 던져 올라올 땐 빠르게, 내려올 땐 천천히 회전(사용자 지정 v816)
    function flyAt(n, t, out) {
      out=out||{};
      var spin=n.weaponType==='boomerang'||n.weaponType==='disc',big=spin?1.2:1;
      if(t<n.spawnTime-LAUNCH){out.x=0;out.y=-999;out.sc=1;out.rot=0;out.op=0;return out;}
      if(t<n.spawnTime){
        var u=1-(n.spawnTime-t)/LAUNCH,x0=n.pts[0][0],hx=x0+(L.W/2-x0)*.55,hy=L.horizonY;
        out.x=hx+(x0-hx)*u;out.y=hy+(n.pts[0][1]-hy)*(1-(1-u)*(1-u));out.sc=(.22+.78*u)*big;
        out.rot=spin?-(n.spawnTime-t)*1080:n.weaponType==='heart'?180:0;out.op=Math.min(1,u*3);return out;
      }
      posAt(n,t,out);out.sc=big;out.rot=spin?(t-n.spawnTime)*240:0;out.op=1;return out;
    }
    function sizeWind(n) { n.wind.style.width = (L.weaponR * 2.6) + 'px'; n.wind.style.height = (L.weaponR * 4.4) + 'px'; n.wind.style.opacity = '0'; }
    function xf(q, n) { return 'translate(' + (q.x - L.weaponR * 1.2) + 'px,' + (q.y - L.weaponR * (n && n.weaponType === 'heart' ? 2.4 * 373 / 307 : 1.2)) + 'px) scale(' + q.sc.toFixed(3) + ') rotate(' + q.rot.toFixed(1) + 'deg)'; }
    function pathLen(pts) { var s = 0; for (var i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; }
    function posAt(n, t, out) { // t = 음악 시각
      out=out||{};
      var v = n.len / DIFFS[diff].travel, d = (t - n.spawnTime) * v;
      if (d >= n.len) { out.x=n.pts[n.pts.length-1][0];out.y=L.targetY+(d-n.len);return out; } // 타겟 지나면 계속 아래로 직선
      for (var i = 1; i < n.pts.length; i++) {
        var a = n.pts[i - 1], b = n.pts[i], sl = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d <= sl) { var r = d / sl;out.x=a[0]+(b[0]-a[0])*r;out.y=a[1]+(b[1]-a[1])*r;return out; }
        d -= sl;
      }
    }

    // ---- 화면 요소 ----
    function buttonTriangle(i, suffix) {
      var sizes=[[222,194,51,50,167,133],[222,204,51,60,169,143],[221,205,51,61,167,144],[220,205,50,61,168,144]],r=sizes[i];
      var colors=[['#fff8d6','#ffdb68','#bd8118'],['#ddfbff','#68d7ff','#147fad'],['#ffe5fa','#ff8cde','#ac327f'],['#e4ffec','#8cf1ba','#278b57']][i];
      if (!suffix) {
        var paletteIndex = el.classList.contains('is-type-b') ? i : [1,2,0,3][i];
        colors=[['#ffe43b','#ffc400','#a66c00'],['#25cfff','#009cff','#075ca8'],['#ff50ca','#ee16a6','#8f1264'],['#47f072','#10c848','#087c2c']][paletteIndex];
      }
      var l=r[2],t=r[3],right=r[4],bottom=r[5],cx=(l+right)/2,mid=t+(bottom-t)*.62,id='rp-a-tri-'+i+(suffix||'');
      var face='M '+(cx-4)+' '+(t+4)+' Q '+cx+' '+(t-2)+' '+(cx+4)+' '+(t+4)+' L '+(right-1)+' '+(bottom-8)+' Q '+(right+4)+' '+bottom+' '+(right-5)+' '+bottom+' H '+(l+5)+' Q '+(l-4)+' '+bottom+' '+(l+1)+' '+(bottom-8)+' Z';
      return '<svg class="rp-a-triangle" viewBox="0 0 '+r[0]+' '+r[1]+'" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="'+colors[0]+'"/><stop offset="1" stop-color="'+colors[1]+'"/></linearGradient><clipPath id="'+id+'-clip"><path d="'+face+'"/></clipPath></defs><path d="'+face+'" transform="translate(0 9)" fill="'+colors[2]+'" opacity=".2"/><path d="'+face+'" transform="translate(0 5)" fill="'+colors[2]+'" stroke="'+colors[2]+'" stroke-width="2"/><path d="'+face+'" fill="url(#'+id+')" stroke="'+colors[0]+'" stroke-width="1.5"/><g clip-path="url(#'+id+'-clip)"><path d="M '+cx+' '+t+' L '+cx+' '+mid+' L '+l+' '+bottom+' Z" fill="'+colors[0]+'" opacity=".65"/><path d="M '+cx+' '+t+' L '+right+' '+bottom+' L '+cx+' '+mid+' Z" fill="'+colors[2]+'" opacity=".12"/></g></svg>';
    }
    function buildStage() {
      clearButtonWaves();
      buttonHitTimers.forEach(function(timer){clearTimeout(timer);});buttonHitTimers=[];
      var lanesEl = $('[data-rp-lanes]'); lanesEl.innerHTML = ''; moleEls = null;
      var beachPalette = !el.classList.contains('is-type-b'), colorMap = beachPalette ? [1,2,0,3] : [0,1,2,3];
      for (var i = 0; i < 4; i++) {
        var ln = document.createElement('div'); ln.className = 'rp-lane'; ln.style.left = (i * 25) + '%';
        var colorIndex = colorMap[i];
        ln.style.setProperty('--target-color',(beachPalette ? ['#ffc400','#009cff','#ee16a6','#10c848'] : ['#ffc94c','#5bd8ff','#ff8dce','#66e5b2'])[colorIndex]);
        var holeSize = HOLE_SIZE[i];
        ln.innerHTML = (beachPalette ? '<img class="rp-target-glow" src="' + A + 'beach-target-glow-v1352/glow-' + (colorIndex + 1) + '.webp" alt="">' : '') + '<img class="rp-target" src="' + A + (beachPalette ? 'beach-target-v1250/target-' : 'beach-v1172/target-') + (colorIndex + 1) + '.svg" alt=""><svg class="rp-target-inner-accent" viewBox="0 0 250 250" aria-hidden="true"><circle cx="125" cy="125" r="84" fill="none" stroke="var(--target-color)" stroke-width="3.75"/><path d="M125 23V62M125 188V227M23 125H62M188 125H227" fill="none" stroke="var(--target-color)" stroke-width="6" stroke-linecap="round"/></svg><span class="rp-target-orbit" aria-hidden="true"><i><b></b></i></span>' +
          '<img class="rp-hole" src="' + A + 'hole-' + (i + 1) + '.png" alt="">' +
          '<span class="rp-mole" style="background-image:url(' + A + 'jump-' + CHARS[i] + '-strip.png)"></span>' +
          '<svg class="rp-hole-front" viewBox="0 0 ' + holeSize[0] + ' ' + holeSize[1] + '" aria-hidden="true"><defs><clipPath id="rp-hole-front-' + i + '" clipPathUnits="objectBoundingBox"><path d="' + holeFrontPath(i) + '"/></clipPath></defs><image href="' + A + 'hole-' + (i + 1) + '.png" width="' + holeSize[0] + '" height="' + holeSize[1] + '" clip-path="url(#rp-hole-front-' + i + ')"/></svg>' +
          '<span class="rp-judge"></span>';
        lanesEl.appendChild(ln);
      }
      targetLanes=Array.from(lanesEl.querySelectorAll('.rp-lane'));targetCue.fill(0);
      // v831: MISS 맞은 두더지 머리 위 빙글 별(레인 컨테이너 = 무대 좌표)
      for (var di = 0; di < 4; di++) { var dz = document.createElement('span'); dz.className = 'rp-dizzy'; dz.innerHTML = '<i>★</i><i>★</i><i>★</i>'; lanesEl.appendChild(dz); }
      dizzyEls = lanesEl.querySelectorAll('.rp-dizzy');
      var bt = $('[data-rp-btns]'); bt.innerHTML = ''; btnEls = null; perfectWords=[];
      for (var j = 0; j < 4; j++) {
        (function (j) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'rp-btn';
          b.style.setProperty('--rp-press-color',['#ffd600','#00baff','#ff28ba','#24df5a'][colorMap[j]]);
          b.addEventListener('animationend', function(e){if(e.animationName==='rp-a-press-color')b.classList.remove('is-press-fx');});
          var beachCap = !el.classList.contains('is-type-b');
          if (beachCap) {
            b.style.setProperty('--beach-depth', ['#a66c00','#075ca8','#8f1264','#087c2c'][colorMap[j]]);
            b.style.setProperty('--beach-edge', ['#694400','#063969','#5b0b40','#05511c'][colorMap[j]]);
            b.style.setProperty('--beach-top-cut', ['0%','2.75%','3.65%','3.17%'][colorMap[j]]);
          }
          b.innerHTML = (beachCap ? '<span class="rp-beach-face">' : '') + '<img src="' + A + 'btn-' + (colorMap[j] + 1) + '.png" alt="">' + (beachCap ? '</span>' : '') + buttonTriangle(j)+'<i class="rp-a-wave" aria-hidden="true"></i>';
          var perfectWord = document.createElement('span'); perfectWord.className = 'rp-a-grade-word'; perfectWord.setAttribute('aria-hidden','true'); stage.appendChild(perfectWord); perfectWords[j]=perfectWord;
          b.addEventListener('pointerdown', function (e) {
            e.preventDefault(); press(j, sharedRules.eventLag(e)); b.classList.add('is-down');
            if (beachCap) {
              clearTimeout(b._beachSpringTimer); b.classList.remove('is-beach-spring'); void b.offsetWidth;
              b.classList.add('is-beach-spring');
              b._beachSpringTimer = setTimeout(function () { b.classList.remove('is-beach-spring'); }, 240);
            }
          });
          ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('is-down'); }); });
          bt.appendChild(b);
        })(j);
      }
    }
    function placeStatic() {
      var lanes = el.querySelectorAll('.rp-lane');
      lanes.forEach(function (ln, i) {
        var size=L.targetR*3.05;
        var t = ln.querySelector('.rp-target'),orbit=ln.querySelector('.rp-target-orbit'),innerAccent=ln.querySelector('.rp-target-inner-accent'),glow=ln.querySelector('.rp-target-glow');
        if(glow){glow.style.width=(size*1.5)+'px';glow.style.top=(L.targetY-size*0.75)+'px';} // V1352 C 타이밍 글로우: 타겟 1.5배, 중심 같게
        t.style.width=orbit.style.width=innerAccent.style.width=size+'px';orbit.style.height=innerAccent.style.height=size+'px';t.style.top=orbit.style.top=innerAccent.style.top=(L.targetY-size/2)+'px';
        var h = ln.querySelector('.rp-hole'), holeTop = L.moleBottom - L.sink - L.laneW * 0.32 + (i === 0 ? L.laneW * 0.05 : 0); h.style.width = (L.laneW * 0.98) + 'px'; h.style.top = holeTop + 'px';
        var hf = ln.querySelector('.rp-hole-front'); hf.style.width = h.style.width; hf.style.top = holeTop + 'px';
        var m = ln.querySelector('.rp-mole'); var md = meta[CHARS[i]];
        m.style.width = L.moleW + 'px'; m.style.height = (md.h * (L.moleW / md.w)) + 'px'; m.style.aspectRatio = 'auto'; m.style.top = (L.moleBottom - md.h * (L.moleW / md.w)) + 'px';
        ln.querySelector('.rp-judge').style.top = (L.targetY - L.targetR * 2.2) + 'px';
        var h0 = headAt(i, 0), dz = dizzyEls[i]; dz.style.left = h0.x + 'px'; dz.style.top = (h0.y - h0.r * 1.1) + 'px'; dz.style.width = (h0.r * 2.4) + 'px';
      });
    }
    // v824: 폰을 껐다 켜면(전체화면 복귀 등) 화면 높이가 바뀌는데 배치를 다시 안 해서 두더지·타겟이 올라가 있던 것 — 크기 바뀌면 다시 계산
    root.addEventListener('resize', function () {
      if (!st || !meta || el.hidden) return;
      layout(); placeStatic(); cacheHitGeometry();
      st.notes.forEach(function (n) {
        n.pts = routeOf(n); n.len = pathLen(n.pts);
        if (n.el) n.el.style.width = (L.weaponR * 2.4) + 'px';
        if (n.trail) n.trail.forEach(function (g) { g.style.width = (L.weaponR * 2.4) + 'px'; });
        if (n.wind) sizeWind(n);
      });
    });
    // v813(깜빡임 제거): 7프레임을 미리 겹쳐 두고 보이는 것만 바꿈 — img src 교체 순간 빈 프레임이 생기던 것
    var moleFrame = [-1, -1, -1, -1], moleEls = null, btnEls = null, dizzyEls = null, buttonHitTimers=[];
    var hitGeometry={topOffset:0,buttons:[]};
    function cacheHitGeometry(){
      var stageRect=stage.getBoundingClientRect(),screenRect=el.getBoundingClientRect();
      hitGeometry.topOffset=Math.max(0,stageRect.top-screenRect.top);
      btnEls=el.querySelectorAll('.rp-btn');
      hitGeometry.buttons=Array.from(btnEls,function(button,i){
        var rect=button.getBoundingClientRect(),word=perfectWords[i];
        var x=rect.left-stageRect.left+rect.width/2,y=rect.top-stageRect.top+rect.height/2;
        return {x:x,y:y,rise:-Math.max(0,y-L.targetY+(word?word.offsetHeight/2:0))};
      });
    }
    var replayQueue=new Map(), replayFrame=0;
    function replay(node,cls){
      node.classList.remove(cls);
      var classes=replayQueue.get(node);if(!classes){classes=new Set();replayQueue.set(node,classes);}classes.add(cls);
      if(!replayFrame)replayFrame=requestAnimationFrame(function(){
        replayFrame=0;var pending=replayQueue;replayQueue=new Map();
        pending.forEach(function(names,element){if(element.isConnected)names.forEach(function(name){element.classList.add(name);});});
      });
    }
    function setMoleFrame(i, f) {
      if (moleFrame[i] === f) return;
      var m = (moleEls || (moleEls = el.querySelectorAll('.rp-mole')))[i];
      m.style.backgroundPosition = (f / 6 * 100) + '% 0'; moleFrame[i] = f;
    }
    var statusJudge = $('[data-rp-status-judge]'), statusTime = $('[data-rp-time]'), statusSeconds = -1;
    var aGauge=$('.rp-a-timing-gauge'),aGaugeLight=aGauge.querySelector('.rb-timing-light'),aGaugeAnimation=null;
    var aGaugeReduced=root.matchMedia('(prefers-reduced-motion: reduce)');
    var aGaugeColors={PERFECT:'#FF9F1C',GREAT:'#b000ff',GOOD:'#00bfff',MISS:'#ff1744'};
    function clearAGauge() { if(aGaugeAnimation)aGaugeAnimation.cancel();aGaugeAnimation=null;aGaugeLight.hidden=true;aGauge.setAttribute('aria-label','Judgement energy: longest PERFECT, shortest MISS'); }
    function showAGauge(grade) {
      var strength={PERFECT:1,GREAT:.72,GOOD:.44,MISS:.12}[grade];
      if(aGaugeAnimation)aGaugeAnimation.cancel();aGaugeLight.hidden=false;aGaugeLight.dataset.grade=grade;aGaugeLight.dataset.strength=strength;aGaugeLight.style.left='50%';aGaugeLight.style.setProperty('--timing-color',aGaugeColors[grade]);aGauge.setAttribute('aria-label',grade);
      var transform=function(value){return 'translate(-50%,-50%) scaleX('+value+')';};
      var frames=aGaugeReduced.matches?[{transform:transform(strength),opacity:1},{transform:transform(strength),opacity:0}]:[{transform:transform(.02),opacity:.75,offset:0},{transform:transform(strength),opacity:1,offset:.12},{transform:transform(strength*.85),opacity:.75,offset:.42},{transform:transform(.02),opacity:0,offset:1}];
      var animation=aGaugeLight.animate(frames,{duration:400,easing:'linear',fill:'both'});aGaugeAnimation=animation;
      animation.onfinish=function(){if(aGaugeAnimation===animation){aGaugeLight.hidden=true;aGaugeAnimation=null;animation.cancel();}};
    }

    function updateStatusTime(t) {
      var seconds = Math.max(0, Math.ceil((buffer ? buffer.duration : 0) - Math.max(0,t)));
      if (seconds === statusSeconds) return;
      statusSeconds = seconds; statusTime.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2,'0');
    }
    function showJudge(i, txt, cls) {
      statusJudge.textContent = txt; showAGauge(txt);
      var j = el.querySelectorAll('.rp-judge')[i];
      j.className = 'rp-judge'; j.textContent = '';
      if (txt !== 'MISS') return;
      j.textContent = txt; j.className = 'rp-judge is-miss';
      replay(j,'is-on');
    }
    function hud() {
      $('[data-rp-score]').textContent = st.score.toLocaleString('en-US');
      $('[data-rp-combo]').textContent = String(st.combo);
      $('[data-rp-hp]').style.width = (st.hp / CONFIG.hpMax * 100) + '%';
      $('[data-rp-hpbar]').classList.toggle('is-low', st.hp <= 3);
    }

    // ---- 진행 ----
    function now() { return ctx.currentTime - st.t0 - (st.lat || 0); } // 음악 시각(초) — V1365 C: 소리 출력 지연·사용자 보정 반영
    function start() {
      lyricTicker.clear();
      var token = ++resultSerial, practice = false;
      try { src && src.stop(); } catch (e) {} cancelAnimationFrame(raf); st = null;
      return Promise.all([loadMeta(), loadSong(), preload()]).then(function (data) {
        return loadSfx().then(function () { return data[1]; });
      }).then(function (data) {
        if (token !== resultSerial || activeB || el.hidden) return;
        song = data.song; lyricTicker.set(song && song.lyrics,song); buffer = data.back; melBuf = data.melody; melGain = null;
        if (ctx.state === 'suspended') ctx.resume();
        buildStage(); layout(); placeStatic(); cacheHitGeometry(); // 버튼을 먼저 만들어야 무대 높이가 정확(v812)
        var notes = buildChart();
        // v813: 무기 그림을 시작 전에 전부 만들어 둠(숨김) — 플레이 중 생성/삭제로 인한 깜빡임 제거
        wlayer.innerHTML = '';
        notes.forEach(function (n) { n.renderPos={};n.trailPos=[{},{}];n.windPos={};n.el = document.createElement('img'); n.el.className = 'rp-weapon' + (n.weaponType === 'boomerang' ? ' rp-boomerang' : ''); n.el.src = A + 'w-' + n.weaponType + '.png';
          // 원반 = 테두리 그림은 그대로, 가운데 발바닥 면만 회전(사용자 지정 v817)
          if (n.weaponType === 'disc') {
            var img = n.el; img.className = ''; n.el = document.createElement('span'); n.el.className = 'rp-weapon rp-disc'; n.el.appendChild(img);
            n.face = document.createElement('img'); n.face.src = A + 'w-disc-face.png'; n.face.decoding = 'sync';
            var fw = document.createElement('span'); fw.className = 'rp-disc-face'; fw.appendChild(n.face); n.el.appendChild(fw);
          }
          // v834: 눈덩이 = x축으로 굴러오는 공(공 모양 그대로, 표면 무늬만 위→아래로 흐름)
          if (n.weaponType === 'snow') {
            var sb = n.el; sb.className = ''; n.el = document.createElement('span'); n.el.className = 'rp-weapon rp-snow'; n.el.appendChild(sb);
            var rl = document.createElement('span'); rl.className = 'rp-snow-roll'; n.roll = document.createElement('img'); n.roll.src = A + 'w-snow-roll.jpg'; n.roll.decoding = 'sync';
            rl.appendChild(n.roll); n.el.appendChild(rl); var sh = document.createElement('span'); sh.className = 'rp-snow-shade'; n.el.appendChild(sh);
          }
          if(n.weaponType==='heart')n.el.style.transformOrigin='50% '+(373/522*100)+'%';
          n.el.style.width = (L.weaponR * 2.4) + 'px'; n.el.style.opacity = '0'; n.el.decoding = 'sync';
          // 눈덩이·하트 화살 = 날아오는 잔상 2겹(사용자 지정 v816)
          if (n.weaponType !== 'boomerang') { // 잔상: 부메랑은 제외(사용자 지정 v835 — 바람 3줄만)
            n.trail = [0.32, 0.15].map(function (op) { var g = n.el.cloneNode(true); g.className = n.el.className + ' rp-trail'; g.dataset.op = op; wlayer.appendChild(g); return g; });
          }
          // 부메랑·원반 = 내려올 때 뒤로 바람 줄기(사용자 지정 v830)
          if (n.weaponType === 'boomerang' || n.weaponType === 'disc') { n.wind = document.createElement('span'); n.wind.className = 'rp-wind'; sizeWind(n); wlayer.appendChild(n.wind); }
          n.el.hidden=true;if(n.trail)n.trail.forEach(function(g){g.hidden=true;});if(n.wind)n.wind.hidden=true;
          wlayer.appendChild(n.el); });
        pangPool=[];pangIndex=0;for(var pi=0;pi<12;pi++){var pn=document.createElement('span');pn.className='rp-pang rp-pang-pooled';pn.textContent='PANG!';wlayer.appendChild(pn);pangPool.push(pn);}
        // v832: 반짝이 조각 40개 미리 생성(깜빡임 방지 — 게임 중 DOM 생성 금지 원칙)
        sparks = []; for (var si = 0; si < 40; si++) { var sk = document.createElement('span'); sk.className = 'rp-spark'; wlayer.appendChild(sk); sparks.push(sk); }
        notes.forEach(function (n) { n.pts = routeOf(n); n.len = pathLen(n.pts); n.spawnTime = n.targetTime - DIFFS[diff].travel; n.state = 'wait'; });
        st = { notes: notes, score: 0, combo: 0, maxCombo: 0, hp: CONFIG.hpMax, cnt: { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 },
          moles: [0, 1, 2, 3].map(function () { return { jumpAt: -9, hurtAt: -9 }; }), over: false, paused: false, practice: practice, songId: selectedASong.id, renderQueue:notes.slice().sort(function(a,b){return a.spawnTime-b.spawnTime;}), spawnCursor:0, activeNotes:[], doneCount:0 };
        moleFrame = [-1, -1, -1, -1]; for (var i = 0; i < 4; i++) setMoleFrame(i, 0);
        // 3·2·1·JUMP 음성이 끝난 뒤 음악과 실제 플레이 시계를 시작한다.
        var countdownAt = ctx.currentTime + 0.05;
        var countdownBuffer = sfxBuf[SFX.countdown[0]];
        sfx('countdown', countdownAt);
        var startAt = countdownAt + (countdownBuffer ? countdownBuffer.duration : 0);
        var musicLead = Math.min(0.65, countdownBuffer ? countdownBuffer.duration * 0.2 : 0.65);
        var musicAt = startAt - musicLead;
        st.countdownAt = countdownAt;
        st.playAt = startAt;
        st.t0 = musicAt; st.lat = sharedRules.latency(ctx);
        var gameMusicGain = ctx.createGain(); gameMusicGain.gain.setValueAtTime(0, musicAt); gameMusicGain.gain.linearRampToValueAtTime(0.56, musicAt + 1.4); gameMusicGain.connect(ctx.destination);
        var s1 = ctx.createBufferSource(); s1.buffer = buffer; s1.connect(gameMusicGain); s1.start(musicAt);
        var s2 = null;
        if (melBuf) { s2 = ctx.createBufferSource(); s2.buffer = melBuf; melGain = ctx.createGain(); melGain.gain.value = 1; s2.connect(melGain); melGain.connect(gameMusicGain); s2.start(musicAt); }
        src = { stop: function (w) { s1.stop(w); if (s2) s2.stop(w); } };
        resetBoss(); clearAGauge();
        beachVisual.start(song&&song.bpm);
        statusJudge.textContent = 'READY'; statusSeconds = -1; updateStatusTime(0);
        hud(); // (무기 풀은 위에서 생성 — 여기서 비우지 않음)
        el.querySelector('[data-rp-result]').hidden = true;
        cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); return true;
      }).catch(function () {
        if (token !== resultSerial || activeB || el.hidden) return;
        showSelect(); $('[data-rp-selected-song]').textContent = selectedASong.title + ' · ' + root.FGH.I18N.t('mole.rp.err.reselect'); return false;
      });
    }

    // 버튼 → 점프. 리듬 판정은 "두더지가 최고점에 닿는 시각" 기준(입력 시각 + 최고점까지 시간).
    function clearButtonWaves(){buttonWaves.forEach(function(a){if(a)a.cancel();});buttonWaves=[];}
    function press(lane, lag) {
      if (!st || st.over || st.paused || now() < 0 || (st.playAt && ctx.currentTime < st.playAt)) return;
      if(btnEls&&btnEls[lane])replay(btnEls[lane],'is-press-fx');
      var button=btnEls&&btnEls[lane],wave=button&&button.querySelector('.rp-a-wave');
      if(wave){if(buttonWaves[lane])buttonWaves[lane].cancel();var wa=wave.animate([{transform:'scale(.96)',opacity:0},{transform:'scale(1.08)',opacity:.75,offset:.22},{transform:'scale(1.18)',opacity:0}],{duration:260,easing:'ease-out',fill:'both'});buttonWaves[lane]=wa;wa.onfinish=function(){if(buttonWaves[lane]===wa){wa.cancel();buttonWaves[lane]=null;}};}
      var t = now() - (lag || 0), m = st.moles[lane];
      // v843(사용자: 연속 무기 두 번째가 안 뜀) — 올라가는 중엔 무시, 최고점 지나 내려오는 중이면 바로 다시 점프
      if (t - m.jumpAt < (CONFIG.apexFrame + 1) * CONFIG.jumpFrameMs / 1000) return;
      m.jumpAt = t; sfx('jump');
      var apexT = t + (CONFIG.apexFrame + 0.5) * CONFIG.jumpFrameMs / 1000;
      // 이 레인에서 판정 대상 노트(아직 처리 안 된 가장 가까운 것)
      var best = null;
      st.notes.forEach(function (n) {
        if (n.state !== 'live' || n.targetLane !== lane) return;
        var d = Math.abs(apexT - n.targetTime);
        if (!best || d < best.d) best = { n: n, d: d };
      });
      var J = DIFFS[diff].judge;
      if (!best || best.d * 1000 > J.goodMs) {
        // 잘못된 레인/근처에 노트 없음 → MISS(명세 §22)
        if (!best) { miss(lane, null); return; }
        best.n.press = { grade: null }; // 리듬 범위 밖 — 충돌해도 성공 아님
        return;
      }
      var ms = best.d * 1000;
      best.n.press = { grade: ms <= J.perfectMs ? 'PERFECT' : ms <= J.greatMs ? 'GREAT' : 'GOOD', lane: lane };
    }
    function hit(n, lane) {
      n.state = 'hit'; n.hitAt = now(); if (n.trail) n.trail.forEach(function (g) { g.style.opacity = '0'; }); if (n.wind) n.wind.style.opacity = '0';
      melody(true);
      var g = n.press.grade; st.cnt[g]++; st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo);
      st.score += sharedRules.points(g, st.combo);
      n.vx = (Math.random() < 0.5 ? -1 : 1) * (L.laneW * (1.5 + Math.random())); n.vy = -L.H * 1.1; n.bx = n.cx; n.by = n.cy;
      n.perfectFlight = null;
      if(g==='PERFECT'){
        var topOffset=hitGeometry.topOffset;
        var endY=-topOffset-L.weaponR*4,margin=Math.min(L.W*.24,L.weaponR*2.5);
        var spread=(n.by-endY)*.45,minX=Math.max(margin,n.bx-spread),maxX=Math.min(L.W-margin,n.bx+spread);
        var endX=minX+Math.random()*Math.max(0,maxX-minX);
        n.perfectFlight={duration:.72,dx:endX-n.bx,dy:endY-n.by};
      }
      showJudge(lane, g, g.toLowerCase());
      if(g==='PERFECT')statusFx.hit();
      var hitButton=btnEls&&btnEls[lane];
      if(hitButton){clearTimeout(buttonHitTimers[lane]);hitButton.dataset.grade=g;replay(hitButton,'is-hit');buttonHitTimers[lane]=setTimeout(function(){hitButton.classList.remove('is-hit');delete hitButton.dataset.grade;buttonHitTimers[lane]=0;},420);}
      pang(lane, n.cx, n.cy); hud(); sfx('hit');
      try { if (root.FGH && root.FGH.Settings && root.FGH.Settings.vibrate) root.FGH.Settings.vibrate(160); else if (navigator.vibrate) navigator.vibrate(160); } catch (e) { /* 무시 */ } // V1351 C 비치 타격 진동(네온과 같은 160ms, 설정 반영)
      var word=perfectWords[lane],geometry=hitGeometry.buttons[lane];
      if(word&&geometry){word.textContent=g;word.dataset.grade=g;word.style.left=geometry.x+'px';word.style.top=geometry.y+'px';word.style.setProperty('--rp-grade-rise',geometry.rise+'px');replay(word,'is-on');}
      burst(n.cx, n.cy, g === 'PERFECT' ? 10 : g === 'GREAT' ? 7 : 5); comboFx();
      try { MG.HitFx && MG.HitFx.uiTap && MG.HitFx.uiTap(1); } catch (e) { /* 무시 */ }
    }
    function miss(lane, n) {
      if (n) { n.state = 'miss'; if (n.trail) n.trail.forEach(function (g) { g.style.opacity = '0'; }); if (n.wind) n.wind.style.opacity = '0'; }
      melody(false);
      st.cnt.MISS++; st.combo = 0; updateACombo(0,false); st.hp = Math.max(0, st.hp - 1);
      st.moles[lane].hurtAt = now();
      showJudge(lane, 'MISS', 'miss'); hud();
      // V1170: normal A/B rounds always continue to the end of the song.
    }
    // ---- v831 연출 ----
    var hippo = el.querySelector('.rp-hippo'), sparks = [], sparkI = 0, pangPool=[], pangIndex=0;
    // v834: 갈매기 = 날개 위아래 날갯짓 + 매번 랜덤 높이·방향·속도·크기로 날아감(사용자 지정)
    el.querySelectorAll('.rp-gull').forEach(function (g) {
      function fly() {
        var ltr = Math.random() < 0.5, W = el.clientWidth || 400;
        g.style.setProperty('--x0', (ltr ? -50 : W + 50) + 'px'); g.style.setProperty('--x1', (ltr ? W + 50 : -50) + 'px');
        g.style.setProperty('--dy', ((Math.random() - 0.5) * 60).toFixed(0) + 'px');
        g.style.top = (18 + Math.random() * 16).toFixed(1) + '%'; g.style.width = (16 + Math.random() * 14).toFixed(0) + 'px';
        g.style.animationDuration = (9 + Math.random() * 9).toFixed(1) + 's'; g.style.animationDelay = (Math.random() * 5).toFixed(1) + 's';
        g.firstChild.style.animationDuration = (0.32 + Math.random() * 0.2).toFixed(2) + 's';
        replay(g,'is-fly');
      }
      g.addEventListener('animationend', function (e) { if (e.target === g) fly(); });
      fly();
    });
    function burst(x, y, k) { // 명중 자리에서 반짝이 조각이 사방으로
      for (var i = 0; i < k; i++) {
        var a = (i / k) * Math.PI * 2 + Math.random() * 0.5, d = L.laneW * (0.45 + Math.random() * 0.35);
        var sp = sparks[sparkI++ % sparks.length]; sp.textContent = i % 3 ? '✦' : '★'; sp.style.left = x + 'px'; sp.style.top = y + 'px';
        sp.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px'); sp.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1) + 'px');
        sp.style.color = ['#fff36b', '#ffffff', '#ffb3e6', '#8ff0ff'][i % 4]; replay(sp, 'is-on');
      }
    }
    var boss = el.querySelector('.rp-a-cloud-boss');
    var bossColors = ['#20bfff','#ff43d7','#ffda00','#56f52d'];
    var comboBackdrop=document.createElement('div');comboBackdrop.className='rp-a-combo-atmosphere';el.insertBefore(comboBackdrop,el.firstChild);
    var comboTones=bossColors.map(function(color){var node=document.createElement('i');node.className='rp-a-combo-tone';node.style.backgroundColor=color;comboBackdrop.appendChild(node);return node;});
    var comboSweeps=['upper','lower'].map(function(side){var node=document.createElement('div');node.className='rp-a-combo-sweep rp-a-combo-sweep--'+side;node.appendChild(document.createElement('span'));comboBackdrop.appendChild(node);return node;});
    var comboAnimations=[],aComboStage=0;
    function clearComboSweeps(){comboAnimations.forEach(function(a){a.cancel();});comboAnimations.length=0;}
    function updateACombo(combo,immediate){
      var theme=Math.floor(combo/10);if(theme===aComboStage&&!immediate)return;lyricTicker.color(theme?bossColors[(theme-1)%bossColors.length]:bossColors[0]);aComboStage=theme;clearComboSweeps();
      comboTones.forEach(function(node,i){node.style.transitionDuration=immediate?'0ms':'500ms';node.style.opacity=theme&&i===(theme-1)%bossColors.length?'.05':'0';});
      boss.style.setProperty('--rp-boss-opacity',String(Math.max(0,1-theme*.1)));
      if(!theme||immediate)return;
      var color=bossColors[(theme-1)%bossColors.length];boss.style.setProperty('--rp-boss-color',color);
      if(root.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      comboSweeps.forEach(function(node,i){node.style.setProperty('--combo-color',color);comboAnimations.push(node.firstElementChild.animate([{transform:'translateY('+(i?'-100%':'800%')+')',opacity:0,offset:0},{opacity:.65,offset:.12},{transform:'translateY('+(i?'800%':'-100%')+')',opacity:0,offset:1}],{duration:500,easing:'linear'}));});
    }
    function resetBoss() { updateACombo(0,true); boss.style.setProperty('--rp-boss-scale','1'); boss.style.setProperty('--rp-boss-color','transparent'); boss.style.setProperty('--rp-boss-opacity','1'); boss.style.opacity='1'; }
    function comboFx() {
      var c = $('[data-rp-combo]'); replay(c, 'is-bump');
      if (st.combo > 0 && st.combo <= 100 && st.combo % 10 === 0) updateACombo(st.combo,false);
      if (st.combo > 0 && st.combo <= 100 && st.combo % 10 === 0) { beachVisual.hurt(now()); beachVisual.combo(); }
      if (st.combo <= 100 && (st.combo === 10 || st.combo === 30 || (st.combo >= 50 && st.combo % 50 === 0))) {
        var mt = document.createElement('span'); mt.className = 'rp-milestone'; mt.textContent = st.combo + ' COMBO!'; stage.appendChild(mt);
        setTimeout(function () { mt.remove(); }, 1300);
      }
    }
    function pang(lane, x, y) {
      var p=pangPool[pangIndex++%pangPool.length];if(!p)return;
      if(p._animation)p._animation.cancel();p.style.left=x+'px';p.style.top=y+'px';
      p._animation=p.animate([{transform:'translate(-50%, -50%) scale(.4)',opacity:0},{transform:'translate(-50%, -50%) scale(1.25)',opacity:1,offset:.3},{transform:'translate(-50%, -90%) scale(1)',opacity:0}],{duration:600,easing:'ease-out',fill:'both'});
    }

    function loop() {
      raf = requestAnimationFrame(loop);
      if (!st || st.paused) return;
      if (st.ended) { cancelAnimationFrame(raf); return; } // v816: 종료 후 결과창 뒤에서 계속 판정·연출이 돌며 깜빡이던 것 정지
      var t = now();
      beachVisual.update(t);
      updateStatusTime(t);
      lyricTicker.update(t);
      // 카운트다운 중에는 입력·노트·음악 시계가 멈춰 있고, 음성이 끝난 뒤 게임이 시작된다.
      var ci = countEl, countdownElapsed = ctx.currentTime - st.countdownAt;
      if (ctx.currentTime < st.playAt) { ci.textContent = countdownElapsed < 0.85 ? '3' : countdownElapsed < 1.70 ? '2' : countdownElapsed < 2.55 ? '1' : 'JUMP'; ci.hidden = false; }
      else ci.hidden = true;
      if (ctx.currentTime < st.playAt) return;
      // 두더지 프레임 + 머리 원
      var heads = frameHeads;
      for (var i = 0; i < 4; i++) {
        var m = st.moles[i], dt = (t - m.jumpAt) * 1000, f = 0;
        if (dt >= 0 && dt < 7 * CONFIG.jumpFrameMs) f = Math.min(6, Math.floor(dt / CONFIG.jumpFrameMs));
        setMoleFrame(i, f);
        moleFrame = moleFrame || [-1, -1, -1, -1];
        moleEls[i].style.translate = '0 ' + (-liftAt(i, f)) + 'px';
        var me = moleEls[i];
        me.classList.toggle('is-hurt', t - m.hurtAt < 0.45);
        dizzyEls[i].classList.toggle('is-on', t - m.hurtAt < 1.0);
        headAt(i,f,heads[i].h);heads[i].jumping=f>0&&f<6;
      }
      // V1170: activate in spawn order; keep waiting/retired sprites out of rendering.
      while(st.spawnCursor<st.renderQueue.length&&t>=st.renderQueue[st.spawnCursor].spawnTime-LAUNCH)st.activeNotes.push(st.renderQueue[st.spawnCursor++]);
      // 무기
      st.activeNotes.forEach(function (n) {
        // v812(사용자 지정): 바다 수평선 부근에서 정면으로 던져져(작게) 포물선으로 화면 최상단까지 올라온 뒤(크게) 두더지 쪽으로 떨어짐
        if (n.state === 'wait' && t >= n.spawnTime - LAUNCH) {
          n.state = 'live';n.el.hidden=false;if(n.trail)n.trail.forEach(function(g){g.hidden=false;});if(n.wind)n.wind.hidden=false;
          if (n.trail) n.trail.forEach(function (g) { g.style.opacity = '0'; }); if (n.wind) n.wind.style.opacity = '0';
        }
        if (n.state === 'live') {
          var cur = flyAt(n, t, n.renderPos);
          if (n.face) { n.face.style.transform = 'rotate(' + cur.rot.toFixed(1) + 'deg)'; cur.rot = 0; }
          n.el.style.transform = xf(cur, n); n.el.style.opacity = String(cur.op);
          if (n.roll && t >= n.spawnTime) n.roll.style.transform = 'translateY(' + (-50 + 50 * (((t - n.spawnTime) * 1.8) % 1)).toFixed(2) + '%)';
          if (n.trail) n.trail.forEach(function (g, gi) {
            var boom = n.weaponType === 'boomerang', q = flyAt(n, t - (boom ? 0.08 : 0.035) * (gi + 1), n.trailPos[gi]); if (n.face) q.rot = 0; // 원반 잔상은 테두리 고정
            if (boom) q.rot = cur.rot; // v834: 부메랑 잔상은 뒤쪽에만 — 본체와 같은 각도로, 더 멀리 떨어뜨려 감싸는 번짐 없앰
            if (q.op <= 0) { g.style.opacity = '0'; return; }
            g.style.transform = xf(q, n); g.style.opacity = String(q.op * +g.dataset.op);
          });
          if (n.wind) {
            if (t < n.spawnTime) n.wind.style.opacity = '0';
            else { var pv = flyAt(n, t - 0.03, n.windPos), ang = Math.atan2(-(cur.x - pv.x), cur.y - pv.y) * 180 / Math.PI;
              n.wind.style.transform = 'translate(' + (cur.x - L.weaponR * 1.3) + 'px,' + (cur.y - L.weaponR * 4.4) + 'px) rotate(' + ang.toFixed(1) + 'deg)';
              n.wind.style.opacity = ((n.weaponType === 'boomerang' ? 0.32 : 0.45) + 0.06 * Math.sin(t * 38)).toFixed(2); } // v832: 반투명(사용자 지정)
          }
          if (t < n.spawnTime) { n.cx = cur.x; n.cy = -9999; return; } // 던져 올라오는 구간(판정 없음)
          var p = cur; n.cx = p.x; n.cy = p.y;
          // 물리 충돌: 그 레인 두더지가 점프 중이고 머리 원과 무기 원이 겹침
          var hd = heads[n.targetLane];
          if (Math.abs(p.x - L.laneX[n.targetLane]) < 1 && hd.jumping && Math.hypot(p.x - hd.h.x, p.y - hd.h.y) < hd.h.r + L.weaponR) {
            if (n.press && n.press.grade && n.press.lane === n.targetLane) hit(n, n.targetLane);
            else { n.hurtBy = true; miss(n.targetLane, n); }
          }
          // 아무도 못 맞힘 → 무기가 가만히 있는 두더지 머리에 맞음 = MISS
          else if (t > n.targetTime + DIFFS[diff].judge.goodMs / 1000 && p.y >= heads[n.targetLane].h.y - heads[n.targetLane].h.r) miss(n.targetLane, n);
        }
        if (n.state === 'hit') { // 튕김
          var k = t - n.hitAt;
          if(n.perfectFlight){var p=Math.min(1,k/n.perfectFlight.duration);n.cx=n.bx+n.perfectFlight.dx*p;n.cy=n.by+n.perfectFlight.dy*p;}
          else {n.cx = n.bx + n.vx * k; n.cy = n.by + n.vy * k + L.H * 2.2 * k * k;}
          n.el.style.transform = 'translate(' + (n.cx - L.weaponR * 1.2) + 'px,' + (n.cy - L.weaponR * (n.weaponType==='heart'?2.4*373/307:1.2)) + 'px) scale(' + (n.weaponType === 'boomerang' || n.weaponType === 'disc' ? 1.2 : 1) + ') rotate(' + (t * 900) + 'deg)';
          n.el.style.opacity = n.perfectFlight ? String(Math.max(0,Math.min(1,(n.perfectFlight.duration-k)/(n.perfectFlight.duration*.16)))) : String(Math.max(0, 1 - k * 1.6));
          if (k > (n.perfectFlight ? n.perfectFlight.duration : 0.7)) { n.el.style.opacity = '0'; if (n.trail) n.trail.forEach(function (g) { g.style.opacity = '0'; }); if (n.wind) n.wind.style.opacity = '0'; n.state = 'done'; }
        }
        if (n.state === 'miss') { // 두더지에 맞고 튕겨 떨어짐
          if (!n.missAt) n.missAt = t;
          var q = t - n.missAt; n.el.style.opacity = String(Math.max(0, 1 - q * 2.5));
          n.el.style.transform += ' translateY(' + (q * 120) + 'px)';
          if (q > 0.4) { n.el.style.opacity = '0'; if (n.trail) n.trail.forEach(function (g) { g.style.opacity = '0'; }); if (n.wind) n.wind.style.opacity = '0'; n.state = 'done'; }
        }
      });
      // v814(사용자 지정): 무기가 타겟에 다가오면(도착 0.5초 전~도착 0.15초 후) 그 레인 버튼에 불빛
      var kept=0;for(var ai=0;ai<st.activeNotes.length;ai++){var an=st.activeNotes[ai];if(an.state==='done'){st.doneCount++;an.el.hidden=true;if(an.trail)an.trail.forEach(function(g){g.hidden=true;});if(an.wind)an.wind.hidden=true;}else st.activeNotes[kept++]=an;}st.activeNotes.length=kept;
      var cue = frameCues;cue.fill(0);
      st.activeNotes.forEach(function (n) { if (n.state === 'live' && n.targetTime - t < 0.5 && n.targetTime - t > -0.15) cue[n.targetLane] = 1; });
      var btns = btnEls || (btnEls = el.querySelectorAll('.rp-btn'));
      for (var bi = 0; bi < 4; bi++) if (btns[bi]) {btns[bi].classList.toggle('is-cue', !!cue[bi]);if(targetCue[bi]!==cue[bi]){targetLanes[bi].classList.toggle('is-approaching',!!cue[bi]);targetCue[bi]=cue[bi];}}
      // 종료: 모든 노트 처리 후
      // v948(사용자 지정): 곡 끝(마무리)까지 듣고 결과창 — 예전엔 마지막 노트 0.9초 뒤 바로 끊었음
      if (!st.over && st.doneCount===st.notes.length) {
        st.over = true;
        var left = buffer && buffer.duration ? (buffer.duration - now()) * 1000 : 0;
        var me = st; // v980: 이 판의 클리어 타이머 — 그 사이 그만하기/다른 난이도로 새 판이 시작되면 새 판을 클리어 처리하던 버그(HARD 클리어·풀콤보 잘못 기록)
        setTimeout(function () { if (st === me) gameOver(true); }, Math.max(900, left - 300));
      }
    }

    function gameOver(clear) {
      statusFx.stop(); clearButtonWaves();
      beachVisual.stop();
      lyricTicker.clear();
      if (st.ended) return; st.ended = true; st.over = true; el.querySelectorAll('.rp-btn').forEach(function (b) { b.classList.remove('is-cue'); }); // 결과창 뒤 버튼 반짝임 정지
      try { src.stop(ctx.currentTime + (clear ? 0.8 : 0.05)); } catch (e) { /* 무시 */ }
      clearComboSweeps(); clearAGauge();
      showResult(st, clear, false);
    }
    function showResult(result, clear, isB) {
      var token = ++resultSerial, resultDiff = isB ? result.diff : diff;
      var r = $('[data-rp-result]');
      var rating=sharedRules.resultRating(result.cnt,isB?result.totalNotes:result.notes.length,clear);
      var rewardEl=$('[data-rp-ticket-reward]'); rewardEl.hidden=true;
      if (!isB && clear && rating.fullCombo && (resultDiff==='NORMAL'||resultDiff==='HARD') && !result.practice && !result.bTicketRewardGranted) {
        if (MG.Economy && MG.Economy.addTickets) { MG.Economy.addTickets(1); result.bTicketRewardGranted=true; rewardEl.textContent='TICKET +1'; rewardEl.hidden=false; }
      }
      var rankEl=$('[data-rp-res-rank]'),badgeEl=$('[data-rp-res-achievement]');rankEl.classList.remove('is-stamped');badgeEl.classList.remove('is-stamped');
      rankEl.textContent=rating.rank;rankEl.dataset.rank=rating.rank;
      $('[data-rp-res-accuracy]').textContent=(Math.floor(rating.accuracy*100+1e-8)/100).toFixed(2)+'%';
      badgeEl.textContent=rating.allPerfect?'ALL PERFECT':rating.fullCombo?'FULL COMBO':'';badgeEl.hidden=!badgeEl.textContent;

      var bk = (isB ? bBestPrefix() : aBestPrefix()) + resultDiff, old = parseInt(localStorage.getItem(bk), 10) || 0, isNew = !result.practice && result.score > old;
      if (isNew) { localStorage.setItem(bk, String(result.score)); localStorage.setItem(bk+'.result', JSON.stringify({rank:rating.rank,accuracy:rating.accuracy,fullCombo:rating.fullCombo})); }
      try { if (!isB && !result.practice && MG.Quest) MG.Quest.recordRhythm({ diff: resultDiff, clear: clear, miss: result.cnt.MISS, perfect: result.cnt.PERFECT }); } catch (e) { /* 무시 */ } // v895: 리듬팡 업적
      $('[data-rp-res-best]').innerHTML = '<small>' + (result.practice ? 'TEST · ' + resultDiff : resultDiff + ' BEST') + '</small><b>' + (result.practice ? old : Math.max(old, result.score)).toLocaleString('en-US') + '</b>';
      var stamp = $('[data-rx-new]'); stamp.classList.remove('is-on');
      r.classList.toggle('is-fail', !clear);
      var sEl = $('[data-rp-res-score]'), fin = result.score; sEl.textContent = '0';
      $('[data-rp-res-combo]').textContent = result.maxCombo;
      ['PERFECT', 'GREAT', 'GOOD', 'MISS'].forEach(function (g) { $('[data-rp-res-' + g.toLowerCase() + ']').textContent = result.cnt[g]; });
      setTimeout(function () {
        if (token !== resultSerial) return;
        r.hidden = false;
        var t0 = performance.now(); // v831: 점수 0 → 최종 카운트업(0.9초) 뒤 신기록이면 NEW! 도장
        (function up(now) { if (token !== resultSerial) return; var k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3); sEl.textContent = Math.round(fin * e).toLocaleString('en-US');
          if (k < 1) requestAnimationFrame(up); else {if(isNew&&fin>0)stamp.classList.add('is-on');rankEl.classList.add('is-stamped');if(!badgeEl.hidden)badgeEl.classList.add('is-stamped');} })(t0);
      }, clear ? 700 : 300);
    }

    function pause(on) {
      var qc = $('[data-rp-quit-cost]'); if (qc && on) qc.textContent = '-' + quitCost();
      statusFx.pause(on);buttonWaves.forEach(function(a){if(a){if(on)a.pause();else a.play();}});
      if(!activeB)beachVisual.pause(on);
      lyricTicker.pause(on);
      comboAnimations.forEach(function(a){if(on)a.pause();else a.play();});
      if (activeB) {
        el.querySelectorAll('[data-rx-pause-t] textPath').forEach(function (t) { t.textContent = root.FGH.I18N.t('mole.rp.pause'); });
        bGame.pause(on); $('[data-rp-pause]').hidden = !on; return;
      }
      if (!st || st.ended) return;
      var pt = root.FGH.I18N.t('mole.rp.pause'); // v826: 한글은 일시정지, 영어는 PAUSE
      el.querySelectorAll('[data-rx-pause-t] textPath').forEach(function (t) { t.textContent = pt; });
      st.paused = on; $('[data-rp-pause]').hidden = !on;
      if (on) ctx.suspend(); else ctx.resume();
      if(aGaugeAnimation){if(on)aGaugeAnimation.pause();else aGaugeAnimation.play();}
    }
    // V1365 C: 앱이 가려지면(홈 버튼·전화·알림·화면 잠금) 진행 중인 판을 일시정지 창으로 — 돌아와도 노트가 지나가 MISS 되지 않게
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden || el.hidden) return;
      if (activeB) { var d = bGame && bGame.dbg(); if (d && !d.loading && !d.ended && !d.paused) pause(true); }
      else if (st && !st.over && !st.paused) pause(true);
    });
    // 창 버튼 누름 효과(v820) — 폰에서 :active 가 잘 안 먹어 직접 클래스 토글
    el.querySelectorAll('.rx-btn').forEach(function (b) {
      b.addEventListener('pointerdown', function () { b.classList.add('is-press'); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('is-press'); }); });
    });
    $('[data-rp-pausebtn]').addEventListener('click', function () { pause(true); });
    $('[data-rp-resume]').addEventListener('click', function () { pause(false); });
    // V1424 C 사용자: 그만하기 = 하트 대신 파란 음표 티켓, 곡이 2분30초 이상이면 2장(네온·비치 같음)
    function quitCost() { var s = activeB ? selectedBSong : selectedASong; return (s && s.duration >= 150) ? 2 : 1; }
    $('[data-rp-quit]').addEventListener('click', function () {
      if (MG.Economy) for (var i = 0; i < quitCost(); i++) MG.Economy.spendTicket();
      showSongs();
    });
    $('[data-rp-retry]').addEventListener('click', function () { launchSong($('[data-rp-result]')); }); // v841: 다시하기 = 탄성 밀어내기
    $('[data-rp-home]').addEventListener('click', showSongs);
    $('[data-rp-other]').addEventListener('click', function () { if (activeB) { bGame.stop(); showSelect(); return; } cancelAnimationFrame(raf); try { src && src.stop(); } catch (e) { /* 무시 */ } st = null; showSelect(); });

    function close(why) {
      statusFx.stop(); clearButtonWaves();
      setEntryBgm(false);
      cancelEntry();
      beachVisual.stop();
      updateACombo(0,true);
      lyricTicker.clear();
      clearAGauge();
      resultSerial++;
      if (bGame) bGame.stop(); activeB = false;
      cancelAnimationFrame(raf);
      try { src && src.stop(); } catch (e) { /* 무시 */ }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      st = null; $('[data-rp-pause]').hidden = true;
      opts.onClose(why);
    }
    function showSelect() {
      setEntryBgm(false, 900);
      updateModeSign();
      resultSerial++;
      $('[data-rp-songs]').hidden = true;
      $('[data-rp-song-back]').hidden = false;
      $('[data-rp-selected-song]').hidden = false;
      $('[data-rp-selected-song]').textContent = activeB ? selectedBSong.title : selectedASong.title; paintTickets();
      $('[data-rp-result]').hidden = true; $('[data-rp-pause]').hidden = true;
      el.querySelectorAll('[data-rp-diff]').forEach(function (b) {
        var d = b.getAttribute('data-rp-diff'), best = parseInt(localStorage.getItem((activeB ? bBestPrefix() : aBestPrefix()) + d), 10) || 0;
        b.querySelector('small').textContent = best.toLocaleString('en-US');
      });
      $('[data-rp-select]').hidden = false;
    }
    function updateModeSign(){
      el.querySelectorAll('[data-rp-mode-name]').forEach(function(t){t.textContent=activeB?'NEON':'BEACH';});
      el.querySelectorAll('.rp-mode-sign').forEach(function(sign){sign.setAttribute('aria-label',activeB?'RhythmPang Neon':'RhythmPang Beach');});
    }
    // v841: 탄성 밀어내기로 게임 화면 진입(난이도 선택 → 게임, 결과창 다시하기 → 게임)
    function pushInGame(modal) {
      // v878(사용자 지정): 탄성 밀어내기 → 글리치(다른 화면과 통일)
      modal.hidden = true;
      // V 1113 G: keep B's opaque screen fixed while only its board enters.
      var entryTarget = activeB ? $('[data-rp-b] .rb-board') : el;
      if (activeB) el.classList.remove('glitch-in');
      replay(entryTarget,'glitch-in');
      setTimeout(function () { entryTarget.classList.remove('glitch-in'); }, 260);
    }
    el.querySelectorAll('[data-rp-diff]').forEach(function (b) {
      b.addEventListener('click', function () {
        if(entryBusy||adBusy)return;
        diff = b.getAttribute('data-rp-diff');
        launchSong($('[data-rp-select]'));
      });
    });
    $('[data-rp-sel-close]').addEventListener('click', function () { close(); });
    // V 1023 G: 홈 → 타입 선택 → A 기존 난이도 / B 제작 중.
    function showTypes() {
      paintTickets();
      setEntryBgm(true);
      cancelEntry();
      beachVisual.stop();
      updateACombo(0,true);
      lyricTicker.clear();
      resultSerial++;
      $('[data-rp-result]').hidden = true;
      if (bGame) bGame.stop(); activeB = false;
      $('[data-rp-pause]').hidden = true;
      $('[data-rp-select]').hidden = true;
      $('[data-rp-songs]').hidden = true;
      $('[data-rp-b]').hidden = true;
      $('[data-rp-types]').hidden = false;
      stage.hidden = true;
      el.classList.remove('is-type-b');
    }
    $('[data-rp-type="A"]').addEventListener('click', function () {
      $('[data-rp-types]').hidden = true;
      stage.hidden = false;
      showSongs();
    });
    $('[data-rp-type="B"]').addEventListener('click', function () {
      $('[data-rp-types]').hidden = true;
      $('[data-rp-b]').hidden = false;
      el.classList.add('is-type-b'); activeB = true;
      if (!bGame) bGame = root.__rhythmB = MG.RhythmB.create({
        root: $('[data-rp-b]'), rules: sharedRules,
        loadSong: function () {
          if (!ctx) ctx = new (root.AudioContext || root.webkitAudioContext)();
          if (ctx.state === 'suspended') ctx.resume();
          return loadBSong();
        },
        onSong: function (song) { lyricTicker.set(song && song.lyrics,song); lyricTicker.color('#00cfff'); },
        onComboColor: function (color) { lyricTicker.color(color); },
        onTime: function (time) { lyricTicker.update(time); },
        onStop: function () { lyricTicker.clear(); },
        onPause: function () { pause(true); },
        onResult: function (stats, clear) { lyricTicker.clear(true); showResult(stats, clear, true); }
      });
      showSongs();
    });
    $('[data-rp-song-back]').addEventListener('click', showSongs);
    $('[data-rp-songs-back]').addEventListener('click', showTypes);
    $('[data-rp-songs-home]').addEventListener('click', function () { close(); });
    $('[data-rp-types-home]').addEventListener('click', function () { close(); });
    // V1367 C: 진입 = 스코어 리듬팡 탭 해금(mole.rp.entered). V1369 C: 이 주석이 한 줄 함수 안에 들어가 아래 el.hidden=false 까지 막았던 것 수정
    function open() { try { localStorage.setItem('mole.rp.entered', '1'); } catch (e) {} setEntryBgm(true); resetBoss(); clearAGauge(); el.hidden = false; $('[data-rp-pause]').hidden = true; $('[data-rp-result]').hidden = true; wlayer.innerHTML = '';
      // v974(사용자 지정): 진입 시 배경은 항상 첫 화면 — 지난 판의 두더지·구멍·버튼·점수·HP 잔상 비움(시작하면 start() 가 다시 만듦)
      $('[data-rp-lanes]').innerHTML = ''; $('[data-rp-btns]').innerHTML = ''; moleEls = null; btnEls = null;
      $('[data-rp-score]').textContent = '0'; $('[data-rp-combo]').textContent = '0'; statusJudge.textContent = 'READY'; statusTime.textContent = '0:00'; statusSeconds = -1; $('[data-rp-hp]').style.width = ''; $('[data-rp-hpbar]').classList.remove('is-low');
      showTypes(); }
    return { open: open, close: close, CONFIG: CONFIG, setDiff: function (d) { diff = d; }, start: function () { start(); }, press: function (l) { press(l); }, dbg: function () { return st ? { t: now(), notes: st.notes, score: st.score, combo: st.combo, hp: st.hp, cnt: st.cnt } : null; } };
  }

  var sharedRules = {
    config: CONFIG, diffs: DIFFS,
    grade: function (ms, difficulty) { var J = DIFFS[difficulty].judge; return ms <= J.perfectMs ? 'PERFECT' : ms <= J.greatMs ? 'GREAT' : ms <= J.goodMs ? 'GOOD' : null; },
    // V1365 C: 판정 시계 보정 — 소리 출력 지연(폰 50~150ms)만큼 늦춰 "들리는 박자"에 맞추고, 사용자 보정값(ms, 리듬팡 설정)을 더함
    latency: function (ctx) { var out = ctx && (ctx.outputLatency || ctx.baseLatency) || 0, user = 0; try { user = Number(localStorage.getItem('mole.rp.offsetMs')) || 0; } catch (e) {} return Math.max(0, Math.min(0.3, out)) + Math.max(-200, Math.min(200, user)) / 1000; },
    // V1365 C: 터치가 실제로 일어난 뒤 처리까지 밀린 시간(프레임 저하) — 판정은 실제 누른 시각 기준
    eventLag: function (e) { return e && e.timeStamp ? Math.max(0, Math.min(0.15, (performance.now() - e.timeStamp) / 1000)) : 0; },
    // V1368 C 곡 해금(사용자 지정): 앞 2곡 무료, 3번째부터 바로 앞 곡을 A등급 이상(비치·네온·난이도 무관) → 새 곡은 목록 끝에 붙어 자동 연결
    songLock: function (index) {
      var list = CONFIG.bSongs, prev = list[index - 1], ok = ['A', 'AA', 'AAA', 'S', 'SS', 'SSS'];
      if (!CONFIG.songLock || index < 2 || !prev) return null;
      var passed = ['mole.rp.best.', 'mole.rp.b.best.'].some(function (base) { return ['EASY', 'NORMAL', 'HARD'].some(function (d) {
        try { return ok.indexOf((JSON.parse(localStorage.getItem(base + (prev.id === 'fever2' ? '' : prev.id + '.') + d + '.result') || 'null') || {}).rank) >= 0; } catch (e) { return false; }
      }); });
      return passed ? null : { needTitle: prev.title };
    },
    points: function (grade, combo) { return Math.round(CONFIG.score[grade] * (1 + Math.min(combo, 100) / 200)); },
    resultRating: function (cnt, totalNotes, clear) {
      var n=totalNotes||0,base=(cnt.PERFECT||0)*300+(cnt.GREAT||0)*200+(cnt.GOOD||0)*100,max=n*300;
      var accuracy=max?Math.min(100,base/max*100):0,allPerfect=!!clear&&n>0&&cnt.PERFECT===n;
      var fullCombo=!!clear&&n>0&&(cnt.MISS||0)===0&&(cnt.PERFECT||0)+(cnt.GREAT||0)+(cnt.GOOD||0)===n;
      var rank='F',bands=[['SS',98],['S',95],['AAA',90],['AA',80],['A',70],['B',60],['C',50],['D',40]];
      if(allPerfect)rank='SSS';else if(max)for(var i=0;i<bands.length;i++)if(base*100>=max*bands[i][1]){rank=bands[i][0];break;}
      return {rank:rank,accuracy:accuracy,fullCombo:fullCombo,allPerfect:allPerfect};
    }
  };
  var api = { create: create, rules: sharedRules };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Rhythm = api; }
})(typeof window !== 'undefined' ? window : null);

