import { describe, expect, it } from "vitest";
import { SPECIALIZATIONS, type JobId, type SpecializationId } from "../src/config/content";
import { canRespecJob, changeJob, chooseSpecialization, rebirth, respecJob, specializationReady } from "../src/core/actions";
import { jobMechanics } from "../src/core/jobs";
import { freshCombat, newGame, SAVE_VERSION } from "../src/core/newGame";
import { createRng } from "../src/core/rng";
import { deserialize, serialize } from "../src/core/save";
import { tick } from "../src/core/sim";
import { computeStats } from "../src/core/stats";
import type { GameState, SimEvent } from "../src/core/types";
import { createTowerRun, tickTower, towerClaw } from "../src/core/tower";
import { advanceTowerPresentation, createTowerPresentation } from "../src/ui/towerPresentation";

function arena(job: JobId) {
  const s = newGame(0, 42); s.level = 45; s.job = job; s.settings.autoBoss = false; s.kuro.auto = false;
  s.battle.enemy = { family: "pebble", variant: 0, level: 45, hp: 1e8, maxHp: 1e8, atk: 0, aps: 1, kind: "normal" };
  s.battle.heroHp = computeStats(s).maxHp;
  s.battle.heroAtkTimer = -100; s.battle.skillTimer = 0;
  return s;
}
function advance(s: GameState, seconds: number, events: SimEvent[] = []) {
  const rng = createRng(100);
  for (let n = 0; n < Math.round(seconds / .05); n++) tick(s, .05, rng, (e) => events.push(e));
  return events;
}

describe("job identity", () => {
  it("announces a meteor before impact and spends full mana exactly once", () => {
    const s = arena("arcanist"); s.battle.combat.mana = 3;
    const hp = s.battle.enemy!.hp;
    const events = advance(s, .4);
    expect(events.find((e) => e.t === "skillCast")).toMatchObject({ empowered: true });
    expect(s.battle.enemy!.hp).toBe(hp);
    expect(s.battle.combat.mana).toBe(0);
    advance(s, .15, events);
    expect(events.filter((e) => e.t === "skill")).toHaveLength(1);
    expect(events.find((e) => e.t === "skill")).toMatchObject({ empowered: true, hitIndex: 0 });
    expect(s.battle.enemy!.hp).toBeLessThan(hp);
  });
  it("lands a volley in five separate steps, never as one summed damage packet", () => {
    const s = arena("ranger"); const events: SimEvent[] = [];
    advance(s, .2, events);
    expect(events.filter((e) => e.t === "skill")).toHaveLength(1);
    advance(s, .5, events);
    const hits = events.filter((e) => e.t === "skill");
    expect(hits).toHaveLength(5);
    expect(hits.map((e) => e.t === "skill" && e.hitIndex)).toEqual([0, 1, 2, 3, 4]);
  });
  it("discards remaining combo hits on death and across a reload", () => {
    const s = arena("ranger"); s.battle.enemy!.hp = 1;
    advance(s, .2);
    expect(s.battle.enemy).toBeNull();
    expect(s.battle.combat.pending).toBeNull();
    const loaded = deserialize(serialize(s), 0);
    const events = advance(loaded, .7);
    expect(events.filter((e) => e.t === "skill")).toHaveLength(0);
  });
  it("resumes an in-flight spell after saving without a duplicate cast or hit", () => {
    const s = arena("arcanist"); s.battle.combat.mana = 3;
    advance(s, .2);
    const loaded = deserialize(serialize(s), 0);
    const events = advance(loaded, .4);
    advance(s, .4);
    expect(loaded.battle.enemy!.hp).toBeCloseTo(s.battle.enemy!.hp);
    expect(events.filter((e) => e.t === "skillCast")).toHaveLength(0);
    expect(events.filter((e) => e.t === "skill")).toHaveLength(1);
  });
  it("gains a shield, absorbs an enemy attack, and counters with a distinct event", () => {
    const s = arena("blade"); s.battle.enemy!.atk = 100; s.battle.enemyAtkTimer = .95;
    const hp = s.battle.heroHp;
    const events = advance(s, .05);
    expect(s.battle.heroHp).toBe(hp);
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ t: "ward", blocked: true }), expect.objectContaining({ t: "proc", kind: "counter" })]));
    s.battle.skillTimer = 100;
    advance(s, 3.1);
    expect(s.battle.combat.shield).toBe(0);
  });
  it("triggers pursuit only after the required number of normal attacks", () => {
    const s = arena("ranger"); s.battle.skillTimer = 100;
    const events: SimEvent[] = [];
    for (let n = 0; n < 4; n++) { s.battle.heroAtkTimer = 1; advance(s, .05, events); }
    expect(events.filter((e) => e.t === "heroHit")).toHaveLength(4);
    expect(events.filter((e) => e.t === "proc")).toHaveLength(1);
    expect(s.battle.combat.combo).toBe(0);
  });
  it.each(Object.keys(SPECIALIZATIONS) as SpecializationId[])("selects %s only for its tier-2 job and only once", (id) => {
    const s = arena("novice");
    expect(chooseSpecialization(s, id)).toBe(false);
    s.job = SPECIALIZATIONS[id].job;
    expect(specializationReady(s)).toBe(true);
    expect(chooseSpecialization(s, id)).toBe(true);
    expect(chooseSpecialization(s, id)).toBe(false);
    expect(deserialize(serialize(s), 0).specialization).toBe(id);
  });
  it("gives specializations distinct shield, cadence and pursuit tradeoffs", () => {
    const s = arena("archmage"); s.specialization = "flow";
    const fast = jobMechanics(s); s.specialization = "cataclysm";
    expect(jobMechanics(s).cooldown).toBeGreaterThan(fast.cooldown);
    expect(jobMechanics(s).skillScale).toBeGreaterThan(fast.skillScale);
    s.job = "paladin"; s.specialization = "guardian";
    const guard = jobMechanics(s); s.specialization = "judicator";
    expect(jobMechanics(s).shieldFraction).toBeLessThan(guard.shieldFraction);
    expect(jobMechanics(s).counterScale).toBeGreaterThan(guard.counterScale);
    s.job = "sniper"; s.specialization = "barrage";
    const barrage = jobMechanics(s); s.specialization = "marksman";
    expect(jobMechanics(s).comboTarget).toBeGreaterThan(barrage.comboTarget);
    expect(jobMechanics(s).pursuitScale).toBeGreaterThan(barrage.pursuitScale);
  });
  it("retains health percentage at promotion and makes the first new skill visible", () => {
    const s = arena("novice"); s.battle.heroHp = computeStats(s).maxHp * .5;
    expect(changeJob(s, "arcanist")).toBe(true);
    expect(s.battle.heroHp / computeStats(s).maxHp).toBeCloseTo(.5);
    expect(s.battle.combat.showcase).toBe(true);
    s.battle.enemy!.hp = 1;
    const events = advance(s, 3);
    expect(events.find((e) => ["heroHit", "skill", "kuroStrike"].includes(e.t))?.t).toBe("skill");
  });
  it("allows one tier-1 respec, preserving health ratio, cooldown, and meta on rebirth", () => {
    const s = arena("blade"); s.battle.skillTimer = 4;
    s.battle.heroHp = computeStats(s).maxHp * .4;
    s.inBoss = true; expect(canRespecJob(s, "ranger")).toBe(false);
    s.inBoss = false; expect(respecJob(s, "ranger")).toBe(true);
    expect(s.battle.heroHp / computeStats(s).maxHp).toBeCloseTo(.4);
    expect(s.battle.skillTimer).toBe(4);
    expect(respecJob(s, "blade")).toBe(false);
    s.maxStage = s.life.bestStage = 50; s.specialization = "barrage";
    rebirth(s, 100);
    expect(s.specialization).toBeNull(); expect(s.jobRespecUsed).toBe(true);
    expect(s.battle.combat).toEqual(freshCombat());
  });
  it("upgrades v4 data without consuming respec, choosing a specialization or losing progress", () => {
    const old = JSON.parse(serialize(arena("archmage")));
    old.version = 4; old.gems = 153; old.tower.highestFloor = 11;
    delete old.specialization; delete old.jobRespecUsed; delete old.battle.combat;
    const s = deserialize(JSON.stringify(old), 0);
    expect(s.version).toBe(SAVE_VERSION); expect(s.job).toBe("archmage");
    expect(s.gems).toBe(153); expect(s.tower.highestFloor).toBe(11);
    expect(s.specialization).toBeNull(); expect(s.jobRespecUsed).toBe(false);
    expect(s.battle.combat).toEqual(freshCombat());
  });
});

describe("tower readability", () => {
  it("separates entrance and impact from the actual combat clock", () => {
    const p = createTowerPresentation();
    advanceTowerPresentation(p, .79, false); expect(p.phase).toBe("intro");
    advanceTowerPresentation(p, .01, false); expect(p.phase).toBe("combat");
    advanceTowerPresentation(p, .05, true); expect(p.phase).toBe("impact");
    advanceTowerPresentation(p, .89, true); expect(p.phase).toBe("impact");
    advanceTowerPresentation(p, .01, true); expect(p.phase).toBe("result");
  });
  it("keeps true one-hit kills and records the real finisher, including manual claws", () => {
    const s = newGame(0, 3); s.life.bestStage = 50; s.training.atk = 1000;
    const run = createTowerRun(s, new Date(2026, 9, 21).getTime())!;
    const hp = run.enemyMaxHp;
    tickTower(run, 2);
    expect(run.result).toBe("won"); expect(run.hits).toBe(1);
    expect(run.finisher!.dmg).toBeGreaterThanOrEqual(hp);
    expect(run.elapsed).toBeLessThan(1);
    const manual = createTowerRun(s, new Date(2026, 9, 21).getTime())!;
    expect(towerClaw(manual)).toBe(true);
    tickTower(manual, .05);
    expect(manual.result).toBe("won"); expect(manual.finisher?.source).toBe("kuro");
  });
});
