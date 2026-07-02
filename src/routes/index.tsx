import { useEffect, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import confetti from "canvas-confetti";
import { Flame, Target as TargetIcon, MessageSquare, PhoneCall, MessageCircle, UserCheck } from "lucide-react";

import {
  useSprint,
  useHydrate,
  getDay,
  totals,
  monthTotal,
  streak,
  last14Keys,
  bump,
  markFirstClientCelebrated,
} from "../lib/store";
import { todayKey, monthKey, formatLongFr, formatDayNum } from "../lib/date";

export const Route = createFileRoute("/")({
  component: TodayPage,
});

function pct(n: number, d: number) {
  if (!d) return null;
  return Math.round((n / d) * 100);
}

function TodayPage() {
  useHydrate();
  const s = useSprint();
  const today = todayKey();
  const day = getDay(s, today);
  const t = totals(s);
  const goal = s.goals.daily;
  const monthGoal = s.goals.monthly;
  const monthSum = monthTotal(s, monthKey());
  const streakDays = streak(s, today);
  const days14 = last14Keys(today);
  const [bumpKey, setBumpKey] = useState(0);
  const [tip, setTip] = useState<{ key: string; value: number } | null>(null);

  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // First-client celebration
  useEffect(() => {
    if (t.clients >= 1 && !s.firstClientCelebrated) {
      markFirstClientCelebrated();
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
  }, [t.clients, s.firstClientCelebrated, reduced]);

  const vibrate = (ms: number) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(ms); } catch {}
    }
  };

  const onPlusMessage = () => {
    bump(today, "sent", 1);
    setBumpKey((k) => k + 1);
    vibrate(10);
  };

  const progress = Math.min(100, Math.round((day.sent / goal) * 100));
  const monthPct = Math.min(100, Math.round((monthSum / monthGoal) * 100));
  const goalReached = day.sent >= goal;

  const funnel = [
    { label: "Messages", value: t.sent, color: "var(--navy-950)" },
    { label: "Réponses", value: t.replies, color: "var(--royal-800)" },
    { label: "Appels", value: t.calls, color: "var(--royal-800)" },
    { label: "Clients", value: t.clients, color: "var(--royal-600)" },
  ];
  const maxFunnel = Math.max(1, t.sent);

  const max14 = Math.max(goal, ...days14.map((k) => getDay(s, k).sent), 1);

  return (
    <div className="pb-6">
      {/* Header */}
      <header
        className="px-5 pt-8 pb-6 text-white"
        style={{ background: "var(--navy-950)", paddingTop: "calc(env(safe-area-inset-top) + 24px)" }}
      >
        <div
          className="text-[11px] font-medium tracking-[0.22em]"
          style={{ color: "var(--royal-100)" }}
        >
          ROY STEN DESIGN
        </div>
        <h1
          className="mt-1.5 font-display text-white"
          style={{ fontWeight: 800, fontSize: 30, lineHeight: 1.1, letterSpacing: "-0.02em" }}
        >
          Sprint Client
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: "var(--royal-100)" }}>
          {formatLongFr(today)}
        </p>
      </header>

      <div className="px-4 space-y-4 -mt-3">
        {/* Hero card */}
        <section className="card-sc p-5">
          <div className="text-[13px]" style={{ color: "var(--hint)" }}>
            Messages envoyés aujourd'hui
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              key={bumpKey}
              className="font-display tnum"
              style={{
                fontWeight: 800,
                fontSize: 60,
                lineHeight: 1,
                color: "var(--navy-950)",
                display: "inline-block",
                animation: reduced ? undefined : "sc-pop 180ms ease",
              }}
            >
              {day.sent}
            </span>
            <span
              className="font-display tnum"
              style={{ fontWeight: 700, fontSize: 22, color: "var(--hint)" }}
            >
              / {goal}
            </span>
          </div>

          {/* Progress bar */}
          <div
            className="mt-4 h-2.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--royal-100)" }}
            role="progressbar"
            aria-valuenow={day.sent}
            aria-valuemin={0}
            aria-valuemax={goal}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, var(--royal-800), var(--royal-600))",
                transition: reduced ? undefined : "width 320ms ease",
              }}
            />
          </div>

          {goalReached && (
            <div
              className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
              style={{ background: "var(--royal-800)" }}
            >
              ✓ Objectif du jour atteint
            </div>
          )}

          <button
            onClick={onPlusMessage}
            aria-label="Ajouter un message envoyé"
            className="btn-primary-sc mt-4 w-full"
            style={{ height: 56, fontSize: 17 }}
          >
            +1 message
          </button>

          <div className="mt-2 flex justify-center">
            <button
              onClick={() => bump(today, "sent", -1)}
              disabled={day.sent === 0}
              aria-label="Retirer un message"
              className="text-[13px] font-medium underline-offset-4 hover:underline"
              style={{ color: "var(--hint)" }}
            >
              −1 (annuler)
            </button>
          </div>
        </section>

        {/* Steppers 3 cols */}
        <section className="grid grid-cols-3 gap-3">
          <StepTile
            label="Réponses"
            value={day.replies}
            onMinus={() => bump(today, "replies", -1)}
            onPlus={() => { bump(today, "replies", 1); vibrate(8); }}
            ariaLabel="réponse"
          />
          <StepTile
            label="Appels"
            value={day.calls}
            onMinus={() => bump(today, "calls", -1)}
            onPlus={() => { bump(today, "calls", 1); vibrate(8); }}
            ariaLabel="appel"
          />
          <StepTile
            label="Clients"
            value={day.clients}
            highlight
            onMinus={() => bump(today, "clients", -1)}
            onPlus={() => { bump(today, "clients", 1); vibrate(15); }}
            ariaLabel="client"
          />
        </section>

        {/* Milestone banner */}
        <MilestoneBanner totalClients={t.clients} />

        {/* Two tiles */}
        <section className="grid grid-cols-2 gap-3">
          <div className="card-sc p-4">
            <div className="text-[12px] font-medium" style={{ color: "var(--hint)" }}>
              Messages ce mois
            </div>
            <div
              className="mt-1 font-display tnum"
              style={{ fontWeight: 700, fontSize: 28, color: "var(--navy-950)" }}
            >
              {monthSum}
            </div>
            <div className="text-[11px]" style={{ color: "var(--hint)" }}>
              sur {monthGoal} ({goal}/jour) · {monthPct}%
            </div>
            <div className="mt-2 h-1.5 rounded-full" style={{ background: "var(--royal-100)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${monthPct}%`, background: "var(--royal-800)" }}
              />
            </div>
          </div>
          <div className="card-sc p-4">
            <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "var(--hint)" }}>
              <Flame size={14} style={{ color: "var(--royal-800)" }} /> Série
            </div>
            <div
              className="mt-1 font-display tnum"
              style={{ fontWeight: 700, fontSize: 28, color: "var(--navy-950)" }}
            >
              {streakDays}
            </div>
            <div className="text-[11px]" style={{ color: "var(--hint)" }}>
              jours à {goal} messages ou +
            </div>
          </div>
        </section>

        {/* Funnel */}
        <section className="card-sc p-5">
          <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
            Ton entonnoir
          </h2>
          <p className="text-[12px]" style={{ color: "var(--hint)" }}>
            Totaux depuis le début du sprint
          </p>
          <div className="mt-4 space-y-3">
            {funnel.map((row, i) => {
              const width = Math.round((row.value / maxFunnel) * 100);
              const prev = i > 0 ? funnel[i - 1].value : 0;
              const rate = i === 0 ? null : pct(row.value, prev);
              const captions = [
                null,
                "des messages ont eu une réponse",
                "des réponses sont passées en appel",
                "des appels ont signé",
              ];
              const Icon = [MessageSquare, MessageCircle, PhoneCall, UserCheck][i];
              return (
                <div key={row.label}>
                  <div className="flex items-center gap-2">
                    <Icon size={14} style={{ color: "var(--hint)" }} />
                    <div className="flex-1 text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                      {row.label}
                    </div>
                    <div className="font-display tnum text-[14px]" style={{ fontWeight: 700 }}>
                      {row.value}
                    </div>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "var(--royal-100)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(width, row.value > 0 ? 3 : 0)}%`,
                        background: row.color,
                        transition: reduced ? undefined : "width 320ms ease",
                      }}
                    />
                  </div>
                  {i > 0 && (
                    <div className="mt-1 text-[11px]" style={{ color: "var(--hint)" }}>
                      {rate === null ? "—" : `${rate}%`} {captions[i]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 14-day chart */}
        <section className="card-sc p-5">
          <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
            14 derniers jours
          </h2>
          <p className="text-[12px]" style={{ color: "var(--hint)" }}>
            Messages envoyés par jour
          </p>
          <div className="relative mt-4 h-[140px]">
            {/* goal line */}
            <div
              className="pointer-events-none absolute left-0 right-0 border-t border-dashed"
              style={{
                bottom: `${(goal / max14) * 100}%`,
                borderColor: "var(--royal-600)",
                opacity: 0.5,
              }}
              aria-hidden
            />
            <div className="flex h-full items-end gap-1.5">
              {days14.map((k) => {
                const v = getDay(s, k).sent;
                const h = Math.max(2, Math.round((v / max14) * 100));
                const isToday = k === today;
                const reached = v >= goal;
                let bg = "transparent";
                let border = "1px solid var(--royal-100)";
                if (isToday) { bg = "var(--royal-600)"; border = "none"; }
                else if (reached) { bg = "var(--royal-800)"; border = "none"; }
                else { bg = "var(--royal-100)"; border = "1px solid #dcdef4"; }
                return (
                  <button
                    key={k}
                    onClick={() => setTip({ key: k, value: v })}
                    aria-label={`${k}: ${v} messages`}
                    className="relative flex-1 rounded-t-md"
                    style={{ height: `${h}%`, background: bg, border, minHeight: 4 }}
                  />
                );
              })}
            </div>
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {days14.map((k) => (
              <div
                key={k}
                className="flex-1 text-center text-[10px] tnum"
                style={{ color: k === today ? "var(--royal-600)" : "var(--hint)", fontWeight: k === today ? 700 : 500 }}
              >
                {formatDayNum(k)}
              </div>
            ))}
          </div>
          {tip && (
            <div
              role="status"
              className="mt-3 rounded-lg px-3 py-2 text-[12px]"
              style={{ background: "var(--royal-100)", color: "var(--navy-950)" }}
            >
              <span className="font-medium">{formatLongFr(tip.key)}</span> — <span className="tnum font-semibold">{tip.value}</span> message{tip.value > 1 ? "s" : ""}
            </div>
          )}
        </section>

        <p className="pt-2 pb-2 text-center text-[12px] italic" style={{ color: "var(--hint)" }}>
          On apprend. On ajuste. On avance.
        </p>
      </div>

      <style>{`
        @keyframes sc-pop {
          0% { transform: scale(1); }
          40% { transform: scale(1.14); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function StepTile({
  label,
  value,
  highlight,
  onMinus,
  onPlus,
  ariaLabel,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  onMinus: () => void;
  onPlus: () => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="card-sc flex flex-col p-3"
      style={highlight ? { background: "var(--royal-100)", borderColor: "#d5d8f2" } : undefined}
    >
      <div className="text-[12px] font-medium" style={{ color: "var(--hint)" }}>
        {label}
      </div>
      <div
        className="mt-1 font-display tnum"
        style={{ fontWeight: 700, fontSize: 26, color: "var(--navy-950)" }}
      >
        {value}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button
          onClick={onMinus}
          disabled={value === 0}
          aria-label={`Retirer un ${ariaLabel}`}
          className="stepper-btn"
        >
          −
        </button>
        <button
          onClick={onPlus}
          aria-label={`Ajouter un ${ariaLabel}`}
          className="stepper-btn"
          style={{ background: "var(--royal-800)", color: "#fff" }}
        >
          +
        </button>
      </div>
    </div>
  );
}

function MilestoneBanner({ totalClients }: { totalClients: number }) {
  if (totalClients === 0) {
    return (
      <div
        className="flex items-start gap-3 rounded-2xl p-4"
        style={{ background: "var(--royal-100)" }}
      >
        <TargetIcon size={20} style={{ color: "var(--royal-800)", marginTop: 2 }} />
        <div className="text-[13px] leading-snug" style={{ color: "var(--navy-950)" }}>
          <span className="font-semibold">Objectif : ton premier client.</span> Chaque message t'en rapproche.
        </div>
      </div>
    );
  }
  const text =
    totalClients === 1
      ? "Premier client décroché — la machine est lancée !"
      : `${totalClients} clients signés — continue sur ta lancée !`;
  return (
    <div
      className="rounded-2xl p-4 text-white"
      style={{ background: "var(--royal-800)" }}
    >
      <div className="text-[13px] font-semibold leading-snug">{text}</div>
    </div>
  );
}
