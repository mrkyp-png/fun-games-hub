(function (root) {
  'use strict';
  // 사진관(Photo Studio) — 얼굴형3 × 코스튬5 = 15개 캐릭터 보관/관리/게임적용.
  // 명세서: 바탕화면 "사진관 UI 및 에셋/명세서.txt". 얼굴형 명칭은 사용자 확정: 동글형/듬직형/날렵형
  // (제공된 에셋에 박힌 "푸짐형/늠름형"은 구버전 라벨 — 코드 텍스트는 이 확정 명칭만 사용).
  // 코스튬 한글 명칭은 사진관 전용 표기(§65, 무기 인벤토리 코스튬 탭의 "블루 베어스"와 달리
  // 띄어쓰기 없음) — costume-teams.js의 nameKo를 그대로 쓰면 안 됨.
  var K_CHARACTERS = 'mole.photo.characters'; // { [id]: { isCompleted, isApplied, name } }

  var FACE_TYPES = [
    { id: 'round', nameKo: '동글형', nameEn: 'Round' },
    { id: 'sturdy', nameKo: '듬직형', nameEn: 'Sturdy' },
    { id: 'sharp', nameKo: '날렵형', nameEn: 'Sharp' }
  ];
  var COSTUMES = [
    { id: 'blue_bears', nameKo: '블루 베어스', nameEn: 'Blue Bears' },
    { id: 'mount_stars', nameKo: '마운트 스타즈', nameEn: 'Mount Stars' },
    { id: 'cloud_cups', nameKo: '클라우드 컵스', nameEn: 'Cloud Cups' }
  ];
  var MAX_APPLIED = 9; // V1412 C 사용자: 최대 9개 등록(3팀 × 3얼굴형 전부)
  var TOTAL = FACE_TYPES.length * COSTUMES.length; // V1405 C: 3팀 → 9개
  var CHAR_EFFECT_VALUE = 0.1;      // §17: 개별 캐릭터 효과 예시(두더지 하강 딜레이 +0.1초)
  var TEAM_EFFECT_VALUE = 0.1;     // V1411 C 사용자: 팀별 3개(얼굴형 3) 모아 적용 시 하강 딜레이 +0.1초
  var GLOBAL_EFFECT_VALUE = 0.5;    // V1411 C 사용자: 풀로(전체) 적용 시 +0.5초 (이전 0.1)    // §18: 15/15 완성 시 전체 보상(개별 효과와 별도 관리)

  // 15개 캐릭터 정의 — id 규칙은 명세서 §7 그대로(faceType_costumeId).
  var CHARACTERS = [];
  FACE_TYPES.forEach(function (f) {
    COSTUMES.forEach(function (c) {
      CHARACTERS.push({
        id: f.id + '_' + c.id,
        faceType: f.id,
        costumeId: c.id,
        defaultNameKo: f.nameKo + ' ' + c.nameKo,
        defaultNameEn: f.nameEn + ' ' + c.nameEn
      });
    });
  });

  function faceTypes() { return FACE_TYPES.slice(); }
  function costumes() { return COSTUMES.slice(); }
  function characters() { return CHARACTERS.slice(); }
  function characterDef(id) {
    for (var i = 0; i < CHARACTERS.length; i++) if (CHARACTERS[i].id === id) return CHARACTERS[i];
    return null;
  }
  function charactersFor(faceType) { return CHARACTERS.filter(function (c) { return c.faceType === faceType; }); }

  function loadState() {
    var raw;
    try { raw = JSON.parse(localStorage.getItem(K_CHARACTERS)); } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object') raw = {};
    var out = {};
    CHARACTERS.forEach(function (c) {
      var s = raw[c.id];
      out[c.id] = {
        isCompleted: !!(s && s.isCompleted),
        // 완성 안 된 캐릭터는 적용 상태를 신뢰하지 않는다(§80 예외 처리 — 데이터 불일치 방지).
        isApplied: !!(s && s.isApplied && s && s.isCompleted),
        name: (s && typeof s.name === 'string' && s.name.length) ? s.name.slice(0, 12) : ''
      };
    });
    return out;
  }
  function saveState(state) {
    try { localStorage.setItem(K_CHARACTERS, JSON.stringify(state)); } catch (e) { /* 저장 실패 무시 */ }
  }

  function isCompleted(id) { var s = loadState()[id]; return !!(s && s.isCompleted); }
  function isApplied(id) { var s = loadState()[id]; return !!(s && s.isApplied); }
  function nameOf(id, lang) {
    var s = loadState()[id];
    if (s && s.name) return s.name;
    var def = characterDef(id);
    if (!def) return '';
    return lang === 'en' ? def.defaultNameEn : def.defaultNameKo;
  }

  function appliedIds() {
    var s = loadState();
    return CHARACTERS.map(function (c) { return c.id; }).filter(function (id) { return s[id].isApplied; });
  }
  function completedCount() {
    var s = loadState();
    return CHARACTERS.reduce(function (n, c) { return n + (s[c.id].isCompleted ? 1 : 0); }, 0);
  }
  function isCollectionComplete() { return completedCount() >= TOTAL; }

  // 완성된 캐릭터만 적용 토글 가능, 최대 10개(§12, §39). 미완성 토글 시도는 무시.
  function toggleApply(id) {
    var state = loadState();
    var s = state[id];
    if (!s || !s.isCompleted) return { ok: false, reason: 'not-completed' };
    if (s.isApplied) {
      s.isApplied = false;
      saveState(state);
      return { ok: true, applied: false };
    }
    var count = CHARACTERS.reduce(function (n, c) { return n + (state[c.id].isApplied ? 1 : 0); }, 0);
    if (count >= MAX_APPLIED) return { ok: false, reason: 'max-applied' };
    s.isApplied = true;
    saveState(state);
    return { ok: true, applied: true };
  }

  // 이름 변경 — 최대 12자, 공백 허용, 빈 문자열 금지(§33).
  function setName(id, name) {
    var trimmed = (name || '').slice(0, 12);
    if (!trimmed.length) return { ok: false, reason: 'empty' };
    var state = loadState();
    if (!state[id]) return { ok: false, reason: 'invalid-id' };
    state[id].name = trimmed;
    saveState(state);
    return { ok: true };
  }

  // 제작소 완성 처리용 — 제작소 화면은 별도 세션에서 구현 예정, 지금은 이 API만 노출.
  function markCompleted(id) {
    var state = loadState();
    if (!state[id]) return false;
    state[id].isCompleted = true;
    saveState(state);
    return true;
  }

  // 제작소 사진 합성 결과 저장(v751) — 합성 이미지(dataURL)는 캐릭터별 키에 따로, 완성 표시는 기존 상태에.
  // 저장 공간 부족 등으로 실패하면 false(완성 표시도 하지 않음 — 이미지 없는 완성 캐릭터 방지).
  var K_IMG = 'mole.photo.img.';
  function saveComposite(id, dataUrl, info) {
    if (!characterDef(id) || !dataUrl) return false;
    try {
      localStorage.setItem(K_IMG + id, dataUrl);
      localStorage.setItem(K_IMG + id + '.meta', JSON.stringify({ id: id, costumeId: info && info.costumeId, faceType: info && info.faceType, createdAt: new Date().toISOString() }));
    } catch (e) { return false; }
    cropComposite(id, dataUrl);
    return markCompleted(id);
  }
  // V1426 C: 합성 그림은 370×540 칸 통째라 확대 그림(-hd, 캐릭터 둘레만)보다 작게 보임 →
  // 보여줄 때만 -hd 와 같은 둘레로 잘라 캐릭터 크기 그대로(저장된 합성 그림은 그대로).
  var cropped = {};
  function loadPic(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }
  function cropComposite(id, raw) {
    if (typeof document === 'undefined' || !raw) return;
    var base = 'assets/photo/characters/' + id;
    Promise.all([loadPic(raw), loadPic(base + '.png'), loadPic(base + '-hd.webp')]).then(function (r) {
      var comp = r[0], body = r[1], hd = r[2], w = body.naturalWidth, h = body.naturalHeight;
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      var cx = cv.getContext('2d'); cx.drawImage(body, 0, 0);
      var d = cx.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return;
      var bw = x1 - x0 + 1, bh = y1 - y0 + 1, hw = hd.naturalWidth, hh = hd.naturalHeight;
      // -hd 의 둘레 여백(원본 기준 px) = 가로세로 비율로 역산
      var p = hh !== hw ? Math.max(0, (hw * bh - hh * bw) / (2 * (hh - hw))) : 0;
      var k = comp.naturalWidth / w;
      var sx = (x0 - p) * k, sy = (y0 - p) * k, sw = (bw + 2 * p) * k, sh = (bh + 2 * p) * k;
      var o = document.createElement('canvas'); o.width = Math.round(sw); o.height = Math.round(sh);
      o.getContext('2d').drawImage(comp, sx, sy, sw, sh, 0, 0, o.width, o.height);
      var url = o.toDataURL('image/png');
      cropped[id] = { raw: raw, url: url };
      Array.prototype.forEach.call(document.querySelectorAll('img'), function (im) { if (im.getAttribute('src') === raw) im.src = url; });
    }).catch(function () { /* 실패 시 원래 합성 그림 그대로 */ });
  }
  // 사진관·게임 표시용 이미지 — 합성 결과가 있으면 그것, 없으면 얼굴 빈 기본 캐릭터.
  function imageFor(id) {
    var u = null;
    try { u = localStorage.getItem(K_IMG + id); } catch (e) { u = null; }
    if (u) {
      if (cropped[id] && cropped[id].raw === u) return cropped[id].url;
      if (!cropped[id]) { cropped[id] = { raw: u, url: u }; cropComposite(id, u); }
      return u;
    }
    return 'assets/photo/characters/' + id + '-hd.webp'; // V1406 C: 확대 그림
  }

  // 개별 캐릭터 효과(§17) — 등장한 캐릭터 하나의 효과만 적용, 중첩 없음.
  function effectFor(id) { return isCompleted(id) ? CHAR_EFFECT_VALUE : 0; }
  // 전체 컬렉션 보상(§18) — 개별 효과와 별개로 관리.
  function globalEffectValue() { return isCollectionComplete() ? GLOBAL_EFFECT_VALUE : 0; }

  // ⚠️게임 실제 연동(기존 랜덤 두더지 풀에 적용 캐릭터 포함, §16)은 API만 열어둔다 — 지금은
  // 완성 캐릭터가 하나도 없어 검증 불가하고, 두더지 포즈 사다리(mole-sprites.js)와 전신
  // 캐릭터 이미지의 구조가 달라(사용자 지정: "실제 게임에선 상반신까지만") 제작소에서 실제
  // 완성 캐릭터가 나온 뒤 시각 통합 방식을 다시 정한다. 게임 코드는 이 함수로 풀만 조회.
  function appliedPoolForGame() {
    return appliedIds().map(function (id) {
      return { id: id, effect: effectFor(id) };
    });
  }

  var api = {
    MAX_APPLIED: MAX_APPLIED, TOTAL: TOTAL,
    CHAR_EFFECT_VALUE: CHAR_EFFECT_VALUE, TEAM_EFFECT_VALUE: TEAM_EFFECT_VALUE, GLOBAL_EFFECT_VALUE: GLOBAL_EFFECT_VALUE,
    faceTypes: faceTypes, costumes: costumes, characters: characters, characterDef: characterDef,
    charactersFor: charactersFor,
    isCompleted: isCompleted, isApplied: isApplied, nameOf: nameOf, setName: setName,
    appliedIds: appliedIds, completedCount: completedCount, isCollectionComplete: isCollectionComplete,
    toggleApply: toggleApply, markCompleted: markCompleted, saveComposite: saveComposite, imageFor: imageFor,
    effectFor: effectFor, globalEffectValue: globalEffectValue, appliedPoolForGame: appliedPoolForGame
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { PhotoStudio: api };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.PhotoStudio = api; }
})(typeof window !== 'undefined' ? window : null);
