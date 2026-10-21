import { JOBS, jobRoute } from "../config/content";
import type { GameState } from "./types";

export function jobMechanics(s: GameState) {
  const spec = s.specialization;
  return {
    route: jobRoute(s.job),
    cooldown: JOBS[s.job].skill.cooldown * (spec === "flow" ? .7 : spec === "cataclysm" ? 1.15 : 1),
    skillScale: spec === "flow" ? .8 : spec === "cataclysm" ? 1.3 : 1,
    shieldFraction: spec === "guardian" ? .65 : spec === "judicator" ? .22 : .4,
    counterScale: spec === "judicator" ? 1.8 : .65,
    comboTarget: spec === "barrage" ? 3 : spec === "marksman" ? 5 : 4,
    pursuitScale: spec === "barrage" ? .75 : spec === "marksman" ? 2.4 : 1.1,
  };
}
