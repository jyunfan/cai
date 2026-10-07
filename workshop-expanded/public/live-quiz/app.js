import {parseBank} from './bank.js';
const $ = s => document.querySelector(s);
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const button = (text, action, cls) => {const b=el('button',text,cls); b.type='button'; b.onclick=action; return b;};
let bank, session, state, busy=false, online=true, signature='', clockOffset=0, polling=false, fileSelected=false;
function error(message='') { $('#error').textContent=message; $('#error').hidden=!message; }
async function api(body) {
  const response = await fetch(body ? '/api/live' : `/api/live?code=${session.code}`, {
    method: body?'POST':'GET', cache:'no-store', headers:{'Content-Type':'application/json',...(session?{Authorization:`Bearer ${session.token}`}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  let result; try {result=await response.json();} catch {throw new Error('連線中斷，請確認網路或網站存取權限。');}
  if (!response.ok) throw new Error(result.error || '連線失敗，請稍後重試。');
  return result;
}
function showRole(host) {
  $('#studentPanel').hidden=host; $('#hostPanel').hidden=!host;
  $('#hostTab').setAttribute('aria-selected',String(host)); $('#studentTab').setAttribute('aria-selected',String(!host));
  error();
}
$('#hostTab').onclick=()=>showRole(true); $('#studentTab').onclick=()=>showRole(false);
$('#bankFile').onchange=async e=>{
  const file=e.target.files[0]; if (!file) return; fileSelected=true;
  try {if(file.size>500000) throw new Error('題庫過大，請縮減至 100 題以內。'); bank=parseBank(await file.text(),file.name); $('#bankStatus').textContent=`${file.name} · ${bank.questions?.length || 0} 題（開房時檢查正解）`;error();}
  catch(e){bank=null;$('#bankStatus').textContent='題庫尚未通過檢查';error(e.message);}
};
async function enter(body, form) {
  const b=form.querySelector('button[type=submit]'); b.disabled=true; error();
  try {session=await api(body);sessionStorage.setItem('live-quiz-session',JSON.stringify(session));history.replaceState(null,'',`?room=${session.code}`);await refresh();}
  catch(e){error(e.message);}finally{b.disabled=false;}
}
$('#studentPanel').onsubmit=e=>{e.preventDefault();enter({action:'join',code:$('#roomCode').value.trim().toUpperCase(),name:$('#nickname').value.trim()},e.target);};
$('#hostPanel').onsubmit=e=>{e.preventDefault();if(!bank){error('請先選擇有效的題庫。');return;}enter({action:'create',bank,seconds:Number($('#seconds').value)},e.target);};
async function command(action, extra={}) {
  if (busy || !online) return;
  busy=true; render(); error();
  try {await api({action,code:session.code,round:state.round,phase:state.phase,...extra});await refresh();}
  catch(e){error(e.message);await refresh(false);}
  finally{busy=false;render();}
}
async function refresh(clearError=true) {
  if(!session || polling) return;
  polling=true;
  try {
    const wasOnline=online;const next=await api();online=true;clockOffset=next.serverNow-Date.now();state=next;
    const sig=JSON.stringify({...next,serverNow:0});
    if(sig!==signature||!wasOnline){signature=sig;render();}
    if(clearError||!wasOnline)error();
  } catch(e){online=false;error(e.message);render();}
  finally{polling=false;tick();}
}
function exit() {
  if(!confirm('離開後將清除這個分頁的加入憑證。主持人離開後無法從此頁恢復控制，確定離開？'))return;
  sessionStorage.removeItem('live-quiz-session');location.href='./index.html';
}
function tick() {
  const time=$('#timer'); if(!time||!state)return;
  const left=Math.max(0,Math.ceil((state.deadline-Date.now()-clockOffset)/1000));
  time.textContent=state.phase==='open'?`${left} 秒`:'已收題';
  if(left===0) document.querySelectorAll('.choice').forEach(b=>b.disabled=true);
}
function render() {
  if(!state)return;
  $('#setup').hidden=true;$('#room').hidden=false;const root=$('#room');root.replaceChildren();
  const bar=el('div',undefined,'room-bar');
  const identity=el('div');identity.append(el('small',state.host?'教師主持':'學生作答'),el('h2',state.title));
  const code=el('div',undefined,'room-code');code.append(el('small','房號'),el('strong',state.code));
  bar.append(identity,code,button('離開',exit,'secondary'));root.append(bar);
  const grid=el('div',undefined,'live-grid');const main=el('div',undefined,'question-area');const side=el('aside',undefined,'leaderboard');grid.append(main,side);root.append(grid);
  if(state.phase==='lobby') {
    main.append(el('p','等待全班就位','eyebrow'),el('h2',`${state.players.length} 人已加入`));
    const url=new URL(`?room=${state.code}`,location.href).href;
    if(state.host) {
      const link=el('a',url,'join-link');link.href=url;link.target='_blank';link.rel='noopener';main.append(link);
      main.append(button('複製學生加入連結',async()=>{try{await navigator.clipboard.writeText(url);error('加入連結已複製。');}catch{error('無法存取剪貼簿，請選取上方連結。');}},'secondary'));
      const start=button('開始第一題',()=>command('next'),'primary');start.disabled=busy||!online||!state.players.length;main.append(start);
      main.append(el('p','所有學生加入後再開題；開始後不再接受新加入。','muted'));
    } else main.append(el('p','加入成功，等待老師開題。請保留這個分頁。','waiting'));
    main.append(el('p','每題只可提交一次 · 答錯 0 分 · 第五位起答對 +1 分','muted'));
  } else if(state.phase==='finished') {
    main.append(el('p','本場完成','eyebrow'),el('h2','把答案帶回討論'));
    if(state.players.length) {const high=state.players[0].score;main.append(el('p',`本場最高分 ${high} 分：${state.players.filter(p=>p.score===high).map(p=>p.name).join('、')}`,'winner'));}
    main.append(el('p','相同總分並列。挑一題，說出你的判斷理由。'));
    if(state.host)main.append(button('下載排行榜 CSV',exportScores,'secondary'));
    main.append(button(state.host?'再開一場':'加入下一場',()=>{sessionStorage.removeItem('live-quiz-session');location.href=state.host?'./index.html?host=1':'./index.html';},'primary'));
  } else {
    const meta=el('div',undefined,'question-meta');const time=el('strong','','timer');time.id='timer';meta.append(el('span',`第 ${state.round+1} / ${state.total} 題`),el('span',`${state.answered} / ${state.players.length} 人已作答`),time);main.append(meta,el('h2',state.question.prompt,'question-title'));
    const choices=el('div',undefined,'choices');
    state.question.choices.forEach((c,i)=>{
      const b=button('',()=>command('answer',{choice:i}),`choice color-${i%4}`);
      b.append(el('span',String.fromCharCode(65+i),'letter'),el('span',c.text));
      if(state.submitted?.choice===i)b.append(el('strong','你的答案','choice-mark'));
      if(c.correct)b.append(el('strong','正確答案','choice-mark'));
      b.disabled=state.host||state.phase!=='open'||!!state.submitted||busy||!online||state.deadline<=Date.now()+clockOffset;
      choices.append(b);
    });main.append(choices);
    if(state.submitted&&state.phase==='open')main.append(el('p','答案已送出，等待揭曉。','waiting'));
    if(state.phase==='reveal') {
      if(!state.host) {const a=state.submitted;main.append(el('p',a?(a.correct?`答對！第 ${a.rank} 位 · +${a.points} 分`:'這題答錯 · +0 分'):'本題未作答 · +0 分','answer-result'));}
      main.append(el('p',state.question.explanation || '請老師與全班討論本題的判斷依據。','explanation'));
      const podium=el('div',undefined,'round-results');
      state.results.filter(a=>a.correct).forEach(a=>podium.append(el('span',`${a.rank}. ${a.name} +${a.points}`)));main.append(podium);
    }
    if(state.host){
      const controls=el('div',undefined,'host-controls');
      if(state.phase==='open')controls.append(button('收題並揭曉',()=>command('close'),'primary'));
      else {if(state.round+1<state.total)controls.append(button('開啟下一題',()=>command('next'),'primary'));controls.append(button('結束並看總榜',()=>{if(state.round+1===state.total||confirm('還有題目未作答，確定提早結束？'))command('finish');},'secondary'));}
      controls.querySelectorAll('button').forEach(b=>b.disabled=busy||!online);main.append(controls);
    }
  }
  side.append(el('h2','累積排行榜'),el('p',state.phase==='open'?'本題收題後更新積分':'同分並列，依暱稱排列','muted'));
  const list=el('ol');let rank=0,last=null;
  state.players.forEach((p,i)=>{if(p.score!==last)rank=i+1;last=p.score;const row=el('li',undefined,p.id===state.me?'is-me':'');row.append(el('span',String(rank),'rank'),el('span',p.name+(p.id===state.me?'（你）':'')),el('strong',`${p.score} 分`));list.append(row);});
  if(!state.players.length)side.append(el('p','等待第一位學生加入','muted'));side.append(list);tick();
}
function exportScores(){
  const safe=v=>'"'+String(v).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
  const csv='\uFEFF暱稱,總分\r\n'+state.players.map(p=>[safe(p.name),p.score].join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=el('a');a.href=url;a.download=`搶答-${state.code}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const params=new URLSearchParams(location.search);$('#roomCode').value=params.get('room')||'';if(params.has('host'))showRole(true);
try {const saved=JSON.parse(sessionStorage.getItem('live-quiz-session'));if(saved&&(!params.get('room')||saved.code===params.get('room')))session=saved;}catch{}
fetch('/game-examples/data/quiz.json').then(r=>r.json()).then(data=>{if(!fileSelected){bank=data;$('#bankStatus').textContent=`範例：${data.title} · ${data.questions.length} 題`;}}).catch(()=>{if(!fileSelected)$('#bankStatus').textContent='請上傳老師自己的題庫';});
if(session)refresh();setInterval(()=>refresh(false),1000);setInterval(tick,200);
