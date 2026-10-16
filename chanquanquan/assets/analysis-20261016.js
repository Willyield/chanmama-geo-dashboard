(() => {
 'use strict';
 const host=document.querySelector('#analysis-dashboard');if(!host)return;
 const base=new URL('../../',location.href),round=Number(document.body.dataset.round),citation=document.body.dataset.kind==='citation';
 const folder=new URL('data/analysis-20261016/',base);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const n=x=>Number(x).toLocaleString('en-US');const signed=x=>(Number(x)>0?'+':'')+x;
 const file=name=>new URL(name,folder).href;
 const original=(r,id)=>new URL(`round${r}/data/?sample=${encodeURIComponent(id)}#sample-${encodeURIComponent(id)}`,base).href;
 const question=(r,id)=>new URL(`round${r}/data/?question=${encodeURIComponent(id)}`,base).href;
 const cache=new Map();
 async function json(name){if(!cache.has(name))cache.set(name,fetch(file(name)).then(r=>{if(!r.ok)throw Error('分析数据暂不可用');return r.json();}).catch(e=>{cache.delete(name);throw e;}));return cache.get(name);}
 const downloads=()=>`<div class="download-list"><a class="button" download href="${file('场景类竞品明细.csv')}">下载场景竞品 CSV</a><a class="button" download href="${file('场景类竞品分析.md')}">场景竞品报告</a><a class="button" download href="${file('深层机制分析.md')}">深层机制报告</a><a class="button" download href="${file('scene-competitors.public.json')}">完整竞品证据 JSON</a><a class="button" download href="${file('mechanism-analysis.public.json')}">机制证据 JSON</a></div>`;
 function compact(){
  host.innerHTML=`<section class="analysis-entry"><div><h2>场景工具与竞品</h2><p>第${round===1?'一':'二'}轮：${round===1?'578':'580'} 条有效场景回答。查看工具提及明细、逐题证据与两轮变化。</p></div><a class="button" href="${new URL(`compare/data/?sceneRound=${round}#scene-competitors`,base)}">查看本轮场景竞品</a></section>`;
  host.dataset.ready='true';
 }
 if(round){compact();return;}
 let data,mechanism,filter='固定13候选',search='',sort='round2_count',direction=-1,detail=null,page=1,selectedRound=Number(new URLSearchParams(location.search).get('sceneRound'))||0;
 if(![0,1,2].includes(selectedRound))selectedRound=0;
 function mechanismMarkup(short=false){
  const selected=short?[mechanism.facts[1]]:mechanism.facts;
  return `<section id="mechanism-analysis" class="analysis-section" aria-labelledby="mechanism-title"><div class="analysis-heading"><h2 id="mechanism-title">引用与品牌采用：数据变化背后的机制</h2><span class="caption">${short?'引用结构摘要':'事实、解释与证据边界'}</span></div>
   <div class="analysis-facts">${selected.map((f,i)=>`<article data-mechanism-fact="${i}"><span class="caption">${esc(f.nature)}</span><h3>${esc(f.title)}</h3><p class="analysis-observation">${esc(f.observation)}</p><p>${esc(f.interpretation)}</p></article>`).join('')}</div>
   <p class="caption">五个提及损失案例，每题每轮 6 答，共 30 答；这不是全部题目的随机代表。</p>
   <div class="table-wrap"><table class="analysis-five"><thead><tr><th>需求</th><th>品牌提及<br>第一轮 → 第二轮</th><th>含官方目录引用的回答<br>第一轮 → 第二轮</th><th>URL 事件<br>第一轮 → 第二轮</th><th>原回答与来源</th></tr></thead><tbody>${mechanism.five_question_evidence.map(q=>`<tr data-five-question="${esc(q.question_id)}"><th scope="row">${esc(q.theme)}</th><td>${q.round1.brand_mentions} → ${q.round2.brand_mentions}</td><td>${q.round1.official_directory_answers} → ${q.round2.official_directory_answers}</td><td>${q.round1.url_events} → ${q.round2.url_events}</td><td><a href="${question(1,q.question_id)}">第一轮 6 答</a> · <a href="${question(2,q.question_id)}">第二轮 6 答</a></td></tr>`).join('')}<tr class="analysis-total"><th scope="row">合计 · 每轮 30 答</th><td>29 → 0</td><td>24 → 0</td><td>624 → 417</td><td></td></tr></tbody></table></div>
   <h3>全部场景回答：官方目录引用与品牌提及</h3><div class="table-wrap"><table class="analysis-cross"><thead><tr><th>分组</th><th>第一轮提及</th><th>第二轮提及</th></tr></thead><tbody>${[true,false].map(v=>{const a=mechanism.scene_official_cross_diagnostic.find(x=>x.round===1&&x.official_directory_visible===v),b=mechanism.scene_official_cross_diagnostic.find(x=>x.round===2&&x.official_directory_visible===v);return `<tr><th scope="row">${v?'有':'无'}官方目录可见引用</th><td>${a.brand_mentions}/${a.answers} · ${(100*a.brand_mentions/a.answers).toFixed(1)}%</td><td>${b.brand_mentions}/${b.answers} · ${(100*b.brand_mentions/b.answers).toFixed(1)}%</td></tr>`;}).join('')}</tbody></table></div>
   <p class="analysis-boundary">引用与正文同属一次生成，分组成员也不同：上述数据仅支持相关性。URL 事件增加不等于品牌采用或来源广度提升。</p>
   <details class="analysis-limits"><summary>证据边界与尚未完成的核验</summary><ul>${mechanism.limits.map(l=>`<li>${esc(l)}</li>`).join('')}</ul><p>${esc(mechanism.next_diagnostic)}</p></details>
   ${short?`<p><a href="${new URL('compare/data/#mechanism-analysis',base)}">查看完整六项机制分析与场景竞品</a></p>`:''}${downloads()}</section>`;
 }
 function render(){
  if(citation){host.innerHTML=mechanismMarkup(true);host.dataset.ready='true';return;}
  const tools=data.tools.filter(t=>(filter==='全部已审工具'||(filter==='固定13候选'?t.in_fixed_13:t.display_group===filter))&&t.tool.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>typeof a[sort]==='string'&&sort==='tool'?direction*a.tool.localeCompare(b.tool,'zh-CN'):direction*(Number(a[sort])-Number(b[sort])));
  const both=!selectedRound;
  host.innerHTML=`<section id="scene-competitors" class="analysis-section" aria-labelledby="scene-title"><div class="analysis-heading"><h2 id="scene-title">业务场景中的工具与竞品</h2><span class="caption">${both?'两轮对照':`第${selectedRound===1?'一':'二'}轮明细`}</span></div>
   <p class="caption" id="scene-scope">全部有效场景回答：第一轮 578 条 / 第二轮 580 条；本表独立于下方主指标筛选，同一回答同一工具计一次。提及不等于推荐或首推。</p>
   <div class="analysis-controls"><label>工具范围<select id="scene-group">${['固定13候选','其他已审工具','关联产品','全部已审工具'].map(v=>`<option ${v===filter?'selected':''}>${v}</option>`).join('')}</select></label><label>轮次<select id="scene-round"><option value="0" ${!selectedRound?'selected':''}>两轮对照</option><option value="1" ${selectedRound===1?'selected':''}>第一轮</option><option value="2" ${selectedRound===2?'selected':''}>第二轮</option></select></label><label>搜索工具<input id="scene-search" type="search" placeholder="输入工具名称" value="${esc(search)}"></label><label>排序<select id="scene-sort">${[['round2_count','第二轮次数'],['round1_count','第一轮次数'],['count_change','次数变化'],['rate_change_points','提及率差'],['tool','工具名称']].map(([v,label])=>`<option value="${v}" ${sort===v?'selected':''}>${label}</option>`).join('')}</select></label><button class="button" type="button" id="scene-direction">${direction===-1?'降序':'升序'}</button></div>
   <div class="table-summary"><span id="scene-tool-count">${tools.length} 个工具</span><span>点击“逐题与原答”查看证据</span></div><div class="table-wrap"><table class="analysis-tools"><thead><tr><th>工具</th>${both?'<th>第一轮次数</th><th>提及率 / 578</th><th>第二轮次数</th><th>提及率 / 580</th><th>次数变化</th><th><abbr title="第二轮提及率减第一轮提及率，以百分号显示；不是相对增幅。">提及率差</abbr></th>':`<th>第${selectedRound===1?'一':'二'}轮次数</th><th>提及率 / ${selectedRound===1?578:580}</th>`}<th>证据</th></tr></thead><tbody>${tools.length?tools.map(t=>`<tr data-scene-tool="${esc(t.tool)}"><th scope="row">${esc(t.tool)}${t.display_group==='关联产品'?'<small>关联产品</small>':''}</th>${both?`<td>${n(t.round1_count)}</td><td>${t.round1_rate}%</td><td>${n(t.round2_count)}</td><td>${t.round2_rate}%</td><td>${signed(t.count_change)}</td><td>${signed(t.rate_change_points)}%</td>`:`<td>${n(t[`round${selectedRound}_count`])}</td><td>${t[`round${selectedRound}_rate`]}%</td>`}<td><button class="analysis-link" type="button" data-scene-evidence="${esc(t.tool)}">逐题与原答</button></td></tr>`).join(''):`<tr><td colspan="8" class="empty">没有匹配的已审工具</td></tr>`}</tbody></table></div>
   <p class="caption">新榜有赚是普通新榜的特定子集，不能相加；飞瓜智星与飞瓜数据独立。关联产品不计入外部竞品。该场景表不改变原竞争份额名单与分母。</p>
   <details class="analysis-limits"><summary>未全量统计的替代工具</summary><p>${data.unreviewed_alternatives.map(esc).join('、')}：未完成全量审阅，不填 0，不生成推荐率或优势率。</p><p>已审零值只表示当前正文工具证据中未命中。</p></details>
   <section id="scene-evidence" aria-live="polite" aria-label="场景工具逐题与原答证据">${detailMarkup()}</section>${downloads()}</section>${mechanismMarkup()}`;
  bind();host.dataset.ready='true';
 }
 function detailMarkup(){
  if(!detail)return '';
  if(detail.loading)return '<p role="status">正在读取逐题与原答证据…</p>';
  if(detail.error)return `<p role="alert">${esc(detail.error)}</p><button class="button" type="button" id="scene-retry">重新读取证据</button>`;
  const evidence=detail.evidence.filter(e=>!selectedRound||e.round===selectedRound),rows=evidence.slice((page-1)*20,page*20),pages=Math.max(1,Math.ceil(evidence.length/20));
  return `<div class="analysis-heading"><h3>${esc(detail.tool)} · 逐题与原答</h3><button class="button" id="scene-close" type="button">收起证据</button></div>
   <div class="table-wrap"><table class="analysis-question"><thead><tr><th>问题</th><th>第一轮次数</th><th>第二轮次数</th></tr></thead><tbody>${detail.questions.length?detail.questions.map(q=>`<tr><th scope="row">${esc(q.text)}</th><td>${n(q.round1_count)}</td><td>${n(q.round2_count)}</td></tr>`).join(''):'<tr><td colspan="3">两轮均未观察到已审提及证据</td></tr>'}</tbody></table></div>
   <p class="caption">${n(evidence.length)} 条回答证据 · 正文工具原句及原答指纹随完整 JSON 提供</p><div class="table-wrap"><table class="analysis-evidence"><thead><tr><th>轮次 / 日期</th><th>问题与正文工具原句</th><th>原回答及全部引用</th></tr></thead><tbody>${rows.length?rows.map(e=>`<tr data-scene-sample="${esc(e.sample_id)}"><td>第${e.round===1?'一':'二'}轮<br>${esc(e.sample_date)}</td><td>${esc(e.text)}<blockquote>${e.quotes.map(esc).join('；')}</blockquote><details><summary>原答指纹</summary><code>${esc(e.answer_sha256)}</code></details></td><td><a href="${original(e.round,e.sample_id)}">查看原回答与引用</a></td></tr>`).join(''):'<tr><td colspan="3">当前轮次没有已审提及证据</td></tr>'}</tbody></table></div>
   <div class="pagination"><button class="button" id="scene-prev" type="button" ${page===1?'disabled':''}>上一页</button><span>${page} / ${pages}</span><button class="button" id="scene-next" type="button" ${page>=pages?'disabled':''}>下一页</button></div>`;
 }
 async function evidence(tool){
  detail={tool,loading:true};page=1;render();
  try{const d=await json('scene-details.json');if(detail?.tool!==tool)return;detail={tool,questions:d.question_counts.filter(e=>e.tool===tool),evidence:d.evidence.filter(e=>e.tool===tool)};render();document.querySelector('#scene-evidence').scrollIntoView({block:'start'});}
  catch(e){detail={tool,error:e.message};render();}
 }
 function bind(){
  const on=(s,type,fn)=>host.querySelector(s)?.addEventListener(type,fn);
  on('#scene-group','change',e=>{filter=e.target.value;detail=null;render();});
  on('#scene-round','change',e=>{selectedRound=Number(e.target.value);page=1;const u=new URL(location.href);if(selectedRound)u.searchParams.set('sceneRound',selectedRound);else u.searchParams.delete('sceneRound');history.replaceState(null,'',u);render();});
  const applySearch=e=>{if(e.isComposing)return;search=e.target.value;const pos=e.target.selectionStart;render();const input=host.querySelector('#scene-search');input.focus();input.setSelectionRange(pos,pos);};
  on('#scene-search','input',applySearch);on('#scene-search','compositionend',applySearch);
  on('#scene-sort','change',e=>{sort=e.target.value;render();});on('#scene-direction','click',()=>{direction*=-1;render();});
  host.querySelectorAll('[data-scene-evidence]').forEach(b=>b.addEventListener('click',()=>evidence(b.dataset.sceneEvidence)));
  on('#scene-close','click',()=>{detail=null;render();});on('#scene-retry','click',()=>evidence(detail.tool));
  on('#scene-prev','click',()=>{page--;render();document.querySelector('#scene-evidence').scrollIntoView({block:'start'});});on('#scene-next','click',()=>{page++;render();document.querySelector('#scene-evidence').scrollIntoView({block:'start'});});
 }
 async function start(){
  host.setAttribute('aria-busy','true');
  try{[data,mechanism]=await Promise.all([citation?null:json('scene-summary.json'),json('mechanism-analysis.public.json')]);render();host.setAttribute('aria-busy','false');if(location.hash==='#scene-competitors'||location.hash==='#mechanism-analysis')document.querySelector(location.hash)?.scrollIntoView({block:'start'});}
  catch(e){host.innerHTML=`<p role="alert">${esc(e.message)}</p><button class="button" type="button" id="analysis-retry">重新读取分析</button>`;host.querySelector('#analysis-retry').onclick=start;host.setAttribute('aria-busy','false');}
 }
 start();
})();
