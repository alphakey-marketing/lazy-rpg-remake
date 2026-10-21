import { BALANCE, CORRUPTION, TRAINING, TrainingId } from "../config/balance";
import { BIOMES, FAMILIES } from "../config/content";
import type { Enemy } from "./types";
import type { Rng } from "./rng";

const E = BALANCE.enemy;
const R = BALANCE.reward;

export function expToNext(level: number): number {
  const c = BALANCE.expCurve;
  return Math.floor(c.base * Math.pow(c.growth, level - 1) + c.linear * level);
}

export function chapterOf(stage: number): number {
  return Math.floor((stage - 1) / BALANCE.stagesPerChapter) + 1;
}

export function stageInChapter(stage: number): number {
  return ((stage - 1) % BALANCE.stagesPerChapter) + 1;
}

export function isChapterBossStage(stage: number): boolean {
  return stage % BALANCE.stagesPerChapter === 0;
}

export function biomeIndex(stage: number): number {
  return (chapterOf(stage) - 1) % BIOMES.length;
}

export function biomeLoop(stage: number): number {
  return Math.floor((chapterOf(stage) - 1) / BIOMES.length);
}

export function corruptionTier(tier: number) {
  return CORRUPTION.tiers[Math.max(0, Math.min(CORRUPTION.tiers.length - 1, tier))];
}

export function makeEnemy(stage: number, kind: Enemy["kind"], corruption: number, rng: Rng): Enemy {
  const biome = BIOMES[biomeIndex(stage)];
  const family = kind === "normal" ? rng.pick(biome.families) : biome.families[(stage + 1) % biome.families.length];
  const fam = FAMILIES[family];
  const variant = rng.int(0, fam.colors.length - 1);
  const c = corruptionTier(corruption);
  let hp = E.baseHp * Math.pow(E.hpGrowth, stage - 1) * c.enemyHp;
  let atk = E.baseAtk * Math.pow(E.atkGrowth, stage - 1) * c.enemyAtk;
  if (kind === "boss") {
    hp *= E.bossHpMult;
    atk *= E.bossAtkMult;
  } else if (kind === "chapterBoss") {
    hp *= E.chapterBossHpMult;
    atk *= E.chapterBossAtkMult;
  } else {
    // little variance → not every mob same
    const v = 0.9 + rng.next() * 0.2;
    hp *= v;
  }
  hp = Math.ceil(hp);
  return { family, variant, level: stage, hp, maxHp: hp, atk, aps: E.aps * (kind === "normal" ? 1 : 0.85), kind };
}

export function killGold(stage: number, kind: Enemy["kind"]): number {
  const base = R.baseGold * Math.pow(R.goldGrowth, stage - 1);
  return kind === "normal" ? base : base * R.bossGoldMult * (kind === "chapterBoss" ? 2 : 1);
}

export function killExp(stage: number, kind: Enemy["kind"]): number {
  const base = R.baseExp * Math.pow(R.expGrowth, stage - 1);
  return kind === "normal" ? base : base * R.bossExpMult * (kind === "chapterBoss" ? 2 : 1);
}

export function trainingCost(id: TrainingId, level: number): number {
  const t = TRAINING[id];
  return Math.ceil(t.baseCost * Math.pow(t.costGrowth, level));
}

export function trainingMaxed(id: TrainingId, level: number): boolean {
  return level >= TRAINING[id].max;
}
