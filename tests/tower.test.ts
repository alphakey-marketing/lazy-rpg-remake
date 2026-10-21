import { describe, expect, it } from "vitest";
import { KURO, TOWER } from "../src/config/balance";
import { rebirth } from "../src/core/actions";
import { dayKey } from "../src/core/daily";
import { nextPlayerGoal } from "../src/core/goals";
import { newGame, SAVE_VERSION } from "../src/core/newGame";
import { deserialize, serialize } from "../src/core/save";
import { claimTowerDaily, createTowerRun, settleTowerRun, tickTower, towerClaw, towerDailyAvailable, towerDailyReward, towerFirstReward, towerModifier, towerUnlocked } from "../src/core/tower";

const TODAY = new Date(2026, 9, 21, 12).getTime();
const TOMORROW = new Date(2026, 9, 22, 12).getTime();
function unlocked() {
  const s = newGame(TODAY, 42);
  s.life.bestStage = TOWER.unlockStage;
  return s;
}
function winningRun(s = unlocked()) {
  const run = createTowerRun(s, TODAY)!;
  run.state.training.atk = 200;
  tickTower(run, 31);
  expect(run.result).toBe("won");
  return run;
}

describe("tower", () => {
  it("unlocks after the first chapter, including after rebirth", () => {
    const s = newGame(TODAY, 1);
    s.life.bestStage = 10;
    expect(createTowerRun(s, TODAY)).toBeNull();
    s.life.bestStage = 11;
    expect(towerUnlocked(s)).toBe(true);
    expect(createTowerRun(s, TODAY)?.floor).toBe(1);
  });

  it("isolates combat, drops, quests, gear and RNG from the main game", () => {
    const s = unlocked();
    const before = serialize(s);
    const run = winningRun(s);
    expect(serialize(s)).toBe(before);
    const events: string[] = [];
    const second = createTowerRun(s, TODAY)!;
    second.state.training.atk = 200;
    tickTower(second, 31, (e) => events.push(e.t));
    expect(events).toContain("bossWin");
    expect(events).not.toContain("loot");
    expect(events).not.toContain("fish");
    expect(serialize(s)).toBe(before);
    expect(run.elapsed).toBeLessThanOrEqual(TOWER.timeLimit + 0.05);
  });

  it("pays first clear and the shared daily reward once", () => {
    const s = unlocked();
    const before = { fish: s.kuro.fish, gems: s.gems };
    const run = winningRun(s);
    const first = towerFirstReward(1);
    const paid = settleTowerRun(s, run, TODAY)!;
    expect(s.tower.highestFloor).toBe(1);
    expect(paid).toEqual({ fish: first.fish + towerDailyReward(s).fish, gems: first.gems + TOWER.dailyGems });
    expect(s.kuro.fish).toBe(before.fish + paid.fish);
    expect(s.gems).toBe(before.gems + paid.gems);
    expect(settleTowerRun(s, run, TODAY)).toBeNull();
    expect(claimTowerDaily(s, TODAY)).toBeNull();
    tickTower(run, 31);
    expect(s.tower.highestFloor).toBe(1);
  });

  it("rejects a stale parallel attempt to the same floor", () => {
    const s = unlocked();
    const a = winningRun(s), b = winningRun(s);
    settleTowerRun(s, a, TODAY);
    const saved = serialize(s);
    expect(settleTowerRun(s, b, TODAY)).toBeNull();
    expect(serialize(s)).toBe(saved);
  });

  it("has no pre-clear sweep; refreshes at local midnight with a capped daily reward", () => {
    const s = unlocked();
    expect(claimTowerDaily(s, TODAY)).toBeNull();
    s.tower.highestFloor = 500;
    expect(claimTowerDaily(s, TODAY)).toEqual({ fish: 12, gems: 10 });
    expect(towerDailyAvailable(s, TODAY)).toBe(false);
    const midnight = new Date(2026, 9, 22).getTime();
    expect(towerDailyAvailable(s, midnight - 1)).toBe(false);
    expect(towerDailyAvailable(s, midnight)).toBe(true);
    expect(claimTowerDaily(s, midnight)).toEqual({ fish: 12, gems: 10 });
    expect(claimTowerDaily(s, midnight)).toBeNull();
  });

  it("shares the daily claim between sweep and breakthrough", () => {
    const s = unlocked();
    s.tower.highestFloor = 1;
    claimTowerDaily(s, TODAY);
    const run = winningRun(s);
    expect(settleTowerRun(s, run, TODAY)).toEqual(towerFirstReward(2));
  });

  it("keeps today's daily claim available if a fight began yesterday", () => {
    const s = unlocked();
    const run = winningRun(s);
    expect(settleTowerRun(s, run, TOMORROW)).toEqual(towerFirstReward(1));
    expect(claimTowerDaily(s, TOMORROW)).not.toBeNull();
    expect(s.tower.dailyClaimDay).toBe(dayKey(TOMORROW));
  });

  it("awards gems only at first-clear milestones", () => {
    expect(towerFirstReward(4).gems).toBe(0);
    expect(towerFirstReward(5).gems).toBe(TOWER.milestoneGems);
    const s = unlocked();
    s.tower.highestFloor = 4;
    s.tower.dailyClaimDay = dayKey(TODAY);
    expect(settleTowerRun(s, winningRun(s), TODAY)).toEqual(towerFirstReward(5));
  });

  it("failure consumes no resources or progress, and retry starts healthy", () => {
    const s = unlocked();
    const before = serialize(s);
    const run = createTowerRun(s, TODAY)!;
    run.state.battle.heroHp = 0.01;
    run.state.battle.enemy!.atk = 1e9;
    tickTower(run, 5);
    expect(run.result).toBe("dead");
    expect(run.remainingHp).toBeGreaterThan(0);
    expect(settleTowerRun(s, run, TODAY)).toBeNull();
    expect(serialize(s)).toBe(before);
    const retry = createTowerRun(s, TODAY)!;
    expect(retry.floor).toBe(1);
    expect(retry.state.battle.heroHp).toBeGreaterThan(0.01);
  });

  it("times out at 30s, accepts manual claw and rejects actions after completion", () => {
    const run = createTowerRun(unlocked(), TODAY)!;
    run.state.battle.enemy!.hp = run.state.battle.enemy!.maxHp = 1e20;
    run.state.battle.enemy!.atk = 0;
    expect(towerClaw(run)).toBe(true);
    expect(towerClaw(run)).toBe(false);
    tickTower(run, 31);
    expect(run.result).toBe("timeout");
    expect(run.elapsed).toBeCloseTo(30, 1);
    expect(towerClaw(run)).toBe(false);
  });

  it("uses a stable calendar modifier and progresses enemy difficulty", () => {
    expect(towerModifier(TODAY)).toEqual(towerModifier(TODAY + 1000));
    expect(towerModifier(TOMORROW)).not.toEqual(towerModifier(TODAY));
    const s = unlocked();
    const a = createTowerRun(s, TODAY)!;
    s.tower.highestFloor = 1;
    const b = createTowerRun(s, TODAY)!;
    expect(b.state.battle.enemy!.maxHp).toBeGreaterThan(a.state.battle.enemy!.maxHp);
    s.tower.highestFloor = 4;
    expect(createTowerRun(s, TODAY)!.state.battle.enemy!.kind).toBe("chapterBoss");
  });

  it.each([1, 2])("loads v%s saves without losing existing progress", (version) => {
    const raw = JSON.parse(serialize(unlocked()));
    raw.version = version;
    raw.gold = 12345;
    raw.kuro.level = 8;
    raw.bestiary.slime = 123;
    delete raw.tower;
    const restored = deserialize(JSON.stringify(raw), TODAY);
    expect(restored.version).toBe(SAVE_VERSION);
    expect(restored.tower).toEqual({ highestFloor: 0, dailyClaimDay: null });
    expect(restored.gold).toBe(12345);
    expect(restored.kuro.level).toBe(8);
    expect(restored.bestiary).toEqual(raw.bestiary);
    expect(deserialize(serialize(restored), TODAY)).toEqual(restored);
  });

  it("keeps tower progress and daily claim after rebirth and reload", () => {
    const s = unlocked();
    s.maxStage = s.life.bestStage = 50;
    s.tower = { highestFloor: 12, dailyClaimDay: dayKey(TODAY) };
    expect(rebirth(s, TODAY)).toBeGreaterThan(0);
    expect(s.tower).toEqual({ highestFloor: 12, dailyClaimDay: dayKey(TODAY) });
    expect(towerUnlocked(s)).toBe(true);
    const loaded = deserialize(serialize(s), TODAY);
    expect(loaded.tower).toEqual(s.tower);
    expect(claimTowerDaily(loaded, TODAY)).toBeNull();
  });
});

describe("first-session goals", () => {
  it("makes first training, petting, feeding and job change discoverable", () => {
    const s = unlocked();
    expect(nextPlayerGoal(s, TODAY).panel).toBe("train");
    s.training.atk = 1; s.life.bossKills = 1;
    expect(nextPlayerGoal(s, TODAY).title).toContain("摸摸");
    s.kuro.lastPet = TODAY;
    expect(nextPlayerGoal(s, TODAY).title).toContain("第一次餵");
    s.kuro.level = 2; s.level = 12;
    expect(nextPlayerGoal(s, TODAY).panel).toBe("hero");
  });
  it("leads to the first tower clear and auto claw, then tomorrow's goal", () => {
    const s = unlocked();
    s.training.atk = 1; s.life.bossKills = 1; s.kuro.lastPet = TODAY;
    s.kuro.level = 2; s.job = "arcanist";
    expect(nextPlayerGoal(s, TODAY).panel).toBe("tower");
    s.tower.highestFloor = 1;
    expect(nextPlayerGoal(s, TODAY).title).toContain("自動貓爪");
    s.kuro.level = KURO.autoCastLevel;
    expect(nextPlayerGoal(s, TODAY).title).toContain("今日");
    s.tower.dailyClaimDay = dayKey(TODAY);
    expect(nextPlayerGoal(s, TODAY).detail).toContain("離開後");
    expect(nextPlayerGoal(s, TOMORROW).title).toContain("今日");
  });
});
