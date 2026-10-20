# V1354 C 후렴 패턴식 채보(사용자 지정: 후렴만 '규칙적·시각적' 도형, 나머지는 기존 방식).
#   python scripts/rhythm/build-pattern-charts.py <원곡.mp3> <id> "<제목>" <후렴시작초-끝초> [...]
# 선행: analyze-song.py → track-song.py (review/<id>-analysis.json). 후렴 구간은 가사 전사 시각 기반 후보(청취 확정 아님).
# B(3x3, 칸 번호 = 행*3+열, 0=왼쪽 위): 후렴 = 가로줄 쓸기·세로줄 쓸기·테두리 회전·가운데 박동.
# A(4버튼): 후렴 = 계단(0→3, 3→0)·양끝/안쪽 짝.
# 같은 칸 최소 간격(B EASY2.242/NORMAL1.898/HARD1.665초, A 0.56초)에 걸리는 도형 박자는 통째로 쉼(도형을 깨지 않음).
from pathlib import Path
import json,itertools,hashlib,argparse
import numpy as np
ap=argparse.ArgumentParser();ap.add_argument('source',type=Path);ap.add_argument('songid');ap.add_argument('title');ap.add_argument('chorus',nargs='+');ap.add_argument('--avoid',default='');a=ap.parse_args()  # --avoid 다른곡id: 그 곡의 같은 후렴·난이도 도형을 되도록 피함(곡끼리 다르게)
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
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from pattern_library import B_MOTIFS,A_MOTIFS
# V1355 C: 후렴마다 패턴 목록에서 곡·난이도·후렴번호로 고정된 무작위 순서로 도형을 골라 이어 붙임(같은 곡 다시 만들면 동일).
# 도형 하나를 통째로 넣을 수 있을 때만(같은 칸 간격·후렴 끝 안) 넣고, 못 넣으면 다른 도형 → 다 안 되면 2박 쉼.
AVOID=json.loads((Path('review')/(a.avoid+'-chart-summary.json')).read_text(encoding='utf-8')) if a.avoid else None
def plan(motifs,diff,gap,last,k0,k1,ci,lanes_n):
 rng=random.Random(f'{a.songid}|{diff}|{ci}|{lanes_n}');pool=[m for m in motifs if diff in m['step']];events=[];used=[];pos=k0;prev=None
 other=set()
 if AVOID:
  ch=AVOID['motifsB' if lanes_n==9 else 'motifsA'].get(diff,[]);other=set(ch[ci]) if ci<len(ch) else set()
  pool=[m for m in pool if m['id'] not in other]+[m for m in pool if m['id'] in other]
 while pos<k1:
  order=pool[:];rng.shuffle(order);order.sort(key=lambda m:m['id'] in other);order=[m for m in order if m['id']!=prev]+[m for m in order if m['id']==prev];order.sort(key=lambda m:(m['id']==prev,used.count(m['id'])))
  placed=False
  # 안 쓴 도형을 0~2박 늦춰서라도 먼저 시도, 안 되면 쓴 도형(바로 앞 도형은 맨 뒤)
  fresh=[m for m in order if m['id'] not in used];tries=[(d,m) for d in (0,1,2) for m in fresh]+[(0,m) for m in order if m['id'] in used]
  for d,m in tries:
   st=m['step'][diff];ks=[pos+d+i*st for i in range(len(m['steps']))]
   if ks[-1]>=k1 or ks[-1]>=len(beats):continue
   sim=last[:];ok=True
   for kk,shp in zip(ks,m['steps']):
    t=beats[kk]
    if any(t-sim[l]<gap+1e-4 for l in shp):ok=False;break
    for l in shp:sim[l]=t
   if not ok:continue
   last[:]=sim;events+=[(kk,shp,m['id']) for kk,shp in zip(ks,m['steps'])];used.append(m['id']);prev=m['id'];pos=ks[-1]+st+(1 if lanes_n==4 else 0);placed=True;break  # A 는 도형 사이 1박 숨
  if not placed:pos+=1 if lanes_n==4 else 2
 return events,used
def sound(k):return 'kick' if k%2==0 else 'snare'
seed=int(hashlib.sha256(a.songid.encode()).hexdigest()[:8],16)
patterns={};stats={};usage={};ausage={}
for diff,gap in [('EASY',2.242),('NORMAL',1.898),('HARD',1.665)]:
 last=[-1e9]*9;notes=[];rests=0
 seq=[0,4,8,7,3,1,5,2,6,0,8,2,6,4][seed%5:][:9];pairs=[(0,8),(2,6),(1,7),(3,5),(0,2),(6,8)]
 chorusMap={};usage[diff]=[]
 for k,b in enumerate(beats):
  if b<2 or b>duration-1.4:continue
  off=in_chorus(k)
  if off is not None:
   if off==0:
    ci=[w[0] for w in cwin].index(k);ev,used=plan(B_MOTIFS,diff,gap,last,k,cwin[ci][1],ci,9);usage[diff].append(used)
    for kk,shp,mid in ev:chorusMap[kk]=(shp,mid)
   if k in chorusMap:
    shp,mid=chorusMap[k];notes.append({'time':round(b,4),'lanes':list(shp),'sound':'kick' if len(shp)>1 else sound(k),'section':'chorus-pattern','motif':mid})
   continue
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
 patterns[diff]=notes;stats[diff]={'events':len(notes),'notes':sum(len(n['lanes']) for n in notes),'chorusEvents':sum(n['section']=='chorus-pattern' for n in notes),'triples':sum(len(n['lanes'])==3 for n in notes),'quads':sum(len(n['lanes'])==4 for n in notes),'pairs':sum(len(n['lanes'])==2 for n in notes),'chorusRests':rests}
meta={'id':a.songid,'title':a.title,'back':f'audio/rp/{a.songid}.mp3','bpm':r['bpm'],'firstBeat':r['firstBeat'],'length':duration,'beats':beats,'hitFeedback':True,'sections':r['blocks'],'chorusPattern':[{'start':beats[k0],'end':beats[k1]} for k0,k1 in cwin],'patterns':patterns,'charts':{d:[e['time'] for e in v for _ in e['lanes']] for d,v in patterns.items()},'chartVersion':1,'analysisNote':'Chorus windows from local lyric transcription timing (candidates, not listening-verified); chorus uses regular geometric patterns, other sections beat-based first pass.'}
(out/f'{a.songid}.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
# A(4버튼)
apats={};astats={}
for diff in ['EASY','NORMAL','HARD']:
 last=[-1e9]*4;outn=[];rests=0;chorusMap={};ausage[diff]=[];sq=[[0,1,3,2],[2,0,1,3],[1,3,0,2],[3,2,0,1]][(seed+len(diff))%4]
 for k,b in enumerate(beats):
  if b<2 or b>duration-1.4:continue
  off=in_chorus(k)
  if off is not None:
   if off==0:
    ci=[w[0] for w in cwin].index(k);ev,used=plan(A_MOTIFS,diff,.56,last,k,cwin[ci][1],ci,4);ausage[diff].append(used)
    for kk,shp,mid in ev:chorusMap[kk]=(shp,mid)
   if k in chorusMap:
    shp,mid=chorusMap[k];outn.append({'time':round(b,4),'lanes':list(shp),'sound':'kick','section':'chorus-pattern','motif':mid})
   continue
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
summary={'source_sha256':hashlib.sha256(a.source.read_bytes()).hexdigest(),'chorusBeats':cwin,'B':stats,'A':astats,'motifsB':usage,'motifsA':ausage}
Path(str(prefix)+'-chart-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8');print(json.dumps(summary))
