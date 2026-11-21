# V1791 C 사용자: 리듬팡 타입 선택 조명 2개는 남기되 새 그림(이미지젠: 남색 무광+금색 테) — 옛 그림(type-lights-v1569)과 같은 칸·크기·위치로 앉힘
# 사용: python make-rhythm-lights-v1791.py <옛 폴더> <새 폴더> <mount.png> <head-l.png> <head-c.png> <head-r.png>
import sys, shutil, os
from PIL import Image
old, new, m_src, hl, hc, hr = sys.argv[1:7]
os.makedirs(new, exist_ok=True)

def fit(src, box, canvas):
    """src(투명 PNG)를 box(옛 물체 영역)에 비율 유지로 맞춰 가운데 정렬"""
    s = Image.open(src).convert('RGBA'); s = s.crop(s.split()[3].point(lambda v: 255 if v > 20 else 0).getbbox())
    bw, bh = box[2] - box[0], box[3] - box[1]
    k = min(bw / s.width, bh / s.height); s = s.resize((max(1, round(s.width * k)), max(1, round(s.height * k))), Image.LANCZOS)
    canvas.alpha_composite(s, (box[0] + (bw - s.width) // 2, box[1] + (bh - s.height) // 2))

def obox(im):
    return im.split()[3].point(lambda v: 255 if v > 20 else 0).getbbox()

# 받침
om = Image.open(os.path.join(old, 'mount.webp')).convert('RGBA')
nm = Image.new('RGBA', om.size, (0, 0, 0, 0)); fit(m_src, obox(om), nm); nm.save(os.path.join(new, 'mount.webp'), quality=92)
# 머리 3x2 칸(256) — 열마다 같은 자세(왼쪽·정면·오른쪽), 칸마다 옛 물체 영역에 맞춤
oh = Image.open(os.path.join(old, 'heads-six-poses.webp')).convert('RGBA')
nh = Image.new('RGBA', oh.size, (0, 0, 0, 0)); cw, ch = oh.width // 3, oh.height // 2
for r in range(2):
    for c, src in enumerate([hl, hc, hr]):
        cell = oh.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)); b = obox(cell)
        tmp = Image.new('RGBA', (cw, ch), (0, 0, 0, 0)); fit(src, b, tmp); nh.alpha_composite(tmp, (c * cw, r * ch))
nh.save(os.path.join(new, 'heads-six-poses.webp'), quality=92)
for k in ['stage-dark', 'beams-four', 'stars-eight']:
    shutil.copy(os.path.join(old, k + '.webp'), os.path.join(new, k + '.webp'))
print('done', nm.size, nh.size)
