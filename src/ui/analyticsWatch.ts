// Watch store, diff key numbers, send funnel event. Game code stay clean.
import { initAnalytics, setPlayerProps, track } from "../services/analytics";
import { bestiaryTotalTiers } from "../core/bestiary";
import type { GameState } from "../core/types";
import { store } from "./store";

interface Snap {
  bestStage: number;
  level: number;
  job: string;
  kuro: number;
  tower: number;
  rebirths: number;
  tut: number;
  claimed: number;
  dex: number;
}

function snap(s: GameState): Snap {
  return {
    bestStage: s.life.bestStage,
    level: s.level,
    job: s.job,
    kuro: s.kuro.level,
    tower: s.tower.highestFloor,
    rebirths: s.life.rebirths,
    tut: s.tutorialStep,
    claimed: s.achievements.claimed.length,
    dex: bestiaryTotalTiers(s),
  };
}

const daysSince = (t: number) => Math.floor((Date.now() - t) / 86400000);

export function startAnalytics(): void {
  void initAnalytics();
  const s0 = store.state;
  track("game_open", {
    stage: s0.life.bestStage,
    level: s0.level,
    rebirths: s0.life.rebirths,
    day: daysSince(s0.createdAt),
    play_min: Math.floor(s0.life.playSeconds / 60),
  });
  if (store.offline) track("offline_return", { minutes: Math.round(store.offline.seconds / 60), kills: store.offline.kills });

  let last = snap(s0);
  const props = () => {
    const s = store.state;
    setPlayerProps({ best_stage: s.life.bestStage, job: s.job, rebirths: s.life.rebirths, kuro_level: s.kuro.level });
  };
  props();

  store.subscribe(() => {
    const s = store.state;
    const n = snap(s);
    if (n.bestStage > last.bestStage) {
      // every 5 stage enough → funnel not spam
      for (let st = last.bestStage + 1; st <= n.bestStage; st++) if (st % 5 === 0) track("stage_reached", { stage: st, level: s.level, play_min: Math.floor(s.life.playSeconds / 60) });
      props();
    }
    if (n.tut !== last.tut) {
      if (n.tut === -1) track("tutorial_complete", { from_step: last.tut });
      else track("tutorial_step", { step: n.tut });
    }
    if (n.job !== last.job && n.job !== "novice") { track("job_change", { job: n.job, level: s.level }); props(); }
    if (n.kuro > last.kuro) { track("kuro_level", { level: n.kuro }); if (n.kuro % 5 === 0) props(); }
    if (n.tower > last.tower) track("tower_floor", { floor: n.tower });
    if (n.rebirths > last.rebirths) { track("rebirth", { count: n.rebirths, stage: last.bestStage }); props(); }
    if (n.claimed > last.claimed) {
      const ids = s.achievements.claimed.slice(last.claimed);
      for (const id of ids) track("achievement_claim", { id });
    }
    if (n.dex > last.dex) track("bestiary_star", { total: n.dex });
    last = n;
  });

  store.onEvent((e) => {
    if (e.t === "bossFail") track("boss_fail", { stage: store.state.stage, reason: e.reason });
  });

  // Session length: send when hide. Cheap retention signal.
  const t0 = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) track("session_pause", { sec: Math.round((Date.now() - t0) / 1000), stage: store.state.stage });
  });
}

export function trackPanel(panel: string): void {
  track("panel_open", { panel });
}
