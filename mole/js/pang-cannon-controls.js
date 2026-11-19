/* Reuses the plaza input model; each FIRE pointer-down creates at most one request. */
(function(root){'use strict';
 function layout(width,height,insets={left:0,right:0,bottom:0}){const portrait=height>width,size=portrait?Math.max(72,Math.min(110,width*.245,height*.145)):Math.max(50,Math.min(140,height*.23,width*.18)),skill=Math.max(28,size*.55),gap=Math.max(18,size*.32),radius=(size+skill)/2+gap,pad=Math.max(12,height*.035),right=pad+(insets.right||0),bottom=pad+(insets.bottom||0),cx=width-right-size/2,cy=height-bottom-size/2;return{fire:{x:cx-size/2,y:cy-size/2,w:size,h:size},stick:{x:pad+(insets.left||0),y:height-bottom-size,w:size,h:size},skills:[175,140,105].map(deg=>{const a=deg*Math.PI/180;return{x:cx+radius*Math.cos(a)-skill/2,y:cy-radius*Math.sin(a)-skill/2,w:skill,h:skill};}),radius,gap};}

 function create(host,options={}){const input=root.MoleGame.Home3DUI.createInput(),held=new Set(),stick=document.createElement('div'),knob=document.createElement('span'),fire=document.createElement('button'),buttons=[];let enabled=false,disposed=false,aim={u:.5,v:.42};stick.className='ppc-stick';stick.appendChild(knob);fire.className='ppc-fire';fire.textContent='FIRE';fire.type='button';fire.setAttribute('aria-label','FIRE');host.append(stick,fire);
  function xy(e){const r=stick.getBoundingClientRect();return[e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2,r.width*.32];}
  function paint(){const r=stick.getBoundingClientRect().width*.32;knob.style.transform='translate('+input.joy.x*r+'px,'+input.joy.y*r+'px)';}
  function reset(){held.clear();input.reset();paint();}
  const listeners=[];function listen(el,type,fn){el.addEventListener(type,fn);listeners.push(()=>el.removeEventListener(type,fn));}
  listen(stick,'pointerdown',e=>{if(!enabled)return;e.preventDefault();if(input.stickDown(e.pointerId,...xy(e))){stick.setPointerCapture?.(e.pointerId);paint();}});listen(stick,'pointermove',e=>{input.stickMove(e.pointerId,...xy(e));paint();});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(stick,type,e=>{input.stickUp(e.pointerId);paint();});
  function single(button,fn){listen(button,'pointerdown',e=>{e.preventDefault();if(!enabled||button.disabled||held.has(e.pointerId))return;held.add(e.pointerId);button.setPointerCapture?.(e.pointerId);fn();});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(button,type,e=>held.delete(e.pointerId));}
  single(fire,()=>options.onFire?.({...aim}));for(const [i,id]of ['targeting','ai','shield'].entries()){const button=document.createElement('button');button.className='ppc-skill ppc-skill-'+i;button.dataset.skill=id;button.type='button';button.setAttribute('aria-label',id);const img=document.createElement('img'),definition=root.MoleGame.Skills?.skillById(id);if(definition){img.src=definition.icon;img.alt='';button.appendChild(img);}else button.textContent=id;button.disabled=true;single(button,()=>options.onSkill?.(id));buttons.push(button);host.appendChild(button);}
  function resize(){const rect=host.getBoundingClientRect(),style=root.getComputedStyle?.(host),safe=side=>parseFloat(style?.getPropertyValue('--ppc-safe-'+side))||0,d=layout(rect.width||800,rect.height||450,{left:safe('left'),right:safe('right'),bottom:safe('bottom')});for(const [el,p]of [[fire,d.fire],[stick,d.stick],...buttons.map((b,i)=>[b,d.skills[i]])]){el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.width=p.w+'px';el.style.height=p.h+'px';}paint();}
  listen(root,'resize',resize);const observer=root.ResizeObserver?new root.ResizeObserver(resize):null;observer?.observe(host);resize();
  listen(root,'blur',()=>{reset();options.onBlur?.();});listen(document,'visibilitychange',()=>{if(document.hidden){reset();options.onBlur?.();}});
  function update(dt){if(!enabled||disposed)return aim;aim.u=Math.max(.08,Math.min(.92,aim.u+input.joy.x*.6*dt));aim.v=Math.max(.08,Math.min(.82,aim.v+input.joy.y*.6*dt));return{...aim};}
  function setEnabled(on){enabled=!!on;input.setEnabled(enabled);if(!enabled)reset();}
  function setSkills(ids){for(const b of buttons)b.disabled=!ids.includes(b.dataset.skill);}
  function dispose(){if(disposed)return;disposed=true;observer?.disconnect();setEnabled(false);listeners.forEach(f=>f());for(const el of [stick,fire,...buttons])el.remove();}
  return{update,setEnabled,setSkills,reset,dispose,fire,stick,buttons,aim:()=>({...aim})};
 }
 root.MoleGame.PangCannonControls={create,layout};
})(window);
