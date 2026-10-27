/* GEO content · keyword libraries. Real merchantGeo APIs, no generated fixtures. */
(() => {
  'use strict';
  window.GEO_CONTENT_PARTS = window.GEO_CONTENT_PARTS || {};
  window.GEO_CONTENT_PARTS.keywords = function (C) {
    const { G, UK, H } = C;
    const { esc, icon, btn, empty, status, when, setErr } = H;
    const liveStates = ['queued', 'running', 'submitting', 'polling'];
    const S = { data: null, options: null, optionsError: '', error: '', request: 0, timer: 0, active: false, dead: false, initialized: false, picked: new Map(), resultPicks: new Map(), saving: false, dialogs: new Set(), brand: '' };
    let switchTarget = null;
    const fresh = () => ({ group: 0, page: 1, keyword: '', search: '', job: 0, chosen: false, manual: { group: 0, mode: 'combine', parts: ['', '', '', '', '', ''], direct: '' }, ai: { group: 0, seed: '', count: 20, model: '' } });
    const draft = () => {
      if (!C.draftBag.keywords || typeof C.draftBag.keywords !== 'object') C.draftBag.keywords = fresh();
      const d = C.draftBag.keywords;
      d.group = Math.max(0, Number(d.group) || 0); d.page = Math.max(1, Number(d.page) || 1);
      d.keyword = String(d.keyword || '').slice(0, 80); d.search = String(d.search == null ? d.keyword : d.search).slice(0, 80);
      if (!d.manual || !Array.isArray(d.manual.parts) || d.manual.parts.length !== 6) d.manual = fresh().manual;
      if (!d.ai || typeof d.ai !== 'object') d.ai = fresh().ai;
      return d;
    };
    const saveDraft = () => C.persist();
    const groups = () => S.data ? S.data.groups || [] : [];
    const group = () => groups().find((r) => Number(r.id) === draft().group);
    const groupOptions = (placeholder) => (placeholder ? [['', '请选择目标词库']] : []).concat(groups().map((g) => [String(g.id), g.title]));
    const field = (label, html, hint) => '<label class="gc-k-field"><span>' + esc(label) + '</span>' + html + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</label>';
    const input = (name, value, attrs) => '<input class="uk-input" name="' + esc(name) + '" value="' + esc(value || '') + '" ' + (attrs || '') + '>';
    const textarea = (name, value, attrs) => '<textarea class="uk-textarea" name="' + esc(name) + '" ' + (attrs || '') + '>' + esc(value || '') + '</textarea>';
    const select = (name, items, value, attrs) => '<select class="uk-select" name="' + esc(name) + '" ' + (attrs || '') + '>' + items.map(([v, t]) => '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>';
    const check = (picked, attr, label, mixed) => '<button type="button" class="uk-check" role="checkbox" aria-checked="' + (mixed ? 'mixed' : !!picked) + '" aria-label="' + esc(label) + '" ' + attr + '>' + icon('check') + '</button>';
    const length = (v) => Array.from(String(v || '')).length;
    const lines = (v) => [...new Set(String(v || '').replace(/^\uFEFF/, '').split(/\r?\n/).map((t) => t.trim()).filter(Boolean))];
    const val = (ctx, name) => { const el = ctx.body.querySelector('[name="' + name + '"]'); return el ? el.value : ''; };
    const isHere = (brand) => !S.dead && S.active && String(G.S.brand) === String(brand) && G.V === 'keywords';
    const isOpen = (ctx) => ctx.el.isConnected;
    function dialog(opt) {
      const oldClose = opt.onClose;
      let ctx;
      ctx = UK.dialog({ ...opt, onClose(v) { S.dialogs.delete(ctx); if (oldClose) oldClose(v); } });
      S.dialogs.add(ctx);
      return ctx;
    }
    function disable(ctx, busy) {
      ctx.el.querySelectorAll('.uk-dialog-foot button,[data-close]').forEach((b) => { b.disabled = busy; });
      ctx.body.querySelectorAll('input,textarea,select').forEach((b) => { b.disabled = busy; });
    }
    function err(ctx, e) { if (isOpen(ctx)) setErr(ctx, typeof e === 'string' ? e : e.message || '操作未完成，请重试'); }
    function validateTerms(rows) {
      if (!rows.length || rows.length > 100) return '每次保存 1–100 条，请调整勾选数量。';
      if (rows.some((t) => length(t) > 500)) return '每条选题词或客户问题不能超过 500 字。';
      return '';
    }
    function exported(rows, title) {
      if (!rows.length) return UK.toast('没有可导出的词条', 'info');
      const cell = (v) => { let s = String(v == null ? '' : v); if (/^[\s]*[=+@-]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
      const csv = [['选题词/客户问题', '意图', '来源', '更新时间'], ...rows.map((r) => [r.question || r.text || r, r.intent || '', r.source === 'ai_generated' ? 'AI 拓词' : '手工 / 历史', r.update_time ? when(r.update_time) : ''])].map((r) => r.map(cell).join(',')).join('\r\n');
      C.download((title || (group() || {}).title || '未归类词条') + '.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8');
    }
    function activeJobs() { return ((S.data && S.data.jobs) || []).filter((j) => Number(j.group_id) === draft().group); }
    function activeJob() { const jobs = activeJobs(); return jobs.find((j) => Number(j.id) === Number(draft().job)) || jobs[0]; }
    function resultsOf(job) {
      if (!job || job.status !== 'success') return [];
      const rows = job.result && job.result.questions;
      return Array.isArray(rows) ? [...new Map(rows.filter((r) => r && typeof r.question === 'string' && r.question.trim()).map((r) => [r.question, r])).values()] : [];
    }
    function pickedResults(job) {
      const rows = resultsOf(job), signature = JSON.stringify(rows.map((r) => r.question));
      let p = S.resultPicks.get(String(job.id));
      if (!p || p.signature !== signature) { p = { signature, set: new Set(rows.map((r) => r.question)) }; S.resultPicks.set(String(job.id), p); }
      return p.set;
    }
    function chooseGroup(id, reload = true) {
      const d = draft(); d.group = Math.max(0, Number(id) || 0); d.page = 1; d.keyword = ''; d.search = ''; d.job = 0; d.chosen = true;
      S.picked.clear(); S.error = ''; saveDraft(); UK.batch(null);
      if (reload && S.active) draw(G.S.seq);
    }
    function updateBatch() {
      if (!S.active) return;
      UK.batch({ count: S.picked.size, actions: [{ key: 'write', icon: 'article', label: '用来写稿' }, { key: 'export', icon: 'download', label: '导出' }],
        onClear() { S.picked.clear(); paintSelections(); },
        onAction(k) { if (k === 'export') exported([...S.picked.values()]); else if (k === 'write') { const rows = [...S.picked.values()]; if (rows.length && rows.length <= 100) { UK.batch(null); C.toStudio(rows.map((r) => ({ text: r.question, source_question_id: Number(r.id), intent: r.intent || '', source: 'keyword', id: Number(r.id) })), draft().group); } } }
      });
    }
    function paintSelections() {
      const body = C.body(); if (!body) return;
      body.querySelectorAll('[data-gc-k-pick]').forEach((el) => { const yes = S.picked.has(Number(el.dataset.gcKPick)); el.setAttribute('aria-checked', String(yes)); el.closest('tr').classList.toggle('is-selected', yes); });
      const rows = (S.data && S.data.lists) || [], total = rows.filter((r) => S.picked.has(Number(r.id))).length;
      const all = body.querySelector('[data-gc-k-pick-all]'); if (all) all.setAttribute('aria-checked', total && total < rows.length ? 'mixed' : String(rows.length > 0 && total === rows.length));
      updateBatch();
    }
    function skeleton() {
      return '<div class="uk-card gc-k-window" aria-busy="true"><aside class="gc-k-nav"><div class="gc-k-nav-head">' + UK.skel('46%', 20) + '</div>' + Array.from({ length: 4 }, () => '<div class="gc-k-skel-item">' + UK.skel('100%', 36, 8) + '</div>').join('') + '</aside><section class="gc-k-main"><div class="gc-k-heading">' + UK.skel('36%', 22) + '</div><div class="gc-k-toolbar">' + UK.skel('48%', 38, 10) + '</div>' + G.skelRows(6) + '</section></div>';
    }
    async function draw(seq, poll = false) {
      if (S.dead) return;
      S.active = true;
      const brand = String(G.S.brand), d = draft();
      if (S.brand !== brand) { S.brand = brand; S.data = null; S.options = null; S.initialized = false; S.picked.clear(); S.resultPicks.clear(); }
      if (switchTarget && switchTarget.brand === brand) { d.group = switchTarget.group; d.chosen = true; d.page = 1; switchTarget = null; saveDraft(); }
      clearTimeout(S.timer);
      const ticket = ++S.request;
      const valid = () => ticket === S.request && isHere(brand) && G.live(seq);
      const body = C.body(); if (!body) return;
      if (!S.data) body.innerHTML = skeleton();
      else if (!poll) { const list = body.querySelector('.gc-k-main'); if (list) list.setAttribute('aria-busy', 'true'); }
      try {
        const [data, opts] = await Promise.all([G.geo('keywordLibrary', { group_id: d.group, page: d.page, page_size: 20, keyword: d.keyword }), C.options().then((o) => ({ data: o }), (e) => ({ error: e.message }))]);
        if (!valid()) return;
        S.data = data; S.error = ''; S.options = opts.data || S.options; S.optionsError = opts.error || '';
        if (!S.initialized) {
          S.initialized = true;
          if (!d.chosen && !d.group && data.groups && data.groups.length) { chooseGroup(data.groups[0].id, false); return draw(seq); }
        }
        if (d.page > 1 && !data.lists.length && Number(data.count) <= (d.page - 1) * 20) { d.page = Math.max(1, Math.ceil(Number(data.count) / 20)); saveDraft(); return draw(seq); }
        G.counts({ keywords: (data.groups || []).reduce((n, r) => n + Number(r.count || 0), Number(data.unfiled_count || 0)) });
        paint(poll);
        if ((data.jobs || []).some((j) => liveStates.includes(j.status))) S.timer = setTimeout(() => { if (valid()) draw(seq, true); }, 2500);
      } catch (e) {
        if (!valid()) return;
        S.error = e.message || '词库读取失败';
        if (S.data) paint(false);
        else body.innerHTML = '<div class="uk-card gc-k-load-error">' + empty({ icon: 'alert', title: S.error, compact: true, actions: [{ label: '重新读取', attrs: { 'data-gc-k-retry': '' } }] }) + '</div>';
      }
    }
    function resultHTML() {
      const jobs = activeJobs(), job = activeJob(); if (!jobs.length || !job) return '';
      const rows = resultsOf(job), picked = pickedResults(job), st = H.JOB[job.status] || ['off', job.status || '未知状态'];
      const jobSelect = select('gc-k-job', jobs.map((j) => [String(j.id), '#' + j.id + ' · ' + (j.subject || 'AI 拓词') + (j.create_time ? ' · ' + when(j.create_time) : '')]), job.id, 'aria-label="选择 AI 拓词任务"');
      let content = '';
      if (rows.length) content = '<div class="gc-k-result-tools">' + check(picked.size === rows.length, 'data-gc-k-result-all', '选择全部 AI 结果', picked.size > 0 && picked.size < rows.length) + '<span>全选 <b class="num">' + rows.length + '</b> 条</span><span class="uk-grow"></span><span class="uk-meta">AI 建议不代表真实搜索量</span></div><div class="gc-k-results-list">' + rows.map((r, i) => '<div class="gc-k-result-row">' + check(picked.has(r.question), 'data-gc-k-result="' + i + '"', '采用 ' + r.question) + '<span>' + esc(r.question) + '</span><small>' + esc(r.intent || '') + '</small></div>').join('') + '</div><div class="gc-k-result-foot"><span class="uk-meta">入库后可在下方词表中继续编辑</span>' + btn({ kind: 'primary', size: 'sm', label: '保存到词库（' + picked.size + '）', disabled: !picked.size || !draft().group || S.saving, attrs: { 'data-gc-k-save-results': '' } }) + '</div>';
      else if (liveStates.includes(job.status)) content = '<div class="gc-k-job-progress">' + status('run', '结果会自动更新') + '<div class="uk-progress is-indet"><i></i></div><span class="uk-meta">可以先整理已有词条，或离开本页稍后查看</span></div>';
      else content = '<div class="gc-k-job-note"><span>' + esc(job.error || '这次任务没有可采用的结构化词条') + '</span>' + btn({ kind: 'ghost', size: 'sm', label: '查看任务与 TP', attrs: { 'data-gc-k-jobs': '' } }) + '</div>';
      return '<section class="gc-k-results" aria-label="AI 拓词结果"><div class="gc-k-results-head"><h3>' + icon('spark') + 'AI 拓词结果</h3>' + jobSelect + status(st[0], st[1]) + '</div>' + content + '<p class="gc-k-result-error" data-gc-k-result-error role="alert" hidden></p></section>';
    }
    function paint(poll) {
      if (!S.active || !S.data) return;
      const body = C.body(), d = draft(), data = S.data, cur = group(), rows = data.lists || [], gs = groups();
      const focus = document.activeElement, keepSearch = focus && body.contains(focus) && focus.name === 'gc-k-search';
      const oldScroll = body.querySelector('.gc-k-results-list')?.scrollTop || 0;
      if (poll && keepSearch) d.search = focus.value;
      const noLibraries = !gs.length, title = cur ? cur.title : '未归类';
      const nav = '<aside class="gc-k-nav" aria-label="词库"><div class="gc-k-nav-sticky"><div class="gc-k-nav-head"><h2>词库 <small class="num">' + gs.length + '</small></h2>' + btn({ kind: 'ghost', size: 'sm', icon: 'plus', iconOnly: true, label: '新建词库', attrs: { 'data-gc-k-new': '' } }) + '</div><div class="gc-k-nav-items">' + gs.map((g) => '<button type="button" class="gc-k-group' + (Number(g.id) === d.group ? ' is-active' : '') + '" data-gc-k-group="' + Number(g.id) + '"' + (Number(g.id) === d.group ? ' aria-current="true"' : '') + ' title="' + esc(g.title) + '">' + icon('folder') + '<span>' + esc(g.title) + '</span><small class="num">' + Number(g.count || 0) + '</small></button>').join('') + '</div><div class="gc-k-unfiled"><button type="button" class="gc-k-group' + (!d.group ? ' is-active' : '') + '" data-gc-k-group="0"' + (!d.group ? ' aria-current="true"' : '') + '>' + icon('archive') + '<span>未归类</span><small class="num">' + Number(data.unfiled_count || 0) + '</small></button></div></div></aside>';
      let content;
      if (noLibraries && !Number(data.unfiled_count) && !d.keyword) content = '<div class="gc-k-first">' + empty({ icon: 'folder', title: '先为「' + G.brandName() + '」建第一个词库', actions: [{ kind: 'primary', icon: 'plus', label: '新建词库', attrs: { 'data-gc-k-new': '' } }] }) + '<p class="uk-meta">核心产品词 · 行业选购问题 · 客户常见问题</p></div>';
      else {
        const table = rows.length ? '<div class="uk-table-wrap gc-k-table-wrap"><table class="uk-table gc-k-table"><thead><tr><th class="gc-k-checkbox">' + check(rows.every((r) => S.picked.has(Number(r.id))), 'data-gc-k-pick-all', '选择本页词条', rows.some((r) => S.picked.has(Number(r.id))) && !rows.every((r) => S.picked.has(Number(r.id)))) + '</th><th>选题词 / 客户问题</th><th>意图</th><th>来源</th><th>更新时间</th><th class="is-act">操作</th></tr></thead><tbody>' + rows.map((r) => '<tr' + (S.picked.has(Number(r.id)) ? ' class="is-selected"' : '') + '><td class="gc-k-checkbox">' + check(S.picked.has(Number(r.id)), 'data-gc-k-pick="' + Number(r.id) + '"', '选择 ' + r.question) + '</td><td class="gc-k-word">' + esc(r.question) + '</td><td class="gc-k-intent">' + esc(r.intent || '—') + '</td><td class="gc-k-source">' + (r.source === 'ai_generated' ? '<span>' + icon('spark') + 'AI 拓词</span>' : '手工 / 历史') + '</td><td class="gc-k-date num">' + esc(when(r.update_time)) + '</td><td class="is-act">' + btn({ kind: 'ghost', size: 'sm', label: '编辑', attrs: { 'data-gc-k-edit': Number(r.id) } }) + '</td></tr>').join('') + '</tbody></table></div>'
          : '<div class="gc-k-empty">' + empty({ icon: d.keyword ? 'search' : 'article', title: d.keyword ? '没有符合条件的词条' : '「' + title + '」还没有词条', compact: true, actions: d.keyword ? [{ label: '清除筛选', attrs: { 'data-gc-k-clear': '' } }] : [{ label: gs.length ? '手动拓词' : '新建词库', attrs: { [gs.length ? 'data-gc-k-manual' : 'data-gc-k-new']: '' } }] }) + '</div>';
        content = '<div class="gc-k-heading"><div><h2>' + esc(title) + '</h2>' + (cur && cur.content ? '<p class="gc-k-direction">' + esc(cur.content) + '</p>' : '') + '</div>' + (cur ? btn({ kind: 'ghost', size: 'sm', icon: 'edit', label: '编辑词库', attrs: { 'data-gc-k-edit-group': '' } }) : '') + '</div>' +
          '<div class="gc-k-toolbar"><form class="gc-k-search" data-gc-k-search-form><div class="uk-search">' + icon('search') + input('gc-k-search', d.search, 'maxlength="80" aria-label="搜索当前词库" placeholder="搜索词条或客户问题"') + '</div>' + btn({ kind: 'secondary', label: '搜索', attrs: { 'data-gc-k-search': '' } }) + '</form><div class="uk-actions">' + btn({ kind: 'secondary', label: '手动拓词', attrs: { 'data-gc-k-manual': '' } }) + btn({ kind: 'ai', icon: 'spark', label: 'AI 拓词', attrs: { 'data-gc-k-ai': '' } }) + btn({ kind: 'ghost', icon: 'more', iconOnly: true, label: '词条导入与导出', attrs: { 'data-gc-k-more': '', 'aria-haspopup': 'menu' } }) + '</div></div>' +
          (d.keyword ? '<div class="gc-k-filters"><button type="button" data-gc-k-clear>搜索：' + esc(d.keyword) + icon('close') + '</button>' + btn({ kind: 'ghost', size: 'sm', label: '清除筛选', attrs: { 'data-gc-k-clear': '' } }) + '</div>' : '') +
          (S.options && !S.options.text_available ? '<div class="gc-k-service">' + status('off', 'AI 拓词待开通') + btn({ kind: 'ghost', size: 'sm', label: '怎么开通', attrs: { 'data-gc-k-how': '' } }) + '</div>' : '') +
          (S.optionsError ? '<div class="gc-k-inline-error">' + icon('alert') + '<span>模型信息读取失败：' + esc(S.optionsError) + '</span>' + btn({ kind: 'ghost', size: 'sm', label: '重试', attrs: { 'data-gc-k-retry': '' } }) + '</div>' : '') + resultHTML() + table + UK.pager(Number(data.count), d.page, 20).replace(/data-page=/g, 'data-gc-k-page=');
      }
      body.innerHTML = '<div class="uk-card gc-k-window">' + nav + '<section class="gc-k-main">' + (S.error ? '<div class="gc-k-inline-error">' + icon('alert') + '<span>' + esc(S.error) + '</span>' + btn({ kind: 'ghost', size: 'sm', label: '重新读取', attrs: { 'data-gc-k-retry': '' } }) + '</div>' : '') + content + '</section></div><input type="file" accept=".txt,text/plain" data-gc-k-import-file hidden>';
      const form = body.querySelector('[data-gc-k-search-form]'); if (form) form.onsubmit = (e) => { e.preventDefault(); search(); };
      const searchInput = body.querySelector('[name="gc-k-search"]'); if (searchInput) searchInput.oninput = () => { d.search = searchInput.value; saveDraft(); };
      const jobSelect = body.querySelector('[name="gc-k-job"]'); if (jobSelect) jobSelect.onchange = () => { d.job = Number(jobSelect.value); saveDraft(); paint(false); };
      const file = body.querySelector('[data-gc-k-import-file]'); if (file) file.onchange = async () => { const f = file.files && file.files[0]; file.value = ''; if (f) await importFile(f); };
      const resultList = body.querySelector('.gc-k-results-list'); if (resultList) resultList.scrollTop = oldScroll;
      if (poll && keepSearch && searchInput) { searchInput.focus({ preventScroll: true }); searchInput.setSelectionRange(d.search.length, d.search.length); }
      updateBatch();
    }
    function search() {
      const d = draft(), el = C.body().querySelector('[name="gc-k-search"]'); d.keyword = (el ? el.value : d.search).trim(); d.search = d.keyword; d.page = 1; S.picked.clear(); saveDraft(); draw(G.S.seq);
    }
    async function editLibrary(row) {
      const brand = String(G.S.brand), original = row || {}, isEdit = !!original.id;
      const d = !isEdit && draft().newLibrary ? draft().newLibrary : { brand, title: original.title || '', content: original.content || '' };
      const brands = G.S.brands || [];
      let busy = false;
      const ctx = dialog({ title: isEdit ? '编辑词库' : '新建词库', width: 560, dismissable: false,
        body: '<div class="gc-k-dialog">' + (isEdit ? '<div class="gc-k-owner">' + icon('store') + '<span>' + esc(G.brandName()) + '</span></div>' : field('关联品牌', select('brand', brands.map((b) => [String(b.id), b.name]), d.brand, 'aria-label="关联品牌"'))) + field('词库名称', input('title', d.title, 'maxlength="255" autofocus placeholder="例如：客户选购问题"')) + field('核心词与方向', textarea('content', d.content, 'rows="4" maxlength="500" placeholder="产品、业务场景与客户关心的问题"'), '最多 500 字') + '</div>',
        actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'save', label: '保存词库', kind: 'primary' }],
        async onAction(k, c) {
          if (busy) return false; if (k === 'cancel') return;
          const title = val(c, 'title').trim(), content = val(c, 'content').trim(), targetBrand = isEdit ? brand : val(c, 'brand');
          if (!targetBrand || !title || length(title) > 255 || length(content) > 500) { err(c, '请选择品牌，填写 1–255 字词库名；核心词与方向最多 500 字。'); return false; }
          busy = true; setErr(c, ''); disable(c, true); c.busy('save', true);
          try {
            const r = await G.geo('keywordLibrarySave', {}, { brand_id: targetBrand, id: Number(original.id) || 0, revision: Number(original.revision) || 0, title, content, enabled: original.data ? original.data.enabled !== false : true });
            if (!isEdit && String(G.S.brand) === brand) { delete draft().newLibrary; saveDraft(); }
            if (isOpen(c)) c.close('saved');
            if (String(G.S.brand) !== brand || S.dead) return false;
            if (String(r.brand_id) !== brand) { switchTarget = { brand: String(r.brand_id), group: Number(r.id) }; G.switchBrand(String(r.brand_id), 'keywords'); }
            else { chooseGroup(r.id, false); S.initialized = true; await refreshResources(); if (isHere(brand)) await draw(G.S.seq); }
            UK.toast('词库已保存');
          } catch (e) { err(c, e); } finally { busy = false; if (isOpen(c)) { disable(c, false); c.busy('save', false); } }
          return false;
        }
      });
      if (!isEdit) ctx.body.addEventListener('input', () => { draft().newLibrary = { brand: val(ctx, 'brand'), title: val(ctx, 'title'), content: val(ctx, 'content') }; saveDraft(); });
    }
    async function refreshResources() { try { await C.resources('keyword', true); } catch (_) { /* The library endpoint refresh below remains authoritative. */ } }
    function editTerm(row) {
      // The unfiled list includes orphaned historical group IDs. Keep those in unfiled (0).
      const brand = String(G.S.brand), groupId = draft().group; let busy = false;
      dialog({ title: '编辑词条', width: 560, body: '<div class="gc-k-dialog">' + field('选题词 / 客户问题', textarea('question', row.question, 'rows="4" maxlength="500" autofocus'), '最多 500 字') + field('意图', input('intent', row.intent || '内容选题', 'maxlength="80" placeholder="例如：选购决策"')) + '</div>',
        actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'save', label: '保存修改', kind: 'primary' }],
        async onAction(k, c) {
          if (busy) return false; if (k === 'cancel') return;
          const question = val(c, 'question').trim(), intent = val(c, 'intent').trim();
          if (!question || length(question) > 500 || !intent || length(intent) > 80) { err(c, '请填写 1–500 字词条和 1–80 字意图。'); return false; }
          busy = true; disable(c, true); c.busy('save', true); setErr(c, '');
          try { await G.geo('keywordLibraryUpdate', {}, { id: Number(row.id), question, intent, keyword_group_id: groupId, expected_hash: row.expected_hash }); if (isOpen(c)) c.close('saved'); if (isHere(brand)) { S.picked.delete(Number(row.id)); await draw(G.S.seq); } UK.toast('词条已更新'); }
          catch (e) { err(c, e); } finally { busy = false; if (isOpen(c)) { disable(c, false); c.busy('save', false); } } return false;
        }
      });
    }
    function howTo() {
      dialog({ title: 'AI 拓词待开通', width: 480, body: '<div class="gc-k-how">' + status('off', '文本模型待开通') + '<p>' + esc((S.options && S.options.text_notice) || '请联系服务商配置 GEO 文本模型及输入、输出 Token 单价。开通后即可先确认费用，再提交 AI 拓词任务。') + '</p><p class="uk-meta">现在可以新建词库、手动组合或导入文本。</p></div>', actions: [{ key: 'ok', label: '知道了', kind: 'primary' }] });
    }
    async function aiDialog() {
      if (!S.options) { try { S.options = await C.options(); } catch (e) { S.optionsError = e.message; paint(false); return; } }
      if (!S.active) return;
      if (!S.options.text_available || !(S.options.models || []).length) return howTo();
      if (!groups().length) return editLibrary();
      const brand = String(G.S.brand), a = draft().ai;
      if (!groups().some((g) => Number(g.id) === Number(a.group)) || Number(a.group) !== draft().group) { a.group = draft().group || Number(groups()[0].id); const g = groups().find((g) => Number(g.id) === Number(a.group)); a.seed = g.content || g.title; }
      const models = S.options.models || []; if (!models.some((m) => String(m.id) === String(a.model))) a.model = String(S.options.default_model_id || models[0].id);
      const pending = C.draftBag.charges && C.draftBag.charges.keywords;
      if (pending && pending.attempted && pending.action === 'studioKeywords') { const p = pending.body; a.group = Number(p.keyword_group_id); a.seed = p.subject; a.count = Number(p.question_count); a.model = String(p.model_id); }
      const locked = () => !!(C.draftBag.charges && C.draftBag.charges.keywords && C.draftBag.charges.keywords.attempted);
      let busy = false;
      const ctx = dialog({ title: 'AI 拓词', width: 600, dismissable: false,
        body: '<div class="gc-k-dialog">' + (locked() ? '<div class="uk-notice">' + icon('info') + '<span>有一笔拓词提交尚未确认，先恢复原请求。</span></div>' : '') + field('目标词库', select('target', groupOptions(false), a.group)) + field('核心词与方向', textarea('seed', a.seed, 'rows="4" maxlength="500" autofocus')) + '<div class="gc-k-two">' + field('拓词数量', select('count', [[10, '10 条'], [20, '20 条'], [30, '30 条']], a.count)) + field('文本模型', select('model', models.map((m) => [String(m.id), m.name]), a.model)) + '</div><div class="gc-k-ai-foot">' + icon('book') + '<span>自动引用「' + esc(G.brandName()) + '」的企业知识</span></div></div>',
        actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'next', label: '预览费用', kind: 'ai', icon: 'spark' }],
        async onAction(k, c) {
          if (busy) return false; if (k === 'cancel') return;
          if (!locked()) collect(); const frozen = locked() ? C.draftBag.charges.keywords.body : null;
          const model = models.find((m) => String(m.id) === String(a.model));
          if (!frozen && (!a.group || !a.seed.trim() || length(a.seed) > 500 || !model || ![10, 20, 30].includes(a.count))) { err(c, '请选择目标词库、文本模型，并填写 1–500 字核心词与方向。'); return false; }
          busy = true; setErr(c, ''); disable(c, true);
          try {
            const targetId = Number(frozen ? frozen.keyword_group_id : a.group);
            const request = frozen ? { ...frozen } : { subject: a.seed.trim(), question_count: a.count, keyword_group_id: targetId, model_id: String(model.id), quote_token: model.quote_token, accept_charge: true };
            delete request.request_key; // The shared charge gate owns and reuses its immutable key.
            await C.charge({ slot: 'keywords', title: '确认拓词费用', action: 'studioKeywords', body: request,
              async onSuccess(r) {
                if (isOpen(c)) c.close('submitted');
                if (!isHere(brand)) return;
                chooseGroup(targetId, false); draft().job = Number(r.id); saveDraft(); await draw(G.S.seq);
                UK.toast('拓词已提交，完成后可选择结果入库');
              }
            });
          } catch (e) { err(c, e); } finally { busy = false; if (isOpen(c)) { disable(c, false); lockFields(); } }
          return false;
        }
      });
      function collect() { if (locked()) return; a.group = Number(val(ctx, 'target')); a.seed = val(ctx, 'seed'); a.count = Number(val(ctx, 'count')); a.model = val(ctx, 'model'); saveDraft(); }
      function lockFields() { if (locked()) ctx.body.querySelectorAll('input,textarea,select').forEach((el) => { el.disabled = true; }); }
      ctx.body.addEventListener('input', collect);
      ctx.body.querySelector('[name="target"]').addEventListener('change', () => { const g = groups().find((g) => Number(g.id) === Number(val(ctx, 'target'))); if (g) { ctx.body.querySelector('[name="seed"]').value = g.content || g.title; } collect(); });
      lockFields();
    }
    function manualDialog(importText) {
      if (!groups().length) return editLibrary();
      const brand = String(G.S.brand), m = draft().manual;
      if (!groups().some((g) => Number(g.id) === Number(m.group)) || Number(m.group) !== draft().group) m.group = draft().group || Number(groups()[0].id);
      if (typeof importText === 'string') { m.mode = 'direct'; m.direct = importText; }
      let preview = [], selected = new Set(), previewPage = 1, busy = false;
      const labels = ['A 地区 / 前缀', 'B 形容词', 'C 主词（必填）', 'D 同义词', 'E 推荐词', 'F 疑问词'];
      const ctx = dialog({ title: typeof importText === 'string' ? '导入词条' : '手动拓词', width: 960, dismissable: false, body: '<div class="gc-k-manual"></div>',
        actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'save', label: '保存到词库', kind: 'primary' }],
        async onAction(k, c) {
          if (busy) return false; if (k === 'cancel') return;
          collect(); const chosen = m.mode === 'direct' ? lines(m.direct) : preview.filter((t) => selected.has(t)), validation = validateTerms(chosen);
          if (!m.group) { err(c, '请选择目标词库。'); return false; } if (validation) { err(c, validation); return false; }
          busy = true; setErr(c, ''); disable(c, true); c.busy('save', true);
          try { const r = await G.geo('keywordLibraryAdd', {}, { keyword_group_id: Number(m.group), topics: chosen.map((text) => ({ text })) }); if (isOpen(c)) c.close('saved'); if (isHere(brand)) { draft().manual = fresh().manual; chooseGroup(m.group, false); saveDraft(); await draw(G.S.seq); } UK.toast('已保存 ' + (r.ids || []).length + ' 条，同库重复词已合并'); }
          catch (e) { err(c, e); } finally { busy = false; if (isOpen(c)) { disable(c, false); c.busy('save', false); updateSave(); } }
          return false;
        }
      });
      function collect() {
        const box = ctx.body.querySelector('.gc-k-manual'); if (!box) return;
        m.group = Number(val(ctx, 'target')) || Number(m.group);
        if (m.mode === 'direct') m.direct = val(ctx, 'direct');
        else m.parts = labels.map((_, i) => val(ctx, 'part' + i));
        saveDraft();
      }
      function updateSave() {
        const n = m.mode === 'direct' ? lines(m.direct).length : selected.size, b = ctx.el.querySelector('[data-act="save"]');
        if (b) { b.disabled = busy || !m.group || !n || n > 100; const s = b.querySelector('span'); if (s) s.textContent = '保存到词库（' + n + '）'; }
        const count = ctx.body.querySelector('[data-gc-k-direct-count]'); if (count) { count.textContent = n > 100 ? '已超出 ' + (n - 100) + ' 条，请减少至 100 条' : n + ' / 100 条'; count.classList.toggle('is-over', n > 100); }
      }
      function previewHTML() {
        if (!preview.length) return '<div class="gc-k-preview-empty"><span>先填主词，再生成组合预览</span><small>空栏会跳过；每栏最多 100 个词，组合最多 1,000 条</small></div>';
        const visible = preview.slice((previewPage - 1) * 20, previewPage * 20), all = visible.every((t) => selected.has(t)), some = visible.some((t) => selected.has(t));
        return '<div class="gc-k-preview-head">' + check(all, 'data-gc-k-manual-all', '选择本页组合', !all && some) + '<b>组合预览 <span class="num">' + preview.length + '</span></b><span class="uk-grow"></span><span class="uk-meta">已选 ' + selected.size + ' / 100</span>' + btn({ kind: 'ghost', size: 'sm', label: '清空选择', disabled: !selected.size, attrs: { 'data-gc-k-manual-clear': '' } }) + '</div><div class="gc-k-preview-list">' + visible.map((t, i) => '<div>' + check(selected.has(t), 'data-gc-k-manual-pick="' + ((previewPage - 1) * 20 + i) + '"', '选择 ' + t) + '<span>' + esc(t) + '</span></div>').join('') + '</div>' + UK.pager(preview.length, previewPage, 20).replace(/data-page=/g, 'data-gc-k-manual-page=');
      }
      function paintPreview() { ctx.body.querySelector('[data-gc-k-manual-preview]').innerHTML = previewHTML(); updateSave(); }
      function render() {
        ctx.body.querySelector('.gc-k-manual').innerHTML = '<div class="gc-k-manual-target">' + field('目标词库', select('target', groupOptions(false), m.group)) + '<span class="uk-meta">预览与录入不消耗 TP</span></div><div class="gc-k-mode-line"><div class="uk-seg" role="group" aria-label="手动拓词方式"><button type="button" aria-pressed="' + (m.mode === 'combine') + '" data-gc-k-mode="combine">组合拓词</button><button type="button" aria-pressed="' + (m.mode === 'direct') + '" data-gc-k-mode="direct">直接录入</button></div></div>' +
          (m.mode === 'combine' ? '<div class="gc-k-parts">' + labels.map((t, i) => field(t, textarea('part' + i, m.parts[i], 'rows="5" maxlength="5000" placeholder="每行一个词"' + (i === 2 ? ' autofocus' : '')))).join('') + '</div><div class="gc-k-preview-actions">' + btn({ kind: 'secondary', label: '生成组合预览', attrs: { 'data-gc-k-preview': '' } }) + '<span class="uk-grow"></span>' + btn({ kind: 'ghost', icon: 'download', label: '导出预览', disabled: !preview.length, attrs: { 'data-gc-k-manual-export': '' } }) + '</div><div data-gc-k-manual-preview>' + previewHTML() + '</div>'
            : field('选题词 / 客户问题', textarea('direct', m.direct, 'rows="11" autofocus placeholder="每行一条，最多 100 条"')) + '<div class="gc-k-direct-foot"><span class="uk-meta">每条最多 500 字，同一词库自动去重</span><span class="num" data-gc-k-direct-count></span></div>');
        updateSave();
      }
      ctx.body.addEventListener('input', (e) => { if (!e.target.matches('textarea,input,select')) return; collect(); if (e.target.name.startsWith('part')) { preview = []; selected.clear(); previewPage = 1; paintPreview(); const exportBtn = ctx.body.querySelector('[data-gc-k-manual-export]'); if (exportBtn) exportBtn.disabled = true; } updateSave(); });
      ctx.body.addEventListener('change', (e) => { if (e.target.name === 'target') { collect(); preview = []; selected.clear(); previewPage = 1; if (m.mode === 'combine') render(); } });
      ctx.body.addEventListener('click', async (e) => {
        if (busy) return;
        const b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-gc-k-mode')) { collect(); m.mode = b.dataset.gcKMode; saveDraft(); setErr(ctx, ''); render(); }
        else if (b.hasAttribute('data-gc-k-preview')) {
          collect(); let message = '', total = 1;
          m.parts.forEach((p, i) => { const words = lines(p); total *= Math.max(1, words.length); if (words.length > 100 || words.some((w) => length(w) > 100) || length(p) > 5000) message = '每栏最多 100 个词，每个词最多 100 字，每栏总长最多 5,000 字。'; if (i === 2 && !words.length) message = '请至少填写一个主词。'; });
          if (!message && total > 1000) message = '组合将超过 1,000 条，请减少每栏词条。';
          if (message) return err(ctx, message);
          busy = true; setErr(ctx, ''); disable(ctx, true); b.disabled = true; b.classList.add('is-busy');
          try { const r = await G.geo('keywordManualPreview', {}, { keyword_group_id: Number(m.group), parts: m.parts }); if (!isOpen(ctx) || String(G.S.brand) !== brand) return; preview = Array.isArray(r.terms) ? r.terms : []; selected = new Set(preview.length <= 100 ? preview : []); previewPage = 1; render(); if (preview.length > 100) err(ctx, '共 ' + preview.length + ' 条组合，请勾选最多 100 条保存；也可以导出全部预览。'); }
          catch (e2) { err(ctx, e2); } finally { busy = false; if (isOpen(ctx)) { disable(ctx, false); b.disabled = false; b.classList.remove('is-busy'); updateSave(); } }
        } else if (b.hasAttribute('data-gc-k-manual-pick')) {
          const text = preview[Number(b.dataset.gcKManualPick)]; if (!text) return;
          if (selected.has(text)) selected.delete(text); else if (selected.size < 100) selected.add(text); else return err(ctx, '一次最多保存 100 条。');
          setErr(ctx, ''); paintPreview();
        } else if (b.hasAttribute('data-gc-k-manual-all')) {
          const visible = preview.slice((previewPage - 1) * 20, previewPage * 20), all = visible.every((t) => selected.has(t));
          if (!all && new Set([...selected, ...visible]).size > 100) return err(ctx, '一次最多保存 100 条，请先取消部分选择。');
          visible.forEach((t) => all ? selected.delete(t) : selected.add(t)); setErr(ctx, ''); paintPreview();
        } else if (b.hasAttribute('data-gc-k-manual-clear')) { selected.clear(); paintPreview(); }
        else if (b.hasAttribute('data-gc-k-manual-page')) { previewPage = Number(b.dataset.gcKManualPage); paintPreview(); }
        else if (b.hasAttribute('data-gc-k-manual-export')) exported(preview.map((question) => ({ question })), '组合拓词预览');
      });
      render(); saveDraft();
    }
    async function importFile(file) {
      const brand = String(G.S.brand);
      if (!/\.txt$/i.test(file.name) || file.size > 262144) return UK.toast('请选择不超过 256 KB 的 UTF-8 .txt 文件', 'fail');
      try { const text = await file.text(); if (!isHere(brand)) return; if (text.includes('\u0000') || text.includes('\uFFFD')) return UK.toast('文件编码无法识别，请另存为 UTF-8 后重试', 'fail'); manualDialog(text.replace(/^\uFEFF/, '')); }
      catch (e) { UK.toast('文件读取失败，请重新选择', 'fail'); }
    }
    async function saveResults() {
      const job = activeJob(); if (!job || S.saving) return;
      const brand = String(G.S.brand), target = draft().group, picked = pickedResults(job), chosen = resultsOf(job).filter((r) => picked.has(r.question));
      if (!target || !chosen.length || chosen.length > 100) return;
      S.saving = true; paint(false);
      try { const r = await G.geo('keywordLibraryAdd', {}, { keyword_group_id: target, topics: chosen.map((q) => ({ text: q.question, source_job_id: Number(job.id) })) }); picked.clear(); if (isHere(brand) && draft().group === target) await draw(G.S.seq); UK.toast('已保存 ' + (r.ids || []).length + ' 条词题'); }
      catch (e) { if (isHere(brand)) { const box = C.body().querySelector('[data-gc-k-result-error]'); if (box) { box.textContent = e.message; box.hidden = false; } } }
      finally { S.saving = false; if (isHere(brand)) { const b = C.body().querySelector('[data-gc-k-save-results]'); if (b) b.disabled = !picked.size; } }
    }
    function click(e) {
      const b = e.target.closest('[data-gc-k-group],[data-gc-k-new],[data-gc-k-edit-group],[data-gc-k-manual],[data-gc-k-ai],[data-gc-k-more],[data-gc-k-search],[data-gc-k-clear],[data-gc-k-page],[data-gc-k-pick],[data-gc-k-pick-all],[data-gc-k-edit],[data-gc-k-result],[data-gc-k-result-all],[data-gc-k-save-results],[data-gc-k-retry],[data-gc-k-how],[data-gc-k-jobs]');
      if (!b) return false; if (b.disabled) return true;
      if (b.hasAttribute('data-gc-k-group')) chooseGroup(b.dataset.gcKGroup);
      else if (b.hasAttribute('data-gc-k-new')) editLibrary();
      else if (b.hasAttribute('data-gc-k-edit-group')) { if (group()) editLibrary(group()); }
      else if (b.hasAttribute('data-gc-k-manual')) manualDialog();
      else if (b.hasAttribute('data-gc-k-ai')) aiDialog();
      else if (b.hasAttribute('data-gc-k-how')) howTo();
      else if (b.hasAttribute('data-gc-k-jobs')) G.go('effect-jobs');
      else if (b.hasAttribute('data-gc-k-search')) { e.preventDefault(); search(); }
      else if (b.hasAttribute('data-gc-k-clear')) { const d = draft(); d.keyword = ''; d.search = ''; d.page = 1; S.picked.clear(); saveDraft(); draw(G.S.seq); }
      else if (b.hasAttribute('data-gc-k-page')) { draft().page = Math.max(1, Number(b.dataset.gcKPage)); saveDraft(); draw(G.S.seq); }
      else if (b.hasAttribute('data-gc-k-retry')) draw(G.S.seq);
      else if (b.hasAttribute('data-gc-k-more')) UK.menu(b, [{ key: 'import', icon: 'upload', label: '导入文本', disabled: !groups().length }, { key: 'export', icon: 'download', label: '导出本页 CSV', disabled: !S.data || !S.data.lists.length }], (k) => { if (k === 'import') C.body().querySelector('[data-gc-k-import-file]').click(); else exported(S.data.lists); });
      else if (b.hasAttribute('data-gc-k-edit')) { const r = S.data.lists.find((r) => Number(r.id) === Number(b.dataset.gcKEdit)); if (r) editTerm(r); }
      else if (b.hasAttribute('data-gc-k-pick')) {
        const r = S.data.lists.find((r) => Number(r.id) === Number(b.dataset.gcKPick)); if (r) { if (S.picked.has(Number(r.id))) S.picked.delete(Number(r.id)); else if (S.picked.size < 100) S.picked.set(Number(r.id), r); else UK.toast('最多选择 100 条词题带入写稿', 'info'); paintSelections(); }
      } else if (b.hasAttribute('data-gc-k-pick-all')) {
        const rows = S.data.lists, all = rows.every((r) => S.picked.has(Number(r.id)));
        if (!all && new Set([...S.picked.keys(), ...rows.map((r) => Number(r.id))]).size > 100) UK.toast('最多选择 100 条词题，请先取消部分选择', 'info');
        else { rows.forEach((r) => all ? S.picked.delete(Number(r.id)) : S.picked.set(Number(r.id), r)); paintSelections(); }
      } else if (b.hasAttribute('data-gc-k-result')) { const job = activeJob(), row = resultsOf(job)[Number(b.dataset.gcKResult)]; if (row && !S.saving) { const p = pickedResults(job); p.has(row.question) ? p.delete(row.question) : p.add(row.question); paint(false); } }
      else if (b.hasAttribute('data-gc-k-result-all')) { const job = activeJob(); if (job && !S.saving) { const p = pickedResults(job), rows = resultsOf(job); if (p.size === rows.length) p.clear(); else rows.forEach((r) => p.add(r.question)); paint(false); } }
      else if (b.hasAttribute('data-gc-k-save-results')) saveResults();
      return true;
    }
    async function intent(name, params) {
      const get = (key) => params && typeof params.get === 'function' ? params.get(key) : params && params[key];
      const id = Number(get('group'));
      if (id > 0) chooseGroup(id, false);
      if (!S.data || id > 0) await draw(G.S.seq);
      if (!S.active) return;
      if (['ai-keywords', 'keyword-ai', 'keywords-ai', 'ai'].includes(name)) aiDialog();
      else if (['manual-keywords', 'keyword-manual', 'keywords-manual', 'manual'].includes(name)) manualDialog();
    }
    function leave() { S.active = false; clearTimeout(S.timer); ++S.request; UK.batch(null); [...S.dialogs].forEach((c) => c.close()); }
    function reset(brandChanged) { leave(); if (brandChanged) { S.data = null; S.options = null; S.optionsError = ''; S.error = ''; S.initialized = false; S.brand = ''; S.picked.clear(); S.resultPicks.clear(); } }
    function destroy() { leave(); S.dead = true; }
    return { draw, click, actions: () => '', intent, reset, leave, destroy };
  };
})();


/* GEO creation studio. Real jobs, scoped drafts and explicit charged submissions. */
(function () {
  'use strict';
  window.GEO_CONTENT_PARTS = window.GEO_CONTENT_PARTS || {};
  window.GEO_CONTENT_PARTS.studio = function (C) {
    const { G, UK, H } = C;
    const esc = H.esc;
    const $ = (s, n) => (n || C.body()).querySelector(s);
    const defaults = { article_type: '客户问答', words: 1000, audience: '', tone: '专业、客观、便于核查', brand_level: '自然融入', requirements: '', instruction_id: 0, category_id: 0, keyword_group_id: 0, model_id: '' };
    let opts = {}, profile = {}, groups = [], categories = [], instructions = [], active = false, pollTimer = 0, pollBusy = false, paintEpoch = 0, boundBody = null, pending = new Map(), loadError = '';
    const dialogs = new Set();
    let lifecycle = 0;
    function scopeGuard() {
      const original = state(), brand = String(G.S.brand), version = lifecycle;
      return () => version === lifecycle && String(G.S.brand) === brand && C.draftBag.studio === original;
    }
    function openDialog(o) {
      const valid = scopeGuard(), onAction = o.onAction, onClose = o.onClose;
      let ctx;
      ctx = UK.dialog(Object.assign({}, o, {
        onAction(k, d) { if (!valid() || !d.el.isConnected) { d.close(); return false; } return onAction ? onAction(k, d) : undefined; },
        onClose(v) { dialogs.delete(ctx); if (onClose) onClose(v); }
      }));
      ctx.isCurrent = () => valid() && ctx.el.isConnected;
      dialogs.add(ctx);
      return ctx;
    }
    function state() {
      let s = C.draftBag.studio;
      if (!s || typeof s !== 'object') s = C.draftBag.studio = {};
      Object.assign(s, { mode: s.mode || 'write', subject: s.subject || '', reference: s.reference || '', pool: Array.isArray(s.pool) ? s.pool.slice(0, 100) : [], selected: Array.isArray(s.selected) ? s.selected : [], related: Array.isArray(s.related) ? s.related : [], materials: Array.isArray(s.materials) ? s.materials.slice(0, 10) : [], jobs: Array.isArray(s.jobs) ? s.jobs : [], activeId: s.activeId || '', tab: s.tab || 'body', config: Object.assign({}, defaults, s.config || {}) });
      return s;
    }
    const persist = () => C.persist();
    const effectiveRequest = (slot, body) => C.draftBag.charges?.[slot]?.attempted ? C.draftBag.charges[slot].body : body;
    const val = (name, v, attrs) => '<input class="uk-input" data-gc-s-field="' + name + '" value="' + esc(v == null ? '' : v) + '" ' + (attrs || '') + '>';
    const area = (name, v, attrs) => '<textarea class="uk-input uk-textarea gc-s-textarea" data-gc-s-field="' + name + '" ' + (attrs || '') + '>' + esc(v || '') + '</textarea>';
    const field = (label, html) => '<label class="gc-s-field"><span>' + esc(label) + '</span>' + html + '</label>';
    const cleanAttrs = attrs => Object.fromEntries(Object.entries(attrs || {}).filter(([, v]) => v !== false && v != null));
    const button = (label, action, kind, icon, attrs) => UK.btn({ label, kind: kind || 'secondary', size: 'sm', icon, attrs: cleanAttrs(Object.assign({ 'data-gc-s-action': action }, attrs || {})) });
    const ib = (label, action, icon, attrs) => UK.btn({ label, kind: 'ghost', size: 'sm', iconOnly: true, icon, attrs: Object.assign({ 'data-gc-s-action': action }, attrs || {}) });
    const select = (name, rows, chosen) => '<select class="uk-input uk-select" data-gc-s-field="' + name + '">' + rows.map(r => '<option value="' + esc(typeof r === 'string' ? r : r.id) + '"' + (String(typeof r === 'string' ? r : r.id) === String(chosen) ? ' selected' : '') + '>' + esc(typeof r === 'string' ? r : r.title || r.name) + '</option>').join('') + '</select>';
    const message = e => e && e.message ? e.message : String(e || '操作未完成，请稍后重试');
    const current = () => state().jobs.find(j => String(j.id) === String(state().activeId));
    const article = j => j && j.result && j.result.article;
    const titleOf = j => j.editTitle != null ? j.editTitle : j.saved && !j.saved.unavailable ? j.saved.title : article(j) ? article(j).title : j.subject || '未命名稿件';
    const contentOf = j => j.editContent != null ? j.editContent : j.saved && !j.saved.unavailable ? j.saved.content : article(j) ? article(j).content : '';
    const running = j => ['queued', 'running'].includes(j.status);
    const dirty = j => !j.saved || j.saved.unavailable || titleOf(j) !== j.saved.title || contentOf(j) !== j.saved.content;
    const model = () => (opts.models || []).find(m => String(m.id) === String(state().config.model_id));
    const chip = (text, action, id) => '<span class="gc-s-chip"><span>' + esc(text) + '</span>' + ib('移除' + text, action, 'close', { 'data-id': id }) + '</span>';
    function feedback(text, type) { UK.toast(text, type || 'ok'); }
    async function guarded(key, fn) {
      if (pending.has(key)) return;
      const token = {}, valid = scopeGuard(); pending.set(key, token); updateFooters();
      try { return await fn(); } catch (e) { if (!valid()) return; feedback(message(e), 'fail'); const n = $('.gc-s-inline-error'); if (n) { n.textContent = message(e); n.hidden = false; } if ((key === 'save' || key === 'press') && /内容已更新/.test(message(e))) showSaveConflict(current()); }
      finally { if (pending.get(key) === token) pending.delete(key); updateFooters(); }
    }
    function wordCount(text) { return Array.from((text || '').replace(/\s/g, '')).length; }
    function md(text) {
      return String(text || '').split(/\n\s*\n/).map(block => {
        const lines = block.split('\n');
        if (lines.every(l => /^\s*[-*]\s/.test(l))) return '<ul>' + lines.map(l => '<li>' + inline(l.replace(/^\s*[-*]\s/, '')) + '</li>').join('') + '</ul>';
        if (lines.every(l => /^\s*\d+[.)、]\s*/.test(l))) return '<ol>' + lines.map(l => '<li>' + inline(l.replace(/^\s*\d+[.)、]\s*/, '')) + '</li>').join('') + '</ol>';
        return lines.map(l => { const h = l.match(/^(#{1,4})\s+(.*)$/); return h ? '<h' + Math.min(4, h[1].length + 1) + '>' + inline(h[2]) + '</h' + Math.min(4, h[1].length + 1) + '>' : '<p>' + inline(l) + '</p>'; }).join('');
      }).join('');
    }
    function inline(t) { return esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>'); }
    function validReason() {
      const s = state();
      if (!opts.text_available) return opts.text_notice || '文本服务待开通';
      if (!model()) return '请选择可用模型';
      if (s.mode === 'batch') { const n = s.pool.filter(p => s.selected.includes(p.id)).length; if (n < 1 || n > 3) return '从主题池选择 1–3 个主题'; }
      else if (!s.subject.trim()) return s.mode === 'replicate' ? '填写改写主题' : '填写本次主题';
      if (s.mode === 'replicate' && !s.reference.trim()) return '粘贴参考原文';
      if (s.jobs.filter(running).length >= 3) return '等待当前任务完成后继续';
      return '';
    }
    function modeHTML() {
      const s = state();
      return '<div class="uk-seg gc-s-modes" role="tablist" aria-label="创作模式">' + [['write', 'GEO 写稿'], ['replicate', '爆文改写'], ['batch', '批量创作']].map(([v, t]) => '<button type="button" role="tab" aria-selected="' + (s.mode === v) + '" class="' + (s.mode === v ? 'is-active' : '') + '" data-gc-s-action="mode" data-value="' + v + '">' + t + '</button>').join('') + '</div>';
    }
    function poolHTML() {
      const s = state(), selected = s.pool.filter(t => s.selected.includes(t.id));
      const group = groups.find(r => Number(r.id) === Number(s.config.keyword_group_id));
      return '<section class="gc-s-pool"><div class="gc-s-section-head"><h3>主题池 <span class="gc-s-count">' + s.pool.length + '/100</span></h3>' + button('添加主题', 'topic-add', 'ghost', 'plus') + '</div>' +
        '<div class="gc-s-pool-source">' + esc(group ? group.title : '未指定关键词组') + (s.mode === 'batch' ? '<span>本轮 ' + selected.length + '/3</span>' : '') + '</div>' +
        (s.pool.length ? '<div class="gc-s-topic-list">' + s.pool.map(p => '<div class="gc-s-topic' + (s.selected.includes(p.id) ? ' is-selected' : '') + '"><input type="checkbox" aria-label="选择主题 ' + esc(p.text) + '" data-gc-s-topic-check="' + esc(p.id) + '"' + (s.selected.includes(p.id) ? ' checked' : '') + '><button data-gc-s-action="use-topic" data-id="' + esc(p.id) + '" title="' + esc(p.text) + '">' + esc(p.text) + '</button>' + ib('移除主题', 'remove-topic', 'close', { 'data-id': p.id }) + '</div>').join('') + '</div><div class="gc-s-pool-tools"><span>已选 ' + selected.length + '</span>' + button('合并主题', 'merge-topics', 'ghost', null, selected.length < 2 ? { disabled: true } : {}) + button('存入词库', 'save-topics', 'ghost', null, !selected.length ? { disabled: true } : {}) + ib('清空主题池', 'clear-topics', 'delete') + '</div>' : '<button class="gc-s-pool-empty" data-gc-s-action="topic-add">从关键词库选取，或导入自己的主题</button>') + '</section>';
    }
    function knowledgeHTML() {
      const keys = ['brand_name', 'industry', 'website', 'intro', 'products', 'customers', 'competitors'], n = keys.filter(k => String(profile[k] || '').trim()).length;
      return '<button class="gc-s-knowledge" data-gc-s-action="knowledge"><span class="gc-s-knowledge-mark">' + H.icon('book') + '</span><span><strong>品牌知识</strong><small>每次创作自动引用</small></span><span class="gc-s-completion"><b>' + n + '</b>/7</span>' + H.icon('chevronRight') + '</button>';
    }
    function configHTML() {
      const s = state(), c = s.config;
      return '<section class="gc-s-config"><div class="gc-s-section-head"><h3>创作设置</h3></div><div class="gc-s-form-grid">' +
        field('文章类型', select('config.article_type', ['客户问答', '选购指南', '产品解读', '对比分析', '真实案例', '新闻软文'], c.article_type)) +
        field('目标字数', select('config.words', [{ id: 600, title: '约 600 字' }, { id: 1000, title: '约 1,000 字' }, { id: 1500, title: '约 1,500 字' }], c.words)) + '</div>' +
        field('目标读者', val('config.audience', c.audience, 'maxlength="200" placeholder="如：正在比较方案的采购负责人"')) +
        field('表达语气', val('config.tone', c.tone, 'maxlength="120"')) +
        field('补充要求', area('config.requirements', c.requirements, 'rows="2" maxlength="1500" placeholder="需要强调的内容，或需要避免的说法"')) +
        '<details class="gc-s-advanced"' + (s.advanced ? ' open' : '') + '><summary>高级设置<span>品牌露出 · 归档 · 模型</span></summary><div class="gc-s-advanced-body">' +
        field('品牌露出', select('config.brand_level', ['轻度提及', '自然融入', '重点介绍'], c.brand_level)) +
        '<div class="gc-s-resource-label"><span>写作指令</span>' + button('管理', 'manage-instruction', 'ghost') + '</div>' + select('config.instruction_id', [{ id: 0, title: '不使用额外指令' }].concat(instructions.filter(r => !r.data || r.data.purpose !== 'title')), c.instruction_id) +
        '<div class="gc-s-resource-label"><span>文章分类</span>' + button('管理', 'manage-category', 'ghost') + '</div>' + select('config.category_id', [{ id: 0, title: '未分类' }].concat(categories), c.category_id) +
        field('关键词组', select('config.keyword_group_id', [{ id: 0, title: '不关联关键词组' }].concat(groups), c.keyword_group_id)) +
        field('文本模型', select('config.model_id', [{ id: '', title: '选择模型' }].concat(opts.models || []), c.model_id)) + '</div></details></section>';
    }
    function composerHTML() {
      const s = state();
      return '<aside class="uk-card gc-s-composer">' + modeHTML() + '<div class="gc-s-composer-scroll">' +
        (s.mode !== 'batch' ? field(s.mode === 'replicate' ? '改写主题' : '本次主题', area('subject', s.subject, 'rows="3" maxlength="500" placeholder="写下一个客户真正关心的问题"')) : '<div class="gc-s-batch-intro"><strong>每次创作 1–3 篇</strong><span>在主题池勾选本轮主题，每篇独立计费。</span></div>') +
        (s.related.length ? '<div class="gc-s-related"><span>合并回答 ' + s.related.length + ' 个问题</span>' + button('查看', 'related', 'ghost') + ib('取消关联问题', 'clear-related', 'close') + '</div>' : '') +
        (s.mode === 'replicate' ? field('参考原文', area('reference', s.reference, 'rows="5" maxlength="30000" placeholder="粘贴参考文章，保留有价值的结构与事实"')) : '') +
        poolHTML() + '<section class="gc-s-evidence"><div class="gc-s-section-head"><h3>事实依据</h3></div>' + knowledgeHTML() + '<div class="gc-s-material-head"><span>事实素材 <b>' + s.materials.length + '/10</b></span><div>' + button('网页检索', 'web-search', 'ghost', 'search') + button('选择', 'materials', 'secondary') + '</div></div>' +
        (s.materials.length ? '<div class="gc-s-chips">' + s.materials.map(m => chip(m.title || '素材 ' + m.id, 'remove-material', m.id)).join('') + '</div>' : '<div class="gc-s-small-muted">尚未选择素材，创作仍会引用品牌知识。</div>') + '</section>' + configHTML() + '</div><div class="gc-s-generate-foot">' + generateFooterHTML() + '</div></aside>';
    }
    function generateFooterHTML() {
      const s = state(), m = model(), reason = validReason(), count = s.mode === 'batch' ? s.pool.filter(p => s.selected.includes(p.id)).length : 1;
      return '<div class="gc-s-model-line"><span>' + esc(m ? m.name : '尚未选择模型') + '</span>' + button('更换', 'choose-model', 'ghost') + '</div>' +
        (m ? '<div class="gc-s-rate">输入 ' + UK.tp(m.input_price) + '/' + H.fmt(m.input_unit_size) + ' tokens <span>输出 ' + UK.tp(m.output_price) + '/' + H.fmt(m.output_unit_size) + ' tokens</span></div>' : '') +
        (reason ? '<div class="gc-s-missing">' + esc(reason) + '</div>' : '') +
        UK.btn({ kind: 'ai', icon: 'spark', label: pending.has('generate') ? '正在提交…' : s.mode === 'batch' ? '批量生成 ' + count + ' 篇' : s.mode === 'replicate' ? '开始改写' : '生成文章', disabled: !!reason || pending.has('generate'), attrs: { 'data-gc-s-action': 'generate' } });
    }
    function manuscriptHTML() {
      const s = state(), j = current(), a = article(j), content = j ? contentOf(j) : '';
      const versions = s.jobs.length ? '<div class="gc-s-version-tabs" role="tablist" aria-label="稿件版本">' + s.jobs.map((x, i) => '<button role="tab" aria-selected="' + (String(x.id) === String(s.activeId)) + '" class="' + (String(x.id) === String(s.activeId) ? 'is-active' : '') + '" data-gc-s-action="version" data-id="' + esc(x.id) + '"><span class="gc-s-job-dot is-' + esc(x.status) + '"></span><span>' + esc(x.session_id && s.jobs.filter(v => String(v.session_id) === String(x.session_id)).length > 1 ? 'V' + (s.jobs.filter(v => String(v.session_id) === String(x.session_id)).findIndex(v => String(v.id) === String(x.id)) + 1) + ' · ' + (x.subject || titleOf(x)) : titleOf(x) || '稿件 ' + (i + 1)) + '</span></button>').join('') + '</div>' : '';
      let inner = '';
      if (!j) inner = '<div class="gc-s-paper-empty"><div class="gc-s-paper-guide" aria-hidden="true"><i></i><i></i><i></i></div><h2>还没有稿件</h2><p>' + (opts.text_available ? '填写左侧主题后生成。' : '先准备主题与事实素材。') + '</p>' + button('从关键词库选题', 'topic-library', 'secondary', 'plus') + '</div>';
      else if (running(j)) inner = '<div class="gc-s-paper-pending"><div class="gc-s-pending-title">' + H.stat(H.JOB, j.status) + '<span>通常需要 1–3 分钟</span></div><h2>' + esc(j.subject || '文章创作中') + '</h2><div class="gc-s-skeleton">' + [84, 100, 95, 71, 100, 88, 96, 64].map(w => UK.skel(w + '%', 14, 4)).join('') + '</div><p>可以离开此页，返回后会恢复任务进度。</p></div>';
      else if (!a && j.source !== 'library') inner = '<div class="gc-s-paper-empty">' + H.stat(H.JOB, j.status) + '<h2>' + (j.status === 'review' ? '结果或费用需要核对' : '本次创作未完成') + '</h2><p>' + esc(j.error || '暂时没有可展示的文章结果。') + '</p>' + button('查看任务与消费', 'tasks', 'secondary', 'arrowRight') + '</div>';
      else {
        const checks = a && a.checks || [], outline = a && a.outline || [];
        let body = '';
        if (s.tab === 'outline') body = outline.length ? '<ol class="gc-s-outline">' + outline.map((t, i) => '<li><span>' + String(i + 1).padStart(2, '0') + '</span><div>' + esc(t) + '</div></li>').join('') + '</ol>' : '<div class="gc-s-sub-empty">此稿件没有单独的提纲。</div>';
        else if (s.tab === 'checks') body = '<div class="gc-s-check-heading">' + (checks.length ? '发布前逐项核实' : '当前版本没有列出待核查事项') + '</div>' + (checks.length ? '<ul class="gc-s-checks">' + checks.map((t, i) => '<li><input type="checkbox" data-gc-s-check="' + i + '" aria-label="已核实：' + esc(t) + '"' + ((j.checked || []).includes(i) ? ' checked' : '') + '><div><strong>核查 ' + String(i + 1).padStart(2, '0') + '</strong><p>' + esc(t) + '</p></div></li>').join('') + '</ul>' : '<p class="gc-s-small-muted">AI 生成的正文仍需人工审阅。</p>') + sourcesHTML(j);
        else body = j.editing ? '<label class="gc-s-title-edit-label">文章标题' + val('editTitle', titleOf(j), 'maxlength="255" aria-label="文章标题"') + '</label>' + area('editContent', content, 'maxlength="30000" rows="24" aria-label="文章正文"') : '<h2 class="gc-s-article-title">' + esc(titleOf(j)) + '</h2><div class="gc-s-prose">' + md(content) + '</div>';
        inner = '<div class="gc-s-paper-tools"><div class="gc-s-result-tabs" role="tablist">' + [['body', '正文'], ['outline', '提纲'], ['checks', '事实核查' + (checks.length ? ' ' + checks.length : '')]].map(([v, t]) => '<button role="tab" aria-selected="' + (s.tab === v) + '" class="' + (s.tab === v ? 'is-active' : '') + '" data-gc-s-action="tab" data-value="' + v + '">' + t + '</button>').join('') + '</div><div>' + ib('复制全文', 'copy', 'copy') + button(j.editing ? '完成编辑' : '编辑', 'edit', 'ghost', j.editing ? 'check' : 'edit') + '</div></div><article class="gc-s-paper"><div class="gc-s-paper-meta"><span>' + esc(j.sources && j.sources.brand_name || G.brandName()) + '</span><span>' + esc(j.article_type || '创作稿件') + '</span><span data-gc-s-wordcount>' + wordCount(content) + ' 字</span><span class="gc-s-saved-state">' + (dirty(j) ? j.saved ? '有未保存修改' : '尚未入库' : '已入文章库') + '</span></div>' + body + '</article>';
      }
      return versions + '<div class="uk-card gc-s-manuscript">' + (j ? '<div class="gc-s-result-head">' + H.stat(H.JOB, j.status) + '<span>' + (j.saved ? '文章 #' + j.saved.id : j.id && j.source !== 'library' ? '任务 #' + j.id : '') + '</span>' + (j.user_points != null ? '<span class="gc-s-spent">本次 ' + UK.tp(j.user_points) + '</span>' : '') + '</div>' : '') + inner + '<div class="gc-s-inline-error" role="alert" hidden></div>' + (j && (a || j.source === 'library') ? '<div class="gc-s-article-foot">' + articleFooterHTML() + '</div>' : '') + '</div>';
    }
    function sourcesHTML(j) {
      const src = j.sources;
      if (!src) return '';
      return '<div class="gc-s-sources"><h3>本轮引用依据</h3><div>' + esc(src.brand_name || '品牌知识') + ' · 知识版本 ' + esc(src.profile_revision || '—') + '</div>' + (src.materials || []).map(m => '<div>' + esc(m.title) + (m.source_url && /^https?:\/\//i.test(m.source_url) ? ' <a href="' + esc(m.source_url) + '" target="_blank" rel="noopener noreferrer">查看来源 ↗</a>' : '') + '</div>').join('') + '</div>';
    }
    function articleFooterHTML() {
      const j = current(); if (!j) return '';
      const hasBusy = pending.has('save') || pending.has('press'), unusable = j.saved && j.saved.unavailable;
      return '<div>' + button('AI 修改', 'rewrite', 'secondary', 'spark', !opts.text_available || pending.has('rewrite') ? { disabled: true } : {}) + button('导出 .md', 'export', 'ghost', 'download') + '</div><div>' + button(pending.has('save') ? '保存中…' : '保存文章', 'save', 'secondary', null, hasBusy || unusable ? { disabled: true } : {}) + button(pending.has('press') ? '正在准备…' : '送往媒体发布', 'press', 'primary', 'arrowRight', hasBusy || unusable ? { disabled: true } : {}) + '</div>';
    }
    function paint() {
      if (!active || !C.body()) return;
      const n = C.body(), scroll = $('.gc-s-composer-scroll')?.scrollTop || 0;
      n.innerHTML = (loadError ? '<div class="uk-notice gc-s-load-error">' + esc(loadError) + button('重试', 'retry-load', 'secondary') + '</div>' : '') + '<div class="gc-s-studio">' + composerHTML() + '<main class="gc-s-output">' + manuscriptHTML() + '</main></div>';
      bind(n); sizeWorkspace(); const scroller = $('.gc-s-composer-scroll'); if (scroller) scroller.scrollTop = scroll;
    }
    function paintRight() { const n = $('.gc-s-output'); if (n) n.innerHTML = manuscriptHTML(); updateFooters(); }
    function updateFooters() { if (!active || !C.body()) return; const a = $('.gc-s-generate-foot'), b = $('.gc-s-article-foot'); if (a) a.innerHTML = generateFooterHTML(); if (b) b.innerHTML = articleFooterHTML(); }
    function bind(n) {
      if (boundBody === n) return;
      unbind(); boundBody = n; n.addEventListener('input', inputEvent); n.addEventListener('change', changeEvent); n.addEventListener('toggle', toggleEvent, true); window.addEventListener('resize', sizeWorkspace);
    }
    function unbind() { window.removeEventListener('resize', sizeWorkspace); if (!boundBody) return; boundBody.removeEventListener('input', inputEvent); boundBody.removeEventListener('change', changeEvent); boundBody.removeEventListener('toggle', toggleEvent, true); boundBody = null; }
    function sizeWorkspace() { if (!active || !C.body()) return; const n = $('.gc-s-studio'); if (n) n.style.setProperty('--gc-s-height', Math.max(440, window.innerHeight - Math.max(16, n.getBoundingClientRect().top) - 24) + 'px'); }
    function inputEvent(e) {
      const n = e.target, name = n.dataset.gcSField; if (!name) return;
      const s = state();
      if (name.startsWith('config.')) { const k = name.slice(7); s.config[k] = ['words', 'instruction_id', 'category_id', 'keyword_group_id'].includes(k) ? Number(n.value) : n.value; }
      else if (name === 'editTitle' || name === 'editContent') { const j = current(); if (j) { j[name] = n.value; const w = $('[data-gc-s-wordcount]'), mark = $('.gc-s-saved-state'); if (w) w.textContent = wordCount(contentOf(j)) + ' 字'; if (mark) mark.textContent = dirty(j) ? '有未保存修改' : '已入文章库'; } }
      else s[name] = n.value;
      persist(); updateFooters();
    }
    function changeEvent(e) {
      const n = e.target, s = state();
      if (n.matches('select[data-gc-s-field]')) { inputEvent(e); if (n.dataset.gcSField === 'config.keyword_group_id') { const el = $('.gc-s-pool'); if (el) el.outerHTML = poolHTML(); } }
      if (n.dataset.gcSTopicCheck != null) {
        const id = n.dataset.gcSTopicCheck;
        if (n.checked && s.mode === 'batch' && s.selected.length >= 3) { n.checked = false; return feedback('每轮最多选择 3 个主题', 'fail'); }
        s.selected = n.checked ? Array.from(new Set(s.selected.concat(id))) : s.selected.filter(x => x !== id); persist(); const el = $('.gc-s-pool'); if (el) el.outerHTML = poolHTML(); updateFooters();
      }
      if (n.dataset.gcSCheck != null) { const j = current(), i = Number(n.dataset.gcSCheck); if (j) { j.checked = n.checked ? Array.from(new Set((j.checked || []).concat(i))) : (j.checked || []).filter(x => x !== i); persist(); } }
    }
    function toggleEvent(e) { if (e.target.matches('.gc-s-advanced')) { state().advanced = e.target.open; persist(); } }
    async function draw(seq) {
      active = true; const epoch = ++paintEpoch; loadError = ''; const n = C.body(); if (n) n.innerHTML = '<div class="gc-s-loading">' + UK.skel('100%', 480, 16) + '</div>';
      const values = await Promise.allSettled([C.options(), G.loadProfile(), C.resources('keyword'), C.resources('category'), C.resources('instruction')]);
      if (!active || epoch !== paintEpoch || (G.live && !G.live(seq))) return;
      const target = [v => { opts = v || {}; }, v => { profile = v || G.S.profile || {}; }, v => { groups = v || []; }, v => { categories = v || []; }, v => { instructions = v || []; }];
      values.forEach((r, i) => { if (r.status === 'fulfilled') target[i](r.value); else loadError = message(r.reason); });
      const s = state();
      if (!(opts.models || []).some(m => String(m.id) === String(s.config.model_id))) s.config.model_id = String(opts.default_model_id || (opts.models || [])[0]?.id || '');
      if (!s.materialsInitialized) {
        try { const r = await G.geo('workspaceRecords', { kind: 'materials', page: 1 }); if (epoch !== paintEpoch || !active) return; s.materials = (r.lists || []).slice(0, 5).map(materialSummary); s.materialsInitialized = true; } catch (e) { loadError = message(e); }
      }
      persist(); paint(); schedulePoll(100);
    }
    function materialSummary(m) { return { id: Number(m.id), title: m.title, source_url: m.source_url || '', revision: m.revision }; }
    function insertJob(s, row, meta) {
      const found = s.jobs.find(j => String(j.id) === String(row.id));
      if (found) Object.assign(found, row, meta || {});
      else s.jobs.push(Object.assign({ status: 'queued', subject: s.subject, article_type: s.config.article_type }, row, meta || {}));
      s.activeId = String(row.id); s.tab = 'body';
    }
    async function generate() {
      const valid = scopeGuard(), loaded = await C.options(); if (!valid()) return; opts = loaded;
      const reason = validReason(); if (reason) return feedback(reason, 'fail');
      const s = state(), m = model(), subjects = s.mode === 'batch' ? s.pool.filter(p => s.selected.includes(p.id)).map(p => p.text) : [s.subject.trim()];
      const payload = Object.assign({}, s.config, { mode: s.mode, subjects, reference: s.mode === 'replicate' ? s.reference.trim() : '', related_questions: s.related.slice(0, 10), material_ids: s.materials.map(m => m.id), model_id: String(m.id), quote_token: m.quote_token, accept_charge: true });
      const effective = effectiveRequest('studio:generate', payload);
      await C.charge({ slot: 'studio:generate', title: s.mode === 'batch' ? '确认生成 ' + subjects.length + ' 篇文章' : s.mode === 'replicate' ? '确认改写文章' : '确认生成文章', action: 'studioGenerate', body: payload, onSuccess: async data => {
        if (state() !== s) return;
        for (const row of data.jobs || []) insertJob(s, row, { session_id: row.session_id || row.id, subject: row.subject || (effective.subjects || subjects)[(data.jobs || []).indexOf(row)], article_type: effective.article_type });
        persist(); paintRight(); schedulePoll(100); feedback('已加入创作队列');
      } });
    }
    function schedulePoll(delay) { clearTimeout(pollTimer); if (active && state().jobs.some(running)) pollTimer = setTimeout(poll, delay || 3000); }
    async function poll() {
      if (!active || pollBusy) return;
      const s = state(), epoch = paintEpoch, jobs = s.jobs.filter(running); if (!jobs.length) return;
      pollBusy = true; let changed = false;
      try {
        const results = await Promise.allSettled(jobs.map(j => G.geo('jobs', { id: j.id })));
        if (!active || state() !== s || epoch !== paintEpoch) return;
        for (let i = 0; i < results.length; i++) {
          const r = results[i]; if (r.status !== 'fulfilled') continue;
          const row = (r.value.lists || [])[0]; if (!row) continue;
          const j = jobs[i], before = JSON.stringify([j.status, j.result, j.error]); Object.assign(j, row);
          if (before !== JSON.stringify([j.status, j.result, j.error])) changed = true;
          if (row.status === 'success' && j.session_id) {
            try { const view = await G.geo('articleAgentView', { id: j.session_id }); if (state() !== s || epoch !== paintEpoch) return; mergeSession(s, view, false); } catch (_) { /* The completed job stays usable; history can retry its metadata. */ }
          }
        }
        persist(); if (changed) { const j = current(); if (!j || !j.editing) paintRight(); else updateFooters(); }
      } finally { pollBusy = false; schedulePoll(); }
    }
    function mergeSession(s, view, activate) {
      for (const turn of view.turns || []) {
        const old = s.jobs.find(j => String(j.id) === String(turn.id)), meta = { session_id: view.id, latest_id: view.latest_id, subject: view.title };
        if (old) {
          const keepLocal = old.editing || (old.editTitle != null || old.editContent != null) && dirty(old), baseline = old.saved;
          Object.assign(old, turn, meta);
          if (keepLocal) old.saved = baseline;
          else { delete old.editTitle; delete old.editContent; }
        } else s.jobs.push(Object.assign({}, turn, meta));
      }
      if (activate) { s.activeId = String(view.latest_id); s.tab = 'body'; }
    }
    async function rewrite() {
      const valid = scopeGuard(), j = current(); if (!j || !contentOf(j)) return;
      try { const loaded = await C.options(); if (!valid()) return; opts = loaded; } catch (e) { if (valid()) feedback(message(e), 'fail'); return; }
      if (!model()) return feedback('请选择文本模型', 'fail');
      if (contentOf(j).length > 30000) return feedback('AI 修改支持最多 30000 字的原文，请先精简当前稿件', 'fail');
      const s = state(), ctx = openDialog({ title: 'AI 修改文章', width: 600, body: '<div class="gc-s-dialog"><div class="gc-s-rewrite-source"><span>当前稿件</span><strong>' + esc(titleOf(j)) + '</strong></div>' + field('本次修改要求', '<textarea class="uk-input uk-textarea gc-s-textarea" data-gc-s-instruction rows="6" maxlength="' + (j.session_id ? 2000 : 1500) + '" autofocus placeholder="例如：压缩开头，保留产品事实，增加适用场景与选购建议"></textarea>') + '<p class="gc-s-small-muted">基于当前稿件生成新版本，原稿会保留。</p></div>', actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'next', label: '确认费用', kind: 'ai', icon: 'spark' }], onAction: async (key, dialog) => {
        if (key !== 'next') return;
        const instruction = $('[data-gc-s-instruction]', dialog.body).value.trim(); if (!instruction) { H.setErr(dialog, '请填写本次修改要求'); return false; }
        if (state() !== s) { dialog.close(); return false; }
        const m = model(); if (!m) { H.setErr(dialog, '当前模型已不可用，请重新选择'); return false; }
        dialog.busy('next', true);
        try {
          let action, body;
          if (j.session_id) {
            const view = await G.geo('articleAgentView', { id: j.session_id });
            if (!valid() || !dialog.isCurrent()) return false;
            mergeSession(s, view, false); persist();
            const last = (view.turns || []).find(t => Number(t.id) === Number(view.latest_id));
            if (last && ['queued', 'running', 'review'].includes(last.status)) { H.setErr(dialog, '上一轮尚未完成或费用待核对，请先查看任务记录'); return false; }
            action = 'articleAgentSend'; body = { session_id: Number(j.session_id), expected_turn_id: Number(view.latest_id), instruction, draft: { title: titleOf(j).trim(), content: contentOf(j).trim() }, material_ids: s.materials.map(m => m.id), model_id: String(m.id), quote_token: m.quote_token, accept_charge: true };
          } else {
            action = 'studioGenerate'; body = Object.assign({}, s.config, { mode: 'replicate', subjects: [titleOf(j).trim().slice(0, 500)], reference: contentOf(j).trim(), related_questions: [], requirements: instruction, material_ids: s.materials.map(m => m.id), model_id: String(m.id), quote_token: m.quote_token, accept_charge: true });
          }
          const effective = effectiveRequest('studio:rewrite', body), origin = s.jobs.find(x => Number(x.session_id) === Number(effective.session_id));
          const subject = effective.subjects?.[0] || effective.draft?.title || (origin && origin.subject) || titleOf(j);
          dialog.close(); await guarded('rewrite', () => C.charge({ slot: 'studio:rewrite', title: '确认生成修改版本', action, body, onSuccess: async data => { if (state() !== s) return; const rows = data.jobs || [data]; rows.forEach(r => insertJob(s, r, { session_id: r.session_id || r.id, subject: r.subject || subject, article_type: effective.article_type || origin?.article_type || j.article_type || '创作稿件', instruction: effective.instruction || effective.requirements || instruction })); persist(); paintRight(); schedulePoll(100); feedback('新版本已加入创作队列'); } }));
        } catch (e) { if (dialog.isCurrent()) H.setErr(dialog, message(e)); }
        finally { if (dialog.isCurrent()) dialog.busy('next', false); }
        return false;
      } });
      return ctx;
    }
    async function saveCurrent() {
      const j = current(), valid = scopeGuard(); if (!j) throw new Error('请先选择文章');
      const submitted = { title: titleOf(j), content: contentOf(j) };
      const title = submitted.title.trim(), content = submitted.content.trim(); if (!title || !content) throw new Error('标题与正文不能为空');
      if (j.saved && j.saved.unavailable) throw new Error('已入库文章不可用，请在文章库处理');
      let saved;
      if (j.source === 'library') {
        await G.geo('contentSave', {}, { kind: 'articles', id: j.saved.id, title, content, expected_update: j.saved.expected_update, expected_hash: j.saved.expected_hash, keyword_group_id: Number(j.keyword_group_id || 0), category_id: Number(j.category_id || 0) });
        if (!valid()) return null;
        const r = await G.geo('workspaceRecords', { kind: 'articles', id: j.saved.id }); const row = (r.lists || [])[0]; if (!row) throw new Error('已提交保存，但暂时无法读取最新文章，请稍后从文章库确认');
        saved = savedFromRow(row);
      } else saved = await G.geo('articleAgentSave', {}, { job_id: Number(j.id), title, content, expected_update: j.saved ? j.saved.expected_update : -1, expected_hash: j.saved ? j.saved.expected_hash : '' });
      if (!valid()) return null;
      const laterEdits = titleOf(j) !== submitted.title || contentOf(j) !== submitted.content;
      j.saved = saved;
      if (laterEdits || saved.title !== title || saved.content !== content) {
        if (!laterEdits) { j.editTitle = submitted.title; j.editContent = submitted.content; }
        j.editing = true; persist(); paintRight(); feedback('提交的版本已保存，后续修改仍保留，请保存后继续', 'info'); return null;
      }
      j.editTitle = saved.title; j.editContent = saved.content; j.editing = false; persist(); paintRight(); return saved;
    }
    async function press() {
      const j = current(), valid = scopeGuard(), saved = await saveCurrent(); if (!saved || !valid() || current() !== j) return;
      const r = await G.geo('toPress', {}, { id: Number(saved.id) }); if (!valid()) return;
      if (!r.draft_id) throw new Error('发布草稿未返回，请稍后重试');
      C.go('website?draftId=' + encodeURIComponent(r.draft_id));
    }
    async function showSaveConflict(j) {
      if (!j || !j.saved?.id) return; const valid = scopeGuard(), local = { title: titleOf(j), content: contentOf(j) };
      try {
        const r = await G.geo('workspaceRecords', { kind: 'articles', id: j.saved.id }), row = (r.lists || [])[0]; if (!row || !valid()) return;
        openDialog({ title: '文章库已有新修改', width: 760, body: '<div class="gc-s-dialog"><div class="gc-s-conflict"><section><h3>本地草稿</h3><strong>' + esc(local.title) + '</strong><p>' + esc(local.content.slice(0, 360)) + '</p></section><section><h3>文章库最新稿</h3><strong>' + esc(row.title) + '</strong><p>' + esc(String(row.content).slice(0, 360)) + '</p></section></div><p class="gc-s-small-muted">选择本地稿后，仍需再次保存才会更新文章库。</p></div>', actions: [{ key: 'cancel', label: '稍后处理', kind: 'ghost' }, { key: 'remote', label: '采用最新稿', kind: 'secondary' }, { key: 'local', label: '继续编辑本地稿', kind: 'primary' }], onAction: (key) => { if (key === 'cancel' || !valid()) return; j.saved = savedFromRow(row); j.editTitle = key === 'local' ? local.title : row.title; j.editContent = key === 'local' ? local.content : row.content; j.editing = key === 'local'; persist(); paintRight(); } });
      } catch (e) { if (valid()) feedback('无法读取最新稿件：' + message(e), 'fail'); }
    }
    function topicText(t) { return String(typeof t === 'string' ? t : t.text || t.question || t.title || '').trim().slice(0, 500); }
    async function addTopics(topics, group) {
      const s = state(), existing = new Set(s.pool.map(p => p.text)); let added = 0, skipped = 0;
      for (const t of topics || []) { const text = topicText(t); if (!text || existing.has(text)) continue; if (s.pool.length >= 100) { skipped++; continue; } const p = { id: H.key('topic'), text }; if (t && typeof t === 'object' && t.source_job_id) p.source_job_id = Number(t.source_job_id); s.pool.push(p); existing.add(text); added++; }
      if (group != null && Number(group.id == null ? group : group.id) >= 0) s.config.keyword_group_id = Number(group.id == null ? group : group.id);
      persist(); if (active) paint(); if (added) feedback('已加入 ' + added + ' 个主题' + (skipped ? '，主题池已满' : '')); else if (skipped) feedback('主题池最多保留 100 个主题', 'fail');
      return added;
    }
    function topicAddMenu(anchor) {
      const valid = scopeGuard();
      UK.menu(anchor, [{ key: 'library', label: '从关键词库选取', icon: 'search' }, { key: 'manual', label: '手动添加', icon: 'edit' }, { key: 'import', label: '导入 .txt', icon: 'upload' }], k => { if (!valid()) return; if (k === 'library') topicLibrary(); else if (k === 'manual') manualTopics(); else importTopics(); });
    }
    function manualTopics() {
      openDialog({ title: '添加主题', width: 600, body: '<div class="gc-s-dialog">' + field('每行一个主题', '<textarea class="uk-input uk-textarea gc-s-textarea" data-gc-s-manual rows="10" autofocus placeholder="例如：如何选择适合连锁门店的会员系统？"></textarea>') + '<div class="gc-s-small-muted">最多 100 个主题，每条不超过 500 字，重复项会自动跳过。</div></div>', actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'add', label: '加入主题池', kind: 'primary' }], onAction: async (k, ctx) => { if (k !== 'add') return; const rows = $('[data-gc-s-manual]', ctx.body).value.split(/\r?\n/).map(s => s.trim()).filter(Boolean); if (!rows.length) { H.setErr(ctx, '请输入主题'); return false; } if (rows.some(s => s.length > 500)) { H.setErr(ctx, '每个主题不能超过 500 字，请缩短后重试'); return false; } await addTopics(rows); } });
    }
    function importTopics() {
      const valid = scopeGuard(), file = document.createElement('input'); file.type = 'file'; file.accept = '.txt,text/plain';
      file.addEventListener('change', async () => {
        if (!valid()) return;
        const f = file.files && file.files[0]; if (!f) return;
        if (!/\.txt$/i.test(f.name) || f.size > 256 * 1024) return feedback('请选择不超过 256 KB 的 .txt 文件', 'fail');
        try {
          const text = await f.text(); if (!valid()) return;
          const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          if (rows.some(s => s.length > 500)) return feedback('文件中有超过 500 字的主题，请调整后再导入', 'fail');
          if (!rows.length) return feedback('文件中没有可导入的主题', 'fail');
          await addTopics(rows);
        } catch (e) { if (valid()) feedback(message(e), 'fail'); }
      }); file.click();
    }
    function mergeTopics() {
      const s = state(), rows = s.pool.filter(p => s.selected.includes(p.id)); if (rows.length < 2) return;
      if (rows.length > 10) return feedback('一次最多合并 10 个相关问题', 'fail');
      openDialog({ title: '合并为一个创作主题', width: 620, body: '<div class="gc-s-dialog">' + field('合并后的主题', '<textarea class="uk-input uk-textarea gc-s-textarea" data-gc-s-merge rows="3" maxlength="500" autofocus>' + esc(rows[0].text) + '</textarea>') + '<div class="gc-s-small-muted">保留原主题，将这 ' + rows.length + ' 个问题作为同一篇文章的回答范围。</div><ol class="gc-s-dialog-topics">' + rows.map(r => '<li>' + esc(r.text) + '</li>').join('') + '</ol></div>', actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'apply', label: '使用合并主题', kind: 'primary' }], onAction: (k, ctx) => { if (k !== 'apply') return; const t = $('[data-gc-s-merge]', ctx.body).value.trim(); if (!t) { H.setErr(ctx, '请填写合并后的主题'); return false; } s.subject = t; s.related = rows.map(r => r.text); if (s.mode === 'batch') s.mode = 'write'; persist(); paint(); } });
    }
    async function saveTopics() {
      const s = state(), rows = s.pool.filter(p => s.selected.includes(p.id)); if (!rows.length) return;
      const ctx = openDialog({ title: '存入关键词库', width: 480, body: '<div class="gc-s-dialog">' + field('关键词组', '<select class="uk-input uk-select" data-gc-s-save-group><option value="0">未分组</option>' + groups.map(g => '<option value="' + g.id + '"' + (Number(g.id) === Number(s.config.keyword_group_id) ? ' selected' : '') + '>' + esc(g.title) + '</option>').join('') + '</select>') + '<p class="gc-s-small-muted">本次保存 ' + rows.length + ' 个主题。</p></div>', actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'save', label: '保存主题', kind: 'primary' }], onAction: async (k, d) => { if (k !== 'save') return; d.busy('save', true); try { const group = Number($('[data-gc-s-save-group]', d.body).value), topics = rows.map(p => Object.assign({ text: p.text }, p.source_job_id ? { source_job_id: p.source_job_id } : {})); await G.geo(group ? 'keywordLibraryAdd' : 'studioSaveTopics', {}, { topics, keyword_group_id: group }); if (d.isCurrent()) feedback('主题已存入关键词库'); } catch (e) { if (d.isCurrent()) H.setErr(d, message(e)); return false; } finally { if (d.isCurrent()) d.busy('save', false); } } }); return ctx;
    }
    async function topicLibrary() {
      const s = state(), chosen = new Map(); let group = Number(s.config.keyword_group_id || 0), keyword = '', page = 1, serial = 0;
      const ctx = openDialog({ title: '从关键词库选取主题', width: 760, body: '<div class="gc-s-dialog">' + UK.skel('100%', 260, 8) + '</div>', actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'add', label: '加入主题池', kind: 'primary' }], onAction: async (k, d) => { if (k !== 'add') return; if (!chosen.size) { H.setErr(d, '请选择至少一个主题'); return false; } await addTopics(Array.from(chosen.values()), group); } });
      async function load() {
        if (!ctx.isCurrent()) return; const id = ++serial; ctx.body.setAttribute('aria-busy', 'true');
        try { const r = await G.geo('keywordLibrary', { group_id: group, keyword, page, page_size: 20 }); if (id !== serial || !ctx.isCurrent()) return;
          const rows = r.lists || [], choices = r.groups || groups;
          ctx.body.innerHTML = '<div class="gc-s-dialog"><div class="gc-s-picker-bar"><select class="uk-input uk-select" data-gc-s-picker-group><option value="0">未分组</option>' + choices.map(g => '<option value="' + g.id + '"' + (Number(g.id) === group ? ' selected' : '') + '>' + esc(g.title) + '</option>').join('') + '<input class="uk-input" data-gc-s-picker-search value="' + esc(keyword) + '" placeholder="搜索关键词">' + button('搜索', 'picker-search', 'secondary', 'search') + '</div><div class="gc-s-picker-count">已选 ' + chosen.size + ' 个 · 共 ' + Number(r.count || 0) + ' 个关键词</div><div class="gc-s-picker-list">' + (rows.length ? rows.map(row => '<label class="gc-s-picker-row"><input type="checkbox" data-gc-s-picker-id="' + row.id + '"' + (chosen.has(String(row.id)) ? ' checked' : '') + '><span><strong>' + esc(row.question) + '</strong><small>' + esc(row.intent || '未标注意图') + '</small></span></label>').join('') : '<div class="gc-s-sub-empty">没有匹配的关键词</div>') + '</div>' + pagerHTML(page, Number(r.count || 0), 20) + '</div>';
          ctx.body.onchange = e => { const n = e.target; if (n.dataset.gcSPickerId) { const row = rows.find(r => String(r.id) === n.dataset.gcSPickerId); if (n.checked) chosen.set(String(row.id), { text: row.question }); else chosen.delete(String(row.id)); const count = $('.gc-s-picker-count', ctx.body); count.textContent = '已选 ' + chosen.size + ' 个 · 共 ' + Number(r.count || 0) + ' 个关键词'; } if (n.matches('[data-gc-s-picker-group]')) { group = Number(n.value); page = 1; load(); } };
          ctx.body.onclick = e => { const n = e.target.closest('[data-gc-s-action]'); if (!n) return; if (n.dataset.gcSAction === 'picker-search') { keyword = $('[data-gc-s-picker-search]', ctx.body).value.trim(); page = 1; load(); } if (n.dataset.gcSAction === 'picker-page') { page = Number(n.dataset.page); load(); } };
          ctx.body.onkeydown = e => { if (e.key === 'Enter' && e.target.matches('[data-gc-s-picker-search]')) { e.preventDefault(); keyword = e.target.value.trim(); page = 1; load(); } };
        } catch (e) { if (ctx.isCurrent()) H.setErr(ctx, message(e)); } finally { ctx.body.removeAttribute('aria-busy'); }
      }
      await load();
    }
    function pagerHTML(page, count, size) { const total = Math.max(1, Math.ceil(count / size)); return '<div class="gc-s-picker-pager"><span>第 ' + page + ' / ' + total + ' 页</span>' + button('上一页', 'picker-page', 'ghost', null, { 'data-page': page - 1, disabled: page <= 1 }) + button('下一页', 'picker-page', 'ghost', null, { 'data-page': page + 1, disabled: page >= total }) + '</div>'; }
    async function addMaterials(rows) {
      const s = state(), map = new Map(s.materials.map(m => [String(m.id), m])); let overflow = false;
      for (const row of rows || []) { if (!row || !row.id || map.has(String(row.id))) continue; if (map.size >= 10) { overflow = true; continue; } map.set(String(row.id), materialSummary(row)); }
      s.materials = Array.from(map.values()); s.materialsInitialized = true; persist(); if (active) paint(); if (overflow) feedback('每轮最多引用 10 条事实素材', 'fail');
    }
    async function materialPicker() {
      const s = state(), chosen = new Map(s.materials.map(m => [String(m.id), m])); let keyword = '', page = 1, serial = 0;
      const ctx = openDialog({ title: '选择事实素材', width: 760, body: UK.skel('100%', 280, 8), actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'apply', label: '使用所选素材', kind: 'primary' }], onAction: (k, d) => { if (k !== 'apply') return; if (chosen.size > 10) { H.setErr(d, '最多选择 10 条素材'); return false; } if (state() !== s) return; s.materials = Array.from(chosen.values()); s.materialsInitialized = true; persist(); paint(); } });
      async function load() {
        if (!ctx.isCurrent()) return; const token = ++serial;
        try { const r = await G.geo('workspaceRecords', { kind: 'materials', keyword, page }); if (token !== serial || !ctx.isCurrent()) return; const rows = r.lists || [];
          ctx.body.innerHTML = '<div class="gc-s-dialog"><div class="gc-s-picker-bar"><input class="uk-input" data-gc-s-material-search placeholder="搜索标题或内容" value="' + esc(keyword) + '">' + button('搜索', 'picker-search', 'secondary', 'search') + '</div><div class="gc-s-picker-count">本轮引用 ' + chosen.size + '/10 条</div><div class="gc-s-picker-list">' + (rows.length ? rows.map(r => '<label class="gc-s-picker-row"><input type="checkbox" data-gc-s-material-id="' + r.id + '"' + (chosen.has(String(r.id)) ? ' checked' : '') + '><span><strong>' + esc(r.title) + '</strong><p>' + esc(String(r.content || '').slice(0, 160)) + '</p><small>' + esc(r.source_url || '手动录入') + '</small></span></label>').join('') : '<div class="gc-s-sub-empty">没有匹配的事实素材</div>') + '</div>' + pagerHTML(page, Number(r.count || 0), Number(r.page_size || 20)) + '</div>';
          ctx.body.onchange = e => { const id = e.target.dataset.gcSMaterialId; if (!id) return; if (e.target.checked) { if (chosen.size >= 10) { e.target.checked = false; return feedback('最多选择 10 条素材', 'fail'); } chosen.set(id, materialSummary(rows.find(r => String(r.id) === id))); } else chosen.delete(id); $('.gc-s-picker-count', ctx.body).textContent = '本轮引用 ' + chosen.size + '/10 条'; };
          ctx.body.onclick = e => { const n = e.target.closest('[data-gc-s-action]'); if (!n) return; if (n.dataset.gcSAction === 'picker-page') { page = Number(n.dataset.page); load(); } if (n.dataset.gcSAction === 'picker-search') { keyword = $('[data-gc-s-material-search]', ctx.body).value.trim(); page = 1; load(); } };
          ctx.body.onkeydown = e => { if (e.key === 'Enter' && e.target.matches('[data-gc-s-material-search]')) { e.preventDefault(); keyword = e.target.value.trim(); page = 1; load(); } };
        } catch (e) { if (ctx.isCurrent()) H.setErr(ctx, message(e)); }
      }
      await load();
    }
    async function history() {
      const s = state(); let page = 1, serial = 0;
      const ctx = openDialog({ title: '创作记录', drawer: true, width: 620, body: UK.skel('100%', 300, 8) });
      async function load() {
        if (!ctx.isCurrent()) return; const token = ++serial;
        try { const r = await G.geo('articleAgentSessions', { page }); if (token !== serial || !ctx.isCurrent()) return;
          ctx.body.innerHTML = '<div class="gc-s-dialog"><div class="gc-s-history-list">' + ((r.lists || []).length ? r.lists.map(row => '<button class="gc-s-history-item" data-gc-s-session="' + row.id + '"><div><strong>' + esc(row.title) + '</strong><span>' + Number(row.turns) + ' 个版本 · ' + esc(H.when(row.update_time)) + '</span></div>' + H.stat(H.JOB, row.status) + H.icon('chevronRight') + '</button>').join('') : '<div class="gc-s-sub-empty">还没有创作记录</div>') + '</div>' + pagerHTML(page, Number(r.count || 0), 20) + '</div>';
          ctx.body.onclick = async e => { const row = e.target.closest('[data-gc-s-session]'), p = e.target.closest('[data-gc-s-action="picker-page"]'); if (p) { page = Number(p.dataset.page); load(); } if (row) { row.disabled = true; try { const view = await G.geo('articleAgentView', { id: Number(row.dataset.gcSSession) }); if (!ctx.isCurrent()) return; mergeSession(s, view, true); persist(); ctx.close(); if (active) paintRight(); schedulePoll(100); } catch (err) { if (ctx.isCurrent()) { H.setErr(ctx, message(err)); row.disabled = false; } } } };
        } catch (e) { if (ctx.isCurrent()) H.setErr(ctx, message(e)); }
      }
      await load();
    }
    function savedFromRow(row) { return { id: Number(row.id), title: row.title, content: row.content, expected_update: row.update_time, expected_hash: row.expected_hash }; }
    async function openArticle(row) {
      const s = state(); if (!row || !row.id) return;
      let full = row;
      if (!row.expected_hash || row.content == null) { const r = await G.geo('workspaceRecords', { kind: 'articles', id: row.id }); full = (r.lists || [])[0]; if (!full) throw new Error('文章不存在或已被移除'); }
      if (state() !== s) return;
      const meta = typeof full.metadata_json === 'string' ? JSON.parse(full.metadata_json || '{}') : full.metadata_json || {};
      insertJob(s, { id: 'article-' + full.id, source: 'library', status: 'success', subject: full.title, saved: savedFromRow(full), keyword_group_id: meta.keyword_group_id || 0, category_id: meta.category_id || 0, article_type: '文章库稿件' });
      persist(); if (active) paintRight();
    }
    async function resourceManage(kind) { const valid = scopeGuard(); C.manage(kind, async () => { if (!valid()) return; const rows = await C.resources(kind, true); if (!valid()) return; if (kind === 'instruction') instructions = rows; if (kind === 'category') categories = rows; if (kind === 'keyword') groups = rows; if (active) paint(); }); }
    function chooseModel() {
      const s = state();
      const ctx = openDialog({ title: '选择文本模型', width: 600, body: '<div class="gc-s-dialog gc-s-model-options">' + (opts.models || []).map(m => '<label class="gc-s-picker-row"><input type="radio" name="gc-studio-model" value="' + esc(m.id) + '"' + (String(s.config.model_id) === String(m.id) ? ' checked' : '') + '><span><strong>' + esc(m.name) + '</strong><small>输入 ' + UK.tp(m.input_price) + '/' + H.fmt(m.input_unit_size) + ' tokens · 输出 ' + UK.tp(m.output_price) + '/' + H.fmt(m.output_unit_size) + ' tokens</small></span></label>').join('') + '</div>', actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'apply', label: '使用模型', kind: 'primary' }], onAction: (k, d) => { if (k !== 'apply') return; const n = $('input[name="gc-studio-model"]:checked', d.body); if (!n) { H.setErr(d, '请选择模型'); return false; } s.config.model_id = n.value; persist(); updateFooters(); const field = $('[data-gc-s-field="config.model_id"]'); if (field) field.value = n.value; } }); return ctx;
    }
    function click(e) {
      const n = e.target.closest('[data-gc-s-action]'); if (!n || !C.body()?.contains(n) && !n.matches('[data-gc-s-action="history"]')) return false;
      const a = n.dataset.gcSAction, s = state();
      if (a === 'mode') { s.mode = n.dataset.value; if (s.mode === 'batch' && s.selected.length > 3) s.selected = s.selected.slice(0, 3); persist(); paint(); }
      else if (a === 'topic-add') topicAddMenu(n);
      else if (a === 'topic-library') topicLibrary();
      else if (a === 'use-topic') { const p = s.pool.find(p => p.id === n.dataset.id); if (p) { if (s.mode === 'batch') { if (s.selected.includes(p.id)) s.selected = s.selected.filter(x => x !== p.id); else if (s.selected.length < 3) s.selected.push(p.id); else { feedback('每轮最多选择 3 个主题', 'fail'); return true; } } else { s.subject = p.text; s.related = []; } persist(); paint(); } }
      else if (a === 'remove-topic') { s.pool = s.pool.filter(p => p.id !== n.dataset.id); s.selected = s.selected.filter(x => x !== n.dataset.id); persist(); paint(); }
      else if (a === 'clear-topics') { openDialog({ title: '清空主题池？', body: '<p>清空当前暂存的主题，关键词库内容会保留。</p>', actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'clear', label: '清空主题池', kind: 'primary', danger: true }], onAction(k) { if (k === 'clear') { s.pool = []; s.selected = []; persist(); paint(); } } }); }
      else if (a === 'merge-topics') mergeTopics();
      else if (a === 'save-topics') saveTopics();
      else if (a === 'clear-related') { s.related = []; persist(); paint(); }
      else if (a === 'related') openDialog({ title: '本篇合并回答的问题', width: 600, body: '<ol class="gc-s-dialog-topics">' + s.related.map(t => '<li>' + esc(t) + '</li>').join('') + '</ol>' });
      else if (a === 'knowledge') G.openKnowledge();
      else if (a === 'materials') materialPicker();
      else if (a === 'remove-material') { s.materials = s.materials.filter(m => String(m.id) !== n.dataset.id); persist(); paint(); }
      else if (a === 'web-search') { const valid = scopeGuard(); C.searchWeb(s.subject, rows => { if (valid()) return addMaterials(rows); }); }
      else if (a === 'manage-instruction') resourceManage('instruction');
      else if (a === 'manage-category') resourceManage('category');
      else if (a === 'choose-model') chooseModel();
      else if (a === 'generate') guarded('generate', generate);
      else if (a === 'version') { s.activeId = n.dataset.id; s.tab = 'body'; persist(); paintRight(); }
      else if (a === 'tab') { s.tab = n.dataset.value; persist(); paintRight(); }
      else if (a === 'edit') { const j = current(); if (j) { j.editing = !j.editing; s.tab = 'body'; persist(); paintRight(); if (j.editing) $('[data-gc-s-field="editTitle"]')?.focus(); } }
      else if (a === 'copy') { const j = current(); if (j) navigator.clipboard.writeText(titleOf(j) + '\n\n' + contentOf(j)).then(() => feedback('全文已复制')).catch(() => feedback('复制失败，请使用编辑模式选择正文复制', 'fail')); }
      else if (a === 'export') { const j = current(); if (j) C.download(titleOf(j).replace(/[\\/:*?"<>|]/g, '_') + '.md', '# ' + titleOf(j) + '\n\n' + contentOf(j), 'text/markdown;charset=utf-8'); }
      else if (a === 'rewrite') rewrite();
      else if (a === 'save') guarded('save', async () => { const saved = await saveCurrent(); if (saved) feedback('文章已保存'); });
      else if (a === 'press') guarded('press', press);
      else if (a === 'tasks') C.go('effect-jobs');
      else if (a === 'history') history();
      else if (a === 'retry-load') draw(G.S.seq);
      else return false;
      return true;
    }
    function actions() { return button('创作记录', 'history', 'secondary', 'clock'); }
    function more() { return { items: [{ key: 'knowledge', label: '品牌知识库', icon: 'book' }, { key: 'instruction', label: '写作指令', icon: 'edit' }, { key: 'category', label: '文章分类', icon: 'folder' }, { key: 'jobs', label: '任务与 TP 消费', icon: 'clock' }], pick: k => { if (k === 'knowledge') G.openKnowledge(); else if (k === 'jobs') C.go('effect-jobs'); else resourceManage(k); } }; }
    async function intent(name, params) {
      params = params || {};
      if (name === 'history') return history();
      if (name === 'article') return openArticle(params);
      if (name === 'topics') return addTopics(params.topics || params, params.group);
      if (name === 'materials') return addMaterials(params);
      if (['create', 'replicate', 'batch'].includes(name)) { const s = state(); s.mode = name === 'create' ? 'write' : name; if (params.subject) s.subject = String(params.subject).slice(0, 500); if (params.reference) s.reference = String(params.reference).slice(0, 30000); if (params.group != null && Number.isInteger(Number(params.group)) && Number(params.group) >= 0) s.config.keyword_group_id = Number(params.group); if (s.mode === 'batch') s.selected = s.selected.slice(0, 3); persist(); if (active) paint(); return; }
      if (name === 'subject') { state().subject = String(params.subject || params || '').slice(0, 500); persist(); if (active) paint(); }
    }
    function leave() { active = false; paintEpoch++; lifecycle++; [...dialogs].forEach(d => d.close()); clearTimeout(pollTimer); unbind(); persist(); }
    function reset(brandChanged) { leave(); pending.clear(); pollBusy = false; loadError = ''; if (brandChanged) { opts = {}; profile = {}; groups = []; categories = []; instructions = []; } }
    function destroy() { leave(); pending.clear(); }
    return { draw, click, actions, more, intent, reset, leave, destroy, addTopics, addMaterials, openArticle, history };
  };
})();


/* GEO content: real editorial resources and safe, brand-scoped orchestration. */
(() => {
  'use strict';
  const VIEWS={keywords:['content','keywords'],articles:['content','studio'],'article-library':['content','library'],materials:['content','materials'],images:['content','images']};
  const ALIAS={'keyword-library':'keywords',questions:'keywords','ai-keywords':'keywords','manual-keywords':'keywords',create:'articles',replicate:'articles','batch-replicate':'articles',instructions:'articles',categories:'articles',brand:'articles',search:'materials'};
  const INTENTS={'ai-keywords':'ai','manual-keywords':'manual',create:'create',replicate:'replicate','batch-replicate':'batch',instructions:'instructions',categories:'categories',brand:'knowledge',search:'search'};
  const inflight=new Map();
  const create=(G)=>{
    const UK=window.UK,H=G.H,{esc,icon,btn,empty,status,fmt,when,key,setErr}=H;
    const body=()=>G.$('.gv-body'),draftBag={};
    let opts=null,optPromise=null,scope='',scopeBrand='',storageWarned=false,cache={},dead=false;
    const searchTimers=new Map(),queryVersion={articles:0,materials:0,images:0},dialogs=new Set();
    const current=(brand,view)=>!dead&&String(G.S.brand)===brand&&(!view||G.V===view);
    const dialog=o=>{let ctx;const onClose=o.onClose;ctx=UK.dialog({...o,onClose(v){dialogs.delete(ctx);onClose&&onClose(v);}});dialogs.add(ctx);return ctx;};
    const clearSearch=kind=>{if(kind){clearTimeout(searchTimers.get(kind));searchTimers.delete(kind);}else{searchTimers.forEach(clearTimeout);searchTimers.clear();Object.keys(queryVersion).forEach(k=>queryVersion[k]++);}};
    function paint(target,html,name){const active=document.activeElement,keep=active&&target.contains(active)&&active.name===name;const selection=keep?[active.selectionStart,active.selectionEnd,active.selectionDirection]:null;target.innerHTML=html;if(keep){const next=target.querySelector('[name="'+name+'"]');if(next){next.focus({preventScroll:true});try{next.setSelectionRange(...selection);}catch(e){}}}}
    function wireSearch(el,kind,property,page,view,draw){const schedule=e=>{clearSearch(kind);state[property]=el.value;const version=++queryVersion[kind],brand=String(G.S.brand);if(el._composing||e?.isComposing)return;searchTimers.set(kind,setTimeout(()=>{searchTimers.delete(kind);if(!current(brand,view)||version!==queryVersion[kind])return;state[page]=1;draw(++G.S.seq);},300));};el.oninput=schedule;el.oncompositionstart=()=>{el._composing=true;clearSearch(kind);queryVersion[kind]++;};el.oncompositionend=()=>{el._composing=false;schedule();};}
    const state={articlePage:1,articleQuery:'',category:0,group:0,articles:[],articleCount:null,materialPage:1,materialQuery:'',materialCategory:'',materials:[],materialCount:null,selected:new Set(),imagePage:1,imageQuery:'',images:[],imageCount:null};
    const persist=()=>{if(!scope)return;try{sessionStorage.setItem(scope,JSON.stringify(draftBag));}catch(e){if(!storageWarned){storageWarned=true;UK.toast('浏览器未能保存草稿，请先导出重要稿件','info');}}};
    function updateCharge(targetScope,slot,requestKey,value){
      let bag;if(scope===targetScope)bag=draftBag;else{try{bag=JSON.parse(sessionStorage.getItem(targetScope)||'{}');}catch(e){bag={};}}
      bag.charges=bag.charges||{};const previous=bag.charges[slot];if(previous&&previous.body?.request_key!==requestKey)return;
      if(value)bag.charges[slot]=value;else delete bag.charges[slot];
      if(scope===targetScope)persist();else try{sessionStorage.setItem(targetScope,JSON.stringify(bag));}catch(e){UK.toast('浏览器未能更新原品牌的请求记录，请到任务与 TP 核对','info');}
    }
    async function options(force=false){
      if(opts&&!force&&scopeBrand===String(G.S.brand))return opts;
      if(optPromise&&!force)return optPromise;
      const brand=String(G.S.brand);
      const pending=G.geo('options').then(data=>{
        if(brand!==String(G.S.brand)||dead)return data;
        opts=data;scopeBrand=brand;
        const next='gv-studio:'+data.draft_scope;
        if(scope!==next){persist();Object.keys(draftBag).forEach(k=>delete draftBag[k]);scope=next;try{Object.assign(draftBag,JSON.parse(sessionStorage.getItem(scope)||'{}'));}catch(e){} }
        draftBag.charges=draftBag.charges||{};return data;
      });
      optPromise=pending;try{return await pending;}finally{if(optPromise===pending)optPromise=null;}
    }
    const attrs=a=>typeof a==='string'?a:Object.entries(a||{}).map(([k,v])=>v===false||v==null?'':' '+esc(k)+(v===true?'':'="'+esc(v)+'"')).join('');
    const input=(name,value,a={})=>'<input class="uk-input" name="'+esc(name)+'" value="'+esc(value??'')+'" '+attrs(a)+'>';
    const field=(label,html)=>'<label class="gc-field"><span>'+esc(label)+'</span>'+html+'</label>';
    const select=(name,items,value)=>'<select class="uk-select" name="'+esc(name)+'">'+items.map(x=>{const [id,label]=Array.isArray(x)?x:[x.id,x.name||x.title];return '<option value="'+esc(id)+'"'+(String(id)===String(value)?' selected':'')+'>'+esc(label)+'</option>';}).join('')+'</select>';
    const download=(name,text,mime='text/plain;charset=utf-8')=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:mime}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    const csv=(rows)=>'\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const markdown=text=>esc(text||'').split(/\n{2,}/).map(block=>/^#{1,3}\s/.test(block)?'<h2>'+block.replace(/^#{1,3}\s/,'')+'</h2>':'<p>'+block.replace(/\n/g,'<br>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')+'</p>').join('');
    async function resources(kind,force=false){if(!cache[kind]||force){const brand=String(G.S.brand);const r=await G.geo('resources',{kind,page_size:500});if(brand===String(G.S.brand))cache[kind]=r.lists||[];return r.lists||[];}return cache[kind];}
    const counts=()=>G.counts({articles:state.articleCount,materials:state.materialCount,images:state.imageCount});
    const button=(label,action,kind='secondary',extra={})=>btn({kind,label,attrs:{'data-gc-a':action,...extra}});
    const showError=(e)=>UK.toast(e.message||'读取失败，请重试','fail');
    const go=hash=>{const k=hash.split('?')[0];if(VIEWS[k]||['effect','effect-jobs','diagnose'].includes(k))G.go(k,true);else{persist();UK.go('/ai/geo?tenant_id='+encodeURIComponent(UK.tenant())+'&brand_id='+encodeURIComponent(G.S.brand)+'#'+hash);}};

    /* A paid request is frozen before its first attempt. Uncertain replies never get a fresh key. */
    async function charge({slot,title,action,body:requested,onSuccess}){
      const originBrand=String(G.S.brand),o=await options();if(!current(originBrand)||!scope)return null;
      const originScope=scope,flightKey=originScope+':'+slot;draftBag.charges=draftBag.charges||{};
      let request=inflight.get(flightKey)?.request||draftBag.charges[slot];
      if(!request||!request.attempted)request={action,body:{...JSON.parse(JSON.stringify(requested)),request_key:key('gc')},attempted:false};
      draftBag.charges[slot]=request;persist();
      const requestKey=request.body.request_key,payload=request.body,search=payload.operation==='web_search';
      const model=(o.models||[]).find(m=>String(m.id)===String(payload.model_id||o.default_model_id))||(o.models||[])[0];
      if(!search&&model){payload.model_id=payload.model_id||model.id;payload.quote_token=payload.quote_token||model.quote_token;}payload.accept_charge=true;persist();
      if((search&&!o.search_available)||(!search&&!o.text_available)){serviceDialog(search?'search':'text');return null;}
      const calls=payload.subjects?.length||1;
      return new Promise(resolve=>{
        let settled=false,busy=false;
        const finish=value=>{if(!settled){settled=true;resolve(value);}};
        const price=search?'<div class="gc-price-line"><span>每次网页检索</span><b>'+UK.tp(o.search_price)+'</b></div>':'<div class="gc-price-line"><span>文本模型</span><b>'+esc(model?.name||payload.model_id)+'</b></div><div class="gc-price-line"><span>输入 / '+fmt(model?.input_unit_size||1000)+' Token</span><b>'+UK.tp(model?.input_price)+'</b></div><div class="gc-price-line"><span>输出 / '+fmt(model?.output_unit_size||1000)+' Token</span><b>'+UK.tp(model?.output_price)+'</b></div>';
        const subject=payload.subject||payload.subjects?.join('\n')||payload.instruction||'';
        dialog({title:title||'核对费用',width:520,dismissable:false,body:'<div class="gc-charge"><div class="gc-charge-subject">'+esc(subject)+'</div>'+price+(search?'':'<p class="uk-meta">'+calls+' 次模型调用，每次最多输出 4096 Token，按实际用量结算。'+(action==='studioKeywords'?'结果勾选后才入库。':'')+'</p>')+(request.attempted?'<div class="uk-notice">'+icon('info')+'<span>上次提交结果未确认，再次确认会沿用原请求，不会重复扣费。</span></div>':'')+'<div class="gc-charge-error" role="alert"></div></div>',actions:[{key:'cancel',label:'返回调整',kind:'secondary'},{key:'submit',label:search?'确认检索':'确认生成',kind:'ai',icon:'spark'}],onClose(){finish(null);},async onAction(k,c){
          if(k!=='submit'){if(busy)return false;finish(null);return;}
          if(busy)return false;if(!current(originBrand)||scope!==originScope){finish(null);c.close();return false;}
          busy=true;c.busy('submit',true);c.busy('cancel',true);request.attempted=true;updateCharge(originScope,slot,requestKey,request);
          let flight=inflight.get(flightKey);
          if(!flight){flight={request,delivered:false};flight.promise=G.geo(request.action,{},request.body);inflight.set(flightKey,flight);}
          try{
            const result=await flight.promise;updateCharge(originScope,slot,requestKey,null);
            if(inflight.get(flightKey)===flight)inflight.delete(flightKey);
            finish(result);c.close();
            if(onSuccess&&!flight.delivered&&current(originBrand)&&scope===originScope){flight.delivered=true;try{await onSuccess(result);}catch(e){UK.toast('任务已提交，读取结果时遇到问题，请到任务与 TP 查看','info');}}
          }catch(e){
            if(inflight.get(flightKey)===flight)inflight.delete(flightKey);
            if(e.answered)updateCharge(originScope,slot,requestKey,null);
            if(!c.el.isConnected)return false;
            c.body.querySelector('.gc-charge-error').innerHTML=esc(e.message)+(e.answered?'<p class="uk-meta">返回调整后重新核对设置与报价。</p>':'<p class="uk-meta">结果尚未确认，再次确认会沿用原请求。</p>');
            if(e.answered){c.el.querySelector('[data-act="submit"]').disabled=true;if(current(originBrand))opts=null;}else c.busy('submit',false);
            c.busy('cancel',false);busy=false;return false;
          }
          return false;
        }});
      });
    }
    function serviceDialog(type='text'){const search=type==='search';dialog({title:search?'网页检索待开通':'文章生成服务待开通',width:460,body:'<div class="gc-service">'+status('off','待开通')+'<p>'+esc(search?(opts?.search_notice||'请联系服务商配置网页检索与按次价格。'):(opts?.text_notice||'请联系服务商配置 GEO 文本模型与输入、输出价格。'))+'</p><p class="uk-meta">开通后这里会自动启用，已准备的主题与资料可以继续保留。</p></div>',actions:[{key:'ok',label:'知道了',kind:'primary'}]});}

    function manage(kind,onSaved){
      const originBrand=String(G.S.brand),originView=G.V,title=kind==='instruction'?'写作指令':'文章分类';let rows=[],trash=false,drawId=0;
      const box=document.createElement('div');box.className='gc-manager';
      const ctx=dialog({title:'管理'+title,drawer:true,width:620,body:box});
      const draw=async()=>{if(!current(originBrand)||!ctx.el.isConnected)return;const token=++drawId;box.innerHTML=G.skelRows(4);try{const r=await G.geo('resources',{kind,trash:trash?1:0,page_size:500});if(!current(originBrand)||!ctx.el.isConnected||token!==drawId)return;rows=r.lists||[];box.innerHTML='<div class="uk-bar">'+button('新增'+title,'resource-new','primary')+'<span class="uk-grow"></span><button class="uk-btn uk-btn-ghost" data-resource-trash>'+icon(trash?'arrowLeft':'delete')+'<span>'+(trash?'返回列表':'回收站')+'</span></button></div><div class="gc-resource-list">'+(rows.length?rows.map(r=>'<article><div><b>'+esc(r.title)+'</b>'+(kind==='instruction'?'<p>'+esc(r.content)+'</p>':'')+'</div><div class="uk-actions">'+(trash?'<button class="uk-btn uk-btn-secondary is-sm" data-resource-restore="'+r.id+'">恢复</button>':'<button class="uk-btn uk-btn-ghost is-sm" data-resource-edit="'+r.id+'">编辑</button><button class="uk-btn uk-btn-ghost is-sm" data-resource-delete="'+r.id+'">移入回收站</button>')+'</div></article>').join(''):empty({icon:'folder',title:trash?'回收站里没有'+title:'还没有'+title,compact:true}))+'</div>';}catch(e){if(current(originBrand)&&ctx.el.isConnected&&token===drawId)box.innerHTML=G.errBox(e.message);}};
      const edit=(r={})=>{const form=document.createElement('form');form.className='gc-form';form.innerHTML=field('名称',input('title',r.title||'',{maxlength:255,required:true,autofocus:true}))+(kind==='instruction'?field('写作指令','<textarea class="uk-textarea" name="content" rows="9" maxlength="30000" required>'+esc(r.content||'')+'</textarea>'):'');const save=dialog({title:(r.id?'编辑':'新增')+title,width:540,body:form,actions:[{key:'cancel',label:'取消',kind:'secondary'},{key:'save',label:'保存',kind:'primary'}],async onAction(k,c){if(k!=='save')return;if(!current(originBrand)){c.close();return false;}if(!form.reportValidity())return false;c.busy('save',true);try{await G.geo('resourceSave',{}, {kind,id:r.id||0,revision:r.revision||0,title:form.elements.title.value.trim(),content:form.elements.content?.value||'',purpose:'article'});delete cache[kind];await draw();if(current(originBrand,originView))onSaved&&await onSaved();UK.toast('已保存');}catch(e){setErr(c,e.message);c.busy('save',false);return false;}}});form.onsubmit=e=>{e.preventDefault();save.el.querySelector('[data-act="save"]').click();};};
      box.onclick=async e=>{if(!current(originBrand)){ctx.close();return;}if(e.target.closest('[data-resource-trash]')){trash=!trash;draw();return;}if(e.target.closest('[data-gc-a="resource-new"]'))return edit();const el=e.target.closest('[data-resource-edit],[data-resource-delete],[data-resource-restore]');if(!el)return;const id=Number(el.dataset.resourceEdit||el.dataset.resourceDelete||el.dataset.resourceRestore),r=rows.find(x=>Number(x.id)===id);if(!r)return;if(el.dataset.resourceEdit)return edit(r);el.disabled=true;try{await G.geo('resourceRecycle',{}, {kind,id:r.id,revision:r.revision,restore:el.hasAttribute('data-resource-restore')?1:0});delete cache[kind];await draw();if(current(originBrand,originView))onSaved&&await onSaved();UK.toast(el.hasAttribute('data-resource-restore')?'已恢复':'已移入回收站');}catch(err){el.disabled=false;showError(err);}};
      draw();return ctx;
    }
    async function searchWeb(subject='',onSaved){
      const originBrand=String(G.S.brand),o=await options();if(!current(originBrand))return;
      const form=document.createElement('form');form.className='gc-form';
      form.innerHTML=field('检索词',input('subject',subject,{maxlength:500,required:true,autofocus:true}))+ '<div class="gc-two-fields">'+field('时间范围',select('freshness',[['noLimit','不限'],['oneDay','一天内'],['oneWeek','一周内'],['oneMonth','一月内'],['oneYear','一年内']],'noLimit'))+field('结果条数',select('count',[[10,'10 条'],[20,'20 条'],[30,'30 条'],[50,'50 条']],10))+'</div><div class="gc-search-results"></div>';
      let timer=0,run=0;
      const poll=async(c,jobId,token)=>{
        const valid=()=>current(originBrand)&&c.el.isConnected&&run===token;
        if(!valid())return;
        try{const r=await G.geo('jobs',{id:jobId}),j=r.lists?.[0];if(!valid())return;if(!j)throw new Error('检索任务暂时不可用，请到任务与 TP 查看');
          if(['queued','running','submitting','polling'].includes(j.status)){form.querySelector('.gc-search-results').innerHTML='<div class="gc-wait">'+status('run','检索中')+G.skelRows(3)+'</div>';timer=setTimeout(()=>poll(c,jobId,token),2500);return;}
          if(j.status!=='success'){form.querySelector('.gc-search-results').innerHTML='<p class="gc-error">'+esc(j.error||'检索未完成，请查看任务与 TP')+'</p>';return;}
          const rows=j.result?.items||[];form.querySelector('.gc-search-results').innerHTML=rows.length?rows.map((r,i)=>'<article class="gc-search-item"><b>'+esc(r.title)+'</b><p>'+esc(r.summary||'')+'</p><div class="uk-bar">'+H.link(r.url,'来源网页')+'<span class="uk-grow"></span><button type="button" class="uk-btn uk-btn-secondary is-sm" data-search-save="'+i+'">存为事实素材</button></div></article>').join(''):empty({icon:'search',title:'没有找到符合条件的网页',compact:true});
          form.querySelectorAll('[data-search-save]').forEach(b=>b.onclick=async()=>{
            if(!valid())return;b.disabled=true;let saved=false;
            try{const row=rows[Number(b.dataset.searchSave)],created=await G.geo('contentSave',{}, {kind:'materials',title:row.title,content:row.summary||row.title,source_url:row.url,category:'检索待核实'});saved=true;b.textContent='已保存';if(!current(originBrand))return;
              const result=await G.geo('workspaceRecords',{kind:'materials',id:created.id}),fresh=result.lists?.[0];
              if(!current(originBrand))return;if(!fresh)throw new Error('素材已保存，暂未读取到最新记录');
              onSaved&&await onSaved([fresh]);UK.toast('已存为待核实的事实素材');
            }catch(e){if(!saved)b.disabled=false;showError(e);}
          });
        }catch(e){if(valid())form.querySelector('.gc-search-results').textContent=e.message;}
      };
      const ctx=dialog({title:'网页检索',width:760,body:form,actions:[{key:'cancel',label:'关闭',kind:'secondary'},{key:'search',label:o.search_available?'核对费用':'待开通',kind:'secondary',cost:o.search_available?o.search_price:null,icon:'search'}],onClose(){clearTimeout(timer);run++;},async onAction(k,c){if(k!=='search')return;if(!current(originBrand)){c.close();return false;}if(!o.search_available){serviceDialog('search');return false;}if(!form.reportValidity())return false;await charge({slot:'web-search',title:'核对检索费用',action:'generate',body:{operation:'web_search',subject:form.elements.subject.value.trim(),search_options:{freshness:form.elements.freshness.value,count:Number(form.elements.count.value)},material_ids:[]},onSuccess:async data=>{if(!c.el.isConnected||!current(originBrand))return;clearTimeout(timer);await poll(c,data.id,++run);}});return false;}});
      form.onsubmit=e=>{e.preventDefault();ctx.el.querySelector('[data-act="search"]').click();};return ctx;
    }

    const C={G,UK,H,options,body,field,input,select,download,resources,manage,charge,searchWeb,draftBag,persist,go,serviceDialog};
    const studio=window.GEO_CONTENT_PARTS.studio(C),keywords=window.GEO_CONTENT_PARTS.keywords({...C,toStudio:async(topics,group)=>{await studio.addTopics(topics,group);go('articles');}});
    const openStudioArticle=async r=>{const originBrand=String(G.S.brand);await studio.openArticle(r);if(current(originBrand))go('articles');};
    const articleMeta=r=>typeof r.metadata_json==='object'?r.metadata_json:{};
    function articleRead(r){dialog({title:r.title,width:920,body:'<article class="gc-reading"><div class="gc-reading-meta">'+esc(G.brandName())+'<span>·</span>'+esc(when(r.update_time))+'<span>·</span>'+fmt((r.content||'').replace(/\s/g,'').length)+' 字</div><h1>'+esc(r.title)+'</h1>'+markdown(r.content)+'</article>',actions:[{key:'edit',label:'在写稿中编辑',kind:'secondary',icon:'edit'},{key:'send',label:'送媒体发布',kind:'primary',icon:'send'}],async onAction(k,c){c.close();if(k==='edit'){await openStudioArticle(r);}if(k==='send')await sendArticle(r);return false;}});}
    async function sendArticle(r){if(!r.id)return;const originBrand=String(G.S.brand);try{const data=await G.geo('toPress',{}, {id:r.id});if(!current(originBrand))return;go('website?draftId='+encodeURIComponent(data.draft_id));}catch(e){showError(e);}}
    async function articleEdit(row){
      const originBrand=String(G.S.brand),originView=G.V;let r=row;if(row.id){try{const fresh=await G.geo('workspaceRecords',{kind:'articles',id:row.id});r=fresh.lists[0]||row;}catch(e){showError(e);return;}}
      const [cats,groups]=await Promise.all([resources('category'),resources('keyword')]),meta=articleMeta(r),form=document.createElement('form');if(!current(originBrand,originView))return;form.className='gc-form';
      form.innerHTML=field('文章标题',input('title',r.title||'',{maxlength:255,required:true,autofocus:true}))+field('文章分类',select('category_id',[[0,'未分类'],...cats.map(x=>[x.id,x.title])],meta.category_id||0))+field('关联词库',select('keyword_group_id',[[0,'未关联'],...groups.map(x=>[x.id,x.title])],meta.keyword_group_id||0))+(!row.id?field('文章正文','<textarea class="uk-textarea" name="content" rows="14" maxlength="100000" required></textarea>'):'');
      const d=dialog({title:row.id?'修改文章资料':'粘贴文章',width:680,body:form,actions:[{key:'cancel',label:'取消',kind:'secondary'},{key:'save',label:'保存到文章库',kind:'primary'}],async onAction(k,c){if(k!=='save')return;if(!current(originBrand)){c.close();return false;}if(!form.reportValidity())return false;c.busy('save',true);try{await G.geo('contentSave',{}, {kind:'articles',id:r.id||0,title:form.elements.title.value.trim(),content:form.elements.content?.value||r.content,category_id:Number(form.elements.category_id.value),keyword_group_id:Number(form.elements.keyword_group_id.value),expected_update:r.update_time,expected_hash:r.expected_hash});UK.toast('文章已保存');if(current(originBrand,'article-library'))await drawArticles(++G.S.seq);}catch(e){setErr(c,e.message);c.busy('save',false);return false;}}});form.onsubmit=e=>{e.preventDefault();d.el.querySelector('[data-act="save"]').click();};
    }
    async function drawArticles(seq){
      clearSearch('articles');const brand=String(G.S.brand),version=queryVersion.articles,query=state.articleQuery;const valid=()=>G.live(seq)&&current(brand,'article-library')&&version===queryVersion.articles&&query===state.articleQuery;
      const target=body();if(!target.querySelector('.gc-library'))target.innerHTML='<div class="uk-card gc-library gc-window">'+G.skelRows(7)+'</div>';else target.querySelector('.gc-library').setAttribute('aria-busy','true');
      try{const [r,cats,groups]=await Promise.all([G.geo('workspaceRecords',{kind:'articles',page:state.articlePage,keyword:state.articleQuery,category_id:state.category,keyword_group_id:state.group}),resources('category'),resources('keyword')]);if(!valid())return;state.articles=r.lists||[];state.articleCount=r.count;counts();
        paint(target,'<div class="uk-card gc-window gc-library"><aside class="gc-nav"><div class="gc-nav-head"><h2>文章分类</h2></div><nav aria-label="文章分类">'+[[0,'全部文章'],...cats.map(c=>[c.id,c.title])].map(([id,label])=>'<button data-gc-cat="'+id+'" class="'+(Number(state.category)===Number(id)?'is-active':'')+'">'+icon(id?'folder':'file')+'<span>'+esc(label)+'</span></button>').join('')+'</nav><button class="gc-nav-manage" data-gc-a="manage-category">'+icon('setting')+'管理分类</button></aside><section class="gc-main"><div class="gc-tools">'+input('article-search',state.articleQuery,{'aria-label':'搜索文章',placeholder:'搜索标题',type:'search'})+select('article-group',[[0,'全部词库'],...groups.map(g=>[g.id,g.title])],state.group)+'</div><div class="gc-active-filters">'+(state.articleQuery||state.category||state.group?'<span class="uk-meta">已筛选</span>'+button('清除筛选','clear-articles','ghost'):'')+'</div>'+(r.lists.length?'<div class="uk-table-wrap"><table class="uk-table gc-table"><thead><tr><th>标题与摘要</th><th>分类</th><th class="is-num">字数</th><th>更新时间</th><th class="is-act">操作</th></tr></thead><tbody>'+r.lists.map(a=>{const cat=cats.find(c=>Number(c.id)===Number(articleMeta(a).category_id));return '<tr><td><button class="gc-title-link" data-gc-read="'+a.id+'">'+esc(a.title)+'</button><p class="gc-row-excerpt">'+esc((a.content||'').replace(/[#*\n]/g,' ').slice(0,90))+'</p></td><td class="uk-meta">'+esc(cat?.title||'未分类')+'</td><td class="num is-num">'+fmt((a.content||'').replace(/\s/g,'').length)+'</td><td class="uk-meta">'+esc(when(a.update_time))+'</td><td><div class="uk-actions">'+button('编辑','article-studio','ghost',{'data-id':a.id})+button('更多','article-more','ghost',{'data-id':a.id})+'</div></td></tr>';}).join('')+'</tbody></table></div>':'<div class="gc-blank">'+empty({icon:'file',title:state.articleQuery||state.category||state.group?'没有符合条件的文章':'文章库还没有文章',actions:[{kind:state.articleQuery||state.category||state.group?'secondary':'ai',icon:state.articleQuery||state.category||state.group?'refresh':'spark',label:state.articleQuery||state.category||state.group?'清除筛选':'开始创作',attrs:{'data-gc-a':state.articleQuery||state.category||state.group?'clear-articles':'studio'}}],compact:true})+'</div>')+'<div class="gc-pager" data-gc-page-kind="articles">'+UK.pager(r.count,state.articlePage,20)+'</div></section></div>','article-search');
        const search=target.querySelector('[name="article-search"]');wireSearch(search,'articles','articleQuery','articlePage','article-library',drawArticles);target.querySelector('[name="article-group"]').onchange=e=>{state.group=Number(e.target.value);state.articlePage=1;drawArticles(++G.S.seq);};
      }catch(e){if(valid())target.innerHTML=G.errBox(e.message);}
    }
    async function materialEdit(row={}){
      const originBrand=String(G.S.brand);const form=document.createElement('form');form.className='gc-form';form.innerHTML=field('素材标题',input('title',row.title||'',{maxlength:255,required:true,autofocus:true}))+field('分类',input('category',row.category||'企业事实',{maxlength:80,list:'gc-material-categories'}))+'<datalist id="gc-material-categories">'+['企业事实','产品参数','案例数据','资质荣誉','检索待核实'].map(v=>'<option value="'+esc(v)+'">').join('')+'</datalist>'+field('来源链接',input('source_url',row.source_url||'',{type:'url',maxlength:2048,placeholder:'https://'}))+field('事实内容','<textarea class="uk-textarea" name="content" rows="10" maxlength="30000" required>'+esc(row.content||'')+'</textarea>');
      const d=dialog({title:row.id?'编辑事实素材':'新增事实素材',width:680,body:form,actions:[{key:'cancel',label:'取消',kind:'secondary'},{key:'save',label:'保存素材',kind:'primary'}],async onAction(k,c){if(k!=='save')return;if(!current(originBrand)){c.close();return false;}if(!form.reportValidity())return false;c.busy('save',true);try{await G.geo('contentSave',{}, {kind:'materials',id:row.id||0,title:form.elements.title.value.trim(),category:form.elements.category.value.trim()||'企业事实',source_url:form.elements.source_url.value.trim(),content:form.elements.content.value.trim(),expected_update:row.update_time,revision:row.revision||0});UK.toast('事实素材已保存');if(current(originBrand,'materials'))await drawMaterials(++G.S.seq);}catch(e){setErr(c,e.message);c.busy('save',false);return false;}}});form.onsubmit=e=>{e.preventDefault();d.el.querySelector('[data-act="save"]').click();};
    }
    function materialSelection(){const rows=state.materials.filter(r=>state.selected.has(Number(r.id)));const all=body().querySelector('[data-gc-material-all]');if(all)all.setAttribute('aria-checked',rows.length&&rows.length===state.materials.length?'true':rows.length?'mixed':'false');body().querySelectorAll('[data-gc-material-pick]').forEach(b=>b.setAttribute('aria-checked',String(state.selected.has(Number(b.dataset.gcMaterialPick)))));UK.batch(rows.length?{count:rows.length,actions:[{key:'write',label:'用于写稿',icon:'edit'},{key:'export',label:'导出',icon:'download'}],onClear(){state.selected.clear();materialSelection();},async onAction(k){if(k==='export')download('事实素材.csv',csv([['标题','分类','来源','内容'],...rows.map(r=>[r.title,r.category,r.source_url,r.content])]),'text/csv;charset=utf-8');if(k==='write'){if(rows.length>10){UK.toast('每篇最多引用 10 条事实素材','info');return;}await studio.addMaterials(rows);go('articles');}}}:null);}
    async function drawMaterials(seq){
      clearSearch('materials');state.selected.clear();UK.batch(null);const brand=String(G.S.brand),version=queryVersion.materials,query=state.materialQuery;const valid=()=>G.live(seq)&&current(brand,'materials')&&version===queryVersion.materials&&query===state.materialQuery;
      const target=body();if(!target.querySelector('.gc-materials'))target.innerHTML='<div class="uk-card gc-materials">'+G.skelRows(6)+'</div>';else target.querySelector('.gc-materials').setAttribute('aria-busy','true');
      try{const r=await G.geo('workspaceRecords',{kind:'materials',page:state.materialPage,keyword:state.materialQuery,category:state.materialCategory});if(!valid())return;state.materials=r.lists||[];state.materialCount=r.count;counts();state.selected.clear();const cats=[...new Set(['企业事实','产品参数','案例数据','资质荣誉','检索待核实',...state.materials.map(x=>x.category)].filter(Boolean))];
        paint(target,'<section class="uk-card gc-materials"><div class="gc-tools">'+input('material-search',state.materialQuery,{placeholder:'搜索事实素材',type:'search','aria-label':'搜索事实素材'})+select('material-category',[['','全部分类'],...cats.map(c=>[c,c])],state.materialCategory)+(state.materialQuery||state.materialCategory?button('清除筛选','clear-materials','ghost'):'')+'</div>'+(r.lists.length?'<div class="uk-table-wrap"><table class="uk-table gc-table"><thead><tr><th class="gc-check-cell"><button class="uk-check" role="checkbox" aria-checked="false" aria-label="选择本页素材" data-gc-material-all>'+icon('check')+'</button></th><th>标题与摘要</th><th>分类</th><th>来源</th><th>更新时间</th><th></th></tr></thead><tbody>'+r.lists.map(m=>'<tr><td><button class="uk-check" role="checkbox" aria-checked="false" aria-label="选择 '+esc(m.title)+'" data-gc-material-pick="'+m.id+'">'+icon('check')+'</button></td><td><b>'+esc(m.title)+'</b><p class="gc-row-excerpt">'+esc((m.content||'').slice(0,100))+'</p></td><td>'+(m.category==='检索待核实'?status('wait','待核实'):'<span class="uk-meta">'+esc(m.category||'企业事实')+'</span>')+'</td><td>'+(m.source_url?H.link(m.source_url,'来源网页'):'<span class="uk-meta">未填写</span>')+'</td><td class="uk-meta">'+esc(when(m.update_time))+'</td><td>'+button('编辑','material-edit','ghost',{'data-id':m.id})+'</td></tr>').join('')+'</tbody></table></div>':'<div class="gc-blank">'+empty({icon:'book',title:state.materialQuery||state.materialCategory?'没有符合条件的事实素材':'还没有事实素材',actions:[{kind:state.materialQuery||state.materialCategory?'secondary':'primary',label:state.materialQuery||state.materialCategory?'清除筛选':'新增素材',attrs:{'data-gc-a':state.materialQuery||state.materialCategory?'clear-materials':'material-new'}}],compact:true})+'</div>')+'<div class="gc-pager" data-gc-page-kind="materials">'+UK.pager(r.count,state.materialPage,20)+'</div></section>','material-search');
        wireSearch(target.querySelector('[name="material-search"]'),'materials','materialQuery','materialPage','materials',drawMaterials);target.querySelector('[name="material-category"]').onchange=e=>{state.materialCategory=e.target.value;state.materialPage=1;drawMaterials(++G.S.seq);};
      }catch(e){if(valid())target.innerHTML=G.errBox(e.message);}
    }
    function uploadImages(){const picker=document.createElement('input');picker.type='file';picker.accept='.jpg,.jpeg,.png,.webp,.gif';picker.multiple=true;picker.onchange=()=>{const files=[...picker.files],valid=files.filter(f=>/\.(jpe?g|png|webp|gif)$/i.test(f.name)&&f.size<=20*1024*1024);if(valid.length<files.length)UK.toast((files.length-valid.length)+' 个文件不符合图片格式或 20 MB 大小限制','info');if(valid.length)UK.upload(valid,{url:'/api/merchantWorkspace/upload',fields:{kind:'image',folder_id:0},onDone(){if(G.V==='images')drawImages(++G.S.seq);}});};picker.click();}
    async function drawImages(seq){
      clearSearch('images');const brand=String(G.S.brand),version=queryVersion.images,query=state.imageQuery;const valid=()=>G.live(seq)&&current(brand,'images')&&version===queryVersion.images&&query===state.imageQuery;
      const target=body();if(!target.querySelector('.gc-images'))target.innerHTML='<section class="uk-card gc-images"><div class="gc-image-grid">'+Array.from({length:8},()=>UK.skel('100%',180,14)).join('')+'</div></section>';
      try{const r=await G.ws('library',{kind:'image',trash:0,page:state.imagePage,page_size:24,keyword:state.imageQuery,sort:'recent'});if(!valid())return;state.images=r.lists||[];state.imageCount=r.count;counts();paint(target,'<section class="uk-card gc-images"><div class="gc-tools">'+input('image-search',state.imageQuery,{placeholder:'搜索图片',type:'search','aria-label':'搜索图片'})+'<span class="uk-grow"></span>'+button('在素材库管理','image-manage','ghost')+'</div>'+(state.images.length?'<div class="gc-image-grid">'+state.images.map((m,i)=>'<article><button class="gc-image" data-gc-image="'+i+'"><img loading="lazy" src="'+esc(m.files?.[0]?.url||'')+'" alt="'+esc(m.name)+'"></button><b>'+esc(m.name)+'</b></article>').join('')+'</div>':'<div class="gc-blank">'+empty({icon:'image',title:state.imageQuery?'没有符合条件的图片':'图片素材里还没有图片',actions:[{kind:'primary',icon:'upload',label:state.imageQuery?'清除筛选':'上传图片',attrs:{'data-gc-a':state.imageQuery?'clear-images':'image-upload'}}],compact:true})+'<p class="uk-meta">JPG、PNG、WebP、GIF · 单张不超过 20 MB</p></div>')+'<div class="gc-pager" data-gc-page-kind="images">'+UK.pager(r.count,state.imagePage,24)+'</div></section>','image-search');const el=target.querySelector('[name="image-search"]');wireSearch(el,'images','imageQuery','imagePage','images',drawImages);}catch(e){if(valid())target.innerHTML=G.errBox(e.message);}
    }
    function click(e){
      if(studio.click&&studio.click(e))return true;if(keywords.click&&keywords.click(e))return true;
      const target=e.target,action=target.closest('[data-gc-a]');
      if(action){const k=action.dataset.gcA,id=Number(action.dataset.id),r=state.articles.find(x=>Number(x.id)===id);if(k==='studio')go('articles');else if(k==='manage-category')manage('category',()=>{if(G.V==='article-library')return drawArticles(++G.S.seq);});else if(k==='article-paste')articleEdit({});else if(k==='article-studio'&&r)openStudioArticle(r).catch(showError);else if(k==='article-more'&&r)UK.menu(action,[{key:'read',label:'阅读全文',icon:'file'},{key:'meta',label:'修改资料',icon:'edit'},{key:'export',label:'导出 Markdown',icon:'download'},{key:'send',label:'送媒体发布',icon:'send'}],v=>{if(v==='read')articleRead(r);if(v==='meta')articleEdit(r);if(v==='export')download(r.title+'.md','# '+r.title+'\n\n'+r.content);if(v==='send')sendArticle(r);},{align:'right'});else if(k==='clear-articles'){state.articleQuery='';state.category=state.group=0;state.articlePage=1;drawArticles(++G.S.seq);}else if(k==='material-new')materialEdit();else if(k==='material-edit')materialEdit(state.materials.find(x=>Number(x.id)===id));else if(k==='clear-materials'){state.materialQuery=state.materialCategory='';state.materialPage=1;drawMaterials(++G.S.seq);}else if(k==='web-search')searchWeb('',()=>{if(G.V==='materials')return drawMaterials(++G.S.seq);});else if(k==='image-upload')uploadImages();else if(k==='clear-images'){state.imageQuery='';state.imagePage=1;drawImages(++G.S.seq);}else if(k==='image-manage')UK.go('/ai/materials/images');else return false;return true;}
      const read=target.closest('[data-gc-read]');if(read){const r=state.articles.find(x=>String(x.id)===read.dataset.gcRead);if(r)articleRead(r);return true;}
      const cat=target.closest('[data-gc-cat]');if(cat){state.category=Number(cat.dataset.gcCat);state.articlePage=1;drawArticles(++G.S.seq);return true;}
      const pick=target.closest('[data-gc-material-pick]');if(pick){const id=Number(pick.dataset.gcMaterialPick);state.selected.has(id)?state.selected.delete(id):state.selected.add(id);materialSelection();return true;}
      if(target.closest('[data-gc-material-all]')){state.selected=state.selected.size===state.materials.length?new Set():new Set(state.materials.map(x=>Number(x.id)));target.closest('[data-gc-material-all]').setAttribute('aria-checked',String(state.selected.size===state.materials.length));materialSelection();return true;}
      const image=target.closest('[data-gc-image]');if(image){UK.lightbox({items:state.images.map(m=>({id:m.id,title:m.name,url:m.files?.[0]?.url,kind:'image',meta:[when(m.create_time)]})),index:Number(image.dataset.gcImage)});return true;}
      const page=target.closest('[data-gc-page-kind] [data-page]');if(page&&!page.disabled){const kind=page.closest('[data-gc-page-kind]').dataset.gcPageKind,n=Number(page.dataset.page);if(kind==='articles'){state.articlePage=n;drawArticles(++G.S.seq);}if(kind==='materials'){state.materialPage=n;drawMaterials(++G.S.seq);}if(kind==='images'){state.imagePage=n;drawImages(++G.S.seq);}return true;}return false;
    }
    async function draw(sub,seq){body().innerHTML='<div class="gc-s-loading">'+UK.skel('100%',420,16)+'</div>';try{await options();if(!G.live(seq))return;if(sub==='studio'){const o=opts;if(!o.text_available)G.notice('<div class="uk-notice">'+icon('info')+'<span>文章生成服务待开通</span>'+button('怎么开通','text-service','ghost')+'</div>');await studio.draw(seq);}else if(sub==='keywords')await keywords.draw(seq);else if(sub==='library')await drawArticles(seq);else if(sub==='materials')await drawMaterials(seq);else await drawImages(seq);}catch(e){if(G.live(seq))body().innerHTML=G.errBox(e.message);}}
    const actions=sub=>sub==='studio'?studio.actions():sub==='keywords'?keywords.actions():sub==='library'?button('粘贴文章','article-paste')+btn({kind:'ai',size:'lg',icon:'spark',label:'开始创作',attrs:{'data-gc-a':'studio'}}):sub==='materials'?btn({kind:'secondary',size:'lg',icon:'search',label:'网页检索',cost:opts?.search_available?opts.search_price:null,attrs:{'data-gc-a':'web-search'}})+btn({kind:'primary',size:'lg',icon:'plus',label:'新增素材',attrs:{'data-gc-a':'material-new'}}):btn({kind:'primary',size:'lg',icon:'upload',label:'上传图片',attrs:{'data-gc-a':'image-upload'}});
    const registeredClick=click;
    return {title:'GEO 内容',tabs(c){return [{key:'keywords',label:'关键词',count:c.keywords},{key:'articles',label:'写稿'},{key:'article-library',label:'文章库',count:c.articles},{key:'materials',label:'事实素材',count:c.materials},{key:'images',label:'图片素材',count:c.images}];},actions,draw,click(e){if(e.target.closest('[data-gc-a="text-service"]')){serviceDialog();return true;}return registeredClick(e);},more(sub){return {items:[{key:'knowledge',label:'企业知识',icon:'book'},{key:'instructions',label:'写作指令',icon:'file'},{key:'categories',label:'文章分类',icon:'folder'},'-',{key:'history',label:'创作记录',icon:'history'},{key:'jobs',label:'任务与 TP',icon:'list'}],pick(k){if(k==='knowledge')G.openKnowledge();if(k==='instructions')manage('instruction',()=>{cache.instruction=null;G.render();});if(k==='categories')manage('category',()=>{cache.category=null;G.render();});if(k==='history')studio.history();if(k==='jobs')go('effect-jobs');}};},async intent(name,params){await options();if(['ai','manual'].includes(name)||params.group&&G.V==='keywords')return keywords.intent(name,params);if(name==='knowledge')G.openKnowledge();else if(name==='instructions')manage('instruction');else if(name==='categories')manage('category');else if(name==='search')searchWeb(params.subject||'',()=>{if(G.V==='materials')G.render();});else studio.intent(name,params);},reset(brandChanged){persist();clearSearch();UK.batch(null);if(brandChanged){[...dialogs].forEach(c=>c.close());studio.reset&&studio.reset(true);keywords.reset&&keywords.reset(true);Object.keys(draftBag).forEach(k=>delete draftBag[k]);scope=scopeBrand='';state.articleQuery=state.materialQuery=state.imageQuery='';state.category=state.group=0;state.articlePage=state.materialPage=state.imagePage=1;state.articleCount=state.materialCount=state.imageCount=null;state.selected.clear();}cache={};opts=null;optPromise=null;},leave(){persist();clearSearch();UK.batch(null);studio.leave&&studio.leave();keywords.leave&&keywords.leave();},destroy(){persist();clearSearch();dead=true;[...dialogs].forEach(c=>c.close());studio.destroy&&studio.destroy();keywords.destroy&&keywords.destroy();}};
  };
  (window.GEO_AREAS||(window.GEO_AREAS={})).content={views:VIEWS,alias:ALIAS,intents:INTENTS,create};
})();
