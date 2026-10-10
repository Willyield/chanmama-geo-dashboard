(() => {
  const host = document.getElementById('douyin-overview');
  if (!host) return;
  const sourceUrl = new URL('./douyin-overview-data.json', document.currentScript.src);
  const labels = {round1: '第一轮', round2: '第二轮', round3: '第三轮', round4: '第四轮'};
  const number = value => value == null ? '待核验' : Number(value).toLocaleString('zh-CN');
  const percent = value => value == null ? '待核验' : `${Number(value).toFixed(2)}%`;
  const byId = id => document.getElementById(id);
  function cell(row, text, className = 'numeric') {
    const td = document.createElement('td');
    td.textContent = text;
    td.className = className;
    row.append(td);
    return td;
  }
  function rowName(row, text) {
    const th = document.createElement('th');
    th.scope = 'row'; th.textContent = text; row.append(th);
  }
  function renderRows(data) {
    for (const [round, label] of Object.entries(labels)) {
      const item = data.totals[round], row = document.createElement('tr');
      row.dataset.round = round; rowName(row, label);
      for (const value of [number(item.citation_events),number(item.cited_works),`${number(item.answers)} / ${number(item.samples)}`,percent(item.sample_rate_pct),`${number(item.questions)} / ${number(item.questions_total)}`,number(item.all_douyin_answer_work_events),percent(item.owned_share_of_douyin_events_pct),number(item.outside_inventory_answer_work_events),number(item.all_citation_rows)]) cell(row, value);
      byId('douyin-total-body').append(row);
      const old = data.legacy_corpus_replay[round], legacy = document.createElement('tr');
      legacy.dataset.round = round; rowName(legacy, label);
      for (const key of ['citation_events','cited_works','answers','sample_rate_pct','questions']) cell(legacy, key === 'sample_rate_pct' ? percent(old[key]) : number(old[key]));
      byId('douyin-legacy-body').append(legacy);
    }
  }
  function renderAccounts(data) {
    let page = 1;
    const search = byId('douyin-account-search'), round = byId('douyin-round-filter'), size = byId('douyin-page-size');
    function render() {
      const query = search.value.trim().toLocaleLowerCase('zh-CN');
      const rows = data.accounts.filter(x => (round.value === 'all' || x.round === round.value) && (!query || `${x.account_name} ${x.account_id}`.toLocaleLowerCase('zh-CN').includes(query)));
      const count = Number(size.value), pages = Math.max(1, Math.ceil(rows.length / count));
      page = Math.min(page, pages);
      byId('douyin-account-count').textContent = `${rows.length} / 56 条记录 · 回答覆盖跨账号取并集，不直接相加`;
      byId('douyin-page-label').textContent = `${page} / ${pages}`;
      byId('douyin-page-prev').disabled = page === 1;
      byId('douyin-page-next').disabled = page === pages;
      const body = byId('douyin-account-body'); body.replaceChildren();
      if (!rows.length) {const row = document.createElement('tr'); cell(row, '没有匹配的账号', '').colSpan = 9; body.append(row);}
      for (const item of rows.slice((page - 1) * count, page * count)) {
        const row = document.createElement('tr'); row.dataset.round = item.round; row.dataset.accountId = item.account_id;
        const name = cell(row, '', ''), strong = document.createElement('strong'), id = document.createElement('small');
        strong.textContent = item.account_name; id.textContent = item.account_id; name.append(strong, id);
        cell(row, labels[item.round], '');
        for (const key of ['current_public_works','citation_events','cited_works','answers','sample_rate_pct','questions']) cell(row, key === 'sample_rate_pct' ? percent(item[key]) : number(item[key]));
        const detail = document.createElement('details'); detail.className = 'douyin-account-detail';
        const summary = document.createElement('summary'); summary.textContent = '四轮明细'; detail.append(summary);
        const note = document.createElement('p'); note.textContent = item.scope; detail.append(note);
        for (const x of data.accounts.filter(x => x.account_id === item.account_id)) {
          const p = document.createElement('p'); p.textContent = `${labels[x.round]}：${number(x.citation_events)} 事件 · ${number(x.cited_works)} 作品 · ${number(x.answers)} 回答 · ${percent(x.sample_rate_pct)} · ${number(x.questions)} 问题`; detail.append(p);
        }
        cell(row, '', '').append(detail); body.append(row);
      }
    }
    search.addEventListener('input', () => {page = 1; render();});
    for (const input of [round, size]) input.addEventListener('change', () => {page = 1; render();});
    byId('douyin-page-prev').addEventListener('click', () => {page--; render();});
    byId('douyin-page-next').addEventListener('click', () => {page++; render();});
    render();
  }
  function updateCurrentEmployeeDisplay(data) {
    const body = byId('internal-account-body');
    if (!body) return;
    // Keep all non-employee rows and frozen evidence intact; bind only employee display rows to this inventory.
    for (const row of body.children) {
      if (row.children[0]?.textContent !== '抖音员工号') continue;
      const item = data.accounts.find(x => x.round === 'round4' && x.account_name === row.children[1].textContent);
      if (!item) throw new Error('Employee account identity mismatch');
      const values = [item.current_public_works,item.cited_works,item.citation_events,item.answers,item.questions];
      values.forEach((value, i) => {row.children[i + 3].textContent = number(value);});
      row.children[8].textContent = '2026-10-09 当前公开清单匹配；未匹配不等于全网零引用';
    }
    const total = data.totals.round4;
    for (const card of byId('internal-category-cards').children) {
      if (card.querySelector('.kpi-label')?.textContent !== '抖音员工号') continue;
      card.querySelector('.kpi-value').textContent = number(total.citation_events);
      card.querySelector('.kpi-meta').textContent = `${number(total.cited_works)} 被引作品 · ${number(total.answers)} 个回答 · ${number(total.questions)} 个问题 · 当前公开清单匹配`;
    }
  }
  fetch(sourceUrl).then(response => {
    if (!response.ok) throw new Error(`Douyin overview HTTP ${response.status}`);
    return response.json();
  }).then(data => {
    if (data.accountCount !== 14 || data.accounts.length !== 56 || new Set(data.accounts.map(x => x.account_id)).size !== 14 || data.accounts.some(x => typeof x.account_id !== 'string' || !labels[x.round])) throw new Error('Douyin overview contract mismatch');
    renderRows(data); renderAccounts(data); updateCurrentEmployeeDisplay(data);
    for (const text of data.limitations) {const li = document.createElement('li'); li.textContent = text; byId('douyin-limitations').append(li);}
    host.dataset.status = 'ready';
    byId('douyin-status').textContent = `${data.accountCount} 个账号 · ${number(data.currentPublicWorks)} 个当前公开作品 · 归属并未全集完成`;
  }).catch(error => {
    host.dataset.status = 'error'; byId('douyin-status').textContent = '抖音数据加载失败'; byId('douyin-error').hidden = false;
    console.error(error);
  });
})();
