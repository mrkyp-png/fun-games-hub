from pathlib import Path
import json,itertools,hashlib,argparse
import numpy as np
parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);parser.add_argument('songid');parser.add_argument('title');args=parser.parse_args();source=args.source;songid=args.songid
prefix=Path('review')/songid
r=json.loads(Path(str(prefix)+'-analysis.json').read_text(encoding='utf-8'));features=np.load(str(prefix)+'-features.npz');beats=r['beats'];duration=r['duration'];out=Path('mole/audio/rp')
style=0 if songid=='paper-engine-ride' else 1

patterns={};statistics={}
def kind(k):
 if k<16:return 'intro'
 return next((b['kind'] for b in r['blocks'] if b['startBeat']<=k<b['startBeat']+16),'outro')
def sound(k):return 'kick' if k%2==0 else 'snare'
for diff,gap in [('EASY',2.242),('NORMAL',1.898),('HARD',1.665)]:
 events=[]
 for k,b in enumerate(beats):
  if b<2 or b>duration-1.4:continue
  drive=kind(k)=='drive';intro=kind(k)=='intro'
  if diff=='EASY' and k%2:continue
  chord=drive and ((k%4==0) if diff=='EASY' else (k%4 in ((0,2) if style==0 else (0,3)) if diff=='NORMAL' else k%4 in ((0,1) if style==0 else (0,2))))
  events.append({'time':b,'count':2 if chord else 1,'sound':sound(k),'section':kind(k),'beat':k,'optional':False})
  if diff=='HARD' and drive and k%4==(1 if style==0 else 2) and k+1<len(beats):
   mid=(b+beats[k+1])/2;ids=np.flatnonzero(abs(features['t']-mid)<.035)
   if len(ids):
    strengths=features['high'][ids]+features['mid'][ids]*.3;j=ids[np.argmax(strengths)]
    if max(strengths)>.25:events.append({'time':round(float(features['t'][j]),4),'count':1,'sound':'hat','section':'drive-fill','beat':k+.5,'optional':True})
 events.sort(key=lambda e:e['time']);last=[-1e9]*9;notes=[];sequence=([0,4,8,7,3,1,5,2,6] if style==0 else [6,2,4,0,7,5,1,8,3]);sequence=sequence[(0 if diff=='EASY' else 2 if diff=='NORMAL' else 4):]+sequence[:(0 if diff=='EASY' else 2 if diff=='NORMAL' else 4)];pairseq=([(0,4),(4,8),(1,7),(2,6),(0,5),(3,8),(2,7),(1,6)] if style==0 else [(0,8),(2,6),(1,5),(3,7),(0,2),(6,8),(1,7),(3,5)])
 for index,e in enumerate(events):
  free=[i for i in range(9) if e['time']-last[i]>=gap+1e-4]
  if len(free)<e['count']:
   if e['optional']:continue
   raise AssertionError((diff,index,e,free))
  if e['count']==2:
   choices=list(itertools.combinations(free,2));preferred=pairseq[(e['beat']//2)%len(pairseq)]
   def pairscore(pair):
    return (sum(x not in pair for x in preferred)*3+(5 if pair[0]%3==pair[1]%3 else 0)+abs(pair[0]//3-pair[1]//3)*.3+max(last[x] for x in pair)*.001)
   lanes=list(min(choices,key=pairscore))
  else:
   preferred=sequence[int(e['beat'])%len(sequence)];lanes=[min(free,key=lambda i:(0 if i==preferred else 2)+abs(i//3-preferred//3)*.4+abs(i%3-preferred%3)*.3+last[i]*.00001)]
  for lane in lanes:last[lane]=e['time']
  notes.append({'time':round(e['time'],4),'lanes':lanes,'sound':e['sound'],'section':e['section']})
 patterns[diff]=notes;statistics[diff]={'events':len(notes),'notes':sum(len(n['lanes']) for n in notes),'chords':sum(len(n['lanes'])==2 for n in notes),'minLaneGap':gap}
meta={'id':songid,'title':args.title,'back':f'audio/rp/{songid}.mp3','bpm':r['bpm'],'firstBeat':r['firstBeat'],'length':duration,'beats':beats,'hitFeedback':True,'sections':r['blocks'],'patterns':patterns,'charts':{d:[e['time'] for e in v for _ in e['lanes']] for d,v in patterns.items()},'chartVersion':1,'analysisNote':'First-pass chart from band-onset adaptive beat tracking; energy drive regions are candidates, not verified lyrical chorus labels.'}
(out/f'{songid}.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
target=out/f'{songid}.mp3'
if target.exists():assert target.read_bytes()==source.read_bytes(),'Refuse to replace a different existing song'
else:target.write_bytes(source.read_bytes())
Path(str(prefix)+'-chart-summary.json').write_text(json.dumps({'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'duration':duration,'statistics':statistics,'audio_bytes':target.stat().st_size},indent=2),encoding='utf-8')
print(json.dumps(statistics));print('audio bytes',target.stat().st_size)
