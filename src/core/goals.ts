import { BALANCE, KURO, TOWER, TRAINING_MILESTONE } from "../config/balance";
import { BESTIARY } from "../config/bestiary";
import type { FamilyId } from "../config/content";
import { achievementClaimable } from "./achievements";
import { bestiaryNext } from "./bestiary";
import { dailyClaimable } from "./daily";
import { fmt } from "./format";
import { trainingCost } from "./formulas";
import { availableJobs, canChangeJob, canRebirth, rebirthShards, specializationReady, kuroFeedCost } from "./actions";
import { towerDailyAvailable, towerUnlocked } from "./tower";
import type { GameState } from "./types";

export interface PlayerGoal {
  title: string;
  detail: string;
  panel: "train" | "hero" | "kuro" | "tower" | "daily" | "bestiary" | "rebirth";
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
  const ach = achievementClaimable(s);
  if (ach > 0) return { title: `有 ${ach} 個成就可以領`, detail: "寶石同魚乾擺喺度，唔領就係送俾 Kuro。", panel: "daily", cta: "去領獎" };
  const dq = dailyClaimable(s);
  if (dq > 0) return { title: `每日任務：${dq} 份獎勵未領`, detail: "做完唔領，Kuro 會當你請佢食飯。", panel: "daily", cta: "去領取" };
  return rotatingGoal(s, now);
}

export const GOAL_ROTATE_MS = 120_000;

// Late game, nothing urgent → rotate small targets every 2 min. Not always tower.
export function lateGoals(s: GameState): PlayerGoal[] {
  const pool: PlayerGoal[] = [];
  const feed = kuroFeedCost(s);
  if (s.kuro.fish >= feed) pool.push({ title: `黑貓可以升 Lv.${s.kuro.level + 1}`, detail: `有 ${fmt(s.kuro.fish)} 條魚乾，夠餵（${fmt(feed)}）。貓爪會再痛啲。`, panel: "kuro", cta: "去餵貓" });
  else pool.push({ title: `儲魚乾餵黑貓 Lv.${s.kuro.level + 1}`, detail: `仲差 ${fmt(feed - s.kuro.fish)} 條。Boss、無盡塔、每日任務都有魚乾。`, panel: "kuro", cta: "睇下黑貓" });

  const lv = s.training.atk;
  const ms = (Math.floor(lv / TRAINING_MILESTONE.every) + 1) * TRAINING_MILESTONE.every;
  pool.push({ title: `攻擊訓練 Lv.${ms} 里程碑`, detail: `而家 Lv.${lv}，到 ${ms} 級攻擊再 ×${TRAINING_MILESTONE.mult}。下一級要 ${fmt(trainingCost("atk", lv))} 金幣。`, panel: "train", cta: "去訓練" });

  let best: { id: FamilyId; left: number } | null = null;
  for (const id of Object.keys(BESTIARY) as FamilyId[]) {
    const kills = s.bestiary[id] ?? 0;
    const next = bestiaryNext(kills);
    if (kills > 0 && next !== null && (!best || next - kills < best.left)) best = { id, left: next - kills };
  }
  if (best) pool.push({ title: `圖鑑：${BESTIARY[best.id].name} 就升星`, detail: `再打 ${fmt(best.left)} 隻就升星，永久加成，轉生都保留。`, panel: "bestiary", cta: "睇圖鑑" });

  const per = BALANCE.stagesPerChapter;
  const nextBoss = Math.ceil((s.maxStage + 1) / per) * per;
  pool.push({ title: `挑戰第 ${nextBoss} 關章節魔王`, detail: `最遠到第 ${s.maxStage} 關。戰力夠就推，唔夠先練攻擊同裝備。`, panel: "train", cta: "提升戰力" });

  if (canRebirth(s) && s.maxStage >= 40) pool.push({ title: `轉生可得 ${fmt(rebirthShards(s))} 碎片`, detail: "卡關就轉生，用碎片買永久天賦，下一輪衝得更快。", panel: "rebirth", cta: "睇轉生" });

  pool.push({ title: `下一站：無盡塔第 ${s.tower.highestFloor + 1} 層`, detail: "離開後 Kuro 會繼續打怪。收收益、升級，再返嚟破紀錄！", panel: "tower", cta: "睇下目標" });
  return pool;
}

function rotatingGoal(s: GameState, now: number): PlayerGoal {
  const pool = lateGoals(s);
  return pool[Math.floor(now / GOAL_ROTATE_MS) % pool.length];
}
