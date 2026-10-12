# Refonte de l'interface — audit et plan

> Rédigé le 2026-10-12, à la demande de l'utilisateur : « mets-toi dans la peau d'un humain ».
> À lire avant toute nouvelle fonctionnalité. **E4 (plans de construction) est suspendue** : la
> refonte passe d'abord.

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

### Méthode, cette fois

- Avant de coder : **parcours réel du site** avec captures, sur 3 tâches chronométrées (« je veux
  60 crankshafts/min », « je veux 2 MMF/s sans pollution », « je veux débloquer la RS3 »), en
  notant chaque hésitation.
- Une **maquette** de l'accueil et d'une page objectif validée par l'utilisateur avant la mise en
  œuvre.
- Ensuite seulement, refonte par petites étapes, chacune revue **en l'utilisant**, pas seulement
  par les tests.
