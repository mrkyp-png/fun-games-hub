# V1793 C 사용자: 킹판취 메뉴 그림 = 3D 글러브 렌더(render-alipunch-stills-v1793.py)를 옛 그림과 같은 크기·자리로
#  한 짝(손등) → weapons/kingfist-3d-v1793.webp (옛 kingfist-jab-mirror-clay-v1739 1000x1104 자리)
#  두 짝(손바닥·메달, 왼쪽 원본·오른쪽 거울, 맞닿음) → workshop/w-alipunch-3d-v1793.png (옛 w-alipunch-idle-clay-v1739 859x492 자리)
# 사용: python make-alipunch-stills-v1793.py <렌더 접두사> <mole/assets 폴더>
import sys, os
from PIL import Image, ImageOps
pre, A = sys.argv[1], sys.argv[2]
def crop(p):
    im = Image.open(p).convert('RGBA'); return im.crop(im.split()[3].point(lambda v: 255 if v > 8 else 0).getbbox())
def box(p):
    im = Image.open(p).convert('RGBA'); return im.size, im.split()[3].point(lambda v: 255 if v > 8 else 0).getbbox()
def fit_into(src, size, bb):
    c = Image.new('RGBA', size, (0, 0, 0, 0)); bw, bh = bb[2] - bb[0], bb[3] - bb[1]
    k = min(bw / src.width, bh / src.height); s = src.resize((round(src.width * k), round(src.height * k)), Image.LANCZOS)
    c.alpha_composite(s, (bb[0] + (bw - s.width) // 2, bb[3] - s.height)); return c   # 아래(소매 끝) 맞춤
size, bb = box(os.path.join(A, 'weapons/kingfist-jab-mirror-clay-v1739.webp'))
fit_into(crop(pre + '-back.png'), size, bb).save(os.path.join(A, 'weapons/kingfist-3d-v1793.webp'), quality=92)
g = crop(pre + '-front.png'); gap = -round(g.width * 0.06)                 # 두 짝이 살짝 겹치게 맞닿음
pair = Image.new('RGBA', (g.width * 2 + gap, g.height), (0, 0, 0, 0)); pair.alpha_composite(g, (0, 0)); pair.alpha_composite(ImageOps.mirror(g), (g.width + gap, 0))
size, bb = box(os.path.join(A, 'workshop/w-alipunch-idle-clay-v1739.png'))
fit_into(pair, size, bb).save(os.path.join(A, 'workshop/w-alipunch-3d-v1793.png'))
print('saved')
