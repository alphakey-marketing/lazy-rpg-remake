import { useState } from "react";
import { sendFeedback } from "../../services/analytics";
import { sfx } from "../../services/feedback";
import { useGame } from "../store";
import { Btn, Sheet } from "./common";
import { toast } from "./Toasts";

const MOODS = [
  ["love", "😍", "好玩"],
  ["ok", "🙂", "OK 啦"],
  ["bored", "😴", "有啲悶"],
  ["bug", "🐛", "有 Bug"],
] as const;

export function FeedbackPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [mood, setMood] = useState<string>("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = !!mood && !busy;
  return (
    <Sheet title="俾意見 Kuro" onClose={onClose}>
      <div className="fb-kuro">🐈‍⬛「你覺得呢個遊戲點？講真話，我唔會抓你。（應該）」</div>
      <div className="fb-moods">
        {MOODS.map(([id, icon, label]) => (
          <button key={id} className={`fb-mood ${mood === id ? "on" : ""}`} onClick={() => { sfx.tap(); setMood(id); }}>
            <span>{icon}</span><small>{label}</small>
          </button>
        ))}
      </div>
      <textarea
        className="fb-text"
        maxLength={2000}
        rows={5}
        placeholder="邊度好玩？邊度悶？卡喺邊？有咩 bug？（可以唔填）"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="fb-note">會一齊送出：關卡、等級、職業、遊玩時間。唔會收集個人資料。</div>
      <Btn color={ok ? "orange" : "gray"} disabled={!ok} onClick={async () => {
        setBusy(true);
        const saved = await sendFeedback(text, mood, {
          stage: s.stage, best_stage: s.life.bestStage, level: s.level, job: s.job,
          rebirths: s.life.rebirths, play_min: Math.floor(s.life.playSeconds / 60),
        });
        setBusy(false);
        sfx.win();
        toast(saved ? "多謝！Kuro 收到喇 🐟" : "收到喇（網絡麻麻，只送咗簡短版）", "#ffd23f");
        onClose();
      }}>{busy ? "送緊…" : "送出"}</Btn>
    </Sheet>
  );
}
