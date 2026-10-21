import { BALANCE, TOWER } from "../config/balance";
import { freshCombat } from "./newGame";
import { dayKey } from "./daily";
import { makeEnemy } from "./formulas";
import { createRng, type Rng } from "./rng";
import { kuroStrike, noEmit, tick, type Emit } from "./sim";
import { computeStats } from "./stats";
import type { GameState, SimEvent } from "./types";

export interface TowerReward { fish: number; gems: number; }
export interface TowerRun {
  state: GameState;
  rng: Rng;
  floor: number;
  day: string;
  elapsed: number;
  remainingHp: number;
  result: "won" | "dead" | "timeout" | null;
  settled: boolean;
  enemyMaxHp: number;
  enemyLevel: number;
  hits: number;
  finisher: { source: "normal" | "skill" | "kuro" | "counter" | "pursuit"; skillId?: string; dmg: number } | null;
}

export function towerUnlocked(state: GameState): boolean {
  return state.life.bestStage >= TOWER.unlockStage;
}

export function towerModifier(now: number) {
  const [year, month, day] = dayKey(now).split("-").map(Number);
  const index = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  return TOWER.modifiers[index % TOWER.modifiers.length];
}

export function towerFirstReward(floor: number): TowerReward {
  return {
    fish: TOWER.firstClearFish(floor),
    gems: floor % TOWER.milestoneEvery === 0 ? TOWER.milestoneGems : 0,
  };
}

export function towerDailyReward(state: GameState): TowerReward {
  return { fish: TOWER.dailyFish(state.tower.highestFloor), gems: TOWER.dailyGems };
}

export function towerDailyAvailable(state: GameState, now: number): boolean {
  return towerUnlocked(state) && state.tower.highestFloor > 0 && state.tower.dailyClaimDay !== dayKey(now);
}

function grant(state: GameState, reward: TowerReward) {
  state.kuro.fish += reward.fish;
  state.gems += reward.gems;
}

export function claimTowerDaily(state: GameState, now: number): TowerReward | null {
  if (!towerDailyAvailable(state, now)) return null;
  const reward = towerDailyReward(state);
  state.tower.dailyClaimDay = dayKey(now);
  grant(state, reward);
  return reward;
}

// Reuse the real combat sim on an isolated copy. Main-line rewards, quests,
// equipment, HP and RNG never leak between tower combat and the idle run.
export function createTowerRun(state: GameState, now: number): TowerRun | null {
  if (!towerUnlocked(state)) return null;
  const floor = state.tower.highestFloor + 1;
  const snapshot: GameState = JSON.parse(JSON.stringify(state));
  const rng = createRng((state.seed ^ Math.imul(floor, 2654435761)) >>> 0);
  snapshot.stage = TOWER.firstEnemyStage + (floor - 1) * TOWER.stagesPerFloor;
  snapshot.corruption = 0;
  snapshot.inBoss = true;
  snapshot.bossReady = false;
  snapshot.settings.autoBoss = false;
  snapshot.kuro.strikeCd = 0;
  const enemy = makeEnemy(snapshot.stage, floor % TOWER.milestoneEvery === 0 ? "chapterBoss" : "boss", 0, rng);
  const mod = towerModifier(now);
  enemy.hp = enemy.maxHp = Math.ceil(enemy.maxHp * mod.hp);
  enemy.atk *= mod.atk;
  enemy.aps *= mod.speed;
  snapshot.battle = {
    enemy, heroHp: computeStats(snapshot).maxHp, spawnTimer: 0,
    heroAtkTimer: 0.35, enemyAtkTimer: 0, skillTimer: 0, bossTimer: TOWER.timeLimit, combat: freshCombat(),
  };
  return { state: snapshot, rng, floor, day: dayKey(now), elapsed: 0, remainingHp: 1, result: null, settled: false, enemyMaxHp: enemy.maxHp, enemyLevel: enemy.level, hits: 0, finisher: null };
}

function recordHit(run: TowerRun, event: SimEvent) {
  if (event.t !== "heroHit" && event.t !== "skill" && event.t !== "kuroStrike" && event.t !== "proc") return;
  run.hits += event.t === "kuroStrike" ? event.hits : 1;
  if (run.state.battle.enemy && run.state.battle.enemy.hp <= 0) {
    run.finisher = { source: event.t === "heroHit" ? "normal" : event.t === "kuroStrike" ? "kuro" : event.t === "proc" ? event.kind : "skill",
      skillId: event.t === "skill" ? event.skillId : undefined, dmg: event.dmg };
  }
}

export function towerClaw(run: TowerRun, emit: Emit = noEmit): boolean {
  if (run.result || run.settled) return false;
  return kuroStrike(run.state, computeStats(run.state), run.rng, (e) => { recordHit(run, e); emit(e); }, false);
}

export function tickTower(run: TowerRun, dt: number, emit: Emit = noEmit): void {
  if (run.result || run.settled || !Number.isFinite(dt) || dt <= 0) return;
  // Subdivide large steps so callers cannot bypass the combat time limit.
  let remaining = Math.min(dt, TOWER.timeLimit + BALANCE.tickSeconds);
  while (remaining > 1e-8 && !run.result) {
    const step = Math.min(remaining, BALANCE.tickSeconds);
    const enemy = run.state.battle.enemy!;
    tick(run.state, step, run.rng, (event) => {
      recordHit(run, event);
      if (event.t === "bossWin") {
        run.result = "won";
        emit({ t: "bossWin", stage: run.floor });
      } else if (event.t === "bossFail") {
        run.result = event.reason;
        emit(event);
      } else if (["heroHit", "enemyHit", "skill", "skillCast", "ward", "proc", "kuroStrike"].includes(event.t)) {
        emit(event);
      }
    });
    run.remainingHp = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
    run.elapsed += step;
    remaining -= step;
  }
}

// Sequential floors and a consumed run prevent duplicate first-clear payouts.
export function settleTowerRun(state: GameState, run: TowerRun, now: number): TowerReward | null {
  if (run.settled || !run.result) return null;
  run.settled = true;
  if (run.result !== "won" || !towerUnlocked(state) || run.floor !== state.tower.highestFloor + 1) return null;
  const reward = towerFirstReward(run.floor);
  state.tower.highestFloor = run.floor;
  grant(state, reward);
  // A fight begun yesterday cannot consume today's challenge reward.
  const daily = run.day === dayKey(now) ? claimTowerDaily(state, now) : null;
  return { fish: reward.fish + (daily?.fish ?? 0), gems: reward.gems + (daily?.gems ?? 0) };
}
