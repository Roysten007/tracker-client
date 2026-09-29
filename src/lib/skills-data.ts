// Définition officielle des profils de compétences (Étape 1 du moteur Sprint Machine).
// Chaque profil définit ses niches cibles, mots-clés Maps/Google, signaux de qualification,
// angle d'offre et playbook de prospection complet.

import type { SkillDoc } from "./types";

export const SKILLS_DEFAUT: Record<string, SkillDoc> = {
  developpement_web: {
    id: "developpement_web",
    name: "Développement Web & No-code",
    nom_court: "Dev Web",
    emoji: "💻",
    icone: "fa-solid fa-code",
    target_niches: [
      "Cliniques & Centres médicaux",
      "Restaurants gastronomiques & Lounges",
      "Écoles privées & Académies",
      "Agences immobilières & Promoteurs",
      "Cabinets d'avocats & Notaires",
      "Entreprises BTP & Architecture",
    ],
    search_keywords: {
      "Cliniques & Centres médicaux": [
        "clinique dentaire soins",
        "centre médical cardiologie",
        "laboratoire analyses médicales",
      ],
      "Restaurants gastronomiques & Lounges": [
        "restaurant gastronomique",
        "lounge bar rooftop",
        "restaurant traiteur",
      ],
      "Écoles privées & Académies": [
        "école privée bilingue",
        "institut supérieur formation",
        "académie privée",
      ],
      "Agences immobilières & Promoteurs": [
        "agence immobilière vente",
        "promoteur immobilier résidence",
        "gestion locative appartement",
      ],
      "Cabinets d'avocats & Notaires": [
        "cabinet avocat affaires",
        "notaire étude notariale",
      ],
      "Entreprises BTP & Architecture": [
        "entreprise btp construction",
        "cabinet architecture bâtiment",
      ],
    },
    signals: [
      "Pas de site web officiel (fiche Google Maps sans site ou pointant sur Facebook)",
      "Site lent (> 6 secondes sur smartphone au test Google PageSpeed)",
      "Pas de bouton de réservation / commande WhatsApp direct en 1 clic",
      "Site non adapté aux smartphones (non responsive, texte trop petit)",
      "Site inaccessible ou certificat SSL invalide (erreur HTTP)",
    ],
    offer_angle:
      "Les clients qui cherchent votre établissement sur Google ne trouvent aucun site officiel pour commander ou réserver. Vous perdez chaque mois 15 à 30 clients qualifiés au profit de vos concurrents.",
    message_playbook: {
      system_rules: [
        "Ouvrir impérativement par une observation factuelle vérifiable sur leur présence Google/Web (chiffre de vitesse, lien manquant, note)",
        "Zéro présentation égocentrée : jamais de 'Je suis développeur web avec X années d'expérience'",
        "Un seul problème soulevé, une seule promesse concrète, une seule question fermée à la fin",
        "4 à 6 lignes max pour WhatsApp, ton professionnel, direct et respectueux",
        "Jamais de prix dans le premier message : demander le budget avant tout montant",
        "Preuve avant demande : proposer un aperçu gratuit de 30s ('Je vous envoie l'aperçu ?')",
      ],
      angle_probleme:
        "Bonjour {prenom_ou_nom}. J'ai remarqué que sur votre fiche Google Maps ({note_google}/5), vous n'avez pas de site web officiel (les clients sont renvoyés sur une page sans réservation directe). Avec votre réputation, vous perdez chaque semaine des clients qui ne savent pas comment commander rapidement. J'ai préparé une maquette mobile avec bouton WhatsApp direct pour votre établissement : je peux vous l'envoyer en 30 secondes ici ?",
      angle_opportunite:
        "Bonjour {prenom_ou_nom}. Félicitations pour vos {avis_google} avis sur Google Maps. En ajoutant un site vitrine ultra-rapide avec menu / catalogue WhatsApp en 1 clic, vous pourriez capter 20 à 30 commandes supplémentaires chaque mois directement depuis Google. J'ai conçu un aperçu interactif adapté à votre activité : je vous partage le lien ?",
      gestion_objections: {
        pas_de_budget:
          "Je comprends tout à fait. C'est justement pour cela qu'on commence par un système rentable dès le premier mois qui s'amortit en 2 ou 3 commandes WhatsApp. Quel serait votre budget idéal pour tester sans risque ?",
        pas_le_temps:
          "Je m'occupe de 100% de la conception, de la rédaction et de la mise en ligne. Vous avez juste à valider l'aperçu que je vous envoie sur WhatsApp en 2 minutes.",
        deja_quelquun:
          "Très bien ! Gardez mon contact si jamais vous avez besoin d'une refonte express ultra-rapide ou d'un module de commande WhatsApp direct. Voulez-vous quand même jeter un œil à l'audit de performance de votre site ?",
      },
      sequence_relances: [
        "R1 (+2j) : Bonjour {nom}, avez-vous pu jeter un œil à la capture de la maquette ? J'ai testé le temps de chargement sur smartphone, on gagne 4 secondes de fluidité.",
        "R2 (+4j) : Bonjour {nom}, juste un chiffre concret : 70% des clients qui cherchent un {niche} sur Google abandonnent s'il n'y a pas de lien WhatsApp direct. Je vous garde la maquette de côté cette semaine ?",
        "R3 (+7j) : Bonjour {nom}, je boucle les projets web du mois ce vendredi. Si le sujet du site n'est pas votre priorité actuelle, aucun problème, dites-le moi simplement et je ne vous dérange plus !",
      ],
    },
  },

  copywriting: {
    id: "copywriting",
    name: "Copywriting & Pages de Vente",
    nom_court: "Copywriting",
    emoji: "✍️",
    icone: "fa-solid fa-pen-fancy",
    target_niches: [
      "Formateurs & Coachs professionnels",
      "Cabinets de conseil & Stratégie",
      "Startups & SaaS B2B",
      "Agences de voyage & Tourisme",
      "E-commerce & Boutiques spécialisées",
    ],
    search_keywords: {
      "Formateurs & Coachs professionnels": [
        "coach professionnel exécutif",
        "cabinet formation management",
        "organisme certification pro",
      ],
      "Cabinets de conseil & Stratégie": [
        "cabinet conseil stratégie",
        "consultant management audit",
      ],
      "Startups & SaaS B2B": [
        "solution logicielle b2b",
        "éditeur logiciel gestion",
      ],
      "Agences de voyage & Tourisme": [
        "agence voyage sur mesure",
        "tour opérateur safari circuit",
      ],
      "E-commerce & Boutiques spécialisées": [
        "boutique en ligne produits bio",
        "vente en ligne créateur",
      ],
    },
    signals: [
      "Textes de présentation descriptifs sans promesse de transformation concrète",
      "Absence d'appel à l'action (CTA) clair et répété sur les pages",
      "Aucune réponse visible aux objections majeures (prix, temps, garantie)",
      "Absence de témoignages clients structurés (avant/après)",
      "Vocabulaire trop technique et centré sur soi plutôt que sur le bénéfice client",
    ],
    offer_angle:
      "Vos prospects visitent vos pages mais ne passent pas à l'action parce que vos textes parlent de caractéristiques techniques au lieu d'aborder leurs douleurs réelles et de dissiper leurs doutes d'achat.",
    message_playbook: {
      system_rules: [
        "Citer une phrase exacte ou un titre de leur site pour prouver qu'on a réellement lu leur contenu",
        "Démontrer en 1 ligne pourquoi leur formulation actuelle freine la conversion",
        "Proposer 2 titres accrocheurs réécrits gratuitement comme preuve d'expertise",
        "Longueur : 4 à 6 lignes nettes, ton consultant percutant et respectueux",
        "Clôturer par une proposition sans risque : 'Je vous envoie les 2 variantes réécrites ?'",
      ],
      angle_probleme:
        "Bonjour {prenom_ou_nom}. J'ai lu la présentation de votre offre sur votre site. Votre promesse est solide, mais le titre actuel reste très technique : vos visiteurs ne perçoivent pas immédiatement le retour sur investissement de votre accompagnement. J'ai réécrit 2 variantes d'accroches persuasives orientées résultat pour votre cible : je vous les partage en 2 lignes ?",
      angle_opportunite:
        "Bonjour {prenom_ou_nom}. Vous avez une réputation remarquable avec vos {avis_google} avis. En reformulant simplement vos 3 premières sections pour répondre directement aux 2 objections majeures de vos clients, vous pourriez convertir 30% de vos lecteurs actuels en appels qualifiés. J'ai préparé un exemple avant/après : je peux vous l'envoyer ?",
      gestion_objections: {
        pas_de_budget:
          "Une page bien rédigée s'auto-finance dès la première vente supplémentaire générée. Combien vous rapporte en moyenne un client signé chez vous ?",
        pas_le_temps:
          "Tout ce dont j'ai besoin, c'est d'un vocal de 10 minutes sur WhatsApp où vous m'expliquez votre offre comme à un ami. Je m'occupe de toute la rédaction.",
        deja_quelquun:
          "Très bien ! Si jamais vous avez une campagne clé ou une page de vente monoproduit où vous souhaitez tester un split-test pour battre vos taux actuels, faites-moi signe.",
      },
      sequence_relances: [
        "R1 (+2j) : Bonjour {nom}, avez-vous pu jeter un œil aux deux titres réécrits ? Celui orienté gain de temps résonne particulièrement bien avec vos clients cibles.",
        "R2 (+4j) : Bonjour {nom}, une statistique rapide : 80% des abandons sur une offre viennent d'une objection non traitée dès la première page. Je vous envoie le plan en 5 étapes ?",
        "R3 (+7j) : Bonjour {nom}, je classe mes dossiers copywriting du mois cette semaine. Si réécrire vos textes n'est pas prioritaire ce trimestre, aucun souci, tenez-moi au courant à l'occasion !",
      ],
    },
  },

  montage_video: {
    id: "montage_video",
    name: "Montage Vidéo & Formats Courts (Reels/TikTok)",
    nom_court: "Montage Vidéo",
    emoji: "🎬",
    icone: "fa-solid fa-video",
    target_niches: [
      "Salles de sport & Coachs fitness",
      "Restaurants & Bars branchés",
      "Immobilier de standing & Architectes",
      "Créateurs de contenu & Conférenciers",
      "Marques cosmétiques & Prêt-à-porter",
    ],
    search_keywords: {
      "Salles de sport & Coachs fitness": [
        "salle de sport fitness club",
        "coach sportif privé",
        "crossfit box entraînement",
      ],
      "Restaurants & Bars branchés": [
        "restaurant lounge rooftop",
        "bar tapas branché",
        "brunch restaurant terrasse",
      ],
      "Immobilier de standing & Architectes": [
        "agence immobilière prestige",
        "architecte villa moderne",
      ],
      "Créateurs de contenu & Conférenciers": [
        "conférencier motivation",
        "créateur formation business",
      ],
      "Marques cosmétiques & Prêt-à-porter": [
        "marque cosmétique naturelle",
        "boutique mode créateur",
      ],
    },
    signals: [
      "Absence totale de vidéos courtes verticales (Reels / TikTok / Shorts)",
      "Vidéos brutes sans accroche (hook) dans les 3 premières secondes",
      "Absence de sous-titres dynamiques (80% des utilisateurs regardent sans son)",
      "Qualité audio médiocre ou musique inadaptée au format court",
      "Publications photo classiques générant 10 fois moins de portée que les Reels",
    ],
    offer_angle:
      "Vos publications photos n'atteignent plus que 5% de vos abonnés. Les formats courts (Reels/TikTok) dynamiques avec sous-titres permettent de toucher 5 000 à 50 000 personnes locales chaque semaine sans payer de publicité.",
    message_playbook: {
      system_rules: [
        "Pointer un fait vérifiable sur leur compte (dernière vidéo sans sous-titre, ou absence de Reels récents)",
        "Proposer de monter un extrait d'essai de 15 à 30 secondes gratuit à partir d'une de leurs vidéos existantes",
        "Longueur : 4 à 5 lignes percutantes",
        "Mettre en avant la rétention (hooks, sous-titres animés, sound design)",
        "Clôturer par : 'Je vous monte un extrait test de 20s gratuitement pour que vous jugiez du résultat ?'",
      ],
      angle_probleme:
        "Bonjour {prenom_ou_nom}. J'ai regardé vos dernières publications : vos prestations sont top, mais vos vidéos n'ont pas de sous-titres animés ni d'accroche dans les 3 premières secondes. Sachant que 80% des gens regardent sans son sur mobile, vous perdez la majorité de l'attention. J'ai récupéré un extrait de 15s de votre compte et je l'ai monté au format viral : je peux vous montrer le résultat ?",
      angle_opportunite:
        "Bonjour {prenom_ou_nom}. Votre établissement à {ville} a un potentiel visuel énorme. En publiant 3 Reels dynamiques par semaine avec des hooks calibrés pour l'algorithme, vous pourriez doubler vos réservations locales ce mois-ci. J'ai monté un exemple dynamique de 20s pour vous : je vous le transmets ici ?",
      gestion_objections: {
        pas_de_budget:
          "On commence avec un pack d'essai de 4 vidéos courtes. Si une seule vidéo vous amène 2 nouveaux clients, le montage est déjà 100% remboursé.",
        pas_le_temps:
          "Vous filmez simplement des séquences brutes de 10 secondes avec votre smartphone pendant votre travail et vous me les déposez sur WhatsApp. Je m'occupe de tout le tri, montage, sous-titres et habillage.",
        deja_quelquun:
          "Parfait ! Si vous avez besoin d'un monteur réactif en renfort pour absorber vos pics de contenu ou tester un style plus percutant, gardez mon contact.",
      },
      sequence_relances: [
        "R1 (+2j) : Bonjour {nom}, avez-vous pu regarder le court extrait monté ? Le format avec sous-titres génère en moyenne 3 fois plus de partages.",
        "R2 (+4j) : Bonjour {nom}, la vidéo courte reste le seul format encore poussé gratuitement par Instagram et TikTok cette année. Si vous voulez tester 4 vidéos ce mois-ci, dites-le moi !",
        "R3 (+7j) : Bonjour {nom}, je finalise mes plannings de montage pour le mois. Si la vidéo n'est pas votre priorité pour l'instant, je ne vous relance plus. Excellente continuation !",
      ],
    },
  },

  graphisme_branding: {
    id: "graphisme_branding",
    name: "Graphisme & Identité de Marque",
    nom_court: "Graphisme",
    emoji: "🎨",
    icone: "fa-solid fa-palette",
    target_niches: [
      "Hôtels de charme & Hébergements",
      "Restaurants & Salons de thé",
      "Instituts de beauté & Spas",
      "Marques de produits locaux & Agroalimentaire",
      "Événementiel & Salons professionnels",
    ],
    search_keywords: {
      "Hôtels de charme & Hébergements": [
        "hôtel boutique de charme",
        "résidence hôtelière standing",
        "lodge écolodge touristique",
      ],
      "Restaurants & Salons de thé": [
        "restaurant cuisine raffinée",
        "salon de thé pâtisserie fine",
        "café bistrot gourmet",
      ],
      "Instituts de beauté & Spas": [
        "institut beauté spa soins",
        "salon esthétique bien-être",
      ],
      "Marques de produits locaux & Agroalimentaire": [
        "marque jus naturels bio",
        "chocolaterie artisanale",
        "épicerie fine terroir",
      ],
      "Événementiel & Salons professionnels": [
        "agence événementielle organisation",
        "salon foire exposition",
      ],
    },
    signals: [
      "Logo pixelisé ou étiré sur la fiche Google Maps et les réseaux sociaux",
      "Incohérence totale des couleurs et polices d'une publication à l'autre",
      "Menus, tarifs ou catalogues peu lisibles ou au format PDF lourd sur mobile",
      "Visuels Canva génériques vus et revus chez les concurrents",
      "Image perçue très en-dessous de la qualité réelle des services",
    ],
    offer_angle:
      "Vos avis clients ({note_google}/5) prouvent la grande qualité de votre service, mais votre identité visuelle actuelle donne une impression amateur qui vous empêche de facturer à votre juste valeur.",
    message_playbook: {
      system_rules: [
        "Féliciter pour la qualité du service réel (avis, réputation) avant d'aborder la faille visuelle",
        "Pointer avec délicatesse un élément précis (logo basse définition, menu illisible sur smartphone)",
        "Proposer un aperçu d'amélioration visuelle gratuit",
        "Longueur : 4 à 5 lignes directes et élégantes",
        "Invitation à voir l'aperçu sans engagement",
      ],
      angle_probleme:
        "Bonjour {prenom_ou_nom}. Vos {avis_google} avis sur Google confirment l'excellence de votre service. En revanche, votre logo et vos visuels actuels sur mobile sont pixelisés et ne reflètent pas le standing de votre établissement. J'ai préparé une version modernisée et ultra-nette de votre identité pour les réseaux et la fiche Google : je peux vous la montrer ?",
      angle_opportunite:
        "Bonjour {prenom_ou_nom}. Votre établissement a tous les atouts pour attirer une clientèle premium à {ville}. Avec une identité visuelle épurée et des supports de présentation impeccables sur smartphone, vous justifierez facilement des tarifs plus élevés. J'ai réalisé un aperçu de carte de visite / menu digital adapté à votre univers : vous souhaitez voir ?",
      gestion_objections: {
        pas_de_budget:
          "Une belle identité vous permet d'augmenter vos prix de 15% à 20% dès le premier jour car la valeur perçue de votre marque change du tout au tout.",
        pas_le_temps:
          "Je vous prépare 3 propositions créatives clé en main. Vous choisissez celle qui vous plaît le plus en 5 minutes et je décline tous vos supports.",
        deja_quelquun:
          "C'est parfait ! Si un jour vous avez besoin d'une déclinaison urgente de supports ou d'un regard neuf pour un événement spécial, gardez mon contact.",
      },
      sequence_relances: [
        "R1 (+2j) : Bonjour {nom}, avez-vous pu jeter un coup d'œil à l'aperçu de refonte du logo ? Le rendu haute définition sur smartphone change radicalement l'allure de la marque.",
        "R2 (+4j) : Bonjour {nom}, 90% de la première impression d'un client se fait sur le visuel en moins de 3 secondes. Si vous voulez rafraîchir vos supports ce mois-ci, je suis à votre disposition.",
        "R3 (+7j) : Bonjour {nom}, je clos mes créneaux de création pour le mois. Si ce rafraîchissement visuel n'est pas à l'ordre du jour, pas de problème du tout. Très bonne continuation !",
      ],
    },
  },

  communaute_ads: {
    id: "communaute_ads",
    name: "Community Management & Ads (Meta / Google)",
    nom_court: "CM & Ads",
    emoji: "📢",
    icone: "fa-solid fa-bullhorn",
    target_niches: [
      "Boutiques de mode & Prêt-à-porter",
      "Salons de coiffure & Esthétique",
      "Concessionnaires & Garages auto",
      "Services de rénovation & Dépannage",
      "Cliniques dentaires & Soins privés",
    ],
    search_keywords: {
      "Boutiques de mode & Prêt-à-porter": [
        "boutique vêtements homme femme",
        "chaussures maroquinerie tendance",
      ],
      "Salons de coiffure & Esthétique": [
        "salon de coiffure visagiste",
        "barbershop salon homme",
      ],
      "Concessionnaires & Garages auto": [
        "garage réparation automobile",
        "vente véhicules occasion révisés",
      ],
      "Services de rénovation & Dépannage": [
        "entreprise rénovation intérieure",
        "plomberie électricité dépannage",
      ],
      "Cliniques dentaires & Soins privés": [
        "cabinet dentaire implantologie",
        "centre ophtalmologique soins",
      ],
    },
    signals: [
      "Dernière publication sur les réseaux sociaux datant de plus d'un mois",
      "Messages et commentaires de clients laissés sans réponse",
      "Aucune publicité sponsorisée active pour capter les recherches locales",
      "Publications sans engagement ni bouton de contact direct vers WhatsApp",
      "Aucune mise en avant des offres promotionnelles ou temps forts",
    ],
    offer_angle:
      "Votre page est en sommeil ou attire peu de demandes concrètes. Une présence animée avec des publicités locales ciblées vers votre WhatsApp peut vous générer 10 à 25 nouveaux contacts clients par semaine.",
    message_playbook: {
      system_rules: [
        "Mentionner la date ou l'inactivité de leur dernière publication pour appuyer sur le fait réel",
        "Mettre en avant le coût de l'invisibilité (les clients vont chez ceux qui sont actifs sur les réseaux)",
        "Proposer un plan de 7 jours de contenu + ciblage WhatsApp prêt à déployer",
        "Ton dynamique, orienté flux de clients direct",
        "Question finale sur leur capacité à accueillir de nouveaux clients",
      ],
      angle_probleme:
        "Bonjour {prenom_ou_nom}. J'ai vu que votre page Facebook/Instagram n'a plus de publication depuis plusieurs semaines, alors que la demande pour votre activité à {ville} est très forte en ce moment. Quand un client hésite, il choisit l'établissement qui paraît le plus actif. J'ai conçu un plan de 5 publications locales avec bouton WhatsApp direct : je peux vous l'envoyer ?",
      angle_opportunite:
        "Bonjour {prenom_ou_nom}. Avec une note de {note_google}/5 sur Google, vous avez déjà la confiance de vos clients. En lançant une petite campagne ciblée sur votre quartier renvoyant directement sur votre WhatsApp, vous pourriez facilement remplir vos créneaux creux de la semaine. J'ai préparé une simulation de campagne locale : je vous l'envoie ?",
      gestion_objections: {
        pas_de_budget:
          "On peut commencer avec un budget publicitaire de seulement 2 000 à 3 000 FCFA par jour pour tester et valider le coût par contact WhatsApp généré.",
        pas_le_temps:
          "Je prends tout en charge : rédaction des posts, création des visuels, programmation et gestion des publicités sponsorisées. Vous n'avez qu'à répondre aux clients qui vous écrivent sur WhatsApp.",
        deja_quelquun:
          "Super ! Si vous souhaitez faire un audit gratuit de vos campagnes actuelles pour vérifier si votre coût par message WhatsApp peut être réduit, faites-moi signe.",
      },
      sequence_relances: [
        "R1 (+2j) : Bonjour {nom}, avez-vous pu jeter un œil au plan de publication test ? Il permet de relancer la visibilité de votre page sans y passer des heures.",
        "R2 (+4j) : Bonjour {nom}, un concurrent direct sur votre secteur a relancé ses pubs WhatsApp cette semaine. Si vous souhaitez réactiver votre flux de prospects, je suis disponible.",
        "R3 (+7j) : Bonjour {nom}, je boucle mes accompagnements du mois ce vendredi. Si vous préférez gérer la communication en interne, je comprends parfaitement. Bonne continuation !",
      ],
    },
  },

  personnalise: {
    id: "personnalise",
    name: "Profil Personnalisé (Mon Métier)",
    nom_court: "Personnalisé",
    emoji: "⭐",
    icone: "fa-solid fa-wand-magic-sparkles",
    is_custom: true,
    target_niches: [
      "Votre niche prioritaire 1",
      "Votre niche prioritaire 2",
      "Votre niche prioritaire 3",
    ],
    search_keywords: {
      "Votre niche prioritaire 1": [
        "mot-clé recherche 1",
        "mot-clé recherche 2",
      ],
      "Votre niche prioritaire 2": [
        "mot-clé recherche 3",
        "mot-clé recherche 4",
      ],
    },
    signals: [
      "Critère / Faille n°1 qui qualifie immédiatement le prospect chez vous",
      "Critère / Faille n°2 (ex: manque d'un élément précis)",
      "Critère / Faille n°3 (ex: mauvaise expérience client visible)",
    ],
    offer_angle:
      "Le problème précis et mesurable que votre compétence résout pour votre client cible, et ce que cela lui fait gagner.",
    message_playbook: {
      system_rules: [
        "Ouvrir par un fait précis vérifiable sur le prospect",
        "Un seul problème, une seule idée, une seule question à la fin",
        "4 à 6 lignes max pour WhatsApp, ton humain, pas de jargon",
        "Demander le budget avant d'annoncer un prix",
        "Proposer un aperçu ou un petit pas concret avant de chercher à vendre",
      ],
      angle_probleme:
        "Bonjour {prenom_ou_nom}. J'ai remarqué une faille précise sur votre présence : {faille_observee}. Avec votre réputation de {note_google}/5, cela vous fait perdre des opportunités chaque semaine. J'ai préparé une solution concrète adaptée à votre activité : je peux vous l'envoyer en 30 secondes ?",
      angle_opportunite:
        "Bonjour {prenom_ou_nom}. Vos {avis_google} avis sur Google témoignent de la qualité de votre service. En mettant en place {opportunite_cle}, vous pourriez capter de nouveaux clients qualifiés dès ce mois-ci. J'ai préparé un aperçu concret : je vous le partage ?",
      gestion_objections: {
        pas_de_budget:
          "Je comprends tout à fait. Quel serait le budget réaliste avec lequel vous seriez à l'aise pour tester une première étape rentable ?",
        pas_le_temps:
          "Je prends en charge toute l'exécution technique et la mise en place. Votre implication se résume à valider l'aperçu en 2 minutes sur WhatsApp.",
        deja_quelquun:
          "C'est noté ! Gardez mes coordonnées sous la main si jamais vous avez besoin d'un second regard ou d'un renfort ponctuel sur un projet urgent.",
      },
      sequence_relances: [
        "R1 (+2j) : Bonjour {nom}, avez-vous pu jeter un œil à l'aperçu préparé ? Je reste à votre disposition si vous avez la moindre question.",
        "R2 (+4j) : Bonjour {nom}, juste un rappel rapide pour savoir si ce sujet fait partie de vos priorités ce trimestre.",
        "R3 (+7j) : Bonjour {nom}, je finalise mes plannings du mois. Si ce n'est pas le bon timing pour vous, pas d'inquiétude, je ne vous relance plus !",
      ],
    },
  },
};
