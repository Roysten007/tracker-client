// Logique des relances Sprint Machine (§5 du brief).
//
// Règles exactes :
//   - Envoi M1|M2|M3 (premier contact)  → statut envoye,         prochaine action M4 à J+2
//   - Envoi M4                          → statut relance_douce,  prochaine action M5 à J+3
//   - Envoi M5                          → statut relance_prix,   prochaine action M6 à J+2
//   - Envoi M6                          → statut cloture,        aucune action programmée
//   - "Il a répondu" à n'importe quel stade → statut repondu, action annulée
//
// La File du jour = prospects avec prochaineActionDate <= aujourd'hui (relances d'abord),
// puis les a_contacter (10 plus anciens max — géré au niveau de l'écran).

import { addDays } from "./date";
import type { Prospect, Statut, TypeMessage, TypeProchaineAction } from "./types";

export type ProspectPatch = Partial<
  Pick<Prospect, "statut" | "prochaineActionDate" | "prochaineActionType">
>;

// Calcule la mise à jour d'un prospect après envoi d'un message donné, à la date donnée.
// Retourne un patch à appliquer (le caller merge avec le prospect existant).
export function patchApresEnvoi(type: TypeMessage, aujourdhui: string): ProspectPatch {
  switch (type) {
    case "M1":
    case "M2":
    case "M3":
      return {
        statut: "envoye",
        prochaineActionType: "M4",
        prochaineActionDate: addDays(aujourdhui, 2),
      };
    case "M4":
      return {
        statut: "relance_douce",
        prochaineActionType: "M5",
        prochaineActionDate: addDays(aujourdhui, 3),
      };
    case "M5":
      return {
        statut: "relance_prix",
        prochaineActionType: "M6",
        prochaineActionDate: addDays(aujourdhui, 2),
      };
    case "M6":
      return {
        statut: "cloture",
        prochaineActionType: null,
        prochaineActionDate: null,
      };
  }
}

// Marque un prospect comme ayant répondu — annule la relance en cours.
export function patchApresReponse(): ProspectPatch {
  return {
    statut: "repondu",
    prochaineActionType: null,
    prochaineActionDate: null,
  };
}

// Détermine le type de premier message (M1/M2/M3) à partir du segment.
export function premierMessagePourSegment(segment: Prospect["segment"]): TypeMessage {
  switch (segment) {
    case "chaud":
      return "M1";
    case "creatif":
      return "M2";
    case "diaspora":
      return "M3";
  }
}

// Détermine le type de message à générer pour un prospect selon son statut actuel.
// Utilisé par le bouton "Générer le message" de la File du jour.
export function prochainMessage(prospect: Prospect): TypeMessage {
  if (prospect.prochaineActionType) return prospect.prochaineActionType;
  return premierMessagePourSegment(prospect.segment);
}

// ---- File du jour ----

// Un prospect est "dû" si sa prochaine action est planifiée pour aujourd'hui ou en retard.
export function estRelanceDue(prospect: Prospect, aujourdhui: string): boolean {
  if (!prospect.prochaineActionDate) return false;
  return prospect.prochaineActionDate <= aujourdhui;
}

// Prospects "à contacter" = statut a_contacter, jamais envoyé encore.
export function estAContacter(prospect: Prospect): boolean {
  return prospect.statut === "a_contacter";
}

export type FileDuJour = {
  relances: Prospect[]; // relances_dues, triées par date la plus ancienne d'abord
  aContacter: Prospect[]; // 10 plus anciens à contacter
};

// Construit la File du jour à afficher sur l'onglet Aujourd'hui.
// Relances en retard/du jour affichées EN PREMIER, puis les 10 plus anciens "à contacter".
export function fileDuJour(
  prospects: Prospect[],
  aujourdhui: string,
  limiteAContacter = 10,
): FileDuJour {
  const relances = prospects
    .filter((p) => estRelanceDue(p, aujourdhui))
    .sort((a, b) => (a.prochaineActionDate ?? "").localeCompare(b.prochaineActionDate ?? ""));

  const aContacter = prospects
    .filter(estAContacter)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, limiteAContacter);

  return { relances, aContacter };
}

// Libellé pour le badge de relance ("Relance J+2", "Relance J+5", "Clôture J+7").
// Basé sur le prochain type d'action (ce que va faire le bouton Générer).
export function libelleBadgeRelance(type: TypeProchaineAction): string {
  switch (type) {
    case "M4":
      return "Relance J+2";
    case "M5":
      return "Relance J+5";
    case "M6":
      return "Clôture J+7";
  }
}

// Après clôture (M6) : si aucune réponse depuis N jours, proposer sans_suite.
// Cette fonction ne modifie rien — elle indique juste si l'app doit poser la question.
export function doitProposerSansSuite(
  prospect: Prospect,
  aujourdhui: string,
  delaiJours = 3,
): boolean {
  if (prospect.statut !== "cloture") return false;
  // On regarde la date de dernière action programmée (celle de M6, effacée après envoi).
  // Simplification : on suppose que si le prospect est en cloture, l'envoi M6 a eu lieu
  // aujourd'hui ou avant — la question se pose N jours après le passage en cloture.
  // On utilise la date de mise à jour comme proxy : à défaut, createdAt.
  // Ici on prend prochaineActionDate=null, donc il faut regarder ailleurs → on renvoie true
  // si le prospect est en cloture depuis assez longtemps (on stocke la date de clôture ailleurs
  // ou on utilise le dernier message). Pour V1 : on demande simplement après M6.
  // → Le vrai calcul de "il y a N jours" nécessite la date du dernier message : c'est fait
  //   dans l'écran, pas ici.
  // Cette fonction reste utilitaire — l'écran passera dateDernierMessage en argument.
  return true; // placeholder — le vrai check est fait au niveau du composant (avec le lastMessage).
}

// Version stricte utilisant la date du dernier message envoyé.
export function doitProposerSansSuiteDepuis(
  prospect: Prospect,
  dateDernierMessage: string | null,
  aujourdhui: string,
  delaiJours = 3,
): boolean {
  if (prospect.statut !== "cloture") return false;
  if (!dateDernierMessage) return false;
  const seuil = addDays(dateDernierMessage, delaiJours);
  return aujourdhui >= seuil;
}

// Transitions manuelles depuis la fiche prospect (§4 Pipeline).
export function patchIlARepondu(): ProspectPatch {
  return patchApresReponse();
}

export function patchAppelPrevu(): ProspectPatch {
  return {
    statut: "appel",
    prochaineActionType: null,
    prochaineActionDate: null,
  };
}

export function patchCestUnClient(): ProspectPatch {
  return {
    statut: "client",
    prochaineActionType: null,
    prochaineActionDate: null,
  };
}

export function patchSansSuite(): ProspectPatch {
  return {
    statut: "sans_suite",
    prochaineActionType: null,
    prochaineActionDate: null,
  };
}

// Transitions autorisées pour la validation UI (empêche les états illégaux).
// Le brief ne les restreint pas explicitement — on garde tout ouvert pour V1.
export function statutsAtteignables(courant: Statut): Statut[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void courant;
  return [
    "a_contacter",
    "envoye",
    "relance_douce",
    "relance_prix",
    "cloture",
    "repondu",
    "appel",
    "client",
    "sans_suite",
  ];
}
