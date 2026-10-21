import type { Rarity, TrainingId, PerkId, DailyQuestId } from "../config/balance";
import type { FamilyId, JobId, Slot, SubStatId } from "../config/content";

export interface SubStat {
  id: SubStatId;
  value: number;
}

// Item store only roll result. Real stat compute from ilvl/rarity/refine at read time
// → rebalance later no need save migration.
export interface Item {
  id: number;
  slot: Slot;
  rarity: Rarity;
  ilvl: number;
  refine: number;
  subs: SubStat[];
  nameSeed: number;
  locked?: boolean;
}

export interface Enemy {
  family: FamilyId;
  variant: number;
  level: number; // = stage
  hp: number;
  maxHp: number;
  atk: number;
  aps: number;
  kind: "normal" | "boss" | "chapterBoss";
}

export interface Battle {
  enemy: Enemy | null;
  heroHp: number;
  spawnTimer: number; // >0 = waiting next enemy
  heroAtkTimer: number;
  enemyAtkTimer: number;
  skillTimer: number; // count down to next skill
  bossTimer: number; // remain sec in boss fight
}

export interface DailyState {
  dayKey: string;
  progress: Record<DailyQuestId, number>;
  claimed: Record<DailyQuestId, boolean>;
  bonusClaimed: boolean;
}

export interface LoginState {
  lastClaimDayKey: string | null;
  streakIndex: number; // 0..6 next reward to claim
}

export interface Settings {
  autoBoss: boolean;
  autoEquip: boolean;
  autoSalvageBelow: Rarity | null; // salvage drop with rarity < this (if not better)
  sound: boolean;
  haptics: boolean;
  lang: "zh" | "en";
}

export interface Lifetime {
  kills: number;
  bossKills: number;
  goldEarned: number;
  refines: number;
  rebirths: number;
  bestStage: number;
  playSeconds: number;
}

export interface GameState {
  version: number;
  seed: number;
  createdAt: number;
  lastSeen: number;

  level: number;
  exp: number;
  job: JobId;

  stage: number;
  maxStage: number; // this run
  kills: number; // kill count in current stage
  bossReady: boolean;
  inBoss: boolean;

  gold: number;
  gems: number;
  stones: number;
  shards: number;
  protectCharms: number;

  gear: Record<Slot, Item | null>;
  bag: Item[];
  nextItemId: number;

  training: Record<TrainingId, number>;
  perks: Record<PerkId, number>;
  corruption: number; // tier index

  daily: DailyState;
  login: LoginState;
  settings: Settings;
  life: Lifetime;
  bestiary: Partial<Record<FamilyId, number>>;

  battle: Battle;
  tutorialStep: number; // 0.. ; -1 = done
}

// ── Events: sim emit, renderer & UI consume. Offline mode just count. ──
export type SimEvent =
  | { t: "heroHit"; dmg: number; crit: boolean }
  | { t: "skill"; skillId: string; fx: string; hits: number; dmg: number; crit: boolean }
  | { t: "enemyHit"; dmg: number }
  | { t: "spawn"; enemy: Enemy }
  | { t: "kill"; enemy: Enemy; gold: number; exp: number }
  | { t: "loot"; item: Item; salvaged: boolean; equipped: boolean }
  | { t: "levelUp"; level: number }
  | { t: "bossStart"; kind: Enemy["kind"] }
  | { t: "bossWin"; stage: number }
  | { t: "bossFail"; reason: "dead" | "timeout" }
  | { t: "heroDown"; retreatTo: number }
  | { t: "bagFull" };

export interface OfflineSummary {
  seconds: number;
  cappedSeconds: number;
  kills: number;
  bossKills: number;
  gold: number;
  exp: number;
  levelsGained: number;
  stagesGained: number;
  items: number;
  salvagedStones: number;
  bestRarity: Rarity | null;
}
