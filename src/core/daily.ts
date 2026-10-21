import { DAILY_QUESTS, DailyQuestId } from "../config/balance";
import type { DailyState, GameState } from "./types";

// local calendar day. reset at player midnight.
export function dayKey(now: number): string {
  const d = new Date(now);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function freshDaily(now: number): DailyState {
  const progress = {} as Record<DailyQuestId, number>;
  const claimed = {} as Record<DailyQuestId, boolean>;
  for (const q of DAILY_QUESTS) {
    progress[q.id] = 0;
    claimed[q.id] = false;
  }
  return { dayKey: dayKey(now), progress, claimed, bonusClaimed: false };
}

export function ensureDaily(state: GameState, now: number): void {
  if (state.daily.dayKey !== dayKey(now)) state.daily = freshDaily(now);
}

export function bumpDaily(state: GameState, id: DailyQuestId, n = 1): void {
  const q = DAILY_QUESTS.find((x) => x.id === id)!;
  state.daily.progress[id] = Math.min(q.target, (state.daily.progress[id] ?? 0) + n);
}

export function dailyClaimable(state: GameState): number {
  let n = 0;
  for (const q of DAILY_QUESTS) {
    if (!state.daily.claimed[q.id] && state.daily.progress[q.id] >= q.target) n++;
  }
  const allDone = DAILY_QUESTS.every((q) => state.daily.claimed[q.id]);
  if (allDone && !state.daily.bonusClaimed) n++;
  return n;
}

export function loginClaimable(state: GameState, now: number): boolean {
  return state.login.lastClaimDayKey !== dayKey(now);
}
