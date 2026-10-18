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
| R11 | (2026-10-18) Une option pour passer le site en anglais, et un site parfaitement accessible et ergonomique (« un peu barbare » aujourd'hui), pour le montrer au serveur Discord de la communauté sans avoir honte d'un résultat brouillon, incomplet ou plein d'erreurs. | Deux chantiers liés : la traduction (tout le texte, les nombres, les dates) et une remise à niveau de la forme (clarté, cohérence, finition, accessibilité au sens large). Le lot écrit le plan, il ne l'exécute pas. | S16 |
| R12 | (2026-10-18, premier jet) Construire sa propre chaîne de production pour en voir les statistiques : un plan vierge, des menus « burger » pour ouvrir une liste de machines, des liaisons qu'on trace en maintenant le clic et en glissant avec l'outil tuyau (du bon type, fluide ou objet), comme les convoyeurs de Mindustry. | Un mode « bac à sable », l'inverse du calculateur : on pose, le site calcule. Très gros : le lot écrit le plan et la maquette, il ne l'exécute pas. | S17 |
| — | En attente depuis le 2026-10-14 : (1) la sortie du collecteur central d'une double rangée entre deux machines ; (2) « Toute l'usine » dans le site. | Inchangé. | S2, S3, S4 |

## 2. Ordre proposé (à valider : Q10)

| Session | Lot | Taille | Dépend de | État |
| --- | --- | --- | --- | --- |
| S1 | Plots des ports supprimés ; 6 relevés intégrés ; test de la règle des sorties | petite | — | ✅ fait (`d949b25`) |
| S2 | Double rangée : sortie du collecteur central entre deux machines | moyenne | — | ✅ fait (`accb04b`) |
| S3 | Toute l'usine (1/2) : moteur dans `src/engine/build/`, calcul en arrière-plan, première vue | grosse | S2 | ✅ fait (`1919f4e`) |
| S4 | Toute l'usine (2/2) : options, « Afficher les liaisons », survol + clic → panneau du module | moyenne | S3 | ✅ fait (`6502c62`) |
| S5 | Recettes (1/2) : navigation comme en jeu, en lecture | grosse | — | ✅ fait (`731c9e0`) |
| S6 | Recettes (2/2) : corrections (valeurs, craft inexistant, craft manquant), export | moyenne | S5 | ✅ fait (`17a59bd`) |
| S7 | Schéma : détail du calcul et référence du craft cliquable | moyenne | S5 | ✅ fait (`1a7200b`) |
| S8 | Schéma : nombre de machines réglable → production obtenue | moyenne | — | ✅ fait (voir § 6) |
| S9 | Calcul : exclure des machines, ou seulement certaines | petite à moyenne | — | ✅ fait (voir § 6) |
| S10 | Interfaces des machines : recherche, relevé, effet sur le calcul | moyenne | recherche | ✅ fait (voir § 6) |
| S11 | Modulaires (1/4) : recherche (wiki, Internet), données, méthode de relevé | moyenne, sans interface | — | ✅ fait (voir § 6) |
| S12 | Modulaires (2/4) : éditeur des blocs (voisins par face, portées) | grosse | S11 | ✅ fait (voir § 6) |
| S13 | Modulaires (3/4) : calcul (puissance du moteur, bois de la ferme) | grosse | S12 + relevés | ✅ fait (voir § 6) |
| S14 | Modulaires (4/4) : plans de pose des ensembles | grosse | S13 | ✅ fait (voir § 6) |
| S18 | Moteur diesel : relevés de configuration, consommation selon le carburant, réglages du contrôleur | moyenne | S14 | à faire |
| S19 | Éditeur de bâtiments simplifié : ports dans la grille, une case par face, moins de bruit | moyenne | S14, maquette | à faire |
| S15 | Revue d'ensemble de l'interface avec l'utilisateur, comme un joueur | moyenne | S1 à S14, S18, S19 | à faire |
| S16 | Plan (sans code) : site en anglais et remise à niveau de l'ergonomie, pour la communauté | moyenne, sans code | S15 | à faire |
| S17 | Plan (sans code) : construire sa propre chaîne (bac à sable) et voir ses statistiques | moyenne, sans code | S16 | à faire |

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
- **S16 après S15** : la revue de S15 donne la liste des défauts vus par un joueur ; S16 en fait un
  plan complet (anglais + forme) pour une version présentable au Discord. Ce plan donnera ses
  propres lots, à insérer ensuite au § 2.
- **S17 en dernier** : c'est une nouvelle fonction, pas une correction. Elle réutilise beaucoup de
  choses (moteur de calcul, plans de pose, tuyaux, éditeur de bâtiments). Mieux vaut la penser sur
  un site déjà propre et traduit, pour ne pas tout traduire deux fois.

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

### S18 — Moteur diesel : configurations relevées et carburant

Demandé pendant S14 (Q15). Le calcul ne connaît que les 8 configurations relevées (tableau du
contrôleur à 6 cylindres, 32 cylindres) ; il n'existe pas de formule (MOD-12).
- Dans l'éditeur, un relevé de configuration : cylindres, rapport air/carburant, accélérateur,
  carburant → puissance et consommation lues sur l'Info Panel ; gardé et exporté comme les autres.
- Le calcul choisit parmi les configurations relevées, selon le besoin et le carburant (le carburant
  change la consommation, pas la puissance) ; les réglages du contrôleur s'affichent dans le plan.
- Les blocs suivent ce dont l'ensemble dispose (plan de pose S14).
- Une formule déduite seulement à la demande, quand les relevés suffisent, affichée « déduite ».

Maquette d'abord.

### S19 — Éditeur de bâtiments simplifié

Demandé pendant S14 (Q15) : relever les ports directement dans la grille, avec une case sur chaque
face pour ce qu'elle accueille (blocs modulaires), et retirer les informations qui ne servent pas au
joueur. Maquette d'abord.

### S16 — Plan : le site en anglais, et une forme présentable à la communauté

Retour : R11. **Ce lot écrit un plan, il ne code rien** (une maquette si elle aide à décider).

Le but : pouvoir donner le lien au serveur Discord du jeu sans avoir honte. Le site doit être
clair pour un joueur qui ne connaît pas le projet, complet, et sans erreur visible.

Ce qui existe :
- Tout le texte est en français, écrit en dur dans `src/ui/*.ts` et `index.html`, sans couche de
  traduction.
- Les noms des objets et des machines sont déjà en anglais (ceux du jeu).
- La revue S15 aura listé les défauts vus par un joueur.
- REFONTE.md contient l'ancienne refonte de l'ergonomie.

Le lot doit produire un fichier `PLAN-PUBLIC.md` (nom à confirmer) avec :
- **Un état des lieux.** Faire le tour du site page par page, avec des captures, comme un nouveau
  venu. Noter le jargon, les doublons, les textes trop longs, les pages vides ou cassées, les
  incohérences de vocabulaire et de mise en page, le comportement au téléphone, et les erreurs
  visibles (valeurs « à vérifier » mises en avant, messages techniques).
- **La traduction.**
  - Méthode : un catalogue de textes par langue, sans nouvelle dépendance sauf accord.
  - Choix de la langue : bouton, langue du navigateur, mémoire du choix.
  - Nombres, dates et unités (MF/s, $, cases).
  - Textes venus des données (notes, détails « à vérifier », descriptions).
  - Adresses (`#objet`, `#recettes`…) : traduites ou non.
  - Ce qui reste en français, et un test qui vérifie qu'aucun texte n'est oublié.
- **L'accessibilité au sens large.** D'abord l'ergonomie : parcours d'un joueur, termes du jeu,
  valeurs par défaut, aides, messages d'erreur. Ensuite : clavier, lecteurs d'écran, contrastes,
  tailles de cible, téléphone. Chaque point a un critère de réussite vérifiable.
- **Ce qu'on montre ou cache dans la version publique** : outils de relevé, éditeur de bâtiments,
  « Données », valeurs incertaines (signalées sobrement).
- **Le découpage en lots** : des sessions courtes, dans l'ordre, chacune avec ses critères de fin,
  à ajouter au § 2 après validation.

Questions : Q13.

### S17 — Plan : construire sa propre chaîne de production (bac à sable)

Retour : R12 (premier jet de l'utilisateur, « encore incomplet »). **Ce lot écrit un plan et une
maquette, il ne code pas la fonction.**

L'idée est l'inverse du calculateur. On part d'un plan vierge, on pose des machines et des tuyaux,
et le site donne les statistiques de ce qu'on a construit : débits, goulots, énergie, prix, place
au sol, pollution.

Ce que l'utilisateur a décrit :
- un plan vierge ;
- des menus « burger » qui ouvrent la liste des machines ;
- des liaisons tracées à la main : on garde le clic enfoncé et on glisse avec l'outil tuyau, du bon
  type (fluide ou objet), pour étendre le chemin, comme les convoyeurs de **Mindustry**.

Ce qui existe et peut servir :
- le moteur de calcul (recettes, débits, énergie) ;
- les plans de pose et le routage des tuyaux (`src/engine/build/`) ;
- les ports relevés (`data/ports.json`) et l'éditeur de bâtiments ;
- le dessin de l'usine (vue navigable) ;
- les recettes et les interfaces des machines (S10).

Le lot doit produire `PLAN-BAC-A-SABLE.md` (nom à confirmer) et une maquette cliquable
(`maquette/bac-a-sable.html`) avec :
- **Une étude du modèle Mindustry**, sur sources publiques (wiki, vidéos) : pose au glisser, sens
  automatique, coudes, croisements, rotation, suppression, annulation. Ce qu'on garde, et ce qui ne
  s'applique pas aux tuyaux d'Industrialist (types, raccords, longueur, règle des ports de sortie).
- **Les gestes** : poser, tourner, déplacer, copier, effacer une machine ; tracer, prolonger, couper
  un tuyau ; zoomer, se déplacer ; sur ordinateur et sur téléphone.
- **Le calcul d'un montage libre** :
  - la recette choisie par machine, avec son réglage d'interface ;
  - le débit réel de chaque tuyau ;
  - la machine qui limite, ce qui manque ou déborde ;
  - les entrées et sorties du montage ;
  - l'énergie, le prix, la place au sol ;
  - le comportement face à une liaison fausse (mauvais type, port de sortie, boucle).
- **Les ponts avec l'existant** : partir d'un plan calculé pour le modifier à la main ; enregistrer,
  exporter, partager un montage ; le comparer au plan conseillé.
- **Le découpage en lots**, du plus petit montage utile (deux machines et un tuyau, avec leurs
  statistiques) jusqu'à l'ensemble, chaque lot avec ses critères de fin.
- **Les risques** : performance, téléphone, quantité de code, ports manquants pour certaines
  machines.

Questions : Q14.

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
- **Q11 (S12), éditeur des blocs modulaires.** Maquette `maquette/modulaires.html`.
  - La section « Ensemble modulaire » (chaîne, faces, portée dessinée) convient-elle ?
  - « Obligatoire » par face : ma lecture des wikis (tableau 2 bis de la maquette) est-elle juste ?
    Le premier vilebrequin d'une 2ᵉ ligne n'a rien derrière lui : « derrière obligatoire » pour la
    1ʳᵉ ligne seulement ?
  - Corrections derrière « ✎ Corriger », enregistrées dans le navigateur et exportées avec les
    relevés (clé `modular`), comme l'interface en S10 ?
  - Un champ « Devant, sur la grille du relevé » (inconnu par défaut), pour les plans de pose (S14) ?

  Réponses : maquette validée ; « les flywheel se placent comme les crankshaft mais sans caractère
  obligatoire » ; corrections comme S10 ; champ « Devant » dès S12.
- **Q12 (S13), calcul des modulaires.**
  - Ferme : l'étape Oak Log devient une ferme : arbres ; 1 arroseur pour 44 arbres ; 1 réservoir
    pour 3 arroseurs ; 1 récolteur pour 22 arbres (guide Miraheze, en attendant MOD-09) ; 1
    contrôleur ; 1 sortie. Elle consomme de l'eau (33 L toutes les 33,33 s par arroseur) et de
    l'électricité (200 kMF par arbre coupé). Tout plan avec du bois change (pompes et énergie en
    plus). D'accord ?
  - Taille d'une ferme : 1 contrôleur et 1 sortie par ferme, une seule ferme quel que soit le
    nombre d'arbres, jusqu'au plan de pose (S14) ? (La portée du contrôleur touche au plus 776
    emplacements d'arbres, sans compter la place des autres blocs.)
  - Moteur diesel, sans formule (MOD-12) : seules les configurations relevées entrent dans le
    calcul. 6 cylindres, rapport 10 à 16 (tableau du contrôleur), avec les blocs du montage simple,
    accélérateur supposé à 100 % (la ligne 16 = montage simple à 100 %). 32 cylindres, rapport 14,
    accélérateur 59 % : 3 MMF/s, mais blocs autres que cylindres « à relever » (MOD-14). Refined
    Diesel seulement ; pollution inconnue (MOD-15). Le 32 cylindres dans le calcul avec sa liste
    incomplète, ou seulement affiché ?
  - Turbine : hors du calcul (chaleur de la centrale non modélisée), marquée « non fiable » dans
    l'éditeur et dans la liste des centrales non calculées ?
  - Maquette (texte) : une section « Calcul » sous « Ensemble modulaire » dans l'éditeur de
    bâtiments, et un bloc « Ferme d'arbres » dans le schéma.

  Réponse : « Oui à tout » (22 arbres par récolteur, une seule ferme jusqu'à S14, 32 cylindres
  dans le calcul avec sa liste incomplète, turbine hors du calcul et non fiable, maquette validée).
- **Q13 (S16), version publique.** À poser au début de S16.
  - Anglais seulement en plus du français, ou d'autres langues plus tard (le catalogue les prévoit) ?
  - Langue par défaut : celle du navigateur ?
  - Que cacher aux visiteurs du Discord (éditeur de bâtiments, relevés, « Données ») ?
  - Une adresse ou une page d'accueil à part pour eux ?
  - Qui relit l'anglais : toi, un membre du Discord ?
  - Des sites que tu trouves bien faits (outils du jeu ou d'autres jeux) à prendre comme référence ?
- **Q14 (S17), bac à sable.** À poser au début de S17.
  - Ce qui compte le plus : les statistiques, ou un plan de pose fidèle au jeu (cases, raccords) ?
  - Grille du jeu (cases et tuyaux réels) ou schéma libre ?
  - Les machines gardent-elles leur taille et leurs ports relevés ?
  - Faut-il pouvoir partir d'un plan calculé ?
  - Partager un montage : par un lien, par un fichier ?
  - « Burger » : un bouton qui ouvre un panneau latéral de machines, ou un menu au clic droit ?
  - De Mindustry, imiter le tracé seulement, ou aussi l'aspect ?
- **Q15 (S14), plans de pose des modulaires.** Maquette `maquette/modulaires-pose.html` (dessins
  calculés avec les règles de `modular.json`).
  1. Moteur, montage simple : le wiki compte 8 vilebrequins mais 9 blocs de côté (carburant,
     6 cylindres, air, échappement). Sur l'image MDESetup, la rangée de côté dépasse d'un bloc :
     (a) l'entrée de carburant contre le côté du contrôleur, ou (b) l'échappement contre le côté du
     générateur ? (MOD-11)
  2. Un bloc de côté (2 × 2) par côté de vilebrequin, donc deux au plus par vilebrequin ?
  3. 32 cylindres : 18 vilebrequins, cylindres des deux côtés, une entrée d'air, un échappement,
     une entrée de carburant et un générateur en pointillés « à relever » (MOD-14) ; les
     vilebrequins « déduits du plan » entrent dans la liste et le prix. Ou tout d'un côté
     (35 vilebrequins) ?
  4. Ferme : carrés de 7 × 7 emplacements autour de chaque arroseur, récolteurs dans les trous des
     coins, contrôleur au plus près du centre, sorties et réservoirs là où les portées les touchent.
     Une ferme tient au plus 586 arbres ; au-delà, plusieurs fermes écartées (le cercle d'un
     contrôleur ne touche aucun bloc de l'autre). D'accord ?
  5. Calcul : les blocs de la ferme suivent le plan (nombre de fermes donc de contrôleurs,
     récolteurs et sorties placés) dans la liste de construction, le prix et « Comment c'est
     calculé » ? Arroseurs et réservoirs restent au plus juste.
  6. « Toute l'usine » : la place réservée (12 × 12 cases) prend la taille réelle de la ferme et des
     moteurs, et un clic ouvre leur plan dans le panneau ? Les mesures de référence changent pour les
     plans avec du bois (Crankshaft : environ 61 arbres).
  7. As-tu relevé le bord « devant » des blocs du moteur (MOD-17) ou ses ports (MOD-10) ? Sinon le
     plan dit « à relever ».

  Réponses (2026-10-18) : 1 (a), « mais j'espérais un calculateur qui prend les stats de chaque
  bout du module pour faire la config la plus optimisée », et les moteurs de la maquette étaient
  trop serrés pour mettre des cylindres des deux côtés ; 2 oui ; 3 des deux côtés ; 4 oui ; 5 « pas
  exactement » : la sortie est coincée entre plusieurs structures, il lui faut un passage pour
  évacuer les Oak Logs par tuyau, et il faut prendre en compte la portée des poteaux électriques
  jusqu'au contrôleur, donc la place des poteaux si ceux à grande portée ne sont pas débloqués ;
  6 oui ; 7 pas compris, et la configuration du moteur devrait se calculer selon le besoin et le
  carburant ; 8 l'éditeur devrait relever les ports directement dans la grille, avec une case sur
  chaque face pour ce qu'elle accueille ; trop d'informations inutiles ; le champ « Devant » ne sert
  à rien. Avec un export de relevés à intégrer.

  Suite (2026-10-18) : l'entrée de carburant peut aller n'importe où ; la Logic Item Pipe Valve a
  des ports objet (erreur de relevé) ; l'entrée d'air n'a aucun port (le port relevé était celui de
  la Diesel Engine Fuel Input, en fluide). Moteur : « base-toi sur les stats du tableau » ; le
  carburant change la consommation, pas la puissance ; tout se règle dans le panneau du contrôleur,
  selon les blocs de l'ensemble. Oui au choix parmi les configurations relevées, oui au relevé de
  configuration dans l'éditeur, d'accord pour une formule plus tard (à la demande). La longueur
  (nombre de vilebrequins) ne change pas la puissance. Ferme : compris juste ; les poteaux HV ne
  s'utilisent pas directement (il faut un transformateur).
- **Q16 (S18), moteur diesel.** Maquette `maquette/moteur-diesel.html`.
  1. Autres carburants (Crude, Poor Quality, Diesel) : aucune consommation écrite nulle part. Une
     configuration n'est proposée avec un carburant que si elle a été relevée avec lui. Ou bien un
     seul relevé (même moteur, autre carburant) donne un rapport appliqué à toutes les
     configurations, marqué « déduit » ?
  2. L'Info Panel : sa consommation est-elle la vraie (le Fandom dit de la multiplier par le
     rapport air/carburant) ? Le relevé note ce que l'écran affiche ; dis-moi si c'est à corriger.
  3. Le tableau du wiki à 6 cylindres : on garde « accélérateur supposé 100 % » ?
  4. Choix du calcul parmi les configurations : par défaut le moins de carburant par MF (le
     32 cylindres gagne : 0,031 L par MMF contre 0,064 au mieux pour 6 cylindres), avec « le moins
     cher », « le moins de place » ou une configuration imposée au choix, par plan ?
  5. Le relevé compte aussi les blocs (entrées d'air, échappements, entrées de carburant,
     générateurs, volants) : le plan de pose et le prix prennent ces nombres (MOD-14) ?
  6. Maquette : relevé et tableau des configurations dans l'éditeur (Diesel Engine Controller),
     choix et « ⚙ Panneau du contrôleur : rapport … accélérateur … » dans le schéma, la liste, le
     plan de pose et « Comment c'est calculé ». D'accord ?
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
| S4 Panneau | Le panneau du module s'ouvre à droite de l'usine (sous l'usine sur un écran étroit), avec ← Retour, ⛶ Plein écran et ✕ ; adresse `#objet/pose/usine-entiere/<étape>`. | 2026-10-16 |
| S4 Câbles | « Afficher les liaisons » éteint : les câbles entre poteaux gardent leur flèche (comme avant) ; le bouton ajoute les flèches de tous les tuyaux, des câbles d'un même module et des câbles vers chaque machine. | 2026-10-16 |
| S4 Calcul | « Recalculé pour l'usine entière » reste le calcul par défaut ; « module par module » au choix, calculé à la demande. | 2026-10-16 |
| S4 Machines | Demande en cours de lot : dans la vue complète, une liste repliable des machines incomplètes dans le plan de pose (comme « Liaisons » et « Passages »). | 2026-10-16 |
| S5 Maquette | Tuiles comme en jeu **et** un affichage en lignes triable (nom, valeur, RP rapportés) ; l'objet ouvert doit rester visible dans la liste ; un ⚠ doit mener directement à la zone de correction, pas seulement signaler le doute. | 2026-10-17 |
| S5 Images | Oui aux vignettes du wiki : 312 vignettes de 96 px (Miraheze, CC BY-NC-SA 4.0, source citée), 4,7 Mo ; la pastille reste quand une image manque. | 2026-10-17 |
| S6 Maquette | Validée (`maquette/recettes-corriger.html`) : « ✎ Corriger » met la fiche en mode correction (valeurs modifiables sur place, ✎ Modifier et ✕ N'existe pas en jeu sur chaque craft, + Ajouter un craft manquant, objet manquant). | 2026-10-17 |
| S6 ⚠ | Sur la page Recettes, un ⚠ ouvre le mode Corriger sur la valeur, le doute affiché à côté ; notes et valeurs des wikis restent dans Données (lien). | 2026-10-17 |
| S6 Retrait | Un craft « n'existe pas en jeu » reste sur la fiche, barré, avec ↺ Rétablir ; il ne compte plus dans les calculs. | 2026-10-17 |
| S6 Remplacer | Entrée manquante ou en trop : « Remplacer par un craft corrigé » retire l'ancien et ouvre l'ajout pré-rempli. | 2026-10-17 |
| S7 Maquette | Validée (`maquette/schema-calcul.html`) : panneau « Comment c'est calculé » sous la barre du bas du schéma ; ligne du craft et « Voir dans Recettes ▸ » ; tableau intitulé / calcul / résultat / source ; flèche : besoin de l'arrivée × part du départ ; une phrase pour chaque cas particulier. | 2026-10-17 |
| S8 Portée | Des machines fixées dans le schéma changent tout le plan (liste de construction, plans de pose, détails, usine entière), pas seulement le schéma. | 2026-10-17 |
| S8 Mémoire | Le réglage est gardé au rechargement ; changer d'objet ou d'objectif l'annule. | 2026-10-17 |
| S8 Blocs | Réglables : machines et arbres. Non réglables : installations composées, production déjà en place, objectif recherche. | 2026-10-17 |
| S9 Maquette | Validée (`maquette/filtre-machines.html`) : ligne « Machines » repliée sous « Priorités » (Toutes / Toutes sauf… / Seulement…), recherche, machines du plan en raccourcis ; message « Aucune machine permise ne fabrique X » avec « Permettre … » ; « Ne plus utiliser … » dans la barre du bas du schéma. | 2026-10-17 |
| S9 Mémoire | Un filtre par plan : chaque objet (et les objectifs énergie et argent) garde le sien. | 2026-10-17 |
| S9 Portée | Les générateurs suivent le filtre ; les dépôts de vente restent toujours permis. L'extraction = catégorie « Extractors » du wiki et les arbres. Pas de filtre pour l'objectif RP. | 2026-10-17 |
| S9 Seulement | Passer en « Seulement… » part des machines du plan affiché. | 2026-10-17 |
| S10 Chemical Plant | Écran intégré au calcul dès S10, réglable par plan : on saisit les trois multiplicateurs que l'écran affiche (Power Input, Resource Input, Resource Output), 1× par défaut. | 2026-10-17 |
| S10 Carry | Le « carry » est la Quarry : matériau choisi sur l'écran à l'avant, à la pose, définitif (comme le wiki). | 2026-10-17 |
| S10 Levier | Le levier des mouleurs passe de « bottle » à « container » (texte du jeu, relevé de l'utilisateur). | 2026-10-17 |
| S10 Mouleur ind. | Industrial Plastic Molder : position « container » = Plastic Casing, ou Hardened Plastic Casing avec des Hardened Plastic Pellets. | 2026-10-17 |
| S12 Maquette | Validée (`maquette/modulaires.html`) : section « Ensemble modulaire » dans l'éditeur de bâtiments (chaîne, faces avec « obligatoire » et blocs qui peuvent toucher, portée dessinée sur une grille d'arbres) ; repère ⬡ dans la liste. | 2026-10-18 |
| S12 Obligatoire | Lecture des wikis retenue (tableau 2 bis) ; le volant (Flywheel) se place comme un vilebrequin, dans la chaîne, sans face obligatoire ; « derrière obligatoire » du vilebrequin reste à confirmer pour une 2ᵉ ligne (MOD-11). | 2026-10-18 |
| S12 Corrections | Derrière « ✎ Corriger », gardées dans le navigateur, exportées avec les relevés (clé `modular`), comme l'interface en S10. | 2026-10-18 |
| S12 Devant | Champ « Devant, sur la grille du relevé » dès S12, inconnu par défaut (MOD-17), pour les plans de pose (S14). | 2026-10-18 |
| S13 Ferme | L'étape Oak Log est une ferme : arbres, 1 arroseur / 44 arbres, 1 réservoir / 3 arroseurs, 1 récolteur / 22 arbres (guide, en attendant MOD-09), 1 contrôleur, 1 sortie ; eau (33 L / 33,33 s par arroseur) et électricité (200 kMF par arbre coupé) comptées. Une seule ferme jusqu'à S14. | 2026-10-18 |
| S13 Moteur | Seules les configurations relevées entrent dans le calcul : 6 cylindres rapport 10 à 16 (blocs du montage simple, accélérateur supposé 100 %) et 32 cylindres rapport 14 à 59 %, avec sa liste de blocs incomplète (« à relever », MOD-14). Refined Diesel seulement. | 2026-10-18 |
| S13 Turbine | Hors du calcul, marquée « non fiable » (éditeur, centrales non calculées). Maquette texte validée : section « Calcul » sous « Ensemble modulaire », bloc « Ferme d'arbres » dans le schéma. | 2026-10-18 |
| S14 Moteur | Montage simple : l'entrée de carburant contre le côté du contrôleur (réponse (a)) ; le contrôleur porte aussi des blocs de côté (relevé du 2026-10-18). Un bloc par côté de vilebrequin, des deux côtés ; 32 cylindres des deux côtés. Moteurs voisins écartés pour garder leurs deux côtés libres. | 2026-10-18 |
| S14 Devant | Le champ « Devant, sur la grille du relevé » est retiré : le sens d'un bloc ne pose jamais problème (MOD-17 close ; l'entrée d'air se pose des deux côtés d'un vilebrequin). | 2026-10-18 |
| S14 Ferme | Disposition de la maquette validée (carrés de 7 × 7, récolteurs dans les trous, plusieurs fermes écartées au-delà de la limite). « Toute l'usine » : place réelle de la ferme et des moteurs, clic → leur plan. À ajouter : un passage pour le tuyau de chaque sortie, et la place des poteaux qui alimentent le contrôleur selon les poteaux débloqués. | 2026-10-18 |
| S14 Longueur | La longueur du moteur ne change pas la puissance : le plan prend le moins de vilebrequins possible (blocs de côté des deux côtés, contrôleur compris), et le calcul compte les blocs du plan (6 cylindres : 4 vilebrequins au lieu de 8). | 2026-10-18 |
| S14 Poteaux | Le contrôleur est alimenté par une chaîne de poteaux placés dans la ferme (place réservée), du bord jusqu'à sa prise ; choix du poteau dans le plan (le moins cher qui porte la ferme par défaut). Le poteau HV n'est pas proposé (il faut un transformateur). Chaque sortie et chaque réservoir garde un passage libre jusqu'au bord pour son tuyau. | 2026-10-18 |
| S14 Lots | Le choix de configuration du moteur (relevés de configuration, consommation selon le carburant, panneau du contrôleur selon les blocs) devient le lot S18 ; l'éditeur simplifié (ports dans la grille, une case par face) le lot S19. Une formule du moteur sera cherchée à la demande, quand les relevés suffiront. | 2026-10-18 |
| S14 Relevés | Export du 2026-10-18 intégré à `data/ports.json` : 46 bâtiments ajoutés (pièces de tuyau, vannes, Plastic Refinery, Plastic Production Facility, Large Diesel Engine, Industrial Firebox, Cold Bypass Pipe, entrée d'air et contrôleur du moteur), Steam Cracking Plant remplacée (relevé plus récent), « sans prise » confirmé pour le Truck Depot, le petit silo et l'arroseur. | 2026-10-18 |
| S10 Maquette | Validée (`maquette/interfaces.html`) : section « Interface » dans l'éditeur de bâtiments ; ⚙ réglage à faire dans la liste de construction, la barre du bas du schéma, « Comment c'est calculé » et le plan de pose ; Quarry « définitif » ; écran de la Chemical Plant dans la barre du bas, par plan, avec « ↺ 1× ». Les crafts de la Chemical Plant ne sont plus « à vérifier » (valeurs du wiki à 1×, seul l'écran varie). | 2026-10-17 |

## 6. Journal des sessions

- **2026-10-16** : plan écrit (ce fichier), aucune modification du code. Point de départ : commit
  `6c1e7fd`, 242 tests. Réponses Q1 à Q10 reçues et reportées dans les lots ; S1 lancée.
- **2026-10-16, S1** (`d949b25`, 243 tests, déployé) : plot supprimé, le tuyau touche le bâtiment ; 6 relevés intégrés (35 bâtiments, 124 ports) ; test « une sortie part d'un port de sortie ».
  Mesures : 15 Craft Assemblers 66 × 15 → 66 × 13 ; maquette recalculée v8 87 × 96 → 81 × 101, tuyaux 1 246 → 1 123, croisements 76 → 75, électricité 5 085 → 3 595 $.
  À surveiller : « module par module » 87 × 96 → 82 × 104 (+2 %), croisements 69 → 74, surtout le vrai relevé de l'Ingot Molder (plot seul : 82 × 101, 71) ; `redesign` « milieu » plante sur un module replié (limite déjà là).
- **2026-10-16, S11** (250 tests, non déployé : le site ne change pas) : `data/modular.json` (ferme d'arbres, moteur diesel, turbine ; chaque valeur sourcée Miraheze/Fandom, datée) et son test de forme ; 16 questions MOD-01 à MOD-16 dans `a-verifier.md` ; méthode de relevé dans RELEVES.md.
  Trouvé : règles de portée et de contact, comptes de blocs, consommations (200 kMF par arbre, 3 arroseurs par réservoir, 44 à 46 arbres par arroseur), tableaux du moteur (6 cylindres, 32 cylindres) et des turbines (sob_ad). Hors des deux wikis, rien de chiffré sur Internet.
  Manque pour S12-S13 : aucun rayon de portée écrit (arroseur déduit des images : 12 à 14 cases), critère de portée, rythme réel du récolteur, formule du moteur diesel, ports des blocs.
- **2026-10-16, S11 (suite)** (253 tests, déployé) : réponses MOD reportées dans `modular.json` — portées depuis le bord du bloc, en cases : contrôleur 58, arroseur 10, récolteur 23 (arbres et sortie), réservoir infini ; le cercle doit toucher le bloc ; arrosage Miraheze ; chaque réservoir alimenté en eau ; moteurs collables.
  10 relevés intégrés (46 bâtiments : chimie, Quarry, ferme d'arbres ; Farm Harvester ni port ni prise). Éditeur : case « Sans port » (`noPorts`). Turbine : deux montages du guide de la Coal Power Plant ; ses chiffres seront signalés « non fiables » sur le site (S13).
  Restent : prise de l'arroseur, nombre maximal d'arbres par récolteur, tout le moteur diesel (MOD-11, 12, 14, 15).
- **2026-10-16, S2** (`accb04b`, fusionné avec S11 en `9be3f00`, 252 tests, déployé) : `passages` dans module.ts (colonne libre entre deux machines, sinon machines écartées d'une case ; le tuyau traverse la file de poteaux) et `passageOptions` ; dans le plan de pose, choix « Sortie d'un collecteur central » (par les bouts par défaut ; les passages qui élargissent le module à part, en option).
  Mesures, maquette recalculée : 81 × 101 inchangé, tuyaux 1 123 → 1 115, croisements 75 → 74, électricité 3 595 $ inchangée ; Steel Ingot → Steel Plate 43 → 11 cases ajoutées (passages Steel Ingot et Iron Ingot vers le haut, entre les hauts-fourneaux 1 et 2). Les passages sont essayés à placement égal et gardés seulement s'ils raccourcissent sans ajouter de croisement (seul, le meilleur faisait −40 cases mais +1 croisement ; en le laissant entrer dans le recuit : 83 × 104, rejeté). Aucun passage élargissant ne tient à sa place dans la maquette.
  À surveiller : pas de passage pour les modules repliés (tuyaux principaux) ni pour les collecteurs parallèles ; dans le site, le choix du passage n'est pas encore guidé par les voisins (ce sera S3) ; « module par module » inchangé (82 × 104, 74 croisements).
- **2026-10-16, S3** (`1919f4e`, 255 tests, déployé) : `src/engine/build/factory.ts` (`factoryInput`, `designFactory`, pur, sans DOM) ; la maquette l'appelle (résumé et HTML identiques au caractère près). Web Worker de Vite (`factory.worker.ts`, `factory-job.ts`) avec avancement et annulation ; résultat gardé tant que plan, priorités, relevés et parcelle ne changent pas. Plans de pose : entrée « Toute l'usine » (vue de dessus navigable qui s'ouvre en entier, parcelle, « proposition », liaisons et passages repliés). Passage guidé par les voisins : dans le plan de pose d'un module, les passages gardés par l'usine sont marqués ★ (par les bouts reste le défaut).
  Mesures (Crankshaft 60/min, « Forme ramassée » d'abord) : 81 × 101, 1 115 cases, 74 croisements, 3 595 $ — identiques à la maquette, sur le site aussi. Temps : 13 s sous Node, 12 à 21 s dans le navigateur ; page jamais bloquée (pause la plus longue 118 ms, au dessin final). Avec « Place au sol » d'abord (défaut du site) : 131 × 54, 1 012 cases, 71 croisements, mais 12 635 $ d'électricité, 7 s.
  À surveiller : un module seul ne prend qu'un passage alors que l'usine peut en garder deux (Blast Furnace : Steel Ingot et Iron Ingot), et le passage conseillé peut élargir le module seul (Iron Ingot : 27 × 26) mais pas celui de l'usine (autre disposition interne) ; sans parcelle renseignée, le placement n'a pas de limite ; le résultat est perdu au rechargement de la page ; le site ne montre que le mode recalculé (les options sont pour S4).
- **2026-10-17, S4** (`6502c62`, 259 tests, déployé) : `src/engine/build/flow.ts` (sens du flux de chaque liaison, testé) ; dans « Toute l'usine », barre d'options de la maquette (recalculé par défaut / module par module, liaisons collées, Tout afficher, Réseau électrique, câbles vers chaque machine ; un calcul gardé par réglage) et bouton « Afficher les liaisons » (aussi dans le plan d'une étape et dans le panneau) ; clic sur un tuyau → ses liaisons, sur un câble → ce qu'il alimente ; survol d'un module (cadre éclairé, bulle) ; clic → panneau à droite (`#objet/pose/usine-entiere/<étape>`, ← Retour, ⛶ plein écran), dans la version de l'usine (recalculée, tournée, tuyaux qui traversent), machines → éditeur de bâtiments (S5 rebranchera vers la fiche) ; lien « voir sa version dans l'usine » depuis le plan d'une étape ; liste « Machines à compléter » (demande en cours de lot).
  Mesures inchangées : recalculée 81 × 101, 1 115 cases, 74 croisements, 3 595 $ ; module par module 82 × 104, 74 croisements ; « coller » ne colle rien dans cette chaîne (comme la maquette, le résumé le dit).
  À surveiller : l'ordre de pose d'un module tourné garde les directions d'avant la rotation (signalé dans le panneau) ; changer de calcul pendant un autre l'annule ; le panneau reprend les couleurs de l'usine, pas celles du plan seul.
- **2026-10-17, complément de S4 (demande de l'utilisateur : retirer les appendices)** (259 tests, déployé) : en mode recalculé, une fois la disposition finale choisie, `pruneDeadEnds` (factory.ts) retire les tuyaux qui ne mènent nulle part, pièce par pièce depuis le bout. Une liaison compte si elle mène à une pièce de la même ressource, à une machine, à un emplacement réservé ou au raccord d'un collecteur que l'usine ne relie pas. Un té qui perd une branche devient un tuyau droit ou un coude, et les pièces et le prix des modules sont recomptés (`withPieces`, module.ts). Le résumé donne le nombre de cases retirées.
  Mesures (Crankshaft 60/min) : « Forme ramassée » d'abord 1 115 → 1 090 cases, 74 → 73 croisements (maquette régénérée) ; « Place au sol » d'abord 1 012 → 1 009 cases, 71 → 70 croisements ; électricité inchangée. Aussi : la vue de départ d'un cadre se recalcule s'il était presque sans largeur au premier dessin (page en arrière-plan).
- **2026-10-17, S5** (`731c9e0`, 274 tests, déployé) : onglet « Recettes » (`recipes-view.ts`, `recipes-store.ts`) : recherche, tuiles ou lignes triables (nom, valeur, RP), fiches objet (Sources, Utilisations) et machine (crafts), tout cliquable, `#recettes/<objet|machine>/<id>` ; ⚠ → la valeur dans « Valeurs à vérifier » (`#donnees/verifier/<recette|machine>/<id>/<champ>`, champ éclairé), aussi depuis le détail du plan ; cadenas si la recherche manque ; machines du plan de pose et du panneau de module → leur fiche. 312 vignettes du wiki (`scripts/fetch-images.ts`, `data/images.json`, 4,7 Mo), image choisie par le joueur (export `mes-images.json`) ; 19 descriptions d'objets du wiki, sinon recopiées (correction `items.description`).
  Tâche « Steel Plate → sa machine » : taper « steel pl », Entrée, un clic sur la machine (3 gestes, ~12 s avec la latence de l'outil) ; vérifiée sur ordinateur et téléphone. Valeurs des captures du jeu identiques à nos données (Crankshaft 754 $, 35× RP, 15 s / 4 kMF/s et 5 s / 200 kMF/s ; Chemical Reactor 750 000 $).
  À surveiller : les objets n'ont pas de ⚠ cliquable (rien de corrigeable pour eux dans « Données » : le détail s'affiche à la place) ; en lignes, les prix sont arrondis (« 750 k$ », valeur exacte au survol et dans la fiche) ; pied de page corrigé (Miraheze est en CC BY-NC-SA 4.0).
- **2026-10-17, S6** (`17a59bd`, 292 tests, déployé) : maquette validée (`maquette/recettes-corriger.html`, décisions S6 au § 5). `overrides.json` : sections `added` (objets, crafts) et `removed` (crafts), validées par `buildGameData` (refus motivé : machine ou objet inconnu, pas de sortie, quantité ≤ 0, durée ≤ 0, sans source) ; nouvelles corrections : machine d'un craft (sa recherche suit) et facteur RP. Fiche en mode « ✎ Corriger » : cases pour prix, RP et prix d'achat ; par craft ✎ Modifier, ✕ N'existe pas en jeu (barré, ↺ Rétablir), remplacer par un craft corrigé ; + Ajouter un craft manquant (noms du jeu, objet inconnu créé sur place), + Objet manquant ; ⚠ → la valeur dans ce mode ; Données › Mes corrections liste ajouts et retraits ; export et import dans le même fichier.
  Parcours réel (Crankshaft 60/min, recherche complète, parcelle 200 × 200) : retirer le craft du Craft Assembler fait passer le plan de 15 Craft Assemblers à 5 Advanced Assemblers ; un craft de test ajouté (valeurs fictives, effacé ensuite) est choisi (1 Craft Assembler, 23 machines au lieu de 109) ; l'export contient `added` et `removed`, et l'import les rétablit.
  À surveiller : un craft existant ne change que ses quantités (entrée manquante ou en trop : le remplacer) ; un retrait inscrit dans `data/overrides.json` ne se rétablit pas depuis le site ; pas de machine manquante (éditeur de bâtiments) ; les dates affichées sont en UTC (comme ailleurs sur le site).
- **2026-10-17, S7** (`1a7200b`, 302 tests, déployé) : maquette validée (`maquette/schema-calcul.html`). `calc-view.ts` : un bloc sélectionné ouvre « Comment c'est calculé » sous la barre du bas — ligne du craft (rendu de Recettes), « Voir dans Recettes ▸ » (`#recettes/<objet|machine>/<id>/<craft>`, craft mis en évidence et centré), puis débit d'une machine (sortie nette, « (17 − 2) » si le craft consomme son produit), demande (flèches + objectif ou surplus), machines exactes → arrondies, utilisation, énergie (moyenne et pointe), entrées et sous-produits ; étiquette de source par valeur (wiki, relevé en jeu, ta correction, ⚠ → la valeur en mode « ✎ Corriger »). Flèche : produit par, consommé par, besoin de l'arrivée, part du départ au prorata quand plusieurs blocs produisent l'objet. Cas particuliers : matière première, arbres (durée de pousse), production existante, installations composées (bâtiments arrondis un par un), non produit.
  Parcours réel (Crankshaft 60/min, recherches du plan débloquées : 148 machines, ≈ 61 arbres) : refait à la main Steel Ingot (6 × 60 ÷ 5 s = 72/min ; 360 ÷ 72 = 5 Blast Furnace ; Iron Ingot 360 × 2 ÷ 6 = 120/min, comme la flèche) et Coke Fuel (60 ÷ 72 = 0,8333 → 1 ; 0,8333 × 15 kMF/s = 12,5 kMF/s ; Coal 60 × 4 ÷ 6 = 40/min, comme la flèche) ; lien vers Recettes et ⚠ des arbres vérifiés ; téléphone sans débordement. Tests : sur la chaîne « tout débloqué », chaque débit, compte, entrée et flèche se refait avec les valeurs affichées (Coke Fuel → Steel Ingot : 60 × 98,96 % = 59,37/min).
  À surveiller : pour les arbres, la ligne du craft montre la durée des données (6 min) alors que le calcul prend la pousse selon la pollution (362,72 s), la phrase l'explique ; les étapes d'énergie et de dépollution ont un panneau plus court (machines « d'après l'optimisation ») ; captures d'écran impossibles dans cette session (fenêtre masquée), parcours fait par le DOM.

- **2026-10-17, S8** (311 tests, déployé) : maquette validée (`maquette/schema-machines.html`, décisions S8 au § 5). Moteur : `SolveRequest.fixedMachines` (étape → nombre) et `onlyRecipes` ; `solveFixed` garde les recettes du plan, tente d'abord une règle de trois (juste sans production existante), puis encadre le débit (fausse position, ou dichotomie si une borne bute sur le budget ou la pollution) ; `Plan.fixed` donne le débit obtenu, l'étape qui limite et l'utilisation de chaque étape fixée, et les étapes fixées gardent leur nombre de machines. Dans le site, la barre du bas a « Machines : [−] N [+] » (molette, flèches, nombre tapé), avec un bandeau « Production obtenue … limitée par … » et « Revenir au calcul » au-dessus des onglets. Dans le schéma, un bloc fixé a un cadre en tirets, celui qui limite est en orange. « Comment c'est calculé » ajoute « Nombre fixé » et « Production obtenue ». Le réglage est gardé au rechargement, et tout le plan le suit.
  Parcours réel (Crankshaft 60/min, recherches du plan) : 4 Blast Furnace au lieu de 5 → 48/min (60 × 4 ÷ 5) ; en plus, 10 Craft Assembler au lieu de 15 → 40/min, Steel Ingot utilisé à 83,3 % ; molette → 12 → 48/min ; réglage gardé au rechargement ; liste de construction à 12 Craft Assembler ; « Revenir au calcul » remet 60/min. Tests : étape seule (45/min), deux étapes (37,5/min, 83,3 %), production existante (67,5/min), clé absente, objectif argent.
  À surveiller : chaque réglage refait un ou deux calculs (≈ 50 ms chacun), et jusqu'à une vingtaine quand le budget ou la pollution limitent ; libérer un bloc suppose de revenir au nombre du calcul sans réglage (ou de vider le champ) ; pour une étape à plusieurs recettes, le réglage suit la recette (clé `objet@recette`).
- **2026-10-17, S9** (332 tests, déployé) : maquette validée (`maquette/filtre-machines.html`, décisions S9 au § 5). Moteur : `SolveRequest.machines = { mode: "exclure" | "seulement", ids, noExtraction }` (`machine-filter.ts`), appliqué dans le Chooser (crafts, générateurs, Scrubbers ; pas les dépôts de vente) : un craft écarté a le statut « écartée », un objet sans machine permise la raison « machine écartée » et le message « Aucune machine permise ne fabrique X … » ; une recette forcée sur une machine écartée est ignorée avec sa raison. Extraction = catégorie « Extractors » du wiki et arbres. Site : ligne « Machines » repliée sous « Priorités » (Toutes / Toutes sauf… / Seulement…, recherche avec liste, machines du plan en raccourcis, extraction d'office en « Seulement… »), un filtre par plan (`machineFilters`, clé `objet|<objet>`, `énergie`, `argent`) gardé au rechargement ; note « Filtre de machines … Retirer le filtre » et « Permettre … » dans la réponse ; « Ne plus utiliser … ⊘ » dans la barre du bas du schéma.
  Parcours réel (Crankshaft 60/min, progression du navigateur) : sans filtre 119 machines, ≈ 61 arbres ; Blast Furnace écartée (tapée dans la recherche) → 115 machines, ≈ 31 arbres, Steel Ingot et Coke Fuel sur 1 Blast Furnace MK2 ; + Blast Furnace MK2 → « Aucune machine permise ne fabrique Steel Ingot (360/min manquent) », 26 machines ; « Permettre Blast Furnace MK2 » → 115 ; « Seulement… » reprend les 6 machines du plan, Tree écarté → 189 machines, sans arbre ; « Ne plus utiliser Blast Furnace » depuis le schéma ; gardé au rechargement ; Gear sans filtre, retour au Crankshaft avec le sien ; téléphone sans débordement.
  À surveiller : « Seulement… » ne reprend les machines du plan que si sa liste est vide (une liste déjà choisie est gardée) ; le filtre de l'objectif RP n'existe pas (le mode « débloquer ce qui manque à mon plan » prend celui de l'objet) ; les machines fixées dans le schéma (S8) restent réglées même si le filtre fait disparaître leur bloc (« réglage sans effet »).
- **2026-10-17, S10** (350 tests, déployé) : recherche Miraheze (pages et moteur de recherche du wiki) et Fandom ; maquette validée (`maquette/interfaces.html`, décisions S10 au § 5). `data/interfaces.json` : 20 machines, chacune sourcée — levier « bottle » / « container » des deux mouleurs, écran définitif de la Quarry, écran chiffré de la Chemical Plant (Resource Input, Resource Output, Power Input), et les interfaces sans effet (logique, centrales, Mineshaft Drill…) avec leur raison ; doutes IF-01 à IF-06 dans `a-verifier.md`, méthode dans RELEVES.md. Moteur (`interfaces.ts`) : position à mettre pour un craft ; réglages chiffrés appliqués aux crafts (`applyMachineSettings`, original gardé dans `screen.base`) ; les crafts de la Chemical Plant ne sont plus « à vérifier » (valeurs à 1×). Site : ⚙ dans la liste de construction, la barre du bas du schéma, « Comment c'est calculé » et le plan de pose (et le panneau d'un module de l'usine) ; cases de l'écran dans la barre du bas, par plan (`machineSettings`), « ↺ 1× » ; éditeur de bâtiments : section « Interface » (type, où, définitif, réglages à positions avec leurs crafts ou chiffrés), ⚙ dans la liste, enregistrée à part des ports, exportée avec les relevés (clé `interfaces`).
  Parcours réel (navigateur intégré) : Crankshaft inchangé (115 machines, ≈ 31 arbres, filtre de S9 laissé dans ce navigateur, aucune pastille) ; Gearbox 60/min → 4 Industrial Plastic Molder « ⚙ levier sur « container » » (liste, schéma, panneau, plan de pose) ; Hardened Plastic Casing calculée sans « valeurs à vérifier » (1 Chemical Plant) ; écran 1,67 / 2 / 4 → 1 200 /min par machine au lieu de 600, gardé au rechargement, « ↺ 1× » le retire ; Clay Brick → Quarry « Soil & Clay » « définitif » ; éditeur : position renommée → le plan la suit, « Oublier » revient au dépôt ; téléphone sans débordement.
  À surveiller : l'interface a son propre bouton « Enregistrer l'interface » (la maquette disait « avec le relevé » : séparé pour ne pas créer un relevé de ports vide) ; l'écran vaut pour toutes les Chemical Plant d'un plan (pas étape par étape) ; la ligne du craft dans « Comment c'est calculé » montre les quantités multipliées.
- **2026-10-18, S12** (365 tests, déployé) : maquette validée (`maquette/modulaires.html`, décisions S12 au § 5). Données (`modular.json`) : faces obligatoires de chaque bloc par contact (`facesRequired`), ligne du moteur (`order`), volant placé comme un vilebrequin sans face obligatoire (réponse du 2026-10-18), blocs desservis par le réservoir, l'arroseur et le récolteur (`serves`), questions encore ouvertes (`meta.openQuestions`) ; MOD-17 (bord « devant » d'un bloc) dans `a-verifier.md`, méthode dans RELEVES.md. Moteur pur `src/engine/modular.ts` (faces, portées, grille d'arbres, correction à garder). Éditeur de bâtiments : repère ⬡ ferme / moteur / turbine dans la liste (la recherche « ferme » trouve les 6 blocs) ; section « Ensemble modulaire » : chaîne avec le bloc éclairé, tableau des faces (obligatoire ou facultatif, puces cliquables vers chaque bloc, sources, ⚠ sur les questions ouvertes), champ « Devant, sur la grille du relevé » ; pour la ferme, portée (depuis le bord et depuis le centre), forme, ce que le bloc dessert, de qui il doit être à portée, et la portée dessinée sur une grille d'arbres ; « ✎ Corriger » gardé dans le navigateur, exporté avec les relevés (clé `modular`).
  Parcours réel (navigateur intégré, ordinateur et téléphone) : arroseur 44 arbres en grille, comme les deux wikis (« ✓ cohérent ») ; portée passée à 12 → 48 et « ⚠ les wikis disent 44 » ; récolteur 168 emplacements, contrôleur 776 ; vilebrequin « derrière » décoché → gardé au rechargement, repère ✎, « Oublier » revient au dépôt ; puce « Controller » → sa fiche ; turbine et volant affichés ; pas de débordement à 375 px (en-tête du tableau et repère « moteur » raccourcis pour ça).
  À surveiller : la maquette annonçait la ferme du guide en repère dans le cercle du contrôleur, remplacée par la grille (placement exact du guide non écrit) ; pour les blocs posés sur un côté (cylindre…), la ligne « Côtés » veut dire « contre le côté d'un vilebrequin » ; l'export n'a pas été cliqué (téléchargement), il est couvert par un test aller-retour.
- **2026-10-18, S13** (382 tests, déployé) : Q12 posée et validée (« Oui à tout », décisions S13 au § 5 ; maquette en texte). Moteur pur `src/engine/modular-calc.ts`, qui ne lit que `modular.json`. Ferme : `farmRates`, `farmBlocks`, `farmOutput` (bois, eau, électricité, ce qui limite, blocs manquants). Moteur diesel : `dieselConfigs` et `dieselLookup` (8 configurations relevées ; les autres « à relever »). Turbine : `turbineReliability` (« non fiable », hors du calcul). `applyModular`, appelé dans `buildGameData` (`RawFiles.modular`) : l'arbre devient une ferme. Pièces par arbre : 1/44 d'arroseur, 1/132 de réservoir, 1/22 de récolteur ; contrôleur et sortie une fois par ferme (`perFarm`). L'eau et l'électricité suivent la pousse (`evalRecipe`). Les moteurs deviennent des installations énergétiques, comptées en moteurs entiers (`wholeUnits`). Ajouté aussi : arbres toujours réglables dans le schéma (S8), blocs de la ferme comptés comme bâtiments. Filtre S9 : en « Seulement… », les blocs suivent l'arbre ; écarter un récolteur écarte la ferme. Site : ligne « Ferme d'arbres » dans la liste de construction, « Comment c'est calculé » (arroseurs, réservoirs, récolteurs ⚠ MOD-09, contrôleur et sortie, électricité, eau), craft de l'arbre « 200 kMF par coupe » dans Recettes. Objectif énergie : moteur diesel parmi les centrales, turbine « non fiable » dans la liste des non calculées. Éditeur de bâtiments : bloc « Calcul » sous « Ensemble modulaire » (ferme : blocs saisis → Oak Log/min, limite, eau, électricité, « Au plus juste » ; moteur : réglages → configuration relevée ou « à relever », puces des 8 configurations ; turbine : non fiable).
  Parcours réel (navigateur intégré, ordinateur et téléphone 375 px) : Oak Log 30/min → 91 arbres + 3 arroseurs + 1 réservoir + 5 récolteurs + 1 contrôleur + 1 sortie, 50,2 kMF/s, Water 122/min, 1 Water Pump2 ; panneau refait à la main (30 ÷ 0,3308 = 90,68 ; 90,68 × 200 kMF ÷ 362,72 s = 50 kMF/s). Énergie 2 MMF/s, filtre réduit au diesel (essai, retiré ensuite) : 1 moteur 32 cylindres, Refined Diesel 3,69/min (0,6693 × 0,092 × 60). Éditeur : guide 88 arbres → 29,11/min, 118,8 L/min, 48,52 kMF/s ; 120 arbres → limite « arroseurs », « Au plus juste » → 3 / 1 / 6 ; 7 cylindres → « À relever » ; turbine « non fiable ». Tests : ferme du guide (2 arroseurs, 1 réservoir, 4 récolteurs), limites, solveur, arbres fixés, filtre, moteurs, 84 500 $ du montage simple.
  À surveiller : l'eau se compte au prorata des arbres (3 arroseurs posés pour 91 arbres en boivent 178 L/min, le plan en compte 122) ; tous les plans avec du bois changent (eau, électricité, blocs, prix) ; le 32 cylindres a une liste de blocs incomplète (MOD-14), son prix est donc trop bas ; le tableau à 6 cylindres est supposé à l'accélérateur 100 % ; la taille maximale d'une ferme n'est pas connue (une seule ferme jusqu'à S14) ; le bloc « Calcul » de l'éditeur n'est pas gardé au rechargement.
- **2026-10-18, S14** (391 tests, déployé) : Q15 posée (maquette `maquette/modulaires-pose.html`, calculée avec les règles du jeu), réponses et décisions S14 au § 5. Relevés du 2026-10-18 intégrés (46 bâtiments, corrections de l'utilisateur) ; `modular.json` : le contrôleur porte des blocs de côté, un bloc par côté, longueur sans effet sur la puissance, MOD-17 close (champ « Devant » retiré de l'éditeur). Moteur pur `src/engine/build/assembly.ts` : ferme (carrés de 7 × 7 autour de chaque arroseur, récolteurs dans les trous, contrôleur au centre, sorties et réservoirs avec un passage libre pour leur tuyau, au besoin à travers le bois en replaçant les arbres, chaîne de poteaux du bord jusqu'à la prise, plusieurs fermes écartées au-delà d'environ 600 arbres) et moteur diesel (ligne contrôleur → vilebrequins → générateur, blocs de côté des deux côtés, le moins de vilebrequins). Le calcul compte les blocs de la ferme d'après ce plan (`farmCounts`, appelé par le solveur) et ceux du moteur au plus court (6 cylindres : 4 vilebrequins, 68 500 $ au lieu de 84 500 $). Site : groupe « Ensembles modulaires » dans les plans de pose (dessin, « Afficher les portées », clic sur un bloc → son cercle et ce qu'il dessert, choix du poteau, ordre de pose, pièces, hypothèses) ; « Toute l'usine » leur donne leur vraie place et les ouvre dans le panneau.
  Parcours réel (navigateur intégré, DOM : captures impossibles, fenêtre masquée) : Oak Log 30/min → ferme de 91 arbres, 3 arroseurs, 1 réservoir, 5 récolteurs, 2 sorties, 1 contrôleur, 2 MV Pole, 81 × 62 cases, 12 940 $ ; liste de construction identique (2 sorties) ; HMVT → 1 poteau, une place libre, 22 780 $ ; clic sur un récolteur → ses 22 arbres et sa sortie ; « Toute l'usine » : la ferme à 81 × 62 au lieu de 12 × 12, clic → panneau. Énergie 2 MMF/s, filtre (essai, retiré) : 2 moteurs de 6 cylindres, rapport 14, 12 × 12 cases, 137 000 $. Téléphone 375 px sans débordement. Guide Miraheze (88 arbres) refait par le moteur : 2 arroseurs, 4 récolteurs, 2 sorties, comme le guide.
  À surveiller : la capacité d'une ferme (environ 600 arbres) se calcule en quelques secondes et n'est affichée que quand il faut plusieurs fermes ; la liaison Water → ferme n'est pas tracée dans « Toute l'usine » (comme avant : place sans port) ; Crankshaft 60/min (≈ 31 arbres dans ce navigateur) : la ferme passe de 12 × 12 à 36 × 38 cases dans l'usine, et les mesures du site changent (pas celles de la maquette, calculée sans modulaires) ; le 32 cylindres n'est couvert que par les tests (le solveur lui préfère le 6 cylindres) ; les pièces de tuyau fluide de tier III n'ont pas le même id partout (`pipe-fluid-turn2`… dans logistics.json et le catalogue, `fluid-pipe-turn2`… dans machines.json et les relevés) : à vérifier.
- **2026-10-18, après S13** : deux nouveaux retours (R11, R12) ajoutés au plan sous forme de lots de planification, sans code : S16 (site en anglais et ergonomie, pour le Discord) et S17 (bac à sable : construire sa chaîne, tracé des tuyaux à la Mindustry). Questions Q13 et Q14 à poser au début de ces lots. Ordre : S14, S15, S16, S17.

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
