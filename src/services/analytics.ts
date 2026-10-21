// Firebase Analytics + Firestore feedback. Load lazy → first paint not wait SDK.
// Web config not secret (ship in page anyway). Security = Firestore rules.
import type { FirebaseApp } from "firebase/app";
import type { Analytics } from "firebase/analytics";

const CONFIG = {
  apiKey: "AIzaSyBESWtVvtoy4MLsVPE_dObmyWWyzbBnLAQ",
  authDomain: "lazy-land.firebaseapp.com",
  projectId: "lazy-land",
  storageBucket: "lazy-land.firebasestorage.app",
  messagingSenderId: "223503512107",
  appId: "1:223503512107:web:581ace6b9a37f14d72f06e",
  measurementId: "G-JPZBSRSQKB",
};

export const APP_VERSION = "0.3.0";

type Params = Record<string, string | number | boolean>;

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let booting: Promise<void> | null = null;
const queue: [string, Params][] = [];

// Tests + node: no window → do nothing.
const enabled = typeof window !== "undefined" && !import.meta.env.VITEST;

export function playerId(): string {
  const k = "lazyrpg.pid";
  try {
    let id = localStorage.getItem(k);
    if (!id) {
      id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(k, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export async function getApp(): Promise<FirebaseApp> {
  if (app) return app;
  const { initializeApp } = await import("firebase/app");
  app = initializeApp(CONFIG);
  return app;
}

export function initAnalytics(): Promise<void> {
  if (!enabled) return Promise.resolve();
  booting ??= (async () => {
    try {
      const a = await getApp();
      const m = await import("firebase/analytics");
      if (!(await m.isSupported())) return;
      analytics = m.initializeAnalytics(a, {
        config: { app_version: APP_VERSION, debug_mode: import.meta.env.DEV },
      });
      m.setUserId(analytics, playerId());
      for (const [n, p] of queue.splice(0)) m.logEvent(analytics, n, p);
    } catch (e) {
      console.warn("[analytics] off", e);
    }
  })();
  return booting;
}

export function track(name: string, params: Params = {}): void {
  if (!enabled) return;
  if (!analytics) {
    if (queue.length < 100) queue.push([name, params]);
    void initAnalytics();
    return;
  }
  void import("firebase/analytics").then((m) => m.logEvent(analytics!, name, params));
}

export function setPlayerProps(props: Params): void {
  if (!enabled) return;
  void initAnalytics().then(async () => {
    if (!analytics) return;
    const m = await import("firebase/analytics");
    m.setUserProperties(analytics, props);
  });
}

// Feedback → Firestore "feedback" collection (create only by rules).
// Firestore fail (not set up / offline) → still log short version in Analytics.
export async function sendFeedback(text: string, mood: string, ctx: Params): Promise<boolean> {
  const body = text.trim().slice(0, 2000);
  track("feedback_sent", { mood, len: body.length, preview: body.slice(0, 90) });
  if (!enabled) return true;
  try {
    const a = await getApp();
    const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore/lite");
    await addDoc(collection(getFirestore(a), "feedback"), {
      text: body,
      mood,
      pid: playerId(),
      version: APP_VERSION,
      ua: navigator.userAgent.slice(0, 200),
      at: serverTimestamp(),
      ...ctx,
    });
    return true;
  } catch (e) {
    console.warn("[feedback] firestore fail", e);
    return false;
  }
}
