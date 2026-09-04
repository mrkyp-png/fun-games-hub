"""무기 스킨 스프라이트 슬라이스.

입력:
  Desktop/대포.png       (5포즈) — #3(우상단) = 대기 자세 (포신 좌상향, 우하단 코너용)
  Desktop/대포 화염.png  (발사 시퀀스, #3와 같은 각도) — 여기선 **화염·연기만** 크롭 (대포 제외).
                         (fire 시트의 대포는 포구가 찌그러져 있어 본체로 못 씀.)
  assets/src/cannon-angles.jpg  (대포 11종 시트, 흰 배경) — 조준 포즈 2개 크롭.
                         (= Desktop/진짜 파일.jpeg, 재현용으로 커밋됨.)

출력 assets/weapons/:
  cannon.png       대포 본체 (대포.png #3, ~40° 좌상향) — 중간 각도 조준 포즈
  cannon-low.png   시트 중간줄 2번째 (~28° 좌상향) — 얕은 각도 조준 포즈
  cannon-steep.png 시트 위쪽줄 2번째 (정면 3/4, 포신 거의 수직) — 가파른 각도 조준 포즈
  cannon-flash.png 총구 화염만 (좌상향, 오른쪽 끝 = 포구 부착점)
  cannon-smoke.png 총구 연기만
"""

import os
from collections import deque
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'weapons')
SRC_CANNON = os.path.join(os.path.expanduser('~'), 'Desktop', '대포.png')
SRC_FIRE = os.path.join(os.path.expanduser('~'), 'Desktop', '대포 화염.png')
SRC_ANGLES = os.path.join(os.path.dirname(HERE), 'assets', 'src', 'cannon-angles.jpg')

# cannon-angles.jpg (2496x1664) 셀 박스 — 연결요소 검출로 잡은 값
ANGLE_BOXES = {
    'cannon-steep': (627, 40, 975, 566),    # 위쪽줄 2번째 (정면, 포신 수직)
    'cannon-low':   (976, 551, 1576, 1037),  # 중간줄 2번째 (~28° 좌상향)
}


def key_white(im):
    """흰 배경을 테두리에서 flood 로 제거 (대포 내부엔 흰색 없음)."""
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size

    def whiteish(x, y):
        r, g, b, a = px[x, y]
        return a > 0 and (r + g + b) / 3 > 225 and max(r, g, b) - min(r, g, b) < 24

    seen = bytearray(w * h)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if whiteish(x, y):
                seen[y * w + x] = 1
                dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if whiteish(x, y):
                seen[y * w + x] = 1
                dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and whiteish(nx, ny):
                seen[ny * w + nx] = 1
                dq.append((nx, ny))
    for i in range(w * h):
        if seen[i]:
            x, y = i % w, i // w
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)
    # 알파 1px 침식 + 남은 near-white 프린지 제거
    al = im.split()[3].filter(ImageFilter.MinFilter(3))
    im.putalpha(al)
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if 0 < a < 255 and min(r, g, b) > 200:
                px[x, y] = (r, g, b, 0)
    return im


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

    # 조준 포즈 2개 (흰 배경 시트에서 키아웃 + bbox 트림)
    ang = Image.open(SRC_ANGLES).convert('RGBA')
    for name, box in ANGLE_BOXES.items():
        sp = key_white(ang.crop(box))
        bb = sp.split()[3].getbbox()
        if bb:
            sp = sp.crop(bb)
        cap(sp, 600).save(os.path.join(OUT, name + '.png'))

    fr = Image.open(SRC_FIRE).convert('RGBA')
    # 화염 = 불꽃+스파크+바깥 연기 넓게 (사용자가 큰 화염 선호). 포신 금속만 제외.
    cap(crop_bbox(fr, (14, 0, 408, 300)), 460).save(os.path.join(OUT, 'cannon-flash.png'))
    cap(crop_bbox(fr, (792, 36, 1010, 290)), 280).save(os.path.join(OUT, 'cannon-smoke.png'))
    # 포탄 = 깨끗한 검은 철구 (불꼬리 제외 — 구는 회전해도 똑같아 각도 상관없음).
    cap(crop_bbox(fr, (2, 526, 80, 602)), 96).save(os.path.join(OUT, 'cannon-ball.png'))

    for n in ('cannon', 'cannon-low', 'cannon-steep', 'cannon-flash', 'cannon-smoke', 'cannon-ball'):
        p = os.path.join(OUT, n + '.png')
        print(n, Image.open(p).size, os.path.getsize(p) // 1024, 'KB')


if __name__ == '__main__':
    main()
