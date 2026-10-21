// Canvas2D battle view. Read state every frame, react to sim event for juice.
// Interface small → later swap to PixiJS / Spine without touch game logic.
import { BIOMES, FAMILIES, JOBS, jobRoute, SPECIALIZATIONS } from "../../config/content";
import { artImg, preloadArt } from "../art";
import { BARKS, CHAPTERS } from "../../config/story";
import { biomeIndex, biomeLoop } from "../../core/formulas";
import { SKILL_NAME } from "../names";
import { jobMechanics } from "../../core/jobs";
import { fmt } from "../../core/format";
import { rarityIndex } from "../../core/items";
import { computeStats } from "../../core/stats";
import type { Enemy, GameState, SimEvent } from "../../core/types";
import { RARITY_COLOR } from "../theme";
import { drawHero, drawKuro, drawMonster, OUTLINE, shade } from "./shapes";

interface FloatText { x: number; y: number; vy: number; text: string; color: string; size: number; life: number; max: number; }
interface Particle { x: number; y: number; vx: number; vy: number; r: number; color: string; life: number; max: number; g: number; }
interface Beam { x: number; color: string; tier: number; life: number; max: number; }
interface Fx { kind: string; life: number; max: number; hits: number; spec: string | null; fired: string[]; }
interface Banner { text: string; sub: string; color: string; life: number; max: number; }

export class BattleRenderer {
  private c: CanvasRenderingContext2D;
  private W = 360;
  private H = 300;
  private dpr = 1;
  private t = 0;
  private scroll = 0;
  private texts: FloatText[] = [];
  private parts: Particle[] = [];
  private beams: Beam[] = [];
  private fx: Fx[] = [];
  private banner: Banner | null = null;
  private shake = 0;
  private lunge = 0;
  private hurt = 0;
  private enemyFlash = 0;
  private enemyEnter = 1; // 0..1 slide in
  private dying: { enemy: Enemy; life: number } | null = null;
  private levelGlow = 0;
  private kuroDash = 0; // 1 → 0, Kuro fly to enemy & back
  private say: { text: string; life: number } | null = null;
  private idleSay = 12; // sec to next random chatter

  // bg: art name for fixed backdrop (tower). null → biome parallax
  constructor(private canvas: HTMLCanvasElement, private getState: () => GameState, private bg: string | null = null) {
    if (bg) artImg(bg);
    this.c = canvas.getContext("2d")!;
    preloadArt("fx-");
  }

  // spec only if belong current job (old save safety)
  private spec(): string | null {
    const s = this.getState();
    const sp = s.specialization;
    return sp && SPECIALIZATIONS[sp]?.job === s.job ? sp : null;
  }

  private pushFx(kind: string, life: number, hits: number) {
    if (this.fx.length > 24) this.fx.shift();
    this.fx.push({ kind, life, max: life, hits, spec: this.spec(), fired: [] });
  }

  resize(w: number, h: number) {
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.W = w;
    this.H = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
  }

  private get groundY() { return this.H * 0.8; }
  private get heroX() { return this.W * 0.27; }
  private get enemyX() { return this.W * 0.72; }
  private get unit() { return Math.min(this.W / 9, this.H / 7); }

  onEvent(e: SimEvent) {
    const u = this.unit;
    const ex = this.enemyX, gy = this.groundY;
    switch (e.t) {
      case "heroHit":
        this.lunge = 1;
        this.enemyFlash = 1;
        this.addText(ex + (Math.random() - 0.5) * u, gy - u * 2.3, fmt(Math.max(1, Math.round(e.dmg))), e.crit ? "#ffd23f" : "#ffffff", e.crit ? 30 : 20);
        if (e.crit) {
          this.shake = Math.max(this.shake, 4);
          this.burst(ex, gy - u, 8, "#ffd23f", 4);
        } else this.burst(ex, gy - u, 3, "#ffffff", 2.5);
        break;
      case "skillCast": {
        const sp = this.spec();
        const life = e.fx === "meteor" ? 1 : e.fx === "nova" ? (sp === "flow" ? 0.75 : sp === "cataclysm" ? 0.9 : 0.95) : e.fx === "volley" || e.fx === "pierce" ? 0.9 : 0.75;
        this.pushFx(e.fx, life, e.hits);
        const name = `${SKILL_NAME[e.skillId] ?? "技能"}${sp ? " · " + SPECIALIZATIONS[sp as keyof typeof SPECIALIZATIONS].name : ""}`;
        this.addText(this.heroX, gy - u * 3, `${e.empowered ? "法力爆發 · " : ""}${name}`, e.empowered ? "#ffd23f" : "#ffffff", 17, .9);
        break;
      }
      case "ward":
        if (!this.fx.some((f) => f.kind === "ward")) this.pushFx("ward", 0.9, 1);
        this.addText(this.heroX, gy - u * 2.4, `${e.blocked ? "格擋" : "護盾"} ${fmt(Math.round(e.amount))}`, "#7fe3ff", 17, .8);
        break;
      case "proc":
        this.enemyFlash = 1;
        this.shake = Math.max(this.shake, 3);
        this.pushFx(e.kind, this.spec() === "marksman" ? 0.7 : 0.45, 1);
        this.addText(ex, gy - u * 2.5, `${e.kind === "counter" ? "反擊" : "追擊"} ${fmt(Math.round(e.dmg))}`, e.kind === "counter" ? "#ffd166" : "#2ee6a8", 22, .85);
        break;
      case "skill":
        this.shake = Math.max(this.shake, e.empowered ? 9 : e.hits > 1 ? 3 : 7);
        this.enemyFlash = 1;
        this.addText(ex, gy - u * 3, `${e.hits > 1 && e.hitIndex !== undefined ? `${e.hitIndex + 1}連 · ` : ""}${fmt(Math.max(1, Math.round(e.dmg)))}`, e.empowered ? "#ffd23f" : e.crit ? "#ff9cf5" : "#c9a7ff", e.hits > 1 ? 25 : e.crit ? 38 : 32, .85);
        break;
      case "kuroStrike":
        this.kuroDash = 1;
        this.pushFx("claw", 0.55, e.hits);
        this.shake = Math.max(this.shake, e.auto ? 6 : 9);
        this.enemyFlash = 1;
        this.addText(ex, gy - u * 3.6, fmt(Math.max(1, Math.round(e.dmg))), e.crit ? "#ff7ad9" : "#d59bff", e.crit ? 40 : 34, 1.3, "🐾 ");
        this.burst(ex, gy - u, 14, "#c77dff", 5);
        if (!e.auto || Math.random() < 0.25) this.kuroSay(pick(BARKS.strike), 1.2);
        break;
      case "fish":
        this.addText(this.heroX - u * 1.25, gy - u * 3.4, "+" + e.n, "#7fe3ff", 20, 1.4, "🐟 ");
        break;
      case "enemyHit":
        this.hurt = 1;
        this.addText(this.heroX + u * 0.2, gy - u * 2.2, "-" + fmt(Math.max(1, Math.round(e.dmg))), "#ff5a5a", 17);
        break;
      case "spawn":
        this.enemyEnter = 0;
        break;
      case "kill": {
        this.dying = { enemy: e.enemy, life: 0.35 };
        const col = FAMILIES[e.enemy.family].colors[e.enemy.variant] ?? "#fff";
        this.burst(ex, gy - u, e.enemy.kind === "normal" ? 16 : 40, col, 6);
        this.addText(ex, gy - u * 1.4, "+" + fmt(e.gold), "#ffd23f", 18, 1.1, "🪙 ");
        for (let i = 0; i < 6; i++) this.coin(ex, gy - u);
        break;
      }
      case "loot": {
        const tier = rarityIndex(e.item.rarity);
        if (tier >= 2) this.beams.push({ x: ex + (Math.random() - 0.5) * u, color: RARITY_COLOR[e.item.rarity], tier, life: 1.6, max: 1.6 });
        if (tier >= 4) this.kuroSay(pick(BARKS.bigLoot));
        break;
      }
      case "levelUp":
        this.levelGlow = 1.2;
        this.burst(this.heroX, gy - u, 24, "#ffe066", 5);
        this.addText(this.heroX, gy - u * 3.4, "LEVEL UP!", "#ffe066", 26, 1.6);
        if (Math.random() < 0.3) this.kuroSay(pick(BARKS.levelUp));
        break;
      case "bossStart":
        this.banner = { text: e.kind === "chapterBoss" ? "章節魔王" : "BOSS 戰", sub: "30 秒內擊倒！", color: "#ff4d6d", life: 1.8, max: 1.8 };
        if (e.kind === "chapterBoss") {
          const ch = CHAPTERS[biomeIndex(this.getState().stage)];
          this.kuroSay(ch.boss, 3.2);
        }
        this.shake = 10;
        break;
      case "bossWin":
        this.banner = { text: "勝利！", sub: `第 ${e.stage} 關突破`, color: "#ffd23f", life: 1.8, max: 1.8 };
        this.burst(this.W / 2, this.H * 0.4, 60, "#ffd23f", 8);
        if (Math.random() < 0.4) this.kuroSay(pick(BARKS.bossWin));
        break;
      case "bossFail":
        this.banner = { text: e.reason === "timeout" ? "時間到…" : "被打敗…", sub: "再練下先", color: "#9aa4c0", life: 1.6, max: 1.6 };
        break;
      case "heroDown":
        this.banner = { text: "撤退", sub: `返回第 ${e.retreatTo} 關`, color: "#9aa4c0", life: 1.6, max: 1.6 };
        this.kuroSay(pick(BARKS.heroDown));
        break;
    }
  }

  kuroSay(text: string, life = 2.2) {
    this.say = { text, life };
    this.idleSay = 18 + Math.random() * 20;
  }

  private addText(x: number, y: number, text: string, color: string, size: number, life = 0.9, prefix = "") {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x, y, vy: -60, text: prefix + text, color, size, life, max: life });
  }

  private burst(x: number, y: number, n: number, color: string, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.4 + Math.random()) * speed * 40;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, r: 2 + Math.random() * 3.5, color, life: 0.6 + Math.random() * 0.4, max: 1, g: 300 });
    }
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
  }

  private coin(x: number, y: number) {
    this.parts.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: -180 - Math.random() * 120, r: 4.5, color: "coin", life: 0.9, max: 0.9, g: 600 });
  }

  update(dt: number) {
    this.t += dt;
    const s = this.getState();
    const walking = !s.battle.enemy;
    this.scroll += dt * (walking ? 140 : 8);
    this.lunge = Math.max(0, this.lunge - dt * 7);
    this.hurt = Math.max(0, this.hurt - dt * 5);
    this.enemyFlash = Math.max(0, this.enemyFlash - dt * 9);
    this.enemyEnter = Math.min(1, this.enemyEnter + dt * 4);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.levelGlow = Math.max(0, this.levelGlow - dt);
    this.kuroDash = Math.max(0, this.kuroDash - dt * 2.2);
    if (this.say) {
      this.say.life -= dt;
      if (this.say.life <= 0) this.say = null;
    }
    this.idleSay -= dt;
    if (this.idleSay <= 0) this.kuroSay(pick(BARKS.idle));
    if (this.dying) {
      this.dying.life -= dt;
      if (this.dying.life <= 0) this.dying = null;
    }
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > this.groundY + 4 && p.color === "coin") {
        p.y = this.groundY + 4;
        p.vy *= -0.4;
        p.vx *= 0.7;
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const tx of this.texts) {
      tx.life -= dt;
      tx.y += tx.vy * dt;
      tx.vy *= 0.94;
    }
    this.texts = this.texts.filter((x) => x.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const f of this.fx) f.life -= dt;
    this.fx = this.fx.filter((f) => f.life > 0);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
  }

  draw() {
    const c = this.c;
    const s = this.getState();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.save();
    if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    this.drawBackground(s);
    this.drawActors(s);
    this.drawFx();
    this.drawParticles();
    this.drawTexts();
    c.restore();
    this.drawBanner();
    if (s.inBoss) this.drawBossVignette(s);
  }

  // ── Background: sky → far hill → near hill → ground + props, parallax ──
  private drawBackground(s: GameState) {
    const c = this.c, W = this.W, H = this.H, gy = this.groundY;
    const im = this.bg ? artImg(this.bg) : null;
    if (im) {
      // cover fit, floor line (78% of pic) sit on groundY
      const FLOOR = 0.78;
      const iw = im.naturalWidth, ih = im.naturalHeight;
      const sc = Math.max(W / iw, gy / (ih * FLOOR), (H - gy) / (ih * (1 - FLOOR)));
      c.drawImage(im, (W - iw * sc) / 2, gy - ih * FLOOR * sc, iw * sc, ih * sc);
      return;
    }
    const b = BIOMES[biomeIndex(s.stage)];
    const loop = biomeLoop(s.stage);
    const g = c.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, b.sky[0]);
    g.addColorStop(1, b.sky[1]);
    c.fillStyle = g;
    c.fillRect(-20, -20, W + 40, H + 40);

    // sun / moon
    const dark = ["castle", "starfall", "abyss"].includes(b.id);
    c.beginPath();
    c.arc(W * 0.82, H * 0.18, H * 0.08, 0, Math.PI * 2);
    c.fillStyle = dark ? "rgba(255,245,220,0.9)" : "rgba(255,250,210,0.95)";
    c.shadowColor = c.fillStyle;
    c.shadowBlur = 30;
    c.fill();
    c.shadowBlur = 0;

    if (dark) {
      for (let i = 0; i < 30; i++) {
        const x = (i * 97.3) % W, y = (i * 53.7) % (gy * 0.6);
        c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 1.5 + i));
        c.fillStyle = "#fff";
        c.fillRect(x, y, 2, 2);
      }
      c.globalAlpha = 1;
    } else {
      // cloud
      c.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 4; i++) {
        const x = ((i * 170 - this.scroll * 0.1) % (W + 200) + W + 200) % (W + 200) - 100;
        const y = H * (0.12 + (i % 3) * 0.08);
        cloud(c, x, y, 22 + (i % 2) * 8);
      }
    }

    hills(c, W, gy - H * 0.12, H * 0.12, this.scroll * 0.2, b.hillFar, 0.011);
    hills(c, W, gy - H * 0.04, H * 0.1, this.scroll * 0.45, b.hillNear, 0.017);

    // ground
    c.fillStyle = b.ground;
    c.fillRect(-20, gy, W + 40, H - gy + 20);
    c.fillStyle = b.groundEdge;
    c.fillRect(-20, gy, W + 40, 6);
    c.fillStyle = shade(b.ground.startsWith("#") ? b.ground : "#888888", -0.12);
    for (let i = 0; i < 14; i++) {
      const x = ((i * 61 - this.scroll) % (W + 60) + W + 60) % (W + 60) - 30;
      c.fillRect(x, gy + 14 + (i % 3) * 12, 18, 4);
    }
    this.drawProps(b.props, gy);

    // loop tint: each world loop darker + red (harder)
    if (loop > 0) {
      c.fillStyle = `rgba(80,0,40,${Math.min(0.35, loop * 0.1)})`;
      c.fillRect(-20, -20, W + 40, H + 40);
    }
    // corruption tint
    if (s.corruption > 0) {
      c.fillStyle = `rgba(120,0,160,${s.corruption * 0.05})`;
      c.fillRect(-20, -20, W + 40, H + 40);
    }
  }

  private drawProps(kind: string, gy: number) {
    const c = this.c, W = this.W, u = this.unit;
    const span = W + 160;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 137 - this.scroll * 0.7) % span + span) % span - 80;
      c.save();
      c.translate(x, gy);
      switch (kind) {
        case "grass":
          c.fillStyle = "#3e8f34";
          for (let k = 0; k < 3; k++) {
            c.beginPath();
            c.moveTo(k * 6, 0); c.lineTo(k * 6 + 3, -12 - k * 3); c.lineTo(k * 6 + 6, 0);
            c.fill();
          }
          c.beginPath(); c.arc(12, -6, 4, 0, 7); c.fillStyle = i % 2 ? "#ff7eb6" : "#ffe066"; c.fill();
          break;
        case "tree":
          c.fillStyle = "#5a3a22"; c.fillRect(-5, -u * 1.2, 10, u * 1.2);
          c.beginPath(); c.arc(0, -u * 1.5, u * 0.7, 0, 7); c.fillStyle = "#2f7a3a"; c.fill();
          c.lineWidth = 3; c.strokeStyle = OUTLINE; c.stroke();
          break;
        case "pillar":
          c.fillStyle = "#d9b47a"; c.fillRect(-8, -u * 1.4, 16, u * 1.4);
          c.strokeStyle = OUTLINE; c.lineWidth = 2.5; c.strokeRect(-8, -u * 1.4, 16, u * 1.4);
          c.fillRect(-12, -u * 1.5, 24, 8); c.strokeRect(-12, -u * 1.5, 24, 8);
          break;
        case "ice":
          c.beginPath(); c.moveTo(-10, 0); c.lineTo(0, -u * 0.9); c.lineTo(10, 0); c.closePath();
          c.fillStyle = "#cfefff"; c.fill(); c.strokeStyle = "#6aa9d9"; c.lineWidth = 2; c.stroke();
          break;
        case "lava":
          c.beginPath(); c.ellipse(0, 4, 22, 5, 0, 0, 7);
          c.fillStyle = `rgba(255,${120 + Math.sin(this.t * 4 + i) * 40},40,0.9)`; c.fill();
          break;
        case "tower":
          c.fillStyle = "#3a2d63"; c.fillRect(-10, -u * 1.8, 20, u * 1.8);
          c.beginPath(); c.moveTo(-14, -u * 1.8); c.lineTo(0, -u * 2.4); c.lineTo(14, -u * 1.8); c.fillStyle = "#c13c6b"; c.fill();
          c.fillStyle = "#ffd166"; c.fillRect(-3, -u * 1.4, 6, 8);
          break;
        case "star":
        case "void":
          c.beginPath(); c.arc(0, -u * (0.6 + Math.sin(this.t * 2 + i) * 0.2), 5, 0, 7);
          c.fillStyle = kind === "star" ? "#ffe066" : "#c13cff";
          c.shadowColor = c.fillStyle; c.shadowBlur = 12; c.fill(); c.shadowBlur = 0;
          break;
      }
      c.restore();
    }
  }

  private drawActors(s: GameState) {
    const c = this.c, u = this.unit, gy = this.groundY;
    const job = JOBS[s.job];
    // level-up aura
    if (this.levelGlow > 0) {
      const r = u * (1.5 + (1.2 - this.levelGlow) * 2);
      c.beginPath();
      c.arc(this.heroX, gy - u, r, 0, Math.PI * 2);
      c.strokeStyle = `rgba(255,224,102,${this.levelGlow / 1.2})`;
      c.lineWidth = 6;
      c.stroke();
    }
    // Kuro: rest beside hero, dash arc to enemy on claw
    const homeX = this.heroX - u * 1.25, homeY = gy - u * 2.4;
    const d = this.kuroDash > 0 ? Math.sin((1 - this.kuroDash) * Math.PI) : 0;
    const kx = homeX + (this.enemyX - u * 0.9 - homeX) * d;
    const ky = homeY - Math.sin(d * Math.PI) * u * 0.8 + d * u * 0.9;
    const blessed = s.kuro.buffLeft > 0;
    if (blessed) {
      c.beginPath();
      c.arc(kx, ky, u * 0.75 + Math.sin(this.t * 4) * 2, 0, Math.PI * 2);
      c.fillStyle = "rgba(255,214,102,0.25)";
      c.fill();
    }
    drawKuro(c, kx, ky, u * 0.55 * (1 + s.kuro.level * 0.004), this.t);
    if (this.say) this.drawSay(kx, ky - u * 0.7, this.say.text, this.say.life);
    drawHero(c, job, this.heroX, gy, u, this.t * (s.battle.enemy ? 1 : 2), this.lunge, this.hurt);

    const combat = s.battle.combat;
    const route = jobRoute(s.job);
    if (combat.shield > 0) {
      c.beginPath();
      c.ellipse(this.heroX, gy - u * 1.1, u * .85, u * 1.5, 0, 0, Math.PI * 2);
      c.fillStyle = "rgba(127,227,255,.17)";
      c.fill(); c.strokeStyle = "#7fe3ff"; c.lineWidth = 3; c.stroke();
    }
    if (route === "arcanist" || route === "ranger") {
      const max = route === "arcanist" ? 3 : jobMechanics(s).comboTarget;
      const filled = route === "arcanist" ? combat.mana : combat.combo;
      for (let i = 0; i < max; i++) {
        c.beginPath(); c.arc(this.heroX + (i - (max - 1) / 2) * 11, gy - u * 2.6, 4, 0, Math.PI * 2);
        c.fillStyle = i < filled ? route === "arcanist" ? "#b07cff" : "#2ee6a8" : "#362743";
        c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 1; c.stroke();
      }
    }

    // hero hp bar under feet
    const st = s.battle;
    const maxHp = Math.max(1, computeStats(s).maxHp);
    bar(c, this.heroX - u * 0.8, gy + 10, u * 1.6, 7, Math.max(0, st.heroHp) / maxHp, "#5fe07a", "#1d1530");

    const e = st.enemy;
    if (e) {
      const fam = FAMILIES[e.family];
      const col = fam.colors[e.variant] ?? fam.colors[0];
      const scale = e.kind === "chapterBoss" ? 1.85 : e.kind === "boss" ? 1.5 : 1;
      const slide = (1 - easeOut(this.enemyEnter)) * this.W * 0.4;
      const ex = this.enemyX + slide;
      c.save();
      if (e.kind !== "normal") {
        const glow = c.createRadialGradient(ex, gy - u * scale, 0, ex, gy - u * scale, u * 2.4 * scale);
        glow.addColorStop(0, "rgba(255,60,90,0.35)");
        glow.addColorStop(1, "rgba(255,60,90,0)");
        c.fillStyle = glow;
        c.fillRect(ex - u * 3 * scale, gy - u * 4 * scale, u * 6 * scale, u * 4.5 * scale);
      }
      if (this.enemyFlash > 0) c.filter = `brightness(${1 + this.enemyFlash * 2})`;
      const knock = this.enemyFlash * u * 0.12;
      drawMonster(c, fam, col, ex + knock, gy, u * 0.85 * scale, this.t, e.kind !== "normal");
      c.restore();
      // hp bar
      const bw = u * 1.9 * Math.min(1.5, scale);
      const by = gy - u * 2.4 * scale - 14;
      bar(c, ex - bw / 2, by, bw, 9, Math.max(0, e.hp) / e.maxHp, e.kind === "normal" ? "#ff5a5a" : "#ff2d6f", "#1d1530");
      c.font = `800 11px "Baloo 2", sans-serif`;
      c.textAlign = "center";
      c.fillStyle = "#fff";
      c.strokeStyle = OUTLINE;
      c.lineWidth = 3;
      const label = `Lv.${e.level}`;
      c.strokeText(label, ex, by - 4);
      c.fillText(label, ex, by - 4);
    } else if (this.dying) {
      const e2 = this.dying.enemy;
      const fam = FAMILIES[e2.family];
      const k = this.dying.life / 0.35;
      const scale = e2.kind === "chapterBoss" ? 1.85 : e2.kind === "boss" ? 1.5 : 1;
      c.save();
      c.globalAlpha = k;
      c.translate(this.enemyX, gy);
      c.scale(1 + (1 - k) * 0.5, k);
      c.translate(-this.enemyX, -gy);
      c.filter = "brightness(3)";
      drawMonster(c, fam, fam.colors[e2.variant] ?? fam.colors[0], this.enemyX, gy, u * 0.85 * scale, this.t, false);
      c.restore();
    }

    // loot beams
    for (const b of this.beams) {
      const k = b.life / b.max;
      const w = 10 + b.tier * 5;
      const grad = c.createLinearGradient(0, 0, 0, gy);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, b.color);
      c.globalAlpha = Math.min(1, k * 2) * 0.75;
      c.fillStyle = grad;
      c.fillRect(b.x - w / 2, 0, w, gy);
      c.globalAlpha = Math.min(1, k * 2);
      const bounce = Math.abs(Math.sin(this.t * 6)) * 8;
      c.beginPath();
      c.arc(b.x, gy - 14 - bounce, 9 + b.tier, 0, Math.PI * 2);
      c.fillStyle = b.color;
      c.shadowColor = b.color;
      c.shadowBlur = 20;
      c.fill();
      c.shadowBlur = 0;
      c.lineWidth = 3;
      c.strokeStyle = OUTLINE;
      c.stroke();
      c.globalAlpha = 1;
    }
  }

  // draw cut-art sprite centered. not loaded yet → false (caller draw vector fallback)
  private spr(name: string, x: number, y: number, size: number, rot = 0, alpha = 1, add = false): boolean {
    const im = artImg(name);
    if (!im) return false;
    const c = this.c;
    c.save();
    c.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (add) c.globalCompositeOperation = "lighter";
    c.translate(x, y);
    if (rot) c.rotate(rot);
    c.drawImage(im, -size / 2, -size / 2, size, size);
    c.restore();
    return true;
  }

  private ring(x: number, y: number, r: number, color: string, w: number, alpha: number) {
    const c = this.c;
    c.save();
    c.globalAlpha = Math.max(0, Math.min(1, alpha));
    c.beginPath();
    c.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.5, w);
    c.shadowColor = color;
    c.shadowBlur = 14;
    c.stroke();
    c.restore();
  }

  private glow(x: number, y: number, r: number, inner: string, alpha: number) {
    const c = this.c;
    c.save();
    c.globalAlpha = Math.max(0, Math.min(1, alpha));
    c.globalCompositeOperation = "lighter";
    const g = c.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.25, inner);
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // one-shot moment inside fx (impact burst etc)
  private once(f: Fx, key: string, at: number, k: number): boolean {
    if (k < at || f.fired.includes(key)) return false;
    f.fired.push(key);
    return true;
  }

  private drawFx() {
    const c = this.c, u = this.unit, gy = this.groundY, ex = this.enemyX, hx = this.heroX;
    const ey = gy - u; // enemy body center
    const hy = gy - u;
    for (const f of this.fx) {
      const k = 1 - f.life / f.max; // 0 → 1
      const a = 1 - k;
      c.save();
      switch (f.kind) {
        case "poke": {
          const p = easeOut(Math.min(1, k * 2.5));
          if (!this.spr("fx-spark", ex, ey, u * (0.8 + p * 1.2), k * 2, a * 1.4)) {
            this.ring(ex, ey, u * (0.4 + p), "#fff", 6, a);
          }
          if (this.once(f, "hit", 0.05, k)) this.burst(ex, ey, 8, "#fff3b0", 4);
          break;
        }
        case "slash": {
          // whirl: red arcs spin round enemy, one per hit
          for (let i = 0; i < Math.max(1, f.hits); i++) {
            const p = Math.min(1, Math.max(0, k * 2.2 - i * 0.28));
            if (p <= 0) continue;
            const pa = 1 - p;
            const rot = -0.9 + p * 2.6 + i * 2.1;
            if (!this.spr("fx-slash", ex + Math.cos(rot) * u * 0.25, ey + Math.sin(rot) * u * 0.2, u * (1.9 + i * 0.25), rot, pa * 1.5)) {
              c.beginPath();
              c.arc(ex, ey, u * (1.2 + i * 0.25), rot - 0.6, rot + 0.4);
              c.strokeStyle = `rgba(255,120,90,${pa})`;
              c.lineWidth = 8 - i;
              c.stroke();
            }
            if (this.once(f, "s" + i, 0.02 + i * 0.13, k)) this.burst(ex, ey, 6, "#ff9a7a", 4);
          }
          break;
        }
        case "meteor": {
          // fall from top-right, trail, then boom
          const fall = Math.min(1, k / 0.42);
          if (k < 0.42) {
            const x = ex + (1 - fall) * u * 3.2, y = -u + (ey + u) * easeIn(fall);
            for (let t = 1; t <= 4; t++) this.glow(x + t * u * 0.35, y - t * u * 0.45, u * (0.7 - t * 0.12), "#ff7a2a", 0.5 - t * 0.1);
            if (!this.spr("fx-meteor", x, y, u * 2.1, 0, 1)) {
              c.beginPath();
              c.arc(x, y, u * 0.6, 0, Math.PI * 2);
              c.fillStyle = "#ff8a3d";
              c.fill();
            }
            if (Math.random() < 0.6) this.parts.push({ x: x + u * 0.3, y: y - u * 0.3, vx: 40 + Math.random() * 60, vy: -40 - Math.random() * 40, r: 2 + Math.random() * 3, color: Math.random() < 0.5 ? "#ffb347" : "#7a4b8f", life: 0.4, max: 0.4, g: 200 });
          } else {
            const b = (k - 0.42) / 0.58;
            this.glow(ex, gy - u * 0.6, u * (1 + b * 2.4), "#ff8a3d", (1 - b) * 1.3);
            this.ring(ex, gy - u * 0.4, u * (0.6 + b * 3), "#ffcf6b", 7 * (1 - b) + 1, 1 - b);
            this.spr("fx-spark", ex, gy - u * 0.8, u * (1.6 + b * 1.4), b, 1 - b);
          }
          if (this.once(f, "boom", 0.42, k)) {
            this.shake = Math.max(this.shake, 10);
            this.burst(ex, gy - u * 0.5, 22, "#ff9a3d", 6);
            this.burst(ex, gy - u * 0.3, 10, "#6b4a7a", 5);
          }
          break;
        }
        case "volley": {
          // arrows lob in arc, one by one
          for (let i = 0; i < f.hits; i++) {
            const p = Math.min(1, (k * 0.85 - i * 0.1) / 0.3);
            if (p <= 0) continue;
            if (p >= 1) {
              if (this.once(f, "v" + i, 0, 1)) this.burst(ex, ey, 5, "#b6ff7a", 3);
              continue;
            }
            const x = hx + (ex - hx) * p;
            const y = hy - u * (0.2 + (i % 3) * 0.25) - Math.sin(p * Math.PI) * u * 1.3;
            const dy = -Math.cos(p * Math.PI) * u * 1.3 * Math.PI;
            const rot = Math.atan2(dy, ex - hx);
            if (!this.spr("fx-arrow", x, y, u * 1.5, rot, 1)) {
              c.beginPath(); c.moveTo(x - 18, y); c.lineTo(x, y);
              c.strokeStyle = "#fff"; c.lineWidth = 3; c.stroke();
            }
          }
          break;
        }
        case "pierce": {
          // sniper: fast straight streaks
          for (let i = 0; i < f.hits; i++) {
            const p = Math.min(1, (k * 0.9 - i * 0.09) / 0.12);
            if (p <= 0) continue;
            if (p >= 1) {
              if (this.once(f, "p" + i, 0, 1)) this.burst(ex, ey, 4, "#2ee6a8", 4);
              continue;
            }
            const x = hx + (ex - hx) * p;
            const y = hy - u * 0.15 + ((i % 3) - 1) * u * 0.22;
            c.beginPath();
            c.moveTo(x - u * 1.6, y);
            c.lineTo(x, y);
            c.strokeStyle = "rgba(46,230,168,.55)";
            c.lineWidth = 4;
            c.stroke();
            this.spr("fx-arrow", x, y, u * 1.3, 0, 1);
          }
          break;
        }
        case "holy": {
          // judgement: gold pillar from sky + rune ring on ground. judicator = red-gold, bigger
          const judge = f.spec === "judicator";
          const w = u * (judge ? 1.6 : 1.25) * (1 - k * 0.45);
          const grad = c.createLinearGradient(ex - w, 0, ex + w, 0);
          const col = judge ? "255,120,80" : "255,230,120";
          grad.addColorStop(0, `rgba(${col},0)`);
          grad.addColorStop(0.5, `rgba(255,248,210,${a})`);
          grad.addColorStop(1, `rgba(${col},0)`);
          c.globalCompositeOperation = "lighter";
          c.fillStyle = grad;
          c.fillRect(ex - w, 0, w * 2, gy);
          c.globalCompositeOperation = "source-over";
          c.save();
          c.translate(ex, gy);
          c.scale(1, 0.32);
          this.ring(0, 0, u * (0.8 + k * 0.9), judge ? "#ff6b4a" : "#ffd23f", 5, a);
          this.ring(0, 0, u * (1.2 + k * 1.2), judge ? "#ffb347" : "#fff2a8", 3, a * 0.7);
          c.restore();
          if (judge) this.spr("fx-ray", ex - u * 0.2, ey - u * (1.8 - k * 1.4), u * 2.2, Math.PI / 2, a * 1.3);
          for (let i = 0; i < f.hits; i++) {
            if (this.once(f, "h" + i, i * 0.16, k)) this.burst(ex, ey, 6, judge ? "#ff8a5a" : "#ffe066", 4);
          }
          this.spr("fx-spark", ex, ey - u * 0.2, u * (1.4 + Math.sin(k * 20) * 0.2), k * 3, a);
          break;
        }
        case "nova":
          if (f.spec === "flow") this.drawFlow(f, k);
          else if (f.spec === "cataclysm") this.drawCataclysm(f, k);
          else this.drawNova(f, k);
          break;
        case "claw": {
          const p = easeOut(Math.min(1, k * 3));
          if (this.spr("fx-claw", ex, ey - u * 0.2, u * (1.4 + p * 1.0), -0.15, a * 1.6)) break;
          c.lineCap = "round";
          for (let i = 0; i < f.hits; i++) {
            const pp = Math.min(1, k * 3 - i * 0.35);
            if (pp <= 0) continue;
            const ox = (i - 1) * u * 0.35;
            const x0 = ex + ox - u * 0.6, y0 = gy - u * 2;
            const x1 = ex + ox + u * 0.5, y1 = gy - u * 0.2;
            c.beginPath();
            c.moveTo(x0, y0);
            c.lineTo(x0 + (x1 - x0) * pp, y0 + (y1 - y0) * pp);
            c.strokeStyle = `rgba(214,140,255,${a})`;
            c.lineWidth = 7;
            c.stroke();
          }
          break;
        }
        case "counter": {
          // gold ray hero → enemy. judicator = fat red-gold
          const big = f.spec === "judicator";
          const p = easeOut(Math.min(1, k * 3));
          const x = hx + (ex - hx) * p;
          if (!this.spr("fx-ray", x, hy, u * (big ? 2.6 : 1.8), Math.PI, a * 1.5)) {
            c.beginPath(); c.moveTo(hx, hy); c.lineTo(x, hy);
            c.strokeStyle = `rgba(255,209,102,${a})`; c.lineWidth = big ? 8 : 5; c.stroke();
          }
          if (this.once(f, "hit", 0.3, k)) this.burst(ex, ey, big ? 16 : 8, big ? "#ff7a4a" : "#ffd166", big ? 6 : 4);
          if (k > 0.3) this.spr("fx-spark", ex, ey, u * (big ? 2 : 1.3), k, a);
          break;
        }
        case "pursuit": {
          // barrage = 3 small fast arrows; marksman = crosshair + one golden heavy shot
          if (f.spec === "marksman") {
            const lock = Math.min(1, k / 0.45);
            c.save();
            c.translate(ex, ey);
            c.rotate((1 - lock) * 1.5);
            const r = u * (1.6 - lock * 0.8);
            c.globalAlpha = a;
            c.strokeStyle = "#ffd23f";
            c.lineWidth = 3;
            c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
            for (let i = 0; i < 4; i++) {
              c.rotate(Math.PI / 2);
              c.beginPath(); c.moveTo(r * 0.55, 0); c.lineTo(r * 1.3, 0); c.stroke();
            }
            c.restore();
            if (k > 0.45) {
              const p = Math.min(1, (k - 0.45) / 0.15);
              const x = hx + (ex - hx) * p;
              c.beginPath();
              c.moveTo(hx, hy); c.lineTo(x, hy);
              c.strokeStyle = `rgba(255,220,120,${a})`;
              c.lineWidth = 6;
              c.shadowColor = "#ffd23f";
              c.shadowBlur = 18;
              c.stroke();
              c.shadowBlur = 0;
              this.spr("fx-arrow", x, hy, u * 1.9, 0, 1);
            }
            if (this.once(f, "hit", 0.6, k)) {
              this.shake = Math.max(this.shake, 8);
              this.burst(ex, ey, 18, "#ffd23f", 6);
            }
          } else {
            const n = f.spec === "barrage" ? 3 : 1;
            for (let i = 0; i < n; i++) {
              const p = Math.min(1, (k - i * 0.12) / 0.3);
              if (p <= 0 || p >= 1) continue;
              const x = hx + (ex - hx) * p;
              const y = hy + (i - (n - 1) / 2) * u * 0.3;
              if (!this.spr("fx-arrow", x, y, u * 1.3, 0, 1)) {
                c.beginPath(); c.moveTo(x - 18, y); c.lineTo(x, y);
                c.strokeStyle = "#2ee6a8"; c.lineWidth = 4; c.stroke();
              }
            }
            if (this.once(f, "hit", 0.3, k)) this.burst(ex, ey, 8, "#2ee6a8", 4);
          }
          break;
        }
        case "ward": {
          // shield bubble on hero. guardian = big, judicator = small
          const sz = f.spec === "guardian" ? 2.9 : f.spec === "judicator" ? 1.9 : 2.4;
          const pop = k < 0.15 ? easeOut(k / 0.15) : 1;
          const wob = 1 + Math.sin(this.t * 8) * 0.03;
          this.spr("fx-shield", hx, hy - u * 0.15, u * sz * pop * wob, 0, Math.min(0.75, a * 1.2));
          break;
        }
      }
      c.restore();
    }
  }

  // archmage base 星爆: orb fly → blue nova
  private drawNova(f: Fx, k: number) {
    const u = this.unit, gy = this.groundY, ex = this.enemyX, hx = this.heroX;
    const ey = gy - u;
    if (k < 0.35) {
      const p = k / 0.35;
      const x = hx + (ex - hx) * easeIn(p);
      this.glow(x, ey - u * 0.4, u * 1.1, "#5ad1ff", 0.9);
      this.spr("fx-orb", x, ey - u * 0.4, u * (1.0 + p * 0.4), p * 6, 1);
    } else {
      const b = (k - 0.35) / 0.65;
      this.glow(ex, ey, u * (1 + b * 3), "#5ad1ff", (1 - b) * 1.4);
      for (let i = 0; i < 3; i++) this.ring(ex, ey, u * (0.5 + b * 3 + i * 0.4), "#7fe3ff", 6 - i * 2, (1 - b) * (1 - i * 0.25));
      this.spr("fx-ring", ex, ey, u * (1.4 + b * 2.4), b * 2, 1 - b, true);
    }
    if (this.once(f, "boom", 0.35, k)) {
      this.shake = Math.max(this.shake, 8);
      this.burst(ex, ey, 20, "#7fe3ff", 6);
    }
  }

  // 重爆: big purple orb lob, white flash, huge shockwave, shards
  private drawCataclysm(f: Fx, k: number) {
    const c = this.c, u = this.unit, gy = this.groundY, ex = this.enemyX, hx = this.heroX, W = this.W, H = this.H;
    const ey = gy - u;
    if (k < 0.4) {
      const p = k / 0.4;
      const x = hx + (ex - hx) * easeIn(p);
      const y = ey - u * 1.4 * Math.sin(p * Math.PI) - u * 0.3;
      this.glow(x, y, u * (1.4 + p), "#b14dff", 1);
      this.spr("fx-orb", x, y, u * (1.5 + p * 0.8), p * 8, 1);
    } else {
      const b = (k - 0.4) / 0.6;
      if (b < 0.25) {
        c.save();
        c.globalAlpha = (0.25 - b) * 3;
        c.fillStyle = "#fff4d6";
        c.fillRect(-20, -20, W + 40, H + 40);
        c.restore();
      }
      this.glow(ex, ey, u * (1.5 + b * 4.5), "#ff6a3d", (1 - b) * 1.5);
      this.glow(ex, ey, u * (1 + b * 2.5), "#b14dff", (1 - b) * 1.2);
      this.ring(ex, gy - u * 0.4, u * (0.8 + b * 5), "#ffb347", 10 * (1 - b) + 1, 1 - b);
      this.ring(ex, gy - u * 0.4, u * (0.4 + b * 3.6), "#d59bff", 6 * (1 - b) + 1, 1 - b);
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i - 2.5) * 0.45;
        const d = u * (0.6 + b * 3.2);
        this.spr("fx-meteor", ex + Math.cos(ang) * d, ey + Math.sin(ang) * d * 0.7, u * 0.8, ang + Math.PI * 0.75, 1 - b);
      }
    }
    if (this.once(f, "boom", 0.4, k)) {
      this.shake = Math.max(this.shake, 16);
      this.burst(ex, ey, 34, "#ff9a3d", 8);
      this.burst(ex, ey, 18, "#c77dff", 7);
    }
  }

  // 流轉: cyan spiral + 3 orbs orbit hero then stream in; light, fast
  private drawFlow(f: Fx, k: number) {
    const c = this.c, u = this.unit, gy = this.groundY, ex = this.enemyX, hx = this.heroX;
    const ey = gy - u;
    const spin = this.t * 9;
    if (k < 0.3) {
      const p = k / 0.3;
      this.spr("fx-spiral", hx, ey, u * (1 + p * 0.6), -spin, 0.85, true);
      for (let i = 0; i < 3; i++) {
        const ang = spin + (i * Math.PI * 2) / 3;
        this.glow(hx + Math.cos(ang) * u * 0.9, ey + Math.sin(ang) * u * 0.5, u * 0.45, "#2ee6d0", 1);
      }
    } else {
      const p = Math.min(1, (k - 0.3) / 0.3);
      for (let i = 0; i < 3; i++) {
        const q = Math.max(0, Math.min(1, p * 1.4 - i * 0.18));
        const x = hx + (ex - hx) * q;
        const y = ey + Math.sin(q * Math.PI * 2 + i * 2) * u * 0.5;
        if (q < 1) {
          c.save();
          c.globalAlpha = 0.5;
          c.strokeStyle = "#7ff5ff";
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(x - u * 0.8, y);
          c.lineTo(x, y);
          c.stroke();
          c.restore();
          this.glow(x, y, u * 0.45, "#2ee6d0", 1);
        }
      }
      const b = Math.max(0, (k - 0.5) / 0.5);
      if (b > 0) {
        this.spr("fx-spiral", ex, ey, u * (1.4 + b * 1.2), spin, 1 - b, true);
        this.ring(ex, ey, u * (0.6 + b * 1.8), "#7ff5ff", 4, 1 - b);
      }
    }
    if (this.once(f, "boom", 0.5, k)) this.burst(ex, ey, 14, "#7ff5ff", 5);
  }

  private drawParticles() {
    const c = this.c;
    for (const p of this.parts) {
      c.globalAlpha = Math.min(1, p.life / (p.max * 0.5));
      if (p.color === "coin") {
        c.beginPath();
        c.ellipse(p.x, p.y, p.r * Math.abs(Math.cos(this.t * 10 + p.vx)), p.r, 0, 0, Math.PI * 2);
        c.fillStyle = "#ffd23f";
        c.fill();
        c.lineWidth = 1.5;
        c.strokeStyle = "#b8860b";
        c.stroke();
      } else {
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fillStyle = p.color;
        c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  private drawTexts() {
    const c = this.c;
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const tx of this.texts) {
      const age = 1 - tx.life / tx.max;
      const pop = age < 0.15 ? 0.6 + (age / 0.15) * 0.6 : 1.2 - Math.min(0.2, (age - 0.15));
      c.globalAlpha = Math.min(1, tx.life / (tx.max * 0.35));
      c.font = `900 ${Math.round(tx.size * pop)}px "Baloo 2", "Noto Sans TC", sans-serif`;
      c.lineWidth = 5;
      c.strokeStyle = OUTLINE;
      c.strokeText(tx.text, tx.x, tx.y);
      c.fillStyle = tx.color;
      c.fillText(tx.text, tx.x, tx.y);
    }
    c.globalAlpha = 1;
  }

  private drawBanner() {
    const b = this.banner;
    if (!b) return;
    const c = this.c, W = this.W, H = this.H;
    const age = b.max - b.life;
    const inK = Math.min(1, age / 0.25);
    const outK = Math.min(1, b.life / 0.3);
    const y = H * 0.38;
    c.save();
    c.globalAlpha = outK;
    c.fillStyle = "rgba(20,10,40,0.55)";
    c.fillRect(0, y - 38 * inK, W, 76 * inK);
    c.textAlign = "center";
    c.textBaseline = "middle";
    const scale = 0.5 + easeOut(inK) * 0.5 + (age < 0.35 ? (0.35 - age) * 1.2 : 0);
    c.translate(W / 2, y - 6);
    c.scale(scale, scale);
    c.font = `900 40px "Baloo 2", "Noto Sans TC", sans-serif`;
    c.lineWidth = 8;
    c.strokeStyle = OUTLINE;
    c.strokeText(b.text, 0, 0);
    c.fillStyle = b.color;
    c.fillText(b.text, 0, 0);
    c.font = `800 15px "Noto Sans TC", sans-serif`;
    c.lineWidth = 4;
    c.strokeText(b.sub, 0, 28);
    c.fillStyle = "#fff";
    c.fillText(b.sub, 0, 28);
    c.restore();
  }

  // speech bubble above Kuro, wrap long text
  private drawSay(x: number, y: number, text: string, life: number) {
    const c = this.c;
    c.save();
    c.globalAlpha = Math.min(1, life / 0.25);
    c.font = `800 12px "Noto Sans TC", sans-serif`;
    const maxW = Math.min(170, this.W * 0.5);
    const lines: string[] = [];
    let cur = "";
    for (const ch of text) {
      if (c.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; } else cur += ch;
    }
    if (cur) lines.push(cur);
    const w = Math.max(...lines.map((l) => c.measureText(l).width)) + 16;
    const h = lines.length * 15 + 10;
    const bx = Math.max(4, Math.min(this.W - w - 4, x - 14));
    const by = Math.max(4, y - h - 8);
    c.beginPath();
    c.roundRect(bx, by, w, h, 9);
    c.moveTo(x - 4, by + h);
    c.lineTo(x, by + h + 8);
    c.lineTo(x + 6, by + h);
    c.fillStyle = "#fffaf0";
    c.strokeStyle = OUTLINE;
    c.lineWidth = 2.5;
    c.fill();
    c.stroke();
    c.fillStyle = "#2a1a3e";
    c.textAlign = "left";
    c.textBaseline = "top";
    lines.forEach((l, i) => c.fillText(l, bx + 8, by + 6 + i * 15));
    c.restore();
  }

  private drawBossVignette(s: GameState) {
    const c = this.c, W = this.W, H = this.H;
    const pulse = 0.25 + Math.sin(this.t * 6) * 0.08;
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
    g.addColorStop(0, "rgba(255,0,60,0)");
    g.addColorStop(1, `rgba(255,0,60,${pulse})`);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // boss timer bar top
    const k = Math.max(0, s.battle.bossTimer) / 30;
    bar(c, W * 0.2, 10, W * 0.6, 10, k, k > 0.3 ? "#ffd23f" : "#ff4d6d", "#1d1530");
    c.font = `900 12px "Baloo 2", sans-serif`;
    c.textAlign = "center";
    c.fillStyle = "#fff";
    c.strokeStyle = OUTLINE;
    c.lineWidth = 3;
    const t = `${Math.ceil(Math.max(0, s.battle.bossTimer))}s`;
    c.strokeText(t, W / 2, 34);
    c.fillText(t, W / 2, 34);
  }
}

function easeOut(k: number) {
  return 1 - Math.pow(1 - k, 3);
}

function bar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number, color: string, bg: string) {
  k = Math.max(0, Math.min(1, k));
  c.beginPath();
  c.roundRect(x - 2, y - 2, w + 4, h + 4, (h + 4) / 2);
  c.fillStyle = OUTLINE;
  c.fill();
  c.beginPath();
  c.roundRect(x, y, w, h, h / 2);
  c.fillStyle = bg;
  c.fill();
  if (k > 0) {
    c.beginPath();
    c.roundRect(x, y, Math.max(h, w * k), h, h / 2);
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, shade(color.startsWith("#") ? color : "#ffffff", 0.35));
    g.addColorStop(1, color);
    c.fillStyle = g;
    c.fill();
  }
}

function hills(c: CanvasRenderingContext2D, W: number, baseY: number, amp: number, off: number, color: string, freq: number) {
  c.beginPath();
  c.moveTo(-20, baseY + amp * 2);
  for (let x = -20; x <= W + 20; x += 8) {
    const y = baseY - amp * (0.5 + 0.5 * Math.sin((x + off) * freq) * Math.cos((x + off) * freq * 0.37));
    c.lineTo(x, y);
  }
  c.lineTo(W + 20, baseY + amp * 3);
  c.closePath();
  c.fillStyle = color;
  c.fill();
}

function cloud(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.arc(x + r * 0.9, y + r * 0.2, r * 0.75, 0, Math.PI * 2);
  c.arc(x - r * 0.9, y + r * 0.25, r * 0.65, 0, Math.PI * 2);
  c.fill();
}

function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

function easeIn(k: number) {
  return k * k;
}
