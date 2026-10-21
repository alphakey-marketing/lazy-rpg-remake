import {
  CORRUPTION, DAILY_ALL_CLAIMED_BONUS, DAILY_QUESTS, DailyQuestId, GEM_SHOP, LOGIN_REWARDS,
  PerkId, Rarity, REBIRTH, REBIRTH_PERKS, REFINE, TrainingId,
} from "../config/balance";
import { JOBS, JobId, Slot } from "../config/content";
import { bumpDaily, dayKey, ensureDaily } from "./daily";
import { trainingCost, trainingMaxed } from "./formulas";
import { rarityIndex, salvageValue } from "./items";
import { newGame } from "./newGame";
import type { Rng } from "./rng";
import { Emit, estimateGoldPerSec, noEmit, startBoss } from "./sim";
import { computeStats, powerWith } from "./stats";
import type { GameState, Item } from "./types";

// ── Boss ─────────────────────────────────────────────────────────────
export function challengeBoss(state: GameState, rng: Rng, emit: Emit = noEmit): boolean {
  if (!state.bossReady || state.inBoss) return false;
  startBoss(state, computeStats(state), rng, emit);
  return true;
}

// ── Training ────────────────────────────────────────────────────────
export function buyTraining(state: GameState, id: TrainingId, count: number | "max"): number {
  let bought = 0;
  const limit = count === "max" ? 10000 : count;
  while (bought < limit && !trainingMaxed(id, state.training[id])) {
    const cost = trainingCost(id, state.training[id]);
    if (state.gold < cost) break;
    state.gold -= cost;
    state.training[id]++;
    bought++;
  }
  if (bought > 0) bumpDaily(state, "train", bought);
  return bought;
}

export function trainingBulkCost(state: GameState, id: TrainingId, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (trainingMaxed(id, state.training[id] + i)) break;
    total += trainingCost(id, state.training[id] + i);
  }
  return total;
}

// ── Gear ────────────────────────────────────────────────────────────
export function equipFromBag(state: GameState, itemId: number): boolean {
  const idx = state.bag.findIndex((i) => i.id === itemId);
  if (idx < 0) return false;
  const item = state.bag[idx];
  const old = state.gear[item.slot];
  state.gear[item.slot] = item;
  state.bag.splice(idx, 1);
  if (old) state.bag.push(old);
  return true;
}

export function salvage(state: GameState, itemId: number): number {
  const idx = state.bag.findIndex((i) => i.id === itemId);
  if (idx < 0 || state.bag[idx].locked) return 0;
  const v = salvageValue(state.bag[idx]);
  state.stones += v;
  state.bag.splice(idx, 1);
  return v;
}

// salvage every bag item weaker than equipped & not locked (one tap clean)
export function salvageWeaker(state: GameState): { count: number; stones: number } {
  const curPower = computeStats(state).power;
  let count = 0, stones = 0;
  state.bag = state.bag.filter((it) => {
    if (it.locked) return true;
    if (powerWith(state, it) > curPower) return true;
    count++;
    stones += salvageValue(it);
    return false;
  });
  state.stones += stones;
  return { count, stones };
}

export function toggleLock(state: GameState, itemId: number) {
  const it = findItem(state, itemId);
  if (it) it.locked = !it.locked;
}

export function findItem(state: GameState, itemId: number): Item | null {
  for (const s of Object.keys(state.gear) as Slot[]) {
    if (state.gear[s]?.id === itemId) return state.gear[s];
  }
  return state.bag.find((i) => i.id === itemId) ?? null;
}

// ── Refine: no break. +5 up fail → -1 unless charm. ─────────────────
export type RefineResult = "success" | "fail" | "downgrade" | "protected" | "noFunds" | "max";

export function refineCost(item: Item) {
  return { stones: REFINE.stoneCost(item.refine), gold: REFINE.goldCost(item.refine, item.ilvl) };
}

export function refine(state: GameState, itemId: number, useCharm: boolean, rng: Rng): RefineResult {
  const item = findItem(state, itemId);
  if (!item) return "noFunds";
  if (item.refine >= REFINE.maxLevel) return "max";
  const cost = refineCost(item);
  if (state.stones < cost.stones || state.gold < cost.gold) return "noFunds";
  const canProtect = useCharm && item.refine >= REFINE.downgradeFrom;
  if (canProtect && state.protectCharms <= 0 && state.gems < REFINE.protectGemCost) return "noFunds";

  state.stones -= cost.stones;
  state.gold -= cost.gold;
  state.life.refines++;
  bumpDaily(state, "refine");

  if (rng.next() < REFINE.successRate[item.refine]) {
    item.refine++;
    return "success";
  }
  if (item.refine < REFINE.downgradeFrom) return "fail";
  if (canProtect) {
    if (state.protectCharms > 0) state.protectCharms--;
    else state.gems -= REFINE.protectGemCost;
    return "protected";
  }
  item.refine--;
  return "downgrade";
}

// ── Job ─────────────────────────────────────────────────────────────
export function availableJobs(state: GameState): JobId[] {
  return (Object.keys(JOBS) as JobId[]).filter((j) => JOBS[j].from === state.job);
}

export function canChangeJob(state: GameState, job: JobId): boolean {
  const def = JOBS[job];
  return def.from === state.job && state.level >= def.unlockLevel;
}

export function changeJob(state: GameState, job: JobId): boolean {
  if (!canChangeJob(state, job)) return false;
  state.job = job;
  state.battle.skillTimer = 1;
  return true;
}

// ── Corruption ──────────────────────────────────────────────────────
export function corruptionUnlocked(state: GameState): boolean {
  return state.life.bestStage >= CORRUPTION.unlockStage;
}

export function setCorruption(state: GameState, tier: number): boolean {
  if (!corruptionUnlocked(state)) return false;
  state.corruption = Math.max(0, Math.min(CORRUPTION.tiers.length - 1, tier));
  // new enemy take new tier at next spawn; boss fight keep going
  return true;
}

// ── Rebirth ─────────────────────────────────────────────────────────
export function rebirthShards(state: GameState): number {
  return REBIRTH.shardsFor(state.maxStage);
}

export function canRebirth(state: GameState): boolean {
  return state.maxStage >= REBIRTH.unlockStage && rebirthShards(state) > 0;
}

export function rebirth(state: GameState, now: number): number {
  if (!canRebirth(state)) return 0;
  const gained = rebirthShards(state);
  const fresh = newGame(now, state.seed);
  // keep meta: currency, perks, settings, life, daily, login, bestiary
  const keep: Partial<GameState> = {
    gems: state.gems,
    shards: state.shards + gained,
    stones: Math.floor(state.stones * REBIRTH.keepStonesFraction),
    protectCharms: state.protectCharms,
    perks: state.perks,
    settings: state.settings,
    life: { ...state.life, rebirths: state.life.rebirths + 1 },
    daily: state.daily,
    login: state.login,
    bestiary: state.bestiary,
    nextItemId: state.nextItemId,
    createdAt: state.createdAt,
    tutorialStep: -1,
    corruption: 0,
  };
  Object.assign(state, fresh, keep);
  // head start, but never past half of old best (fresh hero too weak)
  const prevBest = keep.life!.bestStage;
  const start = Math.max(1, Math.min(1 + state.perks.headStart * REBIRTH_PERKS.headStart.perLevel, Math.floor(prevBest * 0.5)));
  state.stage = start;
  state.maxStage = start;
  return gained;
}

export function perkCost(state: GameState, id: PerkId): number {
  return REBIRTH_PERKS[id].cost(state.perks[id]);
}

export function buyPerk(state: GameState, id: PerkId): boolean {
  const p = REBIRTH_PERKS[id];
  if (state.perks[id] >= p.max) return false;
  const cost = perkCost(state, id);
  if (state.shards < cost) return false;
  state.shards -= cost;
  state.perks[id]++;
  return true;
}

// ── Daily / login ───────────────────────────────────────────────────
export function claimDaily(state: GameState, id: DailyQuestId, now: number): boolean {
  ensureDaily(state, now);
  const q = DAILY_QUESTS.find((x) => x.id === id)!;
  if (state.daily.claimed[id] || state.daily.progress[id] < q.target) return false;
  state.daily.claimed[id] = true;
  state.gems += q.gems;
  state.stones += q.stones;
  return true;
}

export function claimDailyBonus(state: GameState, now: number): boolean {
  ensureDaily(state, now);
  const allDone = DAILY_QUESTS.every((q) => state.daily.claimed[q.id]);
  if (!allDone || state.daily.bonusClaimed) return false;
  state.daily.bonusClaimed = true;
  state.gems += DAILY_ALL_CLAIMED_BONUS.gems;
  return true;
}

export interface Reward {
  gems?: number;
  stones?: number;
  gold?: number;
}

export function claimLogin(state: GameState, now: number): Reward | null {
  const today = dayKey(now);
  if (state.login.lastClaimDayKey === today) return null;
  const r = LOGIN_REWARDS[state.login.streakIndex % LOGIN_REWARDS.length];
  const out: Reward = {};
  if ("gems" in r) { state.gems += r.gems; out.gems = r.gems; }
  if ("stones" in r) { state.stones += r.stones; out.stones = r.stones; }
  if ("goldHours" in r) {
    const g = estimateGoldPerSec(state) * r.goldHours * 3600;
    state.gold += g;
    out.gold = g;
  }
  state.login.lastClaimDayKey = today;
  state.login.streakIndex = (state.login.streakIndex + 1) % LOGIN_REWARDS.length;
  return out;
}

// ── Gem shop ────────────────────────────────────────────────────────
export function timeWarp(state: GameState): number {
  if (state.gems < GEM_SHOP.timeWarpCost) return 0;
  state.gems -= GEM_SHOP.timeWarpCost;
  const g = estimateGoldPerSec(state) * GEM_SHOP.timeWarpHours * 3600;
  state.gold += g;
  return g;
}

export function setAutoSalvage(state: GameState, r: Rarity | null) {
  state.settings.autoSalvageBelow = r;
}

export function rarityAtLeast(a: Rarity, b: Rarity) {
  return rarityIndex(a) >= rarityIndex(b);
}
