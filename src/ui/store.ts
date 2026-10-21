import { useSyncExternalStore } from "react";
import { BALANCE } from "../config/balance";
import { createRng, Rng } from "../core/rng";
import { newGame } from "../core/newGame";
import { tick } from "../core/sim";
import { runOffline } from "../core/offline";
import { serialize, deserialize } from "../core/save";
import { ensureDaily } from "../core/daily";
import type { GameState, OfflineSummary, SimEvent } from "../core/types";
import { setFeedback } from "../services/feedback";

const KEY = "lazyrpg.remake.save.v1";

type Listener = () => void;
type EventListener = (e: SimEvent) => void;

// One store: own state, run loop, save. React read via hook (10Hz), canvas read every frame.
class GameStore {
  state: GameState;
  rng: Rng;
  version = 0; // bump when UI should re-render
  offline: OfflineSummary | null = null;
  private listeners = new Set<Listener>();
  private evListeners = new Set<EventListener>();
  private acc = 0;
  private lastFrame = 0;
  private lastNotify = 0;
  private lastSave = 0;
  private running = false;

  constructor() {
    const now = Date.now();
    let s: GameState | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) s = deserialize(raw, now);
    } catch {
      s = null; // broken save → new game (TODO: keep backup copy)
    }
    this.state = s ?? newGame(now);
    this.rng = createRng(this.state.seed);
    if (s) this.catchUp(now);
    ensureDaily(this.state, now);
    setFeedback(this.state.settings.sound, this.state.settings.haptics);
  }

  private catchUp(now: number) {
    const away = (now - this.state.lastSeen) / 1000;
    if (away >= BALANCE.offlineMinSeconds) {
      this.offline = runOffline(this.state, away);
      this.rng = createRng(this.state.seed);
    }
    this.state.lastSeen = now;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      this.frame(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", this.onVis);
    window.addEventListener("pagehide", this.save);
  }

  private onVis = () => {
    if (document.hidden) {
      this.save();
    } else {
      // back from background → offline catch up, show popup
      const now = Date.now();
      this.catchUp(now);
      ensureDaily(this.state, now);
      this.lastFrame = performance.now();
      this.notify(true);
    }
  };

  private frame(t: number) {
    let dt = (t - this.lastFrame) / 1000;
    this.lastFrame = t;
    if (dt > 1) dt = 1; // tab freeze: visibility handle big gap
    this.acc += dt;
    const step = BALANCE.tickSeconds;
    let n = 0;
    while (this.acc >= step && n < 40) {
      tick(this.state, step, this.rng, this.emit);
      this.acc -= step;
      n++;
    }
    this.state.seed = this.rng.seed();
    this.state.lastSeen = Date.now();
    if (t - this.lastNotify > 100) this.notify();
    if (t - this.lastSave > 10000) this.save();
  }

  private emit = (e: SimEvent) => {
    for (const l of this.evListeners) l(e);
  };

  onEvent(l: EventListener) {
    this.evListeners.add(l);
    return () => { this.evListeners.delete(l); };
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  };

  getVersion = () => this.version;

  notify(force = false) {
    this.lastNotify = force ? 0 : performance.now();
    this.version++;
    for (const l of this.listeners) l();
  }

  // run action on state, then refresh UI + save
  act<T>(fn: (s: GameState, rng: Rng) => T): T {
    const r = fn(this.state, this.rng);
    this.state.seed = this.rng.seed();
    setFeedback(this.state.settings.sound, this.state.settings.haptics);
    this.notify(true);
    this.save();
    return r;
  }

  // forward sim event made by action (boss start etc) to renderer
  emitter = (e: SimEvent) => this.emit(e);

  dismissOffline() {
    this.offline = null;
    this.notify(true);
  }

  save = () => {
    try {
      this.state.lastSeen = Date.now();
      localStorage.setItem(KEY, serialize(this.state));
      this.lastSave = performance.now();
    } catch {
      /* storage full / private mode — ignore */
    }
  };

  hardReset() {
    localStorage.removeItem(KEY);
    this.state = newGame(Date.now());
    this.rng = createRng(this.state.seed);
    this.offline = null;
    this.notify(true);
    this.save();
  }
}

export const store = new GameStore();

// React hook: re-render ~10Hz with latest state
export function useGame(): GameState {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store.state;
}
