// Modèle de données Sprint Machine V1 (Spark plan, sans Cloud Functions).
// Miroir exact du modèle Firestore décrit dans le brief §2.

export type Plateforme = "whatsapp" | "linkedin" | "instagram" | "facebook";

export type Segment = "chaud" | "diaspora" | "creatif";

export type Statut =
  | "a_contacter"
  | "envoye"
  | "relance_douce"
  | "relance_prix"
  | "cloture"
  | "repondu"
  | "appel"
  | "client"
  | "sans_suite";

export type TypeMessage = "M1" | "M2" | "M3" | "M4" | "M5" | "M6";

// M4/M5/M6 sont les seules valeurs "prochaine action" — M1/M2/M3 sont des premiers contacts,
// planifiés implicitement par le statut a_contacter.
export type TypeProchaineAction = "M4" | "M5" | "M6";

export type Source = "manuel" | "extension" | "partage";

export type Prospect = {
  id: string;
  prenom: string;
  plateforme: Plateforme;
  metier: string;
  detail: string;
  segment: Segment;
  lien?: string;
  statut: Statut;
  prochaineActionDate: string | null; // ISO YYYY-MM-DD (Africa/Porto-Novo)
  prochaineActionType: TypeProchaineAction | null;
  notes?: string;
  source: Source;
  createdAt: string; // ISO timestamp
};

export type Message = {
  id: string;
  type: TypeMessage;
  contenu: string;
  sentAt: string; // ISO timestamp
};

export type DayStats = {
  sent: number;
  replies: number;
  calls: number;
  clients: number;
};

export type ModeIA = "gabarits" | "gemini";

export type Config = {
  objectifQuotidien: number;
  premierClientCelebre: boolean;
  prixActuel: string; // format libre : "150 000 F", "250 €", etc.
  prixSuivant: string;
  dateHausse: string; // ISO YYYY-MM-DD ou libellé
  modeIA: ModeIA;
  geminiKey: string;
};

export const CONFIG_DEFAUT: Config = {
  objectifQuotidien: 10,
  premierClientCelebre: false,
  prixActuel: "",
  prixSuivant: "",
  dateHausse: "",
  modeIA: "gabarits",
  geminiKey: "",
};

// Signaux de qualification issus de l'analyse de profil (5 booléens + verdict).
export type SignauxProspect = {
  actif: boolean;
  nomMarque: boolean;
  pasDeSite: boolean;
  montreTravail: boolean;
  solvable: boolean;
};

export type AnalyseProfil = {
  signaux: SignauxProspect;
  justifications: Record<keyof SignauxProspect, string>;
  score: number; // 0-5
  verdict: "retenu" | "ecarte";
  prenom: string;
  metier: string;
  segment: Segment;
  detail: string;
  angle: string;
};

// Libellés d'affichage FR pour les enums (source unique de vérité UI).
export const LABEL_PLATEFORME: Record<Plateforme, string> = {
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
};

export const LABEL_SEGMENT: Record<Segment, string> = {
  chaud: "Réseau chaud",
  diaspora: "Diaspora",
  creatif: "Créatif",
};

export const LABEL_STATUT: Record<Statut, string> = {
  a_contacter: "À contacter",
  envoye: "Envoyé",
  relance_douce: "Relance douce",
  relance_prix: "Relance prix",
  cloture: "Clôture envoyée",
  repondu: "Répondu",
  appel: "Appel prévu",
  client: "Client",
  sans_suite: "Sans suite",
};

// Ordre d'affichage pour le Pipeline (§4 onglet Pipeline).
export const ORDRE_STATUT_PIPELINE: Statut[] = [
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
