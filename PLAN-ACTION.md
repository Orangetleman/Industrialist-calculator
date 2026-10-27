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
3. **Aucune valeur de jeu inventée.** Chaque valeur vient, dans cet ordre, du wiki Miraheze, puis
   d'Industrialist Calculator (données du dépôt `Pollywrath/Industrialist-Production-Calculator`,
   licence MIT ; décision de l'utilisateur du 2026-10-26), puis de Fandom en contrôle, ou d'un relevé
   en jeu de l'utilisateur, avec sa source. Les doutes vont dans
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
| R11 | (2026-10-18) Une option pour passer le site en anglais, et un site parfaitement accessible et ergonomique (« un peu barbare » aujourd'hui), pour le montrer au serveur Discord de la communauté sans avoir honte d'un résultat brouillon, incomplet ou plein d'erreurs. | Deux chantiers liés : la traduction (tout le texte, les nombres, les dates) et une remise à niveau de la forme (clarté, cohérence, finition, accessibilité au sens large). Le lot écrit le plan, il ne l'exécute pas. | S16 (plan), S30 à S33, S37 |
| R12 | (2026-10-18, premier jet) Construire sa propre chaîne de production pour en voir les statistiques : un plan vierge, des menus « burger » pour ouvrir une liste de machines, des liaisons qu'on trace en maintenant le clic et en glissant avec l'outil tuyau (du bon type, fluide ou objet), comme les convoyeurs de Mindustry. | Un mode « bac à sable », l'inverse du calculateur : on pose, le site calcule. Très gros : le lot écrit le plan et la maquette, il ne l'exécute pas. | S17 (après S37) |
| R13 | (2026-10-18) Le gain de RP baisse quand les RP accumulés augmentent, et la baisse se calcule avec ce qu'on lit en jeu (Research Tracking Panel : seuil d'efficacité, « Max RP before RP/s is nearly zero »…). Que manque-t-il au site ? | Recherche faite le 2026-10-18 (sans code) : les formules du wiki retrouvent la capture au centième près. Le site connaît le plafond souple pour l'installation qu'il propose, mais compte les RP du joueur en ligne droite et ignore ses stations. | S20 |
| R14 | (2026-10-20, après S20) Un graphe de l'évolution des RP du joueur, avec l'historique et les modifications qu'il y a apportées au fil du temps (changement de configuration…). Deux courbes : les RP et les RP/s. | Le moteur sait refaire la courbe entre deux instants (S20), mais le site ne garde que le dernier relevé et la dernière configuration. Il faut un journal (relevés, changements de configuration, dépenses) et deux graphiques dans « Ma recherche ». Complément : les RP ne montent que quand on est en jeu ; le temps compte en durées de jeu, avec un interrupteur « Je joue / Je ne joue plus ». | S21 |
| R15 | (2026-10-20, pendant S15) « dans la refonte du site je veux pouvoir mettre en place un système de remarque collaborative automatiser que je recevrais dans une interface pour répondre et publier les demandes qui reviennent le plus souvent (pas nécessairement publier mais au moins avoir une vision sur les propositions) ». | Un bouton « Remarque » sur le site ; les remarques arrivent dans une page réservée à l'utilisateur, regroupées par sujet, avec une réponse et, au choix, une publication. Il faut un petit service côté serveur (le site est aujourd'hui statique sur le Pi) : à planifier, pas à coder en S15. | S16 (plan), S34 à S36 |
| R16 | (2026-10-26, pendant S17) « C'EST LES TIPS QUI INDIQUENT LES INFOS DE CHAQUE PORT […] revoir la façon dont on rentre la propriété d'un port dans l'éditeur […] en sélectionnant par exemple sur un port les items ou fluides qui peuvent sortir ou entrer en fonction des crafts déclarés de la machine. » | Les infobulles relevées (`tip`, 135 ports) disent déjà ce qui passe par chaque port, mais en texte libre (« Input for Crude Oil/heavy Oil/… »). L'éditeur doit proposer, port par port, de cocher les objets et fluides des recettes de la machine, et les enregistrer (champ structuré), pour que le calcul s'en serve sans IA. Le bac à sable en dépend (BAS-03). | S38 |
| R17 | (2026-10-26, pendant S17) « revoir le système de liaison pour cibler correctement les éléments d'une page avec un lien […] qui ne redirige pas vraiment vers l'édition du bâtiment mais vers la page d'édition ». | Un lien vers un élément doit l'ouvrir et l'amener à l'écran (bâtiment, recette, valeur). Cause trouvée : 6 pièces de tuyau (Pipe Fluid Turn2, Junction2, Section2, Item / Fluid Rate Meter, Pipe Valve) sont dans `logistics.json` mais pas dans `machines.json`, donc absentes de l'éditeur : `#contribuer/batiments/<id>` ouvre la page sans rien choisir. | S39 |
| R18 | (2026-10-26, pendant S17) Industrialist Calculator est « nettement plus au point sur le système de recherche, car le mien est complètement cassé, je devrais même pas le laisser disponible » ; mois courant, pollution globale et « Satellite buff » : « c'est sur le wiki, ce sont de vraies infos à prendre en compte ». | Refaire la recherche (RP, seuils, stations, satellite) en prenant Industrialist Calculator comme deuxième source, avec les mécaniques du wiki. Plan et maquette d'abord. Question à poser : masquer la recherche actuelle en attendant ? | S40 (plan) |
| R19 | (2026-10-26, pendant S17) « j'apprécie la patte graphique […] du site que je t'ai envoyé, veut-on qu'on s'en inspire (sans forcément faire quelque chose d'identique) pour refaire celle du site ? […] il paraît aussi fade, peu clair, difficilement utilisable, et pas original ». | Une identité visuelle propre au site, inspirée d'Industrialist Calculator (fond charbon, accent or, panneaux à filet doré, titres en petites capitales espacées, barre d'outils flottante avec icône et libellé, tableau de bord en lignes libellé / valeur, fenêtres à en-tête doré) sans le copier. Plan et maquette d'abord, page par page. Le bac à sable la reprend. | S41 (plan + maquette) |
| R23 | (2026-10-26, validation de la maquette des icônes) « dev un système de menu déroulant pour permettre d'insérer des image et de le mettre comme nous on veut et pas comme le navigateur le veut […] le plus important c'est de donner les mêmes possibilité et incrustation qu'un navigateur ». | Un menu déroulant maison qui remplace les `<select>` : images et icônes dans les options, même clavier, même lecture d'écran et même envoi de formulaire qu'un `<select>`, sobre en calcul ; il ouvrira des modes de sélection plus riches. En attendant, le ★ de l'option conseillée et le ⚠ des recettes à vérifier restent des caractères dans les listes. | S44 |
| R24 | (2026-10-26, même message) la visite « doit avoir un rebranding car il manque des trucs important, pourquoi pas faire une visite principal qui est bien, et quand l'utilisateur va sur un autre usage on lui propose la visite de cet usage ». | Une visite principale courte, puis une petite visite proposée à la première entrée dans chaque usage (Recettes, Arbre, Ma recherche, Contribuer…), au lieu d'une seule visite à rallonge. | S45 (plus tard) |
| R20 | (2026-10-26, Discord, après la publication) « The only downside is the lag » (Romik, 9/10). | Mesurer les temps de calcul sur une partie neuve, en ligne, au téléphone et sur ordinateur, puis traiter ce qui est le plus lent. | S42 |
| R21 | (2026-10-26, Discord) « It recommended me hardened casing without even me having a chem reactor unlocked » (Ariral). | Bogue probable : une recette d'une machine non débloquée est proposée. À reproduire sur une partie neuve, puis à corriger et tester. | S43 |
| R22 | (2026-10-26, Discord) « the full automation of the process is kinda bland to me, with the current site that we have available you can assemble the sheet yourself however you want » ; « poly does this now ». | Ce que les joueurs attendent, c'est de construire eux-mêmes : le bac à sable (S17, lots B1 à B9) y répond. Le placer avant les lots de confort. | ordre du § 2 |
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
| S18 | Moteur diesel : relevés de configuration, consommation selon le carburant, réglages du contrôleur | moyenne | S14 | ✅ fait |
| S19 | Éditeur de bâtiments simplifié : ports dans la grille, une case par face, moins de bruit | moyenne | S14, maquette | ✅ fait |
| S20 | Recherche : vitesse réelle des RP (plafond souple) et état de mes stations dans « Mon usine » | moyenne | relevés RP-01 à RP-08 (pendant : Q17) | ✅ fait |
| S21 | Recherche : historique des RP, deux graphiques (RP et RP/s) avec les changements de configuration et les dépenses | moyenne | S20, maquette | ✅ fait |
| S15 | Revue d'ensemble de l'interface avec l'utilisateur, comme un joueur | moyenne | S1 à S14, S18 à S21 | ✅ fait |
| S22 | Recherche : la durée « à ton rythme » dans l'arbre ; « Des RP » vide, « débloquer » d'abord | petite | S15 | ✅ fait |
| S23 | Planifier vide, nouveau menu, priorités du joueur, en-tête sur une ligne | moyenne | S15 | ✅ fait |
| S24 | Fenêtre d'orientation à la première visite | petite à moyenne, maquette | S23 | ✅ fait |
| S25 | L'Usine au premier plan : onglet, module par module, cadrage, « module posé ✓ » | moyenne | S23 | ✅ fait |
| S26 | Un module : ordre de pose dans le sens de l'usine et dans l'ordre du joueur | moyenne | S25 | ✅ fait |
| S27 | À évacuer : un tuyau jusqu'au bord choisi pour chaque produit | moyenne | S25 + capture de l'utilisateur | ✅ fait |
| S28 | Schéma et réglages visibles : vue complète, barre « Ton plan », ⚠ cliquables | moyenne | S23 | ✅ fait |
| S29 | Mon usine en deux onglets, bulle de l'arbre, vocabulaire de joueur | moyenne | S23 | ✅ fait |
| S16 | Plan (sans code) : site en anglais et remise à niveau de l'ergonomie, pour la communauté ; remarques des joueurs (R15) | moyenne, sans code | S15, S22 à S29 | ✅ fait ([PLAN-PUBLIC.md](PLAN-PUBLIC.md), maquette `maquette/public.html` validée) |
| S30 | Traduction (1/3) : glossaire, catalogue et `t()`, bouton FR / EN, nombres et dates ; squelette, en-tête, menu, pied de page, Planifier | moyenne | maquette S16 | ✅ fait |
| S31 | Traduction (2/3) : toutes les vues, visite comprise ; test « rien d'oublié » | grosse | S30 | ✅ fait |
| S32 | Traduction (3/3) : messages du moteur en codes, notes des données ; empreintes de l'usine identiques | grosse | S31 | ✅ fait |
| S33 | Forme publique : nom, mentions, pied de page, aperçu Discord, contrastes, cibles, téléphone, clavier, lecteur d'écran, calcul long | moyenne | S30 | ✅ fait |
| S34 | Remarques (1/3) : le service Node sur le Pi (sans dépendance), tests, mise en place après accord | moyenne | maquette S16 (peut aller en parallèle de S31 à S33) | ✅ fait |
| S35 | Remarques (2/3) : côté joueur (bouton, fenêtre, « Envoyer ma correction », « Mes remarques », visite, Discord) | moyenne | S30, S34 | ✅ fait |
| S36 | Remarques (3/3) : tableau de bord de l'utilisateur et page publique Propositions (votes ▲ / ▼) | moyenne à grosse | S35 | ✅ fait |
| S37 | Répétition générale : relecture de l'anglais, parcours A à E en anglais, remarque de bout en bout ; feu vert pour le Discord | moyenne | S30 à S36 | **fait** (2026-10-26, feu vert de l'utilisateur donné : il poste le lien) |
| S17 | Plan (sans code) : construire sa propre chaîne (bac à sable) et voir ses statistiques | moyenne, sans code | S37 | **fait** (2026-10-26, [PLAN-BAC-A-SABLE.md](PLAN-BAC-A-SABLE.md), lots B1 à B8 ; 2e maquette, façon Mindustry, à valider) |
| S38 | Éditeur de bâtiments : objets et fluides de chaque port, choisis parmi les recettes de la machine, enregistrés et exportés ; reprise des infobulles déjà relevées (R16, BAS-03) | moyenne | S17 | **fait** |
| S39 | Liens qui ouvrent l'élément visé et l'amènent à l'écran ; les 6 pièces de tuyau manquantes ajoutées à l'éditeur (R17) | petite | — | à faire |
| S41 | Refonte graphique : charte inspirée d'Industrialist Calculator (couleurs, typographie, panneaux, barre d'outils, icônes), maquette de chaque page avant le code (R19) | grande | — | en cours : 1er pas fait, les émojis remplacés par des icônes Lucide (`maquette/icones.html`, `src/ui/icons.ts`) ; reste la charte |
| S42 | Lenteur signalée sur le Discord : mesurer (partie neuve, en ligne, téléphone et ordinateur), puis corriger le plus lent (R20) | moyenne | — | ✅ fait (2026-10-27) |
| S43 | Recette d'une machine non débloquée proposée (Hardened Plastic Casing sans Chemical Reactor) : reproduire, corriger, tester (R21) | petite | — | à faire |
| S44 | Menu déroulant maison à la place des `<select>` : images dans les options, clavier et lecteur d'écran comme le navigateur (R23) ; maquette d'abord | moyenne | — | à faire |
| S45 | Visite refaite : une visite principale, puis une visite par usage proposée à la première entrée (R24) ; maquette d'abord | moyenne | — | à faire (plus tard) |
| S40 | Plan (sans code) : refaire la recherche avec Industrialist Calculator comme source, mois, pollution globale, Satellite buff (R18) | moyenne, sans code | — | fait (2026-10-27) : lots S46 à S51 ci-dessous |
| S46 | Recherche actuelle masquée (« en refonte ») en attendant S48 | petite | — | fait (2026-10-27) : drapeau `RECHERCHE_EN_REFONTE` dans `src/ui/flags.ts` |
| S47 | Maquette de la nouvelle « Ma recherche » et des réglages de partie (pollution, mois, difficulté) | moyenne, sans code | — | maquette `maquette/recherche-refonte.html` faite (2026-10-27), validée par l utilisateur (2026-10-27) |
| S48 | Moteur de recherche refait : stations par tier avec leurs items, RS4, Satellite buff (sources Miraheze puis Industrialist Calculator) | grande | — | à faire |
| S49 | « Ma recherche » refaite d'après la maquette ; objectif recherche branché sur le nouveau moteur ; recherche réaffichée | grande | — | à faire |
| S50 | Réglages de partie : pollution globale et mois courant appliqués aux recettes concernées | moyenne | — | à faire |
| S51 | Difficulté : recherches bloquées et machines réservées selon le niveau | petite | — | à faire |

Pourquoi cet ordre :
- **S1 d'abord** : les plots changent la géométrie de tous les plans. Mieux vaut le faire avant de
  retoucher les plans (S2 à S4), pour ne pas tout mesurer deux fois.
- **S2 à S4** : c'est le travail en cours (« 1. puis 2. »), et la maquette v8 de l'usine est déjà
  validée en principe.
- **S5 avant S7** : le lien « référence du craft » du schéma a besoin de la page Recettes.
- **S10** ne touche pas au placement (Q5) : elle reste à sa place.
- **Modulaires en dernier** : c'est le lot le plus gros et le moins documenté. La recherche (S11)
  peut être avancée si tu le souhaites.
- **S20 avant S15** (réponse à Q17, 2026-10-19) : la revue d'ensemble verra la recherche finie.
- **S21 avant S15** (réponse à Q20, 2026-10-20) : l'historique des RP fait partie de la recherche.
- **S15 à la fin** : l'utilisateur veut revoir l'interface dans son ensemble, pour qu'elle soit
  logique pour des joueurs (« t'es pas joueur et t'as pas la façon de réfléchir de ceux-ci ») :
  parcours guidés par lui, puis réorganisation. D'ici là, chaque lot garde l'interface simple et
  cohérente avec l'existant.
- **S22 à S29 après S15** (maquette validée le 2026-10-20) : la réorganisation tirée des parcours.
  S22 d'abord : c'est le défaut le plus grave (une réponse absurde affichée d'office) et le lot le
  plus court. S23 pose le cadre (menu, formulaires vides, priorités) dont dépendent les suivants.
  S25 avant S26 et S27 : le panneau d'un module et la sortie des produits à évacuer vivent dans
  l'Usine. S27 attend la capture de l'utilisateur (tuyaux sans destination). Le vocabulaire (S29)
  vient en dernier, quand les écrans sont stables.
- **S16 après S15 et S22 à S29** : la revue de S15 donne la liste des défauts vus par un joueur
  (REVUE.md) ; S16 en fait un plan complet (anglais + forme) pour une version présentable au Discord,
  sur un site déjà réorganisé, et y ajoute R15 (remarques des joueurs, Q24.12). Ce plan donnera ses
  propres lots, à insérer ensuite au § 2.
- **S30 à S37 après S16** (plan écrit le 2026-10-24, [PLAN-PUBLIC.md](PLAN-PUBLIC.md) § 6) : le socle de
  la traduction d'abord, pour que tout texte ajouté ensuite entre dans les deux catalogues ; le service
  des remarques (S34) ne touche que des fichiers nouveaux et peut avancer en parallèle ; le lien n'est
  posté sur le Discord qu'après S37 (tableau de bord et Propositions finis, décision S16 Publication).
- **S17 en dernier** (après S37) : c'est une nouvelle fonction, pas une correction. Elle réutilise beaucoup de
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

### S20 — Recherche : vitesse réelle des RP et état de mes stations

Retour : R13. Recherche faite le 2026-10-18 (sources, confrontation et questions RP-01 à RP-09 dans
`data/a-verifier.md`, « Vitesse des RP et plafond souple » ; méthode dans RELEVES.md, « Points de
recherche »). Place dans l'ordre : entre S19 et S15 (réponse à Q17.1, 2026-10-19).

Ce qui existe (vérifié dans le code le 2026-10-18) :
- `data/research-stations.json` : toutes les formules du wiki, sourcées (vitesse et plafond des RS1
  à RS4, facteur de prix, pénalité de 30 %, circuits Logic, paraboles, plafond souple 10^(1−x) et
  10^(1−√x), RP de départ). Rien n'y est marqué « à vérifier ».
- `src/engine/research-points.ts` : ces formules, `designResearch` (une installation **neuve**, d'un
  seul type de station, avec ou sans paraboles) et `unlockTimeline` (chronologie avec le plafond
  souple, par intégration numérique).
- « Mon usine » (`progress.ts`) : RP, RP/s et heure de saisie. `currentRp` les prolonge **en ligne
  droite**, sans plafond ; `withRpRate` change la vitesse sans perdre les RP accumulés.
- Objectif recherche (`main.ts`, `computeResearch`) : la chronologie « à ton rythme actuel » prend un
  plafond infini ; celle « avec l'installation » ajoute la vitesse actuelle à celle des stations
  neuves, avec le seul plafond des stations neuves. Plafond voulu (`capNeeded`) : la recherche la
  plus chère, ou un nombre saisi.
- `a-verifier.md` (2026-10-12) : « plafond général, commun à toutes les stations » selon
  l'utilisateur, à préciser en jeu ; les installations mixtes ne sont pas proposées.

Ce que la recherche apporte :
- Le seuil d'efficacité du panneau est le plafond du wiki ; « Max RP before RP/s is nearly zero »
  est le solde où la vitesse tombe à 1 % (3 × seuil, tiers 1 à 3). Les formules retrouvent la
  capture : +47,47 RP/s, 76 875 RP, +2,93 RP/s (log décimal confirmé), > 231 000 RP.
- La baisse porte sur le **solde** de RP non dépensés : dépenser rend la vitesse.
- Au-delà du seuil (tiers 1 à 3), le solde suit une formule exacte :
  RP(t) = seuil × (1 + log₁₀(1 + ln 10 × r × t ÷ seuil)). Pour le tier 4 : intégration numérique,
  comme `unlockTimeline`.
- Deux stations du même tier ne s'additionnent pas : la vitesse vient de la somme des valeurs de
  toutes les stations du tier (2 × V^0,6), et le plafond du nombre total de stations (m). Ajouter
  des stations à celles du joueur n'est donc pas la même chose que poser une installation neuve à
  côté.

Ce qu'il faut pouvoir saisir (« Mon usine », section « Ma recherche ») :

| Information | Où la lire en jeu | À quoi elle sert |
| --- | --- | --- |
| RP et RP/s, avec l'heure | Research Tracking Panel, 1ʳᵉ ligne (déjà saisis) | point de départ de l'estimation |
| Seuil d'efficacité de chaque tier | panneau, une ligne par tier | moment où la vitesse baisse ; vitesse réelle au-delà |
| Stations actives et RP/s de chaque tier | panneau, une ligne par tier | vitesse propre à chaque tier (si chaque tier a son seuil, RP-05) ; contrôle |
| « Max RP before RP/s is nearly zero » | panneau, dernière ligne | contrôle (doit valoir 3 × le seuil) ; plafond de fait de l'estimation |
| Contrôleurs actifs et leurs RP/s ; paraboles actives ; efficacité | écran du bas du panneau | part des paraboles ; savoir si elle baisse avec le reste (RP-04) |
| Items de chaque station (ou d'un groupe de stations identiques) | la station elle-même (pas sur le panneau) | recalculer vitesse et seuil ; proposer d'**ajouter** des stations à celles qui existent |
| Liquide de chaque contrôleur | le contrôleur | recalculer le bonus ; nombre de paraboles pour 100 % |
| Circuits Logic résolus (RS4) | la Research Station4 | plafond et vitesse du tier 4 (RP-09) |
| Recherches qui seront dépensées | l'arbre du site (option « dépenser les RP », déjà là) | le solde redescend, la vitesse remonte |

Deux niveaux, au choix du joueur : **rapide** (recopier les nombres du panneau : RP, RP/s, seuil par
tier, « Max RP ») et **détaillé** (stations, items, liquides : le site recalcule les nombres du
panneau et affiche « ✓ comme en jeu » ou l'écart, comme pour les arroseurs en S12).

Ce qu'il faut faire :
- Moteur : RP estimés avec le plafond souple (formule exacte pour les tiers 1 à 3) ; temps pour
  atteindre un solde (seuil, 2 × seuil, une recherche) ; RP/s à un instant donné ; installation du
  joueur décrite par tier (stations, items, liquides) et recalculée ; proposition « ajouter N
  stations à tes stations du tier 3 » à côté de « poser une installation neuve ».
- « Mon usine » : section « Ma recherche » (deux niveaux), RP ≈ maintenant avec le plafond, « seuil
  atteint dans … », « au-delà, la vitesse baisse : dépense tes RP » ; en-tête du site : RP/s réels.
- Objectif recherche : chronologies avec le vrai seuil du joueur (« à ton rythme actuel » ne prend
  plus un plafond infini) ; « Comment c'est calculé » pour la vitesse et le seuil.
- Tests : la capture du 2026-10-18 refaite par le moteur (47,47 ; 76 875 ; 2,93 ; 230 626) ; la
  formule exacte comparée à l'intégration numérique.

Questions : Q17, et RP-01 à RP-08 (relevés). Ce qui reste sans réponse est écrit « supposé » sur le
site (la règle des tiers multiples en premier). Maquette d'abord.

Critère de fin : avec les nombres de la capture saisis dans « Mon usine », le site affiche les RP
estimés à l'instant, l'heure du seuil et la vitesse au-delà, et l'écart avec un nouveau relevé en
jeu après le seuil (RP-04) reste sous 2 % ; l'objectif recherche part des stations du joueur ; tests
verts ; parcours réel avec captures.

### S21 — Recherche : historique des RP et deux graphiques

Retour : R14 (2026-10-20, après S20). Place : entre S20 et S15 (Q20.1).

Ce qui existe (vérifié dans le code le 2026-10-20, commit `afa77d9`) :
- `src/engine/research-balance.ts` : `balanceAfter`, `timeToReach`, `rateAt`, `researchModel` (tiers,
  seuils, paraboles, à partir de « Ma recherche ») ; la courbe entre deux instants se refait pour
  n'importe quelle configuration.
- `src/ui/progress.ts` : `PlayerInfo` garde **un seul** relevé (`rp`, `rpPerSec`, `rpAt`) et **une
  seule** configuration (`research`) ; chaque saisie remplace la précédente. Aucun historique.
- `setProgress` (main.ts) dépense les RP d'une recherche débloquée sur le site (option « dépenser »),
  sans rien noter.
- Le site dessine ses graphiques en SVG sans bibliothèque (arbre, plans) : pas de dépendance à ajouter.
- `currentRp` compte le temps **réel** écoulé depuis la saisie (horloge continue), même quand le joueur
  n'est pas en jeu : faux, d'après la règle ci-dessous (vrai avant S20 comme après).

Règle de jeu (utilisateur, 2026-10-20) : **les RP ne s'accumulent que quand le joueur est connecté au
jeu.** Ce qui compte, ce sont des durées de jeu (des Δt), pas le temps continu. La sauvegarde du jeu
suit, elle aussi, le temps d'activité en jeu.

Ce qu'il faut faire :
- **En jeu / hors jeu** (en premier : tout le reste en dépend) : un interrupteur « Je joue » / « Je ne
  joue plus », activable à tout moment, dans « Ma recherche » et sur la puce de l'en-tête. Hors jeu, les
  RP estimés et l'horloge s'arrêtent ; ils repartent à la reconnexion. Toutes les estimations (RP
  maintenant, « seuil atteint dans … », chronologies de l'objectif recherche) comptent en **temps de
  jeu**. État gardé au rechargement ; à l'ouverture du site, rappel de l'état (« hors jeu depuis … »).
- **Journal** (pur, testé), gardé dans le navigateur (clé à part) et exporté avec la partie (clé
  facultative, l'ancien format reste lisible). Trois types d'événements, chacun daté :
  - relevé : RP et RP/s de la 1ʳᵉ ligne du panneau (à chaque saisie) ;
  - configuration : la saisie de « Ma recherche » entière, enregistrée **automatiquement** à chaque
    modification (Q20.3) ; les frappes rapprochées se fondent en un seul événement ;
  - dépense : recherches débloquées (ou rendues) sur le site, RP avant et après.
  - session : début et fin de chaque période en jeu (l'interrupteur).
  Premier point : la capture du 2026-10-18 (19 273,50 RP, 50,40 RP/s), placée au début du temps de jeu
  (son heure ne compte pas : seuls les Δt de jeu comptent, Q21.1).
- **Moteur de l'historique** : la courbe prévue repart de chaque relevé et de chaque dépense, avec la
  configuration en vigueur, et n'avance que pendant les sessions en jeu ; à chaque relevé, l'écart entre
  la prévision et le relevé (en RP et en %).
  C'est le contrôle qui manque à RP-04 et au critère « moins de 2 % » de S20. Ce qui est dépensé en jeu
  sans être coché sur le site apparaît comme une marche, que le relevé suivant corrige.
- **Deux graphiques** dans « Ma recherche », un peu plus bas (Q20.2), sur le même axe, gradué en
  **temps de jeu** (les périodes hors jeu ne prennent pas de place ; un repère discret marque chaque
  reconnexion) :
  - **RP** : les relevés en points, la courbe prévue en trait, le seuil de chaque période en ligne
    horizontale (il change avec la configuration), la prévision au-delà de maintenant en pointillé ;
  - **RP/s** : la vitesse prévue (elle baisse au-delà du seuil, remonte après une dépense), les RP/s
    relevés en points ;
  - sur les deux : un repère vertical à chaque changement de configuration et à chaque dépense, avec
    au survol (ou au toucher) ce qui a changé (« + 1 station du tier 3 », « liquide : Light Oil »,
    « Foundry débloquée : −100 000 RP ») ; une période au choix, en temps de jeu (24 h par défaut, 7 jours, tout).
  - Lire le skill `dataviz` avant d'écrire les graphiques ; tenir à 375 px de large.
- **Journal** : les événements à moins de 2 minutes d'écart se fondent en un seul ; on garde 90 jours
  de **temps de jeu** (Q21.3, Q21.4).
- **Tests** : temps de jeu (une pause n'ajoute aucun RP, la reprise repart du même solde), journal
  (fusion des frappes, limite de 90 jours de jeu, export et import), courbe d'un journal fictif (relevé,
  session, changement de configuration, dépense, relevé) contre `balanceAfter` morceau par morceau,
  écart d'un relevé.

Questions : Q21 répondue le 2026-10-20 (§ 4). Maquette d'abord (l'interrupteur et les deux graphiques) (un fichier dans `maquette/`, feuille de style en
chemin relatif), avec un journal d'exemple construit sur la capture du 2026-10-18 et des événements
marqués « exemple ».

Critère de fin : hors jeu, les RP estimés ne bougent plus et repartent à la reconnexion ; après quelques
saisies (relevés, une station ajoutée, une recherche débloquée), les deux
graphiques montrent l'historique, les repères et l'écart prévision / relevé ; le journal survit au
rechargement et à l'export ; tests verts ; parcours réel avec captures, ordinateur et téléphone.

### S15 — Revue d'ensemble de l'interface, comme un joueur

Retour : l'utilisateur veut revoir l'interface dans son ensemble, pour qu'elle soit logique pour des
joueurs (« t'es pas joueur et t'as pas la façon de réfléchir de ceux-ci »). Place : après S1 à S14 et
S18 à S21 (§ 2), avant S16, qui part de sa liste de défauts.

Ce qui existe (vérifié le 2026-10-20, commit `554e136`, 437 tests) :
- Menu : Accueil · Planifier · Mon usine · Arbre de recherche · Recettes · Données ; puces d'état et
  bouton ▶/⏸ dans l'en-tête (`index.html`).
- Planifier : une page par objectif (objet, énergie, RP, argent), Priorités, Machines (S9), Options
  avancées ; résultat en onglets Liste de construction, Schéma (S7, S8, S10, S18), Plans de pose
  (dont Toute l'usine S3-S4 et Ensembles modulaires S14), Détails.
- Mon usine : progression, Ma recherche (S20, S21 : saisie, interrupteur, graphiques, journal),
  ressources, production en place, réglages, export.
- Recettes (S5, S6), Données (valeurs à vérifier, corrections, éditeur de bâtiments S10, S12, S19).
- La refonte du 2026-10-12 (REFONTE.md) a fixé « une question, une page, une réponse ». Chaque lot
  depuis le 2026-10-16 a ajouté sa fonction là où l'existant le permettait, en attendant cette revue.

Ce qu'il faut faire :
- **Tour du site page par page**, dans le navigateur intégré (captures si la fenêtre le permet, sinon
  par le DOM, et le dire) : inventaire court de ce que voit un joueur, du jargon, des doublons, de ce
  qui est caché ou mal placé.
- **Parcours de joueur guidés par l'utilisateur** : en proposer 3 à 5, lui faire choisir l'ordre, les
  suivre avec lui ; noter ses réactions mot pour mot, le nombre de gestes et ce qui bloque.
- **Liste des défauts** vus par un joueur, classés par gravité (elle sert à S16).
- **Réorganisation proposée** (menu, pages, vocabulaire de joueur, valeurs par défaut, ce qu'on replie
  ou retire), sous forme de **maquette à valider** (`maquette/revue.html`, feuille de style en chemin
  relatif).
- **Après validation** : découper la réorganisation en lots courts (R1, R2…), chacun avec son critère
  de fin, ajoutés au § 2 et ici. Pendant la session, seulement les changements simples et sûrs que
  l'utilisateur demande.

Questions : Q23 (parcours et leur ordre), puis celles de la maquette (Q24).

Critère de fin : parcours faits avec l'utilisateur et notés ; liste des défauts classée ; maquette
validée ; lots de réorganisation écrits et placés au § 2 ; tests verts.

### S22 à S29 — Réorganisation de l'interface (tirée de S15)

Source commune : [REVUE.md](REVUE.md) (parcours A à E, défauts G1-G4, M1-M12, F1-F11) et la maquette
validée `maquette/revue.html` (décisions S15 au § 5). Chaque lot lit d'abord la partie de REVUE.md
qui le concerne, vérifie dans le code ce qui existe (les fichiers cités ici viennent du tour du
2026-10-20, commit `554e136`), et refait à la fin le parcours d'où viennent ses défauts, en comptant
les gestes, sur ordinateur et téléphone. Aucun lot ne change un calcul sans le dire (§ 0, règle 5).
Pour une partie vide : un second serveur de développement sur un port jamais utilisé (S15 : 5179,
entrée `calculateur-neuf` ajoutée à `.claude/launch.json`, fichier non suivi par git, à recréer) a son
propre stockage ; la progression de l'utilisateur s'y importe par « Importer… ».

#### S22 — Recherche : la durée là où l'on regarde (G1, G2)

- Arbre (`research-view.ts`) : le panneau d'une recherche non débloquée affiche « il te manque N RP ·
  ≈ durée de jeu à ton rythme » (même calcul que la chronologie de `research-plan.ts`, temps de jeu,
  plafond si « Ma recherche » le connaît, sinon « en ligne droite », dit comme tel), et un lien « L'avoir
  plus vite » vers Planifier › Des RP réglé sur cette recherche.
- Planifier › Des RP : vide tant que rien n'est saisi ; but « débloquer une recherche » en premier ;
  la réponse commence par « à ton rythme : … », puis « en N min : … ».
- Critère de fin : partie de l'utilisateur, Research Station 4 → la durée (4 h 37 de jeu au 2026-10-20)
  lue dans l'arbre en 3 gestes ; « Des RP » n'affiche plus aucun plan sans saisie ; tests verts.

#### S23 — Planifier vide, nouveau menu, priorités du joueur, en-tête (M5, M6, M7, F6 à F9)

- Menu : Planifier · Arbre · Recettes · Mon usine · Contribuer (ex-Données ; anciennes adresses
  redirigées). L'onglet Accueil disparaît (la fenêtre d'orientation est S24) ; `#accueil` mène à
  Planifier.
- Quatre objectifs vides par défaut, exemples en grisé (`placeholder`), aucun résultat ni onglet sans
  saisie ; les réglages déjà saisis restent gardés.
- Priorités par défaut d'un objet : le moins de place, puis de machines, puis d'énergie, le prix
  ensuite (les priorités déjà choisies par un joueur ne changent pas) ; chiffres de la réponse dans cet
  ordre, la pollution dans Détails.
- En-tête sur une ligne jusqu'à 1 366 px, bouton « ← page précédente » retiré, « ▶ Je joue » écrit ;
  rappel « Tu jouais encore ? » en bandeau sous l'en-tête.
- Critère de fin : parcours A refait (partie vide → plan Crankshaft en tapant l'objet) ; aucune page
  ne montre de résultat sans saisie ; tests verts (adresses redirigées comprises).

#### S24 — Fenêtre d'orientation à la première visite

- Une fenêtre à la première visite (et rouvrable depuis l'en-tête) qui explique à un joueur
  d'Industrialist comment s'orienter : où planifier, où dire où il en est, l'usine et le schéma, les
  recettes, ce qui est gardé dans le navigateur. Pas un tutoriel pas à pas.
- Au début du lot : demander le lien de la page « philosophie » de l'utilisateur (modèle cité en
  Q24) ; maquette du texte et de la forme à valider.
- Critère de fin : maquette validée ; la fenêtre s'ouvre une fois, se referme, se rouvre ; lisible à
  375 px ; tests verts.

#### S25 — L'Usine au premier plan (M1, M8, M10, F10, F11)

- Onglets du résultat : **Usine** (ex-« Toute l'usine », ouvert en premier), Schéma, Liste des
  machines, Détails. L'Usine se calcule en **module par module** par défaut ; « recalculé pour l'usine
  entière » reste au choix.
- Dessin d'abord, cadré sur l'usine (la parcelle en repère) ; trois boutons (Tout afficher, Réseau
  électrique, Afficher les liaisons), le reste dans « Plus d'options » ; « Câbles » retiré (la
  liaison affichée le remplace).
- À côté du dessin, la liste des modules avec « module posé ✓ » (gardé par plan), qui grise le module.
- La page ne remonte plus quand on change de calcul ; « liaison non tracée » prévue (eau de la ferme)
  en note, pas en rouge.
- Critère de fin : parcours D refait, Usine visible en 1 geste après la réponse ; un module coché
  reste grisé au rechargement ; mesures de l'usine inchangées (§ 6, S4) ; tests verts.

#### S26 — Un module : l'ordre de pose du joueur (G3, M9)

- Le panneau d'un module : le dessin, « module posé ✓ », puis l'ordre de pose replié.
- L'ordre de pose est écrit **dans le sens où le module est posé dans l'usine** (directions tournées
  avec lui), et rangé comme le joueur construit : bâtiments (touche 1, « & » en AZERTY), tuyaux
  (touche 3, « " »), électricité puis logique (touche 2, « é »).
- Critère de fin : un module tourné d'un demi-tour dans l'usine décrit ses tuyaux dans le bon sens
  (test) ; l'ordre de pose d'une étape seule ne change que par son rangement ; tests verts.

#### S27 — À évacuer : la sortie au bord choisi (G4)

- Au début du lot : l'utilisateur montre les tuyaux « sans destination » (plan et capture) ; le plan
  Crankshaft 60/min n'a rien à évacuer, il faut donc trouver lesquels il voit.
- Pour chaque produit à évacuer : un tuyau jusqu'au bord choisi (en haut, en bas, à gauche, à droite),
  réglable dans l'Usine, gardé par plan.
- Critère de fin : sur un plan qui évacue (exemple de S15 : Research Station 4 en 1 h, Residue et
  Clay), chaque produit sort au bord choisi ; aucun tuyau ne finit dans le vide ; tests verts.

#### S28 — Schéma et réglages visibles (M2, M3, M4)

- Schéma : la vue de départ montre toute la chaîne ; « ⤢ » agit sur le dessin, pas sur la page.
- Barre « Ton plan » au-dessus des onglets : priorités, machines permises, réglages faits à la main
  (machines fixées, recettes choisies, réglages des machines), valeurs à vérifier ; chacun cliquable,
  avec ✕ pour l'annuler.
- Barre du bloc : « Tu peux régler : » (machines, recette, ne plus utiliser) et « Voir le module dans
  l'usine ».
- ⚠ cliquable sur un bloc, une ligne ou un module qui utilise une valeur à vérifier → la correction.
- Critère de fin : parcours E refait (valeur à vérifier du Crankshaft corrigeable en 2 gestes depuis
  le résultat) ; chaque réglage de S8, S9, S10 et S18 visible et annulable depuis « Ton plan » ; tests
  verts.

#### S29 — Mon usine, arbre, vocabulaire (M11, M12, F1 à F5)

- Mon usine en deux onglets : « Ma partie » (recherches, machines spéciales, ressources et parcelle,
  production en place, transférer) et « Ma recherche » (S20, S21). Le champ des RP montre le dernier
  relevé, l'estimation à côté.
- Arbre : option « bulle » pour débloquer près de la recherche (comme l'éditeur de bâtiments), pas
  par défaut.
- Vocabulaire du tableau 8 de la maquette : plus aucun id interne à l'écran (test qui le cherche),
  plus de références du projet (RP-04, MOD-09, « à m'envoyer »), mêmes unités partout, un seul nombre
  pour une même chose (RP manquants, recherches comptées).
- Critère de fin : Mon usine sous 2 000 px au téléphone par onglet ; test « aucun id à l'écran » ;
  tests verts.

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
- **Les remarques des joueurs (R15)** : un bouton « Remarque » sur le site, une page réservée à
  l'utilisateur pour lire, regrouper, répondre et publier au choix ; le service à ajouter sur le Pi
  (sans toucher à MyPrism), le stockage, la modération, l'anti-abus. Une fois en place, ajouter une
  étape à la visite d'orientation (`src/ui/tour.ts`), comme le demande l'utilisateur (2026-10-20).
- **Le découpage en lots** : des sessions courtes, dans l'ordre, chacune avec ses critères de fin,
  à ajouter au § 2 après validation.

Point de départ : la liste des défauts de S15 ([REVUE.md](REVUE.md), § 3) et ce qu'en ont corrigé
S22 à S29.

Questions : Q13, puis Q26 (remarques) et Q27 (accessibilité), posées le 2026-10-24 ; Q28 (maquette).

**Plan écrit (2026-10-24) : [PLAN-PUBLIC.md](PLAN-PUBLIC.md)**, avec la maquette `maquette/public.html`
(Q28, validée : décision S16 Maquette). En bref :
- **État des lieux** (§ 1) : les 27 défauts de la revue sont réglés (S22 à S29) ; il reste P1 à P12 :
  tout le texte en dur (≈ 1 400 textes dans `src/ui`, 800 dans le moteur, notes des données), nom du
  site différent selon l'endroit, aperçu Discord en français, pied de page sans auteur, deux contrastes
  trop faibles (bouton orange en sombre 2,4:1, ⚠ de Recettes en clair 3,9:1), menu coupé et cibles
  sous 24 px au téléphone, Recettes à 10 500 px au téléphone, Contribuer vide sans calcul, calcul long
  sans « Arrêter », restes F4 et P11 ; points du lecteur d'écran non vérifiés.
- **Traduction** (§ 2) : catalogues `src/i18n/fr.ts` et `en.ts` (type `typeof fr` : une clé oubliée
  ne compile pas), `t()` avec `Intl.PluralRules`, langue du navigateur puis bouton FR / EN gardé, mêmes
  adresses, `format.ts` seul à écrire nombres et dates ; moteur en codes et valeurs (empreintes de
  l'usine identiques) ; notes des données dans `data/i18n/en.json` ; noms du jeu en anglais dans les
  deux langues ; test « rien d'oublié » ; glossaire validé avant S30.
- **Forme et accessibilité** (§ 3) : un critère mesurable par point, contrôlé sur six pages × deux
  tailles × deux thèmes × deux langues.
- **Visiteurs** (§ 4) : tout visible, Contribuer présenté comme « Aider à corriger le site » ;
  Propositions dans le pied de page ; tableau de bord sans lien (`/tableau/`).
- **Remarques** (§ 5) : bouton « 💬 Remarque », « Envoyer ma correction », « Mes remarques », page
  Propositions avec +1, étape de la visite ; tableau de bord (boîte, sujets, réponse, publication,
  corrections en JSON, message dans le salon Discord) ; service `industrialist-remarques` (Node 24 du
  Pi, `node:http` + `node:sqlite`, 127.0.0.1:8091 derrière le nginx de l'Industrialist, unité à lui,
  64 Mo, MyPrism contrôlé avant et après, nginx rechargé après accord).
- **Lots** (§ 6) : S30 à S37, placés au § 2 avec leurs critères de fin ; le lien n'est posté qu'après
  S37.

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

### S40 — Plan : refaire la recherche (R18)

Fait le 2026-10-27, sans code. Sources lues : comparaison Pollywrath (`b37d7de`, § 4) et leur
`researchInfrastructure.ts`. Ils prennent bien les **items** en compte : RS2, RS3 et RS4 ont une
« valeur de recherche » (celle des items entrés) ; pour la RS3, multiplicateur d'argent
= log₂(v + 1) si v < 1, sinon log₄(v) + 1, avec v = prix de vente moyen ÷ 600 (×2 avec « RS4 buff »).
À confronter aux formules du wiki déjà dans `data/research-stations.json` avant tout changement.

Ordre et critère de fin de chaque lot :
- **S46 — Masquer** : l'onglet et l'objectif recherche affichent « en refonte » ; les données du
  joueur (relevés, journal S21) sont gardées. Fin : plus aucun chiffre de recherche affiché, rien de
  perdu au rechargement ; tests verts ; déployé.
- **S47 — Maquette** (`maquette/recherche.html`) : saisie **par tier** (nombre de stations, items
  entrés par station ou par groupe identique, liquides des contrôleurs, paraboles, circuits RS4),
  la recopie du panneau en contrôle (« ✓ comme en jeu » ou l'écart) ; bloc « Réglages de partie »
  (pollution globale, mois, difficulté), chaque valeur avec sa source (wiki ou Industrialist
  Calculator). Le niveau « détaillé » de S20 n'est **pas** retiré : les items restent indispensables
  (réponse du 2026-10-27). Fin : maquette validée par l'utilisateur.
- **S48 — Moteur** : vitesse et plafond par tier avec les items, bonus RS4 sous le plafond, Satellite
  buff (paraboles = √(S × R) + S sans arrondi ; efficacité linéaire, en attendant RP-03 ;
  bonus = 78 × log₁₀(R + 1) % × efficacité). Chaque règle prise chez Pollywrath faute de wiki est
  marquée « source : Industrialist Calculator » et notée dans `a-verifier.md`. Écart wiki / Pollywrath
  sur une même formule : on garde le wiki et on le note. Journal et temps de jeu (S21) réutilisés.
  Fin : tests qui refont la capture du 2026-10-18 et un cas de Pollywrath avec les mêmes entrées, au
  même résultat (ou écart expliqué) ; tests verts.
- **S49 — Interface** : « Ma recherche » et l'objectif recherche d'après la maquette, recherche
  réaffichée, FR et EN. Fin : un relevé en jeu après le seuil reste sous 2 % d'écart (critère de
  S20 conservé) ; parcours réel avec captures, ordinateur et téléphone ; déployé.
- **S50 — Pollution et mois** : réglages gardés avec la partie (pollution 10 par défaut, mois du jour
  par défaut). Pollution : pousse des arbres (facteur 1 + 0,005 p − 0,0001 p², borné 0,5 à 1,2),
  Residue de l'ASU = borne(p/10 ; 1 ; 20), Tree Scrubber. Mois : × 1,5 bûches de l'Igloo Farm en
  décembre, janvier et février. Ces formules sont de Pollywrath : les chercher d'abord sur le wiki.
  Fin : changer la pollution ou le mois change les recettes concernées et le plan ; tests ; déployé.
- **S51 — Difficulté** : réglage Normal / Hard / Impossible / Impossible2 / Sandbox / Sandbox+ ;
  recherches bloquées et machines réservées grisées, avec une phrase qui explique le réglage (il
  manque au site). Liste reprise de Pollywrath, contrôlée sur le wiki. Fin : en Hard, Wind Turbine1
  et Hand Crank ne sont plus proposés ; tests ; déployé.

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

  Posée le 2026-10-24 en 9 points, avec une proposition pour chacun : 1 français et anglais, catalogue
  ouvert à d'autres langues ; 2 langue du navigateur, bouton FR / EN dans l'en-tête, choix gardé ;
  3 mêmes adresses dans les deux langues ; 4 (b) Contribuer visible, présenté comme « Aider à corriger
  le site » ; 5 pas de page à part, aperçu du lien sur Discord (titre, phrase, image) ; 6 nom
  « Industrialist Production Planner », pied de page « outil de fan, non officiel », crédits du wiki,
  pseudo ; 7 qui relit l'anglais ; 8 sites de référence ; 9 ce qui doit être fini avant de poster le lien
  (proposé : anglais, forme, bouton « Remarque » ; publication plus tard).

  Réponses (2026-10-24) : « je suis complètement ok pour touuuut », avec : 6 « mon pseudo :
  Orangentleman » ; 7 « Moi, mais laisser la possibilité de signaler une erreur » ; 8
  « https://mindustryschematics.com » ; 9 « La page de publication et mon dashboard de reçu des remarques
  et des propositions doit être finis avant la publication ».
- **Q26 (S16), remarques des joueurs (R15).** Posée le 2026-10-24 : 1 un joueur envoie un type (erreur de
  valeur, bogue, idée), un texte, la page (ajoutée seule), un pseudo Discord facultatif ; 2 une page
  réservée sur le site, protégée par un mot de passe, et peut-être un message dans un salon de ton
  Discord (webhook séparé, sans toucher à MyPrism) ; 3 remarques rangées par sujet avec « N joueurs l'ont
  demandé », page publique « Propositions » qui ne montre que ce que tu publies, avec +1 ; 4 un petit
  service Node sans dépendance (fichier ou SQLite intégrée à Node), compte et unité à lui, derrière le
  nginx de l'Industrialist (`/api/`), rechargement de nginx demandé avant ; 5 au plus 5 remarques par
  heure et par visiteur, 2 000 caractères, rien de public sans accord, IP jamais gardée en clair
  (empreinte effacée sous 24 h) ; 6 les corrections (« ✎ Corriger ») et les relevés de bâtiments envoyés
  par le même service ; 7 une étape « remarques » dans la visite d'orientation.

  Réponses (2026-10-24) : tout « ok » ; 2 « Pour le discord j'ai fais un salon reservé sur mon serv, le
  bot y a accès » ; 6 « oui complètement ».
- **Q27 (S16), accessibilité.** Posée le 2026-10-24 : tout au clavier, contrastes suffisants, cibles d'au
  moins 24 px au téléphone, formulaires et boutons lisibles par un lecteur d'écran ; schéma et dessin de
  l'usine visuels, la liste des machines et les textes en sont la version lisible.

  Réponse (2026-10-24) : « ok ».
- **Q28 (S16), maquette `maquette/public.html`.** Posée le 2026-10-24 : 1 en-tête (nom, « Non officiel »,
  FR / EN, « 💬 Remarque », « ? ») et « Planificateur Industrialist » en français ; 2 aperçu Discord en
  anglais, français en variante ; 3 fenêtre Remarque (quatre types, pseudo facultatif, « Mes remarques »,
  « Envoyer mes corrections ») ; 4 Propositions : sujets publiés seulement, pas dans le menu ; 5 tableau
  de bord `/tableau/`, en français, mot de passe tapé par l'utilisateur sur le Pi ; 6 Discord par un
  webhook du salon réservé (le bot de MyPrism n'est pas touché) ; 7 glossaire et mots du jeu (case,
  parcelle, modes de construction) ; 8 ordre S30 → S37, S34 en parallèle possible.

  Réponse (2026-10-24) : « ok pour tout, je te laisse chercher les mots du jeu sur le wiki au début de
  S30 ».
- **Q29 (S30), glossaire et périmètre.** Posée le 2026-10-24 : mots du jeu trouvés sur le wiki (case →
  cell, parcelle → build area, outils Build / Wire / Pipe / Delete, pollution en %/h) ; périmètre de
  Planifier (formulaire et réponse, onglets en S31) ; nom anglais dès S30 ; « $950 » et « 2 d 4 h » en
  anglais ; site mélangé entre S30 et S31. Réponse : « ok pour tout » (décision S30 Glossaire, § 5).
- **Q14 (S17), bac à sable.** Posée le 2026-10-26 en 10 points, avec une proposition chacun ; réponses
  (décision S17 Bac à sable, § 5) : « ok » pour 1, 2, 4, 7 et 10 ; 3 « Une machine dont les ports ne sont
  pas relevés ne peut pas être posée » ; 5 « ok (même si je sais pas comment on peut concrètement mesurer
  un montage "petit") » ; 6 panneau qui défile horizontalement au téléphone, machines « triées par
  chapitre et catégorie comme dans le jeu » ; 8 indication visuelle de la recette, calcul automatique
  pendant la pose sans ralentir, tuyaux qui montrent ce qu'ils transportent, recette déduite des
  liaisons, indicateur seulement si plusieurs recettes vont ; 9 « le tuyau qui dépasse sa capacité doit
  changer de texture visuelle ». Questions d'origine :
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

  Réponses (2026-10-18) : 1 « a » ; 2 « De ce que je vois sur l'écran c'est la vrai conso qui est
  indiquée » ; 3 « Oui, mais indiquer la supposition » ; 4 « Meilleur rapport
  production/consommation (par défaut) », « moins de place », « meilleure production énergétique » ;
  5 « On prend en compte chaque type de blocs ! C'est le principe que je veux justement intégrer au
  calculateur ! » ; 6 « oui ».
- **Q17 (S20), vitesse des RP.** Posée le 2026-10-18, après la recherche.
  1. Place du lot : entre S19 et S15 (proposé : la revue S15 verra alors la recherche finie), ou
     ailleurs ?
     Réponse (2026-10-19) : « Place S20 entre S19 et S15. » Les points 2 à 4 restent à poser au
     début du lot.
  2. Saisie : les deux niveaux (« rapide » : recopier le panneau ; « détaillé » : stations, items,
     liquides, recalculés et comparés au panneau), ou un seul ?
  3. Tant que RP-05 (plusieurs tiers) n'a pas de réponse : un seuil par tier, appliqué aux RP/s de ce
     tier (ce que suggère le panneau), marqué « supposé » ?
  4. Relevés RP-01 à RP-08 (RELEVES.md, « Points de recherche ») : avant le lot, ou pendant ?

  Réponses (2026-10-19, début de S20) : 2 « les deux niveaux » (rapide par défaut, détaillé à
  côté) ; 3 « oui, un seuil par tier », appliqué aux RP/s de ce tier et marqué « supposé » jusqu'à
  RP-05 ; 4 « pendant » : le lot part des suppositions (deux Crankshaft, liquide de valeur 0,1) et
  intègre les relevés quand ils arrivent.
- **Q18 (S19), éditeur simplifié.** Maquette `maquette/editeur-simplifie.html` (inventaire de ce
  que l'éditeur affiche, avec pour chaque élément : garder, déplacer dans la grille, replier ou
  retirer). Aucun changement de fichier : `ports.json` et l'export restent les mêmes.
  1. Faces dans le dessin : devant en haut, derrière en bas, côtés à gauche et à droite, les deux
     côtés liés (comme les données) ; ou gauche et droite réglables à part ?
  2. Un seul « Enregistrer » pour le relevé, la correction du bloc et l'interface (au lieu de trois) ?
  3. Poser un port : outils gardés au-dessus de la grille, bulle au clic sur un port ; ou sans
     outils, une bulle au clic sur une case vide (type et sens choisis dedans) ?
  4. Bloc « Calcul » de la ferme (S13) dans l'éditeur : replié, ou retiré ?
  5. Retraits proposés : chaîne de l'ensemble, légende, « Contrôle » de la portée, champ « Ce que le
     jeu affiche », taille du wiki quand elle est identique ; sources au survol. Un de ces éléments
     sert-il ?

  Réponses (2026-10-19) : 1 « garder les deux avec les mêmes propriétés » (le fonctionnement du
  Crankshaft Sideways n'est pas clair) ; la structure gère les deux côtés à part, mais ils sont
  fusionnés par défaut, et une option les sépare ; 2 « okay » ; 3 « les deux » : le mode outils par
  défaut, le mode bulle derrière une option à nommer ; 4 « oui » (replié, le défaut proposé) ; 5 tout
  retirer (« Ce que le jeu affiche » servait parfois à dire qu'un poteau est en hauteur, ce que le
  calcul n'utilise pas).
- **Q19 (S20), maquette « Ma recherche ».** Maquette `maquette/recherche-rp.html` (nombres de la
  capture du 2026-10-18, recalculés avec les formules du wiki, 2 h après la saisie).
  1. Les champs RP et RP/s passent de « Ressources » à « Ma recherche » ?
  2. Les quatre tiers toujours affichés (lignes vides en gris), ou « + Ajouter un tier » ?
  3. Tableau des soldes (seuil, 100 000, 2 × seuil, Max RP), ou seulement « seuil atteint dans … » ?
  4. Objectif recherche : une colonne « + N stations aux tiennes » dans la chronologie et un bloc qui
     la détaille, ou le bloc seulement ?
  5. Paraboles : efficacité recopiée du panneau, bonus compté au prorata (supposé) ?

  Réponse (2026-10-20) : « Oui à tout » (avec, en complément, le texte de la page Research System
  du wiki, reporté dans `a-verifier.md`).
- **Q20 (S21), historique des RP.** Posée le 2026-10-20, après S20.
  1. Place du lot : avant ou après S15 ?
  2. Le graphique : dans « Ma recherche » (Mon usine) ou sur une page à part ?
  3. Les changements de configuration : notés automatiquement, ou seulement sur « Noter ce changement » ?

  Réponses (2026-10-20) : 1 « avant S15 » ; 2 « dans Ma recherche, un peu plus bas » ; 3
  « enregistrement automatique », et **deux courbes** : l'évolution des RP et celle des RP/s.
- **Q21 (S21), à poser au début du lot.**
  1. La capture du 2026-10-18 comme premier point : à quelle heure l'as-tu prise (même approximative) ?
  2. Période affichée par défaut : 24 h, 7 jours ou tout l'historique ?
  3. Frappes rapprochées : fondues en un seul événement si elles ont moins de 2 minutes d'écart ?
  4. Taille du journal : garder tout, ou seulement les 90 derniers jours ?

  Réponses (2026-10-20) : 1 l'heure ne compte pas : « le gain n'est fait que quand on est connecté sur
  le jeu », il faut pouvoir activer et désactiver les gains à tout moment, et l'on parle de Δt (périodes
  de jeu), pas de temps continu ; 2 « par défaut 24 h » ; 3 « oui » ; 4 90 jours (« la plupart des joueurs
  n'ont même pas autant d'heures de jeu » : la sauvegarde suit le temps d'activité en jeu).
- **Q22 (S21), maquette `maquette/historique-rp.html`.** Posée le 2026-10-20, au début du lot.
  1. Site fermé pendant « Je joue » : à la réouverture, demander « J'ai arrêté à la fermeture du site » /
     « Je joue toujours : compter … », et compter « arrêté à la fermeture » tant qu'il n'y a pas de réponse ?
  2. Passage au temps de jeu : le site repart du dernier relevé tel que saisi, hors jeu ; l'estimation en
     temps réel est abandonnée. D'accord ?
  3. Journal visible (replié sous les graphiques), avec ✕ pour retirer un événement faux ?
  4. Axe du temps : en heures de jeu avant maintenant (« −20 h … maint. … +6 h ») ou depuis le premier point ?
  5. Le reste de la maquette (interrupteur dans « Ma recherche » et l'en-tête, deux graphiques, repères
     numérotés, bleu = prévu, orange = relevé) ?

  Réponses (2026-10-20) : 1 « oui » ; 2 « okay » ; 3 replié par défaut, « difficile à lire » : la plus grande
  partie de la lecture doit se faire **en interagissant directement avec le graphique** ; 4 en heures de jeu,
  comme la maquette (avant maintenant) ; 5 « oui ».
- **Q23 (S15), parcours de joueur.** Posée le 2026-10-20, après le tour du site (inventaire dans
  [REVUE.md](REVUE.md)).
  1. Parcours proposés : A « je viens d'arriver sur le site », B « je veux 60 Crankshaft/min avec ce que
     j'ai débloqué, et je le construis », C « quand aurai-je assez de RP pour débloquer X ? », D « je pose
     un module en jeu d'après le plan de pose », E « une valeur du site ne correspond pas au jeu ». Lesquels,
     dans quel ordre ? Un autre à la place ?
  2. Qui tient la souris : toi sur le site en ligne avec ta vraie partie (tu me racontes), ou moi dans le
     navigateur intégré pendant que tu me guides ?
  3. Pour chaque parcours, je note tes réactions mot pour mot, le nombre de gestes et ce qui bloque.
     D'accord ?

  Réponses (2026-10-20, transmises par la session gestionnaire) : 1 « ils sont tous assez correcte, il y
  aura le nouveau parcours de la session d'après donc voilà » (A à E retenus, dans l'ordre ; le parcours de
  la session suivante n'est pas pour S15) ; 2 « (b) » (je tiens la souris dans le navigateur intégré, tu me
  guides) ; 3 « ok ».
- **Q24 (S15), maquette `maquette/revue.html`.** Posée le 2026-10-20, après les cinq parcours (notes et
  liste des défauts dans [REVUE.md](REVUE.md)). Les douze questions sont au bas de la maquette : menu,
  page d'arrivée vide, ordre des chiffres, barre « Ton plan », onglet ouvert en premier, tuyaux sans
  destination, ordre de pose, barre du bloc, durée dans l'arbre, Mon usine en deux onglets,
  vocabulaire, place de R15.

  Réponse (2026-10-20) : « En soi j'aime bien l'idée d'une accueil, mais plutôt que d'en faire un onglet,
  plutôt en faire un modal qui s'affiche à la première arrivé sur le site et qui faire un tuto pour bien
  s'orienter sur le site. Le tuto doit être destiner à un utilisateur joueur d'Industrialist. C'est pas
  vraiment un tuto, mais vraiment une explication de comment s'orienter sur le site. Si tu veux on avait
  déjà fait ce genre de chose sur ma philosophie web page. À part ça tout me va. »
- **Q25 (S24), maquette `maquette/orientation.html`.** Posée le 2026-10-20. Modèle donné par l'utilisateur :
  la visite guidée de son site de philosophie (`js/08-visite-guidee.js` : voile, projecteur, bulle,
  l'essentiel puis le détail, bouton « ? ») ; « c'est juste de quoi t'inspirer […] j'hésite encore à faire
  suivre le texte descriptif avec le focus ». Questions au bas de la maquette : bulle qui suit le projecteur
  ou fixe en bas ; contenu (7 étapes + détail) ; ton ; quand elle s'ouvre et le clic dans le sombre ;
  téléphone.

  Réponse (2026-10-20) : « Bulle fixe, et pour la visite détaillée, pense à rentrer dans les autres onglets,
  j'aurais aimé que tu montre au minimum le graphe et un plan d'une usine complète histoire qu'on voit
  vraiment le potentiel du site. Mais sinon c'est bien ».
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
| S18 Moteur | Maquette validée (`maquette/moteur-diesel.html`). Une configuration n'est proposée avec un carburant que si elle a été relevée avec lui (pas de rapport déduit : formule seulement à la demande). L'Info Panel affiche la vraie consommation : le relevé la note telle quelle. Tableau à 6 cylindres : accélérateur supposé 100 %, et la supposition s'affiche. | 2026-10-18 |
| S18 Choix | Trois critères par plan : meilleur rapport production/consommation (par défaut, le moins de L par MMF), moins de place, meilleure production énergétique (la plus grande puissance par moteur) ; « le moins cher » retiré. La liste « ou cette configuration… » de la maquette validée reste. | 2026-10-18 |
| S18 Blocs | Chaque type de bloc compte : le plan de pose et le prix prennent les nombres relevés (entrées d'air, échappements, entrées de carburant, générateurs, volants…). | 2026-10-18 |
| S19 Maquette | Validée (`maquette/editeur-simplifie.html`) : une case par face autour de la grille (devant en haut, derrière en bas, côtés à gauche et à droite, convention d'affichage), modifiée sur place ; bulle à côté du port cliqué ; un seul « Enregistrer » ; Interface, Capture, Remarques, « À savoir » et les blocs « Calcul » repliés (configurations du moteur ouvertes d'office sur le contrôleur) ; portée de la ferme sur une ligne et « ◯ Portée » dessinée dans la grille. Fichiers inchangés (`ports.json`, export, import). | 2026-10-19 |
| S19 Côtés | Les deux côtés suivent la même règle par défaut ; une option « Côtés réglés à part » les sépare (gauche et droite gardés à part dans la correction, leur réunion reste la face « côtés » des données). | 2026-10-19 |
| S19 Pose | Mode outils par défaut (outil puis clic dans la marge) ; option « Pose : Bulle » où un clic sur une case vide ouvre une bulle pour choisir le type et le sens. | 2026-10-19 |
| S19 Retraits | Retirés de l'écran : chaîne de l'ensemble, légende, « Contrôle » de la portée, champ « Ce que le jeu affiche » (gardé dans les données et l'export), taille du wiki quand elle est identique ; sources au survol. | 2026-10-19 |
| S20 Place | Le lot S20 (vitesse réelle des RP) passe entre S19 et S15 ; les points 2 à 4 de Q17 se posent au début du lot. | 2026-10-19 |
| S20 Saisie | Deux niveaux dans « Ma recherche » : rapide (recopier le panneau : RP/s et seuil de chaque tier, paraboles, « Max RP ») et détaillé (stations, items, liquides : le site recalcule le panneau et le compare). | 2026-10-19 |
| S20 Tiers | Un seuil par tier, appliqué aux RP/s de ce tier, écrit « supposé » tant que RP-05 n'a pas de réponse. | 2026-10-19 |
| S20 Relevés | RP-01 à RP-08 pendant le lot : le code part des suppositions (deux Crankshaft par station, liquide de valeur 0,1), écrites « supposé ». | 2026-10-19 |
| S21 Place | Nouveau lot S21 (historique des RP, R14) entre S20 et S15. | 2026-10-20 |
| S21 Graphiques | Dans « Ma recherche », un peu plus bas ; deux courbes (RP et RP/s) ; changements de configuration enregistrés automatiquement. | 2026-10-20 |
| S21 Temps de jeu | Les RP ne montent qu'en jeu (règle donnée par l'utilisateur) : interrupteur « Je joue / Je ne joue plus » à tout moment ; estimations, graphiques et journal en temps de jeu (Δt), pas en temps continu. | 2026-10-20 |
| S21 Journal | Période par défaut 24 h (de jeu) ; frappes à moins de 2 min fondues ; 90 jours de temps de jeu gardés. | 2026-10-20 |
| S21 Maquette | Validée (`maquette/historique-rp.html`, Q22) : interrupteur dans « Ma recherche » et bouton ▶/⏸ à côté de la puce RP ; site fermé pendant « Je joue » → question à la réouverture, « arrêté à la fermeture » tant qu'il n'y a pas de réponse ; le dernier relevé devient le premier point, hors jeu ; axe en heures de jeu avant maintenant ; journal replié par défaut, l'essentiel se lit en touchant le graphique (✕ dans le journal) ; bleu = prévu, orange = relevé. | 2026-10-20 |
| S20 Maquette | Validée (`maquette/recherche-rp.html`) : RP et RP/s passent dans « Ma recherche » ; les quatre tiers toujours affichés ; tableau des soldes (seuil, 100 000, 2 × seuil, Max RP) ; colonne « + N stations aux tiennes » dans la chronologie et bloc qui la détaille ; efficacité des paraboles recopiée du panneau, bonus au prorata (supposé). | 2026-10-20 |
| S15 Maquette | Validée (`maquette/revue.html`, Q24) : menu Planifier · Arbre · Recettes · Mon usine · Contribuer ; Planifier vide (exemples en grisé) pour les quatre objectifs ; chiffres place, machines, énergie, prix ; barre « Ton plan » ; onglets Usine (en premier, module par module), Schéma, Liste des machines, Détails ; « module posé ✓ » ; côté de sortie de ce qu'il faut évacuer ; ordre de pose dans le sens de l'usine et dans l'ordre du joueur, avec les touches ; ⚠ cliquable ; durée « à ton rythme » dans l'arbre ; Mon usine en deux onglets ; vocabulaire du tableau 8 ; R15 dans le plan de S16. | 2026-10-20 |
| S15 Accueil | Pas d'onglet Accueil : une **fenêtre d'orientation** à la première visite, pour un joueur d'Industrialist (« pas vraiment un tuto, mais vraiment une explication de comment s'orienter sur le site ») ; modèle : la page « philosophie » d'un autre site de l'utilisateur (lien à demander au début du lot). | 2026-10-20 |
| S15 Lots | Réorganisation découpée en S22 à S29, placés avant S16 (§ 2). | 2026-10-20 |
| S24 Visite | Maquette validée (`maquette/orientation.html`, Q25) : bulle fixe en bas ; l'essentiel (8 étapes) à la première visite, puis la visite détaillée proposée, qui entre dans les vues (au minimum le schéma et l'usine complète) ; bouton « ? » ; le reste comme la maquette. | 2026-10-20 |
| S25 Usine | Calcul module par module par défaut (réponse au parcours A : « sur le mode module par module par défaut car ça fait moins de calcul »), ce qui remplace la décision S4 « recalculé par défaut » pour les nouveaux joueurs. | 2026-10-20 |
| S15 Priorités | Priorités par défaut d'un objet : le moins de place, puis le moins de machines, puis le moins d'énergie, le prix en dernier (joueur avancé : « ma priorité se concentre sur la place et le nombre de machine, et l'énergie »). À faire dans un lot de réorganisation. | 2026-10-20 |
| S15 Parcours | Les cinq parcours A à E, dans l'ordre ; Claude tient la souris dans le navigateur intégré, l'utilisateur guide ; réactions notées mot pour mot, gestes et blocages. | 2026-10-20 |
| S29 Noms | « Water Pump2 », « Research Station4 », « Short Pipe2 »… (chiffre collé) : « Dans le jeu ya pas d'espace. Mais en soi c'est plus propre avec un espace donc fais au mieux » → le site affiche « Water Pump 2 » (comme l'arbre du jeu), les fichiers de données gardent le nom du wiki (`spacedName`, `buildGameData`). | 2026-10-24 |
| S16 Langues | Français et anglais ; catalogue de textes ouvert à d'autres langues ; langue du navigateur par défaut (français si `fr-*`, sinon anglais), bouton FR / EN dans l'en-tête, choix gardé ; mêmes adresses (`#objet`…) dans les deux langues. | 2026-10-24 |
| S16 Relecture | L'utilisateur relit l'anglais ; un moyen de signaler une erreur de traduction reste ouvert aux joueurs (par les remarques). | 2026-10-24 |
| S16 Public | Contribuer reste visible, présenté comme « Aider à corriger le site » ; même adresse pour le Discord, avec un aperçu du lien (titre, phrase, image) ; nom anglais « Industrialist Production Planner » ; pied de page « outil de fan, non officiel », crédits du wiki (CC BY-NC-SA), « par Orangentleman ». Référence donnée : mindustryschematics.com. | 2026-10-24 |
| S16 Publication | Le lien n'est posté sur le Discord qu'une fois finis : l'anglais, la forme, le bouton « Remarque », **le tableau de bord des remarques et propositions de l'utilisateur et la page publique « Propositions »**. | 2026-10-24 |
| S16 Remarques | Type (erreur de valeur, bogue, idée, traduction), texte, page ajoutée seule, pseudo Discord facultatif ; tableau de bord réservé (mot de passe) ; remarques rangées par sujet (« N joueurs l'ont demandé ») ; page « Propositions » qui ne montre que ce que l'utilisateur publie, avec +1 ; service Node sans dépendance, compte et unité à lui, derrière le nginx de l'Industrialist (`/api/`), rechargement de nginx demandé avant, MyPrism intouché ; 5 remarques par heure et par visiteur, 2 000 caractères, empreinte d'IP effacée sous 24 h ; corrections et relevés de bâtiments envoyés par le même service ; une étape « remarques » dans la visite. Discord : un salon réservé existe sur le serveur de l'utilisateur, son bot y a accès (moyen d'y écrire à confirmer au lot du service : webhook du salon, sans toucher au bot). | 2026-10-24 |
| S16 Maquette | Validée (`maquette/public.html`, Q28, « ok pour tout ») : « Industrialist Production Planner » / « Planificateur Industrialist », « Non officiel » à côté du nom, FR / EN, « 💬 Remarque » et « ? » dans l'en-tête ; pied de page en trois lignes ; aperçu Discord en anglais (fr_FR en variante) ; fenêtre Remarque (valeur fausse, bogue, idée, traduction ; pseudo facultatif ; « Mes remarques ») et « Envoyer mes corrections » ; Propositions (`#propositions`) hors du menu ; tableau de bord `/tableau/` en français, mot de passe tapé par l'utilisateur sur le Pi ; Discord par un **webhook du salon réservé**, sans toucher au bot ; glossaire proposé, mots du jeu (case, parcelle, modes de construction) à chercher sur le wiki au début de S30 ; ordre S30 → S37, S34 possible en parallèle. | 2026-10-24 |
| S30 Glossaire | Validé (Q29, « ok pour tout ») : case → **cell** (le jeu compte la portée des poteaux en *tiles*, 1 tile = 2 cases, Building System : « cross 133 tiles ») ; parcelle → **build area** (le wiki dit « world », jamais « plot » ni « land ») ; outils **Build, Wire, Pipe, Delete** (Building System) ; pollution en **%/h** (page Pollution : « 8.64%/h ») ; le reste comme l'écran 5 de la maquette. En S30 : formulaire et réponse de Planifier ; contenu des onglets et autres pages en S31 ; nom anglais « Industrialist Production Planner » dès S30, le français garde son nom jusqu'à S33 ; « $950 », « $2.1M », « 2 d 4 h » en anglais ; site mélangé pour un navigateur anglais entre S30 et S31 (lien pas encore posté). | 2026-10-24 |
| S31 Traduction | Prises dans le lot, sans question ouverte (rien ne demandait l'avis de l'utilisateur ; l'interface ne change pas, pas de maquette) : un catalogue par écran dans `src/i18n/vues/` (même typage que `fr.ts` / `en.ts`) ; textes du moteur et des données encore en français (S32) marqués `<span lang="fr">` (`frText`) ou isolés par U+2068 … U+2069 dans un attribut (`frRaw`), mis de côté par le test ; saisie des nombres selon la langue (`parseNum` : en anglais la virgule sépare les milliers, « 1,5 » est refusé) ; « X : Y », guillemets et « % » selon la langue (`colon`, `quote`, `fmtPct`) ; fichiers exportés et sources gardées avec une correction restent en français (PLAN-PUBLIC § 2) ; textes fixes d'`index.html` des pages Mon usine, Arbre, Recettes, Contribuer balisés (oubliés par S30). | 2026-10-25 |
| S32 Traduction | Prises dans le lot, sans question ouverte (l'interface ne change pas, pas de maquette) : le moteur renvoie `{ code, valeurs }` (`src/engine/message.ts`), écrit par `say()` / `txt()` (`src/ui/engine-text.ts`) avec le catalogue `src/i18n/vues/moteur.*.ts` ; les directions de l'ordre de pose sont des codes (N, E, S, W) que `turnMessage()` tourne avec le module ; le dictionnaire des notes `data/i18n/en.json` est rangé par fichier puis par **texte français** (au lieu de l'identifiant et du champ : une note répétée ne s'écrit qu'une fois, et une note modifiée perd sa traduction et se voit « (FR) ») ; les doutes écrits par les scripts d'extraction sont traduits par des règles (`src/i18n/data-notes.ts`) ; pluriels français corrigés au passage (« 13 croisements » au lieu de « 13 croisement(s) ») ; la consigne de l'onglet 3 est écrite par le catalogue comme le site l'affichait (« en mode tuyaux (touche 3, « " » en AZERTY) »), sans AZERTY en anglais. | 2026-10-25 |
| S16 Accessibilité | Tout au clavier ; contrastes suffisants ; cibles d'au moins 24 px au téléphone ; formulaires et boutons lisibles par un lecteur d'écran ; schéma et usine restent visuels, la liste des machines et les textes en sont la version lisible. | 2026-10-24 |
| S33 Forme | Maquette `maquette/forme.html` validée (« la maquette me va », 2026-10-25) : en-tête au téléphone en trois lignes (nom court, « Non officiel », FR / EN, ? ; menu entier ; mon usine) ; pied de page S16 en deux lignes (Fandom en CC BY-SA, crédit du calculateur de pousse des arbres gardé ; ligne Remarque / Propositions en S35-S36) ; image d'aperçu refaite en anglais (`scripts/og-image.html`, rendue par Chrome sans fenêtre) ; calcul long : temps écoulé, « ■ Arrêter », « Calculer module par module (plus rapide) » ; Recettes par 48 sous 900 px ; titres de Planifier en questions (« Que veux-tu produire ? »…), noms courts gardés pour « Revenir à » ; pollution : unité du jeu %/h gardée, bulle explicative. | 2026-10-25 |
| S35 Remarques | Maquette `maquette/remarques.html` validée (« ok pour tout », 2026-10-25) : « 📤 Envoyer mes corrections » dans Contribuer et dans la barre « ✎ Corriger » de Recettes, « 📤 Envoyer mes relevés » dans l'éditeur, qui ouvrent la fenêtre en type « Correction » avec le fichier de l'export joint ; « Mes remarques » avec état, pastille de réponse nouvelle et « Oublier » ; n° court montré, numéro secret caché ; 💬 sur la 1re ligne au téléphone, fenêtre en feuille ; étape 8 / 9 de la visite ; message Discord par un webhook que l'utilisateur crée et colle lui-même (`npm run remarques:discord`). Quand le site renvoie au Discord, c'est celui **du jeu** (https://discord.com/invite/SWERdzfdNF), en mentionnant **@orange** (corrigé en S36 : le pseudo Discord est **@orangentleman**). | 2026-10-25 |
| S36 Remarques | Maquette `maquette/tableau.html` validée en deux tours (« Tout me va », 2026-10-25) : tableau de bord `/tableau/` en français seulement ; ouvrir une remarque nouvelle la marque « Lue », filtre « À traiter » par défaut ; « Enregistrer et créer un sujet… » pour une remarque sans sujet ; réponse possible à tous les joueurs d'un sujet ; textes publics d'un sujet (titre, description, réponse) en français et en anglais, remplis par un bouton **🌐 Traduire automatiquement** (corrigeable), marqués « Traduit automatiquement » pour les visiteurs tant qu'ils ne sont pas relus ; « Traduire en français » sur une remarque ; traducteur **DeepL**, offre gratuite (« Developer » depuis 2026 : 1 million de caractères en tout, et non plus « API Free », 500 000 par mois), appelé par le service, clé créée et collée par l'utilisateur ; Propositions : **votes ▲ / ▼ comme sur Reddit** (modifiables et retirables), score = remarques + ▲ − ▼, « N joueurs l'ont demandé » = remarques + ▲ ; la fenêtre Remarque indique la **langue déclarée** de la remarque (menu français / anglais, langue du site par défaut) ; les 11 remarques d'essai sont gardées (« pertinentes »). | 2026-10-25 |
| S17 Sources et BAS | Industrialist Calculator (Pollywrath, MIT) est la 2e source, après Miraheze et avant Fandom. Fluid Pipe2 = 2 cases. Les infobulles des ports disent ce qui y passe (BAS-03) → l'éditeur les structurera (S38). Le partage d'une jonction suit la règle des tuyaux déjà donnée (BAS-05). Mois courant, pollution globale, Satellite buff : vraies mécaniques du wiki, à intégrer (S40). | 2026-10-26 |
| S17 Mindustry | 1re maquette refusée le 2026-10-26 : tout calquer sur Mindustry (remplace Q14-6 et Q14-7). Menu de pose en bas à droite (infos au survol, gardées au clic, **?** = fiche ; grille ; catégories du jeu ; tiers tout à droite ; outils sous la grille) ; bâtiments non relevés grisés, clic → compléter ; glisser = ligne sans diagonale ; tuyaux dans le menu, variantes dans le cadre d'infos, longueur 1 par défaut, longueurs auto au glisser (désactivables), virages et croisements posés seuls, pose par-dessus qui recoupe ; zone supprimée au relâchement ; ZQSD / WASD ; pas de boutons d'outils sur le côté ; tous les outils de Mindustry + Liaisons ; règles des tuyaux = réponse BAS-02. Détail : PLAN-BAC-A-SABLE.md § 1. | 2026-10-26 |
| S17 Bac à sable | Q14 (détail dans [PLAN-BAC-A-SABLE.md](PLAN-BAC-A-SABLE.md) § 1) : stats d'abord, sur la grille du jeu ; une machine sans ports relevés ne se pose pas ; partir d'un plan calculé en lot à part ; partage par fichier et par lien (« petit » = adresse ≤ 2 000 caractères) ; ☰ panneau latéral, tiroir horizontal au téléphone, machines par chapitre et catégorie comme dans le jeu (BAS-01) ; gestes de Mindustry, pas l'aspect ; calcul automatique et fluide pendant la pose, recette déduite des liaisons, « ? » si plusieurs, recette visible sur la machine ; liaisons fausses refusées, tuyau saturé avec une autre texture ; nom « Bac à sable » / « Sandbox ». | 2026-10-26 |
| S10 Maquette | Validée (`maquette/interfaces.html`) : section « Interface » dans l'éditeur de bâtiments ; ⚙ réglage à faire dans la liste de construction, la barre du bas du schéma, « Comment c'est calculé » et le plan de pose ; Quarry « définitif » ; écran de la Chemical Plant dans la barre du bas, par plan, avec « ↺ 1× ». Les crafts de la Chemical Plant ne sont plus « à vérifier » (valeurs du wiki à 1×, seul l'écran varie). | 2026-10-17 |
| S40 Recherche | Réponses du 2026-10-27 : masquer la recherche actuelle d'abord (S46) ; refonte complète (chiffres et saisie), journal et temps de jeu gardés ; règle absente du wiki → prise chez Industrialist Calculator, marquée et notée dans `a-verifier.md` ; pollution et mois dans des lots à part (S50) ; difficulté ajoutée (S51, « si tu veux ») ; maquette en 1er lot (S47) ; **items par station gardés** (ils changent la vitesse, Pollywrath les compte aussi). | 2026-10-27 |

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
- **2026-10-18, S18** (397 tests, déployé) : Q16 posée et validée (décisions S18 au § 5). Moteur : `DieselReading`, `parseDieselReading`, `dieselConfigs(file, relevés)` (un relevé remplace la configuration aux mêmes réglages et carburant), `dieselPick` (meilleur rapport production/consommation, moins de place, meilleure production énergétique, ou configuration imposée ; complément du même jour : « le moins cher » remplacé, réponses Q16 détaillées), `SolveRequest.diesel` (seule la configuration choisie parmi les moteurs) ; volants posés dans la ligne (`designDiesel`). Site : éditeur du moteur, carburant dans « Calcul », tableau des configurations (wiki ou relevé en jeu, L par MMF, ✕), formulaire « Relevé de configuration » gardé dans le navigateur, exporté et importé (clé `diesel`) ; barre du bas du schéma (carburant, critère, configuration), « ⚙ Panneau du contrôleur : rapport … accélérateur … » dans la liste, le plan de pose et « Comment c'est calculé » ; un choix par plan (`dieselChoice`).
  Parcours réel (navigateur intégré, DOM) : relevé de test (Diesel, valeurs fictives, effacé ensuite) → dans le tableau et le calcul ; énergie 2 MMF/s, autres centrales écartées : 1 moteur 32 cylindres (le moins de carburant), ⚙ rapport 14, 59 % ; carburant Diesel → 3 moteurs du relevé, rapport 16, 100 %, dans le plan de pose et « Comment c'est calculé » ; « moins de place » → 2 moteurs de 6 cylindres, rapport 13 ; « meilleure production énergétique » → 32 cylindres. Téléphone 375 px : la barre passe à la ligne.
  À surveiller : le défaut change les plans d'énergie au diesel (32 cylindres au lieu de 6, liste de blocs incomplète MOD-14) ; la page du schéma déborde déjà à 375 px (608 px de large sans la barre, d'avant S18) ; un 2ᵉ générateur relevé est compté dans le prix mais le dessin n'en pose qu'un ; l'éditeur garde les données du chargement pour les noms et prix.
- **2026-10-18, recherche R13** (sans code, non déployé) : vitesse des RP et plafond souple. Les formules du wiki retrouvent la capture du Research Tracking Panel (4 RS3 à deux Crankshaft supposés, liquide de valeur 0,1 supposé) ; « Max RP before … » = 3 × seuil. Questions RP-01 à RP-09 (`a-verifier.md`), méthode dans RELEVES.md, lot S20 proposé (Q17, place à valider).
- **2026-10-19, S19** (402 tests, déployé) : Q18 posée avec la maquette `maquette/editeur-simplifie.html` (inventaire de l'éditeur : garder, déplacer, replier, retirer), réponses et décisions S19 au § 5. Aucun changement de format : `ports.json`, l'export et l'import restent les mêmes ; seule nouveauté, la clé facultative `sides` d'une correction modulaire (côtés réglés à part, leur réunion reste la face « side »). Modèle : `faceBoxes`, `toggleFaceBlock`, `setFaceRequired`, `splitSides` (buildings-model.ts), `withSides` et `SideSplit` (modular.ts), `entryChanged`, `sameSize`. Éditeur réécrit : une case par face autour de la grille (devant en haut, derrière en bas, côtés liés par défaut, option « Côtés réglés à part »), modifiée sur place ; bulle à côté du port cliqué (type, sens, info-bulle, supprimer) ; option « Pose : Bulle » (clic sur une case vide → bulle), « Outils » par défaut ; un seul « Enregistrer » (seulement ce qui a changé, « ● non enregistré : … » tant qu'il reste quelque chose) et un seul « Oublier » ; portée de la ferme sur une ligne et « ◯ Portée » dessinée dans la grille ; Interface, Capture, Remarques, « À savoir » et « Calcul » repliés (configurations du moteur ouvertes d'office sur le contrôleur). Retirés : légende, formulaire sous la grille, champ « Ce que le jeu affiche » (gardé dans les données), chaîne, tableau des faces, « Contrôle » de la portée, taille du wiki quand elle est identique. RELEVES.md suit.
  Parcours réel (navigateur intégré, DOM : captures impossibles, fenêtre masquée ; valeurs de test, effacées ensuite) : Crankshaft (manquant) → port fluide posé dans la marge, bulle à côté, sens passé à sortie, info-bulle ; case « Côtés » → côtés réglés à part, Cylinder retiré à gauche, droite obligatoire ; « Enregistrer » → « relevé (encore incomplet), faces », correction gardée avec `sides` et rechargée à l'identique ; mode Bulle : case vide du haut → « Nouveau port », objet « les deux » posé, corps → prise ⚡ ou logique ; arroseur : portée 10 cases, cercle de 12 cases depuis le centre dans la grille, correction à 11 → « ● non enregistré : portée », Annuler ; contrôleur : configurations ouvertes d'office ; Press : bulle avec l'info-bulle relevée ; 375 px sans débordement (le tableau des configurations défile dans son repli).
  À surveiller : le clic sur un bouton « Pose » avait d'abord changé de page (attribut `data-pose` déjà pris par le site, renommé `data-posemode`) ; la bulle suit le glisser et la molette, mais reste à placer à la main si la page défile sous elle ; le relevé d'un bâtiment manquant n'est enregistré que si l'on a posé ou coché quelque chose ; l'export n'a pas été cliqué (téléchargement), il est couvert par un test aller-retour avec `sides`.
- **2026-10-20, S20** (422 tests, déployé) : Q17 (points 2 à 4) et Q19 (maquette `maquette/recherche-rp.html`) posées et validées, décisions S20 au § 5. Moteur pur `src/engine/research-balance.ts` : `rateAt`, `timeToReach`, `balanceAfter` (formule exacte `exactBalance` pour un seul seuil des tiers 1 à 3, Simpson sinon), `nearlyZero` (« Max RP »), `balanceTimeline`, `researchModel` (niveau rapide : le panneau, grandeurs du tier retrouvées par les formules inverses `tierSumFromPanel` ; niveau détaillé : groupes de stations et contrôleurs, contrôles « comme en jeu »), `withAddedStations` et `proposeAddStations` (« + N stations aux tiennes »). `research-points.ts` : `TierSum`, `tierRate`, `tierCap`, `groupSum` ; `evaluateStations` et `designResearch` acceptent les stations du joueur (`base`) : une installation du même tier s'y ajoute (gain réel, seuil du tier entier). Site : boîte « Ma recherche » dans Mon usine (RP et RP/s déplacés), RP estimés avec le plafond partout (`currentRp` prend les tiers), puce d'en-tête à la vitesse réelle (« ⚠ seuil »), objectif recherche avec le vrai seuil, colonne et bloc « + N stations aux tiennes », « Comment c'est calculé » (vitesse et seuil). Saisie gardée dans `player.research` (export compris). Wiki (Research System, texte de l'utilisateur) : « average RPx » contredit la somme de la page Research Station3 ; la capture tranche pour la somme (RP-10). Nouveaux doutes RP-10 à RP-12.
  Parcours réel (navigateur intégré, 371 px de large) : capture saisie au niveau rapide → seuil dans 19 min, 1,3 × seuil dans 30 min (25,26 RP/s), 2 × seuil 1 h 58 (5,04 RP/s), « Max RP » 230 625 (✓ avec 231 000) ; saisie avancée de 2 h (stockage modifié pour l'essai) → ≈ 154 229 RP, 4,96 RP/s (9,8 %), « seuil dépassé depuis 1 h 41 », en ligne droite le site aurait compté 382 682 ; niveau détaillé (4 RS3 Crankshaft + Crankshaft, 2 contrôleurs Light Oil) → 47,47 ✓, 76 875 ✓, 2,93 ✓, 230 626 ✓, 1ʳᵉ ligne ✓. Objectif « Foundry en 15 min » (Foundry décochée pour l'essai, recochée ensuite) : à ton rythme 30 min, + 7 stations aux tiennes 14 min (11 stations, 87,09 RP/s + 5,38, seuil 121 563, 700 000 $, 84 Crankshaft/min), installation neuve 15 min. Aucune erreur en console.
  À surveiller : l'écart avec un relevé en jeu après le seuil (RP-04, critère < 2 %) n'est pas mesuré, faute de relevé ; tout repose encore sur deux suppositions (deux Crankshaft, liquide de valeur 0,1) et sur un seuil par tier (RP-05) ; les paraboles d'une installation neuve s'ajoutent telles quelles (le log des liquides de tous les contrôleurs n'est pas recombiné) ; « 1,3 × seuil » remplace le « 100 000 » d'exemple de la maquette (ligne utile au relevé RP-04).
- **2026-10-20, après S20** : nouveau retour R14 (graphe de l'évolution des RP avec l'historique des changements) ; Q20 posée et répondue ; lot S21 écrit au § 3, placé avant S15. Q21 répondue le même jour : les RP ne montent qu'en jeu, le lot commence par l'interrupteur « Je joue / Je ne joue plus » et compte en temps de jeu. Aucun code.
- **2026-10-20, S21** (437 tests, déployé) : Q22 posée avec la maquette `maquette/historique-rp.html` (journal d'exemple calculé par le moteur sur la capture du 2026-10-18), réponses et décisions S21 au § 5. Moteur pur `src/engine/rp-history.ts` : horloge de jeu (`gameNow`, `setPlaying`, `stopAtLastSeen`, `needsRecall`), journal (`addEvent` : relevés, configurations, dépenses, frappes fondues sous 2 min de jeu, configuration identique non notée ; `prune` : 90 jours de jeu, points de départ gardés ; `removeEvent`), courbe par morceaux (`rpHistory`, `rpAtGame`, `readingGap`, `realTimeAt`). Site : interrupteur « Je joue / Je ne joue plus » en haut de « Ma recherche » et bouton ▶/⏸ dans l'en-tête ; RP, « seuil atteint dans … de jeu », chronologies de l'objectif recherche en temps de jeu (heure réelle seulement « si tu continues ») ; rappel « Tu jouais encore ? » à la réouverture (arrêt à la fermeture par défaut) ; deux graphiques SVG (`src/ui/rp-chart.ts`, palette contrôlée par le validateur du skill dataviz) avec prévision, pointillé au-delà de maintenant, relevés, seuil, repères ⚙/$ numérotés, reconnexions, info-bulle au survol, au toucher et au clavier ; journal replié avec ✕. Journal sous la clé `ind-calc:v1:rp-journal`, exporté avec la partie (clé facultative `history` ; un ancien fichier s'importe et commence un journal neuf). À la mise à jour, le dernier relevé devient le premier point, hors jeu.
  Parcours réel (navigateur intégré, ≈ 371 px et 1 280 px ; durées de jeu simulées en reculant l'horloge enregistrée, valeurs de test) : capture saisie → « Hors jeu », RP figés ; ▶ Je joue + 1 h → 128 752 RP, seuil dépassé depuis 41 min de jeu ; relevé 129 500 / 10,4 tapé au clavier → un seul événement (+0,5 % sur la prévision) ; Foundry rendue puis redébloquée dans l'arbre → deux repères $ ; 5ᵉ station du tier 3 (54,27 RP/s, seuil 85 534) → un seul repère ⚙ « stations 4 → 5, RP/s 47,47 → 54,27, seuil 76 875 → 85 534 » ; relevé 204 000 (−1,9 %) ; ⏸ puis 9 h hors jeu → 204 010 RP inchangés au rechargement ; reconnexion ▲ ; info-bulles au toucher ; export intercepté (clé `history`, 10 événements) puis import → journal identique ; site fermé 8 h pendant « Je joue » → question, arrêt à la fermeture sans réponse, « Je joue toujours » rétablit la session. Aucune erreur en console.
  À surveiller : le bouton de l'en-tête et celui de « Ma recherche » étaient redessinés toutes les 5 s (clic perdu) : seul le texte change désormais ; sur téléphone, l'en-tête ne montre que la puce « recherches » et le bouton ▶/⏸ (la puce RP est masquée, comme avant) ; le rappel ne sait pas si le téléphone était en veille avec le jeu ouvert (il demande) ; l'écart avec un vrai relevé après le seuil (RP-04) reste à mesurer en jeu.
- **2026-10-20, S15** (437 tests, sans code du site, non déployé) : tour du site page par page (navigateur intégré, captures, et DOM quand la capture échouait) ; Q23 : cinq parcours guidés par l'utilisateur, Claude à la souris (A arrivée, B 60 Crankshaft/min et construire, C quand aurai-je les RP, D poser un module, E valeur fausse), réactions notées mot pour mot dans `REVUE.md` avec gestes et blocages, sur une partie vide (serveur `calculateur-neuf`, port 5179) puis sur la progression exportée de l'utilisateur ; 27 défauts classés (graves G1-G4, gênants M1-M12, finition F1-F11) ; maquette `maquette/revue.html` validée (Q24) avec une fenêtre d'orientation au lieu de l'accueil ; nouveau retour R15 (remarques des joueurs) placé dans S16 ; réorganisation découpée en S22 à S29, avant S16.
  Mesures : de la partie vide au plan de pose total, 5 clics et une dizaine de crans de molette ; « quand aurai-je assez de RP pour Research Station 4 » : 7 gestes, réponse au 4ᵉ niveau (4 h 37 de jeu) ; valeur à vérifier du Crankshaft : 4 gestes depuis le schéma.
  À surveiller : « Des RP » affiche d'office un plan absurde (27 156 stations, G1) jusqu'à S22 ; les tuyaux « sans destination » vus par l'utilisateur ne sont pas encore identifiés (capture demandée pour S27) ; les relevés de bâtiments du 2026-10-20 envoyés par l'utilisateur étaient déjà intégrés ; les serveurs du navigateur intégré peuvent être arrêtés par l'application en cours de session (relancer avec `preview_start`).
- **2026-10-20, S22** (439 tests, déployé ; lancé dans la session de S15 à la demande de l'utilisateur) : fiche d'une recherche dans l'arbre (`research-view.ts`, `rpEta` dans main.ts) : « ≈ durée de jeu à ton rythme » sous « il te manque … » (même calcul que la chronologie : `balanceTimeline`, depuis les RP estimés, chaque prérequis dépense son coût ; « en ligne droite » quand le seuil n'est pas saisi ; sinon un lien vers Ma recherche), et « L'avoir plus vite ▸ » qui règle l'objectif recherche sur elle. Objectif recherche : « débloquer une recherche » par défaut et en premier dans la liste, vitesse vide par défaut (`rpRate: null`, « Indique la vitesse voulue ») : plus aucun plan d'office ; la réponse commence par « À ton rythme : ≈ … de jeu. ».
  Parcours C refait (partie de l'utilisateur, 17 000 RP à 14 RP/s) : arbre → Research Station 4 → « ≈ 4 h 37 min de jeu à ton rythme » en 3 gestes (7 avant, au 4ᵉ niveau) ; « L'avoir plus vite ▸ » → « À ton rythme : ≈ 4 h 37 min de jeu. Pour débloquer Research Station 4 en 1 h 00 min : 26 × Research Station3… ». Aucune erreur en console.
  À surveiller : les joueurs qui avaient déjà le but « atteindre une vitesse » gardent leur réglage (50 RP/s) ; dans ce but, le plafond automatique vise toujours la recherche la plus chère qu'il reste (5 M de RP), d'où des installations énormes : à revoir avec l'utilisateur (calcul, § 0 règle 5).
- **2026-10-20, S23** (441 tests, déployé) : menu Planifier · Arbre · Recettes · Mon usine · Contribuer ; page Accueil retirée (`#accueil` et toute adresse inconnue → Planifier ; l'encadré « Première visite » passe en haut de Planifier) ; « Données » devient « Contribuer » (`#contribuer`, les adresses `#donnees…` restent lues). Objectifs vides par défaut (`settings.entered` : un objectif devient rempli dès qu'on y saisit un objet, une quantité, une puissance ou un revenu ; les réglages d'avant S23 sont considérés remplis) : exemples en grisé, une phrase, ni résultat ni onglets ; la quantité 60 n'apparaît qu'une fois l'objet choisi. Onglets du résultat masqués quand il n'y a rien (objectif recherche sans plan). Priorités par défaut d'un objet : place › machines › énergie › prix (les priorités déjà enregistrées ne changent pas). Chiffres de la réponse : cases au sol, machines, énergie, prix ; la pollution passe en tête de Détails (objet, argent ; l'énergie la garde). En-tête : bouton « ← page précédente » retiré, « ▶ Je joue » / « ⏸ En jeu » écrit, « · hors jeu » retiré de la puce (le bouton le dit), en-tête jusqu'à 1 280 px ; rappel « Tu jouais encore ? » en bandeau sous l'en-tête (✕ = arrêté à la fermeture).
  Parcours A refait (partie vide, port 5181) : page d'arrivée vide en 0 geste ; « Crankshaft » tapé → 60 apparaît, « ne peut pas encore être produit » ; « C'est fait, je les ai débloquées » → 158 machines, chiffres 3 996 cases · 158 machines · 609,2 kMF/s · 426 k$. `#accueil` → `#objet`, `#donnees/batiments` → Contribuer. Bandeau de rappel simulé (2 h) : affiché sous l'en-tête. En-tête sur une ligne à 1 366 px (partie de l'utilisateur, Arbre, trois puces) ; téléphone 375 px sans débordement.
  À surveiller : au téléphone, le menu défile et « Contribuer » est coupé à droite (comme « Données » avant) ; les joueurs existants gardent leurs objectifs remplis et leurs anciennes priorités (énergie d'abord) : seul un nouveau joueur a le nouvel ordre ; le titre de la page reste « Produire un objet » (la maquette disait « Que veux-tu produire ? »).
- **2026-10-20, S24** (442 tests, déployé) : modèle donné par l'utilisateur (visite guidée de son site de philosophie), maquette `maquette/orientation.html` validée (Q25 : bulle fixe en bas, détail qui entre dans les vues). `src/ui/tour.ts` : voile, projecteur, bulle fixe en bas, l'essentiel (8 étapes) puis « Oui, le détail ▶ » / « Non merci » ; détail en 8 étapes qui ouvrent le schéma, l'usine complète (module par module), les priorités, le filtre de machines, Ma recherche, l'arbre et les recettes ; Échap ferme ; clic dans le sombre seulement à la dernière étape. Bouton « ? » dans l'en-tête (visite complète). Ouverture automatique à la première visite seulement (partie vide, clé `ind-calc:v1:visite`). Pendant la visite, la page montre un exemple (60 Crankshaft/min, toutes les recherches, sans filtre) : rien n'est enregistré (`saveSettings` suspendu), la progression et les réglages reviennent à l'identique à la fin.
  Parcours réel : partie de l'utilisateur, « ? » → 16 étapes, schéma dessiné, usine calculée (73 × 133 cases, 12 modules) et éclairée ; à la fin, réglages enregistrés identiques, 128 recherches, retour sur Mon usine. Partie neuve (port 5183) : la visite s'ouvre seule, 8 étapes puis le choix ; « Non merci » → page vide, comme avant.
  À surveiller : l'usine de l'exemple est encore cadrée sur la parcelle quand elle est renseignée (S25) ; les captures du navigateur intégré échouaient (fenêtre masquée) : parcours fait par le DOM ; les joueurs existants ne voient la visite que par « ? ».
- **2026-10-20, S24 bis** (retours de l'utilisateur sur la visite en ligne, 442 tests, déployé) : 1 « si ya rien comme objet, la ligne qui est ciblée est juste vide » → l'exemple se dessine dès le départ (la page n'était pas redessinée quand l'adresse restait `#objet`) ; 2 l'œil ne suit pas le premier projecteur avec la bulle fixe → le projecteur part de la bulle et glisse vers sa cible, puis pulse à chaque étape, et un bouton « Bulle fixe ⇅ / Bulle qui suit ⇅ » dans le coin de la bulle (choix gardé, `ind-calc:v1:visite-bulle`) ; 3 et 5 « le site nous empêche d'interagir pour expérimenter » → quatre volets autour du projecteur : la vue éclairée reste utilisable (schéma, usine, priorités, filtre, arbre, recettes : « Essaie : … ») ; « Marquer comme débloquée » n'enregistre rien pendant la visite ; 4 l'usine : l'avancement du calcul s'affiche dans la bulle, la page ne défile plus pendant la visite (`html.touring`), le projecteur se recale sur le dessin ; arbre et recettes éclairés en entier (`.rs-workspace`, `#rc-layout`) ; 6 défilement des recettes corrigé par le blocage de la page ; 7 « plus tard lors de l'ajout du système de proposition et de remarque […] faudra le mettre dans le tuto » → noté dans S16 (R15).
  Contrôlé par le DOM, 1 366 × 768 : 16 étapes, cibles sous l'en-tête et au-dessus de la bulle, avancement de l'usine affiché pendant ≈ 4,5 s puis projecteur sur le dessin, bulle qui suit sous la cible, fin : page débloquée, partie intacte. Piège : `overflow: hidden` sur `body` décroche l'en-tête collant (seulement sur `html`).
- **2026-10-20, S24 ter** (442 tests, déployé) : retour « toujours un peu bogué au niveau des craft, on a du mal à bien défiler et tout voir. Et j'ai fait boguer au niveau du schéma en sélectionnant un élément, en me déplaçant puis en le désélectionnant » → aux étapes où l'on essaie (schéma, usine, réglages, arbre, recettes), la page défile normalement ; elle n'est figée qu'aux étapes où l'on regarde ; le projecteur suit sa cible en continu (défilement, page qui grandit quand un bloc est sélectionné, calcul de l'usine), éclaire seulement la partie visible (entre l'en-tête et la bulle) et laisse un voile plein quand la cible est sortie de l'écran. Contrôlé (DOM, 1 366 × 768) : bloc sélectionné, défilé de 300 px aller-retour, désélectionné : projecteur sur le cadre à chaque fois ; recettes défilées de 400 px.
- **2026-10-20, S25** (442 tests, déployé) : onglets du résultat Usine (ex-« Plans de pose », ouvert sur toute l'usine), Schéma, Liste des machines, Détails ; onglet ouvert par défaut : Usine, calcul module par module par défaut (nouveaux joueurs ; les réglages enregistrés sont gardés). Panneau : le dessin d'abord, au-dessus la liste « Vue » et trois boutons (Tout afficher, Réseau électrique, Afficher les liaisons) ; « Câbles » retiré ; calcul, liaisons collées, disposition des modules (ex-« Priorités du plan ») et tuyaux de tier III dans « Plus d'options ». Dessin cadré sur l'usine, la parcelle en repère. Liste « Modules » sous le dessin avec « posé ✓ » (gardé par plan avec la liste à cocher, clé `posé:`), le module coché se grise. Pendant un recalcul, l'ancienne usine reste affichée, estompée, avec l'avancement par-dessus : la page ne bouge plus. Liaison vers une place réservée (eau de la ferme) : une note avec les noms du jeu (« Water : Water → Oak Log »), plus en rouge.
  Parcours D refait (port 5181, Crankshaft 60/min, 14 recherches) : onglet Usine en 1 geste, dessin à 738 px sous la barre, mesures identiques à S15 (recalculée 72 × 139 cases, 1 130 cases de tuyau, 102 croisements, 609,2 kMF/s ; module par module 1 274 cases, 100 croisements) ; module Crankshaft coché → grisé, gardé au rechargement ; recalcul : 0 px de décalage ; téléphone 375 px sans débordement.
  À surveiller : les joueurs existants gardent leur onglet et leur calcul enregistrés (recalculé) ; « Tout décocher » de la liste garde les modules posés ; l'ordre de pose reste celui du calcul (S26).
- **2026-10-20, S26** (444 tests, déployé) : l'ordre de pose d'un module est rangé par étape du joueur (bâtiments, tuyaux, électricité, logique quand il y en a), chacune avec sa touche du mode construction (1 « & », 3 « " », 2 « é » en AZERTY) ; « l'onglet 3 du mode construction » devient « en mode tuyaux (touche 3) » (`phaseOf`, `phasedOrder`, `renderOrder` dans module-view.ts, sans toucher au moteur). Dans l'usine, les directions tournent avec le module (`turnOrderText` : à gauche, par le haut, vers le haut, au-dessus et au-dessous, les uns sous les autres…, sens horaire) ; l'avertissement « décrit le module avant sa rotation » est retiré. Panneau d'un module : « Module posé ✓ » en tête (même réglage que la liste sous l'usine), ordre de pose replié.
  Contrôlé : 12 modules de l'usine Crankshaft (module par module, 7 tournés) ouverts un par un ; Crankshaft et Liquid Iron : bâtiments, tuyaux, électricité avec leurs touches, « posé » coché ou non comme dans la liste. Tests : rangement de phrases réelles du moteur, quatre rotations et aller-retour.
  À surveiller : le classement repose sur la forme des phrases du moteur (un test le garde) ; les ensembles modulaires (ferme, moteur) gardent leur ordre de pose d'avant ; aucune étape « logique » n'existe encore dans les modules.
- **2026-10-23, S27** (445 tests, déployé) : capture de l'utilisateur (usine recalculée, Atmospheric Distillation Plant — Light Oil, bouts de tuyau gris sans destination) : ce sont les sous-produits que la chaîne n'utilise pas (Residue, Heavy Oil, Naphtha, Gasoline…), dont le collecteur s'arrêtait au bord du module. Moteur (`factory.ts`) : `factoryInput` liste ce qu'il faut évacuer (tout le sous-produit, ou son surplus après les liaisons, boucles comprises : les mêmes quantités que « À évacuer » de la réponse) ; après la pose, chaque produit part par un tuyau jusqu'au bord de l'usine (le plus proche, ou celui choisi) : en module par module depuis un bout réservé devant la sortie (avant les liaisons, pour qu'aucun tuyau n'y passe), en recalculé depuis le collecteur du module ou, s'il a été retiré (produit en partie consommé), depuis le tuyau qui part déjà vers un client ; `FactoryPlan.evacs`. Site : tracé et flèche au bord avec le nom du produit, liste « À évacuer » sous les modules avec le bord au choix (gardé par plan, `settings.evacSides`), dans la clé du calcul. Demande en passant : glisser un cadre (schéma, usine, arbre, éditeur) ne sélectionne plus de texte (`user-select: none`, comme le graphe du site de philosophie de l'utilisateur, et sur toute la page pendant le glisser) ; étiquette « ta parcelle » déplacée en bas à gauche.
  Contrôlé : Light Oil 60/min sur la progression de l'utilisateur (priorités place › machines › énergie) : « À évacuer : Heavy Oil 53,3/min, Residue 20/min » dans la réponse comme dans la liste, deux tuyaux tracés jusqu'au bord en recalculé et en module par module, aucune liaison non tracée ; Residue mis « en haut » → gardé et recalculé. Test moteur : Light Oil (toutes recherches), les deux modes, bord le plus proche et bord imposé, case finale sur le bon bord.
  À surveiller : le plan exact de la capture n'a pas été reproduit (autres réglages dans le navigateur de l'utilisateur) : à revérifier chez lui ; le produit final (objectif) n'a pas de tuyau vers le bord ; les mesures du Crankshaft ne changent pas (aucun sous-produit inutilisé dans ce plan).
- **2026-10-23, S28** (452 tests avec S27, déployé) : maquette déjà validée (écrans 3 et 5 de `maquette/revue.html`, Q24). **Ton plan** (`plan-bar.ts`) entre la réponse et les onglets : priorités (✕ = ordre par défaut s'il a changé), machines permises (✕ = toutes), machines fixées (S8), recettes choisies, écran des machines (S10), moteur diesel (S18), options avancées ; chaque pastille ouvre son réglage (formulaire déplié, ou le bloc dans le schéma), ✕ l'annule ; « ⚠ N valeurs à vérifier ▾ » liste chaque valeur douteuse du plan en mots de joueur (« sortie Gear — 20 (Miraheze) ou 10 (Fandom) ») et mène à la correction (fiche en mode « ✎ Corriger », la case sélectionnée ; sinon Contribuer). Les notes « recettes choisies » et « filtre de machines » de la réponse sont retirées (dans la barre). **Barre du bloc** : ⚠ en clair, puis « Tu peux régler : » machines, recette (nouveau : comme Détails), écran, moteur, « Ne plus utiliser » ; « Voir le module dans l'usine ▸ » ouvre son panneau dans l'usine. **⚠ cliquable** sur le bloc du schéma, la ligne de la liste, le module de l'usine et son panneau. **Schéma** : la vue de départ montre toute la chaîne (place gardée pour les boutons de zoom) ; ⤢ y revient (⌂ retiré, en double) ; les boutons du cadre n'entament plus de glisser ; de loin (moins de 75 %), les blocs n'affichent que le nom et les machines en gros et les étiquettes des flèches au survol.
  Contrôlé (navigateur intégré, 1 366 × 768 et 375 px, partie neuve sur un second serveur) : parcours E en 2 gestes depuis le résultat (« ⚠ 2 valeurs à vérifier » → ligne Oak Log → fiche en mode Corriger, case de la sortie sélectionnée) ; chaque réglage S8, S9, S10, S18 et une recette choisie, posés puis annulés par ✕ ; « Voir le module dans l'usine » ouvre le panneau du Crankshaft. Fusionné avec S27 (liste « À évacuer » sous les modules gardée, ⚠ des modules ajoutés).
  À surveiller : le Crankshaft n'a plus de valeur à vérifier (durée et énergie relevées en jeu le 2026-10-12, `overrides.json`), le parcours E s'est fait sur la valeur douteuse du plan (Oak Log) ; sur une longue chaîne (10 colonnes), la vue complète tombe à 35 % : noms lisibles (≈ 9 px), machines petites ; les textes des doutes gardent les références du projet (« MOD-09 ») jusqu'à S29.
- **2026-10-24, S27 bis** (452 tests, déployé ; a43b994 puis ce bilan) : retours de l'utilisateur après S27. 1 « sur chaque tuyaux d'évacuation on a une section qui est coupée au niveau de la sortie du module, c'est juste un oublie de reconnexion » → la case où le tuyau d'évacuation se raccorde (bout devant la sortie, ou collecteur) fait partie du tracé. 2 « dans un module, quand on clique sur un tuyau ou qu'on le survol on a aucune info dessus » → infobulle sur chaque machine, prise, tuyau (produit, collecteur ou liaison, débit, tuyau et sa limite, pièce), bout de tuyau et poteau d'un module, aussi dans le panneau d'un module de l'usine ; le clic garde ce texte avec ✕. 3 « Le calcul est très lourd pour les grosses machine (10min ça commence à faire) […] sans dénaturer le calcul attention » → le calcul est le même, il va plus vite : placement (carte des places libres, scores précalculés par rotation), tracé des liaisons (file de priorité, chercheur sur des tableaux de nombres qui lit la grille une fois par case, sens en nombres), et un tour de tracé qui referait exactement le précédent n'est plus refait ; chaque usine calculée est gardée dans le navigateur (IndexedDB, les 12 dernières, refaite si le code du calcul ou les données changent : `__FACTORY_VERSION__` dans vite.config.ts) et la rouvrir est immédiat (« gardée dans ce navigateur : reprise sans recalcul »).
  Contrôlé : empreinte exacte du résultat (modules, cases et liaisons de chaque tuyau, liaisons, évacuations, poteaux, chiffres) identique avant et après sur 8 plans (Crankshaft ×3, Gearbox ×2, Light Oil ×2, Steel Plate) et sur Electric Motor 60/min recalculé (48 modules, 486 machines). Temps : Gearbox 60/min recalculé 22,6 s avant S27 bis → 5,7 s ; Electric Motor : plus de 30 min avant S27 bis (arrêté), 453 s avec a43b994 → 145 s (passages entre machines 414 s → 105 s ; placement 23 s). Navigateur (Light Oil 60/min, « Tout afficher ») : Residue et Heavy Oil sortent du collecteur sans coupure, en module par module et en recalculé ; page rechargée → usine reprise aussitôt ; survol et clic d'un tuyau du module Light Oil (« Steam — collecteur d'entrée de Light Oil, 6,67/s · tuyau tier III (jusqu'à 120/s) · Pièce : tuyau droit »).
  À surveiller : Electric Motor recalculé reste long au premier calcul, presque tout dans l'essai des passages entre machines (chaque essai refait le tracé de toute l'usine) ; son usine (386 × 160) ne tient pas sur la parcelle et garde 14 liaisons non tracées, comme avant ces changements (même résultat), donc aucun passage n'y est jamais gardé.
- **2026-10-24, S29** (458 tests, déployé) : maquette déjà validée (écran 7 et tableau 8 de `maquette/revue.html`, Q24). **Mon usine en deux onglets** : « Ma partie » (`#usine` : recherches débloquées et « dépenser ses RP », machines spéciales repliées derrière leur compte, ressources et parcelle, production en place, transférer) et « Ma recherche » (`#usine/recherche`, S20 et S21) ; le champ des RP garde le dernier relevé, à côté « Relevé il y a 3 h 35 min de jeu (saisi le …) · ≈ 226 237 RP maintenant » ; la puce RP de l'en-tête, l'arbre, la visite et l'objectif RP mènent à Ma recherche. **Arbre** : option « Débloquer : Panneau / Bulle » (Panneau par défaut, choix gardé, `ind-calc:v1:arbre-bulle`) ; en mode bulle, un clic sur une recherche ouvre à côté d'elle une bulle (prix, état, durée à ton rythme, mêmes boutons que le panneau, ✕ ou Échap), qui suit le glisser et le zoom. **Vocabulaire** : plus d'identifiant de craft (« Craft blast_furnace_09 » dans Comment c'est calculé, « Recette … » dans Contribuer, `recipes/…` dans Mes corrections), plus de nom de champ (`durationS` dans ✎ Corriger), plus de référence du projet (RP-04 à RP-12 → « supposé », MOD-xx → « à relever en jeu », « à m'envoyer », `data/overrides.json`) ; noms numérotés avec une espace (décision S29 Noms, § 5) ; l'énergie en « 4 kMF/s » partout, aussi dans les ⚠ et les cases à corriger (« 4 k » se lit 4 000 MF/s) ; « Débit voisin mieux rempli » → « À 108/min au lieu de 60/min, tes machines tournent à 95 % (85 % ici) » (Light Oil) ; « Recherche manquante pour Craft Assembler (4 825 RP) » et « À débloquer pour tout ce plan (9 735 RP en tout) » ; « Partie importée : N/146 recherches débloquées », le même compte que l'en-tête (non essayé avec un vrai fichier). Test `vocabulaire.test.ts` : plans Crankshaft, Light Oil, Steel Plate (toutes recherches et partie neuve), panneau de chaque bloc, valeurs à vérifier, fiches et arbre, avec les vraies données : aucun identifiant à plusieurs morceaux, nom de champ, référence ni nom collé.
  Contrôlé (navigateur intégré) : Ma partie 1 915 px et Ma recherche 1 994 px au téléphone (375 px, partie d'essai, au-delà du seuil), sans débordement ; bulle ouverte sur Water Pump 2, son bouton ouvre le même dialogue que le panneau (annulé), elle suit le glisser ; partie neuve (port 5187) : 60 Crankshaft/min tapés, les deux nombres de RP nommés ; 17 vues parcourues sans identifiant ni référence. Empreintes de l'usine identiques sur les 8 plans (les noms ne changent pas le calcul).
  À surveiller : en mode « Détaillé » ou avec beaucoup de stations, Ma recherche peut repasser au-dessus de 2 000 px au téléphone ; la pollution reste en « %/h » (F4, pas de mot proposé dans la maquette) ; j'ai d'abord modifié deux fichiers avec `sed` (même contenu), la règle de l'utilisateur est Write/Edit.
- **2026-10-24, S16** (458 tests, sans code du site, non déployé) : Q13, Q26 (remarques) et Q27 (accessibilité) posées puis répondues (« complètement ok pour touuuut », pseudo Orangentleman, relecture par l'utilisateur, référence mindustryschematics.com, tableau de bord et Propositions finis avant de poster le lien, salon Discord réservé) ; tour du site en nouveau venu (port 5189, `calculateur-public`, 1 366 et 375 px, clair et sombre, contrastes et cibles mesurés par le DOM) → 12 points P1 à P12 ; [PLAN-PUBLIC.md](PLAN-PUBLIC.md) (traduction, forme, visiteurs, remarques, service sur le Pi, lots, risques) ; maquette `maquette/public.html` validée (Q28) ; lots S30 à S37 placés au § 2, S17 après S37.
  Mesures : ≈ 1 400 textes en dur dans `src/ui`, 800 dans `src/engine`, 55 dans `index.html` ; contrastes trop faibles : bouton principal en sombre 2,4:1, ⚠ de Recettes en clair 3,9:1 ; au téléphone, menu coupé sur les six pages, 11 cibles sous 24 px sur Planifier et 19 sur Ma partie, Recettes 10 500 px ; aucune erreur en console ; Node 24 et ≈ 630 Mo libres sur le Pi (lecture seule, rien modifié).
  À surveiller : les mots anglais du jeu (case, parcelle, modes de construction) sont à chercher sur le wiki au début de S30 ; les textes SVG (schéma, usine, arbre) faussent la mesure automatique des contrastes : contrôle à l'œil en S33 ; le service des remarques demandera un rechargement de nginx sur le Pi (accord avant, S34).
- **2026-10-24, S30** (470 tests, déployé) : glossaire validé (« ok pour tout », Q29) ; `src/i18n/` (`fr.ts` source, `en.ts` du type de `fr` : une clé oubliée fait échouer `npm run typecheck`, essayé ; `t()` avec trous et `Intl.PluralRules` ; `dom.ts` pour les `data-i18n` d'`index.html`) ; bouton FR / EN dans l'en-tête, langue du navigateur au premier passage puis choix gardé (`ind-calc:v1:langue`), page redessinée sur place ; nombres, $, %, durées et dates selon la langue (`format.ts`, `fmtDate`) ; traduits : squelette, `<title>`, description, en-tête, menu, pied de page, rappel « Tu jouais encore ? », Planifier (formulaire, priorités, filtre de machines, options avancées, réponse et chiffres, barre « Ton plan », machines fixées, noms des onglets et textes fixes des cadres).
  Contrôlé (navigateur intégré, 1 366 et 375 px) : FR → EN → FR sans recharger, choix gardé au rechargement, `<html lang>` et titre suivent ; sur les quatre objectifs en anglais, il ne reste en français que le contenu des onglets (S31) et les notes des données et du moteur (S32) ; en-tête sur une ligne à 1 366 px dans les deux langues ; aucune erreur en console. 12 tests nouveaux (`src/i18n/i18n.test.ts` : langue de départ, pluriels, nombres, mêmes clés et mêmes trous, pas de français dans `en.ts`, clés d'`index.html`).
  À surveiller : la saisie des nombres lit encore la virgule comme décimale (`parseInput`, « 1,234 » en anglais donne 1,234) : à régler en S31 avec les vues qui l'utilisent ; le nom français reste « Calculateur Industrialist » jusqu'à S33 ; la détection de la langue du navigateur n'a été essayée que par test (le navigateur intégré est en français).
- **2026-10-18, après S13** : deux nouveaux retours (R11, R12) ajoutés au plan sous forme de lots de planification, sans code : S16 (site en anglais et ergonomie, pour le Discord) et S17 (bac à sable : construire sa chaîne, tracé des tuyaux à la Mindustry). Questions Q13 et Q14 à poser au début de ces lots. Ordre : S14, S15, S16, S17.
- **2026-10-25, S31** (479 tests, déployé) : toutes les vues de `src/ui` passent par `t()` (1 594 clés dans 8 catalogues `src/i18n/vues/*.fr.ts` / `.en.ts`), visite comprise (étapes = clés), textes fixes d'`index.html` des quatre autres pages balisés, éditeur de bâtiments redessiné au changement de langue (`buildings.refresh()`) ; restes de S30 réglés (`parseNum` pour `parseInput`, `parseEnergy`, `readNum`, `parseOptional`… ; `pluralFr` / `joinFr` retirés au profit des pluriels du catalogue et de `joinList`). Test `src/ui/traduction.test.ts` : aucun texte français écrit en dur dans `src/ui` (chaînes et morceaux de gabarits, exceptions listées : codes du moteur, fichiers exportés), chaque texte français d'`index.html` porte sa clé, et en anglais les vues de `vocabulaire.test.ts` ne montrent ni accent ni mot français (noms du jeu et textes S32 mis de côté).
  Contrôlé (navigateur intégré, 1 366 et 375 px) : visite jouée en entier en anglais (16 étapes) ; repérage automatique du français visible (textes, infobulles, titres SVG) sur Planifier (objets, énergie, RP ; 4 onglets, chaque bloc du schéma, usine complète, module seul et dans l'usine, ferme d'arbres), Mon usine (deux onglets, saisie rapide et détaillée, historique), Arbre, Recettes (fiches, mode Corriger, erreurs du formulaire, lignes), Contribuer (toutes les valeurs, 5 bâtiments) : rien hors S32 ; « 15,000 » lu 15 000 en anglais ; FR ↔ EN sur place ; aucun débordement à 375 px ; aucune erreur en console.
  À surveiller : textes du moteur et des données visibles en français en anglais (ordre de pose, avertissements, contrôles « comme en jeu », noms d'installation du moteur diesel, gabarit « double rangée ») : S32 ; la touche AZERTY « é » reste citée en anglais ; « Contribute » coupé à droite au téléphone (P6, S33) ; décision de visite automatique (« Tu sais t'orienter ») contrôlée par le code seulement.
- **2026-10-25, S32** (484 tests, déployé) : aucun message du moteur n'est écrit en dur : 273 morceaux de phrase de `src/engine` et `src/engine/build` deviennent des codes (202 clés `eng.*`), y compris l'ordre de pose (étape du joueur lue sur le code, plus sur la phrase), les avertissements du calcul, les contrôles « comme en jeu » de Ma recherche, les noms d'installation du moteur diesel et de la ferme, les gabarits, la pousse des arbres, les réglages des interfaces et les erreurs des fichiers de corrections. 211 notes des données affichées traduites (`data/i18n/en.json` : 143 textes + 9 notes écrites par le site ; règles pour les gabarits des scripts) ; `frText` / `frRaw` retirés ; exceptions du test « rien d'oublié » réduites aux identifiants internes et aux notes des fichiers exportés. Tests nouveaux : `src/i18n/data-notes.test.ts` (aucune note affichée sans traduction, aucune traduction orpheline ou en français, marque « (FR) »), S26 réécrit sur les codes (mêmes phrases françaises, rotation, anglais).
  Contrôlé : empreintes SHA-256 du moteur avant / après sur 8 usines (Crankshaft ×3, Gearbox ×2, Light Oil ×2, Steel Plate ; modules, tuyaux, poteaux, passages, avancement) et sur 12 plans, les modulaires, la recherche et les interfaces, avec les messages réécrits en français : identiques, sauf deux phrases voulues (consigne de l'onglet 3 telle que le site l'affichait ; « 157 700,45 $ » avec séparateur de milliers) ; ordre de pose rangé comme avant (test S26). Navigateur intégré (1 366 et 375 px, FR et EN) : usine entière et module tourné, ferme d'arbres, 117 valeurs à vérifier, fiches Recettes (Boiler, Firebox, moteur diesel, mouleur, Quarry), éditeur de bâtiments (blocs de la ferme et du moteur, interfaces), Mon usine, Ma recherche, objectifs énergie, RP, argent, arbre : aucun texte français ni « (FR) » en anglais, aucune erreur en console.
  Corrigé ensuite à la demande de l'utilisateur : la valeur « parts » de la ferme d'arbres (Contribuer) s'affichait « [object Object] » (défaut antérieur) ; elle s'écrit « 1 × Tree + 1/44 × Tree Farm Sprinkler + … par ferme » (test dans traduction.test.ts).
  À surveiller : séparateur « ; » français entre deux autres valeurs (« Other: … ; … ») ; une collecte d'un objet « Logic … » n'est plus rangée à tort dans l'étape Logique (l'ancien classement lisait le mot « logic » dans la phrase) ; la touche AZERTY « é » reste citée en anglais (S31).
- **2026-10-25, S33** (516 tests, déployé) : nom « Planificateur Industrialist » / « Industrialist Production Planner » partout (en-tête, onglet, `site.webmanifest`), « Non officiel » à côté du nom ; pied de page en deux lignes (auteur, données et licences) ; aperçu des liens en anglais (`og:*`, en_US + fr_FR, nouvelle `og-image.png` tirée de `scripts/og-image.html`) ; contrastes : jeton `--on-accent` (texte sombre sur l'orange en sombre, 6,8:1 au lieu de 2,4:1), `--warn` clair `#8a5700` (5,4:1 au lieu de 3,9:1), test `src/ui/contraste.test.ts` (15 paires × 2 thèmes) ; contour du « RP » de l'arbre épaissi ; en-tête au téléphone sans défilement ; cibles ≥ 24 px au téléphone ; Recettes par 48 sous 900 px ; calcul long (temps écoulé, « Arrêter », passage au module par module ; le bouton de la boîte posée sur l'ancienne usine, qui ne faisait rien, est branché) ; titres de Planifier en questions ; bulle de la pollution ; cadres du schéma et de l'usine renvoyant à la « Liste des machines ».
  Contrôlé (navigateur intégré, port 5193, 375 px et 1 366 px, sombre et clair, FR et EN, mesure par le DOM) : sur les six pages, 0 cible sous 24 px au téléphone (avant : 42 sur Planifier avec l'Usine, 12 sur Mon usine, 4 sur Contribuer), menu entier, aucun débordement, aucun texte HTML sous 4,5:1 ; textes SVG mesurés contre leur pastille (usine 27, schéma 82 : tous ≥ 4,5:1 ; arbre : le « RP » cyan ne tient que par son contour, épaissi puis vu à l'œil) ; Recettes 2 349 px au téléphone (avant 10 491), « Afficher 48 de plus » garde le focus sur la première tuile ajoutée ; calcul recalculé : « Arrêter » dans la boîte et dans l'en-tête, focus sur « Relancer », « module par module » bascule l'option ; Échap ferme la fenêtre de confirmation et rend le focus au bouton ; schéma déplacé et zoomé au clavier ; titre de l'onglet et `<html lang>` suivent la langue.
  Aperçu Discord vu par l'utilisateur dans son salon réservé : « L'aperçu Discord est bon. »
  À surveiller : au téléphone, l'ordre au Tab suit le DOM (nom, menu, mon usine, FR / EN, ?) et non les lignes affichées (FR / EN et ? sont sur la 1re ligne) ; la « Liste des modules » n'existe que dans l'Usine ; `index.html` reste en français avant le script (seuls les `og:*` sont en anglais).
- **2026-10-25, S34** (535 tests, service installé sur le Pi ; site redéployé sans changement visible) : `server/` (`service.ts` accès publics et `/api/admin/`, `base.ts` SQLite + purge des empreintes à 24 h + copie de la nuit sans empreinte, `securite.ts` scrypt et HMAC, `remarques.ts` point d'entrée, `hacher.ts`) ; `server/service.test.ts` (19 tests, horloge simulée) ; `npm run remarques` + proxy `/api/` de Vite ; `scripts/pi/remarques.sh` (compte, unité, nginx de l'Industrialist, rien démarré ni rechargé), `controle-myprism.sh`, `mot-de-passe.ps1` (`npm run remarques:mot-de-passe`), `relire-remarques.ps1`, `npm run deploy:remarques`.
  Contrôlé : en local par le navigateur (envoi, relecture par l'accès réservé, 6ᵉ refusée, cookie invisible au JS) ; en ligne par `https://industrialist.myprisme.fr/api/` (201, 6ᵉ → 429, autre Origin → 403, admin sans session → 401, relecture des 5 remarques d'essai par l'utilisateur avec son mot de passe) ; MyPrism identique avant / après (PID, heures de démarrage, empreintes des fichiers). nginx rechargé une fois et service démarré, avec accord.
  Après le bilan, avec l'accord de l'utilisateur : `cgroup_enable=memory` ajouté à `/boot/firmware/cmdline.txt` et Pi redémarré ; les `MemoryMax` sont maintenant appliqués (remarques 63 Mo sur 64, dont 30 Mo de cache de fichiers, aucun oom_kill, réponses en 2 ms ; MyPrism sans limite, fichiers identiques, unités actives).
  À surveiller : `NetworkManager-wait-online` échoue au démarrage (aucun journal du démarrage précédent pour savoir si c'est nouveau ; sans effet visible, tout est actif). Un +1 n'est unique que pendant 24 h côté service (l'empreinte s'efface ensuite) : S36 doit aussi le retenir dans le navigateur. La saisie masquée par `ssh -t` dans le terminal de l'application n'a pas marché (deux échecs) : le mot de passe se tape sur le PC. 5 remarques d'essai restent dans la base (à supprimer depuis le tableau de bord en S36).
- **2026-10-25, S35** (545 tests, service et site en ligne, `e95e2fa`) : maquette `maquette/remarques.html` validée (ce que S16 ne couvrait pas) ; « 💬 Remarque » dans l'en-tête et le pied de page, fenêtre `<dialog>` (`src/ui/remarques-view.ts`, `remarques.ts`, catalogue `vues/remarques.*.ts`) : type, texte, pseudo, case piège, page + plan + version (`__SITE_VERSION__`) joints, brouillon gardé, renvoi au Discord du jeu avec @orange ; « Mes remarques » (n° court, état, réponse, pastille, « Oublier », relu à l'ouverture et une fois par jour) ; « 📤 Envoyer mes corrections » (Contribuer, ✎ Corriger) et « 📤 Envoyer mes relevés » (éditeur), fichier de l'export joint, « Envoyées le… » ; étape 8 / 9 de la visite ; service : n° court renvoyé, `server/discord.ts` (webhook relu à chaque remarque, sans mention, 300 caractères), `npm run remarques:discord` (adresse collée par l'utilisateur, `/etc/industrialist-remarques/discord`).
  Contrôlé : en local (envoi, correction avec fichier complet, réponse et pastille, service arrêté → message et texte gardés, trois boutons d'envoi, FR / EN, 375 et 360 px) ; en ligne, une remarque de chaque type (n° 6 à 9) et une correction (n° 10) reçues avec page, langue et version, la 6ᵉ refusée, réponse d'essai lue dans « Mes remarques » ; webhook posé par l'utilisateur, n° 11 posté et vu par l'utilisateur dans son salon (« le message n° 11 est bien dans le salon »). Service redémarré avec accord, nginx non rechargé, MyPrism identique avant / après.
  À surveiller : au téléphone, le logo est caché sous 400 px pour que 💬 tienne sur la 1re ligne (une ligne jusqu'à 360 px) ; sur ordinateur à 1 366 px, avec une partie avancée (RP et « Je joue »), « ? » et 💬 passent sur une 2ᵉ ligne (« ? » y passait déjà avant) ; 11 remarques d'essai dans la base (n° 1 à 11), à supprimer en S36 ; le lien « Ouvrir dans le tableau de bord » du message Discord (`/tableau/#n°`) ne marchera qu'avec S36 ; la réponse d'essai du n° 6 a été écrite directement dans la base.
- **2026-10-26, S36** (565 tests, service redémarré et site en ligne, `994756f`) : maquette `maquette/tableau.html` validée en deux tours (décision S36 Remarques : votes comme sur Reddit au lieu du +1, traduction automatique, sujet créé depuis la réponse, langue déclarée) ; `/tableau/` (`src/tableau/`, page du build servie par nginx sans réglage nouveau) : entrée, boîte (filtres, « À traiter », ouvrir = « Lue », états), ranger, répondre, « Enregistrer et créer un sujet… », sujets bilingues (état, publication, réponse à tous les joueurs du sujet), corrections en JSON, export, suppression confirmée, `/tableau/#n°` ; `#propositions` (`src/ui/propositions*.ts`) : votes ▲ / ▼ modifiables, identifiant de vote du navigateur, un vote par adresse et par sujet sur 24 h, 60 votes par heure, texte dans la langue du visiteur, « Traduit automatiquement » ; `server/traducteur.ts` (DeepL, `npm run remarques:traducteur`, traducteur d'essai en local) ; base : colonnes ajoutées sans perte, +1 devenus des votes ▲ ; fenêtre Remarque : langue déclarée, pseudo @orangentleman.
  Contrôlé : en local (n° 1 envoyée du site en anglais, n° 2 et 3 par l'API ; mauvais mot de passe refusé ; traduction d'essai ; réponse ; sujet créé et publié depuis la réponse ; 3 remarques rangées ; état « Prévu » ; réponse envoyée aux 2 autres joueurs ; Propositions « 3 joueurs l'ont demandé » ; ▲, retrait, ▼, ▲ ; 2ᵉ navigateur à la même adresse refusé ; réponse lue dans « My feedback » en anglais ; 375 px sans débordement ni cible sous 24 px). En ligne : `/tableau/` et `/api/propositions` en 200, `/api/admin/` en 401 sans mot de passe, page Propositions vide affichée. Service mis à jour puis redémarré avec accord (51 Mo sur 64), nginx non rechargé, MyPrism identique avant / après.
  À surveiller : le parcours en ligne avec ton mot de passe (ranger, répondre, publier, voter) reste à faire par toi ou en S37 : je ne tape pas ton mot de passe ; la traduction n'a tourné qu'avec le traducteur d'essai : DeepL a renommé son offre gratuite (« Developer », 1 million de caractères en tout, au lieu de « API Free » 500 000 par mois), la clé reste à créer et le suffixe « :fx » des clés gratuites est à vérifier sur la vraie clé ; les 11 remarques d'essai de S34-S35 sont gardées (décision S36) ; le bundle principal dépasse 1 000 ko (1 577 ko, déjà 1 567 ko avant S36).
  Après le bilan (2026-10-26) : clé DeepL (offre Developer) posée par l'utilisateur ; essai sur le Pi par le code du service, sans lire la clé : elle finit par « :fx » (api-free.deepl.com) et « Partager un plan par un lien » donne « Share a map via a link » (« plan » mal compris : la relecture avant publication est utile).
  Parcours en ligne (2026-10-26), l'utilisateur connecté lui-même dans le navigateur intégré (mot de passe jamais vu) : remarque n° 10 envoyée du site en anglais ; l'utilisateur l'a répondue, rangée dans un sujet créé depuis elle, traduit par DeepL, publié (« Prévu »), et a voté ▲ ; il a aussi supprimé les remarques d'essai de S34-S35 (n° 2 à 9, 10 et 11 d'avant). Côté joueur : Propositions montre le sujet (score 2, « 2 joueurs l'ont demandé »), le vote du navigateur intégré est refusé (« déjà donné depuis cette connexion » : même connexion que celui de l'utilisateur, protection attendue), « Mes remarques » montre la réponse et « Supprimée par l'auteur ».
  Vu pendant le parcours : un n° supprimé est redonné à la remarque suivante (SQLite sans AUTOINCREMENT : deux « n° 10 » dans « Mes remarques », et un lien Discord `/tableau/#10` ancien ouvrirait l'autre) ; « 1 remarques » sans accord du pluriel sur Propositions. Corrigés avec accord (`afb15fb`, 566 tests) : le dernier numéro donné est gardé dans `reglages` (`prochainNumero`, remarques et sujets), « 1 remarque » / « 1 request » ; service mis à jour et redémarré, site redéployé, MyPrism identique. Le prochain numéro de remarque sera 11 (l'ancien n° 11, supprimé avant la correction, n'était pas gardé).
- **2026-10-26, S37** (566 tests, déployé, `853e155`) : répétition générale en anglais sur le site en ligne, partie vide (stockage effacé, langue EN), au clavier et à 375 px. Relecture de tout l'anglais : 10 pages et la visite entière lues, aucun mot français ni identifiant visible ; anglais clair. Parcours A (visite jouée en entier, puis partie vide), B (Crankshaft tapé au clavier → « can't be made yet », « Done, I unlocked them » → 3 996 cases · 158 machines · 609,2 kMF/s · 426 k$, comme en S27), C (Foundry : chemin et « 276,350 RP »), D (module Craft Assembler : ordre de pose, pièces à acheter), E (⚠ Oak Log → « fix ▸ » → fiche « ✎ Fix » en anglais). Remarque n° 11 (idée, en anglais, pseudo « S37-test ») envoyée du site en ligne : reçue, Échap ferme la fenêtre et le focus revient au bouton 💬. Propositions au téléphone : sujet publié, traduit, votes ; aucune page ne déborde à 375 px.
  Corrigé : après la visite, l'usine de l'exemple (13 modules, Advanced Assembler) restait affichée sous un plan impossible jusqu'au rechargement (`renderPose` vide désormais la liste des modules, la barre et les options) ; « ; » à la française dans les listes en anglais (`semi()` dans `format.ts`, 7 vues) ; ordre de pose « Place 3 × MV Pole », « Place the 15 × Craft Assembler » (noms du jeu sans pluriel).
  À surveiller (peut attendre) : la suite du tour de la n° 11 dans le tableau de bord (sujet, réponse, publication) demande ton mot de passe, déjà faite par toi en S36 avec la n° 10 ; le message Discord de la n° 11 est à voir dans le salon ; « prerequisite(s) », « record(s) » : pluriels en « (s) », comme en français ; « (“é” on AZERTY) » reste en anglais ; à la fin de la visite le focus retombe sur la page ; l'ordre de pose montre Build 1, Pipe 3, Wire 2 (ordre de S26) ; bundle principal > 1 000 ko. Verdict : prêt pour le Discord dès ta relecture de l'anglais.
- **2026-10-26, S17** (sans code du site, non déployé) : Q14 posée en 10 points et répondue (décision S17 Bac à sable, § 5) ; [PLAN-BAC-A-SABLE.md](PLAN-BAC-A-SABLE.md) : décisions, modèle Mindustry (ce qu'on garde, ce qui ne s'applique pas), gestes ordinateur et téléphone, calcul d'un montage libre (réseaux, recettes déduites, point fixe des débits, bilan, liaisons fausses, fluidité : < 16 ms par geste à 200 machines), ponts, lots **B1 à B7** avec leurs critères de fin, risques ; maquette cliquable `maquette/bac-a-sable.html` (vraies machines tirées des fichiers du jeu par `bac-a-sable.gen.mjs`) : ☰ par chapitre et catégorie, pose, R, déplacer, tuyaux tracés au glisser, gomme, Ctrl+Z, recette déduite ou « ? », tuyau saturé hachuré, statistiques, lien mesuré ; doutes BAS-01 à BAS-03 dans `data/a-verifier.md`.
  Contrôlé (serveur `calculateur`, port 5173) : exemple Press (Iron Ingot) → Roller : le Roller déduit sa recette seul, 30 Iron Coil/min en sortie, 15 Iron Ingot/min à fournir, 2 750 MF/s, aucune erreur en console.
  À surveiller : seules 31 machines sont posables (ports et recettes connus) ; maquette en attente de validation par l'utilisateur ; aucun lot B lancé.
- **2026-10-26, S17 (2e tour)** (sans code du site, non déployé) : 1re maquette refusée (« ça ne va pas du tout », s'inspirer à 100 % de Mindustry ; décision S17 Mindustry, § 5). Lecture du code source de Mindustry (Binding, DesktopInput, MobileInput, InputHandler, Placement, PlacementFragment, Conveyor) et de la page wiki Building System. Maquette refaite : menu de pose de Mindustry (cadre d'infos au survol, gardé au clic, **?** = fiche ; grille, catégories, tiers à droite ; schémas, base de données, arbre, liaisons sous la grille) ; bâtiments non relevés grisés avec « Compléter » ; pose en ligne sans diagonale ; tuyaux par famille, variantes, longueurs automatiques, virages, té et croisements non rusty posés seuls, pièce posée sur un tuyau qui le recoupe ; zone supprimée au clic droit glissé ; touches physiques (ZQSD en AZERTY), molette qui tourne, pipette, F/Z/X/T, F6, C, J, chiffres, flèches ; téléphone (appui long, 🔨 ⬚ ⟳ ✕) ; calcul par flot maximal avec limite par pièce. [PLAN-BAC-A-SABLE.md](PLAN-BAC-A-SABLE.md) réécrit (commandes, règles des tuyaux, lots **B1 à B8**). Réponses BAS-01 (en partie) et BAS-02 notées ; BAS-03 à BAS-06 ouverts. Parcours des sites signalés par l'utilisateur : industrialist-calculator.pages.dev et son dépôt (MIT, planificateur en graphe) ; idées retenues au § 6 du plan, leurs données servent de contrôle et ne sont pas une source.
  Contrôlé (navigateur intégré, port 5173, 1 366 × 768) : exemple 1, Press → Roller, 30 Iron Coil/min ; exemple 2, 5 Roller à 80 % et le tuyau de tier I saturé (7,5/s pour 6/s) hachuré ; exemple 3, 20 cases de tier III en 5 Long Pipe2, croisement objet × fluide posé seul, Long Pipe2 coupé en Pipe2 + Short Pipe2. Aucune erreur sur la page.
  À surveiller : 55 bâtiments sur 220 et 32 pièces de tuyau sur 43 sont posables ; la maquette n'a pas été essayée à la souris par moi au-delà des exemples (glisser, zone, F) ; maquette en attente de validation.
- **2026-10-26, S17 (3e tour)** (sans code du site, non déployé) : réponses de l'utilisateur. Captures du menu Build (tiers I à IV, non exhaustives) → catégories du jeu dans la maquette : Pipes, Logic, Power, Decorations, Factories, Modular, Misc, Extractors, Tanks (BAS-01). Fluid Pipe2 = 2 cases → `data/ports.json` corrigé (BAS-04). Partage d'une jonction = la règle déjà donnée (BAS-05). BAS-03 : les infobulles des ports → la maquette s'en sert, et l'éditeur devra les structurer (R16, S38). Industrialist Calculator devient la 2e source (§ 0, règle 3). Bugs de la maquette corrigés : clignotement au survol (le cadre d'infos élargissait le menu), lien « Compléter » vers `#contribuer/batiments/<id>` ou message quand la pièce n'est pas dans l'éditeur (R17). Nouveaux retours R16 à R18, lots S38 à S40. La comparaison avec Pollywrath (`b37d7de`) est sur la branche `claude/inspiring-dubinsky-44c62c`, pas dans `main`.
  Contrôlé (1 366 × 768) : survol de chaque bouton de la grille dans chaque tier et chaque catégorie, largeur du menu et position du bouton inchangées ; mêmes chiffres sur les trois exemples ; infobulle « Input for Crude Oil/heavy Oil/… » affichée dans la fiche de l'Advanced Oil Separator.
- **2026-10-27, S41 (1er pas : icônes)** (569 tests, déployé) : inventaire de chaque émoji servant d'icône (≈ 60 symboles ; la typographie × → − ≥ ≈ √ … reste du texte) ; maquette `maquette/icones.html` validée le 2026-10-26 (jeu Lucide ISC recopié sans paquet npm, correspondance complète, 👍 de la visite retiré, chevron après le mot). `src/ui/icons.ts` (notice ISC, 52 icônes, `icon()`, `iconAt()` pour les dessins, `withIcons()` / `noIcons()`) ; dans les catalogues FR et EN, chaque émoji devient un jeton `{i:nom}` dessiné en SVG dans le HTML et retiré des attributs ; `data-ic` dans `index.html` (icône remise à chaque traduction) ; ports de l'éditeur, ⚠ du schéma, tableau de l'auteur et maquette du bac à sable (Pipes : la goutte des liquides de Mindustry) passés aux icônes ; ⚠ garde la couleur d'alerte ; nouveau `icons.test.ts` (chaque jeton existe, plus d'émoji dans les catalogues).
  Contrôlé (serveur `calculateur`) : 8 pages en FR et en EN, panneau d'un bloc du schéma et usine entière ouverts : aucun jeton ni émoji visible, aucun dans un attribut ; 1 366 px en sombre et 375 px en clair : pas de défilement horizontal, icônes de 13 à 21 px ; éditeur de bâtiments (ports) et bac à sable sans erreur en console. Deux défauts vus et corrigés : une règle `.rc-arrow svg` grossissait la marque « corrigée » à 72 px, et les icônes dans les dessins prenaient la taille du texte (`iconAt` fixe la sienne).
  Restent en caractères, en attendant S44 (R23, menu déroulant maison) : ★ de l'option conseillée et ⚠ dans les listes de recettes ; ▲ des reconnexions du graphique des RP (le même triangle que la légende). Nouveaux retours : R23 (S44) et R24 (S45, visite principale puis une visite par usage) ; numéros pris après R20 à R22 et S42, S43, ajoutés en parallèle par la session S17.
- **2026-10-27, S42** (571 tests, poussé ; `npm run deploy` refusé par le contrôle automatique, à lancer par l'utilisateur) : mesuré en ligne (ordinateur) : chargement 0,17 s (cache), 1er calcul ≈ 50 ms, onglets 1 à 18 ms ; le lent est « Toute l'usine » : Crankshaft 2,7 s, Electric Motor 6 à 8 min (73 000 recherches de tuyau). Placement des modules accéléré sans changer un plan (`factory-s42.test.ts`, empreintes de 3 usines) ; décision de l'utilisateur : limite de 20 s (`budgetMs`) sur les essais facultatifs, plan « abrégé » signalé avec un bouton « Continuer le calcul » (calcul complet). Electric Motor : 34 s au lieu de 6 à 8 min.
  À surveiller : le plan abrégé d'Electric Motor est bien moins bon (1 145 × 73, 6 liaisons sans tuyau) ; un seul essai de placement peut déjà dépasser 20 s ; téléphone non mesuré (volet du navigateur caché, mesures faussées) ; pas de parcours au navigateur après la correction (quota) ; bundle principal toujours 1 580 ko.
- **2026-10-27, S40** (plan, sans code, non déployé) : questions posées, réponses au § 5. Pollywrath compte bien les items des stations. Refonte de la recherche découpée en S46 à S51 (§ 3, « S40 ») : masquer, maquette, moteur, interface, pollution et mois, difficulté.

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
- **2026-10-27, S38** : bulle de port de l'éditeur : bloc « Ce qui passe ici » (maquette `maquette/ports-objets.html`, validée ; l'utilisateur précise que ce n'est pas le style voulu, à reprendre plus tard avec le reste du site). Cases parmi les objets ou fluides des recettes de la machine, selon le sens ; infobulle relevée reprise (noms reconnus cochés d'avance, noms inconnus en orange) ; champ `items` du port, donc enregistré, exporté et importé. Tests `portCandidates` et `tipSuggest`.
- **2026-10-27, S46** (code, déployé) : recherche masquée par le drapeau `RECHERCHE_EN_REFONTE` (`src/ui/flags.ts`, mettre `false` pour la remontrer) : onglet « Ma recherche » et objectif « Des RP » affichent « Recherche en refonte » (FR/EN, clé `rs.refonte`), puce RP de l en-tête et RP de l arbre masqués.
- Données du joueur (relevés, journal S21, export) non touchées ; 571 tests verts sans adaptation ; capture faite dans le navigateur.
- Suite : S47 (maquette) sur feu vert ; S48 et S49 retirent le drapeau.
- **2026-10-27, S47** : maquette `maquette/recherche-refonte.html` (saisie par tier, contrôle de la recopie du panneau, réglages de partie avec sources). Chiffres des cases = exemples. 3 questions à valider en bas de la maquette ; non déployée.
- **2026-10-27, S47 validée** : l utilisateur approuve la maquette `recherche-refonte.html` telle quelle (« c est bon pour moi ») ; les 3 questions prennent donc les choix proposés : groupe = nombre + items communs, contrôle sous la saisie, réglages de partie dans « Ma recherche ». S48 peut démarrer sur feu vert.
