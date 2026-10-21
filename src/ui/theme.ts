import type { Rarity } from "../config/balance";

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#c9d1d9",
  uncommon: "#5fe07a",
  rare: "#4aa8ff",
  epic: "#b26bff",
  legendary: "#ffb020",
  mythic: "#ff4d6d",
};

export const RARITY_GLOW: Record<Rarity, string> = {
  common: "rgba(201,209,217,0.0)",
  uncommon: "rgba(95,224,122,0.35)",
  rare: "rgba(74,168,255,0.45)",
  epic: "rgba(178,107,255,0.55)",
  legendary: "rgba(255,176,32,0.65)",
  mythic: "rgba(255,77,109,0.75)",
};
