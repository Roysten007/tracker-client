// Service d'analyse de contenu par IA (Étape 4).
// Règle d'or : analyse uniquement à partir du texte visible réel fourni.
// Si une information est absente, elle est marquée « non trouvé ». Zéro hallucination.

import type { Config } from "../lib/types";
import { extraireContenuTexteServeur, type ContenuTexteSite } from "./scraping-contenu";

export type ResultatAnalyseContenu = {
  url: string;
  headline_actuelle: string; // Titre principal ou "non trouvé"
  cta_actuel: string; // Appel à l'action ou "non trouvé"
  promesse_identifiee: string; // Ce qu'ils vendent / transformation ou "non trouvé"
  objections_non_traitees: string[]; // Liste de ce qui manque (prix, garantie, etc.) ou ["non trouvé"]
  preuve_sociale: string; // Témoignages ou chiffres ou "non trouvé"
  note_persuasion: number; // 1 à 5
  faille_majeure: string; // Synthèse chirurgicale en 1 phrase
  recommandation_concrete: string; // Ce qu'il faut réécrire en priorité
  dateAnalyse: string;
};

const PROMPT_SYSTEME_ANALYSE_CONTENU = `Tu es un auditeur de conversion et copywriter professionnel.
On te transmet le texte visible réel extrait du site web d'une entreprise.

RÈGLE D'OR COMMERCIALE (ZÉRO HALLUCINATION / FACTUEL STRICT) :
- Base TOUTE ton analyse exclusivement sur les mots réels présents dans le texte fourni.
- Si le site n'a pas de titre clair -> écris "non trouvé".
- Si le site n'a pas de bouton d'appel à l'action (CTA) clair -> écris "non trouvé".
- Si aucune promesse concrète de résultat ou bénéfice n'apparaît -> écris "non trouvé".
- Si aucune preuve sociale (témoignages, chiffres, avis) n'est mentionnée -> écris "non trouvé".
- N'invente JAMAIS d'éléments absents.

Format de réponse attendu : EXCLUSIVEMENT un objet JSON valide sans markdown :
{
  "headline_actuelle": "…",
  "cta_actuel": "…",
  "promesse_identifiee": "…",
  "objections_non_traitees": ["…", "…"],
  "preuve_sociale": "…",
  "note_persuasion": 1,
  "faille_majeure": "…",
  "recommandation_concrete": "…"
}`;

export async function analyserContenuSiteWeb(
  urlWeb: string,
  config: Config,
  textePreExtrait?: ContenuTexteSite,
): Promise<ResultatAnalyseContenu> {
  const urlPropre = (urlWeb || "").trim();
  if (!urlPropre || urlPropre === "aucun") {
    return {
      url: "",
      headline_actuelle: "non trouvé",
      cta_actuel: "non trouvé",
      promesse_identifiee: "non trouvé",
      objections_non_traitees: ["Aucun site web officiel", "Aucun texte de présentation"],
      preuve_sociale: "non trouvé",
      note_persuasion: 1,
      faille_majeure: "Absence totale de site web pour présenter et vendre l'offre.",
      recommandation_concrete: "Créer une première page vitrine avec promesse claire et contact WhatsApp.",
      dateAnalyse: new Date().toISOString(),
    };
  }

  // 1. Extraire le texte si non fourni
  const contenu = textePreExtrait || (await extraireContenuTexteServeur(urlPropre));

  if (!contenu.texteVisibleComplet || contenu.texteVisibleComplet.length < 30) {
    return {
      url: urlPropre,
      headline_actuelle: contenu.titre || "non trouvé",
      cta_actuel: "non trouvé",
      promesse_identifiee: "non trouvé",
      objections_non_traitees: ["Contenu textuel presque vide", "Pas d'offre détaillée"],
      preuve_sociale: "non trouvé",
      note_persuasion: 1,
      faille_majeure: "Site sans contenu persuasif exploitable par un visiteur.",
      recommandation_concrete: "Rédiger une accroche claire orientée résultat pour capter l'attention.",
      dateAnalyse: new Date().toISOString(),
    };
  }

  // 2. Déterminer quel moteur d'IA utiliser (NVIDIA, Groq, Mistral, Gemini)
  const moteur = config.moteurAudit || config.modeIA || "gemini";
  let cle = "";
  let endpoint = "";
  let modele = "gpt-4o-mini";

  if (moteur === "nvidia" || config.nvidiaKey) {
    cle = config.nvidiaKey || "";
    endpoint = "https://integrate.api.nvidia.com/v1/chat/completions";
    modele = "meta/llama-3.1-70b-instruct";
  } else if (moteur === "groq" || config.groqKey) {
    cle = config.groqKey || "";
    endpoint = "https://api.groq.com/openai/v1/chat/completions";
    modele = "llama-3.3-70b-versatile";
  } else if (moteur === "mistral" || config.mistralKey) {
    cle = config.mistralKey || "";
    endpoint = "https://api.mistral.ai/v1/chat/completions";
    modele = "mistral-small-latest";
  } else if (config.geminiKey) {
    cle = config.geminiKey || "";
    endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    modele = "gemini-2.0-flash";
  }

  // Si aucune clé IA n'est disponible, analyse heuristique factuelle par code
  if (!cle) {
    const aCta = contenu.boutonsCta.length > 0;
    const aH1 = contenu.titresH1.length > 0;
    const objectionsManquantes: string[] = [];
    if (!aCta) objectionsManquantes.push("Aucun bouton d'action direct (CTA)");
    if (!contenu.texteVisibleComplet.toLowerCase().includes("avis") && !contenu.texteVisibleComplet.toLowerCase().includes("témoignage")) {
      objectionsManquantes.push("Absence de témoignages ou preuves clients");
    }
    if (!contenu.texteVisibleComplet.toLowerCase().includes("prix") && !contenu.texteVisibleComplet.toLowerCase().includes("tarif")) {
      objectionsManquantes.push("Tarifs et modalités non mentionnés");
    }

    return {
      url: urlPropre,
      headline_actuelle: aH1 ? contenu.titresH1[0] : contenu.titre || "non trouvé",
      cta_actuel: aCta ? contenu.boutonsCta[0] : "non trouvé",
      promesse_identifiee: contenu.descriptionMeta || (contenu.paragraphes[0] ? contenu.paragraphes[0].slice(0, 100) : "non trouvé"),
      objections_non_traitees: objectionsManquantes.length > 0 ? objectionsManquantes : ["non trouvé"],
      preuve_sociale: "non trouvé",
      note_persuasion: aCta && aH1 ? 3 : 2,
      faille_majeure: aCta ? "Textes informatifs mais sans promesse de transformation forte." : "Aucun appel à l'action clair invitant le visiteur à commander ou réserver.",
      recommandation_concrete: "Ajouter une accroche bénéfice en haut de page et un bouton WhatsApp direct bien visible.",
      dateAnalyse: new Date().toISOString(),
    };
  }

  try {
    const promptUser = `Texte réel extrait du site web ${urlPropre} :\n\n${contenu.texteVisibleComplet}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cle}`,
      },
      body: JSON.stringify({
        model: modele,
        messages: [
          { role: "system", content: PROMPT_SYSTEME_ANALYSE_CONTENU },
          { role: "user", content: promptUser },
        ],
        temperature: 0.1, // Déterministe et factuel
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      throw new Error(`Erreur API IA ${res.status}`);
    }

    const data = await res.json();
    const rawContent = data?.choices?.[0]?.message?.content || "";

    // Nettoyer les balises markdown
    const jsonStr = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    return {
      url: urlPropre,
      headline_actuelle: String(parsed.headline_actuelle || "non trouvé"),
      cta_actuel: String(parsed.cta_actuel || "non trouvé"),
      promesse_identifiee: String(parsed.promesse_identifiee || "non trouvé"),
      objections_non_traitees: Array.isArray(parsed.objections_non_traitees) && parsed.objections_non_traitees.length > 0
        ? parsed.objections_non_traitees.map(String)
        : ["non trouvé"],
      preuve_sociale: String(parsed.preuve_sociale || "non trouvé"),
      note_persuasion: typeof parsed.note_persuasion === "number" ? parsed.note_persuasion : 2,
      faille_majeure: String(parsed.faille_majeure || "Textes manquant d'impact commercial."),
      recommandation_concrete: String(parsed.recommandation_concrete || "Ajouter un appel à l'action WhatsApp direct."),
      dateAnalyse: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[Échec analyse IA contenu, repli heuristique]", err);
    return {
      url: urlPropre,
      headline_actuelle: contenu.titresH1[0] || contenu.titre || "non trouvé",
      cta_actuel: contenu.boutonsCta[0] || "non trouvé",
      promesse_identifiee: contenu.descriptionMeta || "non trouvé",
      objections_non_traitees: ["Preuve sociale non détectée", "Manque de clarté des tarifs"],
      preuve_sociale: "non trouvé",
      note_persuasion: 2,
      faille_majeure: "Texte purement informatif sans structure de persuasion orientée action.",
      recommandation_concrete: "Structurer la page avec une promesse en H1 et un bouton WhatsApp direct.",
      dateAnalyse: new Date().toISOString(),
    };
  }
}
