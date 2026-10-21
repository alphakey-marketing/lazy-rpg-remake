import { useEffect, useRef } from "react";
import { BESTIARY, BESTIARY_STAT_NAME, BESTIARY_TIERS, BestiaryStat } from "../../config/bestiary";
import { FAMILIES, FamilyId } from "../../config/content";
import { bestiaryBonus, bestiaryDiscovered, bestiaryNext, bestiaryTier, bestiaryTotalTiers } from "../../core/bestiary";
import { fmt } from "../../core/format";
import { drawMonster } from "../render/shapes";
import { useGame } from "../store";
import { Bar, Sheet } from "./common";

const IDS = Object.keys(BESTIARY) as FamilyId[];

export function fmtBonus(stat: BestiaryStat, v: number): string {
  return `${BESTIARY_STAT_NAME[stat]} +${+(v * 100).toFixed(1)}%`;
}

// Static monster pic. Not seen yet → black shadow.
function MonsterPic({ id, seen, size = 64 }: { id: FamilyId; seen: boolean; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    cv.width = size * dpr;
    cv.height = size * dpr;
    const c = cv.getContext("2d")!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fam = FAMILIES[id];
    drawMonster(c, fam, fam.colors[0], size / 2, size * 0.86, size * 0.36, 0.4, false);
    if (!seen) {
      c.globalCompositeOperation = "source-atop";
      c.fillStyle = "#1a1230";
      c.fillRect(0, 0, size, size);
    }
  }, [id, seen, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} />;
}

export function BestiaryPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const bonus = bestiaryBonus(s);
  const active = (Object.keys(bonus) as BestiaryStat[]).filter((k) => bonus[k] > 0);
  return (
    <Sheet title="怪物圖鑑" onClose={onClose} tall>
      <div className="bst-sum">
        <div>發現 <b>{bestiaryDiscovered(s)}/{IDS.length}</b> · 星級 <b>{bestiaryTotalTiers(s)}/{IDS.length * BESTIARY_TIERS.length}</b></div>
        <div className="bst-bonus">
          {active.length ? active.map((k) => <span key={k}>{fmtBonus(k, bonus[k])}</span>) : <span>打怪儲數，解鎖永久加成！</span>}
        </div>
        <small>每種怪打夠 {BESTIARY_TIERS.map((n) => n.toLocaleString()).join(" / ")} 隻升一星。轉生都保留。</small>
      </div>
      <div className="bst-grid">
        {IDS.map((id) => {
          const kills = s.bestiary[id] ?? 0;
          const seen = kills > 0;
          const tier = bestiaryTier(kills);
          const next = bestiaryNext(kills);
          const prev = tier > 0 ? BESTIARY_TIERS[tier - 1] : 0;
          const b = BESTIARY[id];
          return (
            <div key={id} className={`bst-card ${seen ? "" : "unseen"} ${next === null ? "max" : ""}`}>
              <MonsterPic id={id} seen={seen} />
              <div className="bst-name">{seen ? b.name : "？？？"}</div>
              <div className="bst-stars">{BESTIARY_TIERS.map((_, i) => <span key={i} className={i < tier ? "on" : ""}>★</span>)}</div>
              <div className="bst-stat">{fmtBonus(b.stat, b.perTier * Math.max(1, tier))}{tier === 0 && " (1★)"}</div>
              {next !== null
                ? <Bar k={(kills - prev) / (next - prev)} h={12} color="#ffb84d" label={`${fmt(kills)}/${fmt(next)}`} />
                : <div className="bst-maxed">已滿星 · {fmt(kills)}</div>}
              {seen && <div className="bst-note">{b.note}</div>}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
