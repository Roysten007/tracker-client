import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { creerProspect, mettreAJourConfig, useHydraterSM, useSprintMachine } from "../lib/store2";
import {
  getServiceIA,
  nettoyerNumeroTelephone,
  type ParametresRechercheProspects,
  type ProspectSourceIA,
} from "../services/ia";
import type { AnalyseProfil, Config, ModeIA, Plateforme, Segment } from "../lib/types";
import { LABEL_PLATEFORME, LABEL_SEGMENT } from "../lib/types";

export const Route = createFileRoute("/chasse")({
  head: () => ({
    meta: [
      { title: "Chasseur de Prospects IA — Sprint Machine" },
      {
        name: "description",
        content:
          "Sourcing automatique de prospects B2B par mots-clés, ville et niche avec contacts WhatsApp et emails.",
      },
    ],
  }),
  component: ChassePage,
});

// -------- VILLES AFRICAINES ET SUGGESTIONS DE MOTS-CLÉS ----------------------

type VillePreset = {
  id: string;
  nom: string;
  pays: string;
  drapeau: string;
  indicatif: string;
};

const VILLES_PRESETS: VillePreset[] = [
  { id: "cotonou", nom: "Cotonou", pays: "Bénin", drapeau: "🇧🇯", indicatif: "+229" },
  { id: "abidjan", nom: "Abidjan", pays: "Côte d'Ivoire", drapeau: "🇨🇮", indicatif: "+225" },
  { id: "dakar", nom: "Dakar", pays: "Sénégal", drapeau: "🇸🇳", indicatif: "+221" },
  { id: "douala", nom: "Douala", pays: "Cameroun", drapeau: "🇨🇲", indicatif: "+237" },
  { id: "lome", nom: "Lomé", pays: "Togo", drapeau: "🇹🇬", indicatif: "+228" },
  { id: "ouaga", nom: "Ouagadougou", pays: "Burkina Faso", drapeau: "🇧🇫", indicatif: "+226" },
  {
    id: "diaspora",
    nom: "Paris / Diaspora",
    pays: "Europe/Monde",
    drapeau: "🌍",
    indicatif: "+33",
  },
];

const SUGGESTIONS_MOTS_CLES = [
  "Clinique dentaire & Soins",
  "Agence immobilière de luxe",
  "Restaurant gastro & Lounge",
  "Prêt-à-porter & Marque de mode",
  "Cabinet d'avocats & Notaires",
  "École privée & Académie",
  "Entreprise BTP & Architecture",
  "Salon d'esthétique & Cosmétique",
];

const OFFRES_FREELANCE = [
  "Site vitrine haute conversion & commande WhatsApp directe",
  "Landing page de vente monoproduit",
  "Refonte de site vieillissant et accélération mobile",
  "Catalogue digital & menu interactif WhatsApp",
];

// -------- Composant page -----------------------------------------------------

function ChassePage() {
  useHydraterSM();
  const s = useSprintMachine();

  const [onglet, setOnglet] = useState<"chasseur-ia" | "radar" | "extracteur" | "manuel">(
    "chasseur-ia",
  );

  // --- Paramètres du Chasseur IA ---
  const [motsCles, setMotsCles] = useState("Clinique dentaire & Soins");
  const [villeSelectionnee, setVilleSelectionnee] = useState("Cotonou");
  const [nombreProspects, setNombreProspects] = useState(5);
  const [offreChoisie, setOffreChoisie] = useState(OFFRES_FREELANCE[0]);
  const [sourcingEnCours, setSourcingEnCours] = useState(false);
  const [prospectsSourcess, setProspectsSourcess] = useState<ProspectSourceIA[]>([]);
  const [selectionnes, setSelectionnes] = useState<Set<number>>(new Set());
  const [importEnCours, setImportEnCours] = useState(false);

  // --- Architecture Dual-Engine : Système 1 (Recherche Google) + Système 2 (Audit IA) ---
  const [modalConfigOuvert, setModalConfigOuvert] = useState(false);
  const [cleGoogleTemp, setCleGoogleTemp] = useState(s.config.geminiKey || "");
  const [rechercheWebTemp, setRechercheWebTemp] = useState(s.config.rechercheWebActivee ?? true);
  const [moteurAuditTemp, setMoteurAuditTemp] = useState<ModeIA>(
    s.config.moteurAudit || s.config.modeIA || "gemini",
  );
  const [cleAuditTemp, setCleAuditTemp] = useState("");
  const [afficherCleGoogle, setAfficherCleGoogle] = useState(false);
  const [afficherCleAudit, setAfficherCleAudit] = useState(false);

  const ouvrirModalConfig = () => {
    setCleGoogleTemp(s.config.geminiKey || "");
    setRechercheWebTemp(s.config.rechercheWebActivee ?? true);
    const auditM = s.config.moteurAudit || s.config.modeIA || "gemini";
    setMoteurAuditTemp(auditM);
    const key =
      auditM === "gemini"
        ? s.config.geminiKey || ""
        : auditM === "groq"
          ? s.config.groqKey || ""
          : auditM === "mistral"
            ? s.config.mistralKey || ""
            : auditM === "nvidia"
              ? s.config.nvidiaKey || ""
              : auditM === "openrouter"
                ? s.config.openrouterKey || ""
                : "";
    setCleAuditTemp(key);
    setModalConfigOuvert(true);
  };

  const changerMoteurAuditTemp = (mode: ModeIA) => {
    setMoteurAuditTemp(mode);
    const key =
      mode === "gemini"
        ? cleGoogleTemp || s.config.geminiKey || ""
        : mode === "groq"
          ? s.config.groqKey || ""
          : mode === "mistral"
            ? s.config.mistralKey || ""
            : mode === "nvidia"
              ? s.config.nvidiaKey || ""
              : mode === "openrouter"
                ? s.config.openrouterKey || ""
                : "";
    setCleAuditTemp(key);
  };

  const enregistrerConfigIA = async () => {
    const patch: Partial<Config> = {
      geminiKey: cleGoogleTemp.trim(),
      rechercheWebActivee: rechercheWebTemp,
      moteurAudit: moteurAuditTemp,
      modeIA: moteurAuditTemp,
    };
    if (moteurAuditTemp === "gemini") {
      patch.geminiKey = cleAuditTemp.trim() || cleGoogleTemp.trim();
    } else if (moteurAuditTemp === "groq") {
      patch.groqKey = cleAuditTemp.trim();
    } else if (moteurAuditTemp === "mistral") {
      patch.mistralKey = cleAuditTemp.trim();
    } else if (moteurAuditTemp === "nvidia") {
      patch.nvidiaKey = cleAuditTemp.trim();
    } else if (moteurAuditTemp === "openrouter") {
      patch.openrouterKey = cleAuditTemp.trim();
    }

    await mettreAJourConfig(patch);
    setModalConfigOuvert(false);
    setToastMessage("Architecture Dual-Engine (Recherche Google + Audit) configurée !");
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- États pour l'Extracteur de texte/bio ---
  const [prefill, setPrefill] = useState<Partial<AnalyseProfil> | null>(null);
  const [analyse, setAnalyse] = useState<AnalyseProfil | null>(null);
  const [texteBrut, setTexteBrut] = useState("");
  const [urlSource, setUrlSource] = useState("");
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [analyseErreur, setAnalyseErreur] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const lancerChasseurIA = async () => {
    if (!motsCles.trim()) return;
    setSourcingEnCours(true);
    setProspectsSourcess([]);
    try {
      const service = getServiceIA(s.config);
      const params: ParametresRechercheProspects = {
        nicheOuMotsCles: motsCles.trim(),
        ville: villeSelectionnee,
        nombre: nombreProspects,
        offreService: offreChoisie,
      };
      const resultats = await service.sourcerProspectsIA(params);
      setProspectsSourcess(resultats);
      // Sélectionner tous par défaut
      setSelectionnes(new Set(resultats.map((_, i) => i)));
      if (s.config.geminiKey?.trim()) {
        setToastMessage(
          `✓ ${resultats.length} prospects extraits en direct via Google Maps Grounding !`,
        );
      } else {
        setToastMessage(
          `✓ ${resultats.length} établissements réels vérifiés chargés depuis l'annuaire terrain.`,
        );
      }
      setTimeout(() => setToastMessage(null), 4000);
    } catch (e) {
      setToastMessage(
        e instanceof Error
          ? e.message
          : "Erreur lors du sourcing. Vérifiez votre clé API ou votre connexion.",
      );
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setSourcingEnCours(false);
    }
  };

  const basculerSelection = (index: number) => {
    setSelectionnes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toutSelectionner = () => {
    if (selectionnes.size === prospectsSourcess.length) {
      setSelectionnes(new Set());
    } else {
      setSelectionnes(new Set(prospectsSourcess.map((_, i) => i)));
    }
  };

  const importerUnProspect = async (p: ProspectSourceIA) => {
    const cleanTel = nettoyerNumeroTelephone(p.telephone);
    await creerProspect({
      prenom: p.prenom,
      entreprise: p.entreprise,
      telephone: cleanTel || undefined,
      email: p.email || undefined,
      siteWeb: p.audit?.siteWeb || undefined,
      statutSite: p.audit?.statutSite,
      ville: p.ville,
      metier: p.metier,
      detail: p.detail,
      opportunite: p.audit?.ceQuiManque || p.opportunite,
      ceQuiManque: p.audit?.ceQuiManque,
      impactCommercial: p.audit?.impactCommercial,
      solutionRecommandee: p.audit?.solutionRecommandee,
      segment: p.segment,
      plateforme: cleanTel ? "whatsapp" : "linkedin",
      source: "manuel",
      montantEstime: p.montantEstime,
      lien: cleanTel ? `https://wa.me/${cleanTel.replace(/[^\d]/g, "")}` : undefined,
      notes: `[Diagnostic Commercial]\n- Faille : ${p.audit?.ceQuiManque || ""}\n- Perte : ${p.audit?.impactCommercial || ""}\n- Solution : ${p.audit?.solutionRecommandee || ""}`,
    });
    setToastMessage(`✓ ${p.prenom} (${p.entreprise}) importé dans le Pipeline !`);
    setTimeout(() => setToastMessage(null), 3000);
    setProspectsSourcess((prev) => prev.filter((item) => item !== p));
  };

  const importerSelection = async () => {
    const aImporter = prospectsSourcess.filter((_, i) => selectionnes.has(i));
    if (aImporter.length === 0) return;
    setImportEnCours(true);
    try {
      for (const p of aImporter) {
        const cleanTel = nettoyerNumeroTelephone(p.telephone);
        await creerProspect({
          prenom: p.prenom,
          entreprise: p.entreprise,
          telephone: cleanTel || undefined,
          email: p.email || undefined,
          siteWeb: p.audit?.siteWeb || undefined,
          statutSite: p.audit?.statutSite,
          ville: p.ville,
          metier: p.metier,
          detail: p.detail,
          opportunite: p.audit?.ceQuiManque || p.opportunite,
          ceQuiManque: p.audit?.ceQuiManque,
          impactCommercial: p.audit?.impactCommercial,
          solutionRecommandee: p.audit?.solutionRecommandee,
          segment: p.segment,
          plateforme: cleanTel ? "whatsapp" : "linkedin",
          source: "manuel",
          montantEstime: p.montantEstime,
          lien: cleanTel ? `https://wa.me/${cleanTel.replace(/[^\d]/g, "")}` : undefined,
          notes: `[Diagnostic Commercial]\n- Faille : ${p.audit?.ceQuiManque || ""}\n- Perte : ${p.audit?.impactCommercial || ""}\n- Solution : ${p.audit?.solutionRecommandee || ""}`,
        });
      }
      setToastMessage(`✓ ${aImporter.length} prospect(s) importé(s) dans le Pipeline !`);
      setTimeout(() => setToastMessage(null), 3500);
      // Retirer les importés
      setProspectsSourcess((prev) => prev.filter((_, i) => !selectionnes.has(i)));
      setSelectionnes(new Set());
    } finally {
      setImportEnCours(false);
    }
  };

  const analyserTexte = async () => {
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
    const cleanTel = nettoyerNumeroTelephone(analyse.telephone || "");
    await creerProspect({
      prenom,
      entreprise: analyse.entreprise || prenom,
      telephone: cleanTel || undefined,
      ville: analyse.ville || villeSelectionnee,
      niche: analyse.niche || motsCles,
      opportunite: analyse.opportunite || analyse.detail,
      auditFlash: analyse.auditFlash || undefined,
      metier: analyse.metier || motsCles,
      detail: analyse.detail || `Activité repérée dans ${motsCles}`,
      segment: analyse.segment || "creatif",
      plateforme: cleanTel ? "whatsapp" : "linkedin",
      source: "manuel",
      montantEstime: 250000,
      lien: cleanTel ? `https://wa.me/${cleanTel.replace(/[^\d]/g, "")}` : undefined,
    });
    setToastMessage(`${prenom} ajouté directement au Pipeline !`);
    setTimeout(() => setToastMessage(null), 3000);
    setTexteBrut("");
    setAnalyse(null);
  };

  // Liens pour le radar classique
  const liensRadar = useMemo(() => {
    const qGmaps = encodeURIComponent(`${motsCles} ${villeSelectionnee}`);
    const qInsta = encodeURIComponent(`${motsCles.split(" ")[0].toLowerCase()}`);
    const qLinkedin = encodeURIComponent(
      `site:linkedin.com/in ("Directeur" OR "Gérant" OR "Fondateur" OR "CEO") ("${motsCles}") ("${villeSelectionnee}")`,
    );
    return {
      google: `https://www.google.com/search?q=${qGmaps}`,
      instagram: `https://www.instagram.com/explore/tags/${qInsta}/`,
      linkedin: `https://www.google.com/search?q=${qLinkedin}`,
      facebook: `https://www.facebook.com/search/pages/?q=${encodeURIComponent(`${motsCles} ${villeSelectionnee}`)}`,
    };
  }, [motsCles, villeSelectionnee]);

  return (
    <div className="pb-12 md:mx-auto md:max-w-4xl">
      {/* Header prestige */}
      <header
        className="px-5 pb-6 pt-8 text-white md:px-8 md:pt-10 md:pb-8 md:rounded-2xl shadow-xl"
        style={{
          background: "var(--navy-950)",
          paddingTop: "calc(env(safe-area-inset-top) + 24px)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-2"
              style={{ color: "var(--royal-100)" }}
            >
              <i className="fa-solid fa-radar text-xs" /> Sourcing B2B & Chasseur IA
            </div>
            <h1 className="mt-1 font-display text-white" style={{ fontWeight: 800, fontSize: 28 }}>
              Machine de Chasse aux Prospects
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: "var(--royal-100)" }}>
              Trouve des dizaines de prospects qualifiés avec WhatsApp, emails et failles à closer.
            </p>
          </div>
        </div>

        {/* Navigation par onglets avec icônes Font Awesome */}
        <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-xl bg-white/10 p-1 sm:grid-cols-4 backdrop-blur-md">
          <button
            onClick={() => setOnglet("chasseur-ia")}
            className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] font-bold transition shadow-sm"
            style={{
              background: onglet === "chasseur-ia" ? "#fff" : "transparent",
              color: onglet === "chasseur-ia" ? "var(--navy-950)" : "#fff",
            }}
          >
            <i className="fa-solid fa-robot" /> Chasseur IA
          </button>
          <button
            onClick={() => setOnglet("radar")}
            className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] font-bold transition shadow-sm"
            style={{
              background: onglet === "radar" ? "#fff" : "transparent",
              color: onglet === "radar" ? "var(--navy-950)" : "#fff",
            }}
          >
            <i className="fa-solid fa-location-crosshairs" /> Radar Manuel
          </button>
          <button
            onClick={() => setOnglet("extracteur")}
            className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] font-bold transition shadow-sm"
            style={{
              background: onglet === "extracteur" ? "#fff" : "transparent",
              color: onglet === "extracteur" ? "var(--navy-950)" : "#fff",
            }}
          >
            <i className="fa-solid fa-wand-magic-sparkles" /> Extracteur Bio
          </button>
          <button
            onClick={() => setOnglet("manuel")}
            className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] font-bold transition shadow-sm"
            style={{
              background: onglet === "manuel" ? "#fff" : "transparent",
              color: onglet === "manuel" ? "var(--navy-950)" : "#fff",
            }}
          >
            <i className="fa-solid fa-user-plus" /> Ajout Rapide
          </button>
        </div>
      </header>

      <div className="p-4 space-y-5 md:mt-6">
        {/* =================================================================== */}
        {/* ONGLET 1 : CHASSEUR IA (GÉNÉRATEUR AUTOMATIQUE ILLIMITÉ)             */}
        {/* =================================================================== */}
        {onglet === "chasseur-ia" && (
          <div className="space-y-5">
            {/* Barre de statut du Double Système IA */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3.5 shadow-sm border border-[#E7E8F4]">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-royal-100 text-royal-800">
                  <i className="fa-solid fa-network-wired text-[17px]" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-hint">
                      Architecture Dual-Engine
                    </span>
                    {/* Système 1 Badge */}
                    {s.config.geminiKey ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                        <i className="fa-brands fa-google text-[10px] text-emerald-600" />
                        Système 1 : Google Maps Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                        <i className="fa-solid fa-circle-exclamation text-[10px] text-amber-600" />
                        Système 1 : Clé Google requise
                      </span>
                    )}

                    {/* Système 2 Badge */}
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-800 border border-purple-200">
                      <i className="fa-solid fa-stethoscope text-[10px] text-purple-600" />
                      Système 2 :{" "}
                      {(s.config.moteurAudit || s.config.modeIA) === "groq"
                        ? "Groq Llama 3.3"
                        : (s.config.moteurAudit || s.config.modeIA) === "mistral"
                          ? "Mistral AI"
                          : (s.config.moteurAudit || s.config.modeIA) === "nvidia"
                            ? "Nvidia NIM"
                            : (s.config.moteurAudit || s.config.modeIA) === "openrouter"
                              ? "OpenRouter"
                              : (s.config.moteurAudit || s.config.modeIA) === "gemini"
                                ? "Google Gemini"
                                : "Gabarits"}
                    </span>
                  </div>
                  <p className="text-[12px] text-hint mt-0.5">
                    {s.config.geminiKey
                      ? "Recherche Google Maps en direct couplée à l'analyse diagnostique des failles commerciales."
                      : "Configure ta clé gratuite Google Gemini pour activer la recherche de commerces réels avec leurs contacts."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={ouvrirModalConfig}
                className="flex items-center gap-1.5 rounded-xl border border-royal-600/30 bg-royal-50 px-3.5 py-2 text-[12px] font-bold text-royal-800 transition hover:bg-royal-100"
              >
                <i className="fa-solid fa-sliders" />
                <span>Configurer les 2 Moteurs IA</span>
              </button>
            </div>

            {/* Formulaire de configuration de la recherche */}
            <section className="card-sc p-5 border border-royal-600/20 shadow-sm">
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-royal-100 text-royal-800">
                    <i className="fa-solid fa-bolt" />
                  </span>
                  <div>
                    <h2 className="font-display text-[16px] font-bold text-navy-950">
                      Chasseur de Prospects IA par Mots-Clés
                    </h2>
                    <p className="text-[12px] text-hint">
                      L'IA recherche et qualifie des prospects avec leurs contacts WhatsApp et
                      emails réels.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* 1. Mots-clés / Niche */}
                <div>
                  <label className="block text-[12px] font-bold text-navy-950 mb-1.5">
                    <i className="fa-solid fa-magnifying-glass text-royal-800 mr-1.5" />
                    Mots-clés / Niche ciblée
                  </label>
                  <input
                    value={motsCles}
                    onChange={(e) => setMotsCles(e.target.value)}
                    placeholder="Ex: Cliniques dentaires, Agences immobilières, Restaurants..."
                    className="input-sc font-medium"
                  />
                  {/* Suggestions de niches rapides */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {SUGGESTIONS_MOTS_CLES.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setMotsCles(sug)}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition border"
                        style={{
                          background: motsCles === sug ? "var(--royal-100)" : "#fff",
                          borderColor: motsCles === sug ? "var(--royal-800)" : "#E7E8F4",
                          color: motsCles === sug ? "var(--royal-800)" : "var(--hint)",
                        }}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Territoire / Ville & Quantité */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[12px] font-bold text-navy-950 mb-1.5">
                      <i className="fa-solid fa-location-dot text-royal-800 mr-1.5" />
                      Ville / Territoire cible
                    </label>
                    <select
                      value={villeSelectionnee}
                      onChange={(e) => setVilleSelectionnee(e.target.value)}
                      className="input-sc bg-white font-medium"
                    >
                      {VILLES_PRESETS.map((v) => (
                        <option key={v.id} value={v.nom}>
                          {v.drapeau} {v.nom} ({v.pays} - {v.indicatif})
                        </option>
                      ))}
                      <option value="Autre ville">🌍 Autre ville personnalisée...</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-navy-950 mb-1.5">
                      <i className="fa-solid fa-list-ol text-royal-800 mr-1.5" />
                      Nombre de prospects à sourcer
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[3, 5, 10, 15].map((nb) => (
                        <button
                          key={nb}
                          type="button"
                          onClick={() => setNombreProspects(nb)}
                          className="rounded-xl border py-2.5 text-[12px] font-bold transition"
                          style={{
                            borderColor: nombreProspects === nb ? "var(--royal-800)" : "#E7E8F4",
                            background: nombreProspects === nb ? "var(--royal-100)" : "#fff",
                            color: nombreProspects === nb ? "var(--royal-800)" : "var(--navy-950)",
                          }}
                        >
                          {nb}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Offre à vendre */}
                <div>
                  <label className="block text-[12px] font-bold text-navy-950 mb-1.5">
                    <i className="fa-solid fa-bullseye text-royal-800 mr-1.5" />
                    Offre à proposer
                  </label>
                  <select
                    value={offreChoisie}
                    onChange={(e) => setOffreChoisie(e.target.value)}
                    className="input-sc bg-white text-[13px] font-medium"
                  >
                    {OFFRES_FREELANCE.map((off) => (
                      <option key={off} value={off}>
                        {off}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bouton de lancement & lien direct Google Maps */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <button
                    onClick={lancerChasseurIA}
                    disabled={sourcingEnCours || !motsCles.trim()}
                    className="btn-primary-sc flex flex-1 items-center justify-center gap-2 py-3.5 text-[14px] shadow-md w-full"
                  >
                    <i
                      className={`fa-solid ${sourcingEnCours ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}`}
                    />
                    {sourcingEnCours
                      ? `Recherche en cours pour ${nombreProspects} prospects à ${villeSelectionnee}...`
                      : `Trouver ${nombreProspects} prospects réels qualifiés ➔`}
                  </button>

                  <a
                    href={`https://www.google.com/maps/search/${encodeURIComponent(motsCles + " " + villeSelectionnee)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-royal-600/30 bg-white hover:bg-royal-50 px-4 py-3.5 text-[13px] font-bold text-royal-800 transition shadow-xs w-full sm:w-auto"
                    title="Ouvrir la recherche sur Google Maps"
                  >
                    <i className="fa-solid fa-map-location-dot text-rose-600" />
                    <span>Explorer sur Google Maps</span>
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                  </a>
                </div>
              </div>
            </section>

            {/* Indicateur de chargement / recherche en direct */}
            {sourcingEnCours && (
              <section className="card-sc p-8 text-center border-2 border-dashed border-royal-600/30 bg-royal-50/50 animate-pulse">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-royal-100 text-royal-800 text-2xl animate-spin mb-4">
                  <i className="fa-solid fa-spinner" />
                </div>
                <h3 className="font-display font-bold text-navy-950 text-[17px]">
                  Recherche & Qualification IA en cours...
                </h3>
                <p className="text-[13px] text-hint mt-1.5 max-w-md mx-auto">
                  {s.config.modeIA === "gemini" && (s.config.rechercheWebActivee ?? true)
                    ? `Google Search Grounding explore en direct le web pour trouver des établissements réels à ${villeSelectionnee} sur « ${motsCles} » avec leurs contacts publics vérifiés.`
                    : `L'IA analyse le marché de ${villeSelectionnee} sur « ${motsCles} » et prépare des fiches personnalisées pour votre offre.`}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2 text-[12px] font-semibold text-royal-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>
                    Extraction des coordonnées WhatsApp, emails et opportunités commerciales
                  </span>
                </div>
              </section>
            )}

            {/* RÉSULTATS DU SOURCING IA */}
            {prospectsSourcess.length > 0 && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div>
                    <h3 className="font-display text-[17px] font-bold text-navy-950">
                      {prospectsSourcess.length} prospects trouvés pour « {motsCles} » à{" "}
                      {villeSelectionnee}
                    </h3>
                    <p className="text-[12px] text-hint">
                      Sélectionne les prospects que tu souhaites importer ou contacte-les
                      directement.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toutSelectionner}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-navy-950 hover:bg-gray-50"
                    >
                      {selectionnes.size === prospectsSourcess.length
                        ? "Tout désélectionner"
                        : "Tout sélectionner"}
                    </button>
                    <button
                      onClick={importerSelection}
                      disabled={importEnCours || selectionnes.size === 0}
                      className="btn-primary-sc flex items-center gap-1.5 px-4 py-1.5 text-[12px]"
                    >
                      <i className="fa-solid fa-cloud-arrow-down" />
                      Importer ({selectionnes.size})
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {prospectsSourcess.map((p, idx) => {
                    const estCoche = selectionnes.has(idx);
                    const cleanTel = p.telephone.replace(/[^\d]/g, "");

                    return (
                      <div
                        key={idx}
                        className="card-sc p-4.5 transition hover:shadow-md border"
                        style={{
                          borderColor: estCoche ? "var(--royal-800)" : "#E7E8F4",
                          background: estCoche ? "var(--royal-50)" : "#fff",
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={estCoche}
                            onChange={() => basculerSelection(idx)}
                            className="mt-1 h-5 w-5 rounded border-gray-300 text-royal-800 focus:ring-royal-600"
                          />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-display text-[15px] font-bold text-navy-950">
                                    {p.prenom}
                                  </span>
                                  <span className="text-[14px] font-bold text-royal-800">
                                    · {p.entreprise}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-800 border border-emerald-300">
                                    <i className="fa-solid fa-circle-check text-emerald-600 text-[10px]" />
                                    {s.config.geminiKey
                                      ? "Google Maps Live"
                                      : "Établissement Réel Vérifié"}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[12px] text-hint mt-1">
                                  <span>
                                    <i className="fa-solid fa-location-dot text-xs mr-1 text-royal-800" />
                                    {p.ville} · {p.metier}
                                  </span>

                                  {/* Liens de vérification directe Google Maps & Google */}
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.entreprise + " " + p.ville)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-royal-800 bg-royal-50 hover:bg-royal-100 border border-royal-200 px-2 py-0.5 rounded-md transition"
                                    title="Ouvrir la fiche de l'établissement sur Google Maps"
                                  >
                                    <i className="fa-solid fa-map-location-dot text-rose-600 text-[10px]" />
                                    Fiche Maps{" "}
                                    <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />
                                  </a>
                                  <a
                                    href={`https://www.google.com/search?q=${encodeURIComponent(p.entreprise + " " + p.ville)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2 py-0.5 rounded-md transition"
                                    title="Rechercher cet établissement sur Google"
                                  >
                                    <i className="fa-brands fa-google text-[10px]" />
                                    Google{" "}
                                    <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />
                                  </a>
                                </div>
                              </div>
                              <span className="font-mono text-[12px] font-bold text-navy-950 bg-white border rounded-full px-2.5 py-0.5 shadow-2xs">
                                {p.montantEstime.toLocaleString("fr-FR")} FCFA
                              </span>
                            </div>

                            {/* Contacts Téléphone, Email & Site Web */}
                            <div className="flex flex-wrap items-center gap-2 text-[12px]">
                              {/* Badge Statut Digital */}
                              {p.audit?.statutSite === "aucun" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                                  <i className="fa-solid fa-triangle-exclamation text-[10px] text-rose-600" />
                                  AUCUN SITE WEB
                                </span>
                              )}
                              {p.audit?.statutSite === "obsolete" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                                  <i className="fa-solid fa-mobile-screen text-[10px] text-amber-600" />
                                  SITE OBSOLÈTE / NON RESPONSIVE
                                </span>
                              )}
                              {p.audit?.statutSite === "sans_whatsapp" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 border border-blue-200">
                                  <i className="fa-brands fa-whatsapp text-[10px] text-blue-600" />
                                  PAS DE TUNNEL WHATSAPP
                                </span>
                              )}
                              {p.audit?.statutSite === "lent_mobile" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-800 border border-purple-200">
                                  <i className="fa-solid fa-gauge-simple-high text-[10px] text-purple-600" />
                                  CHARGEMENT LENT (&gt;7s)
                                </span>
                              )}
                              {p.audit?.statutSite === "inaccessible" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-0.5 text-[11px] font-bold text-gray-800 border border-gray-200">
                                  <i className="fa-solid fa-link-slash text-[10px] text-gray-600" />
                                  SITE INACCESSIBLE
                                </span>
                              )}

                              {p.telephone && (
                                <a
                                  href={`tel:${cleanTel}`}
                                  className="flex items-center gap-1.5 font-mono text-emerald-800 bg-emerald-100/70 hover:bg-emerald-200/80 px-2.5 py-0.5 rounded-full font-semibold transition"
                                  title="Appeler directement"
                                >
                                  <i className="fa-brands fa-whatsapp text-emerald-600" />
                                  {p.telephone}
                                </a>
                              )}
                              {p.email && (
                                <span className="flex items-center gap-1.5 text-navy-950 bg-white border px-2.5 py-0.5 rounded-full">
                                  <i className="fa-solid fa-envelope text-gray-500" />
                                  {p.email}
                                </span>
                              )}
                              {p.audit?.siteWeb ? (
                                <a
                                  href={p.audit.siteWeb}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-royal-800 underline bg-royal-50 border border-royal-200 px-2 py-0.5 rounded-full text-[11px] font-medium"
                                >
                                  <i className="fa-solid fa-globe text-xs" />
                                  Site actuel
                                  <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />
                                </a>
                              ) : (
                                <span className="text-[11px] text-hint italic">
                                  (Aucun site officiel identifié)
                                </span>
                              )}
                            </div>

                            {/* BLOC DIAGNOSTIC COMMERCIAL : CE QUI MANQUE VRAIMENT */}
                            <div className="rounded-xl bg-white p-3.5 border border-[#EDEEF7] space-y-2">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                                <i className="fa-solid fa-microscope text-royal-800" />
                                Diagnostic & Faille Commerciale (Ce qui manque) :
                              </div>

                              <div className="text-[12px] text-navy-950 leading-relaxed">
                                <span className="font-bold text-rose-700">❌ Ce qui manque : </span>
                                {p.audit?.ceQuiManque || p.opportunite}
                              </div>

                              {p.audit?.impactCommercial && (
                                <div className="text-[12px] text-navy-950 leading-relaxed">
                                  <span className="font-bold text-amber-800">
                                    📉 Perte estimée :{" "}
                                  </span>
                                  {p.audit.impactCommercial}
                                </div>
                              )}

                              {p.audit?.solutionRecommandee && (
                                <div className="text-[12px] text-navy-950 leading-relaxed">
                                  <span className="font-bold text-emerald-700">
                                    💡 Offre à vendre :{" "}
                                  </span>
                                  {p.audit.solutionRecommandee}
                                </div>
                              )}

                              {p.audit?.signauxCritiques && p.audit.signauxCritiques.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {p.audit.signauxCritiques.map((sig, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="rounded-md bg-royal-50 border border-royal-200/60 px-2 py-0.5 text-[10px] font-bold text-royal-800"
                                    >
                                      <i className="fa-solid fa-circle-check text-royal-600 mr-1" />
                                      {sig}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Message WhatsApp prêt à envoyer */}
                            <div className="rounded-xl bg-white p-3 border border-[#EDEEF7]">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-royal-800 flex items-center gap-1.5">
                                <i className="fa-brands fa-whatsapp text-emerald-600" /> Message
                                WhatsApp d'attaque (personnalisé sur la faille) :
                              </div>
                              <div className="mt-1 text-[12px] italic text-navy-950 leading-relaxed whitespace-pre-wrap">
                                « {p.messageWhatsApp} »
                              </div>
                            </div>

                            {/* Actions rapides sur chaque prospect */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100">
                              <button
                                type="button"
                                onClick={() => importerUnProspect(p)}
                                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-navy-950 hover:bg-gray-50 transition"
                              >
                                <i className="fa-solid fa-cloud-arrow-down text-royal-800" />
                                Importer seul au Pipeline
                              </button>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(p.messageWhatsApp);
                                    setToastMessage("Message copié dans le presse-papier !");
                                    setTimeout(() => setToastMessage(null), 2500);
                                  }}
                                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-hint hover:text-navy-950 hover:bg-gray-50 transition"
                                >
                                  <i className="fa-solid fa-copy" />
                                  Copier
                                </button>

                                {p.telephone && (
                                  <a
                                    href={`https://wa.me/${cleanTel}?text=${encodeURIComponent(p.messageWhatsApp)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-[12px] font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                                  >
                                    <i className="fa-brands fa-whatsapp" /> Envoyer sur WhatsApp
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* ONGLET 2 : RADAR DE RECHERCHE CLASSIQUE AVEC MOTS-CLÉS               */}
        {/* =================================================================== */}
        {onglet === "radar" && (
          <div className="space-y-5">
            <section className="card-sc p-5 border border-royal-600/20">
              <h2 className="font-display text-[16px] font-bold text-navy-950">
                <i className="fa-solid fa-location-crosshairs text-royal-800 mr-2" />
                Radar X-Ray par Mots-Clés & Villes
              </h2>
              <p className="text-[12px] text-hint mt-1">
                Génère instantanément des requêtes chirurgicales pour ouvrir Google Maps, Instagram,
                LinkedIn et Facebook.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[12px] font-bold text-navy-950 mb-1">
                    Mots-clés / Niche
                  </label>
                  <input
                    value={motsCles}
                    onChange={(e) => setMotsCles(e.target.value)}
                    className="input-sc font-medium"
                    placeholder="Ex: Agence immobilière"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-navy-950 mb-1">Ville</label>
                  <select
                    value={villeSelectionnee}
                    onChange={(e) => setVilleSelectionnee(e.target.value)}
                    className="input-sc bg-white font-medium"
                  >
                    {VILLES_PRESETS.map((v) => (
                      <option key={v.id} value={v.nom}>
                        {v.drapeau} {v.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4 Canaux de recherche instantanée */}
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <a
                  href={liensRadar.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3.5 hover:shadow-md transition"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-royal-800 text-white">
                    <i className="fa-solid fa-map-location-dot text-lg" />
                  </span>
                  <div>
                    <div className="font-bold text-[13px] text-navy-950 flex items-center gap-1.5">
                      Google Maps & Fiches Locales
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs text-hint" />
                    </div>
                    <div className="text-[11px] text-hint mt-0.5">
                      Fiches professionnelles à {villeSelectionnee} avec WhatsApp et sans site.
                    </div>
                  </div>
                </a>

                <a
                  href={liensRadar.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3.5 hover:shadow-md transition"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 text-white">
                    <i className="fa-brands fa-instagram text-lg" />
                  </span>
                  <div>
                    <div className="font-bold text-[13px] text-navy-950 flex items-center gap-1.5">
                      Instagram Business
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs text-hint" />
                    </div>
                    <div className="text-[11px] text-hint mt-0.5">
                      Comptes d'entreprises avec contact WhatsApp dans la bio.
                    </div>
                  </div>
                </a>

                <a
                  href={liensRadar.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3.5 hover:shadow-md transition"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0077b5] text-white">
                    <i className="fa-brands fa-linkedin-in text-lg" />
                  </span>
                  <div>
                    <div className="font-bold text-[13px] text-navy-950 flex items-center gap-1.5">
                      LinkedIn : Décideurs
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs text-hint" />
                    </div>
                    <div className="text-[11px] text-hint mt-0.5">
                      Fondateurs, Directeurs et Gérants à {villeSelectionnee}.
                    </div>
                  </div>
                </a>

                <a
                  href={liensRadar.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3.5 hover:shadow-md transition"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1877f2] text-white">
                    <i className="fa-brands fa-facebook-f text-lg" />
                  </span>
                  <div>
                    <div className="font-bold text-[13px] text-navy-950 flex items-center gap-1.5">
                      Facebook : Pages Locales
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs text-hint" />
                    </div>
                    <div className="text-[11px] text-hint mt-0.5">
                      Pages professionnelles avec numéros de téléphone actifs.
                    </div>
                  </div>
                </a>
              </div>
            </section>
          </div>
        )}

        {/* =================================================================== */}
        {/* ONGLET 3 : EXTRACTEUR DE TEXTE / BIO                                */}
        {/* =================================================================== */}
        {onglet === "extracteur" && (
          <section className="card-sc p-5 border border-royal-600/20">
            <h2 className="font-display text-[16px] font-bold text-navy-950 flex items-center gap-2">
              <i className="fa-solid fa-wand-magic-sparkles text-royal-800" />
              Extracteur Express de Bio & Annonce
            </h2>
            <p className="text-[12px] text-hint mt-1">
              Colle n'importe quel texte brut (bio Instagram, post Facebook, fiche Google ou
              annonce). L'IA détecte le nom, l'entreprise, le numéro WhatsApp et la faille à closer.
            </p>

            <textarea
              value={texteBrut}
              onChange={(e) => setTexteBrut(e.target.value)}
              rows={5}
              placeholder="Colle ici le texte ou la bio du prospect..."
              className="mt-3 w-full resize-none rounded-xl border border-[#E7E8F4] bg-white p-3 text-[13px] leading-relaxed"
            />

            <div className="mt-3 flex gap-2">
              <button
                onClick={analyserTexte}
                disabled={!texteBrut.trim() || analyseEnCours}
                className="btn-primary-sc flex flex-1 items-center justify-center gap-2 py-3"
              >
                <i
                  className={`fa-solid ${analyseEnCours ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}`}
                />
                {analyseEnCours ? "Analyse en cours..." : "Extraire et Analyser"}
              </button>
              {texteBrut && (
                <button
                  onClick={() => {
                    setTexteBrut("");
                    setAnalyse(null);
                  }}
                  className="rounded-xl border border-[#E7E8F4] bg-white px-4 py-3 text-[12px] font-medium text-hint"
                >
                  Effacer
                </button>
              )}
            </div>

            {analyseErreur && (
              <div
                role="alert"
                className="mt-3 rounded-xl px-3 py-2 text-[12px] bg-rose-50 text-rose-900 border border-rose-200"
              >
                {analyseErreur}
              </div>
            )}

            {/* Rendu résultat analyse */}
            {analyse && (
              <div className="mt-5 space-y-4 rounded-2xl border border-royal-600/30 p-4 bg-royal-50">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-display text-[16px] font-bold text-navy-950">
                      {analyse.prenom || analyse.entreprise || "Prospect détecté"}
                    </span>
                    {analyse.entreprise && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-royal-800 border ml-2">
                        {analyse.entreprise}
                      </span>
                    )}
                  </div>
                  <span className="rounded-full bg-royal-800 px-2.5 py-1 text-[11px] font-bold text-white">
                    Score {analyse.score}/5
                  </span>
                </div>

                {analyse.telephone && (
                  <div className="flex items-center justify-between rounded-xl bg-white p-3 border">
                    <span className="font-mono text-[13px] font-bold text-emerald-800 flex items-center gap-2">
                      <i className="fa-brands fa-whatsapp text-emerald-600 text-base" />
                      {analyse.telephone}
                    </span>
                    <a
                      href={`https://wa.me/${analyse.telephone.replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-bold text-white"
                    >
                      Ouvrir chat WhatsApp ➔
                    </a>
                  </div>
                )}

                {analyse.opportunite && (
                  <div className="rounded-xl bg-white p-3 border">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                      <i className="fa-solid fa-circle-exclamation mr-1" /> Faille repérée :
                    </div>
                    <div className="mt-1 text-[13px] text-navy-950">{analyse.opportunite}</div>
                  </div>
                )}

                <button
                  onClick={creerFicheDirecteDepuisAnalyse}
                  className="btn-primary-sc flex w-full items-center justify-center gap-2 py-3 text-[13px]"
                >
                  <i className="fa-solid fa-plus" /> Ajouter direct au Pipeline
                </button>
              </div>
            )}
          </section>
        )}

        {/* =================================================================== */}
        {/* ONGLET 4 : FORMULAIRE MANUEL RAPIDE                                 */}
        {/* =================================================================== */}
        {onglet === "manuel" && (
          <section id="formulaire-ajout" className="card-sc p-5 border border-royal-600/20">
            <h2 className="font-display text-[16px] font-bold text-navy-950 flex items-center gap-2">
              <i className="fa-solid fa-user-plus text-royal-800" />
              Ajouter un prospect manuellement
            </h2>
            <p className="text-[12px] text-hint mt-1">20 secondes chrono.</p>
            <FormulaireProspect
              prefill={prefill}
              onCree={(nom) => {
                setPrefill(null);
                setToastMessage(`${nom} ajouté au Pipeline.`);
                setTimeout(() => setToastMessage(null), 3000);
              }}
            />
          </section>
        )}
      </div>

      {/* Toast confirmation */}
      {toastMessage && (
        <div
          role="status"
          className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white shadow-xl animate-fade-in"
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 120px)",
            background: "var(--royal-800)",
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* MODAL CONFIGURATION : ARCHITECTURE DOUBLE MOTEUR IA */}
      {modalConfigOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-fade-in">
          <div className="card-sc max-h-[92vh] w-full max-w-xl overflow-y-auto p-6 shadow-2xl border border-royal-600/30">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-royal-100 text-royal-800 shadow-sm">
                  <i className="fa-solid fa-network-wired text-[18px]" />
                </span>
                <div>
                  <h3 className="font-display text-[17px] font-bold text-navy-950">
                    Architecture IA : Deux Systèmes Spécialisés
                  </h3>
                  <p className="text-[12px] text-hint">
                    Système 1 (Recherche Terrain Google) + Système 2 (Audit des Failles
                    Commerciales)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalConfigOuvert(false)}
                className="rounded-lg p-2 text-hint hover:bg-gray-100 text-[14px]"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="space-y-5">
              {/* SYSTÈME 1 : RECHERCHE GOOGLE MAPS & TERRAIN */}
              <div className="rounded-2xl border border-royal-200/80 bg-royal-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-royal-800 text-white text-[11px] font-bold">
                      1
                    </span>
                    <span className="text-[13px] font-bold text-navy-950 flex items-center gap-1.5">
                      <i className="fa-brands fa-google text-royal-800" />
                      Système 1 : Recherche Maps & Web Google
                    </span>
                  </div>
                  <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                    100% Gratuit
                  </span>
                </div>

                <p className="text-[11px] text-hint leading-relaxed">
                  <strong>Rôle exclusif :</strong> Scruter Google Maps, Search, annuaires locaux et
                  réseaux sociaux pour extraire les <strong>établissements réels</strong>, leurs
                  numéros WhatsApp pro, emails publics et sites existants.
                </p>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[12px] font-bold text-navy-950">
                      Clé API Google Gemini (Search Grounding)
                    </label>
                    <button
                      type="button"
                      onClick={() => setAfficherCleGoogle((v) => !v)}
                      className="text-[11px] font-semibold text-royal-800 hover:underline"
                    >
                      {afficherCleGoogle ? "Masquer" : "Afficher"}
                    </button>
                  </div>
                  <input
                    type={afficherCleGoogle ? "text" : "password"}
                    value={cleGoogleTemp}
                    onChange={(e) => setCleGoogleTemp(e.target.value)}
                    placeholder="AIzaSy... (Obligatoire pour la recherche réelle)"
                    className="input-sc font-mono text-[13px] bg-white"
                  />
                  <p className="mt-1.5 text-[11px] text-hint">
                    💡 <strong>Sans carte bancaire :</strong> Génère ta clé gratuite en 30 secondes
                    sur{" "}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold underline text-royal-800 hover:text-royal-600"
                    >
                      aistudio.google.com/apikey
                    </a>
                  </p>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer rounded-xl bg-white p-2.5 border border-royal-200">
                  <input
                    type="checkbox"
                    checked={rechercheWebTemp}
                    onChange={(e) => setRechercheWebTemp(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-royal-800"
                  />
                  <div className="text-[11px]">
                    <span className="font-bold text-navy-950">
                      Recherche Web Google en direct (Live Grounding)
                    </span>
                    <p className="text-hint text-[10px] leading-tight mt-0.5">
                      Obligatoire pour trouver de véritables commerces dans les quartiers ciblés
                      avec WhatsApp & emails vérifiés.
                    </p>
                  </div>
                </label>
              </div>

              {/* SYSTÈME 2 : MOTEUR D'AUDIT COMMERCIAL & DIAGNOSTIC */}
              <div className="rounded-2xl border border-purple-200/80 bg-purple-50/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-700 text-white text-[11px] font-bold">
                      2
                    </span>
                    <span className="text-[13px] font-bold text-navy-950 flex items-center gap-1.5">
                      <i className="fa-solid fa-stethoscope text-purple-700" />
                      Système 2 : Audit & Détection des Failles
                    </span>
                  </div>
                  <span className="rounded-full bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 text-[10px] font-bold">
                    IA Analytique
                  </span>
                </div>

                <p className="text-[11px] text-hint leading-relaxed">
                  <strong>Rôle exclusif :</strong> Diagnostiquer impitoyablement{" "}
                  <em>ce qui manque vraiment</em> (absence de site vitrine, lenteur mobile &gt; 7s,
                  inaccessibilité, absence de tunnel WhatsApp) pour chiffrer la perte de chiffre
                  d'affaires et préparer l'argumentaire.
                </p>

                <div>
                  <label className="block text-[12px] font-bold text-navy-950 mb-2">
                    Choisis le cerveau pour l'Audit Commercial :
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      {
                        id: "gemini",
                        nom: "Google Gemini",
                        badge: "Gratuit (Même clé)",
                        icon: "fa-google",
                      },
                      {
                        id: "mistral",
                        nom: "Mistral AI",
                        badge: "Français & Précis",
                        icon: "fa-wind",
                      },
                      {
                        id: "groq",
                        nom: "Groq Llama 3.3",
                        badge: "Gratuit & <1s",
                        icon: "fa-bolt",
                      },
                      {
                        id: "nvidia",
                        nom: "Nvidia NIM",
                        badge: "1000 crédits",
                        icon: "fa-microchip",
                      },
                      {
                        id: "openrouter",
                        nom: "OpenRouter",
                        badge: "Multi-modèles",
                        icon: "fa-network-wired",
                      },
                      {
                        id: "gabarits",
                        nom: "Gabarits Locaux",
                        badge: "Sans clé (Offline)",
                        icon: "fa-laptop-code",
                      },
                    ].map((m) => {
                      const actif = moteurAuditTemp === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => changerMoteurAuditTemp(m.id as ModeIA)}
                          className="rounded-xl border p-2.5 text-left transition hover:border-royal-600"
                          style={{
                            borderColor: actif ? "var(--royal-800)" : "#E7E8F4",
                            background: actif ? "var(--royal-100)" : "#fff",
                            color: actif ? "var(--royal-800)" : "var(--navy-950)",
                          }}
                        >
                          <div className="flex items-center gap-1.5 text-[12px] font-bold">
                            <i className={`fa-solid ${m.icon} text-[11px]`} />
                            <span>{m.nom}</span>
                          </div>
                          <div className="text-[10px] mt-0.5 text-hint font-medium">{m.badge}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Champ clé API pour le moteur d'audit si différent de gabarits */}
                {moteurAuditTemp !== "gabarits" && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[12px] font-bold text-navy-950">
                        Clé API {moteurAuditTemp.toUpperCase()}{" "}
                        {moteurAuditTemp === "gemini" && (
                          <span className="text-[11px] font-normal text-hint">
                            (Utilise automatiquement la clé Google du Système 1)
                          </span>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => setAfficherCleAudit((v) => !v)}
                        className="text-[11px] font-semibold text-royal-800 hover:underline"
                      >
                        {afficherCleAudit ? "Masquer" : "Afficher"}
                      </button>
                    </div>
                    <input
                      type={afficherCleAudit ? "text" : "password"}
                      value={cleAuditTemp}
                      onChange={(e) => setCleAuditTemp(e.target.value)}
                      placeholder={
                        moteurAuditTemp === "gemini"
                          ? "Optionnel si renseignée dans Système 1..."
                          : moteurAuditTemp === "groq"
                            ? "gsk_..."
                            : moteurAuditTemp === "mistral"
                              ? "Clé Mistral..."
                              : "Colle ta clé API ici..."
                      }
                      className="input-sc font-mono text-[13px] bg-white"
                    />

                    <div className="mt-1.5 text-[11px] text-hint">
                      {moteurAuditTemp === "mistral" && (
                        <p>
                          🇫🇷 Obtiens ta clé sur{" "}
                          <a
                            href="https://console.mistral.ai/api-keys/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold underline text-royal-800"
                          >
                            console.mistral.ai
                          </a>
                        </p>
                      )}
                      {moteurAuditTemp === "groq" && (
                        <p>
                          ⚡ Clé gratuite ultra-rapide sur{" "}
                          <a
                            href="https://console.groq.com/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold underline text-royal-800"
                          >
                            console.groq.com/keys
                          </a>
                        </p>
                      )}
                      {moteurAuditTemp === "nvidia" && (
                        <p>
                          🚀 1000 crédits offerts sur{" "}
                          <a
                            href="https://build.nvidia.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold underline text-royal-800"
                          >
                            build.nvidia.com
                          </a>
                        </p>
                      )}
                      {moteurAuditTemp === "openrouter" && (
                        <p>
                          🌐 Clé universelle sur{" "}
                          <a
                            href="https://openrouter.ai/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold underline text-royal-800"
                          >
                            openrouter.ai/keys
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bouton Enregistrer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setModalConfigOuvert(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-[12px] font-bold text-navy-950 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={enregistrerConfigIA}
                  className="btn-primary-sc px-5 py-2 text-[12px] flex items-center gap-2"
                >
                  <i className="fa-solid fa-check" />
                  Enregistrer les 2 systèmes
                </button>
              </div>
            </div>
          </div>
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
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-navy-950">
            Prénom / Contact *
          </span>
          <input
            ref={refPrenom}
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            placeholder="Ex : Dr Sossou, Marc, Aïcha"
            required
            className="input-sc"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-navy-950">
            Entreprise / Établissement
          </span>
          <input
            value={entreprise}
            onChange={(e) => setEntreprise(e.target.value)}
            placeholder="Ex : Clinique Dentaire Espoir"
            className="input-sc"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-navy-950">
            Numéro WhatsApp (avec indicatif)
          </span>
          <input
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="+229..."
            className="input-sc font-mono"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-navy-950">Ville</span>
          <input
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            placeholder="Cotonou, Abidjan..."
            className="input-sc"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold text-navy-950">
          Plateforme de contact *
        </span>
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
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-navy-950">
            Métier / Niche *
          </span>
          <input
            value={metier}
            onChange={(e) => setMetier(e.target.value)}
            required
            placeholder="Dentiste, Promoteur immo..."
            className="input-sc"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-navy-950">
            Deal estimé (FCFA)
          </span>
          <input
            type="number"
            value={montantEstime}
            onChange={(e) => setMontantEstime(e.target.value)}
            placeholder="250000"
            className="input-sc font-mono"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold text-navy-950">
          Détail précis * (1re ligne du message)
        </span>
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          required
          placeholder="ex. : sa clinique dentaire à la Haie Vive"
          className="input-sc"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold text-navy-950">Segment *</span>
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
      </label>

      <button type="submit" disabled={enCours} className="btn-primary-sc w-full py-3.5 text-[14px]">
        {enCours ? "Ajout…" : "Ajouter au Pipeline"}
      </button>
    </form>
  );
}
