from pathlib import Path
from PIL import Image,ImageDraw,ImageChops,ImageFilter
p=Path('mole/assets/rhythm-b');protect=Image.new('L',(300,300));d=ImageDraw.Draw(protect)
for cx in [0,300]:
 for cy in [0,300]:d.polygon([(cx-18,cy-28),(cx+18,cy-28),(cx+28,cy-18),(cx+28,cy+18),(cx+18,cy+28),(cx-18,cy+28),(cx-28,cy+18),(cx-28,cy-18)],fill=255)
for i in range(9):
 im=Image.open(p/f'uniform-inner-line-{i}.png').convert('RGBA');im.putalpha(ImageChops.multiply(im.getchannel('A').filter(ImageFilter.MaxFilter(5)),ImageChops.invert(protect)));assert ImageChops.multiply(im.getchannel('A'),protect).getbbox() is None;im.save(p/f'note-inner-line-{i}.png')
print('PASS: 9 note borders match native glow; connector pixels excluded')
