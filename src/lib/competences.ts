// Définition des compétences freelances numériques prises en charge par Sprint Machine.
// Permet d'adapter l'angle d'audit, les opportunités et les pitchs WhatsApp
// que le freelance soit Développeur, Graphiste, Copywriter, Monteur Vidéo ou Community Manager.

export type CompetenceId =
  | "developpeur_web"
  | "graphiste_designer"
  | "copywriter"
  | "monteur_video"
  | "community_manager";

export type CompetenceConfig = {
  id: CompetenceId;
  label: string;
  nomCourt: string;
  icone: string; // FontAwesome class
  emoji: string;
  slogan: string;
  offres: string[];
  faillesTypiques: string[];
  motsClesRecommandes: string[];
  accrocheWhatsAppDefaut: (entreprise: string, faille: string) => string;
};

export const COMPETENCES_FREELANCE: Record<CompetenceId, CompetenceConfig> = {
  developpeur_web: {
    id: "developpeur_web",
    label: "Développeur Web & No-code",
    nomCourt: "Dev Web",
    icone: "fa-solid fa-code",
    emoji: "💻",
    slogan: "Sites vitrines ultra-rapides, landing pages et commandes WhatsApp",
    offres: [
      "Site vitrine haute conversion & commande WhatsApp directe (5 jours)",
      "Refonte mobile ultra-rapide (Score Google PageSpeed 90+)",
      "Landing page de vente monoproduit",
      "Catalogue digital & menu interactif WhatsApp",
      "Application web de gestion sur mesure",
    ],
    faillesTypiques: [
      "Absence totale de site web officiel (invisible sur Google Web)",
      "Site lent (>7 secondes sur smartphone au test PageSpeed)",
      "Site non adapté au mobile / pas responsive",
      "Pas de bouton WhatsApp direct en 1 clic",
      "Formulaire de contact cassé ou boîte mail non consultée",
    ],
    motsClesRecommandes: [
      "Clinique dentaire & Soins",
      "Agence immobilière",
      "Restaurant gastronomique & Lounge",
      "Entreprise BTP & Architecture",
      "Cabinet d'avocats & Notaires",
      "École privée & Académie",
    ],
    accrocheWhatsAppDefaut: (entreprise, faille) =>
      `Bonjour l'équipe de ${entreprise}. Quand on vous cherche sur Google, vous n'avez pas de site web officiel pour guider vos clients (ou votre site est très lent sur smartphone). Je peux vous concevoir une vitrine moderne livrée en 5 jours avec bouton WhatsApp direct ?`,
  },

  graphiste_designer: {
    id: "graphiste_designer",
    label: "Graphiste & Designer de Marque",
    nomCourt: "Graphiste",
    icone: "fa-solid fa-palette",
    emoji: "🎨",
    slogan: "Identités visuelles premium, logos vectoriels et supports de vente",
    offres: [
      "Refonte d'identité visuelle & Logo vectoriel HD + Charte graphique",
      "Menu de restaurant & Carte de boissons design haute définition",
      "Pack Réseaux Sociaux : 15 templates Canva/Figma premium et prêts à poster",
      "Packaging produit & Étiquettes haut de gamme",
      "Affiches publicitaires, flyers et bannières kakemono",
    ],
    faillesTypiques: [
      "Logo pixélisé / amateur / flou sur Google Maps ou les réseaux",
      "Menu de restaurant illisible sous forme de simple photo WhatsApp",
      "Absence totale de cohérence graphique entre les publications",
      "Visuels publicitaires de faible qualité qui dévalorisent les prix",
      "Packaging générique sans signature de marque marquante",
    ],
    motsClesRecommandes: [
      "Restaurant & Bar lounge",
      "Prêt-à-porter & Marque de mode",
      "Marque de cosmétique & Soins",
      "Pâtisserie & Traiteur événementiel",
      "Salon de coiffure & Beauté",
      "Agroalimentaire & Produits locaux",
    ],
    accrocheWhatsAppDefaut: (entreprise, faille) =>
      `Bonjour l'équipe de ${entreprise}. Vos produits/services sont excellents, mais votre identité visuelle actuelle (logo et visuels) ne reflète pas le standing que vous méritez. Je peux vous moderniser votre charte graphique et votre logo d'ici 3 jours pour justifier des tarifs 30% plus élevés ?`,
  },

  copywriter: {
    id: "copywriter",
    label: "Copywriter & Rédacteur de Vente",
    nomCourt: "Copywriting",
    icone: "fa-solid fa-pen-nib",
    emoji: "✍️",
    slogan: "Mots qui vendent, pages de vente persuasives et tunnels WhatsApp",
    offres: [
      "Page de vente haute conversion (Copywriting chirurgical)",
      "Séquence de relance WhatsApp automatique (M1 à M6)",
      "Pack de 10 posts LinkedIn/Facebook engageants et vendeurs",
      "Réécriture de bio de marque & Proposition de valeur magnétique",
      "Fiches descriptives de produits axées sur les bénéfices clients",
    ],
    faillesTypiques: [
      "Textes froids et institutionnels qui n'incitent pas à l'achat",
      "Absence de proposition de valeur claire (on ne comprend pas le bénéfice en 5s)",
      "Bio Instagram ou Facebook vide sans appel à l'action précis",
      "Messages de prospection WhatsApp trop longs et ignorés",
      "Fiches produits qui listent des caractéristiques au lieu d'émotions",
    ],
    motsClesRecommandes: [
      "Coaching & Formation professionnelle",
      "Agence immobilière de standing",
      "Cabinet de conseil & Recrutement",
      "E-commerce & Boutiques de luxe",
      "Infopreneurs & Créateurs de contenu",
      "Clinique esthétique & Bien-être",
    ],
    accrocheWhatsAppDefaut: (entreprise, faille) =>
      `Bonjour. Votre offre chez ${entreprise} a un potentiel énorme, mais vos textes actuels restent trop techniques et ne déclenchent pas le passage à l'action. Je peux vous réécrire votre pitch et votre page de vente pour doubler votre taux de conversion ?`,
  },

  monteur_video: {
    id: "monteur_video",
    label: "Monteur Vidéo & Reels / TikTok",
    nomCourt: "Monteur Vidéo",
    icone: "fa-solid fa-film",
    emoji: "🎬",
    slogan: "Vidéos courtes captivantes, Reels/Shorts rythmés et pubs percutantes",
    offres: [
      "Pack de 8 Reels / TikTok ultra-dynamiques avec sous-titres animés et sound design",
      "Spot vidéo publicitaire 30 secondes pour Meta & TikTok Ads",
      "Visite vidéo immersive de l'établissement / clinique / restaurant",
      "Montage captivant d'interviews et témoignages clients",
      "Retouches colorimétriques et dynamisation de rushs bruts",
    ],
    faillesTypiques: [
      "Zéro présence vidéo sur TikTok ou Instagram Reels malgré un beau cadre",
      "Vidéos tremblantes, sans musique captivante ni sous-titres animés",
      "Vidéos trop longues (>90s) avec un taux de rétention quasi nul",
      "Absence de vidéos publicitaires au format vertical 9:16",
      "Contenu statique qui ne génère aucun partage ni viralité",
    ],
    motsClesRecommandes: [
      "Restaurant gastronomique & Lounge VIP",
      "Salle de sport & Fitness club",
      "Hôtel de charme & Resorts balnéaires",
      "Salon d'esthétique & Spa",
      "Agence immobilière (visites de villas)",
      "Marque de vêtements & Mode",
    ],
    accrocheWhatsAppDefaut: (entreprise, faille) =>
      `Bonjour l'équipe de ${entreprise} ! Votre cadre et vos prestations sont superbes, mais vous ne publiez aucune vidéo courte dynamique sur Instagram/TikTok pour captiver les clients. Je peux vous monter 4 Reels percutants avec sous-titres animés cette semaine pour tester ?`,
  },

  community_manager: {
    id: "community_manager",
    label: "Community Manager & Ads (Acquisition)",
    nomCourt: "Ads & Social",
    icone: "fa-solid fa-bullhorn",
    emoji: "🚀",
    slogan: "Campagnes Meta Ads rentables, gestion de communauté et flux de leads",
    offres: [
      "Campagne publicitaire Meta Ads ciblée géographiquement (génération de leads WhatsApp)",
      "Gestion mensuelle Instagram/Facebook : 12 posts + stories quotidiennes",
      "Mise en place d'un tunnel d'acquisition publicitaire automatisé",
      "Audit de présence sociale & stratégie de contenu 30 jours",
      "Modération et réponse instantanée aux messages entrants",
    ],
    faillesTypiques: [
      "Page Facebook/Instagram inactive depuis plusieurs semaines",
      "Zéro campagne publicitaire sponsorisée active (dépendance au trafic organique nul)",
      "Commentaires et demandes de prix en MP laissés sans réponse",
      "Publications sans stratégie ni ciblage géographique local",
      "Budget publicitaire gaspillé avec le bouton 'Booster' inefficace",
    ],
    motsClesRecommandes: [
      "Boutique de prêt-à-porter & Chaussures",
      "Cabinet dentaire & Soins esthétiques",
      "Centre de formation pratique",
      "Restaurant & Service traiteur",
      "Promoteur immobilier & Terrains",
      "Prestateur de services B2B",
    ],
    accrocheWhatsAppDefaut: (entreprise, faille) =>
      `Bonjour l'équipe de ${entreprise}. Vos concurrents captent tous les nouveaux clients sur les réseaux grâce à des publicités ciblées. Je peux vous mettre en place une campagne Meta Ads rentable qui vous apporte 15 à 30 demandes WhatsApp qualifiées dès cette semaine ?`,
  },
};

export const LISTE_COMPETENCES = Object.values(COMPETENCES_FREELANCE);
