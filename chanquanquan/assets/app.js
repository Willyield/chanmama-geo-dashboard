(() => {
  'use strict';
  const app = document.getElementById('app');
  const round = Number(document.body.dataset.round);
  const kind = document.body.dataset.kind;
  const base = new URL('../../', location.href);
  const params = new URLSearchParams(location.search);
  const state = { category: params.get('category') || '全部', search: '', pool: params.get('pool') || '', date: params.get('date') || '', source: '', host: params.get('domain') || '', change: '', changeKind: 'URL', page: 1, view: round && kind === 'citation' && ['sources','domains','questions','unresolved','changes'].includes(params.get('view')) ? params.get('view') : 'samples', scope: 'strict' };
  let target = params.get('sample') || '';
  let targetQuestion = params.get('question') || '';
  const cache = new Map();
  let samples = [], comparison, urls = [], pairs = [], summary, visible = [];
  const citationRounds = new Map();
  let quality, firstRoundSamples = [], citationDisplay, pairedCitationPromise;
  let semanticAPI, semanticConfig, finalMetrics, finalComparison, preparedContract;
  state.metric = 'mention_rate';
  const semanticCache = new Map();
  const semanticSamples = new Map();
  const questionMetricCache = new Map();
  async function loadQuestionMetrics(){
    if(state.view!=='metricQuestions'||!round)return;
    const key=JSON.stringify([round,state.pool,state.date]);
    if(!questionMetricCache.has(key)){
      const file=finalMetrics.rounds[`round${round}`].questionFiles[JSON.stringify([state.pool,state.date])];
      if(!file)throw new Error('该逐题筛选范围未冻结');
      questionMetricCache.set(key,json(file).catch(e=>{questionMetricCache.delete(key);throw e;}));
    }
    questionMetricCache.set(key,await questionMetricCache.get(key));
  }
  const unavailable = (n,id) => quality?.[`round${n}`]?.find(q=>q.sample_id===id);
  const qualityLabel = q => q?.answer_validity === 'invalid_no_body' ? '无实质正文' : '截断与重复正文';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = value => Number(value).toLocaleString('en-US');
  const percent = (n,d) => d ? semanticAPI.fixedRatio(n,d)+'%' : '不适用';
  const icons = () => { lucide.createIcons();document.querySelectorAll('.tooltip').forEach(t=>{const b=t.querySelector('button'),text=t.querySelector('.tooltip-text');const position=()=>{const r=b.getBoundingClientRect();const w=innerWidth<=600?210:240;text.style.left=Math.max(12,Math.min(innerWidth-w-12,r.right-w))+'px';text.style.top=Math.min(innerHeight-130,r.bottom+6)+'px';};b.setAttribute('aria-expanded','false');b.onfocus=()=>{t.classList.remove('tooltip-dismissed');position();};t.onpointerenter=()=>{t.classList.remove('tooltip-dismissed');position();};b.onclick=()=>{position();const open=t.classList.toggle('tooltip-open');t.classList.toggle('tooltip-dismissed',!open);b.setAttribute('aria-expanded',String(open));};b.onkeydown=e=>{if(e.key==='Escape'){t.classList.add('tooltip-dismissed');t.classList.remove('tooltip-open');b.setAttribute('aria-expanded','false');b.blur();}};b.onblur=()=>{t.classList.remove('tooltip-open');b.setAttribute('aria-expanded','false');};}); };
  const icon = name => `<i data-lucide="${name}"></i>`;
  const info = text => `<span class="tooltip"><button class="info" type="button" aria-label="指标说明" title="指标说明">${icon('info')}</button><span class="tooltip-text" role="tooltip">${esc(text)}</span></span>`;
  const stateLabel = value => value === 'pass' ? '有可解析引用' : value === 'fail' ? '明确无引用' : '引用状态未知';
  const safeUrl = value => { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; } };
  async function json(path) { const r = await fetch(new URL(`data/${path}`, base)); if (!r.ok) throw new Error('数据文件暂不可用'); return r.json(); }
  async function loadSemantic() {
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('assets/semantic-v2.js',base);s.onload=resolve;s.onerror=()=>reject(new Error('指标接口暂不可用'));document.head.append(s);});
    semanticAPI=window.CQQSemantic;
    semanticConfig=await json('semantic-interface.json');
    if(semanticConfig.version!=='CQQ-METRICS-2.0'||semanticConfig.status!=='final_verified')throw new Error('新版指标冻结状态无效');
    preparedContract=await json(semanticConfig.contract);
    [finalMetrics,finalComparison]=await Promise.all([json(semanticConfig.metrics),json(semanticConfig.comparison)]);
    semanticAPI.validateMetrics(finalMetrics);
    if(finalMetrics.standard_fingerprint!==semanticConfig.standardFingerprint||finalComparison.standard_fingerprint!==semanticConfig.standardFingerprint)throw new Error('两轮标准指纹不一致');
    semanticAPI.definitions.forEach(d=>{const contract=preparedContract.metrics[d[0]];if(contract){d[1]=contract.name;d[2]=contract.formula;}else d[2]=preparedContract.diagnostics.advantage_completeness;});
    if(finalComparison.paired_slots!==730||finalComparison.pairs.length!==730||finalComparison.paired_questions!==165)throw new Error('最终配对集合不完整');
    for(const pair of finalComparison.pairs)for(const n of [1,2])semanticSamples.set(pair[`r${n}_sample_id`],{answer_validity:pair.answer_validity[`round${n}`],rank:pair.rank[`round${n}`],metrics:Object.fromEntries(Object.entries(pair.metrics).map(([k,v])=>[k,v[`round${n}`]]))});
    state.metric='advantage_expression_rate';
  }
  function semanticScope(n,category=state.category,pool=state.pool,date=state.date) {
    if(!finalMetrics)return null;
    const r=finalMetrics.rounds[`round${n}`];
    const filters=[category==='全部'?'':category,pool,date];
    if(filters.every(v=>!v))return r.metrics;
    if(filters.filter(Boolean).length===1){const i=filters.findIndex(Boolean);return r.groups[['category','pool','sample_date'][i]][filters[i]]||null;}
    return r.display_scopes?.[semanticAPI.scopeKey(...filters)]||null;
  }
  function metricCount(k,m) {
    if(!m)return finalMetrics?'该组合范围未提供冻结补充指标':'有效分母、分子与最终 unknown 尚未冻结';
    if(k==='average_rank')return `排名和 ${num(m.rank_sum)} / ${num(m.ranked_samples)} 个有排名样本`;
    return `${num(m.numerator)} / ${num(m.denominator)} ${k==='advantage_completeness'?'项':k==='competition_share'?'个提及事件':'个答文'}`;
  }
  function metricVersion() {return 'CQQ-METRICS-2.0';}
  function metricValue(k,m) {return k==='average_rank'&&m?.value===null?'暂无明确排名':semanticAPI.value(k,m);}
  function metricExplanation(k,m) {
    if(k==='average_rank')return '回答未明确给出推荐名次；普通列表顺序不计排名';
    const contract=preparedContract.metrics[k];
    return (contract?.description||'完整命中的适用优势项比例')+'；'+(contract?.formula||'完整命中适用项 / 全部适用项')+'。待核验表示证据不足，不等于未审或确定失败。';
  }
  function metricNote(k,m) {
    if(!m)return finalMetrics?'采用来源已提供的完整范围汇总':'待最终来源审计';
    if(k==='average_rank')return `排名覆盖 ${m.coverage_percentage===null?'不适用':m.coverage_percentage+'%'} · 可计算 ${num(m.ranked_samples)} / 推荐适用 ${num(m.applicable_answers)}`;
    if(k==='competition_share')return '固定 13 候选的提及事件；不是市场份额或推荐份额';
    return `待核验 ${num(m.unknown)} · 已判未命中 ${num(m.fail)} · 不适用 ${num(m.not_applicable)}${k==='error_rate'?' · 越低越好':''}${k==='citation_rate'?` · 可观测覆盖 ${m.observable_coverage_percentage||semanticAPI.fixedRatio(m.denominator,m.denominator+m.unknown)||'0.0'}%`:''}`;
  }
  function metricTable(metrics,definitions=semanticAPI.definitions.slice(4)) {
    return `<div class="table-wrap"><table class="metric-list"><thead><tr><th>指标</th><th>主值</th><th>分子 / 分母或排名样本</th><th>覆盖与状态</th></tr></thead><tbody>${definitions.map(([key,label])=>{const m=metrics?.[key];return `<tr data-metric="${key}" data-metric-version="CQQ-METRICS-2.0"><td><span class="metric-label">${label}${info(metricExplanation(key,m))}</span></td><td class="num">${metricValue(key,m)}</td><td class="num">${metricCount(key,m)}</td><td>${metricNote(key,m)}</td></tr>`;}).join('')}</tbody></table></div>`;
  }
  function competitorMarkup() {
    const frozen=finalMetrics?.rounds[`round${round}`]?.competitors;if(!frozen)return '';
    const camps={target_brand:'目标品牌',third_party_tools:'第三方工具',official_platform_tool:'官方平台工具',other_tools:'其他工具'};
    const rows=frozen.slice().sort((a,b)=>b.mentions-a.mentions||a.tool.localeCompare(b.tool));
    const total=finalMetrics.rounds[`round${round}`].metrics.competition_share.denominator;
    return `<div class="filter"><label for="tool-search">搜索工具名称</label><input id="tool-search" type="search" autocomplete="off" placeholder="搜索"></div><p class="caption">已复核工具证据。全答文提及与推荐题集的候选提及事件分别统计；提及、出现次序不当作推荐排名。</p><div class="table-wrap tool-metrics-wrap"><table class="tool-metrics-table"><thead><tr><th>工具</th><th>提及回答 / 有效答文</th><th>推荐题集候选事件</th><th>候选提及份额</th><th>原答与证据</th></tr></thead><tbody>${rows.map(t=>`<tr data-tool-name="${esc(t.tool)}"><td>${esc(t.tool)}</td><td class="num">${percent(t.mentions,t.answer_denominator)}<div class="caption">${num(t.mentions)} / ${num(t.answer_denominator)}</div></td><td class="num">${num(t.candidate_events)}</td><td>${t.candidate_events?percent(t.candidate_events,total):'未计入候选事件'}<div class="caption">固定 13 候选；不是市场份额</div></td><td><details><summary>${num(t.sample_ids.length)} 条原答</summary><ul class="source-items">${t.sample_ids.map(id=>`<li><a href="${new URL(`round${round}/data/?sample=${encodeURIComponent(id)}#sample-${encodeURIComponent(id)}`,base)}">${esc(id)}</a></li>`).join('')}</ul></details></td></tr>`).join('')}</tbody></table></div>`;
  }
  function metricSelector() {
    return `<div class="filter"><label for="metric-select">查看指标</label><select id="metric-select">${semanticAPI.definitions.map(([key,label])=>`<option value="${key}" ${state.metric===key?'selected':''}>${label}</option>`).join('')}</select></div>`;
  }
  function semanticBreakdown(ss) {
    if(!finalMetrics)return '<p class="caption">分类、题池、日期与逐题指标接口已准备；完整审计冻结前不从部分标签汇总。</p>';
    const r=finalMetrics.rounds[`round${round}`],key=state.metric;
    const rows=[];
    for(const [field,label] of [['category','问题类型'],['pool','题池'],['sample_date','采样日期']])for(const name of [...new Set(ss.map(s=>s[field]))].sort()){
      const c=field==='category'?name:state.category,p=field==='pool'?name:state.pool,d=field==='sample_date'?name:state.date;
      const m=semanticScope(round,c,p,d)?.[key];
      rows.push(`<tr><td>${label}</td><td>${esc(name)}</td><td class="num">${!m&&finalMetrics?'该范围未提供':metricValue(key,m)}</td><td class="num">${metricCount(key,m)}</td><td>${metricNote(key,m)}</td></tr>`);
    }
    return `${metricSelector()}<div class="table-wrap"><table class="semantic-group-table"><thead><tr><th>分组</th><th>范围</th><th>主值</th><th>有效计数</th><th>状态</th></tr></thead><tbody>${rows.join('')||'<tr><td colspan="5" class="empty">当前范围无适用回答</td></tr>'}</tbody></table></div><p class="caption">单维度直接读取冻结分组；交叉筛选使用经独立复算的冻结范围，不从页面文字推测标签。</p>`;
  }
  const section = (id, title, note, body) => `<section class="report-section" id="${id}"><div class="section-head"><h2>${title}</h2><p>${note}</p></div>${body}</section>`;
  const card = (label, value, count, note, formula, pending = false, detail = '') => `<article class="${kind === 'data' ? 'exec-card' : 'kpi'}"><div class="exec-title">${label}${info(formula)}</div><strong class="metric${pending ? ' pending' : ''}">${value}</strong><div class="count">${count}</div><div class="readout">${note}</div>${detail}</article>`;
  function selectedSamples() { return samples.filter(s => (state.category === '全部' || s.category === state.category) && (!state.pool || s.pool === state.pool) && (!state.date || s.sample_date === state.date)); }
  function qualityMarkup(ss) {
    const rounds=round?[round]:[1,2];
    return rounds.map(n=>{
      const selected=round?ss:(n===1?firstRoundSamples:samples).filter(s=>state.category==='全部'||s.category===state.category);
      const ids=new Set(selected.map(s=>s.sample_id)),bad=quality[`round${n}`].filter(q=>ids.has(q.sample_id));
      return `<h3 class="answer-heading">第${n}轮 · ${num(selected.length)} 个回收槽位</h3><p class="caption">当前范围已证实 ${num(bad.length)} 条原答不可用；${finalMetrics?`其余 ${num(selected.length-bad.length)} 条已完成有效性与语义审计。`:`扣除后剩余 ${num(selected.length-bad.length)} 条仍须完成有效性与语义审计。实际表现指标的有效分母尚未最终冻结，`}不把异常计为未提及、失败、unknown 或 0 分。</p>${bad.length?`<div class="table-wrap"><table class="quality-table"><thead><tr><th>样本 / 原件</th><th>质量结论</th><th>核查证据</th></tr></thead><tbody>${bad.map(q=>`<tr data-quality-sample="${esc(q.sample_id)}"><td><a class="source-link num" href="${new URL(`round${n}/${kind}/?sample=${encodeURIComponent(q.sample_id)}#sample-${encodeURIComponent(q.sample_id)}`,base)}">${esc(q.sample_id)}</a><div class="caption">原答与引用保留；主对比槽位保留</div></td><td class="unavailable">原答不可用<div class="caption">${qualityLabel(q)}</div></td><td>${q.evidence.map(e=>`<blockquote>${esc(e.quote)}</blockquote>`).join('')}${q.repetition?`<p class="caption">${esc(q.repetition.token)} 连续重复 ${num(q.repetition.count)} 次至原文结束</p>`:''}<span class="caption source-link num">SHA-256 ${esc(q.answer_sha256)}</span></td></tr>`).join('')}</tbody></table></div>`:`<p class="caption">${finalMetrics?'本轮完整审计未发现此类异常。':'当前登记未发现此类异常，不代表全轮有效性审计已经完成。'}</p>`}`;
    }).join('')+`<p class="caption">无正文、截断、失败、未决不进入表现指标分母。捕获引用的槽位比例保留所有回收记录；有效答文的引用来源率${finalMetrics?'采用最终审计有效集合':'等待最终有效性冻结'}。</p><a class="button" download href="${new URL('data/answer-quality.json',base)}">${icon('download')}原答质量核查证据</a>`;
  }
  function scopedSources(ss = selectedSamples(), n = round) {
    const byId = new Map(ss.map(s => [s.sample_id, s]));
    return (citationRounds.get(n)?.urls || urls).flatMap(u => {
      const selected = u.samples.filter(id => byId.has(id));
      if (!selected.length) return [];
      return [{ ...u, platform: platformFor(u.host), samples: selected, questions: [...new Set(selected.map(id => byId.get(id).question_id))].sort(), events: selected.length,
        answer_links: selected.map(id => new URL(`round${n}/citation/?sample=${encodeURIComponent(id)}#sample-${encodeURIComponent(id)}`, base).href) }];
    });
  }
  function platformFor(host) {
    const mapping=citationDisplay.platform_mapping;
    const domain=Object.keys(mapping).sort((a,b)=>b.length-a.length).find(d=>host===d||host.endsWith('.'+d));
    return domain?mapping[domain]:'其他域名';
  }
  function platformMarkup(ss) {
    const groups=new Map();
    for(const u of scopedSources(ss)){
      if(!groups.has(u.platform))groups.set(u.platform,{platform:u.platform,events:0,urls:0,hosts:new Set(),samples:new Set()});
      const g=groups.get(u.platform);g.events+=u.events;g.urls++;g.hosts.add(u.host);u.samples.forEach(id=>g.samples.add(id));
    }
    const rows=[...groups.values()].sort((a,b)=>b.events-a.events),total=rows.reduce((n,g)=>n+g.events,0);
    return `<div class="table-wrap"><table class="platform-table"><thead><tr><th>来源平台</th><th>URL 事件 / 全部</th><th>唯一网址</th><th>域名</th><th>被引槽位</th></tr></thead><tbody>${rows.map(g=>`<tr data-platform="${esc(g.platform)}"><td>${esc(g.platform)}</td><td class="num">${num(g.events)} / ${num(total)}<div class="caption">${percent(g.events,total)}</div></td><td class="num">${num(g.urls)}</td><td class="num">${num(g.hosts.size)}</td><td class="num">${num(g.samples.size)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">当前范围没有来源</td></tr>'}</tbody></table></div><p class="caption">按来源冻结的域名映射分类，不代表内容形式、权威性或品牌账号归属。各平台被引槽位可能重叠；社媒自有账号与具体作品归属等待登录核验。</p>`;
  }
  function scopedDomains(ss = selectedSamples()) {
    const hosts = new Map();
    for (const u of scopedSources(ss)) {
      if (!hosts.has(u.host)) hosts.set(u.host, { host: u.host, source_type: u.source_type, events: 0, urls: [], samples: new Set(), questions: new Set() });
      const h = hosts.get(u.host); h.events += u.events; h.urls.push(u.url);
      u.samples.forEach(id => h.samples.add(id)); u.questions.forEach(id => h.questions.add(id));
    }
    return [...hosts.values()].map(h => ({ ...h, samples: [...h.samples], questions: [...h.questions].sort(), unique_urls: h.urls.length, answer_count: h.samples.size }))
      .sort((a,b) => b.events-a.events || a.host.localeCompare(b.host));
  }
  function sourceDeepLink(host) {
    const u = new URL(location.pathname, location.origin);
    u.searchParams.set('view', 'sources'); u.searchParams.set('domain', host);
    for (const k of ['category','pool','date']) if (state[k] && state[k] !== '全部') u.searchParams.set(k, state[k]);
    u.hash = 'records'; return u.href;
  }
  function bindSourceNavigation() {
    document.querySelectorAll('[data-host],[data-source-view]').forEach(a => a.onclick = e => {
      e.preventDefault(); state.view = a.dataset.host ? 'sources' : a.dataset.sourceView;
      state.host = a.dataset.host || ''; state.search = ''; state.page = 1;
      layout(); document.getElementById('records').scrollIntoView({ block: 'start' });
    });
  }
  function questionDeepLink(q) {
    const u = new URL(location.pathname, location.origin); u.searchParams.set('question', q);
    for (const k of ['category','pool','date']) if (state[k] && state[k] !== '全部') u.searchParams.set(k, state[k]);
    u.hash = 'records'; return u.href;
  }
  function questionSources(ss) {
    const map = new Map(), sources = scopedSources(ss);
    for (const s of ss) {
      if (!map.has(s.question_id)) map.set(s.question_id, { question_id: s.question_id, question_text: s.question_text, samples: [], cited_answers: 0, official_answers: 0, events: 0, unknown_cards: 0, urls: [] });
      const q = map.get(s.question_id); q.samples.push(s.sample_id); q.cited_answers += Number(s.citation_state === 'pass');
      q.official_answers += Number(s.official_events > 0); q.events += s.unique_url_events; q.unknown_cards += s.card_count-s.valid_url_cards;
    }
    for (const u of sources) for (const id of u.questions) map.get(id).urls.push(u.url);
    return [...map.values()].sort((a,b) => a.question_id.localeCompare(b.question_id));
  }
  function citationDelta(a,b) {
    const difference=b-a;
    return {event_change:difference,event_change_display:`${difference>0?'+':''}${num(difference)}次`,event_growth:a===0?null:semanticAPI.fixedRatio(difference,a),event_growth_display:a===0?(b>0?'新增':'无变化'):`${difference>0?'+':''}${semanticAPI.fixedRatio(difference,a)}%`};
  }
  function citationDeltaCells(a,b) {
    const d=citationDelta(a,b),cls=d.event_change>0?'delta-up':d.event_change<0?'delta-down':'delta-flat';
    return `<td class="num ${cls}">${d.event_change_display}</td><td class="num ${cls}">${d.event_growth_display}</td>`;
  }
  function sourceChanges() {
    const sets = [1,2].map(n => {
      const data = citationRounds.get(n);
      const ss = data.samples.filter(s => (state.category === '全部' || s.category === state.category) && (!state.pool || s.pool === state.pool));
      const rows = scopedSources(ss, n), map = new Map();
      for (const u of rows) {
        const key = state.changeKind === '来源类型' ? (u.source_type==='official'?'官网':'其他来源') : state.changeKind === '域名' ? u.host : u.url;
        if (!map.has(key)) map.set(key, { key, host: u.host, title: state.changeKind === '域名' ? u.host : u.title, source_type: u.source_type, events: 0, unique_urls: 0 });
        const entry = map.get(key); entry.events += u.events; entry.unique_urls++;
      }
      return map;
    });
    return [...new Set([...sets[0].keys(),...sets[1].keys()])].map(key => {
      const a = sets[0].get(key), b = sets[1].get(key);
      return { ...(b || a), change: a && b ? '保留' : b ? '新增' : '消失', r1_events: a?.events || 0, r2_events: b?.events || 0, r1_urls: a?.unique_urls || 0, r2_urls: b?.unique_urls || 0, ...citationDelta(a?.events||0,b?.events||0) };
    }).sort((a,b) => (b.r1_events+b.r2_events)-(a.r1_events+a.r2_events) || a.key.localeCompare(b.key));
  }
  function coverageMarkup(ss) {
    const groups = [];
    for (const [key,label] of [['category','问题类型'],['pool','题池'],['sample_date','采样日期']]) {
      for (const value of [...new Set(ss.map(s => s[key]))].sort()) {
        const selected = ss.filter(s => s[key] === value), cited = selected.filter(s => s.citation_state === 'pass').length;
        const known = selected.filter(s => s.citation_state !== 'unknown').length;
        groups.push(`<tr><td>${label}</td><td>${esc(value)}</td><td class="num">${num(selected.length)}</td><td class="num">${num(cited)} / ${num(known)}<div class="caption">${percent(cited,known)} · 待核验 ${num(selected.length-known)}</div></td><td class="num">${num(selected.reduce((n,s)=>n+s.unique_url_events,0))}</td><td class="num">${num(selected.filter(s=>s.official_events>0).length)} / ${num(selected.length)}</td></tr>`);
      }
    }
    return `<div class="table-wrap"><table class="coverage-table"><thead><tr><th>分组</th><th>范围</th><th>回答数</th><th>引用回答 / 已知</th><th>URL 事件</th><th>官网被引回答 / 全部</th></tr></thead><tbody>${groups.join('') || '<tr><td colspan="6" class="empty">当前范围没有回答</td></tr>'}</tbody></table></div>`;
  }
  function citationBreakdown(ss) {
    const sources = scopedSources(ss), events = ss.reduce((n,s)=>n+s.unique_url_events,0);
    const missing = ss.reduce((n,s)=>n+s.card_count-s.valid_url_cards,0);
    const typeRows = [['official','官网'],['third_party','其他来源']].map(([type,label]) => {
      const rows = sources.filter(u=>u.source_type===type), count = rows.reduce((n,u)=>n+u.events,0);
      return `<tr><td>${label}</td><td class="num">${num(count)} / ${num(events)}<div class="caption">${percent(count,events)}</div></td><td class="num">${num(rows.length)}</td><td class="num">${num(new Set(rows.flatMap(u=>u.samples)).size)}</td></tr>`;
    });
    return `<div class="table-wrap"><table><thead><tr><th>来源类型</th><th>URL 事件 / 全部</th><th>唯一网址</th><th>被引回答</th></tr></thead><tbody>${typeRows.join('')}<tr><td>未知 / 无可解析网址</td><td class="num">${num(missing)} 张原始卡<div class="caption">不进入 URL 事件分母</div></td><td>不可计算</td><td class="num">${num(ss.filter(s=>s.card_count>s.valid_url_cards).length)}</td></tr></tbody></table></div><p class="caption">未知卡保留原始标题与原答，不推算网址；官网与其他来源可在同一回答中出现，被引回答数不能直接相加。其他来源不等于自有社媒。</p>`;
  }
  function crossSummary() {
    const changes = sourceChanges();
    return `<div class="source-totals">${['新增','保留','消失'].map(label=>`<span>${label} ${state.changeKind} <b class="num">${num(changes.filter(u=>u.change===label).length)}</b></span>`).join('')}</div><p class="caption">第一轮 → 第二轮；按相同问题类型、题池的全轮已捕获来源比较，单轮日期筛选不用于跨轮。新增 / 消失表示本次采样是否捕获，不代表网站上线 / 下线或优化因果。</p>`;
  }
  function basicMetrics(ss) {
    const known = ss.filter(s => s.citation_state !== 'unknown').length;
    const passed = ss.filter(s => s.citation_state === 'pass').length;
    const events = ss.reduce((n, s) => n + s.unique_url_events, 0);
    const official = ss.reduce((n, s) => n + s.official_events, 0);
    const raw = ss.reduce((n, s) => n + s.card_count, 0), valid = ss.reduce((n, s) => n + s.valid_url_cards, 0);
    return `<div class="kpi-grid">${card('捕获引用的槽位比例', percent(passed, known), `${num(passed)} / ${num(known)} 个槽位`, `已知覆盖 ${percent(known, ss.length)} · 待核验 ${num(ss.length-known)}`, '至少一条可解析URL的槽位 / 引用捕获状态可判定槽位；保留无效答文的真实引用，不等于有效答文的引用来源率。')}${card('去重 URL 事件', num(events), `${num(valid)} 个可解析 URL 卡`, '同一回收槽位内，相同规范 URL 只计一次', '按样本ID与规范URL去重；不同槽位的同一URL分别计数。')}${card('官网引用占比', percent(official, events), `${num(official)} / ${num(events)} 个事件`, 'kolkoc.com 及其真实子域', '官网URL事件 / 全部去重URL事件；包含无效答文槽位的真实引用。')}${card('原始引用卡', num(raw), `${num(raw-valid)} 个无可解析 URL 卡`, '保留空卡，不推算缺失网址', '原始引用卡数包含空卡和无法解析URL的卡；不等同于去重URL事件。')}</div>`;
  }
  function semanticMetrics(ss,n=round||2) {
    const metrics=semanticScope(n),validCandidates=ss.filter(s=>!unavailable(n,s.sample_id)).length;
    const primary=metrics?.advantage_expression_rate?['mention_rate','advantage_expression_rate','error_rate','top1_rate']:semanticAPI.primary;
    return `<p class="caption" data-result-version>当前范围 ${num(metrics.sample_count)} 条已复核有效答文。待核验保留适用主分母；异常原答不计入表现指标。</p><div class="executive-grid">${primary.map(key=>semanticAPI.definitions.find(d=>d[0]===key)).map(([key,label,formula])=>{const m=metrics[key];return card(label,metricValue(key,m),'确认命中 '+metricCount(key,m),metricNote(key,m),metricExplanation(key,m));}).join('')}</div>${metricTable(metrics,semanticAPI.definitions.filter(d=>!primary.includes(d[0])))}`;
  }
  function semanticComparison() {
    if(!finalMetrics)return '';
    const all=state.category==='全部',a=semanticScope(1,state.category,'',''),b=semanticScope(2,state.category,'','');
    return section('metric-comparison','指标变化','第一轮 → 第二轮；异常原答保留配对，不进入表现分母',`<div class="table-wrap"><table class="metric-comparison"><thead><tr><th>指标</th><th>第一轮</th><th>第二轮</th><th>两轮比例差${info('第二轮比例减第一轮比例，不是相对增长率；平均排名显示名次差')}</th><th>计数与状态</th></tr></thead><tbody>${semanticAPI.definitions.map(([key,label,formula])=>{
      const left=a?.[key],right=b?.[key],frozen=all?finalComparison.changes[key]:null;
      const delta=frozen?frozen.difference:semanticAPI.difference(key,left,right);
      return `<tr data-comparison-metric="${key}"><td>${label}${info(formula)}</td><td class="num">${metricValue(key,left)}</td><td class="num">${metricValue(key,right)}</td><td class="num">${delta===null?'不适用':`${Number(delta)>0?'+':''}${Number(delta).toFixed(key==='average_rank'?2:1)}${key==='average_rank'?'':'%'}`}</td><td>第一轮 ${metricCount(key,left)} · ${metricNote(key,left)}<br>第二轮 ${metricCount(key,right)} · ${metricNote(key,right)}</td></tr>`;
    }).join('')}</tbody></table></div>${metricSelector()}`);
  }
  function comparisonCards() {
    const c = comparison.comparisons[state.category];
    return `<div class="kpi-grid">${[['引用率','citation_rate','citation_delta_pp','citation_answers','citation_known'],['官网回答覆盖率','official_answer_rate','official_answer_rate_delta_pp','official_answers','samples'],['官网引用占比','official_event_share','official_event_share_delta_pp','official_events','sample_url_events'],['去重 URL 事件','sample_url_events',null,null,null]].map(([label,key,delta,n,d]) => `<article class="kpi"><div class="exec-title">${label}${info(key==='citation_rate' ? '只比较语义等价配对且双方引用可观测的槽位；unknown不进入引用率分母。' : key==='official_answer_rate' ? '至少一条官网引用的回答 / 所选配对回答。' : key==='official_event_share' ? '官网URL事件 / 全部样本内去重URL事件。' : '样本内规范URL去重后计数。')}</div><div class="compare-values"><span class="r1">${key==='sample_url_events'?num(c.r1[key]):c.r1[key]+'%'}</span><span aria-label="到">→</span><span class="r2">${key==='sample_url_events'?num(c.r2[key]):c.r2[key]+'%'}</span></div><div class="count">${n ? `第一轮 ${num(c.r1[n])}/${num(c.r1[d])}<br>第二轮 ${num(c.r2[n])}/${num(c.r2[d])}` : '第一轮 / 第二轮'}</div><div class="readout">${delta ? `两轮比例差 ${Number(c[delta])>0?'+':''}${c[delta]}%${info('第二轮比例减第一轮比例，不是相对增长率')}` : `${num(c.pairs)} 个语义等价配对槽位`}</div></article>`).join('')}</div>`;
  }
  function domainMarkup(ss) {
    if(!round){
      const c=comparison.comparisons[state.category];
      const hosts=[...new Set([...Object.keys(c.r1.hosts),...Object.keys(c.r2.hosts)])].sort((a,b)=>(c.r1.hosts[b]||0)+(c.r2.hosts[b]||0)-(c.r1.hosts[a]||0)-(c.r2.hosts[a]||0)).slice(0,10);
      const table=(cls,label,rows)=>`<h3 class="answer-heading">${label} · 语义等价配对</h3><div class="table-wrap"><table class="${cls}"><thead><tr><th>来源</th><th>第一轮事件</th><th>第二轮事件</th><th>增减次数${info('第二轮引用事件次数减第一轮；不是唯一网址数')}</th><th>增幅${info('增减次数 / 第一轮次数；首轮为零时显示新增或无变化')}</th></tr></thead><tbody>${rows.map(([label,a,b])=>`<tr data-citation-source="${esc(label)}"><td class="${cls==='citation-domain-compare'?'domain-text':''}">${esc(label)}</td><td class="num">${num(a)}</td><td class="num">${num(b)}</td>${citationDeltaCells(a,b)}</tr>`).join('')}</tbody></table></div>`;
      return table('citation-domain-compare','主要引用域名',hosts.map(h=>[h,c.r1.hosts[h]||0,c.r2.hosts[h]||0]))+table('citation-type-compare','来源类型',[['官网',c.r1.official_events,c.r2.official_events],['其他来源',c.r1.sample_url_events-c.r1.official_events,c.r2.sample_url_events-c.r2.official_events]]);
    }
    const hosts=scopedDomains(ss),top=hosts.slice(0,8),max=top[0]?.events||1,uniqueUrls=hosts.reduce((n,h)=>n+h.unique_urls,0);
    return `<h3 class="answer-heading">主要引用域名 · 前 8 概览</h3><div class="bar-list">${top.map(h=>`<div class="bar-row"><a class="source-link" data-host="${esc(h.host)}" href="${esc(sourceDeepLink(h.host))}">${esc(h.host)}</a><div class="bar-track"><div class="bar-fill" style="width:${h.events/max*100}%"></div></div><span class="bar-value">${num(h.events)}</span></div>`).join('')||'<p class="caption">当前范围没有引用事件</p>'}</div><div class="source-totals"><a href="#records" data-source-view="domains">全部域名 <span class="num">${num(hosts.length)}</span></a><a href="#records" data-source-view="sources">全部具体网址 <span class="num">${num(uniqueUrls)}</span></a></div><p class="caption">当前范围内的样本内去重 URL 事件；不表示内容质量或支持程度。</p>`;
  }
  function categoryControls() { return `<div class="segmented" role="group" aria-label="问题类型">${['全部','品牌认知型','品牌对比型','业务场景型'].map(c=>`<button type="button" data-category="${c}" aria-pressed="${state.category===c}">${c==='全部'?c:c.replace('型','')}</button>`).join('')}</div>`; }
  const select = (id, label, opts) => `<div class="filter"><label for="${id}">${label}</label><select id="${id}"><option value="">全部</option>${opts.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>`;
  function filters() { return `<div class="filters"><div class="filter grow"><label for="search">${state.view==='domains'?'搜索域名、问题 ID':state.view==='sources'?'搜索网址、标题、问题、ID':state.view==='changes'?'搜索域名、网址、标题':'搜索问题、ID'}</label><input id="search" type="search" autocomplete="off" placeholder="搜索" value="${esc(state.search)}"></div>${round ? select('pool','题池',[...new Set(samples.map(s=>s.pool))]) + (state.view==='changes'?'':select('date','采样日期',[...new Set(samples.map(s=>s.sample_date))].sort())) : select('scope','配对范围',['语义等价配对','文字删减36'])}${['sources','domains','changes'].includes(state.view)?select('source','来源归属',['官网','第三方']):''}${state.view==='sources'?select('host','引用域名',[...new Set([...scopedDomains().map(h=>h.host),...(state.host?[state.host]:[])])].sort()):''}${state.view==='changes'?select('change','跨轮状态',['新增','保留','消失'])+`<div class="filter"><label for="changeKind">比较单位</label><select id="changeKind"><option>URL</option><option>域名</option><option>来源类型</option></select></div>`:''}<button class="icon-button" id="reset" title="重置筛选" aria-label="重置筛选">${icon('rotate-ccw')}</button><button class="icon-button" id="export" title="下载当前筛选结果" aria-label="下载当前筛选结果">${icon('download')}</button></div>`; }
  function method(){return `<a class="button" download href="${new URL('data/semantic-v2/display-contract.json',base)}">${icon('download')}完整指标说明与规则</a>`;}

  function downloadLinks() {
    const entries = round ? [[`round${round}-samples.csv`,'回答索引'],[`round${round}-sources.csv`,'原始引用卡']] : [['comparison-pairs.csv','两轮逐条配对'],['wording-audit.csv','文字删减等价审计']];
    if(kind==='citation')entries.push(['citation-all-domains.csv','两轮全部域名'],['citation-all-urls.csv','两轮全部网址与引用映射'],['citation-questions.csv','165 题引用统计']);
    const v2=round?[[`round${round}-answer-index.json`,'本版逐答指标索引'],[`round${round}-labels.json`,'本版全部判定与原句证据']]:[['final-comparison.json','本版730组指标对比']];
    v2.push(['final-metrics.json','本版两轮全部指标'],['display-contract.json','本版指标解释'],['migration-differences.json','旧版至本版口径修订追溯']);
    return `<div class="download-list">${v2.map(([file,label])=>`<a class="button" download href="${new URL('data/semantic-v2/'+file,base)}">${icon('download')}${label}</a>`).join('')}${entries.map(([file,label])=>`<a class="button" download href="${new URL('downloads/'+file,base)}">${icon('download')}${label==='回答索引'?'原始回收索引（历史字段）':label}</a>`).join('')}</div>`;
  }
  function layout() {
    const pending = finalMetrics?'':`<div class="notice pending-band"><strong>语义指标待完成证据审计</strong>采样已完成；品牌提及、解释、定位、优势表达、首推、前三及错误信息尚未形成全轮最终标签。不显示临时关键词结果或 0 分。</div>`;
    const ss = selectedSamples();
    const notice = !round ? `<div class="notice"><strong>描述性比较，不归因效果</strong>主分析 ${num(comparison.comparisons[state.category].pairs)} 个语义等价槽位。6 题 36 槽位虽有文字删减，已经审定等价并纳入主对比；${finalMetrics?'有效答文语义指标采用最终审计数据。':'回答语义指标仍待审。'}</div>` : '';
    const real = (round ? basicMetrics(ss) : comparisonCards()) + (kind==='citation'?`<div id="domains">${domainMarkup(ss)}</div>`:'');
    const nav = kind==='citation' ? `<aside class="side-nav"><div class="nav-label">引用源研究</div><nav aria-label="页内目录"><a href="#overview">01 / 概览</a>${round?'<a href="#distribution">02 / 引用分布</a><a href="#quality">03 / 未知与归属</a>':''}<a href="#records">${round?'04':'02'} / 逐条证据</a><a href="#downloads">${round?'05':'03'} / 下载与证据</a></nav></aside>` : '';
    const strictIds = new Set(pairs.filter(p=>p.included&&p.observable).map(p=>p.r2_sample_id));
    const semanticBody=round?semanticMetrics(ss):'<h3 class="answer-heading">第一轮 · 独立有效性与指标审计</h3>'+semanticMetrics(firstRoundSamples.filter(s=>state.category==='全部'||s.category===state.category),1)+'<h3 class="answer-heading">第二轮 · 独立有效性与指标审计</h3>'+semanticMetrics(samples.filter(s=>strictIds.has(s.sample_id)&&(state.category==='全部'||s.category===state.category)),2);
    const semantic = kind==='data' ? section('semantic',round?'品牌指标':'两轮品牌指标',`${round ? num(ss.length)+' 个回收槽位' : '730 个主配对槽位保留'} · ${finalMetrics?'已复核结果':'有效分母与主值等待审计冻结'}`,semanticBody) + (!round?semanticComparison():'') : '';
    const modes=kind==='citation'?[['samples','回答引用'],['domains','全部域名'],['sources','逐网址引用'],['questions','引用问题'],['unresolved','未知网址卡'],['changes','跨轮来源']]:[['samples','逐条回答'],['metricQuestions','逐题指标']];
    const viewModes = round ? `<div class="segmented source-views" role="group" aria-label="证据视图">${modes.map(([v,label])=>`<button data-view="${v}" aria-pressed="${state.view===v}">${label}</button>`).join('')}</div>` : '';
    const breakdown = round ? section('distribution',kind==='citation'?'引用分布':'类型、题池与日期分布','引用事实按当前范围计算；与有效答文表现指标分开',coverageMarkup(ss)) + (kind==='citation'?section('quality','来源归属与未知卡','来源类型与内容质量分开；社媒所有权尚未核验',citationBreakdown(ss)):'') : '';
    const content = categoryControls() + notice + (kind==='data'?pending:'') + section('overview',round?'采样与引用概览':'语义等价配对引用对比',round?`${num(ss.length)} 个回答 · 引用状态独立于语义审计`:'第一轮 → 第二轮 · 比例差基于未舍入数值', real + (round&&kind==='citation'?`<p class="caption">全轮唯一 URL ${num(summary.unique_urls)}；当前卡片随类型、题池、日期筛选。内容支持与可访问性未核验。</p>`:'')) + semantic + breakdown + section('records',!round?'配对原回答':kind==='citation'?'引用证据':'原回答与复核',!round?'730条主配对，文字删减等价审计子集可查':'搜索与展开原答；语义待审不会被标为命中或缺失',viewModes + filters() + '<div id="table-area"></div>') + section('downloads','下载与证据','原始回答保留；导出仅包含当前已知事实，不含费用字段',downloadLinks()+method());
    app.innerHTML = kind==='citation' ? `<div class="layout">${nav}<div class="report-body">${content}</div></div>` : content;
    app.setAttribute('aria-busy','false');
    if(round&&kind==='data'){document.getElementById('distribution').after(document.createRange().createContextualFragment(section('semantic-groups','分类、题池与日期指标','当前筛选范围内的本版指标',semanticBreakdown(ss))));document.getElementById('semantic-groups').after(document.createRange().createContextualFragment(section('tool-metrics','工具与竞品明细','全轮已复核工具提及 · 本版事件份额与原答证据',competitorMarkup())));}
    const qualitySection=document.createElement('section');qualitySection.id='answer-quality';qualitySection.className='report-section';qualitySection.innerHTML='<div class="section-head"><h2>原答质量核查</h2><p>回收槽位不等于完整有效答文；原答、引用和主对比行不删除</p></div>'+qualityMarkup(ss);
    document.getElementById('overview').after(qualitySection);
    if(round&&kind==='citation'){
      const platforms=document.createElement('section');platforms.className='report-section';platforms.id='platforms';platforms.innerHTML='<div class="section-head"><h2>来源平台分布</h2><p>按已捕获网址归类；不是自有社媒引用率</p></div>'+platformMarkup(ss);document.getElementById('quality').after(platforms);
      const qualityCaption=document.createElement('p');qualityCaption.className='caption';qualityCaption.dataset.performanceCitation='pending';qualityCaption.textContent='有效答文引用来源率：待最终有效答文集合冻结。本页的捕获槽位比例不是该表现指标。';document.getElementById('overview').append(qualityCaption);
      if(finalMetrics){const m=semanticScope(round)?.citation_rate;qualityCaption.dataset.performanceCitation='final';qualityCaption.textContent=`有效答文引用来源率：${semanticAPI.value('citation_rate',m)} · ${metricCount('citation_rate',m)} · ${metricNote('citation_rate',m)}`;}
    }
    const overviewNote=document.querySelector('#overview .section-head p');if(round)overviewNote.textContent=`${num(ss.length)} 个回收槽位 · 引用捕获独立于答文有效性`;
    if(!round){const titles=document.querySelectorAll('#overview .exec-title');titles[0].firstChild.nodeValue='捕获引用的槽位比例';titles[1].firstChild.nodeValue='官网引用槽位覆盖率';}
    document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{state.category=b.dataset.category;state.page=1;layout();});
    document.querySelectorAll('[data-view]').forEach(b=>b.onclick=async()=>{state.view=b.dataset.view;state.host='';state.page=1;try{await loadQuestionMetrics();layout();}catch(e){document.getElementById('table-area').textContent=e.message;}});
    bindMetricSelector();
    const toolSearch=document.getElementById('tool-search');if(toolSearch)toolSearch.oninput=()=>{const q=toolSearch.value.trim().toLowerCase();document.querySelectorAll('[data-tool-name]').forEach(row=>row.hidden=!row.dataset.toolName.toLowerCase().includes(q));};
    for (const key of ['pool','date','source','host','change','changeKind']) {const el=document.getElementById(key);if(el){el.value=state[key];el.onchange=async()=>{state[key]=el.value;state.page=1;try{await loadQuestionMetrics();round ? updateMetricsAndTable() : renderTable();}catch(e){document.getElementById('table-area').textContent=e.message;}};}}
    const scope=document.getElementById('scope');if(scope){scope.value=state.scope==='strict'?'语义等价配对':'文字删减36';scope.onchange=()=>{state.scope=scope.value==='语义等价配对'?'strict':'excluded';state.page=1;renderTable();};}
    document.getElementById('search').oninput=e=>{state.search=e.target.value;state.page=1;renderTable();};
    document.getElementById('reset').onclick=async()=>{Object.assign(state,{category:'全部',search:'',pool:'',date:'',source:'',host:'',change:'',changeKind:'URL',page:1,scope:'strict'});target='';targetQuestion='';history.replaceState(null,'',location.pathname);try{await loadQuestionMetrics();layout();}catch(e){document.getElementById('table-area').textContent=e.message;}};
    document.getElementById('export').onclick=exportCurrent;
    renderTable();icons();
  }
  function bindMetricSelector(){const el=document.getElementById('metric-select');if(el)el.onchange=()=>{state.metric=el.value;if(round){document.getElementById('semantic-groups').innerHTML='<div class="section-head"><h2>分类、题池与日期指标</h2><p>当前筛选范围</p></div>'+semanticBreakdown(selectedSamples());bindMetricSelector();}renderTable();icons();};}
  function updateMetricsAndTable() {
    const ss=selectedSamples(); document.querySelector('#overview .kpi-grid').outerHTML=basicMetrics(ss);
    document.getElementById('answer-quality').innerHTML='<div class="section-head"><h2>原答质量核查</h2><p>回收槽位不等于完整有效答文；原答、引用和主对比行不删除</p></div>'+qualityMarkup(ss);
    document.querySelector('#distribution .table-wrap').outerHTML=coverageMarkup(ss);
    if(kind==='citation') {
      document.getElementById('domains').innerHTML=domainMarkup(ss);
      document.getElementById('quality').innerHTML='<div class="section-head"><h2>来源归属与未知卡</h2><p>来源类型与内容质量分开；社媒所有权尚未核验</p></div>'+citationBreakdown(ss);
      document.getElementById('platforms').innerHTML='<div class="section-head"><h2>来源平台分布</h2><p>按已捕获网址归类；不是自有社媒引用率</p></div>'+platformMarkup(ss);
      const host=document.getElementById('host');if(host){host.innerHTML='<option value="">全部</option>'+[...new Set([...scopedDomains().map(h=>h.host),...(state.host?[state.host]:[])])].sort().map(h=>`<option value="${esc(h)}">${esc(h)}</option>`).join('');host.value=state.host;}
    }
    if(kind==='data'){document.getElementById('semantic').innerHTML=`<div class="section-head"><h2>品牌指标</h2><p>${num(ss.length)} 个回答 · ${finalMetrics?'已复核结果':'主值等待审计冻结'}</p></div>`+semanticMetrics(ss);document.getElementById('semantic-groups').innerHTML='<div class="section-head"><h2>分类、题池与日期指标</h2><p>当前筛选范围</p></div>'+semanticBreakdown(ss);bindMetricSelector();}
    if(kind==='citation'&&finalMetrics){const m=semanticScope(round)?.citation_rate;document.querySelector('[data-performance-citation]').textContent=`有效答文引用来源率：${semanticAPI.value('citation_rate',m)} · ${metricCount('citation_rate',m)} · ${metricNote('citation_rate',m)}`;}
    renderTable();icons();
  }
  function rowsForTable() {
    const query=state.search.trim().toLowerCase();
    const match=s=>!query||[s.question_id,s.question_text,s.sample_id,s.r1_sample_id,s.r2_sample_id,s.r1_question,s.r2_question,s.title,s.url,s.key,s.host,s.questions?.join(' '),s.samples?.join(' ')].some(x=>String(x||'').toLowerCase().includes(query));
    if (!round) return pairs.filter(p=>(state.category==='全部'||p.category===state.category)&&p.included&&p.observable&&(state.scope==='strict'||!p.strict)&&match(p)&&( !targetQuestion||p.question_id===targetQuestion)).map(p=>({...p,r1_answer_validity:semanticSamples.get(p.r1_sample_id)?.answer_validity||unavailable(1,p.r1_sample_id)?.answer_validity||'not_flagged_invalid_pending_full_audit',r2_answer_validity:semanticSamples.get(p.r2_sample_id)?.answer_validity||unavailable(2,p.r2_sample_id)?.answer_validity||'not_flagged_invalid_pending_full_audit',r1_audited_metrics:semanticSamples.get(p.r1_sample_id)?.metrics||null,r2_audited_metrics:semanticSamples.get(p.r2_sample_id)?.metrics||null,r1_audited_rank:semanticSamples.get(p.r1_sample_id)?.rank??null,r2_audited_rank:semanticSamples.get(p.r2_sample_id)?.rank??null}));
    const ss=selectedSamples();
    if(state.view==='metricQuestions'){
      const report=finalMetrics?.rounds[`round${round}`];
      const frozen=questionMetricCache.get(JSON.stringify([round,state.pool,state.date]));
      const rows=new Map();for(const s of ss)if(!rows.has(s.question_id))rows.set(s.question_id,{question_id:s.question_id,question_text:s.question_text,category:s.category,sample_count:0,metrics:frozen?.[s.question_id]||null});
      for(const s of ss)rows.get(s.question_id).sample_count++;
      return [...rows.values()].filter(match).sort((a,b)=>a.question_id.localeCompare(b.question_id));
    }
    if(state.view==='sources') {const matchingIds=new Set(ss.filter(match).map(s=>s.sample_id));return scopedSources(ss).filter(u=>(!state.host||u.host===state.host)&&(!state.source||u.source_type===(state.source==='官网'?'official':'third_party'))&&(match(u)||u.samples.some(id=>matchingIds.has(id))));}
    if(state.view==='domains') return scopedDomains(ss).filter(h=>(!state.source||h.source_type===(state.source==='官网'?'official':'third_party'))&&match(h));
    if(state.view==='questions') return questionSources(ss).filter(match);
    if(state.view==='unresolved') return ss.filter(s=>s.card_count>s.valid_url_cards&&match(s)).map(s=>({...s,unknown_cards:s.card_count-s.valid_url_cards}));
    if(state.view==='changes') return sourceChanges().filter(u=>(!state.change||u.change===state.change)&&(!state.source||u.source_type===(state.source==='官网'?'official':'third_party'))&&match(u));
    return ss.filter(s=>match(s)&&(!target||s.sample_id===target)&&(!targetQuestion||s.question_id===targetQuestion)).map(s=>({...s,answer_validity:semanticSamples.get(s.sample_id)?.answer_validity||unavailable(round,s.sample_id)?.answer_validity||'not_flagged_invalid_pending_full_audit',semantic_audit_status:unavailable(round,s.sample_id)?.semantic_audit_status||(finalMetrics?'final_verified':'pending_full_evidence_audit'),audited_metrics:semanticSamples.get(s.sample_id)?.metrics||null,audited_rank:semanticSamples.get(s.sample_id)?.rank??null}));
  }
  function renderTable() {
    visible=rowsForTable(); const pages=Math.max(1,Math.ceil(visible.length/25));state.page=Math.min(state.page,pages);
    const page=visible.slice((state.page-1)*25,state.page*25);
    let heads,body,cls;
    if(!round){cls='compare-table';heads=['问题与配对','第一轮','第二轮','差异 / 状态','原答'];body=page.map((p,i)=>`<tr><td class="question-cell"><span class="question-id">${esc(p.question_id)} · 遍次 ${p.repeat_index}</span><span class="question-text">${esc(p.r2_question)}</span>${!p.strict?`<p class="caption">第一轮题文：${esc(p.r1_question)}</p>`:''}<div class="caption">${esc(p.category)}</div></td><td><span class="state ${p.r1_citation_state}">${stateLabel(p.r1_citation_state)}</span><div class="num">${num(p.r1_events)} URL 事件</div><span class="caption">${p.r1_date}</span></td><td><span class="state ${p.r2_citation_state}">${stateLabel(p.r2_citation_state)}</span><div class="num">${num(p.r2_events)} URL 事件</div><span class="caption">${p.r2_date}</span></td><td>${p.strict?'语义等价配对':'文字删减已审定等价'}<div class="state">语义待审</div></td><td><button class="icon-button" data-pair="${i}" aria-label="查看两轮原回答" title="查看两轮原回答" aria-expanded="false">${icon('chevron-down')}</button></td></tr>`).join('');}
    else if(state.view==='metricQuestions'){cls='question-metric-table';heads=['问题 / 原答','提及率','错误信息率','优势表达率','全部指标'];body=page.map(q=>{const m=q.metrics;return `<tr><td class="question-cell"><a href="${esc(questionDeepLink(q.question_id))}">${esc(q.question_id)}</a><span class="question-text">${esc(q.question_text)}</span><div class="caption">当前 ${num(q.sample_count)} 个槽位 · ${m?num(m.sample_count)+' 条有效答文':'有效性待冻结'}</div></td><td class="num">${semanticAPI.value('mention_rate',m?.mention_rate)}<div class="caption">${metricCount('mention_rate',m?.mention_rate)}</div></td><td class="num">${semanticAPI.value('error_rate',m?.error_rate)}<div class="caption">${metricNote('error_rate',m?.error_rate)}</div></td><td class="num">${semanticAPI.value('advantage_expression_rate',m?.advantage_expression_rate)}<div class="caption">${metricCount('advantage_expression_rate',m?.advantage_expression_rate)}<br>${metricNote('advantage_expression_rate',m?.advantage_expression_rate)}<br>首推 ${semanticAPI.value('top1_rate',m?.top1_rate)} · 前三 ${semanticAPI.value('top3_rate',m?.top3_rate)}</div></td><td><details class="question-metrics"><summary>详细指标</summary>${metricTable(m,semanticAPI.definitions)}</details></td></tr>`;}).join('');}
    else if(state.view==='domains'){cls='domain-table';heads=['域名 / 具体网址','引用事件','唯一网址','被引回答','命中问题'];body=page.map(h=>`<tr><td><a class="source-link num" data-host="${esc(h.host)}" href="${esc(sourceDeepLink(h.host))}">${esc(h.host)}</a><div class="caption">${h.source_type==='official'?'官网':'第三方'}</div></td><td class="num">${num(h.events)}</td><td class="num">${num(h.unique_urls)}</td><td class="num">${num(h.answer_count)}</td><td class="num">${num(h.questions.length)}</td></tr>`).join('');}
    else if(state.view==='questions'){cls='question-table';heads=['问题 / 原回答','引用回答 / 全部','官网引用回答','URL 事件 / 唯一网址','未知网址卡'];body=page.map(q=>`<tr><td class="question-cell"><a class="question-id" href="${esc(questionDeepLink(q.question_id))}">${esc(q.question_id)}</a><span class="question-text">${esc(q.question_text)}</span></td><td class="num">${num(q.cited_answers)} / ${num(q.samples.length)}</td><td class="num">${num(q.official_answers)}</td><td class="num">${num(q.events)} / ${num(q.urls.length)}</td><td class="num">${num(q.unknown_cards)}</td></tr>`).join('');}
    else if(state.view==='unresolved'){cls='sample-table';heads=['问题','日期 / 遍次','未知网址卡','已知 URL 事件','原始卡与原答'];body=page.map(s=>`<tr><td class="question-cell"><span class="question-id">${esc(s.question_id)} · ${esc(s.sample_id)}</span><span class="question-text">${esc(s.question_text)}</span></td><td class="num">${esc(s.sample_date)}<div class="caption">遍次 ${num(s.repeat_index)}</div></td><td class="num">${num(s.unknown_cards)}</td><td class="num">${num(s.unique_url_events)}</td><td><button class="icon-button" data-sample="${esc(s.sample_id)}" aria-label="查看原回答" title="查看原回答" aria-expanded="false">${icon('chevron-down')}</button></td></tr>`).join('');}
    else if(state.view==='changes'){cls='change-table';heads=['来源','跨轮状态','第一轮事件','第二轮事件','增减次数'+info('第二轮事件次数减第一轮；不是唯一网址数'),'增幅'+info('增减次数 / 第一轮次数；首轮为零显示新增或无变化'),'具体网址'];body=page.map(u=>`<tr><td>${state.changeKind==='URL'?`<a class="source-link" href="${esc(safeUrl(u.key))}" target="_blank" rel="noopener noreferrer">${esc(u.title||u.key)}</a><span class="host-label">${esc(u.key)}</span>`:`<span class="source-link num">${esc(u.key)}</span>`}<div class="caption">${u.source_type==='official'?'官网':'第三方'}</div></td><td>${esc(u.change)}</td><td class="num">${num(u.r1_events)}</td><td class="num">${num(u.r2_events)}</td>${citationDeltaCells(u.r1_events,u.r2_events)}<td>${[1,2].map(n=>u[`r${n}_events`]?`<a href="${new URL(`round${n}/citation/?view=sources&domain=${encodeURIComponent(state.changeKind==='来源类型'?'':u.host)}${state.changeKind==='来源类型'?'&source='+encodeURIComponent(u.source_type==='official'?'官网':'第三方'):''}${state.category!=='全部'?'&category='+encodeURIComponent(state.category):''}${state.pool?'&pool='+encodeURIComponent(state.pool):''}#records`,base)}">第${n}轮${state.changeKind==='域名'?` ${num(u[`r${n}_urls`])} 个网址`:'来源明细'}</a>`:'').join('<br>')}</td></tr>`).join('');}
    else if(state.view==='sources'){cls='source-table';heads=['来源页面','归属','引用事件 / 回答','命中问题 / 原答','内容状态'];body=page.map(u=>`<tr><td><a class="source-link" href="${esc(safeUrl(u.url))}" target="_blank" rel="noopener noreferrer">${esc(u.title||u.url)}</a><span class="host-label">${esc(u.host)}</span><a class="source-link caption" href="${esc(safeUrl(u.url))}" target="_blank" rel="noopener noreferrer">${esc(u.url)}</a></td><td>${u.source_type==='official'?'官网':'第三方'}</td><td class="num">${num(u.events)}</td><td><details class="source-evidence"><summary>${num(u.questions.length)} 个问题 · ${num(u.samples.length)} 个回答</summary><div class="source-questions">${u.questions.map(q=>`<a data-question="${esc(q)}" href="${esc(questionDeepLink(q))}">${esc(q)}</a>`).join(' · ')}</div><ul class="source-items">${u.samples.map((id,i)=>`<li><a data-source-answer href="${esc(u.answer_links[i])}">${esc(id)}</a></li>`).join('')}</ul></details></td><td class="caption">内容支持待核验<br>可访问性待核验</td></tr>`).join('');}
    else{cls='sample-table';heads=['问题','日期 / 遍次','引用','语义状态','原答'];body=page.map(s=>`<tr id="sample-${esc(s.sample_id)}" class="${s.sample_id===target?'row-target':''}"><td class="question-cell"><span class="question-id">${esc(s.question_id)} · ${esc(s.pool)}</span><span class="question-text">${esc(s.question_text)}</span><div class="caption">${esc(s.category)}</div></td><td><span class="num">${s.sample_date}</span><div class="caption">遍次 ${s.repeat_index}</div></td><td><span class="state ${s.citation_state}">${stateLabel(s.citation_state)}</span><div class="num">${num(s.unique_url_events)} URL 事件</div></td><td><span class="state">待完成证据审计</span></td><td><button class="icon-button" data-sample="${esc(s.sample_id)}" aria-label="查看原回答" title="查看原回答" aria-expanded="false">${icon('chevron-down')}</button></td></tr>`).join('');}
    document.getElementById('table-area').innerHTML=`${state.view==='changes'?crossSummary():''}<div class="table-summary" aria-live="polite"><span>共 <b class="num" data-row-count>${num(visible.length)}</b> ${state.view==='domains'?'个域名':state.view==='sources'?'个 URL':state.view==='changes'?'个'+state.changeKind:'条记录'}</span><span>${state.search?'搜索结果':'当前筛选'} · 每页 25 条${['sources','domains'].includes(state.view)?` · ${num(visible.reduce((n,u)=>n+u.events,0))} 个引用事件`:state.view==='unresolved'?` · ${num(visible.reduce((n,s)=>n+s.unknown_cards,0))} 张未知卡`:''}</span></div><div class="table-wrap"><table class="${cls}"><thead><tr>${heads.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${body||`<tr><td colspan="${heads.length}" class="empty">没有匹配记录</td></tr>`}</tbody></table></div><div class="pager"><button class="icon-button" id="prev" title="上一页" aria-label="上一页" ${state.page===1?'disabled':''}>${icon('chevron-left')}</button><span>${state.page} / ${pages}</span><button class="icon-button" id="next" title="下一页" aria-label="下一页" ${state.page===pages?'disabled':''}>${icon('chevron-right')}</button></div>`;
    document.getElementById('prev').onclick=()=>{state.page--;renderTable();};document.getElementById('next').onclick=()=>{state.page++;renderTable();};
    document.querySelectorAll('[data-sample]').forEach(b=>b.onclick=()=>expand(b,b.dataset.sample,round));
    document.querySelectorAll('[data-pair]').forEach(b=>{
      const p=page[Number(b.dataset.pair)];b.onclick=()=>expandPair(b,p);
      for(const n of [1,2])if(unavailable(n,p[`r${n}_sample_id`])){const note=document.createElement('strong');note.className='unavailable quality-row-note';note.dataset.qualityStatus='unavailable';note.textContent='原答不可用';b.closest('tr').children[n].append(note);}
    });
    document.querySelectorAll('[data-sample]').forEach(b=>{
      const q=unavailable(round,b.dataset.sample);if(!q)return;
      const row=b.closest('tr'),note=state.view==='samples'?row.children[3].querySelector('.state'):null;
      const badge=note||document.createElement('span');badge.textContent='原答不可用';badge.className='unavailable quality-row-note';badge.dataset.qualityStatus='unavailable';if(!note)row.children[0].append(badge);
    });bindSourceNavigation();icons();
    if(finalMetrics){
      document.querySelectorAll('[data-sample]').forEach(b=>{const audited=semanticSamples.get(b.dataset.sample);if(audited?.answer_validity!=='valid'||state.view!=='samples')return;const cell=b.closest('tr').children[3],key=state.metric;cell.innerHTML=`<span class="state">已完成证据审计</span><div class="caption">${esc(semanticAPI.definitions.find(d=>d[0]===key)[1])}：${key==='average_rank'?audited.rank??'暂无明确排名':audited.metrics[key]?auditState(audited.metrics[key],key):'详见原答审计'}<br>明确推荐名次：${audited.rank??'暂无明确排名'}</div>`;});
      document.querySelectorAll('[data-pair]').forEach(b=>{const p=page[Number(b.dataset.pair)],key=state.metric;const frozen=finalComparison.pairs.find(f=>f.r1_sample_id===p.r1_sample_id&&f.r2_sample_id===p.r2_sample_id);const cell=b.closest('tr').children[3];cell.innerHTML=`${p.strict?'语义等价配对':'文字删减已审定等价'}<div class="caption">${esc(semanticAPI.definitions.find(d=>d[0]===key)[1])}：${key==='average_rank'?`${frozen.rank.round1??'无排名'} → ${frozen.rank.round2??'无排名'}`:frozen.metrics[key]?`${auditState(frozen.metrics[key].round1,key)} → ${auditState(frozen.metrics[key].round2,key)}`:'补充指标见全轮汇总与原答审计'}</div>`;});
      const footer=document.querySelector('footer');
      document.querySelector('#records .section-head p').textContent='原回答、唯一推荐裁定、逐项状态、具体理由与原句证据；异常原答仍保留';
      document.querySelectorAll('.local-tag').forEach(el=>el.textContent='蝉圈圈 GEO');
      if(footer)footer.textContent='两轮已复核结果 · 比较仅描述差异，不归因效果';
    }
  }
  function auditState(state,key) {if(key==='error_rate'&&['pass','fail'].includes(state))return state==='pass'?'存在证实错误':'未发现证实错误';return ({pass:'通过',fail:'未通过',unknown:'待核验',not_applicable:'不适用',source_unavailable:'原答不可用',hit:'完整命中',missing:'缺失',partial:'部分命中'})[state]||'未冻结';}
  function evidenceMarkup(value) {
    if(!value)return '';
    if(Array.isArray(value))return value.map(evidenceMarkup).join('');
    if(typeof value!=='object')return `<p class="caption">${esc(value)}</p>`;
    if(typeof value.quote==='string')return `<blockquote>${esc(value.quote)}<div class="caption num">正文区间 [${esc(value.start)}, ${esc(value.end)})</div>${value.fact_refs?.length?`<p class="caption">事实依据：${value.fact_refs.map(esc).join(' · ')}</p>`:''}</blockquote>`;
    return Object.entries(value).map(([key,v])=>`<div class="evidence-field"><span class="caption">${esc(key)}</span>${evidenceMarkup(v)}</div>`).join('');
  }
  async function markAnswerAudit(panel,s,n) {
    if(!finalMetrics||unavailable(n,s.sample_id))return;
    const key=`${n}/${s.question_id}`;
    if(!semanticCache.has(key))semanticCache.set(key,json(`${semanticConfig.evidenceBase}/round${n}/${s.question_id}.json`).catch(e=>{semanticCache.delete(key);throw e;}));
    const audit=(await semanticCache.get(key)).find(r=>r.sample_id===s.sample_id);
    if(!audit||audit.answer_sha256!==s.answer_sha256)throw new Error('原答与最终审计指纹不一致');
    if(!panel.isConnected)return;
    const meta=panel.querySelector('.answer-meta span:nth-child(2)');meta.textContent='已完成证据审计';
    panel.querySelector('.semantic-detail').outerHTML=`<details class="semantic-detail" data-audited-sample="${esc(s.sample_id)}"><summary>状态、具体理由与原句证据</summary><p class="caption num">正文原答区间 [${audit.body_raw_range.join(', ')}) · SHA-256 ${esc(audit.body_sha256)}</p>${semanticAPI.stateKeys.map(key=>{const f=audit.metrics[key];return `<details class="audit-metric" data-audit-metric="${key}"><summary>${esc(semanticAPI.definitions.find(d=>d[0]===key)[1])} · ${auditState(f.state,key)}</summary><p>${esc(f.reason)}</p>${evidenceMarkup(f.evidence)}</details>`;}).join('')}<details class="audit-metric"><summary>唯一推荐裁定 · ${audit.rank??'暂无明确排名'}</summary><p>${esc(audit.recommendation.reason)}</p>${evidenceMarkup(audit.recommendation.evidence)}</details><details class="audit-metric"><summary>适用优势机制项 · ${num(audit.advantage_items.length)} 项</summary>${audit.advantage_items.map(a=>`<div><strong>${esc(a.item_id)} · ${auditState(a.final.state)}</strong><p>${esc(a.final.reason)}</p>${evidenceMarkup(a.final.evidence)}</div>`).join('')||'<p class="caption">无适用机制项</p>'}</details><details class="audit-metric"><summary>证实错误 ${num(audit.errors.length)} · 附加待核主张 ${num(audit.claims_unknown.length)}</summary>${evidenceMarkup(audit.errors)}${evidenceMarkup(audit.claims_unknown)}</details><details class="audit-metric"><summary>具体优势与事实支持</summary>${evidenceMarkup(audit.advantage_claims)}</details><details class="audit-metric"><summary>工具及候选提及证据</summary>${evidenceMarkup(audit.tool_evidence)}</details><details class="audit-metric"><summary>排除片段与口径修订</summary><p>${esc(audit.revision_reason)}</p>${evidenceMarkup(audit.exclusions)}${evidenceMarkup(audit.source_corrections)}</details></details>`;
  }
  async function sampleDetail(n,id) { const index= n===round ? samples : await json(`round${n}/samples.json`);const s=index.find(s=>s.sample_id===id);if(!s)throw new Error('未找到回答记录');const key=`${n}/${s.question_id}`;if(!cache.has(key))cache.set(key,await json(`round${n}/questions/${s.question_id}.json`));return cache.get(key).find(s=>s.sample_id===id); }
  function answerMarkup(s,n) { return `<h3 class="answer-heading">第${n}轮 · ${esc(s.question_id)}</h3><div class="answer-meta"><span>${esc(s.sample_id)}</span><span>语义待完成证据审计</span><a href="${new URL(`round${n}/${kind}/?sample=${encodeURIComponent(s.sample_id)}#sample-${encodeURIComponent(s.sample_id)}`,base)}">回答深链</a></div><pre class="answer"></pre><details class="semantic-detail"><summary>语义审计详情 · 待判断</summary><p class="caption">品牌提及、错误信息${s.recommendation_applicable?'、首推与前三':''}：待完成证据审计。已证实冲突与材料外待核验尚未分类冻结，不以未审计冒充无错误。</p>${s.applicable.includes('explanation_accuracy')?'<p class="caption">解释准确：待判断</p>':''}${s.applicable.includes('positioning_accuracy')?'<p class="caption">定位准确：待判断</p>':''}${s.category==='品牌对比型'?`<p class="caption">适用优势 ${num(s.advantage_items.length)} 项；完整命中、缺失或部分、最终 unknown 均未冻结。</p><ul class="source-items">${s.advantage_items.map(id=>`<li><span class="num">${esc(id)}</span> · 待判断</li>`).join('')}</ul>`:''}</details><details><summary>引用卡 ${num(s.sources.length)} · URL 事件 ${num(s.unique_url_events)}</summary><ul class="source-items">${s.sources.map(c=>{const u=safeUrl(c.raw_url);return `<li>${u?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(c.title||u)}</a><span class="host-label">${esc(c.raw_url)}</span>`:`<span>${esc(c.title||'空引用卡')} · 无可解析 URL</span>`}<span class="state">${c.source_type==='official'?'官网':c.source_type==='unresolved'?'归属未知':'第三方'} · 内容支持待核验 · 可访问性待核验</span></li>`;}).join('')}</ul></details>`; }
  function expansionRow(b) { const row=b.closest('tr');if(b.getAttribute('aria-expanded')==='true'){row.nextElementSibling.remove();b.setAttribute('aria-expanded','false');b.innerHTML=icon('chevron-down');icons();return null;}const tr=document.createElement('tr');tr.className='expand-row';tr.innerHTML='<td colspan="5"><div class="answer-content" role="status">正在读取原回答…</div></td>';row.after(tr);b.setAttribute('aria-expanded','true');b.innerHTML=icon('chevron-up');icons();return tr.querySelector('.answer-content'); }
  function answerEvidence(s,n) { return `<div class="frozen-evidence"><p class="caption">冻结原答 SHA-256：<span class="num">${esc(s.answer_sha256)}</span></p><a class="button" download href="${new URL(`data/round${n}/questions/${s.question_id}.json`,base)}">${icon('download')}同题全量原答与引用卡 JSON</a><p class="caption">这是原答与引用卡的冻结证据，不是网页采样截图；API 原始响应与真实历史采样截图只采用来源实际提供的材料。</p></div>`; }
  function markAnswerQuality(panel,s,n) {
    const q=unavailable(n,s.sample_id);if(!q)return;
    const meta=panel.querySelector('.answer-meta span:nth-child(2)');meta.textContent='原答不可用 · 不进入表现指标分母';meta.classList.add('unavailable');
    const detail=panel.querySelector('.semantic-detail');detail.outerHTML=`<div class="notice quality-notice"><strong>原答不可用 · ${qualityLabel(q)}</strong><p>该槽位只完成原答质量核查，不声称完成语义审计；不填未提及、失败、unknown 或 0 分。原答与引用按原件保留。</p>${q.evidence.map(e=>`<blockquote>${esc(e.quote)}</blockquote>`).join('')}${q.repetition?`<p>${esc(q.repetition.token)} 连续重复 ${num(q.repetition.count)} 次至原文结束。</p>`:''}</div>`;
  }
  async function pairedCitationMarkup(p) {
    if(!pairedCitationPromise)pairedCitationPromise=json('paired-citations.json').catch(e=>{pairedCitationPromise=null;throw e;});
    const changes=(await pairedCitationPromise).find(c=>c.r1_sample_id===p.r1_sample_id&&c.r2_sample_id===p.r2_sample_id);
    if(!changes)throw new Error('未找到配对引用变化证据');
    return `<div class="paired-citations"><h3 class="answer-heading">同一配对槽位 · 引用网址变化</h3><p class="caption">第一轮 → 第二轮；两侧引用捕获均可观测。保留异常原答对应的引用事实，不据引用推测答文。</p>${[['retained_urls','保留'],['new_urls','新增'],['disappeared_urls','未再出现']].map(([key,label])=>`<details data-pair-change="${key}" data-count="${changes[key].length}"><summary>${label} <span class="num">${num(changes[key].length)}</span> 个网址</summary><ul class="source-items">${changes[key].map(url=>`<li><a class="source-link" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(url)}</a></li>`).join('')||'<li class="caption">无</li>'}</ul></details>`).join('')}</div>`;
  }
  async function expand(b,id,n){const panel=expansionRow(b);if(!panel)return;try{const s=await sampleDetail(n,id);if(!panel.isConnected)return;panel.innerHTML=answerMarkup(s,n)+answerEvidence(s,n);panel.removeAttribute('role');panel.querySelector('.answer').textContent=s.answer_text;markAnswerQuality(panel,s,n);await markAnswerAudit(panel,s,n);if(!panel.isConnected)return;panel.closest('.table-wrap').scrollLeft=0;panel.scrollIntoView({block:'nearest',inline:'start'});icons();}catch(e){panel.textContent=e.message;panel.classList.add('error-message');b.setAttribute('aria-expanded','true');}}
  async function expandPair(b,p){const panel=expansionRow(b);if(!panel)return;try{const [answers,changes]=await Promise.all([Promise.all([sampleDetail(1,p.r1_sample_id),sampleDetail(2,p.r2_sample_id)]),kind==='citation'?pairedCitationMarkup(p):Promise.resolve('')]);if(!panel.isConnected)return;panel.innerHTML=`<div class="pair-answers">${answers.map((s,i)=>`<div>${answerMarkup(s,i+1)}${answerEvidence(s,i+1)}</div>`).join('')}</div>`+changes;panel.removeAttribute('role');const elements=[...panel.querySelectorAll('.answer')];for(let i=0;i<elements.length;i++){elements[i].textContent=answers[i].answer_text;markAnswerQuality(elements[i].parentElement,answers[i],i+1);await markAnswerAudit(elements[i].parentElement,answers[i],i+1);}icons();}catch(e){panel.textContent=e.message;panel.classList.add('error-message');}}
  function exportCurrent(){const data=rowsForTable().map(row=>{const r={standard_id:semanticConfig.version,...row};if(r.sample_id){const audited=semanticSamples.get(r.sample_id);r.semantic_audit_status=audited?.answer_validity==='valid'?'final_verified':'source_unavailable';r.audited_metrics=audited?.metrics||null;r.audited_rank=audited?.rank??null;}return r;});if(!data.length)return;const fields=Object.keys(data[0]).filter(k=>!['advantage_items','applicable'].includes(k));const cell=x=>{let v=x&&typeof x==='object'?Array.isArray(x)&&x.every(v=>typeof v!=='object')?x.join('|'):JSON.stringify(x):String(x??'');if(/^[=+@-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};const csv='\uFEFF'+[fields.map(cell).join(','),...data.map(s=>fields.map(k=>cell(s[k])).join(','))].join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`chanquanquan-round${round||'compare'}-${state.view}-filtered.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  async function start(){
    try{[quality,citationDisplay]=await Promise.all([json('answer-quality.json'),json('citation-display-summary.json'),loadSemantic()]);if(round){[samples,summary]=await Promise.all([json(`round${round}/samples.json`),json(`round${round}/summary.json`)]);if(kind==='citation') {const other=round===1?2:1;let otherSamples,otherUrls;[urls,otherSamples,otherUrls]=await Promise.all([json(`round${round}/urls.json`),json(`round${other}/samples.json`),json(`round${other}/urls.json`)]);citationRounds.set(round,{samples,urls});citationRounds.set(other,{samples:otherSamples,urls:otherUrls});}}else{[comparison,pairs,samples,firstRoundSamples]=await Promise.all([json('comparison.json'),json('pairs.json'),json('round2/samples.json'),json('round1/samples.json')]);}layout();
      if(target){const b=document.querySelector(`[data-sample="${CSS.escape(target)}"]`);if(b){await expand(b,target,round);b.closest('tr').scrollIntoView({block:'start'});}}
      else if(targetQuestion)document.getElementById('records').scrollIntoView({block:'start'});
    }catch(e){app.setAttribute('aria-busy','false');app.innerHTML='<div class="exception"><h2>数据暂不可用</h2><p class="error-message"></p><button class="button" id="retry">重新加载</button></div>';app.querySelector('p').textContent=e.message;document.getElementById('retry').onclick=start;}
  }
  start();
})();
