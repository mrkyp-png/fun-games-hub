import json,os
from pathlib import Path
from PIL import Image
p=Path(os.environ['TEMP'])/'rb-progress-fixed-1146';data=json.loads(p.with_suffix('.json').read_text())
for row in data['rows']:
 im=Image.open(str(p)+'-'+str(row['fraction'])+'.png').convert('RGB');scale=im.width/390;counts=[]
 for pts in row['points']:
  count=0
  for v in pts:
   x,y=round(v['x']*scale),round(v['y']*scale)
   count+=int(max(max(im.getpixel((xx,yy))) for xx in range(max(0,x-1),min(im.width,x+2)) for yy in range(max(0,y-1),min(im.height,y+2)))>90)
  counts.append(count)
 expected=[max(0,min(1,row['fraction']*2-i))*100 for i in range(2)]
 assert all(abs(a-b)<=2 for a,b in zip(counts,expected)),(row['fraction'],counts,expected)
 print(row['fraction'],counts)
print('PASS real rendered pixels:100 points per line,continuous transfer at50%,full at song end',data['duration'])
