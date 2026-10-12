# Refonte de l'interface — audit et plan

> Rédigé le 2026-10-12, à la demande de l'utilisateur : « mets-toi dans la peau d'un humain ».
> À lire avant toute nouvelle fonctionnalité. **Refonte faite le 2026-10-12** (bilan plus bas) :
> E4 (plans de construction) peut reprendre, en suivant la même méthode.

## Constat

Le moteur est solide : 189 tests, simplexe, formules vérifiées contre le wiki. **L'outil, lui,
est difficile à utiliser.** Chaque phase a ajouté ses réglages et ses résultats là où il y avait
de la place, sans repenser l'ensemble. J'ai validé chaque étape par des tests et des contrôles
automatiques de la page, presque jamais en l'utilisant comme un joueur. C'est la cause principale.

### Ce qui ne va pas, du point de vue d'un joueur

1. **Trop de choses au même endroit.** L'onglet Production contient 4 objectifs (objet, argent,
   énergie, recherche), chacun avec ses champs, plus 6 critères, des limites, 3 cases à cocher et
   la production existante. Le résultat empile cartes, ventes, réseau, matières, surplus,
   recherches, machines à posséder, paliers ronds, graphe, plan, recettes et avertissements. On
   ne sait pas où regarder.
2. **Pas de réponse simple.** La question du joueur est « qu'est-ce que je construis ? ». La
   réponse (liste des machines à poser, par type, avec le total) n'existe pas en tant que telle :
   elle est éparpillée dans les cartes du plan.
3. **Le graphe est illisible** au-delà d'une dizaine d'étapes. Il est trop haut (plus de 2 000 px),
   les noms sont coupés, les étiquettes se chevauchent, et on ne peut ni zoomer ni se déplacer,
   contrairement à l'arbre de recherche.
4. **Incohérences de vocabulaire et d'unités** :
   - l'onglet « Recherche » (l'arbre) et l'objectif « Recherche (RP) » sont deux choses
     différentes ;
   - unités : objets par minute, énergie saisie en kMF/s mais affichée en MF/s ou MMF/s, RP par
     seconde, argent par minute ;
   - « machines » exclut les arbres et les dépôts, comptés à part ;
   - « paliers ronds », « simplexe », « plafond souple » : du jargon de développeur.
5. **Réglages fantômes** : un réglage d'un objectif agit sur un autre sans qu'on le voie (le
   mode « ce qui manque à mon plan » utilise l'item réglé dans un autre objectif, masqué ;
   « moins d'étapes » ou « produire ma propre énergie » n'ont pas de sens partout).
6. **L'état du joueur est dispersé** : progression dans « Recherche », argent, RP et pollution
   dans « Ma partie », production existante dans Production, option de dépense des RP dans
   « Ma partie »… alors qu'on s'en sert partout.
7. **Les outils de contribution sont mêlés à l'outil de jeu** : « À vérifier », corrections,
   éditeur de bâtiments. Ils sont utiles, mais pas pour planifier une usine.
8. **Avertissements bavards** : informations, vrais problèmes et notes techniques au même
   niveau (un message par sous-produit réutilisé, par exemple).
9. **Première visite déroutante** : on arrive sur un arbre de 146 recherches à cocher, sans
   explication de ce que fait le site.

### Parcours réel (2026-10-12, site en ligne, écran 1366 × 768 puis téléphone)

**1. Première visite.**
- On arrive sur l'onglet Recherche : 0/146 recherches, et l'arbre commence à 360 px du haut.
- L'en-tête dit pourtant « Choisis un item et un débit » : le texte d'accueil ne correspond pas
  à l'écran affiché.

**2. Onglet Production sans progression.**
- Le réglage est pré-rempli : Crankshaft, 15 machines finales.
- La réponse est « Crankshaft ne peut pas être produit », plus un message technique
  (« Impossible de convertir 15 machines en débit »).
- Cette réponse apparaît à 813 px, **sous l'écran** : il faut défiler pour savoir si ça marche.

**3. Progression jusqu'au Craft Assembler, 60/min.**
- Le plan est partiel (Gear et Steel Rod verrouillés), mais le résumé affiche fièrement
  « 15 machines » et des « paliers ronds », sans rapport avec la question.
- La page fait 3 482 px pour 3 étapes : résumé à 937 px, plan à 2 063 px.

**4. Toute la recherche, « moins de machines » (25 étapes).**
- La page fait **13 870 px**, soit 18 écrans.
- Le graphe à lui seul fait 2 186 px de haut, sans zoom, avec deux étiquettes qui se
  chevauchent.
- Les 7 avertissements sont tous « tel sous-produit est réutilisé ».

**5. Selon l'objectif.**
- Il y a 13 à 18 réglages visibles avant toute réponse.
- Les pages font 6 000 à 14 000 px.
- Le calcul, lui, est rapide (25 à 250 ms) : la lenteur ressentie vient du défilement, pas du
  moteur.

**6. Téléphone (375 px).**
- La barre d'onglets déborde de 245 px : « Bâtiments » et « Ma partie » sont invisibles.
- Le résumé est à 1 223 px.
- Le graphe, réduit à 342 px de large, a un texte d'environ 6 px : illisible.

### Ce qui marche (à garder)

- L'éditeur de bâtiments (l'utilisateur le juge bon).
- L'arbre de recherche « comme en jeu », avec glisser et molette.
- La justesse des calculs et la traçabilité des sources.

## Données de jeu à corriger

- **Vapeur** : l'utilisateur observe en jeu une vapeur de sortie de Boiler qui tourne souvent
  entre **105 et 115 °C** au maximum, loin des 190 °C du wiki pour la Firebox. À 110 °C, une
  Large Turbine fait environ 132 kMF/s au lieu de 320 kMF/s : les centrales thermiques sont
  peut-être surestimées d'un facteur 2 à 2,5. Le jeu lui-même annonce des valeurs qu'il ne tient
  pas (Industrial Firebox : « 12 eaux chauffées par seconde », non constaté). À présenter comme une
  **fourchette** (110 °C observé – 190 °C wiki) plutôt qu'une valeur unique.
- **Paraboles** : logarithme décimal, confirmé par l'utilisateur (« je crois »).
- **Plafond de RP** : d'après l'utilisateur, c'est **un plafond général**, pas un par type de
  station. À intégrer au modèle des installations mixtes.

## Plan de refonte proposé

Principe : **une question, une page, une réponse.** Le détail reste disponible, mais replié.

1. **Accueil « Que veux-tu faire ? »** avec 4 cartes : produire un objet, produire de l'énergie,
   gagner des RP, gagner de l'argent. Courte phrase d'explication du site à la première visite.
2. **Une page par objectif**, avec seulement ses champs. Les options avancées (critère,
   limites, recettes à vérifier) sont repliées, avec des libellés de joueur (« le moins de
   machines », « le moins cher »…).
3. **Résultat en trois niveaux** :
   - **la réponse** en une ligne : « 120 machines, 896 kMF/s, 366 k$ » ;
   - **la liste de construction** : chaque type de machine, combien, ce qu'elle produit. C'est la
     vue principale, à cocher au fur et à mesure qu'on construit ;
   - **les détails** à la demande : graphe, recettes et sources, avertissements, paliers.
4. **Graphe refait** : même canevas que l'arbre de recherche (glisser, molette, tout voir), nœuds
   compacts, quantités au survol, matières premières regroupées. Pour les grandes chaînes, une vue
   en tableau des flux en remplacement.
5. **« Mon usine »** : un seul endroit pour l'état du joueur (progression, RP et RP/s, argent,
   pollution, production déjà en place, options), rempli une fois et résumé en haut de chaque
   page.
6. **« Données »** séparé : à vérifier, corrections, éditeur de bâtiments, export.
7. **Unités et mots cohérents** partout : objets/min, MF/s (avec préfixe automatique), RP/s,
   $/min ; un glossaire court pour les termes du jeu.
8. **Avertissements triés** : ce qui empêche le plan en haut, le reste replié par catégorie.

### Maquette à valider

`maquette/index.html` (à ouvrir avec `npm run dev`, puis http://localhost:5173/maquette/) :
l'accueil, la page « Produire un objet » et « Mon usine ». Elle est remplie avec un vrai calcul
figé : 60 Crankshafts/min, toute la recherche, « le moins d'énergie ».

Mesures, écran 1366 × 768 :
- la réponse est entièrement visible sans défiler (de 322 à 536 px, contre 813 px et plus
  aujourd'hui) ;
- aucun débordement, de 375 px à 1366 px ;
- le schéma, en taille réelle, défile dans son cadre au lieu de rétrécir.

### Maquette validée (2026-10-12), avec quatre remarques

1. « Parfois les nombres fusionnent » : étiquettes de débit qui se chevauchent dans le schéma.
2. « Le passe du jeu », et non « la passe de jeu ».
3. Chaque bouton de l'accueil doit mener à son propre objectif (dans la maquette, tous menaient à
   « Produire un objet »).
4. La priorité n'est pas claire : le joueur ne sait pas ce qu'elle fait. Et le schéma doit se
   parcourir librement, au moins pour dézoomer.

## Refonte faite (2026-10-12)

- **Pages** : Accueil · Planifier (une page par objectif : `#objet`, `#energie`, `#rp`,
  `#argent`) · Mon usine · Arbre · Données. Les anciennes adresses (`#production`, `#recherche`,
  `#verifier`, `#batiments`, `#partie`) sont redirigées. Chaque carte de l'accueil ouvre son
  objectif.
- **Barre du haut** fixe : navigation courte et état du joueur en pastilles (recherches, RP, argent),
  cliquables vers Mon usine. Première visite : un encadré invite à renseigner son usine.
- **Priorité** : seulement les priorités qui ont un sens pour l'objectif (pas « le moins
  d'énergie » pour produire de l'énergie, par exemple), une par objectif, et sous le menu une
  phrase qui dit ce qu'elle fait.
- **Résultat en trois niveaux** : la réponse (une phrase, quatre chiffres, ce qu'il faut extraire,
  vendre, évacuer, ce qui manque avec le bouton pour le cocher, un débit voisin mieux rempli) ;
  puis les onglets Liste de construction (par étage, à cocher, gardée par plan), Schéma, Détails.
- **Schéma** de gauche à droite (extraction → objectif), dans un cadre sombre navigable comme
  l'arbre : glisser, molette, + / − / tout voir / vue de départ. Les étiquettes de débit sont
  placées dans les espaces libres : 0 chevauchement sur 36 plans testés (6 objets × 6 priorités,
  vérifié par les tests).
- **Mon usine** réunit progression, « tout débloquer jusqu'à », ressources, production déjà en
  place, machines spéciales, réglages (dépense des RP, « J'ai le passe du jeu ») et export.
- **Données** réunit les valeurs à vérifier, les corrections et l'éditeur de bâtiments.
- **Vapeur** : la fourchette observée en jeu (105–115 °C) est affichée avec chaque plan qui utilise
  une centrale thermique (Firebox : 264 à 297 kMF/s par installation au lieu de 640).

Mesures (site local, après la refonte) :

| Tâche (écran 1366 × 768) | Actions | Réponse visible |
|---|---|---|
| « 60 Crankshafts/min » | carte « Produire un objet », unité « par minute » | 326 → 494 px, sans défiler |
| « 2 MMF/s, le moins de pollution » | carte « Énergie », 2 + MMF/s, priorité | 345 → 647 px, sans défiler |
| « Débloquer la RS3 en 1 h » | carte « RP », but, recherche | 326 → 533 px, sans défiler |

- Téléphone (375 px) : aucun débordement horizontal sur les 8 pages ; la réponse commence vers
  530 px ; la liste de construction devient une pile de cartes.
- Pages de 900 à 2 100 px (contre 6 000 à 14 000 px avant).

Reste à faire : un glossaire court des termes du jeu. Les plans de construction (E4a) sont un
quatrième onglet du résultat, « Plans de pose ».

### Méthode, cette fois

- Avant de coder : **parcours réel du site** avec captures, sur 3 tâches chronométrées (« je veux
  60 crankshafts/min », « je veux 2 MMF/s sans pollution », « je veux débloquer la RS3 »), en
  notant chaque hésitation.
- Une **maquette** de l'accueil et d'une page objectif validée par l'utilisateur avant la mise en
  œuvre.
- Ensuite seulement, refonte par petites étapes, chacune revue **en l'utilisant**, pas seulement
  par les tests.
