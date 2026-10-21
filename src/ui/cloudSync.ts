// Cloud save. Guest = Firebase anonymous auth (auto, no button). Google = optional link (web only).
// Save doc: saves/{uid}. Rules: only owner read/write.
import { useSyncExternalStore } from "react";
import type { Auth, User } from "firebase/auth";
import { getApp, track } from "../services/analytics";
import { store } from "./store";

export interface SaveMeta {
  bestStage: number;
  level: number;
  playSeconds: number;
  rebirths: number;
  createdAt: number;
  savedAt: number; // client ms
}

export interface Conflict {
  local: SaveMeta;
  cloud: SaveMeta;
  cloudData: string;
}

export interface CloudState {
  ready: boolean;
  uid: string | null;
  guest: boolean;
  email: string | null;
  lastSync: number; // ms, 0 = never
  syncing: boolean;
  error: string | null;
  conflict: Conflict | null;
}

const UPLOAD_EVERY_MS = 90_000;
const enabled = typeof window !== "undefined" && !import.meta.env.VITEST;

// Native APK: Google popup no work in WebView → guest only for now.
export const isNative = (): boolean => !!(globalThis as any).Capacitor?.isNativePlatform?.();

let cs: CloudState = { ready: false, uid: null, guest: true, email: null, lastSync: 0, syncing: false, error: null, conflict: null };
const subs = new Set<() => void>();
function set(p: Partial<CloudState>) {
  cs = { ...cs, ...p };
  for (const l of subs) l();
}
export const cloudState = () => cs;
export function useCloud(): CloudState {
  return useSyncExternalStore((l) => { subs.add(l); return () => { subs.delete(l); }; }, () => cs);
}

let auth: Auth | null = null;
let lastUploadVer = -1;
let checkedUid: string | null = null; // uid already compared with cloud
let busy = false;

export function metaOf(s = store.state): SaveMeta {
  return {
    bestStage: s.life.bestStage,
    level: s.level,
    playSeconds: Math.floor(s.life.playSeconds),
    rebirths: s.life.rebirths,
    createdAt: s.createdAt,
    savedAt: Date.now(),
  };
}

async function fs() {
  const app = await getApp();
  const m = await import("firebase/firestore/lite");
  return { m, db: m.getFirestore(app) };
}

export async function uploadNow(): Promise<boolean> {
  const uid = auth?.currentUser?.uid;
  if (!uid || cs.conflict || checkedUid !== uid) return false;
  try {
    set({ syncing: true });
    const { m, db } = await fs();
    const ver = store.getVersion();
    await m.setDoc(m.doc(db, "saves", uid), { data: store.exportSave(), meta: metaOf(), at: m.serverTimestamp() });
    lastUploadVer = ver;
    set({ syncing: false, lastSync: Date.now(), error: null });
    return true;
  } catch (e: any) {
    set({ syncing: false, error: String(e?.code ?? e?.message ?? e) });
    return false;
  }
}

// Compare cloud vs local once per uid. Same save (same createdAt) and local not behind → upload local.
// Else ask player (conflict modal).
async function checkCloud(user: User) {
  if (busy) return;
  busy = true;
  try {
    const { m, db } = await fs();
    const snap = await m.getDoc(m.doc(db, "saves", user.uid));
    checkedUid = user.uid;
    if (!snap.exists()) {
      await uploadNow();
      return;
    }
    const d = snap.data() as { data: string; meta: SaveMeta };
    const local = metaOf();
    const cloud = d.meta;
    const sameSave = cloud.createdAt === local.createdAt;
    const cloudAhead = cloud.playSeconds > local.playSeconds + 30;
    const localFresh = local.playSeconds < 60;
    if ((sameSave && !cloudAhead) || cloud.playSeconds < 60) {
      await uploadNow();
    } else if (localFresh) {
      // new device / new install: just take cloud, nothing to lose
      store.loadSave(d.data);
      set({ lastSync: Date.now() });
      track("cloud_restore", { auto: 1 });
    } else {
      set({ conflict: { local, cloud, cloudData: d.data } });
      track("cloud_conflict", {});
    }
  } catch (e: any) {
    set({ error: String(e?.code ?? e?.message ?? e) });
  } finally {
    busy = false;
  }
}

export function resolveConflict(pick: "local" | "cloud") {
  const c = cs.conflict;
  if (!c) return;
  if (pick === "cloud") {
    try {
      store.loadSave(c.cloudData);
    } catch {
      set({ error: "cloud save broken" });
    }
  }
  set({ conflict: null });
  track("cloud_conflict_pick", { pick });
  void uploadNow();
}

function onUser(u: User | null) {
  if (!u) {
    set({ uid: null, ready: true });
    return;
  }
  const google = u.providerData.some((p) => p.providerId === "google.com");
  set({ ready: true, uid: u.uid, guest: !google, email: google ? u.email : null, error: null });
  if (checkedUid !== u.uid) void checkCloud(u);
}

export function startCloud() {
  if (!enabled) return;
  // wait first paint + idle a bit → not slow start
  setTimeout(async () => {
    try {
      const app = await getApp();
      const a = await import("firebase/auth");
      auth = a.initializeAuth(app, { persistence: [a.indexedDBLocalPersistence, a.browserLocalPersistence] });
      a.onAuthStateChanged(auth, (u) => {
        if (u) onUser(u);
        else void a.signInAnonymously(auth!).catch((e) => set({ ready: true, error: String(e?.code ?? e) }));
      });
    } catch (e: any) {
      set({ ready: true, error: String(e?.message ?? e) });
    }
  }, 1500);

  setInterval(() => {
    if (!document.hidden && store.getVersion() !== lastUploadVer) void uploadNow();
  }, UPLOAD_EVERY_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) void uploadNow();
  });
}

// Guest → Google. Same uid kept (progress stay). Google already used by other device → switch to it, then compare.
export async function linkGoogle(): Promise<string | null> {
  if (!auth?.currentUser) return "未連線";
  const a = await import("firebase/auth");
  const provider = new a.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const r = await a.linkWithPopup(auth.currentUser, provider, a.browserPopupRedirectResolver);
    await r.user.reload();
    onUser(auth.currentUser);
    track("account_link", { method: "google" });
    void uploadNow();
    return null;
  } catch (e: any) {
    if (e?.code === "auth/credential-already-in-use") {
      const cred = a.GoogleAuthProvider.credentialFromError(e);
      if (!cred) return "登入失敗";
      checkedUid = null;
      await a.signInWithCredential(auth, cred); // onAuthStateChanged → checkCloud
      track("account_login", { method: "google" });
      return null;
    }
    if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") return "已取消";
    if (e?.code === "auth/popup-blocked") return "瀏覽器擋咗彈出視窗";
    return String(e?.code ?? e?.message ?? e);
  }
}

// Sign out Google → back to new guest. Local save stay on this device.
export async function signOutCloud() {
  if (!auth) return;
  await uploadNow();
  const a = await import("firebase/auth");
  checkedUid = null;
  await a.signOut(auth); // onAuthStateChanged(null) → signInAnonymously
}
