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

## 2026-10-15 / 실제 곡 채보와 B 곡 목록
- B 곡 목록은 rhythm.js CONFIG.bSongs의 {id,title,duration,chart} 항목을 추가하면 된다. chart JSON의 back은 필수, melody는 선택. 기존 fever2 기록키는 유지하고 새 곡은 곡 ID별로 기록을 분리한다.
- Le monde attendra demain: 사용자 제공 Desktop WAV(119.96초/48kHz/stereo/16bit)를 수정하지 않고 MP3 192kbps(약2.88MB)로 인코딩. 원본 전체 사용. 아직 분석 기반 1차 채보이며 실제 사용자 플레이로 박자감/후렴 후보와 난이도를 조정해야 한다.
- 재생성: analyze-suno-song.py → refine-suno-grid.py → track-suno-beats.py → build-suno-b-chart.py. 중간 분석 JSON/NPZ는 review에 생성된다. 드라이브 구간은 스펙트럼 강도 기반 후보이며 보컬 후렴을 직접 청취·확정했다고 표현하지 않는다.
- JSON patterns[난이도]는 {time,lanes:[0..8],sound:'kick'|'snare'|'hat',section} 이벤트 배열이다. lanes2개는 동시 입력, charts에는 동일 시각 두 노트가 보존된다. 기존 숫자 charts만 있는 fever2는 기존 랜덤 배치로 재생한다. beats 배열은 실제 온셋에 맞춘 시각으로 공간 박자 호흡을 동기화한다.
- 새 곡에는 hitFeedback:true, 음악은 full mix를 계속 재생하고 성공에만 사전 생성된 짧은 퍼커션 버퍼를 재생한다. 반주/보컬 분리 파일이 없으므로 실패 시 보컬만 끄는 연출은 사용하지 않는다. 효과음 설정 OFF를 존중한다.
- 테스트 모드가 곡 팝업에서 기본 체크되어 있다. B open/start의 {practice:true} 옵션으로 MISS가 10회 넘어도 곡 끝까지, 결과는 TEST 표기·최고점 저장 제외. V1143 G부터 체크 해제한 일반 모드도 MISS 횟수와 관계없이 곡 끝까지 진행한다. A 규칙은 변경하지 않는다.
