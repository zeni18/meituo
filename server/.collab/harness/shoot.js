// node .collab/harness/shoot.js <path> <out.png> [w=1440] [h=900] [--full] [--steps steps.js]
// Needs Playwright (NODE_PATH pointing at a node_modules with playwright). Prints layout QA (horizontal scroll, clipped text) and console errors.
const { chromium } = require('playwright');
(async () => {
  const a = process.argv.slice(2);
  const [p, out] = a; const w = +(a[2] || 1440), h = +(a[3] || 900);
  const full = a.includes('--full'); const si = a.indexOf('--steps');
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +(process.env.DSF || 1) });
  const errs = [];
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await pg.goto('http://127.0.0.1:' + (process.env.PORT || 8765) + p, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(+(process.env.WAIT || 900));
  if (si >= 0) { const fn = require(require('path').resolve(a[si + 1])); await fn(pg); await pg.waitForTimeout(400); }
  await pg.screenshot({ path: out, fullPage: full });
  const qa = await pg.evaluate(() => { const de = document.documentElement; const issues = []; document.querySelectorAll('main *, .uk-layers *').forEach((el) => { const cs = getComputedStyle(el); if (cs.display === 'none') return; const r = el.getBoundingClientRect(); if (!r.width) return; const txt = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (txt && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && cs.overflow !== 'visible' && cs.overflowX !== 'auto') issues.push(el.className + ':' + el.textContent.trim().slice(0, 24)); if ((el.tagName === 'BUTTON') && r.right > innerWidth + 1) issues.push('offscreen:' + el.textContent.trim().slice(0, 16)); }); return { hscroll: de.scrollWidth > de.clientWidth + 1, h: de.scrollHeight, issues: [...new Set(issues)].slice(0, 12), url: location.pathname + location.search + location.hash }; });
  console.log(JSON.stringify({ out, qa, errs: errs.slice(0, 12) }));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
