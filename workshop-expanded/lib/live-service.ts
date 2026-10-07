type DB = any;
type Question = {prompt: string; choices: {text: string; correct: boolean}[]; explanation: string};
export class LiveError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
const fail = (message: string, status = 400): never => { throw new LiveError(message, status); };
const clean = (value: unknown, max: number, label: string) => {
  if (typeof value !== "string" || !value.trim() || value.length > max) fail(`${label}須為 1–${max} 字。`);
  return (value as string).trim();
};
export function validateBank(data: any) {
  if (!data || !Array.isArray(data.questions) || data.questions.length < 1 || data.questions.length > 100) fail("題庫須包含 1–100 題。");
  const title = clean(data.title || "全班搶答", 100, "題庫標題");
  const questions: Question[] = data.questions.map((q: any, i: number) => {
    if (!q || typeof q !== "object" || !Array.isArray(q.choices) || q.choices.some((c: any) => !c || typeof c !== "object")) fail(`第 ${i+1} 題格式有誤。`);
    if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 6 || q.choices.some((c: any) => typeof c.correct !== "boolean") || q.choices.filter((c: any) => c.correct).length !== 1) fail(`第 ${i+1} 題須有 2–6 個選項及唯一正解；多選題請改用選項鑑識。`);
    return {prompt: clean(q.prompt, 1000, `第 ${i+1} 題`), choices: q.choices.map((c: any) => ({text: clean(c.text, 500, "選項"), correct: c.correct})), explanation: typeof q.explanation === "string" ? q.explanation.slice(0, 2000) : ""};
  });
  return {title, questions};
}
const token = () => crypto.randomUUID() + crypto.randomUUID();
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, "0")).join("");
async function roomFor(db: DB, code: string) {
  if (!/^[A-Z0-9]{6}$/.test(code)) fail("請輸入 6 碼房號。");
  const now = Date.now();
  await db.prepare("UPDATE live_rooms SET phase='reveal' WHERE code=? AND phase='open' AND deadline<=?").bind(code, now).run();
  const room = await db.prepare("SELECT * FROM live_rooms WHERE code=? AND expires>?").bind(code, now).first();
  if (!room) fail("找不到房間或房間已到期，請確認房號。", 404);
  return room;
}
async function identity(db: DB, room: any, secret: string) {
  const digest = await hash(secret);
  if (digest === room.host) return {host: true, player: null};
  const player = await db.prepare("SELECT id,name FROM live_players WHERE room=? AND token=?").bind(room.code, digest).first();
  if (!player) fail("加入資訊失效，請重新加入房間。", 401);
  return {host: false, player};
}
export async function liveAction(db: DB, data: any, secret = "") {
  if (!data || typeof data !== "object") fail("請提供有效的操作資料。");
  if (data.action === "create") {
    const bank = validateBank(data.bank);
    const seconds = Number(data.seconds);
    if (![15,30,60,120].includes(seconds)) fail("請選擇作答時間。");
    // Expired rooms are removed on creation; foreign keys remove their answers.
    await db.prepare("DELETE FROM live_rooms WHERE expires<=?").bind(Date.now()).run();
    for (let attempt=0; attempt<5; attempt++) {
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const code = Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
      const key = token();
      const r = await db.prepare("INSERT OR IGNORE INTO live_rooms (code,host,title,questions,seconds,expires) VALUES (?,?,?,?,?,?)").bind(code, await hash(key), bank.title, JSON.stringify(bank.questions), seconds, Date.now()+86400000).run();
      if (r.meta.changes) return {code, token: key, host: true};
    }
    fail("房間建立忙碌中，請重試。", 503);
  }
  const room = await roomFor(db, String(data.code || "").toUpperCase());
  if (data.action === "join") {
    if (room.phase !== "lobby") fail("遊戲已開始，請等老師建立下一場房間。");
    const name = clean(data.name, 20, "暱稱");
    const key = token(), id = crypto.randomUUID();
    const r = await db.prepare("INSERT OR IGNORE INTO live_players (id,room,token,name) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM live_rooms WHERE code=? AND phase='lobby') AND (SELECT COUNT(*) FROM live_players WHERE room=?)<100").bind(id, room.code, await hash(key), name, room.code, room.code).run();
    if (!r.meta.changes) fail("暱稱已使用、房間已滿（100 人），或老師已開始出題。");
    return {code: room.code, token: key, host: false};
  }
  const who = await identity(db, room, secret);
  const questions: Question[] = JSON.parse(room.questions);
  if (data.action === "answer") {
    if (who.host) fail("主持人不參與作答。", 403);
    const round = Number(data.round), choice = Number(data.choice);
    if (!Number.isInteger(round) || round !== room.round || room.phase !== "open") fail("本題已結束或尚未開始。");
    if (!Number.isInteger(choice) || choice < 0 || choice >= questions[round].choices.length) fail("選項無效。");
    const correct = questions[round].choices[choice].correct ? 1 : 0;
    // One SQLite statement serializes rank assignment and insertion, even for simultaneous devices.
    await db.prepare(`INSERT OR IGNORE INTO live_answers (room,round,player,choice,correct,rank,points)
      SELECT ?,?,?,?,?, CASE WHEN ?=1 THEN COUNT(*)+1 ELSE 0 END,
      CASE WHEN ?=1 THEN MAX(1,5-COUNT(*)) ELSE 0 END
      FROM live_answers WHERE room=? AND round=? AND correct=1
      HAVING EXISTS (SELECT 1 FROM live_rooms WHERE code=? AND phase='open' AND round=? AND deadline>?)`)
      .bind(room.code, round, who.player.id, choice, correct, correct, correct, room.code, round, room.code, round, Date.now()).run();
    const saved = await db.prepare("SELECT choice FROM live_answers WHERE room=? AND round=? AND player=?").bind(room.code, round, who.player.id).first();
    if (!saved) fail("時間已到，答案未計入。");
    return {submitted: true, choice: saved.choice};
  }
  if (!who.host) fail("只有老師可以控制出題。", 403);
  if (data.round !== room.round || data.phase !== room.phase) fail("畫面已更新，請確認最新狀態後再操作。", 409);
  if (data.action === "next") {
    if (!["lobby", "reveal"].includes(room.phase) || room.round+1 >= questions.length) fail("目前無法開啟下一題。");
    const count = await db.prepare("SELECT COUNT(*) AS n FROM live_players WHERE room=?").bind(room.code).first();
    if (!count.n) fail("至少一位學生加入後才能開始。");
    await db.prepare("UPDATE live_rooms SET round=round+1,phase='open',deadline=? WHERE code=? AND round=? AND phase=?").bind(Date.now()+room.seconds*1000, room.code, room.round, room.phase).run();
  } else if (data.action === "close" && room.phase === "open") {
    await db.prepare("UPDATE live_rooms SET phase='reveal' WHERE code=? AND round=? AND phase='open'").bind(room.code, room.round).run();
  } else if (data.action === "finish" && room.phase === "reveal") {
    await db.prepare("UPDATE live_rooms SET phase='finished' WHERE code=? AND round=? AND phase='reveal'").bind(room.code, room.round).run();
  } else fail("目前無法執行這項操作。");
  return {ok: true};
}
export async function liveSnapshot(db: DB, code: string, secret: string) {
  const room = await roomFor(db, code.toUpperCase());
  const who = await identity(db, room, secret);
  const questions: Question[] = JSON.parse(room.questions);
  const revealed = ["reveal", "finished"].includes(room.phase);
  const q = questions[room.round];
  const leaderboard = await db.prepare(`SELECT p.id,p.name,COALESCE(SUM(a.points),0) AS score
    FROM live_players p LEFT JOIN live_answers a ON a.player=p.id AND (a.round<? OR ?=1)
    WHERE p.room=? GROUP BY p.id ORDER BY score DESC,p.name,p.id`).bind(room.round, revealed ? 1 : 0, room.code).all();
  const answers = await db.prepare("SELECT a.player,a.choice,a.correct,a.rank,a.points,p.name FROM live_answers a JOIN live_players p ON a.player=p.id WHERE a.room=? AND a.round=? ORDER BY a.id").bind(room.code, room.round).all();
  const mine = answers.results.find((a: any) => a.player === who.player?.id);
  return {code: room.code, title: room.title, phase: room.phase, round: room.round, total: questions.length,
    deadline: room.deadline, serverNow: Date.now(), host: who.host, me: who.player?.id,
    question: q ? {prompt: q.prompt, choices: q.choices.map(c => ({text: c.text, ...(revealed ? {correct: c.correct} : {})})), ...(revealed ? {explanation: q.explanation} : {})} : null,
    submitted: mine ? {choice: mine.choice, ...(revealed ? {correct: mine.correct, rank: mine.rank, points: mine.points} : {})} : null,
    answered: answers.results.length, players: leaderboard.results,
    results: revealed ? answers.results : [], expires: room.expires};
}
