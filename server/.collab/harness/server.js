// Headless harness static server for merchant v2 pages (no PHP, no database).
//   node .collab/harness/server.js [port=8765]
// /merchant/* and /img/* come from the repo's public/ folder; /mock-*.js from this folder; everything else -> index.html
const http = require('http'), fs = require('fs'), path = require('path');
const here = __dirname, pub = path.join(here, '..', '..', 'public');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = (u.startsWith('/merchant/') || u.startsWith('/img/')) ? path.join(pub, u) : /^\/mock[\w-]*\.js$/.test(u) ? path.join(here, u) : path.join(here, 'index.html');
  if (!f.startsWith(pub) && !f.startsWith(here)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(Number(process.argv[2] || 8765), '127.0.0.1', () => console.log('harness on http://127.0.0.1:' + (process.argv[2] || 8765)));
