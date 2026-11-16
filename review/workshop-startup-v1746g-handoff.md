# V1746 G 추가 수정 — 공방 누락 시 시작 복구 (2026-11-16, 로컬·미배포)
- 사용자 사진 `Desktop/에러.jpg`: 22:42 ERR Cannot read properties of undefined (reading create), game.js?v=1745-C:4046 = MG.Workshop.create. 이번 로컬 수정 이전 공개 V1745 C에서 발생.
- game.js: 시작 전 ItemInventory/WorkshopEnhance/Workshop의 준비 상태 검사. 누락 파일만 기존 버전 URL에 재시도 식별자를 붙여 의존 순서로 최대2회/회당12초 재요청. 준비 전 초기화 중단, 영구 실패 시 재시도 안내. 정상 경로 추가 요청 없음. 일반 초기화의 동기 오류 기록 경로 유지.
- 공방 인스턴스 생성 성공 후 사진의 V1745 C:4046 create 오류만 별도 보관하고 FPS 잔존 기록에서 제거. 다른 오류는 보존.
- node review/test-workshop-startup-recovery-v1746g.cjs 통과: 정상/누락/전송실패/모듈 미등록/의존 순서/버전 유지/정확한 오류 보관. 문법·diff 검사 통과. 실제 폰 재현·복구 검증은 미실시.
- 사용자 정정: 다음 배포는 V1746 G. 아직 버전 치환·커밋·push 안 함. 로딩/경계 수정과 함께 배포 범위 재확인 필요.
