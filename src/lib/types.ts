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

export type StatutSiteWeb = "aucun" | "obsolete" | "lent_mobile" | "sans_whatsapp" | "inaccessible" | "site_verifie";

export type Prospect = {
  id: string;
  place_id?: string; // ID Google Places pour dédoublonnage strict
  prenom: string;
  plateforme: Plateforme;
  metier: string;
  detail: string;
  segment: Segment;
  lien?: string;
  telephone?: string; // ex: +22997000000 ou +22507000000 pour WhatsApp direct
  entreprise?: string; // Nom de l'établissement / entreprise / marque
  ville?: string; // Cotonou, Abidjan, Dakar, Douala, Lomé, etc.
  niche?: string; // Clinique, Immo, Resto, etc.
  email?: string;
  siteWeb?: string;
  statutSite?: StatutSiteWeb;
  noteGoogle?: number;
  avisGoogle?: number;
  opportunite?: string; // Faille repérée (ex: pas de site, lien whatsapp cassé)
  ceQuiManque?: string; // Ce qui manque vraiment pour convertir
  impactCommercial?: string; // Perte estimée de clients/ventes
  solutionRecommandee?: string; // Offre recommandée à proposer
  auditFlash?: string; // Mini-audit IA prêt à envoyer
  montantEstime?: number; // Montant estimé en FCFA
  scoreTotal?: number; // Score algorithmique déterministe 0-100 (Étape 5)
  priorite?: "haute" | "moyenne" | "basse";
  lignesScore?: { critere: string; points: number; explication: string }[];
  messagePlaybookProbleme?: string;
  messagePlaybookOpportunite?: string;
  varianteChoisie?: "probleme" | "opportunite";
  objectionsPlaybook?: Record<string, string>;
  relancesPlaybook?: { r1: string; r2: string; r3: string };
  historiqueActions?: { date: string; action: string; note?: string }[];
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

export type ModeIA = "gabarits" | "gemini" | "mistral" | "groq" | "nvidia" | "openrouter";
export type MoteurRecherche = "google_gemini" | "gabarits";
export type MoteurAudit = "gemini" | "mistral" | "groq" | "nvidia" | "openrouter" | "gabarits";

export type Config = {
  objectifQuotidien: number;
  premierClientCelebre: boolean;
  prixActuel: string; // format libre : "150 000 F", "250 €", etc.
  prixSuivant: string;
  dateHausse: string; // ISO YYYY-MM-DD ou libellé
  modeIA: ModeIA;

  // --- SYSTÈME 1 : Recherche Maps & Web (Google) ---
  moteurRecherche?: MoteurRecherche;
  geminiKey: string;
  rechercheWebActivee?: boolean;

  // --- SYSTÈME 2 : Audit & Diagnostic des Failles (IA Analytique) ---
  moteurAudit?: MoteurAudit;
  mistralKey?: string;
  groqKey?: string;
  nvidiaKey?: string;
  openrouterKey?: string;
  modelePerso?: string;
};

export const CONFIG_DEFAUT: Config = {
  objectifQuotidien: 10,
  premierClientCelebre: false,
  prixActuel: "",
  prixSuivant: "",
  dateHausse: "",
  modeIA: "gemini",
  moteurRecherche: "google_gemini",
  geminiKey: "",
  rechercheWebActivee: true,
  moteurAudit: "gemini",
  mistralKey: "",
  groqKey: "",
  nvidiaKey: "",
  openrouterKey: "",
  modelePerso: "",
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
  telephone?: string;
  entreprise?: string;
  ville?: string;
  niche?: string;
  opportunite?: string;
  auditFlash?: string;
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

// ---- Documents de vente (Devis & Factures) ----------------------------------

export type TypeDocumentVente = "devis" | "facture";

export type StatutDocumentVente = "brouillon" | "envoye" | "accepte" | "refuse" | "paye" | "annule";

export type ArticleDocument = {
  id: string;
  description: string;
  quantite: number;
  prixUnitaire: number;
};

export type DocumentVente = {
  id: string;
  type: TypeDocumentVente;
  numero: string; // Ex: DEV-2026-001 ou FAC-2026-001
  dateEmission: string; // YYYY-MM-DD
  dateEcheance: string; // YYYY-MM-DD
  prospectId?: string; // liaison optionnelle avec le pipeline
  clientNom: string;
  clientEmail?: string;
  clientTelephone?: string;
  clientAdresse?: string;
  emetteurNom: string;
  emetteurContact: string;
  emetteurAdresse?: string;
  devise: string; // "FCFA", "EUR", "USD"
  articles: ArticleDocument[];
  remise: number;
  acompteRequis: number; // ex: montant ou pourcentage
  conditionsPaiement: string;
  notes: string;
  statut: StatutDocumentVente;
  createdAt: string;
  updatedAt: string;
};

export const LABEL_STATUT_DOC: Record<StatutDocumentVente, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  paye: "Payé",
  annule: "Annulé",
};

// ---- Profils de compétences freelances (Collection skills) -------------------

export type MessagePlaybook = {
  system_rules: string[]; // Consignes de rédaction propres à la compétence
  angle_probleme: string; // Modèle/structure d'angle problème
  angle_opportunite: string; // Modèle/structure d'angle opportunité
  gestion_objections: Record<string, string>; // Réponses aux objections (pas_de_budget, pas_le_temps, deja_quelquun)
  sequence_relances: string[]; // 3 à 4 relances espacées
};

export type SkillDoc = {
  id: string; // ex: "developpement_web", "copywriting", "montage_video", "graphisme_branding", "communaute_ads", "personnalise"
  name: string; // ex. « Développement web »
  nom_court?: string;
  emoji?: string;
  icone?: string; // Classe FontAwesome
  target_niches: string[]; // types de prospects (ex. cliniques, restaurants, écoles)
  search_keywords: Record<string, string[]> | string[]; // mots-clés Maps/Google par niche
  signals: string[]; // ce qui rend un prospect qualifié pour cette compétence (ex. web : pas de site ou site lent)
  offer_angle: string; // le problème que cette compétence résout
  message_playbook: MessagePlaybook;
  is_custom?: boolean;
  updated_at?: string;
};

