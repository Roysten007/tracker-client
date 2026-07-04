# Sprint Machine — Extension Navigateur

Petite extension qui capture le texte d'un profil LinkedIn ou Facebook
et l'envoie à ton app Sprint Machine pour analyse. Cible principale :
Firefox. Compatible Chrome sans modification.

**Principes non négociables** — aucune automatisation. L'extension lit
uniquement la page que tu regardes, au clic. Aucun envoi de messages,
aucun clic robotisé, aucune navigation automatique, aucun scraping en
arrière-plan.

## Installation — Firefox (développement)

1. Ouvre `about:debugging` dans Firefox.
2. Clique sur **« Ce Firefox »** dans la colonne de gauche.
3. Clique sur **« Charger un module complémentaire temporaire »**.
4. Sélectionne le fichier `extension/manifest.json` de ce dépôt.

L'extension apparaît dans la liste. Une icône **SM** apparaît dans la
barre d'outils.

> ⚠️ Le chargement temporaire disparaît au redémarrage de Firefox. Pour
> une installation permanente : empaqueter en `.xpi` et signer via
> [addons.mozilla.org](https://addons.mozilla.org) (compte gratuit, canal
> « non répertorié » pour rester privée).

## Installation — Chrome (développement)

1. Ouvre `chrome://extensions`.
2. Active **« Mode développeur »** (haut à droite).
3. Clique sur **« Charger l'extension non empaquetée »**.
4. Sélectionne le dossier `extension/` de ce dépôt.

## Utilisation

1. Va sur un profil LinkedIn (`linkedin.com/in/...`) ou Facebook.
2. Clique le bouton flottant **SM** en bas à droite.
3. L'app Sprint Machine s'ouvre dans un nouvel onglet, avec le texte
   du profil pré-rempli dans l'Analyseur, et l'URL du profil en source.

## Options

Clique l'icône SM dans la barre d'outils → **« Modifier l'URL de l'app »**.
Par défaut, l'extension vise `https://sprint-client-tracker.vercel.app`.
Change cette URL si tu utilises un environnement de développement local
(ex. `http://localhost:8080`).

## Comment ça marche techniquement

- **Extraction** : `innerText` du `<main>` de la page, nettoyé (retrait
  des `nav`, `aside`, `footer`, scripts), tronqué à 6 000 caractères.
- **Transmission** : encodée dans le fragment (`#`) de l'URL vers
  `/analyse#texte=...&source=...`. Le fragment n'est **jamais** envoyé
  au serveur — il reste dans le navigateur, ta clé Gemini reste privée.
- **Repli** : si le texte dépasse ~50 000 caractères encodés, il est
  copié dans le presse-papiers et l'app affiche « colle avec Ctrl+V ».

## Structure

```
extension/
├── manifest.json          # MV3 + gecko browser_specific_settings
├── browser-polyfill.js    # micro-polyfill browser.* (compat Chrome)
├── background.js          # event page (Firefox MV3 sans SW)
├── content.js             # bouton SM injecté sur linkedin/facebook
├── content.css            # styles isolés du bouton et de l'overlay
├── options.html + .js     # champ unique : URL de l'app
├── popup.html  + .js      # état + lien direct vers l'app
├── icons/                 # sm-16.png, sm-48.png, sm-128.png (générés)
├── build-icons.mjs        # (dev) régénère les icônes en Node pur
└── README.md
```

## Migration V2 — plus tard

Quand le projet Firebase passera en plan Blaze et disposera des Cloud
Functions, l'extension pourra retrouver son overlay d'analyse direct
dans la page (via un token + un endpoint `extensionIngest`). En V1,
tout se passe dans l'app pour éviter tout appel serveur payant.
