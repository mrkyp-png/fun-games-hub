"""v1017+ 새 두더지·동물 스프라이트 슬라이스 — 바탕화면 "케릭 UI 및 에셋" (투명 PNG 시트).

시트마다 연결 성분으로 칸을 찾고(위→아래, 왼→오), 시트별로 "헬멧 폭"이 HELMET_W 가 되게 같은 배율로
줄여 470x548 캔버스 바닥·가운데(헬멧 중심)에 얹는다(기존 slice-mole-sprites.py 와 같은 캔버스 규칙).
헬멧 폭 = 칸 위쪽에서 팀 헬멧 색 픽셀이 가장 넓은 줄의 폭(팔 든 포즈에 안 흔들리게 색으로 잼).

출력 assets/moles/:
  두더지  mole1..15 (전신) / mole-head1..15 (머리) / mole-peek1..15 (빼꼼) / helmet
  동물    <name>1..6 / <name>-head1..6 / <name>-peek1..6   (name = lion, rabbit, hippo, tiger)
"""
import os, sys
import numpy as np, cv2
from PIL import Image

SRC = os.path.join(os.path.expanduser('~'), 'Desktop', '케릭 UI 및 에셋')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'moles')
OUT_W, OUT_H, HELMET_W = 470, 548, 200

# 팀 헬멧 색 판정(HSV, OpenCV H 0~180)
def helmet_mask(rgb, team):
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV); h, s, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    if team == 'blue':   return (h > 95) & (h < 130) & (s > 120) & (v > 60)
    if team == 'red':    return ((h < 8) | (h > 170)) & (s > 150) & (v > 80)
    if team == 'purple': return (h > 125) & (h < 160) & (s > 90) & (v > 50)
    if team == 'green':  return (h > 45) & (h < 85) & (s > 120) & (v > 50)
    if team == 'black':  return (v < 60) & (s < 120)
    raise ValueError(team)

def _seam(cost, axis):
    """cost(2D) 위에서 위→아래(axis=0) 또는 왼→오(axis=1)로 가장 비용 낮은 이음 경로(한 칸에 ±1 이동)."""
    c = cost if axis == 0 else cost.T
    h, w = c.shape
    acc = c.astype(np.float64).copy(); back = np.zeros((h, w), np.int64)
    for y in range(1, h):
        prev = acc[y - 1]
        l = np.r_[np.inf, prev[:-1]]; r = np.r_[prev[1:], np.inf]
        stk = np.vstack([l, prev, r]); k = np.argmin(stk, axis=0)
        acc[y] += stk[k, np.arange(w)]; back[y] = k - 1
    path = np.zeros(h, np.int64); path[-1] = int(np.argmin(acc[-1]))
    for y in range(h - 1, 0, -1): path[y - 1] = path[y] + back[y, path[y]]
    return path

def cells(path, cols, rows):
    """칸 경계를 캐릭터 사이 '가장 빈 길'(seam)로 잘라, 붙어 있는 이웃(손·발)도 갈라냄."""
    im = np.asarray(Image.open(path).convert('RGBA'))
    H, W = im.shape[:2]
    a = (im[..., 3] > 40).astype(np.float64)
    cost = a * 100 + 1
    rowcut = [0]
    for r in range(1, rows):
        y = int(H * r / rows); win = int(H / rows * 0.35)
        sub = cost[y - win:y + win, :]
        rowcut.append(y - win + _seam(sub, 1))
    rowcut.append(np.full(W, H))
    rowcut[0] = np.zeros(W, np.int64)
    yy = np.arange(H)[:, None]; xx = np.arange(W)[None, :]
    out = []
    for r in range(rows):
        band = (yy >= rowcut[r][None, :]) & (yy < rowcut[r + 1][None, :])
        colcut = [np.zeros(H, np.int64)]
        for c in range(1, cols):
            x = int(W * c / cols); win = int(W / cols * 0.35)
            sub = cost[:, x - win:x + win] + (~band[:, x - win:x + win]) * 0
            colcut.append(x - win + _seam(sub, 0))
        colcut.append(np.full(H, W))
        for c in range(cols):
            m = band & (xx >= colcut[c][:, None]) & (xx < colcut[c + 1][:, None]) & (a > 0)
            n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
            main = 1 + int(np.argmax(st[1:, 4])); mx, my, mw, mh = st[main][:4]
            keep = [i for i in range(1, n) if i == main or (st[i][4] > 30 and st[i][0] >= mx - 2 and st[i][0] + st[i][2] <= mx + mw + 2 and st[i][1] >= my - 2 and st[i][1] + st[i][3] <= my + mh + 2)]
            mk = np.isin(lab, keep)
            ys, xs = np.where(mk)
            x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
            crop = im[y0:y1, x0:x1].copy(); crop[~mk[y0:y1, x0:x1], 3] = 0
            out.append(crop)
    return out

def helmet_width(crop, team):
    m = helmet_mask(np.ascontiguousarray(crop[..., :3]), team) & (crop[..., 3] > 40)
    h = m.shape[0]
    m[int(h * 0.6):] = False
    widths = []
    for y in range(h):
        xs = np.where(m[y])[0]
        if len(xs) > 5: widths.append((xs.max() - xs.min(), (xs.max() + xs.min()) / 2))
    if not widths: return None, None
    w, cx = max(widths)
    return w, cx

def do_sheet(path, team, names, cols, rows, scale=None):
    crops = cells(path, cols, rows)
    assert len(crops) == len(names), (path, len(crops), len(names))
    if team != 'purple':   # 헬멧 꼭대기 위로 넘어온 윗줄 조각 제거(토끼는 귀가 헬멧 위라 제외)
        for c in crops:
            hm = helmet_mask(np.ascontiguousarray(c[..., :3]), team) & (c[..., 3] > 40)
            rows_ = np.where(hm.sum(axis=1) > max(8, hm.shape[1] * 0.08))[0]
            if len(rows_): c[:max(0, rows_[0] - 3), :, 3] = 0
    hw = [helmet_width(c, team) for c in crops]
    if scale is None:
        scale = HELMET_W / float(np.median([w for w, _ in hw if w]))
    for c, (w, cx), name in zip(crops, hw, names):
        img = Image.fromarray(c)
        nw, nh = max(1, round(img.width * scale)), max(1, round(img.height * scale))
        img = img.resize((nw, nh), Image.LANCZOS)
        hcx = (cx if cx is not None else c.shape[1] / 2) * scale
        canvas = Image.new('RGBA', (OUT_W, OUT_H), (0, 0, 0, 0))
        canvas.alpha_composite(img, (round(OUT_W / 2 - hcx), OUT_H - nh)) if nh <= OUT_H else None
        if nh > OUT_H: print('TOO TALL', name, nh)
        canvas.save(os.path.join(OUT, name + '.png'), optimize=True)
    return scale

def main():
    d = os.path.join(SRC, '두더지 이미지 (베어스)')
    do_sheet(os.path.join(d, '전신.png'), 'blue', ['mole%d' % i for i in range(1, 16)], 5, 3)
    do_sheet(os.path.join(d, '머리.png'), 'blue', ['mole-head%d' % i for i in range(1, 16)], 5, 3)
    do_sheet(os.path.join(d, '빼꼼.png'), 'blue', ['mole-peek%d' % i for i in range(1, 16)], 5, 3)
    do_sheet(os.path.join(d, '모자.png'), 'blue', ['helmet'], 1, 1)
    animals = [('lion', '사자 이미지 (레드윙스)', 'red', '전신.png', '머리.png', '빼꼼.png'),
               ('rabbit', '토끼 이미지(클라우드 컵스)', 'purple', '전신.png', '얼굴.png', '빼꼼.png'),
               ('hippo', '하마 이미지(마운트 스타즈)', 'green', '전신.png', '머리.png', '빼꼼.png'),
               ('tiger', '호랑이 이미지(선 자이언츠) (1)', 'black', '호랑이 이미지(선 자이언츠) (1).png', '호랑이 이미지(선 자이언츠) (2).png', '호랑이 이미지(선 자이언츠) (3).png')]
    for name, folder, team, full, head, peek in animals:
        d = os.path.join(SRC, folder)
        do_sheet(os.path.join(d, full), team, ['%s%d' % (name, i) for i in range(1, 7)], 3, 2)
        do_sheet(os.path.join(d, head), team, ['%s-head%d' % (name, i) for i in range(1, 7)], 3, 2)
        do_sheet(os.path.join(d, peek), team, ['%s-peek%d' % (name, i) for i in range(1, 7)], 3, 2)
    print('done')

if __name__ == '__main__':
    main()
