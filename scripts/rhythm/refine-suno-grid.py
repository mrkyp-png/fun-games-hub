from pathlib import Path
import json,numpy as np
from scipy import signal
p=Path('review/suno-song-analysis.json');r=json.loads(p.read_text(encoding='utf-8'));a=np.load('review/suno-song-features.npz');t=a['t'];on=a['onset'];low=a['low'];best=(-1,None,None)
for bpm in np.arange(120,125,.01):
 period=60/bpm
 for off in np.arange(0,period,.004):
  grid=np.arange(off,t[-1],period);values=np.interp(grid,t,on);score=np.mean(values)
  if score>best[0]:best=(score,bpm,off)
score,bpm,first=best
local=[]
for lo in np.arange(0,120,20):
 period=60/bpm;grid=np.arange(first,t[-1],period);grid=grid[(grid>=lo)&(grid<lo+20)]
 shifts=np.arange(-.1,.101,.002);values=[np.mean(np.interp(grid+s,t,on)) for s in shifts];local.append({'start':float(lo),'phaseShiftMs':round(float(shifts[np.argmax(values)]*1000),1),'gridStrength':round(float(max(values)),3)})
r.update({'bpm':round(float(bpm),3),'firstBeat':round(float(first),3),'gridScore':round(float(score),4),'local20s':local})
p.write_text(json.dumps(r,indent=2),encoding='utf-8');print(json.dumps({k:r[k] for k in ['bpm','firstBeat','gridScore','local20s']}))
