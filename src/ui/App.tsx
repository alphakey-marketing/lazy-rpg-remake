import { useEffect, useRef, useState } from "react";
import { BALANCE, CORRUPTION, KURO, REBIRTH, TOWER } from "../config/balance";
import type { Line } from "../config/story";
import { BIOMES, JOBS, JOB_PLAYSTYLE, jobRoute } from "../config/content";
import { availableJobs, specializationReady, buyTraining, canChangeJob, canRebirth, challengeBoss, corruptionUnlocked, kuroFeedCost, petWaitMs, rebirthShards } from "../core/actions";
import { dailyClaimable, loginClaimable } from "../core/daily";
import { fmt } from "../core/format";
import { biomeIndex, chapterOf, expToNext, stageInChapter, trainingCost } from "../core/formulas";
import { rarityIndex } from "../core/items";
import { computeStats, powerWith } from "../core/stats";
import { nextPlayerGoal } from "../core/goals";
import { towerDailyAvailable, towerUnlocked } from "../core/tower";
import { buzz, sfx } from "../services/feedback";
import { BattleRenderer } from "./render/BattleRenderer";
import { store, useGame } from "./store";
import { RARITY_COLOR } from "./theme";
import { BIOME_NAME, CORRUPTION_NAME, JOB_NAME, itemName, RARITY_NAME } from "./names";
import { Amount, Bar, Btn } from "./components/common";
import { HeroPanel } from "./components/HeroPanel";
import { CorruptionPanel, DailyPanel, LoginPanel, OfflineModal, RebirthPanel, SettingsPanel, ShopPanel, TrainPanel } from "./components/Panels";
import { toast, Toasts } from "./components/Toasts";
import { Tutorial } from "./components/Tutorial";
import { Dialogue, KuroButton, KuroPanel, pendingStory } from "./components/KuroPanel";
import { TowerPanel } from "./components/TowerPanel";
import { BestiaryPanel } from "./components/BestiaryPanel";
import { FeedbackPanel } from "./components/FeedbackPanel";
import { BindNudge, ConflictModal } from "./components/CloudPanel";
import { trackPanel } from "./analyticsWatch";
import { BESTIARY, BESTIARY_STAT_NAME } from "../config/bestiary";
import { bestiaryTier } from "../core/bestiary";
import type { FamilyId } from "../config/content";

const BESTIARY_IDS = Object.keys(BESTIARY) as FamilyId[];
import { ACHIEVEMENTS } from "../config/achievements";
import { achievementClaimable } from "../core/achievements";

type Panel = null | "hero" | "train" | "kuro" | "tower" | "bestiary" | "feedback" | "rebirth" | "shop" | "daily" | "login" | "corruption" | "settings";

export function App() {
  const s = useGame();
  const [panel, setPanel] = useState<Panel>(null);
  const [powerPop, setPowerPop] = useState(0);
  const [promotion, setPromotion] = useState(false);
  const previousJob = useRef(s.job);
  useEffect(() => {
    if (s.job === previousJob.current) return;
    previousJob.current = s.job;
    if (s.job === "novice") { setPromotion(false); return; }
    setPanel(null); setPromotion(true); sfx.win(); buzz(60);
    const timeout = setTimeout(() => setPromotion(false), 1800);
    return () => clearTimeout(timeout);
  }, [s.job]);
  useEffect(() => { if (panel) trackPanel(panel); }, [panel]);
  const [reread, setReread] = useState<{ title: string; lines: Line[] } | null>(null);
  const st = computeStats(s);
  const lastPower = useRef(st.power);
  const lastAchievements = useRef(new Set(s.achievements.unlocked));

  useEffect(() => {
    const unlocked = ACHIEVEMENTS.filter((a) => s.achievements.unlocked.includes(a.id) && !lastAchievements.current.has(a.id));
    if (unlocked.length) toast(unlocked.length === 1 ? `🏆 成就達成：${unlocked[0].title}！去「任務」領獎。` : `🏆 達成 ${unlocked.length} 項成就！去「任務」領獎。`, "#ffd23f");
    lastAchievements.current = new Set(s.achievements.unlocked);
  }, [s.achievements.unlocked.length]);

  // bestiary star up → toast. Compare per family so we know who.
  const lastTiers = useRef<Record<string, number> | null>(null);
  const tierKey = BESTIARY_IDS.map((id) => bestiaryTier(s.bestiary[id] ?? 0)).join(",");
  useEffect(() => {
    const now = Object.fromEntries(BESTIARY_IDS.map((id) => [id, bestiaryTier(s.bestiary[id] ?? 0)]));
    if (lastTiers.current) {
      for (const id of BESTIARY_IDS) {
        if (now[id] > lastTiers.current[id]) {
          const b = BESTIARY[id];
          toast(`📖 圖鑑升星！${b.name} ${"★".repeat(now[id])} · ${BESTIARY_STAT_NAME[b.stat]} +${+(b.perTier * 100).toFixed(1)}%`, "#ffb84d");
          sfx.levelUp();
        }
      }
    }
    lastTiers.current = now;
  }, [tierKey]);

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
      case "skill": sfx.skill(e.fx); break;
      case "proc": sfx.hit(e.crit); break;
      case "kill": sfx.kill(); break;
      case "levelUp": sfx.levelUp(); buzz(20); break;
      case "bossStart": sfx.boss(); buzz(40); break;
      case "bossWin": sfx.win(); buzz(50); break;
      case "bossFail": sfx.fail(); break;
      case "bagFull": toast("背包滿咗！自動分解", "#ff9b3d"); break;
      case "kuroStrike": if (e.auto) sfx.hit(true); break;
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
  const goal = nextPlayerGoal(s, now);
  const dots = {
    daily: dailyClaimable(s) > 0 || achievementClaimable(s) > 0,
    login: loginClaimable(s, now),
    hero: specializationReady(s) || availableJobs(s).some((j) => canChangeJob(s, j)) || s.bag.some((it) => powerWith(s, it) > st.power),
    train: s.gold >= trainingCost("atk", s.training.atk),
    rebirth: canRebirth(s) && rebirthShards(s) >= 20,
    kuro: petWaitMs(s, now) === 0 || (s.kuro.level < KURO.maxLevel && s.kuro.fish >= kuroFeedCost(s)),
    tower: towerUnlocked(s) && (s.tower.highestFloor === 0 || towerDailyAvailable(s, now)),
  };
  // story pop only on main screen, after offline popup
  const story = !promotion && !store.offline && panel === null ? pendingStory(s) : null;

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
          <SideIcon icon="🗼" label="無盡塔" dot={dots.tower} locked={!towerUnlocked(s)} lockText={`${TOWER.unlockStage - 1}關通關`} onClick={() => setPanel("tower")} />
          <SideIcon icon="📖" label="圖鑑" onClick={() => setPanel("bestiary")} />
        </div>
        <div className="side right">
          <SideIcon icon="🌑" label="腐化" locked={!corruptionUnlocked(s)} lockText={`${CORRUPTION.unlockStage}關`} onClick={() => setPanel("corruption")} />
          <SideIcon icon="🔮" label="轉生" dot={dots.rebirth} locked={s.life.bestStage < REBIRTH.unlockStage && s.life.rebirths === 0} lockText={`${REBIRTH.unlockStage}關`} onClick={() => setPanel("rebirth")} />
          <SideIcon icon="⚙️" label="設定" onClick={() => setPanel("settings")} />
          <SideIcon icon="💬" label="意見" onClick={() => setPanel("feedback")} />
        </div>
        <KuroButton />
        <div className="power-plate">
          <span className="pw-label">戰力</span>
          <span className="pw-val">{fmt(st.power)}</span>
          {powerPop > 0 && <span className="pw-pop">▲{fmt(powerPop)}</span>}
        </div>
      </div>

      <QuickTrain />

      <button className="next-goal" onClick={() => setPanel(goal.panel)}>
        <div><b>{goal.title}</b><span>{goal.detail}</span></div>
        <strong>{goal.cta} ›</strong>
      </button>

      <nav className="bottom-nav">
        <NavBtn icon="⚔️" label="戰鬥" on={panel === null} onClick={() => setPanel(null)} />
        <NavBtn icon="🧝" label="英雄" on={panel === "hero"} dot={dots.hero} onClick={() => setPanel("hero")} />
        <NavBtn icon="💪" label="訓練" on={panel === "train"} dot={dots.train} onClick={() => setPanel("train")} />
        <NavBtn icon="🐈‍⬛" label="黑貓" on={panel === "kuro"} dot={dots.kuro} onClick={() => setPanel("kuro")} />
        <NavBtn icon="💎" label="商店" on={panel === "shop"} onClick={() => setPanel("shop")} />
      </nav>

      {panel === "hero" && <HeroPanel onClose={() => setPanel(null)} />}
      {panel === "train" && <TrainPanel onClose={() => setPanel(null)} />}
      {panel === "kuro" && <KuroPanel onClose={() => setPanel(null)} onStory={(title, lines) => setReread({ title, lines })} />}
      {panel === "tower" && <TowerPanel onClose={() => setPanel(null)} />}
      {panel === "bestiary" && <BestiaryPanel onClose={() => setPanel(null)} />}
      {panel === "feedback" && <FeedbackPanel onClose={() => setPanel(null)} />}
      {panel === "rebirth" && <RebirthPanel onClose={() => setPanel(null)} />}
      {panel === "shop" && <ShopPanel onClose={() => setPanel(null)} />}
      {panel === "daily" && <DailyPanel onClose={() => setPanel(null)} />}
      {panel === "login" && <LoginPanel onClose={() => setPanel(null)} />}
      {panel === "corruption" && <CorruptionPanel onClose={() => setPanel(null)} />}
      {panel === "settings" && <SettingsPanel onClose={() => setPanel(null)} />}

      {store.offline && <OfflineModal sum={store.offline} />}
      {story && <Dialogue key={story.title} title={story.title} lines={story.lines} onDone={story.done} />}
      {reread && <Dialogue key={"r" + reread.title} title={reread.title} lines={reread.lines} onDone={() => setReread(null)} />}
      {!promotion && !store.offline && panel === null && !story && <Tutorial open={setPanel} />}
      {promotion && <div className="promotion" role="status" style={{ ["--jc" as any]: JOBS[s.job].color }}><div className="promotion-ring">{jobRoute(s.job) === "blade" ? "🛡️" : jobRoute(s.job) === "arcanist" ? "🔮" : "🏹"}</div><span>轉職完成</span><strong>{JOB_NAME[s.job]}</strong><p>{JOB_PLAYSTYLE[jobRoute(s.job)].hook}</p><small>新技能即將登場！</small></div>}
      {!store.offline && !story && panel === null && <BindNudge onOpenSettings={() => setPanel("settings")} />}
      <ConflictModal />
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
