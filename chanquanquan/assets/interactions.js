/* URL state and accessible explanations shared by the two frozen-data views. */
(() => {
  'use strict';
  const dataPage = location.pathname.includes('/data/');
  const queryId = dataPage ? 'sample-search' : 'citation-search';
  const filters = dataPage ? ['decision-filter'] : ['source-filter', 'quality-filter'];
  let restoring = false;
  let activeInfo = null;
  const tip = document.createElement('div');
  tip.id = 'metric-tooltip';
  tip.className = 'metric-tooltip';
  tip.role = 'tooltip';
  tip.hidden = true;
  document.body.append(tip);

  function closeTip() {
    tip.hidden = true;
    activeInfo?.removeAttribute('aria-describedby');
    activeInfo = null;
  }
  function showTip(info) {
    closeTip();
    if (!info) return;
    activeInfo = info;
    info.setAttribute('aria-describedby', tip.id);
    tip.textContent = info.querySelector('span')?.textContent || '';
    tip.hidden = false;
    const box = info.getBoundingClientRect();
    const width = Math.min(280, innerWidth - 24);
    tip.style.width = `${width}px`;
    tip.style.left = `${Math.max(12, Math.min(box.left, innerWidth - width - 12))}px`;
    tip.style.top = `${Math.max(12, Math.min(box.bottom + 8, innerHeight - tip.offsetHeight - 12))}px`;
  }
  document.addEventListener('focusin', event => showTip(event.target.closest('.info')));
  document.addEventListener('focusout', closeTip);
  document.addEventListener('pointerover', event => { if (event.target.closest('.info')) showTip(event.target.closest('.info')); });
  document.addEventListener('pointerout', event => { if (event.target.closest('.info') && !event.target.closest('.info').contains(event.relatedTarget)) closeTip(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeTip(); });
  function repositionTip() {
    if (activeInfo && document.activeElement === activeInfo) showTip(activeInfo);
    else closeTip();
  }
  addEventListener('scroll', repositionTip, true);
  addEventListener('resize', repositionTip);

  function save() {
    if (restoring) return;
    const url = new URL(location);
    url.searchParams.set('type', currentType);
    const query = document.getElementById(queryId).value;
    if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
    for (const id of filters) {
      const value = document.getElementById(id).value;
      if (value !== 'all') url.searchParams.set(id, value); else url.searchParams.delete(id);
    }
    if (page > 1) url.searchParams.set('page', page); else url.searchParams.delete('page');
    history.replaceState(null, '', url);
    document.querySelectorAll('.info').forEach(info => {
      info.setAttribute('aria-label', `${info.parentElement.childNodes[0].textContent}：${info.querySelector('span').textContent}`);
    });
  }
  function restore() {
    if (typeof DATA === 'undefined' || !DATA) return;
    restoring = true;
    const url = new URL(location);
    let type = url.searchParams.get('type');
    let target = null;
    try { target = decodeURIComponent(url.hash.slice(1)); } catch { target = null; }
    const collection = dataPage ? DATA.samples : DATA.citations;
    const idKey = dataPage ? 'sampleId' : 'citationId';
    const record = target && collection.find(row => row[idKey] === target);
    if (record) type = record.questionType;
    setType(typeOrder.includes(type) ? type : typeOrder[0]);
    document.getElementById(queryId).value = record ? '' : (url.searchParams.get('q') || '');
    for (const id of filters) {
      const control = document.getElementById(id);
      const value = record ? 'all' : (url.searchParams.get(id) || 'all');
      control.value = [...control.options].some(o => o.value === value) ? value : 'all';
    }
    const rows = dataPage ? filteredRows() : filtered();
    page = record ? Math.floor(rows.findIndex(row => row[idKey] === target) / (dataPage ? 25 : 50)) + 1 : Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
    renderRows();
    if (record) {
      const row = document.getElementById(target);
      if (dataPage) row.querySelector('details').open = true;
      row.scrollIntoView({ block: 'center' });
    }
    restoring = false;
    save();
  }
  let initialized = false;
  const observer = new MutationObserver(() => {
    if (!initialized && typeof DATA !== 'undefined' && DATA && document.querySelector('#type-tabs button')) {
      initialized = true;
      for (const id of [queryId, ...filters]) document.getElementById(id).addEventListener('input', save);
      document.addEventListener('click', event => {
        if (event.target.closest('#type-tabs button, #reset, #prev, #next')) {
          history.replaceState(null, '', location.pathname + location.search);
          save();
        }
      });
      addEventListener('popstate', restore);
      addEventListener('hashchange', restore);
      restore();
      document.documentElement.dataset.ready = 'true';
    }
  });
  observer.observe(document.getElementById(dataPage ? 'sample-body' : 'citation-body'), { childList: true });
})();
