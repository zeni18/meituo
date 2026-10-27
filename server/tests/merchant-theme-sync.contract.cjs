const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('public/merchant/merchant-white.js', 'utf8');
function boot(config = {white:true, tenantId:1}, path='/ai') {
  const classes = new Set(['theme-dark','theme-coral','dark']);
  const root = {dataset:{pcSkin:'old'},style:{colorScheme:'dark'},classList:{add(...v){v.forEach(x=>classes.add(x));},remove(...v){v.forEach(x=>classes.delete(x));}},removeAttribute(k){if(k==='data-merchant-white')delete this.dataset.merchantWhite;}};
  const context = {window:{__MERCHANT_UI__:config},document:{documentElement:root},location:{pathname:path}};
  vm.runInNewContext(source,context);return {root,classes,api:context.window.MerchantWhiteTheme};
}
const {root,classes,api}=boot();
assert.equal(root.dataset.pcTheme,'light');
assert.equal(root.dataset.pcMode,'light');
assert.equal(root.style.colorScheme,'light');
assert.ok(classes.has('theme-light'));
assert.ok(!classes.has('dark')&&!classes.has('theme-dark')&&!classes.has('theme-coral'));
assert.equal(root.dataset.pcSkin,undefined);
assert.equal(root.dataset.merchantTenant,'1');
for(const path of ['/ai/stores','/ai/geo#diagnose','/t/2/ai/assets?tab=images','/ai/tools/aigc_image'])assert.equal(api.isMerchantWhite(path),true,path);
for(const path of ['/ai/short-drama','/app/aigc_short_drama','/app/aigc_canvas'])assert.equal(api.isMerchantWhite(path),false,path);
api.apply('/app/aigc_canvas');assert.equal(root.dataset.merchantWhite,undefined);assert.equal(root.style.colorScheme,'dark','excluded apps retain the previous browser color scheme');
root.dataset.pcTheme='dark';root.dataset.pcMode='dark';api.apply('/ai');assert.equal(root.dataset.pcTheme,'light','returning to the merchant portal restores its only theme');
assert.equal(root.dataset.pcMode,'light','returning also restores the light mode setting');
const excluded=boot({white:true,tenantId:1},'/app/aigc_canvas');assert.equal(excluded.root.style.colorScheme,'dark');assert.ok(excluded.classes.has('theme-dark'));
assert.equal(boot({white:false}).api,undefined,'white bootstrap only runs with the server flag');
assert.equal(boot({white:true,tenantId:'untrusted'}).root.dataset.merchantTenant,undefined,'tenant identity must be a positive integer');
assert.ok(Object.isFrozen(api));
console.log('Merchant appearance: 23 white-theme, excluded-app and tenant checks passed.');
