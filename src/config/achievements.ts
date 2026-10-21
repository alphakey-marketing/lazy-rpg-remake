import { KURO } from "./balance";
import type { GameState } from "../core/types";
import { bestiaryDiscovered, bestiaryTotalTiers } from "../core/bestiary";

const bestRefine = (s: GameState) => Math.max(0, ...Object.values(s.gear).map((it) => it?.refine ?? 0));

export const ACHIEVEMENTS = [
  { id: "firstBoss", title: "勇者開工", description: "打贏第一隻 Boss", target: 1, progress: (s: GameState) => s.life.bossKills, reward: { fish: 0, gems: 5, stones: 0 } },
  { id: "firstFeed", title: "魚乾外交", description: "餵黑貓升到 Lv.2", target: 2, progress: (s: GameState) => s.kuro.level, reward: { fish: 2, gems: 0, stones: 0 } },
  { id: "firstJob", title: "正式入行", description: "完成第一次轉職", target: 1, progress: (s: GameState) => s.job === "novice" ? 0 : 1, reward: { fish: 0, gems: 5, stones: 10 } },
  { id: "autoClaw", title: "貓都要返工", description: `黑貓升到 Lv.${KURO.autoCastLevel}，解鎖自動貓爪`, target: KURO.autoCastLevel, progress: (s: GameState) => s.kuro.level, reward: { fish: 3, gems: 0, stones: 0 } },
  { id: "tower1", title: "第一步向上", description: "通過無盡塔第 1 層", target: 1, progress: (s: GameState) => s.tower.highestFloor, reward: { fish: 2, gems: 0, stones: 0 } },
  { id: "tower5", title: "登高搵魚乾", description: "通過無盡塔第 5 層", target: 5, progress: (s: GameState) => s.tower.highestFloor, reward: { fish: 0, gems: 10, stones: 0 } },
  { id: "tower10", title: "十層唔夠喉", description: "通過無盡塔第 10 層", target: 10, progress: (s: GameState) => s.tower.highestFloor, reward: { fish: 0, gems: 10, stones: 20 } },
  { id: "firstRebirth", title: "再嚟過，更強大", description: "完成第一次轉生", target: 1, progress: (s: GameState) => s.life.rebirths, reward: { fish: 5, gems: 15, stones: 0 } },
  // ── Long chase: give small goal when main line feel slow ──
  { id: "stage25", title: "草原畢業生", description: "最高去到第 25 關", target: 25, progress: (s: GameState) => s.life.bestStage, reward: { fish: 3, gems: 10, stones: 0 } },
  { id: "stage50", title: "撞牆都唔驚", description: "最高去到第 50 關", target: 50, progress: (s: GameState) => s.life.bestStage, reward: { fish: 5, gems: 20, stones: 0 } },
  { id: "stage100", title: "百關勇者", description: "最高去到第 100 關", target: 100, progress: (s: GameState) => s.life.bestStage, reward: { fish: 10, gems: 40, stones: 0 } },
  { id: "stage200", title: "深淵常客", description: "最高去到第 200 關", target: 200, progress: (s: GameState) => s.life.bestStage, reward: { fish: 20, gems: 80, stones: 0 } },
  { id: "kills1k", title: "打怪新手", description: "總共擊殺 1,000 隻怪", target: 1000, progress: (s: GameState) => s.life.kills, reward: { fish: 0, gems: 10, stones: 10 } },
  { id: "kills10k", title: "打怪專家", description: "總共擊殺 10,000 隻怪", target: 10000, progress: (s: GameState) => s.life.kills, reward: { fish: 0, gems: 25, stones: 30 } },
  { id: "kills100k", title: "怪物都怕咗你", description: "總共擊殺 100,000 隻怪", target: 100000, progress: (s: GameState) => s.life.kills, reward: { fish: 0, gems: 60, stones: 80 } },
  { id: "boss50", title: "Boss 收割機", description: "打贏 50 隻 Boss", target: 50, progress: (s: GameState) => s.life.bossKills, reward: { fish: 5, gems: 15, stones: 0 } },
  { id: "boss300", title: "Boss 都要排隊", description: "打贏 300 隻 Boss", target: 300, progress: (s: GameState) => s.life.bossKills, reward: { fish: 15, gems: 40, stones: 0 } },
  { id: "kuro10", title: "肥咗少少", description: "黑貓升到 Lv.10", target: 10, progress: (s: GameState) => s.kuro.level, reward: { fish: 5, gems: 10, stones: 0 } },
  { id: "kuro25", title: "主子", description: "黑貓升到 Lv.25", target: 25, progress: (s: GameState) => s.kuro.level, reward: { fish: 10, gems: 30, stones: 0 } },
  { id: "kuro50", title: "貓界傳說", description: `黑貓升到滿級 Lv.${KURO.maxLevel}`, target: KURO.maxLevel, progress: (s: GameState) => s.kuro.level, reward: { fish: 0, gems: 100, stones: 0 } },
  { id: "tower25", title: "塔中半山", description: "通過無盡塔第 25 層", target: 25, progress: (s: GameState) => s.tower.highestFloor, reward: { fish: 8, gems: 20, stones: 20 } },
  { id: "tower50", title: "塔頂風好大", description: "通過無盡塔第 50 層", target: 50, progress: (s: GameState) => s.tower.highestFloor, reward: { fish: 15, gems: 50, stones: 40 } },
  { id: "refine10", title: "閃到盲", description: "身上裝備精煉到 +10", target: 10, progress: bestRefine, reward: { fish: 0, gems: 20, stones: 30 } },
  { id: "rebirth5", title: "輪迴專業戶", description: "轉生 5 次", target: 5, progress: (s: GameState) => s.life.rebirths, reward: { fish: 15, gems: 50, stones: 0 } },
  { id: "gold1b", title: "有錢佬", description: "累計賺到 10 億金幣", target: 1e9, progress: (s: GameState) => s.life.goldEarned, reward: { fish: 0, gems: 30, stones: 20 } },
  { id: "dex12", title: "怪物都見晒", description: "圖鑑發現全部 12 種怪", target: 12, progress: bestiaryDiscovered, reward: { fish: 5, gems: 20, stones: 0 } },
  { id: "dexStar12", title: "圖鑑學徒", description: "圖鑑累計 12 粒星", target: 12, progress: bestiaryTotalTiers, reward: { fish: 5, gems: 15, stones: 10 } },
  { id: "dexStar30", title: "圖鑑博士", description: "圖鑑累計 30 粒星", target: 30, progress: bestiaryTotalTiers, reward: { fish: 15, gems: 50, stones: 30 } },
] as const;

export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];
