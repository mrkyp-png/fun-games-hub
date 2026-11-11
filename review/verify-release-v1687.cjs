// Prepare file inventory first: git ls-files | Set-Content -Encoding UTF8 review/release-tracked-files.txt
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const source=fs.readFileSync('mole/sw.js','utf8');
const config=vm.runInNewContext(source+'\n;({CACHE,SHELL})',{self:{addEventListener(){}}});
assert.equal(config.CACHE,'mole-game-v1687-G');
const tracked=new Set(fs.readFileSync('review/release-tracked-files.txt','utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/));
for(const ref of config.SHELL){
 const file=path.posix.normalize('mole/'+(ref==='./'?'index.html':ref.split('?')[0]));
 assert(fs.existsSync(file),'Missing SW shell file: '+file);
 assert(tracked.has(file),'Untracked SW shell file: '+file);
}
const html=fs.readFileSync('mole/index.html','utf8');assert(html.includes('V 1687 G'));
assert(!html.includes('1686-G'));assert(!fs.readFileSync('mole/js/home3d.js','utf8').includes('1686-G'));
console.log('PASS: V1687 G tag/cache/queries and '+config.SHELL.length+' tracked shell assets');
