/* Merchant UI v2 — sidebar.
   Replaces the visible native + merchant menus with the approved 12-item structure.
   The original menus stay in the DOM (hidden) so existing scripts keep working;
   each visible item navigates directly to one canonical URL.
   Spec: docs/design/merchant-ui-v2.md */
(() => {
  'use strict';
  const ICON = {
    workbench: '<path fill-rule="evenodd" clip-rule="evenodd" d="M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5Zm0 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7Zm8 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V7Z"/>',
    tools: '<path d="M2 3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3Zm7.5 0a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V3ZM17 3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V3ZM2 10.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3Zm7.5 0a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3Zm8.5-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1ZM3 17h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Zm7.5 0h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Zm7.5 0h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"/>',
    image: '<path fill-rule="evenodd" clip-rule="evenodd" d="M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5Zm5 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm6.7 4.2a1 1 0 0 0-1.4 0L11 16l-1.3-1.3a1 1 0 0 0-1.4 0L5 18v1h14v-5l-2.3-2.3Z"/>',
    video: '<path fill-rule="evenodd" clip-rule="evenodd" d="M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5Zm4 5.87a1 1 0 0 1 1.55-.83l6.2 4.13a1 1 0 0 1 0 1.66l-6.2 4.13A1 1 0 0 1 9 16.13V7.87Z"/>',
    avatar: '<path fill-rule="evenodd" clip-rule="evenodd" d="M3 4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h11a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H3Zm4.98 4h-3v3h3V8Z"/><path d="M21.55 6.72a1 1 0 0 1 1.45.9v8.76a1 1 0 0 1-1.45.9l-4-2a1 1 0 0 1-.55-.9V9.62a1 1 0 0 1 .56-.9l4-2Z"/>',
    clip: '<path fill-rule="evenodd" clip-rule="evenodd" d="M13.29 20.09 12 17.86l-1.3 2.25C10 21.5 8.42 23 6.5 23a4.5 4.5 0 1 1 2.62-8.16l.57-.98L6 6.46a4 4 0 0 1 .65-4.84c.4-.4 1.03-.2 1.3.29l6.93 12.93A4.5 4.5 0 1 1 17.5 23c-1.93 0-3.5-1.5-4.21-2.91ZM6.5 17a1.5 1.5 0 0 1 1.19 2.42A1.5 1.5 0 1 1 6.5 17Zm9.93 2.55A1.5 1.5 0 0 0 19 18.5a1.5 1.5 0 1 0-2.57 1.05ZM12 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/><path d="M15.37 12.03 18 6.46a4 4 0 0 0-.62-4.81c-.4-.41-1.06-.21-1.31.3l-3.01 6.08 2.3 4Z"/>',
    materials: '<path d="M5 2a3 3 0 0 0-3 3v3h20c0-2-1-4-3-4h-6.45a3 3 0 0 1-1.87-.66l-1.13-.9A2 2 0 0 0 8.3 2H5Z"/><path d="M22 10H2v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-9Z"/>',
    works: '<path fill-rule="evenodd" clip-rule="evenodd" d="m21.21 15.05.26.14c.51.28.68.9.38 1.39-.1.15-.23.27-.38.36l-8.92 4.92c-.34.19-.76.19-1.1 0l-8.92-4.92a.98.98 0 0 1-.38-1.39c.1-.15.23-.27.38-.36l.26-.14 8.66 4.78c.32.17.72.18 1.05.02l.05-.02 8.66-4.78Zm0-4.07.26.14c.51.29.68.91.38 1.4-.1.14-.23.27-.38.36l-8.92 4.92c-.34.18-.76.18-1.1 0l-8.92-4.92a.98.98 0 0 1-.38-1.4c.1-.14.23-.27.38-.36l.26-.14 8.66 4.78c.32.18.72.19 1.05.03l.05-.03 8.66-4.78Zm-8.66-8.84 8.92 4.92c.51.28.68.9.38 1.39-.1.15-.23.27-.38.36l-8.92 4.92c-.34.19-.76.19-1.1 0L2.53 8.81a.98.98 0 0 1-.38-1.39c.1-.15.23-.27.38-.36l8.92-4.92c.34-.19.76-.19 1.1 0Z"/>',
    geo: '<path fill-rule="evenodd" clip-rule="evenodd" d="M1 12a11 11 0 1 1 22 0 11 11 0 0 1-22 0Zm11-8a8 8 0 0 0-8 8h4.71A4.29 4.29 0 0 1 13 16.29c0 .39-.32.71-.71.71H10c-.5 0-.91.5-.91 1.5S10 20 10.5 20H12a8 8 0 0 0 7.9-6.77c-.69.49-1.51.77-2.4.77a4.51 4.51 0 0 1-4.13-3H10c-.55 0-1.01-.45-.91-1 .51-2.81 2.41-4 4.78-3.95.19-.29.4-.55.64-.8.29-.27.24-.78-.14-.9A8 8 0 0 0 12 4Z"/>',
    store: '<path d="M18.2 16.88c.45-.05.64-.8.64-.8s.52-1.65-.04-7.13c-.56-5.47-1.57-6.94-1.57-6.94s-.36-.7-.8-.64c-.6.06-1.12.46-1.76 1.28-.65.82-2.45 3.13-6.23 3.56-.46.03-.92.1-1.37.15l-.68.08A2.93 2.93 0 0 0 3.86 8.7l-.16.01a1.95 1.95 0 1 0 .6 3.85 2.93 2.93 0 0 0 2.97 1.64l.68-.09c.46-.06.91-.11 1.37-.15a8.89 8.89 0 0 1 6.83 2.01c.82.73 1.22 1 2.04.91Z"/><path d="M22.88 8.49a2.93 2.93 0 0 1-1.64 2.97c-.48.23-.98-.17-1.04-.7 0 0-.04-.98-.16-1.96-.12-.97-.29-1.92-.29-1.92s.34-1.04.86-.92a2.93 2.93 0 0 1 2.27 2.53Z"/><path d="M12.03 19.57c-.19-.6-1.08-3.15-1.42-3.47-.32-.3-.71-.25-1.1-.2a8.7 8.7 0 0 1-.5.07c-.48.06-.9.12-1.52.17-.58.04-1.11.03-1.63-.1a52.44 52.44 0 0 0 3.26 5.12c.44.62 1.25.84 1.95.56.85-.34 1.3-1.04.96-2.15Z"/>',
    automation: '<path d="M2 5v14a3 3 0 0 0 3 3h7.1a7.02 7.02 0 0 1-1.43-2H6a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2.67c.75.36 1.43.85 2 1.43V5a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3Z"/><path d="M7 10a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H7Zm-1 6a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-1Zm7.5-5.06a1 1 0 0 0-1-.94h-1a1 1 0 0 0-1 1v1a1 1 0 0 0 .77.97 7.03 7.03 0 0 1 2.23-2.03Z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M22 17a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-4-2a1 1 0 1 0-2 0v2c0 .27.1.52.3.7l1.5 1.5a1 1 0 0 0 1.4-1.4L18 16.58V15Z"/>',
    brand: '<path d="M2 11.45a1 1 0 0 1 .33-.75l9-8.1a1 1 0 0 1 1.34 0l9 8.1a1 1 0 0 1 .33.75V20a2 2 0 0 1-2 2h-4a1 1 0 0 1-1-1v-4a3 3 0 0 0-6 0v4a1 1 0 0 1-1 1H4a2 2 0 0 1-2-2v-8.55Z"/>',
    pin: '<path d="M9.68 5.45c.22-1.1 1.8-1.1 2.02 0a8.79 8.79 0 0 0 6.85 6.85c1.1.22 1.1 1.8 0 2.02a8.79 8.79 0 0 0-6.85 6.85c-.22 1.1-1.8 1.1-2.02 0a8.79 8.79 0 0 0-6.85-6.85c-1.1-.22-1.1-1.8 0-2.02a8.79 8.79 0 0 0 6.85-6.85Zm8.48-3.85c.16-.8 1.31-.8 1.48 0a3.54 3.54 0 0 0 2.76 2.76c.8.17.8 1.32 0 1.48a3.54 3.54 0 0 0-2.76 2.76c-.17.8-1.32.8-1.48 0a3.54 3.54 0 0 0-2.76-2.76c-.8-.16-.8-1.31 0-1.48a3.54 3.54 0 0 0 2.76-2.76Z"/>',
    chevron: '<path fill-rule="evenodd" clip-rule="evenodd" d="M4.08 7.6a1.5 1.5 0 0 1 2.12 0l5.66 5.65 5.66-5.65a1.5 1.5 0 1 1 2.12 2.12l-6.72 6.72a1.5 1.5 0 0 1-2.12 0L4.08 9.72a1.5 1.5 0 0 1 0-2.12Z"/>'
  };
  const svg = (k, cls = 'nv2-icon') => '<svg class="' + cls + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + ICON[k] + '</svg>';

  const tenant = () => {
    const q = new URLSearchParams(location.search).get('tenant_id'), scoped = location.pathname.match(/^\/t\/(\d+)(?:\/|$)/)?.[1];
    if (q && /^\d+$/.test(q)) return q;
    if (scoped) return scoped;
    const inherited = window.UK?.tenant?.(); if (inherited && /^\d+$/.test(inherited)) return inherited;
    try { const saved = (localStorage.getItem('tenant_id') || '').replace(/"/g, ''); return /^\d+$/.test(saved) ? saved : ''; } catch (e) { return ''; }
  };
  const withTenant = (p) => {
    const url = new URL(p, location.href), t = tenant();
    if (url.origin !== location.origin) return url.href;
    if (t) url.searchParams.set('tenant_id', t);
    return url.pathname + url.search + url.hash;
  };
  const asideEl = () => document.querySelector('aside.ia-sidebar');
  const router = () => document.getElementById('__nuxt')?.__vue_app__?.config?.globalProperties?.$router;

  // Each item owns its canonical route; hidden native controls are never clicked.
  const GROUPS = [
    { items: [{ key: 'workbench', label: '工作台', icon: 'workbench', path: '/ai' }] },
    { title: '创作', items: [
      { key: 'tools', label: 'AI 工具', icon: 'tools', path: '/ai/tools' },
      { key: 'image', label: '图像创作', icon: 'image', path: '/ai/create?type=image' },
      { key: 'video', label: '视频创作', icon: 'video', path: '/ai/create?type=video' },
      { key: 'avatar', label: '数字人', icon: 'avatar', path: '/ai/avatar' },
      { key: 'clip', label: '视频剪辑', icon: 'clip', path: '/ai/video-editor' }
    ] },
    { title: '内容', items: [
      { key: 'materials', label: '素材库', icon: 'materials', path: '/ai/materials/video' },
      { key: 'works', label: '作品库', icon: 'works', path: '/ai/assets' }
    ] },
    { title: '营销', items: [
      { key: 'geo', label: 'GEO 营销', icon: 'geo', children: [
        { key: 'geo-diagnose', label: '诊断', path: '/ai/geo#diagnose', hash: 'diagnose' },
        { key: 'geo-articles', label: '内容', path: '/ai/geo#articles', hash: 'articles' },
        { key: 'geo-website', label: '发布', path: '/ai/geo#website', hash: 'website' },
        { key: 'geo-effect', label: '效果', path: '/ai/geo#effect', hash: 'effect' }
      ] },
      { key: 'store', label: '门店营销', icon: 'store', children: [
        { key: 'publish', label: '任务发布', path: '/ai/publish-tasks' }
      ] },
      { key: 'automation', label: '自动化计划', icon: 'automation', path: '/ai/automation' }
    ] },
    { title: '品牌', items: [
      { key: 'brand', label: '品牌与门店', icon: 'brand', path: '/ai/stores' }
    ] }
  ];

  function activeKey() {
    const p = location.pathname.replace(/^\/t\/\d+/, '').replace(/\/$/, '') || '/';
    const q = new URLSearchParams(location.search), h = location.hash.replace('#', '');
    if (p === '/ai' || p === '/') return 'workbench';
    if (p === '/ai/create') return q.get('type') === 'video' ? 'video' : 'image';
    if (p.startsWith('/ai/avatar')) return 'avatar';
    if (p.startsWith('/ai/video-editor') || p.startsWith('/ai/smart_clip')) return 'clip';
    if (p.startsWith('/ai/materials')) return 'materials';
    if (p.startsWith('/ai/assets') || p.startsWith('/ai/films')) return 'works';
    if (p.startsWith('/ai/geo')) {
      const k = h.split('?')[0];
      if (/^(effect|overview|reports|jobs|writing-jobs|keyword-index)/.test(k)) return 'geo-effect';
      if (/^(website|influencer|b2b|contacts|accounts|owned|sites|seo)/.test(k)) return 'geo-website';
      if (!k || /^(diagnose|diagnostic-reports|evidence|query|optimize)/.test(k)) return 'geo-diagnose';
      return 'geo-articles';
    }
    if (p === '/ai/media-press') return 'geo-website';
    if (p.startsWith('/ai/seedcards')) return 'seedcards';
    if (p.startsWith('/ai/publish-tasks')) return 'publish';
    if (p.startsWith('/ai/automation')) return 'automation';
    if (p.startsWith('/ai/stores')) return 'brand';
    if (p.startsWith('/ai/tools') || p.startsWith('/app/')) return 'tools';
    return '';
  }

  const store = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };
  const openKey = (k) => 'nv2-open-' + k;

  function navigate(path) {
    const url = withTenant(path), target = new URL(url, location.href);
    if (target.href === location.href) { update(); return; }
    // These hashes are views owned by GEO. Existing history wrappers notify them;
    // a synthetic popstate would also rebuild the native Nuxt route underneath.
    if (target.origin === location.origin && target.pathname === location.pathname && target.search === location.search &&
        target.pathname.replace(/^\/t\/\d+/, '').replace(/\/$/, '') === '/ai/geo') {
      if (window.UK?.setView) window.UK.setView(url);
      else history.replaceState({ ...(history.state || {}), current: url }, '', url);
      update(); return;
    }
    if (target.origin === location.origin && window.UK?.go) { window.UK.go(url); update(); return; }
    const r = router();
    if (target.origin === location.origin && r?.push) {
      Promise.resolve(r.push(url)).then(update).catch((e) => { console.warn('[nav-v2]', e); window.UK?.toast?.('页面打开失败，请重试', 'fail'); });
    } else location.assign(url);
  }
  function go(item, event) {
    if (event && (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
    if (event) { event.preventDefault(); event.stopPropagation(); }
    // Keep the selected brand while changing GEO sections.
    const path = item.hash && location.pathname.replace(/^\/t\/\d+/, '').replace(/\/$/, '') === '/ai/geo'
      ? location.pathname + location.search + '#' + item.hash : item.path;
    navigate(path);
  }

  function linkHtml(item, child) {
    return '<a class="nv2-link' + (child ? ' nv2-child' : '') + '" data-key="' + item.key + '" href="' + withTenant(item.path) + '" title="' + item.label + '">' +
      (child ? '<span class="nv2-dot" aria-hidden="true"></span>' : svg(item.icon)) + '<span class="nv2-label">' + item.label + '</span></a>';
  }

  function build() {
    const wrap = document.createElement('div');
    wrap.className = 'nv2-nav';
    wrap.setAttribute('role', 'navigation');
    wrap.setAttribute('aria-label', '主导航');
    let html = '';
    for (const g of GROUPS) {
      html += '<div class="nv2-group">' + (g.title ? '<div class="nv2-title">' + g.title + '</div>' : '');
      for (const it of g.items) {
        if (it.children) {
          html += '<div class="nv2-parent" data-key="' + it.key + '"><button type="button" class="nv2-link nv2-toggle" aria-expanded="false" title="' + it.label + '">' + svg(it.icon) +
            '<span class="nv2-label">' + it.label + '</span>' + svg('chevron', 'nv2-caret') + '</button><div class="nv2-sub">' +
            it.children.map((c) => linkHtml(c, true)).join('') + '</div></div>';
        } else html += linkHtml(it, false);
      }
      html += '</div>';
    }
    html += '<div class="nv2-group nv2-pins" hidden><div class="nv2-title">常用</div><div class="nv2-pin-list"></div></div>';
    wrap.innerHTML = html;
    const all = new Map();
    GROUPS.forEach((g) => g.items.forEach((it) => { all.set(it.key, it); (it.children || []).forEach((c) => all.set(c.key, c)); }));
    wrap.addEventListener('click', (e) => {
      const tog = e.target.closest('.nv2-toggle');
      if (tog) {
        const par = tog.parentElement, open = !par.classList.contains('open');
        par.classList.toggle('open', open); tog.setAttribute('aria-expanded', String(open)); store.set(openKey(par.dataset.key), open ? '1' : '0');
        if (asideEl()?.closest('.imagine-aigc')?.classList.contains('is-collapsed') && open) { const first = par.querySelector('.nv2-child'); if (first) first.click(); }
        return;
      }
      const a = e.target.closest('a.nv2-link');
      if (!a) return;
      if (a.dataset.pinHref) return;
      const item = all.get(a.dataset.key);
      if (item) go(item, e);
    });
    return wrap;
  }

  function syncPins(wrap) {
    const pins = [...document.querySelectorAll('aside .ipt-pinned a.ipt-entry')];
    const box = wrap.querySelector('.nv2-pins'), list = wrap.querySelector('.nv2-pin-list');
    const sig = pins.map((a) => a.getAttribute('href') + '|' + a.textContent.trim()).join(';');
    if (list.dataset.sig === sig) return;
    list.dataset.sig = sig;
    list.innerHTML = '';
    for (const p of pins) {
      const a = document.createElement('a');
      a.className = 'nv2-link';
      const destination = withTenant(p.getAttribute('href') || '#');
      a.href = destination;
      a.dataset.pinHref = '1';
      a.title = p.textContent.trim();
      a.innerHTML = svg('pin') + '<span class="nv2-label"></span>';
      a.querySelector('.nv2-label').textContent = p.textContent.trim();
      a.addEventListener('click', (e) => { if (e.defaultPrevented || e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; e.preventDefault(); e.stopPropagation(); navigate(destination); });
      list.append(a);
    }
    box.hidden = !pins.length;
  }

  function update() {
    const wrap = document.querySelector('.nv2-nav');
    if (!wrap) return;
    const key = activeKey();
    const brand = new URLSearchParams(location.search).get('brand_id');
    wrap.querySelectorAll('a.nv2-child[data-key^="geo-"]').forEach(a => {
      const url = new URL(a.getAttribute('href'), location.href);
      if (/^\d+$/.test(brand || '') && location.pathname.replace(/^\/t\/\d+/, '').replace(/\/$/, '') === '/ai/geo') url.searchParams.set('brand_id', brand);
      else url.searchParams.delete('brand_id');
      const next = url.pathname + url.search + url.hash;
      if (a.getAttribute('href') !== next) a.setAttribute('href', next);
    });
    wrap.querySelectorAll('.nv2-link[data-key]').forEach((a) => { const on = a.dataset.key === key; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    wrap.querySelectorAll('.nv2-parent').forEach((par) => {
      const has = !!par.querySelector('.nv2-child.on');
      par.classList.toggle('has-active', has);
      const saved = store.get(openKey(par.dataset.key));
      const open = has || saved === '1';
      par.classList.toggle('open', open);
      par.querySelector('.nv2-toggle').setAttribute('aria-expanded', String(open));
    });
    syncPins(wrap);
  }

  function mount() {
    const aside = asideEl(), nav = aside?.querySelector('.ia-navigation');
    if (!aside || !nav) return;
    aside.classList.add('nv2');
    if (!nav.querySelector(':scope > .nv2-nav')) nav.prepend(build());
    update();
  }

  ['pushState', 'replaceState'].forEach((m) => { const o = history[m]; history[m] = function () { const r = o.apply(this, arguments); setTimeout(update, 0); return r; }; });
  addEventListener('popstate', update);
  addEventListener('hashchange', update);
  const obs = new MutationObserver(() => { if (!document.querySelector('aside.ia-sidebar .nv2-nav')) mount(); else syncPinsSoon(); });
  let pinTimer = 0;
  function syncPinsSoon() { clearTimeout(pinTimer); pinTimer = setTimeout(() => { const w = document.querySelector('.nv2-nav'); if (w) syncPins(w); }, 120); }
  function start() { mount(); obs.observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.MerchantNavV2 = { update };
})();
