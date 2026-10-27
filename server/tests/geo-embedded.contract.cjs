const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('../frontend/geo-semi/node_modules/typescript');
const source=fs.readFileSync('frontend/geo-semi/src/navigation.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const scope={exports:{}};vm.runInNewContext(js,scope);const n=scope.exports;
assert.equal(n.mainGroups.length,5,'independent keyword library joins the existing GEO destinations');
assert.deepEqual(Array.from(n.mainGroups,g=>g.title),['GEO诊断','自动化计划','媒体发布','拓词库','AI创作']);
const pages=[...n.mainGroups.flatMap(g=>g.tabs.map(t=>t[0])),'diagnostic-reports'];
for(const s of n.sections)for(const g of s.groups)for(const [key]of g.items){
 if(key==='brand')continue;
 assert.ok(pages.includes(n.baseFor(key)),`legacy route ${key} retains a parent page`);
}
assert.equal(n.baseFor('create','optimize'),'articles','removed optimization page falls back to the current article page');
assert.equal(n.baseFor('ai-keywords','questions'),'keywords','old expansion links open the brand word-list library');
assert.equal(n.baseFor('create','questions'),'articles','old write-from-word-list links open the writing studio');
assert.equal(n.baseFor('create','untrusted-return'),'articles','unknown return target falls back to a real content page');
assert.equal(n.baseFor('writing-jobs'),'jobs','old writing-task links open unified task billing');
for(const key of ['create','replicate','batch-replicate','instructions','categories','influencer-favorites','contacts','sites','accounts'])assert.equal(n.isTool(key),true,`${key} is a contextual dialog`);
for(const key of ['keywords','keyword-library','questions','manual-keywords','ai-keywords']){assert.equal(n.isTool(key),false);assert.equal(n.baseFor(key),'keywords');}
assert.equal(n.groupFor('diagnostic-reports').key,'diagnose','diagnosis reports remain in the diagnosis destination');
assert.equal(n.isTool('website-favorites'),false,'media favorites is now a full publishing tab');
assert.equal(n.groupFor(n.normalized('influencer-orders')).key,'website','orders remain inside media publishing');
assert.equal(n.groupFor('overview').key,'diagnose','old overview remains available under diagnosis');
assert.equal(n.groupFor('reports').key,'diagnose','effect reports remain available under diagnosis');
assert.equal(n.groupFor('jobs').key,'articles','AI tasks remain available under creation');
console.log('Embedded GEO: legacy destinations, contextual tools and project return checks passed.');
