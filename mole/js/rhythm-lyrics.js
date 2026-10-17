(function(root){
 'use strict';
 function create(screen){
  const bar=document.createElement('div'),pulse=document.createElement('span'),text=document.createElement('span');bar.className='rp-lyrics';bar.hidden=true;bar.setAttribute('aria-label','Song lyrics');text.className='rp-lyrics-text';pulse.className='rp-lyrics-pulse';pulse.appendChild(text);bar.appendChild(pulse);screen.appendChild(bar);
  const reduced=root.matchMedia('(prefers-reduced-motion: reduce)');let cues=[],cursor=-1,shown=-2,lastTime=-Infinity,animation=null,paused=false,beatAnimation=null,beats=null,beatCursor=-1,lastPulse=-Infinity,bpm=120,firstBeat=0;
  const beatFrames=[{transform:'scale(1.12)'},{transform:'scale(1)'}];
  const wordColors=['#ff1744','#2979ff','#ffea00','#00e676','#ff9100','#f500ff','#00e5ff'];
  const vowels=/[aeiouy]/i;
  let accentSyllables=[],activeAccent=-1;
  function splitSyllables(word){
   const chars=Array.from(word),nuclei=[];let start=-1,scanEnd=chars.length;
   if(chars.length>2&&/[e]/i.test(chars[chars.length-1])&&!/le$/i.test(word))scanEnd--;
   for(let i=0;i<=scanEnd;i++){const vowel=i<scanEnd&&vowels.test(chars[i]);if(vowel&&start<0)start=i;else if(!vowel&&start>=0){nuclei.push([start,i]);start=-1;}}
   if(nuclei.length<2)return [word];
   const chunks=[];let from=0;
   for(let i=0;i<nuclei.length-1;i++){const gap=nuclei[i+1][0]-nuclei[i][1],boundary=nuclei[i][1]+Math.floor(gap/2);chunks.push(chars.slice(from,boundary).join(''));from=boundary;}
   chunks.push(chars.slice(from).join(''));return chunks.filter(Boolean);
  }
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
   if(index!==shown){shown=index;cancel();bar.hidden=index<0;accentSyllables=[];activeAccent=-1;
    if(index<0){cancelBeat();text.textContent='';return;}
    const cue=cues[index];text.replaceChildren();text.style.transform='';let word=0;
    cue.text.split(/(\s+)/).forEach(part=>{
     if(!part)return;
     if(/^\s+$/.test(part)){text.appendChild(document.createTextNode(part));return;}
     const span=document.createElement('span');span.className='rp-lyric-word';span.style.color=wordColors[word++%wordColors.length];
     splitSyllables(part).forEach(syllable=>{const piece=document.createElement('span');piece.className='rp-lyric-syllable';piece.textContent=syllable;span.appendChild(piece);accentSyllables.push(piece);});text.appendChild(span);
    });
    const overflow=Math.max(0,text.scrollWidth-pulse.clientWidth);
    if(overflow>0&&!reduced.matches){animation=text.animate([{transform:'translateX(0)',offset:0},{transform:'translateX(0)',offset:.1},{transform:'translateX(-'+overflow+'px)',offset:.9},{transform:'translateX(-'+overflow+'px)',offset:1}],{duration:(cue.end-cue.start)*1000,fill:'both',easing:'linear'});animation.currentTime=Math.max(0,(time-cue.start)*1000);if(paused)animation.pause();}
   }
   if(index<0)return;
   const cue=cues[index];let accent=-1;
   if(!paused&&!reduced.matches&&beat>=0&&beat%4===0&&time-at>=0&&time-at<.18&&at>=cue.start&&at<cue.end&&accentSyllables.length){accent=Math.min(accentSyllables.length-1,Math.floor((at-cue.start)/(cue.end-cue.start)*accentSyllables.length));}
   if(accent!==activeAccent){if(activeAccent>=0&&accentSyllables[activeAccent])accentSyllables[activeAccent].classList.remove('is-accent');activeAccent=accent;if(accent>=0)accentSyllables[accent].classList.add('is-accent');}
  }
  function pause(on){paused=on;for(const a of [animation,beatAnimation])if(a&&a.playState!=='finished'&&a.playState!=='idle'){if(on)a.pause();else a.play();}}
  return {set,update,pause,clear,color};
 }
 root.MoleGame=root.MoleGame||{};root.MoleGame.RhythmLyrics={create};
})(window);
