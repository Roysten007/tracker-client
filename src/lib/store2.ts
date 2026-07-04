// Store Sprint Machine V1 — nouveau modèle Firestore (prospects/messages/jours/reglages).
//
// Coexiste avec store.ts (le tracker V0) pour ne pas casser les 3 écrans existants
// pendant que les 4 nouveaux onglets sont en construction. La migration du doc legacy
// users/{uid} vers ce nouveau modèle est faite automatiquement au premier attachCloudSync.
//
// Design :
//   - Cache mémoire + snapshot React via useSyncExternalStore (comme store.ts)
//   - Sync Firestore temps réel par sous-collection (onSnapshot par collection)
//   - Écritures optimistes : mutations locales appliquées immédiatement, puis persistées
//   - localStorage garde une copie hors-ligne (clé "sprint-machine:v1")

import { useEffect, useSyncExternalStore } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";

import { getFirebaseDb } from "./firebase";
import { todayKey } from "./date";
import type {
  Config,
  DayStats,
  Message,
  Prospect,
  Statut,
  TypeMessage,
} from "./types";
import { CONFIG_DEFAUT } from "./types";
import type { ProspectPatch } from "./relances";
import { patchApresEnvoi } from "./relances";

// ---- Forme du state ---------------------------------------------------------

export type SprintMachineState = {
  prospects: Record<string, Prospect>;
  messages: Record<string, Message[]>; // clé = prospectId
  jours: Record<string, DayStats>; // clé = YYYY-MM-DD
  config: Config;
  chargementInitial: boolean; // true tant que la 1re sync Firestore n'est pas revenue
};

function stateVide(): SprintMachineState {
  return {
    prospects: {},
    messages: {},
    jours: {},
    config: { ...CONFIG_DEFAUT },
    chargementInitial: true,
  };
}

// ---- Persistance hors ligne (localStorage) ---------------------------------

const LS_KEY = "sprint-machine:v1";

function chargerLS(): SprintMachineState {
  if (typeof window === "undefined") return stateVide();
  try {
    const brut = localStorage.getItem(LS_KEY);
    if (!brut) return stateVide();
    const parse = JSON.parse(brut) as Partial<SprintMachineState>;
    return {
      prospects: parse.prospects ?? {},
      messages: parse.messages ?? {},
      jours: parse.jours ?? {},
      config: { ...CONFIG_DEFAUT, ...(parse.config ?? {}) },
      chargementInitial: false,
    };
  } catch {
    return stateVide();
  }
}

function sauvegarderLS(s: SprintMachineState) {
  if (typeof window === "undefined") return;
  try {
    // On ne persiste pas chargementInitial (recalculé à chaque montage).
    const { chargementInitial: _ci, ...rest } = s;
    void _ci;
    localStorage.setItem(LS_KEY, JSON.stringify(rest));
  } catch {
    /* quota dépassé ou navigateur privé — silencieux */
  }
}

// ---- Cache mémoire + notifications React -----------------------------------

let etat: SprintMachineState =
  typeof window === "undefined" ? stateVide() : chargerLS();
const auditeurs = new Set<() => void>();

function notifier() {
  auditeurs.forEach((cb) => cb());
}

function mettreAJour(mutation: (s: SprintMachineState) => SprintMachineState) {
  etat = mutation(etat);
  sauvegarderLS(etat);
  notifier();
}

function abonner(cb: () => void): () => void {
  auditeurs.add(cb);
  return () => auditeurs.delete(cb);
}

function snapshot(): SprintMachineState {
  return etat;
}

function snapshotServeur(): SprintMachineState {
  return etat;
}

export function useSprintMachine(): SprintMachineState {
  return useSyncExternalStore(abonner, snapshot, snapshotServeur);
}

// Hook léger d'hydratation SSR — recharge depuis localStorage côté client au montage.
export function useHydraterSM() {
  useEffect(() => {
    etat = chargerLS();
    notifier();
  }, []);
}

// ---- Sync Firestore --------------------------------------------------------

let uidActuel: string | null = null;
const desabonnements: Unsubscribe[] = [];

function chemins(uid: string) {
  const db = getFirebaseDb();
  return {
    prospects: collection(db, "users", uid, "prospects"),
    jours: collection(db, "users", uid, "jours"),
    configDoc: doc(db, "users", uid, "reglages", "config"),
    legacyDoc: doc(db, "users", uid),
    messagesDe: (prospectId: string) =>
      collection(db, "users", uid, "prospects", prospectId, "messages"),
  };
}

// Attache la sync temps réel pour l'utilisateur donné. Idempotent.
export async function attacherSyncSM(uid: string): Promise<void> {
  if (uidActuel === uid) return;
  detacherSyncSM();
  uidActuel = uid;
  const { prospects, jours, configDoc, legacyDoc } = chemins(uid);

  await migrerDepuisLegacyV0(uid, legacyDoc, configDoc);

  // 1) Config (doc unique).
  desabonnements.push(
    onSnapshot(configDoc, (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      const data = snap.exists() ? (snap.data() as Partial<Config>) : {};
      mettreAJour((s) => ({
        ...s,
        config: { ...CONFIG_DEFAUT, ...data },
      }));
    }),
  );

  // 2) Prospects (collection).
  desabonnements.push(
    onSnapshot(prospects, (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      const map: Record<string, Prospect> = {};
      snap.forEach((d) => {
        map[d.id] = { ...(d.data() as Prospect), id: d.id };
      });
      mettreAJour((s) => ({ ...s, prospects: map, chargementInitial: false }));
    }),
  );

  // 3) Jours (collection).
  desabonnements.push(
    onSnapshot(jours, (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      const map: Record<string, DayStats> = {};
      snap.forEach((d) => {
        const data = d.data() as Partial<DayStats>;
        map[d.id] = {
          sent: Number(data.sent) || 0,
          replies: Number(data.replies) || 0,
          calls: Number(data.calls) || 0,
          clients: Number(data.clients) || 0,
        };
      });
      mettreAJour((s) => ({ ...s, jours: map }));
    }),
  );
}

export function detacherSyncSM() {
  while (desabonnements.length) {
    const u = desabonnements.pop();
    try {
      u?.();
    } catch {
      /* ignore */
    }
  }
  uidActuel = null;
}

// Charge les messages d'un prospect (à la demande, quand la fiche s'ouvre).
export function abonnerMessagesProspect(
  prospectId: string,
  cb: (messages: Message[]) => void,
): Unsubscribe {
  if (!uidActuel) return () => {};
  const { messagesDe } = chemins(uidActuel);
  return onSnapshot(messagesDe(prospectId), (snap) => {
    if (snap.metadata.hasPendingWrites) return;
    const arr: Message[] = [];
    snap.forEach((d) => {
      arr.push({ ...(d.data() as Message), id: d.id });
    });
    arr.sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    mettreAJour((s) => ({ ...s, messages: { ...s.messages, [prospectId]: arr } }));
    cb(arr);
  });
}

// ---- Migration V0 → V1 -----------------------------------------------------
//
// Le tracker V0 stockait tout dans users/{uid} sous la forme SprintData :
//   { version:1, startDate, goals:{daily,monthly}, firstClientCelebrated, days:{YYYY-MM-DD:{sent,...}} }
// On copie ces jours dans users/{uid}/jours/*, les goals/prix dans users/{uid}/reglages/config,
// puis on efface les champs migrés du doc legacy (on garde le doc pour ne rien perdre en cas de bug).
//
// Marqueur d'idempotence : le doc reglages/config a le champ __migrationV0Faite = true.

async function migrerDepuisLegacyV0(
  uid: string,
  legacyDoc: ReturnType<typeof doc>,
  configDoc: ReturnType<typeof doc>,
) {
  try {
    const cfgSnap = await getDoc(configDoc);
    if (cfgSnap.exists() && (cfgSnap.data() as { __migrationV0Faite?: boolean }).__migrationV0Faite) {
      return; // déjà fait
    }

    const legacySnap = await getDoc(legacyDoc);
    if (!legacySnap.exists()) {
      // Rien à migrer — marque quand même la migration comme faite pour ne pas retenter à chaque login.
      await setDoc(configDoc, { __migrationV0Faite: true }, { merge: true });
      return;
    }

    const legacy = legacySnap.data() as {
      version?: number;
      goals?: { daily?: number; monthly?: number };
      firstClientCelebrated?: boolean;
      days?: Record<string, DayStats>;
    };

    // 1) Jours → sous-collection jours/.
    if (legacy.days && typeof legacy.days === "object") {
      const db = getFirebaseDb();
      const promesses: Promise<void>[] = [];
      for (const [dateKey, stats] of Object.entries(legacy.days)) {
        const ref = doc(db, "users", uid, "jours", dateKey);
        promesses.push(setDoc(ref, sanitizerJour(stats), { merge: true }));
      }
      await Promise.all(promesses);
    }

    // 2) Reglages : objectif + célébration + marqueur.
    await setDoc(
      configDoc,
      {
        objectifQuotidien: legacy.goals?.daily ?? CONFIG_DEFAUT.objectifQuotidien,
        premierClientCelebre: Boolean(legacy.firstClientCelebrated),
        __migrationV0Faite: true,
      },
      { merge: true },
    );

    // On ne supprime PAS legacyDoc — il reste comme sauvegarde froide.
  } catch (e) {
    // Migration = best-effort. En cas d'erreur, on trace en console et on continue
    // avec un state vide côté Firestore ; le user peut ré-importer via Réglages > Import JSON.
    console.error("Migration V0 → V1 échouée :", e);
  }
}

function sanitizerJour(s: unknown): DayStats {
  const o = (s ?? {}) as Partial<DayStats>;
  return {
    sent: Math.max(0, Number(o.sent) || 0),
    replies: Math.max(0, Number(o.replies) || 0),
    calls: Math.max(0, Number(o.calls) || 0),
    clients: Math.max(0, Number(o.clients) || 0),
  };
}

// ---- MUTATIONS : jours ----------------------------------------------------

function jourVide(): DayStats {
  return { sent: 0, replies: 0, calls: 0, clients: 0 };
}

export function getJour(s: SprintMachineState, key: string): DayStats {
  return s.jours[key] ?? jourVide();
}

export async function incrementerJour(
  dateKey: string,
  champ: keyof DayStats,
  delta: number,
): Promise<void> {
  const courant = etat.jours[dateKey] ?? jourVide();
  const suivant: DayStats = { ...courant, [champ]: Math.max(0, courant[champ] + delta) };
  // Optimiste local.
  mettreAJour((s) => ({ ...s, jours: { ...s.jours, [dateKey]: suivant } }));
  // Persist.
  if (!uidActuel) return;
  const db = getFirebaseDb();
  await setDoc(doc(db, "users", uidActuel, "jours", dateKey), suivant, { merge: true });
}

export async function remplacerJour(dateKey: string, stats: DayStats): Promise<void> {
  const norm = sanitizerJour(stats);
  mettreAJour((s) => ({ ...s, jours: { ...s.jours, [dateKey]: norm } }));
  if (!uidActuel) return;
  const db = getFirebaseDb();
  await setDoc(doc(db, "users", uidActuel, "jours", dateKey), norm, { merge: true });
}

// ---- MUTATIONS : config ---------------------------------------------------

export async function mettreAJourConfig(patch: Partial<Config>): Promise<void> {
  mettreAJour((s) => ({ ...s, config: { ...s.config, ...patch } }));
  if (!uidActuel) return;
  const db = getFirebaseDb();
  await setDoc(doc(db, "users", uidActuel, "reglages", "config"), patch, { merge: true });
}

// ---- MUTATIONS : prospects ------------------------------------------------

function nouvelId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function creerProspect(
  entree: Omit<Prospect, "id" | "statut" | "prochaineActionDate" | "prochaineActionType" | "createdAt">,
): Promise<Prospect> {
  const id = nouvelId();
  const prospect: Prospect = {
    ...entree,
    id,
    statut: "a_contacter",
    prochaineActionDate: null,
    prochaineActionType: null,
    createdAt: nowIso(),
  };
  mettreAJour((s) => ({ ...s, prospects: { ...s.prospects, [id]: prospect } }));
  if (uidActuel) {
    const db = getFirebaseDb();
    await setDoc(doc(db, "users", uidActuel, "prospects", id), prospect);
  }
  return prospect;
}

export async function mettreAJourProspect(id: string, patch: ProspectPatch & Partial<Prospect>): Promise<void> {
  const courant = etat.prospects[id];
  if (!courant) return;
  const suivant: Prospect = { ...courant, ...patch };
  mettreAJour((s) => ({ ...s, prospects: { ...s.prospects, [id]: suivant } }));
  if (uidActuel) {
    const db = getFirebaseDb();
    await updateDoc(doc(db, "users", uidActuel, "prospects", id), patch as Record<string, unknown>);
  }
}

export async function supprimerProspect(id: string): Promise<void> {
  mettreAJour((s) => {
    const { [id]: _, ...rest } = s.prospects;
    void _;
    const { [id]: __, ...msgRest } = s.messages;
    void __;
    return { ...s, prospects: rest, messages: msgRest };
  });
  if (uidActuel) {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, "users", uidActuel, "prospects", id));
  }
}

// Enregistre l'envoi d'un message : historique + statut/prochaine action + incrément jour.
export async function enregistrerEnvoi(
  prospectId: string,
  type: TypeMessage,
  contenu: string,
): Promise<void> {
  const courant = etat.prospects[prospectId];
  if (!courant) return;

  const aujourdhui = todayKey();
  const messageId = nouvelId();
  const message: Message = { id: messageId, type, contenu, sentAt: nowIso() };
  const patchProspect = patchApresEnvoi(type, aujourdhui);
  const prospectSuivant: Prospect = { ...courant, ...patchProspect };

  // Optimiste : prospect + historique + compteur du jour.
  mettreAJour((s) => {
    const msgs = [...(s.messages[prospectId] ?? []), message];
    const jourCourant = s.jours[aujourdhui] ?? jourVide();
    return {
      ...s,
      prospects: { ...s.prospects, [prospectId]: prospectSuivant },
      messages: { ...s.messages, [prospectId]: msgs },
      jours: {
        ...s.jours,
        [aujourdhui]: { ...jourCourant, sent: jourCourant.sent + 1 },
      },
    };
  });

  if (uidActuel) {
    const db = getFirebaseDb();
    await Promise.all([
      setDoc(
        doc(db, "users", uidActuel, "prospects", prospectId, "messages", messageId),
        {
          type,
          contenu,
          sentAt: serverTimestamp() as unknown as string,
        },
      ),
      updateDoc(
        doc(db, "users", uidActuel, "prospects", prospectId),
        patchProspect as Record<string, unknown>,
      ),
      setDoc(
        doc(db, "users", uidActuel, "jours", aujourdhui),
        { sent: (etat.jours[aujourdhui]?.sent ?? 0) },
        { merge: true },
      ),
    ]);
  }
}

// Utilitaire : "Il a répondu" / "Client" / etc. — patch simple.
export async function transitionStatut(
  prospectId: string,
  patch: ProspectPatch,
  effetJournalier?: { champ: keyof DayStats; delta: number },
): Promise<void> {
  await mettreAJourProspect(prospectId, patch);
  if (effetJournalier) {
    await incrementerJour(todayKey(), effetJournalier.champ, effetJournalier.delta);
  }
}

// ---- Sélecteurs -----------------------------------------------------------

export function tousProspects(s: SprintMachineState): Prospect[] {
  return Object.values(s.prospects);
}

export function prospectsParStatut(s: SprintMachineState, statut: Statut): Prospect[] {
  return tousProspects(s)
    .filter((p) => p.statut === statut)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function compteParStatut(s: SprintMachineState): Record<Statut, number> {
  const out = {} as Record<Statut, number>;
  for (const p of tousProspects(s)) {
    out[p.statut] = (out[p.statut] ?? 0) + 1;
  }
  return out;
}
