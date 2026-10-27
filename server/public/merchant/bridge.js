/* Compatibility bridge for the original AI client, kept outside compiled assets. */
(() => {
  const cookieToken=()=>decodeURIComponent(document.cookie.split('; ').find(item=>item.startsWith('token='))?.slice(6)||'');
  const token=cookieToken();if(token)localStorage.setItem('token',token);
  const params=new URLSearchParams(location.search);const tenant=params.get('tenant_id')||params.get('tenantId')||'';
  const suffix=tenant&&/^\d+$/.test(tenant)?`?tenant_id=${tenant}`:'';
  let leaving=false;
  const check=async()=>{if(leaving)return;if(!cookieToken()||!localStorage.getItem('token')){leaving=true;try{await fetch('/api/merchant/logout'+suffix,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});}catch{}location.replace('/login'+suffix);}};
  async function verify(){try{const response=await fetch('/api/merchant/check'+suffix,{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(data.code===-1&&!leaving){leaving=true;localStorage.removeItem('token');location.replace('/login'+suffix);}else if(data.code===1){document.documentElement.style.visibility='visible';}}catch{}}
  window.addEventListener('pagehide',()=>{document.documentElement.style.visibility='hidden';});
  window.addEventListener('pageshow',verify);window.addEventListener('storage',check);setInterval(check,1000);setInterval(verify,30000);
})();
