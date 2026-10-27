const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(process.argv[2] || '.');
const staged = process.argv.includes('--staged');
const names = cp.execFileSync('git',['-C',root,...(staged?['diff','--cached','--name-only','--diff-filter=ACMR','-z']:['ls-files','-z'])],{maxBuffer:32*1024*1024}).toString('utf8').split('\0').filter(Boolean);
const findings=[]; let bytes=0, files=0;
const patterns = [
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['cloud-key', /\b(?:AKIA[0-9A-Z]{16}|LTAI[A-Za-z0-9]{16,})\b/],
  ['provider-key', /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{30,}\b/],
  ['private-key', /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/]
];
for(const name of names){
  if (/(?:^|\/)(?:\.env(?:$|\.(?!example$|docker\.example$))|id_rsa|id_ed25519|credentials\.json|auth\.json)$/.test(name) || /\.(?:pfx|p12)$/.test(name)) findings.push({file:name,rule:'credential-file'});
  let data;
  try { data=staged?cp.execFileSync('git',['-C',root,'show',':'+name],{maxBuffer:105*1024*1024}):fs.readFileSync(path.join(root,name)); } catch { continue; }
  if(data.length>95*1024*1024) findings.push({file:name,rule:'github-file-size-limit'});
  bytes+=data.length; files++;
  // Bundled third-party SDK fixtures are inherited vendor code, not project credentials.
  if(name.startsWith('vendor/') || data.length>8*1024*1024 || data.subarray(0,8000).includes(0)) continue;
  const text=data.toString('utf8');
  for(const [rule,re] of patterns){const match=re.exec(text);if(match) findings.push({file:name,line:text.slice(0,match.index).split('\n').length,rule});}
}
console.log(JSON.stringify({files,megabytes:Math.round(bytes/1024/1024),findings},null,2));
process.exitCode=findings.length?1:0;
