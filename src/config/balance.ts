// ALL balance number live here. Change number, no touch logic.
// Run `npm run balance` after change — bot play many hours, print pace.

export const BALANCE = {
  tickSeconds: 0.05, // active sim step
  offlineTickSeconds: 0.5, // offline sim step (coarse = fast)
  offlineBaseCapHours: 8,
  offlineMinSeconds: 60, // less than this, no offline popup

  killsPerStage: 10, // kill this many → boss ready
  spawnDelay: 0.6, // sec between enemy
  bossTimeLimit: 30, // sec, boss fight timer (fail if not kill)

  hero: {
    baseAtk: 10,
    baseHp: 120,
    baseAps: 1.0, // attack per sec
    baseCrit: 0.05,
    baseCritDmg: 1.5,
    atkPerLevel: 3,
    hpPerLevel: 20,
    levelMult: 1.012, // every level multiply atk & hp by this
    regenPerSec: 0.03, // fraction of max hp
    healOnKill: 0.08,
    maxCrit: 0.75,
    maxAps: 6,
  },

  // EXP need grow SAME rate as exp reward → level follow stage, never wall, never explode.
  // (old game: cost x1.45/level but reward linear → hard wall at lv25)
  expCurve: { base: 20, growth: 1.13, linear: 8 },

  enemy: {
    baseHp: 45,
    hpGrowth: 1.21, // per stage
    baseAtk: 6,
    atkGrowth: 1.19,
    aps: 0.8,
    bossHpMult: 7,
    bossAtkMult: 1.5,
    chapterBossHpMult: 12, // every 10th stage
    chapterBossAtkMult: 1.8,
  },

  reward: {
    baseGold: 4,
    goldGrowth: 1.15,
    baseExp: 6,
    expGrowth: 1.13,
    bossGoldMult: 10,
    bossExpMult: 6,
    dropChance: 0.12,
    bossDropChance: 1.0,
  },

  stagesPerChapter: 10,
} as const;

// ── Item ────────────────────────────────────────────────────────────────
export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic"] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_MULT: Record<Rarity, number> = {
  common: 1,
  uncommon: 1.35,
  rare: 1.8,
  epic: 2.5,
  legendary: 3.6,
  mythic: 5.2,
};

// base weight for drop roll. Stage & corruption shift weight up.
export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 600,
  uncommon: 280,
  rare: 90,
  epic: 24,
  legendary: 2,
  mythic: 0.3,
};
export const RARITY_STAGE_SHIFT = 0.012; // per stage, multiply higher tier weight

export const ITEM = {
  growth: 1.12, // per item level (ilvl = stage)
  weaponAtk: 5,
  armorHp: 45,
  helmHp: 25,
  helmDef: 0.02, // dmg reduction per helm... scaled & capped
  maxDef: 0.6,
  ringCrit: 0.02,
  ringCritDmg: 0.1,
  subStatCount: { common: 0, uncommon: 1, rare: 1, epic: 2, legendary: 3, mythic: 4 } as Record<Rarity, number>,
  bagSize: 40,
  salvageStones: { common: 1, uncommon: 2, rare: 4, epic: 10, legendary: 25, mythic: 60 } as Record<Rarity, number>,
};

// ── Refine (no destroy! only downgrade, protect charm stop it) ───────
export const REFINE = {
  maxLevel: 15,
  successRate: [1, 1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1],
  downgradeFrom: 5, // fail at +5 or more → drop 1
  stoneCost: (lvl: number) => Math.ceil(2 * Math.pow(1.38, lvl)),
  goldCost: (lvl: number, ilvl: number) => Math.ceil(20 * Math.pow(1.14, ilvl) * (lvl + 1)),
  bonusPerLevel: 0.1, // +10% main stat per level
  milestoneBonus: { 5: 0.15, 10: 0.3, 15: 0.6 } as Record<number, number>,
  protectGemCost: 20,
};

// ── Training (gold sink) ─────────────────────────────────────────────
export const TRAINING = {
  atk: { baseCost: 12, costGrowth: 1.095, perLevel: 4, max: Infinity },
  hp: { baseCost: 12, costGrowth: 1.095, perLevel: 30, max: Infinity },
  crit: { baseCost: 200, costGrowth: 1.3, perLevel: 0.005, max: 60 },
  speed: { baseCost: 300, costGrowth: 1.32, perLevel: 0.02, max: 75 },
} as const;
export type TrainingId = keyof typeof TRAINING;
// training atk/hp also get mult every 25 level (milestone feel)
export const TRAINING_MILESTONE = { every: 25, mult: 1.3 };

// ── Corruption: Kuro dark pact. Player pick tier. Risk ↔ reward ──
export const CORRUPTION = {
  unlockStage: 15,
  tiers: [
    { enemyHp: 1.0, enemyAtk: 1.0, reward: 1.0, rarityBoost: 1.0 },
    { enemyHp: 1.3, enemyAtk: 1.25, reward: 1.35, rarityBoost: 1.4 },
    { enemyHp: 1.75, enemyAtk: 1.6, reward: 1.85, rarityBoost: 2.0 },
    { enemyHp: 2.4, enemyAtk: 2.1, reward: 2.6, rarityBoost: 3.0 },
    { enemyHp: 3.4, enemyAtk: 2.8, reward: 3.7, rarityBoost: 4.5 },
    { enemyHp: 5.0, enemyAtk: 3.8, reward: 5.5, rarityBoost: 7.0 },
  ],
};

// ── Rebirth (prestige) ───────────────────────────────────────────────
export const REBIRTH = {
  unlockStage: 40,
  shardsFor: (maxStage: number) => (maxStage < 40 ? 0 : Math.floor(Math.pow(maxStage - 35, 2) / 2)),
  keepStonesFraction: 0.5,
};

export const REBIRTH_PERKS = {
  soulAtk: { cost: (l: number) => 1 + Math.floor(l / 2), perLevel: 0.25, max: Infinity }, // atk ×(1+0.25 l)
  soulHp: { cost: (l: number) => 1 + Math.floor(l / 2), perLevel: 0.25, max: Infinity },
  soulGold: { cost: (l: number) => 2 + l * 2, perLevel: 0.2, max: Infinity },
  soulExp: { cost: (l: number) => 2 + l * 2, perLevel: 0.2, max: Infinity },
  headStart: { cost: (l: number) => 5 + l * 5, perLevel: 5, max: 20 }, // start stage +5 per lvl
  offlineCap: { cost: (l: number) => 4 + l * 4, perLevel: 1, max: 8 }, // +1h per lvl
} as const;
export type PerkId = keyof typeof REBIRTH_PERKS;

// ── Daily + login ────────────────────────────────────────────────────
export const DAILY_QUESTS = [
  { id: "kill", target: 300, gems: 10, stones: 10 },
  { id: "boss", target: 8, gems: 10, stones: 10 },
  { id: "refine", target: 3, gems: 10, stones: 5 },
  { id: "train", target: 10, gems: 5, stones: 5 },
  { id: "offline", target: 1, gems: 5, stones: 5 },
] as const;
export type DailyQuestId = (typeof DAILY_QUESTS)[number]["id"];
export const DAILY_ALL_CLAIMED_BONUS = { gems: 30 };

export const LOGIN_REWARDS = [
  { gems: 20 },
  { stones: 30 },
  { goldHours: 1 },
  { gems: 30 },
  { stones: 60 },
  { goldHours: 2 },
  { gems: 100 },
] as const;

// gem shop (soft currency spend)
export const GEM_SHOP = {
  timeWarpHours: 2,
  timeWarpCost: 50,
  charmCost: 20, // protect charm
  adGems: 10, // free gem per ad
  adsPerDay: 5,
};

// Kuro black cat. Boss drop fish → feed → Kuro level up.
// Level give: stronger claw, auto claw (Lv5), more gold, longer offline.
export const KURO = {
  maxLevel: 50,
  feedCost: (l: number) => Math.ceil(3 * Math.pow(1.16, l - 1)) + l, // fish for l → l+1
  strikeMult: (l: number) => 8 + 1.5 * (l - 1), // total dmg = hero atk × this
  strikeHits: 3,
  cooldown: (l: number) => Math.max(8, 20 - 0.25 * (l - 1)), // sec
  autoCastLevel: 5,
  goldPerLevel: 0.02, // +2% gold per level after 1
  offlineHoursPerLevel: 0.1, // +6 min offline cap per level after 1
  fishPerBoss: (stage: number) => 1 + Math.floor(stage / 15),
  chapterBossFishMult: 3,
  petCooldownHours: 4,
  sulkHours: 24, // no pet this long → Kuro sulk, pet give double fish
  petFish: (l: number) => 3 + Math.floor(l / 2),
  sulkFishMult: 2,
  buffSeconds: 1800, // pet blessing length (sim time, offline also count down)
  buffMult: 0.25, // blessing: gold & exp +25%
};

// Permanent tower progress; daily rewards share one claim, including sweeps.
export const TOWER = {
  unlockStage: 11,
  timeLimit: 30,
  firstEnemyStage: 8,
  stagesPerFloor: 2,
  milestoneEvery: 5,
  firstClearFish: (floor: number) => 2 + Math.floor(floor / 5),
  milestoneGems: 10,
  dailyFish: (highest: number) => Math.min(12, 3 + Math.floor(highest / 5)),
  dailyGems: 10,
  modifiers: [
    { name: "破甲日", description: "塔內怪物生命 -20%", hp: 0.8, atk: 1, speed: 1 },
    { name: "守護日", description: "塔內怪物攻擊 -30%", hp: 1, atk: 0.7, speed: 1 },
    { name: "慢拍日", description: "塔內怪物攻速 -30%", hp: 1, atk: 1, speed: 0.7 },
  ],
} as const;
