(() => {
  'use strict';
  const round = document.body.dataset.round;
  const kind = document.body.dataset.kind;
  const base = new URL('../../', location.href);
  const app = document.getElementById('app');
  const state = { category: '全部', search: '', sourceType: '', sourceClass: '', domain: '', metric: '', decision: '', mode: 'answers', pages: {}, sorts: {} };
  const data = {};
  const tables = new Map();
  const pageSize = 25;
  const labels = {};
  let engine;
  const decisions = { pass: '已证实命中', fail: '已证实未命中', unknown: '已审阅，证据不足', not_applicable: '不适用', excluded: '不纳入', missing: '原答缺失' };
  const decisionLabel = row => row.metric_id === 'error_information_rate' ? ({ pass: '未发现已证错误', fail: '已证错误', unknown: '事实未完全核实（已审阅）' }[row.decision] || decisions[row.decision] || row.decision) : decisions[row.decision] || row.decision;
  const groups = ['官方工具', '蝉妈妈', '第三方竞品', '其他工具'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('zh-CN') : '未提供';
  const percent = (n, d) => d ? Math.round(n / d * 10000) / 100 : null;
  const pct = value => value == null || !Number.isFinite(Number(value)) ? '不适用' : `${Number(value).toFixed(2)}%`;
  const delta = (a, b) => a == null || b == null ? '不适用' : `${b - a > 0 ? '+' : ''}${(b - a).toFixed(2)}`;
  const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const info = text => `<span class="tooltip"><button class="info" type="button" aria-label="指标口径">${icon('info')}</button><span class="tooltip-text">${esc(text)}</span></span>`;
  const icons = () => window.lucide?.createIcons();
  const safeUrl = (value, local = false) => { try { const url = new URL(value, base); return /^https?:$/.test(url.protocol) && (local || /^https?:\/\//.test(value || '')) ? url.href : ''; } catch { return ''; } };
  const link = (url, text = url) => safeUrl(url) ? `<a class="source-link" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(url))}">${esc(text)}</a>` : esc(text || '无 URL');
  const get = async file => { const response = await fetch(new URL(`data/${file}`, base)); if (!response.ok) throw new Error(`读取失败：${file}（${response.status}）`); return response.json(); };
  const section = (id, title, subtitle, body) => `<section class="report-section" id="${id}"><div class="section-head"><h2>${title}</h2><p>${subtitle}</p></div>${body}</section>`;
  const table = (headers, rows, className = '') => `<div class="table-wrap"><table class="${className}"><thead><tr>${headers.map(x => `<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${headers.length}" class="empty">没有匹配记录</td></tr>`}</tbody></table></div>`;
  const cell = (value, className = '') => `<td class="${className}">${value}</td>`;
  const csv = rows => { const keys = [...new Set(rows.flatMap(x => Object.keys(x || {})))]; const value = x => `"${String(typeof x === 'object' && x != null ? JSON.stringify(x) : x ?? '').replaceAll('"', '""')}"`; return '\uFEFF' + [keys.map(value).join(','), ...rows.map(row => keys.map(key => value(row[key])).join(','))].join('\r\n'); };
  const download = (name, rows, json) => { const a = document.createElement('a'); const url = URL.createObjectURL(new Blob([json ? JSON.stringify(rows, null, 2) : csv(rows)], { type: json ? 'application/json' : 'text/csv;charset=utf-8' })); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const exportButtons = id => `<div class="download-list"><button class="icon-button" data-export="${id}" data-format="csv" title="下载当前筛选 CSV" aria-label="下载当前筛选 CSV">${icon('download')}</button><button class="icon-button" data-export="${id}" data-format="json" title="下载当前筛选 JSON" aria-label="下载当前筛选 JSON">${icon('file-json')}</button></div>`;
  const sampleIndex = side => data[`r${side}`].index;
  const auditRows = side => data[`r${side}`].audit.rows || [];
  const sampleCards = sample => sample.sources || [];
  const sourceType = card => card.source_type || (/(^|\.)chanmama\.com$/i.test(card.domain || card.host || '') ? 'official' : 'third_party');
  const matchesCard = card => (!state.sourceType || sourceType(card) === state.sourceType) && (!state.sourceClass || card.source_class === state.sourceClass) && (!state.domain || (card.domain || card.host) === state.domain);
  const matchesSample = sample => {
    if (state.category !== '全部' && sample.category !== state.category) return false;
    const cards = sampleCards(sample);
    if ((state.sourceType || state.sourceClass || state.domain) && !cards.some(matchesCard)) return false;
    const q = state.search.trim().toLocaleLowerCase();
    return !q || [sample.sample_id, sample.question_id, sample.question_text, sample.answer_text, ...cards.flatMap(c => [c.title, c.raw_url, c.normalized_url, c.domain])].some(x => String(x || '').toLocaleLowerCase().includes(q));
  };
  const selection = side => data[`r${side}`].samples.filter(matchesSample);
  const selectedPairs = () => data.pairs.filter(pair => {
    const a = sampleIndex(1).get(pair.r1_sample_id), b = sampleIndex(2).get(pair.r2_sample_id);
    if (state.category !== '全部' && pair.category !== state.category) return false;
    return (a && matchesSample(a)) || (b && matchesSample(b));
  });
  const pairSamples = (side, pairs) => pairs.map(p => sampleIndex(side).get(p[`r${side}_sample_id`])).filter(Boolean);
  const activeFilter = () => state.category !== '全部' || state.search.trim() || state.sourceType || state.sourceClass || state.domain;
  const idsOf = rows => new Set(rows.map(x => x.sample_id));
  const collected = sample => sample.collected !== false && sample.answer_status !== 'missing';
  const metricRows = (side, samples) => {
    const ids = idsOf(samples);
    return engine.calculateMetrics(data.standard, samples, auditRows(side).filter(r => ids.has(r.sample_id))).map(m => ({ ...m, scoped: true }));
  };
  const summary = samples => {
    const cards = samples.flatMap(sampleCards).filter(matchesCard);
    const events = samples.flatMap(s => [...new Set(sampleCards(s).filter(matchesCard).map(c => c.normalized_url || c.raw_url).filter(x => safeUrl(x)))].map(url => ({ sample: s.sample_id, url })));
    const urls = new Set(events.map(x => x.url));
    const official = events.filter(x => { try { return /(^|\.)chanmama\.com$/i.test(new URL(x.url).hostname); } catch { return false; } });
    const known = samples.filter(s => s.citation_state !== 'unknown');
    const valid = samples.filter(collected);
    return { samples: samples.length, collected: valid.length, missing: samples.length - valid.length, cards: cards.length, validCards: cards.filter(c => c.valid_url).length, events: events.length, urls: urls.size, hosts: new Set(cards.map(c => c.domain).filter(Boolean)).size, known: known.length, cited: known.filter(s => s.citation_state === 'pass').length, unknown: valid.length - known.length, official: official.length, officialAnswers: new Set(official.map(x => x.sample)).size, empty: cards.filter(c => !c.raw_url).length, invalid: cards.filter(c => c.raw_url && !c.valid_url).length };
  };
  const kpis = rows => `<div class="kpi-grid">${rows.map(([label, value, note, hint]) => `<article class="kpi"><div class="exec-title">${label}${hint ? info(hint) : ''}</div><strong class="metric">${value}</strong><div class="count">${note || ''}</div></article>`).join('')}</div>`;
  const overview = samples => {
    const s = summary(samples);
    return kpis([
      ['有效回答', num(s.collected), `${num(s.samples)} 个槽位 · 缺失 ${num(s.missing)} 条`],
      ['可解析引用回答率', pct(percent(s.cited, s.known)), `${num(s.cited)} / ${num(s.known)}；状态未知 ${num(s.unknown)}`, '至少有一条可解析引用URL的回答 / 引用状态可判定回答。未知不入分母，缺失另列；不证明来源支持答案。'],
      ['去重 URL', num(s.urls), `${num(s.events)} 个回答内去重 URL 事件`],
      ['蝉妈妈域名URL事件占比', pct(percent(s.official, s.events)), `${num(s.official)} / ${num(s.events)} URL 事件`, 'chanmama.com及真实子域的事件/全部URL事件；不是回答比例，也不表示全是创意产品页。']
    ]);
  };
  const metricDefinition = id => data.standard.metrics.find(m => m.id === id);
  const metricExplanation = id => {
    const d = metricDefinition(id);
    const scope = data.questionScopes.metrics.find(m => m.id === id);
    return `<details class="metric-definition"><summary aria-label="${esc(d.label)}的评判标准">评判标准与例子</summary><dl>${[['旧名称', d.legacy_label], ['统计对象', d.target], ['适用题目', `${scope.questions.length}题、每轮${scope.questions.reduce((sum, q) => sum + q.expected_slots_per_round, 0)}个计划槽位；具体题目见完整标准附录。`], ['计数单位', d.unit], ['命中条件', d.numerator], ['分母', d.denominator], ['证据不足及排除', d.unknown], ['结果含义', d.interpretation], ['例子', d.example]].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>`;
  };
  const metricCell = id => `${esc(labels[id] || id)}${metricExplanation(id)}`;
  const mentionReconciliation = samples => {
    const valid = samples.filter(collected), neutral = valid.filter(s => s.natural_mention_eligible);
    const rows = ['蝉妈妈', '蝉妈妈·创意', '创意大师'].map(brand => {
      const hits = subset => subset.filter(s => s.distinct_products.includes(brand)).length;
      const n = hits(neutral), a = hits(valid);
      return `<tr>${cell(brand)}${cell(`${n} / ${neutral.length} = ${pct(percent(n, neutral.length))}`)}${cell(`${a - n} / ${valid.length - neutral.length}`)}${cell(`${a} / ${valid.length} = ${pct(percent(a, valid.length))}`)}</tr>`;
    });
    const camp = valid.filter(s => s.brands.some(b => b.group === '蝉妈妈')).length;
    return section('mention-scope', '提及口径对照', `当前${num(valid.length)}条有效回答 = 中立题${num(neutral.length)}条 + 点名题${num(valid.length - neutral.length)}条。品牌分别计数；阵营按回答取并集。`, table(['独立品牌', '中立题自然提及', '点名题命中 / 点名题回答', '全量单品牌提及'], rows) + `<p class="scope-note">蝉妈妈阵营全量去重提及：${num(camp)} / ${num(valid.length)} = ${pct(percent(camp, valid.length))}。同答提及多个成员只计一次，不能把三品牌数量直接相加。</p>`);
  };
  const metricsMarkup = (side, samples) => {
    const metrics = metricRows(side, samples);
    tables.set('metrics', metrics);
    const content = table(['指标 / 评判标准', '结果', '命中 / 分母', '已审证据不足', '排除与候选缺口', '统计集合'], metrics.map(m => `<tr data-metric-id="${esc(m.id)}">${cell(metricCell(m.id))}${cell(`${pct(m.percentage)}${m.id === 'error_information_rate' ? `<div class="caption">已证错误 ${num(m.numerator)} 条；非实际错误率</div>` : m.kind === 'semantic' ? '<div class="caption">已证实覆盖比例</div>' : ''}`, 'num')}${cell(`${num(m.numerator)} / ${num(m.denominator)}<div class="caption">${esc(m.unit)}</div>`, 'num')}${cell(`${num(m.unknown)}<div class="caption">${m.kind === 'semantic' ? '包含在分母内；不等于错误' : m.id === 'citation_rate' ? '分母外；引用状态未知' : '不适用：确定性文本统计'}</div>`, 'num')}${cell(`缺失 ${num(m.missing)} · 不适用 ${num(m.not_applicable)}${m.candidate_gap_count ? `<div class="caption">无词典品牌 ${num(m.candidate_gap_count)} 条回答；非事实证据不足</div>` : ''}`)}${cell(`${esc(metricDefinition(m.id).denominator)}<div class="caption">当前筛选 · ${esc(data.standard.version)}</div>`)}</tr>`), 'metric-list');
    return mentionReconciliation(samples) + section('metrics', '十四项研究指标', '语义主值是已证实结果 / 全部适用有效回答。证据不足保留在分母，不是错误；1减主值不是错误率。正文出现顺序不等于明确推荐。', `<p class="standard-version">执行标准 ${esc(data.standard.version)} · <a href="${esc(new URL('指标评判标准.md', base).href)}" target="_blank">完整评判标准</a></p>` + exportButtons('metrics') + content);
  };
  const groupOf = brand => brand.group || brand.camp || '其他工具';
  const brandsFor = (side, samples) => {
    samples = samples.filter(collected);
    const ids = idsOf(samples), map = new Map();
    const add = (brand, sampleId, rank, group) => {
      if (!brand || !ids.has(sampleId)) return;
      const row = map.get(brand) || { brand, group: group || '其他工具', samples: new Set(), first: new Set(), top3: new Set(), rankSum: 0, rankCount: 0 };
      if (row.samples.has(sampleId)) return;
      row.samples.add(sampleId);
      if (Number.isFinite(Number(rank)) && Number(rank) > 0) { row.rankSum += Number(rank); row.rankCount++; if (Number(rank) === 1) row.first.add(sampleId); if (Number(rank) <= 3) row.top3.add(sampleId); }
      map.set(brand, row);
    };
    for (const sample of samples) for (const brand of sample.brands || []) add(brand.brand, sample.sample_id, brand.rank, groupOf(brand));
    if (!map.size) for (const brand of data[`r${side}`].competitors.rows || []) {
      for (const sample of brand.sample_ranks || []) add(brand.brand, sample.sample_id, sample.rank, sample.group || groupOf(brand));
    }
    return [...map.values()].map(row => ({ brand: row.brand, group: row.group, mention_count: row.samples.size, mention_rate: percent(row.samples.size, samples.length), first_count: row.first.size, top3_count: row.top3.size, average_rank: row.rankCount ? Math.round(row.rankSum / row.rankCount * 100) / 100 : null, samples: [...row.samples] })).sort((a, b) => b.mention_count - a.mention_count || a.brand.localeCompare(b.brand, 'zh-CN'));
  };
  const campsFor = (side, samples) => {
    samples = samples.filter(collected);
    const rows = brandsFor(side, samples);
    return groups.map(group => {
      const brands = rows.filter(x => x.group === group);
      const members = new Set(brands.flatMap(x => x.samples));
      const ranks = samples.flatMap(s => { const ranked = (s.brands || []).filter(b => groupOf(b) === group && Number.isFinite(Number(b.rank)) && Number(b.rank) > 0).map(b => Number(b.rank)); return ranked.length ? [Math.min(...ranked)] : []; });
      return { group, brands: brands.length, mention_count: members.size, mention_rate: percent(members.size, samples.length), first_count: ranks.filter(x => x === 1).length, top3_count: ranks.filter(x => x <= 3).length, average_rank: ranks.length ? Math.round(ranks.reduce((sum, x) => sum + x, 0) / ranks.length * 100) / 100 : null };
    });
  };
  const competitorHeaders = ['独立品牌 / 工具', '阵营', '提及回答', '全量提及率', '词典首现回答', '词典前三回答', '平均首现位次'];
  const competitorCells = row => [`${esc(row.brand)} <button class="icon-button" data-brand="${esc(row.brand)}" title="查看提及该品牌的回答" aria-label="查看提及${esc(row.brand)}的回答">${icon('list-filter')}</button>`, esc(row.group), num(row.mention_count), pct(row.mention_rate), num(row.first_count), num(row.top3_count), row.average_rank == null ? '不适用' : num(row.average_rank)];
  const competitorMarkup = (side, samples) => {
    const camps = campsFor(side, samples), rows = brandsFor(side, samples);
    const denominator = samples.filter(collected).length;
    const campTable = table(['阵营', '已出现品牌数', '去重提及回答', '全量去重提及率', '最早词典首现回答', '最早词典前三回答', '平均最早位次'], camps.map(row => `<tr>${[esc(row.group), num(row.brands), num(row.mention_count), pct(row.mention_rate), num(row.first_count), num(row.top3_count), row.average_rank == null ? '不适用' : num(row.average_rank)].map(x => cell(x)).join('')}</tr>`));
    return section('competition', '竞品阵营与逐品牌表现', `本区分母统一为当前${num(denominator)}条有效回答，包含点名题。阵营按回答去重，单品牌分别计数，不能相加。位次只表示词典内正文首现，不表示推荐；平均位次仅以出现该品牌或阵营的回答为分母。`, campTable + '<h3>逐品牌全量明细（含点名题）</h3>' + pagedTable('brands', rows, competitorHeaders, competitorCells, [{ key: 'mention_count', label: '提及回答' }, { key: 'first_count', label: '正文首现回答' }, { key: 'top3_count', label: '正文前三回答' }, { key: 'average_rank', label: '平均位次' }, { key: 'brand', label: '品牌名称' }]));
  };
  const qualityMarkup = (side, samples) => {
    const s = summary(samples), q = data[`r${side}`].quality;
    return section('quality', '数据质量与采样完整性', '卡数、可解析 URL 卡与回答内去重 URL 事件采用不同计数单位。', kpis([
      ['来源卡总数', num(s.cards), `可解析 URL 卡 ${num(s.validCards)}`], ['空卡 / 无效 URL 卡', `${num(s.empty)} / ${num(s.invalid)}`, '原始卡完整保留'],
      ['来源状态未知', num(s.unknown), `可判定 ${num(s.known)} 个回答 · 原答缺失 ${num(s.missing)}`], ['原失败 / 未决', `${q.original_failures_retained == null ? '未记载' : num(q.original_failures_retained)} / ${q.original_uncertain_retained == null ? '未记载' : num(q.original_uncertain_retained)}`, `全轮补采 ${q.replacement_count == null ? '未记载' : `${num(q.replacement_count)} 次`}`],
      ['有效 / 计划槽位', `${num(s.collected)} / ${num(s.samples)}`, '缺失回答单列，不作为有效回答'], ['实际跨日回答', num(samples.filter(s => collected(s) && s.actual_sample_date && s.actual_sample_date !== s.sample_date).length), `全轮实际采样日：${esc((q.actual_dates || []).join('、') || '未提供')}`]
    ]));
  };
  const breakdownMarkup = samples => {
    const dates = [...new Set(samples.map(s => s.sample_date))].sort();
    const categories = [...new Set(samples.map(s => s.category))];
    const rows = categories.map(category => {
      const subset = samples.filter(s => s.category === category);
      const s = summary(subset);
      return `<tr>${cell(esc(category))}${cell(`${num(s.collected)} / ${num(subset.length)}`, 'num')}${dates.map(date => cell(num(subset.filter(s => s.sample_date === date && collected(s)).length), 'num')).join('')}${cell(pct(percent(s.cited, s.known)), 'num')}${cell(num(s.events), 'num')}${cell(num(s.urls), 'num')}</tr>`;
    });
    return section('sample-structure', '问题与日期分布', '日期为采样逻辑日；实际跨日时间在样本记录与数据质量区展示。', table(['问题类型', '有效回答 / 槽位', ...dates.map(esc), '引用率', 'URL 事件', '去重 URL'], rows));
  };
  const auditEvidence = (side, samples) => { const ids = idsOf(samples); return auditRows(side).filter(x => ids.has(x.sample_id) && (!state.metric || x.metric_id === state.metric) && (!state.decision || x.decision === state.decision)); };
  const evidenceCells = (row, side) => [
    `<span class="question-id">${esc(row.question_id)} · ${esc(row.sample_id)}</span>${esc(sampleIndex(side).get(row.sample_id)?.question_text || '')}`,
    esc(labels[row.metric_id] || row.metric_id), `<span class="state ${esc(row.decision)}">${esc(decisionLabel(row))}</span>`,
    `<blockquote class="evidence-quote">${esc(row.evidence_quote || '该规则未发现匹配证据')}</blockquote><span class="caption">判定理由：${esc(row.final_review?.reason || row.unknown_reason || '')}</span><span class="caption">事实依据：${esc((row.fact_ids || []).join('、') || '无事实支持，不据此证实正确')}</span>`,
    `<span class="hash-value">${esc(row.answer_sha256 || '未提供')}</span><div class="caption">${esc(row.rule_version || '')}</div>`,
    `<button class="icon-button" data-sample="${esc(row.sample_id)}" data-side="${side}" title="展开原回答" aria-label="展开原回答">${icon('chevron-down')}</button>`
  ];
  const semanticMarkup = (side, samples) => {
    const rows = auditEvidence(side, samples);
    const controls = `<div class="filters"><div class="filter"><label for="audit-metric">审计指标</label><select id="audit-metric"><option value="">全部指标</option>${Object.entries(labels).slice(8).map(([id, label]) => `<option value="${id}" ${state.metric === id ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="filter"><label for="audit-decision">判定</label><select id="audit-decision"><option value="">全部判定</option>${Object.entries(decisions).map(([key, label]) => `<option value="${key}" ${state.decision === key ? 'selected' : ''}>${label}</option>`).join('')}</select></div></div>`;
    return section('semantic', '语义审阅与逐样本证据', '证实只限各指标指定核心内容，不保证整答全部正确。未知仍在固定分母内，包含真值覆盖不足、归属不清、所问关系未充分说明等情况；不把未知判为错误。程序完整扫描与模型语义阅读范围分别保留在原审阅记录。', controls + pagedTable('semantic', rows, ['问题 / 样本', '指标', '判定', '回答证据片段', '哈希 / 审阅版本', '原回答'], row => evidenceCells(row, side)));
  };
  const citationRecords = (side, samples) => { const ids = idsOf(samples); return data[`r${side}`].citations.filter(x => ids.has(x.sample_id) && matchesCard(x)); };
  const urlsFor = (side, samples) => {
    const map = new Map();
    for (const record of citationRecords(side, samples)) {
      const url = record.normalized_url || record.raw_url;
      if (!safeUrl(url)) continue;
      const row = map.get(url) || { url, title: record.title || '', domain: record.domain || new URL(url).host, source_type: sourceType(record), source_class: record.source_class || '其他第三方', cards: 0, samples: new Set(), questions: new Set(), screenshot_url: record.screenshot_url || record.screenshot_path || null };
      row.cards++; row.samples.add(record.sample_id); row.questions.add(record.question_id); map.set(url, row);
    }
    return [...map.values()].map(row => ({ ...row, events: row.samples.size, answer_count: row.samples.size, question_count: row.questions.size, samples: [...row.samples], questions: [...row.questions] })).sort((a, b) => b.events - a.events || a.url.localeCompare(b.url));
  };
  const domainsFor = urls => {
    const map = new Map();
    for (const row of urls) { const domain = map.get(row.domain) || { domain: row.domain, source_type: row.source_type, urls: 0, events: 0, cards: 0, samples: new Set() }; domain.urls++; domain.events += row.events; domain.cards += row.cards; for (const id of row.samples) domain.samples.add(id); map.set(row.domain, domain); }
    return [...map.values()].map(row => ({ ...row, answer_count: row.samples.size, samples: [...row.samples] })).sort((a, b) => b.events - a.events);
  };
  const statusOf = record => record.evidence_status === 'unparseable' || !record.raw_url ? '原卡无可解析 URL' : '原始引用已捕获';
  const screenshotLink = record => { const path = record.screenshot_url || record.screenshot_path; const url = path && safeUrl(path, true); const label = record.screenshot_kind === 'rendered_text_archive' ? '原文存档预览（非采样时平台画面）' : '查看原始截图'; const evidence = record.evidence_url && safeUrl(record.evidence_url, true); return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>${evidence ? `<br><a href="${esc(evidence)}" target="_blank" rel="noopener noreferrer">完整原文存档</a>` : ''}` : '未采集原始截图'; };
  const citationMarkup = (side, samples) => {
    const urls = urlsFor(side, samples), domains = domainsFor(urls), events = urls.reduce((sum, x) => sum + x.events, 0);
    const sourceRows = ['official', 'third_party'].map(type => { const rows = urls.filter(x => x.source_type === type); return { type, urls: rows.length, events: rows.reduce((sum, x) => sum + x.events, 0), answers: new Set(rows.flatMap(x => x.samples)).size }; });
    const distribution = table(['来源归属', '去重 URL', 'URL 事件', '事件占比', '覆盖回答'], sourceRows.map(row => `<tr>${cell(row.type === 'official' ? '蝉妈妈官网' : '第三方网站')}${cell(num(row.urls), 'num')}${cell(num(row.events), 'num')}${cell(pct(percent(row.events, events)), 'num')}${cell(num(row.answers), 'num')}</tr>`));
    const classes = [...new Set(urls.map(row => row.source_class))].map(name => { const subset = urls.filter(row => row.source_class === name); return { name, urls: subset.length, events: subset.reduce((sum, row) => sum + row.events, 0), answers: new Set(subset.flatMap(row => row.samples)).size }; }).sort((a, b) => b.events - a.events);
    const classTable = table(['内容平台 / 来源类别', '去重 URL', 'URL 事件', '事件占比', '覆盖回答'], classes.map(row => `<tr>${cell(esc(row.name))}${cell(num(row.urls), 'num')}${cell(num(row.events), 'num')}${cell(pct(percent(row.events, events)), 'num')}${cell(num(row.answers), 'num')}</tr>`));
    const bars = `<div class="bar-list">${domains.slice(0, 12).map(row => `<div class="bar-row"><span>${esc(row.domain)}</span><div class="bar-track"><div class="bar-fill" style="width:${domains[0]?.events ? row.events / domains[0].events * 100 : 0}%"></div></div><span class="bar-value">${num(row.events)}</span></div>`).join('')}</div>`;
    return section('source-overview', '引用来源结构', `${num(domains.length)} 个域名；按当前筛选的回答与来源条件统计。`, distribution + '<h3>内容平台分布</h3>' + classTable + bars) + section('domains', '域名贡献明细', 'URL 事件为同一回答内去重，覆盖回答在域名内再次去重。', pagedTable('domains', domains, ['域名', '归属', '去重 URL', 'URL 事件', '来源卡', '覆盖回答'], row => [esc(row.domain), row.source_type === 'official' ? '官网' : '第三方', num(row.urls), num(row.events), num(row.cards), num(row.answer_count)], [{ key: 'events', label: 'URL 事件' }, { key: 'answer_count', label: '覆盖回答' }, { key: 'urls', label: '去重 URL' }, { key: 'domain', label: '域名' }]));
  };
  const screenshotMarkup = (side, samples) => {
    const found = [];
    for (const sample of samples) if (sample.screenshot_url || sample.screenshot_path) found.push({ ...sample, caption: sample.question_text });
    for (const card of citationRecords(side, samples)) if (card.screenshot_url || card.screenshot_path) found.push({ ...card, caption: card.title || card.question });
    const unique = [...new Map(found.map(x => [x.screenshot_url || x.screenshot_path, x])).values()];
    const originals = unique.filter(x => x.screenshot_kind !== 'rendered_text_archive');
    const archives = unique.filter(x => x.screenshot_kind === 'rendered_text_archive');
    const count = 12, pages = Math.max(1, Math.ceil(unique.length / count));
    const page = Math.min(state.pages.screenshots || 1, pages); state.pages.screenshots = page;
    tables.set('screenshots', unique);
    const gallery = `<div class="table-summary"><span>原始画面 ${num(originals.length)} 张 · 原文存档预览 ${num(archives.length)} 张</span>${exportButtons('screenshots')}</div><div class="evidence-gallery">${unique.slice((page - 1) * count, page * count).map(x => `<figure><a href="${esc(safeUrl(x.screenshot_url || x.screenshot_path, true))}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="${esc(safeUrl(x.screenshot_url || x.screenshot_path, true))}" alt="${esc(x.caption || '回答存档预览')}"></a><figcaption>${esc(x.caption)}<div class="caption">${esc(x.sample_id)}</div><div class="caption">${screenshotLink(x)}</div></figcaption></figure>`).join('')}</div><div class="pager"><button class="icon-button" data-page="screenshots" data-offset="-1" title="上一页" aria-label="上一页" ${page === 1 ? 'disabled' : ''}>${icon('chevron-left')}</button><span>${page} / ${pages}</span><button class="icon-button" data-page="screenshots" data-offset="1" title="下一页" aria-label="下一页" ${page === pages ? 'disabled' : ''}>${icon('chevron-right')}</button></div>`;
    return section('screenshots', '回答存档与截图证据', `原文存档预览由已采集回答生成，并绑定回答哈希；它不是采样时的平台画面。来源网页原始截图状态独立保留。`, unique.length ? gallery : '<p class="caption">本轮采样未提供截图资产。可从逐条记录展开完整原回答、引用卡和哈希证据；原始截图状态保留为“未采集”。</p>');
  };
  function pagedTable(id, input, headers, renderRow, sorts = []) {
    const sort = state.sorts[id] || { key: sorts[0]?.key, order: 'desc' };
    const rows = [...input];
    if (sort.key) rows.sort((a, b) => { const av = a[sort.key], bv = b[sort.key]; if (av == null) return bv == null ? 0 : 1; if (bv == null) return -1; const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'zh-CN'); return sort.order === 'asc' ? result : -result; });
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    const page = Math.min(state.pages[id] || 1, pages); state.pages[id] = page;
    tables.set(id, rows);
    const sortControl = sorts.length ? `<label class="caption">排序 <select data-sort="${id}" aria-label="记录排序">${sorts.map(x => `<option value="${x.key}" ${sort.key === x.key ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label><button class="icon-button" data-order="${id}" title="切换升序或降序" aria-label="切换升序或降序">${icon(sort.order === 'asc' ? 'arrow-up-narrow-wide' : 'arrow-down-wide-narrow')}</button>` : '';
    return `<div class="table-summary"><span>共 <b class="num">${num(rows.length)}</b> 条 · 每页 ${pageSize} 条</span><div class="table-actions">${sortControl}${exportButtons(id)}</div></div>${table(headers, rows.slice((page - 1) * pageSize, page * pageSize).map(row => `<tr>${renderRow(row).map(x => cell(x)).join('')}</tr>`))}<div class="pager"><button class="icon-button" data-page="${id}" data-offset="-1" title="上一页" aria-label="上一页" ${page === 1 ? 'disabled' : ''}>${icon('chevron-left')}</button><span>${page} / ${pages}</span><button class="icon-button" data-page="${id}" data-offset="1" title="下一页" aria-label="下一页" ${page === pages ? 'disabled' : ''}>${icon('chevron-right')}</button></div>`;
  }
  const sampleCells = (sample, side) => [
    `<span class="question-id">${esc(sample.question_id)} · ${esc(sample.sample_id)}</span><span class="question-text">${esc(sample.question_text)}</span><div class="caption">${esc(sample.category)} · ${esc(sample.pool)}</div>`,
    `${esc(sample.sample_date)}<div class="caption">遍次 ${esc(sample.repeat_index)}${sample.actual_sample_date && sample.actual_sample_date !== sample.sample_date ? `<br>实际 ${esc(sample.actual_sample_date)} · 跨日接续` : ''}</div>`,
    `${sample.citation_state === 'pass' ? '有可解析引用' : sample.citation_state === 'fail' ? '明确无引用' : '引用状态未知'}<div class="num">${num(sample.unique_url_events)} URL 事件</div>`,
    `<span class="hash-value">${esc(sample.answer_sha256 || '未提供')}</span><div class="caption">${screenshotLink(sample)}</div>`,
    `<button class="icon-button" data-sample="${esc(sample.sample_id)}" data-side="${side}" title="展开原回答" aria-label="展开原回答">${icon('chevron-down')}</button>`
  ];
  const recordsMarkup = (side, samples) => {
    if (kind !== 'citation') return section('records', '回答与证据明细', '当前筛选回答及完整原文', pagedTable('records', samples, ['问题 / 样本', '日期 / 遍次', '引用状态', '回答哈希 / 截图', '原回答'], row => sampleCells(row, side)));
    const modes = `<div class="segmented" role="group" aria-label="引用视图">${[['answers', '逐条引用卡'], ['sources', '逐网址引用'], ['samples', '回答与证据']].map(([id, label]) => `<button data-mode="${id}" aria-pressed="${state.mode === id}">${label}</button>`).join('')}</div>`;
    let body;
    if (state.mode === 'samples') body = pagedTable('records', samples, ['问题 / 样本', '日期 / 遍次', '引用状态', '哈希 / 截图', '原回答'], row => sampleCells(row, side));
    else if (state.mode === 'sources') body = pagedTable('records', urlsFor(side, samples), ['标题 / 域名', '规范化 URL', '归属', 'URL 事件 / 来源卡', '覆盖回答', '证据状态'], row => [link(row.url, row.title || row.url) + `<span class="host-label">${esc(row.domain)}</span>`, link(row.url), row.source_type === 'official' ? '官网' : '第三方', `${num(row.events)} / ${num(row.cards)}`, num(row.answer_count), `原始引用已捕获<div class="caption">内容支持及可访问性：未核验<br>${screenshotLink(row)}</div>`], [{ key: 'events', label: 'URL 事件' }, { key: 'cards', label: '来源卡数' }, { key: 'answer_count', label: '覆盖回答' }, { key: 'domain', label: '域名' }] );
    else body = pagedTable('records', citationRecords(side, samples), ['问题 / 样本', '标题 / 域名', '原始 / 规范化 URL', '来源卡 / 哈希', '证据 / 截图', '原回答'], row => [`<span class="question-id">${esc(row.question_id)} · ${esc(row.sample_id)}</span>${esc(row.question)}`, `${esc(row.title || '空来源卡')}<span class="host-label">${esc(row.domain || '无域名')}</span>`, `${link(row.raw_url)}<div class="caption">规范化：${esc(row.normalized_url || '无 URL')}</div>`, `<span class="hash-value">${esc(row.source_card_id)}</span><div class="hash-value caption">${esc(row.raw_record_hash || '未提供')}</div>`, `${statusOf(row)}<div class="caption">${screenshotLink(row)}</div>`, `<button class="icon-button" data-sample="${esc(row.sample_id)}" data-side="${side}" title="展开原回答" aria-label="展开原回答">${icon('chevron-down')}</button>`]);
    return section('records', '逐条引用与原始证据', '空卡、无效 URL 和原始记录哈希完整保留。', modes + body);
  };
  const metricComparison = (pairs, semantic = false) => {
    const [metrics1, metrics2] = engine.calculatePairedMetrics(data.standard, pairSamples(1, pairs), pairSamples(2, pairs), [auditRows(1), auditRows(2)]).map(rows => rows.map(m => ({ ...m, scoped: true })));
    const frozen = semantic ? data.comparison.semantic_metrics || [] : data.comparison.metrics || [];
    const rows = frozen.map(metric => {
      const a = metrics1.find(x => x.id === metric.id), b = metrics2.find(x => x.id === metric.id);
      const scoped = activeFilter() && a?.scoped && b?.scoped;
      return { id: metric.id, a: scoped ? a : metric.round1, b: scoped ? b : metric.round2, scope: scoped ? '当前筛选配对' : `${num(data.pairs.length)} 个共同有效配对`, change: scoped ? (a.denominator && b.denominator ? Math.round((b.numerator / b.denominator - a.numerator / a.denominator) * 10000) / 100 : null) : metric.percentage_point_change };
    });
    const body = table(['指标 / 评判标准', '第一轮', '第二轮', '变化（百分点）', '证据不足：一 / 二', '范围'], rows.map(row => `<tr data-metric-id="${esc(row.id)}">${cell(metricCell(row.id))}${cell(row.a ? `${pct(row.a.percentage)}<div class="caption">${row.id === 'error_information_rate' ? '已证错误 ' : ''}${num(row.a.numerator)} / ${num(row.a.denominator)}</div>` : '无可比基线', 'num')}${cell(row.b ? `${pct(row.b.percentage)}<div class="caption">${row.id === 'error_information_rate' ? '已证错误 ' : ''}${num(row.b.numerator)} / ${num(row.b.denominator)}</div>` : '无可比基线', 'num')}${cell(row.change != null ? `${row.change > 0 ? '+' : ''}${Number(row.change).toFixed(2)}` : delta(row.a?.percentage, row.b?.percentage), 'num')}${cell(`${num(row.a?.unknown ?? 0)} / ${num(row.b?.unknown ?? 0)}<div class="caption">${semantic ? '在各自分母内；非错误数' : row.id === 'citation_rate' ? '分母外引用状态未知' : `另有无词典品牌回答 ${num(row.a?.candidate_gap_count || 0)} / ${num(row.b?.candidate_gap_count || 0)}`}</div>`, 'num')}${cell(row.scope + '<div class="caption">双方同一适用集合重算</div>')}</tr>`));
    const id = semantic ? 'semantic-compare' : 'metric-compare'; tables.set(id, rows);
    return section(id, semantic ? '六项证实覆盖与检出指标对比' : '八项描述指标对比', `${data.standard.version}；${semantic ? '已证实结果占全部适用回答的比例，证据不足仍在分母。不是完整准确率、真实胜率或实际错误率。' : '中立自然提及、正文出现顺序、产品家族提及、可解析引用和候选记录占比各用固定分母。'}变化为第二轮减第一轮，仅描述差异。`, exportButtons(id) + body);
  };
  const competitorComparison = pairs => {
    const a = new Map(brandsFor(1, pairSamples(1, pairs)).map(x => [x.brand, x])), b = new Map(brandsFor(2, pairSamples(2, pairs)).map(x => [x.brand, x]));
    const rows = [...new Set([...a.keys(), ...b.keys()])].map(brand => ({ brand, group: b.get(brand)?.group || a.get(brand)?.group, round1_mentions: a.get(brand)?.mention_count || 0, round2_mentions: b.get(brand)?.mention_count || 0, change: (b.get(brand)?.mention_count || 0) - (a.get(brand)?.mention_count || 0), r1: a.get(brand), r2: b.get(brand) }));
    return section('competition-compare', '竞品表现变化', '全部品牌均可查看；各列顺序为第一轮 → 第二轮。首次出现顺序不代表明确推荐。', pagedTable('competition-compare', rows, ['品牌 / 阵营', '提及回答', '提及率', '首位出现', '前三出现', '平均位次', '提及变化'], row => [`${esc(row.brand)}<div class="caption">${esc(row.group)}</div>`, `${num(row.round1_mentions)} → ${num(row.round2_mentions)}`, `${pct(row.r1?.mention_rate ?? 0)} → ${pct(row.r2?.mention_rate ?? 0)}`, `${num(row.r1?.first_count || 0)} → ${num(row.r2?.first_count || 0)}`, `${num(row.r1?.top3_count || 0)} → ${num(row.r2?.top3_count || 0)}`, `${row.r1?.average_rank ?? '不适用'} → ${row.r2?.average_rank ?? '不适用'}`, `${row.change > 0 ? '+' : ''}${num(row.change)}`], [{ key: 'round2_mentions', label: '第二轮提及' }, { key: 'round1_mentions', label: '第一轮提及' }, { key: 'change', label: '提及变化' }, { key: 'brand', label: '品牌名称' } ]));
  };
  const citationComparison = pairs => {
    const a = pairSamples(1, pairs), b = pairSamples(2, pairs), s1 = summary(a), s2 = summary(b);
    const values = [ ['引用回答', s1.cited, s2.cited], ['引用状态未知', s1.unknown, s2.unknown], ['来源卡', s1.cards, s2.cards], ['可解析 URL 卡', s1.validCards, s2.validCards], ['回答内去重 URL 事件', s1.events, s2.events], ['去重 URL', s1.urls, s2.urls], ['域名数', s1.hosts, s2.hosts], ['官网 URL 事件', s1.official, s2.official], ['覆盖官网的回答', s1.officialAnswers, s2.officialAnswers] ];
    const urls1 = urlsFor(1, a), urls2 = urlsFor(2, b), m1 = new Map(urls1.map(x => [x.url, x])), m2 = new Map(urls2.map(x => [x.url, x]));
    const joined = [...new Set([...m1.keys(), ...m2.keys()])].map(url => ({ url, title: m2.get(url)?.title || m1.get(url)?.title, domain: m2.get(url)?.domain || m1.get(url)?.domain, r1_events: m1.get(url)?.events || 0, r2_events: m2.get(url)?.events || 0, change: (m2.get(url)?.events || 0) - (m1.get(url)?.events || 0), state: m1.has(url) && m2.has(url) ? '两轮共有' : m2.has(url) ? '第二轮新增' : '第二轮未再出现' }));
    const domains1 = new Map(domainsFor(urls1).map(x => [x.domain, x])), domains2 = new Map(domainsFor(urls2).map(x => [x.domain, x]));
    const domains = [...new Set([...domains1.keys(), ...domains2.keys()])].map(domain => ({ domain, r1_events: domains1.get(domain)?.events || 0, r2_events: domains2.get(domain)?.events || 0, r1_urls: domains1.get(domain)?.urls || 0, r2_urls: domains2.get(domain)?.urls || 0, change: (domains2.get(domain)?.events || 0) - (domains1.get(domain)?.events || 0), r1_answers: domains1.get(domain)?.answer_count || 0, r2_answers: domains2.get(domain)?.answer_count || 0 }));
    const overviewTable = table(['引用指标', '第一轮', '第二轮', '数量变化'], values.map(([label, first, second]) => `<tr>${cell(label)}${cell(num(first), 'num')}${cell(num(second), 'num')}${cell(`${second - first > 0 ? '+' : ''}${num(second - first)}`, 'num')}</tr>`));
    const officialRates = table(['占比指标', '第一轮', '第二轮', '变化（百分点）'], [['引用率', percent(s1.cited, s1.known), percent(s2.cited, s2.known)], ['官网引用占比', percent(s1.official, s1.events), percent(s2.official, s2.events)], ['官网回答覆盖率', percent(s1.officialAnswers, a.length), percent(s2.officialAnswers, b.length)]].map(([label, first, second]) => `<tr>${cell(label)}${cell(pct(first), 'num')}${cell(pct(second), 'num')}${cell(delta(first, second), 'num')}</tr>`));
    return section('citation-compare', '引用源完整对比', `${num(pairs.length)} 个当前共同有效槽位；URL 新增与未再出现仅表示本次采样集合变化。`, overviewTable + officialRates + kpis([['两轮共有 URL', num(joined.filter(x => x.state === '两轮共有').length)], ['第二轮新增 URL', num(joined.filter(x => x.state === '第二轮新增').length)], ['第二轮未再出现 URL', num(joined.filter(x => x.state === '第二轮未再出现').length)], ['两轮 URL 并集', num(joined.length)]])) + section('domain-compare', '逐域名变化', 'URL 事件、去重 URL 与覆盖回答均保留两轮值。', pagedTable('domain-compare', domains, ['域名', 'URL 事件：一 → 二', '去重 URL：一 → 二', '覆盖回答：一 → 二', '事件变化'], row => [esc(row.domain), `${num(row.r1_events)} → ${num(row.r2_events)}`, `${num(row.r1_urls)} → ${num(row.r2_urls)}`, `${num(row.r1_answers)} → ${num(row.r2_answers)}`, `${row.change > 0 ? '+' : ''}${num(row.change)}`], [{ key: 'r2_events', label: '第二轮事件' }, { key: 'r1_events', label: '第一轮事件' }, { key: 'change', label: '事件变化' }, { key: 'domain', label: '域名' }])) + section('url-compare', '逐网址变化', '每个规范化 URL 均可追溯到两轮事件数量。', pagedTable('url-compare', joined, ['标题 / 域名', '规范化 URL', '第一轮事件', '第二轮事件', '变化', '出现状态'], row => [link(row.url, row.title || row.url) + `<span class="host-label">${esc(row.domain)}</span>`, link(row.url), num(row.r1_events), num(row.r2_events), `${row.change > 0 ? '+' : ''}${num(row.change)}`, row.state], [{ key: 'r2_events', label: '第二轮事件' }, { key: 'change', label: '事件变化' }, { key: 'state', label: '出现状态' }, { key: 'domain', label: '域名' }]));
  };
  const pairsMarkup = pairs => section('records', '配对回答与证据', '每条对应同一逻辑槽位；展开查看两轮完整回答及引用。', pagedTable('pairs', pairs, ['问题 / 槽位', '第一轮', '第二轮', '变化', '两轮原回答'], pair => [`<span class="question-id">${esc(pair.question_id)}</span><span class="question-text">${esc(pair.r2_question || pair.r1_question)}</span><div class="caption">${esc(pair.category)} · ${esc(Array.isArray(pair.slot) ? pair.slot.slice(-2).join(' / ') : pair.slot)}</div>`, `${esc(pair.r1_date)}<div class="num">${num(pair.r1_events)} URL 事件</div>`, `${esc(pair.r2_date)}<div class="num">${num(pair.r2_events)} URL 事件</div>`, `${pair.r2_events - pair.r1_events > 0 ? '+' : ''}${num(pair.r2_events - pair.r1_events)}`, `<button class="icon-button" data-pair="${esc(pair.r2_sample_id)}" title="展开两轮原回答" aria-label="展开两轮原回答">${icon('chevron-down')}</button>`]));
  const filters = () => {
    const all = round ? data[`r${round}`].samples : [...data.r1.samples, ...data.r2.samples];
    const categories = ['全部', ...new Set(all.map(x => x.category))];
    const domains = [...new Set(all.flatMap(sampleCards).map(c => c.domain).filter(Boolean))].sort();
    const sourceClasses = [...new Set(all.flatMap(sampleCards).map(c => c.source_class).filter(Boolean))].sort();
    return `<div class="segmented" role="group" aria-label="问题类型">${categories.map(c => `<button type="button" data-category="${esc(c)}" aria-pressed="${state.category === c}">${esc(c === '全部' ? c : c.replace('型', ''))}</button>`).join('')}</div><div class="filters global-filters"><div class="filter grow"><label for="search">搜索问题、样本、回答、URL</label><input id="search" type="search" value="${esc(state.search)}"></div>${kind === 'citation' ? `<div class="filter"><label for="sourceType">来源归属</label><select id="sourceType"><option value="">全部</option><option value="official" ${state.sourceType === 'official' ? 'selected' : ''}>官网</option><option value="third_party" ${state.sourceType === 'third_party' ? 'selected' : ''}>第三方</option></select></div><div class="filter"><label for="sourceClass">来源类别</label><select id="sourceClass"><option value="">全部</option>${sourceClasses.map(name => `<option value="${esc(name)}" ${state.sourceClass === name ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></div><div class="filter"><label for="domain">域名</label><select id="domain"><option value="">全部</option>${domains.map(domain => `<option value="${esc(domain)}" ${state.domain === domain ? 'selected' : ''}>${esc(domain)}</option>`).join('')}</select></div>` : ''}<button class="icon-button" id="reset" title="重置全部筛选" aria-label="重置全部筛选">${icon('rotate-ccw')}</button></div>`;
  };
  const methods = () => section('methods', '统一评判标准与统计边界', `执行版本 ${data.standard.version}。所有页面与导出从同一标准和计算程序生成；历史标准保留。`, `<p><a href="${esc(new URL('指标评判标准.md', base).href)}" target="_blank">完整评判标准</a> · <a href="${esc(new URL('data/metric-standard.json', base).href)}" target="_blank">机器标准</a> · <a href="${esc(new URL('data/metric-standard-audit.json', base).href)}" target="_blank">本次核查与修正影响</a></p><details class="method-details"><summary>状态、证据与版本规则</summary><dl>${Object.entries(data.standard.states).map(([k, v]) => `<dt>${esc(k === 'candidate_gap' ? '无词典品牌' : decisions[k] || k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl><p>${esc(data.standard.question_alignment_requirement)}</p><p>${esc(data.standard.stability_policy)}</p><p>当前共同事实快照用于两轮一致的回顾评估，不证明功能在第一轮采样当天已存在。补充新事实必须标明时点，不用当前功能倒推历史错误。</p><p>540为逻辑槽位，包含100道题的日次与遍次，不是540个独立问题或用户。两轮均有效的538槽位用于描述性比较，渠道、模型和日期不同，不作因果归因。筛选时两侧任一匹配即保留整对，双方在同一集合重算。</p></details><details class="method-details"><summary>竞品、引用与截图的全部补充口径</summary>${data.standard.supplementary.map(m => `<h3>${esc(m.label)}</h3><p>${esc(m.formula)}。${esc(m.note)}</p>`).join('')}</details>`);
  const answerMarkup = (sample, side) => {
    const evidence = auditRows(side).filter(row => row.sample_id === sample.sample_id);
    return `<div class="answer-content"><h3>第${side}轮原回答</h3><div class="answer-meta"><span>${esc(sample.sample_id)}</span><span>${esc(sample.question_id)}</span><span>${esc(sample.sample_date)}</span></div><p class="hash-value caption">回答哈希：${esc(sample.answer_sha256 || '未提供')}</p><pre class="answer">${esc(sample.answer_text || '原始回答为空')}</pre><details><summary>语义证据审阅 ${num(evidence.length)} 项</summary>${table(['指标', '判定', '证据片段与理由', '事实依据'], evidence.map(row => `<tr>${cell(esc(labels[row.metric_id] || row.metric_id))}${cell(esc(decisionLabel(row)))}${cell(esc(row.evidence_quote || '未发现可判定证据片段') + `<p class="caption">${esc(row.final_review?.reason || row.unknown_reason || '')}</p>`)}${cell(esc((row.fact_ids || []).join('、')))}</tr>`))}</details><details><summary>引用卡 ${num(sampleCards(sample).length)} · URL 事件 ${num(sample.unique_url_events)}</summary><ul class="source-items">${sampleCards(sample).map(card => `<li>${link(card.raw_url, card.title || card.raw_url || '空引用卡')}<span class="state">${card.valid_url ? '可解析 URL' : '无可解析 URL'} · 网页内容未核验</span><div class="caption">规范化 URL：${esc(card.normalized_url || '无')}</div></li>`).join('')}</ul></details><p class="caption">截图：${screenshotLink(sample)}</p></div>`;
  };
  const expand = button => {
    const row = button.closest('tr');
    if (row.nextElementSibling?.classList.contains('expand-row')) { row.nextElementSibling.remove(); button.setAttribute('aria-expanded', 'false'); return; }
    let body;
    if (button.dataset.pair) {
      const pair = data.pairs.find(p => p.r2_sample_id === button.dataset.pair);
      if (!pair) return;
      body = `<div class="pair-answers">${[1, 2].map(side => { const sample = sampleIndex(side).get(pair[`r${side}_sample_id`]); return sample ? answerMarkup(sample, side) : '<p>未找到对应原回答</p>'; }).join('')}</div>`;
    } else {
      const side = button.dataset.side || round, sample = sampleIndex(side).get(button.dataset.sample);
      if (!sample) return;
      body = answerMarkup(sample, side);
    }
    const expanded = document.createElement('tr'); expanded.className = 'expand-row';
    expanded.innerHTML = `<td colspan="${row.cells.length}">${body}</td>`; row.after(expanded); button.setAttribute('aria-expanded', 'true');
  };
  const renderContent = () => {
    tables.clear();
    let content;
    if (round) {
      const samples = selection(round), report = data[`r${round}`], attempts = report.metrics.attempts;
      const notice = `<div class="notice"><strong>第${round}轮 ${num(report.samples.length)} 个槽位 · 有效回答 ${num(report.samples.filter(collected).length)} 条 · 十四项指标已完成计算</strong>${round === '2' && attempts ? `实际 ${num(attempts)} 次尝试 · ${num(report.metrics.replacements)} 次补采。` : ''}当前筛选 ${num(samples.length)} 个槽位；六项语义指标已完成证据审阅，证据不足结论单列。</div>`;
      content = notice + section('overview', '数据总览', `当前筛选 ${num(samples.length)} 条回答`, overview(samples)) + breakdownMarkup(samples);
      if (kind === 'data') content += metricsMarkup(round, samples) + competitorMarkup(round, samples) + qualityMarkup(round, samples) + semanticMarkup(round, samples);
      else content += citationMarkup(round, samples) + qualityMarkup(round, samples);
      content += recordsMarkup(round, samples) + screenshotMarkup(round, samples);
    } else {
      const pairs = selectedPairs(), first = pairSamples(1, pairs), second = pairSamples(2, pairs), s1 = summary(first), s2 = summary(second);
      content = `<div class="notice"><strong>${num(pairs.length)} 个当前共同有效配对 · 全量 ${num(data.pairs.length)} / ${num(data.comparison.planned_slots || 540)} 个槽位</strong>两轮渠道、日期和模型不同；展示观察到的差异，不作因果归因。</div>` + section('overview', '两轮研究总览', '当前筛选共同槽位', kpis([['共同有效配对', num(pairs.length), `全量 ${num(data.pairs.length)} 个`], ['第一轮引用率', pct(percent(s1.cited, s1.known)), `${num(first.length)} 条回答`], ['第二轮引用率', pct(percent(s2.cited, s2.known)), `${num(second.length)} 条回答`], ['URL 事件变化', `${s2.events - s1.events > 0 ? '+' : ''}${num(s2.events - s1.events)}`, `${num(s1.events)} → ${num(s2.events)}`]]));
      if (kind === 'data') content += metricComparison(pairs) + metricComparison(pairs, true) + competitorComparison(pairs);
      content += citationComparison(pairs) + pairsMarkup(pairs);
    }
    document.getElementById('report-content').innerHTML = content + methods();
    icons();
  };
  const layout = () => {
    app.setAttribute('aria-busy', 'false');
    const links = round ? (kind === 'data' ? [['overview', '数据总览'], ['metrics', '十四项指标'], ['competition', '竞品表现'], ['semantic', '语义证据'], ['quality', '数据质量'], ['records', '逐条记录'], ['screenshots', '截图证据']] : [['overview', '引用总览'], ['source-overview', '来源结构'], ['domains', '域名明细'], ['quality', '数据质量'], ['records', '逐条引用'], ['screenshots', '截图证据']]) : [['overview', '对比总览'], ...(kind === 'data' ? [['metric-compare', '描述指标'], ['semantic-compare', '语义指标'], ['competition-compare', '竞品变化']] : []), ['citation-compare', '引用源对比'], ['domain-compare', '域名变化'], ['url-compare', '网址变化'], ['records', '配对回答']];
    app.innerHTML = `<div class="creative-report"><nav class="section-links" aria-label="报告章节">${links.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('')}<a href="#methods">口径</a></nav>${filters()}<div id="report-content"></div></div>`;
    renderContent();
  };
  app.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.category) { state.category = button.dataset.category; state.pages = {}; layout(); }
    else if (button.id === 'reset') { Object.assign(state, { category: '全部', search: '', sourceType: '', sourceClass: '', domain: '', metric: '', decision: '', pages: {} }); layout(); }
    else if (button.dataset.mode) { state.mode = button.dataset.mode; state.pages.records = 1; renderContent(); }
    else if (button.dataset.page) { state.pages[button.dataset.page] = (state.pages[button.dataset.page] || 1) + Number(button.dataset.offset); const top = button.closest('section')?.offsetTop; renderContent(); if (top != null) window.scrollTo({ top, behavior: 'instant' }); }
    else if (button.dataset.export) { const id = button.dataset.export; download(`创意-${round ? `第${round}轮` : '两轮对比'}-${id}.${button.dataset.format}`, tables.get(id) || [], button.dataset.format === 'json'); }
    else if (button.dataset.order) { const id = button.dataset.order; const sort = state.sorts[id] || { key: id === 'brands' ? 'mention_count' : id === 'competition-compare' ? 'round2_mentions' : id === 'url-compare' || id === 'domain-compare' ? 'r2_events' : 'events', order: 'desc' }; state.sorts[id] = { ...sort, order: sort.order === 'desc' ? 'asc' : 'desc' }; renderContent(); }
    else if (button.dataset.sample || button.dataset.pair) expand(button);
    else if (button.dataset.brand) {
      const ids = new Set((tables.get('brands') || []).find(x => x.brand === button.dataset.brand)?.samples || []);
      const row = button.closest('tr');
      if (row.nextElementSibling?.classList.contains('expand-row')) { row.nextElementSibling.remove(); return; }
      const matches = selection(round).filter(sample => ids.has(sample.sample_id));
      const expanded = document.createElement('tr'); expanded.className = 'expand-row';
      expanded.innerHTML = `<td colspan="${row.cells.length}"><div class="answer-content"><strong>${esc(button.dataset.brand)} · ${num(matches.length)} 个提及回答</strong>${table(['问题 / 样本', '日期 / 遍次', '引用状态', '哈希 / 截图', '原回答'], matches.map(sample => `<tr>${sampleCells(sample, round).map(x => cell(x)).join('')}</tr>`))}</div></td>`;
      row.after(expanded); icons();
    }
  });
  let searchTimer;
  app.addEventListener('input', event => { if (event.target.id !== 'search') return; state.search = event.target.value; state.pages = {}; clearTimeout(searchTimer); searchTimer = setTimeout(renderContent, 180); });
  app.addEventListener('change', event => {
    const target = event.target;
    if (target.dataset.sort) { state.sorts[target.dataset.sort] = { key: target.value, order: 'desc' }; renderContent(); return; }
    const key = { sourceType: 'sourceType', sourceClass: 'sourceClass', domain: 'domain', 'audit-metric': 'metric', 'audit-decision': 'decision' }[target.id];
    if (key) { state[key] = target.value; state.pages = {}; renderContent(); }
  });
  const style = document.createElement('style');
  style.textContent = '.creative-report{min-width:0}.creative-report .table-wrap table{min-width:680px}.creative-report .table-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.creative-report .table-actions select{max-width:170px;padding:6px;border:1px solid var(--line);background:#fff}.creative-report .table-summary{align-items:center}.creative-report .hash-value{display:block;max-width:240px;overflow-wrap:anywhere;font:11px/1.6 var(--mono)}.creative-report td{overflow-wrap:anywhere;max-width:480px}.creative-report .evidence-quote{margin:0;white-space:pre-wrap;max-width:440px;max-height:180px;overflow:auto}.creative-report .evidence-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.creative-report figure{margin:0;min-width:0}.creative-report figure img{display:block;width:100%;height:210px;object-fit:contain;background:#fff;border:1px solid var(--line)}.creative-report figcaption{font-size:12px;padding:8px 0;overflow-wrap:anywhere}.creative-report .global-filters{padding-bottom:18px;border-bottom:1px solid var(--line)}.creative-report .answer-content{max-width:min(1160px,calc(100vw - 50px))}.creative-report .pair-answers .answer-content{max-width:100%;min-width:0}.creative-report .pair-answers{padding:16px}.creative-report .section-links{margin-bottom:18px}.creative-report .bar-row>span:first-child{overflow-wrap:anywhere}.creative-report .filter select{max-width:100%}.creative-report .download-list{display:inline-flex}@media(max-width:600px){.creative-report .evidence-gallery{grid-template-columns:1fr}.creative-report .table-actions{width:100%}.creative-report .table-actions .download-list{margin-left:auto}.creative-report .section-links{gap:10px 16px}.creative-report .bar-row{grid-template-columns:minmax(90px,130px) minmax(30px,1fr) 65px}.creative-report .pair-answers{padding:0}}';
  document.head.append(style);
  const definitionStyle = document.createElement('style');
  definitionStyle.textContent = '.metric-definition{font-size:12px;max-width:420px;margin-top:8px}.metric-definition summary{color:#285c49;cursor:pointer;font-weight:600}.metric-definition dl,.method-details dl{margin:12px 0}.metric-definition dt,.method-details dt{font-weight:700;margin-top:10px}.metric-definition dd,.method-details dd{margin:3px 0 0;line-height:1.7;white-space:normal}.standard-version{font-size:12px;line-height:1.8}.metric-list td:first-child{min-width:190px}.metric-list td:last-child{min-width:190px;max-width:280px}.metric-list .caption{font-family:var(--sans, sans-serif);font-size:11px;line-height:1.7}.metric-list td{vertical-align:top}#mention-scope .scope-note{font-size:13px;line-height:1.8}.method-details{margin:12px 0}.method-details h3{font-size:14px;margin-top:16px}.method-details p{line-height:1.8}';
  document.head.append(definitionStyle);
  const numericStyle = document.createElement('style');
  numericStyle.textContent = '.metric-list td:nth-child(2),.metric-list td:nth-child(3){min-width:100px;white-space:nowrap}.metric-list td:nth-child(2) .caption,.metric-list td:nth-child(3) .caption{white-space:normal}.metric-list td:nth-child(4){min-width:130px}.metric-list td:nth-child(5){min-width:160px}.metric-list td:first-child{min-width:230px}.metric-list{min-width:1100px!important}.creative-report .caption{display:block}';
  document.head.append(numericStyle);
  const loadRound = async side => {
    const names = ['samples', 'summary', 'urls', 'metrics', 'quality', 'competitors', 'citation-records', 'semantic-audit'];
    const values = await Promise.all(names.map(name => get(`round${side}/${name}.json`)));
    const report = Object.fromEntries(names.map((name, index) => [name, values[index]]));
    report.citations = report['citation-records']; report.audit = report['semantic-audit']; report.index = new Map(report.samples.map(s => [s.sample_id, s]));
    data[`r${side}`] = report;
  };
  (async () => {
    const [standard, module, questionScopes] = await Promise.all([get('metric-standard.json'), import(new URL('assets/metric-engine.mjs', base).href), get('metric-question-scopes.json')]);
    data.standard = standard; data.questionScopes = questionScopes; engine = module;
    for (const def of standard.metrics) labels[def.id] = def.label;
    if (round) await loadRound(round);
    else await Promise.all([loadRound(1), loadRound(2), get('comparison.json').then(x => { data.comparison = x; }), get('pairs.json').then(x => { data.pairs = x; })]);
    layout();
  })().catch(error => { app.setAttribute('aria-busy', 'false'); app.innerHTML = `<div class="exception"><h2>数据读取失败</h2><p class="error-message">${esc(error.message)}</p><button class="button" type="button" onclick="location.reload()">重新读取</button></div>`; });
})();
