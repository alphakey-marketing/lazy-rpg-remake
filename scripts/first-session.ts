// Reproducible first-session audit, not a prediction of human retention.
// npm run first-session -- [seed count]
import { buyTraining, chooseSpecialization, specializationReady, canChangeJob, changeJob, feedKuro, kuroTap, petKuro } from "../src/core/actions";
import { nextPlayerGoal } from "../src/core/goals";
import { newGame } from "../src/core/newGame";
import { runOffline } from "../src/core/offline";
import { createRng } from "../src/core/rng";
import { tick } from "../src/core/sim";
import { claimTowerDaily, createTowerRun, settleTowerRun, tickTower, towerClaw, towerUnlocked, type TowerRun } from "../src/core/tower";

const START = new Date(2026, 9, 21, 12).getTime();
type Profile = "idle" | "quick-upgrades" | "guided";
const count = Math.max(1, Math.min(100, Number(process.argv[2]) || 20));
const checkpoints = [60, 180, 300, 600, 900];

function simulate(profile: Profile, seed: number) {
  const s = newGame(START, seed);
  const rng = createRng(seed);
  const milestones: Record<string, number> = {};
  const samples: { minute: number; stage: number; level: number; kuro: number; floor: number }[] = [];
  let deaths = 0, fails = 0, lastBoss = 0, longestBossGap = 0;
  let run: TowerRun | null = null;
  let nextAction = 5, nextSample = 0;
  const mark = (name: string, t: number, ready: boolean) => { if (ready && milestones[name] === undefined) milestones[name] = Math.round(t); };
  const dt = 0.05;
  const steps = Math.round(900 / dt);
  for (let i = 1; i <= steps; i++) {
    const t = i * dt, now = START + Math.round(t * 1000);
    tick(s, dt, rng, (e) => {
      if (e.t === "heroDown") deaths++;
      if (e.t === "bossFail") fails++;
      if (e.t === "bossWin") {
        mark("firstBoss", t, true);
        longestBossGap = Math.max(longestBossGap, t - lastBoss);
        lastBoss = t;
      }
    });
    if (run) {
      tickTower(run, dt);
      if (run.result) { settleTowerRun(s, run, now); run = null; }
    }
    // The guided player takes one targeted UI action every 30s, not every frame.
    if (profile !== "idle" && t >= nextAction) {
      nextAction += 30;
      for (let n = 0; n < 100; n++) {
        const a = buyTraining(s, "atk", 1), h = buyTraining(s, "hp", 1);
        if (!a && !h) break;
      }
      if (profile === "guided") {
        const goal = nextPlayerGoal(s, now);
        if (goal.panel === "kuro") {
          petKuro(s, now);
          feedKuro(s);
        } else if (goal.panel === "hero" && canChangeJob(s, "arcanist")) {
          changeJob(s, "arcanist");
        } else if (goal.panel === "hero" && canChangeJob(s, "archmage")) {
          changeJob(s, "archmage");
        } else if (goal.panel === "hero" && specializationReady(s)) {
          chooseSpecialization(s, "cataclysm");
        } else if (goal.panel === "tower" && !run) {
          claimTowerDaily(s, now);
          run = createTowerRun(s, now);
        }
        kuroTap(s, rng);
        if (run) towerClaw(run);
      }
    }
    mark("firstTraining", t, s.training.atk > 0);
    mark("firstJob", t, s.job !== "novice");
    mark("firstFeed", t, s.kuro.level > 1);
    mark("towerUnlock", t, towerUnlocked(s));
    mark("firstTower", t, s.tower.highestFloor > 0);
    mark("autoClaw", t, s.kuro.level >= 5);
    if (nextSample < checkpoints.length && i >= checkpoints[nextSample] / dt) {
      samples.push({ minute: checkpoints[nextSample] / 60, stage: s.stage, level: s.level, kuro: s.kuro.level, floor: s.tower.highestFloor });
      nextSample++;
    }
  }
  longestBossGap = Math.max(longestBossGap, 900 - lastBoss);
  s.seed = rng.seed();
  const away = runOffline(s, 8 * 3600);
  return { profile, seed, milestones, samples, deaths, fails, longestBossGap: Math.round(longestBossGap), returnAfter8h: { gold: Math.round(away.gold), levels: away.levelsGained, stages: away.stagesGained, fish: away.fish } };
}

for (const profile of ["idle", "quick-upgrades", "guided"] as const) {
  const runs = Array.from({ length: count }, (_, i) => simulate(profile, i + 1));
  const range = (values: number[]) => values.length ? `${Math.min(...values)}–${Math.max(...values)}` : "not reached";
  console.log(`\n${profile}: ${count} seeds, 15min, actions every 30s; times in seconds`);
  for (const key of ["firstTraining", "firstBoss", "firstFeed", "firstJob", "towerUnlock", "firstTower", "autoClaw"]) {
    const times = runs.flatMap((r) => r.milestones[key] === undefined ? [] : [r.milestones[key]]);
    console.log(`  ${key}: ${times.length}/${count}, ${range(times)}`);
  }
  console.log(`  deaths ${range(runs.map((r) => r.deaths))}; boss failures ${range(runs.map((r) => r.fails))}; longest boss gap ${range(runs.map((r) => r.longestBossGap))}s`);
  for (let i = 0; i < checkpoints.length; i++) {
    console.log(`  ${checkpoints[i] / 60}min: stage ${range(runs.map((r) => r.samples[i].stage))}, hero Lv.${range(runs.map((r) => r.samples[i].level))}, Kuro Lv.${range(runs.map((r) => r.samples[i].kuro))}, tower ${range(runs.map((r) => r.samples[i].floor))}`);
  }
  console.log(`  8h return: gold ${range(runs.map((r) => r.returnAfter8h.gold))}, +levels ${range(runs.map((r) => r.returnAfter8h.levels))}, fish ${range(runs.map((r) => r.returnAfter8h.fish))}`);
}
