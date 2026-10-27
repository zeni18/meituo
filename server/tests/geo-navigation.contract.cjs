const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('public/merchant/geo-semi-loader.js', 'utf8');

function runtime(withRouter = true) {
  const handlers = {}, pushes = [], fullLoads = [], historyPaths = [];
  const location = new URL('http://localhost:8090/ai/geo?tenant_id=1#website');
  location.assign = target => fullLoads.push(target);
  location.replace = target => fullLoads.push(target);
  const router = {push(target) {pushes.push(target); return Promise.resolve();}};
  const window = {};
  const document = {
    documentElement: {},
    addEventListener(type, handler) {handlers[type] = handler;},
    getElementById(id) {return id === '__nuxt' && withRouter ? {__vue_app__: {config: {globalProperties: {$router: router}}}} : null;},
  };
  vm.runInNewContext(source, {window, document, location, history: {pushState(_s,_t,url) {historyPaths.push(url);}, replaceState() {}},
    URL, URLSearchParams, Promise, console, queueMicrotask:fn=>fn(), dispatchEvent() {}, Event:class {constructor(type){this.type=type;}}, MutationObserver: class {observe() {}}, requestAnimationFrame() {}, addEventListener() {}});
  function click(href, scope, options = {}) {
    const anchor = {href: new URL(href, location).href, target: options.anchorTarget || '',
      getAttribute(name) {return name === 'href' ? href : null;},
      hasAttribute(name) {return name === 'download' && !!options.download;},
      matches(selector) {return scope === 'automation' && selector.includes('[data-automation-link]') || scope === 'primary' && selector.includes('[data-geo-key]') || scope === 'return' && selector.includes('.gs-suite-back') || scope === 'footer' && selector.includes('.gs-suite-footer a');},
    };
    const event = {button: 0, target: {closest: selector => scope === 'studio' ? selector === 'aside button' ? {textContent: 'GEO营销'} : null : selector === 'a[href]' ? anchor : null}, prevented: false, stopped: false,
      preventDefault() {this.prevented = true;}, stopImmediatePropagation() {this.stopped = true;}, ...options};
    handlers.click(event);
    return event;
  }
  return {click, pushes, fullLoads, historyPaths, location, navigation:window.MerchantGeoNavigation};
}

const r = runtime();
let event = r.click('/ai?tenant_id=1', 'return');
assert.equal(event.prevented, true, 'GEO return prevents the browser document reload');
assert.equal(event.stopped, true);
assert.deepEqual(r.pushes, ['/ai?tenant_id=1'], 'return uses the existing native router and tenant context');
assert.equal(r.fullLoads.length, 0);
r.click('/ai?tenant_id=1', 'footer');
assert.equal(r.pushes.at(-1), '/ai?tenant_id=1', 'footer returns through the same native router');
r.click('/ai/geo?tenant_id=1', 'studio');
assert.equal(r.pushes.at(-1), '/ai/geo?tenant_id=1', 'the native studio button opens the dedicated GEO workspace');
r.click('/app/aigc_geo?tenant_id=1', 'legacy');
assert.equal(r.pushes.at(-1), '/ai/geo?tenant_id=1', 'legacy tool entry also uses native routing');
r.click('/ai/geo?tenant_id=1#articles','primary');
assert.equal(r.historyPaths.at(-1),'/ai/geo?tenant_id=1#articles','same-page sidebar changes hash without replaying the native route');
r.click('/ai/geo?tenant_id=1&brand_id=7#articles','primary');
assert.equal(r.pushes.at(-1),'/ai/geo?tenant_id=1&brand_id=7#articles','brand changes still use the native route');
assert.equal(r.fullLoads.length, 0);
for (const options of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {altKey: true}, {button: 1}, {download: true}, {defaultPrevented: true}, {anchorTarget: '_blank'}]) {
  assert.equal(r.click('/ai?tenant_id=1', 'return', options).prevented, false, 'preserve modified, download and already handled clicks');
}
assert.equal(r.click('https://example.com/ai', 'return').prevented, false, 'external links are untouched');
assert.equal(r.click('/ai?tenant_id=1', 'unrelated').prevented, false, 'unrelated application links are untouched');
assert.equal(r.click('/ai?tenant_id=1', 'return', {target: {closest: () => null}}).prevented, false);
assert.equal(runtime(false).click('/ai?tenant_id=1', 'return').prevented, false, 'retain normal link fallback if the native app is unavailable');
assert.deepEqual(Array.from(r.navigation.destinations,d=>d[1]),['GEO诊断','媒体发布','AI创作']);
for(const route of ['diagnose','diagnostic-reports','overview','reports','evidence','query'])assert.equal(r.navigation.destinationFor(route),'diagnose');
for(const route of ['articles','create','materials','instructions','replicate','jobs','writing-jobs'])assert.equal(r.navigation.destinationFor(route),'articles');
for(const route of ['keywords','keyword-library','keyword-index','questions','ai-keywords','manual-keywords'])assert.equal(r.navigation.destinationFor(route,'articles'),'keywords');
for(const route of ['website','influencer','accounts','sites','b2b-records','influencer-orders'])assert.equal(r.navigation.destinationFor(route),'website');
assert.equal(r.navigation.destinationFor('create','optimize'),'articles');
r.location.href='http://localhost:8090/ai/geo?tenant_id=1&brand_id=7#optimize?projectId=42';
assert.equal(r.navigation.retiredTarget(),'/ai/geo?tenant_id=1&brand_id=7#diagnose','retired page redirects without losing brand or tenant');
assert.equal(r.navigation.destinationFor('create','invalid-return'),'articles');
console.log('GEO navigation: native routing and normal link semantics passed.');

r.click('/ai/automation?tenant_id=1','automation');
assert.equal(r.pushes.at(-1),'/ai/automation?tenant_id=1','independent automation entry reuses tenant session');
