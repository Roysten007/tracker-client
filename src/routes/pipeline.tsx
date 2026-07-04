import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  MessageCircle,
  PhoneCall,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";

import {
  abonnerMessagesProspect,
  mettreAJourProspect,
  supprimerProspect,
  tousProspects,
  transitionStatut,
  useHydraterSM,
  useSprintMachine,
} from "../lib/store2";
import type { Message, Prospect, Statut } from "../lib/types";
import {
  LABEL_PLATEFORME,
  LABEL_SEGMENT,
  LABEL_STATUT,
  ORDRE_STATUT_PIPELINE,
} from "../lib/types";
import {
  patchAppelPrevu,
  patchCestUnClient,
  patchIlARepondu,
  patchSansSuite,
} from "../lib/relances";
import { formatShortFr } from "../lib/date";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — Sprint Machine" },
      { name: "description", content: "Tes prospects par statut, du premier contact au client signé." },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  useHydraterSM();
  const s = useSprintMachine();
  const prospects = useMemo(() => tousProspects(s), [s.prospects]);

  const groupes = useMemo(() => {
    const map = new Map<Statut, Prospect[]>();
    for (const st of ORDRE_STATUT_PIPELINE) map.set(st, []);
    for (const p of prospects) {
      map.get(p.statut)?.push(p);
    }
    // Tri : plus récent d'abord dans chaque groupe.
    for (const arr of map.values()) {
      arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return map;
  }, [prospects]);

  const [ouverts, setOuverts] = useState<Set<Statut>>(() => new Set(["a_contacter", "envoye", "relance_douce", "relance_prix"]));
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
    <div className="pb-6 md:mx-auto md:max-w-3xl">
      <header
        className="px-5 pb-5 pt-8 text-white md:px-8 md:pt-10 md:rounded-2xl"
        style={{
          background: "var(--navy-950)",
          paddingTop: "calc(env(safe-area-inset-top) + 24px)",
        }}
      >
        <h1 className="font-display text-white" style={{ fontWeight: 800, fontSize: 26 }}>
          Pipeline
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--royal-100)" }}>
          {prospects.length} prospect{prospects.length > 1 ? "s" : ""} au total
        </p>
      </header>

      <div className="p-4 space-y-3 md:mt-6">
        {prospects.length === 0 ? (
          <div className="card-sc mt-6 flex flex-col items-center p-8 text-center">
            <p className="text-[14px]" style={{ color: "var(--navy-950)" }}>
              Pipeline vide pour l'instant.
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--hint)" }}>
              Ajoute ton premier prospect dans la Chasse.
            </p>
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
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
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
                          className="flex w-full items-start gap-3 px-4 py-3 text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="font-display text-[14px]"
                                style={{ fontWeight: 700, color: "var(--navy-950)" }}
                              >
                                {p.prenom}
                              </span>
                              <span className="text-[12px]" style={{ color: "var(--hint)" }}>
                                · {p.metier}
                              </span>
                              <span
                                className="text-[10px] font-semibold uppercase tracking-wider"
                                style={{ color: "var(--royal-800)" }}
                              >
                                {LABEL_PLATEFORME[p.plateforme]}
                              </span>
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
                              className="mt-1 text-[10px] tnum"
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
  // Le prospect peut être mis à jour pendant que la fiche est ouverte → on relit depuis le store.
  const courant = s.prospects[prospect.id] ?? prospect;
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState(courant.notes ?? "");
  const [confirmSuppression, setConfirmSuppression] = useState(false);

  useEffect(() => {
    const desabo = abonnerMessagesProspect(prospect.id, (msgs) => setMessages(msgs));
    return () => desabo();
  }, [prospect.id]);

  useEffect(() => {
    setNotes(courant.notes ?? "");
  }, [courant.id]);

  const sauverNotes = async () => {
    if ((courant.notes ?? "") === notes) return;
    await mettreAJourProspect(courant.id, { notes });
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`Fiche ${courant.prenom}`}
        className="w-full max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white p-5 md:max-w-lg md:rounded-3xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E7E8F4] md:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18, color: "var(--navy-950)" }}>
              {courant.prenom}
            </h3>
            <p className="text-[13px]" style={{ color: "var(--hint)" }}>
              {courant.metier} · {LABEL_PLATEFORME[courant.plateforme]} · {LABEL_SEGMENT[courant.segment]}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="stepper-btn"
            style={{ width: 32, height: 32 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Détail (1re ligne) */}
        <div className="mt-4 rounded-xl p-3" style={{ background: "var(--royal-50)" }}>
          <div
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--royal-800)" }}
          >
            Détail précis
          </div>
          <div className="mt-1 text-[13px] italic" style={{ color: "var(--navy-950)" }}>
            « {courant.detail} »
          </div>
        </div>

        {/* Statut + prochaine action */}
        <div className="mt-3 flex items-center gap-2 text-[12px]">
          <span
            className="rounded-full px-2.5 py-0.5 font-semibold text-white"
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

        {courant.lien && (
          <div className="mt-3 truncate text-[12px]">
            <span style={{ color: "var(--hint)" }}>Lien : </span>
            <a
              href={courant.lien.startsWith("http") ? courant.lien : `https://${courant.lien}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium"
              style={{ color: "var(--royal-800)" }}
            >
              {courant.lien}
            </a>
          </div>
        )}

        {/* Historique messages */}
        <div className="mt-5">
          <h4 className="font-display text-[13px]" style={{ fontWeight: 700, color: "var(--navy-950)" }}>
            Historique ({messages.length})
          </h4>
          {messages.length === 0 ? (
            <p className="mt-2 text-[12px]" style={{ color: "var(--hint)" }}>
              Aucun message envoyé pour le moment.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className="rounded-xl border border-[#EDEEF7] bg-white p-3"
                >
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

        {/* Notes */}
        <div className="mt-5">
          <h4 className="font-display text-[13px]" style={{ fontWeight: 700, color: "var(--navy-950)" }}>
            Notes
          </h4>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={sauverNotes}
            rows={3}
            placeholder="Contexte, préférences, points à retenir…"
            className="mt-2 w-full resize-none rounded-xl border border-[#E7E8F4] bg-white p-3 text-[13px]"
          />
        </div>

        {/* Transitions */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <ActionBtn label="Il a répondu" icon={MessageCircle} onClick={ilARepondu} />
          <ActionBtn label="Appel prévu" icon={PhoneCall} onClick={appelPrevu} />
          <ActionBtn
            label="C'est un client !"
            icon={UserCheck}
            onClick={cestUnClient}
            surligne
          />
          <ActionBtn label="Sans suite" icon={XCircle} onClick={sansSuite} />
        </div>

        {/* Suppression */}
        <div className="mt-5 border-t border-[#EDEEF7] pt-4">
          {confirmSuppression ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmSuppression(false)}
                className="flex-1 rounded-xl border border-[#E7E8F4] py-2.5 text-[13px] font-display"
                style={{ fontWeight: 600 }}
              >
                Annuler
              </button>
              <button
                onClick={supprimer}
                className="flex-1 rounded-xl py-2.5 text-[13px] font-display text-white"
                style={{ fontWeight: 700, background: "var(--navy-950)" }}
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
      className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-semibold"
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
