// Story text (zh-HK). Funny, light. All told by Kuro (lazy, greedy, proud cat).
// Running joke: why cat can talk? Truth reveal slow by memory fragment:
// Kuro was hero long ago, too lazy, Abyss Lord curse him → cat. He kinda like it.

export type Speaker = "kuro" | "hero" | "lord" | "narr";
export interface Line { who: Speaker; text: string; }

export interface ChapterStory {
  title: string;
  intro: Line[];
  boss: string; // Kuro shout when chapter boss come
}

// index 0 = chapter 1 (meadow) … 7 = chapter 8 (abyss). Match BIOMES order.
export const CHAPTERS: ChapterStory[] = [
  {
    title: "貓識講嘢好正常",
    intro: [
      { who: "narr", text: "微風草原。新手勇者執起木劍，準備拯救世界。" },
      { who: "kuro", text: "喂。你個劍拎反咗。" },
      { who: "hero", text: "隻…隻貓識講嘢？！" },
      { who: "kuro", text: "你識講嘢我都冇大驚小怪啦。" },
      { who: "kuro", text: "聽住：你打怪，我幫手抓。人工係魚乾，Boss 身上有。" },
      { who: "hero", text: "點解要我請你？" },
      { who: "kuro", text: "因為我可愛。成交。" },
    ],
    boss: "大隻佬嚟喇！你頂住，我…喺後面打氣！",
  },
  {
    title: "迷路專家",
    intro: [
      { who: "narr", text: "迷霧森林。霧大到睇唔到自己對腳。" },
      { who: "hero", text: "Kuro，你識路？" },
      { who: "kuro", text: "梗係識。跟住我。" },
      { who: "narr", text: "三個鐘之後，佢哋第四次經過同一棵樹。" },
      { who: "kuro", text: "……呢棵樹好靚，所以我想你多睇幾次。" },
    ],
    boss: "森林守衛！佢搶咗我啲魚乾！（冇，但係打佢先）",
  },
  {
    title: "撞樣石像",
    intro: [
      { who: "narr", text: "黃沙遺跡。沙入面企住一座古代勇者石像。" },
      { who: "hero", text: "咦？石像條頸掛住個鈴，同你個一模一樣喎。" },
      { who: "kuro", text: "撞樣啫。呢款鈴喺夜市十蚊三個。" },
      { who: "hero", text: "石像個樣仲好似好懶咁…" },
      { who: "kuro", text: "唔好亂講！佢唔係懶，佢係戰略性休息！" },
      { who: "hero", text: "…你做咩咁激動？" },
    ],
    boss: "沙漠之王！抓花佢塊面，當幫石像報仇！…我意思係隨便報下。",
  },
  {
    title: "貓怕凍",
    intro: [
      { who: "kuro", text: "凍死貓喇！！邊個揀行冰晶峽谷架？！" },
      { who: "hero", text: "你自己話抄近路。" },
      { who: "kuro", text: "我唔記得。我凍到腦都結冰。" },
      { who: "narr", text: "Kuro 鑽入勇者件盔甲入面，之後拒絕出嚟。" },
      { who: "hero", text: "你咁樣我點打？" },
      { who: "kuro", text: "用心打。" },
    ],
    boss: "雪怪！佢好暖咁…不如唔打佢，抱住佢？…唔得？好啦抓佢。",
  },
  {
    title: "熟客",
    intro: [
      { who: "narr", text: "熔岩火山。一班小惡魔見到 Kuro，即刻跪低。" },
      { who: "hero", text: "佢哋…驚你？" },
      { who: "kuro", text: "上次嚟我食晒佢哋啲燒魚，冇俾錢。" },
      { who: "hero", text: "上次？！你嚟過？" },
      { who: "kuro", text: "……專心打怪。" },
    ],
    boss: "火山之心！佢係嚟收數㗎…快啲打低佢！",
  },
  {
    title: "畫像入面嘅肥貓",
    intro: [
      { who: "narr", text: "幽暗古堡。大廳掛住深淵之主嘅畫像，佢膝頭坐住隻黑貓。" },
      { who: "hero", text: "Kuro！你係魔王隻寵物？！" },
      { who: "kuro", text: "唔係！…嗰隻肥好多。我係骨感型。" },
      { who: "hero", text: "畫像右下角寫住「Kuro，三歲」。" },
      { who: "kuro", text: "……同名同姓。好普遍。" },
    ],
    boss: "城主！佢以前日日掃我個頭…其實幾舒服。但係都要打。",
  },
  {
    title: "許願唔該",
    intro: [
      { who: "narr", text: "星落之海。天上啲流星一粒粒跌落嚟。" },
      { who: "hero", text: "快！許願！" },
      { who: "kuro", text: "我要一世食唔晒嘅魚乾。仲有冇人叫我起身。" },
      { who: "hero", text: "我想拯救世界。" },
      { who: "kuro", text: "…你個願好攰。換一個啦。" },
    ],
    boss: "星之守門人！最後一道門，打開佢！入面應該有魚乾。應該。",
  },
  {
    title: "老朋友",
    intro: [
      { who: "lord", text: "哈哈哈！勇者，你終於嚟到——咦？Kuro？" },
      { who: "kuro", text: "嗨。好耐冇見。" },
      { who: "lord", text: "你仲未減肥？" },
      { who: "kuro", text: "你仲未剪頭髮？" },
      { who: "hero", text: "你哋…識㗎？" },
      { who: "kuro", text: "前同事。勇者，抓…我意思係，打佢！" },
    ],
    boss: "深淵之主！佢欠我三年魚乾！今日連本帶利！",
  },
];

// After chapter 8, world loop. Same biome, darker. Kuro getting used to it.
export const LOOP_INTROS: string[] = [
  "又返嚟草原？我覺得我哋係行緊環迴線。",
  "迷霧森林。今次我記得路——左邊。…唔係，右邊。",
  "石像今次塊面好似黑咗啲…邊個喺佢面上畫咗鬚？…唔係我。",
  "又係冰。我已經放棄抗議，我直接瞓喺你頭盔入面。",
  "小惡魔今次冇跪。佢哋話我上次都冇俾錢。",
  "畫像入面隻貓今次瘦咗。睇嚟佢都有做運動。",
  "流星少咗。可能係大家都許咗『唔使返工』呢個願。",
  "深淵之主今次一見我就收埋晒啲魚乾。小器。",
];

export interface Fragment { title: string; lines: Line[]; }

// Unlock 1 per rebirth. Reveal Kuro past slow, keep it funny.
export const FRAGMENTS: Fragment[] = [
  {
    title: "記憶碎片 I · 休息一陣先",
    lines: [
      { who: "narr", text: "好耐以前，有個勇者打到深淵門口。" },
      { who: "narr", text: "佢坐低，話：「休息五分鐘先。」" },
      { who: "narr", text: "三百年後，佢仲喺度休息緊。" },
    ],
  },
  {
    title: "記憶碎片 II · 詛咒",
    lines: [
      { who: "lord", text: "你咁鍾意瞓，就做隻貓啦！一日瞓十六個鐘！" },
      { who: "narr", text: "勇者變咗黑貓。" },
      { who: "kuro", text: "…其實呢個詛咒幾好喎。" },
      { who: "lord", text: "唔係咁㗎！！" },
    ],
  },
  {
    title: "記憶碎片 III · 鈴鐺",
    lines: [
      { who: "narr", text: "黑貓頸上個鈴，刻住佢原本個名。" },
      { who: "narr", text: "字已經被佢自己舔到睇唔清。" },
      { who: "kuro", text: "好味嘛。" },
    ],
  },
  {
    title: "記憶碎片 IV · 面試官",
    lines: [
      { who: "narr", text: "每次世界重來，黑貓都會揀一個新勇者。" },
      { who: "kuro", text: "第一個太嘈。第二個唔俾魚乾。第三個對貓毛敏感。" },
      { who: "kuro", text: "揀咗二百幾個，先揀到你。你應該覺得榮幸。" },
    ],
  },
  {
    title: "記憶碎片 V · 熄機之後",
    lines: [
      { who: "kuro", text: "你知唔知，你熄咗機嗰陣，係我幫你打晒啲怪？" },
      { who: "hero", text: "真㗎？好感動…" },
      { who: "kuro", text: "所以啲魚乾全部歸我。" },
    ],
  },
  {
    title: "記憶碎片 VI · 腐化之約",
    lines: [
      { who: "narr", text: "腐化之約嘅真相：黑貓同深淵借力量。" },
      { who: "kuro", text: "利息好貴。我而家仲欠緊佢四萬條魚乾。" },
      { who: "kuro", text: "所以你要努力打 Boss。為咗我。" },
    ],
  },
  {
    title: "記憶碎片 VII · 真名",
    lines: [
      { who: "narr", text: "鈴鐺上嘅字，終於睇得清。" },
      { who: "narr", text: "「黑騎士・暗夜之刃・亞瑟三世」" },
      { who: "hero", text: "嘩，好型！" },
      { who: "kuro", text: "太長。叫 Kuro 得喇。" },
    ],
  },
  {
    title: "記憶碎片 VIII · 承諾",
    lines: [
      { who: "kuro", text: "勇者。多謝你一直陪我。" },
      { who: "hero", text: "Kuro……" },
      { who: "kuro", text: "今次我哋一齊行到盡頭。之後你請我食一年魚乾。" },
      { who: "narr", text: "（未完待續）" },
    ],
  },
];

// Short bubble line on battle screen.
export const BARKS = {
  idle: [
    "喵～", "好想食魚乾…", "我唔係懶，我係慳電。", "我瞓陣先，有事唔好叫我。", "呢度啲怪好臭。",
    "記得摸下我。", "加油！我精神上支持你。", "嗅到 Boss 味…定係你對襪？", "你打，我睇。好公平。",
    "今日都係努力嘅一日（你）。",
  ],
  levelUp: ["升級喇！請食魚乾慶祝？", "強咗少少。少少。", "唔錯唔錯，有我一半咁勁。"],
  heroDown: ["退一步海闊天空。", "唔緊要，我都成日跌。", "痛唔痛？唔痛就繼續。"],
  bossWin: ["贏喇！魚乾！魚乾！", "抓得好爽！", "我功勞大啲。"],
  bigLoot: ["發達喇！分我一半。", "嘩，閃閃亮！", "呢件好襯我。"],
  strike: ["抓！", "喵嗚！", "貓爪！", "睇我嘅！", "收工前最後一爪！"],
};

export const SPEAKER_NAME: Record<Speaker, string> = { kuro: "Kuro", hero: "勇者", lord: "深淵之主", narr: "" };
