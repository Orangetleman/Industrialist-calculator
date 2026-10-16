# Plan d'action — retours du 2026-10-16

Ce fichier pilote les prochaines sessions. **Une session = un lot**, dans l'ordre du § 2. Chaque lot
dit ce qui existe déjà (vérifié dans le code le 2026-10-16), ce qu'il faut faire, les questions à
poser avant de coder et comment savoir que c'est fini.

Point de départ : commit `6c1e7fd` (branche main), 242 tests. Plans précédents : [PLAN.md](PLAN.md)
(étapes a → e), [PLAN-EXTENSION.md](PLAN-EXTENSION.md) (E0 → E6, bilans de E4), [REFONTE.md](REFONTE.md)
(ergonomie).

## 0. Règles de chaque session (contre les hallucinations)

1. **Lire d'abord** ce fichier : § 0, § 5 (décisions) et le lot du jour. Lire ensuite seulement les
   fichiers que cite le lot. Ne pas se fier à la mémoire ni aux résumés : vérifier avec `git log -5`
   et `npm test` que le point de départ est bien celui du dernier bilan (§ 6).
2. **Les questions avant le code.** Poser les questions du lot qui n'ont pas encore de réponse au
   § 5, et noter les réponses au § 5 avant de commencer. Si l'interface change beaucoup, faire
   valider une maquette d'abord.
3. **Aucune valeur de jeu inventée.** Chaque valeur vient du wiki (Miraheze d'abord, Fandom en
   contrôle) ou d'un relevé en jeu de l'utilisateur, avec sa source. Les doutes vont dans
   `data/a-verifier.md`. Une règle de jeu mal comprise se demande, elle ne se suppose pas.
4. **Pas de nouvelle dépendance** sans accord. Sont autorisés : vite, typescript, vitest et
   @types/node.
5. **Ne jamais dégrader un critère déjà validé** (taille des plans, longueur des tuyaux, prix…)
   sans le dire et le proposer en option.
6. **Fin de session**, dans l'ordre :
   - `npm test` ;
   - parcours réel du site dans le navigateur, avec des captures ;
   - résumé court en français ;
   - commit, terminé par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ;
   - `npm run deploy` ;
   - `git push origin HEAD:main` ;
   - lot coché au § 2 et bilan de 3 lignes au § 6 ;
   - mémoire `prochaine-session` mise à jour.

   Puis **attendre le feu vert**.
7. **Contexte.** Si la session approche de sa limite, s'arrêter à un point propre (tests verts,
   commit), puis noter au § 6 où en est le lot et ce qui reste. Ne pas enchaîner un deuxième lot.
8. Tout plan affiché reste présenté comme une **proposition** : une base de départ, à optimiser
   librement.

## 1. Les retours et leur lot

| # | Retour (2026-10-16, résumé) | Ce que j'en comprends | Lot |
| --- | --- | --- | --- |
| R1 | Le glitch des tuyaux ne marche pas en sortie. On peut entrer par n'importe quel port du même type (même un port de sortie), mais une sortie doit partir de la bonne sortie. | Déjà corrigé le 2026-10-14 (commit `6c1e7fd`, `portAssignments`). Il reste un test qui le garantisse et une vérification sur l'usine entière. | S1 |
| R2 | Afficher les tuyaux, d'accord, mais mettre en évidence une option « Afficher les liaisons » qui montre comment les tuyaux sont liés. | Une case bien visible qui dessine les vecteurs de liaison entre pièces (qui est relié à qui, dans quel sens), comme l'onglet 3 en jeu. Dans l'usine et dans un module. | S4 |
| R3 | Au survol, le module s'éclaire avec quelques infos. Il faut pouvoir cliquer pour faire un focus, c'est-à-dire ouvrir l'interface du module, mise à jour dans le plan. | Un clic sur un module de l'usine ouvre sa vue de module, dans la version que l'usine utilise (recalculée, tournée), avec un retour vers l'usine. | S4 |
| R4 | Régler dans le schéma le nombre de machines voulu et voir la production qui en résulte. | On saisit un nombre de machines sur un bloc du schéma. Le calcul donne la production possible, l'étape qui limite et l'utilisation des autres. | S8 |
| R5 | Régler le calcul pour exclure certaines machines, ou pour n'utiliser que celles qu'on sélectionne. | Un filtre de machines dans le calcul, en mode « exclure » ou « seulement ». | S9 |
| R6 | Des ports prennent une case en sortie au lieu de 0, alors qu'ils font partie de la machine. | Les 66 ports de bord relevés ont un plot d'une case qui dépasse du bâtiment (valeur par défaut de l'éditeur), donc le tuyau commence une case trop loin. Il faut passer ce plot à 0. | S1 |
| R7 | Certaines machines ont des interfaces : il faut pouvoir les noter dans l'édition **et les prendre en compte dans les calculs**. | Une étiquette flottante « [E] Interact » qui ouvre un réglage de la machine (fenêtre, levier…). Rien pour le placement : seulement la configuration, et son effet sur le calcul (Q5). | S10 |
| R8 | Machines modulaires, à voir sur le wiki : il faut indiquer les blocs qui entourent chaque bloc. Exemples : Diesel Engine (Tier II), assemblage par contact ; ferme d'arbres (Tier I), assemblage par portées. | Deux familles. Par contact : moteur diesel, turbine modulaire (Tier IV). Par portée : ferme d'arbres. Il faut une recherche sur le wiki, des données, un éditeur, le calcul et le plan de pose. | S11 – S14 |
| R9 | Détailler le calcul dans la présentation du graphe, pour qu'on sache d'où sortent les valeurs. | Pour un bloc ou une flèche du schéma : la recette, les formules et la source de chaque valeur. | S7 |
| R10 | Naviguer dans les crafts comme dans l'onglet « Recipes » du jeu, et corriger ce qui existe ou non. Depuis le graphe : la référence du craft, cliquable. | Une page « Recettes » : liste avec recherche, fiche objet, fiche machine, crafts cliquables. Des corrections : valeurs, craft inexistant, craft manquant. Un lien depuis le schéma. | S5, S6, S7 |
| — | En attente depuis le 2026-10-14 : (1) la sortie du collecteur central d'une double rangée entre deux machines ; (2) « Toute l'usine » dans le site. | Inchangé. | S2, S3, S4 |

## 2. Ordre proposé (à valider : Q10)

| Session | Lot | Taille | Dépend de | État |
| --- | --- | --- | --- | --- |
| S1 | Plots des ports supprimés ; 6 relevés intégrés ; test de la règle des sorties | petite | — | ✅ fait (`d949b25`) |
| S2 | Double rangée : sortie du collecteur central entre deux machines | moyenne | — | ✅ fait (`accb04b`) |
| S3 | Toute l'usine (1/2) : moteur dans `src/engine/build/`, calcul en arrière-plan, première vue | grosse | S2 | à faire |
| S4 | Toute l'usine (2/2) : options, « Afficher les liaisons », survol + clic → panneau du module | moyenne | S3 | à faire |
| S5 | Recettes (1/2) : navigation comme en jeu, en lecture | grosse | — | à faire |
| S6 | Recettes (2/2) : corrections (valeurs, craft inexistant, craft manquant), export | moyenne | S5 | à faire |
| S7 | Schéma : détail du calcul et référence du craft cliquable | moyenne | S5 | à faire |
| S8 | Schéma : nombre de machines réglable → production obtenue | moyenne | — | à faire |
| S9 | Calcul : exclure des machines, ou seulement certaines | petite à moyenne | — | à faire |
| S10 | Interfaces des machines : recherche, relevé, effet sur le calcul | moyenne | recherche | à faire |
| S11 | Modulaires (1/4) : recherche (wiki, Internet), données, méthode de relevé | moyenne, sans interface | — | ✅ fait (voir § 6) |
| S12 | Modulaires (2/4) : éditeur des blocs (voisins par face, portées) | grosse | S11 | à faire |
| S13 | Modulaires (3/4) : calcul (puissance du moteur, bois de la ferme) | grosse | S12 + relevés | à faire |
| S14 | Modulaires (4/4) : plans de pose des ensembles | grosse | S13 | à faire |
| S15 | Revue d'ensemble de l'interface avec l'utilisateur, comme un joueur | moyenne | S1 à S14 | à faire |

Pourquoi cet ordre :
- **S1 d'abord** : les plots changent la géométrie de tous les plans. Mieux vaut le faire avant de
  retoucher les plans (S2 à S4), pour ne pas tout mesurer deux fois.
- **S2 à S4** : c'est le travail en cours (« 1. puis 2. »), et la maquette v8 de l'usine est déjà
  validée en principe.
- **S5 avant S7** : le lien « référence du craft » du schéma a besoin de la page Recettes.
- **S10** ne touche pas au placement (Q5) : elle reste à sa place.
- **Modulaires en dernier** : c'est le lot le plus gros et le moins documenté. La recherche (S11)
  peut être avancée si tu le souhaites.
- **S15 à la fin** : l'utilisateur veut revoir l'interface dans son ensemble, pour qu'elle soit
  logique pour des joueurs (« t'es pas joueur et t'as pas la façon de réfléchir de ceux-ci ») :
  parcours guidés par lui, puis réorganisation. D'ici là, chaque lot garde l'interface simple et
  cohérente avec l'existant.

## 3. Lots en détail

### S1 — Plots des ports supprimés, 6 relevés intégrés, règle des sorties garantie

Retours : R6, R1.

Ce qui existe (vérifié le 2026-10-16) :
- `data/ports.json` : 29 bâtiments et 99 ports. 66 sont sur les bords (les autres sont des prises
  sur le dessus), et ces 66 ont tous `"stub": 1`, c'est-à-dire « nombre de cases dont le plot du
  port dépasse du bâtiment ».
- Éditeur de bâtiments : le champ « Plot (cases hors du bâtiment) » vaut 1 par défaut
  (`src/ui/buildings.ts` ; `src/ui/buildings-model.ts` : `stub: previous?.stub ?? 1`).
- `src/engine/build/geometry.ts`, `place()` : les cases du plot sont ajoutées au bâtiment, et la
  case à toucher se trouve après le plot.
- `src/engine/build/module.ts` : `assumedEntry` crée des ports supposés avec `stub: 1`, et l'écart
  entre machines tient compte des plots (`stubOut`).
- Règle des sorties : `portAssignments` (module.ts) ne redirige plus que les entrées (commit `6c1e7fd`).

À faire :
1. Q1 tranchée : **aucun port ne dépasse, et le plot disparaît complètement** (pas de champ gardé
   pour une exception).
   - Retirer `stub` du type `Port` (`src/engine/extension-types.ts`), de l'éditeur (champ « Plot »,
     chiffre dessiné, `buildings-model.ts`), de `geometry.ts` (la case à toucher est la case
     voisine du bâtiment), de `module.ts` (`assumedEntry`, `stubOut`) et de `module-view.ts` (cases
     `stub` dessinées, styles `.mm rect.stub` et `.bld-stub`).
   - Retirer la clé `stub` des 66 ports de `data/ports.json` ; un relevé importé qui l'a encore
     est accepté et la clé est ignorée.
   - Mettre à jour le `_lisezMoi` de `ports.json` et RELEVES.md.
   - **Intégrer les 6 relevés du 2026-10-15** envoyés par l'utilisateur
     (`C:\Users\chris\Desktop\téléchargement\releves-batiments-2026-10-15.json` : Ingot Molder,
     Plastic Molding Machine, Research Tracking Panel, Steam Cracking Plant, Advanced Assembler,
     Industrial Plastic Molder), dans le style du fichier, en gardant leur `fetchedAt` et sans
     `stub`. Leurs notes (« levier permet de passer de bouteille à caisse ») servent à S10.
2. Tests :
   - mettre à jour `buildings.test.ts` (il attend `stub: 1`) et `build.test.ts` ;
   - ajouter un test : une sortie part toujours d'un port de sortie (ou « les deux »).
3. Mesures :
   - nouvelles mesures (15 Craft Assemblers, chaîne du Crankshaft), notées dans le bilan ;
   - maquette régénérée (`npm run maquette`) et comparée à la v8, d'après
     `maquette/usine-resume.txt` : 87 × 96 cases, 1 246 cases de tuyau, 76 croisements.

Fini quand : dans un plan de pose, le tuyau touche le bâtiment et aucune case de plot n'est
dessinée ; tous les tests passent ; les mesures sont notées.

### S2 — Double rangée : le collecteur central sort entre deux machines

Retour : en attente depuis le 2026-10-14. Dans la maquette, la liaison Steel Ingot → Steel Plate
faisait 40 cases de tuyau pour 2 cases d'écart, parce que le collecteur central ne sort que par
ses bouts.

Ce qui existe :
- module.ts : `designModule` (double rangée dos à dos autour d'un collecteur central).
- Bouts au choix : `ends` (« début », « fin » ou « milieu ») et `trunkExit`.
- `redesign` et `alternatives`.
- La maquette `maquette/usine.gen.test.ts`, avec une prise unique par collecteur.

À faire :
1. Laisser le collecteur central sortir à angle droit par un passage entre deux machines voisines
   d'une rangée. Le passage existe déjà, ou s'ouvre en écartant les machines d'une case.
2. Prendre le passage le plus proche des voisins.
3. Respecter la liste de priorités, la place d'abord : si le passage élargit le module, le
   proposer en option, ne pas l'imposer.

Tests : un module en double rangée qui sort par un passage (aucun chevauchement, chaque port
raccordé) ; dans la maquette, la liaison Steel Ingot → Steel Plate raccourcit sans dégrader les
autres chiffres.

Fini quand : le plan de pose et la maquette montrent le passage ; les chiffres sont comparés à la
v8 dans le bilan.

### S3 — Toute l'usine (1/2) : dans le site, calculée en arrière-plan

Retour : en attente depuis le 2026-10-14 (« intégrer Toute l'usine au site »).

Ce qui existe : le prototype complet `maquette/usine.gen.test.ts` (environ 1 100 lignes, à lire
par morceaux en cherchant les fonctions ; `npm run maquette` dure environ 30 s). Il contient :
- placement : plusieurs essais, passe d'amélioration (surface + 10 × distance), tassement, puis
  rotations des modules (`turnModule`) ;
- mode « recalculé pour l'usine entière » : `redesign` avec des collecteurs « milieu », et choix
  parmi les `alternatives` ;
- routage à prise unique (`routeTaps` et `connect`) ;
- électricité en arbre au moindre coût (`relaysFor`, `typeFor`, `upstream`) et couverture des
  prises orphelines (`cover`).

Les chiffres de référence sont dans `maquette/usine-resume.txt`.

À faire :
1. Extraire l'algorithme en fonctions pures, sans DOM, dans `src/engine/build/factory.ts`. La
   maquette l'appelle ensuite, pour n'avoir qu'une seule source.
2. Calcul en arrière-plan : un Web Worker de Vite (`new Worker(new URL(…), { type: "module" })`,
   sans dépendance), avec progression et annulation. Le résultat est gardé tant que le plan ne
   change pas.
3. Onglet « Plans de pose » :
   - une entrée « Toute l'usine » dans la liste des étapes ;
   - une vue de dessus navigable (glisser, molette), comme pour les modules ;
   - la parcelle du joueur (« tient / ne tient pas ») ;
   - la mention « proposition ».

Tests : non-régression sur la chaîne du Crankshaft (aucun chevauchement, chaque liaison tracée,
chiffres au plus égaux à ceux de la v8) ; temps de calcul mesuré.

Fini quand : sur le site, « Toute l'usine » s'affiche sans bloquer la page, avec les mêmes chiffres
que la maquette.

### S4 — Toute l'usine (2/2) : options, liaisons, focus sur un module

Retours : R2 et R3, plus les options de la maquette.

Ce qui existe :
- Les options de la maquette :
  - calcul « module par module » ou « recalculé pour l'usine entière » ;
  - liaisons « des tuyaux » ou « coller quand c'est possible » ;
  - « Tout afficher » et « Réseau électrique » ;
  - câbles « entre poteaux » ou « et vers chaque machine ».
- Le survol d'un module (surbrillance et infos).
- La vue d'un module : `renderModuleSvg` et `renderModuleInfo` (`src/ui/module-view.ts`).

À faire :
1. Une barre d'options comme dans la maquette, avec un bouton **« Afficher les liaisons »** bien en
   vue (Q2 tranchée) :
   - activé, il dessine **toutes** les liaisons : pour chaque tuyau, le vecteur entre pièces
     voisines et vers les ports (sens du flux), comme l'onglet 3 en jeu ;
   - désactivé, les liaisons d'une ressource s'affichent quand on sélectionne son tuyau ;
   - les **câbles électriques aussi** : les flèches existent déjà avec l'option « et vers chaque
     machine », il faut les généraliser à tous les câbles ;
   - il marche aussi dans la vue d'un module.
2. Un clic sur un module fait le focus (Q3 tranchée) :
   - un **panneau à côté de l'usine** montre la vue du module (la même interface que les plans de
     pose), dans la version de l'usine : recalculée, tournée, avec la prise unique ;
   - un bouton du panneau le met **en plein écran** ;
   - le focus a sa propre adresse (par exemple `#objet/pose/usine/<étape>`), et « ← Retour »
     ramène à l'usine ;
   - la vue normale d'une étape signale qu'une version « dans l'usine » existe, et inversement ;
   - **chaque machine du module est cliquable vers sa fiche** (fiche machine de la page Recettes,
     avec la liste de ses crafts, faite en S5). En attendant S5, le clic mène à l'éditeur de
     bâtiments ; S5 rebranche le lien.

Fini quand : le parcours réel (survol, clic, retour, liaisons visibles) est fait, avec des captures.

### S5 — Recettes (1/2) : naviguer dans les crafts comme en jeu

Retour : R10.

Ce qui existe (données) :
- `data/items.json` : 213 objets avec nom, fluide ou non, `sellValue` (prix de vente),
  `researchValue` (facteur RP) et sources. **Pas de description ni d'image.**
- `data/machines.json` : 264 bâtiments avec nom, description, catégorie, tier, `cost` (prix
  d'achat), taille et recherche qui le débloque. Pas d'image.
- `data/recipes.json` : 447 recettes avec machine, `durationS`, entrées, sorties, `energyMFps` et
  recherche.
- Les corrections se font déjà champ par champ : `data/overrides.json`, `applyOverrides` dans
  `src/engine/data.ts`, onglet « Valeurs à vérifier ». Un objet inconnu y est refusé.

À faire :
1. Une maquette à valider, d'après ta description et tes captures du jeu.

   Ce que montrent les captures du 2026-10-16 (onglet du jeu) :
   - **Liste « Items »** : une recherche (« Search [R] ») en haut, une grille de tuiles carrées
     (image et nom par-dessus), qui défile ; une flèche « < » pour revenir, une croix pour fermer.
   - **Fiche d'un objet** (titre « Recipes ») :
     - un en-tête avec l'image à gauche, puis le nom, le prix en vert et le facteur RP en bleu
       (« 35x RP »), et la description dessous (« No Description. » quand il n'y en a pas) ;
     - un bloc « Sources » puis un bloc « Uses », un craft par ligne ;
     - chaque craft : tuiles des entrées séparées par « + », avec la quantité en haut à droite de
       la tuile (« 2x ») ; une flèche avec la durée au-dessus et les MF/s dessous ; les tuiles des
       sorties (plusieurs sorties aussi séparées par « + ») ; le nom de la machine entre
       parenthèses.
   - **Fiche d'une machine** (Chemical Reactor) : même en-tête, avec le prix d'achat en vert, sans
     ligne RP, et une description sur plusieurs lignes ; un seul bloc « Uses », dont les crafts
     n'affichent pas le nom de la machine.
   - Valeurs visibles, à comparer avec nos données pendant S5 (source : jeu, captures de
     l'utilisateur) : Crankshaft, 754 $ et 35× RP, sans description ; ses deux sources sont
     2 tiges + 4 engrenages → 1 Crankshaft, en 15 s et 4 kMF/s (Craft Assembler) ou en 5 s et
     200 kMF/s (Advanced Assembler) ; Chemical Reactor, 750 000 $.

   Le schéma de principe :

   ```
   Fiche objet
   ┌────────────────────────────────────────┐
   │ [image]  Nom                           │
   │          Prix de vente                 │
   │          Facteur RP                    │
   │ Description                            │
   ├────────────────────────────────────────┤
   │ Sources : les crafts qui donnent l'objet│
   ├────────────────────────────────────────┤
   │ Uses : les crafts qui l'utilisent      │
   └────────────────────────────────────────┘

   Un craft, sur une ligne (chaque objet et la machine sont cliquables) :
   [img] ×q Objet A + [img] ×q Objet B  ──(durée)──▶  [img] ×q Objet C   (Machine)
                                          (MF/s)
   ```

   La fiche machine a la même disposition, avec le prix d'achat au lieu du prix de vente et
   seulement « Uses » : tous les crafts faits dans cette machine.
2. Une page « Recettes » **dans son propre onglet du menu** (Q4 tranchée) :
   - la liste de tous les objets et machines, avec une recherche, et leurs fiches ;
   - chaque objet, chaque quantité et chaque machine sont cliquables ;
   - des adresses `#recettes/objet/<id>` et `#recettes/machine/<id>`, avec le bouton Retour ;
   - les valeurs « à vérifier » et « corrigée » sont signalées ;
   - rebrancher le lien des machines du focus de l'usine (S4) vers la fiche machine.
3. Descriptions des objets : depuis le wiki, avec leur source (scripts `scripts/fetch-wiki.ts` et
   `scripts/build-data.ts`), sinon saisies par le joueur comme les descriptions de recherche.
4. Images (Q6 tranchée) :
   - par défaut, une pastille de couleur avec les initiales ;
   - un outil pour **ajouter ou changer l'image d'un objet** (gardée dans le navigateur, et
     exportable comme les corrections) ;
   - les images du wiki sont en clair : mesurer ce que coûterait de les récupérer (nombre de
     fichiers, poids, licence). Si c'est raisonnable, le proposer à l'utilisateur et **demander
     son accord avant tout téléchargement** ; sinon, le noter pour plus tard.

Fini quand : la tâche chronométrée « trouver ce qu'on fait avec du Steel Plate, puis aller à sa
machine » se fait en quelques clics, avec des captures sur ordinateur et sur téléphone.

### S6 — Recettes (2/2) : corriger ce qui existe ou non

À faire :
1. Depuis une fiche, derrière un bouton **« ✎ Corriger »** (Q4 tranchée), corriger une valeur
   (durée, quantités, MF/s, machine, prix, facteur RP) avec la mécanique existante
   (`setCorrection`).
2. Nouveau :
   - « ce craft n'existe pas en jeu » : il est retiré des calculs, et c'est réversible ;
   - « ajouter un craft manquant » : machine, entrées, sorties, durée et MF/s ;
   - de même pour un objet manquant.

   Le format : de nouvelles sections dans `overrides.json` (par exemple `added` et `removed`),
   validées par `buildGameData`, avec la source « jeu » et la date.
3. Export et import : dans le même `overrides.json` que les corrections actuelles.

Tests : côté données (ajout, retrait, refus d'un craft invalide) et côté interface.

Fini quand : un craft retiré disparaît du calcul, un craft ajouté est proposé, et l'export contient
les deux.

### S7 — Schéma : d'où sortent les valeurs, et lien vers le craft

Retours : R9 et la fin de R10.

Ce qui existe : `renderFlowHud` et `renderEdgeHud` (`src/ui/plan-view.ts`). Chaque étape (`Step`,
`src/engine/solve.ts`) porte déjà :
- `recipeId`, la machine et `durationS` ;
- `outputPerCycle`, `ratePerMachine` et `demandPerMin` ;
- `machinesExact`, `machines` et `utilization` ;
- `inputs`, `consumers` et `byproducts` ;
- `energyMFps` et `verify`.

À faire :
1. Quand un bloc est sélectionné, un panneau « Comment c'est calculé » montre :
   - le craft utilisé, sur sa ligne comme dans Recettes, avec sa référence et un lien
     « Voir dans Recettes ▸ » qui ouvre la fiche sur ce craft ;
   - débit par machine = sortie par cycle × 60 / durée ;
   - demande = somme des consommateurs (+ l'objectif) ;
   - machines = demande / débit par machine (valeur exacte, puis arrondie) ;
   - l'utilisation et l'énergie ;
   - entrées = demande × quantité / sortie ;
   - la source de chaque valeur : wiki, relevé, correction ou à vérifier.
2. Quand une flèche est sélectionnée : qui la produit, qui la consomme, et le calcul de son débit.

Fini quand : on peut refaire à la main chaque nombre du schéma à partir du panneau (vérifié sur
deux étapes de la chaîne du Crankshaft).

### S8 — Schéma : régler le nombre de machines

Retour : R4.

Ce qui existe : `finalMachines` dans `SolveRequest` (nombre de machines de l'étape finale
seulement) et `forced` (recette imposée par objet).

À faire :
1. Moteur : un champ `fixedMachines` (étape → nombre).
   - Les recettes sont fixées à celles du plan. On cherche le débit maximal pour lequel chaque
     étape fixée a assez de machines, par dichotomie sur le débit (méthode robuste même avec la
     production existante).
   - On renvoie le débit obtenu, l'étape qui limite et l'utilisation de chaque étape.
   - Q7 tranchée : les étapes non fixées s'adaptent ; avec plusieurs étapes fixées, la plus
     contraignante décide et les autres montrent leur capacité inutilisée. La production
     existante n'est utilisée en priorité que si son option est activée.
2. Schéma, dans le panneau d'un bloc :
   - « Machines : [−] 15 [+] », réglable à la molette et aux boutons (pas de curseur) ;
   - un bandeau « Production obtenue : … (limitée par …) » ;
   - un bouton « Revenir au calcul ».

Questions : Q7.

Tests :
- une étape fixée → débit proportionnel ;
- deux étapes fixées → la plus contraignante l'emporte ;
- avec de la production existante.

### S9 — Calcul : exclure des machines, ou n'utiliser que certaines

Retour : R5.

Ce qui existe : les recettes sont filtrées selon la progression (recherches débloquées) par
`machineAccess` (`src/engine/unlock.ts`), appelé dans `choose.ts`, `resources.ts` et `solve.ts`.
`forced` impose une recette.

À faire :
1. Ajouter `SolveRequest.machines = { mode: "exclure" | "seulement", ids }`, branché là où
   `machineAccess` filtre déjà : les recettes des machines écartées ne sont plus candidates.
2. Si un objet devient impossible à fabriquer, le dire : « aucune machine permise ne fabrique X ».
3. Q8 tranchée : le réglage se fait **par plan** (page de l'objectif), avec une recherche. En
   mode « seulement », les machines d'extraction (mines, pompes, arbres) sont permises par
   défaut, mais on peut les exclure. Un raccourci « ne plus utiliser cette machine » est ajouté
   dans le panneau d'un bloc du schéma.

Questions : Q8.

### S10 — Interfaces des machines

Retour : R7.

Q5 tranchée, ce que c'est :
- Une interface n'est **ni un objet, ni un port, ni une case** : c'est une étiquette flottante de
  Roblox sur la machine (« [E] Interact ») ; la touche ouvre un réglage de la machine.
- Elle **ne compte pas dans le placement**, seulement dans la configuration de la machine.
- Elle varie beaucoup d'une machine à l'autre. Exemples donnés par l'utilisateur :
  - panneaux, drapeaux, capteur de pollution : une fenêtre « Modify Machine » (capture : champs
    « Minimum value », « Minimum value enable » OFF/ON, « Maximum value »…, boutons Cancel et
    Confirm) ;
  - Plastic Molding Machine et Industrial Plastic Molder : pas de fenêtre, un **levier** qui
    passe de la bouteille à la caisse (notes des relevés du 2026-10-15) ;
  - le « carry » : le choix se fait directement sur la machine, sans bouton.
- Ces exemples ne servent qu'à orienter les recherches : il faut se renseigner sur chaque
  interface (wiki, Internet), et ne rien supposer.

À faire :
1. Recherche : quelles machines ont une interface, ce qu'elle règle, ses valeurs possibles, et
   leur effet sur le calcul (recette ou sortie choisie, seuils, marche/arrêt…). Chaque réponse a sa
   source ; les manques vont dans `a-verifier.md`.
2. Éditeur de bâtiments : noter l'interface d'un bâtiment (type : fenêtre de réglages, levier,
   choix direct ; ses réglages et leurs valeurs).
3. Calcul : tenir compte du réglage. Par exemple, le levier du mouleur choisit la sortie
   (bouteille ou caisse), donc la recette. Le plan dit quel réglage appliquer à chaque machine
   (« levier sur caisse »). Rien ne change dans le placement.

Fini quand : chaque interface relevée apparaît dans l'éditeur, et un plan qui utilise une machine
réglable dit le réglage à faire ; tests sur un cas (le mouleur).

### S11 à S14 — Machines modulaires

Retour : R8.

Ce qui existe : dans `data/machines.json`, catégorie « Modular », les données du wiki (tailles du
wiki, prix, descriptions).

**Moteur diesel modulaire (Tier II).**
- Blocs : Diesel Engine Controller, Crankshaft, Crankshaft Sideways, Cylinder, Air Input, Exhaust,
  Fuel Input, Generator, Flywheel, Info Panel, Decoration. Le Flywheel mesure 6 × 4, les autres
  2 × 2.
- Les descriptions donnent déjà des règles :
  - un seul Controller par moteur ;
  - les vilebrequins se posent devant le Controller ;
  - cylindres, entrées d'air, échappements, entrées de carburant et panneau se posent sur les
    côtés des vilebrequins ;
  - le Generator se place au bout de la chaîne ;
  - les gros moteurs peuvent demander plusieurs entrées.

**Ferme d'arbres modulaire (Tier I).**
- Blocs : Tree (4 × 4), Tree Farm Controller, Tree Farm Output, Tree Farm Sprinkler, Tree Farm
  Water Tank (10 × 4), Farm Harvester (8 × 8).
- Les descriptions donnent déjà des règles :
  - un réservoir pour trois arroseurs ;
  - un seul Controller par ferme (plusieurs à portée la cassent) ;
  - tout doit être à portée : arroseurs → arbres → récolteurs → sortie.

**Turbine modulaire (Tier IV).** La chaîne est : Turbine Input → High Pressure (plusieurs) →
Intermediate (une) → Low Pressure (plusieurs) → Turbine Generator → Turbine Output.

Aujourd'hui, le calcul traite l'arbre comme une « farm » (pousse : `treeGrowth`), sans les blocs
qui l'entourent.

Q9 tranchée : l'ordre est **Tier I (ferme d'arbres), puis Tier II (moteur diesel), puis Tier IV
(turbine)**. Les relevés en jeu sont compliqués : chercher d'abord partout sur Internet (wikis,
guides, vidéos, forums, Discord public…). L'utilisateur précise que **la portée est circulaire**
(un rayon, pas un carré).

Les quatre sessions :
- **S11 — Recherche et données.**
  - Lire les pages du wiki de chaque bloc (Miraheze, Fandom en contrôle) et les guides éventuels,
    puis chercher plus loin sur Internet. Chaque valeur a sa source.
  - Écrire `data/modular.json` : règles de contact par face, portées, nombre de blocs requis et
    effets, chacun avec sa source.
  - Tout manque va dans `a-verifier.md`, avec une méthode de relevé dans RELEVES.md.

  Pas d'interface. Fini quand chaque règle a une source ou une question.
- **S12 — Éditeur.** Dans l'éditeur de bâtiments, pour chaque bloc d'un ensemble : quels blocs
  peuvent ou doivent le toucher sur chaque face. Pour la ferme : la portée de chaque bloc (en
  cases) et ce qu'elle dessert. Maquette d'abord.
- **S13 — Calcul.**
  - La puissance et la consommation du moteur diesel selon sa configuration.
  - Le bois par minute de la ferme selon le nombre d'arbres, d'arroseurs et de récolteurs.
  - L'intégration au solveur (objectifs énergie et objets).

  Seulement avec des valeurs sourcées ; sinon, « à relever ».
- **S14 — Plans de pose.** Assemblage par contact (vilebrequins en chaîne, blocs sur les côtés).
  Pour la ferme, placement par portées, comme la couverture des poteaux.

Questions : Q9.

## 4. Questions

À poser au début du lot concerné ; les réponses vont au § 5.

- **Q1 (S1), plots.**
  - Je passe les 66 ports de bord relevés à 0, pour que le tuyau se colle au bâtiment ?
  Oui
  - Y a-t-il des bâtiments dont le raccord dépasse vraiment ?
  Non

  Défaut proposé : tout à 0 -> oui, le champ reste pour une exception -> non.
- **Q2 (S4), « Afficher les liaisons ».** Un vecteur entre chaque paire de pièces reliées (comme
  l'onglet 3), sur tous les tuyaux, ou seulement sur ceux de la ressource survolée ou
  sélectionnée ? Avec les câbles électriques aussi ?
  Tout afficher avec une bouton pour activer l'affichage, les afficher lors de la séléction du transporteur d'une ressource, avec les câbles électrique aussi(il y a déjà les flèches pour l'option "vers les machines", les rajouter de façon général)
- **Q3 (S4), focus sur un module.** La vue du module en plein écran (comme un plan de pose, avec un
  retour), ou un panneau à côté de l'usine ?
  Un panneau à côté et dans le panneau la possibilité de le mettre en plein écran
- **Q4 (S5), place des Recettes.**
  - Une page à part dans le menu (« Recettes », comme l'onglet du jeu), ou un onglet de
    « Données » à côté de l'éditeur de bâtiments ?
    mets ça dans son propre onglet, t'façon on pourra revoir l'interface plus tard car il y a pas que ça à voir mais l'ensemble de façon général. Il faut que l'interface soit logique pour des joueurs, sauf que t'es pas joueur et t'as pas la façon de réfléchir de ceux-ci donc forcément tu sors un résultat en fonction de ce que tu connais.
  - Les corrections : toujours visibles, ou derrière un bouton « ✎ Corriger » ?
  J'ai pas compris, je te dirais derrière un bouton « ✎ Corriger » 
- **Q5 (S10), interfaces.**
  - Qu'est-ce que c'est en jeu : un écran ou un panneau sur lequel on clique, une prise logique
    ou de données, autre chose ?
    Sur roblox on a la possibilité d'afficher des sorte d'étiquette avec lesquels on peut intéragir, ça ne se manifeste pas concrètement par un objet, un port, ou je ne sais quoi mais plutôt comme j'ai dis par une étiquette flotante sur la machine qui nous propose en cliquant sur une touche d'ouvrir une interface, et c'est sur ces interfaces qu'il faut que tu te renseigne.
  - Sur quelles machines ?
  Il y en a pleins, les panneaux, les drapeau, le capteur de polution, le modeleur de plastique(qui ouvre pas une interface mais toggle une levier), et je ne sais encore combien (il y a aussi le carry, mais elle c'est directement sur la machine qu'on peut séléctionner et pas par un bouton qui nous amène à une interface). Donc comme tu le vois ça varis beaucoup en fonction des usages
  - Que faut-il garder : la case devant libre, ou un passage pour le joueur jusqu'au bord ?
  Rien, ça ne rentre que dans la config de la machine, pas dans son placement

  Une capture aiderait.
- **Q6 (S5), images des objets.** Nos données n'en ont aucune. Trois choix :
  - (a) pas d'image pour l'instant : une pastille de couleur avec les initiales ;
  Oui, après jsp si tu peux les scraps sur le wiki car elles y sont en claire. C'est sans doute un gros taff de scrap donc t'embête pas si c'est trop lourd pour le moment, mais tu peux rajouter un outil/option pour rajouter/modifier l'image d'un objet
  - (b) les icônes du wiki, ce qui demande de vérifier la licence et d'avoir ton accord pour les
    récupérer ;
    Oui voilà ce que j'ai dis plus haut
  - (c) tes captures.
  trop lourd à mon avis mais faudra voir du coup

  Défaut : (a).
- **Q7 (S8), nombre de machines.** Quand tu fixes une étape, les autres s'adaptent (recalculées).
  Si tu en fixes plusieurs, la plus contraignante décide et les autres montrent leur capacité
  inutilisée. Est-ce que ça te va ? - > Oui. La production existante reste-t-elle utilisée en priorité ? -> Si l'option est activée pour la prendre en compte oui
- **Q8 (S9), filtre de machines.**
  - Réglage par plan (page de l'objectif) ou pour toute ta partie (« Mon usine ») ?
  Par plan
  - En mode « seulement », les machines d'extraction (mines, pompes, arbres) restent-elles
    permises d'office ?
    Oui par defaut, mais laisser la possibilité de les exclure
- **Q9 (S11), machines modulaires.**
  - Par quoi commencer : moteur diesel (Tier II), ferme d'arbres (Tier I) ou turbine modulaire
    (Tier IV) ?
    T I, T II, T IV
  - Pour les valeurs absentes du wiki (portées, puissance par cylindre…), es-tu d'accord pour des
    relevés en jeu ?
    C'est compliqué, d'ailleurs la portée est circulaire. Essaie de te renseigner où tu peux sur internet pour avoir des infos
- **Q10, ordre.** L'ordre du § 2 te convient-il ?
  Oui vas-y, propose moi le lancement des différentes sessions et comporte toi comme gestionnaire des sessions

## 5. Décisions

Les réponses détaillées de l'utilisateur sont aussi au § 4, sous chaque question.

| Question | Réponse | Date |
| --- | --- | --- |
| Q1 Plots | Aucun port ne dépasse : le plot est supprimé partout (champ retiré, pas d'exception). | 2026-10-16 |
| Q2 Liaisons | Un bouton affiche toutes les liaisons ; sinon, celles d'une ressource quand on sélectionne son tuyau ; câbles électriques aussi, flèches généralisées. | 2026-10-16 |
| Q3 Focus | Un panneau à côté de l'usine, qu'on peut mettre en plein écran ; les machines du module sont cliquables vers leur fiche. | 2026-10-16 |
| Q4 Recettes | Dans leur propre onglet du menu ; corrections derrière « ✎ Corriger ». L'interface d'ensemble sera revue plus tard (S15). | 2026-10-16 |
| Q5 Interfaces | Étiquette flottante « [E] Interact » qui ouvre un réglage (fenêtre, levier, choix direct) ; rien pour le placement, seulement la configuration ; se renseigner sur chaque interface. | 2026-10-16 |
| Q6 Images | Pastille par défaut ; outil pour ajouter ou changer l'image d'un objet ; récupérer celles du wiki si ce n'est pas trop lourd (accord avant tout téléchargement). | 2026-10-16 |
| Q7 Machines | D'accord ; production existante utilisée seulement si son option est activée. | 2026-10-16 |
| Q8 Filtre | Par plan ; en mode « seulement », extraction permise par défaut mais excluable. | 2026-10-16 |
| Q9 Modulaires | Ordre Tier I, Tier II, Tier IV ; chercher partout sur Internet ; la portée est circulaire. | 2026-10-16 |
| Q10 Ordre | Oui ; je joue le rôle de gestionnaire des sessions (§ 7). | 2026-10-16 |

## 6. Journal des sessions

- **2026-10-16** : plan écrit (ce fichier), aucune modification du code. Point de départ : commit
  `6c1e7fd`, 242 tests. Réponses Q1 à Q10 reçues et reportées dans les lots ; S1 lancée.
- **2026-10-16, S1** (`d949b25`, 243 tests, déployé) : plot supprimé, le tuyau touche le bâtiment ; 6 relevés intégrés (35 bâtiments, 124 ports) ; test « une sortie part d'un port de sortie ».
  Mesures : 15 Craft Assemblers 66 × 15 → 66 × 13 ; maquette recalculée v8 87 × 96 → 81 × 101, tuyaux 1 246 → 1 123, croisements 76 → 75, électricité 5 085 → 3 595 $.
  À surveiller : « module par module » 87 × 96 → 82 × 104 (+2 %), croisements 69 → 74, surtout le vrai relevé de l'Ingot Molder (plot seul : 82 × 101, 71) ; `redesign` « milieu » plante sur un module replié (limite déjà là).
- **2026-10-16, S11** (250 tests, non déployé : le site ne change pas) : `data/modular.json` (ferme d'arbres, moteur diesel, turbine ; chaque valeur sourcée Miraheze/Fandom, datée) et son test de forme ; 16 questions MOD-01 à MOD-16 dans `a-verifier.md` ; méthode de relevé dans RELEVES.md.
  Trouvé : règles de portée et de contact, comptes de blocs, consommations (200 kMF par arbre, 3 arroseurs par réservoir, 44 à 46 arbres par arroseur), tableaux du moteur (6 cylindres, 32 cylindres) et des turbines (sob_ad). Hors des deux wikis, rien de chiffré sur Internet.
  Manque pour S12-S13 : aucun rayon de portée écrit (arroseur déduit des images : 12 à 14 cases), critère de portée, rythme réel du récolteur, formule du moteur diesel, ports des blocs.
- **2026-10-16, S2** (`accb04b`, fusionné avec S11 en `9be3f00`, 252 tests, déployé) : `passages` dans module.ts (colonne libre entre deux machines, sinon machines écartées d'une case ; le tuyau traverse la file de poteaux) et `passageOptions` ; dans le plan de pose, choix « Sortie d'un collecteur central » (par les bouts par défaut ; les passages qui élargissent le module à part, en option).
  Mesures, maquette recalculée : 81 × 101 inchangé, tuyaux 1 123 → 1 115, croisements 75 → 74, électricité 3 595 $ inchangée ; Steel Ingot → Steel Plate 43 → 11 cases ajoutées (passages Steel Ingot et Iron Ingot vers le haut, entre les hauts-fourneaux 1 et 2). Les passages sont essayés à placement égal et gardés seulement s'ils raccourcissent sans ajouter de croisement (seul, le meilleur faisait −40 cases mais +1 croisement ; en le laissant entrer dans le recuit : 83 × 104, rejeté). Aucun passage élargissant ne tient à sa place dans la maquette.
  À surveiller : pas de passage pour les modules repliés (tuyaux principaux) ni pour les collecteurs parallèles ; dans le site, le choix du passage n'est pas encore guidé par les voisins (ce sera S3) ; « module par module » inchangé (82 × 104, 74 croisements).

## 7. Gestion des sessions

La session de départ (celle qui a écrit ce plan) joue le **gestionnaire** : elle lance chaque
session de lot avec une suggestion de tâche (une puce à cliquer), une à la fois, dans l'ordre du
§ 2. Une session de lot ne lance pas la suivante : elle se termine par son bilan et attend le feu
vert de l'utilisateur. L'utilisateur revient alors voir le gestionnaire, qui relit le § 6, vérifie
le dernier commit sur `origin/main` et propose la session suivante.

Chaque session de lot :
- part d'une copie à jour : `origin/main` contient ce plan et le travail des lots précédents
  (la branche `main` locale peut être en retard) ;
- suit le § 0, du début à la fin ;
- met à jour le § 2 (état), le § 6 (bilan) et la mémoire `prochaine-session`.
