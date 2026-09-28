import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  Globe,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Share2,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";

import { creerProspect, useHydraterSM, useSprintMachine } from "../lib/store2";
import { getServiceIA, nettoyerNumeroTelephone } from "../services/ia";
import type { AnalyseProfil, Plateforme, Segment } from "../lib/types";
import { LABEL_PLATEFORME, LABEL_SEGMENT } from "../lib/types";

export const Route = createFileRoute("/chasse")({
  head: () => ({
    meta: [
      { title: "Chasse & Radar Prospects — Sprint Machine" },
      {
        name: "description",
        content: "Trouver, qualifier et closer les meilleures opportunités en Afrique & Diaspora.",
      },
    ],
  }),
  component: ChassePage,
});

// -------- VILLES & NICHES LOCALES AFRICAINES ---------------------------------

type VilleCible = {
  id: string;
  nom: string;
  pays: string;
  drapeau: string;
  indicatif: string;
};

const VILLES_CIBLES: VilleCible[] = [
  { id: "cotonou", nom: "Cotonou & Porto-Novo", pays: "Bénin", drapeau: "🇧🇯", indicatif: "+229" },
  { id: "abidjan", nom: "Abidjan", pays: "Côte d'Ivoire", drapeau: "🇨🇮", indicatif: "+225" },
  { id: "dakar", nom: "Dakar", pays: "Sénégal", drapeau: "🇸🇳", indicatif: "+221" },
  { id: "douala", nom: "Douala & Yaoundé", pays: "Cameroun", drapeau: "🇨🇲", indicatif: "+237" },
  { id: "lome", nom: "Lomé", pays: "Togo", drapeau: "🇹🇬", indicatif: "+228" },
  { id: "ouaga", nom: "Ouagadougou", pays: "Burkina Faso", drapeau: "🇧🇫", indicatif: "+226" },
  {
    id: "diaspora",
    nom: "Diaspora (Paris, Montréal)",
    pays: "International",
    drapeau: "🌍",
    indicatif: "+33",
  },
];

type NicheCible = {
  id: string;
  nom: string;
  icone: string;
  termesRecherche: string;
  opportuniteTypique: string;
};

const NICHES_CIBLES: NicheCible[] = [
  {
    id: "sante",
    nom: "Cliniques & Santé",
    icone: "🏥",
    termesRecherche: "clinique médicale cabinet dentaire centre de santé",
    opportuniteTypique:
      "Prise de rendez-vous compliquée, site absent ou lent, perte de patients au profit des cliniques modernes.",
  },
  {
    id: "immo",
    nom: "Immobilier & Promoteurs",
    icone: "🏢",
    termesRecherche: "agence immobilière promoteur immobilier vente villa appartement",
    opportuniteTypique:
      "Catalogues de biens désordonnés sur WhatsApp au lieu d'une vitrine de prestige qui justifie leurs commissions.",
  },
  {
    id: "resto",
    nom: "Restaurants & Lounges VIP",
    icone: "🍽️",
    termesRecherche: "restaurant lounge bar gastronomique traiteur",
    opportuniteTypique:
      "Menu en PDF illisible sur smartphone, absence de réservation WhatsApp 1-clic.",
  },
  {
    id: "ecole",
    nom: "Écoles & Universités",
    icone: "🎓",
    termesRecherche: "école privée institut supérieur académie formation",
    opportuniteTypique:
      "Inscriptions fastidieuses en physique, absence de landing page dédiée à la rentrée.",
  },
  {
    id: "mode",
    nom: "Mode, Beauté & E-commerce",
    icone: "👗",
    termesRecherche: "boutique prêt-à-porter salon de coiffure esthétique cosmétique",
    opportuniteTypique:
      "Vente laborieuse en DM Instagram avec prix demandés en boucle au lieu d'un catalogue WhatsApp direct.",
  },
  {
    id: "droit",
    nom: "Cabinets Juridiques & Notaires",
    icone: "⚖️",
    termesRecherche: "cabinet d'avocats notaire expert-comptable conseil fiscal",
    opportuniteTypique:
      "Image vieillissante sur Google, manque de réassurance pour les clients de la diaspora et entreprises.",
  },
  {
    id: "btp",
    nom: "BTP, Architecture & Déco",
    icone: "🏗️",
    termesRecherche: "entreprise BTP architecte d'intérieur décoration rénovation",
    opportuniteTypique:
      "Chantiers de plusieurs dizaines de millions sans portfolio en ligne à présenter aux investisseurs.",
  },
  {
    id: "coach",
    nom: "Coachs & Consultants",
    icone: "🚀",
    termesRecherche: "coach consultant formateur conférencier",
    opportuniteTypique:
      "Recommandations par le bouche-à-oreille mais crédibilité en ligne limitée sans site à leur nom.",
  },
];

// -------- Bibliothèque historique des 6 requêtes ----------------------------

const REQUETES_HISTORIQUES = [
  {
    id: "A",
    titre: "Diaspora LinkedIn",
    description: "Professionnels africains en Europe/Amérique (coachs, consultants, experts).",
    url: "https://www.linkedin.com/search/results/people/?keywords=%28%22b%C3%A9ninois%22%20OR%20%22ivoirien%22%20OR%20%22s%C3%A9n%C3%A9galais%22%29%20AND%20%28coach%20OR%20consultant%29",
  },
  {
    id: "B",
    titre: "X-ray Google Diaspora",
    description: "Recherche croisée LinkedIn sur Paris, Lyon, Bruxelles, Montréal.",
    url: "https://www.google.com/search?q=site%3Alinkedin.com%2Fin+%28%22b%C3%A9ninois%22+OR+%22africain%22%29+%28coach+OR+consultant%29+%28Paris+OR+Lyon+OR+Bruxelles+OR+Montr%C3%A9al%29",
  },
  {
    id: "C",
    titre: "Minage de réactions",
    description:
      "Les personnes qui réagissent aux posts business en Afrique = des prospects actifs.",
    url: "https://www.linkedin.com/search/results/content/?keywords=%22business%20afrique%22%20OR%20%22entrepreneuriat%22",
  },
  {
    id: "D",
    titre: "Groupes Facebook Locaux",
    description: "Groupes d'entrepreneurs locaux et diaspora avec numéros WhatsApp partagés.",
    url: "https://www.facebook.com/search/groups/?q=entrepreneurs%20afrique",
  },
  {
    id: "E",
    titre: "Instagram Local Business",
    description: "Recherche par hashtags géolocalisés de business africains.",
    url: "https://www.instagram.com/explore/tags/entrepreneurbeninois/",
  },
  {
    id: "F",
    titre: "Réseau Chaud & Contacts",
    description: "Tes contacts téléphoniques et notifications : les personnes déjà en confiance.",
  },
];

// -------- Composant page -----------------------------------------------------

function ChassePage() {
  useHydraterSM();
  const s = useSprintMachine();

  const [onglet, setOnglet] = useState<"radar" | "extracteur" | "manuel">("radar");

  // Sélections pour le Radar
  const [villeChoisie, setVilleChoisie] = useState<VilleCible>(VILLES_CIBLES[0]);
  const [nicheChoisie, setNicheChoisie] = useState<NicheCible>(NICHES_CIBLES[0]);

  // Analyseur / Extracteur
  const [prefill, setPrefill] = useState<Partial<AnalyseProfil> | null>(null);
  const [analyse, setAnalyse] = useState<AnalyseProfil | null>(null);
  const [texteBrut, setTexteBrut] = useState("");
  const [urlSource, setUrlSource] = useState("");
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [analyseErreur, setAnalyseErreur] = useState<string | null>(null);
  const [filtreOuvert, setFiltreOuvert] = useState(false);
  const [toastAjout, setToastAjout] = useState<string | null>(null);

  // Deep-link /partage et /analyse
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
      setOnglet("extracteur");
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
          : "Erreur lors de l'analyse — réessaie ou ajoute le prospect manuellement.",
      );
    } finally {
      setAnalyseEnCours(false);
    }
  };

  const creerFicheDirecteDepuisAnalyse = async () => {
    if (!analyse) return;
    const prenom = analyse.prenom.trim() || analyse.entreprise || "Prospect";
    await creerProspect({
      prenom,
      entreprise: analyse.entreprise || prenom,
      telephone: analyse.telephone || undefined,
      ville: analyse.ville || villeChoisie.nom,
      niche: analyse.niche || nicheChoisie.nom,
      opportunite: analyse.opportunite || analyse.detail,
      auditFlash: analyse.auditFlash || undefined,
      metier: analyse.metier || nicheChoisie.nom,
      detail: analyse.detail || `Activité repérée dans ${nicheChoisie.nom}`,
      segment: analyse.segment || "creatif",
      plateforme: analyse.telephone ? "whatsapp" : "linkedin",
      source: "manuel",
      montantEstime: 250000,
    });
    setToastAjout(`${prenom} ajouté directement au Pipeline !`);
    setTimeout(() => setToastAjout(null), 3000);
    setTexteBrut("");
    setAnalyse(null);
  };

  const basculerVersFormulaireAvecPrefill = () => {
    if (!analyse) return;
    setPrefill({
      prenom: analyse.prenom,
      entreprise: analyse.entreprise,
      telephone: analyse.telephone,
      metier: analyse.metier,
      segment: analyse.segment,
      detail: analyse.detail,
      ville: analyse.ville,
      niche: analyse.niche,
      opportunite: analyse.opportunite,
    });
    setOnglet("manuel");
  };

  const [signalActifs, setSignalActifs] = useState({
    actif: false,
    nomMarque: false,
    pasDeSite: false,
    montreTravail: false,
    solvable: false,
  });
  const nbSignauxActifs = Object.values(signalActifs).filter(Boolean).length;

  // Liens dynamiques générés pour le Radar
  const liensRadar = useMemo(() => {
    const villeNom = villeChoisie.nom.split("&")[0].trim();
    const queryGmaps = encodeURIComponent(`${nicheChoisie.termesRecherche} ${villeNom}`);
    const queryInsta = encodeURIComponent(`${nicheChoisie.id}${villeChoisie.id}`);
    const queryLinkedin = encodeURIComponent(
      `site:linkedin.com/in ("Directeur" OR "Gérant" OR "Fondateur" OR "CEO") ("${nicheChoisie.nom}") ("${villeNom}")`,
    );
    const queryFacebook = encodeURIComponent(`${nicheChoisie.nom} ${villeNom}`);

    return {
      google: `https://www.google.com/search?q=${queryGmaps}`,
      instagram: `https://www.instagram.com/explore/tags/${queryInsta}/`,
      linkedin: `https://www.google.com/search?q=${queryLinkedin}`,
      facebook: `https://www.facebook.com/search/pages/?q=${queryFacebook}`,
    };
  }, [villeChoisie, nicheChoisie]);

  return (
    <div className="pb-10 md:mx-auto md:max-w-4xl">
      {/* Header prestige */}
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
              Machine de Prospection B2B
            </div>
            <h1 className="mt-1 font-display text-white" style={{ fontWeight: 800, fontSize: 28 }}>
              Chasse & Radar Prospects
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: "var(--royal-100)" }}>
              Trouver, qualifier et closer les meilleures opportunités en Afrique & Diaspora.
            </p>
          </div>
        </div>

        {/* Navigation par onglets */}
        <div className="mt-6 flex rounded-xl bg-white/10 p-1 backdrop-blur-sm">
          <button
            onClick={() => setOnglet("radar")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-semibold transition"
            style={{
              background: onglet === "radar" ? "#fff" : "transparent",
              color: onglet === "radar" ? "var(--navy-950)" : "#fff",
            }}
          >
            <Target size={15} /> Radar Cible
          </button>
          <button
            onClick={() => setOnglet("extracteur")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-semibold transition"
            style={{
              background: onglet === "extracteur" ? "#fff" : "transparent",
              color: onglet === "extracteur" ? "var(--navy-950)" : "#fff",
            }}
          >
            <Sparkles size={15} /> Extracteur IA
          </button>
          <button
            onClick={() => setOnglet("manuel")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-semibold transition"
            style={{
              background: onglet === "manuel" ? "#fff" : "transparent",
              color: onglet === "manuel" ? "var(--navy-950)" : "#fff",
            }}
          >
            <Plus size={15} /> Ajout Rapide
          </button>
        </div>
      </header>

      <div className="p-4 space-y-5 md:mt-6">
        {/* =================================================================== */}
        {/* ONGLET 1 : RADAR PROSPECTS PAR VILLE ET PAR NICHE                   */}
        {/* =================================================================== */}
        {onglet === "radar" && (
          <div className="space-y-5">
            {/* Étape 1 : Choisir la Ville */}
            <section className="card-sc p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
                  1. Choisis le territoire cible
                </h2>
                <span className="text-[12px] font-medium" style={{ color: "var(--hint)" }}>
                  {villeChoisie.drapeau} {villeChoisie.pays}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {VILLES_CIBLES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVilleChoisie(v)}
                    className="flex items-center gap-2 rounded-xl border p-2.5 text-left transition"
                    style={{
                      borderColor: villeChoisie.id === v.id ? "var(--royal-800)" : "#E7E8F4",
                      background: villeChoisie.id === v.id ? "var(--royal-100)" : "#fff",
                      color: villeChoisie.id === v.id ? "var(--royal-800)" : "var(--navy-950)",
                    }}
                  >
                    <span className="text-xl">{v.drapeau}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-bold">{v.nom}</div>
                      <div className="text-[10px]" style={{ color: "var(--hint)" }}>
                        {v.indicatif}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Étape 2 : Choisir la Niche */}
            <section className="card-sc p-5">
              <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
                2. Choisis la niche à fort budget
              </h2>
              <p className="text-[12px]" style={{ color: "var(--hint)" }}>
                Ces secteurs ont du budget et signent rapidement en Afrique.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {NICHES_CIBLES.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setNicheChoisie(n)}
                    className="flex flex-col gap-1 rounded-xl border p-3 text-left transition"
                    style={{
                      borderColor: nicheChoisie.id === n.id ? "var(--royal-800)" : "#E7E8F4",
                      background: nicheChoisie.id === n.id ? "var(--royal-100)" : "#fff",
                      color: nicheChoisie.id === n.id ? "var(--royal-800)" : "var(--navy-950)",
                    }}
                  >
                    <span className="text-xl">{n.icone}</span>
                    <span className="text-[12px] font-bold leading-tight">{n.nom}</span>
                  </button>
                ))}
              </div>

              {/* Angle et opportunité typique de la niche */}
              <div
                className="mt-4 rounded-xl border border-royal-600/20 p-3.5"
                style={{ background: "var(--royal-50)" }}
              >
                <div
                  className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--royal-800)" }}
                >
                  <Flame size={14} /> Faille commerciale typique pour {nicheChoisie.nom} :
                </div>
                <p
                  className="mt-1 text-[13px] leading-relaxed"
                  style={{ color: "var(--navy-950)" }}
                >
                  {nicheChoisie.opportuniteTypique}
                </p>
              </div>
            </section>

            {/* Étape 3 : Requêtes 1-Clic Prêtes à Ouvrir */}
            <section className="card-sc p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
                    3. Lance la recherche chirurgicale (1-Clic)
                  </h2>
                  <p className="text-[12px]" style={{ color: "var(--hint)" }}>
                    Clique pour ouvrir directement les fiches avec contacts WhatsApp & décideurs.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Google Maps / Local */}
                <a
                  href={liensRadar.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-[#E7E8F4] bg-white p-3.5 transition hover:shadow-md"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ background: "var(--royal-800)" }}
                  >
                    <MapPin size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 font-bold text-[13px]">
                      Google Maps & Fiches Locales <ExternalLink size={12} />
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--hint)" }}>
                      Trouve les commerces à {villeChoisie.nom} avec numéros WhatsApp et souvent
                      sans site web.
                    </div>
                  </div>
                </a>

                {/* Instagram Local */}
                <a
                  href={liensRadar.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-[#E7E8F4] bg-white p-3.5 transition hover:shadow-md"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743)" }}
                  >
                    <MessageCircle size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 font-bold text-[13px]">
                      Instagram Business Local <ExternalLink size={12} />
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--hint)" }}>
                      Comptes très actifs avec catalogue photo et WhatsApp dans la bio.
                    </div>
                  </div>
                </a>

                {/* LinkedIn Décideurs */}
                <a
                  href={liensRadar.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-[#E7E8F4] bg-white p-3.5 transition hover:shadow-md"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ background: "#0077b5" }}
                  >
                    <Users size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 font-bold text-[13px]">
                      LinkedIn : Décideurs & Gérants <ExternalLink size={12} />
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--hint)" }}>
                      Recherche X-ray directe sur les Fondateurs, CEO et Directeurs à{" "}
                      {villeChoisie.nom}.
                    </div>
                  </div>
                </a>

                {/* Facebook Pages */}
                <a
                  href={liensRadar.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-[#E7E8F4] bg-white p-3.5 transition hover:shadow-md"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ background: "#1877f2" }}
                  >
                    <Share2 size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 font-bold text-[13px]">
                      Facebook : Pages & Groupes <ExternalLink size={12} />
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--hint)" }}>
                      Pages professionnelles locales avec boutons WhatsApp actifs.
                    </div>
                  </div>
                </a>
              </div>
            </section>

            {/* Bibliothèque historique des 6 requêtes */}
            <section className="card-sc p-5">
              <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
                Bibliothèque classique des requêtes
              </h2>
              <p className="text-[12px]" style={{ color: "var(--hint)" }}>
                Les méthodes éprouvées de prospection réseau et diaspora.
              </p>
              <div className="mt-4 space-y-2.5">
                {REQUETES_HISTORIQUES.map((r) => (
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
                      <span
                        className="rounded-lg px-3 py-1.5 text-[10px]"
                        style={{ color: "var(--hint)" }}
                      >
                        Rappel
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* =================================================================== */}
        {/* ONGLET 2 : EXTRACTEUR & PROFILER IA                                 */}
        {/* =================================================================== */}
        {onglet === "extracteur" && (
          <section className="card-sc p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
                  Extracteur d'Opportunités & Profiler IA
                </h2>
                <p className="text-[12px]" style={{ color: "var(--hint)" }}>
                  Colle ici la bio Instagram, un post Facebook, une fiche Google Maps ou une annonce
                  locale. L'IA extrait le contact WhatsApp et prépare l'accroche !
                </p>
              </div>
            </div>

            {urlSource && (
              <div
                className="mt-2 flex items-center gap-1.5 text-[11px]"
                style={{ color: "var(--hint)" }}
              >
                <ExternalLink size={12} /> Source : <span className="font-medium">{urlSource}</span>
              </div>
            )}

            <textarea
              value={texteBrut}
              onChange={(e) => setTexteBrut(e.target.value)}
              rows={5}
              placeholder="Exemple : 'Clinique Dentaire Cotonou. Soins, urgences et esthétique. Ouvert du lundi au samedi. Contact WhatsApp : +229 97 00 00 00. Haie Vive, Cotonou.'"
              className="mt-3 w-full resize-none rounded-xl border border-[#E7E8F4] bg-white p-3 text-[13px] leading-relaxed"
            />

            <div className="mt-3 flex gap-2">
              <button
                onClick={analyser}
                disabled={!texteBrut.trim() || analyseEnCours}
                className="btn-primary-sc flex flex-1 items-center justify-center gap-2 py-3"
              >
                <Sparkles size={16} /> {analyseEnCours ? "Analyse en cours…" : "Analyser avec l'IA"}
              </button>
              {texteBrut && (
                <button
                  onClick={() => {
                    setTexteBrut("");
                    setAnalyse(null);
                  }}
                  className="rounded-xl border border-[#E7E8F4] bg-white px-4 py-3 text-[12px] font-medium"
                  style={{ color: "var(--hint)" }}
                >
                  Effacer
                </button>
              )}
            </div>

            {analyseErreur && (
              <div
                role="alert"
                className="mt-3 rounded-xl px-3 py-2 text-[12px]"
                style={{ background: "#fee", color: "var(--navy-950)" }}
              >
                {analyseErreur}
              </div>
            )}

            {/* Rendu du résultat IA */}
            {analyse && (
              <div
                className="mt-5 space-y-4 rounded-2xl border border-royal-600/30 p-4"
                style={{ background: "var(--royal-50)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-[16px] font-bold text-navy-950">
                        {analyse.prenom || analyse.entreprise || "Prospect détecté"}
                      </span>
                      {analyse.entreprise && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-royal-800 border">
                          {analyse.entreprise}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[12px] text-hint">
                      {analyse.metier || "Activité"} {analyse.ville ? `· ${analyse.ville}` : ""}
                    </div>
                  </div>
                  <span className="rounded-full bg-royal-800 px-2.5 py-1 text-[11px] font-bold text-white">
                    Score {analyse.score}/5
                  </span>
                </div>

                {/* Téléphone WhatsApp détecté */}
                {analyse.telephone && (
                  <div className="flex items-center justify-between rounded-xl bg-white p-3 border">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <MessageCircle size={15} />
                      </span>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-hint">
                          Numéro WhatsApp détecté
                        </div>
                        <div className="font-mono text-[13px] font-bold text-navy-950">
                          {analyse.telephone}
                        </div>
                      </div>
                    </div>
                    <a
                      href={`https://wa.me/${analyse.telephone.replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-emerald-700 transition"
                    >
                      Tester chat ➔
                    </a>
                  </div>
                )}

                {/* Faille repérée */}
                {analyse.opportunite && (
                  <div className="rounded-xl bg-white p-3 border">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-royal-800">
                      🔴 Faille commerciale repérée
                    </div>
                    <div className="mt-1 text-[13px] italic text-navy-950 leading-relaxed">
                      « {analyse.opportunite} »
                    </div>
                  </div>
                )}

                {/* Accroche recommandée */}
                {analyse.detail && (
                  <div className="rounded-xl bg-white p-3 border">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-royal-800">
                      Détail précis (1re ligne du message)
                    </div>
                    <div className="mt-1 text-[13px] font-medium text-navy-950">
                      « {analyse.detail} »
                    </div>
                  </div>
                )}

                {/* Actions 1-clic */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-2">
                  <button
                    onClick={creerFicheDirecteDepuisAnalyse}
                    className="btn-primary-sc flex w-full items-center justify-center gap-2 py-3 text-[13px]"
                  >
                    <Plus size={16} /> Ajouter direct au Pipeline
                  </button>
                  <button
                    onClick={basculerVersFormulaireAvecPrefill}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-royal-600 bg-white py-3 text-[13px] font-bold text-royal-800 hover:bg-royal-100 transition"
                  >
                    Personnaliser la fiche ➔
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* =================================================================== */}
        {/* ONGLET 3 : FORMULAIRE D'AJOUT RAPIDE (< 20 SECONDES)                */}
        {/* =================================================================== */}
        {onglet === "manuel" && (
          <section id="formulaire-ajout" className="card-sc p-5">
            <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
              Ajouter un prospect
            </h2>
            <p className="text-[12px]" style={{ color: "var(--hint)" }}>
              20 secondes chrono. Toutes les informations utiles sont déjà là.
            </p>
            <FormulaireProspect
              prefill={prefill}
              onCree={(nom) => {
                setPrefill(null);
                setToastAjout(`${nom} ajouté au Pipeline.`);
                setTimeout(() => setToastAjout(null), 3000);
              }}
            />
          </section>
        )}

        {/* Filtre 5 signaux (déroulable) */}
        <section className="card-sc p-5">
          <button
            onClick={() => setFiltreOuvert((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[15px]" style={{ fontWeight: 700 }}>
                Filtre de qualification (5 signaux)
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
                  ["actif", "Actif — publie ou commente sur ses réseaux"],
                  ["nomMarque", "Nom = marque ou entreprise établie"],
                  ["pasDeSite", "Pas de site web optimisé ou lien cassé"],
                  ["montreTravail", "Montre son travail / ses réalisations"],
                  ["solvable", "Solvable (tarifs pro, diaspora ou commerce rentable)"],
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
                    className="h-5 w-5 rounded border-gray-300 text-royal-800 focus:ring-royal-600"
                  />
                </label>
              ))}
              <div
                className="mt-2 rounded-xl px-3 py-2 text-[11px]"
                style={{ background: "var(--royal-100)", color: "var(--navy-950)" }}
              >
                {nbSignauxActifs >= 3
                  ? "✓ Prospect qualifié (règle 3/5 validée — fort potentiel de closing)."
                  : "Coche au moins 3 signaux pour confirmer la solvabilité de ce prospect."}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Toast confirmation ajout */}
      {toastAjout && (
        <div
          role="status"
          className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white shadow-xl animate-fade-in"
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 120px)",
            background: "var(--royal-800)",
          }}
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
  const [entreprise, setEntreprise] = useState("");
  const [telephone, setTelephone] = useState("");
  const [ville, setVille] = useState("Cotonou");
  const [plateforme, setPlateforme] = useState<Plateforme>("whatsapp");
  const [metier, setMetier] = useState("");
  const [detail, setDetail] = useState("");
  const [segment, setSegment] = useState<Segment>("creatif");
  const [montantEstime, setMontantEstime] = useState("250000");
  const [lien, setLien] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.prenom) setPrenom(prefill.prenom);
    if (prefill.entreprise) setEntreprise(prefill.entreprise);
    if (prefill.telephone) setTelephone(prefill.telephone);
    if (prefill.ville) setVille(prefill.ville);
    if (prefill.metier) setMetier(prefill.metier);
    if (prefill.detail) setDetail(prefill.detail);
    if (prefill.segment) setSegment(prefill.segment);
  }, [prefill]);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prenom || !metier || !detail) return;
    setEnCours(true);
    try {
      const telNettoye = nettoyerNumeroTelephone(telephone);
      await creerProspect({
        prenom: prenom.trim(),
        entreprise: entreprise.trim() || undefined,
        telephone: telNettoye || undefined,
        ville: ville.trim() || undefined,
        plateforme,
        metier: metier.trim(),
        detail: detail.trim(),
        segment,
        lien:
          lien.trim() ||
          (telNettoye ? `https://wa.me/${telNettoye.replace(/[^\d]/g, "")}` : undefined),
        montantEstime: Number(montantEstime) || 250000,
        source: "manuel",
      });
      onCree(prenom.trim());
      setPrenom("");
      setEntreprise("");
      setTelephone("");
      setMetier("");
      setDetail("");
      setLien("");
      refPrenom.current?.focus();
    } finally {
      setEnCours(false);
    }
  };

  return (
    <form onSubmit={soumettre} className="mt-4 space-y-3.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Champ label="Prénom / Contact *">
          <input
            ref={refPrenom}
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            placeholder="Ex : Dr Sossou, Marc, Aïcha"
            required
            className="input-sc"
          />
        </Champ>

        <Champ label="Entreprise / Clinique / Marque (optionnel)">
          <input
            value={entreprise}
            onChange={(e) => setEntreprise(e.target.value)}
            placeholder="Ex : Clinique Lumière, Agence Immo Bénin"
            className="input-sc"
          />
        </Champ>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Champ label="Numéro WhatsApp (ex: +229 97 00 00 00)">
          <input
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="+229..."
            className="input-sc font-mono"
          />
        </Champ>

        <Champ label="Ville">
          <input
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            placeholder="Cotonou, Abidjan, Dakar..."
            className="input-sc"
          />
        </Champ>
      </div>

      <Champ label="Plateforme de contact *">
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(LABEL_PLATEFORME) as Plateforme[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlateforme(p)}
              className="rounded-xl border py-2 text-[12px] font-medium transition"
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Champ label="Métier / Niche *">
          <input
            value={metier}
            onChange={(e) => setMetier(e.target.value)}
            required
            placeholder="Dentiste, Promoteur immo, Restaurateur…"
            className="input-sc"
          />
        </Champ>

        <Champ label="Deal potentiel (FCFA)">
          <input
            type="number"
            value={montantEstime}
            onChange={(e) => setMontantEstime(e.target.value)}
            placeholder="250000"
            className="input-sc font-mono"
          />
        </Champ>
      </div>

      <Champ label="Détail précis * (utilisé en 1re ligne du message)">
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          required
          placeholder="ex. : sa clinique dentaire à la Haie Vive, sa villa mise en vente à Calavi"
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
              className="rounded-xl border py-2 text-[12px] font-medium transition"
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

      <Champ label="Lien du profil ou site (optionnel)">
        <input
          value={lien}
          onChange={(e) => setLien(e.target.value)}
          placeholder="https://..."
          className="input-sc"
        />
      </Champ>

      <button type="submit" disabled={enCours} className="btn-primary-sc w-full py-3.5 text-[14px]">
        {enCours ? "Ajout…" : "Ajouter à la Chasse"}
      </button>
    </form>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: "var(--navy-950)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
