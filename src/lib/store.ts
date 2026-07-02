import { useEffect, useSyncExternalStore } from "react";
import { doc, onSnapshot, setDoc, type Unsubscribe } from "firebase/firestore";
import { todayKey, addDays } from "./date";
import { getFirebaseDb } from "./firebase";

export type DayStats = {
  sent: number;
  replies: number;
  calls: number;
  clients: number;
};

export type SprintData = {
  version: 1;
  startDate: string;
  goals: { daily: number; monthly: number };
  firstClientCelebrated: boolean;
  days: Record<string, DayStats>;
};

const KEY = "sprint-client:v1";

function emptyDay(): DayStats {
  return { sent: 0, replies: 0, calls: 0, clients: 0 };
}

function makeInitial(): SprintData {
  return {
    version: 1,
    startDate: todayKey(),
    goals: { daily: 10, monthly: 200 },
    firstClientCelebrated: false,
    days: {},
  };
}

function normalize(parsed: unknown): SprintData {
  if (!parsed || typeof parsed !== "object" || (parsed as { version?: number }).version !== 1) {
    return makeInitial();
  }
  const p = parsed as Partial<SprintData> & { goals?: Partial<SprintData["goals"]> };
  return {
    version: 1,
    startDate: p.startDate ?? todayKey(),
    goals: {
      daily: Number(p.goals?.daily ?? 10) || 10,
      monthly: Number(p.goals?.monthly ?? 200) || 200,
    },
    firstClientCelebrated: Boolean(p.firstClientCelebrated),
    days: p.days && typeof p.days === "object" ? p.days : {},
  };
}

function safeLoad(): SprintData {
  if (typeof window === "undefined") return makeInitial();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return makeInitial();
    return normalize(JSON.parse(raw));
  } catch {
    return makeInitial();
  }
}

let state: SprintData = typeof window === "undefined" ? makeInitial() : safeLoad();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

function notify() {
  listeners.forEach((l) => l());
}

// ---- cloud sync (Firestore) ----
// localStorage stays the instant, offline-first source of truth; Firestore mirrors it
// per signed-in user so data survives a wiped browser and syncs across devices.
let cloudUid: string | null = null;
let cloudUnsub: Unsubscribe | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let applyingRemote = false;

function schedulePush() {
  if (!cloudUid || applyingRemote) return;
  const uid = cloudUid;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    setDoc(doc(getFirebaseDb(), "users", uid), state).catch(() => {});
  }, 600);
}

export function attachCloudSync(uid: string) {
  detachCloudSync();
  cloudUid = uid;
  cloudUnsub = onSnapshot(doc(getFirebaseDb(), "users", uid), (snap) => {
    if (snap.metadata.hasPendingWrites) return; // echo of our own write
    if (snap.exists()) {
      applyingRemote = true;
      state = normalize(snap.data());
      persist();
      notify();
      applyingRemote = false;
    } else {
      // First time this account syncs: seed the cloud from this device's data.
      setDoc(doc(getFirebaseDb(), "users", uid), state).catch(() => {});
    }
  });
}

export function detachCloudSync() {
  cloudUnsub?.();
  cloudUnsub = null;
  cloudUid = null;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
}

export function setState(updater: (s: SprintData) => SprintData) {
  state = updater(state);
  persist();
  notify();
  schedulePush();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return state;
}

export function useSprint(): SprintData {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Hydrate on mount (SSR safety)
export function useHydrate() {
  useEffect(() => {
    state = safeLoad();
    notify();
    // React to changes from other tabs (not really needed but harmless)
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        state = safeLoad();
        notify();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}

export function ensureDay(key: string) {
  setState((s) => {
    if (s.days[key]) return s;
    return { ...s, days: { ...s.days, [key]: emptyDay() } };
  });
}

export function updateDay(key: string, patch: Partial<DayStats>) {
  setState((s) => {
    const cur = s.days[key] ?? emptyDay();
    const next: DayStats = {
      sent: Math.max(0, patch.sent ?? cur.sent),
      replies: Math.max(0, patch.replies ?? cur.replies),
      calls: Math.max(0, patch.calls ?? cur.calls),
      clients: Math.max(0, patch.clients ?? cur.clients),
    };
    // Update earliest startDate if importing days before startDate
    let startDate = s.startDate;
    if (key < startDate) startDate = key;
    return { ...s, startDate, days: { ...s.days, [key]: next } };
  });
}

export function bump(key: string, field: keyof DayStats, delta: number) {
  const cur = state.days[key] ?? emptyDay();
  updateDay(key, { [field]: Math.max(0, cur[field] + delta) } as Partial<DayStats>);
}

export function setGoals(g: { daily: number; monthly: number }) {
  setState((s) => ({ ...s, goals: { daily: Math.max(1, g.daily), monthly: Math.max(1, g.monthly) } }));
}

export function setStartDate(d: string) {
  setState((s) => ({ ...s, startDate: d }));
}

export function markFirstClientCelebrated() {
  setState((s) => ({ ...s, firstClientCelebrated: true }));
}

export function resetAll() {
  setState(() => makeInitial());
}

export function replaceAll(data: SprintData) {
  setState(() => data);
}

// ---- selectors ----

export function getDay(s: SprintData, key: string): DayStats {
  return s.days[key] ?? emptyDay();
}

export function totals(s: SprintData): DayStats {
  const t = emptyDay();
  for (const k in s.days) {
    const d = s.days[k];
    t.sent += d.sent;
    t.replies += d.replies;
    t.calls += d.calls;
    t.clients += d.clients;
  }
  return t;
}

export function monthTotal(s: SprintData, ym: string): number {
  let sum = 0;
  for (const k in s.days) {
    if (k.startsWith(ym)) sum += s.days[k].sent;
  }
  return sum;
}

// Streak: consecutive days with sent >= goal.
// If today hasn't reached the goal yet, streak starts from yesterday.
export function streak(s: SprintData, today: string): number {
  const goal = s.goals.daily;
  let cursor = today;
  const todaySent = (s.days[today]?.sent ?? 0);
  if (todaySent < goal) cursor = addDays(today, -1);
  let count = 0;
  // walk back up to ~365 days safety
  for (let i = 0; i < 400; i++) {
    const d = s.days[cursor];
    if (!d || d.sent < goal) break;
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function last14Keys(today: string): string[] {
  const arr: string[] = [];
  for (let i = 13; i >= 0; i--) arr.push(addDays(today, -i));
  return arr;
}

export function sortedDayKeysDesc(s: SprintData): string[] {
  return Object.keys(s.days).sort((a, b) => (a < b ? 1 : -1));
}
