import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import confetti from "canvas-confetti";
import {
  Copy,
  ExternalLink,
  Flame,
  Plus,
  Send,
  Sparkles,
  Target as TargetIcon,
} from "lucide-react";

import { formatLongFr, todayKey } from "../lib/date";
import {
  fileDuJour,
  libelleBadgeRelance,
  premierMessagePourSegment,
  prochainMessage,
} from "../lib/relances";
import type { Prospect } from "../lib/types";
import { LABEL_PLATEFORME, LABEL_SEGMENT } from "../lib/types";
import {
  enregistrerEnvoi,
  getJour,
  incrementerJour,
  mettreAJourConfig,
  tousProspects,
  useHydraterSM,
  useSprintMachine,
} from "../lib/store2";
import { getServiceIA } from "../services/ia";

export const Route = createFileRoute("/")({
  component: AujourdhuiPage,
});

function AujourdhuiPage() {
  useHydraterSM();
  const s = useSprintMachine();
  const aujourdhui = todayKey();
  const jour = getJour(s, aujourdhui);
  const objectif = s.config.objectifQuotidien;
  const progression = Math.min(100, Math.round((jour.sent / objectif) * 100));
  const objectifAtteint = jour.sent >= objectif;

  const prospects = useMemo(() => tousProspects(s), [s.prospects]);
  const file = useMemo(() => fileDuJour(prospects, aujourdhui), [prospects, aujourdhui]);

  const totalClients = useMemo(
    () => prospects.filter((p) => p.statut === "client").length,
    [prospects],
  );

  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // Confetti au premier client cumulé.
  useEffect(() => {
    if (totalClients >= 1 && !s.config.premierClientCelebre) {
      mettreAJourConfig({ premierClientCelebre: true });
      if (!reduced) {
        const colors = ["#0A0A78", "#2E36C8", "#06063E", "#FFFFFF"];
        const end = Date.now() + 1500;
        const frame = () => {
          confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
          confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
          if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
      }
    }
  }, [totalClients, s.config.premierClientCelebre, reduced]);

  // Toast pour repli IA (émis par services/ia.ts).
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    const cb = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setToast(detail);
      setTimeout(() => setToast(null), 4000);
    };
    window.addEventListener("sprint-machine:ia-repli", cb);
    return () => window.removeEventListener("sprint-machine:ia-repli", cb);
  }, []);

  const vibrer = (ms: number) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="pb-6 md:mx-auto md:max-w-4xl">
      {/* Header bandeau */}
      <header
        className="px-5 pb-6 pt-8 text-white md:px-8 md:pt-10 md:pb-8"
        style={{
          background: "var(--navy-950)",
          paddingTop: "calc(env(safe-area-inset-top) + 24px)",
        }}
      >
        <div
          className="text-[11px] font-medium tracking-[0.22em] md:hidden"
          style={{ color: "var(--royal-100)" }}
        >
          ROY STEN DESIGN
        </div>
        <h1
          className="mt-1.5 font-display text-white md:mt-0"
          style={{ fontWeight: 800, fontSize: 30, lineHeight: 1.1, letterSpacing: "-0.02em" }}
        >
          Sprint Machine
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: "var(--royal-100)" }}>
          {formatLongFr(aujourdhui)}
        </p>
      </header>

      <div className="px-4 pt-0 -mt-3 md:px-8 md:mt-8 space-y-4">
        {/* Compteur du jour */}
        <section className="card-sc p-5">
          <div className="text-[13px]" style={{ color: "var(--hint)" }}>
            Messages envoyés aujourd'hui
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className="font-display tnum"
              style={{ fontWeight: 800, fontSize: 60, lineHeight: 1, color: "var(--navy-950)" }}
            >
              {jour.sent}
            </span>
            <span
              className="font-display tnum"
              style={{ fontWeight: 700, fontSize: 22, color: "var(--hint)" }}
            >
              / {objectif}
            </span>
          </div>
          <div
            className="mt-4 h-2.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--royal-100)" }}
            role="progressbar"
            aria-valuenow={jour.sent}
            aria-valuemin={0}
            aria-valuemax={objectif}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progression}%`,
                background: "linear-gradient(90deg, var(--royal-800), var(--royal-600))",
                transition: reduced ? undefined : "width 320ms ease",
              }}
            />
          </div>
          {objectifAtteint && (
            <div
              className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
              style={{ background: "var(--royal-800)" }}
            >
              ✓ Objectif du jour atteint
            </div>
          )}
        </section>

        {/* Mini-steppers */}
        <section className="grid grid-cols-3 gap-3">
          <TuileStepper
            libelle="Réponses"
            valeur={jour.replies}
            onMoins={() => incrementerJour(aujourdhui, "replies", -1)}
            onPlus={() => {
              incrementerJour(aujourdhui, "replies", 1);
              vibrer(8);
            }}
            aria="réponse"
          />
          <TuileStepper
            libelle="Appels"
            valeur={jour.calls}
            onMoins={() => incrementerJour(aujourdhui, "calls", -1)}
            onPlus={() => {
              incrementerJour(aujourdhui, "calls", 1);
              vibrer(8);
            }}
            aria="appel"
          />
          <TuileStepper
            libelle="Clients"
            valeur={jour.clients}
            surligne
            onMoins={() => incrementerJour(aujourdhui, "clients", -1)}
            onPlus={() => {
              incrementerJour(aujourdhui, "clients", 1);
              vibrer(15);
            }}
            aria="client"
          />
        </section>

        {/* Série + total clients */}
        <section className="grid grid-cols-2 gap-3">
          <div className="card-sc p-4">
            <div
              className="flex items-center gap-1.5 text-[12px] font-medium"
              style={{ color: "var(--hint)" }}
            >
              <Flame size={14} style={{ color: "var(--royal-800)" }} /> Total clients
            </div>
            <div
              className="mt-1 font-display tnum"
              style={{ fontWeight: 700, fontSize: 28, color: "var(--navy-950)" }}
            >
              {totalClients}
            </div>
          </div>
          <div className="card-sc p-4">
            <div className="text-[12px] font-medium" style={{ color: "var(--hint)" }}>
              Prospects en cours
            </div>
            <div
              className="mt-1 font-display tnum"
              style={{ fontWeight: 700, fontSize: 28, color: "var(--navy-950)" }}
            >
              {prospects.length}
            </div>
          </div>
        </section>

        {/* File du jour */}
        <section className="card-sc p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
              La file du jour
            </h2>
            <span className="text-[12px] tnum" style={{ color: "var(--hint)" }}>
              {file.relances.length + file.aContacter.length} à traiter
            </span>
          </div>

          {file.relances.length + file.aContacter.length === 0 ? (
            <div className="mt-5 flex flex-col items-center py-6 text-center">
              <div
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: "var(--royal-100)" }}
              >
                <TargetIcon size={26} style={{ color: "var(--royal-800)" }} />
              </div>
              <p className="text-[14px]" style={{ color: "var(--navy-950)" }}>
                Personne dans la file pour l'instant.
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--hint)" }}>
                Ajoute un prospect dans la Chasse.
              </p>
              <Link
                to="/chasse"
                className="btn-primary-sc mt-4 inline-flex items-center gap-2 px-4 py-2.5"
              >
                <Plus size={16} /> Ajouter un prospect
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {file.relances.map((p) => (
                <CarteProspect key={p.id} prospect={p} enRelance vibrer={vibrer} />
              ))}
              {file.aContacter.map((p) => (
                <CarteProspect key={p.id} prospect={p} vibrer={vibrer} />
              ))}
            </div>
          )}
        </section>

        <p className="pt-2 pb-2 text-center text-[12px] italic" style={{ color: "var(--hint)" }}>
          On apprend. On ajuste. On avance.
        </p>
      </div>

      {/* Bouton flottant + Prospect */}
      <Link
        to="/chasse"
        aria-label="Ajouter un prospect"
        className="fixed z-40 flex items-center justify-center rounded-full text-white shadow-lg md:hidden"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 88px)",
          right: 16,
          width: 56,
          height: 56,
          background: "var(--royal-800)",
        }}
      >
        <Plus size={26} />
      </Link>

      {/* Toast repli IA */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[12px] text-white shadow-lg"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 160px)", background: "var(--navy-950)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

// -------- Tuile stepper (Réponses / Appels / Clients) ------------------------

function TuileStepper({
  libelle,
  valeur,
  surligne,
  onMoins,
  onPlus,
  aria,
}: {
  libelle: string;
  valeur: number;
  surligne?: boolean;
  onMoins: () => void;
  onPlus: () => void;
  aria: string;
}) {
  return (
    <div
      className="card-sc flex flex-col p-3"
      style={surligne ? { background: "var(--royal-100)", borderColor: "#d5d8f2" } : undefined}
    >
      <div className="text-[12px] font-medium" style={{ color: "var(--hint)" }}>
        {libelle}
      </div>
      <div
        className="mt-1 font-display tnum"
        style={{ fontWeight: 700, fontSize: 26, color: "var(--navy-950)" }}
      >
        {valeur}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button
          onClick={onMoins}
          disabled={valeur === 0}
          aria-label={`Retirer un ${aria}`}
          className="stepper-btn"
        >
          −
        </button>
        <button
          onClick={onPlus}
          aria-label={`Ajouter un ${aria}`}
          className="stepper-btn"
          style={{ background: "var(--royal-800)", color: "#fff" }}
        >
          +
        </button>
      </div>
    </div>
  );
}

// -------- Carte prospect dans la File du jour --------------------------------

function CarteProspect({
  prospect,
  enRelance,
  vibrer,
}: {
  prospect: Prospect;
  enRelance?: boolean;
  vibrer: (ms: number) => void;
}) {
  const s = useSprintMachine();
  const [message, setMessage] = useState<string | null>(null);
  const [generation, setGeneration] = useState(false);
  const [copie, setCopie] = useState(false);

  const type = enRelance ? prochainMessage(prospect) : premierMessagePourSegment(prospect.segment);

  const generer = async () => {
    setGeneration(true);
    try {
      const service = getServiceIA(s.config);
      const texte = await service.genererMessage(prospect, type);
      setMessage(texte);
    } catch (e) {
      setMessage(
        `[Génération indisponible — ${e instanceof Error ? e.message : "erreur inconnue"}]`,
      );
    } finally {
      setGeneration(false);
    }
  };

  const copier = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopie(true);
      setTimeout(() => setCopie(false), 1600);
    } catch {
      /* clipboard indisponible */
    }
  };

  const ouvrirLien = () => {
    if (!prospect.lien) return;
    // WhatsApp : si le lien est un numéro brut (chiffres/espaces/+), construire le deep link.
    const nettoye = prospect.lien.trim();
    const estNumero = /^\+?[\d\s]+$/.test(nettoye);
    const url =
      prospect.plateforme === "whatsapp" && estNumero
        ? `https://wa.me/${nettoye.replace(/[^\d]/g, "")}`
        : nettoye.startsWith("http")
          ? nettoye
          : `https://${nettoye}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const marquerEnvoye = async () => {
    if (!message) return;
    vibrer(15);
    await enregistrerEnvoi(prospect.id, type, message);
    setMessage(null);
  };

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: enRelance ? "var(--royal-600)" : "#E7E8F4",
        background: enRelance ? "var(--royal-50)" : "#fff",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-[15px]" style={{ fontWeight: 700, color: "var(--navy-950)" }}>
              {prospect.prenom}
            </span>
            <span className="text-[12px]" style={{ color: "var(--hint)" }}>
              · {prospect.metier}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--royal-800)" }}>
              {LABEL_PLATEFORME[prospect.plateforme]}
            </span>
          </div>
          <div className="mt-1 text-[13px] italic" style={{ color: "var(--ink)" }}>
            « {prospect.detail} »
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--royal-100)", color: "var(--royal-800)" }}
            >
              {LABEL_SEGMENT[prospect.segment]}
            </span>
            {enRelance && prospect.prochaineActionType && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                style={{ background: "var(--royal-800)" }}
              >
                {libelleBadgeRelance(prospect.prochaineActionType)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Zone message / actions */}
      {message === null ? (
        <button
          onClick={generer}
          disabled={generation}
          className="btn-primary-sc mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-[14px]"
        >
          <Sparkles size={16} /> {generation ? "Génération…" : `Générer le message (${type})`}
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={7}
            className="w-full resize-none rounded-xl border border-[#E7E8F4] bg-white p-3 text-[13px] leading-relaxed"
            aria-label={`Message ${type} pour ${prospect.prenom}`}
          />
          <div className="text-[10px]" style={{ color: "var(--hint)" }}>
            Script utilisé : <span className="font-semibold">{type}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={copier}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#E7E8F4] bg-white py-2 text-[12px] font-medium"
              style={{ color: "var(--navy-950)" }}
            >
              <Copy size={14} /> {copie ? "Copié" : "Copier"}
            </button>
            <button
              onClick={ouvrirLien}
              disabled={!prospect.lien}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#E7E8F4] bg-white py-2 text-[12px] font-medium disabled:opacity-40"
              style={{ color: "var(--navy-950)" }}
            >
              <ExternalLink size={14} /> Ouvrir
            </button>
            <button
              onClick={marquerEnvoye}
              className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold text-white"
              style={{ background: "var(--royal-800)" }}
            >
              <Send size={14} /> Envoyé
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

