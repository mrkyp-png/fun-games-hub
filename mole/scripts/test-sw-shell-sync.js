const assert = require('assert');
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../index.html');
const swPath = path.join(__dirname, '../sw.js');
const html = fs.readFileSync(htmlPath, 'utf8');
const sw = fs.readFileSync(swPath, 'utf8');

// index.html 의 <script src="js/xxx.js"> 전부 추출 (로컬 js/ 파일만 — CDN 등 외부 스크립트 제외)
const scriptSrcs = [...html.matchAll(/<script src="(js\/[^"]+\.js)"><\/script>/g)].map((m) => m[1]);
assert.ok(scriptSrcs.length > 10, 'sanity check: found ' + scriptSrcs.length + ' local script tags, expected 10+');

// sw.js 의 SHELL 배열 안 문자열 리터럴 전부 추출
const shellEntries = [...sw.matchAll(/'\.\/(js\/[^']+\.js)'/g)].map((m) => m[1]);

const missing = scriptSrcs.filter((src) => !shellEntries.includes(src));
assert.deepStrictEqual(missing, [], 'index.html의 <script> 태그 중 sw.js SHELL에 없는 파일: ' + missing.join(', '));

console.log('test-sw-shell-sync.js: all assertions passed');
