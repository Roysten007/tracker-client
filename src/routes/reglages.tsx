import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Upload, AlertTriangle, LogOut } from "lucide-react";

import {
  useSprint,
  useHydrate,
  setGoals,
  setStartDate,
  resetAll,
  replaceAll,
  type SprintData,
} from "../lib/store";
import { todayKey } from "../lib/date";
import { useAuthUser, signOutUser } from "../lib/auth";

export const Route = createFileRoute("/reglages")({
  head: () => ({
    meta: [
      { title: "Réglages — Sprint Client" },
      { name: "description", content: "Objectifs, sauvegarde et réinitialisation de tes données." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  useHydrate();
  const s = useSprint();
  const user = useAuthUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ data: SprintData; count: number } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sprint-client-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      if (parsed?.version !== 1 || !parsed.days) throw new Error("bad");
      const count = Object.keys(parsed.days).length;
      setImportPreview({ data: parsed as SprintData, count });
    } catch {
      alert("Fichier invalide. Vérifie qu'il s'agit d'un export Sprint Client.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="md:mx-auto md:max-w-2xl">
      <header
        className="px-5 pb-5 pt-8 text-white md:px-8 md:pt-10 md:rounded-2xl"
        style={{ background: "var(--navy-950)", paddingTop: "calc(env(safe-area-inset-top) + 24px)" }}
      >
        <h1 className="font-display text-white" style={{ fontWeight: 800, fontSize: 26 }}>
          Réglages
        </h1>
      </header>

      <div className="p-4 space-y-5 md:mt-8">
        {/* Account */}
        {user && (
          <section className="card-sc p-5">
            <h2 className="font-display" style={{ fontWeight: 700, fontSize: 16 }}>Compte</h2>
            <p className="mt-2 text-[13px]" style={{ color: "var(--hint)" }}>
              Connecté avec <span className="font-medium" style={{ color: "var(--navy-950)" }}>{user.email}</span>
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--hint)" }}>
              Tes données sont sauvegardées automatiquement dans le cloud.
            </p>
            <button
              onClick={() => signOutUser()}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#E7E8F4] bg-white px-4 py-3 font-display"
              style={{ fontWeight: 600, color: "var(--navy-950)" }}
            >
              <LogOut size={16} /> Se déconnecter
            </button>
          </section>
        )}

        {/* Goals */}
        <section className="card-sc p-5">
          <h2 className="font-display" style={{ fontWeight: 700, fontSize: 16 }}>Objectifs</h2>
          <div className="mt-4 space-y-3">
            <Field label="Objectif quotidien (messages)">
              <input
                type="number"
                min={1}
                value={s.goals.daily}
                onChange={(e) => setGoals({ ...s.goals, daily: Number(e.target.value) || 1 })}
                className="w-full rounded-xl border border-[#E7E8F4] bg-white px-3 py-3 text-[15px] tnum"
                inputMode="numeric"
              />
            </Field>
            <Field label="Objectif mensuel (messages)">
              <input
                type="number"
                min={1}
                value={s.goals.monthly}
                onChange={(e) => setGoals({ ...s.goals, monthly: Number(e.target.value) || 1 })}
                className="w-full rounded-xl border border-[#E7E8F4] bg-white px-3 py-3 text-[15px] tnum"
                inputMode="numeric"
              />
            </Field>
            <Field label="Date de début du sprint">
              <input
                type="date"
                value={s.startDate}
                max={todayKey()}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-[#E7E8F4] bg-white px-3 py-3 text-[15px]"
              />
            </Field>
          </div>
        </section>

        {/* Backup */}
        <section className="card-sc p-5">
          <h2 className="font-display" style={{ fontWeight: 700, fontSize: 16 }}>Sauvegarde</h2>
          <div className="mt-4 space-y-3">
            <button
              onClick={exportJson}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E7E8F4] bg-white px-4 py-3 font-display"
              style={{ fontWeight: 600, color: "var(--navy-950)" }}
            >
              <Download size={18} /> Exporter mes données (JSON)
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E7E8F4] bg-white px-4 py-3 font-display"
              style={{ fontWeight: 600, color: "var(--navy-950)" }}
            >
              <Upload size={18} /> Importer des données
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
          </div>
        </section>

        {/* Danger zone */}
        <section
          className="rounded-2xl border p-5"
          style={{ borderColor: "#E7E8F4", background: "#fff" }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} style={{ color: "var(--navy-950)" }} />
            <h2 className="font-display" style={{ fontWeight: 700, fontSize: 16, color: "var(--navy-950)" }}>
              Zone dangereuse
            </h2>
          </div>
          <p className="mt-2 text-[13px]" style={{ color: "var(--hint)" }}>
            Cette action efface définitivement tous les jours, objectifs et compteurs enregistrés.
          </p>
          <button
            onClick={() => setResetOpen(true)}
            className="mt-4 w-full rounded-xl px-4 py-3 font-display text-white"
            style={{ fontWeight: 700, background: "var(--navy-950)" }}
          >
            Réinitialiser tous les compteurs
          </button>
        </section>

        <p className="pt-2 pb-2 text-center text-[12px]" style={{ color: "var(--hint)" }}>
          Sprint Client v1 · Roy Sten Design
        </p>
      </div>

      {/* Import preview */}
      {importPreview && (
        <Modal onClose={() => setImportPreview(null)} title="Confirmer l'import">
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>
            <span className="font-semibold tnum">{importPreview.count}</span> jour{importPreview.count > 1 ? "s" : ""} détecté{importPreview.count > 1 ? "s" : ""} dans le fichier.
          </p>
          <p className="mt-2 text-[13px]" style={{ color: "var(--hint)" }}>
            Toutes tes données actuelles seront remplacées. Cette action est irréversible.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={() => setImportPreview(null)} className="rounded-xl border border-[#E7E8F4] py-3 font-display" style={{ fontWeight: 600 }}>
              Annuler
            </button>
            <button
              onClick={() => {
                replaceAll(importPreview.data);
                setImportPreview(null);
              }}
              className="btn-primary-sc py-3"
            >
              Remplacer
            </button>
          </div>
        </Modal>
      )}

      {/* Reset */}
      {resetOpen && (
        <Modal onClose={() => { setResetOpen(false); setResetText(""); }} title="Confirmer la réinitialisation">
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>
            Pour confirmer, tape <span className="font-display font-bold tnum" style={{ color: "var(--navy-950)" }}>RESET</span> ci-dessous.
          </p>
          <input
            autoFocus
            value={resetText}
            onChange={(e) => setResetText(e.target.value.toUpperCase())}
            placeholder="RESET"
            className="mt-3 w-full rounded-xl border border-[#E7E8F4] bg-white px-3 py-3 text-[15px] tracking-widest"
          />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => { setResetOpen(false); setResetText(""); }}
              className="rounded-xl border border-[#E7E8F4] py-3 font-display"
              style={{ fontWeight: 600 }}
            >
              Annuler
            </button>
            <button
              disabled={resetText !== "RESET"}
              onClick={() => {
                resetAll();
                setResetOpen(false);
                setResetText("");
              }}
              className="rounded-xl py-3 font-display text-white"
              style={{ fontWeight: 700, background: "var(--navy-950)", opacity: resetText === "RESET" ? 1 : 0.4 }}
            >
              Tout effacer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px]" style={{ color: "var(--hint)" }}>{label}</span>
      {children}
    </label>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
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
        <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18 }}>{title}</h3>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
