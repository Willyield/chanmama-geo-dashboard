/* Read-only report projection. No account access, analytics, or sampling. */
(()=>{'use strict';
const script=document.currentScript,root=new URL(script.dataset.root,location.href),initial=script.dataset.view;
const main=document.querySelector('main'),nav=document.querySelector('#navigation');
let data,active,query='',rowsPerPage=15;const states=new Map();
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=p=>new URL(p,root).href;
const plain=s=>s.replace(/〔本地核验资料〕/g,'核验资料留存本地');
const linked=s=>s.split(/(https?:\/\/[^\s<>）]+)/g).map(v=>/^https?:\/\//.test(v)?`<a href="${h(v)}" target="_blank" rel="noopener noreferrer">${h(v)}</a>`:h(v)).join('');
const cell=s=>{const v=plain(String(s));return v.length>190?`<details class="cell-detail"><summary>${h(v.slice(0,65))}…</summary><p>${linked(v)}</p></details>`:linked(v);};
const findTable=id=>data.sections.flatMap(s=>s.blocks).find(b=>b.id===id);
const download=(file,label)=>`<a class="button" download href="${h(url('analysis/20261030/'+file))}">${label}</a>`;
const tableMarkup=b=>{states.set(b.id,{...b,page:1,search:'',filter:''});return `<div class="data-block" id="${b.id}" data-table="${b.id}"><div class="table-toolbar"><label>筛选本表<input type="search" data-search="${b.id}" placeholder="搜索名称、指标或说明" autocomplete="off"></label><label>${h(b.headers[0])}<select data-filter="${b.id}"><option value="">全部</option>${[...new Set(b.rows.map(r=>r[0]))].slice(0,50).map(v=>`<option value="${h(v)}">${h(v)}</option>`).join('')}</select></label><button type="button" data-csv="${b.id}">下载此表</button></div><div class="table-result" aria-live="polite"></div><div class="table-scroll" tabindex="0" role="region" aria-label="${h(b.headers.slice(0,2).join('、'))}数据表"><table><thead><tr>${b.headers.map(v=>`<th scope="col">${h(v)}</th>`).join('')}</tr></thead><tbody></tbody></table></div><div class="table-pager"><button type="button" data-page="${b.id}" data-step="-1">上一页</button><span class="page-label"></span><button type="button" data-page="${b.id}" data-step="1">下一页</button></div></div>`;};
function updateTable(id){const s=states.get(id),el=document.getElementById(id);if(!s||!el)return;
 const rs=s.rows.filter(r=>(!s.filter||r[0]===s.filter)&&(!s.search||r.join(' ').toLocaleLowerCase().includes(s.search.toLocaleLowerCase()))),pages=Math.max(1,Math.ceil(rs.length/rowsPerPage));s.page=Math.min(s.page,pages);
 el.querySelector('tbody').innerHTML=rs.slice((s.page-1)*rowsPerPage,s.page*rowsPerPage).map(r=>`<tr>${r.map((v,i)=>`<td data-label="${h(s.headers[i])}">${cell(v)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${s.headers.length}" class="empty">没有匹配记录。清空搜索或选择“全部”恢复。</td></tr>`;
 el.querySelector('.table-result').textContent=`${rs.length} / ${s.rows.length} 行`;
 el.querySelector('.page-label').textContent=`第 ${s.page} / ${pages} 页`;
 el.querySelector('[data-step="-1"]').disabled=s.page<=1;el.querySelector('[data-step="1"]').disabled=s.page>=pages;
}
function sectionMarkup(s){if(!s.blocks.length)return '';return `<section id="${s.id}" class="report-part"><h2>${h(s.title)}</h2>${s.blocks.map(b=>b.type==='table'?tableMarkup(b):`<p class="report-copy">${h(plain(b.text))}</p>`).join('')}</section>`;}
function figure(){const options=data.metrics.map(m=>`<option value="${m.key}">${m.label}</option>`).join('');return `<section class="trend-section"><div class="section-heading"><h2>三轮趋势</h2><label>查看指标<select id="chart-metric">${options}</select></label></div><div id="trend-chart"></div><p class="caption">曲线为确认值。unknown保留在主分母；无明确名次时不绘制0值。</p></section>`;}
function drawChart(key){const m=data.metrics.find(m=>m.key===key),el=document.querySelector('#trend-chart');if(!el)return;
 if(m.rounds.some(r=>r.percentage===undefined)){el.innerHTML='<p class="rank-empty">三轮均无明确排名观测，平均排名未知。不能从缺少名次推出没有推荐。</p>';return;}
 const vals=m.rounds.map(r=>Number(r.percentage)),points=vals.map((v,i)=>`${90+i*260},${210-v*1.7}`).join(' ');
 el.innerHTML=`<svg viewBox="0 0 700 260" role="img" aria-label="${h(m.label)}：${vals.map((v,i)=>'第'+(i+1)+'轮'+v+'%').join('，')}"><title>${h(m.label)}三轮确认值</title>${[0,25,50,75,100].map(v=>`<line x1="70" x2="640" y1="${210-v*1.7}" y2="${210-v*1.7}" class="gridline"/><text x="8" y="${215-v*1.7}">${v}%</text>`).join('')}<polyline points="${points}" fill="none" class="trend-line"/>${vals.map((v,i)=>`<circle cx="${90+i*260}" cy="${210-v*1.7}" r="5"/><text x="${90+i*260}" y="${195-v*1.7}" text-anchor="middle">${v.toFixed(1)}%</text><text x="${90+i*260}" y="245" text-anchor="middle">第${i+1}轮</text>`).join('')}</svg><div class="chart-values">${m.rounds.map((r,i)=>`<p><strong>第${i+1}轮 ${h(r.percentage)}%</strong><span>${r.numerator} / ${r.denominator} · 待核验 ${r.unknown??'不适用'}</span></p>`).join('')}</div>`;
}
function overview(){return `<section class="research-intro"><h1>蝉圈圈三轮研究</h1><p>品牌认知、竞争结构与引用来源，放在同一版本中阅读。</p><p class="date-note">第3轮采集：2026-10-28—10-29 · 产品补证：2026-10-30</p></section><div class="finding-strip"><div><span>品牌提及率</span><strong>31.9%</strong><small>233 / 730 · 较第二轮 +6.4个百分点</small></div><div><span>竞争份额</span><strong>30.9%</strong><small>72 / 233 候选事件 · -1.4个百分点</small></div><div><span>学习圈引用</span><strong>584次</strong><small>较第二轮 +188次</small></div></div><p class="boundary-note">165道不同题目：CORE100题每天3次、OTHER65题每天1次，每轮两天计划730份回答。第三轮751次尝试含21次成功替代；原14次失败、7次未决单列保留。</p>${figure()}<div class="quick-links"><a href="#competition">查看13候选排序</a><a href="#citations">查看三类引用专项</a><a href="#product">查看67项权益</a></div>`;}
function render(){const [id,requestedScope]=(location.hash.slice(1)||initial||'overview').split('/');active=data.groups.some(g=>g.id===id)?id:'overview';const scope=['summary','learning','social','douyin'].includes(requestedScope)?requestedScope:'summary';states.clear();const g=data.groups.find(g=>g.id===active);
 for(const a of nav.querySelectorAll('a')){if(a.hash==='#'+active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
 let top=active==='overview'?overview():`<header class="view-heading"><h1>${g.label}</h1><p>${g.intro}</p></header>`;
 if(active==='metrics')top+=figure();
 if(active==='competition')top+=`<section class="report-part"><h2>13候选 · 39行排序补判</h2><p class="boundary-note">所有候选三轮确认首推、前三均为0 / 180；明确名次观测为0，平均排名为未知。待核验数量逐候选保留，不说“未推荐”。</p>${tableMarkup({id:'ranking-39',headers:data.ranking.headers,rows:data.ranking.rows})}${download('rankings.csv','下载39行排序')}</section>`;
 if(active==='citations')top+=`<div class="citation-summary"><p><strong>官网学习圈</strong> 265 → 396 → 584次</p><p><strong>其他社媒（旧可比范围）</strong> 1079 → 407 → 684次</p><p><strong>自有7个抖音号</strong> 10 → 332 → 111次</p></div><p class="boundary-note">最新登记290条发布记录、289个唯一作品，三轮在登记范围各0 / 730，不能外推全账号零引用。第三轮整体17594张来源卡，其中11868张有URL、5726张缺URL；同答同URL去重10639次、唯一URL2921个。</p>`;
 if(active==='citations')top+=`<nav class="citation-tabs" aria-label="引用专项范围">${[['summary','引用总览'],['learning','官网学习圈'],['social','其他社媒'],['douyin','抖音']].map(([key,label])=>`<a href="#citations/${key}"${key===scope?' aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
 if(active==='product')top+=`<p class="boundary-note">四档年费：基础版10,889元、商家版26,800元、品牌版42,300元、集团版73,800元。空白不当作0；当前事实不回写历史标签。</p><div class="download-row">${download('entitlements.csv','下载67行权益')}</div>`;
 const selected=data.sections.filter(s=>s.group===active&&s.blocks.length&&(active!=='citations'||s.citationScope===scope));
 const toc=`<nav class="section-index" aria-label="本页章节">${selected.map(s=>`<a href="#${active}" data-section="${s.id}">${h(s.title.replace(/^(?:[一二三四五六七八九]、|\d+\.\d*\s*)/,''))}</a>`).join('')}</nav>`;
 main.innerHTML=top+toc+selected.map(sectionMarkup).join('')+`<section class="downloads"><h2>下载与版本</h2><p>${h(data.version)} · ${h(data.standard)}</p><div class="download-row">${download('report.md','综合报告（公开版）')}${download('all-tables.csv','全部公开表格')}${download('rankings.csv','39行排序')}${download('entitlements.csv','67行权益')}</div><p class="caption">下载与页面同版。原答、账号取证原件、内部路径与哈希清单不公开。</p></section>`;
 for(const id of states.keys())updateTable(id);drawChart('mention_rate');document.documentElement.dataset.ready='true';
 document.title=g.label+' | 蝉圈圈三轮研究';window.scrollTo(0,0);
}
function exportTable(id){const s=states.get(id);const csv='\ufeff'+[s.headers,...s.rows].map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');const a=document.createElement('a'),u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=u;a.download=id+'-20261030.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
main.addEventListener('input',e=>{if(e.target.dataset.search){const s=states.get(e.target.dataset.search);s.search=e.target.value;s.page=1;updateTable(s.id);}});
main.addEventListener('change',e=>{if(e.target.dataset.filter){const s=states.get(e.target.dataset.filter);s.filter=e.target.value;s.page=1;updateTable(s.id);}if(e.target.id==='chart-metric')drawChart(e.target.value);});
main.addEventListener('click',e=>{const b=e.target.closest('button,a');if(!b)return;if(b.dataset.page){const s=states.get(b.dataset.page);s.page+=Number(b.dataset.step);updateTable(s.id);}if(b.dataset.csv)exportTable(b.dataset.csv);if(b.dataset.section){e.preventDefault();document.getElementById(b.dataset.section)?.scrollIntoView({behavior:'instant'});}});
addEventListener('hashchange',()=>{if(data&&location.hash!=='#content')render();});
async function load(){try{const r=await fetch(url('analysis/20261030/dashboard.json'),{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();render();}catch(e){main.innerHTML=`<div class="load-error" role="alert"><h1>研究数据未能加载</h1><p>请检查连接后重试，或先下载完整公开报告。</p><button id="retry" type="button">重新加载</button>${download('report.md','下载报告')}</div>`;document.getElementById('retry').onclick=load;}}
load();
})();
