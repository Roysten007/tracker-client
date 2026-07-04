import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  X,
} from "lucide-react";

import { creerProspect, useHydraterSM, useSprintMachine } from "../lib/store2";
import { getServiceIA } from "../services/ia";
import type { AnalyseProfil, Plateforme, Segment } from "../lib/types";
import { LABEL_PLATEFORME, LABEL_SEGMENT } from "../lib/types";

export const Route = createFileRoute("/chasse")({
  head: () => ({
    meta: [
      { title: "Chasse — Sprint Machine" },
      { name: "description", content: "Trouver, qualifier, ajouter tes prospects." },
    ],
  }),
  component: ChassePage,
});

// -------- Bibliothèque des 6 requêtes ----------------------------------------

const REQUETES: {
  id: string;
  titre: string;
  description: string;
  url?: string;
  note?: string;
}[] = [
  {
    id: "A",
    titre: "Diaspora LinkedIn",
    description: "Béninois·es en Europe/Amérique, coachs ou consultants.",
    url:
      "https://www.linkedin.com/search/results/people/?keywords=%28%22b%C3%A9ninois%22%20OR%20%22b%C3%A9ninoise%22%29%20AND%20%28coach%20OR%20consultant%29",
  },
  {
    id: "B",
    titre: "X-ray Google",
    description: "Recherche croisée LinkedIn via Google sur les grandes villes de diaspora.",
    url:
      "https://www.google.com/search?q=site%3Alinkedin.com%2Fin+%28%22b%C3%A9ninois%22+OR+%22b%C3%A9ninoise%22%29+%28coach+OR+consultant%29+%28Paris+OR+Lyon+OR+Bruxelles+OR+Montr%C3%A9al%29",
  },
  {
    id: "C",
    titre: "Minage de réactions",
    description:
      "Ouvre un post à 50+ réactions : la liste des personnes qui ont réagi = des prospects actifs.",
    url: "https://www.linkedin.com/search/results/content/?keywords=%22diaspora%20b%C3%A9ninoise%22",
  },
  {
    id: "D",
    titre: "Groupes Facebook",
    description: "Communautés béninoises en France (adaptable à d'autres villes).",
    url: "https://www.facebook.com/search/groups/?q=b%C3%A9ninois%20de%20France",
  },
  {
    id: "E",
    titre: "Instagram local",
    description: "Entrepreneurs béninois via hashtag ciblé.",
    url: "https://www.instagram.com/explore/tags/entrepreneurbeninois/",
  },
  {
    id: "F",
    titre: "Mon réseau",
    description:
      "Les réactions de tes propres posts = tes prospects les plus chauds. Rien à ouvrir ici — va voir tes notifications.",
  },
];

// -------- Composant page -----------------------------------------------------

function ChassePage() {
  useHydraterSM();
  const s = useSprintMachine();

  const [prefill, setPrefill] = useState<Partial<AnalyseProfil> | null>(null);
  const [analyse, setAnalyse] = useState<AnalyseProfil | null>(null);
  const [texteBrut, setTexteBrut] = useState("");
  const [urlSource, setUrlSource] = useState("");
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [analyseErreur, setAnalyseErreur] = useState<string | null>(null);
  const [filtreOuvert, setFiltreOuvert] = useState(false);
  const [toastAjout, setToastAjout] = useState<string | null>(null);

  // Support deep-link /partage (Web Share Target) et /analyse (extension) via query params
  // rétro-compatibles — voir routes/partage.tsx et routes/analyse.tsx qui redirigent ici avec
  // ?texte=... et ?source=... (on lit aussi le hash pour Firefox).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const hashParams = window.location.hash.startsWith("#")
      ? new URLSearchParams(window.location.hash.slice(1))
      : null;
    const t = params.get("texte") ?? hashParams?.get("texte") ?? "";
    const src = params.get("source") ?? hashParams?.get("source") ?? "";
    if (t) {
      setTexteBrut(t);
      setUrlSource(src);
      // Nettoie l'URL pour éviter de re-déclencher au refresh.
      window.history.replaceState(null, "", "/chasse");
    }
  }, []);

  const analyser = async () => {
    setAnalyseErreur(null);
    setAnalyseEnCours(true);
    setAnalyse(null);
    try {
      const service = getServiceIA(s.config);
      const r = await service.analyserProfil(texteBrut, urlSource || undefined);
      setAnalyse(r);
    } catch (e) {
      setAnalyseErreur(
        e instanceof Error
          ? e.message
          : "Impossible d'analyser — vérifie ta clé Gemini dans Réglages.",
      );
    } finally {
      setAnalyseEnCours(false);
    }
  };

  const creerFicheDepuisAnalyse = () => {
    if (!analyse) return;
    setPrefill({
      prenom: analyse.prenom,
      metier: analyse.metier,
      segment: analyse.segment,
      detail: analyse.detail,
    });
    // Scroll vers le formulaire.
    setTimeout(() => {
      document.getElementById("formulaire-ajout")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const [signalActifs, setSignalActifs] = useState({
    actif: false,
    nomMarque: false,
    pasDeSite: false,
    montreTravail: false,
    solvable: false,
  });
  const nbSignauxActifs = Object.values(signalActifs).filter(Boolean).length;

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
          Chasse
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--royal-100)" }}>
          Trouver, qualifier, ajouter.
        </p>
      </header>

      <div className="p-4 space-y-5 md:mt-6">
        {/* Formulaire d'ajout rapide */}
        <section id="formulaire-ajout" className="card-sc p-5">
          <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
            Ajouter un prospect
          </h2>
          <p className="text-[12px]" style={{ color: "var(--hint)" }}>
            20 secondes chrono.
          </p>
          <FormulaireProspect
            prefill={prefill}
            onCree={(nom) => {
              setPrefill(null);
              setToastAjout(`${nom} ajouté à la Chasse.`);
              setTimeout(() => setToastAjout(null), 3000);
            }}
          />
        </section>

        {/* Analyseur de profil */}
        <section className="card-sc p-5">
          <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
            Analyseur de profil
          </h2>
          <p className="text-[12px]" style={{ color: "var(--hint)" }}>
            Colle ici le texte du profil (bio, à propos, derniers posts) pour évaluer les 5 signaux.
          </p>
          {urlSource && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--hint)" }}>
              <ExternalLink size={12} /> Source : <span className="font-medium">{urlSource}</span>
            </div>
          )}
          <textarea
            value={texteBrut}
            onChange={(e) => setTexteBrut(e.target.value)}
            rows={6}
            placeholder="Bio, description, derniers posts…"
            className="mt-3 w-full resize-none rounded-xl border border-[#E7E8F4] bg-white p-3 text-[13px] leading-relaxed"
          />
          <button
            onClick={analyser}
            disabled={!texteBrut.trim() || analyseEnCours}
            className="btn-primary-sc mt-3 flex w-full items-center justify-center gap-2 py-3"
          >
            <Sparkles size={16} /> {analyseEnCours ? "Analyse en cours…" : "Analyser"}
          </button>
          {analyseErreur && (
            <div
              role="alert"
              className="mt-3 rounded-xl px-3 py-2 text-[12px]"
              style={{ background: "#fee", color: "var(--navy-950)" }}
            >
              {analyseErreur}
            </div>
          )}

          {analyse && (
            <ResultatAnalyse analyse={analyse} onCreerFiche={creerFicheDepuisAnalyse} />
          )}
        </section>

        {/* Bibliothèque des 6 requêtes */}
        <section className="card-sc p-5">
          <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
            La bibliothèque
          </h2>
          <p className="text-[12px]" style={{ color: "var(--hint)" }}>
            Six manières de trouver de nouveaux prospects.
          </p>
          <div className="mt-4 space-y-2.5">
            {REQUETES.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-3 rounded-xl border border-[#E7E8F4] p-3"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-display text-white"
                  style={{ background: "var(--royal-800)", fontWeight: 700 }}
                >
                  {r.id}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium" style={{ color: "var(--navy-950)" }}>
                    {r.titre}
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--hint)" }}>
                    {r.description}
                  </div>
                </div>
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg border border-[#E7E8F4] bg-white px-3 py-1.5 text-[12px] font-medium"
                    style={{ color: "var(--navy-950)" }}
                  >
                    Ouvrir <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="rounded-lg px-3 py-1.5 text-[10px]" style={{ color: "var(--hint)" }}>
                    Rappel
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Filtre 5 signaux */}
        <section className="card-sc p-5">
          <button
            onClick={() => setFiltreOuvert((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
                Filtre 5 signaux
              </h2>
              <span className="text-[11px]" style={{ color: "var(--hint)" }}>
                règle 3/5 · {nbSignauxActifs} coché{nbSignauxActifs > 1 ? "s" : ""}
              </span>
            </div>
            {filtreOuvert ? (
              <ChevronUp size={18} style={{ color: "var(--hint)" }} />
            ) : (
              <ChevronDown size={18} style={{ color: "var(--hint)" }} />
            )}
          </button>
          {filtreOuvert && (
            <div className="mt-4 space-y-2">
              {(
                [
                  ["actif", "Actif — publie ou commente"],
                  ["nomMarque", "Nom = marque (freelance, coach, créatif)"],
                  ["pasDeSite", "Pas de site personnel visible"],
                  ["montreTravail", "Montre son travail / ses projets"],
                  ["solvable", "Solvable (diaspora, tarifs pro, activité)"],
                ] as const
              ).map(([k, lib]) => (
                <label
                  key={k}
                  className="flex items-center justify-between rounded-xl border border-[#E7E8F4] bg-white px-3 py-2.5"
                >
                  <span className="text-[13px]" style={{ color: "var(--ink)" }}>
                    {lib}
                  </span>
                  <input
                    type="checkbox"
                    checked={signalActifs[k]}
                    onChange={(e) =>
                      setSignalActifs((prev) => ({ ...prev, [k]: e.target.checked }))
                    }
                    className="h-5 w-5"
                  />
                </label>
              ))}
              <div
                className="mt-2 rounded-xl px-3 py-2 text-[11px]"
                style={{ background: "var(--royal-100)", color: "var(--navy-950)" }}
              >
                {nbSignauxActifs >= 3
                  ? "✓ Prospect à retenir (règle 3/5 atteinte)."
                  : "Encore quelques signaux à cocher avant de retenir ce prospect."}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Toast confirmation ajout */}
      {toastAjout && (
        <div
          role="status"
          className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[12px] text-white shadow-lg"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 120px)", background: "var(--royal-800)" }}
        >
          {toastAjout}
        </div>
      )}

    </div>
  );
}

// -------- Formulaire d'ajout rapide ------------------------------------------

function FormulaireProspect({
  prefill,
  onCree,
}: {
  prefill: Partial<AnalyseProfil> | null;
  onCree: (nom: string) => void;
}) {
  const refPrenom = useRef<HTMLInputElement>(null);
  const [prenom, setPrenom] = useState("");
  const [plateforme, setPlateforme] = useState<Plateforme>("linkedin");
  const [metier, setMetier] = useState("");
  const [detail, setDetail] = useState("");
  const [segment, setSegment] = useState<Segment>("creatif");
  const [lien, setLien] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.prenom) setPrenom(prefill.prenom);
    if (prefill.metier) setMetier(prefill.metier);
    if (prefill.detail) setDetail(prefill.detail);
    if (prefill.segment) setSegment(prefill.segment);
  }, [prefill]);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prenom || !metier || !detail) return;
    setEnCours(true);
    try {
      await creerProspect({
        prenom: prenom.trim(),
        plateforme,
        metier: metier.trim(),
        detail: detail.trim(),
        segment,
        lien: lien.trim() || undefined,
        source: "manuel",
      });
      onCree(prenom.trim());
      setPrenom("");
      setMetier("");
      setDetail("");
      setLien("");
      refPrenom.current?.focus();
    } finally {
      setEnCours(false);
    }
  };

  return (
    <form onSubmit={soumettre} className="mt-4 space-y-3">
      <Champ label="Prénom *">
        <input
          ref={refPrenom}
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          required
          className="input-sc"
        />
      </Champ>

      <Champ label="Plateforme *">
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(LABEL_PLATEFORME) as Plateforme[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlateforme(p)}
              className="rounded-xl border py-2 text-[12px] font-medium"
              style={{
                borderColor: plateforme === p ? "var(--royal-800)" : "#E7E8F4",
                background: plateforme === p ? "var(--royal-100)" : "#fff",
                color: plateforme === p ? "var(--royal-800)" : "var(--ink)",
                fontWeight: plateforme === p ? 700 : 500,
              }}
            >
              {LABEL_PLATEFORME[p]}
            </button>
          ))}
        </div>
      </Champ>

      <Champ label="Métier *">
        <input
          value={metier}
          onChange={(e) => setMetier(e.target.value)}
          required
          placeholder="Coach de vie, photographe, consultant…"
          className="input-sc"
        />
      </Champ>

      <Champ label="Détail précis * (utilisé en 1re ligne du message)">
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          required
          placeholder="ex. : sa série photo mariage à Ouidah"
          className="input-sc"
        />
      </Champ>

      <Champ label="Segment *">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(LABEL_SEGMENT) as Segment[]).map((sg) => (
            <button
              key={sg}
              type="button"
              onClick={() => setSegment(sg)}
              className="rounded-xl border py-2 text-[12px] font-medium"
              style={{
                borderColor: segment === sg ? "var(--royal-800)" : "#E7E8F4",
                background: segment === sg ? "var(--royal-100)" : "#fff",
                color: segment === sg ? "var(--royal-800)" : "var(--ink)",
                fontWeight: segment === sg ? 700 : 500,
              }}
            >
              {LABEL_SEGMENT[sg]}
            </button>
          ))}
        </div>
      </Champ>

      <Champ label="Lien / numéro (optionnel)">
        <input
          value={lien}
          onChange={(e) => setLien(e.target.value)}
          placeholder="URL profil ou +229…"
          className="input-sc"
        />
      </Champ>

      <button type="submit" disabled={enCours} className="btn-primary-sc w-full py-3">
        {enCours ? "Ajout…" : "Ajouter à la Chasse"}
      </button>
    </form>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px]" style={{ color: "var(--hint)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

// -------- Affichage résultat analyse -----------------------------------------

function ResultatAnalyse({
  analyse,
  onCreerFiche,
}: {
  analyse: AnalyseProfil;
  onCreerFiche: () => void;
}) {
  const items: [keyof typeof analyse.signaux, string][] = [
    ["actif", "Actif"],
    ["nomMarque", "Nom = marque"],
    ["pasDeSite", "Pas de site visible"],
    ["montreTravail", "Montre son travail"],
    ["solvable", "Solvable"],
  ];
  const retenu = analyse.verdict === "retenu";

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-[12px] font-semibold text-white"
            style={{ background: retenu ? "var(--royal-800)" : "var(--navy-950)" }}
          >
            {retenu ? "✓ Retenu" : "✗ Écarté"}
          </span>
          <span className="text-[12px]" style={{ color: "var(--hint)" }}>
            Score {analyse.score}/5
          </span>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: "var(--royal-100)", color: "var(--royal-800)" }}
        >
          {LABEL_SEGMENT[analyse.segment]}
        </span>
      </div>

      <ul className="space-y-1.5">
        {items.map(([k, lib]) => {
          const oui = analyse.signaux[k];
          return (
            <li
              key={k}
              className="flex items-start gap-2 rounded-lg p-2"
              style={{ background: oui ? "var(--royal-50)" : "#f7f7f9" }}
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: oui ? "var(--royal-800)" : "#ccc" }}
              >
                {oui ? <Check size={13} color="#fff" /> : <X size={13} color="#fff" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium" style={{ color: "var(--navy-950)" }}>
                  {lib}
                </div>
                {analyse.justifications[k] && (
                  <div className="text-[11px]" style={{ color: "var(--hint)" }}>
                    {analyse.justifications[k]}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {analyse.detail && (
        <div className="rounded-xl p-3" style={{ background: "var(--royal-100)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--royal-800)" }}>
            Détail à utiliser en 1re ligne
          </div>
          <div className="mt-1 text-[13px]" style={{ color: "var(--navy-950)" }}>
            « {analyse.detail} »
          </div>
        </div>
      )}
      {analyse.angle && (
        <div className="text-[12px]" style={{ color: "var(--hint)" }}>
          <span className="font-semibold" style={{ color: "var(--navy-950)" }}>
            Angle :
          </span>{" "}
          {analyse.angle}
        </div>
      )}

      {retenu && (
        <button onClick={onCreerFiche} className="btn-primary-sc w-full py-3">
          Créer la fiche
        </button>
      )}
    </div>
  );
}
