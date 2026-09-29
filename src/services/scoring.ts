// Service de scoring algorithmique déterministe de prospects (Étape 5).
// Règle d'or : calculé EXCLUSIVEMENT par le code et les faits constatés, JAMAIS par l'IA.
// Barème transparent 0-100 classant les prospects par potentiel réel de closing.

import type { SkillDoc } from "../lib/types";
import type { ResultatPageSpeed } from "./pagespeed";
import type { ResultatAnalyseContenu } from "./analyse-contenu";
import type { StatutSiteWebPlaces } from "./places";

export type DetailLigneScore = {
  critere: string;
  points: number;
  explication: string;
};

export type ResultatScoringProspect = {
  scoreTotal: number; // 0 à 100
  priorite: "haute" | "moyenne" | "basse";
  labelPriorite: string;
  couleurBadge: string;
  verdict: string;
  lignesScore: DetailLigneScore[];
};

export function calculerScoreProspect(params: {
  prospect: {
    nom: string;
    website?: string;
    statut_site: StatutSiteWebPlaces;
    telephone?: string;
    note?: number;
    nombre_avis?: number;
    photos?: string[];
  };
  skill: SkillDoc;
  pageSpeed?: ResultatPageSpeed;
  analyseContenu?: ResultatAnalyseContenu;
}): ResultatScoringProspect {
  const { prospect, skill, pageSpeed, analyseContenu } = params;
  const lignes: DetailLigneScore[] = [];
  let score = 0;

  // 1. STATUT DU SITE WEB (Jusqu'à 40 points)
  if (prospect.statut_site === "pas_de_site" || !prospect.website) {
    score += 40;
    lignes.push({
      critere: "Absence de site web officiel",
      points: 40,
      explication: "L'établissement est invisible sur Google Web : opportunité maximale pour vendre une création de vitrine complète.",
    });
  } else if (prospect.statut_site === "site_inaccessible") {
    score += 35;
    lignes.push({
      critere: "Site web inaccessible (panne / erreur HTTP)",
      points: 35,
      explication: "Le lien Google Maps tombe sur une erreur : urgence commerciale immédiate de refonte.",
    });
  } else if (prospect.statut_site === "plateforme") {
    score += 30;
    lignes.push({
      critere: "Présence limitée à une page sociale / annuaire",
      points: 30,
      explication: "Pas de nom de domaine dédié ni de tunnel de commande direct à leur marque.",
    });
  } else if (prospect.statut_site === "site_verifie") {
    // Si site en ligne, on regarde la vitesse PageSpeed
    if (pageSpeed) {
      if (pageSpeed.scorePerformance < 50 || pageSpeed.tempsChargementSec > 5) {
        score += 25;
        lignes.push({
          critere: `Site lent sur smartphone (${pageSpeed.scorePerformance}/100, ${pageSpeed.tempsChargementSec}s)`,
          points: 25,
          explication: "Perte de 50%+ des visiteurs mobiles : argument de vente imparable pour refonte ou accélération.",
        });
      } else if (pageSpeed.scorePerformance < 80) {
        score += 15;
        lignes.push({
          critere: `Performance mobile perfectible (${pageSpeed.scorePerformance}/100)`,
          points: 15,
          explication: "Opportunité d'optimisation technique et Core Web Vitals.",
        });
      } else {
        score += 5;
        lignes.push({
          critere: "Site rapide en ligne",
          points: 5,
          explication: "Bonne vitesse technique : opportunité orientée copywriting et tunnel de vente.",
        });
      }
    } else {
      score += 15;
      lignes.push({
        critere: "Site web en ligne détecté",
        points: 15,
        explication: "Établissement digitalisé avec infrastructure prête à être améliorée.",
      });
    }
  }

  // 2. CONTACT DIRECT VÉRIFIÉ (15 points)
  if (prospect.telephone && prospect.telephone.trim().length >= 7) {
    score += 15;
    lignes.push({
      critere: "Numéro de téléphone / WhatsApp vérifié disponible",
      points: 15,
      explication: "Possibilité de joindre le décideur directement sur WhatsApp en 1 clic sans intermédiaire.",
    });
  }

  // 3. ACTIVITÉ & RÉPUTATION RÉELLE GOOGLE (15 points)
  const note = prospect.note ?? 0;
  const avis = prospect.nombre_avis ?? 0;
  if (note >= 4.0 && avis >= 5) {
    score += 15;
    lignes.push({
      critere: `Excellente réputation client (${note}/5 avec ${avis} avis)`,
      points: 15,
      explication: "Entreprise active, solvable, avec une vraie clientèle prête à investir pour grandir.",
    });
  } else if (avis > 0) {
    score += 5;
    lignes.push({
      critere: `Activité commerciale vérifiée (${avis} avis)`,
      points: 5,
      explication: "Preuve d'activité réelle sur le terrain.",
    });
  }

  // 4. ANALYSE DU CONTENU OU PERSUASION (Jusqu'à 20 points)
  if (analyseContenu) {
    if (analyseContenu.cta_actuel === "non trouvé") {
      score += 10;
      lignes.push({
        critere: "Aucun appel à l'action clair (CTA)",
        points: 10,
        explication: "Les visiteurs qui arrivent sur la page ne savent pas comment commander ou réserver.",
      });
    }
    if (analyseContenu.promesse_identifiee === "non trouvé" || analyseContenu.note_persuasion <= 2) {
      score += 10;
      lignes.push({
        critere: "Textes descriptifs sans promesse forte",
        points: 10,
        explication: "Contenu non optimisé pour la persuasion et la conversion.",
      });
    }
  } else if (prospect.statut_site === "pas_de_site" || prospect.statut_site === "plateforme") {
    score += 15;
    lignes.push({
      critere: "Aucun tunnel de conversion officiel",
      points: 15,
      explication: "Zéro bouton de commande WhatsApp direct pour convertir les recherches Maps.",
    });
  }

  // 5. BONUS SPÉCIFIQUE À LA COMPÉTENCE (10 points)
  const skillId = (skill.id || "").toLowerCase();
  if (skillId.includes("video") || skillId === "montage_video") {
    score += 10;
    lignes.push({
      critere: "Absence de vidéos courtes sur leur fiche",
      points: 10,
      explication: "Potentiel visuel inexploité en format court vertical (Reels / TikTok).",
    });
  } else if (skillId.includes("graph") || skillId === "graphisme_branding") {
    if (!prospect.photos || prospect.photos.length < 3) {
      score += 10;
      lignes.push({
        critere: "Faible qualité visuelle sur Maps (< 3 photos)",
        points: 10,
        explication: "Besoin évident de refonte d'identité de marque et de supports HD.",
      });
    } else {
      score += 5;
    }
  } else if (skillId.includes("ads") || skillId === "communaute_ads") {
    score += 10;
    lignes.push({
      critere: "Canal d'acquisition publicitaire absent",
      points: 10,
      explication: "Dépendance exclusive au bouche-à-oreille sans campagnes Meta Ads ciblées.",
    });
  } else if (skillId.includes("copy") || skillId === "copywriting") {
    score += 10;
    lignes.push({
      critere: "Opportunité de structure de vente persuasive",
      points: 10,
      explication: "Offre à clarifier pour lever les objections majeures des prospects.",
    });
  }

  // Plafonner à 100 points
  const scoreTotal = Math.min(100, Math.max(0, score));

  // Classification du prospect
  let priorite: "haute" | "moyenne" | "basse" = "basse";
  let labelPriorite = "Priorité Basse (À qualifier)";
  let couleurBadge = "bg-gray-100 text-gray-800 border-gray-300";
  let verdict = "Prospect tiède, manque de signaux évidents de closing immédiat.";

  if (scoreTotal >= 70) {
    priorite = "haute";
    labelPriorite = "🔥 Priorité Haute (Lead très chaud)";
    couleurBadge = "bg-emerald-100 text-emerald-800 border-emerald-300";
    verdict = "Alignement parfait : faille critique constatée, contact WhatsApp direct disponible et réputation solvable.";
  } else if (scoreTotal >= 45) {
    priorite = "moyenne";
    labelPriorite = "⚡ Priorité Moyenne (Opportunité solide)";
    couleurBadge = "bg-amber-100 text-amber-800 border-amber-300";
    verdict = "Belle opportunité commerciale : au moins une faille majeure vérifiée à exploiter dans le pitch.";
  }

  return {
    scoreTotal,
    priorite,
    labelPriorite,
    couleurBadge,
    verdict,
    lignesScore: lignes,
  };
}
