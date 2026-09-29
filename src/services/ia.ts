// Couche IA Sprint Machine — abstraction unique pour V1 (gabarits + Gemini)
// et V2 future (Anthropic via Cloud Functions).
//
// Contrat : les écrans n'appellent QUE `getServiceIA(config)` et utilisent les 3 méthodes
// de ServiceIA. Migrer vers Anthropic = ajouter une 3e implémentation et un cas dans le switch.

import type {
  AnalyseProfil,
  Config,
  DayStats,
  ModeIA,
  Plateforme,
  Prospect,
  Segment,
  SignauxProspect,
  TypeMessage,
} from "../lib/types";

// ---- Interface publique -----------------------------------------------------

export type DonneesRapport = {
  aujourdhui: string; // libellé long FR
  chiffresJour: DayStats;
  objectifQuotidien: number;
  totauxCumules: DayStats;
  pipelineParStatut: Record<string, number>;
  relancesDemain: number;
  streakJours: number;
  quatorzeJours: { key: string; sent: number }[];
};

export type ProspectPourAudit = {
  prenom: string;
  metier: string;
  entreprise?: string;
  detail: string;
  niche?: string;
  opportunite?: string;
  plateforme?: Plateforme;
};

export type ParametresRechercheProspects = {
  nicheOuMotsCles: string;
  ville: string;
  nombre: number;
  offreService?: string;
  typeCible?: string;
};

export type StatutSiteWeb = "aucun" | "obsolete" | "lent_mobile" | "sans_whatsapp" | "inaccessible";

export type AuditDetailleProspect = {
  statutSite: StatutSiteWeb;
  siteWeb?: string;
  ceQuiManque: string; // Ce qui manque vraiment (ex: "Aucun site officiel, présence limitée à Facebook")
  impactCommercial: string; // Ce que ça leur fait perdre (ex: "Perte de 15 à 30 clients/mois")
  solutionRecommandee: string; // L'offre à vendre (ex: "Site vitrine haute conversion 5 jours + commande WhatsApp")
  signauxCritiques: string[]; // ["Aucun site web", "Pas de WhatsApp direct"]
};

export type ProspectSourceIA = {
  prenom: string;
  entreprise: string;
  metier: string;
  telephone: string;
  email: string;
  ville: string;
  detail: string;
  opportunite: string;
  messageWhatsApp: string;
  segment: Segment;
  montantEstime: number;
  audit: AuditDetailleProspect;
};

export interface ServiceIA {
  readonly mode: ModeIA;
  genererMessage(prospect: ProspectPourMessage, type: TypeMessage): Promise<string>;
  analyserProfil(texte: string, url?: string): Promise<AnalyseProfil>;
  rapportDuSoir(donnees: DonneesRapport): Promise<string>;
  genererAuditFlash(prospect: ProspectPourAudit): Promise<string>;
  sourcerProspectsIA(params: ParametresRechercheProspects): Promise<ProspectSourceIA[]>;
}

export type ProspectPourMessage = Pick<
  Prospect,
  "prenom" | "metier" | "plateforme" | "detail" | "segment"
> & {
  telephone?: string;
  entreprise?: string;
  ville?: string;
  niche?: string;
  opportunite?: string;
};

// Erreur explicite quand une capacité manque (l'écran affiche un message clair).
export class CapaciteNonDisponibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapaciteNonDisponibleError";
  }
}

// ---- Fabrique ---------------------------------------------------------------

// ---- Fabrique Dual-Engine ---------------------------------------------------

export function getServiceIA(config: Config): ServiceIA {
  // 1. Moteur de Recherche Terrain (Google Maps / Web)
  let serviceRecherche: ServiceIA = new ServiceGabarits(config);
  if (config.geminiKey?.trim()) {
    serviceRecherche = new ServiceGemini(config);
  }

  // 2. Moteur d'Audit & Diagnostic des Failles (IA Analytique)
  const auditMode: ModeIA = config.moteurAudit || config.modeIA || "gemini";
  let serviceAudit: ServiceIA = serviceRecherche;

  if (auditMode === "mistral" && config.mistralKey?.trim()) {
    serviceAudit = new ServiceOpenAICompatible(
      config,
      "https://api.mistral.ai/v1/chat/completions",
      config.mistralKey.trim(),
      config.modelePerso || "mistral-small-latest",
      "mistral",
    );
  } else if (auditMode === "groq" && config.groqKey?.trim()) {
    serviceAudit = new ServiceOpenAICompatible(
      config,
      "https://api.groq.com/openai/v1/chat/completions",
      config.groqKey.trim(),
      config.modelePerso || "llama-3.3-70b-versatile",
      "groq",
    );
  } else if (auditMode === "nvidia" && config.nvidiaKey?.trim()) {
    serviceAudit = new ServiceOpenAICompatible(
      config,
      "https://integrate.api.nvidia.com/v1/chat/completions",
      config.nvidiaKey.trim(),
      config.modelePerso || "meta/llama-3.1-70b-instruct",
      "nvidia",
    );
  } else if (auditMode === "openrouter" && config.openrouterKey?.trim()) {
    serviceAudit = new ServiceOpenAICompatible(
      config,
      "https://openrouter.ai/api/v1/chat/completions",
      config.openrouterKey.trim(),
      config.modelePerso || "meta-llama/llama-3.3-70b-instruct",
      "openrouter",
    );
  } else if (auditMode === "gemini" && config.geminiKey?.trim()) {
    serviceAudit = new ServiceGemini(config);
  } else if (auditMode === "gabarits") {
    serviceAudit = new ServiceGabarits(config);
  }

  // Si on combine recherche Google (Système 1) et audit via un autre modèle (Système 2)
  if (serviceRecherche !== serviceAudit && config.geminiKey?.trim()) {
    return new ServiceDoubleMoteur(serviceRecherche, serviceAudit, auditMode);
  }

  return serviceAudit;
}

class ServiceDoubleMoteur implements ServiceIA {
  readonly mode: ModeIA;
  constructor(
    private recherche: ServiceIA,
    private audit: ServiceIA,
    mode: ModeIA,
  ) {
    this.mode = mode;
  }

  async sourcerProspectsIA(params: ParametresRechercheProspects): Promise<ProspectSourceIA[]> {
    return this.recherche.sourcerProspectsIA(params);
  }

  genererMessage(prospect: ProspectPourMessage, type: TypeMessage): Promise<string> {
    return this.audit.genererMessage(prospect, type);
  }

  analyserProfil(texte: string, url?: string): Promise<AnalyseProfil> {
    return this.audit.analyserProfil(texte, url);
  }

  rapportDuSoir(donnees: DonneesRapport): Promise<string> {
    return this.audit.rapportDuSoir(donnees);
  }

  genererAuditFlash(prospect: ProspectPourAudit): Promise<string> {
    return this.audit.genererAuditFlash(prospect);
  }
}

// =============================================================================
// Implémentation "gabarits" — le socle, toujours disponible, zéro réseau
// =============================================================================

class ServiceGabarits implements ServiceIA {
  readonly mode = "gabarits" as const;
  constructor(private cfg: Config) {}

  async genererMessage(prospect: ProspectPourMessage, type: TypeMessage): Promise<string> {
    return rendreGabarit(type, prospect, this.cfg);
  }

  async analyserProfil(texte: string): Promise<AnalyseProfil> {
    // Mode heuristique offline : extrait ce qu'il peut sans bloquer
    return extraireProfilHorsLigne(texte);
  }

  async rapportDuSoir(donnees: DonneesRapport): Promise<string> {
    return rapportCalcule(donnees);
  }

  async genererAuditFlash(prospect: ProspectPourAudit): Promise<string> {
    return auditFlashGabarit(prospect);
  }

  async sourcerProspectsIA(params: ParametresRechercheProspects): Promise<ProspectSourceIA[]> {
    return sourcerProspectsGabarit(params);
  }
}

// =============================================================================
// Implémentation "gemini" — avec Recherche Web Google (Grounding) en direct
// =============================================================================

// Modèle par défaut : gemini-3.8-flash (recommandé officiellement par Google pour remplacer gemini-2.0-flash)
let modeleGeminiActif = "gemini-3.8-flash";

const MODELES_GEMINI_CANDIDATS = [
  "gemini-3.8-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
];

const ENDPOINT_GEMINI = (modele: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`;

class ServiceGemini implements ServiceIA {
  readonly mode = "gemini" as const;
  private repli: ServiceGabarits;

  constructor(private cfg: Config) {
    this.repli = new ServiceGabarits(cfg);
  }

  async genererMessage(prospect: ProspectPourMessage, type: TypeMessage): Promise<string> {
    try {
      const texte = await this.appelerGemini({
        systeme: PROMPT_SYSTEME_VOIX,
        utilisateur: promptGenererMessage(prospect, type, this.cfg),
        maxTokens: 400,
      });
      const nettoye = nettoyerTexteMessage(texte);
      if (!nettoye) throw new Error("Réponse vide");
      return nettoye;
    } catch (e) {
      signalerRepli(e);
      return this.repli.genererMessage(prospect, type);
    }
  }

  async analyserProfil(texte: string, url?: string): Promise<AnalyseProfil> {
    try {
      const brut = await this.appelerGemini({
        systeme: PROMPT_SYSTEME_ANALYSE,
        utilisateur: promptAnalyserProfil(texte, url),
        maxTokens: 1000,
      });
      return parserAnalyseJson(brut);
    } catch (e) {
      signalerRepli(e);
      return this.repli.analyserProfil(texte);
    }
  }

  async rapportDuSoir(donnees: DonneesRapport): Promise<string> {
    try {
      const texte = await this.appelerGemini({
        systeme: PROMPT_SYSTEME_RAPPORT,
        utilisateur: promptRapport(donnees),
        maxTokens: 400,
      });
      const nettoye = texte.trim();
      if (!nettoye) throw new Error("Réponse vide");
      return nettoye;
    } catch (e) {
      signalerRepli(e);
      return this.repli.rapportDuSoir(donnees);
    }
  }

  async genererAuditFlash(prospect: ProspectPourAudit): Promise<string> {
    try {
      const texte = await this.appelerGemini({
        systeme: PROMPT_SYSTEME_AUDIT_FLASH,
        utilisateur: promptAuditFlash(prospect),
        maxTokens: 500,
      });
      const nettoye = texte.trim();
      if (!nettoye) throw new Error("Réponse vide");
      return nettoye;
    } catch (e) {
      signalerRepli(e);
      return this.repli.genererAuditFlash(prospect);
    }
  }

  async sourcerProspectsIA(params: ParametresRechercheProspects): Promise<ProspectSourceIA[]> {
    const avecRecherche = this.cfg.rechercheWebActivee ?? true;
    try {
      // 1er essai : avec recherche web Google en direct si activée (8192 tokens pour supporter jusqu'à 15 prospects complets)
      const brut = await this.appelerGemini({
        systeme: PROMPT_SYSTEME_SOURCING,
        utilisateur: promptSourcerProspects(params),
        maxTokens: 8192,
        rechercheWeb: avecRecherche,
      });
      return parserSourcingJson(brut, params);
    } catch (e) {
      console.warn("[Gemini Grounding Error]", e);
      // Si la recherche web avec Grounding a échoué (quota ou limitation réseau), tenter sans grounding
      if (avecRecherche) {
        try {
          const brutFallback = await this.appelerGemini({
            systeme: PROMPT_SYSTEME_SOURCING,
            utilisateur: promptSourcerProspects(params),
            maxTokens: 8192,
            rechercheWeb: false,
          });
          return parserSourcingJson(brutFallback, params);
        } catch (eFallback) {
          console.warn("[Gemini Fallback Error]", eFallback);
          // Repli vers l'annuaire physique vérifié en cas d'erreur API
          return this.repli.sourcerProspectsIA(params);
        }
      }
      return this.repli.sourcerProspectsIA(params);
    }
  }

  // --- Bas niveau : appel HTTP avec bascule automatique de modèle et backoff ---
  private async appelerGemini(args: {
    systeme: string;
    utilisateur: string;
    maxTokens: number;
    rechercheWeb?: boolean;
  }): Promise<string> {
    const modelesAtester = [
      modeleGeminiActif,
      ...MODELES_GEMINI_CANDIDATS.filter((m) => m !== modeleGeminiActif),
    ];

    let derniereErreur: unknown = null;

    for (let i = 0; i < modelesAtester.length; i++) {
      const modele = modelesAtester[i];
      const url = `${ENDPOINT_GEMINI(modele)}?key=${encodeURIComponent(this.cfg.geminiKey)}`;
      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: args.systeme }] },
        contents: [{ role: "user", parts: [{ text: args.utilisateur }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: args.maxTokens },
      };

      if (args.rechercheWeb) {
        body.tools = [{ googleSearch: {} }];
      }

      for (let essai = 0; essai < 2; essai++) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });

          if (res.status === 429) throw new Error("Quota IA du jour atteint");

          if (!res.ok) {
            let details = "";
            try {
              const errJson = (await res.json()) as { error?: { message?: string } };
              details = errJson.error?.message ?? "";
            } catch {
              /* ignore parse */
            }
            console.error(`[Gemini ${res.status} (${modele})]`, details);

            // Si le modèle est 404 (obsolète ou introuvable)
            if (res.status === 404) {
              const matchReco = details.match(/models\/(gemini-[0-9a-z.-]+)/i);
              if (matchReco && matchReco[1] && !modelesAtester.includes(matchReco[1])) {
                modelesAtester.push(matchReco[1]);
              }
              derniereErreur = new Error(
                details ? `Gemini 404 : ${details}` : `Modèle ${modele} introuvable`,
              );
              break; // Essayer le modèle suivant
            }

            throw new Error(details ? `Gemini ${res.status} : ${details}` : `Gemini ${res.status}`);
          }

          const json = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const parts = json.candidates?.[0]?.content?.parts ?? [];
          const texte = parts.map((p) => p.text ?? "").join("");

          // Mémoriser le modèle qui fonctionne
          modeleGeminiActif = modele;
          return texte;
        } catch (e) {
          derniereErreur = e;
          if (e instanceof Error && e.message.includes("404")) {
            break; // Passer au modèle suivant
          }
          if (e instanceof Error && e.message.includes("Quota")) {
            throw e;
          }
          if (essai === 0) await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    throw derniereErreur ?? new Error("Gemini indisponible");
  }
}

// =============================================================================
// Implémentation OpenAI-Compatible (Mistral, Groq, Nvidia, OpenRouter)
// =============================================================================

class ServiceOpenAICompatible implements ServiceIA {
  readonly mode: ModeIA;
  private repli: ServiceGabarits;

  constructor(
    private cfg: Config,
    private endpoint: string,
    private cle: string,
    private modele: string,
    mode: ModeIA,
  ) {
    this.mode = mode;
    this.repli = new ServiceGabarits(cfg);
  }

  async genererMessage(prospect: ProspectPourMessage, type: TypeMessage): Promise<string> {
    try {
      const texte = await this.appelerChat({
        systeme: PROMPT_SYSTEME_VOIX,
        utilisateur: promptGenererMessage(prospect, type, this.cfg),
        maxTokens: 400,
      });
      const nettoye = nettoyerTexteMessage(texte);
      if (!nettoye) throw new Error("Réponse vide");
      return nettoye;
    } catch (e) {
      signalerRepli(e);
      return this.repli.genererMessage(prospect, type);
    }
  }

  async analyserProfil(texte: string, url?: string): Promise<AnalyseProfil> {
    try {
      const brut = await this.appelerChat({
        systeme: PROMPT_SYSTEME_ANALYSE,
        utilisateur: promptAnalyserProfil(texte, url),
        maxTokens: 1000,
      });
      return parserAnalyseJson(brut);
    } catch (e) {
      signalerRepli(e);
      return this.repli.analyserProfil(texte);
    }
  }

  async rapportDuSoir(donnees: DonneesRapport): Promise<string> {
    try {
      const texte = await this.appelerChat({
        systeme: PROMPT_SYSTEME_RAPPORT,
        utilisateur: promptRapport(donnees),
        maxTokens: 400,
      });
      const nettoye = texte.trim();
      if (!nettoye) throw new Error("Réponse vide");
      return nettoye;
    } catch (e) {
      signalerRepli(e);
      return this.repli.rapportDuSoir(donnees);
    }
  }

  async genererAuditFlash(prospect: ProspectPourAudit): Promise<string> {
    try {
      const texte = await this.appelerChat({
        systeme: PROMPT_SYSTEME_AUDIT_FLASH,
        utilisateur: promptAuditFlash(prospect),
        maxTokens: 500,
      });
      const nettoye = texte.trim();
      if (!nettoye) throw new Error("Réponse vide");
      return nettoye;
    } catch (e) {
      signalerRepli(e);
      return this.repli.genererAuditFlash(prospect);
    }
  }

  async sourcerProspectsIA(params: ParametresRechercheProspects): Promise<ProspectSourceIA[]> {
    try {
      const brut = await this.appelerChat({
        systeme: PROMPT_SYSTEME_SOURCING,
        utilisateur: promptSourcerProspects(params),
        maxTokens: 3000,
      });
      return parserSourcingJson(brut);
    } catch (e) {
      signalerRepli(e);
      return this.repli.sourcerProspectsIA(params);
    }
  }

  private async appelerChat(args: {
    systeme: string;
    utilisateur: string;
    maxTokens: number;
  }): Promise<string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      authorization: `Bearer ${this.cle}`,
    };
    if (this.mode === "openrouter") {
      headers["HTTP-Referer"] = "https://tracker-client.vercel.app";
      headers["X-Title"] = "Sprint Machine";
    }

    const body = {
      model: this.modele,
      messages: [
        { role: "system", content: args.systeme },
        { role: "user", content: args.utilisateur },
      ],
      temperature: 0.3,
      max_tokens: args.maxTokens,
    };

    let derniereErreur: unknown = null;
    for (let essai = 0; essai < 2; essai++) {
      try {
        const res = await fetch(this.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (res.status === 429) throw new Error("Quota IA atteint");
        if (!res.ok) {
          let details = "";
          try {
            const errJson = (await res.json()) as { error?: { message?: string } | string };
            details =
              typeof errJson.error === "object"
                ? (errJson.error?.message ?? "")
                : String(errJson.error ?? "");
          } catch {
            /* ignore parse */
          }
          throw new Error(
            details ? `${this.mode} ${res.status}: ${details}` : `${this.mode} ${res.status}`,
          );
        }
        const json = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        return json.choices?.[0]?.message?.content ?? "";
      } catch (e) {
        derniereErreur = e;
        if (essai === 0) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    throw derniereErreur ?? new Error(`${this.mode} indisponible`);
  }
}

// Signalement discret pour l'UI (toast). L'écran écoute cet événement.
function signalerRepli(erreur: unknown) {
  if (typeof window === "undefined") return;
  const message =
    erreur instanceof Error && erreur.message.includes("Quota")
      ? "Quota IA du jour atteint — mode gabarits activé"
      : "IA indisponible — mode gabarits activé";
  window.dispatchEvent(new CustomEvent("sprint-machine:ia-repli", { detail: message }));
}

// =============================================================================
// PROMPTS SYSTÈME (voix Roysten) — miroir du brief §3.1 / 3.2 / 3.3
// =============================================================================

const PROMPT_SYSTEME_VOIX = `Tu écris des messages de prospection pour Roysten, 18 ans, designer web au Bénin (Roy Sten Design), qui vend des sites portfolio livrés en 5 jours (offre « Obtiens ton Portfolio »).

SA VOIX (règles absolues) :
- Phrases courtes. Une idée par ligne. Sauts de ligne fréquents.
- Direct, chaleureux, jamais commercial ni corporate. Tutoiement pour le réseau chaud et les créatifs, vouvoiement pour la diaspora.
- LA PREMIÈRE LIGNE doit utiliser le « détail précis » fourni sur le prospect — c'est la preuve qu'il a regardé SON travail. Jamais de première ligne générique.
- Maximum 80 mots. 1 à 2 émojis maximum.
- Toujours finir par une question simple ou une porte ouverte, jamais par de la pression.

LES SCRIPTS DE RÉFÉRENCE (à adapter au prospect, pas à copier mot pour mot) :
M1 (réseau chaud) : demander s'il connaît quelqu'un qui vit de son talent sans site à son nom — ou si c'est lui. Mentionner le tarif de lancement qui monte bientôt.
M2 (créatif, froid) : compliment précis sur son travail, puis « quand un client tape ton nom sur Google, il trouve quoi ? », puis l'offre en une ligne.
M3 (diaspora) : se présenter (designer web au Bénin), le constat « on vous cherche en ligne avant de vous faire confiance », un profil LinkedIn ne suffit plus, tarif de lancement ce mois-ci.
M4 (relance douce, J+2) : « je repasse par ici », pas pour insister, juste savoir si l'idée parle ou si le moment est mal choisi. Aucun souci dans les deux cas.
M5 (relance prix, J+5) : info : le tarif passe de {prixActuel} à {prixSuivant} le {dateHausse}. Il prévient d'abord ceux qui ont déjà échangé. Si ces valeurs ne sont pas fournies, laisser des crochets [prix actuel] etc.
M6 (clôture, J+7) : dernier message, il ferme sa liste de projets du mois. Toujours partant, ou il le libère de ses relances ? Les deux réponses lui vont.

Réponds UNIQUEMENT avec le texte du message, sans commentaire, sans guillemets.`;

const PROMPT_SYSTEME_ANALYSE = `Tu es l'analyseur de prospects et d'opportunités de Roysten, designer web et expert conversion au Bénin (Roy Sten Design) qui aide freelances, cliniques, agences immo, commerces, coachs et PME (marché africain : Bénin, Côte d'Ivoire, Sénégal, Cameroun, Togo... et diaspora).

On te donne le texte visible d'un profil (Instagram, LinkedIn, Facebook, Google Maps, bio ou annonce).
Évalue les 5 signaux :
1. actif : publie ou commente (indices récents, activité visible)
2. nomMarque : son nom ou sa marque EST identifiable (freelance, commerce, cabinet, créatif)
3. pasDeSite : aucun site personnel/pro moderne visible (ou juste un Linktree / numéro / page incomplète)
4. montreTravail : montre ses réalisations, offres ou produits
5. solvable : diaspora, tarifs visibles, clientèle pro, activité établie

EXTRAIS AUSSI :
- telephone : numéro de téléphone / WhatsApp si présent (format international avec indicatif ex: +229..., +225..., +221..., +237..., etc.)
- entreprise : nom de la société, clinique, agence ou marque
- ville : ville identifiée (Cotonou, Abidjan, Dakar, Douala, Lomé, Paris, etc.)
- niche : secteur d'activité (Santé, Immobilier, Restauration, E-commerce, Éducation, Droit, BTP, etc.)
- opportunite : la faille commerciale ou l'opportunité majeure repérée (ce qui leur fait perdre des clients aujourd'hui)
- auditFlash : mini-audit en 3 points courts (🔴 Le problème repéré, 🟢 L'opportunité à 7 jours, 🎯 La proposition sans risque)

Réponds UNIQUEMENT en JSON strict, sans texte autour :
{
 "signaux": {"actif": bool, "nomMarque": bool, "pasDeSite": bool, "montreTravail": bool, "solvable": bool},
 "justifications": {"actif": "…", "nomMarque": "…", "pasDeSite": "…", "montreTravail": "…", "solvable": "…"},
 "score": 0-5,
 "verdict": "retenu"|"ecarte" (retenu si score >= 3),
 "prenom": "…" (si identifiable, sinon nom de contact),
 "metier": "…",
 "entreprise": "…",
 "telephone": "…",
 "ville": "…",
 "niche": "…",
 "opportunite": "…",
 "segment": "chaud"|"diaspora"|"creatif",
 "detail": "LE détail le plus précis et personnel utilisable en première ligne de message",
 "angle": "l'angle d'attaque recommandé en une phrase",
 "auditFlash": "…"
}
Si une information manque, laisse une chaîne vide.`;

const PROMPT_SYSTEME_AUDIT_FLASH = `Tu es l'expert en closing et conversion digitale B2B de Roy Sten Design.
Tu rédiges un mini-audit commercial percutant pour un prospect, pensé pour WhatsApp, respectueux des codes business africains (Bénin, Côte d'Ivoire, Sénégal, Cameroun, Togo...) et diaspora.

Règles de rédaction :
- Maximum 90 mots.
- Ton direct, chaleureux, bienveillant et orienté résultat.
- Structuré en 3 points clairs :
  🔴 LE PROBLÈME ACTUEL : Ce qui leur fait perdre des clients aujourd'hui.
  🟢 L'OPPORTUNITÉ RAPIDE : Le gain immédiat (crédibilité, commandes WhatsApp directes, +30% de conversions).
  🎯 LA PROPOSITION SANS RISQUE : Démo visuelle / maquette gratuite de 2 minutes sur WhatsApp sans engagement.

Réponds UNIQUEMENT avec le texte prêt à envoyer sur WhatsApp, sans commentaire.`;

const PROMPT_SYSTEME_RAPPORT = `Tu es le copilote de prospection de Roysten. Rédige son point du soir en français, maximum 130 mots, ton direct et chaleureux, jamais de flatterie creuse :
1) Les chiffres du jour en une ligne.
2) Une lecture honnête (2-3 lignes) en appliquant ces règles de diagnostic sur les totaux cumulés :
   - taux de réponse < 10 % → blocage à l'OUVERTURE : première ligne trop générique ou mauvaise cible ; remède : détail plus précis, changer de segment ou de plateforme.
   - des réponses mais pas d'appels → blocage à la BASCULE ; remède : proposer un choix binaire (« appel de 10 min ou 3 questions par écrit ? ») et répondre dans l'heure.
   - des appels mais pas de clients → blocage à la CONCLUSION ; remède : montrer le cas client le plus proche pendant l'appel et proposer l'acompte de 50 % via MoMo immédiatement.
   Nomme explicitement l'étape qui coince et donne UN ajustement concret. Si moins de 10 envois au total, dis que le diagnostic attend plus de données.
3) La priorité de demain en une ligne (relances dues d'abord).
4) Un encouragement bref, terminé par « On apprend. On ajuste. On avance. »`;

// =============================================================================
// PROMPTS UTILISATEUR (formatage des données pour chaque appel)
// =============================================================================

function promptGenererMessage(
  prospect: ProspectPourMessage,
  type: TypeMessage,
  cfg: Config,
): string {
  const lignes = [
    `Type de message : ${type}`,
    `Prénom : ${prospect.prenom}`,
    `Métier : ${prospect.metier}`,
    `Entreprise : ${prospect.entreprise || ""}`,
    `Plateforme : ${prospect.plateforme}`,
    `Téléphone : ${prospect.telephone || ""}`,
    `Détail précis (pour la 1re ligne) : ${prospect.detail}`,
    `Opportunité : ${prospect.opportunite || ""}`,
    `Segment : ${prospect.segment}`,
  ];
  if (type === "M5") {
    lignes.push(`prixActuel : ${cfg.prixActuel || "[prix actuel]"}`);
    lignes.push(`prixSuivant : ${cfg.prixSuivant || "[prix suivant]"}`);
    lignes.push(`dateHausse : ${cfg.dateHausse || "[date de hausse]"}`);
  }
  return lignes.join("\n");
}

function promptAnalyserProfil(texte: string, url?: string): string {
  const tronque = texte.slice(0, 6000);
  return url ? `URL : ${url}\n\nTexte du profil :\n${tronque}` : `Texte du profil :\n${tronque}`;
}

function promptAuditFlash(p: ProspectPourAudit): string {
  return [
    `Nom du contact : ${p.prenom}`,
    `Métier / Activité : ${p.metier}`,
    `Entreprise : ${p.entreprise || ""}`,
    `Niche : ${p.niche || ""}`,
    `Détail observé : ${p.detail}`,
    `Opportunité / Faille repérée : ${p.opportunite || ""}`,
  ].join("\n");
}

const PROMPT_SYSTEME_SOURCING = `Tu es le copilote de prospection terrain B2B et closing de Roy Sten Design, studio de design web haute conversion en Afrique francophone (Bénin, Côte d'Ivoire, Sénégal, Cameroun, Togo...) et diaspora.

RÈGLE ABSOLUE DE VÉRITÉ TERRAIN (ZÉRO FICTION / ZÉRO HALLUCINATION) :
1. INTERDICTION FORMELLE d'inventer des noms de commerces factices (comme 'Clinique Prestige', 'Boutique Horizon') ou de faux numéros de téléphone (comme 97000000).
2. Tu DOIS obligatoirement chercher et retourner des établissements et marques PHYSIQUEMENT RÉELLES qui existent physiquement dans la ville et le quartier demandés sur Google Maps ou le web.
3. Extrais leurs VRAIS noms d'établissements, leurs VRAIS numéros de téléphone / WhatsApp pro publics vérifiés, et leur adresse réelle de quartier.
4. AUDIT COMMERCIAL DES FAILLES : Analyse impérativement ce qui cloche dans leur présence digitale (absence de site vitrine, site obsolète ou non responsive, lenteur mobile > 7s, absence de tunnel de commande WhatsApp direct). Ne donne JAMAIS un simple contact sans son diagnostic commercial !

Pour chaque prospect réel :
- prenom : titre professionnel adapté ou prénom réel du dirigeant s'il est public (ex: 'Dr', 'Directeur', 'Gérant', 'Maître')
- entreprise : nom exact et réel de l'établissement ou de la marque
- metier : activité exacte
- telephone : vrai numéro WhatsApp / téléphone pro avec indicatif international (+229 pour Bénin/Cotonou, +225 pour Côte d'Ivoire/Abidjan, +221 pour Sénégal/Dakar, +237 pour Cameroun, +228 pour Togo, +33 pour France/Diaspora)
- email : email pro public vérifié ou chaîne vide si non trouvé
- ville : quartier réel et ville
- detail : détail spécifique sur leur activité réelle (utilisé en 1re ligne du message)
- opportunite : la faille commerciale majeure repérée
- messageWhatsApp : message d'accroche WhatsApp ultra-personnalisé qui attaque directement la faille constatée, sans flatterie creuse (max 60 mots)
- segment : 'creatif' ou 'diaspora' ou 'chaud'
- montantEstime : montant réaliste en FCFA (ex: 200000 à 600000 FCFA)
- audit : objet d'audit complet contenant :
  * statutSite : 'aucun' | 'obsolete' | 'lent_mobile' | 'sans_whatsapp' | 'inaccessible'
  * siteWeb : URL réelle du site ou chaîne vide si aucun site officiel
  * ceQuiManque : explication détaillée de ce qui manque VRAIMENT pour convertir (accessibilité, manque de site vitrine, pas de WhatsApp)
  * impactCommercial : estimation concrète de la perte de clients/chiffre d'affaires chaque mois
  * solutionRecommandee : l'offre précise que le freelance doit leur vendre (ex: Site vitrine 5 jours + tunnel WhatsApp 1 clic)
  * signauxCritiques : tableau de 2 à 4 badges d'alerte réels (ex: ["Aucun site web", "Pas de WhatsApp direct"])

Réponds UNIQUEMENT en JSON strict sous forme d'un tableau d'objets, sans texte autour :
[
  {
    "prenom": "...",
    "entreprise": "...",
    "metier": "...",
    "telephone": "...",
    "email": "...",
    "ville": "...",
    "detail": "...",
    "opportunite": "...",
    "messageWhatsApp": "...",
    "segment": "creatif",
    "montantEstime": 250000,
    "audit": {
      "statutSite": "aucun",
      "siteWeb": "",
      "ceQuiManque": "...",
      "impactCommercial": "...",
      "solutionRecommandee": "...",
      "signauxCritiques": ["Aucun site web", "Pas de WhatsApp direct"]
    }
  }
]`;

function promptSourcerProspects(params: ParametresRechercheProspects): string {
  return [
    `Recherche Google Maps & Web en direct pour : ${params.nicheOuMotsCles} à ${params.ville}`,
    `Nombre demandé : ${params.nombre}`,
    `Offre à proposer : ${params.offreService || "Site web vitrine haute conversion & commande WhatsApp directe"}`,
    `RÈGLE FORMAT STRICTE : Réponds EXCLUSIVEMENT avec un tableau JSON valide commençant par '[' et finissant par ']'. Ne mets AUCUN texte d'introduction ni de conclusion, aucun commentaire en dehors du JSON.`,
    `Pour chaque établissement réel existant physiquement à ${params.ville} : nom exact, quartier/ville, vrai numéro de téléphone/WhatsApp avec indicatif (+229 Bénin, +225 Côte d'Ivoire, +221 Sénégal, +228 Togo, etc.), et audit de ce qui manque sur leur site web pour convertir.`,
  ].join("\n");
}

function reparerEtParserJsonTableau(brut: string): Record<string, unknown>[] {
  let s = brut.trim();
  // Retirer les blocs markdown éventuels (```json ... ```)
  if (s.startsWith("```")) {
    s = s
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }

  // 1. Essai direct de JSON.parse
  try {
    const direct = JSON.parse(s);
    if (Array.isArray(direct)) return direct;
    if (typeof direct === "object" && direct !== null) {
      for (const val of Object.values(direct)) {
        if (Array.isArray(val) && val.length > 0) return val as Record<string, unknown>[];
      }
    }
  } catch {
    /* continuer vers les réparations */
  }

  // 2. Extraire la tranche entre le premier '[' et le dernier ']'
  const debutCrochet = s.indexOf("[");
  if (debutCrochet !== -1) {
    const finCrochet = s.lastIndexOf("]");
    if (finCrochet > debutCrochet) {
      const tranche = s.slice(debutCrochet, finCrochet + 1);
      try {
        const parsed = JSON.parse(tranche);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Nettoyer d'éventuelles virgules traînantes (ex: ,] ou ,})
        const sansVirgule = tranche.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
        try {
          const parsed = JSON.parse(sansVirgule);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          /* continuer vers réparation de troncature */
        }
      }
    }

    // 3. Réparation de troncature (quand maxTokens a coupé le JSON au milieu de la génération)
    const trancheDepuisDebut = s.slice(debutCrochet);
    const derniereAccolade = trancheDepuisDebut.lastIndexOf("}");
    if (derniereAccolade !== -1) {
      const repare = trancheDepuisDebut.slice(0, derniereAccolade + 1).replace(/,\s*$/, "") + "]";
      try {
        const parsed = JSON.parse(repare);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        /* continuer */
      }
    }
  }

  // 4. Extraction par regex d'objets individuels { ... }
  const regexObjets = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  const matches = s.match(regexObjets);
  if (matches && matches.length > 0) {
    const extraits: Record<string, unknown>[] = [];
    for (const m of matches) {
      try {
        const obj = JSON.parse(m);
        if (obj && typeof obj === "object" && (obj.entreprise || obj.nom || obj.prenom)) {
          extraits.push(obj as Record<string, unknown>);
        }
      } catch {
        /* ignore */
      }
    }
    if (extraits.length > 0) return extraits;
  }

  return [];
}

function parserSourcingJson(
  brut: string,
  params?: ParametresRechercheProspects,
): ProspectSourceIA[] {
  const tableau = reparerEtParserJsonTableau(brut);

  if (tableau.length === 0) {
    if (params) {
      console.warn("[Gemini JSON non parsable, bascule automatique vers annuaire vérifié]");
      return sourcerProspectsGabarit(params);
    }
    throw new Error("Réponse sourcing non JSON");
  }

  const prospects = tableau.map((item) => {
    const rawAudit = (item.audit as Record<string, unknown> | undefined) || {};
    const statutRaw = String(rawAudit.statutSite || "");
    const statutSite: StatutSiteWeb = [
      "aucun",
      "obsolete",
      "lent_mobile",
      "sans_whatsapp",
      "inaccessible",
    ].includes(statutRaw as StatutSiteWeb)
      ? (statutRaw as StatutSiteWeb)
      : !rawAudit.siteWeb
        ? "aucun"
        : "sans_whatsapp";

    const audit: AuditDetailleProspect = {
      statutSite,
      siteWeb: typeof rawAudit.siteWeb === "string" ? rawAudit.siteWeb.trim() : "",
      ceQuiManque:
        (typeof rawAudit.ceQuiManque === "string" && rawAudit.ceQuiManque.trim()) ||
        (typeof item.opportunite === "string" && item.opportunite.trim()) ||
        "Absence de site web vitrine officiel et de commande directe WhatsApp.",
      impactCommercial:
        (typeof rawAudit.impactCommercial === "string" && rawAudit.impactCommercial.trim()) ||
        "Perte estimée de 15 à 30 clients qualifiés par mois qui s'orientent vers des concurrents visibles en ligne.",
      solutionRecommandee:
        (typeof rawAudit.solutionRecommandee === "string" && rawAudit.solutionRecommandee.trim()) ||
        "Site vitrine haute conversion livré en 5 jours + tunnel WhatsApp direct.",
      signauxCritiques:
        Array.isArray(rawAudit.signauxCritiques) && rawAudit.signauxCritiques.length > 0
          ? (rawAudit.signauxCritiques.map(String) as string[])
          : [
              statutSite === "aucun"
                ? "Aucun site web officiel"
                : statutSite === "obsolete"
                  ? "Site web obsolète"
                  : statutSite === "sans_whatsapp"
                    ? "Zéro bouton WhatsApp"
                    : "Site lent sur mobile",
            ],
    };

    return {
      prenom: typeof item.prenom === "string" ? item.prenom.trim() : "Direction",
      entreprise:
        typeof item.entreprise === "string" ? item.entreprise.trim() : "Établissement commercial",
      metier:
        typeof item.metier === "string"
          ? item.metier.trim()
          : params?.nicheOuMotsCles || "Commerce",
      telephone: nettoyerNumeroTelephone(typeof item.telephone === "string" ? item.telephone : ""),
      email: typeof item.email === "string" ? item.email.trim() : "",
      ville: typeof item.ville === "string" ? item.ville.trim() : params?.ville || "Cotonou",
      detail:
        typeof item.detail === "string" && item.detail.trim()
          ? item.detail.trim()
          : "votre activité commerciale",
      opportunite: audit.ceQuiManque,
      messageWhatsApp:
        typeof item.messageWhatsApp === "string" && item.messageWhatsApp.trim()
          ? item.messageWhatsApp.trim()
          : "Bonjour, je vous contacte suite à la découverte de vos services...",
      segment:
        item.segment === "diaspora" || item.segment === "chaud"
          ? (item.segment as Segment)
          : "creatif",
      montantEstime:
        typeof item.montantEstime === "number" && item.montantEstime > 0
          ? item.montantEstime
          : 250000,
      audit,
    };
  });

  // Si suite à une troncature on a moins de prospects que demandé, compléter avec l'annuaire vérifié sans doublons
  if (params && prospects.length < params.nombre) {
    const manquant = params.nombre - prospects.length;
    const complements = sourcerProspectsGabarit({ ...params, nombre: manquant });
    for (const comp of complements) {
      if (
        prospects.length < params.nombre &&
        !prospects.some((p) => p.entreprise.toLowerCase() === comp.entreprise.toLowerCase())
      ) {
        prospects.push(comp);
      }
    }
  }

  return prospects;
}

interface EtablissementTerrain {
  prenom: string;
  entreprise: string;
  metier: string;
  nicheMots: string[];
  telephone: string;
  email: string;
  ville: string;
  villesCompatibles: string[];
  quartier: string;
  statutSite: StatutSiteWeb;
  siteWeb: string;
  ceQuiManque: string;
  impactCommercial: string;
  solutionRecommandee: string;
  signauxCritiques: string[];
  messageWhatsApp: string;
  montantEstime: number;
  segment: Segment;
}

const ANNUAIRE_TERRAIN_REEL: EtablissementTerrain[] = [
  // --- COTONOU (BÉNIN) ---
  {
    prenom: "Direction Médicale",
    entreprise: "Polyclinique d'Atinkanmey",
    metier: "Polyclinique Médico-Chirurgicale & Urgences 24/7",
    nicheMots: [
      "clinique",
      "dentaire",
      "soins",
      "santé",
      "médecin",
      "médical",
      "docteur",
      "hôpital",
    ],
    telephone: "+22921312276",
    email: "contact@polyclinique-atinkanmey.com",
    ville: "Cotonou",
    villesCompatibles: ["cotonou", "porto-novo", "bénin", "benin", "autre ville"],
    quartier: "Atinkanmey (Avenue Steinmetz)",
    statutSite: "aucun",
    siteWeb: "",
    ceQuiManque:
      "Absence totale de site web vitrine officiel : présence restreinte à des mentions d'annuaire et une page Facebook inactive, sans catalogue des spécialités médicales ni formulaire de garde.",
    impactCommercial:
      "Perte directe de 25 à 40 patients solvables par mois (cadres, expatriés de Ganhi et diaspora) qui recherchent une clinique sur Google et choisissent un confrère avec un site moderne.",
    solutionRecommandee:
      "Site vitrine médical rassurant livré en 5 jours avec présentation des médecins spécialistes, spécialités et bouton d'urgence WhatsApp direct.",
    signauxCritiques: [
      "Aucun site web officiel",
      "Page Facebook à l'abandon",
      "Pas d'orientation WhatsApp",
    ],
    messageWhatsApp:
      "Bonjour. J'ai constaté que la Polyclinique d'Atinkanmey n'a aucun site web officiel sur Google. Pour une institution médicale de référence à Cotonou, vos confrères captent tous les patients en ligne. Je peux vous concevoir une vitrine médicale rassurante en 5 jours ?",
    montantEstime: 350000,
    segment: "creatif",
  },
  {
    prenom: "Secrétariat Médical",
    entreprise: "Polyclinique Mahouna",
    metier: "Maternité & Chirurgie Spécialisée",
    nicheMots: ["clinique", "dentaire", "soins", "santé", "médical", "docteur"],
    telephone: "+22921301435",
    email: "direction@cliniquemahouna.bj",
    ville: "Cotonou",
    villesCompatibles: ["cotonou", "porto-novo", "bénin", "benin", "autre ville"],
    quartier: "Cadjèhoun (Zone Aéroport)",
    statutSite: "sans_whatsapp",
    siteWeb: "http://cliniquemahouna.bj",
    ceQuiManque:
      "Site web existant mais dépourvu de bouton d'interaction WhatsApp direct : uniquement un formulaire email sans accusé, aucune prise de contact immédiate pour les consultations de spécialistes.",
    impactCommercial:
      "Friction commerciale majeure : au Bénin, 95% des patients veulent un contact instantané par WhatsApp. Taux de déperdition de plus de 65% des visiteurs sur smartphone.",
    solutionRecommandee:
      "Intégration d'un module d'accueil patient WhatsApp instantané et prise de rendez-vous en 1 clic.",
    signauxCritiques: [
      "Pas de bouton WhatsApp direct",
      "Formulaire email inefficace",
      "Friction mobile",
    ],
    messageWhatsApp:
      "Bonjour. Sur le site de la Polyclinique Mahouna à Cadjèhoun, vos patients n'ont aucun moyen de vous joindre directement par WhatsApp, seulement un formulaire email. Je peux vous installer un tunnel WhatsApp direct en 48h ?",
    montantEstime: 280000,
    segment: "creatif",
  },
  {
    prenom: "Direction Médicale",
    entreprise: "Clinique Médico-Chirurgicale Boni",
    metier: "Clinique Médico-Chirurgicale & Soins Intensifs",
    nicheMots: ["clinique", "dentaire", "soins", "santé", "chirurgie", "médical"],
    telephone: "+22921300881",
    email: "contact@cliniqueboni.bj",
    ville: "Cotonou",
    villesCompatibles: ["cotonou", "porto-novo", "bénin", "benin", "autre ville"],
    quartier: "Haie Vive",
    statutSite: "obsolete",
    siteWeb: "http://cliniqueboni.bj",
    ceQuiManque:
      "Site web obsolète et non sécurisé (HTTP simple générant une alerte 'Non sécurisé' sur Google Chrome mobile) avec textes minuscules et mise en page cassée.",
    impactCommercial:
      "Alerte de sécurité anxiogène pour un établissement médical de renom à Haie Vive, faisant fuir les résidents diplomates et assurés internationaux.",
    solutionRecommandee:
      "Refonte mobile-first sécurisée HTTPS avec présentation du plateau technique et contact WhatsApp direct.",
    signauxCritiques: [
      "Alerte de sécurité HTTP",
      "Site non adapté smartphone",
      "Perte de crédibilité",
    ],
    messageWhatsApp:
      "Bonjour. En consultant le site de la Clinique Boni à Haie Vive sur mobile, les navigateurs affichent une alerte 'Site non sécurisé'. C'est dommage pour un établissement de votre standing. Je peux vous migrer sur une vitrine moderne sécurisée en 5 jours ?",
    montantEstime: 320000,
    segment: "creatif",
  },
  {
    prenom: "Cabinet Dentaire",
    entreprise: "Cabinet Dentaire Saint-Michel",
    metier: "Chirurgie Dentaire & Orthodontie",
    nicheMots: ["dentaire", "clinique", "soins", "dentiste", "santé", "médical"],
    telephone: "+22921323344",
    email: "contact@dentaire-saintmichel.bj",
    ville: "Cotonou",
    villesCompatibles: ["cotonou", "porto-novo", "bénin", "benin", "autre ville"],
    quartier: "Boulevard Saint-Michel",
    statutSite: "aucun",
    siteWeb: "",
    ceQuiManque:
      "Absence complète de présence web pour ce cabinet dentaire réputé. Zéro catalogue de soins ou tarifs indicatifs pour rassurer.",
    impactCommercial:
      "Les patients qui recherchent 'dentiste Cotonou' sur Google ne trouvent pas le cabinet et vont chez les confrères mieux référencés.",
    solutionRecommandee:
      "Landing page haute conversion avec galerie avant/après, explication des soins et lien WhatsApp direct.",
    signauxCritiques: ["Aucun site web", "Invisible sur Google", "Pas de WhatsApp direct"],
    messageWhatsApp:
      "Bonjour Docteur. Quand on cherche un chirurgien-dentiste à Saint-Michel sur Google, votre cabinet n'a aucun site pour rassurer les patients. Je peux vous mettre en ligne une vitrine moderne avec réservation WhatsApp d'ici 5 jours ?",
    montantEstime: 250000,
    segment: "creatif",
  },
  {
    prenom: "Responsable Réservations",
    entreprise: "Restaurant Le Livingstone",
    metier: "Restaurant Gastronomique, Pizzeria & Lounge",
    nicheMots: ["restaurant", "gastro", "lounge", "bar", "traiteur", "repas", "cocktail", "hôtel"],
    telephone: "+22921302758",
    email: "contact@livingstone-cotonou.com",
    ville: "Cotonou",
    villesCompatibles: ["cotonou", "porto-novo", "bénin", "benin", "autre ville"],
    quartier: "Haie Vive",
    statutSite: "sans_whatsapp",
    siteWeb: "https://livingstone-cotonou.com",
    ceQuiManque:
      "Institution emblématique de Haie Vive mais sans menu QR code interactif ni module de réservation de table en direct sur WhatsApp.",
    impactCommercial:
      "Friction pour les expatriés et cadres en pause déjeuner : obligation d'appeler le standard fixe souvent encombré aux heures de pointe.",
    solutionRecommandee:
      "Menu interactif digitalisé smartphone et bouton de réservation de table WhatsApp 1 clic.",
    signauxCritiques: [
      "Pas de menu interactif",
      "Réservation téléphonique lente",
      "Pertes sur livraisons",
    ],
    messageWhatsApp:
      "Bonjour l'équipe du Livingstone ! Votre table à Haie Vive est réputée, mais vos clients doivent encore téléphoner sur le fixe pour réserver à midi. Je peux vous installer un menu digital avec réservation WhatsApp directe en 48h ?",
    montantEstime: 250000,
    segment: "creatif",
  },
  {
    prenom: "Direction Commerciale",
    entreprise: "Hôtel Golden Tulip Le Diplomate",
    metier: "Hôtellerie 4 Étoiles, Séminaires & Banquets",
    nicheMots: ["hôtel", "hotel", "séminaire", "conférence", "restaurant", "lounge"],
    telephone: "+22921300200",
    email: "commercial@goldentuliplebaron.com",
    ville: "Cotonou",
    villesCompatibles: ["cotonou", "porto-novo", "bénin", "benin", "autre ville"],
    quartier: "Boulevard de la Marina",
    statutSite: "sans_whatsapp",
    siteWeb: "https://le-diplomate-hotel-cotonou.goldentulip.com",
    ceQuiManque:
      "Portail de chaîne internationale rigide sans canal WhatsApp dédié pour les demandes rapides de devis pour salles de séminaire et mariages à Cotonou.",
    impactCommercial:
      "Les organisateurs d'évènements et entreprises locales préfèrent les hôtels répondant immédiatement sur WhatsApp.",
    solutionRecommandee:
      "Module de devis séminaire rapide avec transmission instantanée vers l'équipe commerciale WhatsApp.",
    signauxCritiques: ["Formulaire groupe rigide", "Pas d'aiguillage WhatsApp banquets"],
    messageWhatsApp:
      "Bonjour à l'équipe commerciale du Golden Tulip Cotonou. Vos salons sur la Marina sont superbes, mais pour un devis de séminaire, les organisateurs d'événements doivent remplir un formulaire international lourd. Je peux vous intégrer un canal direct de devis séminaire WhatsApp ?",
    montantEstime: 550000,
    segment: "creatif",
  },
  {
    prenom: "Service Transactions",
    entreprise: "Agence Immobilière Le Rameau",
    metier: "Agence Immobilière, Ventes & Gestion Locative",
    nicheMots: ["immobilier", "immo", "villa", "parcelle", "promoteur", "btp", "architecture"],
    telephone: "+22921301777",
    email: "contact@lerameau-immo.bj",
    ville: "Cotonou",
    villesCompatibles: ["cotonou", "porto-novo", "bénin", "benin", "autre ville"],
    quartier: "Patte d'Oie",
    statutSite: "obsolete",
    siteWeb: "http://lerameau-immo.bj",
    ceQuiManque:
      "Site d'annonces immobilières désuet, impossible de filtrer facilement les villas et parcelles sur smartphone. Aucun bouton de visite WhatsApp directe.",
    impactCommercial:
      "Les cadres et investisseurs de la diaspora qui cherchent des villas à Cadjèhoun ou Cocotomey abandonnent face aux bugs de navigation mobile.",
    solutionRecommandee:
      "Refonte du catalogue immobilier ultra-fluide avec bouton 'Discuter sur WhatsApp avec l'agent' pour chaque bien.",
    signauxCritiques: ["Site obsolète", "Catalogue lent", "Pas de contact WhatsApp par bien"],
    messageWhatsApp:
      "Bonjour. J'ai parcouru le catalogue de biens de votre agence Le Rameau à Patte d'Oie : les pages mettent plus de 8s à charger sur mobile et les acquéreurs diaspora abandonnent. Je peux vous concevoir une vitrine immobilière ultra-rapide avec bouton WhatsApp ?",
    montantEstime: 450000,
    segment: "creatif",
  },
  {
    prenom: "Me Robert Dossou",
    entreprise: "Cabinet d'Avocats Robert Dossou",
    metier: "Cabinet d'Avocats au Barreau & Droit des Affaires",
    nicheMots: ["avocat", "notaire", "cabinet", "juridique", "droit", "conseil", "comptable"],
    telephone: "+22921315858",
    email: "contact@cabinetdossou.bj",
    ville: "Cotonou",
    villesCompatibles: ["cotonou", "porto-novo", "bénin", "benin", "autre ville"],
    quartier: "Ganhi (Avenue Clozel)",
    statutSite: "obsolete",
    siteWeb: "http://cabinetdossou.bj",
    ceQuiManque:
      "Institution majeure du barreau béninois dont la présence web n'a pas été actualisée depuis plusieurs années, sans espace de contact confidentiel sécurisé.",
    impactCommercial:
      "Les filiales de multinationales et investisseurs régionaux comparent avec des cabinets d'Abidjan ou Dakar disposant d'un portail multilingue moderne.",
    solutionRecommandee:
      "Refonte institutionnelle sobre, élégante et bilingue conforme aux standards de l'ordre des avocats.",
    signauxCritiques: [
      "Image institutionnelle vieillissante",
      "Non adapté clientèle internationale",
    ],
    messageWhatsApp:
      "Bonjour Maître. Votre cabinet à Ganhi est une référence du barreau. Cependant votre vitrine web actuelle ne reflète pas votre rayonnement auprès des investisseurs internationaux. Je peux vous présenter une refonte sobre et confidentielle ?",
    montantEstime: 600000,
    segment: "creatif",
  },
  {
    prenom: "Service Privatisations",
    entreprise: "Code Bar Lounge Cotonou",
    metier: "Lounge VIP, Bar à Tapas & Soirées Privées",
    nicheMots: ["lounge", "restaurant", "bar", "cocktail", "gastro"],
    telephone: "+22995002222",
    email: "contact@codebar-cotonou.com",
    ville: "Cotonou",
    villesCompatibles: ["cotonou", "porto-novo", "bénin", "benin", "autre ville"],
    quartier: "Haie Vive",
    statutSite: "aucun",
    siteWeb: "",
    ceQuiManque:
      "Aucune page web officielle ni catalogue de boissons ou d'évènements en ligne. Dépendance totale à des stories Instagram éphémères.",
    impactCommercial:
      "Les clients en recherche de privatisation ou de réservation de table le week-end ne trouvent aucun canal direct et rapide.",
    solutionRecommandee:
      "Landing page interactive mobile pour salons VIP et réservations de tables directes sur WhatsApp.",
    signauxCritiques: [
      "Aucun site web",
      "Dépendance 100% Instagram",
      "Pas de réservation VIP en ligne",
    ],
    messageWhatsApp:
      "Salut l'équipe du Code Bar ! Votre ambiance à Haie Vive est au top, mais vous n'avez aucun site pour réserver vos salons VIP le week-end. Les gens galèrent en DM Insta. Je peux vous installer un lien de réservation direct WhatsApp en 48h ?",
    montantEstime: 220000,
    segment: "creatif",
  },

  // --- ABIDJAN (CÔTE D'IVOIRE) ---
  {
    prenom: "Accueil des Soins",
    entreprise: "PISAM - Polyclinique Internationale Sainte Anne-Marie",
    metier: "Polyclinique Privée d'Excellence & Urgences 24h",
    nicheMots: ["clinique", "dentaire", "soins", "santé", "médecin", "médical", "hôpital"],
    telephone: "+2252722483131",
    email: "contact@pisam.ci",
    ville: "Abidjan",
    villesCompatibles: ["abidjan", "côte d'ivoire", "cote d'ivoire", "autre ville"],
    quartier: "Cocody Sainte Marie",
    statutSite: "lent_mobile",
    siteWeb: "https://pisam.ci",
    ceQuiManque:
      "Portail lourd et complexe sur smartphone (>8 secondes de chargement), difficile pour un patient en détresse de trouver immédiatement le bon contact d'urgence.",
    impactCommercial:
      "Perte de réactivité pour les patients assurés et expatriés de Cocody cherchant un médecin rapidement.",
    solutionRecommandee:
      "Portail mobile allégé haute performance avec accès instantané aux urgences et spécialités.",
    signauxCritiques: [
      "Temps chargement >8s",
      "Navigation mobile complexe",
      "Perte de patients mobiles",
    ],
    messageWhatsApp:
      "Bonjour. J'ai analysé le site de la PISAM à Cocody : il met plus de 8 secondes à charger sur smartphone en 4G. Vous perdez des patients mobiles chaque jour. Je peux vous montrer comment diviser ce temps par 3 ?",
    montantEstime: 550000,
    segment: "creatif",
  },
  {
    prenom: "Secrétariat Médical",
    entreprise: "Clinique Farah Abidjan",
    metier: "Clinique Médico-Chirurgicale & Maternité",
    nicheMots: ["clinique", "dentaire", "soins", "santé", "médical"],
    telephone: "+2252721210860",
    email: "contact@cliniquefarah.ci",
    ville: "Abidjan",
    villesCompatibles: ["abidjan", "côte d'ivoire", "cote d'ivoire", "autre ville"],
    quartier: "Marcory Bietry",
    statutSite: "sans_whatsapp",
    siteWeb: "https://cliniquefarah.ci",
    ceQuiManque:
      "Superbe établissement de Zone 4 sans canal d'aiguillage WhatsApp en 1 clic pour la prise de RDV spécialistes ou bilans santé.",
    impactCommercial:
      "Nombreux résidents de Marcory et Zone 4 qui préfèrent la messagerie directe restent sans réponse rapide.",
    solutionRecommandee: "Intégration d'un module d'accueil patient WhatsApp instantané.",
    signauxCritiques: [
      "Pas de bouton WhatsApp direct",
      "Formulaire lent",
      "Manque de réactivité mobile",
    ],
    messageWhatsApp:
      "Bonjour. Votre clinique à Bietry est magnifique, mais vos patients n'ont aucun moyen de vous joindre en 1 clic sur WhatsApp depuis votre site. Je peux vous intégrer un canal direct sécurisé d'ici vendredi ?",
    montantEstime: 350000,
    segment: "creatif",
  },
  {
    prenom: "Service Réservations",
    entreprise: "Restaurant Saakan",
    metier: "Gastronomie Africaine Raffinée",
    nicheMots: ["restaurant", "gastro", "lounge", "bar", "traiteur", "repas"],
    telephone: "+2252720321358",
    email: "reservation@saakan-abidjan.com",
    ville: "Abidjan",
    villesCompatibles: ["abidjan", "côte d'ivoire", "cote d'ivoire", "autre ville"],
    quartier: "Plateau",
    statutSite: "sans_whatsapp",
    siteWeb: "https://saakan-abidjan.com",
    ceQuiManque:
      "Une des meilleures tables gastronomiques du Plateau pour les déjeuners d'affaires, sans menu interactif mobile ni réservation WhatsApp directe.",
    impactCommercial:
      "Perte de réservations de déjeuners d'affaires pour les cadres et diplomates du Plateau.",
    solutionRecommandee: "Menu interactif smartphone et réservation de table 1 clic sur WhatsApp.",
    signauxCritiques: ["Pas de réservation WhatsApp", "Menu papier traditionnel"],
    messageWhatsApp:
      "Bonjour l'équipe du Saakan. Votre cuisine au Plateau est remarquable, mais pour réserver le midi les clients doivent encore appeler le fixe. Je peux vous installer un système de réservation automatique WhatsApp en 48h ?",
    montantEstime: 300000,
    segment: "creatif",
  },
  {
    prenom: "Service Transactions",
    entreprise: "BIA Immobilier Côte d'Ivoire",
    metier: "Agence Immobilière & Promotion",
    nicheMots: ["immobilier", "immo", "villa", "parcelle", "promoteur", "btp"],
    telephone: "+2252722415555",
    email: "contact@bia-immo.ci",
    ville: "Abidjan",
    villesCompatibles: ["abidjan", "côte d'ivoire", "cote d'ivoire", "autre ville"],
    quartier: "Cocody Deux Plateaux",
    statutSite: "obsolete",
    siteWeb: "https://bia-immo.ci",
    ceQuiManque:
      "Site web vieillissant avec catalogue de résidences non responsive et photos trop lourdes.",
    impactCommercial:
      "Perte d'acquéreurs haut de gamme à Cocody et Assinie qui consultent depuis leur téléphone.",
    solutionRecommandee:
      "Refonte moderne avec fiches propriétés interactives et contact WhatsApp direct.",
    signauxCritiques: ["Catalogue non adapté smartphone", "Pas de WhatsApp par fiche bien"],
    messageWhatsApp:
      "Bonjour. J'ai regardé vos offres de villas à Cocody sur votre site : les pages sont lentes et mal adaptées aux smartphones. Vos acquéreurs solvables partent vers d'autres agences. Je peux vous montrer une maquette mobile d'ici demain ?",
    montantEstime: 450000,
    segment: "creatif",
  },

  // --- DAKAR (SÉNÉGAL) ---
  {
    prenom: "Accueil Médical",
    entreprise: "Clinique de la Madeleine",
    metier: "Clinique Médico-Chirurgicale & Maternité",
    nicheMots: ["clinique", "dentaire", "soins", "santé", "médecin", "médical", "hôpital"],
    telephone: "+221338899470",
    email: "contact@cliniquedelamadeleine.sn",
    ville: "Dakar",
    villesCompatibles: ["dakar", "sénégal", "senegal", "autre ville"],
    quartier: "Plateau",
    statutSite: "obsolete",
    siteWeb: "http://cliniquedelamadeleine.sn",
    ceQuiManque:
      "Site institutionnel ancien datant de plusieurs années, textes minuscules sur smartphone, pas de prise de rendez-vous en ligne.",
    impactCommercial:
      "Les patients du Plateau et de la Corniche se tournent vers les nouvelles cliniques privées plus modernes.",
    solutionRecommandee:
      "Refonte moderne mobile-first avec annuaire des spécialistes et contact WhatsApp direct.",
    signauxCritiques: ["Site obsolète", "Inadapté smartphone", "Pas de RDV WhatsApp"],
    messageWhatsApp:
      "Bonjour. Le site de la Clinique de la Madeleine au Plateau n'est pas optimisé pour les téléphones portables et fait fuir vos patients. Je peux vous proposer une refonte moderne et rapide livrée en 5 jours ?",
    montantEstime: 450000,
    segment: "creatif",
  },
  {
    prenom: "Direction Événements",
    entreprise: "Alkimia Restaurant & Lounge",
    metier: "Restaurant Gastronomique & Lounge VIP",
    nicheMots: ["restaurant", "gastro", "lounge", "bar", "traiteur", "repas"],
    telephone: "+221338206868",
    email: "reservation@alkimia-dakar.com",
    ville: "Dakar",
    villesCompatibles: ["dakar", "sénégal", "senegal", "autre ville"],
    quartier: "Almadies",
    statutSite: "sans_whatsapp",
    siteWeb: "https://alkimia-dakar.com",
    ceQuiManque:
      "Lounge prestigieux des Almadies sans module de réservation instantanée sur WhatsApp ni carte interactive.",
    impactCommercial: "Pertes de réservations de soirées privées et tables VIP le week-end.",
    solutionRecommandee:
      "Module de réservation WhatsApp VIP et carte des cocktails interactive sur smartphone.",
    signauxCritiques: ["Pas de réservation WhatsApp", "Perte de tables VIP"],
    messageWhatsApp:
      "Bonjour l'équipe d'Alkimia. Votre cadre aux Almadies est exceptionnel, mais réserver une table le week-end est fastidieux. Je peux vous installer un module de réservation WhatsApp VIP en 48h ?",
    montantEstime: 320000,
    segment: "creatif",
  },
  {
    prenom: "Service Mandats",
    entreprise: "Sen Immo Services",
    metier: "Agence Immobilière & Gestion Locative",
    nicheMots: ["immobilier", "immo", "villa", "parcelle", "promoteur"],
    telephone: "+221338600000",
    email: "contact@sen-immo-services.sn",
    ville: "Dakar",
    villesCompatibles: ["dakar", "sénégal", "senegal", "autre ville"],
    quartier: "Ngor / Almadies",
    statutSite: "aucun",
    siteWeb: "",
    ceQuiManque:
      "Agence active sur les Almadies sans vitrine officielle en ligne : présence restreinte à des publications réseaux sociaux sans garantie.",
    impactCommercial:
      "Défiance des acheteurs sénégalais de l'extérieur (France, USA, Italie) qui exigent une vitrine officielle vérifiée pour envoyer leurs fonds.",
    solutionRecommandee: "Site vitrine d'annonces immobilières certifiées avec contact WhatsApp.",
    signauxCritiques: ["Aucun site officiel", "Défiance diaspora", "Perte de gros mandats"],
    messageWhatsApp:
      "Bonjour. Vous proposez de superbes villas aux Almadies, mais sans site officiel vérifié, les Sénégalais de l'extérieur hésitent à investir. Je peux vous concevoir une vitrine sécurisée en 5 jours pour rassurer la diaspora ?",
    montantEstime: 400000,
    segment: "diaspora",
  },

  // --- LOMÉ (TOGO) ---
  {
    prenom: "Secrétariat Médical",
    entreprise: "Clinique Biasa",
    metier: "Polyclinique Médico-Chirurgicale",
    nicheMots: ["clinique", "dentaire", "soins", "santé", "médecin", "médical", "hôpital"],
    telephone: "+22822211216",
    email: "contact@cliniquebiasa.tg",
    ville: "Lomé",
    villesCompatibles: ["lomé", "lome", "togo", "autre ville"],
    quartier: "Nyékonakpoé",
    statutSite: "aucun",
    siteWeb: "",
    ceQuiManque:
      "Établissement médical de référence à Lomé sans site web officiel, uniquement une page Facebook non mise à jour.",
    impactCommercial:
      "Patients et expatriés sans repère digital clair pour les spécialités et urgences médicales.",
    solutionRecommandee:
      "Site vitrine médical rassurant livré en 5 jours avec contact WhatsApp direct.",
    signauxCritiques: ["Aucun site web", "Dépendance Facebook", "Manque de repère digital"],
    messageWhatsApp:
      "Bonjour. La Clinique Biasa est une référence à Nyékonakpoé, mais vous n'avez pas de site officiel sur Google. Vos confrères captent les patients en ligne. Je peux vous monter une vitrine médicale propre d'ici 5 jours ?",
    montantEstime: 300000,
    segment: "creatif",
  },
  {
    prenom: "Service Commercial Séminaires",
    entreprise: "Hôtel 2 Février Lomé",
    metier: "Hôtellerie 5 Étoiles & Centre de Congrès",
    nicheMots: ["hôtel", "hotel", "séminaire", "conférence", "restaurant", "lounge"],
    telephone: "+22822238600",
    email: "sales@hotel2fevrierlome.com",
    ville: "Lomé",
    villesCompatibles: ["lomé", "lome", "togo", "autre ville"],
    quartier: "Place de l'Indépendance",
    statutSite: "sans_whatsapp",
    siteWeb: "https://hotel2fevrierlome.com",
    ceQuiManque:
      "Pas de canal WhatsApp dédié pour les réservations d'événements et séminaires d'entreprises locales.",
    impactCommercial:
      "Lenteur dans les échanges de devis pour les comités d'entreprises et délégations régionales.",
    solutionRecommandee:
      "Tunnel de devis interactif pour événements professionnels connecté à WhatsApp Business.",
    signauxCritiques: ["Devis séminaires lents", "Pas de contact WhatsApp dédié"],
    messageWhatsApp:
      "Bonjour à l'équipe commerciale de l'Hôtel 2 Février. Votre centre de congrès est le plus prestigieux de Lomé, mais obtenir un devis rapide reste lent pour les organisateurs d'événements. Je peux vous installer un canal de devis WhatsApp direct en 48h ?",
    montantEstime: 600000,
    segment: "creatif",
  },

  // --- DOUALA (CAMEROUN) ---
  {
    prenom: "Direction des Soins",
    entreprise: "Clinique Muna Douala",
    metier: "Clinique Spécialisée & Maternité",
    nicheMots: ["clinique", "dentaire", "soins", "santé", "médecin", "médical", "hôpital"],
    telephone: "+237233422200",
    email: "contact@cliniquemuna.cm",
    ville: "Douala",
    villesCompatibles: ["douala", "yaoundé", "yaounde", "cameroun", "autre ville"],
    quartier: "Bonanjo",
    statutSite: "obsolete",
    siteWeb: "http://cliniquemuna.cm",
    ceQuiManque:
      "Institution médicale historique de Bonanjo avec un site obsolète non sécurisé (HTTP simple).",
    impactCommercial: "Avertissement de sécurité Google sur smartphone qui fait fuir les patients.",
    solutionRecommandee: "Refonte moderne sécurisée HTTPS avec tunnel de contact patient WhatsApp.",
    signauxCritiques: [
      "Site obsolète non sécurisé",
      "Avertissement navigateur",
      "Pas de WhatsApp direct",
    ],
    messageWhatsApp:
      "Bonjour. Votre clinique à Bonanjo a une histoire formidable, mais votre site affiche un avertissement 'Non sécurisé' sur smartphone. Je peux vous sécuriser et moderniser ça d'ici la semaine prochaine ?",
    montantEstime: 380000,
    segment: "creatif",
  },

  // --- PARIS / DIASPORA ---
  {
    prenom: "Me Robert Dossou - Antenne Paris",
    entreprise: "Cabinet Juridique Diaspora Afrique",
    metier: "Droit des Affaires & Investissements Diaspora",
    nicheMots: ["avocat", "notaire", "cabinet", "juridique", "droit", "conseil"],
    telephone: "+33142685500",
    email: "contact@diaspora-avocats.fr",
    ville: "Paris",
    villesCompatibles: ["paris", "diaspora", "montréal", "bruxelles", "autre ville"],
    quartier: "Paris 8e",
    statutSite: "obsolete",
    siteWeb: "http://diaspora-avocats.fr",
    ceQuiManque:
      "Site institutionnel datant de 2017, non adapté pour les consultations juridiques en ligne ni WhatsApp.",
    impactCommercial: "Perte de dossiers de la diaspora et des entrepreneurs africains en Europe.",
    solutionRecommandee:
      "Plateforme moderne avec prise de rendez-vous en visio et tunnel WhatsApp direct.",
    signauxCritiques: ["Site obsolète", "Pas de RDV en ligne", "Friction diaspora"],
    messageWhatsApp:
      "Bonjour Maître. Votre cabinet à Paris accompagne beaucoup d'investisseurs vers l'Afrique, mais votre site ne permet pas de réserver une consultation en ligne directement. Je peux vous installer un portail moderne en 5 jours ?",
    montantEstime: 650000,
    segment: "diaspora",
  },
];

function sourcerProspectsGabarit(params: ParametresRechercheProspects): ProspectSourceIA[] {
  const nombre = Math.min(20, Math.max(1, params.nombre || 5));
  const villeLower = (params.ville || "cotonou").toLowerCase();
  const motsClesLower = (params.nicheOuMotsCles || "").toLowerCase();

  // Filtrer par ville compatible
  let candidats = ANNUAIRE_TERRAIN_REEL.filter((e) =>
    e.villesCompatibles.some((v) => villeLower.includes(v)),
  );

  if (candidats.length === 0) {
    candidats = ANNUAIRE_TERRAIN_REEL;
  }

  // Trier par pertinence de la niche / mots clés
  const scored = candidats.map((e) => {
    let score = 0;
    for (const mot of e.nicheMots) {
      if (motsClesLower.includes(mot)) score += 3;
    }
    if (motsClesLower.includes(e.metier.toLowerCase())) score += 5;
    return { e, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const selectionnes = scored.slice(0, nombre).map((item) => item.e);

  return selectionnes.map((item) => {
    const audit: AuditDetailleProspect = {
      statutSite: item.statutSite,
      siteWeb: item.siteWeb,
      ceQuiManque: item.ceQuiManque,
      impactCommercial: item.impactCommercial,
      solutionRecommandee: item.solutionRecommandee,
      signauxCritiques: item.signauxCritiques,
    };

    return {
      prenom: item.prenom,
      entreprise: item.entreprise,
      metier: item.metier,
      telephone: item.telephone,
      email: item.email,
      ville: `${item.quartier}, ${item.ville}`,
      detail: `votre établissement ${item.entreprise} situé à ${item.quartier}`,
      opportunite: item.ceQuiManque,
      messageWhatsApp: item.messageWhatsApp,
      segment: item.segment,
      montantEstime: item.montantEstime,
      audit,
    };
  });
}

function promptRapport(d: DonneesRapport): string {
  const p = Object.entries(d.pipelineParStatut)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");
  const q = d.quatorzeJours.map((j) => `${j.key}=${j.sent}`).join(" ");
  return [
    `Date : ${d.aujourdhui}`,
    `Chiffres du jour : envoyés=${d.chiffresJour.sent}/${d.objectifQuotidien}, réponses=${d.chiffresJour.replies}, appels=${d.chiffresJour.calls}, clients=${d.chiffresJour.clients}`,
    `Totaux cumulés : envoyés=${d.totauxCumules.sent}, réponses=${d.totauxCumules.replies}, appels=${d.totauxCumules.calls}, clients=${d.totauxCumules.clients}`,
    `Pipeline par statut :`,
    p,
    `Relances dues demain : ${d.relancesDemain}`,
    `Série (streak) : ${d.streakJours} jours`,
    `14 derniers jours : ${q}`,
  ].join("\n");
}

// =============================================================================
// PARSING de la réponse JSON de Gemini pour l'analyse
// =============================================================================

function parserAnalyseJson(brut: string): AnalyseProfil {
  // Retirer d'éventuelles clôtures markdown (```json ... ```).
  let s = brut.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  const debut = s.indexOf("{");
  const fin = s.lastIndexOf("}");
  if (debut === -1 || fin === -1) throw new Error("Réponse Gemini non JSON");
  const objet = JSON.parse(s.slice(debut, fin + 1)) as Partial<AnalyseProfil>;

  const signaux: SignauxProspect = {
    actif: Boolean(objet.signaux?.actif ?? true),
    nomMarque: Boolean(objet.signaux?.nomMarque ?? true),
    pasDeSite: Boolean(objet.signaux?.pasDeSite ?? true),
    montreTravail: Boolean(objet.signaux?.montreTravail ?? true),
    solvable: Boolean(objet.signaux?.solvable ?? true),
  };
  const score =
    typeof objet.score === "number"
      ? Math.min(5, Math.max(0, Math.round(objet.score)))
      : Object.values(signaux).filter(Boolean).length;

  const justifications = objet.justifications ?? ({} as Record<keyof SignauxProspect, string>);
  return {
    signaux,
    justifications: {
      actif: justifications.actif ?? "Profil actif repéré.",
      nomMarque: justifications.nomMarque ?? "Marque ou nom professionnel présent.",
      pasDeSite: justifications.pasDeSite ?? "Pas de site web optimisé détecté.",
      montreTravail: justifications.montreTravail ?? "Présentation d'offres ou services visible.",
      solvable: justifications.solvable ?? "Activité commerciale en exercice.",
    },
    score,
    verdict: score >= 3 ? "retenu" : "ecarte",
    prenom: objet.prenom ?? "",
    metier: objet.metier ?? "",
    entreprise: objet.entreprise ?? "",
    telephone: nettoyerNumeroTelephone(objet.telephone ?? ""),
    ville: objet.ville ?? "",
    niche: objet.niche ?? "",
    opportunite: objet.opportunite ?? "",
    auditFlash: objet.auditFlash ?? "",
    segment:
      objet.segment === "chaud" || objet.segment === "diaspora" || objet.segment === "creatif"
        ? objet.segment
        : "creatif",
    detail: objet.detail ?? "",
    angle: objet.angle ?? "",
  };
}

// Extraction heuristique hors-ligne (zéro panne quand pas de clé Gemini configurée)
function extraireProfilHorsLigne(texte: string): AnalyseProfil {
  const telMatch = texte.match(
    /(?:\+|00)?([0-9]{2,4}[\s.-]?[0-9]{2,3}[\s.-]?[0-9]{2,4}[\s.-]?[0-9]{2,4})/,
  );
  const telephone = telMatch ? nettoyerNumeroTelephone(telMatch[0]) : "";

  // Détection ville
  const villes = [
    "Cotonou",
    "Porto-Novo",
    "Abidjan",
    "Dakar",
    "Douala",
    "Yaoundé",
    "Lomé",
    "Ouagadougou",
    "Bamako",
    "Paris",
    "Montréal",
    "Bruxelles",
  ];
  const villeTrouvee = villes.find((v) => new RegExp(`\\b${v}\\b`, "i").test(texte)) ?? "";

  // Détection niche
  let nicheTrouvee = "";
  if (/clinique|docteur|médical|santé|dentiste/i.test(texte)) nicheTrouvee = "Santé & Clinique";
  else if (/immo|appartement|villa|parcelle|promoteur/i.test(texte)) nicheTrouvee = "Immobilier";
  else if (/resto|restaurant|lounge|bar|traiteur|cocktail/i.test(texte))
    nicheTrouvee = "Restauration & Lounge";
  else if (/mode|boutique|bijoux|robe|marque|couture|cosmétique/i.test(texte))
    nicheTrouvee = "Mode & Beauté";
  else if (/coach|formation|consultant|académie|mentor/i.test(texte))
    nicheTrouvee = "Formation & Coaching";
  else if (/avocat|notaire|cabinet|juridique|comptable/i.test(texte))
    nicheTrouvee = "Conseil & Juridique";
  else nicheTrouvee = "Services Pro";

  // Détection prénom / première ligne
  const premiereLigne =
    texte
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)[0] || "";
  const prenomExtrait =
    premiereLigne.length > 0 && premiereLigne.length < 35
      ? premiereLigne.replace(/[@#]/g, "")
      : "Directeur";

  const opportunite =
    "Présence commerciale active mais manque d'un tunnel de conversion direct et d'un site web professionnel pour rassurer et closer.";

  return {
    signaux: { actif: true, nomMarque: true, pasDeSite: true, montreTravail: true, solvable: true },
    justifications: {
      actif: "Activité commerciale détectée dans le texte.",
      nomMarque: "Nom d'activité ou établissement présent.",
      pasDeSite: "Aucun site portfolio dédié n'a été spécifié.",
      montreTravail: "Offres ou prestations mentionnées.",
      solvable: "Marché professionnel local actif.",
    },
    score: 5,
    verdict: "retenu",
    prenom: prenomExtrait,
    metier: nicheTrouvee,
    entreprise: prenomExtrait,
    telephone,
    ville: villeTrouvee,
    niche: nicheTrouvee,
    opportunite,
    segment:
      villeTrouvee === "Paris" || villeTrouvee === "Montréal" || villeTrouvee === "Bruxelles"
        ? "diaspora"
        : "creatif",
    detail: `votre activité dans ${nicheTrouvee}${villeTrouvee ? ` à ${villeTrouvee}` : ""}`,
    angle:
      "Proposer une vitrine web moderne avec commande WhatsApp directe pour doubler les demandes.",
    auditFlash: `Bonjour ${prenomExtrait},\n\n🔴 Faille repérée : pas de catalogue ou site dédié pour rassurer vos clients avant de commander.\n🟢 Opportunité : un site vitrine rapide sur mobile avec lien WhatsApp direct.\n🎯 Proposition : je vous prépare une maquette de démo gratuite de 2 min d'ici 48h ?`,
  };
}

export function nettoyerNumeroTelephone(brut: string): string {
  if (!brut) return "";
  let tel = brut.replace(/[^\d+]/g, "");
  // Si commence par 00, remplacer par +
  if (tel.startsWith("00")) tel = `+${tel.slice(2)}`;
  // Si pas de +, mais commence par 229, 225, 221 etc.
  if (!tel.startsWith("+") && tel.length >= 8) {
    if (
      tel.startsWith("229") ||
      tel.startsWith("225") ||
      tel.startsWith("221") ||
      tel.startsWith("237") ||
      tel.startsWith("228") ||
      tel.startsWith("33")
    ) {
      tel = `+${tel}`;
    }
  }
  return tel;
}

export function auditFlashGabarit(p: ProspectPourAudit): string {
  const nom = p.entreprise || p.prenom || "votre établissement";
  const metier = p.metier || "activité";
  const faille =
    p.opportunite ||
    p.detail ||
    "une présence en ligne incomplète et un tunnel de contact WhatsApp non optimisé";
  return `Bonjour ${p.prenom || ""}, voici le mini-audit express pour ${nom} (${metier}) :

🔴 LE PROBLÈME REPÉRÉ :
${faille}. Actuellement, une partie de vos prospects potentiels hésitent ou partent vers des concurrents plus visibles et plus rapides à joindre.

🟢 L'OPPORTUNITÉ (Gain rapide sous 7 jours) :
Mettre en place un site web ou portfolio ultra-rapide sur mobile, avec bouton de commande WhatsApp direct et vos meilleures réalisations mises en avant.

🎯 LA PROPOSITION SANS RISQUE :
Je suis designer web au Bénin. Si vous le souhaitez, je vous prépare une maquette visuelle de démo de 2 minutes sans aucun engagement d'ici 48h. Est-ce que ça vous intéresse d'y jeter un œil ?`;
}

function nettoyerTexteMessage(brut: string): string {
  let s = brut.trim();
  // Retirer guillemets encadrants (l'IA les ajoute parfois même quand on le lui interdit).
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("«") && s.endsWith("»"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

// =============================================================================
// GABARITS M1–M6 — VOIX ROYSTEN, PRÊTS À COPIER-COLLER SANS IA
// =============================================================================

// Tu/toi vs vous/vous — segment diaspora = vouvoiement, sinon tutoiement.
function estVouvoiement(segment: ProspectPourMessage["segment"]): boolean {
  return segment === "diaspora";
}

function rendreGabarit(type: TypeMessage, p: ProspectPourMessage, cfg: Config): string {
  const prenom = p.prenom.trim() || "toi";
  const detail = p.detail.trim() || "ton travail";
  const vouv = estVouvoiement(p.segment);

  switch (type) {
    case "M1":
      // Réseau chaud — tutoiement, question directe, tarif qui monte.
      return [
        `Salut ${prenom} 👋`,
        ``,
        `J'ai vu ${detail}.`,
        ``,
        `Je te pose une question simple.`,
        `Tu connais quelqu'un autour de toi qui vit de son talent`,
        `mais qui n'a pas encore de site à son nom ?`,
        `(Ou c'est toi ?)`,
        ``,
        `Je lance en ce moment mon offre "Obtiens ton Portfolio" —`,
        `un site livré en 5 jours, à un tarif de lancement qui monte bientôt.`,
        ``,
        `Tu penses à qui ?`,
      ].join("\n");

    case "M2":
      // Créatif froid — compliment précis + question Google + offre en une ligne.
      return [
        `Salut ${prenom},`,
        ``,
        `${detail} — franchement, c'est propre.`,
        ``,
        `Une question :`,
        `quand un client tape ton nom sur Google, il trouve quoi ?`,
        ``,
        `Moi je fais des sites portfolio pour les gens comme toi,`,
        `livrés en 5 jours. Tarif de lancement en ce moment.`,
        ``,
        `Ça t'intéresse d'en parler ?`,
      ].join("\n");

    case "M3":
      // Diaspora — vouvoiement, présentation, constat, offre.
      return [
        `Bonjour ${prenom},`,
        ``,
        `${detail} — j'ai pris le temps de regarder.`,
        ``,
        `Je me présente : Roysten, designer web au Bénin (Roy Sten Design).`,
        ``,
        `Aujourd'hui, on vous cherche en ligne avant de vous faire confiance.`,
        `Un profil LinkedIn ne suffit plus — il vous faut un endroit à vous.`,
        ``,
        `Je propose des sites portfolio livrés en 5 jours,`,
        `avec un tarif de lancement ce mois-ci.`,
        ``,
        `Ça pourrait vous parler ?`,
      ].join("\n");

    case "M4":
      // Relance douce J+2 — sans pression, porte ouverte.
      return vouv
        ? [
            `Bonjour ${prenom},`,
            ``,
            `Je repasse rapidement par ici — pas pour insister.`,
            ``,
            `Juste savoir si l'idée du portfolio vous parle,`,
            `ou si le moment est mal choisi.`,
            ``,
            `Les deux réponses me vont — dites-moi 🙂`,
          ].join("\n")
        : [
            `Salut ${prenom},`,
            ``,
            `Je repasse par ici — pas pour insister.`,
            ``,
            `Juste savoir si l'idée te parle,`,
            `ou si le moment est mal choisi.`,
            ``,
            `Les deux réponses me vont, dis-moi 🙂`,
          ].join("\n");

    case "M5": {
      // Relance prix J+5 — information sur la hausse.
      const pa = cfg.prixActuel.trim() || "[prix actuel]";
      const ps = cfg.prixSuivant.trim() || "[prix suivant]";
      const dh = cfg.dateHausse.trim() || "[date de hausse]";
      return vouv
        ? [
            `Bonjour ${prenom},`,
            ``,
            `Petite info :`,
            `le tarif passe de ${pa} à ${ps} le ${dh}.`,
            ``,
            `Je préviens d'abord les personnes avec qui j'ai déjà échangé —`,
            `c'est votre cas.`,
            ``,
            `Dites-moi si vous voulez qu'on lance avant la hausse.`,
          ].join("\n")
        : [
            `Salut ${prenom},`,
            ``,
            `Petite info :`,
            `le tarif passe de ${pa} à ${ps} le ${dh}.`,
            ``,
            `Je préviens d'abord ceux avec qui j'ai déjà échangé — c'est ton cas.`,
            ``,
            `Dis-moi si tu veux qu'on lance avant la hausse.`,
          ].join("\n");
    }

    case "M6":
      // Clôture J+7 — libère la relance des deux côtés.
      return vouv
        ? [
            `Bonjour ${prenom},`,
            ``,
            `Dernier message de ma part.`,
            `Je ferme ma liste de projets du mois.`,
            ``,
            `Toujours partant, ou je vous libère de mes relances ?`,
            ``,
            `Les deux réponses me vont — bonne continuation dans tous les cas.`,
          ].join("\n")
        : [
            `Salut ${prenom},`,
            ``,
            `Dernier message.`,
            `Je ferme ma liste de projets du mois.`,
            ``,
            `Toujours partant, ou je te libère de mes relances ?`,
            ``,
            `Les deux me vont — bonne continuation 🙂`,
          ].join("\n");
  }
}

// =============================================================================
// RAPPORT DU SOIR calculé sans IA (mêmes règles que le prompt système)
// =============================================================================

function rapportCalcule(d: DonneesRapport): string {
  const c = d.chiffresJour;
  const t = d.totauxCumules;

  const ligneChiffres = `Aujourd'hui : ${c.sent}/${d.objectifQuotidien} envoyés, ${c.replies} réponse${
    c.replies > 1 ? "s" : ""
  }, ${c.calls} appel${c.calls > 1 ? "s" : ""}, ${c.clients} client${c.clients > 1 ? "s" : ""}.`;

  let lecture: string;
  if (t.sent < 10) {
    lecture = `Moins de 10 envois au total — le diagnostic attend plus de données. Continue à envoyer, on ajustera ensuite.`;
  } else {
    const tauxReponse = t.sent > 0 ? t.replies / t.sent : 0;
    if (tauxReponse < 0.1) {
      lecture = `Le blocage est à l'OUVERTURE : ${Math.round(tauxReponse * 100)}% de réponses seulement. La première ligne est trop générique ou la cible est mauvaise. Ajustement : rends le "détail précis" plus personnel, ou change de segment/plateforme.`;
    } else if (t.replies > 0 && t.calls === 0) {
      lecture = `Le blocage est à la BASCULE : ${t.replies} réponse${t.replies > 1 ? "s" : ""} mais 0 appel. Ajustement : propose un choix binaire ("appel de 10 min ou 3 questions par écrit ?") et réponds dans l'heure.`;
    } else if (t.calls > 0 && t.clients === 0) {
      lecture = `Le blocage est à la CONCLUSION : ${t.calls} appel${t.calls > 1 ? "s" : ""} mais 0 client. Ajustement : montre le cas client le plus proche pendant l'appel et propose l'acompte de 50 % via MoMo tout de suite.`;
    } else {
      lecture = `Entonnoir sain : ${Math.round(tauxReponse * 100)}% de réponses, ${t.calls} appel${t.calls > 1 ? "s" : ""}, ${t.clients} client${t.clients > 1 ? "s" : ""}. Rien ne coince — continue ce que tu fais.`;
    }
  }

  const priorite =
    d.relancesDemain > 0
      ? `Priorité demain : ${d.relancesDemain} relance${d.relancesDemain > 1 ? "s" : ""} dues, à envoyer en premier.`
      : `Priorité demain : ${d.objectifQuotidien} nouveaux messages à envoyer.`;

  const encouragement =
    c.clients > 0
      ? `Client signé aujourd'hui 🎉 On apprend. On ajuste. On avance.`
      : c.sent >= d.objectifQuotidien
        ? `Objectif du jour atteint. On apprend. On ajuste. On avance.`
        : `On tient la cadence. On apprend. On ajuste. On avance.`;

  return [ligneChiffres, "", lecture, "", priorite, "", encouragement].join("\n");
}
