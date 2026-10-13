"""맨 아래 버튼 하단만 정상적인 첫째 줄 하단 픽셀로 복구."""
from pathlib import Path
from PIL import Image, ImageDraw
p=Path('mole/assets/rhythm-b')
original=Image.open(p/'skeleton.png').convert('RGBA')
fixed=original.copy()
# 연결부 중앙은 1356→1956으로 동일한 600px 간격. 리사이즈 없이 복사.
fixed.paste(original.crop((0,1318,952,1356)),(0,1918))
# 연결부를 중간에서 잘라 붙이지 않고 본체 전체를 동일 원본으로 맞춘다.
# 광고창 면은 보존하고 연결부의 실제 팔각형 본체만 교체.
for cx in [26,326,626,926]:
    node=original.crop((cx-28,1356-28,cx+29,1356+29))
    mask=Image.new('L',(57,57),0)
    ImageDraw.Draw(mask).polygon([(10,0),(46,0),(56,10),(56,46),(46,56),(10,56),(0,46),(0,10)],fill=255)
    fixed.paste(node,(cx-28,1956-28),mask)
assert fixed.crop((0,0,952,1918)).tobytes()==original.crop((0,0,952,1918)).tobytes()
assert fixed.crop((0,1985,952,2078)).tobytes()==original.crop((0,1985,952,2078)).tobytes()
fixed.save(p/'skeleton-bottom-fixed.png')
print('PASS: bottom corners and full connector bodies matched; upper regions and ad face preserved.')
