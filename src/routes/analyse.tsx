import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

// Route cible de l'extension navigateur (Firefox first, Chrome compat).
// L'extension ouvre : /analyse#texte=<encoded>&source=<encoded>
// Le fragment (#) reste dans le navigateur, jamais envoyé au serveur — c'est le point.
// On lit le hash et on redirige vers /chasse en query string (chasse re-lit hash + query).
export const Route = createFileRoute("/analyse")({
  head: () => ({
    meta: [
      { title: "Analyser — Sprint Machine" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalysePage,
});

function AnalysePage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const hashParams = new URLSearchParams(hash);
    const texte = hashParams.get("texte") ?? "";
    const source = hashParams.get("source") ?? "";
    const coller = hashParams.get("coller") === "1";

    // Cas repli presse-papiers : l'extension a copié le texte dans le clipboard.
    if (coller) {
      navigate({ to: "/chasse", search: { coller: "1" } });
      return;
    }

    const search: Record<string, string> = {};
    if (texte) search.texte = texte;
    if (source) search.source = source;
    navigate({ to: "/chasse", search: Object.keys(search).length ? search : undefined });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <p className="text-[13px]" style={{ color: "var(--hint)" }}>Chargement de l'analyse…</p>
    </div>
  );
}
