import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {liveAction,liveSnapshot,validateBank} from '../lib/live-service.ts';
import {parseBank} from '../public/live-quiz/bank.js';
const bank={title:'測試搶答',questions:Array.from({length:2},()=>({prompt:'哪個正確？',choices:[{text:'正解',correct:true},{text:'錯誤',correct:false}],explanation:'測試解析'}))};
function database(){
  const sqlite=new DatabaseSync(':memory:');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  return {sqlite,prepare(sql){return {bind(...args){return {async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};}};}};}};
}
async function fixture(n=7){
  const db=database(), host=await liveAction(db,{action:'create',bank,seconds:30});
  const players=[];for(let i=0;i<n;i++)players.push(await liveAction(db,{action:'join',code:host.code,name:'同學'+i}));
  const act=(session,action,rest={})=>liveAction(db,{code:host.code,action,...rest},session.token);
  const snap=s=>liveSnapshot(db,host.code,s.token);
  return {db,host,players,act,snap};
}
test('correct arrival ranks award 5,4,3,2,1,1; wrong does not consume a rank; one answer per player',async()=>{
  const {db,host,players,act,snap}=await fixture();
  await act(host,'next',{round:-1,phase:'lobby'});
  await act(players[0],'answer',{round:0,choice:1});
  await act(players[0],'answer',{round:0,choice:0});
  for(const p of players.slice(1))await act(p,'answer',{round:0,choice:0});
  const hidden=await snap(players[1]);
  assert.equal(hidden.question.choices[0].correct,undefined);assert.equal(hidden.question.explanation,undefined);
  assert.equal(hidden.submitted.points,undefined);assert.equal(hidden.results.length,0);assert.ok(hidden.players.every(p=>p.score===0));
  await act(host,'close',{round:0,phase:'open'});
  const result=await snap(host);
  assert.deepEqual(result.results.map(a=>a.points),[0,5,4,3,2,1,1]);
  assert.deepEqual(result.results.map(a=>a.rank),[0,1,2,3,4,5,6]);
  assert.equal(result.question.choices[0].correct,true);db.sqlite.close();
});
test('simultaneous submissions receive unique ranks, duplicate retries do not score twice',async()=>{
  const {db,host,players,act,snap}=await fixture(20);await act(host,'next',{round:-1,phase:'lobby'});
  await Promise.all(players.flatMap(p=>[act(p,'answer',{round:0,choice:0}),act(p,'answer',{round:0,choice:0})]));
  await act(host,'close',{round:0,phase:'open'});const s=await snap(host);
  assert.equal(s.results.length,20);assert.deepEqual(s.results.map(a=>a.rank),Array.from({length:20},(_,i)=>i+1));
  assert.equal(s.players.reduce((sum,p)=>sum+p.score,0),30);db.sqlite.close();
});
test('host authorization, stale controls, rounds, late joins and cumulative scores',async()=>{
  const {db,host,players,act,snap}=await fixture(2);
  await assert.rejects(()=>act(players[0],'next',{round:-1,phase:'lobby'}),/只有老師/);
  await assert.rejects(()=>liveSnapshot(db,host.code,'bad-token'),/失效/);
  await act(host,'next',{round:-1,phase:'lobby'});
  await assert.rejects(()=>act(host,'next',{round:-1,phase:'lobby'}),/更新/);
  await assert.rejects(()=>liveAction(db,{action:'join',code:host.code,name:'太晚'}),/已開始/);
  await act(players[0],'answer',{round:0,choice:0});await act(host,'close',{round:0,phase:'open'});
  await act(host,'next',{round:0,phase:'reveal'});
  await assert.rejects(()=>act(players[1],'answer',{round:0,choice:0}),/已結束/);
  await act(players[0],'answer',{round:1,choice:0});await act(host,'close',{round:1,phase:'open'});
  await act(host,'finish',{round:1,phase:'reveal'});const s=await snap(host);assert.equal(s.phase,'finished');assert.equal(s.players[0].score,10);
  assert.equal((await snap(players[0])).submitted.points,5);db.sqlite.close();
});
test('deadline and room expiration are enforced by server; cleanup cascades',async()=>{
  const {db,host,players,act,snap}=await fixture(1);await act(host,'next',{round:-1,phase:'lobby'});
  db.sqlite.prepare('UPDATE live_rooms SET deadline=0 WHERE code=?').run(host.code);
  await assert.rejects(()=>act(players[0],'answer',{round:0,choice:0}),/已結束/);assert.equal((await snap(host)).phase,'reveal');
  db.sqlite.prepare('UPDATE live_rooms SET expires=0 WHERE code=?').run(host.code);
  await assert.rejects(()=>snap(host),/到期/);await liveAction(db,{action:'create',bank,seconds:30});
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM live_players').get().n,0);db.sqlite.close();
});
test('CSV supports BOM, quoted commas, escaped quotes and rejects multi-answer or invalid banks',()=>{
  const csv='\uFEFFquestion,A,B,C,D,answer,explanation\r\n"題目,一",正解,錯誤,,,A,"含""引號""解析"';
  const parsed=parseBank(csv,'a.csv');assert.equal(parsed.questions[0].prompt,'題目,一');assert.equal(parsed.questions[0].explanation,'含"引號"解析');assert.equal(validateBank(parsed).questions.length,1);
  assert.throws(()=>parseBank(csv.replace(',,,A,',',,,A;B,'),'a.csv'),/多選/);
  assert.throws(()=>validateBank({questions:[null]}),/格式/);
  assert.throws(()=>validateBank({questions:[{...bank.questions[0],choices:[{text:'a',correct:true},{text:'b',correct:true}]}]}),/唯一正解/);
});
