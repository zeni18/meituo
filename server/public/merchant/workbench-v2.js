/* Merchant UI v2 — 工作台 (/ai).
   Replaces the native inspiration home with a merchant workbench built only from
   real account data: TP balance and consumption, generation tasks, finished films
   and the material library. Nothing is simulated; empty data shows empty states.
   Spec: docs/merchant-ui-v2.md (概览型骨架) */
(() => {
  'use strict';
  const MARK = '';
  const TASK_APPS = [
    ['aigc_product_image', 'AI 商品图', '/ai/tools/aigc_product_image'],
    ['aigc_image', '图像创作', '/ai/create?type=image'],
    ['aigc_video', '视频创作', '/ai/create?type=video'],
    ['aigc_digital_human', '数字人', '/ai/avatar'],
    ['aigc_pic_lipsync', '数字人', '/ai/avatar'],
    ['image_human', '数字人', '/ai/avatar'],
    ['aigc_product_suite', 'AI 商品套图', '/ai/tools/aigc_product_suite'],
    ['aigc_model_wear', '模特穿戴', '/ai/tools/aigc_model_wear'],
    ['aigc_fitting', 'AI 试衣', '/ai/tools/aigc_fitting'],
    ['aigc_product_promo_video', '产品宣传视频', '/ai/tools/aigc_product_promo_video']
  ];
  const TOOLS = [
    { name: 'AI 商品图', meta: '商品场景图', img: '/merchant/design-assets/v2/tool-product.webp', path: '/ai/tools/aigc_product_image' },
    { name: '数字人', meta: '口播视频', img: '/merchant/design-assets/v2/tool-avatar.webp', path: '/ai/avatar' },
    { name: '视频剪辑', meta: '混剪成片', img: '/merchant/design-assets/v2/tool-clip.webp', path: '/ai/video-editor' },
    { name: '模特穿戴', meta: '服饰上身图', img: '/merchant/design-assets/v2/tool-wear.webp', path: '/ai/tools/aigc_model_wear' }
  ];

  const tenant = () => { const v = new URLSearchParams(location.search).get('tenant_id'); return v && /^\d+$/.test(v) ? v : ''; };
  const withTenant = (p) => p + (tenant() ? (p.includes('?') ? '&' : '?') + 'tenant_id=' + tenant() : '');
  const router = () => document.getElementById('__nuxt')?.__vue_app__?.config?.globalProperties?.$router;
  const go = (p) => { const r = router(); if (r) r.push(withTenant(p)); else location.href = withTenant(p); };
  const isHome = () => { const p = location.pathname.replace(/^\/t\/\d+/, '').replace(/\/$/, ''); return p === '/ai' || p === ''; };
  const token = () => { const m = document.cookie.match(/(?:^|; )token=([^;]+)/); if (m) return decodeURIComponent(m[1]); try { const v = localStorage.getItem('token'); return v ? v.replace(/^"|"$/g, '') : ''; } catch (e) { return ''; } };
  async function api(path) {
    try {
      const t = tenant(), url = '/api' + path + (t && !/[?&]tenant_id=/.test(path) ? (path.includes('?') ? '&' : '?') + 'tenant_id=' + t : '');
      const r = await fetch(url, { headers: { token: token() }, credentials: 'same-origin' });
      const j = await r.json();
      return j && j.code === 1 ? j.data : null;
    } catch (e) { return null; }
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const toDate = (v) => { if (!v) return null; if (typeof v === 'number' || /^\d+$/.test(v)) { const n = Number(v); return new Date(n < 1e12 ? n * 1000 : n); } const d = new Date(String(v).replace(/-/g, '/')); return isNaN(d) ? null : d; };
  const dayKey = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  const ago = (d) => {
    if (!d) return '';
    const s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 172800) return '昨天';
    return (d.getMonth() + 1) + '/' + d.getDate();
  };
  function state(raw) {
    const s = String(raw ?? '').toLowerCase();
    if (/succ|done|finish|complete|^2$|^3$/.test(s)) return 'done';
    if (/fail|error|cancel|reject|^-1$|^4$/.test(s)) return 'failed';
    if (/queue|pending|wait|^0$/.test(s)) return 'queued';
    return 'running';
  }
  function findMedia(obj, re, depth = 0) {
    if (!obj || depth > 3) return '';
    if (typeof obj === 'string') return re.test(obj) && /^(https?:)?\/\//.test(obj) ? obj : '';
    if (Array.isArray(obj)) { for (const v of obj) { const f = findMedia(v, re, depth + 1); if (f) return f; } return ''; }
    if (typeof obj === 'object') {
      for (const k of ['cover_url', 'image_url', 'thumb_url', 'url', 'file_url', 'result_url', 'video_url']) { const f = findMedia(obj[k], re, depth + 1); if (f) return f; }
      for (const k of Object.keys(obj)) { if (/url|image|cover|results?|files?/i.test(k)) { const f = findMedia(obj[k], re, depth + 1); if (f) return f; } }
    }
    return '';
  }
  const IMG_RE = /\.(png|jpe?g|webp|gif)(\?|$)/i, VID_RE = /\.(mp4|mov|webm)(\?|$)/i;

  async function load() {
    const [center, films, summary] = await Promise.all([
      api('/user/center'),
      api('/merchantPublishing/films?page=1&page_size=24'),
      api('/merchantWorkspace/workbench')
    ]);
    const libs = ['video', 'image', 'audio', 'voiceover'].map(k => ({ count: summary?.material_counts?.[k] }));
    const taskLists = TASK_APPS.map(([code]) => summary?.task_lists?.[code]);
    const tasks = [];
    taskLists.forEach((data, i) => {
      const [code, label, path] = TASK_APPS[i];
      (data?.lists || []).forEach((t) => {
        const created = toDate(t.create_time);
        tasks.push({
          key: code + ':' + t.id, label, path, created,
          title: (t.title || t.name || t.prompt || t.script_text || label).toString().slice(0, 40),
          state: state(t.status ?? t.task_status ?? t.state),
          progress: Number(t.progress) || 0,
          cover: findMedia(t.results || t, IMG_RE),
          video: findMedia(t.results || t, VID_RE)
        });
      });
    });
    tasks.sort((a, b) => (b.created?.getTime() || 0) - (a.created?.getTime() || 0));
    const filmList = (films?.lists || []).map((f) => ({ key: 'film:' + f.id, title: f.title, created: toDate(f.create_time), cover: f.cover_url, video: f.video_url, duration: f.duration, label: '成片' }));
    return {
      balance: center ? Number(center.user_money) : null,
      totalConsume: summary?.consumption?.total ?? null,
      monthConsume: summary?.consumption?.month ?? null,
      taskDaily: summary?.task_daily ?? null, tasksReady: !!summary?.task_daily, filmsReady: !!films,
      filmsCount: films?.count ?? null,
      films: filmList,
      materials: ['video', 'image', 'audio', 'voiceover'].map((k, i) => ({ kind: k, count: libs[i]?.count ?? null })),
      tasks
    };
  }

  /* ---------- rendering ---------- */
  function days(n) { const out = []; const d = new Date(); d.setHours(0, 0, 0, 0); for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); out.push(x); } return out; }
  function countBy(items, dates, pick) { const map = new Map(dates.map((d) => [dayKey(d), 0])); items.forEach((it) => { const d = pick(it); if (!d) return; const k = dayKey(d); if (map.has(k)) map.set(k, map.get(k) + (it.amount ?? 1)); }); return dates.map((d) => map.get(dayKey(d))); }
  function spark(values, tone, id) {
    const max = Math.max(...values, 0);
    if (!max) return '<svg class="wb-spark" viewBox="0 0 300 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0,82 L300,82" stroke="' + (tone === 'accent' ? '#C9C9FB' : '#E2E3E8') + '" stroke-width="2" vector-effect="non-scaling-stroke" fill="none"/></svg>';
    const pts = values.map((v, i) => [i / (values.length - 1) * 300, 80 - v / max * 62]);
    let d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; d += ' C' + cx + ',' + y0 + ' ' + cx + ',' + y1 + ' ' + x1 + ',' + y1; }
    const color = tone === 'accent' ? '#5B5CF6' : '#A3A7B4';
    return '<svg class="wb-spark" viewBox="0 0 300 90" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity="' + (tone === 'accent' ? '.22' : '.16') + '"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + d + ' L300,90 L0,90 Z" fill="url(#' + id + ')"/><path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';
  }
  function delta(cur, prev) {
    if (!prev && !cur) return '';
    if (!prev) return '<span class="wb-delta up">新增</span>';
    const p = (cur - prev) / prev * 100;
    if (Math.abs(p) < 0.05) return '<span class="wb-delta">持平</span>';
    return '<span class="wb-delta ' + (p > 0 ? 'up' : 'down') + '">' + (p > 0 ? '↑' : '↓') + ' <span class="num">' + Math.abs(p).toFixed(1) + '%</span></span>';
  }
  const STATE_TEXT = { running: '生成中', queued: '排队中', failed: '失败', done: '已完成' };

  function render(root, d) {
    const d14 = days(14), d7 = d14.slice(7), prev7 = d14.slice(0, 7);
    const history = new Map((d.taskDaily || []).map(row => [row.date, Number(row.count) || 0]));
    const daily = d.taskDaily ? d14.map(day => history.get(dayKey(day)) || 0) : Array(14).fill(0);
    const week = daily.slice(7).reduce((a, b) => a + b, 0), lastWeek = daily.slice(0, 7).reduce((a, b) => a + b, 0);
    const filmsDaily = countBy(d.films, d7, (f) => f.created);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthConsume = d.monthConsume;
    const matTotal = d.materials.some(m => m.count == null) ? null : d.materials.reduce((a, m) => a + m.count, 0);
    const stat = value => value == null ? '—' : fmt(value, value % 1 ? 2 : 0);
    const matText = { video: '视频', image: '图片', audio: '音频', voiceover: '配音' };
    const maxBar = Math.max(...daily, 0);
    const hi = maxBar ? daily.lastIndexOf(maxBar) : -1;
    const active = d.tasks.filter((t) => t.state !== 'done').slice(0, 2);
    const recentTasks = [...active, ...d.tasks.filter((t) => t.state === 'done')].slice(0, 4);
    const seenMedia = new Set(), mediaKey = (u) => { try { return new URL(u, location.href).pathname; } catch (e) { return u; } };
    const works = [...d.films, ...d.tasks.filter((t) => t.state === 'done' && (t.cover || t.video))]
      .sort((a, b) => (b.created?.getTime() || 0) - (a.created?.getTime() || 0))
      .filter((w) => { const keys = [w.video, w.cover].filter(Boolean).map(mediaKey); if (keys.some((k) => seenMedia.has(k))) return false; keys.forEach((k) => seenMedia.add(k)); return true; }).slice(0, 10);

    root.innerHTML =
      '<div class="wb-head"><h1 class="wb-title">工作台</h1><div class="wb-actions">' +
        '<button type="button" class="wb-btn wb-btn-sec" data-go="/ai/materials/video"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3a1 1 0 0 1 .7.3l4.5 4.5a1 1 0 0 1-1.4 1.4L13 6.42V15a1 1 0 1 1-2 0V6.42L8.2 9.2a1 1 0 0 1-1.4-1.4l4.5-4.5A1 1 0 0 1 12 3ZM4 15a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2a1 1 0 1 1 2 0v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2a1 1 0 0 1 1-1Z"/></svg>上传素材</button>' +
        '<button type="button" class="wb-btn ui-ai" data-go="/ai/tools"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.68 5.45c.22-1.1 1.8-1.1 2.02 0a8.79 8.79 0 0 0 6.85 6.85c1.1.22 1.1 1.8 0 2.02a8.79 8.79 0 0 0-6.85 6.85c-.22 1.1-1.8 1.1-2.02 0a8.79 8.79 0 0 0-6.85-6.85c-1.1-.22-1.1-1.8 0-2.02a8.79 8.79 0 0 0 6.85-6.85Zm8.48-3.85c.16-.8 1.31-.8 1.48 0a3.54 3.54 0 0 0 2.76 2.76c.8.17.8 1.32 0 1.48a3.54 3.54 0 0 0-2.76 2.76c-.17.8-1.32.8-1.48 0a3.54 3.54 0 0 0-2.76-2.76c-.8-.16-.8-1.31 0-1.48a3.54 3.54 0 0 0 2.76-2.76Z"/></svg>开始创作</button>' +
      '</div></div>' +
      (!d.tasksReady || !d.filmsReady || d.balance == null || matTotal == null ? '<div class="wb-data-notice" role="status"><span>部分统计暂时无法读取</span><button type="button" class="wb-btn wb-btn-sec wb-btn-sm" data-wb-reload>重新加载</button></div>' : '') +

      '<section class="wb-kpis">' +
        '<div class="wb-focus-wrap"><div class="wb-layer wb-layer-2"></div><div class="wb-layer wb-layer-1"></div>' +
          '<div class="wb-focus"><svg class="wb-rings" viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="40"/><circle cx="90" cy="90" r="62"/><circle cx="90" cy="90" r="84"/></svg>' +
            '<div class="wb-focus-label"><span class="wb-tp">' + MARK + '</span>TP 余额</div>' +
            '<div class="wb-focus-num num">' + (d.balance == null ? '—' : fmt(d.balance, d.balance % 1 ? 2 : 0)) + '</div>' +
            '<div class="wb-focus-meta"><span>本月消耗 <b class="num">' + stat(monthConsume) + '</b></span><span>累计消耗 <b class="num">' + stat(d.totalConsume) + '</b></span></div>' +
            '<div class="wb-focus-actions"><button type="button" class="wb-chip-btn wb-chip-solid" data-recharge>充值</button><button type="button" class="wb-chip-btn" data-records>消耗明细</button></div>' +
          '</div></div>' +
        '<div class="wb-card wb-kpi"><div class="wb-kpi-top"><span>本周生成</span><span class="wb-kpi-sub num">' + (d7[0].getMonth() + 1) + '/' + d7[0].getDate() + ' – ' + (d7[6].getMonth() + 1) + '/' + d7[6].getDate() + '</span></div>' +
          '<div class="wb-kpi-num"><span class="num">' + (d.tasksReady ? fmt(week) : '—') + '</span>' + (d.tasksReady ? delta(week, lastWeek) : '') + '</div>' + spark(daily.slice(7), 'accent', 'wbA') + '</div>' +
        '<div class="wb-card wb-kpi"><div class="wb-kpi-top"><span>成片</span><span class="wb-kpi-sub">全部</span></div>' +
          '<div class="wb-kpi-num"><span class="num">' + stat(d.filmsCount) + '</span></div>' + spark(filmsDaily, 'muted', 'wbB') + '</div>' +
        '<div class="wb-card wb-kpi"><div class="wb-kpi-top"><span>素材</span><span class="wb-kpi-sub">全部</span></div>' +
          '<div class="wb-kpi-num"><span class="num">' + stat(matTotal) + '</span></div>' +
          '<div class="wb-mat">' + d.materials.map((m) => '<span>' + matText[m.kind] + ' <b class="num">' + stat(m.count) + '</b></span>').join('') + '</div></div>' +
      '</section>' +

      '<section class="wb-section"><div class="wb-sec-head"><h2>常用工具</h2><a href="' + withTenant('/ai/tools') + '" data-go="/ai/tools">全部工具<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.3 5.3a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4-1.4L14.58 12 9.3 6.7a1 1 0 0 1 0-1.4Z"/></svg></a></div>' +
        '<div class="wb-tools">' + TOOLS.map((t) => '<a class="wb-card wb-tool" href="' + withTenant(t.path) + '" data-go="' + t.path + '"><img src="' + t.img + '" alt="" loading="lazy"><span class="wb-tool-copy"><span class="wb-tool-name">' + t.name + '</span><span class="wb-tool-meta">' + t.meta + '</span></span></a>').join('') + '</div></section>' +

      '<section class="wb-split">' +
        '<div class="wb-card wb-trend"><div class="wb-sec-head"><h2>近 14 天生成</h2><span class="wb-kpi-sub">共 <b class="num">' + (d.tasksReady ? fmt(daily.reduce((a, b) => a + b, 0)) : '—') + '</b> 次</span></div>' +
          (maxBar ? '<div class="wb-chart"><div class="wb-axis num"><span>' + Math.ceil(maxBar) + '</span><span>' + Math.ceil(maxBar / 2) + '</span><span>0</span></div><div class="wb-plot"><div class="wb-grid"><i></i><i></i><i></i></div><div class="wb-bars">' +
            daily.map((v, i) => '<div class="wb-bar' + (i === hi ? ' hi' : '') + '" title="' + (d14[i].getMonth() + 1) + '月' + d14[i].getDate() + '日 · ' + v + ' 次"><i style="height:' + (v / maxBar * 100).toFixed(1) + '%"></i>' +
              (i === hi ? '<span class="wb-tip"><small>' + (d14[i].getMonth() + 1) + '月' + d14[i].getDate() + '日</small><b class="num">' + v + ' 次</b></span>' : '') + '</div>').join('') +
            '</div><div class="wb-xlabels num">' + d14.map((x, i) => '<span>' + (i % 2 ? '' : (x.getMonth() + 1) + '/' + x.getDate()) + '</span>').join('') + '</div></div></div>'
          : '<div class="wb-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5Zm0 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7Zm8 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V7Z"/></svg><b>' + (d.tasksReady ? '还没有生成记录' : '生成统计暂时无法读取') + '</b><button type="button" class="wb-btn ui-ai wb-btn-sm" data-go="/ai/tools">开始创作</button></div>') +
        '</div>' +
        '<div class="wb-card wb-tasks"><div class="wb-sec-head"><h2>最近任务</h2><a href="' + withTenant('/ai/assets') + '" data-go="/ai/assets">作品库</a></div>' +
          (recentTasks.length ? recentTasks.map((t) => '<a class="wb-task" href="' + withTenant(t.path) + '" data-go="' + t.path + '">' +
              (t.cover ? '<img src="' + esc(t.cover) + '" alt="" loading="lazy">' : '<span class="wb-task-ph"></span>') +
              '<span class="wb-task-body"><span class="wb-task-title">' + esc(t.title) + '</span>' +
              (t.state === 'running' && t.progress ? '<span class="wb-progress"><i style="width:' + Math.min(100, t.progress) + '%"></i></span>'
                : '<span class="wb-task-meta"><i class="wb-dot ' + t.state + '"></i>' + STATE_TEXT[t.state] + ' · ' + esc(t.label) + ' · ' + ago(t.created) + '</span>') +
              '</span></a>').join('')
            : '<div class="wb-empty wb-empty-sm"><b>' + (d.tasksReady ? '暂无任务' : '任务记录暂时无法读取') + '</b></div>') +
        '</div>' +
      '</section>' +

      '<section class="wb-section"><div class="wb-sec-head"><h2>最近作品</h2><a href="' + withTenant('/ai/assets') + '" data-go="/ai/assets">作品库<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.3 5.3a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4-1.4L14.58 12 9.3 6.7a1 1 0 0 1 0-1.4Z"/></svg></a></div>' +
        (works.length ? '<div class="wb-works">' + works.map((w) => '<a class="wb-work" href="' + withTenant('/ai/assets') + '" data-go="/ai/assets">' +
            (w.cover ? '<img src="' + esc(w.cover) + '" alt="' + esc(w.title) + '" loading="lazy">' : (w.video ? '<video src="' + esc(w.video) + '" muted preload="metadata"></video>' : '')) +
            (w.video ? '<span class="wb-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.8a1 1 0 0 1 1.52-.85l9.6 6.2a1 1 0 0 1 0 1.7l-9.6 6.2A1 1 0 0 1 8 18.2V5.8Z"/></svg>' + (w.duration ? '<span class="num">' + String(Math.floor(w.duration / 60)).padStart(2, '0') + ':' + String(Math.round(w.duration % 60)).padStart(2, '0') + '</span>' : '视频') + '</span>' : '') +
            '<span class="wb-work-cap"><b>' + esc(w.title) + '</b><small>' + esc(w.label) + ' · ' + ago(w.created) + '</small></span></a>').join('') + '</div>'
          : '<div class="wb-card wb-empty"><b>还没有作品</b><button type="button" class="wb-btn ui-ai wb-btn-sm" data-go="/ai/tools">开始创作</button></div>') +
      '</section>';
  }

  function openAccountItem(label) {
    const trigger = document.querySelector('.ia-account-trigger');
    if (!trigger) return;
    trigger.click();
    setTimeout(() => { const item = [...document.querySelectorAll('button, a, [role=menuitem]')].find((e) => e.offsetParent && e.textContent.trim() === label); if (item) item.click(); else trigger.click(); }, 120);
  }
  function openRecords() {
    const trigger = document.querySelector('.ia-account-trigger');
    if (!trigger) return;
    openAccountItem('使用记录');
  }

  document.addEventListener('uk:balance', event => {
    const value = Number(event.detail), number = root?.querySelector('.wb-focus-num');
    if (isHome() && number && event.detail != null && Number.isFinite(value)) { number.textContent = fmt(value, value % 1 ? 2 : 0); if (snapshot && rootScope === dataScope()) snapshot.balance = value; }
  });
  let root = null, loading = false, loadedAt = 0, loadEpoch = 0, rootScope = '', snapshot = null;
  const dataScope = () => tenant() + ':' + token();
  function mount() {
    const main = document.querySelector('main.ia-content');
    const html = document.documentElement;
    if (!isHome() || !main) { html.classList.remove('wb-page'); if (root && !isHome()) { ++loadEpoch; loading = false; root.remove(); root = null; } main?.classList.remove('wb-active'); return; }
    const scope = dataScope();
    if (rootScope !== scope) { ++loadEpoch; loading = false; loadedAt = 0; snapshot = null; root?.remove(); root = null; rootScope = scope; }
    html.classList.add('wb-page');
    main.classList.add('wb-active');
    if (!root || !main.contains(root)) {
      ++loadEpoch; loading = false;
      root = document.createElement('div');
      root.className = 'wb';
      root.innerHTML = '<div class="wb-head"><h1 class="wb-title">工作台</h1></div><div class="wb-loading" aria-busy="true"><i></i><i></i><i></i><i></i></div>';
      root.addEventListener('click', (e) => {
        if (e.target.closest('[data-wb-reload]')) { e.preventDefault(); loadedAt = 0; snapshot = null; mount(); return; }
        if (e.target.closest('[data-records]')) { e.preventDefault(); openRecords(); return; }
        if (e.target.closest('[data-recharge]')) { e.preventDefault(); window.UK?.openRecharge(); return; }
        const t = e.target.closest('[data-go]');
        if (!t || e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        go(t.dataset.go);
      });
      main.append(root);
      if (snapshot && Date.now() - loadedAt <= 30000) render(root, snapshot);
    }
    if (!loading && Date.now() - loadedAt > 30000) {
      loading = true;
      const target = root, epoch = ++loadEpoch;
      load().then((d) => {
        if (epoch !== loadEpoch || dataScope() !== scope || root !== target || !target.isConnected || !isHome()) return;
        snapshot = d; loadedAt = Date.now(); render(target, d);
      }).finally(() => { if (epoch === loadEpoch) loading = false; });
    }
  }
  let t = 0;
  const schedule = () => {
    document.documentElement.classList.toggle('wb-page', isHome());
    if (!t) t = requestAnimationFrame(() => { t = 0; mount(); });
  };
  ['pushState', 'replaceState'].forEach((m) => { const o = history[m]; history[m] = function () { const r = o.apply(this, arguments); schedule(); return r; }; });
  addEventListener('popstate', schedule);
  new MutationObserver(() => { if (isHome() && (!root || !root.isConnected)) schedule(); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule); else schedule();
})();
