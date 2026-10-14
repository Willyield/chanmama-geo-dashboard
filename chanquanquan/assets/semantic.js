(function (root) {
  'use strict';
  const definitions = [
    ['mention_rate','品牌提及率','有效回答中明确提及品牌的回答 / 全部有效回答；unknown 保留主分母。'],
    ['error_rate','错误信息率','存在至少一项证实错误的回答 / 有效回答；越低越好，待核验主张不等于错误。'],
    ['top1_rate','首推率','明确首位推荐 / 全部适用推荐回答；unknown 保留主分母。'],
    ['top3_rate','前三率','明确前三位推荐 / 全部适用推荐回答；unknown 保留主分母。'],
    ['average_rank','平均排名','明确推荐排名之和 / 有排名样本；另列排名覆盖，不以首次出现顺序代替推荐名次。'],
    ['explanation_accuracy','解释准确率','解释通过 / 解释适用回答。'],
    ['positioning_accuracy','定位准确率','定位通过 / 定位适用回答。'],
    ['advantage_completeness','适用优势项完整度','完整命中的适用机制项 / 全部适用机制项；partial 不算完整命中，项数不是答文数。'],
    ['strict_advantage_rate','严格优势表达率','符合严格优势表达的有效回答 / 全部有效回答。'],
    ['category_coverage','品类覆盖率','品类覆盖通过 / 品类覆盖适用回答。'],
    ['product_relationship','产品关系准确率','产品关系判断通过 / 产品关系适用回答。'],
    ['scenario_match','场景匹配率','场景匹配通过 / 场景匹配适用回答。'],
    ['comparison_win','对比胜出率','对比胜出 / 对比胜出适用回答。'],
    ['effective_top1_rate','有效首推率','历史补充口径：第三方工具出现的适用推荐回答中，品牌首推 / 该推荐子集。'],
    ['tool_mentioned_top1_rate','提及工具首推率','历史补充口径：冻结工具出现的适用推荐回答中，品牌首推 / 该推荐子集。'],
    ['citation_rate','引用来源率','有效答文中有可解析引用的回答 / 引用状态可判定的有效答文；另列 unknown。'],
    ['captured_citation_slot_rate','捕获引用的槽位比例','有可解析引用的回收槽位 / 全部回收槽位；unknown 保留主分母，保留异常答文对应的引用事实。'],
    ['advantage_expression_rate','优势表达率','明确归属蝉圈圈的适配性、强项、核心能力或优先推荐回答 / 完整有效回答；每答至多一次，unknown 保留分母。事实准确性另看错误明细。']
  ];
  const primary = definitions.slice(0,4).map(d=>d[0]);
  const stateKeys = definitions.map(d=>d[0]).filter(k=>!['average_rank','advantage_completeness','effective_top1_rate','tool_mentioned_top1_rate','citation_rate','captured_citation_slot_rate','advantage_expression_rate'].includes(k));
  const states = ['pass','fail','unknown','not_applicable'];
  function require(ok, message) { if (!ok) throw new Error(message); }
  function fixedRatio(n,d,digits=1) {
    if (!d) return null;
    const scale=10n**BigInt(digits), a=BigInt(n)*100n*scale,b=BigInt(d);
    const v=(a*2n+b)/(2n*b);
    return (v/scale).toString()+'.'+(v%scale).toString().padStart(digits,'0');
  }
  function ratio(values) {
    require(values.every(v=>states.includes(v)), 'Invalid audited state');
    const n=values.filter(v=>v==='pass').length,na=values.filter(v=>v==='not_applicable').length,d=values.length-na;
    return {numerator:n,denominator:d,unknown:values.filter(v=>v==='unknown').length,not_applicable:na,percentage:fixedRatio(n,d)};
  }
  function aggregate(rows, samples, options={}) {
    const byId=new Map(samples.map(s=>[s.sample_id,s]));
    require(rows.every(r=>byId.has(r.sample_id)), 'Unknown audit sample');
    const out=Object.fromEntries(stateKeys.map(k=>[k,ratio(rows.map(r=>r.metrics[k].final.state))]));
    const ranks=rows.map(r=>r.rank.final.value).filter(v=>v!==null),sum=ranks.reduce((n,v)=>n+v,0),d=out.top1_rate.denominator;
    out.average_rank={rank_sum:sum,ranked_samples:ranks.length,denominator:ranks.length,applicable_answers:d,unknown:out.top1_rate.unknown,value:ranks.length?(sum/ranks.length).toFixed(2):null,coverage_percentage:fixedRatio(ranks.length,d)};
    const mapping={hit:'pass',missing:'fail',partial:'fail',unknown:'unknown'},items=rows.flatMap(r=>r.advantages);
    out.advantage_completeness=ratio(items.map(a=>mapping[a.final.state]));
    out.advantage_completeness.items=Object.fromEntries([...new Set(items.map(a=>a.item_id))].sort().map(id=>[id,ratio(items.filter(a=>a.item_id===id).map(a=>mapping[a.final.state]))]));
    for(const [k,presence] of options.supplementary===false?[]:[['effective_top1_rate','third_party_tools'],['tool_mentioned_top1_rate','listed_tools']]){
      const subset=rows.filter(r=>r.metrics.top1_rate.final.state!=='not_applicable'&&r.tool_presence.final[presence].length);
      out[k]=ratio(subset.map(r=>{const f=r.legacy_recommendation.final;const rank=Object.hasOwn(f,'rank')?f.rank:f.value;return rank===1?'pass':f.state==='unknown'?'unknown':'fail';}));
    }
    const cited=rows.map(r=>byId.get(r.sample_id).citation_state);
    out.citation_rate=ratio(cited.filter(v=>v!=='unknown'));out.citation_rate.unknown=cited.filter(v=>v==='unknown').length;
    out.sample_count=rows.length;
    out.advantage_expression_rate={...out.strict_advantage_rate};
    return out;
  }
  function validateMetric(k,m) {
    require(m&&typeof m==='object','Missing metric: '+k);
    if(k==='average_rank'){
      require(Number.isFinite(m.rank_sum)&&m.rank_sum>=0,'Invalid rank sum');
      require(Number.isInteger(m.ranked_samples)&&m.ranked_samples>=0&&m.ranked_samples<=m.applicable_answers,'Invalid ranked coverage');
      require(m.value===null&&!m.ranked_samples || m.value!==null&&Number.isFinite(Number(m.value))&&Number(m.value)>=1&&m.ranked_samples>0,'Invalid average rank');
      require(m.coverage_percentage===fixedRatio(m.ranked_samples,m.applicable_answers),'Rank coverage mismatch');
    }else{
      for(const field of ['numerator','denominator','unknown','not_applicable'])require(Number.isInteger(m[field])&&m[field]>=0,'Invalid '+k+'/'+field);
      require(m.numerator<=m.denominator,'Numerator exceeds denominator');
      require(m.percentage===fixedRatio(m.numerator,m.denominator),'Metric percentage mismatch: '+k);
    }
  }
  function validateMetrics(data) {
    require(data.semantic_analysis_complete===true&&data.main_comparison_pairs===730,'Final semantic gate not satisfied');
    for(const n of [1,2]){
      const r=data.rounds?.['round'+n];
      require(r&&r.remaining===0&&r.verified_complete_audits+r.quality_checked_invalid_answers===730,'Incomplete round audit');
      for(const [k] of definitions)validateMetric(k,r.metrics[k]);
      require(r.metrics.sample_count===r.verified_complete_audits,'Valid answer count mismatch');
      for(const dimension of ['category','pool','sample_date']){
        require(r.groups?.[dimension]&&typeof r.groups[dimension]==='object','Missing frozen grouping');
        for(const scope of Object.values(r.groups[dimension]))for(const [k] of definitions.filter(d=>d[0]!=='captured_citation_slot_rate'))validateMetric(k,scope[k]);
      }
      require(r.questions&&Object.keys(r.questions).length===165,'Incomplete question summaries');
      for(const scope of Object.values(r.questions))for(const [k] of definitions.filter(d=>d[0]!=='captured_citation_slot_rate'))validateMetric(k,scope[k]);
    }
    return data;
  }
  function value(k,m) {
    if(!m)return '待完成审计';
    if(k==='average_rank')return m.value===null?'无可计算明示排名':Number(m.value).toFixed(2);
    return m.percentage===null?'不适用':Number(m.percentage).toFixed(1)+'%';
  }
  function scopeKey(category='',pool='',date='') { return JSON.stringify([category==='全部'?'':category,pool,date]); }
  const api={definitions,primary,stateKeys,states,fixedRatio,ratio,aggregate,validateMetrics,validateMetric,value,scopeKey};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CQQSemantic=api;
})(typeof globalThis!=='undefined'?globalThis:this);
