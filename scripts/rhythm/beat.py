"""곡 박자(BPM)·첫 박 위치 분석 — 스펙트럼 플럭스 + 자기상관, 그리고 박 격자 위상 맞춤."""
import subprocess, sys, numpy as np

def load(path, sr=22050):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32), sr

def flux(x, sr, hop=256, n=1024):
    win = np.hanning(n); frames = 1 + (len(x) - n) // hop
    idx = np.arange(n)[None, :] + hop * np.arange(frames)[:, None]
    S = np.abs(np.fft.rfft(x[idx] * win, axis=1))
    S = np.log1p(S * 10)
    f = np.maximum(0, np.diff(S, axis=0)).sum(1)
    f = np.concatenate([[0], f]); f -= np.convolve(f, np.ones(16) / 16, 'same'); f = np.maximum(f, 0)
    return f / (f.max() + 1e-9), sr / hop

def tempo(f, fps, lo=70, hi=180):
    ac = np.correlate(f, f, 'full')[len(f) - 1:]
    best = None
    for bpm in np.arange(lo, hi, 0.1):
        lag = 60 * fps / bpm
        sc = sum(np.interp(lag * k, np.arange(len(ac)), ac) / k for k in (1, 2, 4))
        if best is None or sc > best[0]: best = (sc, bpm)
    return best[1]

def phase(f, fps, bpm):
    period = 60 / bpm; t = np.arange(len(f)) / fps
    best = None
    for off in np.arange(0, period, 0.002):
        grid = np.arange(off, t[-1], period)
        sc = np.interp(grid, t, f).sum()
        if best is None or sc > best[0]: best = (sc, off)
    return best[1]

if __name__ == '__main__':
    x, sr = load(sys.argv[1]); f, fps = flux(x, sr)
    bpm = tempo(f, fps)
    # 두 배/절반 중 곡 체감에 맞는 쪽 후보도 출력
    off = phase(f, fps, bpm)
    print('duration %.1fs  bpm %.2f  firstBeat %.3f' % (len(x) / sr, bpm, off))
