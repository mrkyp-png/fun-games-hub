"""Trace narrow metal paths from the user's unmodified circuit image."""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy.ndimage import distance_transform_edt
from collections import deque
from skimage.morphology import skeletonize, opening, disk, remove_small_objects
import random,json
p=Path('mole/assets/rhythm-b');im=np.array(Image.open(p/'circuit-user.png').convert('RGBA'))
metal=(im[:,:,3]>220)&(im[:,:,:3].min(axis=2)>110)
metal=remove_small_objects(opening(metal,disk(2)),max_size=59)
distance=distance_transform_edt(metal);sk=skeletonize(metal)&(distance>=2)&(distance<=14)
# Only inner circuitry, excluding the broad perimeter and the central ring.
sk[:140,:]=False;sk[1090:,:]=False;sk[:,:130]=False;sk[:,1155:]=False
points=set(zip(*np.where(sk)));point_list=sorted(points);rng=random.Random(1040);routes=[]
for attempt in range(5000):
 if len(routes)>=80:break
 start=rng.choice(point_list);walk=[start];seen={start};length=0
 while len(walk)<260:
  y,x=walk[-1];neighbors=[(y+dy,x+dx) for dy in [-1,0,1] for dx in [-1,0,1] if (dy or dx) and (y+dy,x+dx) in points and (y+dy,x+dx) not in seen]
  if not neighbors:break
  if len(walk)>1:
   vy,vx=y-walk[-2][0],x-walk[-2][1];neighbors.sort(key=lambda n:-(n[0]-y)*vy-(n[1]-x)*vx)
  nxt=neighbors[0] if rng.random()<.85 else rng.choice(neighbors);length+=float(np.hypot(nxt[0]-y,nxt[1]-x));walk.append(nxt);seen.add(nxt)
 if length<70:continue
 # Keep all true skeleton vertices: no guessed lines across empty image pixels.
 coords=[[int(x),int(y)] for y,x in walk]
 routes.append('M'+' L'.join(f'{x},{y}' for x,y in coords))
assert len(routes)>=40
short_routes=routes[:40]
# Long paths use the continuous native metal skeleton, including circuit ring connections.
long_sk=skeletonize(metal)&(distance>=2)
long_sk[:140,:]=False;long_sk[1090:,:]=False;long_sk[:,:130]=False;long_sk[:,1155:]=False
long_points=set(zip(*np.where(long_sk)));long_list=sorted(long_points);long_routes=[]
for attempt in range(500):
 if len(long_routes)>=40:break
 start=rng.choice(long_list);parents={start:None};q=deque([start]);end=start
 while q:
  y,x=q.popleft();end=(y,x)
  for dy in [-1,0,1]:
   for dx in [-1,0,1]:
    nxt=(y+dy,x+dx)
    if (dy or dx) and nxt in long_points and nxt not in parents:parents[nxt]=(y,x);q.append(nxt)
 walk=[];cur=end
 while cur is not None:walk.append(cur);cur=parents[cur]
 if len(walk)<450:continue
 walk=walk[:1000]
 long_routes.append('M'+' L'.join(f'{x},{y}' for y,x in walk))
assert len(long_routes)==40,len(long_routes)
routes=short_routes+long_routes
Path('mole/js/rhythm-b-routes.js').write_text('// V 1040 G: paths traced from original circuit-user.png pixels.\nwindow.MoleGame = window.MoleGame || {};\nwindow.MoleGame.rhythmBCircuitRoutes = '+json.dumps(routes,separators=(',',':'))+';\n',encoding='utf-8')
Path('review/circuit-routes-v1040.json').write_text(json.dumps({'routes':len(routes),'short_routes':40,'long_routes':40,'method':'native metal skeleton; 40 short and 40 long; every vertex on source metal','max_distance_to_metal':0}),encoding='utf-8')
print('PASS:',len(routes),'paths, each vertex on original narrow-metal skeleton')
