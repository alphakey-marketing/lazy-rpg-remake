import { useEffect, useRef, useState } from "react";
import { BALANCE, KURO, TOWER } from "../../config/balance";
import { fmt, fmtDuration, pct } from "../../core/format";
import { computeStats } from "../../core/stats";
import { claimTowerDaily, createTowerRun, settleTowerRun, tickTower, towerClaw, towerDailyAvailable, towerDailyReward, towerFirstReward, towerModifier, towerUnlocked, type TowerReward, type TowerRun } from "../../core/tower";
import { sfx } from "../../services/feedback";
import { SKILL_NAME } from "../names";
import { advanceTowerPresentation, createTowerPresentation } from "../towerPresentation";
import { BattleRenderer } from "../render/BattleRenderer";
import { store, useGame } from "../store";
import { Amount, Bar, Btn, Sheet, Sprite } from "./common";
import { toast } from "./Toasts";

export function TowerPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [run, setRun] = useState<TowerRun | null>(null);
  const presentation = useRef(createTowerPresentation());
  const [reward, setReward] = useState<TowerReward | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const encounter = useRef<HTMLDivElement>(null);
  const resultCard = useRef<HTMLDivElement>(null);
  const [, setFrame] = useState(0);
  const renderer = useRef<BattleRenderer | null>(null);
  const now = Date.now();
  const unlocked = towerUnlocked(s);
  const floor = s.tower.highestFloor + 1;
  const first = towerFirstReward(floor);
  const daily = towerDailyReward(s);
  const canDaily = towerDailyAvailable(s, now);
  const mod = towerModifier(now);
  const phase = presentation.current.phase;
  const running = run !== null && phase !== "result";

  useEffect(() => {
    if (phase === "result") resultCard.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [phase]);

  useEffect(() => {
    if (!run || !canvas.current) return;
    const r = new BattleRenderer(canvas.current, () => run.state, "bg-tower");
    encounter.current?.scrollIntoView({ block: "start" });
    renderer.current = r;
    const resize = new ResizeObserver(() => {
      const rect = canvas.current!.parentElement!.getBoundingClientRect();
      r.resize(rect.width, rect.height);
    });
    resize.observe(canvas.current.parentElement!);
    let last = performance.now(), acc = 0, lastNotify = 0, raf = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      // A hidden tab pauses the optional fight; main-line offline progress continues.
      if (!document.hidden) {
        const wasCombat = presentation.current.phase === "combat";
        advanceTowerPresentation(presentation.current, dt, !!run.result);
        if (wasCombat && !run.result) {
          acc += dt;
          while (acc >= BALANCE.tickSeconds && !run.result) {
            tickTower(run, BALANCE.tickSeconds, (e) => {
              r.onEvent(e);
              if (e.t === "skill") sfx.skill(e.fx);
            });
            acc -= BALANCE.tickSeconds;
          }
          if (run.result) {
            setReward(store.act((g) => settleTowerRun(g, run, Date.now())));
            if (run.result === "won") sfx.win(); else sfx.fail();
            advanceTowerPresentation(presentation.current, dt, true);
            setFrame((v) => v + 1);
          }
        }
        r.update(dt);
      }
      r.draw();
      if (t - lastNotify > 100) { setFrame((v) => v + 1); lastNotify = t; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); resize.disconnect(); renderer.current = null; };
  }, [run]);

  const start = () => {
    if (running) return;
    presentation.current = createTowerPresentation();
    setReward(null);
    setRun(createTowerRun(store.state, Date.now()));
  };

  const finisher = run?.finisher;
  const source = finisher?.source === "skill" ? SKILL_NAME[finisher.skillId ?? ""] ?? "職業技能" : finisher?.source === "kuro" ? `黑貓出爪（${KURO.strikeHits}連擊合計）` : finisher?.source === "counter" ? "護盾反擊" : finisher?.source === "pursuit" ? "追擊" : "普通攻擊";

  return (
    <Sheet title="無盡塔" onClose={onClose} tall>
      <div className="tower-summary">
        <span className="tower-icon"><Sprite name="i-tower" /></span>
        <div><b>最高通關：{s.tower.highestFloor} 層</b><div>進度永久保留 · 轉生都唔會重置</div></div>
      </div>
      {!unlocked ? (
        <div className="kuro-say">「打贏第一章魔王，我就帶你去搵魚乾。」<br />第 {TOWER.unlockStage - 1} 關通關後解鎖。</div>
      ) : (
        <>
          <div className="tower-rule"><b>今日：{mod.name}</b><span>{mod.description}</span><small>每日午夜更新；挑戰期間沿用入場規則。</small></div>
          {run && (
            <div className="tower-encounter" ref={encounter}>
              <div className="tower-fight-head"><b>第 {run.floor} 層</b><span>{phase === "intro" ? "守衛登場" : phase === "impact" ? "致勝一擊" : phase === "result" ? "挑戰結束" : `剩 ${fmtDuration(Math.max(0, TOWER.timeLimit - run.elapsed))}`}</span></div>
              <div className="tower-canvas"><canvas ref={canvas} />
                {phase === "intro" && <div className="tower-overlay" role="status"><strong>第 {run.floor} 層 · {run.floor % TOWER.milestoneEvery === 0 ? "魔王" : "守衛"}登場</strong><span>Lv.{run.enemyLevel} · 生命 {fmt(run.enemyMaxHp)}</span><small>準備出擊！</small></div>}
                {phase === "impact" && <div className="tower-overlay impact" role="status"><strong>{run.result !== "won" ? "挑戰結束" : run.elapsed <= 1 ? "實力碾壓！" : "突破成功！"}</strong>{run.result === "won" && finisher && <span>{source} · {fmt(Math.round(finisher.dmg))} 傷害</span>}</div>}
              </div>
              <div className="tower-hp"><span>勇者</span><Bar k={run.state.battle.heroHp / computeStats(run.state).maxHp} color="#5fe07a" /><span>守衛</span><Bar k={run.remainingHp} color="#ff4d6d" label={phase === "intro" ? fmt(run.enemyMaxHp) : undefined} /></div>
              {phase === "combat" && !run.result && <>
                <Btn wide color="purple" disabled={run.state.kuro.strikeCd > 0 || !run.state.battle.enemy || run.state.battle.enemy.hp <= 0} onClick={() => {
                  towerClaw(run, (e) => renderer.current?.onEvent(e));
                  setFrame((v) => v + 1);
                }}>{run.state.kuro.strikeCd > 0 ? `🐾 冷卻 ${Math.ceil(run.state.kuro.strikeCd)} 秒` : "🐾 黑貓出爪"}</Btn>
                <div className="hint">{run.state.kuro.level >= KURO.autoCastLevel && run.state.kuro.auto ? "自動貓爪已開啟" : `黑貓 Lv.${KURO.autoCastLevel} 解鎖自動貓爪`}</div>
              </>}
              {phase === "result" && run.result && <div ref={resultCard} className={`tower-result ${run.result === "won" ? "win" : ""}`} role="status">
                <b>{run.result === "won" ? "突破成功！" : run.result === "timeout" ? "時間到，再練強啲！" : "暫時打唔贏，升級再嚟！"}</b>
                <span>第 {run.floor} 層 · 實際戰鬥 {run.elapsed.toFixed(2)} 秒 · {run.hits} 次命中</span>
                {run.result === "won" && finisher && <span>{run.hits === 1 ? "一擊秒殺" : run.elapsed <= 1 ? "瞬間制勝" : "致勝一擊"}：{source}，造成 {fmt(Math.round(finisher.dmg))} 傷害（守衛生命 {fmt(run.enemyMaxHp)}）。</span>}
                {run.result === "won" && run.elapsed <= 1 && <span>你嘅實力已超越呢層！繼續挑戰更高層守衛。</span>}
                {run.result !== "won" && <span>守衛剩 {pct(run.remainingHp)} 生命。升級攻擊、精煉武器或餵貓後再試。</span>}
                {reward && <span><Sprite name="i-fish" className="ico" /> +{reward.fish} 魚乾 {reward.gems > 0 && <Amount c="gem" n={reward.gems} />}</span>}
                {run.result === "won" && !reward && <span>呢層嘅首通獎已結算。</span>}
              </div>}
            </div>
          )}
          <div className="row-card">
            <div className="rc-main"><div className="rc-title">挑戰第 {floor} 層{floor % TOWER.milestoneEvery === 0 ? " · 魔王" : ""}</div><div className="rc-reward">首通 <Sprite name="i-fish" className="ico" /> {first.fish} {first.gems > 0 && <Amount c="gem" n={first.gems} />}</div></div>
            <Btn color="orange" disabled={running} onClick={start}>{running ? "挑戰中…" : run?.result && run.result !== "won" ? "再試一次" : run?.result === "won" ? "挑戰下一層" : "挑戰"}</Btn>
          </div>
          <div className="row-card">
            <div className="rc-main"><div className="rc-title">每日挑戰獎勵</div><div className="rc-reward">🐟 {daily.fish} <Amount c="gem" n={daily.gems} /></div><div className="rc-desc">每日首次突破自動領取；已通關可掃蕩。</div></div>
            <Btn color={canDaily ? "green" : "gray"} disabled={!canDaily || running} dot={canDaily} onClick={() => {
              const r = store.act((g) => claimTowerDaily(g, Date.now()));
              if (r) { sfx.coin(); toast(`掃蕩完成！🐟 +${r.fish} · 💎 +${r.gems}`, "#ffd23f"); }
            }}>{s.tower.highestFloor === 0 ? "先通第 1 層" : canDaily ? "掃蕩領獎" : "今日已領"}</Btn>
          </div>
          <div className="kuro-hint">「今日爬高啲，聽日魚乾多啲。」每 {TOWER.milestoneEvery} 層有寶石里程碑。每日獎最多魚乾 {TOWER.dailyFish(1000)}、寶石 {TOWER.dailyGems}。免費重試，失敗唔扣資源。</div>
          <div className="hint">主線繼續掛機。關閉面板會中止未完成挑戰，唔會扣次數。</div>
        </>
      )}
    </Sheet>
  );
}
