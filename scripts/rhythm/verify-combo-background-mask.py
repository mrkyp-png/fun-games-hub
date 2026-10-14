from PIL import Image
import json
im=Image.open('review/combo-mask-only-v1088.png').convert('RGB');b=json.load(open('review/combo-mask-bounds-v1088.json'))
def pixel(x,y):return im.getpixel((round(b['x']+x/952*b['width']),round(b['y']+y/2078*b['height'])))
for i in range(9):
 x=176+i%3*300
 for y in [176+i//3*300,1286+i//3*300]:assert max(pixel(x,y))<3,(i,x,y,pixel(x,y))
for x,y in [(326,176),(476,1068),(326,1286)]:
 assert all(abs(a-v)<3 for a,v in zip(pixel(x,y),(13,10,0))),(x,y,pixel(x,y))
print('PASS: all 18 interiors black; upper/central/lower exposed background 5% gold over black')

for xy in [(195,8),(8,442),(195,875)]:
 assert all(abs(a-v)<3 for a,v in zip(im.getpixel(xy),(13,10,0))),(xy,im.getpixel(xy))
print('PASS: top/side/bottom margins match board background5%, no black cutoff')
