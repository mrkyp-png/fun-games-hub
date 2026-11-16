const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('mole/js/game.js', 'utf8').replace(/\r\n/g,'\n');
const start = source.indexOf('  function startRound(opts)');
const gate = source.indexOf('    const beginRoundIntro =', start);
assert(source.indexOf('    updateHUD();', start) < gate);
assert(!source.slice(start, gate).includes('MG.GameGuide.showRules('));
const code = source.slice(gate, source.indexOf('\n  }', gate));
function check(skip, stale) {
  let confirm, intros = 0, loops = 0;
  const state = {introActive:true};
  const context = {myGen:1,sessionGen:1,state,opts:{fresh:true,direct:true},
    currentLight:()=> 'mid',currentChapter:()=>1,
    MG:{GameGuide:{shouldShow:()=>!skip,modeFor:()=> 'prankster',showRules:options=>{confirm=options.onDone;}}},
    playRoundIntro:done=>{intros++;done();},setNavLock:()=>{},performance:{now:()=>100},
    requestAnimationFrame:()=>{loops++;return 1;},loop(){}};
  vm.createContext(context);vm.runInContext(code,context);
  assert.equal(intros,skip?1:0);
  if (!skip) {if(stale)context.sessionGen++;confirm();}
  assert.equal(intros,stale?0:1);assert.equal(loops,stale?0:1);
  assert.equal(state.introActive,stale);
}
check(false,false);check(false,true);check(true,false);
const entry = source.slice(source.indexOf('      startGame: () => {'));
assert(entry.includes('if (MG.GameGuide.shouldShow()) beginGame(true);\n        else MG.ShapeTransition.run(1, () => beginGame(true));'));
const css = fs.readFileSync('mole/game-guide.css','utf8');
assert(css.includes('backdrop-filter:blur(8px)'));assert(!css.includes('#07182ee8'));
console.log('PASS prepared game behind guide, countdown waits for confirmation, stale confirmation ignored, skip starts immediately, guide entry skips colored bands, neutral blur backdrop');
