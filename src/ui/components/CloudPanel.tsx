import { useEffect, useState } from "react";
import { fmtDuration } from "../../core/format";
import { sfx } from "../../services/feedback";
import { isNative, linkGoogle, resolveConflict, SaveMeta, signOutCloud, uploadNow, useCloud } from "../cloudSync";
import { useGame } from "../store";
import { Btn, Modal, Sprite } from "./common";
import { toast } from "./Toasts";

function ago(ms: number): string {
  if (!ms) return "未同步";
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "啱啱";
  if (s < 3600) return `${Math.floor(s / 60)} 分鐘前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小時前`;
  return `${Math.floor(s / 86400)} 日前`;
}

// Card inside Settings
export function CloudCard() {
  const c = useCloud();
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15000); return () => clearInterval(t); }, []);

  const status = !c.ready ? "連線中…" : !c.uid ? "離線" : c.guest ? "訪客（存檔只認呢部機）" : `Google：${c.email ?? "已綁定"}`;
  return (
    <div className="cloud-card">
      <div className="cloud-top">
        <span className="cloud-icon"><Sprite name={c.guest ? "i-cloud" : "i-lock"} /></span>
        <div className="cloud-main">
          <div className="rc-title">雲端存檔</div>
          <small>{status}</small>
          <small>上次備份：{c.syncing ? "同步中…" : ago(c.lastSync)}{c.error ? ` · ⚠️ ${c.error}` : ""}</small>
        </div>
      </div>
      <div className="cloud-btns">
        {c.guest && !isNative() && (
          <Btn color="blue" small disabled={busy || !c.uid} onClick={async () => {
            setBusy(true);
            const err = await linkGoogle();
            setBusy(false);
            if (err) toast(err, "#ff6b6b");
            else { sfx.win(); toast("綁定成功！換機登入就返晒 🎉", "#ffd23f"); }
          }}>綁定 Google</Btn>
        )}
        {c.guest && isNative() && <small className="cloud-hint">App 版 Google 登入即將推出。網頁版可以先綁定。</small>}
        <Btn color="gray" small disabled={busy || !c.uid} onClick={async () => {
          setBusy(true);
          const ok = await uploadNow();
          setBusy(false);
          toast(ok ? "已備份 ☁️" : "備份失敗，遲啲再試", ok ? "#7ee081" : "#ff6b6b");
        }}>立即備份</Btn>
        {!c.guest && (
          <Btn color="gray" small disabled={busy} onClick={async () => {
            setBusy(true);
            await signOutCloud();
            setBusy(false);
            toast("已登出，呢部機存檔保留");
          }}>登出</Btn>
        )}
      </div>
    </div>
  );
}

function MetaBox({ title, m, pick }: { title: string; m: SaveMeta; pick: () => void }) {
  return (
    <div className="cf-box">
      <div className="cf-title">{title}</div>
      <div>最高關卡 <b>{m.bestStage}</b></div>
      <div>等級 <b>{m.level}</b> · 轉生 <b>{m.rebirths}</b></div>
      <div>遊玩 <b>{fmtDuration(m.playSeconds)}</b></div>
      <small>{new Date(m.savedAt).toLocaleString()}</small>
      <Btn color="orange" small onClick={pick}>用呢個</Btn>
    </div>
  );
}

// Two saves differ → player pick. No silent overwrite.
export function ConflictModal() {
  const c = useCloud();
  if (!c.conflict) return null;
  const { local, cloud } = c.conflict;
  const cloudBetter = cloud.playSeconds >= local.playSeconds;
  return (
    <Modal>
      <div className="off-title">搵到兩個存檔！</div>
      <div className="off-sub">🐈‍⬛ Kuro：「揀一個。冇揀嗰個會被覆蓋，揀錯我唔負責。」</div>
      <div className="cf-grid">
        <MetaBox title={`☁️ 雲端${cloudBetter ? " ⭐" : ""}`} m={cloud} pick={() => { sfx.tap(); resolveConflict("cloud"); }} />
        <MetaBox title={`📱 呢部機${cloudBetter ? "" : " ⭐"}`} m={local} pick={() => { sfx.tap(); resolveConflict("local"); }} />
      </div>
    </Modal>
  );
}

// One-time nudge for guest on web after real progress
const NUDGE_KEY = "lazyrpg.bindNudge";
export function BindNudge({ onOpenSettings }: { onOpenSettings: () => void }) {
  const s = useGame();
  const c = useCloud();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (show || !c.ready || !c.uid || !c.guest || isNative() || c.conflict) return;
    if (s.life.bestStage < 15) return;
    try {
      if (localStorage.getItem(NUDGE_KEY)) return;
      localStorage.setItem(NUDGE_KEY, "1");
    } catch {
      return;
    }
    setShow(true);
  }, [s.life.bestStage, c.ready, c.uid, c.guest, c.conflict, show]);
  if (!show) return null;
  return (
    <Modal onClose={() => setShow(false)}>
      <div className="off-title">保住你嘅進度？</div>
      <div className="off-sub">🐈‍⬛「你而家係訪客。清咗瀏覽器或者換機，啲魚乾就冇晒。綁 Google，換機都搵返。」</div>
      <div className="cf-btns">
        <Btn color="blue" onClick={async () => {
          setShow(false);
          const err = await linkGoogle();
          if (err) { toast(err, "#ff6b6b"); onOpenSettings(); }
          else { sfx.win(); toast("綁定成功！🎉", "#ffd23f"); }
        }}>綁定 Google</Btn>
        <Btn color="gray" small onClick={() => setShow(false)}>遲啲先</Btn>
      </div>
    </Modal>
  );
}
