import { useEffect, useRef } from "react";
import { JOBS, type JobId, type SpecializationId } from "../../config/content";
import { freshCombat } from "../../core/newGame";
import { createRng } from "../../core/rng";
import { tick } from "../../core/sim";
import { computeStats } from "../../core/stats";
import { jobMechanics } from "../../core/jobs";
import type { GameState } from "../../core/types";
import { BattleRenderer } from "../render/BattleRenderer";
import { JOB_NAME } from "../names";

// A real simulation on a disposable snapshot; never pays or touches the player's save.
export function JobPreview({ state, job, specialization = null }: { state: GameState; job: JobId; specialization?: SpecializationId | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const initial = useRef(state);
  useEffect(() => {
    const s: GameState = JSON.parse(JSON.stringify(initial.current));
    s.job = job; s.specialization = specialization; s.settings.autoBoss = false; s.kuro.auto = false;
    s.inBoss = false;
    const st = computeStats(s);
    const reset = () => {
      s.battle = { enemy: { family: "pebble", variant: 0, level: s.level, hp: st.atk * 100, maxHp: st.atk * 100, atk: st.atk * .5, aps: 1, kind: "normal" },
        heroHp: st.maxHp, spawnTimer: 0, heroAtkTimer: 0, enemyAtkTimer: 0, skillTimer: .5, bossTimer: 0, combat: freshCombat() };
      s.battle.combat.mana = 3;
      s.battle.combat.combo = jobMechanics(s).comboTarget - 1;
    };
    reset();
    const r = new BattleRenderer(canvas.current!, () => s);
    const resize = new ResizeObserver(() => { const b = canvas.current!.parentElement!.getBoundingClientRect(); r.resize(b.width, b.height); });
    resize.observe(canvas.current!.parentElement!);
    const rng = createRng(42);
    let last = performance.now(), acc = 0, elapsed = 0, raf = 0;
    const loop = (t: number) => {
      const dt = Math.min(.1, (t - last) / 1000); last = t;
      if (!document.hidden) {
        acc += dt; elapsed += dt;
        if (elapsed > 5.5) { reset(); elapsed = 0; }
        while (acc >= .05) { tick(s, .05, rng, (e) => r.onEvent(e)); acc -= .05; }
        r.update(dt); r.draw();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); resize.disconnect(); };
  }, [job, specialization]);
  return <div className="job-preview"><b style={{ color: JOBS[job].color }}>{JOB_NAME[job]} · 技能試睇</b><div><canvas ref={canvas} /></div><small>示範戰鬥 · 唔會影響進度或消耗資源</small></div>;
}
