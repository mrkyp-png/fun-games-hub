"""PWA 아이콘 생성 — icons/icon-192.png, icon-512.png.
코스믹 다크 배경(별 몇 개 + 브랜드색 글로우) + 헬멧 쓴 두더지(mole1) 얼굴을 maskable 안전영역
(중앙 ~80% 지름) 안에 얹는다. OS 가 원/스퀴클로 마스킹해도 얼굴이 안 잘리게.
실행: python scripts/make-icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'icons')
BG = (13, 10, 36)        # cosmic-theme --bg #0d0a24
GLOW = (139, 127, 255)   # --brand #8b7fff

os.makedirs(OUT, exist_ok=True)
mole = Image.open(os.path.join(ROOT, 'assets', 'moles', 'mole1.png')).convert('RGBA')
mb = mole.getbbox()
mole = mole.crop(mb)  # 얼굴+몸 상단


def build(size):
    im = Image.new('RGBA', (size, size), BG + (255,))
    # 중앙 브랜드색 글로우
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    r = int(size * 0.42)
    gd.ellipse([size // 2 - r, size // 2 - r, size // 2 + r, size // 2 + r], fill=GLOW + (90,))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.12))
    im.alpha_composite(glow)
    # 별 몇 개
    sd = ImageDraw.Draw(im)
    for (fx, fy, rad) in [(0.16, 0.2, 0.012), (0.82, 0.16, 0.016), (0.24, 0.82, 0.014),
                          (0.8, 0.8, 0.011), (0.5, 0.1, 0.01), (0.12, 0.55, 0.009)]:
        x, y, rr = fx * size, fy * size, rad * size
        sd.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(255, 255, 255, 235))
    # 두더지 — maskable 안전영역(중앙 80%) 안, 폭 ~62%
    target_w = int(size * 0.62)
    scale = target_w / mole.width
    m = mole.resize((target_w, max(1, int(mole.height * scale))), Image.LANCZOS)
    # 얼굴이 가운데 오게: 살짝 아래로 내려 앉힘
    x = (size - m.width) // 2
    y = int(size * 0.5 - m.height * 0.42)
    im.alpha_composite(m, (x, y))
    im.convert('RGB').save(os.path.join(OUT, f'icon-{size}.png'))
    print(f'icon-{size}.png')


build(192)
build(512)
