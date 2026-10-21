// Big number short: 1.23K 4.5M ... then aa ab ac (idle game style)
const UNITS = ["", "K", "M", "B", "T"];

export function fmt(n: number): string {
  if (!isFinite(n)) return "∞";
  const neg = n < 0;
  n = Math.abs(n);
  let out: string;
  if (n < 1000) {
    out = n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toString();
  } else {
    const tier = Math.floor(Math.log10(n) / 3);
    const unit = tier < UNITS.length ? UNITS[tier] : letterUnit(tier - UNITS.length);
    const scaled = n / Math.pow(1000, tier);
    out = (scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2)) + unit;
  }
  return neg ? "-" + out : out;
}

function letterUnit(i: number): string {
  const a = "abcdefghijklmnopqrstuvwxyz";
  return a[Math.floor(i / 26) % 26] + a[i % 26];
}

export function pct(n: number, digits = 0): string {
  return (n * 100).toFixed(digits) + "%";
}

export function fmtDuration(sec: number): string {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
