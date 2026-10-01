"""리듬팡 곡 채보 자동 생성 — 멜로디 스템의 소리 시작점(온셋)을 박자 격자에 맞춰 난이도별 노트로.
사용: python chart.py <곡이름> <원곡> <스템폴더> <출력폴더> [구간시작초] [구간길이초]"""
import sys, os, json, subprocess, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from beat import load, flux, tempo, phase

name, orig, stems, out = sys.argv[1:5]
seg0 = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
segL = float(sys.argv[6]) if len(sys.argv) > 6 else 92.0

# 1) 박자: 원곡 전체로 BPM·첫 박
x, sr = load(orig); f, fps = flux(x, sr)
bpm = tempo(f, fps); first = phase(f, fps, bpm)
spb = 60 / bpm
# 2) 멜로디 온셋 세기
m, _ = load(os.path.join(stems, 'other.mp3')); fm, _ = flux(m, sr)
tf = np.arange(len(fm)) / fps
def strength(t):  # 격자점 ±40ms 안 최대 플럭스
    i0, i1 = int((t - 0.04) * fps), int((t + 0.04) * fps) + 1
    return float(fm[max(0, i0):max(1, i1)].max()) if i1 > 0 else 0.0
# 3) 구간 안 반박 격자
grid = []
k = int(np.ceil((seg0 + 2.0 - first) / (spb / 2)))
while True:
    t = first + k * spb / 2
    if t > seg0 + segL - 3.0: break
    grid.append((t - seg0, k % 2 == 0, strength(t))); k += 1
def pick(onbeat_only, gap, q):
    c = [g for g in grid if (g[1] or not onbeat_only)]
    thr = np.quantile([g[2] for g in c], q)
    c = sorted([g for g in c if g[2] >= thr], key=lambda g: -g[2])
    chosen = []
    for t, _, s in c:
        if all(abs(t - u) >= gap - 1e-6 for u in chosen): chosen.append(t)
    return sorted(round(t, 3) for t in chosen)
charts = {'EASY': pick(True, 2 * spb - 0.01, 0.05), 'NORMAL': pick(True, spb - 0.01, 0.45), 'HARD': pick(False, spb / 2 - 0.01, 0.6)}
for d, v in charts.items(): print(d, len(v), 'notes')

# 4) 오디오: 반주(드럼+베이스+보컬) / 멜로디 — 구간만 잘라 mp3
os.makedirs(out, exist_ok=True)
def enc(inputs, dst, amix):
    args = ['ffmpeg', '-v', 'error', '-y']
    for i in inputs: args += ['-ss', str(seg0), '-t', str(segL), '-i', i]
    fc = ('amix=inputs=%d:normalize=0' % len(inputs)) if amix else 'anull'
    args += ['-filter_complex', fc, '-ac', '2', '-ar', '44100', '-b:a', '128k', dst]
    subprocess.run(args, check=True)
S = lambda s: os.path.join(stems, s + '.mp3')
enc([S('drums'), S('bass'), S('vocals')], os.path.join(out, name + '-back.mp3'), True)
enc([S('other')], os.path.join(out, name + '-melody.mp3'), False)
meta = {'id': name, 'back': 'audio/rp/' + name + '-back.mp3', 'melody': 'audio/rp/' + name + '-melody.mp3',
        'bpm': round(bpm, 2), 'firstBeat': round((first - seg0) % spb, 3), 'length': segL, 'charts': charts}
json.dump(meta, open(os.path.join(out, name + '.json'), 'w'), separators=(',', ':'))
print('bpm', round(bpm, 2), 'first', round(first, 3))
