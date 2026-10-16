from pathlib import Path
import numpy as np,json,sys
from scipy import signal,ndimage
prefix=Path('review')/sys.argv[1]
r=json.loads(Path(str(prefix)+'-analysis.json').read_text(encoding='utf-8'));a=np.load(str(prefix)+'-features.npz');t=a['t'];on=.6*a['low']+.25*a['mid']+.15*a['high'];fps=1/np.median(np.diff(t));period=60/r['bpm']*fps
smooth=ndimage.gaussian_filter1d(on,.8);reward=smooth/(np.percentile(smooth,90)+1e-9);score=np.zeros(len(t));prev=np.full(len(t),-1,int)
lags=np.arange(int(period*.72),int(period*1.32)+1);penalty=18*np.log(lags/period)**2
for i in range(len(t)):
 valid=lags<=i
 if valid.any():
  candidates=score[i-lags[valid]]-penalty[valid];k=np.argmax(candidates)
  if candidates[k]>0:score[i]=candidates[k];prev[i]=i-lags[valid][k]
 score[i]+=reward[i]
end=np.arange(max(0,len(t)-int(1.5*fps)),len(t));i=int(end[np.argmax(score[end])]);path=[]
while i>=0:path.append(i);i=prev[i]
path=path[::-1];beats=t[path]
# Move each beat only to the strongest nearby onset (at most 23 ms); never shift by a subdivision.
for k,b in enumerate(beats):
 ids=np.flatnonzero(np.abs(t-b)<=.023)
 if len(ids):beats[k]=t[ids[np.argmax(on[ids])]]
periods=np.diff(beats);print('adaptive beats',len(beats),'median BPM',60/np.median(periods),'range period',np.quantile(periods,[.05,.5,.95]))
blocks=[]
for k in range(0,len(beats)-15,16):
 lo,hi=beats[k],beats[k+16] if k+16<len(beats) else t[-1];ids=(t>=lo)&(t<hi)
 value=float(np.mean(a['low'][ids])*.5+np.mean(a['mid'][ids])*.2+np.mean(a['high'][ids])*.3)
 blocks.append({'startBeat':k,'start':round(float(lo),3),'end':round(float(hi),3),'energy':round(value,4)})
thr=np.quantile([b['energy'] for b in blocks],.6)
for b in blocks:b['kind']='drive' if b['energy']>=thr else 'groove'
r.update({'beatMethod':'dynamic-programming band onset alignment with tempo continuity, local max <=23ms; structure labels are energy-based candidates, not verified lyrical choruses','bpm':round(float(60/np.median(periods)),3),'firstBeat':round(float(beats[0]),3),'beats':[round(float(b),4) for b in beats],'blocks':blocks})
Path(str(prefix)+'-analysis.json').write_text(json.dumps(r,indent=2),encoding='utf-8');print(json.dumps(blocks))
