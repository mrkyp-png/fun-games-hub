(function(root){'use strict';const MG=root.MoleGame,KEY='mole.gameRules.skip.v1';let current=null;
 const ko=()=>root.FGH.I18N.lang==='ko',t=(a,b)=>ko()?a:b;
 const names={smoke:['방귀 두더지','Farting mole'],thief:['도둑 두더지','Thief mole'],drink:['콜라 두더지','Cola mole'],phone:['게임 두더지','Gaming mole']};
 const bonus=()=>t('추가 보너스를 줘요.\n확률에 따라 아이템과 소모품을\n획득할 수 있어요.\n당첨 보상은 메일함으로 지급됩니다.','Golden moles give extra bonuses. You have a chance to receive items and consumables. Prize rewards are sent to your mailbox.');
 function modeFor(light,round){return light!=='easy'&&round===6?'colored':light!=='easy'&&round===8?'mixed':'prankster';}
 function shouldShow(){try{return localStorage.getItem(KEY)!=='1';}catch(e){return true;}}
 function samplesFor(mode,kind){
  const ids=kind&&kind!=='any'&&kind!=='combo'?[kind]:['smoke','thief','drink','phone'];
  const list=ids.map((behavior,i)=>({behavior,label:t(...names[behavior]),kind:mode==='colored'?'animal':'mole',color:i%4,...(mode==='colored'?{tint:[4,2,1,0][i%4]}:{})}));
  if(mode==='mixed'&&kind==='any')list.push({kind:'animal',color:1,behavior:'drink',label:t('색깔 두더지','Colored mole')});return list;
 }
 function close(){if(current)current.close(false);}
 function panel(options){
  close();const previous=document.activeElement,overlay=document.createElement('div');overlay.className='mole-guide-overlay';overlay.id=options.mission?'mission-intro':'mole-game-rules';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.tabIndex=-1;
  const card=document.createElement('div');card.className='mole-guide-card';const title=document.createElement('h2');title.id='mole-guide-title';title.textContent=options.title;overlay.setAttribute('aria-labelledby',title.id);card.appendChild(title);
  if(options.description){const p=document.createElement('p');p.className='mole-guide-description';p.textContent=options.description;card.appendChild(p);}
  const gallery=document.createElement('div');gallery.className='mole-guide-gallery'+(options.mission?'':' mole-guide-gallery--rules');card.appendChild(gallery);const samples=[];
  options.sections.forEach(section=>{const group=document.createElement('section');group.className='mole-guide-group'+(section.tone?' mole-guide-group--'+section.tone:'');const h=document.createElement('h3');h.textContent=section.title;group.appendChild(h);const row=document.createElement('div');row.className=section.sideText?'mole-guide-golden-row':'mole-guide-figures';row.style.setProperty('--guide-columns',options.mission?Math.min(4,section.samples.length):4);group.appendChild(row);
   section.samples.forEach(sample=>{const figure=document.createElement('figure');figure.className='mole-guide-figure';const slot=document.createElement('div');slot.className='mole-guide-actor-slot';figure.appendChild(slot);const label=document.createElement('figcaption');label.className='mole-guide-label ws-action-frame inv-action-frame'+(sample.good||sample.bomb?' is-avoid':'');const parts=ko()?sample.label.replace(/\s*두더지$/,''):'Mole';
    if(ko()&&/두더지$/.test(sample.label)){const a=document.createElement('span'),b=document.createElement('span');a.className=b.className='guide-name-line';a.textContent=parts;b.textContent='두더지';label.append(a,b);}else{const words=sample.label.trim().split(/\s+/);const a=document.createElement('span'),b=document.createElement('span');a.className=b.className='guide-name-line';a.textContent=words.slice(0,-1).join(' ');b.textContent=words[words.length-1];label.append(a,b);}figure.appendChild(label);row.appendChild(figure);samples.push(Object.assign({},sample,{slot}));});
   if(section.sideText){const p=document.createElement('p');p.className='mole-guide-golden-copy';section.sideText.split('\n').forEach(text=>{const line=document.createElement('span');line.className='mole-guide-copy-line';line.textContent=text;p.appendChild(line);});row.appendChild(p);}gallery.appendChild(group);
  });
  const status=document.createElement('p');status.className='mole-guide-status';status.setAttribute('role','status');status.textContent=t('두더지 동작 준비 중…','Preparing mole animations…');card.appendChild(status);
  if(options.progress){const p=document.createElement('p');p.className='mole-guide-progress';p.textContent=options.progress;card.appendChild(p);}
  if(options.notes){const notes=document.createElement('ul');notes.className='mole-guide-notes';options.notes.forEach(text=>{const li=document.createElement('li');li.textContent=text;notes.appendChild(li);});card.appendChild(notes);}
  let checkbox;if(!options.mission){const row=document.createElement('label');row.className='mole-guide-skip';checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=!shouldShow();row.append(checkbox,document.createTextNode(t('다시 보지 않기','Do not show again')));card.appendChild(row);}
  const button=document.createElement('button');button.type='button';button.className='mole-guide-confirm ws-action-frame';button.textContent=options.mission?t('시작','Start'):t('이해했어요','Got it');button.disabled=true;card.appendChild(button);overlay.appendChild(card);document.body.appendChild(overlay);
  function fit(){if(root.getComputedStyle)card.querySelectorAll('h2,h3,.mole-guide-copy-line').forEach(heading=>{heading.style.fontSize='';if(heading.clientWidth&&heading.scrollWidth>heading.clientWidth){const size=parseFloat(root.getComputedStyle(heading).fontSize);heading.style.fontSize=(Math.floor(size*heading.clientWidth/heading.scrollWidth*10)/10)+'px';}});const h=(root.visualViewport&&root.visualViewport.height||root.innerHeight||844)-24,w=(root.visualViewport&&root.visualViewport.width||root.innerWidth||390)-24;const height=card.offsetHeight,width=card.offsetWidth;if(height&&width)card.style.transform='scale('+Math.min(1,h/height,w/width)+')';}
  fit();const observer=root.ResizeObserver?new root.ResizeObserver(fit):null;if(observer)observer.observe(card);if(root.addEventListener)root.addEventListener('resize',fit);if(root.visualViewport)root.visualViewport.addEventListener('resize',fit);
  let dispose=null,timer=0,closed=false;const entry={close(confirmed){if(closed)return;closed=true;clearTimeout(timer);if(observer)observer.disconnect();if(root.removeEventListener)root.removeEventListener('resize',fit);if(root.visualViewport)root.visualViewport.removeEventListener('resize',fit);if(dispose)dispose();overlay.remove();if(current===entry)current=null;if(previous&&previous.isConnected)previous.focus({preventScroll:true});if(confirmed){if(checkbox)try{localStorage.setItem(KEY,checkbox.checked?'1':'0');}catch(e){}if(options.onDone)options.onDone();}}};current=entry;
  button.addEventListener('click',()=>entry.close(true));overlay.addEventListener('keydown',e=>{if(e.key==='Escape'&&!options.required){e.preventDefault();entry.close(false);}if(e.key==='Tab'){const list=[...card.querySelectorAll('button:not(:disabled),input')];if(!list.length){e.preventDefault();return;}const a=list[0],b=list[list.length-1];if(e.shiftKey&&(document.activeElement===a||document.activeElement===overlay)){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}}});
  async function animate(){try{const stop=await MG.GuideActors.mount(gallery,samples);if(closed){stop();return;}dispose=stop;status.textContent='';button.disabled=false;fit();button.focus({preventScroll:true});if(options.mission)timer=setTimeout(()=>entry.close(true),5000);}
   catch(e){if(closed)return;status.textContent=t('동작을 불러오지 못했습니다. 다시 시도해 주세요.','Could not load animations. Please retry.');const retry=document.createElement('button');retry.type='button';retry.className='mole-guide-confirm';retry.textContent=t('다시 시도','Retry');retry.onclick=()=>{retry.remove();animate();};card.appendChild(retry);if(!options.required){button.disabled=false;button.textContent=t('닫기','Close');}console.warn('Mole guide unavailable',e);}}
  overlay.focus({preventScroll:true});animate();return entry;
 }
 function showRules(options={}){
  const light=options.light||'easy',mode=light==='easy'?'prankster':options.mode||'prankster',difficulty=light==='easy'?t('아마추어','Amateur'):light==='legend'?t('프로','Pro'):t('노말','Normal');
  const notes=[t('두더지는 대머리, 모히칸, 한 가닥, 파마, 가시머리의 다섯 가지 헤어스타일로 등장해요. 헤어스타일이 달라도 행동을 보고 구분하세요.','Moles appear with five hairstyles: bald, mohawk, a single strand, curls, or spikes. Identify them by their actions, whatever their hairstyle.')];
  if(light!=='easy')notes.push(t('6라운드는 색깔 두더지만, 8라운드는 장난꾸러기와 색깔 두더지 모두 잡으세요.','Round 6: colored moles only. Round 8: both prankster and colored moles.'));
  if(light==='legend')notes.push(t('일반 두더지를 때리면 하트가 2개 줄어듭니다.','Hitting a normal mole costs 2 hearts.'));
  const avoidSamples=[{good:true,label:t('일반 두더지','Normal mole')},{bomb:true,label:t('폭탄 두더지','Bomb mole')}];
  if(light!=='easy'&&mode==='prankster')avoidSamples.push({kind:'animal',tint:3,label:t('색깔 두더지','Colored mole')});
  if(light!=='easy'&&mode==='colored')avoidSamples.push({kind:'mole',behavior:'thief',label:t('장난꾸러기 두더지','Prankster mole')});
  return panel({required:!!options.required,title:difficulty+t(' 게임 규칙',' game rules'),description:mode==='mixed'?t('이번 라운드는 색깔 두더지도 잡으세요.','Catch colored moles too in this round.'):null,sections:[
   {tone:'catch',title:mode==='colored'?t('장난꾸러기 색깔 두더지를 잡으세요','Catch colored prankster moles'):t('장난꾸러기 두더지를 잡으세요','Catch prankster moles'),samples:samplesFor(mode)},
   {tone:'avoid',title:t('때리면 안 되는 두더지예요','Do not hit these moles'),samples:avoidSamples},
   {tone:'gold',title:t('황금두더지는 꼭 잡으세요','Be sure to catch golden moles'),samples:[{golden:true,label:t('황금 두더지','Golden mole')}],sideText:bonus()}
  ],notes,onDone:options.onDone});
 }
 function showMission(options){const ms=options.mission;return panel({mission:true,required:true,title:t('이번 라운드 추가 미션','Round bonus mission'),description:options.label,sections:[{title:t('미션 대상','Mission targets'),samples:samplesFor(options.mode||'prankster',ms.kind)}],progress:Math.min(ms.count,ms.n)+' / '+ms.n+'  ·  '+t('보상 ','Reward ')+options.reward+t(' 코인',' coins'),notes:[t('기본 규칙은 그대로! 다른 정답 두더지도 계속 잡으세요.','Keep following the rules and catch other valid targets too.'),t('미션을 달성하면 추가 보상을 받습니다.','Complete this goal for an extra reward.')],onDone:options.onDone});}
 MG.GameGuide={modeFor,shouldShow,showRules,showMission,close,samplesFor};
})(window);
