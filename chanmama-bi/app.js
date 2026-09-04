const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const pageType = document.body.dataset.page;
let data, analysis, pageNumber = 1;

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  return response.json();
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

function setPaging(total, render) {
  const size = Number(document.getElementById('page-size').value);
  const pages = Math.max(1, Math.ceil(total / size));
  pageNumber = Math.max(1, Math.min(pageNumber, pages));
  document.getElementById('page-label').textContent = `${pageNumber} / ${pages}`;
  document.getElementById('page-prev').disabled = pageNumber === 1;
  document.getElementById('page-next').disabled = pageNumber === pages;
  document.getElementById('page-prev').onclick = () => { pageNumber -= 1; render(); };
  document.getElementById('page-next').onclick = () => { pageNumber += 1; render(); };
  return size;
}

function renderCards(cards) {
  document.getElementById('cards').innerHTML = cards.map(card => `<article class="card"><span>${esc(card.label)}</span><strong>${esc(card.value)}</strong><small>${esc(card.detail)}</small><em>${esc(card.rule)}</em></article>`).join('');
}

function attachUtility() {
  document.getElementById('print').addEventListener('click', () => window.print());
}

function startSampling() {
  renderCards(analysis.semanticCards);
  fillSelect('facet', ['全部分类', ...data.filters.categories]);
  fillSelect('date', ['全部日期', ...new Set(data.samples.map(sample => sample.date).filter(Boolean))]);
  const render = () => {
    const facet = document.getElementById('facet').value;
    const date = document.getElementById('date').value;
    const query = document.getElementById('query').value.trim().toLowerCase();
    const rows = data.samples.filter(sample =>
      (facet === '全部分类' || sample.category === facet) &&
      (date === '全部日期' || sample.date === date) &&
      (!query || `${sample.sampleId} ${sample.question} ${sample.answer}`.toLowerCase().includes(query))
    );
    const size = setPaging(rows.length, render);
    const start = (pageNumber - 1) * size;
    const shown = rows.slice(start, start + size);
    document.getElementById('row-count').textContent = `${rows.length} / ${data.samples.length} 条样本`;
    document.getElementById('row-range').textContent = rows.length ? `第 ${start + 1}-${Math.min(start + size, rows.length)} 条` : '无匹配结果';
    document.getElementById('rows').innerHTML = shown.length ? shown.map(sample => `<tr><td class="mono">${esc(sample.sampleId)}</td><td>${esc(sample.date)}<br><span class="mono">${esc(sample.category)}</span></td><td><strong>${esc(sample.question)}</strong></td><td class="answer">${esc(sample.answer.slice(0, 220))}${sample.answer.length > 220 ? '...' : ''}</td><td>${sample.collected ? '已回收' : '待回收'}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">当前筛选没有样本</td></tr>';
  };
  for (const id of ['facet', 'date', 'query', 'page-size']) document.getElementById(id).addEventListener(id === 'query' ? 'input' : 'change', () => { pageNumber = 1; render(); });
  document.getElementById('reset').addEventListener('click', () => { document.getElementById('facet').value = '全部分类'; document.getElementById('date').value = '全部日期'; document.getElementById('query').value = ''; pageNumber = 1; render(); });
  render();
}

function startCitation() {
  const citation = analysis.citation;
  renderCards([
    { label: '引用覆盖', value: citation.coverageRate, detail: `${citation.captured} / ${data.total} 样本`, rule: 'SOURCE-CAPTURE-STATE-V1' },
    { label: '原始引用明细', value: String(citation.citationRecords), detail: '保留可追溯样本身份', rule: 'frozen-citation-events' },
    { label: '样本内去重 URL', value: String(citation.sampleDeduplicatedUrls), detail: `剔除 ${citation.duplicatesRemoved} 条重复`, rule: 'within-sample-normalized-url-v1' },
    { label: '全局唯一 URL', value: String(citation.uniqueNormalizedUrls), detail: `${citation.uniqueDomains} 个来源域`, rule: 'global-normalized-url-v1' },
    { label: '正式官网引用', value: citation.formalMainSiteRate, detail: `${citation.formalMainSiteCitations} / ${data.total}；不含子站`, rule: 'exact-main-site-v1' },
    { label: '子站辅助观察', value: citation.subdomainRate, detail: `${citation.subdomainSamples} / ${data.total} 样本`, rule: 'subdomain-observation-v1' }
  ]);
  fillSelect('facet', ['全部域名', ...data.filters.domains]);
  const render = () => {
    const facet = document.getElementById('facet').value;
    const query = document.getElementById('query').value.trim().toLowerCase();
    const rows = data.citations.filter(row => (facet === '全部域名' || row.domain === facet) && (!query || `${row.sampleId} ${row.title} ${row.siteName} ${row.url}`.toLowerCase().includes(query)));
    const size = setPaging(rows.length, render);
    const start = (pageNumber - 1) * size;
    const shown = rows.slice(start, start + size);
    document.getElementById('row-count').textContent = `${rows.length} / ${data.citations.length} 条引用`;
    document.getElementById('row-range').textContent = rows.length ? `第 ${start + 1}-${Math.min(start + size, rows.length)} 条` : '无匹配结果';
    document.getElementById('rows').innerHTML = shown.length ? shown.map(row => `<tr><td class="mono">${esc(row.sampleId)}<br>${esc(row.citationId)}</td><td><strong>${esc(row.title || row.siteName || '未提供标题')}</strong><a class="url" href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">${esc(row.url)}</a></td><td>${esc(row.domain || '未知')}</td><td>${esc(row.category || '-')}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">当前筛选没有引用</td></tr>';
  };
  for (const id of ['facet', 'query', 'page-size']) document.getElementById(id).addEventListener(id === 'query' ? 'input' : 'change', () => { pageNumber = 1; render(); });
  document.getElementById('reset').addEventListener('click', () => { document.getElementById('facet').value = '全部域名'; document.getElementById('query').value = ''; pageNumber = 1; render(); });
  render();
}

async function start() {
  try {
    [data, analysis] = await Promise.all([loadJson('./dashboard-data.json'), loadJson('./analysis-v2.json')]);
    attachUtility();
    pageType === 'sampling' ? startSampling() : startCitation();
  } catch (error) {
    document.getElementById('app-error').hidden = false;
    document.getElementById('app-error').textContent = `页面数据加载失败：${error.message}`;
    console.error(error);
  }
}
start();
