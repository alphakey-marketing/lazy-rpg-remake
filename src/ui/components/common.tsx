import { ReactNode, useEffect } from "react";
import type { Slot } from "../../config/content";
import { fmt } from "../../core/format";
import { sfx, buzz } from "../../services/feedback";
import type { Item } from "../../core/types";
import { RARITY_COLOR } from "../theme";

type BtnColor = "green" | "orange" | "blue" | "purple" | "red" | "gray" | "gold";

export function Btn(props: {
  children: ReactNode;
  onClick?: () => void;
  color?: BtnColor;
  disabled?: boolean;
  small?: boolean;
  wide?: boolean;
  dot?: boolean;
  className?: string;
}) {
  const { color = "green", disabled, small, wide, dot, className = "" } = props;
  return (
    <button
      className={`btn btn-${color} ${small ? "btn-sm" : ""} ${wide ? "btn-wide" : ""} ${className}`}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        sfx.tap();
        buzz(8);
        props.onClick?.();
      }}
    >
      {props.children}
      {dot && <span className="red-dot" />}
    </button>
  );
}

export type Cur = "gold" | "gem" | "stone" | "shard" | "charm";

export function CurIcon({ c, size = 18 }: { c: Cur; size?: number }) {
  const s = size;
  switch (c) {
    case "gold":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className="cur-icon">
          <circle cx="12" cy="12" r="10" fill="#ffd23f" stroke="#2a1f3d" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="6" fill="none" stroke="#e0a800" strokeWidth="2" />
          <circle cx="9" cy="8" r="2" fill="#fff6c2" />
        </svg>
      );
    case "gem":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className="cur-icon">
          <path d="M5 9 L9 4 H15 L19 9 L12 20 Z" fill="#ff5ec4" stroke="#2a1f3d" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M5 9 H19 M9 4 L12 9 L15 4 M12 9 V20" stroke="#ffd0f0" strokeWidth="1.2" fill="none" />
        </svg>
      );
    case "stone":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className="cur-icon">
          <path d="M12 2 L20 8 L17 20 H7 L4 8 Z" fill="#58c7ff" stroke="#2a1f3d" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M8 9 L12 5 L14 8" stroke="#d6f3ff" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "shard":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className="cur-icon">
          <path d="M12 2 L15 10 L12 22 L9 10 Z" fill="#b98cff" stroke="#2a1f3d" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2" fill="#fff" />
        </svg>
      );
    case "charm":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className="cur-icon">
          <path d="M12 2 L20 6 V12 C20 17 16 20 12 22 C8 20 4 17 4 12 V6 Z" fill="#5fe07a" stroke="#2a1f3d" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M8 12 L11 15 L16 9" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      );
  }
}

export function Amount({ c, n, size }: { c: Cur; n: number; size?: number }) {
  return (
    <span className="amount">
      <CurIcon c={c} size={size} />
      {fmt(n)}
    </span>
  );
}

export function SlotIcon({ slot, size = 34, color = "#e8ecf5" }: { slot: Slot; size?: number; color?: string }) {
  const st = { stroke: "#2a1f3d", strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      {slot === "weapon" && (
        <>
          <path d="M22 4 L28 4 L28 10 L14 24 L8 18 Z" fill={color} {...st} />
          <path d="M7 15 L17 25 M5 27 L10 22" fill="none" {...st} strokeWidth={3.5} />
          <circle cx="5" cy="27" r="2.5" fill="#ffd166" {...st} />
        </>
      )}
      {slot === "armor" && (
        <path d="M9 5 L13 7 H19 L23 5 L28 10 L24 14 V27 H8 V14 L4 10 Z" fill={color} {...st} />
      )}
      {slot === "helm" && (
        <>
          <path d="M5 20 C5 10 10 5 16 5 C22 5 27 10 27 20 V24 H5 Z" fill={color} {...st} />
          <path d="M10 16 H22 V20 H10 Z" fill="#2a1f3d" />
          <path d="M16 2 V6" {...st} strokeWidth={4} stroke="#ff5a5a" />
        </>
      )}
      {slot === "ring" && (
        <>
          <circle cx="16" cy="19" r="9" fill="none" {...st} strokeWidth={6} />
          <circle cx="16" cy="19" r="9" fill="none" stroke={color} strokeWidth={3} />
          <path d="M12 8 L16 3 L20 8 L16 12 Z" fill="#ff5ec4" {...st} />
        </>
      )}
    </svg>
  );
}

export function ItemCard({ item, onClick, selected, empty, slot, badge }: {
  item: Item | null;
  onClick?: () => void;
  selected?: boolean;
  empty?: boolean;
  slot?: Slot;
  badge?: ReactNode;
}) {
  if (!item) {
    return (
      <div className={`item-card empty ${selected ? "sel" : ""}`} onClick={onClick}>
        {slot && <SlotIcon slot={slot} color="#5a5378" />}
        {empty && <span className="empty-label">空</span>}
      </div>
    );
  }
  const col = RARITY_COLOR[item.rarity];
  return (
    <div
      className={`item-card r-${item.rarity} ${selected ? "sel" : ""}`}
      style={{ ["--rc" as any]: col }}
      onClick={() => {
        sfx.tap();
        onClick?.();
      }}
    >
      <SlotIcon slot={item.slot} color={col} />
      {item.refine > 0 && <span className="refine-tag">+{item.refine}</span>}
      <span className="ilvl">Lv{item.ilvl}</span>
      {item.locked && <span className="lock">🔒</span>}
      {badge}
    </div>
  );
}

export function Sheet({ title, onClose, children, tall }: { title: string; onClose: () => void; children: ReactNode; tall?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className={`sheet ${tall ? "tall" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button className="x-btn" onClick={onClose} aria-label="close">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Bar({ k, color, h = 10, label }: { k: number; color: string; h?: number; label?: string }) {
  return (
    <div className="bar" style={{ height: h }}>
      <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(1, k)) * 100}%`, background: color }} />
      {label && <span className="bar-label">{label}</span>}
    </div>
  );
}
