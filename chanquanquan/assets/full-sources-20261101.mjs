import {views,scopeLabel,project,pct,pp,csv,exportRows} from './sources-model-20261101.mjs';
let generation=0,active;const cache=new Map();
export const dispose=()=>{generation++;active?.abort();active=undefined;};
const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
const link=(text,href,attrs={})=>el('a',text,{href,...attrs});
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
// Cache only verified completed values. Aborted/failed requests never share a promise
// with a newer route, so a late failure cannot remove a newer successful entry.
async function get(root,file,manifest,session){
 const url=new URL('citations/20261101/'+file,root).href,entry=manifest?.files.find(e=>e.path===file),key=url+'|'+(entry?.sha256||'manifest');
 session.signal.throwIfAborted();
 if(cache.has(key)){session.report(file,entry?.bytes||0,entry?.bytes||0,true);return cache.get(key);}
 const controller=new AbortController(),abort=()=>controller.abort(session.signal.reason);
 session.signal.addEventListener('abort',abort,{once:true});
 // Allow the measured 33s/76s transfers without allowing a hung request forever.
 // 60s for initial response, 45s without a chunk, 120..360s total by frozen size.
 const limit=Math.min(360000,Math.max(120000,60000+(entry?.bytes||0)/32768*1000));
 let idle,total,reader,complete=false,loaded=0;
 const timeout=message=>controller.abort(new Error(file+' '+message));
 const armIdle=ms=>{clearTimeout(idle);idle=setTimeout(()=>timeout('连接或传输长时间无进展，请重试'),ms);};
 total=setTimeout(()=>timeout('已达到本次读取时限，请重试'),limit);armIdle(60000);session.report(file,0,entry?.bytes||0,false);
 try{
  const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error(file+' HTTP '+r.status);
  reader=r.body.getReader();const chunks=[];armIdle(45000);
  while(true){const {done,value}=await reader.read();if(done)break;controller.signal.throwIfAborted();loaded+=value.byteLength;
   // Enforce the frozen length while streaming, before allocating a combined buffer.
   if(loaded>(entry?.bytes||1048576))throw Error(file+' 文件长度超出冻结清单');
   chunks.push(value);armIdle(45000);session.report(file,loaded,entry?.bytes||0,false);
  }
  clearTimeout(idle);controller.signal.throwIfAborted();const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  if(entry&&(bytes.byteLength!==entry.bytes||await digest(bytes)!==entry.sha256))throw Error(file+' 文件校验不一致');
  const value=JSON.parse(new TextDecoder().decode(bytes));controller.signal.throwIfAborted();session.signal.throwIfAborted();cache.set(key,value);complete=true;session.report(file,loaded,entry?.bytes||loaded,true);return value;
 }catch(e){throw controller.signal.aborted?controller.signal.reason:e;}
 finally{clearTimeout(idle);clearTimeout(total);session.signal.removeEventListener('abort',abort);if(reader){if(!complete)await reader.cancel().catch(()=>{});reader.releaseLock();}}
}
function parse(route){const p=new URLSearchParams(route);const s=Object.fromEntries(p);s.view=views[s.view]?s.view:'domains';s.round=['1','2','3','all'].includes(s.round)?s.round:'3';s.pair=['1-2','2-3','1-3'].includes(s.pair)?s.pair:'2-3';s.kind=s.kind==='urls'?'urls':'domains';s.sort=(s.view==='changes'?['events','name','delta']:['events','name']).includes(s.sort)?s.sort:'events';s.size=[10,25,50,100].includes(Number(s.size))?Number(s.size):25;s.page=Math.max(1,Math.floor(Number(s.page)||1));return s;}
const route=s=>'#sources/'+new URLSearchParams(Object.entries(s).filter(([,v])=>v!==''&&v!==undefined)).toString();
export async function mount(main,root,params=''){
 dispose();const own=generation,controller=new AbortController();active=controller;
 const live=()=>own===generation,state=parse(params),progress=new Map(),status=el('p','正在读取当前轮次的完整引用事件…',{role:'status','aria-live':'polite'}),cancel=el('button','取消加载',{type:'button'});
 document.documentElement.dataset.ready='false';main.replaceChildren(el('h1','全引用源'),status,cancel);
 cancel.onclick=()=>controller.abort(new Error('已取消加载，可重新加载引用数据'));
 let lastPaint=0;
 const session={signal:controller.signal,report(file,loaded,size,done){progress.set(file,{loaded,size,done});if(!live()||controller.signal.aborted)return;const now=Date.now();if(!done&&now-lastPaint<250)return;lastPaint=now;const files=[...progress.values()],received=files.reduce((n,f)=>n+f.loaded,0),expected=files.reduce((n,f)=>n+f.size,0);status.textContent=`正在加载并校验完整引用数据：${(received/1048576).toFixed(1)} / ${(expected/1048576).toFixed(1)} MB · 已校验${files.filter(f=>f.done).length}/${files.length}项。网络较慢时请稍候，可取消后重试。`;}};
 let manifest,summary,answers,sources;
 try{manifest=await get(root,'manifest.json',undefined,session);const rounds=state.view==='changes'?state.pair.split('-'):state.tracePair?state.tracePair.split('-'):state.round==='all'?['1','2','3']:[state.round];
  [summary,{answers},sources]=await Promise.all([get(root,'summary.json',manifest,session),get(root,'answers-index.json',manifest,session),(async()=>{const selected=[];for(let i=0;i<rounds.length;i+=2)selected.push(...await Promise.all(rounds.slice(i,i+2).map(n=>get(root,'round'+n+'-sources.json',manifest,session))));return selected;})()]);
 }catch(e){controller.abort(e);if(!live())return;main.replaceChildren(el('h1','全引用源'),el('p','引用数据未能加载：'+e.message,{role:'alert'}));const retry=el('button','重新加载引用数据',{type:'button'});retry.onclick=()=>mount(main,root,params);main.append(retry);return;}
 if(!live())return;document.title=views[state.view]+' | 蝉圈圈全引用源';
 const wrapper=el('div',undefined,{class:'full-sources'});main.replaceChildren(wrapper);
 wrapper.append(el('h1','全引用源仪表盘'),el('p','按引用出现统计，不代表正文事实支持或网址可访问已核。第1轮网页采集，第2、3轮API采集；跨轮差异不归因为优化效果。',{class:'method-note'}));
 const tabs=el('nav',undefined,{class:'section-links','aria-label':'全引用源六视图'});for(const[key,label]of Object.entries(views))tabs.append(link(label,route({...state,view:key,page:1,entity:'',entityKind:'',tracePair:'',rankingReturn:''}),key===state.view?{'aria-current':'page'}:{}));wrapper.append(tabs);
 const form=el('form',undefined,{class:'citation-filters','aria-label':'引用筛选'}),inputs={};
 function select(key,title,values){const label=el('label',title),input=el('select',undefined,{name:key});for(const[value,text]of values)input.append(el('option',text,{value}));input.value=state[key]??'';inputs[key]=input;label.append(input);form.append(label);}
 const options=(key)=>[['','全部'],...[...new Set(answers.map(a=>String(a[key])))].sort().map(v=>[v,v])];
 if(state.view==='changes'){select('pair','比较组',[['1-2','第一轮 → 第二轮'],['2-3','第二轮 → 第三轮'],['1-3','第一轮 → 第三轮']]);select('kind','来源单位',[['domains','域名'],['urls','完整网址']]);select('changeState','变化状态',[['','全部变化'],['added','新增'],['retained','保留'],['disappeared','消失']]);}
 else select('round','轮次',[['1','第一轮'],['2','第二轮'],['3','第三轮'],['all','全部三轮']]);
 select('category','题型',options('category'));select('pool','题池',options('pool'));select('date','采样日期',options('sample_date'));select('repeat','当日次数',[['','全部'],['1','第1次'],['2','第2次'],['3','第3次']]);
 select('scope','已知归属范围',[['','全部（含未核）'],['official_main_site','已确认主站 www.kolkoc.com'],['other_source','其他来源（所有权未全核）'],['unknown','缺有效网址（归属未知）']]);
 const domains=[...new Set(sources.flatMap(s=>s.events.map(e=>e.domain)))].sort();select('domain','精确域名',[['','全部域名'],...domains.map(v=>[v,v])]);
 for(const[key,title,placeholder]of[['q','题目关键词','只搜索题目文字'],['query','来源关键词','搜索完整网址、域名及卡片标题']]){const label=el('label',title),input=el('input',undefined,{name:key,type:'search',placeholder});input.value=state[key]||'';label.append(input);inputs[key]=input;form.append(label);}
 select('sort','排序',[['events','引用事件从多到少'],['name','来源／题目名称'],...(state.view==='changes'?[['delta','事件增量从多到少']]:[])]);select('size','每页条数',[10,25,50,100].map(n=>[String(n),String(n)]));
 const apply=el('button','应用筛选',{type:'submit'}),reset=link('清空筛选',route({view:state.view,round:state.round,pair:state.pair,kind:state.kind}),{class:'button'});form.append(apply,reset);form.onsubmit=e=>{e.preventDefault();const next={...state,page:1};for(const[k,n]of Object.entries(inputs))next[k]=n.value;location.hash=route(next);};wrapper.append(form);
 if(state.entity){const context=el('p','当前追溯来源：'+state.entity+' ',{class:'method-note'});context.append(link('返回来源排名',state.rankingReturn?.startsWith('#sources/')?state.rankingReturn:route({...state,view:state.entityKind==='domain'?'domains':'urls',entity:'',entityKind:'',tracePair:'',rankingReturn:'',page:1})));wrapper.append(context);}
 const p=project(answers,sources,state),count=el('p',`当前范围：${p.answers.length.toLocaleString()}条回答记录 · ${p.events.length.toLocaleString()}个有效引用事件 · ${new Set(p.events.map(e=>e.normalized_url)).size.toLocaleString()}个唯一URL · ${new Set(p.events.map(e=>e.domain)).size.toLocaleString()}个域名 · ${p.unknown.length.toLocaleString()}张缺有效URL卡`,{class:'source-summary',role:'status'});wrapper.append(count);wrapper.append(el('p','排名按当前范围的引用事件数计算；同数同名次，下一名跳号。名称只决定同分项显示顺序，不改变排名。',{class:'caption'}));
 wrapper.append(el('p',state.view==='changes'?`占比分母：旧轮当前筛选范围${p.denominators.from}个有效引用事件；新轮${p.denominators.to}个。0表示该冻结范围未出现；无历史排名显示“—”；占比变化按未舍入分数计算。`:'事件占比分母为当前筛选范围有效引用事件。缺URL卡单独计数，不并入有效网址分母。题目关键词与来源关键词可组合筛选；未知归属不冒充已核第三方。',{class:'caption'}));
 const downloads=el('div',undefined,{class:'download-row'});function download(text,all){const button=el('button',text,{type:'button','data-export':all?'all':'filtered'});button.onclick=()=>{const value=all?project(answers,sources,state,{all:true}):p,{headers,rows}=exportRows(value),data=csv(headers,rows),u=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'})),a=link('',u,{download:'cqq-'+state.view+'-'+(all?'all':'filtered')+'-20261101.csv'});a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};downloads.append(button);}download('下载当前筛选结果（全部命中行）',false);download('下载全部（当前轮次／比较组）',true);wrapper.append(downloads);
 const pages=Math.max(1,Math.ceil(p.rows.length/state.size));state.page=Math.min(state.page,pages);history.replaceState(null,'',route(state));
 const tableWrap=el('div',undefined,{class:'table-wrap',tabindex:'0','aria-label':views[state.view]+'完整列表'}),table=el('table',undefined,{class:'full-source-table'}),head=el('thead'),headRow=el('tr'),body=el('tbody');
 const exported=exportRows(p);const headers=[...exported.headers.filter(h=>h!=='原答链接'),'追溯'];for(const h of headers)headRow.append(el('th',h,{scope:'col'}));head.append(headRow);table.append(head,body);tableWrap.append(table);wrapper.append(tableWrap);
 function answerLink(a,card){const returnLink=route(state),args=new URLSearchParams({question:a.question_id,answer:a.answer_id,sourceReturn:returnLink});if(card)args.set('card',String(card));return new URL('./',root).href+'#answers/'+args.toString();}
 function recordsDetails(cell,records){const detail=el('details'),label=el('summary','查看'+records.length+'条采样与引用卡');detail.append(label);let built=false;detail.ontoggle=()=>{if(!detail.open||built)return;built=true;const list=el('ul',undefined,{class:'source-traces'});for(const a of records){const li=el('li'),events=p.eventMap.get(a.answer_id)||[],unknown=p.unknownMap.get(a.answer_id)||[];li.append(link('第'+a.round+'轮 · '+a.sample_date+' · 第'+a.repeat_index+'次 · '+a.question_text,answerLink(a)),el('span',a.answer_validity==='valid'?' · 有效正文':' · 无有效正文（异常保留）'));for(const e of events)for(const card of e.cards)li.append(el('p','卡'+card.card_position+'：'+(card.title||'未提供标题')+' '),link('查看原答对应卡'+card.card_position,answerLink(a,card.card_position)),el('p',card.url||'缺URL',{class:'source-url'}));for(const c of unknown)li.append(el('p','卡'+c.card_position+' · '+(c.title||'未提供标题')+' · 缺有效URL'),link('查看原答对应卡'+c.card_position,answerLink(a,c.card_position)));list.append(li);}detail.append(list);};cell.append(detail);}
 const rows=p.rows.slice((state.page-1)*state.size,state.page*state.size);
 for(const row of rows){const tr=el('tr');let cells;
  if(['domains','urls'].includes(state.view))cells=[row.rank,row.key,scopeLabel(row.site_scope),row.events,pct(row.events,p.events.length),row.raw_cards,row.answer_count,row.question_count];
  else if(state.view==='changes')cells=[row.key,scopeLabel(row.site_scope),({added:'新增',retained:'保留',disappeared:'消失'})[row.state],row.from_events,row.to_events,row.delta,pp(row.share_delta_pp),row.from_rank??'—',row.to_rank??'—',row.rank_improvement??'—'];
  else if(state.view==='answers')cells=[row.answer.round,row.answer.sample_date,row.answer.repeat_index,row.answer.question_text,row.answer.answer_validity==='valid'?'有效':'无有效正文（异常保留）',row.events,row.unknown,row.raw_cards];
  else if(state.view==='unknown')cells=[row.answer.round,row.answer.sample_date,row.answer.question_text,row.card.card_position,row.card.title||'未提供标题',row.card.url||'缺有效URL',scopeLabel('unknown')];
  else cells=[row.question,row.records.length,row.events,row.unknown];
  for(let i=0;i<cells.length;i++){const td=el('td',String(cells[i]),{'data-label':headers[i]});if((state.view==='urls'||state.view==='changes')&&i===(state.view==='urls'?1:0))td.className='source-url';tr.append(td);}const trace=el('td',undefined,{'data-label':'追溯'});
  if(['domains','urls','changes'].includes(state.view)){const kind=state.view==='domains'||state.view==='changes'&&state.kind==='domains'?'domain':'url';trace.append(link('查看命中问题',route({...state,rankingReturn:route(state),view:'questions',round:state.view==='changes'?'all':state.round,tracePair:state.view==='changes'?state.pair:'',entity:row.key,entityKind:kind,page:1})));}
  else if(state.view==='unknown')trace.append(link('查看原答与卡'+row.card.card_position,answerLink(row.answer,row.card.card_position)));
  else recordsDetails(trace,state.view==='answers'?[row.answer]:row.records);tr.append(trace);body.append(tr);
 }
 if(!rows.length){const tr=el('tr');tr.append(el('td','没有符合当前筛选的记录。可清空筛选或更换轮次。',{colspan:String(headers.length),class:'empty'}));body.append(tr);}
 const pager=el('nav',undefined,{class:'pagination','aria-label':'引用列表分页'}),previous=el('button','上一页',{type:'button'}),next=el('button','下一页',{type:'button'}),pageLabel=el('label','跳至页码'),number=el('input',undefined,{type:'number',min:'1',max:String(pages),name:'page',value:String(state.page),'aria-label':'跳至页码'});previous.disabled=state.page<=1;next.disabled=state.page>=pages;previous.onclick=()=>location.hash=route({...state,page:state.page-1});next.onclick=()=>location.hash=route({...state,page:state.page+1});number.onchange=()=>location.hash=route({...state,page:Math.min(pages,Math.max(1,Math.floor(Number(number.value)||1)))});pageLabel.append(number);pager.append(previous,el('span',`第${state.page} / ${pages}页 · 共${p.rows.length.toLocaleString()}行`,{'data-row-count':p.rows.length}),pageLabel,next);wrapper.append(pager);
 const methods=el('details',undefined,{class:'method-details'});methods.append(el('summary','口径与完整冻结清单'),el('p','同答同冻结URL计一个事件，重复卡保留原序号。每轮730记录，第一轮3条异常仍保留来源观测。来源归属仅确认主站www.kolkoc.com，其余未全核；不按标题补网址或推断账号所有权。'));for(const r of summary.rounds)methods.append(el('p',`第${r.round}轮：${r.raw_cards}张原始卡 / ${r.sample_url_events}个有效引用事件 / ${r.unique_urls}个唯一URL / ${r.domains}个域名 / ${r.missing_url_cards}张缺URL卡。`));for(const file of manifest.files.filter(f=>f.path.endsWith('.csv')))methods.append(link(file.path,new URL('citations/20261101/'+file.path,root).href,{download:'',class:'frozen-download'}));wrapper.append(methods);
 main.dataset.sourceState=location.hash;document.documentElement.dataset.ready='true';
}
