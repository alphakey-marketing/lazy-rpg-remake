// Presentation time is independent of the real fight timer and reward settlement.
export type TowerPhase = "intro" | "combat" | "impact" | "result";
export function createTowerPresentation() {
  return { phase: "intro" as TowerPhase, elapsed: 0 };
}
export function advanceTowerPresentation(p: ReturnType<typeof createTowerPresentation>, dt: number, finished: boolean) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  if (p.phase === "intro" || p.phase === "impact") {
    p.elapsed += dt;
    if (p.elapsed + 1e-8 >= (p.phase === "intro" ? .8 : .9)) {
      p.phase = p.phase === "intro" ? "combat" : "result";
      p.elapsed = 0;
    }
  } else if (p.phase === "combat" && finished) {
    p.phase = "impact"; p.elapsed = 0;
  }
}
