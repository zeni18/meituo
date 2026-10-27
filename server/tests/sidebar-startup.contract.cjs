const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('public/merchant/geo-semi-loader.js', 'utf8');

// A cold refresh can render the native shell while the merchant extension is
// still downloading. GEO must not insert a second set of links into that shell.
for (const path of ['/ai/geo?tenant_id=1#diagnose', '/ai/automation?tenant_id=1', '/ai/stores?tenant_id=1']) {
  const frames = [];
  const nativeNav = {querySelector: () => null};
  let earlyElements = 0;
  const document = {
    documentElement: {},
    querySelector: selector => selector === 'aside .ia-navigation' ? nativeNav : null,
    createElement() {earlyElements++; throw Error('GEO inserted before the merchant navigation was ready');},
    addEventListener() {},
  };
  vm.runInNewContext(source, {
    window: {}, document, location: new URL('http://localhost:8090' + path),
    history: {pushState() {}, replaceState() {}}, URL, URLSearchParams,
    requestAnimationFrame: callback => frames.push(callback),
    MutationObserver: class {observe() {}}, addEventListener() {},
    queueMicrotask() {}, dispatchEvent() {}, Event: class {}, console,
  });
  assert.equal(frames.length, 1);
  assert.doesNotThrow(() => frames.shift()(), 'wait for the merchant container on ' + path);
  assert.equal(earlyElements, 0, 'no orphaned GEO or automation links before readiness');
}
console.log('Sidebar startup: native shell may arrive before merchant navigation without early GEO insertion.');
