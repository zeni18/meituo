/* Presentation only. Native authentication, sessions and form submission remain in their original modules. */
(() => {
  const preferenceKey = 'system-login-theme';
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  let currentRoot = null;
  const configCache = new Map();
  const configRequests = new Set();
  const text = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };
  const safeUrl = value => {
    if (typeof value !== 'string' || !value.trim()) return '';
    try { const url = new URL(value, location.origin); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
  };
  function theme(root) {
    let preferred;
    try { preferred = localStorage.getItem(preferenceKey); } catch { /* Storage is optional. */ }
    const dark = preferred === 'dark' || (preferred !== 'light' && (document.documentElement.classList.contains('dark') || systemDark.matches));
    root.dataset.loginTheme = dark ? 'dark' : 'light';
    const button = root.querySelector('.system-login-theme');
    if (button) {
      button.setAttribute('aria-label', dark ? '切换为浅色模式' : '切换为深色模式');
      button.setAttribute('title', dark ? '切换为浅色模式' : '切换为深色模式');
      text(button.querySelector('span'), dark ? '浅色模式' : '深色模式');
    }
  }
  function themeButton(root) {
    if (root.querySelector('.system-login-theme')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'system-login-theme';
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 13.3A9 9 0 0 1 10.7 3.3a9 9 0 1 0 10 10Z"/></svg><span></span>';
    button.addEventListener('click', () => {
      const value = root.dataset.loginTheme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(preferenceKey, value); } catch { /* The current page can still switch. */ }
      root.dataset.loginTheme = value;
      button.setAttribute('aria-label', value === 'dark' ? '切换为浅色模式' : '切换为深色模式');
      button.title = button.getAttribute('aria-label');
      text(button.querySelector('span'), value === 'dark' ? '浅色模式' : '深色模式');
    });
    root.append(button); theme(root);
  }
  function branding(root, config) {
    const title = root.querySelector('.login-form > div:first-child')?.textContent.trim() || '管理工作台';
    text(root.querySelector('[data-login-brand]'), config?.web_name || title);
    const logo = root.querySelector('[data-login-logo]');
    const url = safeUrl(config?.web_logo || config?.web_logo_light);
    if (logo && url && logo.src !== url) { logo.src = url; logo.hidden = false; }
    if (logo && !url) { logo.hidden = true; logo.removeAttribute('src'); }
    const image = safeUrl(config?.login_image);
    const art = root.querySelector('.system-login-art');
    const custom = image && !/\/resource\/image\/(?:tenantapi|platformapi)\/default\/login_image\.png(?:\?|$)/.test(image);
    if (art && custom && art.src !== image) { art.src = image; art.classList.add('system-login-art--custom'); }
    if (art && !custom && !art.src.endsWith('/shared/login-workspace.svg')) { art.src = '/shared/login-workspace.svg'; art.classList.remove('system-login-art--custom'); }
  }
  function mountManagement(root) {
    const form = root.querySelector('.login-form');
    if (!form) return;
    if (!root.classList.contains('system-login')) {
      root.classList.add('system-login');
      const platform = /\/(?:platform)(?:\/|$)/.test(location.pathname);
      root.dataset.loginKind = platform ? 'platform' : 'oem';
      root.querySelector(':scope > div').classList.add('system-login-main');
      const story = document.createElement('aside'); story.className = 'system-login-story';
      story.innerHTML = '<div class="system-login-brand"><img data-login-logo hidden alt="" width="36" height="36"><span data-login-brand></span></div><div class="system-login-welcome"><h1>让每一份创意，<br>成为生意的增长力。</h1><p>连接 AI 创作、内容管理与品牌营销，<br>让业务管理更简单。</p></div><img class="system-login-art" src="/shared/login-workspace.svg" alt="" width="480" height="400">';
      root.prepend(story);
      story.querySelector('[data-login-logo]').addEventListener('error', event => { event.currentTarget.hidden = true; });
      story.querySelector('.system-login-art').addEventListener('error', event => {
        const art = event.currentTarget;
        if (!art.src.endsWith('/shared/login-workspace.svg')) { art.src = '/shared/login-workspace.svg'; art.classList.remove('system-login-art--custom'); }
      });
      const title = form.querySelector(':scope > div');
      title.setAttribute('role','heading'); title.setAttribute('aria-level','1');
      const intro = document.createElement('p'); intro.className = 'system-login-intro';
      intro.textContent = platform ? '登录平台账号，管理你的业务' : 'OEM 与代理使用各自账号登录';
      title.after(intro);
      form.querySelectorAll('.el-form-item').forEach((item,index) => {
        const input = item.querySelector('input'); if (!input) return;
        input.autocomplete = index === 0 ? 'username' : 'current-password';
        if (!input.id) input.id = `system-login-field-${index}`;
        const label = document.createElement('label'); label.className = 'system-login-field-label';
        label.htmlFor = input.id; label.textContent = index === 0 ? '登录账号' : '登录密码';
        item.prepend(label);
      });
      const help = document.createElement('p'); help.className = 'account-help';
      help.textContent = '请使用已开通的账号登录，无法登录请联系管理员。';
      form.append(help);
      themeButton(root);
    }
    const prefix = root.dataset.loginKind === 'platform' ? 'platformapi' : 'tenantapi';
    const params = new URLSearchParams(location.search);
    const tenant = params.get('tenant_id') || params.get('tenantId') || location.pathname.match(/^\/t\/(\d+)/)?.[1] || '';
    const context = /^\d+$/.test(tenant) ? `?tenant_id=${tenant}` : '';
    const configKey = prefix + context;
    root.dataset.loginContext = configKey;
    branding(root, configCache.get(configKey));
    if (!configRequests.has(configKey)) {
      configRequests.add(configKey);
      // Public presentation only; never reads credentials or tokens.
      fetch(`/${prefix}/config/getConfig${context}`, {credentials:'same-origin',cache:'no-store'})
        .then(response => response.json()).then(result => {
          if (result.code === 1) {
            configCache.set(configKey, result.data);
            if (root.isConnected && root.dataset.loginContext === configKey) branding(root, result.data);
          }
        }).catch(() => {});
    }
  }
  function refresh() {
    const merchant = document.querySelector('body[data-page="login"] .system-login');
    const management = document.querySelector('#app .login:has(.login-card)');
    currentRoot = merchant || management;
    if (!currentRoot) return;
    if (merchant) themeButton(merchant); else mountManagement(management);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, {once:true}); else refresh();
  if (/\/(?:admin|platform)(?:\/|$)/.test(location.pathname)) {
    new MutationObserver(refresh).observe(document.getElementById('app') || document.body, {childList:true,subtree:true});
  }
  systemDark.addEventListener('change', () => { if (currentRoot?.isConnected) theme(currentRoot); });
  window.addEventListener('popstate', refresh);
  window.addEventListener('storage', event => { if (event.key === preferenceKey && currentRoot?.isConnected) theme(currentRoot); });
})();
