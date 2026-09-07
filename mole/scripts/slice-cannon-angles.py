# 대포 무기 조준 5포즈 슬라이스.
#   입력  assets/src/cannon-a1~a5-source.png  (사용자 제공, 무지개 키아웃 자국 有)
#   출력  assets/weapons/cannon-a1~a5.png     (자국 제거 + 트림 + ~460px + 굵은 검은 외곽선)
# 포즈 각도/포구 위치(mu,mv)는 lane-cannon.js POSES 에서 튜닝.
import os
from collections import deque
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(os.path.dirname(HERE), 'assets', 'src')
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'weapons')
SRC = [('cannon-a1-source', 'cannon-a1'), ('cannon-a2-source', 'cannon-a2'),
       ('cannon-a3-source', 'cannon-a3'), ('cannon-a4-source', 'cannon-a4'),
       ('cannon-a5-source', 'cannon-a5')]
TARGET_MAX = 460     # 외곽선 포함 최종 최대 변 px
OUTLINE = 9          # 검은 외곽선 두께 px (굵게)


def keep_largest(im):
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    best = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy][3] < 30:
                continue
            comp, dq = [], deque([(sx, sy)])
            seen[sy * w + sx] = 1
            while dq:
                x, y = dq.popleft()
                comp.append((x, y))
                for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny*w+nx] and px[nx, ny][3] >= 30:
                        seen[ny*w+nx] = 1
                        dq.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    keep = set(best)
    for y in range(h):
        for x in range(w):
            if (x, y) not in keep:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)
    return im


def eat_fringe(im, band=6):
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()

    def edible(x, y):
        r, g, b, a = px[x, y]
        if a == 0:
            return False
        if a < 245:
            return True
        lum = (r + g + b) / 3
        return lum > 232 or lum < 26

    dist = [-1] * (w * h)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if px[x, y][3] == 0:
                dist[y*w+x] = 0
                dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if px[x, y][3] == 0:
                dist[y*w+x] = 0
                dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        d = dist[y*w+x]
        for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
            if not (0 <= nx < w and 0 <= ny < h) or dist[ny*w+nx] != -1:
                continue
            i = ny*w+nx
            if px[nx, ny][3] == 0:
                dist[i] = 0
                dq.append((nx, ny))
            elif d < band and edible(nx, ny):
                dist[i] = d + 1
                dq.append((nx, ny))
    for i in range(w*h):
        if dist[i] >= 0:
            x, y = i % w, i // w
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)
    al = im.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    im.putalpha(al)
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if 0 < a < 255 and (r + g + b) / 3 > 205:
                px[x, y] = (r, g, b, 0)
    return im


def add_black_outline(im, w=OUTLINE):
    pad = w + 4
    canv = Image.new('RGBA', (im.width + pad*2, im.height + pad*2), (0, 0, 0, 0))
    canv.alpha_composite(im, (pad, pad))
    a = canv.split()[3]
    spread = a.filter(ImageFilter.GaussianBlur(w * 0.85)).point(lambda v: 255 if v >= 26 else 0)
    spread = spread.filter(ImageFilter.GaussianBlur(1.1))
    out = Image.new('RGBA', canv.size, (0, 0, 0, 0))
    out.paste(Image.new('RGBA', canv.size, (12, 12, 14, 255)), (0, 0), spread)
    out.alpha_composite(canv)
    bb = out.split()[3].getbbox()
    return out.crop(bb) if bb else out


os.makedirs(OUT, exist_ok=True)
for src, out in SRC:
    im = Image.open(os.path.join(SRC_DIR, src + '.png')).convert('RGBA')
    im = keep_largest(im)
    im = eat_fringe(im)
    bb = im.split()[3].getbbox()
    if bb:
        im = im.crop(bb)
    # 외곽선 두께가 일정하도록 먼저 목표 크기로 축소한 뒤 외곽선
    body_max = TARGET_MAX - 2 * OUTLINE
    if max(im.size) > body_max:
        s = body_max / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im = add_black_outline(im)
    p = os.path.join(OUT, out + '.png')
    im.save(p, optimize=True)
    print(out, im.size, 'ar=%.3f' % (im.height / im.width), os.path.getsize(p) // 1024, 'KB')
