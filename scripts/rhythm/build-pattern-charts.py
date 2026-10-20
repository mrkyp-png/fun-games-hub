# V1354 C 후렴 패턴식 채보(사용자 지정: 후렴만 '규칙적·시각적' 도형, 나머지는 기존 방식).
#   python scripts/rhythm/build-pattern-charts.py <원곡.mp3> <id> "<제목>" <후렴시작초-끝초> [...]
# 선행: analyze-song.py → track-song.py (review/<id>-analysis.json). 후렴 구간은 가사 전사 시각 기반 후보(청취 확정 아님).
# B(3x3, 칸 번호 = 행*3+열, 0=왼쪽 위): 후렴 = 가로줄 쓸기·세로줄 쓸기·테두리 회전·가운데 박동.
# A(4버튼): 후렴 = 계단(0→3, 3→0)·양끝/안쪽 짝.
# 같은 칸 최소 간격(B EASY2.242/NORMAL1.898/HARD1.665초, A 0.56초)에 걸리는 도형 박자는 통째로 쉼(도형을 깨지 않음).
from pathlib import Path
import json,itertools,hashlib,argparse
import numpy as np
ap=argparse.ArgumentParser();ap.add_argument('source',type=Path);ap.add_argument('songid');ap.add_argument('title');ap.add_argument('chorus',nargs='+');a=ap.parse_args()
prefix=Path('review')/a.songid;out=Path('mole/audio/rp')
r=json.loads(Path(str(prefix)+'-analysis.json').read_text(encoding='utf-8'));beats=r['beats'];duration=r['duration']
chorus=[tuple(float(x) for x in c.split('-')) for c in a.chorus]
# 후렴 시작을 가장 가까운 박으로, 4박(마디) 단위로 맞춤
def snap(t):return int(np.argmin([abs(b-t) for b in beats]))
cwin=[]
for s,e in chorus:
 k0=snap(s);k1=snap(e);cwin.append((k0,k1))
def in_chorus(k):
 for k0,k1 in cwin:
  if k0<=k<k1:return k-k0
 return None
def kind(k):
 if k<16:return 'intro'
 return next((b['kind'] for b in r['blocks'] if b['startBeat']<=k<b['startBeat']+16),'outro')
R=[(0,1,2),(3,4,5),(6,7,8)];C=[(0,3,6),(1,4,7),(2,5,8)];EDGE=[0,1,2,5,8,7,6,3]
# 후렴 도형표: 박 오프셋(마디 기준) → 칸들. 16박 단위 두 구절(A·B)을 번갈아.
def b_shape(diff,off):
 ph=(off//16)%2;o=off%16
 if diff=='EASY':
  if o%2:return None
  seq=[(0,2),(3,5),(6,8),(4,),None,(0,6),(1,7),(2,8)] if ph==0 else [(0,8),(2,6),(4,),None,(1,7),(3,5),(4,),None]
  return seq[o//2]
 if diff=='NORMAL':
  if o%2:return None
  seq=[None,R[0],R[1],R[2],None,R[0],R[1],R[2]] if ph==0 else [None,C[0],C[1],C[2],None,C[0],C[1],C[2]]
  return seq[o//2]
 # HARD: 구절A = 테두리 시계방향 한 칸씩 + 마디마다 가운데, 구절B = 가로줄 쓸기(2박) + 사이 가운데열
 if ph==0:
  lanes=[EDGE[o%8]]+([4] if o%4==0 else [])
  return tuple(lanes)
 seq={0:R[0],2:R[1],4:R[2],8:R[0],10:R[1],12:R[2]}
 return seq.get(o)
def a_shape(diff,off):
 ph=(off//16)%2;o=off%16
 if diff=='EASY':
  if o%2:return None
  return [(0,),(1,),(2,),(3,),(3,),(2,),(1,),(0,)][o//2] if ph==0 else [(0,3),None,(1,2),None,(0,3),None,(1,2),None][o//2]
 if diff=='NORMAL':
  return [(0,),(1,),(2,),(3,),(2,),(1,),(0,),None][o%8] if ph==0 else ([(0,3),(1,2)][(o//2)%2] if o%2==0 else None)
 if ph==0:return [(0,),(1,),(2,),(3,),(2,),(1,),(0,),(1,)][o%8]
 return [(0,3),(1,2)][o%2]  # 양끝·안쪽 짝 매박 번갈아(같은 버튼 2박=0.86초 간격)
def sound(k):return 'kick' if k%2==0 else 'snare'
seed=int(hashlib.sha256(a.songid.encode()).hexdigest()[:8],16)
patterns={};stats={}
for diff,gap in [('EASY',2.242),('NORMAL',1.898),('HARD',1.665)]:
 last=[-1e9]*9;notes=[];rests=0
 seq=[0,4,8,7,3,1,5,2,6,0,8,2,6,4][seed%5:][:9];pairs=[(0,8),(2,6),(1,7),(3,5),(0,2),(6,8)]
 for k,b in enumerate(beats):
  if b<2 or b>duration-1.4:continue
  off=in_chorus(k)
  if off is not None:
   shp=b_shape(diff,off)
   if not shp:continue
   if any(b-last[l]<gap+1e-4 for l in shp):rests+=1;continue
   for l in shp:last[l]=b
   notes.append({'time':round(b,4),'lanes':list(shp),'sound':'kick' if len(shp)>1 else sound(k),'section':'chorus-pattern'});continue
  # 후렴 밖: 기존 B 방식(정박, 강한 구간 2버튼)
  if diff=='EASY' and k%2:continue
  drive=kind(k)=='drive';count=2 if drive and (k%4==0 if diff!='HARD' else k%4 in (0,2)) else 1
  free=[i for i in range(9) if b-last[i]>=gap+1e-4]
  if len(free)<count:continue
  if count==2:
   pref=pairs[(k//4)%len(pairs)];lanes=list(min(itertools.combinations(free,2),key=lambda p:(sum(x not in p for x in pref),max(last[x] for x in p))))
  else:
   pref=seq[k%len(seq)];lanes=[min(free,key=lambda i:(i!=pref,abs(i//3-pref//3)+abs(i%3-pref%3),last[i]))]
  for l in lanes:last[l]=b
  notes.append({'time':round(b,4),'lanes':lanes,'sound':sound(k),'section':kind(k)})
 patterns[diff]=notes;stats[diff]={'events':len(notes),'notes':sum(len(n['lanes']) for n in notes),'chorusEvents':sum(n['section']=='chorus-pattern' for n in notes),'triples':sum(len(n['lanes'])==3 for n in notes),'pairs':sum(len(n['lanes'])==2 for n in notes),'chorusRests':rests}
meta={'id':a.songid,'title':a.title,'back':f'audio/rp/{a.songid}.mp3','bpm':r['bpm'],'firstBeat':r['firstBeat'],'length':duration,'beats':beats,'hitFeedback':True,'sections':r['blocks'],'chorusPattern':[{'start':beats[k0],'end':beats[k1]} for k0,k1 in cwin],'patterns':patterns,'charts':{d:[e['time'] for e in v for _ in e['lanes']] for d,v in patterns.items()},'chartVersion':1,'analysisNote':'Chorus windows from local lyric transcription timing (candidates, not listening-verified); chorus uses regular geometric patterns, other sections beat-based first pass.'}
(out/f'{a.songid}.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
# A(4버튼)
apats={};astats={}
for diff in ['EASY','NORMAL','HARD']:
 last=[-1e9]*4;outn=[];rests=0;sq=[[0,1,3,2],[2,0,1,3],[1,3,0,2],[3,2,0,1]][(seed+len(diff))%4]
 for k,b in enumerate(beats):
  if b<2 or b>duration-1.4:continue
  off=in_chorus(k)
  if off is not None:
   shp=a_shape(diff,off)
   if not shp:continue
   if any(b-last[l]<.56+1e-4 for l in shp):rests+=1;continue
   for l in shp:last[l]=b
   outn.append({'time':round(b,4),'lanes':list(shp),'sound':'kick','section':'chorus-pattern'});continue
  if diff=='EASY' and k%2:continue
  if diff=='NORMAL' and k%2 and kind(k)!='drive':continue
  free=[i for i in range(4) if b-last[i]>=.56+1e-4]
  if not free:continue
  pref=sq[k%4];lane=min(free,key=lambda i:(i!=pref,last[i]))
  last[lane]=b;outn.append({'time':round(b,4),'lanes':[lane],'sound':sound(k),'section':kind(k)})
 apats[diff]=outn;astats[diff]={'events':len(outn),'notes':sum(len(e['lanes']) for e in outn),'chorusEvents':sum(e['section']=='chorus-pattern' for e in outn),'pairs':sum(len(e['lanes'])==2 for e in outn),'chorusRests':rests}
am={k:meta[k] for k in ['id','title','back','bpm','firstBeat','length','beats','sections','chorusPattern']};am.update({'type':'A','aPatterns':apats,'charts':{d:[e['time'] for e in v for _ in e['lanes']] for d,v in apats.items()},'hitFeedback':True,'chartVersion':1,'analysisNote':'A four-lane: chorus staircase/pair patterns, other sections beat-based; >=560ms same-lane spacing.'})
(out/f'{a.songid}-a.json').write_text(json.dumps(am,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
target=out/f'{a.songid}.mp3'
if target.exists():assert target.read_bytes()==a.source.read_bytes(),'Refuse to replace a different existing song'
else:target.write_bytes(a.source.read_bytes())
summary={'source_sha256':hashlib.sha256(a.source.read_bytes()).hexdigest(),'chorusBeats':cwin,'B':stats,'A':astats}
Path(str(prefix)+'-chart-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8');print(json.dumps(summary))
