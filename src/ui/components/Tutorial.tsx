import { trainingCost } from "../../core/formulas";
import { store, useGame } from "../store";

type Open = (p: "train" | "hero" | null) => void;

// Short guide. Each step wait for condition, Kuro talk. Skip any time.
const STEPS: { text: string; when: (s: ReturnType<typeof useGame>) => boolean; done: (s: ReturnType<typeof useGame>) => boolean; cta?: string; panel?: "train" | "hero" }[] = [
  {
    text: "勇者會自己打怪，你坐定定睇就得。我都係咁 😼",
    when: () => true,
    done: () => false,
    cta: "好！",
  },
  {
    text: "有金幣喇！撳下面「攻擊」按鈕升級，會打得更痛！",
    when: (s) => s.gold >= trainingCost("atk", 0),
    done: (s) => s.training.atk > 0,
  },
  {
    text: "打夠 10 隻怪，Boss 會出現。贏咗就去下一關！",
    when: (s) => s.training.atk > 0,
    done: (s) => s.life.bossKills > 0,
    cta: "明白",
  },
  {
    text: "撳左下角 🐾，我會飛過去抓佢！打 Boss 時最好用。",
    when: (s) => s.life.bossKills > 0,
    done: () => false,
    cta: "抓！",
  },
  {
    text: "拎到裝備會自動著上。去「英雄」睇下同精煉啦！",
    when: (s) => s.life.bossKills > 0 && Object.values(s.gear).some(Boolean),
    done: () => false,
    cta: "去睇",
    panel: "hero",
  },
  {
    text: "熄咗 App 我都會幫你打，最多 8 個鐘。記得返嚟領獎…同摸我！",
    when: (s) => s.stage >= 4,
    done: () => false,
    cta: "收到",
  },
];

export function Tutorial({ open }: { open: Open }) {
  const s = useGame();
  const i = s.tutorialStep;
  if (i < 0 || i >= STEPS.length) return null;
  const step = STEPS[i];
  if (!step.when(s)) return null;
  const next = () => store.act((g) => { g.tutorialStep = i + 1 >= STEPS.length ? -1 : i + 1; });
  if (step.done(s)) {
    queueMicrotask(next);
    return null;
  }
  return (
    <div className={`tutorial step-${i}`}>
      <div className="tut-kuro">🐈‍⬛</div>
      <div className="tut-bubble">
        <div>{step.text}</div>
        <div className="tut-btns">
          <button className="tut-skip" onClick={() => store.act((g) => { g.tutorialStep = -1; })}>跳過</button>
          {step.cta && (
            <button className="tut-ok" onClick={() => { next(); if (step.panel) open(step.panel); }}>{step.cta}</button>
          )}
        </div>
      </div>
    </div>
  );
}
