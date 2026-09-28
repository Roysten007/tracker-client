import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import confetti from "canvas-confetti";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Flame,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Target as TargetIcon,
  X,
  Zap,
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

  const prospects = useMemo(() => Object.values(s.prospects), [s.prospects]);
  const file = useMemo(() => fileDuJour(prospects, aujourdhui), [prospects, aujourdhui]);

  const totalClients = useMemo(
    () => prospects.filter((p) => p.statut === "client").length,
    [prospects],
  );

  const [modeSprint, setModeSprint] = useState(false);

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
    <div className="pb-10 md:mx-auto md:max-w-4xl">
      {/* Header bandeau */}
      <header
        className="px-5 pb-6 pt-8 text-white md:px-8 md:pt-10 md:pb-8 md:rounded-2xl"
        style={{
          background: "var(--navy-950)",
          paddingTop: "calc(env(safe-area-inset-top) + 24px)",
        }}
      >
        <div
          className="text-[11px] font-bold tracking-[0.22em] uppercase"
          style={{ color: "var(--royal-100)" }}
        >
          ROY STEN DESIGN · MACHINE À CASH
        </div>
        <h1
          className="mt-1 font-display text-white"
          style={{ fontWeight: 800, fontSize: 30, lineHeight: 1.1, letterSpacing: "-0.02em" }}
        >
          Sprint Machine
        </h1>
        <p className="mt-1.5 text-[13px]" style={{ color: "var(--royal-100)" }}>
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

        {/* BOUTON LANCEMENT SPRINT CHRONO WHATSAPP */}
        {file.relances.length + file.aContacter.length > 0 && (
          <button
            onClick={() => setModeSprint(true)}
            className="flex w-full items-center justify-between rounded-2xl p-4.5 text-white shadow-lg transition hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: "linear-gradient(135deg, var(--royal-800), var(--royal-600))",
            }}
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 shadow-inner">
                <Zap size={24} className="text-white animate-pulse" />
              </div>
              <div className="text-left">
                <div className="text-[15px] font-display font-bold">
                  Mode Sprint Chrono WhatsApp
                </div>
                <div className="text-[12px] text-white/80">
                  Enchaîner les {file.relances.length + file.aContacter.length} contacts en 1-clic
                </div>
              </div>
            </div>
            <span className="rounded-xl bg-white px-4 py-2 text-[13px] font-display font-bold text-royal-800 shadow-md">
              Démarrer ➔
            </span>
          </button>
        )}

        {/* File du jour */}
        <section className="card-sc p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
                La file du jour
              </h2>
              <p className="text-[11px] text-hint">Relances prioritaires puis nouveaux contacts</p>
            </div>
            <span
              className="text-[12px] tnum font-bold rounded-full px-2.5 py-0.5"
              style={{ background: "var(--royal-100)", color: "var(--royal-800)" }}
            >
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
                Ajoute un prospect dans la Chasse pour lancer ton prochain sprint.
              </p>
              <Link
                to="/chasse"
                className="btn-primary-sc mt-4 inline-flex items-center gap-2 px-4 py-2.5"
              >
                <Plus size={16} /> Trouver des prospects
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

      {/* MODAL SPRINT FOCUS CHRONO */}
      {modeSprint && (
        <SprintFocusModal file={file} onClose={() => setModeSprint(false)} vibrer={vibrer} />
      )}

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
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 160px)",
            background: "var(--navy-950)",
          }}
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

  const envoyerSurWhatsApp = () => {
    const tel =
      prospect.telephone ||
      (prospect.lien && /^\+?[\d\s]+$/.test(prospect.lien) ? prospect.lien : "");
    const cleanTel = tel.replace(/[^\d]/g, "");
    const msg = message || "";
    const url = cleanTel
      ? `https://wa.me/${cleanTel}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const ouvrirLien = () => {
    if (!prospect.lien) return;
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
      className="rounded-2xl border p-4 transition hover:shadow-sm"
      style={{
        borderColor: enRelance ? "var(--royal-600)" : "#E7E8F4",
        background: enRelance ? "var(--royal-50)" : "#fff",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-display text-[15px]"
              style={{ fontWeight: 700, color: "var(--navy-950)" }}
            >
              {prospect.prenom}
            </span>
            {prospect.entreprise && (
              <span className="text-[12px] font-semibold text-royal-800">
                · {prospect.entreprise}
              </span>
            )}
            <span className="text-[12px]" style={{ color: "var(--hint)" }}>
              · {prospect.metier}
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--royal-800)" }}
            >
              {LABEL_PLATEFORME[prospect.plateforme]}
            </span>
            {prospect.ville && <span className="text-[11px] text-hint">({prospect.ville})</span>}
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
            {prospect.telephone && (
              <span className="font-mono text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                WhatsApp : {prospect.telephone}
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
            rows={6}
            className="w-full resize-none rounded-xl border border-[#E7E8F4] bg-white p-3 text-[13px] leading-relaxed"
            aria-label={`Message ${type} pour ${prospect.prenom}`}
          />
          <div className="text-[10px]" style={{ color: "var(--hint)" }}>
            Script utilisé : <span className="font-semibold">{type}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              onClick={copier}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#E7E8F4] bg-white py-2 text-[12px] font-medium"
              style={{ color: "var(--navy-950)" }}
            >
              <Copy size={14} /> {copie ? "Copié" : "Copier"}
            </button>

            {/* Bouton WhatsApp direct */}
            <button
              onClick={envoyerSurWhatsApp}
              className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-bold text-white shadow-sm transition"
              style={{ background: "#25D366" }}
            >
              <MessageCircle size={15} /> WhatsApp
            </button>

            <button
              onClick={ouvrirLien}
              disabled={!prospect.lien}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#E7E8F4] bg-white py-2 text-[12px] font-medium disabled:opacity-40"
              style={{ color: "var(--navy-950)" }}
            >
              <ExternalLink size={14} /> Profil
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

// -------- MODAL SPRINT FOCUS CHRONO (PROSPECTION EN RAFALE) ------------------

function SprintFocusModal({
  file,
  onClose,
  vibrer,
}: {
  file: { relances: Prospect[]; aContacter: Prospect[] };
  onClose: () => void;
  vibrer: (ms: number) => void;
}) {
  const s = useSprintMachine();
  const liste = useMemo(() => [...file.relances, ...file.aContacter], [file]);
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState<string>("");
  const [chargement, setChargement] = useState(false);
  const [termine, setTermine] = useState(false);
  const [nbEnvoyes, setNbEnvoyes] = useState(0);

  const prospect = liste[index];
  const enRelance = prospect ? file.relances.some((r) => r.id === prospect.id) : false;
  const type = prospect
    ? enRelance
      ? prochainMessage(prospect)
      : premierMessagePourSegment(prospect.segment)
    : "M1";

  // Charger ou générer automatiquement le message pour chaque prospect du sprint
  useEffect(() => {
    if (!prospect) {
      if (liste.length === 0) setTermine(true);
      return;
    }
    let actif = true;
    setChargement(true);
    const service = getServiceIA(s.config);
    service
      .genererMessage(prospect, type)
      .then((msg) => {
        if (actif) {
          setMessage(msg);
          setChargement(false);
        }
      })
      .catch(() => {
        if (actif) {
          setMessage("Bonjour, je vous contacte concernant votre activité...");
          setChargement(false);
        }
      });

    return () => {
      actif = false;
    };
  }, [prospect, type, s.config, liste.length]);

  const envoyerWhatsApp = () => {
    if (!prospect) return;
    const tel =
      prospect.telephone ||
      (prospect.lien && /^\+?[\d\s]+$/.test(prospect.lien) ? prospect.lien : "");
    const cleanTel = tel.replace(/[^\d]/g, "");
    const url = cleanTel
      ? `https://wa.me/${cleanTel}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const validerEnvoiEtSuivant = async () => {
    if (!prospect) return;
    vibrer(15);
    await enregistrerEnvoi(prospect.id, type, message);
    setNbEnvoyes((n) => n + 1);

    if (index + 1 >= liste.length) {
      setTermine(true);
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    } else {
      setIndex((i) => i + 1);
    }
  };

  const passerSuivant = () => {
    if (index + 1 >= liste.length) {
      setTermine(true);
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header du modal */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-royal-100 text-royal-800">
              <Zap size={18} />
            </span>
            <div>
              <h3 className="font-display text-[16px] font-bold text-navy-950">
                Mode Sprint WhatsApp
              </h3>
              <p className="text-[11px] text-hint">
                {termine ? "Sprint complété" : `Prospect ${index + 1} sur ${liste.length}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 text-hint"
          >
            <X size={18} />
          </button>
        </div>

        {termine ? (
          /* Écran de victoire de fin de sprint */
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={44} />
            </div>
            <div>
              <h4 className="font-display text-[22px] font-extrabold text-navy-950">
                Félicitations, Sprint terminé !
              </h4>
              <p className="mt-1 text-[13px] text-hint">
                Tu as envoyé {nbEnvoyes} message{nbEnvoyes > 1 ? "s" : ""} pendant ce sprint. Chaque
                graine plantée te rapproche de ton prochain contrat.
              </p>
            </div>
            <button onClick={onClose} className="btn-primary-sc w-full py-3.5 text-[14px]">
              Retour au tableau de bord
            </button>
          </div>
        ) : (
          /* Vue active du prospect */
          <div className="space-y-4">
            {/* Barre de progression du sprint */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-royal-100">
              <div
                className="h-full bg-royal-800 transition-all duration-300"
                style={{ width: `${((index + 1) / liste.length) * 100}%` }}
              />
            </div>

            {/* Carte d'identité du prospect */}
            <div className="rounded-2xl border p-4 bg-royal-50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-display text-[17px] font-bold text-navy-950">
                  {prospect.prenom} {prospect.entreprise ? `(${prospect.entreprise})` : ""}
                </span>
                <span className="rounded-full bg-royal-800 px-2.5 py-0.5 text-[10px] font-bold text-white">
                  {enRelance && (type === "M4" || type === "M5" || type === "M6")
                    ? libelleBadgeRelance(type)
                    : "Premier contact"}
                </span>
              </div>
              <div className="text-[13px] text-hint">
                {prospect.metier} {prospect.ville ? `· ${prospect.ville}` : ""}
              </div>
              <div className="text-[13px] italic text-ink font-medium">« {prospect.detail} »</div>
              {prospect.telephone && (
                <div className="pt-1 text-[12px] font-mono font-bold text-emerald-700">
                  WhatsApp : {prospect.telephone}
                </div>
              )}
            </div>

            {/* Zone de message */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-semibold text-navy-950">
                  Message personnalisé ({type})
                </span>
                {chargement && <span className="text-[11px] text-hint">Rédaction IA...</span>}
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="w-full resize-none rounded-xl border border-gray-200 p-3 text-[13px] leading-relaxed bg-white focus:outline-none focus:ring-2 focus:ring-royal-600"
              />
            </div>

            {/* Boutons d'action du sprint */}
            <div className="space-y-2 pt-2">
              <button
                onClick={envoyerWhatsApp}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white shadow-md transition hover:opacity-95"
                style={{ background: "#25D366" }}
              >
                <MessageCircle size={18} /> 1. Ouvrir WhatsApp & Envoyer
              </button>

              <div className="flex gap-2">
                <button
                  onClick={validerEnvoiEtSuivant}
                  className="btn-primary-sc flex-1 py-3 text-[13px]"
                >
                  ✓ 2. C'est envoyé ! Suivant ➔
                </button>
                <button
                  onClick={passerSuivant}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[12px] font-medium text-hint hover:bg-gray-50"
                >
                  Passer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
