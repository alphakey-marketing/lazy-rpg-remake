import { KURO, TOWER } from "../config/balance";
import { availableJobs, canChangeJob, specializationReady, kuroFeedCost } from "./actions";
import { towerDailyAvailable, towerUnlocked } from "./tower";
import type { GameState } from "./types";

export interface PlayerGoal {
  title: string;
  detail: string;
  panel: "train" | "hero" | "kuro" | "tower";
  cta: string;
}

export function nextPlayerGoal(s: GameState, now: number): PlayerGoal {
  if (s.training.atk === 0) return { title: "第一次升級攻擊", detail: "金幣可以即刻換戰力，撳下面攻擊升級。", panel: "train", cta: "去訓練" };
  if (s.life.bossKills === 0) return { title: "打贏第一隻 Boss", detail: `打夠 10 隻怪就會自動挑戰；而家 ${Math.min(10, s.kills)}/10。`, panel: "train", cta: "提升戰力" };
  if (s.kuro.lastPet === 0) return { title: "摸摸你嘅黑貓", detail: "第一次摸貓有魚乾，仲有 30 分鐘金幣、經驗加成。", panel: "kuro", cta: "去摸貓" };
  if (s.kuro.level < 2) return { title: "第一次餵黑貓", detail: `升到 Lv.2 仲差 ${Math.max(0, kuroFeedCost(s) - s.kuro.fish)} 條魚乾；Boss 都會掉魚乾。`, panel: "kuro", cta: "去餵食" };
  if (specializationReady(s)) return { title: "揀你嘅二轉專精", detail: "兩種玩法，揀今次轉生想行嘅方向。", panel: "hero", cta: "去揀專精" };
  if (availableJobs(s).some((job) => canChangeJob(s, job))) return { title: s.job === "novice" ? "可以第一次轉職喇！" : "解鎖進階轉職！", detail: "去英雄揀職業，獲得更強能力同新技能。", panel: "hero", cta: "去轉職" };
  if (!towerUnlocked(s)) return { title: "完成第一章，解鎖無盡塔", detail: `目前第 ${s.stage} 關；打贏第 ${TOWER.unlockStage - 1} 關魔王，開始爬塔拎魚乾同寶石。`, panel: "train", cta: "準備挑戰" };
  if (s.tower.highestFloor === 0) return { title: "無盡塔已解鎖！", detail: "首通第 1 層有魚乾，今日再有一份每日獎勵。", panel: "tower", cta: "首次登塔" };
  if (s.kuro.level < KURO.autoCastLevel) return { title: `黑貓 Lv.${KURO.autoCastLevel} 解鎖自動貓爪`, detail: `目前 Lv.${s.kuro.level}；下一級仲差 ${Math.max(0, kuroFeedCost(s) - s.kuro.fish)} 條魚乾。爬塔同 Boss 都幫到手。`, panel: "kuro", cta: "培養黑貓" };
  if (towerDailyAvailable(s, now)) return { title: "今日嘅塔獎勵等緊你", detail: "挑戰新一層或掃蕩已通關層，領魚乾同寶石。", panel: "tower", cta: "去無盡塔" };
  return { title: `下一站：無盡塔第 ${s.tower.highestFloor + 1} 層`, detail: "離開後 Kuro 會繼續打怪。收收益、升級，再返嚟破紀錄！", panel: "tower", cta: "睇下目標" };
}
