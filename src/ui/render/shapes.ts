// Procedural chibi art. Thick dark outline + soft shade = cartoon mobile look.
import type { FamilyDef, JobDef } from "../../config/content";

export const OUTLINE = "#2a1f3d";

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  } else {
    r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function blobFill(c: CanvasRenderingContext2D, color: string, x: number, y: number, r: number) {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, shade(color, 0.45));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shade(color, -0.3));
  return g;
}

function stroke(c: CanvasRenderingContext2D, w = 3) {
  c.lineWidth = w;
  c.strokeStyle = OUTLINE;
  c.lineJoin = "round";
  c.lineCap = "round";
  c.stroke();
}

function eyes(c: CanvasRenderingContext2D, x: number, y: number, gap: number, r: number, angry = false) {
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(x + s * gap, y, r * 0.8, r, 0, 0, Math.PI * 2);
    c.fillStyle = "#fff";
    c.fill();
    stroke(c, 2);
    c.beginPath();
    c.arc(x + s * gap - r * 0.15, y + r * 0.15, r * 0.5, 0, Math.PI * 2);
    c.fillStyle = OUTLINE;
    c.fill();
    c.beginPath();
    c.arc(x + s * gap - r * 0.3, y - r * 0.1, r * 0.18, 0, Math.PI * 2);
    c.fillStyle = "#fff";
    c.fill();
    if (angry) {
      c.beginPath();
      c.moveTo(x + s * gap - s * r * 1.1, y - r * 1.5);
      c.lineTo(x + s * gap + s * r * 0.6, y - r * 0.9);
      stroke(c, 3);
    }
  }
}

function shadow(c: CanvasRenderingContext2D, x: number, y: number, w: number) {
  c.beginPath();
  c.ellipse(x, y, w, w * 0.22, 0, 0, Math.PI * 2);
  c.fillStyle = "rgba(0,0,0,0.22)";
  c.fill();
}

// ── Monster. (x,y) = feet center. s = size unit (~40). t = time for idle anim ──
export function drawMonster(c: CanvasRenderingContext2D, fam: FamilyDef, color: string, x: number, y: number, s: number, t: number, angry: boolean) {
  const squash = 1 + Math.sin(t * 5) * 0.05;
  shadow(c, x, y, s * 0.9);
  c.save();
  c.translate(x, y);
  c.scale(1 / squash, squash);
  c.translate(-x, -y);
  switch (fam.shape) {
    case "blob": {
      c.beginPath();
      c.moveTo(x - s, y);
      c.bezierCurveTo(x - s * 1.05, y - s * 1.3, x + s * 1.05, y - s * 1.3, x + s, y);
      c.closePath();
      c.fillStyle = blobFill(c, color, x, y - s * 0.5, s);
      c.fill();
      stroke(c);
      eyes(c, x, y - s * 0.5, s * 0.32, s * 0.16, angry);
      mouth(c, x, y - s * 0.22, s * 0.15);
      break;
    }
    case "mushroom": {
      c.beginPath();
      c.roundRect(x - s * 0.45, y - s * 0.8, s * 0.9, s * 0.8, s * 0.25);
      c.fillStyle = "#fff1dc";
      c.fill();
      stroke(c);
      c.beginPath();
      c.ellipse(x, y - s * 0.85, s * 1.05, s * 0.65, 0, Math.PI, 0);
      c.closePath();
      c.fillStyle = blobFill(c, color, x, y - s * 1.1, s);
      c.fill();
      stroke(c);
      for (const [dx, dy, r] of [[-0.5, -1.05, 0.15], [0.3, -1.25, 0.12], [0.6, -0.95, 0.1]]) {
        c.beginPath();
        c.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
        c.fillStyle = "#fff";
        c.fill();
      }
      eyes(c, x, y - s * 0.45, s * 0.2, s * 0.12, angry);
      break;
    }
    case "bat": {
      const fy = y - s * 1.1 + Math.sin(t * 8) * s * 0.15;
      const flap = Math.sin(t * 16) * 0.4;
      for (const d of [-1, 1]) {
        c.beginPath();
        c.moveTo(x + d * s * 0.4, fy);
        c.quadraticCurveTo(x + d * s * 1.3, fy - s * (0.7 + flap), x + d * s * 1.5, fy + s * 0.1);
        c.quadraticCurveTo(x + d * s * 1.0, fy, x + d * s * 0.9, fy + s * 0.35);
        c.quadraticCurveTo(x + d * s * 0.6, fy + s * 0.1, x + d * s * 0.4, fy + s * 0.3);
        c.closePath();
        c.fillStyle = shade(color, -0.2);
        c.fill();
        stroke(c);
      }
      c.beginPath();
      c.arc(x, fy, s * 0.55, 0, Math.PI * 2);
      c.fillStyle = blobFill(c, color, x, fy, s * 0.55);
      c.fill();
      stroke(c);
      for (const d of [-1, 1]) {
        c.beginPath();
        c.moveTo(x + d * s * 0.25, fy - s * 0.45);
        c.lineTo(x + d * s * 0.42, fy - s * 0.85);
        c.lineTo(x + d * s * 0.5, fy - s * 0.35);
        c.fillStyle = color;
        c.fill();
        stroke(c, 2);
      }
      eyes(c, x, fy - s * 0.05, s * 0.2, s * 0.12, angry);
      break;
    }
    case "rock": {
      c.beginPath();
      c.moveTo(x - s, y);
      c.lineTo(x - s * 0.9, y - s * 0.7);
      c.lineTo(x - s * 0.3, y - s * 1.15);
      c.lineTo(x + s * 0.5, y - s * 1.05);
      c.lineTo(x + s, y - s * 0.5);
      c.lineTo(x + s * 0.95, y);
      c.closePath();
      c.fillStyle = blobFill(c, color, x, y - s * 0.6, s);
      c.fill();
      stroke(c);
      c.beginPath();
      c.moveTo(x + s * 0.2, y - s * 0.9);
      c.lineTo(x + s * 0.4, y - s * 0.6);
      stroke(c, 2);
      eyes(c, x - s * 0.1, y - s * 0.55, s * 0.25, s * 0.12, true);
      break;
    }
    case "skull": {
      c.beginPath();
      c.roundRect(x - s * 0.35, y - s * 0.75, s * 0.7, s * 0.75, s * 0.15);
      c.fillStyle = shade(color, -0.1);
      c.fill();
      stroke(c);
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(x - s * 0.3, y - s * (0.6 - i * 0.2));
        c.lineTo(x + s * 0.3, y - s * (0.6 - i * 0.2));
        stroke(c, 2);
      }
      c.beginPath();
      c.arc(x, y - s * 1.2, s * 0.6, 0, Math.PI * 2);
      c.fillStyle = blobFill(c, color, x, y - s * 1.2, s * 0.6);
      c.fill();
      stroke(c);
      for (const d of [-1, 1]) {
        c.beginPath();
        c.ellipse(x + d * s * 0.22, y - s * 1.22, s * 0.15, s * 0.18, 0, 0, Math.PI * 2);
        c.fillStyle = OUTLINE;
        c.fill();
        c.beginPath();
        c.arc(x + d * s * 0.22, y - s * 1.22, s * 0.05, 0, Math.PI * 2);
        c.fillStyle = "#ff5a5a";
        c.fill();
      }
      break;
    }
    case "imp": {
      c.beginPath();
      c.ellipse(x, y - s * 0.75, s * 0.75, s * 0.8, 0, 0, Math.PI * 2);
      c.fillStyle = blobFill(c, color, x, y - s * 0.75, s * 0.8);
      c.fill();
      stroke(c);
      for (const d of [-1, 1]) {
        c.beginPath();
        c.moveTo(x + d * s * 0.35, y - s * 1.4);
        c.quadraticCurveTo(x + d * s * 0.7, y - s * 1.9, x + d * s * 0.75, y - s * 1.7);
        c.lineTo(x + d * s * 0.55, y - s * 1.3);
        c.fillStyle = "#3d2b4f";
        c.fill();
        stroke(c, 2);
      }
      c.beginPath();
      c.moveTo(x + s * 0.7, y - s * 0.4);
      c.quadraticCurveTo(x + s * 1.3, y - s * 0.3, x + s * 1.2, y - s * 0.9);
      stroke(c, 3);
      eyes(c, x, y - s * 0.85, s * 0.25, s * 0.13, true);
      c.beginPath();
      c.arc(x, y - s * 0.5, s * 0.18, 0.1, Math.PI - 0.1);
      stroke(c, 2);
      break;
    }
    case "ghost": {
      const fy = Math.sin(t * 3) * s * 0.12;
      c.globalAlpha = 0.92;
      c.beginPath();
      c.moveTo(x - s * 0.8, y - s * 0.2 + fy);
      c.bezierCurveTo(x - s * 0.9, y - s * 1.9 + fy, x + s * 0.9, y - s * 1.9 + fy, x + s * 0.8, y - s * 0.2 + fy);
      for (let i = 0; i < 4; i++) {
        const xx = x + s * 0.8 - (i + 1) * s * 0.4;
        c.quadraticCurveTo(xx + s * 0.2, y + s * 0.1 + fy, xx, y - s * 0.2 + fy);
      }
      c.closePath();
      c.fillStyle = blobFill(c, color, x, y - s + fy, s);
      c.fill();
      stroke(c);
      c.globalAlpha = 1;
      eyes(c, x, y - s * 0.95 + fy, s * 0.25, s * 0.14, angry);
      break;
    }
    case "stump": {
      c.beginPath();
      c.roundRect(x - s * 0.8, y - s * 1.2, s * 1.6, s * 1.2, s * 0.2);
      c.fillStyle = blobFill(c, color, x, y - s * 0.6, s);
      c.fill();
      stroke(c);
      c.beginPath();
      c.ellipse(x, y - s * 1.2, s * 0.8, s * 0.25, 0, 0, Math.PI * 2);
      c.fillStyle = "#e8c48a";
      c.fill();
      stroke(c);
      c.beginPath();
      c.ellipse(x, y - s * 1.2, s * 0.4, s * 0.12, 0, 0, Math.PI * 2);
      stroke(c, 1.5);
      c.beginPath();
      c.moveTo(x - s * 0.9, y - s * 0.7);
      c.lineTo(x - s * 1.3, y - s * 1.0);
      stroke(c, 4);
      c.beginPath();
      c.arc(x - s * 1.3, y - s * 1.05, s * 0.15, 0, Math.PI * 2);
      c.fillStyle = "#5fbf4a";
      c.fill();
      stroke(c, 2);
      eyes(c, x, y - s * 0.65, s * 0.3, s * 0.14, angry);
      break;
    }
    case "cactus": {
      for (const d of [-1, 1]) {
        c.beginPath();
        c.roundRect(x + d * s * 0.55 - s * 0.18, y - s * (d < 0 ? 1.2 : 1.0), s * 0.36, s * 0.55, s * 0.18);
        c.fillStyle = color;
        c.fill();
        stroke(c);
      }
      c.beginPath();
      c.roundRect(x - s * 0.45, y - s * 1.6, s * 0.9, s * 1.6, s * 0.45);
      c.fillStyle = blobFill(c, color, x, y - s, s);
      c.fill();
      stroke(c);
      c.beginPath();
      c.arc(x, y - s * 1.65, s * 0.15, 0, Math.PI * 2);
      c.fillStyle = "#ff7eb6";
      c.fill();
      stroke(c, 2);
      eyes(c, x, y - s * 1.05, s * 0.2, s * 0.12, angry);
      break;
    }
    case "yeti": {
      c.beginPath();
      c.ellipse(x, y - s * 0.95, s * 1.0, s * 0.95, 0, 0, Math.PI * 2);
      c.fillStyle = blobFill(c, color, x, y - s, s);
      c.fill();
      stroke(c);
      c.beginPath();
      c.ellipse(x, y - s * 1.05, s * 0.55, s * 0.45, 0, 0, Math.PI * 2);
      c.fillStyle = "#8fb3d9";
      c.fill();
      stroke(c, 2);
      eyes(c, x, y - s * 1.15, s * 0.2, s * 0.11, true);
      c.beginPath();
      c.moveTo(x - s * 0.15, y - s * 0.85);
      c.lineTo(x - s * 0.08, y - s * 0.75);
      c.lineTo(x, y - s * 0.85);
      c.lineTo(x + s * 0.08, y - s * 0.75);
      c.lineTo(x + s * 0.15, y - s * 0.85);
      c.fillStyle = "#fff";
      c.fill();
      stroke(c, 1.5);
      break;
    }
    case "magma": {
      const glow = c.createRadialGradient(x, y - s * 0.7, 0, x, y - s * 0.7, s * 1.6);
      glow.addColorStop(0, "rgba(255,140,40,0.45)");
      glow.addColorStop(1, "rgba(255,140,40,0)");
      c.fillStyle = glow;
      c.fillRect(x - s * 2, y - s * 2.5, s * 4, s * 3);
      c.beginPath();
      c.moveTo(x - s, y);
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        const r = s * (1 + Math.sin(t * 6 + i * 1.7) * 0.08);
        c.lineTo(x + Math.cos(a) * r, y - s * 0.1 + Math.sin(a) * r * 1.1);
      }
      c.closePath();
      c.fillStyle = blobFill(c, color, x, y - s * 0.6, s);
      c.fill();
      stroke(c);
      eyes(c, x, y - s * 0.55, s * 0.3, s * 0.14, true);
      break;
    }
    case "eye": {
      const fy = y - s * 1.1 + Math.sin(t * 2.5) * s * 0.15;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(x - s * 0.4 + i * s * 0.27, fy + s * 0.5);
        c.quadraticCurveTo(x - s * 0.5 + i * s * 0.3 + Math.sin(t * 4 + i) * s * 0.2, fy + s, x - s * 0.4 + i * s * 0.27, fy + s * 1.1);
        c.strokeStyle = "#7a3d8f";
        c.lineWidth = 5;
        c.stroke();
      }
      c.beginPath();
      c.arc(x, fy, s * 0.75, 0, Math.PI * 2);
      c.fillStyle = blobFill(c, color, x, fy, s * 0.75);
      c.fill();
      stroke(c);
      c.beginPath();
      c.arc(x - s * 0.08, fy + s * 0.05, s * 0.35, 0, Math.PI * 2);
      c.fillStyle = "#c13cff";
      c.fill();
      stroke(c, 2);
      c.beginPath();
      c.ellipse(x - s * 0.08, fy + s * 0.05, s * 0.08, s * 0.25, 0, 0, Math.PI * 2);
      c.fillStyle = OUTLINE;
      c.fill();
      break;
    }
  }
  c.restore();
}

function mouth(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI);
  stroke(c, 2);
}

// ── Hero chibi. (x,y) = feet. lunge 0..1 = attack anim ──
export function drawHero(c: CanvasRenderingContext2D, job: JobDef, x: number, y: number, s: number, t: number, lunge: number, hurt: number) {
  const bob = Math.sin(t * 6) * s * 0.04;
  const lx = x + lunge * s * 0.6;
  shadow(c, x, y, s * 0.7);
  c.save();
  if (hurt > 0) c.filter = `brightness(${1 + hurt * 1.5})`;
  const by = y + bob;
  // legs
  for (const d of [-1, 1]) {
    c.beginPath();
    c.roundRect(lx + d * s * 0.2 - s * 0.12, by - s * 0.45, s * 0.24, s * 0.45, s * 0.1);
    c.fillStyle = "#3d3358";
    c.fill();
    stroke(c, 2.5);
  }
  // body
  c.beginPath();
  c.roundRect(lx - s * 0.42, by - s * 1.15, s * 0.84, s * 0.8, s * 0.25);
  c.fillStyle = blobFill(c, job.color, lx, by - s * 0.8, s * 0.6);
  c.fill();
  stroke(c);
  // belt
  c.fillStyle = "#ffd166";
  c.fillRect(lx - s * 0.42, by - s * 0.55, s * 0.84, s * 0.1);
  // cape for tier 2
  if (job.tier === 2) {
    c.beginPath();
    c.moveTo(lx - s * 0.35, by - s * 1.1);
    c.quadraticCurveTo(lx - s * 0.95 - Math.sin(t * 5) * s * 0.1, by - s * 0.6, lx - s * 0.7, by - s * 0.2);
    c.lineTo(lx - s * 0.3, by - s * 0.45);
    c.closePath();
    c.fillStyle = shade(job.color, -0.35);
    c.fill();
    stroke(c, 2.5);
  }
  // head
  const hy = by - s * 1.65;
  c.beginPath();
  c.arc(lx, hy, s * 0.62, 0, Math.PI * 2);
  c.fillStyle = blobFill(c, "#ffe0c2", lx, hy, s * 0.62);
  c.fill();
  stroke(c);
  // hair
  c.beginPath();
  c.arc(lx - s * 0.04, hy - s * 0.12, s * 0.6, Math.PI * 1.05, Math.PI * 2.0);
  c.quadraticCurveTo(lx + s * 0.35, hy - s * 0.1, lx + s * 0.1, hy - s * 0.25);
  c.quadraticCurveTo(lx - s * 0.2, hy - s * 0.05, lx - s * 0.55, hy - s * 0.05);
  c.closePath();
  c.fillStyle = job.tier === 0 ? "#8a5a3c" : shade(job.color, -0.45);
  c.fill();
  stroke(c, 2.5);
  // eyes
  for (const d of [-0.05, 0.3]) {
    c.beginPath();
    c.ellipse(lx + d * s, hy + s * 0.1, s * 0.08, s * 0.12, 0, 0, Math.PI * 2);
    c.fillStyle = OUTLINE;
    c.fill();
    c.beginPath();
    c.arc(lx + d * s - s * 0.02, hy + s * 0.06, s * 0.03, 0, Math.PI * 2);
    c.fillStyle = "#fff";
    c.fill();
  }
  // blush
  c.fillStyle = "rgba(255,120,120,0.45)";
  c.beginPath();
  c.ellipse(lx + s * 0.45, hy + s * 0.28, s * 0.09, s * 0.05, 0, 0, Math.PI * 2);
  c.fill();
  // weapon
  drawWeapon(c, job.weapon, job.color, lx + s * 0.5, by - s * 0.8, s, lunge);
  c.restore();
}

function drawWeapon(c: CanvasRenderingContext2D, w: JobDef["weapon"], color: string, x: number, y: number, s: number, lunge: number) {
  c.save();
  c.translate(x, y);
  c.rotate(-0.6 + lunge * 1.6);
  switch (w) {
    case "stick":
      c.beginPath();
      c.roundRect(-s * 0.06, -s * 0.9, s * 0.12, s * 0.95, s * 0.05);
      c.fillStyle = "#a0703c";
      c.fill();
      stroke(c, 2);
      break;
    case "sword":
    case "greatsword": {
      const L = w === "greatsword" ? 1.4 : 1.05;
      c.beginPath();
      c.moveTo(-s * 0.1, -s * 0.15);
      c.lineTo(-s * 0.1, -s * L);
      c.lineTo(0, -s * (L + 0.18));
      c.lineTo(s * 0.1, -s * L);
      c.lineTo(s * 0.1, -s * 0.15);
      c.closePath();
      c.fillStyle = "#e8f3ff";
      c.fill();
      stroke(c, 2);
      c.fillStyle = w === "greatsword" ? "#ffd166" : color;
      c.fillRect(-s * 0.25, -s * 0.2, s * 0.5, s * 0.1);
      c.strokeRect(-s * 0.25, -s * 0.2, s * 0.5, s * 0.1);
      break;
    }
    case "staff":
    case "orb":
      c.beginPath();
      c.roundRect(-s * 0.05, -s * 1.1, s * 0.1, s * 1.2, s * 0.05);
      c.fillStyle = "#7a4f2c";
      c.fill();
      stroke(c, 2);
      c.beginPath();
      c.arc(0, -s * 1.2, s * (w === "orb" ? 0.24 : 0.17), 0, Math.PI * 2);
      c.fillStyle = blobFill(c, w === "orb" ? "#5ad1ff" : "#b07cff", 0, -s * 1.2, s * 0.22);
      c.shadowColor = color;
      c.shadowBlur = 14;
      c.fill();
      c.shadowBlur = 0;
      stroke(c, 2);
      break;
    case "bow":
    case "longbow": {
      const L = w === "longbow" ? 0.85 : 0.65;
      c.beginPath();
      c.arc(0, -s * 0.4, s * L, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9);
      c.strokeStyle = "#7a4f2c";
      c.lineWidth = 5;
      c.stroke();
      c.beginPath();
      c.moveTo(Math.cos(-Math.PI / 2 - 0.9) * s * L, -s * 0.4 + Math.sin(-Math.PI / 2 - 0.9) * s * L);
      c.lineTo(Math.cos(-Math.PI / 2 + 0.9) * s * L, -s * 0.4 + Math.sin(-Math.PI / 2 + 0.9) * s * L);
      c.strokeStyle = "#fff";
      c.lineWidth = 1.5;
      c.stroke();
      break;
    }
  }
  c.restore();
}

// Kuro: black cat buddy. Float behind hero. (mascot, original)
export function drawKuro(c: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  const fy = y + Math.sin(t * 2.2) * s * 0.15;
  c.beginPath();
  c.moveTo(x - s * 0.5, fy + s * 0.2);
  c.quadraticCurveTo(x - s * 1.1, fy + s * 0.1 + Math.sin(t * 4) * s * 0.2, x - s * 1.0, fy - s * 0.5);
  stroke(c, 4);
  c.beginPath();
  c.ellipse(x, fy, s * 0.55, s * 0.45, 0, 0, Math.PI * 2);
  c.fillStyle = "#2e2440";
  c.fill();
  stroke(c, 2.5);
  for (const d of [-1, 1]) {
    c.beginPath();
    c.moveTo(x + d * s * 0.15, fy - s * 0.35);
    c.lineTo(x + d * s * 0.45, fy - s * 0.75);
    c.lineTo(x + d * s * 0.5, fy - s * 0.2);
    c.fillStyle = "#2e2440";
    c.fill();
    stroke(c, 2);
  }
  for (const d of [-1, 1]) {
    c.beginPath();
    c.ellipse(x + d * s * 0.2, fy - s * 0.02, s * 0.1, s * 0.13, 0, 0, Math.PI * 2);
    c.fillStyle = "#ffe066";
    c.fill();
    c.beginPath();
    c.ellipse(x + d * s * 0.2, fy - s * 0.02, s * 0.03, s * 0.1, 0, 0, Math.PI * 2);
    c.fillStyle = OUTLINE;
    c.fill();
  }
}
