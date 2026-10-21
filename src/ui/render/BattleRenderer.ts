// Canvas2D battle view. Read state every frame, react to sim event for juice.
// Interface small → later swap to PixiJS / Spine without touch game logic.
import { BIOMES, FAMILIES, JOBS } from "../../config/content";
import { biomeIndex, biomeLoop } from "../../core/formulas";
import { fmt } from "../../core/format";
import { rarityIndex } from "../../core/items";
import { computeStats } from "../../core/stats";
import type { Enemy, GameState, SimEvent } from "../../core/types";
import { RARITY_COLOR } from "../theme";
import { drawHero, drawKuro, drawMonster, OUTLINE, shade } from "./shapes";

interface FloatText { x: number; y: number; vy: number; text: string; color: string; size: number; life: number; max: number; }
interface Particle { x: number; y: number; vx: number; vy: number; r: number; color: string; life: number; max: number; g: number; }
interface Beam { x: number; color: string; tier: number; life: number; max: number; }
interface Fx { kind: string; life: number; max: number; hits: number; }
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

  constructor(private canvas: HTMLCanvasElement, private getState: () => GameState) {
    this.c = canvas.getContext("2d")!;
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
      case "skill":
        this.fx.push({ kind: e.fx, life: 0.7, max: 0.7, hits: e.hits });
        this.shake = Math.max(this.shake, 7);
        this.enemyFlash = 1;
        this.addText(ex, gy - u * 3, fmt(Math.max(1, Math.round(e.dmg))), e.crit ? "#ff9cf5" : "#c9a7ff", e.crit ? 38 : 32, 1.3);
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
        break;
      }
      case "levelUp":
        this.levelGlow = 1.2;
        this.burst(this.heroX, gy - u, 24, "#ffe066", 5);
        this.addText(this.heroX, gy - u * 3.4, "LEVEL UP!", "#ffe066", 26, 1.6);
        break;
      case "bossStart":
        this.banner = { text: e.kind === "chapterBoss" ? "章節魔王" : "BOSS 戰", sub: "30 秒內擊倒！", color: "#ff4d6d", life: 1.8, max: 1.8 };
        this.shake = 10;
        break;
      case "bossWin":
        this.banner = { text: "勝利！", sub: `第 ${e.stage} 關突破`, color: "#ffd23f", life: 1.8, max: 1.8 };
        this.burst(this.W / 2, this.H * 0.4, 60, "#ffd23f", 8);
        break;
      case "bossFail":
        this.banner = { text: e.reason === "timeout" ? "時間到…" : "被打敗…", sub: "再練下先", color: "#9aa4c0", life: 1.6, max: 1.6 };
        break;
      case "heroDown":
        this.banner = { text: "撤退", sub: `返回第 ${e.retreatTo} 關`, color: "#9aa4c0", life: 1.6, max: 1.6 };
        break;
    }
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
    drawKuro(c, this.heroX - u * 1.25, gy - u * 2.4, u * 0.55, this.t);
    drawHero(c, job, this.heroX, gy, u, this.t * (s.battle.enemy ? 1 : 2), this.lunge, this.hurt);

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

  private drawFx() {
    const c = this.c, u = this.unit, gy = this.groundY, ex = this.enemyX, hx = this.heroX;
    for (const f of this.fx) {
      const k = 1 - f.life / f.max; // 0 → 1
      const a = 1 - k;
      c.save();
      switch (f.kind) {
        case "slash":
        case "poke":
          for (let i = 0; i < Math.max(1, f.hits); i++) {
            c.beginPath();
            c.arc(ex, gy - u, u * (1.2 + i * 0.25), -1.2 + k * 2 + i * 0.6, -0.2 + k * 2 + i * 0.6);
            c.strokeStyle = `rgba(255,255,255,${a})`;
            c.lineWidth = 8 - i;
            c.stroke();
          }
          break;
        case "meteor": {
          const y = -40 + k * (gy - u + 40) * 1.6;
          if (k < 0.62) {
            c.beginPath();
            c.arc(ex + (1 - k) * 60, Math.min(y, gy - u), u * 0.6, 0, Math.PI * 2);
            c.fillStyle = "#ff8a3d";
            c.shadowColor = "#ff5a2a";
            c.shadowBlur = 30;
            c.fill();
          } else {
            const r = u * (0.5 + (k - 0.62) * 8);
            c.beginPath();
            c.arc(ex, gy - u * 0.5, r, 0, Math.PI * 2);
            c.fillStyle = `rgba(255,140,60,${a * 1.6})`;
            c.fill();
          }
          break;
        }
        case "volley":
        case "pierce":
          for (let i = 0; i < f.hits; i++) {
            const p = Math.min(1, k * 2.2 - i * 0.12);
            if (p <= 0) continue;
            const x = hx + (ex - hx) * p;
            const y = gy - u * (1 + (i % 3) * 0.3) - Math.sin(p * Math.PI) * (f.kind === "volley" ? u : 0);
            c.beginPath();
            c.moveTo(x - 18, y);
            c.lineTo(x, y);
            c.strokeStyle = f.kind === "pierce" ? `rgba(46,230,168,${a})` : `rgba(255,255,255,${a})`;
            c.lineWidth = f.kind === "pierce" ? 5 : 3;
            c.stroke();
          }
          break;
        case "holy": {
          const w = u * 1.4 * (1 - k * 0.5);
          const grad = c.createLinearGradient(ex - w, 0, ex + w, 0);
          grad.addColorStop(0, "rgba(255,230,120,0)");
          grad.addColorStop(0.5, `rgba(255,240,180,${a})`);
          grad.addColorStop(1, "rgba(255,230,120,0)");
          c.fillStyle = grad;
          c.fillRect(ex - w, 0, w * 2, gy);
          break;
        }
        case "nova": {
          for (let i = 0; i < 3; i++) {
            c.beginPath();
            c.arc(ex, gy - u, u * (0.5 + k * 3 + i * 0.4), 0, Math.PI * 2);
            c.strokeStyle = `rgba(90,209,255,${a * (1 - i * 0.3)})`;
            c.lineWidth = 7 - i * 2;
            c.stroke();
          }
          break;
        }
      }
      c.restore();
    }
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
