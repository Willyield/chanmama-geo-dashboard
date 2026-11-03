/* One answer projection feeds cards, filters, comparisons and exports. */
(function(root){
  'use strict';
  const brands=['蝉镜','剪映','开拍','闪剪','即梦','飞影','筷子科技','腾讯智影','硅基智能'];
  const groups={'字节系':['剪映','即梦'],'其余七款':brands.filter(b=>!['剪映','即梦'].includes(b))};
  const any=vs=>vs.includes('true')?'true':vs.includes('not_reviewed')?'not_reviewed':vs.includes('unknown')?'unknown':vs.length&&vs.every(v=>v==='not_applicable')?'not_applicable':'false';
  const rate=vs=>{const es=vs.filter(v=>v!=='not_applicable'),d=es.length,n=es.filter(v=>v==='true').length,u=es.filter(v=>v==='unknown'||v==='not_reviewed').length;return {numerator:n,denominator:d,unknown:u,not_reviewed:es.filter(v=>v==='not_reviewed').length,value:d&&!u?n/d:null,lower:d?n/d:null,upper:d?(n+u)/d:null,status:d?(u?'partial':'complete'):'not_applicable'};};
  function setup(p){
    const byId=new Map(p.answers.map(r=>[r.sample_id,r])),qs=new Map(p.questions.map(q=>[q.question_id,q]));
    const fs=new Map(p.features.map(d=>[d.sample_id+'|'+d.feature,d.decision]));
    const cs=new Map(p.comparisons.map(d=>[d.sample_id+'|'+d.brand,d.decision]));
    function calculate(key,ids,name='蝉镜'){
      const rs=ids.map(id=>byId.get(id)).filter(Boolean),members=groups[name]||[name];
      const state=(r,k)=>any(members.map(b=>r.brands[b][k]));
      const rec=rs.filter(r=>qs.get(r.question_id).recommendation);
      if(['mention','advantage','position','scene'].includes(key))return rate(rs.map(r=>state(r,key)));
      if(['first','top3'].includes(key))return rate(rec.map(r=>state(r,key)));
      if(key==='category')return rate(rs.filter(r=>qs.get(r.question_id).category_discovery).map(r=>state(r,'mention')));
      if(key==='relation')return {...rate([]),reason:'题池没有产品公司或生态关系问题'};
      if(key==='citation')return rate(rs.map(r=>r.capture==='not_exposed'?'unknown':r.capture==='captured'?'true':'false'));
      if(key==='rank'){
        const ns=rec.map(r=>members.map(b=>r.brands[b].rank).filter(v=>v!==null&&v!==undefined)).filter(v=>v.length).map(v=>Math.min(...v));
        return {kind:'rank',numerator:ns.reduce((a,b)=>a+b,0),denominator:ns.length,unknown:rec.filter(r=>['true','unknown'].includes(state(r,'mention'))).length-ns.length,value:ns.length?ns.reduce((a,b)=>a+b,0)/ns.length:null};
      }
      if(['error','explanation'].includes(key)){
        const values=rs.filter(r=>state(r,'fact_claim_present')==='true').map(r=>{
          const vs=members.filter(b=>['true','unknown','not_reviewed'].includes(r.brands[b].fact_claim_present)).map(b=>r.brands[b].fact_claim_present==='true'?r.brands[b][key]:r.brands[b].fact_claim_present);
          return key==='error'?any(vs):vs.includes('false')?'false':vs.includes('not_reviewed')?'not_reviewed':vs.includes('unknown')?'unknown':'true';
        });
        return {...rate(values),applicability_unknown:rs.filter(r=>state(r,'fact_claim_present')==='unknown').length};
      }
      if(['effectiveFirst','toolFirst'].includes(key)){
        const gate=key==='effectiveFirst'?groups['其余七款']:brands;
        const yes=rec.filter(r=>any(gate.map(b=>r.brands[b].mention))==='true'),u=rec.filter(r=>any(gate.map(b=>r.brands[b].mention))==='unknown').length;
        return {...rate(yes.map(r=>state(r,'first'))),applicability_unknown:u,...(u?{value:null,status:'partial',lower:0,upper:1}:{})};
      }
      if(key==='share'){
        let total=0,tu=0,n=0,u=0;
        for(const r of rs)for(const b of brands){const v=r.brands[b].mention;if(v==='true'){total++;if(members.includes(b))n++;}if(v==='unknown'){tu++;if(members.includes(b))u++;}}
        return tu?{kind:'share_variable',numerator:n,numerator_unknown:u,denominator:total,denominator_unknown:tu,unknown:u,value:null,lower:total+tu-u?n/(total+tu-u):0,upper:total+u?(n+u)/(total+u):0,status:'partial'}:{numerator:n,denominator:total,unknown:0,value:total?n/total:null,status:total?'complete':'not_applicable'};
      }
      if(key==='win'){
        const vs=[];
        for(const r of rs){const q=qs.get(r.question_id),bs=members.filter(b=>q.named_brands.includes(b));if(!q.direct_product_comparison||!bs.length)continue;const ds=bs.map(b=>cs.get(r.sample_id+'|'+b));vs.push(ds.includes('true')?'true':ds.includes('conditional_split')?'conditional_split':any(ds));}
        return {...rate(vs),conditional_split:vs.filter(v=>v==='conditional_split').length};
      }
      if(key==='completeness'){
        if(name!=='蝉镜')return {...rate([]),reason:'本项目基础能力目录只为蝉镜建立'};
        return rate(rs.flatMap(r=>qs.get(r.question_id).applicable_advantages.map(f=>fs.get(r.sample_id+'|'+f)||(r.brands['蝉镜'].mention==='false'?'false':'not_reviewed'))));
      }
      throw Error('Unknown metric '+key);
    }
    return {calculate,byId,brands,groups,definitions:p.definitions,requirements:p.supplement_requirements||{metrics:{},items:[]}};
  }
  const percentage=v=>(v*100).toFixed(2)+'%';
  function display(m,requirement){
    const needed=requirement&&((m.unknown||0)>0||(m.denominator_unknown||0)>0||(m.applicability_unknown||0)>0)?'；需补：'+requirement.info:'';
    if(m.kind==='rank')return {value:m.value===null?'缺整体推荐次序':m.value.toFixed(2)+'名',count:m.denominator+'条明确名次',note:'另'+m.unknown+'条无整体次序；只代表可判子集'+needed,raw:m};
    if(m.status==='not_applicable')return {value:'不适用',count:'0条适用记录',note:m.reason||'当前筛选范围没有适用回答',raw:m};
    const count=m.numerator+' / '+m.denominator+(m.kind==='share_variable'?'次品牌事件':'条适用记录');
    const unknown=m.unknown||0;
    return {value:m.value!==null?percentage(m.value):m.not_reviewed?'未计算':m.kind==='share_variable'||unknown<m.denominator?percentage(m.lower)+'–'+percentage(m.upper):requirement?.label||'待补判定依据',count,
      note:[m.not_reviewed?'尚有'+m.not_reviewed+'条未完成核查':unknown?'已确认'+m.numerator+'条，另'+unknown+'条待补依据':'当前范围已复算',m.denominator_unknown?'分母另有'+m.denominator_unknown+'次实体归属待定':'',m.applicability_unknown?'另'+m.applicability_unknown+'条适用性待定':'',m.conditional_split?'各有所长'+m.conditional_split+'条':''].filter(Boolean).join('；')+needed,raw:m};
  }
  function delta(a,b,requirement){
    if(a.status==='not_applicable'||b.status==='not_applicable')return '不适用';
    if(a.value===null||b.value===null)return requirement?.label||'待补判定依据';
    if(a.kind==='rank')return (b.value-a.value>0?'下降':b.value-a.value<0?'上升':'持平')+Math.abs(b.value-a.value).toFixed(2)+'位（可判子集）';
    return a.value===0?(b.value===0?'0%':'不适用*'):((b.value/a.value-1)>=0?'+':'')+percentage(b.value/a.value-1);
  }
  const api={setup,display,delta};root.CJMetrics=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
