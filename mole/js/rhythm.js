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
    bSongs: [{ id: 'le-monde-attendra-demain', title: 'Le monde attendra demain', duration: 119.96, chart: 'audio/rp/le-monde-attendra-demain.json', aChart: 'audio/rp/le-monde-attendra-demain-a.json', lyrics: 'audio/rp/le-monde-attendra-demain-lyrics.json' }, { id: 'meet-me-halfway', title: 'Meet Me Halfway', duration: 119.56, chart: 'audio/rp/meet-me-halfway.json', aChart: 'audio/rp/meet-me-halfway-a.json', lyrics: 'audio/rp/meet-me-halfway-lyrics.json' }, { id: 'paper-engine-ride', title: 'Paper-Engine Ride', duration: 119.88, chart: 'audio/rp/paper-engine-ride.json', aChart: 'audio/rp/paper-engine-ride-a.json', lyrics: 'audio/rp/paper-engine-ride-lyrics.json' }, { id: 'the-world-is-wide', title: 'The World Is Wide', duration: 119.56, chart: 'audio/rp/the-world-is-wide.json', aChart: 'audio/rp/the-world-is-wide-a.json', lyrics: 'audio/rp/the-world-is-wide-lyrics.json' }],
    songData: 'audio/rp/fever2.json', // v843: 곡 분석 데이터(반주·멜로디 분리 + 난이도별 노트 시각) — 맞히면 멜로디가 연주됨
    chart: { startBeat: 8, beats: 116 },           // 8박(인트로) 뒤부터 116박 = 한 판 약 90초(사용자 지정 v837, 이전 64박≈52초)
    judge: { perfectMs: 70, greatMs: 130, goodMs: 200 },
    score: { PERFECT: 300, GREAT: 200, GOOD: 100 },
    hpMax: 10,
    jumpFrameMs: 60,                                // 7프레임 × 60ms (v843: 80→60, 점프 반응 빠르게 — 사용자 지정)
    apexFrame: 3,                                   // 0부터 — 최고점 프레임(에셋 실측)
    travelSec: 1.6,                                 // 무기 출발→타겟 시간
    countIn: 3
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

  function create(opts) {
    var el = opts.root;
    function setEntryBgm(playing) { if (typeof opts.onEntryMusic === 'function') opts.onEntryMusic(!!playing); }
    var $ = function (s) { return el.querySelector(s); };
    var stage = $('[data-rp-stage]'), wlayer = $('[data-rp-weapons]');
    var lyricTicker = MG.RhythmLyrics.create(el);
    var beachVisual = MG.RhythmBeach.create(el), targetLanes=[], targetCue=[0,0,0,0], perfectWords=[];
    var meta = null, buffer = null, ctx = null, src = null;
    var st = null, raf = 0;
    var countEl = $('[data-rp-count]'), frameHeads = [0,1,2,3].map(function(){return {h:{x:0,y:0,r:0},jumping:false};}), frameCues=[0,0,0,0];
    var imgs = {}, diff = 'EASY';
    var bGame = null, activeB = false, resultSerial = 0;
    var selectedASong = CONFIG.bSongs[0], selectedBSong = CONFIG.bSongs[0], bSongCache = {}, bSongPending = {};
    var adRequired=false, adReady=false, adBusy=false, entryBusy=false, entryGeneration=0, entryLoadingTimer=0;
    function albumOf(choice) { return choice.id==='fever2' ? 'assets/home2/mole-cap.png' : A+'albums-v1170/'+choice.id+'.webp'; }
    function selectSong(choice){if(activeB)selectedBSong=choice;else selectedASong=choice;}
    function cancelEntry(){entryGeneration++;entryBusy=false;clearTimeout(entryLoadingTimer);$('[data-rp-preloader]').hidden=true;}
    function watchSongAd(done){
      if(adBusy||entryBusy)return;
      if(!MG.Ads||!MG.Ads.rewarded){$('[data-rp-song-message]').textContent='광고를 준비하지 못했습니다.';return;}
      adBusy=true;var token=resultSerial;document.body.classList.add('rhythm-ad-active');
      Promise.resolve().then(function(){return MG.Ads.rewarded();}).then(function(ok){adBusy=false;if(token===resultSerial&&!el.hidden&&ok)done();else if(token===resultSerial)$('[data-rp-song-message]').textContent='광고 완료 후 1회 플레이할 수 있습니다.';}).catch(function(){if(token===resultSerial)$('[data-rp-song-message]').textContent='광고를 불러오지 못했습니다.';}).finally(function(){adBusy=false;document.body.classList.remove('rhythm-ad-active');});
    }
    function launchSong(modal){
      if(entryBusy||adBusy)return;
      if(adRequired&&!adReady){watchSongAd(function(){adReady=true;launchSong(modal);});return;}
      var token=++entryGeneration,choice=activeB?selectedBSong:selectedASong,wasB=activeB,completed=0,total=wasB?2:4,loader=$('[data-rp-preloader]');entryBusy=true;
      if(!ctx)ctx=new(root.AudioContext||root.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume();
      $('[data-rp-preload-album]').src=albumOf(choice);$('[data-rp-preload-title]').textContent=choice.title;
      $('[data-rp-preload-progress]').max=total;$('[data-rp-preload-progress]').value=0;$('[data-rp-preload-detail]').textContent='준비 0 / '+total;loader.hidden=true;
      clearTimeout(entryLoadingTimer);entryLoadingTimer=setTimeout(function(){if(token===entryGeneration&&entryBusy&&!el.hidden)loader.hidden=false;},300);
      function track(p){return Promise.resolve(p).then(function(v){if(token===entryGeneration){completed++;$('[data-rp-preload-progress]').value=completed;$('[data-rp-preload-detail]').textContent='준비 '+completed+' / '+total;}return v;});}
      var tasks=wasB?[loadBSong(),bGame.prepare()]:[loadSong(),preload(),loadMeta(),loadSfx()];
      Promise.all(tasks.map(track)).then(function(){if(token!==entryGeneration||el.hidden||activeB!==wasB)return false;pushInGame(modal);return wasB?bGame.open(diff,{practice:false}):start();}).then(function(ok){if(token!==entryGeneration)return;clearTimeout(entryLoadingTimer);loader.hidden=true;entryBusy=false;if(ok)adReady=false;else showSelect();}).catch(function(){if(token!==entryGeneration)return;clearTimeout(entryLoadingTimer);loader.hidden=true;entryBusy=false;showSelect();$('[data-rp-selected-song]').textContent=choice.title+' · 자료를 불러오지 못했습니다. 다시 시도해주세요.';});
    }
    $('[data-rp-preload-cancel]').addEventListener('click',function(){cancelEntry();showSongs();});
    function bBestPrefix() { return selectedBSong.id === 'fever2' ? 'mole.rp.b.best.' : 'mole.rp.b.best.' + selectedBSong.id + '.'; }
    function aBestPrefix() { return selectedASong.id === 'fever2' ? 'mole.rp.best.' : 'mole.rp.best.' + selectedASong.id + '.'; }
    // 효과음(기존 게임 사운드 재사용) — 성공 = 타격음, 실패 = 두더지 아야
    var SFX = { hit: ['audio/hit1.mp3', 'audio/hit2.mp3', 'audio/hit3.mp3', 'audio/hit4.mp3'], jump: ['audio/mole-emerge.mp3'] }; // v814(사용자 지정): 실패 목소리(아야 등) 삭제, 두더지 점프 = 두더지팡 등장 소리
    var sfxBuf = {};
    function loadSfx() {
      var all = SFX.hit.concat(SFX.jump);
      return Promise.all(all.map(function (u) {
        if (sfxBuf[u]) return null;
        return fetch(u).then(function (r) { return r.arrayBuffer(); }).then(function (ab) { return new Promise(function (res) { ctx.decodeAudioData(ab, function (b) { sfxBuf[u] = b; res(); }, function () { res(); }); }); }).catch(function () {});
      }));
    }
    function sfx(kind) {
      var list = SFX[kind], b = sfxBuf[list[Math.floor(Math.random() * list.length)]]; if (!b || !ctx) return;
      var s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = kind === 'hit' ? 0.35 : 0.3;
      s.buffer = b; s.connect(g); g.connect(ctx.destination); s.start();
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
        detail.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') + ' · 난이도 3종';
        var record = document.createElement('strong'), prefix = (activeB ? 'mole.rp.b.best.' : 'mole.rp.best.') + (choice.id === 'fever2' ? '' : choice.id + '.');
        var best = 0, grade = '';
        ['EASY','NORMAL','HARD'].forEach(function(d){var score=Number(localStorage.getItem(prefix+d))||0;if(score>best){best=score;try{grade=JSON.parse(localStorage.getItem(prefix+d+'.result')||'null').rank;}catch(e){grade='';}}});
        record.textContent = best ? 'BEST ' + best.toLocaleString('en-US') + (grade ? ' · '+grade : '') : '첫 기록에 도전하세요';
        info.append(title, detail, record);
        var actions = document.createElement('div'); actions.className = 'rb-song-actions';
        var play = document.createElement('button'); play.type='button'; play.className='rx-btn rx-btn--y rb-song-play'; play.dataset.rpSong=choice.id; play.innerHTML=buttonTriangle(0,'-song-'+choice.id)+'<span>실행</span>'; play.setAttribute('aria-label',choice.title+' 실행');
        play.querySelector('svg').setAttribute('viewBox','45 43 133 105');play.querySelector('svg').setAttribute('preserveAspectRatio','xMidYMid meet');
        play.addEventListener('click',function(){selectSong(choice);adRequired=false;adReady=false;showSelect();});
        var ad = document.createElement('button'); ad.type='button'; ad.className='rx-btn rx-btn--b rb-song-ad'; ad.innerHTML='<img src="assets/shop/ad-icon.png" alt="">'; ad.setAttribute('aria-label',choice.title+' 광고 보고 플레이');
        ad.addEventListener('click',function(){selectSong(choice);watchSongAd(function(){adRequired=true;adReady=true;showSelect();});});
        actions.append(play,ad);card.append(album,info,actions);list.appendChild(card);
      });
      if (!CONFIG.bSongs.length) list.textContent = '등록된 곡이 없습니다.';
      $('[data-rp-songs]').hidden = false;
      layoutSongRows();
      list.scrollTop = 0;
    }
    // Fit whole cards to the visible list and let native scrolling snap by card.
    // Resize-only work; no game render loop or scroll animation listener.
    function layoutSongRows() {
      var list=$('[data-rp-song-list]'),cards=list.children;
      if(!list.clientHeight||!cards.length)return;
      var gap=12,available=list.clientHeight-28,minSlot=136;
      var count=Math.min(3,cards.length);
      if(window.innerHeight<=700)count=1;
      else if(window.innerWidth<=370)count=Math.min(2,count);
      while(count>1&&(available-gap*(count-1))/count<minSlot)count--;
      list.style.setProperty('--rp-song-slot',((available-gap*(count-1))/count)+'px');
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
      L.moleW = L.laneW * 0.92;
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
    }
    // 프레임별 추가 상승량 = (그 프레임이 대기 자세보다 오른 정도 ÷ 최고점이 오른 정도) × lift
    function liftAt(i, f) {
      if (!L.lift) return 0;
      var bb = meta[CHARS[i]].bb, rise = bb[0][1] - bb[f][1], top = bb[0][1] - bb[CONFIG.apexFrame][1];
      return top > 0 ? Math.max(0, rise / top) * L.lift : 0;
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
      var l=r[2],t=r[3],right=r[4],bottom=r[5],cx=(l+right)/2,mid=t+(bottom-t)*.62,id='rp-a-tri-'+i+(suffix||'');
      var face='M '+(cx-4)+' '+(t+4)+' Q '+cx+' '+(t-2)+' '+(cx+4)+' '+(t+4)+' L '+(right-1)+' '+(bottom-8)+' Q '+(right+4)+' '+bottom+' '+(right-5)+' '+bottom+' H '+(l+5)+' Q '+(l-4)+' '+bottom+' '+(l+1)+' '+(bottom-8)+' Z';
      return '<svg class="rp-a-triangle" viewBox="0 0 '+r[0]+' '+r[1]+'" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="'+colors[0]+'"/><stop offset="1" stop-color="'+colors[1]+'"/></linearGradient><clipPath id="'+id+'-clip"><path d="'+face+'"/></clipPath></defs><path d="'+face+'" transform="translate(0 9)" fill="'+colors[2]+'" opacity=".2"/><path d="'+face+'" transform="translate(0 5)" fill="'+colors[2]+'" stroke="'+colors[2]+'" stroke-width="2"/><path d="'+face+'" fill="url(#'+id+')" stroke="'+colors[0]+'" stroke-width="1.5"/><g clip-path="url(#'+id+'-clip)"><path d="M '+cx+' '+t+' L '+cx+' '+mid+' L '+l+' '+bottom+' Z" fill="'+colors[0]+'" opacity=".65"/><path d="M '+cx+' '+t+' L '+right+' '+bottom+' L '+cx+' '+mid+' Z" fill="'+colors[2]+'" opacity=".12"/></g></svg>';
    }
    function buildStage() {
      buttonHitTimers.forEach(function(timer){clearTimeout(timer);});buttonHitTimers=[];
      var lanesEl = $('[data-rp-lanes]'); lanesEl.innerHTML = ''; moleEls = null;
      for (var i = 0; i < 4; i++) {
        var ln = document.createElement('div'); ln.className = 'rp-lane'; ln.style.left = (i * 25) + '%';
        ln.style.setProperty('--target-color',['#ffc94c','#5bd8ff','#ff8dce','#66e5b2'][i]);
        ln.innerHTML = '<img class="rp-target" src="' + A + 'beach-v1172/target-' + (i + 1) + '.svg" alt=""><span class="rp-target-orbit" aria-hidden="true"><i><b></b></i></span>' +
          '<img class="rp-hole" src="' + A + 'hole-' + (i + 1) + '.png" alt="">' +
          '<span class="rp-mole" style="background-image:url(' + A + 'jump-' + CHARS[i] + '-strip.png)"></span>' +
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
          b.innerHTML = '<img src="' + A + 'btn-' + (j + 1) + '.png" alt="">' + buttonTriangle(j);
          var perfectWord = document.createElement('span'); perfectWord.className = 'rp-a-grade-word'; perfectWord.setAttribute('aria-hidden','true'); stage.appendChild(perfectWord); perfectWords[j]=perfectWord;
          b.addEventListener('pointerdown', function (e) { e.preventDefault(); press(j); b.classList.add('is-down'); });
          ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('is-down'); }); });
          bt.appendChild(b);
        })(j);
      }
    }
    function placeStatic() {
      var lanes = el.querySelectorAll('.rp-lane');
      lanes.forEach(function (ln, i) {
        var size=L.targetR*3.05;
        var t = ln.querySelector('.rp-target'),orbit=ln.querySelector('.rp-target-orbit');
        t.style.width=orbit.style.width=size+'px';orbit.style.height=size+'px';t.style.top=orbit.style.top=(L.targetY-size/2)+'px';
        var h = ln.querySelector('.rp-hole'); h.style.width = (L.laneW * 0.98) + 'px'; h.style.top = (L.moleBottom - L.sink - L.laneW * 0.32) + 'px';
        var m = ln.querySelector('.rp-mole'); var md = meta[CHARS[i]];
        m.style.width = L.moleW + 'px'; m.style.height = (md.h * (L.moleW / md.w)) + 'px'; m.style.aspectRatio = 'auto'; m.style.top = (L.moleBottom - md.h * (L.moleW / md.w)) + 'px';
        ln.querySelector('.rp-judge').style.top = (L.targetY - L.targetR * 2.2) + 'px';
        var h0 = headAt(i, 0), dz = dizzyEls[i]; dz.style.left = h0.x + 'px'; dz.style.top = (h0.y - h0.r * 1.1) + 'px'; dz.style.width = (h0.r * 2.4) + 'px';
      });
    }
    // v824: 폰을 껐다 켜면(전체화면 복귀 등) 화면 높이가 바뀌는데 배치를 다시 안 해서 두더지·타겟이 올라가 있던 것 — 크기 바뀌면 다시 계산
    root.addEventListener('resize', function () {
      if (!st || !meta || el.hidden) return;
      layout(); placeStatic();
      st.notes.forEach(function (n) {
        n.pts = routeOf(n); n.len = pathLen(n.pts);
        if (n.el) n.el.style.width = (L.weaponR * 2.4) + 'px';
        if (n.trail) n.trail.forEach(function (g) { g.style.width = (L.weaponR * 2.4) + 'px'; });
        if (n.wind) sizeWind(n);
      });
    });
    // v813(깜빡임 제거): 7프레임을 미리 겹쳐 두고 보이는 것만 바꿈 — img src 교체 순간 빈 프레임이 생기던 것
    var moleFrame = [-1, -1, -1, -1], moleEls = null, btnEls = null, dizzyEls = null, buttonHitTimers=[];
    function setMoleFrame(i, f) {
      if (moleFrame[i] === f) return;
      var m = (moleEls || (moleEls = el.querySelectorAll('.rp-mole')))[i];
      m.style.backgroundPosition = (f / 6 * 100) + '% 0'; moleFrame[i] = f;
    }
    var statusJudge = $('[data-rp-status-judge]'), statusTime = $('[data-rp-time]'), statusSeconds = -1;
    var aGauge=$('.rp-a-timing-gauge'),aGaugeLight=aGauge.querySelector('.rb-timing-light'),aGaugeAnimation=null;
    var aGaugeReduced=root.matchMedia('(prefers-reduced-motion: reduce)');
    var aGaugeColors={PERFECT:'#ffd746',GREAT:'#bd77ff',GOOD:'#21bfff',MISS:'#ff6479'};
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
      var j = el.querySelectorAll('.rp-judge')[i]; j.textContent = txt; j.className = 'rp-judge is-' + cls;
      void j.offsetWidth; j.classList.add('is-on');
    }
    function hud() {
      $('[data-rp-score]').textContent = st.score.toLocaleString('en-US');
      $('[data-rp-combo]').textContent = String(st.combo);
      $('[data-rp-hp]').style.width = (st.hp / CONFIG.hpMax * 100) + '%';
      $('[data-rp-hpbar]').classList.toggle('is-low', st.hp <= 3);
    }

    // ---- 진행 ----
    function now() { return ctx.currentTime - st.t0; } // 음악 시각(초)
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
        buildStage(); layout(); placeStatic(); // 버튼을 먼저 만들어야 무대 높이가 정확(v812)
        var notes = buildChart();
        // v813: 무기 그림을 시작 전에 전부 만들어 둠(숨김) — 플레이 중 생성/삭제로 인한 깜빡임 제거
        wlayer.innerHTML = '';
        notes.forEach(function (n) { n.renderPos={};n.trailPos=[{},{}];n.windPos={};n.el = document.createElement('img'); n.el.className = 'rp-weapon'; n.el.src = A + 'w-' + n.weaponType + '.png';
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
        // 카운트인: 3·2·1·START 가 끝나는 순간 음악 0초
        var startAt = ctx.currentTime + CONFIG.countIn + 0.15;
        st.t0 = startAt;
        var s1 = ctx.createBufferSource(); s1.buffer = buffer; s1.connect(ctx.destination); s1.start(startAt);
        var s2 = null;
        if (melBuf) { s2 = ctx.createBufferSource(); s2.buffer = melBuf; melGain = ctx.createGain(); melGain.gain.value = 1; s2.connect(melGain); melGain.connect(ctx.destination); s2.start(startAt); }
        src = { stop: function (w) { s1.stop(w); if (s2) s2.stop(w); } };
        resetBoss(); clearAGauge();
        beachVisual.start(song&&song.bpm);
        statusJudge.textContent = 'READY'; statusSeconds = -1; updateStatusTime(0);
        hud(); // (무기 풀은 위에서 생성 — 여기서 비우지 않음)
        el.querySelector('[data-rp-result]').hidden = true;
        cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); return true;
      }).catch(function () {
        if (token !== resultSerial || activeB || el.hidden) return;
        showSelect(); $('[data-rp-selected-song]').textContent = selectedASong.title + ' · 곡 자료를 불러오지 못했습니다. 다시 선택해주세요.'; return false;
      });
    }

    // 버튼 → 점프. 리듬 판정은 "두더지가 최고점에 닿는 시각" 기준(입력 시각 + 최고점까지 시간).
    function press(lane) {
      if (!st || st.over || st.paused || now() < 0) return;
      var t = now(), m = st.moles[lane];
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
      if(g==='PERFECT'){var dir=n.bx<L.W/2?-1:1,flight=.72;n.perfectFlight={duration:flight,dx:dir*(Math.max(n.bx,L.W-n.bx)+L.weaponR*3),dy:-L.H*.28};}
      showJudge(lane, g, g.toLowerCase());
      var hitButton=btnEls&&btnEls[lane];
      if(hitButton){clearTimeout(buttonHitTimers[lane]);hitButton.dataset.grade=g;hitButton.classList.remove('is-hit');void hitButton.offsetWidth;hitButton.classList.add('is-hit');buttonHitTimers[lane]=setTimeout(function(){hitButton.classList.remove('is-hit');delete hitButton.dataset.grade;buttonHitTimers[lane]=0;},420);}
      pang(lane, n.cx, n.cy); hud(); sfx('hit');
      var word=perfectWords[lane],buttonRect=hitButton&&hitButton.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();
      if(word&&buttonRect){var wordY=buttonRect.top-stageRect.top+buttonRect.height/2,targetCenter=L.targetY;word.textContent=g;word.dataset.grade=g;word.style.left=(buttonRect.left-stageRect.left+buttonRect.width/2)+'px';word.style.top=wordY+'px';word.style.setProperty('--rp-grade-rise',(-Math.max(0,wordY-targetCenter+word.offsetHeight/2))+'px');replay(word,'is-on');}
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
        g.classList.remove('is-fly'); void g.offsetWidth; g.classList.add('is-fly');
      }
      g.addEventListener('animationend', function (e) { if (e.target === g) fly(); });
      fly();
    });
    function replay(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
    function burst(x, y, k) { // 명중 자리에서 반짝이 조각이 사방으로
      for (var i = 0; i < k; i++) {
        var a = (i / k) * Math.PI * 2 + Math.random() * 0.5, d = L.laneW * (0.45 + Math.random() * 0.35);
        var sp = sparks[sparkI++ % sparks.length]; sp.textContent = i % 3 ? '✦' : '★'; sp.style.left = x + 'px'; sp.style.top = y + 'px';
        sp.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px'); sp.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1) + 'px');
        sp.style.color = ['#fff36b', '#ffffff', '#ffb3e6', '#8ff0ff'][i % 4]; replay(sp, 'is-on');
      }
    }
    var boss = el.querySelector('.rp-a-cloud-boss');
    var bossColors = ['#ffbd36','#40bfff','#fb66ed','#63ef94'];
    var comboBackdrop=document.createElement('div');comboBackdrop.className='rp-a-combo-atmosphere';el.insertBefore(comboBackdrop,el.firstChild);
    var comboTones=bossColors.map(function(color){var node=document.createElement('i');node.className='rp-a-combo-tone';node.style.backgroundColor=color;comboBackdrop.appendChild(node);return node;});
    var comboSweeps=['upper','lower'].map(function(side){var node=document.createElement('div');node.className='rp-a-combo-sweep rp-a-combo-sweep--'+side;node.appendChild(document.createElement('span'));comboBackdrop.appendChild(node);return node;});
    var comboAnimations=[],aComboStage=0;
    function clearComboSweeps(){comboAnimations.forEach(function(a){a.cancel();});comboAnimations.length=0;}
    function updateACombo(combo,immediate){
      var theme=Math.floor(combo/10);if(theme===aComboStage&&!immediate)return;lyricTicker.color(theme?bossColors[(theme-1)%bossColors.length]:'#40bfff');aComboStage=theme;clearComboSweeps();
      comboTones.forEach(function(node,i){node.style.transitionDuration=immediate?'0ms':'500ms';node.style.opacity=theme&&i===(theme-1)%bossColors.length?'.05':'0';});
      if(!theme||immediate)return;
      var color=bossColors[(theme-1)%bossColors.length];boss.style.setProperty('--rp-boss-color',color);shrinkBoss(false);
      if(root.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      comboSweeps.forEach(function(node,i){node.style.setProperty('--combo-color',color);comboAnimations.push(node.firstElementChild.animate([{transform:'translateY('+(i?'-100%':'800%')+')',opacity:0,offset:0},{opacity:.65,offset:.12},{transform:'translateY('+(i?'800%':'-100%')+')',opacity:0,offset:1}],{duration:500,easing:'linear'}));});
    }
    function resetBoss() { updateACombo(0,true); boss.style.setProperty('--rp-boss-scale','1'); boss.style.setProperty('--rp-boss-color','transparent'); boss.style.opacity='1'; }
    function shrinkBoss(clear) {
      var hits = st.cnt.PERFECT + st.cnt.GREAT + st.cnt.GOOD, total = st.notes.length;
      var full = clear && total > 0 && st.cnt.MISS === 0 && hits === total;
      boss.style.setProperty('--rp-boss-scale',String(full ? 0 : .16 + .84 * (1 - Math.min(1,hits / Math.max(1,total)))));
      if (full) boss.style.opacity='0';
    }
    function comboFx() {
      var c = $('[data-rp-combo]'); replay(c, 'is-bump');
      if (st.combo > 0 && st.combo % 10 === 0) updateACombo(st.combo,false);
      if (st.combo > 0 && st.combo % 10 === 0) beachVisual.hurt(now());
      if (st.combo === 10 || st.combo === 30 || (st.combo >= 50 && st.combo % 50 === 0)) {
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
      // 카운트인 표시
      var ci = countEl;
      if (t < 0) { var c = Math.ceil(-t); ci.textContent = c > CONFIG.countIn ? '' : String(c); ci.hidden = false; }
      else if (t < 0.6) { ci.textContent = 'START'; ci.hidden = false; } else ci.hidden = true;
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
          if(n.perfectFlight){var p=Math.min(1,k/n.perfectFlight.duration);n.cx=n.bx+n.perfectFlight.dx*p;n.cy=n.by+n.perfectFlight.dy*p+L.H*1.25*p*(1-p);}
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
      beachVisual.stop();
      lyricTicker.clear();
      if (st.ended) return; st.ended = true; st.over = true; el.querySelectorAll('.rp-btn').forEach(function (b) { b.classList.remove('is-cue'); }); // 결과창 뒤 버튼 반짝임 정지
      try { src.stop(ctx.currentTime + (clear ? 0.8 : 0.05)); } catch (e) { /* 무시 */ }
      clearComboSweeps(); shrinkBoss(clear); clearAGauge();
      showResult(st, clear, false);
    }
    function showResult(result, clear, isB) {
      var token = ++resultSerial, resultDiff = isB ? result.diff : diff;
      var r = $('[data-rp-result]');
      var rating=sharedRules.resultRating(result.cnt,isB?result.totalNotes:result.notes.length,clear);
      var rewardEl=$('[data-rp-ticket-reward]'); rewardEl.hidden=true;
      if (!isB && clear && rating.fullCombo && (resultDiff==='NORMAL'||resultDiff==='HARD') && !result.practice && !result.bTicketRewardGranted) {
        if (MG.Economy && MG.Economy.addRhythmBTickets) { MG.Economy.addRhythmBTickets(1); result.bTicketRewardGranted=true; rewardEl.textContent='RhythmPang B TICKET +1'; rewardEl.hidden=false; }
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
      if(!activeB)beachVisual.pause(on);
      lyricTicker.pause(on);
      comboAnimations.forEach(function(a){if(on)a.pause();else a.play();});
      if (activeB) {
        el.querySelectorAll('[data-rx-pause-t] textPath').forEach(function (t) { t.textContent = '일시정지'; });
        bGame.pause(on); $('[data-rp-pause]').hidden = !on; return;
      }
      if (!st || st.ended) return;
      var pt = (root.FGH && root.FGH.I18N && root.FGH.I18N.lang === 'en') ? 'PAUSE' : '일시정지'; // v826: 한글은 일시정지
      el.querySelectorAll('[data-rx-pause-t] textPath').forEach(function (t) { t.textContent = pt; });
      st.paused = on; $('[data-rp-pause]').hidden = !on;
      if (on) ctx.suspend(); else ctx.resume();
      if(aGaugeAnimation){if(on)aGaugeAnimation.pause();else aGaugeAnimation.play();}
    }
    // 창 버튼 누름 효과(v820) — 폰에서 :active 가 잘 안 먹어 직접 클래스 토글
    el.querySelectorAll('.rx-btn').forEach(function (b) {
      b.addEventListener('pointerdown', function () { b.classList.add('is-press'); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('is-press'); }); });
    });
    $('[data-rp-pausebtn]').addEventListener('click', function () { pause(true); });
    $('[data-rp-resume]').addEventListener('click', function () { pause(false); });
    $('[data-rp-quit]').addEventListener('click', function () {
      if (!activeB && MG.Economy) MG.Economy.spendHeart();
      showSongs();
    });
    $('[data-rp-retry]').addEventListener('click', function () { launchSong($('[data-rp-result]')); }); // v841: 다시하기 = 탄성 밀어내기
    $('[data-rp-home]').addEventListener('click', showSongs);
    $('[data-rp-other]').addEventListener('click', function () { if (activeB) { bGame.stop(); showSelect(); return; } cancelAnimationFrame(raf); try { src && src.stop(); } catch (e) { /* 무시 */ } st = null; showSelect(); });

    function close(why) {
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
      setEntryBgm(true);
      updateModeSign();
      resultSerial++;
      $('[data-rp-songs]').hidden = true;
      $('[data-rp-song-back]').hidden = false;
      $('[data-rp-selected-song]').hidden = false;
      $('[data-rp-selected-song]').textContent = activeB ? selectedBSong.title : selectedASong.title;
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
      setEntryBgm(false);
      // v878(사용자 지정): 탄성 밀어내기 → 글리치(다른 화면과 통일)
      modal.hidden = true;
      // V 1113 G: keep B's opaque screen fixed while only its board enters.
      var entryTarget = activeB ? $('[data-rp-b] .rb-board') : el;
      if (activeB) el.classList.remove('glitch-in');
      entryTarget.classList.remove('glitch-in'); void entryTarget.offsetWidth; entryTarget.classList.add('glitch-in');
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
    function open() { setEntryBgm(true); resetBoss(); clearAGauge(); el.hidden = false; $('[data-rp-pause]').hidden = true; $('[data-rp-result]').hidden = true; wlayer.innerHTML = '';
      // v974(사용자 지정): 진입 시 배경은 항상 첫 화면 — 지난 판의 두더지·구멍·버튼·점수·HP 잔상 비움(시작하면 start() 가 다시 만듦)
      $('[data-rp-lanes]').innerHTML = ''; $('[data-rp-btns]').innerHTML = ''; moleEls = null; btnEls = null;
      $('[data-rp-score]').textContent = '0'; $('[data-rp-combo]').textContent = '0'; statusJudge.textContent = 'READY'; statusTime.textContent = '0:00'; statusSeconds = -1; $('[data-rp-hp]').style.width = ''; $('[data-rp-hpbar]').classList.remove('is-low');
      showTypes(); }
    return { open: open, close: close, CONFIG: CONFIG, setDiff: function (d) { diff = d; }, start: function () { start(); }, press: function (l) { press(l); }, dbg: function () { return st ? { t: now(), notes: st.notes, score: st.score, combo: st.combo, hp: st.hp, cnt: st.cnt } : null; } };
  }

  var sharedRules = {
    config: CONFIG, diffs: DIFFS,
    grade: function (ms, difficulty) { var J = DIFFS[difficulty].judge; return ms <= J.perfectMs ? 'PERFECT' : ms <= J.greatMs ? 'GREAT' : ms <= J.goodMs ? 'GOOD' : null; },
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
