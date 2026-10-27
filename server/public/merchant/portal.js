const params = new URLSearchParams(location.search);
const tenant = params.get('tenant_id') || params.get('tenantId') || location.pathname.match(/^\/t\/(\d+)/)?.[1] || '';
const context = tenant && /^\d+$/.test(tenant) ? `?tenant_id=${tenant}` : '';
const $ = (selector) => document.querySelector(selector);
async function api(path, body) {
  const response = await fetch(`/api/merchant/${path}${context}`, {credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});
  const result = await response.json();
  if (result.code !== 1) { const error = new Error(result.msg || '请求失败，请稍后重试'); error.code=result.code; throw error; }
  return result.data;
}
async function branding() {
  try {
    const data=await api('config');
    if(typeof data.name==='string'&&data.name.trim()) {
      document.querySelectorAll('[data-brand-name]').forEach(node=>{node.textContent=data.name;});
      if(document.body.dataset.page==='login') document.title=`登录 · ${data.name}`;
    }
    if(data.logo) document.querySelectorAll('[data-brand-logo]').forEach(img=>{ const url=new URL(data.logo,location.origin); if(['http:','https:'].includes(url.protocol)) img.src=url.href; });
    const items=data.copyright?.items || [];
    if(Array.isArray(data.copyright?.items)) document.querySelectorAll('[data-copyright]').forEach(node=>{node.textContent=items.map(item=>item.key||item.text||'').filter(Boolean).join(' · ');});
  } catch { /* Built-in attribution remains visible when config is unavailable. */ }
}
branding();
if(document.body.dataset.page==='login') {
  localStorage.removeItem('token');
  const form=$('#login-form'), button=form.querySelector('[type=submit]');
  $('#password-toggle').addEventListener('click',()=>{const input=$('#password');input.type=input.type==='password'?'text':'password';$('#password-toggle').textContent=input.type==='password'?'显示':'隐藏';$('#password-toggle').setAttribute('aria-label',input.type==='password'?'显示密码':'隐藏密码');});
  form.addEventListener('submit',async event=>{
    event.preventDefault();$('#login-error').textContent='';button.disabled=true;button.textContent='正在登录…';
    try {
      const result=await api('login',{account:$('#account').value.trim(),password:$('#password').value,scene:1,terminal:4,redirect:params.get('redirect')||'/ai'});
      localStorage.setItem('token',result.token);localStorage.setItem('tenant_id',String(result.tenant_id));
      const target=new URL(result.redirect,location.origin);if(target.origin!==location.origin) throw new Error('登录跳转地址无效');
      if(context) target.searchParams.set('tenant_id',tenant);
      location.replace(target.pathname+target.search);
    } catch(error) {$('#login-error').textContent=error.message;$('#password').focus();button.disabled=false;button.textContent=button.dataset.idleLabel||'登录工作台';}
  });
}
