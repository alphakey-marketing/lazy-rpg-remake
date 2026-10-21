import { describe, expect, it } from "vitest";
import { BESTIARY_TIERS } from "../src/config/bestiary";
import { bestiaryBonus, bestiaryDiscovered, bestiaryNext, bestiaryTier, bestiaryTotalTiers } from "../src/core/bestiary";
import { newGame } from "../src/core/newGame";
import { computeStats } from "../src/core/stats";
import { rebirth } from "../src/core/actions";
import { canClaimAchievement } from "../src/core/achievements";

const NOW = 1_700_000_000_000;

describe("bestiary", () => {
  it("tiers follow kill thresholds", () => {
    expect(bestiaryTier(0)).toBe(0);
    expect(bestiaryTier(BESTIARY_TIERS[0] - 1)).toBe(0);
    expect(bestiaryTier(BESTIARY_TIERS[0])).toBe(1);
    expect(bestiaryTier(BESTIARY_TIERS[3])).toBe(4);
    expect(bestiaryNext(10)).toBe(BESTIARY_TIERS[0]);
    expect(bestiaryNext(BESTIARY_TIERS[3])).toBeNull();
  });

  it("stars raise hero stats", () => {
    const s = newGame(NOW, 1);
    const before = computeStats(s);
    s.bestiary.mushling = 500; // atk 2★
    s.bestiary.stumpy = 50; // gold 1★
    const b = bestiaryBonus(s);
    expect(b.atkPct).toBeCloseTo(0.06);
    expect(b.goldPct).toBeCloseTo(0.04);
    const after = computeStats(s);
    expect(after.atk / before.atk).toBeCloseTo(1.06);
    expect(after.goldMult / before.goldMult).toBeCloseTo(1.04);
    expect(bestiaryDiscovered(s)).toBe(2);
    expect(bestiaryTotalTiers(s)).toBe(3);
  });

  it("survives rebirth and feeds achievements", () => {
    const s = newGame(NOW, 2);
    for (const id of ["jelly", "mushling", "bat", "pebble", "bonelet", "imp", "wisp", "stumpy", "cactus", "yeti", "magma", "eyeball"] as const) s.bestiary[id] = 50;
    expect(canClaimAchievement(s, "dex12")).toBe(true);
    expect(canClaimAchievement(s, "dexStar12")).toBe(true);
    s.stage = s.maxStage = s.life.bestStage = 60;
    rebirth(s, NOW);
    expect(s.bestiary.jelly).toBe(50);
  });
});
