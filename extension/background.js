// Event page (Firefox MV3 ne supporte pas les service workers — background.scripts en manifest).
// Rôle minimal : centraliser la logique de permissions et l'ouverture d'onglets.
//
// Le content script s'occupe déjà de tout (extraction + redirection). Ce fichier reste
// disponible pour d'éventuelles futures logiques cross-onglets sans avoir à retoucher
// la structure de l'extension.

// eslint-disable-next-line no-console
console.log("[Sprint Machine] background chargé.");

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ping") {
    sendResponse({ ok: true, from: "background" });
    return true;
  }
  return false;
});
