// Sprite urls from src/assets/art (cut by scripts/cut-art.mjs). Vite hash + base path.
const files = import.meta.glob("../assets/art/*.webp", { eager: true, import: "default" }) as Record<string, string>;

export const ART: Record<string, string> = {};
for (const [p, url] of Object.entries(files)) ART[p.slice(p.lastIndexOf("/") + 1, -5)] = url;

export const art = (name: string): string | undefined => ART[name];

// canvas: load once, draw when ready
const imgs = new Map<string, HTMLImageElement>();
export function artImg(name: string): HTMLImageElement | null {
  let im = imgs.get(name);
  if (!im) {
    const url = ART[name];
    if (!url || typeof Image === "undefined") return null;
    im = new Image();
    im.src = url;
    imgs.set(name, im);
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}

// warm cache so first skill no blank frame
export function preloadArt(prefix: string) {
  for (const k of Object.keys(ART)) if (k.startsWith(prefix)) artImg(k);
}
