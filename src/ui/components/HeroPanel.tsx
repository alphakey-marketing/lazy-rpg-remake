import { useState } from "react";
import { REFINE } from "../../config/balance";
import { SLOTS } from "../../config/content";
import { availableJobs, canChangeJob, specializationReady, equipFromBag, findItem, refine, refineCost, RefineResult, salvage, salvageWeaker, toggleLock } from "../../core/actions";
import { fmt, pct } from "../../core/format";
import { itemMain, salvageValue } from "../../core/items";
import { computeStats, powerWith } from "../../core/stats";
import { buzz, sfx } from "../../services/feedback";
import { store, useGame } from "../store";
import { RARITY_COLOR } from "../theme";
import { itemName, JOB_NAME, RARITY_NAME, SLOT_NAME, subText } from "../names";
import { Amount, Btn, ItemCard, Sheet, Sprite } from "./common";
import { JobTab } from "./JobTab";
import { toast } from "./Toasts";
import type { Item } from "../../core/types";

export function HeroPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [sel, setSel] = useState<number | null>(null);
  const [tab, setTab] = useState<"gear" | "job">(() => availableJobs(store.state).some((j) => canChangeJob(store.state, j)) || specializationReady(store.state) ? "job" : "gear");
  const st = computeStats(s);
  const selItem = sel !== null ? findItem(s, sel) : null;
  const jobsReady = availableJobs(s).some((j) => canChangeJob(s, j)) || specializationReady(s);

  return (
    <Sheet title="英雄" onClose={onClose} tall>
      <div className="seg">
        <button className={tab === "gear" ? "on" : ""} onClick={() => setTab("gear")}>裝備</button>
        <button className={tab === "job" ? "on" : ""} onClick={() => setTab("job")}>
          <Sprite name="i-job" className="ico" />轉職{jobsReady && <span className="red-dot" />}
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
            }}><Sprite name="i-recycle" className="ico" />一鍵分解較弱</Btn>
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
          {risky && !charm && <div className="warn"><Sprite name="i-alert" className="ico" /> 失敗會跌 1 級（唔會爆裝）</div>}
          <Btn wide color="blue" disabled={s.stones < cost.stones || s.gold < cost.gold} onClick={doRefine}><Sprite name="i-forge" className="ico" />精煉</Btn>
        </div>
      )}

      <div className="id-actions">
        {!equipped && <Btn color="green" onClick={() => { store.act((g) => equipFromBag(g, item.id)); sfx.loot(1); onDone(); }}>裝備</Btn>}
        <Btn color="gray" small onClick={() => store.act((g) => toggleLock(g, item.id))}><Sprite name={item.locked ? "i-unlock" : "i-lock"} className="ico" />{item.locked ? "解鎖" : "鎖定"}</Btn>
        {!equipped && !item.locked && (
          <Btn color="red" small onClick={() => { const v = store.act((g) => salvage(g, item.id)); toast(`獲得 ${v} 精煉石`); onDone(); }}>
            <Sprite name="i-recycle" className="ico" />分解 +{salvageValue(item)}
          </Btn>
        )}
      </div>
    </div>
  );
}
