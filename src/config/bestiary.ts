import type { FamilyId } from "./content";

// Kill count per tier. Tier 1 come fast (discover), tier 4 = long chase.
export const BESTIARY_TIERS = [50, 500, 5000, 50000] as const;

export type BestiaryStat = "atkPct" | "hpPct" | "goldPct" | "expPct" | "crit" | "critDmg" | "aps" | "def";

// Each family give one stat, same amount each tier. Keep small: all max ≈ +40% power-ish.
export const BESTIARY: Record<FamilyId, { name: string; stat: BestiaryStat; perTier: number; note: string }> = {
  jelly:    { name: "啫喱史萊姆", stat: "hpPct",   perTier: 0.03,  note: "軟綿綿，打唔死就慢慢郁。" },
  mushling: { name: "菇菇仔",     stat: "atkPct",  perTier: 0.03,  note: "頭頂個菇係真菇，唔好食。" },
  bat:      { name: "夜蝠",       stat: "aps",     perTier: 0.02,  note: "飛得好快，但成日撞牆。" },
  pebble:   { name: "石頭仔",     stat: "def",     perTier: 0.01,  note: "鍾意扮石頭。其實佢就係石頭。" },
  bonelet:  { name: "骨骨",       stat: "critDmg", perTier: 0.05,  note: "冇肉，但好有骨氣。" },
  imp:      { name: "小惡魔",     stat: "atkPct",  perTier: 0.03,  note: "仲記得 Kuro 欠佢燒魚錢。" },
  wisp:     { name: "幽光",       stat: "expPct",  perTier: 0.04,  note: "識發光，晚上唔使開燈。" },
  stumpy:   { name: "樹樁怪",     stat: "goldPct", perTier: 0.04,  note: "年輪入面收埋私房錢。" },
  cactus:   { name: "仙人掌兵",   stat: "crit",    perTier: 0.01,  note: "唔好攬佢。Kuro 試過。" },
  yeti:     { name: "雪寶",       stat: "hpPct",   perTier: 0.03,  note: "好暖。Kuro 想攬佢。" },
  magma:    { name: "熔岩怪",     stat: "atkPct",  perTier: 0.03,  note: "可以用嚟燒魚。" },
  eyeball:  { name: "大眼仔",     stat: "goldPct", perTier: 0.04,  note: "一直望住你。好尷尬。" },
};

export const BESTIARY_STAT_NAME: Record<BestiaryStat, string> = {
  atkPct: "攻擊", hpPct: "生命", goldPct: "金幣", expPct: "經驗",
  crit: "暴擊率", critDmg: "暴擊傷害", aps: "攻速", def: "減傷",
};
