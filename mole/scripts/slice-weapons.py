"""무기 스킨 스프라이트 슬라이스.

입력:
  Desktop/대포.png       (5포즈) — #3(우상단) = 대기 자세 (포신 좌상향, 우하단 코너용)
  Desktop/대포 화염.png  (발사 시퀀스, #3와 같은 각도) — 여기선 **화염·연기만** 크롭 (대포 제외).
                         (fire 시트의 대포는 포구가 찌그러져 있어 본체로 못 씀.)

출력 assets/weapons/:
  cannon.png       대포 본체 (대포.png #3) — 항상 표시
  cannon-flash.png 총구 화염만 (좌상향, 오른쪽 끝 = 포구 부착점)
  cannon-smoke.png 총구 연기만
"""

import os
from collections import deque
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'weapons')
SRC_CANNON = os.path.join(os.path.expanduser('~'), 'Desktop', '대포.png')
SRC_FIRE = os.path.join(os.path.expanduser('~'), 'Desktop', '대포 화염.png')


def drop_specks(im, min_area=1200):
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy][3] < 24:
                continue
            comp, dq = [], deque([(sx, sy)])
            seen[sy * w + sx] = 1
            while dq:
                x, y = dq.popleft()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny][3] >= 24:
                        seen[ny * w + nx] = 1
                        dq.append((nx, ny))
            if len(comp) < min_area:
                for x, y in comp:
                    r, g, b, _ = px[x, y]
                    px[x, y] = (r, g, b, 0)
    return im


def crop_bbox(im, box):
    c = drop_specks(im.crop(box))
    bb = c.split()[3].getbbox()
    return c.crop(bb) if bb else c


def cap(im, mx):
    if max(im.size) <= mx:
        return im
    s = mx / max(im.size)
    return im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)

    cn = Image.open(SRC_CANNON).convert('RGBA')
    cap(crop_bbox(cn, (1112, 40, 1522, 528)), 340).save(os.path.join(OUT, 'cannon.png'))

    fr = Image.open(SRC_FIRE).convert('RGBA')
    # 화염 = 불꽃+스파크+바깥 연기 넓게 (사용자가 큰 화염 선호). 포신 금속만 제외.
    cap(crop_bbox(fr, (14, 0, 408, 300)), 460).save(os.path.join(OUT, 'cannon-flash.png'))
    cap(crop_bbox(fr, (792, 36, 1010, 290)), 280).save(os.path.join(OUT, 'cannon-smoke.png'))
    # 포탄 = 깨끗한 검은 철구 (불꼬리 제외 — 구는 회전해도 똑같아 각도 상관없음).
    cap(crop_bbox(fr, (2, 526, 80, 602)), 96).save(os.path.join(OUT, 'cannon-ball.png'))

    for n in ('cannon', 'cannon-flash', 'cannon-smoke', 'cannon-ball'):
        p = os.path.join(OUT, n + '.png')
        print(n, Image.open(p).size, os.path.getsize(p) // 1024, 'KB')


if __name__ == '__main__':
    main()
