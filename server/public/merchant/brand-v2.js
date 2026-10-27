/* Merchant UI v2 — 品牌与门店 (/ai/stores), built on ui-kit.js.
   What the merchant does here: keep each brand's profile and knowledge (GEO writes from it), and keep its
   stores and staff (seed cards and staff tasks use them). The brand card is the lead.
   - List:   /ai/stores                    brand cards        (?view=stores: every store across brands)
   - Brand:  /ai/stores?brand_id=ID&tab=   资料 / 知识库 / 门店 / 员工 / 装修   (&store_id= opens a store)
   - Legacy: #knowledge #stores #overview map onto tabs; #content / #statistics now live in GEO.
   APIs are the existing ones (merchantWorkspace brand… and store… actions, merchantGeo workspaceRecords/contentSave/options/
   generate/jobs, merchantPublishing/staff for WeChat binding). brand-directory.js / store-directory.js stay
   loaded but stand down through UK_OWNS; the store decoration editor (storefront-designer.js) is reused as is. */
(() => {
  'use strict';
  const boot = () => {
    const UK = window.UK; if (!UK) return;
    const { esc, icon, fmt, ago, btn, empty, status } = UK;
    const DAY = 86400;
    const nowS = () => Math.floor(Date.now() / 1000);

    /* ---------- api: tenant in the query, token + cookie, tolerant of PHP notices ahead of the JSON ---------- */
    const token = () => { const m = document.cookie.match(/(?:^|; )token=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; };
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
    const ws = (a, p, b) => call('merchantWorkspace', a, p, b);
    const geo = (brand, a, p, b) => call('merchantGeo', a, { ...(p || {}), brand_id: brand }, b);
    const pubStaff = () => call('merchantPublishing', 'staff').then((d) => d.lists || []).catch(() => null);
    async function upload(file, kind) {
      const fd = new FormData(); fd.append('file', file); fd.append('kind', kind || 'image'); fd.append('attach_only', '1');
      const t = UK.tenant(); let txt;
      try { txt = await fetch('/api/merchantWorkspace/storeLogo' + (t ? '?tenant_id=' + t : ''), { method: 'POST', credentials: 'same-origin', headers: { token: token() }, body: fd }).then((r) => r.text()); }
      catch (e) { throw new Error('网络连接失败，请重试'); }
      let r = null; try { r = JSON.parse(txt); } catch (e) { const k = txt.indexOf('{"code"'); if (k >= 0) try { r = JSON.parse(txt.slice(k)); } catch (e2) {} }
      if (!r || r.code !== 1) throw new Error((r && r.msg) || '上传失败，请重试');
      return r.data.file;
    }
    /* all pages of a paged list */
    async function all(fn, size) {
      let page = 1, out = [], count = 0;
      do { const d = await fn(page, size); out = out.concat(d.lists || []); count = Number(d.count) || 0; page++; if (!(d.lists || []).length) break; } while (out.length < count && page < 40);
      return out;
    }
    const storesOf = (brand, trash) => all((page, size) => ws('storeLists', { brand_id: brand || '', trash: trash ? '1' : '', page, page_size: size }), 50);
    const brandsAll = (trash) => all((page, size) => ws('brandLists', { keyword: '', trash: trash ? '1' : '0', page, page_size: size }), 48);

    /* ---------- facts ---------- */
    const FIELDS = [['brand_name', '品牌名称'], ['industry', '所属行业'], ['website', '官方网站'], ['intro', '企业介绍'], ['products', '产品与服务'], ['customers', '目标客户与地区'], ['competitors', '竞品与差异事实']];
    const LONG = [['intro', '企业介绍', 10000, '品牌定位、创立故事、特色与口碑——写真实可核查的事实，GEO 写稿只会引用这里的内容。'], ['products', '产品与服务', 10000, '主推产品、价格区间、服务项目、季节限定。'], ['customers', '目标客户与地区', 5000, '主要顾客是谁、来自哪里、什么场景到店。'], ['competitors', '竞品与差异事实', 5000, '附近同类店是谁，你们有哪些可以证明的不同。']];
    const CATS = ['品牌介绍', '产品资料', '门店信息', '营销活动', '服务标准', '常见问题', '客户与市场', '竞品与差异'];
    const filled = (v) => String(v ?? '').trim() !== '';
    const isUrl = (v) => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) && !!u.hostname && !u.username && !u.password; } catch (e) { return false; } };
    function normalizeWebsite(value) {
      const trim = (text) => text.replace(/^[\s\u200B\u2060\uFEFF]+|[\s\u200B\u2060\uFEFF]+$/g, '');
      let url = trim(String(value || '')); if (!url) return '';
      url = url.replace(/^(https?)[\s\u200B\u2060\uFEFF]*:[\s\u200B\u2060\uFEFF]*\/[\s\u200B\u2060\uFEFF]*\/[\s\u200B\u2060\uFEFF]*/i, (_, scheme) => scheme.toLowerCase() + '://');
      if (url.startsWith('//')) url = 'https:' + url;
      else if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
      // Browsers ignore these formatting characters in hosts; PHP validation does not.
      url = url.replace(/^(https?:\/\/)([^/?#]*)/i, (_, scheme, host) => scheme.toLowerCase() + trim(host.replace(/[\u200B\u2060\uFEFF]/g, '')));
      if (/[\s\\\u200B\u2060\uFEFF]/.test(url) || !isUrl(url)) throw new Error('官方网站格式不正确，请填写完整域名，例如 example.com');
      return url;
    }
    function wireWebsite(box) {
      const el = box.querySelector('[name=website]'); if (!el) return;
      el.setAttribute('inputmode', 'url'); el.setAttribute('autocomplete', 'url'); el.setAttribute('spellcheck', 'false');
      const clean = () => { try { el.value = normalizeWebsite(el.value); } catch (_) { /* Keep invalid input for correction; submit shows the error. */ } };
      clean(); el.addEventListener('blur', clean);
    }
    function cleanPhone(value) {
      return String(value ?? '').replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xFF10)).replace(/[＋（）－–—\u00A0\u3000]/g, c => ({'＋':'+','（':'(','）':')','－':'-','–':'-','—':'-','\u00A0':' ','\u3000':' '})[c]).trim();
    }
    const PHONE_ERROR = '请填写有效联系电话：11位手机号、座机或客服电话；国际号码请以 + 开头';
    function phoneBase(value) {
      if (!/^\+?[0-9(][0-9() -]*[0-9)]$/.test(value) || value.includes('--') || !/^[^()]*(?:\([0-9]{2,5}\)[^()]*)?$/.test(value)) return false;
      let digits = value.replace(/[ ()-]/g, '');
      if (digits.startsWith('+86')) digits = digits.slice(3);
      else if (digits.startsWith('+')) return /^\+[1-9][0-9]{6,14}$/.test(digits);
      return /^(?:1[3-9][0-9]{9}|0[1-9][0-9]{1,2}[2-9][0-9]{6,7}|[2-9][0-9]{6,7}|(?:400|800)[0-9]{7}|95[0-9]{3,4})$/.test(digits);
    }
    function normalizePhone(value) {
      value = cleanPhone(value); if (!value) return '';
      if (value.length > 32) throw new Error('联系电话最长32个字符，请检查号码或分机');
      if (phoneBase(value)) return value;
      const parts = value.match(/^(.+?)\s*(?:转|#|ext\.?|x)\s*([0-9]{1,6})$/i) || value.match(/^(0[0-9 -]+)-([0-9]{1,6})$/);
      if (parts && phoneBase(parts[1].trim())) { const base = parts[1].trim(), phone = base + ' 转 ' + parts[2]; return phone.length <= 32 ? phone : base.replace(/[ ()-]/g, '') + ' 转 ' + parts[2]; }
      throw new Error(PHONE_ERROR);
    }
    function phoneLengthError(value) {
      value = cleanPhone(value);
      if (value.length > 32) return '联系电话最长32个字符，超出内容未输入';
      let parts = value.match(/^(.*?)(?:转|#|ext\.?|x)\s*([0-9]*)$/i);
      if (!parts) { const tail = value.match(/^(0[0-9 -]+)-([0-9]*)$/); if (tail && phoneBase(tail[1])) parts = tail; }
      const main = parts ? parts[1] : value, digits = main.replace(/[^0-9]/g, '');
      let max = 15;
      if (!main.startsWith('+')) max = main.startsWith('1') ? 11 : /^(400|800)/.test(main) ? 10 : main.startsWith('0') ? 12 : 15;
      if (digits.length > max) return (max === 11 ? '手机号最多输入11位数字' : '当前号码最多输入' + max + '位数字') + '，超出内容未输入';
      if (parts && parts[2].length > 6) return '分机号最多输入6位数字，超出内容未输入';
      return '';
    }
    const phoneInput = value => input('mobile', value, { max: 32, type: 'tel', ph: '手机号、座机或客服电话' }) + '<span class="bs-phone-error" data-phone-error id="bs-phone-error-mobile" role="alert" hidden></span>';
    function wirePhone(box) {
      const el = box.querySelector('[name=mobile]'), error = box.querySelector('[data-phone-error]'); let touched = false;
      el.setAttribute('inputmode', 'tel'); el.setAttribute('autocomplete', 'tel'); el.setAttribute('aria-describedby', 'bs-phone-error-mobile');
      const show = text => { error.textContent = text; error.hidden = !text; el.setAttribute('aria-invalid', text ? 'true' : 'false'); };
      const proposed = text => el.value.slice(0, el.selectionStart ?? el.value.length) + text + el.value.slice(el.selectionEnd ?? el.value.length);
      el.addEventListener('beforeinput', e => { if (e.isComposing || e.data == null || e.inputType?.startsWith('delete')) return; const message = phoneLengthError(proposed(e.data)); if (message) { e.preventDefault(); show(message); } });
      el.addEventListener('paste', e => { const text = e.clipboardData?.getData('text'); if (text == null) return; const message = phoneLengthError(proposed(text)); if (message) { e.preventDefault(); show(message); } });
      const validate = (focus = false, commit = true) => {
        touched = true;
        try { const value = normalizePhone(el.value); if (commit && el.value !== value) el.value = value; show(''); return value; }
        catch (e) { show(e.message); if (focus) el.focus(); return null; }
      };
      el.addEventListener('blur', () => validate());
      el.addEventListener('input', () => { const message = phoneLengthError(el.value); if (message) show(message.replace('，超出内容未输入', '')); else if (touched) validate(false, false); else show(''); });
      return () => validate(true);
    }
    const words = (s) => Array.from(String(s || '').replace(/\s+/g, '')).length;
    const mono = (name) => esc(Array.from(String(name || '').trim())[0] || '品');
    /* store life: 营业中 / 即将到期 (30 天内) / 已到期 / 已停用 */
    function life(s) {
      const exp = Number(s.expire_time) || 0, left = exp ? Math.floor((exp - nowS()) / DAY) : null;
      if (Number(s.status) !== 1) return { key: 'off', dot: 'off', text: '已停用', left };
      if (exp && left < 0) return { key: 'expired', dot: 'fail', text: '已到期', left };
      if (exp && left <= 30) return { key: 'soon', dot: 'wait', text: '即将到期', left };
      return { key: 'open', dot: 'ok', text: '营业中', left };
    }
    const leftText = (l) => l.left === null ? '' : l.key === 'expired' ? '已过期 ' + Math.abs(l.left) + ' 天' : l.key === 'soon' ? (l.left === 0 ? '今天到期' : '剩 ' + l.left + ' 天') : '';
    const date = (v) => { const d = UK.toDate(v); return d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : ''; };
    const short = (name, brand) => { name = String(name || ''); if (!brand || !name.startsWith(brand)) return name; return name.slice(brand.length).replace(/^\s*[·・\-—|｜]\s*/, '') || name; };
    const where = (s) => { const full = [s.province, s.city, s.district].filter(Boolean).join(' '); if (!s.address) return full; return s.city && !s.address.includes(s.city) ? (full + ' ' + s.address) : s.address; };
    const mask = (m) => /^1\d{10}$/.test(m || '') ? m.slice(0, 3) + ' ' + m.slice(3, 7) + ' ' + m.slice(7) : (m || '');

    /* ---------- small builders ---------- */
    const logoHtml = (row, cls) => '<span class="bs-logo ' + (cls || '') + '">' + (row && row.logo && row.logo.url ? '<img src="' + esc(row.logo.url) + '" alt="" loading="lazy">' : '<b>' + mono(row && row.name) + '</b>') + '</span>';
    function ring(done, total, opt = {}) {
      const p = total ? Math.min(1, done / total) : 0, c = 2 * Math.PI * 15;
      return '<' + (opt.tag || 'button type="button"') + ' class="bs-ring' + (p >= 1 ? ' is-full' : '') + '"' + (opt.attrs || '') + ' data-tip="' + esc(opt.tip || ('企业知识完善 ' + done + ' / ' + total + (p < 1 ? '，点击补全' : ''))) + '">' +
        '<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><circle cx="18" cy="18" r="15" style="stroke-dasharray:' + c.toFixed(2) + ';stroke-dashoffset:' + (c * (1 - p)).toFixed(2) + '"/></svg>' +
        '<span>知识 <b class="num">' + done + '</b><i>/' + total + '</i></span></' + (opt.tag ? opt.tag.split(' ')[0] : 'button') + '>';
    }
    const navRow = (key, label, count, on, ic, extra) => '<div class="bs-nrow' + (on ? ' is-on' : '') + '"><button type="button" class="bs-nlink" data-nav="' + esc(key) + '">' + (ic || '') + '<span class="bs-nname">' + esc(label) + '</span>' + (extra || '') + '<span class="bs-ncount num">' + (count == null ? '' : fmt(count)) + '</span></button></div>';
    const dotIcon = (s) => '<i class="bs-ndot ' + s + '" aria-hidden="true"></i>';
    function field(label, inner, o = {}) { return '<div class="uk-field' + (o.cls ? ' ' + o.cls : '') + '"><label' + (o.for ? ' for="' + o.for + '"' : '') + '>' + esc(label) + (o.req ? '<span class="uk-req">*</span>' : '') + (o.tip ? ' <span class="bs-info" data-tip="' + esc(o.tip) + '">' + icon('info') + '</span>' : '') + '</label>' + inner + (o.hint ? '<span class="uk-meta">' + esc(o.hint) + '</span>' : '') + '</div>'; }
    const input = (name, value, o = {}) => '<input class="uk-input" name="' + name + '" id="bs-f-' + name + '" value="' + esc(value ?? '') + '" maxlength="' + (o.max || 100) + '"' + (o.type ? ' type="' + o.type + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.req ? ' required' : '') + (o.auto ? ' autofocus' : '') + '>';
    const area = (name, value, o = {}) => '<textarea class="uk-textarea" name="' + name + '" id="bs-f-' + name + '" maxlength="' + (o.max || 2000) + '" rows="' + (o.rows || 4) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.auto ? ' autofocus' : '') + '>' + esc(value ?? '') + '</textarea>';
    const values = (box) => { const o = {}; box.querySelectorAll('[name]').forEach((el) => { if (el.type === 'radio' && !el.checked) return; o[el.name] = el.value.trim(); }); return o; };
    const gate = (c, key, on) => { const b = c.el.querySelector('[data-act="' + key + '"]'); if (b) b.disabled = on; };
    function setErr(ctx, msg) { let e = ctx.body.querySelector('.bs-err'); if (!e) { e = document.createElement('p'); e.className = 'bs-err'; e.setAttribute('role', 'alert'); ctx.body.append(e); } e.textContent = msg || ''; e.hidden = !msg; if (msg) e.scrollIntoView({ block: 'nearest' }); }
    /* image picker inside a dialog: square logo or wide cover; uploads immediately (attach only, saved with the form) */
    function imagePick(box, key, label, cur, wide) {
      const el = box.querySelector('[data-pick="' + key + '"]'); const st = { id: Number(cur && cur.id) || 0, url: (cur && cur.url) || '', busy: false };
      const paint = () => {
        el.innerHTML = '<span class="bs-pick-img' + (wide ? ' is-wide' : '') + '">' + (st.url ? '<img src="' + esc(st.url) + '" alt="">' : icon('image')) + (st.busy ? '<i class="bs-spin">' + icon('loading') + '</i>' : '') + '</span>' +
          '<span class="bs-pick-acts">' + btn({ kind: 'secondary', size: 'sm', icon: 'upload', label: st.busy ? '上传中…' : st.url ? '更换' : '上传' + label, attrs: { 'data-up': '', ...(st.busy ? { disabled: '' } : {}) } }) + (st.url ? btn({ kind: 'ghost', size: 'sm', label: '移除', attrs: { 'data-rm': '', ...(st.busy ? { disabled: '' } : {}) } }) : '') + '<span class="uk-meta">' + (wide ? '横图，建议 1200 × 500 以上' : '方图，建议 400 × 400 以上') + ' · JPG、PNG、WebP，不超过 5MB</span></span>' +
          '<input type="file" accept=".jpg,.jpeg,.png,.webp,.gif" hidden>';
      };
      paint();
      el.addEventListener('click', (e) => { if (st.busy) return; if (e.target.closest('[data-up]')) el.querySelector('input').click(); if (e.target.closest('[data-rm]')) { st.id = 0; st.url = ''; paint(); } });
      el.addEventListener('change', async (e) => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        if (!/\.(jpe?g|png|webp|gif)$/i.test(f.name) || f.size > 5 * 1048576) { UK.toast('请选择 5MB 以内的 JPG、PNG、WebP 或 GIF 图片', 'fail'); e.target.value = ''; return; }
        st.busy = true; paint();
        try { const r = await upload(f, 'image'); const src = r.uri || r.url; if (!r.id || !src) throw new Error('图片上传结果异常，请重试'); const url = new URL(src.startsWith('uploads/') ? '/' + src : src, location.origin).href; st.id = Number(r.id); st.url = url; } catch (err) { UK.toast(err.message, 'fail'); }
        st.busy = false; paint();
      });
      return st;
    }

    /* ---------- AI availability (GEO text models) ---------- */
    const optCache = new Map();
    const aiOptions = (brand) => { if (!optCache.has(brand)) optCache.set(brand, geo(brand, 'options').catch(() => ({ text_available: false, models: [] }))); return optCache.get(brand); };
    const AI_SOON = '文本模型还没开通。请联系你的服务商在后台开通 GEO 文本能力，开通后这里就能直接用，按实际用量扣 TP。';
    function soonDialog(title, text) {
      UK.dialog({ title, width: 440, body: '<div class="bs-soon-body"><span class="uk-status soon">待开通</span><p>' + esc(text) + '</p></div>', actions: [{ key: 'ok', label: '知道了', kind: 'primary' }] });
    }

    /* ---------- AI 强化 (knowledge_enhance job, same request as before) ---------- */
    const enhancePending = new Map();
    function enhance(brand, profile, key, label, current, onAdopt) {
      const pendingId = String(brand) + ':' + key;
      const previous = enhancePending.get(pendingId);
      if (previous) { profile = previous.body.draft_profile; current = profile[key] || ''; }
      const box = document.createElement('div'); box.className = 'bs-form';
      box.innerHTML = '<div class="bs-row2">' + field('使用模型', '<select class="uk-select" name="model"><option>正在读取…</option></select>', { hint: '按所选模型的实际用量计费，计入 TP 明细' }) + field('这次想怎么改（选填）', input('instruction', '', { max: 500, ph: '例如：更简洁，突出季节限定' })) + '</div>' +
        '<div class="bs-cmp"><div>' + field('原文', '<div class="bs-cmp-text">' + (esc(current) || '<span class="uk-meta">还没写</span>') + '</div>') + '</div><div>' + field('建议', '<textarea class="uk-textarea" name="suggest" rows="9" disabled placeholder="生成后显示在这里，确认后才会替换"></textarea>') + '<span class="bs-job uk-meta" aria-live="polite"></span></div></div>';
      let job = Number(previous && previous.job) || 0, timer = 0, alive = true;
      const ctx = UK.dialog({
        title: 'AI 强化 · ' + label, width: 760, body: box,
        actions: [{ key: 'gen', kind: 'ai', icon: 'spark', label: '生成建议' }, { key: 'use', kind: 'primary', label: '用这版' }],
        onClose: () => { alive = false; clearTimeout(timer); },
        async onAction(k, c) {
          setErr(c, '');
          if (k === 'use') { const v = box.querySelector('[name=suggest]').value.trim(); if (!v) { setErr(c, '还没有可用的建议'); return false; } onAdopt(v); return; }
          if (k !== 'gen') return;
          if (job) { c.busy('gen', true); poll(c); return false; }
          const v = values(box); if (!filled(profile.brand_name) || !['industry', 'intro', 'products', 'customers', 'competitors'].some((f) => filled(f === key ? current : profile[f]))) { setErr(c, '先写下品牌名称和几句已知事实，AI 只会整理你给的事实'); return false; }
          c.busy('gen', true); box.querySelector('.bs-job').textContent = enhancePending.has(pendingId) ? '正在确认上次提交…' : '正在提交…';
          try {
            const draft = {}; FIELDS.forEach(([f]) => { draft[f] = f === key ? current : (profile[f] || ''); });
            const saved = enhancePending.get(pendingId);
            const body = saved ? saved.body : { operation: 'knowledge_enhance', subject: '企业知识强化 · ' + label, target_field: key, draft_profile: draft, enhance_instruction: v.instruction, model_id: v.model, request_key: 'kb_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 40) };
            enhancePending.set(pendingId, { body, job: 0 });
            const r = await geo(brand, 'generate', {}, body);
            job = Number(r.id); enhancePending.set(pendingId, { body, job }); poll(c);
          } catch (e) { if (e.answered) enhancePending.delete(pendingId); setErr(c, e.message + (e.answered ? '' : '。提交结果未确认，再次生成将沿用原请求，不会重复扣费。')); c.busy('gen', false); box.querySelector('.bs-job').textContent = ''; }
          return false;
        }
      });
      gate(ctx, 'use', true);
      if (previous) box.querySelector('[name=instruction]').value = previous.body.enhance_instruction || '';
      if (job) { ctx.busy('gen', true); poll(ctx); }
      else if (previous) setErr(ctx, '上次提交结果未确认，再次生成将沿用原请求，不会重复扣费。');
      async function poll(c, n = 0) {
        if (!alive) return;
        try {
          const d = await geo(brand, 'jobs', { id: job }); const j = (d.lists || [])[0]; if (!alive) return;
          const st = box.querySelector('.bs-job');
          if (!j) throw new Error('任务不存在或当前品牌无权读取');
          if (j.status === 'success') { enhancePending.delete(pendingId); job = 0; const t = box.querySelector('[name=suggest]'); t.disabled = false; t.value = String((j.result && j.result.content) || '').trim(); st.innerHTML = '已生成' + (j.user_points != null ? ' · 消耗 ' + UK.tp(j.user_points) : '') + '，核对事实后再用'; c.busy('gen', false); const g = c.el.querySelector('[data-act=gen]'); g.querySelector('span').textContent = '重新生成'; g.classList.replace('uk-btn-ai', 'uk-btn-secondary'); gate(c, 'use', false); return; }
          if (j.status === 'failed' || j.status === 'review') { enhancePending.delete(pendingId); job = 0; st.textContent = ''; setErr(c, j.error || '生成没有成功，可以重新生成'); c.busy('gen', false); return; }
          st.textContent = j.status === 'running' ? '正在生成…' : '排队中…';
          timer = setTimeout(() => poll(c, n + 1), Math.min(6000, 1500 + n * 500));
        } catch (e) { setErr(c, e.message); c.busy('gen', false); }
      }
      aiOptions(brand).then((o) => {
        const sel = box.querySelector('[name=model]'); if (!sel.isConnected) return;
        sel.innerHTML = (o.models || []).map((m) => '<option value="' + esc(m.id) + '"' + (String(m.id) === String((previous && previous.body.model_id) || o.default_model_id) ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') || '<option value="">暂无可用模型</option>';
      });
    }
    function aiButton(available, name, value) {
      return available === false
        ? '<button type="button" class="bs-ai-soon" ' + name + '="' + esc(value) + '" data-tip="文本模型还没开通，点击查看怎么开通">' + icon('spark') + '<span>AI 强化</span><span class="uk-status soon">待开通</span></button>'
        : btn({ kind: 'ai', size: 'sm', icon: 'spark', label: 'AI 强化', attrs: { [name]: value } });
    }

    /* ---------- K5 知识库抽屉: fill the profile without leaving the page; GEO reuses it ---------- */
    function knowledgeDrawer(brandId, opt = {}) {
      const box = document.createElement('div'); box.className = 'bs-kd';
      box.innerHTML = '<div class="bs-kd-load">' + UK.skel('60%', 18) + UK.skel('100%', 120, 12) + UK.skel('100%', 120, 12) + '</div>';
      const ctx = UK.dialog({ title: '企业知识', drawer: true, width: 560, body: box, headExtra: '<span class="bs-kd-ring"></span>' });
      let d = null;
      const draw = () => {
        const p = d.profile, done = FIELDS.filter(([k]) => filled(p[k])).length;
        ctx.el.querySelector('.bs-kd-ring').innerHTML = ring(done, 7, { tag: 'span', tip: '已完善 ' + done + ' / 7' });
        box.innerHTML = '<form class="bs-form" novalidate>' +
          '<div class="bs-row2">' + field('品牌名称', input('brand_name', p.brand_name, { max: 120, req: true }), { req: true }) + field('所属行业', input('industry', p.industry, { max: 120, ph: '例如：精品咖啡 · 连锁门店' })) + '</div>' +
          field('官方网站', input('website', p.website, { max: 500, ph: 'https://' })) +
          LONG.map(([k, label, max, ph]) => '<div class="bs-kd-long' + (opt.focus === k ? ' is-focus' : '') + '">' + field(label, area(k, p[k], { max, rows: 5, ph, auto: opt.focus === k })) + '<div class="bs-kd-tools"><span class="uk-meta num" data-count="' + k + '"></span><span class="uk-grow"></span>' + aiButton(d.ai, 'data-ai', k) + '</div></div>').join('') +
          '</form>';
        const form = box.querySelector('form');
        wireWebsite(form);
        const counts = () => LONG.forEach(([k, , max]) => { const t = form.querySelector('[name=' + k + ']'); form.querySelector('[data-count=' + k + ']').textContent = fmt(Array.from(t.value).length) + ' / ' + fmt(max); });
        counts(); form.addEventListener('input', () => { dirty = true; counts(); });
        form.addEventListener('click', (e) => {
          const a = e.target.closest('[data-ai]'); if (!a) return;
          const k = a.dataset.ai, label = LONG.find((x) => x[0] === k)[1];
          if (d.ai === false) { soonDialog('AI 强化待开通', AI_SOON); return; }
          enhance(brandId, { ...p, ...values(form) }, k, label, form.querySelector('[name=' + k + ']').value, (v) => { const t = form.querySelector('[name=' + k + ']'); t.value = v; dirty = true; counts(); t.focus(); });
        });
        if (opt.focus) setTimeout(() => { const t = form.querySelector('[name=' + opt.focus + ']'); t && t.scrollIntoView({ block: 'center' }); }, 80);
      };
      let dirty = false;
      const foot = document.createElement('div'); foot.className = 'uk-dialog-foot';
      foot.innerHTML = '<span class="uk-meta">GEO 写稿和诊断都用这一份资料</span><span class="uk-grow"></span>' + btn({ kind: 'secondary', label: '取消', attrs: { 'data-x': '' } }) + btn({ kind: 'primary', label: '保存', attrs: { 'data-save': '' } });
      ctx.el.append(foot);
      foot.addEventListener('click', async (e) => {
        if (e.target.closest('[data-x]')) { ctx.close(); return; }
        if (!e.target.closest('[data-save]') || !d) return;
        const v = values(box.querySelector('form')); if (!v.brand_name) { setErr(ctx, '品牌名称不能为空'); return; }
        try { v.website = normalizeWebsite(v.website); box.querySelector('[name=website]').value = v.website; } catch (err) { setErr(ctx, err.message); box.querySelector('[name=website]').focus(); return; }
        const b = foot.querySelector('[data-save]'); b.disabled = true; b.classList.add('is-busy'); setErr(ctx, '');
        try { await ws('brandKnowledgeSave', {}, { ...v, id: brandId, revision: d.profile.revision }); dirty = false; ctx.close('saved'); UK.toast('企业知识已保存'); opt.onSaved && opt.onSaved(); }
        catch (err) { setErr(ctx, err.message); b.disabled = false; b.classList.remove('is-busy'); }
      });
      Promise.all([ws('brandDetail', { id: brandId }), aiOptions(brandId)]).then(([detail, o]) => { d = detail; d.ai = !!o.text_available; d.aiNotice = o.text_notice; if (box.isConnected) draw(); }).catch((e) => { box.innerHTML = '<p class="bs-err">' + esc(e.message) + '</p>'; });
      return ctx;
    }

    // K5 is shared: GEO (geo-v2.js) opens the same drawer through UK.knowledge(brandId, {focus, onSaved})
    UK.knowledge = knowledgeDrawer;

    /* ---------- dialogs: brand ---------- */
    function brandDialog(row, onDone, resuming = false) {
      const isNew = !row || !row.id; row = row || {};
      const box = document.createElement('div'); box.className = 'bs-form';
      box.innerHTML = '<div class="bs-row2">' + field('品牌名称', input('name', row.name, { max: 120, req: true, auto: true }), { req: true }) + field('所属行业', input('industry', row.industry, { max: 120, ph: '例如：精品咖啡 · 连锁门店' })) + '</div>' +
        '<div class="bs-row2">' + field('联系人', input('contact', row.contact, { max: 80 })) + field('联系电话', phoneInput(row.mobile), { for: 'bs-f-mobile' }) + '</div>' +
        '<div class="bs-row2">' + field('联系邮箱', input('email', row.email, { max: 160, type: 'email' })) + field('官方网站', input('website', row.website, { max: 500, ph: 'https://' })) + '</div>' +
        field('联系地址', input('address', row.address, { max: 255 })) +
        field('品牌 Logo', '<div class="bs-pick" data-pick="logo"></div>') + field('品牌封面', '<div class="bs-pick" data-pick="cover"></div>', { tip: '品牌卡片和品牌页顶部用这张图' });
      wireWebsite(box);
      const readPhone = wirePhone(box);
      const logo = imagePick(box, 'logo', ' Logo', row.logo, false), cover = imagePick(box, 'cover', '封面', row.cover, true);
      let conflictNotice = null, conflictContext = null;
      const clearConflict = () => { if (conflictNotice) conflictNotice.remove(); if (conflictContext) gate(conflictContext, 'ok', false); conflictNotice = conflictContext = null; };
      box.querySelector('[name=name]').addEventListener('input', clearConflict);
      function offerExisting(c, existing) {
        clearConflict(); setErr(c, '');
        const notice = document.createElement('div'); notice.className = 'uk-notice'; notice.setAttribute('role', 'status');
        notice.innerHTML = icon('info') + '<span class="uk-grow">这个品牌已保存在你的账号中。</span>' + btn({ kind: 'primary', size: 'sm', label: '继续完善', attrs: { 'data-continue-brand': '' } });
        conflictNotice = notice; conflictContext = c; c.body.append(notice); gate(c, 'ok', true);
        const open = notice.querySelector('[data-continue-brand]');
        notice.scrollIntoView({ block: 'nearest' }); open.focus({ preventScroll: true });
        open.addEventListener('click', async () => {
          if (logo.busy || cover.busy) { setErr(c, '图片还在上传，请稍等'); return; }
          const name = values(box).name; if (name !== existing.name) { clearConflict(); return; }
          open.disabled = true; open.classList.add('is-busy');
          try {
            const d = await ws('brandDetail', { id: existing.id });
            if (!c.el.isConnected || values(box).name !== name) return;
            if (d.brand.name !== name) throw new Error('品牌资料已变更，请刷新后重试');
            if (logo.busy || cover.busy) throw new Error('图片还在上传，请稍等');
            const draft = values(box), recovered = { ...d.brand, industry: d.profile.industry, website: d.profile.website };
            // Keep what was just entered and recover existing fields that were left blank in the create form.
            for (const key of ['name', 'industry', 'website', 'contact', 'mobile', 'email', 'address']) if (draft[key]) recovered[key] = draft[key];
            if (logo.id) recovered.logo = { id: logo.id, url: logo.url };
            if (cover.id) recovered.cover = { id: cover.id, url: cover.url };
            c.close(); brandDialog(recovered, onDone, true);
          } catch (e) { if (c.el.isConnected) setErr(c, e.message); }
          finally { open.disabled = false; open.classList.remove('is-busy'); }
        });
      }
      UK.dialog({
        title: isNew ? '创建品牌' : resuming ? '继续完善品牌资料' : '编辑基本信息', width: 600, body: box,
        actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'ok', label: isNew ? '创建' : '保存', kind: 'primary' }],
        async onAction(k, c) {
          if (k !== 'ok') return;
          const v = values(box); clearConflict(); setErr(c, '');
          if (!v.name) { setErr(c, '请填写品牌名称'); box.querySelector('[name=name]').focus(); return false; }
          v.mobile = readPhone(); if (v.mobile === null) return false;
          try { v.website = normalizeWebsite(v.website); box.querySelector('[name=website]').value = v.website; } catch (err) { setErr(c, err.message); box.querySelector('[name=website]').focus(); return false; }
          if (logo.busy || cover.busy) { setErr(c, '图片还在上传，请稍等'); return false; }
          c.busy('ok', true);
          try {
            const r = await ws('brandSave', {}, { id: row.id || 0, revision: row.revision || 0, name: v.name, industry: v.industry, website: v.website, contact: v.contact, mobile: v.mobile, email: v.email, address: v.address, logo_file_id: logo.id, cover_file_id: cover.id });
            const id = Number(r.id || row.id);
            UK.toast(isNew ? '品牌已创建' : '已保存'); onDone && onDone(id);
          } catch (e) {
            c.busy('ok', false);
            if (isNew && e.answered && e.message.includes('同名品牌')) {
              try {
                const choices = await ws('brandChoices'); if (!c.el.isConnected || values(box).name !== v.name) return false;
                const existing = (choices.lists || []).find((brand) => brand.name === v.name);
                if (existing) { offerExisting(c, existing); return false; }
              } catch (_) { /* Keep the original error if recovery lookup is unavailable. */ }
            }
            if (c.el.isConnected && values(box).name === v.name) setErr(c, e.message); return false;
          }
        }
      });
    }
    async function recycleBrand(row, onDone) {
      const ok = await UK.confirm({ title: '把「' + row.name + '」移入回收站？', text: '品牌资料、企业知识和 GEO 记录都会保留，可在回收站恢复。品牌下还有门店或进行中的任务时不能回收。', okText: '移入回收站', danger: true });
      if (!ok) return;
      try { await ws('brandRecycle', {}, { id: row.id, revision: row.revision, restore: false }); UK.toast('已移入回收站'); onDone && onDone(); } catch (e) { UK.toast(e.message, 'fail', 4200); }
    }

    /* ---------- dialogs: store ---------- */
    function storeDialog(row, brands, brandId, onDone) {
      const isNew = !row || !row.id; row = row || { status: 1, brand_id: brandId };
      const box = document.createElement('div'); box.className = 'bs-form';
      const opts = brands.map((b) => '<option value="' + b.id + '"' + (Number(b.id) === Number(row.brand_id || brandId) ? ' selected' : '') + '>' + esc(b.name) + '</option>').join('');
      box.innerHTML = '<div class="bs-row2">' + field('门店名称', input('name', row.name, { max: 80, req: true, auto: true, ph: '例如：山野咖啡 · 西湖店' }), { req: true }) + field('所属品牌', '<select class="uk-select" name="brand_id">' + opts + '</select>') + '</div>' +
        field('营业状态', '<div class="uk-seg bs-seg" role="radiogroup"><button type="button" role="radio" data-st="1" aria-pressed="' + (Number(row.status) === 1) + '">营业中</button><button type="button" role="radio" data-st="0" aria-pressed="' + (Number(row.status) !== 1) + '">已停用</button></div>') +
        '<div class="bs-row2">' + field('门店电话', phoneInput(row.mobile), { for: 'bs-f-mobile' }) + field('联系人', input('contact', row.contact, { max: 50 })) + '</div>' +
        field('营业时间', input('business_hours', row.business_hours, { max: 100, ph: '例如：09:00–22:00' })) +
        '<div class="bs-row3">' + field('省 / 直辖市', input('province', row.province, { max: 50 })) + field('城市', input('city', row.city, { max: 50 })) + field('区 / 县', input('district', row.district, { max: 50 })) + '</div>' +
        field('详细地址', input('address', row.address, { max: 255 })) +
        '<div class="bs-row2">' + field('位置坐标', input('coordinates', row.coordinates, { max: 64, ph: '纬度,经度，例如 30.2592,120.1489' }), { tip: '在高德或腾讯地图里搜到门店，右键「这里是哪儿」即可看到坐标；种草卡导航会用到' }) + field('POI ID', input('poi_id', row.poi_id, { max: 128 }), { tip: '抖音、大众点评等平台的门店 ID，没有可以不填' }) + '</div>' +
        field('门店简介', area('description', row.description, { max: 2000, rows: 3 })) +
        field('门店 Logo', '<div class="bs-pick" data-pick="logo"></div>');
      let st = Number(row.status) === 1 ? '1' : '0';
      const readPhone = wirePhone(box);
      box.querySelector('.bs-seg').addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (!b) return; st = b.dataset.st; box.querySelectorAll('[data-st]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
      const logo = imagePick(box, 'logo', ' Logo', row.logo, false);
      UK.dialog({
        title: isNew ? '创建门店' : '编辑门店', width: 640, body: box,
        actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'ok', label: isNew ? '创建' : '保存', kind: 'primary' }],
        async onAction(k, c) {
          if (k !== 'ok') return;
          const v = values(box); setErr(c, '');
          if (!v.name) { setErr(c, '请填写门店名称'); box.querySelector('[name=name]').focus(); return false; }
          v.mobile = readPhone(); if (v.mobile === null) return false;
          if (v.coordinates && !/^-?\d+(\.\d+)?\s*[,，]\s*-?\d+(\.\d+)?$/.test(v.coordinates)) { setErr(c, '位置坐标请按「纬度,经度」填写'); return false; }
          if (logo.busy) { setErr(c, '图片还在上传，请稍等'); return false; }
          c.busy('ok', true);
          try { const r = await ws('storeSave', {}, { ...v, id: row.id || 0, status: st, brand_id: v.brand_id || brandId, logo_file_id: logo.id }); UK.toast(isNew ? '门店已创建' : '已保存'); onDone && onDone(Number(r.id || row.id)); }
          catch (e) { setErr(c, e.message); c.busy('ok', false); return false; }
        }
      });
    }
    /* B4: batch create — template, server-side preview, then one batch */
    function storeBatchDialog(brand, onDone) {
      const box = document.createElement('div'); box.className = 'bs-form';
      let rows = null;
      const draw = () => {
        box.innerHTML = rows ? '<div class="bs-prev-head"><b>' + rows.length + ' 家门店</b><span class="uk-meta">核对一下，确认后一次创建到「' + esc(brand.name) + '」</span><span class="uk-grow"></span>' + btn({ kind: 'ghost', size: 'sm', icon: 'refresh', label: '重新选择', attrs: { 'data-redo': '' } }) + '</div>' +
          '<div class="bs-prev"><table class="uk-table"><thead><tr><th>门店名称</th><th>电话</th><th>地址</th><th>营业时间</th></tr></thead><tbody>' + rows.map((r) => '<tr><td>' + esc(r.name) + '</td><td class="num">' + esc(r.mobile) + '</td><td>' + esc(r.address) + '</td><td>' + esc(r.business_hours) + '</td></tr>').join('') + '</tbody></table></div>'
          : '<div class="bs-drop" data-drop tabindex="0" role="button"><span class="bs-drop-art">' + icon('upload') + '</span><b>拖入表格，或点击选择</b><span class="uk-meta">CSV 或 XLSX · 一次 1–100 家 · 不超过 2MB · 表头依次为 门店名称、电话、地址、营业时间、poi_id</span><input type="file" accept=".csv,.xlsx" hidden></div>' +
            '<p class="bs-tpl">' + icon('file') + '<span>没有表格？</span><button type="button" class="bs-link" data-tpl>下载模板</button><span class="uk-meta">Logo 和坐标可以创建后再补</span></p>';
      };
      draw();
      const parse = async (f) => {
        const fd = new FormData(); fd.append('file', f); const t = UK.tenant();
        box.querySelector('[data-drop]').classList.add('is-busy');
        try {
          const txt = await fetch('/api/merchantWorkspace/storeImport' + (t ? '?tenant_id=' + t : ''), { method: 'POST', credentials: 'same-origin', headers: { token: token() }, body: fd }).then((r) => r.text());
          let r = null; try { r = JSON.parse(txt); } catch (e) { const k = txt.indexOf('{"code"'); if (k >= 0) r = JSON.parse(txt.slice(k)); }
          if (!r || r.code !== 1) throw new Error((r && r.msg) || '文件读取失败');
          rows = r.data.rows; draw(); gate(ctx, 'ok', false);
        } catch (e) { setErr(ctx, e.message); box.querySelector('[data-drop]') && box.querySelector('[data-drop]').classList.remove('is-busy'); }
      };
      box.addEventListener('click', (e) => {
        if (e.target.closest('[data-tpl]')) { downloadCsv('门店导入模板.csv', [['门店名称', '电话', '地址', '营业时间', 'poi_id'], ['示例：山野咖啡 · 西湖店', '0571-87011233', '杭州市西湖区北山街 32 号', '09:00–22:00', '']]); return; }
        if (e.target.closest('[data-redo]')) { rows = null; draw(); gate(ctx, 'ok', true); return; }
        const d = e.target.closest('[data-drop]'); if (d) d.querySelector('input').click();
      });
      box.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-drop]')) { e.preventDefault(); e.target.querySelector('input').click(); } });
      box.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) { setErr(ctx, ''); parse(f); } e.target.value = ''; });
      box.addEventListener('dragover', (e) => { if (!rows) { e.preventDefault(); box.querySelector('[data-drop]').classList.add('is-over'); } });
      box.addEventListener('dragleave', () => { const d = box.querySelector('[data-drop]'); d && d.classList.remove('is-over'); });
      box.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setErr(ctx, ''); parse(f); } });
      const ctx = UK.dialog({
        title: '批量创建门店', width: 680, body: box,
        actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'ok', label: '创建', kind: 'primary' }],
        async onAction(k, c) {
          if (k !== 'ok') return;
          if (!rows) return false; c.busy('ok', true);
          try { const r = await ws('storeBatch', {}, { rows, brand_id: brand.id }); UK.toast('已创建 ' + r.count + ' 家门店'); onDone && onDone(); }
          catch (e) { setErr(c, e.message); c.busy('ok', false); return false; }
        }
      });
      gate(ctx, 'ok', true);
    }
    function requestDialog(store, kind, onDone) {
      const name = kind === 'nfc' ? '激活码牌' : '续期';
      const box = document.createElement('div'); box.className = 'bs-form';
      box.innerHTML = '<p class="bs-lead">交给服务商（OEM 或代理）审核办理，不会自动扣费；处理结果在门店的申请记录里看。</p>' +
        field('申请说明', area('note', '', { max: 500, rows: 4, auto: true, ph: kind === 'nfc' ? '例如：新到 20 张码牌，编号 HZ0041-001 至 020，申请激活' : '例如：门店续签一年，按原套餐' }), { req: true });
      UK.dialog({
        title: '申请' + name + ' · ' + store.name, width: 520, body: box,
        actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'ok', label: '提交申请', kind: 'primary' }],
        async onAction(k, c) {
          if (k !== 'ok') return;
          const v = values(box); if (!v.note) { setErr(c, '请写一句申请说明'); return false; }
          c.busy('ok', true);
          try { await ws('storeRequest', {}, { store_id: store.id, kind, note: v.note }); UK.toast('申请已提交'); onDone && onDone(); }
          catch (e) { setErr(c, e.message); c.busy('ok', false); return false; }
        }
      });
    }
    /* ---------- dialogs: staff ---------- */
    function staffDialog(row, stores, storeId, onDone) {
      const isNew = !row || !row.id; row = row || { status: 1, store_id: storeId };
      const box = document.createElement('div'); box.className = 'bs-form';
      box.innerHTML = field('员工姓名', input('name', row.name, { max: 50, req: true, auto: true }), { req: true }) + field('手机号', input('mobile', row.mobile, { max: 11, type: 'tel', ph: '11 位手机号' }), { req: true }) +
        field('所属门店', '<select class="uk-select" name="store_id"' + (isNew ? '' : ' disabled') + '>' + stores.map((s) => '<option value="' + s.id + '"' + (Number(s.id) === Number(row.store_id || storeId) ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select>', isNew ? {} : { hint: '换门店请在新门店重新添加' }) +
        (isNew ? '' : field('状态', '<div class="uk-seg bs-seg"><button type="button" data-st="1" aria-pressed="' + (Number(row.status) === 1) + '">启用</button><button type="button" data-st="0" aria-pressed="' + (Number(row.status) !== 1) + '">停用</button></div>', { hint: '停用后不会再派任务给他' }));
      let st = Number(row.status) === 1 ? '1' : '0';
      const seg = box.querySelector('.bs-seg'); seg && seg.addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (!b) return; st = b.dataset.st; seg.querySelectorAll('[data-st]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
      UK.dialog({
        title: isNew ? '新增员工' : '编辑员工', width: 440, body: box,
        actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'ok', label: isNew ? '添加' : '保存', kind: 'primary' }],
        async onAction(k, c) {
          if (k !== 'ok') return;
          const v = values(box); setErr(c, '');
          if (!v.name) { setErr(c, '请填写员工姓名'); return false; }
          if (!/^1[3-9]\d{9}$/.test(v.mobile)) { setErr(c, '请填写有效的 11 位手机号'); return false; }
          c.busy('ok', true);
          try { await ws('storeStaffSave', {}, { id: row.id || 0, store_id: Number(v.store_id || row.store_id), name: v.name, mobile: v.mobile, status: isNew ? '1' : st }); UK.toast(isNew ? '已添加' : '已保存'); onDone && onDone(); }
          catch (e) { setErr(c, e.message); c.busy('ok', false); return false; }
        }
      });
    }
    function parseStaffCsv(text) {
      const rows = []; let row = [], cell = '', q = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
        if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
      }
      if (q) throw new Error('CSV 引号未闭合');
      if (cell || row.length) { row.push(cell); rows.push(row); }
      const clean = rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
      if (!clean.length) throw new Error('文件为空');
      const head = clean.shift().map((h) => h.replace(/^﻿/, ''));
      if (head[0] !== '员工姓名' || !['电话', '手机号'].includes(head[1])) throw new Error('请使用员工模板，表头为「员工姓名,手机号」');
      if (!clean.length || clean.length > 100) throw new Error('每批请上传 1 至 100 名员工');
      const seen = new Set();
      return clean.map((r, i) => {
        const name = r[0] || '', mobile = (r[1] || '').replace(/\s|-/g, '');
        if (!name || Array.from(name).length > 50) throw new Error('第 ' + (i + 2) + ' 行：员工姓名须为 1 至 50 个字');
        if (!/^1[3-9]\d{9}$/.test(mobile)) throw new Error('第 ' + (i + 2) + ' 行：手机号不是有效的 11 位号码');
        if (seen.has(mobile)) throw new Error('第 ' + (i + 2) + ' 行：手机号和前面重复'); seen.add(mobile);
        return { name, mobile };
      });
    }
    function staffImportDialog(stores, storeId, onDone) {
      const box = document.createElement('div'); box.className = 'bs-form';
      let rows = null;
      const draw = () => {
        box.innerHTML = field('导入到门店', '<select class="uk-select" name="store_id">' + stores.map((s) => '<option value="' + s.id + '"' + (Number(s.id) === Number(storeId) ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select>') +
          (rows ? '<div class="bs-prev-head"><b>' + rows.length + ' 名员工</b><span class="uk-meta">核对后确认导入</span><span class="uk-grow"></span>' + btn({ kind: 'ghost', size: 'sm', icon: 'refresh', label: '重新选择', attrs: { 'data-redo': '' } }) + '</div><div class="bs-prev"><table class="uk-table"><thead><tr><th>员工姓名</th><th>手机号</th></tr></thead><tbody>' + rows.map((r) => '<tr><td>' + esc(r.name) + '</td><td class="num">' + esc(mask(r.mobile)) + '</td></tr>').join('') + '</tbody></table></div>'
            : '<div class="bs-drop" data-drop tabindex="0" role="button"><span class="bs-drop-art">' + icon('upload') + '</span><b>拖入 CSV，或点击选择</b><span class="uk-meta">UTF-8 编码 · 一次 1–100 人 · 表头为 员工姓名、手机号</span><input type="file" accept=".csv,text/csv" hidden></div><p class="bs-tpl">' + icon('file') + '<span>没有表格？</span><button type="button" class="bs-link" data-tpl>下载模板</button></p>');
      };
      draw();
      const read = async (f) => { try { if (f.size > 1048576) throw new Error('文件不能超过 1MB'); const keep = box.querySelector('[name=store_id]').value; rows = parseStaffCsv(await f.text()); draw(); box.querySelector('[name=store_id]').value = keep; gate(ctx, 'ok', false); setErr(ctx, ''); } catch (e) { setErr(ctx, e.message); } };
      box.addEventListener('click', (e) => {
        if (e.target.closest('[data-tpl]')) { downloadCsv('员工导入模板.csv', [['员工姓名', '手机号'], ['张三', '13800000000']]); return; }
        if (e.target.closest('[data-redo]')) { const keep = box.querySelector('[name=store_id]').value; rows = null; draw(); box.querySelector('[name=store_id]').value = keep; gate(ctx, 'ok', true); return; }
        const d = e.target.closest('[data-drop]'); if (d) d.querySelector('input').click();
      });
      box.addEventListener('change', (e) => { if (e.target.type !== 'file') return; const f = e.target.files && e.target.files[0]; if (f) read(f); e.target.value = ''; });
      box.addEventListener('dragover', (e) => { if (!rows) e.preventDefault(); });
      box.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) read(f); });
      const ctx = UK.dialog({
        title: '批量导入员工', width: 560, body: box,
        actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'ok', label: '导入', kind: 'primary' }],
        async onAction(k, c) {
          if (k !== 'ok' || !rows) return k === 'ok' ? false : undefined;
          c.busy('ok', true);
          try { const r = await ws('storeStaffBatch', {}, { store_id: Number(box.querySelector('[name=store_id]').value), rows }); UK.toast('已导入 ' + r.count + ' 名员工'); onDone && onDone(); }
          catch (e) { setErr(c, e.message); c.busy('ok', false); return false; }
        }
      });
      gate(ctx, 'ok', true);
    }
    function downloadCsv(name, rows) {
      const safe = (v) => { let s = String(v ?? ''); if (/^[=+@\-\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
      const blob = new Blob(['﻿' + rows.map((r) => r.map(safe).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    /* ---------- dialogs: knowledge documents ---------- */
    function docDialog(brandId, doc, category, cats, onDone) {
      const isNew = !doc; doc = doc || { category: category || '产品资料' };
      const box = document.createElement('div'); box.className = 'bs-form';
      const list = [...new Set([...CATS, ...cats, doc.category].filter(Boolean))];
      box.innerHTML = '<div class="bs-row2">' + field('文档名称', input('title', doc.title, { max: 255, req: true, auto: true, ph: '例如：2026 秋季新品清单' }), { req: true }) + field('分类', '<input class="uk-input" name="category" list="bs-cats" maxlength="80" value="' + esc(doc.category) + '"><datalist id="bs-cats">' + list.map((c) => '<option value="' + esc(c) + '">').join('') + '</datalist>', { hint: '可以选，也可以直接输入新分类' }) + '</div>' +
        field('正文', area('content', doc.content, { max: 30000, rows: 12, ph: '写真实、可核查的事实。GEO 写稿时可以选用这篇文档。' }), { req: true, hint: '' }) +
        '<div class="bs-doc-tools"><button type="button" class="bs-link" data-import>' + icon('upload') + '<span>从 TXT / Markdown 导入</span></button><span class="uk-grow"></span><span class="uk-meta num" data-n></span></div>' +
        field('来源链接', input('source_url', doc.source_url, { max: 2048, type: 'url', ph: 'https://（选填，方便以后核对）' })) + '<input type="file" accept=".txt,.md,text/plain,text/markdown" hidden>';
      const t = box.querySelector('[name=content]'), n = box.querySelector('[data-n]');
      const count = () => { n.textContent = fmt(Array.from(t.value).length) + ' / 30,000 字'; }; count(); t.addEventListener('input', count);
      box.querySelector('[data-import]').addEventListener('click', () => box.querySelector('input[type=file]').click());
      box.querySelector('input[type=file]').addEventListener('change', async (e) => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        if (!/\.(txt|md)$/i.test(f.name) || f.size > 2097152) { UK.toast('请选择 2MB 以内的 TXT 或 Markdown 文档', 'fail'); return; }
        const s = await f.text(); if (Array.from(s).length > 30000) { UK.toast('文档超过 30000 字，请先精简', 'fail'); return; }
        t.value = s; count(); const ti = box.querySelector('[name=title]'); if (!ti.value) ti.value = f.name.replace(/\.[^.]+$/, '').slice(0, 255);
      });
      UK.dialog({
        title: isNew ? '新增知识文档' : '编辑知识文档', width: 680, body: box,
        actions: [{ key: 'cancel', label: '取消', kind: 'secondary' }, { key: 'ok', label: '保存', kind: 'primary' }],
        async onAction(k, c) {
          if (k !== 'ok') return;
          const v = values(box); setErr(c, '');
          if (!v.title) { setErr(c, '请填写文档名称'); return false; }
          if (!t.value.trim()) { setErr(c, '正文不能为空'); return false; }
          if (v.source_url && !isUrl(v.source_url)) { setErr(c, '来源链接请填写以 http:// 或 https:// 开头的网址'); return false; }
          c.busy('ok', true);
          try { await geo(brandId, 'contentSave', {}, { kind: 'materials', id: doc.id || 0, revision: doc.revision || 0, expected_update: doc.update_time || 0, title: v.title, category: v.category || '企业事实', content: t.value, source_url: v.source_url }); UK.toast('已保存'); onDone && onDone(); }
          catch (e) { setErr(c, e.message); c.busy('ok', false); return false; }
        }
      });
    }
    function docView(brandId, doc, cats, onDone) {
      const box = document.createElement('div'); box.className = 'bs-docview';
      box.innerHTML = '<div class="bs-docview-meta"><span class="bs-chip">' + esc(doc.category || '企业事实') + '</span><span class="uk-meta num">' + fmt(words(doc.content)) + ' 字</span><span class="uk-meta-sep uk-meta"></span><span class="uk-meta">更新于 ' + esc(ago(doc.update_time)) + '</span>' +
        (isUrl(doc.source_url) ? '<span class="uk-meta-sep uk-meta"></span><a class="bs-link" href="' + esc(doc.source_url) + '" target="_blank" rel="noopener noreferrer">' + icon('external') + '<span>查看来源</span></a>' : '') + '</div><div class="bs-docview-text">' + esc(doc.content) + '</div>';
      UK.dialog({ title: doc.title, width: 680, body: box, actions: [{ key: 'edit', label: '编辑', kind: 'secondary', icon: 'edit' }], onAction(k) { if (k === 'edit') setTimeout(() => docDialog(brandId, doc, null, cats, onDone), 0); } });
    }

    /* ---------- recycle drawer (brands + stores) ---------- */
    function recycleDrawer(onDone) {
      const box = document.createElement('div'); box.className = 'bs-bin';
      let seg = 'brand', data = { brand: null, store: null };
      const draw = () => {
        const rows = data[seg];
        box.innerHTML = '<div class="uk-seg bs-bin-seg"><button type="button" data-seg="brand" aria-pressed="' + (seg === 'brand') + '">品牌' + (data.brand ? ' <span class="num">' + data.brand.length + '</span>' : '') + '</button><button type="button" data-seg="store" aria-pressed="' + (seg === 'store') + '">门店' + (data.store ? ' <span class="num">' + data.store.length + '</span>' : '') + '</button></div>' +
          (!rows ? '<div class="bs-bin-list">' + [1, 2, 3].map(() => '<div class="bs-bin-row">' + UK.skel('36px', 36, 10) + '<span style="flex:1;display:grid;gap:6px">' + UK.skel('50%', 14) + UK.skel('30%', 12) + '</span></div>').join('') + '</div>'
            : !rows.length ? empty({ icon: 'delete', title: seg === 'brand' ? '回收站里没有品牌' : '回收站里没有门店', compact: true })
            : '<div class="bs-bin-list">' + rows.map((r) => '<div class="bs-bin-row">' + logoHtml(r, 'is-sm') + '<span class="bs-bin-copy"><b>' + esc(r.name) + '</b><span class="uk-meta">移入于 ' + esc(ago(r.delete_time)) + '</span></span>' + btn({ kind: 'secondary', size: 'sm', icon: 'restore', label: '恢复', attrs: { 'data-restore': r.id } }) + '</div>').join('') + '</div>');
      };
      const load = () => { brandsAll(true).then((r) => { data.brand = r; draw(); }).catch((e) => UK.toast(e.message, 'fail')); storesOf(0, true).then((r) => { data.store = r; draw(); }).catch((e) => UK.toast(e.message, 'fail')); };
      box.addEventListener('click', async (e) => {
        const s = e.target.closest('[data-seg]'); if (s) { seg = s.dataset.seg; draw(); return; }
        const r = e.target.closest('[data-restore]'); if (!r) return;
        r.disabled = true; const id = Number(r.dataset.restore);
        try {
          if (seg === 'brand') { const row = data.brand.find((x) => Number(x.id) === id); await ws('brandRecycle', {}, { id, revision: row.revision, restore: true }); }
          else await ws('recycle', {}, { directory: 'store', id, restore: '1' });
          data[seg] = data[seg].filter((x) => Number(x.id) !== id); draw(); UK.toast('已恢复'); onDone && onDone();
        } catch (err) { r.disabled = false; UK.toast(err.message, 'fail', 4200); }
      });
      draw(); load();
      UK.dialog({ title: '回收站', drawer: true, width: 440, body: box });
    }

    /* =====================================================================================
       page
       ===================================================================================== */
    function page(root) {
      const S = { seq: 0, brands: null, brandStats: new Map(), detail: null, stores: null, staff: null, binding: null, mats: null, design: new Map(), dead: false, ai: undefined };
      const scopeTenant = UK.tenant();
      const isCurrent = () => !S.dead && root.isConnected && UK.path() === '/ai/stores' && UK.tenant() === scopeTenant;
      const $ = (s) => root.querySelector(s);
      root.innerHTML = '<div class="uk-page bs"><div class="bs-crumb" hidden></div><div class="uk-bar uk-pagehead bs-head"></div><div data-tabs></div><div class="bs-notice" hidden></div><div class="uk-card bs-win"></div></div>';
      const tabOpt = { items: [], value: '', tail: '', onChange: (k) => onTab(k) };
      const tabs = UK.tabs($('[data-tabs]'), tabOpt);
      let designer = null;

      /* ----- route: everything this page shows comes from the address ----- */
      function route() {
        const q = new URLSearchParams(location.search), h = location.hash.slice(1);
        const brand = Number(q.get('brand_id') || 0);
        let tab = q.get('tab') || ({ knowledge: 'knowledge', stores: 'stores', overview: 'profile' }[h] || 'profile');
        if (!['profile', 'knowledge', 'stores', 'staff', 'decor'].includes(tab)) tab = 'profile';
        return { brand, tab, store: Number(q.get('store_id') || 0), editor: q.get('store_editor') === '1', view: q.get('view') === 'stores' ? 'stores' : 'brands', bk: q.get('b') || '', st: q.get('s') || '', staffStore: Number(q.get('ss') || 0), cat: q.get('cat') || '' };
      }
      let R = route();
      function addr(next, push) {
        if (!isCurrent()) return false;
        const t = UK.tenant(); const q = new URLSearchParams(); if (t) q.set('tenant_id', t);
        const n = { ...R, ...next };
        if (n.brand) { q.set('brand_id', n.brand); if (n.tab !== 'profile') q.set('tab', n.tab); if (n.store && (n.tab === 'stores' || n.editor)) q.set('store_id', n.store); if (n.editor && n.store) q.set('store_editor', '1'); if (n.st && n.tab === 'stores') q.set('s', n.st); if (n.staffStore && n.tab === 'staff') q.set('ss', n.staffStore); if (n.cat && n.tab === 'knowledge') q.set('cat', n.cat); }
        else { if (n.view === 'stores') q.set('view', 'stores'); if (n.bk) q.set('b', n.bk); }
        const url = '/ai/stores' + (q.toString() ? '?' + q : '');
        UK.setView(url, { push: !!push });
        R = route(); return true;
      }
      // old GEO-only views moved to GEO; keep their links alive
      { const h = location.hash.slice(1); if (R.brand && (h === 'content' || h === 'statistics')) { const t = UK.tenant(); location.replace('/ai/geo?' + (t ? 'tenant_id=' + t + '&' : '') + 'brand_id=' + R.brand + '#' + (h === 'content' ? 'keywords' : 'effect')); return; } if (h) addr({}, false); }
      const nav = (next) => { if (!addr(next, true)) return; render(); window.scrollTo({ top: 0 }); };

      /* ----- data ----- */
      async function loadBrands(force) {
        if (S.brands && !force) return S.brands;
        const [brands, stores, staff] = await Promise.all([brandsAll(false), storesOf(0, false), pubStaff()]);
        S.brands = brands; S.allStores = stores; S.binding = staff;
        S.brandStats = new Map();
        brands.forEach((b) => S.brandStats.set(Number(b.id), { stores: 0, open: 0, soon: 0, expired: 0, off: 0, staff: 0, unbound: 0 }));
        stores.forEach((s) => { const st = S.brandStats.get(Number(s.brand_id)); if (!st) return; st.stores++; st[life(s).key]++; st.staff += Number(s.staff_count) || 0; });
        if (staff) { const brandOf = new Map(stores.map((s) => [Number(s.id), Number(s.brand_id)])); staff.forEach((x) => { const st = S.brandStats.get(brandOf.get(Number(x.store_id))); if (st && Number(x.status) === 1 && !x.wechat_bound) st.unbound++; }); }
        return brands;
      }
      async function loadDetail(force) {
        if (S.detail && Number(S.detail.brand.id) === R.brand && !force) return S.detail;
        const [d, stores, staff] = await Promise.all([ws('brandDetail', { id: R.brand }), storesOf(R.brand, false), pubStaff()]);
        // Publishing choices omit disabled stores; directory records remain the complete source.
        const bound = new Map((staff || []).map((x) => [Number(x.id), x.wechat_bound]));
        const lists = await Promise.all(stores.map(async (store) => {
          let page = 1, rows = [];
          while (true) {
            const r = await ws('storeStaff', { store_id: store.id, page });
            const batch = r.lists || []; rows = rows.concat(batch);
            if (!batch.length || rows.length >= Number(r.count || 0)) break;
            page++;
          }
          return rows.map((x) => ({ ...x, store_name: store.name, wechat_bound: bound.has(Number(x.id)) ? bound.get(Number(x.id)) : null }));
        }));
        S.detail = d; S.stores = stores; S.binding = staff; S.staff = lists.flat(); S.mats = null;
        aiOptions(R.brand).then((o) => { S.ai = !!o.text_available; S.aiNotice = o.text_notice; });
        return d;
      }

      /* ----- render ----- */
      function render() {
        if (S.dead) return;
        closeDesigner();
        if (R.brand && R.editor && R.store) { openDesigner(R.store); return; }
        if (R.brand) renderBrand(); else renderList();
      }
      function head(title, actions, opt = {}) {
        $('.bs-head').innerHTML = (opt.logo || '') + '<div class="bs-title"><div class="bs-title-line"><h1>' + esc(title) + '</h1>' + (opt.ring || '') + '</div>' + (opt.sub ? '<div class="bs-sub">' + opt.sub + '</div>' : '') + '</div><span class="uk-grow"></span><div class="uk-actions">' + (actions || '') + '</div>';
        $('.bs-head').classList.toggle('has-logo', !!opt.logo);
      }
      function notice(html) { const n = $('.bs-notice'); n.hidden = !html; n.innerHTML = html || ''; }
      const busy = (on) => $('.bs-win').setAttribute('aria-busy', on ? 'true' : 'false');

      /* ===================== list: brands / all stores ===================== */
      async function renderList() {
        const seq = ++S.seq;
        $('.bs-crumb').hidden = true; notice('');
        head('品牌与门店', btn({ kind: 'primary', size: 'lg', icon: 'plus', label: '创建品牌', attrs: { 'data-new-brand': '' } }));
        tabOpt.tail = '<button type="button" class="bs-trash-link" data-bin>' + icon('delete') + '<span>回收站</span></button>';
        tabs.set([{ key: 'brands', label: '品牌', count: S.brands ? S.brands.length : null }, { key: 'stores', label: '门店', count: S.allStores ? S.allStores.length : null }], R.view);
        const win = $('.bs-win'); win.className = 'uk-card bs-win' + (R.view === 'stores' ? ' has-nav' : '');
        if (!S.brands) win.innerHTML = R.view === 'stores' ? skelStores(true) : skelBrands();
        try { await loadBrands(); } catch (e) { if (seq === S.seq) win.innerHTML = errBox(e.message); return; }
        if (seq !== S.seq) return;
        tabs.set([{ key: 'brands', label: '品牌', count: S.brands.length }, { key: 'stores', label: '门店', count: S.allStores.length }], R.view);
        if (R.view === 'stores') drawAllStores(); else drawBrandGrid();
      }
      function skelBrands() { return '<div class="bs-tools">' + UK.skel('280px', 36, 10) + '</div><div class="bs-brands">' + [0, 1, 2].map(() => '<div class="bs-bcard is-skel"><span class="uk-skel bs-bcover"></span><div class="bs-binfo">' + UK.skel('70%', 14) + UK.skel('40%', 12) + '</div></div>').join('') + '</div>'; }
      function skelStores(withNav) { return (withNav ? '<aside class="bs-nav">' + [1, 2, 3, 4].map(() => '<div class="bs-nrow">' + UK.skel('70%', 14) + '</div>').join('') + '</aside>' : '') + '<section class="bs-main"><div class="bs-tools">' + UK.skel('240px', 36, 10) + '</div><div class="bs-stores">' + [0, 1, 2, 3].map(() => '<div class="bs-scard is-skel">' + UK.skel('40px', 40, 12) + '<div style="display:grid;gap:8px;flex:1">' + UK.skel('70%', 14) + UK.skel('90%', 12) + '</div></div>').join('') + '</div></section>'; }
      const errBox = (m) => '<div class="bs-errbox">' + empty({ icon: 'alert', title: m || '读取失败', actions: [{ kind: 'secondary', label: '重新读取', attrs: { 'data-retry': '' } }], compact: true }) + '</div>';

      function brandCard(b, i) {
        const st = S.brandStats.get(Number(b.id)) || {};
        const cover = b.cover && b.cover.url;
        const parts = [];
        if (st.soon) parts.push(status('wait', '即将到期 ' + st.soon));
        if (st.expired) parts.push(status('fail', '已到期 ' + st.expired));
        if (st.off) parts.push(status('off', '已停用 ' + st.off));
        if (st.stores && !parts.length) parts.push(status('ok', st.open === st.stores ? '全部营业中' : '营业中 ' + st.open));
        return '<article class="bs-bcard" style="--i:' + i + '" data-brand="' + b.id + '" tabindex="0" aria-label="' + esc(b.name) + '">' +
          '<div class="bs-bcover' + (cover ? '' : ' is-empty') + '">' + (cover ? '<img src="' + esc(cover) + '" alt="" loading="lazy">' : '<span class="bs-bcover-mark">' + logoHtml(b, 'is-xl') + '</span>') +
          '<div class="bs-bcap">' + (cover ? logoHtml(b, 'is-md is-onimg') : '') + '<span class="bs-bcap-copy"><b>' + esc(b.name) + '</b><small>' + esc([b.industry || (Number(b.legacy) ? '默认品牌' : ''), b.address ? b.address.replace(/^(.{2,3}?[省市]).*$/, '$1') : ''].filter(Boolean).join(' · ') || '还没写行业') + '</small></span></div>' +
          '<div class="bs-ov"><button type="button" data-more="' + b.id + '" aria-label="更多操作" aria-haspopup="menu">' + icon('more') + '</button></div></div>' +
          '<div class="bs-binfo">' +
          '<div class="bs-bstats"><span><b class="num">' + fmt(st.stores || 0) + '</b><small>门店</small></span><span><b class="num">' + fmt(st.staff || 0) + '</b><small>员工</small></span><span><b class="num">' + fmt(b.keyword_count || 0) + '</b><small>关键词</small></span><span><b class="num">' + fmt(b.article_count || 0) + '</b><small>文章</small></span><span class="uk-grow"></span>' + ring(Number(b.complete) || 0, Number(b.total) || 7, { attrs: ' data-ring="' + b.id + '"' }) + '</div>' +
          '<div class="bs-bfoot">' + (parts.join('') || '<span class="uk-meta">还没有门店</span>') + (st.unbound ? '<span class="bs-warn" data-tip="这些员工还没绑定公众号，派任务时收不到通知">' + icon('bell') + '<span class="num">' + st.unbound + '</span> 人收不到通知</span>' : '') + '</div>' +
          '</div></article>';
      }
      function drawBrandGrid() {
        const win = $('.bs-win'); const kw = (R.bk || '').trim();
        const rows = S.brands.filter((b) => !kw || b.name.includes(kw));
        win.innerHTML = (S.brands.length ? '<div class="bs-tools"><label class="uk-search bs-search">' + icon('search') + '<input class="uk-input" data-q placeholder="搜索品牌名称" maxlength="80" value="' + esc(kw) + '"></label><span class="uk-grow"></span><span class="uk-meta bs-total">' + (kw ? '找到 ' : '共 ') + '<span class="num">' + rows.length + '</span> 个品牌</span></div>' : '') +
          (!S.brands.length ? '<div class="bs-blank">' + empty({ icon: 'store', title: '还没有品牌', actions: [{ kind: 'primary', icon: 'plus', label: '创建品牌', attrs: { 'data-new-brand': '' } }] }) + '<p class="uk-meta">一个品牌下面可以有多家门店；GEO 按品牌写文章，种草卡和员工任务按门店走</p></div>'
            : !rows.length ? '<div class="bs-blank">' + empty({ icon: 'search', title: '没有叫「' + kw + '」的品牌', actions: [{ kind: 'secondary', label: '清除搜索', attrs: { 'data-clear-q': '' } }], compact: true }) + '</div>'
            : '<div class="bs-brands">' + rows.map(brandCard).join('') + '</div>');
      }
      function storeCard(s, i, opt = {}) {
        const l = life(s), left = leftText(l);
        const brand = opt.brandName || '', inBrand = !opt.cross;
        const title = inBrand ? short(s.name, brand) : s.name;
        const sub = inBrand || s.name.startsWith(brand) ? (where(s) || '还没填地址') : brand + ' · ' + (where(s) || '还没填地址');
        return '<article class="bs-scard is-' + l.key + '" style="--i:' + i + '" data-store="' + s.id + '" data-brand="' + s.brand_id + '" tabindex="0" aria-label="' + esc(s.name) + '">' +
          '<div class="bs-shead">' + logoHtml(s, 'is-md') + '<span class="bs-scopy"><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></span></div>' +
          '<div class="bs-sfacts"><span>' + icon('users') + '<b class="num">' + fmt(s.staff_count || 0) + '</b> 名员工</span><span>' + icon('clock') + esc(s.business_hours || '未填营业时间') + '</span></div>' +
          '<div class="bs-sfoot">' + status(l.dot, l.text) + (left ? '<span class="bs-left is-' + l.key + ' num">' + esc(left) + '</span>' : '<span class="uk-meta">' + (s.expire_time ? '到期 ' + esc(date(s.expire_time)) : '长期有效') + '</span>') + '</div></article>';
      }
      function drawAllStores() {
        const win = $('.bs-win'); const b = Number(R.bk) || 0;
        const counts = new Map(); S.allStores.forEach((s) => counts.set(Number(s.brand_id), (counts.get(Number(s.brand_id)) || 0) + 1));
        const nameOf = new Map(S.brands.map((x) => [Number(x.id), x.name]));
        const kw = (win.dataset.kw || '').trim(), stf = win.dataset.st || '';
        let rows = S.allStores.filter((s) => (!b || Number(s.brand_id) === b) && (!kw || s.name.includes(kw)) && (!stf || life(s).key === stf));
        win.innerHTML = '<aside class="bs-nav" aria-label="品牌"><div class="bs-nhead">品牌</div>' + navRow('0', '全部门店', S.allStores.length, !b, icon('store')) + S.brands.map((x) => navRow(String(x.id), x.name, counts.get(Number(x.id)) || 0, b === Number(x.id), logoHtml(x, 'is-xs'))).join('') + '</aside>' +
          '<section class="bs-main"><div class="bs-tools"><label class="uk-search bs-search">' + icon('search') + '<input class="uk-input" data-q-store placeholder="搜索门店名称" maxlength="80" value="' + esc(kw) + '"></label><select class="uk-select bs-filter" data-st-filter aria-label="门店状态"><option value="">全部状态</option>' + [['open', '营业中'], ['soon', '即将到期'], ['expired', '已到期'], ['off', '已停用']].map(([k, t]) => '<option value="' + k + '"' + (stf === k ? ' selected' : '') + '>' + t + '</option>').join('') + '</select><span class="uk-grow"></span><span class="uk-meta bs-total">共 <span class="num">' + rows.length + '</span> 家</span></div>' +
          (rows.length ? '<div class="bs-stores">' + rows.map((s, i) => storeCard(s, i, { cross: true, brandName: nameOf.get(Number(s.brand_id)) || '' })).join('') + '</div>'
            : '<div class="bs-blank">' + (S.allStores.length ? empty({ icon: 'search', title: '没有符合条件的门店', actions: [{ kind: 'secondary', label: '清除筛选', attrs: { 'data-clear-store': '' } }], compact: true }) : empty({ icon: 'store', title: '还没有门店', compact: true })) + '</div>') + '</section>';
        win.dataset.kw = kw; win.dataset.st = stf;
      }

      /* ===================== brand detail ===================== */
      const TABS = [['profile', '资料'], ['knowledge', '知识库'], ['stores', '门店'], ['staff', '员工'], ['decor', '装修']];
      async function renderBrand() {
        const seq = ++S.seq; const win = $('.bs-win');
        const t = UK.tenant();
        $('.bs-crumb').hidden = false; $('.bs-crumb').innerHTML = '<a class="bs-back" href="' + esc(UK.withTenant('/ai/stores')) + '" data-to-list>' + icon('chevronLeft') + '<span>全部品牌</span></a>';
        tabOpt.tail = '';
        const known = S.detail && Number(S.detail.brand.id) === R.brand;
        if (!known) { head('', ''); $('.bs-head').innerHTML = '<span class="bs-logo is-lg uk-skel"></span><div class="bs-title">' + UK.skel('220px', 30, 8) + UK.skel('160px', 14) + '</div>'; tabs.set(TABS.map(([k, l]) => ({ key: k, label: l })), R.tab); win.className = 'uk-card bs-win'; win.innerHTML = skelStores(R.tab !== 'profile' && R.tab !== 'decor'); notice(''); }
        try { await loadDetail(); } catch (e) { if (seq === S.seq) { win.innerHTML = errBox(e.message); $('.bs-head').innerHTML = '<div class="bs-title"><h1>品牌与门店</h1></div>'; } return; }
        if (seq !== S.seq) return;
        drawBrandHead();
        tabs.set(TABS.map(([k, l]) => ({ key: k, label: l, count: k === 'knowledge' ? S.detail.metrics.materials : k === 'stores' ? S.stores.length : k === 'staff' ? S.staff.length : undefined })), R.tab);
        drawTab();
      }
      function drawBrandHead() {
        const d = S.detail, b = d.brand, done = FIELDS.filter(([k]) => filled(d.profile[k])).length;
        const sub = [d.profile.industry, S.stores.length + ' 家门店', b.address].filter(Boolean).map(esc).join('<span class="uk-meta-sep"></span>');
        const actions = (R.tab === 'knowledge' ? btn({ kind: 'secondary', size: 'lg', icon: 'upload', label: '导入文档', attrs: { 'data-doc-import': '' } }) + btn({ kind: 'primary', size: 'lg', icon: 'plus', label: '新增文档', attrs: { 'data-doc-new': '' } })
          : R.tab === 'stores' && !R.store ? btn({ kind: 'secondary', size: 'lg', icon: 'upload', label: '批量创建', attrs: { 'data-store-batch': '' } }) + btn({ kind: 'primary', size: 'lg', icon: 'plus', label: '创建门店', attrs: { 'data-store-new': '' } })
          : R.tab === 'staff' ? btn({ kind: 'secondary', size: 'lg', icon: 'upload', label: '批量导入', attrs: { 'data-staff-import': '' } }) + btn({ kind: 'primary', size: 'lg', icon: 'plus', label: '新增员工', attrs: { 'data-staff-new': '' } })
          : '') +
          btn({ kind: 'ghost', size: 'lg', icon: 'more', iconOnly: true, label: '更多', attrs: { 'data-brand-more': '', 'aria-haspopup': 'menu' } });
        head(b.name, actions, { logo: logoHtml(b, 'is-lg'), sub, ring: ring(done, 7, { attrs: ' data-ring="' + b.id + '"' }) });
      }
      function onTab(k) {
        if (R.brand) { addr({ tab: k, store: 0, editor: false }, false); drawBrandHead(); drawTab(); }
        else { addr({ view: k, bk: '' }, false); renderList(); }
      }
      function drawTab() {
        const win = $('.bs-win'); win.className = 'uk-card bs-win'; notice('');
        if (R.tab === 'profile') drawProfile();
        else if (R.tab === 'knowledge') drawKnowledge();
        else if (R.tab === 'stores') R.store ? drawStore() : drawStores();
        else if (R.tab === 'staff') drawStaff();
        else drawDecor();
      }

      /* ----- 资料 ----- */
      function drawProfile() {
        const win = $('.bs-win'); const d = S.detail, p = d.profile, b = d.brand;
        win.classList.add('has-nav');
        const secs = [['base', '基本信息', filled(p.brand_name) && filled(p.industry)]].concat(LONG.map(([k, l]) => [k, l, filled(p[k])]));
        const dl = (label, val, link) => '<div class="bs-dl-row"><dt>' + esc(label) + '</dt><dd>' + (filled(val) ? (link && isUrl(val) ? '<a class="bs-link" href="' + esc(val) + '" target="_blank" rel="noopener noreferrer">' + esc(val) + '</a>' : esc(val)) : '<span class="bs-none">未填写</span>') + '</dd></div>';
        win.innerHTML = '<aside class="bs-nav" aria-label="资料分区"><div class="bs-nhead">资料</div>' + secs.map(([k, l, ok], i) => navRow(k, l, null, i === 0, dotIcon(ok ? 'ok' : 'off'))).join('') +
          '</aside>' +
          '<section class="bs-main bs-profile">' +
          '<div class="bs-sec" id="bs-sec-base"><div class="bs-sec-head"><h2>基本信息</h2><span class="uk-grow"></span>' + btn({ kind: 'ghost', size: 'sm', icon: 'edit', label: '编辑', attrs: { 'data-brand-edit': '' } }) + '</div>' +
          '<div class="bs-base"><dl class="bs-dl">' + dl('品牌名称', b.name) + dl('所属行业', p.industry) + dl('官方网站', p.website, true) + dl('联系人', b.contact) + dl('联系电话', b.mobile) + dl('联系邮箱', b.email) + dl('联系地址', b.address) + '</dl>' +
          '<div class="bs-art"><div class="bs-art-cover">' + (b.cover && b.cover.url ? '<img src="' + esc(b.cover.url) + '" alt="品牌封面">' : '<span class="bs-none">还没有封面</span>') + '</div><div class="bs-art-cap">' + logoHtml(b, 'is-md') + '<span class="uk-meta">Logo</span><span class="uk-grow"></span><span class="uk-meta">封面</span></div></div></div></div>' +
          LONG.map(([k, label, max, ph]) => '<div class="bs-sec" id="bs-sec-' + k + '" data-sec="' + k + '"><div class="bs-sec-head"><h2>' + esc(label) + '</h2>' + (filled(p[k]) ? '<span class="uk-meta num">' + fmt(words(p[k])) + ' 字</span>' : '') + '<span class="uk-grow"></span>' + (filled(p[k]) ? btn({ kind: 'ghost', size: 'sm', icon: 'edit', label: '编辑', attrs: { 'data-sec-edit': k } }) : '') + '</div>' +
            (filled(p[k]) ? '<div class="bs-prose">' + esc(p[k]) + '</div>' : '<button type="button" class="bs-fill" data-sec-edit="' + k + '">' + icon('plusCircle') + '<span><b>补充' + esc(label) + '</b><small>' + esc(ph) + '</small></span></button>') + '</div>').join('') +
          '</section>';
        const main = win.querySelector('.bs-profile');
        // highlight the section in view
        const io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) { const k = e.target.id.replace('bs-sec-', ''); win.querySelectorAll('.bs-nrow').forEach((r) => r.classList.toggle('is-on', r.querySelector('[data-nav]').dataset.nav === k)); } }); }, { rootMargin: '-30% 0px -60% 0px' });
        main.querySelectorAll('.bs-sec').forEach((s) => io.observe(s));
      }
      function editSection(k) {
        const sec = $('[data-sec="' + k + '"]'); if (!sec) return;
        const p = S.detail.profile, [, label, max, ph] = LONG.find((x) => x[0] === k);
        sec.classList.add('is-editing');
        sec.innerHTML = '<div class="bs-sec-head"><h2>' + esc(label) + '</h2></div><textarea class="uk-textarea bs-sec-area" maxlength="' + max + '" rows="7" placeholder="' + esc(ph) + '">' + esc(p[k] || '') + '</textarea>' +
          '<div class="bs-sec-tools"><span class="uk-meta num" data-n></span><span class="uk-grow"></span>' + aiButton(S.ai, 'data-sec-ai', k) + btn({ kind: 'secondary', size: 'sm', label: '取消', attrs: { 'data-sec-cancel': '' } }) + btn({ kind: 'primary', size: 'sm', label: '保存', attrs: { 'data-sec-save': k } }) + '</div>';
        const t = sec.querySelector('textarea'), n = sec.querySelector('[data-n]');
        const count = () => { n.textContent = fmt(Array.from(t.value).length) + ' / ' + fmt(max); }; count(); t.addEventListener('input', count);
        t.focus(); t.setSelectionRange(t.value.length, t.value.length);
        if (S.ai === undefined) aiOptions(R.brand).then((o) => { S.ai = !!o.text_available; S.aiNotice = o.text_notice; const a = sec.querySelector('[data-sec-ai]'); if (a) a.outerHTML = aiButton(S.ai, 'data-sec-ai', k); });
      }
      async function saveSection(k, btnEl) {
        const sec = $('[data-sec="' + k + '"]'); const v = sec.querySelector('textarea').value.trim();
        const p = S.detail.profile; btnEl.disabled = true; btnEl.classList.add('is-busy');
        try {
          const body = { id: R.brand, revision: p.revision }; FIELDS.forEach(([f]) => { body[f] = f === k ? v : (p[f] || ''); });
          const r = await ws('brandKnowledgeSave', {}, body);
          Object.assign(p, body, { revision: r.revision }); S.detail.brand.revision = r.brand_revision; S.detail.brand.complete = FIELDS.filter(([f]) => filled(p[f])).length;
          if (S.brands) { const row = S.brands.find((x) => Number(x.id) === R.brand); if (row) row.complete = S.detail.brand.complete; }
          UK.toast('已保存'); drawBrandHead(); drawProfile(); setTimeout(() => { const s = $('#bs-sec-' + k); s && s.scrollIntoView({ block: 'nearest' }); }, 30);
        } catch (e) { UK.toast(e.message, 'fail', 4200); btnEl.disabled = false; btnEl.classList.remove('is-busy'); }
      }

      /* ----- 知识库 ----- */
      async function drawKnowledge() {
        const win = $('.bs-win'); win.classList.add('has-nav');
        const d = S.detail, p = d.profile;
        const counts = new Map(); (d.knowledge_categories || []).forEach((c) => counts.set(c.category, (counts.get(c.category) || 0) + Number(c.total)));
        const cats = [...new Set([...CATS.filter((c) => counts.has(c)), ...counts.keys()])];
        const empties = CATS.filter((c) => !counts.has(c));
        const cat = R.cat;
        win.innerHTML = '<aside class="bs-nav" aria-label="知识分类"><div class="bs-nhead">分类</div>' + navRow('', '全部文档', d.metrics.materials, !cat, icon('book')) + cats.map((c) => navRow(c, c, counts.get(c) || 0, cat === c, icon('folder'))).join('') +
          (empties.length ? '<div class="bs-nhead bs-nhead-sub">还没有文档</div>' + empties.map((c) => navRow(c, c, null, cat === c, icon('folder'), '')).join('') : '') + '</aside>' +
          '<section class="bs-main"><div class="bs-tools"><label class="uk-search bs-search">' + icon('search') + '<input class="uk-input" data-q-doc placeholder="搜索文档名称" maxlength="80"></label><span class="uk-grow"></span><span class="uk-meta bs-total"></span></div><div class="bs-docs-wrap"><div class="bs-docs">' + [0, 1, 2, 3, 4, 5].map(() => '<div class="bs-doc is-skel">' + UK.skel('60%', 16, 8) + UK.skel('100%', 12) + UK.skel('80%', 12) + '</div>').join('') + '</div></div><div class="bs-pager"></div></section>';
        S.docPage = 1; loadDocs();
      }
      async function loadDocs() {
        const win = $('.bs-win'); const wrap = win.querySelector('.bs-docs-wrap'); if (!wrap) return;
        const seq = ++S.seq; const p = S.detail.profile; const kw = (win.querySelector('[data-q-doc]').value || '').trim(); const cat = R.cat;
        wrap.setAttribute('aria-busy', 'true');
        try {
          const r = await geo(R.brand, 'workspaceRecords', { kind: 'materials', category: cat, keyword: kw, page: S.docPage });
          if (seq !== S.seq) return;
          S.mats = r.lists;
          // the profile itself is the first "document": show which parts are written
          const prof = (!cat || cat === '品牌介绍') && !kw && S.docPage === 1;
          const done = FIELDS.filter(([k]) => filled(p[k])).length;
          const profCard = prof ? '<article class="bs-doc is-profile" data-goto-profile tabindex="0"><span class="bs-chip is-accent">企业资料</span><b>' + esc(S.detail.brand.name) + ' · 企业知识</b><p>' + esc(p.intro || '品牌名称、行业、介绍、产品、客户、竞品——GEO 写稿默认带上这些事实。') + '</p><div class="bs-doc-meta">' + ring(done, 7, { tag: 'span', tip: '已完善 ' + done + ' / 7' }) + '<span class="uk-grow"></span><span class="uk-meta">在「资料」里编辑</span></div></article>' : '';
          wrap.innerHTML = (r.lists.length || prof) ? '<div class="bs-docs">' + profCard + r.lists.map((m, i) => '<article class="bs-doc" style="--i:' + i + '" data-doc="' + m.id + '" tabindex="0"><span class="bs-chip">' + esc(m.category || '企业事实') + '</span><b>' + esc(m.title) + '</b><p>' + esc(m.content) + '</p><div class="bs-doc-meta"><span class="uk-meta num">' + fmt(words(m.content)) + ' 字</span><span class="uk-meta-sep uk-meta"></span><span class="uk-meta">' + esc(ago(m.update_time)) + '</span>' + (isUrl(m.source_url) ? '<span class="bs-src" data-tip="有来源链接">' + icon('link') + '</span>' : '') + '<span class="uk-grow"></span><button type="button" class="bs-doc-edit" data-doc-edit="' + m.id + '" aria-label="编辑">' + icon('edit') + '</button></div></article>').join('') + '</div>'
            : '<div class="bs-blank">' + (kw ? empty({ icon: 'search', title: '没有标题包含「' + kw + '」的文档', compact: true }) : empty({ icon: 'book', title: cat ? '「' + cat + '」还没有文档' : '知识库还是空的', actions: [{ kind: 'primary', icon: 'plus', label: '新增文档', attrs: { 'data-doc-new': '' } }, { kind: 'secondary', icon: 'upload', label: '导入 TXT / Markdown', attrs: { 'data-doc-import': '' } }] })) + '<p class="uk-meta">' + esc(cat === '常见问题' ? '把顾客常问的问题和标准答案写下来，GEO 回答类文章最爱用' : '一篇文档写一件事，标题写清楚是什么，正文写可以核查的事实') + '</p></div>';
          win.querySelector('.bs-total').innerHTML = '共 <span class="num">' + fmt(r.count) + '</span> 篇';
          const pg = win.querySelector('.bs-pager'); pg.innerHTML = r.count > 20 ? UK.pager(r.count, S.docPage, 20) : '';
        } catch (e) { if (seq === S.seq) wrap.innerHTML = errBox(e.message); }
        finally { wrap.removeAttribute('aria-busy'); }
      }
      function catsKnown() { return (S.detail.knowledge_categories || []).map((c) => c.category); }
      const refreshDetail = async (keepTab) => { S.detail = null; await loadDetail(true); drawBrandHead(); tabs.set(TABS.map(([k, l]) => ({ key: k, label: l, count: k === 'knowledge' ? S.detail.metrics.materials : k === 'stores' ? S.stores.length : k === 'staff' ? S.staff.length : undefined })), R.tab); if (keepTab !== false) drawTab(); S.brands = null; };

      /* ----- 门店 (inside a brand) ----- */
      function drawStores() {
        const win = $('.bs-win'); win.classList.add('has-nav');
        const by = { open: 0, soon: 0, expired: 0, off: 0 }; S.stores.forEach((s) => by[life(s).key]++);
        const f = R.st || '', kw = (win.dataset.kw || '').trim();
        const rows = S.stores.filter((s) => (!f || life(s).key === f) && (!kw || s.name.includes(kw)));
        const soon = S.stores.filter((s) => life(s).key === 'soon').length, expired = by.expired;
        notice(soon + expired >= 2 ? '<div class="uk-notice">' + icon('warn') + '<span class="uk-grow"><b>' + (expired ? expired + ' 家门店已到期' + (soon ? '，' : '') : '') + (soon ? soon + ' 家 30 天内到期' : '') + '</b>，记得提前申请续期</span>' + btn({ kind: 'secondary', size: 'sm', label: '查看', attrs: { 'data-nav-go': expired ? 'expired' : 'soon' } }) + '</div>' : '');
        win.innerHTML = '<aside class="bs-nav" aria-label="门店状态"><div class="bs-nhead">门店</div>' + navRow('', '全部门店', S.stores.length, !f, icon('store')) + [['open', '营业中', 'ok'], ['soon', '即将到期', 'wait'], ['expired', '已到期', 'fail'], ['off', '已停用', 'off']].map(([k, l, d]) => navRow(k, l, by[k], f === k, dotIcon(d))).join('') +
          '<div class="bs-nsplit"></div>' + navRow('bin', '回收站', null, false, icon('delete')) + '</aside>' +
          '<section class="bs-main"><div class="bs-tools"><label class="uk-search bs-search">' + icon('search') + '<input class="uk-input" data-q-store placeholder="搜索门店名称" maxlength="80" value="' + esc(kw) + '"></label><span class="uk-grow"></span><span class="uk-meta bs-total">共 <span class="num">' + rows.length + '</span> 家</span></div>' +
          (rows.length ? '<div class="bs-stores">' + rows.map((s, i) => storeCard(s, i, { brandName: S.detail.brand.name })).join('') + '</div>'
            : '<div class="bs-blank">' + (S.stores.length ? empty({ icon: 'search', title: f ? '没有' + { open: '营业中', soon: '即将到期', expired: '已到期', off: '已停用' }[f] + '的门店' : '没有符合条件的门店', actions: [{ kind: 'secondary', label: '清除筛选', attrs: { 'data-clear-store': '' } }], compact: true })
              : empty({ icon: 'store', title: '「' + S.detail.brand.name + '」还没有门店', actions: [{ kind: 'primary', icon: 'plus', label: '创建门店', attrs: { 'data-store-new': '' } }, { kind: 'secondary', icon: 'upload', label: '批量创建', attrs: { 'data-store-batch': '' } }] }) + '<p class="uk-meta">门店是种草卡和员工任务的单位；有很多家时用表格批量创建</p>') + '</div>') + '</section>';
        win.dataset.kw = kw;
      }
      async function drawStoreBin() {
        const win = $('.bs-win'); const main = win.querySelector('.bs-main');
        win.querySelectorAll('.bs-nrow').forEach((r) => r.classList.toggle('is-on', r.querySelector('[data-nav]').dataset.nav === 'bin'));
        main.innerHTML = '<div class="bs-tools"><b class="bs-tools-title">门店回收站</b><span class="uk-grow"></span><span class="uk-meta">恢复后门店、员工和装修都还在</span></div><div class="bs-bin-list is-wide">' + UK.skel('100%', 56, 12) + '</div>';
        try {
          const rows = await storesOf(R.brand, true);
          main.querySelector('.bs-bin-list').innerHTML = rows.length ? rows.map((r) => '<div class="bs-bin-row">' + logoHtml(r, 'is-sm') + '<span class="bs-bin-copy"><b>' + esc(r.name) + '</b><span class="uk-meta">移入于 ' + esc(ago(r.delete_time)) + '</span></span>' + btn({ kind: 'secondary', size: 'sm', icon: 'restore', label: '恢复', attrs: { 'data-store-restore': r.id } }) + '</div>').join('') : empty({ icon: 'delete', title: '回收站里没有门店', compact: true });
        } catch (e) { main.querySelector('.bs-bin-list').innerHTML = errBox(e.message); }
      }
      async function drawStore() {
        const win = $('.bs-win'); win.classList.remove('has-nav'); notice('');
        const s = S.stores.find((x) => Number(x.id) === R.store);
        if (!s) { win.innerHTML = '<div class="bs-blank">' + empty({ icon: 'store', title: '这家门店不在「' + S.detail.brand.name + '」下，可能已移入回收站', actions: [{ kind: 'secondary', label: '返回全部门店', attrs: { 'data-store-back': '' } }], compact: true }) + '</div>'; return; }
        const l = life(s), left = leftText(l);
        const staff = S.staff.filter((x) => Number(x.store_id) === Number(s.id));
        const dl = (label, val) => '<div class="bs-dl-row"><dt>' + esc(label) + '</dt><dd>' + (filled(val) ? esc(val) : '<span class="bs-none">未填写</span>') + '</dd></div>';
        win.innerHTML = '<div class="bs-store">' +
          '<div class="bs-store-top"><button type="button" class="bs-back" data-store-back>' + icon('chevronLeft') + '<span>全部门店</span></button></div>' +
          '<div class="bs-store-head">' + logoHtml(s, 'is-lg') + '<div class="bs-store-title"><h2>' + esc(s.name) + '</h2><div class="bs-sub">' + status(l.dot, l.text) + (left ? '<span class="bs-left is-' + l.key + ' num">' + esc(left) + '</span>' : '') + (s.expire_time ? '<span class="uk-meta">到期 ' + esc(date(s.expire_time)) + '</span>' : '<span class="uk-meta">长期有效</span>') + '</div></div><span class="uk-grow"></span>' +
          btn({ kind: 'secondary', icon: 'layout', label: '装修门店页', attrs: { 'data-decor': s.id } }) + btn({ kind: 'secondary', icon: 'edit', label: '编辑门店', attrs: { 'data-store-edit': s.id } }) + btn({ kind: 'ghost', icon: 'more', iconOnly: true, label: '更多', attrs: { 'data-store-more': s.id, 'aria-haspopup': 'menu' } }) + '</div>' +
          '<div class="bs-store-body"><div class="bs-store-col"><div class="bs-sec-head"><h3>门店资料</h3></div><dl class="bs-dl">' + dl('门店电话', s.mobile) + dl('联系人', s.contact) + dl('营业时间', s.business_hours) + dl('地址', where(s)) + dl('位置坐标', s.coordinates) + dl('POI ID', s.poi_id) + dl('门店简介', s.description) + '</dl></div>' +
          '<div class="bs-store-col"><div class="bs-sec-head"><h3>员工</h3><span class="uk-meta num">' + staff.length + '</span><span class="uk-grow"></span>' + btn({ kind: 'ghost', size: 'sm', icon: 'plus', label: '添加', attrs: { 'data-staff-new': s.id } }) + (staff.length ? btn({ kind: 'ghost', size: 'sm', label: '管理全部', attrs: { 'data-staff-of': s.id } }) : '') + '</div>' +
          (staff.length ? '<div class="bs-mini">' + staff.slice(0, 6).map((x) => '<div class="bs-mini-row"><span class="bs-av">' + mono(x.name) + '</span><span class="bs-mini-copy"><b>' + esc(x.name) + '</b><span class="uk-meta num">' + esc(mask(x.mobile)) + '</span></span>' + bindHtml(x) + '</div>').join('') + (staff.length > 6 ? '<button type="button" class="bs-link bs-mini-more" data-staff-of="' + s.id + '">还有 ' + (staff.length - 6) + ' 人</button>' : '') + '</div>' : '<p class="bs-mini-empty">还没有员工。添加后可以把成片派给他们发布。</p>') +
          '<div class="bs-sec-head bs-gap"><h3>申请记录</h3><span class="uk-grow"></span>' + btn({ kind: 'ghost', size: 'sm', label: '申请续期', attrs: { 'data-req': 'renewal' } }) + btn({ kind: 'ghost', size: 'sm', label: '申请激活码牌', attrs: { 'data-req': 'nfc' } }) + '</div><div class="bs-reqs">' + UK.skel('100%', 48, 10) + '</div></div></div></div>';
        loadRequests(s);
      }
      const REQ = { pending: ['wait', '待审核'], approved: ['ok', '已办理'], rejected: ['fail', '已驳回'], cancelled: ['off', '已撤回'] };
      async function loadRequests(s) {
        const box = $('.bs-reqs'); if (!box) return;
        try {
          const r = await ws('storeRequests', { store_id: s.id, page: 1 }); if (!box.isConnected) return;
          box.innerHTML = r.lists.length ? r.lists.map((x) => { let res = {}; try { res = JSON.parse(x.result || '{}') || {}; } catch (e) {} const st = REQ[x.status] || ['off', x.status];
            return '<div class="bs-req"><span class="bs-req-kind">' + (x.kind === 'nfc' ? '码牌激活' : '门店续期') + '</span><span class="bs-req-copy"><span>' + esc(x.note) + '</span>' + (res.note || res.reason ? '<small>' + esc(res.note || res.reason) + '</small>' : '') + '</span><span class="bs-req-side">' + status(st[0], st[1]) + '<span class="uk-meta">' + esc(ago(x.create_time)) + '</span>' + (x.status === 'pending' ? '<button type="button" class="bs-link" data-req-cancel="' + x.id + '">撤回</button>' : '') + '</span></div>'; }).join('')
            : '<p class="bs-mini-empty">还没有申请。续期、激活码牌都交给服务商办理，不会自动扣费。</p>';
        } catch (e) { box.innerHTML = '<p class="bs-err">' + esc(e.message) + '</p>'; }
      }

      /* ----- 员工 ----- */
      function bindHtml(x) {
        if (x.wechat_bound === null || x.wechat_bound === undefined) return '<span class="uk-meta">—</span>';
        return x.wechat_bound ? status('ok', '已绑定') : status('off', '未绑定');
      }
      function drawStaff() {
        const win = $('.bs-win'); win.classList.add('has-nav');
        const sf = R.staffStore, kw = (win.dataset.kw || '').trim();
        const cnt = new Map(); S.staff.forEach((x) => cnt.set(Number(x.store_id), (cnt.get(Number(x.store_id)) || 0) + 1));
        const rows = S.staff.filter((x) => (!sf || Number(x.store_id) === sf) && (!kw || x.name.includes(kw) || String(x.mobile).includes(kw)));
        const unbound = S.staff.filter((x) => Number(x.status) === 1 && x.wechat_bound === false).length;
        const storeName = new Map(S.stores.map((s) => [Number(s.id), short(s.name, S.detail.brand.name)]));
        win.innerHTML = '<aside class="bs-nav" aria-label="门店"><div class="bs-nhead">员工</div>' + navRow('0', '全部员工', S.staff.length, !sf, icon('users')) + '<div class="bs-nhead bs-nhead-sub">按门店</div>' + S.stores.map((s) => navRow(String(s.id), short(s.name, S.detail.brand.name), cnt.get(Number(s.id)) || 0, sf === Number(s.id), logoHtml(s, 'is-xs'))).join('') +
          '<div class="bs-nsplit"></div>' + navRow('bin', '回收站', null, false, icon('delete')) + '</aside>' +
          '<section class="bs-main"><div class="bs-tools"><label class="uk-search bs-search">' + icon('search') + '<input class="uk-input" data-q-staff placeholder="搜索姓名或手机号" maxlength="50" value="' + esc(kw) + '"></label><span class="uk-grow"></span><span class="uk-meta bs-total">共 <span class="num">' + rows.length + '</span> 人</span>' + (rows.length ? btn({ kind: 'ghost', size: 'sm', icon: 'download', label: '导出', attrs: { 'data-staff-export': '' } }) : '') + '</div>' +
          (unbound ? '<div class="bs-inline-note">' + icon('info') + '<span><b class="num">' + unbound + '</b> 名员工还没绑定公众号，派任务时收不到微信通知</span><span class="bs-info" data-tip="员工扫码绑定功能接入后，可以在这里发绑定邀请">' + icon('help') + '</span></div>' : '') +
          (rows.length ? '<div class="uk-table-wrap bs-table"><table class="uk-table"><thead><tr><th>员工</th><th>手机号</th><th>门店</th><th>公众号通知</th><th>状态</th><th>添加时间</th><th class="is-act"></th></tr></thead><tbody>' +
            rows.map((x) => '<tr data-staff="' + x.id + '"><td><span class="bs-who"><span class="bs-av">' + mono(x.name) + '</span><b>' + esc(x.name) + '</b></span></td><td class="num">' + esc(mask(x.mobile)) + '</td><td><span class="bs-cell-store">' + esc(storeName.get(Number(x.store_id)) || x.store_name || '') + '</span></td><td>' + bindHtml(x) + '</td><td>' + (Number(x.status) === 1 ? status('ok', '启用') : status('off', '停用')) + '</td><td class="uk-meta">' + esc(date(x.create_time)) + '</td><td class="is-act"><button type="button" class="bs-rowmore" data-staff-more="' + x.id + '" aria-label="更多" aria-haspopup="menu">' + icon('more') + '</button></td></tr>').join('') + '</tbody></table></div>'
            : '<div class="bs-blank">' + (S.staff.length ? empty({ icon: 'search', title: kw ? '没有找到「' + kw + '」' : '这家门店还没有员工', actions: kw ? [{ kind: 'secondary', label: '清除搜索', attrs: { 'data-clear-staff': '' } }] : [{ kind: 'primary', icon: 'plus', label: '新增员工', attrs: { 'data-staff-new': sf || '' } }], compact: true })
              : S.stores.length ? empty({ icon: 'users', title: '还没有员工', actions: [{ kind: 'primary', icon: 'plus', label: '新增员工', attrs: { 'data-staff-new': '' } }, { kind: 'secondary', icon: 'upload', label: '批量导入', attrs: { 'data-staff-import': '' } }] }) + '<p class="uk-meta">员工按门店管理；派给员工的成片会通过公众号通知他们发布</p>'
              : empty({ icon: 'store', title: '先创建门店，再添加员工', actions: [{ kind: 'primary', icon: 'plus', label: '创建门店', attrs: { 'data-store-new': '' } }] })) + '</div>') + '</section>';
        win.dataset.kw = kw;
      }
      async function drawStaffBin() {
        const win = $('.bs-win'); const main = win.querySelector('.bs-main');
        win.querySelectorAll('.bs-nrow').forEach((r) => r.classList.toggle('is-on', r.querySelector('[data-nav]').dataset.nav === 'bin'));
        main.innerHTML = '<div class="bs-tools"><b class="bs-tools-title">员工回收站</b><span class="uk-grow"></span></div><div class="bs-bin-list is-wide">' + UK.skel('100%', 56, 12) + '</div>';
        try {
          const lists = await Promise.all(S.stores.map((s) => ws('storeStaff', { store_id: s.id, trash: '1', page: 1 }).then((r) => r.lists.map((x) => ({ ...x, store_name: s.name }))).catch(() => [])));
          const rows = lists.flat();
          main.querySelector('.bs-bin-list').innerHTML = rows.length ? rows.map((r) => '<div class="bs-bin-row"><span class="bs-av">' + mono(r.name) + '</span><span class="bs-bin-copy"><b>' + esc(r.name) + ' <span class="uk-meta num">' + esc(mask(r.mobile)) + '</span></b><span class="uk-meta">' + esc(r.store_name) + ' · 移入于 ' + esc(ago(r.delete_time)) + '</span></span>' + btn({ kind: 'secondary', size: 'sm', icon: 'restore', label: '恢复', attrs: { 'data-staff-restore': r.id, 'data-sid': r.store_id } }) + '</div>').join('') : empty({ icon: 'delete', title: '回收站里没有员工', compact: true });
        } catch (e) { main.querySelector('.bs-bin-list').innerHTML = errBox(e.message); }
      }

      /* ----- 装修 ----- */
      function drawDecor() {
        const win = $('.bs-win');
        if (!S.stores.length) { win.innerHTML = '<div class="bs-blank">' + empty({ icon: 'layout', title: '先创建门店，再装修门店页', actions: [{ kind: 'primary', icon: 'plus', label: '创建门店', attrs: { 'data-store-new': '' } }] }) + '</div>'; return; }
        win.innerHTML = '<div class="bs-tools"><b class="bs-tools-title">门店页装修</b><span class="bs-info" data-tip="顾客碰一碰种草卡打开的就是门店页，每家门店单独装修">' + icon('info') + '</span><span class="uk-grow"></span><span class="uk-meta bs-total">共 <span class="num">' + S.stores.length + '</span> 家</span></div>' +
          '<div class="bs-decor">' + S.stores.map((s, i) => { const d = S.design.get(Number(s.id));
            return '<div class="bs-drow" style="--i:' + i + '" data-decor-row="' + s.id + '">' + logoHtml(s, 'is-md') + '<span class="bs-dcopy"><b>' + esc(short(s.name, S.detail.brand.name)) + '</b><span class="uk-meta">' + esc(where(s) || '还没填地址') + '</span></span>' +
              '<span class="bs-dstate">' + (d ? (d.revision ? status('ok', '已装修') + '<span class="uk-meta">' + esc(ago(d.update_time)) + '保存</span>' : status('off', '还没装修')) : UK.skel('88px', 14)) + '</span>' +
              btn({ kind: 'secondary', size: 'sm', icon: 'layout', label: d && !d.revision ? '开始装修' : '去装修', attrs: { 'data-decor': s.id } }) + '</div>'; }).join('') + '</div>';
        // load design state a few at a time
        const todo = S.stores.filter((s) => !S.design.has(Number(s.id))); let k = 0; const seq = S.seq;
        const next = async () => { const s = todo[k++]; if (!s) return; try { const d = await ws('storeDesign', { store_id: s.id }); S.design.set(Number(s.id), { revision: Number(d.revision) || 0, update_time: Number(d.update_time) || 0 }); } catch (e) { S.design.set(Number(s.id), { revision: 0, update_time: 0, err: true }); } if (seq === S.seq && R.tab === 'decor') paintDecor(s.id); await next(); };
        next(); next(); next();
      }
      function paintDecor(id) {
        const row = $('[data-decor-row="' + id + '"]'); if (!row) return; const d = S.design.get(Number(id));
        row.querySelector('.bs-dstate').innerHTML = d.err ? '<span class="uk-meta">读取失败</span>' : d.revision ? status('ok', '已装修') + '<span class="uk-meta">' + esc(ago(d.update_time)) + '保存</span>' : status('off', '还没装修');
        if (!d.revision) row.querySelector('[data-decor] span').textContent = '开始装修';
      }
      function openDesigner(id) {
        const Designer = window.MerchantStoreDesigner;
        if (!Designer || !Designer.mount) { UK.toast('装修编辑器没有加载，请刷新页面后重试', 'fail'); addr({ editor: false }, false); render(); return; }
        const host = document.createElement('div'); host.className = 'bs-designer'; root.append(host);
        const wsApi = (action, params = {}, body) => ws(action, params, body);
        designer = Designer.mount(host, { api: wsApi, storeId: id, onBack: () => { S.design.delete(Number(id)); history.back(); } });
      }
      function closeDesigner() { if (designer) { try { designer.destroy && designer.destroy(); } catch (e) {} designer = null; } root.querySelectorAll('.bs-designer').forEach((x) => x.remove()); }

      /* ===================== events ===================== */
      root.addEventListener('click', async (e) => {
        const t = e.target;
        if (t.closest('[data-retry]')) { S.brands = null; S.detail = null; render(); return; }
        if (t.closest('[data-to-list]')) { e.preventDefault(); nav({ brand: 0, store: 0, editor: false, view: 'brands' }); return; }
        if (t.closest('[data-new-brand]')) { brandDialog(null, (id) => { S.brands = null; nav({ brand: id, tab: 'profile', store: 0 }); }); return; }
        if (t.closest('[data-bin]')) { recycleDrawer(() => { S.brands = null; renderList(); }); return; }
        if (t.closest('[data-clear-q]')) { addr({ bk: '' }, false); drawBrandGrid(); return; }
        const ringEl = t.closest('[data-ring]'); if (ringEl) { e.stopPropagation(); const id = Number(ringEl.dataset.ring); const p = R.brand ? S.detail.profile : null; const focus = p ? (LONG.find(([k]) => !filled(p[k])) || [])[0] : undefined; knowledgeDrawer(id, { focus, onSaved: () => { if (R.brand) refreshDetail(); else { S.brands = null; renderList(); } } }); return; }
        const more = t.closest('[data-more]'); if (more) {
          e.stopPropagation(); const b = S.brands.find((x) => Number(x.id) === Number(more.dataset.more));
          UK.menu(more, [{ key: 'open', label: '打开品牌', icon: 'arrowRight' }, { key: 'edit', label: '编辑基本信息', icon: 'edit' }, { key: 'kb', label: '补全企业知识', icon: 'book' }, '-', { key: 'bin', label: (S.brandStats.get(Number(b.id)) || {}).stores ? '移入回收站 · 需先移走门店' : '移入回收站', icon: 'delete', danger: true, disabled: !!(S.brandStats.get(Number(b.id)) || {}).stores }], (k) => {
            if (k === 'open') nav({ brand: b.id, tab: 'profile', store: 0 });
            if (k === 'edit') brandDialog(b, () => { S.brands = null; renderList(); });
            if (k === 'kb') knowledgeDrawer(b.id, { onSaved: () => { S.brands = null; renderList(); } });
            if (k === 'bin') recycleBrand(b, () => { S.brands = null; renderList(); });
          }, { align: 'right' }); return;
        }
        const card = t.closest('.bs-bcard[data-brand]'); if (card && !R.brand) { nav({ brand: Number(card.dataset.brand), tab: 'profile', store: 0 }); return; }
        const n = t.closest('[data-nav]'); if (n) {
          const k = n.dataset.nav;
          if (!R.brand) { addr({ bk: k === '0' ? '' : k }, false); drawAllStores(); return; }
          if (R.tab === 'profile') { const s = $('#bs-sec-' + k); s && s.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); return; }
          if (R.tab === 'knowledge') { addr({ cat: k }, false); drawKnowledge(); return; }
          if (R.tab === 'stores') { if (k === 'bin') { drawStoreBin(); return; } addr({ st: k }, false); drawStores(); return; }
          if (R.tab === 'staff') { if (k === 'bin') { drawStaffBin(); return; } addr({ staffStore: Number(k) || 0 }, false); drawStaff(); return; }
        }
        const go = t.closest('[data-nav-go]'); if (go) { addr({ st: go.dataset.navGo }, false); drawStores(); return; }
        if (t.closest('[data-clear-store]')) { const w = $('.bs-win'); w.dataset.kw = ''; w.dataset.st = ''; addr({ st: '' }, false); R.brand ? drawStores() : drawAllStores(); return; }
        if (t.closest('[data-clear-staff]')) { $('.bs-win').dataset.kw = ''; drawStaff(); return; }
        const sc = t.closest('.bs-scard[data-store]'); if (sc && !t.closest('button')) { nav({ brand: Number(sc.dataset.brand), tab: 'stores', store: Number(sc.dataset.store) }); return; }
        if (t.closest('[data-store-back]')) { nav({ store: 0 }); return; }
        if (t.closest('[data-brand-edit]')) { const d = S.detail; brandDialog({ ...d.brand, industry: d.profile.industry, website: d.profile.website }, () => refreshDetail()); return; }
        const bm = t.closest('[data-brand-more]'); if (bm) {
          const d = S.detail; const hasStores = S.stores.length > 0;
          UK.menu(bm, [{ key: 'kb', label: '补全企业知识', icon: 'book' }, { key: 'geo', label: '去 GEO 写文章', icon: 'arrowUpRight' }, '-', { key: 'bin', label: hasStores ? '移入回收站 · 需先移走门店' : '移入回收站', icon: 'delete', danger: true, disabled: hasStores }], (k) => {
            if (k === 'kb') knowledgeDrawer(R.brand, { onSaved: () => refreshDetail() });
            if (k === 'geo') { const tn = UK.tenant(); location.assign('/ai/geo?' + (tn ? 'tenant_id=' + tn + '&' : '') + 'brand_id=' + R.brand + '#articles'); }
            if (k === 'bin') recycleBrand(d.brand, () => { S.brands = null; S.detail = null; nav({ brand: 0, view: 'brands' }); });
          }, { align: 'right' }); return;
        }
        const se = t.closest('[data-sec-edit]'); if (se) { editSection(se.dataset.secEdit); return; }
        if (t.closest('[data-sec-cancel]')) { drawProfile(); return; }
        const ss = t.closest('[data-sec-save]'); if (ss) { saveSection(ss.dataset.secSave, ss); return; }
        const sa = t.closest('[data-sec-ai]'); if (sa) {
          const k = sa.dataset.secAi; const label = LONG.find((x) => x[0] === k)[1]; const area2 = $('[data-sec="' + k + '"] textarea');
          if (S.ai === false) { soonDialog('AI 强化待开通', AI_SOON); return; }
          enhance(R.brand, S.detail.profile, k, label, area2.value, (v) => { area2.value = v; area2.dispatchEvent(new Event('input')); area2.focus(); }); return;
        }
        if (t.closest('[data-goto-profile]')) { addr({ tab: 'profile' }, false); tabs.set(null, 'profile'); drawBrandHead(); drawTab(); return; }
        if (t.closest('[data-doc-new]')) { docDialog(R.brand, null, R.cat, catsKnown(), () => refreshDetail()); return; }
        if (t.closest('[data-doc-import]')) { docDialog(R.brand, null, R.cat, catsKnown(), () => refreshDetail()); setTimeout(() => { const f = document.querySelector('.uk-dialog input[type=file]'); f && f.click(); }, 60); return; }
        const de = t.closest('[data-doc-edit]'); if (de) { e.stopPropagation(); const m = (S.mats || []).find((x) => Number(x.id) === Number(de.dataset.docEdit)); if (m) docDialog(R.brand, m, null, catsKnown(), () => refreshDetail()); return; }
        const dc = t.closest('.bs-doc[data-doc]'); if (dc) { const m = (S.mats || []).find((x) => Number(x.id) === Number(dc.dataset.doc)); if (m) docView(R.brand, m, catsKnown(), () => refreshDetail()); return; }
        const pg = t.closest('.bs-pager [data-page]'); if (pg && !pg.disabled) { S.docPage = Number(pg.dataset.page); loadDocs(); return; }
        if (t.closest('[data-store-new]')) { storeDialog(null, await brandChoices(), R.brand, (id) => refreshDetail().then(() => { if (R.tab !== 'stores') nav({ tab: 'stores', store: id }); else nav({ store: id }); })); return; }
        if (t.closest('[data-store-batch]')) { storeBatchDialog(S.detail.brand, () => refreshDetail()); return; }
        const sed = t.closest('[data-store-edit]'); if (sed) { const s = S.stores.find((x) => Number(x.id) === Number(sed.dataset.storeEdit)); storeDialog(s, await brandChoices(), R.brand, () => refreshDetail().then(() => { if (!S.stores.some((x) => Number(x.id) === R.store)) nav({ store: 0 }); })); return; }
        const smo = t.closest('[data-store-more]'); if (smo) {
          const s = S.stores.find((x) => Number(x.id) === Number(smo.dataset.storeMore));
          UK.menu(smo, [{ key: 'renewal', label: '申请续期', icon: 'calendarClock' }, { key: 'nfc', label: '申请激活码牌', icon: 'qr' }, '-', { key: 'bin', label: '移入回收站', icon: 'delete', danger: true }], async (k) => {
            if (k === 'renewal' || k === 'nfc') requestDialog(s, k, () => loadRequests(s));
            if (k === 'bin') { const ok = await UK.confirm({ title: '把「' + s.name + '」移入回收站？', text: '门店资料、员工和装修都会保留，可在门店回收站恢复。', okText: '移入回收站', danger: true }); if (!ok) return; try { await ws('recycle', {}, { directory: 'store', id: s.id, restore: '0' }); UK.toast('已移入回收站'); await refreshDetail(false); nav({ store: 0 }); } catch (err) { UK.toast(err.message, 'fail', 4200); } }
          }, { align: 'right' }); return;
        }
        const rq = t.closest('[data-req]'); if (rq) { const s = S.stores.find((x) => Number(x.id) === R.store); requestDialog(s, rq.dataset.req, () => loadRequests(s)); return; }
        const rc = t.closest('[data-req-cancel]'); if (rc) { const s = S.stores.find((x) => Number(x.id) === R.store); rc.disabled = true; try { await ws('storeRequestCancel', {}, { store_id: s.id, id: Number(rc.dataset.reqCancel) }); UK.toast('已撤回'); loadRequests(s); } catch (err) { rc.disabled = false; UK.toast(err.message, 'fail'); } return; }
        const sr = t.closest('[data-store-restore]'); if (sr) { sr.disabled = true; try { await ws('recycle', {}, { directory: 'store', id: Number(sr.dataset.storeRestore), restore: '1' }); UK.toast('已恢复'); await refreshDetail(false); drawStoreBin(); } catch (err) { sr.disabled = false; UK.toast(err.message, 'fail', 4200); } return; }
        const sn = t.closest('[data-staff-new]'); if (sn) { if (!S.stores.length) { UK.toast('先创建门店，再添加员工', 'info'); return; } staffDialog(null, S.stores, Number(sn.dataset.staffNew) || R.staffStore || (R.tab === 'stores' ? R.store : 0) || S.stores[0].id, () => refreshDetail()); return; }
        if (t.closest('[data-staff-import]')) { if (!S.stores.length) { UK.toast('先创建门店，再导入员工', 'info'); return; } staffImportDialog(S.stores, R.staffStore || S.stores[0].id, () => refreshDetail()); return; }
        const so = t.closest('[data-staff-of]'); if (so) { addr({ tab: 'staff', staffStore: Number(so.dataset.staffOf), store: 0 }, true); tabs.set(null, 'staff'); drawBrandHead(); drawTab(); return; }
        if (t.closest('[data-staff-export]')) { const name = new Map(S.stores.map((s) => [Number(s.id), s.name])); const rows = S.staff.filter((x) => !R.staffStore || Number(x.store_id) === R.staffStore); downloadCsv(S.detail.brand.name + '-员工.csv', [['员工姓名', '手机号', '门店', '公众号通知', '状态']].concat(rows.map((x) => [x.name, x.mobile, name.get(Number(x.store_id)) || '', x.wechat_bound === true ? '已绑定' : x.wechat_bound === false ? '未绑定' : '', Number(x.status) === 1 ? '启用' : '停用']))); return; }
        const sm = t.closest('[data-staff-more]'); if (sm) {
          const x = S.staff.find((y) => Number(y.id) === Number(sm.dataset.staffMore));
          UK.menu(sm, [{ key: 'edit', label: '编辑', icon: 'edit' }, '-', { key: 'bin', label: '移入回收站', icon: 'delete', danger: true }], async (k) => {
            if (k === 'edit') staffDialog(x, S.stores, x.store_id, () => refreshDetail());
            if (k === 'bin') { try { await ws('storeStaffRecycle', {}, { store_id: x.store_id, id: x.id, restore: '0' }); UK.toast(x.name + ' 已移入回收站'); refreshDetail(); } catch (err) { UK.toast(err.message, 'fail', 4200); } }
          }, { align: 'right' }); return;
        }
        const sre = t.closest('[data-staff-restore]'); if (sre) { sre.disabled = true; try { await ws('storeStaffRecycle', {}, { store_id: Number(sre.dataset.sid), id: Number(sre.dataset.staffRestore), restore: '1' }); UK.toast('已恢复'); await refreshDetail(false); drawStaffBin(); } catch (err) { sre.disabled = false; UK.toast(err.message, 'fail', 4200); } return; }
        const dco = t.closest('[data-decor]'); if (dco) { const id = Number(dco.dataset.decor); addr({ tab: R.tab === 'decor' ? 'decor' : 'stores', store: id, editor: true }, true); render(); return; }
      });
      root.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.bs-bcard,.bs-scard,.bs-doc')) { e.preventDefault(); e.target.click(); }
      });
      let qt = 0;
      root.addEventListener('input', (e) => {
        const t = e.target; clearTimeout(qt);
        if (t.matches('[data-q]')) qt = setTimeout(() => { if (!isCurrent() || !t.isConnected || !root.contains(t)) return; addr({ bk: t.value }, false); const pos = t.selectionStart; drawBrandGrid(); const n = $('[data-q]'); n.focus(); n.setSelectionRange(pos, pos); }, 220);
        if (t.matches('[data-q-store]')) qt = setTimeout(() => { if (!isCurrent() || !t.isConnected || !root.contains(t)) return; $('.bs-win').dataset.kw = t.value; const pos = t.selectionStart; R.brand ? drawStores() : drawAllStores(); const n = $('[data-q-store]'); n.focus(); n.setSelectionRange(pos, pos); }, 220);
        if (t.matches('[data-q-staff]')) qt = setTimeout(() => { if (!isCurrent() || !t.isConnected || !root.contains(t)) return; $('.bs-win').dataset.kw = t.value; const pos = t.selectionStart; drawStaff(); const n = $('[data-q-staff]'); n.focus(); n.setSelectionRange(pos, pos); }, 220);
        if (t.matches('[data-q-doc]')) qt = setTimeout(() => { if (!isCurrent() || !t.isConnected || !root.contains(t)) return; S.docPage = 1; loadDocs(); }, 260);
      });
      root.addEventListener('change', (e) => { if (e.target.matches('[data-st-filter]')) { $('.bs-win').dataset.st = e.target.value; drawAllStores(); } });
      let choices = null;
      async function brandChoices() { if (!choices) choices = ws('brandChoices').then((d) => d.lists || []).catch(() => [S.detail.brand]); const r = await choices; choices = null; return r; }

      render();
      // this page draws its own title row: let the shell drop the generic one it may have inserted before we mounted
      setTimeout(() => UK.syncShell && UK.syncShell(), 0);
      root._update =() => { const prev = R; R = route(); if (prev.brand !== R.brand || prev.store !== R.store || prev.editor !== R.editor || prev.tab !== R.tab || prev.view !== R.view) render(); };
      root._cleanup = () => { S.dead = true; S.seq++; clearTimeout(qt); closeDesigner(); };
    }

    UK.page({
      key: 'brands',
      match: (p) => p === '/ai/stores',
      mount: page,
      update(root) { root._update && root._update(); },
      unmount(root) { root._cleanup && root._cleanup(); }
    });
  };
  if (window.UK) boot(); else document.addEventListener('uk:ready', boot, { once: true });
})();
