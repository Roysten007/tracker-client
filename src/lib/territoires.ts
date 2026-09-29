// Base de données territoriale complète pour le Radar de Prospection Sprint Machine.
// Contient tous les pays cibles, tous leurs départements / régions officielles,
// et les villes, communes et quartiers d'affaires stratégiques ("Maps au complet").

export type QuartierOuCommune = {
  nom: string;
  type?: "quartier_affaires" | "residentiel_luxe" | "commercial" | "centre_ville" | "commune";
  description?: string;
};

export type DepartementOuRegion = {
  id: string;
  nom: string;
  chefLieu?: string;
  villesEtQuartiers: (string | QuartierOuCommune)[];
};

export type PaysCible = {
  id: string;
  nom: string;
  drapeau: string;
  indicatif: string;
  devise: string;
  termeDepartement: "Département" | "Région" | "District" | "Province";
  departements: DepartementOuRegion[];
};

export const PAYS_CIBLES: PaysCible[] = [
  // =========================================================================
  // 1. BÉNIN 🇧🇯 (+229) — Les 12 Départements complets & leurs 77 communes/quartiers
  // =========================================================================
  {
    id: "benin",
    nom: "Bénin",
    drapeau: "🇧🇯",
    indicatif: "+229",
    devise: "FCFA",
    termeDepartement: "Département",
    departements: [
      {
        id: "littoral",
        nom: "Littoral (Cotonou)",
        chefLieu: "Cotonou",
        villesEtQuartiers: [
          { nom: "Cotonou - Haie Vive", type: "quartier_affaires", description: "Diplomates, expats, restaurants & cliniques privées" },
          { nom: "Cotonou - Cadjèhoun", type: "residentiel_luxe", description: "Résidentiel aisé, polycliniques et cabinets d'avocats" },
          { nom: "Cotonou - Ganhi (Centre Commercial)", type: "centre_ville", description: "Banques, assurances, grands sièges d'entreprises" },
          { nom: "Cotonou - Akpakpa", type: "commercial", description: "Zone commerciale très dense, PME, cliniques et BTP" },
          { nom: "Cotonou - Saint-Michel", type: "commercial", description: "Cabinets médicaux, optique, commerces de gros" },
          { nom: "Cotonou - Gbégamey", type: "commercial", description: "Écoles privées, commerces, services administratifs" },
          { nom: "Cotonou - Fidjrossè", type: "residentiel_luxe", description: "Tourisme balnéaire, bars, lounges, hébergements" },
          { nom: "Cotonou - Menontin", type: "commercial", description: "Commerces de proximité, quincailleries, centres médicaux" },
          { nom: "Cotonou - Agla", type: "commercial", description: "PME locales, artisans et commerces en forte expansion" },
          { nom: "Cotonou - Kouhounou / Stade", type: "commercial", description: "Événements, restaurants, complexes sportifs & santé" },
          { nom: "Cotonou - Zogbo / Sainte Rita", type: "commercial", description: "Boutiques, salons d'esthétique, pharmacies" },
          { nom: "Cotonou - Patte d'Oie / Maro-Militaire", type: "commercial", description: "Cabinets d'expertise, BTP et transitaires" },
        ],
      },
      {
        id: "atlantique",
        nom: "Atlantique (Abomey-Calavi, Ouidah...)",
        chefLieu: "Allada",
        villesEtQuartiers: [
          { nom: "Abomey-Calavi - Godomey", type: "commercial", description: "Plus grande cité dortoir d'Afrique, énorme réservoir de PME" },
          { nom: "Abomey-Calavi - Tankpè", type: "commercial", description: "Zone résidentielle et commerciale en plein boom" },
          { nom: "Abomey-Calavi - Akassato", type: "commercial", description: "Zone logistique, dépôts BTP et commerces de gros" },
          { nom: "Abomey-Calavi - Arconville / Zopah", type: "residentiel_luxe", description: "Villas modernes, cadres et professions libérales" },
          { nom: "Abomey-Calavi - Togoudo", type: "commercial", description: "Zone universitaire et commerces étudiants" },
          { nom: "Ouidah (Cité Historique)", type: "commercial", description: "Tourisme mémoriel, hôtels, musées et galeries" },
          { nom: "Allada", type: "commune", description: "Agroalimentaire, exploitations d'ananas et commerces" },
          { nom: "Kpomassè", type: "commune" },
          { nom: "Toffo", type: "commune" },
          { nom: "Tori-Bossito", type: "commune" },
          { nom: "Zè", type: "commune" },
        ],
      },
      {
        id: "oueme",
        nom: "Ouémé (Porto-Novo, Sèmè-Podji...)",
        chefLieu: "Porto-Novo",
        villesEtQuartiers: [
          { nom: "Porto-Novo - Centre & Ouando", type: "centre_ville", description: "Capitale administrative, ministères et grand marché Ouando" },
          { nom: "Porto-Novo - Avakpa & Djassin", type: "commercial", description: "Quartiers d'affaires et cliniques de Porto-Novo" },
          { nom: "Porto-Novo - Tokpota", type: "commercial", description: "Zone résidentielle et commerces modernes" },
          { nom: "Sèmè-Podji - Ekpè", type: "commercial", description: "Connexion directe avec Cotonou, zone résidentielle dense" },
          { nom: "Sèmè-Podji - Kraké / Frontière", type: "commercial", description: "Hub frontalier Nigéria, import/export et logistique" },
          { nom: "Sèmè-Podji - Djeffa", type: "commercial", description: "Tourisme de plage, réceptifs et restaurants" },
          { nom: "Adjarra", type: "commune", description: "Artisanat d'art, instruments de musique et commerces" },
          { nom: "Dangbo", type: "commune", description: "Vallée de l'Ouémé, agriculture et tourisme éco" },
          { nom: "Akpro-Missérété", type: "commune" },
        ],
      },
      {
        id: "borgou",
        nom: "Borgou (Parakou...)",
        chefLieu: "Parakou",
        villesEtQuartiers: [
          { nom: "Parakou - Centre Commercial & Zongo", type: "centre_ville", description: "Métropole du Nord, hub logistique et commercial" },
          { nom: "Parakou - Albarika (Université)", type: "commercial" },
          { nom: "Parakou - Titirou & Banikanni", type: "commercial" },
          { nom: "N'Dali", type: "commune" },
          { nom: "Bembéréké", type: "commune", description: "Hôpital évangélique réputé, cliniques et commerces" },
          { nom: "Tchaourou", type: "commune" },
          { nom: "Nikki", type: "commune", description: "Capitale royale Baatonu, culture et élevage" },
        ],
      },
      {
        id: "zou",
        nom: "Zou (Bohicon, Abomey...)",
        chefLieu: "Abomey",
        villesEtQuartiers: [
          { nom: "Bohicon - Carrefour Commercial", type: "centre_ville", description: "Véritable carrefour logistique et marchand du Bénin" },
          { nom: "Abomey (Cité Historique)", type: "commercial", description: "Palais royaux, musées, artisanat et réceptifs" },
          { nom: "Zakpota", type: "commune" },
          { nom: "Covè", type: "commune" },
          { nom: "Zogbodomey", type: "commune" },
          { nom: "Djidja", type: "commune" },
        ],
      },
      {
        id: "mono",
        nom: "Mono (Lokossa, Grand-Popo...)",
        chefLieu: "Lokossa",
        villesEtQuartiers: [
          { nom: "Grand-Popo (Plage & Tourisme)", type: "residentiel_luxe", description: "Hôtels de charme, lodges, écotourisme balnéaire" },
          { nom: "Lokossa - Centre", type: "centre_ville", description: "Préfecture, hôpital de zone et entreprises" },
          { nom: "Comé", type: "commercial", description: "Carrefour vers Lomé et grand marché" },
          { nom: "Athiémé", type: "commune" },
          { nom: "Bopa", type: "commune" },
          { nom: "Houéyogbé", type: "commune" },
        ],
      },
      {
        id: "couffo",
        nom: "Couffo (Aplahoué...)",
        chefLieu: "Aplahoué",
        villesEtQuartiers: [
          { nom: "Aplahoué", type: "centre_ville" },
          { nom: "Djakotomey", type: "commune" },
          { nom: "Klouékanmè", type: "commune" },
          { nom: "Dogbo", type: "commune" },
          { nom: "Lalo", type: "commune" },
          { nom: "Toviklin", type: "commune" },
        ],
      },
      {
        id: "atacora",
        nom: "Atacora (Natitingou...)",
        chefLieu: "Natitingou",
        villesEtQuartiers: [
          { nom: "Natitingou - Centre & Tourisme", type: "centre_ville", description: "Porte de la chaîne de l'Atacora et du parc Pendjari" },
          { nom: "Tanguiéta", type: "commune", description: "Hôpital réputé Saint-Jean de Dieu" },
          { nom: "Boukoumbé (Pays Tata Somba)", type: "commercial", description: "Patrimoine UNESCO, écotourisme" },
          { nom: "Kouandé", type: "commune" },
        ],
      },
      {
        id: "donga",
        nom: "Donga (Djougou...)",
        chefLieu: "Djougou",
        villesEtQuartiers: [
          { nom: "Djougou - Grand Carrefour Marchand", type: "centre_ville", description: "Grand carrefour commercial vers le Togo et le Burkina" },
          { nom: "Bassila", type: "commune" },
          { nom: "Copargo", type: "commune" },
          { nom: "Ouaké", type: "commune" },
        ],
      },
      {
        id: "alibori",
        nom: "Alibori (Kandi, Malanville...)",
        chefLieu: "Kandi",
        villesEtQuartiers: [
          { nom: "Malanville (Frontière Niger/Nigéria)", type: "commercial", description: "Port sec, méga-commerce de transit céréales et marchandises" },
          { nom: "Kandi - Centre", type: "centre_ville" },
          { nom: "Banikoara (Capitale de l'Or Blanc - Coton)", type: "commercial", description: "Forte concentration de coopératives et gros revenus agricoles" },
          { nom: "Gogounou", type: "commune" },
        ],
      },
      {
        id: "collines",
        nom: "Collines (Dassa, Savalou...)",
        chefLieu: "Dassa-Zoumè",
        villesEtQuartiers: [
          { nom: "Dassa-Zoumè (Cité des 41 Collines)", type: "centre_ville", description: "Sanctuaire marial, pèlerinages, réceptifs hôteliers" },
          { nom: "Savalou", type: "commune", description: "Fête de l'igname, culture et commerces agricoles" },
          { nom: "Savè", type: "commune", description: "Mamelles de Savè et carrefour ferroviaire" },
          { nom: "Glazoué", type: "commune", description: "Grand marché de céréales" },
        ],
      },
      {
        id: "plateau",
        nom: "Plateau (Pobé, Kétou...)",
        chefLieu: "Pobé",
        villesEtQuartiers: [
          { nom: "Pobé - Centre", type: "centre_ville", description: "Palmier à huile, usines et commerce frontalier" },
          { nom: "Kétou", type: "commune", description: "Siège royal Yoruba, carrefour agricole" },
          { nom: "Sakété", type: "commune" },
          { nom: "Ifangni", type: "commune" },
        ],
      },
    ],
  },

  // =========================================================================
  // 2. CÔTE D'IVOIRE 🇨🇮 (+225) — Districts & Régions
  // =========================================================================
  {
    id: "cote_ivoire",
    nom: "Côte d'Ivoire",
    drapeau: "🇨🇮",
    indicatif: "+225",
    devise: "FCFA",
    termeDepartement: "District",
    departements: [
      {
        id: "abidjan",
        nom: "District Autonome d'Abidjan",
        chefLieu: "Abidjan",
        villesEtQuartiers: [
          { nom: "Abidjan - Cocody (Angré / Riviera / Deux Plateaux)", type: "residentiel_luxe", description: "Quartier premium, cliniques huppées, écoles privées, restaurants" },
          { nom: "Abidjan - Le Plateau (Centre d'Affaires)", type: "quartier_affaires", description: "Sièges des multinationales, banques, ministères, cabinets d'avocats" },
          { nom: "Abidjan - Marcory (Zone 4 / Biétry)", type: "quartier_affaires", description: "Épicentre de la gastronomie, night-life, expats et commerces haut de gamme" },
          { nom: "Abidjan - Yopougon", type: "commercial", description: "Plus grande commune populaire de Côte d'Ivoire, densité commerciale record" },
          { nom: "Abidjan - Treichville", type: "commercial", description: "Zone portuaire, commerces de gros, clinique PISAM, artisanat" },
          { nom: "Abidjan - Koumassi", type: "commercial", description: "Zone industrielle, garages, métallurgie et commerce" },
          { nom: "Abidjan - Port-Bouët (Aéroport & Vridi)", type: "commercial", description: "Zone aéroportuaire, raffineries et plages" },
          { nom: "Abidjan - Adjamé", type: "commercial", description: "Carrefour commercial géant de l'Afrique de l'Ouest" },
          { nom: "Abidjan - Bingerville", type: "residentiel_luxe", description: "Cité verte en forte expansion immobilière" },
        ],
      },
      {
        id: "sud_comoe",
        nom: "Sud-Comoé (Grand-Bassam, Assinie...)",
        chefLieu: "Aboisso",
        villesEtQuartiers: [
          { nom: "Assinie-Mafia", type: "residentiel_luxe", description: "Resorts de luxe, villas de milliardaires, tourisme balnéaire d'élite" },
          { nom: "Grand-Bassam (Quartier France & Plages)", type: "commercial", description: "Patrimoine mondial UNESCO, hôtels de bord de mer" },
          { nom: "Aboisso", type: "commune" },
        ],
      },
      {
        id: "gbeke",
        nom: "Gbêkê (Bouaké...)",
        chefLieu: "Bouaké",
        villesEtQuartiers: [
          { nom: "Bouaké - Centre & Commerce", type: "centre_ville", description: "Deuxième ville du pays, hub textile et de transit" },
          { nom: "Bouaké - Nimbo & Kennedy", type: "commercial" },
          { nom: "Béoumi", type: "commune" },
          { nom: "Sakassou", type: "commune" },
        ],
      },
      {
        id: "san_pedro",
        nom: "San-Pédro (Bas-Sassandra)",
        chefLieu: "San-Pédro",
        villesEtQuartiers: [
          { nom: "San-Pédro - Port & Cité", type: "quartier_affaires", description: "1er port mondial d'exportation de cacao, géants du négoce" },
          { nom: "Sassandra (Tourisme Côtier)", type: "commercial" },
        ],
      },
      {
        id: "yamoussoukro",
        nom: "District de Yamoussoukro",
        chefLieu: "Yamoussoukro",
        villesEtQuartiers: [
          { nom: "Yamoussoukro - Centre & Basilique", type: "centre_ville", description: "Capitale politique, grandes écoles (INP-HB) et hôtels d'État" },
        ],
      },
      {
        id: "poro",
        nom: "Poro (Korhogo...)",
        chefLieu: "Korhogo",
        villesEtQuartiers: [
          { nom: "Korhogo - Centre", type: "centre_ville", description: "Capitale du Nord, coton, mines d'or et artisanat d'art" },
          { nom: "Ferkessédougou", type: "commune" },
        ],
      },
      {
        id: "haut_sassandra",
        nom: "Haut-Sassandra (Daloa...)",
        chefLieu: "Daloa",
        villesEtQuartiers: [
          { nom: "Daloa - Centre", type: "centre_ville", description: "Cœur de la boucle du cacao, négoce et coopératives" },
          { nom: "Issia", type: "commune" },
        ],
      },
    ],
  },

  // =========================================================================
  // 3. SÉNÉGAL 🇸🇳 (+221) — 14 Régions
  // =========================================================================
  {
    id: "senegal",
    nom: "Sénégal",
    drapeau: "🇸🇳",
    indicatif: "+221",
    devise: "FCFA",
    termeDepartement: "Région",
    departements: [
      {
        id: "dakar",
        nom: "Dakar (Capitale & Presqu'île)",
        chefLieu: "Dakar",
        villesEtQuartiers: [
          { nom: "Dakar - Almadies & Ngor", type: "residentiel_luxe", description: "Ambassades, restaurants gastronomiques, villas de standing" },
          { nom: "Dakar - Plateau (Centre des Affaires)", type: "quartier_affaires", description: "Sièges bancaires, ministères, cabinets d'avocats" },
          { nom: "Dakar - Mermoz & Sacré-Cœur", type: "commercial", description: "Cliniques médicales, agences digitales, cafés branchés" },
          { nom: "Dakar - Point E & Fann Résidence", type: "residentiel_luxe", description: "Quartier chic diplomatique et universitaire" },
          { nom: "Dakar - Yoff & Mamelles", type: "commercial", description: "Surfeurs, réceptifs touristiques, commerces" },
          { nom: "Dakar - Hann Maristes", type: "residentiel_luxe", description: "Cadres supérieurs, résidences modernes" },
          { nom: "Dakar - Guédiawaye & Pikine", type: "commercial", description: "Forte densité marchande et PME dynamiques" },
          { nom: "Diamniadio (Pôle Urbain)", type: "quartier_affaires", description: "Nouvelle ville administrative, parcs technologiques" },
          { nom: "Rufisque", type: "commercial" },
        ],
      },
      {
        id: "thies",
        nom: "Thiès (Saly, Mbour...)",
        chefLieu: "Thiès",
        villesEtQuartiers: [
          { nom: "Saly Portudal (Petite-Côte)", type: "residentiel_luxe", description: "Station balnéaire n°1, hôtels de luxe, résidences de retraités européens" },
          { nom: "Mbour - Centre & Port de Pêche", type: "commercial" },
          { nom: "Thiès - Centre-Ville", type: "centre_ville", description: "Cité du rail, artisanat des tapisseries et commerces" },
          { nom: "Somone & Popenguine", type: "residentiel_luxe", description: "Lagunes, hôtels de charme et résidences secondaires" },
          { nom: "Tivaouane", type: "commune", description: "Cité religieuse majeure" },
        ],
      },
      {
        id: "saint_louis",
        nom: "Saint-Louis (Ndar)",
        chefLieu: "Saint-Louis",
        villesEtQuartiers: [
          { nom: "Saint-Louis - Île Historique", type: "centre_ville", description: "Tourisme colonial, festival international de Jazz, hôtels d'époque" },
          { nom: "Saint-Louis - Sor & Guet Ndar", type: "commercial" },
          { nom: "Richard-Toll", type: "commercial", description: "Compagnie Sucrière Sénégalaise, agro-industrie" },
        ],
      },
      {
        id: "diourbel",
        nom: "Diourbel (Touba...)",
        chefLieu: "Diourbel",
        villesEtQuartiers: [
          { nom: "Touba (Métropole Religieuse)", type: "commercial", description: "2e agglomération du Sénégal, puissance marchande et importations massives" },
          { nom: "Mbacké", type: "commercial" },
          { nom: "Diourbel - Centre", type: "centre_ville" },
        ],
      },
      {
        id: "ziguinchor",
        nom: "Ziguinchor (Casamance)",
        chefLieu: "Ziguinchor",
        villesEtQuartiers: [
          { nom: "Cap Skirring", type: "residentiel_luxe", description: "Club Med, plages mythiques, hôtellerie internationale" },
          { nom: "Ziguinchor - Centre & Port", type: "centre_ville" },
        ],
      },
    ],
  },

  // =========================================================================
  // 4. TOGO 🇹🇬 (+228) — Les 5 Régions
  // =========================================================================
  {
    id: "togo",
    nom: "Togo",
    drapeau: "🇹🇬",
    indicatif: "+228",
    devise: "FCFA",
    termeDepartement: "Région",
    departements: [
      {
        id: "maritime",
        nom: "Région Maritime (Grand Lomé)",
        chefLieu: "Lomé",
        villesEtQuartiers: [
          { nom: "Lomé - Nyékonakpoè & Kodjoviakopé", type: "residentiel_luxe", description: "Ambassades, bars tendance, restaurants chics en front de mer" },
          { nom: "Lomé - Tokoin (Hôpital & Trésor)", type: "commercial", description: "Cliniques réputées, banques, universités" },
          { nom: "Lomé - Agoè-Nyivé", type: "commercial", description: "Nouvelle zone d'affaires, shopping malls et résidences modernes" },
          { nom: "Lomé - Hédzranawoé (Grand Marché)", type: "commercial", description: "Marché international de friperie et commerces d'importation" },
          { nom: "Lomé - Bè & Plage", type: "commercial" },
          { nom: "Lomé - Baguida", type: "residentiel_luxe", description: "Hôtels de bord de mer, résidences de standing" },
          { nom: "Lomé - Adidogomé", type: "commercial" },
          { nom: "Aného (Cité Historique)", type: "commercial", description: "Ancienne capitale côtière et tourisme" },
        ],
      },
      {
        id: "plateaux",
        nom: "Région des Plateaux (Kpalimé, Atakpamé...)",
        chefLieu: "Atakpamé",
        villesEtQuartiers: [
          { nom: "Kpalimé (Capitale Touristique)", type: "commercial", description: "Café, cacao, cascades, galeries d'artisanat et lodges écologiques" },
          { nom: "Atakpamé - Centre", type: "centre_ville" },
        ],
      },
      {
        id: "centrale",
        nom: "Région Centrale (Sokodé...)",
        chefLieu: "Sokodé",
        villesEtQuartiers: [
          { nom: "Sokodé - Centre", type: "centre_ville", description: "Deuxième ville du Togo, transports et commerces" },
        ],
      },
      {
        id: "kara",
        nom: "Région de la Kara",
        chefLieu: "Kara",
        villesEtQuartiers: [
          { nom: "Kara - Centre", type: "centre_ville", description: "Pôle économique du Nord, universités et événements Evala" },
        ],
      },
      {
        id: "savanes",
        nom: "Région des Savanes (Dapaong...)",
        chefLieu: "Dapaong",
        villesEtQuartiers: [
          { nom: "Dapaong - Centre", type: "centre_ville" },
        ],
      },
    ],
  },

  // =========================================================================
  // 5. CAMEROUN 🇨🇲 (+237) — Les Régions clés
  // =========================================================================
  {
    id: "cameroun",
    nom: "Cameroun",
    drapeau: "🇨🇲",
    indicatif: "+237",
    devise: "FCFA",
    termeDepartement: "Région",
    departements: [
      {
        id: "littoral_cam",
        nom: "Littoral (Douala)",
        chefLieu: "Douala",
        villesEtQuartiers: [
          { nom: "Douala - Akwa (Boulevard de la Liberté)", type: "quartier_affaires", description: "Poumon financier de l'Afrique Centrale, concessions, banques" },
          { nom: "Douala - Bonanjo (Quartier Administratif)", type: "quartier_affaires", description: "Cabinets d'avocats internationaux, consulats, port autonome" },
          { nom: "Douala - Bonapriso", type: "residentiel_luxe", description: "Quartier le plus chic du pays, boutiques de luxe, restaurants raffinés" },
          { nom: "Douala - Bali", type: "commercial" },
          { nom: "Douala - Makepe & Bonamoussadi (Douala Nord)", type: "residentiel_luxe", description: "Nouvelle bourgeoisie, supermarchés, collèges privés" },
          { nom: "Douala - Deido & Bepanda", type: "commercial" },
        ],
      },
      {
        id: "centre_cam",
        nom: "Centre (Yaoundé)",
        chefLieu: "Yaoundé",
        villesEtQuartiers: [
          { nom: "Yaoundé - Bastos", type: "residentiel_luxe", description: "Ambassades, diplomates, restaurants VIP et résidences de ministres" },
          { nom: "Yaoundé - Centre-Ville & Hippodrome", type: "quartier_affaires", description: "Ministères, banques et sièges des corporations" },
          { nom: "Yaoundé - Omnisports & Santa Barbara", type: "residentiel_luxe" },
          { nom: "Yaoundé - Tsinga & Biyem-Assi", type: "commercial" },
        ],
      },
      {
        id: "sud_cam",
        nom: "Sud (Kribi...)",
        chefLieu: "Ebolowa",
        villesEtQuartiers: [
          { nom: "Kribi - Chutes de la Lobé & Port en Eau Profonde", type: "residentiel_luxe", description: "Riviera camerounaise, tourisme, méga-port industriel" },
        ],
      },
      {
        id: "ouest_cam",
        nom: "Ouest (Bafoussam...)",
        chefLieu: "Bafoussam",
        villesEtQuartiers: [
          { nom: "Bafoussam - Centre", type: "centre_ville", description: "Place marchande des grands entrepreneurs Bamiléké" },
          { nom: "Dschang (Cité Climatique & Universitaire)", type: "commercial" },
        ],
      },
    ],
  },

  // =========================================================================
  // 6. GABON 🇬🇦 (+241)
  // =========================================================================
  {
    id: "gabon",
    nom: "Gabon",
    drapeau: "🇬🇦",
    indicatif: "+241",
    devise: "FCFA",
    termeDepartement: "Province",
    departements: [
      {
        id: "estuaire",
        nom: "Estuaire (Libreville)",
        chefLieu: "Libreville",
        villesEtQuartiers: [
          { nom: "Libreville - La Sablière & Batterie IV", type: "residentiel_luxe", description: "Plus haut pouvoir d'achat d'Afrique Centrale, diplomates" },
          { nom: "Libreville - Boulevard Triomphal (Centre)", type: "quartier_affaires", description: "Ministères, banques et sièges pétroliers" },
          { nom: "Libreville - Louis & Glass", type: "commercial", description: "Bars, restaurants chics et divertissement" },
          { nom: "Akanda & Owendo", type: "commercial" },
        ],
      },
      {
        id: "ogoue_maritime",
        nom: "Ogooué-Maritime (Port-Gentil)",
        chefLieu: "Port-Gentil",
        villesEtQuartiers: [
          { nom: "Port-Gentil (Capitale Pétrolière)", type: "quartier_affaires", description: "TotalEnergies, Perenco, expatriés du pétrole" },
        ],
      },
    ],
  },

  // =========================================================================
  // 7. BURKINA FASO 🇧🇫 (+226)
  // =========================================================================
  {
    id: "burkina",
    nom: "Burkina Faso",
    drapeau: "🇧🇫",
    indicatif: "+226",
    devise: "FCFA",
    termeDepartement: "Région",
    departements: [
      {
        id: "centre_bf",
        nom: "Centre (Ouagadougou)",
        chefLieu: "Ouagadougou",
        villesEtQuartiers: [
          { nom: "Ouagadougou - Ouaga 2000", type: "residentiel_luxe", description: "Quartier présidentiel, ambassades, hôtels 5 étoiles" },
          { nom: "Ouagadougou - Koulouba & Projet", type: "quartier_affaires", description: "Centre administratif et bancaire" },
          { nom: "Ouagadougou - Gounghin & Zogona", type: "commercial" },
        ],
      },
      {
        id: "hauts_bassins",
        nom: "Hauts-Bassins (Bobo-Dioulasso)",
        chefLieu: "Bobo-Dioulasso",
        villesEtQuartiers: [
          { nom: "Bobo-Dioulasso - Centre & Accart-ville", type: "centre_ville", description: "Capitale économique et culturelle" },
        ],
      },
    ],
  },

  // =========================================================================
  // 8. RDC (CONGO-KINSHASA) 🇨🇩 (+243)
  // =========================================================================
  {
    id: "rdc",
    nom: "RDC (Congo-Kinshasa)",
    drapeau: "🇨🇩",
    indicatif: "+243",
    devise: "USD / CDF",
    termeDepartement: "Province",
    departements: [
      {
        id: "kinshasa",
        nom: "Kinshasa (Capitale)",
        chefLieu: "Kinshasa",
        villesEtQuartiers: [
          { nom: "Kinshasa - Gombe (Centre d'Affaires)", type: "quartier_affaires", description: "Ambassades, multinationales, hôtels de luxe (Fleuve Congo Hotel)" },
          { nom: "Kinshasa - Ngaliema (Ma Campagne / Utexafrica)", type: "residentiel_luxe", description: "Résidences de haut standing" },
          { nom: "Kinshasa - Limete", type: "commercial", description: "Zone industrielle et résidentielle des cadres" },
          { nom: "Kinshasa - Bandalungwa & Kintambo", type: "commercial" },
        ],
      },
      {
        id: "haut_katanga",
        nom: "Haut-Katanga (Lubumbashi)",
        chefLieu: "Lubumbashi",
        villesEtQuartiers: [
          { nom: "Lubumbashi (Capitale Minière)", type: "quartier_affaires", description: "Mines de cuivre et cobalt, énorme liquidité commerciale" },
        ],
      },
      {
        id: "nord_kivu",
        nom: "Nord-Kivu (Goma)",
        chefLieu: "Goma",
        villesEtQuartiers: [
          { nom: "Goma - Bord du Lac Kivu", type: "commercial", description: "Hub des ONG internationales, hôtels touristiques" },
        ],
      },
    ],
  },

  // =========================================================================
  // 9. FRANCE / DIASPORA 🇫🇷 (+33)
  // =========================================================================
  {
    id: "france",
    nom: "France / Diaspora",
    drapeau: "🇫🇷",
    indicatif: "+33",
    devise: "EUR",
    termeDepartement: "Région",
    departements: [
      {
        id: "ile_de_france",
        nom: "Île-de-France (Paris & Banlieue)",
        chefLieu: "Paris",
        villesEtQuartiers: [
          { nom: "Paris - 8e / 16e / 17e (Affaires & Étoile)", type: "quartier_affaires", description: "Cabinets d'avocats, gestion de fortune, diplomates" },
          { nom: "Paris - 1er à 4e (Cœur Historique & Mode)", type: "commercial" },
          { nom: "Paris - 9e / 10e (Grands Boulevards & Startups)", type: "commercial" },
          { nom: "Paris - 11e / 12e (Bastille / Nation)", type: "commercial" },
          { nom: "Hauts-de-Seine (92 - Neuilly, Boulogne, Courbevoie, La Défense)", type: "quartier_affaires" },
          { nom: "Seine-Saint-Denis (93 - Saint-Denis, Montreuil, Pantin)", type: "commercial" },
          { nom: "Val-de-Marne (94 - Créteil, Vincennes, Saint-Maur)", type: "commercial" },
        ],
      },
      {
        id: "auvergne_rhone_alpes",
        nom: "Auvergne-Rhône-Alpes (Lyon...)",
        chefLieu: "Lyon",
        villesEtQuartiers: [
          { nom: "Lyon - Presqu'île & Part-Dieu", type: "quartier_affaires" },
          { nom: "Lyon - Confluence & Villeurbanne", type: "commercial" },
        ],
      },
      {
        id: "paca",
        nom: "PACA (Marseille, Nice, Cannes...)",
        chefLieu: "Marseille",
        villesEtQuartiers: [
          { nom: "Marseille - Prado / Vieux-Port / La Joliette", type: "quartier_affaires" },
          { nom: "Nice - Promenade des Anglais", type: "residentiel_luxe" },
          { nom: "Cannes - La Croisette", type: "residentiel_luxe" },
        ],
      },
      {
        id: "nouvelle_aquitaine",
        nom: "Nouvelle-Aquitaine (Bordeaux...)",
        chefLieu: "Bordeaux",
        villesEtQuartiers: [
          { nom: "Bordeaux - Triangle d'Or & Chartrons", type: "quartier_affaires" },
        ],
      },
    ],
  },

  // =========================================================================
  // 10. BELGIQUE 🇧🇪 (+32) & CANADA 🇨🇦 (+1)
  // =========================================================================
  {
    id: "belgique",
    nom: "Belgique",
    drapeau: "🇧🇪",
    indicatif: "+32",
    devise: "EUR",
    termeDepartement: "Région",
    departements: [
      {
        id: "bruxelles",
        nom: "Bruxelles-Capitale",
        chefLieu: "Bruxelles",
        villesEtQuartiers: [
          { nom: "Bruxelles - Quartier Européen & Louise", type: "quartier_affaires" },
          { nom: "Bruxelles - Ixelles & Uccle", type: "residentiel_luxe" },
        ],
      },
    ],
  },
  {
    id: "canada",
    nom: "Canada / Québec",
    drapeau: "🇨🇦",
    indicatif: "+1",
    devise: "CAD",
    termeDepartement: "Province",
    departements: [
      {
        id: "quebec",
        nom: "Québec (Montréal)",
        chefLieu: "Montréal",
        villesEtQuartiers: [
          { nom: "Montréal - Centre-Ville & Vieux-Montréal", type: "quartier_affaires" },
          { nom: "Montréal - Plateau-Mont-Royal & Mile End", type: "commercial" },
        ],
      },
    ],
  },
];

// Helper : Formater le nom pour une option d'affichage
export function getNomQuartier(item: string | QuartierOuCommune): string {
  return typeof item === "string" ? item : item.nom;
}

// Helper : Recherche par mot-clé dans tous les pays, départements et quartiers
export function rechercherTerritoire(query: string): {
  pays: PaysCible;
  departement: DepartementOuRegion;
  quartier: string;
}[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const resultats: { pays: PaysCible; departement: DepartementOuRegion; quartier: string }[] = [];

  for (const pays of PAYS_CIBLES) {
    for (const dep of pays.departements) {
      for (const qItem of dep.villesEtQuartiers) {
        const nom = getNomQuartier(qItem);
        if (
          nom.toLowerCase().includes(q) ||
          dep.nom.toLowerCase().includes(q) ||
          pays.nom.toLowerCase().includes(q)
        ) {
          resultats.push({ pays, departement: dep, quartier: nom });
          if (resultats.length >= 15) return resultats;
        }
      }
    }
  }

  return resultats;
}

// Construction de l'URL Google Maps précise
export function construireUrlGoogleMaps(motsCles: string, localisation: string): string {
  const query = `${motsCles.trim()} ${localisation.trim()}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Construction d'URL Google Maps avec filtre spécifique (Top avis, Ouvert maintenant...)
export function construireUrlGoogleMapsFiltree(
  motsCles: string,
  localisation: string,
  filtre: "top_notes" | "plus_avis" | "ouverts" | "recents",
): string {
  let modificateur = "";
  if (filtre === "top_notes") modificateur = "meilleurs avis 4 étoiles";
  else if (filtre === "plus_avis") modificateur = "les plus populaires avis";
  else if (filtre === "ouverts") modificateur = "ouvert maintenant";
  else if (filtre === "recents") modificateur = "nouveau ouvert";

  const query = `${motsCles.trim()} ${modificateur} ${localisation.trim()}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
