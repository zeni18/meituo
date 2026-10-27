const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// Execute the shipped filter, so uploads cannot silently disappear from All again.
const source=fs.readFileSync('public/_nuxt/assets-panel.42b865e7.js','utf8');
const start=source.indexOf('function $t(h,k)'),end=source.indexOf('const ye=',start);
assert.ok(start>0&&end>start,'shipped asset filtering is available');
const context={wt:r=>['image','video','avatar'].includes(r.category)};
vm.runInNewContext(source.slice(start,end)+';this.filterAssets=$t;',context);
const items=[
 {id:'generated',source:'image',category:'image',title:'生成图片',timestamp:2},
 {id:'local',source:'upload',localUpload:true,category:'video',title:'上传视频',timestamp:1},
 {id:'deleted',source:'image',category:'image',title:'已回收',timestamp:3,trashedAt:4},
 {id:'hidden',source:'upload',category:'image',title:'已移除',timestamp:5,hiddenAt:5},
];
const state={section:'all',search:'',from:'',to:'',tools:[],models:[],ratios:[],labels:[]};
const ids=patch=>Array.from(context.filterAssets(items,{...state,...patch}),x=>x.id);
assert.deepEqual(ids({}),['generated','local'],'All includes generated media and local uploads');
assert.deepEqual(ids({section:'uploads'}),['local'],'Uploads remains a narrower view');
assert.deepEqual(ids({section:'trash'}),['deleted'],'recycled media stays in Trash');
assert.deepEqual(ids({search:'上传'}),['local'],'search also finds uploads in All');
assert.deepEqual(ids({section:'favorites'}),[],'favorites continue to require an explicit favorite');
console.log('All assets: uploads, generated results, trash isolation, search and favorites passed.');
