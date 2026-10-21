// Cut review atlases in art/ into small game sprites in src/assets/art/.
// Run: node scripts/cut-art.mjs   (needs devDependency sharp)
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const SRC = "art/2026-10-21-v1";
const OUT = "src/assets/art";
mkdirSync(OUT, { recursive: true });

// raw RGBA of whole sheet
async function load(file) {
  const { data, info } = await sharp(join(SRC, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

// copy region → new raw image
function crop(img, x0, y0, cw, ch) {
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const sy = Math.min(img.h - 1, y0 + y);
    img.data.copy(out, y * cw * 4, (sy * img.w + x0) * 4, (sy * img.w + x0 + cw) * 4);
  }
  return { data: out, w: cw, h: ch };
}

// soft glow → kill. alpha under cut = 0, rest keep.
function alphaCut(img, cut) {
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < cut) img.data[i] = 0;
}

// flat bg (cream sheet) → transparent. flood from border, stop at outline.
function floodBg(img, tol = 40) {
  const { data, w, h } = img;
  const br = data[0], bg = data[1], bb = data[2];
  const seen = new Uint8Array(w * h);
  const st = [];
  for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  while (st.length) {
    const p = st.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb) > tol) continue;
    data[i + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) st.push(p - 1);
    if (x < w - 1) st.push(p + 1);
    if (y > 0) st.push(p - w);
    if (y < h - 1) st.push(p + w);
  }
}

function bbox(img, a = 8) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (img.data[(y * img.w + x) * 4 + 3] > a) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

// trim, square pad, resize, save webp
async function save(img, name, size, pad = 0.04) {
  const b = bbox(img);
  if (!b) throw new Error("empty " + name);
  const t = crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
  const side = Math.ceil(Math.max(t.w, t.h) * (1 + pad * 2));
  const sq = await sharp(t.data, { raw: { width: t.w, height: t.h, channels: 4 } })
    .extend({
      top: Math.floor((side - t.h) / 2), bottom: Math.ceil((side - t.h) / 2),
      left: Math.floor((side - t.w) / 2), right: Math.ceil((side - t.w) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  await sharp(sq)
    .resize(size, size, { kernel: "lanczos3" })
    .webp({ quality: 88, alphaQuality: 90 })
    .toFile(join(OUT, name + ".webp"));
}

// label connected blobs (alpha > cut). each blob go to cell of its center.
// neighbor leak bits → belong other cell → not copied.
function blobs(img, cut) {
  const { data, w, h } = img;
  const lab = new Int32Array(w * h).fill(-1);
  const out = [];
  const st = [];
  for (let p0 = 0; p0 < w * h; p0++) {
    if (lab[p0] >= 0 || data[p0 * 4 + 3] <= cut) continue;
    const id = out.length;
    const b = { id, n: 0, sx: 0, sy: 0, x0: w, y0: h, x1: 0, y1: 0 };
    st.push(p0);
    lab[p0] = id;
    while (st.length) {
      const p = st.pop();
      const x = p % w, y = (p / w) | 0;
      b.n++; b.sx += x; b.sy += y;
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && lab[q] < 0 && data[q * 4 + 3] > cut) { lab[q] = id; st.push(q); }
      }
    }
    out.push(b);
  }
  return { lab, list: out };
}

// cut sheet by grid of cells; keep only blobs whose center in cell
async function sheet(img, cols, rows, names, size, cut, box = { x: 0, y: 0, w: img.w, h: img.h }) {
  const { lab, list } = blobs(img, cut);
  const cw = box.w / cols, ch = box.h / rows;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const n = names[r * cols + c];
      if (!n) continue;
      const mine = new Set();
      let x0 = img.w, y0 = img.h, x1 = 0, y1 = 0;
      for (const b of list) {
        if (b.n < 30) continue;
        const cx = b.sx / b.n - box.x, cy = b.sy / b.n - box.y;
        if (Math.floor(cx / cw) !== c || Math.floor(cy / ch) !== r || cy < 0 || cy >= box.h) continue;
        mine.add(b.id);
        x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
      }
      if (!mine.size) throw new Error("empty " + n);
      const t = crop(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
      for (let y = 0; y < t.h; y++)
        for (let x = 0; x < t.w; x++)
          if (!mine.has(lab[(y0 + y) * img.w + x0 + x])) t.data[(y * t.w + x) * 4 + 3] = 0;
      await save(t, n, size);
    }
}

async function grid(file, cols, rows, names, size, cut = 100) {
  await sheet(await load(file), cols, rows, names, size, cut);
}

await grid("round-1/03-system-icons.png", 6, 4, [
  "i-daily", "i-quest", "i-tower", "i-corrupt", "i-rebirth", "i-settings",
  "i-trophy", "i-job", "i-gold", null, "i-gem", "i-fish",
  "i-refine", "i-shard", "i-charm-x", "i-sword", "i-staff", "i-bow",
  "i-armor", null, null, "i-heart", "i-mana", "i-time",
], 96);

await grid("round-1/05-utility-and-equipment-icons.png", 6, 4, [
  "i-book", "i-chat", "i-lock", "i-unlock", "i-helm", "i-ring",
  "i-charm", "i-video", "i-speed", "i-vip", null, "i-gift",
  "i-chest", "i-up", "i-forge", "i-recycle", "i-trash", "i-search",
  "i-sound", "i-mute", "i-vibrate", "i-cloud", "i-alert", "i-check",
], 96);

await grid("round-1/04-specialization-icons.png", 3, 2, [
  "spec-guardian", "spec-judicator", "spec-cataclysm",
  "spec-flow", "spec-barrage", "spec-marksman",
], 128);

await grid("round-3/03-eight-achievement-badges.png", 4, 2, [
  "badge-boss", "badge-feed", "badge-job", "badge-claw",
  "badge-tower1", "badge-tower5", "badge-tower10", "badge-rebirth",
], 128);

// fx: keep some glow (lower cut) — drawn additive on canvas
await grid("round-2/03-vfx-atlas.png", 4, 3, [
  "fx-shield", "fx-spark", "fx-slash", "fx-ray",
  "fx-orb", "fx-meteor", "fx-spiral", "fx-ring",
  "fx-arrow", "fx-arrows", "fx-claw", "fx-promote",
], 192, 40);

await grid("round-2/01-kuro-six-states.png", 3, 2, [
  "kuro-sleep", "kuro-pat", "kuro-happy",
  "kuro-meh", "kuro-attack", "kuro-eat",
], 160, 120);

// nav icons: bottom strip on cream, flood bg away
{
  const img = await load("round-1/02-menu-bar-states.png");
  const strip = crop(img, 0, 790, img.w, 155);
  floodBg(strip);
  await sheet(strip, 5, 1, ["nav-battle", "nav-hero", "nav-train", "nav-kuro", "nav-shop"], 96, 100, { x: 130, y: 0, w: 1290, h: 155 });
}

// tower bg: wide, opaque
await sharp(join(SRC, "round-3/01-tower-battle-background.png"))
  .resize(1200)
  .webp({ quality: 82 })
  .toFile(join(OUT, "bg-tower.webp"));

console.log("done");
