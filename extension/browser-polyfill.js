// Mini-polyfill maison browser.* pour compat Chrome triviale.
// Firefox expose déjà `browser` en promise-native ; Chrome n'expose que `chrome.*`
// avec des callbacks. On préfère `browser` s'il existe, sinon on wrap `chrome.*`.
//
// On ne dépend pas de webextension-polyfill (npm) pour rester zéro-dépendance —
// les APIs utilisées ici sont un tout petit sous-ensemble : storage.local, tabs.create,
// permissions.contains/request.
//
// Ce fichier est chargé en tout premier par les autres scripts (via <script> ou
// tableau dans manifest → mais MV3 content_scripts n'accepte que du JS pur, donc on
// importe manuellement en tête de chaque script).

(function () {
  if (typeof globalThis.browser !== "undefined" && globalThis.browser?.storage) {
    // Firefox — rien à faire.
    return;
  }
  if (typeof chrome === "undefined") return; // ni Firefox, ni Chrome — impossible en pratique.

  const promisify = (fn, ctx) => (...args) =>
    new Promise((resolve, reject) => {
      try {
        fn.call(ctx, ...args, (result) => {
          const err = chrome.runtime.lastError;
          if (err) reject(err);
          else resolve(result);
        });
      } catch (e) {
        reject(e);
      }
    });

  globalThis.browser = {
    storage: {
      local: {
        get: promisify(chrome.storage.local.get, chrome.storage.local),
        set: promisify(chrome.storage.local.set, chrome.storage.local),
        remove: promisify(chrome.storage.local.remove, chrome.storage.local),
      },
    },
    tabs: {
      create: promisify(chrome.tabs.create, chrome.tabs),
    },
    permissions: {
      contains: promisify(chrome.permissions.contains, chrome.permissions),
      request: promisify(chrome.permissions.request, chrome.permissions),
    },
    runtime: chrome.runtime,
  };
})();
