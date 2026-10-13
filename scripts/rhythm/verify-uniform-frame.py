"""Independent measurements on the final displayed PNG, not declared coordinates."""
from PIL import Image,ImageDraw,ImageChops
from collections import deque
from pathlib import Path
import hashlib,json
p=Path('mole/assets/rhythm-b');im=Image.open(p/'skeleton-uniform.png').convert('RGBA');a=im.getchannel('A');rows=[];masks=[]
for base in [26,1056]:
 for row in range(3):
  for col in range(3):
   x0,y0=26+col*300,base+row*300;q=deque([(150,150)]);seen={(150,150)};cell=a.crop((x0,y0,x0+300,y0+300))
   while q:
    x,y=q.popleft()
    for xx,yy in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
     if 0<=xx<300 and 0<=yy<300 and (xx,yy) not in seen and cell.getpixel((xx,yy))<128:seen.add((xx,yy));q.append((xx,yy))
   xs=[v[0] for v in seen];ys=[v[1] for v in seen];bounds=[min(xs),min(ys),max(xs)+1,max(ys)+1]
   assert bounds==[23,23,277,277],bounds
   assert ((bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2)==(150,150)
   masks.append(cell.tobytes());rows.append({'group':'upper' if base==26 else 'lower','row':row+1,'col':col+1,'width':254,'height':254,'center':[x0+150,y0+150]})
assert len(set(masks))==1
nm=Image.new('L',(57,57));ImageDraw.Draw(nm).polygon([(10,0),(46,0),(56,10),(56,46),(46,56),(10,56),(0,46),(0,10)],fill=255)
node=im.crop((-2,-2,55,55));ref=im.crop((298,298,355,355))
for base in [26,1056]:
 for y in [base+i*300 for i in range(4)]:
  for x in [326,626]:
   patch=im.crop((x-28,y-28,x+29,y+29));visible=nm.copy()
   if y<28:ImageDraw.Draw(visible).rectangle((0,0,56,27-y),fill=0)
   assert ImageChops.multiply(ImageChops.difference(patch,ref).convert('RGB'),Image.merge('RGB',(visible,visible,visible))).getbbox() is None
for name,digest in [('mini-user.png','DE3C813FD17E1800CE43C15F91B65A75DC22403AFE3E3DED36852F6A397FAE03'),('circuit-user.png','98D0E9D0526E786F9134AD7C38128AE2694B719CB8F8A1C94E90DF1285D4405F')]:assert hashlib.sha256((p/name).read_bytes()).hexdigest().upper()==digest
Path('review/uniform-measured-v1038.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print('PASS: final PNG 18/18 openings measured 254x254, centered, alpha identical; node pixels identical; user assets unchanged')
