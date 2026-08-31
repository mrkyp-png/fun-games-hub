// 허브 전체(4개 테마 포함)를 서빙하는 초경량 정적 서버 — file://에서 발생하는
// canvas cross-origin taint 문제를 피하려고 http:// origin으로 서빙한다.
// 색칠앱(coloring/scripts/serve.js)과 동일한 패턴, 루트만 허브 전체로 확장.
// scripts/.devcert/{cert,key}.pem 이 있으면 https(PORT+1)도 같이 띄운다 (휴대폰 실기 테스트용).
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8844);
const HTTPS_PORT = PORT + 1;
const CERT_DIR = path.join(__dirname, '.devcert');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg'
};

function handler(req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const full = path.join(ROOT, p);
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full)] || 'application/octet-stream',
      'Cache-Control': 'no-store' // 미리보기는 항상 최신 파일을 봐야 하므로 브라우저 캐시 금지
    });
    res.end(data);
  });
}

function lanIPs() {
  return [].concat(...Object.values(os.networkInterfaces()))
    .filter((n) => n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
}

http.createServer(handler)
  .on('error', (e) => console.log('http :' + PORT + ' 안 뜸 (' + e.code + ') — https 만 사용'))
  .listen(PORT, '0.0.0.0', () => console.log('serving on http://localhost:' + PORT));

let cert, key;
try {
  cert = fs.readFileSync(path.join(CERT_DIR, 'cert.pem'));
  key = fs.readFileSync(path.join(CERT_DIR, 'key.pem'));
} catch (e) { /* 인증서 없으면 https 생략 */ }

if (cert && key) {
  https.createServer({ cert, key }, handler).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log('serving on https://localhost:' + HTTPS_PORT + ' (self-signed)');
    lanIPs().forEach((ip) =>
      console.log('  phone: https://' + ip + ':' + HTTPS_PORT + '/mole/index.html'));
  });
} else {
  lanIPs().forEach((ip) =>
    console.log('  phone: http://' + ip + ':' + PORT + '/mole/index.html'));
}
