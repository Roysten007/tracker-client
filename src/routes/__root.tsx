import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Target, KanbanSquare, Search, BarChart3 } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { attachCloudSync, detachCloudSync } from "../lib/store";
import { attacherSyncSM, detacherSyncSM } from "../lib/store2";
import { useAuthUser, sendLoginLink, isLoginLink, completeLoginFromLink, isAllowedEmail } from "../lib/auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Cette page ne s'est pas chargée
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Un souci est survenu. Réessaie ou reviens à l'accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Sprint Machine — Prospection assistée" },
      { name: "description", content: "Suivi quotidien de prospection commerciale : messages, réponses, appels, clients. Roy Sten Design." },
      { name: "author", content: "Roy Sten Design" },
      { name: "theme-color", content: "#0A0A78" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Sprint Machine" },
      { property: "og:title", content: "Sprint Machine" },
      { property: "og:description", content: "Tracker personnel de prospection commerciale." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const NAV_ITEMS = [
  { to: "/", label: "Aujourd'hui", icon: Target, match: (p: string) => p === "/" },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare, match: (p: string) => p.startsWith("/pipeline") },
  { to: "/chasse", label: "Chasse", icon: Search, match: (p: string) => p.startsWith("/chasse") || p.startsWith("/partage") || p.startsWith("/analyse") },
  { to: "/rapport", label: "Rapport", icon: BarChart3, match: (p: string) => p.startsWith("/rapport") },
] as const;

function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      aria-label="Navigation principale"
      className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-[#E7E8F4] md:bg-white"
    >
      <div className="px-6 pb-6 pt-8">
        <div className="text-[11px] font-medium tracking-[0.22em]" style={{ color: "var(--hint)" }}>
          ROY STEN DESIGN
        </div>
        <div className="mt-1.5 font-display" style={{ fontWeight: 800, fontSize: 20, color: "var(--navy-950)" }}>
          Sprint Machine
        </div>
      </div>
      <ul className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                aria-current={active ? "page" : undefined}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-display text-[14px]"
                style={{
                  color: active ? "#fff" : "var(--ink)",
                  background: active ? "var(--royal-800)" : "transparent",
                  fontWeight: active ? 700 : 500,
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E7E8F4] bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {NAV_ITEMS.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <li key={it.to} className="flex-1">
              <Link
                to={it.to}
                aria-label={it.label}
                aria-current={active ? "page" : undefined}
                className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5"
                style={{ color: active ? "var(--royal-800)" : "var(--hint)" }}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                <span
                  className="text-[11px] font-display"
                  style={{ fontWeight: active ? 700 : 500 }}
                >
                  {it.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "completing" | "need-email">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoginLink()) return;
    setStatus("completing");
    completeLoginFromLink().catch(() => setStatus("need-email"));
  }, []);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!isAllowedEmail(email)) {
      setError("Cette app est réservée à un usage personnel — cette adresse n'est pas autorisée.");
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      await sendLoginLink(email);
      setStatus("sent");
    } catch {
      setError("Impossible d'envoyer le lien. Vérifie l'adresse et réessaie.");
      setStatus("idle");
    }
  };

  const onConfirmEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("completing");
    try {
      await completeLoginFromLink(email);
    } catch {
      setError("Ce lien n'est plus valide. Redemande une connexion.");
      setStatus("idle");
    }
  };

  if (status === "completing") {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <p className="text-[13px]" style={{ color: "var(--hint)" }}>Connexion en cours…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <div className="text-[11px] font-medium tracking-[0.22em]" style={{ color: "var(--hint)" }}>
            ROY STEN DESIGN
          </div>
          <h1 className="mt-1.5 font-display" style={{ fontWeight: 800, fontSize: 26, color: "var(--navy-950)" }}>
            Sprint Machine
          </h1>
        </div>

        {status === "sent" ? (
          <div className="card-sc mt-8 p-5 text-center">
            <p className="text-[14px]" style={{ color: "var(--navy-950)" }}>
              Vérifie ta boîte mail — <span className="font-semibold">{email}</span>
            </p>
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--hint)" }}>
              Clique sur le lien reçu pour te connecter.
            </p>
          </div>
        ) : status === "need-email" ? (
          <form onSubmit={onConfirmEmail} className="card-sc mt-8 space-y-3 p-5">
            <p className="text-[13px]" style={{ color: "var(--hint)" }}>
              Confirme ton adresse pour terminer la connexion.
            </p>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              className="w-full rounded-xl border border-[#E7E8F4] bg-white px-3 py-3 text-[15px]"
            />
            <button type="submit" className="btn-primary-sc w-full py-3">
              Confirmer
            </button>
          </form>
        ) : (
          <form onSubmit={onSend} className="card-sc mt-8 space-y-3 p-5">
            <label className="block">
              <span className="mb-1.5 block text-[13px]" style={{ color: "var(--hint)" }}>
                Adresse email
              </span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                className="w-full rounded-xl border border-[#E7E8F4] bg-white px-3 py-3 text-[15px]"
              />
            </label>
            <button type="submit" disabled={status === "sending"} className="btn-primary-sc w-full py-3">
              {status === "sending" ? "Envoi…" : "Recevoir un lien de connexion"}
            </button>
            {error && (
              <p className="text-[12px]" style={{ color: "var(--royal-600)" }}>
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const user = useAuthUser();

  useEffect(() => {
    if (!user) return;
    // Legacy V0 sync (tracker) — reste actif pour la compat rétro pendant Phase 2.
    attachCloudSync(user.uid);
    // Nouveau modèle Sprint Machine V1 (prospects/messages/jours/reglages).
    attacherSyncSM(user.uid);
    return () => {
      detachCloudSync();
      detacherSyncSM();
    };
  }, [user]);

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[13px]" style={{ color: "var(--hint)" }}>Chargement…</p>
      </div>
    );
  }

  if (user === null) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <div className="md:flex md:min-h-screen">
          <Sidebar />
          <div className="mx-auto w-full max-w-md pb-[88px] md:mx-0 md:max-w-none md:flex-1 md:pb-0">
            <Outlet />
          </div>
        </div>
        <BottomNav />
      </AuthGate>
    </QueryClientProvider>
  );
}
