(() => {
  const host=document.getElementById('verified-social-accounts');
  if(!host)return;
  const n=x=>x==null?'待核验':Number(x).toLocaleString('zh-CN');
  const p=x=>x==null?'待核验':Number(x).toFixed(2)+'%';
  fetch(new URL('./verified-social-accounts.json',document.currentScript.src)).then(r=>{
    if(!r.ok)throw Error('Verified social HTTP '+r.status);return r.json();
  }).then(data=>{
    const body=document.getElementById('verified-social-body');body.replaceChildren();
    for(const x of data.accounts){
      const tr=document.createElement('tr');tr.dataset.accountId=x.account_id;tr.dataset.verified=String(x.verified);
      function cell(primary,secondary='',numeric=false){const td=document.createElement('td');if(numeric)td.className='numeric';const strong=document.createElement('strong');strong.textContent=primary;td.append(strong);if(secondary){const small=document.createElement('small');small.textContent=secondary;td.append(small);}tr.append(td);}
      cell(x.name,x.platform+(x.account_id?' · '+x.account_id:''));
      for(const round of ['round3','round4']){const t=x[round];cell(n(t.events),t.works==null?'作品数待核验':n(t.works)+' 个被引作品',true);cell(p(t.sample_rate_pct),t.answers==null?'样本覆盖待核验':n(t.answers)+' / 576',true);cell(p(t.question_rate_pct),t.questions==null?'问题覆盖待核验':n(t.questions)+' / 96',true);}
      cell(x.verified?'作者 ID 已确认':'归属待核验',x.note);body.append(tr);
    }
    host.dataset.status='ready';document.getElementById('verified-social-status').textContent='7 个账号身份已确认 · 4 个登记对象仍缺账号证据';
  }).catch(e=>{host.dataset.status='error';document.getElementById('verified-social-status').textContent='账号证据加载失败；缺失不等于 0';console.error(e);});
})();
