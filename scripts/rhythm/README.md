# 리듬팡 곡 추가 파이프라인

곡 1개(mp3) → 반주/멜로디 분리 → 난이도별 노트 자동 생성 → `mole/audio/rp/<id>.json` + `<id>-back.mp3` + `<id>-melody.mp3`.

## 준비 (한 번만)
    python -m pip install demucs soundfile      # torch CPU 포함, 수 분 걸림. ffmpeg 필요(PATH)

## 1) 분리 (3분 곡 ≈ 수 분, CPU)
    python -m demucs -n htdemucs -o sep --mp3 path/to/song.mp3
    → sep/htdemucs/<파일명>/drums.mp3 bass.mp3 other.mp3 vocals.mp3
- 노래가 있는 곡이면 vocals 를 멜로디(연주 파트)로 쓰는 게 나을 수 있음 → chart.py 의 'other' / 반주 구성 수정.
- 사용자가 Suno "Get Stems" 로 받은 파일을 주면 분리 생략하고 그 파일 사용(더 깨끗함).

## 2) 채보 생성
    python scripts/rhythm/chart.py <id> <원곡.mp3> sep/htdemucs/<파일명> mole/audio/rp [구간시작초=0] [구간길이초=92]
- 박자: 원곡 전체 스펙트럼 플럭스 자기상관 → BPM·첫 박(beat.py). ⚠ 실제의 2배 BPM 이 나올 수 있음(83곡→166.7) — 채보엔 무관.
- 노트: 멜로디 스템 온셋 세기를 반 박 격자에 매겨, 난이도별(EASY 정박·2박 간격 / NORMAL 정박·1박 / HARD 반박) 세기 순 그리디 선택.
  밀도는 chart.py 의 `charts = {...}` quantile 값으로 조절(피버: EASY 0.05→89개, NORMAL 0.45→114, HARD 0.6→167).
- 레인 배정·꺾임 경로는 게임(rhythm.js buildChart)이 시각만 받아 처리(같은 레인 최소 간격 = 점프 7프레임+0.1초).

## 3) 게임 연결
- 지금은 `mole/js/rhythm.js` CONFIG.songData = 'audio/rp/fever.json' 한 곡 고정. 여러 곡 = 곡 선택 화면 만들고 songData 를 선택값으로.
- 버전 3곳 올리고 배포. 곡 출처를 mole/audio/CREDITS.txt 에 기록.

## 4) 검증
    node scripts/rhythm/bot-test.js HARD    # 로컬 서버(node scripts/serve.js, :8844) 필요. 봇이 완벽 입력 → 결과창 수치 출력
- ⚠ 봇 여러 개 동시 실행 금지(노트북 느려져 가짜 MISS). 봇 입력 시각 = targetTime - (apexFrame+0.5)*jumpFrameMs(현재 0.21초).
