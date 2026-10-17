const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const sw=fs.readFileSync('mole/sw.js','utf8'),body=sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1],shell=vm.runInNewContext(body);
assert.equal(new Set(shell).size,shell.length);for(const entry of shell)assert(fs.existsSync(path.join('mole',entry)),entry);
for(const f of ['rhythm.js','rhythm-b.js','rhythm-b-play.js','rhythm-lyrics.js'])new vm.Script(fs.readFileSync('mole/js/'+f,'utf8'),{filename:f});
const html=fs.readFileSync('mole/index.html','utf8');for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);assert(html.includes('V 1172 G'));assert(sw.includes('mole-game-v1172-G'));
const registry=fs.readFileSync('mole/js/rhythm.js','utf8').match(/bSongs: (\[[^\n]+\]),/)[1],songs=vm.runInNewContext(registry);assert.equal(songs.length,4);assert(songs.every(s=>s.id!=='fever2'));console.log('PASS SW',shell.length,'paths present/unique, JS/inline syntax, V1172, shared A/B4 real songs');
