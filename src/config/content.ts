// Original content only. NO Ragnarok Online name (legal risk).

export type JobId = "novice" | "blade" | "arcanist" | "ranger" | "paladin" | "archmage" | "sniper";

export interface SkillDef {
  id: string;
  cooldown: number; // sec
  hits: number;
  mult: number; // dmg per hit = atk × mult
  fx: "slash" | "meteor" | "volley" | "holy" | "nova" | "pierce" | "poke";
}

export interface JobDef {
  id: JobId;
  tier: 0 | 1 | 2;
  from?: JobId;
  unlockLevel: number;
  atkMult: number;
  hpMult: number;
  apsMult: number;
  critAdd: number;
  critDmgAdd: number;
  defAdd: number;
  skill: SkillDef;
  color: string; // hero outfit color
  weapon: "stick" | "sword" | "staff" | "bow" | "greatsword" | "orb" | "longbow";
}

export const JOBS: Record<JobId, JobDef> = {
  novice: {
    id: "novice", tier: 0, unlockLevel: 1,
    atkMult: 1, hpMult: 1, apsMult: 1, critAdd: 0, critDmgAdd: 0, defAdd: 0,
    skill: { id: "bonk", cooldown: 8, hits: 1, mult: 2.5, fx: "poke" },
    color: "#8fb3ff", weapon: "stick",
  },
  blade: {
    id: "blade", tier: 1, from: "novice", unlockLevel: 12,
    atkMult: 1.35, hpMult: 1.45, apsMult: 1, critAdd: 0, critDmgAdd: 0.1, defAdd: 0.05,
    skill: { id: "whirl", cooldown: 6, hits: 3, mult: 1.6, fx: "slash" },
    color: "#ff6b5a", weapon: "sword",
  },
  arcanist: {
    id: "arcanist", tier: 1, from: "novice", unlockLevel: 12,
    atkMult: 1.7, hpMult: 1.0, apsMult: 0.9, critAdd: 0, critDmgAdd: 0, defAdd: 0,
    skill: { id: "meteor", cooldown: 9, hits: 1, mult: 7, fx: "meteor" },
    color: "#b07cff", weapon: "staff",
  },
  ranger: {
    id: "ranger", tier: 1, from: "novice", unlockLevel: 12,
    atkMult: 1.2, hpMult: 1.15, apsMult: 1.35, critAdd: 0.08, critDmgAdd: 0.2, defAdd: 0,
    skill: { id: "volley", cooldown: 7, hits: 5, mult: 1.1, fx: "volley" },
    color: "#4fd18b", weapon: "bow",
  },
  paladin: {
    id: "paladin", tier: 2, from: "blade", unlockLevel: 45,
    atkMult: 2.2, hpMult: 2.6, apsMult: 1.05, critAdd: 0.03, critDmgAdd: 0.2, defAdd: 0.12,
    skill: { id: "judgement", cooldown: 6, hits: 4, mult: 2.2, fx: "holy" },
    color: "#ffd166", weapon: "greatsword",
  },
  archmage: {
    id: "archmage", tier: 2, from: "arcanist", unlockLevel: 45,
    atkMult: 3.0, hpMult: 1.6, apsMult: 0.95, critAdd: 0.02, critDmgAdd: 0.2, defAdd: 0.03,
    skill: { id: "nova", cooldown: 8, hits: 1, mult: 12, fx: "nova" },
    color: "#5ad1ff", weapon: "orb",
  },
  sniper: {
    id: "sniper", tier: 2, from: "ranger", unlockLevel: 45,
    atkMult: 2.0, hpMult: 1.8, apsMult: 1.6, critAdd: 0.15, critDmgAdd: 0.5, defAdd: 0.03,
    skill: { id: "pierce", cooldown: 6, hits: 6, mult: 1.6, fx: "pierce" },
    color: "#2ee6a8", weapon: "longbow",
  },
};

// ── Biome = chapter look. Cycle after 8, tint darker each loop. ──────
export interface BiomeDef {
  id: string;
  sky: [string, string];
  hillFar: string;
  hillNear: string;
  ground: string;
  groundEdge: string;
  props: "grass" | "tree" | "pillar" | "ice" | "lava" | "tower" | "star" | "void";
  families: FamilyId[];
}

export type FamilyId =
  | "jelly" | "mushling" | "bat" | "pebble" | "bonelet" | "imp" | "wisp" | "stumpy"
  | "cactus" | "yeti" | "magma" | "eyeball";

export const BIOMES: BiomeDef[] = [
  { id: "meadow", sky: ["#7ad3ff", "#c9f1ff"], hillFar: "#7fd38a", hillNear: "#4fb86a", ground: "#5fbf4a", groundEdge: "#3e8f34", props: "grass", families: ["jelly", "mushling", "stumpy"] },
  { id: "forest", sky: ["#3b6e8f", "#9fd4c7"], hillFar: "#2f7a5a", hillNear: "#1f5c45", ground: "#3b7d3a", groundEdge: "#24552a", props: "tree", families: ["mushling", "bat", "stumpy"] },
  { id: "ruins", sky: ["#ffb36b", "#ffe2a8"], hillFar: "#e0a25e", hillNear: "#c4843f", ground: "#e6c27a", groundEdge: "#b8934d", props: "pillar", families: ["cactus", "bonelet", "pebble"] },
  { id: "glacier", sky: ["#6aa9ff", "#e3f4ff"], hillFar: "#bfe3ff", hillNear: "#8fc6f2", ground: "#e8f6ff", groundEdge: "#a8cde8", props: "ice", families: ["yeti", "wisp", "pebble"] },
  { id: "volcano", sky: ["#5a1a2e", "#ff7a45"], hillFar: "#6e2a2a", hillNear: "#4a1a1a", ground: "#3a2424", groundEdge: "#ff6a2a", props: "lava", families: ["magma", "imp", "pebble"] },
  { id: "castle", sky: ["#2a1e4f", "#6b4fa3"], hillFar: "#3a2d63", hillNear: "#2a2048", ground: "#4a3f66", groundEdge: "#2a2340", props: "tower", families: ["bonelet", "bat", "imp"] },
  { id: "starfall", sky: ["#0f1640", "#4b3c8f"], hillFar: "#2c2f6b", hillNear: "#1d1f4d", ground: "#35306b", groundEdge: "#8a7dff", props: "star", families: ["wisp", "eyeball", "jelly"] },
  { id: "abyss", sky: ["#0a0614", "#3a0f3f"], hillFar: "#221030", hillNear: "#160a20", ground: "#1e1028", groundEdge: "#c13cff", props: "void", families: ["eyeball", "imp", "wisp"] },
];

export interface FamilyDef {
  id: FamilyId;
  shape: "blob" | "mushroom" | "bat" | "rock" | "skull" | "imp" | "ghost" | "stump" | "cactus" | "yeti" | "magma" | "eye";
  colors: string[]; // variant palette
}

export const FAMILIES: Record<FamilyId, FamilyDef> = {
  jelly: { id: "jelly", shape: "blob", colors: ["#ff7eb6", "#7ee0ff", "#b4ff7e", "#ffd36e"] },
  mushling: { id: "mushling", shape: "mushroom", colors: ["#ff5a5a", "#ffa94d", "#c07cff"] },
  bat: { id: "bat", shape: "bat", colors: ["#6b5ca5", "#3e3466", "#a05ca5"] },
  pebble: { id: "pebble", shape: "rock", colors: ["#9a9aa8", "#b08a6a", "#7a8aa0"] },
  bonelet: { id: "bonelet", shape: "skull", colors: ["#f1ead8", "#d8e6f1", "#e8d0d0"] },
  imp: { id: "imp", shape: "imp", colors: ["#ff4d6d", "#ff7a3d", "#9d4dff"] },
  wisp: { id: "wisp", shape: "ghost", colors: ["#c8f0ff", "#d6c8ff", "#c8ffe0"] },
  stumpy: { id: "stumpy", shape: "stump", colors: ["#a0703c", "#8a5a2c", "#7a6a3c"] },
  cactus: { id: "cactus", shape: "cactus", colors: ["#4fbf6a", "#7fcf4a"] },
  yeti: { id: "yeti", shape: "yeti", colors: ["#f4fbff", "#dbe9ff"] },
  magma: { id: "magma", shape: "magma", colors: ["#ff6a2a", "#ffb02a"] },
  eyeball: { id: "eyeball", shape: "eye", colors: ["#fff2f2", "#f2f0ff"] },
};

export const SLOTS = ["weapon", "armor", "helm", "ring"] as const;
export type Slot = (typeof SLOTS)[number];

export const SUB_STATS = ["atkPct", "hpPct", "crit", "critDmg", "goldPct", "expPct", "aps"] as const;
export type SubStatId = (typeof SUB_STATS)[number];

// roll range per sub-stat (scaled by rarity mult a bit)
export const SUB_STAT_RANGE: Record<SubStatId, [number, number]> = {
  atkPct: [0.04, 0.12],
  hpPct: [0.05, 0.15],
  crit: [0.01, 0.03],
  critDmg: [0.05, 0.15],
  goldPct: [0.05, 0.15],
  expPct: [0.05, 0.15],
  aps: [0.02, 0.06],
};
