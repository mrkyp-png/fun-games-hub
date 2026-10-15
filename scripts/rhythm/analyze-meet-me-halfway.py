from pathlib import Path
import sys,json,hashlib
import numpy as np
from scipy import signal
sys.path.insert(0,str(Path(__file__).resolve().parent))
from beat import load
source=Path.home()/'Desktop'/'\ucc44\ubcf4'/'Meet Me Halfway.mp3'
x,sr=load(str(source));assert len(x)>sr,'Audio decode failed';hop=256;nfft=1024
f,t,z=signal.stft(x,fs=sr,window='hann',nperseg=nfft,noverlap=nfft-hop,boundary=None,padded=False)
a=np.abs(z);norm=np.maximum(np.median(a,axis=1,keepdims=True),1e-5)
log=np.log1p(a/norm)
def novelty(lo,hi):
 y=np.maximum(0,np.diff(log[(f>=lo)&(f<hi)],axis=1)).mean(axis=0);y=np.r_[0,y];y=np.maximum(0,y-signal.medfilt(y,17));return y/(np.percentile(y,99)+1e-9)
low=novelty(40,190);mid=novelty(190,2200);high=novelty(2200,9000);onset=.55*low+.3*mid+.15*high
fps=sr/hop
ac=signal.correlate(onset,onset,mode='full',method='fft')[len(onset)-1:];ac/=np.maximum(np.arange(len(ac),0,-1),1)
bpms=np.arange(75,190,.02);scores=np.array([sum(np.interp(60*fps/b*k,np.arange(len(ac)),ac)/k for k in [1,2,4,8]) for b in bpms]);peaks,_=signal.find_peaks(scores,distance=100);rank=sorted(peaks,key=lambda i:scores[i],reverse=True)[:10]
bpm=float(bpms[np.argmax(scores)]);period=60/bpm
offsets=np.arange(0,period,.001);phaseScores=[np.mean(np.interp(np.arange(o,t[-1],period),t,onset)) for o in offsets];first=float(offsets[np.argmax(phaseScores)])
# Refine period/phase jointly across the full song; retain evidence and local timing candidates.
beats=np.arange(first,t[-1],period)
windows=[]
for start in np.arange(0,len(x)/sr,8):
 ids=(t>=start)&(t<start+8);samples=x[int(start*sr):int(min(start+8,len(x)/sr)*sr)]
 windows.append({'start':round(float(start),2),'rms':round(float(np.sqrt(np.mean(samples*samples))),4),'low':round(float(np.mean(low[ids])),3),'mid':round(float(np.mean(mid[ids])),3),'high':round(float(np.mean(high[ids])),3)})
result={'source':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'duration':round(len(x)/sr,3),'bpm':round(bpm,3),'firstBeat':first,'candidates':[{'bpm':round(float(bpms[i]),2),'score':round(float(scores[i]),5)} for i in rank],'windows8s':windows,'method':'spectral-band positive novelty, FFT autocorrelation, full-song phase grid; inferred musical sections require listening/play verification'}
Path('review/meet-me-halfway-analysis.json').write_text(json.dumps(result,indent=2),encoding='utf-8');np.savez_compressed('review/meet-me-halfway-features.npz',t=t,onset=onset,low=low,mid=mid,high=high)
print(json.dumps(result,ensure_ascii=False))
