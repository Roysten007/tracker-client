// Extraction sécurisée du texte visible d'un site web côté serveur (Étape 4).
// Récupère uniquement le contenu textuel réel (titres, méta, CTA, paragraphes)
// sans scripts, styles ni code superflu. Zéro problème de CORS grâce à createServerFn.

import { createServerFn } from "@tanstack/react-start";

export type ContenuTexteSite = {
  url: string;
  titre: string;
  descriptionMeta: string;
  titresH1: string[];
  titresH2: string[];
  boutonsCta: string[];
  paragraphes: string[];
  texteVisibleComplet: string;
  erreur?: string;
};

export async function extraireContenuTexteServeur(urlWeb: string): Promise<ContenuTexteSite> {
  const urlPropre = (urlWeb || "").trim();
  if (!urlPropre) {
    return {
      url: "",
      titre: "",
      descriptionMeta: "",
      titresH1: [],
      titresH2: [],
      boutonsCta: [],
      paragraphes: [],
      texteVisibleComplet: "",
      erreur: "URL vide",
    };
  }

  const urlComplete =
    urlPropre.startsWith("http://") || urlPropre.startsWith("https://")
      ? urlPropre
      : `https://${urlPropre}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000); // 7s timeout

  try {
    const res = await fetch(urlComplete, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SprintTracker/2.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        url: urlComplete,
        titre: "",
        descriptionMeta: "",
        titresH1: [],
        titresH2: [],
        boutonsCta: [],
        paragraphes: [],
        texteVisibleComplet: "",
        erreur: `Erreur HTTP ${res.status}`,
      };
    }

    const html = await res.text();

    // 1. Extraire le titre <title>
    const titreMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const titre = titreMatch ? titreMatch[1].trim() : "";

    // 2. Extraire la méta description
    const metaMatch =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const descriptionMeta = metaMatch ? metaMatch[1].trim() : "";

    // 3. Extraire les balises H1
    const titresH1: string[] = [];
    const h1Regex = /<h1[^>]*>([^<]+)<\/h1>/gi;
    let matchH1: RegExpExecArray | null;
    while ((matchH1 = h1Regex.exec(html)) !== null && titresH1.length < 5) {
      const t = matchH1[1].replace(/<[^>]+>/g, "").trim();
      if (t) titresH1.push(t);
    }

    // 4. Extraire les balises H2
    const titresH2: string[] = [];
    const h2Regex = /<h2[^>]*>([^<]+)<\/h2>/gi;
    let matchH2: RegExpExecArray | null;
    while ((matchH2 = h2Regex.exec(html)) !== null && titresH2.length < 6) {
      const t = matchH2[1].replace(/<[^>]+>/g, "").trim();
      if (t) titresH2.push(t);
    }

    // 5. Extraire les boutons et CTA
    const boutonsCta: string[] = [];
    const btnRegex = /<(?:button|a)[^>]*(?:btn|button|cta|reserver|commander|contact|whatsapp)[^>]*>([^<]+)<\/(?:button|a)>/gi;
    let matchBtn: RegExpExecArray | null;
    while ((matchBtn = btnRegex.exec(html)) !== null && boutonsCta.length < 8) {
      const t = matchBtn[1].replace(/<[^>]+>/g, "").trim();
      if (t && t.length > 2 && t.length < 50 && !boutonsCta.includes(t)) {
        boutonsCta.push(t);
      }
    }

    // 6. Nettoyer les balises <script>, <style>, <svg>, <nav>, <footer>
    const htmlNettoye = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");

    // Extraire les paragraphes <p>
    const paragraphes: string[] = [];
    const pRegex = /<p[^>]*>([^<]+)<\/p>/gi;
    let matchP: RegExpExecArray | null;
    while ((matchP = pRegex.exec(htmlNettoye)) !== null && paragraphes.length < 10) {
      const t = matchP[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (t && t.length > 20) {
        paragraphes.push(t);
      }
    }

    // Synthèse du texte visible (max 2500 caractères)
    const elementsVisibles = [
      titre ? `Titre du site : ${titre}` : "",
      descriptionMeta ? `Description : ${descriptionMeta}` : "",
      titresH1.length > 0 ? `H1 : ${titresH1.join(" | ")}` : "",
      titresH2.length > 0 ? `H2 : ${titresH2.join(" | ")}` : "",
      boutonsCta.length > 0 ? `Boutons / CTA : ${boutonsCta.join(" | ")}` : "",
      paragraphes.length > 0 ? `Extraits de texte : ${paragraphes.slice(0, 5).join(" ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      url: urlComplete,
      titre,
      descriptionMeta,
      titresH1,
      titresH2,
      boutonsCta,
      paragraphes,
      texteVisibleComplet: elementsVisibles.slice(0, 3000),
    };
  } catch (err: any) {
    clearTimeout(timeout);
    return {
      url: urlComplete,
      titre: "",
      descriptionMeta: "",
      titresH1: [],
      titresH2: [],
      boutonsCta: [],
      paragraphes: [],
      texteVisibleComplet: "",
      erreur: err?.name === "AbortError" ? "Délai de chargement dépassé (>7s)" : err?.message || "Erreur de connexion",
    };
  }
}

// Server function TanStack Start exécutable depuis le client
export const extraireTexteVisibleServeur = createServerFn({ method: "POST" })
  .validator((d: { url: string }) => d)
  .handler(async ({ data }) => {
    return await extraireContenuTexteServeur(data.url);
  });
