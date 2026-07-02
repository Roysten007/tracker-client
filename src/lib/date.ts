// Date utilities for Africa/Porto-Novo (UTC+1, no DST).
// "Today" key rolls over at local midnight.

const TZ = "Africa/Porto-Novo";

function partsInTZ(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return { y, m, d: day };
}

export function todayKey(now: Date = new Date()): string {
  const { y, m, d } = partsInTZ(now);
  return `${y}-${m}-${d}`;
}

export function keyToDate(key: string): Date {
  // Interpret as local (UTC+1) midnight — represent as UTC-1h so the wall time matches Porto-Novo midnight.
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, -1, 0, 0));
}

export function addDays(key: string, delta: number): string {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() + delta);
  return todayKey(d);
}

export function monthKey(now: Date = new Date()): string {
  const { y, m } = partsInTZ(now);
  return `${y}-${m}`;
}

export function keyMonth(key: string): string {
  return key.slice(0, 7);
}

export function formatLongFr(key: string): string {
  const d = keyToDate(key);
  const s = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  return s;
}

export function formatShortFr(key: string): string {
  const d = keyToDate(key);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function formatDayNum(key: string): string {
  const d = keyToDate(key);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    day: "numeric",
  }).format(d);
}

// Monday-based ISO week start key
export function weekStartKey(key: string): string {
  const d = keyToDate(key);
  // getUTCDay: 0 Sun..6 Sat; Monday-start offset
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return todayKey(d);
}

export function formatWeekLabel(startKey: string): string {
  const d = keyToDate(startKey);
  const s = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
  }).format(d);
  return `Semaine du ${s}`;
}
