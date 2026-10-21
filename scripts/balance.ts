// Bot play fresh game, print pace. Usage: npm run balance [-- jobPath hours]
import { newGame } from "../src/core/newGame";
import { createRng } from "../src/core/rng";
import { tick } from "../src/core/sim";
import { buyTraining, canChangeJob, changeJob, canRebirth, rebirth, buyPerk, refine, refineCost, salvageWeaker, setCorruption, corruptionUnlocked } from "../src/core/actions";
import { computeStats } from "../src/core/stats";
import { fmt } from "../src/core/format";
import type { JobId } from "../src/config/content";
import type { PerkId } from "../src/config/balance";

const path = (process.argv[2] ?? "arcanist") as "blade" | "arcanist" | "ranger";
const hours = Number(process.argv[3] ?? 10);
const second: Record<string, JobId> = { blade: "paladin", arcanist: "archmage", ranger: "sniper" };

const s = newGame(0, 42);
const rng = createRng(7);
const dt = 0.25;
const checkpoints = [1, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720, 900, 1200].map((m) => m * 60);
let ci = 0;
let deaths = 0, bossFails = 0, rebirths = 0;
let rebirthAt: number[] = [];
let rebirthTarget = 0;

const total = hours * 3600;
for (let t = 0; t < total; t += dt) {
  tick(s, dt, rng, (e) => {
    if (e.t === "heroDown") deaths++;
    if (e.t === "bossFail") bossFails++;
  });

  // bot think every 10 sec (lazy player check phone sometimes)
  if (Math.floor(t / 10) !== Math.floor((t - dt) / 10)) {
    for (let k = 0; k < 50; k++) {
      const a = buyTraining(s, "atk", 1);
      const h = buyTraining(s, "hp", 1);
      if (!a && !h) break;
    }
    buyTraining(s, "crit", 1);
    buyTraining(s, "speed", 1);
    if (canChangeJob(s, path)) changeJob(s, path);
    if (canChangeJob(s, second[path])) changeJob(s, second[path]);
    salvageWeaker(s);
    const w = s.gear.weapon;
    if (w && w.refine < 10) {
      const c = refineCost(w);
      if (s.stones >= c.stones && s.gold >= c.gold * 3) refine(s, w.id, false, rng);
    }
    if (corruptionUnlocked(s) && s.corruption === 0 && s.maxStage > 25) setCorruption(s, 1);
    // rebirth when progress slow: stage >= 55
    if (process.env.REBIRTH && canRebirth(s) && s.maxStage >= Math.max(48, rebirthTarget) && s.stage >= s.maxStage - 1) {
      rebirthTarget = s.maxStage + 10;
      const got = rebirth(s, t * 1000);
      rebirths++;
      rebirthAt.push(Math.round(t / 60));
      console.log(`  ↻ rebirth @${Math.round(t / 60)}m +${got} shards`);
      const order: PerkId[] = ["soulAtk", "soulHp", "headStart", "soulGold", "soulAtk", "soulExp"];
      let spent = true;
      while (spent) {
        spent = false;
        for (const p of order) if (buyPerk(s, p)) spent = true;
      }
    }
  }

  if (ci < checkpoints.length && t >= checkpoints[ci]) {
    const st = computeStats(s);
    console.log(
      `${String(checkpoints[ci] / 60).padStart(5)}m  stage ${String(s.stage).padStart(3)} (max ${s.maxStage})  lv ${String(s.level).padStart(3)}  ${s.job.padEnd(8)}  ` +
        `pow ${fmt(st.power).padStart(7)}  gold ${fmt(s.gold).padStart(7)}  train a${s.training.atk}/h${s.training.hp}  ` +
        `wpn ${s.gear.weapon ? s.gear.weapon.rarity + "+" + s.gear.weapon.refine : "-"}  bag ${s.bag.length}  deaths ${deaths} bossFail ${bossFails}`,
    );
    ci++;
  }
}
console.log(`rebirths ${rebirths} at ${rebirthAt.join(",")} min`);
