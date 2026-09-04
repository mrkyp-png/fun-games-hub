"""무기 스킨 스프라이트 슬라이스.

입력:
  Desktop/대포.png       (5포즈) — #3(우상단) = 대기 자세 (포신 좌상향, 우하단 코너용)
  Desktop/대포 화염.png  (2행x3열 발사 시퀀스, #3와 같은 각도) — flash/smoke 프레임

출력 assets/weapons/:
  cannon.png       대기 (대포.png #3, 연기 없음)
  cannon-fire.png  발사 순간 (큰 총구 화염, 대포 포함)
  cannon-smoke.png 직후 (연기, 대포 포함)
  cannon-ball.png  포탄 + 짧은 불꼬리 (대포 화염 하단행에서)

대기/발사/연기 3장은 캐리지 바닥(바퀴)이 같은 위치에 오도록 lane-cannon.js 가 배치 →
포신 각도·화염 차이가 자연스러운 반동으로 보인다.
"""

import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'weapons')
SRC_CANNON = os.path.join(os.path.expanduser('~'), 'Desktop', '대포.png')
SRC_FIRE = os.path.join(os.path.expanduser('~'), 'Desktop', '대포 화염.png')


def crop_bbox(im, box):
    c = im.crop(box)
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
    # 상단행 = 발사 시퀀스 (대포.png #3 와 같은 각도). f0=화염, f1=연기. (육안 측정 좌표)
    cap(crop_bbox(fr, (150, 0, 775, 520)), 460).save(os.path.join(OUT, 'cannon-fire.png'))
    cap(crop_bbox(fr, (800, 10, 1425, 512)), 440).save(os.path.join(OUT, 'cannon-smoke.png'))

    for n in ('cannon', 'cannon-fire', 'cannon-smoke'):
        p = os.path.join(OUT, n + '.png')
        print(n, Image.open(p).size, os.path.getsize(p) // 1024, 'KB')


if __name__ == '__main__':
    main()
