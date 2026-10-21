import { useEffect, useRef, useState } from "react";
import { BALANCE, CORRUPTION, REBIRTH } from "../config/balance";
import { BIOMES } from "../config/content";
import { availableJobs, buyTraining, canChangeJob, canRebirth, challengeBoss, corruptionUnlocked, rebirthShards } from "../core/actions";
import { dailyClaimable, loginClaimable } from "../core/daily";
import { fmt } from "../core/format";
import { biomeIndex, chapterOf, expToNext, stageInChapter, trainingCost } from "../core/formulas";
import { rarityIndex } from "../core/items";
import { computeStats, powerWith } from "../core/stats";
import { buzz, sfx } from "../services/feedback";
import { BattleRenderer } from "./render/BattleRenderer";
import { store, useGame } from "./store";
import { RARITY_COLOR } from "./theme";
import { BIOME_NAME, CORRUPTION_NAME, itemName, RARITY_NAME } from "./names";
import { Amount, Bar, Btn } from "./components/common";
import { HeroPanel } from "./components/HeroPanel";
import { CorruptionPanel, DailyPanel, LoginPanel, OfflineModal, RebirthPanel, SettingsPanel, ShopPanel, TrainPanel } from "./components/Panels";
import { toast, Toasts } from "./components/Toasts";
import { Tutorial } from "./components/Tutorial";

type Panel = null | "hero" | "train" | "rebirth" | "shop" | "daily" | "login" | "corruption" | "settings";

export function App() {
  const s = useGame();
  const [panel, setPanel] = useState<Panel>(null);
  const [powerPop, setPowerPop] = useState(0);
  const st = computeStats(s);
  const lastPower = useRef(st.power);

  // power up popup (dopamine number)
  useEffect(() => {
    if (st.power > lastPower.current * 1.001 && lastPower.current > 0) setPowerPop(st.power - lastPower.current);
    lastPower.current = st.power;
  }, [st.power]);
  useEffect(() => {
    if (!powerPop) return;
    const t = setTimeout(() => setPowerPop(0), 1200);
    return () => clearTimeout(t);
  }, [powerPop]);

  // sim event → sound / toast (not every hit; renderer do visual)
  useEffect(() => store.onEvent((e) => {
    switch (e.t) {
      case "heroHit": sfx.hit(e.crit); break;
      case "kill": sfx.kill(); break;
      case "levelUp": sfx.levelUp(); buzz(20); break;
      case "bossStart": sfx.boss(); buzz(40); break;
      case "bossWin": sfx.win(); buzz(50); break;
      case "bossFail": sfx.fail(); break;
      case "bagFull": toast("背包滿咗！自動分解", "#ff9b3d"); break;
      case "loot": {
        const tier = rarityIndex(e.item.rarity);
        if (tier >= 2) sfx.loot(tier);
        if (tier >= 3 || (e.equipped && tier >= 1)) {
          toast(`${e.equipped ? "已裝備 " : "獲得 "}[${RARITY_NAME[e.item.rarity]}] ${itemName(e.item)}`, RARITY_COLOR[e.item.rarity]);
        }
        break;
      }
    }
  }), []);

  const now = Date.now();
  const dots = {
    daily: dailyClaimable(s) > 0,
    login: loginClaimable(s, now),
    hero: availableJobs(s).some((j) => canChangeJob(s, j)) || s.bag.some((it) => powerWith(s, it) > st.power),
    train: s.gold >= trainingCost("atk", s.training.atk),
    rebirth: canRebirth(s) && rebirthShards(s) >= 20,
  };

  const biome = BIOMES[biomeIndex(s.stage)];
  const expNeed = expToNext(s.level);

  return (
    <div className="app">
      <div className="topbar">
        <div className="avatar" onClick={() => setPanel("settings")}>
          <div className="av-face">🐱</div>
          <div className="av-lv">{s.level}</div>
        </div>
        <div className="top-mid">
          <div className="exp-row">
            <Bar k={s.exp / expNeed} color="linear-gradient(#9ee8ff,#3fb6ff)" h={10} />
          </div>
          <div className="cur-row">
            <span className="cur-pill"><Amount c="gold" n={s.gold} /></span>
            <span className="cur-pill"><Amount c="stone" n={s.stones} /></span>
            <span className="cur-pill gem" onClick={() => setPanel("shop")}><Amount c="gem" n={s.gems} /><b className="plus">+</b></span>
          </div>
        </div>
      </div>

      <div className="stage-bar">
        <div className="stage-name">
          <span className="chap">第{chapterOf(s.stage)}章 · {BIOME_NAME[biome.id]}</span>
          <span className="stg">{chapterOf(s.stage)}-{stageInChapter(s.stage)}</span>
          {s.corruption > 0 && <span className="corr-tag">{CORRUPTION_NAME[s.corruption]}</span>}
        </div>
        <div className="pips">
          {Array.from({ length: BALANCE.killsPerStage }).map((_, i) => (
            <span key={i} className={`pip ${i < s.kills ? "on" : ""} ${s.bossReady ? "ready" : ""}`} />
          ))}
          <BossButton />
        </div>
      </div>

      <div className="battle-area">
        <BattleCanvas />
        <div className="side left">
          <SideIcon icon="📅" label="簽到" dot={dots.login} onClick={() => setPanel("login")} />
          <SideIcon icon="📜" label="任務" dot={dots.daily} onClick={() => setPanel("daily")} />
          <SideIcon icon="🛒" label="商店" onClick={() => setPanel("shop")} />
        </div>
        <div className="side right">
          <SideIcon icon="🐈‍⬛" label="腐化" locked={!corruptionUnlocked(s)} lockText={`${CORRUPTION.unlockStage}關`} onClick={() => setPanel("corruption")} />
          <SideIcon icon="🔮" label="轉生" dot={dots.rebirth} locked={s.life.bestStage < REBIRTH.unlockStage && s.life.rebirths === 0} lockText={`${REBIRTH.unlockStage}關`} onClick={() => setPanel("rebirth")} />
          <SideIcon icon="⚙️" label="設定" onClick={() => setPanel("settings")} />
        </div>
        <div className="power-plate">
          <span className="pw-label">戰力</span>
          <span className="pw-val">{fmt(st.power)}</span>
          {powerPop > 0 && <span className="pw-pop">▲{fmt(powerPop)}</span>}
        </div>
      </div>

      <QuickTrain />

      <nav className="bottom-nav">
        <NavBtn icon="⚔️" label="戰鬥" on={panel === null} onClick={() => setPanel(null)} />
        <NavBtn icon="🧝" label="英雄" on={panel === "hero"} dot={dots.hero} onClick={() => setPanel("hero")} />
        <NavBtn icon="💪" label="訓練" on={panel === "train"} dot={dots.train} onClick={() => setPanel("train")} />
        <NavBtn icon="🔮" label="轉生" on={panel === "rebirth"} dot={dots.rebirth} onClick={() => setPanel("rebirth")} />
        <NavBtn icon="💎" label="商店" on={panel === "shop"} onClick={() => setPanel("shop")} />
      </nav>

      {panel === "hero" && <HeroPanel onClose={() => setPanel(null)} />}
      {panel === "train" && <TrainPanel onClose={() => setPanel(null)} />}
      {panel === "rebirth" && <RebirthPanel onClose={() => setPanel(null)} />}
      {panel === "shop" && <ShopPanel onClose={() => setPanel(null)} />}
      {panel === "daily" && <DailyPanel onClose={() => setPanel(null)} />}
      {panel === "login" && <LoginPanel onClose={() => setPanel(null)} />}
      {panel === "corruption" && <CorruptionPanel onClose={() => setPanel(null)} />}
      {panel === "settings" && <SettingsPanel onClose={() => setPanel(null)} />}

      {store.offline && <OfflineModal sum={store.offline} />}
      {!store.offline && panel === null && <Tutorial open={setPanel} />}
      <Toasts />
    </div>
  );
}

function BattleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const r = new BattleRenderer(ref.current!, () => store.state);
    const unsub = store.onEvent((e) => r.onEvent(e));
    const ro = new ResizeObserver(() => {
      const b = wrap.current!.getBoundingClientRect();
      r.resize(b.width, b.height);
    });
    ro.observe(wrap.current!);
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      r.update(Math.min(0.1, (t - last) / 1000));
      last = t;
      r.draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); unsub(); };
  }, []);
  return <div ref={wrap} className="canvas-wrap"><canvas ref={ref} /></div>;
}

function BossButton() {
  const s = useGame();
  if (s.inBoss) return <span className="boss-btn fighting">BOSS!</span>;
  if (!s.bossReady) return <span className="boss-btn locked">👑</span>;
  if (s.settings.autoBoss) return <span className="boss-btn auto">👑 自動</span>;
  return (
    <button className="boss-btn ready" onClick={() => store.act((g, rng) => challengeBoss(g, rng, store.emitter))}>
      👑 挑戰
    </button>
  );
}

// main screen quick upgrade: tap tap tap = core idle feel
function QuickTrain() {
  const s = useGame();
  const items = [
    { id: "atk" as const, icon: "⚔️", label: "攻擊" },
    { id: "hp" as const, icon: "❤️", label: "生命" },
  ];
  return (
    <div className="quick-train">
      {items.map((it) => {
        const cost = trainingCost(it.id, s.training[it.id]);
        const ok = s.gold >= cost;
        return (
          <button key={it.id} className={`qt-btn ${ok ? "ok" : ""}`} onClick={() => {
            if (store.act((g) => buyTraining(g, it.id, 1))) { sfx.coin(); buzz(6); }
          }}>
            <span className="qt-icon">{it.icon}</span>
            <span className="qt-text">
              <span className="qt-label">{it.label} Lv.{s.training[it.id]}</span>
              <Amount c="gold" n={cost} size={14} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SideIcon({ icon, label, dot, onClick, locked, lockText }: { icon: string; label: string; dot?: boolean; onClick: () => void; locked?: boolean; lockText?: string }) {
  return (
    <button className={`side-icon ${locked ? "locked" : ""}`} onClick={() => { if (locked) { toast(`${lockText}解鎖`); return; } sfx.tap(); onClick(); }}>
      <span className="si-icon">{locked ? "🔒" : icon}</span>
      <span className="si-label">{label}</span>
      {dot && !locked && <span className="red-dot" />}
    </button>
  );
}

function NavBtn({ icon, label, on, dot, onClick }: { icon: string; label: string; on: boolean; dot?: boolean; onClick: () => void }) {
  return (
    <button className={`nav-btn ${on ? "on" : ""}`} onClick={() => { sfx.tap(); onClick(); }}>
      <span className="nb-icon">{icon}</span>
      <span className="nb-label">{label}</span>
      {dot && <span className="red-dot" />}
    </button>
  );
}

export { Btn };
