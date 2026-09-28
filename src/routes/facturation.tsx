import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  Copy,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  FileCheck,
  FilePlus2,
  FileText,
  MessageCircle,
  Plus,
  Printer,
  Receipt,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";

import {
  calculerTotalDocument,
  convertirDevisEnFacture,
  creerDocumentVente,
  genererNumeroDocument,
  mettreAJourDocumentVente,
  supprimerDocumentVente,
  tousDocuments,
  tousProspects,
  useHydraterSM,
  useSprintMachine,
} from "../lib/store2";
import type {
  ArticleDocument,
  DocumentVente,
  StatutDocumentVente,
  TypeDocumentVente,
} from "../lib/types";
import { LABEL_STATUT_DOC } from "../lib/types";
import { addDays, formatShortFr, todayKey } from "../lib/date";

export const Route = createFileRoute("/facturation")({
  validateSearch: (search: Record<string, unknown>): {
    prospectId?: string;
    nouveau?: string;
    type?: TypeDocumentVente;
  } => ({
    prospectId: typeof search.prospectId === "string" ? search.prospectId : undefined,
    nouveau: typeof search.nouveau === "string" ? search.nouveau : undefined,
    type: typeof search.type === "string" ? (search.type as TypeDocumentVente) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Devis & Factures — Sprint Machine" },
      { name: "description", content: "Créer, partager et suivre tes devis et factures clients." },
    ],
  }),
  component: FacturationPage,
});

// Modèles rapides de prestations pour aller vite
const PRESTATIONS_TYPES: { description: string; prixDefaut: number }[] = [
  { description: "Création Landing Page de Vente haute conversion", prixDefaut: 150000 },
  { description: "Site Vitrine Professionnel (3 à 5 pages)", prixDefaut: 250000 },
  { description: "Tunnel de Prospection & Automatisation", prixDefaut: 200000 },
  { description: "Pack Identité Visuelle & Charte Graphique", prixDefaut: 120000 },
  { description: "Audit & Optimisation UX/UI de site existant", prixDefaut: 80000 },
];

function formatMonnaie(valeur: number, devise = "FCFA"): string {
  const formate = Math.round(valeur).toLocaleString("fr-FR");
  return `${formate} ${devise}`;
}

function FacturationPage() {
  useHydraterSM();
  const s = useSprintMachine();
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  const documents = useMemo(
    () => Object.values(s.documents).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [s.documents],
  );
  const prospects = useMemo(() => Object.values(s.prospects), [s.prospects]);

  const [filtreType, setFiltreType] = useState<"tous" | "devis" | "facture" | "paye">("tous");
  const [recherche, setRecherche] = useState("");
  const [docEnEdition, setDocEnEdition] = useState<DocumentVente | null>(null);
  const [estNouveauDoc, setEstNouveauDoc] = useState(false);
  const [docApercu, setDocApercu] = useState<DocumentVente | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const notifier = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Gestion du paramètre de recherche URL (ex: quand on clique "Créer un devis" depuis Pipeline)
  useEffect(() => {
    if (searchParams.nouveau || searchParams.prospectId) {
      const typeChoisi = searchParams.type === "facture" ? "facture" : "devis";
      const prospectAssocie = searchParams.prospectId
        ? prospects.find((p) => p.id === searchParams.prospectId)
        : undefined;

      const dateAuj = todayKey();
      const num = genererNumeroDocument(typeChoisi, s);

      const nouveau: DocumentVente = {
        id: "",
        type: typeChoisi,
        numero: num,
        dateEmission: dateAuj,
        dateEcheance: addDays(dateAuj, typeChoisi === "devis" ? 15 : 7),
        prospectId: prospectAssocie?.id,
        clientNom: prospectAssocie?.prenom
          ? `${prospectAssocie.prenom} (${prospectAssocie.metier})`
          : "",
        clientTelephone: prospectAssocie?.lien?.startsWith("+") ? prospectAssocie.lien : "",
        clientEmail: "",
        clientAdresse: "",
        emetteurNom: "Roy Sten Design",
        emetteurContact: "+229 01 98 00 00 00 / contact@roysten.design",
        emetteurAdresse: "Cotonou, Bénin",
        devise: "FCFA",
        articles: [
          {
            id: "art_1",
            description: "Prestation de conception web & design",
            quantite: 1,
            prixUnitaire: 150000,
          },
        ],
        remise: 0,
        acompteRequis: 50,
        conditionsPaiement:
          "50% à la validation de la commande, solde à la livraison. Paiement par MTN Mobile Money, Moov Money ou Virement bancaire.",
        notes: "Devis valable 15 jours à compter de la date d'émission.",
        statut: "brouillon",
        createdAt: "",
        updatedAt: "",
      };

      setDocEnEdition(nouveau);
      setEstNouveauDoc(true);

      // Nettoie l'URL
      navigate({ to: "/facturation", search: {} });
    }
  }, [searchParams, prospects, s, navigate]);

  // Filtrage
  const documentsFiltres = useMemo(() => {
    return documents.filter((doc) => {
      if (filtreType === "devis" && doc.type !== "devis") return false;
      if (filtreType === "facture" && doc.type !== "facture") return false;
      if (filtreType === "paye" && doc.statut !== "paye" && doc.statut !== "accepte") return false;
      if (recherche.trim()) {
        const q = recherche.toLowerCase();
        const matchNom = doc.clientNom.toLowerCase().includes(q);
        const matchNum = doc.numero.toLowerCase().includes(q);
        if (!matchNom && !matchNum) return false;
      }
      return true;
    });
  }, [documents, filtreType, recherche]);

  // Totaux statistiques
  const totauxStats = useMemo(() => {
    let totalDevis = 0;
    let totalFacture = 0;
    let totalEncaisse = 0;

    for (const doc of documents) {
      const { total } = calculerTotalDocument(doc);
      if (doc.type === "devis" && doc.statut !== "refuse" && doc.statut !== "annule") {
        totalDevis += total;
      }
      if (doc.type === "facture") {
        totalFacture += total;
        if (doc.statut === "paye") {
          totalEncaisse += total;
        }
      }
    }

    return { totalDevis, totalFacture, totalEncaisse };
  }, [documents]);

  const ouvrirNouveau = (type: TypeDocumentVente) => {
    const dateAuj = todayKey();
    const num = genererNumeroDocument(type, s);
    const nouveau: DocumentVente = {
      id: "",
      type,
      numero: num,
      dateEmission: dateAuj,
      dateEcheance: addDays(dateAuj, type === "devis" ? 15 : 7),
      clientNom: "",
      clientTelephone: "",
      clientEmail: "",
      clientAdresse: "",
      emetteurNom: "Roy Sten Design",
      emetteurContact: "+229 01 98 00 00 00 / contact@roysten.design",
      emetteurAdresse: "Cotonou, Bénin",
      devise: "FCFA",
      articles: [
        {
          id: `art_${Date.now()}`,
          description: "Conception Landing Page ou Site Web",
          quantite: 1,
          prixUnitaire: 150000,
        },
      ],
      remise: 0,
      acompteRequis: 50,
      conditionsPaiement:
        "50% à la commande, solde à la livraison. MTN Mobile Money / Moov Money / Virement bancaire.",
      notes: type === "devis" ? "Devis valable 15 jours." : "Merci pour votre confiance !",
      statut: "brouillon",
      createdAt: "",
      updatedAt: "",
    };
    setDocEnEdition(nouveau);
    setEstNouveauDoc(true);
  };

  const handleEnregistrer = async (docData: DocumentVente) => {
    if (estNouveauDoc) {
      const { id, createdAt, updatedAt, ...rest } = docData;
      void id;
      void createdAt;
      void updatedAt;
      await creerDocumentVente(rest);
      notifier(
        `${docData.type === "devis" ? "Devis" : "Facture"} ${docData.numero} créé avec succès.`,
      );
    } else {
      await mettreAJourDocumentVente(docData.id, docData);
      notifier(`${docData.numero} mis à jour.`);
    }
    setDocEnEdition(null);
    setEstNouveauDoc(false);
  };

  const handleConvertir = async (devisId: string) => {
    try {
      const nouvFactureId = await convertirDevisEnFacture(devisId);
      notifier("Devis accepté et converti en Facture !");
      const fact = s.documents[nouvFactureId];
      if (fact) setDocApercu(fact);
    } catch (e) {
      notifier("Erreur lors de la conversion.");
    }
  };

  const handleSupprimer = async (id: string) => {
    if (confirm("Supprimer définitivement ce document ?")) {
      await supprimerDocumentVente(id);
      notifier("Document supprimé.");
    }
  };

  const genererMessageWhatsApp = (doc: DocumentVente): string => {
    const { total } = calculerTotalDocument(doc);
    const libelleType = doc.type === "devis" ? "devis" : "facture";
    return encodeURIComponent(
      `Bonjour ${doc.clientNom},\n\nVoici les détails de votre ${libelleType} n° *${doc.numero}* de *${doc.emetteurNom}* :\n\n` +
        doc.articles
          .map(
            (a) =>
              `• ${a.description} (x${a.quantite}) : ${formatMonnaie(a.quantite * a.prixUnitaire, doc.devise)}`,
          )
          .join("\n") +
        `\n\n*Total net à payer : ${formatMonnaie(total, doc.devise)}*` +
        (doc.acompteRequis ? `\n(Acompte requis : ${doc.acompteRequis}%)` : "") +
        `\n\nConditions de règlement :\n${doc.conditionsPaiement}\n\nRestant à votre disposition !`,
    );
  };

  return (
    <div className="pb-10 md:mx-auto md:max-w-4xl">
      {/* Header bandeau */}
      <header
        className="px-5 pb-5 pt-8 text-white md:px-8 md:pt-10 md:rounded-2xl"
        style={{
          background: "var(--navy-950)",
          paddingTop: "calc(env(safe-area-inset-top) + 24px)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-white" style={{ fontWeight: 800, fontSize: 26 }}>
              Devis & Factures
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: "var(--royal-100)" }}>
              Chiffrer, remettre directement aux clients et encaisser.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => ouvrirNouveau("devis")}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px] font-bold text-white transition hover:opacity-95"
              style={{ background: "var(--royal-600)" }}
            >
              <Plus size={16} /> Devis
            </button>
            <button
              onClick={() => ouvrirNouveau("facture")}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px] font-bold text-white transition hover:opacity-95"
              style={{ background: "var(--royal-800)", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              <Receipt size={16} /> Facture
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 md:mt-6">
        {/* Cartes KPI */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="card-sc p-4">
            <div
              className="flex items-center gap-1.5 text-[12px] font-medium"
              style={{ color: "var(--hint)" }}
            >
              <FileText size={15} style={{ color: "var(--royal-800)" }} /> Devis en cours
            </div>
            <div
              className="mt-1 font-display tnum"
              style={{ fontWeight: 700, fontSize: 22, color: "var(--navy-950)" }}
            >
              {formatMonnaie(totauxStats.totalDevis)}
            </div>
          </div>
          <div className="card-sc p-4">
            <div
              className="flex items-center gap-1.5 text-[12px] font-medium"
              style={{ color: "var(--hint)" }}
            >
              <Receipt size={15} style={{ color: "var(--royal-600)" }} /> Total Facturé
            </div>
            <div
              className="mt-1 font-display tnum"
              style={{ fontWeight: 700, fontSize: 22, color: "var(--navy-950)" }}
            >
              {formatMonnaie(totauxStats.totalFacture)}
            </div>
          </div>
          <div className="card-sc p-4">
            <div
              className="flex items-center gap-1.5 text-[12px] font-medium"
              style={{ color: "var(--hint)" }}
            >
              <DollarSign size={15} style={{ color: "#16a34a" }} /> Total Encaissé
            </div>
            <div
              className="mt-1 font-display tnum"
              style={{ fontWeight: 700, fontSize: 22, color: "#16a34a" }}
            >
              {formatMonnaie(totauxStats.totalEncaisse)}
            </div>
          </div>
        </section>

        {/* Barre de filtre & recherche */}
        <section className="card-sc p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "tous", label: "Tous" },
                { id: "devis", label: "Devis" },
                { id: "facture", label: "Factures" },
                { id: "paye", label: "Payés / Acceptés" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltreType(f.id as "tous" | "devis" | "facture" | "paye")}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-medium transition"
                  style={{
                    background: filtreType === f.id ? "var(--royal-800)" : "transparent",
                    color: filtreType === f.id ? "#fff" : "var(--hint)",
                    fontWeight: filtreType === f.id ? 700 : 500,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={15}
                className="absolute left-3 top-2.5"
                style={{ color: "var(--hint)" }}
              />
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher client, numéro..."
                className="w-full rounded-lg border border-[#E7E8F4] bg-[#F5F5FD] py-1.5 pl-8 pr-3 text-[13px] focus:bg-white focus:outline-none focus:border-royal-600"
              />
            </div>
          </div>
        </section>

        {/* Liste des documents */}
        <section className="space-y-3">
          {documentsFiltres.length === 0 ? (
            <div className="card-sc flex flex-col items-center justify-center p-8 text-center">
              <div
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: "var(--royal-100)" }}
              >
                <FileText size={24} style={{ color: "var(--royal-800)" }} />
              </div>
              <p
                className="font-display text-[15px]"
                style={{ fontWeight: 700, color: "var(--navy-950)" }}
              >
                Aucun document pour l'instant
              </p>
              <p className="mt-1 text-[13px] max-w-sm" style={{ color: "var(--hint)" }}>
                Crée ton premier devis ou facture pour remettre une proposition claire et
                professionnelle à tes prospects.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => ouvrirNouveau("devis")}
                  className="btn-primary-sc px-4 py-2 text-[13px]"
                >
                  + Créer un Devis
                </button>
              </div>
            </div>
          ) : (
            documentsFiltres.map((doc) => {
              const { total } = calculerTotalDocument(doc);
              const estDevis = doc.type === "devis";

              return (
                <div key={doc.id} className="card-sc p-4 transition hover:border-royal-600">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider"
                          style={{
                            background: estDevis ? "var(--royal-100)" : "#dcfce7",
                            color: estDevis ? "var(--royal-800)" : "#15803d",
                          }}
                        >
                          {doc.type}
                        </span>
                        <span
                          className="font-display text-[14px]"
                          style={{ fontWeight: 700, color: "var(--navy-950)" }}
                        >
                          {doc.numero}
                        </span>
                        <span className="text-[12px]" style={{ color: "var(--hint)" }}>
                          · {formatShortFr(doc.dateEmission)}
                        </span>
                      </div>

                      <div className="mt-2">
                        <div
                          className="font-medium text-[15px]"
                          style={{ color: "var(--navy-950)" }}
                        >
                          {doc.clientNom || "Client sans nom"}
                        </div>
                        {doc.clientTelephone && (
                          <div className="text-[12px]" style={{ color: "var(--hint)" }}>
                            Tél : {doc.clientTelephone}
                          </div>
                        )}
                      </div>

                      <div className="mt-2 text-[12px] text-muted-foreground line-clamp-1">
                        {doc.articles.map((a) => a.description).join(", ")}
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className="font-display text-[18px]"
                        style={{ fontWeight: 800, color: "var(--navy-950)" }}
                      >
                        {formatMonnaie(total, doc.devise)}
                      </div>

                      {/* Sélecteur de statut rapide */}
                      <select
                        value={doc.statut}
                        onChange={(e) =>
                          mettreAJourDocumentVente(doc.id, {
                            statut: e.target.value as StatutDocumentVente,
                          })
                        }
                        className="mt-1.5 rounded-lg border border-[#E7E8F4] bg-white px-2 py-1 text-[11px] font-semibold text-right"
                      >
                        <option value="brouillon">Brouillon</option>
                        <option value="envoye">Envoyé</option>
                        <option value="accepte">Accepté</option>
                        <option value="paye">Payé</option>
                        <option value="refuse">Refusé</option>
                        <option value="annule">Annulé</option>
                      </select>
                    </div>
                  </div>

                  {/* Actions sur le document */}
                  <div className="mt-4 flex flex-wrap items-center justify-between border-t border-[#E7E8F4] pt-3 gap-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setDocApercu(doc)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7E8F4] bg-white px-3 py-1.5 text-[12px] font-medium transition hover:bg-[#F5F5FD]"
                      >
                        <Printer size={14} /> Aperçu & Imprimer
                      </button>

                      {doc.clientTelephone && (
                        <a
                          href={`https://wa.me/${doc.clientTelephone.replace(/[^0-9]/g, "")}?text=${genererMessageWhatsApp(doc)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#25D366] bg-[#E8FBF0] px-3 py-1.5 text-[12px] font-semibold text-[#128C7E] transition hover:bg-[#d5f7e3]"
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                      )}

                      {estDevis && doc.statut !== "accepte" && (
                        <button
                          onClick={() => handleConvertir(doc.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-royal-600 bg-white px-3 py-1.5 text-[12px] font-semibold text-royal-800 transition hover:bg-royal-50"
                        >
                          <FileCheck size={14} /> Convertir en facture
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setDocEnEdition(doc);
                          setEstNouveauDoc(false);
                        }}
                        aria-label="Modifier"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-[#E9EAFB] hover:text-royal-800 transition"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleSupprimer(doc.id)}
                        aria-label="Supprimer"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      {/* Modal / Formulaire d'édition Devis / Facture */}
      {docEnEdition && (
        <ModalEditeurDocument
          docInitial={docEnEdition}
          estNouveau={estNouveauDoc}
          prospects={prospects}
          onFermer={() => {
            setDocEnEdition(null);
            setEstNouveauDoc(false);
          }}
          onEnregistrer={handleEnregistrer}
        />
      )}

      {/* Modal d'Aperçu & Impression A4 Pro */}
      {docApercu && (
        <ModalApercuDocument
          doc={docApercu}
          onFermer={() => setDocApercu(null)}
          onConvertir={() => {
            const id = docApercu.id;
            setDocApercu(null);
            handleConvertir(id);
          }}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[12px] text-white shadow-lg"
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 80px)",
            background: "var(--royal-800)",
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Composant : Modal d'Édition / Création de Document
// -----------------------------------------------------------------------------

function ModalEditeurDocument({
  docInitial,
  estNouveau,
  prospects,
  onFermer,
  onEnregistrer,
}: {
  docInitial: DocumentVente;
  estNouveau: boolean;
  prospects: ReturnType<typeof tousProspects>;
  onFermer: () => void;
  onEnregistrer: (doc: DocumentVente) => void;
}) {
  const [doc, setDoc] = useState<DocumentVente>(docInitial);

  const majChamp = <K extends keyof DocumentVente>(champ: K, valeur: DocumentVente[K]) => {
    setDoc((prev) => ({ ...prev, [champ]: valeur }));
  };

  const selectionnerProspect = (prospectId: string) => {
    const p = prospects.find((item) => item.id === prospectId);
    if (!p) return;
    setDoc((prev) => ({
      ...prev,
      prospectId: p.id,
      clientNom: p.prenom ? `${p.prenom} (${p.metier})` : prev.clientNom,
      clientTelephone: p.lien?.startsWith("+") ? p.lien : prev.clientTelephone,
    }));
  };

  // Articles
  const majArticle = <K extends keyof ArticleDocument>(
    id: string,
    champ: K,
    valeur: ArticleDocument[K],
  ) => {
    setDoc((prev) => ({
      ...prev,
      articles: prev.articles.map((art) => (art.id === id ? { ...art, [champ]: valeur } : art)),
    }));
  };

  const ajouterArticle = () => {
    const nouv: ArticleDocument = {
      id: `art_${Date.now()}`,
      description: "",
      quantite: 1,
      prixUnitaire: 50000,
    };
    setDoc((prev) => ({ ...prev, articles: [...prev.articles, nouv] }));
  };

  const supprimerArticle = (id: string) => {
    if (doc.articles.length <= 1) return;
    setDoc((prev) => ({
      ...prev,
      articles: prev.articles.filter((art) => art.id !== id),
    }));
  };

  const insererModelePrestation = (modele: (typeof PRESTATIONS_TYPES)[0]) => {
    const nouv: ArticleDocument = {
      id: `art_${Date.now()}`,
      description: modele.description,
      quantite: 1,
      prixUnitaire: modele.prixDefaut,
    };
    setDoc((prev) => ({ ...prev, articles: [...prev.articles, nouv] }));
  };

  const { sousTotal, total } = calculerTotalDocument(doc);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="card-sc my-8 w-full max-w-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E7E8F4] pb-4">
          <div>
            <h2
              className="font-display text-[18px]"
              style={{ fontWeight: 800, color: "var(--navy-950)" }}
            >
              {estNouveau
                ? `Nouveau ${doc.type === "devis" ? "Devis" : "Facture"}`
                : `Modifier ${doc.numero}`}
            </h2>
            <p className="text-[12px]" style={{ color: "var(--hint)" }}>
              Renseigne les éléments de ta proposition commerciale.
            </p>
          </div>
          <button
            onClick={onFermer}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-[#F5F5FD]"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onEnregistrer(doc);
          }}
          className="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1"
        >
          {/* Ligne Type + Numéro + Devise */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Type de document
              </label>
              <select
                value={doc.type}
                onChange={(e) => majChamp("type", e.target.value as TypeDocumentVente)}
                className="input-sc mt-1 text-[13px]"
              >
                <option value="devis">Devis</option>
                <option value="facture">Facture</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Numéro</label>
              <input
                type="text"
                required
                value={doc.numero}
                onChange={(e) => majChamp("numero", e.target.value)}
                className="input-sc mt-1 text-[13px] font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Devise</label>
              <select
                value={doc.devise}
                onChange={(e) => majChamp("devise", e.target.value)}
                className="input-sc mt-1 text-[13px]"
              >
                <option value="FCFA">FCFA</option>
                <option value="EUR">€ EUR</option>
                <option value="USD">$ USD</option>
              </select>
            </div>
          </div>

          {/* Liaison Prospect Pipeline */}
          <div className="rounded-xl border border-[#E7E8F4] bg-[#F5F5FD] p-3">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Pré-remplir depuis un prospect du Pipeline (optionnel)
            </label>
            <select
              value={doc.prospectId ?? ""}
              onChange={(e) => selectionnerProspect(e.target.value)}
              className="input-sc mt-1 text-[13px] bg-white"
            >
              <option value="">Sélectionner un prospect existant...</option>
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.prenom} — {p.metier} ({p.statut})
                </option>
              ))}
            </select>
          </div>

          {/* Client coordonnées */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Nom du client *
              </label>
              <input
                type="text"
                required
                placeholder="ex: Cabinet Racine Consulting"
                value={doc.clientNom}
                onChange={(e) => majChamp("clientNom", e.target.value)}
                className="input-sc mt-1 text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Téléphone / WhatsApp
              </label>
              <input
                type="text"
                placeholder="+229..."
                value={doc.clientTelephone ?? ""}
                onChange={(e) => majChamp("clientTelephone", e.target.value)}
                className="input-sc mt-1 text-[13px]"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Date d'émission
              </label>
              <input
                type="date"
                required
                value={doc.dateEmission}
                onChange={(e) => majChamp("dateEmission", e.target.value)}
                className="input-sc mt-1 text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Date d'échéance / Validité
              </label>
              <input
                type="date"
                required
                value={doc.dateEcheance}
                onChange={(e) => majChamp("dateEcheance", e.target.value)}
                className="input-sc mt-1 text-[13px]"
              />
            </div>
          </div>

          {/* Prestations rapides */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Lignes de prestations / Articles
              </label>
              <div className="flex gap-1 text-[11px]">
                <span className="text-muted-foreground">Ajout rapide :</span>
                {PRESTATIONS_TYPES.slice(0, 2).map((mod, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => insererModelePrestation(mod)}
                    className="text-royal-800 hover:underline"
                  >
                    + {mod.description.slice(0, 15)}...
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 space-y-2">
              {doc.articles.map((art) => (
                <div
                  key={art.id}
                  className="flex items-center gap-2 rounded-xl border border-[#E7E8F4] p-2 bg-white"
                >
                  <input
                    type="text"
                    required
                    placeholder="Description de la prestation..."
                    value={art.description}
                    onChange={(e) => majArticle(art.id, "description", e.target.value)}
                    className="flex-1 rounded-lg border border-[#E7E8F4] px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-royal-600"
                  />
                  <input
                    type="number"
                    min="1"
                    title="Quantité"
                    value={art.quantite}
                    onChange={(e) => majArticle(art.id, "quantite", Number(e.target.value))}
                    className="w-16 rounded-lg border border-[#E7E8F4] px-2 py-1.5 text-[13px] text-center"
                  />
                  <input
                    type="number"
                    min="0"
                    title="Prix unitaire"
                    value={art.prixUnitaire}
                    onChange={(e) => majArticle(art.id, "prixUnitaire", Number(e.target.value))}
                    className="w-28 rounded-lg border border-[#E7E8F4] px-2 py-1.5 text-[13px] text-right font-medium"
                  />
                  <span className="text-[11px] text-muted-foreground w-12 text-right">
                    {doc.devise}
                  </span>
                  {doc.articles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => supprimerArticle(art.id)}
                      className="p-1 text-muted-foreground hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={ajouterArticle}
              className="mt-2 flex items-center gap-1 text-[12px] font-bold text-royal-800 hover:underline"
            >
              <Plus size={14} /> Ajouter une ligne
            </button>
          </div>

          {/* Remise & Acompte */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl border border-[#E7E8F4] p-3 bg-[#F5F5FD]">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Remise forfaitaire ({doc.devise})
              </label>
              <input
                type="number"
                min="0"
                value={doc.remise}
                onChange={(e) => majChamp("remise", Number(e.target.value))}
                className="input-sc mt-1 text-[13px] bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Acompte demandé (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={doc.acompteRequis}
                onChange={(e) => majChamp("acompteRequis", Number(e.target.value))}
                className="input-sc mt-1 text-[13px] bg-white"
              />
            </div>
          </div>

          {/* Calcul récapitulatif */}
          <div className="rounded-xl border border-[#E7E8F4] bg-white p-3 text-right">
            <div className="text-[12px] text-muted-foreground">
              Sous-total : {formatMonnaie(sousTotal, doc.devise)}
            </div>
            {doc.remise > 0 && (
              <div className="text-[12px] text-red-600">
                - Remise : {formatMonnaie(doc.remise, doc.devise)}
              </div>
            )}
            <div
              className="mt-1 font-display text-[20px]"
              style={{ fontWeight: 800, color: "var(--navy-950)" }}
            >
              Total : {formatMonnaie(total, doc.devise)}
            </div>
            {doc.acompteRequis > 0 && (
              <div className="text-[12px] font-semibold text-royal-800">
                Acompte à verser ({doc.acompteRequis}%) :{" "}
                {formatMonnaie((total * doc.acompteRequis) / 100, doc.devise)}
              </div>
            )}
          </div>

          {/* Modalités & Conditions de règlement */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">
              Modalités de règlement & Coordonnées
            </label>
            <textarea
              rows={2}
              value={doc.conditionsPaiement}
              onChange={(e) => majChamp("conditionsPaiement", e.target.value)}
              className="input-sc mt-1 text-[12px]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">
              Notes complémentaires
            </label>
            <textarea
              rows={2}
              value={doc.notes}
              onChange={(e) => majChamp("notes", e.target.value)}
              className="input-sc mt-1 text-[12px]"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-[#E7E8F4] pt-4">
            <button
              type="button"
              onClick={onFermer}
              className="rounded-xl border border-[#E7E8F4] px-4 py-2 text-[13px] font-medium"
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary-sc px-5 py-2 text-[13px]">
              Enregistrer le {doc.type}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Composant : Modal d'Aperçu Format A4 & Impression Professionnelle
// -----------------------------------------------------------------------------

function ModalApercuDocument({
  doc,
  onFermer,
  onConvertir,
}: {
  doc: DocumentVente;
  onFermer: () => void;
  onConvertir: () => void;
}) {
  const { sousTotal, remise, total } = calculerTotalDocument(doc);
  const acompte = doc.acompteRequis ? (total * doc.acompteRequis) / 100 : 0;

  const imprimer = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none">
        {/* Barre d'actions (masquée à l'impression) */}
        <div className="flex items-center justify-between border-b border-[#E7E8F4] bg-[#F5F5FD] px-5 py-3 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-display text-[14px] font-bold text-navy-950">
              Aperçu {doc.type === "devis" ? "Devis" : "Facture"} — {doc.numero}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {doc.type === "devis" && doc.statut !== "accepte" && (
              <button
                onClick={onConvertir}
                className="inline-flex items-center gap-1.5 rounded-lg border border-royal-600 bg-white px-3 py-1.5 text-[12px] font-bold text-royal-800 hover:bg-royal-50 transition"
              >
                <FileCheck size={14} /> Convertir en facture
              </button>
            )}
            <button
              onClick={imprimer}
              className="btn-primary-sc inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
            >
              <Printer size={14} /> Imprimer / Enregistrer PDF
            </button>
            <button
              onClick={onFermer}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* FEUILLE A4 FORMAT DESIGN (Visible à l'écran et imprimable) */}
        <div id="feuille-document-print" className="p-8 sm:p-12 text-[#14152E] font-sans">
          {/* En-tête */}
          <div className="flex justify-between items-start border-b-2 border-royal-800 pb-6">
            <div>
              <div className="text-[11px] font-bold tracking-[0.25em] text-royal-800">
                ROY STEN DESIGN
              </div>
              <h1 className="mt-1 font-display text-[26px] font-extrabold uppercase tracking-tight text-navy-950">
                {doc.type === "devis" ? "Devis" : "Facture"}
              </h1>
              <div className="mt-1 text-[13px] font-bold text-royal-600">N° {doc.numero}</div>
            </div>

            <div className="text-right text-[12px] space-y-0.5 text-[#6A6E8C]">
              <div className="font-bold text-[#14152E]">{doc.emetteurNom}</div>
              <div>{doc.emetteurContact}</div>
              {doc.emetteurAdresse && <div>{doc.emetteurAdresse}</div>}
            </div>
          </div>

          {/* Informations Client & Dates */}
          <div className="mt-6 grid grid-cols-2 gap-6 text-[13px]">
            <div className="rounded-xl border border-[#E7E8F4] bg-[#F5F5FD] p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-royal-800">
                Facturé à / Destinataire
              </div>
              <div className="mt-1.5 font-display text-[15px] font-bold text-navy-950">
                {doc.clientNom || "Client"}
              </div>
              {doc.clientTelephone && (
                <div className="mt-1 text-muted-foreground">Tél : {doc.clientTelephone}</div>
              )}
              {doc.clientEmail && (
                <div className="text-muted-foreground">Email : {doc.clientEmail}</div>
              )}
              {doc.clientAdresse && (
                <div className="text-muted-foreground">{doc.clientAdresse}</div>
              )}
            </div>

            <div className="flex flex-col justify-center space-y-2 rounded-xl border border-[#E7E8F4] p-4 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[#6A6E8C]">Date d'émission :</span>
                <span className="font-semibold text-navy-950">
                  {formatShortFr(doc.dateEmission)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6A6E8C]">
                  {doc.type === "devis" ? "Validité jusqu'au :" : "Date d'échéance :"}
                </span>
                <span className="font-semibold text-navy-950">
                  {formatShortFr(doc.dateEcheance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6A6E8C]">Statut :</span>
                <span className="font-bold uppercase text-royal-800 text-[11px]">
                  {LABEL_STATUT_DOC[doc.statut]}
                </span>
              </div>
            </div>
          </div>

          {/* Tableau des prestations */}
          <div className="mt-8 overflow-hidden rounded-xl border border-[#E7E8F4]">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#0A0A78] text-white font-display text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Désignation</th>
                  <th className="py-3 px-3 text-center w-16">Qté</th>
                  <th className="py-3 px-4 text-right w-32">Prix unitaire</th>
                  <th className="py-3 px-4 text-right w-36">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E8F4]">
                {doc.articles.map((art, idx) => (
                  <tr key={art.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#F9FAFE]"}>
                    <td className="py-3.5 px-4 font-medium">{art.description}</td>
                    <td className="py-3.5 px-3 text-center">{art.quantite}</td>
                    <td className="py-3.5 px-4 text-right tnum">
                      {formatMonnaie(art.prixUnitaire, doc.devise)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold tnum">
                      {formatMonnaie(art.quantite * art.prixUnitaire, doc.devise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totaux & Règlements */}
          <div className="mt-6 flex flex-col sm:flex-row justify-between gap-6">
            <div className="flex-1 space-y-3 text-[12px]">
              {doc.conditionsPaiement && (
                <div className="rounded-xl border border-[#E7E8F4] p-3 bg-[#F5F5FD]">
                  <div className="font-bold text-royal-800 text-[11px] uppercase tracking-wider">
                    Modalités de règlement
                  </div>
                  <p className="mt-1 text-[#14152E] whitespace-pre-line leading-relaxed">
                    {doc.conditionsPaiement}
                  </p>
                </div>
              )}
              {doc.notes && (
                <p className="text-[11px] text-muted-foreground italic whitespace-pre-line">
                  {doc.notes}
                </p>
              )}
            </div>

            <div className="w-full sm:w-64 space-y-1.5 text-right text-[13px]">
              <div className="flex justify-between text-muted-foreground">
                <span>Sous-total :</span>
                <span className="font-medium tnum">{formatMonnaie(sousTotal, doc.devise)}</span>
              </div>
              {remise > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Remise :</span>
                  <span className="font-medium tnum">- {formatMonnaie(remise, doc.devise)}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-royal-800 pt-2 text-[17px] font-display font-extrabold text-navy-950">
                <span>Total Net :</span>
                <span className="tnum">{formatMonnaie(total, doc.devise)}</span>
              </div>
              {acompte > 0 && (
                <div className="rounded-lg bg-[#E9EAFB] p-2 mt-2 text-[12px] font-bold text-royal-800 flex justify-between">
                  <span>Acompte ({doc.acompteRequis}%) :</span>
                  <span className="tnum">{formatMonnaie(acompte, doc.devise)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Pied de page */}
          <div className="mt-12 border-t border-[#E7E8F4] pt-4 text-center text-[10px] text-muted-foreground">
            Sprint Machine · {doc.emetteurNom} · Document généré le {formatShortFr(todayKey())}
          </div>
        </div>
      </div>
    </div>
  );
}
