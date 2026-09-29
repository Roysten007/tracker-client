import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import {
  creerProspect,
  enregistrerEnvoi,
  getSkill,
  mettreAJourConfig,
  mettreAJourSkill,
  reinitialiserSkill,
  tousSkills,
  useHydraterSM,
  useSprintMachine,
} from "../lib/store2";
import {
  getServiceIA,
  nettoyerNumeroTelephone,
  type ParametresRechercheProspects,
  type ProspectSourceIA,
} from "../services/ia";
import type {
  AnalyseProfil,
  Config,
  ModeIA,
  Plateforme,
  Segment,
  SkillDoc,
  TypeMessage,
} from "../lib/types";
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

import {
  PAYS_CIBLES,
  getNomQuartier,
  construireUrlGoogleMaps,
  construireUrlGoogleMapsFiltree,
} from "../lib/territoires";
import {
  COMPETENCES_FREELANCE,
  type CompetenceId,
  type CompetenceConfig,
} from "../lib/competences";
import {
  analyserRechercheTexte,
} from "../lib/analyse-recherche";
import {
  auditerSiteGooglePageSpeed,
  genererPitchWhatsAppPageSpeed,
  type ResultatPageSpeed,
} from "../services/pagespeed";

const ZONES_CHAUDES_BUSINESS = [
  { label: "Haie Vive (Cotonou)", paysId: "benin", depId: "littoral", quartier: "Cotonou - Haie Vive", drapeau: "🇧🇯" },
  { label: "Godomey (Calavi)", paysId: "benin", depId: "atlantique", quartier: "Abomey-Calavi - Godomey", drapeau: "🇧🇯" },
  { label: "Ouando (Porto-Novo)", paysId: "benin", depId: "oueme", quartier: "Porto-Novo - Centre & Ouando", drapeau: "🇧🇯" },
  { label: "Parakou Centre", paysId: "benin", depId: "borgou", quartier: "Parakou - Centre Commercial & Zongo", drapeau: "🇧🇯" },
  { label: "Cocody Angré (Abidjan)", paysId: "cote_ivoire", depId: "abidjan", quartier: "Abidjan - Cocody (Angré / Riviera / Deux Plateaux)", drapeau: "🇨🇮" },
  { label: "Zone 4 (Marcory)", paysId: "cote_ivoire", depId: "abidjan", quartier: "Abidjan - Marcory (Zone 4 / Biétry)", drapeau: "🇨🇮" },
  { label: "Almadies (Dakar)", paysId: "senegal", depId: "dakar", quartier: "Dakar - Almadies & Ngor", drapeau: "🇸🇳" },
  { label: "Nyékonakpoè (Lomé)", paysId: "togo", depId: "maritime", quartier: "Lomé - Nyékonakpoè & Kodjoviakopé", drapeau: "🇹🇬" },
  { label: "Bonapriso (Douala)", paysId: "cameroun", depId: "littoral_cam", quartier: "Douala - Bonapriso", drapeau: "🇨🇲" },
  { label: "Bastos (Yaoundé)", paysId: "cameroun", depId: "centre_cam", quartier: "Yaoundé - Bastos", drapeau: "🇨🇲" },
  { label: "Paris 8e (Diaspora)", paysId: "france", depId: "ile_de_france", quartier: "Paris - 8e / 16e / 17e (Affaires & Étoile)", drapeau: "🇫🇷" },
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

  // --- Paramètres du Chasseur IA & Territoires (Maps au complet) ---
  const [motsCles, setMotsCles] = useState("Clinique dentaire & Soins");
  const [nombreProspects, setNombreProspects] = useState(5);
  const [offreChoisie, setOffreChoisie] = useState(OFFRES_FREELANCE[0]);
  const [sourcingEnCours, setSourcingEnCours] = useState(false);
  const [prospectsSourcess, setProspectsSourcess] = useState<ProspectSourceIA[]>([]);
  const [selectionnes, setSelectionnes] = useState<Set<number>>(new Set());
  const [importEnCours, setImportEnCours] = useState(false);

  // --- Compétence freelance active (Collection skills - Étape 1) ---
  const [competenceId, setCompetenceId] = useState<string>("developpement_web");
  const listeSkills = useMemo(() => tousSkills(s), [s.skills]);
  const skillActif = useMemo(() => getSkill(competenceId, s), [competenceId, s.skills]);
  const [modalSkillOuvert, setModalSkillOuvert] = useState(false);
  const [skillEnEdition, setSkillEnEdition] = useState<SkillDoc | null>(null);
  const [ongletModalSkill, setOngletModalSkill] = useState<"cibles" | "signaux" | "playbook">("cibles");

  const ouvrirEditionSkill = (skill: SkillDoc) => {
    setSkillEnEdition(JSON.parse(JSON.stringify(skill)));
    setOngletModalSkill("cibles");
    setModalSkillOuvert(true);
  };

  const sauvegarderSkillEnEdition = async () => {
    if (!skillEnEdition) return;
    await mettreAJourSkill(skillEnEdition);
    setModalSkillOuvert(false);
    setToastMessage(`✓ Profil "${skillEnEdition.name}" enregistré et synchronisé !`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const reinitialiserSkillActuel = async () => {
    if (!skillEnEdition) return;
    await reinitialiserSkill(skillEnEdition.id);
    const reinit = getSkill(skillEnEdition.id);
    setSkillEnEdition(JSON.parse(JSON.stringify(reinit)));
    setToastMessage(`✓ Profil "${reinit.name}" réinitialisé aux valeurs par défaut.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // --- Recherche universelle intuitive ("restaurant Ouidah", "clinique Cotonou", etc.) ---
  const [rechercheUniverselle, setRechercheUniverselle] = useState("");
  const [panneauTerritoireOuvert, setPanneauTerritoireOuvert] = useState(false);

  // --- PageSpeed Insights Live Tests & Cache local ---
  const [pagespeedEnCours, setPagespeedEnCours] = useState<Record<string, boolean>>({});
  const [resultatsPageSpeed, setResultatsPageSpeed] = useState<Record<string, ResultatPageSpeed>>({});

  // Sélecteur territorial multi-niveaux (Pays -> Département -> Quartier / Maps)
  const [paysId, setPaysId] = useState("benin");
  const [departementId, setDepartementId] = useState("littoral");
  const [quartierSelectionne, setQuartierSelectionne] = useState("Cotonou - Haie Vive");
  const [localisationCustom, setLocalisationCustom] = useState("");
  const [modeSaisieLibre, setModeSaisieLibre] = useState(false);

  const paysActuel = useMemo(
    () => PAYS_CIBLES.find((p) => p.id === paysId) || PAYS_CIBLES[0],
    [paysId],
  );

  const departementActuel = useMemo(
    () =>
      paysActuel.departements.find((d) => d.id === departementId) ||
      paysActuel.departements[0],
    [paysActuel, departementId],
  );

  // Localisation précise calculée pour l'IA, Google Maps et le CRM
  const villeSelectionnee = useMemo(() => {
    if (modeSaisieLibre && localisationCustom.trim()) {
      return `${localisationCustom.trim()} (${departementActuel.nom}, ${paysActuel.nom})`;
    }
    return `${quartierSelectionne} (${departementActuel.nom}, ${paysActuel.nom})`;
  }, [modeSaisieLibre, localisationCustom, quartierSelectionne, departementActuel, paysActuel]);

  // Analyse en direct de la barre de recherche universelle ("restaurant Ouidah", etc.)
  const analyseActuelle = useMemo(
    () => analyserRechercheTexte(rechercheUniverselle, paysId, departementId),
    [rechercheUniverselle, paysId, departementId],
  );

  const villeEffective = useMemo(() => {
    if (rechercheUniverselle.trim()) {
      return analyseActuelle.localisationComplete;
    }
    return villeSelectionnee;
  }, [rechercheUniverselle, analyseActuelle, villeSelectionnee]);

  const motsClesEffectifs = useMemo(() => {
    if (rechercheUniverselle.trim()) {
      return analyseActuelle.nicheMotsCles;
    }
    return motsCles;
  }, [rechercheUniverselle, analyseActuelle, motsCles]);

  const changerPays = (nouveauPaysId: string) => {
    setPaysId(nouveauPaysId);
    const p = PAYS_CIBLES.find((item) => item.id === nouveauPaysId) || PAYS_CIBLES[0];
    const dep = p.departements[0];
    setDepartementId(dep.id);
    setQuartierSelectionne(getNomQuartier(dep.villesEtQuartiers[0]));
    setLocalisationCustom("");
  };

  const changerDepartement = (nouveauDepId: string) => {
    setDepartementId(nouveauDepId);
    const dep =
      paysActuel.departements.find((d) => d.id === nouveauDepId) ||
      paysActuel.departements[0];
    setQuartierSelectionne(getNomQuartier(dep.villesEtQuartiers[0]));
    setLocalisationCustom("");
  };

  const selectionnerZoneRapide = (pId: string, depId: string, qNom: string) => {
    setPaysId(pId);
    setDepartementId(depId);
    setQuartierSelectionne(qNom);
    setModeSaisieLibre(false);
    setLocalisationCustom("");
  };

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
    const queryNiche = motsClesEffectifs.trim();
    const queryVille = villeEffective.trim();
    if (!queryNiche) return;
    setSourcingEnCours(true);
    setProspectsSourcess([]);
    try {
      const service = getServiceIA(s.config);
      const params: ParametresRechercheProspects = {
        nicheOuMotsCles: queryNiche,
        ville: queryVille,
        nombre: nombreProspects,
        offreService: offreChoisie,
        competenceFreelance: competenceId,
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

  const lancerAuditPageSpeedProspect = async (siteUrl: string, entreprise: string) => {
    if (!siteUrl || pagespeedEnCours[siteUrl]) return;
    setPagespeedEnCours((prev) => ({ ...prev, [siteUrl]: true }));
    try {
      const resultat = await auditerSiteGooglePageSpeed(siteUrl);
      setResultatsPageSpeed((prev) => ({ ...prev, [siteUrl]: resultat }));
      setToastMessage(`✓ Test Google PageSpeed terminé pour ${entreprise} (Score mobile : ${resultat.scorePerformance}/100)`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch {
      setToastMessage(`Impossible de tester la vitesse de ${siteUrl}.`);
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setPagespeedEnCours((prev) => ({ ...prev, [siteUrl]: false }));
    }
  };

  const copierPitchPageSpeed = (audit: ResultatPageSpeed, nom: string) => {
    const texte = genererPitchWhatsAppPageSpeed(audit, nom);
    navigator.clipboard.writeText(texte);
    setToastMessage(`✓ Pitch PageSpeed copié pour ${nom} !`);
    setTimeout(() => setToastMessage(null), 3000);
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
    const telDigits = cleanTel.replace(/[^\d]/g, "");
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
      lien: telDigits ? `https://wa.me/${telDigits}` : undefined,
      notes: `[Diagnostic Commercial]\n- Faille : ${p.audit?.ceQuiManque || ""}\n- Perte : ${p.audit?.impactCommercial || ""}\n- Solution : ${p.audit?.solutionRecommandee || ""}`,
    });
    setToastMessage(`✓ ${p.entreprise} ajouté à votre File du jour sur l'écran Aujourd'hui !`);
    setTimeout(() => setToastMessage(null), 3000);
    setProspectsSourcess((prev) => prev.filter((item) => item !== p));
  };

  const envoyerEtSuivreProspect = async (p: ProspectSourceIA) => {
    const cleanTel = nettoyerNumeroTelephone(p.telephone);
    const telDigits = cleanTel.replace(/[^\d]/g, "");

    // 1. Créer le prospect dans la base
    const prospectCree = await creerProspect({
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
      plateforme: "whatsapp",
      source: "manuel",
      montantEstime: p.montantEstime,
      lien: telDigits ? `https://wa.me/${telDigits}` : undefined,
      notes: `[Diagnostic Commercial]\n- Faille : ${p.audit?.ceQuiManque || ""}\n- Perte : ${p.audit?.impactCommercial || ""}\n- Solution : ${p.audit?.solutionRecommandee || ""}`,
    });

    // 2. Déterminer le type de premier message (M3 si diaspora, sinon M1)
    const typeMsg: TypeMessage = p.segment === "diaspora" ? "M3" : "M1";

    // 3. Enregistrer l'envoi : passe à statut 'envoye', relance M4 à J+2, sent + 1
    await enregistrerEnvoi(prospectCree.id, typeMsg, p.messageWhatsApp);

    // 4. Ouvrir la discussion WhatsApp avec le message d'attaque personnalisé
    if (telDigits) {
      window.open(
        `https://wa.me/${telDigits}?text=${encodeURIComponent(p.messageWhatsApp)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }

    // 5. Toast de confirmation et retrait de la liste de chasse
    setToastMessage(
      `✓ ${p.entreprise} contacté ! Statut passé à "Envoyé", relance M4 planifiée à J+2. Compteur du jour mis à jour.`,
    );
    setTimeout(() => setToastMessage(null), 4000);
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
      setToastMessage(
        `✓ ${aImporter.length} prospect(s) ajouté(s) à votre File du jour sur l'écran Aujourd'hui !`,
      );
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

  // Liens pour le radar classique & Google Maps complet
  const liensRadar = useMemo(() => {
    const qNiche = motsClesEffectifs;
    const qVille = villeEffective;
    const qInsta = encodeURIComponent(`${qNiche.split(" ")[0].toLowerCase()}`);
    const qLinkedin = encodeURIComponent(
      `site:linkedin.com/in ("Directeur" OR "Gérant" OR "Fondateur" OR "CEO") ("${qNiche}") ("${qVille}")`,
    );
    return {
      google: construireUrlGoogleMaps(qNiche, qVille),
      googleMapsTopNotes: construireUrlGoogleMapsFiltree(qNiche, qVille, "top_notes"),
      googleMapsPlusAvis: construireUrlGoogleMapsFiltree(qNiche, qVille, "plus_avis"),
      googleMapsOuverts: construireUrlGoogleMapsFiltree(qNiche, qVille, "ouverts"),
      googleMapsRecents: construireUrlGoogleMapsFiltree(qNiche, qVille, "recents"),
      instagram: `https://www.instagram.com/explore/tags/${qInsta}/`,
      linkedin: `https://www.google.com/search?q=${qLinkedin}`,
      facebook: `https://www.facebook.com/search/pages/?q=${encodeURIComponent(`${qNiche} ${qVille}`)}`,
    };
  }, [motsClesEffectifs, villeEffective]);

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
            <i className="fa-solid fa-map-location-dot" /> Extracteur Maps & Bio
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
                {/* 0. SÉLECTEUR DE COMPÉTENCE FREELANCE (COLLECTION SKILLS - ÉTAPE 1) */}
                <div className="rounded-2xl border border-royal-200/80 bg-white p-3.5 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <label className="text-[12px] font-bold text-navy-950 flex items-center gap-1.5">
                        <i className="fa-solid fa-briefcase text-royal-800" />
                        <span>Ta Compétence Freelance</span>
                      </label>
                      <span className="text-[10px] font-bold bg-royal-100 text-royal-800 px-2 py-0.5 rounded-full">
                        {skillActif.name}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => ouvrirEditionSkill(skillActif)}
                      className="flex items-center gap-1.5 rounded-xl border border-royal-300 bg-royal-50 px-2.5 py-1 text-[11px] font-bold text-royal-800 transition hover:bg-royal-100 shadow-2xs"
                    >
                      <i className="fa-solid fa-pen-to-square text-[11px]" />
                      <span>Modifier ce profil</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                    {listeSkills.map((comp) => {
                      const actif = competenceId === comp.id;
                      const nomCourt = comp.nom_court || comp.name;
                      return (
                        <button
                          key={comp.id}
                          type="button"
                          onClick={() => {
                            setCompetenceId(comp.id);
                            const premierMotCle = Array.isArray(comp.search_keywords)
                              ? comp.search_keywords[0]
                              : Object.values(comp.search_keywords)[0]?.[0] || comp.target_niches[0];
                            if (premierMotCle) setMotsCles(premierMotCle);
                            setOffreChoisie(comp.offer_angle);
                          }}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition shadow-2xs ${
                            actif
                              ? "bg-royal-800 text-white border-royal-800 shadow-xs ring-2 ring-royal-400/40"
                              : "bg-white text-navy-950 border-gray-200 hover:border-royal-400 hover:bg-royal-50/40"
                          }`}
                        >
                          <span className="text-xl mb-0.5">{comp.emoji || "💼"}</span>
                          <span className="text-[12px] font-bold leading-tight">{nomCourt}</span>
                          <span
                            className="text-[10px] mt-0.5 line-clamp-1"
                            style={{ color: actif ? "var(--royal-100)" : "var(--hint)" }}
                          >
                            {comp.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Résumé de l'angle d'offre et signaux qualifiants du profil actif */}
                  <div className="mt-3 rounded-xl bg-gray-50/90 p-3 border border-gray-200/70 text-[11px] space-y-1.5">
                    <div className="flex items-start gap-2 text-navy-950">
                      <i className="fa-solid fa-bullseye text-royal-800 mt-0.5 text-[12px]" />
                      <span>
                        <strong className="text-navy-950">Angle d'offre :</strong>{" "}
                        <span className="text-gray-700">{skillActif.offer_angle}</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-gray-200/60">
                      <span className="font-bold text-hint text-[10px] uppercase tracking-wider">
                        Signaux qualifiants :
                      </span>
                      {skillActif.signals.slice(0, 3).map((sig, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-white border border-gray-200 px-1.5 py-0.5 text-[10px] text-navy-950 font-medium shadow-2xs"
                        >
                          ✓ {sig}
                        </span>
                      ))}
                      {skillActif.signals.length > 3 && (
                        <span className="text-[10px] text-hint font-medium">
                          +{skillActif.signals.length - 3} signaux
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 1. BARRE DE RECHERCHE UNIVERSELLE & INTUITIVE ("restaurant Ouidah", etc.) */}
                <div className="rounded-2xl border-2 border-royal-600/30 bg-gradient-to-br from-royal-50/70 via-white to-royal-50/30 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[13px] font-bold text-navy-950 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-royal-800 text-white text-[11px]">
                        <i className="fa-solid fa-magnifying-glass" />
                      </span>
                      <span>Recherche par mot-clé et ville (Universel)</span>
                    </label>
                    <span className="text-[11px] font-bold text-royal-800 bg-white px-2.5 py-0.5 rounded-full border border-royal-200 shadow-2xs">
                      ⚡ Détection automatique
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={rechercheUniverselle}
                      onChange={(e) => setRechercheUniverselle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") lancerChasseurIA();
                      }}
                      placeholder="Tape directement ex: restaurant Ouidah, clinique Cotonou, avocat Abidjan, sans site web..."
                      className="input-sc font-bold text-[14px] pl-10 pr-20 py-3 bg-white shadow-xs text-navy-950 border-royal-300 focus:border-royal-800"
                    />
                    <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-royal-800 text-sm" />
                    {rechercheUniverselle && (
                      <button
                        type="button"
                        onClick={() => setRechercheUniverselle("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md"
                      >
                        Effacer
                      </button>
                    )}
                  </div>

                  {/* Analyse en direct de ce qui a été compris */}
                  {rechercheUniverselle.trim() && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11.5px] font-medium bg-white/95 p-2.5 rounded-xl border border-royal-200/80 shadow-2xs">
                      <span className="font-bold text-royal-800 flex items-center gap-1">
                        <i className="fa-solid fa-wand-magic-sparkles text-[10px]" /> Analyse :
                      </span>
                      <span className="rounded-md bg-royal-50 px-2 py-0.5 font-bold text-royal-900 border border-royal-200">
                        🎯 Niche : {analyseActuelle.nicheMotsCles}
                      </span>
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-900 border border-emerald-200">
                        📍 {analyseActuelle.localisationComplete}
                      </span>
                      {analyseActuelle.filtreOpportunite && (
                        <span className="rounded-md bg-purple-50 px-2 py-0.5 font-bold text-purple-900 border border-purple-200">
                          ⚡ {analyseActuelle.filtreOpportunite === "aucun_site" ? "Sans site web" : "PageSpeed"}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Exemples rapides cliquables demandés par l'utilisateur */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-hint mr-1">Raccourcis :</span>
                    {[
                      "restaurant Ouidah",
                      "restaurant Cotonou",
                      "clinique Abidjan",
                      "avocat Dakar",
                      "restaurant sans site web",
                      "hôtel Lomé",
                    ].map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => {
                          setRechercheUniverselle(ex);
                        }}
                        className="rounded-lg bg-white hover:bg-royal-50 px-2.5 py-1 text-[11px] font-medium text-royal-800 border border-royal-200/70 transition shadow-2xs"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Suggestions de niches recommandées pour la compétence active */}
                {!rechercheUniverselle.trim() && (
                  <div>
                    <label className="block text-[12px] font-bold text-navy-950 mb-1.5">
                      <i className="fa-solid fa-tag text-royal-800 mr-1.5" />
                      Niche / Métier ciblé (pour {skillActif.nom_court || skillActif.name})
                    </label>
                    <input
                      value={motsCles}
                      onChange={(e) => setMotsCles(e.target.value)}
                      placeholder="Ex: Cliniques, Restaurants, Agences immobilières..."
                      className="input-sc font-medium"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {skillActif.target_niches.map((sug: string) => (
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
                )}

                {/* 2. SÉLECTION TERRITORIALE & MAPS AU COMPLET */}
                <div className="space-y-3 rounded-2xl border border-royal-200/70 bg-royal-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-[13px] font-display font-bold text-navy-950">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-royal-800 text-white text-[11px]">
                        <i className="fa-solid fa-map-location-dot" />
                      </span>
                      <span>Territoire & Périmètre Google Maps</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-royal-800 border border-royal-200 shadow-xs">
                        {paysActuel.drapeau} {paysActuel.indicatif} · {paysActuel.devise}
                      </span>
                      {rechercheUniverselle.trim() && (
                        <button
                          type="button"
                          onClick={() => setPanneauTerritoireOuvert(!panneauTerritoireOuvert)}
                          className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-royal-800 border border-royal-200 shadow-2xs hover:bg-royal-50 transition"
                        >
                          {panneauTerritoireOuvert ? "▲ Masquer sélecteurs" : "⚙️ Sélecteurs détaillés ▼"}
                        </button>
                      )}
                    </div>
                  </div>

                  {(!rechercheUniverselle.trim() || panneauTerritoireOuvert) && (
                    <>

                  {/* Ligne 1 : Pays + Département / Région */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <span className="block text-[11px] font-semibold text-hint mb-1">
                        1. Pays cible ({PAYS_CIBLES.length} pays disponibles)
                      </span>
                      <select
                        value={paysId}
                        onChange={(e) => changerPays(e.target.value)}
                        className="input-sc bg-white font-bold text-[13px] text-navy-950"
                      >
                        {PAYS_CIBLES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.drapeau} {p.nom} ({p.indicatif} · {p.devise})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-hint mb-1">
                        2. {paysActuel.termeDepartement} ({paysActuel.departements.length} disponibles)
                      </span>
                      <select
                        value={departementId}
                        onChange={(e) => changerDepartement(e.target.value)}
                        className="input-sc bg-white font-bold text-[13px] text-navy-950"
                      >
                        {paysActuel.departements.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nom}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Ligne 2 : Quartier / Commune ou Saisie libre */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-hint">
                        3. Quartier / Commune d'affaires ({departementActuel.villesEtQuartiers.length} spots)
                      </span>
                      <button
                        type="button"
                        onClick={() => setModeSaisieLibre(!modeSaisieLibre)}
                        className="text-[11px] font-bold text-royal-800 hover:underline"
                      >
                        {modeSaisieLibre ? "Choisir dans la liste" : "✍️ Saisie libre de quartier"}
                      </button>
                    </div>

                    {modeSaisieLibre ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={localisationCustom}
                          onChange={(e) => setLocalisationCustom(e.target.value)}
                          placeholder={`Ex: Maro-Militaire, Rue 230, Carrefour...`}
                          className="input-sc bg-white font-medium text-[13px] flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => setModeSaisieLibre(false)}
                          className="rounded-xl border border-gray-200 bg-white px-3 text-[12px] font-semibold text-hint hover:bg-gray-50"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <select
                        value={quartierSelectionne}
                        onChange={(e) => setQuartierSelectionne(e.target.value)}
                        className="input-sc bg-white font-medium text-[13px] text-navy-950"
                      >
                        {departementActuel.villesEtQuartiers.map((q, idx) => {
                          const nom = getNomQuartier(q);
                          const desc = typeof q !== "string" && q.description ? ` — ${q.description}` : "";
                          return (
                            <option key={idx} value={nom}>
                              {nom} {desc}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>

                  {/* Puces rapides "Hotspots Business" */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-hint mb-1.5">
                      🔥 Raccourcis d'accès rapide (Zones à fort pouvoir d'achat)
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {ZONES_CHAUDES_BUSINESS.map((z, idx) => {
                        const estActif =
                          paysId === z.paysId &&
                          departementId === z.depId &&
                          quartierSelectionne === z.quartier &&
                          !modeSaisieLibre;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => selectionnerZoneRapide(z.paysId, z.depId, z.quartier)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-1 border ${
                              estActif
                                ? "bg-royal-800 text-white border-royal-800 shadow-xs"
                                : "bg-white text-navy-950 border-gray-200 hover:border-royal-400"
                            }`}
                          >
                            <span>{z.drapeau}</span>
                            <span>{z.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  </>
                  )}

                  {/* Bandeau Google Maps Live Radar */}
                  <div className="rounded-xl bg-white p-3 border border-royal-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-royal-800">
                        <i className="fa-solid fa-crosshairs animate-pulse" />
                        <span>Radar Maps calé sur :</span>
                      </div>
                      <div className="font-display font-bold text-[13px] text-navy-950 truncate mt-0.5">
                        {villeEffective}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <a
                        href={liensRadar.google}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition shadow-xs"
                        title="Ouvrir la zone géographique sur Google Maps"
                      >
                        <i className="fa-solid fa-map-location-dot" />
                        <span>Google Maps</span>
                        <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />
                      </a>
                      <a
                        href={liensRadar.googleMapsTopNotes}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition shadow-xs"
                        title="Voir les fiches les mieux notées (4.5★+)"
                      >
                        <span>⭐ Top notés</span>
                      </a>
                      <a
                        href={liensRadar.googleMapsOuverts}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-xs"
                        title="Voir les établissements ouverts maintenant"
                      >
                        <span>⚡ Ouverts</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* 3. Nombre de prospects & Offre à proposer */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      {[skillActif.offer_angle, ...OFFRES_FREELANCE.filter((o) => o !== skillActif.offer_angle)].map((off: string) => (
                        <option key={off} value={off}>
                          {off}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Bouton de lancement & lien direct Google Maps */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <button
                    onClick={lancerChasseurIA}
                    disabled={sourcingEnCours || !motsClesEffectifs.trim()}
                    className="btn-primary-sc flex flex-1 items-center justify-center gap-2 py-3.5 text-[14px] shadow-md w-full"
                  >
                    <i
                      className={`fa-solid ${sourcingEnCours ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}`}
                    />
                    {sourcingEnCours
                      ? `Recherche en cours pour ${nombreProspects} prospects à ${villeEffective}...`
                      : `Trouver ${nombreProspects} prospects réels qualifiés ➔`}
                  </button>

                  <a
                    href={liensRadar.google}
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
                    ? `Google Search Grounding explore en direct le web pour trouver des établissements réels à ${villeEffective} sur « ${motsClesEffectifs} » avec leurs contacts publics vérifiés.`
                    : `L'IA analyse le marché de ${villeEffective} sur « ${motsClesEffectifs} » et prépare des fiches personnalisées pour votre offre.`}
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
                      {prospectsSourcess.length} prospects trouvés pour « {motsClesEffectifs} » à{" "}
                      {villeEffective}
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
                      className="btn-primary-sc flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold shadow-sm"
                    >
                      <i className="fa-solid fa-calendar-plus" />
                      Ajouter à ma File du jour ({selectionnes.size})
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
                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-0.5 rounded-md transition shadow-2xs"
                                    title="Ouvrir la fiche de l'établissement et les avis sur Google Maps"
                                  >
                                    <i className="fa-solid fa-map-location-dot text-rose-600 text-[11px]" />
                                    <span>Vérifier sur Maps & Avis</span>
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
                                    Google
                                    <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />
                                  </a>
                                </div>
                              </div>
                              <span className="font-mono text-[12px] font-bold text-navy-950 bg-white border rounded-full px-2.5 py-0.5 shadow-2xs">
                                {p.montantEstime.toLocaleString("fr-FR")} FCFA
                              </span>
                            </div>

                            {/* Contacts Téléphone, Email & Statut Site Web */}
                            <div className="flex flex-wrap items-center gap-2 text-[12px]">
                              {/* Badge Statut Digital Honnête */}
                              {p.audit?.statutSite === "aucun" || !p.audit?.siteWeb ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                                    <i className="fa-solid fa-circle-xmark text-[10px] text-rose-600" />
                                    AUCUN SITE WEB DÉTECTÉ
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    <i className="fa-solid fa-bullseye text-[10px] text-emerald-600" />
                                    Cible idéale pour création vitrine 5 jours
                                  </span>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <a
                                    href={p.audit.siteWeb}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-royal-800 underline bg-royal-50 border border-royal-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold hover:bg-royal-100 transition"
                                  >
                                    <i className="fa-solid fa-globe text-xs" />
                                    Visiter le site actuel
                                    <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />
                                  </a>

                                  {/* Bouton de test réel Google PageSpeed Insights */}
                                  <button
                                    type="button"
                                    onClick={() => lancerAuditPageSpeedProspect(p.audit.siteWeb!, p.entreprise)}
                                    disabled={Boolean(pagespeedEnCours[p.audit.siteWeb])}
                                    className="inline-flex items-center gap-1.5 text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition shadow-2xs"
                                    title="Tester la vitesse réelle du site sur mobile via l'API officielle Google PageSpeed"
                                  >
                                    <i
                                      className={`fa-solid ${pagespeedEnCours[p.audit.siteWeb] ? "fa-spinner fa-spin" : "fa-bolt"} text-purple-600 text-[10px]`}
                                    />
                                    <span>
                                      {pagespeedEnCours[p.audit.siteWeb]
                                        ? "Audit Google en cours..."
                                        : "⚡ Tester Google PageSpeed"}
                                    </span>
                                  </button>
                                </div>
                              )}

                              {p.audit?.statutSite === "obsolete" && p.audit?.siteWeb && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                                  <i className="fa-solid fa-mobile-screen text-[10px] text-amber-600" />
                                  SITE OBSOLÈTE / NON RESPONSIVE
                                </span>
                              )}
                              {p.audit?.statutSite === "sans_whatsapp" && p.audit?.siteWeb && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 border border-blue-200">
                                  <i className="fa-brands fa-whatsapp text-[10px] text-blue-600" />
                                  PAS DE TUNNEL WHATSAPP
                                </span>
                              )}
                              {p.audit?.statutSite === "lent_mobile" && p.audit?.siteWeb && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-800 border border-purple-200">
                                  <i className="fa-solid fa-gauge-simple-high text-[10px] text-purple-600" />
                                  CHARGEMENT LENT (&gt;7s)
                                </span>
                              )}

                              {/* Zéro faux numéro : vrai numéro vérifié ou bouton Google Maps */}
                              {p.telephone ? (
                                <a
                                  href={`tel:${cleanTel}`}
                                  className="flex items-center gap-1.5 font-mono text-emerald-800 bg-emerald-100/70 hover:bg-emerald-200/80 px-2.5 py-0.5 rounded-full font-semibold transition"
                                  title="Appeler ou joindre sur WhatsApp"
                                >
                                  <i className="fa-brands fa-whatsapp text-emerald-600" />
                                  {p.telephone}
                                </a>
                              ) : (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.entreprise + " " + p.ville)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full text-[11px] transition shadow-xs"
                                  title="Consulter la fiche Google Maps pour voir le vrai numéro de téléphone"
                                >
                                  <i className="fa-solid fa-map-pin text-amber-600 text-[10px]" />
                                  <span>📍 Vérifier le vrai numéro sur Google Maps</span>
                                  <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />
                                </a>
                              )}
                              {p.email && (
                                <span className="flex items-center gap-1.5 text-navy-950 bg-white border px-2.5 py-0.5 rounded-full">
                                  <i className="fa-solid fa-envelope text-gray-500" />
                                  {p.email}
                                </span>
                              )}
                            </div>

                            {/* BLOC AUDIT GOOGLE PAGESPEED INSIGHTS EN DIRECT */}
                            {p.audit?.siteWeb && resultatsPageSpeed[p.audit.siteWeb] && (
                              <div className="rounded-xl border border-purple-300 bg-purple-50/70 p-3.5 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-800 text-white text-[11px] font-bold">
                                      <i className="fa-brands fa-google text-[10px]" />
                                    </span>
                                    <span className="text-[12px] font-bold text-purple-950">
                                      Rapport Officiel Google PageSpeed Mobile
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                        resultatsPageSpeed[p.audit.siteWeb].scorePerformance < 50
                                          ? "bg-rose-100 text-rose-800 border-rose-300"
                                          : resultatsPageSpeed[p.audit.siteWeb].scorePerformance < 90
                                            ? "bg-amber-100 text-amber-800 border-amber-300"
                                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                                      }`}
                                    >
                                      Score Mobile : {resultatsPageSpeed[p.audit.siteWeb].scorePerformance}/100
                                    </span>
                                    <span className="text-[11px] font-bold text-purple-900 bg-white border border-purple-200 px-2 py-0.5 rounded-full">
                                      ⏱️ {resultatsPageSpeed[p.audit.siteWeb].tempsChargementSec}s
                                    </span>
                                  </div>
                                </div>

                                <p className="text-[11.5px] text-purple-950 leading-relaxed">
                                  {resultatsPageSpeed[p.audit.siteWeb].diagnosticTexte}
                                </p>

                                {resultatsPageSpeed[p.audit.siteWeb].pointsBloquants.length > 0 && (
                                  <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-lg">
                                    ⚠️ Bloquant smartphone : {resultatsPageSpeed[p.audit.siteWeb].pointsBloquants[0]}
                                  </div>
                                )}

                                <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copierPitchPageSpeed(resultatsPageSpeed[p.audit.siteWeb!], p.entreprise)
                                    }
                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-purple-700 hover:bg-purple-800 px-3 py-1.5 rounded-lg transition shadow-xs"
                                  >
                                    <i className="fa-solid fa-copy text-[10px]" />
                                    <span>Copier le pitch d'audit WhatsApp (PageSpeed)</span>
                                  </button>
                                  <span className="text-[10px] text-purple-800 italic">
                                    Diagnostic technique Google irréfutable
                                  </span>
                                </div>
                              </div>
                            )}

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
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                              <button
                                type="button"
                                onClick={() => importerUnProspect(p)}
                                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] font-bold text-navy-950 hover:bg-gray-50 transition shadow-2xs"
                              >
                                <i className="fa-solid fa-calendar-plus text-royal-800" />
                                Ajouter à ma File Aujourd'hui
                              </button>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(p.messageWhatsApp);
                                    setToastMessage("Message copié dans le presse-papier !");
                                    setTimeout(() => setToastMessage(null), 2500);
                                  }}
                                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] font-bold text-hint hover:text-navy-950 hover:bg-gray-50 transition"
                                >
                                  <i className="fa-solid fa-copy" />
                                  Copier
                                </button>

                                {p.telephone && (
                                  <button
                                    type="button"
                                    onClick={() => envoyerEtSuivreProspect(p)}
                                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                                    title="Ouvre WhatsApp avec le message pré-rempli et planifie automatiquement la relance M4 à J+2"
                                  >
                                    <i className="fa-brands fa-whatsapp text-sm" />
                                    <span>Envoyer sur WhatsApp & Lancer le suivi ➔</span>
                                  </button>
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

              {/* Sélection territoriale & Niche */}
              <div className="mt-4 space-y-3 rounded-2xl border border-gray-200 bg-gray-50/50 p-4">
                <div>
                  <label className="block text-[12px] font-bold text-navy-950 mb-1">
                    Mots-clés / Niche ciblée
                  </label>
                  <input
                    value={motsCles}
                    onChange={(e) => setMotsCles(e.target.value)}
                    className="input-sc bg-white font-medium"
                    placeholder="Ex: Clinique dentaire, Agence immobilière, Restaurant..."
                  />
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div>
                    <span className="block text-[11px] font-semibold text-hint mb-1">
                      1. Pays ({PAYS_CIBLES.length})
                    </span>
                    <select
                      value={paysId}
                      onChange={(e) => changerPays(e.target.value)}
                      className="input-sc bg-white font-bold text-[12px]"
                    >
                      {PAYS_CIBLES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.drapeau} {p.nom} ({p.indicatif})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-hint mb-1">
                      2. {paysActuel.termeDepartement} ({paysActuel.departements.length})
                    </span>
                    <select
                      value={departementId}
                      onChange={(e) => changerDepartement(e.target.value)}
                      className="input-sc bg-white font-bold text-[12px]"
                    >
                      {paysActuel.departements.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-hint mb-1">
                      3. Quartier / Commune
                    </span>
                    <select
                      value={quartierSelectionne}
                      onChange={(e) => setQuartierSelectionne(e.target.value)}
                      className="input-sc bg-white font-medium text-[12px]"
                    >
                      {departementActuel.villesEtQuartiers.map((q, idx) => {
                        const nom = getNomQuartier(q);
                        return (
                          <option key={idx} value={nom}>
                            {nom}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="text-[12px] font-semibold text-royal-800 flex items-center gap-1.5 pt-1">
                  <i className="fa-solid fa-crosshairs text-royal-600" />
                  <span>Cible active : <strong>{villeSelectionnee}</strong></span>
                </div>
              </div>

              {/* Canaux de recherche instantanée & Google Maps complet */}
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* 1. Google Maps Général */}
                <a
                  href={liensRadar.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/40 p-3.5 hover:shadow-md transition group"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs group-hover:scale-105 transition">
                    <i className="fa-solid fa-map-location-dot text-lg" />
                  </span>
                  <div>
                    <div className="font-bold text-[13px] text-navy-950 flex items-center gap-1.5">
                      Google Maps : Vue Générale
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs text-hint" />
                    </div>
                    <div className="text-[11px] text-hint mt-0.5">
                      Toutes les fiches locales à {villeSelectionnee}.
                    </div>
                  </div>
                </a>

                {/* 2. Google Maps Mieux Notés */}
                <a
                  href={liensRadar.googleMapsTopNotes}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 hover:shadow-md transition group"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs group-hover:scale-105 transition">
                    <i className="fa-solid fa-star text-lg" />
                  </span>
                  <div>
                    <div className="font-bold text-[13px] text-navy-950 flex items-center gap-1.5">
                      Google Maps : Mieux Notés (4.5★+)
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs text-hint" />
                    </div>
                    <div className="text-[11px] text-hint mt-0.5">
                      Les établissements avec la meilleure réputation à closer en priorité.
                    </div>
                  </div>
                </a>

                {/* 3. Google Maps Ouverts maintenant */}
                <a
                  href={liensRadar.googleMapsOuverts}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 hover:shadow-md transition group"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs group-hover:scale-105 transition">
                    <i className="fa-solid fa-bolt text-lg" />
                  </span>
                  <div>
                    <div className="font-bold text-[13px] text-navy-950 flex items-center gap-1.5">
                      Google Maps : Ouverts Maintenant
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs text-hint" />
                    </div>
                    <div className="text-[11px] text-hint mt-0.5">
                      Pour un contact WhatsApp ou appel téléphonique en direct.
                    </div>
                  </div>
                </a>

                {/* 4. LinkedIn Décideurs */}
                <a
                  href={liensRadar.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 hover:shadow-md transition group"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0077b5] text-white shadow-xs group-hover:scale-105 transition">
                    <i className="fa-brands fa-linkedin-in text-lg" />
                  </span>
                  <div>
                    <div className="font-bold text-[13px] text-navy-950 flex items-center gap-1.5">
                      LinkedIn : Décideurs & Dirigeants
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs text-hint" />
                    </div>
                    <div className="text-[11px] text-hint mt-0.5">
                      Fondateurs, Directeurs et Gérants à {villeSelectionnee}.
                    </div>
                  </div>
                </a>

                {/* 5. Instagram Business */}
                <a
                  href={liensRadar.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-pink-200 bg-pink-50/40 p-3.5 hover:shadow-md transition group"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 text-white shadow-xs group-hover:scale-105 transition">
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

                {/* 6. Facebook Pages Locales */}
                <a
                  href={liensRadar.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5 hover:shadow-md transition group"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1877f2] text-white shadow-xs group-hover:scale-105 transition">
                    <i className="fa-brands fa-facebook-f text-lg" />
                  </span>
                  <div>
                    <div className="font-bold text-[13px] text-navy-950 flex items-center gap-1.5">
                      Facebook : Pages Locales
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs text-hint" />
                    </div>
                    <div className="text-[11px] text-hint mt-0.5">
                      Pages d'établissements avec téléphones et horaires.
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
              <i className="fa-solid fa-map-location-dot text-rose-600" />
              Extracteur Express Google Maps, Fiches & Bio
            </h2>
            <p className="text-[12px] text-hint mt-1">
              Colle n'importe quel texte copié depuis une fiche <strong>Google Maps</strong> (nom, adresse, avis, téléphone), un post Facebook ou une bio Instagram. L'IA extrait automatiquement l'entreprise, le numéro WhatsApp et la faille à closer.
            </p>

            <textarea
              value={texteBrut}
              onChange={(e) => setTexteBrut(e.target.value)}
              rows={5}
              placeholder="Ex: Copie de fiche Google Maps (Cabinet Dentaire Saint-Paul, 4.8 étoiles, 14 avis, Rue 230 Cotonou, Téléphone: +229 97 00 00 00, Ouvert)..."
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

      {/* =================================================================== */}
      {/* MODALE D'ÉDITION DU PROFIL DE COMPÉTENCE (ÉTAPE 1 DU MOTEUR)        */}
      {/* =================================================================== */}
      {modalSkillOuvert && skillEnEdition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="max-w-2xl w-full max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-[#E7E8F4]">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-4 bg-navy-950 text-white">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{skillEnEdition.emoji || "💼"}</span>
                <div>
                  <h3 className="font-display text-[16px] font-bold">
                    Configurer le profil : {skillEnEdition.name}
                  </h3>
                  <p className="text-[11px] text-royal-100">
                    Étape 1 : Moteur multi-compétences — Données de ciblage & playbook
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalSkillOuvert(false)}
                className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>

            {/* Onglets de navigation dans la modale */}
            <div className="flex border-b bg-gray-50 px-5 pt-2 gap-2 text-[12px] font-bold">
              <button
                type="button"
                onClick={() => setOngletModalSkill("cibles")}
                className={`pb-2.5 px-3 border-b-2 transition ${
                  ongletModalSkill === "cibles"
                    ? "border-royal-800 text-royal-800"
                    : "border-transparent text-hint hover:text-navy-950"
                }`}
              >
                <i className="fa-solid fa-bullseye mr-1.5" />
                1. Niches & Mots-clés
              </button>
              <button
                type="button"
                onClick={() => setOngletModalSkill("signaux")}
                className={`pb-2.5 px-3 border-b-2 transition ${
                  ongletModalSkill === "signaux"
                    ? "border-royal-800 text-royal-800"
                    : "border-transparent text-hint hover:text-navy-950"
                }`}
              >
                <i className="fa-solid fa-filter mr-1.5" />
                2. Signaux & Angle d'offre
              </button>
              <button
                type="button"
                onClick={() => setOngletModalSkill("playbook")}
                className={`pb-2.5 px-3 border-b-2 transition ${
                  ongletModalSkill === "playbook"
                    ? "border-royal-800 text-royal-800"
                    : "border-transparent text-hint hover:text-navy-950"
                }`}
              >
                <i className="fa-solid fa-comment-dots mr-1.5" />
                3. Playbook de vente
              </button>
            </div>

            {/* Contenu avec scroll */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-[13px]">
              {ongletModalSkill === "cibles" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-bold text-navy-950 mb-1">
                        Nom du profil de compétence *
                      </label>
                      <input
                        type="text"
                        value={skillEnEdition.name}
                        onChange={(e) =>
                          setSkillEnEdition({ ...skillEnEdition, name: e.target.value })
                        }
                        className="input-sc text-[13px]"
                        placeholder="Ex: Développement web"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-navy-950 mb-1">
                        Nom court (pour badge)
                      </label>
                      <input
                        type="text"
                        value={skillEnEdition.nom_court || ""}
                        onChange={(e) =>
                          setSkillEnEdition({ ...skillEnEdition, nom_court: e.target.value })
                        }
                        className="input-sc text-[13px]"
                        placeholder="Ex: Dev Web"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[12px] font-bold text-navy-950">
                        Niches cibles de prospects (1 par ligne) *
                      </label>
                      <span className="text-[11px] text-hint">
                        {skillEnEdition.target_niches.length} niches
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={skillEnEdition.target_niches.join("\n")}
                      onChange={(e) =>
                        setSkillEnEdition({
                          ...skillEnEdition,
                          target_niches: e.target.value
                            .split("\n")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="input-sc text-[12px] font-mono leading-relaxed"
                      placeholder="Cliniques dentaires&#10;Restaurants gastronomiques&#10;Écoles privées"
                    />
                    <p className="text-[11px] text-hint mt-1">
                      Ces niches s'affichent automatiquement en suggestions rapides lors de vos recherches.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[12px] font-bold text-navy-950">
                        Mots-clés Maps/Google (1 par ligne)
                      </label>
                    </div>
                    <textarea
                      rows={5}
                      value={
                        Array.isArray(skillEnEdition.search_keywords)
                          ? skillEnEdition.search_keywords.join("\n")
                          : Object.entries(skillEnEdition.search_keywords)
                              .flatMap(([k, v]) => [`# ${k}`, ...(v || [])])
                              .join("\n")
                      }
                      onChange={(e) => {
                        const lines = e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter((s) => Boolean(s) && !s.startsWith("#"));
                        setSkillEnEdition({
                          ...skillEnEdition,
                          search_keywords: lines,
                        });
                      }}
                      className="input-sc text-[12px] font-mono leading-relaxed"
                      placeholder="clinique dentaire soins&#10;restaurant gastronomique&#10;école privée bilingue"
                    />
                  </div>
                </div>
              )}

              {ongletModalSkill === "signaux" && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[12px] font-bold text-navy-950">
                        Signaux de qualification (1 par ligne) *
                      </label>
                      <span className="text-[11px] text-hint">
                        Ce qui rend un prospect qualifié
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={skillEnEdition.signals.join("\n")}
                      onChange={(e) =>
                        setSkillEnEdition({
                          ...skillEnEdition,
                          signals: e.target.value
                            .split("\n")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="input-sc text-[12px] font-mono leading-relaxed"
                      placeholder="Pas de site web officiel&#10;Site lent sur mobile (>6s)&#10;Pas de commande WhatsApp en 1 clic"
                    />
                    <p className="text-[11px] text-hint mt-1">
                      Règle d'or : ces signaux sont testés factuellement par le code (PageSpeed, domaine, HTTP) et ne sont jamais inventés par l'IA.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-navy-950 mb-1">
                      Angle d'offre & Problème résolu *
                    </label>
                    <textarea
                      rows={4}
                      value={skillEnEdition.offer_angle}
                      onChange={(e) =>
                        setSkillEnEdition({
                          ...skillEnEdition,
                          offer_angle: e.target.value,
                        })
                      }
                      className="input-sc text-[12px] leading-relaxed"
                      placeholder="Expliquez la douleur exacte vécue par le client et ce que votre compétence lui permet de gagner."
                    />
                  </div>
                </div>
              )}

              {ongletModalSkill === "playbook" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-bold text-navy-950 mb-1">
                      Consignes de rédaction impératives (1 par ligne)
                    </label>
                    <textarea
                      rows={3}
                      value={skillEnEdition.message_playbook.system_rules.join("\n")}
                      onChange={(e) =>
                        setSkillEnEdition({
                          ...skillEnEdition,
                          message_playbook: {
                            ...skillEnEdition.message_playbook,
                            system_rules: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                      className="input-sc text-[12px] font-mono leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-bold text-navy-950 mb-1">
                        Variante 1 : Angle Problème
                      </label>
                      <textarea
                        rows={4}
                        value={skillEnEdition.message_playbook.angle_probleme}
                        onChange={(e) =>
                          setSkillEnEdition({
                            ...skillEnEdition,
                            message_playbook: {
                              ...skillEnEdition.message_playbook,
                              angle_probleme: e.target.value,
                            },
                          })
                        }
                        className="input-sc text-[12px] leading-relaxed"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-navy-950 mb-1">
                        Variante 2 : Angle Opportunité
                      </label>
                      <textarea
                        rows={4}
                        value={skillEnEdition.message_playbook.angle_opportunite}
                        onChange={(e) =>
                          setSkillEnEdition({
                            ...skillEnEdition,
                            message_playbook: {
                              ...skillEnEdition.message_playbook,
                              angle_opportunite: e.target.value,
                            },
                          })
                        }
                        className="input-sc text-[12px] leading-relaxed"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-3">
                    <span className="text-[12px] font-bold text-navy-950 block">
                      Gestion des 3 objections majeures
                    </span>
                    <div>
                      <label className="block text-[11px] font-semibold text-hint mb-0.5">
                        Objection « Pas de budget »
                      </label>
                      <input
                        type="text"
                        value={skillEnEdition.message_playbook.gestion_objections.pas_de_budget || ""}
                        onChange={(e) =>
                          setSkillEnEdition({
                            ...skillEnEdition,
                            message_playbook: {
                              ...skillEnEdition.message_playbook,
                              gestion_objections: {
                                ...skillEnEdition.message_playbook.gestion_objections,
                                pas_de_budget: e.target.value,
                              },
                            },
                          })
                        }
                        className="input-sc text-[12px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-hint mb-0.5">
                        Objection « Pas le temps »
                      </label>
                      <input
                        type="text"
                        value={skillEnEdition.message_playbook.gestion_objections.pas_le_temps || ""}
                        onChange={(e) =>
                          setSkillEnEdition({
                            ...skillEnEdition,
                            message_playbook: {
                              ...skillEnEdition.message_playbook,
                              gestion_objections: {
                                ...skillEnEdition.message_playbook.gestion_objections,
                                pas_le_temps: e.target.value,
                              },
                            },
                          })
                        }
                        className="input-sc text-[12px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-hint mb-0.5">
                        Objection « J'ai déjà quelqu'un »
                      </label>
                      <input
                        type="text"
                        value={skillEnEdition.message_playbook.gestion_objections.deja_quelquun || ""}
                        onChange={(e) =>
                          setSkillEnEdition({
                            ...skillEnEdition,
                            message_playbook: {
                              ...skillEnEdition.message_playbook,
                              gestion_objections: {
                                ...skillEnEdition.message_playbook.gestion_objections,
                                deja_quelquun: e.target.value,
                              },
                            },
                          })
                        }
                        className="input-sc text-[12px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-navy-950 mb-1">
                      Séquence de relances R1, R2, R3 (1 relance par ligne)
                    </label>
                    <textarea
                      rows={3}
                      value={skillEnEdition.message_playbook.sequence_relances.join("\n")}
                      onChange={(e) =>
                        setSkillEnEdition({
                          ...skillEnEdition,
                          message_playbook: {
                            ...skillEnEdition.message_playbook,
                            sequence_relances: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                      className="input-sc text-[12px] font-mono leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t px-5 py-3.5 bg-gray-50">
              <button
                type="button"
                onClick={reinitialiserSkillActuel}
                className="text-[11px] font-semibold text-rose-600 hover:underline"
              >
                <i className="fa-solid fa-rotate-left mr-1" />
                Réinitialiser aux valeurs d'origine
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalSkillOuvert(false)}
                  className="rounded-xl border border-gray-200 px-3.5 py-1.5 text-[12px] font-bold text-navy-950 hover:bg-gray-100"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={sauvegarderSkillEnEdition}
                  className="btn-primary-sc px-4 py-1.5 text-[12px] flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-check" />
                  Enregistrer le profil
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
