# Revue d'ensemble de l'interface (S15)

> Session S15 du [plan d'action](PLAN-ACTION.md), 2026-10-20, commit de départ `554e136` (437 tests).
> But : une interface logique pour un joueur, à partir de parcours guidés par l'utilisateur.
> Ce fichier garde l'inventaire, les parcours, la liste des défauts et la réorganisation proposée.
> S16 part de la liste des défauts.

## 1. Tour du site (inventaire)

Fait dans le navigateur intégré, écran 1366 × 768 puis téléphone 375 px, avec des captures (sauf
deux pages, lues par le DOM quand la capture a échoué). Partie d'essai des sessions précédentes
(146/146 recherches, journal de RP d'essai), puis partie vide pour la première visite.

### Ce que voit un joueur, page par page

| Page | Ce qu'on y trouve | Remarques |
| --- | --- | --- |
| Accueil | « Que veux-tu faire ? », 4 cartes (objet, énergie, RP, argent), encadré « Première visite ». | Clair. Mais le rappel « Tu jouais encore ? » s'ouvre par-dessus les cartes, avant même qu'on ait dit ce qu'on veut. |
| Planifier › formulaire | Objet, quantité, Priorités (7, dans l'ordre), Machines (filtre), phrase de la priorité, Options avancées. | 4 sous-onglets d'objectif en plus du menu. Priorité par défaut « Le moins d'énergie » pour un objet. |
| Planifier › réponse | Une phrase (« 128 machines et ≈ 61 arbres »), 4 chiffres (énergie, prix, pollution %/h, cases au sol), « À extraire ». | Bonne réponse courte. « 33 %/h » ne parle pas à un joueur. « Débit voisin mieux rempli » : jargon. |
| › Liste de construction | Par étage (extraction, transformation, produit final), case à cocher, « plan de pose », « je l'ai déjà », colonne « Alimente », énergie. | La vue la plus utile. Noms internes visibles (« Water Pump2 »). « je l'ai déjà » répété sur chaque ligne. |
| › Schéma | Cadre navigable, blocs, flèches ; clic → barre du bas (Machines −/+, Plan de pose, Bâtiment : ports relevés, Ne plus utiliser) et « Comment c'est calculé ». | La vue de départ ne montre pas toute la chaîne (Crankshaft coupé à droite). Texte des blocs très petit. Id interne « Craft blast_furnace_09 ». |
| › Plans de pose | Liste « Étape » (dont « Toute l'usine »), **une 2ᵉ liste « Priorités du plan »** (4), tuyaux tier III, résumé chiffré, entrées et sorties, bouton « Liaisons », dessin, ordre de pose, pièces. | Le dessin arrive après 2 écrans de réglages et de texte. Deux listes « Priorités » différentes sur la même page. Vocabulaire : collecteur, double rangée, croisements collés, relais renforcés, liaisons collées. |
| › Toute l'usine | Calcul de 7 à 20 s en arrière-plan, options (recalculé / module par module, liaisons, câbles…), dessin, Liaisons, Passages, Machines à compléter. | Impressionnant mais très technique. « Water : water → oak-log » (ids internes). |
| › Détails | Remarques, recettes et choix à la main, débits « ronds », valeurs à vérifier, comment c'est calculé. | Fourre-tout. Sur l'objectif RP, les onglets restent affichés même quand il n'y a rien à poser. |
| Mon usine | Recherches débloquées, Ressources (argent, pollution), **Ma recherche** (interrupteur, saisie rapide/détaillée, tableau des tiers, RP estimés, tableau des soldes, deux graphiques, journal), Parcelle, Production en place, Réglages, Transférer ma partie, Machines spéciales. | 4 350 px au téléphone. « Ma recherche » occupe la moitié de la page. Le champ « RP » montre l'estimation et non le relevé. Textes de développeur : « servent au relevé RP-04 », « proposés dans les futurs plans de construction ». Machines spéciales tout en bas, alors qu'elles changent les plans. |
| Arbre de recherche | Arbre comme en jeu (Production, Energy, Utility), recherche, panneau de la recherche choisie, vue Liste. | Bien. À 1366 px, la barre du haut passe sur deux lignes (▶ seul en dessous). |
| Recettes | Recherche, tuiles ou lignes triables, fiche objet (Sources, Utilisations), fiche machine, ✎ Corriger, Changer l'image. | Bien. Pas de lien « Produire cet objet » depuis une fiche. |
| Données | Valeurs à vérifier, Éditeur de bâtiments (liste « dépôt / manquant », grille). | Outils de contribution, assumés comme tels. « un fichier à m'envoyer » : s'adresse au développeur. Page pleine largeur, barre du haut sur deux lignes. |

### Partout

- **Bouton « ← … » de la barre du haut** : il reprend la page précédente (« ← Toute l'usine » sur
  Mon usine, « ← Valeurs à vérifier » sur l'Accueil après un rechargement). Il double le bouton
  Retour du navigateur et son libellé surprend.
- **Puces de l'en-tête** : « 146/146 recherches », « ≈ 226 k RP · hors jeu », ▶. Utiles ; le ▶ seul
  ne dit pas ce qu'il fait.
- **Deux mots pour la même chose** : « Priorités » (calcul) et « Priorités du plan » (plan de pose) ;
  « plan » veut dire tantôt le calcul, tantôt le plan de pose.
- **Ids et noms internes** : `blast_furnace_09`, `water → oak-log`, « Water Pump2 ».
- **Références au projet** : RP-04, MOD-09, « relevé », « dépôt », « à m'envoyer ».
- **Téléphone** : aucune page ne déborde ; les onglets du résultat défilent (« Détails » caché à
  droite) ; Mon usine fait 4 350 px.

### Première visite (partie vide)

- L'accueil invite à « Renseigner mon usine » : bien.
- Planifier sans progression : « Crankshaft ne peut pas encore être produit avec ta progression »,
  puis deux nombres de RP différents pour la même chose (« Recherche manquante … (4 825 RP) » et
  « À débloquer … (9 735 RP) »).
- Mon usine : pour dire où on en est, il faut cocher l'arbre (146 recherches) ou taper une recherche
  dans « Tout débloquer jusqu'à ». Rien ne demande « tu en es où, à peu près ? ».

## 2. Parcours avec l'utilisateur

Réponses à Q23 : les cinq parcours A à E, dans l'ordre ; Claude tient la souris dans le navigateur
intégré, l'utilisateur guide. Partie vide : serveur `calculateur-neuf` (port 5179, une adresse jamais
utilisée, donc un stockage vide) ; partie d'essai : port 5173.

### A — « Je viens d'arriver sur le site »

Partie vide (port 5179). L'utilisateur a fourni sa vraie progression (export du 2026-10-20 :
134 recherches, 100 M$, 17 000 RP à 14 RP/s, parcelle 200 × 200) et ses relevés de bâtiments
(déjà dans `data/ports.json` et `modular.json` : rien à intégrer).

- Q « Où cliques-tu en premier ? » et « Qu'attends-tu du site ? » — réponse : « L'usage premier
  c'est de planifier la prod d'un objet ».
- Constat : l'accueil met quatre cartes au même niveau. Produire un objet, l'usage premier, n'y est
  pas mis en avant ; l'énergie, les RP et l'argent sont des usages secondaires.
- Planifier sur une partie vide : objet prérempli (Crankshaft, 60/min), « ne peut pas encore être
  produit », deux nombres de RP pour la même chose (4 825 et 9 735), bouton « C'est fait, je les ai
  débloquées », onglets presque vides.
- Q « Que fais-tu devant cet écran ? » — réponses : « (a) oui » (taper son objet) ; « (b) oui ? »
  (le bouton « je les ai débloquées », avec hésitation) ; « (d) J'ai tendance à aller voir le plan de
  pose total ».
- Q « Comment dire où tu en es ? » — réponse : « le système actuel est bien, même si à voir pour faire
  comme dans l'éditeur de bâtiment où l'interface spawn dans une bulle (quand le mode est activé,
  sinon on a bien le détail à côté) pour l'unlock au lieu de sélectionner puis déplacer sa souris vers
  le bouton débloquer, enlevé de la friction. Le mode de bulle est pas activé par défaut. à la limite
  revoir comment on y accède uniquement si c'est nécessaire ».
- Q « Crankshaft prérempli : utile ou gênant ? » — réponse : « non je veux la possibilité qu'il n'y
  ai rien dans l'interface -une interface par défaut-, à la limite tu met le crankshaft en placeholder
  mais pas + ».
- Gestes refaits (partie vide → plan de pose total) : carte « Produire un objet » (1) ; objet déjà
  rempli ; « C'est fait, je les ai débloquées » (2) → 14 recherches cochées, 158 machines, réponse
  visible sans défiler ; onglet « Plans de pose » (3) : il s'ouvre sur la **dernière étape**
  (15 × Craft Assembler), pas sur l'usine ; liste « Étape » → « Toute l'usine » (4 et 5) ; calcul de
  5 s ; puis **deux écrans de défilement** (priorités du plan, résumé, avertissements, options)
  avant le dessin. Total : 5 clics, ≈ 10 crans de molette.
- Constats : « Toute l'usine » est le premier réflexe de l'utilisateur, mais c'est une option
  cachée dans une liste déroulante, après les étapes ; le dessin, haut et étroit (72 × 139 cases),
  laisse la moitié du cadre vide ; « 1 liaison(s) non tracée(s) : Water : water → oak-log » est
  affiché en rouge à un nouveau venu.
- Q « Qu'y cherches-tu en premier ? » — réponse : « Je cherche à savoir où vont certains tuyaux qui
  n'ont aucune destination (je pense que c'est les "à évacuer" qui sont pas pris en compte, il faudrait
  pouvoir choisir un côté où on veut faire sortir chacun de ces élément, tu sais directement dans la
  liste des à évacuer on sélectionne "en haut" en bas" "à droite" "à gauche") ».
- Q « Plans de pose ouvert sur Toute l'usine ? » — réponse : « Je pense que oui, sur le mode module
  par module par défaut car ça fait moins de calcul ».
- Q « Quels réglages utilises-tu ? » — réponse : « Câble est obsolète dans l'optique où "afficher les
  liaisons écrase sa priorité", globalement je n'utilise que "tout afficher", "Réseau électrique",
  "afficher les liaisons" ».

### B — « Je veux 60 Crankshaft/min avec ce que j'ai débloqué, et je le construis »

Partie : la progression exportée par l'utilisateur, chargée dans l'adresse d'essai (accord : « okay »).

- Import par « Importer… » : la fenêtre dit « ta progression actuelle (12 recherche(s) cochée(s)) »
  quand l'en-tête dit 14/146 (les 2 recherches acquises d'office ne sont pas comptées pareil).
- Crankshaft 60/min déjà rempli : réponse sans geste (128 machines, ≈ 61 arbres, 1,42 M$ « tu as
  100 M$ ✓ », 488,7 kMF/s, 33 %/h, 4 174 cases).
- Q « Pour construire en jeu, où vas-tu ? » — réponse : « Pour construire en jeu j'ai la touche "&"
  qui me permet de sélectionner les bâtiments, "é" pour les connexions de câbles (logique et
  électrique), et """ pour les tuyaux, "'" pour supprimer. En considérant que je suis en AZERTY, donc
  prendre aussi en compte les QWERTY ».
  Constat : le joueur pense en **modes de construction du jeu** (touches 1 bâtiments, 2 câbles,
  3 tuyaux, 4 supprimer). L'ordre de pose du site parle de « l'onglet 3 du mode construction » :
  nommer la touche (« touche 3, " en AZERTY ») et suivre ces modes (poser les bâtiments, puis câbles,
  puis tuyaux) rendrait le plan de pose plus proche du jeu.
- Q « Quels chiffres comptent ? » — réponse : « En considérant que je suis déjà plutôt riche sur le
  jeu ma priorité se concentre sur la place et le nombre de machine, et l'énergie. Donc voilà ».
  Constat : le prix, mis en 2ᵉ position, compte peu pour un joueur avancé ; la pollution en %/h non
  plus.
- Q « Quelle priorité par défaut ? » — réponse : « Je sais pas, ce qui est sûr c'est que dans la
  refonte du site je veux pouvoir mettre en place un système de remarque collaborative automatiser que
  je recevrais dans une interface pour répondre et publier les demandes qui reviennent le plus souvent
  (pas nécessairement publier mais au moins avoir une vision sur les propositions) ».
  → **Nouveau retour R15** (remarques des joueurs, collectées et triées) : à placer dans le plan
  (voir § 4 de ce fichier).
- Précision de l'utilisateur : « En fait c'est module par module. Et à chaque module je construit les
  bat, puis les tuyaux, puis l'électricité, puis la logique ».
- Q « Sur quelle vue t'appuies-tu ? » — réponse : « J'utilise surtout le graphe et le plan de pose
  global. Mais quasi jamais les trucs à cocher, à la limite ça peut-être intéressant si c'est lié au
  plan de pose ou on pourrait valider la pose d'un module par exemple ».
  Constat : la **liste de construction**, vue principale depuis la refonte de 2026-10-12, n'est
  presque pas utilisée ; le **schéma** et **Toute l'usine** sont les deux vues de travail. Les cases
  à cocher auraient leur place sur les modules de l'usine (« module posé »).
- Q « Ordre de pose selon les modes du jeu ? » — réponse : « ça peut-être intéressant, mais du coup
  dans l'ordre que je t'ai dit » (par module : bâtiments, tuyaux, électricité, logique).
- Q « Priorités par défaut : place, machines, énergie, prix en dernier ? » — réponse : « Oui ».

### C — « Quand aurai-je assez de RP pour débloquer X ? »

Partie de l'utilisateur (17 000 RP, 14 RP/s, « Ma recherche » non remplie). X = Research Station 4
(250 000 RP).

- **Arbre** : recherche « Research Station 4 », Entrée (3 gestes) → « Disponible, mais pas assez de
  RP : il te manque 233 000 RP ». **Aucune durée.** C'est pourtant là que le joueur regarde.
- **Planifier › Des RP**, réglage par défaut (« atteindre une vitesse », 50 RP/s, plafond auto) :
  « **27156 × Research Station3, plus 479 656 machines** », 272,6 G$, 162,93 GMF/s. Le plafond
  automatique vise 5 M de RP (la recherche la plus chère) : réponse absurde, affichée d'office.
- But « débloquer une recherche dans un délai » (liste, 2 gestes) ; le champ de la recherche est vide
  (rien ne vient de l'arbre) ; « Research Station 4 » tapé (1) ; 60 min par défaut → « 26 × Research
  Station3, plus 479 machines », 266,8 M$ (« tu as 100 M$ ») : la réponse dit comment le faire en 1 h,
  pas quand.
- La vraie réponse est dans **Détails › Chronologie** (1 clic, défilement) : « À ton rythme actuel
  **4 h 37 min** » (de jeu, en ligne droite faute de seuil), « Avec l'installation neuve 14 min ».
  Total : 7 gestes depuis le menu, au 4ᵉ niveau.
- Q « Où regardes-tu en premier ? » — réponse : « Le tarif total pour le débloquer, puis les RP que
  j'ai, en plus c'est déjà marqué si on a assez de RP il me semble ».
  Constat : le joueur se contente de l'arbre (prix et RP manquants) ; la durée viendrait là.
- Q « Durée dans le panneau de l'arbre, avec un lien vers un plan ? » — réponse : « Pourquoi pas, même
  si je doute pour le plan, d'ailleurs rien avoir, mais je trouve que la personnalisation du plan est
  bien mais approximative. Genre c'est pas assez fluide, c'est comme si, si on sait pas qu'on peut le
  personnaliser, on ira pas naturellement vers la fonctionnalité et ça serait facile de reprocher que
  la fonctionnalité existe pas alors que si c'est juste qu'elle est mal implémenté et a trop de
  distance avec l'accès directe de l'utilisateur (bon après faut avoir des compétence de web design
  pour comprendre en profondeur cette notion) ».
  Constat : **découvrabilité**. Les réglages du plan (machines fixées dans le schéma, filtre de
  machines, recettes choisies à la main, priorités, réglages des machines) existent mais sont loin de
  l'endroit où l'on regarde le résultat : un joueur ne les trouve pas seul.
- Q « Que doit montrer la page Des RP par défaut ? » — réponse : « J'ai pas compris la question »
  (reposée plus clairement).

### D — « Je pose un module en jeu d'après le plan de pose »

Crankshaft 60/min, partie de l'utilisateur, parcelle 200 × 200.

- Toute l'usine (adresse directe) : le cadre montre **toute la parcelle** (200 × 200, en tirets) ; l'usine
  (73 × 133) n'en occupe qu'un coin, en petit.
- « module par module » (1 clic) : 2,6 s au lieu de 4,5 s ; la page remonte d'elle-même au-dessus du
  dessin (il faut redescendre).
- Clic sur le module Crankshaft (1) : panneau à droite (« ← Retour à l'usine », ⛶, ✕), dessin du
  module, résumé, « Version dans l'usine : telle que son plan de pose seul, tourné d'un demi-tour »,
  puis l'avertissement « L'ordre de pose décrit le module avant sa rotation (« au-dessus », « vers le
  haut »…) : dans l'usine, il est tourné d'un demi-tour ». L'ordre de pose n'est donc pas fiable dans
  le sens où le joueur le voit.
- L'ordre de pose suit le module (bloc, collecteurs, croisements, poteaux) et non les étapes du
  joueur (bâtiments, puis tuyaux, puis électricité, puis logique).
- « 5 modules incomplets » : affiché sous le résumé, détaillé sous le dessin.
- Q « Qu'est-ce qui te sert pour poser ? » — réponse : « Le dessin est suffisant en sah » (en
  vrai) : l'ordre de pose et les textes peuvent être repliés.
- Q « Cadrer le dessin sur l'usine, la parcelle en repère ? » — réponse : « oui ».
- Q « Case « module posé ✓ » qui grise le module ? » — réponse : « Oui ».

### E — « Une valeur du site ne correspond pas au jeu »

Cas pris : le craft du Crankshaft au Craft Assembler, dans le plan Crankshaft 60/min (sa durée est
justement « à vérifier » : Miraheze 15 s, Fandom 17,2 s).

- Schéma : le bloc final (Crankshaft) est **coupé à droite** dans la vue de départ ; « ⤢ tout voir »
  ne l'a pas fait apparaître (la page a défilé) ; glisser le dessin (1) ; clic sur le bloc (2) ;
  « Voir dans Recettes ▸ » (3) ; ⚠ de la durée (4) → mode Corriger ouvert, la case de la durée
  sélectionnée. 4 gestes : rapide une fois le bloc trouvé.
- Jargon : les doutes s'affichent avec le nom interne des champs (« ⚠ **durationS** : Miraheze :
  15 ; Fandom : 17.2 », « ⚠ **energyMFps** : … 4000 … 3488 ») ; l'énergie s'y lit en « 4000 MF/s » alors
  que le reste du site écrit « 4 kMF/s ».
- Le ⚠ de la fiche n'apparaît pas dans le plan (liste, résumé) : le joueur ne sait pas qu'une valeur
  de son plan est incertaine tant qu'il n'ouvre pas Détails › « Valeurs à vérifier en jeu (5) ».
- Rien n'a été enregistré (Annuler).
- Q « Par où passes-tu ? » — réponse : « D'abord par le modifier, mais je cliquerai d'abord sur le
  point d'exclamation pour voir le problème et pouvoir rapidement le corriger ».
- Q « Un ⚠ visible dans le plan ? » — réponse : « Oui, mais il doit être cliquable ».
- Q 18 « Pages Des RP, énergie, argent : vides ou exemple réaliste ? » — réponse : « ok ». Lue comme
  (a), vides par défaut, comme l'objet (réponse 6) ; à confirmer sur la maquette.

## 3. Défauts vus par un joueur, par gravité

Le parcours d'où vient chaque défaut est entre parenthèses (T = tour du site).

### Graves : réponse fausse, absurde ou introuvable

| # | Défaut | D'où |
| --- | --- | --- |
| G1 | « Des RP » affiche d'office un plan absurde : 27 156 Research Station 3 et 479 656 machines, 272,6 G$ (but « 50 RP/s », plafond automatique à 5 M de RP). | C |
| G2 | « Quand aurai-je assez de RP pour X ? » : l'arbre donne les RP qui manquent, sans durée ; la durée (« 4 h 37 de jeu à ton rythme ») est dans Planifier › Des RP › but « débloquer » › Détails › Chronologie (7 gestes). | C |
| G3 | Dans « Toute l'usine », l'ordre de pose d'un module tourné décrit le module **avant** sa rotation : « au-dessus », « vers le haut » sont faux dans le sens où le joueur le voit. | D |
| G4 | Des tuyaux de « Toute l'usine » n'ont pas de destination (ce qu'il faut évacuer n'est raccordé à rien) ; on ne peut pas choisir le côté où chaque produit à évacuer sort. | A |

### Gênants : la vue utile est loin, lente ou cachée

| # | Défaut | D'où |
| --- | --- | --- |
| M1 | « Toute l'usine », la vue de travail, est cachée dans la liste « Étape » ; « Plans de pose » s'ouvre sur la dernière étape ; deux écrans de réglages et de texte avant le dessin ; le dessin est cadré sur toute la parcelle (l'usine dans un coin). | A, D |
| M2 | Schéma : la vue de départ coupe l'objet final ; « ⤢ tout voir » fait défiler la page au lieu du dessin ; textes des blocs très petits. | T, E |
| M3 | Les réglages du plan (nombre de machines dans le schéma, filtre de machines, recette choisie, priorités, réglages des machines) existent mais sont loin du résultat : un joueur ne les découvre pas (« si on sait pas qu'on peut le personnaliser, on ira pas naturellement vers la fonctionnalité »). | C |
| M4 | Une valeur « à vérifier » utilisée par le plan n'est signalée nulle part dans le plan (seulement sur la fiche ou dans Détails) ; il faut un ⚠ cliquable sur le bloc et la ligne. | E |
| M5 | Formulaires préremplis (Crankshaft 60/min, 50 RP/s, 2 MMF/s, 10 000 $/min) : l'utilisateur veut une interface vide par défaut, l'exemple seulement en grisé dans le champ. | A, C |
| M6 | Priorités par défaut (énergie, machines, prix) : un joueur avancé veut la place, puis le nombre de machines, puis l'énergie ; le prix compte peu. | B |
| M7 | Accueil : quatre cartes égales ; produire un objet est l'usage premier. | A |
| M8 | Liste de construction : vue principale depuis 2026-10-12, presque pas utilisée ; les cases à cocher seraient utiles sur les modules de l'usine (« module posé ✓ »). | B, D |
| M9 | L'ordre de pose suit le calcul (blocs, collecteurs, croisements, poteaux), pas les étapes du joueur dans chaque module : bâtiments, tuyaux, électricité, logique, avec la touche du jeu (AZERTY et QWERTY). | B |
| M10 | Réglages de « Toute l'usine » : « Câbles » est dépassé par « Afficher les liaisons » ; seuls « Tout afficher », « Réseau électrique » et « Afficher les liaisons » servent ; « module par module » devrait être le calcul par défaut (plus rapide). | A |
| M11 | Mon usine : 4 350 px au téléphone, « Ma recherche » en occupe la moitié ; Machines spéciales tout en bas alors qu'elles changent les plans ; le champ « RP » affiche l'estimation et non le relevé. | T |
| M12 | Arbre : débloquer demande de sélectionner puis d'aller au bouton du panneau ; une bulle près de la recherche, comme l'option de l'éditeur de bâtiments, enlèverait ce trajet (option, pas par défaut). | A |

### Finition : jargon, incohérences

| # | Défaut | D'où |
| --- | --- | --- |
| F1 | Ids internes visibles : `blast_furnace_09`, « water → oak-log », `durationS`, `energyMFps`, « Water Pump2 ». | T, E |
| F2 | Références du projet : « RP-04 », « MOD-09 », « un fichier à m'envoyer », « proposés dans les futurs plans de construction » (périmé). | T |
| F3 | Deux listes « Priorités » (calcul et plan de pose) ; « plan » veut dire tantôt le calcul, tantôt le plan de pose. | T |
| F4 | Unités : « 4000 MF/s » dans la correction, « 4 kMF/s » ailleurs ; pollution en « %/h », peu parlante. | E, B |
| F5 | Deux nombres pour la même chose : « 4 825 RP » et « 9 735 RP » sur une partie vide ; « 12 recherches » à l'import, « 14/146 » dans l'en-tête. | A, B |
| F6 | Bouton « ← page précédente » de l'en-tête : libellé surprenant (« ← Toute l'usine » sur Mon usine), double le Retour du navigateur. | T |
| F7 | En-tête sur deux lignes à 1 366 px sur les pages larges (Arbre, Données) ; le ▶ seul ne dit pas ce qu'il fait. | T |
| F8 | Rappel « Tu jouais encore ? » en fenêtre par-dessus l'accueil, avant toute chose. | T |
| F9 | Onglets du résultat affichés sans rien dedans (objectif RP « Rien à débloquer », plans de pose avec leurs priorités). | T |
| F10 | Après « module par module », la page remonte au-dessus du dessin. | D |
| F11 | Avertissement en rouge « 1 liaison(s) non tracée(s) » pour un cas prévu (eau de la ferme). | A |

### Nouveau retour

- **R15** : remarques des joueurs, collectées et triées dans une page réservée à l'utilisateur
  (réponse, publication au choix). Demande un service côté serveur : à planifier.

## 4. Réorganisation proposée

Maquette : [`maquette/revue.html`](maquette/revue.html), à valider (Q24). Principes :

1. **Le site s'ouvre sur la question principale** : « Que veux-tu produire ? », champ vide (exemple
   en grisé), énergie, RP et argent en liens secondaires.
2. **Deux vues de travail, au premier plan** : le **Schéma** et l'**Usine** (ex-« Toute l'usine »),
   en onglets ; la liste de construction et les détails passent derrière.
3. **L'usine d'abord** : module par module par défaut, cadrée sur l'usine, trois boutons
   (Tout afficher, Réseau électrique, Afficher les liaisons), le reste replié ; « module posé ✓ » ;
   ce qu'il faut évacuer, avec le côté de sortie au choix.
4. **Un module = un panneau** : le dessin, « module posé ✓ », l'ordre de pose replié, écrit dans le
   sens de l'usine et dans l'ordre du joueur (bâtiments, tuyaux, électricité, logique, avec les
   touches).
5. **Les réglages à côté du résultat** : une barre « Ton plan » au-dessus des vues (priorités,
   machines, réglages faits à la main, chacun cliquable), et la barre du bloc dans le schéma.
6. **⚠ cliquable partout où une valeur incertaine sert** (bloc, ligne, module) → la correction.
7. **La recherche dans l'arbre** : durée « à ton rythme » dans le panneau ; « Des RP » vide par
   défaut, « débloquer une recherche » en premier, la réponse « quand » avant « comment ».
8. **Mon usine en deux onglets** : « Ma partie » (progression, machines spéciales, ressources,
   parcelle, production en place, transférer) et « Ma recherche ».
9. **Vocabulaire de joueur** : noms du jeu à la place des ids, un seul mot par chose (tableau dans
   la maquette).

### Validation (Q24, 2026-10-20)

« À part ça tout me va », avec une remarque sur l'accueil : pas d'onglet, mais « un modal qui
s'affiche à la première arrivé sur le site » pour s'orienter, écrit pour un joueur d'Industrialist
(« pas vraiment un tuto, mais vraiment une explication de comment s'orienter sur le site »).

## 5. Lots de réorganisation

Écrits au § 3 du [plan d'action](PLAN-ACTION.md), placés au § 2 avant S16 :

| Lot | Contenu | Défauts |
| --- | --- | --- |
| S22 | Durée « à ton rythme » dans l'arbre ; « Des RP » vide, « débloquer » d'abord | G1, G2 |
| S23 | Planifier vide, nouveau menu, priorités du joueur, en-tête | M5, M6, M7, F6 à F9 |
| S24 | Fenêtre d'orientation à la première visite | M7 |
| S25 | L'Usine au premier plan, « module posé ✓ » | M1, M8, M10, F10, F11 |
| S26 | Ordre de pose du joueur, dans le sens de l'usine | G3, M9 |
| S27 | À évacuer : sortie au bord choisi | G4 |
| S28 | Schéma et réglages visibles, ⚠ cliquables | M2, M3, M4 |
| S29 | Mon usine en deux onglets, bulle de l'arbre, vocabulaire | M11, M12, F1 à F5 |
