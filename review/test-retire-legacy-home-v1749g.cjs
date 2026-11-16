const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const game=fs.readFileSync('mole/js/game.js','utf8').replace(/\r\n/g,'\n');
const home=fs.readFileSync('mole/js/home3d.js','utf8');
const html=fs.readFileSync('mole/index.html','utf8');
for(const id of ['board-start','round-strip','start-intro-overlay'])assert(!html.includes('id="'+id+'"'),'legacy DOM removed: '+id);
for(const old of ['initHomeShowcase','pulseGridCells','pulseDialPad','wireChapterNav','playStartIntro','resumeBgmAudioCtx'])assert(!game.includes(old),'legacy execution removed: '+old);
assert(!home.includes("qs.get('home3d')"),'legacy home query bypass removed');
assert(game.includes('let home3d = null;'),'shared home instance remains declared');
for(const name of ['beginGame','beginOrderGame']){
 const a=game.indexOf('  function '+name+'('),b=game.indexOf('\n  }',a);
 assert(game.slice(a,b).includes('home3d.gameStarted({ keepVisible: true })'));
}
const order=game.slice(game.indexOf('  function startOrderRound('),game.indexOf('  function orderHudMount('));
assert(order.indexOf('home3d.revealGame()')>order.indexOf('orderHud();'),'order game prepared before reveal');
const keepAt=home.indexOf('gameStarted(options)'),end=home.indexOf('      renderAllowed:',keepAt);
const methods=home.slice(keepAt,end);let state='EXPLORE',shown=true,stops=0;
const classes=new Set();
const context={opts:{host:{classList:{toggle(k,on){on?classes.add(k):classes.delete(k)},remove(k){classes.delete(k)}}}},st:{gameStarted(){if(state==='GAMEPLAY')return false;state='GAMEPLAY';return true},get state(){return state}},stop(){stops++},ui:{setFeature(){}},show(on){shown=on}};
vm.createContext(context);vm.runInContext('api={'+methods+'}',context);
context.api.gameStarted({keepVisible:true});assert(shown);assert(classes.has('game-entry-pending'));assert.equal(stops,1);
context.api.revealGame();assert(!shown);assert(!classes.has('game-entry-pending'));
const css=fs.readFileSync('mole/home3d.css','utf8');assert(css.includes('#game-screen.game-entry-pending #home3d{z-index:99999;pointer-events:none}'));
assert(css.includes('#game-screen.is-start :is(#lane-button-bar,#mole-board){visibility:hidden}'));
console.log('PASS legacy DOM/loops/bypass removed, normal/order entry retain the 3D frame during preparation, explicit reveal swaps once, shared game controls preserved');
