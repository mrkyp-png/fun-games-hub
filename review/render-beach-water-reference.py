"""CPU colour/projection reference for visual QA; NOT a browser screenshot or shipped asset."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

out=Path(__file__).resolve().parent/'beach-plaza-v1690'
w,h=390,300
xx,yy=np.meshgrid((np.arange(w)+.5)/w,(np.arange(h)+.5)/h)
uv=np.stack((xx,yy),axis=-1)
def smooth(a,b,x):
    q=np.clip((x-a)/(b-a),0,1)
    return q*q*(3-2*q)
def norm(v):return v/np.maximum(np.linalg.norm(v,axis=-1,keepdims=True),1e-9)
def mix(a,b,t):return a*(1-t)+b*t
def reflect(v,n):return v-2*np.sum(v*n,axis=-1,keepdims=True)*n
def sea(p,t):return .06*np.sin(.55*p[...,0]+1.1*t)+.04*np.sin(.8*p[...,1]-.9*t+1.3)+.02*np.sin(.37*(p[...,0]+p[...,1])+1.7*t)
def water(t):
    eye=np.array([0.,4.,0.]);ray=np.stack(((xx-.5)*1.6,-(.045+yy*.55),-np.ones_like(xx)),axis=-1)
    distance=-4/ray[...,1]
    for _ in range(2):
        hit=eye+ray*distance[...,None];distance=(sea(hit[...,[0,2]],t)-4)/ray[...,1]
    world=eye+ray*distance[...,None];p=world[...,[0,2]];g=np.zeros((h,w,2))
    for i,(dx,dz,k) in enumerate([(.90,.42,.45),(-.55,.83,.62),(.20,-.98,.85),(-.94,-.33,1.4),(.70,.71,2.1),(-.15,.99,3.)]):
        direction=norm(np.array([dx,dz]));phase=np.sum(p*direction,axis=-1)*k*1.3+t*np.sqrt(9.8*k)*.55+i*1.7
        derivatives=np.gradient(phase);resolved=1-smooth(1,np.pi,np.abs(derivatives[0])+np.abs(derivatives[1]))
        g+=direction*(np.cos(phase)*.09*1.3*resolved)[...,None]
    n=norm(np.stack((-g[...,0],np.ones((h,w)),-g[...,1]),axis=-1));v=norm(eye-world)
    d=(1-yy)*22
    body=mix(np.array([.18,.69,.78]),np.array([.05,.34,.64]),smooth(.5,9,d)[...,None])
    sky=mix(np.array([.65,.83,.98]),np.array([.36,.66,.94]),np.clip(reflect(-v,n)[...,1],0,1)[...,None])
    fres=np.minimum(.38,.06+.94*np.maximum(0,1-np.maximum(0,np.sum(n*v,axis=-1)))**5)
    c=mix(body,sky,fres[...,None]);sun=np.array([.819152,.573576,0])
    c+=np.array([1,.97,.9])*(np.maximum(0,np.sum(reflect(-sun,n)*v,axis=-1))**180*.32)[...,None]
    foam=(1-smooth(0,.9,d))*(.6+.4*np.sin(d*6-t*1.8+g[...,0]*8))
    c=mix(c,np.array([.96,.98,1]),np.clip(foam,0,1)[...,None]*.7)
    fog=smooth(26,100,np.linalg.norm(eye-world,axis=-1))*.26
    c=mix(np.clip(c,0,1),np.array([.45,.72,.94]),fog[...,None]);c=mix(np.array([.51,.72,.86]),c,smooth(0,.10,yy)[...,None])
    alpha=smooth(0,5/h,yy)*(1-smooth(.94,1,yy))
    backdrop=mix(np.array([166,206,239])/255,np.array([240,204,147])/255,smooth(.8,1,yy)[...,None])
    return mix(backdrop,c,alpha[...,None])
images=[]
for t in (0,1.5):
    im=Image.new('RGB',(w,h+100),'#a6ceef');im.paste(Image.fromarray(np.uint8(np.clip(water(t),0,1)*255)),(0,60))
    ImageDraw.Draw(im).text((8,8),f'CPU reference only / t={t}s',fill='#173c65');images.append(im)
proof=Image.new('RGB',(w*2,h+100));proof.paste(images[0]);proof.paste(images[1],(w,0));proof.save(out/'water-reference.png')
print('Saved calculated water reference; actual browser/shader execution remains unverified.')
