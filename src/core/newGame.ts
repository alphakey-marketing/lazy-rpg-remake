import { freshDaily } from "./daily";
import type { GameState } from "./types";

export const SAVE_VERSION = 5;

export function newGame(now: number, seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  return {
    version: SAVE_VERSION,
    seed,
    createdAt: now,
    lastSeen: now,
    level: 1,
    exp: 0,
    job: "novice",
    specialization: null,
    jobRespecUsed: false,
    stage: 1,
    maxStage: 1,
    kills: 0,
    bossReady: false,
    inBoss: false,
    gold: 0,
    gems: 50,
    stones: 0,
    shards: 0,
    protectCharms: 1,
    gear: { weapon: null, armor: null, helm: null, ring: null },
    bag: [],
    nextItemId: 1,
    training: { atk: 0, hp: 0, crit: 0, speed: 0 },
    perks: { soulAtk: 0, soulHp: 0, soulGold: 0, soulExp: 0, headStart: 0, offlineCap: 0 },
    corruption: 0,
    daily: freshDaily(now),
    login: { lastClaimDayKey: null, streakIndex: 0 },
    settings: { autoBoss: true, autoEquip: true, autoSalvageBelow: null, sound: true, haptics: true, lang: "zh" },
    life: { kills: 0, bossKills: 0, goldEarned: 0, refines: 0, rebirths: 0, bestStage: 1, playSeconds: 0 },
    bestiary: {},
    achievements: { unlocked: [], claimed: [] },
    tower: { highestFloor: 0, dailyClaimDay: null },
    kuro: { level: 1, fish: 0, strikeCd: 5, lastPet: 0, buffLeft: 0, storySeen: 0, fragmentsSeen: 0, auto: true },
    battle: { enemy: null, heroHp: -1, spawnTimer: 0.3, heroAtkTimer: 0, enemyAtkTimer: 0, skillTimer: 3, bossTimer: 0, combat: freshCombat() },
    tutorialStep: 0,
  };
}

export function freshCombat(): GameState["battle"]["combat"] {
  return { mana: 0, combo: 0, shield: 0, shieldLeft: 0, showcase: false, pending: null };
}
