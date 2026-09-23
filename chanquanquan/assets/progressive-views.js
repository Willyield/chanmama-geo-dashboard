/* Summary and list lifecycles are independent; stale list responses never replace a newer filter. */
const CQQ_DATA_PAGE = document.body.classList.contains('page-data');
const CQQ_KIND = CQQ_DATA_PAGE ? 'data' : 'citation';
const CQQ_BODY = CQQ_DATA_PAGE ? 'sample-body' : 'citation-body';
const CQQ_QUERY = CQQ_DATA_PAGE ? 'sample-search' : 'citation-search';
const CQQ_FILTERS = CQQ_DATA_PAGE ? ['decision-filter'] : ['source-filter','quality-filter'];
const CQQ_renderRows = renderRows;
const CQQ_RENDER_METRICS = CQQ_DATA_PAGE ? renderMetrics : renderSummary;
const CQQ_GROUPS = new Map();
let CQQ_generation = 0;
function CQQ_metrics() {
  CQQ_RENDER_METRICS();
  if (!CQQ_DATA_PAGE) {
    document.getElementById('metric-grid').insertAdjacentHTML('beforeend',card('蝉圈圈官方 URL','54','全轮次基线','全轮次冻结包中的官方来源 URL 数量；不随类型或列表筛选变化。'));
    let note=document.getElementById('citation-scope-note');
    if(!note){note=document.createElement('p');note.id='citation-scope-note';note.className='metric-scope-note';document.getElementById('metric-grid').before(note);}
    note.textContent='指标按问题类型展示；“全轮次基线”不随类型切换，列表筛选不改变指标。未知不等于 0。';
  }
  document.documentElement.dataset.kpiReady='true';
}
async function CQQ_ensure(type) {
  if(!CQQ_GROUPS.has(type)) CQQ_GROUPS.set(type,await CQQ.list(CQQ_KIND,type));
  return CQQ_GROUPS.get(type);
}
renderRows = async function() {
  const generation=++CQQ_generation,type=currentType,body=document.getElementById(CQQ_BODY);
  body.setAttribute('aria-busy','true');
  document.getElementById('prev').disabled=true;document.getElementById('next').disabled=true;
  if(!CQQ_GROUPS.has(type)) body.innerHTML='<tr><td colspan="4" class="empty" role="status">正在加载列表…</td></tr>';
  try{
    const rows=await CQQ_ensure(type);
    if(CQQ_DATA_PAGE && document.getElementById(CQQ_QUERY).value.trim()) await CQQ.search(type);
    if(generation!==CQQ_generation)return;
    DATA[CQQ_DATA_PAGE?'samples':'citations']=rows;
    CQQ_renderRows();body.removeAttribute('aria-busy');
    document.documentElement.dataset.listReady=type;
    document.dispatchEvent(new Event('cqq:rows'));
  }catch(error){
    if(generation!==CQQ_generation)return;
    body.removeAttribute('aria-busy');body.innerHTML='<tr><td colspan="4" class="empty">列表加载失败。<button type="button" id="retry-list">重试加载</button></td></tr>';
    document.getElementById('retry-list').onclick=()=>renderRows();
  }
};
setType = async function(type) {
  currentType=type;page=1;
  document.querySelectorAll('#type-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.type===type)));
  const url=new URL(location);url.searchParams.set('type',type);history.replaceState(null,'',url);
  CQQ_metrics();await renderRows();
};
async function CQQ_hydrate(details){
  if(!details.open||details.dataset.loaded==='true'||details.dataset.loading==='true')return;
  details.dataset.loading='true';const div=details.querySelector('div');div.textContent='正在加载原回答…';
  try{const answer=await CQQ.answer(details.closest('tr').id);div.textContent=answer;details.dataset.loaded='true';}
  catch(error){div.textContent='原回答加载失败。';const retry=document.createElement('button');retry.textContent='重试加载';retry.onclick=()=>CQQ_hydrate(details);div.append(retry);}
  finally{delete details.dataset.loading;}
}
document.addEventListener('toggle',e=>{if(CQQ_DATA_PAGE&&e.target.matches('td.answer details'))CQQ_hydrate(e.target);},true);
async function CQQ_start(){
  try{
    const summary=await CQQ.load(CQQ.config.summary);CQQ.summary=summary;DATA={...summary[CQQ_KIND],[CQQ_DATA_PAGE?'samples':'citations']:[]};
    const requested=new URLSearchParams(location.search).get('type');if(typeOrder.includes(requested))currentType=requested;
    const tabs=document.getElementById('type-tabs');tabs.innerHTML=typeOrder.map(type=>`<button type="button" data-type="${type}" aria-pressed="${type===currentType}">${type}</button>`).join('');
    tabs.addEventListener('click',e=>{const b=e.target.closest('button');if(b)setType(b.dataset.type);});
    if(!CQQ_DATA_PAGE)for(const item of DATA.sourceTypes){const option=document.createElement('option');option.value=item.name;option.textContent=sourceLabels[item.name]||item.name;document.getElementById('source-filter').append(option);}
    for(const id of [CQQ_QUERY,...CQQ_FILTERS])document.getElementById(id).addEventListener('input',()=>{page=1;renderRows();});
    document.getElementById('reset').addEventListener('click',()=>{document.getElementById(CQQ_QUERY).value='';CQQ_FILTERS.forEach(id=>document.getElementById(id).value='all');page=1;renderRows();});
    document.getElementById('prev').onclick=()=>{page--;renderRows();};document.getElementById('next').onclick=()=>{page++;renderRows();};
    CQQ_metrics();document.dispatchEvent(new Event('cqq:summary'));
  }catch(error){document.getElementById(CQQ_BODY).innerHTML='<tr><td colspan="4" class="empty">摘要加载失败，请刷新。</td></tr>';}
}
