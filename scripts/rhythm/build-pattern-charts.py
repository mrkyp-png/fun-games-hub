# V1354 C 후렴 패턴식 채보(사용자 지정: 후렴만 '규칙적·시각적' 도형, 나머지는 기존 방식).
#   python scripts/rhythm/build-pattern-charts.py <원곡.mp3> <id> "<제목>" <후렴시작초-끝초> [...]
# 선행: analyze-song.py → track-song.py (review/<id>-analysis.json). 후렴 구간은 가사 전사 시각 기반 후보(청취 확정 아님).
# B(3x3, 칸 번호 = 행*3+열, 0=왼쪽 위): 후렴 = 가로줄 쓸기·세로줄 쓸기·테두리 회전·가운데 박동.
# A(4버튼): 후렴 = 계단(0→3, 3→0)·양끝/안쪽 짝.
# 같은 칸 최소 간격(B EASY2.242/NORMAL1.898/HARD1.665초, A 0.56초)에 걸리는 도형 박자는 통째로 쉼(도형을 깨지 않음).
from pathlib import Path
import json,itertools,hashlib,argparse
import numpy as np
ap=argparse.ArgumentParser();ap.add_argument('source',type=Path);ap.add_argument('songid');ap.add_argument('title');ap.add_argument('chorus',nargs='+');ap.add_argument('--avoid',default='');ap.add_argument('--favor',default='');a=ap.parse_args()  # --avoid 다른곡id: 그 곡의 같은 후렴·난이도 도형을 되도록 피함(곡끼리 다르게)
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
FAVOR=set(x for x in a.favor.split(',') if x)  # 6) 곡 성격: 주로 쓸 도형 무리(pattern_library GROUP)
# 5) 가사: 후렴 안 가사 줄 시작 박 = 도형 시작 후보, 같은 가사 줄은 같은 도형·변형·리듬으로(외우는 재미)
LYR=json.loads(Path(out,a.songid+'-lyrics.json').read_text(encoding='utf-8'))['cues'] if Path(out,a.songid+'-lyrics.json').exists() else []
def btime(x):
 i=int(np.floor(x));f=x-i
 return beats[i] if f<1e-9 else beats[i]+(beats[i+1]-beats[i])*f
# 1) 변형: 네온 회전·뒤집기, 비치 좌우 뒤집기
def tf_lane(l,t,n):
 if n==4:return 3-l if t=='M' else l
 r,c=divmod(l,3)
 if t in('R90','R180','R270'):
  for _ in range({'R90':1,'R180':2,'R270':3}[t]):r,c=c,2-r
 if t=='MH':c=2-c
 if t=='MV':r=2-r
 return r*3+c
TFS={9:['I','R90','R180','R270','MH','MV'],4:['I','M']}
MIRROR={9:{'I':'MH','MH':'I','MV':'R180','R180':'MV','R90':'R270','R270':'R90'},4:{'I':'M','M':'I'}}
# 2) 리듬: even 정박 / sync 마지막 한 박 당김(쉼 뒤) / rush 반 박 몰아치기(HARD 한 칸 도형) / stretch 끝나고 한 박 더 쉼
def offsets(m,diff,rh):
 st=m['step'][diff];n=len(m['steps']);o=[i*st for i in range(n)]
 if rh=='sync':o[-1]+=st
 if rh=='rush':o=[i*.5 for i in range(n)]
 if rh=='half':o=[i*st*2 for i in range(n)]
 if rh=='tight':o=list(range(n))  # 2박 도형을 매 박으로(칸이 안 겹치는 도형만 통과)
 return o,(st*2 if rh=='stretch' else st)
SPEED={'rush':2,'tight':2,'even':1,'sync':1,'half':0,'stretch':0}  # 템포 등급(사용자: 템포 차이)
def rhythms(m,diff):
 r=['even','half']+(['sync'] if len(m['steps'])>=3 else [])
 if diff!='EASY' and m['step'][diff]==1 and all(len(x)==1 for x in m['steps']):r.append('rush')
 if diff!='EASY' and m['step'][diff]==2:r.append('tight')
 return r
def plan(motifs,diff,gap,last,k0,k1,ci,lanes_n):
 rng=random.Random(f'{a.songid}|{diff}|{ci}|{lanes_n}');pool=[m for m in motifs if diff in m['step']];events=[];used=[];pos=k0;prev=None;pending=None;prevHands=1;prevSpeed=1
 other=set()
 if AVOID:
  ch=AVOID['motifsB' if lanes_n==9 else 'motifsA'].get(diff,[]);other=set(x.split('/')[0] for x in (ch[ci] if ci<len(ch) else []))
 anchors={}
 for c in LYR:
  if beats[k0]-.05<=c['start']<beats[min(k1,len(beats)-1)]:
   kb=int(np.argmin([abs(b-c['start']) for b in beats]));anchors[kb]=' '.join(c['text'].lower().split())
 big=lambda m:max(len(x) for x in m['steps'])>=(2 if diff=='EASY' else 3)
 small=lambda m:max(len(x) for x in m['steps'])<=(1 if diff!='EASY' else 2)
 while pos<k1-.01:
  frac=(pos-k0)/max(1,k1-k0);remain=k1-pos;cands=[]
  for m in pool:
   for t in TFS[lanes_n]:
    for rh in rhythms(m,diff):
     for d in (0,1,2,3):
      start=pos+d;sc=rng.random()
      if m['id'] in FAVOR or m.get('group') in FAVOR:sc+=2.5          # 6) 곡 성격
      if m['id'] in other:sc-=3                                       # 다른 곡과 겹침 회피
      sc-=1.5*used.count(m['id'])+(4 if m['id']==prev else 0)         # 반복 줄이기
      if frac<.2 and small(m):sc+=1.5                                  # 3) 기: 작은 도형
      mx=max(len(x) for x in m['steps'])
      if frac>=.2:sc+=.9*(mx-1)                                        # 사용자: 여러 버튼 동시 = 박진감
      if SPEED[rh]!=prevSpeed:sc+=1.0                                  # 사용자: 템포 차이(느림·보통·빠름 번갈아)
      if rh=='half':sc-=(2.5 if prevSpeed==0 or frac>.7 else .8)        # 느린 구간은 잠깐만(연속·후렴 끝 금지)
      if rh in('rush','tight'):sc+=.8
      sc+=.25*sum(len(x) for x in m['steps'])/max(1,offsets(m,diff,rh)[0][-1]+offsets(m,diff,rh)[1])  # 밀도(박당 누름 수)
      if remain<=10 and big(m):sc+=2.5                                 # 3) 결: 큰 도형으로 마무리
      if abs((start-k0)%4)<1e-9:sc+=1.2                               # 2) 마디 첫 박 시작
      sc-=d*.6
      key=int(round(start))
      if key in anchors and abs(start-key)<1e-9:
       sc+=1.5;mem=MEMO.get((diff,lanes_n,anchors[key]))
       if mem and mem==(m['id'],t,rh):sc+=8                           # 5) 같은 가사 줄 = 같은 도형
      if pending and (m['id'],t)==pending:sc+=6                        # 4) 주고받기(거울)
      if m.get('hands')==2 and prevHands==2:sc-=3                      # 사용자: 줄 3개는 한 손 — 두 손 도형(대각·모서리·마주보기) 연달아 피함
      cands.append((sc,m,t,rh,start))
  cands.sort(key=lambda c:-c[0]);placed=False
  for sc,m,t,rh,start in cands:
   offs,tail=offsets(m,diff,rh);xs=[start+o for o in offs]
   if xs[-1]>=k1-.01 or xs[-1]>=len(beats)-1:continue
   sim=last[:];ok=True;steps=[tuple(tf_lane(l,t,lanes_n) for l in shp) for shp in m['steps']]
   for x,shp in zip(xs,steps):
    tt=btime(x)
    if any(tt-sim[l]<gap+1e-4 for l in shp):ok=False;break
    for l in shp:sim[l]=tt
   if not ok:continue
   last[:]=sim;tag=f"{m['id']}/{t}/{rh}";events+=[(x,shp,tag) for x,shp in zip(xs,steps)];used.append(m['id'])
   key=int(round(start))
   if key in anchors and abs(start-key)<1e-9:MEMO.setdefault((diff,lanes_n,anchors[key]),(m['id'],t,rh))
   pending=None if pending else ((m['id'],MIRROR[lanes_n][t]) if rng.random()<.5 else None)
   prev=m['id'];prevHands=m.get('hands',1);prevSpeed=SPEED[rh];pos=xs[-1]+tail+(1 if lanes_n==4 else 0);placed=True;break
  if not placed:pos+=1
 # 3) 마침: 후렴 마지막 박에 가운데(네온 5번) / 안쪽 짝(비치 2·3) 한 번
 endk=k1-1;fin=(4,) if lanes_n==9 else (1,2)
 if endk>k0 and not any(abs(x-endk)<1.01 for x,_,_ in events) and all(btime(endk)-last[l]>=gap+1e-4 for l in fin):
  for l in fin:last[l]=btime(endk)
  events.append((endk,fin,'finish'));used.append('finish')
 events.sort(key=lambda e:e[0])
 tags=[];[tags.append(e[2]) for e in events if not tags or tags[-1]!=e[2]]
 return events,tags
MEMO={}
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
    for x,shp,mid in ev:notes.append({'time':round(btime(x),4),'lanes':list(shp),'sound':'kick' if len(shp)>1 else ('hat' if x%1 else sound(int(x))),'section':'chorus-pattern','motif':mid})
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
    for x,shp,mid in ev:outn.append({'time':round(btime(x),4),'lanes':list(shp),'sound':'kick' if len(shp)>1 else ('hat' if x%1 else 'snare'),'section':'chorus-pattern','motif':mid})
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
