/* Merchant UI v2 — 素材库 (/ai/materials/{video,images,audio,voiceover}), built on ui-kit.js.
   Same merchantWorkspace APIs as the legacy library (folders, labels, library, batch, folderSave,
   folderRecycle, folderReorder, labelSave, labelRemove, choices, materialSave, upload).
   The legacy MerchantMaterialLibrary stays loaded: the video editor still uses it as a picker. */
(() => {
  'use strict';
  const boot = () => {
    const UK = window.UK; if (!UK) return;
    const { esc, icon, fmt, ago, dur, btn, empty } = UK;

    const TYPES = {
      video: { label: '视频', unit: '个', max: 100, path: '/ai/materials/video', upload: '上传视频', accept: '.mp4,.mov', rule: 'MP4、MOV · 单个不超过 100MB', glyph: 'video' },
      image: { label: '图片', unit: '张', max: 20, path: '/ai/materials/images', upload: '上传图片', accept: '.jpg,.jpeg,.png,.webp,.gif', rule: 'JPG、PNG、WebP、GIF · 单张不超过 20MB', glyph: 'image' },
      audio: { label: '背景音频', unit: '段', max: 50, path: '/ai/materials/audio', upload: '上传音频', accept: '.mp3,.wav,.ogg,.flac,.aac,.m4a,.opus', rule: 'MP3、WAV、M4A 等 · 单个不超过 50MB', glyph: 'music' },
      voiceover: { label: '旁白配音', unit: '条', max: 50, path: '/ai/materials/voiceover', upload: '上传配音', accept: '.mp3,.wav,.ogg,.flac,.aac,.m4a,.opus', rule: 'MP3、WAV、M4A 等 · 单个不超过 50MB', glyph: 'mic' }
    };
    const ORDER = ['video', 'image', 'audio', 'voiceover'];
    const kindFromPath = (p) => ({ '/ai/materials/video': 'video', '/ai/materials/images': 'image', '/ai/materials/audio': 'audio', '/ai/materials/voiceover': 'voiceover' })[p] || '';
    const LABEL_COLORS = [['mint', '绿色', '#12A150'], ['blue', '蓝色', '#3B82F6'], ['amber', '橙色', '#E08A00'], ['rose', '粉色', '#E5487D']];
    const labelColor = (c) => (LABEL_COLORS.find((x) => x[0] === c) || LABEL_COLORS[0])[2];
    const isAudio = (k) => k === 'audio' || k === 'voiceover';

    /* same calling convention as workspace.js: tenant in the query, JSON body, session cookie */
    async function mw(action, params, body, signal) {
      const q = new URLSearchParams(params || {}); const t = UK.tenant(); if (t) q.set('tenant_id', t);
      let r;
      try { r = await fetch('/api/merchantWorkspace/' + action + '?' + q, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((x) => x.json()); }
      catch (e) { if (e.name === 'AbortError') throw e; throw new Error('网络连接失败，请重试'); }
      if (r.code !== 1) { if (r.code === -1) location.replace('/login' + (t ? '?tenant_id=' + t : '')); throw new Error(r.msg || '请求失败，请重试'); }
      return r.data;
    }

    function page(root) {
      const S = {
        kind: kindFromPath(UK.path()) || 'video', folder: '', page: 1, size: 24, total: 0, rows: [], selected: new Set(),
        keyword: '', label: '', usage: '', sort: 'recent', view: 'grid',
        folders: [], totalAll: 0, unfiled: 0, labels: [], counts: {}, trashCount: 0, collapsed: new Set(), seq: 0, mseq: 0, dead: false, meta: new Map()
      };
      try { const v = localStorage.getItem('uk-materials-view'); if (v === 'list' || v === 'grid') S.view = v; } catch (e) {}
      const T = () => TYPES[S.kind];

      /* ---------- skeleton ---------- */
      root.innerHTML = '<div class="uk-page mt">' +
        '<div class="uk-bar uk-pagehead"><h1 class="uk-grow">素材库</h1><div class="uk-actions" data-head></div></div>' +
        '<div data-tabs></div>' +
        '<div class="uk-card mt-body"><aside class="mt-folders" aria-label="文件夹"></aside>' +
        '<section class="mt-main"><div class="mt-tools"></div><div class="mt-chips" hidden></div><div class="mt-content"></div><div class="mt-pager"></div>' +
        '<div class="mt-drop" hidden><div>' + icon('upload') + '<b></b></div></div></section></div>' +
        '<input type="file" class="mt-file" multiple hidden></div>';
      const $ = (s) => root.querySelector(s);
      const fileInput = $('.mt-file');

      const tabOpt = { items: [], value: S.kind, tail: '', onChange: (k) => UK.go(TYPES[k].path) };
      const tabs = UK.tabs($('[data-tabs]'), tabOpt);
      function drawHead() {
        $('[data-head]').innerHTML = btn({ kind: 'secondary', size: 'lg', icon: 'folderOpen', label: '新建文件夹', attrs: { 'data-new-folder': '' } }) +
          btn({ kind: 'primary', size: 'lg', icon: 'upload', label: T().upload, attrs: { 'data-upload': '' } });
      }
      function drawTabs() {
        tabOpt.tail = '<button type="button" class="mt-trash-link" data-trash>' + icon('delete') + '<span>回收站</span>' + (S.trashCount ? '<span class="mt-trash-n num">' + fmt(S.trashCount) + '</span>' : '') + '</button>';
        tabs.set(ORDER.map((k) => ({ key: k, label: TYPES[k].label, count: S.counts[k] })), S.kind);
      }

      /* ---------- folders ---------- */
      const childrenOf = (pid) => S.folders.filter((f) => Number(f.parent_id) === pid).sort((a, b) => (Number(b.sort) || 0) - (Number(a.sort) || 0) || Number(a.id) - Number(b.id));
      function folderRow(id, name, count, depth, hasKids, open) {
        const on = String(S.folder) === String(id);
        return '<div class="mt-frow' + (on ? ' is-on' : '') + '" style="--d:' + depth + '" data-folder="' + esc(id) + '">' +
          (hasKids ? '<button type="button" class="mt-fexp" data-expand="' + esc(id) + '" aria-label="' + (open ? '收起' : '展开') + '" aria-expanded="' + open + '">' + icon('chevronRight') + '</button>' : '<span class="mt-fexp-sp"></span>') +
          '<button type="button" class="mt-flink" data-open-folder="' + esc(id) + '">' + icon(on ? 'folderOpen' : 'folder') + '<span class="mt-fname">' + esc(name) + '</span><span class="mt-fcount num">' + (S.ready ? fmt(count) : '') + '</span></button>' +
          (Number(id) > 0 ? '<button type="button" class="mt-fmore" data-folder-menu="' + esc(id) + '" aria-label="' + esc(name) + ' 的操作">' + icon('more') + '</button>' : '') + '</div>';
      }
      function drawFolders() {
        let html = '<div class="mt-fhead"><h3>文件夹</h3>' + btn({ kind: 'ghost', size: 'sm', icon: 'plus', iconOnly: true, label: '新建文件夹', attrs: { 'data-new-folder': '' } }) + '</div><div class="mt-flist" role="tree">';
        html += folderRow('', '全部' + T().label, S.totalAll, 0, false, false) + folderRow('0', '未分组', S.unfiled, 0, false, false);
        if (S.folders.length) html += '<div class="mt-fsep"></div>';
        const visit = (pid, depth) => childrenOf(pid).forEach((f) => {
          const id = Number(f.id), kids = childrenOf(id).length > 0, open = !S.collapsed.has(id);
          html += folderRow(id, f.name, f.count, depth, kids, open);
          if (kids && open) visit(id, depth + 1);
        });
        visit(0, 0);
        html += '</div>';
        $('.mt-folders').innerHTML = html;
      }
      const folderName = (id) => id === '' ? '全部' + T().label : String(id) === '0' ? '未分组' : (S.folders.find((f) => String(f.id) === String(id))?.name || '文件夹');
      function folderOptions(exclude) {
        const out = [{ id: 0, name: '未分组', depth: 0 }];
        const visit = (pid, depth) => childrenOf(pid).forEach((f) => { if (Number(f.id) === exclude) return; out.push({ id: Number(f.id), name: f.name, depth }); visit(Number(f.id), depth + 1); });
        visit(0, 0); return out;
      }

      /* ---------- toolbar ---------- */
      function drawTools() {
        if (composing) return;
        const old = root.querySelector('[data-keyword]'), focused = old && document.activeElement === old;
        const caret = focused ? [old.selectionStart, old.selectionEnd, old.value] : null;
        const lab = S.labels.find((l) => String(l.id) === S.label);
        $('.mt-tools').innerHTML =
          '<label class="uk-search mt-search">' + icon('search') + '<input class="uk-input" type="search" aria-label="搜索素材名称" placeholder="搜索' + esc(T().label) + '名称" maxlength="80" value="' + esc(S.keyword) + '" data-keyword></label>' +
          '<button type="button" class="uk-drop" data-drop="label" aria-haspopup="menu" aria-expanded="false">标签<b>' + esc(lab ? lab.name : '全部') + '</b>' + icon('chevronDown') + '</button>' +
          (isAudio(S.kind) ? '' : '<button type="button" class="uk-drop" data-drop="usage" aria-haspopup="menu" aria-expanded="false">种草卡<b>' + (S.usage === 'used' ? '已用过' : S.usage === 'unused' ? '未用过' : '全部') + '</b>' + icon('chevronDown') + '</button>') +
          '<span class="uk-grow"></span>' +
          '<button type="button" class="uk-drop mt-sort" data-drop="sort" aria-haspopup="menu" aria-expanded="false">' + icon('sort') + '<b>' + (S.sort === 'name' ? '按名称' : '最近上传') + '</b></button>' +
          (isAudio(S.kind) ? '' : '<div class="uk-seg is-icon" role="group" aria-label="显示方式"><button type="button" data-view="grid" aria-label="网格显示" aria-pressed="' + (S.view === 'grid') + '" data-tip="网格">' + icon('grid') + '</button><button type="button" data-view="list" aria-label="列表显示" aria-pressed="' + (S.view === 'list') + '" data-tip="列表">' + icon('listView') + '</button></div>');
        const chips = [];
        if (S.label) chips.push(['label', '标签：' + (lab ? lab.name : '')]);
        if (S.usage) chips.push(['usage', '种草卡：' + (S.usage === 'used' ? '已用过' : '未用过')]);
        if (S.keyword) chips.push(['keyword', '“' + S.keyword + '”']);
        const box = $('.mt-chips'); box.hidden = !chips.length;
        box.innerHTML = chips.map(([k, t]) => '<button type="button" class="uk-chip" aria-pressed="true" data-clear-one="' + k + '">' + esc(t) + icon('close', 'uk-i uk-x') + '</button>').join('') + (chips.length ? '<button type="button" class="uk-link" data-clear-all>清除筛选</button>' : '');
        if (caret) { const input = root.querySelector('[data-keyword]'); input.value = caret[2]; input.focus({ preventScroll: true }); input.setSelectionRange(caret[0], caret[1]); }
      }

      /* ---------- content ---------- */
      const fileOf = (r) => r.files && r.files[0];
      function metaText(r) {
        const m = S.meta.get(r.id) || {};
        const parts = [];
        if (m.w && m.h) parts.push(m.w + '×' + m.h);
        if (m.d) parts.push(dur(m.d));
        if (!parts.length) { const f = fileOf(r); const ext = f && /\.([a-z0-9]{2,5})(\?|$)/i.exec(f.name || f.url || ''); if (ext) parts.push(ext[1].toUpperCase()); }
        return parts.join(' · ');
      }
      function labelDots(r) {
        const names = (r.label_ids || []).map((id) => S.labels.find((l) => Number(l.id) === Number(id))).filter(Boolean).slice(0, 2);
        return names.map((l) => '<span class="mt-label"><i style="background:' + labelColor(l.color) + '"></i>' + esc(l.name) + '</span>').join('');
      }
      function card(r) {
        const f = fileOf(r), sel = S.selected.has(Number(r.id));
        const media = !f ? '<span class="uk-work-ph">' + icon(T().glyph) + '</span>'
          : S.kind === 'video' ? '<video src="' + esc(f.url) + '#t=0.1" muted preload="metadata" playsinline data-meta="' + r.id + '"></video>'
          : '<img src="' + esc(f.url) + '" alt="" loading="lazy" data-meta="' + r.id + '">';
        const m = S.meta.get(r.id) || {};
        return '<article class="mt-card' + (sel ? ' is-selected' : '') + '" data-id="' + r.id + '">' +
          '<div class="mt-thumb" data-preview="' + r.id + '" tabindex="0" role="button" aria-label="预览 ' + esc(r.name) + '">' + media +
            '<button type="button" class="uk-check mt-check" role="checkbox" aria-checked="' + sel + '" aria-label="选择 ' + esc(r.name) + '" data-pick="' + r.id + '">' + icon('check') + '</button>' +
            (S.kind === 'video' ? '<span class="uk-glass mt-dur">' + icon('play') + '<span class="num" data-dur="' + r.id + '">' + (m.d ? dur(m.d) : '视频') + '</span></span>' : '') +
            '<span class="mt-acts"><button type="button" data-row-menu="' + r.id + '" aria-label="更多操作" data-tip="更多">' + icon('more') + '</button></span>' +
          '</div>' +
          '<div class="mt-cap"><b title="' + esc(r.name) + '">' + esc(r.name) + '</b><span class="mt-meta"><span data-metatext="' + r.id + '">' + esc(metaText(r)) + '</span>' + (r.used ? '<span class="uk-status ok mt-used">用于种草卡</span>' : '') + '</span>' +
          (labelDots(r) ? '<span class="mt-labels">' + labelDots(r) + '</span>' : '') + '</div></article>';
      }
      function listRow(r) {
        const f = fileOf(r), sel = S.selected.has(Number(r.id)), audio = isAudio(S.kind);
        const thumb = audio ? '<button type="button" class="mt-play" data-play="' + r.id + '" aria-label="播放 ' + esc(r.name) + '">' + icon('play') + '</button>'
          : '<span class="mt-lthumb" data-preview="' + r.id + '">' + (!f ? icon(T().glyph) : S.kind === 'video' ? '<video src="' + esc(f.url) + '#t=0.1" muted preload="metadata" data-meta="' + r.id + '"></video>' : '<img src="' + esc(f.url) + '" alt="" loading="lazy" data-meta="' + r.id + '">') + '</span>';
        return '<tr class="' + (sel ? 'is-selected' : '') + '" data-id="' + r.id + '"><td class="mt-tcheck"><button type="button" class="uk-check" role="checkbox" aria-checked="' + sel + '" aria-label="选择 ' + esc(r.name) + '" data-pick="' + r.id + '">' + icon('check') + '</button></td>' +
          '<td><div class="uk-cell-main">' + thumb + '<span class="mt-lname"><b>' + esc(r.name) + '</b>' + (audio ? '<span class="mt-wave" data-wave="' + r.id + '"><i></i></span>' : r.used ? '<span class="uk-status ok mt-used">用于种草卡</span>' : '') + '</span></div>' + (audio && f ? '<audio src="' + esc(f.url) + '" preload="metadata" data-meta="' + r.id + '"></audio>' : '') + '</td>' +
          '<td class="mt-tmeta num" data-metatext="' + r.id + '">' + esc(metaText(r)) + '</td>' +
          '<td>' + (labelDots(r) || '<span class="uk-meta">—</span>') + '</td>' +
          '<td class="uk-meta">' + esc(folderName(String(r.folder_id || 0))) + '</td>' +
          '<td class="uk-meta num">' + esc(ago(r.create_time)) + '</td>' +
          '<td class="is-act">' + (audio ? '' : btn({ kind: 'ghost', size: 'sm', icon: 'eye', iconOnly: true, label: '预览', attrs: { 'data-preview': r.id } })) + btn({ kind: 'ghost', size: 'sm', icon: 'more', iconOnly: true, label: '更多操作', attrs: { 'data-row-menu': r.id } }) + '</td></tr>';
      }
      function drawContent() {
        const box = $('.mt-content');
        const filtered = S.keyword || S.label || S.usage;
        if (!S.rows.length) {
          box.className = 'mt-content';
          if (filtered) box.innerHTML = empty({ icon: 'search', title: '没有符合条件的' + T().label, actions: [{ kind: 'secondary', label: '清除筛选', attrs: { 'data-clear-all': '' } }] });
          else box.innerHTML = '<button type="button" class="mt-dropzone" data-upload>' +
            '<span class="mt-dz-art">' + icon(T().glyph) + '</span><b>' + (S.folder !== '' ? '「' + esc(folderName(S.folder)) + '」还没有' + T().label : '还没有' + T().label + '素材') + '</b>' +
            '<span class="mt-dz-hint">拖到这里，或<u>点击上传</u></span><span class="uk-meta">' + esc(T().rule) + '</span></button>';
          return;
        }
        if (isAudio(S.kind) || S.view === 'list') {
          box.className = 'mt-content is-list';
          box.innerHTML = '<div class="uk-table-wrap"><table class="uk-table mt-table"><thead><tr><th class="mt-tcheck"><button type="button" class="uk-check" role="checkbox" aria-checked="' + allState() + '" aria-label="全选本页" data-pick-all>' + icon('check') + '</button></th><th>名称</th><th>' + (isAudio(S.kind) ? '时长' : '尺寸 · 时长') + '</th><th>标签</th><th>文件夹</th><th>上传</th><th></th></tr></thead><tbody>' +
            S.rows.map(listRow).join('') + '</tbody></table></div>';
        } else {
          box.className = 'mt-content is-grid';
          box.innerHTML = '<div class="mt-grid">' + S.rows.map(card).join('') + '</div>';
          box.querySelectorAll('.mt-card').forEach((c, n) => c.style.setProperty('--i', n));
        }
        root.querySelectorAll('[data-meta]').forEach(hookMeta);
      }
      function hookMeta(el) {
        const id = Number(el.dataset.meta);
        const set = (m) => { const prev = S.meta.get(id) || {}; S.meta.set(id, { ...prev, ...m }); const r = S.rows.find((x) => Number(x.id) === id); if (!r) return; root.querySelectorAll('[data-metatext="' + id + '"]').forEach((t) => { t.textContent = metaText(r); }); const d = root.querySelector('[data-dur="' + id + '"]'); if (d && m.d) d.textContent = dur(m.d); };
        if (el.tagName === 'IMG') { const f = () => set({ w: el.naturalWidth, h: el.naturalHeight }); if (el.complete && el.naturalWidth) f(); else el.addEventListener('load', f, { once: true }); }
        else el.addEventListener('loadedmetadata', () => set({ w: el.videoWidth || 0, h: el.videoHeight || 0, d: el.duration && isFinite(el.duration) ? el.duration : 0 }), { once: true });
      }
      const allState = () => !S.rows.length || !S.selected.size ? 'false' : S.rows.every((r) => S.selected.has(Number(r.id))) ? 'true' : 'mixed';
      function drawPager() { $('.mt-pager').innerHTML = S.total > S.size ? UK.pager(S.total, S.page, S.size) : (S.total ? '<div class="uk-pager"><span class="uk-meta">共 <span class="num">' + fmt(S.total) + '</span> 项</span></div>' : ''); }
      function paintSelection() {
        root.querySelectorAll('[data-id]').forEach((el) => {
          const on = S.selected.has(Number(el.dataset.id)); el.classList.toggle('is-selected', on);
          const c = el.querySelector('[data-pick]'); if (c) c.setAttribute('aria-checked', String(on));
        });
        const all = root.querySelector('[data-pick-all]'); if (all) all.setAttribute('aria-checked', allState());
        root.querySelector('.mt-main').classList.toggle('uk-selecting', S.selected.size > 0);
        UK.batch(S.selected.size ? {
          count: S.selected.size,
          actions: [{ key: 'move', label: '移动到', icon: 'folder' }, { key: 'label', label: '设置标签', icon: 'tag' }, { key: 'download', label: '下载', icon: 'download' }, { key: 'trash', label: '移入回收站', icon: 'delete', danger: true }],
          onAction: (k) => { const ids = [...S.selected]; if (k === 'move') moveDialog(ids); else if (k === 'label') labelDialog(ids); else if (k === 'download') download(ids); else if (k === 'trash') trash(ids); },
          onClear: () => { S.selected.clear(); paintSelection(); }
        } : null);
      }

      /* ---------- data ---------- */
      async function loadMeta(signal) {
        const k = S.kind, seq = ++S.mseq;
        const data = await mw('materialMeta', { kind: k }, undefined, signal);
        if (S.dead || seq !== S.mseq || k !== S.kind) return;
        const folders = data.folders;
        S.ready = true; S.folders = folders.lists || []; S.totalAll = Number(folders.total) || 0; S.unfiled = Number(folders.unfiled) || 0;
        S.labels = data.labels || []; S.trashCount = Number(data.trash_count) || 0; S.counts = data.counts || {};
        drawTabs(); drawFolders(); drawTools();
        if (S.rows.length) { drawContent(); paintSelection(); } // labels / folder names arrived after the rows
      }
      function skeleton() {
        const box = $('.mt-content');
        if (isAudio(S.kind) || S.view === 'list') { box.className = 'mt-content is-list'; box.innerHTML = '<div class="mt-lskel">' + '<div><span class="uk-skel"></span><span class="uk-skel"></span><span class="uk-skel"></span></div>'.repeat(6) + '</div>'; }
        else { box.className = 'mt-content is-grid'; box.innerHTML = '<div class="mt-grid">' + '<div class="mt-skel"><span class="uk-skel"></span><span class="uk-skel"></span><span class="uk-skel"></span></div>'.repeat(8) + '</div>'; }
      }
      async function load(signal) {
        const seq = ++S.seq;
        if (!S.rows.length) skeleton();
        $('.mt-content').setAttribute('aria-busy', 'true');
        try {
          const d = await mw('library', { kind: S.kind, folder_id: S.folder, trash: '0', page: S.page, page_size: S.size, keyword: S.keyword, usage: isAudio(S.kind) ? '' : S.usage, label_id: S.label, sort: S.sort }, undefined, signal);
          if (S.dead || seq !== S.seq) return;
          if (d.count && S.page > Math.ceil(d.count / S.size)) { S.page = Math.ceil(d.count / S.size); return load(signal); }
          S.rows = d.lists || []; S.total = Number(d.count) || 0;
          S.selected = new Set([...S.selected].filter((id) => S.rows.some((r) => Number(r.id) === id)));
          drawContent(); drawPager(); paintSelection();
        } catch (e) { if (e.name !== 'AbortError' && !S.dead && seq === S.seq) { $('.mt-content').innerHTML = empty({ icon: 'alert', title: e.message, actions: [{ kind: 'secondary', label: '重新加载', attrs: { 'data-reload': '' } }] }); } }
        finally { if (!S.dead && seq === S.seq) $('.mt-content').removeAttribute('aria-busy'); }
      }
      let refreshController = null;
      const refresh = async () => { refreshController?.abort(); refreshController = new AbortController(); const signal = refreshController.signal; if (!S.rows.length) skeleton(); await Promise.all([loadMeta(signal).catch((e) => { if (e.name !== 'AbortError' && !S.dead) UK.toast(e.message, 'fail'); }), load(signal)]); };

      /* ---------- actions ---------- */
      async function batch(action, ids, patch, okText) {
        await mw('batch', {}, { kind: S.kind, action, ids, ...(patch || {}) });
        S.selected.clear(); UK.toast(okText); await refresh();
      }
      async function trash(ids) {
        try { await batch('trash', ids, null, ids.length > 1 ? ids.length + ' 项已移入回收站' : '已移入回收站'); } catch (e) { UK.toast(e.message, 'fail'); }
      }
      function download(ids) {
        const rows = S.rows.filter((r) => ids.includes(Number(r.id)) && fileOf(r));
        rows.forEach((r, i) => setTimeout(() => { const a = document.createElement('a'); a.href = fileOf(r).url; a.download = fileOf(r).name || r.name; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove(); }, i * 350));
        UK.toast('开始下载 ' + rows.length + ' 个文件');
      }
      function folderTree(chosen, exclude) {
        return '<div class="mt-pick" role="radiogroup">' + folderOptions(exclude).map((o) => '<label class="mt-pick-row" style="--d:' + o.depth + '"><input type="radio" name="folder" value="' + o.id + '"' + (String(o.id) === String(chosen) ? ' checked' : '') + '>' + icon(o.id ? 'folder' : 'inbox') + '<span>' + esc(o.name) + '</span>' + icon('check', 'uk-i mt-pick-tick') + '</label>').join('') + '</div>';
      }
      function moveDialog(ids) {
        UK.dialog({
          title: '移动 ' + ids.length + ' 项到', width: 420, body: folderTree(S.folder === '' ? 0 : S.folder),
          actions: [{ key: 'cancel', label: '取消' }, { key: 'ok', label: '移动', kind: 'primary' }],
          onAction: async (k, ctx) => {
            if (k !== 'ok') return;
            const v = ctx.body.querySelector('input[name=folder]:checked')?.value ?? '0';
            ctx.busy('ok', true);
            try { await batch('move', ids, { folder_id: v }, '已移动到「' + folderName(String(v)) + '」'); } catch (e) { ctx.busy('ok', false); UK.toast(e.message, 'fail'); return false; }
          }
        });
      }
      const SUGGEST = ['门头', '菜品', '环境', '人物', '活动', '产品'];
      const suggestRow = () => { const left = SUGGEST.filter((n) => !S.labels.some((l) => l.name === n)); return left.length && S.labels.length < 3 ? '<div class="mt-suggest"><span class="uk-meta">常用</span>' + left.map((n) => '<button type="button" class="mt-suggest-chip" data-suggest="' + esc(n) + '">' + icon('plus') + esc(n) + '</button>').join('') + '</div>' : ''; };
      function labelPicker(chosen) {
        return '<div class="mt-labelpick">' + (S.labels.length ? S.labels.map((l) => '<label class="mt-lp-row"><input type="checkbox" value="' + l.id + '"' + (chosen.includes(Number(l.id)) ? ' checked' : '') + '><i style="background:' + labelColor(l.color) + '"></i><span>' + esc(l.name) + '</span>' + icon('check', 'uk-i mt-pick-tick') + '</label>').join('') : '<p class="mt-lp-empty">标签可以跨文件夹归类素材，筛选时一点就出来</p>') +
          '</div><div class="mt-lp-new"><input class="uk-input" placeholder="新建标签，回车添加" maxlength="30" data-new-label>' + suggestRow() + '</div>';
      }
      async function createLabel(name) {
        await mw('labelSave', {}, { name, color: LABEL_COLORS[S.labels.length % 4][0], id: 0 });
        S.labels = await mw('labels'); drawTools();
        return S.labels.find((l) => l.name === name);
      }
      /* label picker inside a dialog: Enter or a suggestion creates the label and ticks it */
      function bindNewLabel(ctx, chosenGetter) {
        const add = async (name) => {
          name = name.trim(); if (!name) return;
          const existing = S.labels.find((l) => l.name === name);
          try {
            const keep = chosenGetter(); const l = existing || await createLabel(name);
            if (l && !keep.includes(Number(l.id))) keep.push(Number(l.id));
            const field = ctx.body.querySelector('.mt-labelpick').parentElement;
            ctx.body.querySelector('.mt-labelpick').remove(); ctx.body.querySelector('.mt-lp-new').remove();
            field.insertAdjacentHTML('beforeend', labelPicker(keep)); wire();
            ctx.body.querySelector('[data-new-label]').focus();
          } catch (err) { UK.toast(err.message, 'fail'); }
        };
        const wire = () => {
          const input = ctx.body.querySelector('[data-new-label]');
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(input.value); } });
          ctx.body.querySelectorAll('[data-suggest]').forEach((b) => b.addEventListener('click', () => add(b.dataset.suggest)));
        };
        wire();
      }
      function labelDialog(ids, chosen) {
        const pre = chosen || (ids.length === 1 ? (S.rows.find((r) => Number(r.id) === ids[0])?.label_ids || []).map(Number) : []);
        const read = (ctx) => [...ctx.body.querySelectorAll('.mt-labelpick input:checked')].map((i) => Number(i.value));
        const ctx = UK.dialog({
          title: '设置标签', width: 420, body: labelPicker(pre),
          footLeft: '<span class="uk-meta">' + (ids.length > 1 ? '会替换这 ' + ids.length + ' 项原有的标签' : '') + '</span>',
          actions: [{ key: 'cancel', label: '取消' }, { key: 'ok', label: '保存', kind: 'primary' }],
          onAction: async (k, c) => {
            if (k !== 'ok') return;
            c.busy('ok', true);
            try { await batch('label', ids, { label_ids: read(c) }, '标签已更新'); } catch (e) { c.busy('ok', false); UK.toast(e.message, 'fail'); return false; }
          }
        });
        bindNewLabel(ctx, () => read(ctx));
      }
      function labelManager() {
        const draw = () => '<div class="mt-lm">' + (S.labels.length ? S.labels.map((l) => '<div class="mt-lm-row" data-label-row="' + l.id + '"><i style="background:' + labelColor(l.color) + '"></i><input class="uk-input" value="' + esc(l.name) + '" maxlength="30" data-label-name>' +
          '<div class="mt-lm-colors">' + LABEL_COLORS.map(([c, n, hex]) => '<button type="button" class="mt-swatch' + (c === (l.color || 'mint') ? ' is-on' : '') + '" style="--c:' + hex + '" data-label-color="' + c + '" aria-label="' + n + '"></button>').join('') + '</div>' +
          btn({ kind: 'ghost', size: 'sm', icon: 'delete', iconOnly: true, label: '删除标签', attrs: { 'data-label-del': l.id } }) + '</div>').join('') : '<p class="mt-lp-empty">标签可以跨文件夹归类素材，筛选时一点就出来</p>') + '</div><div class="mt-lp-new"><input class="uk-input" placeholder="新建标签，回车添加" maxlength="30" data-new-label>' + suggestRow() + '</div>';
        const ctx = UK.dialog({ title: '管理标签', width: 520, body: draw(), actions: [{ key: 'done', label: '完成', kind: 'primary' }] });
        const rerender = async () => { S.labels = await mw('labels'); ctx.body.innerHTML = draw(); wire(); drawTools(); drawContent(); };
        const wire = () => {
          ctx.body.querySelectorAll('[data-label-row]').forEach((row) => {
            const id = Number(row.dataset.labelRow), l = S.labels.find((x) => Number(x.id) === id);
            const save = async (patch) => { try { await mw('labelSave', {}, { id, name: l.name, color: l.color || 'mint', ...patch }); await rerender(); } catch (e) { UK.toast(e.message, 'fail'); } };
            row.querySelector('[data-label-name]').addEventListener('change', (e) => { const v = e.target.value.trim(); if (v && v !== l.name) save({ name: v }); });
            row.querySelectorAll('[data-label-color]').forEach((b) => b.addEventListener('click', () => save({ color: b.dataset.labelColor })));
            row.querySelector('[data-label-del]').addEventListener('click', async () => {
              if (!(await UK.confirm({ title: '删除标签「' + l.name + '」？', text: '素材本身不会被删除，只是不再带这个标签。', okText: '删除', danger: true }))) return;
              try { await mw('labelRemove', {}, { id }); await rerender(); UK.toast('标签已删除'); } catch (e) { UK.toast(e.message, 'fail'); }
            });
          });
          const input = ctx.body.querySelector('[data-new-label]');
          const add = async (name) => { name = name.trim(); if (!name || S.labels.some((l) => l.name === name)) return; try { await createLabel(name); await rerender(); ctx.body.querySelector('[data-new-label]').focus(); } catch (err) { UK.toast(err.message, 'fail'); } };
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(input.value); } });
          ctx.body.querySelectorAll('[data-suggest]').forEach((b) => b.addEventListener('click', () => add(b.dataset.suggest)));
        };
        wire();
      }
      function folderDialog(folder, parentId) {
        const editing = !!folder;
        const ctx = UK.dialog({
          title: editing ? '重命名文件夹' : '新建文件夹', width: 420,
          body: '<div class="uk-field"><label>名称</label><input class="uk-input" maxlength="60" value="' + esc(folder ? folder.name : '') + '" data-fname autofocus></div>' +
            (editing ? '' : '<div class="uk-field mt-gap"><label>放在</label><select class="uk-select" data-fparent><option value="0">最外层</option>' + folderOptions().slice(1).map((o) => '<option value="' + o.id + '"' + (String(o.id) === String(parentId || 0) ? ' selected' : '') + '>' + '　'.repeat(o.depth) + esc(o.name) + '</option>').join('') + '</select></div>'),
          actions: [{ key: 'cancel', label: '取消' }, { key: 'ok', label: editing ? '保存' : '创建', kind: 'primary' }],
          onAction: async (k, c) => {
            if (k !== 'ok') return;
            const name = c.body.querySelector('[data-fname]').value.trim(); if (!name) { c.body.querySelector('[data-fname]').focus(); return false; }
            c.busy('ok', true);
            try {
              await mw('folderSave', {}, { id: editing ? folder.id : 0, kind: S.kind, name, parent_id: editing ? folder.parent_id : (c.body.querySelector('[data-fparent]')?.value || 0), sort: editing ? folder.sort || 0 : 0 });
              UK.toast(editing ? '已重命名' : '文件夹已创建'); await loadMeta();
            } catch (e) { c.busy('ok', false); UK.toast(e.message, 'fail'); return false; }
          }
        });
        ctx.body.querySelector('[data-fname]').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ctx.el.querySelector('[data-act=ok]').click(); } });
      }
      async function reorder(id, dir) {
        const FS = window.MerchantFolderSort; const f = S.folders.find((x) => Number(x.id) === id); if (!f || !FS) return;
        const sibs = childrenOf(Number(f.parent_id)), i = sibs.findIndex((x) => Number(x.id) === id), j = i + dir;
        if (j < 0 || j >= sibs.length) return;
        // ranks: siblings swap places; every folder keeps its tree position otherwise
        const order = []; const visit = (pid) => { const kids = childrenOf(pid).map((x) => Number(x.id)); if (pid === Number(f.parent_id)) { [kids[i], kids[j]] = [kids[j], kids[i]]; } kids.forEach((k) => { order.push(k); visit(k); }); };
        visit(0);
        try { await mw('folderReorder', {}, { kind: S.kind, ids: order }); const rank = new Map(order.map((x, n) => [x, order.length - n])); S.folders.forEach((x) => { x.sort = rank.get(Number(x.id)); }); drawFolders(); }
        catch (e) { UK.toast(e.message, 'fail'); }
      }
      async function removeFolder(f) {
        if (Number(f.count) > 0 || childrenOf(Number(f.id)).length) { UK.toast('文件夹里还有内容，清空后才能删除', 'info'); return; }
        try {
          await mw('folderRecycle', {}, { id: f.id, kind: S.kind, restore: '0' });
          if (String(S.folder) === String(f.id)) S.folder = '';
          await refresh();
          UK.toast('已删除「' + f.name + '」');
        } catch (e) { UK.toast(e.message, 'fail'); }
      }
      function folderMenu(anchor, id) {
        const f = S.folders.find((x) => Number(x.id) === Number(id)); if (!f) return;
        const sibs = childrenOf(Number(f.parent_id)), i = sibs.findIndex((x) => Number(x.id) === Number(id));
        const empty_ = !(Number(f.count) > 0) && !childrenOf(Number(f.id)).length;
        UK.menu(anchor, [
          { key: 'sub', label: '新建子文件夹', icon: 'folderOpen' }, { key: 'rename', label: '重命名', icon: 'edit' }, '-',
          { key: 'up', label: '上移', icon: 'chevronUp', disabled: i <= 0 }, { key: 'down', label: '下移', icon: 'chevronDown', disabled: i >= sibs.length - 1 }, '-',
          { key: 'del', label: '删除文件夹', icon: 'delete', danger: true, disabled: !empty_, meta: empty_ ? '' : '需先清空' }
        ], (k) => { if (k === 'sub') folderDialog(null, f.id); else if (k === 'rename') folderDialog(f); else if (k === 'up') reorder(Number(f.id), -1); else if (k === 'down') reorder(Number(f.id), 1); else if (k === 'del') removeFolder(f); }, { align: 'right' });
      }
      async function editDialog(r) {
        const ctx = UK.dialog({
          title: '编辑资料', width: 520,
          body: '<div class="mt-form"><div class="uk-field"><label>名称</label><input class="uk-input" maxlength="100" value="' + esc(r.name) + '" data-ename autofocus></div>' +
            '<div class="mt-form-2"><div class="uk-field"><label>文件夹</label><select class="uk-select" data-efolder>' + folderOptions().map((o) => '<option value="' + o.id + '"' + (String(o.id) === String(r.folder_id || 0) ? ' selected' : '') + '>' + '　'.repeat(o.depth) + esc(o.name) + '</option>').join('') + '</select></div>' +
            '<div class="uk-field"><label>关联门店</label><select class="uk-select" data-estore><option value="0">通用（所有门店可用）</option>' + (r.store_id ? '<option value="' + r.store_id + '" selected>门店 #' + r.store_id + '</option>' : '') + '</select></div></div>' +
            '<div class="uk-field"><label>关键词</label><input class="uk-input" maxlength="255" placeholder="用空格分隔，方便搜索" value="' + esc(r.tags || '') + '" data-etags></div>' +
            '<div class="uk-field"><label>标签</label>' + labelPicker((r.label_ids || []).map(Number)) + '</div></div>',
          actions: [{ key: 'cancel', label: '取消' }, { key: 'ok', label: '保存', kind: 'primary' }],
          onAction: async (k, c) => {
            if (k !== 'ok') return;
            const name = c.body.querySelector('[data-ename]').value.trim(); if (!name) { c.body.querySelector('[data-ename]').focus(); return false; }
            c.busy('ok', true);
            try {
              await mw('materialSave', {}, { id: r.id, kind: S.kind, name, folder_id: c.body.querySelector('[data-efolder]').value, tags: c.body.querySelector('[data-etags]').value.trim(), content: r.content || '', file_ids: r.file_ids || (r.files || []).map((x) => x.id), store_id: c.body.querySelector('[data-estore]').value, label_ids: [...c.body.querySelectorAll('.mt-labelpick input:checked')].map((i) => Number(i.value)) });
              UK.toast('已保存'); await refresh();
            } catch (e) { c.busy('ok', false); UK.toast(e.message, 'fail'); return false; }
          }
        });
        bindNewLabel(ctx, () => [...ctx.body.querySelectorAll('.mt-labelpick input:checked')].map((i) => Number(i.value)));
        try {
          const stores = await mw('choices', { kind: 'store', keyword: '' });
          const sel = ctx.body.querySelector('[data-estore]'); if (!sel) return;
          const cur = String(r.store_id || 0);
          sel.innerHTML = '<option value="0">通用（所有门店可用）</option>' + (stores || []).map((s) => '<option value="' + s.id + '">' + esc(s.name) + '</option>').join('') + (cur !== '0' && !(stores || []).some((s) => String(s.id) === cur) ? '<option value="' + cur + '">门店 #' + cur + '</option>' : '');
          sel.value = cur;
        } catch (e) {}
      }
      function rowMenu(anchor, id) {
        const r = S.rows.find((x) => Number(x.id) === Number(id)); if (!r) return;
        UK.menu(anchor, [
          ...(isAudio(S.kind) ? [] : [{ key: 'preview', label: '预览', icon: 'eye' }]),
          { key: 'edit', label: '编辑资料', icon: 'edit' }, { key: 'move', label: '移动到…', icon: 'folder' }, { key: 'label', label: '设置标签', icon: 'tag' }, { key: 'download', label: '下载', icon: 'download' }, '-',
          { key: 'trash', label: '移入回收站', icon: 'delete', danger: true }
        ], (k) => {
          const ids = [Number(r.id)];
          if (k === 'preview') preview(r.id); else if (k === 'edit') editDialog(r); else if (k === 'move') moveDialog(ids); else if (k === 'label') labelDialog(ids); else if (k === 'download') download(ids); else if (k === 'trash') trash(ids);
        }, { align: 'right' });
      }
      function preview(id) {
        const rows = S.rows.filter((r) => fileOf(r));
        const items = rows.map((r) => ({ id: r.id, kind: S.kind === 'video' ? 'video' : isAudio(S.kind) ? 'audio' : 'image', url: fileOf(r).url, title: r.name, meta: [metaText(r), folderName(String(r.folder_id || 0)), (r.label_ids || []).length ? (r.label_ids || []).map((x) => S.labels.find((l) => Number(l.id) === Number(x))?.name).filter(Boolean).join('、') : '', '上传于 ' + ago(r.create_time)] }));
        const idx = Math.max(0, rows.findIndex((r) => Number(r.id) === Number(id)));
        UK.lightbox({
          items, index: idx,
          actions: [{ key: 'download', label: '下载', icon: 'download' }, { key: 'edit', label: '编辑资料', icon: 'edit' }, { key: 'trash', label: '移入回收站', icon: 'delete', danger: true }],
          onAction: async (k, it, i, lb) => {
            const r = rows[i];
            if (k === 'download') download([Number(r.id)]);
            else if (k === 'edit') { lb.close(); editDialog(r); }
            else if (k === 'trash') { lb.close(); trash([Number(r.id)]); }
          }
        });
      }
      async function trashDrawer() {
        const ctx = UK.dialog({ drawer: true, width: 460, title: '回收站 · ' + T().label, body: '<div class="mt-trash">' + UK.skel('100%', 56, 12) + '</div>' });
        const draw = async () => {
          let d; try { d = await mw('library', { kind: S.kind, folder_id: '', trash: '1', page: 1, page_size: 100 }); } catch (e) { ctx.body.innerHTML = '<p class="uk-meta">' + esc(e.message) + '</p>'; return; }
          const rows = d.lists || [];
          ctx.body.innerHTML = rows.length ? '<div class="mt-trash-head"><span class="uk-meta">' + rows.length + ' 项 · 可随时恢复</span>' + btn({ kind: 'secondary', size: 'sm', icon: 'restore', label: '全部恢复', attrs: { 'data-restore-all': '' } }) + '</div><div class="mt-trash-list">' +
            rows.map((r) => { const f = fileOf(r); return '<div class="mt-trash-row"><span class="mt-trash-thumb">' + (f && S.kind === 'image' ? '<img src="' + esc(f.url) + '" alt="">' : f && S.kind === 'video' ? '<video src="' + esc(f.url) + '#t=0.1" muted preload="metadata"></video>' : icon(T().glyph)) + '</span><span class="mt-trash-copy"><b>' + esc(r.name) + '</b><span class="uk-meta">删除于 ' + esc(ago(r.delete_time || r.update_time)) + '</span></span>' + btn({ kind: 'ghost', size: 'sm', label: '恢复', attrs: { 'data-restore': r.id } }) + '</div>'; }).join('') + '</div>'
            : UK.empty({ icon: 'delete', title: '回收站是空的', compact: true });
          ctx.body.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', async () => { b.classList.add('is-busy'); try { await mw('batch', {}, { kind: S.kind, action: 'restore', ids: [Number(b.dataset.restore)] }); UK.toast('已恢复'); await refresh(); await draw(); } catch (e) { UK.toast(e.message, 'fail'); b.classList.remove('is-busy'); } }));
          ctx.body.querySelector('[data-restore-all]')?.addEventListener('click', async (e) => { e.currentTarget.classList.add('is-busy'); try { await mw('batch', {}, { kind: S.kind, action: 'restore', ids: rows.map((r) => Number(r.id)) }); UK.toast('已全部恢复'); await refresh(); await draw(); } catch (err) { UK.toast(err.message, 'fail'); } });
        };
        draw();
      }
      function startUpload(files) {
        files = [...files].filter(Boolean); if (!files.length) return;
        const exts = T().accept.split(',');
        const typed = files.filter((f) => exts.some((x) => f.name.toLowerCase().endsWith(x)));
        const ok = typed.filter((f) => f.size <= T().max * 1048576);
        if (typed.length < files.length) UK.toast((files.length - typed.length) + ' 个文件格式不支持，已跳过', 'info');
        if (ok.length < typed.length) UK.toast((typed.length - ok.length) + ' 个文件超过 ' + T().max + 'MB，已跳过', 'info');
        if (!ok.length) return;
        const kind = S.kind, folder = S.folder === '' ? 0 : Number(S.folder);
        UK.upload(ok.slice(0, 50), { url: '/api/merchantWorkspace/upload', fields: { kind, folder_id: String(folder) }, onDone: (n, fail) => { if (!S.dead && S.kind === kind) { S.page = 1; refresh(); } if (n) UK.toast('已上传 ' + n + ' ' + TYPES[kind].unit + TYPES[kind].label + (fail ? '，' + fail + ' 个失败' : '')); } });
        if (ok.length > 50) UK.toast('一次最多上传 50 个，其余请稍后再传', 'info');
      }

      /* ---------- events ---------- */
      let kwTimer = 0, composing = false;
      function searchInput(e) {
        if (!e.target.matches('[data-keyword]') || composing || e.isComposing) return;
        clearTimeout(kwTimer);
        kwTimer = setTimeout(() => { if (S.dead) return; S.keyword = e.target.value.trim(); S.page = 1; S.selected.clear(); drawTools(); load(); }, 350);
      }
      root.addEventListener('input', searchInput);
      root.addEventListener('compositionstart', e => { if (e.target.matches('[data-keyword]')) { composing = true; clearTimeout(kwTimer); } });
      root.addEventListener('compositionend', e => { if (e.target.matches('[data-keyword]')) { composing = false; searchInput(e); } });
      root.addEventListener('click', (e) => {
        const t = e.target;
        if (t.closest('[data-upload]')) { fileInput.accept = T().accept; fileInput.click(); return; }
        if (t.closest('[data-new-folder]')) return folderDialog(null, S.folder && S.folder !== '0' ? S.folder : 0);
        if (t.closest('[data-trash]')) return trashDrawer();
        if (t.closest('[data-reload]')) return refresh();
        const exp = t.closest('[data-expand]'); if (exp) { const id = Number(exp.dataset.expand); S.collapsed.has(id) ? S.collapsed.delete(id) : S.collapsed.add(id); drawFolders(); return; }
        const fm = t.closest('[data-folder-menu]'); if (fm) return folderMenu(fm, fm.dataset.folderMenu);
        const fo = t.closest('[data-open-folder]'); if (fo) { S.folder = fo.dataset.openFolder; S.page = 1; S.selected.clear(); S.rows = []; drawFolders(); load(); return; }
        const dr = t.closest('[data-drop]');
        if (dr) {
          const k = dr.dataset.drop;
          if (k === 'label') UK.menu(dr, [{ key: '', label: '全部标签', checked: !S.label }, ...S.labels.map((l) => ({ key: String(l.id), label: l.name, checked: S.label === String(l.id) })), '-', { key: '__manage', label: '管理标签…', icon: 'setting' }], (v) => { if (v === '__manage') return labelManager(); S.label = v; S.page = 1; S.selected.clear(); drawTools(); load(); });
          if (k === 'usage') UK.menu(dr, [{ key: '', label: '全部', checked: !S.usage }, { key: 'unused', label: '未用过', checked: S.usage === 'unused' }, { key: 'used', label: '已用过', checked: S.usage === 'used' }], (v) => { S.usage = v; S.page = 1; S.selected.clear(); drawTools(); load(); });
          if (k === 'sort') UK.menu(dr, [{ key: 'recent', label: '最近上传', checked: S.sort === 'recent' }, { key: 'name', label: '按名称', checked: S.sort === 'name' }], (v) => { S.sort = v; S.page = 1; drawTools(); load(); }, { align: 'right' });
          return;
        }
        const vw = t.closest('[data-view]'); if (vw) { S.view = vw.dataset.view; try { localStorage.setItem('uk-materials-view', S.view); } catch (err) {} drawTools(); drawContent(); paintSelection(); return; }
        const c1 = t.closest('[data-clear-one]'); if (c1) { S[c1.dataset.clearOne] = ''; S.page = 1; drawTools(); load(); return; }
        if (t.closest('[data-clear-all]')) { S.keyword = S.label = S.usage = ''; S.page = 1; drawTools(); load(); return; }
        const pg = t.closest('[data-page]'); if (pg && !pg.disabled) { S.page = Number(pg.dataset.page); S.selected.clear(); load(); root.querySelector('.mt-main').scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
        const pa = t.closest('[data-pick-all]'); if (pa) { const all = allState() === 'true'; S.rows.forEach((r) => all ? S.selected.delete(Number(r.id)) : S.selected.add(Number(r.id))); paintSelection(); return; }
        const pk = t.closest('[data-pick]'); if (pk) { e.stopPropagation(); const id = Number(pk.dataset.pick); S.selected.has(id) ? S.selected.delete(id) : S.selected.add(id); paintSelection(); return; }
        const rm = t.closest('[data-row-menu]'); if (rm) { e.stopPropagation(); return rowMenu(rm, rm.dataset.rowMenu); }
        const pl = t.closest('[data-play]'); if (pl) return togglePlay(Number(pl.dataset.play), pl);
        const pv = t.closest('[data-preview]');
        if (pv) {
          // in selection mode a click on a card toggles it — like Finder with ⌘ held
          if (S.selected.size && pv.closest('.mt-card')) { const id = Number(pv.dataset.preview); S.selected.has(id) ? S.selected.delete(id) : S.selected.add(id); paintSelection(); return; }
          return preview(pv.dataset.preview);
        }
      });
      root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.mt-thumb')) { e.preventDefault(); preview(e.target.dataset.preview); } });
      fileInput.addEventListener('change', () => { startUpload(fileInput.files); fileInput.value = ''; });
      // inline audio player (one at a time)
      let playing = null;
      function togglePlay(id, b) {
        const a = root.querySelector('audio[data-meta="' + id + '"]'); if (!a) return;
        if (playing && playing !== a) { playing.pause(); }
        if (a.paused) { a.play().catch(() => {}); playing = a; } else a.pause();
        const sync = () => { root.querySelectorAll('[data-play]').forEach((x) => { const au = root.querySelector('audio[data-meta="' + x.dataset.play + '"]'); const on = au && !au.paused; x.classList.toggle('is-on', on); x.innerHTML = icon(on ? 'pause' : 'play'); }); };
        a.onplay = a.onpause = a.onended = sync;
        a.ontimeupdate = () => { const w = root.querySelector('[data-wave="' + id + '"] i'); if (w && a.duration) w.style.width = (a.currentTime / a.duration * 100) + '%'; };
        sync();
      }
      // whole-page drag & drop
      let dragDepth = 0;
      const dropEl = $('.mt-drop');
      const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
      root.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; dropEl.hidden = false; dropEl.querySelector('b').textContent = '松开上传到「' + folderName(S.folder) + '」'; });
      root.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
      root.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dropEl.hidden = true; });
      root.addEventListener('drop', (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; dropEl.hidden = true; startUpload(e.dataTransfer.files); });

      /* ---------- kind switching keeps the shell ---------- */
      function setKind(k) {
        if (!TYPES[k] || k === S.kind) return;
        if (playing) playing.pause();
        clearTimeout(kwTimer); composing = false;
        Object.assign(S, { ready: false, kind: k, folder: '', page: 1, rows: [], total: 0, selected: new Set(), keyword: '', label: '', usage: '', folders: [], collapsed: new Set() });
        drawHead(); drawTabs(); drawFolders(); drawTools(); drawPager(); paintSelection(); refresh();
      }
      root._setKind = setKind;
      root._cleanup = () => { S.dead = true; ++S.seq; ++S.mseq; refreshController?.abort(); clearTimeout(kwTimer); UK.batch(null); if (playing) playing.pause(); };

      drawHead(); drawTabs(); drawFolders(); drawTools(); refresh();
    }

    UK.page({
      key: 'materials', own: true, inPlace: true,
      match: (p) => !!kindFromPath(p),
      mount: page,
      update(root) { const k = kindFromPath(UK.path()); if (k && root._setKind) root._setKind(k); },
      unmount(root) { root._cleanup && root._cleanup(); }
    });
  };
  if (window.UK) boot(); else document.addEventListener('uk:ready', boot, { once: true });
})();
