// Sound + vibrate. Sound = tiny WebAudio synth, no asset file needed.
// TODO: native → @capacitor/haptics for nicer buzz.

let ctx: AudioContext | null = null;
let enabled = { sound: true, haptics: true };

export function setFeedback(sound: boolean, haptics: boolean) {
  enabled = { sound, haptics };
}

function ac(): AudioContext | null {
  if (!enabled.sound) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// throttle: too many hit sound = noise
const last: Record<string, number> = {};
function gate(key: string, ms: number) {
  const now = performance.now();
  if (now - (last[key] ?? 0) < ms) return false;
  last[key] = now;
  return true;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur);
}

export const sfx = {
  hit(crit: boolean) {
    if (!gate("hit", 70)) return;
    crit ? tone(520, 0.12, "square", 0.05, -300) : tone(260, 0.06, "triangle", 0.05, -120);
  },
  kill() {
    if (!gate("kill", 90)) return;
    tone(660, 0.08, "triangle", 0.05, 200);
  },
  coin() {
    if (!gate("coin", 60)) return;
    tone(1200, 0.07, "sine", 0.04, 400);
  },
  loot(tier: number) {
    const base = 500 + tier * 120;
    tone(base, 0.12, "triangle", 0.06, 300);
    setTimeout(() => tone(base * 1.5, 0.18, "triangle", 0.06, 200), 90);
  },
  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.15, "square", 0.04), i * 80));
  },
  boss() {
    tone(110, 0.6, "sawtooth", 0.06, -40);
  },
  win() {
    [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, "triangle", 0.06), i * 90));
  },
  fail() {
    tone(300, 0.4, "sawtooth", 0.05, -200);
  },
  tap() {
    tone(800, 0.04, "sine", 0.03);
  },
};

export function buzz(ms = 15) {
  if (!enabled.haptics) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibrate, fine */
  }
}
