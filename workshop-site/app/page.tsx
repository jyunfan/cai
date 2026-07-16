"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Card = {
  id: string;
  pairId: number;
  text: string;
  language: "中文" | "English";
  accent: string;
};

const WORD_PAIRS = [
  { zh: "蘋果", en: "apple", accent: "coral" },
  { zh: "月亮", en: "moon", accent: "blue" },
  { zh: "小貓", en: "cat", accent: "yellow" },
  { zh: "花朵", en: "flower", accent: "pink" },
  { zh: "星星", en: "star", accent: "purple" },
  { zh: "雨傘", en: "umbrella", accent: "mint" },
  { zh: "書本", en: "book", accent: "orange" },
  { zh: "蝴蝶", en: "butterfly", accent: "sky" },
];

const promptOne = `請幫我做一個 4×4 的卡片記憶遊戲。
共有 8 組中英文單字，玩家每回合翻兩張牌，
翻到正確的中英對照就保留。完成時顯示回合數。`;

const promptTwo = `請修改遊戲：
1. 改成可愛、色彩繽紛，但文字要適合投影
2. 加入開始畫面、玩法提示、重新開始
3. 回合數越少，分數越高
4. 配對成功與失敗要有不同的即時回饋
5. 手機、鍵盤也可以操作`;

const slides = [
  { kicker: "LIVE BUILD · 45–60 MIN", title: "用 AI Agent 做出一個教學小遊戲", subtitle: "從一句需求，到可玩的中英配對記憶遊戲" },
  { kicker: "01 · 先定義學習", title: "不是先說「幫我做遊戲」", subtitle: "先說清楚：學生要練什麼、怎麼算成功" },
  { kicker: "02 · 第一輪指令", title: "先做出最小可玩版本", subtitle: "把規則、內容、完成條件交代清楚" },
  { kicker: "03 · 驗收，而不是接受", title: "Agent 做完後，我要看什麼？", subtitle: "用教師的眼睛測試，不需要先讀程式碼" },
  { kicker: "04 · 第二輪指令", title: "把模糊感受改寫成可驗收條件", subtitle: "「更好看」太模糊；請說明畫面、回饋與裝置" },
  { kicker: "05 · 看懂遊戲邏輯", title: "一句規則，背後是四個狀態", subtitle: "翻牌 → 判斷 → 回饋 → 繼續" },
  { kicker: "06 · 分數設計", title: "回合越少，分數越高", subtitle: "分數要鼓勵學習策略，不只是增加刺激" },
  { kicker: "07 · 版本演進", title: "一次只改一組問題", subtitle: "每一輪都能比較、測試、保留" },
  { kicker: "08 · LIVE DEMO", title: "現在，來挑戰 8 組中英配對", subtitle: "理論最佳成績是 8 回合，你能多接近？" },
  { kicker: "09 · 把 Demo 變成教學", title: "遊戲玩完，學習才正要開始", subtitle: "用結果引導學生回想、說明與再練習" },
  { kicker: "10 · 換成你的教材", title: "只換資料，不必重做遊戲", subtitle: "保留玩法，替換成統計、醫護、商管或通識概念" },
  { kicker: "11 · 帶走一個工作流程", title: "你指揮方向，Agent 加速實作", subtitle: "設計 → 生成 → 測試 → 修改 → 教學化" },
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createDeck(): Card[] {
  return shuffle(
    WORD_PAIRS.flatMap((pair, pairId) => [
      { id: `${pairId}-zh`, pairId, text: pair.zh, language: "中文" as const, accent: pair.accent },
      { id: `${pairId}-en`, pairId, text: pair.en, language: "English" as const, accent: pair.accent },
    ]),
  );
}

function MemoryGame({ onClose }: { onClose: () => void }) {
  const [deck, setDeck] = useState<Card[]>(() => createDeck());
  const [started, setStarted] = useState(false);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [message, setMessage] = useState("準備好了嗎？先記住：要找中英對照！");
  const [locked, setLocked] = useState(false);
  const finished = matched.length === deck.length && started;
  const score = Math.max(100, 1200 - Math.max(0, moves - 8) * 70);

  const restart = () => {
    setDeck(createDeck());
    setStarted(true);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setLocked(false);
    setMessage("開始！每次翻兩張，找出中英好朋友。");
  };

  const flipCard = (card: Card) => {
    if (!started || locked || flipped.includes(card.id) || matched.includes(card.id)) return;
    const next = [...flipped, card.id];
    setFlipped(next);
    if (next.length !== 2) {
      setMessage(card.language === "中文" ? "接著找它的英文！" : "接著找它的中文！");
      return;
    }

    setMoves((value) => value + 1);
    setLocked(true);
    const [firstId, secondId] = next;
    const first = deck.find((item) => item.id === firstId)!;
    const second = deck.find((item) => item.id === secondId)!;
    const isMatch = first.pairId === second.pairId && first.language !== second.language;

    window.setTimeout(() => {
      if (isMatch) {
        setMatched((current) => [...current, firstId, secondId]);
        setMessage(`配對成功！${first.text} ↔ ${second.text}`);
      } else {
        setMessage("還不是一對，再記一下它們的位置！");
      }
      setFlipped([]);
      setLocked(false);
    }, isMatch ? 520 : 900);
  };

  useEffect(() => {
    if (finished) setMessage("全部找到啦！你完成了 8 組中英配對！");
  }, [finished]);

  return (
    <div className="game-shell" role="dialog" aria-modal="true" aria-label="中英配對記憶遊戲">
      <div className="game-topbar">
        <div className="game-brand"><span>✦</span> WORD POP! <small>中英配對記憶遊戲</small></div>
        <button className="icon-button" onClick={onClose} aria-label="關閉遊戲">×</button>
      </div>
      <div className="game-layout">
        <aside className="game-sidebar">
          <div className="eyebrow">MEMORY MISSION</div>
          <h2>翻出一對<br /><em>中英好朋友</em></h2>
          <p>每回合翻兩張卡片。只有「中文＋正確英文」才算配對成功。</p>
          <div className="score-row">
            <div><span>回合</span><strong>{moves}</strong></div>
            <div><span>配對</span><strong>{matched.length / 2}<small>/8</small></strong></div>
            <div><span>分數</span><strong>{score}</strong></div>
          </div>
          <div className="feedback" aria-live="polite">{message}</div>
          <button className="primary-button" onClick={restart}>{started ? "重新洗牌" : "開始挑戰"}</button>
          <p className="tiny-note">分數規則：8 回合 1200 分，每多一回合扣 70 分。</p>
        </aside>
        <main className="board-wrap">
          <div className="memory-board" aria-label="4 乘 4 記憶卡牌">
            {deck.map((card, index) => {
              const isFaceUp = flipped.includes(card.id) || matched.includes(card.id);
              const isMatched = matched.includes(card.id);
              return (
                <button
                  key={card.id}
                  className={`memory-card ${isFaceUp ? "is-flipped" : ""} ${isMatched ? "is-matched" : ""}`}
                  onClick={() => flipCard(card)}
                  disabled={!started || isMatched || locked}
                  aria-label={isFaceUp ? `${card.language}：${card.text}` : `第 ${index + 1} 張卡片，背面`}
                >
                  <span className="card-inner">
                    <span className="card-back"><b>?</b><i>✦</i></span>
                    <span className={`card-front ${card.accent}`}><small>{card.language}</small><b>{card.text}</b><i>{isMatched ? "MATCH!" : "翻到了"}</i></span>
                  </span>
                </button>
              );
            })}
          </div>
          {!started && <div className="board-curtain"><span>🍭</span><h3>準備開始記憶任務</h3><p>找出 8 組中文與英文配對</p><button onClick={restart}>開始遊戲</button></div>}
          {finished && <div className="finish-card"><span>★</span><p>MISSION COMPLETE</p><h3>{moves} 回合完成</h3><strong>{score} 分</strong><button onClick={restart}>再玩一次</button></div>}
        </main>
      </div>
    </div>
  );
}

function PromptCard({ label, children }: { label: string; children: string }) {
  return <div className="prompt-card"><div className="prompt-label"><span>›_</span>{label}</div><pre>{children}</pre></div>;
}

export default function Home() {
  const [slide, setSlide] = useState(0);
  const [gameOpen, setGameOpen] = useState(false);
  const current = slides[slide];

  const go = useCallback((direction: number) => {
    setSlide((value) => Math.min(slides.length - 1, Math.max(0, value + direction)));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (gameOpen) {
        if (event.key === "Escape") setGameOpen(false);
        return;
      }
      if (["ArrowRight", "PageDown", " "].includes(event.key)) go(1);
      if (["ArrowLeft", "PageUp"].includes(event.key)) go(-1);
      if (event.key === "Home") setSlide(0);
      if (event.key === "End") setSlide(slides.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gameOpen, go]);

  const content = useMemo(() => {
    switch (slide) {
      case 0:
        return <div className="hero-content"><div className="hero-sticker">今天會完成<br /><strong>1 套簡報＋1 個遊戲</strong></div><div className="mini-cards" aria-hidden="true"><span>蘋果</span><span>APPLE</span><span>?</span><span>?</span></div><div className="outcome-row"><span>看懂 Agent 協作</span><span>學會修改指令</span><span>帶走可玩成品</span></div></div>;
      case 1:
        return <div className="three-columns"><article><b>學習目標</b><h3>辨識 8 組中英單字</h3><p>學生能建立詞義與拼字的連結。</p></article><article><b>學生任務</b><h3>翻出正確對照</h3><p>不是找兩張一樣，而是找跨語言配對。</p></article><article><b>成功證據</b><h3>少回合完成</h3><p>記得位置，也辨認得出意思。</p></article><div className="formula">學習目標 <i>→</i> 學生任務 <i>→</i> 遊戲挑戰 <i>→</i> 即時回饋</div></div>;
      case 2:
        return <div className="split"><PromptCard label="給 Agent 的第一輪指令">{promptOne}</PromptCard><div className="annotation-list"><span>01</span><p><strong>數量明確</strong>4×4、8 組配對</p><span>02</span><p><strong>判定明確</strong>必須是中英對照</p><span>03</span><p><strong>完成明確</strong>顯示回合數</p></div></div>;
      case 3:
        return <div className="check-grid"><article><span>PLAY</span><h3>真的玩一遍</h3><p>能不能開始、翻牌、配對、結束？</p></article><article><span>CHECK</span><h3>故意答錯</h3><p>錯誤會翻回去嗎？會不會卡住？</p></article><article><span>READ</span><h3>站遠一點看</h3><p>投影文字夠大？玩法不用解釋也懂？</p></article><article><span>ASK</span><h3>記下修改清單</h3><p>一次整理「問題＋期待結果」交回 Agent。</p></article></div>;
      case 4:
        return <div className="split wide-prompt"><PromptCard label="第二輪：讓需求可驗收">{promptTwo}</PromptCard><div className="before-after"><div><small>不要只說</small><s>畫面可愛一點</s></div><div><small>改成這樣說</small><strong>色彩繽紛、圓角卡片、投影清楚、配對有動畫回饋</strong></div></div></div>;
      case 5:
        return <div className="state-flow"><div><span>1</span><b>第一張</b><small>記住卡片</small></div><i>→</i><div><span>2</span><b>第二張</b><small>回合 +1</small></div><i>→</i><div><span>3</span><b>是否配對？</b><small>比較配對編號</small></div><i>→</i><div><span>4</span><b>更新畫面</b><small>保留或翻回</small></div><aside>請 Agent 說明「資料放哪裡、配對怎麼判斷、分數怎麼算」，你就能掌握修改入口。</aside></div>;
      case 6:
        return <div className="score-explainer"><div className="big-score"><span>SCORE</span><strong>1200</strong><small>−（回合數 − 8）× 70</small></div><div><article><b>8 回合</b><strong>1200 分</strong><p>理論最佳</p></article><article><b>12 回合</b><strong>920 分</strong><p>穩定完成</p></article><article><b>18 回合</b><strong>500 分</strong><p>再練一次</p></article></div><p className="teacher-note">教學提醒：分數只回饋策略，不應取代「是否真正學會」的判斷。</p></div>;
      case 7:
        return <div className="versions"><article><span>V0</span><h3>一句想法</h3><p>想做中英配對遊戲</p></article><i>→</i><article><span>V1</span><h3>先能玩</h3><p>16 張牌、配對、回合</p></article><i>→</i><article><span>V2</span><h3>變好用</h3><p>回饋、分數、重新開始</p></article><i>→</i><article><span>V3</span><h3>教學化</h3><p>提示、反思、替換題庫</p></article></div>;
      case 8:
        return <div className="demo-launch"><div className="demo-deck" aria-hidden="true"><span>月亮</span><span>MOON</span></div><div><p>講師 Demo 建議</p><ol><li>先故意翻錯，展示即時回饋</li><li>完成一組，說明中英判定</li><li>重新洗牌，展示可重複練習</li></ol><button onClick={() => setGameOpen(true)}>▶ 開啟遊戲 Demo</button></div></div>;
      case 9:
        return <div className="reflection"><article><span>玩前</span><h3>預測</h3><p>哪幾組單字最容易混淆？</p></article><article><span>玩中</span><h3>說出理由</h3><p>翻牌時，把英文念出來或造句。</p></article><article><span>玩後</span><h3>回想與再練</h3><p>寫下最慢找到的 2 組，解釋差異。</p></article><blockquote>遊戲紀錄告訴我們「表現」，教師提問才把它轉成「學習」。</blockquote></div>;
      case 10:
        return <div className="customize"><PromptCard label="直接貼給 Agent">{`請保留目前的玩法、版面與分數規則，
只把 8 組中英單字換成以下教材內容：

【在這裡貼上 8 組概念】

並把配對成功回饋改成一句簡短解釋。
修改完成後，請列出你改了哪些地方。`}</PromptCard><div className="subject-tags"><span>統計：方法 ↔ 情境</span><span>醫護：症狀 ↔ 處置</span><span>商管：概念 ↔ 案例</span><span>通識：人物 ↔ 主張</span></div></div>;
      default:
        return <div className="closing"><div className="loop"><span>1<br /><b>設計</b></span><span>2<br /><b>生成</b></span><span>3<br /><b>測試</b></span><span>4<br /><b>修改</b></span><span>5<br /><b>教學化</b></span></div><div className="takeaway"><strong>今天不是學會所有程式碼，</strong><br />而是學會把教學判斷，變成 Agent 能執行的指令。</div><button onClick={() => setGameOpen(true)}>再玩一次 Demo →</button></div>;
    }
  }, [slide]);

  return (
    <main className={`presentation slide-${slide}`}>
      <header className="deck-header"><div className="deck-logo"><span>CAI</span> AGENT LAB</div><div className="deck-meta">大學教師 AI Agent 工作坊</div></header>
      <section className="slide-stage" aria-live="polite">
        <div className="title-block"><p>{current.kicker}</p><h1>{current.title}</h1><h2>{current.subtitle}</h2></div>
        <div className="slide-content">{content}</div>
      </section>
      <footer className="deck-footer">
        <div className="progress"><span style={{ width: `${((slide + 1) / slides.length) * 100}%` }} /></div>
        <button onClick={() => go(-1)} disabled={slide === 0} aria-label="上一頁">←</button>
        <span><b>{String(slide + 1).padStart(2, "0")}</b> / {String(slides.length).padStart(2, "0")}</span>
        <button onClick={() => go(1)} disabled={slide === slides.length - 1} aria-label="下一頁">→</button>
        <small>方向鍵切換 · F11 全螢幕</small>
      </footer>
      {gameOpen && <MemoryGame onClose={() => setGameOpen(false)} />}
    </main>
  );
}
