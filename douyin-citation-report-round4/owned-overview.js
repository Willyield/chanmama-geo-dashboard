(() => {
  const host = document.getElementById('owned-overview');
  if (!host) return;
  const labels = {round1: '第一轮', round2: '第二轮', round3: '第三轮', round4: '第四轮'};
  const num = value => value == null ? '待核验' : Number(value).toLocaleString('zh-CN');
  const pct = value => value == null ? '待核验' : `${Number(value).toFixed(2)}%`;
  function cell(row, value, cls = 'numeric') {
    const node = document.createElement('td');
    node.className = cls;
    node.textContent = value;
    row.append(node);
    return node;
  }
  function stacked(row, primary, secondary) {
    const td = cell(row, '');
    const strong = document.createElement('strong');
    strong.textContent = primary;
    const small = document.createElement('span');
    small.textContent = secondary;
    td.append(strong, small);
  }
  fetch(new URL('./overview-data.json', document.currentScript.src)).then(response => {
    if (!response.ok) throw new Error(`Overview HTTP ${response.status}`);
    return response.json();
  }).then(data => {
    const report = window.ROUND2_CITATION_REPORT || window.THREE_ROUND_CITATION_REPORT;
    // Augment only the compatibility totals; preserve all account-level unknowns and other modules.
    const comparison = report.comparison;
    for (const key of Object.keys(labels)) {
      comparison.owned_totals[key] = {...comparison.owned_totals[key], ...data.owned_totals[key]};
      comparison.denominators[key] = {...data.denominators[key]};
    }
    const body = document.getElementById('comparison-owned-total-body');
    body.replaceChildren();
    for (const [key, label] of Object.entries(labels)) {
      const item = data.owned_totals[key], den = data.denominators[key];
      const row = document.createElement('tr');
      row.dataset.round = key;
      if (key === 'round4') row.className = 'owned-current-round';
      const name = document.createElement('th');
      name.scope = 'row';
      name.textContent = label;
      row.append(name);
      stacked(row, `${num(item.citation_events)} / ${num(den.citations)}`, `占全部引用 ${pct(item.citation_share_pct)}`);
      cell(row, `${num(item.unique_articles)} 篇`);
      stacked(row, `${num(item.answers)} / ${num(den.samples)}`, '命中样本 / 有效回答');
      cell(row, pct(item.sample_rate_pct));
      cell(row, num(item.high_confidence_events));
      cell(row, num(item.medium_confidence_events));
      stacked(row, num(item.unresolved_events), '不计入自有账号引用');
      body.append(row);
    }
    const latest = document.getElementById('owned-current-audit-body');
    for (const [key, item] of Object.entries(data.current_verified_supplement)) {
      const row = document.createElement('tr');
      cell(row, labels[key], '');
      stacked(row, num(item.citation_events), `历史口径 ${num(data.owned_totals[key].citation_events)}`);
      cell(row, `${num(item.unique_articles)} 篇`);
      cell(row, `${num(item.answers)} / ${num(item.all_samples)}`);
      cell(row, `+${num(item.not_in_historical)} 个事件`, '');
      latest.append(row);
    }
    const limitations = document.getElementById('owned-overview-limitations');
    for (const text of data.limitations) {
      const li = document.createElement('li');
      li.textContent = text.replaceAll('旧规则候选', '历史口径候选').replaceAll('旧归属趋势', '历史归属趋势');
      limitations.append(li);
    }
    host.dataset.status = 'ready';
    document.getElementById('owned-overview-status').textContent = '四轮汇总 · 账号全集未完全核验';
  }).catch(error => {
    host.dataset.status = 'error';
    document.getElementById('owned-overview-status').textContent = '汇总数据加载失败';
    document.getElementById('owned-overview-error').hidden = false;
    console.error(error);
  });
})();
