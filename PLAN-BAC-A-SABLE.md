# Bac à sable : construire sa chaîne et voir ses statistiques (S17)

Retour R12. Ce plan ne code rien : il fixe ce qu'on construira, dans quel ordre, et à quoi on saura que
chaque lot est fini. Maquette : [`maquette/bac-a-sable.html`](maquette/bac-a-sable.html), 2e version. On
l'ouvre avec `npm run dev` puis `/maquette/bac-a-sable.html` ; le menu « Exemples » propose trois
montages. Ses données sont tirées des fichiers du jeu par `node maquette/bac-a-sable.gen.mjs`.

Le calculateur part d'un objectif et pose l'usine. Le bac à sable fait l'inverse : le joueur pose ses
machines et ses tuyaux sur la grille, et le site lui dit ce que donne son montage.

## 1. Décisions

### Q14, 1er tour (2026-10-26), toujours valables

| # | Décision |
| --- | --- |
| 1 | Les statistiques d'abord, sur un plan fidèle au jeu, pour que le montage se refasse en jeu. |
| 2 | La grille du jeu : mêmes cases et mêmes tuyaux que les plans de pose (1 case = 1 Short Pipe). |
| 3 | Les bâtiments gardent leur taille et leurs ports relevés. **Un bâtiment dont les ports ne sont pas relevés ne peut pas être posé.** |
| 4 | Partir d'un plan calculé pour le modifier : oui, dans un lot à part. |
| 5 | Partager : un code (comme les schémas de Mindustry), un fichier, et un lien seulement s'il fait au plus 2 000 caractères. La fenêtre des schémas affiche cette longueur. |
| 8 | Calcul automatique pendant la pose, qui ne doit jamais ralentir le joueur. Les tuyaux montrent ce qu'ils doivent transporter, déduit de ce qui y est branché ; une machine déduit sa recette de ce qui lui arrive ; « ? » quand plusieurs recettes vont ; la recette retenue se voit sur la machine. |
| 9 | Les liaisons fausses sont refusées au tracé ; un tuyau saturé change de texture (hachures rouge et orange). |
| 10 | « Bac à sable » / « Sandbox » dans le menu du site. |

### Retour sur la 1re maquette (2026-10-26) : « ça ne va pas du tout »

L'utilisateur demande de s'inspirer à 100 % de Mindustry. Cela remplace Q14-6 (menu « burger », chapitres)
et Q14-7 (« les gestes, pas l'aspect »).

| Demande | Décision |
| --- | --- |
| Le menu « burger » et les chapitres | Supprimés. **Menu de pose de Mindustry**, en bas à droite : un cadre d'infos en haut, une grille de blocs, une colonne des catégories du jeu, la **colonne des tiers tout à droite**, et une barre d'outils sous la grille. |
| Infos sur un bloc | Au survol d'un bouton de la grille, le cadre montre le bloc. Après un clic, il reste affiché et le bloc est en main. Le bouton **?** ouvre la fiche complète (description, caractéristiques, ports, fabrication), comme la fiche Infos de Mindustry. |
| Bâtiments indisponibles | Montrés grisés à la fin de la grille, jamais cachés. Un clic affiche « Compléter … ▸ », qui ouvre l'éditeur de bâtiments. |
| Poser plusieurs machines | Maintenir et glisser : une ligne droite sur l'axe le plus long, au pas de la machine, **jamais en diagonale**. |
| Les tuyaux | Dans le menu, comme le reste : un bouton par famille. Les variantes s'affichent dans le cadre d'infos. Longueur 1 par défaut. Au glisser, la ligne droite et les virages nécessaires sont posés seuls, avec la pièce adaptée aux croisements et des **longueurs automatiques, les plus longues possibles**. Une case « Longueur auto » dans le cadre d'infos désactive ces longueurs. |
| Tuyau posé sur un tuyau | N'importe quelle pièce peut se poser sur un tuyau du même type, et le reste s'adapte : un long tuyau est remplacé par les pièces plus courtes qu'il faut, et les liaisons sont recalculées. |
| Supprimer | Une **zone** : clic droit maintenu, un rectangle, supprimé au relâchement (comme dans le jeu). |
| Se déplacer | **ZQSD** (AZERTY) ou **WASD** (QWERTY), en plus du clic molette. |
| Les boutons d'outils sur le côté | Supprimés. |
| Les outils | **Tous ceux de Mindustry**, voir le § 3. Un seul outil en plus : **Liaisons**, qui montre tous les vecteurs de raccord. |

## 2. Mindustry : ce qui a été lu

Sources, lues le 2026-10-26 dans le code source de Mindustry
(`github.com/Anuken/Mindustry`, branche `master`) :
- `core/src/mindustry/input/` : `Binding.java`, `DesktopInput.java`, `MobileInput.java`,
  `InputHandler.java`, `Placement.java` ;
- `core/src/mindustry/ui/fragments/PlacementFragment.java` ;
- `core/src/mindustry/world/blocks/distribution/Conveyor.java`.

Côté Industrialist, j'ai lu la page wiki
[Building System](https://industrialist.miraheze.org/wiki/Building_System) : clic molette = « Quick
Select », glisser = pose sur un seul axe, Q fait défiler les tuyaux.

**Le menu de pose (`PlacementFragment`).**
- Il est placé en bas à droite.
- **Le cadre d'infos** :
  - il est caché quand il n'a rien à montrer ;
  - il montre le bloc survolé dans la grille, sinon le bloc en main, sinon le bâtiment survolé sur la carte ;
  - il affiche l'icône, le nom, le raccourci `[catégorie, bloc]` (au-delà de 9 : « dizaine, unité ») et le bouton **?** ;
  - **?** ouvre la fiche, seulement pour un bloc débloqué.
- **La grille** :
  - 4 colonnes de boutons de 46 px, qui défilent ;
  - les blocs posables viennent d'abord, les autres en gris à la fin ;
  - un clic sur le bloc en main le lâche ;
  - le bloc choisi est retenu par catégorie.
- **Les catégories** sont des boutons de 50 px ; une catégorie vide est sombre et ne se clique pas.
- **Sous la grille** : schémas (icône presse-papiers), base de données (livre), arbre de recherche, carte.
- **Au clavier** :
  - des chiffres tapés à moins de 400 ms d'écart choisissent la catégorie puis le bloc ;
  - les flèches parcourent la grille ;
  - `,` et `.` changent de catégorie ;
  - F1 ouvre la fiche.

**La pose (`DesktopInput`, `InputHandler`, `Placement`).**
- **Ligne** : on appuie pour fixer le début et on relâche pour poser. `normalizeLine` garde l'axe le plus long (à égalité, l'axe vertical) et avance au pas de la taille du bloc.
- **Ctrl** (`diagonal_placement`) passe les convoyeurs en recherche de chemin. `Placement.astar` cherche sur 4 voisins avec ces coûts : 1 par case, +8 par virage, 20 pour un obstacle, au plus 1 000 nœuds.
- **Rotation** :
  - la molette tourne le bloc en main, sinon elle zoome ; Ctrl + molette garde le zoom ;
  - R (`rotateplaced`) tourne un bâtiment déjà posé.
- **Clic droit** : lâche le bloc ; maintenu et glissé, il trace un rectangle supprimé au relâchement.
- **Clic molette** (`pick`) : prend le bloc survolé et copie sa configuration.
- **Schémas** :
  - F + glisser copie une zone ;
  - clic pour coller, molette pour tourner, Z / X pour retourner ;
  - T ouvre la liste des schémas, qu'on partage par un code.
- **Autres touches** :

  | Touche | Effet |
  | --- | --- |
  | Q | vide la file de construction |
  | E | met la construction en pause |
  | B | reconstruit |
  | WASD + Maj | déplacement, plus vite avec Maj |
  | F5 | lignes électriques |
  | F6 | pastilles d'état |
  | C | masque l'interface |
  | J | arbre de recherche |
  | M | mini-carte |
- **Croisements** (`Conveyor.getReplacement`) : une ligne qui traverse un convoyeur perpendiculaire y pose une jonction.
- **Ponts** (`calculateBridges`) : posés seuls à portée, choisis par programmation dynamique (coûts : convoyeur 3, jonction 30, pont 200).
- **Remplacement** (`upgradeLine`) : glisser un meilleur convoyeur sur une chaîne la remplace.

**Au téléphone (`MobileInput`).**
- Un toucher met un bloc en file d'attente, et ✓ valide la file.
- Appui long puis glisser : une ligne (3 cases au moins) ou une zone.
- Boutons : 🔨 casser, diagonale, ⟳ tourner, schéma, ✕ annuler.
- Un doigt déplace la vue, deux doigts zooment, et la vue défile seule près du bord de l'écran.

## 3. Les commandes du bac à sable

Les touches sont lues par leur position sur le clavier (`KeyboardEvent.code`), comme dans les jeux :
WASD en QWERTY devient ZQSD en AZERTY sans aucun réglage. Les lettres affichées suivent le clavier du
joueur (`navigator.keyboard.getLayoutMap`, sinon les touches déjà frappées). La maquette a un bouton
« ⌨ Touches » qui reprend ce tableau.

| Action | Bac à sable | Mindustry |
| --- | --- | --- |
| Se déplacer | ZQSD / WASD, Maj = vite ; clic molette glissé | move_x/move_y, boost |
| Zoomer | Molette ; Ctrl + molette quand un bloc est en main | zoom |
| Choisir un bloc | Menu : tier, catégorie, bloc ; chiffres `[tier, catégorie, bloc]` | block_select_01…10 |
| Parcourir la grille | Flèches ; `,` / `.` : catégorie | block_select_*, category_prev/next |
| Infos | Survol, clic (gardé), **?** ou F1 | cadre d'infos, block_info |
| Poser | Clic ; maintenir et glisser : en ligne, sans diagonale | select, normalizeLine |
| Tracer un tuyau | Glisser : virages, croisements, longueurs posés seuls ; Ctrl : ligne droite seule | astar, getReplacement, calculateBridges |
| Variante de tuyau | Q (comme Industrialist), ou clic dans le cadre | « Q cycle » d'Industrialist |
| Tourner | Molette ou R ; R sur un bâtiment posé le tourne | rotate, rotateplaced |
| Lâcher | Clic droit, Échap, Q (sans tuyau en main) | deselect, clear_building |
| Supprimer | Clic droit (une case) ; clic droit glissé (une zone) | break_block |
| Pipette | Clic molette, recette comprise | pick, Quick Select |
| Régler un bâtiment | Clic dessus : recette, tourner, supprimer | configuration |
| Copier, coller | F + glisser ; clic ; molette ou R ; Z / X | schematic_select, flip |
| Schémas, partage | T ou 📋 : liste, code, lien ≤ 2 000 | schematic_menu |
| Base de données | 📖 | bouton livre |
| Liaisons | L ou 🔗 | (ajout de l'utilisateur) |
| État des machines | F6 : pastille verte, orange (sortie bloquée), rouge (entrée manquante) | toggle_block_status |
| Masquer l'interface | C | toggle_menus |
| Arbre de recherche | J ou 🌳 | research |
| Annuler, rétablir | Ctrl+Z, Ctrl+Y | éditeur de cartes |
| Téléphone | Un doigt, deux doigts, appui long ; 🔨 ⬚ ⟳ ✕ ↶ | MobileInput |

**Sans objet**, et pourquoi :
- la pause et la file de construction (E, Q de Mindustry), la reconstruction (B) : la pose est immédiate ;
- les unités, les commandes, le ping, la discussion, la carte des planètes : rien de tel dans le site.

**Prévus plus tard** :
- la mini-carte (M) et les lignes électriques (F5) : il faut d'abord l'électricité (lot B7) ;
- la file d'attente avec ✓ au téléphone (lot B6).

## 4. Les tuyaux

**Les pièces** (`data/logistics.json`, `data/ports.json`) :

| Famille | Débit | Pièces | Remarque |
| --- | --- | --- | --- |
| Tier I, objet et fluide | 6/s | droit (1 case), coude, té, croix | « Longueur auto » ne change rien |
| Tier III, objet | 120/s | 1, 2 et 4 cases | |
| Tier III, fluide | 120/s | 1, 2 et 4 cases | le coude, le té et la croix ne sont pas relevés : posés en rouge, « à compléter » |
| Tier IV (grands tuyaux) | 12 000/s | 2 cases de large | posés comme des blocs pour l'instant |

**Les croisements posés seuls** sont toujours des pièces non rusty de tier III : Pipe Intersection, Fluid
Pipe Intersection, Fluid Pipe and Item Intersection. Elles servent aussi au tier I. Les pièces rusty
restent des variantes qu'on choisit à la main ; elles ne sont jamais posées seules.

**Raccord (réponse BAS-02).** Deux ouvertures se raccordent quand elles sont face à face et du même type.
Un tuyau qui passe le long d'un port sans s'y diriger ne s'y raccorde pas.

**Sens (réponse BAS-02).**
- **Le sens vient des voisins.** Seules les pièces dont la nature l'indique ont un sens propre (vannes,
  compteurs : à relever). Un tuyau droit, un coude ou un té n'en ont pas : le flux va des sorties des
  machines vers leurs entrées.
- **Té** : une entrée se partage sur les deux sorties ; deux entrées donnent une seule sortie.
- **Croix** : une entrée pour trois sorties, deux pour deux, ou trois pour une.
- **Limite de débit** : chaque pièce laisse sortir au plus son débit, et freine donc ce qui entre.
- **Croisement** : il a deux voies indépendantes, ↔ et ↕. Par défaut, un flux prend la voie alignée sur le
  côté par où il entre et ressort en face ; un voisin du même type posé en face (un virage, par exemple)
  s'y raccorde. Ce choix automatique pourra être changé à la main (lot B3).

`ports.json` note une entrée et une sortie pour les tuyaux droits. On ne s'en sert pas, car ces tuyaux
n'ont pas de sens propre (réponse de l'utilisateur).

**Le tracé**, tel que la maquette le fait (`pipePath`, `pipePlan`, `assemble`, `rest`) :
1. **Le chemin** : recherche A*, avec +8 par virage comme Mindustry. Ctrl donne une ligne droite seule.
   - Un tuyau de l'autre type ne se traverse que tout droit et perpendiculairement, de même qu'un
     croisement.
   - Les machines bloquent le passage.
2. **Les ouvertures voulues** case par case : celles du chemin, plus celles vers les ports qui
   regardent les deux bouts.
3. **Un tuyau existant sur le chemin** :
   - du même type, traversé tout droit et perpendiculairement : un croisement ;
   - de l'autre type, traversé de même : le croisement objet × fluide ;
   - du même type, dans tout autre cas : il fusionne (coude, té ou croix) ;
   - de l'autre type, dans tout autre cas : le tracé est refusé.
4. **Les pièces** :
   - chaque case qui n'est pas droite reçoit le coude, le té ou la croix tourné comme il faut ;
   - les cases droites sont regroupées en morceaux, puis découpées du plus long au plus court (à
     longueur égale, la pièce la moins chère).
5. **Les cases restantes** d'une pièce remplacée ou coupée gardent leurs ouvertures et sont recomposées
   de la même façon. Cela vaut aussi pour la gomme et pour une pièce posée d'un clic.

## 5. Le calcul d'un montage libre

La maquette le fait déjà (`compute()`). Le moteur le refera proprement dans `src/engine/sandbox/`, pur et testé.
1. **Les raccords** : deux ports face à face, du même type, dont au moins un tuyau. Deux entrées ou deux
   sorties ne se raccordent jamais.
2. **Les réseaux** : des voies de tuyau reliées. Un croisement compte deux voies.
3. **Les recettes** : déduites de ce qui arrive. Le joueur choisit quand plusieurs vont, et son choix est
   gardé tant qu'il reste possible.
4. **Les débits** :
   - flot maximal dans chaque réseau ; chaque voie est coupée en deux pour porter la limite de sa pièce ;
   - les machines sont servies d'abord, puis les bouts ouverts, qui comptent comme sorties du montage ;
   - chaque machine tourne à une fraction f, recalculée jusqu'à l'équilibre ;
   - quand tout ne passe pas, toutes les sources ralentissent d'autant ;
   - la saturation se juge sur ce que les machines voudraient envoyer.

   Exemple 2 de la maquette : 5 Roller (Copper Wire, 1,5/s chacun) sur un tuyau de tier I (6/s).
   Les 5 tournent à 80 %, et les pièces après le 5e té sont hachurées.
5. **Le bilan** :
   - sorties et entrées du montage ;
   - énergie, pollution, prix (machines et pièces), place au sol, nombre de pièces ;
   - ce qui limite, avec la raison en mots de joueur.

   À ajouter (idées d'Industrialist Calculator, § 6) :
   - le **revenu** en $/s, d'après `sellValue` dans `items.json` ;
   - l'unité au choix : /s, /min, /h ou par cycle ;
   - un clic sur une ligne de « Ce qui limite » qui centre la vue sur la machine.

**Fluidité** (exigence de l'utilisateur) :
- le calcul est incrémental : seuls les réseaux touchés par un geste sont recalculés ;
- pendant un glisser, seul l'aperçu se redessine ;
- au-delà d'un seuil mesuré, le calcul part dans un worker ;
- objectif, vérifié par un test : **moins de 16 ms par geste à 200 machines et 2 000 cases**.

## 6. Industrialist Calculator (pages.dev, code MIT)

Site [industrialist-calculator.pages.dev](https://industrialist-calculator.pages.dev/), code sur
[github.com/Pollywrath/Industrialist-Production-Calculator](https://github.com/Pollywrath/Industrialist-Production-Calculator).
Je l'ai parcouru le 2026-10-26 : tutoriel Gearbox, aide complète, Compute, arbre de recherche, et la
structure du dépôt.

**Ce que c'est.**
- Un planificateur en **graphe**, pas un plan au sol : des nœuds de recettes reliés entre eux.
- Pixi ou React Flow pour le dessin, un optimiseur SCIP compilé en WebAssembly.
- Il complète le bac à sable plus qu'il ne le remplace. Son point fort, c'est l'ergonomie.

**Ce qu'on peut reprendre dans le bac à sable** :
- le tableau de bord : énergie consommée et produite, pollution nette, profit, coût, place, nombre de
  machines ;
- les listes « manques » et « surplus », dont chaque ligne centre la vue ;
- le choix de l'unité de débit ;
- **un clic sur une entrée ouvre la liste filtrée des producteurs, et le nouveau bloc se raccorde seul**.
  Dans le bac à sable : un clic sur un port libre ouvrirait la grille filtrée sur les machines qui le
  fournissent (lot B3) ;
- une vue compacte quand on dézoome ;
- une aide avec recherche et un tutoriel pas à pas ;
- des sauvegardes exportables.

**Pour le reste du site** (hors S17, à décider) :
- leur optimiseur (SCIP) serait une nouvelle dépendance : non, sauf accord ;
- leur arbre de recherche montre les RP dans le temps et un « Satellite buff » ;
- ils ont des réglages « mois courant » et « pollution globale » ;
- 54 recettes spéciales (chaudières et températures, turbines, ferme, moteur diesel…) sont à comparer
  avec nos modulaires ;
- leur gestionnaire de données se compare au wiki, comme notre page Contribuer.

**Règles** :
- La licence MIT permet de reprendre du code, en gardant leur notice.
- Leurs données sont la **deuxième source**, après Miraheze et avant Fandom (décision de l'utilisateur
  du 2026-10-26, PLAN-ACTION.md § 0, règle 3).

**Réponses du 2026-10-26** (`data/a-verifier.md`) :
- BAS-01 : catégories du menu Build (Pipes, Logic, Power, Decorations, Factories, Modular, Misc,
  Extractors, Tanks), dans l'ordre de la capture du tier I.
- BAS-03 : les infobulles des ports ; la maquette s'en sert, l'éditeur les structurera (S38).
- BAS-04 : Fluid Pipe2 fait 2 cases.
- BAS-05 : la jonction distribue sur ses sorties dans la limite de chaque pièce.
- BAS-06 : à intégrer avec la recherche (S40).

## 7. Les lots

Un lot par session, maquette d'abord quand l'écran change, feu vert entre deux lots.

| Lot | Contenu | Critère de fin |
| --- | --- | --- |
| **B1** Moteur du montage | `src/engine/sandbox/` pur : bâtiments, ports tournés, raccords face à face, voies et croisements, sens, flot avec limite par pièce, partage égal, recettes déduites, bilan, revenu. | Tests sur les trois exemples de la maquette : 30 Iron Coil/min et 15 Iron Ingot/min ; 5 Roller à 80 % et les pièces saturées ; croisement objet × fluide sans mélange. Plus : recette ambiguë → « ? », tuyau mélangé, pièce non relevée, deux entrées face à face. Toutes les valeurs viennent des fichiers du jeu. |
| **B2** Tracé des tuyaux | Chemin A*, assemblage des pièces, longueurs auto, croisements non rusty, pose par-dessus, coupe par la gomme. Pur et testé. | Tests : longueurs (20 cases de tier III = 5 Long Pipe2) ; coupe d'un Long Pipe2 en Pipe2 + Short Pipe2 ; té posé seul en arrivant sur un tuyau ; tracé refusé à travers une machine. |
| **B3** L'écran | Page Bac à sable / Sandbox ; menu de pose, grille, catégories, tiers, outils ; pose en ligne ; rotation ; clic droit ; zone ; ZQSD ; pipette ; cadre d'infos ; fiche « ? » ; statistiques ; Liaisons ; pastilles ; touches selon le clavier ; clic sur un port libre ; voie d'un croisement réglable. | Chaque ligne du § 3 faite une fois au navigateur, en FR et en EN ; Press + Roller en moins de 10 gestes ; contrastes et cibles comme en S33. |
| **B4** Fluidité | Calcul incrémental, aperçu seul pendant un glisser, worker, vue compacte. | Test : moins de 16 ms par geste à 200 machines et 2 000 cases ; aucune image perdue pendant un glisser. |
| **B5** Schémas et partage | F, Z / X, T, liste, code, fichier, lien ≤ 2 000 caractères, base de données, mini-carte. | Un schéma copié, enregistré, exporté puis réimporté redonne la même empreinte (test). |
| **B6** Téléphone | Tout MobileInput : appui long, 🔨, ⬚, ⟳, ✕, file d'attente avec ✓ (à décider), tiroir horizontal. | Parcours à 375 px : poser, tracer, supprimer une zone, copier. |
| **B7** Électricité et ponts | Poteaux et câbles (F5), énergie produite. Partir d'un plan calculé (module ou usine), le comparer au plan conseillé. | L'usine Crankshaft 60/min ouverte dans le bac à sable redonne ses chiffres. |
| **B8** Visite, aide, remarques | Visite guidée, aide avec recherche, montage joint aux remarques, anglais relu. | Parcours d'un nouveau venu en anglais, au clavier, comme S37. |
| **B9** Modulaires | Les ensembles modulaires (ferme d'arbres, moteur diesel, turbine) se posent pièce par pièce, comme en jeu. Le bac à sable reconnaît l'ensemble avec les règles de `modular.json` (faces obligatoires, chaîne, portée) et dessine la portée des arroseurs et des récolteurs. Il calcule la production avec `modular-calc.ts` : arbres servis, configuration relevée du moteur. Une pièce mal placée est signalée, avec la raison. | Une ferme posée à la main redonne les chiffres de `designFarm` ; un moteur à 6 cylindres redonne sa configuration relevée ; un arroseur hors de portée est signalé. |

B1 à B3 suffisent pour un premier usage. **B9** répond à la demande de l'utilisateur du 2026-10-26 de « mieux intégrer les modulaires » : aujourd'hui, le calculateur les traite à part. Dans le bac à sable, ce sont des pièces comme les autres.

**Portées (demande du 2026-10-26, B3 pour la règle, B7 et B9 pour les données)** : comme dans Mindustry,
la portée d'un bâtiment se dessine **pendant qu'on le place** (elle suit le curseur) et **quand on le
sélectionne une fois posé**. Cela vaut pour **tout bâtiment qui a une portée connue dans les données**,
sans liste écrite à la main. Le moteur rassemble toutes les portées du dépôt :
- `modular.json` : contrôleur, arroseur, récolteur et toute autre pièce modulaire ;
- `releves.json` → `poleRangeTiles` : les poteaux électriques ;
- les autres portées du wiki ou des relevés, au fur et à mesure.

Un bâtiment dont la portée manque est listé dans `data/a-verifier.md`. Les bâtiments dans la portée
sont mis en évidence.

**Ajouts du 2026-10-26 (B3)** :
- au survol d'un port, le cadre d'infos dit son rôle, son côté et son infobulle relevée ;
- chaque fiche « ? » mène à l'éditeur du bâtiment (« Modifier », ou « Compléter » quand les ports
  manquent).

La maquette le fait déjà. Les lots suivants s'ajoutent un par un.

## 8. Risques

- **Bâtiments posables** : 55 bâtiments sur 220, et 32 pièces de tuyau sur 43, ont leurs ports
  relevés. Les autres sont grisés. Le bac à sable vaut ce que valent les relevés.
- **Ports mal décrits** : tant que l'éditeur n'enregistre pas les objets de chaque port (S38), le
  calcul lit le nom des objets dans l'infobulle ; sans infobulle, il répartit dans l'ordre et le marque
  « à vérifier ». Le bac à sable devrait venir après S38.
- **Performance** : traitée en B4, avec des mesures. C'est le risque principal au téléphone.
- **Quantité de code** : la maquette fait environ 930 lignes. Le moteur sera séparé de l'écran et testé
  à part (B1, B2).
- **Valeurs corrigées** : la maquette lit les recettes du wiki sans `overrides.json`. Le moteur passera
  par `buildGameData`, comme le calculateur.

## 9. Retours sur la 2e maquette (2026-10-27), à traiter plus tard

1. Liaisons : relier les ports entre eux (pas les machines), comme dans Industrialist, avec le geste de
   Mindustry. Cela vaut pour les poteaux électriques et logiques. Chaque port porte un flux, et tout ce qui
   est relevé dans l'éditeur doit servir dans le bac à sable.
2. Montrer tous les ports, y compris sur les tuyaux et les ports électriques.
3. L'aperçu des tuyaux ne distingue pas deux pièces de même taille : y dessiner les ports.
4. Supprimer le tier « ∗ ». Les tuyaux spéciaux vont en T3 (Cold Bypass compris) et les « Large … »
   en T4, dans la catégorie Pipes. Les ports des grands tuyaux fluides sont à créer, dans l'éditeur
   comme dans le bac à sable : les relevés les notent seulement « 1/2 » et « 2/2 ».
5. Assignation des touches, sur un clavier visuel, inspirée du mod « Keybind Atlas » (pas prioritaire).
6. F (copier une zone) : ajouter « enregistrer la sélection dans un schéma » et l'afficher dans les
   indications du bas.

### État au 2026-10-31 : faits dans la maquette

1. **Câbles** : on clique sur un bâtiment à prises (poteau, générateur, machine), puis sur un autre, pour
   poser ou retirer un câble, comme un nœud électrique de Mindustry. Le câble relie les deux prises
   compatibles les plus proches. Un câble électrique doit tenir dans la portée d'un poteau (relevés et
   `power.json`, 1 tile = 2 cases), qui se dessine pendant la pose et à la sélection, avec les bâtiments
   couverts. Les statistiques donnent chaque réseau (consommation, production du wiki au plus) et les
   machines sans courant. Les câbles logiques fonctionnent de même, mais leur portée n'est pas connue.
   F5 masque les câbles. À confirmer en jeu : nombre de câbles par prise, tension (LV, MV, HV).
2. **Tous les ports se voient** : objet, fluide, électrique (carré à éclair), logique (losange). Pour
   les tuyaux aussi. Les pièces spéciales gardent le sens relevé. Le survol d'une prise la décrit.
3. **Aperçu des tuyaux** : les ports sont dessinés, donc deux pièces de même taille se distinguent.
4. **Tier « ∗ » supprimé** : tuyaux spéciaux en T3, « Large … » en T4. Les ports des grands tuyaux sont
   déduits des notes « 1/2 » et « 2/2 » des relevés : un seul port de 2 cases, qui ne se raccorde qu'à
   un port de 2 cases. Reste à faire dans l'éditeur de bâtiments (un vrai champ « largeur »).
5. **Touches réassignables** sur un clavier visuel (bouton Touches) : groupes en couleur, conflits en
   rouge, « Changer » puis une touche (au clavier ou sur le dessin), retour aux touches par défaut.
   L'enregistrement se fait dans le navigateur.
6. **F** : après la copie, une barre propose de l'enregistrer en schéma (nom, E ou Entrée), de la
   tourner, de la retourner ou de l'annuler. Les indications du bas l'affichent.

### Retours du 2026-10-31 : état (travail interrompu par la limite d'usage)

Faits dans la maquette :
- 2 : portée des pièces modulaires (modular.json, depuis le bord), avec les blocs desservis encadrés ;
- 7 : alertes du même type regroupées (« 5 × … ») ;
- 9 (calcul) : un flux par prise, des câbles orientés, une capacité par prise (transfer) ;
- 12 (calcul) : « continuer sans courant » (réglage `SET.runWithoutPower`) ;
- 10 : nombre de câbles illimité par prise.

Reste à faire :
- 1 : touches (légende des couleurs, conflits dans la liste, « Défaut », « Aucune » par Échap, clic sur une touche → choisir l'action, surbrillance des conflits ; « Toutes les commandes » reste pour la maquette) ;
- 3 et 11 : relever la catégorie et la portée logique dans l'éditeur de bâtiments (code du site, lot à créer) ;
- 4 : retour vers la base de données depuis une fiche ;
- 5 : statistiques redimensionnables ;
- 6 et 12 : fenêtre « Réglages » (masquer les catégories vides d'un tier, continuer sans courant) ;
- 8 : encadré rouge des bâtiments à supprimer (clic droit, zone) ;
- 9 (gestes) : liaison machine ↔ poteau sur les deux prises, poteau ↔ poteau nœud à nœud dans le bon sens, re-clic sur un poteau = tout relier selon (1,0)/(0,1), jamais (1,1) ni (0,0) ; flèches de sens sur les câbles. La pose des câbles utilise encore l'ancienne règle (prise la plus proche).

### Retours du 2026-10-31 : tous faits dans la maquette (suite le même jour)

- 1 : fenêtre des touches. Légende des groupes de couleur ; conflits en rouge dans la liste (« aussi : … ») ;
  boutons « Défaut » et « Aucune » sur chaque ligne ; Échap pendant « Changer » retire la touche ; clic sur une
  touche du dessin pour choisir son action, ce qui met aussi en évidence les actions en conflit. « Toutes les
  commandes » reste une aide de la maquette.
- 4 : « Retour » depuis une fiche ouverte dans la base de données revient à la base.
- 5 : statistiques repliables (clic sur le titre) et redimensionnables (poignée en bas à droite).
- 6 et 12 : fenêtre « Réglages » : masquer les catégories vides d'un tier ; continuer le calcul sans courant
  (décoché : la machine ralentit ou s'arrête).
- 8 : clic droit maintenu ou zone de suppression : ce qui sera supprimé est encadré en rouge.
- 9 : machine ↔ poteau sur les deux prises du poteau ; générateur → poteau ; poteau ↔ poteau prise à prise,
  du poteau alimenté vers l'autre ; re-clic sur un poteau sélectionné : tout relier dans sa portée selon (1,0)
  et (0,1), jamais (1,1) ni (0,0) ; une flèche au milieu de chaque câble montre son sens.

Restent pour l'éditeur de bâtiments (code du site, lot à créer) : relever la catégorie d'un bâtiment (3) et la
portée des câbles logiques (11).

### Règle du réservoir de la ferme (utilisateur, 2026-10-31) : à faire en B9

Le réservoir d'eau (Tree Farm Water Tank) compte dans la portée du contrôleur. Un arroseur fonctionne quand
le réservoir et l'arroseur sont tous deux dans la portée du contrôleur, et que le réservoir est alimenté en eau.
La distance entre le réservoir et l'arroseur ne compte pas : c'est la portée « infinie » de `modular.json`.
Quand le réservoir est sélectionné, le bac à sable montrera :
- le cercle du ou des contrôleurs qui le couvrent ;
- les arroseurs qu'il alimente à travers eux, encadrés ;
- une alerte s'il n'est dans la portée d'aucun contrôleur, ou s'il n'est pas alimenté.
