import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, MessageCircle, PhoneCall, UserCheck, Plus, X } from "lucide-react";

import { useSprint, useHydrate, sortedDayKeysDesc, updateDay, getDay } from "../lib/store";
import type { DayStats } from "../lib/store";
import { formatShortFr, weekStartKey, formatWeekLabel, todayKey } from "../lib/date";

export const Route = createFileRoute("/historique")({
  head: () => ({
    meta: [
      { title: "Historique — Sprint Client" },
      { name: "description", content: "Consulte et corrige tes jours de prospection." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  useHydrate();
  const s = useSprint();
  const keys = sortedDayKeysDesc(s);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const k of keys) {
      const w = weekStartKey(k);
      const arr = map.get(w) ?? [];
      arr.push(k);
      map.set(w, arr);
    }
    return Array.from(map.entries());
  }, [keys]);

  return (
    <div>
      <header
        className="px-5 pb-5 pt-8 text-white"
        style={{ background: "var(--navy-950)", paddingTop: "calc(env(safe-area-inset-top) + 24px)" }}
      >
        <h1 className="font-display text-white" style={{ fontWeight: 800, fontSize: 26 }}>
          Historique
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--royal-100)" }}>
          {keys.length} jour{keys.length > 1 ? "s" : ""} enregistré{keys.length > 1 ? "s" : ""}
        </p>
      </header>

      <div className="p-4 space-y-4">
        <button
          onClick={() => setAddOpen(true)}
          className="btn-primary-sc flex w-full items-center justify-center gap-2"
          style={{ height: 48 }}
        >
          <Plus size={18} /> Ajouter un jour manquant
        </button>

        {keys.length === 0 ? (
          <div className="card-sc mt-6 flex flex-col items-center p-8 text-center">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "var(--royal-100)" }}
            >
              <MessageSquare size={26} style={{ color: "var(--royal-800)" }} />
            </div>
            <p className="text-[14px]" style={{ color: "var(--navy-950)" }}>
              Aucune donnée pour l'instant.
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--hint)" }}>
              Envoie tes 10 premiers messages aujourd'hui.
            </p>
          </div>
        ) : (
          grouped.map(([week, days]) => (
            <div key={week}>
              <h2
                className="mb-2 px-1 font-display text-[13px] uppercase tracking-wider"
                style={{ fontWeight: 700, color: "var(--hint)" }}
              >
                {formatWeekLabel(week)}
              </h2>
              <div className="card-sc divide-y divide-[#EDEEF7] overflow-hidden">
                {days.map((k) => {
                  const d = getDay(s, k);
                  const reached = d.sent >= s.goals.daily;
                  return (
                    <button
                      key={k}
                      onClick={() => setEditKey(k)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-[var(--royal-50)]"
                    >
                      <div className="flex-1">
                        <div
                          className="font-display text-[14px] capitalize"
                          style={{ fontWeight: 700, color: "var(--navy-950)" }}
                        >
                          {formatShortFr(k)}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[12px] tnum" style={{ color: "var(--ink)" }}>
                          <Metric icon={MessageSquare} v={d.sent} />
                          <Metric icon={MessageCircle} v={d.replies} />
                          <Metric icon={PhoneCall} v={d.calls} />
                          <Metric icon={UserCheck} v={d.clients} />
                        </div>
                      </div>
                      {reached && (
                        <span
                          aria-label="Objectif atteint"
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: "var(--royal-800)" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {editKey && (
        <EditSheet
          dayKey={editKey}
          initial={getDay(s, editKey)}
          onClose={() => setEditKey(null)}
          onSave={(v) => {
            updateDay(editKey, v);
            setEditKey(null);
          }}
        />
      )}
      {addOpen && (
        <AddSheet
          existing={new Set(keys)}
          onClose={() => setAddOpen(false)}
          onSave={(dateKey, v) => {
            updateDay(dateKey, v);
            setAddOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Metric({ icon: Icon, v }: { icon: any; v: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon size={12} style={{ color: "var(--hint)" }} />
      <span className="tnum">{v}</span>
    </span>
  );
}

function StepperField({
  label,
  value,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#E7E8F4] bg-white px-3 py-2.5">
      <div>
        <div className="text-[12px]" style={{ color: "var(--hint)" }}>{label}</div>
        <div className="font-display tnum" style={{ fontWeight: 700, fontSize: 22 }}>{value}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`Retirer un ${ariaLabel}`}
          disabled={value === 0}
          className="stepper-btn"
        >−</button>
        <button
          onClick={() => onChange(value + 1)}
          aria-label={`Ajouter un ${ariaLabel}`}
          className="stepper-btn"
          style={{ background: "var(--royal-800)", color: "#fff" }}
        >+</button>
      </div>
    </div>
  );
}

function Sheet({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="w-full max-w-md rounded-t-3xl bg-white p-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E7E8F4]" />
        <div className="flex items-center justify-between">
          <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18 }}>{title}</h3>
          <button onClick={onClose} aria-label="Fermer" className="stepper-btn" style={{ width: 32, height: 32 }}>
            <X size={16} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function EditSheet({
  dayKey,
  initial,
  onClose,
  onSave,
}: {
  dayKey: string;
  initial: DayStats;
  onClose: () => void;
  onSave: (v: DayStats) => void;
}) {
  const [v, setV] = useState<DayStats>(initial);
  return (
    <Sheet onClose={onClose} title={formatShortFr(dayKey)}>
      <div className="space-y-2">
        <StepperField label="Messages" value={v.sent} onChange={(n) => setV({ ...v, sent: n })} ariaLabel="message" />
        <StepperField label="Réponses" value={v.replies} onChange={(n) => setV({ ...v, replies: n })} ariaLabel="réponse" />
        <StepperField label="Appels" value={v.calls} onChange={(n) => setV({ ...v, calls: n })} ariaLabel="appel" />
        <StepperField label="Clients" value={v.clients} onChange={(n) => setV({ ...v, clients: n })} ariaLabel="client" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button onClick={onClose} className="rounded-xl border border-[#E7E8F4] py-3 font-display" style={{ fontWeight: 600 }}>
          Annuler
        </button>
        <button onClick={() => onSave(v)} className="btn-primary-sc py-3">Enregistrer</button>
      </div>
    </Sheet>
  );
}

function AddSheet({
  existing,
  onClose,
  onSave,
}: {
  existing: Set<string>;
  onClose: () => void;
  onSave: (dateKey: string, v: DayStats) => void;
}) {
  const today = todayKey();
  const [date, setDate] = useState<string>("");
  const [v, setV] = useState<DayStats>({ sent: 0, replies: 0, calls: 0, clients: 0 });
  const invalid = !date || date > today;
  const duplicate = date && existing.has(date);

  return (
    <Sheet onClose={onClose} title="Ajouter un jour">
      <label className="block text-[13px]" style={{ color: "var(--hint)" }}>
        Date (passée uniquement)
      </label>
      <input
        type="date"
        max={today}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-[#E7E8F4] bg-white px-3 py-3 text-[15px]"
      />
      {duplicate && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--royal-600)" }}>
          Cette date existe déjà — l'enregistrement remplacera les valeurs actuelles.
        </p>
      )}
      <div className="mt-3 space-y-2">
        <StepperField label="Messages" value={v.sent} onChange={(n) => setV({ ...v, sent: n })} ariaLabel="message" />
        <StepperField label="Réponses" value={v.replies} onChange={(n) => setV({ ...v, replies: n })} ariaLabel="réponse" />
        <StepperField label="Appels" value={v.calls} onChange={(n) => setV({ ...v, calls: n })} ariaLabel="appel" />
        <StepperField label="Clients" value={v.clients} onChange={(n) => setV({ ...v, clients: n })} ariaLabel="client" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button onClick={onClose} className="rounded-xl border border-[#E7E8F4] py-3 font-display" style={{ fontWeight: 600 }}>
          Annuler
        </button>
        <button
          onClick={() => onSave(date, v)}
          disabled={invalid}
          className="btn-primary-sc py-3"
        >
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}
