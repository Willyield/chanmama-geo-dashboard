// A source trace can return to its exact filter and identify the captured card.
// The accepted original-answer module and its frozen bytes remain unchanged.
const main=document.querySelector('main'),back=document.querySelector('#source-return');
let oldCard;
function sync(){
 const isAnswer=location.hash.startsWith('#answers/'),params=new URLSearchParams(location.hash.split('/').slice(1).join('/')),target=params.get('sourceReturn'),card=Number(params.get('card'));
 back.hidden=!isAnswer||!target?.startsWith('#sources/');
 if(!back.hidden){const a=back.querySelector('a');a.href=target;a.textContent='返回全引用源列表（保留筛选）';}
 if(oldCard&&!oldCard.isConnected)oldCard=null;
 if(isAnswer&&Number.isInteger(card)&&card>0&&document.querySelector('.answer-detail')?.dataset.answerId===params.get('answer')){
  const li=document.querySelectorAll('.answer-sources>li')[card-1];
  if(li&&li!==oldCard){oldCard?.classList.remove('source-card-target');oldCard=li;li.classList.add('source-card-target');li.setAttribute('tabindex','-1');li.setAttribute('aria-label','对应引用卡'+card);li.scrollIntoView({block:'center'});li.focus({preventScroll:true});}
 }else if(oldCard){oldCard.classList.remove('source-card-target');oldCard=null;}
}
new MutationObserver(sync).observe(main,{childList:true,subtree:true});addEventListener('hashchange',sync);sync();
