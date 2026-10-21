// Display text (zh-HK). TODO: en table when go global.
import type { Rarity, TrainingId, PerkId, DailyQuestId } from "../config/balance";
import type { JobId, Slot, SubStatId } from "../config/content";
import type { Item } from "../core/types";
import { pct } from "../core/format";

export const RARITY_NAME: Record<Rarity, string> = {
  common: "普通", uncommon: "優良", rare: "稀有", epic: "史詩", legendary: "傳說", mythic: "神話",
};

export const SLOT_NAME: Record<Slot, string> = { weapon: "武器", armor: "盔甲", helm: "頭盔", ring: "戒指" };

const BASE: Record<Slot, string[]> = {
  weapon: ["劍", "刃", "法杖", "長弓", "戰斧", "短刀", "權杖", "長槍"],
  armor: ["皮甲", "鎖甲", "長袍", "戰鎧", "斗篷", "披風"],
  helm: ["頭巾", "鐵盔", "尖帽", "王冠", "面罩", "髮箍"],
  ring: ["指環", "戒", "符環", "印戒"],
};
const PREFIX = ["新手", "木", "銅", "鐵", "銀", "翠", "星辰", "烈焰", "寒冰", "雷鳴", "月影", "晨曦", "深淵", "龍鱗", "天空", "幻夢", "黃金", "暗夜", "聖光", "混沌"];

export function itemName(it: Item): string {
  const base = BASE[it.slot][it.nameSeed % BASE[it.slot].length];
  const tierPrefix = Math.min(PREFIX.length - 1, Math.floor(it.ilvl / 6) + (it.nameSeed >> 4) % 3);
  return `${PREFIX[tierPrefix]}${base}`;
}

export const JOB_NAME: Record<JobId, string> = {
  novice: "見習生", blade: "劍士", arcanist: "秘法師", ranger: "遊俠", paladin: "聖騎士", archmage: "大魔導", sniper: "神射手",
};

export const JOB_DESC: Record<JobId, string> = {
  novice: "乜都識少少",
  blade: "高血高防，旋風斬連擊三下",
  arcanist: "攻擊力最高，隕石一擊必殺",
  ranger: "攻速暴擊高，箭雨五連射",
  paladin: "鐵壁聖騎，審判四連擊",
  archmage: "毀天滅地，新星爆發",
  sniper: "暴擊之王，穿透六連射",
};

export const SKILL_NAME: Record<string, string> = {
  bonk: "敲頭", whirl: "旋風斬", meteor: "隕石術", volley: "箭雨", judgement: "審判", nova: "星爆", pierce: "穿透射擊",
};

export const SUB_NAME: Record<SubStatId, string> = {
  atkPct: "攻擊", hpPct: "生命", crit: "暴擊率", critDmg: "暴擊傷害", goldPct: "金幣", expPct: "經驗", aps: "攻速",
};

export function subText(id: SubStatId, v: number) {
  return `${SUB_NAME[id]} +${pct(v, 1)}`;
}

export const TRAIN_NAME: Record<TrainingId, { name: string; icon: string; desc: (lvl: number) => string }> = {
  atk: { name: "力量訓練", icon: "⚔️", desc: () => "攻擊 +4（每25級 ×1.3）" },
  hp: { name: "體能訓練", icon: "❤️", desc: () => "生命 +30（每25級 ×1.3）" },
  crit: { name: "專注訓練", icon: "🎯", desc: () => "暴擊率 +0.5%" },
  speed: { name: "敏捷訓練", icon: "💨", desc: () => "攻速 +2%" },
};

export const PERK_NAME: Record<PerkId, { name: string; icon: string; desc: string }> = {
  soulAtk: { name: "靈魂之力", icon: "🗡️", desc: "攻擊 +25% / 級" },
  soulHp: { name: "靈魂之軀", icon: "🛡️", desc: "生命 +25% / 級" },
  soulGold: { name: "貓之財運", icon: "💰", desc: "金幣 +20% / 級" },
  soulExp: { name: "智慧之泉", icon: "📖", desc: "經驗 +20% / 級" },
  headStart: { name: "捷徑", icon: "🚀", desc: "轉生後起始關卡 +5 / 級" },
  offlineCap: { name: "長眠", icon: "🌙", desc: "離線收益上限 +1 小時 / 級" },
};

export const QUEST_NAME: Record<DailyQuestId, (n: number) => string> = {
  kill: (n) => `擊倒 ${n} 隻怪物`,
  boss: (n) => `擊敗 ${n} 個 Boss`,
  refine: (n) => `精煉裝備 ${n} 次`,
  train: (n) => `訓練 ${n} 次`,
  offline: () => `領取離線收益`,
};

export const BIOME_NAME: Record<string, string> = {
  meadow: "微風草原", forest: "迷霧森林", ruins: "黃沙遺跡", glacier: "冰晶峽谷",
  volcano: "熔岩火山", castle: "幽暗古堡", starfall: "星落之海", abyss: "虛空深淵",
};

export const CORRUPTION_NAME = ["純淨", "腐化 I", "腐化 II", "腐化 III", "腐化 IV", "腐化 V"];
