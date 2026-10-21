import { BALANCE, Rarity, REBIRTH_PERKS } from "../config/balance";
import { bumpDaily } from "./daily";
import { rarityIndex, salvageValue } from "./items";
import { createRng } from "./rng";
import { tick } from "./sim";
import type { GameState, OfflineSummary } from "./types";

export function offlineCapSeconds(state: GameState): number {
  return (BALANCE.offlineBaseCapHours + state.perks.offlineCap * REBIRTH_PERKS.offlineCap.perLevel) * 3600;
}

// Fast-forward real sim. Same rule as live → no fake number.
export function runOffline(state: GameState, seconds: number): OfflineSummary {
  const capped = Math.min(seconds, offlineCapSeconds(state));
  const rng = createRng(state.seed);
  const startLevel = state.level;
  const startStage = state.stage;
  const startGold = state.gold;
  const startStones = state.stones;
  const sum: OfflineSummary = {
    seconds, cappedSeconds: capped, kills: 0, bossKills: 0, gold: 0, exp: 0,
    levelsGained: 0, stagesGained: 0, items: 0, salvagedStones: 0, bestRarity: null,
  };
  let best = -1;
  const dt = BALANCE.offlineTickSeconds;
  const steps = Math.floor(capped / dt);
  for (let i = 0; i < steps; i++) {
    tick(state, dt, rng, (e) => {
      switch (e.t) {
        case "kill":
          sum.kills++;
          sum.exp += e.exp;
          if (e.enemy.kind !== "normal") sum.bossKills++;
          break;
        case "loot": {
          sum.items++;
          const r = rarityIndex(e.item.rarity);
          if (r > best) { best = r; sum.bestRarity = e.item.rarity as Rarity; }
          if (e.salvaged) sum.salvagedStones += salvageValue(e.item);
          break;
        }
      }
    });
  }
  state.seed = rng.seed();
  sum.gold = state.gold - startGold;
  sum.levelsGained = state.level - startLevel;
  sum.stagesGained = state.stage - startStage;
  sum.salvagedStones = Math.max(sum.salvagedStones, state.stones - startStones);
  if (capped >= BALANCE.offlineMinSeconds) bumpDaily(state, "offline");
  return sum;
}

// rewarded ad: double gold + stones of offline gain
export function applyOfflineDouble(state: GameState, sum: OfflineSummary) {
  state.gold += sum.gold;
  state.stones += sum.salvagedStones;
  state.life.goldEarned += sum.gold;
}
