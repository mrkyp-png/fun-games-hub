"""Calculated gate-colour reference only; not a game/browser screenshot."""
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
w,h=180,300
x,y=np.meshgrid((np.arange(w)+.5)/w,(np.arange(h)+.5)/h)
proof=Image.new('RGB',(w*3,h+24),'#392452')
for index,t in enumerate((0,4,8)):
    ripple=.5+.5*np.sin(x*8+y*5+t*.42+np.sin(y*7+t*.22)*.9)
    second=.5+.5*np.sin(x*13-y*4-t*.28)
    flow=ripple**5*.65+second**8*.35
    haze=.5+.5*np.sin(x*3+y*6+t*.20)
    body=np.array([.24,.12,.41])*(1-haze[...,None]*.7)+np.array([.42,.27,.60])*haze[...,None]*.7
    pearl=np.array([1,.88,.63])*(1-second[...,None])+np.array([1,.97,.87])*second[...,None]
    c=body*(1-flow[...,None]*.82)+pearl*flow[...,None]*.82
    edge=np.abs(x-.5)**8*256*.06
    alpha=np.clip(.30+flow*.42+edge,0,.8)[...,None]
    c=c*alpha+np.array([.36,.22,.53])*(1-alpha)
    proof.paste(Image.fromarray(np.uint8(np.clip(c,0,1)*255)),(index*w,24))
    ImageDraw.Draw(proof).text((index*w+5,5),f'CPU reference t={t}s',fill='#fff3d4')
path=Path(__file__).resolve().parent/'beach-stunts-v1690/gate-flow-reference.png';proof.save(path)
print('Saved slow ivory/gold flow reference; actual browser unverified.')
