# PLAN — Calculateur de production Industrialist

> Statut : **version 2, en attente de validation finale.** Elle intègre tes réponses aux questions Q1 à Q4 (§7). Aucun code n'est écrit.

## 0. Constats préalables (sondage du 2026-10-11)

J'ai interrogé les deux API en lecture seule, avec un User-Agent identifié et une pause de 2 s entre chaque requête.

| Constat | Conséquence |
|---|---|
| La référence `Ligne Vilebrequin.html` est à la racine. Elle n'est pas fiable à 100 % (§0 bis). | À l'étape (a), je la déplace vers `reference/ligne-vilebrequin.html` sans la modifier. Elle sert de **fixture de test du moteur**, pas de source de données. |
| Les deux API `api.php` répondent. Miraheze est actif (modifications en 2026). Fandom semble figé (pages de 2025). | **Miraheze est la source principale** (décision Q2). Fandom sert de contrôle croisé. |
| Miraheze range **les recettes dans des modules Lua**, un par machine (`Module:Recipes/<Machine>`, environ 100 modules) : `id`, `time`, `mamyflux`, `inputs[]`, `outputs[]`. | Je lis le source Lua et je le convertis en JSON, sans scraper le HTML. |
| `Module:RS/Data` décrit **l'arbre de recherche** : 145 nœuds, chacun avec son coût en `RP`, les `Buildings` qu'il débloque, ses `Nodes` enfants et parfois des `reqItems` (4 nœuds, par ex. Advanced Assembler : vendre 20 Crankshaft). | L'arbre complet se génère à partir des données. 23 nœuds ont plusieurs parents (§7, Q4). |
| La **page de chaque machine** contient une infobox `{{Machine2}}` : `Cost` (prix en $), `Size` (ex. `8x8`), `Pollution` (%/h), `PowerInput`, `Tier`, `Research`. | Ces champs donnent les dimensions (départage), les prix et la pollution générée. |
| La page `Tree` donne un **tableau du temps de pousse selon la pollution** : environ 363 s par défaut, 348 s au minimum entre 13 % et 37 %, jusqu'à environ 696 s aux extrêmes. Certaines plages sont des intervalles (« 51–99 % : ~370 à ~689 s »). D'après la page `Pollution`, la pollution influe sur **la pousse des arbres et le revenu**, et sur rien d'autre côté production. | La pollution n'a d'effet calculable que sur les arbres (§3.9). |

## 0 bis. Audit de la référence (2026-10-11)

| Recette (référence) | Référence | Miraheze | Fandom | Verdict |
|---|---|---|---|---|
| Crankshaft · Craft Assembler · 2 Steel Rod + 4 Gear → 1 | **17,2 s**, 3 488 MF/s | 15 s, 4 kMF/s | 17,2 s, 3 488 MF/s | = Fandom, ≠ Miraheze |
| Steel Rod · Roller · 2 Steel Ingot → 2 | 8 s, 6 250 | idem | idem | ✔ |
| Gear · Roller · 2 Steel Plate → 2 | 8 s, **750** MF/s | 8 s, 6 250 | 8 s, 6 250 | ⚠️ 750 ne vient d'aucune source. C'est probablement l'énergie de la recette Iron Coil du Roller. |
| Steel Plate · Press · 1 Steel Ingot → 1 | **5,1 s**, **9 804** MF/s | 4 s, 12,5 kMF/s | 5,1 s, 4 000 MF/s | ⚠️ Mélange des deux sources : 9 804 = 12 500 × 4 / 5,1 |
| Steel Ingot · Blast Furnace · 1,5 Coke + 19,2 Iron Mix → 24 | 5 s, 15 kMF/s | idem | idem | ✔ |
| Iron Mix · Industrial Kiln · 4 Coke + 19,2 Iron Powder → 51,2 | 20 s, 15 kMF/s | idem | — | ✔ |
| Iron Mix · Blast Furnace · 1 Coke + 4,8 Iron Powder → 12,8 | 5 s, 15 kMF/s | idem | idem | ✔ |
| Iron Powder · Grinder · 3,2 Raw Iron → 1,9 | 12 s, 33 kMF/s | idem | idem | ✔ |
| Coke Fuel · Blast Furnace · 4 Coal + 2 Oak Log → 6 | 5 s, 15 kMF/s | idem | idem | ✔ |
| Raw Iron · Iron Drill | 15 s, 1 200 | idem | idem | ✔ |
| Coal · Coal Drill | 4 s, 120 | idem | idem | ✔ |
| Oak Log · arbre → 2 | **345 s** | environ 363 s à 0–5 % de pollution, « au moins 2 » logs | non trouvé | ⚠️ Aucune source pour 345 s |

**Même scénario (15 Craft Assemblers) selon la source :**

| Source | Crankshaft/min | Rod / Gear / Plate | Grinder | Iron Drill | Arbres | Machines | Énergie moy. / pic |
|---|---|---|---|---|---|---|---|
| Référence (fixture) | 52,33 | 7 / 14 / 18 | 10 | 40 | 38 | 111 | 704,8 k / 736,3 k |
| Miraheze (données retenues, arbre à 363 s) | 60,00 | 8 / 16 / 16 | 12 | 46 | 46 | 120 | 896,2 k / 936,4 k |

Les quatre écarts (Crankshaft, Gear, Steel Plate, arbre) figurent dès le départ dans `a-verifier.md`. Ils seront aussi signalés dans l'interface (§4).

## 1. Architecture

```
interface auto-craft/
├─ PLAN.md, README.md
├─ package.json, tsconfig.json, vite.config.ts      (vite, typescript, vitest uniquement)
├─ index.html
├─ reference/ligne-vilebrequin.html                 (déplacé tel quel depuis la racine)
├─ tests/fixtures/reference-crankshaft.json         valeurs de la référence, recopiées telles quelles
├─ data/                                            ← seules données lues par l'appli
│  ├─ items.json  recipes.json  machines.json  research.json
│  ├─ overrides.json      corrections sourcées (relevé en jeu, saisie exportée depuis l'appli), prioritaires
│  └─ a-verifier.md       généré : manques et contradictions (+ section de notes manuelles conservée)
├─ scripts/
│  ├─ fetch-wiki.ts       API MediaWiki → .cache/wiki/*.json (brut, horodaté)
│  ├─ build-data.ts       cache → data/*.json + a-verifier.md (aucun accès réseau)
│  └─ lib/lua-literal.ts  petit parseur de tables Lua littérales (pas de VM Lua)
├─ src/
│  ├─ engine/             ← TS pur : aucun import du DOM ni de src/ui
│  │  ├─ types.ts  data.ts (index, validation, fusion des corrections)
│  │  ├─ unlock.ts (prérequis, fermeture des ancêtres, coûts RP)  choose.ts  solve.ts
│  │  ├─ energy.ts  pollution.ts (pousse des arbres)  economy.ts (coûts $, RP, délais)
│  │  └─ *.test.ts
│  ├─ ui/                 TS + DOM, sans framework
│  │  ├─ main.ts  state.ts (localStorage)  player-panel.ts  progress-tree.ts  target-form.ts
│  │  ├─ render-summary.ts  render-graph.ts  render-plan.ts  render-recipes.ts
│  │  └─ verify-panel.ts  (valeurs « à vérifier » + saisie en place)
│  └─ styles.css          tokens repris de la référence
└─ .cache/ (ignoré par git)
```

Les scripts sont exécutés directement par Node 24, qui supprime nativement les types. Un test garantit que `src/engine/` n'importe ni `src/ui/`, ni `document`, ni `window`.

## 2. Schéma des données

```ts
type Source = { wiki: "miraheze" | "fandom" | "jeu" | "saisie"; url?: string; page?: string;
                revisionId?: number; fetchedAt: string; note?: string };

/** Valeur sourcée. `alternatives` liste les valeurs contradictoires, chacune avec sa source. */
type Sourced<T> = { value: T | null;               // null = manquante
                    source: Source | null;
                    alternatives?: { value: T; source: Source }[] };

type Item = { id: string; name: string; isFluid: boolean; sellValue?: Sourced<number>; sources: Source[] };

type Machine = {
  id: string; name: string;
  kind: "machine" | "farm";                 // farm = arbre (hors total machines, pousse selon la pollution)
  unlockedBy: string | null;                // id du nœud de recherche (null = disponible d'emblée)
  cost: Sourced<number>;                    // prix en $
  size: Sourced<{ w: number; l: number }>;  // en cases ; sert au départage et à la surface au sol
  pollutionPerHour: Sourced<number>;        // %/h générés en fonctionnement
  sources: Source[];
};

type Recipe = {
  id: string; machine: string;
  durationS: Sourced<number>;
  inputs: Record<string, number>; outputs: Record<string, number>;
  energyMFps: Sourced<number>;              // négatif = production d'énergie
  research: string | null;
  sources: Source[];
  verify: VerifyFlag[];                     // vide = recette sûre
};
type VerifyFlag = { field: string; reason: "manquant" | "contradiction" | "non-sourcé" | "approximatif";
                    detail: string };

type ResearchNode = {
  id: string; name: string; category: "Production" | "Energy" | "Utility";
  rp: number; children: string[]; parents: string[];   // parents déduits des children
  requires: "all" | "any";                              // "all" par défaut (Q4)
  unlocksMachines: string[];
  reqItems?: { item: string; amount: number }[];        // « vendre N items », case à cocher séparée
  sources: Source[];
};

// Temps de pousse des arbres selon la pollution (page Tree)
type GrowthBand = { minPct: number; maxPct: number; seconds: [number, number] /* [bas, haut] */; source: Source };
```

**Règles de construction** (`build-data.ts`) :
- **Rien n'est jeté.** Une recette à laquelle il manque une valeur, ou dont la valeur est contestée, est écrite quand même, avec ses drapeaux `verify` et les valeurs alternatives. Elle est aussi listée dans `a-verifier.md`.
- **Priorité** : `overrides.json` > Miraheze > Fandom. La valeur écartée reste dans `alternatives`.
- **Énergie** : `"4kMF"` est converti comme le fait `parseMamyflux` du wiki (MF, kMF, MMF, GMF).
- **Contrôles** : chaque item référencé existe, chaque machine a un nœud, aucune durée n'est ≤ 0, et un rapport liste les alias (`Aluminium`/`Aluminum`).

**Récupération** (`fetch-wiki.ts`) :
- User-Agent identifié et pause d'au moins 1,5 s entre les requêtes.
- Lots de 50 titres, avec respect de `maxlag` et `Retry-After`.
- Cache disque par page, rechargé seulement si le `revid` a changé (`--force` pour tout recharger).
- Si un wiki répond 403, 429 à répétition ou présente un défi anti-bot : arrêt avec un message, sans contournement. Repli : export manuel via `Special:Export`, ou saisie assistée.

## 3. Moteur de calcul (`src/engine/`, pur)

**Entrée** :
- données indexées ;
- état du joueur : `{ unlocked: Set<nodeId>, reqItemsDone: Set<nodeId>, pollutionPct?, money?, rp?, rpPerSec? }` ;
- cible : `{ item, ratePerMin }` ou `{ item, finalMachines }` ;
- critère : `machines | energy | raw` ;
- recettes forcées : `{ itemId: recipeId }` ;
- options : `{ useUnverified: boolean }` (désactivé par défaut) ;
- corrections locales saisies dans l'interface (fusionnées comme un `overrides`).

1. **Disponibilité** : une recette est utilisable si sa machine est débloquée. Le déblocage suit les prérequis, en `requires: all` par défaut.
2. **Valeurs « à vérifier »** :
   - Option **désactivée** : une recette avec un drapeau bloquant (durée manquante ou contestée) n'est pas *choisie* automatiquement, mais elle est *signalée* : « une recette alternative existe, à vérifier ». Une recette sûre dont seule l'énergie est contestée est utilisée avec la valeur principale et marquée ⚠.
   - Option **activée** : les recettes à vérifier participent au choix avec leur valeur principale.
   - Si une valeur manque, le résultat est partiel et le reste explicitement : machines calculées mais énergie « inconnue » (le total devient « ≥ X »). Si c'est la durée qui manque, l'étape affiche « durée à renseigner » au lieu d'un nombre de machines.
   - Une recette forcée à la main est toujours utilisée, même si elle est à vérifier.
   - Le plan renvoie **toutes** les valeurs à vérifier qui touchent la chaîne (`verify[]`), y compris celles des recettes écartées.
3. **Choix de recette** : coût par unité/min selon le critère, par récursion mémoïsée.
   - **Départage en cas d'égalité** : la plus petite **surface au sol** (w × l de la machine × nombre de machines fractionnaires), puis l'autre critère, puis l'id.
   - Si la taille est inconnue, la recette passe après, et le plan le signale.
4. **Résolution** : la demande est agrégée par item avant l'arrondi.
   - Machines = `ceil(demande / débit d'une machine − 1e-9)`.
   - Mode « N machines finales » : débit cible = N × débit d'une machine.
5. **Matières premières** : une recette sans entrée (extracteur ou arbre) marque une matière première. Un item sans recette connue est signalé « source inconnue ».
6. **Sous-produits** : toute sortie non demandée est un **surplus à évacuer**, en /min. Un avertissement apparaît si ce surplus est demandé ailleurs dans la chaîne.
7. **Boucles** : je les détecte par la pile de récursion et je les signale en nommant le cycle (A → B → A). Le calcul continue.
8. **Énergie** : moyenne = Σ machines fractionnaires × MF/s ; pic = Σ machines arrondies × MF/s. La fixture de la référence confirme cette définition.
9. **Pollution** :
   - Le temps de pousse des arbres suit la plage du tableau `Tree` qui correspond à la pollution saisie (363 s si rien n'est saisi).
   - Pour une plage en intervalle (ex. 51–99 % → ~370 à ~689 s), je n'interpole pas sans source. J'utilise la **borne haute** (pessimiste), marquée « approximatif ». Le lien vers le calculateur Desmos du wiki est affiché.
   - À l'étape (a), je regarde si ce calculateur Desmos expose une formule sourçable. Si oui, je te la propose avant de l'utiliser.
   - En bonus, la pollution générée par la chaîne : Σ machines × %/h.
10. **Économie** :
    - Coût de construction = Σ machines × `cost`. Coût en RP des nœuds manquants = somme sur leur fermeture (ancêtres compris), plus les `reqItems` à vendre.
    - Si l'argent, les RP ou les RP/s sont renseignés : « il te manque X $ », « il te manque Y RP, soit environ Z à W RP/s ». Le soft cap n'est pas modélisé : c'est un ordre de grandeur, et le plan le dit.
    - Sinon, j'affiche seulement les prix.
11. **Inatteignable** : pour chaque item bloqué, je liste les nœuds manquants (fermeture des prérequis) et je propose l'option qui coûte le moins de RP. Le résultat a la forme `{ status: "locked", missing, rpCost }` et ne lève pas d'erreur.

**Ajustements décidés pendant l'étape (b)** :
- **Contradictions avec Fandom** : elles ne bloquent pas le choix d'une recette. Miraheze est la source principale (Q2) ; l'alternative reste affichée ⚠. Seules les valeurs `manquant` ou `variable` qui touchent la durée ou les quantités écartent une recette quand l'option est désactivée.
- **Algorithme de choix** : un point fixe de type Bellman-Ford remplace la récursion, qui explosait sur les nombreuses boucles du wiki (eau, vapeur, résidus). Une boucle sans sortie est coupée et signalée.
- **Arbres** : la formule du calculateur Desmos (validée en (a)) est utilisée. Le tableau du wiki, avec sa borne haute, sert de repli.
- **Machines sans nœud** (Limited, variantes) : disponibles seulement si elles sont cochées « possédée ».

**Sortie** : `Plan = { steps[], totals{ machines, farms, energyAvg, energyPeak, energyKnown, footprint, buildCost, pollutionPerHour }, raw[], surplus[], recipesUsed[], verify[], warnings[], locked[], economy? }`. Elle est sérialisable et testable sans DOM.

**Tests Vitest** :
- Jeux factices : arrondi, item partagé, sous-produit, boucle, recette forcée, chaque critère, départage par taille, recette à vérifier avec l'option désactivée puis activée, valeur manquante, item verrouillé, prérequis `all`, fermeture des ancêtres, plages de pollution, calculs d'économie.
- **Non-régression** sur la fixture de la référence : 15 Craft Assemblers → 52,33/min ; 15 / 7 / 14 / 18 / 2 / 2 / 10 / 1 / 40 / 2 / 38 ; 111 machines ; 704,8 k / 736,3 k.
- **Concordance** : chacune des 11 recettes de la référence est identique dans `data/`, ou bien son écart est listé dans `a-verifier.md`.
- Validation des JSON : sources présentes et références cohérentes.

**Programmation linéaire** : pas en V1. Je te ferai une proposition si l'heuristique se montre insuffisante (sous-produits recyclables, boucles utiles).

## 4. Interface (Vite + TS, sans framework)

Une colonne de 760 px max, avec le style de la référence (IBM Plex, acier bleu et accent orange, thème clair et sombre).

1. **Ma partie** (facultatif, repliable) : pollution actuelle (%), argent ($), RP, RP/s. Tous ces champs sont optionnels.
2. **Progression** :
   - Arbre par catégorie (Production / Energy / Utility). Chaque nœud indique son coût en RP et les machines qu'il débloque.
   - Cases séparées pour les conditions « vendre N items ».
   - Si tu coches un nœud dont les prérequis ne sont pas cochés, une proposition apparaît : « Débloquer aussi les N prérequis (total X RP) ? » avec les choix *Oui*, *Seulement celui-ci* et *Annuler*.
   - Le bouton « tout débloquer jusqu'à… » prend un nœud (recherche par nom) et coche ce nœud avec tous ses ancêtres. C'est le « tier N » (Q3).
   - Bouton « réinitialiser ». La sauvegarde se fait dans `localStorage`.
3. **Réglage** : recherche d'item, débit /min ou nombre de machines finales, critère, option « utiliser les recettes à vérifier », et « forcer une recette » sur chaque ligne du plan.
4. **Résumé** : machines, arbres, énergie moyenne et pic, surface au sol, coût en $, pollution générée, matières premières, surplus. Les comparaisons à ta partie s'affichent si tu as renseigné les champs.
5. **Graphe SVG** des flux en /min. Les nœuds qui contiennent une valeur à vérifier portent un badge ⚠.
6. **Plan d'action** numéroté, de l'item final vers la matière première.
7. **À vérifier dans ce plan** : la liste des valeurs douteuses de la chaîne, avec pour chacune la valeur retenue, les alternatives et leurs sources, et un champ pour **saisir la valeur relevée en jeu**.
   - Une saisie recalcule le plan immédiatement. Elle est enregistrée dans `localStorage` comme correction locale (source « saisie », avec la date).
   - Le bouton **« Exporter mes corrections »** produit un `overrides.json` à déposer dans `data/`. Le site n'a pas de backend et ne peut donc pas écrire dans `data/` lui-même. Le README explique la marche à suivre.
   - Un bouton permet d'importer des corrections et de les effacer.
8. **Recettes utilisées** : tableau avec des liens vers les sources.
9. **Avertissements** : surplus, boucles, nœuds manquants, valeurs approximatives.

## 5. Étapes (commit et arrêt à la fin de chacune)

| Étape | Livrables | Validation |
|---|---|---|
| **a** Schémas + données | `git init`, déplacement de la référence, fixture, squelette Vite, types, `lua-literal.ts`, `fetch-wiki.ts`, `build-data.ts` (recettes, arbre, infobox machines, tableau des arbres), `data/*.json`, `a-verifier.md` | Tests du parseur et de validation ; test de concordance |
| **b** Moteur + tests | `src/engine/*` : choix, résolution, à vérifier, départage, pollution, économie, fermeture des prérequis | Tous les cas de la §3, dont la non-régression |
| **c** Interface | Réglage, résumé, graphe, plan, recettes, panneau « à vérifier » avec saisie et export | Tests verts ; vérification visuelle avec `npm run dev` |
| **d** Arbre + progression | Arbre, dialogue des prérequis, « jusqu'à… », panneau « Ma partie », localStorage | Tests du déblocage et de la persistance |
| **e** Finitions | README, accessibilité, affichage mobile, attribution des wikis ; **critère « moins d'étapes »** (demandé après l'étape b) ; **onglets** (Production, Recherche, À vérifier, Ma partie) et **arbre de recherche comme en jeu** (canevas déplaçable/zoomable, fiche de chaque recherche avec la description en jeu des bâtiments débloqués, vue liste en option), demandés au lancement de l'étape e | Tests verts ; parcours complet de bout en bout |

## 6. Risques

- **Données contradictoires ou manquantes** : elles sont signalées dans l'interface et corrigeables en place, puis exportées vers `overrides.json`.
- **Modules Lua non littéraux** (`RS/Data` contient des appels `bucket(...)`) : le parseur extrait seulement la table `p`, et échoue explicitement sur ce qu'il ne comprend pas.
- **Infobox incomplètes** (taille ou prix absents) : drapeau `manquant`. Le départage passe alors à l'autre critère.
- **Champs particuliers** (sorties probabilistes, générateurs à MF négatif, durées variables) : je les recense à l'étape (a). Ce qui ne rentre pas dans le schéma va dans `a-verifier.md`.
- **Sémantique des prérequis** : `all` est une déduction (Q4). Elle est modifiable nœud par nœud via `overrides.json`.
- **Économie approximative** : soft cap des RP non modélisé, revenu modulé par la pollution et la difficulté. L'interface l'indique clairement.
- **Licence CC BY-SA** des wikis : attribution dans le README et en pied de page.

## 7. Décisions (réponses aux questions)

- **Q1** ✔ La référence n'est pas une source de données. Elle sert de fixture de test du moteur. La concordance est reformulée : identique, ou écart documenté.
- **Q2** ✔ **Miraheze** est la source principale et Fandom sert de contrôle. Les valeurs à vérifier sont visibles dans le plan, modifiables en place et exportables. L'option « utiliser les recettes à vérifier » existe. L'état du joueur (pollution, $, RP, RP/s) est facultatif. En cas d'égalité, la machine la plus petite l'emporte.
- **Q3** ✔ « Jusqu'au tier N » signifie « jusqu'au nœud N » : le nœud et tous ses ancêtres. Le même mécanisme sert quand tu coches un nœud dont les prérequis manquent.
- **Q4** ✔ **Tous les parents sont requis (`all`).** Je le déduis de ta capture :
  - Les nœuds dont l'unique parent est débloqué sont blancs (abordables) ou gris clair (trop chers).
  - Les nœuds sans parent débloqué sont gris foncé.
  - **Oil Fracking** a deux parents : Quarry (débloqué) et Industrial Diesel Refining (non débloqué). Il est gris foncé. Si un seul parent suffisait, il serait gris clair.

  Le wiki ne précise pas la règle ; il ne liste que les enfants. Les 23 nœuds à plusieurs parents sont donc en `all`, modifiables un par un.
