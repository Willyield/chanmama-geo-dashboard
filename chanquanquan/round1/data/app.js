const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const fmt = value => value == null || value === '未知' ? '未知' : Number(value).toLocaleString('zh-CN');
const pct = value => value == null ? '未知' : `${Number(value).toFixed(1)}%`;
const labels = { pass: '通过', fail: '不通过', unclear: '待复核' };
const typeOrder = ['品牌认知型', '品牌对比型', '业务场景型'];
const legacySpecs = [
  ['提及率', 'mentionRate', '回答正文提及蝉圈圈或 KOLKOC 的样本数。'],
  ['首推率', 'top1Rate', '明确排在第 1 的样本数 / 推荐类适用样本数。'],
  ['有效首推率', null, '全轮次口径：第三方工具候选中位于第 1 的样本率。当前类型未提供该冻结分母。'],
  ['严格优势表达率', null, '全轮次口径：宽、严两轮都明确表达品牌优势的样本率。当前类型未提供该冻结分母。'],
  ['前三率', 'top3Rate', '明确排在前 3 的样本数 / 推荐类适用样本数。'],
  ['平均排名', 'averageRank', '仅对明确包含蝉圈圈的推荐顺序计算算术平均排名。'],
  ['有工具提及时首推率', null, '全轮次口径：至少出现工具候选的样本中位列第 1 的比例。当前类型未提供该冻结分母。'],
  ['品牌解释准确率', 'brandExplanationAccuracy', '符合产品真值定位、能力组和事实要求的回答率。'],
  ['品类覆盖率', null, '全轮次认知质量指标。当前类型未提供该冻结分母。'],
  ['产品关系识别率', null, '全轮次认知质量指标。当前类型未提供该冻结分母。'],
  ['场景匹配率', null, '全轮次认知质量指标。当前类型未提供该冻结分母。'],
  ['对比胜率', null, '全轮次竞争指标。当前类型未提供独立胜负冻结分母。'],
  ['引用来源率', 'citationRate', '含至少一个可核验 URL 的回答数 / 引用状态已确认回答数。'],
  ['错误信息率', 'errorRate', '发现至少一条与产品真值冲突表述的回答率。']
];
const legacyBaseline = {
  '提及率': ['30.0%', '219 / 730 · 全轮次冻结基线'],
  '首推率': ['20.0%', '36 / 180 · 未知 31 · 全轮次冻结基线'],
  '有效首推率': ['39.1%', '36 / 92 · 未知 31 · 全轮次冻结基线'],
  '严格优势表达率': ['24.2%', '177 / 730 · 未知 29 · 全轮次冻结基线'],
  '前三率': ['23.3%', '42 / 180 · 未知 31 · 全轮次冻结基线'],
  '平均排名': ['1.14', '42 条明确排名 · 未知 31 · 全轮次冻结基线'],
  '有工具提及时首推率': ['24.8%', '36 / 145 · 未知 31 · 全轮次冻结基线'],
  '品牌解释准确率': ['51.1%', '46 / 90 · 全轮次冻结基线'],
  '品类覆盖率': ['55.0%', '99 / 180 · 全轮次冻结基线'],
  '产品关系识别率': ['25.0%', '2 / 8 · 全轮次冻结基线'],
  '场景匹配率': ['12.6%', '58 / 460 · 全轮次冻结基线'],
  '对比胜率': ['55.0%', '33 / 60 · 全轮次冻结基线'],
  '引用来源率': ['60.8%', '444 / 730 · 全轮次冻结基线'],
  '错误信息率': ['3.6%', '26 / 730 · 全轮次冻结基线']
};
let DATA;
let currentType = '品牌认知型';
let page = 1;

function info(rule) { return `<span class="info" tabindex="0" aria-label="指标说明">!<span>${esc(rule)}</span></span>`; }

function metricCard(label, item, color = '') {
  const value = item?.value == null ? pct(item?.percentage) : Number(item.value).toFixed(2);
  const meta = item?.value == null ? `${fmt(item?.numerator)} / ${fmt(item?.denominator)} · 未知 ${fmt(item?.unknown == null ? '未知' : item.unknown)}` : `${fmt(item.rankedSamples)} 条明确排名 · 未知 ${fmt(item.unknown == null ? '未知' : item.unknown)}`;
  return `<article class="kpi"><div class="kpi-label">${esc(label)}${info(item?.rule || '')}</div><strong class="kpi-value ${color}">${value}</strong><div class="kpi-meta">${meta}</div>${item?.percentage != null ? `<div class="bar"><span style="width:${Math.min(100, item.percentage)}%"></span></div>` : ''}</article>`;
}

function legacyMetricCard(label, item, rule) {
  if (!item) {
    const baseline = legacyBaseline[label];
    return `<article class="legacy-card legacy-baseline"><div class="legacy-card-head"><strong>${esc(label)}</strong>${info(rule)}</div><div class="legacy-primary"><span>全轮次冻结基线</span><b>${esc(baseline?.[0] || '—')}</b><small>${esc(baseline?.[1] || '当前冻结包未提供该指标')}</small></div><p class="legacy-unavailable-note">当前类型未冻结独立分母，沿用全轮次基线；${esc(rule)}</p></article>`;
  }
  const value = item.value != null ? Number(item.value).toFixed(2) : pct(item.percentage);
  const meta = item.value != null ? `${fmt(item.rankedSamples)} 条明确排名 · 未知 ${fmt(item.unknown ?? '未知')}` : `${fmt(item.numerator)} / ${fmt(item.denominator)} · 未知 ${fmt(item.unknown ?? 0)}`;
  return `<article class="legacy-card legacy-live"><div class="legacy-card-head"><strong>${esc(label)}</strong>${info(item.rule || rule)}</div><div class="legacy-primary"><span>本类型真实值</span><b>${esc(value)}</b><small>${esc(meta)}</small></div><div class="legacy-rule">${esc(item.rule || rule)}</div></article>`;
}

function renderLegacyMetrics(group) {
  const displayed = currentType === '品牌认知型'
    ? new Set(['mentionRate', 'citationRate', 'errorRate', 'brandExplanationAccuracy'])
    : currentType === '品牌对比型'
      ? new Set(['mentionRate', 'citationRate', 'errorRate', 'brandExplanationAccuracy', 'top1Rate', 'top3Rate', 'averageRank'])
      : new Set(['mentionRate', 'citationRate', 'errorRate', 'top1Rate', 'top3Rate', 'averageRank']);
  return legacySpecs.filter(([, key]) => !displayed.has(key)).map(([label, key, rule]) => legacyMetricCard(label, key ? group.metrics[key] : null, rule)).join('');
}

function renderMetrics() {
  const group = DATA.groups[currentType];
  const m = group.metrics;
  let cards;
  if (currentType === '品牌认知型') cards = [['品牌解释准确率', m.brandExplanationAccuracy, 'green'], ['品牌定位准确率', m.brandPositioningAccuracy, 'orange'], ['品牌提及率', m.mentionRate, ''], ['引用来源率', m.citationRate, ''], ['错误信息率', m.errorRate, 'red']];
  else if (currentType === '品牌对比型') cards = [['品牌解释准确率', m.brandExplanationAccuracy, 'green'], ['对比优势表达完整率', m.advantageCompleteness, 'orange'], ['品牌提及率', m.mentionRate, ''], ['引用来源率', m.citationRate, ''], ['错误信息率', m.errorRate, 'red'], ['首推率', m.top1Rate, 'orange'], ['前三率', m.top3Rate, ''], ['平均排名', m.averageRank, 'green']];
  else cards = [['品牌提及率', m.mentionRate, 'orange'], ['首推率', m.top1Rate, ''], ['前三率', m.top3Rate, ''], ['平均排名', m.averageRank, 'green'], ['引用来源率', m.citationRate, ''], ['错误信息率', m.errorRate, 'red']];
  document.getElementById('metric-grid').innerHTML = cards.map(card => metricCard(...card)).join('') + renderLegacyMetrics(group);
  document.getElementById('metric-note').textContent = currentType === '品牌认知型' ? '品牌事实理解、定位、提及、引用与风险指标合并展示；未知值单列。' : currentType === '品牌对比型' ? '解释、优势、推荐、引用与风险指标合并展示；归属不清的内容保留为未知。' : '品牌出现、推荐排序、引用、错误和完整历史指标合并展示。';
  document.getElementById('group-summary').innerHTML = [['问题', group.questionCount], ['样本', group.sampleCount], ['采样轮次', group.sampleCount === 580 ? '核心题 6 次 / 其他题 2 次' : '每题按原计划重复'], ['规则', DATA.meta.semanticRule]].map(([label, value]) => `<div class="summary-cell"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');
  document.getElementById('examples').innerHTML = group.questionExamples.map((question, index) => `<article class="example"><b>EXAMPLE ${String(index + 1).padStart(2, '0')}</b>${esc(question)}</article>`).join('');
  const advantage = document.getElementById('advantage-section');
  advantage.hidden = currentType !== '品牌对比型';
  if (!advantage.hidden) document.getElementById('advantage-catalog').innerHTML = DATA.advantages.map(item => `<article class="catalog-item"><b>${String(item.id).padStart(2, '0')} · ${esc(item.name)}</b><p>${esc(item.strength)}</p></article>`).join('');
}

function decisionFor(row) { if (currentType === '品牌认知型') return row.positioning?.decision || row.explanation.decision; if (currentType === '品牌对比型') return row.explanation.decision; return row.errors.length ? 'fail' : 'pass'; }
function issueCell(row) {
  const errorRows = row.errors.map(item => `<div><span class="badge fail">错误</span> ${esc(item.statement)}<br><small>${esc(item.reason)} · PDF ${esc(item.pdf_pages)}页</small></div>`);
  if (currentType === '品牌认知型' && row.positioning?.decision !== 'pass') errorRows.push(`<div><span class="badge ${esc(row.positioning.decision)}">定位</span> ${esc(row.positioning.note)}</div>`);
  if (currentType === '品牌对比型' && row.advantage) { const names = id => DATA.advantages.find(item => item.id === id)?.name || id; if (row.advantage.missing.length) errorRows.push(`<div><span class="badge fail">缺失</span><div class="list-inline">${row.advantage.missing.map(id => `<span class="badge">${esc(names(id))}</span>`).join('')}</div></div>`); if (row.advantage.ambiguous.length) errorRows.push(`<div><span class="badge unclear">归属待复核</span><div class="list-inline">${row.advantage.ambiguous.map(id => `<span class="badge">${esc(names(id))}</span>`).join('')}</div></div>`); }
  return errorRows.join('<hr>') || '<span class="badge pass">未发现冲突或缺失</span>';
}
function judgementCell(row) { let html = `<span class="badge ${row.explanation.decision}">品牌解释：${labels[row.explanation.decision]}</span><div style="margin-top:6px">${esc(row.explanation.note)}</div>`; if (currentType === '品牌认知型' && row.positioning) html += `<div style="margin-top:8px"><span class="badge ${row.positioning.decision}">品牌定位：${labels[row.positioning.decision]}</span><br>${esc(row.positioning.note)}</div>`; if (currentType === '品牌对比型' && row.advantage) html += `<div style="margin-top:8px"><span class="badge ${row.advantage.percentage >= 50 ? 'pass' : 'fail'}">优势完整度 ${pct(row.advantage.percentage)}</span><br>${row.advantage.numerator} / ${row.advantage.denominator} 项 · 未知 ${row.advantage.unknown}</div>`; if (currentType === '业务场景型') html = `<span class="badge ${row.mentioned ? 'pass' : 'fail'}">${row.mentioned ? '已提及蝉圈圈' : '未提及蝉圈圈'}</span><div style="margin-top:7px">引用 ${row.citationCount} 条${row.rank ? ` · 排名 ${row.rank}` : ''}</div>`; return html; }
function filteredRows() { const query = document.getElementById('sample-search').value.trim().toLowerCase(), decision = document.getElementById('decision-filter').value; return DATA.samples.filter(row => row.questionType === currentType).filter(row => decision === 'all' || decisionFor(row) === decision).filter(row => !query || `${row.sampleId} ${row.question} ${row.answerBody} ${row.errors.map(item => item.statement).join(' ')} ${(row.advantage ? [...row.advantage.missing, ...row.advantage.ambiguous] : []).map(id => DATA.advantages.find(item => item.id === id)?.name).join(' ')}`.toLowerCase().includes(query)); }
function renderRows() { const rows = filteredRows(), size = 25, pages = Math.max(1, Math.ceil(rows.length / size)); page = Math.min(page, pages); const start = (page - 1) * size, visible = rows.slice(start, start + size); document.getElementById('sample-count').textContent = `${fmt(rows.length)} / ${fmt(DATA.groups[currentType].sampleCount)} 个样本`; document.getElementById('sample-range').textContent = rows.length ? `第 ${start + 1}-${Math.min(start + size, rows.length)} 条` : '无匹配结果'; document.getElementById('page-label').textContent = `${page} / ${pages}`; document.getElementById('prev').disabled = page <= 1; document.getElementById('next').disabled = page >= pages; document.getElementById('sample-body').innerHTML = visible.length ? visible.map(row => `<tr id="${esc(row.sampleId)}"><td><b>${esc(row.sampleId)}</b><br>${esc(row.question)}<br><span class="badge">${esc(row.pool)}</span></td><td>${judgementCell(row)}</td><td>${issueCell(row)}</td><td class="answer"><details><summary>查看完整原回答</summary><div>${esc(row.answer).replaceAll("\r", '&#13;')}</div></details></td></tr>`).join('') : '<tr><td colspan="4" class="empty">当前筛选无样本</td></tr>'; }
function setType(type) { currentType = type; page = 1; document.querySelectorAll('#type-tabs button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.type === type))); const url = new URL(location); url.searchParams.set('type', type); history.replaceState(null, '', url); renderMetrics(); renderRows(); }
async function start() { try { const response = await fetch('./dashboard-data.json', { cache: 'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`); DATA = await response.json(); const requested = new URLSearchParams(location.search).get('type'); if (typeOrder.includes(requested)) currentType = requested; document.getElementById('type-tabs').innerHTML = typeOrder.map(type => `<button type="button" data-type="${type}" aria-pressed="${type === currentType}">${type}</button>`).join(''); document.getElementById('type-tabs').addEventListener('click', event => { const button = event.target.closest('button'); if (button) setType(button.dataset.type); }); for (const id of ['sample-search', 'decision-filter']) document.getElementById(id).addEventListener('input', () => { page = 1; renderRows(); }); document.getElementById('reset').addEventListener('click', () => { document.getElementById('sample-search').value = ''; document.getElementById('decision-filter').value = 'all'; page = 1; renderRows(); }); document.getElementById('prev').addEventListener('click', () => { page -= 1; renderRows(); }); document.getElementById('next').addEventListener('click', () => { page += 1; renderRows(); }); renderMetrics(); renderRows(); } catch (error) { document.getElementById('sample-body').innerHTML = '<tr><td colspan="4" class="empty">数据加载失败，请刷新页面。</td></tr>'; console.error(error); } }
start();
