# Données à vérifier

> Fichier généré par `node scripts/build-data.ts` à partir du cache du 2026-10-12. Ne modifie que la section « Notes manuelles » en bas : le reste est réécrit à chaque génération.
>
> Source principale : **Miraheze**. Contrôle croisé : **Fandom**. Les corrections vont dans `data/overrides.json`, ou se saisissent directement dans l'appli.

## Résumé

| Fichier | Objets | Dont à vérifier |
|---|---|---|
| recipes.json | 447 | 109 |
| machines.json | 264 | 19 |
| items.json | 213 | 2 |
| research.json | 149 | 24 |

Contrôle Fandom : 409 recettes distinctes lues, 254 identiques à Miraheze, 101 en contradiction, 54 absentes de Miraheze, 0 ambiguës.

## Concordance avec la référence (`reference/ligne-vilebrequin.html`)

La référence n'est pas une source de données. Chaque recette doit soit être identique dans `data/`, soit figurer ci-dessous.

Identiques : Steel Rod (Roller) = `roller_03` ; Steel Ingot (Blast Furnace) = `blast_furnace_10` ; Iron Mix (Industrial Kiln) = `industrial_kiln_08` ; Iron Mix (Blast Furnace) = `blast_furnace_11` ; Iron Powder (Grinder) = `grinder_03` ; Coke Fuel (Blast Furnace) = `blast_furnace_05` ; Raw Iron (Iron Drill) = `iron_drill_01` ; Coal (Coal Drill) = `coal_drill_01`.

| Recette | Champ | Référence | Données | Recette des données |
|---|---|---|---|---|
| Crankshaft (Craft Assembler) <!-- ref:crank:durationS --> | durationS | 17.2 | 15 | `craft_assembler_05` |
| Crankshaft (Craft Assembler) <!-- ref:crank:energyMFps --> | energyMFps | 3488 | 4000 | `craft_assembler_05` |
| Gear (Roller) <!-- ref:gear:energyMFps --> | energyMFps | 750 | 6250 | `roller_04` |
| Steel Plate (Press) <!-- ref:plate:durationS --> | durationS | 5.1 | 4 | `press_03` |
| Steel Plate (Press) <!-- ref:plate:energyMFps --> | energyMFps | 9804 | 12500 | `press_03` |
| Oak Log (Tree) <!-- ref:oak:durationS --> | durationS | 345 | 363 | `tree_01` |

## Recettes

### Contradictions (valeur Miraheze retenue) — 88

Le moteur utilise la valeur Miraheze et affiche l'alternative.

| Recette | Machine | Entrées → sorties | Champ | Détail | Alternatives |
|---|---|---|---|---|---|
| [`advanced_assembler_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Assembler) | Advanced Assembler | 1 Tire Rim + 4 Rubber → 1 Tire | durationS | Miraheze : 5 ; Fandom : 17.2 | 17.2 ([fandom](https://industrialist.fandom.com/wiki/Rubber)) |
| [`advanced_assembler_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Assembler) | Advanced Assembler | 1 Tire Rim + 4 Rubber → 1 Tire | energyMFps | Miraheze : 200000 ; Fandom : 3488 | 3488 ([fandom](https://industrialist.fandom.com/wiki/Rubber)) |
| [`advanced_assembler_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Assembler) | Advanced Assembler | 2 Aluminium Ingot + 4 Steel Ingot → 1 Tire Rim | energyMFps | Miraheze : 200000 ; Fandom : 200 | 200 ([fandom](https://industrialist.fandom.com/wiki/Aluminium_Ingot)) |
| [`advanced_assembler_13`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Assembler) | Advanced Assembler | 5 Coal + 2 Iron Coil + 2 Paper + 2 Sand → 1 Filter | outputs.filter | Miraheze : 1 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Sand)) |
| [`advanced_assembler_17`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Assembler) | Advanced Assembler | 4 Electromagnet + 0.2 Ferroaluminium Magnet + 2 Steel Rod + 4 Steel Plate + 2 Machine Oil → 2 Electric Motor | outputs.electric-motor | Miraheze : 2 ; Fandom : 1 | 1 ([fandom](https://industrialist.fandom.com/wiki/Ferroaluminium_Magnet)) |
| [`advanced_diesel_refinery_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 3.15 Crude Diesel → 0.28 Residue + 2.87 Poor Quality Diesel | inputs.crude-diesel | Miraheze : 3.15 ; Fandom : 3 | 3 ([fandom](https://industrialist.fandom.com/wiki/Diesel/Crude_Diesel)) |
| [`advanced_diesel_refinery_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 3.15 Crude Diesel → 0.28 Residue + 2.87 Poor Quality Diesel | outputs.poor-quality-diesel | Miraheze : 2.87 ; Fandom : 2.7 | 2.7 ([fandom](https://industrialist.fandom.com/wiki/Diesel/Crude_Diesel)) |
| [`advanced_diesel_refinery_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 3.15 Crude Diesel → 0.28 Residue + 2.87 Poor Quality Diesel | outputs.residue | Miraheze : 0.28 ; Fandom : 0.3 | 0.3 ([fandom](https://industrialist.fandom.com/wiki/Diesel/Crude_Diesel)) |
| [`advanced_diesel_refinery_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 3.15 Crude Diesel → 0.28 Residue + 2.87 Poor Quality Diesel | energyMFps | Miraheze : 1000000 ; Fandom : 1200000 | 1200000 ([fandom](https://industrialist.fandom.com/wiki/Machine_Oil)) |
| [`advanced_diesel_refinery_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 2.59 Diesel → 0.21 Residue + 2.38 Refined Diesel | inputs.diesel | Miraheze : 2.59 ; Fandom : 3 | 3 ([fandom](https://industrialist.fandom.com/wiki/Diesel/Diesel)) |
| [`advanced_diesel_refinery_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 2.59 Diesel → 0.21 Residue + 2.38 Refined Diesel | outputs.refined-diesel | Miraheze : 2.38 ; Fandom : 2.7 | 2.7 ([fandom](https://industrialist.fandom.com/wiki/Diesel/Diesel)) |
| [`advanced_diesel_refinery_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 2.59 Diesel → 0.21 Residue + 2.38 Refined Diesel | outputs.residue | Miraheze : 0.21 ; Fandom : 0.3 | 0.3 ([fandom](https://industrialist.fandom.com/wiki/Diesel/Diesel)) |
| [`advanced_diesel_refinery_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 2.59 Diesel → 0.21 Residue + 2.38 Refined Diesel | energyMFps | Miraheze : 1000000 ; Fandom : 1200000 | 1200000 ([fandom](https://industrialist.fandom.com/wiki/Machine_Oil)) |
| [`advanced_diesel_refinery_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 2.87 Poor Quality Diesel → 0.28 Residue + 2.59 Diesel | inputs.poor-quality-diesel | Miraheze : 2.87 ; Fandom : 3 | 3 ([fandom](https://industrialist.fandom.com/wiki/Diesel/Diesel)) |
| [`advanced_diesel_refinery_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 2.87 Poor Quality Diesel → 0.28 Residue + 2.59 Diesel | outputs.diesel | Miraheze : 2.59 ; Fandom : 2.7 | 2.7 ([fandom](https://industrialist.fandom.com/wiki/Diesel/Diesel)) |
| [`advanced_diesel_refinery_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 2.87 Poor Quality Diesel → 0.28 Residue + 2.59 Diesel | outputs.residue | Miraheze : 0.28 ; Fandom : 0.3 | 0.3 ([fandom](https://industrialist.fandom.com/wiki/Diesel/Diesel)) |
| [`advanced_diesel_refinery_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 2.87 Poor Quality Diesel → 0.28 Residue + 2.59 Diesel | energyMFps | Miraheze : 1000000 ; Fandom : 1200000 | 1200000 ([fandom](https://industrialist.fandom.com/wiki/Machine_Oil)) |
| [`advanced_diesel_refinery_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 2.38 Refined Diesel → 0.21 Residue + 2.17 Gasoline | energyMFps | Miraheze : 1000000 ; Fandom : 1200000 | 1200000 ([fandom](https://industrialist.fandom.com/wiki/Gasoline)) |
| [`advanced_diesel_refinery_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 2.38 Refined Diesel → 0.21 Residue + 2.17 Gasoline | inputs.refined-diesel | Miraheze : 2.38 ; Fandom : 3 | 3 ([fandom](https://industrialist.fandom.com/wiki/Gasoline)) |
| [`advanced_diesel_refinery_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 2.38 Refined Diesel → 0.21 Residue + 2.17 Gasoline | outputs.gasoline | Miraheze : 2.17 ; Fandom : 2.7 | 2.7 ([fandom](https://industrialist.fandom.com/wiki/Gasoline)) |
| [`advanced_diesel_refinery_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Diesel_Refinery) | Advanced Diesel Refinery | 0.15 Machine Oil + 2.38 Refined Diesel → 0.21 Residue + 2.17 Gasoline | outputs.residue | Miraheze : 0.21 ; Fandom : 0.3 | 0.3 ([fandom](https://industrialist.fandom.com/wiki/Gasoline)) |
| [`advanced_oxidation_plant_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Oxidation_Plant) | Advanced Oxidation Plant | 10 Mixed Uranium Oxides + 100 Oxygen + 100 Sulfuric Acid → 4 Yellowcake | durationS | Miraheze : 40 ; Fandom : 30 | 30 ([fandom](https://industrialist.fandom.com/wiki/Yellowcake)) |
| [`advanced_oxidation_plant_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Advanced_Oxidation_Plant) | Advanced Oxidation Plant | 10 Mixed Uranium Oxides + 100 Oxygen + 100 Sulfuric Acid → 4 Yellowcake | outputs.yellowcake | Miraheze : 4 ; Fandom : 8 | 8 ([fandom](https://industrialist.fandom.com/wiki/Yellowcake)) |
| [`blast_furnace_14`](https://industrialist.miraheze.org/wiki/Module:Recipes/Blast_Furnace) | Blast Furnace | 4 Coal + 4 Rock → 4 Iron Mix | inputs.coal | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Iron_Mix)) |
| [`blast_furnace_MK2_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Blast_Furnace_MK2) | Blast Furnace MK2 | 300 Coal + 100 Iron Ingot → 200 Steel Ingot | durationS | Miraheze : 20 ; Fandom : 5 | 5 ([fandom](https://industrialist.fandom.com/wiki/Coal)) |
| [`blast_furnace_MK2_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Blast_Furnace_MK2) | Blast Furnace MK2 | 200 Coal + 50 Oak Log → 300 Coke Fuel | durationS | Miraheze : 20 ; Fandom : 5 | 5 ([fandom](https://industrialist.fandom.com/wiki/Coal)) |
| [`chemical_reactor_13`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Reactor) | Chemical Reactor | 20 Chlorine + 20 Hydrogen + 5 Distilled Water → 5 Hydrochloric Acid | energyMFps | Miraheze : 600000 ; Fandom : 60000 | 60000 ([fandom](https://industrialist.fandom.com/wiki/Hydrochloric_Acid)) |
| [`coal_generator_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Coal_Generator) | Coal Generator | 0.25 Coal + 1.45 Water → 3 Steam | energyMFps | Miraheze : -7000 ; Fandom : -4500 | -4500 ([fandom](https://industrialist.fandom.com/wiki/Coal)) |
| [`coal_generator_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Coal_Generator) | Coal Generator | 0.25 Coal + 1.45 Water → 3 Steam | inputs.coal | Miraheze : 0.25 ; Fandom : 0.5 | 0.5 ([fandom](https://industrialist.fandom.com/wiki/Coal)) |
| [`coal_generator_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Coal_Generator) | Coal Generator | 0.25 Coal + 1.45 Water → 3 Steam | inputs.water | Miraheze : 1.45 ; Fandom : 0.5 | 0.5 ([fandom](https://industrialist.fandom.com/wiki/Coal)) |
| [`coal_generator_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Coal_Generator) | Coal Generator | 0.25 Coal + 1.45 Water → 3 Steam | outputs.steam | Miraheze : 3 ; Fandom : 0.3 | 0.3 ([fandom](https://industrialist.fandom.com/wiki/Coal)) |
| [`coal_generator_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Coal_Generator) | Coal Generator | 0.25 Coal + 1.45 Water → 3 Steam | durationS | Miraheze : 1 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Steam)) |
| [`compact_coal_power_plant_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Compact_Coal_Power_Plant) | Compact Coal Power Plant | 2 Coal →  | inputs.coal | Miraheze : 2 ; Fandom : 1 | 1 ([fandom](https://industrialist.fandom.com/wiki/Coal)) |
| [`craft_assembler_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 12 Planks + 20 Nails → 1 Chair | durationS | Miraheze : 15 ; Fandom : 17.2 | 17.2 ([fandom](https://industrialist.fandom.com/wiki/Chair)) |
| [`craft_assembler_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 12 Planks + 20 Nails → 1 Chair | energyMFps | Miraheze : 4000 ; Fandom : 3488 | 3488 ([fandom](https://industrialist.fandom.com/wiki/Chair)) |
| [`craft_assembler_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 1 Tire Rim + 4 Rubber → 1 Tire | durationS | Miraheze : 15 ; Fandom : 17.2 | 17.2 ([fandom](https://industrialist.fandom.com/wiki/Tire)) |
| [`craft_assembler_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 1 Tire Rim + 4 Rubber → 1 Tire | energyMFps | Miraheze : 4000 ; Fandom : 3488 | 3488 ([fandom](https://industrialist.fandom.com/wiki/Tire)) |
| [`craft_assembler_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 2 Aluminium Ingot + 4 Steel Ingot → 1 Tire Rim | durationS | Miraheze : 15 ; Fandom : 17.2 | 17.2 ([fandom](https://industrialist.fandom.com/wiki/Aluminium_Ingot)) |
| [`craft_assembler_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 2 Aluminium Ingot + 4 Steel Ingot → 1 Tire Rim | energyMFps | Miraheze : 4000 ; Fandom : 3488 | 3488 ([fandom](https://industrialist.fandom.com/wiki/Aluminium_Ingot)) |
| [`craft_assembler_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 20 Rubber + 40 Copper Wire → 40 Insulated Wire | durationS | Miraheze : 15 ; Fandom : 17.2 | 17.2 ([fandom](https://industrialist.fandom.com/wiki/Copper_Wire)) |
| [`craft_assembler_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 20 Rubber + 40 Copper Wire → 40 Insulated Wire | energyMFps | Miraheze : 4000 ; Fandom : 3488 | 3488 ([fandom](https://industrialist.fandom.com/wiki/Copper_Wire)) |
| [`craft_assembler_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 2 Steel Rod + 4 Gear → 1 Crankshaft | durationS | Miraheze : 15 ; Fandom : 17.2 | 17.2 ([fandom](https://industrialist.fandom.com/wiki/Crankshaft)) |
| [`craft_assembler_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 2 Steel Rod + 4 Gear → 1 Crankshaft | energyMFps | Miraheze : 4000 ; Fandom : 3488 | 3488 ([fandom](https://industrialist.fandom.com/wiki/Crankshaft)) |
| [`craft_assembler_06`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 2 Plastic Casing + 1 Crankshaft → 1 Gearbox | durationS | Miraheze : 15 ; Fandom : 17.2 | 17.2 ([fandom](https://industrialist.fandom.com/wiki/Crankshaft)) |
| [`craft_assembler_06`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 2 Plastic Casing + 1 Crankshaft → 1 Gearbox | energyMFps | Miraheze : 4000 ; Fandom : 3488 | 3488 ([fandom](https://industrialist.fandom.com/wiki/Crankshaft)) |
| [`craft_assembler_07`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 6 Black Dye + 3 Planks → 1 Toy | durationS | Miraheze : 15 ; Fandom : 17.2 | 17.2 ([fandom](https://industrialist.fandom.com/wiki/Black_Dye)) |
| [`craft_assembler_07`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 6 Black Dye + 3 Planks → 1 Toy | energyMFps | Miraheze : 4000 ; Fandom : 3488000000 | 3488000000 ([fandom](https://industrialist.fandom.com/wiki/Black_Dye)), 3488 ([fandom](https://industrialist.fandom.com/wiki/Planks)) |
| [`craft_assembler_08`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 9 Black Dye + 6 Paper → 2 Present Box | durationS | Miraheze : 15 ; Fandom : 17.2 | 17.2 ([fandom](https://industrialist.fandom.com/wiki/Paper)) |
| [`craft_assembler_08`](https://industrialist.miraheze.org/wiki/Module:Recipes/Craft_Assembler) | Craft Assembler | 9 Black Dye + 6 Paper → 2 Present Box | energyMFps | Miraheze : 4000 ; Fandom : 3488 | 3488 ([fandom](https://industrialist.fandom.com/wiki/Paper)) |
| [`electrolysis_plant_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Electrolysis_Plant) | Electrolysis Plant | 8 Concentrated Salt Solution → 60 Chlorine + 6 Sodium Hydroxide Solution | outputs.chlorine | Miraheze : 60 ; Fandom : 30 | 30 ([fandom](https://industrialist.fandom.com/wiki/Sodium_Hydroxide_Solution)) |
| [`filtration_plant_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Filtration_Plant) | Filtration Plant | 4 Refined Diesel → 2.4 Machine Oil | energyMFps | Miraheze : 7500 ; Fandom : 15000 | 15000 ([fandom](https://industrialist.fandom.com/wiki/Machine_Oil)) |
| [`foundry_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Foundry) | Foundry | 2000 Raw Lead + 168 Coke Fuel + 3500 Water → 1000 Lead Ingot | inputs.coke-fuel | Miraheze : 168 ; Fandom : 240 | 240 ([fandom](https://industrialist.fandom.com/wiki/Lead_Ingot)) |
| [`foundry_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Foundry) | Foundry | 2000 Raw Lead + 168 Coke Fuel + 3500 Water → 1000 Lead Ingot | inputs.water | Miraheze : 3500 ; Fandom : 5000 | 5000 ([fandom](https://industrialist.fandom.com/wiki/Lead_Ingot)) |
| [`foundry_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Foundry) | Foundry | 2000 Raw Iron + 168 Coke Fuel + 3500 Water → 1000 Iron Ingot | inputs.coke-fuel | Miraheze : 168 ; Fandom : 240 | 240 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`foundry_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Foundry) | Foundry | 2000 Raw Iron + 168 Coke Fuel + 3500 Water → 1000 Iron Ingot | inputs.water | Miraheze : 3500 ; Fandom : 5000 | 5000 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`foundry_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Foundry) | Foundry | 400 Treated Raw Iron + 168 Coke Fuel + 3500 Water → 1200 Iron Ingot | inputs.coke-fuel | Miraheze : 168 ; Fandom : 240 | 240 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`foundry_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Foundry) | Foundry | 400 Treated Raw Iron + 168 Coke Fuel + 3500 Water → 1200 Iron Ingot | inputs.water | Miraheze : 3500 ; Fandom : 5000 | 5000 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`foundry_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Foundry) | Foundry | 400 Treated Raw Iron + 168 Coke Fuel + 3500 Water → 1200 Iron Ingot | outputs.iron-ingot | Miraheze : 1200 ; Fandom : 1000 | 1000 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`foundry_06`](https://industrialist.miraheze.org/wiki/Module:Recipes/Foundry) | Foundry | 2000 Raw Lead + 1680 Coal + 3500 Water → 1000 Lead Ingot | inputs.coal | Miraheze : 1680 ; Fandom : 2400 | 2400 ([fandom](https://industrialist.fandom.com/wiki/Lead_Ingot)) |
| [`foundry_06`](https://industrialist.miraheze.org/wiki/Module:Recipes/Foundry) | Foundry | 2000 Raw Lead + 1680 Coal + 3500 Water → 1000 Lead Ingot | inputs.water | Miraheze : 3500 ; Fandom : 5000 | 5000 ([fandom](https://industrialist.fandom.com/wiki/Lead_Ingot)) |
| [`foundry_08`](https://industrialist.miraheze.org/wiki/Module:Recipes/Foundry) | Foundry | 2000 Raw Iron + 1680 Coal + 3500 Water → 1000 Iron Ingot | inputs.coal | Miraheze : 1680 ; Fandom : 2400 | 2400 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`foundry_08`](https://industrialist.miraheze.org/wiki/Module:Recipes/Foundry) | Foundry | 2000 Raw Iron + 1680 Coal + 3500 Water → 1000 Iron Ingot | inputs.water | Miraheze : 3500 ; Fandom : 5000 | 5000 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`foundry_10`](https://industrialist.miraheze.org/wiki/Module:Recipes/Foundry) | Foundry | 400 Treated Raw Iron + 1680 Coal + 3500 Water → 1200 Iron Ingot | inputs.coal | Miraheze : 1680 ; Fandom : 2400 | 2400 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`foundry_10`](https://industrialist.miraheze.org/wiki/Module:Recipes/Foundry) | Foundry | 400 Treated Raw Iron + 1680 Coal + 3500 Water → 1200 Iron Ingot | inputs.water | Miraheze : 3500 ; Fandom : 5000 | 5000 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`foundry_10`](https://industrialist.miraheze.org/wiki/Module:Recipes/Foundry) | Foundry | 400 Treated Raw Iron + 1680 Coal + 3500 Water → 1200 Iron Ingot | outputs.iron-ingot | Miraheze : 1200 ; Fandom : 1000 | 1000 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`gas_burner_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Gas_Burner) | Gas Burner | 20 Hydrogen + 30 Water → 30 Hot Water | inputs.hydrogen | Miraheze : 20 ; Fandom : 12 | 12 ([fandom](https://industrialist.fandom.com/wiki/Hydrogen)) |
| [`geothermal_well_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Geothermal_Well) | Geothermal Well | 9.09 Distilled Water → 6.05 Distilled Water | durationS | Miraheze : 1 ; Fandom : 3.67 | 3.67 ([fandom](https://industrialist.fandom.com/wiki/Distilled_Water)) |
| [`geothermal_well_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Geothermal_Well) | Geothermal Well | 9.09 Distilled Water → 6.05 Distilled Water | energyMFps | Miraheze : 3000 ; Fandom : 11000 | 11000 ([fandom](https://industrialist.fandom.com/wiki/Distilled_Water)) |
| [`gold_acid_refinery_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Gold_Acid_Refinery) | Gold Acid Refinery | 2 Acetic Acid + 6 Water + 1 Rich Soil → 8 Residue + 1 10 Karat Gold | outputs.10-karat-gold | Miraheze : 1 ; Fandom : 5 | 5 ([fandom](https://industrialist.fandom.com/wiki/Gold/10_Karat_Gold)) |
| [`gold_acid_refinery_10`](https://industrialist.miraheze.org/wiki/Module:Recipes/Gold_Acid_Refinery) | Gold Acid Refinery | 2 Acetic Acid + 5 Water + 5 Deep Earth Fragment → 5 Residue + 5 Coal | inputs.deep-earth-fragment | Miraheze : 5 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Acetic_Acid)) |
| [`heat_exchanger_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Heat_Exchanger) | Heat Exchanger | 800 Distilled Water → 400 Distilled Water + 12000 High Pressure Steam | inputs.distilled-water | Miraheze : 800 ; Fandom : 400 | 400 ([fandom](https://industrialist.fandom.com/wiki/Distilled_Water)) |
| [`heat_exchanger_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Heat_Exchanger) | Heat Exchanger | 800 Distilled Water → 400 Distilled Water + 12000 High Pressure Steam | outputs.distilled-water | Miraheze : 400 ; Fandom : 800 | 800 ([fandom](https://industrialist.fandom.com/wiki/Distilled_Water)) |
| [`industrial_drill_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Industrial_Drill) | Industrial Drill | 720 Steam → 40 Raw Iron | outputs.raw-iron | Miraheze : 40 ; Fandom : 20 | 20 ([fandom](https://industrialist.fandom.com/wiki/Raw_Iron)) |
| [`industrial_drill_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Industrial_Drill) | Industrial Drill | 720 Steam → 40 Raw Copper | outputs.raw-copper | Miraheze : 40 ; Fandom : 20 | 20 ([fandom](https://industrialist.fandom.com/wiki/Raw_Copper)) |
| [`industrial_drill_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Industrial_Drill) | Industrial Drill | 720 Steam → 2 Bauxite Residue | outputs.bauxite-residue | Miraheze : 2 ; Fandom : 1 | 1 ([fandom](https://industrialist.fandom.com/wiki/Bauxite_Residue)) |
| [`industrial_electric_furnace_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Industrial_Electric_Furnace) | Industrial Electric Furnace | 1 24 Karat Gold → 1 Liquid Gold | energyMFps | Miraheze : 200000 ; Fandom : 1000000 | 1000000 ([fandom](https://industrialist.fandom.com/wiki/Gold/24_Karat_Gold)) |
| [`industrial_electric_furnace_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Industrial_Electric_Furnace) | Industrial Electric Furnace | 1 10 Karat Gold → 0.1 Liquid Gold | energyMFps | Miraheze : 200000 ; Fandom : 1000000 | 1000000 ([fandom](https://industrialist.fandom.com/wiki/Gold/10_Karat_Gold)) |
| [`industrial_sawmill_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Industrial_Sawmill) | Industrial Sawmill | 8 Oak Log → 16 Cut Oak Log | inputs.oak-log | Miraheze : 8 ; Fandom : 4 | 4 ([fandom](https://industrialist.fandom.com/wiki/Cut_Oak_Log)) |
| [`industrial_sawmill_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Industrial_Sawmill) | Industrial Sawmill | 8 Oak Log → 16 Cut Oak Log | outputs.cut-oak-log | Miraheze : 16 ; Fandom : 8 | 8 ([fandom](https://industrialist.fandom.com/wiki/Cut_Oak_Log)) |
| [`industrial_sawmill_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Industrial_Sawmill) | Industrial Sawmill | 8 Cut Oak Log → 8 Chunk Plank | inputs.cut-oak-log | Miraheze : 8 ; Fandom : 4 | 4 ([fandom](https://industrialist.fandom.com/wiki/Chunk_Plank)) |
| [`industrial_sawmill_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Industrial_Sawmill) | Industrial Sawmill | 8 Cut Oak Log → 8 Chunk Plank | outputs.chunk-plank | Miraheze : 8 ; Fandom : 4 | 4 ([fandom](https://industrialist.fandom.com/wiki/Chunk_Plank)) |
| [`industrial_sawmill_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Industrial_Sawmill) | Industrial Sawmill | 8 Chunk Plank → 24 Planks | inputs.chunk-plank | Miraheze : 8 ; Fandom : 4 | 4 ([fandom](https://industrialist.fandom.com/wiki/Chunk_Plank)) |
| [`industrial_sawmill_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Industrial_Sawmill) | Industrial Sawmill | 8 Chunk Plank → 24 Planks | outputs.planks | Miraheze : 24 ; Fandom : 12 | 12 ([fandom](https://industrialist.fandom.com/wiki/Chunk_Plank)) |
| [`industrial_sawmill_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Industrial_Sawmill) | Industrial Sawmill | 3 Iron Ingot → 12 Iron Plate | durationS | Miraheze : 10 ; Fandom : 8 | 8 ([fandom](https://industrialist.fandom.com/wiki/Iron_Plate)) |
| [`ingot_molder_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Copper → 2 Copper Ingot | durationS | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Copper_Ingot)) |
| [`ingot_molder_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Copper → 2 Copper Ingot | inputs.liquid-copper | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Copper_Ingot)) |
| [`ingot_molder_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Copper → 2 Copper Ingot | outputs.copper-ingot | Miraheze : 2 ; Fandom : 1 | 1 ([fandom](https://industrialist.fandom.com/wiki/Copper_Ingot)) |
| [`ingot_molder_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Sulfur → 2 Sulfur | durationS | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Liquid_Sulfur)) |
| [`ingot_molder_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Sulfur → 2 Sulfur | inputs.liquid-sulfur | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Liquid_Sulfur)) |
| [`ingot_molder_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Sulfur → 2 Sulfur | outputs.sulfur | Miraheze : 2 ; Fandom : 1 | 1 ([fandom](https://industrialist.fandom.com/wiki/Liquid_Sulfur)) |
| [`ingot_molder_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Iron → 2 Iron Ingot | durationS | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`ingot_molder_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Iron → 2 Iron Ingot | inputs.liquid-iron | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`ingot_molder_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Iron → 2 Iron Ingot | outputs.iron-ingot | Miraheze : 2 ; Fandom : 1 | 1 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`ingot_molder_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Gold → 2 Gold Ingot | durationS | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Gold_Ingot)) |
| [`ingot_molder_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Gold → 2 Gold Ingot | inputs.liquid-gold | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Gold_Ingot)) |
| [`ingot_molder_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Gold → 2 Gold Ingot | outputs.gold-ingot | Miraheze : 2 ; Fandom : 1 | 1 ([fandom](https://industrialist.fandom.com/wiki/Gold_Ingot)) |
| [`ingot_molder_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Molten Ferroaluminium Alloy → 2 Ferroaluminium Alloy Ingot | durationS | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Ferroaluminium_Alloy_Ingot)) |
| [`ingot_molder_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Molten Ferroaluminium Alloy → 2 Ferroaluminium Alloy Ingot | inputs.molten-ferroaluminium-alloy | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Ferroaluminium_Alloy_Ingot)) |
| [`ingot_molder_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Molten Ferroaluminium Alloy → 2 Ferroaluminium Alloy Ingot | outputs.ferroaluminium-alloy-ingot | Miraheze : 2 ; Fandom : 1 | 1 ([fandom](https://industrialist.fandom.com/wiki/Ferroaluminium_Alloy_Ingot)) |
| [`ingot_molder_06`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Molten Purple Gold → 2 Purple Gold Ingot | durationS | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Molten_Purple_Gold)) |
| [`ingot_molder_06`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Molten Purple Gold → 2 Purple Gold Ingot | inputs.molten-purple-gold | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Molten_Purple_Gold)) |
| [`ingot_molder_06`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Molten Purple Gold → 2 Purple Gold Ingot | outputs.purple-gold-ingot | Miraheze : 2 ; Fandom : 1 | 1 ([fandom](https://industrialist.fandom.com/wiki/Molten_Purple_Gold)) |
| [`ingot_molder_07`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Aluminium → 2 Aluminium Ingot | durationS | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Aluminium_Ingot)) |
| [`ingot_molder_07`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Aluminium → 2 Aluminium Ingot | inputs.liquid-aluminium | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Aluminium_Ingot)) |
| [`ingot_molder_07`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Aluminium → 2 Aluminium Ingot | outputs.aluminium-ingot | Miraheze : 2 ; Fandom : 1 | 1 ([fandom](https://industrialist.fandom.com/wiki/Aluminium_Ingot)) |
| [`ingot_molder_08`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Glass → 2 Glass | durationS | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Glass)) |
| [`ingot_molder_08`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Glass → 2 Glass | inputs.liquid-glass | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Glass)) |
| [`ingot_molder_08`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 4 Liquid Glass → 2 Glass | outputs.glass | Miraheze : 2 ; Fandom : 1 | 1 ([fandom](https://industrialist.fandom.com/wiki/Glass)) |
| [`ingot_molder_09`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 8 Liquid Lead → 4 Lead Ingot | durationS | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Lead_Ingot)) |
| [`ingot_molder_09`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 8 Liquid Lead → 4 Lead Ingot | inputs.liquid-lead | Miraheze : 8 ; Fandom : 4 | 4 ([fandom](https://industrialist.fandom.com/wiki/Lead_Ingot)) |
| [`ingot_molder_09`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 8 Liquid Lead → 4 Lead Ingot | outputs.lead-ingot | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Lead_Ingot)) |
| [`ingot_molder_10`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 8 Liquid Brass → 4 Brass Ingot | durationS | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Brass_Ingot)) |
| [`ingot_molder_10`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 8 Liquid Brass → 4 Brass Ingot | inputs.liquid-brass | Miraheze : 8 ; Fandom : 4 | 4 ([fandom](https://industrialist.fandom.com/wiki/Brass_Ingot)) |
| [`ingot_molder_10`](https://industrialist.miraheze.org/wiki/Module:Recipes/Ingot_Molder) | Ingot Molder | 8 Liquid Brass → 4 Brass Ingot | outputs.brass-ingot | Miraheze : 4 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/Brass_Ingot)) |
| [`large_pumpjack_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Large_Pumpjack) | Large Pumpjack | ∅ → 1 Crude Oil | energyMFps | Miraheze : 30000 ; Fandom : 600000 | 600000 ([fandom](https://industrialist.fandom.com/wiki/Crude_Oil)) |
| [`large_pumpjack_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Large_Pumpjack) | Large Pumpjack | 1 Hydrochloric Acid → 2.5 Crude Oil | energyMFps | Miraheze : 15000 ; Fandom : 300000 | 300000 ([fandom](https://industrialist.fandom.com/wiki/Crude_Oil)) |
| [`large_pumpjack_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Large_Pumpjack) | Large Pumpjack | 1 Sulfuric Acid → 3 Crude Oil | energyMFps | Miraheze : 30000 ; Fandom : 600000 | 600000 ([fandom](https://industrialist.fandom.com/wiki/Crude_Oil)) |
| [`large_pumpjack_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Large_Pumpjack) | Large Pumpjack | 1 Acetic Acid → 2 Crude Oil | energyMFps | Miraheze : 30000 ; Fandom : 600000 | 600000 ([fandom](https://industrialist.fandom.com/wiki/Acetic_Acid)) |
| [`large_pumpjack_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Large_Pumpjack) | Large Pumpjack | 1 Acetic Acid → 2 Crude Oil | outputs.crude-oil | Miraheze : 2 ; Fandom : 1 | 1 ([fandom](https://industrialist.fandom.com/wiki/Crude_Oil)) |
| [`lathe_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Lathe) | Lathe | 60 Steel Coil → 60 Steel Rod | energyMFps | Miraheze : 100000 ; Fandom : 500000 | 500000 ([fandom](https://industrialist.fandom.com/wiki/Steel_Coil)) |
| [`lathe_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Lathe) | Lathe | 60 Steel Coil → 60 Steel Rod | outputs.steel-rod | Miraheze : 60 ; Fandom : 30 | 30 ([fandom](https://industrialist.fandom.com/wiki/Steel_Coil)) |
| [`lng_plant_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/LNG_Plant) | LNG Plant | 120 Refined Gas → 6.6 LNG | energyMFps | Miraheze : 2250000 ; Fandom : 750000 | 750000 ([fandom](https://industrialist.fandom.com/wiki/LNG)) |
| [`lng_plant_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/LNG_Plant) | LNG Plant | 120 Refined Gas → 6.6 LNG | outputs.lng | Miraheze : 6.6 ; Fandom : 7.2 | 7.2 ([fandom](https://industrialist.fandom.com/wiki/Refined_Gas)) |
| [`oil_fracking_tower_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Oil_Fracking_Tower) | Oil Fracking Tower | 16 Sand + 7.5 Sulfuric Acid + 40 Water + 200 Steam → 100 Fracking Oil | energyMFps | Miraheze : 62500 ; Fandom : 62.5 | 62.5 ([fandom](https://industrialist.fandom.com/wiki/Sulfuric_Acid)) |
| [`oxidation_plant_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Oxidation_Plant) | Oxidation Plant | 60 Ethanol + 5 Oxygen → 60 Acetic Acid | inputs.oxygen | Miraheze : 5 ; Fandom : 60 | 60 ([fandom](https://industrialist.fandom.com/wiki/Acetic_Acid)) |
| [`plastic_molding_machine_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Plastic_Molding_Machine) | Plastic Molding Machine | 20 Plastic Pellets → 2 Plastic Bottle | durationS | Miraheze : 7 ; Fandom : 5 | 5 ([fandom](https://industrialist.fandom.com/wiki/Plastic_Pellets)) |
| [`plastic_molding_machine_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Plastic_Molding_Machine) | Plastic Molding Machine | 20 Plastic Pellets → 2 Plastic Bottle | energyMFps | Miraheze : 14000 ; Fandom : 1000000 | 1000000 ([fandom](https://industrialist.fandom.com/wiki/Plastic_Pellets)) |
| [`plastic_production_facility_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Plastic_Production_Facility) | Plastic Production Facility | 1 MEG + 1 PTA → 80 Plastic Pellets | durationS | Miraheze : 6 ; Fandom : 6.67 | 6.67 ([fandom](https://industrialist.fandom.com/wiki/MEG)) |
| [`precision_assembler_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Precision_Assembler) | Precision Assembler | 6 Logic Plate + 16 Copper Wire + 5 Semiconductor + 10 Gold Wire → 1 8x Microchip | energyMFps | Miraheze : 167000 ; Fandom : 160000 | 160000 ([fandom](https://industrialist.fandom.com/wiki/Copper_Wire)) |
| [`precision_assembler_08`](https://industrialist.miraheze.org/wiki/Module:Recipes/Precision_Assembler) | Precision Assembler | 1 Zirconium Rod + 20 Plutonium Oxide Pellets + 10 Yellowcake → 1 MOX Fuel Rod | outputs.mox-fuel-rod | Miraheze : 1 ; Fandom : 2 | 2 ([fandom](https://industrialist.fandom.com/wiki/MOX_Fuel_Rod)) |
| [`press_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press) | Press | 1 Copper Ingot → 1 Copper Plate | durationS | Miraheze : 4 ; Fandom : 3.1 | 3.1 ([fandom](https://industrialist.fandom.com/wiki/Copper_Ingot)) |
| [`press_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press) | Press | 1 Copper Ingot → 1 Copper Plate | energyMFps | Miraheze : 1000 ; Fandom : 1290 | 1290 ([fandom](https://industrialist.fandom.com/wiki/Copper_Ingot)) |
| [`press_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press) | Press | 1 Iron Ingot → 1 Iron Plate | durationS | Miraheze : 4 ; Fandom : 5.1 | 5.1 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`press_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press) | Press | 1 Iron Ingot → 1 Iron Plate | energyMFps | Miraheze : 2000 ; Fandom : 784 | 784 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`press_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press) | Press | 1 Steel Ingot → 1 Steel Plate | durationS | Miraheze : 4 ; Fandom : 5.1 | 5.1 ([fandom](https://industrialist.fandom.com/wiki/Steel_Ingot)) |
| [`press_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press) | Press | 1 Steel Ingot → 1 Steel Plate | energyMFps | Miraheze : 12500 ; Fandom : 9804 | 9804 ([fandom](https://industrialist.fandom.com/wiki/Steel_Ingot)), 4000 ([fandom](https://industrialist.fandom.com/wiki/Steel_Plate)) |
| [`press_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press) | Press | 1 Planks → 0.25 Plank^2 | durationS | Miraheze : 4 ; Fandom : 5.1 | 5.1 ([fandom](https://industrialist.fandom.com/wiki/Plank%5E2)) |
| [`press_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press) | Press | 1 Planks → 0.25 Plank^2 | energyMFps | Miraheze : 6250 ; Fandom : 784 | 784 ([fandom](https://industrialist.fandom.com/wiki/Plank%5E2)) |
| [`press_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press) | Press | 1 Iron Plate → 0.25 Iron Plate^2 | durationS | Miraheze : 4 ; Fandom : 5.1 | 5.1 ([fandom](https://industrialist.fandom.com/wiki/Iron_Plate)) |
| [`press_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press) | Press | 1 Iron Plate → 0.25 Iron Plate^2 | energyMFps | Miraheze : 6250 ; Fandom : 59 | 59 ([fandom](https://industrialist.fandom.com/wiki/Iron_Plate)) |
| [`press_mk2_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press_MK2) | Press MK2 | 20 Iron Ingot → 20 Iron Plate | energyMFps | Miraheze : 50000 ; Fandom : 75000 | 75000 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`press_mk2_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press_MK2) | Press MK2 | 20 Steel Ingot → 20 Steel Plate | energyMFps | Miraheze : 75000 ; Fandom : 500000 | 500000 ([fandom](https://industrialist.fandom.com/wiki/Steel_Ingot)), 125000 ([fandom](https://industrialist.fandom.com/wiki/Steel_Plate)) |
| [`press_mk2_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press_MK2) | Press MK2 | 20 Copper Ingot → 20 Copper Plate | energyMFps | Miraheze : 25000 ; Fandom : 75000 | 75000 ([fandom](https://industrialist.fandom.com/wiki/Copper_Ingot)) |
| [`press_mk2_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press_MK2) | Press MK2 | 3 Powdered Tungsten Carbide → 1.5 Tungsten Carbide Plate | energyMFps | Miraheze : 250000 ; Fandom : 1250000 | 1250000 ([fandom](https://industrialist.fandom.com/wiki/Powdered_Tungsten_Carbide)) |
| [`press_mk2_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press_MK2) | Press MK2 | 20 Steel Plate → 20 Gear | energyMFps | Miraheze : 75000 ; Fandom : 500000 | 500000 ([fandom](https://industrialist.fandom.com/wiki/Gear)) |
| [`press_mk2_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Press_MK2) | Press MK2 | 20 Steel Plate → 20 Gear | outputs.gear | Miraheze : 20 ; Fandom : 10 | 10 ([fandom](https://industrialist.fandom.com/wiki/Gear)) |
| [`pressurized_water_filter_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Pressurized_Water_Filter) | Pressurized Water Filter | 4 10 Karat Gold + 20 Water → 4 Residue + 2 12 Karat Gold | outputs.residue | Miraheze : 4 ; Fandom : 8 | 8 ([fandom](https://industrialist.fandom.com/wiki/Gold/10_Karat_Gold)) |
| [`roller_mk2_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Roller_MK2) | Roller MK2 | 20 Copper Plate → 120 Copper Wire | energyMFps | Miraheze : 25000 ; Fandom : 50000 | 50000 ([fandom](https://industrialist.fandom.com/wiki/Copper_Plate)) |
| [`roller_mk2_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Roller_MK2) | Roller MK2 | 20 Steel Ingot → 20 Steel Coil | energyMFps | Miraheze : 75000 ; Fandom : 200000 | 200000 ([fandom](https://industrialist.fandom.com/wiki/Steel_Coil)) |
| [`roller_mk2_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Roller_MK2) | Roller MK2 | 4 Gold Ingot → 40 Gold Wire | energyMFps | Miraheze : 25000 ; Fandom : 50000 | 50000 ([fandom](https://industrialist.fandom.com/wiki/Gold_Ingot)) |
| [`sawmill_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Sawmill) | Sawmill | 1 Oak Log → 2 Cut Oak Log | energyMFps | Miraheze : 3000 ; Fandom : 2927 | 2927 ([fandom](https://industrialist.fandom.com/wiki/Cut_Oak_Log)) |
| [`sawmill_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Sawmill) | Sawmill | 1 Cut Oak Log → 1 Chunk Plank | energyMFps | Miraheze : 3000 ; Fandom : 2927 | 2927 ([fandom](https://industrialist.fandom.com/wiki/Chunk_Plank)) |
| [`sawmill_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Sawmill) | Sawmill | 1 Chunk Plank → 3 Planks | energyMFps | Miraheze : 3000 ; Fandom : 2927 | 2927 ([fandom](https://industrialist.fandom.com/wiki/Chunk_Plank)) |
| [`sawmill_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Sawmill) | Sawmill | 1 Iron Ingot → 4 Iron Plate | energyMFps | Miraheze : 3000 ; Fandom : 2927 | 2927 ([fandom](https://industrialist.fandom.com/wiki/Iron_Ingot)) |
| [`trommel_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Trommel) | Trommel | 5.6 Hydrochloric Acid + 29 Deep Earth Fragment → 11.2 18 Karat Gold + 10 Bauxite Residue | inputs.hydrochloric-acid | Miraheze : 5.6 ; Fandom : 4 | 4 ([fandom](https://industrialist.fandom.com/wiki/Bauxite_Residue)) |
| [`trommel_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Trommel) | Trommel | 5.6 Hydrochloric Acid + 29 Deep Earth Fragment → 11.2 18 Karat Gold + 10 Bauxite Residue | inputs.deep-earth-fragment | Miraheze : 29 ; Fandom : 20 | 20 ([fandom](https://industrialist.fandom.com/wiki/Bauxite_Residue)) |
| [`trommel_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Trommel) | Trommel | 28 Water + 14 Treated Rock → 7 10 Karat Gold + 14 Rich Soil + 7 Raw Lead + 14 Bauxite Residue | outputs.bauxite-residue | Miraheze : 14 ; Fandom : 7 | 7 ([fandom](https://industrialist.fandom.com/wiki/Raw_Lead)) |
| [`water_treatment_plant_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Water_Treatment_Plant) | Water Treatment Plant | 64 Water + 90 Steam → 64 Distilled Water | inputs.water | Miraheze : 64 ; Fandom : 32 | 32 ([fandom](https://industrialist.fandom.com/wiki/Distilled_Water)) |
| [`water_treatment_plant_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Water_Treatment_Plant) | Water Treatment Plant | 64 Water + 90 Steam → 64 Distilled Water | outputs.distilled-water | Miraheze : 64 ; Fandom : 32 | 32 ([fandom](https://industrialist.fandom.com/wiki/Distilled_Water)) |

### Valeurs variables (dépendent d'un réglage du jeu) — 18

Le wiki donne une valeur de base et un mode (vitesse du Chemical Plant, température de vapeur, pollution…). Le moteur n'utilise ces recettes que si l'option est activée.

| Recette | Machine | Entrées → sorties | Champ | Détail | Alternatives |
|---|---|---|---|---|---|
| [`air_separation_unit_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Air_Separation_Unit) | Air Separation Unit | ∅ → 60 Liquid Nitrogen + 15 Liquid Oxygen + 3 Liquid Argon + — Residue | outputs.residue | quantité de Residue variable (mode « world_pollution ») |  |
| [`cat_assembler_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Cat_Assembler) | Cat Assembler | 31 Gasoline + 4 Electric Motor + 15 Sulfur → 1 Cat | energyMFps | énergie variable (mode « maxwell »), valeur de base 0MF |  |
| [`chemical_plant_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 30 Hydrogen + 10 Nitrogen → 20 Ammonia | inputs.hydrogen | quantité de Hydrogen variable (mode « plant_speed_efficency »), valeur de base 30 |  |
| [`chemical_plant_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 30 Hydrogen + 10 Nitrogen → 20 Ammonia | inputs.nitrogen | quantité de Nitrogen variable (mode « plant_speed_efficency »), valeur de base 10 |  |
| [`chemical_plant_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 30 Hydrogen + 10 Nitrogen → 20 Ammonia | outputs.ammonia | quantité de Ammonia variable (mode « plant_speed »), valeur de base 20 |  |
| [`chemical_plant_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 25 Ammonia + 5 Naphtha → 50 Hardened Plastic Pellets | energyMFps | énergie variable (mode « plant_speed_efficency »), valeur de base 1MMF |  |
| [`chemical_plant_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 25 Ammonia + 5 Naphtha → 50 Hardened Plastic Pellets | inputs.ammonia | quantité de Ammonia variable (mode « plant_speed_efficency »), valeur de base 25 |  |
| [`chemical_plant_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 25 Ammonia + 5 Naphtha → 50 Hardened Plastic Pellets | inputs.naphtha | quantité de Naphtha variable (mode « plant_speed_efficency »), valeur de base 5 |  |
| [`chemical_plant_02`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 25 Ammonia + 5 Naphtha → 50 Hardened Plastic Pellets | outputs.hardened-plastic-pellets | quantité de Hardened Plastic Pellets variable (mode « plant_speed »), valeur de base 50 |  |
| [`chemical_plant_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 90 Steam + 60 Refined Gas → 15 Hydrogen | energyMFps | énergie variable (mode « plant_speed_efficency »), valeur de base 500kMF |  |
| [`chemical_plant_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 90 Steam + 60 Refined Gas → 15 Hydrogen | inputs.steam | quantité de Steam variable (mode « plant_speed_efficency »), valeur de base 90 |  |
| [`chemical_plant_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 90 Steam + 60 Refined Gas → 15 Hydrogen | inputs.refined-gas | quantité de Refined Gas variable (mode « plant_speed_efficency »), valeur de base 60 |  |
| [`chemical_plant_03`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 90 Steam + 60 Refined Gas → 15 Hydrogen | outputs.hydrogen | quantité de Hydrogen variable (mode « plant_speed »), valeur de base 15 |  |
| [`chemical_plant_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Yellowcake + 0.5 Hydrofluoric Acid → 1.5 Unenriched UF6 Gas | energyMFps | énergie variable (mode « plant_speed_efficency »), valeur de base 500kMF |  |
| [`chemical_plant_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Yellowcake + 0.5 Hydrofluoric Acid → 1.5 Unenriched UF6 Gas | inputs.yellowcake | quantité de Yellowcake variable (mode « plant_speed_efficency »), valeur de base 0.5 |  |
| [`chemical_plant_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Yellowcake + 0.5 Hydrofluoric Acid → 1.5 Unenriched UF6 Gas | inputs.hydrofluoric-acid | quantité de Hydrofluoric Acid variable (mode « plant_speed_efficency »), valeur de base 0.5 |  |
| [`chemical_plant_04`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Yellowcake + 0.5 Hydrofluoric Acid → 1.5 Unenriched UF6 Gas | outputs.unenriched-uf6-gas | quantité de Unenriched UF6 Gas variable (mode « plant_speed »), valeur de base 1.5 |  |
| [`chemical_plant_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Mixed Fissile Oxides + 0.5 Hydrochloric Acid + 0.5 Sodium Hydroxide Solution + 30 Argon → 3 Residue + 0.1 Reprocessed Uranium + 0.05 Plutonium Oxide Pellets | energyMFps | énergie variable (mode « plant_speed_efficency »), valeur de base 500kMF |  |
| [`chemical_plant_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Mixed Fissile Oxides + 0.5 Hydrochloric Acid + 0.5 Sodium Hydroxide Solution + 30 Argon → 3 Residue + 0.1 Reprocessed Uranium + 0.05 Plutonium Oxide Pellets | inputs.mixed-fissile-oxides | quantité de Mixed Fissile Oxides variable (mode « plant_speed_efficency »), valeur de base 0.5 |  |
| [`chemical_plant_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Mixed Fissile Oxides + 0.5 Hydrochloric Acid + 0.5 Sodium Hydroxide Solution + 30 Argon → 3 Residue + 0.1 Reprocessed Uranium + 0.05 Plutonium Oxide Pellets | inputs.hydrochloric-acid | quantité de Hydrochloric Acid variable (mode « plant_speed_efficency »), valeur de base 0.5 |  |
| [`chemical_plant_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Mixed Fissile Oxides + 0.5 Hydrochloric Acid + 0.5 Sodium Hydroxide Solution + 30 Argon → 3 Residue + 0.1 Reprocessed Uranium + 0.05 Plutonium Oxide Pellets | inputs.sodium-hydroxide-solution | quantité de Sodium Hydroxide Solution variable (mode « plant_speed_efficency »), valeur de base 0.5 |  |
| [`chemical_plant_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Mixed Fissile Oxides + 0.5 Hydrochloric Acid + 0.5 Sodium Hydroxide Solution + 30 Argon → 3 Residue + 0.1 Reprocessed Uranium + 0.05 Plutonium Oxide Pellets | inputs.argon | quantité de Argon variable (mode « plant_speed_efficency »), valeur de base 30 |  |
| [`chemical_plant_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Mixed Fissile Oxides + 0.5 Hydrochloric Acid + 0.5 Sodium Hydroxide Solution + 30 Argon → 3 Residue + 0.1 Reprocessed Uranium + 0.05 Plutonium Oxide Pellets | outputs.residue | quantité de Residue variable (mode « plant_speed »), valeur de base 3 |  |
| [`chemical_plant_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Mixed Fissile Oxides + 0.5 Hydrochloric Acid + 0.5 Sodium Hydroxide Solution + 30 Argon → 3 Residue + 0.1 Reprocessed Uranium + 0.05 Plutonium Oxide Pellets | outputs.reprocessed-uranium | quantité de Reprocessed Uranium variable (mode « plant_speed »), valeur de base 0.1 |  |
| [`chemical_plant_05`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Mixed Fissile Oxides + 0.5 Hydrochloric Acid + 0.5 Sodium Hydroxide Solution + 30 Argon → 3 Residue + 0.1 Reprocessed Uranium + 0.05 Plutonium Oxide Pellets | outputs.plutonium-oxide-pellets | quantité de Plutonium Oxide Pellets variable (mode « plant_speed »), valeur de base 0.05 |  |
| [`chemical_plant_06`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Deep Earth Fragment + 0.5 Sulfuric Acid → 2 Hydrofluoric Acid + 2 Residue | energyMFps | énergie variable (mode « plant_speed_efficency »), valeur de base 100kMF |  |
| [`chemical_plant_06`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Deep Earth Fragment + 0.5 Sulfuric Acid → 2 Hydrofluoric Acid + 2 Residue | inputs.deep-earth-fragment | quantité de Deep Earth Fragment variable (mode « plant_speed_efficency »), valeur de base 0.5 |  |
| [`chemical_plant_06`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Deep Earth Fragment + 0.5 Sulfuric Acid → 2 Hydrofluoric Acid + 2 Residue | inputs.sulfuric-acid | quantité de Sulfuric Acid variable (mode « plant_speed_efficency »), valeur de base 0.5 |  |
| [`chemical_plant_06`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Deep Earth Fragment + 0.5 Sulfuric Acid → 2 Hydrofluoric Acid + 2 Residue | outputs.hydrofluoric-acid | quantité de Hydrofluoric Acid variable (mode « plant_speed »), valeur de base 2 |  |
| [`chemical_plant_06`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.5 Deep Earth Fragment + 0.5 Sulfuric Acid → 2 Hydrofluoric Acid + 2 Residue | outputs.residue | quantité de Residue variable (mode « plant_speed »), valeur de base 2 |  |
| [`chemical_plant_07`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1 Reprocessed Uranium + 0.5 Hydrofluoric Acid → 2 Slightly Enriched UF6 Gas | energyMFps | énergie variable (mode « plant_speed_efficency »), valeur de base 100kMF |  |
| [`chemical_plant_07`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1 Reprocessed Uranium + 0.5 Hydrofluoric Acid → 2 Slightly Enriched UF6 Gas | inputs.reprocessed-uranium | quantité de Reprocessed Uranium variable (mode « plant_speed_efficency »), valeur de base 1 |  |
| [`chemical_plant_07`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1 Reprocessed Uranium + 0.5 Hydrofluoric Acid → 2 Slightly Enriched UF6 Gas | inputs.hydrofluoric-acid | quantité de Hydrofluoric Acid variable (mode « plant_speed_efficency »), valeur de base 0.5 |  |
| [`chemical_plant_07`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1 Reprocessed Uranium + 0.5 Hydrofluoric Acid → 2 Slightly Enriched UF6 Gas | outputs.slightly-enriched-uf6-gas | quantité de Slightly Enriched UF6 Gas variable (mode « plant_speed »), valeur de base 2 |  |
| [`chemical_plant_08`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.6 Impure Boron + 0.5 Hydrochloric Acid → 2 Boric Acid + 2 Residue | energyMFps | énergie variable (mode « plant_speed_efficency »), valeur de base 250kMF |  |
| [`chemical_plant_08`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.6 Impure Boron + 0.5 Hydrochloric Acid → 2 Boric Acid + 2 Residue | inputs.impure-boron | quantité de Impure Boron variable (mode « plant_speed_efficency »), valeur de base 1.6 |  |
| [`chemical_plant_08`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.6 Impure Boron + 0.5 Hydrochloric Acid → 2 Boric Acid + 2 Residue | inputs.hydrochloric-acid | quantité de Hydrochloric Acid variable (mode « plant_speed_efficency »), valeur de base 0.5 |  |
| [`chemical_plant_08`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.6 Impure Boron + 0.5 Hydrochloric Acid → 2 Boric Acid + 2 Residue | outputs.boric-acid | quantité de Boric Acid variable (mode « plant_speed »), valeur de base 2 |  |
| [`chemical_plant_08`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.6 Impure Boron + 0.5 Hydrochloric Acid → 2 Boric Acid + 2 Residue | outputs.residue | quantité de Residue variable (mode « plant_speed »), valeur de base 2 |  |
| [`chemical_plant_09`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.6 Impure Boron + 0.35 Sulfuric Acid → 2 Boric Acid + 2 Residue | energyMFps | énergie variable (mode « plant_speed_efficency »), valeur de base 250kMF |  |
| [`chemical_plant_09`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.6 Impure Boron + 0.35 Sulfuric Acid → 2 Boric Acid + 2 Residue | inputs.impure-boron | quantité de Impure Boron variable (mode « plant_speed_efficency »), valeur de base 1.6 |  |
| [`chemical_plant_09`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.6 Impure Boron + 0.35 Sulfuric Acid → 2 Boric Acid + 2 Residue | inputs.sulfuric-acid | quantité de Sulfuric Acid variable (mode « plant_speed_efficency »), valeur de base 0.35 |  |
| [`chemical_plant_09`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.6 Impure Boron + 0.35 Sulfuric Acid → 2 Boric Acid + 2 Residue | outputs.boric-acid | quantité de Boric Acid variable (mode « plant_speed »), valeur de base 2 |  |
| [`chemical_plant_09`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.6 Impure Boron + 0.35 Sulfuric Acid → 2 Boric Acid + 2 Residue | outputs.residue | quantité de Residue variable (mode « plant_speed »), valeur de base 2 |  |
| [`chemical_plant_10`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 2 Shallow Earth Fragment + 6 Hydrochloric Acid → 3 Phosphorus Oxychloride + 2 Residue | energyMFps | énergie variable (mode « plant_speed_efficency »), valeur de base 1MMF |  |
| [`chemical_plant_10`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 2 Shallow Earth Fragment + 6 Hydrochloric Acid → 3 Phosphorus Oxychloride + 2 Residue | inputs.shallow-earth-fragment | quantité de Shallow Earth Fragment variable (mode « plant_speed_efficency »), valeur de base 2 |  |
| [`chemical_plant_10`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 2 Shallow Earth Fragment + 6 Hydrochloric Acid → 3 Phosphorus Oxychloride + 2 Residue | inputs.hydrochloric-acid | quantité de Hydrochloric Acid variable (mode « plant_speed_efficency »), valeur de base 6 |  |
| [`chemical_plant_10`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 2 Shallow Earth Fragment + 6 Hydrochloric Acid → 3 Phosphorus Oxychloride + 2 Residue | outputs.phosphorus-oxychloride | quantité de Phosphorus Oxychloride variable (mode « plant_speed »), valeur de base 3 |  |
| [`chemical_plant_10`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 2 Shallow Earth Fragment + 6 Hydrochloric Acid → 3 Phosphorus Oxychloride + 2 Residue | outputs.residue | quantité de Residue variable (mode « plant_speed »), valeur de base 2 |  |
| [`chemical_plant_11`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.5 Phosphorus Oxychloride + 1.5 Ethanol + 90 Steam → 1 Tributyl Phosphate + 1 Hydrochloric Acid | energyMFps | énergie variable (mode « plant_speed_efficency »), valeur de base 1.1MMF |  |
| [`chemical_plant_11`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.5 Phosphorus Oxychloride + 1.5 Ethanol + 90 Steam → 1 Tributyl Phosphate + 1 Hydrochloric Acid | inputs.phosphorus-oxychloride | quantité de Phosphorus Oxychloride variable (mode « plant_speed_efficency »), valeur de base 1.5 |  |
| [`chemical_plant_11`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.5 Phosphorus Oxychloride + 1.5 Ethanol + 90 Steam → 1 Tributyl Phosphate + 1 Hydrochloric Acid | inputs.ethanol | quantité de Ethanol variable (mode « plant_speed_efficency »), valeur de base 1.5 |  |
| [`chemical_plant_11`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.5 Phosphorus Oxychloride + 1.5 Ethanol + 90 Steam → 1 Tributyl Phosphate + 1 Hydrochloric Acid | inputs.steam | quantité de Steam variable (mode « plant_speed_efficency »), valeur de base 90 |  |
| [`chemical_plant_11`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.5 Phosphorus Oxychloride + 1.5 Ethanol + 90 Steam → 1 Tributyl Phosphate + 1 Hydrochloric Acid | outputs.tributyl-phosphate | quantité de Tributyl Phosphate variable (mode « plant_speed »), valeur de base 1 |  |
| [`chemical_plant_11`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 1.5 Phosphorus Oxychloride + 1.5 Ethanol + 90 Steam → 1 Tributyl Phosphate + 1 Hydrochloric Acid | outputs.hydrochloric-acid | quantité de Hydrochloric Acid variable (mode « plant_speed »), valeur de base 1 |  |
| [`chemical_plant_12`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.05 Enriched UF6 Gas + 90 Steam + 1 Tributyl Phosphate → 0.05 Enriched UO2 Pellets + 5 Residue | energyMFps | énergie variable (mode « plant_speed_efficency »), valeur de base 2MMF |  |
| [`chemical_plant_12`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.05 Enriched UF6 Gas + 90 Steam + 1 Tributyl Phosphate → 0.05 Enriched UO2 Pellets + 5 Residue | inputs.enriched-uf6-gas | quantité de Enriched UF6 Gas variable (mode « plant_speed_efficency »), valeur de base 0.05 |  |
| [`chemical_plant_12`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.05 Enriched UF6 Gas + 90 Steam + 1 Tributyl Phosphate → 0.05 Enriched UO2 Pellets + 5 Residue | inputs.steam | quantité de Steam variable (mode « plant_speed_efficency »), valeur de base 90 |  |
| [`chemical_plant_12`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.05 Enriched UF6 Gas + 90 Steam + 1 Tributyl Phosphate → 0.05 Enriched UO2 Pellets + 5 Residue | inputs.tributyl-phosphate | quantité de Tributyl Phosphate variable (mode « plant_speed_efficency »), valeur de base 1 |  |
| [`chemical_plant_12`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.05 Enriched UF6 Gas + 90 Steam + 1 Tributyl Phosphate → 0.05 Enriched UO2 Pellets + 5 Residue | outputs.enriched-uo2-pellets | quantité de Enriched UO2 Pellets variable (mode « plant_speed »), valeur de base 0.05 |  |
| [`chemical_plant_12`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.05 Enriched UF6 Gas + 90 Steam + 1 Tributyl Phosphate → 0.05 Enriched UO2 Pellets + 5 Residue | outputs.residue | quantité de Residue variable (mode « plant_speed »), valeur de base 5 |  |
| [`chemical_plant_13`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.02 Enriched UF6 Gas + 90 Steam + 4 Hydrogen → 0.01 Enriched UO2 Pellets + 5 Residue | energyMFps | énergie variable (mode « plant_speed_efficency »), valeur de base 2.5MMF |  |
| [`chemical_plant_13`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.02 Enriched UF6 Gas + 90 Steam + 4 Hydrogen → 0.01 Enriched UO2 Pellets + 5 Residue | inputs.enriched-uf6-gas | quantité de Enriched UF6 Gas variable (mode « plant_speed_efficency »), valeur de base 0.02 |  |
| [`chemical_plant_13`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.02 Enriched UF6 Gas + 90 Steam + 4 Hydrogen → 0.01 Enriched UO2 Pellets + 5 Residue | inputs.steam | quantité de Steam variable (mode « plant_speed_efficency »), valeur de base 90 |  |
| [`chemical_plant_13`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.02 Enriched UF6 Gas + 90 Steam + 4 Hydrogen → 0.01 Enriched UO2 Pellets + 5 Residue | inputs.hydrogen | quantité de Hydrogen variable (mode « plant_speed_efficency »), valeur de base 4 |  |
| [`chemical_plant_13`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.02 Enriched UF6 Gas + 90 Steam + 4 Hydrogen → 0.01 Enriched UO2 Pellets + 5 Residue | outputs.enriched-uo2-pellets | quantité de Enriched UO2 Pellets variable (mode « plant_speed »), valeur de base 0.01 |  |
| [`chemical_plant_13`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 0.02 Enriched UF6 Gas + 90 Steam + 4 Hydrogen → 0.01 Enriched UO2 Pellets + 5 Residue | outputs.residue | quantité de Residue variable (mode « plant_speed »), valeur de base 5 |  |
| [`chemical_plant_14`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 14 Sulfur Trioxide + 11 Distilled Water + 70 Argon → 11 Sulfuric Acid + 2 Residue | energyMFps | énergie variable (mode « plant_speed_efficency »), valeur de base 1.5MMF |  |
| [`chemical_plant_14`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 14 Sulfur Trioxide + 11 Distilled Water + 70 Argon → 11 Sulfuric Acid + 2 Residue | inputs.sulfur-trioxide | quantité de Sulfur Trioxide variable (mode « plant_speed_efficency »), valeur de base 14 |  |
| [`chemical_plant_14`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 14 Sulfur Trioxide + 11 Distilled Water + 70 Argon → 11 Sulfuric Acid + 2 Residue | inputs.distilled-water | quantité de Distilled Water variable (mode « plant_speed_efficency »), valeur de base 11 |  |
| [`chemical_plant_14`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 14 Sulfur Trioxide + 11 Distilled Water + 70 Argon → 11 Sulfuric Acid + 2 Residue | inputs.argon | quantité de Argon variable (mode « plant_speed_efficency »), valeur de base 70 |  |
| [`chemical_plant_14`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 14 Sulfur Trioxide + 11 Distilled Water + 70 Argon → 11 Sulfuric Acid + 2 Residue | outputs.sulfuric-acid | quantité de Sulfuric Acid variable (mode « plant_speed »), valeur de base 11 |  |
| [`chemical_plant_14`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 14 Sulfur Trioxide + 11 Distilled Water + 70 Argon → 11 Sulfuric Acid + 2 Residue | outputs.residue | quantité de Residue variable (mode « plant_speed »), valeur de base 2 |  |
| [`chemical_plant_15`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 20 Chlorine + 20 Hydrogen + 10 Distilled Water + 20 Argon → 10 Hydrochloric Acid | energyMFps | énergie variable (mode « plant_speed_efficency »), valeur de base 1.5MMF |  |
| [`chemical_plant_15`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 20 Chlorine + 20 Hydrogen + 10 Distilled Water + 20 Argon → 10 Hydrochloric Acid | inputs.chlorine | quantité de Chlorine variable (mode « plant_speed_efficency »), valeur de base 20 |  |
| [`chemical_plant_15`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 20 Chlorine + 20 Hydrogen + 10 Distilled Water + 20 Argon → 10 Hydrochloric Acid | inputs.hydrogen | quantité de Hydrogen variable (mode « plant_speed_efficency »), valeur de base 20 |  |
| [`chemical_plant_15`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 20 Chlorine + 20 Hydrogen + 10 Distilled Water + 20 Argon → 10 Hydrochloric Acid | inputs.distilled-water | quantité de Distilled Water variable (mode « plant_speed_efficency »), valeur de base 10 |  |
| [`chemical_plant_15`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 20 Chlorine + 20 Hydrogen + 10 Distilled Water + 20 Argon → 10 Hydrochloric Acid | inputs.argon | quantité de Argon variable (mode « plant_speed_efficency »), valeur de base 20 |  |
| [`chemical_plant_15`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Plant) | Chemical Plant | 20 Chlorine + 20 Hydrogen + 10 Distilled Water + 20 Argon → 10 Hydrochloric Acid | outputs.hydrochloric-acid | quantité de Hydrochloric Acid variable (mode « plant_speed »), valeur de base 10 |  |
| [`logic_assembler_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Logic_Assembler) | Logic Assembler | 3 Logic Plate + 12 Copper Wire + 3 Semiconductor + 6 Gold Wire → 1 2x Microchip | durationS | durée variable (mode « semi-random ») |  |

### Valeurs approximatives — 1

| Recette | Machine | Entrées → sorties | Champ | Détail | Alternatives |
|---|---|---|---|---|---|
| [`tree_01`](https://industrialist.miraheze.org/wiki/Tree) | Tree | ∅ → 2 Oak Log | durationS | « 0% - 5% (Normal) → ~363s (Normal) » : valeur arrondie (~) et dépendante de la pollution |  |
| [`tree_01`](https://industrialist.miraheze.org/wiki/Tree) | Tree | ∅ → 2 Oak Log | outputs.oak-log | le wiki dit « au moins 2 » Oak Logs par arbre |  |

### Valeurs sans source fiable — 3

| Recette | Machine | Entrées → sorties | Champ | Détail | Alternatives |
|---|---|---|---|---|---|
| [`chemical_reactor_07`](https://industrialist.miraheze.org/wiki/Module:Recipes/Chemical_Reactor) | Chemical Reactor | 5 Microchip Scrap + 7 Sulfuric Acid + 20 Distilled Water → 1 Gold Ingot | inputs.sulfuric-acid | Sulfuric Acid apparaît deux fois ; quantités additionnées |  |
| [`heat_exchanger_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Heat_Exchanger) | Heat Exchanger | 800 Distilled Water → 400 Distilled Water + 12000 High Pressure Steam | inputs.distilled-water | Distilled Water apparaît deux fois ; quantités additionnées |  |
| [`vertical_heat_exchanger_01`](https://industrialist.miraheze.org/wiki/Module:Recipes/Vertical_Heat_Exchanger) | Vertical Heat Exchanger | 800 Distilled Water → 400 Distilled Water + 12000 High Pressure Steam | inputs.distilled-water | Distilled Water apparaît deux fois ; quantités additionnées |  |

### Recettes présentes seulement sur Fandom — 54

Fandom n'est plus mis à jour : ces recettes ont peut-être été retirées du jeu ou renommées. Elles ne sont **pas** dans les données.

| Machine | Entrées → sorties | Durée | Énergie | Page |
|---|---|---|---|---|
| Advanced Oil Seperator | 500 steam + 40 crude-oil → 5 residue + 4 coke-fuel + 20 light-oil + 12 hydrogen-sulfide | 10 | 2500000 | [fandom](https://industrialist.fandom.com/wiki/Coke_Fuel) |
| Advanced Oil Seperator | 500 steam + 40 heavy-oil → 10 residue + 44 coke-fuel | 10 | 2500000 | [fandom](https://industrialist.fandom.com/wiki/Coke_Fuel) |
| Advanced Oil Seperator | 500 steam + 40 fracking-oil → 15 residue + 20 heavy-oil | 10 | 2500000 | [fandom](https://industrialist.fandom.com/wiki/Fracking_Oil) |
| Advanced Oil Seperator | 500 steam + 40 light-oil → 15 residue + 10 heavy-oil + 6 hydrogen-sulfide | 10 | 2500000 | [fandom](https://industrialist.fandom.com/wiki/Heavy_Oil) |
| Alloyer | 4 iron-ingot + 2 aluminium-ingot → 2 molten-ferroaluminium-alloy | — | 150000 | [fandom](https://industrialist.fandom.com/wiki/Iron_Ingot) |
| Atmospheric Distillation Plant | 200 fracking-oil → 10 residue + 40 heavy-oil + 80 light-oil + 10 naphta + 20 gasoline + 720 water-free-gas + 20 crude-oil | 8 | 625000 | [fandom](https://industrialist.fandom.com/wiki/Crude_Oil) |
| Chemical Reactor | 5 microchip-scrap + 5 sulfuric-acid → 5 gold-ingot | 6 | 500000 | [fandom](https://industrialist.fandom.com/wiki/Gold_Ingot) |
| Chemical Reactor | 16 heavy-oil + 10 naphta → 4 residue + 8 rubber | 6 | 500000 | [fandom](https://industrialist.fandom.com/wiki/Heavy_Oil) |
| Chemical Reactor | 5 microchip-scrap + 5 sulfuric-acid → 1 gold-ingot | 6 | 500000 | [fandom](https://industrialist.fandom.com/wiki/Microchip_Scrap) |
| Chemical Reactor | 1.4 sulfuric-acid + 4 lithium-ore + 2 lithium-carbonate → 4 lithium-sulfate | 2 | 1500000 | [fandom](https://industrialist.fandom.com/wiki/Sulfuric_Acid) |
| Concrete Plant | 10 cement + 20 aggregate → 20 wet-concrete | 10 | 4000 | [fandom](https://industrialist.fandom.com/wiki/Wet_Concrete) |
| Diesel Refinery | 0.34 diesel → 0.31 gasoline + 0.03 residue | 1 | 1000 | [fandom](https://industrialist.fandom.com/wiki/Diesel/Refined_Diesel) |
| Foundry | 2000 raw-lead + 240 coke-fuel → 1000 lead-ingot | 182 | 6000000 | [fandom](https://industrialist.fandom.com/wiki/Coke_Fuel) |
| Foundry | 2000 raw-copper + 240 coke-fuel → 1000 copper-ingot | 182 | 6000000 | [fandom](https://industrialist.fandom.com/wiki/Coke_Fuel) |
| Foundry | 2000 raw-iron + 240 coke-fuel → 1000 iron-ingot | 182 | 6000000 | [fandom](https://industrialist.fandom.com/wiki/Coke_Fuel) |
| Foundry | 400 treated-raw-copper + 240 coke-fuel → 1000 copper-ingot | 182 | 6000000 | [fandom](https://industrialist.fandom.com/wiki/Coke_Fuel) |
| Foundry | 400 treated-raw-iron + 240 coke-fuel → 1000 iron-ingot | 182 | 6000000 | [fandom](https://industrialist.fandom.com/wiki/Coke_Fuel) |
| HV Transformer | 0.5 machine-oil →  | 1 | — | [fandom](https://industrialist.fandom.com/wiki/Machine_Oil) |
| Industrial Firebox | 12 distilled-water → 12 distilled-water | 1 | 0 | [fandom](https://industrialist.fandom.com/wiki/Distilled_Water) |
| Industrial Firebox | 12 filtered-water → 12 filtered-water | 1 | 0 | [fandom](https://industrialist.fandom.com/wiki/Filtered_Water) |
| Industrial Firebox | 4.5 liquid-sulfur → 9 sulfur-dioxide | 1 | — | [fandom](https://industrialist.fandom.com/wiki/Liquid_Sulfur) |
| Industrial Firebox | 1 oak-log → 16 sodium-carbonate | 1 | 0 | [fandom](https://industrialist.fandom.com/wiki/Oak_Log) |
| Industrial Oil Seperator | 20 steam + 4 heavy-oil → 0.5 residue + 2 machine-oil + 1 light-oil | 5 | 100000 | [fandom](https://industrialist.fandom.com/wiki/Heavy_Oil) |
| Industrial Sawmill | 8 chunk-plank + — steam → 24 planks | 10 | 0 | [fandom](https://industrialist.fandom.com/wiki/Planks) |
| Large Diesel Engine | 20 crude-diesel + 1 machine-oil + 15 distilled-water →  | 10 | — | [fandom](https://industrialist.fandom.com/wiki/Distilled_Water) |
| Large Diesel Engine | 15 poor-quality-diesel + 1 machine-oil + 15 distilled-water →  | 10 | — | [fandom](https://industrialist.fandom.com/wiki/Distilled_Water) |
| Large Diesel Engine | 10 diesel + 1 machine-oil + 15 distilled-water →  | 10 | — | [fandom](https://industrialist.fandom.com/wiki/Distilled_Water) |
| Large Diesel Engine | 7 refined-diesel + 1 machine-oil + 15 distilled-water →  | 10 | — | [fandom](https://industrialist.fandom.com/wiki/Distilled_Water) |
| Large Diesel Engine | 20 crude-diesel + 1 machine-oil + 20 water →  | 10 | — | [fandom](https://industrialist.fandom.com/wiki/Machine_Oil) |
| Large Diesel Engine | 15 poor-quality-diesel + 1 machine-oil + 20 water →  | 10 | — | [fandom](https://industrialist.fandom.com/wiki/Machine_Oil) |
| Large Diesel Engine | 10 diesel + 1 machine-oil + 20 water →  | 10 | — | [fandom](https://industrialist.fandom.com/wiki/Machine_Oil) |
| Large Diesel Engine | 7 refined-diesel + 1 machine-oil + 20 water →  | 10 | — | [fandom](https://industrialist.fandom.com/wiki/Machine_Oil) |
| Large Diesel Engine | 20 crude-diesel + 1 machine-oil + 7.5 filtered-water →  | 10 | — | [fandom](https://industrialist.fandom.com/wiki/Machine_Oil) |
| Large Diesel Engine | 15 poor-quality-diesel + 1 machine-oil + 7.5 filtered-water →  | 10 | — | [fandom](https://industrialist.fandom.com/wiki/Machine_Oil) |
| Large Diesel Engine | 10 diesel + 1 machine-oil + 7.5 filtered-water →  | 10 | — | [fandom](https://industrialist.fandom.com/wiki/Machine_Oil) |
| Large Diesel Engine | 7 refined-diesel + 1 machine-oil + 7.5 filtered-water →  | 10 | — | [fandom](https://industrialist.fandom.com/wiki/Machine_Oil) |
| Large Turbine | 90 steam → 3 water | 1 | — | [fandom](https://industrialist.fandom.com/wiki/Steam) |
| Logic Assembler | ∅ → — microchip-scrap | — | — | [fandom](https://industrialist.fandom.com/wiki/Microchip_Scrap) |
| Ore Enrichment Facility | 50 spent-fuel + 1 hydrochloric-acid + 120 nitrogen → 5 mixed-fissile-nitrstes + 95 fission-byproducts + 5 residue | 10 | 500000 | [fandom](https://industrialist.fandom.com/wiki/Fission_Byproducts) |
| Ore Enrichment Facility | 50 spent-fuel + 1 sulfuric-acid + 120 nitrogen → 7 mixed-fissile-nitrstes + 95 fission-byproducts + 5 residue | 10 | 500000 | [fandom](https://industrialist.fandom.com/wiki/Fission_Byproducts) |
| Ore Enrichment Facility | 20 raw-uranium + 1 hydrochloric-acid + — sodium-hydroxide-solution → 5 mixed-uranium-oxidies + 20 sand + 60 residue | 10 | 500000 | [fandom](https://industrialist.fandom.com/wiki/Raw_Uranium) |
| Ore Enrichment Facility | 20 raw-uranium + 1 sulfuric-acid + 1 sodium-hydroxide-solution → 6 mixed-uranium-oxidies + 10 sand + 60 residue | 10 | 500 | [fandom](https://industrialist.fandom.com/wiki/Raw_Uranium) |
| precision assembler | 1 zirconium-rod + 30 yellowcake → 1 low-enrichment-rod | 5 | 1000000 | [fandom](https://industrialist.fandom.com/wiki/Yellowcake) |
| Presents Packing Machine | 1 toy + 1 present-box + 0.1 machine-oil → 1 packed-present | 1.375 | 100000 | [fandom](https://industrialist.fandom.com/wiki/Machine_Oil) |
| Presents Packing Machine | 1 toy + 1 present-box → 1 packed-present | 11 | 100000 | [fandom](https://industrialist.fandom.com/wiki/Present_Box) |
| Presents Packing Machine | 1 toy + 1 present-box + 4 water → 1 packed-present | 7.333 | 100000 | [fandom](https://industrialist.fandom.com/wiki/Present_Box) |
| Presents Packing Machine | 1 toy + 1 present-box + 4 filtered-water → 1 packed-present | 5.5 | 100000 | [fandom](https://industrialist.fandom.com/wiki/Present_Box) |
| Pressurized Water Filter | 5 deep-earth-fragment + 20 water → 2.5 naphta + 10 coal | 5 | 200000 | [fandom](https://industrialist.fandom.com/wiki/Coal) |
| Research Station2 | 0.3 machine-oil → — rp | 3.67 | 11000 | [fandom](https://industrialist.fandom.com/wiki/Machine_Oil) |
| Small Turbine | 18 steam → 0.6 water | 1 | — | [fandom](https://industrialist.fandom.com/wiki/Steam) |
| Soil Excavator | ∅ → 1 soil | 1 | 200000 | [fandom](https://industrialist.fandom.com/wiki/Soil) |
| Steam Cracking Plant | 20 heavy-oil + 3 hydrogen → 15 naphta + 5 residue | 3 | 60000 | [fandom](https://industrialist.fandom.com/wiki/Heavy_Oil) |
| Steam Cracking Plant | 20 naphta + 3 hydrogen → 15 light-oil + 5 residue | 3 | 60000 | [fandom](https://industrialist.fandom.com/wiki/Hydrogen) |
| Steam Turbine | 0.3 steam → 0.09 water | 1 | — | [fandom](https://industrialist.fandom.com/wiki/Steam) |

## Machines

| Machine | Champ | Raison | Détail | Alternatives |
|---|---|---|---|---|
| [Advanced Diesel Refinery](https://industrialist.miraheze.org/wiki/Advanced_Diesel_Refinery) | unlockedBy | manquant | aucun nœud de recherche ne la débloque (ni RS/Data, ni infobox) |  |
| [Advanced Electric Furnace](https://industrialist.miraheze.org/wiki/Advanced_Electric_Furnace) | unlockedBy | manquant | aucun nœud de recherche ne la débloque (ni RS/Data, ni infobox) |  |
| [American Oil Rig](https://industrialist.miraheze.org/wiki/American_Oil_Rig) | unlockedBy | manquant | aucun nœud de recherche ne la débloque (ni RS/Data, ni infobox) |  |
| [Cat Assembler](https://industrialist.miraheze.org/wiki/Cat_Assembler) | unlockedBy | manquant | aucun nœud de recherche ne la débloque (ni RS/Data, ni infobox) |  |
| [Chemical Plant](https://industrialist.miraheze.org/wiki/Chemical_Plant) | pollutionPerHour | variable | Pollution : "Depends on recipes" |  |
| [Diesel Engine Flywheel](https://industrialist.miraheze.org/wiki/Diesel_Engine_Flywheel) | unlockedBy | contradiction | débloquée par plusieurs nœuds : Modular Diesel Engines, Modular Diesel Engines | "modular-diesel-engines" ([miraheze](https://industrialist.miraheze.org/wiki/Module:RS/Data)) |
| [Fancy Coal Drill](https://industrialist.miraheze.org/wiki/Fancy_Coal_Drill) | unlockedBy | manquant | aucun nœud de recherche ne la débloque (ni RS/Data, ni infobox) |  |
| [Foundry](https://industrialist.miraheze.org/wiki/Foundry) | pollutionPerHour | approximatif | plage 0.05-0.29%/h |  |
| [Industrial Diesel Refinery](https://industrialist.miraheze.org/wiki/Industrial_Diesel_Refinery) | unlockedBy | contradiction | RS/Data : « Industrial Diesel Refining » ; infobox : « Industrial Diesel Refinery » | "Industrial Diesel Refinery" ([miraheze](https://industrialist.miraheze.org/wiki/Industrial_Diesel_Refinery)) |
| [Industrial Drill](https://industrialist.miraheze.org/wiki/Industrial_Drill) | unlockedBy | manquant | aucun nœud de recherche ne la débloque (ni RS/Data, ni infobox) |  |
| [Industrial Press](https://industrialist.miraheze.org/wiki/Industrial_Press) | unlockedBy | manquant | aucun nœud de recherche ne la débloque (ni RS/Data, ni infobox) |  |
| [Large Diesel Engine](https://industrialist.miraheze.org/wiki/Large_Diesel_Engine) | pollutionPerHour | approximatif | plage 0.648 - 0.432%/h |  |
| [Liquid Burner](https://industrialist.miraheze.org/wiki/Liquid_Burner) | unlockedBy | contradiction | RS/Data : « Liquid Burner (dump) » ; infobox : « Liquid Burner (Dump) » | "Liquid Burner (Dump)" ([miraheze](https://industrialist.miraheze.org/wiki/Liquid_Burner)) |
| [OG Oil Rig](https://industrialist.miraheze.org/wiki/OG_Oil_Rig) | unlockedBy | manquant | aucun nœud de recherche ne la débloque (ni RS/Data, ni infobox) |  |
| [Residue Refinery](https://industrialist.miraheze.org/wiki/Residue_Refinery) | unlockedBy | manquant | aucun nœud de recherche ne la débloque (ni RS/Data, ni infobox) |  |
| [Sand Excavator](https://industrialist.miraheze.org/wiki/Sand_Excavator) | unlockedBy | manquant | aucun nœud de recherche ne la débloque (ni RS/Data, ni infobox) |  |
| [Scrubber](https://industrialist.miraheze.org/wiki/Scrubber) | pollutionPerHour | variable | Pollution : "Depends on input" |  |
| [Soil Excavator](https://industrialist.miraheze.org/wiki/Soil_Excavator) | unlockedBy | manquant | aucun nœud de recherche ne la débloque (ni RS/Data, ni infobox) |  |
| [Uranium Drill](https://industrialist.miraheze.org/wiki/Uranium_Drill) | unlockedBy | manquant | aucun nœud de recherche ne la débloque (ni RS/Data, ni infobox) |  |

**Variantes et éditions limitées** (13) : Advanced Diesel Refinery (variante de Diesel Refinery) [Limited] ; Advanced Electric Furnace (variante de Electric Furnace) [Limited] ; American Oil Rig (variante de Oil Rig) [Limited] ; Cat Assembler [Limited] ; Fancy Coal Drill (variante de Coal Drill) [Limited] ; Flag (variante de flag) ; Industrial Press [Limited] ; Metal Sign (variante de decoration) ; OG Oil Rig (variante de Oil Rig) [Limited] ; Residue Refinery [Limited] ; Sand Excavator [Limited] ; Soil Excavator [Limited] ; Uranium Drill (variante de Iron Drill) [Limited].
La façon dont elles se débloquent en jeu n'est pas précisée par le wiki ; à confirmer.

## Arbre de recherche

| Nœud | Catégorie | Champ | Détail |
|---|---|---|---|
| Firebox | Energy | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Boiler, Turbines) |
| HV Battery | Energy | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Double MV Battery, High Capacity Infrastructure) |
| HV battery MK2 | Energy | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : HV Battery, Extreme Capacity Infrastructure) |
| Large Scale Power Production | Energy | requires | 3 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Large Diesel Engine, Modular Diesel Engines, Gas Burner) |
| Large Turbines | Energy | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Boiler, Turbines) |
| MV Battery | Energy | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Medium Capacity Infrastructure, Rusty Battery) |
| Nuclear Power Plant | Energy | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Coal Power Plant, Modular Turbines) |
| Air Separation Unit | Production | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : LNG Plant, Plastic Molding) |
| Blast Furnace MK2 | Production | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Press MK2, Roller MK2) |
| Chemical Reactor | Production | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Industrial Diesel Refining, Advanced Oil Refining) |
| Gold Acid Refinery | Production | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Alloyer, Pressurized Water Filter) |
| Gold Refining | Production | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Industrial Electric Furnace, Industrial Roller) |
| Grinder MK2 | Production | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Press MK2, Roller MK2) |
| Large Oil Rig | Production | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Oil Fracking, Gas Refining) |
| Lithium | Production | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Gold Refining, Gold Acid Refinery) |
| Logic Assembler | Production | requires | 3 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Charger, Precision Assembler, Advanced Assembler) |
| Mineshaft Drill | Production | requires | 3 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Advanced Copper Extraction, Advanced Coal Extraction, Steel) |
| Oil Extraction | Production | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Coal Extracting, Water Pump) |
| Oil Fracking | Production | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Quarry, Industrial Diesel Refining) |
| Ore Enrichment Facility | Production | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Electrolysis Plant, Foundry) |
| Radioactive Waste Storage | Production | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Mineshaft Drill, Concrete Production) |
| Research Station 4 | Production | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Gold Refining, Gold Acid Refinery) |
| Better Intersection Pipes | Utility | requires | 2 parents ; règle « tous requis » déduite d'une capture du jeu (Oil Fracking), le wiki ne la précise pas (parents : Intersection Pipes, Better Fluid Pipes) |
| Better Item Pipes | Utility | children | enfant « Better Intersecction Pipes » introuvable dans RS/Data |

## Items

| Item | Champ | Raison | Détail |
|---|---|---|---|
| 2x Microchip | researchValue | approximatif | plage « 1-300 » |
| 8x Microchip | researchValue | approximatif | plage « 1-300 » |

**Items sans aucune recette de production** (7) : Deep Earth Fragment, Low Pressure Steam, Medium Earth Fragment, Microchip Scrap, Raw Uranium, Raw Zirconium, Spent Fuel.
Le moteur les signalera comme « source inconnue » s'ils apparaissent dans une chaîne.

## Modèles Fandom illisibles

- [Semiconductor](https://industrialist.fandom.com/wiki/Semiconductor) : {{Production}} sans machine
- [Silicon](https://industrialist.fandom.com/wiki/Silicon) : {{Production}} sans machine
- [Spent Fuel](https://industrialist.fandom.com/wiki/Spent_Fuel) : {{Production}} sans machine
- [Spent Fuel](https://industrialist.fandom.com/wiki/Spent_Fuel) : {{Production}} sans machine

<!-- extension:debut -->
## Extension : énergie, logistique, RP, monde

Lu dans le cache du 2026-10-12 : 76 bâtiments d'énergie, 43 pièces de tuyauterie, 6 silos, 5 dépôts, formules RP et faits du monde. Ports relevés en jeu : **46** bâtiment(s) (voir RELEVES.md).

Toutes les formules et tous les faits attendus ont été reconnus.

**Relevés en jeu appliqués** (source « jeu », 2026-10-12 ; prioritaires sur le wiki) :

| Élément | Champ | Wiki | Relevé en jeu |
|---|---|---|---|
| LV Pole | portée (tuiles) | 10 | **10.5** |
| MV Pole | portée (tuiles) | — | **10.5** |
| Advanced MV Pole | portée (tuiles) | 8 | **10.5** |
| Small MV Pole | portée (tuiles) | — | **10.5** |
| HMVT | portée (tuiles) | 22 | **22** |
| Gold Fluid Storage Silo | capacité | — | **1000000 L** |
| Gold Item Storage Silo | capacité | — | **1000000 unités** |
| Huge Truck Depot | durée d'un cycle de vente (s) | 80 | **80** (confirmé) |
| Large Liquid Truck Depot | durée d'un cycle de vente (s) | 80 | **80** (confirmé) |
| Liquid Truck Depot | durée d'un cycle de vente (s) | 80 | **80** (confirmé) |
| Medium Fluid Storage Silo | capacité | — | **3000 L** |
| Medium Item Storage Silo | capacité | — | **5000 unités** |
| Small Fluid Storage Silo | capacité | — | **500 L** |
| Small Item Storage Silo | capacité | — | **250 unités** |
| Van Depot | durée d'un cycle de vente (s) | 80 | **80** (confirmé) |
| Recherche | acquises d'office dans un nouveau monde | — | **transportation, truck-depot** |
| Research Station3 | deux fois le même item | contradiction sur le wiki | **accepté, avec la pénalité de 30 %** |
| Grille de construction | 1 case | — | **2 studs = 1 Short Pipe ; une case entière (un Short Pipe) ; pas de demi-case** |
| Grille de construction | rotations | — | **4 : quarts de tour seulement, pour tous les bâtiments : pas de 45° (d'où les pièces Light et Inclined Light)** |

**Reste à vérifier :**

| Élément | Champ | Raison | Détail |
|---|---|---|---|
| Coal Power Plant | énergie · input | variable | valeur du wiki non lisible telle quelle : « Varies » |
| Diesel Engine Generator | énergie · output | variable | valeur du wiki non lisible telle quelle : « Depends » |
| Diesel Generator | énergie · output | approximatif | puissance variable (météo, heure, vapeur ou combustible) : 55.2kMF/s-90kMF/s |
| Electric Water Heater | énergie · capacity | non-sourcé | valeur du wiki non lisible telle quelle : « 5MMF (MV) 10MMF (HV) » |
| Gasoline Generator | énergie · output | approximatif | puissance variable (météo, heure, vapeur ou combustible) : 12kMF/s-100kMF/s |
| Large Diesel Engine | énergie · output | approximatif | puissance variable (météo, heure, vapeur ou combustible) : 5MMF/s - 6MMF/s |
| Large Turbine | énergie · output | approximatif | puissance variable (météo, heure, vapeur ou combustible) : 1kMF/s - 515.096kMF/s — courbe température → puissance disponible (41 points, 0 à 400 °C) |
| Nuclear Power Plant | énergie · input | variable | valeur du wiki non lisible telle quelle : « Varies (HV/MV) » |
| Nuclear Power Plant | énergie · capacity | non-sourcé | valeur du wiki non lisible telle quelle : « 100MMF (HV) ⚡2MMF (MV) » |
| Resistor | énergie · capacity | non-sourcé | valeur du wiki non lisible telle quelle : « 550kMF* » |
| Solar Farm1 | énergie · output | approximatif | puissance variable (météo, heure, vapeur ou combustible) : 0MF/s - 664.1kMF/s |
| Solar Panel | énergie · output | approximatif | puissance variable (météo, heure, vapeur ou combustible) : 120MF/s - 240MF/s |
| Solar Panel2 | énergie · output | approximatif | puissance variable (météo, heure, vapeur ou combustible) : 0MF/s - 5kMF/s |
| Solar Panel3 | énergie · output | approximatif | puissance variable (météo, heure, vapeur ou combustible) : 0MF/s - 29.7kMF/s |
| Steam Turbine | énergie · output | approximatif | puissance variable (météo, heure, vapeur ou combustible) : 432MF/s - 9.36kMF/s |
| Turbine Generator | énergie · output | approximatif | puissance variable (météo, heure, vapeur ou combustible) : 0-550MMF/s |
| Wind Turbine1 | énergie · output | approximatif | puissance variable (météo, heure, vapeur ou combustible) : 700MF/s - 4.97kMF/s |
| Wind Turbine2 | énergie · output | approximatif | puissance variable (météo, heure, vapeur ou combustible) : 2.35kMF/s - 16.24kMF/s |
| Wind Turbine3 | énergie · output | approximatif | puissance variable (météo, heure, vapeur ou combustible) : 10.37kMF/s - 68.72kMF/s |
| Large Liquid Truck Depot | logistique · itemsPerSec | manquant | litres par voyage inconnus (cycle relevé en jeu : 80 s) : à relever en jeu |
| Liquid Truck Depot | logistique · itemsPerSec | manquant | litres par voyage inconnus (cycle relevé en jeu : 80 s) : à relever en jeu |
| Truck Depot | logistique · itemsPerSec | approximatif | 10 objets toutes les ~15 s d'après le wiki |
| Steam Turbine | énergie · puissance selon la température | approximatif | Seulement une plage (432 MF/s à 9,36 kMF/s) : pas de courbe sur le wiki. |
| Firebox (coal) + 2 Boilers + 2 Large Turbines | énergie · energyMFps | approximatif | température de la vapeur « around 190 » °C d'après la page Firebox : à confirmer en jeu |
| Gas Burner (refined-gas) + 10 Boilers + 10 Large Turbines | énergie · energyMFps | approximatif | 4.5 à 5 MMF/s par brûleur d'après la page Gas Burner : borne basse retenue |
| Gas Burner (hydrogen) + 10 Boilers + 10 Large Turbines | énergie · energyMFps | approximatif | 4.5 à 5 MMF/s par brûleur d'après la page Gas Burner : borne basse retenue |
| Industrial Firebox | énergie · non calculé | manquant | eau chaude à 300 °C, mais température de la vapeur inconnue : à relever en jeu |
| Geothermal Well | énergie · non calculé | manquant | jusqu'à 220 °C avec trois puits en chaîne, perte d'un tiers de l'eau ; température de la vapeur inconnue : à relever en jeu |
| Electric Water Heater | énergie · non calculé | manquant | d'après le wiki, une installation Boiler + turbine ne couvre même pas sa propre consommation |
| Steam Turbine | énergie · non calculé | manquant | puissance de 432 MF/s à 9,36 kMF/s selon la température, sans courbe |
| Coal Power Plant | énergie · non calculé | manquant | grande centrale modulaire : réglages et données insuffisants pour un calcul fiable |
| Nuclear Power Plant | énergie · non calculé | manquant | grande centrale modulaire : réglages et données insuffisants pour un calcul fiable |
| Turbine Generator | énergie · non calculé | manquant | grande centrale modulaire : réglages et données insuffisants pour un calcul fiable |
| Diesel Engine Generator | énergie · non calculé | manquant | grande centrale modulaire : réglages et données insuffisants pour un calcul fiable |
| Solar Panel2 | énergie · non calculé | manquant | production selon l'heure inconnue (seulement une plage) : moyenne impossible à calculer |
| Solar Panel3 | énergie · non calculé | manquant | production selon l'heure inconnue (seulement une plage) : moyenne impossible à calculer |
| Solar Farm1 | énergie · non calculé | manquant | production selon l'heure inconnue (seulement une plage) : moyenne impossible à calculer |
<!-- extension:fin -->

## Notes manuelles

<!-- notes-manuelles:debut -->
_Ajoute ici tes remarques ou relevés en jeu. Cette section est conservée à chaque régénération._

- **2026-10-12, vapeur des Boilers** : en jeu, la vapeur en sortie de Boiler tourne souvent entre
  105 et 115 °C au maximum, loin des 190 °C donnés par le wiki pour une installation à Firebox.
  À 110 °C, une Large Turbine produit environ 132 kMF/s au lieu de 320 kMF/s (courbe des
  turbines) : les centrales thermiques de `energy.json` sont peut-être surestimées d'un facteur
  2 à 2,5. Le jeu annonce lui-même des valeurs qu'il ne tient pas (Industrial Firebox : 12 L d'eau
  chauffés par seconde, non constaté). **Fait** : relevé dans `releves.json` (`steamObservedC`) ;
  chaque plan qui utilise une centrale thermique affiche la fourchette observée à côté du calcul
  du wiki (Firebox : 264 à 297 kMF/s par installation au lieu de 640). Reste à relever la
  température exacte par chauffe-eau (`steamTempC`) pour remplacer la valeur du wiki.
- **2026-10-12, paraboles** : le « log » du bonus est décimal (confirmé par l'utilisateur,
  « je crois »).
- **2026-10-12, plafond de RP** : d'après l'utilisateur, c'est un plafond général (commun à toutes
  les stations), pas un plafond par type de station. Le calcul compte un seul plafond pour toute
  l'installation proposée (un seul type de station à la fois) ; les installations mixtes ne sont
  pas proposées. À préciser en jeu : le plafond vient-il de la station la plus forte, ou de leur
  somme ?
- **2026-10-13, Boiler** : deux entrées d'eau (ports relevés) : l'eau convertie en vapeur et
  l'eau chaude d'un chauffe-eau. Miraheze (6) compte les deux, le Fandom (3) seulement la
  première. **Fait** : ressource « Hot Water » (releves.json `hotWater`) ; les chauffe-eau
  (Firebox, Gas Burner, Industrial Firebox, Geothermal Well) rendent de l'eau chaude, le Boiler
  en consomme 3 avec 3 d'eau ; pas de vapeur sans chauffe-eau. Les variantes à l'eau filtrée ou
  distillée ne sont pas encore reliées au Boiler.
- **2026-10-13, prudence** : quand une valeur est une plage, la plus défavorable est retenue
  (pollution : la borne haute), tant qu'aucun relevé ne la remplace.
- **2026-10-13, Scrubber** : pollution prise recette par recette sur la page du wiki
  (−3,24 / −3,57 / −6,29 / +6,48 %/h).
- **2026-10-13, Industrial Diesel Refinery** : débloquée par la recherche « Industrial Diesel
  Refining » (overrides.json) ; « Industrial Diesel Refinery » dans l'infobox est le nom de la
  machine.
- **2026-10-13, ports et vecteurs (onglet 3)** : un port n'est qu'un point de contact ; le jeu
  redirige ce qui arrive sur un port vers n'importe quelle entrée (ou sortie) de la machine, du
  même type (objet ou fluide). Un tuyau ne porte qu'une ressource ; un croisement compte pour
  deux tuyaux, donc un croisement collé à un port peut y amener deux flux. Deux machines dont les
  ports se touchent peuvent échanger directement, une seule marchandise par contact (un vecteur ne
  fait que donner le sens du flux). **Fait** : les plans de pose choisissent librement le port de
  chaque ressource, et le côté de chaque collecteur (priorité « le moins cher » : les raccords
  contournent les machines) ; un collecteur passe collé aux machines et une autre ressource le
  traverse par un croisement collé au port. **Pas encore utilisé** : les machines collées entre
  elles (usine assemblée), le Rusty Pipe Intersection (250 $, 6/s ; l'utilisateur ne s'en sert pas).
- **2026-10-13, Rusty Pipe Intersection** (capture vue de dessus) : socle 2 × 2 cases, une croix
  dont les deux tuyaux se croisent sur une case décentrée du socle, un raccord au bout de chaque
  bras. À confirmer avant de l'utiliser : longueur de chaque bras et case exacte du croisement.
- **2026-10-13, poteaux électriques** : un poteau a plusieurs nœuds (1, 2 ou 4 selon le modèle, comme
  sur le wiki : Small MV 1, LV et MV 2, Advanced MV et HMVT 4) ; sa capacité est la somme de celle de
  ses nœuds, et il peut se relier à autant d'engins qu'il faut. Les câbles sont des vecteurs : un seul
  sens par liaison. **Fait** : capacité = débit par nœud × nœuds, dans les plans de pose et le réseau
  de l'objectif énergie. Relevés de 13 bâtiments intégrés à `data/ports.json` (dont les poteaux).
- **2026-10-14, portée des câbles** : la même entre deux poteaux et d'un poteau vers une machine ; mais
  quand le câble part d'une machine qui produit de l'électricité (générateur…), la portée est celle de
  cette machine. **À relever** : la portée de câble de chaque générateur (aucune donnée pour l'instant).
- **2026-10-14, redirection des ports : en entrée seulement** : une ressource peut entrer par n'importe
  quel port de la machine du même type (même un port de sortie) ; une sortie doit partir de son port
  de sortie. **Fait** : les plans de pose ne redirigent plus que les entrées.

### Machines modulaires (S11, 2026-10-16)

Données dans `data/modular.json`. Chaque question ci-dessous y est citée (`"question": "MOD-xx"`).
Cherché : Miraheze, Fandom, Internet (guides, vidéos, forums). Hors des deux wikis, rien de
chiffré. La méthode de relevé est dans RELEVES.md (« Machines modulaires »).

**Ferme d'arbres (Tier I)**

- **MOD-01** Rayon de portée du **Tree Farm Controller** : aucune valeur sur les deux wikis.
  Le guide Miraheze place le contrôleur sur un côté d'une ferme d'environ 14 arbres de long, ce
  qui laisse penser à une grande portée, mais ce n'est pas mesurable sur l'image. À relever.
  → **Réponse du 2026-10-16** : 58 cases depuis le bord du contrôleur.
- **MOD-02** Le **réservoir** a-t-il sa propre portée vers les arroseurs, ou suffit-il qu'il soit
  à portée du contrôleur ? Les wikis ne parlent que de la portée du contrôleur.
  → **Réponse du 2026-10-16** : portée infinie : il suffit que le réservoir soit à portée du contrôleur.
- **MOD-03** Rayon de portée du **Tree Farm Sprinkler** : pas de valeur écrite. Déduit des deux
  images du wiki : entre 12 et 14 cases depuis le centre de l'arroseur si l'arbre est arrosé dès
  que le cercle touche son emprise (le Fandom le dit) ; entre 14,4 et 16 cases si c'est le centre
  de l'arbre qui compte. À relever pour trancher.
  → **Réponse du 2026-10-16** : 10 cases depuis le bord de l'arroseur (12 depuis son centre, dans la fourchette déduite).
- **MOD-04** **Critère de portée** : faut-il que le centre du bloc soit dans le cercle, que le
  cercle touche le bloc, ou que le bloc soit entièrement dedans ? Le Fandom dit « toucher à
  peine » pour l'arroseur ; rien pour les autres blocs. La portée part-elle du centre du bloc ?
  → **Réponse du 2026-10-16** : il suffit que le cercle touche le bloc. Toutes les portées se mesurent depuis le bord du bloc.
- **MOD-05** Rayon de portée du **Farm Harvester** vers les arbres : aucune valeur.
  → **Réponse du 2026-10-16** : 23 cases depuis le bord du récolteur.
- **MOD-06** Lien **récolteur → sortie** : « la sortie la plus proche à portée de sa base »
  (Miraheze) ou « doit toucher la sortie » (FAQ 13) ? Une portée, ou un contact ?
  → **Réponse du 2026-10-16** : une portée, la même que vers les arbres : 23 cases.
- **MOD-07** **Arrosage** : 33 L toutes les 33,33 s (Miraheze) ou 25 L toutes les 36 s (Fandom) ?
  Cela fixe l'eau à amener au réservoir (environ 1 L/s ou 0,7 L/s par arroseur).
  → **Réponse du 2026-10-16** : Miraheze (33 L toutes les 33,33 s).
- **MOD-08** Les **réservoirs en plus** ont-ils besoin d'eau ? Miraheze dit que non (ils
  relèvent seulement la limite de 3 arroseurs) ; le Fandom n'en parle pas.
  → **Réponse du 2026-10-16** : oui, chaque réservoir doit être alimenté en eau (Miraheze se trompe sur ce point).
- **MOD-09** **Rythme du récolteur** : le Fandom dit 15 arbres par récolteur au mieux (30 à
  1 500 % de pollution), alors que le guide Miraheze en fait suivre 22 à chacun. Combien d'arbres
  un récolteur suit-il vraiment ? Le guide donne aussi 18,8 kMF/s là où 88 arbres à 200 kMF par
  coupe en demandent environ 48,5 kMF/s, et un total de 17 040 $ qui ne compte que 3 récolteurs
  sur 4 (17 690 $ avec 4). Ce sont les trois chiffres dont S13 a besoin pour le bois par minute.
  → **Réponse du 2026-10-16** : l'utilisateur retient Miraheze. Le contrôleur reçoit l'électricité par sa prise et la distribue aux récolteurs à sa portée, qui n'ont pas de prise. Restent ouverts : le nombre maximal d'arbres par récolteur, et les deux chiffres du guide (énergie, prix).

**Ports des blocs modulaires**

- **MOD-10** Position des ports, à relever comme les autres bâtiments (RELEVES.md) : sortie
  d'Oak Logs de la Tree Farm Output, entrée d'eau du réservoir, prise électrique du contrôleur ;
  entrée de carburant et prise du générateur du moteur diesel ; entrées de vapeur de la Turbine
  Input (deux, sur les côtés d'après le wiki), sortie de la Turbine Output, nœuds électrique et de
  données du Turbine Generator.
  → **Réponse du 2026-10-16** : ports de la ferme relevés (data/ports.json) : sortie d'Oak Logs en bas case 2, entrée d'eau du réservoir en bas case 2, prise du contrôleur sur le dessus ; arbre, récolteur et arroseur sans port. Restent : la prise de l'arroseur (non cochée), et les ports du moteur diesel et de la turbine.
  → **Export du 2026-10-18 (S14)**, corrigé par l'utilisateur : l'arroseur n'a pas de prise ; le contrôleur du moteur n'a ni port ni prise ; l'entrée d'air n'a aucun port ; l'entrée de carburant a son port fluide à gauche, case 2 (sa prise n'est pas relevée). Restent : la prise du générateur du moteur, celle de l'entrée de carburant, et les ports de la turbine.

**Moteur diesel (Tier II)**

- **MOD-11** **Faces** : quelle face du vilebrequin est « plate » (vers le contrôleur ?) ; un bloc
  par côté, donc deux par vilebrequin ? Où se fixe le volant (6 × 4 cases) ?
  → **Réponse du 2026-10-16** : pas de réponse pour l'instant (à relever avec la méthode de RELEVES.md).
  → **Réponse du 2026-10-18 (S12)** : le volant se place comme un vilebrequin (dans la chaîne,
  devant le contrôleur, entre vilebrequins ou avant le générateur), sans face obligatoire. Restent :
  ses côtés portent-ils des blocs ? Le premier vilebrequin d'une 2ᵉ ligne (parti d'un Crankshaft
  Sideways) n'a rien derrière lui : « derrière obligatoire » ne vaut-il que pour la 1ʳᵉ ligne ?
  → **Réponse du 2026-10-18 (S14)** : un bloc de côté par côté de vilebrequin, des deux côtés ; le
  contrôleur porte aussi des blocs de côté (relevé) ; l'entrée de carburant peut aller n'importe où ;
  la longueur du moteur ne change pas la puissance. Restent : les côtés du volant, et la 2ᵉ ligne.
- **MOD-17** **Orientation des blocs par contact** (S12) : sur la capture vue de dessus d'un bloc
  posé sans rotation (celle de son relevé), quel bord regarde « devant », dans le sens de la chaîne
  (vers le générateur, ou vers la Turbine Output) ? Un champ « Devant, sur la grille du relevé »
  l'attend dans l'éditeur de bâtiments ; il servira aux plans de pose (S14).
  → **Réponse du 2026-10-18 (S14)** : le sens ne pose jamais problème ; le champ est retiré. Close.
- **MOD-12** **Formule** de la puissance et de la consommation selon le nombre de cylindres, le
  rapport air/carburant et l'accélérateur : le wiki n'a que des tableaux (6 cylindres de 10 à 16)
  et des exemples (6 et 32 cylindres). Le gain du volant n'est pas chiffré. La consommation
  affichée par l'Info Panel est-elle à multiplier par le rapport (Fandom) ? Le graphique
  « One column engine » a-t-il le couple ou l'accélérateur en abscisse ?
  → **Réponse du 2026-10-16** : pas de réponse.
  → **S13 (2026-10-18)** : sans formule, le calcul n'utilise que les configurations relevées. Le
  tableau à 6 cylindres (rapport 10 à 16) est supposé à l'accélérateur 100 % (sa ligne 16 est celle
  du montage simple à 100 %) : à confirmer en jeu. Toute autre configuration s'affiche « à relever ».
- **MOD-13** **Distance entre deux moteurs** : le Fandom signale que deux contrôleurs trop
  proches ne marchent pas (bogue) ; distance non donnée.
  → **Réponse du 2026-10-16** : probablement aucune : un joueur a collé plusieurs moteurs complets à la suite.
- **MOD-14** **Nombre de blocs selon la taille** : à partir de quel couple faut-il une deuxième
  entrée d'air, un deuxième échappement, une deuxième entrée de carburant, un deuxième générateur
  (seuil de 300 MT sur Miraheze, 240 MT sur le Fandom) ? Où pose-t-on un deuxième générateur ?
  Combien de chaque pour le moteur à 32 cylindres ?
  → **Réponse du 2026-10-16** : pas de réponse.
- **MOD-15** **Pollution** de l'échappement selon la configuration (« Depends » sur le wiki).
  → **Réponse du 2026-10-16** : pas de réponse.

**Turbine modulaire (Tier IV)**

- **MOD-16** **Puissance** d'une turbine hors des tableaux du développeur (débits 6, 12 et
  24 kL/s seulement) : pas de formule publiée. Le tableur cité par le Fandom est daté d'avant la
  v0.11.3, de son propre aveu.
  → **Réponse du 2026-10-16** : pas de formule trouvée ailleurs ; ajout de deux montages du guide de la Coal Power Plant (Miraheze). Décision : le site dira que la production électrique n'est pas fiable quand un plan utilise une turbine modulaire.

### Interfaces des machines (S10, 2026-10-17)

Données dans `data/interfaces.json` (chaque interface avec ses sources). Cherché : Miraheze (pages
des machines, recherche « lever », « interact », « menu », « toggle », « monitor »…), Fandom en
contrôle. Réponses de l'utilisateur : le levier des mouleurs passe de « bottle » à « container » ;
en « container », l'Industrial Plastic Molder fait la Plastic Casing ou, avec des Hardened Plastic
Pellets, la Hardened Plastic Casing ; le « carry » est la Quarry.

- **IF-01** **Quarry** : le wiki n'écrit que le choix « Soil & Clay ». Le texte exact des deux
  autres choix de l'écran (« Sand », « Limestone » supposés, d'après les crafts) est à relever.
- **IF-02** **Chemical Plant, crafts « variables »** : le tableau « Valeurs variables » ci-dessus
  liste encore leurs quantités et leur énergie (modes « plant_speed… »). Depuis S10, le calcul ne
  les compte plus « à vérifier » : ce sont les valeurs de l'écran à 1× (« Speed and Efficiency at
  100% »), multipliées par le réglage saisi pour le plan.
- **IF-03** **Chemical Plant, énergie de `chemical_plant_01`** (Ammonia) : le module du wiki ne
  marque pas son énergie comme variable, contrairement aux 14 autres crafts. Le calcul la
  multiplie quand même par « Power Input » (la page dit que l'écran change la consommation). À
  vérifier en jeu.
- **IF-04** **Chemical Plant, crans** : le wiki donne les pas de la vitesse (+5 % / +10 %
  d'énergie, −5 % / −7 %) mais pas ceux de l'efficacité. Le site ne calcule pas les crans : on
  saisit les trois multiplicateurs que l'écran affiche.
- **IF-05** **Drapeaux** (Flag) : l'utilisateur dit qu'ils ont une interface ; le wiki n'en dit
  rien. Ce qu'elle règle est à relever (aucun effet attendu sur le calcul).
- **IF-06** Interfaces notées **sans effet sur le calcul** : Electric Water Heater (pas
  d'installation calculée), Mineshaft Drill (aucun craft), Diesel Engine Controller (S13), Coal et
  Nuclear Power Plant (non calculées), HV Power Control, Underground Waste Facility, Hand Crank,
  portes et capteurs logiques, Metal Sign. Le Sign, la Statue, le Large Flag, le Logic Buzzer ne
  sont pas dans `machines.json` (variantes ou objets d'événement).

### Vitesse des RP et plafond souple (recherche du 2026-10-18)

Recherche sans code, pour le lot S20 proposé (PLAN-ACTION.md). Cherché : Miraheze (Research
System, RP Making, Research Station3, Research Tracking Panel, Satellite Dish Controller, lus le
2026-10-18), Fandom en contrôle (pages refusées au robot : HTTP 402, comme avant), guide
allthings.how (mis à jour le 25 juillet 2026), recherche générale (Reddit, YouTube, Discord : rien
de chiffré trouvé).

**Ce que disent les sources** (toutes déjà dans `research-stations.json`, sauf mention) :

| Fait | Source | Date |
| --- | --- | --- |
| Au-delà du plafond, RP/s = RP/s actuels × 10^(1−x) pour les stations 1 à 3, × 10^(1−√x) pour la 4, avec x = max(RP actuels ÷ plafond, 1). C'est un plafond **souple** : on peut le dépasser. | Miraheze, Research System | page modifiée le 2026-10-06, lue le 2026-10-18 |
| Le Research Tracking Panel affiche un « Absolute Cap », où la production de RP est proche de 0. | Miraheze, Research System | idem |
| Le panneau suit la production totale et celle de chaque station, le plafond souple (« efficiency threshold ») et le plafond dur ; texte rouge quand un plafond est atteint. « Up until you reach the efficiency threshold, you will gain research at a constant speed. » | Miraheze, Research Tracking Panel | lue le 2026-10-18 |
| L'écran du bas du panneau donne les contrôleurs de paraboles, leur efficacité, les paraboles et les RP/s des contrôleurs. | Miraheze, Research Tracking Panel | idem |
| Bonus des paraboles = B × 0,78 × log(R + 1). B : RP de base des stations ; R : somme des valeurs de recherche des liquides de **tous** les contrôleurs. Paraboles pour 100 % : ⌈S + √(S × R)⌉ (S : contrôleurs actifs). Chaque parabole alimentée ajoute la même part d'efficacité ; le bonus ne joue qu'au-dessus de 0 %. Pas de formule de l'efficacité. | Miraheze, Satellite Dish Controller | lue le 2026-10-18 |
| RS3 : « research efficiency threshold (the soft cap) is based on the item's sell value » ; m = stations RS3 actives. | Miraheze, Research Station3 | idem |
| Mini-jeu Logic : « roughly doubles RP/s and the soft cap ». Le site calcule autrement (circuits de la RS4, formule de la page Research Station4). | Miraheze, RP Making | idem |
| Le plafond porte sur le **solde** de RP, pas sur le temps ; dépenser des RP dans le menu Research le fait redescendre et rend la pleine vitesse. Le panneau écrit « MAX RP BEFORE RP/S IS NEARLY ZERO ». | allthings.how (guide, source secondaire) | 2026-07-25 |
| Aucune source ne dit comment se combinent les plafonds de plusieurs tiers, ni si les RP/s de tiers différents s'additionnent. | — | — |

**Confrontation avec le relevé de l'utilisateur** (capture du Research Tracking Panel, 2026-10-18) :
19 273,50 RP, 50,40 RP/s ; Tier 3 : 4 actives (+47,47 RP/s), seuil 76 875 RP ; « Max RP before RP/s is
nearly zero » > 231 000 RP ; tiers 1, 2 et 4 à 0 ; paraboles : 2 contrôleurs (+2,93 RP/s), 7 paraboles
(100 % d'efficacité).

Les formules du wiki retrouvent tous les nombres, **en supposant** deux Crankshaft dans chaque
station (Crankshaft : 754 $, valeur de recherche 35, `items.json`) et un liquide de valeur 0,1 dans
chaque contrôleur :

| Nombre de l'écran | Calcul | Résultat |
| --- | --- | --- |
| +47,47 RP/s | V = 4 × (35 + 35) × 0,7 (même item deux fois) = 196 ; 2 × 196^0,6 | 47,466 |
| 76 875 RP (seuil) | C = 4 × (log₄(754 ÷ 600) + 1) = 4,6592 ; 16 500 × (log₂(C + 1) + √C) | 76 875,4 |
| > 231 000 RP | 3 × seuil = 230 626, où le facteur vaut 10^(1−3) = 1 % (0,50 RP/s) | arrondi au millier supérieur ? |
| +2,93 RP/s | bonus = 2,93 ÷ 47,47 = 0,0617 = 0,78 × log₁₀(R + 1) → R = 0,1999 | R = 0,2 = 2 × 0,1 |
| 50,40 RP/s | 47,47 + 2,93 | 50,40 |

Conséquences : le seuil d'efficacité du panneau **est** le plafond (« RP Cap ») du wiki, et le
« Max RP before RP/s is nearly zero » est le point où la vitesse tombe à 1 % (3 × seuil pour les
tiers 1 à 3 ; 9 × seuil supposé pour le tier 4, où √x = 3). Le « log » des paraboles est bien décimal
(le logarithme népérien donnerait R = 0,082, le binaire 0,056 : aucun liquide de cette valeur).
76 875 = 4 × 19 218,75 n'est qu'une coïncidence : le seuil ne croît pas comme le nombre de stations
(5 stations : 85 535 ; 6 : 93 087, mêmes items).

**Évolution prévue pour cette installation** (déduite des formules, rien de mesuré) : seuil atteint
dans 19 min (à 50,40 RP/s constants). Au-delà, sans dépense, le solde suit
RP(t) = seuil × (1 + log₁₀(1 + ln 10 × r × t ÷ seuil)), t compté depuis le seuil : 100 000 RP →
25,2 RP/s ; 2 × seuil (153 751 RP) → 5,04 RP/s, 1 h 40 après le seuil ; 3 × seuil → 0,50 RP/s,
18 h 13 après. Le site compte aujourd'hui les RP en ligne droite (`currentRp`) : au bout de 24 h, il
afficherait environ 4,4 millions de RP au lieu d'environ 240 000.

**Questions :**

- **RP-01** Quels items sont dans tes 4 Research Station3 ? Deux Crankshaft dans chacune
  (déduit des nombres, à confirmer) ?
- **RP-02** Quel liquide dans tes 2 Satellite Dish Controllers ? Le calcul donne une valeur de
  recherche de 0,1 chacun : Light Oil ou Naphtha (`items.json`) ?
- **RP-03** Paraboles : le wiki en demande ⌈2 + √(2 × 0,2)⌉ = 3 pour 100 %, tu en as 7. Si tu
  coupes l'électricité d'une parabole à la fois, à partir de combien l'efficacité passe-t-elle sous
  100 %, et quel pourcentage s'affiche à chaque pas ? (donne la formule de l'efficacité, que le wiki
  n'a pas)
- **RP-04** Au-delà du seuil, la vitesse suit-elle 10^(1−x) ? Prévu, sans dépenser de RP : vers
  100 000 RP, environ 25,2 RP/s au total ; vers 153 750 RP, environ 5,0 RP/s. Le +2,93 des paraboles
  baisse-t-il dans la même proportion ?
- **RP-05** Plusieurs tiers à la fois : chacun a-t-il son seuil, appliqué à ses propres RP/s (le
  panneau les affiche par tier), ou un seul plafond commun (ta note du 2026-10-12) ? Que devient le
  « Max RP before … » ?
- **RP-06** « > 231 000 » : est-ce 3 × le seuil arrondi au millier supérieur ? Contrôle avec une
  5ᵉ station identique : seuil prévu 85 535 RP, « Max RP » vers 256 604 (> 257 000 ?), +54,27 RP/s
  pour les stations, +3,35 pour les paraboles.
- **RP-07** Une station est-elle « active » dès qu'elle est alimentée et reçoit ses deux items ?
  Une station qui manque d'un item compte-t-elle à moitié, ou pas du tout ?
- **RP-08** Dépenser des RP au-delà du seuil rend-il la pleine vitesse tout de suite (le guide le
  dit) ?
- **RP-09** (seulement avec une Research Station4) Mini-jeu Logic : le wiki dit tantôt « double à
  peu près la vitesse et le plafond », tantôt des circuits qui ajoutent plafond ÷ 40 000 × n × 6 ÷ t
  RP/s. Que montre le panneau avant et après ?

Méthode de relevé : RELEVES.md, « Points de recherche (panneau de suivi) ».
<!-- notes-manuelles:fin -->
