import { ACHIEVEMENTS, type AchievementId } from "../config/achievements";
import type { GameState } from "./types";

// Latch completion before a run resets, even if its reward has not been claimed.
export function syncAchievements(state: GameState): void {
  for (const a of ACHIEVEMENTS) {
    if (!state.achievements.unlocked.includes(a.id) && a.progress(state) >= a.target) {
      state.achievements.unlocked.push(a.id);
    }
  }
}

export function achievementProgress(state: GameState, id: AchievementId): number {
  const a = ACHIEVEMENTS.find((a) => a.id === id)!;
  return state.achievements.unlocked.includes(id) || state.achievements.claimed.includes(id)
    ? a.target : Math.min(a.target, Math.max(0, a.progress(state)));
}

export function canClaimAchievement(state: GameState, id: AchievementId): boolean {
  const a = ACHIEVEMENTS.find((a) => a.id === id);
  return !!a && !state.achievements.claimed.includes(id)
    && (state.achievements.unlocked.includes(id) || a.progress(state) >= a.target);
}

export function achievementClaimable(state: GameState): number {
  return ACHIEVEMENTS.filter((a) => canClaimAchievement(state, a.id)).length;
}

export function claimAchievement(state: GameState, id: AchievementId): boolean {
  if (!canClaimAchievement(state, id)) return false;
  const a = ACHIEVEMENTS.find((a) => a.id === id)!;
  syncAchievements(state);
  state.achievements.claimed.push(id);
  state.kuro.fish += a.reward.fish;
  state.gems += a.reward.gems;
  state.stones += a.reward.stones;
  return true;
}

export function claimAllAchievements(state: GameState): number {
  let claimed = 0;
  for (const a of ACHIEVEMENTS) if (claimAchievement(state, a.id)) claimed++;
  return claimed;
}
