# 뿅망치 검은 외곽선.
#   입력  assets/src/hammer-clean.png  (외곽선 없는 투명 원본, 301x540)
#   출력  assets/hammer.png            (부드러운 검은 외곽선, ~325x564)
# 대포(slice-cannon-angles.py)와 같은 방식이나 dilate 를 MaxFilter(클린)로 해서 경계가
# 까칠하지 않음(사용자 피드백). 스프라이트가 커진 만큼 lane-hammer.js GRIP_X/Y 와
# style.css .lane-hammer width 를 맞춰야 함 — 실행하면 새 값을 출력한다.
import os
from collections import deque
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), 'assets', 'src', 'hammer-clean.png')
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'hammer.png')
OUTLINE = 9
OLD_GRIP_X, OLD_GRIP_Y = 24.0, 84.0   # 구 스프라이트(301x540) 기준 grip %
OLD_LAYER_W = 13.0                     # 구 .lane-hammer width %


def eat_fringe(im, band=4):
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
    al = im.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    im.putalpha(al)
    return im


def add_black_outline(im, w=OUTLINE):
    pad = w + 8
    canv = Image.new('RGBA', (im.width + pad*2, im.height + pad*2), (0, 0, 0, 0))
    canv.alpha_composite(im, (pad, pad))
    cw, ch = canv.size
    a_full = canv.split()[3]
    sil = a_full.point(lambda v: 255 if v >= 40 else 0)
    # 클린 dilate: MaxFilter 를 커널 21 제한에 맞춰 나눠 적용(반경 w)
    k = 2 * w + 1
    dil = sil.filter(ImageFilter.MaxFilter(min(k, 21)))
    if k > 21:
        dil = dil.filter(ImageFilter.MaxFilter(2 * (k - 21) + 1))
    dil = dil.filter(ImageFilter.GaussianBlur(0.9))   # 얇은 안티에일리어스만 (blur 크면 그림자처럼 번짐)
    dp = dil.load()
    sp = sil.load()
    outside = bytearray(cw * ch)
    dq = deque()
    for x in range(cw):
        for y in (0, ch - 1):
            if sp[x, y] < 40 and not outside[y*cw+x]:
                outside[y*cw+x] = 1
                dq.append((x, y))
    for y in range(ch):
        for x in (0, cw - 1):
            if sp[x, y] < 40 and not outside[y*cw+x]:
                outside[y*cw+x] = 1
                dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
            if 0 <= nx < cw and 0 <= ny < ch and not outside[ny*cw+nx] and sp[nx, ny] < 40:
                outside[ny*cw+nx] = 1
                dq.append((nx, ny))
    ero = sil.filter(ImageFilter.MinFilter(5))
    ep = ero.load()
    ring = Image.new('L', (cw, ch), 0)
    rp = ring.load()
    for y in range(ch):
        for x in range(cw):
            if dp[x, y] and (outside[y*cw+x] or ep[x, y] < 128):
                rp[x, y] = dp[x, y]
    body_a = a_full.filter(ImageFilter.MinFilter(3))
    body = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    body.paste(canv, (0, 0), body_a)
    out = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    out.paste(Image.new('RGBA', (cw, ch), (12, 12, 14, 255)), (0, 0), ring)
    out.alpha_composite(body)
    bb = out.split()[3].getbbox()
    return out.crop(bb), bb, pad


orig = Image.open(SRC).convert('RGBA')
OW, OH = orig.size
grip_px = (OLD_GRIP_X / 100 * OW, OLD_GRIP_Y / 100 * OH)
im = eat_fringe(orig)
outlined, bb, pad = add_black_outline(im)
NW, NH = outlined.size
new_grip = ((grip_px[0] + pad - bb[0]) / NW * 100, (grip_px[1] + pad - bb[1]) / NH * 100)
new_layer_w = OLD_LAYER_W * NW / OW

outlined.save(OUT, optimize=True)
print('hammer.png  %dx%d  %dKB' % (NW, NH, os.path.getsize(OUT) // 1024))
print('lane-hammer.js  GRIP_X = %.1f  GRIP_Y = %.1f' % new_grip)
print('style.css       .lane-hammer width = %.2f%%' % new_layer_w)
