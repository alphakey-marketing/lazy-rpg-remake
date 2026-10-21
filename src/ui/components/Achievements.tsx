import { ACHIEVEMENTS } from "../../config/achievements";
import { achievementClaimable, achievementProgress, canClaimAchievement, claimAchievement, claimAllAchievements } from "../../core/achievements";
import { sfx } from "../../services/feedback";
import { store, useGame } from "../store";
import { fmt } from "../../core/format";
import { Amount, Bar, Btn, Sprite } from "./common";
import { toast } from "./Toasts";

export function Achievements() {
  const s = useGame();
  const ready = achievementClaimable(s);
  return <>
    <div className="row-card achievement-summary">
      <Sprite name="i-trophy" className="ach-badge" /><div className="rc-main"><div className="rc-title">成就 {ACHIEVEMENTS.filter((a) => s.achievements.claimed.includes(a.id)).length}/{ACHIEVEMENTS.length}</div><div className="rc-desc">每項只領一次，轉生後保留。</div></div>
      <Btn color="gold" disabled={ready === 0} dot={ready > 0} onClick={() => {
        const count = store.act(claimAllAchievements);
        if (count) { sfx.win(); toast(`已領取 ${count} 項成就獎勵！`, "#ffd23f"); }
      }}>全部領取{ready > 0 ? ` (${ready})` : ""}</Btn>
    </div>
    {ACHIEVEMENTS.map((a) => {
      const claimed = s.achievements.claimed.includes(a.id);
      const canClaim = canClaimAchievement(s, a.id);
      const progress = achievementProgress(s, a.id);
      return <div key={a.id} className={`row-card achievement-card ${claimed ? "dim" : ""}`} data-achievement={a.id}>
        <Sprite name={badgeOf(a.id)} className={`ach-badge ${claimed || canClaim ? "" : "locked"}`} />
        <div className="rc-main">
          <div className="rc-title">{claimed ? "✓ " : ""}{a.title}</div>
          <div className="rc-desc">{a.description}</div>
          <Bar k={progress / a.target} h={16} color="#5fe07a" label={`${fmt(Math.min(progress, a.target))} / ${fmt(a.target)}`} />
          <div className="rc-reward">
            {a.reward.fish > 0 && <span><Sprite name="i-fish" className="ico" /> {a.reward.fish}</span>}
            {a.reward.gems > 0 && <Amount c="gem" n={a.reward.gems} size={14} />}
            {a.reward.stones > 0 && <Amount c="stone" n={a.reward.stones} size={14} />}
          </div>
        </div>
        <Btn color={canClaim ? "orange" : "gray"} disabled={!canClaim} dot={canClaim} onClick={() => {
          if (store.act((g) => claimAchievement(g, a.id))) { sfx.win(); toast(`「${a.title}」獎勵已領取！`, "#ffd23f"); }
        }}>{claimed ? "已領" : canClaim ? "領取" : "未達成"}</Btn>
      </div>;
    })}
  </>;
}

// first 8 have own badge art; rest borrow close one
const BADGE: Record<string, string> = {
  firstBoss: "badge-boss", firstFeed: "badge-feed", firstJob: "badge-job", autoClaw: "badge-claw",
  tower1: "badge-tower1", tower5: "badge-tower5", tower10: "badge-tower10", firstRebirth: "badge-rebirth",
  boss50: "badge-boss", boss300: "badge-boss", kuro10: "badge-feed", kuro25: "badge-feed", kuro50: "badge-claw",
  tower25: "badge-tower10", tower50: "badge-tower10", rebirth5: "badge-rebirth",
  refine10: "i-refine", gold1b: "i-gold", dex12: "i-book", dexStar12: "i-book", dexStar30: "i-book",
  kills1k: "i-sword", kills10k: "i-sword", kills100k: "i-sword",
};
const badgeOf = (id: string) => BADGE[id] ?? "i-trophy";
