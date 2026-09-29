import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Flame,
  Globe,
  MapPin,
  MessageCircle,
  PhoneCall,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  X,
  XCircle,
  Zap,
} from "lucide-react";

import {
  abonnerMessagesProspect,
  calculerValeurPipeline,
  mettreAJourProspect,
  supprimerProspect,
  tousProspects,
  transitionStatut,
  useHydraterSM,
  useSprintMachine,
} from "../lib/store2";
import type { Message, Plateforme, Prospect, Statut } from "../lib/types";
import { LABEL_PLATEFORME, LABEL_SEGMENT, LABEL_STATUT, ORDRE_STATUT_PIPELINE } from "../lib/types";
import {
  patchAppelPrevu,
  patchCestUnClient,
  patchIlARepondu,
  patchSansSuite,
} from "../lib/relances";
import { formatShortFr } from "../lib/date";
import { getServiceIA } from "../services/ia";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline Commercial — Sprint Machine" },
      {
        name: "description",
        content: "Tes prospects par statut, du premier contact au client signé.",
      },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  useHydraterSM();
  const s = useSprintMachine();
  const prospects = useMemo(() => Object.values(s.prospects), [s.prospects]);

  const [recherche, setRecherche] = useState("");
  const [plateformeFiltre, setPlateformeFiltre] = useState<string>("tous");

  // Filtrage intelligent
  const prospectsFiltres = useMemo(() => {
    return prospects.filter((p) => {
      // Filtre plateforme
      if (plateformeFiltre !== "tous" && p.plateforme !== plateformeFiltre) {
        return false;
      }
      // Filtre recherche
      if (!recherche.trim()) return true;
      const q = recherche.toLowerCase();
      return (
        p.prenom.toLowerCase().includes(q) ||
        (p.entreprise && p.entreprise.toLowerCase().includes(q)) ||
        (p.telephone && p.telephone.toLowerCase().includes(q)) ||
        (p.ville && p.ville.toLowerCase().includes(q)) ||
        p.metier.toLowerCase().includes(q) ||
        p.detail.toLowerCase().includes(q)
      );
    });
  }, [prospects, recherche, plateformeFiltre]);

  const valeurPipeline = useMemo(() => {
    return calculerValeurPipeline(prospectsFiltres);
  }, [prospectsFiltres]);

  const groupes = useMemo(() => {
    const map = new Map<Statut, Prospect[]>();
    for (const st of ORDRE_STATUT_PIPELINE) map.set(st, []);
    for (const p of prospectsFiltres) {
      map.get(p.statut)?.push(p);
    }
    // Tri : plus récent d'abord dans chaque groupe.
    for (const arr of map.values()) {
      arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return map;
  }, [prospectsFiltres]);

  const [ouverts, setOuverts] = useState<Set<Statut>>(
    () => new Set(["a_contacter", "envoye", "relance_douce", "relance_prix", "repondu", "appel"]),
  );
  const [fiche, setFiche] = useState<Prospect | null>(null);

  const basculer = (st: Statut) => {
    setOuverts((prev) => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st);
      else next.add(st);
      return next;
    });
  };

  return (
    <div className="pb-10 md:mx-auto md:max-w-4xl">
      <header
        className="px-5 pb-6 pt-8 text-white md:px-8 md:pt-10 md:pb-8 md:rounded-2xl"
        style={{
          background: "var(--navy-950)",
          paddingTop: "calc(env(safe-area-inset-top) + 24px)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: "var(--royal-100)" }}
            >
              GESTION COMMERCIALE & CLOSING
            </div>
            <h1 className="mt-1 font-display text-white" style={{ fontWeight: 800, fontSize: 28 }}>
              Pipeline
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: "var(--royal-100)" }}>
              {prospects.length} prospect{prospects.length > 1 ? "s" : ""} au total
            </p>
          </div>

          {/* Valeur totale du pipeline */}
          <div className="rounded-2xl bg-white/10 px-4 py-2.5 backdrop-blur-sm text-right border border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-royal-100">
              Deal Flow Estimé
            </div>
            <div className="font-display font-extrabold text-[18px] text-white">
              {valeurPipeline.toLocaleString("fr-FR")} FCFA
            </div>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="mt-5 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher par nom, entreprise, WhatsApp, ville..."
            className="w-full rounded-xl bg-white/15 pl-10 pr-4 py-2.5 text-[13px] text-white placeholder-white/50 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-royal-100"
          />
          {recherche && (
            <button
              onClick={() => setRecherche("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filtres par plateforme */}
        <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {["tous", "whatsapp", "linkedin", "instagram", "facebook"].map((plt) => (
            <button
              key={plt}
              onClick={() => setPlateformeFiltre(plt)}
              className="rounded-lg px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition shrink-0"
              style={{
                background: plateformeFiltre === plt ? "#fff" : "rgba(255,255,255,0.12)",
                color: plateformeFiltre === plt ? "var(--navy-950)" : "#fff",
              }}
            >
              {plt === "tous" ? "Toutes les plateformes" : plt}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4 space-y-3 md:mt-6">
        {prospects.length === 0 ? (
          <div className="card-sc mt-6 flex flex-col items-center p-8 text-center">
            <p className="text-[14px]" style={{ color: "var(--navy-950)" }}>
              Pipeline vide pour l'instant.
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--hint)" }}>
              Ajoute ton premier prospect dans le Radar de Chasse.
            </p>
            <Link
              to="/chasse"
              className="btn-primary-sc mt-4 inline-flex items-center gap-2 px-4 py-2"
            >
              Aller à la Chasse
            </Link>
          </div>
        ) : prospectsFiltres.length === 0 ? (
          <div className="card-sc mt-6 p-8 text-center text-hint text-[13px]">
            Aucun prospect ne correspond à cette recherche.
          </div>
        ) : (
          ORDRE_STATUT_PIPELINE.map((st) => {
            const arr = groupes.get(st) ?? [];
            if (arr.length === 0) return null;
            const ouvert = ouverts.has(st);
            return (
              <div key={st} className="card-sc overflow-hidden">
                <button
                  onClick={() => basculer(st)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    {ouvert ? (
                      <ChevronDown size={16} style={{ color: "var(--hint)" }} />
                    ) : (
                      <ChevronRight size={16} style={{ color: "var(--hint)" }} />
                    )}
                    <span
                      className="font-display text-[14px]"
                      style={{ fontWeight: 700, color: "var(--navy-950)" }}
                    >
                      {LABEL_STATUT[st]}
                    </span>
                  </div>
                  <span
                    className="tnum rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{ background: "var(--royal-100)", color: "var(--royal-800)" }}
                  >
                    {arr.length}
                  </span>
                </button>
                {ouvert && (
                  <ul className="divide-y divide-[#EDEEF7]">
                    {arr.map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => setFiche(p)}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-royal-50/50"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="font-display text-[14px] font-bold"
                                style={{ color: "var(--navy-950)" }}
                              >
                                {p.prenom}
                              </span>
                              {p.entreprise && (
                                <span className="text-[12px] font-bold text-royal-800">
                                  ({p.entreprise})
                                </span>
                              )}
                              <span className="text-[12px]" style={{ color: "var(--hint)" }}>
                                · {p.metier}
                              </span>
                              <span
                                className="text-[10px] font-semibold uppercase tracking-wider"
                                style={{ color: "var(--royal-800)" }}
                              >
                                {LABEL_PLATEFORME[p.plateforme]}
                              </span>
                              {p.telephone && (
                                <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">
                                  {p.telephone}
                                </span>
                              )}
                              {typeof p.scoreTotal === "number" && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold border ${
                                    p.priorite === "haute"
                                      ? "bg-rose-50 text-rose-700 border-rose-300"
                                      : p.priorite === "moyenne"
                                        ? "bg-amber-50 text-amber-800 border-amber-300"
                                        : "bg-slate-50 text-slate-700 border-slate-300"
                                  }`}
                                >
                                  <Flame size={10} className={p.priorite === "haute" ? "text-rose-600" : "text-amber-600"} />
                                  <span>{p.scoreTotal}/100</span>
                                </span>
                              )}
                            </div>
                            <div
                              className="mt-0.5 truncate text-[12px] italic"
                              style={{ color: "var(--ink)" }}
                            >
                              « {p.detail} »
                            </div>
                          </div>
                          {p.prochaineActionDate && (
                            <span
                              className="mt-1 text-[10px] tnum font-semibold"
                              style={{ color: "var(--hint)" }}
                            >
                              {formatShortFr(p.prochaineActionDate)}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      {fiche && <FicheDetail prospect={fiche} onClose={() => setFiche(null)} />}
    </div>
  );
}

// -------- Fiche détail (sheet plein écran mobile / modal desktop) ------------

function FicheDetail({ prospect, onClose }: { prospect: Prospect; onClose: () => void }) {
  const s = useSprintMachine();
  const courant = s.prospects[prospect.id] ?? prospect;
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState(courant.notes ?? "");
  const [confirmSuppression, setConfirmSuppression] = useState(false);

  // Génération Audit Flash IA
  const [auditFlash, setAuditFlash] = useState<string>(courant.auditFlash ?? "");
  const [auditEnCours, setAuditEnCours] = useState(false);
  const [copieAudit, setCopieAudit] = useState(false);

  // Score & Playbook Closer states
  const [baremeOuvert, setBaremeOuvert] = useState(false);
  const [ongletPlaybook, setOngletPlaybook] = useState<"probleme" | "opportunite" | "objections" | "relances">("probleme");
  const [copieCle, setCopieCle] = useState<string | null>(null);

  const copierTexte = async (cle: string, texte: string) => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopieCle(cle);
      setTimeout(() => setCopieCle(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const envoyerTexteWhatsApp = (texte: string) => {
    const tel = courant.telephone || "";
    const cleanTel = tel.replace(/[^\d]/g, "");
    const url = cleanTel
      ? `https://wa.me/${cleanTel}?text=${encodeURIComponent(texte)}`
      : `https://wa.me/?text=${encodeURIComponent(texte)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    const desabo = abonnerMessagesProspect(prospect.id, (msgs) => setMessages(msgs));
    return () => desabo();
  }, [prospect.id]);

  useEffect(() => {
    setNotes(courant.notes ?? "");
    setAuditFlash(courant.auditFlash ?? "");
  }, [courant.id, courant.notes, courant.auditFlash]);

  const sauverNotes = async () => {
    if ((courant.notes ?? "") === notes) return;
    await mettreAJourProspect(courant.id, { notes });
  };

  const genererAuditFlashIA = async () => {
    setAuditEnCours(true);
    try {
      const service = getServiceIA(s.config);
      const audit = await service.genererAuditFlash({
        prenom: courant.prenom,
        metier: courant.metier,
        entreprise: courant.entreprise,
        detail: courant.detail,
        niche: courant.niche,
        opportunite: courant.opportunite,
        plateforme: courant.plateforme,
      });
      setAuditFlash(audit);
      await mettreAJourProspect(courant.id, { auditFlash: audit });
    } catch {
      /* ignore */
    } finally {
      setAuditEnCours(false);
    }
  };

  const copierAudit = async () => {
    if (!auditFlash) return;
    try {
      await navigator.clipboard.writeText(auditFlash);
      setCopieAudit(true);
      setTimeout(() => setCopieAudit(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const envoyerAuditWhatsApp = () => {
    const tel =
      courant.telephone || (courant.lien && /^\+?[\d\s]+$/.test(courant.lien) ? courant.lien : "");
    const cleanTel = tel.replace(/[^\d]/g, "");
    const url = cleanTel
      ? `https://wa.me/${cleanTel}?text=${encodeURIComponent(auditFlash)}`
      : `https://wa.me/?text=${encodeURIComponent(auditFlash)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const ouvrirWhatsAppDirect = () => {
    const tel =
      courant.telephone || (courant.lien && /^\+?[\d\s]+$/.test(courant.lien) ? courant.lien : "");
    const cleanTel = tel.replace(/[^\d]/g, "");
    const url = cleanTel ? `https://wa.me/${cleanTel}` : `https://wa.me/`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const ilARepondu = async () => {
    await transitionStatut(courant.id, patchIlARepondu(), { champ: "replies", delta: 1 });
  };

  const appelPrevu = async () => {
    await transitionStatut(courant.id, patchAppelPrevu());
  };

  const cestUnClient = async () => {
    await transitionStatut(courant.id, patchCestUnClient(), {
      champ: "clients",
      delta: 1,
    });
  };

  const sansSuite = async () => {
    await transitionStatut(courant.id, patchSansSuite());
  };

  const supprimer = async () => {
    await supprimerProspect(courant.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:p-4 md:items-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`Fiche ${courant.prenom}`}
        className="w-full max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white p-5 md:max-w-xl md:rounded-3xl shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E7E8F4] md:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3
                className="font-display font-bold text-[20px]"
                style={{ color: "var(--navy-950)" }}
              >
                {courant.prenom}
              </h3>
              {courant.entreprise && (
                <span className="rounded-full bg-royal-100 px-2.5 py-0.5 text-[11px] font-bold text-royal-800">
                  {courant.entreprise}
                </span>
              )}
            </div>
            <p className="text-[13px] text-hint mt-0.5">
              {courant.metier} · {LABEL_PLATEFORME[courant.plateforme]} ·{" "}
              {LABEL_SEGMENT[courant.segment]} {courant.ville ? `· ${courant.ville}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 text-hint"
          >
            <X size={18} />
          </button>
        </div>

        {/* Détail (1re ligne) */}
        <div className="mt-4 rounded-xl p-3.5" style={{ background: "var(--royal-50)" }}>
          <div
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--royal-800)" }}
          >
            Détail précis (1re ligne de message)
          </div>
          <div className="mt-1 text-[13px] italic font-medium" style={{ color: "var(--navy-950)" }}>
            « {courant.detail} »
          </div>
        </div>

        {/* Numéro WhatsApp & Bouton Direct */}
        {courant.telephone && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
                <MessageCircle size={16} />
              </span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Numéro WhatsApp
                </div>
                <div className="font-mono text-[13px] font-bold text-emerald-950">
                  {courant.telephone}
                </div>
              </div>
            </div>
            <button
              onClick={ouvrirWhatsAppDirect}
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-emerald-700 transition"
            >
              Ouvrir chat ➔
            </button>
          </div>
        )}

        {/* Liens vérification Google Maps & Site web */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${courant.entreprise || courant.prenom} ${courant.ville || ""}`.trim())}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-royal-800 hover:bg-royal-50 transition shadow-sm"
          >
            <MapPin size={13} className="text-royal-600" /> Vérifier sur Maps & Avis
          </a>
          {courant.lien && courant.lien.startsWith("http") && (
            <a
              href={courant.lien}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-1.5 text-[12px] font-semibold text-blue-700 hover:bg-blue-100 transition shadow-sm"
            >
              <Globe size={13} /> Visiter le site
            </a>
          )}
        </div>

        {/* Opportunité commerciale repérée */}
        {courant.opportunite && (
          <div className="mt-3 rounded-xl border border-[#EDEEF7] p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-royal-800">
              🔴 Faille / Opportunité repérée
            </div>
            <div className="mt-1 text-[12px] text-ink leading-relaxed">{courant.opportunite}</div>
          </div>
        )}

        {/* Statut + prochaine action */}
        <div className="mt-4 flex items-center gap-2 text-[12px]">
          <span
            className="rounded-full px-3 py-1 font-semibold text-white"
            style={{ background: "var(--royal-800)" }}
          >
            {LABEL_STATUT[courant.statut]}
          </span>
          {courant.prochaineActionDate && courant.prochaineActionType && (
            <span style={{ color: "var(--hint)" }}>
              → {courant.prochaineActionType} le {formatShortFr(courant.prochaineActionDate)}
            </span>
          )}
        </div>

        {/* Score Déterministe & Barème des Critères (Étape 5) */}
        {typeof courant.scoreTotal === "number" && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-hint">
                  Score de Qualification Déterministe
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="font-display font-extrabold text-[22px] text-navy-950">
                    {courant.scoreTotal}/100
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                      courant.priorite === "haute"
                        ? "bg-rose-50 text-rose-700 border-rose-300"
                        : courant.priorite === "moyenne"
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : "bg-slate-50 text-slate-700 border-slate-300"
                    }`}
                  >
                    <Flame size={12} className={courant.priorite === "haute" ? "text-rose-600" : "text-amber-500"} />
                    Priorité {courant.priorite === "haute" ? "Haute" : courant.priorite === "moyenne" ? "Moyenne" : "Basse"}
                  </span>
                </div>
              </div>

              {courant.lignesScore && courant.lignesScore.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBaremeOuvert(!baremeOuvert)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11.5px] font-bold text-royal-800 hover:bg-royal-50 transition"
                >
                  {baremeOuvert ? "Masquer les critères" : `Voir critères (${courant.lignesScore.length})`}
                </button>
              )}
            </div>

            {baremeOuvert && courant.lignesScore && (
              <div className="mt-3 space-y-2 border-t pt-3">
                {courant.lignesScore.map((l, lIdx) => (
                  <div key={lIdx} className="rounded-xl bg-gray-50 p-2.5 text-[12px] border border-gray-100">
                    <div className="flex items-center justify-between font-bold text-navy-950">
                      <span>{l.critere}</span>
                      <span className="font-mono text-royal-800">+{l.points} pts</span>
                    </div>
                    <p className="text-[11px] text-hint mt-0.5">{l.explication}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Playbook Closer Multicanal (Étape 6) */}
        {(courant.messagePlaybookProbleme || courant.objectionsPlaybook || courant.relancesPlaybook) && (
          <div className="mt-4 rounded-2xl border border-royal-600/30 bg-royal-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-royal-800 text-white text-[12px]">
                🛡️
              </span>
              <div>
                <h4 className="font-display font-bold text-[14px] text-navy-950">
                  Playbook Closer & Conversion
                </h4>
                <p className="text-[11px] text-hint">
                  Messages d'attaque, 3 objections traitées et 3 relances planifiées
                </p>
              </div>
            </div>

            {/* Onglets Playbook */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1 text-[11px] font-bold border-b border-royal-200 mb-3">
              {courant.messagePlaybookProbleme && (
                <button
                  type="button"
                  onClick={() => setOngletPlaybook("probleme")}
                  className={`px-3 py-1.5 rounded-t-lg transition ${
                    ongletPlaybook === "probleme"
                      ? "bg-white text-rose-700 shadow-2xs border-t border-x border-royal-200"
                      : "text-hint hover:text-navy-950"
                  }`}
                >
                  🔴 Angle Problème
                </button>
              )}
              {courant.messagePlaybookOpportunite && (
                <button
                  type="button"
                  onClick={() => setOngletPlaybook("opportunite")}
                  className={`px-3 py-1.5 rounded-t-lg transition ${
                    ongletPlaybook === "opportunite"
                      ? "bg-white text-emerald-700 shadow-2xs border-t border-x border-royal-200"
                      : "text-hint hover:text-navy-950"
                  }`}
                >
                  🟢 Angle Opportunité
                </button>
              )}
              {courant.objectionsPlaybook && (
                <button
                  type="button"
                  onClick={() => setOngletPlaybook("objections")}
                  className={`px-3 py-1.5 rounded-t-lg transition ${
                    ongletPlaybook === "objections"
                      ? "bg-white text-royal-800 shadow-2xs border-t border-x border-royal-200"
                      : "text-hint hover:text-navy-950"
                  }`}
                >
                  💬 3 Objections
                </button>
              )}
              {courant.relancesPlaybook && (
                <button
                  type="button"
                  onClick={() => setOngletPlaybook("relances")}
                  className={`px-3 py-1.5 rounded-t-lg transition ${
                    ongletPlaybook === "relances"
                      ? "bg-white text-purple-800 shadow-2xs border-t border-x border-royal-200"
                      : "text-hint hover:text-navy-950"
                  }`}
                >
                  📅 3 Relances
                </button>
              )}
            </div>

            {/* Contenu onglet */}
            {ongletPlaybook === "probleme" && courant.messagePlaybookProbleme && (
              <div className="space-y-2">
                <div className="rounded-xl bg-white p-3 text-[12.5px] italic text-navy-950 leading-relaxed border border-gray-100 whitespace-pre-wrap">
                  « {courant.messagePlaybookProbleme} »
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copierTexte("probleme", courant.messagePlaybookProbleme!)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2 text-[12px] font-bold text-navy-950 hover:bg-gray-50"
                  >
                    <Copy size={13} /> {copieCle === "probleme" ? "Copié !" : "Copier"}
                  </button>
                  <button
                    type="button"
                    onClick={() => envoyerTexteWhatsApp(courant.messagePlaybookProbleme!)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-bold text-white shadow-sm"
                    style={{ background: "#25D366" }}
                  >
                    <MessageCircle size={14} /> Envoyer WhatsApp
                  </button>
                </div>
              </div>
            )}

            {ongletPlaybook === "opportunite" && courant.messagePlaybookOpportunite && (
              <div className="space-y-2">
                <div className="rounded-xl bg-white p-3 text-[12.5px] italic text-navy-950 leading-relaxed border border-gray-100 whitespace-pre-wrap">
                  « {courant.messagePlaybookOpportunite} »
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copierTexte("opportunite", courant.messagePlaybookOpportunite!)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2 text-[12px] font-bold text-navy-950 hover:bg-gray-50"
                  >
                    <Copy size={13} /> {copieCle === "opportunite" ? "Copié !" : "Copier"}
                  </button>
                  <button
                    type="button"
                    onClick={() => envoyerTexteWhatsApp(courant.messagePlaybookOpportunite!)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-bold text-white shadow-sm"
                    style={{ background: "#25D366" }}
                  >
                    <MessageCircle size={14} /> Envoyer WhatsApp
                  </button>
                </div>
              </div>
            )}

            {ongletPlaybook === "objections" && courant.objectionsPlaybook && (
              <div className="space-y-2.5">
                {Object.entries(courant.objectionsPlaybook).map(([cle, rep]) => (
                  <div key={cle} className="rounded-xl bg-white p-3 border border-gray-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-navy-950">
                      <span>
                        {cle === "pasDeBudget"
                          ? "💰 Pas de budget"
                          : cle === "pasLeTemps"
                            ? "⏳ Pas le temps"
                            : "🤝 Déjà quelqu'un"}
                      </span>
                      <button
                        type="button"
                        onClick={() => copierTexte(cle, rep)}
                        className="text-[11px] text-royal-800 hover:underline flex items-center gap-1"
                      >
                        <Copy size={11} /> {copieCle === cle ? "Copié !" : "Copier"}
                      </button>
                    </div>
                    <div className="text-[12px] italic text-hint leading-relaxed">
                      « {rep} »
                    </div>
                  </div>
                ))}
              </div>
            )}

            {ongletPlaybook === "relances" && courant.relancesPlaybook && (
              <div className="space-y-2.5">
                {[
                  { id: "r1", label: "Relance 1 (J+2)", text: courant.relancesPlaybook.r1 },
                  { id: "r2", label: "Relance 2 (J+4 - Preuve)", text: courant.relancesPlaybook.r2 },
                  { id: "r3", label: "Relance 3 (J+7 - Rupture)", text: courant.relancesPlaybook.r3 },
                ].map((rel) => (
                  <div key={rel.id} className="rounded-xl bg-white p-3 border border-gray-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-navy-950">
                      <span>{rel.label}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copierTexte(rel.id, rel.text)}
                          className="text-[11px] text-royal-800 hover:underline flex items-center gap-1"
                        >
                          <Copy size={11} /> {copieCle === rel.id ? "Copié !" : "Copier"}
                        </button>
                        <button
                          type="button"
                          onClick={() => envoyerTexteWhatsApp(rel.text)}
                          className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1"
                        >
                          <MessageCircle size={11} /> WhatsApp
                        </button>
                      </div>
                    </div>
                    <div className="text-[12px] italic text-hint leading-relaxed">
                      « {rel.text} »
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ARME DE CLOSING : AUDIT FLASH IA */}
        <div
          className="mt-5 rounded-2xl border border-royal-600/30 p-4"
          style={{ background: "var(--royal-50)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-royal-800" />
              <h4 className="font-display font-bold text-[14px] text-navy-950">
                Audit Flash IA (L'arme de conversion)
              </h4>
            </div>
            <button
              onClick={genererAuditFlashIA}
              disabled={auditEnCours}
              className="text-[12px] font-bold text-royal-800 hover:underline"
            >
              {auditEnCours ? "Génération..." : auditFlash ? "Régénérer" : "Générer (30s)"}
            </button>
          </div>

          {auditFlash ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl bg-white p-3.5 text-[12px] leading-relaxed whitespace-pre-wrap text-navy-950 border">
                {auditFlash}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copierAudit}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2 text-[12px] font-medium text-navy-950 hover:bg-gray-50"
                >
                  <Copy size={14} /> {copieAudit ? "Copié !" : "Copier"}
                </button>
                <button
                  onClick={envoyerAuditWhatsApp}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-bold text-white shadow-sm transition"
                  style={{ background: "#25D366" }}
                >
                  <MessageCircle size={15} /> Envoyer sur WhatsApp
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-hint">
              Génère en 10 secondes un mini-audit en 3 points (le problème actuel, l'opportunité à
              7j et la démo offerte) prêt à être envoyé par WhatsApp.
            </p>
          )}
        </div>

        {/* Historique messages */}
        <div className="mt-5">
          <h4
            className="font-display text-[13px]"
            style={{ fontWeight: 700, color: "var(--navy-950)" }}
          >
            Historique des échanges ({messages.length})
          </h4>
          {messages.length === 0 ? (
            <p className="mt-2 text-[12px]" style={{ color: "var(--hint)" }}>
              Aucun message envoyé pour le moment.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {messages.map((m) => (
                <li key={m.id} className="rounded-xl border border-[#EDEEF7] bg-white p-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span
                      className="rounded-full px-2 py-0.5 font-semibold"
                      style={{ background: "var(--royal-100)", color: "var(--royal-800)" }}
                    >
                      {m.type}
                    </span>
                    <span className="tnum" style={{ color: "var(--hint)" }}>
                      {new Date(m.sentAt).toLocaleString("fr-FR", {
                        timeZone: "Africa/Porto-Novo",
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <div
                    className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed"
                    style={{ color: "var(--ink)" }}
                  >
                    {m.contenu}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Historique des actions */}
        {courant.historiqueActions && courant.historiqueActions.length > 0 && (
          <div className="mt-5">
            <h4
              className="font-display text-[13px]"
              style={{ fontWeight: 700, color: "var(--navy-950)" }}
            >
              Historique des actions ({courant.historiqueActions.length})
            </h4>
            <ul className="mt-2 space-y-1.5">
              {courant.historiqueActions.map((h, hIdx) => (
                <li
                  key={hIdx}
                  className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-[11.5px] border border-gray-100"
                >
                  <div className="flex items-center gap-2">
                    <Check size={12} className="text-emerald-600 shrink-0" />
                    <span className="font-semibold text-navy-950">{h.action}</span>
                    {h.note && <span className="text-hint text-[11px]">({h.note})</span>}
                  </div>
                  <span className="text-[10.5px] text-hint font-mono shrink-0 ml-2">
                    {new Date(h.date).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        <div className="mt-5">
          <h4
            className="font-display text-[13px]"
            style={{ fontWeight: 700, color: "var(--navy-950)" }}
          >
            Notes internes
          </h4>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={sauverNotes}
            rows={3}
            placeholder="Contexte, objections, délai souhaité…"
            className="mt-2 w-full resize-none rounded-xl border border-[#E7E8F4] bg-white p-3 text-[13px]"
          />
        </div>

        {/* Actions rapides de statut */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <ActionBtn label="Il a répondu" icon={MessageCircle} onClick={ilARepondu} />
          <ActionBtn label="Appel prévu" icon={PhoneCall} onClick={appelPrevu} />
          <ActionBtn label="C'est un client !" icon={UserCheck} onClick={cestUnClient} surligne />
          <ActionBtn label="Sans suite" icon={XCircle} onClick={sansSuite} />
        </div>

        {/* Facturation / Devis rapide */}
        <div className="mt-3">
          <Link
            to="/facturation"
            search={{ prospectId: courant.id, nouveau: "1", type: "devis" }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-royal-600 bg-white py-3 text-[13px] font-bold text-royal-800 transition hover:bg-royal-100"
          >
            <FileText size={16} /> Créer un devis pour {courant.prenom}
          </Link>
        </div>

        {/* Suppression */}
        <div className="mt-5 border-t border-[#EDEEF7] pt-4">
          {confirmSuppression ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmSuppression(false)}
                className="flex-1 rounded-xl border border-[#E7E8F4] py-2.5 text-[13px] font-display font-semibold"
              >
                Annuler
              </button>
              <button
                onClick={supprimer}
                className="flex-1 rounded-xl py-2.5 text-[13px] font-display font-bold text-white"
                style={{ background: "var(--navy-950)" }}
              >
                Confirmer la suppression
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmSuppression(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E7E8F4] py-2.5 text-[12px] font-medium"
              style={{ color: "var(--hint)" }}
            >
              <Trash2 size={14} /> Supprimer ce prospect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  icon: Icon,
  onClick,
  surligne,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  onClick: () => void | Promise<void>;
  surligne?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-semibold transition"
      style={{
        background: surligne ? "var(--royal-800)" : "#fff",
        color: surligne ? "#fff" : "var(--navy-950)",
        border: surligne ? "none" : "1px solid #E7E8F4",
      }}
    >
      <Icon size={14} color={surligne ? "#fff" : undefined} />
      {label}
    </button>
  );
}
