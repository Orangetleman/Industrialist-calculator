# Plan d'extension et de refonte — Calculateur Industrialist

> Statut : **validé le 2026-10-12** (décisions en § 8). E0 terminée (données, relevés en jeu,
> éditeur de bâtiments, 16 bâtiments relevés) ; E1 (moteur v2 et simplexe), E2 (énergie) et E3
> (points de recherche) terminées ; bilans en § 4. Refonte de l'interface faite (REFONTE.md) ;
> E4a (plans de pose, première version) en ligne, en attente des réponses aux questions du bilan.
> Rédigé le 2026-10-12 après une lecture du wiki Miraheze (pages Pipes, Research Station1 à 4,
> Satellite Dish Controller, RP Making, Weather & Time, Steam, Logic, Truck Depot, et les fiches
> des 264 bâtiments déjà en cache).

## 0. En bref

L'outil ne calcule aujourd'hui que des **objets**. L'extension ajoute trois choses :

1. **Énergie** : produire X MF/s de la façon la plus optimisée, avec une option « pollution
   minimale » (renouvelables, épurateurs) ou non (centrales thermiques, moteurs diesel…).
2. **Points de recherche (RP)** : atteindre X RP/s, ou débloquer une recherche en un temps donné,
   en choisissant les stations, les items à y mettre, les paraboles satellites et le mini-jeu Logic.
3. **Plans de construction** au sens littéral : une grille vue de dessus, en 2D, qui dessine pour
   chaque étape de production un **module** posable en jeu (machines, tuyaux, poteaux, logique),
   avec ses propriétés (débits, capacités, énergie, pollution, coût, liste des pièces), en
   utilisant **tous les outils de l'onglet Utility** du jeu.

Elle s'accompagne d'une **refonte de l'interface**, organisée par objectif (« que veux-tu
produire ? ») plutôt que par fonction.

Le principe ne change pas : **aucune valeur inventée**. Ce que les wikis ne donnent pas est
signalé, et peut être relevé en jeu puis saisi dans l'outil.

## 1. Ce que les wikis permettent, et ce qui manque

| Domaine | Disponible (Miraheze) | Manque ou à confirmer |
| --- | --- | --- |
| **Générateurs** | Puissance produite de chaque générateur, souvent en plage : Solar Panel 120–240 MF/s, Solar Panel3 0–29,7 kMF/s, Wind Turbine3 10,4–68,7 kMF/s, Coal Generator 7 kMF/s, Compact Coal Power Plant 13,5 kMF/s, Diesel Generator 55,2–90 kMF/s, Large Diesel Engine 5–6 MMF/s, Large Turbine 1–515 kMF/s, Turbine Generator jusqu'à 550 MMF/s. Recettes de combustible (Diesel Generator 0,1 L/5 s…). Pollution de chaque bâtiment. | La **relation exacte température de vapeur → puissance** des turbines n'est pas donnée : seulement « plus la vapeur est chaude, plus ça produit » et quelques points (Firebox : eau à 240 °, vapeur vers 190 à 215 ° ; Geothermal Well : 220 ° maximum). À relever en jeu (un petit tableau suffit) ou à garder comme hypothèse signalée. |
| **Météo et heure** | Journée d'environ 16 min, soleil de 6 h à 17 h ; orages plus fréquents avec la pollution (panneaux solaires inutiles, vent au maximum). | Courbe exacte du solaire dans la journée et loi du vent : on calculera une moyenne prudente et une puissance garantie, en le signalant. |
| **Transport d'énergie** | Débit et capacité de chaque poteau (LV 2,4 kMF/s × 2 nœuds, MV 30 kMF/s × 2, Advanced MV 37,5 kMF/s × 4, HMVT 1,5 MMF/s × 4, HV 120 MMF/s × 8), de chaque batterie, des disjoncteurs, Power Control, transformateur HV. Portée : LV 10 tuiles, Advanced MV 8, HMVT 22, HV ≈ 70. Règle des couleurs de nœuds. | Relevé en jeu : LV, MV, Small MV et Advanced MV 10,5 tuiles, HMVT 22 (data/releves.json). |
| **Vapeur** | 3 L d'eau → 90 L de vapeur ; Large Turbine : 90 L/s de vapeur à plein régime ; perte d'environ 0,01 ° par raccord ; les silos conservent la chaleur. | — |
| **Tuyaux (Utility)** | Tableaux complets : tier I (6 unités/s, 6 L/s), tier III (120 unités/s, 120 L/s ; 2×2, 4×2, 8×2 studs), tier IV fluides (12 000 L/s), intersections, Item Overflow Gate, Overflow Gate, Item Valve Control, Valve Control, Cold Bypass Pipe, Pipe Valve, Large Fluid Pipe Conversion (alimentée), Large Fluid Valve Control, compteurs (passe du jeu). Prix et dimensions de chacun. « Un tuyau se raccorde à une entrée ou une sortie s'il la touche. » | Unité de la grille de construction : les tuyaux sont décrits en **studs**, la portée des poteaux en **tuiles**, et les tailles des machines sans unité. À confirmer en jeu (question Q1). |
| **Ports des machines** | Pour 21 machines sur 100, une phrase situe les entrées et sorties (« à l'avant, à côté de la prise d'énergie », « entrée gauche : Machine Oil »). | **Position exacte et sens des ports** : absente des wikis. C'est la donnée clé des plans de construction (question Q2). |
| **Stockage et vente** | Silos (tailles) ; Truck Depot : 10 objets, vente toutes les 15 s, soit environ 0,66 objet/s ; Van et Huge Truck Depot. Prix de vente de chaque item. | Capacité des silos : à vérifier. |
| **Logique** | 1 tick logique = 1/6 s par porte ; portes AND, OR, NOT, NAND, NOR, XOR, mémoire, horloge, relais, délai, impulsion, aléatoire ; Item Meter et Fluid Meter ; vannes logiques pour items et fluides ; Pollution Gate et Time Gate ; énergie et taille de chaque composant. | Signaux exacts fournis par les compteurs (seuils, unités) : à préciser au moment de concevoir les gabarits logiques. |
| **RP** | **Formules** : RS1 RP/s = √n et plafond 200·log₂(n+1). RS2 RP/s = 2·n^0,6 (n = somme des valeurs de recherche des items reçus) et plafond 2000·log₂(m+1). RS3 : même vitesse avec une pénalité de 30 %, 2 items différents, plafond 16 500·(log₂(C+1)+√C), où le facteur C dépend du prix de vente. RS4 : remplace le plafond de la RS3, mini-jeu Logic qui double le facteur. Paraboles : bonus B × 0,78·log(R+1) et nombre de paraboles ⌈S + √(S·R)⌉. Plafond souple : RP/s × 10^(1−x). Valeur de recherche (RPx) de chaque item : déjà dans `items.json`. | Détail de la pénalité de 30 % de la RS3 et du « bonus non mentionné » du mini-jeu : à relire sur la page et, si besoin, à vérifier en jeu. |
| **Pollution** | Pollution de chaque machine (%/h). Scrubber : jusqu'à 6,48 %/h retirés avec de l'eau distillée (l'eau filtrée retire 10 % de plus que l'eau normale, la distillée 90 % de plus), en produisant du Residue. Liquid Burner, Exhaust Stack. | — |

**Conséquence.** L'énergie et les RP peuvent être calculés presque entièrement à partir des
wikis. Pour les plans de construction, il faut d'abord **confirmer l'unité de la grille** et
**relever les ports des machines**. Je propose un éditeur de ports dans l'outil (§ 4, phase E4),
alimenté au fur et à mesure, en commençant par les machines que tu utilises.

## 2. Principes

- **Inchangés** :
  - aucune valeur inventée ;
  - ce qui manque ou se contredit est signalé et corrigeable dans l'outil, puis exportable ;
  - le moteur est en TypeScript pur, testé et sans dépendance à l'interface ;
  - pas de dépendance nouvelle sans ton accord.
- **Nouveau** : les **relevés en jeu** deviennent une source à part entière, comme la description
  des recherches. Ports des machines, unité de la grille, tableau température → puissance : tout
  est saisi dans l'outil, daté, exportable, et fusionné dans `data/overrides.json`.
- **Nouveau** : le moteur traite des **ressources** et plus seulement des objets. Objets, énergie
  (MF/s), RP/s, pollution (%/h) et, en option, argent ($/s) sont des flux comme les autres, avec
  des producteurs, des consommateurs et des contraintes.

## 3. Architecture cible

```
data/
  logistics.json         tuyaux, vannes, intersections, silos, dépôts (tableaux de la page Pipes…)
  power.json             générateurs (plages), poteaux (débit, capacité, portée, nœuds), batteries…
  research-stations.json paramètres des formules RS1 à RS4, paraboles, plafond souple (sourcés)
  world.json             durée du jour, lever et coucher du soleil, règles de la vapeur
  ports.json             ports des machines (relevés en jeu ; vide au départ)
src/engine/
  resources.ts           objets, énergie, RP, pollution, argent : un modèle de flux commun
  lp.ts                  programmation linéaire (simplexe écrit à la main, sans dépendance)
  power.ts               centrales, renouvelables, stockage, distribution
  research-points.ts     stations, items, paraboles, plafonds, temps pour débloquer
src/layout/              plans de construction (pur, testable)
  grid.ts                grille, empreintes, rotations, collisions
  catalog.ts             pièces Utility (tuyaux, vannes, poteaux, logique) avec leurs règles
  module.ts              générateur de module par étape de production
  route.ts               routage des tuyaux et des câbles (A* sur la grille)
  check.ts               vérifications : débits, capacités, ports raccordés, portées
src/ui/                  refonte (§ 4, phase E5)
```

**Pourquoi la programmation linéaire maintenant.** Avec l'énergie, les boucles deviennent la
règle : une centrale brûle du charbon extrait par des foreuses qu'elle alimente. Les sous-produits
deviennent utiles (eau de refroidissement, vapeur), et la pollution devient une contrainte
(« pas plus de X %/h »). Le choix par heuristique, suffisant pour les objets, ne sait pas gérer ça
proprement.

Je propose un **simplexe écrit à la main** (environ 300 lignes, sans dépendance), testé sur des
cas connus. Le choix actuel des recettes reste en place pour expliquer le résultat, et sert de
repli. Tous les tests de non-régression actuels doivent continuer à passer : 52,33/min, 111
machines, etc.

## 4. Phases

Chaque phase se termine comme les précédentes : tests verts, résumé, commit, mise en ligne sur le
Pi, puis j'attends ton feu vert.

### E0 — Données de l'extension

- **Récupération** : `fetch-wiki` lit en plus Pipes, Research Station1 à 4, Satellite Dish (et son
  contrôleur), RP Making, Weather & Time, Steam, Logic, les dépôts et les silos. Même politesse et
  même cache qu'aujourd'hui.
- **Construction des données** : `build-data` lit les tableaux de la page Pipes (prix, capacité,
  débit, dimensions) et les infobox de l'énergie (plages de puissance, débit et capacité par
  nœud, portée). Les paramètres des formules RP sont extraits avec la même méthode stricte que la
  formule des arbres : si la forme change, l'outil le dit au lieu de deviner.
- **Nouveaux fichiers** : `logistics.json`, `power.json`, `research-stations.json`,
  `world.json`, et le schéma de `ports.json`.
- **`a-verifier.md`** gagne des sections énergie, logistique et RP.
- **Ta part** : une vérification en jeu de l'unité de la grille, qui prend quelques minutes
  (question Q1).
- **Tests** : lecture des tableaux, cohérence des unités, présence d'une source pour chaque valeur.

### E1 — Moteur v2 : ressources et programmation linéaire

- **Modèle de flux commun** : objets, énergie, RP, pollution et argent. Un générateur « produit »
  des MF/s, un épurateur « produit » de la pollution négative et du Residue, une station
  « produit » des RP/s.
- **Simplexe** :
  - **objectifs** : moins de machines, d'énergie, de matières, d'étapes, de pollution, de coût en $ ;
  - **contraintes** : recherches débloquées, machines possédées, pollution maximale, budget.
  - Le **choix** des recettes vient du simplexe. Le **nombre de machines** reste un arrondi
    explicable, étape par étape, comme aujourd'hui.
- **Sous-produits réutilisés** quand c'est rentable : la limite actuelle des surplus disparaît.
- **Tests** : tous les cas actuels, plus les boucles énergie ↔ combustible, la réutilisation
  d'un sous-produit et une contrainte de pollution.

**Bilan E1 (2026-10-12, fait).**

- **Simplexe** (`lp.ts`) :
  - deux phases, règle de Dantzig avec repli sur celle de Bland, test du ratio de Harris ;
  - perturbation des seconds membres : les bilans à zéro rendent le problème très dégénéré, et
    sans elle le simplexe piétinait (50 000 pivots). La solution est relue avec les seconds
    membres d'origine, donc exacte ;
  - niveaux de priorité exacts (lexicographique sur le même tableau) : manques, critère, surface
    au sol, puis les autres critères, comme les départages du moteur v1 ;
  - 5 à 110 ms par calcul.
- **Machines entières** : le simplexe minimise des machines fractionnaires. Pour « machines »,
  « prix » et « pollution », trois solutions sont comparées sur le total arrondi : la solution
  exacte, des variantes sans les recettes à moins d'une machine, et le choix de l'heuristique
  v1. Sur les 204 items, à mesure égale, le moteur v2 n'est jamais moins bon que le v1 :
  meilleur sur 106 (machines), 63 (énergie) et 92 (matières premières).
- **Définitions** :
  - matières premières = tout ce que sortent les extracteurs, sous-produits compris ;
  - énergie = consommation des machines ; la production des générateurs est affichée à part ;
  - la limite de pollution porte sur les machines exactes, et un avertissement signale le
    dépassement une fois les machines arrondies.
- **Boucles rentables** : un sous-produit qui remonte la chaîne est réutilisé. Le graphe trace
  ces arcs de retour en pointillés, dans un couloir à droite.
- **Argent** : objets solides seulement (la capacité des dépôts de liquides est inconnue) ;
  dépôts de logistics.json ; le plan dit quel dépôt débloquer s'il n'y en a aucun.
- **Paliers ronds** (`tiers.ts`) : le meilleur palier par tranche (¼–½, ½–1, 1–2, 2–4, 4–10 fois
  le débit) ; un clic l'adopte (en « machines finales » quand le nombre est entier).
- **Reporté à E2** : ce que retire un Scrubber n'est pas une valeur structurée du wiki
  (« dépend de l'entrée ») ; la pollution négative attendra l'extraction de cette page.

### E2 — Énergie

- **Objectif** : X MF/s, en **moyenne** ou en **puissance garantie** (nuit et absence de vent
  comprises).
- **Options** :
  - pollution minimale, ou pas de contrainte ;
  - coût de construction minimal, surface minimale, sans combustible ;
  - seulement ce qui est débloqué.
- **Filières comparées** :
  - générateurs à combustible (charbon, diesel, essence, gros moteur diesel, moteur diesel
    modulaire) avec leur chaîne de combustible complète (le moteur actuel la calcule déjà) ;
  - thermique : Firebox, Gas Burner, Geothermal Well ou Electric Water Heater, puis Boiler, puis
    Large Turbine ou Steam Turbine, avec le ratio eau/vapeur et la perte de chaleur par raccord ;
  - renouvelables : solaire et éolien, avec le profil jour/nuit et les orages, et le
    **dimensionnement des batteries** pour la puissance garantie ;
  - grandes centrales (Coal Power Plant, turbines modulaires, nucléaire) : signalées, puis
    calculées si les données suffisent.
- **Pollution** : bilan de l'installation. Avec l'option « pollution minimale », le moteur ajoute
  des **Scrubbers** (avec le type d'eau le plus efficace) et gère leur Residue : vente, stockage
  ou brûlage, selon ce que tu acceptes.
- **Distribution** : nombre et type de poteaux selon le débit (capacité par nœud) et la distance
  (portée), disjoncteurs, Power Control, transformateur HV, en respectant la règle des couleurs
  de nœuds.
- **Résultat** :
  - la centrale (machines, combustible par minute) ;
  - la chaîne du combustible ;
  - le réseau (poteaux, batteries) ;
  - le bilan de pollution et le coût.
- **Tests** : cas calculés à la main (charbon, Firebox → Boiler → turbines, solaire avec
  batteries), puis contrainte de pollution respectée.

**Bilan E2 (2026-10-12, fait).**

- **`data/energy.json`** (généré par `build-extension`, faits extraits avec leur citation) :
  installations complètes, traitées par le moteur comme des recettes « composées » :
  - **Firebox + 2 Boilers + 2 Large Turbines** : vapeur vers 190 °C d'après le wiki, d'où
    639,7 kMF/s pour 1 charbon/s (courbe des turbines) ; signalé « approximatif » ;
  - **Gas Burner + 10 Boilers + 10 Large Turbines** : 4,5 MMF/s, la borne basse du wiki ;
  - **Solar Panel** : moyenne exacte de 183,75 MF/s (tableau heure par heure), et variantes
    **avec stockage de nuit**, une par type de batterie (24 750 MF et 63,75 MF/s par panneau) ;
  - **éoliennes** : production minimale, garantie (« le vent n'est jamais nul ») ;
  - **Scrubbers** : −3,24 / −3,57 / −6,29 %/h selon l'eau, +6,48 %/h pour la recette au Residue.
- **Non calculés, faute de données** (listés dans l'outil) :
  - Industrial Firebox et Geothermal Well : température de la vapeur inconnue ;
  - Solar Panel2, Solar Panel3 et Solar Farm : pas de profil horaire ;
  - Steam Turbine : pas de courbe ;
  - grandes centrales modulaires.

  Un relevé de température de vapeur dans `releves.json` (`steamTempC`) les active.
- **Moteur** : objectif « X MF/s nets », en moyenne ou en **puissance garantie** ; option « sans
  combustible » ; critère « moins de place au sol ». Les générateurs à combustible et leur
  chaîne viennent des recettes existantes. Avec « moins de pollution », les Scrubbers ramènent la
  pollution à zéro, sans aller au-delà.
- **Réseau** : nombre de lignes par type de poteau (débit par nœud), et nombre de poteaux si une
  distance est donnée. C'est indicatif : la règle des couleurs de nœuds et le tracé viendront en E4.
- **Effet sur E1** : l'option « produire ma propre énergie » profite des centrales thermiques.

### E3 — Points de recherche (RP)

- **Objectifs** :
  - « X RP/s » ;
  - « débloquer telle recherche le plus vite possible » ;
  - « débloquer tout ce qui manque à mon plan ».
- **Stations** : RS1 à RS4 selon ta progression, avec les formules du wiki :
  - vitesse, plafond et plafond souple, ce qui donne une vitesse réelle qui baisse à l'approche
    du plafond ;
  - deux items différents pour la RS3 ;
  - facteur de plafond selon le prix de vente ;
  - RS4 accrochée à une RS3, mini-jeu Logic proposé en option.
- **Choix des items** : le meilleur rapport valeur de recherche / coût de production, parmi ce
  que tu sais produire. La chaîne de production des items est calculée par le moteur.
- **Paraboles satellites** : nombre de contrôleurs et de paraboles pour 100 % d'efficacité, le
  liquide à fournir, et l'énergie (75 kMF/s par contrôleur).
- **Lien avec l'arbre** : chemin de recherches restant, total de RP, et temps estimé à ton rythme
  actuel puis avec l'installation proposée.
- **Résultat** : l'installation RP (stations, items par seconde, paraboles), sa chaîne de
  production, son énergie, et la courbe du temps pour débloquer.
- **Tests** : chaque formule contre les exemples et tableaux du wiki (par exemple 13 RS1 donnent
  un plafond de 761 RP) ; plafond souple ; nombre de paraboles.

**Bilan E3 (2026-10-12, fait).**

- **Formules** (`src/engine/research-points.ts`, paramètres sourcés dans `research-stations.json`) :
  vitesse et plafond des RS1 à RS4, facteur de plafond selon le prix, pénalité de 30 %, circuits
  du mini-jeu Logic (5 ticks par résolution d'après le wiki), paraboles, plafond souple.
  Vérifiées contre le wiki :
  - 13 RS1 → 761 ;
  - tableau des plafonds RS2 ;
  - 2,45 et 3,03 RP/s pour la RS3 ;
  - 6 paraboles et 17 % par parabole.
- **Consommations** (infobox) : RS1 2,1 kMF/s, RS2 17 kMF/s, RS3 600 kMF/s, paire RS3 + RS4
  5 MMF/s, contrôleur et parabole 75 kMF/s.
- **Installation** : toutes les stations débloquées, les items productibles (RS2) et les paires
  d'items (RS3/RS4), avec 0 à 4 contrôleurs de paraboles et le meilleur liquide. Un premier tri
  estime le coût de la chaîne au simplexe, à l'unité ; les 6 meilleures sont ensuite calculées
  exactement, chaîne comprise. Pour cela, `solve` accepte maintenant plusieurs cibles à la fois
  et une charge électrique fixe.
- **Objectifs** :
  - « X RP/s » (plafond automatique : la recherche la plus chère qu'il te reste) ;
  - « débloquer telle recherche en N minutes » ;
  - « débloquer ce qui manque à mon plan d'objet ».

  La chronologie de déblocage tient compte de la dépense de chaque recherche et du plafond
  souple ; elle est comparée au rythme actuel.
- **À confirmer en jeu** :
  - la base du logarithme des paraboles (« log » : décimal retenu) ;
  - les RP/s de plusieurs types de stations s'additionnent-ils (l'outil propose un seul type
    à la fois) ?

### E4 — Plans de construction (grille vue de dessus)

C'est la partie la plus ambitieuse. Elle se fait en deux temps : un module par étape (E4a), puis
l'usine assemblée (E4b).

**Modèle de grille :**
- Cases dans l'unité confirmée à l'étape E0.
- Chaque élément a une **empreinte** (taille du wiki), **4 orientations**, et des **ports typés**
  (objet, fluide, énergie, logique) placés sur ses bords.
- Les ports viennent de `ports.json`. Une machine sans ports relevés est dessinée avec des ports
  « supposés » : à l'avant ou à l'arrière selon la phrase du wiki quand elle existe, sinon au
  milieu des bords. Elle est alors marquée **à vérifier**, et le plan le dit.

**Catalogue Utility complet (`catalog.ts`)**, chaque pièce avec sa taille, son prix, son débit et
sa capacité :
- **tuyaux** :
  - objets et fluides, tiers I, III et IV ;
  - pièces courtes, coudes, jonctions, sections ;
  - longueurs 2, 4 et 8 ;
- **intersections** : objet, fluide, mixte ;
- **répartition et sécurité** :
  - Item Overflow Gate et Overflow Gate (surplus) ;
  - Item Valve Control et Valve Control (dosage, équilibrage) ;
  - Pipe Valve (aiguillage), Cold Bypass Pipe (vapeur trop froide) ;
  - conversion vers les gros tuyaux, Large Fluid Valve Control ;
  - compteurs de débit (passe du jeu, désactivés par défaut) ;
- **stockage et vente** : silos objets et fluides, Truck, Van et Huge Truck Depot, Liquid Truck
  Depot, Liquid Burner pour se débarrasser d'un fluide ;
- **énergie** : poteaux LV, MV, Small MV, Advanced MV, HMVT, HV, couleurs de nœuds, Breaker,
  Breaker Box, Power Control, Power Dump, batteries ;
- **logique** : portes, mémoire, horloge, relais, délai, impulsion, Item Meter, Fluid Meter,
  vannes logiques, Pollution Gate, Time Gate, Logic Pole et Logic Knot.

**Générateur de module (`module.ts`)**, pour une étape « N × machine, entrées et sorties en /min » :
1. **Disposition** : plusieurs gabarits éprouvés sont essayés (une rangée ; deux rangées dos à
   dos avec un collecteur central ; un peigne). On garde le meilleur selon le critère choisi :
   surface, nombre de pièces, coût, ou longueur de tuyaux.
2. **Alimentation des entrées** : un collecteur par ingrédient, avec des jonctions vers chaque
   machine. Le **tier de tuyau** et le **nombre de lignes en parallèle** sont choisis selon le
   débit, par exemple 6 ou 120 unités/s par ligne. Une Valve Control équilibre si nécessaire.
3. **Sorties** : un collecteur ; les **sous-produits** partent sur une ligne séparée vers un silo,
   un dépôt ou un brûleur ; une **Overflow Gate** envoie le surplus vers le stockage au lieu de
   bloquer la ligne.
4. **Énergie** : poteaux placés pour couvrir chaque prise selon leur portée, avec la capacité
   par nœud vérifiée, des disjoncteurs si besoin, et la règle des couleurs.
5. **Logique, en option** : arrêt automatique quand le stock est plein (Item Meter → vanne
   logique), comptage, alternance selon l'heure (Time Gate) pour les installations solaires.
6. **Routage** : les tuyaux et câbles suivent un A* sur la grille, qui pénalise les coudes et les
   croisements et utilise les intersections du jeu quand deux lignes doivent se croiser.
7. **Vérifications (`check.ts`)** : aucun chevauchement, chaque port raccordé, débits sous les
   capacités, énergie sous les capacités des nœuds, portées respectées. Chaque problème est
   affiché sur le plan.

**Propriétés affichées pour chaque module :**
- machines et utilisation ;
- débit par port et par tuyau, en pourcentage de sa capacité ;
- énergie (moyenne et pic) ;
- pollution ;
- surface au sol ;
- **coût total en $** (machines, tuyaux, poteaux, logique) ;
- **liste des pièces** ;
- **ordre de pose**, étape par étape.

**Rendu :**
- SVG vue de dessus, avec le même déplacement et le même zoom que l'arbre de recherche.
- Calques activables : machines, objets, fluides, énergie, logique.
- Couleur par ressource et légende ; survol pour lire les débits.
- Export SVG, PNG et JSON.

**Éditeur de ports** : une machine sur sa grille ; tu cliques sur un bord pour poser une entrée ou
une sortie (type, ressource si elle est imposée). C'est enregistré comme relevé en jeu, et
exportable.

**E4b — Usine assemblée** : les modules d'une chaîne se raccordent par leurs ports de module,
avec un bus principal et un placement ordonné de la matière première vers le produit final. La
vue d'ensemble montre les longueurs de tuyaux entre modules et le réseau électrique global.

**Limite à connaître** : trouver *la* disposition optimale est un problème combinatoire très dur.
L'outil combine des gabarits éprouvés, un routage optimal à disposition donnée et une recherche
locale (déplacer et pivoter, puis garder si c'est mieux). Les plans seront bons et valides, sans
garantie d'être les meilleurs possibles. C'est la limite de l'automatisation dont tu parlais.

**Tests** : collisions, rotations, débits contre capacités, portée des poteaux, routage sur des
cas simples, et un module complet de non-régression (par exemple 15 Craft Assemblers).

**Bilan E4a, première version (2026-10-12).** Onglet « Plans de pose » du résultat : un module
par étape, au choix dans la liste.

- **Grille** (`src/engine/build/geometry.ts`) : une case = un Short Pipe ; bâtiments pivotés par
  quarts de tour avec leurs ports relevés (`ports.json`) et leurs plots ; prise sur le dessus.
- **Pièces** (`catalog.ts`) : tuyaux d'objets et de fluides tier I et III (droit, coude,
  embranchements), croisements d'une case, poteaux LV à HMVT ; le tuyau le moins cher qui porte
  le débit.
- **Module** (`module.ts`, `route.ts`) : une rangée, ou deux rangées dos à dos autour d'un
  collecteur central, dans les 4 orientations ; un collecteur droit par ressource (entrées par la
  gauche, sorties par la droite) ; chaque port raccordé par un A* qui croise les autres
  collecteurs à angle droit ; poteaux en files au-dessus et au-dessous, à portée de chaque prise.
  On garde le module le plus compact, puis le moins cher.
- **Affichage** : vue de dessus navigable (glisser, molette), couleur par ressource, croisements
  et poteaux, liste des pièces avec les prix, ordre de pose, hypothèses.
- **Mesures** (chaîne du Crankshaft, 60/min) : 10 modules en 4 à 350 ms ; 15 Craft Assemblers en
  double rangée de 66 × 19 cases, 184 k$, dont 168 k$ pour 42 croisements (inévitables : trois
  ressources entrelacées sur un même côté).
- **Tests** : rotations, ports du Craft Assembler, routage (croisement, obstacle), et sur 5 étapes
  réelles : aucun chevauchement, chaque port raccordé, chaque liaison réciproque, pièces comptées.

Réponses de l'utilisateur (2026-10-13), intégrées :
1. « Junction » = embranchement à 3 voies, « Section » = 4 voies.
2. Un croisement de tier III se raccorde aux tuyaux de tier I. Ajouté : option « Seulement des
   tuyaux de tier III ». Au-delà de 120/s, plusieurs collecteurs en parallèle ; le gros tuyau de
   tier IV (fluides, 12 000 L/s) servira à amener le fluide jusqu'au module (usine assemblée).
3. Portée des poteaux : 1 tuile = 2 cases (Short Pipes) ; 10,5 tuiles = 21 cases
   (`releves.json`, `grid.tileCells`). La distance de l'objectif énergie se saisit en cases.
4. Pas de limite de câbles par nœud : la limite est la puissance que porte le poteau. Une file de
   poteaux, alimentée par un bout, prend le poteau le moins cher qui porte toute sa consommation.
5. Un collecteur répartit bien les objets entre les machines qu'il longe.

À confirmer (captures du 2026-10-13) : on peut relier directement deux ports, y compris une
entrée à une autre entrée, et les liaisons se croisent sans pièce de croisement. Questions :
quelle longueur maximale pour une liaison directe ? Une entrée reliée à une autre entrée fait-elle
passer les objets à la machine suivante (chaînage) ? Les objets arrivés par « la mauvaise »
entrée vont-ils quand même au bon endroit dans la machine ?

Retours du 2026-10-13 (suite), faits :
- Les plans de pose utilisent aussi les relevés locaux de l'éditeur (le local l'emporte) ; l'éditeur
  dit l'état de chaque bâtiment : dépôt, local à envoyer, manquant.
- Navigation : chaque vue a son adresse (`#objet/schema/<étape>`, `#objet/pose/<étape>`,
  `#donnees/batiments/<bâtiment>`) et un bouton « ← Retour » dans la barre du haut ramène à la
  précédente (position de défilement comprise). Dans le schéma, un clic sur un bloc le met en
  évidence avec ses flux et propose « Plan de pose » et « Bâtiment ✎ » (éditeur). Chaque plan de
  pose liste ses raccordements : d'où vient chaque entrée, où part chaque sortie (boucles, objectif,
  surplus), avec des liens vers les étapes voisines. La liste de construction a un lien « plan de
  pose » par étape.

Ports et vecteurs (réponses du 2026-10-13, notes dans `data/a-verifier.md`) : le jeu redirige un
port vers n'importe quelle entrée ou sortie de même type ; un tuyau ne porte qu'une ressource.
Fait : chaque ressource prend le port qui convient le mieux, et chaque collecteur le côté de la
rangée qui évite le plus de croisements (le raccord contourne alors la machine). Le plan propose
deux priorités, avec les chiffres de l'autre : « le plus compact » (défaut) et « le moins cher ».
15 Craft Assemblers : 66 × 19 cases, 185 k$ et 42 croisements, ou 120 × 13 cases, 102 k$ et 14
croisements (un par machine : c'est le minimum avec trois ressources sur une rangée). Calcul :
moins d'une seconde par étape (essai rapide de chaque disposition sur 2 machines, puis les
meilleures en vrai).

Place d'abord (retours du 2026-10-13, suite) : le collecteur le plus proche passe sur la rangée de
raccord, collé aux machines ; une autre ressource le traverse par un croisement collé au port (les
deux tuyaux du croisement se relient à la machine, confirmé par l'utilisateur). Une seule file de
poteaux quand elle atteint toutes les prises. Les priorités sont une liste à réordonner (glisser ou
↑ ↓) : place au sol, prix, pièces à poser ; le plan annonce ce que donnerait le 2e critère en premier.
15 Craft Assemblers, place d'abord : 66 × 15 cases (66 × 19 avant). Reste : les modules très longs
(rangées repliées), puis l'usine assemblée.

Priorité principale du plan, elle aussi en liste à réordonner (2026-10-13, demande de
l'utilisateur) : la première décide quand un objet se fabrique de plusieurs façons, les suivantes
départagent les égalités (simplexe par niveaux et choix heuristique, `then` dans la requête). Repliée,
la liste montre ses trois premières priorités sur une ligne.

Rangées repliées (2026-10-13) : nouveau critère « Forme ramassée » (le plus grand côté le plus
court), 2e par défaut. Le module peut être fait de 2 à 4 blocs empilés ; chaque ressource arrive
(ou part) par un tuyau principal vertical sur le côté, avec un embranchement vers chaque bloc, et
l'ordre des tuyaux principaux limite les croisements. Exemples : 15 Craft Assemblers en 2 blocs de
39 × 30 cases (au lieu de 66 × 15), 323 Oil Rigs en 4 blocs de 86 × 84 (au lieu de 325 × 21).
Calcul : l'essai rapide des dispositions est partagé entre les tailles de bloc ; l'emprise d'une
disposition est calculée une fois (les poteaux l'interrogeaient des dizaines de fois) : environ
1,5 s au pire pour 50 machines. Limite : chaque bloc garde sa propre file de poteaux, à relier.

Retours du 2026-10-13 (fin) : le schéma affiche sur chaque flèche le produit au-dessus du débit
(étiquette sur deux lignes ; si une étiquette ne trouve pas de place libre, la disposition est
refaite plus espacée : jamais de chevauchement). « Mon usine » demande la taille de la parcelle
(cases) ; chaque plan de pose dit s'il y tient, tel quel ou tourné, et sinon si l'autre choix
tiendrait ; la réponse signale quand la surface des machines dépasse déjà la parcelle.

Pas encore fait : arbres et centrales composées, sous-produits vers un silo ou un brûleur,
logique, liaisons directes entre ports, usine assemblée (E4b).

### E5 — Refonte de l'interface

- **Navigation par objectif**, avec un écran d'accueil « Que veux-tu produire ? » : Objets,
  Énergie, Recherche (RP), et en option Argent. Chaque objectif a son réglage et partage le même
  affichage de résultat : résumé, graphe, plan d'action, modules.
- **Onglets** :
  - **Planifier** : l'objectif et son résultat ;
  - **Construction** : les modules et l'usine en grille ;
  - **Recherche** : l'arbre actuel ;
  - **Données** : à vérifier, corrections, relevés en jeu dont l'éditeur de ports ;
  - **Ma partie**.
- **Projets** : plusieurs plans enregistrés, nommés, exportables et importables (comme la
  progression).
- La refonte se fait **progressivement** au fil des phases E2 à E4, plutôt qu'en une seule fois
  à la fin, pour que l'outil reste utilisable entre deux étapes.

### E6 (option) — Argent

« X $/min » : choix des items à vendre (prix de vente contre coût de production), dépôts
nécessaires (environ 0,66 objet/s pour un Truck Depot) et chaîne de production. Peu coûteux une
fois E1 fait, mais tu ne l'as pas demandé : à toi de voir (question Q4).

## 5. Ordre proposé

| Phase | Contenu | Ce qu'il me faut de toi |
| --- | --- | --- |
| **E0** | Données énergie, logistique, RP, monde | Q1 : vérifier l'unité de la grille en jeu |
| **E1** | Moteur v2 (ressources + simplexe) | Q3 : feu vert pour le simplexe écrit à la main |
| **E2** | Énergie | Si possible, quelques relevés de puissance des turbines selon la température |
| **E3** | RP | — |
| **E4a** | Module par étape (grille, catalogue, routage, éditeur de ports) | Q2 : relever les ports des machines que tu utilises |
| **E4b** | Usine assemblée | — |
| **E5** | Refonte, progressive dès E2 | Tes retours à chaque étape |
| **E6** | Argent (option) | Q4 |

## 6. Risques

- **Ports des machines non documentés.** Sans eux, les plans sont indicatifs. Parade : l'éditeur
  de ports, des ports supposés clairement signalés, et l'ordre de relevé par machines les plus
  utilisées.
- **Unité de la grille.** Une erreur fausserait tous les plans. Parade : vérification en jeu
  avant toute la phase E4, et test de cohérence sur des pièces de taille connue (tuyau court en
  2×2, Pipe2 en 4×2, Long Pipe2 en 8×2).
- **Mécaniques à valeur variable** : température de vapeur, soleil, vent, pénalité de la RS3.
  Parade : hypothèses signalées « approximatif », bornes basse et haute affichées, relevés en jeu
  possibles.
- **Taille du problème linéaire** : environ 450 recettes, ce qui reste petit pour un simplexe. Je
  mesurerai le temps de calcul, et je garde l'heuristique en repli.
- **Évolutions du jeu** : les mises à jour changent recettes et machines. La récupération
  incrémentale du wiki et `a-verifier.md` le montrent déjà.

## 7. Questions avant de commencer

1. **Q1 — Unité de la grille.** Les tuyaux sont décrits en « studs » (Short Pipe 2×2, Long Pipe2
   8×2), la portée des poteaux en « tuiles » (LV Pole : 10 tuiles) et la taille des machines
   sans unité (Press 4×2). Peux-tu vérifier en jeu, en posant côte à côte une Press, un Short
   Pipe et un Long Pipe2 :
   - combien de Short Pipes tiennent le long de la Press ?
   - le placement se cale-t-il sur une grille, et de quel pas ?
   - les machines pivotent-elles par quarts de tour ?
2. **Q2 — Ports.** D'accord pour relever les ports des machines que tu utilises, avec l'éditeur
   que je fournirai ? Je commencerais par celles de la chaîne du Crankshaft et de l'énergie
   (environ 15 machines).
3. **Q3 — Simplexe.** D'accord pour un simplexe écrit à la main, sans nouvelle dépendance ? Je
   peux aussi comparer avec une bibliothèque existante si tu préfères, mais il faudrait
   l'installer.
4. **Q4 — Argent.** Faut-il inclure l'objectif « X $/min » (phase E6) ?
5. **Q5 — Passe du jeu.** Les compteurs de débit (Item Rate Meter et Fluid Rate Meter) sont
   vendus dans le passe du jeu : faut-il les proposer dans les plans, en option ?
6. **Q6 — Priorité.** L'ordre E0 → E1 → E2 → E3 → E4 → E5 (refonte progressive) te convient-il,
   ou préfères-tu avancer plus tôt sur les plans de construction ?

## 8. Décisions (2026-10-12)

| Question | Décision |
| --- | --- |
| Q1 Unité de la grille | À mesurer en jeu, selon la procédure de [RELEVES.md](RELEVES.md) § 0. |
| Q2 Ports | Oui. Méthode de relevé : [RELEVES.md](RELEVES.md), avec une fiche texte et trois captures (vue normale, onglet 2, onglet 3). |
| Q3 Simplexe | Oui, écrit à la main, sans dépendance. |
| Q4 Argent | Oui, et pour **tous les objectifs** : proposer des **paliers ronds**, c'est-à-dire les débits où, avec la progression actuelle, chaque étape tombe sur un nombre entier de machines (ou presque), comme les 15 assembleurs de la référence. |
| Q5 Passe du jeu | Les compteurs de débit sont proposés seulement si « J'ai le passe du jeu » est coché dans « Mon usine ». |
| Q6 Ordre | E0 → E1 → E2 → E3 → E4 → E5, la refonte se faisant au fil des phases. |
| Identité | Logo original (engrenage et flèche de flux), icônes et image d'aperçu des liens : fait le 2026-10-12. |

**Mécanique de liaison observée en jeu** (captures du 2026-10-12), à intégrer en E4 :

- En mode construction, l'**onglet 2** sert aux connexions **électriques et logiques** (câbles
  tirés d'un nœud à l'autre) et l'**onglet 3** aux connexions de **tuyaux**. Sélectionnés, ils
  affichent les **vecteurs** de liaison entre éléments.
- Les liaisons sont donc des **arêtes explicites** entre ports, et non une simple contiguïté. Les
  plans représenteront ces arêtes : câble d'un nœud de poteau à une prise, tuyau d'une sortie à
  une entrée.
- Les **prises électriques** sont souvent sur le dessus des machines. La portée d'un poteau se
  mesure jusqu'à la prise, et la machine peut gêner le câble selon sa taille. Les plans placeront
  les poteaux en tenant compte de la position et de la hauteur relevées de la prise.
