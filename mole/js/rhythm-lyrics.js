(function(root){
 'use strict';
 function create(screen){
  const bar=document.createElement('div'),text=document.createElement('span');bar.className='rp-lyrics';bar.hidden=true;bar.setAttribute('aria-label','Song lyrics');text.className='rp-lyrics-text';bar.appendChild(text);screen.appendChild(bar);
  const reduced=root.matchMedia('(prefers-reduced-motion: reduce)');let cues=[],cursor=-1,shown=-2,lastTime=-Infinity,animation=null,paused=false;
  function cancel(){if(animation){animation.cancel();animation=null;}}
  function clear(){cancel();cues=[];cursor=-1;shown=-2;lastTime=-Infinity;paused=false;bar.hidden=true;text.textContent='';screen.classList.remove('has-rhythm-lyrics');}
  function set(data){clear();cues=(data&&Array.isArray(data.cues)?data.cues:[]).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start&&typeof c.text==='string').slice().sort((a,b)=>a.start-b.start);screen.classList.toggle('has-rhythm-lyrics',cues.length>0);}
  function update(time){
   if(!cues.length)return;
   if(time<lastTime)cursor=-1;lastTime=time;
   while(cursor+1<cues.length&&cues[cursor+1].start<=time)cursor++;
   const index=cursor>=0&&time<cues[cursor].end?cursor:-1;
   if(index===shown)return;shown=index;cancel();bar.hidden=index<0;
   if(index<0){text.textContent='';return;}
   const cue=cues[index];text.textContent=cue.text;text.style.transform='';
   const overflow=Math.max(0,text.scrollWidth-bar.clientWidth);
   if(overflow>0&&!reduced.matches){animation=text.animate([{transform:'translateX(0)',offset:0},{transform:'translateX(0)',offset:.1},{transform:'translateX(-'+overflow+'px)',offset:.9},{transform:'translateX(-'+overflow+'px)',offset:1}],{duration:(cue.end-cue.start)*1000,fill:'both',easing:'linear'});animation.currentTime=Math.max(0,(time-cue.start)*1000);if(paused)animation.pause();}
  }
  function pause(on){paused=on;if(animation){if(on)animation.pause();else animation.play();}}
  return {set,update,pause,clear};
 }
 root.MoleGame=root.MoleGame||{};root.MoleGame.RhythmLyrics={create};
})(window);
