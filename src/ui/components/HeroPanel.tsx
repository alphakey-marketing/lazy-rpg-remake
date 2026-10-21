import { useState } from "react";
import { REFINE } from "../../config/balance";
import { JOBS, JobId, SLOTS } from "../../config/content";
import { availableJobs, canChangeJob, changeJob, equipFromBag, findItem, refine, refineCost, RefineResult, salvage, salvageWeaker, toggleLock } from "../../core/actions";
import { fmt, pct } from "../../core/format";
import { itemMain, salvageValue } from "../../core/items";
import { computeStats, powerWith } from "../../core/stats";
import { buzz, sfx } from "../../services/feedback";
import { store, useGame } from "../store";
import { RARITY_COLOR } from "../theme";
import { itemName, JOB_DESC, JOB_NAME, RARITY_NAME, SKILL_NAME, SLOT_NAME, subText } from "../names";
import { Amount, Btn, ItemCard, Sheet } from "./common";
import { toast } from "./Toasts";
import type { Item } from "../../core/types";

export function HeroPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [sel, setSel] = useState<number | null>(null);
  const [tab, setTab] = useState<"gear" | "job">("gear");
  const st = computeStats(s);
  const selItem = sel !== null ? findItem(s, sel) : null;
  const jobsReady = availableJobs(s).some((j) => canChangeJob(s, j));

  return (
    <Sheet title="英雄" onClose={onClose} tall>
      <div className="seg">
        <button className={tab === "gear" ? "on" : ""} onClick={() => setTab("gear")}>裝備</button>
        <button className={tab === "job" ? "on" : ""} onClick={() => setTab("job")}>
          轉職{jobsReady && <span className="red-dot" />}
        </button>
      </div>

      {tab === "job" ? (
        <JobTab />
      ) : (
        <>
          <div className="hero-top">
            <div className="gear-col">
              {SLOTS.slice(0, 2).map((sl) => (
                <ItemCard key={sl} slot={sl} item={s.gear[sl]} selected={s.gear[sl]?.id === sel} onClick={() => s.gear[sl] && setSel(s.gear[sl]!.id)} />
              ))}
            </div>
            <div className="stat-box">
              <div className="job-name">{JOB_NAME[s.job]} · Lv.{s.level}</div>
              <div className="power-big">⚡ {fmt(st.power)}</div>
              <div className="stat-grid">
                <span>攻擊</span><b>{fmt(st.atk)}</b>
                <span>生命</span><b>{fmt(st.maxHp)}</b>
                <span>防禦</span><b>{pct(st.def)}</b>
                <span>暴擊</span><b>{pct(st.crit)}</b>
                <span>暴傷</span><b>{pct(st.critDmg)}</b>
                <span>攻速</span><b>{st.aps.toFixed(2)}</b>
              </div>
            </div>
            <div className="gear-col">
              {SLOTS.slice(2).map((sl) => (
                <ItemCard key={sl} slot={sl} item={s.gear[sl]} selected={s.gear[sl]?.id === sel} onClick={() => s.gear[sl] && setSel(s.gear[sl]!.id)} />
              ))}
            </div>
          </div>

          {selItem && <ItemDetail item={selItem} onDone={() => setSel(null)} />}

          <div className="bag-head">
            <span>背包 {s.bag.length}/40</span>
            <Btn small color="orange" onClick={() => {
              const r = store.act((g) => salvageWeaker(g));
              toast(r.count ? `分解 ${r.count} 件，獲得 ${r.stones} 精煉石` : "冇較弱裝備");
            }}>一鍵分解較弱</Btn>
          </div>
          <div className="bag-grid">
            {s.bag.map((it) => (
              <ItemCard key={it.id} item={it} selected={it.id === sel} onClick={() => setSel(it.id)}
                badge={powerWith(s, it) > st.power ? <span className="up-arrow">▲</span> : null} />
            ))}
            {Array.from({ length: Math.max(0, 10 - s.bag.length) }).map((_, i) => <ItemCard key={"e" + i} item={null} />)}
          </div>
        </>
      )}
    </Sheet>
  );
}

function ItemDetail({ item, onDone }: { item: Item; onDone: () => void }) {
  const s = useGame();
  const equipped = s.gear[item.slot]?.id === item.id;
  const m = itemMain(item);
  const curPower = computeStats(s).power;
  const diff = equipped ? 0 : powerWith(s, item) - curPower;
  const cost = refineCost(item);
  const [charm, setCharm] = useState(false);
  const [anim, setAnim] = useState<RefineResult | null>(null);
  const rate = REFINE.successRate[item.refine] ?? 0;
  const risky = item.refine >= REFINE.downgradeFrom;

  const doRefine = () => {
    const r = store.act((g, rng) => refine(g, item.id, charm, rng));
    setAnim(r);
    setTimeout(() => setAnim(null), 700);
    if (r === "success") { sfx.win(); buzz(30); }
    else if (r === "noFunds") toast("材料唔夠");
    else { sfx.fail(); buzz(60); }
    if (r === "downgrade") toast("精煉失敗，等級 -1");
    if (r === "protected") toast("護符生效，等級保住！");
    if (r === "fail") toast("精煉失敗（未到 +5 唔會跌級）");
  };

  return (
    <div className={`item-detail r-${item.rarity}`} style={{ ["--rc" as any]: RARITY_COLOR[item.rarity] }}>
      <div className="id-head">
        <ItemCard item={item} />
        <div className="id-title">
          <div className="id-name" style={{ color: RARITY_COLOR[item.rarity] }}>
            {itemName(item)} {item.refine > 0 && `+${item.refine}`}
          </div>
          <div className="id-sub">{RARITY_NAME[item.rarity]} · {SLOT_NAME[item.slot]} · Lv{item.ilvl}</div>
          {!equipped && (
            <div className={`id-diff ${diff > 0 ? "up" : "down"}`}>戰力 {diff > 0 ? "▲ +" : "▼ "}{fmt(Math.abs(diff))}</div>
          )}
          {equipped && <div className="id-diff eq">已裝備</div>}
        </div>
        <button className="x-btn" onClick={onDone}>✕</button>
      </div>
      <div className="id-stats">
        {m.atk > 0 && <div>攻擊 +{fmt(m.atk)}</div>}
        {m.hp > 0 && <div>生命 +{fmt(m.hp)}</div>}
        {m.def > 0 && <div>防禦 +{pct(m.def, 1)}</div>}
        {m.crit > 0 && <div>暴擊 +{pct(m.crit, 1)}</div>}
        {m.critDmg > 0 && <div>暴傷 +{pct(m.critDmg)}</div>}
        {item.subs.map((sb, i) => <div key={i} className="sub">◆ {subText(sb.id, sb.value)}</div>)}
      </div>

      {item.refine < REFINE.maxLevel && (
        <div className={`refine-box ${anim ? "anim-" + anim : ""}`}>
          <div className="refine-row">
            <span>精煉 +{item.refine} → +{item.refine + 1}</span>
            <span className="rate">成功率 {pct(rate)}</span>
          </div>
          <div className="refine-row">
            <Amount c="stone" n={cost.stones} /> <Amount c="gold" n={cost.gold} />
            {risky && (
              <label className="charm-toggle">
                <input type="checkbox" checked={charm} onChange={(e) => setCharm(e.target.checked)} />
                用護符 ({s.protectCharms})
              </label>
            )}
          </div>
          {risky && !charm && <div className="warn">⚠ 失敗會跌 1 級（唔會爆裝）</div>}
          <Btn wide color="blue" disabled={s.stones < cost.stones || s.gold < cost.gold} onClick={doRefine}>精煉</Btn>
        </div>
      )}

      <div className="id-actions">
        {!equipped && <Btn color="green" onClick={() => { store.act((g) => equipFromBag(g, item.id)); sfx.loot(1); onDone(); }}>裝備</Btn>}
        <Btn color="gray" small onClick={() => store.act((g) => toggleLock(g, item.id))}>{item.locked ? "解鎖" : "鎖定"}</Btn>
        {!equipped && !item.locked && (
          <Btn color="red" small onClick={() => { const v = store.act((g) => salvage(g, item.id)); toast(`獲得 ${v} 精煉石`); onDone(); }}>
            分解 +{salvageValue(item)}
          </Btn>
        )}
      </div>
    </div>
  );
}

function JobTab() {
  const s = useGame();
  const next = availableJobs(s);
  const cur = JOBS[s.job];
  return (
    <div className="job-tab">
      <div className="job-card current" style={{ ["--jc" as any]: cur.color }}>
        <div className="jc-name">{JOB_NAME[s.job]}</div>
        <div className="jc-desc">{JOB_DESC[s.job]}</div>
        <div className="jc-skill">技能：{SKILL_NAME[cur.skill.id]}（{cur.skill.cooldown}秒冷卻）</div>
      </div>
      {next.length === 0 && <div className="hint">已達最高職業。轉生後可以揀其他路線！</div>}
      {next.map((j: JobId) => {
        const d = JOBS[j];
        const ok = canChangeJob(s, j);
        return (
          <div key={j} className="job-card" style={{ ["--jc" as any]: d.color }}>
            <div className="jc-name">{JOB_NAME[j]}</div>
            <div className="jc-desc">{JOB_DESC[j]}</div>
            <div className="jc-mults">攻 ×{d.atkMult} · 血 ×{d.hpMult} · 速 ×{d.apsMult}</div>
            <div className="jc-skill">技能：{SKILL_NAME[d.skill.id]}</div>
            <Btn color={ok ? "gold" : "gray"} disabled={!ok} dot={ok} onClick={() => {
              store.act((g) => changeJob(g, j));
              sfx.levelUp();
              toast(`轉職成為 ${JOB_NAME[j]}！`);
            }}>
              {ok ? "轉職" : `Lv.${d.unlockLevel} 解鎖`}
            </Btn>
          </div>
        );
      })}
    </div>
  );
}
