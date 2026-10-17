(function(root){
 'use strict';
 function create(screen){
  const bar=document.createElement('div'),pulse=document.createElement('span'),text=document.createElement('span');bar.className='rp-lyrics';bar.hidden=true;bar.setAttribute('aria-label','Song lyrics');text.className='rp-lyrics-text';pulse.className='rp-lyrics-pulse';pulse.appendChild(text);bar.appendChild(pulse);screen.appendChild(bar);
  const reduced=root.matchMedia('(prefers-reduced-motion: reduce)');let cues=[],cursor=-1,shown=-2,lastTime=-Infinity,animation=null,paused=false,beatAnimation=null,beats=null,beatCursor=-1,lastPulse=-Infinity,bpm=120,firstBeat=0;
  const beatFrames=[{transform:'scale(1.12)'},{transform:'scale(1)'}];
  const wordColors=['#fff176','#ff8a80','#80deea','#b39ddb','#a5d6a7','#ffcc80','#f48fb1'];
  function cancel(){if(animation){animation.cancel();animation=null;}}
  function cancelBeat(){if(beatAnimation){beatAnimation.cancel();beatAnimation=null;}}
  function color(value){if(bar.style.getPropertyValue('--rp-lyric-color')!==value)bar.style.setProperty('--rp-lyric-color',value);}
  function clear(preserveLayout){cancel();cancelBeat();beats=null;beatCursor=-1;lastPulse=-Infinity;bar.style.removeProperty('--rp-lyric-color');cues=[];cursor=-1;shown=-2;lastTime=-Infinity;paused=false;bar.hidden=true;text.textContent='';if(!preserveLayout)screen.classList.remove('has-rhythm-lyrics');}
  function set(data,timing){clear();beats=timing&&Array.isArray(timing.beats)?timing.beats:null;bpm=Number(timing&&timing.bpm)||120;firstBeat=Number(timing&&timing.firstBeat)||0;cues=(data&&Array.isArray(data.cues)?data.cues:[]).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start&&typeof c.text==='string').slice().sort((a,b)=>a.start-b.start);screen.classList.toggle('has-rhythm-lyrics',cues.length>0);}
  function update(time){
   if(!cues.length)return;
   if(time<lastTime){cursor=-1;beatCursor=-1;lastPulse=-Infinity;cancelBeat();}lastTime=time;
   while(cursor+1<cues.length&&cues[cursor+1].start<=time)cursor++;
   const index=cursor>=0&&time<cues[cursor].end?cursor:-1;
   if(beats){while(beatCursor+1<beats.length&&beats[beatCursor+1]<=time)beatCursor++;}
   const beat=beats?beatCursor:Math.floor((time-firstBeat)/(60/bpm));
   const at=beats?beats[beatCursor]:firstBeat+beat*60/bpm;
   if(index>=0&&!paused&&!reduced.matches&&beat>=0&&beat!==lastPulse&&time-at>=0&&time-at<.18){cancelBeat();lastPulse=beat;beatAnimation=pulse.animate(beatFrames,{duration:180,easing:'ease-out'});beatAnimation.currentTime=(time-at)*1000;}
   if(index===shown)return;shown=index;cancel();bar.hidden=index<0;
   if(index<0){cancelBeat();text.textContent='';return;}
   const cue=cues[index];text.replaceChildren();text.style.transform='';
   let word=0;
   cue.text.split(/(\s+)/).forEach(part=>{
    if(!part)return;
    if(/^\s+$/.test(part)){text.appendChild(document.createTextNode(part));return;}
    const span=document.createElement('span');span.textContent=part;span.style.color=wordColors[word++%wordColors.length];text.appendChild(span);
   });
   const overflow=Math.max(0,text.scrollWidth-pulse.clientWidth);
   if(overflow>0&&!reduced.matches){animation=text.animate([{transform:'translateX(0)',offset:0},{transform:'translateX(0)',offset:.1},{transform:'translateX(-'+overflow+'px)',offset:.9},{transform:'translateX(-'+overflow+'px)',offset:1}],{duration:(cue.end-cue.start)*1000,fill:'both',easing:'linear'});animation.currentTime=Math.max(0,(time-cue.start)*1000);if(paused)animation.pause();}
  }
  function pause(on){paused=on;for(const a of [animation,beatAnimation])if(a&&a.playState!=='finished'&&a.playState!=='idle'){if(on)a.pause();else a.play();}}
  return {set,update,pause,clear,color};
 }
 root.MoleGame=root.MoleGame||{};root.MoleGame.RhythmLyrics={create};
})(window);
