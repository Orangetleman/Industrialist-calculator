# Comparaison avec les données d'Industrialist Calculator (Pollywrath)

Fait le 2026-10-26. Dépôt public MIT
[Pollywrath/Industrialist-Production-Calculator](https://github.com/Pollywrath/Industrialist-Production-Calculator),
commit `cdcd34b` (2026-10-26), lu avec `gh api` sans rien cloner : `src/data/machines.json`,
`products.json`, `recipes.json`, `researches.json`, `special_recipes/*.ts`, plus quelques fichiers
de calcul (`researchInfrastructure.ts`, `researchRules.ts`, `globalSettings.ts`).

**Leurs données ne sont pas une source** (PLAN-ACTION.md § 0, règle 3). Ce tableau ne sert qu'à
repérer où regarder. Aucune valeur de `data/` n'a été changée. Pour chaque écart, la colonne
« Wiki » donne la valeur de Miraheze, relue le 2026-10-26 quand c'est indiqué, et celle de Fandom
quand `recipes.json` la connaît déjà. Les doutes à trancher sont repris dans `data/a-verifier.md`
(notes manuelles, codes **POL-01** à **POL-12**).

Méthode : appariement par nom (machines, objets, recherches), puis recettes par machine et par
liste d'entrées et de sorties. « Nous » = valeur du wiki relevée le 2026-10-11 + corrections de
l'utilisateur (`overrides.json`).

## 1. Bilan

| Domaine | Eux | Nous | Appariés | Écarts de valeur |
| --- | --- | --- | --- | --- |
| Recettes simples | 406 | 447 | 372 | 16 (4 sujets) |
| Recettes spéciales (`special_recipes`) | 61 fichiers | — | 75 de nos recettes y sont | valeurs de base identiques ; eux les recalculent selon un réglage (§ 4) |
| Machines | 183 | 264 (dont 165 bâtiments : poteaux, tuyaux, logique, silos…) | 154 | **0** (prix, tier, taille, « limited ») |
| Objets | 226 | 213 | 212 | 2 |
| Recherches | 149 | 149 | 148 | **0** sur les RP ; 1 nom différent |

Les deux projets lisent les mêmes modules Miraheze : l'accord est presque total. Un seul module de
recettes a changé sur Miraheze depuis notre relevé : **Trommel** (POL-01). Vérifié le 2026-10-26 en
comparant les numéros de révision des 100 pages `Module:Recipes/*`.

## 2. Écarts de valeur

| Code | Recette ou objet | Champ | Nous | Eux | Wiki (Miraheze, sauf mention) | Lecture |
| --- | --- | --- | --- | --- | --- | --- |
| POL-01 | `trommel_03` (HCl + Deep Earth Fragment → 18 Karat Gold) | entrée Deep Earth Fragment | 29 | 28 | Module : **28** depuis la révision 43888 du 2026-10-17 (« recipe book error, is actually 28 »). Fandom : 20 | Notre relevé est périmé : relancer `build-data` |
| POL-02 | `lithium_brine_extractor_01` | entrée Water | 60 | 300 | Module : 60. Page de la machine : 4 phases de 30 s à 60 L, « 300 liter consumption per recipe » | Miraheze se contredit (60 par phase ou 300 par recette ?) |
| POL-03 | `industrial_sawmill_01` à `_04` | vapeur | aucune | 300 Steam par cycle de 10 s | Module : pas de vapeur. Page de la machine : 30 L/s en marche, 6 L/s à l'arrêt | Il manque la vapeur chez nous (30 L/s × 10 s = 300) |
| POL-04 | `foundry_01` à `_10` | entrée Water | 3500 | 5000 | Module : 3500. Fandom : 5000 (déjà dans les contradictions) | Eux suivent Fandom ; rien de neuf |
| POL-05 | `industrial_firebox_25` (Oak Log → Sodium Carbonate) | Water entrée et sortie | 12 | 16 | Module : 12 (commentaire : « x12 Water ») | Eux ont 16 : pas de source trouvée |
| POL-06 | `large_diesel_engine_01` à `_04` | eau de refroidissement | aucune | 20 Water, ou 7,5 Filtered Water (+1 MMF/s), ou 15 Distilled Water (+1 MMF/s) : 12 recettes | Page de la machine : « Always consumes 20 Water or 7.5 Filtered Water (Filtered Water gives power boost by 1MMF/s) » ; la Distilled Water donne aussi +1 MMF/s et moins de pollution | Il manque l'eau chez nous. Les 15 L de Distilled Water ne sont pas sur la page |
| POL-07 | `8x-microchip` | valeur de vente | 4 000 | 13 200 | Page Microchip, tableau des tiers : **13 200**. L'infobox de la page dit 4 000 (prix du 2x) | Notre valeur vient de l'infobox commune : erreur probable |
| POL-08 | `2x-microchip`, `8x-microchip` | valeur de recherche | « 1-300 » (plage) | 1 | Infobox : « 1-300 » | Eux prennent le bas de la plage |

## 3. Présents d'un seul côté

### Objets

- **Eux seuls** : 4x, 16x, 32x, 64x, 2x64x à 8x64x Microchip (POL-09 ; prix sur la page Microchip :
  4x 8 400, 16x 17 600, 32x 22 000, 64x 26 400, les autres non relus), Spent MOX Fuel (vente
  −1 000 000), Exhaust (fluide, vente −0,5), Packed Present (300).
- **Nous seuls** : Hot Water. Eux n'ont qu'un objet Water, avec une température (§ 4).

### Machines (POL-10)

- **Eux seuls, énergie** : Hand Crank MK2, Footstep Power Generator, Small Turbine, Lightning Rod,
  3 Turbine Wind, 4 Panel Solar, Energy Wheel, RTG, Wind Turbine4, Solar Heater.
- **Eux seuls, autres** : Gold Drill (Sandbox+, 0,0034 10 Karat Gold/s, 900 000 MF/s), Big Liquid
  Burner, Incinerator, Item Dump, Tree Scrubber, Fort-Tech Heavy Cannon MK2.
- **Eux seuls, événements ou variantes** : Sleigh Depot, Candy Cane Tree, Christmas Tree, Classic
  Tree, Igloo Farm Controller, Festive Coal Power Plant, Festive Cooling Tower.
- **Eux seuls, mode bac à sable** : Diesel Engine Info Panel DEBUG, Hot Water Pump, Hyper Depot,
  Fluid Spawner, Item Spawner, Dev Solar Panel.
- **Nous seuls** : les 165 bâtiments sans recette (poteaux, batteries, tuyaux, portes logiques,
  silos, lampes, panneaux). Eux ne les traitent pas comme des machines.

### Recherches

- « Large Scale Power Output » chez eux, « Large Scale Power Production » chez nous (500 000 RP
  des deux côtés). Nom à vérifier sur le wiki.

### Recettes (34 chez eux seuls)

| Sujet | Leurs recettes | Chez nous |
| --- | --- | --- |
| Générateurs (POL-11) | Energy Wheel 30 000 MF/s, Hand Crank 1 500, Solar Panel 200, Solar Panel2 575, Solar Panel3 3 400, Solar Farm1 80 000, 4 Panel Solar 68 965,51, RTG 1 | `power.json` donne des plages : Solar Panel [120, 240], Solar Panel2 [0, 5 000], Solar Panel3 [0, 29 700], Solar Farm1 [0, 664 100] ; Hand Crank 1 500 (identique). Eux prennent une seule valeur, sans doute une moyenne jour-nuit : origine inconnue |
| Hand Pump | 10 Water par cycle de 3 s | Machine présente, sans recette |
| Exhaust Stack | 120 000 Exhaust (+ 1 Filter), filtrage ou rejet | Pas d'objet Exhaust |
| Firebox, Gas Burner | Water → Water chaude (même objet, plus chaud) | Même chose avec l'objet Hot Water : pas un écart de valeur |
| Large Diesel Engine | 12 variantes avec eau | POL-06 |
| Research Station1, Satellite Dish | 2 100 et 75 000 MF/s | À comparer avec `research-stations.json` (non fait) |
| Gold Drill, Hot Water Pump | voir machines | absentes |

Nos 75 recettes absentes de leur `recipes.json` sont couvertes par leurs `special_recipes` (ou par
leurs recettes « Water chaude »), avec les mêmes valeurs de base, sauf POL-05. `tree_01` correspond
à leur Tree Farm calculée, `logic_assembler_01` n'a pas été comparée. Autre différence de forme :
`boiler_01`, où nous avons le relevé de l'utilisateur (3 Water + 3 Hot Water → 3 Water + 90 Steam)
et eux une quantité de vapeur calculée.

## 4. Mécaniques qu'ils modélisent (POL-12)

Ces formules sont dans leur code. Aucune n'est reprise : chacune est à retrouver sur le wiki ou en
jeu avant usage.

| Mécanique | Ce qu'ils calculent | Chez nous |
| --- | --- | --- |
| **Température de la vapeur**, réglée par machine | Alloyer : durée = max(2, 40 ÷ (1 + T/100)), soit 10 s à 300 °C. Coal Liquefaction : 88 s sous 18 °C, 3000/T + 10 jusqu'à 300 °C, 10 s dès 350 °C. Steam Cracking : ⌈900 × borne(1 − T/400 ; 0,1 ; 1)⌉ ÷ 30, soit 3 s dès 360 °C. Industrial Drill : sortie × borne(T/100 ; 0 ; 4), donc 40 Raw Iron à 400 °C. Water Treatment : sortie = min(120 ; 0,176 × T), soit 64 à 363,6 °C | Une valeur fixe, celle du wiki, qui est leur valeur à la température par défaut. Les recettes à mode « variable » sont dans les contradictions |
| **Pollution globale** (réglage, 10 par défaut) | Croissance des arbres : facteur 1 + 0,005 p − 0,0001 p², borné entre 0,5 et 1,2, puis temps de pousse par impulsions. Residue de l'Air Separation Unit = borne(p/10 ; 1 ; 20). Tree Scrubber : 6 Residue, 0 si p ≤ −1500 | `tree_01` a une durée selon la pollution (`durationByPollution`). Residue de l'ASU marqué « variable » sans calcul. Tree Scrubber absent |
| **Mois courant** | Igloo Farm Controller : × 1,5 bûches par arbre en décembre, janvier et février (pas pour le Candy Cane Tree, qui pousse 1,2 fois plus vite) | Rien |
| **Satellite** (« Satellite buff ») | Paraboles nécessaires = √(S × R) + S, **sans arrondi**. Efficacité = min(100 %, paraboles ÷ nécessaires), **linéaire**. Bonus = 78 × log₁₀(R + 1) % × efficacité | Formule du wiki avec ⌈ ⌉. L'efficacité n'a pas de formule (question RP-03) : leur version linéaire est une supposition |
| **Research Station4** | Bonus ajouté sous le plafond : plafond T4 × 0,000025 × nombre de RS4. Une option « RS4 buff » double le facteur d'argent des RS3 | Rien de tel dans `research-stations.json` |
| **Difficulté** | Normal, Hard, Impossible, Impossible2, Sandbox, Sandbox+ : liste de recherches bloquées par difficulté (Hand Crank, Wind Turbine1, Geothermal Plant, Solar Panel 2… en Hard) et machines réservées au mode bac à sable | Rien |
| **Chemical Plant** | Vitesse de 50 à 200 %, efficacité de 80 à 120 % : coefficients sur les entrées, les sorties et l'énergie | Recettes marquées « variable » (mode `plant_speed_efficency`), valeur de base seulement |
| **Combustibles de l'Industrial Firebox** | Énergie par unité : Coal 30 000, Coke Fuel 600 000, Planks 9 000, Oak Log 16 000. Durée et quantité déduites de l'énergie de la recette (900 000 pour SO₂ et Boron) | 25 recettes fixes du module Miraheze, qui donnent les mêmes nombres |
| **Pollution par recette** | Champ `pollution` sur chaque recette | `pollutionPerHour` par machine. Non comparé |
| **Centrales et turbines** | Coal Power Plant, Modular Turbine, Modular Diesel Engine, Steam Condenser, Large, Small et Steam Turbine calculés selon la vapeur et le débit | Calculés à part (`energy.json`, S13) ; non comparé ici |

## 5. Ce qui est fait, ce qu'il reste à faire

**Fait le 2026-10-27, à la demande de l'utilisateur** : leurs valeurs sont reprises dans
`data/overrides.json` (source « saisie ») pour POL-01 à POL-05 et POL-07 à POL-09. Les colonnes
« Nous » du § 2 donnent donc l'ancienne valeur ; le site utilise désormais celle de la colonne
« Eux ». Les 4 recettes de l'Industrial Sawmill sont remplacées par des copies avec 300 Steam
(`industrial_sawmill_0X_vapeur`).

**Reste à faire (demande une modification du code, lot à part)** :

1. POL-06, eau du Large Diesel Engine : le moteur refuse une recette ajoutée sans sortie
   (`checkAddedRecipe`, `data.noOutput`, dans `src/engine/data.ts`). Il faut soit l'accepter pour
   les générateurs (énergie négative), soit permettre à une correction d'ajouter une entrée à une
   recette existante. Ensuite : 20 Water, 7,5 Filtered Water ou 15 Distilled Water (les deux
   dernières à −6 MMF/s).
2. Relancer `build-data` pour prendre la révision 43888 du module Trommel ; la correction POL-01
   deviendra alors inutile.
3. Chercher sur le wiki l'origine des formules du § 4, d'abord la température de la vapeur (5
   machines) et la pollution globale.
