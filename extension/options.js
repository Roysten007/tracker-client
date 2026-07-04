// Options — un seul champ (URL de l'app). Stockée dans browser.storage.local.

const CLE = "appUrl";
const DEFAUT = "https://sprint-client-tracker.vercel.app";

async function charger() {
  const s = await browser.storage.local.get({ [CLE]: DEFAUT });
  document.getElementById(CLE).value = s[CLE] || DEFAUT;
}

async function sauvegarder() {
  const brut = document.getElementById(CLE).value.trim() || DEFAUT;
  // Normalise : retire le / final.
  const url = brut.replace(/\/$/, "");
  await browser.storage.local.set({ [CLE]: url });
  const t = document.getElementById("toast");
  t.classList.add("on");
  setTimeout(() => t.classList.remove("on"), 1600);
}

document.getElementById("save").addEventListener("click", sauvegarder);
document.addEventListener("DOMContentLoaded", charger);
