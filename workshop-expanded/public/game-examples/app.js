const gameConfigs = {
  audit: {
    title: "選項鑑識",
    typeLabel: "JSON / CSV 題庫",
    path: "./data/quiz.json",
    schema: `沿用 quiz.json 的 questions / choices 結構。
或使用 CSV：question,A,B,C,D,answer,explanation
answer 填 A、B、C 或 D，多選以分號分隔，例如 A;C。
可另外加上 feedback_A、feedback_B、feedback_C、feedback_D。`,
  },
  quiz: {
    title: "選擇題闖關",
    typeLabel: "JSON 題庫",
    path: "./data/quiz.json",
    schema: `{
  "title": "遊戲標題",
  "questions": [
    {
      "prompt": "題目文字",
      "hint": "可省略的提示",
      "choices": [
        { "text": "選項", "correct": true, "feedback": "回饋" }
      ],
      "explanation": "答題後補充說明"
    }
  ]
}`,
  },
  memory: {
    title: "配對記憶",
    typeLabel: "JSON 題庫",
    path: "./data/memory.json",
    schema: `{
  "title": "遊戲標題",
  "pairs": [
    { "left": "名詞", "right": "定義", "feedback": "配對成功回饋" }
  ]
}`,
  },
  sort: {
    title: "排序挑戰",
    typeLabel: "CSV 題庫",
    path: "./data/sorting.csv",
    schema: `id,text,order,feedback
step-1,第一個項目,1,放在第 1 位的理由
step-2,第二個項目,2,放在第 2 位的理由`,
  },
  category: {
    title: "分類任務",
    typeLabel: "CSV 題庫",
    path: "./data/categorization.csv",
    schema: `item,category,feedback
教材項目,正確分類,為什麼屬於這一類
另一個項目,另一類,簡短解釋`,
  },
  scenario: {
    title: "情境判斷",
    typeLabel: "JSON 題庫",
    path: "./data/scenario.json",
    schema: `{
  "title": "遊戲標題",
  "start": "start",
  "nodes": {
    "start": {
      "prompt": "情境描述",
      "options": [
        { "text": "選擇", "next": "下一節點", "score": 1, "feedback": "回饋" }
      ]
    },
    "ending": {
      "ending": true,
      "prompt": "結局文字"
    }
  }
}`,
  },
};

const root = document.querySelector("#gameRoot");
const titleEl = document.querySelector("#gameTitle");
const typeEl = document.querySelector("#gameType");
const scoreEl = document.querySelector("#scoreValue");
const progressEl = document.querySelector("#progressValue");
const schemaEl = document.querySelector("#schemaText");
const fileInput = document.querySelector("#fileInput");
const reloadButton = document.querySelector("#reloadButton");
const navButtons = [...document.querySelectorAll(".nav-card")];

const state = {
  activeGame: "quiz",
  data: null,
  score: 0,
  progress: "0 / 0",
};

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const [headers, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] || ""])),
  );
}

async function loadData(gameId, fileText = null, fileName = "") {
  const config = gameConfigs[gameId];
  document.querySelector("#downloadTemplate").href = config.path;
  state.activeGame = gameId;
  setActiveNav(gameId);
  titleEl.textContent = config.title;
  typeEl.textContent = config.typeLabel;
  schemaEl.textContent = config.schema;
  root.innerHTML = `<div class="empty-state">題庫載入中...</div>`;

  try {
    let text = fileText;
    if (text === null) {
      const response = await fetch(config.path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      text = await response.text();
    }

    const isCsv = fileName.toLowerCase().endsWith(".csv") || (!fileName && config.path.endsWith(".csv"));
    const parsed = isCsv ? parseCsv(text.replace(/^\uFEFF/, "")) : JSON.parse(text);
    state.data = gameId === "audit" ? normalizeAudit(parsed, isCsv) : parsed;
    startGame(gameId);
  } catch (error) {
    root.innerHTML = `
      <div class="empty-state">
        <h3>題庫沒有載入成功</h3>
        <p>請用本機伺服器開啟這個資料夾，或按「上傳題庫」直接選擇 JSON/CSV 檔案。</p>
        <p><code id="loadError"></code></p>
      </div>
    `;
    root.querySelector("#loadError").textContent = String(error.message || error);
  }
}

function setActiveNav(gameId) {
  navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.game === gameId);
  });
}

function setScore(score, progress) {
  state.score = score;
  state.progress = progress;
  scoreEl.textContent = String(score);
  progressEl.textContent = progress;
}

function startGame(gameId) {
  if (gameId === "audit") renderAudit(state.data);
  if (gameId === "quiz") renderQuiz(state.data);
  if (gameId === "memory") renderMemory(state.data);
  if (gameId === "sort") renderSort(state.data);
  if (gameId === "category") renderCategory(state.data);
  if (gameId === "scenario") renderScenario(state.data);
}

function normalizeAudit(data, csv) {
  if (csv) {
    data = { title: "我的選項鑑識題庫", questions: data.map((row, i) => {
      const answers = String(row.answer || "").toUpperCase().split(/[;,、\s]+/).filter(Boolean);
      if (!answers.length || answers.some(key => !["A", "B", "C", "D"].includes(key) || !row[key]?.trim())) {
        throw new Error(`第 ${i + 1} 列 answer 請填有內容的選項代碼 A-D，多選以分號分隔。`);
      }
      return { prompt: row.question, explanation: row.explanation || "", choices: ["A", "B", "C", "D"].filter(key => row[key]?.trim()).map(key => ({text:row[key],correct:answers.includes(key),feedback:row[`feedback_${key}`] || ""})) };
    }) };
  }
  if (!Array.isArray(data?.questions) || !data.questions.length) throw new Error("題庫需要至少一題 questions。");
  data.questions.forEach((question, i) => {
    if (typeof question.prompt !== "string" || !question.prompt.trim() || !Array.isArray(question.choices) || question.choices.length < 2) throw new Error(`第 ${i + 1} 題需要題幹及至少兩個選項。`);
    if (question.choices.some(choice => typeof choice.text !== "string" || !choice.text.trim() || typeof choice.correct !== "boolean")) throw new Error(`第 ${i + 1} 題的 text 需有內容，correct 需為 true 或 false。`);
    if (!question.choices.some(choice => choice.correct)) throw new Error(`第 ${i + 1} 題尚未設定正確選項。`);
  });
  return data;
}

function renderAudit(data) {
  let index = 0;
  let score = 0;
  const mistakes = [];
  const total = data.questions.reduce((sum, question) => sum + question.choices.length, 0);
  titleEl.textContent = `選項鑑識：${data.title || "我的題庫"}`;
  setScore(0, `0 / ${data.questions.length}`);
  renderIntro("選項鑑識", "逐一判斷每個選項是否符合題意，再揭示解析。保留原題的『最適合』『不正確』等條件，所有選項都要判斷。", draw);

  function draw() {
    const question = data.questions[index];
    const selected = new Map();
    let submitted = false;
    setScore(score, `${index + 1} / ${data.questions.length}`);
    root.innerHTML = `<div class="audit-layout"><div class="prompt-box"><small>第 ${index + 1} 題</small><h3></h3></div><div class="audit-options"></div><label class="audit-reason">我的判斷依據（選填，不自動評分）<textarea rows="2" placeholder="哪個線索支持你的判斷？"></textarea></label><div class="feedback" role="status">每個選項都完成判斷後，即可核對。</div><button class="primary-action" id="auditCheck" disabled>核對所有選項</button><button class="secondary-action hidden" id="auditNext">下一題</button></div>`;
    root.querySelector("h3").textContent = question.prompt;
    const container = root.querySelector(".audit-options");
    shuffle(question.choices.map((choice, original) => ({choice, original}))).forEach(({choice, original}) => {
      const row = document.createElement("article");
      row.className = "audit-option";
      const title = document.createElement("p");
      title.textContent = choice.text;
      row.append(title);
      const controls = document.createElement("div");
      controls.className = "audit-decisions";
      controls.setAttribute("role", "group");
      controls.setAttribute("aria-label", choice.text);
      [true, false].forEach(value => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = value ? "符合題意" : "不符合題意";
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => {
          if (submitted) return;
          selected.set(original, value);
          controls.querySelectorAll("button").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
          root.querySelector("#auditCheck").disabled = selected.size !== question.choices.length;
        });
        controls.append(button);
      });
      row.append(controls);
      const feedback = document.createElement("p");
      feedback.className = "audit-explanation hidden";
      feedback.dataset.original = String(original);
      row.append(feedback);
      container.append(row);
    });
    root.querySelector("#auditCheck").addEventListener("click", () => {
      if (submitted || selected.size !== question.choices.length) return;
      submitted = true;
      let correct = 0;
      container.querySelectorAll(".audit-explanation").forEach(feedback => {
        const original = Number(feedback.dataset.original);
        const choice = question.choices[original];
        const success = selected.get(original) === choice.correct;
        if (success) { score += 100; correct++; }
        else mistakes.push({prompt:question.prompt, option:choice.text, feedback:choice.feedback || question.explanation || "請與教師核對判斷依據。"});
        feedback.textContent = `${success ? "判斷正確" : "需要修正"}：此選項${choice.correct ? "符合" : "不符合"}題意。${choice.feedback || ""}`;
        feedback.classList.remove("hidden");
        feedback.parentElement.classList.add(success ? "audit-correct" : "audit-wrong");
      });
      container.querySelectorAll("button").forEach(button => button.disabled = true);
      root.querySelector("#auditCheck").disabled = true;
      root.querySelector(".feedback").textContent = `${correct} / ${question.choices.length} 個選項判斷正確。${question.explanation || ""}「不符合題意」不等於選項本身永遠錯誤。`;
      setScore(score, `${index + 1} / ${data.questions.length}`);
      const next = root.querySelector("#auditNext");
      next.classList.remove("hidden");
      next.textContent = index === data.questions.length - 1 ? "查看鑑識報告" : "下一題";
    });
    root.querySelector("#auditNext").addEventListener("click", () => {
      if (!submitted) return;
      index++;
      if (index < data.questions.length) draw();
      else finish();
    });
  }
  function finish() {
    renderResult(score, total * 100, () => renderAudit(data), `完成 ${total} 個選項判斷，${mistakes.length} 項需要回顧。`);
    if (mistakes.length) {
      const list = document.createElement("div");
      list.className = "audit-review";
      mistakes.forEach(item => {
        const p = document.createElement("p");
        p.textContent = `${item.prompt}\n${item.option}\n${item.feedback}`;
        list.append(p);
      });
      root.querySelector(".intro").append(list);
      const retry = document.createElement("button");
      retry.className = "secondary-action";
      retry.textContent = "重練錯題";
      retry.addEventListener("click", () => renderAudit({...data, questions:data.questions.filter(q=>mistakes.some(item=>item.prompt===q.prompt))}));
      root.querySelector(".intro").append(retry);
    }
  }
}

function renderIntro(title, description, onStart) {
  root.innerHTML = `
    <div class="intro">
      <h3>${title}</h3>
      <p>${description}</p>
      <button class="primary-action" type="button">開始練習</button>
    </div>
  `;
  root.querySelector("button").addEventListener("click", () => onStart());
}

function renderQuiz(data) {
  const questions = data.questions || [];
  let index = 0;
  let score = 0;
  let answered = false;
  setScore(0, `0 / ${questions.length}`);
  titleEl.textContent = data.title || gameConfigs.quiz.title;

  renderIntro(
    titleEl.textContent,
    "每題選一個最適合的答案。答題後會看到即時回饋，適合概念辨識與形成性評量。",
    showQuestion,
  );

  function showQuestion() {
    answered = false;
    const question = questions[index];
    setScore(score, `${index + 1} / ${questions.length}`);
    root.innerHTML = `
      <div class="question-layout">
        <div class="prompt-box">
          <h3>${question.prompt}</h3>
          <p>${question.hint || ""}</p>
        </div>
        <div class="choices">
          ${question.choices
            .map(
              (choice, choiceIndex) =>
                `<button class="choice-button" type="button" data-choice="${choiceIndex}">${choice.text}</button>`,
            )
            .join("")}
        </div>
        <div class="feedback">請選擇一個答案。</div>
        <button class="secondary-action hidden" type="button" id="nextQuestion">下一題</button>
      </div>
    `;

    root.querySelectorAll(".choice-button").forEach((button) => {
      button.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const choice = question.choices[Number(button.dataset.choice)];
        if (choice.correct) score += 100;
        button.classList.add(choice.correct ? "is-correct" : "is-wrong");
        root.querySelectorAll(".choice-button").forEach((item, itemIndex) => {
          if (question.choices[itemIndex].correct) item.classList.add("is-correct");
        });
        root.querySelector(".feedback").innerHTML = `<strong>${choice.correct ? "答對了" : "再想想"}</strong><br>${choice.feedback || ""}<br>${question.explanation || ""}`;
        const next = root.querySelector("#nextQuestion");
        next.classList.remove("hidden");
        next.textContent = index === questions.length - 1 ? "看結果" : "下一題";
      });
    });

    root.querySelector("#nextQuestion").addEventListener("click", () => {
      index += 1;
      if (index >= questions.length) renderResult(score, questions.length * 100, () => renderQuiz(data));
      else showQuestion();
    });
  }
}

function renderMemory(data) {
  const pairs = data.pairs || [];
  let deck = [];
  let open = [];
  let matched = new Set();
  let turns = 0;
  setScore(0, `0 / ${pairs.length}`);
  titleEl.textContent = data.title || gameConfigs.memory.title;

  renderIntro(
    titleEl.textContent,
    "每次翻兩張牌，找出正確配對。適合名詞定義、雙語詞彙、人物主張等教材。",
    reset,
  );

  function reset() {
    deck = shuffle(
      pairs.flatMap((pair, pairId) => [
        { id: `${pairId}-left`, pairId, text: pair.left },
        { id: `${pairId}-right`, pairId, text: pair.right },
      ]),
    );
    open = [];
    matched = new Set();
    turns = 0;
    draw();
  }

  function draw(message = "翻兩張牌，找出一組正確配對。") {
    setScore((matched.size / 2) * 100, `${matched.size / 2} / ${pairs.length}`);
    root.innerHTML = `
      <div class="question-layout">
        <div class="feedback">${message}</div>
        <div class="memory-board">
          ${deck
            .map((card, index) => {
              const isOpen = open.includes(card.id) || matched.has(card.id);
              return `<button class="memory-card ${isOpen ? "is-open" : ""} ${matched.has(card.id) ? "is-matched" : ""}" type="button" data-card="${card.id}" aria-label="第 ${index + 1} 張牌">
                <span class="memory-inner"><strong>${isOpen ? card.text : "?"}</strong></span>
              </button>`;
            })
            .join("")}
        </div>
        <button class="secondary-action" type="button" id="restartMemory">重新洗牌</button>
      </div>
    `;
    root.querySelector("#restartMemory").addEventListener("click", reset);
    root.querySelectorAll(".memory-card").forEach((button) => {
      button.addEventListener("click", () => flip(button.dataset.card));
    });
  }

  function flip(cardId) {
    if (open.includes(cardId) || matched.has(cardId) || open.length >= 2) return;
    open.push(cardId);
    if (open.length < 2) {
      draw("再翻一張，找它的配對。");
      return;
    }

    turns += 1;
    const [first, second] = open.map((id) => deck.find((card) => card.id === id));
    if (first.pairId === second.pairId) {
      matched.add(first.id);
      matched.add(second.id);
      open = [];
      const feedback = pairs[first.pairId].feedback || "配對成功。";
      if (matched.size === deck.length) {
        renderResult(Math.max(100, pairs.length * 120 - turns * 8), pairs.length * 120, () => renderMemory(data));
      } else {
        draw(`配對成功：${feedback}`);
      }
    } else {
      draw("這兩張不是一組，請記住位置。");
      window.setTimeout(() => {
        open = [];
        draw("繼續找下一組配對。");
      }, 760);
    }
  }
}

function renderSort(rows) {
  let items = shuffle(rows.map((row) => ({ ...row, order: Number(row.order) })));
  let checked = false;
  setScore(0, `0 / ${items.length}`);
  titleEl.textContent = "排序挑戰：研究流程";

  renderIntro(
    titleEl.textContent,
    "用上下按鈕把項目排成正確順序。適合流程、年代、操作步驟、文本結構。",
    draw,
  );

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    checked = false;
    draw();
  }

  function draw() {
    const correct = items.filter((item, index) => item.order === index + 1).length;
    setScore(checked ? correct * 100 : 0, checked ? `${correct} / ${items.length}` : `0 / ${items.length}`);
    root.innerHTML = `
      <div class="question-layout">
        <div class="feedback">${checked ? "檢查結果如下。位置正確的項目會計分。" : "請調整成正確順序，完成後按檢查。"}</div>
        <div class="sort-list">
          ${items
            .map(
              (item, index) => `<div class="sort-item">
                <span class="sort-index">${index + 1}</span>
                <strong>${item.text}</strong>
                <span class="move-buttons">
                  <button type="button" data-move="${index}" data-direction="-1" aria-label="上移">↑</button>
                  <button type="button" data-move="${index}" data-direction="1" aria-label="下移">↓</button>
                </span>
                ${checked ? `<small>正確位置：${item.order}。${item.feedback || ""}</small>` : ""}
              </div>`,
            )
            .join("")}
        </div>
        <button class="check-button" type="button" id="checkSort">檢查順序</button>
      </div>
    `;
    root.querySelectorAll("[data-move]").forEach((button) => {
      button.addEventListener("click", () => move(Number(button.dataset.move), Number(button.dataset.direction)));
    });
    root.querySelector("#checkSort").addEventListener("click", () => {
      checked = true;
      draw();
    });
  }
}

function renderCategory(rows) {
  const categories = [...new Set(rows.map((row) => row.category))];
  const answers = new Map();
  let checked = false;
  setScore(0, `0 / ${rows.length}`);
  titleEl.textContent = "分類任務：變項類型";

  renderIntro(
    titleEl.textContent,
    "替每個項目選擇正確分類。適合概念歸類、案例判斷、錯誤類型辨識。",
    draw,
  );

  function draw() {
    const correct = rows.filter((row, index) => answers.get(index) === row.category).length;
    setScore(checked ? correct * 100 : 0, checked ? `${correct} / ${rows.length}` : `0 / ${rows.length}`);
    root.innerHTML = `
      <div class="question-layout">
        <div class="feedback">${checked ? "看每一格的回饋，修正你還不確定的分類。" : "請為每個項目選擇分類。"}</div>
        <div class="category-grid">
          ${rows
            .map((row, index) => {
              const selected = answers.get(index) || "";
              const status = checked ? (selected === row.category ? "is-correct" : "is-wrong") : "";
              return `<label class="category-row ${status}">
                <strong>${row.item}</strong>
                <select data-category="${index}">
                  <option value="">請選擇</option>
                  ${categories.map((category) => `<option value="${category}" ${selected === category ? "selected" : ""}>${category}</option>`).join("")}
                </select>
                <small>${checked ? row.feedback : " "}</small>
              </label>`;
            })
            .join("")}
        </div>
        <button class="check-button" type="button" id="checkCategory">檢查分類</button>
      </div>
    `;
    root.querySelectorAll("[data-category]").forEach((select) => {
      select.addEventListener("change", () => {
        answers.set(Number(select.dataset.category), select.value);
        checked = false;
      });
    });
    root.querySelector("#checkCategory").addEventListener("click", () => {
      checked = true;
      draw();
    });
  }
}

function renderScenario(data) {
  const nodes = data.nodes || {};
  let nodeId = data.start || "start";
  let score = 0;
  let steps = 0;
  titleEl.textContent = data.title || gameConfigs.scenario.title;
  setScore(0, "0 / 0");

  renderIntro(
    titleEl.textContent,
    "閱讀情境後做決策。不同選擇會走向不同節點，適合個案、倫理、臨床與管理判斷。",
    draw,
  );

  function draw(lastFeedback = "") {
    const node = nodes[nodeId];
    if (!node) {
      root.innerHTML = `<div class="empty-state">找不到節點：${nodeId}</div>`;
      return;
    }
    setScore(score, `${steps} 步`);
    if (node.ending) {
      renderResult(score, Math.max(score, 3), () => renderScenario(data), node.prompt);
      return;
    }
    root.innerHTML = `
      <div class="question-layout">
        <div class="prompt-box">
          <h3>${node.title || "請做出決策"}</h3>
          <p>${node.prompt}</p>
        </div>
        ${lastFeedback ? `<div class="feedback">${lastFeedback}</div>` : ""}
        <div class="scenario-options">
          ${(node.options || [])
            .map((option, index) => `<button type="button" data-option="${index}">${option.text}</button>`)
            .join("")}
        </div>
      </div>
    `;
    root.querySelectorAll("[data-option]").forEach((button) => {
      button.addEventListener("click", () => {
        const option = node.options[Number(button.dataset.option)];
        score += Number(option.score || 0);
        steps += 1;
        nodeId = option.next;
        draw(option.feedback || "");
      });
    });
  }
}

function renderResult(score, maxScore, restart, note = "練習完成。") {
  setScore(score, `${score} / ${maxScore}`);
  root.innerHTML = `
    <div class="intro">
      <h3>完成</h3>
      <p>${note}</p>
      <div class="result-grid">
        <div><span>得分</span><strong>${score}</strong></div>
        <div><span>滿分參考</span><strong>${maxScore}</strong></div>
        <div><span>達成率</span><strong>${Math.round((score / Math.max(1, maxScore)) * 100)}%</strong></div>
      </div>
      <button class="primary-action" type="button">再玩一次</button>
    </div>
  `;
  root.querySelector("button").addEventListener("click", restart);
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => loadData(button.dataset.game));
});

reloadButton.addEventListener("click", () => loadData(state.activeGame));

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  const text = await file.text();
  loadData(state.activeGame, text, file.name);
  fileInput.value = "";
});

loadData("quiz");
