(function (root) {
  'use strict';

  // 두더지 "깊이 사다리" (사용자 확정):
  //   0 전신 → 1 빠끔(눈) → 2 빠끔(눈감음) → 3 모자만 → 4 사라짐
  // 깊이가 커질수록 (1) 그림을 더 "숨은" 프레임으로 바꾸고 (2) translateY 로 구멍 아래로
  // 내려보낸다. .mole-pop 의 overflow:hidden 이 구멍 아래로 내려간 부분을 잘라낸다.
  // 등장할 땐 4→0 으로 역순.
  //
  // 모든 프레임(전신 9종 + 빠끔 2종 + 모자)은 slice-mole-sprites.py 가 헬멧 폭 기준으로
  // 스케일을 맞춰 같은 400x428 캔버스에 얹어 두므로, 게임은 한 박스에 그대로 그리면 된다.

  // V1541 C 사용자: 새 두더지 — 빼꼼·머리 단계 폐지. 상승 6포즈(mole2-rise1~6) + 맞은 표정.
  //   1타 = 3종 무작위(hit1 아야·hit2 눈물·hit3 O입), 2타 = 눈물(1타가 눈물이면 O입), 3타 = 골뱅이(hit4), 4타 = 기절(hit5).
  //   다타 두더지도 제자리(전신 높이)에서 표정만 바뀐다. 폭탄 든 두더지는 상승 1번 + 폭탄(위치 그대로).
  const POSE_COUNT = 6;
  // 깊이별 translateY (프레임 높이 대비 %). 프레임 교체가 "숨는" 연출의 대부분을 하고,
  // translateY 는 내려가는 "움직임"만 살짝 더한다. 4는 클립 밖으로 완전히 내려보냄.
  const DEPTH_SINK = [0, 6, 11, 15, 120];

  // 사람두더지 합성: 포즈별 얼굴 원(중심 cx,cy / 반지름 r) — 스프라이트 470x548 박스 대비 비율.
  // 스프라이트는 콘텐츠가 캔버스 바닥에 정렬돼 있어(투명 상단 여백) 얼굴이 아래쪽(cy 0.7~0.9).
  // measure-head-anchor.py 산출값. 재측정: python scripts/measure-head-anchor.py
  const HEAD_ANCHOR = {
    mole1: { cx: 0.4979, cy: 0.7119, r: 0.1709 },
    mole2: { cx: 0.5255, cy: 0.7175, r: 0.1545 },
    mole3: { cx: 0.5181, cy: 0.7218, r: 0.1439 },
    mole4: { cx: 0.4851, cy: 0.7476, r: 0.1662 },
    mole5: { cx: 0.5223, cy: 0.7271, r: 0.1369 },
    mole6: { cx: 0.4660, cy: 0.7527, r: 0.1755 },
    mole7: { cx: 0.5064, cy: 0.8027, r: 0.1568 },
    mole8: { cx: 0.5362, cy: 0.7958, r: 0.1474 },
    peek1: { cx: 0.4989, cy: 0.7892, r: 0.1697 },
    peek2: { cx: 0.4968, cy: 0.8053, r: 0.1650 },
    helmet: { cx: 0.4426, cy: 0.8887, r: 0.1755 }
  };

  function headAnchor(spriteFile) {
    return HEAD_ANCHOR[spriteFile] || HEAD_ANCHOR.mole1;
  }

  function riseFile(poseIndex) {
    return 'mole2-rise' + ((poseIndex || 0) % POSE_COUNT + 1);
  }

  // hits = 지금까지 맞은 횟수(1~), face = 1타 때 고른 표정(1 아야 · 2 눈물 · 3 O입).
  function hitFile(hits, face) {
    if (hits <= 0) return null;
    if (hits === 1) return 'mole2-hit' + face;
    if (hits === 2) return face === 2 ? 'mole2-hit3' : 'mole2-hit2'; // 같은 얼굴 연속 방지
    return hits === 3 ? 'mole2-hit4' : 'mole2-hit5';
  }

  // 연속 깊이값(애니 중간 상태)에 대한 부드러운 sink 보간.
  function sinkForDepth(depth) {
    const d = Math.max(0, Math.min(DEPTH_SINK.length - 1, depth));
    const lo = Math.floor(d);
    const hi = Math.min(DEPTH_SINK.length - 1, lo + 1);
    return DEPTH_SINK[lo] + (DEPTH_SINK[hi] - DEPTH_SINK[lo]) * (d - lo);
  }

  // 방해물 동물 (동물들.png). animal(목숨 -1) = 일반 얼굴, bomb(시간 -3초) = 고글 낀 버전(-x).
  // v1018: 새 3D 동물 4종(rabbit·tiger·hippo·lion, 각 6포즈 + 머리·빼꼼).
  // v1021(사용자 지정): 강아지는 새 그림 정해질 때까지 출현 안 함 — 넣을 땐 목록에 'dog' 다시 추가.
  // index = 동물 + 동물수 × 포즈 (spawn-scheduler 가 0..OBSTACLE_COUNT-1 에서 고름).
  const OBSTACLES = ['rabbit', 'tiger', 'hippo', 'lion'];
  const ANIMAL_POSES = 6;
  const NEW_ANIMALS = { rabbit: 1, tiger: 1, hippo: 1, lion: 1 };
  const OBSTACLE_COUNT = OBSTACLES.length * ANIMAL_POSES;

  function obstacleFile(type, index) {
    const name = OBSTACLES[index % OBSTACLES.length];
    if (!NEW_ANIMALS[name]) return name + (type === 'bomb' ? '-x' : '');
    return name + (Math.floor(index / OBSTACLES.length) % ANIMAL_POSES + 1); // 폭탄도 같은 그림 + 폭탄 이모지(pop-elements)
  }

  // 동물 다타(챕터8 전용, 동물이 타겟으로 뒤집히는 챕터라 두더지처럼 다타 도입 — 사용자 지정).
  // 두더지와 같은 깊이 사다리를 쓰되 애셋이 2장(peek1/peek2)뿐이라 2단계까지만: 전신→빠끔1→빠끔2.
  const ANIMAL_DEPTH_FILE = { 1: 'peek1', 2: 'peek2' };
  function animalRestingDepth(hitsRequired, hitsTaken) {
    if (hitsRequired === 2) return hitsTaken === 0 ? 0 : 2; // 두더지 2타와 동일 패턴(중간 생략)
    if (hitsRequired === 3) return Math.min(hitsTaken, 2);  // 두더지 3타와 동일 패턴(클램프)
    return 0;
  }
  function animalFileForDepth(animalName, depth) {
    if (depth <= 0) return animalName;
    const mm = /^([a-z]+)(\d+)$/.exec(animalName);
    if (mm) return depth === 1 ? mm[1] + '-head' + mm[2] : depth === 2 ? mm[1] + '-peek' + mm[2] : null; // 새 동물: 머리 → 빼꼼
    const suf = ANIMAL_DEPTH_FILE[depth];
    return suf ? (animalName + '-' + suf) : null;
  }

  function spriteUrl(file) {
    return 'assets/moles/' + file + '.png';
  }

  // 모든 두더지/방해물/구멍/망치 스프라이트를 미리 받아 디코드해 둔다.
  // 안 하면 라운드 중 두더지가 올라오며 프레임(전신/빠끔/모자)을 처음 바꿀 때마다
  // PNG 디코드가 메인 스레드에서 일어나 화면이 끊긴다. 이미지 객체 참조를 붙잡아 캐시 유지.
  let preloadRefs = null;
  function preloadAll() {
    if (preloadRefs) return preloadRefs;
    const files = [];
    for (let i = 1; i <= POSE_COUNT; i++) files.push('mole2-rise' + i);
    for (let i = 1; i <= 5; i++) files.push('mole2-hit' + i);
    files.push('hole', 'hole-front', 'shield');
    ['spring', 'summer', 'autumn', 'winter', 'night'].forEach(function (s) {
      files.push('hole-' + s, 'hole-front-' + s);
    });
    OBSTACLES.forEach(function (o) {
      if (!NEW_ANIMALS[o]) { files.push(o, o + '-x', o + '-peek1', o + '-peek2'); return; }
      for (let i = 1; i <= ANIMAL_POSES; i++) files.push(o + i, o + '-head' + i, o + '-peek' + i);
    });
    preloadRefs = files.map(function (f) {
      const img = new Image();
      img.src = spriteUrl(f);
      if (img.decode) img.decode().catch(function () {});
      return img;
    });
    const hammer = new Image();
    hammer.src = 'assets/weapons/mallet-yaw10-rest15-v1379.png';
    if (hammer.decode) hammer.decode().catch(function () {});
    preloadRefs.push(hammer);
    // V1400 C 사용자: 게임 입장 때 보드 배경이 늦게 떠 진한 청색이 보임 → 라운드 배경 그림도 미리 받아 디코드.
    ['board-scene', 'board-scene-spring', 'board-scene-summer', 'board-scene-autumn', 'board-scene-winter'].forEach(function (n) {
      const bg = new Image(); bg.src = 'assets/' + n + '.jpg?v=1376';
      if (bg.decode) bg.decode().catch(function () {});
      preloadRefs.push(bg);
    });
    return preloadRefs;
  }

  const api = {
    POSE_COUNT, OBSTACLE_COUNT, HEAD_ANCHOR,
    riseFile, hitFile, sinkForDepth, obstacleFile, spriteUrl, preloadAll, headAnchor,
    animalRestingDepth, animalFileForDepth
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.MoleSprites = api; }
})(typeof window !== 'undefined' ? window : null);
