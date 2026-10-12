const state = {data:null,query:'',kind:''};
const labels = {overview:'研究总览',samples:'样本摘要',monitor:'变化监测',records:'研究记录',graph:'证据关系',planning:'研究规划'};
const metrics = {mention:'正文提及候选',capability:'能力归属',source_observable:'来源可观测',body_length:'正文长度',recommended:'推荐',first:'首推',top3:'前三',fact_accuracy:'事实准确',severe_error:'严重错误'};
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => v==null?'待核验':new Intl.NumberFormat('zh-CN').format(v);
const pct = v => v==null?'待核验':(v*100).toFixed(1)+'%';
const card = (label,value,note) => '<article class="metric"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(note)+'</small></article>';
const panel = (title,html) => '<section class="panel"><h2>'+esc(title)+'</h2>'+html+'</section>';
const table = (head,rows) => '<div class="table-scroll"><table class="channel-table"><thead><tr>'+head.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const list = values => '<ul class="limitations">'+values.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>';
function overview() {
  const o=state.data.overview;
  const cards=card('真实样本',num(o.real_samples),'有效正文 '+num(o.valid_answers))+
    card('研究轨道',num(o.groups.length),'入口、模型、面板和版本分轨')+
    card('有阅读核验记录',num(o.reviewed_samples),'代理阅读与人工核验分别统计')+
    card('可公开记录',num(state.data.records.length),'仅保留获准公开的最新版本');
  return '<div class="hero-grid">'+cards+'</div>'+o.groups.map(g=>panel((g.surface||'未知入口')+' · '+(g.model_id||'未知模型')+' · '+(g.panel||'未知面板'),
    '<p class="meta">样本 '+num(g.count)+' · '+esc(g.rule_version)+' · '+esc(g.terminal)+'</p>'+
    table(['指标','已知值 / 已知分母','比例或均值','未知','不适用'],Object.entries(g.metrics).map(([key,m])=>[
      esc(metrics[key]||key),key==='body_length'?'长度样本 '+num(m.denominator):num(m.count)+' / '+num(m.denominator),
      key==='body_length'?(m.rate==null?'待核验':m.rate.toFixed(2)):pct(m.rate),num(m.unknown),num(m.not_applicable)
    ])))).join('')+panel('判断边界',list(o.limitations));
}
function samples() {
  return '<div class="section-heading"><h2>样本摘要</h2><label>筛选样本 <input id="sample-search" value="'+esc(state.query)+'" placeholder="样本或问题编号" type="search"></label></div>'+
    '<div id="sample-results">'+sampleResults()+'</div>';
}
function sampleResults() {
  const items=state.data.samples.filter(s=>(s.sample_id+' '+s.question_id+' '+s.surface).toLowerCase().includes(state.query.toLowerCase()));
  return '<p class="meta">'+num(items.length)+' / '+num(state.data.samples.length)+' 条记录 · 原始回答和冻结证据在本机研究台查看</p>'+
    table(['样本 / 问题','观察日期','入口 / 面板','正文提及','能力归属','来源卡 / 空卡'],items.map(s=>[
      '<code>'+esc(s.sample_id)+'</code><br><small>'+esc(s.question_id)+'</small>',esc((s.observed_at||'').slice(0,10)),
      esc(s.surface)+'<br>'+esc(s.panel),s.metrics.mention.status==='value'?num(s.metrics.mention.value):'待核验',
      s.metrics.capability.status==='value'?num(s.metrics.capability.value)+'<br><small>'+esc(s.metrics.capability.method)+'</small>':'待核验',
      num(s.source_summary.cards)+' / '+num(s.source_summary.empty_cards)
    ]))+state.data.overview.groups.map(g=>panel('来源构成 · '+g.surface,
      '<p class="meta">可观测回答 '+num(g.source_details.observable_answers)+' / '+num(g.source_details.valid_answer_denominator)+
      ' · 未知 '+num(g.source_details.unknown_answers)+' · 引用URL事件 '+num(g.source_details.url_event_denominator)+'</p>'+
      table(['域名','回答命中','引用事件'],Object.entries(g.source_details.domain_event_counts||{}).sort((a,b)=>b[1]-a[1]).map(([domain,count])=>[
        esc(domain),num(g.source_details.domain_answer_counts?.[domain]),num(count)
      ])))).join('');
}
function monitor() {
  const m=state.data.monitor;
  return '<div class="metric-grid">'+card('持续监测','未激活','尚未登记长期监测')+
    card('固定时段记录',num(m.scheduled_records),'仅登记用途的样本进入固定探针')+
    card('基线完整日',num(m.baseline_required_days),'窗口最长 '+num(m.window_max_days)+' 天')+
    card('已发送通知',num(m.notifications_sent),'当前阶段未启动通知')+'</div>'+
    panel('当前证据范围',list(m.limitations))+
    panel('分轨待核验',table(['入口 / 面板','样本','能力归属未知','来源可观测未知'],state.data.overview.groups.map(g=>[
      esc(g.surface)+' / '+esc(g.panel),num(g.count),num(g.metrics.capability.unknown),num(g.metrics.source_observable.unknown)
    ])));
}
function records() {
  const rows=state.data.records.filter(r=>!state.kind||r.kind===state.kind);
  const controls='<div class="section-heading"><h2>公开研究记录</h2><label>记录类型 <select id="record-kind"><option value="">全部</option>'+
    [...new Set(state.data.records.map(r=>r.kind))].map(k=>'<option '+(state.kind===k?'selected':'')+' value="'+esc(k)+'">'+esc(k)+'</option>').join('')+'</select></label></div>';
  if(!rows.length)return controls+'<p class="empty">当前没有获准公开的研究记录。内部记录保留在本机研究台。</p>';
  return controls+'<div class="record-grid">'+rows.map(r=>'<article class="record"><header><h3>'+esc(r.title)+'</h3><code>'+esc(r.kind)+' v'+num(r.version)+'</code></header><p>'+esc(r.summary||'公开摘要待补充')+'</p><p>'+esc(r.status||'状态待标注')+' · '+esc(r.evidence_class||'证据层级待标注')+'</p>'+
    (r.evidence_urls||[]).map((url,i)=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">公开依据 '+(i+1)+'</a>').join(' · ')+'</article>').join('')+'</div>';
}
function graph() {
  const g=state.data.graph;
  return '<div class="metric-grid">'+card('公开记录节点',num(g.nodes.length),'每个节点绑定具体记录版本')+
    card('公开关联',num(g.edges.length),'只展示两端均获准公开的关联')+'</div>'+
    (g.nodes.length?panel('记录节点',table(['记录版本','标题','类型','证据层级'],g.nodes.map(n=>[esc(n.id),esc(n.label),esc(n.kind),esc(n.evidence_class||'待标注')]))):'<p class="empty">没有获准公开的关系节点。</p>')+
    (g.edges.length?panel('证据关联',table(['起点','关系','终点'],g.edges.map(e=>[esc(e.source),esc(e.relation),esc(e.target)]))):'')+
    panel('关系边界','<p>关联依据表达证据追溯关系，不能据此认定因果或内容效果。</p>');
}
function planning() {
  const p=state.data.planning;
  return '<div class="metric-grid">'+card('执行状态','草案','计划尚未提交')+
    card('本次新增采样',num(p.sampling_requests_created),'已有数据用于研究和核验')+
    card('长期自动化',p.automation_activated?'已激活':'未激活','日程与预算需具体授权')+'</div>'+
    panel('规划边界',list(p.limitations))+
    panel('下一检查点',table(['事项','当前状态'],[['固定探针基线','待完整且可比较的长序列'],['内容效果判断','待配对台账、事实版本和同期对照'],['业务转化','待采用与转化证据'],['公开更新','按获准公开结果生成新快照并追踪发布回执']]));
}
function currentView(){const hash=location.hash.slice(1).split('?')[0];return Object.hasOwn(labels,hash)?hash:'overview'}
function render() {
  if(!state.data)return;
  const view=currentView();
  document.querySelector('#content').innerHTML=({overview,samples,monitor,records,graph,planning})[view]();
  document.querySelectorAll('nav button').forEach(b=>{const active=b.dataset.view===view;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false')});
  const search=document.querySelector('#sample-search');
  if(search){
    const updateResults=()=>{state.query=search.value;document.querySelector('#sample-results').innerHTML=sampleResults()};
    search.addEventListener('input',event=>{if(!event.isComposing)updateResults()});
    search.addEventListener('compositionend',updateResults);
  }
  document.querySelector('#record-kind')?.addEventListener('change',e=>{state.kind=e.target.value;render()});
}
async function boot() {
  try {
    const response=await fetch('public-data.json',{cache:'no-store'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    state.data=await response.json();
    if(state.data.schema_version!==1||!state.data.overview||!Array.isArray(state.data.samples))throw new Error('快照格式无效');
    document.querySelector('#data-as-of').textContent=state.data.data_as_of;
    document.querySelector('#published-at').textContent=new Date(state.data.published_at).toLocaleString('zh-CN',{hour12:false,timeZone:'Asia/Shanghai'});
    document.querySelector('#release-id').textContent=state.data.release_id;
    document.querySelector('#publication-status').textContent=['127.0.0.1','localhost'].includes(location.hostname)?'本地快照候选 · 等待公开部署':'公开快照 · 按批次更新';
    render();
  }catch(error){
    document.querySelector('#content').innerHTML='<div class="error" role="alert"><p>公开快照读取失败：'+esc(error.message)+'</p><button id="retry-load">重新加载</button></div>';
    document.querySelector('#retry-load').addEventListener('click',boot);
  }
}
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.view}));
window.addEventListener('hashchange',render);
boot();
