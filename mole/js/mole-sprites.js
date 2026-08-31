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

  const POSE_COUNT = 8;
  const DEPTH_FILE = { 1: 'peek1', 2: 'peek2', 3: 'helmet' };
  // 깊이별 translateY (프레임 높이 대비 %). 프레임 교체가 "숨는" 연출의 대부분을 하고,
  // translateY 는 내려가는 "움직임"만 살짝 더한다. 4는 클립 밖으로 완전히 내려보냄.
  const DEPTH_SINK = [0, 6, 11, 15, 120];

  function restingDepth(hitsRequired, hitsTaken) {
    if (hitsRequired === 2) return hitsTaken === 0 ? 0 : 2;
    if (hitsRequired === 3) return hitsTaken; // 0,1,2
    return 0;
  }

  function fileForDepth(depth, poseIndex) {
    if (depth <= 0) return 'mole' + (poseIndex + 1);
    if (DEPTH_FILE[depth]) return DEPTH_FILE[depth];
    return null; // depth >= 4
  }

  // 연속 깊이값(애니 중간 상태)에 대한 부드러운 sink 보간.
  function sinkForDepth(depth) {
    const d = Math.max(0, Math.min(DEPTH_SINK.length - 1, depth));
    const lo = Math.floor(d);
    const hi = Math.min(DEPTH_SINK.length - 1, lo + 1);
    return DEPTH_SINK[lo] + (DEPTH_SINK[hi] - DEPTH_SINK[lo]) * (d - lo);
  }

  // 방해물 동물 (동물들.png). animal(목숨 -1) = 일반 얼굴, bomb(시간 -3초) = 고글 낀 버전(-x).
  const OBSTACLES = ['rabbit', 'tiger', 'hippo', 'lion', 'dog'];
  const OBSTACLE_COUNT = OBSTACLES.length;

  function obstacleFile(type, index) {
    return OBSTACLES[index % OBSTACLE_COUNT] + (type === 'bomb' ? '-x' : '');
  }

  function spriteUrl(file) {
    return 'assets/moles/' + file + '.png';
  }

  const api = {
    POSE_COUNT, OBSTACLE_COUNT,
    restingDepth, fileForDepth, sinkForDepth, obstacleFile, spriteUrl
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.MoleSprites = api; }
})(typeof window !== 'undefined' ? window : null);
