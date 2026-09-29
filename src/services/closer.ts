// Service de génération de messages closer et playbook multicanal (Étape 6).
// Génère les 2 variantes WhatsApp (Problème vs Opportunité), les réponses aux 3 objections
// majeures et la séquence de 3 relances planifiées, calibrées pour la compétence active.

import type { SkillDoc } from "../lib/types";
import type { ResultatPageSpeed } from "./pagespeed";
import type { ResultatAnalyseContenu } from "./analyse-contenu";
import type { StatutSiteWebPlaces } from "./places";

export type PlaybookProspectComplet = {
  messageAngleProbleme: string;
  messageAngleOpportunite: string;
  gestionObjections: {
    pasDeBudget: string;
    pasLeTemps: string;
    dejaQuelquun: string;
  };
  sequenceRelances: {
    r1J2: string; // +2 jours
    r2J4: string; // +4 jours
    r3J7: string; // +7 jours
  };
};

export function genererPlaybookCloser(params: {
  prospect: {
    nom: string;
    ville?: string;
    website?: string;
    statut_site: StatutSiteWebPlaces;
    note?: number;
    nombre_avis?: number;
    niche?: string;
    opportunite?: string;
  };
  skill: SkillDoc;
  pageSpeed?: ResultatPageSpeed;
  analyseContenu?: ResultatAnalyseContenu;
}): PlaybookProspectComplet {
  const { prospect, skill, pageSpeed, analyseContenu } = params;

  const nom = prospect.nom || "Responsable";
  const ville = prospect.ville || "votre ville";
  const note = prospect.note ? `${prospect.note}` : "4.5";
  const avis = prospect.nombre_avis ? `${prospect.nombre_avis}` : "nombreux";
  const pb = skill.message_playbook;

  // 1. Angle Problème
  let msgProbleme = "";
  if (prospect.statut_site === "pas_de_site" || !prospect.website) {
    msgProbleme = `Bonjour ${nom}. J'ai remarqué que sur votre fiche Google Maps (${note}/5), vous n'avez pas de site web officiel (les clients tombent sur une page sans réservation directe). Avec votre réputation à ${ville}, vous perdez chaque semaine des clients qui ne savent pas comment commander rapidement. J'ai préparé une maquette mobile avec bouton WhatsApp direct pour votre établissement : je peux vous l'envoyer en 30 secondes ici ?`;
  } else if (prospect.statut_site === "site_inaccessible") {
    msgProbleme = `Bonjour ${nom}. En consultant votre fiche Google Maps, j'ai constaté que le lien de votre site web renvoie sur une page inaccessible (erreur de connexion). Chaque client qui clique depuis son téléphone tombe sur une erreur. J'ai modélisé une version de secours ultra-rapide sécurisée : je peux vous la montrer ?`;
  } else if (pageSpeed && pageSpeed.scorePerformance < 50) {
    msgProbleme = `Bonjour ${nom}. J'ai passé votre site sur le testeur officiel Google PageSpeed : il met ${pageSpeed.tempsChargementSec}s à charger sur smartphone en 4G. Sachant que 53% des clients abandonnent après 3 secondes, vous perdez la moitié de vos visiteurs mobiles. J'ai identifié 2 corrections prioritaires pour diviser ce temps par 3 : je peux vous les partager ?`;
  } else if (analyseContenu && analyseContenu.cta_actuel === "non trouvé") {
    msgProbleme = `Bonjour ${nom}. J'ai parcouru votre site web : votre présentation est claire, mais il n'y a aucun bouton d'action direct (CTA) permettant de commander ou réserver en 1 clic sur WhatsApp. Vos visiteurs lisent mais repartent sans vous contacter. J'ai préparé un exemple d'intégration WhatsApp direct : je vous l'envoie ?`;
  } else if (pb?.angle_probleme) {
    msgProbleme = pb.angle_probleme
      .replace(/\{prenom_ou_nom\}/g, nom)
      .replace(/\{nom\}/g, nom)
      .replace(/\{note_google\}/g, note)
      .replace(/\{avis_google\}/g, avis)
      .replace(/\{ville\}/g, ville);
  } else {
    msgProbleme = `Bonjour ${nom}. J'ai analysé votre présence en ligne à ${ville}. Vos services sont de grande qualité (${note}/5), mais votre tunnel de conversion actuel freine les prises de contact spontanées sur mobile. J'ai préparé un aperçu d'optimisation concret : je peux vous le transmettre ?`;
  }

  // 2. Angle Opportunité
  let msgOpportunite = "";
  if (pb?.angle_opportunite) {
    msgOpportunite = pb.angle_opportunite
      .replace(/\{prenom_ou_nom\}/g, nom)
      .replace(/\{nom\}/g, nom)
      .replace(/\{note_google\}/g, note)
      .replace(/\{avis_google\}/g, avis)
      .replace(/\{ville\}/g, ville);
  } else {
    msgOpportunite = `Bonjour ${nom}. Félicitations pour vos ${avis} avis sur Google Maps (${note}/5). En ajoutant un tunnel de commande/réservation direct en 1 clic sur WhatsApp, vous pourriez capter 20 à 30 clients qualifiés supplémentaires chaque mois directement depuis Google. J'ai conçu un aperçu interactif adapté à votre établissement : je vous partage le lien ?`;
  }

  // 3. Gestion des 3 Objections
  const obj = pb?.gestion_objections || {};
  const pasDeBudget =
    obj.pas_de_budget ||
    `Je comprends tout à fait. C'est justement pour cela qu'on commence par un système rentable dès le premier mois qui s'amortit en 2 ou 3 commandes clients. Quel serait votre budget idéal pour tester sans risque ?`;

  const pasLeTemps =
    obj.pas_le_temps ||
    `Je m'occupe de 100% de la conception, de la rédaction et de la mise en place. Vous avez juste à valider l'aperçu que je vous envoie sur WhatsApp en 2 minutes de vocal.`;

  const dejaQuelquun =
    obj.deja_quelquun ||
    `C'est une excellente chose ! Gardez précieusement mon contact si jamais vous avez besoin d'une refonte express ou d'un renfort réactif pour vos pics d'activité. Voulez-vous quand même jeter un œil à l'aperçu gratuit préparé pour vous ?`;

  // 4. Séquence de 3 relances planifiées
  const relancesDefaut = pb?.sequence_relances || [];
  const r1J2 =
    relancesDefaut[0]?.replace(/\{nom\}/g, nom) ||
    `Bonjour ${nom}, avez-vous pu jeter un coup d'œil à l'aperçu rapide ? J'ai vérifié le rendu sur smartphone, c'est immédiatement plus lisible pour vos clients.`;

  const r2J4 =
    relancesDefaut[1]?.replace(/\{nom\}/g, nom) ||
    `Bonjour ${nom}, juste un chiffre concret : 70% des clients qui cherchent un établissement à ${ville} abandonnent s'il n'y a pas de lien WhatsApp direct. Je vous garde la proposition de côté cette semaine ?`;

  const r3J7 =
    relancesDefaut[2]?.replace(/\{nom\}/g, nom) ||
    `Bonjour ${nom}, je boucle mes projets prioritaires ce vendredi. Si ce sujet n'est pas votre priorité actuelle, aucun problème, dites-le moi simplement et je ne vous relance plus. Excellente continuation !`;

  return {
    messageAngleProbleme: msgProbleme,
    messageAngleOpportunite: msgOpportunite,
    gestionObjections: {
      pasDeBudget,
      pasLeTemps,
      dejaQuelquun,
    },
    sequenceRelances: {
      r1J2,
      r2J4,
      r3J7,
    },
  };
}
