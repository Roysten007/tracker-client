// Parseur intelligent pour la barre de recherche universelle ("Recherche par mots-clés et ville").
// Permet à l'utilisateur de taper directement :
// - "restaurant Ouidah"
// - "clinique Cotonou"
// - "agence immobilière Abidjan"
// - "avocat Dakar"
// - "restaurant sans site web"
// - ou juste "restaurant"

import { PAYS_CIBLES, type PaysCible, type DepartementOuRegion } from "./territoires";

export type AnalyseRecherche = {
  nicheMotsCles: string;
  villeTrouvee: string;
  paysTrouve: PaysCible;
  departementTrouve: DepartementOuRegion;
  filtreOpportunite?: "aucun_site" | "pagespeed_lent" | "tous";
  localisationComplete: string;
};

// Liste des villes africaines et internationales courantes pour détection automatique
const VILLES_RECONNAISSANCE: {
  termes: string[];
  villeNom: string;
  paysId: string;
  departementId: string;
}[] = [
  // BÉNIN
  { termes: ["cotonou", "haie vive", "cadjehoun", "cadjèhoun", "ganhi", "akpakpa", "fidjrosse", "fidjrossè", "saint-michel", "gbegamey"], villeNom: "Cotonou", paysId: "benin", departementId: "littoral" },
  { termes: ["ouidah", "whydah"], villeNom: "Ouidah", paysId: "benin", departementId: "atlantique" },
  { termes: ["calavi", "abomey-calavi", "abomey calavi", "godomey", "tankpe", "tankpè", "akassato"], villeNom: "Abomey-Calavi", paysId: "benin", departementId: "atlantique" },
  { termes: ["porto-novo", "porto novo", "portonovo", "ouando", "seme", "sèmè", "krake", "kraké"], villeNom: "Porto-Novo", paysId: "benin", departementId: "oueme" },
  { termes: ["parakou", "titirou", "albarika"], villeNom: "Parakou", paysId: "benin", departementId: "borgou" },
  { termes: ["bohicon", "abomey", "zou"], villeNom: "Bohicon / Abomey", paysId: "benin", departementId: "zou" },
  { termes: ["lokossa", "grand-popo", "grand popo", "come", "comé"], villeNom: "Lokossa / Grand-Popo", paysId: "benin", departementId: "mono" },
  { termes: ["dassa", "dassa-zoume", "dassa-zoumè", "savalou", "save", "savè"], villeNom: "Dassa-Zoumè", paysId: "benin", departementId: "collines" },
  { termes: ["natitingou", "tanguieta", "tanguiéta"], villeNom: "Natitingou", paysId: "benin", departementId: "atacora" },
  { termes: ["djougou"], villeNom: "Djougou", paysId: "benin", departementId: "donga" },
  { termes: ["kandi", "malanville"], villeNom: "Kandi / Malanville", paysId: "benin", departementId: "alibori" },

  // CÔTE D'IVOIRE
  { termes: ["abidjan", "cocody", "plateau", "marcory", "zone 4", "zone4", "bietry", "biétry", "yopougon", "treichville", "angre", "angré", "deux plateaux"], villeNom: "Abidjan", paysId: "cote_ivoire", departementId: "abidjan" },
  { termes: ["grand-bassam", "grand bassam", "assinie", "aboisso"], villeNom: "Grand-Bassam / Assinie", paysId: "cote_ivoire", departementId: "sud_comoe" },
  { termes: ["bouake", "bouaké"], villeNom: "Bouaké", paysId: "cote_ivoire", departementId: "gbeke" },
  { termes: ["san-pedro", "san pedro"], villeNom: "San-Pédro", paysId: "cote_ivoire", departementId: "san_pedro" },
  { termes: ["yamoussoukro"], villeNom: "Yamoussoukro", paysId: "cote_ivoire", departementId: "yamoussoukro" },
  { termes: ["korhogo"], villeNom: "Korhogo", paysId: "cote_ivoire", departementId: "poro" },
  { termes: ["daloa"], villeNom: "Daloa", paysId: "cote_ivoire", departementId: "haut_sassandra" },

  // SÉNÉGAL
  { termes: ["dakar", "almadies", "ngor", "mermoz", "sacre-coeur", "sacré-cœur", "point e", "fann", "yoff", "pikine", "guediawaye", "guédiawaye"], villeNom: "Dakar", paysId: "senegal", departementId: "dakar" },
  { termes: ["saly", "saly portudal", "mbour", "thies", "thiès", "somone"], villeNom: "Thiès / Saly", paysId: "senegal", departementId: "thies" },
  { termes: ["saint-louis", "saint louis", "ndar"], villeNom: "Saint-Louis", paysId: "senegal", departementId: "saint_louis" },
  { termes: ["touba", "diourbel"], villeNom: "Touba", paysId: "senegal", departementId: "diourbel" },
  { termes: ["ziguinchor", "cap skirring"], villeNom: "Ziguinchor", paysId: "senegal", departementId: "ziguinchor" },

  // TOGO
  { termes: ["lome", "lomé", "nyekonakpoe", "nyékonakpoè", "kodjoviakope", "tokoin", "agoe", "agoè", "baguida", "hedzranawoe"], villeNom: "Lomé", paysId: "togo", departementId: "maritime" },
  { termes: ["kpalime", "kpalimé", "atakpame", "atakpamé"], villeNom: "Kpalimé", paysId: "togo", departementId: "plateaux" },
  { termes: ["kara"], villeNom: "Kara", paysId: "togo", departementId: "kara" },
  { termes: ["sokode", "sokodé"], villeNom: "Sokodé", paysId: "togo", departementId: "centrale" },

  // CAMEROUN
  { termes: ["douala", "akwa", "bonanjo", "bonapriso", "makepe", "bonamoussadi", "deido", "bepanda"], villeNom: "Douala", paysId: "cameroun", departementId: "littoral_cam" },
  { termes: ["yaounde", "yaoundé", "bastos", "omnisports", "tsinga"], villeNom: "Yaoundé", paysId: "cameroun", departementId: "centre_cam" },
  { termes: ["kribi"], villeNom: "Kribi", paysId: "cameroun", departementId: "sud_cam" },
  { termes: ["bafoussam", "dschang"], villeNom: "Bafoussam", paysId: "cameroun", departementId: "ouest_cam" },

  // DIASPORA
  { termes: ["paris", "ile-de-france", "île-de-france", "neuilly", "boulogne"], villeNom: "Paris", paysId: "france", departementId: "ile_de_france" },
  { termes: ["lyon"], villeNom: "Lyon", paysId: "france", departementId: "auvergne_rhone_alpes" },
  { termes: ["marseille", "nice", "cannes"], villeNom: "Marseille / PACA", paysId: "france", departementId: "paca" },
  { termes: ["bruxelles", "belgique"], villeNom: "Bruxelles", paysId: "belgique", departementId: "bruxelles" },
  { termes: ["montreal", "montréal", "quebec", "québec"], villeNom: "Montréal", paysId: "canada", departementId: "quebec" },
];

/**
 * Analyse une requête saisie en texte libre par l'utilisateur
 * ex: "restaurant Ouidah" -> niche: "Restaurant", ville: "Ouidah", pays: "Bénin"
 */
export function analyserRechercheTexte(
  texteBrut: string,
  paysDefautId = "benin",
  departementDefautId = "littoral",
): AnalyseRecherche {
  let texte = texteBrut.trim();
  if (!texte) {
    const pays = PAYS_CIBLES.find((p) => p.id === paysDefautId) || PAYS_CIBLES[0];
    const dep = pays.departements.find((d) => d.id === departementDefautId) || pays.departements[0];
    return {
      nicheMotsCles: "Clinique dentaire & Soins",
      villeTrouvee: "Cotonou",
      paysTrouve: pays,
      departementTrouve: dep,
      localisationComplete: `Cotonou (${dep.nom}, ${pays.nom})`,
    };
  }

  // 1. Détection de filtres ("sans site", "aucun site", "pagespeed", "lent")
  let filtre: "aucun_site" | "pagespeed_lent" | "tous" | undefined;
  if (/sans site|aucun site|pas de site/i.test(texte)) {
    filtre = "aucun_site";
    texte = texte.replace(/sans site|aucun site|pas de site/gi, "").trim();
  } else if (/pagespeed|lent|vitesse/i.test(texte)) {
    filtre = "pagespeed_lent";
    texte = texte.replace(/pagespeed|lent|vitesse/gi, "").trim();
  }

  // 2. Détection de la ville/territoire
  const texteLower = ` ${texte.toLowerCase()} `;
  let villeTrouvee: string | null = null;
  let paysTrouve: PaysCible | null = null;
  let departementTrouve: DepartementOuRegion | null = null;

  for (const v of VILLES_RECONNAISSANCE) {
    for (const terme of v.termes) {
      const regex = new RegExp(`\\b${terme}\\b`, "i");
      if (regex.test(texteLower)) {
        villeTrouvee = v.villeNom;
        paysTrouve = PAYS_CIBLES.find((p) => p.id === v.paysId) || null;
        if (paysTrouve) {
          departementTrouve =
            paysTrouve.departements.find((d) => d.id === v.departementId) ||
            paysTrouve.departements[0];
        }
        // Retirer le nom de la ville du texte de niche
        texte = texte.replace(regex, "").trim();
        break;
      }
    }
    if (villeTrouvee) break;
  }

  // Repli si aucune ville détectée dans le texte
  if (!paysTrouve) {
    paysTrouve = PAYS_CIBLES.find((p) => p.id === paysDefautId) || PAYS_CIBLES[0];
  }
  if (!departementTrouve) {
    departementTrouve =
      paysTrouve.departements.find((d) => d.id === departementDefautId) ||
      paysTrouve.departements[0];
  }
  if (!villeTrouvee) {
    villeTrouvee = departementTrouve.chefLieu || "Cotonou";
  }

  // Nettoyer les mots de liaison éventuels (ex: "à", "de", "dans")
  const nicheNettoyee = texte
    .replace(/\b(?:à|a|dans|sur|pour|en|de)\b\s*$/i, "")
    .replace(/^\s*\b(?:à|a|dans|sur|pour|en|de)\b/i, "")
    .trim() || "Entreprise & Commerce";

  const localisationComplete = `${villeTrouvee} (${departementTrouve.nom}, ${paysTrouve.nom})`;

  return {
    nicheMotsCles: nicheNettoyee,
    villeTrouvee,
    paysTrouve,
    departementTrouve,
    filtreOpportunite: filtre,
    localisationComplete,
  };
}
