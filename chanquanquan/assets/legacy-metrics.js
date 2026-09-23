(() => {
  'use strict';
  if (!document.body.classList.contains('page-citation')) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const fmt = value => Number(value).toLocaleString('zh-CN');
  const pct = value => `${Number(value).toFixed(1)}%`;
  const typeOrder = ['品牌认知型', '品牌对比型', '业务场景型'];
  const grid = document.getElementById('metric-grid');
  if (!grid) return;
  const info = rule => `<span class="info" tabindex="0" aria-label="指标说明">!<span>${esc(rule)}</span></span>`;
  const card = (label, value, meta, rule) => `<article class="legacy-card legacy-live"><div class="legacy-card-head"><strong>${esc(label)}</strong>${info(rule)}</div><div class="legacy-primary"><span>完整指标</span><b>${esc(value)}</b><small>${esc(meta)}</small></div><div class="legacy-rule">${esc(rule)}</div></article>`;
  let data;
  function render() {
    if (!data) return;
    const requested = new URLSearchParams(location.search).get('type');
    const type = typeOrder.includes(requested) ? requested : '品牌认知型';
    const group = data.groups[type];
    const summary = data.summary;
    const cards = card('蝉圈圈官方 URL', '54', '全轮次冻结总览 · 官方来源', '全轮次冻结包中的蝉圈圈官方来源 URL 数量。');
    grid.insertAdjacentHTML('beforeend', cards);
  }
  fetch('./citation-data.json', { cache: 'no-store' }).then(response => response.json()).then(value => { data = value; render(); }).catch(error => console.error(error));
  document.addEventListener('click', event => { if (event.target.closest('#type-tabs button')) setTimeout(render, 0); });
})();
