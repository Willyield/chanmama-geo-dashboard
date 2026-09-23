(() => {
  'use strict';
  if (!document.body.classList.contains('page-home')) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const fmt = value => Number(value).toLocaleString('zh-CN');
  const pct = (n, d) => `${(n / d * 100).toFixed(1)}%`;
  const info = rule => `<span class="info total-info" tabindex="0" aria-label="指标说明">!<span>${esc(rule)}</span></span>`;
  const card = (label, value, meta, rule, tone = '') => `<article class="total-card ${tone}"><div class="total-card-head"><strong>${esc(label)}</strong>${info(rule)}</div><b>${esc(value)}</b><small>${esc(meta)}</small></article>`;
  const old = [
    ['有效首推率', '39.1%', '36 / 92 · 未知 31', '全轮次旧口径：第三方工具候选中位列第 1 的样本率。'],
    ['严格优势表达率', '24.2%', '177 / 730 · 未知 29', '全轮次旧口径：宽、严两轮都明确表达品牌优势的样本率。'],
    ['有工具提及时首推率', '24.8%', '36 / 145 · 未知 31', '全轮次旧口径：至少出现工具候选的样本中位列第 1 的比例。'],
    ['品类覆盖率', '55.0%', '99 / 180', '全轮次旧口径：回答覆盖目标品类的样本率。'],
    ['产品关系识别率', '25.0%', '2 / 8', '全轮次旧口径：正确识别蝉圈圈与蝉妈妈等产品关系的样本率。'],
    ['场景匹配率', '12.6%', '58 / 460', '全轮次旧口径：回答与目标业务场景匹配的样本率。'],
    ['对比胜率', '55.0%', '33 / 60', '全轮次旧口径：对比问题中明确判定蝉圈圈胜出的样本率。']
  ];
  function installTooltips() {
    const tip = document.createElement('div');
    tip.className = 'metric-tooltip';
    tip.hidden = true;
    document.body.append(tip);
    const close = () => { tip.hidden = true; };
    const show = target => { if (!target) return; tip.textContent = target.querySelector('span')?.textContent || ''; tip.hidden = false; const box = target.getBoundingClientRect(); const width = Math.min(300, innerWidth - 24); tip.style.width = `${width}px`; tip.style.left = `${Math.max(12, Math.min(box.left, innerWidth - width - 12))}px`; tip.style.top = `${Math.max(12, Math.min(box.bottom + 8, innerHeight - tip.offsetHeight - 12))}px`; };
    document.addEventListener('focusin', event => show(event.target.closest('.total-info')));
    document.addEventListener('focusout', close);
    document.addEventListener('pointerover', event => show(event.target.closest('.total-info')));
    document.addEventListener('pointerout', event => { if (event.target.closest('.total-info')) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  }
  function render(data, citations) {
    const groups = Object.values(data.groups);
    const sumMetric = key => groups.reduce((acc, group) => { const item = group.metrics[key]; if (!item || item.value != null) return acc; acc.n += item.numerator || 0; acc.d += item.denominator || 0; acc.u += item.unknown || 0; return acc; }, { n: 0, d: 0, u: 0 });
    const mention = sumMetric('mentionRate');
    const citation = sumMetric('citationRate');
    const error = sumMetric('errorRate');
    const explanation = sumMetric('brandExplanationAccuracy');
    const positioning = sumMetric('brandPositioningAccuracy');
    const top1 = sumMetric('top1Rate');
    const top3 = sumMetric('top3Rate');
    const advantage = sumMetric('advantageCompleteness');
    const ranks = groups.map(group => group.metrics.averageRank).filter(Boolean);
    const rankN = ranks.reduce((sum, item) => sum + item.value * item.rankedSamples, 0);
    const rankD = ranks.reduce((sum, item) => sum + item.rankedSamples, 0);
    const oldCards = old.map(item => card(item[0], item[1], item[2], item[3]));
    const mergedCards = [
      card('提及率', pct(mention.n, mention.d), `${mention.n} / ${mention.d} · 全轮次旧口径与当前聚合一致`, '回答正文提及蝉圈圈或 KOLKOC 的样本数 / 有效样本数。', 'accent'),
      card('引用来源率', pct(citation.n, citation.d), `${citation.n} / ${citation.d} · 全轮次旧口径与当前聚合一致`, '含至少一个可核验 URL 的回答数 / 引用状态已确认的回答数.'),
      card('错误信息率', pct(error.n, error.d), `${error.n} / ${error.d} · 与产品真值冲突`, '发现至少一条与 CQQ-20260525 冲突表述的回答率。', 'risk'),
      card('品牌解释准确率', pct(explanation.n, explanation.d), `当前分组 ${explanation.n} / ${explanation.d} · 旧基线 46 / 90`, '当前冻结包按问题类型聚合；旧基线仅覆盖原认知口径。'),
      card('品牌定位准确率', pct(positioning.n, positioning.d), `${positioning.n} / ${positioning.d} · 未知 ${positioning.u}`, '表达 AI 驱动、达人营销、增长系统三个必要维度且未窄化为 CRM 工具的比例。'),
      card('首推率', pct(top1.n, top1.d), `当前分组 ${top1.n} / ${top1.d} · 旧基线 36 / 180`, '明确排在第 1 的样本数 / 推荐类适用样本数；历史与当前分组口径并列保留。'),
      card('前三率', pct(top3.n, top3.d), `当前分组 ${top3.n} / ${top3.d} · 旧基线 42 / 180`, '明确排在前 3 的样本数 / 推荐类适用样本数。'),
      card('平均排名', rankD ? (rankN / rankD).toFixed(2) : '—', `${rankD} 条明确排名 · 旧基线 42 条`, '仅对明确包含蝉圈圈的推荐顺序计算算术平均排名，数值越低越靠前。'),
      card('对比优势表达完整率', pct(advantage.n, advantage.d), `${advantage.n} / ${advantage.d} 项 · 未知 ${advantage.u}`, '回答明确命中的适用优势项数 / 各题适用优势项总数；归属不清单列未知。', 'accent')
    ];
    const summary = citations.summary;
    const sourceCards = [
      card('引用记录', fmt(summary.citationRows), '同一样本内规范 URL 去重', '每行对应一个样本内去重后的引用 URL。'),
      card('唯一网址', fmt(summary.uniqueUrls), '跨回答规范 URL 去重', '当前全轮次引用按规范 URL 去重。'),
      card('来源网站', fmt(summary.uniqueDomains), '按精确主机名去重', '当前全轮次引用按最终域名去重。'),
      card('明确无引用', fmt(summary.confirmedNoCitationSamples), `${summary.confirmedNoCitationSamples} / ${data.meta.samples} 个回答`, '采集成功且确认没有引用的回答，不等于引用采集失败。'),
      card('蝉圈圈官方 URL', '54', '冻结总览指标 · 官方来源', '全轮次冻结包中的蝉圈圈官方来源 URL 数量。')
    ];
    document.getElementById('total-grid').innerHTML = [...mergedCards, ...oldCards, ...sourceCards].join('');
    document.getElementById('total-breakdown').innerHTML = Object.entries(data.groups).map(([name, group]) => `<div class="total-breakdown-row"><span>${esc(name)}</span><strong>${fmt(group.sampleCount)} 个样本</strong><small>${fmt(group.questionCount)} 道问题 · 提及 ${pct(group.metrics.mentionRate.numerator, group.metrics.mentionRate.denominator)}</small></div>`).join('');
    installTooltips();
  }
  CQQ.load(CQQ.config.summary).then(s => { render(s.data, s.citation); document.documentElement.dataset.kpiReady = 'true'; }).catch(error => { document.getElementById('total-dashboard-status').textContent = '总指标加载失败，请刷新页面。'; console.error(error); });
})();
