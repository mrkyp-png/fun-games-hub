# 대포 무기 조준 5포즈 슬라이스.
#   입력  assets/src/cannon-a1~a5-source.png  (사용자 제공, 투명 배경)
#   출력  assets/weapons/cannon-a1~a5.png     (트림 + ~460px + 굵은 검은 외곽선만)
# 포즈 각도/포구 위치(mu,mv)/크기는 lane-cannon.js POSES 에서 튜닝.
#
# v296: eat_fringe 는 반투명(a<245) 가장자리만 정리 — 예전엔 "불투명 어두운/밝은 halo"
#   까지 먹어서 배럴 segment 사이 이음선을 파먹어 구멍 냈고, 그 구멍이 add_black_outline
#   에서 검게 채워졌음(사용자: "안쪽에 검은색 처리한 것은 지워"). 이제 검은 채움은
#   "바깥(테두리에서 flood 로 닿는 영역)" 으로만 제한 — 내부 틈/구멍은 안 채운다.
import os
from collections import deque
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(os.path.dirname(HERE), 'assets', 'src')
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'weapons')
# (소스이름, 출력이름, 가로 스트레치 배율)  — a5 만 조금 넓게(사용자 요청).
SRC = [('cannon-a1-source', 'cannon-a1', 1.0), ('cannon-a2-source', 'cannon-a2', 1.0),
       ('cannon-a3-source', 'cannon-a3', 1.0), ('cannon-a4-source', 'cannon-a4', 1.0),
       ('cannon-a5-source', 'cannon-a5', 1.12)]
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


def eat_fringe(im, band=4):
    # 반투명 가장자리(a<245)만 최대 band px 깊이로 정리. 불투명 픽셀은 건드리지 않음.
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
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
            a = px[nx, ny][3]
            if a == 0:
                dist[i] = 0
                dq.append((nx, ny))
            elif d < band and a < 245:
                dist[i] = d + 1
                dq.append((nx, ny))
    for i in range(w*h):
        if dist[i] >= 0:
            x, y = i % w, i // w
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)
    al = im.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.5))
    im.putalpha(al)
    return im


def add_black_outline(im, w=OUTLINE):
    # 실루엣을 dilate 한 뒤 "바깥(테두리 flood)" 부분만 검게. 내부 틈/구멍은 제외.
    pad = w + 6
    canv = Image.new('RGBA', (im.width + pad*2, im.height + pad*2), (0, 0, 0, 0))
    canv.alpha_composite(im, (pad, pad))
    cw, ch = canv.size
    ap = canv.split()[3].load()
    solid = [1 if ap[x, y] >= 40 else 0 for y in range(ch) for x in range(cw)]
    outside = bytearray(cw * ch)
    dq = deque()
    for x in range(cw):
        for y in (0, ch - 1):
            if not solid[y*cw+x] and not outside[y*cw+x]:
                outside[y*cw+x] = 1
                dq.append((x, y))
    for y in range(ch):
        for x in (0, cw - 1):
            if not solid[y*cw+x] and not outside[y*cw+x]:
                outside[y*cw+x] = 1
                dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
            if 0 <= nx < cw and 0 <= ny < ch and not outside[ny*cw+nx] and not solid[ny*cw+nx]:
                outside[ny*cw+nx] = 1
                dq.append((nx, ny))
    solid_img = Image.new('L', (cw, ch), 0)
    solid_img.putdata([255 if s else 0 for s in solid])
    dil = solid_img.filter(ImageFilter.GaussianBlur(w * 0.85)).point(lambda v: 255 if v >= 26 else 0)
    dil = dil.filter(ImageFilter.GaussianBlur(1.0))
    dilp = dil.load()
    ring = Image.new('L', (cw, ch), 0)
    rp = ring.load()
    for y in range(ch):
        for x in range(cw):
            if dilp[x, y] >= 40 and outside[y*cw+x]:
                rp[x, y] = dilp[x, y]
    out = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    out.paste(Image.new('RGBA', (cw, ch), (12, 12, 14, 255)), (0, 0), ring)
    out.alpha_composite(canv)
    bb = out.split()[3].getbbox()
    return out.crop(bb) if bb else out


os.makedirs(OUT, exist_ok=True)
for src, out, xk in SRC:
    im = Image.open(os.path.join(SRC_DIR, src + '.png')).convert('RGBA')
    im = keep_largest(im)
    im = eat_fringe(im)
    bb = im.split()[3].getbbox()
    if bb:
        im = im.crop(bb)
    if xk != 1.0:
        im = im.resize((round(im.width * xk), im.height), Image.LANCZOS)
    body_max = TARGET_MAX - 2 * OUTLINE
    if max(im.size) > body_max:
        s = body_max / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im = add_black_outline(im)
    p = os.path.join(OUT, out + '.png')
    im.save(p, optimize=True)
    print(out, im.size, 'ar=%.3f' % (im.height / im.width), os.path.getsize(p) // 1024, 'KB')
