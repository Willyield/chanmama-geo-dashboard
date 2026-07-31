'use strict';

const state = {
  data: null,
  terminal: 'all',
  section: 'all',
  mention: 'all',
  first: 'all',
  search: '',
  filtersBound: false,
  detailCache: new Map(),
  detailLoads: new Map(),
};

const entryScript = document.currentScript;
const assetVersion = entryScript?.dataset.version || 'latest';
const dataFile = entryScript?.dataset.dataFile || 'dashboard-data.json';
const dataUrl = new URL(`./${dataFile}`, window.location.href);
dataUrl.searchParams.set('v', assetVersion);
const DATA_URL = dataUrl.toString();
const LOAD_ATTEMPTS = 2;

const colors = {
  blue: '#1e40af',
  cyan: '#0e7490',
  green: '#047857',
  amber: '#d97706',
  red: '#b91c1c',
  muted: '#cbd5e1',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function percent(count, denominator) {
  return denominator ? `${(count * 100 / denominator).toFixed(1)}%` : '尚无样本';
}

function formatTime(value, dateOnly = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleString('zh-CN', dateOnly
    ? { year: 'numeric', month: '2-digit', day: '2-digit', hour12: false }
    : { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

function tag(value) {
  return `<span class="tag ${value === '是' ? 'yes' : 'no'}">${escapeHtml(value)}</span>`;
}

function renderTicks() {
  document.querySelector('.tick-rule').innerHTML = '<i></i>'.repeat(84);
}

function setControlsDisabled(disabled) {
  document.querySelectorAll('.filters select, .filters input').forEach((control) => {
    control.disabled = disabled;
  });
}

function renderLoadState(attempt) {
  const retrying = attempt > 1;
  document.querySelector('#batch-meta').textContent = retrying ? `正在重新连接 ${attempt}/${LOAD_ATTEMPTS}` : '正在读取批次';
  document.querySelector('#run-meta').textContent = '正在加载公开数据';
  document.querySelector('#snapshot-meta').textContent = '正在读取冻结快照';
  document.querySelector('#executive-brief').innerHTML = `<div class="load-state" role="status" aria-live="polite">
    <span class="load-spinner" aria-hidden="true"></span>
    <div><strong>${retrying ? '正在重新连接数据' : '正在加载仪表盘数据'}</strong><span>数据量较大，请稍候。页面会在连接中断时自动重试。</span></div>
  </div>`;
  setControlsDisabled(true);
}

function renderLoadFailure() {
  document.querySelector('#batch-meta').textContent = '数据暂未加载';
  document.querySelector('#run-meta').textContent = '请重新连接';
  document.querySelector('#snapshot-meta').textContent = '冻结快照未载入';
  document.querySelector('#executive-brief').innerHTML = `<div class="load-state load-failed" role="alert">
    <div><strong>数据连接暂时中断</strong><span>已自动尝试 ${LOAD_ATTEMPTS} 次。请检查网络后重新加载，不会影响冻结数据。</span></div>
    <button id="retry-load" class="load-retry" type="button">重新加载数据</button>
  </div>`;
  document.querySelector('#retry-load').addEventListener('click', () => boot(), { once: true });
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function loadDashboardData() {
  let lastError;
  for (let attempt = 1; attempt <= LOAD_ATTEMPTS; attempt += 1) {
    renderLoadState(attempt);
    try {
      const response = await fetch(DATA_URL, {
        cache: attempt === 1 ? 'default' : 'reload',
      });
      if (!response.ok) throw new Error(`数据请求返回 ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
    if (attempt < LOAD_ATTEMPTS) await delay(attempt * 800);
  }
  throw lastError || new Error('数据加载失败');
}

function pairedStats(rows) {
  const count = rows.length;
  const webMentions = rows.filter((row) => row.web_mentioned === '是').length;
  const mobileMentions = rows.filter((row) => row.mobile_mentioned === '是').length;
  const webFirsts = rows.filter((row) => row.web_first === '是').length;
  const mobileFirsts = rows.filter((row) => row.mobile_first === '是').length;
  const webCitations = rows.reduce((sum, row) => sum + Number(row.web_citations || 0), 0);
  const mobileCitations = rows.reduce((sum, row) => sum + Number(row.mobile_citations || 0), 0);
  return {
    count,
    webMentions,
    mobileMentions,
    webFirsts,
    mobileFirsts,
    webCitations,
    mobileCitations,
    webMentionRate: count ? webMentions * 100 / count : 0,
    mobileMentionRate: count ? mobileMentions * 100 / count : 0,
    webFirstRate: count ? webFirsts * 100 / count : 0,
    mobileFirstRate: count ? mobileFirsts * 100 / count : 0,
  };
}

function countDifferenceLabel(webCount, mobileCount, unit) {
  const difference = mobileCount - webCount;
  if (difference > 0) return `手机端多 ${difference} ${unit}`;
  if (difference < 0) return `网页端多 ${Math.abs(difference)} ${unit}`;
  return `两端${unit.replace(/^个/, '')}数量相同`;
}

function mentionDifferenceSummary(webCount, mobileCount) {
  const difference = mobileCount - webCount;
  if (difference > 0) return `手机端多 ${difference} 个问题提及蝉镜`;
  if (difference < 0) return `网页端多 ${Math.abs(difference)} 个问题提及蝉镜`;
  return '两端提及蝉镜的问题数相同';
}

function thresholdLabel(data) {
  return `T${String(Number(data.threshold || data.collected || 0)).padStart(4, '0')}`;
}

function pointDifferenceLabel(webRate, mobileRate) {
  const difference = mobileRate - webRate;
  if (Math.abs(difference) < 0.05) return '两端比例相同';
  return `${difference > 0 ? '手机端' : '网页端'}高 ${Math.abs(difference).toFixed(1)} 个百分点`;
}

function executiveCard(title, tone, status, main, sub, evidence, next) {
  return `<article class="exec-card ${tone}">
    <div class="exec-top"><span class="exec-title">${escapeHtml(title)}</span><span class="status-chip ${tone}">${escapeHtml(status)}</span></div>
    <div class="exec-main">${escapeHtml(main)}</div>
    <div class="exec-sub">${escapeHtml(sub)}</div>
    <ul class="evidence-list">${evidence.map(([name, value]) => `<li><span>${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong></li>`).join('')}</ul>
    <div class="exec-next">${escapeHtml(next)}</div>
  </article>`;
}

function renderExecutive() {
  const data = state.data;
  const web = data.terminal_summary.web;
  const mobile = data.terminal_summary.mobile;
  const planned = data.planned_slots || 520;
  const coverageRate = data.collected * 100 / planned;
  const unresolved = Number(data.unresolved_count || 0);
  const isFinalWithGaps = data.status === 'FINAL_WITH_GAPS';
  const mentionCount = web.mention_count + mobile.mention_count;
  const firstCount = web.first_count + mobile.first_count;
  const advantage = data.advantage_expression;
  const uniqueQuestions = new Set(data.samples.map((row) => row.question_id)).size;
  const pairs = pairedStats(data.paired);
  const pairedMentionGap = Math.abs(pairs.mobileMentionRate - pairs.webMentionRate);
  const batch = thresholdLabel(data);
  const mentionSummary = mentionDifferenceSummary(pairs.webMentions, pairs.mobileMentions);

  document.querySelector('#executive-brief').innerHTML = `<div>
    <div class="brief-kicker">总结 / 第一轮问题批次 · ${batch}</div>
    <div class="brief-title">${isFinalWithGaps ? '最终口径：全部 520 个样本位已处理' : '阶段判断：蝉镜已有初步可见度'}；${pairs.count} 组同题对比中，${mentionSummary}。</div>
    <div class="brief-note">当前结果包含 ${data.collected} 条有效样本${unresolved ? `，另有 ${unresolved} 条标记为平台结果未完成` : ''}。双端差异只使用同一问题的有效网页端与手机端配对，未完成样本不进入指标。</div>
  </div>
  <div class="brief-status">
    <span>GEO 健康度</span>
    <strong>${isFinalWithGaps ? '最终交付' : '早期观察'}</strong>
    <span>${data.collected} 有效 / ${planned} 槽位${unresolved ? `，${unresolved} 条未完成` : ''}</span>
    <span class="stage-badge">${escapeHtml(data.status)}</span>
  </div>`;

  document.querySelector('#diagnostic-cards').innerHTML = [
    executiveCard('样本可信度', unresolved ? 'warn' : 'ok', isFinalWithGaps ? '最终口径' : '样本不足', `${data.collected}/${planned}`, `有效覆盖率 ${coverageRate.toFixed(1)}%${unresolved ? `，${unresolved} 条已明确标注` : ''}`, [
      ['已覆盖问题', `${uniqueQuestions} / ${data.question_count || 260}`],
      ['主题数', `${data.sections.length} 个`],
      ['网页 / 手机样本', `${web.collected} / ${mobile.collected}`],
      ['有效双端配对', `${data.paired_count} 组`],
    ], unresolved ? '未完成样本不进入提及率、首推率和双端差异计算。' : '全部样本已形成有效双端配对。'),
    executiveCard('品牌可见度', 'ok', '已有基础', `${(mentionCount * 100 / data.collected).toFixed(1)}%`, `${mentionCount} 条回答提及蝉镜`, [
      ['网页端提及', `${web.mention_count}/${web.collected}，${percent(web.mention_count, web.collected)}`],
      ['手机端提及', `${mobile.mention_count}/${mobile.collected}，${percent(mobile.mention_count, mobile.collected)}`],
      ['综合首推', `${firstCount}/${data.collected}，${percent(firstCount, data.collected)}`],
      ['网页 / 手机首推', `${web.first_count} / ${mobile.first_count}`],
    ], '下一步：优先补“为什么选择蝉镜”的场景证据和可引用内容。'),
    executiveCard('优势表达率', 'info', '冻结口径', `${advantage.rate.toFixed(2)}%`, `${advantage.count}/${advantage.denominator} 条有效回答明确表达优势`, [
      ['网页端', `${advantage.terminal_summary.web.count}/${advantage.terminal_summary.web.denominator}，${advantage.terminal_summary.web.rate.toFixed(2)}%`],
      ['手机端', `${advantage.terminal_summary.mobile.count}/${advantage.terminal_summary.mobile.denominator}，${advantage.terminal_summary.mobile.rate.toFixed(2)}%`],
      ['双端均表达', `${advantage.paired_summary.both}/${advantage.paired_summary.paired} 组`],
      ['仅单端表达', `网页 ${advantage.paired_summary.web_only} / 手机 ${advantage.paired_summary.mobile_only}`],
    ], '明确说明至少一项优势、正向能力或比较优势才计入；未完成样本不进入分母。'),
    executiveCard('双端差异', 'info', '手机端暂高', countDifferenceLabel(pairs.webMentions, pairs.mobileMentions, '个提及问题'), `同题配对提及率相差 ${pairedMentionGap.toFixed(1)} 个百分点`, [
      ['提及问题', `手机 ${pairs.mobileMentions} 个，网页 ${pairs.webMentions} 个`],
      ['提及率', `手机 ${pairs.mobileMentionRate.toFixed(1)}%，网页 ${pairs.webMentionRate.toFixed(1)}%`],
      ['首推问题', `手机 ${pairs.mobileFirsts} 个，网页 ${pairs.webFirsts} 个`],
      ['引用来源', `手机 ${pairs.mobileCitations} 个，网页 ${pairs.webCitations} 个`],
    ], '下一步：保持同题双端复测，确认差异是否随样本扩大而持续。'),
  ].join('');
}

function sampleMatches(row) {
  if (state.terminal !== 'all' && row.target_terminal !== state.terminal) return false;
  if (state.section !== 'all' && row.section_name !== state.section) return false;
  if (state.mention === 'yes' && row.mentioned_chanjing !== '是') return false;
  if (state.mention === 'no' && row.mentioned_chanjing !== '否') return false;
  if (state.first === 'yes' && row.chanjing_is_first !== '是') return false;
  if (state.first === 'no' && row.chanjing_is_first !== '否') return false;
  if (!state.search) return true;
  return `${row.sample_id} ${row.section_name} ${row.question_text}`.toLowerCase().includes(state.search);
}

function pairMatches(row) {
  if (state.section !== 'all' && row.section_name !== state.section) return false;
  if (state.search && !`${row.section_name} ${row.question_text}`.toLowerCase().includes(state.search)) return false;
  const mentionValue = state.terminal === 'web' ? row.web_mentioned : state.terminal === 'mobile' ? row.mobile_mentioned : (row.web_mentioned === '是' || row.mobile_mentioned === '是' ? '是' : '否');
  const firstValue = state.terminal === 'web' ? row.web_first : state.terminal === 'mobile' ? row.mobile_first : (row.web_first === '是' || row.mobile_first === '是' ? '是' : '否');
  if (state.mention === 'yes' && mentionValue !== '是') return false;
  if (state.mention === 'no' && mentionValue !== '否') return false;
  if (state.first === 'yes' && firstValue !== '是') return false;
  if (state.first === 'no' && firstValue !== '否') return false;
  return true;
}

function filteredSamples() {
  return state.data.samples.filter(sampleMatches);
}

function filteredUnresolved() {
  return (state.data.unresolved_samples || []).filter((row) => {
    if (state.terminal !== 'all' && row.target_terminal !== state.terminal) return false;
    if (state.section !== 'all' && row.section_name !== state.section) return false;
    if (state.mention !== 'all' || state.first !== 'all') return false;
    if (!state.search) return true;
    return `${row.sample_id} ${row.section_name} ${row.question_text}`.toLowerCase().includes(state.search);
  });
}

function filteredPairs() {
  return state.data.paired.filter(pairMatches);
}

function donutChart(title, items, centerValue, centerLabel) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const circumference = 263.89;
  let offset = 0;
  const circles = items.map((item) => {
    const length = item.value / total * circumference;
    const circle = `<circle cx="50" cy="50" r="42" stroke="${item.color}" stroke-dasharray="${length.toFixed(2)} ${(circumference - length).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"></circle>`;
    offset += length;
    return circle;
  }).join('');
  return `<section class="chart-card"><div class="section-head"><h2>${escapeHtml(title)}</h2></div><div class="chart-body"><div class="donut-row">
    <div class="donut"><svg viewBox="0 0 100 100" role="img" aria-label="${escapeHtml(title)}">${circles}</svg><div class="donut-center">${escapeHtml(centerValue)}<small>${escapeHtml(centerLabel)}</small></div></div>
    <div class="legend">${items.map((item) => `<div class="legend-item"><span class="legend-name"><i class="swatch" style="background:${item.color}"></i>${escapeHtml(item.name)}</span><strong>${escapeHtml(item.label)}</strong></div>`).join('')}</div>
  </div></div></section>`;
}

function barChart(title, items, note, maxValue = null) {
  const maximum = maxValue || Math.max(...items.map((item) => item.value), 1);
  return `<section class="chart-card"><div class="section-head"><h2>${escapeHtml(title)}</h2></div><div class="chart-body"><div class="bar-list">${items.map((item) => `<div class="bar-row">
    <span class="bar-label" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, item.value / maximum * 100))}%;background:${item.color || colors.blue}"></div></div><span class="bar-value">${escapeHtml(item.label)}</span>
  </div>`).join('')}</div><div class="chart-note">${escapeHtml(note)}</div></div></section>`;
}

function renderCharts(samples, pairs) {
  const data = state.data;
  const pending = Math.max((data.planned_slots || 520) - data.collected, 0);
  const first = samples.filter((row) => row.chanjing_is_first === '是').length;
  const mentioned = samples.filter((row) => row.mentioned_chanjing === '是').length;
  const mentionOnly = Math.max(mentioned - first, 0);
  const notMentioned = Math.max(samples.length - mentioned, 0);
  const pairData = pairedStats(pairs);
  const sectionCounts = new Map();
  samples.forEach((row) => sectionCounts.set(row.section_name, (sectionCounts.get(row.section_name) || 0) + 1));
  const sectionItems = [...sectionCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, label: `${value} 条`, color: colors.blue }));

  document.querySelector('#chart-grid').innerHTML = [
    donutChart('采样完成度', [
      { name: '已完成', value: data.collected, label: `${data.collected} 条`, color: colors.blue },
      { name: '待采样', value: pending, label: `${pending} 条`, color: colors.muted },
    ], `${(data.collected * 100 / (data.planned_slots || 520)).toFixed(1)}%`, `${data.collected}/${data.planned_slots || 520}`),
    donutChart('当前筛选结果', [
      { name: '蝉镜首推', value: first, label: `${first} 条`, color: colors.green },
      { name: '提及但非首推', value: mentionOnly, label: `${mentionOnly} 条`, color: colors.blue },
      { name: '未提及蝉镜', value: notMentioned, label: `${notMentioned} 条`, color: colors.muted },
    ], `${samples.length} 条`, '当前筛选'),
    barChart('双端品牌表现', pairData.count ? [
      { name: '网页端提及蝉镜', value: pairData.webMentionRate, label: `${pairData.webMentions}/${pairData.count}，${pairData.webMentionRate.toFixed(1)}%`, color: colors.blue },
      { name: '手机端提及蝉镜', value: pairData.mobileMentionRate, label: `${pairData.mobileMentions}/${pairData.count}，${pairData.mobileMentionRate.toFixed(1)}%`, color: colors.cyan },
      { name: '网页端首推蝉镜', value: pairData.webFirstRate, label: `${pairData.webFirsts}/${pairData.count}，${pairData.webFirstRate.toFixed(1)}%`, color: colors.green },
      { name: '手机端首推蝉镜', value: pairData.mobileFirstRate, label: `${pairData.mobileFirsts}/${pairData.count}，${pairData.mobileFirstRate.toFixed(1)}%`, color: colors.amber },
    ] : [{ name: '当前筛选无配对', value: 0, label: '0 条', color: colors.muted }], `只比较当前筛选下的 ${pairData.count} 组同题配对`, 100),
    barChart('主题采样分布', sectionItems.length ? sectionItems : [{ name: '当前筛选无样本', value: 0, label: '0 条', color: colors.muted }], '按当前筛选的有效样本数排序'),
  ].join('');
}

function insightCard({ title, badge, value, meta, copy, rate, tone = '' }) {
  return `<article class="insight-card ${tone}"><div class="insight-card-head"><div class="insight-title">${escapeHtml(title)}</div><span class="pill">${escapeHtml(badge)}</span></div>
    <div><div class="insight-value">${escapeHtml(value)}</div><div class="insight-meta">${escapeHtml(meta)}</div></div>
    <div class="insight-bar"><span style="width:${Math.max(0, Math.min(100, rate || 0))}%"></span></div>
    <div class="insight-copy">${escapeHtml(copy)}</div></article>`;
}

function renderFirstRecommendations(samples) {
  const groups = new Map();
  samples.forEach((row) => {
    const name = row.first_recommendation || '未识别明确首位';
    groups.set(name, (groups.get(name) || 0) + 1);
  });
  const rows = [...groups.entries()].sort((a, b) => b[1] - a[1]);
  document.querySelector('#first-recommendation-count').textContent = `${rows.length} 种结果`;
  document.querySelector('#first-recommendation-cards').innerHTML = rows.length ? rows.map(([name, count]) => insightCard({
    title: name,
    badge: percent(count, samples.length),
    value: `${count}/${samples.length}`,
    meta: '当前筛选样本的第一推荐',
    copy: name === '蝉镜' ? '蝉镜被识别为回答中的第一推荐。' : name === '未识别明确首位' ? '回答中没有识别到明确的品牌或工具首位。' : `${name} 被识别为回答中的第一推荐。`,
    rate: samples.length ? count * 100 / samples.length : 0,
    tone: name === '蝉镜' ? 'ok' : name === '剪映' ? 'warn' : '',
  })).join('') : '<div class="empty">当前筛选下没有样本</div>';
}

function splitUrls(value) {
  return String(value || '').split('|').map((item) => item.trim()).filter(Boolean);
}

function sourceMetrics(row) {
  const urls = splitUrls(row.source_urls);
  const count = Number.isInteger(row.source_count) ? row.source_count : urls.length;
  const keys = Array.isArray(row.source_keys) ? row.source_keys : urls;
  return { count, keys };
}

function renderSourceEvidence(samples) {
  const metrics = samples.map(sourceMetrics);
  const withSources = metrics.filter((item) => item.count > 0).length;
  const citationCount = samples.reduce((sum, row) => sum + Number(row.citation_count || 0), 0);
  const sourceCount = metrics.reduce((sum, item) => sum + item.count, 0);
  const uniqueUrls = new Set(metrics.flatMap((item) => item.keys)).size;
  const total = samples.length;
  document.querySelector('#source-evidence-count').textContent = `${withSources}/${total} 条有来源`;
  const cards = [
    { title: '有可点击来源', value: `${withSources}/${total}`, meta: percent(withSources, total), copy: '这些样本记录了至少一个可点击来源页面。', rate: total ? withSources * 100 / total : 0, tone: 'ok' },
    { title: '未记录来源', value: `${total - withSources}/${total}`, meta: percent(total - withSources, total), copy: '这些样本没有记录来源链接，不能据此判断引用质量。', rate: total ? (total - withSources) * 100 / total : 0, tone: 'warn' },
    { title: '回答识别引用', value: `${citationCount} 个`, meta: '回答解析得到的引用总数', copy: '这是回答中的普通引用数量，不等同于蝉镜自有引用。', rate: total ? Math.min(100, citationCount / total * 10) : 0 },
    { title: '可点击来源页面', value: `${sourceCount} 个`, meta: `去重后 ${uniqueUrls} 个页面`, copy: '同一页面在不同回答中出现会重复计入来源条目。', rate: sourceCount ? uniqueUrls * 100 / sourceCount : 0, tone: 'primary' },
  ];
  document.querySelector('#source-evidence-cards').innerHTML = cards.map(insightCard).join('');
}

function renderPairedInsights(pairs) {
  const stats = pairedStats(pairs);
  document.querySelector('#paired-insight-count').textContent = `${stats.count} 组同题配对`;
  if (!stats.count) {
    document.querySelector('#paired-insight-cards').innerHTML = '<div class="empty">当前筛选下没有双端配对</div>';
    return;
  }
  const mentionGap = Math.abs(stats.mobileMentionRate - stats.webMentionRate);
  const firstGap = Math.abs(stats.mobileFirstRate - stats.webFirstRate);
  const citationDifference = stats.mobileCitations - stats.webCitations;
  const cards = [
    { title: '蝉镜提及差异', value: countDifferenceLabel(stats.webMentions, stats.mobileMentions, '个问题'), badge: pointDifferenceLabel(stats.webMentionRate, stats.mobileMentionRate), meta: `手机 ${stats.mobileMentions}/${stats.count}（${stats.mobileMentionRate.toFixed(1)}%）；网页 ${stats.webMentions}/${stats.count}（${stats.webMentionRate.toFixed(1)}%）`, copy: `两端提及率相差 ${mentionGap.toFixed(1)} 个百分点。百分点是两个百分比直接相减，不是增长率。`, rate: mentionGap, tone: 'primary' },
    { title: '蝉镜首推差异', value: countDifferenceLabel(stats.webFirsts, stats.mobileFirsts, '个问题'), badge: pointDifferenceLabel(stats.webFirstRate, stats.mobileFirstRate), meta: `手机 ${stats.mobileFirsts}/${stats.count}（${stats.mobileFirstRate.toFixed(1)}%）；网页 ${stats.webFirsts}/${stats.count}（${stats.webFirstRate.toFixed(1)}%）`, copy: `两端首推率相差 ${firstGap.toFixed(1)} 个百分点。`, rate: firstGap, tone: 'ok' },
    { title: '引用来源数量差异', value: citationDifference > 0 ? `手机端合计多 ${citationDifference} 个` : citationDifference < 0 ? `网页端合计多 ${Math.abs(citationDifference)} 个` : '两端合计相同', badge: `${stats.count} 组`, meta: `手机端 ${stats.mobileCitations} 个；网页端 ${stats.webCitations} 个`, copy: '这是同题配对回答记录的来源数量之和；每个问题的增减方向可能不同。', rate: Math.min(100, Math.abs(citationDifference)), tone: 'warn' },
    { title: '比较样本基数', value: `${stats.count} 组`, badge: '同一问题', meta: `${stats.count} 个网页回答 + ${stats.count} 个手机回答`, copy: '只有同一问题在两个终端都完成，才进入双端差异计算。', rate: stats.count * 100 / 260 },
  ];
  document.querySelector('#paired-insight-cards').innerHTML = cards.map(insightCard).join('');
}

function tableHtml(headers, rows) {
  return `<thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody>`;
}

function sectionDifference(row) {
  if (!row.web_count || !row.mobile_count) return '<span class="plain-difference">尚不能比较</span>';
  const difference = row.mobile_mention_rate - row.web_mention_rate;
  const className = difference > 0 ? 'mobile-higher' : difference < 0 ? 'web-higher' : '';
  return `<span class="plain-difference ${className}">${escapeHtml(pointDifferenceLabel(row.web_mention_rate, row.mobile_mention_rate))}</span>`;
}

function terminalSummary(count, rate) {
  if (!count) return '尚未采样';
  const mentionCount = Math.round(count * rate / 100);
  return `${count}/20 条<br>提及 ${mentionCount} 条（${Number(rate).toFixed(1)}%）`;
}

function renderSectionTable() {
  const query = state.search;
  const sections = state.data.sections.filter((row) => (state.section === 'all' || row.section_name === state.section) && (!query || row.section_name.toLowerCase().includes(query)));
  document.querySelector('#section-count').textContent = `${sections.length} 个主题`;
  const rows = sections.map((row) => `<tr><td class="question-cell"><strong>${escapeHtml(row.section_name)}</strong></td>
    <td>${row.web_count + row.mobile_count}/40 条</td><td>${terminalSummary(row.web_count, row.web_mention_rate)}</td><td>${terminalSummary(row.mobile_count, row.mobile_mention_rate)}</td><td>${sectionDifference(row)}</td></tr>`);
  document.querySelector('#section-table').innerHTML = tableHtml(['主题', '总采样', '网页端', '手机端', '双端提及率差异'], rows.length ? rows : ['<tr><td colspan="5" class="empty">当前筛选下没有主题</td></tr>']);
}

function mentionChangeLabel(row) {
  if (row.web_mentioned === '是' && row.mobile_mentioned === '是') return '两端都提及蝉镜';
  if (row.web_mentioned === '否' && row.mobile_mentioned === '是') return '手机端新增提及蝉镜';
  if (row.web_mentioned === '是' && row.mobile_mentioned === '否') return '手机端未再提及蝉镜';
  return '两端都未提及蝉镜';
}

function firstChangeLabel(row) {
  if (row.web_first === '是' && row.mobile_first === '是') return '两端都首推蝉镜';
  if (row.web_first === '否' && row.mobile_first === '是') return '手机端改为首推蝉镜';
  if (row.web_first === '是' && row.mobile_first === '否') return '手机端不再首推蝉镜';
  return '两端都未首推蝉镜';
}

function citationDifferenceLabel(value) {
  const difference = Number(value || 0);
  if (difference > 0) return `手机端多 ${difference} 个来源`;
  if (difference < 0) return `手机端少 ${Math.abs(difference)} 个来源`;
  return '两端来源数量相同';
}

function renderPairedTable(pairs) {
  document.querySelector('#paired-count').textContent = `${pairs.length} 组配对`;
  const rows = pairs.map((row) => `<tr><td class="question-cell"><strong>${escapeHtml(row.section_name)}</strong><br>${escapeHtml(row.question_text)}</td>
    <td>${tag(row.web_mentioned)}</td><td>${tag(row.mobile_mentioned)}</td><td class="plain-difference">${escapeHtml(mentionChangeLabel(row))}</td>
    <td>${tag(row.web_first)}</td><td>${tag(row.mobile_first)}</td><td class="plain-difference">${escapeHtml(firstChangeLabel(row))}</td>
    <td class="plain-difference">${escapeHtml(citationDifferenceLabel(row.citation_delta))}</td></tr>`);
  document.querySelector('#paired-table').innerHTML = tableHtml(['问题', '网页提及', '手机提及', '提及变化', '网页首推', '手机首推', '首推变化', '引用来源变化'], rows.length ? rows : ['<tr><td colspan="8" class="empty">当前筛选下没有双端配对</td></tr>']);
}

function detailValue(row) {
  return state.detailCache.get(row.sample_id) || row;
}

function sourceLinks(row) {
  const detail = detailValue(row);
  const urls = splitUrls(detail.source_urls);
  if (!urls.length) return '<span>未记录来源</span>';
  return `<details class="source-details"><summary>${urls.length} 个来源</summary><div class="source-list">${sourceLinkList(urls)}</div></details>`;
}

function sourceLinkList(urls) {
  return urls.map((url, index) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">来源 ${index + 1}</a>`).join('');
}

function deferredSourceLinks(row) {
  const detail = state.detailCache.get(row.sample_id);
  if (detail || Object.prototype.hasOwnProperty.call(row, 'source_urls')) return sourceLinks(row);
  if (!row.source_count) return '<span>未记录来源</span>';
  return `<details class="source-details deferred-details" data-detail-sample="${escapeHtml(row.sample_id)}" data-detail-kind="sources"><summary>${row.source_count} 个来源</summary><div class="source-list deferred-detail">展开后加载来源</div></details>`;
}

function answerDetails(row) {
  const detail = detailValue(row);
  if (Object.prototype.hasOwnProperty.call(detail, 'answer_text')) {
    return `<details class="answer-details"><summary>查看回答</summary><div class="answer-text">${escapeHtml(detail.answer_text)}</div></details>`;
  }
  return `<details class="answer-details deferred-details" data-detail-sample="${escapeHtml(row.sample_id)}" data-detail-kind="answer"><summary>查看回答</summary><div class="answer-text deferred-detail">展开后加载回答</div></details>`;
}

async function loadSampleDetail(sampleId) {
  if (state.detailCache.has(sampleId)) return state.detailCache.get(sampleId);
  if (state.detailLoads.has(sampleId)) return state.detailLoads.get(sampleId);
  const sample = state.data.samples.find((row) => row.sample_id === sampleId);
  if (!sample?.detail_path) throw new Error('该样本没有公开明细路径');
  const detailUrl = new URL(sample.detail_path, window.location.href);
  detailUrl.searchParams.set('v', assetVersion);
  const request = fetch(detailUrl, { cache: 'default' }).then(async (response) => {
    if (!response.ok) throw new Error(`明细请求返回 ${response.status}`);
    const detail = await response.json();
    if (detail.sample_id !== sampleId) throw new Error('明细样本标识不一致');
    state.detailCache.set(sampleId, detail);
    return detail;
  }).finally(() => state.detailLoads.delete(sampleId));
  state.detailLoads.set(sampleId, request);
  return request;
}

function hydrateSampleDetail(sampleId, detail) {
  document.querySelectorAll('.deferred-details').forEach((element) => {
    if (element.dataset.detailSample !== sampleId) return;
    if (element.dataset.detailKind === 'sources') {
      const urls = splitUrls(detail.source_urls);
      element.querySelector('.source-list').innerHTML = urls.length ? sourceLinkList(urls) : '<span>未记录来源</span>';
    } else {
      element.querySelector('.answer-text').textContent = detail.answer_text || '';
    }
    element.classList.remove('deferred-details');
    delete element.dataset.detailSample;
    delete element.dataset.detailKind;
  });
}

function bindDeferredDetails() {
  const table = document.querySelector('#sample-table');
  if (table.dataset.detailsBound === 'true') return;
  table.addEventListener('toggle', async (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open || !details.dataset.detailSample) return;
    const placeholder = details.querySelector('.deferred-detail');
    if (placeholder) placeholder.textContent = '正在加载...';
    try {
      const detail = await loadSampleDetail(details.dataset.detailSample);
      hydrateSampleDetail(details.dataset.detailSample, detail);
    } catch (error) {
      if (placeholder) placeholder.textContent = '加载失败，请收起后重试';
    }
  }, true);
  table.dataset.detailsBound = 'true';
}

function renderSampleTable(samples, unresolved) {
  document.querySelector('#sample-count').textContent = `${samples.length + unresolved.length} 个样本位`;
  const rows = samples.map((row) => `<tr><td class="sample-id">${escapeHtml(row.sample_id)}</td><td>${row.target_terminal === 'web' ? '网页端' : '手机端'}</td>
    <td class="question-cell"><strong>${escapeHtml(row.section_name)}</strong><br>${escapeHtml(row.question_text)}</td><td>${tag(row.mentioned_chanjing)}</td>
    <td>${escapeHtml(row.first_recommendation || '未识别明确首位')}</td><td>${deferredSourceLinks(row)}</td>
    <td class="answer-cell">${answerDetails(row)}</td></tr>`);
  unresolved.forEach((row) => rows.push(`<tr><td class="sample-id">${escapeHtml(row.sample_id)}</td><td>${row.target_terminal === 'web' ? '网页端' : '手机端'}</td>
    <td class="question-cell"><strong>${escapeHtml(row.section_name)}</strong><br>${escapeHtml(row.question_text)}</td><td><span class="tag">未完成</span></td>
    <td>不计入</td><td>未记录来源</td><td class="answer-cell">${escapeHtml(row.status_label || '平台结果未完成')}</td></tr>`));
  document.querySelector('#sample-table').innerHTML = tableHtml(['采样ID', '终端', '主题 / 问题', '蝉镜提及', '第一推荐', '引用来源', '回答'], rows.length ? rows : ['<tr><td colspan="7" class="empty">当前筛选下没有样本</td></tr>']);
}

function renderAll() {
  const samples = filteredSamples();
  const unresolved = filteredUnresolved();
  const pairs = filteredPairs();
  renderCharts(samples, pairs);
  renderFirstRecommendations(samples);
  renderSourceEvidence(samples);
  renderPairedInsights(pairs);
  renderSectionTable();
  renderPairedTable(pairs);
  renderSampleTable(samples, unresolved);
}

function bindFilters() {
  if (state.filtersBound) return;
  const sectionSelect = document.querySelector('#section-filter');
  sectionSelect.innerHTML = `<option value="all">全部主题</option>${state.data.sections.map((row) => `<option value="${escapeHtml(row.section_name)}">${escapeHtml(row.section_name)}</option>`).join('')}`;
  const bindings = [
    ['#terminal-filter', 'terminal', 'change'],
    ['#section-filter', 'section', 'change'],
    ['#mention-filter', 'mention', 'change'],
    ['#first-filter', 'first', 'change'],
  ];
  bindings.forEach(([selector, key, eventName]) => document.querySelector(selector).addEventListener(eventName, (event) => {
    state[key] = event.target.value;
    renderAll();
  }));
  document.querySelector('#search').addEventListener('input', (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderAll();
  });
  state.filtersBound = true;
  bindDeferredDetails();
}

async function boot() {
  renderTicks();
  state.data = await loadDashboardData();
  const batchDate = formatTime(state.data.observed_range?.first, true);
  const batch = thresholdLabel(state.data);
  document.querySelector('#page-title').textContent = `蝉镜AI GEO ${batchDate} 第一轮问题批次`;
  document.querySelector('#batch-meta').textContent = `批次：${batch}`;
  document.querySelector('#snapshot-meta').textContent = `口径随 ${batch} 冻结快照`;
  document.querySelector('#run-meta').textContent = `更新：${formatTime(state.data.generated_at)}`;
  renderExecutive();
  bindFilters();
  setControlsDisabled(false);
  renderAll();
}

boot().catch(renderLoadFailure);
