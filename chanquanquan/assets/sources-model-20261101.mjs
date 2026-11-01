// Frozen citation events drive every projection. No new URL normalization.
export const scopeLabel=value=>({official_main_site:'已确认主站 www.kolkoc.com',other_source:'其他来源（所有权未全核）',unknown:'缺有效网址（归属未知）'})[value]||'归属未知';
export const views={answers:'回答引用',domains:'全部域名',urls:'逐网址引用',questions:'引用问题',unknown:'未知网址卡',changes:'跨轮来源'};
const contains=(value,term)=>String(value??'').toLocaleLowerCase().includes(String(term||'').toLocaleLowerCase());
export function selection(answers,sources,state,{all=false,round}={}){
 const selected=answers.filter(a=>(!round?state.round==='all'||String(a.round)===(state.round||'3'):a.round===Number(round))&&(!state.tracePair||state.tracePair.split('-').includes(String(a.round)))&&(all||(!state.category||a.category===state.category)&&(!state.pool||a.pool===state.pool)&&(!state.date||a.sample_date===state.date)&&(!state.repeat||String(a.repeat_index)===state.repeat)&&(!state.q||contains(a.question_text,state.q))));
 const ids=new Set(selected.map(a=>a.answer_id)),events=[],unknown=[];
 for(const s of sources){for(const e of s.events){if(!ids.has(e.answer_id))continue;if(!all&&((state.scope&&e.site_scope!==state.scope)||(state.domain&&e.domain!==state.domain)||(state.entity&&(state.entityKind==='domain'?e.domain:e.normalized_url)!==state.entity)||state.query&&!contains(e.normalized_url+' '+e.domain+' '+e.cards.map(c=>c.title).join(' '),state.query)))continue;events.push(e);}
 for(const c of s.unknown_cards){if(!ids.has(c.answer_id))continue;if(!all&&((state.scope&&state.scope!=='unknown')||state.domain||state.entity||state.query&&!contains(c.title,state.query)))continue;unknown.push(c);}}
 const narrowed=!all&&(state.scope||state.domain||state.entity||state.query);const hit=new Set([...events,...unknown].map(e=>e.answer_id));
 return{answers:narrowed?selected.filter(a=>hit.has(a.answer_id)):selected,events,unknown};
}
export function aggregate(events,kind){
 const map=new Map();for(const e of events){const key=kind==='domains'?e.domain:e.normalized_url;let row=map.get(key);if(!row){row={key,domain:e.domain,site_scope:e.site_scope,events:0,raw_cards:0,answers:new Set(),questions:new Set(),event_ids:[],sample:e};map.set(key,row);}row.events++;row.raw_cards+=e.cards.length;row.answers.add(e.answer_id);row.event_ids.push(e.event_id);}
 let rank=0,lastEvents;return [...map.values()].sort((a,b)=>b.events-a.events||a.key.localeCompare(b.key,'en')).map((a,i)=>{if(a.events!==lastEvents){rank=i+1;lastEvents=a.events;}return{...a,rank,answer_count:a.answers.size};});
}
export function project(answers,sources,state,{all=false}={}){
 const selected=selection(answers,sources,state,{all}),byId=new Map(answers.map(a=>[a.answer_id,a]));
 const eventMap=new Map(),unknownMap=new Map();for(const e of selected.events){if(!eventMap.has(e.answer_id))eventMap.set(e.answer_id,[]);eventMap.get(e.answer_id).push(e);}for(const c of selected.unknown){if(!unknownMap.has(c.answer_id))unknownMap.set(c.answer_id,[]);unknownMap.get(c.answer_id).push(c);}
 let rows=[];const view=state.view||'domains';
 if(view==='domains'||view==='urls'){rows=aggregate(selected.events,view);for(const row of rows)row.question_count=new Set([...row.answers].map(id=>byId.get(id).question_id)).size;}
 else if(view==='answers')rows=selected.answers.map(a=>({key:a.answer_id,answer:a,events:eventMap.get(a.answer_id)?.length||0,unknown:unknownMap.get(a.answer_id)?.length||0,raw_cards:(eventMap.get(a.answer_id)||[]).reduce((n,e)=>n+e.cards.length,0)+(unknownMap.get(a.answer_id)?.length||0)}));
 else if(view==='unknown')rows=selected.unknown.map(c=>({key:c.card_id,card:c,answer:byId.get(c.answer_id)}));
 else if(view==='questions'){const groups=new Map();for(const a of selected.answers){let row=groups.get(a.question_id);if(!row){row={key:a.question_id,question:a.question_text,records:[],events:0,unknown:0};groups.set(a.question_id,row);}row.records.push(a);row.events+=eventMap.get(a.answer_id)?.length||0;row.unknown+=unknownMap.get(a.answer_id)?.length||0;}rows=[...groups.values()];}
 else if(view==='changes'){
  const [from,to]=(state.pair||'2-3').split('-').map(Number),kind=state.kind==='urls'?'urls':'domains';
  const a=selection(answers,sources,{...state,round:String(from)},{all,round:from}),b=selection(answers,sources,{...state,round:String(to)},{all,round:to});
  const first=new Map(aggregate(a.events,kind).map(r=>[r.key,r])),last=new Map(aggregate(b.events,kind).map(r=>[r.key,r]));
  rows=[...new Set([...first.keys(),...last.keys()])].map(key=>{const f=first.get(key),t=last.get(key),fv=f?.events||0,tv=t?.events||0;return{key,domain:(t||f).domain,site_scope:(t||f).site_scope,from_events:fv,to_events:tv,events:tv,delta:tv-fv,from_rank:f?.rank??null,to_rank:t?.rank??null,rank_improvement:f&&t?f.rank-t.rank:null,share_delta_pp:a.events.length&&b.events.length?100*(tv/b.events.length-fv/a.events.length):null,state:f&&t?'retained':t?'added':'disappeared'};});
  if(!all&&state.changeState)rows=rows.filter(r=>r.state===state.changeState);
  selected.denominators={from:a.events.length,to:b.events.length};
  selected.events=[...a.events,...b.events];selected.unknown=[...a.unknown,...b.unknown];selected.answers=[...a.answers,...b.answers];
 }
 const sort=state.sort||'events',name=r=>r.question||r.answer?.question_text||r.key;rows.sort((a,b)=>sort==='name'?String(name(a)).localeCompare(String(name(b)),'zh-CN')||String(a.key).localeCompare(String(b.key),'en'):sort==='delta'?(b.delta||0)-(a.delta||0)||String(a.key).localeCompare(String(b.key),'en'):(b.events||0)-(a.events||0)||String(a.key).localeCompare(String(b.key),'en'));
 return{...selected,rows,view,byId,eventMap,unknownMap};
}
export const pct=(n,d)=>d?(100*n/d).toFixed(2)+'%':'不适用（分母0）';
export const pp=n=>n===null?'不适用（分母0）':(Math.abs(n)<0.005?'0.00':n>0?'+'+n.toFixed(2):n.toFixed(2))+'个百分点';
export const csvCell=value=>{let text=String(value??'');if(typeof value!=='number'&&/^[\s]*[=+@-]/u.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
export const csv=(headers,rows)=>'\uFEFF'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');
export function exportRows(p){
 if(['domains','urls'].includes(p.view))return{headers:['当前范围排名',p.view==='domains'?'域名':'完整网址','归属范围','有效引用事件','事件占比','原始卡','命中回答','命中问题'],rows:p.rows.map(r=>[r.rank,r.key,scopeLabel(r.site_scope),r.events,pct(r.events,p.events.length),r.raw_cards,r.answer_count,r.question_count])};
 if(p.view==='changes')return{headers:['来源','归属范围','变化','旧轮事件','新轮事件','事件变化','事件占比变化（百分点）','旧轮排名','新轮排名','排名提升'],rows:p.rows.map(r=>[r.key,scopeLabel(r.site_scope),r.state,r.from_events,r.to_events,r.delta,r.share_delta_pp,r.from_rank,r.to_rank,r.rank_improvement])};
 if(p.view==='answers')return{headers:['轮次','日期','次数','题目','有效性','有效引用事件','缺URL卡','原始卡','原答链接'],rows:p.rows.map(r=>[r.answer.round,r.answer.sample_date,r.answer.repeat_index,r.answer.question_text,r.answer.answer_validity,r.events,r.unknown,r.raw_cards,r.answer.answer_link])};
 if(p.view==='unknown')return{headers:['轮次','日期','题目','卡序号','标题','原始网址','归属','原答链接'],rows:p.rows.map(r=>[r.answer.round,r.answer.sample_date,r.answer.question_text,r.card.card_position,r.card.title,r.card.url,scopeLabel('unknown'),r.answer.answer_link])};
 return{headers:['题目','命中回答','有效引用事件','缺URL卡','原答链接'],rows:p.rows.map(r=>[r.question,r.records.length,r.events,r.unknown,r.records.map(a=>a.answer_link).join('\n')])};
}
