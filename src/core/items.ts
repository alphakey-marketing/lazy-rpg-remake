import { ITEM, RARITIES, RARITY_MULT, RARITY_STAGE_SHIFT, RARITY_WEIGHT, REFINE, Rarity } from "../config/balance";
import { SLOTS, SUB_STATS, SUB_STAT_RANGE, Slot } from "../config/content";
import type { Rng } from "./rng";
import type { Item } from "./types";

export function rarityIndex(r: Rarity): number {
  return RARITIES.indexOf(r);
}

export function rollRarity(rng: Rng, stage: number, boost: number, boss: boolean): Rarity {
  const stageShift = 1 + RARITY_STAGE_SHIFT * stage;
  const weights = RARITIES.map((r, i) => {
    if (boss && i === 0) return 0; // boss never drop common
    let w = RARITY_WEIGHT[r];
    if (i > 0) w *= Math.pow(stageShift, i) * Math.pow(boost, i / 2) * (boss ? Math.pow(1.5, i) : 1);
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < RARITIES.length; i++) {
    roll -= weights[i];
    if (roll < 0) return RARITIES[i];
  }
  return RARITIES[RARITIES.length - 1];
}

export function generateItem(id: number, rng: Rng, stage: number, boost: number, boss: boolean, slot?: Slot): Item {
  const rarity = rollRarity(rng, stage, boost, boss);
  const s = slot ?? rng.pick(SLOTS);
  const subCount = ITEM.subStatCount[rarity];
  const pool = [...SUB_STATS];
  const subs = [];
  for (let i = 0; i < subCount && pool.length; i++) {
    const idx = rng.int(0, pool.length - 1);
    const sid = pool.splice(idx, 1)[0];
    const [lo, hi] = SUB_STAT_RANGE[sid];
    const scale = 0.8 + rarityIndex(rarity) * 0.15;
    subs.push({ id: sid, value: +(lo + (hi - lo) * rng.next()) * scale });
  }
  return { id, slot: s, rarity, ilvl: stage, refine: 0, subs, nameSeed: rng.int(0, 9999) };
}

export function refineMult(refine: number): number {
  let m = 1 + refine * REFINE.bonusPerLevel;
  for (const [lvl, bonus] of Object.entries(REFINE.milestoneBonus)) {
    if (refine >= Number(lvl)) m += bonus;
  }
  return m;
}

function scaled(item: Item, base: number): number {
  return base * Math.pow(ITEM.growth, item.ilvl - 1) * RARITY_MULT[item.rarity] * refineMult(item.refine);
}

export interface ItemMain {
  atk: number;
  hp: number;
  def: number;
  crit: number;
  critDmg: number;
}

// main stat of item (no subs)
export function itemMain(item: Item): ItemMain {
  const out: ItemMain = { atk: 0, hp: 0, def: 0, crit: 0, critDmg: 0 };
  const rm = RARITY_MULT[item.rarity];
  const ref = refineMult(item.refine);
  switch (item.slot) {
    case "weapon":
      out.atk = scaled(item, ITEM.weaponAtk);
      break;
    case "armor":
      out.hp = scaled(item, ITEM.armorHp);
      break;
    case "helm":
      out.hp = scaled(item, ITEM.helmHp);
      out.def = Math.min(0.25, ITEM.helmDef * rm * ref);
      break;
    case "ring":
      out.crit = ITEM.ringCrit * rm * ref;
      out.critDmg = ITEM.ringCritDmg * rm * ref;
      break;
  }
  return out;
}

export function salvageValue(item: Item): number {
  return Math.ceil(ITEM.salvageStones[item.rarity] * (1 + item.ilvl / 25) * (1 + item.refine * 0.5));
}
