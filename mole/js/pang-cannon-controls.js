/* Reuses the plaza input model; each FIRE pointer-down creates at most one request. */
(function(root){'use strict';
 function create(host,options={}){const input=root.MoleGame.Home3DUI.createInput(),held=new Set(),stick=document.createElement('div'),knob=document.createElement('span'),fire=document.createElement('button'),buttons=[];let enabled=false,disposed=false,aim={u:.5,v:.42};stick.className='ppc-stick';stick.appendChild(knob);fire.className='ppc-fire';fire.textContent='FIRE';fire.type='button';fire.setAttribute('aria-label','FIRE');host.append(stick,fire);
  function xy(e){const r=stick.getBoundingClientRect();return[e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2,r.width*.32];}
  function paint(){const r=stick.getBoundingClientRect().width*.32;knob.style.transform='translate('+input.joy.x*r+'px,'+input.joy.y*r+'px)';}
  function reset(){held.clear();input.reset();paint();}
  const listeners=[];function listen(el,type,fn){el.addEventListener(type,fn);listeners.push(()=>el.removeEventListener(type,fn));}
  listen(stick,'pointerdown',e=>{if(!enabled)return;e.preventDefault();if(input.stickDown(e.pointerId,...xy(e))){stick.setPointerCapture?.(e.pointerId);paint();}});listen(stick,'pointermove',e=>{input.stickMove(e.pointerId,...xy(e));paint();});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(stick,type,e=>{input.stickUp(e.pointerId);paint();});
  function single(button,fn){listen(button,'pointerdown',e=>{e.preventDefault();if(!enabled||button.disabled||held.has(e.pointerId))return;held.add(e.pointerId);button.setPointerCapture?.(e.pointerId);fn();});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(button,type,e=>held.delete(e.pointerId));}
  single(fire,()=>options.onFire?.({...aim}));for(const [i,id]of ['targeting','ai','shield'].entries()){const button=document.createElement('button');button.className='ppc-skill ppc-skill-'+i;button.dataset.skill=id;button.type='button';button.setAttribute('aria-label',id);const img=document.createElement('img'),definition=root.MoleGame.Skills?.skillById(id);if(definition){img.src=definition.icon;img.alt='';button.appendChild(img);}else button.textContent=id;button.disabled=true;single(button,()=>options.onSkill?.(id));buttons.push(button);host.appendChild(button);}
  listen(root,'blur',()=>{reset();options.onBlur?.();});listen(document,'visibilitychange',()=>{if(document.hidden){reset();options.onBlur?.();}});
  function update(dt){if(!enabled||disposed)return aim;aim.u=Math.max(.08,Math.min(.92,aim.u+input.joy.x*.6*dt));aim.v=Math.max(.12,Math.min(.70,aim.v+input.joy.y*.6*dt));return{...aim};}
  function setEnabled(on){enabled=!!on;input.setEnabled(enabled);if(!enabled)reset();}
  function setSkills(ids){for(const b of buttons)b.disabled=!ids.includes(b.dataset.skill);}
  function dispose(){if(disposed)return;disposed=true;setEnabled(false);listeners.forEach(f=>f());for(const el of [stick,fire,...buttons])el.remove();}
  return{update,setEnabled,setSkills,reset,dispose,fire,stick,buttons,aim:()=>({...aim})};
 }
 root.MoleGame.PangCannonControls={create};
})(window);
