# Calculateur de production — Industrialist (Roblox)

Outil web **local** : tu coches ta progression dans l'arbre de recherche, tu choisis un item et un débit, et il donne toute la chaîne de production (recettes, nombre de machines, énergie, matières premières, surplus), uniquement avec ce que tu as débloqué.

## Installation

Il faut [Node.js](https://nodejs.org/) 22.18 ou plus récent (testé avec Node 24).

```bash
npm install
```

## Lancer

```bash
npm run dev
```

Puis ouvre http://localhost:5173. Tout tourne dans le navigateur, sans serveur : ta progression, « Ma partie » et tes corrections sont gardées dans le stockage local du navigateur.

Les onglets :

- **Production** : réglage (item, débit /min ou nombre de machines finales, critère), résumé, graphe des flux, plan d'action, recettes et sources, avertissements.
- **Recherche** : l'arbre comme en jeu (glisser, molette, clic sur une recherche pour voir ce qu'elle débloque) ou en liste ; « tout débloquer jusqu'à… » ; machines spéciales possédées.
- **À vérifier** : les valeurs douteuses de la chaîne affichée ; tu peux saisir la valeur relevée en jeu, puis exporter tes corrections.
- **Ma partie** (facultatif) : pollution, argent, RP, RP/s.

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

Le moteur de calcul (`src/engine/`) est du TypeScript pur, sans dépendance à l'interface ; un test le vérifie.

## Mettre à jour les données

Les données vivent dans `data/*.json` (aucune recette n'est écrite dans le code). Pour les régénérer depuis les wikis :

```bash
npm run data
```

Ce script enchaîne deux étapes, lançables séparément :

1. `node scripts/fetch-wiki.ts` interroge l'API MediaWiki de [Miraheze](https://industrialist.miraheze.org) (source principale) et de [Fandom](https://industrialist.fandom.com) (contrôle), avec un User-Agent identifié, une pause entre les requêtes et un cache dans `.cache/wiki/`. Seules les pages modifiées sont rechargées (`--force` pour tout recharger, `--only=miraheze` ou `--only=fandom`). Tu peux ajouter un contact au User-Agent avec la variable d'environnement `WIKI_CONTACT`. Si un wiki bloque, le script s'arrête sans rien contourner.
2. `node scripts/build-data.ts` transforme le cache en `data/*.json`, sans accès réseau, et réécrit `data/a-verifier.md` : valeurs manquantes, contradictions entre wikis, écarts avec la référence. La section « Notes manuelles » de ce fichier est conservée.

### Corriger une valeur

- Dans l'appli : onglet **À vérifier**, saisis la valeur relevée en jeu (Recipe Book), puis **Exporter mes corrections**.
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
