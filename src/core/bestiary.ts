import { BESTIARY, BESTIARY_TIERS, BestiaryStat } from "../config/bestiary";
import type { FamilyId } from "../config/content";
import type { GameState } from "./types";

export function bestiaryTier(kills: number): number {
  let t = 0;
  for (const need of BESTIARY_TIERS) if (kills >= need) t++;
  return t;
}

// Next tier target, or null when maxed.
export function bestiaryNext(kills: number): number | null {
  return BESTIARY_TIERS.find((need) => kills < need) ?? null;
}

// Sum every family bonus → one bag of stat add.
export function bestiaryBonus(state: GameState): Record<BestiaryStat, number> {
  const out: Record<BestiaryStat, number> = { atkPct: 0, hpPct: 0, goldPct: 0, expPct: 0, crit: 0, critDmg: 0, aps: 0, def: 0 };
  for (const id of Object.keys(BESTIARY) as FamilyId[]) {
    const tier = bestiaryTier(state.bestiary[id] ?? 0);
    if (tier) out[BESTIARY[id].stat] += BESTIARY[id].perTier * tier;
  }
  return out;
}

export function bestiaryTotalTiers(state: GameState): number {
  return (Object.keys(BESTIARY) as FamilyId[]).reduce((n, id) => n + bestiaryTier(state.bestiary[id] ?? 0), 0);
}

export function bestiaryDiscovered(state: GameState): number {
  return (Object.keys(BESTIARY) as FamilyId[]).filter((id) => (state.bestiary[id] ?? 0) > 0).length;
}
