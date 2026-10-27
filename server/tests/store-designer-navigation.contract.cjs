const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const stores = read('public/merchant/store-directory.js');
const brands = read('public/merchant/brand-directory.js');
const editorUrl = stores.match(/    function editorUrl\(id\)\{[^\n]+\}/)?.[0];
const route = brands.match(/    const route=\(\)=>\{[^\n]+\};/)?.[0];
const pop = brands.match(/    const pop=\(\)=>\{.*?\};window\.addEventListener/)?.[0].split(';window.addEventListener')[0] + ';';
assert.ok(editorUrl && route && pop, 'use the actual store navigation and parent route handler');

function scenario(start, brandId) {
  let location = new URL(start);
  let switched = 0;
  const notifications = [];
  const state = {id: brandId, tab: 'stores', dead: false, dirty: false, data: {}};
  const context = vm.createContext({
    URL, URLSearchParams, state,
    get location() { return location; },
    history: {pushState(_state, _title, target) {
      location = new URL(target, location);
      // The brand directory runs its route observer after pushState.
      notifications.push(() => vm.runInContext('pop()', context));
    }},
    root: {querySelector: () => ({})},
    switchBrandTab: () => switched++,
    render: () => switched++,
  });
  vm.runInContext(route + pop + editorUrl, context);
  const navigate = id => {
    vm.runInContext(`editorUrl(${id})`, context);
    notifications.splice(0).forEach(notify => notify());
  };
  return {navigate, state, get location() { return location; }, get switched() { return switched; }};
}

const branded = scenario('http://localhost:8090/ai/stores?tenant_id=2&brand_id=7#stores', 7);
branded.navigate(41);
assert.equal(branded.location.hash, '#stores', 'opening decoration retains the parent stores tab');
assert.equal(branded.switched, 0, 'opening decoration must not rebuild the parent panel and destroy the editor');
assert.equal(branded.location.searchParams.get('store_id'), '41');
assert.equal(branded.location.searchParams.get('store_editor'), '1');
assert.equal(branded.location.searchParams.get('tenant_id'), '2');
assert.equal(branded.location.searchParams.get('brand_id'), '7');
branded.navigate(0);
assert.equal(branded.location.hash, '#stores', 'returning from decoration stays in store management');
assert.equal(branded.switched, 0, 'returning must not switch to the brand overview');
assert.equal(branded.location.searchParams.has('store_id'), false);
assert.equal(branded.location.searchParams.has('store_editor'), false);
branded.navigate(42);
assert.equal(branded.location.searchParams.get('store_id'), '42', 'a different store can reopen');
assert.equal(branded.switched, 0);

const standalone = scenario('http://localhost:8090/ai/stores?tenant_id=2', 0);
standalone.navigate(41);
assert.equal(standalone.location.hash, '', 'standalone directory retains its hashless URL');
standalone.navigate(0);
assert.equal(standalone.location.href, 'http://localhost:8090/ai/stores?tenant_id=2');
console.log('Store designer navigation: opening, returning, reopening and standalone URLs passed.');
