const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../public/merchant/clip-studio.js'), 'utf8');
const production = source.match(/function v3SetModeUrl\(\)\{[^\n]+\}/)?.[0];
assert.ok(production, 'production URL transition function exists');
function transition(mode, id, opening, href) {
  let result = null;
  const context = {URL, state: {config: {mode}, id}, v3OpeningProject: opening, location: {href}, history: {state: {keep: 1}, replaceState(state, title, url) {assert.deepEqual(state, {keep: 1}); result = url;}}};
  context.isV3 = () => mode !== 'script';
  vm.runInNewContext(production + ';v3SetModeUrl();', context);
  return result;
}
test('initial layout retains project to be opened with tenant and anchor', () => {
  assert.equal(transition('quick', 0, true, 'http://localhost/ai/video-editor?tenant_id=1&project_id=101#review'), '/ai/video-editor?tenant_id=1&project_id=101&mode=onekey#review');
});
test('saved project uses current id and mode while preserving unrelated context', () => {
  const result = new URL(transition('mix', 77, false, 'http://localhost/ai/video-editor?tenant_id=1&brand_id=3&project_id=9'), 'http://localhost');
  assert.equal(result.searchParams.get('project_id'), '77');
  assert.equal(result.searchParams.get('mode'), 'batch');
  assert.equal(result.searchParams.get('tenant_id'), '1');
  assert.equal(result.searchParams.get('brand_id'), '3');
});
test('new storyboard removes prior project id so refresh cannot reopen it', () => {
  const result = new URL(transition('storyboard', 0, false, 'http://localhost/ai/video-editor?tenant_id=1&project_id=9'), 'http://localhost');
  assert.equal(result.searchParams.has('project_id'), false);
  assert.equal(result.searchParams.get('mode'), 'script');
});
test('legacy oral helper keeps its existing route untouched', () => {
  assert.equal(transition('script', 19, false, 'http://localhost/ai/video-editor?tenant_id=1&mode=oral'), null);
});
