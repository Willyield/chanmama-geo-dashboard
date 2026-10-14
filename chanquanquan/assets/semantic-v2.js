(function(root){
  'use strict';
  const definitions=[['mention_rate','品牌提及率'],['error_rate','错误信息率'],['top1_rate','首推率'],['top3_rate','前三率'],['average_rank','平均排名'],['explanation_accuracy','品牌解释准确率'],['positioning_accuracy','品牌定位准确率'],['advantage_expression_rate','优势表达率'],['category_coverage','品类覆盖率'],['product_relationship','产品关系识别率'],['scenario_match','场景匹配率'],['comparison_win','对比胜率'],['effective_top1_rate','有效首推率'],['tool_mentioned_top1_rate','工具提及时首推率'],['citation_rate','引用来源率'],['competition_share','竞争份额'],['advantage_completeness','适用优势项完整度']];
  const stateKeys=definitions.map(d=>d[0]).filter(k=>!['average_rank','competition_share','advantage_completeness'].includes(k));
  const primary=['mention_rate','advantage_expression_rate','error_rate','top1_rate'],states=['pass','fail','unknown','not_applicable'];
  function require(ok,message){if(!ok)throw new Error(message);}
  function roundedFraction(n,d,digits=1){
    if(!d)return null;let a=BigInt(n),b=BigInt(d);const negative=a<0n;a=negative?-a:a;
    const scale=10n**BigInt(digits),v=(a*scale*2n+b)/(b*2n);
    return (negative&&v?'-':'')+(v/scale)+'.'+(v%scale).toString().padStart(digits,'0');
  }
  const fixedRatio=(n,d,digits=1)=>roundedFraction(BigInt(n)*100n,d,digits);
  function difference(k,a,b){
    if(k==='average_rank')return a.ranked_samples&&b.ranked_samples?roundedFraction(BigInt(b.rank_sum)*BigInt(a.ranked_samples)-BigInt(a.rank_sum)*BigInt(b.ranked_samples),BigInt(a.ranked_samples)*BigInt(b.ranked_samples),2):null;
    return a.denominator&&b.denominator?roundedFraction((BigInt(b.numerator)*BigInt(a.denominator)-BigInt(a.numerator)*BigInt(b.denominator))*100n,BigInt(a.denominator)*BigInt(b.denominator)):null;
  }
  function ratio(values,knownOnly=false){
    require(values.every(v=>states.includes(v)),'Invalid v2 state');const count=s=>values.filter(v=>v===s).length;
    const n=count('pass'),unknown=count('unknown'),fail=count('fail'),na=count('not_applicable'),d=n+fail+(knownOnly?0:unknown);
    return {numerator:n,denominator:d,percentage:fixedRatio(n,d),unknown,fail,pending:0,not_applicable:na,status:d?'complete':knownOnly&&unknown?'unobservable':'not_applicable'};
  }
  function aggregate(rows){
    const out=Object.fromEntries(stateKeys.map(k=>[k,ratio(rows.map(r=>r.metrics[k].state),k==='citation_rate')]));
    for(const k of ['effective_top1_rate','tool_mentioned_top1_rate'])out[k]=ratio(rows.map(r=>r.metrics[k].state).filter(s=>s!=='not_applicable'));
    const ranks=rows.map(r=>r.rank).filter(v=>v!==null),sum=ranks.reduce((n,v)=>n+v,0),d=out.top1_rate.denominator;
    out.average_rank={value:ranks.length?roundedFraction(sum,ranks.length,2):null,rank_sum:sum,ranked_samples:ranks.length,denominator:ranks.length,applicable_answers:d,coverage_percentage:fixedRatio(ranks.length,d),status:ranks.length?'complete':'no_observations'};
    const events={};for(const r of rows)for(const tool of r.third_party_events)events[tool]=(events[tool]||0)+1;
    const total=Object.values(events).reduce((n,v)=>n+v,0);out.competition_share={numerator:events['蝉圈圈']||0,denominator:total,percentage:fixedRatio(events['蝉圈圈']||0,total),status:total?'complete':'not_applicable',unit:'同答同候选一次的提及事件',candidate_events:events};
    const mapping={hit:'pass',missing:'fail',partial:'fail',unknown:'unknown'},items=rows.flatMap(r=>r.advantage_items);
    out.advantage_completeness=ratio(items.map(a=>mapping[a.final.state]));out.sample_count=rows.length;return out;
  }
  function validateMetric(k,m){
    require(m&&typeof m==='object','Missing v2 metric: '+k);
    if(k==='average_rank'){require(m.ranked_samples===m.denominator,'Rank sample mismatch');require(m.value===(m.ranked_samples?roundedFraction(m.rank_sum,m.ranked_samples,2):null),'Rank value mismatch');}
    else{require(Number.isInteger(m.numerator)&&Number.isInteger(m.denominator)&&m.numerator>=0&&m.numerator<=m.denominator,'Invalid counts: '+k);require(m.percentage===fixedRatio(m.numerator,m.denominator),'Ratio mismatch: '+k);}
  }
  function validateMetrics(data){
    require(data.standard_id==='CQQ-METRICS-2.0'&&data.semantic_analysis_complete&&data.main_comparison_pairs===730,'v2 result gate');
    for(const n of [1,2]){const r=data.rounds['round'+n];require(r.valid_answers+r.quality_findings.length===730,'v2 coverage');for(const [k] of definitions)validateMetric(k,r.metrics[k]);}return data;
  }
  function value(k,m){if(!m)return '数据未提供';if(k==='average_rank')return m.value===null?'无明确排名':m.value;return m.percentage===null?(m.status==='unobservable'?'引用状态待核验':'不适用'):m.percentage+'%';}
  const scopeKey=(category='',pool='',date='')=>JSON.stringify([category==='全部'?'':category,pool,date]);
  const api={definitions,primary,stateKeys,states,fixedRatio,roundedFraction,difference,ratio,aggregate,validateMetrics,validateMetric,value,scopeKey};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CQQSemantic=api;
})(typeof window==='undefined'?globalThis:window);
