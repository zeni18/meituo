/* Merchant UI v2 — 作品库 (/ai/assets?tab=…), built on ui-kit.js.
   One window for everything the merchant has made:
   - AI works: /api/workspace_asset/feed (all generators merged, paged) + state/update for trash
   - 成片: /api/merchantPublishing/films + catalogs(kind=video) as libraries, move, delivery (signed clip links)
   - 图文 / 文案 / 话题 / 图片库: /api/merchantWorkspace/library + merchantPublishing/catalogs (usage limits)
   - 文章: /api/merchantWorkspace/articleLibrary (read-only here; editing lives in GEO)
   The legacy finished-library/asset-contents scripts stay loaded but stand down while this page owns the route. */
(() => {
  'use strict';
  const boot = () => {
    const UK = window.UK; if (!UK) return;
    const { esc, icon, fmt, ago, dur, btn, empty } = UK;

    const TABS = [
      { key: 'all', label: 'AI 生成' }, { key: 'films', label: '成片' }, { key: 'images', label: '图片' },
      { key: 'graphic', label: '图文' }, { key: 'articles', label: '文章' }, { key: 'copy', label: '文案' }, { key: 'topic', label: '话题' }
    ];
    const DOC = { graphic: 'image_text', copy: 'copy', topic: 'topic' };
    const DOC_NAME = { image_text: '图文', copy: '文案', topic: '话题', finished_image: '图片' };
    const LEGACY = { video: 'films', image_text: 'graphic', article: 'articles', topic: 'topic' };
    const FILM_TOOLS = { digital_human: '去做数字人', clip: '去剪辑' };
    const toolIcon = (src, type) => src === 'clip' ? 'scissors' : /digital_human|image_human|pic_lipsync/.test(src) ? 'user' : type === 'audio' ? 'music' : type === 'video' ? 'video' : 'image';
    const tabFromUrl = () => { const q = new URLSearchParams(location.search); const t = q.get('tab'); if (TABS.some((x) => x.key === t)) return t; return LEGACY[q.get('finished')] || 'all'; };

    /* api: tenant in the query only (workspace_asset rejects unknown body fields), token + cookie, tolerant of PHP notices */
    const token = () => { const m = document.cookie.match(/(?:^|; )token=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; };
    const reads = new Map();
    async function request(path, params, body) {
      const q = new URLSearchParams(); Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) q.set(k, v); });
      const t = UK.tenant(); if (t) q.set('tenant_id', t);
      let txt;
      try { txt = await fetch('/api/' + path + '?' + q, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', token: token() }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.text()); }
      catch (e) { throw new Error('网络连接失败，请重试'); }
      let r = null; try { r = JSON.parse(txt); } catch (e) { const k = txt.indexOf('{"code"'); if (k >= 0) try { r = JSON.parse(txt.slice(k)); } catch (e2) {} }
      if (!r) throw new Error('服务返回异常，请重试');
      if (r.code !== 1) { if (r.code === -1) location.replace('/login' + (t ? '?tenant_id=' + t : '')); throw new Error(r.msg || '请求失败，请重试'); }
      return r.data;
    }
    function call(path, params, body) {
      if (body) return request(path, params, body);
      const key = UK.tenant() + '|' + token() + '|' + path + '|' + JSON.stringify(Object.entries(params || {}).sort(([a], [b]) => a.localeCompare(b)));
      if (reads.has(key)) return reads.get(key);
      const pending = request(path, params).finally(() => reads.delete(key));
      reads.set(key, pending); return pending;
    }
    const pub = (a, p, b) => call('merchantPublishing/' + a, p, b);
    const ws = (a, p, b) => call('merchantWorkspace/' + a, p, b);
    const assets = (a, p, b) => call('workspace_asset/' + a, p, b);

    /* signed links for clip renders, cached per ref until shortly before expiry */
    const links = new Map();
    async function delivery(ref) {
      const c = links.get(ref); if (c && c.until > Date.now()) return c.url;
      const d = await pub('delivery', { ref });
      links.set(ref, { url: d.url, until: Date.now() + Math.max(60, (Number(d.expires_in) || 600) - 60) * 1000 });
      return d.url;
    }

    /* ---------- normalisers: every row becomes one item shape ---------- */
    const fromFeed = (r) => ({ key: r.ref, ref: r.ref, kind: 'media', type: r.type, title: r.title, url: r.url, cover: r.cover_url, w: r.width, h: r.height, d: r.duration, tool: r.tool, source: r.source, time: r.create_time, film: !!r.film, trashable: !!r.trashable, needsLink: r.source === 'clip' });
    const fromFilm = (r) => ({ key: r.ref, ref: r.ref, kind: 'media', type: 'video', title: r.title, url: r.video_url, cover: r.cover_url, d: r.duration, tool: TOOL_NAME(r.source), source: r.source, time: r.create_time, film: true, trashable: r.source !== 'clip', needsLink: !r.video_url, library: Number(r.library_id) || 0, usage: r.usage || null });
    const PLATFORMS = { douyin: '抖音', kuaishou: '快手', xiaohongshu: '小红书' };
    const LEVEL = { ok: ['ok', '充足'], low: ['wait', '偏少'], out: ['fail', '用完了'], empty: ['off', '还没有成片'] };
    const STATES = [['unused', '没用过'], ['assigned', '已派发'], ['sent', '已发出'], ['full', '已用满']];
    const TOOL_NAME = (s) => ({ digital_human: '数字人', image_human: '图片数字人', pic_lipsync: '照片说话', clip: '视频剪辑', video: '视频创作', action_transfer: '动作迁移', person_replacement: '动作替换', product_promo_video: '产品宣传视频', smart_clip: '口播剪辑', watermark_removal: '短视频去水印' })[s] || '成片';
    const stripHtml = (h) => { const d = document.createElement('div'); d.innerHTML = String(h || ''); return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
    const fromDoc = (r, kind) => ({ key: kind + ':' + r.id, id: Number(r.id), kind: kind === 'finished_image' ? 'media' : 'doc', doc: kind, type: kind === 'finished_image' ? 'image' : 'text', title: r.name, text: r.content || '', files: r.files || [], url: (r.files && r.files[0] && r.files[0].url) || '', folder: Number(r.folder_id) || 0, store: Number(r.store_id) || 0, time: r.create_time, trashable: true, raw: r });
    const fromArticle = (r) => ({ key: 'article:' + r.id, id: Number(r.id), kind: 'article', type: 'text', title: r.title || '未命名文章', text: stripHtml(r.content), brand: r.brand_name, category: r.category_name, words: Number(r.word_count) || 0, time: r.update_time || r.create_time });

    function page(root) {
      const S = { tab: tabFromUrl(), usage: '', unfiled: 0, group: tabFromUrl() === 'films' ? 'overview' : 'all', page: 1, size: 24, keyword: '', type: '', rows: [], total: 0, selected: new Map(), groups: [], counts: {}, seq: 0, gseq: 0, cseq: 0, dead: false, libs: [], ready: false };
      const $ = (s) => root.querySelector(s);
      root.innerHTML = '<div class="uk-page as">' +
        '<div class="uk-bar uk-pagehead"><h1 class="uk-grow">作品库</h1><div class="uk-actions" data-head></div></div>' +
        '<div data-tabs></div>' +
        '<div class="as-films" hidden></div>' +
        '<div class="uk-card as-body"><aside class="as-groups" aria-label="分组"></aside>' +
        '<section class="as-main"><div class="as-dslot" hidden></div><div class="as-tools"></div><div class="as-content"></div><div class="as-pager"></div></section></div></div>';
      // tabs are views inside one page: update the address in place instead of routing, so Nuxt does not
      // re-render the native page underneath (which would remount this one and drop selection and scroll)
      const tabOpt = { items: [], value: S.tab, tail: '', onChange: (k) => { UK.setView('/ai/assets?tab=' + k); setTab(k); } };
      const tabs = UK.tabs($('[data-tabs]'), tabOpt);

      /* ---------- head, tabs ---------- */
      function drawHead() {
        const t = S.tab, h = $('[data-head]');
        const lib = (label) => btn({ kind: 'secondary', size: 'lg', icon: 'folderOpen', label, attrs: { 'data-new-lib': '' } });
        if (t === 'films') h.innerHTML = S.group === 'overview' ? lib('新建成片组') + btn({ kind: 'ai', size: 'lg', icon: 'spark', label: '做成片', attrs: { 'data-make-film': '' } }) : '';
        else if (DOC[t]) h.innerHTML = lib('新建' + DOC_NAME[DOC[t]] + '库') + btn({ kind: 'primary', size: 'lg', icon: 'plus', label: '新增' + DOC_NAME[DOC[t]], attrs: { 'data-new-doc': '' } });
        else if (t === 'articles') h.innerHTML = btn({ kind: 'ai', size: 'lg', icon: 'spark', label: 'AI 写文章', attrs: { 'data-go-geo': '' } });
        else if (t === 'images') h.innerHTML = lib('新建图片库') + btn({ kind: 'ai', size: 'lg', icon: 'spark', label: '开始做图', attrs: { 'data-go': '/ai/create' } });
        else h.innerHTML = btn({ kind: 'ai', size: 'lg', icon: 'spark', label: '开始创作', attrs: { 'data-go': '/ai/tools' } });
      }
      function drawTabs() {
        tabOpt.tail = '<button type="button" class="as-trash-link" data-trash>' + icon('delete') + '<span>回收站</span></button>';
        tabs.set(TABS.map((x) => ({ key: x.key, label: x.label, count: S.counts[x.key] })), S.tab);
      }

      /* ---------- groups (left column) ---------- */
      const g = (key, name, count, ic, extra) => ({ key, name, count, icon: ic, ...(extra || {}) });
      async function loadGroups() {
        const seq = ++S.gseq, t = S.tab;
        let list = [];
        try {
          if (t === 'all' || t === 'images') {
            const f = await call('workspace_asset/feed', { type: t === 'images' ? 'image' : '', page_size: 24 });
            if (S.dead || seq !== S.gseq || t !== S.tab) return;
            const tools = (f.tools || []).filter((x) => t === 'all' || x.type === 'image');
            list = [g('all', t === 'images' ? 'AI 生成的图片' : '全部 AI 作品', t === 'images' ? (f.counts || {}).image : f.count, t === 'images' ? 'aiImage' : 'apps')];
            if (tools.length) list.push({ heading: '按工具' }, ...tools.map((x) => g('tool:' + x.source, x.name, x.count, toolIcon(x.source, x.type))));
            if (t === 'images') {
              const c = await pub('catalogs', { kind: 'finished_image', trash: '0', page: 1, page_size: 48 });
            if (S.dead || seq !== S.gseq || t !== S.tab) return;
              S.libs = c.lists || [];
              list.push({ heading: '图片库', add: true }, ...S.libs.map((x) => g('folder:' + x.id, x.name, x.count, 'folder', { lib: x })));
            }
          } else if (t === 'films') {
            const [c, l] = await Promise.all([pub('catalogs', { kind: 'video', trash: '0', page: 1, page_size: 48 }), pub('libraries')]);
            if (S.dead || seq !== S.gseq || t !== S.tab) return;
            S.libs = c.lists || []; S.unfiled = Number(l.unfiled) || 0; S.groups = [];
            drawFilms(); return;
          } else if (DOC[t]) {
            const c = await pub('catalogs', { kind: DOC[t], trash: '0', page: 1, page_size: 48 });
            if (S.dead || seq !== S.gseq || t !== S.tab) return;
            S.libs = c.lists || [];
            list = [g('all', '全部' + DOC_NAME[DOC[t]], null, t === 'topic' ? 'hash' : 'text'), g('folder:0', '未归库', c.unfiled, 'inbox'), { heading: DOC_NAME[DOC[t]] + '库', add: true }, ...S.libs.map((x) => g('folder:' + x.id, x.name, x.count, 'folder', { lib: x }))];
          } else if (t === 'articles') {
            const b = await ws('brandChoices');
            const brands = Array.isArray(b) ? b : (b && b.lists) || [];
            list = [g('all', '全部品牌', null, 'article'), ...(brands.length > 1 ? [{ heading: '品牌' }, ...brands.map((x) => g('brand:' + x.id, x.name, null, 'briefcase'))] : [])];
          }
        } catch (e) { list = [g('all', '全部', null, 'apps')]; if (!S.dead && seq === S.gseq) UK.toast(e.message, 'fail'); }
        if (S.dead || seq !== S.gseq || t !== S.tab) return;
        S.groups = list; drawGroups();
      }
      /* ---------- 成片: groups are stock pools for distribution, so they lead the page ---------- */
      const libOf = (id) => S.libs.find((l) => String(l.id) === String(id));
      function layout() {
        const films = S.tab === 'films', over = films && S.group === 'overview';
        $('.as-films').hidden = !over;
        $('.as-dslot').hidden = !films || over;
        $('.as-body').hidden = over;
        $('.as-body').classList.toggle('is-single', films);
      }
      const platformMarks = (pf, key) => Object.entries(pf || {}).filter(([, v]) => v[key]).map(([p, v]) => '<span class="as-pf" data-tip="' + esc(PLATFORMS[p] || p) + (key === 'sent' ? ' 已发出 ' : ' 派发 ') + v[key] + ' 次"><img src="/merchant/design-assets/' + esc(p) + '.png" alt="' + esc(PLATFORMS[p] || p) + '"><b class="num">' + v[key] + '</b></span>').join('');
      function usageLine(u) {
        if (!u) return '';
        if (u.state === 'full') return '<span class="uk-status off">已用满 <span class="num">' + u.assigned + '/' + u.max + '</span></span>';
        if (u.state === 'sent') return '<span class="as-use is-sent">已发出 <b class="num">' + u.sent + '</b> 次</span>' + platformMarks(u.platforms, 'sent');
        if (u.state === 'assigned') return '<span class="as-use is-assigned">派发 <b class="num">' + u.assigned + '</b> 次 · 未发出</span>' + platformMarks(u.platforms, 'assigned');
        return '<span class="uk-status ok">没用过</span>';
      }
      /* stock bar: one colour per state, same order everywhere; exact numbers on hover */
      function stockBar(st, total) {
        const seg = (k) => total ? (st[k] / total * 100) : 0, tip = STATES.map(([k, l]) => l + ' ' + fmt(st[k])).join(' · ');
        return '<div class="as-bar" role="img" aria-label="' + tip + '" data-tip="' + tip + '">' + STATES.map(([k]) => st[k] ? '<i class="is-' + k + '" style="width:' + seg(k) + '%"></i>' : '').join('') + '</div>';
      }
      const legend = () => '<div class="as-legend" aria-hidden="true">' + STATES.map(([k, l]) => '<span class="is-' + k + '"><i></i>' + l + '</span>').join('') + '</div>';
      const coverMedia = (c) => c.cover_url ? '<img src="' + esc(c.cover_url) + '" alt="" loading="lazy">' : c.video_url ? '<video src="' + esc(c.video_url) + '#t=0.1" muted preload="metadata" playsinline></video>' : '<em data-frame="' + esc(c.ref) + '"></em>';
      const ovBtn = (ic, label, attr, val) => '<button type="button" ' + attr + '="' + esc(val) + '" data-tip="' + label + '" aria-label="' + label + '">' + icon(ic) + '</button>';
      const limitText = (lib) => Number(lib.max_uses) ? '每条最多派 ' + Number(lib.max_uses) + ' 次' : '派发次数不限';
      /* a group is drawn as a pile of films (工作台原稿「多张作品」的叠放卡): cover first, stock underneath */
      function poolCard(lib) {
        const st = lib.states || { unused: 0, assigned: 0, sent: 0, full: 0 }, n = Number(lib.count) || 0, lv = LEVEL[lib.level] || LEVEL.ok;
        const covers = lib.covers || [], c = covers[0], layers = n ? Math.min(Math.max(n, covers.length), 3) - 1 : 0;
        const low = lib.level === 'low' || lib.level === 'out';
        const note = !n ? '' : lib.level === 'out' ? '<span class="as-pool-note is-out">' + icon('warn') + '再派会重复发布</span>'
          : lib.level === 'low' ? '<span class="as-pool-note is-low">' + icon('warn') + '少于提醒线 <span class="num">' + lib.warn_below + '</span> 条</span>'
          : lib.active_tasks ? '<span class="as-pool-note">' + icon('send') + '员工任务 <span class="num">' + lib.active_tasks + '</span> 个进行中</span>'
          : (lib.plans || []).length ? '<span class="as-pool-note is-auto" data-tip="自动化计划「' + esc(lib.plans[0].name) + '」会往这个组补成片">' + icon('sync') + '自动补充中</span>' : '';
        const acts = !n ? btn({ kind: 'ai', size: 'sm', icon: 'spark', label: '补充成片', attrs: { 'data-refill': lib.id } })
          : low ? btn({ kind: 'ai', size: 'sm', icon: 'spark', label: '补充成片', attrs: { 'data-refill': lib.id } }) + btn({ kind: 'secondary', size: 'sm', icon: 'send', iconOnly: true, label: '派给员工', attrs: { 'data-assign-lib': lib.id } })
          : btn({ kind: 'secondary', size: 'sm', icon: 'send', label: '派给员工', attrs: { 'data-assign-lib': lib.id } }) + btn({ kind: 'ghost', size: 'sm', icon: 'spark', label: '补充', attrs: { 'data-refill': lib.id } });
        return '<article class="as-pool is-' + esc(lib.level || 'ok') + '" data-open-lib="' + lib.id + '" tabindex="0" role="button" aria-label="打开成片组 ' + esc(lib.name) + '">' +
          '<div class="as-pool-cover l' + layers + '"><div class="as-pool-img' + (c ? '' : ' is-empty') + '">' + (c ? coverMedia(c) : '<span class="as-pool-art">' + icon('video') + '</span>') +
            (n ? '<span class="uk-glass as-pool-badge">' + icon('play') + '<span class="num">' + fmt(n) + '</span> 条</span>' : '') +
            '<span class="as-ov">' + ovBtn('more', '更多操作', 'data-lib-menu', lib.id) + '</span>' +
            '<div class="as-pool-cap"><b>' + esc(lib.name) + '</b><small>' + esc(limitText(lib)) + '</small></div></div></div>' +
          '<div class="as-pool-info">' +
            '<div class="as-pool-stock">' + (n ? '<span>还能用</span><b class="num">' + fmt(st.unused) + '</b><span>/ <span class="num">' + fmt(n) + '</span> 条</span><span class="uk-grow"></span><span class="uk-status ' + lv[0] + '">' + lv[1] + '</span>'
              : '<span>还没有成片</span>') + '</div>' +
            (n ? stockBar(st, n) : '') + (note ? '<div class="as-pool-notes">' + note + '</div>' : '') +
            '<div class="as-pool-acts">' + acts + '</div></div></article>';
      }
      function unfiledCard() {
        return '<article class="as-pool is-unfiled" data-open-lib="0" tabindex="0" role="button" aria-label="整理还没归组的成片">' +
          '<div class="as-pool-cover l0"><div class="as-pool-img is-empty"><span class="as-pool-art">' + icon('inbox') + '</span>' +
            '<div class="as-pool-cap"><b>还没归组的成片</b><small>归组后才能按组派发</small></div></div></div>' +
          '<div class="as-pool-info"><div class="as-pool-stock"><span>待整理</span><b class="num">' + fmt(S.unfiled) + '</b><span>条</span></div>' +
            '<div class="as-pool-acts">' + btn({ kind: 'secondary', size: 'sm', icon: 'folder', label: '去整理', attrs: { 'data-open-lib': '0' } }) + '</div></div></article>';
      }
      function drawFilms() {
        layout(); drawHead();
        if (S.group !== 'overview') return drawFilmHead();
        const box = $('.as-films');
        // the strip only summarises across groups; a single group already says it on its own card
        const lows = S.libs.filter((l) => l.level === 'low' || l.level === 'out'); if (lows.length < 2) lows.length = 0;
        const notice = lows.length ? '<div class="uk-notice' + (lows.some((l) => l.level === 'out') ? ' is-danger' : '') + '">' + icon('warn') + '<span class="uk-grow">' +
          '<b class="num">' + lows.length + '</b> 个成片组快用完了：' + lows.slice(0, 3).map((l) => '<button type="button" class="uk-notice-link" data-open-lib="' + l.id + '">' + esc(l.name) + '</button>').join('、') + (lows.length > 3 ? ' 等' : '') + '，继续派发容易重复发布被限流</span></div>' : '';
        const count = S.libs.length + (S.unfiled ? 1 : 0);
        box.innerHTML = notice + (count ? '<div class="uk-card as-pools"><div class="as-pools-head"><b>成片组</b><span class="as-pools-n num">' + S.libs.length + '</span><span class="uk-grow"></span>' + legend() + '</div>' +
            '<div class="as-pgrid">' + S.libs.map(poolCard).join('') + (S.unfiled ? unfiledCard() : '') + '</div></div>'
          : '<div class="uk-card as-gempty"><span class="as-empty-art">' + icon('video') + '</span><b>先建一个成片组</b><span class="uk-meta">按用途分组，比如「门店探店」「新品上市」，派发时系统会从组里挑没用过的成片</span><div class="uk-actions">' + btn({ kind: 'secondary', icon: 'folderOpen', label: '新建成片组', attrs: { 'data-new-lib': '' } }) + btn({ kind: 'ai', icon: 'spark', label: '做成片', attrs: { 'data-make-film': '' } }) + '</div></div>');
        observeFrames();
      }
      /* group detail: the head lives inside the same window as the films, the state filter sits in the toolbar */
      function drawFilmHead() {
        const id = S.group.slice(4), lib = libOf(id), unfiled = id === '0';
        const st = (lib && lib.states) || { unused: 0, assigned: 0, sent: 0, full: 0 }, n = lib ? Number(lib.count) || 0 : 0;
        const lv = lib ? LEVEL[lib.level] || LEVEL.ok : null, c = lib && (lib.covers || [])[0];
        const meta = lib ? [esc(limitText(lib)), '没用过的少于 <span class="num">' + lib.warn_below + '</span> 条时提醒', lib.active_tasks ? '员工任务 <span class="num">' + lib.active_tasks + '</span> 个进行中' : ''].filter(Boolean).map((x) => '<span>' + x + '</span>').join('<span class="uk-meta-sep"></span>') : '<span>归组后才能按组派发、统计库存</span>';
        $('.as-dslot').innerHTML = '<button type="button" class="uk-link as-back" data-back>' + icon('chevronLeft') + '全部成片组</button>' +
          '<div class="as-dtitle"><span class="as-dcover' + (c ? '' : ' is-empty') + '">' + (c ? coverMedia(c) : icon(unfiled ? 'inbox' : 'video')) + '</span>' +
            '<div class="as-dname"><div><h2>' + esc(unfiled ? '还没归组的成片' : lib ? lib.name : '成片组') + '</h2>' + (lv ? '<span class="uk-status ' + lv[0] + '">' + lv[1] + '</span>' : '') + '</div><span class="as-dmeta">' + meta + '</span></div>' +
            '<span class="uk-grow"></span>' +
            (lib ? btn({ kind: 'ghost', icon: 'setting', iconOnly: true, label: '成片组设置', attrs: { 'data-lib-edit': lib.id } }) + btn({ kind: 'secondary', size: 'lg', icon: 'send', label: '派给员工', attrs: { 'data-assign-lib': lib.id } }) + btn({ kind: 'ai', size: 'lg', icon: 'spark', label: '补充成片', attrs: { 'data-refill': lib.id } }) : '') + '</div>' +
          (lib && n ? '<div class="as-dstock"><div class="as-dstock-n"><span>还能用</span><b class="num">' + fmt(st.unused) + '</b><span>/ <span class="num">' + fmt(n) + '</span> 条</span></div>' + stockBar(st, n) + '</div>' : '');
        observeFrames();
      }
      const stateSeg = () => {
        const lib = libOf(S.group.slice(4)); if (!lib) return '';
        const st = lib.states || {}, b = (k, l, num) => '<button type="button" data-usage="' + k + '" aria-pressed="' + (S.usage === k) + '"' + (k ? ' class="is-' + k + '"' : '') + '>' + (k ? '<i></i>' : '') + l + '<span class="num">' + fmt(num) + '</span></button>';
        return '<div class="uk-seg as-states" role="group" aria-label="按使用情况筛选">' + b('', '全部', lib.count) + STATES.map(([k, l]) => b(k, l, st[k] || 0)).join('') + '</div>';
      };
      async function refillMenu(anchor, id) {
        const lib = libOf(id);
        UK.menu(anchor, [
          { group: lib ? '补充到「' + lib.name + '」' : '做成片' },
          { key: 'avatar', label: '数字人口播', icon: 'user', meta: '生成后自动进组' },
          { key: 'clip', label: '视频剪辑', icon: 'scissors', meta: '做好后在这里归组' },
          { key: 'video', label: 'AI 视频', icon: 'video', meta: '做好后在这里归组' },
          '-', { key: 'auto', label: '自动化计划', icon: 'sync', meta: '定时批量补充' }
        ], (k) => {
          if (k === 'avatar') UK.go('/ai/avatar' + (lib ? '?film_library=' + lib.id : ''));
          else if (k === 'clip') UK.go('/ai/video-editor'); else if (k === 'video') UK.go('/ai/create?type=video'); else if (k === 'auto') UK.go('/ai/automation');
        }, { align: 'right' });
      }
      async function assignGroup(id) {
        const lib = libOf(id); if (!lib) return;
        if (!lib.count) { UK.toast('这个成片组还没有成片', 'info'); return; }
        let pool = [];
        try { for (let page = 1; page <= 5; page++) { const d = await pub('films', { library_id: lib.id, page, sort: 'unused' }); pool.push(...(d.lists || []).map(fromFilm)); if (pool.length >= d.count) break; } }
        catch (e) { UK.toast(e.message, 'fail'); return; }
        pool = pool.filter((f) => !f.usage || f.usage.state !== 'full');
        if (!pool.length) { UK.toast('这个组的成片都已用满派发次数，请补充或调高次数', 'info'); return; }
        assign(pool, { group: lib });
      }

      function drawGroups() {
        const row = (x) => {
          if (x.heading) return '<div class="as-ghead"><span>' + esc(x.heading) + '</span>' + (x.add ? '<button type="button" class="as-gadd" data-new-lib aria-label="新建' + esc(x.heading) + '" data-tip="新建' + esc(x.heading) + '">' + icon('plus') + '</button>' : '') + '</div>';
          const on = S.group === x.key, lib = x.lib;
          const limit = lib && Number(lib.max_uses) ? '<span class="as-glimit" data-tip="每条内容最多派发 ' + Number(lib.max_uses) + ' 次">限 ' + Number(lib.max_uses) + ' 次</span>' : '';
          return '<div class="as-grow' + (on ? ' is-on' : '') + '"><button type="button" class="as-glink" data-group="' + esc(x.key) + '"' + (on ? ' aria-current="true"' : '') + '>' + icon(x.icon || 'folder') +
            '<span class="as-gname">' + esc(x.name) + '</span>' + limit + '<span class="as-gcount num">' + (x.count == null ? '' : fmt(x.count)) + '</span></button>' +
            (lib ? '<button type="button" class="as-gmore" data-lib-menu="' + lib.id + '" aria-label="' + esc(x.name) + ' 的操作">' + icon('more') + '</button>' : '') + '</div>';
        };
        if (S.tab === 'films') return;
        $('.as-groups').innerHTML = '<div class="as-glist">' + S.groups.map(row).join('') + '</div>';
      }

      /* ---------- toolbar ---------- */
      function drawTools() {
        const ph = { all: '搜索作品名称或提示词', films: '搜索成片名称', images: '搜索图片', graphic: '搜索图文', articles: '搜索文章标题', copy: '搜索文案', topic: '搜索话题' }[S.tab];
        const types = S.tab === 'all' && !S.group.startsWith('tool:') ? '<div class="uk-seg" role="group" aria-label="类型">' + [['', '全部'], ['image', '图片'], ['video', '视频'], ['audio', '音频']].map(([k, l]) => '<button type="button" data-type="' + k + '" aria-pressed="' + (S.type === k) + '">' + l + '</button>').join('') + '</div>' : '';
        $('.as-tools').innerHTML = '<label class="uk-search as-search">' + icon('search') + '<input class="uk-input" type="search" aria-label="搜索作品名称" maxlength="80" placeholder="' + esc(ph) + '" value="' + esc(S.keyword) + '" data-keyword></label>' + types + (S.tab === 'films' && S.group !== 'overview' ? stateSeg() : '') +
          '<span class="uk-grow"></span><span class="uk-meta as-total" data-total></span>';
      }

      /* ---------- data ---------- */
      const groupId = (prefix) => S.group.startsWith(prefix) ? S.group.slice(prefix.length) : null;
      async function fetchList() {
        const t = S.tab, base = { page: S.page, keyword: S.keyword };
        if (t === 'all' || (t === 'images' && !S.group.startsWith('folder:'))) {
          const d = await call('workspace_asset/feed', { ...base, page_size: S.size, type: t === 'images' ? 'image' : S.type, source: groupId('tool:') || '' });
          return { rows: (d.lists || []).map(fromFeed), total: d.count };
        }
        if (t === 'films') {
          const lib = groupId('lib:');
          const d = await pub('films', { ...base, library_id: lib == null ? '' : lib, usage: S.usage, sort: 'unused' });
          return { rows: (d.lists || []).map(fromFilm), total: d.count, size: d.page_size };
        }
        if (t === 'articles') {
          const d = await ws('articleLibrary', { ...base, page_size: 20, brand_id: groupId('brand:') || '' });
          return { rows: (d.lists || []).map(fromArticle), total: d.count, size: 20 };
        }
        const kind = t === 'images' ? 'finished_image' : DOC[t];
        const folder = groupId('folder:');
        const d = await ws('library', { ...base, kind, folder_id: folder == null ? '' : folder, trash: '0', page_size: S.size });
        return { rows: (d.lists || []).map((r) => fromDoc(r, kind)), total: d.count };
      }
      function skeleton() {
        const doc = DOC[S.tab] || S.tab === 'articles';
        $('.as-content').innerHTML = '<div class="' + (doc ? 'as-docs' : 'as-grid') + '">' + ('<div class="as-skel ' + (doc ? 'is-doc' : '') + '"><span class="uk-skel"></span><span class="uk-skel"></span><span class="uk-skel"></span></div>').repeat(doc ? 6 : 8) + '</div>';
      }
      async function load() {
        const seq = ++S.seq;
        if (S.tab === 'films' && S.group === 'overview') { $('.as-content').innerHTML = ''; $('.as-pager').innerHTML = ''; S.rows = []; return; }
        if (!S.rows.length) skeleton();
        $('.as-content').setAttribute('aria-busy', 'true');
        try {
          const d = await fetchList();
          if (S.dead || seq !== S.seq) return;
          S.rows = d.rows; S.total = Number(d.total) || 0; S.pageSize = d.size || S.size;
          for (const k of [...S.selected.keys()]) if (!S.rows.some((r) => r.key === k)) S.selected.delete(k);
          drawContent(); drawPager(); paintSelection();
        } catch (e) {
          if (!S.dead && seq === S.seq) $('.as-content').innerHTML = empty({ icon: 'alert', title: e.message, actions: [{ kind: 'secondary', label: '重新加载', attrs: { 'data-reload': '' } }] });
        } finally { if (!S.dead && seq === S.seq) $('.as-content').removeAttribute('aria-busy'); }
      }
      async function loadCounts() {
        const seq = ++S.cseq;
        const n = (p) => p.then((d) => Number(d && d.count) || 0).catch(() => undefined);
        const [f, films, metadata, ar] = await Promise.all([
          call('workspace_asset/feed', { page_size: 24 }).catch(() => null),
          n(pub('films', { page: 1 })), ws('materialCounts').catch(() => null),
          n(ws('articleLibrary', { page: 1, page_size: 10 }))
        ]);
        if (S.dead || seq !== S.cseq) return;
        const counts = metadata?.counts || {};
        S.counts = { all: f?.count, films, images: f && metadata ? Number(f.counts?.image || 0) + Number(counts.finished_image || 0) : undefined, graphic: counts.image_text, copy: counts.copy, topic: counts.topic, articles: ar };
        drawTabs();
      }
      const refresh = () => Promise.all([loadGroups(), load(), loadCounts()]);

      /* ---------- content ---------- */
      /* 原稿: 素材库 card (checkbox, glass duration, caption under the picture) + 工作台 hover (white buttons top-right, play in the middle) */
      function mediaCard(it) {
        const sel = S.selected.has(it.key);
        const thumb = it.type === 'audio' ? '<span class="as-audio-art">' + icon('music') + '</span>'
          : it.type === 'video' ? (it.cover ? '<img src="' + esc(it.cover) + '" alt="" loading="lazy">' : it.url ? '<video src="' + esc(it.url) + '#t=0.1" muted preload="metadata" playsinline></video>' : '<span class="as-frame" data-frame="' + esc(it.ref) + '">' + icon('video') + '</span>')
          : it.url ? '<img src="' + esc(it.url) + '" alt="" loading="lazy" data-dim="' + esc(it.key) + '">' : '<span class="as-frame">' + icon('image') + '</span>';
        const meta = [it.tool, it.type === 'image' && it.w && it.h ? it.w + '×' + it.h : '', ago(it.time)].filter(Boolean).join(' · ');
        const ov = (it.film ? ovBtn('send', '派给员工', 'data-assign', it.key) : ovBtn('download', '下载', 'data-download', it.key)) + ovBtn('more', '更多', 'data-item-menu', it.key);
        return '<article class="as-card' + (sel ? ' is-selected' : '') + '" data-key="' + esc(it.key) + '">' +
          '<div class="as-thumb is-' + it.type + '" data-preview="' + esc(it.key) + '" tabindex="0" role="button" aria-label="预览 ' + esc(it.title) + '">' + thumb +
            (it.type !== 'image' ? '<span class="as-play" aria-hidden="true">' + icon('play') + '</span>' : '') +
            '<button type="button" class="uk-check as-check" role="checkbox" aria-checked="' + sel + '" aria-label="选择 ' + esc(it.title) + '" data-pick="' + esc(it.key) + '">' + icon('check') + '</button>' +
            (it.type !== 'image' ? '<span class="uk-glass as-dur">' + icon(it.type === 'audio' ? 'music' : 'play') + '<span class="num">' + (it.d ? dur(it.d) : it.type === 'audio' ? '音频' : '视频') + '</span></span>' : '') +
            '<span class="as-ov">' + ov + '</span>' +
          '</div>' +
          '<div class="as-cap"><b title="' + esc(it.title) + '">' + esc(it.title) + '</b>' + (it.usage && S.tab === 'films' ? '<span class="as-usage">' + usageLine(it.usage) + '</span>' : '<span class="as-meta">' + esc(meta) + '</span>') + '</div></article>';
      }
      function docCard(it) {
        const sel = S.selected.has(it.key);
        const pics = it.doc === 'image_text' && it.files.length ? '<span class="as-doc-pics">' + it.files.slice(0, 3).map((f) => '<img src="' + esc(f.url) + '" alt="" loading="lazy">').join('') + (it.files.length > 3 ? '<i class="num">+' + (it.files.length - 3) + '</i>' : '') + '</span>' : '';
        const lib = it.folder ? (S.libs.find((l) => Number(l.id) === it.folder) || {}).name : '';
        const meta = it.kind === 'article' ? [it.brand, it.category, it.words ? fmt(it.words) + ' 字' : ''].filter(Boolean).join(' · ') : [lib || '未归库', ago(it.time)].filter(Boolean).join(' · ');
        const body = it.doc === 'topic' ? '<span class="as-tags">' + (it.text.match(/#[^\s#]+/g) || [it.text]).slice(0, 8).map((x) => '<i>' + esc(x) + '</i>').join('') + '</span>' : '<p>' + esc(it.text.slice(0, 160)) + '</p>';
        return '<article class="as-doc' + (sel ? ' is-selected' : '') + (pics ? ' has-pics' : '') + '" data-key="' + esc(it.key) + '" data-preview="' + esc(it.key) + '" tabindex="0" role="button" aria-label="查看 ' + esc(it.title) + '">' +
          (it.kind === 'article' ? '' : '<button type="button" class="uk-check as-check" role="checkbox" aria-checked="' + sel + '" aria-label="选择 ' + esc(it.title) + '" data-pick="' + esc(it.key) + '">' + icon('check') + '</button>') +
          '<button type="button" class="as-doc-more" data-item-menu="' + esc(it.key) + '" aria-label="更多操作">' + icon('more') + '</button>' +
          pics + '<b>' + esc(it.title) + '</b>' + body + '<span class="as-meta">' + esc(meta) + (it.kind === 'article' ? '<span class="as-meta-r">' + esc(ago(it.time)) + '</span>' : '') + '</span></article>';
      }
      const emptyFor = () => {
        const filtered = S.keyword || S.type;
        if (filtered) return empty({ icon: 'search', title: '没有符合条件的作品', actions: [{ kind: 'secondary', label: '清除筛选', attrs: { 'data-clear': '' } }] });
        const t = S.tab, art = (ic, title, actions) => '<div class="as-empty"><span class="as-empty-art">' + icon(ic) + '</span><b>' + esc(title) + '</b>' + (actions ? '<div class="uk-actions">' + actions + '</div>' : '') + '</div>';
        if (t === 'films' && S.usage) return empty({ icon: 'video', title: '这个组里没有「' + (STATES.find((x) => x[0] === S.usage) || ['', ''])[1] + '」的成片', actions: [{ kind: 'secondary', label: '看全部', attrs: { 'data-usage': '' } }] });
        if (t === 'films') return S.group === 'all' ? art('video', '还没有成片', btn({ kind: 'secondary', icon: 'user', label: '去做数字人', attrs: { 'data-go': '/ai/avatar' } }) + btn({ kind: 'ai', icon: 'scissors', label: '去剪辑', attrs: { 'data-go': '/ai/video-editor' } })) : art('folder', '这个成片库还是空的', btn({ kind: 'secondary', label: '查看全部成片', attrs: { 'data-group': 'all' } }));
        if (DOC[t] || (t === 'images' && S.group.startsWith('folder:'))) { const k = t === 'images' ? 'finished_image' : DOC[t]; return art(k === 'topic' ? 'hash' : k === 'finished_image' ? 'image' : 'text', S.group === 'all' ? '还没有' + DOC_NAME[k] : '这里还没有' + DOC_NAME[k], btn({ kind: 'primary', icon: 'plus', label: '新增' + DOC_NAME[k], attrs: { 'data-new-doc': '' } })); }
        if (t === 'articles') return art('article', '还没有文章', btn({ kind: 'ai', icon: 'spark', label: 'AI 写文章', attrs: { 'data-go-geo': '' } }));
        return art(t === 'images' ? 'image' : 'ai', t === 'images' ? '还没有 AI 生成的图片' : '还没有作品', btn({ kind: 'ai', icon: 'spark', label: t === 'images' ? '开始做图' : '开始创作', attrs: { 'data-go': t === 'images' ? '/ai/create' : '/ai/tools' } }));
      };
      function drawContent() {
        const box = $('.as-content');
        const total = $('[data-total]'); if (total) total.textContent = S.total ? '共 ' + fmt(S.total) + ' 项' : '';
        if (!S.rows.length) { box.innerHTML = emptyFor(); return; }
        const docs = S.rows[0].kind !== 'media';
        box.innerHTML = '<div class="' + (docs ? 'as-docs' : 'as-grid') + '">' + S.rows.map((it, i) => (docs ? docCard(it) : mediaCard(it)).replace('<article ', '<article style="--i:' + Math.min(i, 11) + '" ')).join('') + '</div>';
        box.querySelectorAll('img[data-dim]').forEach((img) => { const f = () => { const it = S.rows.find((r) => r.key === img.dataset.dim); if (it && !it.w && img.naturalWidth) { it.w = img.naturalWidth; it.h = img.naturalHeight; } }; if (img.complete) f(); else img.addEventListener('load', f, { once: true }); });
        observeFrames();
      }
      /* clip renders have no cover: show their first frame once the card scrolls into view */
      let io = null;
      function observeFrames() {
        io && io.disconnect();
        const frames = [...root.querySelectorAll('[data-frame]')]; if (!frames.length) return;
        io = new IntersectionObserver((entries) => entries.forEach(async (e) => {
          if (!e.isIntersecting) return; io.unobserve(e.target);
          const el = e.target, ref = el.dataset.frame;
          try {
            const url = await delivery(ref); if (!el.isConnected) return;
            const v = document.createElement('video'); v.muted = true; v.preload = 'metadata'; v.playsInline = true; v.src = url + '#t=0.1';
            v.addEventListener('loadeddata', () => { el.replaceWith(v); const it = S.rows.find((r) => r.ref === ref); if (it && !it.d && v.duration) { it.d = v.duration; const c = root.querySelector('[data-key="' + CSS.escape(ref) + '"] .as-dur .num'); if (c) c.textContent = dur(v.duration); } }, { once: true });
          } catch (err) {}
        }), { rootMargin: '200px' });
        frames.forEach((f) => io.observe(f));
      }
      function drawPager() { const size = S.pageSize || S.size; $('.as-pager').innerHTML = S.total > size ? UK.pager(S.total, S.page, size) : ''; }

      /* ---------- selection & batch ---------- */
      const byKey = (k) => S.rows.find((r) => r.key === k);
      function paintSelection() {
        root.querySelectorAll('[data-key]').forEach((el) => { const on = S.selected.has(el.dataset.key); el.classList.toggle('is-selected', on); const c = el.querySelector('[data-pick]'); if (c) c.setAttribute('aria-checked', String(on)); });
        root.querySelector('.as-main').classList.toggle('uk-selecting', S.selected.size > 0);
        const items = [...S.selected.values()];
        if (!items.length) return UK.batch(null);
        const acts = [];
        if (items.every((x) => x.film)) acts.push({ key: 'assign', label: '派给员工', icon: 'send' });
        if (S.tab === 'films') acts.push({ key: 'move', label: '移到其他组', icon: 'folder' });
        if (items[0].doc) acts.push({ key: 'docmove', label: '移到库', icon: 'folder' });
        if (items.every((x) => x.kind === 'media')) acts.push({ key: 'download', label: '下载', icon: 'download' });
        if (items.every((x) => x.trashable)) acts.push({ key: 'trash', label: '移入回收站', icon: 'delete', danger: true });
        UK.batch({ count: items.length, actions: acts, onClear: () => { S.selected.clear(); paintSelection(); }, onAction: (k) => {
          if (k === 'assign') assign(items); else if (k === 'move') moveFilms(items); else if (k === 'docmove') moveDocs(items); else if (k === 'download') download(items); else if (k === 'trash') trash(items);
        } });
      }

      /* ---------- actions ---------- */
      async function linkOf(it) { if (it.url) return it.url; if (it.needsLink) return delivery(it.ref); return ''; }
      async function download(items) {
        let n = 0;
        for (const it of items) {
          try { const url = await linkOf(it); if (!url) continue; const a = document.createElement('a'); a.href = url; a.download = (it.title || '作品').slice(0, 60); a.rel = 'noopener'; a.target = '_blank'; document.body.append(a); a.click(); a.remove(); n++; await new Promise((r) => setTimeout(r, 350)); } catch (e) {}
        }
        UK.toast(n ? '开始下载 ' + n + ' 个文件' : '暂时无法下载，请稍后重试', n ? 'ok' : 'fail');
      }
      async function trash(items) {
        try {
          const media = items.filter((x) => x.ref), docs = items.filter((x) => x.doc);
          if (media.length) await assets('update', {}, { refs: media.map((x) => x.ref), action: 'trash' });
          if (docs.length) await ws('batch', {}, { kind: docs[0].doc, action: 'trash', ids: docs.map((x) => x.id) });
          S.selected.clear(); UK.toast(items.length > 1 ? items.length + ' 项已移入回收站' : '已移入回收站'); refresh();
        } catch (e) { UK.toast(e.message, 'fail'); }
      }
      function libPicker(chosen, withNone) {
        const rows = (withNone ? [{ id: 0, name: '未归库' }] : []).concat(S.libs);
        if (!rows.length) return '<p class="uk-meta">还没有库，先新建一个</p>';
        return '<div class="as-pick" role="radiogroup">' + rows.map((l) => '<label class="as-pick-row"><input type="radio" name="lib" value="' + l.id + '"' + (String(l.id) === String(chosen) ? ' checked' : '') + '>' + icon(l.id ? 'folder' : 'inbox') + '<span>' + esc(l.name) + '</span>' + icon('check', 'uk-i as-pick-tick') + '</label>').join('') + '</div>';
      }
      function moveFilms(items) {
        const cur = groupId('lib:');
        UK.dialog({ title: '移动 ' + items.length + ' 个成片到', width: 420, body: libPicker(cur && cur !== '0' ? cur : '', false),
          actions: [{ key: 'cancel', label: '取消' }, { key: 'ok', label: '移动', kind: 'primary' }],
          onAction: async (k, c) => {
            if (k !== 'ok') return; const v = c.body.querySelector('input[name=lib]:checked')?.value; if (!v) { UK.toast('请选择成片组', 'info'); return false; }
            c.busy('ok', true);
            try { await pub('move', {}, { library_id: Number(v), refs: items.map((x) => x.ref) }); S.selected.clear(); UK.toast('已移到「' + (S.libs.find((l) => String(l.id) === v) || {}).name + '」'); refresh(); }
            catch (e) { c.busy('ok', false); UK.toast(e.message, 'fail'); return false; }
          } });
      }
      function moveDocs(items) {
        UK.dialog({ title: '移动 ' + items.length + ' 项到', width: 420, body: libPicker(items.length === 1 ? items[0].folder : 0, true),
          actions: [{ key: 'cancel', label: '取消' }, { key: 'ok', label: '移动', kind: 'primary' }],
          onAction: async (k, c) => {
            if (k !== 'ok') return; const v = c.body.querySelector('input[name=lib]:checked')?.value ?? '0';
            c.busy('ok', true);
            try { await ws('batch', {}, { kind: items[0].doc, action: 'move', ids: items.map((x) => x.id), folder_id: v }); S.selected.clear(); UK.toast('已移动'); refresh(); }
            catch (e) { c.busy('ok', false); UK.toast(e.message, 'fail'); return false; }
          } });
      }
      function libDialog(lib) {
        const kind = S.tab === 'films' ? 'video' : S.tab === 'images' ? 'finished_image' : DOC[S.tab];
        const name = kind === 'video' ? '成片组' : DOC_NAME[kind] + '库', editing = !!lib, warnable = ['video', 'image_text', 'copy'].includes(kind);
        const ctx = UK.dialog({ title: editing ? '编辑' + name : '新建' + name, width: 460,
          body: '<div class="as-form"><div class="uk-field"><label>名称</label><input class="uk-input" maxlength="' + (kind === 'video' ? 80 : 60) + '" value="' + esc(lib ? lib.name : '') + '" data-lname autofocus></div>' +
            (kind !== 'topic' ? '<div class="uk-field"><label>每条最多派发几次</label><div class="as-limit"><input class="uk-input num" type="number" min="0" max="100000" step="1" value="' + Number(lib ? lib.max_uses : 0) + '" data-lmax><span class="uk-meta">次</span></div><span class="as-hint">' + icon('info') + '填 0 表示不限。同一条在平台上发得太多容易被限流，建议 1–3 次。取消任务会退回次数。</span></div>' : '') +
            (warnable ? '<div class="uk-field"><label>没用过的少于几条时提醒</label><div class="as-limit"><input class="uk-input num" type="number" min="0" max="1000" step="1" value="' + Number(lib && lib.warn_below != null ? lib.warn_below : 5) + '" data-lwarn><span class="uk-meta">条</span></div><span class="as-hint">' + icon('info') + '低于这个数，作品库会提醒你补充。填 0 不提醒。</span></div>' : '') + '</div>',
          actions: [{ key: 'cancel', label: '取消' }, { key: 'ok', label: editing ? '保存' : '创建', kind: 'primary' }],
          onAction: async (k, c) => {
            if (k !== 'ok') return; const nm = c.body.querySelector('[data-lname]').value.trim(); if (!nm) { c.body.querySelector('[data-lname]').focus(); return false; }
            const max = Math.max(0, Math.floor(Number(c.body.querySelector('[data-lmax]')?.value || 0)));
            const warnEl = c.body.querySelector('[data-lwarn]'); const warn = warnEl ? Math.max(0, Math.floor(Number(warnEl.value || 0))) : undefined;
            c.busy('ok', true);
            try { await pub('catalogSave', {}, { kind, id: lib ? lib.id : 0, name: nm, parent_id: lib ? lib.parent_id || 0 : 0, sort: lib ? lib.sort || 0 : 0, max_uses: max, ...(warn !== undefined ? { warn_below: warn } : {}) }); UK.toast(editing ? '已保存' : name + '已创建'); loadGroups(); }
            catch (e) { c.busy('ok', false); UK.toast(e.message, 'fail'); return false; }
          } });
        ctx.body.querySelector('[data-lname]').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ctx.el.querySelector('[data-act=ok]').click(); } });
      }
      async function recycleLib(lib) {
        const kind = S.tab === 'films' ? 'video' : S.tab === 'images' ? 'finished_image' : DOC[S.tab];
        const film = kind === 'video';
        if (!(await UK.confirm({ title: '把「' + lib.name + '」移入回收站？', text: film ? '组里的成片不会删除，会回到「还没归组」。可以从回收站恢复。' : '只有空库可以移入回收站，可以随时恢复。', okText: '移入回收站', danger: true }))) return;
        try { await pub('catalogRecycle', {}, { kind, id: lib.id }); if (S.group.endsWith(':' + lib.id)) S.group = S.tab === 'films' ? 'overview' : 'all'; UK.toast('已移入回收站'); refresh(); }
        catch (e) { UK.toast(e.message, 'fail'); }
      }
      function libMenu(anchor, id) {
        const lib = S.libs.find((l) => String(l.id) === String(id)); if (!lib) return;
        UK.menu(anchor, [{ key: 'edit', label: '设置', icon: 'setting' }, '-', { key: 'del', label: '移入回收站', icon: 'delete', danger: true }], (k) => { if (k === 'edit') libDialog(lib); else recycleLib(lib); }, { align: 'right' });
      }
      function itemMenu(anchor, key) {
        const it = byKey(key); if (!it) return;
        const m = [];
        if (it.kind === 'article') { m.push({ key: 'copy', label: '复制正文', icon: 'copy' }, { key: 'geo', label: '去 GEO 编辑', icon: 'external' }); }
        else {
          m.push({ key: 'preview', label: it.kind === 'doc' ? '查看' : '预览', icon: 'eye' });
          if (it.film) m.push({ key: 'assign', label: '派给员工', icon: 'send' });
          if (S.tab === 'films') m.push({ key: 'move', label: '移到其他组…', icon: 'folder' });
          if (it.doc) m.push({ key: 'edit', label: '编辑', icon: 'edit' }, { key: 'docmove', label: '移到库…', icon: 'folder' });
          if (it.kind === 'doc') m.push({ key: 'copy', label: '复制正文', icon: 'copy' });
          if (it.kind === 'media') m.push({ key: 'download', label: '下载', icon: 'download' });
          if (it.trashable) m.push('-', { key: 'trash', label: '移入回收站', icon: 'delete', danger: true });
          else if (it.source === 'clip') m.push('-', { key: 'noop', label: '剪辑成片在剪辑工程里管理', icon: 'info', disabled: true });
        }
        UK.menu(anchor, m, (k) => {
          if (k === 'preview') preview(key); else if (k === 'assign') assign([it]); else if (k === 'move') moveFilms([it]); else if (k === 'docmove') moveDocs([it]);
          else if (k === 'edit') docEditor(it); else if (k === 'download') download([it]); else if (k === 'trash') trash([it]);
          else if (k === 'geo') UK.go('/ai/geo#articles'); else if (k === 'copy') copyText(it.text);
        }, { align: 'right' });
      }
      async function copyText(t) { try { await navigator.clipboard.writeText(t); UK.toast('已复制正文'); } catch (e) { UK.toast('复制失败，请手动选择文字复制', 'fail'); } }
      function preview(key) {
        const list = S.rows, idx = Math.max(0, list.findIndex((r) => r.key === key));
        const items = list.map((it) => it.kind === 'media'
          ? { kind: it.type, url: it.url, resolve: it.needsLink ? () => delivery(it.ref) : null, title: it.title, meta: [it.tool, it.w && it.h ? it.w + '×' + it.h : '', it.d ? dur(it.d) : '', ago(it.time)] }
          : { kind: 'text', title: it.title, text: (it.kind === 'article' ? '' : '') + it.text, meta: it.kind === 'article' ? [it.brand, it.category, it.words ? fmt(it.words) + ' 字' : ''] : [DOC_NAME[it.doc], ago(it.time)] });
        const acts = (it) => it.kind === 'media' ? [...(it.film ? [{ key: 'assign', label: '派给员工', icon: 'send' }] : []), { key: 'download', label: '下载', icon: 'download' }] : it.kind === 'article' ? [{ key: 'copy', label: '复制正文', icon: 'copy' }, { key: 'geo', label: '去 GEO 编辑', icon: 'external' }] : [{ key: 'copy', label: '复制正文', icon: 'copy' }, { key: 'edit', label: '编辑', icon: 'edit' }];
        const first = list[idx];
        UK.lightbox({ items, index: idx, actions: acts(first), onAction: (k, _x, i, lb) => {
          const it = list[i];
          if (k === 'assign') { lb.close(); assign([it]); } else if (k === 'download') download([it]); else if (k === 'copy') copyText(it.text);
          else if (k === 'edit') { lb.close(); docEditor(it); } else if (k === 'geo') { lb.close(); UK.go('/ai/geo#articles'); }
        } });
      }

      /* ---------- K3 派给员工 (step dialog) ---------- */
      async function assign(films, opts = {}) {
        films = films.filter((x) => x.film); if (!films.length) return;
        const group = opts.group || null, unusedN = films.filter((f) => f.usage && f.usage.state === 'unused').length;
        const picks = () => group ? films.slice(0, Math.max(1, st.staff.size)) : films;
        const key = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/-/g, '').slice(0, 40);
        const st = { step: 0, staff: new Set(), platforms: new Set(['douyin']), copyMode: 'lib', topicMode: 'lib', when: 'now' };
        const ctx = UK.dialog({ title: '派给员工', width: 640, body: '<div class="as-assign">' + UK.skel('100%', 44, 12) + UK.skel('100%', 160, 12) + '</div>',
          footLeft: '<span class="as-steps" data-steps></span>',
          actions: [{ key: 'back', label: '上一步' }, { key: 'next', label: '下一步', kind: 'primary' }],
          onAction: async (k, c) => {
            if (k === 'back') { if (st.step) { st.step--; draw(); } return false; }
            if (st.step < 2) { const err = check(); if (err) { UK.toast(err, 'info'); return false; } st.step++; draw(); return false; }
            const err = check(); if (err) { UK.toast(err, 'info'); return false; }
            c.busy('next', true);
            try {
              const v = (s) => c.body.querySelector(s);
              const due = st.when === 'later' ? Math.floor(new Date(st.due).getTime() / 1000) : 0;
              const r = await pub('create', {}, { request_key: key, title: st.title, content: st.content, staff_ids: [...st.staff], refs: picks().map((x) => x.ref), platforms: [...st.platforms],
                copy_text: st.copyMode === 'text' ? st.copy || '' : '', copy_folder_id: st.copyMode === 'lib' ? Number(st.copyFolder || 0) : 0, topics: st.topicMode === 'text' ? st.topics || '' : '', topic_folder_id: st.topicMode === 'lib' ? Number(st.topicFolder || 0) : 0,
                due_time: due, deadline: st.deadline ? Math.floor(new Date(st.deadline).getTime() / 1000) : 0 });
              S.selected.clear(); paintSelection();
              UK.toast(r && r.notice ? r.notice : '任务已创建，员工会收到通知'); loadGroups(); if (S.rows.length) load();
            } catch (e) { c.busy('next', false); UK.toast(e.message, 'fail'); return false; }
          } });
        let staff = [], stores = [], copyLibs = [], topicLibs = [];
        try {
          const [sd, c1, c2, tg] = await Promise.all([pub('staff'), ws('folders', { kind: 'image_text' }), ws('folders', { kind: 'copy' }), ws('folders', { kind: 'topic' })]);
          staff = (sd.lists || []).filter((r) => Number(r.status) === 1); stores = sd.stores || [];
          copyLibs = [...(c1.lists || []), ...(c2.lists || [])]; topicLibs = tg.lists || [];
        } catch (e) { ctx.body.innerHTML = '<p class="uk-meta">' + esc(e.message) + '</p>'; return; }
        if (!copyLibs.length) st.copyMode = 'text'; if (!topicLibs.length) st.topicMode = 'text';
        st.copyFolder = copyLibs[0] ? copyLibs[0].id : 0; st.topicFolder = topicLibs[0] ? topicLibs[0].id : 0;
        st.title = group ? ('发布「' + group.name + '」成片').slice(0, 80) : films.length === 1 ? ('发布「' + films[0].title + '」').slice(0, 80) : '发布 ' + films.length + ' 条成片';
        st.content = '请把这条视频发布到下面的平台，发布后回来提交作品链接。';
        const filmStrip = () => { const list = picks(); return '<div class="as-assign-films">' + list.slice(0, 5).map((f) => '<span class="as-af">' + (f.cover ? '<img src="' + esc(f.cover) + '" alt="">' : f.url ? '<video src="' + esc(f.url) + '#t=0.1" muted preload="metadata"></video>' : icon('video')) + '</span>').join('') +
          '<span class="as-af-copy"><b>' + (group ? '从「' + esc(group.name) + '」自动挑 ' + list.length + ' 条' : list.length === 1 ? esc(list[0].title) : list.length + ' 条成片') + '</b><span class="uk-meta">' + (group ? '没用过的优先，每位员工一条，不重复' : list.length > 1 ? '按员工顺序轮流分配，每人一条' : '每位员工都发这一条') + '</span></span></div>'; };
        function check() {
          const v = (s) => ctx.body.querySelector(s);
          if (st.step === 0) return st.staff.size ? '' : '请至少选择一位员工';
          if (st.step === 1) {
            st.title = (v('[data-a-title]')?.value ?? st.title).trim(); st.content = (v('[data-a-content]')?.value ?? st.content).trim();
            if (v('[data-a-copy]')) st.copy = v('[data-a-copy]').value.trim(); if (v('[data-a-topics]')) st.topics = v('[data-a-topics]').value.trim();
            if (v('[data-a-copylib]')) st.copyFolder = v('[data-a-copylib]').value; if (v('[data-a-topiclib]')) st.topicFolder = v('[data-a-topiclib]').value;
            if (!st.platforms.size) return '请选择至少一个发布平台';
            if (!st.title) return '请填写任务名称';
            if (!st.content) return '请填写给员工的说明';
            if (st.copyMode === 'text' && !st.copy) return '请填写发布文案，或选择文案库';
            return '';
          }
          if (v('[data-a-due]')) st.due = v('[data-a-due]').value; if (v('[data-a-deadline]')) st.deadline = v('[data-a-deadline]').value;
          if (st.when === 'later') { const t = new Date(st.due).getTime(); if (!t || t <= Date.now()) return '定时推送时间要晚于现在'; }
          if (st.deadline) { const d = new Date(st.deadline).getTime(), from = st.when === 'later' ? new Date(st.due).getTime() : Date.now(); if (d <= from) return '截止时间要晚于推送时间'; }
          return '';
        }
        function draw() {
          const steps = ['选员工', '发布内容', '推送时间'];
          ctx.el.querySelector('[data-steps]').innerHTML = steps.map((s, i) => '<span class="' + (i === st.step ? 'is-on' : i < st.step ? 'is-done' : '') + '"><i class="num">' + (i < st.step ? '' : i + 1) + '</i>' + s + '</span>').join('');
          const back = ctx.el.querySelector('[data-act=back]'); back.hidden = st.step === 0;
          const next = ctx.el.querySelector('[data-act=next] span'); next.textContent = st.step === 2 ? '创建任务并通知' : '下一步';
          let html = filmStrip();
          if (st.step === 0) {
            if (!staff.length) html += '<div class="as-assign-empty">' + icon('users') + '<b>还没有可用的员工</b><span class="uk-meta">员工在「品牌与门店」的门店详情里添加</span>' + btn({ kind: 'secondary', size: 'sm', label: '去添加员工', attrs: { 'data-go': '/ai/stores' } }) + '</div>';
            else {
              const unbound = staff.filter((s) => st.staff.has(s.id) && !s.wechat_bound).length;
              const byStore = {}; staff.forEach((s) => { (byStore[s.store_name] = byStore[s.store_name] || []).push(s); });
              html += '<div class="as-staff-bar"><label class="uk-search">' + icon('search') + '<input class="uk-input" type="search" aria-label="搜索作品名称" placeholder="搜索员工姓名或手机号" data-a-search></label><span class="uk-meta">已选 <b class="num">' + st.staff.size + '</b> / ' + staff.length + '</span></div>' +
                (unbound ? '<div class="uk-notice">' + icon('warn') + '<span class="uk-grow">' + unbound + ' 名员工还没绑定微信，收不到任务通知</span></div>' : '') +
                (group && st.staff.size > unusedN ? '<div class="uk-notice">' + icon('warn') + '<span class="uk-grow">没用过的只有 <b class="num">' + unusedN + '</b> 条，' + (st.staff.size > films.length ? '成片不够每人一条，会有员工拿到同一条' : '有 <b class="num">' + (st.staff.size - unusedN) + '</b> 位员工会拿到派发过的成片') + '</span>' + btn({ kind: 'ai', size: 'sm', icon: 'spark', label: '先补充', attrs: { 'data-a-refill': '' } }) + '</div>' : '') +
                '<div class="as-staff">' + Object.entries(byStore).map(([store, list]) => '<div class="as-staff-group"><div class="as-staff-head"><b>' + esc(store) + '</b><button type="button" class="uk-link" data-a-store="' + esc(store) + '">' + (list.every((s) => st.staff.has(s.id)) ? '取消全选' : '全选') + '</button></div>' +
                  list.map((s) => '<label class="as-staff-row" data-name="' + esc((s.name + ' ' + (s.mobile || '')).toLowerCase()) + '"><input type="checkbox" value="' + s.id + '"' + (st.staff.has(s.id) ? ' checked' : '') + '><span class="as-avatar">' + esc((String(s.name || '').replace(/[（(【\[].*?[)）】\]]/g, '').replace(/[^\p{L}\p{N}]/gu, '') || '?').slice(-1)) + '</span><span class="as-staff-name"><b>' + esc(s.name) + '</b><span class="uk-meta num">' + esc(s.mobile || '') + '</span></span>' +
                    (s.wechat_bound ? '<span class="uk-status ok">已绑定微信</span>' : '<span class="uk-status" style="--c:var(--ui-warning,#E08A00)">未绑定微信</span>') + icon('check', 'uk-i as-pick-tick') + '</label>').join('') + '</div>').join('') + '</div>';
            }
          } else if (st.step === 1) {
            const seg = (name, mode, has) => '<div class="uk-seg" role="group">' + [['lib', '从库里自动选'], ['text', '手动填写']].map(([k, l]) => '<button type="button" data-a-mode="' + name + ':' + k + '" aria-pressed="' + (mode === k) + '"' + (k === 'lib' && !has ? ' disabled' : '') + '>' + l + '</button>').join('') + '</div>';
            html += '<div class="as-form">' +
              '<div class="uk-field"><label>发布到哪些平台</label><div class="as-platforms">' + [['douyin', '抖音'], ['kuaishou', '快手'], ['xiaohongshu', '小红书']].map(([k, l]) => '<button type="button" class="as-plat" data-a-plat="' + k + '" aria-pressed="' + st.platforms.has(k) + '"><img src="/merchant/design-assets/' + k + '.png" alt="">' + l + icon('check', 'uk-i as-pick-tick') + '</button>').join('') + '</div></div>' +
              '<div class="uk-field"><div class="as-field-head"><label>发布文案</label>' + seg('copy', st.copyMode, copyLibs.length) + '</div>' +
                (st.copyMode === 'lib' ? '<select class="uk-select" data-a-copylib>' + copyLibs.map((l) => '<option value="' + l.id + '"' + (String(l.id) === String(st.copyFolder) ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('') + '</select><span class="as-hint">' + icon('info') + '按员工所在门店，从库里挑本店或通用的文案，每人一条</span>'
                  : '<textarea class="uk-textarea" rows="3" maxlength="10000" placeholder="员工发布时使用的文案" data-a-copy>' + esc(st.copy || '') + '</textarea>') + '</div>' +
              '<div class="uk-field"><div class="as-field-head"><label>话题</label>' + seg('topic', st.topicMode, topicLibs.length) + '</div>' +
                (st.topicMode === 'lib' ? '<select class="uk-select" data-a-topiclib>' + topicLibs.map((l) => '<option value="' + l.id + '"' + (String(l.id) === String(st.topicFolder) ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('') + '</select>'
                  : '<input class="uk-input" maxlength="1000" placeholder="例如 #门店好物 #本地生活（可不填）" value="' + esc(st.topics || '') + '" data-a-topics>') + '</div>' +
              '<div class="as-form-2"><div class="uk-field"><label>任务名称</label><input class="uk-input" maxlength="80" value="' + esc(st.title) + '" data-a-title></div></div>' +
              '<div class="uk-field"><label>给员工的说明</label><textarea class="uk-textarea" rows="2" maxlength="500" data-a-content>' + esc(st.content) + '</textarea></div></div>';
          } else {
            const unbound = staff.filter((s) => st.staff.has(s.id) && !s.wechat_bound).length;
            html += '<div class="as-form"><div class="uk-field"><label>什么时候通知员工</label><div class="uk-seg as-when" role="group">' + [['now', '现在'], ['later', '定个时间']].map(([k, l]) => '<button type="button" data-a-when="' + k + '" aria-pressed="' + (st.when === k) + '">' + l + '</button>').join('') + '</div>' +
              (st.when === 'later' ? '<input class="uk-input" type="datetime-local" value="' + esc(st.due || '') + '" data-a-due>' : '') + '</div>' +
              '<div class="uk-field"><label>截止时间（可不填）</label><input class="uk-input" type="datetime-local" value="' + esc(st.deadline || '') + '" data-a-deadline></div>' +
              '<div class="as-summary"><div><span class="uk-meta">员工</span><b class="num">' + st.staff.size + ' 人</b></div><div><span class="uk-meta">平台</span><b>' + [...st.platforms].map((p) => PLATFORMS[p]).join('、') + '</b></div><div><span class="uk-meta">成片</span><b class="num">' + picks().length + ' 条</b></div></div>' +
              (unbound ? '<div class="uk-notice">' + icon('warn') + '<span class="uk-grow">' + unbound + ' 名员工没绑定微信，任务会出现在他们的任务链接里，但不会收到通知</span></div>' : '') + '</div>';
          }
          ctx.body.innerHTML = '<div class="as-assign">' + html + '</div>';
        }
        ctx.body.addEventListener('change', (e) => {
          const cb = e.target.closest('.as-staff-row input'); if (cb) { const id = Number(cb.value); cb.checked ? st.staff.add(id) : st.staff.delete(id); const keep = ctx.body.querySelector('.as-staff')?.scrollTop; draw(); const box = ctx.body.querySelector('.as-staff'); if (box) box.scrollTop = keep; }
        });
        ctx.body.addEventListener('input', (e) => {
          if (e.target.matches('[data-a-search]')) { const q = e.target.value.trim().toLowerCase(); ctx.body.querySelectorAll('.as-staff-row').forEach((r) => { r.hidden = !!q && !r.dataset.name.includes(q); }); }
        });
        ctx.body.addEventListener('click', (e) => {
          const s = e.target.closest('[data-a-store]'); if (s) { const list = staff.filter((x) => x.store_name === s.dataset.aStore); const all = list.every((x) => st.staff.has(x.id)); list.forEach((x) => all ? st.staff.delete(x.id) : st.staff.add(x.id)); draw(); return; }
          const p = e.target.closest('[data-a-plat]'); if (p) { check(); const k = p.dataset.aPlat; st.platforms.has(k) ? st.platforms.delete(k) : st.platforms.add(k); draw(); return; }
          const m = e.target.closest('[data-a-mode]'); if (m && !m.disabled) { check(); const [name, mode] = m.dataset.aMode.split(':'); st[name + 'Mode'] = mode; draw(); return; }
          const w = e.target.closest('[data-a-when]'); if (w) { check(); st.when = w.dataset.aWhen; draw(); return; }
          const go = e.target.closest('[data-go]'); if (go) { ctx.close(); UK.go(go.dataset.go); return; }
          const rf = e.target.closest('[data-a-refill]'); if (rf && group) { ctx.close(); const anchor = root.querySelector('[data-refill="' + group.id + '"]'); if (anchor) refillMenu(anchor, group.id); }
        });
        draw();
      }

      /* ---------- doc editor (图文 / 文案 / 话题 / 图片库) ---------- */
      async function docEditor(it) {
        const kind = it ? it.doc : S.tab === 'images' ? 'finished_image' : DOC[S.tab];
        const name = DOC_NAME[kind], files = it ? [...it.files] : [];
        const folder = it ? it.folder : Number(groupId('folder:') || 0);
        const many = kind === 'image_text', needPic = kind === 'image_text' || kind === 'finished_image';
        const libs = S.libs;
        const ph = { image_text: '配图对应的文案，员工发布时一起使用', copy: '员工发布时使用的文案', topic: '例如 #门店好物 #本地生活 #周末去哪儿', finished_image: '可不填' }[kind];
        const ctx = UK.dialog({ title: (it ? '编辑' : '新增') + name, width: 560,
          body: '<div class="as-form">' +
            (needPic ? '<div class="uk-field"><label>' + (many ? '配图（最多 9 张）' : '图片') + '</label><div class="as-pics" data-pics></div></div>' : '') +
            '<div class="uk-field"><label>' + (kind === 'topic' ? '话题库名称' : '标题') + '</label><input class="uk-input" maxlength="100" value="' + esc(it ? it.title : '') + '" data-dname autofocus></div>' +
            (kind !== 'finished_image' ? '<div class="uk-field"><label>' + (kind === 'topic' ? '话题' : '正文') + '</label><textarea class="uk-textarea" rows="' + (kind === 'topic' ? 3 : 6) + '" maxlength="10000" placeholder="' + esc(ph) + '" data-dtext>' + esc(it ? it.text : '') + '</textarea><span class="as-count num" data-dcount></span></div>' : '') +
            '<div class="as-form-2"><div class="uk-field"><label>放在</label><select class="uk-select" data-dfolder><option value="0">未归库</option>' + libs.map((l) => '<option value="' + l.id + '"' + (Number(l.id) === folder ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('') + '</select></div>' +
            '<div class="uk-field"><label>适用门店</label><select class="uk-select" data-dstore><option value="0">所有门店通用</option></select></div></div></div>',
          actions: [{ key: 'cancel', label: '取消' }, { key: 'ok', label: '保存', kind: 'primary' }],
          onAction: async (k, c) => {
            if (k !== 'ok') return;
            const nm = c.body.querySelector('[data-dname]').value.trim(), text = c.body.querySelector('[data-dtext]')?.value.trim() || '';
            if (!nm) { c.body.querySelector('[data-dname]').focus(); return false; }
            if ((kind === 'copy' || kind === 'topic') && !text) { UK.toast('请填写' + (kind === 'topic' ? '话题' : '正文'), 'info'); return false; }
            if (needPic && !files.length) { UK.toast('请先上传图片', 'info'); return false; }
            c.busy('ok', true);
            try {
              await ws('materialSave', {}, { id: it ? it.id : 0, kind, name: nm, folder_id: Number(c.body.querySelector('[data-dfolder]').value), tags: it ? it.raw.tags || '' : '', content: text, file_ids: files.map((f) => Number(f.id)), store_id: Number(c.body.querySelector('[data-dstore]').value), label_ids: it ? (it.raw.label_ids || []).map(Number) : [] });
              UK.toast(it ? '已保存' : name + '已添加'); refresh();
            } catch (e) { c.busy('ok', false); UK.toast(e.message, 'fail'); return false; }
          } });
        const count = () => { const t = ctx.body.querySelector('[data-dtext]'), c = ctx.body.querySelector('[data-dcount]'); if (t && c) c.textContent = t.value.length ? fmt(t.value.length) + ' 字' : ''; };
        ctx.body.querySelector('[data-dtext]')?.addEventListener('input', count); count();
        const drawPics = () => {
          const box = ctx.body.querySelector('[data-pics]'); if (!box) return;
          box.innerHTML = files.map((f, i) => '<span class="as-pic"><img src="' + esc(f.url) + '" alt=""><button type="button" data-pic-del="' + i + '" aria-label="移除这张">' + icon('close') + '</button></span>').join('') +
            (files.length < (many ? 9 : 1) ? '<label class="as-pic-add">' + icon('plus') + '<span>上传</span><input type="file" accept=".jpg,.jpeg,.png,.webp,.gif"' + (many ? ' multiple' : '') + ' hidden data-pic-input></label>' : '');
        };
        drawPics();
        ctx.body.addEventListener('click', (e) => { const d = e.target.closest('[data-pic-del]'); if (d) { files.splice(Number(d.dataset.picDel), 1); drawPics(); } });
        ctx.body.addEventListener('change', async (e) => {
          if (!e.target.matches('[data-pic-input]')) return;
          const picked = [...e.target.files].slice(0, (many ? 9 : 1) - files.length); e.target.value = '';
          const add = ctx.body.querySelector('.as-pic-add'); if (add) add.classList.add('is-busy');
          for (const file of picked) {
            if (file.size > 20 * 1048576) { UK.toast(file.name + ' 超过 20MB，已跳过', 'info'); continue; }
            try {
              const fd = new FormData(); fd.append('file', file); fd.append('kind', 'image'); fd.append('folder_id', '0'); fd.append('attach_only', '1');
              const t = UK.tenant(); const txt = await fetch('/api/merchantWorkspace/upload' + (t ? '?tenant_id=' + t : ''), { method: 'POST', credentials: 'same-origin', headers: { token: token() }, body: fd }).then((r) => r.text());
              const k = txt.indexOf('{"code"'); const r = JSON.parse(k >= 0 ? txt.slice(k) : txt);
              if (r.code !== 1) throw new Error(r.msg || '上传失败');
              files.push({ id: r.data.file.id, url: r.data.file.uri || r.data.file.url });
            } catch (err) { UK.toast(err.message, 'fail'); }
          }
          drawPics();
        });
        try {
          const stores = await ws('choices', { kind: 'store', keyword: '' }); const sel = ctx.body.querySelector('[data-dstore]'); if (!sel) return;
          const cur = it ? it.store : 0;
          sel.innerHTML = '<option value="0">所有门店通用</option>' + (stores || []).map((s) => '<option value="' + s.id + '"' + (Number(s.id) === cur ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
        } catch (e) {}
      }

      /* ---------- K6 回收站 ---------- */
      function trashDrawer() {
        const SEG = [['works', '作品'], ['image_text', '图文'], ['copy', '文案'], ['topic', '话题'], ['finished_image', '图片库'], ['libs', '库']];
        let seg = 'works';
        const ctx = UK.dialog({ drawer: true, width: 480, title: '回收站', body: '<div class="as-trash"></div>' });
        const box = () => ctx.body.querySelector('.as-trash');
        async function draw() {
          box().innerHTML = '<div class="uk-seg as-trash-seg" role="group">' + SEG.map(([k, l]) => '<button type="button" data-seg="' + k + '" aria-pressed="' + (seg === k) + '">' + l + '</button>').join('') + '</div><div class="as-trash-list">' + UK.skel('100%', 56, 12) + UK.skel('100%', 56, 12) + '</div>';
          let rows = [];
          try {
            if (seg === 'works') {
              const d = await assets('state');
              rows = (d.supplemental || []).filter((a) => (d.states || []).some((s) => s.asset_ref === a.ref && Number(s.trashed_at) && !Number(s.hidden_at)))
                .map((a) => ({ id: a.ref, title: (a.raw && (a.raw.title || a.raw.prompt || a.raw.script_text)) || '作品', img: a.raw && (a.raw.image_url || a.raw.cover_url), video: a.raw && a.raw.video_url, when: ((d.states || []).find((s) => s.asset_ref === a.ref) || {}).trashed_at }));
            } else if (seg === 'libs') {
              const kinds = [['video', '成片库'], ['image_text', '图文库'], ['copy', '文案库'], ['topic', '话题库'], ['finished_image', '图片库']];
              const all = await Promise.all(kinds.map(([k]) => pub('catalogs', { kind: k, trash: '1', page: 1, page_size: 48 }).catch(() => ({ lists: [] }))));
              rows = all.flatMap((d, i) => (d.lists || []).map((l) => ({ id: kinds[i][0] + ':' + l.id, title: l.name, sub: kinds[i][1], when: l.delete_time || l.update_time, icon: 'folder' })));
            } else {
              const d = await ws('library', { kind: seg, folder_id: '', trash: '1', page: 1, page_size: 72 });
              rows = (d.lists || []).map((r) => ({ id: r.id, title: r.name, img: r.files && r.files[0] && r.files[0].url, text: r.content, when: r.delete_time || r.update_time }));
            }
          } catch (e) { ctx.body.querySelector('.as-trash-list').innerHTML = '<p class="uk-meta">' + esc(e.message) + '</p>'; return; }
          const list = ctx.body.querySelector('.as-trash-list');
          list.innerHTML = rows.length ? '<div class="as-trash-head"><span class="uk-meta">' + rows.length + ' 项 · 可以随时恢复</span>' + btn({ kind: 'secondary', size: 'sm', icon: 'restore', label: '全部恢复', attrs: { 'data-restore-all': '' } }) + '</div>' +
            rows.map((r) => '<div class="as-trash-row"><span class="as-trash-thumb">' + (r.img ? '<img src="' + esc(r.img) + '" alt="">' : r.video ? '<video src="' + esc(r.video) + '#t=0.1" muted preload="metadata"></video>' : icon(r.icon || (seg === 'topic' ? 'hash' : 'text'))) + '</span><span class="as-trash-copy"><b>' + esc(String(r.title).slice(0, 60)) + '</b><span class="uk-meta">' + esc([r.sub, r.when ? '删除于 ' + ago(r.when) : ''].filter(Boolean).join(' · ')) + '</span></span>' + btn({ kind: 'ghost', size: 'sm', label: '恢复', attrs: { 'data-restore': String(r.id) } }) + '</div>').join('')
            : empty({ icon: 'delete', title: '这里是空的', compact: true });
          const restore = async (ids, b) => {
            b && b.classList.add('is-busy');
            try {
              if (seg === 'works') await assets('update', {}, { refs: ids, action: 'restore' });
              else if (seg === 'libs') for (const id of ids) { const [kind, lid] = id.split(':'); await pub('catalogRecycle', {}, { kind, id: Number(lid), restore: '1' }); }
              else await ws('batch', {}, { kind: seg, action: 'restore', ids: ids.map(Number) });
              UK.toast(ids.length > 1 ? '已全部恢复' : '已恢复'); refresh(); draw();
            } catch (e) { b && b.classList.remove('is-busy'); UK.toast(e.message, 'fail'); }
          };
          list.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', () => restore([b.dataset.restore], b)));
          list.querySelector('[data-restore-all]')?.addEventListener('click', (e) => restore(rows.map((r) => String(r.id)), e.currentTarget));
        }
        ctx.body.addEventListener('click', (e) => { const b = e.target.closest('[data-seg]'); if (b) { seg = b.dataset.seg; draw(); } });
        draw();
      }

      /* ---------- events ---------- */
      let kwTimer = 0, composing = false;
      function searchInput(e) {
        if (!e.target.matches('[data-keyword]') || composing || e.isComposing) return;
        clearTimeout(kwTimer);
        kwTimer = setTimeout(() => { if (S.dead) return; S.keyword = e.target.value.trim(); S.page = 1; S.rows = []; load(); }, 350);
      }
      root.addEventListener('input', searchInput);
      root.addEventListener('compositionstart', e => { if (e.target.matches('[data-keyword]')) { composing = true; clearTimeout(kwTimer); } });
      root.addEventListener('compositionend', e => { if (e.target.matches('[data-keyword]')) { composing = false; searchInput(e); } });
      root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-preview],[data-open-lib]')) { e.preventDefault(); e.target.click(); } });
      root.addEventListener('click', (e) => {
        const t = e.target;
        if (t.closest('[data-trash]')) return trashDrawer();
        if (t.closest('[data-reload]')) return refresh();
        if (t.closest('[data-new-lib]')) return libDialog(null);
        if (t.closest('[data-new-doc]')) return docEditor(null);
        if (t.closest('[data-go-geo]')) return UK.go('/ai/geo#articles');
        const mk = t.closest('[data-make-film]'); if (mk) return refillMenu(mk, null);
        const lm = t.closest('[data-lib-menu]'); if (lm) { e.stopPropagation(); return libMenu(lm, lm.dataset.libMenu); }
        const al = t.closest('[data-assign-lib]'); if (al) { e.stopPropagation(); return assignGroup(al.dataset.assignLib); }
        const rf = t.closest('[data-refill]'); if (rf) { e.stopPropagation(); return refillMenu(rf, rf.dataset.refill); }
        const le = t.closest('[data-lib-edit]'); if (le) { const lib = libOf(le.dataset.libEdit); if (lib) libDialog(lib); return; }
        if (t.closest('[data-back]')) { S.group = 'overview'; S.usage = ''; S.selected.clear(); paintSelection(); drawFilms(); load(); return; }
        const us = t.closest('[data-usage]'); if (us) { S.usage = us.dataset.usage; S.page = 1; S.rows = []; drawTools(); load(); return; }
        const ol = t.closest('[data-open-lib]'); if (ol) { S.group = 'lib:' + ol.dataset.openLib; S.usage = ''; S.page = 1; S.rows = []; S.selected.clear(); paintSelection(); drawFilms(); drawTools(); load(); root.querySelector('.uk-page').scrollIntoView({ block: 'start' }); return; }
        const gr = t.closest('[data-group]'); if (gr) { S.group = gr.dataset.group; S.page = 1; S.rows = []; S.selected.clear(); if (S.group.startsWith('tool:')) S.type = ''; drawGroups(); drawTools(); paintSelection(); load(); return; }
        const ty = t.closest('[data-type]'); if (ty) { S.type = ty.dataset.type; S.page = 1; S.rows = []; drawTools(); load(); return; }
        if (t.closest('[data-clear]')) { S.keyword = ''; S.type = ''; S.page = 1; drawTools(); load(); return; }
        const pg = t.closest('[data-page]'); if (pg && !pg.disabled) { S.page = Number(pg.dataset.page); S.selected.clear(); paintSelection(); load(); root.querySelector('.as-main').scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
        const pk = t.closest('[data-pick]'); if (pk) { e.stopPropagation(); const it = byKey(pk.dataset.pick); if (it) { S.selected.has(it.key) ? S.selected.delete(it.key) : S.selected.set(it.key, it); paintSelection(); } return; }
        const as = t.closest('[data-assign]'); if (as) { e.stopPropagation(); const it = byKey(as.dataset.assign); if (it) assign([it]); return; }
        const dl = t.closest('[data-download]'); if (dl) { e.stopPropagation(); const it = byKey(dl.dataset.download); if (it) download([it]); return; }
        const im = t.closest('[data-item-menu]'); if (im) { e.stopPropagation(); return itemMenu(im, im.dataset.itemMenu); }
        const pv = t.closest('[data-preview]');
        if (pv) { if (S.selected.size && pv.closest('[data-key]') && byKey(pv.dataset.preview)?.kind !== 'article') { const it = byKey(pv.dataset.preview); S.selected.has(it.key) ? S.selected.delete(it.key) : S.selected.set(it.key, it); paintSelection(); return; } return preview(pv.dataset.preview); }
      });

      function setTab(tab) {
        if (tab === S.tab) return;
        clearTimeout(kwTimer); composing = false;
        Object.assign(S, { tab, group: tab === 'films' ? 'overview' : 'all', usage: '', page: 1, keyword: '', type: '', rows: [], total: 0, groups: [], libs: [] }); S.selected.clear();
        layout(); drawHead(); drawTabs(); $('.as-groups').innerHTML = ''; $('.as-films').innerHTML = ''; $('.as-dslot').innerHTML = ''; drawTools(); paintSelection(); $('.as-pager').innerHTML = '';
        loadGroups(); load();
      }
      root._setTab = setTab;
      root._cleanup = () => { S.dead = true; ++S.seq; ++S.gseq; ++S.cseq; clearTimeout(kwTimer); UK.batch(null); io && io.disconnect(); };
      layout(); drawHead(); drawTabs(); drawTools(); refresh();
    }

    UK.page({
      key: 'assets',
      match: (p) => p === '/ai/assets',
      mount: page,
      update(root) { root._setTab && root._setTab(tabFromUrl()); },
      unmount(root) { root._cleanup && root._cleanup(); }
    });
  };
  if (window.UK) boot(); else document.addEventListener('uk:ready', boot, { once: true });
})();
