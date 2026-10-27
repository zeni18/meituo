const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const entry = fs.readFileSync('public/_nuxt/entry.ef871ac3.js', 'utf8');

(async () => {
  for (const name of ['merchant-geo', 'merchant-automation']) {
    const start = entry.indexOf('{name:"' + name + '",');
    assert.ok(start >= 0, name + ' route exists');
    const componentStart = entry.indexOf('component:', start) + 'component:'.length;
    let expression = entry.slice(componentStart, entry.indexOf('},', componentStart));
    expression = expression.replace(/import\("\/merchant\/page\.js\?v=[^"]+"\)/, 'loadModule()')
      .replaceAll('import.meta.url', '"http://localhost:8090/_nuxt/entry.ef871ac3.js"');
    let releaseStyles, imports = 0, dependencies = [];
    const stylesReady = new Promise(resolve => { releaseStyles = resolve; });
    const componentReady = vm.runInNewContext('(' + expression + ')()', {
      loadModule() { imports++; return Promise.resolve({default: 'merchant-shell'}); },
      ae(load, deps) { dependencies = Array.from(deps); return stylesReady.then(load); },
    });
    assert.equal(imports, 0, name + ' must wait for layout styles before importing its view');
    for (const stylesheet of ['useAiPcHomeDecorate.3ba8ddd2.css', 'ImagineIcon.bcab7711.css']) {
      assert.ok(dependencies.includes('./' + stylesheet), name + ' declares ' + stylesheet);
    }
    for (const path of dependencies) assert.ok(fs.existsSync('public/_nuxt/' + path.replace(/^\.\//, '')));
    releaseStyles();
    assert.equal(await componentReady, 'merchant-shell');
    assert.equal(imports, 1, name + ' imports once after CSS is ready');
  }
  console.log('Merchant shell: GEO and automation wait for native layout and icon CSS before mounting.');
})().catch(error => { console.error(error); process.exitCode = 1; });
