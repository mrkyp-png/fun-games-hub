# 골드해머(지진 무기) 스프라이트 — 소스 회전 시트(~/Desktop/특수망치.png, 16각도 5+5+6)에서.
#   출력  assets/weapons/goldhammer.png       (메인 스윙 = 67.5° 를 +9° 회전해 뿅망치 축각도(~21°)에 맞춤)
#         assets/weapons/goldhammer-0.png     (0°  = 지진 분신 — ✱·0·# 칸)
#         assets/weapons/goldhammer-45.png    (45° = 지진 분신 — 숫자칸)
#         assets/weapons/goldhammer-90.png    (90° = 지진 분신 — 연락처·키패드·최근기록)
#
# 처리 = 최소한. 알파 임계로 청록 글로우만 컷 → keep_largest(라벨 탈락) → 알파 스무딩 →
#   얇은 검은 외곽선(OUTLINE px, 바깥에만 — 아트 내부 안 건드림).
import os
from collections import deque
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(os.path.dirname(HERE), 'assets', 'weapons')
SRC = os.path.expanduser('~/Desktop/특수망치.png')

TARGET_MAX = 440
ALPHA_CUT = 120
OUTLINE = 4
POSES = [(3, 'goldhammer.png'), (0, 'goldhammer-0.png'), (2, 'goldhammer-45.png'), (4, 'goldhammer-90.png')]

im = Image.open(SRC).convert('RGBA')
W, H = im.size
CELL_W = W / 5
ROW_H = H / 3


def keep_largest(cell):
    w, h = cell.size
    px = cell.load()
    seen = bytearray(w * h)
    best = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy*w+sx] or px[sx, sy][3] < 20:
                continue
            comp, dq = [], deque([(sx, sy)])
            seen[sy*w+sx] = 1
            while dq:
                x, y = dq.popleft(); comp.append((x, y))
                for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny*w+nx] and px[nx, ny][3] >= 20:
                        seen[ny*w+nx] = 1; dq.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    keep = set(best)
    for y in range(h):
        for x in range(w):
            if (x, y) not in keep:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)
    return cell


def outline(cell, px_w=OUTLINE):
    if px_w <= 0:
        return cell
    pad = px_w + 2
    canv = Image.new('RGBA', (cell.width + pad*2, cell.height + pad*2), (0, 0, 0, 0))
    canv.alpha_composite(cell, (pad, pad))
    sil = canv.split()[3].point(lambda v: 255 if v >= 40 else 0)
    dil = sil.filter(ImageFilter.MaxFilter(2 * px_w + 1)).filter(ImageFilter.GaussianBlur(0.6))
    out = Image.new('RGBA', canv.size, (0, 0, 0, 0))
    out.paste(Image.new('RGBA', canv.size, (18, 16, 18, 255)), (0, 0), dil)
    out.alpha_composite(canv)
    bb = out.split()[3].getbbox()
    return out.crop(bb) if bb else out


def pose(col, do_outline=True, rot=0):
    """소스 col(0~4, row0)의 포즈 하나 → 정리된 RGBA (트림됨). rot = 추가 회전(CCW+)."""
    x0 = int(col * CELL_W)
    cell = im.crop((max(0, x0 - 4), 0, min(W, x0 + int(CELL_W) + 6), min(H, int(ROW_H * 1.22)))).convert('RGBA')
    r, g, b, a = cell.split()
    a = a.point(lambda v: 0 if v < ALPHA_CUT else v)
    cell = Image.merge('RGBA', (r, g, b, a))
    cell = keep_largest(cell)
    r, g, b, a = cell.split()
    a = a.filter(ImageFilter.GaussianBlur(0.6)).point(lambda v: 0 if v < 90 else (255 if v > 200 else v))
    cell = Image.merge('RGBA', (r, g, b, a))
    bb = cell.split()[3].getbbox()
    if bb:
        cell = cell.crop(bb)
    if rot:
        cell = cell.rotate(rot, resample=Image.BICUBIC, expand=True)
        bb = cell.split()[3].getbbox()
        if bb:
            cell = cell.crop(bb)
    if do_outline:
        cell = outline(cell)
    return cell


os.makedirs(OUT_DIR, exist_ok=True)

# --- 개별 포즈 (메인 + 분신) ---
# 메인(goldhammer.png)만 +9° CCW 로 회전 → grip→head 축을 뿅망치(hammer.png, ~21°)에 맞춤.
# 그래야 lane-hammer 를 degOffset 없이(스윙 궤적·타격점 동일) 그대로 쓸 수 있다.
MAIN_ROT = {'goldhammer.png': 9}
for col, name in POSES:
    cell = pose(col, rot=MAIN_ROT.get(name, 0))
    s = TARGET_MAX / max(cell.size)
    if s < 1:
        cell = cell.resize((round(cell.width * s), round(cell.height * s)), Image.LANCZOS)
    p = os.path.join(OUT_DIR, name)
    cell.save(p, optimize=True)
    print('saved', p, cell.size)
