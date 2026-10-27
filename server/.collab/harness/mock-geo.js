/* Harness API mock for GEO 诊断 / 效果 + brand knowledge drawer. Shapes follow the PHP services
   (GeoDashboard::view, GeoWorkspace::report, GeoVisibility::options/records/preview, GeoJobs::publicRow, workflow). */
(() => {
  const now = Math.floor(Date.now() / 1000), H = 3600, D = 86400;
  const q0 = new URLSearchParams(location.search);
  const FX = q0.get('fx') || 'rich', SVC = q0.get('svc') !== 'off' && FX !== 'empty', AI = q0.get('ai') !== 'off' && FX !== 'empty';
  const brands = [{ id: 11, name: '山野咖啡', legacy: 0, revision: 7 }, { id: 12, name: '栖木民宿', legacy: 0, revision: 2 }, { id: 1, name: '禾米烘焙', legacy: 1, revision: 1 }];
  const profile = { 11: { brand_name: '山野咖啡', industry: '精品咖啡 · 连锁门店', website: 'https://shanye.coffee', intro: '山野咖啡 2019 年创立于杭州……', products: '手冲单品、意式咖啡、季节限定特调', customers: '杭州本地上班族与周末出游人群', competitors: '', revision: 4 }, 12: { brand_name: '栖木民宿', industry: '民宿', website: '', intro: '莫干山竹林里的 9 间客房', products: '', customers: '', competitors: '', revision: 1 }, 1: { brand_name: '禾米烘焙', industry: '', website: '', intro: '', products: '', customers: '', competitors: '', revision: 0 } };
  const P = ['豆包', 'DeepSeek', 'Kimi', '腾讯元宝', '通义千问'];
  const rich = FX !== 'empty';
  const metrics = rich ? [{ platform: '豆包', samples: 24, questions: 8, mentions: 9, latest_at: now - 5 * H }, { platform: 'DeepSeek', samples: 24, questions: 8, mentions: 14, latest_at: now - 5 * H }, { platform: 'Kimi', samples: 16, questions: 8, mentions: 3, latest_at: now - 2 * D }, { platform: '腾讯元宝', samples: 0, questions: 0, mentions: null, latest_at: 0 }, { platform: '通义千问', samples: 8, questions: 8, mentions: 1, latest_at: now - 6 * D }] : P.map((p) => ({ platform: p, samples: 0, questions: 0, mentions: null, latest_at: 0 }));
  const qs = ['杭州西湖边有哪些安静的精品咖啡馆？', '适合周末带朋友去的手冲咖啡店推荐', '杭州哪家咖啡店的豆子是自己烘焙的？', '湖滨附近适合办公的咖啡馆', '杭州精品咖啡连锁品牌有哪些'];
  const pending = FX === 'pending';
  let jid = 900;
  const job = (op, status, subject, o) => Object.assign({ id: ++jid, operation: op, status, subject, error: '', consumption_id: status === 'queued' ? 0 : 3000 + jid, create_time: now - jid % 40 * H, update_time: now, finish_time: now, result: {}, billing_status: status === 'success' ? 'settled' : status === 'failed' ? 'refunded' : status === 'review' ? 'pending_usage' : status === 'queued' ? 'not_started' : 'reserved', user_points: status === 'success' ? +(Math.random() * 3 + .3).toFixed(2) : null, reserved_points: status === 'running' ? 5 : undefined }, o || {});
  const runJobs = (runId, done) => { const out = []; qs.slice(0, 3).forEach((q) => ['DeepSeek', '豆包', 'Kimi'].forEach((p, i) => { const st = done ? (p === 'Kimi' && q === qs[2] ? 'failed' : 'success') : (i === 2 ? 'polling' : 'success'); out.push(job('visibility', st, q, { platform: p, result: st === 'success' ? { platform: p, observed_at: now - 5 * H, answer: '在杭州西湖边，比较受欢迎的精品咖啡馆有：\n1. 山野咖啡（北山街店）：湖边两层小楼，自家烘焙，手冲选择多……\n2. Manner……\n3. 野鸟咖啡……', citations: [{ title: '杭州咖啡地图 2026', url: 'https://example.com/coffee-map' }], references: [{ title: '小红书：西湖边咖啡合集', url: 'https://example.com/xhs' }], url: 'https://example.com/shot.png', sentiment: 'positive' } : {}, error: st === 'failed' ? '供方返回超时，已退回预扣' : '' })); })); return out; };
  const runs = rich ? [{ id: 31, project_id: 7, state: pending ? 'queued' : 'partial', create_time: now - 5 * H, expected: 9, jobs: runJobs(31, !pending) }, { id: 28, project_id: 7, state: 'success', create_time: now - 6 * D, expected: 9, jobs: runJobs(28, true).map((j) => ({ ...j, status: 'success', error: '' })) }] : [];
  runs.forEach((r) => { r.success = r.jobs.filter((j) => j.status === 'success').length; r.failed = r.jobs.filter((j) => j.status === 'failed').length; });
  const jobs = rich ? [job('keywords', 'success', '品牌可见度诊断问题', { result: { questions: qs.map((q) => ({ question: q })) } }), job('write', 'success', '西湖边精品咖啡选购指南', { result: { content: '# 西湖边精品咖啡选购指南\n\n……' } }), job('web_search', 'success', '杭州精品咖啡 市场', { result: { items: [{ title: '2026 杭州咖啡消费报告', summary: '杭州精品咖啡门店数同比增长 18%……', url: 'https://example.com/report' }] } }), job('write', 'running', '会员日活动软文'), job('rewrite', 'failed', '爆文改写：秋天第一杯', { error: '模型返回内容为空' }), job('knowledge_enhance', 'success', '企业知识强化 · 企业介绍', { result: { content: '……' } }), job('keywords', 'review', '拓词：手冲咖啡')] : [];
  const evidence = rich ? [{ id: 61, question: '杭州西湖边有哪些安静的精品咖啡馆？', platform: '豆包', answer: '推荐山野咖啡北山街店、……', create_time: now - 2 * D, sources_json: { method: 'manual', url: 'https://example.com/doubao-answer', observed_at: now - 2 * D } }, { id: 60, question: '适合周末带朋友去的手冲咖啡店推荐', platform: 'Kimi', answer: '可以考虑以下几家……', create_time: now - 4 * D, sources_json: { method: 'manual', url: 'https://example.com/kimi', observed_at: now - 4 * D } }] : [];
  const trend = Array.from({ length: 14 }, (_, i) => { const d = new Date((now - (13 - i) * D) * 1000); return { date: String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), created: rich ? [0, 1, 0, 2, 3, 0, 1, 0, 0, 4, 2, 1, 0, 2][i] : 0, published: rich ? [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 0, 0, 1][i] : 0 }; });
  let projects = {}, pid = 40;
  const R = {
    'merchantWorkspace/brandChoices': () => ({ lists: brands }),
    'merchantWorkspace/brandDetail': (q) => ({ brand: { id: +q.id, name: profile[q.id].brand_name, revision: 3, complete: 5, total: 7 }, profile: { ...profile[q.id] }, dashboard: {}, knowledge_categories: [], metrics: { materials: 3 } }),
    'merchantWorkspace/brandKnowledgeSave': (q, b) => { Object.assign(profile[b.id], b); profile[b.id].revision++; return { ...profile[b.id], brand_revision: 9 }; },
    'merchantGeo/profile': (q) => ({ id: 1, ...profile[q.brand_id || 1] }),
    'merchantGeo/options': () => AI ? { models: [{ id: 'm1', name: 'DeepSeek V3', input_price: 0.2, output_price: 0.8, input_unit_size: 1000, output_unit_size: 1000 }, { id: 'm2', name: '通义千问 Plus', input_price: 0.1, output_price: 0.3, input_unit_size: 1000, output_unit_size: 1000 }], default_model_id: 'm1', text_available: true, search_available: false, point_unit: '算力' } : { models: [], text_available: false, search_available: false, point_unit: '算力', text_notice: '请联系OEM或代理开通GEO文本能力' },
    'merchantGeo/dashboard': (q) => ({ range: q.range, stats: rich ? { articles: q.range === 'all' ? 23 : 4, published: q.range === 'all' ? 6 : 1, mentions: 27, samples: 72 } : { articles: 0, published: 0, mentions: null, samples: 0 }, platforms: metrics, latest_published: rich ? [{ id: 5, title: '西湖边 8 家安静的精品咖啡馆', media_name: '杭州日报网', published_url: 'https://example.com/a', create_time: now - 1 * D }, { id: 4, title: '山野咖啡：把烘焙间搬进湖边小楼', media_name: '搜狐新闻', published_url: '', create_time: now - 4 * D }] : [], recent_questions: rich ? qs.slice(0, 4).map((x, i) => ({ platform: P[i % 3], question: x, samples: 3, mentions: [2, 1, 0, 3][i], latest_at: now - (i + 1) * 3 * H })) : [], recent_tasks: [], brand: { name: profile[q.brand_id || 1].brand_name, complete: 5, total: 7 }, updated_at: now }),
    'merchantGeo/workspaceReport': () => ({ summary: { profile: profile[11], questions: rich ? 38 : 0, articles: rich ? 23 : 0, evidence: 2, materials: rich ? 6 : 0, press: { count: rich ? 7 : 0 } }, resources: rich ? { keyword: 5, instruction: 0, category: 3 } : {}, trend, jobs: rich ? { success: 41, failed: 3, running: 1, review: 2, queued: 0 } : {}, manual_evidence: [], visibility: {}, updated_at: now }),
    'merchantGeo/visibilityOptions': () => SVC ? { available: true, provider: 'GEO服务商 API', unit: '算力', price: 0.6, platforms: P.concat(['文心一言', '纳米AI']), platforms_by_surface: { '网页端': P.concat(['文心一言', '纳米AI']), 'App端': ['豆包', 'DeepSeek', '腾讯元宝'] }, modes: ['search'], notice: '按问题×平台计次……' } : { available: false, provider: 'GEO服务商 API', unit: '算力', platforms: P, platforms_by_surface: { '网页端': P, 'App端': ['豆包', 'DeepSeek', '腾讯元宝'] }, modes: ['search'], notice: '请在接入能力配置中填写监测服务 API Key……' },
    'merchantGeo/visibilityRecords': (q) => { if (q.id) return { lists: runs.filter((r) => r.id === +q.id), count: 1 }; return { lists: runs.map((r) => ({ ...r, jobs: r.jobs.map((j) => ({ id: j.id, status: j.status })) })), count: runs.length }; },
    'merchantGeo/workspaceRecords': (q) => q.kind === 'evidence' ? { lists: evidence, count: evidence.length, page: 1, page_size: 20 } : { lists: [], count: 0, page: 1, page_size: 20 },
    'merchantGeo/jobs': (q) => q.id ? { lists: jobs.filter((j) => j.id === +q.id).concat(q.id > 9000 ? [job('keywords', 'success', 'x', { id: +q.id, result: { questions: qs.map((x) => ({ question: x })) } })] : []), count: 1 } : { lists: jobs, count: jobs.length },
    'merchantGeo/workflowAction': (q, b) => { if (b.action === 'create') { const id = ++pid; projects[id] = { id, state: 'setup', revision: 1 }; return { id }; } projects[b.id].state = 'diagnosis'; projects[b.id].revision++; return { id: b.id }; },
    'merchantGeo/workflow': (q) => ({ project: projects[q.id], cycles: [{ id: 1, state: 'open' }], monitoring: {} }),
    'merchantGeo/visibilityPreview': () => ({ project_id: pid, cycle_id: 1, calls: 6, price: 0.6, total: 3.6, unit: '算力', quote_key: 'qk', surface: '网页端', mode: 'search', notice: '将问题发送至已配置的GEO服务商。已受理任务失败或取消时，供方不自动退款，本平台保留预扣待核对。' }),
    'merchantGeo/generate': () => ({ id: 9100 }),
    'merchantGeo/contentSave': () => ({ id: 77 }),
    'merchantGeo/importResult': () => ({ ids: [1] })
  };
  const reply = (data) => new Response(JSON.stringify({ code: 1, show: 0, msg: '', data }), { headers: { 'Content-Type': 'application/json' } });
  const realFetch = window.fetch.bind(window);
  window.__calls = [];
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
    const k = url.pathname.slice(5), q = Object.fromEntries(url.searchParams); let body = {}; if (init.body) try { body = JSON.parse(init.body); } catch (e) {}
    window.__calls.push(k + (init.body ? ' POST' : ''));
    await new Promise((r) => setTimeout(r, 90));
    const fn = R[k]; if (!fn) { console.warn('[mock] no route', k); return new Response(JSON.stringify({ code: 0, msg: '未模拟：' + k })); }
    try { return reply(fn(q, body)); } catch (e) { return new Response(JSON.stringify({ code: 0, msg: e.message })); }
  };
})();
