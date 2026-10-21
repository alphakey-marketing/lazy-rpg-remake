import { BALANCE, ITEM, KURO, Rarity } from "../config/balance";
import { JOBS } from "../config/content";
import { bumpDaily } from "./daily";
import { corruptionTier, expToNext, isChapterBossStage, killExp, killGold, makeEnemy } from "./formulas";
import { generateItem, rarityIndex, salvageValue } from "./items";
import type { Rng } from "./rng";
import { computeStats, HeroStats, isUpgrade } from "./stats";
import type { GameState, Item, SimEvent } from "./types";

export type Emit = (e: SimEvent) => void;
export const noEmit: Emit = () => {};

const H = BALANCE.hero;

// One sim step. Pure on state (mutate in place), all random from rng.
// Same fn for live play AND offline → offline reward always honest.
export function tick(state: GameState, dt: number, rng: Rng, emit: Emit = noEmit): void {
  const b = state.battle;
  const st = computeStats(state);
  state.life.playSeconds += dt;

  if (b.heroHp < 0) b.heroHp = st.maxHp;
  if (b.heroHp > st.maxHp) b.heroHp = st.maxHp;
  b.heroHp = Math.min(st.maxHp, b.heroHp + H.regenPerSec * st.maxHp * dt);

  const k = state.kuro;
  if (k.buffLeft > 0) k.buffLeft = Math.max(0, k.buffLeft - dt);
  if (k.strikeCd > 0) k.strikeCd = Math.max(0, k.strikeCd - dt);

  if (!b.enemy) {
    b.spawnTimer -= dt;
    if (b.spawnTimer <= 0) spawnNext(state, st, rng, emit);
    return;
  }

  const e = b.enemy;

  // hero normal attack
  b.heroAtkTimer += dt;
  const interval = 1 / st.aps;
  while (b.heroAtkTimer >= interval && e.hp > 0) {
    b.heroAtkTimer -= interval;
    const crit = rng.next() < st.crit;
    const dmg = st.atk * (0.92 + rng.next() * 0.16) * (crit ? st.critDmg : 1);
    e.hp -= dmg;
    emit({ t: "heroHit", dmg, crit });
  }

  // job skill, auto cast on cooldown
  b.skillTimer -= dt;
  if (b.skillTimer <= 0 && e.hp > 0) {
    const sk = JOBS[state.job].skill;
    let total = 0;
    let anyCrit = false;
    for (let i = 0; i < sk.hits; i++) {
      const crit = rng.next() < st.crit;
      anyCrit ||= crit;
      total += st.atk * sk.mult * (crit ? st.critDmg : 1);
    }
    e.hp -= total;
    b.skillTimer = sk.cooldown;
    emit({ t: "skill", skillId: sk.id, fx: sk.fx, hits: sk.hits, dmg: total, crit: anyCrit });
  }

  // Kuro claw: auto when unlocked & switch on
  if (k.auto && k.level >= KURO.autoCastLevel && k.strikeCd <= 0 && e.hp > 0) kuroStrike(state, st, rng, emit, true);

  if (e.hp <= 0) {
    onKill(state, st, rng, emit);
    return;
  }

  // enemy attack
  b.enemyAtkTimer += dt;
  const eInt = 1 / e.aps;
  while (b.enemyAtkTimer >= eInt) {
    b.enemyAtkTimer -= eInt;
    const dmg = e.atk * (1 - st.def) * (0.9 + rng.next() * 0.2);
    b.heroHp -= dmg;
    emit({ t: "enemyHit", dmg });
  }

  if (b.heroHp <= 0) {
    if (state.inBoss) bossFail(state, st, "dead", emit);
    else retreat(state, st, emit);
    return;
  }

  if (state.inBoss) {
    b.bossTimer -= dt;
    if (b.bossTimer <= 0) bossFail(state, st, "timeout", emit);
  }
}

// Kuro jump in, claw N time. Return false if not ready / no target.
export function kuroStrike(state: GameState, st: HeroStats, rng: Rng, emit: Emit, auto: boolean): boolean {
  const k = state.kuro;
  const e = state.battle.enemy;
  if (!e || e.hp <= 0 || k.strikeCd > 0) return false;
  const per = (st.atk * KURO.strikeMult(k.level)) / KURO.strikeHits;
  let total = 0;
  let anyCrit = false;
  for (let i = 0; i < KURO.strikeHits; i++) {
    const crit = rng.next() < st.crit;
    anyCrit ||= crit;
    total += per * (crit ? st.critDmg : 1);
  }
  e.hp -= total;
  k.strikeCd = KURO.cooldown(k.level);
  emit({ t: "kuroStrike", dmg: total, crit: anyCrit, hits: KURO.strikeHits, auto });
  return true;
}

function spawnNext(state: GameState, st: HeroStats, rng: Rng, emit: Emit) {
  if (state.bossReady && state.settings.autoBoss) {
    startBoss(state, st, rng, emit);
    return;
  }
  const enemy = makeEnemy(state.stage, "normal", state.corruption, rng);
  setEnemy(state, enemy);
  emit({ t: "spawn", enemy });
}

function setEnemy(state: GameState, enemy: GameState["battle"]["enemy"]) {
  const b = state.battle;
  b.enemy = enemy;
  b.heroAtkTimer = 0.35; // first swing come quick
  b.enemyAtkTimer = 0;
}

export function startBoss(state: GameState, st: HeroStats, rng: Rng, emit: Emit) {
  const kind = isChapterBossStage(state.stage) ? "chapterBoss" : "boss";
  const enemy = makeEnemy(state.stage, kind, state.corruption, rng);
  state.inBoss = true;
  state.battle.bossTimer = BALANCE.bossTimeLimit;
  state.battle.heroHp = st.maxHp; // fair start
  setEnemy(state, enemy);
  emit({ t: "bossStart", kind });
  emit({ t: "spawn", enemy });
}

function onKill(state: GameState, st: HeroStats, rng: Rng, emit: Emit) {
  const b = state.battle;
  const e = b.enemy!;
  b.enemy = null;
  b.spawnTimer = BALANCE.spawnDelay;

  const gold = killGold(e.level, e.kind) * st.goldMult;
  const exp = killExp(e.level, e.kind) * st.expMult;
  state.gold += gold;
  state.life.goldEarned += gold;
  state.life.kills++;
  state.bestiary[e.family] = (state.bestiary[e.family] ?? 0) + 1;
  bumpDaily(state, "kill");
  emit({ t: "kill", enemy: e, gold, exp });
  addExp(state, exp, emit);

  const boost = corruptionTier(state.corruption).rarityBoost;
  if (e.kind === "normal") {
    b.heroHp = Math.min(st.maxHp, b.heroHp + st.maxHp * H.healOnKill);
    state.kills++;
    if (state.kills >= BALANCE.killsPerStage) state.bossReady = true;
    if (rng.next() < BALANCE.reward.dropChance) dropLoot(state, rng, false, boost, emit);
  } else {
    state.inBoss = false;
    state.life.bossKills++;
    bumpDaily(state, "boss");
    const drops = e.kind === "chapterBoss" ? 2 : 1;
    for (let i = 0; i < drops; i++) dropLoot(state, rng, true, boost, emit);
    const cleared = state.stage;
    state.stage++;
    state.maxStage = Math.max(state.maxStage, state.stage);
    state.life.bestStage = Math.max(state.life.bestStage, state.stage);
    state.kills = 0;
    state.bossReady = false;
    b.heroHp = computeStats(state).maxHp;
    const fish = KURO.fishPerBoss(cleared) * (e.kind === "chapterBoss" ? KURO.chapterBossFishMult : 1);
    state.kuro.fish += fish;
    emit({ t: "bossWin", stage: cleared });
    emit({ t: "fish", n: fish });
  }
}

export function addExp(state: GameState, exp: number, emit: Emit = noEmit) {
  state.exp += exp;
  let need = expToNext(state.level);
  while (state.exp >= need) {
    state.exp -= need;
    state.level++;
    emit({ t: "levelUp", level: state.level });
    need = expToNext(state.level);
  }
}

function bossFail(state: GameState, st: HeroStats, reason: "dead" | "timeout", emit: Emit) {
  const b = state.battle;
  state.inBoss = false;
  state.bossReady = false;
  state.kills = 0;
  b.enemy = null;
  b.spawnTimer = 1.2;
  b.heroHp = st.maxHp;
  emit({ t: "bossFail", reason });
}

// die vs normal mob → step back one stage, keep farming. No life lost, no punish.
function retreat(state: GameState, st: HeroStats, emit: Emit) {
  const b = state.battle;
  state.stage = Math.max(1, state.stage - 1);
  state.kills = 0;
  state.bossReady = false;
  b.enemy = null;
  b.spawnTimer = 1.5;
  b.heroHp = st.maxHp;
  emit({ t: "heroDown", retreatTo: state.stage });
}

function dropLoot(state: GameState, rng: Rng, boss: boolean, boost: number, emit: Emit) {
  const item = generateItem(state.nextItemId++, rng, state.stage, boost, boss);
  if (state.settings.autoEquip && isUpgrade(state, item)) {
    const old = state.gear[item.slot];
    state.gear[item.slot] = item;
    emit({ t: "loot", item, salvaged: false, equipped: true });
    if (old) stash(state, old, emit, true);
    return;
  }
  const salvaged = stash(state, item, emit, false);
  emit({ t: "loot", item, salvaged, equipped: false });
}

// put item in bag or salvage. return true if salvaged.
function stash(state: GameState, item: Item, emit: Emit, quiet: boolean): boolean {
  const th = state.settings.autoSalvageBelow;
  const lowRarity = th !== null && rarityIndex(item.rarity) < rarityIndex(th as Rarity);
  if (!item.locked && item.refine === 0 && lowRarity) {
    state.stones += salvageValue(item);
    return true;
  }
  if (state.bag.length >= ITEM.bagSize) {
    state.stones += salvageValue(item);
    if (!quiet) emit({ t: "bagFull" });
    return true;
  }
  state.bag.push(item);
  return false;
}

// rough gold/sec at current stage (for time-warp & login gold reward)
export function estimateGoldPerSec(state: GameState): number {
  const st = computeStats(state);
  const sample = makeEnemyAvg(state);
  const ttk = sample.hp / Math.max(1, st.dps);
  const killsPerSec = 1 / (ttk + BALANCE.spawnDelay);
  return killsPerSec * killGold(state.stage, "normal") * st.goldMult;
}

function makeEnemyAvg(state: GameState) {
  const c = corruptionTier(state.corruption);
  return { hp: BALANCE.enemy.baseHp * Math.pow(BALANCE.enemy.hpGrowth, state.stage - 1) * c.enemyHp };
}
