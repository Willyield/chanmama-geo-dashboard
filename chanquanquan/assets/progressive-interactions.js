(() => {
  'use strict';
  let restoring=false,restoreId=0,activeInfo;
  const tip=document.createElement('div');tip.id='metric-tooltip';tip.className='metric-tooltip';tip.role='tooltip';tip.hidden=true;document.body.append(tip);
  function close(){tip.hidden=true;activeInfo?.removeAttribute('aria-describedby');activeInfo=null;}
  function show(info){close();if(!info)return;activeInfo=info;info.setAttribute('aria-describedby',tip.id);tip.textContent=info.querySelector('span')?.textContent||'';tip.hidden=false;const box=info.getBoundingClientRect(),width=Math.min(280,innerWidth-24);tip.style.width=width+'px';tip.style.left=Math.max(12,Math.min(box.left,innerWidth-width-12))+'px';tip.style.top=Math.max(12,Math.min(box.bottom+8,innerHeight-tip.offsetHeight-12))+'px';}
  document.addEventListener('focusin',e=>show(e.target.closest('.info')));
  document.addEventListener('focusout',close);
  document.addEventListener('pointerover',e=>{if(e.target.closest('.info'))show(e.target.closest('.info'));});
  document.addEventListener('pointerout',e=>{const i=e.target.closest('.info');if(i&&!i.contains(e.relatedTarget))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  addEventListener('scroll',()=>{if(activeInfo&&document.activeElement===activeInfo)show(activeInfo);else close();},true);
  addEventListener('resize',close);
  function save(){
    if(restoring)return;
    const url=new URL(location);url.searchParams.set('type',currentType);
    const q=document.getElementById(CQQ_QUERY).value;
    if(q)url.searchParams.set('q',q);else url.searchParams.delete('q');
    for(const id of CQQ_FILTERS){const v=document.getElementById(id).value;if(v!=='all')url.searchParams.set(id,v);else url.searchParams.delete(id);}
    if(page>1)url.searchParams.set('page',page);else url.searchParams.delete('page');
    history.replaceState(null,'',url);
  }
  async function restore(){
    const turn=++restoreId;restoring=true;
    try{
      const url=new URL(location),idKey=CQQ_DATA_PAGE?'sampleId':'citationId';
      let type=url.searchParams.get('type'),target='';try{target=decodeURIComponent(url.hash.slice(1));}catch{}
      let record;
      if(target){
        // The tiny route map resolves deep links without downloading unrelated lists.
        const mapped=(await CQQ.load(CQQ.config.routes))[CQQ_KIND][target];if(mapped)type=mapped;
      }
      currentType=typeOrder.includes(type)?type:typeOrder[0];
      document.querySelectorAll('#type-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.type===currentType)));
      CQQ_metrics();
      const rows=await CQQ_ensure(currentType);if(turn!==restoreId)return;
      DATA[CQQ_DATA_PAGE?'samples':'citations']=rows;record=target&&rows.find(r=>r[idKey]===target);
      document.getElementById(CQQ_QUERY).value=record?'':url.searchParams.get('q')||'';
      for(const id of CQQ_FILTERS){const control=document.getElementById(id),v=record?'all':url.searchParams.get(id)||'all';control.value=[...control.options].some(o=>o.value===v)?v:'all';}
      if(CQQ_DATA_PAGE&&document.getElementById(CQQ_QUERY).value.trim())await CQQ.search(currentType);
      if(turn!==restoreId)return;
      const filteredList=CQQ_DATA_PAGE?filteredRows():filtered();
      page=record?Math.floor(filteredList.findIndex(r=>r[idKey]===target)/(CQQ_DATA_PAGE?25:50))+1:Math.max(1,Math.floor(Number(url.searchParams.get('page'))||1));
      await renderRows();if(turn!==restoreId)return;
      if(record){const row=document.getElementById(target);if(row){if(CQQ_DATA_PAGE){row.querySelector('details').open=true;await CQQ_hydrate(row.querySelector('details'));}row.scrollIntoView({block:'center'});}}
      document.documentElement.dataset.ready='true';
    }finally{if(turn===restoreId){restoring=false;save();}}
  }
  document.addEventListener('cqq:summary',()=>{restore().catch(()=>{restoring=false;renderRows();});});
  document.addEventListener('cqq:rows',()=>{
    document.querySelectorAll('.info').forEach(i=>i.setAttribute('aria-label',`${i.parentElement.childNodes[0].textContent}：${i.querySelector('span').textContent}`));save();
  });
  document.addEventListener('input',e=>{if([CQQ_QUERY,...CQQ_FILTERS].includes(e.target.id)){restoreId++;restoring=false;save();}});
  document.addEventListener('click',e=>{if(e.target.closest('#type-tabs button,#reset,#prev,#next')){restoreId++;restoring=false;history.replaceState(null,'',location.pathname+location.search);save();}});
  addEventListener('popstate',()=>restore().catch(()=>renderRows()));
  addEventListener('hashchange',()=>restore().catch(()=>renderRows()));
  CQQ_start();
})();
