// Sprint Machine — content script
// Bouton flottant "SM" en bas à droite sur LinkedIn/Facebook.
// Au clic : extraction du texte visible + redirection vers l'app avec le texte en fragment URL.
// Aucune automatisation. Lecture uniquement au clic. Jamais d'action sur les identifiants.

(function () {
  "use strict";

  const APP_URL_DEFAUT = "https://sprint-client-tracker.vercel.app";
  const HOST_LINKEDIN = "https://www.linkedin.com/*";
  const HOST_FACEBOOK = "https://www.facebook.com/*";
  const MAX_TEXTE = 6000;
  const SEUIL_URL_LONG = 50000;

  // --- Utilitaires DOM -------------------------------------------------------

  function creerElement(tag, attrs = {}, styles = {}) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "text") el.textContent = v;
      else el.setAttribute(k, v);
    }
    Object.assign(el.style, styles);
    return el;
  }

  // Extrait le texte visible pertinent du profil. Approche prudente :
  // on cible le <main> quand il existe, sinon <body>, on retire scripts/nav/aside.
  function extraireTexteProfil() {
    const racine = document.querySelector("main") || document.body;
    if (!racine) return "";

    // Cloner puis nettoyer — ne modifie pas la vraie page.
    const clone = racine.cloneNode(true);
    for (const s of clone.querySelectorAll(
      "script, style, noscript, nav, aside, footer, header, [role='navigation'], [aria-hidden='true']",
    )) {
      s.remove();
    }
    // innerText respecte l'invisibilité CSS (contrairement à textContent).
    const texte = (clone.innerText || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return texte.slice(0, MAX_TEXTE);
  }

  // --- Ouverture de l'app avec le texte capturé -----------------------------

  async function ouvrirAppAvecTexte(texte, urlSource) {
    const cfg = await browser.storage.local.get({ appUrl: APP_URL_DEFAUT });
    const base = (cfg.appUrl || APP_URL_DEFAUT).replace(/\/$/, "");

    const fragment = new URLSearchParams();
    fragment.set("texte", texte);
    if (urlSource) fragment.set("source", urlSource);
    const fragmentStr = fragment.toString();

    // Repli presse-papiers si le fragment est trop long (limite pratique ~50k).
    if (fragmentStr.length > SEUIL_URL_LONG) {
      try {
        await navigator.clipboard.writeText(texte);
      } catch {
        /* on continue quand même — l'app affichera "colle Ctrl+V" */
      }
      window.open(`${base}/analyse#coller=1`, "_blank", "noopener,noreferrer");
      return;
    }

    // Cas normal : fragment URL (jamais envoyé au serveur, reste dans le navigateur).
    window.open(`${base}/analyse#${fragmentStr}`, "_blank", "noopener,noreferrer");
  }

  // --- Overlay minimal (état chargement / erreur) ---------------------------

  let overlay = null;

  function afficherOverlay(contenu) {
    if (overlay) overlay.remove();
    overlay = creerElement("div", { id: "sm-overlay" });
    overlay.innerHTML = `
      <div class="sm-overlay-header">
        <span>Sprint Machine</span>
        <button class="sm-overlay-close" aria-label="Fermer">×</button>
      </div>
      <div class="sm-overlay-body">${contenu}</div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector(".sm-overlay-close").addEventListener("click", () => {
      overlay.remove();
      overlay = null;
    });
  }

  // --- Vérification / demande des host_permissions (Firefox MV3) ------------
  //
  // Sur Firefox MV3, les host_permissions déclarées en optionnelles doivent être
  // accordées explicitement au premier usage. Si absentes, on demande, avec un
  // message clair dans l'overlay si l'utilisateur refuse.

  async function verifierPermissions() {
    if (!browser.permissions) return true; // pas d'API permissions → on continue.
    try {
      const already = await browser.permissions.contains({ origins: [HOST_LINKEDIN, HOST_FACEBOOK] });
      if (already) return true;
      const accorde = await browser.permissions.request({ origins: [HOST_LINKEDIN, HOST_FACEBOOK] });
      return accorde;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[SM] permissions check failed", e);
      return true; // on préfère laisser passer et laisser l'utilisateur voir l'échec réel.
    }
  }

  // --- Bouton flottant -------------------------------------------------------

  function injecterBouton() {
    if (document.getElementById("sm-bouton")) return;

    const btn = creerElement("button", {
      id: "sm-bouton",
      "aria-label": "Sprint Machine — capturer ce profil",
      title: "Sprint Machine — capturer ce profil",
      type: "button",
      text: "SM",
    });

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const ok = await verifierPermissions();
      if (!ok) {
        afficherOverlay(
          `<p>Permissions LinkedIn/Facebook non accordées. Va dans les Options de l'extension pour les activer, ou clique à nouveau pour redemander.</p>`,
        );
        return;
      }

      afficherOverlay(`<p>Capture en cours…</p>`);
      try {
        const texte = extraireTexteProfil();
        if (!texte || texte.length < 60) {
          afficherOverlay(
            `<p>Impossible d'extraire assez de texte de cette page. Ouvre un vrai profil (bio, à propos, publications) puis réessaie.</p>`,
          );
          return;
        }
        await ouvrirAppAvecTexte(texte, window.location.href);
        // Fermer l'overlay après un court délai.
        setTimeout(() => {
          if (overlay) {
            overlay.remove();
            overlay = null;
          }
        }, 800);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[SM] capture échouée", err);
        afficherOverlay(
          `<p>Erreur pendant la capture. Vérifie ton token dans les options et réessaie.</p>`,
        );
      }
    });

    document.body.appendChild(btn);
  }

  // La navigation dans LinkedIn/Facebook = SPA : le DOM change sans reload.
  // On observe simplement le body pour réinjecter le bouton si nécessaire.
  const injecterSiBesoin = () => injecterBouton();
  const mo = new MutationObserver(injecterSiBesoin);
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Injection initiale.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injecterSiBesoin, { once: true });
  } else {
    injecterSiBesoin();
  }
})();
