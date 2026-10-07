// Same quoted-field CSV format as the individual game templates.
export function parseBank(text, filename) {
  text = text.replace(/^\uFEFF/, "");
  if (!filename.toLowerCase().endsWith(".csv")) return JSON.parse(text);
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i=0; i<text.length; i++) {
    const char = text[i], next = text[i+1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("CSV 引號未關閉。");
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  const [headers, ...records] = rows;
  if (!headers || !["question","A","B","answer"].every(h => headers.includes(h))) throw new Error("CSV 需有 question,A,B,C,D,answer,explanation 欄位。");
  return {title: filename.replace(/\.csv$/i, ""), questions: records.map((record, i) => {
    if (record.length !== headers.length) throw new Error(`第 ${i+1} 題欄數不符，含逗號的文字請加雙引號。`);
    const r = Object.fromEntries(headers.map((h,j) => [h,record[j]]));
    const answer = r.answer.toUpperCase();
    if (!/^[A-D]$/.test(answer) || !r[answer]) throw new Error(`第 ${i+1} 題 answer 請填單一 A、B、C 或 D；多選題請使用選項鑑識。`);
    return {prompt: r.question, choices: ["A","B","C","D"].filter(k => r[k]).map(k => ({text:r[k],correct:k === answer})), explanation: r.explanation || ""};
  })};
}
