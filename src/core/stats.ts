import { BALANCE, ITEM, KURO, REBIRTH_PERKS, TRAINING, TRAINING_MILESTONE } from "../config/balance";
import { JOBS, SLOTS, Slot } from "../config/content";
import { corruptionTier } from "./formulas";
import { itemMain } from "./items";
import type { GameState, Item } from "./types";

export interface HeroStats {
  atk: number;
  maxHp: number;
  def: number; // dmg reduction 0..maxDef
  crit: number;
  critDmg: number;
  aps: number;
  goldMult: number;
  expMult: number;
  dps: number; // expected, for display & offline estimate
  power: number;
}

const H = BALANCE.hero;

function trainMilestone(level: number): number {
  return Math.pow(TRAINING_MILESTONE.mult, Math.floor(level / TRAINING_MILESTONE.every));
}

export function computeStats(state: GameState, gearOverride?: Partial<Record<Slot, Item | null>>): HeroStats {
  const job = JOBS[state.job];
  const lvl = state.level;
  const gear = { ...state.gear, ...gearOverride };

  let atkFlat = H.baseAtk + H.atkPerLevel * (lvl - 1);
  let hpFlat = H.baseHp + H.hpPerLevel * (lvl - 1);
  atkFlat += state.training.atk * TRAINING.atk.perLevel * trainMilestone(state.training.atk);
  hpFlat += state.training.hp * TRAINING.hp.perLevel * trainMilestone(state.training.hp);

  let def = job.defAdd;
  let crit = H.baseCrit + job.critAdd + state.training.crit * TRAINING.crit.perLevel;
  let critDmg = H.baseCritDmg + job.critDmgAdd;
  let atkPct = 0, hpPct = 0, apsPct = state.training.speed * TRAINING.speed.perLevel, goldPct = 0, expPct = 0;

  for (const slot of SLOTS) {
    const it = gear[slot];
    if (!it) continue;
    const m = itemMain(it);
    atkFlat += m.atk;
    hpFlat += m.hp;
    def += m.def;
    crit += m.crit;
    critDmg += m.critDmg;
    for (const s of it.subs) {
      switch (s.id) {
        case "atkPct": atkPct += s.value; break;
        case "hpPct": hpPct += s.value; break;
        case "crit": crit += s.value; break;
        case "critDmg": critDmg += s.value; break;
        case "goldPct": goldPct += s.value; break;
        case "expPct": expPct += s.value; break;
        case "aps": apsPct += s.value; break;
      }
    }
  }

  const lvlMult = Math.pow(H.levelMult, lvl - 1);
  const p = state.perks;
  const atk = atkFlat * lvlMult * job.atkMult * (1 + atkPct) * (1 + p.soulAtk * REBIRTH_PERKS.soulAtk.perLevel);
  const maxHp = hpFlat * lvlMult * job.hpMult * (1 + hpPct) * (1 + p.soulHp * REBIRTH_PERKS.soulHp.perLevel);
  def = Math.min(ITEM.maxDef, def);
  crit = Math.min(H.maxCrit, crit);
  const aps = Math.min(H.maxAps, H.baseAps * job.apsMult * (1 + apsPct));
  const corr = corruptionTier(state.corruption);
  const k = state.kuro;
  const bless = k.buffLeft > 0 ? 1 + KURO.buffMult : 1;
  const kuroGold = 1 + (k.level - 1) * KURO.goldPerLevel;
  const goldMult = (1 + goldPct) * (1 + p.soulGold * REBIRTH_PERKS.soulGold.perLevel) * corr.reward * kuroGold * bless;
  const expMult = (1 + expPct) * (1 + p.soulExp * REBIRTH_PERKS.soulExp.perLevel) * corr.reward * bless;

  const skill = job.skill;
  const critFactor = 1 + crit * (critDmg - 1);
  const kuroDps = KURO.strikeMult(k.level) / KURO.cooldown(k.level);
  const dps = atk * critFactor * (aps + (skill.hits * skill.mult) / skill.cooldown + kuroDps);
  const ehp = maxHp / (1 - def);
  const power = Math.floor(dps * 6 + ehp * 0.6);

  return { atk, maxHp, def, crit, critDmg, aps, goldMult, expMult, dps, power };
}

// power if this item put on (for compare & auto-equip)
export function powerWith(state: GameState, item: Item): number {
  return computeStats(state, { [item.slot]: item }).power;
}

export function isUpgrade(state: GameState, item: Item): boolean {
  const cur = state.gear[item.slot];
  if (!cur) return true;
  return powerWith(state, item) > computeStats(state).power;
}
