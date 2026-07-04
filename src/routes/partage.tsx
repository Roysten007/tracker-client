import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

// Route cible du Web Share Target (mobile). Le manifest PWA envoie ici title, text, url
// en query GET. On les concatène pour l'Analyseur puis on redirige vers /chasse.
export const Route = createFileRoute("/partage")({
  head: () => ({
    meta: [
      { title: "Analyser un profil partagé — Sprint Machine" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PartagePage,
});

function PartagePage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const title = params.get("title") ?? "";
    const text = params.get("text") ?? "";
    const url = params.get("url") ?? "";
    const texte = [title, text].filter(Boolean).join("\n\n");
    const search = new URLSearchParams();
    if (texte) search.set("texte", texte);
    if (url) search.set("source", url);
    navigate({ to: "/chasse", search: search.toString() ? Object.fromEntries(search) : undefined });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <p className="text-[13px]" style={{ color: "var(--hint)" }}>Redirection vers l'analyseur…</p>
    </div>
  );
}
