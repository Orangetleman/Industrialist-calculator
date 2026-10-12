# Calculateur de production — Industrialist (Roblox)

> **English** — This page brings together all the information about the Roblox game “Industrialist” with the goal of providing a tool for creating automated production lines. Live version: https://industrialist.myprisme.fr (the interface is in French).

Outil web **local** : tu indiques où tu en es dans le jeu, tu dis ce que tu veux obtenir (un objet, de l'énergie, des RP ou de l'argent), et il donne la liste des machines à construire pour toute la chaîne (recettes, énergie, matières premières, surplus), uniquement avec ce que tu as débloqué.

## Installation

Il faut [Node.js](https://nodejs.org/) 22.18 ou plus récent (testé avec Node 24).

```bash
npm install
```

## Lancer

```bash
npm run dev
```

Puis ouvre http://localhost:5173. Tout tourne dans le navigateur, sans serveur : ta progression, « Mon usine » et tes corrections sont gardées dans le stockage local du navigateur.

Les pages (une question, une page, une réponse) :

- **Accueil** : « Que veux-tu faire ? », une carte par objectif.
- **Planifier** : une page par objectif — un objet (X/min ou N machines finales), de l'énergie (X kMF/s ou MMF/s, moyenne ou garantie), des RP (une vitesse, une recherche dans un délai, ce qui manque au plan d'objet), de l'argent ($/min). Une **priorité** (le moins de machines, d'énergie, le moins cher…, expliquée sous le menu) ; options avancées repliées. Le résultat : **la réponse** (une phrase et quatre chiffres), puis trois onglets — **Liste de construction** à cocher, **Schéma** des flux de gauche à droite (glisser, molette, + / − / tout voir), **Détails** (recettes et sources, choix d'une recette à la main, débits ronds, remarques).
- **Mon usine** : recherches débloquées, RP et RP/s, argent, pollution, production déjà en place, machines spéciales, réglages (dépense des RP, passe du jeu), export et import de la partie.
- **Arbre** : l'arbre de recherche comme en jeu (glisser, molette, clic sur une recherche) ou en liste.
- **Données** : valeurs à vérifier (saisie de la valeur relevée en jeu, export des corrections) et éditeur des entrées et sorties des bâtiments.

## En ligne

Le site est hébergé sur le Raspberry Pi : https://industrialist.myprisme.fr (et
http://myprism.local:8090 sur le réseau local). Pour le mettre à jour depuis le PC :

```bash
npm run deploy
```

`npm run deploy:retour` revient à la version précédente. Détails et réinstallation : [HEBERGEMENT.md](HEBERGEMENT.md).

## Tests

```bash
npm test
```

```bash
npm run typecheck
```

Le moteur de calcul (`src/engine/`) est du TypeScript pur, sans dépendance à l'interface ; un test le vérifie. Le choix des recettes passe par un simplexe écrit à la main (`lp.ts`) ; l'ancien choix heuristique (`solve-v1.ts`) sert de repli et de point de comparaison.

## Mettre à jour les données

Les données vivent dans `data/*.json` (aucune recette n'est écrite dans le code). Pour les régénérer depuis les wikis :

```bash
npm run data
```

Ce script enchaîne deux étapes, lançables séparément :

1. `node scripts/fetch-wiki.ts` interroge l'API MediaWiki de [Miraheze](https://industrialist.miraheze.org) (source principale) et de [Fandom](https://industrialist.fandom.com) (contrôle), avec un User-Agent identifié, une pause entre les requêtes et un cache dans `.cache/wiki/`. Seules les pages modifiées sont rechargées (`--force` pour tout recharger, `--only=miraheze` ou `--only=fandom`). Tu peux ajouter un contact au User-Agent avec la variable d'environnement `WIKI_CONTACT`. Si un wiki bloque, le script s'arrête sans rien contourner.
2. `node scripts/build-data.ts` transforme le cache en `data/*.json`, sans accès réseau, et réécrit `data/a-verifier.md` : valeurs manquantes, contradictions entre wikis, écarts avec la référence. La section « Notes manuelles » de ce fichier est conservée.

3. `node scripts/build-extension.ts` produit les données de l'extension : `logistics.json`
   (tuyaux, silos, dépôts), `power.json` (générateurs, poteaux, batteries), `research-stations.json`
   (formules des RP), `world.json` (jour, vapeur, logique) et `ports.json` (ports des bâtiments
   relevés en jeu). Ce qui manque est listé dans la section « Extension » de `a-verifier.md`.

### Relever un bâtiment en jeu

Le wiki ne situe pas les entrées et sorties des machines. La méthode de relevé (fiche et trois
captures) est décrite dans [RELEVES.md](RELEVES.md).

### Corriger une valeur

- Dans l'appli : page **Données**, onglet « Valeurs à vérifier », saisis la valeur relevée en jeu (Recipe Book), puis **Exporter mes corrections**.
- Place le fichier exporté dans `data/overrides.json` : les corrections deviennent permanentes et prioritaires sur le wiki, avec leur source et leur date.

## Organisation

```
data/            données générées + overrides.json + a-verifier.md
scripts/         récupération (fetch-wiki) et construction (build-data) des données
src/engine/      moteur pur : déblocage, choix des recettes, résolution, pollution, économie
src/ui/          interface (TypeScript sans framework)
tests/           intégrité des données, non-régression, fixture de la référence
reference/       calculateur d'origine du Crankshaft (fixture de test, pas une source de données)
```

## Limites connues

- Les recettes à valeur variable (vitesse du Chemical Plant, température de vapeur…) ne sont utilisées que si l'option « recettes à vérifier » est cochée.
- Les sous-produits sont listés comme surplus à évacuer ; ils ne servent pas à couvrir une autre demande.
- Une boucle qui passe par l'item demandé ou par une recette forcée est signalée, mais la quantité qui l'alimente n'est pas comptée.
- Le temps de pousse des arbres vient d'un calculateur communautaire : c'est une moyenne.

## Sources et licence des données

Les données proviennent du wiki Industrialist ([Miraheze](https://industrialist.miraheze.org) et [Fandom](https://industrialist.fandom.com)). Ces contenus sont sous licence CC BY-SA. La pousse des arbres vient du calculateur communautaire lié depuis la page Tree.
