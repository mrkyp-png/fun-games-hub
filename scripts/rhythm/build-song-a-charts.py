from pathlib import Path
import json,hashlib,itertools
ids=['le-monde-attendra-demain','meet-me-halfway','paper-engine-ride','the-world-is-wide']
for sid in ids:
 src=Path('mole/audio/rp')/(sid+'.json');s=json.loads(src.read_text(encoding='utf-8-sig'));seed=int(hashlib.sha256(sid.encode()).hexdigest()[:8],16);patterns={};summary={}
 for di,d in enumerate(['EASY','NORMAL','HARD']):
  last=[-999.]*4;out=[];sequence=[[0,1,3,2],[2,0,1,3],[1,3,0,2],[3,2,0,1]][(seed+di)%4];pairs=[(0,3),(1,2),(0,2),(1,3),(0,1),(2,3)]
  for k,e in enumerate(s['patterns'][d]):
   free=[i for i in range(4) if e['time']-last[i]>=.56+1e-4];count=len(e['lanes'])
   if not free:
    assert e['sound']=='hat','Primary beat exceeds A capacity'
    continue
   count=min(count,len(free))
   if count==2:
    pref=pairs[(k+seed)%len(pairs)];lanes=list(min(itertools.combinations(free,2),key=lambda p:(sum(x not in p for x in pref),max(last[x] for x in p))))
   else:
    pref=sequence[k%4];lanes=[min(free,key=lambda i:(i!=pref,last[i],abs(i-pref)))]
   for l in lanes:last[l]=e['time']
   out.append({**e,'lanes':lanes})
  patterns[d]=out;summary[d]={'events':len(out),'notes':sum(len(e['lanes']) for e in out),'chords':sum(len(e['lanes'])==2 for e in out)}
 meta={k:s[k] for k in ['id','title','back','bpm','firstBeat','length','beats','sections']};meta.update({'type':'A','aPatterns':patterns,'charts':{d:[e['time'] for e in v for _ in e['lanes']] for d,v in patterns.items()},'hitFeedback':True,'chartVersion':1,'analysisNote':'A four-lane arrangement of source beat events; fixed lanes with >=560ms jump spacing; original A collision and 210ms apex compensation retained.'})
 (src.parent/(sid+'-a.json')).write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':')),encoding='utf-8');print(sid,json.dumps(summary))
