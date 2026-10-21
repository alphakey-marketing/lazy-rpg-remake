import { useState } from "react";
import {
  CORRUPTION, DAILY_ALL_CLAIMED_BONUS, DAILY_QUESTS, GEM_SHOP, LOGIN_REWARDS, PerkId, RARITIES, Rarity, REBIRTH, REBIRTH_PERKS, TRAINING, TrainingId,
} from "../../config/balance";
import {
  adGemsLeft, buyCharm, buyPerk, buyTraining, canRebirth, claimDaily, claimDailyBonus, claimLogin, corruptionUnlocked, grantAdGems,
  perkCost, rebirth, rebirthShards, setAutoSalvage, setCorruption, timeWarp, trainingBulkCost,
} from "../../core/actions";
import { dayKey } from "../../core/daily";
import { fmt, fmtDuration } from "../../core/format";
import { trainingCost, trainingMaxed } from "../../core/formulas";
import { applyOfflineDouble, offlineCapSeconds } from "../../core/offline";
import type { OfflineSummary } from "../../core/types";
import { ads } from "../../services/ads";
import { buzz, sfx } from "../../services/feedback";
import { store, useGame } from "../store";
import { RARITY_COLOR } from "../theme";
import { CORRUPTION_NAME, PERK_NAME, QUEST_NAME, RARITY_NAME, TRAIN_NAME } from "../names";
import { Amount, Bar, Btn, CurIcon, Modal, Sheet } from "./common";
import { toast } from "./Toasts";

// ── Training ─────────────────────────────────────────────────────────
export function TrainPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [mult, setMult] = useState<1 | 10 | "max">(1);
  return (
    <Sheet title="訓練場" onClose={onClose}>
      <div className="seg">
        {([1, 10, "max"] as const).map((m) => (
          <button key={m} className={mult === m ? "on" : ""} onClick={() => setMult(m)}>{m === "max" ? "最大" : "×" + m}</button>
        ))}
      </div>
      {(Object.keys(TRAINING) as TrainingId[]).map((id) => {
        const lvl = s.training[id];
        const maxed = trainingMaxed(id, lvl);
        const cost = mult === "max" ? trainingCost(id, lvl) : trainingBulkCost(s, id, mult);
        const ok = !maxed && s.gold >= cost;
        const def = TRAIN_NAME[id];
        return (
          <div key={id} className="row-card">
            <div className="rc-icon">{def.icon}</div>
            <div className="rc-main">
              <div className="rc-title">{def.name} <span className="lv">Lv.{lvl}{TRAINING[id].max !== Infinity ? `/${TRAINING[id].max}` : ""}</span></div>
              <div className="rc-desc">{def.desc(lvl)}</div>
              {(id === "atk" || id === "hp") && <Bar k={(lvl % 25) / 25} color="#ffd23f" h={6} />}
            </div>
            <Btn color={ok ? "green" : "gray"} disabled={!ok} onClick={() => {
              const n = store.act((g) => buyTraining(g, id, mult));
              if (n > 0) { sfx.coin(); if (Math.floor(lvl / 25) !== Math.floor((lvl + n) / 25) && (id === "atk" || id === "hp")) { sfx.levelUp(); toast("訓練突破！×1.3", "#ffd23f"); } }
            }}>
              {maxed ? "MAX" : <Amount c="gold" n={cost} />}
            </Btn>
          </div>
        );
      })}
    </Sheet>
  );
}

// ── Rebirth ─────────────────────────────────────────────────────────
export function RebirthPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const gain = rebirthShards(s);
  const ok = canRebirth(s);
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet title="靈魂轉生" onClose={onClose} tall>
      <div className="rebirth-hero">
        <div className="rb-shards"><CurIcon c="shard" size={30} /> {fmt(s.shards)}</div>
        <div className="rb-text">
          {ok ? <>而家轉生可獲得 <b className="hl">{fmt(gain)}</b> 靈魂碎片</> : <>到達第 {REBIRTH.unlockStage} 關解鎖轉生（最高：{s.maxStage}）</>}
        </div>
        <div className="rb-note">重置：等級、關卡、裝備、訓練、職業、金幣<br />保留：寶石、碎片、天賦、{Math.round(REBIRTH.keepStonesFraction * 100)}% 精煉石</div>
        {!confirm ? (
          <Btn wide color={ok ? "purple" : "gray"} disabled={!ok} dot={ok && gain >= 50} onClick={() => setConfirm(true)}>轉生</Btn>
        ) : (
          <div className="confirm-row">
            <Btn color="gray" onClick={() => setConfirm(false)}>取消</Btn>
            <Btn color="purple" onClick={() => {
              const g = store.act((st) => rebirth(st, Date.now()));
              sfx.win(); buzz(80);
              toast(`轉生成功！+${fmt(g)} 碎片`, "#b98cff");
              setConfirm(false);
            }}>確定轉生</Btn>
          </div>
        )}
      </div>
      <div className="sec-title">靈魂天賦（永久）</div>
      {(Object.keys(REBIRTH_PERKS) as PerkId[]).map((id) => {
        const p = REBIRTH_PERKS[id];
        const lvl = s.perks[id];
        const maxed = lvl >= p.max;
        const cost = perkCost(s, id);
        const can = !maxed && s.shards >= cost;
        return (
          <div key={id} className="row-card">
            <div className="rc-icon">{PERK_NAME[id].icon}</div>
            <div className="rc-main">
              <div className="rc-title">{PERK_NAME[id].name} <span className="lv">Lv.{lvl}</span></div>
              <div className="rc-desc">{PERK_NAME[id].desc}</div>
            </div>
            <Btn color={can ? "purple" : "gray"} disabled={!can} onClick={() => { store.act((g) => buyPerk(g, id)); sfx.coin(); }}>
              {maxed ? "MAX" : <Amount c="shard" n={cost} />}
            </Btn>
          </div>
        );
      })}
    </Sheet>
  );
}

// ── Shop ────────────────────────────────────────────────────────────
export function ShopPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [busy, setBusy] = useState(false);
  const left = adGemsLeft(s, Date.now());
  return (
    <Sheet title="商店" onClose={onClose}>
      <div className="shop-grid">
        <div className="shop-card">
          <div className="sc-icon">📺</div>
          <div className="sc-name">免費寶石</div>
          <div className="sc-desc">睇廣告 +{GEM_SHOP.adGems}（今日剩 {left}）</div>
          <Btn color="orange" disabled={busy || left <= 0} dot={left > 0} onClick={async () => {
            setBusy(true);
            const ok = await ads.show("freeGems");
            setBusy(false);
            if (ok && store.act((g) => grantAdGems(g, Date.now()))) { sfx.coin(); toast(`+${GEM_SHOP.adGems} 寶石`, "#ff5ec4"); }
          }}>{busy ? "播放中…" : "觀看"}</Btn>
        </div>
        <div className="shop-card">
          <div className="sc-icon">⏩</div>
          <div className="sc-name">時光沙漏</div>
          <div className="sc-desc">即刻獲得 {GEM_SHOP.timeWarpHours} 小時金幣</div>
          <Btn color="blue" disabled={s.gems < GEM_SHOP.timeWarpCost} onClick={() => {
            const g = store.act((st) => timeWarp(st));
            if (g > 0) { sfx.coin(); toast(`+${fmt(g)} 金幣`, "#ffd23f"); }
          }}><Amount c="gem" n={GEM_SHOP.timeWarpCost} /></Btn>
        </div>
        <div className="shop-card">
          <div className="sc-icon"><CurIcon c="charm" size={40} /></div>
          <div className="sc-name">守護符</div>
          <div className="sc-desc">精煉失敗唔跌級（擁有 {s.protectCharms}）</div>
          <Btn color="blue" disabled={s.gems < GEM_SHOP.charmCost} onClick={() => { if (store.act((g) => buyCharm(g))) sfx.coin(); }}>
            <Amount c="gem" n={GEM_SHOP.charmCost} />
          </Btn>
        </div>
        <div className="shop-card premium">
          <div className="sc-icon">👑</div>
          <div className="sc-name">月卡</div>
          <div className="sc-desc">每日 100 寶石 + 離線 ×1.5</div>
          <Btn color="gold" disabled>即將推出</Btn>
        </div>
        <div className="shop-card premium">
          <div className="sc-icon">🚫</div>
          <div className="sc-name">去除廣告</div>
          <div className="sc-desc">廣告獎勵直接領取</div>
          <Btn color="gold" disabled>即將推出</Btn>
        </div>
        <div className="shop-card premium">
          <div className="sc-icon">🎁</div>
          <div className="sc-name">新手禮包</div>
          <div className="sc-desc">500 寶石 + 5 守護符</div>
          <Btn color="gold" disabled>即將推出</Btn>
        </div>
      </div>
    </Sheet>
  );
}

// ── Daily quest ─────────────────────────────────────────────────────
export function DailyPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const allClaimed = DAILY_QUESTS.every((q) => s.daily.claimed[q.id]);
  return (
    <Sheet title="每日任務" onClose={onClose}>
      {DAILY_QUESTS.map((q) => {
        const p = s.daily.progress[q.id] ?? 0;
        const done = p >= q.target;
        const claimed = s.daily.claimed[q.id];
        return (
          <div key={q.id} className={`row-card ${claimed ? "dim" : ""}`}>
            <div className="rc-main">
              <div className="rc-title">{QUEST_NAME[q.id](q.target)}</div>
              <Bar k={p / q.target} color="#5fe07a" h={12} label={`${p}/${q.target}`} />
              <div className="rc-reward"><Amount c="gem" n={q.gems} size={14} /> <Amount c="stone" n={q.stones} size={14} /></div>
            </div>
            <Btn color={claimed ? "gray" : done ? "orange" : "gray"} disabled={claimed || !done} dot={done && !claimed} onClick={() => {
              store.act((g) => claimDaily(g, q.id, Date.now()));
              sfx.coin();
            }}>{claimed ? "已領" : "領取"}</Btn>
          </div>
        );
      })}
      <div className="row-card bonus">
        <div className="rc-main">
          <div className="rc-title">🏆 完成全部任務</div>
          <div className="rc-reward"><Amount c="gem" n={DAILY_ALL_CLAIMED_BONUS.gems} /></div>
        </div>
        <Btn color={allClaimed && !s.daily.bonusClaimed ? "gold" : "gray"} disabled={!allClaimed || s.daily.bonusClaimed}
          dot={allClaimed && !s.daily.bonusClaimed}
          onClick={() => { store.act((g) => claimDailyBonus(g, Date.now())); sfx.win(); }}>
          {s.daily.bonusClaimed ? "已領" : "領取"}
        </Btn>
      </div>
      <div className="hint">每日午夜重置</div>
    </Sheet>
  );
}

// ── 7-day login ─────────────────────────────────────────────────────
export function LoginPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const can = s.login.lastClaimDayKey !== dayKey(Date.now());
  return (
    <Sheet title="7 日簽到" onClose={onClose}>
      <div className="login-grid">
        {LOGIN_REWARDS.map((r, i) => {
          const claimed = i < s.login.streakIndex || (!can && i === s.login.streakIndex - 1);
          const today = can && i === s.login.streakIndex;
          return (
            <div key={i} className={`login-day ${claimed ? "claimed" : ""} ${today ? "today" : ""} ${i === 6 ? "big" : ""}`}>
              <div className="ld-n">第 {i + 1} 日</div>
              <div className="ld-r">
                {"gems" in r && <Amount c="gem" n={r.gems} size={22} />}
                {"stones" in r && <Amount c="stone" n={r.stones} size={22} />}
                {"goldHours" in r && <span className="amount"><CurIcon c="gold" size={22} />{r.goldHours}h</span>}
              </div>
              {claimed && <div className="ld-check">✔</div>}
            </div>
          );
        })}
      </div>
      <Btn wide color={can ? "orange" : "gray"} disabled={!can} dot={can} onClick={() => {
        const r = store.act((g) => claimLogin(g, Date.now()));
        if (r) { sfx.win(); toast("簽到成功！", "#ffd23f"); }
      }}>{can ? "簽到" : "聽日再嚟"}</Btn>
    </Sheet>
  );
}

// ── Corruption (Kuro dark pact) ─────────────────────────────────────
export function CorruptionPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const unlocked = corruptionUnlocked(s);
  return (
    <Sheet title="黑貓契約 · 腐化" onClose={onClose}>
      <div className="kuro-say">「喵…想要更好嘅寶物？同我立約啦。怪物會變強，但獎勵都會變多喎。」</div>
      {!unlocked && <div className="hint">到達第 {CORRUPTION.unlockStage} 關解鎖</div>}
      {CORRUPTION.tiers.map((t, i) => (
        <div key={i} className={`row-card corr ${s.corruption === i ? "sel" : ""}`} onClick={() => unlocked && store.act((g) => setCorruption(g, i))}>
          <div className="rc-main">
            <div className="rc-title">{CORRUPTION_NAME[i]}</div>
            <div className="rc-desc">怪物血 ×{t.enemyHp} · 攻 ×{t.enemyAtk}</div>
            <div className="rc-desc good">金幣/經驗 ×{t.reward} · 稀有掉落 ×{t.rarityBoost}</div>
          </div>
          <div className="radio">{s.corruption === i ? "●" : "○"}</div>
        </div>
      ))}
    </Sheet>
  );
}

// ── Settings ────────────────────────────────────────────────────────
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [reset, setReset] = useState(0);
  const toggle = (k: "sound" | "haptics" | "autoBoss" | "autoEquip") => store.act((g) => { g.settings[k] = !g.settings[k]; });
  return (
    <Sheet title="設定" onClose={onClose}>
      {([["sound", "音效"], ["haptics", "震動"], ["autoBoss", "自動挑戰 Boss"], ["autoEquip", "自動裝備更強裝備"]] as const).map(([k, label]) => (
        <div key={k} className="row-card" onClick={() => toggle(k)}>
          <div className="rc-main"><div className="rc-title">{label}</div></div>
          <div className={`switch ${s.settings[k] ? "on" : ""}`}><div /></div>
        </div>
      ))}
      <div className="row-card">
        <div className="rc-main"><div className="rc-title">自動分解低於</div></div>
        <select value={s.settings.autoSalvageBelow ?? ""} onChange={(e) => store.act((g) => setAutoSalvage(g, (e.target.value || null) as Rarity | null))}>
          <option value="">關閉</option>
          {RARITIES.slice(1, 5).map((r) => <option key={r} value={r}>{RARITY_NAME[r]}</option>)}
        </select>
      </div>
      <div className="stats-list">
        <div>總擊殺 {fmt(s.life.kills)} · Boss {fmt(s.life.bossKills)}</div>
        <div>最高關卡 {s.life.bestStage} · 轉生 {s.life.rebirths} 次</div>
        <div>遊玩時間 {fmtDuration(s.life.playSeconds)}</div>
      </div>
      <Btn color="red" small onClick={() => {
        if (reset < 2) { setReset(reset + 1); toast(reset === 0 ? "再撳兩次確認刪除存檔" : "再撳一次！"); return; }
        store.hardReset();
        onClose();
      }}>刪除存檔 {reset > 0 ? `(${3 - reset})` : ""}</Btn>
      <div className="hint">Lazy RPG Remake v0.1 · 原創內容</div>
    </Sheet>
  );
}

// ── Offline reward popup ────────────────────────────────────────────
export function OfflineModal({ sum }: { sum: OfflineSummary }) {
  const s = useGame();
  const [busy, setBusy] = useState(false);
  const capped = sum.seconds > sum.cappedSeconds + 1;
  const close = () => store.dismissOffline();
  return (
    <Modal>
      <div className="off-title">歡迎返嚟！</div>
      <div className="off-sub">
        Kuro 幫你打咗 {fmtDuration(sum.cappedSeconds)}
        {capped && <span className="cap"> （上限 {fmtDuration(offlineCapSeconds(s))}）</span>}
      </div>
      <div className="off-grid">
        <div><CurIcon c="gold" size={28} /><b>{fmt(sum.gold)}</b></div>
        <div><CurIcon c="stone" size={28} /><b>{fmt(sum.salvagedStones)}</b></div>
        <div>⚔️<b>{fmt(sum.kills)}</b><small>擊殺</small></div>
        <div>⬆️<b>+{sum.levelsGained}</b><small>等級</small></div>
        <div>🚩<b>{sum.stagesGained >= 0 ? "+" : ""}{sum.stagesGained}</b><small>關卡</small></div>
        <div>🎁<b>{sum.items}</b><small>裝備</small></div>
      </div>
      {sum.bestRarity && (
        <div className="off-best" style={{ color: RARITY_COLOR[sum.bestRarity] }}>最佳掉落：{RARITY_NAME[sum.bestRarity]}</div>
      )}
      <div className="off-btns">
        <Btn color="green" onClick={() => { sfx.coin(); close(); }}>領取</Btn>
        <Btn color="orange" disabled={busy} onClick={async () => {
          setBusy(true);
          const ok = await ads.show("offlineDouble");
          setBusy(false);
          if (ok) {
            store.act((g) => applyOfflineDouble(g, sum));
            sfx.win();
            toast("收益 ×2！", "#ffd23f");
          }
          close();
        }}>{busy ? "播放中…" : "📺 ×2 領取"}</Btn>
      </div>
    </Modal>
  );
}
