const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('mole/js/game.js','utf8');
const recovery=source.split('// WORKSHOP_STARTUP_RECOVERY_BEGIN')[1].split('// WORKSHOP_STARTUP_RECOVERY_END')[0];
function make(mode,missing=['item-inventory.js','workshop-enhance.js','workshop.js']){
 const MG={ItemInventory:{},WorkshopEnhance:{create(){}},Workshop:{create(){}}},key={'item-inventory.js':'ItemInventory','workshop-enhance.js':'WorkshopEnhance','workshop.js':'Workshop'};missing.forEach(f=>delete MG[key[f]]);
 const requests=[],attempts={},timers=new Set();const ctx={MG,URL,location:{href:'https://example.test/mole/index.html'},Date,Error,Array,Promise,setTimeout:(f,ms)=>{const t=setTimeout(f,ms);timers.add(t);return t},clearTimeout:t=>{clearTimeout(t);timers.delete(t)},document:{scripts:Object.keys(key).map(f=>({src:'https://example.test/mole/js/'+f+'?v=1746-G'})),createElement:()=>({remove(){}}),head:{appendChild(script){const url=new URL(script.src),file=url.pathname.split('/').pop();requests.push(url);attempts[file]=(attempts[file]||0)+1;queueMicrotask(()=>{if(mode==='fail'||mode==='first-fail'&&attempts[file]===1)script.onerror();else{if(mode!=='no-export')MG[key[file]]={create(){}};script.onload();}})}}}};
 vm.createContext(ctx);vm.runInContext(recovery,ctx);return{ctx,requests,attempts,timers};
}
(async()=>{
 let h=make('ok',[]);await h.ctx.recoverWorkshopStartup();assert.equal(h.requests.length,0);assert(h.ctx.workshopStartupReady());
 h=make('first-fail');await h.ctx.recoverWorkshopStartup();assert(h.ctx.workshopStartupReady());assert.deepEqual(h.requests.map(u=>u.pathname.split('/').pop()),['item-inventory.js','item-inventory.js','workshop-enhance.js','workshop-enhance.js','workshop.js','workshop.js']);assert(h.requests.every(u=>u.searchParams.get('v')==='1746-G'&&u.searchParams.has('_module_retry')));assert.equal(h.timers.size,0);
 for(const mode of ['fail','no-export']){h=make(mode,['workshop.js']);await assert.rejects(h.ctx.recoverWorkshopStartup(),/workshop\.js/);assert.equal(h.requests.length,2);assert.equal(h.timers.size,0);assert(!h.ctx.workshopStartupReady());}
 const clear=source.slice(source.indexOf('window.__clearRecoveredWorkshopError ='),source.indexOf('    window.__saveDiag = saveDiag;'));
 const stored={},old="22:42 ERR Uncaught TypeError: Cannot read properties of undefined (reading 'create') @game.js?v=1745-C:4046",other="22:43 ERR different @game.js?v=1745-C:100";
 const c={window:{},diag:[old,other],localStorage:{setItem:(k,v)=>stored[k]=v}};vm.createContext(c);vm.runInContext(clear,c);c.window.__clearRecoveredWorkshopError();assert.deepEqual(JSON.parse(stored['mole.diag']),[other]);assert.deepEqual(JSON.parse(stored['mole.diag.recoveredWorkshop1746G']),[old]);
 console.log('PASS normal path makes no requests; missing dependencies recover in order; failed download retries; missing export rejects; timers cleaned; only resolved phone error archived');
})().catch(e=>{console.error(e);process.exitCode=1});
