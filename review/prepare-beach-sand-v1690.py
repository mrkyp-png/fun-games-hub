"""Pack the ImageGen source and derive matching render/occlusion layers, without repainting."""
from pathlib import Path
from PIL import Image
import json,statistics,hashlib
from collections import deque
repo=Path(__file__).resolve().parent.parent;folder=repo/'mole/assets/rhythm/beach-sand-hole-v1690'
source=Image.open(folder/'hole-source.png').convert('RGBA')
box=source.getchannel('A').point(lambda a:255 if a>=64 else 0).getbbox()
pad=12;box=(max(0,box[0]-pad),max(0,box[1]-pad),min(source.width,box[2]+pad),min(source.height,box[3]+pad))
image=source.crop(box);size=(1024,round(image.height/image.width*1024));image=image.resize(size,Image.Resampling.LANCZOS);w,h=size
pixels=image.load();cy=round(h*.47)
def dark(x,y):
    r,g,b,a=pixels[x,y];return a>160 and r<132 and g<76 and b<54
seed=(w//2,cy);assert dark(*seed);queue=deque([seed]);seen={seed};columns={}
while queue:
    x,y=queue.popleft();columns.setdefault(x,[]).append(y)
    for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
        if 0<=nx<w and 0<=ny<h and (nx,ny) not in seen and dark(nx,ny):seen.add((nx,ny));queue.append((nx,ny))
valid={x:max(ys)+1 for x,ys in columns.items() if len(ys)>=10};lo=min(valid);hi=max(valid);raw=[]
for x in range(w):
    if x<lo:raw.append(h*.50+(valid[lo]-h*.50)*x/max(1,lo))
    elif x>hi:raw.append(valid[hi]+(h*.50-valid[hi])*(x-hi)/max(1,w-1-hi))
    else:raw.append(valid.get(x,valid[min(valid,key=lambda k:abs(k-x))]))
median=[statistics.median(raw[max(0,x-18):min(w,x+19)]) for x in range(w)]
curve=[sum(median[max(0,x-4):min(w,x+5)])/len(median[max(0,x-4):min(w,x+5)]) for x in range(w)]
# Exclude 3 source pixels of dark lip (about .3 CSS px on a 390px-wide phone).
# The source/back image is unchanged; foreground and GPU mask use the same inset.
curve=[edge+3 for edge in curve]
front=image.copy();front_pixels=front.load();mask=Image.new('RGBA',size,(255,255,255,0));mask_pixels=mask.load()
for x in range(w):
    edge=curve[x]
    for y in range(h):
        coverage=max(0,min(1,(y-edge+.75)/1.5));r,g,b,a=pixels[x,y]
        front_pixels[x,y]=(r,g,b,round(a*coverage));mask_pixels[x,y]=(255,255,255,round(255*coverage))
image.save(folder/'hole-back.png');front.save(folder/'hole-front.png');mask.save(folder/'hole-occlusion.png')
geometry={'width':w,'height':h,'frontCenterY':curve[w//2]/h,'sourceCrop':box,'frontCurvePixels':curve,'innerLipTrimPixels':3,'source':'built-in imagegen; continuous beach sand mound, replacing the V1689 stone rim; beach background palette reference','preservedOriginals':['../hole-1.png','../hole-2.png','../hole-3.png','../hole-4.png']}
(folder/'geometry.json').write_text(json.dumps(geometry,indent=2),encoding='utf-8')
for name in ['hole-back.png','hole-front.png','hole-occlusion.png']:
    im=Image.open(folder/name);assert im.size==size and im.mode=='RGBA'
assert max(curve)>h*.5 and max(abs(curve[i]-curve[i-1]) for i in range(1,w))<h*.08
print('PACKED_BEACH_HOLE',size,'front-center',geometry['frontCenterY'])
