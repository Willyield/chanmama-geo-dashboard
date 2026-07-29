'use strict';

const state = { data: null, view: 'overview', query: '' };
const labels = { overview: '主题总览', web: '网页端样本', mobile: '手机端样本', compare: '双端差异' };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function pct(value, denominator) {
  return denominator ? `${Number(value).toFixed(1)}%` : '—';
}

function pp(value) {
  const number = Number(value || 0);
  return `${number > 0 ? '+' : ''}${number.toFixed(1)}pp`;
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

function matches(row) {
  if (!state.query) return true;
  const haystack = `${row.question_text || ''} ${row.section_name || ''} ${row.sample_id || ''}`.toLowerCase();
  return haystack.includes(state.query.toLowerCase());
}

function renderTicks() {
  document.querySelector('.tick-rule').innerHTML = '<i></i>'.repeat(84);
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
  const coverageRate = data.collected / planned * 100;
  const mentionCount = web.mention_count + mobile.mention_count;
  const mentionRate = mentionCount / data.collected * 100;
  const firstCount = web.first_count + mobile.first_count;
  const firstRate = firstCount / data.collected * 100;
  const pairedRate = data.paired_count / (data.question_count || 260) * 100;
  const mentionGap = mobile.mention_rate - web.mention_rate;
  const firstGap = mobile.first_rate - web.first_rate;
  const citationGap = mobile.citation_count - web.citation_count;
  const uniqueQuestions = new Set(data.samples.map((row) => row.question_id)).size;

  document.querySelector('#executive-brief').innerHTML = `<div>
    <div class="brief-kicker">总结 / 第一轮问题批次 · T0100</div>
    <div class="brief-title">阶段判断：蝉镜已有初步可见度，但样本覆盖仍少；手机端提及率暂高于网页端。</div>
    <div class="brief-note">当前结果来自 ${data.collected} 条有效样本和 ${data.paired_count} 组双端配对，只用于识别早期方向。默认先看覆盖、品牌可见度和终端差异，下方保留全部明细供复核。</div>
  </div>
  <div class="brief-status">
    <span>GEO 健康度</span>
    <strong>早期观察</strong>
    <span>${data.collected}/${planned}，完成率 ${coverageRate.toFixed(1)}%</span>
    <span class="stage-badge">${escapeHtml(data.status)}</span>
  </div>`;

  document.querySelector('#diagnostic-cards').innerHTML = [
    executiveCard('样本可信度', 'warn', '样本不足', `${data.collected}/${planned}`, `完成率 ${coverageRate.toFixed(1)}%，仅作阶段判断`, [
      ['已覆盖问题', `${uniqueQuestions} / ${data.question_count || 260}`],
      ['主题数', `${data.sections.length} 个`],
      ['网页 / 手机', `${web.collected} / ${mobile.collected}`],
      ['有效双端配对', `${data.paired_count} 组（${pairedRate.toFixed(1)}%）`],
    ], '下一步：继续成对采样，覆盖不足前不形成稳定趋势结论。'),
    executiveCard('品牌可见度', 'ok', '已有基础', `${mentionRate.toFixed(1)}%`, `${mentionCount} 次提及 / ${data.collected} 条有效样本`, [
      ['网页提及率', `${web.mention_count}/${web.collected}，${pct(web.mention_rate, web.collected)}`],
      ['手机提及率', `${mobile.mention_count}/${mobile.collected}，${pct(mobile.mention_rate, mobile.collected)}`],
      ['综合首推率', `${firstCount}/${data.collected}，${firstRate.toFixed(1)}%`],
      ['网页 / 手机首推', `${web.first_count} / ${mobile.first_count}`],
    ], '下一步：优先补“为什么选择蝉镜”的场景证据和可引用内容。'),
    executiveCard('双端差异', 'info', '手机端暂高', pp(mentionGap), '手机端提及率减网页端提及率', [
      ['提及率', `${pct(web.mention_rate, web.collected)} → ${pct(mobile.mention_rate, mobile.collected)}`],
      ['首推率差', pp(firstGap)],
      ['引用量差', `${citationGap > 0 ? '+' : ''}${citationGap}`],
      ['配对基数', `${data.paired_count} 组`],
    ], '下一步：保持同题双端复测，确认差异是否随样本扩大而持续。'),
  ].join('');
}

function currentMetrics() {
  const data = state.data;
  const web = data.terminal_summary.web;
  const mobile = data.terminal_summary.mobile;
  if (state.view === 'web') return [
    ['网页覆盖', `${web.collected} / 260`, '有效样本'],
    ['蝉镜提及率', pct(web.mention_rate, web.collected), `${web.mention_count} 次提及`],
    ['首位推荐率', pct(web.first_rate, web.collected), `${web.first_count} 次首位`],
    ['回答引用量', web.citation_count, '普通来源链接'],
  ];
  if (state.view === 'mobile') return [
    ['手机覆盖', `${mobile.collected} / 260`, '有效样本'],
    ['蝉镜提及率', pct(mobile.mention_rate, mobile.collected), `${mobile.mention_count} 次提及`],
    ['首位推荐率', pct(mobile.first_rate, mobile.collected), `${mobile.first_count} 次首位`],
    ['回答引用量', mobile.citation_count, '普通来源链接'],
  ];
  if (state.view === 'compare') return [
    ['有效配对', `${data.paired_count} / 260`, '同题双端配对'],
    ['提及率差', pp(mobile.mention_rate - web.mention_rate), '手机 - 网页'],
    ['首位率差', pp(mobile.first_rate - web.first_rate), '手机 - 网页'],
    ['引用量差', mobile.citation_count - web.citation_count, '手机 - 网页'],
  ];
  return [
    ['总覆盖', `${data.collected} / ${data.planned_slots || 520}`, data.status],
    ['网页提及率', pct(web.mention_rate, web.collected), `${web.collected} 个网页样本`],
    ['手机提及率', pct(mobile.mention_rate, mobile.collected), `${mobile.collected} 个手机样本`],
    ['有效配对', `${data.paired_count} / 260`, '同题一对一'],
  ];
}

function renderMetrics() {
  document.querySelector('#metrics').innerHTML = currentMetrics().map(([name, value, note]) => `<div class="metric"><span>${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`).join('');
}

function sourceLinks(value) {
  const urls = String(value || '').split('|').map((item) => item.trim()).filter(Boolean);
  if (!urls.length) return '<span>未记录</span>';
  return `<details class="source-details"><summary>${urls.length} 个来源</summary><div class="source-list">${urls.map((url, index) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">来源 ${index + 1}</a>`).join('')}</div></details>`;
}

function sampleTable(terminal) {
  const rows = state.data.samples.filter((row) => row.target_terminal === terminal && matches(row));
  if (!rows.length) return '<div class="empty">当前筛选下没有样本</div>';
  return `<div class="table-wrap"><table><thead><tr><th>样本</th><th>主题 / 问题</th><th>蝉镜提及</th><th>首位推荐</th><th>来源</th><th>回答</th></tr></thead><tbody>${rows.map((row) => `<tr>
    <td class="sample-id">${escapeHtml(row.sample_id)}</td>
    <td class="question-cell"><strong>${escapeHtml(row.section_name)}</strong><br>${escapeHtml(row.question_text)}</td>
    <td>${tag(row.mentioned_chanjing)}</td>
    <td>${tag(row.chanjing_is_first)}<br>${escapeHtml(row.first_recommendation || '未识别')}</td>
    <td>${sourceLinks(row.source_urls)}</td>
    <td class="answer-cell"><details class="answer-details"><summary>查看回答</summary><div class="answer-text">${escapeHtml(row.answer_text)}</div></details></td>
  </tr>`).join('')}</tbody></table></div>`;
}

function overviewTable() {
  const rows = state.data.sections.filter(matches);
  if (!rows.length) return '<div class="empty">当前筛选下没有主题</div>';
  return `<div class="table-wrap"><table><thead><tr><th>主题</th><th>网页覆盖</th><th>网页提及率</th><th>手机覆盖</th><th>手机提及率</th><th>手机 - 网页</th></tr></thead><tbody>${rows.map((row) => `<tr>
    <td class="question-cell"><strong>${escapeHtml(row.section_name)}</strong></td>
    <td>${row.web_count} / 20</td>
    <td>${pct(row.web_mention_rate, row.web_count)}<div class="bar"><span style="width:${row.web_count ? row.web_mention_rate : 0}%"></span></div></td>
    <td>${row.mobile_count} / 20</td>
    <td>${pct(row.mobile_mention_rate, row.mobile_count)}<div class="bar mobile"><span style="width:${row.mobile_count ? row.mobile_mention_rate : 0}%"></span></div></td>
    <td class="delta">${row.web_count && row.mobile_count ? pp(row.mobile_mention_rate - row.web_mention_rate) : '—'}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

function compareTable() {
  const rows = state.data.paired.filter(matches);
  if (!rows.length) return '<div class="empty">当前筛选下没有有效双端配对</div>';
  return `<div class="table-wrap"><table><thead><tr><th>问题</th><th>网页提及</th><th>手机提及</th><th>提及变化</th><th>网页首位</th><th>手机首位</th><th>引用差</th></tr></thead><tbody>${rows.map((row) => `<tr>
    <td class="question-cell"><strong>${escapeHtml(row.section_name)}</strong><br>${escapeHtml(row.question_text)}</td>
    <td>${tag(row.web_mentioned)}</td><td>${tag(row.mobile_mentioned)}</td><td>${row.mention_changed ? '有' : '无'}</td>
    <td>${tag(row.web_first)}</td><td>${tag(row.mobile_first)}</td><td class="delta">${row.citation_delta > 0 ? '+' : ''}${row.citation_delta}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

function visibleRows() {
  if (state.view === 'overview') return state.data.sections.filter(matches).length;
  if (state.view === 'compare') return state.data.paired.filter(matches).length;
  return state.data.samples.filter((row) => row.target_terminal === state.view && matches(row)).length;
}

function render() {
  const captions = {
    overview: '13 个业务主题，网页端与手机端并列比较',
    web: '豆包网页端快速模式的逐题样本与来源',
    mobile: '豆包手机端快速模式的逐题样本与来源',
    compare: '仅使用同一问题的有效双端配对',
  };
  document.querySelector('#view-title').textContent = labels[state.view];
  document.querySelector('#view-caption').textContent = captions[state.view];
  document.querySelector('#view-count').textContent = `${visibleRows()} 条`;
  renderMetrics();
  document.querySelector('#content').innerHTML = state.view === 'overview'
    ? overviewTable()
    : state.view === 'compare'
      ? compareTable()
      : sampleTable(state.view);
}

async function boot() {
  renderTicks();
  const response = await fetch('./dashboard-data.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`数据加载失败: ${response.status}`);
  state.data = await response.json();
  const batchDate = formatTime(state.data.observed_range?.first, true);
  document.querySelector('#page-title').textContent = `蝉镜AI GEO ${batchDate} 第一轮问题批次`;
  document.querySelector('#run-meta').textContent = `更新：${formatTime(state.data.generated_at)}`;
  renderExecutive();

  const compareTab = document.querySelector('[data-view="compare"]');
  compareTab.disabled = state.data.paired_count === 0;
  compareTab.title = compareTab.disabled ? '暂无有效双端配对' : '';
  document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => {
    state.view = button.dataset.view;
    document.querySelectorAll('.tab').forEach((item) => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-selected', item === button ? 'true' : 'false');
    });
    render();
  }));
  document.querySelector('#search').addEventListener('input', (event) => {
    state.query = event.target.value.trim();
    render();
  });
  render();
}

boot().catch((error) => {
  document.querySelector('#content').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  throw error;
});
