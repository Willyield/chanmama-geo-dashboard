'use strict';

const state = { data: null, view: 'overview', query: '' };
const labels = { overview: '总览', web: '网页', mobile: '手机', compare: '双端差异' };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function percent(value, denominator) { return denominator ? `${Number(value).toFixed(1)}%` : '—'; }
function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleString('zh-CN', { hour12: false });
}
function tag(value) { return `<span class="tag ${value === '是' ? 'yes' : 'no'}">${escapeHtml(value)}</span>`; }
function matches(row) {
  if (!state.query) return true;
  const haystack = `${row.question_text || ''} ${row.section_name || ''}`.toLowerCase();
  return haystack.includes(state.query.toLowerCase());
}

function metrics() {
  const data = state.data;
  const web = data.terminal_summary.web;
  const mobile = data.terminal_summary.mobile;
  const items = state.view === 'web' ? [
    ['网页覆盖', `${web.collected} / 260`, '有效样本'], ['蝉镜提及率', percent(web.mention_rate, web.collected), `${web.mention_count} 次提及`],
    ['首位推荐率', percent(web.first_rate, web.collected), `${web.first_count} 次首位`], ['引用总量', web.citation_count, '网页端普通引用'],
  ] : state.view === 'mobile' ? [
    ['手机覆盖', `${mobile.collected} / 260`, '有效样本'], ['蝉镜提及率', percent(mobile.mention_rate, mobile.collected), `${mobile.mention_count} 次提及`],
    ['首位推荐率', percent(mobile.first_rate, mobile.collected), `${mobile.first_count} 次首位`], ['引用总量', mobile.citation_count, '手机端普通引用'],
  ] : state.view === 'compare' ? [
    ['有效配对', `${data.paired_count} / 260`, '仅同题双端配对'],
    ['提及率差', data.paired_count ? `${(mobile.mention_rate - web.mention_rate).toFixed(1)}pp` : '—', '手机 - 网页'],
    ['首位率差', data.paired_count ? `${(mobile.first_rate - web.first_rate).toFixed(1)}pp` : '—', '手机 - 网页'],
    ['引用量差', data.paired_count ? mobile.citation_count - web.citation_count : '—', '手机 - 网页'],
  ] : [
    ['总覆盖', `${data.collected} / 520`, data.status], ['网页提及率', percent(web.mention_rate, web.collected), `${web.collected} 个网页样本`],
    ['手机提及率', percent(mobile.mention_rate, mobile.collected), `${mobile.collected} 个手机样本`], ['有效配对', `${data.paired_count} / 260`, '同题一对一'],
  ];
  document.querySelector('#metrics').innerHTML = items.map(([name, value, note]) => `<div class="metric"><span>${name}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
}

function sampleTable(terminal) {
  const rows = state.data.samples.filter((row) => row.target_terminal === terminal && matches(row));
  if (!rows.length) return '<div class="empty">当前筛选下没有样本</div>';
  return `<div class="table-wrap"><table><thead><tr><th>样本</th><th>主题 / 问题</th><th>蝉镜提及</th><th>首位推荐</th><th>引用</th><th>回答</th></tr></thead><tbody>${rows.map((row) => `<tr>
    <td>${escapeHtml(row.sample_id)}</td><td class="question-cell"><strong>${escapeHtml(row.section_name)}</strong><br>${escapeHtml(row.question_text)}</td>
    <td>${tag(row.mentioned_chanjing)}</td><td>${tag(row.chanjing_is_first)}<br>${escapeHtml(row.first_recommendation || '未识别')}</td>
    <td>${row.citation_count}</td><td class="answer-cell">${escapeHtml(row.answer_text)}</td></tr>`).join('')}</tbody></table></div>`;
}

function overviewTable() {
  const rows = state.data.sections.filter(matches);
  return `<div class="table-wrap"><table><thead><tr><th>主题</th><th>网页覆盖</th><th>网页提及率</th><th>手机覆盖</th><th>手机提及率</th><th>差值</th></tr></thead><tbody>${rows.map((row) => `<tr>
    <td class="question-cell">${escapeHtml(row.section_name)}</td><td>${row.web_count} / 20</td><td>${percent(row.web_mention_rate, row.web_count)}<div class="bar"><span style="width:${row.web_count ? row.web_mention_rate : 0}%"></span></div></td>
    <td>${row.mobile_count} / 20</td><td>${percent(row.mobile_mention_rate, row.mobile_count)}<div class="bar mobile"><span style="width:${row.mobile_count ? row.mobile_mention_rate : 0}%"></span></div></td>
    <td class="delta">${row.web_count && row.mobile_count ? `${(row.mobile_mention_rate - row.web_mention_rate).toFixed(1)}pp` : '—'}</td></tr>`).join('')}</tbody></table></div>`;
}

function compareTable() {
  const rows = state.data.paired.filter(matches);
  if (!rows.length) return '<div class="empty">尚无同题双端有效配对</div>';
  return `<div class="table-wrap"><table><thead><tr><th>问题</th><th>网页提及</th><th>手机提及</th><th>提及变化</th><th>网页首位</th><th>手机首位</th><th>引用差</th></tr></thead><tbody>${rows.map((row) => `<tr>
    <td class="question-cell"><strong>${escapeHtml(row.section_name)}</strong><br>${escapeHtml(row.question_text)}</td><td>${tag(row.web_mentioned)}</td><td>${tag(row.mobile_mentioned)}</td>
    <td>${row.mention_changed ? '有' : '无'}</td><td>${tag(row.web_first)}</td><td>${tag(row.mobile_first)}</td><td class="delta">${row.citation_delta > 0 ? '+' : ''}${row.citation_delta}</td></tr>`).join('')}</tbody></table></div>`;
}

function render() {
  metrics();
  document.querySelector('#view-title').textContent = labels[state.view];
  const captions = { overview: '13 个主题，网页与手机端并列比较', web: '豆包网页端，快速模式', mobile: '豆包手机端，快速模式', compare: '仅使用同一问题的有效双端配对' };
  document.querySelector('#view-caption').textContent = captions[state.view];
  document.querySelector('#content').innerHTML = state.view === 'overview' ? overviewTable() : state.view === 'compare' ? compareTable() : sampleTable(state.view);
}

async function boot() {
  const response = await fetch('./dashboard-data.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`数据加载失败: ${response.status}`);
  state.data = await response.json();
  const isFull = state.data.status === 'FULL';
  const web = state.data.terminal_summary.web;
  const mobile = state.data.terminal_summary.mobile;
  const planned = state.data.planned_slots || 520;
  const progress = Math.min(100, state.data.collected / planned * 100);
  document.querySelector('#run-meta').textContent = `260 问 · 豆包快速模式 · 生成 ${formatTime(state.data.generated_at)}`;
  document.querySelector('#coverage-value').textContent = `${state.data.collected} / 520`;
  document.querySelector('#coverage-status').textContent = isFull ? '完整数据' : '阶段性数据';
  const badge = document.querySelector('#status-badge');
  badge.textContent = isFull ? 'FULL' : 'PARTIAL';
  badge.classList.toggle('full', isFull);
  document.querySelector('#progress-fill').style.width = `${progress}%`;
  document.querySelector('#progress-percent').textContent = `${progress.toFixed(1)}%`;
  document.querySelector('#count-collected').textContent = `${state.data.collected} / ${planned}`;
  document.querySelector('#count-web').textContent = `${web.collected} / 260`;
  document.querySelector('#count-mobile').textContent = `${mobile.collected} / 260`;
  document.querySelector('#count-paired').textContent = `${state.data.paired_count} / 260`;
  document.querySelector('#time-range').textContent = `采样 ${formatTime(state.data.observed_range?.first)} → ${formatTime(state.data.observed_range?.last)}`;
  const compareTab = document.querySelector('[data-view="compare"]');
  compareTab.disabled = state.data.paired_count === 0;
  compareTab.title = compareTab.disabled ? '暂无有效双端配对' : '';
  document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => {
    state.view = button.dataset.view;
    document.querySelectorAll('.tab').forEach((item) => { item.classList.toggle('active', item === button); item.setAttribute('aria-selected', item === button ? 'true' : 'false'); });
    render();
  }));
  document.querySelector('#search').addEventListener('input', (event) => { state.query = event.target.value.trim(); render(); });
  render();
}

boot().catch((error) => { document.querySelector('#content').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; throw error; });
