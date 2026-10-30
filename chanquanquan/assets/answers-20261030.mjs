/* Frozen model output is untrusted content. All data is inserted with textContent. */
export const bodyText=a=>a.body_raw_range===null?null:Array.from(a.answer_text).slice(...a.body_raw_range).join('');
export function safeUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
const INDEX_SHA='746e7997915b3c8c38c58f9a036015709750b3d0fb2e6179dbe7f4b2417526bd';
const cache=new Map();let indexPromise,base,epoch=0,current;
// One shared allowance covers every generation and detail consumer. Never abort
// a cached promise: another search or detail may still need the same response.
const shardQueue=[];let activeShards=0;
function pumpShards(){while(activeShards<2&&shardQueue.length){const {load,resolve,reject}=shardQueue.shift();activeShards++;Promise.resolve().then(load).then(resolve,reject).finally(()=>{activeShards--;pumpShards();});}}
const scheduleShard=load=>new Promise((resolve,reject)=>{shardQueue.push({load,resolve,reject});pumpShards();});
const node=(tag,text,attrs={})=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
export {node as literalElement};
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function json(file,sha){const r=await fetch(new URL('answers/20261030/'+file,base),{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);const bytes=await r.arrayBuffer();if(await digest(bytes)!==sha)throw Error('文件校验不一致');return JSON.parse(new TextDecoder().decode(bytes));}
async function index(){if(!indexPromise)indexPromise=json('index.json',INDEX_SHA).catch(e=>{indexPromise=null;throw e;});return indexPromise;}
async function shard(meta){if(!/^round[123]-part\d{2}\.json$/.test(meta.path))throw Error('无效分片');let value=cache.get(meta.path);if(!value){value={promise:scheduleShard(()=>json(meta.path,meta.sha256)),done:false};cache.set(meta.path,value);value.promise.then(()=>{value.done=true;for(const[key,item]of cache){if(cache.size<=8)break;if(item.done&&key!==meta.path)cache.delete(key);}},()=>{cache.delete(meta.path);});}else{cache.delete(meta.path);cache.set(meta.path,value);}return value.promise;}
export function dispose(){epoch++;if(current)current.searchToken++;current=null;}
const route=p=>'#answers/'+p.toString();
export async function mount(main,root){
dispose();base=root;const mounted=epoch;const params=new URLSearchParams(location.hash.split('/').slice(1).join('/'));
const live=()=>mounted===epoch;let idx;
try{idx=await index();}catch(e){if(!live())return;main.replaceChildren(node('h1','回答原文'),node('p','题目索引未能加载：'+e.message,{role:'alert'}));const retry=node('button','重新加载索引');retry.onclick=()=>mount(main,root);main.append(retry);document.documentElement.dataset.ready='true';return;}
if(!live())return;
const state=current={searchToken:0,detailToken:0,page:Math.max(1,Number(params.get('page'))||1),question:params.get('question')||'',answer:params.get('answer')||'',matches:null,complete:false};
const write=(replace=true)=>{params.set('page',String(state.page));state.question?params.set('question',state.question):params.delete('question');state.answer?params.set('answer',state.answer):params.delete('answer');history[replace?'replaceState':'pushState'](null,'',route(params));};
const wrap=node('div',undefined,{class:'answer-browser'}),intro=node('header',undefined,{class:'answer-intro'});
intro.append(node('h1','回答原文'),node('p','165道题目 · 三轮2190条采样记录 · 2187条有效回答，首轮3条无有效正文。'),node('p','按题目查各轮、日期与次数。原答是模型生成内容；引用卡不等于正文支持或事实核验。'));
const form=node('form',undefined,{class:'answer-filters','aria-label':'回答搜索与筛选'}),search=node('div',undefined,{class:'answer-search'}),inputs={};
function field(key,title,values){const label=node('label',title),select=node('select',undefined,{name:key,'aria-label':title});select.append(node('option','全部',{value:''}));for(const v of values){const [val,text]=Array.isArray(v)?v:[v,v];select.append(node('option',text,{value:val}));}select.value=params.get(key)||'';inputs[key]=select;label.append(select);form.append(label);}
field('round','轮次',[['1','第1轮'],['2','第2轮'],['3','第3轮']]);field('category','题型',[...new Set(idx.answers.map(a=>a.category))]);field('pool','题池',[...new Set(idx.answers.map(a=>a.pool))]);field('date','采样日期',[...new Set(idx.answers.map(a=>a.sample_date))].sort());field('repeat','当日次数',[['1','第1次'],['2','第2次'],['3','第3次']]);field('validity','回答状态',[['valid','有效回答'],['invalid_no_body','无有效正文（异常）']]);
const queryLabel=node('label','关键词'),query=node('input',undefined,{type:'search',name:'query',placeholder:'输入题目或正文关键词',autocomplete:'off'});query.value=params.get('query')||'';queryLabel.append(query);
const modeLabel=node('label','搜索范围'),mode=node('select',undefined,{name:'mode','aria-label':'搜索范围'});mode.append(node('option','题目文字',{value:'question'}),node('option','回答正文（扫描筛选范围）',{value:'body'}));mode.value=params.get('mode')==='body'?'body':'question';modeLabel.append(mode);
const go=node('button','搜索',{type:'submit'}),cancel=node('button','取消扫描',{type:'button'});cancel.hidden=true;
search.append(queryLabel,modeLabel,go,cancel);form.append(search);
const progress=node('p','',{'class':'answer-progress',role:'status','aria-live':'polite'}),summary=node('div',undefined,{class:'answer-summary'}),listTitle=node('h2','题目'),count=node('span');summary.append(listTitle,count);
const region=node('section',undefined,{class:'answer-list-region',tabindex:'-1','aria-label':'题目与回答记录'}),list=node('ol',undefined,{class:'question-list'}),pager=node('div',undefined,{class:'answer-pagination'}),prev=node('button','上一页',{type:'button'}),pageLabel=node('span'),next=node('button','下一页',{type:'button'});pager.append(prev,pageLabel,next);region.append(summary,list,pager);
const detail=node('section',undefined,{class:'answer-detail',tabindex:'-1','aria-label':'回答详情'});detail.hidden=true;
wrap.append(intro,form,progress,region,detail);main.replaceChildren(wrap);document.title='回答原文 | 蝉圈圈三轮研究';document.documentElement.dataset.ready='true';
const eligible=()=>idx.answers.filter(a=>(!inputs.round.value||String(a.round)===inputs.round.value)&&(!inputs.category.value||a.category===inputs.category.value)&&(!inputs.pool.value||a.pool===inputs.pool.value)&&(!inputs.date.value||a.sample_date===inputs.date.value)&&(!inputs.repeat.value||String(a.repeat_index)===inputs.repeat.value)&&(!inputs.validity.value||a.answer_validity===inputs.validity.value));
const visible=()=>{let rows=eligible(),term=query.value.trim().toLocaleLowerCase();if(term){if(mode.value==='body')rows=state.matches?rows.filter(a=>state.matches.has(a.answer_id)):[];else rows=rows.filter(a=>a.question_text.toLocaleLowerCase().includes(term));}return rows;};
function showList(){if(!live())return;const rows=visible(),groups=new Map();for(const a of rows){if(!groups.has(a.question_id))groups.set(a.question_id,[]);groups.get(a.question_id).push(a);}const pageCount=Math.max(1,Math.ceil(groups.size/10));state.page=Math.min(state.page,pageCount);const entries=[...groups.entries()].slice((state.page-1)*10,state.page*10);count.textContent=`${groups.size} / 165题 · ${rows.length} / 2190条记录`;list.replaceChildren();
for(const[qid,records]of entries){const li=node('li',undefined,{class:'question-item'}),button=node('button',records.at(-1).question_text,{type:'button','aria-expanded':String(state.question===qid),'aria-controls':'records-'+qid});button.dataset.question=qid;li.append(button,node('p',`${records.length}条记录 · ${[...new Set(records.map(a=>'第'+a.round+'轮'))].join('、')} · ${records[0].pool}`,{class:'question-meta'}));
if(state.question===qid){const recordsBox=node('div',undefined,{class:'answer-records',id:'records-'+qid});for(const a of records){const rp=new URLSearchParams(params);rp.set('question',qid);rp.set('answer',a.answer_id);const link=node('a',`第${a.round}轮 · ${a.sample_date} · 第${a.repeat_index}次 · ${a.answer_validity==='valid'?'有效正文':'无有效正文'} · ${a.source_card_count}张引用卡`,{href:route(rp)});link.dataset.answer=a.answer_id;if(state.answer===a.answer_id)link.setAttribute('aria-current','true');link.onclick=e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();state.answer=a.answer_id;write(false);showList();showDetail(true);};recordsBox.append(link);}li.append(recordsBox);}
button.onclick=()=>{state.question=state.question===qid?'':qid;state.answer='';clearDetail();write();showList();};list.append(li);}
if(!rows.length)list.append(node('li',mode.value==='body'&&query.value.trim()&&!state.matches?'请点击“搜索”扫描当前筛选范围的正文。':'没有匹配记录。清空关键词或筛选条件后重试。',{class:'question-item'}));prev.disabled=state.page<=1;next.disabled=state.page>=pageCount;pageLabel.textContent=`第${state.page} / ${pageCount}页`;write();}
function clearDetail(){state.detailToken++;detail.hidden=true;detail.replaceChildren();delete detail.dataset.answerId;}
function sync(){for(const[k,input]of Object.entries(inputs))input.value?params.set(k,input.value):params.delete(k);query.value?params.set('query',query.value):params.delete('query');params.set('mode',mode.value);params.delete('searched');state.searchToken++;state.matches=null;state.complete=false;state.page=1;state.question='';state.answer='';clearDetail();cancel.hidden=true;go.disabled=false;progress.textContent=mode.value==='body'&&query.value.trim()?'正文尚未搜索；点击“搜索”开始扫描筛选范围。':'仅检索题目索引，不加载回答分片。';showList();}
for(const input of Object.values(inputs))input.onchange=sync;mode.onchange=sync;
query.oninput=sync;
prev.onclick=()=>{state.page--;showList();region.focus();};next.onclick=()=>{state.page++;showList();region.focus();};
cancel.onclick=()=>{state.searchToken++;cancel.hidden=true;go.disabled=false;state.complete=false;progress.textContent+=' · 已取消，仅显示已扫描范围的命中；再次搜索可重新扫描。';};
async function runSearch(){sync();const term=query.value.trim().toLocaleLowerCase();if(mode.value!=='body'||!term)return;
const token=++state.searchToken,rows=eligible(),allowed=new Map(rows.map(a=>[a.answer_id,a])),metas=idx.shards.filter(s=>rows.some(a=>a.shard===s.path));let cursor=0,done=0,scanned=0;const failures=[];state.matches=new Set();go.disabled=true;cancel.hidden=false;
params.set('searched','1');write();
const valid=()=>live()&&token===state.searchToken;
const announce=()=>{if(valid())progress.textContent=`正文搜索：${done} / ${metas.length}个分片，${scanned} / ${rows.length}条记录已扫描，命中${state.matches.size}条${failures.length?'；'+failures.length+'个分片失败，范围不完整':''}`;};announce();
const worker=async()=>{while(valid()&&cursor<metas.length){const meta=metas[cursor++];try{const part=await shard(meta);if(!valid())return;for(const a of part.answers){if(!allowed.has(a.answer_id))continue;scanned++;const body=bodyText(a);if(body!==null&&body.toLocaleLowerCase().includes(term))state.matches.add(a.answer_id);}}catch(e){if(valid())failures.push(meta.path);}if(!valid())return;done++;announce();showList();}};
await Promise.all([worker(),worker()]);if(!valid())return false;go.disabled=false;cancel.hidden=true;state.complete=!failures.length;announce();progress.textContent+=failures.length?' · 部分正文未搜索，点击“搜索”重试（已成功分片可复用）。':' · 当前筛选范围搜索完成（异常捕获不作为有效正文搜索）。';return true;}
form.onsubmit=e=>{e.preventDefault();runSearch();};
async function showDetail(focus=false){clearDetail();const token=state.detailToken,meta=idx.answers.find(a=>a.answer_id===state.answer);detail.hidden=false;if(!meta){detail.append(node('h2','未找到这条回答'),node('p','链接中的回答不存在，请从题目列表选择。'));return;}
detail.append(node('h2',`第${meta.round}轮 · ${meta.sample_date} · 第${meta.repeat_index}次`),node('p','正在读取这条回答…',{role:'status'}));if(focus){detail.scrollIntoView({behavior:'instant'});detail.focus({preventScroll:true});}
try{const part=await shard(idx.shards.find(s=>s.path===meta.shard));if(!live()||token!==state.detailToken)return;const a=part.answers.find(a=>a.answer_id===meta.answer_id);if(!a)throw Error('分片中未找到对应回答');
const rawHash=await digest(new TextEncoder().encode(a.answer_text)),body=bodyText(a);if(!live()||token!==state.detailToken)return;if(rawHash!==meta.answer_sha256||(body!==null&&await digest(new TextEncoder().encode(body))!==meta.body_sha256))throw Error('回答正文校验不一致');if(!live()||token!==state.detailToken)return;
detail.replaceChildren(node('h2',`第${a.round}轮 · ${a.sample_date} · 第${a.repeat_index}次`),node('p',`${a.category} · ${a.pool} · ${a.answer_validity==='valid'?'有效回答':'异常：无有效正文'}`,{class:'question-meta'}),node('h3','当次完整题文'),node('div',a.question_text,{class:'answer-question'}));
const permalink=node('a','本条回答永久链接',{href:route(params),class:'answer-permalink'});detail.append(permalink,node('h3','回答正文'));
if(body===null)detail.append(node('p','无有效正文。'+(a.invalid_reason||'捕获记录不包含有效回答正文。'),{class:'answer-warning'}));else detail.append(node('div',body,{class:'answer-body',dir:'auto'}));
const capture=node('details',undefined,{class:'answer-capture'}),captureTitle=node('summary','展开完整采集原文（包含界面捕获内容）');capture.append(captureTitle);capture.addEventListener('toggle',()=>{if(capture.open&&!capture.querySelector('.answer-raw'))capture.append(node('div',a.answer_text,{class:'answer-raw',dir:'auto'}));});detail.append(capture,node('h3',`对应引用 · ${a.sources.length}张来源卡`),node('p','按当次捕获顺序展示，保留缺URL项；引用卡不代表正文已支持该来源。',{class:'question-meta'}));
const sources=node('ol',undefined,{class:'answer-sources'});for(const s of a.sources){const li=node('li'),safe=safeUrl(s.url);if(safe){li.append(node('a',s.title||safe,{href:safe,target:'_blank',rel:'noopener noreferrer'}));}else li.append(node('span',(s.title||'未提供标题')+' · '+(s.url?'无安全HTTP(S)链接':'缺URL')));sources.append(li);}if(!a.sources.length)detail.append(node('p','本次捕获无引用卡；不据此判定模型没有使用其他来源。'));else detail.append(sources);
detail.dataset.answerId=a.answer_id;if(focus){detail.scrollIntoView({behavior:'instant'});detail.focus({preventScroll:true});}
}catch(e){if(!live()||token!==state.detailToken)return;detail.replaceChildren(node('h2','回答未能加载'),node('p','这条回答暂不可用：'+e.message,{role:'alert'}));const retry=node('button','重新加载这条回答',{type:'button'});retry.onclick=()=>showDetail();detail.append(retry);}}
const linkedAnswer=state.answer,linkedQuestion=state.question,linkedPage=state.page,bodyQuery=mode.value==='body'&&query.value.trim(),submitted=params.get('searched')==='1';
if(bodyQuery){state.question='';state.answer='';state.page=1;}showList();
if(bodyQuery){if(submitted){const finished=await runSearch();if(live()&&finished){state.page=linkedPage;if(linkedAnswer&&state.matches.has(linkedAnswer)){state.answer=linkedAnswer;state.question=linkedQuestion||idx.answers.find(a=>a.answer_id===linkedAnswer)?.question_id||'';}showList();if(state.answer)showDetail(true);}}else progress.textContent='正文尚未搜索；点击“搜索”开始扫描筛选范围。';}
else{if(state.answer){if(!state.question)state.question=idx.answers.find(a=>a.answer_id===state.answer)?.question_id||'';showList();showDetail(true);}progress.textContent='仅加载题目索引；展开某条回答时读取对应分片。';}
}
