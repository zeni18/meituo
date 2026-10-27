/* HARNESS ONLY. Load after /mock-geo.js, before the merchant scripts.
   Fixed in-memory fixtures following GeoKeywordLibrary / GeoCreationStudio / GeoArticleAgent.
   Never include this file in MerchantPortalMiddleware or a production merchant page. */
(() => {
  'use strict';
  if (!Array.isArray(window.__calls) || !document.querySelector('script[src="/mock-geo.js"]')) return;
  const originalFetch = window.fetch.bind(window);
  const query = new URLSearchParams(location.search), FX = query.get('fx') || 'rich';
  const RICH = FX !== 'empty', AI = query.get('ai') !== 'off', SEARCH = query.get('svc') !== 'off';
  const NOW = Math.floor(Date.UTC(2026, 9, 23, 2, 0, 0) / 1000), DAY = 86400;
  const brandNames = { 1: '禾米烘焙', 11: '山野咖啡', 12: '栖木民宿' };
  const labels = { 1: ['天然酵种面包', '日常烘焙', '企业茶歇'], 11: ['手冲咖啡', '咖啡馆选购', '企业咖啡服务'], 12: ['莫干山民宿', '亲子度假', '企业团建'] };
  const stores = new Map(), requests = new Map(), faults = new Map(), delays = new Map();
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const text = (v, max, required = false) => { const s = String(v == null ? '' : v).trim(); if ((required && !s) || Array.from(s).length > max) throw Error(required && !s ? '请填写必填内容' : '内容超过 ' + max + ' 字'); return s; };
  const lines = (v) => [...new Set(String(v || '').replace(/^\uFEFF/, '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean))];
  const hash = (row) => { let n = 2166136261; const str = JSON.stringify(row); for (let i = 0; i < str.length; i++) n = Math.imul(n ^ str.charCodeAt(i), 16777619); return ('fixture-' + (n >>> 0).toString(16)).padEnd(64, '0'); };
  const stamp = (s) => NOW + ++s.revision;
  const pack = (data) => ({ code: 1, show: 0, msg: '', data });
  const response = (data) => new Response(JSON.stringify(pack(data)), { headers: { 'Content-Type': 'application/json' } });
  const failure = (message) => new Response(JSON.stringify({ code: 0, show: 1, msg: message, data: [] }), { headers: { 'Content-Type': 'application/json' } });
  const paginate = (rows, q, size = 20) => { const page = Math.max(1, Number(q.page) || 1); return { lists: rows.slice((page - 1) * size, page * size).map(copy), count: rows.length, page, page_size: size }; };
  const publicRow = (r) => ({ ...copy(r), expected_hash: hash(r) });
  const brandId = (q) => String(Number(q.brand_id) || Number(query.get('brand_id')) || 1);
  function articleFor(subject, name, version) {
    return { title: subject, content: '## 从使用场景开始选择\n\n' + subject + '，首先需要明确使用频率、体验偏好与预算范围。与只比较价格相比，把具体需求列出来更容易形成可靠的选择。\n\n## 先核对事实，再判断是否适合\n\n' + name + '的产品和服务信息应以企业知识库与门店最新公示为准。本文引用的事实素材包括产品信息、服务流程及门店资料，涉及营业时间、规格与价格的内容，需要在发布前再次确认。\n\n## 可以直接使用的比较方法\n\n建议从产品组成、制作方式、交付安排和售后沟通四个方面逐项比较。对于初次尝试的消费者，可以从较小的体验方案开始，并记录实际使用反馈。\n\n## 下单之前再确认三件事\n\n确认产品或服务是否与自己的场景匹配；确认订单中包含的内容与有效时间；确认遇到问题时的联系渠道。不要将未经验证的宣传描述当作已证实事实。' + (version > 1 ? '\n\n## 本轮补充\n\n这一版本收紧了开头，并把可执行的选购步骤单独整理，方便读者快速核对。' : ''), outline: ['使用场景与选择标准', '可以核查的品牌事实', '比较方法与行动建议'], checks: ['核对产品规格与门店营业信息', '发布前确认引用事实的有效日期'], summary: version > 1 ? '已按修改要求生成新版本，前一版本保留。' : '已围绕主题完成初稿，发布前请核对事实清单。' };
  }
  function createStore(id) {
    const base = Number(id) * 10000, name = brandNames[id] || '测试品牌 ' + id, words = labels[id] || ['产品', '选购', '服务'];
    const s = { id, name, revision: 0, next: base + 700, resources: [], keywords: [], articles: [], materials: [], jobs: [], sessions: [], drafts: [] };
    if (!RICH) return s;
    const resource = (offset, kind, title, content, data = {}) => ({ id: base + offset, tenant_id: 1, user_id: 1, brand_id: Number(id), kind, title, content, data, revision: 1, create_time: NOW - 10 * DAY, update_time: NOW - DAY, delete_time: 0 });
    s.resources.push(resource(101, 'keyword', words[0] + '核心词', words[0] + '、使用场景、产品特点与新客常见问题', { enabled: true }), resource(102, 'keyword', words[1] + '问题', '选购标准、体验比较、购买决策', { enabled: true }), resource(103, 'keyword', words[2] + '选题', '服务内容、交付流程与采购要点', { enabled: true }), resource(201, 'category', '选购指南', ''), resource(202, 'category', '品牌知识', ''), resource(203, 'category', '真实案例', ''), resource(301, 'instruction', '事实优先的客户问答', '先直接回答客户问题，再给出可核查的依据；区分事实和建议，避免绝对化承诺。', { purpose: 'article' }), resource(302, 'instruction', '简洁产品解读', '使用具体场景和明确规格，保留事实来源，避免重复结论。', { purpose: 'article' }));
    const questions = ['如何挑选适合自己的' + words[0] + '？', words[0] + '初次体验要关注哪些细节？', name + '的' + words[0] + '有哪些特点？', words[0] + '有哪些常见误区？', '不同预算如何选择' + words[0] + '？', words[0] + '适合哪些消费场景？', words[0] + '应该怎样保存或准备？', '为什么' + words[0] + '体验会有差异？', words[0] + '和常规选择有什么区别？', '首次购买' + words[0] + '如何避免踩坑？'];
    for (let i = 0; i < 29; i++) s.keywords.push({ id: base + 400 + i, tenant_id: 1, user_id: 1, brand_id: Number(id), question: questions[i % questions.length] + (i >= 10 ? '（场景 ' + (Math.floor(i / 10) + 1) + '）' : ''), intent: ['选购决策', '产品认知', '场景需求'][i % 3], source: i % 3 ? 'manual' : 'ai_generated', metadata_json: { keyword_group_id: base + 103 }, create_time: NOW - (i + 1) * DAY, update_time: NOW - i * 1800, delete_time: 0 });
    s.keywords.push({ id: base + 439, tenant_id: 1, user_id: 1, brand_id: Number(id), question: name + '在哪里可以体验？', intent: '到店咨询', source: 'manual', metadata_json: { keyword_group_id: base + 101 }, create_time: NOW - 2 * DAY, update_time: NOW - DAY, delete_time: 0 });
    s.keywords.push({ id: base + 440, tenant_id: 1, user_id: 1, brand_id: Number(id), question: '客户首次咨询应该准备哪些信息？', intent: '内容选题', source: 'manual', metadata_json: {}, create_time: NOW - 12 * DAY, update_time: NOW - 3 * DAY, delete_time: 0 });
    const materials = [['品牌与门店资料', '企业事实', name + '的品牌资料以企业知识库中的现有记录为准，联系渠道以门店公示为准。'], ['产品规格与制作流程', '产品参数', '产品原料、规格、制作方式及售卖范围应以当前商品信息为准；在撰写内容时避免添加未经确认的功效与排名。'], ['客户体验记录', '案例数据', '已收到的客户反馈记录用于归纳使用场景，不代表所有用户体验，不作为普遍效果承诺。'], ['服务安排与预约方式', '企业事实', '团体预约需提前确认人数、时间、交付方式与现场条件。'], ['公开信息待复核', '检索待核实', '公开网页内容在引用前需要核对发布者、发布日期与适用范围。'], ['可展示资质清单', '资质荣誉', '展示资质时应保留完整名称、证书有效期与适用主体。']];
    materials.forEach((m, i) => s.materials.push({ id: base + 501 + i, tenant_id: 1, user_id: 1, brand_id: Number(id), title: m[0], category: m[1], content: m[2], source_url: i === 4 ? 'https://example.com/fixture-source' : '', revision: 1, create_time: NOW - (i + 1) * DAY, update_time: NOW - i * DAY, delete_time: 0 }));
    ['如何选择适合周末体验的' + words[0], name + '产品与服务常见问题', words[2] + '预约前的准备清单'].forEach((title, i) => {
      const article = articleFor(title, name, 1), r = { id: base + 601 + i, tenant_id: 1, user_id: 1, brand_id: Number(id), title, content: article.content, question: title, source: 'ai_generated', metadata_json: { keyword_group_id: base + 103, category_id: base + 201 + i }, status: 'draft', score: null, create_time: NOW - (i + 1) * DAY, update_time: NOW - i * DAY, delete_time: 0 };
      s.articles.push(r);
      const job = makeJob(s, 'write', title, { group: base + 103, category: base + 201 + i, article, status: i === 1 && FX === 'pending' ? 'running' : 'success', instruction: '围绕客户需求创作：' + title, materialIds: s.materials.slice(0, 3).map((m) => m.id), seeded: true });
      job.result.imported_ids = [r.id]; job.session_id = job.id; s.sessions.push({ id: job.id, title, jobs: [job.id] });
    });
    const kw = makeJob(s, 'keywords', words[2], { group: base + 103, status: FX === 'pending' ? 'running' : 'success', seeded: true });
    kw.result.questions = [words[2] + '适合怎样的团队？', '首次采购' + words[2] + '要确认哪些内容？', words[2] + '如何安排交付时间？'].map((question, i) => ({ question, intent: ['场景需求', '采购决策', '交付安排'][i] }));
    return s;
  }
  function store(q) { const id = brandId(q); if (!stores.has(id)) stores.set(id, createStore(id)); return stores.get(id); }
  const activeResources = (s, kind) => s.resources.filter((r) => r.kind === kind && !r.delete_time);
  function related(s, id, kind) { if (Number(id) && !activeResources(s, kind).some((r) => r.id === Number(id))) throw Error('关联资料不存在或无访问权限'); }
  const groupOf = (s, row) => { const id = Number((row.metadata_json || {}).keyword_group_id) || 0; return activeResources(s, 'keyword').some((r) => r.id === id) ? id : 0; };
  const models = [{ id: 'm1', name: 'DeepSeek V3', input_price: 0.2, output_price: 0.8, input_unit_size: 1000, output_unit_size: 1000, quote_token: 'a'.repeat(64) }, { id: 'm2', name: '通义千问 Plus', input_price: 0.1, output_price: 0.3, input_unit_size: 1000, output_unit_size: 1000, quote_token: 'b'.repeat(64) }];
  function validatePaid(s, action, b) {
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(String(b.request_key || ''))) throw Error('请求键格式不正确');
    const key = s.id + ':' + action + ':' + b.request_key, old = requests.get(key), fingerprint = JSON.stringify(b);
    if (old) { if (old.fingerprint !== fingerprint) throw Error('同一请求键不能更换创作内容'); return { key, old: { ...copy(old.result), replayed: true }, fingerprint }; }
    if (b.operation === 'web_search') { if (!SEARCH) throw Error('网页检索服务待开通'); }
    else { if (!AI) throw Error('请联系服务商开通 GEO 文本能力'); if (b.accept_charge !== true) throw Error('请确认文本模型费用'); const m = models.find((m) => m.id === String(b.model_id)); if (!m || m.quote_token !== b.quote_token) throw Error('模型计价已更新，请刷新并重新确认费用'); }
    return { key, fingerprint };
  }
  function makeJob(s, operation, subject, cfg = {}) {
    const id = ++s.next, state = cfg.status || 'queued', article = cfg.article || (operation === 'write' ? articleFor(subject, s.name, 1) : null);
    const j = { id, tenant_id: 1, user_id: 1, operation, status: state, subject, error: '', consumption_id: state === 'queued' ? 0 : id + 900000, app_task_id: '', create_time: NOW - (cfg.seeded ? 7200 : 0), update_time: NOW, finish_time: state === 'success' ? NOW : 0, result: article ? { article, content: JSON.stringify(article) } : {}, billing_status: state === 'success' ? 'settled' : state === 'queued' ? 'not_started' : 'reserved', user_points: state === 'success' ? 0.86 : null, reserved_points: state === 'queued' ? undefined : 3.8, group_id: Number(cfg.group) || 0, _reads: 0, _hold: cfg.seeded && FX === 'pending', _session: Number(cfg.session) || 0, _category: Number(cfg.category) || 0, _instruction: cfg.instruction || '', _materials: cfg.materialIds || [] };
    s.jobs.unshift(j); return j;
  }
  function tick(j) {
    if (!j || !['queued', 'running'].includes(j.status) || j._hold) return;
    j._reads++; j.status = j._reads < 2 ? 'running' : 'success'; j.billing_status = j.status === 'success' ? 'settled' : 'reserved'; j.update_time = NOW + j._reads; j.consumption_id = j.id + 900000; j.reserved_points = 3.8;
    if (j.status === 'success') { j.user_points = 0.86; j.finish_time = NOW + j._reads; }
  }
  function jobRow(j, includeGroup = false) {
    const r = {}; ['id', 'tenant_id', 'user_id', 'operation', 'status', 'error', 'consumption_id', 'app_task_id', 'create_time', 'update_time', 'finish_time', 'subject', 'billing_status', 'user_points', 'reserved_points'].forEach((k) => { if (j[k] !== undefined) r[k] = j[k]; });
    r.result = j.status === 'success' ? copy(j.result) : {};
    if (includeGroup) r.group_id = j.group_id;
    return r;
  }
  function savedArticle(s, j) {
    const id = Number(j.result && j.result.imported_ids && j.result.imported_ids[0]); if (!id) return null;
    const row = s.articles.find((a) => a.id === id && !a.delete_time); return row ? { id: row.id, title: row.title, content: row.content, expected_update: row.update_time, expected_hash: hash(row) } : { id, unavailable: true };
  }
  function sessionView(s, id) {
    const session = s.sessions.find((r) => r.id === Number(id)); if (!session) throw Error('创作会话不存在或无访问权限');
    const turns = session.jobs.map((id) => s.jobs.find((j) => j.id === id)).filter(Boolean).map((j) => ({ ...jobRow(j), instruction: j._instruction, sources: { brand_name: s.name, profile_revision: 1, materials: s.materials.filter((m) => j._materials.includes(m.id)).map((m) => ({ title: m.title, source_url: m.source_url, revision: m.revision })) }, saved: savedArticle(s, j) }));
    return { id: session.id, title: session.title, turns, latest_id: turns[turns.length - 1].id };
  }
  function addTopics(s, b, requiredGroup) {
    const id = Number(b.keyword_group_id) || 0; if (requiredGroup && !id) throw Error('请先选择或创建词表'); related(s, id, 'keyword');
    if (!Array.isArray(b.topics) || !b.topics.length || b.topics.length > 100) throw Error('每次保存 1 至 100 个选题');
    const normalized = b.topics.map((r) => {
      const question = text(r.text, 500, true); let source = null;
      if (r.source_job_id) { const j = s.jobs.find((j) => j.id === Number(r.source_job_id) && j.operation === 'keywords' && j.status === 'success'); source = j && (j.result.questions || []).find((q) => q.question === question); if (!source) throw Error('选题与原拓词结果不一致，请作为手工选题保存'); }
      return { question, source, job: Number(r.source_job_id) || 0 };
    });
    const ids = [];
    normalized.forEach((r) => {
      const old = s.keywords.find((row) => !row.delete_time && row.question === r.question && (!requiredGroup || Number(row.metadata_json.keyword_group_id || 0) === id));
      if (old) { ids.push(old.id); return; }
      const newId = ++s.next; s.keywords.unshift({ id: newId, tenant_id: 1, user_id: 1, brand_id: Number(s.id), question: r.question, intent: r.source ? r.source.intent : '内容选题', source: r.job ? 'ai_generated' : 'manual', metadata_json: { keyword_group_id: id, ...(r.job ? { geo_job_id: r.job } : {}) }, create_time: stamp(s), update_time: NOW + s.revision, delete_time: 0 }); ids.push(newId);
    });
    return { ids: [...new Set(ids)] };
  }
  function saveResource(s, b) {
    const kind = String(b.kind), id = Number(b.id) || 0, old = id ? s.resources.find((r) => r.id === id && r.kind === kind && !r.delete_time) : null;
    if (id && !old) throw Error('资料不存在或无访问权限'); if (old && Number(b.revision) !== old.revision) throw Error('资料已更新，请刷新后重试');
    const title = text(b.title, 255, true), content = text(b.content, 30000);
    if (kind === 'instruction' && !content) throw Error('请填写写作指令');
    const time = stamp(s), data = kind === 'keyword' ? { enabled: !!b.enabled } : kind === 'instruction' ? { purpose: b.purpose === 'title' ? 'title' : 'article' } : {};
    const row = old || { id: ++s.next, kind, tenant_id: 1, user_id: 1, brand_id: Number(s.id), revision: 0, create_time: time, delete_time: 0 };
    Object.assign(row, { title, content, data, revision: row.revision + 1, update_time: time }); if (!old) s.resources.unshift(row);
    return { id: row.id, revision: row.revision };
  }
  function saveContent(s, b) {
    const kind = b.kind, rows = kind === 'articles' ? s.articles : kind === 'materials' ? s.materials : kind === 'questions' ? s.keywords : null;
    if (!rows) throw Error('内容类型不正确');
    const id = Number(b.id) || 0, old = id ? rows.find((r) => r.id === id && !r.delete_time) : null;
    if (id && !old) throw Error('内容不存在或无访问权限');
    if (old && (Number(b.expected_update) !== old.update_time || (kind !== 'materials' && b.expected_hash !== hash(old)))) throw Error('内容已更新，请刷新后重试');
    if (kind !== 'materials') { related(s, b.keyword_group_id, 'keyword'); related(s, b.category_id, 'category'); }
    const values = kind === 'questions' ? { question: text(b.question, 500, true), intent: text(b.intent || '内容选题', 80, true) } : { title: text(b.title, 255, true), content: text(b.content, 30000, true) };
    if (kind === 'materials') { values.category = text(b.category || '企业事实', 80); values.source_url = text(b.source_url, 2048); if (values.source_url && !/^https?:\/\//.test(values.source_url)) throw Error('请输入有效 HTTP(S) 地址'); values.revision = (old ? old.revision : 0) + 1; }
    else values.metadata_json = { ...((old && old.metadata_json) || {}), keyword_group_id: Number(b.keyword_group_id) || 0, category_id: Number(b.category_id) || 0 };
    const time = stamp(s), row = old || { id: ++s.next, tenant_id: 1, user_id: 1, brand_id: Number(s.id), source: 'manual', create_time: time, delete_time: 0 };
    Object.assign(row, values, { update_time: time }); if (kind === 'articles') Object.assign(row, { status: 'draft', score: null, question: b.question || row.question || '' });
    if (!old) rows.unshift(row); return { id: row.id };
  }
  function generateStudio(s, b) {
    const paid = validatePaid(s, 'studioGenerate', b); if (paid.old) return paid.old;
    const subjects = b.subjects;
    if (!Array.isArray(subjects) || !subjects.length || subjects.length > 3) throw Error('每批选择 1 至 3 个选题');
    if (!['write', 'replicate', 'batch'].includes(b.mode)) throw Error('创作模式无效'); if (b.mode !== 'batch' && subjects.length !== 1) throw Error('当前模式每次生成一篇文章');
    if (new Set(subjects).size !== subjects.length) throw Error('本批次选题重复，请合并后提交'); subjects.forEach((s) => text(s, 500, true));
    if (b.mode === 'replicate' && !text(b.reference, 30000)) throw Error('请粘贴需要改写的参考原文');
    if (!['客户问答', '选购指南', '产品解读', '对比分析', '真实案例', '新闻软文'].includes(b.article_type || '选购指南')) throw Error('文章类型无效');
    if (![600, 1000, 1500].includes(b.words || 1000)) throw Error('请选择 600、1000 或 1500 字');
    if (s.jobs.filter((j) => ['queued', 'running'].includes(j.status)).length + subjects.length > 3) throw Error('请等待当前任务完成后再提交');
    related(s, b.keyword_group_id, 'keyword'); related(s, b.category_id, 'category'); related(s, b.instruction_id, 'instruction');
    const jobs = subjects.map((subject) => { const j = makeJob(s, 'write', subject, { group: b.keyword_group_id, category: b.category_id, materialIds: b.material_ids || [], instruction: (b.mode === 'replicate' ? '结合品牌事实重新创作：' : '围绕客户需求创作：') + subject }); j.session_id = j.id; s.sessions.unshift({ id: j.id, title: subject, jobs: [j.id] }); return { id: j.id, session_id: j.id, subject }; });
    const result = { jobs }; requests.set(paid.key, { fingerprint: paid.fingerprint, result }); return result;
  }
  const handlers = {
    options(q) { const s = store(q); return { models: AI ? copy(models) : [], default_model_id: AI ? 'm1' : '', text_available: AI, text_notice: AI ? '按实际输入与输出用量结算' : '请联系服务商开通 GEO 文本能力', search_available: SEARCH, ...(SEARCH ? { search_price: 0.6 } : { search_notice: '请联系服务商配置网页检索及按次价格' }), point_unit: 'TP', draft_scope: 'harness-tenant-1-user-1-brand-' + s.id, thinking_available: true }; },
    keywordLibrary(q) {
      const s = store(q), gid = Number(q.group_id) || 0; related(s, gid, 'keyword'); const gs = activeResources(s, 'keyword').slice().sort((a, b) => b.id - a.id);
      const lists = s.keywords.filter((r) => !r.delete_time && groupOf(s, r) === gid && (!q.keyword || r.question.includes(q.keyword))).sort((a, b) => b.id - a.id);
      const size = Number(q.page_size) || 20; if (![20, 100].includes(size)) throw Error('每页数量无效');
      s.jobs.filter((j) => j.operation === 'keywords').forEach(tick);
      return { ...paginate(lists.map(publicRow), q, size), groups: gs.map((g) => ({ ...copy(g), count: s.keywords.filter((r) => !r.delete_time && groupOf(s, r) === g.id).length })), unfiled_count: s.keywords.filter((r) => !r.delete_time && !groupOf(s, r)).length, jobs: s.jobs.filter((j) => j.operation === 'keywords' && !j._diagnosis).slice(0, 20).map((j) => jobRow(j, true)) };
    },
    keywordLibrarySave(q, b) { if (!b.brand_id || !brandNames[String(b.brand_id)]) throw Error('请选择词库关联的品牌商'); if (b.id && String(b.brand_id) !== brandId(q)) throw Error('已有词库不能更换品牌商，请在该品牌下另建词库'); const s = store({ ...q, brand_id: b.brand_id }), r = saveResource(s, { ...b, kind: 'keyword' }); return { ...r, brand_id: Number(s.id), brand_name: s.name }; },
    keywordManualPreview(q, b) {
      const s = store(q); if (!(Number(b.keyword_group_id) > 0)) throw Error('请先选择目标词库'); related(s, b.keyword_group_id, 'keyword');
      if (!Array.isArray(b.parts) || b.parts.length !== 6) throw Error('请提供六组组合词'); let count = 1;
      const sets = b.parts.map((part) => { const rows = lines(text(part, 5000)); if (rows.length > 100) throw Error('每组最多 100 个词'); rows.forEach((r) => text(r, 100, true)); count *= Math.max(1, rows.length); if (count > 1000) throw Error('组合结果超过 1000 条，请减少每组词条'); return rows.length ? rows : ['']; });
      if (sets[2].length === 1 && !sets[2][0]) throw Error('请至少填写一个主词');
      let terms = ['']; sets.forEach((set) => { terms = terms.flatMap((prefix) => set.map((word) => text(prefix + word, 500))); }); return { terms: [...new Set(terms)], keyword_group_id: Number(b.keyword_group_id), billable: false };
    },
    keywordLibraryAdd(q, b) { return addTopics(store(q), b, true); },
    studioSaveTopics(q, b) { return addTopics(store(q), b, false); },
    keywordLibraryUpdate(q, b) {
      const s = store(q), row = s.keywords.find((r) => r.id === Number(b.id) && !r.delete_time); if (!row) throw Error('词条不存在或无权限'); if (b.expected_hash !== hash(row)) throw Error('词条已更新，请刷新后重试');
      const gid = Number(b.keyword_group_id) || 0; related(s, gid, 'keyword'); const question = text(b.question, 500, true), intent = text(b.intent || '内容选题', 80, true);
      if (s.keywords.some((r) => !r.delete_time && r.id !== row.id && r.question === question && Number(r.metadata_json.keyword_group_id || 0) === gid)) throw Error('当前词表已有相同词条');
      if (row.question !== question) { row.source = 'manual'; delete row.metadata_json.geo_job_id; } Object.assign(row, { question, intent, update_time: stamp(s) }); row.metadata_json.keyword_group_id = gid; return { id: row.id };
    },
    studioKeywords(q, b) {
      const s = store(q), paid = validatePaid(s, 'studioKeywords', b); if (paid.old) return paid.old;
      const subject = text(b.subject, 500, true); if (![10, 20, 30].includes(b.question_count)) throw Error('请选择 10、20 或 30 个问题'); related(s, b.keyword_group_id, 'keyword');
      if (s.jobs.filter((j) => ['queued', 'running'].includes(j.status)).length >= 3) throw Error('请等待当前任务完成后再提交');
      const job = makeJob(s, 'keywords', subject, { group: b.keyword_group_id }); const seeds = ['有哪些选择标准', '适合哪些场景', '首次体验如何准备', '怎样比较产品规格', '常见误区有哪些', '如何确定预算', '到店前应核对什么', '采购需要哪些信息', '服务流程是什么', '如何评价体验'];
      job.result.questions = Array.from({ length: b.question_count }, (_, i) => ({ question: subject.slice(0, 180) + '：' + seeds[i % 10] + (i >= 10 ? '（场景 ' + (Math.floor(i / 10) + 1) + '）' : '') + '？', intent: ['场景需求', '选购决策', '品牌认知'][i % 3] }));
      const result = { id: job.id }; requests.set(paid.key, { fingerprint: paid.fingerprint, result }); return result;
    },
    resources(q) { const s = store(q), trash = Number(q.trash) === 1, rows = s.resources.filter((r) => r.kind === q.kind && (!!r.delete_time) === trash && (!q.keyword || r.title.includes(q.keyword))).sort((a, b) => b.id - a.id); const size = [20, 50, 100, 500].includes(Number(q.page_size)) ? Number(q.page_size) : 20; return paginate(rows, q, size); },
    resourceSave(q, b) { if (!['keyword', 'instruction', 'category'].includes(b.kind)) throw Error('测试台暂不支持该资源类型'); return saveResource(store(q), b); },
    resourceRecycle(q, b) { const s = store(q), r = s.resources.find((r) => r.id === Number(b.id) && r.kind === b.kind); if (!r) throw Error('资料不存在或无访问权限'); if (r.revision !== Number(b.revision)) throw Error('资料已更新，请刷新后重试'); r.delete_time = Number(b.restore) ? 0 : stamp(s); r.revision++; r.update_time = stamp(s); return { id: r.id }; },
    workspaceRecords(q) {
      const s = store(q), source = q.kind === 'articles' ? s.articles : q.kind === 'materials' ? s.materials : q.kind === 'questions' ? s.keywords : [];
      const rows = source.filter((r) => !r.delete_time && (!q.id || r.id === Number(q.id)) && (!q.keyword || String(r.title || r.question).includes(q.keyword)) && (!q.category || r.category === q.category) && (!Number(q.category_id) || Number((r.metadata_json || {}).category_id) === Number(q.category_id)) && (!Number(q.keyword_group_id) || Number((r.metadata_json || {}).keyword_group_id) === Number(q.keyword_group_id))).sort((a, b) => b.id - a.id).map(publicRow);
      return paginate(rows, q);
    },
    contentSave(q, b) { return saveContent(store(q), b); },
    studioGenerate(q, b) { return generateStudio(store(q), b); },
    articleAgentSessions(q) { const s = store(q), rows = s.sessions.slice().sort((a, b) => b.id - a.id).map((r) => { const last = s.jobs.find((j) => j.id === r.jobs[r.jobs.length - 1]); return { id: r.id, title: r.title, status: last.status, turns: r.jobs.length, update_time: last.update_time }; }); return paginate(rows, q); },
    articleAgentView(q) { return sessionView(store(q), q.id); },
    articleAgentSend(q, b) {
      const s = store(q), paid = validatePaid(s, 'articleAgentSend', b); if (paid.old) return paid.old; text(b.instruction, 2000, true);
      const session = s.sessions.find((r) => r.id === Number(b.session_id)); if (!session) throw Error('创作会话不存在或无访问权限'); const last = s.jobs.find((j) => j.id === session.jobs[session.jobs.length - 1]);
      if (Number(b.expected_turn_id) !== last.id) throw Error('会话已有新版本，请刷新后继续'); if (['queued', 'running', 'review'].includes(last.status)) throw Error('上一轮尚未完成或费用待核对，请先查看原任务'); if (session.jobs.length >= 20) throw Error('此会话已达 20 轮，请开启新的创作');
      const source = b.draft || last.result.article, article = articleFor(text(source.title, 255, true), s.name, session.jobs.length + 1); article.content = text(source.content, 30000, true) + '\n\n## 本轮修改\n\n' + text(b.instruction, 2000, true);
      const j = makeJob(s, 'write', session.title, { group: last.group_id, category: last._category, session: session.id, article, instruction: b.instruction, materialIds: b.material_ids || last._materials }); session.jobs.push(j.id);
      const result = { id: j.id, session_id: session.id }; requests.set(paid.key, { fingerprint: paid.fingerprint, result }); return result;
    },
    articleAgentSave(q, b) {
      const s = store(q), j = s.jobs.find((j) => j.id === Number(b.job_id)); if (!j || j.status !== 'success' || !j.result.article) throw Error('稿件尚未完成或无访问权限');
      const old = savedArticle(s, j); if (old && old.unavailable) throw Error('已入库文章不可用，请在文章库处理');
      const title = text(b.title, 255, true), content = text(b.content, 30000, true);
      if (!old || old.title !== title || old.content !== content) { const r = saveContent(s, { kind: 'articles', id: old ? old.id : 0, title, content, expected_update: b.expected_update, expected_hash: b.expected_hash, keyword_group_id: j.group_id, category_id: j._category }); j.result.imported_ids = [r.id]; }
      return savedArticle(s, j);
    },
    toPress(q, b) {
      const s = store(q), article = s.articles.find((r) => r.id === Number(b.id) && !r.delete_time); if (!article) throw Error('文章不存在或无访问权限');
      const fingerprint = hash({ title: article.title, content: article.content }), old = s.drafts.find((d) => d.article_id === article.id && d.fingerprint === fingerprint); if (old) return { draft_id: old.id, replayed: true };
      const draft = { id: ++s.next, article_id: article.id, title: article.title.slice(0, 120), body: article.content, fingerprint }; s.drafts.push(draft); article.metadata_json.press_draft_id = draft.id; article.metadata_json.press_content_hash = fingerprint; return { draft_id: draft.id, replayed: false };
    },
    jobs(q) { const s = store(q), rows = q.id ? s.jobs.filter((j) => j.id === Number(q.id)) : s.jobs; rows.forEach(tick); return paginate(rows.map((j) => jobRow(j)), q); },
    generate(q, b) {
      const s = store(q);
      if (b.operation === 'web_search') { const paid = validatePaid(s, 'generate', b); if (paid.old) return paid.old; const j = makeJob(s, 'web_search', text(b.subject, 500, true)); j.result.items = [{ title: '公开产品资料：' + b.subject, summary: '此为测试台网页检索资料，用于核对来源、保存及引用交互。正式内容请以真实网页为准。', url: 'https://example.com/fixture/product-reference' }, { title: '行业公开资料核查清单', summary: '引用前核对发布者、发布时间和适用范围，区分事实和推断。', url: 'https://example.com/fixture/checklist' }]; const result = { id: j.id }; requests.set(paid.key, { fingerprint: paid.fingerprint, result }); return result; }
      return null;
    },
    importResult(q, b) { const s = store(q), j = s.jobs.find((j) => j.id === Number(b.id)); if (!j || j.status !== 'success') throw Error('任务不存在、未完成或无权限'); if (j.result.imported_ids) return { ids: j.result.imported_ids, replayed: true }; if (j.operation === 'keywords') { const result = addTopics(s, { keyword_group_id: j.group_id, topics: (j.result.questions || []).map((r) => ({ text: r.question, source_job_id: j.id })) }, false); j.result.imported_ids = result.ids; return result; } if (j.operation === 'write') { const result = handlers.articleAgentSave(q, { job_id: j.id, title: j.result.article.title, content: j.result.article.content }); return { ids: [result.id] }; } throw Error('此结果不能直接入库'); }
  };
  const imageSources = ['/merchant/design-assets/v2/tool-product.webp', '/merchant/design-assets/v2/tool-wear.webp', '/merchant/design-assets/hero-template-warm.webp', '/merchant/design-assets/hero-template-bright.webp'];
  let imageSequence = 800100;
  const imageRows = RICH ? Array.from({ length: 8 }, (_, i) => ({ id: ++imageSequence, name: ['产品主视觉', '场景拍摄参考', '品牌宣传图', '门店内容封面'][i % 4] + ' ' + (i + 1), files: [{ id: 900100 + i, name: 'image-' + (i + 1) + '.webp', url: imageSources[i % imageSources.length] }], used: 0, labels: [], label_ids: [], folder_id: 0, store_id: 0, tags: '', content: '', file_ids: [900100 + i], create_time: NOW - i * DAY })) : [];
  function upload(form) {
    if (!(form instanceof FormData)) throw Error('上传请求格式无效'); const file = form.get('file');
    if (!file || !file.name || !/\.(jpe?g|png|webp|gif)$/i.test(file.name) || file.size > 20 * 1024 * 1024) throw Error('请选择不超过 20 MB 的有效图片');
    const id = ++imageSequence, f = { id: id + 100000, name: file.name, uri: '/fixture/' + file.name, url: URL.createObjectURL(file) };
    if (String(form.get('attach_only')) !== '1') imageRows.unshift({ id, name: file.name.replace(/\.[^.]+$/, '').slice(0, 100), files: [f], used: 0, labels: [], label_ids: [], folder_id: Number(form.get('folder_id')) || 0, store_id: 0, tags: '', content: '', file_ids: [f.id], create_time: NOW });
    return { id, file: f };
  }
  const shouldHandle = (route, q, b) => {
    if (route === 'merchantWorkspace/library') return !q.kind || q.kind === 'image';
    if (route === 'merchantWorkspace/upload') return true;
    if (!route.startsWith('merchantGeo/')) return false;
    const action = route.split('/')[1]; if (!handlers[action]) return false;
    if (action === 'workspaceRecords' && !['articles', 'materials', 'questions'].includes(q.kind)) return false;
    if (action === 'contentSave' && !['articles', 'materials', 'questions'].includes(b.kind)) return false;
    if (action === 'generate' && b.operation !== 'web_search') return false;
    if (action === 'jobs' && q.id && !store(q).jobs.some((j) => j.id === Number(q.id))) return false;
    if (action === 'importResult' && !store(q).jobs.some((j) => j.id === Number(b.id))) return false;
    return true;
  };
  window.__contentCalls = [];
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href), route = url.pathname.replace(/^\/api\//, ''), q = Object.fromEntries(url.searchParams);
    let body = {}; if (init.body instanceof FormData) body = init.body; else if (typeof init.body === 'string') try { body = JSON.parse(init.body); } catch (_) {}
    if (!url.pathname.startsWith('/api/') || !shouldHandle(route, q, body)) return originalFetch(input, init);
    const action = route.split('/')[1]; window.__calls.push(route + (init.body ? ' POST' : '')); window.__contentCalls.push({ action, brand: brandId(q), body: body instanceof FormData ? '[multipart image]' : copy(body) });
    const wait = delays.get(action) || 45; delays.delete(action); await new Promise((resolve) => setTimeout(resolve, wait));
    const fault = faults.get(action); faults.delete(action);
    if (fault && fault.mode === 'business') return failure(fault.message);
    if (fault && fault.mode === 'network') throw new TypeError(fault.message || 'Failed to fetch');
    let result;
    try {
      if (route === 'merchantWorkspace/library') result = paginate(imageRows.filter((r) => !q.keyword || r.name.includes(q.keyword)), q, Number(q.page_size) || 24);
      else if (route === 'merchantWorkspace/upload') result = upload(body);
      else result = handlers[action](q, body);
    } catch (e) { return failure(e.message); }
    if (fault && fault.mode === 'network-after-accept') throw new TypeError(fault.message || 'Failed to fetch after fixture accepted request');
    return response(result);
  };
  /* UK.upload uses XHR for progress; intercept only this one harness endpoint. */
  const xhrOpen = XMLHttpRequest.prototype.open, xhrSend = XMLHttpRequest.prototype.send, xhrHeader = XMLHttpRequest.prototype.setRequestHeader, xhrAbort = XMLHttpRequest.prototype.abort;
  const xhrMocks = new WeakMap();
  XMLHttpRequest.prototype.open = function (method, url, ...rest) { const parsed = new URL(url, location.href); if (parsed.pathname === '/api/merchantWorkspace/upload') { xhrMocks.set(this, { url: parsed, aborted: false }); return; } return xhrOpen.call(this, method, url, ...rest); };
  XMLHttpRequest.prototype.setRequestHeader = function (...args) { if (!xhrMocks.has(this)) return xhrHeader.apply(this, args); };
  XMLHttpRequest.prototype.abort = function (...args) { if (xhrMocks.has(this)) { xhrMocks.get(this).aborted = true; this.dispatchEvent(new Event('abort')); return; } return xhrAbort.apply(this, args); };
  XMLHttpRequest.prototype.send = function (form) {
    if (!xhrMocks.has(this)) return xhrSend.call(this, form);
    const record = xhrMocks.get(this), xhr = this; window.__calls.push('merchantWorkspace/upload POST');
    setTimeout(() => {
      if (record.aborted) return;
      xhr.upload.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded: 1, total: 1 }));
      let packet; try { packet = pack(upload(form)); } catch (e) { packet = { code: 0, msg: e.message, data: [] }; }
      Object.defineProperties(xhr, { responseText: { value: JSON.stringify(packet), configurable: true }, response: { value: JSON.stringify(packet), configurable: true }, status: { value: 200, configurable: true }, readyState: { value: 4, configurable: true } });
      xhr.dispatchEvent(new Event('readystatechange')); xhr.dispatchEvent(new Event('load')); xhr.dispatchEvent(new Event('loadend'));
    }, 90);
  };
  window.__contentMock = {
    fixture: FX, now: NOW, models: copy(models),
    snapshot(brand = 1) { return copy(store({ brand_id: brand })); },
    failNext(action, mode = 'business', message = '测试台模拟失败，请重试') { faults.set(action, { mode, message }); },
    delayNext(action, milliseconds = 500) { delays.set(action, Number(milliseconds)); },
    complete(id, brand = 1) { const j = store({ brand_id: brand }).jobs.find((j) => j.id === Number(id)); if (j) { j._hold = false; j._reads = 2; tick(j); } },
    conflict(kind, id, brand = 1) { const s = store({ brand_id: brand }), rows = kind === 'keyword' ? s.keywords : kind === 'article' ? s.articles : kind === 'material' ? s.materials : s.resources, r = rows.find((r) => r.id === Number(id)); if (r) { r.update_time = stamp(s); if (r.revision) r.revision++; } }
  };
})();
