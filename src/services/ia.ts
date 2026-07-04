// Couche IA Sprint Machine — abstraction unique pour V1 (gabarits + Gemini)
// et V2 future (Anthropic via Cloud Functions).
//
// Contrat : les écrans n'appellent QUE `getServiceIA(config)` et utilisent les 3 méthodes
// de ServiceIA. Migrer vers Anthropic = ajouter une 3e implémentation et un cas dans le switch.

import type {
  AnalyseProfil,
  Config,
  DayStats,
  Prospect,
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

export interface ServiceIA {
  readonly mode: "gabarits" | "gemini";
  genererMessage(prospect: ProspectPourMessage, type: TypeMessage): Promise<string>;
  analyserProfil(texte: string, url?: string): Promise<AnalyseProfil>;
  rapportDuSoir(donnees: DonneesRapport): Promise<string>;
}

export type ProspectPourMessage = Pick<
  Prospect,
  "prenom" | "metier" | "plateforme" | "detail" | "segment"
>;

// Erreur explicite quand une capacité manque (l'écran affiche un message clair).
export class CapaciteNonDisponibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapaciteNonDisponibleError";
  }
}

// ---- Fabrique ---------------------------------------------------------------

export function getServiceIA(config: Config): ServiceIA {
  if (config.modeIA === "gemini" && config.geminiKey.trim().length > 0) {
    return new ServiceGemini(config);
  }
  return new ServiceGabarits(config);
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

  async analyserProfil(): Promise<AnalyseProfil> {
    throw new CapaciteNonDisponibleError(
      "Nécessite le mode Gemini — configure ta clé gratuite dans Réglages.",
    );
  }

  async rapportDuSoir(donnees: DonneesRapport): Promise<string> {
    return rapportCalcule(donnees);
  }
}

// =============================================================================
// Implémentation "gemini" — polish IA, gratuit, avec repli auto sur gabarits
// =============================================================================

// Modèle par défaut : Flash-Lite (plus gros quota gratuit).
// Facilement modifiable si Google renomme ses modèles.
const MODELE_GEMINI = "gemini-flash-lite-latest";

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
    // Pas de repli possible ici (les gabarits ne savent pas analyser).
    // L'écran gère l'erreur et affiche un message clair.
    const brut = await this.appelerGemini({
      systeme: PROMPT_SYSTEME_ANALYSE,
      utilisateur: promptAnalyserProfil(texte, url),
      maxTokens: 800,
    });
    return parserAnalyseJson(brut);
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

  // --- Bas niveau : appel HTTP avec 1 backoff sur 429/erreur réseau. ---
  private async appelerGemini(args: {
    systeme: string;
    utilisateur: string;
    maxTokens: number;
  }): Promise<string> {
    const url = `${ENDPOINT_GEMINI(MODELE_GEMINI)}?key=${encodeURIComponent(this.cfg.geminiKey)}`;
    const body = {
      systemInstruction: { parts: [{ text: args.systeme }] },
      contents: [{ role: "user", parts: [{ text: args.utilisateur }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: args.maxTokens },
    };

    let derniereErreur: unknown = null;
    for (let essai = 0; essai < 2; essai++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 429) throw new Error("Quota IA du jour atteint");
        if (!res.ok) throw new Error(`Gemini ${res.status}`);
        const json = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const texte = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        return texte;
      } catch (e) {
        derniereErreur = e;
        if (essai === 0) await new Promise((r) => setTimeout(r, 2000));
      }
    }
    throw derniereErreur ?? new Error("Gemini indisponible");
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

const PROMPT_SYSTEME_ANALYSE = `Tu es l'analyseur de prospects de Roysten, designer web au Bénin qui vend des sites portfolio à des freelances, coachs, consultants et créatifs (cible prioritaire : diaspora béninoise en Europe/Amérique du Nord, puis créatifs solvables locaux).

On te donne le texte visible d'un profil LinkedIn ou Facebook. Évalue les 5 signaux :
1. actif : publie ou commente (indices de dates récentes, activité visible)
2. nomMarque : son nom EST sa marque (freelance, coach, consultant, créatif — pas salarié anonyme)
3. pasDeSite : aucun site personnel visible (rien, ou juste un Linktree / numéro)
4. montreTravail : montre ses réalisations, parle de ses projets
5. solvable : diaspora, tarifs visibles, clientèle pro, activité établie

Réponds UNIQUEMENT en JSON strict, sans texte autour :
{
 "signaux": {"actif": bool, "nomMarque": bool, "pasDeSite": bool, "montreTravail": bool, "solvable": bool},
 "justifications": {"actif": "…", "nomMarque": "…", "pasDeSite": "…", "montreTravail": "…", "solvable": "…"} (une phrase courte chacune),
 "score": 0-5,
 "verdict": "retenu"|"ecarte" (retenu si score >= 3),
 "prenom": "…" (si identifiable, sinon ""),
 "metier": "…",
 "segment": "chaud"|"diaspora"|"creatif",
 "detail": "LE détail le plus précis et personnel utilisable en première ligne de message",
 "angle": "l'angle d'attaque recommandé en une phrase"
}
Si le texte est trop pauvre pour juger un signal, mets false et dis-le dans la justification.`;

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
    `Plateforme : ${prospect.plateforme}`,
    `Détail précis (pour la 1re ligne) : ${prospect.detail}`,
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
    actif: Boolean(objet.signaux?.actif),
    nomMarque: Boolean(objet.signaux?.nomMarque),
    pasDeSite: Boolean(objet.signaux?.pasDeSite),
    montreTravail: Boolean(objet.signaux?.montreTravail),
    solvable: Boolean(objet.signaux?.solvable),
  };
  const score =
    typeof objet.score === "number"
      ? Math.min(5, Math.max(0, Math.round(objet.score)))
      : Object.values(signaux).filter(Boolean).length;

  const justifications = objet.justifications ?? ({} as Record<keyof SignauxProspect, string>);
  return {
    signaux,
    justifications: {
      actif: justifications.actif ?? "",
      nomMarque: justifications.nomMarque ?? "",
      pasDeSite: justifications.pasDeSite ?? "",
      montreTravail: justifications.montreTravail ?? "",
      solvable: justifications.solvable ?? "",
    },
    score,
    verdict: score >= 3 ? "retenu" : "ecarte",
    prenom: objet.prenom ?? "",
    metier: objet.metier ?? "",
    segment: (objet.segment === "chaud" || objet.segment === "diaspora" || objet.segment === "creatif")
      ? objet.segment
      : "creatif",
    detail: objet.detail ?? "",
    angle: objet.angle ?? "",
  };
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

function rendreGabarit(
  type: TypeMessage,
  p: ProspectPourMessage,
  cfg: Config,
): string {
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
