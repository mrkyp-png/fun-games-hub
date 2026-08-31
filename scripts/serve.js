// 허브 전체(4개 테마 포함)를 서빙하는 초경량 정적 서버 — file://에서 발생하는
// canvas cross-origin taint 문제를 피하려고 http:// origin으로 서빙한다.
// 색칠앱(coloring/scripts/serve.js)과 동일한 패턴, 루트만 허브 전체로 확장.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 8844;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg'
};

http.createServer((req, res) => {
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
}).listen(PORT, '0.0.0.0', () => {
  console.log('serving on http://localhost:' + PORT);
  // 같은 와이파이의 휴대폰에서 접속할 LAN 주소도 안내
  const lan = [].concat(...Object.values(os.networkInterfaces()))
    .filter((n) => n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
  lan.forEach((ip) => console.log('  phone: http://' + ip + ':' + PORT + '/mole/index.html'));
});
