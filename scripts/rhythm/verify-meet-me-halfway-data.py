import json,hashlib
from pathlib import Path
import numpy as np
s=json.loads(Path('mole/audio/rp/meet-me-halfway.json').read_text(encoding='utf-8'));old=json.loads(Path('mole/audio/rp/le-monde-attendra-demain.json').read_text(encoding='utf-8'))
source=Path.home()/'Desktop'/'\ucc44\ubcf4'/'Meet Me Halfway.mp3';assert hashlib.sha256(source.read_bytes()).digest()==hashlib.sha256(Path('mole/audio/rp/meet-me-halfway.mp3').read_bytes()).digest()
for d,gap in [('EASY',2.22),('NORMAL',1.88),('HARD',1.65)]:
 events=s['patterns'][d];times=np.array([e['time'] for e in events]);assert (np.diff(times)>0).all();assert times[0]>=1.8 and times[-1]<s['length'];assert max(np.diff(times))<1.1
 last=[-999]*9;notes=0;smallest=999
 for e in events:
  assert len(e['lanes']) in (1,2) and len(set(e['lanes']))==len(e['lanes'])
  if e['sound']!='hat':assert e['time'] in s['beats']
  else:assert min(abs(e['time']-(a+b)/2) for a,b in zip(s['beats'],s['beats'][1:]))<=.035
  for lane in e['lanes']:
   assert 0<=lane<9;delta=e['time']-last[lane];assert delta>=gap-1e-6;smallest=min(smallest,delta);last[lane]=e['time'];notes+=1
 assert notes==len(s['charts'][d]);assert [e['lanes'] for e in events[:40]]!=[e['lanes'] for e in old['patterns'][d][:40]]
 print(d,'notes',notes,'chords',sum(len(e['lanes'])==2 for e in events),'max rest',round(max(np.diff(times)),3),'actual min same lane',round(smallest,4),'first',times[0],'last',times[-1])
print('PASS original preserved/exact audio copy, adaptive beats+onset fills, spacing, no long interior rests, distinct previous-song patterns')
