import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { newGame } from "../src/core/newGame";
import { tick } from "../src/core/sim";
import { runOffline, offlineCapSeconds } from "../src/core/offline";
import { expToNext } from "../src/core/formulas";
import { buyTraining, claimDaily, claimLogin, rebirth, refine, buyPerk, feedKuro, kuroTap, petKuro } from "../src/core/actions";
import { generateItem } from "../src/core/items";
import { serialize, deserialize } from "../src/core/save";
import { fmt } from "../src/core/format";
import { KURO, REFINE } from "../src/config/balance";
import type { SimEvent } from "../src/core/types";

const T0 = new Date(2026, 0, 10, 12).getTime();

function play(seconds: number, seed = 1) {
  const s = newGame(T0, seed);
  const rng = createRng(seed);
  for (let t = 0; t < seconds; t += 0.25) tick(s, 0.25, rng);
  return s;
}

describe("rng", () => {
  it("same seed same stream", () => {
    const a = createRng(99), b = createRng(99);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it("resume from saved seed", () => {
    const a = createRng(5);
    a.next(); a.next();
    const b = createRng(a.seed());
    expect(b.next()).toBe(a.next());
  });
});

describe("formulas", () => {
  it("exp curve go up, never NaN", () => {
    for (let l = 1; l < 500; l++) {
      expect(expToNext(l + 1)).toBeGreaterThan(expToNext(l));
      expect(Number.isFinite(expToNext(l))).toBe(true);
    }
  });
  it("fmt big number", () => {
    expect(fmt(999)).toBe("999");
    expect(fmt(1500)).toBe("1.50K");
    expect(fmt(2.5e6)).toBe("2.50M");
    expect(fmt(1e15)).toBe("1.00aa");
  });
});

describe("sim", () => {
  it("deterministic: same seed same result", () => {
    const a = play(600, 3), b = play(600, 3);
    expect(serialize(a)).toBe(serialize(b));
  });
  it("hero make progress in 5 min", () => {
    const s = play(300);
    expect(s.stage).toBeGreaterThan(1);
    expect(s.level).toBeGreaterThan(1);
    expect(s.gold).toBeGreaterThan(0);
  });
  it("emit kill + spawn event", () => {
    const s = newGame(T0, 1);
    const rng = createRng(1);
    const ev: SimEvent["t"][] = [];
    for (let i = 0; i < 400; i++) tick(s, 0.05, rng, (e) => ev.push(e.t));
    expect(ev).toContain("spawn");
    expect(ev).toContain("kill");
    expect(ev).toContain("heroHit");
  });
  it("hp never NaN after long play", () => {
    const s = play(3600);
    expect(Number.isFinite(s.battle.heroHp)).toBe(true);
    expect(Number.isFinite(s.gold)).toBe(true);
  });
});

describe("offline", () => {
  it("capped at 8h", () => {
    const s = newGame(T0, 1);
    const sum = runOffline(s, 48 * 3600);
    expect(sum.cappedSeconds).toBe(offlineCapSeconds(s));
    expect(sum.cappedSeconds).toBe(8 * 3600);
  });
  it("deterministic", () => {
    const a = newGame(T0, 4), b = newGame(T0, 4);
    const sa = runOffline(a, 1800), sb = runOffline(b, 1800);
    expect(sa).toEqual(sb);
    expect(sa.kills).toBeGreaterThan(0);
    expect(sa.gold).toBeGreaterThan(0);
  });
  it("bump daily offline quest", () => {
    const s = newGame(T0, 1);
    runOffline(s, 600);
    expect(s.daily.progress.offline).toBe(1);
  });
});

describe("refine", () => {
  it("never destroy item, never go below +5 floor rule", () => {
    const s = newGame(T0, 1);
    const rng = createRng(11);
    const item = generateItem(1, rng, 10, 1, false, "weapon");
    s.gear.weapon = item;
    s.stones = 1e9;
    s.gold = 1e12;
    let minAfter5 = 99;
    let reached5 = false;
    for (let i = 0; i < 3000; i++) {
      const r = refine(s, item.id, false, rng);
      expect(s.gear.weapon).not.toBeNull();
      if (s.gear.weapon!.refine >= 5) reached5 = true;
      if (reached5) minAfter5 = Math.min(minAfter5, s.gear.weapon!.refine);
      if (r === "max") break;
    }
    expect(s.gear.weapon!.refine).toBeLessThanOrEqual(REFINE.maxLevel);
    expect(minAfter5).toBeGreaterThanOrEqual(4);
  });
  it("charm protect from downgrade", () => {
    const s = newGame(T0, 1);
    const rng = createRng(2);
    const item = generateItem(1, rng, 10, 1, false, "weapon");
    item.refine = 14;
    s.gear.weapon = item;
    s.stones = 1e9; s.gold = 1e12; s.protectCharms = 1000;
    for (let i = 0; i < 50; i++) {
      if (item.refine >= 15) break;
      refine(s, item.id, true, rng);
      expect(item.refine).toBeGreaterThanOrEqual(14);
    }
  });
});

describe("training", () => {
  it("spend gold, raise level", () => {
    const s = newGame(T0, 1);
    s.gold = 1000;
    const n = buyTraining(s, "atk", "max");
    expect(n).toBeGreaterThan(0);
    expect(s.training.atk).toBe(n);
    expect(s.gold).toBeGreaterThanOrEqual(0);
  });
});

describe("rebirth", () => {
  it("keep shards & gems, reset run", () => {
    const s = newGame(T0, 1);
    s.maxStage = 50; s.stage = 50; s.level = 80; s.gems = 123; s.shards = 5;
    s.life.bestStage = 50;
    const got = rebirth(s, T0);
    expect(got).toBeGreaterThan(0);
    expect(s.shards).toBe(5 + got);
    expect(s.gems).toBe(123);
    expect(s.level).toBe(1);
    expect(s.stage).toBe(1);
    expect(s.life.rebirths).toBe(1);
    expect(buyPerk(s, "soulAtk")).toBe(true);
  });
  it("not allowed before stage 40", () => {
    const s = newGame(T0, 1);
    s.maxStage = 30;
    expect(rebirth(s, T0)).toBe(0);
  });
});

describe("daily / login", () => {
  it("claim login once per day", () => {
    const s = newGame(T0, 1);
    expect(claimLogin(s, T0)).not.toBeNull();
    expect(claimLogin(s, T0 + 1000)).toBeNull();
    expect(claimLogin(s, T0 + 86400000)).not.toBeNull();
    expect(s.login.streakIndex).toBe(2);
  });
  it("daily quest claim need progress", () => {
    const s = newGame(T0, 1);
    expect(claimDaily(s, "kill", T0)).toBe(false);
    s.daily.progress.kill = 300;
    const g = s.gems;
    expect(claimDaily(s, "kill", T0)).toBe(true);
    expect(s.gems).toBeGreaterThan(g);
    expect(claimDaily(s, "kill", T0)).toBe(false);
  });
});

describe("save", () => {
  it("roundtrip", () => {
    const s = play(300);
    const back = deserialize(serialize(s), T0);
    expect(back).toEqual(s);
  });
  it("old save missing field get default", () => {
    const s = play(60) as any;
    delete s.settings.haptics;
    delete s.perks;
    const back = deserialize(JSON.stringify(s), T0);
    expect(back.settings.haptics).toBe(true);
    expect(back.perks.soulAtk).toBe(0);
  });
});

describe("kuro", () => {
  it("boss win drop fish", () => {
    const s = play(300);
    expect(s.life.bossKills).toBeGreaterThan(0);
    expect(s.kuro.fish).toBeGreaterThan(0);
  });
  it("tap claw hit enemy, then cooldown", () => {
    const s = newGame(T0, 3);
    const rng = createRng(3);
    while (!s.battle.enemy) tick(s, 0.05, rng);
    s.kuro.strikeCd = 0;
    s.battle.enemy!.hp = 1e12;
    const before = s.battle.enemy!.hp;
    const ev: SimEvent[] = [];
    expect(kuroTap(s, rng, (e) => ev.push(e))).toBe(true);
    expect(s.battle.enemy!.hp).toBeLessThan(before);
    expect(ev.some((e) => e.t === "kuroStrike")).toBe(true);
    expect(kuroTap(s, rng)).toBe(false); // on cooldown
  });
  it("auto claw only after unlock level", () => {
    const count = (lvl: number) => {
      const s = newGame(T0, 4);
      s.kuro.level = lvl;
      const rng = createRng(4);
      let n = 0;
      for (let t = 0; t < 120; t += 0.05) tick(s, 0.05, rng, (e) => { if (e.t === "kuroStrike") n++; });
      return n;
    };
    expect(count(1)).toBe(0);
    expect(count(KURO.autoCastLevel)).toBeGreaterThan(3);
  });
  it("feed level up, cost fish", () => {
    const s = newGame(T0, 1);
    expect(feedKuro(s)).toBe(false);
    s.kuro.fish = 1000;
    const cap0 = offlineCapSeconds(s);
    expect(feedKuro(s)).toBe(true);
    expect(s.kuro.level).toBe(2);
    expect(s.kuro.fish).toBe(1000 - KURO.feedCost(1));
    expect(offlineCapSeconds(s)).toBeGreaterThan(cap0);
  });
  it("pet: cooldown, sulk give double, blessing", () => {
    const s = newGame(T0, 1);
    const a = petKuro(s, T0)!;
    expect(a.fish).toBeGreaterThan(0);
    expect(s.kuro.buffLeft).toBe(KURO.buffSeconds);
    expect(petKuro(s, T0 + 3600_000)).toBeNull();
    const b = petKuro(s, T0 + 30 * 3600_000)!;
    expect(b.sulk).toBe(true);
    expect(b.fish).toBe(a.fish * KURO.sulkFishMult);
  });
  it("rebirth keep kuro", () => {
    const s = newGame(T0, 1);
    s.maxStage = 60; s.stage = 60; s.life.bestStage = 60;
    s.kuro.level = 7; s.kuro.fish = 12;
    rebirth(s, T0);
    expect(s.kuro.level).toBe(7);
    expect(s.kuro.fish).toBe(12);
  });
  it("v1 save get kuro default", () => {
    const old: any = JSON.parse(serialize(newGame(T0, 1)));
    delete old.kuro;
    old.version = 1;
    const s = deserialize(JSON.stringify(old), T0);
    expect(s.kuro.level).toBe(1);
    expect(s.version).toBe(2);
  });
});
