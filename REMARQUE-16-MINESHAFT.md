# Remarque joueur n°16 : Mineshaft Drill et graphe du Purple Gold (2026-11-16)

Remarque (red_draggy) : « par défaut MSD plutôt que Quarry, ex. Purple Gold » ; le graphe calculé
n'est pas optimal (400 Trommels, Deep Earth Fragment → 10 Karat Gold ; il manquait des machines ou
de la place) ; suggestion : importer le graphe de `!ratios` (Industrialist Calculator).

## Ce qui est fait

- Le **Mineshaft Drill** est une machine du calcul (avant : simple bâtiment, aucune recette). Une
  recette par profondeur = le cycle d'une tête (extraction, aller-retour du puits, changement de
  tête). Données : `data/mineshaft.json` (wiki Miraheze) ; calcul : `src/engine/mineshaft.ts` ;
  doutes : `data/a-verifier.md` MSD-01 à MSD-07 ; écarts avec Industrialist Calculator :
  `COMPARAISON-POLLYWRATH.md` § 6.
- Réglage **par plan**, enregistré avec lui : profondeur (auto = la meilleure pour chaque objet, ou
  une des 41 profondeurs), tête (Copper, Iron, Steel, Tungsten Carbide), acide (aucun, Water,
  Acetic, Sulfuric, Hydrochloric), Machine Oil. Défaut : auto, Steel, Hydrochloric, sans huile
  (choix du site, pas une valeur du jeu). Il se règle dans la barre du bloc du schéma ; une
  pastille « Ton plan » le rappelle et le remet par défaut.

## Pourquoi le résultat d'avant n'était pas optimal

Mesures (tout débloqué, `solve`, Purple Gold Ingot) :

| Débit | Critère | Sans Mineshaft Drill | Avec |
| --- | --- | --- | --- |
| 60/min | moins de machines | 180 machines, 25 460 cases | 108 machines, 19 025 cases |
| 60/min | moins de place (défaut) | 205 machines, 22 392 cases | 132 machines, 12 923 cases |
| 300/min | moins de machines | 794 machines, 113 256 cases | 443 machines, 68 217 cases |
| 300/min | moins de place (défaut) | 997 machines, 98 824 cases | 561 machines, 47 647 cases |
| 300/min | moins d'étapes | 2 269 machines dont 438 Trommels | identique |

1. **Aucun producteur de Deep Earth Fragment.** Sans recette du Mineshaft Drill, le solveur ne
   pouvait pas prendre la voie Deep Earth Fragment → 24 Karat Gold (Ore Enrichment Facility) ou
   → 18 Karat Gold (Trommel + Hydrochloric Acid) : il partait du sol (Quarry → Trommel → Rich Soil
   → or bas de gamme). C'est corrigé : 6 Mineshaft Drills à 8 000 m suffisent pour 300/min.
2. **La voie 10 Karat Gold coûte 10 fois plus d'or.** L'Industrial Electric Furnace donne 0,1
   Liquid Gold par 10 Karat Gold, contre 1 par 24 Karat Gold. À 60/min, la voie Trommel → 10 Karat
   Gold demande 80 Trommels et 100 fours (test `mineshaft.test.ts`) ; à 300/min, 400 Trommels et
   500 fours : c'est le graphe du joueur. Le solveur ne la choisit jamais avec « machines » ou
   « place » ; elle ne vient que d'une recette forcée.
3. **« Moins d'étapes » donne des plans démesurés.** Ce critère compte les étapes, pas les
   machines : il prend 8 Karat Gold (0,08 Liquid Gold par unité) et fait 438 Trommels à 300/min.
   Le Mineshaft Drill n'y change rien (une voie Deep Earth Fragment a autant d'étapes).
4. **Sous contrainte de machines ou de place : l'arrondi des petites étapes.** Le simplexe compte
   des machines fractionnaires. Avec la profondeur auto, il ajoute un Mineshaft Drill à 4 000 m
   pour 0,03 machine de Table Salt, un à 6 000 m pour 0,05 de Coal, un à 5 200 m pour 0,02 de Raw
   Iron : chacun arrondi à 1 machine de 14 × 14 cases et 1,1 M$. Le plan affiché paie donc 3
   machines entières pour 0,1 machine de travail.

## Correctifs proposés (à décider : préférences de jeu)

- **A. Arrondi dans l'optimisation** : après le simplexe, retirer une à une les étapes dont la part
  arrondie coûte plus qu'elle ne sert (ex. < 0,1 machine d'une machine chère) et recalculer sans
  elles ; garder si le total entier baisse. Coût : quelques calculs de plus par plan.
- **B. Profondeur unique** : option « un seul puits » qui essaie chaque profondeur (41 calculs) et
  garde la meilleure pour tout le plan, au lieu d'une profondeur par objet.
- **C. « Moins d'étapes »** : le garder seulement comme critère de départage, ou avertir quand le
  plan compte beaucoup plus de machines que le meilleur plan « machines ».
- **D. Mineshaft Drill par défaut plutôt que Quarry** : c'est déjà le cas dès qu'il est débloqué et
  meilleur pour le critère. Il demande la recherche Mineshaft Drill (175 000 RP), 1,1 M$ et du
  courant HV ; le préférer même quand il n'est pas meilleur serait une préférence de jeu.
- **E. Tête et acide** : Tungsten Carbide s'use 4 fois moins que Steel (Lathe : 1 275 Tungsten
  Carbide Plate contre 3 500 Steel Ingot). Le défaut reste Steel + Hydrochloric (recommandé par le
  wiki) tant que le joueur n'en décide pas autrement.

## Lot à part (non fait)

Importer le graphe de `!ratios` (Industrialist Calculator) : noté seulement.
