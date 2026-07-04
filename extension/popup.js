// Popup — statut de configuration + lien vers l'app.

const DEFAUT = "https://sprint-client-tracker.vercel.app";

async function afficherEtat() {
  const s = await browser.storage.local.get({ appUrl: DEFAUT });
  const url = s.appUrl || DEFAUT;
  const configEnCours = url !== DEFAUT;

  const statusEl = document.getElementById("status");
  if (configEnCours) {
    statusEl.textContent = `App : ${url.replace(/^https?:\/\//, "")}`;
  } else {
    statusEl.textContent = "App : URL par défaut (Vercel).";
  }

  document.getElementById("appLink").href = url;
}

document.addEventListener("DOMContentLoaded", afficherEtat);
