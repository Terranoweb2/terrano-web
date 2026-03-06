# TerranoWeb

**Navigateur web desktop moderne, rapide et securise.**

TerranoWeb est un navigateur web de bureau construit avec Electron et React, concu pour offrir une experience de navigation fluide, respectueuse de la vie privee et hautement personnalisable sur Windows.

---

## Table des matieres

- [Apercu](#apercu)
- [Fonctionnalites](#fonctionnalites)
- [Captures d'ecran](#captures-decran)
- [Prerequis](#prerequis)
- [Installation](#installation)
- [Commandes](#commandes)
- [Architecture du projet](#architecture-du-projet)
- [Securite](#securite)
- [Raccourcis clavier](#raccourcis-clavier)
- [Stack technique](#stack-technique)
- [Licence](#licence)

---

## Apercu

TerranoWeb V1 est un navigateur multi-onglets complet qui combine la puissance d'Electron 40 avec la reactivite de React 19. Il propose une navigation par onglets avec isolation des processus, un historique persistant avec recherche plein texte, une gestion des favoris en arborescence, ainsi qu'un systeme de permissions granulaire pour les sites web. Le tout est enveloppe dans une interface moderne au theme accent vert emeraude.

---

## Fonctionnalites

### Navigation

- **Multi-onglets avec isolation WebContentsView** -- chaque onglet dispose de son propre processus de rendu isole pour garantir stabilite et securite.
- **Onglets prives** -- sessions ephemeres sans persistance d'historique, de cookies ni de cache. Les donnees sont integralement supprimees a la fermeture de l'onglet.
- **Omnibox** -- barre d'adresse unifiee permettant a la fois la saisie d'URL directe et la recherche via le moteur configure.
- **Navigation standard** -- boutons precedent, suivant, recharger et arreter.

### Donnees utilisateur

- **Historique persistant** -- stocke dans une base SQLite avec indexation plein texte FTS5 pour une recherche instantanee parmi les pages visitees.
- **Favoris** -- systeme de marque-pages organise en arborescence de dossiers pour un classement hierarchique.
- **Telechargements** -- gestionnaire integre avec barre de progression en temps reel et suivi de l'etat de chaque fichier.

### Personnalisation

- **Parametres complets** -- theme d'interface (sombre, clair ou automatique selon le systeme), moteur de recherche par defaut, URL de demarrage et dossier de telechargement.
- **Page nouvel onglet** -- page d'accueil personnalisee affichee a l'ouverture de chaque nouvel onglet.
- **Theme accent vert emeraude** -- identite visuelle distinctive avec une palette emeraude coherente dans toute l'interface.

### Securite et permissions

- **Permissions par site** -- gestion fine des autorisations camera, microphone, geolocalisation et notifications pour chaque domaine.
- **Pages d'erreur reseau** -- pages d'erreur internes claires et informatives en cas de probleme de connexion.
- **Raccourcis clavier standards** -- ensemble complet de raccourcis pour une navigation efficace au clavier.

---

## Captures d'ecran

*A venir.*

---

## Prerequis

| Outil     | Version minimale |
| --------- | ---------------- |
| Node.js   | >= 18            |
| pnpm      | >= 8             |
| Windows   | 10 ou 11         |

---

## Installation

```bash
# Cloner le depot
git clone <url-du-depot>
cd terrano-web

# Installer les dependances
pnpm install
```

> **Note :** Le script `postinstall` execute automatiquement `electron-rebuild` pour compiler le module natif `better-sqlite3` compatible avec la version d'Electron utilisee.

---

## Commandes

| Commande           | Description                                               |
| ------------------ | --------------------------------------------------------- |
| `pnpm install`     | Installe les dependances et recompile les modules natifs  |
| `pnpm dev`         | Lance le navigateur en mode developpement avec HMR        |
| `pnpm build`       | Compile le projet (main, preload, renderer)               |
| `pnpm package`     | Compile puis genere l'installateur Windows via electron-builder |
| `pnpm test`        | Execute les tests unitaires avec Vitest                   |
| `pnpm typecheck`   | Verifie le typage TypeScript (node + web)                 |

---

## Architecture du projet

```
terrano-web/
├── src/
│   ├── main/               # Processus principal Electron
│   │   ├── index.ts         #   Point d'entree principal
│   │   ├── window/          #   Gestion de la fenetre BrowserWindow
│   │   ├── tabs/            #   Gestion des onglets (WebContentsView)
│   │   ├── navigation/      #   Logique de navigation (back, forward, reload)
│   │   ├── ipc/             #   Gestionnaires de canaux IPC
│   │   ├── storage/         #   Couche de persistance SQLite (historique, favoris)
│   │   ├── downloads/       #   Gestionnaire de telechargements
│   │   ├── settings/        #   Lecture/ecriture des parametres utilisateur
│   │   ├── security/        #   Politiques de securite et permissions
│   │   └── menu/            #   Menu applicatif
│   │
│   ├── preload/             # Scripts preload (pont entre main et renderer)
│   │   ├── ui-preload.ts    #   Preload pour le shell UI (expose les API IPC)
│   │   └── tab-preload.ts   #   Preload minimal pour les onglets web (aucune exposition IPC)
│   │
│   ├── renderer/            # Interface utilisateur React
│   │   ├── index.html       #   Point d'entree HTML
│   │   └── src/             #   Composants React, stores Zustand, styles
│   │
│   └── shared/              # Code partage entre processus
│       ├── types/           #   Definitions de types TypeScript
│       ├── constants.ts     #   Constantes globales
│       ├── ipc-channels.ts  #   Noms des canaux IPC (source unique de verite)
│       ├── validators.ts    #   Fonctions de validation partagees
│       └── __tests__/       #   Tests unitaires du code partage
│
├── resources/               # Pages internes servies par le navigateur
│   ├── newtab.html          #   Page nouvel onglet
│   └── error.html           #   Page d'erreur reseau
│
├── electron.vite.config.ts  # Configuration electron-vite (main, preload, renderer)
├── electron-builder.yml     # Configuration de l'empaquetage Windows
├── tsconfig.json            # Configuration TypeScript racine
├── tsconfig.node.json       # Configuration TS pour le processus principal
├── tsconfig.web.json        # Configuration TS pour le renderer
├── vitest.config.ts         # Configuration des tests
├── package.json             # Dependances et scripts
└── pnpm-lock.yaml           # Fichier de verrouillage pnpm
```

### Flux de communication

```
┌─────────────────────┐       IPC (contextBridge)       ┌──────────────────────┐
│   Processus Main    │ <=============================> │   Renderer (React)   │
│   (Electron/Node)   │        ui-preload.ts            │   (Zustand + UI)     │
└────────┬────────────┘                                 └──────────────────────┘
         │
         │  WebContentsView (isole)
         │
┌────────▼────────────┐
│   Onglet Web        │
│   tab-preload.ts    │  <-- preload minimal, aucune API IPC exposee
│   (contenu web)     │
└─────────────────────┘
```

Le processus principal (`main`) orchestre la fenetre, les onglets et la persistance. Le renderer React communique avec le main via les canaux IPC definis dans `src/shared/ipc-channels.ts`, exposes de maniere securisee par `ui-preload.ts` a travers `contextBridge`. Les onglets web utilisent un preload distinct (`tab-preload.ts`) qui n'expose volontairement aucune API IPC afin de minimiser la surface d'attaque.

---

## Securite

TerranoWeb applique une politique de securite stricte a plusieurs niveaux :

### Isolation des processus

| Parametre            | Valeur   | Description                                          |
| -------------------- | -------- | ---------------------------------------------------- |
| `contextIsolation`   | `true`   | Le contexte JavaScript du preload est isole du rendu |
| `nodeIntegration`    | `false`  | Aucun acces aux API Node.js depuis le renderer       |
| `sandbox`            | `true`   | Bac a sable actif pour le contenu web                |

### Preload minimal pour les onglets

Le script `tab-preload.ts` n'expose aucune API IPC au contenu web. Seul le shell UI dispose d'un pont `contextBridge` controle pour communiquer avec le processus principal.

### Content Security Policy (CSP)

Le shell UI applique une CSP stricte qui restreint les sources de scripts, de styles et de connexions autorisees.

### Filtrage de protocoles

Les protocoles dangereux sont bloques avant toute navigation :

- `javascript:`
- `vbscript:`
- `data:text/html`

### Permissions sensibles

Les API sensibles (camera, microphone, geolocalisation, notifications) declenchent une invite de permission utilisateur avant d'etre accordees a un site. Les choix sont enregistres par domaine.

### Gardes de navigation

Des verifications supplementaires sont effectuees lors de chaque tentative de navigation pour empecher les redirections vers des protocoles ou des schemas non autorises.

---

## Raccourcis clavier

| Raccourci              | Action                     |
| ---------------------- | -------------------------- |
| `Ctrl+T`               | Nouvel onglet              |
| `Ctrl+W`               | Fermer l'onglet actif      |
| `Ctrl+L`               | Focus sur la barre d'adresse |
| `Ctrl+R` / `F5`        | Recharger la page          |
| `Ctrl+Shift+R`         | Rechargement force (sans cache) |
| `Ctrl+Shift+N`         | Ouvrir un onglet prive     |
| `Alt+Gauche`           | Page precedente            |
| `Alt+Droite`           | Page suivante              |
| `Ctrl+Tab`             | Onglet suivant             |
| `Ctrl+Shift+Tab`       | Onglet precedent           |
| `Ctrl++`               | Zoom avant                 |
| `Ctrl+-`               | Zoom arriere               |
| `Ctrl+0`               | Reinitialiser le zoom      |
| `F12`                  | DevTools de la page web    |
| `Ctrl+Shift+I`         | DevTools de l'interface UI |
| `Ctrl+Q`               | Quitter le navigateur      |

---

## Stack technique

| Composant        | Technologie                  | Role                                        |
| ---------------- | ---------------------------- | ------------------------------------------- |
| Runtime          | Electron 40                  | Environnement desktop multi-processus       |
| Interface        | React 19                     | Rendu de l'interface utilisateur             |
| Langage          | TypeScript 5.8               | Typage statique sur l'ensemble du projet     |
| Etat             | Zustand 5                    | Gestion d'etat legere pour le renderer       |
| Base de donnees  | better-sqlite3               | Persistance locale (historique, favoris, parametres) |
| Icones           | Lucide React                 | Bibliotheque d'icones SVG                   |
| Build            | electron-vite 5              | Compilation et HMR pour Electron            |
| Empaquetage      | electron-builder 26          | Generation de l'installateur Windows         |
| Tests            | Vitest 3                     | Framework de tests unitaires                |
| Gestionnaire     | pnpm                         | Gestionnaire de paquets rapide et efficace   |

---

## Licence

Ce projet est distribue sous licence **MIT**. Consultez le fichier [LICENSE](./LICENSE) pour plus de details.
