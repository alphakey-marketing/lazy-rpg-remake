import { describe, expect, it } from "vitest";
import { type AchievementId } from "../src/config/achievements";
import { changeJob, rebirth } from "../src/core/actions";
import { achievementClaimable, achievementProgress, canClaimAchievement, claimAchievement, claimAllAchievements, syncAchievements } from "../src/core/achievements";
import { newGame, SAVE_VERSION } from "../src/core/newGame";
import { runOffline } from "../src/core/offline";
import { deserialize, serialize } from "../src/core/save";

const NOW = new Date(2026, 9, 21, 12).getTime();

describe("achievements", () => {
  it("starts locked, reports partial progress and rejects unknown claims", () => {
    const s = newGame(NOW, 1);
    expect(achievementClaimable(s)).toBe(0);
    expect(claimAchievement(s, "firstBoss")).toBe(false);
    expect(claimAchievement(s, "unknown" as AchievementId)).toBe(false);
    s.tower.highestFloor = 3;
    expect(achievementProgress(s, "tower5")).toBe(3);
    expect(canClaimAchievement(s, "tower5")).toBe(false);
  });

  it("grants an eligible achievement exactly once", () => {
    const s = newGame(NOW, 2);
    s.life.bossKills = 1;
    const gems = s.gems;
    expect(claimAchievement(s, "firstBoss")).toBe(true);
    expect(s.gems).toBe(gems + 5);
    expect(claimAchievement(s, "firstBoss")).toBe(false);
    expect(s.gems).toBe(gems + 5);
    expect(s.achievements.claimed).toEqual(["firstBoss"]);
    expect(s.achievements.unlocked).toEqual(["firstBoss"]);
  });

  it("claim all grants the configured rewards once without resetting daily or tower rewards", () => {
    const s = newGame(NOW, 3);
    s.life.bossKills = 10; s.life.rebirths = 1; s.job = "archmage";
    s.kuro.level = 5; s.tower.highestFloor = 10;
    const daily = JSON.stringify(s.daily), tower = JSON.stringify(s.tower);
    expect(achievementClaimable(s)).toBe(8);
    expect(claimAllAchievements(s)).toBe(8);
    expect({ fish: s.kuro.fish, gems: s.gems, stones: s.stones }).toEqual({ fish: 12, gems: 95, stones: 30 });
    expect(claimAllAchievements(s)).toBe(0);
    expect(JSON.stringify(s.daily)).toBe(daily);
    expect(JSON.stringify(s.tower)).toBe(tower);
    expect(new Set(s.achievements.claimed).size).toBe(8);
  });

  it("latches completed achievements idempotently without automatically paying", () => {
    const s = newGame(NOW, 4);
    s.kuro.level = 5;
    syncAchievements(s); syncAchievements(s);
    expect(s.achievements.unlocked).toEqual(["firstFeed", "autoClaw"]);
    expect(s.achievements.claimed).toEqual([]);
    expect(s.gems).toBe(50);
    expect(s.kuro.fish).toBe(0);
    expect(achievementProgress(s, "firstFeed")).toBe(2);
  });

  it("keeps an unclaimed job achievement through rebirth and reload", () => {
    const s = newGame(NOW, 5);
    s.level = 12;
    expect(changeJob(s, "arcanist")).toBe(true);
    s.maxStage = s.life.bestStage = 45;
    expect(rebirth(s, NOW)).toBeGreaterThan(0);
    expect(s.job).toBe("novice");
    expect(achievementProgress(s, "firstJob")).toBe(1);
    expect(canClaimAchievement(s, "firstRebirth")).toBe(true);
    const loaded = deserialize(serialize(s), NOW);
    expect(claimAchievement(loaded, "firstJob")).toBe(true);
    expect(loaded.stones).toBe(s.stones + 10);
    expect(claimAchievement(loaded, "firstJob")).toBe(false);
  });

  it("preserves claimed rewards across rebirth, reload and a new calendar day", () => {
    const s = newGame(NOW, 6);
    s.life.bossKills = 1;
    claimAchievement(s, "firstBoss");
    s.maxStage = s.life.bestStage = 45;
    rebirth(s, NOW);
    const loaded = deserialize(serialize(s), NOW + 86400000);
    expect(claimAchievement(loaded, "firstBoss")).toBe(false);
    expect(loaded.gems).toBe(55);
    expect(loaded.achievements.claimed).toContain("firstBoss");
  });

  it("recognizes a first boss earned offline without duplicate rewards after load", () => {
    const s = newGame(NOW, 7);
    runOffline(s, 300);
    const loaded = deserialize(serialize(s), NOW);
    expect(canClaimAchievement(loaded, "firstBoss")).toBe(true);
    expect(claimAchievement(loaded, "firstBoss")).toBe(true);
    const reloaded = deserialize(serialize(loaded), NOW);
    expect(claimAchievement(reloaded, "firstBoss")).toBe(false);
  });

  it.each([1, 2, 3])("upgrades v%s saves, backfills known progress and keeps currencies and tower claims", (version) => {
    const old = JSON.parse(serialize(newGame(NOW, 8)));
    delete old.achievements;
    old.version = version;
    old.gems = 123; old.stones = 45; old.kuro.level = 5;
    old.job = "arcanist"; old.tower.highestFloor = 5; old.tower.dailyClaimDay = "2026-10-21";
    const loaded = deserialize(JSON.stringify(old), NOW);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.achievements.claimed).toEqual([]);
    expect(loaded.achievements.unlocked).toEqual(expect.arrayContaining(["firstFeed", "firstJob", "autoClaw", "tower1", "tower5"]));
    expect(loaded.gems).toBe(123);
    expect(loaded.stones).toBe(45);
    expect(loaded.tower).toEqual(old.tower);
  });
});
