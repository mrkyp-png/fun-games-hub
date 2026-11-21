# V1791 C 사용자: 리듬팡 큰 테두리 = 이미지젠 남색·금색 무광 테두리(꽃·잎 없음) → 9칸 늘림(border-image)용 원본 크기, 안쪽은 남색으로 채움
# 사용: python make-rhythm-clay-frame-v1791.py <이미지젠 result.png> <출력.png>
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
bb = im.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()
im = im.crop(bb)  # 바깥 여백 잘라 테두리가 그림 끝에 닿게
# 가운데에서 이어진 투명 영역 = 안쪽 → 남색(배경 시안과 같은 톤)으로 채움
mask = Image.new('L', im.size, 0)
a = im.split()[3]
w, h = im.size
seen = set(); st = [(w // 2, h // 2)]
px = a.load(); mk = mask.load()
while st:
    x, y = st.pop()
    if (x, y) in seen or x < 0 or y < 0 or x >= w or y >= h: continue
    seen.add((x, y))
    if px[x, y] > 200: continue
    mk[x, y] = 255 - px[x, y]
    st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
fill = Image.new('RGBA', im.size, (20, 29, 52, 242))
base = Image.new('RGBA', im.size, (0, 0, 0, 0)); base.paste(fill, (0, 0), mask)
Image.alpha_composite(base, im).save(out)
print('saved', out, 'inner px', len(seen))
