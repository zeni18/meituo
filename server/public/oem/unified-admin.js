/* Use the original admin login and shell for OEM and both agent roles. */
(() => {
  const token=()=>{try{return JSON.parse(localStorage.getItem('__like_admin_saas_tenant__token')||'null')?.value||'';}catch{return '';}};
  let redirecting=false;
  function check(){
    if(redirecting||!token().startsWith('agent_'))return;
    document.querySelectorAll('[role="menu"] [role="menuitem"]').forEach(item=>{
      if(['个人设置','清除缓存'].includes(item.textContent.trim()))(item.closest('a')||item).style.display='none';
    });
    const path=location.pathname.replace(/\/+$/,'');
    if(path!=='/admin/login'&&path!=='/admin/consumer/lists'&&path!=='/admin/oem/agents'&&!/^\/admin\/(?:agent-workbench|agent-orders|integration\/config|geo\/(?:config|jobs)|media\/press\/(?:orders|usage)|agent-services\/(?:packages|apps)|agent-power\/(?:recharge|ledger|quota))$/.test(path)){
      redirecting=true;location.replace('/admin/agent-workbench'+location.search);
    }
  }
  const observer=new MutationObserver(check);observer.observe(document.documentElement,{subtree:true,childList:true});window.addEventListener('popstate',check);check();
})();
