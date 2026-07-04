import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Download,
  Eye,
  EyeOff,
  MessageCircle,
  MessageSquare,
  PhoneCall,
  Settings,
  Sparkles,
  UserCheck,
} from "lucide-react";

import {
  getJour,
  mettreAJourConfig,
  remplacerJour,
  tousProspects,
  useHydraterSM,
  useSprintMachine,
} from "../lib/store2";
import { getServiceIA, type DonneesRapport } from "../services/ia";
import { addDays, formatShortFr, todayKey } from "../lib/date";
import type { DayStats, Plateforme, Segment, Statut } from "../lib/types";
import { LABEL_PLATEFORME, LABEL_SEGMENT } from "../lib/types";
import { signOutUser } from "../lib/auth";

export const Route = createFileRoute("/rapport")({
  head: () => ({
    meta: [
      { title: "Rapport — Sprint Machine" },
      { name: "description", content: "Ton point du soir, le Labo, les réglages." },
    ],
  }),
  component: RapportPage,
});

function RapportPage() {
  useHydraterSM();
  const s = useSprintMachine();
  const aujourdhui = todayKey();
  const jour = getJour(s, aujourdhui);
  const objectif = s.config.objectifQuotidien;

  const prospects = useMemo(() => tousProspects(s), [s.prospects]);

  // 14 derniers jours (pour le graphique).
  const quatorzeJours = useMemo(() => {
    const arr: { key: string; sent: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const k = addDays(aujourdhui, -i);
      arr.push({ key: k, sent: getJour(s, k).sent });
    }
    return arr;
  }, [s.jours, aujourdhui]);

  // Totaux cumulés (envoyés + réponses + appels + clients).
  const totaux = useMemo(() => {
    const t: DayStats = { sent: 0, replies: 0, calls: 0, clients: 0 };
    for (const j of Object.values(s.jours)) {
      t.sent += j.sent;
      t.replies += j.replies;
      t.calls += j.calls;
      t.clients += j.clients;
    }
    return t;
  }, [s.jours]);

  // Streak (jours consécutifs à ≥ objectif).
  const streakJours = useMemo(() => {
    let cursor = aujourdhui;
    if ((s.jours[cursor]?.sent ?? 0) < objectif) cursor = addDays(cursor, -1);
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const j = s.jours[cursor];
      if (!j || j.sent < objectif) break;
      n++;
      cursor = addDays(cursor, -1);
    }
    return n;
  }, [s.jours, aujourdhui, objectif]);

  // Compte pipeline par statut.
  const pipelineParStatut = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of prospects) {
      out[p.statut] = (out[p.statut] ?? 0) + 1;
    }
    return out;
  }, [prospects]);

  // Relances dues demain.
  const relancesDemain = useMemo(() => {
    const demain = addDays(aujourdhui, 1);
    return prospects.filter(
      (p) => p.prochaineActionDate && p.prochaineActionDate <= demain,
    ).length;
  }, [prospects, aujourdhui]);

  // --- Rapport du soir ------------------------------------------------------
  const [rapport, setRapport] = useState<string | null>(null);
  const [rapportEnCours, setRapportEnCours] = useState(false);

  const genererRapport = async () => {
    setRapportEnCours(true);
    setRapport(null);
    try {
      const donnees: DonneesRapport = {
        aujourdhui: new Date().toLocaleDateString("fr-FR", {
          timeZone: "Africa/Porto-Novo",
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        chiffresJour: jour,
        objectifQuotidien: objectif,
        totauxCumules: totaux,
        pipelineParStatut,
        relancesDemain,
        streakJours,
        quatorzeJours,
      };
      const service = getServiceIA(s.config);
      const texte = await service.rapportDuSoir(donnees);
      setRapport(texte);
    } catch (e) {
      setRapport(
        `[Rapport indisponible — ${e instanceof Error ? e.message : "erreur inconnue"}]`,
      );
    } finally {
      setRapportEnCours(false);
    }
  };

  const [reglagesOuverts, setReglagesOuverts] = useState(false);

  return (
    <div className="pb-6 md:mx-auto md:max-w-3xl">
      <header
        className="px-5 pb-5 pt-8 text-white md:px-8 md:pt-10 md:rounded-2xl"
        style={{
          background: "var(--navy-950)",
          paddingTop: "calc(env(safe-area-inset-top) + 24px)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-white" style={{ fontWeight: 800, fontSize: 26 }}>
              Rapport
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: "var(--royal-100)" }}>
              Point du soir · Labo · réglages
            </p>
          </div>
          <button
            onClick={() => setReglagesOuverts((v) => !v)}
            aria-label="Réglages"
            className="rounded-xl bg-white/10 p-2"
          >
            <Settings size={18} color="#fff" />
          </button>
        </div>
      </header>

      <div className="p-4 space-y-5 md:mt-6">
        {/* Rapport du soir */}
        <section className="card-sc p-5">
          <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
            Mon point du soir
          </h2>
          <p className="text-[12px]" style={{ color: "var(--hint)" }}>
            {s.config.modeIA === "gemini" && s.config.geminiKey
              ? "Rédigé par l'IA."
              : "Rédigé sans IA (mode gabarits)."}
          </p>
          <button
            onClick={genererRapport}
            disabled={rapportEnCours}
            className="btn-primary-sc mt-3 flex w-full items-center justify-center gap-2 py-3"
          >
            <Sparkles size={16} /> {rapportEnCours ? "Rédaction…" : "Générer mon point du soir"}
          </button>
          {rapport && (
            <div
              className="mt-4 whitespace-pre-wrap rounded-xl p-4 text-[13px] leading-relaxed"
              style={{ background: "var(--royal-50)", color: "var(--navy-950)" }}
            >
              {rapport}
            </div>
          )}
        </section>

        {/* Labo — ce qui marche */}
        <SectionLabo prospects={prospects} />

        {/* Entonnoir cumulé */}
        <SectionEntonnoir totaux={totaux} />

        {/* Graphique 14 jours */}
        <SectionGraphique14j quatorzeJours={quatorzeJours} aujourdhui={aujourdhui} objectif={objectif} />

        {/* Historique par jour */}
        <SectionHistoriqueJours jours={s.jours} objectif={objectif} />

        {reglagesOuverts && <SectionReglages />}
      </div>
    </div>
  );
}

// ============================================================================
// Section Labo — taux de réponse par segment et par plateforme
// ============================================================================

type ProspectMinimal = { segment: Segment; plateforme: Plateforme; statut: Statut };

function SectionLabo({ prospects }: { prospects: ProspectMinimal[] }) {
  const stats = useMemo(() => {
    // Compte "envoyé" = tout prospect ayant dépassé a_contacter.
    // Compte "répondu" = statut repondu OU au-delà (appel, client).
    const parSegment: Record<Segment, { envoyes: number; repondus: number }> = {
      chaud: { envoyes: 0, repondus: 0 },
      diaspora: { envoyes: 0, repondus: 0 },
      creatif: { envoyes: 0, repondus: 0 },
    };
    const parPlateforme: Record<Plateforme, { envoyes: number; repondus: number }> = {
      whatsapp: { envoyes: 0, repondus: 0 },
      linkedin: { envoyes: 0, repondus: 0 },
      instagram: { envoyes: 0, repondus: 0 },
      facebook: { envoyes: 0, repondus: 0 },
    };
    const statutsPostContact: Statut[] = [
      "envoye",
      "relance_douce",
      "relance_prix",
      "cloture",
      "repondu",
      "appel",
      "client",
      "sans_suite",
    ];
    const statutsRepondu: Statut[] = ["repondu", "appel", "client"];
    for (const p of prospects) {
      if (statutsPostContact.includes(p.statut)) {
        parSegment[p.segment].envoyes++;
        parPlateforme[p.plateforme].envoyes++;
      }
      if (statutsRepondu.includes(p.statut)) {
        parSegment[p.segment].repondus++;
        parPlateforme[p.plateforme].repondus++;
      }
    }
    return { parSegment, parPlateforme };
  }, [prospects]);

  return (
    <section className="card-sc p-5">
      <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
        Le Labo — ce qui marche
      </h2>
      <p className="text-[12px]" style={{ color: "var(--hint)" }}>
        Taux de réponse par segment et par plateforme.
      </p>

      <div className="mt-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--hint)" }}>
          Par segment
        </h3>
        <div className="mt-2 space-y-2">
          {(Object.keys(stats.parSegment) as Segment[]).map((sg) => (
            <LigneTaux key={sg} label={LABEL_SEGMENT[sg]} n={stats.parSegment[sg]} />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--hint)" }}>
          Par plateforme
        </h3>
        <div className="mt-2 space-y-2">
          {(Object.keys(stats.parPlateforme) as Plateforme[]).map((pl) => (
            <LigneTaux key={pl} label={LABEL_PLATEFORME[pl]} n={stats.parPlateforme[pl]} />
          ))}
        </div>
      </div>
    </section>
  );
}

function LigneTaux({ label, n }: { label: string; n: { envoyes: number; repondus: number } }) {
  const pasAssez = n.envoyes < 10;
  const taux = n.envoyes > 0 ? Math.round((n.repondus / n.envoyes) * 100) : 0;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#EDEEF7] px-3 py-2">
      <div className="flex-1 text-[13px] font-medium" style={{ color: "var(--navy-950)" }}>
        {label}
      </div>
      <div className="text-[11px]" style={{ color: "var(--hint)" }}>
        {n.repondus}/{n.envoyes}
      </div>
      <div
        className="tnum rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{
          background: pasAssez ? "#f0f0f5" : "var(--royal-100)",
          color: pasAssez ? "var(--hint)" : "var(--royal-800)",
        }}
      >
        {pasAssez ? "—" : `${taux}%`}
      </div>
    </div>
  );
}

// ============================================================================
// Section Entonnoir cumulé
// ============================================================================

function SectionEntonnoir({ totaux }: { totaux: DayStats }) {
  const max = Math.max(1, totaux.sent);
  const rows = [
    { label: "Messages", value: totaux.sent, icon: MessageSquare, prev: null as number | null },
    { label: "Réponses", value: totaux.replies, icon: MessageCircle, prev: totaux.sent },
    { label: "Appels", value: totaux.calls, icon: PhoneCall, prev: totaux.replies },
    { label: "Clients", value: totaux.clients, icon: UserCheck, prev: totaux.calls },
  ];

  return (
    <section className="card-sc p-5">
      <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
        Ton entonnoir
      </h2>
      <p className="text-[12px]" style={{ color: "var(--hint)" }}>
        Totaux depuis le début — % de conversion entre étapes.
      </p>
      <div className="mt-4 space-y-3">
        {rows.map((r) => {
          const w = Math.round((r.value / max) * 100);
          const conv = r.prev === null ? null : r.prev === 0 ? null : Math.round((r.value / r.prev) * 100);
          return (
            <div key={r.label}>
              <div className="flex items-center gap-2">
                <r.icon size={14} style={{ color: "var(--hint)" }} />
                <div className="flex-1 text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                  {r.label}
                </div>
                <div className="font-display tnum text-[14px]" style={{ fontWeight: 700 }}>
                  {r.value}
                </div>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full"
                style={{ background: "var(--royal-100)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(w, r.value > 0 ? 3 : 0)}%`,
                    background: "var(--royal-800)",
                  }}
                />
              </div>
              {r.prev !== null && (
                <div className="mt-1 text-[11px]" style={{ color: "var(--hint)" }}>
                  {conv === null ? "—" : `${conv}%`} de conversion
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================================
// Section Graphique 14 jours
// ============================================================================

function SectionGraphique14j({
  quatorzeJours,
  aujourdhui,
  objectif,
}: {
  quatorzeJours: { key: string; sent: number }[];
  aujourdhui: string;
  objectif: number;
}) {
  const max = Math.max(objectif, ...quatorzeJours.map((j) => j.sent), 1);
  return (
    <section className="card-sc p-5">
      <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
        14 derniers jours
      </h2>
      <p className="text-[12px]" style={{ color: "var(--hint)" }}>
        Messages envoyés par jour · ligne pointillée = objectif.
      </p>
      <div className="relative mt-4 h-[140px]">
        <div
          className="pointer-events-none absolute left-0 right-0 border-t border-dashed"
          style={{
            bottom: `${(objectif / max) * 100}%`,
            borderColor: "var(--royal-600)",
            opacity: 0.5,
          }}
          aria-hidden
        />
        <div className="flex h-full items-end gap-1.5">
          {quatorzeJours.map((j) => {
            const h = Math.max(2, Math.round((j.sent / max) * 100));
            const estAujourdhui = j.key === aujourdhui;
            const atteint = j.sent >= objectif;
            let bg = "transparent";
            let border = "1px solid var(--royal-100)";
            if (estAujourdhui) { bg = "var(--royal-600)"; border = "none"; }
            else if (atteint) { bg = "var(--royal-800)"; border = "none"; }
            else { bg = "var(--royal-100)"; border = "1px solid #dcdef4"; }
            return (
              <div
                key={j.key}
                aria-label={`${j.key}: ${j.sent} messages`}
                className="relative flex-1 rounded-t-md"
                style={{ height: `${h}%`, background: bg, border, minHeight: 4 }}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Section Historique par jour (éditable)
// ============================================================================

function SectionHistoriqueJours({
  jours,
  objectif,
}: {
  jours: Record<string, DayStats>;
  objectif: number;
}) {
  const cles = useMemo(() => Object.keys(jours).sort((a, b) => (a < b ? 1 : -1)), [jours]);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [edit, setEdit] = useState<DayStats>({ sent: 0, replies: 0, calls: 0, clients: 0 });

  const ouvrir = (k: string) => {
    setEditKey(k);
    setEdit(jours[k] ?? { sent: 0, replies: 0, calls: 0, clients: 0 });
  };

  const enregistrer = async () => {
    if (!editKey) return;
    await remplacerJour(editKey, edit);
    setEditKey(null);
  };

  return (
    <section className="card-sc p-5">
      <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
        Historique
      </h2>
      <p className="text-[12px]" style={{ color: "var(--hint)" }}>
        {cles.length} jour{cles.length > 1 ? "s" : ""} enregistré{cles.length > 1 ? "s" : ""} — tape pour éditer.
      </p>
      {cles.length === 0 ? (
        <p className="mt-3 text-[12px]" style={{ color: "var(--hint)" }}>
          Aucun jour enregistré pour l'instant.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[#EDEEF7]">
          {cles.slice(0, 20).map((k) => {
            const j = jours[k];
            const atteint = j.sent >= objectif;
            return (
              <li key={k}>
                <button
                  onClick={() => ouvrir(k)}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <div
                    className="font-display text-[13px] capitalize flex-1"
                    style={{ fontWeight: 600, color: "var(--navy-950)" }}
                  >
                    {formatShortFr(k)}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] tnum" style={{ color: "var(--hint)" }}>
                    <span>{j.sent}m</span>
                    <span>{j.replies}r</span>
                    <span>{j.calls}a</span>
                    <span>{j.clients}c</span>
                  </div>
                  {atteint && (
                    <span
                      aria-label="Objectif atteint"
                      className="h-2 w-2 rounded-full"
                      style={{ background: "var(--royal-800)" }}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editKey && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
          onClick={() => setEditKey(null)}
        >
          <div
            role="dialog"
            className="w-full max-w-md rounded-t-3xl bg-white p-5 md:rounded-3xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E7E8F4] md:hidden" />
            <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18 }}>
              {formatShortFr(editKey)}
            </h3>
            <div className="mt-4 space-y-2">
              {(
                [
                  ["sent", "Messages"],
                  ["replies", "Réponses"],
                  ["calls", "Appels"],
                  ["clients", "Clients"],
                ] as const
              ).map(([k, lib]) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-xl border border-[#E7E8F4] bg-white px-3 py-2.5"
                >
                  <div>
                    <div className="text-[12px]" style={{ color: "var(--hint)" }}>{lib}</div>
                    <div className="font-display tnum" style={{ fontWeight: 700, fontSize: 22 }}>
                      {edit[k]}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEdit((v) => ({ ...v, [k]: Math.max(0, v[k] - 1) }))}
                      className="stepper-btn"
                    >−</button>
                    <button
                      onClick={() => setEdit((v) => ({ ...v, [k]: v[k] + 1 }))}
                      className="stepper-btn"
                      style={{ background: "var(--royal-800)", color: "#fff" }}
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setEditKey(null)}
                className="rounded-xl border border-[#E7E8F4] py-3 font-display"
                style={{ fontWeight: 600 }}
              >
                Annuler
              </button>
              <button onClick={enregistrer} className="btn-primary-sc py-3">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Section Réglages
// ============================================================================

function SectionReglages() {
  const s = useSprintMachine();
  const [afficherCle, setAfficherCle] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const exporter = () => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sprint-machine-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card-sc p-5">
      <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
        Réglages
      </h2>

      <div className="mt-4 space-y-4">
        <ChampConfig label="Objectif quotidien (messages)">
          <input
            type="number"
            min={1}
            value={s.config.objectifQuotidien}
            onChange={(e) =>
              mettreAJourConfig({
                objectifQuotidien: Math.max(1, Number(e.target.value) || 1),
              })
            }
            className="input-sc tnum"
            inputMode="numeric"
          />
        </ChampConfig>

        <ChampConfig label="Prix actuel (pour le script M5)">
          <input
            value={s.config.prixActuel}
            onChange={(e) => mettreAJourConfig({ prixActuel: e.target.value })}
            placeholder="150 000 F"
            className="input-sc"
          />
        </ChampConfig>

        <ChampConfig label="Prix suivant">
          <input
            value={s.config.prixSuivant}
            onChange={(e) => mettreAJourConfig({ prixSuivant: e.target.value })}
            placeholder="200 000 F"
            className="input-sc"
          />
        </ChampConfig>

        <ChampConfig label="Date de hausse">
          <input
            value={s.config.dateHausse}
            onChange={(e) => mettreAJourConfig({ dateHausse: e.target.value })}
            placeholder="15 août"
            className="input-sc"
          />
        </ChampConfig>

        <ChampConfig label="Mode IA">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => mettreAJourConfig({ modeIA: "gabarits" })}
              className="rounded-xl border py-2.5 text-[13px] font-medium"
              style={{
                borderColor: s.config.modeIA === "gabarits" ? "var(--royal-800)" : "#E7E8F4",
                background: s.config.modeIA === "gabarits" ? "var(--royal-100)" : "#fff",
                color: s.config.modeIA === "gabarits" ? "var(--royal-800)" : "var(--ink)",
                fontWeight: s.config.modeIA === "gabarits" ? 700 : 500,
              }}
            >
              Gabarits (sans IA)
            </button>
            <button
              onClick={() => mettreAJourConfig({ modeIA: "gemini" })}
              className="rounded-xl border py-2.5 text-[13px] font-medium"
              style={{
                borderColor: s.config.modeIA === "gemini" ? "var(--royal-800)" : "#E7E8F4",
                background: s.config.modeIA === "gemini" ? "var(--royal-100)" : "#fff",
                color: s.config.modeIA === "gemini" ? "var(--royal-800)" : "var(--ink)",
                fontWeight: s.config.modeIA === "gemini" ? 700 : 500,
              }}
            >
              Gemini (gratuit)
            </button>
          </div>
        </ChampConfig>

        <ChampConfig label="Clé Gemini">
          <div className="relative">
            <input
              type={afficherCle ? "text" : "password"}
              value={s.config.geminiKey}
              onChange={(e) => mettreAJourConfig({ geminiKey: e.target.value })}
              placeholder="AI..."
              className="input-sc pr-10"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setAfficherCle((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5"
              aria-label={afficherCle ? "Cacher la clé" : "Afficher la clé"}
            >
              {afficherCle ? (
                <EyeOff size={14} style={{ color: "var(--hint)" }} />
              ) : (
                <Eye size={14} style={{ color: "var(--hint)" }} />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--hint)" }}>
            Gratuite, sans carte : {" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
              style={{ color: "var(--royal-800)" }}
            >
              aistudio.google.com/apikey
            </a>
            . Restreins-la à ton domaine dans la console Google.
          </p>
        </ChampConfig>

        <div className="pt-2 space-y-2">
          <button
            onClick={exporter}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E7E8F4] bg-white px-4 py-3 font-display"
            style={{ fontWeight: 600, color: "var(--navy-950)" }}
          >
            <Download size={18} /> Exporter mes données (JSON)
          </button>
          <button
            onClick={() => signOutUser()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E7E8F4] bg-white px-4 py-3 font-display"
            style={{ fontWeight: 600, color: "var(--navy-950)" }}
          >
            Se déconnecter
          </button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="application/json,.json" hidden />

      <p className="mt-5 pt-3 text-center text-[11px]" style={{ color: "var(--hint)" }}>
        Sprint Machine V1 · Roy Sten Design
      </p>
    </section>
  );
}

function ChampConfig({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px]" style={{ color: "var(--hint)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
