import { useEffect, useRef, useState } from "react";
import { KURO } from "../../config/balance";
import { CHAPTERS, FRAGMENTS, Line, LOOP_INTROS, SPEAKER_NAME } from "../../config/story";
import { feedKuro, kuroFeedCost, kuroMood, KuroMood, kuroTap, petKuro, petWaitMs } from "../../core/actions";
import { fmtDuration } from "../../core/format";
import { chapterOf } from "../../core/formulas";
import { buzz, sfx } from "../../services/feedback";
import { drawKuro } from "../render/shapes";
import { store, useGame } from "../store";
import { Btn, Sheet } from "./common";
import { toast } from "./Toasts";

const MOOD_TEXT: Record<KuroMood, string> = {
  happy: "😸 心情好好，呼嚕呼嚕…",
  wantPet: "😾 「喂，你係咪唔記得咗啲嘢？摸我。」",
  sulk: "🙀 「你仲記得有隻貓㗎？哼。」（嬲緊，摸佢有雙倍魚乾）",
};

// Animated Kuro drawn with same shape as battle → one look everywhere.
function KuroPortrait({ size = 110, happy }: { size?: number; happy?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    cv.width = size * dpr;
    cv.height = size * dpr;
    const c = cv.getContext("2d")!;
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, size, size);
      const time = (t - t0) / 1000 * (happy ? 1.6 : 1);
      drawKuro(c, size * 0.55, size * 0.55, size * 0.3, time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size, happy]);
  return <canvas ref={ref} style={{ width: size, height: size }} />;
}

export function KuroPanel({ onClose, onStory }: { onClose: () => void; onStory: (title: string, lines: Line[]) => void }) {
  const [tab, setTab] = useState<"grow" | "story">("grow");
  return (
    <Sheet title="黑貓 Kuro" onClose={onClose} tall>
      <div className="seg">
        <button className={tab === "grow" ? "on" : ""} onClick={() => setTab("grow")}>培養</button>
        <button className={tab === "story" ? "on" : ""} onClick={() => setTab("story")}>故事</button>
      </div>
      {tab === "grow" ? <KuroGrow /> : <KuroStory onStory={onStory} />}
    </Sheet>
  );
}

function KuroGrow() {
  const s = useGame();
  const k = s.kuro;
  const now = Date.now();
  const mood = kuroMood(s, now);
  const wait = petWaitMs(s, now);
  const maxed = k.level >= KURO.maxLevel;
  const cost = kuroFeedCost(s);
  const canFeed = !maxed && k.fish >= cost;
  const autoUnlocked = k.level >= KURO.autoCastLevel;
  const L = k.level, N = Math.min(KURO.maxLevel, L + 1);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const rows: [string, string, string, string][] = [
    ["🐾", "貓爪傷害", `攻擊 ×${KURO.strikeMult(L).toFixed(1)}`, `×${KURO.strikeMult(N).toFixed(1)}`],
    ["⏱️", "貓爪冷卻", `${KURO.cooldown(L).toFixed(1)}s`, `${KURO.cooldown(N).toFixed(1)}s`],
    ["🪙", "金幣加成", `+${pct((L - 1) * KURO.goldPerLevel)}`, `+${pct((N - 1) * KURO.goldPerLevel)}`],
    ["🌙", "離線上限", `+${Math.round((L - 1) * KURO.offlineHoursPerLevel * 60)} 分鐘`, `+${Math.round((N - 1) * KURO.offlineHoursPerLevel * 60)} 分鐘`],
  ];

  return (
    <div className="kuro-grow">
      <div className="kuro-hero">
        <div className={`kuro-pic ${k.buffLeft > 0 ? "blessed" : ""}`}><KuroPortrait happy={mood === "happy"} /></div>
        <div className="kuro-info">
          <div className="kuro-name">Kuro <span className="lv">Lv.{k.level}</span></div>
          <div className="kuro-mood">{MOOD_TEXT[mood]}</div>
          <div className="kuro-fish">🐟 魚乾 <b>{k.fish}</b></div>
        </div>
      </div>

      {k.buffLeft > 0 && (
        <div className="kuro-buff">✨ 貓貓祝福：金幣、經驗 +{pct(KURO.buffMult)}（剩 {fmtDuration(k.buffLeft)}）</div>
      )}

      <div className="kuro-actions">
        <Btn color={wait > 0 ? "gray" : "orange"} disabled={wait > 0} dot={wait === 0} onClick={() => {
          const r = store.act((g) => petKuro(g, Date.now()));
          if (!r) return;
          sfx.win();
          buzz(30);
          toast(r.sulk ? `Kuro 原諒你喇～ 🐟+${r.fish}` : `呼嚕呼嚕～ 🐟+${r.fish}`, "#ffd23f");
        }}>
          {wait > 0 ? `再摸要等 ${fmtDuration(wait / 1000)}` : "🤚 摸摸 Kuro"}
        </Btn>
        <Btn color={canFeed ? "green" : "gray"} disabled={!canFeed} onClick={() => {
          if (store.act((g) => feedKuro(g))) {
            sfx.levelUp();
            buzz(20);
            toast(`Kuro 升到 Lv.${k.level}！`, "#c77dff");
            if (k.level === KURO.autoCastLevel) toast("解鎖自動貓爪！", "#ffd23f");
          }
        }}>
          {maxed ? "已滿級" : `🐟 ${cost} 餵食升級`}
        </Btn>
      </div>

      <div className="kuro-stats">
        {rows.map(([icon, name, cur, next]) => (
          <div key={name} className="ks-row">
            <span className="ks-icon">{icon}</span>
            <span className="ks-name">{name}</span>
            <span className="ks-cur">{cur}</span>
            {!maxed && <span className="ks-next">→ {next}</span>}
          </div>
        ))}
        <div className="ks-row">
          <span className="ks-icon">🤖</span>
          <span className="ks-name">自動貓爪</span>
          {autoUnlocked ? (
            <button className={`toggle ${k.auto ? "on" : ""}`} onClick={() => store.act((g) => { g.kuro.auto = !g.kuro.auto; })}>
              {k.auto ? "開" : "關"}
            </button>
          ) : (
            <span className="ks-cur locked">Lv.{KURO.autoCastLevel} 解鎖</span>
          )}
        </div>
      </div>

      <div className="kuro-hint">
        魚乾點拎：打贏 Boss（章節魔王 ×{KURO.chapterBossFishMult}）、每 {KURO.petCooldownHours} 粒鐘摸一次 Kuro。
        太耐冇摸佢會嬲，但係哄返佢有雙倍魚乾。
      </div>
    </div>
  );
}

function KuroStory({ onStory }: { onStory: (title: string, lines: Line[]) => void }) {
  const s = useGame();
  const reached = Math.max(s.kuro.storySeen, chapterOf(s.life.bestStage));
  return (
    <div className="kuro-story">
      <div className="ks-head">章節</div>
      {CHAPTERS.map((ch, i) => {
        const open = reached >= i + 1;
        return (
          <button key={i} className={`story-row ${open ? "" : "locked"}`} disabled={!open}
            onClick={() => { sfx.tap(); onStory(`第${i + 1}章 · ${ch.title}`, ch.intro); }}>
            <span className="sr-num">{i + 1}</span>
            <span className="sr-title">{open ? ch.title : "？？？"}</span>
            <span className="sr-go">{open ? "▶" : "🔒"}</span>
          </button>
        );
      })}
      <div className="ks-head">記憶碎片 <small>（每次轉生解鎖一塊）</small></div>
      {FRAGMENTS.map((f, i) => {
        const open = s.life.rebirths > i;
        return (
          <button key={i} className={`story-row frag ${open ? "" : "locked"}`} disabled={!open}
            onClick={() => { sfx.tap(); onStory(f.title, f.lines); }}>
            <span className="sr-num">💠</span>
            <span className="sr-title">{open ? f.title : `轉生 ${i + 1} 次解鎖`}</span>
            <span className="sr-go">{open ? "▶" : "🔒"}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Dialogue box: tap to next line ──
const AVATAR: Record<string, string> = { hero: "🧝", lord: "😈" };

export function Dialogue({ title, lines, onDone }: { title: string; lines: Line[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const line = lines[i];
  const next = () => {
    sfx.tap();
    if (i + 1 >= lines.length) onDone();
    else setI(i + 1);
  };
  return (
    <div className="dlg-wrap" onClick={next}>
      <div className="dlg-title">{title}</div>
      <div className={`dlg-box who-${line.who}`}>
        {line.who === "kuro" && <div className="dlg-ava kuro"><KuroPortrait size={70} /></div>}
        {AVATAR[line.who] && <div className="dlg-ava">{AVATAR[line.who]}</div>}
        <div className="dlg-main">
          {SPEAKER_NAME[line.who] && <div className="dlg-name">{SPEAKER_NAME[line.who]}</div>}
          <div className="dlg-text" key={i}>{line.text}</div>
        </div>
        <div className="dlg-foot">
          <span>{i + 1}/{lines.length}</span>
          <button className="dlg-skip" onClick={(e) => { e.stopPropagation(); onDone(); }}>跳過 ⏭</button>
          <span className="dlg-next">▼</span>
        </div>
      </div>
    </div>
  );
}

// What story should pop now? Chapter intro first, then memory fragment after rebirth.
export function pendingStory(s: ReturnType<typeof useGame>): { title: string; lines: Line[]; done: () => void } | null {
  const ch = chapterOf(s.stage);
  if (ch > s.kuro.storySeen) {
    const done = () => store.act((g) => { g.kuro.storySeen = Math.max(g.kuro.storySeen, ch); });
    if (ch <= CHAPTERS.length) {
      const c = CHAPTERS[ch - 1];
      return { title: `第${ch}章 · ${c.title}`, lines: c.intro, done };
    }
    const bi = (ch - 1) % CHAPTERS.length;
    return { title: `第${ch}章 · ${CHAPTERS[bi].title}（再臨）`, lines: [{ who: "kuro", text: LOOP_INTROS[bi] }], done };
  }
  const f = s.kuro.fragmentsSeen;
  if (s.life.rebirths > f && f < FRAGMENTS.length) {
    return { title: FRAGMENTS[f].title, lines: FRAGMENTS[f].lines, done: () => store.act((g) => { g.kuro.fragmentsSeen++; }) };
  }
  return null;
}

// ── Claw button on battle screen, ring show cooldown ──
export function KuroButton() {
  const s = useGame();
  const k = s.kuro;
  const cdMax = KURO.cooldown(k.level);
  const ready = k.strikeCd <= 0;
  const hasTarget = !!s.battle.enemy;
  const auto = k.auto && k.level >= KURO.autoCastLevel;
  const prog = 1 - k.strikeCd / cdMax;
  return (
    <button
      className={`kuro-btn ${ready && hasTarget ? "ready" : ""}`}
      style={{ ["--p" as any]: `${prog * 360}deg` }}
      onClick={() => {
        if (store.act((g, rng) => kuroTap(g, rng, store.emitter))) { sfx.hit(true); buzz(25); }
      }}
    >
      <span className="kb-icon">🐾</span>
      {!ready && <span className="kb-cd">{Math.ceil(k.strikeCd)}</span>}
      {auto && <span className="kb-auto">AUTO</span>}
    </button>
  );
}
