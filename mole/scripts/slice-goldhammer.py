# 골드해머(지진 무기) 스프라이트 — 소스 회전 시트에서 필요한 포즈만.
#   입력  ~/Desktop/특수망치.png  (16각도 회전 시트, 5+5+6. 이미 투명 배경 + 하머 자체 검은 외곽선.
#                                  배경엔 옅은 청록 글로우 + 하단 "N°" 라벨 알약만 붙어있음)
#   출력  assets/weapons/goldhammer.png     (메인 = 67.5° 를 뿅망치 손잡이각도에 맞춰 시계 32° 회전)
#         assets/weapons/goldhammer-0.png   (0°  = 지진 분신 — ✱·0·# 칸 방향용)
#         assets/weapons/goldhammer-45.png  (45° = 지진 분신 — 숫자칸 방향용)
#         assets/weapons/goldhammer-90.png  (90° = 지진 분신 — 연락처·키패드·최근기록 칸 방향용)
#
# 처리 = 최소한만. 알파 임계로 청록 글로우만 제거 → keep_largest 로 라벨 알약 탈락 →
#   알파 살짝 스무딩 → (메인만 회전) → 얇은 검은 외곽선(2px, 바깥에만 — 아트 본체는 절대 안 건드림).
import os
from collections import deque
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(os.path.dirname(HERE), 'assets', 'weapons')
SRC = os.path.expanduser('~/Desktop/특수망치.png')

TARGET_MAX = 440
ALPHA_CUT = 120     # 이 미만 알파 = 배경(청록 글로우) — 버림. 너무 높이면 하머 AA 가장자리가 깎임.
OUTLINE = 4         # 검은 외곽선 px (실루엣 바깥에만, 아트 내부는 안 건드림)
# (열 인덱스, 출력명, 추가 회전도[시계+=음수 아님, PIL rotate 는 CCW+ 라 시계는 음수])
POSES = [(3, 'goldhammer.png', 0), (0, 'goldhammer-0.png', 0),
         (2, 'goldhammer-45.png', 0), (4, 'goldhammer-90.png', 0)]


def keep_largest(im):
    w, h = im.size
    px = im.load()
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
    return im


im = Image.open(SRC).convert('RGBA')
W, H = im.size
CELL_W = W / 5
ROW_H = H / 3

os.makedirs(OUT_DIR, exist_ok=True)
for col, name, rot in POSES:
    x0 = int(col * CELL_W)
    cell = im.crop((max(0, x0 - 4), 0, min(W, x0 + int(CELL_W) + 6), min(H, int(ROW_H * 1.22)))).convert('RGBA')
    r, g, b, a = cell.split()
    a = a.point(lambda v: 0 if v < ALPHA_CUT else v)      # 청록 글로우만 컷 (하머 본체는 알파 255)
    cell = Image.merge('RGBA', (r, g, b, a))
    cell = keep_largest(cell)                              # 라벨 알약 탈락
    # 알파 계단현상만 아주 살짝 정리 (본체/외곽선은 안 건드림)
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
    if OUTLINE > 0:
        # 얇은 검은 링을 실루엣 바깥에만. 원본 아트는 그 위에 그대로 얹음 (내부 안 건드림).
        pad = OUTLINE + 2
        canv = Image.new('RGBA', (cell.width + pad*2, cell.height + pad*2), (0, 0, 0, 0))
        canv.alpha_composite(cell, (pad, pad))
        sil = canv.split()[3].point(lambda v: 255 if v >= 40 else 0)
        dil = sil.filter(ImageFilter.MaxFilter(2 * OUTLINE + 1)).filter(ImageFilter.GaussianBlur(0.6))
        out = Image.new('RGBA', canv.size, (0, 0, 0, 0))
        out.paste(Image.new('RGBA', canv.size, (18, 16, 18, 255)), (0, 0), dil)
        out.alpha_composite(canv)
        bb = out.split()[3].getbbox()
        cell = out.crop(bb) if bb else out
    s = TARGET_MAX / max(cell.size)
    if s < 1:
        cell = cell.resize((round(cell.width * s), round(cell.height * s)), Image.LANCZOS)
    out = os.path.join(OUT_DIR, name)
    cell.save(out, optimize=True)
    print('saved', out, cell.size)
