// Catalogue français, page « Méthodes de calcul » (remarque n° 16) : comment le calculateur choisit
// les recettes et compte machines, énergie, pollution… Chaque phrase décrit le code de src/engine/
// (solve.ts, optimize.ts, choose.ts, solve-v1.ts, resources.ts, tiers.ts) ; ce qui reste incertain
// est noté dans data/a-verifier.md (MET-01).
import type { Msg } from "../fr.ts";

export const methodesFr = {
  "page.methodes": "Méthodes de calcul",
  "me.lead": "Comment le calculateur trouve une installation : ce qu'il calcule, dans quel ordre, et où il peut se tromper. Cette page décrit le code du site tel qu'il est, sans simplification cachée.",
  "me.toc": "Sommaire",
  "me.link": "Comment le calcul choisit ?",
  "me.link.tip": "Les méthodes de calcul expliquées : priorités, machines entières, limites connues",
  "me.foot": "Méthodes de calcul",

  // ------------------------------------------------------------ 1. En bref
  "me.s1.h": "En bref : cinq étapes",
  "me.s1.1.h": "Les recettes permises",
  "me.s1.1.html": "Seulement celles des machines que tu as <b>débloquées</b>, dont la durée et les quantités sont connues, sans valeur « à vérifier » (sauf si tu l'acceptes dans les réglages) et permises par ton filtre de machines. Une recette que tu imposes remplace les autres pour son objet.",
  "me.s1.2.h": "Le bilan de chaque objet",
  "me.s1.2.html": "Pour chaque objet de la chaîne : <b>production ≥ consommation + demande</b>. Un sous-produit peut servir ailleurs dans la chaîne ; ce qui reste est un surplus. Les boucles (un sous-produit qui remonte la chaîne) sont permises.",
  "me.s1.3.h": "L'optimiseur",
  "me.s1.3.html": "Un <b>programme linéaire</b> (méthode du simplexe, écrite pour le site) essaie toutes les recettes permises à la fois, avec des machines « à la virgule » (12,44 Trommel), et garde la combinaison la meilleure selon tes priorités.",
  "me.s1.4.h": "Les machines entières",
  "me.s1.4.html": "Chaque étape est arrondie <b>au-dessus</b> (12,44 → 13). Comme l'arrondi peut tout changer, plusieurs variantes sont comparées sur le total arrondi (voir plus bas).",
  "me.s1.5.h": "Les totaux",
  "me.s1.5.html": "Énergie, prix, pollution et surface sont additionnés étape par étape, sur les machines entières. Une valeur inconnue n'est pas inventée : l'étape est comptée à part (« inconnu »).",

  // ------------------------------------------------------------ 2. Choix des recettes
  "me.s2.h": "Quand plusieurs machines fabriquent le même objet",
  "me.s2.p1.html": "Le calcul ne choisit pas objet par objet en partant de la fin : il pèse <b>toute la chaîne d'un coup</b>. Une recette un peu moins bonne pour un objet peut donc être retenue si elle rend le reste de la chaîne moins cher. Il peut aussi <b>mélanger</b> deux recettes pour le même objet (l'étape apparaît alors deux fois, avec le nom de chaque machine).",
  "me.s2.p2.html": "Tes priorités sont appliquées <b>dans l'ordre, par niveaux</b> : le calcul trouve le meilleur résultat possible sur le niveau 1, puis, sans jamais le dégrader, le meilleur sur le niveau 2, et ainsi de suite.",
  "me.s2.l1.html": "<b>Le moins de manques.</b> Un objet que rien de débloqué ne sait fabriquer devient un « manque » ; manquer l'objectif lui-même pèse 1 000 fois plus qu'un ingrédient manquant.",
  "me.s2.l2.html": "<b>Ta première priorité</b>, puis les suivantes de ta liste.",
  "me.s2.l3.html": "<b>Départage habituel</b> : le moins de place au sol, puis le moins de machines, d'énergie et de matières premières.",
  "me.s2.p3.html": "Une recette n'est jamais retenue si sa machine est verrouillée : dans le menu de recette d'une étape, les autres recettes restent listées, marquées « verrouillée », « à vérifier » ou « écartée ». C'est souvent là que se cache une chaîne plus courte que tu n'as pas encore débloquée.",

  // ------------------------------------------------------------ 3. Ce que compte chaque priorité
  "me.s3.h": "Ce que chaque priorité compte vraiment",
  "me.s3.lead": "Pendant l'optimisation, les machines sont « à la virgule ». Voici la quantité réellement minimisée, et ses limites connues.",
  "me.th.prio": "Priorité",
  "me.th.counts": "Ce qui est minimisé",
  "me.th.limits": "Limites connues",
  "me.c.machines.html": "Le nombre de machines, installations composées comptées pièce par pièce (ferme d'arbres, moteur diesel) et dépôts de vente compris.",
  "me.c.machines.lim.html": "Exact à la virgule ; en machines entières, voir l'arrondi plus bas.",
  "me.c.energy.html": "La consommation électrique <b>moyenne</b> (MF/s) des machines qui consomment, à la virgule.",
  "me.c.energy.lim.html": "Le pic (machines entières à pleine puissance) n'est pas ce qui est minimisé. Une machine dont la consommation est inconnue compte pour zéro ici.",
  "me.c.cost.html": "Le prix d'achat des machines ($), dépôts compris.",
  "me.c.cost.lim.html": "Une machine sans prix connu compte pour zéro. Le coût des recherches n'entre pas dans ce total.",
  "me.c.pollution.html": "La pollution ajoutée (%/h). Avec cette priorité (ou un plafond de pollution), des Scrubbers peuvent être ajoutés, sans descendre sous zéro.",
  "me.c.pollution.lim.html": "Une pollution donnée en plage compte pour sa borne haute ; inconnue, pour zéro.",
  "me.c.area.html": "La surface au sol (largeur × longueur, en cases).",
  "me.c.area.lim.html": "Une machine de taille inconnue compte pour 10 000 cases, pour passer en dernier. Les tapis et tuyaux ne sont pas comptés.",
  "me.c.raw.html": "La quantité sortie des machines sans entrée (foreuses, pompes, arbres…), par minute.",
  "me.c.raw.lim.html": "Toutes les matières s'additionnent sans distinction : 1 unité d'eau pèse autant qu'1 minerai.",
  "me.c.steps.html": "Une seule recette par objet, choisie pour avoir le moins d'étapes ; les quantités sont ensuite calculées comme d'habitude.",
  "me.c.steps.lim.html": "Peut demander bien plus de machines : c'est le prix d'une chaîne courte.",

  // ------------------------------------------------------------ 4. Machines entières
  "me.s4.h": "Des machines à la virgule aux machines entières",
  "me.s4.p1.html": "L'optimiseur sait trouver la meilleure solution <b>à la virgule</b>. Mais en jeu, une machine qui tourne à 7 % se pose quand même entière : une solution qui éparpille la production sur beaucoup de petites étapes (0,07 machine ici, 0,17 là) coûte plus cher une fois arrondie qu'elle n'en a l'air.",
  "me.s4.p2.html": "Pour les priorités machines, prix, pollution et place, le calcul compare donc plusieurs solutions <b>sur le total arrondi</b> : la solution à la virgule, jusqu'à 8 variantes où les recettes à moins d'une machine sont retirées et, sauf pour la place, le choix de l'ancien moteur (ci-dessous). La meilleure gagne ; à égalité, celle qui utilise le moins de recettes différentes.",
  "me.s4.p3.html": "<b>Limite importante :</b> trouver le vrai minimum en machines entières est un problème bien plus dur, que le site ne résout pas. Le plan affiché est le meilleur des candidats essayés, <b>pas une garantie</b>. Si tu vois mieux, impose une recette dans le menu de l'étape, ou fixe un nombre de machines dans le schéma : le calcul suit ton choix.",
  "me.s4.p4.html": "Les <b>paliers ronds</b> proposés sous le résultat sont les débits où, avec les mêmes recettes, chaque étape tombe sur un nombre entier de machines (ou presque) : ils évitent les machines à moitié vides.",
  "me.s4.p5.html": "Cas particulier : l'Air Separation Unit fournit beaucoup d'un coup. Elle n'est gardée que si le plan en a besoin, ou s'il reste strictement meilleur compté en machines entières sans qu'elle tourne presque à vide (moins de 10 % d'emploi, seuil choisi par le site).",

  // ------------------------------------------------------------ 5. Ce qui entre dans le calcul
  "me.s5.h": "Ce qui entre dans le calcul",
  "me.s5.rate.html": "<b>Débits.</b> Une machine produit <i>quantité nette par cycle ÷ durée du cycle × 60</i> objets par minute. Le nombre de machines d'une étape est le débit demandé divisé par ce débit par machine. La pousse des arbres dépend de la pollution du monde (et l'hiver, du mois) indiqués dans les réglages de partie.",
  "me.s5.energy.html": "<b>Énergie.</b> Sur le réseau, elle est seulement comptée : moyenne (machines à la virgule) et pic (machines entières à pleine puissance). En mode autonome, des générateurs débloqués entrent dans le calcul avec leur combustible ; s'ils ne suffisent pas, le manque d'énergie est signalé, et il pèse bien moins qu'un objet manquant.",
  "me.s5.pollution.html": "<b>Pollution.</b> Somme des %/h de chaque machine entière. Un plafond de pollution est une contrainte stricte ; s'il est impossible à tenir, le plan est calculé sans lui et la meilleure valeur atteignable est indiquée.",
  "me.s5.budget.html": "<b>Budget.</b> Le prix total des machines doit rester sous ton budget ; même règle que la pollution s'il est impossible. L'argent et les points de recherche de ta partie servent ensuite à dire ce qui manque.",
  "me.s5.existing.html": "<b>Production existante.</b> Ce que tu produis déjà est une source gratuite, plafonnée à ce que tu déclares : le calcul s'en sert avant de poser de nouvelles machines.",
  "me.s5.depots.html": "<b>Objectif argent et dépôts.</b> Le calcul choisit quoi vendre pour atteindre les $/min demandés ; ce qui est vendu ne peut dépasser le débit des dépôts posés, et les dépôts comptent comme des machines (nombre, prix, place).",
  "me.s5.fixed.html": "<b>Machines fixées.</b> Si tu fixes le nombre de machines d'une étape dans le schéma, les recettes restent celles du plan et le débit devient le plus grand que ces machines permettent.",

  // ------------------------------------------------------------ 6. L'ancien moteur
  "me.s6.h": "L'ancien moteur (heuristique), gardé pour comparer",
  "me.s6.p1.html": "Avant l'optimiseur, le site choisissait <b>une seule recette par objet</b> : pour chaque objet, il estime le coût d'1 objet par minute (machines de l'étape + coût de ses ingrédients, recalculé jusqu'à ce que plus rien ne bouge, ce qui tient même avec des boucles) et garde la recette la moins chère selon ta priorité. Il ne sait pas compter prix ni pollution : il se rabat alors sur le nombre de machines.",
  "me.s6.p2.html": "Il sert encore à trois choses : comme candidat comparé en machines entières (pour que le plan ne fasse pas moins bien que lui sur les priorités machines, prix et pollution), pour la priorité « chaîne la plus courte », et en secours si l'optimiseur échoue. Le détail du plan indique quel moteur l'a produit.",

  // ------------------------------------------------------------ 7. Exemple
  "me.s7.h": "Exemple réel : Purple Gold Ingot",
  "me.s7.lead": "Calculé à l'instant par ce site, avec les données actuelles : {rate} Purple Gold Ingot par minute, toutes les recherches débloquées, pollution du monde à 0 %, énergie prise sur le réseau. Une ligne par première priorité.",
  "me.s7.wait": "Calcul en cours…",
  "me.s7.none": "Exemple indisponible : cet objet n'est pas dans les données.",
  "me.th.machines": "Machines",
  "me.th.trommel": "dont Trommel",
  "me.th.energy": "Énergie (pic)",
  "me.th.cost": "Prix",
  "me.th.pollution": "Pollution",
  "me.th.area": "Place",
  "me.th.steps": "Étapes",
  "me.row.v1": "Ancien moteur (machines)",
  "me.best": "le moins de la colonne",
  "me.s7.p1": "Même objectif, de {min} à {max} machines selon la priorité : chaque ligne est la meilleure sur sa propre mesure, pas sur les autres. « Le moins de machines » en pose {m} ; l'ancien moteur, qui garde une seule recette par objet, en pose {v1}.",
  "me.s7.p2": "Le nombre de Trommel va ici de {tmin} à {tmax} : il dépend surtout de la recette retenue pour l'or. Avec moins de recherches débloquées, les recettes les plus efficaces sont exclues et ce nombre peut grimper beaucoup plus : regarde alors le menu de recette des étapes concernées, les recettes verrouillées y sont listées.",
} satisfies Record<string, Msg>;
