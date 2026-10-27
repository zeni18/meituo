/* Run against a source directory; output is an explicit staging directory by default.
   No network, databases, account data, or source files are touched. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const VERSION = 'mw20261023d';
const {patchNavigationLoad}=require('./patch-navigation-load.cjs');
const LEGACY_MARKER = '/* merchant-white-theme-v1 */';
const MARKER = '/* merchant-white-theme-v2 */';
const GATE = MARKER + '\nfunction mwWhite(path){return typeof globalThis.isMerchantWhite==="function"&&globalThis.isMerchantWhite(path)===true}\n';
const names = ['entry.ef871ac3.js', 'useAiPcHomeDecorate.d01e3f4e.js', 'preferences.c317aa55.js', 'info.1b8b5679.js'];
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const count = (text, needle) => text.split(needle).length - 1;
function once(source, before, after, label, checks) {
  assert.equal(count(source, before), 1, label + ': expected exactly one source match');
  checks.push(label);
  return source.replace(before, after);
}
function between(source, begin, end, transform, label, checks) {
  assert.equal(count(source, begin), 1, label + ': unique start');
  assert.equal(count(source, end), 1, label + ': unique end');
  const start = source.indexOf(begin), finish = source.indexOf(end, start);
  assert.ok(finish > start, label + ': ordered boundaries');
  const old = source.slice(start, finish), changed = transform(old);
  return once(source, old, changed, label, checks);
}
function patchEntry(source, checks) {
  let s = source;
  const rep = (before, after, label) => { s = once(s, before, after, label, checks); };
  rep('n=H(()=>eU(e.getWebsiteConfig.pc_home_style,t.query.home_style,!1))', 'n=H(()=>mwWhite(t.path)?"imagine":eU(e.getWebsiteConfig.pc_home_style,t.query.home_style,!1))', 'merchant workspace style');
  s = between(s, 'function ZF(){', 'function eU(e,t,n=!1)', old => {
    let part = old;
    const sub = (before, after, label) => { part = once(part, before, after, label, checks); };
    sub('async function g(){var K,P;', 'async function g(){if(mwWhite(u.path)){++l.value;r.value=!0;o.value="";return}var K,P;', 'appearance load disabled for merchants / stale loads invalidated');
    sub('async function v(S){if(a.value||!r.value)', 'async function v(S){if(mwWhite(u.path))return!1;if(a.value||!r.value)', 'appearance writes disabled for merchants');
    sub('y=H(()=>KF(e.value))', 'y=H(()=>mwWhite(u.path)?{supportedModes:["light"],defaultMode:"light"}:KF(e.value))', 'appearance capability is light only');
    sub('return{preferences:e,modeCapability:y,', 'return{preferences:H(()=>mwWhite(u.path)?{selected:"default",mode:"light",custom:[],preset_backgrounds:[]}:e.value),modeCapability:y,', 'merchant appearance is classic and has no backgrounds');
    return part;
  }, 'appearance service scoped patch', checks);
  s = between(s, 'const tU=yt({name:"pc-skin",', ',nU="pc:theme"', () => String.raw`const tU=yt({name:"pc-skin",setup(){
const e=_t(),t=tt(),{workspaceStyle:n}=bl(),r=ZF(),a=Qe("pc-appearance-theme",()=>null),o=window.matchMedia("(prefers-color-scheme: dark)"),s=X(o.matches),white=H(()=>mwWhite(e.path));
let l={},listening=!1;
const i=()=>{s.value=o.matches},u=()=>{!white.value&&!r.busy.value&&!r.preview.value&&!r.presetPreview.value&&r.load()},storage=event=>{if(white.value||document.documentElement.dataset.pcDesign!=="imagine"||event.storageArea!==window.localStorage)return;const scope=String(Jt(e)||t.userInfo.tenant_id||"0")+":"+(t.isLogin&&t.userInfo.id?t.userInfo.id:"guest");if(event.key==="pc:appearance:v1:"+scope)u()};
_e(white,on=>{globalThis.MerchantWhiteTheme?.apply(e.path);if(on&&listening){o.removeEventListener("change",i);window.removeEventListener("focus",u);window.removeEventListener("storage",storage);listening=!1}else if(!on&&!listening){i();o.addEventListener("change",i);window.addEventListener("focus",u);window.addEventListener("storage",storage);listening=!0}},{immediate:!0,flush:"sync"});
const c=H(()=>{var h;return Au(e.path,n.value,!1,((h=e.meta)==null?void 0:h.officialSite)===!0)});
_e([r.preferences,r.preview,r.presetPreview,c,s,white],()=>{const h=document.documentElement,p=(y,skin)=>{for(const key of Object.keys(l))key in y||h.style.removeProperty(key);for(const[key,value]of Object.entries(y))l[key]!==value&&h.style.setProperty(key,value);l=y,skin?h.dataset.pcSkin=skin:delete h.dataset.pcSkin};if(white.value){a.value="light";p(GF("light"));return}if(!c.value){p({}),a.value=null;return}const f=r.preferences.value,g=r.preview.value||(r.presetPreview.value?void 0:f.custom.find(y=>y.id===f.selected)),v=J0.find(y=>{var _;return y.id===(((_=r.presetPreview.value)==null?void 0:_.preset_id)||f.selected)});if(a.value=(g==null?void 0:g.mode)||(v==null?void 0:v.mode)||(f.mode==="system"?s.value?"dark":"light":f.mode),!g&&!v){p(GF(a.value));return}const w=g?XF(g):v.tokens;p(w,g?"custom":v.id)},{immediate:!0,deep:!0,flush:"sync"});
_e(()=>[white.value,String(Jt(e)||t.userInfo.tenant_id||"0")+":"+(t.token?"signed":"guest")+":"+(t.userInfo.id||"")],()=>r.load(),{immediate:!0,flush:"sync"})}})`, 'pc-skin lifecycle replaces legacy focus/storage listener', checks);
  rep('zh=e=>{if(typeof document>"u")return;const t=document.documentElement;', 'zh=e=>{if(typeof document>"u")return;globalThis.MerchantWhiteTheme?.apply();if(mwWhite())e="light";const t=document.documentElement;', 'native theme writer honors merchant gate');
  s = between(s, 'Q0=()=>{', ',rU=yt(', old => {
    let part = old;
    const sub = (before, after, label) => { part = once(part, before, after, label, checks); };
    sub('i=H(()=>e8[r.value])', 'i=H(()=>mwWhite(n.path)?{supportedModes:["light"],defaultMode:"light"}:e8[r.value])', 'native supported modes');
    sub('h=H(()=>a.value[c.value]||u.value)', 'h=H(()=>mwWhite(n.path)?"light":a.value[c.value]||u.value)', 'native theme preference');
    sub('p=H(()=>s.value||$F(', 'p=H(()=>mwWhite(n.path)?"light":s.value||$F(', 'native resolved color mode');
    sub('w=()=>{var z;if(typeof window>"u"', 'w=()=>{if(mwWhite(n.path)){zh("light");return}var z;if(typeof window>"u"', 'skip legacy stored theme initialization');
    sub('setTheme:_=>{var z,E;', 'setTheme:_=>{if(mwWhite(n.path))return;var z,E;', 'skip merchant theme mutations');
    return part;
  }, 'native theme composable scoped patch', checks);
  s = between(s, 'rU=yt(()=>{', ',D1="aigc_short_drama:theme"', () => String.raw`rU=yt(()=>{const{theme:e,identityKey:t,systemDark:n,initializeTheme:r}=Q0(),route=_t(),a=window.matchMedia("(prefers-color-scheme: dark)");let listening=!1;const o=()=>{n.value=a.matches};_e(()=>mwWhite(route.path),white=>{if(white){if(listening)a.removeEventListener("change",o);listening=!1}else{if(!listening)a.addEventListener("change",o);listening=!0;o()}globalThis.MerchantWhiteTheme?.apply(route.path);r()},{immediate:!0,flush:"sync"}),_e(t,r,{immediate:!0,flush:"sync"}),_e(e,zh,{immediate:!0,flush:"sync"})})`, 'system mode listener scoped lifecycle', checks);
  return GATE + s;
}
function patchHome(source, checks) {
  let s = source;
  const rep = (before, after, label) => { s = once(s, before, after, label, checks); };
  rep('setup(t,{emit:o}){const{preferences:e,ready:l,busy:s,error:g,load:C,select:T,selectMode:L,removeCustom:P}=Pt()', 'setup(t,{emit:o}){if(mwWhite())return()=>null;const{preferences:e,ready:l,busy:s,error:g,load:C,select:T,selectMode:L,removeCustom:P}=Pt()', 'do not initialize appearance panel');
  rep('setup(t,{emit:o}){const e=t,{preview:l,presetPreview:s,savePresetBackground:g,saveCustom:C,removeCustom:T,busy:L,ready:P,error:H,load:B,preferences:b}=Pt()', 'setup(t,{emit:o}){if(mwWhite())return()=>null;const e=t,{preview:l,presetPreview:s,savePresetBackground:g,saveCustom:C,removeCustom:T,busy:L,ready:P,error:H,load:B,preferences:b}=Pt()', 'do not initialize skin editor');
  rep('__name:"HomeStarsBackdrop",props:{light:{type:Boolean}},setup(t){const o=U()', '__name:"HomeStarsBackdrop",props:{light:{type:Boolean}},setup(t){if(mwWhite())return()=>null;const o=U()', 'do not initialize stars / RAF / pointer listeners');
  rep('__name:"PresetSkinEffects",props:{skinId:{}},setup(t){const o=t', '__name:"PresetSkinEffects",props:{skinId:{}},setup(t){if(mwWhite())return()=>null;const o=t', 'do not initialize skin particles');
  rep('if(!wa(w.path))return"";', 'if(mwWhite(w.path)||!wa(w.path))return"";', 'do not resolve merchant skin background URLs');
  rep('!i.$slots.page&&!ft.value?(n(),de(Lr,', '!mwWhite()&&!i.$slots.page&&!ft.value?(n(),de(Lr,', 'do not render stars');
  rep('ft.value?(n(),c("div",ml,', '!mwWhite()&&ft.value?(n(),c("div",ml,', 'do not render skin image/effects');
  // Wrap the complete native appearance popover; its trigger and flyout never enter the VDOM.
  s = between(s, '$(D,{visible:T.value,"onUpdate:visible":r[12]', ',a("button",{onClick:r[15]', old => 'mwWhite()?N("",!0):' + old, 'remove desktop account appearance entry and popover', checks);
  rep('async function u(f){var Z;T.value=f==="appearance"', 'async function u(f){if(mwWhite()&&f==="appearance")return;var Z;T.value=f==="appearance"', 'block account appearance keyboard transition');
  rep('async function se(f){C.value=f,', 'async function se(f){if(mwWhite()&&f==="appearance")return;C.value=f,', 'block account mobile appearance transition');
  rep('C.value==="appearance"?(n(),c(J,{key:0}', '!mwWhite()&&C.value==="appearance"?(n(),c(J,{key:0}', 'remove mobile account appearance content');
  rep('X.value==="appearance"?(n(),c(J,', '!mwWhite()&&X.value==="appearance"?(n(),c(J,', 'remove legacy home appearance content');
  return GATE + s;
}
function patchPreferences(source, checks) {
  let s = source;
  s = once(s, '"page-desc":s("选择语言、主题与皮肤。")', '"page-desc":mwWhite()?"":s("选择语言、主题与皮肤。")', 'preferences description', checks);
  s = between(s, 'i("section",D,[a(t)?', ']),_:1},8,["page-title","page-desc"]', old => 'mwWhite()?null:' + old, 'preferences: no appearance section', checks);
  return GATE + s;
}
function patchInfo(source, checks) {
  let s = source;
  s = between(s, 's("div",Pe,[s("span",null,n(l("主题"))', ']),u(y,{to:e(I)}', old => 'mwWhite()?null:' + old, 'profile: no theme selector', checks);
  s = once(s, 'u(y,{to:e(I)},{default:m(()=>[V(n(l("管理主题与皮肤")),1)]),_:1},8,["to"])', 'mwWhite()?null:u(y,{to:e(I)},{default:m(()=>[V(n(l("管理主题与皮肤")),1)]),_:1},8,["to"])', 'profile: no appearance link', checks);
  return GATE + s;
}
const transforms = [patchEntry, patchHome, patchPreferences, patchInfo];
function patchConditionalVNodes(source, name, checks) {
  if (!names.slice(2).includes(name)) return source;
  let s = once(source, 'import{g as ', 'import{v as mwComment,g as ', name + ': import native comment VNode', checks);
  if (name === names[2]) {
    s = between(s, 'mwWhite()?null:i("section",D,', ']),_:1},8,["page-title","page-desc"]', old =>
      'mwWhite()?mwComment("",!0):(l(),E(C,{key:"merchant-appearance"},[' + old.slice('mwWhite()?null:'.length) + '],64))',
      'preferences: comment and isolated conditional block', checks);
  } else {
    s = between(s, 'mwWhite()?null:s("div",Pe,', ']),mwWhite()?null:u(y,{to:e(I)}', old =>
      'mwWhite()?mwComment("",!0):(_(),h(R,{key:"merchant-theme"},[' + old.slice('mwWhite()?null:'.length) + '],64))',
      'profile theme: comment and isolated conditional block', checks);
    s = once(s, 'mwWhite()?null:u(y,{to:e(I)},{default:m(()=>[V(n(l("管理主题与皮肤")),1)]),_:1},8,["to"])',
      'mwWhite()?mwComment("",!0):(_(),h(R,{key:"merchant-theme-link"},[u(y,{to:e(I)},{default:m(()=>[V(n(l("管理主题与皮肤")),1)]),_:1},8,["to"])],64))',
      'profile link: comment and isolated conditional block', checks);
  }
  assert.ok(!s.includes('mwWhite()?null:'), name + ': no raw null VNode branches');
  return s;
}
function patchAll(inputs) {
  const outputs = {}, checks = [];
  names.forEach((name, index) => {
    const source = inputs[name];
    assert.equal(typeof source, 'string', name + ' source exists');
    if (source.includes(MARKER)) {
      assert.equal(count(source, MARKER), 1, name + ' has one patch marker');
      assert.equal(count(source, 'function mwWhite(path)'), 1, name + ' has one shared gate');
      outputs[name] = source;
      assert.ok(!source.includes('mwWhite()?null:'), name + ': installed v2 must not contain raw null VNodes');
      checks.push(name + ' already installed');
    } else if (source.includes(LEGACY_MARKER)) {
      assert.equal(count(source, LEGACY_MARKER), 1, name + ': one legacy marker');
      assert.equal(count(source, 'function mwWhite(path)'), 1, name + ': one legacy shared gate');
      outputs[name] = patchConditionalVNodes(once(source, LEGACY_MARKER, MARKER, name + ': migrate v1 marker', checks), name, checks);
    } else outputs[name] = patchConditionalVNodes(transforms[index](source, checks), name, checks);
  });
  names.forEach(name => { outputs[name]=patchNavigationLoad(outputs[name].replace(/\r\n/g,"\n"),name,checks).replace(/\n/g,"\r\n"); });
  // Do not alter the independent short-drama theme implementation.
  const sliceDrama = s => s.slice(s.indexOf('D1="aigc_short_drama:theme"'), s.indexOf('function sU()'));
  assert.equal(sliceDrama(outputs[names[0]]), sliceDrama(inputs[names[0]]), 'short-drama theme source remains byte-identical');
  return { outputs, checks };
}
function cacheVersion(source, moduleNames = names) {
  const escaped = moduleNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return source.replace(new RegExp('(' + escaped + ')(?:\\?v=[A-Za-z0-9_-]+)?(?=["\'`])', 'g'), '$1?v=' + VERSION);
}
function merchantPageReferences(source) {
  const matches=[...source.matchAll(/import\("\/merchant\/page\.js\?v=(20261015|mw20261023[a-d])"\)/g)];
  assert.equal(matches.length,14,'merchant page: all fourteen native imports');
  assert.equal(new Set(matches.map(m=>m[1])).size,1,'merchant page: no mixed versions');
  return source.replace(/import\("\/merchant\/page\.js\?v=(?:20261015|mw20261023[a-d])"\)/g,'import("/merchant/page.js?v='+VERSION+'")');
}
function merchantPageSource(source) {
  let result=source;
  for(const name of names.slice(0,2)) {
    const candidates=["from '/_nuxt/"+name+"';",...['a','b','c','d'].map(v=>"from '/_nuxt/"+name+"?v=mw20261023"+v+"';")];
    assert.equal(candidates.reduce((n,c)=>n+count(result,c),0),1,'merchant page: one static '+name);
    const found=candidates.find(c=>result.includes(c));
    result=result.replace(found,"from '/_nuxt/"+name+"?v="+VERSION+"';");
  }
  return result;
}
function run(sourceDir, outDir) {
  const sourcePath = path.resolve(sourceDir), outPath = path.resolve(outDir);
  assert.notEqual(sourcePath.toLowerCase(), outPath.toLowerCase(), 'output must be a separate staging directory');
  const inputs = Object.fromEntries(names.map(name => [name, fs.readFileSync(path.join(sourcePath, name), 'utf8')]));
  const result = patchAll(inputs);
  const compiled = path.join(outPath, 'compiled'), overlay = path.join(outPath, 'cache-overlay');
  const publicOverlay = path.join(outPath, 'public-overlay');
  fs.mkdirSync(compiled, { recursive: true }); fs.mkdirSync(overlay, { recursive: true });
  const manifest = { version: VERSION, marker: MARKER, inputs: {}, outputs: {}, replacements: result.checks, cacheOverlay: [], publicOverlay: [], htmlEntry: '/_nuxt/' + names[0] + '?v=' + VERSION, merchantPage: '/merchant/page.js?v=' + VERSION };
  for (const name of names) {
    fs.writeFileSync(path.join(compiled, name), result.outputs[name]);
    manifest.inputs[name] = sha(inputs[name]); manifest.outputs[name] = sha(result.outputs[name]);
  }
  // Stamp the complete module graph, including parents of patched chunks. Otherwise a cached parent
  // may still import the unversioned entry and instantiate a second Vue/Pinia runtime.
  const moduleNames = fs.readdirSync(sourcePath).filter(name => name.endsWith('.js'));
  manifest.moduleNames = moduleNames;
  for (const name of moduleNames) {
    const original = fs.readFileSync(path.join(sourcePath, name), 'utf8');
    let transformed = cacheVersion(result.outputs[name] || original, moduleNames);
    if (name === names[0]) transformed = merchantPageReferences(transformed);
    if (transformed !== original) {
      fs.writeFileSync(path.join(overlay, name), transformed);
      manifest.cacheOverlay.push({ name, sha256: sha(transformed) });
    }
  }
  // The merchant route adapter lives outside _nuxt but imports the same Vue runtime.
  // Version its own URL and both static dependencies as one indivisible cache graph.
  const merchantSource = fs.readFileSync(path.join(sourcePath, '..', 'merchant', 'page.js'), 'utf8');
  const merchantOutput = merchantPageSource(merchantSource);
  fs.mkdirSync(path.join(publicOverlay, 'merchant'), { recursive: true });
  fs.writeFileSync(path.join(publicOverlay, 'merchant', 'page.js'), merchantOutput);
  manifest.publicOverlay.push({ path: 'public/merchant/page.js', file: 'merchant/page.js', sha256: sha(merchantOutput) });
  fs.writeFileSync(path.join(outPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ output: outPath, replacements: result.checks.length, compiled: names.length, cacheOverlay: manifest.cacheOverlay.length, publicOverlay: manifest.publicOverlay.length, version: VERSION }));
  return manifest;
}
module.exports = { run, patchAll, cacheVersion, merchantPageReferences, merchantPageSource, names, VERSION, MARKER };
if (require.main === module) {
  const args = process.argv.slice(2), arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
  run(arg('--source', 'D:/meituo-dev/project/public/_nuxt'), arg('--out', path.join(__dirname, 'generated')));
}
