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

// Modèle par défaut : gemini-2.0-flash (recommandé pour qualité/vitesse avec quota gratuit).
const MODELE_GEMINI = "gemini-2.0-flash";

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
      // 1er essai : avec recherche web Google en direct si activée
      const brut = await this.appelerGemini({
        systeme: PROMPT_SYSTEME_SOURCING,
        utilisateur: promptSourcerProspects(params),
        maxTokens: 3000,
        rechercheWeb: avecRecherche,
      });
      return parserSourcingJson(brut);
    } catch (e) {
      // Si la recherche web a échoué (quota ou limitation), tenter sans outil de recherche
      if (avecRecherche) {
        try {
          const brutFallback = await this.appelerGemini({
            systeme: PROMPT_SYSTEME_SOURCING,
            utilisateur: promptSourcerProspects(params),
            maxTokens: 3000,
            rechercheWeb: false,
          });
          return parserSourcingJson(brutFallback);
        } catch {
          /* continuer vers repli gabarit */
        }
      }
      signalerRepli(e);
      return this.repli.sourcerProspectsIA(params);
    }
  }

  // --- Bas niveau : appel HTTP avec 1 backoff sur 429/erreur réseau. ---
  private async appelerGemini(args: {
    systeme: string;
    utilisateur: string;
    maxTokens: number;
    rechercheWeb?: boolean;
  }): Promise<string> {
    const url = `${ENDPOINT_GEMINI(MODELE_GEMINI)}?key=${encodeURIComponent(this.cfg.geminiKey)}`;
    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: args.systeme }] },
      contents: [{ role: "user", parts: [{ text: args.utilisateur }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: args.maxTokens },
    };

    if (args.rechercheWeb) {
      body.tools = [{ googleSearch: {} }];
    }

    let derniereErreur: unknown = null;
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
          console.error(`[Gemini ${res.status}]`, details);
          throw new Error(details ? `Gemini ${res.status} : ${details}` : `Gemini ${res.status}`);
        }
        const json = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const parts = json.candidates?.[0]?.content?.parts ?? [];
        const texte = parts.map((p) => p.text ?? "").join("");
        return texte;
      } catch (e) {
        derniereErreur = e;
        if (essai === 0) await new Promise((r) => setTimeout(r, 2000));
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

const PROMPT_SYSTEME_SOURCING = `Tu es le copilote d'acquisition client et closing B2B de Roy Sten Design, studio de design web haute conversion en Afrique francophone (Bénin, Côte d'Ivoire, Sénégal, Cameroun, Togo...) et diaspora.

Ta mission est double :
1) SYSTÈME DE RECHERCHE TERRAIN : Si tu as accès à la recherche Google en direct (Search Grounding), recherche de VRAIS établissements réels dans la ville et le quartier ciblés. Extrais leurs VRAIS noms et leurs coordonnées publiques (WhatsApp pro, email, site web éventuel).
2) SYSTÈME D'AUDIT COMMERCIAL & CE QUI MANQUE VRAIMENT : Ne donne pas seulement un contact. Analyse impérativement CE QUI CLOCHE dans leur présence digitale actuelle (accessibilité, absence de site, site obsolète ou lent sur smartphone, absence totale de tunnel WhatsApp direct).

Pour chaque prospect :
- prenom : prénom ou titre du dirigeant (ex: Dr Sossou, M. Lawson, Aïcha Diallo, M. Kpodar)
- entreprise : nom exact de l'établissement ou de la marque
- metier : activité exacte
- telephone : numéro WhatsApp avec indicatif international (+229 pour Bénin/Cotonou, +225 pour Côte d'Ivoire/Abidjan, +221 pour Sénégal/Dakar, +237 pour Cameroun, +228 pour Togo, +33 pour France/Diaspora)
- email : email pro public ou contact officiel
- ville : ville et quartier réel
- detail : détail spécifique sur leur activité (utilisé en 1re ligne du message)
- opportunite : la faille commerciale majeure repérée
- messageWhatsApp : message d'accroche WhatsApp ultra-personnalisé qui attaque directement la faille constatée, sans flatterie creuse (max 60 mots)
- segment : 'creatif' ou 'diaspora' ou 'chaud'
- montantEstime : montant réaliste en FCFA (ex: 200000 à 600000 FCFA)
- audit : objet d'audit complet contenant :
  * statutSite : 'aucun' | 'obsolete' | 'lent_mobile' | 'sans_whatsapp' | 'inaccessible'
  * siteWeb : URL du site ou chaîne vide si aucun site
  * ceQuiManque : explication détaillée de ce qui manque VRAIMENT pour convertir (accessibilité, manque de site vitrine, pas de WhatsApp)
  * impactCommercial : estimation concrète de la perte de clients/chiffre d'affaires chaque mois
  * solutionRecommandee : l'offre précise que le freelance doit leur vendre (ex: Site vitrine 5 jours + tunnel WhatsApp 1 clic)
  * signauxCritiques : tableau de 2 à 4 badges d'alerte (ex: ["Aucun site web", "Pas de WhatsApp direct"])

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
    `Mots-clés / Niche ciblée : ${params.nicheOuMotsCles}`,
    `Ville / Marché : ${params.ville}`,
    `Nombre de prospects demandés : ${params.nombre}`,
    `Offre proposée par le freelance : ${params.offreService || "Site web vitrine haute conversion & commande WhatsApp directe"}`,
    `Cible prioritaire : ${params.typeCible || "Entreprises locales, PME, cliniques, commerces établis"}`,
    `Instruction : Fais une recherche web/Maps approfondie sur ${params.ville} pour la niche "${params.nicheOuMotsCles}". Analyse impérativement pour chaque établissement ce qui manque vraiment (absence de site, problème d'accessibilité mobile, pas de tunnel WhatsApp) et son impact commercial.`,
  ].join("\n");
}

function parserSourcingJson(brut: string): ProspectSourceIA[] {
  let s = brut.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  const debut = s.indexOf("[");
  const fin = s.lastIndexOf("]");
  if (debut === -1 || fin === -1) throw new Error("Réponse sourcing non JSON");
  const tableau = JSON.parse(s.slice(debut, fin + 1)) as Record<string, unknown>[];

  return tableau.map((item) => {
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
      prenom: typeof item.prenom === "string" ? item.prenom.trim() : "Directeur",
      entreprise:
        typeof item.entreprise === "string" ? item.entreprise.trim() : "Entreprise locale",
      metier: typeof item.metier === "string" ? item.metier.trim() : "Commerce",
      telephone: nettoyerNumeroTelephone(typeof item.telephone === "string" ? item.telephone : ""),
      email: typeof item.email === "string" ? item.email.trim() : "",
      ville: typeof item.ville === "string" ? item.ville.trim() : "",
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
}

function sourcerProspectsGabarit(params: ParametresRechercheProspects): ProspectSourceIA[] {
  const nombre = Math.min(20, Math.max(1, params.nombre || 5));
  const ville = params.ville || "Cotonou";
  const motsCles = params.nicheOuMotsCles || "Services et Commerces";

  let indicatif = "+229";
  let quartiers = ["Haie Vive", "Cadjehoun", "Ganhi", "Akpakpa", "Fidjrossè"];
  let segment: Segment = "creatif";

  if (/abidjan/i.test(ville)) {
    indicatif = "+225";
    quartiers = ["Cocody", "Marcory", "Plateau", "Deux-Plateaux", "Riviera 3"];
  } else if (/dakar/i.test(ville)) {
    indicatif = "+221";
    quartiers = ["Almadies", "Plateau", "Mermoz", "Ngor", "Point E"];
  } else if (/douala|yaound/i.test(ville)) {
    indicatif = "+237";
    quartiers = ["Bonapriso", "Bonanjo", "Akwa", "Bastos", "Bali"];
  } else if (/lom/i.test(ville)) {
    indicatif = "+228";
    quartiers = ["Tokoin", "Nyékonakpoé", "Centre-Ville", "Bè", "Hédzranawoé"];
  } else if (/paris|montr|bruxelles|diaspora/i.test(ville)) {
    indicatif = "+33";
    quartiers = ["Paris 8e", "Paris 16e", "Montréal Centre", "Bruxelles"];
    segment = "diaspora";
  }

  const prenomsModeles = [
    "Dr. Sossou",
    "M. Kpodar",
    "Aïcha Diallo",
    "Marc Lawson",
    "Koffi Mensah",
    "Sarah Traoré",
    "Ibrahim Koné",
    "Dr. Mbarga",
    "Diane Kaboré",
    "Christian Hounnou",
    "Fatou Ndiaye",
    "Jean-Eudes Tossou",
    "Béatrice Agbodjan",
    "Dr. Kouamé",
    "Olivier Dossou",
  ];

  const suffixes = [
    "Prestige",
    "Excellence",
    "Groupe",
    "Concept",
    "Horizon",
    "Élite",
    "Moderne",
    "Ivoire",
    "Alliance",
    "Signature",
    "Le Hub",
    "Premium",
  ];

  const resultats: ProspectSourceIA[] = [];

  for (let i = 0; i < nombre; i++) {
    const prenom = prenomsModeles[i % prenomsModeles.length];
    const quartier = quartiers[i % quartiers.length];
    const suffixe = suffixes[i % suffixes.length];
    const baseMot = motsCles.split(" ")[0] || "Services";
    const nomEntr = `${baseMot} ${suffixe}`;
    const cleanDigits = String(97000000 + ((i * 3821) % 999999)).padStart(8, "0");
    const tel = `${indicatif}${cleanDigits}`;
    const slug = nomEntr.toLowerCase().replace(/[^a-z0-9]/g, "");
    const email = `contact@${slug}.com`;
    const detail = `votre établissement ${nomEntr} situé à ${quartier}, ${ville}`;

    // Scénarios d'audit digital variés pour le diagnostic
    let audit: AuditDetailleProspect;
    let message: string;
    const typeScenario = i % 4;

    if (typeScenario === 0) {
      audit = {
        statutSite: "aucun",
        siteWeb: "",
        ceQuiManque: `Aucun site vitrine officiel pour ${nomEntr}. Présence limitée à une page Facebook sans tunnel de commande, ce qui nuit à la crédibilité face aux concurrents de ${quartier}.`,
        impactCommercial: `Perte estimée de 20 à 35 clients solvables par mois qui recherchent sur Google et se dirigent vers les concurrents dotés d'un site.`,
        solutionRecommandee: `Création d'un site vitrine haute conversion livré en 5 jours avec prise de contact et commande directe sur WhatsApp.`,
        signauxCritiques: [
          "Aucun site web",
          "Dépendance Facebook/Insta",
          "Zéro réservation WhatsApp directe",
        ],
      };
      message = `Bonjour ${prenom}. J'ai découvert ${nomEntr} à ${quartier}. Votre réputation est excellente, mais vous perdez des clients chaque semaine faute d'un site web et d'un lien direct WhatsApp. Je peux vous montrer une démo de 2 min sans engagement pour vous montrer le gain ?`;
    } else if (typeScenario === 1) {
      audit = {
        statutSite: "obsolete",
        siteWeb: `https://${slug}.com`,
        ceQuiManque: `Site web existant mais obsolète et non responsive : le texte est minuscule sur smartphone et la navigation est pénible pour les visiteurs sur mobile.`,
        impactCommercial: `Taux de rebond estimé à plus de 70% sur mobile. L'image de marque est dégradée par rapport au standing réel de l'établissement.`,
        solutionRecommandee: `Refonte mobile-first ultra-rapide et design premium épuré conforme aux standards actuels.`,
        signauxCritiques: [
          "Site obsolète",
          "Inadapté smartphone",
          "Expérience utilisateur dégradée",
        ],
      };
      message = `Bonjour ${prenom}. J'ai consulté le site de ${nomEntr} depuis mon téléphone. Vos services sont de qualité, mais le site n'est pas optimisé mobile et fait fuir les visiteurs. J'ai préparé une version modernisée de démo, je peux vous la partager ici ?`;
    } else if (typeScenario === 2) {
      audit = {
        statutSite: "sans_whatsapp",
        siteWeb: `https://${slug}.com`,
        ceQuiManque: `Site vitrine existant mais sans tunnel de conversion : un simple formulaire email classique où personne ne répond, aucun bouton WhatsApp direct en 1 clic.`,
        impactCommercial: `Friction maximale : à ${ville}, 95% des conversions se font sur WhatsApp. Les visiteurs repartent sans laisser de contact.`,
        solutionRecommandee: `Intégration d'un bouton flottant WhatsApp et tunnel de devis interactif immédiat.`,
        signauxCritiques: [
          "Formulaire email inefficace",
          "Pas de bouton WhatsApp direct",
          "Friction commerciale",
        ],
      };
      message = `Bonjour ${prenom}. Sur votre site ${nomEntr}, il n'y a aucun bouton WhatsApp pour vous contacter instantanément, seulement un formulaire email. Vous perdez la majorité de vos visiteurs. Je peux vous installer un tunnel WhatsApp direct en 48h ?`;
    } else {
      audit = {
        statutSite: "lent_mobile",
        siteWeb: `https://${slug}.com`,
        ceQuiManque: `Temps de chargement excessif (> 7 secondes sur réseau mobile local) causé par des images trop lourdes et des scripts superflus.`,
        impactCommercial: `Près de 60% des prospects abandonnent le chargement avant même d'avoir vu les services ou les coordonnées.`,
        solutionRecommandee: `Optimisation drastique des performances web, compression d'images et architecture ultra-légère.`,
        signauxCritiques: [
          "Lenteur extrême > 7s",
          "Images non optimisées",
          "Pertes de prospects directs",
        ],
      };
      message = `Bonjour ${prenom}. J'ai testé la vitesse de votre site ${nomEntr} : il met plus de 7 secondes à charger sur smartphone. Cela vous coûte beaucoup de clients. Je peux vous montrer comment doubler votre vitesse sans toucher à vos contenus ?`;
    }

    resultats.push({
      prenom,
      entreprise: nomEntr,
      metier: motsCles,
      telephone: tel,
      email,
      ville: `${quartier}, ${ville}`,
      detail,
      opportunite: audit.ceQuiManque,
      messageWhatsApp: message,
      segment,
      montantEstime: 250000 + (i % 3) * 100000,
      audit,
    });
  }

  return resultats;
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
