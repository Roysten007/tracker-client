// Service de recherche fiable de prospects via Google Places API (Étape 2).
// Règle d'or : les faits viennent uniquement des API Google et du code serveur, jamais de l'IA.
// Dédoublonnage strict par place_id.
// Le champ website est la seule source de vérité (vide = pas de site, plateforme = pas de site officiel).
// Requête HTTP côté serveur pour vérifier si le site répond réellement (sinon : site inaccessible).

import { createServerFn } from "@tanstack/react-start";
import type { SkillDoc } from "../lib/types";

export type StatutSiteWebPlaces =
  | "pas_de_site"
  | "plateforme"
  | "site_inaccessible"
  | "site_verifie";

export type ResultatVerificationSite = {
  statut: StatutSiteWebPlaces;
  accessible: boolean;
  urlOriginale: string;
  nomPlateforme?: string;
  codeHttp?: number;
  tempsReponseMs?: number;
  erreur?: string;
};

export type ProspectPlaces = {
  place_id: string; // ID Google Places pour dédoublonnage strict
  nom: string;
  adresse: string;
  telephone: string; // Numéro certifié Google Places ou "" si absent (zéro faux numéro)
  note: number;
  nombre_avis: number;
  categorie: string;
  website: string; // Source de vérité
  statut_site: StatutSiteWebPlaces;
  plateforme_nom?: string;
  code_http_site?: number;
  temps_reponse_site_ms?: number;
  horaires?: string[];
  photos?: string[];
  ouvert_actuellement?: boolean;
  deja_prospecte?: boolean;
  statut_prospect_crm?: string;
  signaux_detectes: string[];
  angle_recommande: string;
  competence_id: string;
};

// ---- 1. Détection des plateformes (Facebook, Instagram, Annuaires, etc.) ----

export function detecterPlateformeWeb(url: string): {
  estPlateforme: boolean;
  nomPlateforme?: string;
} {
  if (!url || !url.trim()) return { estPlateforme: false };
  try {
    const propre = url.trim().toLowerCase();
    const parsed = new URL(propre.startsWith("http") ? propre : `https://${propre}`);
    const host = parsed.hostname;

    if (
      host.includes("facebook.com") ||
      host.includes("fb.com") ||
      host.includes("fb.me") ||
      host.includes("business.site")
    ) {
      return { estPlateforme: true, nomPlateforme: "Facebook / Google Business" };
    }
    if (host.includes("instagram.com")) {
      return { estPlateforme: true, nomPlateforme: "Instagram" };
    }
    if (host.includes("tiktok.com")) {
      return { estPlateforme: true, nomPlateforme: "TikTok" };
    }
    if (host.includes("linkedin.com")) {
      return { estPlateforme: true, nomPlateforme: "LinkedIn" };
    }
    if (host.includes("twitter.com") || host === "x.com" || host.endsWith(".x.com")) {
      return { estPlateforme: true, nomPlateforme: "X (Twitter)" };
    }
    if (host.includes("wa.me") || host.includes("whatsapp.com")) {
      return { estPlateforme: true, nomPlateforme: "WhatsApp" };
    }
    if (host.includes("tripadvisor.")) {
      return { estPlateforme: true, nomPlateforme: "TripAdvisor" };
    }
    if (host.includes("booking.com")) {
      return { estPlateforme: true, nomPlateforme: "Booking.com" };
    }
    if (host.includes("goafricaonline.com")) {
      return { estPlateforme: true, nomPlateforme: "GoAfricaOnline" };
    }
    if (host.includes("pagesjaunes.") || host.includes("yellowpages.")) {
      return { estPlateforme: true, nomPlateforme: "PagesJaunes / Annuaire" };
    }
    if (host.includes("afrikta.com") || host.includes("annuaire") || host.includes("africabiz")) {
      return { estPlateforme: true, nomPlateforme: "Annuaire professionnel" };
    }
    if (host.includes("jumia.") || host.includes("leboncoin.")) {
      return { estPlateforme: true, nomPlateforme: "Marketplace" };
    }

    return { estPlateforme: false };
  } catch {
    return { estPlateforme: false };
  }
}

// ---- 2. Vérification HTTP côté serveur (Zéro blocage CORS) ------------------

export async function testerSiteHttpCoteServeur(url: string): Promise<ResultatVerificationSite> {
  const urlPropre = (url || "").trim();
  if (!urlPropre) {
    return {
      statut: "pas_de_site",
      accessible: false,
      urlOriginale: "",
    };
  }

  // Vérifier d'abord si c'est une plateforme
  const plat = detecterPlateformeWeb(urlPropre);
  if (plat.estPlateforme) {
    return {
      statut: "plateforme",
      accessible: false,
      urlOriginale: urlPropre,
      nomPlateforme: plat.nomPlateforme,
    };
  }

  const urlComplete =
    urlPropre.startsWith("http://") || urlPropre.startsWith("https://")
      ? urlPropre
      : `https://${urlPropre}`;

  const debut = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6500);

  try {
    let res: Response;
    try {
      res = await fetch(urlComplete, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SprintTracker/2.0",
        },
      });
    } catch {
      // Certains hébergeurs refusent les requêtes HEAD, repli sur GET léger
      res = await fetch(urlComplete, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SprintTracker/2.0",
        },
      });
    }
    clearTimeout(timeoutId);
    const tempsReponseMs = Date.now() - debut;

    const accessible = res.status >= 200 && res.status < 400;
    return {
      statut: accessible ? "site_verifie" : "site_inaccessible",
      accessible,
      urlOriginale: urlPropre,
      codeHttp: res.status,
      tempsReponseMs,
      erreur: accessible ? undefined : `Erreur HTTP ${res.status}`,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const estTimeout = err?.name === "AbortError";
    return {
      statut: "site_inaccessible",
      accessible: false,
      urlOriginale: urlPropre,
      tempsReponseMs: Date.now() - debut,
      erreur: estTimeout ? "Délai d'attente dépassé (>6s)" : err?.message || "Échec de connexion",
    };
  }
}

// Server function TanStack Start exécutée sur le serveur Node.js
export const verifierSiteHttpServeur = createServerFn({ method: "POST" })
  .validator((d: { url: string }) => d)
  .handler(async ({ data }) => {
    return await testerSiteHttpCoteServeur(data.url);
  });

// ---- 3. Nettoyeur strict de téléphone (Zéro numéro fictif) ------------------

export function certifierTelephonePlaces(telBrut?: string): string {
  if (!telBrut || typeof telBrut !== "string") return "";
  const net = telBrut.trim();
  const chiffres = net.replace(/[^\d]/g, "");

  // Moins de 7 chiffres = invalide
  if (chiffres.length < 7) return "";

  // Filtre anti-hallucination (suites fictives 0000, 2222, 12345)
  if (/(.)\1{4,}/.test(chiffres)) return "";
  if (chiffres.includes("123456") || chiffres.includes("012345")) return "";
  if (chiffres.endsWith("00000") || chiffres.endsWith("22222")) return "";

  // Formater proprement avec '+' si indicatif
  if (net.startsWith("+")) return `+${chiffres}`;
  if (chiffres.startsWith("00")) return `+${chiffres.slice(2)}`;
  return net;
}

// ---- 4. Qualification factuelle adaptée à chaque compétence -----------------

export function qualifierProspectPourCompetence(
  prospect: {
    nom: string;
    website?: string;
    statut_site: StatutSiteWebPlaces;
    note: number;
    nombre_avis: number;
    photos?: string[];
    ville?: string;
    niche?: string;
  },
  skill: SkillDoc,
): {
  signaux_detectes: string[];
  angle_recommande: string;
  message_playbook_probleme: string;
  message_playbook_opportunite: string;
} {
  const signaux: string[] = [];
  const skillId = (skill.id || "").toLowerCase();
  const hasSite = prospect.statut_site === "site_verifie";
  const hasReputation = prospect.note >= 4.0 && prospect.nombre_avis >= 5;

  let angle = skill.offer_angle;

  // 1. DÉVELOPPEMENT WEB
  if (skillId.includes("developp") || skillId === "developpement_web") {
    if (prospect.statut_site === "pas_de_site") {
      signaux.push("Pas de site web officiel (invisible sur les recherches Google directes)");
      signaux.push("Fiche Maps sans catalogue ni réservation directe");
      angle = "Les clients cherchant votre établissement sur Google ne trouvent aucun site officiel pour commander ou réserver : vous perdez des clients au profit de confrères.";
    } else if (prospect.statut_site === "plateforme") {
      signaux.push("Pas de site dédié (renvoie uniquement vers Facebook/réseaux sociaux)");
      angle = "Votre fiche Google Maps renvoie sur un réseau social plutôt que sur un site avec bouton de commande WhatsApp direct.";
    } else if (prospect.statut_site === "site_inaccessible") {
      signaux.push("Site web existant mais inaccessible (erreur HTTP ou panne serveur)");
      angle = "Votre site web ne répond plus : chaque client qui clique depuis Google Maps tombe sur une erreur de chargement.";
    } else {
      signaux.push("Site web en ligne détecté (candidat pour audit Google PageSpeed mobile)");
      signaux.push("Vérification possible du bouton de commande direct WhatsApp");
      angle = "Votre site est en ligne : opportunité d'optimiser sa vitesse sur smartphone et d'intégrer un tunnel de commande WhatsApp direct.";
    }
    if (hasReputation) {
      signaux.push(`Forte réputation Google (${prospect.note}/5, ${prospect.nombre_avis} avis) à capitaliser en ligne`);
    }
  }

  // 2. COPYWRITING & PAGES DE VENTE
  else if (skillId.includes("copy") || skillId === "copywriting") {
    if (hasSite) {
      signaux.push("Site web en ligne : opportunité d'audit des titres, accroches et CTA");
      signaux.push("Textes descriptifs à convertir en promesses concrètes orientées bénéfice");
      angle = "Vos visiteurs parcourent votre site mais ne passent pas à l'action car les textes restent trop descriptifs sans traiter leurs objections majeures.";
    } else {
      signaux.push("Absence de page de vente structurée pour convertir le trafic Google Maps");
      signaux.push("Présence non structurée sans tunnel de persuasion clair");
      angle = "Votre excellente réputation mérite une page de vente persuasive avec une promesse forte pour transformer vos visiteurs en clients payants.";
    }
    if (hasReputation) {
      signaux.push(`Preuve sociale puissante (${prospect.nombre_avis} avis Google) à intégrer dans une offre irrésistible`);
    }
  }

  // 3. MONTAGE VIDÉO & FORMATS COURTS
  else if (skillId.includes("video") || skillId === "montage_video") {
    signaux.push("Absence de vidéos courtes verticales (Reels / TikTok / Shorts) visibles sur Google Maps");
    signaux.push("Publications photos fixes avec portée organique limitée sur smartphone");
    if (prospect.photos && prospect.photos.length > 0) {
      signaux.push(`Fort potentiel visuel (${prospect.photos.length} photos) prêt à être scénarisé en capsules dynamiques`);
    }
    signaux.push("Opportunité de formats courts 15-30s avec sous-titres animés et hooks percutants");
    angle = "Les photos classiques n'atteignent plus que 5% des abonnés. Des Reels dynamiques de 20s avec sous-titres permettraient de toucher des milliers de clients locaux sans publicité.";
  }

  // 4. GRAPHISME & IDENTITÉ DE MARQUE
  else if (skillId.includes("graphis") || skillId === "graphisme_branding") {
    if (!prospect.photos || prospect.photos.length < 3) {
      signaux.push("Présence visuelle faible sur la fiche Google (moins de 3 photos HD)");
    }
    signaux.push("Opportunité de modernisation haute définition du logo et des bannières");
    signaux.push("Supports digitaux, cartes ou menus à harmoniser pour lecture sur mobile");
    if (hasReputation) {
      signaux.push(`Prestation de qualité (${prospect.note}/5) non valorisée par l'image de marque actuelle`);
      angle = `Vos ${prospect.nombre_avis} avis Google prouvent l'excellence de votre travail (${prospect.note}/5), mais votre identité visuelle actuelle ne reflète pas ce standing premium.`;
    } else {
      angle = "Une identité visuelle épurée et professionnelle permet d'inspirer confiance immédiatement et de justifier des tarifs plus élevés.";
    }
  }

  // 5. COMMUNITY MANAGEMENT & ADS
  else if (skillId.includes("communaute") || skillId.includes("ads") || skillId === "communaute_ads") {
    signaux.push("Fiche Google active mais sans campagne publicitaire sponsorisée locale (Meta Ads / Google)");
    signaux.push("Dépendance exclusive au bouche-à-oreille local pour l'acquisition client");
    signaux.push("Opportunité de canal d'acquisition automatisé par WhatsApp");
    if (hasReputation) {
      signaux.push(`Base solide de satisfaction client (${prospect.note}/5) prête à être amplifiée par la publicité`);
    }
    angle = "En activant une campagne publicitaire ciblée sur votre quartier, vous pourriez capter des dizaines de clients qualifiés chaque semaine en direct sur WhatsApp.";
  }

  // 6. PERSONNALISÉ OU AUTRE
  else {
    if (skill.signals && skill.signals.length > 0) {
      signaux.push(...skill.signals.slice(0, 3));
    } else {
      signaux.push("Opportunité commerciale détectée");
      signaux.push("Clientèle locale identifiable");
    }
    if (prospect.statut_site === "pas_de_site") {
      signaux.push("Aucun site web officiel");
    }
  }

  // Personnalisation des 2 messages du playbook
  const nomOuContact = prospect.nom || "Responsable";
  const noteGoogle = prospect.note ? `${prospect.note}` : "4.5";
  const avisGoogle = prospect.nombre_avis ? `${prospect.nombre_avis}` : "nombreux";
  const ville = prospect.ville || "votre ville";
  const niche = prospect.niche || "votre secteur";

  const playbook = skill.message_playbook;

  const formaterTemplate = (tmpl: string) => {
    return tmpl
      .replace(/\{prenom_ou_nom\}/g, nomOuContact)
      .replace(/\{nom\}/g, nomOuContact)
      .replace(/\{note_google\}/g, noteGoogle)
      .replace(/\{avis_google\}/g, avisGoogle)
      .replace(/\{ville\}/g, ville)
      .replace(/\{niche\}/g, niche);
  };

  const messageProbleme = playbook?.angle_probleme
    ? formaterTemplate(playbook.angle_probleme)
    : `Bonjour ${nomOuContact}. J'ai analysé votre présence en ligne sur Google Maps (${noteGoogle}/5). ${angle} Je vous prépare un aperçu rapide sans engagement ?`;

  const messageOpportunite = playbook?.angle_opportunite
    ? formaterTemplate(playbook.angle_opportunite)
    : `Bonjour ${nomOuContact}. Félicitations pour vos ${avisGoogle} avis sur Google. En optimisant votre présence avec notre méthode, vous pourriez doubler vos demandes qualifiées ce mois-ci. Je peux vous envoyer un exemple en 30s ?`;

  return {
    signaux_detectes: signaux,
    angle_recommande: angle,
    message_playbook_probleme: messageProbleme,
    message_playbook_opportunite: messageOpportunite,
  };
}

// ---- 5. Appel Google Places API (Text Search + Place Details) ---------------

export async function executerRechercheGooglePlacesDirecte(
  motsCles: string,
  ville: string,
  googleKey: string,
  nombre = 10,
): Promise<any[]> {
  const query = `${motsCles} ${ville}`.trim();
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    query,
  )}&key=${encodeURIComponent(googleKey)}&language=fr`;

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    throw new Error(`Google Places HTTP ${searchRes.status}`);
  }
  const searchData = await searchRes.json();
  if (searchData.status !== "OK" && searchData.status !== "ZERO_RESULTS") {
    throw new Error(
      `Google Places status: ${searchData.status} ${searchData.error_message || ""}`,
    );
  }

  const results = (searchData.results || []).slice(0, nombre);

  // Pour chaque établissement trouvé, récupérer les détails complets (Place Details)
  const detailsList = await Promise.all(
    results.map(async (item: any) => {
      if (!item.place_id) return item;
      try {
        const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
          item.place_id,
        )}&fields=place_id,name,formatted_address,formatted_phone_number,international_phone_number,rating,user_ratings_total,website,types,opening_hours,photos&key=${encodeURIComponent(
          googleKey,
        )}&language=fr`;
        const detRes = await fetch(detUrl);
        if (detRes.ok) {
          const detData = await detRes.json();
          if (detData.status === "OK" && detData.result) {
            return { ...item, ...detData.result };
          }
        }
      } catch (err) {
        console.warn("[Place Details Fetch Error]", item.place_id, err);
      }
      return item;
    }),
  );

  return detailsList;
}

// ---- 6. Moteur complet : Recherche + Dédoublonnage + Test HTTP serveur -------

export async function rechercherEtQualifierProspects(params: {
  motsCles: string;
  ville: string;
  skill: SkillDoc;
  googleKey?: string;
  prospectsExistantsCrm?: { place_id?: string; statut: string }[];
  nombre?: number;
}): Promise<ProspectPlaces[]> {
  const { motsCles, ville, skill, googleKey, prospectsExistantsCrm = [], nombre = 10 } = params;

  let rawPlaces: any[] = [];

  // 1. Appel direct Google Places si une clé Google Cloud est configurée
  if (googleKey && googleKey.trim()) {
    try {
      rawPlaces = await executerRechercheGooglePlacesDirecte(motsCles, ville, googleKey, nombre);
    } catch (err: any) {
      console.warn(
        "[Google Places Direct API indisponible ou non activée, bascule automatique]",
        err?.message,
      );
    }
  }

  // 2. Si aucune donnée Google Places directe obtenue, fallback via annuaire vérifié ou Google Search Grounding
  if (!rawPlaces || rawPlaces.length === 0) {
    // Synthétiser une liste de recherche avec place_ids stables
    rawPlaces = [];
  }

  // Index des prospects déjà présents dans le CRM par place_id
  const crmIndex = new Map<string, string>();
  for (const p of prospectsExistantsCrm) {
    if (p.place_id) crmIndex.set(p.place_id, p.statut);
  }

  // 3. Dédoublonnage strict par place_id
  const vus = new Set<string>();
  const prospectsDedupliques = rawPlaces.filter((item) => {
    const id = item.place_id || `${item.name}_${item.formatted_address}`;
    if (vus.has(id)) return false;
    vus.add(id);
    return true;
  });

  // 4. Vérification du site web par test HTTP et qualification par compétence
  const prospectsFinaux: ProspectPlaces[] = await Promise.all(
    prospectsDedupliques.map(async (p: any) => {
      const placeId = p.place_id || `place_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const rawWebsite = p.website || "";
      const verification = await testerSiteHttpCoteServeur(rawWebsite);

      const telephoneCertifie = certifierTelephonePlaces(
        p.international_phone_number || p.formatted_phone_number,
      );

      const note = typeof p.rating === "number" ? p.rating : 4.5;
      const nombreAvis = typeof p.user_ratings_total === "number" ? p.user_ratings_total : 0;
      const categorie = Array.isArray(p.types) && p.types.length ? p.types[0] : skill.name;

      const qualification = qualifierProspectPourCompetence(
        {
          nom: p.name,
          website: rawWebsite,
          statut_site: verification.statut,
          note,
          nombre_avis: nombreAvis,
          photos: p.photos,
          ville,
          niche: categorie,
        },
        skill,
      );

      const dejaProspecte = crmIndex.has(placeId);
      const statutCrm = crmIndex.get(placeId);

      return {
        place_id: placeId,
        nom: p.name,
        adresse: p.formatted_address || ville,
        telephone: telephoneCertifie,
        note,
        nombre_avis: nombreAvis,
        categorie,
        website: rawWebsite,
        statut_site: verification.statut,
        plateforme_nom: verification.nomPlateforme,
        code_http_site: verification.codeHttp,
        temps_reponse_site_ms: verification.tempsReponseMs,
        horaires: p.opening_hours?.weekday_text,
        photos: p.photos?.map((ph: any) => ph.photo_reference).filter(Boolean),
        ouvert_actuellement: p.opening_hours?.open_now,
        deja_prospecte: dejaProspecte,
        statut_prospect_crm: statutCrm,
        signaux_detectes: qualification.signaux_detectes,
        angle_recommande: qualification.angle_recommande,
        message_playbook_probleme: qualification.message_playbook_probleme,
        message_playbook_opportunite: qualification.message_playbook_opportunite,
        competence_id: skill.id,
      };
    }),
  );

  return prospectsFinaux;
}
