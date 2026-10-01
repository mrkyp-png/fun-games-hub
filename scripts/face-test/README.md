# 얼굴합성 촬영 자동 테스트 (가짜 카메라)

사용자 폰에서 "촬영 준비 완료인데 셔터 누르면 '다시 촬영해 주세요!' → 다음 단계 안 넘어감" 버그 재현용.
⚠ 노트북에선 지금까지 한 번도 재현 안 됨(v835·v838 모두 5/5 통과). 폰 전용 원인일 가능성 큼.

## 가짜 카메라 영상 만들기 (사용자 얼굴 — 저장소에 올리지 말 것, .gitignore)
바탕화면 `사진촬영 스템 안넘어감.mp4`(사용자가 보낸 폰 화면 녹화)에서 카메라 부분을 잘라 여백을 넣어 얼굴이 가이드 원 안에 들어오게:

    ffmpeg -y -i "C:/Users/master/Desktop/사진촬영 스템 안넘어감.mp4" -t 6 -vf "crop=iw:ih*0.46:0:ih*0.27,pad=iw*1.9:ih*2.4:(ow-iw)/2:(oh-ih)/2:color=0xe8e8e0,scale=480:-2,fps=15" -pix_fmt yuv420p scripts/face-test/face.y4m

(여백이 적으면 "조금만 뒤로 가주세요"로 촬영 버튼이 안 켜짐)

## 실행
    node scripts/serve.js            # 다른 창, :8844
    node scripts/face-test/capture-test.js new
- Edge headless + --use-file-for-fake-video-capture. 제작소 사진 합성 → 동의 → 촬영 가능 대기 → 셔터 5회(실시간 인식과 겹치게 랜덤 지연), CPU 6배 감속(폰 흉내).
- 결과 배열: next = 코스튼 선택 화면으로 넘어감, retake = "다시 촬영" 토스트, [힌트문구,...] = 버튼이 안 켜짐.
