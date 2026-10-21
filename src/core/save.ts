import { newGame, SAVE_VERSION } from "./newGame";
import type { GameState } from "./types";

// Fill missing field from fresh default (deep for plain object). Old save never break.
function fill<T>(def: T, got: any): T {
  if (got === undefined || got === null) return def;
  if (typeof def !== "object" || def === null || Array.isArray(def)) return got;
  const out: any = { ...def };
  for (const k of Object.keys(got)) {
    const dv = (def as any)[k];
    out[k] = dv !== undefined && dv !== null && typeof dv === "object" && !Array.isArray(dv) ? fill(dv, got[k]) : got[k];
  }
  return out;
}

const MIGRATIONS: Record<number, (s: any) => any> = {
  // 1 → 2: add here when save shape change
};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string, now: number): GameState {
  let raw = JSON.parse(json);
  let v = raw.version ?? 1;
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (m) raw = m(raw);
    v++;
  }
  raw.version = SAVE_VERSION;
  const s = fill(newGame(now, raw.seed ?? 1), raw);
  // gear slot may be null — fill keep null ok
  return s;
}
