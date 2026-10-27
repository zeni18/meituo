/* Merchant UI v2 — GEO 营销 (/ai/geo), built on ui-kit.js. First batch: 诊断 and 效果.
   What the merchant does here: see how often AI platforms mention the brand, start a diagnosis, and see what the
   content and publishing work has produced.
   - #diagnose            平台可见度 (focus card + platform cards + recent questions)
   - #diagnose-records    自动诊断批次 (drawer with answers, citations, billing)
   - #diagnose-evidence   人工观察 (manual evidence, add a record)
   - #effect              数据总览 (KPIs, 14-day trend, task states, latest published, readiness)
   - #effect-jobs         任务与 TP
   Old hashes (overview, reports, jobs, diagnostic-reports, evidence, query, keyword-index, optimize) map onto these.
   Content (#articles …) and publishing (#website …) still render the Semi app until their batches land;
   geo-semi-loader.js stands down while this page owns the route (UK_OWNS).
   APIs: merchantGeo dashboard, workspaceReport, visibilityOptions, visibilityRecords, visibilityPreview,
   visibilityStart, workflow, workflowAction, options, generate, jobs, importResult, profile, workspaceRecords,
   contentSave; merchantWorkspace brandChoices. Every merchantGeo call carries brand_id. */
(() => {
  'use strict';
  const boot = () => {
    const UK = window.UK; if (!UK) return;
    const { esc, icon, fmt, ago, btn, empty, status } = UK;

    /* ---------- routing ----------
       Other areas (内容 geo-content.js, later 发布) register in window.GEO_AREAS before this file runs:
       { views:{hash:[area,sub]}, alias:{oldHash:hash}, intents:{oldHash:name}, create(G) → area api }. */
    const AREAS = window.GEO_AREAS || (window.GEO_AREAS = {});
    const BASE_VIEWS = { diagnose: ['diagnose', 'visibility'], 'diagnose-records': ['diagnose', 'records'], 'diagnose-evidence': ['diagnose', 'evidence'], effect: ['effect', 'overview'], 'effect-jobs': ['effect', 'jobs'] };
    const BASE_ALIAS = { '': 'diagnose', overview: 'effect', reports: 'effect', 'keyword-index': 'effect', jobs: 'effect-jobs', 'writing-jobs': 'effect-jobs', 'diagnostic-reports': 'diagnose-records', evidence: 'diagnose-evidence', query: 'diagnose-evidence', optimize: 'diagnose' };
    const merged = (base, field) => Object.assign({}, base, ...Object.values(AREAS).map((a) => a[field] || {}));
    const views = () => merged(BASE_VIEWS, 'views'), aliases = () => merged(BASE_ALIAS, 'alias'), intents = () => merged({}, 'intents');
    const hashKey = () => location.hash.slice(1).split('?')[0];
    const hashParams = () => Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || ''));
    const viewOf = () => { const k = hashKey(), V = views(), A = aliases(); if (V[k]) return k; if (k in A) return A[k]; const v = new URLSearchParams(location.search).get('view'); return v === 'overview' ? 'effect' : v === 'jobs' ? 'effect-jobs' : v === 'articles' || v === 'create' ? 'articles' : v === 'materials' ? 'materials' : null; };
    const brandParam = () => new URLSearchParams(location.search).get('brand_id') || '';

    /* ---------- api: tenant + brand in the query, token + cookie, tolerant of PHP notices ---------- */
    const token = () => { const m = document.cookie.match(/(?:^|; )token=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; };
    // A thrown error carries .answered = true when the server replied with a business error (nothing was accepted);
    // network failures leave it unset so paid submissions can be retried with the same request_key.
    async function call(ctrl, action, params, body) {
      const q = new URLSearchParams(); Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
      const t = UK.tenant(); if (t) q.set('tenant_id', t);
      let txt;
      try { txt = await fetch('/api/' + ctrl + '/' + action + '?' + q, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', token: token() }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.text()); }
      catch (e) { throw new Error('网络连接失败，请重试'); }
      let r = null; try { r = JSON.parse(txt); } catch (e) { const k = txt.indexOf('{"code"'); if (k >= 0) try { r = JSON.parse(txt.slice(k)); } catch (e2) {} }
      if (!r) throw new Error('服务返回异常，请重试');
      if (r.code !== 1) { if (r.code === -1) location.replace('/login' + (t ? '?tenant_id=' + t : '')); throw Object.assign(new Error(r.msg || '请求失败，请重试'), { answered: true }); }
      return r.data;
    }

    /* ---------- vocabulary ---------- */
    const OP = { knowledge_enhance: '企业知识强化', visibility: '自动可见度诊断', write: '文章写作', keywords: 'AI 拓词', rewrite: '文章改写', replicate: '爆文结构创作', web_search: '网页检索' };
    const JOB = { submitting: ['run', '提交中'], polling: ['run', '采样中'], queued: ['wait', '排队中'], running: ['run', '执行中'], success: ['ok', '已完成'], review: ['wait', '待核对'], failed: ['fail', '未完成'] };
    const BILL = { not_started: ['off', '未产生消费'], reserved: ['run', '已预扣'], settled: ['ok', '已结算'], refunded: ['off', '已返还'], pending_usage: ['wait', '待核对用量'], settlement_failed: ['fail', '结算待核对'] };
    const RUN = { queued: ['run', '执行中'], partial: ['wait', '部分完成'], review: ['wait', '待核对'], success: ['ok', '已完成'], failed: ['fail', '采样失败'] };
    const pair = (map, v) => map[v] || ['off', v || '—'];
    const stat = (map, v) => { const [s, t] = pair(map, v); return status(s, t); };
    const LOGO = { '豆包': 'doubao.png', DeepSeek: 'deepseek.ico', '腾讯元宝': 'yuanbao.png', '通义千问': 'qianwen.png', Kimi: 'kimi.png', '文心一言': 'wenxin.png', '纳米AI': 'nano.svg', '智谱AI': 'zhipu.ico' };
    const ALIAS_P = { '千问': '通义千问', Qwen: '通义千问', '元宝': '腾讯元宝', '文心': '文心一言', '纳米': '纳米AI', deepseek: 'DeepSeek', kimi: 'Kimi', '智谱清言': '智谱AI' };
    const plogo = (name, cls) => { const f = LOGO[ALIAS_P[name] || name]; return '<span class="gv-plogo ' + (cls || '') + '">' + (f ? '<img src="/merchant/images/platforms/' + f + '" alt="" loading="lazy">' : '<b>' + esc(Array.from(String(name || '?'))[0]) + '</b>') + '</span>'; };
    const DEFAULT_PLATFORMS = ['豆包', 'DeepSeek', 'Kimi', '腾讯元宝', '通义千问'];
    const num = (v) => v === null || v === undefined ? '—' : fmt(v);
    const when = (v) => { const d = UK.toDate(v); if (!d) return ''; const p = (n) => String(n).padStart(2, '0'); return (d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + '-' : '') + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
    const isUrl = (v) => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) && !u.username; } catch (e) { return false; } };
    const link = (url, text) => isUrl(url) ? '<a class="gv-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + icon('external') + '<span>' + esc(text) + '</span></a>' : '';
    const lines = (t) => [...new Set(String(t || '').split(/\r?\n/).map((q) => q.trim()).filter(Boolean))];
    const key = (p) => p + '_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    const setErr = (ctx, msg) => { let e = ctx.body.querySelector('.gv-err'); if (!e) { e = document.createElement('p'); e.className = 'gv-err'; e.setAttribute('role', 'alert'); ctx.body.append(e); } e.textContent = msg || ''; e.hidden = !msg; if (msg) e.scrollIntoView({ block: 'nearest' }); };
    const gate = (c, k, on) => { const b = c.el.querySelector('[data-act="' + k + '"]'); if (b) b.disabled = on; };
    const RANGES = [['all', '全部'], ['today', '今天'], ['yesterday', '昨天'], ['7d', '近 7 天'], ['30d', '近 30 天']];
    const seg = (name, items, value) => '<div class="uk-seg gv-seg" role="radiogroup" data-seg="' + name + '">' + items.map(([k, t]) => '<button type="button" role="radio" data-v="' + k + '" aria-pressed="' + (k === value) + '">' + esc(t) + '</button>').join('') + '</div>';
    function soonDialog(title, text) { UK.dialog({ title, width: 440, body: '<div class="gv-soon"><span class="uk-status soon">待开通</span><p>' + esc(text) + '</p></div>', actions: [{ key: 'ok', label: '知道了', kind: 'primary' }] }); }
    const SERVICE_SOON = '自动诊断要接入 AI 可见度监测服务。请联系你的服务商在后台填写监测服务密钥并配置按次价格，开通后这里可以直接提交诊断，按「问题 × 平台」计次扣 TP。开通前可以先准备问题、保存诊断范围，或者手动记录观察结果。';

    /* =====================================================================================
       page
       ===================================================================================== */
    function page(root) {
      const S = { seq: 0, brands: null, brand: '', profile: null, range: 'all', vis: null, draft: null, effectRange: 'all', jobPage: 1, runPage: 1, evPage: 1, timer: 0, dead: false, visRequest: 0, effectRequest: 0, profileRequest: 0, brandsRequest: 0 };
      const scopeTenant = UK.tenant();
      const isCurrent = () => !S.dead && root.isConnected && UK.path() === '/ai/geo' && UK.tenant() === scopeTenant;
      const $ = (s) => root.querySelector(s);
      root.innerHTML = '<div class="uk-page gv"><div class="uk-bar uk-pagehead gv-head"></div><div data-tabs></div><div class="gv-notice" hidden></div><div class="gv-body"></div></div>';
      const tabOpt = { items: [], value: '', tail: '', onChange: (k) => go(k) };
      const tabs = UK.tabs($('[data-tabs]'), tabOpt);
      let V = viewOf() || 'diagnose';
      const canon = () => { const t = UK.tenant(); const q = new URLSearchParams(location.search); q.delete('view'); if (t) q.set('tenant_id', t); if (S.brand) q.set('brand_id', S.brand); return '/ai/geo?' + q + '#' + V; };
      const go = (v, push) => { if (!isCurrent()) return; V = v; const url = canon(); UK.setView(url, { push: !!push }); render(); window.scrollTo({ top: 0 }); };
      const geo = (a, p, b) => call('merchantGeo', a, { ...(p || {}), brand_id: S.brand }, b);
      const ws = (a, p, b) => call('merchantWorkspace', a, p, b);
      const area = () => views()[V][0], sub = () => views()[V][1];
      const outside = (k) => { if (!isCurrent()) return; const t = UK.tenant(); const q = new URLSearchParams(); if (t) q.set('tenant_id', t); if (S.brand) q.set('brand_id', S.brand); UK.setView('/ai/geo?' + q + '#' + k, { push: true }); };

      /* ----- registered areas get one context object; they draw into .gv-body and own their dialogs ----- */
      const G = {
        S, $, root, geo, ws, call, go: (v, push) => go(v, push), outside, render: () => render(), get V() { return V; },
        live: (seq) => seq === S.seq && !S.dead, brandName: () => brandName(), loadProfile: (f) => loadProfile(f), drawHead: () => drawHead(), drawTabs: () => drawTabs(S.counts || {}),
        counts: (c) => { S.counts = { ...(S.counts || {}), ...c }; drawTabs(S.counts); }, notice: (h) => notice(h), errBox: (m) => errBox(m), skelRows: (n) => skelRows(n),
        openKnowledge: () => { const b = root.querySelector('[data-kb]'); if (b) b.click(); else if (UK.knowledge && S.brand) UK.knowledge(Number(S.brand), {}); },
        H: { esc, icon, fmt, ago, btn, empty, status, stat, pair, JOB, BILL, OP, plogo, when, isUrl, link, lines, key, setErr, gate, seg, soonDialog, num }
      };
      const ext = {}; Object.entries(AREAS).forEach(([name, a]) => { try { ext[name] = a.create(G); } catch (e) { console.error('[geo] area', name, e); } });
      const cur = () => ext[area()] || null;
      function switchBrand(id, view) { id = String(id); if (id !== S.brand) { S.brand = id; S.vis = null; S.eff = null; S.profile = null; S.counts = {}; S.draft = null; S.runPage = S.evPage = S.jobPage = 1; Object.values(ext).forEach((x) => x.reset && x.reset(true)); } go(view || V, !!view); }
      G.switchBrand = switchBrand;

      /* ----- brand context (R4: switching only affects GEO) ----- */
      async function loadBrands() {
        if (S.brands || !isCurrent()) return;
        const request = ++S.brandsRequest;
        const r = await ws('brandChoices').catch(() => ({ lists: [] }));
        if (!isCurrent() || request !== S.brandsRequest) return;
        S.brands = r.lists || [];
        const want = brandParam();
        const pick = S.brands.find((b) => String(b.id) === want) || S.brands.find((b) => Number(b.legacy) === 1) || S.brands[0];
        S.brand = pick ? String(pick.id) : want;
        if (S.brand && S.brand !== want) UK.setView(canon());
      }
      async function loadProfile(force) {
        if (S.profile && !force) return S.profile;
        const brand = S.brand, request = ++S.profileRequest;
        const profile = await geo('profile').catch(() => null);
        if (S.dead || brand !== S.brand || request !== S.profileRequest) return S.profile;
        S.profile = profile; return profile;
      }
      const brandName = () => { const b = (S.brands || []).find((x) => String(x.id) === S.brand); return (b && b.name) || (S.profile && S.profile.brand_name) || '当前品牌'; };
      const FIELDS = ['brand_name', 'industry', 'website', 'intro', 'products', 'customers', 'competitors'];
      function ring(done, total) {
        const p = total ? Math.min(1, done / total) : 0, c = 2 * Math.PI * 15;
        return '<button type="button" class="bs-ring' + (p >= 1 ? ' is-full' : '') + '" data-kb data-tip="企业知识完善 ' + done + ' / ' + total + '，GEO 写稿与诊断都引用它">' +
          '<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><circle cx="18" cy="18" r="15" style="stroke-dasharray:' + c.toFixed(2) + ';stroke-dashoffset:' + (c * (1 - p)).toFixed(2) + '"/></svg><span>知识 <b class="num">' + done + '</b><i>/' + total + '</i></span></button>';
      }

      /* ----- head ----- */
      function drawHead() {
        const x = cur();
        const title = x ? x.title : area() === 'diagnose' ? 'GEO 诊断' : 'GEO 效果';
        const p = S.profile, done = p ? FIELDS.filter((k) => String(p[k] || '').trim()).length : null;
        const actions = x ? x.actions(sub()) : area() === 'diagnose'
          ? (sub() === 'evidence' ? btn({ kind: 'primary', size: 'lg', icon: 'plus', label: '记录观察', attrs: { 'data-ev-new': '' } }) : btn({ kind: 'ai', size: 'lg', icon: 'spark', label: '开始诊断', attrs: { 'data-start': '' } }))
          : btn({ kind: 'secondary', size: 'lg', icon: 'refresh', label: '刷新', attrs: { 'data-refresh': '' } });
        $('.gv-head').innerHTML = '<h1>' + esc(title) + '</h1>' +
          '<button type="button" class="gv-brand" data-brand-menu aria-haspopup="menu" data-tip="切换品牌只影响 GEO">' + icon('store') + '<span>' + esc(brandName()) + '</span>' + icon('chevronDown', 'uk-i gv-caret') + '</button>' +
          (done === null ? '' : ring(done, FIELDS.length)) + '<span class="uk-grow"></span><div class="uk-actions">' + actions +
          btn({ kind: 'ghost', size: 'lg', icon: 'more', iconOnly: true, label: '更多', attrs: { 'data-more': '', 'aria-haspopup': 'menu' } }) + '</div>';
      }
      function drawTabs(counts = {}) {
        if (cur()) { tabs.set(cur().tabs(counts), V); return; }
        const items = area() === 'diagnose'
          ? [{ key: 'diagnose', label: '平台可见度' }, { key: 'diagnose-records', label: '诊断记录', count: counts.runs }, { key: 'diagnose-evidence', label: '人工观察', count: counts.evidence }]
          : [{ key: 'effect', label: '数据总览' }, { key: 'effect-jobs', label: '任务与 TP', count: counts.jobs }];
        tabs.set(items, V);
      }
      function notice(html) { const n = $('.gv-notice'); n.hidden = !html; n.innerHTML = html || ''; }
      const errBox = (m) => '<div class="uk-card gv-blank">' + empty({ icon: 'alert', title: m || '读取失败', actions: [{ kind: 'secondary', label: '重新读取', attrs: { 'data-retry': '' } }], compact: true }) + '</div>';

      async function render() {
        if (S.dead) return;
        clearTimeout(S.timer);
        const seq = ++S.seq;
        await loadBrands();
        if (!isCurrent() || seq !== S.seq) return;
        Object.values(ext).forEach((x) => x.leave && x.leave());
        drawHead(); drawTabs(S.counts || {}); notice('');
        loadProfile().then(() => { if (isCurrent() && seq === S.seq) drawHead(); });
        if (cur()) cur().draw(sub(), seq);
        else if (V === 'diagnose') drawVisibility(seq);
        else if (V === 'diagnose-records') drawRuns(seq);
        else if (V === 'diagnose-evidence') drawEvidence(seq);
        else if (V === 'effect') drawEffect(seq);
        else drawJobs(seq);
      }

      /* ===================== 诊断 · 平台可见度 ===================== */
      function platformModel(metrics, run) {
        const jobs = (run && run.jobs) || [];
        const names = [...new Set([...DEFAULT_PLATFORMS, ...jobs.map((j) => j.platform || (j.result && j.result.platform)), ...metrics.map((p) => p.platform)].filter(Boolean))];
        return names.map((platform) => {
          const cells = jobs.filter((j) => (j.platform || (j.result && j.result.platform)) === platform), states = cells.map((j) => j.status);
          const success = states.filter((s) => s === 'success').length, failed = states.filter((s) => s === 'failed' || s === 'review').length;
          const active = states.some((s) => ['running', 'submitting', 'polling', 'queued'].includes(s));
          const st = failed ? ['fail', '异常待处理'] : active ? ['run', '检测中'] : cells.length && success === cells.length ? ['ok', '已完成'] : success ? ['run', '检测中'] : cells.length ? ['wait', '排队中'] : ['off', (metrics.find((p) => p.platform === platform) || {}).samples ? '本批未检测' : '未诊断'];
          return { ...(metrics.find((p) => p.platform === platform) || { platform, samples: 0, questions: 0, mentions: null, latest_at: 0 }), platform, st, expected: cells.length, success, failed, pending: active };
        });
      }
      async function drawVisibility(seq) {
        const request = ++S.visRequest, range = S.range;
        const valid = () => !S.dead && seq === S.seq && request === S.visRequest && range === S.range;
        const body = $('.gv-body');
        if (!S.vis) body.innerHTML = '<div class="gv-vis">' + '<div class="uk-focus gv-focus is-skel">' + UK.skel('40%', 14) + UK.skel('50%', 40) + '</div><div class="gv-pgrid">' + DEFAULT_PLATFORMS.map(() => '<div class="gv-pcard is-skel">' + UK.skel('40px', 40, 12) + UK.skel('60%', 14) + UK.skel('100%', 30, 8) + '</div>').join('') + '</div></div>';
        else body.querySelector('.gv-vis') && body.querySelector('.gv-vis').setAttribute('aria-busy', 'true');
        try {
          const [dash, opts, runs] = await Promise.all([geo('dashboard', { range }), geo('visibilityOptions'), geo('visibilityRecords', { page: 1 })]);
          const latest = runs.lists[0] ? (await geo('visibilityRecords', { id: runs.lists[0].id })).lists[0] : null;
          if (!valid()) return;
          S.vis = { dash, opts, latest, runCount: runs.count };
          S.counts = { ...(S.counts || {}), runs: runs.count }; drawTabs(S.counts);
          paintVisibility();
          if (platformModel(dash.platforms, latest).some((p) => p.pending)) S.timer = setTimeout(() => { if (V === 'diagnose' && valid()) drawVisibility(seq); }, 10000);
        } catch (e) { if (valid()) body.innerHTML = errBox(e.message); }
      }
      function paintVisibility() {
        const { dash, opts, latest } = S.vis;
        const plats = platformModel(dash.platforms || [], latest);
        const st = dash.stats || {}, covered = plats.filter((p) => p.samples).length;
        notice(opts.available ? '' : '<div class="uk-notice">' + icon('info') + '<span class="uk-grow"><b>自动诊断服务待开通</b>，可以先准备问题、保存诊断范围，或手动记录观察结果</span>' + btn({ kind: 'secondary', size: 'sm', label: '怎么开通', attrs: { 'data-howto': '' } }) + '</div>');
        const runBlock = latest
          ? (() => { const total = latest.jobs.length, ok = latest.jobs.filter((j) => j.status === 'success').length, bad = latest.jobs.filter((j) => ['failed', 'review'].includes(j.status)).length; const [s, t] = pair(RUN, latest.state);
            return '<div class="gv-frun"><div class="gv-frun-top"><span>最近一批 <b class="num">#' + latest.id + '</b></span><span class="gv-fdot is-' + s + '">' + esc(t) + '</span></div><div class="gv-fbar"><i style="width:' + (total ? Math.round(ok / total * 100) : 0) + '%"></i>' + (bad ? '<i class="is-bad" style="width:' + Math.round(bad / total * 100) + '%"></i>' : '') + '</div><div class="gv-frun-meta"><span>有效回答 <b class="num">' + ok + '</b> / ' + total + (bad ? ' · 异常 ' + bad : '') + '</span><span>' + esc(when(latest.create_time)) + '</span></div></div>'; })()
          : '<div class="gv-frun is-empty"><span>还没有诊断批次</span><span class="gv-frun-meta">开始第一次诊断，建立品牌可见度基线</span></div>';
        $('.gv-body').innerHTML = '<div class="gv-vis">' +
          '<section class="uk-focus gv-focus" aria-label="品牌提及">' +
          '<div class="gv-flabel">' + icon('spark') + '<span>' + esc(brandName()) + ' · 品牌提及</span></div>' +
          '<div class="gv-fnum num">' + num(st.mentions) + '</div>' +
          '<div class="gv-fmeta">' + (st.samples ? '<span>提及率 <b class="num">' + Math.round((Number(st.mentions) || 0) / st.samples * 100) + '%</b></span><span>来自 <b class="num">' + fmt(st.samples) + '</b> 次有效采样</span><span><b class="num">' + covered + '</b> 个平台有数据</span>' : '<span>完成自动诊断后显示提及次数</span>') + '</div>' +
          runBlock +
          (latest ? '<button type="button" class="gv-fchip" data-goto="diagnose-records">查看诊断记录' + icon('arrowRight') + '</button>' : '') +
          '</section>' +
          '<section class="gv-plats" aria-label="各平台"><div class="gv-sechead"><h2>各平台</h2><span class="bs-info gv-info" data-tip="只统计真实的自动采样；未诊断显示「—」，不代表品牌没被提及。状态看最近一批，数字是所选范围内的累计">' + icon('info') + '</span><span class="uk-grow"></span>' + seg('range', RANGES, S.range) + '</div>' +
          '<div class="gv-pgrid">' + plats.map((p, i) => '<article class="gv-pcard" style="--i:' + i + '"><div class="gv-ptop">' + plogo(p.platform) + '<span class="gv-pname"><b>' + esc(p.platform) + '</b>' + status(p.st[0], p.st[1]) + '</span></div>' +
            '<div class="gv-pnums"><span><b class="num">' + (p.samples ? num(p.questions) : '—') + '</b><small>检测问题</small></span><span><b class="num">' + (p.samples ? num(p.samples) : '—') + '</b><small>有效回答</small></span><span class="is-key"><b class="num">' + (p.samples ? num(p.mentions) : '—') + '</b><small>品牌提及</small></span></div>' +
            '<div class="gv-pfoot">' + (p.latest_at ? '<span class="uk-meta">最近 ' + esc(ago(p.latest_at)) + '</span>' : '<span class="uk-meta">尚未诊断</span>') + (p.expected ? '<span class="uk-meta num">本批 ' + p.success + '/' + p.expected + '</span>' : '') + '</div></article>').join('') + '</div></section></div>' +
          '<section class="uk-card gv-qcard"><div class="uk-card-head"><h3>近期检测问题</h3><span class="uk-grow"></span>' + (dash.recent_questions && dash.recent_questions.length ? btn({ kind: 'ghost', size: 'sm', label: '全部诊断记录', attrs: { 'data-goto': 'diagnose-records' } }) : '') + '</div>' +
          ((dash.recent_questions || []).length ? '<div class="uk-table-wrap"><table class="uk-table gv-table"><thead><tr><th>检测问题</th><th>平台</th><th class="is-num">提及 / 采样</th><th>最近采样</th></tr></thead><tbody>' + dash.recent_questions.map((q) => '<tr><td class="gv-qtext">' + esc(q.question) + '</td><td><span class="gv-pl">' + plogo(q.platform, 'is-xs') + esc(q.platform) + '</span></td><td class="is-num num">' + num(q.mentions) + ' / ' + num(q.samples) + '</td><td class="uk-meta">' + esc(when(q.latest_at)) + '</td></tr>').join('') + '</tbody></table></div>'
            : '<div class="gv-qempty">' + empty({ icon: 'search', title: '还没有检测问题', compact: true }) + '<p class="uk-meta">诊断从客户真正会问的问题开始，比如「杭州哪家精品咖啡好喝」</p></div>') + '</section>';
      }

      /* ----- 开始诊断: questions → platforms → preview price → confirm ----- */
      async function startDialog() {
        const box = document.createElement('div'); box.className = 'gv-wiz';
        box.innerHTML = '<div class="gv-wiz-load">' + UK.skel('60%', 18) + UK.skel('100%', 120, 12) + '</div>';
        const d = S.draft || (S.draft = { questions: '', surface: '网页端', platforms: ['DeepSeek', '豆包'], count: 10, context: '', model: '', job: 0, jobKey: '', project: 0, projectInput: '' });
        let data = null, step = 1, quote = null, startKey = '', polling = 0, alive = true;
        const ctx = UK.dialog({
          title: '开始 GEO 诊断', width: 760, body: box, dismissable: false,
          actions: [{ key: 'save', label: '仅保存范围', kind: 'secondary' }, { key: 'next', label: '预览费用', kind: 'ai', icon: 'spark' }],
          onClose: () => { alive = false; clearTimeout(polling); },
          async onAction(k, c) {
            setErr(c, '');
            if (k === 'back') { step = 1; quote = null; draw(); return false; }
            if (k === 'save' || k === 'next') {
              collect();
              const qs = lines(d.questions);
              if (!String((data.profile && data.profile.brand_name) || '').trim()) { setErr(c, '请先在企业知识里填写品牌名称'); return false; }
              if (!qs.length || qs.length > 30 || qs.some((q) => Array.from(q).length > 500)) { setErr(c, '请准备 1–30 个问题，每个不超过 500 字'); return false; }
              if (!d.platforms.length) { setErr(c, '至少选择一个平台'); return false; }
              if (qs.length * d.platforms.length > 150) { setErr(c, '每轮最多 150 次采样，请减少问题或平台'); return false; }
              c.busy(k, true);
              try {
                const pid = await prepare(qs);
                if (k === 'save') { UK.toast('诊断范围已保存，可在自动化计划里选用'); c.close('saved'); return; }
                quote = await geo('visibilityPreview', { project_id: pid }); startKey = key('visibility'); step = 2; draw();
              } catch (e) { setErr(c, e.message); }
              c.busy(k, false); return false;
            }
            if (k === 'go') {
              c.busy('go', true);
              try { await geo('visibilityStart', {}, { project_id: d.project, request_key: startKey, quote_key: quote.quote_key, confirmed: true }); S.draft = null; UK.toast('诊断已提交，结果会陆续回来'); S.vis = null; go('diagnose-records'); }
              catch (e) { setErr(c, e.message + '。再次确认会复用同一请求，不会重复扣费。'); c.busy('go', false); return false; }
            }
          }
        });
        const foot = () => ctx.el.querySelector('.uk-dialog-foot');
        function collect() {
          const v = (n) => { const el = box.querySelector('[name="' + n + '"]'); return el ? el.value : undefined; };
          if (v('questions') !== undefined) d.questions = v('questions');
          if (v('context') !== undefined) d.context = v('context');
          if (v('model') !== undefined) d.model = v('model');
          if (v('count') !== undefined) d.count = Number(v('count'));
        }
        async function prepare(qs) {
          const input = JSON.stringify({ qs, p: d.platforms, s: d.surface, r: data.profile.revision });
          if (d.projectInput !== input) { d.projectInput = input; d.project = 0; d.projectKey = key('diagnosis'); }
          if (!d.project) { const r = await geo('workflowAction', {}, { action: 'create', title: '独立AI可见度诊断', request_key: d.projectKey }); d.project = Number(r.id); }
          const w = await geo('workflow', { id: d.project });
          if (w.project.state === 'setup') await geo('workflowAction', {}, { id: d.project, revision: w.project.revision, action: 'configure', diagnosis_only: true, questions: qs, platforms: d.platforms, aliases: [], region: '全国', surface: d.surface, search_mode: 'search', report_days: 7 });
          return d.project;
        }
        function draw() {
          if (!alive) return;
          const f = foot();
          if (step === 2) {
            f.innerHTML = '<span class="uk-grow"></span>' + btn({ kind: 'secondary', label: '返回修改', attrs: { 'data-act': 'back' } }) + btn({ kind: 'ai', icon: 'spark', label: '确认诊断', cost: quote.total, attrs: { 'data-act': 'go' } });
            box.innerHTML = '<div class="gv-quote"><div class="gv-quote-num"><span>本轮预扣上限</span><b class="num">' + UK.tp(quote.total) + '</b></div>' +
              '<dl class="gv-quote-dl"><div><dt>采样</dt><dd class="num">' + fmt(quote.calls) + ' 次 × ' + UK.tp(quote.price) + '</dd></div><div><dt>检测端</dt><dd>' + esc(quote.surface) + ' · 联网搜索 · 全国</dd></div><div><dt>问题 / 平台</dt><dd class="num">' + lines(d.questions).length + ' 个问题 · ' + esc(d.platforms.join('、')) + '</dd></div></dl>' +
              '<p class="gv-quote-note">' + icon('info') + '<span>' + esc(quote.notice || '') + ' 失败或待核对的样本不会算作品牌没被提及，也不会自动发稿。</span></p></div>';
            return;
          }
          f.innerHTML = '<span class="uk-grow"></span>' + btn({ kind: 'secondary', label: '仅保存范围', attrs: { 'data-act': 'save' } }) + btn({ kind: 'ai', icon: 'spark', label: '预览费用', attrs: { 'data-act': 'next' } });
          if (!data.vis.available) { const n = f.querySelector('[data-act=next]'); n.disabled = true; n.setAttribute('data-tip', '自动诊断服务待开通'); }
          const t = data.text, qs = lines(d.questions), calls = qs.length * d.platforms.length;
          const plats = (data.vis.platforms_by_surface && data.vis.platforms_by_surface[d.surface]) || data.vis.platforms || DEFAULT_PLATFORMS;
          const genBusy = !!d.job && !d.jobDone;
          box.innerHTML =
            '<section class="gv-step"><div class="gv-step-head"><span class="gv-step-n">1</span><b>诊断问题</b><span class="uk-meta num">' + qs.length + ' / 30</span><span class="uk-grow"></span><span class="uk-meta">每行一个 · 修改不收费</span></div>' +
            '<textarea class="uk-textarea gv-qarea" name="questions" rows="7" placeholder="写下客户会问 AI 的问题，每行一个，例如：&#10;杭州西湖边有哪些安静的精品咖啡馆？&#10;适合周末带朋友去的手冲咖啡店推荐">' + esc(d.questions) + '</textarea>' +
            '<div class="gv-gen' + (t.text_available ? '' : ' is-off') + '"><div class="gv-gen-head">' + icon('spark') + '<b>让 AI 帮你写问题</b><span class="uk-meta">读取企业知识，覆盖品牌认知、行业推荐和购买决策</span>' + (t.text_available ? '' : '<span class="uk-grow"></span><span class="uk-status soon">待开通</span>') + '</div>' +
            (t.text_available ? '<div class="gv-gen-row"><input class="uk-input" name="context" maxlength="2000" placeholder="行业 / 主营业务（企业知识里有就不用填）" value="' + esc(d.context) + '"' + (genBusy ? ' disabled' : '') + '>' +
              '<select class="uk-select" name="model" aria-label="文本模型"' + (genBusy ? ' disabled' : '') + '>' + t.models.map((m) => '<option value="' + esc(m.id) + '"' + (String(m.id) === String(d.model || t.default_model_id) ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') + '</select>' +
              '<select class="uk-select gv-count" name="count" aria-label="问题数量"' + (genBusy ? ' disabled' : '') + '>' + [5, 10, 15].map((n) => '<option value="' + n + '"' + (n === d.count ? ' selected' : '') + '>' + n + ' 个问题</option>').join('') + '</select>' +
              btn({ kind: 'secondary', icon: 'spark', label: d.jobDone ? '再要一批' : genBusy ? '生成中…' : 'AI 生成', attrs: { 'data-gen': '' }, disabled: genBusy }) + '</div><p class="uk-meta gv-gen-note">按所选模型的实际用量扣 TP；生成的问题会加到上面，不会提交诊断' + (d.job ? ' · 任务 #' + d.job + (d.jobPoints != null ? ' · ' + d.jobPoints + ' TP' : '') : '') + '</p>'
              : '<p class="uk-meta gv-gen-note">' + esc('文本模型还没开通，可以先自己写问题。') + '</p>') + '</div></section>' +
            '<section class="gv-step"><div class="gv-step-head"><span class="gv-step-n">2</span><b>检测平台</b><span class="uk-grow"></span>' + seg('surface', [['网页端', '网页端'], ['App端', '手机 App 端']], d.surface) + '</div>' +
            '<div class="gv-pchoose">' + plats.map((p) => '<button type="button" class="gv-pchip" data-plat="' + esc(p) + '" aria-pressed="' + d.platforms.includes(p) + '">' + plogo(p, 'is-sm') + '<span class="gv-pchip-t">' + esc(p) + '</span><i class="gv-tick" aria-hidden="true">' + icon('check') + '</i></button>').join('') + '</div></section>' +
            '<div class="gv-sum"><span><b class="num">' + qs.length + '</b> 个问题 × <b class="num">' + d.platforms.length + '</b> 个平台 = <b class="num">' + calls + '</b> 次采样</span>' + (data.vis.available && data.vis.price != null ? '<span class="gv-sum-cost">预计 ' + UK.tp(Math.round(calls * data.vis.price * 100) / 100) + '</span>' : '<span class="uk-status soon">自动诊断待开通</span>') + (calls > 150 ? '<span class="gv-sum-warn">超过每轮 150 次上限</span>' : '') + '</div>';
          const area2 = box.querySelector('[name=questions]');
          area2.addEventListener('input', () => { d.questions = area2.value; const n = lines(d.questions).length, c2 = n * d.platforms.length; box.querySelector('.gv-step-head .num').textContent = n + ' / 30'; const s = box.querySelector('.gv-sum'); s.querySelectorAll('b')[0].textContent = n; s.querySelectorAll('b')[2].textContent = c2; const cost = s.querySelector('.gv-sum-cost'); if (cost) cost.innerHTML = '预计 ' + UK.tp(Math.round(c2 * data.vis.price * 100) / 100); });
        }
        box.addEventListener('click', (e) => {
          const p = e.target.closest('[data-plat]'); if (p) { collect(); const n = p.dataset.plat; d.platforms = d.platforms.includes(n) ? d.platforms.filter((x) => x !== n) : d.platforms.concat(n); draw(); return; }
          const sg = e.target.closest('[data-seg=surface] [data-v]'); if (sg) { collect(); if (d.surface !== sg.dataset.v) { d.surface = sg.dataset.v; d.platforms = []; } draw(); return; }
          if (e.target.closest('[data-gen]')) { collect(); confirmGen(); }
        });
        function confirmGen() {
          if (!String(data.profile.brand_name || '').trim()) { setErr(ctx, '请先在企业知识里填写品牌名称'); return; }
          if (!String(d.context || '').trim() && !['industry', 'intro', 'products', 'customers'].some((k) => String(data.profile[k] || '').trim())) { setErr(ctx, '写一下行业或主营业务，AI 才能写出相关的问题'); return; }
          const m = (data.text.models || []).find((x) => String(x.id) === String(d.model || data.text.default_model_id)) || {};
          UK.dialog({
            title: '确认 AI 生成问题', width: 460,
            body: '<div class="gv-confirm"><p>为「' + esc(data.profile.brand_name) + '」生成 <b>' + d.count + '</b> 个诊断问题。</p><dl class="gv-quote-dl"><div><dt>模型</dt><dd>' + esc(m.name || '默认模型') + '</dd></div><div><dt>计费</dt><dd class="num">输入 ' + esc(m.input_price) + ' / ' + esc(m.input_unit_size) + ' Token，输出 ' + esc(m.output_price) + ' / ' + esc(m.output_unit_size) + ' Token</dd></div></dl><p class="uk-meta">按实际用量扣 TP。生成的问题加在已有问题后面，可以再改；每生成一次都单独计费。</p></div>',
            actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'ok', label: '确认生成', kind: 'ai', icon: 'spark' }],
            async onAction(k2, c2) {
              if (k2 !== 'ok') return;
              c2.busy('ok', true);
              try {
                if (!d.jobKey || d.jobDone) d.jobKey = key('diagnosis_questions');
                const r = await geo('generate', {}, { operation: 'keywords', purpose: 'diagnosis', subject: '品牌可见度诊断问题', question_count: d.count, diagnosis_context: d.context || '', model_id: String(d.model || data.text.default_model_id || ''), request_key: d.jobKey });
                d.job = Number(r.id); d.jobDone = false; d.jobPoints = null; draw(); poll(0);
              } catch (err) { setErr(c2, err.message + '。重试会复用同一请求，不会重复扣费。'); c2.busy('ok', false); return false; }
            }
          });
        }
        async function poll(n) {
          if (!alive) return;
          try {
            const r = await geo('jobs', { id: d.job }); const j = (r.lists || [])[0]; if (!alive) return;
            if (!j) throw new Error('任务在当前品牌下不可见');
            if (j.status === 'success') { const rows = (j.result && j.result.questions) || []; d.jobDone = true; d.jobPoints = j.user_points; if (rows.length) d.questions = [...new Set(lines(d.questions).concat(rows.map((q) => String(q.question || q).trim()).filter(Boolean)))].slice(0, 30).join('\n'); draw(); return; }
            if (j.status === 'failed' || j.status === 'review') { d.jobDone = true; draw(); setErr(ctx, j.error || '生成没有完成，可以在「效果 · 任务与 TP」里查看'); return; }
          } catch (e) { setErr(ctx, e.message); }
          if (n < 90) polling = setTimeout(() => poll(n + 1), 2000); else { d.jobDone = true; draw(); setErr(ctx, '任务还没确认完成，稍后在「效果 · 任务与 TP」里查看'); }
        }
        try {
          const [vis, profile, text] = await Promise.all([geo('visibilityOptions'), geo('profile'), geo('options')]);
          data = { vis, profile, text: { models: [], ...text } };
          if (!alive) return; draw();
          if (d.job && !d.jobDone) poll(0);
        } catch (e) { box.innerHTML = '<p class="gv-err">' + esc(e.message) + '</p>'; }
      }

      /* ===================== 诊断 · 记录 ===================== */
      async function drawRuns(seq) {
        const body = $('.gv-body');
        body.innerHTML = '<div class="uk-card gv-list">' + skelRows(5) + '</div>';
        try {
          const r = await geo('visibilityRecords', { page: S.runPage });
          if (seq !== S.seq) return;
          S.counts = { ...(S.counts || {}), runs: r.count }; drawTabs(S.counts);
          body.innerHTML = '<div class="uk-card gv-list">' + (r.lists.length
            ? '<div class="uk-table-wrap"><table class="uk-table gv-table"><thead><tr><th>批次</th><th>进度</th><th>状态</th><th>开始时间</th><th class="is-act"></th></tr></thead><tbody>' + r.lists.map((x) => { const total = x.jobs.length || Number(x.expected) || 0, ok = Number(x.success) || 0, bad = Number(x.failed) || 0;
              return '<tr class="gv-row" data-run="' + x.id + '" tabindex="0"><td><b class="num">#' + x.id + '</b></td><td><div class="gv-prog"><span class="gv-fbar is-light"><i style="width:' + (total ? Math.round(ok / total * 100) : 0) + '%"></i>' + (bad ? '<i class="is-bad" style="width:' + Math.round(bad / total * 100) + '%"></i>' : '') + '</span><span class="num uk-meta">' + ok + ' / ' + total + (bad ? ' · 失败 ' + bad : '') + '</span></div></td><td>' + stat(RUN, x.state) + '</td><td class="uk-meta">' + esc(when(x.create_time)) + '</td><td class="is-act"><span class="gv-open">查看回答' + icon('chevronRight') + '</span></td></tr>'; }).join('') + '</tbody></table></div>' + (r.count > 20 ? '<div class="gv-pager" data-pager="run">' + UK.pager(r.count, S.runPage, 20) + '</div>' : '')
            : '<div class="gv-blank">' + empty({ icon: 'search', title: '还没有自动诊断记录', actions: [{ kind: 'ai', icon: 'spark', label: '开始诊断', attrs: { 'data-start': '' } }] }) + '<p class="uk-meta">每次诊断是一批「问题 × 平台」的采样，回答、引用和截图都会保存在这里</p></div>') + '</div>';
          if (r.lists.some((x) => (x.jobs || []).some((j) => ['queued', 'submitting', 'polling', 'running'].includes(j.status)))) S.timer = setTimeout(() => { if (V === 'diagnose-records' && seq === S.seq) drawRuns(seq); }, 10000);
        } catch (e) { if (seq === S.seq) body.innerHTML = errBox(e.message); }
      }
      async function runDrawer(id) {
        const box = document.createElement('div'); box.className = 'gv-run';
        box.innerHTML = UK.skel('100%', 80, 12) + UK.skel('100%', 80, 12);
        UK.dialog({ title: '诊断批次 #' + id, drawer: true, width: 640, body: box });
        try {
          const r = (await geo('visibilityRecords', { id })).lists[0];
          if (!r) throw new Error('批次不存在或不属于当前品牌');
          box.innerHTML = '<p class="gv-run-note">' + icon('info') + '<span>回答和引用来自供方采样；没采到回答的不算作品牌没被提及。</span></p>' + r.jobs.map((j) => {
            const res = j.result || {}, plat = res.platform || j.platform || '待采样';
            return '<article class="gv-ans"><header>' + plogo(plat, 'is-sm') + '<div class="gv-ans-t"><b>' + esc(j.subject) + '</b><span class="uk-meta">' + esc(plat) + (res.observed_at ? ' · ' + (res.time_basis === 'result_received_at' ? '结果取回于 ' : '') + esc(when(res.observed_at)) : '') + '</span></div>' + stat(JOB, j.status) + '</header>' +
              (j.error ? '<p class="gv-ans-err">' + esc(j.error) + '</p>' : '') +
              '<div class="gv-ans-text">' + (res.answer ? esc(res.answer) : '<span class="uk-meta">还没有有效回答</span>') + '</div>' +
              ((res.citations || []).length ? '<div class="gv-cites"><b>回答实际引用</b>' + res.citations.map((c) => link(c.url, c.title || c.url)).join('') + '</div>' : '') +
              ((res.references || []).length ? '<details class="gv-refs"><summary>检索参考来源（不等于实际引用）</summary>' + res.references.map((c) => link(c.url, c.title || c.url)).join('') + '</details>' : '') +
              '<footer>' + link(res.url, '采样截图') + link(res.response_url, '回答原页面') + (res.sentiment ? '<span class="uk-meta">供方情感：' + ({ positive: '正向', negative: '负向', neutral: '中性' }[res.sentiment] || res.sentiment) + '</span>' : '') + '<span class="uk-grow"></span>' + stat(BILL, j.billing_status) + '<span class="num gv-pts">' + (j.user_points != null ? UK.tp(j.user_points) : j.reserved_points != null ? '预扣 ' + UK.tp(j.reserved_points) : '') + '</span></footer></article>';
          }).join('');
        } catch (e) { box.innerHTML = '<p class="gv-err">' + esc(e.message) + '</p>'; }
      }

      /* ===================== 诊断 · 人工观察 ===================== */
      async function drawEvidence(seq) {
        const body = $('.gv-body');
        body.innerHTML = '<div class="uk-card gv-list">' + skelRows(5) + '</div>';
        try {
          const r = await geo('workspaceRecords', { kind: 'evidence', page: S.evPage });
          if (seq !== S.seq) return;
          S.counts = { ...(S.counts || {}), evidence: r.count }; drawTabs(S.counts);
          body.innerHTML = '<div class="uk-card gv-list">' + (r.lists.length
            ? '<div class="uk-table-wrap"><table class="uk-table gv-table"><thead><tr><th>问题</th><th>平台</th><th>回答摘要</th><th>观察时间</th><th class="is-act"></th></tr></thead><tbody>' + r.lists.map((x) => { const src = x.sources_json || {};
              return '<tr class="gv-row" data-ev="' + x.id + '" tabindex="0"><td class="gv-qtext">' + esc(x.question) + '</td><td><span class="gv-pl">' + plogo(x.platform, 'is-xs') + esc(x.platform || '未指定') + '</span></td><td class="gv-snip">' + esc(String(x.answer || '').slice(0, 80)) + '</td><td class="uk-meta">' + esc(when(src.observed_at || x.create_time)) + '</td><td class="is-act">' + (isUrl(src.url) ? '<a class="gv-iconlink" href="' + esc(src.url) + '" target="_blank" rel="noopener noreferrer" data-tip="打开证据链接" aria-label="打开证据链接">' + icon('external') + '</a>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' + (r.count > 20 ? '<div class="gv-pager" data-pager="ev">' + UK.pager(r.count, S.evPage, 20) + '</div>' : '')
            : '<div class="gv-blank">' + empty({ icon: 'edit', title: '还没有人工观察记录', actions: [{ kind: 'primary', icon: 'plus', label: '记录观察', attrs: { 'data-ev-new': '' } }] }) + '<p class="uk-meta">自己在 AI 平台上问过的问题，把回答原文和链接记在这里；人工记录单独统计，不计入自动诊断</p></div>') + '</div>';
          S.evRows = r.lists;
        } catch (e) { if (seq === S.seq) body.innerHTML = errBox(e.message); }
      }
      function evidenceDialog() {
        const box = document.createElement('div'); box.className = 'gv-form';
        const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        box.innerHTML = '<div class="uk-field"><label>问题<span class="uk-req">*</span></label><textarea class="uk-textarea" name="question" rows="2" maxlength="500" placeholder="你在 AI 平台上问的原话" autofocus></textarea></div>' +
          '<div class="gv-row2"><div class="uk-field"><label>平台<span class="uk-req">*</span></label><input class="uk-input" name="platform" maxlength="80" list="gv-plist" placeholder="例如：豆包"><datalist id="gv-plist">' + Object.keys(LOGO).map((p) => '<option value="' + esc(p) + '">').join('') + '</datalist></div>' +
          '<div class="uk-field"><label>观察时间<span class="uk-req">*</span></label><input class="uk-input" type="datetime-local" name="at" value="' + now + '" max="' + now + '"></div></div>' +
          '<div class="uk-field"><label>回答原文<span class="uk-req">*</span></label><textarea class="uk-textarea" name="answer" rows="6" maxlength="30000" placeholder="把 AI 的回答完整粘贴进来"></textarea></div>' +
          '<div class="uk-field"><label>回答或截图链接<span class="uk-req">*</span></label><input class="uk-input" name="url" type="url" maxlength="2048" placeholder="https://"></div>';
        UK.dialog({
          title: '记录人工观察', width: 600, body: box,
          actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'ok', label: '保存', kind: 'primary' }],
          async onAction(k, c) {
            if (k !== 'ok') return;
            const v = (n) => box.querySelector('[name=' + n + ']').value.trim();
            if (!v('question') || !v('platform') || !v('answer')) { setErr(c, '问题、平台和回答原文都要填'); return false; }
            if (!isUrl(v('url'))) { setErr(c, '请填写以 http:// 或 https:// 开头的链接'); return false; }
            const at = Math.floor(new Date(v('at')).getTime() / 1000); if (!at || at > Date.now() / 1000 + 300) { setErr(c, '请填写真实的观察时间'); return false; }
            c.busy('ok', true);
            try { await geo('contentSave', {}, { kind: 'evidence', question: v('question'), platform: v('platform'), answer: v('answer'), url: v('url'), observed_at: at }); UK.toast('已记录'); S.evPage = 1; if (V === 'diagnose-evidence') render(); else go('diagnose-evidence'); }
            catch (e) { setErr(c, e.message); c.busy('ok', false); return false; }
          }
        });
      }
      function evidenceView(x) {
        const src = x.sources_json || {};
        UK.dialog({ title: x.question, width: 640, body: '<div class="gv-evv"><div class="gv-evv-meta">' + '<span class="gv-pl">' + plogo(x.platform, 'is-xs') + esc(x.platform) + '</span><span class="uk-meta">· 人工观察 · ' + esc(when(src.observed_at || x.create_time)) + '</span>' + link(src.url, '证据链接') + '</div><div class="gv-ans-text">' + esc(x.answer || '') + '</div><p class="uk-meta">人工记录未经自动核验，不计入自动诊断的提及统计。</p></div>' });
      }

      /* ===================== 效果 · 数据总览 ===================== */
      async function drawEffect(seq) {
        const request = ++S.effectRequest, range = S.effectRange;
        const valid = () => !S.dead && seq === S.seq && request === S.effectRequest && range === S.effectRange;
        const body = $('.gv-body');
        if (!S.eff) body.innerHTML = '<div class="gv-kpis">' + [0, 1, 2, 3].map(() => '<div class="uk-card gv-kpi is-skel">' + UK.skel('40%', 12) + UK.skel('50%', 32) + '</div>').join('') + '</div>';
        try {
          const [dash, rep] = await Promise.all([geo('dashboard', { range }), geo('workspaceReport')]);
          if (!valid()) return;
          S.eff = { dash, rep };
          paintEffect();
        } catch (e) { if (valid()) body.innerHTML = errBox(e.message); }
      }
      function paintEffect() {
        const { dash, rep } = S.eff, st = dash.stats || {}, res = rep.resources || {}, sum = rep.summary || {};
        const kpi = (k, label, val, help, goto) => '<button type="button" class="uk-card gv-kpi is-' + k + '" data-goto="' + goto + '"><span class="gv-kpi-label">' + esc(label) + '</span><b class="num">' + num(val) + '</b><small>' + help + '</small>' + icon('arrowUpRight', 'uk-i gv-kpi-go') + '</button>';
        const trend = rep.trend || [], max = Math.max(1, ...trend.flatMap((r) => [Number(r.created) || 0, Number(r.published) || 0]));
        const tc = trend.reduce((a, r) => a + (Number(r.created) || 0), 0), tp = trend.reduce((a, r) => a + (Number(r.published) || 0), 0);
        const jobs = { ...(rep.jobs || {}) };
        jobs.running = Number(jobs.running || 0) + Number(jobs.submitting || 0) + Number(jobs.polling || 0);
        delete jobs.submitting; delete jobs.polling;
        const jtotal = Object.values(jobs).reduce((a, n) => a + Number(n || 0), 0);
        const prof = sum.profile || {}, done = FIELDS.filter((k) => String(prof[k] || '').trim()).length;
        const ready = [['kb', '企业知识', done + ' / 7', done >= 7 ? 'ok' : done >= 3 ? 'wait' : 'off'], ['keywords', '主关键词', fmt(res.keyword || 0), Number(res.keyword) > 0 ? 'ok' : 'off'], ['materials', '事实素材', fmt(sum.materials || 0), Number(sum.materials) > 0 ? 'ok' : 'off'], ['instructions', '写作指令', fmt(res.instruction || 0), Number(res.instruction) > 0 ? 'ok' : 'off']];
        $('.gv-body').innerHTML =
          '<div class="gv-tools">' + seg('effect-range', RANGES, S.effectRange) + '<span class="bs-info gv-info" data-tip="时间范围作用于文章、已发布订单和品牌提及；趋势固定看近 14 天">' + icon('info') + '</span><span class="uk-grow"></span><span class="uk-meta">更新于 ' + esc(when(dash.updated_at)) + '</span></div>' +
          '<div class="gv-kpis">' + kpi('a', '内容文章', st.articles, '已保存到文章库', 'article-library') + kpi('b', '已发布订单', st.published, '媒体回执为已发布', 'website-orders') + kpi('c', '品牌提及', st.mentions, st.samples ? '来自 ' + fmt(st.samples) + ' 次有效采样' : '完成自动诊断后显示', 'diagnose') + kpi('d', '写作标题', sum.questions, '当前有效的客户问题', 'keywords') + '</div>' +
          '<div class="gv-split">' +
          '<section class="uk-card gv-trend"><div class="uk-card-head"><h3>近 14 天内容与发布</h3><span class="uk-grow"></span><span class="gv-legend"><i class="is-a"></i>创作文章 <b class="num">' + tc + '</b></span><span class="gv-legend"><i class="is-b"></i>已发布订单 <b class="num">' + tp + '</b></span></div>' +
          '<div class="gv-chart" role="img" aria-label="近 14 天创作文章与已发布订单"><div class="gv-grid"><i></i><i></i><i></i><i></i></div><div class="gv-bars">' + trend.map((r, i) => '<div class="gv-day" data-tip="' + esc(r.date + '：创作 ' + r.created + '，已发布 ' + r.published) + '"><div class="gv-pair"><span class="is-a" style="height:' + (Number(r.created) / max * 100) + '%"></span><span class="is-b" style="height:' + (Number(r.published) / max * 100) + '%"></span></div><small>' + (i % 2 === 0 || i === trend.length - 1 ? esc(r.date) : '') + '</small></div>').join('') + '</div>' + (!tc && !tp ? '<div class="gv-chart-empty">近 14 天还没有创作和发布</div>' : '') + '</div></section>' +
          '<section class="uk-card gv-jobsum"><div class="uk-card-head"><h3>AI 任务</h3><span class="uk-meta num">' + fmt(jtotal) + '</span><span class="uk-grow"></span>' + btn({ kind: 'ghost', size: 'sm', label: '任务与 TP', attrs: { 'data-goto': 'effect-jobs' } }) + '</div><div class="gv-jrows">' + [['queued', '排队中', 'wait'], ['running', '执行中', 'run'], ['success', '已完成', 'ok'], ['review', '待核对', 'wait'], ['failed', '未完成', 'fail']].map(([k, t, s]) => '<div class="gv-jrow">' + status(s, t) + '<span class="gv-jtrack"><i style="width:' + (jtotal ? Math.round((Number(jobs[k]) || 0) / jtotal * 100) : 0) + '%" class="is-' + s + '"></i></span><b class="num">' + fmt(jobs[k] || 0) + '</b></div>').join('') + '</div></section></div>' +
          '<div class="gv-split is-even">' +
          '<section class="uk-card"><div class="uk-card-head"><h3>最新发布</h3><span class="uk-grow"></span>' + btn({ kind: 'ghost', size: 'sm', label: '投稿记录', attrs: { 'data-goto': 'website-orders' } }) + '</div>' +
          ((dash.latest_published || []).length ? '<div class="gv-pubs">' + dash.latest_published.map((x) => '<div class="gv-pub"><span class="gv-pub-t"><b>' + esc(x.title) + '</b><span class="uk-meta">' + esc(x.media_name || '') + ' · ' + esc(when(x.create_time)) + '</span></span>' + (isUrl(x.published_url) ? link(x.published_url, '回链') : status('ok', '已发布')) + '</div>').join('') + '</div>'
            : '<div class="gv-qempty">' + empty({ icon: 'send', title: '还没有已发布的稿件', compact: true }) + '</div>') + '</section>' +
          '<section class="uk-card"><div class="uk-card-head"><h3>写稿准备</h3><span class="bs-info gv-info" data-tip="GEO 写稿会引用这些资料；越完整，文章越可信">' + icon('info') + '</span></div><div class="gv-ready">' + ready.map(([k, t, v, s]) => '<button type="button" class="gv-rrow" data-ready="' + k + '"><i class="bs-ndot ' + s + '" aria-hidden="true"></i><span>' + esc(t) + '</span><b class="num">' + esc(v) + '</b>' + icon('chevronRight') + '</button>').join('') + '</div></section></div>';
      }

      /* ===================== 效果 · 任务与 TP ===================== */
      async function drawJobs(seq) {
        const body = $('.gv-body');
        body.innerHTML = '<div class="uk-card gv-list">' + skelRows(6) + '</div>';
        try {
          const r = await geo('jobs', { page: S.jobPage });
          if (seq !== S.seq) return;
          S.counts = { ...(S.counts || {}), jobs: r.count }; drawTabs(S.counts); S.jobRows = r.lists;
          body.innerHTML = '<div class="uk-card gv-list">' + (r.lists.length
            ? '<div class="uk-table-wrap"><table class="uk-table gv-table"><thead><tr><th>任务</th><th>类型</th><th>状态</th><th class="is-num">TP</th><th>结算</th><th>创建时间</th><th class="is-act"></th></tr></thead><tbody>' + r.lists.map((j) => '<tr class="gv-row" data-job="' + j.id + '" tabindex="0"><td><span class="gv-jt"><b>' + esc(j.subject || '—') + '</b><span class="uk-meta num">#' + j.id + '</span></span></td><td class="uk-meta">' + esc(OP[j.operation] || j.operation) + '</td><td>' + stat(JOB, j.status) + '</td><td class="is-num">' + (j.user_points != null ? UK.tp(j.user_points) : j.reserved_points != null ? '<span class="uk-meta">预扣 </span>' + UK.tp(j.reserved_points) : '<span class="uk-meta">—</span>') + '</td><td>' + stat(BILL, j.billing_status) + '</td><td class="uk-meta">' + esc(when(j.create_time)) + '</td><td class="is-act"><span class="gv-open">结果' + icon('chevronRight') + '</span></td></tr>').join('') + '</tbody></table></div>' + (r.count > 20 ? '<div class="gv-pager" data-pager="job">' + UK.pager(r.count, S.jobPage, 20) + '</div>' : '')
            : '<div class="gv-blank">' + empty({ icon: 'list', title: '还没有 AI 任务', compact: true }) + '<p class="uk-meta">AI 拓词、写稿、诊断、网页检索都会在这里留下任务和扣费记录</p></div>') + '</div>';
        } catch (e) { if (seq === S.seq) body.innerHTML = errBox(e.message); }
      }
      function jobDrawer(j) {
        const res = j.result || {}, box = document.createElement('div'); box.className = 'gv-run';
        const canImport = j.status === 'success' && !['web_search', 'visibility', 'knowledge_enhance'].includes(j.operation);
        box.innerHTML = '<div class="gv-jmeta">' + stat(JOB, j.status) + stat(BILL, j.billing_status) + '<span class="num">' + (j.user_points != null ? UK.tp(j.user_points) : '') + '</span><span class="uk-meta">' + esc(OP[j.operation] || j.operation) + ' · ' + esc(when(j.create_time)) + (j.consumption_id ? ' · 消费单 #' + j.consumption_id : '') + '</span></div>' +
          (j.operation === 'knowledge_enhance' ? '<p class="gv-run-note">' + icon('info') + '<span>这是企业知识强化的结果，回到品牌页的企业知识里预览采用，不会自动保存。</span></p>' : '') +
          (j.error ? '<p class="gv-ans-err">' + esc(j.error) + '</p>' : '') +
          (res.questions && res.questions.length ? '<ol class="gv-qlist">' + res.questions.map((q) => '<li>' + esc(q.question || q) + '</li>').join('') + '</ol>' : '') +
          ((res.answer || res.content) ? '<div class="gv-ans-text">' + esc(res.answer || res.content) + '</div>' : '') +
          ((res.items || []).length ? '<div class="gv-sres">' + res.items.map((x, i) => '<div class="gv-sitem"><b>' + esc(x.title) + '</b><p>' + esc(x.summary || '') + '</p><div>' + link(x.url, '来源网页') + '<span class="uk-grow"></span>' + btn({ kind: 'secondary', size: 'sm', label: '存为事实素材', attrs: { 'data-mat': i } }) + '</div></div>').join('') + '</div>' : '') +
          ((res.images || []).length ? '<div class="gv-cites"><b>图片来源</b><span class="uk-meta">使用前请核实版权</span>' + res.images.map((x) => link(x.url, x.title || '图片') + link(x.source_url, '来源网页')).join('') + '</div>' : '') +
          (!res.answer && !res.content && !(res.items || []).length && !(res.questions || []).length ? '<p class="uk-meta">暂无正文结果</p>' : '');
        const ctx = UK.dialog({
          title: '任务 #' + j.id + (j.subject ? ' · ' + j.subject : ''), drawer: true, width: 640, body: box,
          actions: canImport ? [{ key: 'import', label: res.imported_ids ? '已入库' : (j.operation === 'keywords' ? '存入写作标题' : '存入文章库'), kind: 'primary' }] : [],
          async onAction(k, c) {
            if (k !== 'import' || res.imported_ids) return false;
            c.busy('import', true);
            try { await geo('importResult', {}, { id: j.id }); UK.toast('已入库'); res.imported_ids = true; drawJobs(S.seq); }
            catch (e) { setErr(c, e.message); c.busy('import', false); return false; }
          }
        });
        if (res.imported_ids) gate(ctx, 'import', true);
        box.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-mat]'); if (!b) return; const x = res.items[Number(b.dataset.mat)];
          b.disabled = true;
          try { await geo('contentSave', {}, { kind: 'materials', title: x.title, content: x.summary || x.title, source_url: x.url, category: '检索待核实' }); b.querySelector('span').textContent = '已存为素材'; UK.toast('已存为待核实的事实素材'); }
          catch (err) { b.disabled = false; UK.toast(err.message, 'fail'); }
        });
      }
      const skelRows = (n) => '<div class="gv-skrows">' + Array.from({ length: n }, () => '<div class="gv-skrow">' + UK.skel('30%', 14) + UK.skel('16%', 14) + UK.skel('12%', 14) + UK.skel('18%', 14) + '</div>').join('') + '</div>';

      /* ===================== events ===================== */
      root.addEventListener('click', (e) => {
        const t = e.target;
        if (cur() && cur().click && cur().click(e)) return;
        if (t.closest('[data-retry]') || t.closest('[data-refresh]')) { S.vis = null; S.eff = null; S.profile = null; Object.values(ext).forEach((x) => x.reset && x.reset()); render(); return; }
        if (t.closest('[data-start]')) { startDialog(); return; }
        if (t.closest('[data-howto]')) { soonDialog('自动诊断待开通', SERVICE_SOON); return; }
        if (t.closest('[data-ev-new]')) { evidenceDialog(); return; }
        if (t.closest('[data-kb]')) { if (UK.knowledge && S.brand) UK.knowledge(Number(S.brand), { onSaved: () => { S.profile = null; loadProfile(true).then(drawHead); } }); else UK.go('/ai/stores?brand_id=' + S.brand + '&tab=profile'); return; }
        const gt = t.closest('[data-goto]'); if (gt) { const k = gt.dataset.goto; if (views()[k]) go(k, true); else outside(k); return; }
        const rd = t.closest('[data-ready]'); if (rd) { const k = rd.dataset.ready; if (k === 'kb') { root.querySelector('[data-kb]') ? root.querySelector('[data-kb]').click() : UK.go('/ai/stores?brand_id=' + S.brand); } else outside(k); return; }
        const bm = t.closest('[data-brand-menu]'); if (bm) {
          UK.menu(bm, [{ group: '品牌' }].concat((S.brands || []).map((b) => ({ key: 'b:' + b.id, label: b.name, checked: String(b.id) === S.brand }))).concat(['-', { key: 'manage', label: '管理品牌与门店', icon: 'store' }]), (k) => {
            if (k === 'manage') { UK.go('/ai/stores' + (S.brand ? '?brand_id=' + S.brand : '')); return; }
            switchBrand(k.slice(2));
          });
          return;
        }
        const mo = t.closest('[data-more]'); if (mo) {
          if (cur() && cur().more) { const m = cur().more(sub()); UK.menu(mo, m.items, m.pick, { align: 'right' }); return; }
          UK.menu(mo, [{ key: 'kb', label: '企业知识', icon: 'book' }, { key: 'auto', label: '定期复测（自动化计划）', icon: 'calendarClock' }, '-', { key: 'other', label: area() === 'diagnose' ? '看效果数据' : '看诊断', icon: 'arrowRight' }], (k) => {
            if (k === 'kb') root.querySelector('[data-kb]') && root.querySelector('[data-kb]').click();
            if (k === 'auto') UK.go('/ai/automation');
            if (k === 'other') go(area() === 'diagnose' ? 'effect' : 'diagnose', true);
          }, { align: 'right' });
          return;
        }
        const sg = t.closest('[data-seg] [data-v]'); if (sg) {
          const name = sg.parentElement.dataset.seg, v = sg.dataset.v;
          if (name === 'range' && v !== S.range) { S.range = v; drawVisibility(S.seq); }
          if (name === 'effect-range' && v !== S.effectRange) { S.effectRange = v; drawEffect(S.seq); }
          return;
        }
        const pg = t.closest('[data-pager] [data-page]'); if (pg && !pg.disabled) { const w = pg.closest('[data-pager]').dataset.pager, n = Number(pg.dataset.page); if (w === 'run') { S.runPage = n; drawRuns(S.seq); } if (w === 'ev') { S.evPage = n; drawEvidence(S.seq); } if (w === 'job') { S.jobPage = n; drawJobs(S.seq); } return; }
        if (t.closest('a')) return;
        const rr = t.closest('[data-run]'); if (rr) { runDrawer(Number(rr.dataset.run)); return; }
        const ev = t.closest('[data-ev]'); if (ev) { const x = (S.evRows || []).find((y) => Number(y.id) === Number(ev.dataset.ev)); if (x) evidenceView(x); return; }
        const jb = t.closest('[data-job]'); if (jb) { const x = (S.jobRows || []).find((y) => Number(y.id) === Number(jb.dataset.job)); if (x) jobDrawer(x); return; }
      });
      root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.gv-row')) { e.preventDefault(); e.target.click(); } });

      // canonical address (old hashes → new), then draw. An old hash may also carry an intent (open a dialog, preset a mode).
      function takeIntent() { const k = hashKey(), name = intents()[k], params = hashParams(); return name || Object.keys(params).length ? { name: name || '', params, from: k } : null; }
      function fireIntent(it) { if (!it) return; const x = ext[(views()[V] || [])[0]]; if (x && x.intent) setTimeout(() => { if (!S.dead) x.intent(it.name, it.params, it.from); }, 0); }
      let first = null;
      { const v = viewOf(); if (v) { first = takeIntent(); V = v; if (hashKey() !== v || location.hash.includes('?') || new URLSearchParams(location.search).has('view')) UK.setView(canon()); } }
      render(); fireIntent(first);
      setTimeout(() => UK.syncShell && UK.syncShell(), 0);
      root._update = () => {
        const v = viewOf(); if (!v) return;
        const it = takeIntent();
        const b = brandParam(), brandChanged = !!b && b !== S.brand;
        if (brandChanged) { S.brand = b; S.vis = null; S.eff = null; S.profile = null; S.counts = {}; S.draft = null; S.runPage = S.evPage = S.jobPage = 1; Object.values(ext).forEach((x) => x.reset && x.reset(true)); }
        if (brandChanged || v !== V || hashKey() !== v || location.hash.includes('?')) { V = v; if (hashKey() !== v || location.hash.includes('?')) UK.setView(canon()); render(); }
        fireIntent(it);
      };
      root._cleanup = () => { S.dead = true; S.seq++; S.brandsRequest++; clearTimeout(S.timer); Object.values(ext).forEach((x) => { x.leave && x.leave(); x.destroy && x.destroy(); }); };
    }

    UK.page({
      key: 'geo',
      own: true,
      match: (p) => p === '/ai/geo' && !!viewOf(),
      mount: page,
      update(root) { root._update && root._update(); },
      unmount(root) { root._cleanup && root._cleanup(); }
    });
  };
  if (window.UK) boot(); else document.addEventListener('uk:ready', boot, { once: true });
})();
