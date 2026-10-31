# Plan d'action â retours du 2026-10-16

Ce fichier pilote les prochaines sessions. **Une session = un lot**, dans l'ordre du Â§ 2. Chaque lot
dit ce qui existe dÃ©jÃ  (vÃ©rifiÃ© dans le code le 2026-10-16), ce qu'il faut faire, les questions Ã 
poser avant de coder et comment savoir que c'est fini.

Point de dÃ©part : commit `6c1e7fd` (branche main), 242 tests. Plans prÃ©cÃ©dents : [PLAN.md](PLAN.md)
(Ã©tapes a â e), [PLAN-EXTENSION.md](PLAN-EXTENSION.md) (E0 â E6, bilans de E4), [REFONTE.md](REFONTE.md)
(ergonomie).

## 0. RÃ¨gles de chaque session (contre les hallucinations)

1. **Lire d'abord** ce fichier : Â§ 0, Â§ 5 (dÃ©cisions) et le lot du jour. Lire ensuite seulement les
   fichiers que cite le lot. Ne pas se fier Ã  la mÃ©moire ni aux rÃ©sumÃ©s : vÃ©rifier avec `git log -5`
   et `npm test` que le point de dÃ©part est bien celui du dernier bilan (Â§ 6).
2. **Les questions avant le code.** Poser les questions du lot qui n'ont pas encore de rÃ©ponse au
   Â§ 5, et noter les rÃ©ponses au Â§ 5 avant de commencer. Si l'interface change beaucoup, faire
   valider une maquette d'abord.
3. **Aucune valeur de jeu inventÃ©e.** Chaque valeur vient, dans cet ordre, du wiki Miraheze, puis
   d'Industrialist Calculator (donnÃ©es du dÃ©pÃ´t `Pollywrath/Industrialist-Production-Calculator`,
   licence MIT ; dÃ©cision de l'utilisateur du 2026-10-26), puis de Fandom en contrÃ´le, ou d'un relevÃ©
   en jeu de l'utilisateur, avec sa source. Les doutes vont dans
   `data/a-verifier.md`. Une rÃ¨gle de jeu mal comprise se demande, elle ne se suppose pas.
4. **Pas de nouvelle dÃ©pendance** sans accord. Sont autorisÃ©s : vite, typescript, vitest et
   @types/node.
5. **Ne jamais dÃ©grader un critÃ¨re dÃ©jÃ  validÃ©** (taille des plans, longueur des tuyaux, prixâ¦)
   sans le dire et le proposer en option.
6. **Fin de session**, dans l'ordre :
   - `npm test` ;
   - parcours rÃ©el du site dans le navigateur, avec des captures ;
   - rÃ©sumÃ© court en franÃ§ais ;
   - commit, terminÃ© par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ;
   - `npm run deploy` ;
   - `git push origin HEAD:main` ;
   - lot cochÃ© au Â§ 2 et bilan de 3 lignes au Â§ 6 ;
   - mÃ©moire `prochaine-session` mise Ã  jour.

   Puis **attendre le feu vert**.
7. **Contexte.** Si la session approche de sa limite, s'arrÃªter Ã  un point propre (tests verts,
   commit), puis noter au Â§ 6 oÃ¹ en est le lot et ce qui reste. Ne pas enchaÃ®ner un deuxiÃ¨me lot.
8. Tout plan affichÃ© reste prÃ©sentÃ© comme une **proposition** : une base de dÃ©part, Ã  optimiser
   librement.

## 1. Les retours et leur lot

| # | Retour (2026-10-16, rÃ©sumÃ©) | Ce que j'en comprends | Lot |
| --- | --- | --- | --- |
| R1 | Le glitch des tuyaux ne marche pas en sortie. On peut entrer par n'importe quel port du mÃªme type (mÃªme un port de sortie), mais une sortie doit partir de la bonne sortie. | DÃ©jÃ  corrigÃ© le 2026-10-14 (commit `6c1e7fd`, `portAssignments`). Il reste un test qui le garantisse et une vÃ©rification sur l'usine entiÃ¨re. | S1 |
| R2 | Afficher les tuyaux, d'accord, mais mettre en Ã©vidence une option Â« Afficher les liaisons Â» qui montre comment les tuyaux sont liÃ©s. | Une case bien visible qui dessine les vecteurs de liaison entre piÃ¨ces (qui est reliÃ© Ã  qui, dans quel sens), comme l'onglet 3 en jeu. Dans l'usine et dans un module. | S4 |
| R3 | Au survol, le module s'Ã©claire avec quelques infos. Il faut pouvoir cliquer pour faire un focus, c'est-Ã -dire ouvrir l'interface du module, mise Ã  jour dans le plan. | Un clic sur un module de l'usine ouvre sa vue de module, dans la version que l'usine utilise (recalculÃ©e, tournÃ©e), avec un retour vers l'usine. | S4 |
| R4 | RÃ©gler dans le schÃ©ma le nombre de machines voulu et voir la production qui en rÃ©sulte. | On saisit un nombre de machines sur un bloc du schÃ©ma. Le calcul donne la production possible, l'Ã©tape qui limite et l'utilisation des autres. | S8 |
| R5 | RÃ©gler le calcul pour exclure certaines machines, ou pour n'utiliser que celles qu'on sÃ©lectionne. | Un filtre de machines dans le calcul, en mode Â« exclure Â» ou Â« seulement Â». | S9 |
| R6 | Des ports prennent une case en sortie au lieu de 0, alors qu'ils font partie de la machine. | Les 66 ports de bord relevÃ©s ont un plot d'une case qui dÃ©passe du bÃ¢timent (valeur par dÃ©faut de l'Ã©diteur), donc le tuyau commence une case trop loin. Il faut passer ce plot Ã  0. | S1 |
| R7 | Certaines machines ont des interfaces : il faut pouvoir les noter dans l'Ã©dition **et les prendre en compte dans les calculs**. | Une Ã©tiquette flottante Â« [E] Interact Â» qui ouvre un rÃ©glage de la machine (fenÃªtre, levierâ¦). Rien pour le placement : seulement la configuration, et son effet sur le calcul (Q5). | S10 |
| R8 | Machines modulaires, Ã  voir sur le wiki : il faut indiquer les blocs qui entourent chaque bloc. Exemples : Diesel Engine (Tier II), assemblage par contact ; ferme d'arbres (Tier I), assemblage par portÃ©es. | Deux familles. Par contact : moteur diesel, turbine modulaire (Tier IV). Par portÃ©e : ferme d'arbres. Il faut une recherche sur le wiki, des donnÃ©es, un Ã©diteur, le calcul et le plan de pose. | S11 â S14 |
| R9 | DÃ©tailler le calcul dans la prÃ©sentation du graphe, pour qu'on sache d'oÃ¹ sortent les valeurs. | Pour un bloc ou une flÃ¨che du schÃ©ma : la recette, les formules et la source de chaque valeur. | S7 |
| R10 | Naviguer dans les crafts comme dans l'onglet Â« Recipes Â» du jeu, et corriger ce qui existe ou non. Depuis le graphe : la rÃ©fÃ©rence du craft, cliquable. | Une page Â« Recettes Â» : liste avec recherche, fiche objet, fiche machine, crafts cliquables. Des corrections : valeurs, craft inexistant, craft manquant. Un lien depuis le schÃ©ma. | S5, S6, S7 |
| R11 | (2026-10-18) Une option pour passer le site en anglais, et un site parfaitement accessible et ergonomique (Â« un peu barbare Â» aujourd'hui), pour le montrer au serveur Discord de la communautÃ© sans avoir honte d'un rÃ©sultat brouillon, incomplet ou plein d'erreurs. | Deux chantiers liÃ©s : la traduction (tout le texte, les nombres, les dates) et une remise Ã  niveau de la forme (clartÃ©, cohÃ©rence, finition, accessibilitÃ© au sens large). Le lot Ã©crit le plan, il ne l'exÃ©cute pas. | S16 (plan), S30 Ã  S33, S37 |
| R12 | (2026-10-18, premier jet) Construire sa propre chaÃ®ne de production pour en voir les statistiques : un plan vierge, des menus Â« burger Â» pour ouvrir une liste de machines, des liaisons qu'on trace en maintenant le clic et en glissant avec l'outil tuyau (du bon type, fluide ou objet), comme les convoyeurs de Mindustry. | Un mode Â« bac Ã  sable Â», l'inverse du calculateur : on pose, le site calcule. TrÃ¨s gros : le lot Ã©crit le plan et la maquette, il ne l'exÃ©cute pas. | S17 (aprÃ¨s S37) |
| R13 | (2026-10-18) Le gain de RP baisse quand les RP accumulÃ©s augmentent, et la baisse se calcule avec ce qu'on lit en jeu (Research Tracking Panel : seuil d'efficacitÃ©, Â« Max RP before RP/s is nearly zero Â»â¦). Que manque-t-il au site ? | Recherche faite le 2026-10-18 (sans code) : les formules du wiki retrouvent la capture au centiÃ¨me prÃ¨s. Le site connaÃ®t le plafond souple pour l'installation qu'il propose, mais compte les RP du joueur en ligne droite et ignore ses stations. | S20 |
| R14 | (2026-10-20, aprÃ¨s S20) Un graphe de l'Ã©volution des RP du joueur, avec l'historique et les modifications qu'il y a apportÃ©es au fil du temps (changement de configurationâ¦). Deux courbes : les RP et les RP/s. | Le moteur sait refaire la courbe entre deux instants (S20), mais le site ne garde que le dernier relevÃ© et la derniÃ¨re configuration. Il faut un journal (relevÃ©s, changements de configuration, dÃ©penses) et deux graphiques dans Â« Ma recherche Â». ComplÃ©ment : les RP ne montent que quand on est en jeu ; le temps compte en durÃ©es de jeu, avec un interrupteur Â« Je joue / Je ne joue plus Â». | S21 |
| R15 | (2026-10-20, pendant S15) Â« dans la refonte du site je veux pouvoir mettre en place un systÃ¨me de remarque collaborative automatiser que je recevrais dans une interface pour rÃ©pondre et publier les demandes qui reviennent le plus souvent (pas nÃ©cessairement publier mais au moins avoir une vision sur les propositions) Â». | Un bouton Â« Remarque Â» sur le site ; les remarques arrivent dans une page rÃ©servÃ©e Ã  l'utilisateur, regroupÃ©es par sujet, avec une rÃ©ponse et, au choix, une publication. Il faut un petit service cÃ´tÃ© serveur (le site est aujourd'hui statique sur le Pi) : Ã  planifier, pas Ã  coder en S15. | S16 (plan), S34 Ã  S36 |
| R16 | (2026-10-26, pendant S17) Â« C'EST LES TIPS QUI INDIQUENT LES INFOS DE CHAQUE PORT [â¦] revoir la faÃ§on dont on rentre la propriÃ©tÃ© d'un port dans l'Ã©diteur [â¦] en sÃ©lectionnant par exemple sur un port les items ou fluides qui peuvent sortir ou entrer en fonction des crafts dÃ©clarÃ©s de la machine. Â» | Les infobulles relevÃ©es (`tip`, 135 ports) disent dÃ©jÃ  ce qui passe par chaque port, mais en texte libre (Â« Input for Crude Oil/heavy Oil/â¦ Â»). L'Ã©diteur doit proposer, port par port, de cocher les objets et fluides des recettes de la machine, et les enregistrer (champ structurÃ©), pour que le calcul s'en serve sans IA. Le bac Ã  sable en dÃ©pend (BAS-03). | S38 |
| R17 | (2026-10-26, pendant S17) Â« revoir le systÃ¨me de liaison pour cibler correctement les Ã©lÃ©ments d'une page avec un lien [â¦] qui ne redirige pas vraiment vers l'Ã©dition du bÃ¢timent mais vers la page d'Ã©dition Â». | Un lien vers un Ã©lÃ©ment doit l'ouvrir et l'amener Ã  l'Ã©cran (bÃ¢timent, recette, valeur). Cause trouvÃ©e : 6 piÃ¨ces de tuyau (Pipe Fluid Turn2, Junction2, Section2, Item / Fluid Rate Meter, Pipe Valve) sont dans `logistics.json` mais pas dans `machines.json`, donc absentes de l'Ã©diteur : `#contribuer/batiments/<id>` ouvre la page sans rien choisir. | S39 |
| R18 | (2026-10-26, pendant S17) Industrialist Calculator est Â« nettement plus au point sur le systÃ¨me de recherche, car le mien est complÃ¨tement cassÃ©, je devrais mÃªme pas le laisser disponible Â» ; mois courant, pollution globale et Â« Satellite buff Â» : Â« c'est sur le wiki, ce sont de vraies infos Ã  prendre en compte Â». | Refaire la recherche (RP, seuils, stations, satellite) en prenant Industrialist Calculator comme deuxiÃ¨me source, avec les mÃ©caniques du wiki. Plan et maquette d'abord. Question Ã  poser : masquer la recherche actuelle en attendant ? | S40 (plan) |
| R19 | (2026-10-26, pendant S17) Â« j'apprÃ©cie la patte graphique [â¦] du site que je t'ai envoyÃ©, veut-on qu'on s'en inspire (sans forcÃ©ment faire quelque chose d'identique) pour refaire celle du site ? [â¦] il paraÃ®t aussi fade, peu clair, difficilement utilisable, et pas original Â». | Une identitÃ© visuelle propre au site, inspirÃ©e d'Industrialist Calculator (fond charbon, accent or, panneaux Ã  filet dorÃ©, titres en petites capitales espacÃ©es, barre d'outils flottante avec icÃ´ne et libellÃ©, tableau de bord en lignes libellÃ© / valeur, fenÃªtres Ã  en-tÃªte dorÃ©) sans le copier. Plan et maquette d'abord, page par page. Le bac Ã  sable la reprend. | S41 (plan + maquette) |
| R23 | (2026-10-26, validation de la maquette des icÃ´nes) Â« dev un systÃ¨me de menu dÃ©roulant pour permettre d'insÃ©rer des image et de le mettre comme nous on veut et pas comme le navigateur le veut [â¦] le plus important c'est de donner les mÃªmes possibilitÃ© et incrustation qu'un navigateur Â». | Un menu dÃ©roulant maison qui remplace les `<select>` : images et icÃ´nes dans les options, mÃªme clavier, mÃªme lecture d'Ã©cran et mÃªme envoi de formulaire qu'un `<select>`, sobre en calcul ; il ouvrira des modes de sÃ©lection plus riches. En attendant, le â de l'option conseillÃ©e et le â  des recettes Ã  vÃ©rifier restent des caractÃ¨res dans les listes. | S44 |
| R24 | (2026-10-26, mÃªme message) la visite Â« doit avoir un rebranding car il manque des trucs important, pourquoi pas faire une visite principal qui est bien, et quand l'utilisateur va sur un autre usage on lui propose la visite de cet usage Â». | Une visite principale courte, puis une petite visite proposÃ©e Ã  la premiÃ¨re entrÃ©e dans chaque usage (Recettes, Arbre, Ma recherche, Contribuerâ¦), au lieu d'une seule visite Ã  rallonge. | S45 (plus tard) |
| R26 | (2026-10-31, avec deux captures du jeu) « la manipulation des flux se fait en jeu grâce à des “boutons” présents sur les machines, lorsqu’on affiche ces flux, ce sont ces boutons qui sont reliés entre eux, j’aimerais que ça soit la même chose avec l’éditeur » ; « la garanti que lors de la connexion automatique, les flux soit bien reliers aux bon ports ». | Boutons de port et flèches entre boutons dans le bac à sable ; tests du raccord automatique. | S57 |
| R25 | (2026-10-31) Â« que l'interface des schÃ©matique lui corresponde vraiment Â» (Mindustry) ; un format de fichier existant, pas un format maison, Â« pour une question homogÃ©nÃ©itÃ© Â» ; Â« un import export valide Ã  travers tout le site Â» ; refonte de la gÃ©nÃ©ration des designs Â« car ceux ci ne prenaient pas en compte les connexions indirecte Â». | FenÃªtre des schÃ©mas copiÃ©e de `SchematicsDialog` ; format `.msch` de Mindustry (en-tÃªte `msch`, version, contenu zlib, chaÃ®ne base64 pour le presse-papiers) ; un seul module import / export pour l'Usine, le bac Ã  sable et les liens ; gÃ©nÃ©rateur refait. | S53 Ã  S56 |
| R20 | (2026-10-26, Discord, aprÃ¨s la publication) Â« The only downside is the lag Â» (Romik, 9/10). | Mesurer les temps de calcul sur une partie neuve, en ligne, au tÃ©lÃ©phone et sur ordinateur, puis traiter ce qui est le plus lent. | S42 |
| R21 | (2026-10-26, Discord) Â« It recommended me hardened casing without even me having a chem reactor unlocked Â» (Ariral). | Bogue probable : une recette d'une machine non dÃ©bloquÃ©e est proposÃ©e. Ã reproduire sur une partie neuve, puis Ã  corriger et tester. | S43 |
| R22 | (2026-10-26, Discord) Â« the full automation of the process is kinda bland to me, with the current site that we have available you can assemble the sheet yourself however you want Â» ; Â« poly does this now Â». | Ce que les joueurs attendent, c'est de construire eux-mÃªmes : le bac Ã  sable (S17, lots B1 Ã  B9) y rÃ©pond. Le placer avant les lots de confort. | ordre du Â§ 2 |
| â | En attente depuis le 2026-10-14 : (1) la sortie du collecteur central d'une double rangÃ©e entre deux machines ; (2) Â« Toute l'usine Â» dans le site. | InchangÃ©. | S2, S3, S4 |

## 2. Ordre proposÃ© (Ã  valider : Q10)

| Session | Lot | Taille | DÃ©pend de | Ãtat |
| --- | --- | --- | --- | --- |
| S1 | Plots des ports supprimÃ©s ; 6 relevÃ©s intÃ©grÃ©s ; test de la rÃ¨gle des sorties | petite | â | â fait (`d949b25`) |
| S2 | Double rangÃ©e : sortie du collecteur central entre deux machines | moyenne | â | â fait (`accb04b`) |
| S3 | Toute l'usine (1/2) : moteur dans `src/engine/build/`, calcul en arriÃ¨re-plan, premiÃ¨re vue | grosse | S2 | â fait (`1919f4e`) |
| S4 | Toute l'usine (2/2) : options, Â« Afficher les liaisons Â», survol + clic â panneau du module | moyenne | S3 | â fait (`6502c62`) |
| S5 | Recettes (1/2) : navigation comme en jeu, en lecture | grosse | â | â fait (`731c9e0`) |
| S6 | Recettes (2/2) : corrections (valeurs, craft inexistant, craft manquant), export | moyenne | S5 | â fait (`17a59bd`) |
| S7 | SchÃ©ma : dÃ©tail du calcul et rÃ©fÃ©rence du craft cliquable | moyenne | S5 | â fait (`1a7200b`) |
| S8 | SchÃ©ma : nombre de machines rÃ©glable â production obtenue | moyenne | â | â fait (voir Â§ 6) |
| S9 | Calcul : exclure des machines, ou seulement certaines | petite Ã  moyenne | â | â fait (voir Â§ 6) |
| S10 | Interfaces des machines : recherche, relevÃ©, effet sur le calcul | moyenne | recherche | â fait (voir Â§ 6) |
| S11 | Modulaires (1/4) : recherche (wiki, Internet), donnÃ©es, mÃ©thode de relevÃ© | moyenne, sans interface | â | â fait (voir Â§ 6) |
| S12 | Modulaires (2/4) : Ã©diteur des blocs (voisins par face, portÃ©es) | grosse | S11 | â fait (voir Â§ 6) |
| S13 | Modulaires (3/4) : calcul (puissance du moteur, bois de la ferme) | grosse | S12 + relevÃ©s | â fait (voir Â§ 6) |
| S14 | Modulaires (4/4) : plans de pose des ensembles | grosse | S13 | â fait (voir Â§ 6) |
| S18 | Moteur diesel : relevÃ©s de configuration, consommation selon le carburant, rÃ©glages du contrÃ´leur | moyenne | S14 | â fait |
| S19 | Ãditeur de bÃ¢timents simplifiÃ© : ports dans la grille, une case par face, moins de bruit | moyenne | S14, maquette | â fait |
| S20 | Recherche : vitesse rÃ©elle des RP (plafond souple) et Ã©tat de mes stations dans Â« Mon usine Â» | moyenne | relevÃ©s RP-01 Ã  RP-08 (pendant : Q17) | â fait |
| S21 | Recherche : historique des RP, deux graphiques (RP et RP/s) avec les changements de configuration et les dÃ©penses | moyenne | S20, maquette | â fait |
| S15 | Revue d'ensemble de l'interface avec l'utilisateur, comme un joueur | moyenne | S1 Ã  S14, S18 Ã  S21 | â fait |
| S22 | Recherche : la durÃ©e Â« Ã  ton rythme Â» dans l'arbre ; Â« Des RP Â» vide, Â« dÃ©bloquer Â» d'abord | petite | S15 | â fait |
| S23 | Planifier vide, nouveau menu, prioritÃ©s du joueur, en-tÃªte sur une ligne | moyenne | S15 | â fait |
| S24 | FenÃªtre d'orientation Ã  la premiÃ¨re visite | petite Ã  moyenne, maquette | S23 | â fait |
| S25 | L'Usine au premier plan : onglet, module par module, cadrage, Â« module posÃ© â Â» | moyenne | S23 | â fait |
| S26 | Un module : ordre de pose dans le sens de l'usine et dans l'ordre du joueur | moyenne | S25 | â fait |
| S27 | Ã Ã©vacuer : un tuyau jusqu'au bord choisi pour chaque produit | moyenne | S25 + capture de l'utilisateur | â fait |
| S28 | SchÃ©ma et rÃ©glages visibles : vue complÃ¨te, barre Â« Ton plan Â», â  cliquables | moyenne | S23 | â fait |
| S29 | Mon usine en deux onglets, bulle de l'arbre, vocabulaire de joueur | moyenne | S23 | â fait |
| S16 | Plan (sans code) : site en anglais et remise Ã  niveau de l'ergonomie, pour la communautÃ© ; remarques des joueurs (R15) | moyenne, sans code | S15, S22 Ã  S29 | â fait ([PLAN-PUBLIC.md](PLAN-PUBLIC.md), maquette `maquette/public.html` validÃ©e) |
| S30 | Traduction (1/3) : glossaire, catalogue et `t()`, bouton FR / EN, nombres et dates ; squelette, en-tÃªte, menu, pied de page, Planifier | moyenne | maquette S16 | â fait |
| S31 | Traduction (2/3) : toutes les vues, visite comprise ; test Â« rien d'oubliÃ© Â» | grosse | S30 | â fait |
| S32 | Traduction (3/3) : messages du moteur en codes, notes des donnÃ©es ; empreintes de l'usine identiques | grosse | S31 | â fait |
| S33 | Forme publique : nom, mentions, pied de page, aperÃ§u Discord, contrastes, cibles, tÃ©lÃ©phone, clavier, lecteur d'Ã©cran, calcul long | moyenne | S30 | â fait |
| S34 | Remarques (1/3) : le service Node sur le Pi (sans dÃ©pendance), tests, mise en place aprÃ¨s accord | moyenne | maquette S16 (peut aller en parallÃ¨le de S31 Ã  S33) | â fait |
| S35 | Remarques (2/3) : cÃ´tÃ© joueur (bouton, fenÃªtre, Â« Envoyer ma correction Â», Â« Mes remarques Â», visite, Discord) | moyenne | S30, S34 | â fait |
| S36 | Remarques (3/3) : tableau de bord de l'utilisateur et page publique Propositions (votes â² / â¼) | moyenne Ã  grosse | S35 | â fait |
| S37 | RÃ©pÃ©tition gÃ©nÃ©rale : relecture de l'anglais, parcours A Ã  E en anglais, remarque de bout en bout ; feu vert pour le Discord | moyenne | S30 Ã  S36 | **fait** (2026-10-26, feu vert de l'utilisateur donnÃ© : il poste le lien) |
| S17 | Plan (sans code) : construire sa propre chaÃ®ne (bac Ã  sable) et voir ses statistiques | moyenne, sans code | S37 | **fait** (2026-10-26, [PLAN-BAC-A-SABLE.md](PLAN-BAC-A-SABLE.md), lots B1 Ã  B9 ; maquette faÃ§on Mindustry **validÃ©e** par l'utilisateur le 2026-10-31 : Â« Parfait, passons Ã  la suite Â») |
| S52 | Ãditeur de bÃ¢timents : relever la catÃ©gorie d'un bÃ¢timent (menu Build du jeu), la portÃ©e des cÃ¢bles logiques, et la largeur 2 des ports des grands tuyaux (retours du 2026-10-31, points 3 et 11) | petite | â | Ã  faire |
| S53 | SchÃ©mas comme Mindustry (R25) : fenÃªtre copiÃ©e de `SchematicsDialog` / `Schematics.java` (grille d'aperÃ§us, recherche, Ã©tiquettes, fiche avec coÃ»t, menu Importer : presse-papiers, fichier ; Exporter : copier, fichier, lien) ; maquette d'abord dans `maquette/bac-a-sable.html` | moyenne | B3 | **fait** (2026-10-31, maquette `maquette/bac-a-sable.html` validÃ©e) |
| S54 | Format de fichier (R25) : lire et Ã©crire `.msch` (en-tÃªte, version, zlib, largeur, hauteur, Ã©tiquettes, table des noms de bÃ¢timents, cases avec rotation et rÃ©glage) + chaÃ®ne base64 ; module pur et testÃ© `src/engine/schematic/`. Au dÃ©but du lot : vÃ©rifier si Industrialist ou Industrialist Calculator a dÃ©jÃ  un format de plan (wiki, dÃ©pÃ´t Pollywrath) et le prÃ©fÃ©rer s'il existe ; rappel : les noms sont ceux d'Industrialist, donc Mindustry lui-mÃªme n'ouvrira pas ces fichiers. Pas de dÃ©pendance : zlib via `CompressionStream("deflate")` du navigateur | moyenne | S53 | **fait** (2026-10-31) : `src/engine/schematic/msch.ts`, 4 tests ; aucun format de plan propre Ã  Industrialist trouvÃ©, donc `.msch` |
| S55 | Import / export uniforme (R25) : le mÃªme fichier partout (plans de l'Usine et des modules, bac Ã  sable, liens partagÃ©s) ; convertisseur plan du site â schÃ©ma et schÃ©ma â bac Ã  sable ; anciens liens toujours lus | moyenne | S54 | **fait** (2026-10-31) : `src/engine/schematic/convert.ts` (module et usine â montage), fenÃªtre des schÃ©mas du site dâaprÃ¨s la maquette S53, code, fichier et lien en .msch, anciens liens lus ; boutons Â« Exporter en fichier .msch Â» et Â« Ouvrir dans le bac Ã  sable Â» sur le plan dâun module et de lâusine ; 3 tests |
| S56 | GÃ©nÃ©ration des designs refaite (R25) : prendre en compte les connexions indirectes. Au dÃ©but du lot : retrouver la consigne d'origine dans les sessions S23 Ã  S27 et dans `feedback-regles-ports` (ne pas la redemander) ; le placement rÃ©utilise le moteur du bac Ã  sable (B1, B2) pour vÃ©rifier chaque plan ; maquette avant code | grande | S55 | Ã  faire |
| S57 | Bac à sable : flux d’un bouton à l’autre comme en jeu (R26) : un bouton de couleur par port sur chaque machine et pièce de tuyau, les flèches des flux et des liaisons partent et arrivent sur ces boutons (captures `maquette/img/releves/boutons-ports.png` et `flux-boutons.png`) ; une seule façon de dessiner les connexions au lieu des traits mêlés ; tests qui garantissent que le raccord automatique relie chaque flux au bon port (bonne ressource, bon type, sortie par son port de sortie, BAS-11) ; maquette d’abord | moyenne | S56 (maquette) | à faire |
| B1 | Bac Ã  sable, moteur du montage (`src/engine/sandbox/`, pur et testÃ©) : voir PLAN-BAC-A-SABLE.md Â§ 7 | grande | S17, S38 | **fait** (2026-10-31) |
| B2 | Bac Ã  sable, tracÃ© des tuyaux (`src/engine/sandbox/path.ts`, pur et testÃ©) : voir PLAN-BAC-A-SABLE.md Â§ 7 | moyenne | B1 | **fait** (2026-10-31) |
| B3 | Bac Ã  sable, l'Ã©cran (page #bac Â« Bac Ã  sable / Sandbox Â») : voir PLAN-BAC-A-SABLE.md Â§ 7 | grande | B2 | **fait** (2026-10-31, non dÃ©ployÃ©) |
| B4 | Bac Ã  sable, fluiditÃ© (calcul incrÃ©mental, aperÃ§u seul pendant un glisser, worker, vue compacte) : voir PLAN-BAC-A-SABLE.md Â§ 5 et Â§ 7 | moyenne | B3 | **fait** (2026-10-31, non dÃ©ployÃ©) |
| S38 | Ãditeur de bÃ¢timents : objets et fluides de chaque port, choisis parmi les recettes de la machine, enregistrÃ©s et exportÃ©s ; reprise des infobulles dÃ©jÃ  relevÃ©es (R16, BAS-03) | moyenne | S17 | **fait** |
| S39 | Liens qui ouvrent l'Ã©lÃ©ment visÃ© et l'amÃ¨nent Ã  l'Ã©cran ; les 6 piÃ¨ces de tuyau manquantes ajoutÃ©es Ã  l'Ã©diteur (R17) | petite | â | Ã  faire |
| S41 | Refonte graphique : charte inspirÃ©e d'Industrialist Calculator (couleurs, typographie, panneaux, barre d'outils, icÃ´nes), maquette de chaque page avant le code (R19) | grande | â | en cours : 1er pas fait, les Ã©mojis remplacÃ©s par des icÃ´nes Lucide (`maquette/icones.html`, `src/ui/icons.ts`) ; reste la charte |
| S42 | Lenteur signalÃ©e sur le Discord : mesurer (partie neuve, en ligne, tÃ©lÃ©phone et ordinateur), puis corriger le plus lent (R20) | moyenne | â | â fait (2026-10-27) |
| S43 | Recette d'une machine non dÃ©bloquÃ©e proposÃ©e (Hardened Plastic Casing sans Chemical Reactor) : reproduire, corriger, tester (R21) | petite | â | Ã  faire |
| S44 | Menu dÃ©roulant maison Ã  la place des `<select>` : images dans les options, clavier et lecteur d'Ã©cran comme le navigateur (R23) ; maquette d'abord | moyenne | â | Ã  faire |
| S45 | Visite refaite : une visite principale, puis une visite par usage proposÃ©e Ã  la premiÃ¨re entrÃ©e (R24) ; maquette d'abord | moyenne | â | Ã  faire (plus tard) |
| S40 | Plan (sans code) : refaire la recherche avec Industrialist Calculator comme source, mois, pollution globale, Satellite buff (R18) | moyenne, sans code | â | fait (2026-10-27) : lots S46 Ã  S51 ci-dessous |
| S46 | Recherche actuelle masquÃ©e (Â« en refonte Â») en attendant S48 | petite | â | fait (2026-10-27) : drapeau `RECHERCHE_EN_REFONTE` dans `src/ui/flags.ts` |
| S47 | Maquette de la nouvelle Â« Ma recherche Â» et des rÃ©glages de partie (pollution, mois, difficultÃ©) | moyenne, sans code | â | maquette `maquette/recherche-refonte.html` faite (2026-10-27), validÃ©e par l utilisateur (2026-10-27) |
| S48 | Moteur de recherche refait : stations par tier avec leurs items, RS4, Satellite buff (sources Miraheze puis Industrialist Calculator) | grande | â | fait (2026-10-31) : efficacitÃ© des paraboles sans arrondi, cas Industrialist Calculator testÃ©s |
| S49 | Â« Ma recherche Â» refaite d'aprÃ¨s la maquette ; objectif recherche branchÃ© sur le nouveau moteur ; recherche rÃ©affichÃ©e | grande | â | fait (2026-10-31), dÃ©ployÃ© ; reste le relevÃ© en jeu aprÃ¨s le seuil (< 2 %), Ã  faire par l'utilisateur |
| S50 | RÃ©glages de partie : pollution globale et mois courant appliquÃ©s aux recettes concernÃ©es | moyenne | â | Ã  faire |
| S51 | DifficultÃ© : recherches bloquÃ©es et machines rÃ©servÃ©es selon le niveau | petite | â | Ã  faire |

Pourquoi cet ordre :
- **S1 d'abord** : les plots changent la gÃ©omÃ©trie de tous les plans. Mieux vaut le faire avant de
  retoucher les plans (S2 Ã  S4), pour ne pas tout mesurer deux fois.
- **S2 Ã  S4** : c'est le travail en cours (Â« 1. puis 2. Â»), et la maquette v8 de l'usine est dÃ©jÃ 
  validÃ©e en principe.
- **S5 avant S7** : le lien Â« rÃ©fÃ©rence du craft Â» du schÃ©ma a besoin de la page Recettes.
- **S10** ne touche pas au placement (Q5) : elle reste Ã  sa place.
- **Modulaires en dernier** : c'est le lot le plus gros et le moins documentÃ©. La recherche (S11)
  peut Ãªtre avancÃ©e si tu le souhaites.
- **S20 avant S15** (rÃ©ponse Ã  Q17, 2026-10-19) : la revue d'ensemble verra la recherche finie.
- **S21 avant S15** (rÃ©ponse Ã  Q20, 2026-10-20) : l'historique des RP fait partie de la recherche.
- **S15 Ã  la fin** : l'utilisateur veut revoir l'interface dans son ensemble, pour qu'elle soit
  logique pour des joueurs (Â« t'es pas joueur et t'as pas la faÃ§on de rÃ©flÃ©chir de ceux-ci Â») :
  parcours guidÃ©s par lui, puis rÃ©organisation. D'ici lÃ , chaque lot garde l'interface simple et
  cohÃ©rente avec l'existant.
- **S22 Ã  S29 aprÃ¨s S15** (maquette validÃ©e le 2026-10-20) : la rÃ©organisation tirÃ©e des parcours.
  S22 d'abord : c'est le dÃ©faut le plus grave (une rÃ©ponse absurde affichÃ©e d'office) et le lot le
  plus court. S23 pose le cadre (menu, formulaires vides, prioritÃ©s) dont dÃ©pendent les suivants.
  S25 avant S26 et S27 : le panneau d'un module et la sortie des produits Ã  Ã©vacuer vivent dans
  l'Usine. S27 attend la capture de l'utilisateur (tuyaux sans destination). Le vocabulaire (S29)
  vient en dernier, quand les Ã©crans sont stables.
- **S16 aprÃ¨s S15 et S22 Ã  S29** : la revue de S15 donne la liste des dÃ©fauts vus par un joueur
  (REVUE.md) ; S16 en fait un plan complet (anglais + forme) pour une version prÃ©sentable au Discord,
  sur un site dÃ©jÃ  rÃ©organisÃ©, et y ajoute R15 (remarques des joueurs, Q24.12). Ce plan donnera ses
  propres lots, Ã  insÃ©rer ensuite au Â§ 2.
- **S30 Ã  S37 aprÃ¨s S16** (plan Ã©crit le 2026-10-24, [PLAN-PUBLIC.md](PLAN-PUBLIC.md) Â§ 6) : le socle de
  la traduction d'abord, pour que tout texte ajoutÃ© ensuite entre dans les deux catalogues ; le service
  des remarques (S34) ne touche que des fichiers nouveaux et peut avancer en parallÃ¨le ; le lien n'est
  postÃ© sur le Discord qu'aprÃ¨s S37 (tableau de bord et Propositions finis, dÃ©cision S16 Publication).
- **S17 en dernier** (aprÃ¨s S37) : c'est une nouvelle fonction, pas une correction. Elle rÃ©utilise beaucoup de
  choses (moteur de calcul, plans de pose, tuyaux, Ã©diteur de bÃ¢timents). Mieux vaut la penser sur
  un site dÃ©jÃ  propre et traduit, pour ne pas tout traduire deux fois.

## 3. Lots en dÃ©tail

### S1 â Plots des ports supprimÃ©s, 6 relevÃ©s intÃ©grÃ©s, rÃ¨gle des sorties garantie

Retours : R6, R1.

Ce qui existe (vÃ©rifiÃ© le 2026-10-16) :
- `data/ports.json` : 29 bÃ¢timents et 99 ports. 66 sont sur les bords (les autres sont des prises
  sur le dessus), et ces 66 ont tous `"stub": 1`, c'est-Ã -dire Â« nombre de cases dont le plot du
  port dÃ©passe du bÃ¢timent Â».
- Ãditeur de bÃ¢timents : le champ Â« Plot (cases hors du bÃ¢timent) Â» vaut 1 par dÃ©faut
  (`src/ui/buildings.ts` ; `src/ui/buildings-model.ts` : `stub: previous?.stub ?? 1`).
- `src/engine/build/geometry.ts`, `place()` : les cases du plot sont ajoutÃ©es au bÃ¢timent, et la
  case Ã  toucher se trouve aprÃ¨s le plot.
- `src/engine/build/module.ts` : `assumedEntry` crÃ©e des ports supposÃ©s avec `stub: 1`, et l'Ã©cart
  entre machines tient compte des plots (`stubOut`).
- RÃ¨gle des sorties : `portAssignments` (module.ts) ne redirige plus que les entrÃ©es (commit `6c1e7fd`).

Ã faire :
1. Q1 tranchÃ©e : **aucun port ne dÃ©passe, et le plot disparaÃ®t complÃ¨tement** (pas de champ gardÃ©
   pour une exception).
   - Retirer `stub` du type `Port` (`src/engine/extension-types.ts`), de l'Ã©diteur (champ Â« Plot Â»,
     chiffre dessinÃ©, `buildings-model.ts`), de `geometry.ts` (la case Ã  toucher est la case
     voisine du bÃ¢timent), de `module.ts` (`assumedEntry`, `stubOut`) et de `module-view.ts` (cases
     `stub` dessinÃ©es, styles `.mm rect.stub` et `.bld-stub`).
   - Retirer la clÃ© `stub` des 66 ports de `data/ports.json` ; un relevÃ© importÃ© qui l'a encore
     est acceptÃ© et la clÃ© est ignorÃ©e.
   - Mettre Ã  jour le `_lisezMoi` de `ports.json` et RELEVES.md.
   - **IntÃ©grer les 6 relevÃ©s du 2026-10-15** envoyÃ©s par l'utilisateur
     (`C:\Users\chris\Desktop\tÃ©lÃ©chargement\releves-batiments-2026-10-15.json` : Ingot Molder,
     Plastic Molding Machine, Research Tracking Panel, Steam Cracking Plant, Advanced Assembler,
     Industrial Plastic Molder), dans le style du fichier, en gardant leur `fetchedAt` et sans
     `stub`. Leurs notes (Â« levier permet de passer de bouteille Ã  caisse Â») servent Ã  S10.
2. Tests :
   - mettre Ã  jour `buildings.test.ts` (il attend `stub: 1`) et `build.test.ts` ;
   - ajouter un test : une sortie part toujours d'un port de sortie (ou Â« les deux Â»).
3. Mesures :
   - nouvelles mesures (15 Craft Assemblers, chaÃ®ne du Crankshaft), notÃ©es dans le bilan ;
   - maquette rÃ©gÃ©nÃ©rÃ©e (`npm run maquette`) et comparÃ©e Ã  la v8, d'aprÃ¨s
     `maquette/usine-resume.txt` : 87 Ã 96 cases, 1 246 cases de tuyau, 76 croisements.

Fini quand : dans un plan de pose, le tuyau touche le bÃ¢timent et aucune case de plot n'est
dessinÃ©e ; tous les tests passent ; les mesures sont notÃ©es.

### S2 â Double rangÃ©e : le collecteur central sort entre deux machines

Retour : en attente depuis le 2026-10-14. Dans la maquette, la liaison Steel Ingot â Steel Plate
faisait 40 cases de tuyau pour 2 cases d'Ã©cart, parce que le collecteur central ne sort que par
ses bouts.

Ce qui existe :
- module.ts : `designModule` (double rangÃ©e dos Ã  dos autour d'un collecteur central).
- Bouts au choix : `ends` (Â« dÃ©but Â», Â« fin Â» ou Â« milieu Â») et `trunkExit`.
- `redesign` et `alternatives`.
- La maquette `maquette/usine.gen.test.ts`, avec une prise unique par collecteur.

Ã faire :
1. Laisser le collecteur central sortir Ã  angle droit par un passage entre deux machines voisines
   d'une rangÃ©e. Le passage existe dÃ©jÃ , ou s'ouvre en Ã©cartant les machines d'une case.
2. Prendre le passage le plus proche des voisins.
3. Respecter la liste de prioritÃ©s, la place d'abord : si le passage Ã©largit le module, le
   proposer en option, ne pas l'imposer.

Tests : un module en double rangÃ©e qui sort par un passage (aucun chevauchement, chaque port
raccordÃ©) ; dans la maquette, la liaison Steel Ingot â Steel Plate raccourcit sans dÃ©grader les
autres chiffres.

Fini quand : le plan de pose et la maquette montrent le passage ; les chiffres sont comparÃ©s Ã  la
v8 dans le bilan.

### S3 â Toute l'usine (1/2) : dans le site, calculÃ©e en arriÃ¨re-plan

Retour : en attente depuis le 2026-10-14 (Â« intÃ©grer Toute l'usine au site Â»).

Ce qui existe : le prototype complet `maquette/usine.gen.test.ts` (environ 1 100 lignes, Ã  lire
par morceaux en cherchant les fonctions ; `npm run maquette` dure environ 30 s). Il contient :
- placement : plusieurs essais, passe d'amÃ©lioration (surface + 10 Ã distance), tassement, puis
  rotations des modules (`turnModule`) ;
- mode Â« recalculÃ© pour l'usine entiÃ¨re Â» : `redesign` avec des collecteurs Â« milieu Â», et choix
  parmi les `alternatives` ;
- routage Ã  prise unique (`routeTaps` et `connect`) ;
- Ã©lectricitÃ© en arbre au moindre coÃ»t (`relaysFor`, `typeFor`, `upstream`) et couverture des
  prises orphelines (`cover`).

Les chiffres de rÃ©fÃ©rence sont dans `maquette/usine-resume.txt`.

Ã faire :
1. Extraire l'algorithme en fonctions pures, sans DOM, dans `src/engine/build/factory.ts`. La
   maquette l'appelle ensuite, pour n'avoir qu'une seule source.
2. Calcul en arriÃ¨re-plan : un Web Worker de Vite (`new Worker(new URL(â¦), { type: "module" })`,
   sans dÃ©pendance), avec progression et annulation. Le rÃ©sultat est gardÃ© tant que le plan ne
   change pas.
3. Onglet Â« Plans de pose Â» :
   - une entrÃ©e Â« Toute l'usine Â» dans la liste des Ã©tapes ;
   - une vue de dessus navigable (glisser, molette), comme pour les modules ;
   - la parcelle du joueur (Â« tient / ne tient pas Â») ;
   - la mention Â« proposition Â».

Tests : non-rÃ©gression sur la chaÃ®ne du Crankshaft (aucun chevauchement, chaque liaison tracÃ©e,
chiffres au plus Ã©gaux Ã  ceux de la v8) ; temps de calcul mesurÃ©.

Fini quand : sur le site, Â« Toute l'usine Â» s'affiche sans bloquer la page, avec les mÃªmes chiffres
que la maquette.

### S4 â Toute l'usine (2/2) : options, liaisons, focus sur un module

Retours : R2 et R3, plus les options de la maquette.

Ce qui existe :
- Les options de la maquette :
  - calcul Â« module par module Â» ou Â« recalculÃ© pour l'usine entiÃ¨re Â» ;
  - liaisons Â« des tuyaux Â» ou Â« coller quand c'est possible Â» ;
  - Â« Tout afficher Â» et Â« RÃ©seau Ã©lectrique Â» ;
  - cÃ¢bles Â« entre poteaux Â» ou Â« et vers chaque machine Â».
- Le survol d'un module (surbrillance et infos).
- La vue d'un module : `renderModuleSvg` et `renderModuleInfo` (`src/ui/module-view.ts`).

Ã faire :
1. Une barre d'options comme dans la maquette, avec un bouton **Â« Afficher les liaisons Â»** bien en
   vue (Q2 tranchÃ©e) :
   - activÃ©, il dessine **toutes** les liaisons : pour chaque tuyau, le vecteur entre piÃ¨ces
     voisines et vers les ports (sens du flux), comme l'onglet 3 en jeu ;
   - dÃ©sactivÃ©, les liaisons d'une ressource s'affichent quand on sÃ©lectionne son tuyau ;
   - les **cÃ¢bles Ã©lectriques aussi** : les flÃ¨ches existent dÃ©jÃ  avec l'option Â« et vers chaque
     machine Â», il faut les gÃ©nÃ©raliser Ã  tous les cÃ¢bles ;
   - il marche aussi dans la vue d'un module.
2. Un clic sur un module fait le focus (Q3 tranchÃ©e) :
   - un **panneau Ã  cÃ´tÃ© de l'usine** montre la vue du module (la mÃªme interface que les plans de
     pose), dans la version de l'usine : recalculÃ©e, tournÃ©e, avec la prise unique ;
   - un bouton du panneau le met **en plein Ã©cran** ;
   - le focus a sa propre adresse (par exemple `#objet/pose/usine/<Ã©tape>`), et Â« â Retour Â»
     ramÃ¨ne Ã  l'usine ;
   - la vue normale d'une Ã©tape signale qu'une version Â« dans l'usine Â» existe, et inversement ;
   - **chaque machine du module est cliquable vers sa fiche** (fiche machine de la page Recettes,
     avec la liste de ses crafts, faite en S5). En attendant S5, le clic mÃ¨ne Ã  l'Ã©diteur de
     bÃ¢timents ; S5 rebranche le lien.

Fini quand : le parcours rÃ©el (survol, clic, retour, liaisons visibles) est fait, avec des captures.

### S5 â Recettes (1/2) : naviguer dans les crafts comme en jeu

Retour : R10.

Ce qui existe (donnÃ©es) :
- `data/items.json` : 213 objets avec nom, fluide ou non, `sellValue` (prix de vente),
  `researchValue` (facteur RP) et sources. **Pas de description ni d'image.**
- `data/machines.json` : 264 bÃ¢timents avec nom, description, catÃ©gorie, tier, `cost` (prix
  d'achat), taille et recherche qui le dÃ©bloque. Pas d'image.
- `data/recipes.json` : 447 recettes avec machine, `durationS`, entrÃ©es, sorties, `energyMFps` et
  recherche.
- Les corrections se font dÃ©jÃ  champ par champ : `data/overrides.json`, `applyOverrides` dans
  `src/engine/data.ts`, onglet Â« Valeurs Ã  vÃ©rifier Â». Un objet inconnu y est refusÃ©.

Ã faire :
1. Une maquette Ã  valider, d'aprÃ¨s ta description et tes captures du jeu.

   Ce que montrent les captures du 2026-10-16 (onglet du jeu) :
   - **Liste Â« Items Â»** : une recherche (Â« Search [R] Â») en haut, une grille de tuiles carrÃ©es
     (image et nom par-dessus), qui dÃ©file ; une flÃ¨che Â« < Â» pour revenir, une croix pour fermer.
   - **Fiche d'un objet** (titre Â« Recipes Â») :
     - un en-tÃªte avec l'image Ã  gauche, puis le nom, le prix en vert et le facteur RP en bleu
       (Â« 35x RP Â»), et la description dessous (Â« No Description. Â» quand il n'y en a pas) ;
     - un bloc Â« Sources Â» puis un bloc Â« Uses Â», un craft par ligne ;
     - chaque craft : tuiles des entrÃ©es sÃ©parÃ©es par Â« + Â», avec la quantitÃ© en haut Ã  droite de
       la tuile (Â« 2x Â») ; une flÃ¨che avec la durÃ©e au-dessus et les MF/s dessous ; les tuiles des
       sorties (plusieurs sorties aussi sÃ©parÃ©es par Â« + Â») ; le nom de la machine entre
       parenthÃ¨ses.
   - **Fiche d'une machine** (Chemical Reactor) : mÃªme en-tÃªte, avec le prix d'achat en vert, sans
     ligne RP, et une description sur plusieurs lignes ; un seul bloc Â« Uses Â», dont les crafts
     n'affichent pas le nom de la machine.
   - Valeurs visibles, Ã  comparer avec nos donnÃ©es pendant S5 (source : jeu, captures de
     l'utilisateur) : Crankshaft, 754 $ et 35Ã RP, sans description ; ses deux sources sont
     2 tiges + 4 engrenages â 1 Crankshaft, en 15 s et 4 kMF/s (Craft Assembler) ou en 5 s et
     200 kMF/s (Advanced Assembler) ; Chemical Reactor, 750 000 $.

   Le schÃ©ma de principe :

   ```
   Fiche objet
   ââââââââââââââââââââââââââââââââââââââââââ
   â [image]  Nom                           â
   â          Prix de vente                 â
   â          Facteur RP                    â
   â Description                            â
   ââââââââââââââââââââââââââââââââââââââââââ¤
   â Sources : les crafts qui donnent l'objetâ
   ââââââââââââââââââââââââââââââââââââââââââ¤
   â Uses : les crafts qui l'utilisent      â
   ââââââââââââââââââââââââââââââââââââââââââ

   Un craft, sur une ligne (chaque objet et la machine sont cliquables) :
   [img] Ãq Objet A + [img] Ãq Objet B  ââ(durÃ©e)âââ¶  [img] Ãq Objet C   (Machine)
                                          (MF/s)
   ```

   La fiche machine a la mÃªme disposition, avec le prix d'achat au lieu du prix de vente et
   seulement Â« Uses Â» : tous les crafts faits dans cette machine.
2. Une page Â« Recettes Â» **dans son propre onglet du menu** (Q4 tranchÃ©e) :
   - la liste de tous les objets et machines, avec une recherche, et leurs fiches ;
   - chaque objet, chaque quantitÃ© et chaque machine sont cliquables ;
   - des adresses `#recettes/objet/<id>` et `#recettes/machine/<id>`, avec le bouton Retour ;
   - les valeurs Â« Ã  vÃ©rifier Â» et Â« corrigÃ©e Â» sont signalÃ©es ;
   - rebrancher le lien des machines du focus de l'usine (S4) vers la fiche machine.
3. Descriptions des objets : depuis le wiki, avec leur source (scripts `scripts/fetch-wiki.ts` et
   `scripts/build-data.ts`), sinon saisies par le joueur comme les descriptions de recherche.
4. Images (Q6 tranchÃ©e) :
   - par dÃ©faut, une pastille de couleur avec les initiales ;
   - un outil pour **ajouter ou changer l'image d'un objet** (gardÃ©e dans le navigateur, et
     exportable comme les corrections) ;
   - les images du wiki sont en clair : mesurer ce que coÃ»terait de les rÃ©cupÃ©rer (nombre de
     fichiers, poids, licence). Si c'est raisonnable, le proposer Ã  l'utilisateur et **demander
     son accord avant tout tÃ©lÃ©chargement** ; sinon, le noter pour plus tard.

Fini quand : la tÃ¢che chronomÃ©trÃ©e Â« trouver ce qu'on fait avec du Steel Plate, puis aller Ã  sa
machine Â» se fait en quelques clics, avec des captures sur ordinateur et sur tÃ©lÃ©phone.

### S6 â Recettes (2/2) : corriger ce qui existe ou non

Ã faire :
1. Depuis une fiche, derriÃ¨re un bouton **Â« â Corriger Â»** (Q4 tranchÃ©e), corriger une valeur
   (durÃ©e, quantitÃ©s, MF/s, machine, prix, facteur RP) avec la mÃ©canique existante
   (`setCorrection`).
2. Nouveau :
   - Â« ce craft n'existe pas en jeu Â» : il est retirÃ© des calculs, et c'est rÃ©versible ;
   - Â« ajouter un craft manquant Â» : machine, entrÃ©es, sorties, durÃ©e et MF/s ;
   - de mÃªme pour un objet manquant.

   Le format : de nouvelles sections dans `overrides.json` (par exemple `added` et `removed`),
   validÃ©es par `buildGameData`, avec la source Â« jeu Â» et la date.
3. Export et import : dans le mÃªme `overrides.json` que les corrections actuelles.

Tests : cÃ´tÃ© donnÃ©es (ajout, retrait, refus d'un craft invalide) et cÃ´tÃ© interface.

Fini quand : un craft retirÃ© disparaÃ®t du calcul, un craft ajoutÃ© est proposÃ©, et l'export contient
les deux.

### S7 â SchÃ©ma : d'oÃ¹ sortent les valeurs, et lien vers le craft

Retours : R9 et la fin de R10.

Ce qui existe : `renderFlowHud` et `renderEdgeHud` (`src/ui/plan-view.ts`). Chaque Ã©tape (`Step`,
`src/engine/solve.ts`) porte dÃ©jÃ  :
- `recipeId`, la machine et `durationS` ;
- `outputPerCycle`, `ratePerMachine` et `demandPerMin` ;
- `machinesExact`, `machines` et `utilization` ;
- `inputs`, `consumers` et `byproducts` ;
- `energyMFps` et `verify`.

Ã faire :
1. Quand un bloc est sÃ©lectionnÃ©, un panneau Â« Comment c'est calculÃ© Â» montre :
   - le craft utilisÃ©, sur sa ligne comme dans Recettes, avec sa rÃ©fÃ©rence et un lien
     Â« Voir dans Recettes â¸ Â» qui ouvre la fiche sur ce craft ;
   - dÃ©bit par machine = sortie par cycle Ã 60 / durÃ©e ;
   - demande = somme des consommateurs (+ l'objectif) ;
   - machines = demande / dÃ©bit par machine (valeur exacte, puis arrondie) ;
   - l'utilisation et l'Ã©nergie ;
   - entrÃ©es = demande Ã quantitÃ© / sortie ;
   - la source de chaque valeur : wiki, relevÃ©, correction ou Ã  vÃ©rifier.
2. Quand une flÃ¨che est sÃ©lectionnÃ©e : qui la produit, qui la consomme, et le calcul de son dÃ©bit.

Fini quand : on peut refaire Ã  la main chaque nombre du schÃ©ma Ã  partir du panneau (vÃ©rifiÃ© sur
deux Ã©tapes de la chaÃ®ne du Crankshaft).

### S8 â SchÃ©ma : rÃ©gler le nombre de machines

Retour : R4.

Ce qui existe : `finalMachines` dans `SolveRequest` (nombre de machines de l'Ã©tape finale
seulement) et `forced` (recette imposÃ©e par objet).

Ã faire :
1. Moteur : un champ `fixedMachines` (Ã©tape â nombre).
   - Les recettes sont fixÃ©es Ã  celles du plan. On cherche le dÃ©bit maximal pour lequel chaque
     Ã©tape fixÃ©e a assez de machines, par dichotomie sur le dÃ©bit (mÃ©thode robuste mÃªme avec la
     production existante).
   - On renvoie le dÃ©bit obtenu, l'Ã©tape qui limite et l'utilisation de chaque Ã©tape.
   - Q7 tranchÃ©e : les Ã©tapes non fixÃ©es s'adaptent ; avec plusieurs Ã©tapes fixÃ©es, la plus
     contraignante dÃ©cide et les autres montrent leur capacitÃ© inutilisÃ©e. La production
     existante n'est utilisÃ©e en prioritÃ© que si son option est activÃ©e.
2. SchÃ©ma, dans le panneau d'un bloc :
   - Â« Machines : [â] 15 [+] Â», rÃ©glable Ã  la molette et aux boutons (pas de curseur) ;
   - un bandeau Â« Production obtenue : â¦ (limitÃ©e par â¦) Â» ;
   - un bouton Â« Revenir au calcul Â».

Questions : Q7.

Tests :
- une Ã©tape fixÃ©e â dÃ©bit proportionnel ;
- deux Ã©tapes fixÃ©es â la plus contraignante l'emporte ;
- avec de la production existante.

### S9 â Calcul : exclure des machines, ou n'utiliser que certaines

Retour : R5.

Ce qui existe : les recettes sont filtrÃ©es selon la progression (recherches dÃ©bloquÃ©es) par
`machineAccess` (`src/engine/unlock.ts`), appelÃ© dans `choose.ts`, `resources.ts` et `solve.ts`.
`forced` impose une recette.

Ã faire :
1. Ajouter `SolveRequest.machines = { mode: "exclure" | "seulement", ids }`, branchÃ© lÃ  oÃ¹
   `machineAccess` filtre dÃ©jÃ  : les recettes des machines Ã©cartÃ©es ne sont plus candidates.
2. Si un objet devient impossible Ã  fabriquer, le dire : Â« aucune machine permise ne fabrique X Â».
3. Q8 tranchÃ©e : le rÃ©glage se fait **par plan** (page de l'objectif), avec une recherche. En
   mode Â« seulement Â», les machines d'extraction (mines, pompes, arbres) sont permises par
   dÃ©faut, mais on peut les exclure. Un raccourci Â« ne plus utiliser cette machine Â» est ajoutÃ©
   dans le panneau d'un bloc du schÃ©ma.

Questions : Q8.

### S10 â Interfaces des machines

Retour : R7.

Q5 tranchÃ©e, ce que c'est :
- Une interface n'est **ni un objet, ni un port, ni une case** : c'est une Ã©tiquette flottante de
  Roblox sur la machine (Â« [E] Interact Â») ; la touche ouvre un rÃ©glage de la machine.
- Elle **ne compte pas dans le placement**, seulement dans la configuration de la machine.
- Elle varie beaucoup d'une machine Ã  l'autre. Exemples donnÃ©s par l'utilisateur :
  - panneaux, drapeaux, capteur de pollution : une fenÃªtre Â« Modify Machine Â» (capture : champs
    Â« Minimum value Â», Â« Minimum value enable Â» OFF/ON, Â« Maximum value Â»â¦, boutons Cancel et
    Confirm) ;
  - Plastic Molding Machine et Industrial Plastic Molder : pas de fenÃªtre, un **levier** qui
    passe de la bouteille Ã  la caisse (notes des relevÃ©s du 2026-10-15) ;
  - le Â« carry Â» : le choix se fait directement sur la machine, sans bouton.
- Ces exemples ne servent qu'Ã  orienter les recherches : il faut se renseigner sur chaque
  interface (wiki, Internet), et ne rien supposer.

Ã faire :
1. Recherche : quelles machines ont une interface, ce qu'elle rÃ¨gle, ses valeurs possibles, et
   leur effet sur le calcul (recette ou sortie choisie, seuils, marche/arrÃªtâ¦). Chaque rÃ©ponse a sa
   source ; les manques vont dans `a-verifier.md`.
2. Ãditeur de bÃ¢timents : noter l'interface d'un bÃ¢timent (type : fenÃªtre de rÃ©glages, levier,
   choix direct ; ses rÃ©glages et leurs valeurs).
3. Calcul : tenir compte du rÃ©glage. Par exemple, le levier du mouleur choisit la sortie
   (bouteille ou caisse), donc la recette. Le plan dit quel rÃ©glage appliquer Ã  chaque machine
   (Â« levier sur caisse Â»). Rien ne change dans le placement.

Fini quand : chaque interface relevÃ©e apparaÃ®t dans l'Ã©diteur, et un plan qui utilise une machine
rÃ©glable dit le rÃ©glage Ã  faire ; tests sur un cas (le mouleur).

### S11 Ã  S14 â Machines modulaires

Retour : R8.

Ce qui existe : dans `data/machines.json`, catÃ©gorie Â« Modular Â», les donnÃ©es du wiki (tailles du
wiki, prix, descriptions).

**Moteur diesel modulaire (Tier II).**
- Blocs : Diesel Engine Controller, Crankshaft, Crankshaft Sideways, Cylinder, Air Input, Exhaust,
  Fuel Input, Generator, Flywheel, Info Panel, Decoration. Le Flywheel mesure 6 Ã 4, les autres
  2 Ã 2.
- Les descriptions donnent dÃ©jÃ  des rÃ¨gles :
  - un seul Controller par moteur ;
  - les vilebrequins se posent devant le Controller ;
  - cylindres, entrÃ©es d'air, Ã©chappements, entrÃ©es de carburant et panneau se posent sur les
    cÃ´tÃ©s des vilebrequins ;
  - le Generator se place au bout de la chaÃ®ne ;
  - les gros moteurs peuvent demander plusieurs entrÃ©es.

**Ferme d'arbres modulaire (Tier I).**
- Blocs : Tree (4 Ã 4), Tree Farm Controller, Tree Farm Output, Tree Farm Sprinkler, Tree Farm
  Water Tank (10 Ã 4), Farm Harvester (8 Ã 8).
- Les descriptions donnent dÃ©jÃ  des rÃ¨gles :
  - un rÃ©servoir pour trois arroseurs ;
  - un seul Controller par ferme (plusieurs Ã  portÃ©e la cassent) ;
  - tout doit Ãªtre Ã  portÃ©e : arroseurs â arbres â rÃ©colteurs â sortie.

**Turbine modulaire (Tier IV).** La chaÃ®ne est : Turbine Input â High Pressure (plusieurs) â
Intermediate (une) â Low Pressure (plusieurs) â Turbine Generator â Turbine Output.

Aujourd'hui, le calcul traite l'arbre comme une Â« farm Â» (pousse : `treeGrowth`), sans les blocs
qui l'entourent.

Q9 tranchÃ©e : l'ordre est **Tier I (ferme d'arbres), puis Tier II (moteur diesel), puis Tier IV
(turbine)**. Les relevÃ©s en jeu sont compliquÃ©s : chercher d'abord partout sur Internet (wikis,
guides, vidÃ©os, forums, Discord publicâ¦). L'utilisateur prÃ©cise que **la portÃ©e est circulaire**
(un rayon, pas un carrÃ©).

Les quatre sessions :
- **S11 â Recherche et donnÃ©es.**
  - Lire les pages du wiki de chaque bloc (Miraheze, Fandom en contrÃ´le) et les guides Ã©ventuels,
    puis chercher plus loin sur Internet. Chaque valeur a sa source.
  - Ãcrire `data/modular.json` : rÃ¨gles de contact par face, portÃ©es, nombre de blocs requis et
    effets, chacun avec sa source.
  - Tout manque va dans `a-verifier.md`, avec une mÃ©thode de relevÃ© dans RELEVES.md.

  Pas d'interface. Fini quand chaque rÃ¨gle a une source ou une question.
- **S12 â Ãditeur.** Dans l'Ã©diteur de bÃ¢timents, pour chaque bloc d'un ensemble : quels blocs
  peuvent ou doivent le toucher sur chaque face. Pour la ferme : la portÃ©e de chaque bloc (en
  cases) et ce qu'elle dessert. Maquette d'abord.
- **S13 â Calcul.**
  - La puissance et la consommation du moteur diesel selon sa configuration.
  - Le bois par minute de la ferme selon le nombre d'arbres, d'arroseurs et de rÃ©colteurs.
  - L'intÃ©gration au solveur (objectifs Ã©nergie et objets).

  Seulement avec des valeurs sourcÃ©es ; sinon, Â« Ã  relever Â».
- **S14 â Plans de pose.** Assemblage par contact (vilebrequins en chaÃ®ne, blocs sur les cÃ´tÃ©s).
  Pour la ferme, placement par portÃ©es, comme la couverture des poteaux.

Questions : Q9.

### S18 â Moteur diesel : configurations relevÃ©es et carburant

DemandÃ© pendant S14 (Q15). Le calcul ne connaÃ®t que les 8 configurations relevÃ©es (tableau du
contrÃ´leur Ã  6 cylindres, 32 cylindres) ; il n'existe pas de formule (MOD-12).
- Dans l'Ã©diteur, un relevÃ© de configuration : cylindres, rapport air/carburant, accÃ©lÃ©rateur,
  carburant â puissance et consommation lues sur l'Info Panel ; gardÃ© et exportÃ© comme les autres.
- Le calcul choisit parmi les configurations relevÃ©es, selon le besoin et le carburant (le carburant
  change la consommation, pas la puissance) ; les rÃ©glages du contrÃ´leur s'affichent dans le plan.
- Les blocs suivent ce dont l'ensemble dispose (plan de pose S14).
- Une formule dÃ©duite seulement Ã  la demande, quand les relevÃ©s suffisent, affichÃ©e Â« dÃ©duite Â».

Maquette d'abord.

### S19 â Ãditeur de bÃ¢timents simplifiÃ©

DemandÃ© pendant S14 (Q15) : relever les ports directement dans la grille, avec une case sur chaque
face pour ce qu'elle accueille (blocs modulaires), et retirer les informations qui ne servent pas au
joueur. Maquette d'abord.

### S20 â Recherche : vitesse rÃ©elle des RP et Ã©tat de mes stations

Retour : R13. Recherche faite le 2026-10-18 (sources, confrontation et questions RP-01 Ã  RP-09 dans
`data/a-verifier.md`, Â« Vitesse des RP et plafond souple Â» ; mÃ©thode dans RELEVES.md, Â« Points de
recherche Â»). Place dans l'ordre : entre S19 et S15 (rÃ©ponse Ã  Q17.1, 2026-10-19).

Ce qui existe (vÃ©rifiÃ© dans le code le 2026-10-18) :
- `data/research-stations.json` : toutes les formules du wiki, sourcÃ©es (vitesse et plafond des RS1
  Ã  RS4, facteur de prix, pÃ©nalitÃ© de 30 %, circuits Logic, paraboles, plafond souple 10^(1âx) et
  10^(1ââx), RP de dÃ©part). Rien n'y est marquÃ© Â« Ã  vÃ©rifier Â».
- `src/engine/research-points.ts` : ces formules, `designResearch` (une installation **neuve**, d'un
  seul type de station, avec ou sans paraboles) et `unlockTimeline` (chronologie avec le plafond
  souple, par intÃ©gration numÃ©rique).
- Â« Mon usine Â» (`progress.ts`) : RP, RP/s et heure de saisie. `currentRp` les prolonge **en ligne
  droite**, sans plafond ; `withRpRate` change la vitesse sans perdre les RP accumulÃ©s.
- Objectif recherche (`main.ts`, `computeResearch`) : la chronologie Â« Ã  ton rythme actuel Â» prend un
  plafond infini ; celle Â« avec l'installation Â» ajoute la vitesse actuelle Ã  celle des stations
  neuves, avec le seul plafond des stations neuves. Plafond voulu (`capNeeded`) : la recherche la
  plus chÃ¨re, ou un nombre saisi.
- `a-verifier.md` (2026-10-12) : Â« plafond gÃ©nÃ©ral, commun Ã  toutes les stations Â» selon
  l'utilisateur, Ã  prÃ©ciser en jeu ; les installations mixtes ne sont pas proposÃ©es.

Ce que la recherche apporte :
- Le seuil d'efficacitÃ© du panneau est le plafond du wiki ; Â« Max RP before RP/s is nearly zero Â»
  est le solde oÃ¹ la vitesse tombe Ã  1 % (3 Ã seuil, tiers 1 Ã  3). Les formules retrouvent la
  capture : +47,47 RP/s, 76 875 RP, +2,93 RP/s (log dÃ©cimal confirmÃ©), > 231 000 RP.
- La baisse porte sur le **solde** de RP non dÃ©pensÃ©s : dÃ©penser rend la vitesse.
- Au-delÃ  du seuil (tiers 1 Ã  3), le solde suit une formule exacte :
  RP(t) = seuil Ã (1 + logââ(1 + ln 10 Ã r Ã t Ã· seuil)). Pour le tier 4 : intÃ©gration numÃ©rique,
  comme `unlockTimeline`.
- Deux stations du mÃªme tier ne s'additionnent pas : la vitesse vient de la somme des valeurs de
  toutes les stations du tier (2 Ã V^0,6), et le plafond du nombre total de stations (m). Ajouter
  des stations Ã  celles du joueur n'est donc pas la mÃªme chose que poser une installation neuve Ã 
  cÃ´tÃ©.

Ce qu'il faut pouvoir saisir (Â« Mon usine Â», section Â« Ma recherche Â») :

| Information | OÃ¹ la lire en jeu | Ã quoi elle sert |
| --- | --- | --- |
| RP et RP/s, avec l'heure | Research Tracking Panel, 1Ê³áµ ligne (dÃ©jÃ  saisis) | point de dÃ©part de l'estimation |
| Seuil d'efficacitÃ© de chaque tier | panneau, une ligne par tier | moment oÃ¹ la vitesse baisse ; vitesse rÃ©elle au-delÃ  |
| Stations actives et RP/s de chaque tier | panneau, une ligne par tier | vitesse propre Ã  chaque tier (si chaque tier a son seuil, RP-05) ; contrÃ´le |
| Â« Max RP before RP/s is nearly zero Â» | panneau, derniÃ¨re ligne | contrÃ´le (doit valoir 3 Ã le seuil) ; plafond de fait de l'estimation |
| ContrÃ´leurs actifs et leurs RP/s ; paraboles actives ; efficacitÃ© | Ã©cran du bas du panneau | part des paraboles ; savoir si elle baisse avec le reste (RP-04) |
| Items de chaque station (ou d'un groupe de stations identiques) | la station elle-mÃªme (pas sur le panneau) | recalculer vitesse et seuil ; proposer d'**ajouter** des stations Ã  celles qui existent |
| Liquide de chaque contrÃ´leur | le contrÃ´leur | recalculer le bonus ; nombre de paraboles pour 100 % |
| Circuits Logic rÃ©solus (RS4) | la Research Station4 | plafond et vitesse du tier 4 (RP-09) |
| Recherches qui seront dÃ©pensÃ©es | l'arbre du site (option Â« dÃ©penser les RP Â», dÃ©jÃ  lÃ ) | le solde redescend, la vitesse remonte |

Deux niveaux, au choix du joueur : **rapide** (recopier les nombres du panneau : RP, RP/s, seuil par
tier, Â« Max RP Â») et **dÃ©taillÃ©** (stations, items, liquides : le site recalcule les nombres du
panneau et affiche Â« â comme en jeu Â» ou l'Ã©cart, comme pour les arroseurs en S12).

Ce qu'il faut faire :
- Moteur : RP estimÃ©s avec le plafond souple (formule exacte pour les tiers 1 Ã  3) ; temps pour
  atteindre un solde (seuil, 2 Ã seuil, une recherche) ; RP/s Ã  un instant donnÃ© ; installation du
  joueur dÃ©crite par tier (stations, items, liquides) et recalculÃ©e ; proposition Â« ajouter N
  stations Ã  tes stations du tier 3 Â» Ã  cÃ´tÃ© de Â« poser une installation neuve Â».
- Â« Mon usine Â» : section Â« Ma recherche Â» (deux niveaux), RP â maintenant avec le plafond, Â« seuil
  atteint dans â¦ Â», Â« au-delÃ , la vitesse baisse : dÃ©pense tes RP Â» ; en-tÃªte du site : RP/s rÃ©els.
- Objectif recherche : chronologies avec le vrai seuil du joueur (Â« Ã  ton rythme actuel Â» ne prend
  plus un plafond infini) ; Â« Comment c'est calculÃ© Â» pour la vitesse et le seuil.
- Tests : la capture du 2026-10-18 refaite par le moteur (47,47 ; 76 875 ; 2,93 ; 230 626) ; la
  formule exacte comparÃ©e Ã  l'intÃ©gration numÃ©rique.

Questions : Q17, et RP-01 Ã  RP-08 (relevÃ©s). Ce qui reste sans rÃ©ponse est Ã©crit Â« supposÃ© Â» sur le
site (la rÃ¨gle des tiers multiples en premier). Maquette d'abord.

CritÃ¨re de fin : avec les nombres de la capture saisis dans Â« Mon usine Â», le site affiche les RP
estimÃ©s Ã  l'instant, l'heure du seuil et la vitesse au-delÃ , et l'Ã©cart avec un nouveau relevÃ© en
jeu aprÃ¨s le seuil (RP-04) reste sous 2 % ; l'objectif recherche part des stations du joueur ; tests
verts ; parcours rÃ©el avec captures.

### S21 â Recherche : historique des RP et deux graphiques

Retour : R14 (2026-10-20, aprÃ¨s S20). Place : entre S20 et S15 (Q20.1).

Ce qui existe (vÃ©rifiÃ© dans le code le 2026-10-20, commit `afa77d9`) :
- `src/engine/research-balance.ts` : `balanceAfter`, `timeToReach`, `rateAt`, `researchModel` (tiers,
  seuils, paraboles, Ã  partir de Â« Ma recherche Â») ; la courbe entre deux instants se refait pour
  n'importe quelle configuration.
- `src/ui/progress.ts` : `PlayerInfo` garde **un seul** relevÃ© (`rp`, `rpPerSec`, `rpAt`) et **une
  seule** configuration (`research`) ; chaque saisie remplace la prÃ©cÃ©dente. Aucun historique.
- `setProgress` (main.ts) dÃ©pense les RP d'une recherche dÃ©bloquÃ©e sur le site (option Â« dÃ©penser Â»),
  sans rien noter.
- Le site dessine ses graphiques en SVG sans bibliothÃ¨que (arbre, plans) : pas de dÃ©pendance Ã  ajouter.
- `currentRp` compte le temps **rÃ©el** Ã©coulÃ© depuis la saisie (horloge continue), mÃªme quand le joueur
  n'est pas en jeu : faux, d'aprÃ¨s la rÃ¨gle ci-dessous (vrai avant S20 comme aprÃ¨s).

RÃ¨gle de jeu (utilisateur, 2026-10-20) : **les RP ne s'accumulent que quand le joueur est connectÃ© au
jeu.** Ce qui compte, ce sont des durÃ©es de jeu (des Ît), pas le temps continu. La sauvegarde du jeu
suit, elle aussi, le temps d'activitÃ© en jeu.

Ce qu'il faut faire :
- **En jeu / hors jeu** (en premier : tout le reste en dÃ©pend) : un interrupteur Â« Je joue Â» / Â« Je ne
  joue plus Â», activable Ã  tout moment, dans Â« Ma recherche Â» et sur la puce de l'en-tÃªte. Hors jeu, les
  RP estimÃ©s et l'horloge s'arrÃªtent ; ils repartent Ã  la reconnexion. Toutes les estimations (RP
  maintenant, Â« seuil atteint dans â¦ Â», chronologies de l'objectif recherche) comptent en **temps de
  jeu**. Ãtat gardÃ© au rechargement ; Ã  l'ouverture du site, rappel de l'Ã©tat (Â« hors jeu depuis â¦ Â»).
- **Journal** (pur, testÃ©), gardÃ© dans le navigateur (clÃ© Ã  part) et exportÃ© avec la partie (clÃ©
  facultative, l'ancien format reste lisible). Trois types d'Ã©vÃ©nements, chacun datÃ© :
  - relevÃ© : RP et RP/s de la 1Ê³áµ ligne du panneau (Ã  chaque saisie) ;
  - configuration : la saisie de Â« Ma recherche Â» entiÃ¨re, enregistrÃ©e **automatiquement** Ã  chaque
    modification (Q20.3) ; les frappes rapprochÃ©es se fondent en un seul Ã©vÃ©nement ;
  - dÃ©pense : recherches dÃ©bloquÃ©es (ou rendues) sur le site, RP avant et aprÃ¨s.
  - session : dÃ©but et fin de chaque pÃ©riode en jeu (l'interrupteur).
  Premier point : la capture du 2026-10-18 (19 273,50 RP, 50,40 RP/s), placÃ©e au dÃ©but du temps de jeu
  (son heure ne compte pas : seuls les Ît de jeu comptent, Q21.1).
- **Moteur de l'historique** : la courbe prÃ©vue repart de chaque relevÃ© et de chaque dÃ©pense, avec la
  configuration en vigueur, et n'avance que pendant les sessions en jeu ; Ã  chaque relevÃ©, l'Ã©cart entre
  la prÃ©vision et le relevÃ© (en RP et en %).
  C'est le contrÃ´le qui manque Ã  RP-04 et au critÃ¨re Â« moins de 2 % Â» de S20. Ce qui est dÃ©pensÃ© en jeu
  sans Ãªtre cochÃ© sur le site apparaÃ®t comme une marche, que le relevÃ© suivant corrige.
- **Deux graphiques** dans Â« Ma recherche Â», un peu plus bas (Q20.2), sur le mÃªme axe, graduÃ© en
  **temps de jeu** (les pÃ©riodes hors jeu ne prennent pas de place ; un repÃ¨re discret marque chaque
  reconnexion) :
  - **RP** : les relevÃ©s en points, la courbe prÃ©vue en trait, le seuil de chaque pÃ©riode en ligne
    horizontale (il change avec la configuration), la prÃ©vision au-delÃ  de maintenant en pointillÃ© ;
  - **RP/s** : la vitesse prÃ©vue (elle baisse au-delÃ  du seuil, remonte aprÃ¨s une dÃ©pense), les RP/s
    relevÃ©s en points ;
  - sur les deux : un repÃ¨re vertical Ã  chaque changement de configuration et Ã  chaque dÃ©pense, avec
    au survol (ou au toucher) ce qui a changÃ© (Â« + 1 station du tier 3 Â», Â« liquide : Light Oil Â»,
    Â« Foundry dÃ©bloquÃ©e : â100 000 RP Â») ; une pÃ©riode au choix, en temps de jeu (24 h par dÃ©faut, 7 jours, tout).
  - Lire le skill `dataviz` avant d'Ã©crire les graphiques ; tenir Ã  375 px de large.
- **Journal** : les Ã©vÃ©nements Ã  moins de 2 minutes d'Ã©cart se fondent en un seul ; on garde 90 jours
  de **temps de jeu** (Q21.3, Q21.4).
- **Tests** : temps de jeu (une pause n'ajoute aucun RP, la reprise repart du mÃªme solde), journal
  (fusion des frappes, limite de 90 jours de jeu, export et import), courbe d'un journal fictif (relevÃ©,
  session, changement de configuration, dÃ©pense, relevÃ©) contre `balanceAfter` morceau par morceau,
  Ã©cart d'un relevÃ©.

Questions : Q21 rÃ©pondue le 2026-10-20 (Â§ 4). Maquette d'abord (l'interrupteur et les deux graphiques) (un fichier dans `maquette/`, feuille de style en
chemin relatif), avec un journal d'exemple construit sur la capture du 2026-10-18 et des Ã©vÃ©nements
marquÃ©s Â« exemple Â».

CritÃ¨re de fin : hors jeu, les RP estimÃ©s ne bougent plus et repartent Ã  la reconnexion ; aprÃ¨s quelques
saisies (relevÃ©s, une station ajoutÃ©e, une recherche dÃ©bloquÃ©e), les deux
graphiques montrent l'historique, les repÃ¨res et l'Ã©cart prÃ©vision / relevÃ© ; le journal survit au
rechargement et Ã  l'export ; tests verts ; parcours rÃ©el avec captures, ordinateur et tÃ©lÃ©phone.

### S15 â Revue d'ensemble de l'interface, comme un joueur

Retour : l'utilisateur veut revoir l'interface dans son ensemble, pour qu'elle soit logique pour des
joueurs (Â« t'es pas joueur et t'as pas la faÃ§on de rÃ©flÃ©chir de ceux-ci Â»). Place : aprÃ¨s S1 Ã  S14 et
S18 Ã  S21 (Â§ 2), avant S16, qui part de sa liste de dÃ©fauts.

Ce qui existe (vÃ©rifiÃ© le 2026-10-20, commit `554e136`, 437 tests) :
- Menu : Accueil Â· Planifier Â· Mon usine Â· Arbre de recherche Â· Recettes Â· DonnÃ©es ; puces d'Ã©tat et
  bouton â¶/â¸ dans l'en-tÃªte (`index.html`).
- Planifier : une page par objectif (objet, Ã©nergie, RP, argent), PrioritÃ©s, Machines (S9), Options
  avancÃ©es ; rÃ©sultat en onglets Liste de construction, SchÃ©ma (S7, S8, S10, S18), Plans de pose
  (dont Toute l'usine S3-S4 et Ensembles modulaires S14), DÃ©tails.
- Mon usine : progression, Ma recherche (S20, S21 : saisie, interrupteur, graphiques, journal),
  ressources, production en place, rÃ©glages, export.
- Recettes (S5, S6), DonnÃ©es (valeurs Ã  vÃ©rifier, corrections, Ã©diteur de bÃ¢timents S10, S12, S19).
- La refonte du 2026-10-12 (REFONTE.md) a fixÃ© Â« une question, une page, une rÃ©ponse Â». Chaque lot
  depuis le 2026-10-16 a ajoutÃ© sa fonction lÃ  oÃ¹ l'existant le permettait, en attendant cette revue.

Ce qu'il faut faire :
- **Tour du site page par page**, dans le navigateur intÃ©grÃ© (captures si la fenÃªtre le permet, sinon
  par le DOM, et le dire) : inventaire court de ce que voit un joueur, du jargon, des doublons, de ce
  qui est cachÃ© ou mal placÃ©.
- **Parcours de joueur guidÃ©s par l'utilisateur** : en proposer 3 Ã  5, lui faire choisir l'ordre, les
  suivre avec lui ; noter ses rÃ©actions mot pour mot, le nombre de gestes et ce qui bloque.
- **Liste des dÃ©fauts** vus par un joueur, classÃ©s par gravitÃ© (elle sert Ã  S16).
- **RÃ©organisation proposÃ©e** (menu, pages, vocabulaire de joueur, valeurs par dÃ©faut, ce qu'on replie
  ou retire), sous forme de **maquette Ã  valider** (`maquette/revue.html`, feuille de style en chemin
  relatif).
- **AprÃ¨s validation** : dÃ©couper la rÃ©organisation en lots courts (R1, R2â¦), chacun avec son critÃ¨re
  de fin, ajoutÃ©s au Â§ 2 et ici. Pendant la session, seulement les changements simples et sÃ»rs que
  l'utilisateur demande.

Questions : Q23 (parcours et leur ordre), puis celles de la maquette (Q24).

CritÃ¨re de fin : parcours faits avec l'utilisateur et notÃ©s ; liste des dÃ©fauts classÃ©e ; maquette
validÃ©e ; lots de rÃ©organisation Ã©crits et placÃ©s au Â§ 2 ; tests verts.

### S22 Ã  S29 â RÃ©organisation de l'interface (tirÃ©e de S15)

Source commune : [REVUE.md](REVUE.md) (parcours A Ã  E, dÃ©fauts G1-G4, M1-M12, F1-F11) et la maquette
validÃ©e `maquette/revue.html` (dÃ©cisions S15 au Â§ 5). Chaque lot lit d'abord la partie de REVUE.md
qui le concerne, vÃ©rifie dans le code ce qui existe (les fichiers citÃ©s ici viennent du tour du
2026-10-20, commit `554e136`), et refait Ã  la fin le parcours d'oÃ¹ viennent ses dÃ©fauts, en comptant
les gestes, sur ordinateur et tÃ©lÃ©phone. Aucun lot ne change un calcul sans le dire (Â§ 0, rÃ¨gle 5).
Pour une partie vide : un second serveur de dÃ©veloppement sur un port jamais utilisÃ© (S15 : 5179,
entrÃ©e `calculateur-neuf` ajoutÃ©e Ã  `.claude/launch.json`, fichier non suivi par git, Ã  recrÃ©er) a son
propre stockage ; la progression de l'utilisateur s'y importe par Â« Importerâ¦ Â».

#### S22 â Recherche : la durÃ©e lÃ  oÃ¹ l'on regarde (G1, G2)

- Arbre (`research-view.ts`) : le panneau d'une recherche non dÃ©bloquÃ©e affiche Â« il te manque N RP Â·
  â durÃ©e de jeu Ã  ton rythme Â» (mÃªme calcul que la chronologie de `research-plan.ts`, temps de jeu,
  plafond si Â« Ma recherche Â» le connaÃ®t, sinon Â« en ligne droite Â», dit comme tel), et un lien Â« L'avoir
  plus vite Â» vers Planifier âº Des RP rÃ©glÃ© sur cette recherche.
- Planifier âº Des RP : vide tant que rien n'est saisi ; but Â« dÃ©bloquer une recherche Â» en premier ;
  la rÃ©ponse commence par Â« Ã  ton rythme : â¦ Â», puis Â« en N min : â¦ Â».
- CritÃ¨re de fin : partie de l'utilisateur, Research Station 4 â la durÃ©e (4 h 37 de jeu au 2026-10-20)
  lue dans l'arbre en 3 gestes ; Â« Des RP Â» n'affiche plus aucun plan sans saisie ; tests verts.

#### S23 â Planifier vide, nouveau menu, prioritÃ©s du joueur, en-tÃªte (M5, M6, M7, F6 Ã  F9)

- Menu : Planifier Â· Arbre Â· Recettes Â· Mon usine Â· Contribuer (ex-DonnÃ©es ; anciennes adresses
  redirigÃ©es). L'onglet Accueil disparaÃ®t (la fenÃªtre d'orientation est S24) ; `#accueil` mÃ¨ne Ã 
  Planifier.
- Quatre objectifs vides par dÃ©faut, exemples en grisÃ© (`placeholder`), aucun rÃ©sultat ni onglet sans
  saisie ; les rÃ©glages dÃ©jÃ  saisis restent gardÃ©s.
- PrioritÃ©s par dÃ©faut d'un objet : le moins de place, puis de machines, puis d'Ã©nergie, le prix
  ensuite (les prioritÃ©s dÃ©jÃ  choisies par un joueur ne changent pas) ; chiffres de la rÃ©ponse dans cet
  ordre, la pollution dans DÃ©tails.
- En-tÃªte sur une ligne jusqu'Ã  1 366 px, bouton Â« â page prÃ©cÃ©dente Â» retirÃ©, Â« â¶ Je joue Â» Ã©crit ;
  rappel Â« Tu jouais encore ? Â» en bandeau sous l'en-tÃªte.
- CritÃ¨re de fin : parcours A refait (partie vide â plan Crankshaft en tapant l'objet) ; aucune page
  ne montre de rÃ©sultat sans saisie ; tests verts (adresses redirigÃ©es comprises).

#### S24 â FenÃªtre d'orientation Ã  la premiÃ¨re visite

- Une fenÃªtre Ã  la premiÃ¨re visite (et rouvrable depuis l'en-tÃªte) qui explique Ã  un joueur
  d'Industrialist comment s'orienter : oÃ¹ planifier, oÃ¹ dire oÃ¹ il en est, l'usine et le schÃ©ma, les
  recettes, ce qui est gardÃ© dans le navigateur. Pas un tutoriel pas Ã  pas.
- Au dÃ©but du lot : demander le lien de la page Â« philosophie Â» de l'utilisateur (modÃ¨le citÃ© en
  Q24) ; maquette du texte et de la forme Ã  valider.
- CritÃ¨re de fin : maquette validÃ©e ; la fenÃªtre s'ouvre une fois, se referme, se rouvre ; lisible Ã 
  375 px ; tests verts.

#### S25 â L'Usine au premier plan (M1, M8, M10, F10, F11)

- Onglets du rÃ©sultat : **Usine** (ex-Â« Toute l'usine Â», ouvert en premier), SchÃ©ma, Liste des
  machines, DÃ©tails. L'Usine se calcule en **module par module** par dÃ©faut ; Â« recalculÃ© pour l'usine
  entiÃ¨re Â» reste au choix.
- Dessin d'abord, cadrÃ© sur l'usine (la parcelle en repÃ¨re) ; trois boutons (Tout afficher, RÃ©seau
  Ã©lectrique, Afficher les liaisons), le reste dans Â« Plus d'options Â» ; Â« CÃ¢bles Â» retirÃ© (la
  liaison affichÃ©e le remplace).
- Ã cÃ´tÃ© du dessin, la liste des modules avec Â« module posÃ© â Â» (gardÃ© par plan), qui grise le module.
- La page ne remonte plus quand on change de calcul ; Â« liaison non tracÃ©e Â» prÃ©vue (eau de la ferme)
  en note, pas en rouge.
- CritÃ¨re de fin : parcours D refait, Usine visible en 1 geste aprÃ¨s la rÃ©ponse ; un module cochÃ©
  reste grisÃ© au rechargement ; mesures de l'usine inchangÃ©es (Â§ 6, S4) ; tests verts.

#### S26 â Un module : l'ordre de pose du joueur (G3, M9)

- Le panneau d'un module : le dessin, Â« module posÃ© â Â», puis l'ordre de pose repliÃ©.
- L'ordre de pose est Ã©crit **dans le sens oÃ¹ le module est posÃ© dans l'usine** (directions tournÃ©es
  avec lui), et rangÃ© comme le joueur construit : bÃ¢timents (touche 1, Â« & Â» en AZERTY), tuyaux
  (touche 3, Â« " Â»), Ã©lectricitÃ© puis logique (touche 2, Â« Ã© Â»).
- CritÃ¨re de fin : un module tournÃ© d'un demi-tour dans l'usine dÃ©crit ses tuyaux dans le bon sens
  (test) ; l'ordre de pose d'une Ã©tape seule ne change que par son rangement ; tests verts.

#### S27 â Ã Ã©vacuer : la sortie au bord choisi (G4)

- Au dÃ©but du lot : l'utilisateur montre les tuyaux Â« sans destination Â» (plan et capture) ; le plan
  Crankshaft 60/min n'a rien Ã  Ã©vacuer, il faut donc trouver lesquels il voit.
- Pour chaque produit Ã  Ã©vacuer : un tuyau jusqu'au bord choisi (en haut, en bas, Ã  gauche, Ã  droite),
  rÃ©glable dans l'Usine, gardÃ© par plan.
- CritÃ¨re de fin : sur un plan qui Ã©vacue (exemple de S15 : Research Station 4 en 1 h, Residue et
  Clay), chaque produit sort au bord choisi ; aucun tuyau ne finit dans le vide ; tests verts.

#### S28 â SchÃ©ma et rÃ©glages visibles (M2, M3, M4)

- SchÃ©ma : la vue de dÃ©part montre toute la chaÃ®ne ; Â« â¤¢ Â» agit sur le dessin, pas sur la page.
- Barre Â« Ton plan Â» au-dessus des onglets : prioritÃ©s, machines permises, rÃ©glages faits Ã  la main
  (machines fixÃ©es, recettes choisies, rÃ©glages des machines), valeurs Ã  vÃ©rifier ; chacun cliquable,
  avec â pour l'annuler.
- Barre du bloc : Â« Tu peux rÃ©gler : Â» (machines, recette, ne plus utiliser) et Â« Voir le module dans
  l'usine Â».
- â  cliquable sur un bloc, une ligne ou un module qui utilise une valeur Ã  vÃ©rifier â la correction.
- CritÃ¨re de fin : parcours E refait (valeur Ã  vÃ©rifier du Crankshaft corrigeable en 2 gestes depuis
  le rÃ©sultat) ; chaque rÃ©glage de S8, S9, S10 et S18 visible et annulable depuis Â« Ton plan Â» ; tests
  verts.

#### S29 â Mon usine, arbre, vocabulaire (M11, M12, F1 Ã  F5)

- Mon usine en deux onglets : Â« Ma partie Â» (recherches, machines spÃ©ciales, ressources et parcelle,
  production en place, transfÃ©rer) et Â« Ma recherche Â» (S20, S21). Le champ des RP montre le dernier
  relevÃ©, l'estimation Ã  cÃ´tÃ©.
- Arbre : option Â« bulle Â» pour dÃ©bloquer prÃ¨s de la recherche (comme l'Ã©diteur de bÃ¢timents), pas
  par dÃ©faut.
- Vocabulaire du tableau 8 de la maquette : plus aucun id interne Ã  l'Ã©cran (test qui le cherche),
  plus de rÃ©fÃ©rences du projet (RP-04, MOD-09, Â« Ã  m'envoyer Â»), mÃªmes unitÃ©s partout, un seul nombre
  pour une mÃªme chose (RP manquants, recherches comptÃ©es).
- CritÃ¨re de fin : Mon usine sous 2 000 px au tÃ©lÃ©phone par onglet ; test Â« aucun id Ã  l'Ã©cran Â» ;
  tests verts.

### S16 â Plan : le site en anglais, et une forme prÃ©sentable Ã  la communautÃ©

Retour : R11. **Ce lot Ã©crit un plan, il ne code rien** (une maquette si elle aide Ã  dÃ©cider).

Le but : pouvoir donner le lien au serveur Discord du jeu sans avoir honte. Le site doit Ãªtre
clair pour un joueur qui ne connaÃ®t pas le projet, complet, et sans erreur visible.

Ce qui existe :
- Tout le texte est en franÃ§ais, Ã©crit en dur dans `src/ui/*.ts` et `index.html`, sans couche de
  traduction.
- Les noms des objets et des machines sont dÃ©jÃ  en anglais (ceux du jeu).
- La revue S15 aura listÃ© les dÃ©fauts vus par un joueur.
- REFONTE.md contient l'ancienne refonte de l'ergonomie.

Le lot doit produire un fichier `PLAN-PUBLIC.md` (nom Ã  confirmer) avec :
- **Un Ã©tat des lieux.** Faire le tour du site page par page, avec des captures, comme un nouveau
  venu. Noter le jargon, les doublons, les textes trop longs, les pages vides ou cassÃ©es, les
  incohÃ©rences de vocabulaire et de mise en page, le comportement au tÃ©lÃ©phone, et les erreurs
  visibles (valeurs Â« Ã  vÃ©rifier Â» mises en avant, messages techniques).
- **La traduction.**
  - MÃ©thode : un catalogue de textes par langue, sans nouvelle dÃ©pendance sauf accord.
  - Choix de la langue : bouton, langue du navigateur, mÃ©moire du choix.
  - Nombres, dates et unitÃ©s (MF/s, $, cases).
  - Textes venus des donnÃ©es (notes, dÃ©tails Â« Ã  vÃ©rifier Â», descriptions).
  - Adresses (`#objet`, `#recettes`â¦) : traduites ou non.
  - Ce qui reste en franÃ§ais, et un test qui vÃ©rifie qu'aucun texte n'est oubliÃ©.
- **L'accessibilitÃ© au sens large.** D'abord l'ergonomie : parcours d'un joueur, termes du jeu,
  valeurs par dÃ©faut, aides, messages d'erreur. Ensuite : clavier, lecteurs d'Ã©cran, contrastes,
  tailles de cible, tÃ©lÃ©phone. Chaque point a un critÃ¨re de rÃ©ussite vÃ©rifiable.
- **Ce qu'on montre ou cache dans la version publique** : outils de relevÃ©, Ã©diteur de bÃ¢timents,
  Â« DonnÃ©es Â», valeurs incertaines (signalÃ©es sobrement).
- **Les remarques des joueurs (R15)** : un bouton Â« Remarque Â» sur le site, une page rÃ©servÃ©e Ã 
  l'utilisateur pour lire, regrouper, rÃ©pondre et publier au choix ; le service Ã  ajouter sur le Pi
  (sans toucher Ã  MyPrism), le stockage, la modÃ©ration, l'anti-abus. Une fois en place, ajouter une
  Ã©tape Ã  la visite d'orientation (`src/ui/tour.ts`), comme le demande l'utilisateur (2026-10-20).
- **Le dÃ©coupage en lots** : des sessions courtes, dans l'ordre, chacune avec ses critÃ¨res de fin,
  Ã  ajouter au Â§ 2 aprÃ¨s validation.

Point de dÃ©part : la liste des dÃ©fauts de S15 ([REVUE.md](REVUE.md), Â§ 3) et ce qu'en ont corrigÃ©
S22 Ã  S29.

Questions : Q13, puis Q26 (remarques) et Q27 (accessibilitÃ©), posÃ©es le 2026-10-24 ; Q28 (maquette).

**Plan Ã©crit (2026-10-24) : [PLAN-PUBLIC.md](PLAN-PUBLIC.md)**, avec la maquette `maquette/public.html`
(Q28, validÃ©e : dÃ©cision S16 Maquette). En bref :
- **Ãtat des lieux** (Â§ 1) : les 27 dÃ©fauts de la revue sont rÃ©glÃ©s (S22 Ã  S29) ; il reste P1 Ã  P12 :
  tout le texte en dur (â 1 400 textes dans `src/ui`, 800 dans le moteur, notes des donnÃ©es), nom du
  site diffÃ©rent selon l'endroit, aperÃ§u Discord en franÃ§ais, pied de page sans auteur, deux contrastes
  trop faibles (bouton orange en sombre 2,4:1, â  de Recettes en clair 3,9:1), menu coupÃ© et cibles
  sous 24 px au tÃ©lÃ©phone, Recettes Ã  10 500 px au tÃ©lÃ©phone, Contribuer vide sans calcul, calcul long
  sans Â« ArrÃªter Â», restes F4 et P11 ; points du lecteur d'Ã©cran non vÃ©rifiÃ©s.
- **Traduction** (Â§ 2) : catalogues `src/i18n/fr.ts` et `en.ts` (type `typeof fr` : une clÃ© oubliÃ©e
  ne compile pas), `t()` avec `Intl.PluralRules`, langue du navigateur puis bouton FR / EN gardÃ©, mÃªmes
  adresses, `format.ts` seul Ã  Ã©crire nombres et dates ; moteur en codes et valeurs (empreintes de
  l'usine identiques) ; notes des donnÃ©es dans `data/i18n/en.json` ; noms du jeu en anglais dans les
  deux langues ; test Â« rien d'oubliÃ© Â» ; glossaire validÃ© avant S30.
- **Forme et accessibilitÃ©** (Â§ 3) : un critÃ¨re mesurable par point, contrÃ´lÃ© sur six pages Ã deux
  tailles Ã deux thÃ¨mes Ã deux langues.
- **Visiteurs** (Â§ 4) : tout visible, Contribuer prÃ©sentÃ© comme Â« Aider Ã  corriger le site Â» ;
  Propositions dans le pied de page ; tableau de bord sans lien (`/tableau/`).
- **Remarques** (Â§ 5) : bouton Â« ð¬ Remarque Â», Â« Envoyer ma correction Â», Â« Mes remarques Â», page
  Propositions avec +1, Ã©tape de la visite ; tableau de bord (boÃ®te, sujets, rÃ©ponse, publication,
  corrections en JSON, message dans le salon Discord) ; service `industrialist-remarques` (Node 24 du
  Pi, `node:http` + `node:sqlite`, 127.0.0.1:8091 derriÃ¨re le nginx de l'Industrialist, unitÃ© Ã  lui,
  64 Mo, MyPrism contrÃ´lÃ© avant et aprÃ¨s, nginx rechargÃ© aprÃ¨s accord).
- **Lots** (Â§ 6) : S30 Ã  S37, placÃ©s au Â§ 2 avec leurs critÃ¨res de fin ; le lien n'est postÃ© qu'aprÃ¨s
  S37.

### S17 â Plan : construire sa propre chaÃ®ne de production (bac Ã  sable)

Retour : R12 (premier jet de l'utilisateur, Â« encore incomplet Â»). **Ce lot Ã©crit un plan et une
maquette, il ne code pas la fonction.**

L'idÃ©e est l'inverse du calculateur. On part d'un plan vierge, on pose des machines et des tuyaux,
et le site donne les statistiques de ce qu'on a construit : dÃ©bits, goulots, Ã©nergie, prix, place
au sol, pollution.

Ce que l'utilisateur a dÃ©crit :
- un plan vierge ;
- des menus Â« burger Â» qui ouvrent la liste des machines ;
- des liaisons tracÃ©es Ã  la main : on garde le clic enfoncÃ© et on glisse avec l'outil tuyau, du bon
  type (fluide ou objet), pour Ã©tendre le chemin, comme les convoyeurs de **Mindustry**.

Ce qui existe et peut servir :
- le moteur de calcul (recettes, dÃ©bits, Ã©nergie) ;
- les plans de pose et le routage des tuyaux (`src/engine/build/`) ;
- les ports relevÃ©s (`data/ports.json`) et l'Ã©diteur de bÃ¢timents ;
- le dessin de l'usine (vue navigable) ;
- les recettes et les interfaces des machines (S10).

Le lot doit produire `PLAN-BAC-A-SABLE.md` (nom Ã  confirmer) et une maquette cliquable
(`maquette/bac-a-sable.html`) avec :
- **Une Ã©tude du modÃ¨le Mindustry**, sur sources publiques (wiki, vidÃ©os) : pose au glisser, sens
  automatique, coudes, croisements, rotation, suppression, annulation. Ce qu'on garde, et ce qui ne
  s'applique pas aux tuyaux d'Industrialist (types, raccords, longueur, rÃ¨gle des ports de sortie).
- **Les gestes** : poser, tourner, dÃ©placer, copier, effacer une machine ; tracer, prolonger, couper
  un tuyau ; zoomer, se dÃ©placer ; sur ordinateur et sur tÃ©lÃ©phone.
- **Le calcul d'un montage libre** :
  - la recette choisie par machine, avec son rÃ©glage d'interface ;
  - le dÃ©bit rÃ©el de chaque tuyau ;
  - la machine qui limite, ce qui manque ou dÃ©borde ;
  - les entrÃ©es et sorties du montage ;
  - l'Ã©nergie, le prix, la place au sol ;
  - le comportement face Ã  une liaison fausse (mauvais type, port de sortie, boucle).
- **Les ponts avec l'existant** : partir d'un plan calculÃ© pour le modifier Ã  la main ; enregistrer,
  exporter, partager un montage ; le comparer au plan conseillÃ©.
- **Le dÃ©coupage en lots**, du plus petit montage utile (deux machines et un tuyau, avec leurs
  statistiques) jusqu'Ã  l'ensemble, chaque lot avec ses critÃ¨res de fin.
- **Les risques** : performance, tÃ©lÃ©phone, quantitÃ© de code, ports manquants pour certaines
  machines.

Questions : Q14.

### S40 â Plan : refaire la recherche (R18)

Fait le 2026-10-27, sans code. Sources lues : comparaison Pollywrath (`b37d7de`, Â§ 4) et leur
`researchInfrastructure.ts`. Ils prennent bien les **items** en compte : RS2, RS3 et RS4 ont une
Â« valeur de recherche Â» (celle des items entrÃ©s) ; pour la RS3, multiplicateur d'argent
= logâ(v + 1) si v < 1, sinon logâ(v) + 1, avec v = prix de vente moyen Ã· 600 (Ã2 avec Â« RS4 buff Â»).
Ã confronter aux formules du wiki dÃ©jÃ  dans `data/research-stations.json` avant tout changement.

Ordre et critÃ¨re de fin de chaque lot :
- **S46 â Masquer** : l'onglet et l'objectif recherche affichent Â« en refonte Â» ; les donnÃ©es du
  joueur (relevÃ©s, journal S21) sont gardÃ©es. Fin : plus aucun chiffre de recherche affichÃ©, rien de
  perdu au rechargement ; tests verts ; dÃ©ployÃ©.
- **S47 â Maquette** (`maquette/recherche.html`) : saisie **par tier** (nombre de stations, items
  entrÃ©s par station ou par groupe identique, liquides des contrÃ´leurs, paraboles, circuits RS4),
  la recopie du panneau en contrÃ´le (Â« â comme en jeu Â» ou l'Ã©cart) ; bloc Â« RÃ©glages de partie Â»
  (pollution globale, mois, difficultÃ©), chaque valeur avec sa source (wiki ou Industrialist
  Calculator). Le niveau Â« dÃ©taillÃ© Â» de S20 n'est **pas** retirÃ© : les items restent indispensables
  (rÃ©ponse du 2026-10-27). Fin : maquette validÃ©e par l'utilisateur.
- **S48 â Moteur** : vitesse et plafond par tier avec les items, bonus RS4 sous le plafond, Satellite
  buff (paraboles = â(S Ã R) + S sans arrondi ; efficacitÃ© linÃ©aire, en attendant RP-03 ;
  bonus = 78 Ã logââ(R + 1) % Ã efficacitÃ©). Chaque rÃ¨gle prise chez Pollywrath faute de wiki est
  marquÃ©e Â« source : Industrialist Calculator Â» et notÃ©e dans `a-verifier.md`. Ãcart wiki / Pollywrath
  sur une mÃªme formule : on garde le wiki et on le note. Journal et temps de jeu (S21) rÃ©utilisÃ©s.
  Fin : tests qui refont la capture du 2026-10-18 et un cas de Pollywrath avec les mÃªmes entrÃ©es, au
  mÃªme rÃ©sultat (ou Ã©cart expliquÃ©) ; tests verts.
- **S49 â Interface** : Â« Ma recherche Â» et l'objectif recherche d'aprÃ¨s la maquette, recherche
  rÃ©affichÃ©e, FR et EN. Fin : un relevÃ© en jeu aprÃ¨s le seuil reste sous 2 % d'Ã©cart (critÃ¨re de
  S20 conservÃ©) ; parcours rÃ©el avec captures, ordinateur et tÃ©lÃ©phone ; dÃ©ployÃ©.
- **S50 â Pollution et mois** : rÃ©glages gardÃ©s avec la partie (pollution 10 par dÃ©faut, mois du jour
  par dÃ©faut). Pollution : pousse des arbres (facteur 1 + 0,005 p â 0,0001 pÂ², bornÃ© 0,5 Ã  1,2),
  Residue de l'ASU = borne(p/10 ; 1 ; 20), Tree Scrubber. Mois : Ã 1,5 bÃ»ches de l'Igloo Farm en
  dÃ©cembre, janvier et fÃ©vrier. Ces formules sont de Pollywrath : les chercher d'abord sur le wiki.
  Fin : changer la pollution ou le mois change les recettes concernÃ©es et le plan ; tests ; dÃ©ployÃ©.
- **S51 â DifficultÃ©** : rÃ©glage Normal / Hard / Impossible / Impossible2 / Sandbox / Sandbox+ ;
  recherches bloquÃ©es et machines rÃ©servÃ©es grisÃ©es, avec une phrase qui explique le rÃ©glage (il
  manque au site). Liste reprise de Pollywrath, contrÃ´lÃ©e sur le wiki. Fin : en Hard, Wind Turbine1
  et Hand Crank ne sont plus proposÃ©s ; tests ; dÃ©ployÃ©.

## 4. Questions

Ã poser au dÃ©but du lot concernÃ© ; les rÃ©ponses vont au Â§ 5.

- **Q1 (S1), plots.**
  - Je passe les 66 ports de bord relevÃ©s Ã  0, pour que le tuyau se colle au bÃ¢timent ?
  Oui
  - Y a-t-il des bÃ¢timents dont le raccord dÃ©passe vraiment ?
  Non

  DÃ©faut proposÃ© : tout Ã  0 -> oui, le champ reste pour une exception -> non.
- **Q2 (S4), Â« Afficher les liaisons Â».** Un vecteur entre chaque paire de piÃ¨ces reliÃ©es (comme
  l'onglet 3), sur tous les tuyaux, ou seulement sur ceux de la ressource survolÃ©e ou
  sÃ©lectionnÃ©e ? Avec les cÃ¢bles Ã©lectriques aussi ?
  Tout afficher avec une bouton pour activer l'affichage, les afficher lors de la sÃ©lÃ©ction du transporteur d'une ressource, avec les cÃ¢bles Ã©lectrique aussi(il y a dÃ©jÃ  les flÃ¨ches pour l'option "vers les machines", les rajouter de faÃ§on gÃ©nÃ©ral)
- **Q3 (S4), focus sur un module.** La vue du module en plein Ã©cran (comme un plan de pose, avec un
  retour), ou un panneau Ã  cÃ´tÃ© de l'usine ?
  Un panneau Ã  cÃ´tÃ© et dans le panneau la possibilitÃ© de le mettre en plein Ã©cran
- **Q4 (S5), place des Recettes.**
  - Une page Ã  part dans le menu (Â« Recettes Â», comme l'onglet du jeu), ou un onglet de
    Â« DonnÃ©es Â» Ã  cÃ´tÃ© de l'Ã©diteur de bÃ¢timents ?
    mets Ã§a dans son propre onglet, t'faÃ§on on pourra revoir l'interface plus tard car il y a pas que Ã§a Ã  voir mais l'ensemble de faÃ§on gÃ©nÃ©ral. Il faut que l'interface soit logique pour des joueurs, sauf que t'es pas joueur et t'as pas la faÃ§on de rÃ©flÃ©chir de ceux-ci donc forcÃ©ment tu sors un rÃ©sultat en fonction de ce que tu connais.
  - Les corrections : toujours visibles, ou derriÃ¨re un bouton Â« â Corriger Â» ?
  J'ai pas compris, je te dirais derriÃ¨re un bouton Â« â Corriger Â» 
- **Q5 (S10), interfaces.**
  - Qu'est-ce que c'est en jeu : un Ã©cran ou un panneau sur lequel on clique, une prise logique
    ou de donnÃ©es, autre chose ?
    Sur roblox on a la possibilitÃ© d'afficher des sorte d'Ã©tiquette avec lesquels on peut intÃ©ragir, Ã§a ne se manifeste pas concrÃ¨tement par un objet, un port, ou je ne sais quoi mais plutÃ´t comme j'ai dis par une Ã©tiquette flotante sur la machine qui nous propose en cliquant sur une touche d'ouvrir une interface, et c'est sur ces interfaces qu'il faut que tu te renseigne.
  - Sur quelles machines ?
  Il y en a pleins, les panneaux, les drapeau, le capteur de polution, le modeleur de plastique(qui ouvre pas une interface mais toggle une levier), et je ne sais encore combien (il y a aussi le carry, mais elle c'est directement sur la machine qu'on peut sÃ©lÃ©ctionner et pas par un bouton qui nous amÃ¨ne Ã  une interface). Donc comme tu le vois Ã§a varis beaucoup en fonction des usages
  - Que faut-il garder : la case devant libre, ou un passage pour le joueur jusqu'au bord ?
  Rien, Ã§a ne rentre que dans la config de la machine, pas dans son placement

  Une capture aiderait.
- **Q6 (S5), images des objets.** Nos donnÃ©es n'en ont aucune. Trois choix :
  - (a) pas d'image pour l'instant : une pastille de couleur avec les initiales ;
  Oui, aprÃ¨s jsp si tu peux les scraps sur le wiki car elles y sont en claire. C'est sans doute un gros taff de scrap donc t'embÃªte pas si c'est trop lourd pour le moment, mais tu peux rajouter un outil/option pour rajouter/modifier l'image d'un objet
  - (b) les icÃ´nes du wiki, ce qui demande de vÃ©rifier la licence et d'avoir ton accord pour les
    rÃ©cupÃ©rer ;
    Oui voilÃ  ce que j'ai dis plus haut
  - (c) tes captures.
  trop lourd Ã  mon avis mais faudra voir du coup

  DÃ©faut : (a).
- **Q7 (S8), nombre de machines.** Quand tu fixes une Ã©tape, les autres s'adaptent (recalculÃ©es).
  Si tu en fixes plusieurs, la plus contraignante dÃ©cide et les autres montrent leur capacitÃ©
  inutilisÃ©e. Est-ce que Ã§a te va ? - > Oui. La production existante reste-t-elle utilisÃ©e en prioritÃ© ? -> Si l'option est activÃ©e pour la prendre en compte oui
- **Q8 (S9), filtre de machines.**
  - RÃ©glage par plan (page de l'objectif) ou pour toute ta partie (Â« Mon usine Â») ?
  Par plan
  - En mode Â« seulement Â», les machines d'extraction (mines, pompes, arbres) restent-elles
    permises d'office ?
    Oui par defaut, mais laisser la possibilitÃ© de les exclure
- **Q9 (S11), machines modulaires.**
  - Par quoi commencer : moteur diesel (Tier II), ferme d'arbres (Tier I) ou turbine modulaire
    (Tier IV) ?
    T I, T II, T IV
  - Pour les valeurs absentes du wiki (portÃ©es, puissance par cylindreâ¦), es-tu d'accord pour des
    relevÃ©s en jeu ?
    C'est compliquÃ©, d'ailleurs la portÃ©e est circulaire. Essaie de te renseigner oÃ¹ tu peux sur internet pour avoir des infos
- **Q11 (S12), Ã©diteur des blocs modulaires.** Maquette `maquette/modulaires.html`.
  - La section Â« Ensemble modulaire Â» (chaÃ®ne, faces, portÃ©e dessinÃ©e) convient-elle ?
  - Â« Obligatoire Â» par face : ma lecture des wikis (tableau 2 bis de la maquette) est-elle juste ?
    Le premier vilebrequin d'une 2áµ ligne n'a rien derriÃ¨re lui : Â« derriÃ¨re obligatoire Â» pour la
    1Ê³áµ ligne seulement ?
  - Corrections derriÃ¨re Â« â Corriger Â», enregistrÃ©es dans le navigateur et exportÃ©es avec les
    relevÃ©s (clÃ© `modular`), comme l'interface en S10 ?
  - Un champ Â« Devant, sur la grille du relevÃ© Â» (inconnu par dÃ©faut), pour les plans de pose (S14) ?

  RÃ©ponses : maquette validÃ©e ; Â« les flywheel se placent comme les crankshaft mais sans caractÃ¨re
  obligatoire Â» ; corrections comme S10 ; champ Â« Devant Â» dÃ¨s S12.
- **Q12 (S13), calcul des modulaires.**
  - Ferme : l'Ã©tape Oak Log devient une ferme : arbres ; 1 arroseur pour 44 arbres ; 1 rÃ©servoir
    pour 3 arroseurs ; 1 rÃ©colteur pour 22 arbres (guide Miraheze, en attendant MOD-09) ; 1
    contrÃ´leur ; 1 sortie. Elle consomme de l'eau (33 L toutes les 33,33 s par arroseur) et de
    l'Ã©lectricitÃ© (200 kMF par arbre coupÃ©). Tout plan avec du bois change (pompes et Ã©nergie en
    plus). D'accord ?
  - Taille d'une ferme : 1 contrÃ´leur et 1 sortie par ferme, une seule ferme quel que soit le
    nombre d'arbres, jusqu'au plan de pose (S14) ? (La portÃ©e du contrÃ´leur touche au plus 776
    emplacements d'arbres, sans compter la place des autres blocs.)
  - Moteur diesel, sans formule (MOD-12) : seules les configurations relevÃ©es entrent dans le
    calcul. 6 cylindres, rapport 10 Ã  16 (tableau du contrÃ´leur), avec les blocs du montage simple,
    accÃ©lÃ©rateur supposÃ© Ã  100 % (la ligne 16 = montage simple Ã  100 %). 32 cylindres, rapport 14,
    accÃ©lÃ©rateur 59 % : 3 MMF/s, mais blocs autres que cylindres Â« Ã  relever Â» (MOD-14). Refined
    Diesel seulement ; pollution inconnue (MOD-15). Le 32 cylindres dans le calcul avec sa liste
    incomplÃ¨te, ou seulement affichÃ© ?
  - Turbine : hors du calcul (chaleur de la centrale non modÃ©lisÃ©e), marquÃ©e Â« non fiable Â» dans
    l'Ã©diteur et dans la liste des centrales non calculÃ©es ?
  - Maquette (texte) : une section Â« Calcul Â» sous Â« Ensemble modulaire Â» dans l'Ã©diteur de
    bÃ¢timents, et un bloc Â« Ferme d'arbres Â» dans le schÃ©ma.

  RÃ©ponse : Â« Oui Ã  tout Â» (22 arbres par rÃ©colteur, une seule ferme jusqu'Ã  S14, 32 cylindres
  dans le calcul avec sa liste incomplÃ¨te, turbine hors du calcul et non fiable, maquette validÃ©e).
- **Q13 (S16), version publique.** Ã poser au dÃ©but de S16.
  - Anglais seulement en plus du franÃ§ais, ou d'autres langues plus tard (le catalogue les prÃ©voit) ?
  - Langue par dÃ©faut : celle du navigateur ?
  - Que cacher aux visiteurs du Discord (Ã©diteur de bÃ¢timents, relevÃ©s, Â« DonnÃ©es Â») ?
  - Une adresse ou une page d'accueil Ã  part pour eux ?
  - Qui relit l'anglais : toi, un membre du Discord ?
  - Des sites que tu trouves bien faits (outils du jeu ou d'autres jeux) Ã  prendre comme rÃ©fÃ©rence ?

  PosÃ©e le 2026-10-24 en 9 points, avec une proposition pour chacun : 1 franÃ§ais et anglais, catalogue
  ouvert Ã  d'autres langues ; 2 langue du navigateur, bouton FR / EN dans l'en-tÃªte, choix gardÃ© ;
  3 mÃªmes adresses dans les deux langues ; 4 (b) Contribuer visible, prÃ©sentÃ© comme Â« Aider Ã  corriger
  le site Â» ; 5 pas de page Ã  part, aperÃ§u du lien sur Discord (titre, phrase, image) ; 6 nom
  Â« Industrialist Production Planner Â», pied de page Â« outil de fan, non officiel Â», crÃ©dits du wiki,
  pseudo ; 7 qui relit l'anglais ; 8 sites de rÃ©fÃ©rence ; 9 ce qui doit Ãªtre fini avant de poster le lien
  (proposÃ© : anglais, forme, bouton Â« Remarque Â» ; publication plus tard).

  RÃ©ponses (2026-10-24) : Â« je suis complÃ¨tement ok pour touuuut Â», avec : 6 Â« mon pseudo :
  Orangentleman Â» ; 7 Â« Moi, mais laisser la possibilitÃ© de signaler une erreur Â» ; 8
  Â« https://mindustryschematics.com Â» ; 9 Â« La page de publication et mon dashboard de reÃ§u des remarques
  et des propositions doit Ãªtre finis avant la publication Â».
- **Q26 (S16), remarques des joueurs (R15).** PosÃ©e le 2026-10-24 : 1 un joueur envoie un type (erreur de
  valeur, bogue, idÃ©e), un texte, la page (ajoutÃ©e seule), un pseudo Discord facultatif ; 2 une page
  rÃ©servÃ©e sur le site, protÃ©gÃ©e par un mot de passe, et peut-Ãªtre un message dans un salon de ton
  Discord (webhook sÃ©parÃ©, sans toucher Ã  MyPrism) ; 3 remarques rangÃ©es par sujet avec Â« N joueurs l'ont
  demandÃ© Â», page publique Â« Propositions Â» qui ne montre que ce que tu publies, avec +1 ; 4 un petit
  service Node sans dÃ©pendance (fichier ou SQLite intÃ©grÃ©e Ã  Node), compte et unitÃ© Ã  lui, derriÃ¨re le
  nginx de l'Industrialist (`/api/`), rechargement de nginx demandÃ© avant ; 5 au plus 5 remarques par
  heure et par visiteur, 2 000 caractÃ¨res, rien de public sans accord, IP jamais gardÃ©e en clair
  (empreinte effacÃ©e sous 24 h) ; 6 les corrections (Â« â Corriger Â») et les relevÃ©s de bÃ¢timents envoyÃ©s
  par le mÃªme service ; 7 une Ã©tape Â« remarques Â» dans la visite d'orientation.

  RÃ©ponses (2026-10-24) : tout Â« ok Â» ; 2 Â« Pour le discord j'ai fais un salon reservÃ© sur mon serv, le
  bot y a accÃ¨s Â» ; 6 Â« oui complÃ¨tement Â».
- **Q27 (S16), accessibilitÃ©.** PosÃ©e le 2026-10-24 : tout au clavier, contrastes suffisants, cibles d'au
  moins 24 px au tÃ©lÃ©phone, formulaires et boutons lisibles par un lecteur d'Ã©cran ; schÃ©ma et dessin de
  l'usine visuels, la liste des machines et les textes en sont la version lisible.

  RÃ©ponse (2026-10-24) : Â« ok Â».
- **Q28 (S16), maquette `maquette/public.html`.** PosÃ©e le 2026-10-24 : 1 en-tÃªte (nom, Â« Non officiel Â»,
  FR / EN, Â« ð¬ Remarque Â», Â« ? Â») et Â« Planificateur Industrialist Â» en franÃ§ais ; 2 aperÃ§u Discord en
  anglais, franÃ§ais en variante ; 3 fenÃªtre Remarque (quatre types, pseudo facultatif, Â« Mes remarques Â»,
  Â« Envoyer mes corrections Â») ; 4 Propositions : sujets publiÃ©s seulement, pas dans le menu ; 5 tableau
  de bord `/tableau/`, en franÃ§ais, mot de passe tapÃ© par l'utilisateur sur le Pi ; 6 Discord par un
  webhook du salon rÃ©servÃ© (le bot de MyPrism n'est pas touchÃ©) ; 7 glossaire et mots du jeu (case,
  parcelle, modes de construction) ; 8 ordre S30 â S37, S34 en parallÃ¨le possible.

  RÃ©ponse (2026-10-24) : Â« ok pour tout, je te laisse chercher les mots du jeu sur le wiki au dÃ©but de
  S30 Â».
- **Q29 (S30), glossaire et pÃ©rimÃ¨tre.** PosÃ©e le 2026-10-24 : mots du jeu trouvÃ©s sur le wiki (case â
  cell, parcelle â build area, outils Build / Wire / Pipe / Delete, pollution en %/h) ; pÃ©rimÃ¨tre de
  Planifier (formulaire et rÃ©ponse, onglets en S31) ; nom anglais dÃ¨s S30 ; Â« $950 Â» et Â« 2 d 4 h Â» en
  anglais ; site mÃ©langÃ© entre S30 et S31. RÃ©ponse : Â« ok pour tout Â» (dÃ©cision S30 Glossaire, Â§ 5).
- **Q14 (S17), bac Ã  sable.** PosÃ©e le 2026-10-26 en 10 points, avec une proposition chacun ; rÃ©ponses
  (dÃ©cision S17 Bac Ã  sable, Â§ 5) : Â« ok Â» pour 1, 2, 4, 7 et 10 ; 3 Â« Une machine dont les ports ne sont
  pas relevÃ©s ne peut pas Ãªtre posÃ©e Â» ; 5 Â« ok (mÃªme si je sais pas comment on peut concrÃ¨tement mesurer
  un montage "petit") Â» ; 6 panneau qui dÃ©file horizontalement au tÃ©lÃ©phone, machines Â« triÃ©es par
  chapitre et catÃ©gorie comme dans le jeu Â» ; 8 indication visuelle de la recette, calcul automatique
  pendant la pose sans ralentir, tuyaux qui montrent ce qu'ils transportent, recette dÃ©duite des
  liaisons, indicateur seulement si plusieurs recettes vont ; 9 Â« le tuyau qui dÃ©passe sa capacitÃ© doit
  changer de texture visuelle Â». Questions d'origine :
  - Ce qui compte le plus : les statistiques, ou un plan de pose fidÃ¨le au jeu (cases, raccords) ?
  - Grille du jeu (cases et tuyaux rÃ©els) ou schÃ©ma libre ?
  - Les machines gardent-elles leur taille et leurs ports relevÃ©s ?
  - Faut-il pouvoir partir d'un plan calculÃ© ?
  - Partager un montage : par un lien, par un fichier ?
  - Â« Burger Â» : un bouton qui ouvre un panneau latÃ©ral de machines, ou un menu au clic droit ?
  - De Mindustry, imiter le tracÃ© seulement, ou aussi l'aspect ?
- **Q15 (S14), plans de pose des modulaires.** Maquette `maquette/modulaires-pose.html` (dessins
  calculÃ©s avec les rÃ¨gles de `modular.json`).
  1. Moteur, montage simple : le wiki compte 8 vilebrequins mais 9 blocs de cÃ´tÃ© (carburant,
     6 cylindres, air, Ã©chappement). Sur l'image MDESetup, la rangÃ©e de cÃ´tÃ© dÃ©passe d'un bloc :
     (a) l'entrÃ©e de carburant contre le cÃ´tÃ© du contrÃ´leur, ou (b) l'Ã©chappement contre le cÃ´tÃ© du
     gÃ©nÃ©rateur ? (MOD-11)
  2. Un bloc de cÃ´tÃ© (2 Ã 2) par cÃ´tÃ© de vilebrequin, donc deux au plus par vilebrequin ?
  3. 32 cylindres : 18 vilebrequins, cylindres des deux cÃ´tÃ©s, une entrÃ©e d'air, un Ã©chappement,
     une entrÃ©e de carburant et un gÃ©nÃ©rateur en pointillÃ©s Â« Ã  relever Â» (MOD-14) ; les
     vilebrequins Â« dÃ©duits du plan Â» entrent dans la liste et le prix. Ou tout d'un cÃ´tÃ©
     (35 vilebrequins) ?
  4. Ferme : carrÃ©s de 7 Ã 7 emplacements autour de chaque arroseur, rÃ©colteurs dans les trous des
     coins, contrÃ´leur au plus prÃ¨s du centre, sorties et rÃ©servoirs lÃ  oÃ¹ les portÃ©es les touchent.
     Une ferme tient au plus 586 arbres ; au-delÃ , plusieurs fermes Ã©cartÃ©es (le cercle d'un
     contrÃ´leur ne touche aucun bloc de l'autre). D'accord ?
  5. Calcul : les blocs de la ferme suivent le plan (nombre de fermes donc de contrÃ´leurs,
     rÃ©colteurs et sorties placÃ©s) dans la liste de construction, le prix et Â« Comment c'est
     calculÃ© Â» ? Arroseurs et rÃ©servoirs restent au plus juste.
  6. Â« Toute l'usine Â» : la place rÃ©servÃ©e (12 Ã 12 cases) prend la taille rÃ©elle de la ferme et des
     moteurs, et un clic ouvre leur plan dans le panneau ? Les mesures de rÃ©fÃ©rence changent pour les
     plans avec du bois (Crankshaft : environ 61 arbres).
  7. As-tu relevÃ© le bord Â« devant Â» des blocs du moteur (MOD-17) ou ses ports (MOD-10) ? Sinon le
     plan dit Â« Ã  relever Â».

  RÃ©ponses (2026-10-18) : 1 (a), Â« mais j'espÃ©rais un calculateur qui prend les stats de chaque
  bout du module pour faire la config la plus optimisÃ©e Â», et les moteurs de la maquette Ã©taient
  trop serrÃ©s pour mettre des cylindres des deux cÃ´tÃ©s ; 2 oui ; 3 des deux cÃ´tÃ©s ; 4 oui ; 5 Â« pas
  exactement Â» : la sortie est coincÃ©e entre plusieurs structures, il lui faut un passage pour
  Ã©vacuer les Oak Logs par tuyau, et il faut prendre en compte la portÃ©e des poteaux Ã©lectriques
  jusqu'au contrÃ´leur, donc la place des poteaux si ceux Ã  grande portÃ©e ne sont pas dÃ©bloquÃ©s ;
  6 oui ; 7 pas compris, et la configuration du moteur devrait se calculer selon le besoin et le
  carburant ; 8 l'Ã©diteur devrait relever les ports directement dans la grille, avec une case sur
  chaque face pour ce qu'elle accueille ; trop d'informations inutiles ; le champ Â« Devant Â» ne sert
  Ã  rien. Avec un export de relevÃ©s Ã  intÃ©grer.

  Suite (2026-10-18) : l'entrÃ©e de carburant peut aller n'importe oÃ¹ ; la Logic Item Pipe Valve a
  des ports objet (erreur de relevÃ©) ; l'entrÃ©e d'air n'a aucun port (le port relevÃ© Ã©tait celui de
  la Diesel Engine Fuel Input, en fluide). Moteur : Â« base-toi sur les stats du tableau Â» ; le
  carburant change la consommation, pas la puissance ; tout se rÃ¨gle dans le panneau du contrÃ´leur,
  selon les blocs de l'ensemble. Oui au choix parmi les configurations relevÃ©es, oui au relevÃ© de
  configuration dans l'Ã©diteur, d'accord pour une formule plus tard (Ã  la demande). La longueur
  (nombre de vilebrequins) ne change pas la puissance. Ferme : compris juste ; les poteaux HV ne
  s'utilisent pas directement (il faut un transformateur).
- **Q16 (S18), moteur diesel.** Maquette `maquette/moteur-diesel.html`.
  1. Autres carburants (Crude, Poor Quality, Diesel) : aucune consommation Ã©crite nulle part. Une
     configuration n'est proposÃ©e avec un carburant que si elle a Ã©tÃ© relevÃ©e avec lui. Ou bien un
     seul relevÃ© (mÃªme moteur, autre carburant) donne un rapport appliquÃ© Ã  toutes les
     configurations, marquÃ© Â« dÃ©duit Â» ?
  2. L'Info Panel : sa consommation est-elle la vraie (le Fandom dit de la multiplier par le
     rapport air/carburant) ? Le relevÃ© note ce que l'Ã©cran affiche ; dis-moi si c'est Ã  corriger.
  3. Le tableau du wiki Ã  6 cylindres : on garde Â« accÃ©lÃ©rateur supposÃ© 100 % Â» ?
  4. Choix du calcul parmi les configurations : par dÃ©faut le moins de carburant par MF (le
     32 cylindres gagne : 0,031 L par MMF contre 0,064 au mieux pour 6 cylindres), avec Â« le moins
     cher Â», Â« le moins de place Â» ou une configuration imposÃ©e au choix, par plan ?
  5. Le relevÃ© compte aussi les blocs (entrÃ©es d'air, Ã©chappements, entrÃ©es de carburant,
     gÃ©nÃ©rateurs, volants) : le plan de pose et le prix prennent ces nombres (MOD-14) ?
  6. Maquette : relevÃ© et tableau des configurations dans l'Ã©diteur (Diesel Engine Controller),
     choix et Â« â Panneau du contrÃ´leur : rapport â¦ accÃ©lÃ©rateur â¦ Â» dans le schÃ©ma, la liste, le
     plan de pose et Â« Comment c'est calculÃ© Â». D'accord ?

  RÃ©ponses (2026-10-18) : 1 Â« a Â» ; 2 Â« De ce que je vois sur l'Ã©cran c'est la vrai conso qui est
  indiquÃ©e Â» ; 3 Â« Oui, mais indiquer la supposition Â» ; 4 Â« Meilleur rapport
  production/consommation (par dÃ©faut) Â», Â« moins de place Â», Â« meilleure production Ã©nergÃ©tique Â» ;
  5 Â« On prend en compte chaque type de blocs ! C'est le principe que je veux justement intÃ©grer au
  calculateur ! Â» ; 6 Â« oui Â».
- **Q17 (S20), vitesse des RP.** PosÃ©e le 2026-10-18, aprÃ¨s la recherche.
  1. Place du lot : entre S19 et S15 (proposÃ© : la revue S15 verra alors la recherche finie), ou
     ailleurs ?
     RÃ©ponse (2026-10-19) : Â« Place S20 entre S19 et S15. Â» Les points 2 Ã  4 restent Ã  poser au
     dÃ©but du lot.
  2. Saisie : les deux niveaux (Â« rapide Â» : recopier le panneau ; Â« dÃ©taillÃ© Â» : stations, items,
     liquides, recalculÃ©s et comparÃ©s au panneau), ou un seul ?
  3. Tant que RP-05 (plusieurs tiers) n'a pas de rÃ©ponse : un seuil par tier, appliquÃ© aux RP/s de ce
     tier (ce que suggÃ¨re le panneau), marquÃ© Â« supposÃ© Â» ?
  4. RelevÃ©s RP-01 Ã  RP-08 (RELEVES.md, Â« Points de recherche Â») : avant le lot, ou pendant ?

  RÃ©ponses (2026-10-19, dÃ©but de S20) : 2 Â« les deux niveaux Â» (rapide par dÃ©faut, dÃ©taillÃ© Ã 
  cÃ´tÃ©) ; 3 Â« oui, un seuil par tier Â», appliquÃ© aux RP/s de ce tier et marquÃ© Â« supposÃ© Â» jusqu'Ã 
  RP-05 ; 4 Â« pendant Â» : le lot part des suppositions (deux Crankshaft, liquide de valeur 0,1) et
  intÃ¨gre les relevÃ©s quand ils arrivent.
- **Q18 (S19), Ã©diteur simplifiÃ©.** Maquette `maquette/editeur-simplifie.html` (inventaire de ce
  que l'Ã©diteur affiche, avec pour chaque Ã©lÃ©ment : garder, dÃ©placer dans la grille, replier ou
  retirer). Aucun changement de fichier : `ports.json` et l'export restent les mÃªmes.
  1. Faces dans le dessin : devant en haut, derriÃ¨re en bas, cÃ´tÃ©s Ã  gauche et Ã  droite, les deux
     cÃ´tÃ©s liÃ©s (comme les donnÃ©es) ; ou gauche et droite rÃ©glables Ã  part ?
  2. Un seul Â« Enregistrer Â» pour le relevÃ©, la correction du bloc et l'interface (au lieu de trois) ?
  3. Poser un port : outils gardÃ©s au-dessus de la grille, bulle au clic sur un port ; ou sans
     outils, une bulle au clic sur une case vide (type et sens choisis dedans) ?
  4. Bloc Â« Calcul Â» de la ferme (S13) dans l'Ã©diteur : repliÃ©, ou retirÃ© ?
  5. Retraits proposÃ©s : chaÃ®ne de l'ensemble, lÃ©gende, Â« ContrÃ´le Â» de la portÃ©e, champ Â« Ce que le
     jeu affiche Â», taille du wiki quand elle est identique ; sources au survol. Un de ces Ã©lÃ©ments
     sert-il ?

  RÃ©ponses (2026-10-19) : 1 Â« garder les deux avec les mÃªmes propriÃ©tÃ©s Â» (le fonctionnement du
  Crankshaft Sideways n'est pas clair) ; la structure gÃ¨re les deux cÃ´tÃ©s Ã  part, mais ils sont
  fusionnÃ©s par dÃ©faut, et une option les sÃ©pare ; 2 Â« okay Â» ; 3 Â« les deux Â» : le mode outils par
  dÃ©faut, le mode bulle derriÃ¨re une option Ã  nommer ; 4 Â« oui Â» (repliÃ©, le dÃ©faut proposÃ©) ; 5 tout
  retirer (Â« Ce que le jeu affiche Â» servait parfois Ã  dire qu'un poteau est en hauteur, ce que le
  calcul n'utilise pas).
- **Q19 (S20), maquette Â« Ma recherche Â».** Maquette `maquette/recherche-rp.html` (nombres de la
  capture du 2026-10-18, recalculÃ©s avec les formules du wiki, 2 h aprÃ¨s la saisie).
  1. Les champs RP et RP/s passent de Â« Ressources Â» Ã  Â« Ma recherche Â» ?
  2. Les quatre tiers toujours affichÃ©s (lignes vides en gris), ou Â« + Ajouter un tier Â» ?
  3. Tableau des soldes (seuil, 100 000, 2 Ã seuil, Max RP), ou seulement Â« seuil atteint dans â¦ Â» ?
  4. Objectif recherche : une colonne Â« + N stations aux tiennes Â» dans la chronologie et un bloc qui
     la dÃ©taille, ou le bloc seulement ?
  5. Paraboles : efficacitÃ© recopiÃ©e du panneau, bonus comptÃ© au prorata (supposÃ©) ?

  RÃ©ponse (2026-10-20) : Â« Oui Ã  tout Â» (avec, en complÃ©ment, le texte de la page Research System
  du wiki, reportÃ© dans `a-verifier.md`).
- **Q20 (S21), historique des RP.** PosÃ©e le 2026-10-20, aprÃ¨s S20.
  1. Place du lot : avant ou aprÃ¨s S15 ?
  2. Le graphique : dans Â« Ma recherche Â» (Mon usine) ou sur une page Ã  part ?
  3. Les changements de configuration : notÃ©s automatiquement, ou seulement sur Â« Noter ce changement Â» ?

  RÃ©ponses (2026-10-20) : 1 Â« avant S15 Â» ; 2 Â« dans Ma recherche, un peu plus bas Â» ; 3
  Â« enregistrement automatique Â», et **deux courbes** : l'Ã©volution des RP et celle des RP/s.
- **Q21 (S21), Ã  poser au dÃ©but du lot.**
  1. La capture du 2026-10-18 comme premier point : Ã  quelle heure l'as-tu prise (mÃªme approximative) ?
  2. PÃ©riode affichÃ©e par dÃ©faut : 24 h, 7 jours ou tout l'historique ?
  3. Frappes rapprochÃ©es : fondues en un seul Ã©vÃ©nement si elles ont moins de 2 minutes d'Ã©cart ?
  4. Taille du journal : garder tout, ou seulement les 90 derniers jours ?

  RÃ©ponses (2026-10-20) : 1 l'heure ne compte pas : Â« le gain n'est fait que quand on est connectÃ© sur
  le jeu Â», il faut pouvoir activer et dÃ©sactiver les gains Ã  tout moment, et l'on parle de Ît (pÃ©riodes
  de jeu), pas de temps continu ; 2 Â« par dÃ©faut 24 h Â» ; 3 Â« oui Â» ; 4 90 jours (Â« la plupart des joueurs
  n'ont mÃªme pas autant d'heures de jeu Â» : la sauvegarde suit le temps d'activitÃ© en jeu).
- **Q22 (S21), maquette `maquette/historique-rp.html`.** PosÃ©e le 2026-10-20, au dÃ©but du lot.
  1. Site fermÃ© pendant Â« Je joue Â» : Ã  la rÃ©ouverture, demander Â« J'ai arrÃªtÃ© Ã  la fermeture du site Â» /
     Â« Je joue toujours : compter â¦ Â», et compter Â« arrÃªtÃ© Ã  la fermeture Â» tant qu'il n'y a pas de rÃ©ponse ?
  2. Passage au temps de jeu : le site repart du dernier relevÃ© tel que saisi, hors jeu ; l'estimation en
     temps rÃ©el est abandonnÃ©e. D'accord ?
  3. Journal visible (repliÃ© sous les graphiques), avec â pour retirer un Ã©vÃ©nement faux ?
  4. Axe du temps : en heures de jeu avant maintenant (Â« â20 h â¦ maint. â¦ +6 h Â») ou depuis le premier point ?
  5. Le reste de la maquette (interrupteur dans Â« Ma recherche Â» et l'en-tÃªte, deux graphiques, repÃ¨res
     numÃ©rotÃ©s, bleu = prÃ©vu, orange = relevÃ©) ?

  RÃ©ponses (2026-10-20) : 1 Â« oui Â» ; 2 Â« okay Â» ; 3 repliÃ© par dÃ©faut, Â« difficile Ã  lire Â» : la plus grande
  partie de la lecture doit se faire **en interagissant directement avec le graphique** ; 4 en heures de jeu,
  comme la maquette (avant maintenant) ; 5 Â« oui Â».
- **Q23 (S15), parcours de joueur.** PosÃ©e le 2026-10-20, aprÃ¨s le tour du site (inventaire dans
  [REVUE.md](REVUE.md)).
  1. Parcours proposÃ©s : A Â« je viens d'arriver sur le site Â», B Â« je veux 60 Crankshaft/min avec ce que
     j'ai dÃ©bloquÃ©, et je le construis Â», C Â« quand aurai-je assez de RP pour dÃ©bloquer X ? Â», D Â« je pose
     un module en jeu d'aprÃ¨s le plan de pose Â», E Â« une valeur du site ne correspond pas au jeu Â». Lesquels,
     dans quel ordre ? Un autre Ã  la place ?
  2. Qui tient la souris : toi sur le site en ligne avec ta vraie partie (tu me racontes), ou moi dans le
     navigateur intÃ©grÃ© pendant que tu me guides ?
  3. Pour chaque parcours, je note tes rÃ©actions mot pour mot, le nombre de gestes et ce qui bloque.
     D'accord ?

  RÃ©ponses (2026-10-20, transmises par la session gestionnaire) : 1 Â« ils sont tous assez correcte, il y
  aura le nouveau parcours de la session d'aprÃ¨s donc voilÃ  Â» (A Ã  E retenus, dans l'ordre ; le parcours de
  la session suivante n'est pas pour S15) ; 2 Â« (b) Â» (je tiens la souris dans le navigateur intÃ©grÃ©, tu me
  guides) ; 3 Â« ok Â».
- **Q24 (S15), maquette `maquette/revue.html`.** PosÃ©e le 2026-10-20, aprÃ¨s les cinq parcours (notes et
  liste des dÃ©fauts dans [REVUE.md](REVUE.md)). Les douze questions sont au bas de la maquette : menu,
  page d'arrivÃ©e vide, ordre des chiffres, barre Â« Ton plan Â», onglet ouvert en premier, tuyaux sans
  destination, ordre de pose, barre du bloc, durÃ©e dans l'arbre, Mon usine en deux onglets,
  vocabulaire, place de R15.

  RÃ©ponse (2026-10-20) : Â« En soi j'aime bien l'idÃ©e d'une accueil, mais plutÃ´t que d'en faire un onglet,
  plutÃ´t en faire un modal qui s'affiche Ã  la premiÃ¨re arrivÃ© sur le site et qui faire un tuto pour bien
  s'orienter sur le site. Le tuto doit Ãªtre destiner Ã  un utilisateur joueur d'Industrialist. C'est pas
  vraiment un tuto, mais vraiment une explication de comment s'orienter sur le site. Si tu veux on avait
  dÃ©jÃ  fait ce genre de chose sur ma philosophie web page. Ã part Ã§a tout me va. Â»
- **Q25 (S24), maquette `maquette/orientation.html`.** PosÃ©e le 2026-10-20. ModÃ¨le donnÃ© par l'utilisateur :
  la visite guidÃ©e de son site de philosophie (`js/08-visite-guidee.js` : voile, projecteur, bulle,
  l'essentiel puis le dÃ©tail, bouton Â« ? Â») ; Â« c'est juste de quoi t'inspirer [â¦] j'hÃ©site encore Ã  faire
  suivre le texte descriptif avec le focus Â». Questions au bas de la maquette : bulle qui suit le projecteur
  ou fixe en bas ; contenu (7 Ã©tapes + dÃ©tail) ; ton ; quand elle s'ouvre et le clic dans le sombre ;
  tÃ©lÃ©phone.

  RÃ©ponse (2026-10-20) : Â« Bulle fixe, et pour la visite dÃ©taillÃ©e, pense Ã  rentrer dans les autres onglets,
  j'aurais aimÃ© que tu montre au minimum le graphe et un plan d'une usine complÃ¨te histoire qu'on voit
  vraiment le potentiel du site. Mais sinon c'est bien Â».
- **Q10, ordre.** L'ordre du Â§ 2 te convient-il ?
  Oui vas-y, propose moi le lancement des diffÃ©rentes sessions et comporte toi comme gestionnaire des sessions

## 5. DÃ©cisions

Les rÃ©ponses dÃ©taillÃ©es de l'utilisateur sont aussi au Â§ 4, sous chaque question.

| Question | RÃ©ponse | Date |
| --- | --- | --- |
| Q1 Plots | Aucun port ne dÃ©passe : le plot est supprimÃ© partout (champ retirÃ©, pas d'exception). | 2026-10-16 |
| Q2 Liaisons | Un bouton affiche toutes les liaisons ; sinon, celles d'une ressource quand on sÃ©lectionne son tuyau ; cÃ¢bles Ã©lectriques aussi, flÃ¨ches gÃ©nÃ©ralisÃ©es. | 2026-10-16 |
| Q3 Focus | Un panneau Ã  cÃ´tÃ© de l'usine, qu'on peut mettre en plein Ã©cran ; les machines du module sont cliquables vers leur fiche. | 2026-10-16 |
| Q4 Recettes | Dans leur propre onglet du menu ; corrections derriÃ¨re Â« â Corriger Â». L'interface d'ensemble sera revue plus tard (S15). | 2026-10-16 |
| Q5 Interfaces | Ãtiquette flottante Â« [E] Interact Â» qui ouvre un rÃ©glage (fenÃªtre, levier, choix direct) ; rien pour le placement, seulement la configuration ; se renseigner sur chaque interface. | 2026-10-16 |
| Q6 Images | Pastille par dÃ©faut ; outil pour ajouter ou changer l'image d'un objet ; rÃ©cupÃ©rer celles du wiki si ce n'est pas trop lourd (accord avant tout tÃ©lÃ©chargement). | 2026-10-16 |
| Q7 Machines | D'accord ; production existante utilisÃ©e seulement si son option est activÃ©e. | 2026-10-16 |
| Q8 Filtre | Par plan ; en mode Â« seulement Â», extraction permise par dÃ©faut mais excluable. | 2026-10-16 |
| Q9 Modulaires | Ordre Tier I, Tier II, Tier IV ; chercher partout sur Internet ; la portÃ©e est circulaire. | 2026-10-16 |
| Q10 Ordre | Oui ; je joue le rÃ´le de gestionnaire des sessions (Â§ 7). | 2026-10-16 |
| S4 Panneau | Le panneau du module s'ouvre Ã  droite de l'usine (sous l'usine sur un Ã©cran Ã©troit), avec â Retour, â¶ Plein Ã©cran et â ; adresse `#objet/pose/usine-entiere/<Ã©tape>`. | 2026-10-16 |
| S4 CÃ¢bles | Â« Afficher les liaisons Â» Ã©teint : les cÃ¢bles entre poteaux gardent leur flÃ¨che (comme avant) ; le bouton ajoute les flÃ¨ches de tous les tuyaux, des cÃ¢bles d'un mÃªme module et des cÃ¢bles vers chaque machine. | 2026-10-16 |
| S4 Calcul | Â« RecalculÃ© pour l'usine entiÃ¨re Â» reste le calcul par dÃ©faut ; Â« module par module Â» au choix, calculÃ© Ã  la demande. | 2026-10-16 |
| S4 Machines | Demande en cours de lot : dans la vue complÃ¨te, une liste repliable des machines incomplÃ¨tes dans le plan de pose (comme Â« Liaisons Â» et Â« Passages Â»). | 2026-10-16 |
| S5 Maquette | Tuiles comme en jeu **et** un affichage en lignes triable (nom, valeur, RP rapportÃ©s) ; l'objet ouvert doit rester visible dans la liste ; un â  doit mener directement Ã  la zone de correction, pas seulement signaler le doute. | 2026-10-17 |
| S5 Images | Oui aux vignettes du wiki : 312 vignettes de 96 px (Miraheze, CC BY-NC-SA 4.0, source citÃ©e), 4,7 Mo ; la pastille reste quand une image manque. | 2026-10-17 |
| S6 Maquette | ValidÃ©e (`maquette/recettes-corriger.html`) : Â« â Corriger Â» met la fiche en mode correction (valeurs modifiables sur place, â Modifier et â N'existe pas en jeu sur chaque craft, + Ajouter un craft manquant, objet manquant). | 2026-10-17 |
| S6 â  | Sur la page Recettes, un â  ouvre le mode Corriger sur la valeur, le doute affichÃ© Ã  cÃ´tÃ© ; notes et valeurs des wikis restent dans DonnÃ©es (lien). | 2026-10-17 |
| S6 Retrait | Un craft Â« n'existe pas en jeu Â» reste sur la fiche, barrÃ©, avec âº RÃ©tablir ; il ne compte plus dans les calculs. | 2026-10-17 |
| S6 Remplacer | EntrÃ©e manquante ou en trop : Â« Remplacer par un craft corrigÃ© Â» retire l'ancien et ouvre l'ajout prÃ©-rempli. | 2026-10-17 |
| S7 Maquette | ValidÃ©e (`maquette/schema-calcul.html`) : panneau Â« Comment c'est calculÃ© Â» sous la barre du bas du schÃ©ma ; ligne du craft et Â« Voir dans Recettes â¸ Â» ; tableau intitulÃ© / calcul / rÃ©sultat / source ; flÃ¨che : besoin de l'arrivÃ©e Ã part du dÃ©part ; une phrase pour chaque cas particulier. | 2026-10-17 |
| S8 PortÃ©e | Des machines fixÃ©es dans le schÃ©ma changent tout le plan (liste de construction, plans de pose, dÃ©tails, usine entiÃ¨re), pas seulement le schÃ©ma. | 2026-10-17 |
| S8 MÃ©moire | Le rÃ©glage est gardÃ© au rechargement ; changer d'objet ou d'objectif l'annule. | 2026-10-17 |
| S8 Blocs | RÃ©glables : machines et arbres. Non rÃ©glables : installations composÃ©es, production dÃ©jÃ  en place, objectif recherche. | 2026-10-17 |
| S9 Maquette | ValidÃ©e (`maquette/filtre-machines.html`) : ligne Â« Machines Â» repliÃ©e sous Â« PrioritÃ©s Â» (Toutes / Toutes saufâ¦ / Seulementâ¦), recherche, machines du plan en raccourcis ; message Â« Aucune machine permise ne fabrique X Â» avec Â« Permettre â¦ Â» ; Â« Ne plus utiliser â¦ Â» dans la barre du bas du schÃ©ma. | 2026-10-17 |
| S9 MÃ©moire | Un filtre par plan : chaque objet (et les objectifs Ã©nergie et argent) garde le sien. | 2026-10-17 |
| S9 PortÃ©e | Les gÃ©nÃ©rateurs suivent le filtre ; les dÃ©pÃ´ts de vente restent toujours permis. L'extraction = catÃ©gorie Â« Extractors Â» du wiki et les arbres. Pas de filtre pour l'objectif RP. | 2026-10-17 |
| S9 Seulement | Passer en Â« Seulementâ¦ Â» part des machines du plan affichÃ©. | 2026-10-17 |
| S10 Chemical Plant | Ãcran intÃ©grÃ© au calcul dÃ¨s S10, rÃ©glable par plan : on saisit les trois multiplicateurs que l'Ã©cran affiche (Power Input, Resource Input, Resource Output), 1Ã par dÃ©faut. | 2026-10-17 |
| S10 Carry | Le Â« carry Â» est la Quarry : matÃ©riau choisi sur l'Ã©cran Ã  l'avant, Ã  la pose, dÃ©finitif (comme le wiki). | 2026-10-17 |
| S10 Levier | Le levier des mouleurs passe de Â« bottle Â» Ã  Â« container Â» (texte du jeu, relevÃ© de l'utilisateur). | 2026-10-17 |
| S10 Mouleur ind. | Industrial Plastic Molder : position Â« container Â» = Plastic Casing, ou Hardened Plastic Casing avec des Hardened Plastic Pellets. | 2026-10-17 |
| S12 Maquette | ValidÃ©e (`maquette/modulaires.html`) : section Â« Ensemble modulaire Â» dans l'Ã©diteur de bÃ¢timents (chaÃ®ne, faces avec Â« obligatoire Â» et blocs qui peuvent toucher, portÃ©e dessinÃ©e sur une grille d'arbres) ; repÃ¨re â¬¡ dans la liste. | 2026-10-18 |
| S12 Obligatoire | Lecture des wikis retenue (tableau 2 bis) ; le volant (Flywheel) se place comme un vilebrequin, dans la chaÃ®ne, sans face obligatoire ; Â« derriÃ¨re obligatoire Â» du vilebrequin reste Ã  confirmer pour une 2áµ ligne (MOD-11). | 2026-10-18 |
| S12 Corrections | DerriÃ¨re Â« â Corriger Â», gardÃ©es dans le navigateur, exportÃ©es avec les relevÃ©s (clÃ© `modular`), comme l'interface en S10. | 2026-10-18 |
| S12 Devant | Champ Â« Devant, sur la grille du relevÃ© Â» dÃ¨s S12, inconnu par dÃ©faut (MOD-17), pour les plans de pose (S14). | 2026-10-18 |
| S13 Ferme | L'Ã©tape Oak Log est une ferme : arbres, 1 arroseur / 44 arbres, 1 rÃ©servoir / 3 arroseurs, 1 rÃ©colteur / 22 arbres (guide, en attendant MOD-09), 1 contrÃ´leur, 1 sortie ; eau (33 L / 33,33 s par arroseur) et Ã©lectricitÃ© (200 kMF par arbre coupÃ©) comptÃ©es. Une seule ferme jusqu'Ã  S14. | 2026-10-18 |
| S13 Moteur | Seules les configurations relevÃ©es entrent dans le calcul : 6 cylindres rapport 10 Ã  16 (blocs du montage simple, accÃ©lÃ©rateur supposÃ© 100 %) et 32 cylindres rapport 14 Ã  59 %, avec sa liste de blocs incomplÃ¨te (Â« Ã  relever Â», MOD-14). Refined Diesel seulement. | 2026-10-18 |
| S13 Turbine | Hors du calcul, marquÃ©e Â« non fiable Â» (Ã©diteur, centrales non calculÃ©es). Maquette texte validÃ©e : section Â« Calcul Â» sous Â« Ensemble modulaire Â», bloc Â« Ferme d'arbres Â» dans le schÃ©ma. | 2026-10-18 |
| S14 Moteur | Montage simple : l'entrÃ©e de carburant contre le cÃ´tÃ© du contrÃ´leur (rÃ©ponse (a)) ; le contrÃ´leur porte aussi des blocs de cÃ´tÃ© (relevÃ© du 2026-10-18). Un bloc par cÃ´tÃ© de vilebrequin, des deux cÃ´tÃ©s ; 32 cylindres des deux cÃ´tÃ©s. Moteurs voisins Ã©cartÃ©s pour garder leurs deux cÃ´tÃ©s libres. | 2026-10-18 |
| S14 Devant | Le champ Â« Devant, sur la grille du relevÃ© Â» est retirÃ© : le sens d'un bloc ne pose jamais problÃ¨me (MOD-17 close ; l'entrÃ©e d'air se pose des deux cÃ´tÃ©s d'un vilebrequin). | 2026-10-18 |
| S14 Ferme | Disposition de la maquette validÃ©e (carrÃ©s de 7 Ã 7, rÃ©colteurs dans les trous, plusieurs fermes Ã©cartÃ©es au-delÃ  de la limite). Â« Toute l'usine Â» : place rÃ©elle de la ferme et des moteurs, clic â leur plan. Ã ajouter : un passage pour le tuyau de chaque sortie, et la place des poteaux qui alimentent le contrÃ´leur selon les poteaux dÃ©bloquÃ©s. | 2026-10-18 |
| S14 Longueur | La longueur du moteur ne change pas la puissance : le plan prend le moins de vilebrequins possible (blocs de cÃ´tÃ© des deux cÃ´tÃ©s, contrÃ´leur compris), et le calcul compte les blocs du plan (6 cylindres : 4 vilebrequins au lieu de 8). | 2026-10-18 |
| S14 Poteaux | Le contrÃ´leur est alimentÃ© par une chaÃ®ne de poteaux placÃ©s dans la ferme (place rÃ©servÃ©e), du bord jusqu'Ã  sa prise ; choix du poteau dans le plan (le moins cher qui porte la ferme par dÃ©faut). Le poteau HV n'est pas proposÃ© (il faut un transformateur). Chaque sortie et chaque rÃ©servoir garde un passage libre jusqu'au bord pour son tuyau. | 2026-10-18 |
| S14 Lots | Le choix de configuration du moteur (relevÃ©s de configuration, consommation selon le carburant, panneau du contrÃ´leur selon les blocs) devient le lot S18 ; l'Ã©diteur simplifiÃ© (ports dans la grille, une case par face) le lot S19. Une formule du moteur sera cherchÃ©e Ã  la demande, quand les relevÃ©s suffiront. | 2026-10-18 |
| S14 RelevÃ©s | Export du 2026-10-18 intÃ©grÃ© Ã  `data/ports.json` : 46 bÃ¢timents ajoutÃ©s (piÃ¨ces de tuyau, vannes, Plastic Refinery, Plastic Production Facility, Large Diesel Engine, Industrial Firebox, Cold Bypass Pipe, entrÃ©e d'air et contrÃ´leur du moteur), Steam Cracking Plant remplacÃ©e (relevÃ© plus rÃ©cent), Â« sans prise Â» confirmÃ© pour le Truck Depot, le petit silo et l'arroseur. | 2026-10-18 |
| S18 Moteur | Maquette validÃ©e (`maquette/moteur-diesel.html`). Une configuration n'est proposÃ©e avec un carburant que si elle a Ã©tÃ© relevÃ©e avec lui (pas de rapport dÃ©duit : formule seulement Ã  la demande). L'Info Panel affiche la vraie consommation : le relevÃ© la note telle quelle. Tableau Ã  6 cylindres : accÃ©lÃ©rateur supposÃ© 100 %, et la supposition s'affiche. | 2026-10-18 |
| S18 Choix | Trois critÃ¨res par plan : meilleur rapport production/consommation (par dÃ©faut, le moins de L par MMF), moins de place, meilleure production Ã©nergÃ©tique (la plus grande puissance par moteur) ; Â« le moins cher Â» retirÃ©. La liste Â« ou cette configurationâ¦ Â» de la maquette validÃ©e reste. | 2026-10-18 |
| S18 Blocs | Chaque type de bloc compte : le plan de pose et le prix prennent les nombres relevÃ©s (entrÃ©es d'air, Ã©chappements, entrÃ©es de carburant, gÃ©nÃ©rateurs, volantsâ¦). | 2026-10-18 |
| S19 Maquette | ValidÃ©e (`maquette/editeur-simplifie.html`) : une case par face autour de la grille (devant en haut, derriÃ¨re en bas, cÃ´tÃ©s Ã  gauche et Ã  droite, convention d'affichage), modifiÃ©e sur place ; bulle Ã  cÃ´tÃ© du port cliquÃ© ; un seul Â« Enregistrer Â» ; Interface, Capture, Remarques, Â« Ã savoir Â» et les blocs Â« Calcul Â» repliÃ©s (configurations du moteur ouvertes d'office sur le contrÃ´leur) ; portÃ©e de la ferme sur une ligne et Â« â¯ PortÃ©e Â» dessinÃ©e dans la grille. Fichiers inchangÃ©s (`ports.json`, export, import). | 2026-10-19 |
| S19 CÃ´tÃ©s | Les deux cÃ´tÃ©s suivent la mÃªme rÃ¨gle par dÃ©faut ; une option Â« CÃ´tÃ©s rÃ©glÃ©s Ã  part Â» les sÃ©pare (gauche et droite gardÃ©s Ã  part dans la correction, leur rÃ©union reste la face Â« cÃ´tÃ©s Â» des donnÃ©es). | 2026-10-19 |
| S19 Pose | Mode outils par dÃ©faut (outil puis clic dans la marge) ; option Â« Pose : Bulle Â» oÃ¹ un clic sur une case vide ouvre une bulle pour choisir le type et le sens. | 2026-10-19 |
| S19 Retraits | RetirÃ©s de l'Ã©cran : chaÃ®ne de l'ensemble, lÃ©gende, Â« ContrÃ´le Â» de la portÃ©e, champ Â« Ce que le jeu affiche Â» (gardÃ© dans les donnÃ©es et l'export), taille du wiki quand elle est identique ; sources au survol. | 2026-10-19 |
| S20 Place | Le lot S20 (vitesse rÃ©elle des RP) passe entre S19 et S15 ; les points 2 Ã  4 de Q17 se posent au dÃ©but du lot. | 2026-10-19 |
| S20 Saisie | Deux niveaux dans Â« Ma recherche Â» : rapide (recopier le panneau : RP/s et seuil de chaque tier, paraboles, Â« Max RP Â») et dÃ©taillÃ© (stations, items, liquides : le site recalcule le panneau et le compare). | 2026-10-19 |
| S20 Tiers | Un seuil par tier, appliquÃ© aux RP/s de ce tier, Ã©crit Â« supposÃ© Â» tant que RP-05 n'a pas de rÃ©ponse. | 2026-10-19 |
| S20 RelevÃ©s | RP-01 Ã  RP-08 pendant le lot : le code part des suppositions (deux Crankshaft par station, liquide de valeur 0,1), Ã©crites Â« supposÃ© Â». | 2026-10-19 |
| S21 Place | Nouveau lot S21 (historique des RP, R14) entre S20 et S15. | 2026-10-20 |
| S21 Graphiques | Dans Â« Ma recherche Â», un peu plus bas ; deux courbes (RP et RP/s) ; changements de configuration enregistrÃ©s automatiquement. | 2026-10-20 |
| S21 Temps de jeu | Les RP ne montent qu'en jeu (rÃ¨gle donnÃ©e par l'utilisateur) : interrupteur Â« Je joue / Je ne joue plus Â» Ã  tout moment ; estimations, graphiques et journal en temps de jeu (Ît), pas en temps continu. | 2026-10-20 |
| S21 Journal | PÃ©riode par dÃ©faut 24 h (de jeu) ; frappes Ã  moins de 2 min fondues ; 90 jours de temps de jeu gardÃ©s. | 2026-10-20 |
| S21 Maquette | ValidÃ©e (`maquette/historique-rp.html`, Q22) : interrupteur dans Â« Ma recherche Â» et bouton â¶/â¸ Ã  cÃ´tÃ© de la puce RP ; site fermÃ© pendant Â« Je joue Â» â question Ã  la rÃ©ouverture, Â« arrÃªtÃ© Ã  la fermeture Â» tant qu'il n'y a pas de rÃ©ponse ; le dernier relevÃ© devient le premier point, hors jeu ; axe en heures de jeu avant maintenant ; journal repliÃ© par dÃ©faut, l'essentiel se lit en touchant le graphique (â dans le journal) ; bleu = prÃ©vu, orange = relevÃ©. | 2026-10-20 |
| S20 Maquette | ValidÃ©e (`maquette/recherche-rp.html`) : RP et RP/s passent dans Â« Ma recherche Â» ; les quatre tiers toujours affichÃ©s ; tableau des soldes (seuil, 100 000, 2 Ã seuil, Max RP) ; colonne Â« + N stations aux tiennes Â» dans la chronologie et bloc qui la dÃ©taille ; efficacitÃ© des paraboles recopiÃ©e du panneau, bonus au prorata (supposÃ©). | 2026-10-20 |
| S15 Maquette | ValidÃ©e (`maquette/revue.html`, Q24) : menu Planifier Â· Arbre Â· Recettes Â· Mon usine Â· Contribuer ; Planifier vide (exemples en grisÃ©) pour les quatre objectifs ; chiffres place, machines, Ã©nergie, prix ; barre Â« Ton plan Â» ; onglets Usine (en premier, module par module), SchÃ©ma, Liste des machines, DÃ©tails ; Â« module posÃ© â Â» ; cÃ´tÃ© de sortie de ce qu'il faut Ã©vacuer ; ordre de pose dans le sens de l'usine et dans l'ordre du joueur, avec les touches ; â  cliquable ; durÃ©e Â« Ã  ton rythme Â» dans l'arbre ; Mon usine en deux onglets ; vocabulaire du tableau 8 ; R15 dans le plan de S16. | 2026-10-20 |
| S15 Accueil | Pas d'onglet Accueil : une **fenÃªtre d'orientation** Ã  la premiÃ¨re visite, pour un joueur d'Industrialist (Â« pas vraiment un tuto, mais vraiment une explication de comment s'orienter sur le site Â») ; modÃ¨le : la page Â« philosophie Â» d'un autre site de l'utilisateur (lien Ã  demander au dÃ©but du lot). | 2026-10-20 |
| S15 Lots | RÃ©organisation dÃ©coupÃ©e en S22 Ã  S29, placÃ©s avant S16 (Â§ 2). | 2026-10-20 |
| S24 Visite | Maquette validÃ©e (`maquette/orientation.html`, Q25) : bulle fixe en bas ; l'essentiel (8 Ã©tapes) Ã  la premiÃ¨re visite, puis la visite dÃ©taillÃ©e proposÃ©e, qui entre dans les vues (au minimum le schÃ©ma et l'usine complÃ¨te) ; bouton Â« ? Â» ; le reste comme la maquette. | 2026-10-20 |
| S25 Usine | Calcul module par module par dÃ©faut (rÃ©ponse au parcours A : Â« sur le mode module par module par dÃ©faut car Ã§a fait moins de calcul Â»), ce qui remplace la dÃ©cision S4 Â« recalculÃ© par dÃ©faut Â» pour les nouveaux joueurs. | 2026-10-20 |
| S15 PrioritÃ©s | PrioritÃ©s par dÃ©faut d'un objet : le moins de place, puis le moins de machines, puis le moins d'Ã©nergie, le prix en dernier (joueur avancÃ© : Â« ma prioritÃ© se concentre sur la place et le nombre de machine, et l'Ã©nergie Â»). Ã faire dans un lot de rÃ©organisation. | 2026-10-20 |
| S15 Parcours | Les cinq parcours A Ã  E, dans l'ordre ; Claude tient la souris dans le navigateur intÃ©grÃ©, l'utilisateur guide ; rÃ©actions notÃ©es mot pour mot, gestes et blocages. | 2026-10-20 |
| S29 Noms | Â« Water Pump2 Â», Â« Research Station4 Â», Â« Short Pipe2 Â»â¦ (chiffre collÃ©) : Â« Dans le jeu ya pas d'espace. Mais en soi c'est plus propre avec un espace donc fais au mieux Â» â le site affiche Â« Water Pump 2 Â» (comme l'arbre du jeu), les fichiers de donnÃ©es gardent le nom du wiki (`spacedName`, `buildGameData`). | 2026-10-24 |
| S16 Langues | FranÃ§ais et anglais ; catalogue de textes ouvert Ã  d'autres langues ; langue du navigateur par dÃ©faut (franÃ§ais si `fr-*`, sinon anglais), bouton FR / EN dans l'en-tÃªte, choix gardÃ© ; mÃªmes adresses (`#objet`â¦) dans les deux langues. | 2026-10-24 |
| S16 Relecture | L'utilisateur relit l'anglais ; un moyen de signaler une erreur de traduction reste ouvert aux joueurs (par les remarques). | 2026-10-24 |
| S16 Public | Contribuer reste visible, prÃ©sentÃ© comme Â« Aider Ã  corriger le site Â» ; mÃªme adresse pour le Discord, avec un aperÃ§u du lien (titre, phrase, image) ; nom anglais Â« Industrialist Production Planner Â» ; pied de page Â« outil de fan, non officiel Â», crÃ©dits du wiki (CC BY-NC-SA), Â« par Orangentleman Â». RÃ©fÃ©rence donnÃ©e : mindustryschematics.com. | 2026-10-24 |
| S16 Publication | Le lien n'est postÃ© sur le Discord qu'une fois finis : l'anglais, la forme, le bouton Â« Remarque Â», **le tableau de bord des remarques et propositions de l'utilisateur et la page publique Â« Propositions Â»**. | 2026-10-24 |
| S16 Remarques | Type (erreur de valeur, bogue, idÃ©e, traduction), texte, page ajoutÃ©e seule, pseudo Discord facultatif ; tableau de bord rÃ©servÃ© (mot de passe) ; remarques rangÃ©es par sujet (Â« N joueurs l'ont demandÃ© Â») ; page Â« Propositions Â» qui ne montre que ce que l'utilisateur publie, avec +1 ; service Node sans dÃ©pendance, compte et unitÃ© Ã  lui, derriÃ¨re le nginx de l'Industrialist (`/api/`), rechargement de nginx demandÃ© avant, MyPrism intouchÃ© ; 5 remarques par heure et par visiteur, 2 000 caractÃ¨res, empreinte d'IP effacÃ©e sous 24 h ; corrections et relevÃ©s de bÃ¢timents envoyÃ©s par le mÃªme service ; une Ã©tape Â« remarques Â» dans la visite. Discord : un salon rÃ©servÃ© existe sur le serveur de l'utilisateur, son bot y a accÃ¨s (moyen d'y Ã©crire Ã  confirmer au lot du service : webhook du salon, sans toucher au bot). | 2026-10-24 |
| S16 Maquette | ValidÃ©e (`maquette/public.html`, Q28, Â« ok pour tout Â») : Â« Industrialist Production Planner Â» / Â« Planificateur Industrialist Â», Â« Non officiel Â» Ã  cÃ´tÃ© du nom, FR / EN, Â« ð¬ Remarque Â» et Â« ? Â» dans l'en-tÃªte ; pied de page en trois lignes ; aperÃ§u Discord en anglais (fr_FR en variante) ; fenÃªtre Remarque (valeur fausse, bogue, idÃ©e, traduction ; pseudo facultatif ; Â« Mes remarques Â») et Â« Envoyer mes corrections Â» ; Propositions (`#propositions`) hors du menu ; tableau de bord `/tableau/` en franÃ§ais, mot de passe tapÃ© par l'utilisateur sur le Pi ; Discord par un **webhook du salon rÃ©servÃ©**, sans toucher au bot ; glossaire proposÃ©, mots du jeu (case, parcelle, modes de construction) Ã  chercher sur le wiki au dÃ©but de S30 ; ordre S30 â S37, S34 possible en parallÃ¨le. | 2026-10-24 |
| S30 Glossaire | ValidÃ© (Q29, Â« ok pour tout Â») : case â **cell** (le jeu compte la portÃ©e des poteaux en *tiles*, 1 tile = 2 cases, Building System : Â« cross 133 tiles Â») ; parcelle â **build area** (le wiki dit Â« world Â», jamais Â« plot Â» ni Â« land Â») ; outils **Build, Wire, Pipe, Delete** (Building System) ; pollution en **%/h** (page Pollution : Â« 8.64%/h Â») ; le reste comme l'Ã©cran 5 de la maquette. En S30 : formulaire et rÃ©ponse de Planifier ; contenu des onglets et autres pages en S31 ; nom anglais Â« Industrialist Production Planner Â» dÃ¨s S30, le franÃ§ais garde son nom jusqu'Ã  S33 ; Â« $950 Â», Â« $2.1M Â», Â« 2 d 4 h Â» en anglais ; site mÃ©langÃ© pour un navigateur anglais entre S30 et S31 (lien pas encore postÃ©). | 2026-10-24 |
| S31 Traduction | Prises dans le lot, sans question ouverte (rien ne demandait l'avis de l'utilisateur ; l'interface ne change pas, pas de maquette) : un catalogue par Ã©cran dans `src/i18n/vues/` (mÃªme typage que `fr.ts` / `en.ts`) ; textes du moteur et des donnÃ©es encore en franÃ§ais (S32) marquÃ©s `<span lang="fr">` (`frText`) ou isolÃ©s par U+2068 â¦ U+2069 dans un attribut (`frRaw`), mis de cÃ´tÃ© par le test ; saisie des nombres selon la langue (`parseNum` : en anglais la virgule sÃ©pare les milliers, Â« 1,5 Â» est refusÃ©) ; Â« X : Y Â», guillemets et Â« % Â» selon la langue (`colon`, `quote`, `fmtPct`) ; fichiers exportÃ©s et sources gardÃ©es avec une correction restent en franÃ§ais (PLAN-PUBLIC Â§ 2) ; textes fixes d'`index.html` des pages Mon usine, Arbre, Recettes, Contribuer balisÃ©s (oubliÃ©s par S30). | 2026-10-25 |
| S32 Traduction | Prises dans le lot, sans question ouverte (l'interface ne change pas, pas de maquette) : le moteur renvoie `{ code, valeurs }` (`src/engine/message.ts`), Ã©crit par `say()` / `txt()` (`src/ui/engine-text.ts`) avec le catalogue `src/i18n/vues/moteur.*.ts` ; les directions de l'ordre de pose sont des codes (N, E, S, W) que `turnMessage()` tourne avec le module ; le dictionnaire des notes `data/i18n/en.json` est rangÃ© par fichier puis par **texte franÃ§ais** (au lieu de l'identifiant et du champ : une note rÃ©pÃ©tÃ©e ne s'Ã©crit qu'une fois, et une note modifiÃ©e perd sa traduction et se voit Â« (FR) Â») ; les doutes Ã©crits par les scripts d'extraction sont traduits par des rÃ¨gles (`src/i18n/data-notes.ts`) ; pluriels franÃ§ais corrigÃ©s au passage (Â« 13 croisements Â» au lieu de Â« 13 croisement(s) Â») ; la consigne de l'onglet 3 est Ã©crite par le catalogue comme le site l'affichait (Â« en mode tuyaux (touche 3, Â« " Â» en AZERTY) Â»), sans AZERTY en anglais. | 2026-10-25 |
| S16 AccessibilitÃ© | Tout au clavier ; contrastes suffisants ; cibles d'au moins 24 px au tÃ©lÃ©phone ; formulaires et boutons lisibles par un lecteur d'Ã©cran ; schÃ©ma et usine restent visuels, la liste des machines et les textes en sont la version lisible. | 2026-10-24 |
| S33 Forme | Maquette `maquette/forme.html` validÃ©e (Â« la maquette me va Â», 2026-10-25) : en-tÃªte au tÃ©lÃ©phone en trois lignes (nom court, Â« Non officiel Â», FR / EN, ? ; menu entier ; mon usine) ; pied de page S16 en deux lignes (Fandom en CC BY-SA, crÃ©dit du calculateur de pousse des arbres gardÃ© ; ligne Remarque / Propositions en S35-S36) ; image d'aperÃ§u refaite en anglais (`scripts/og-image.html`, rendue par Chrome sans fenÃªtre) ; calcul long : temps Ã©coulÃ©, Â« â  ArrÃªter Â», Â« Calculer module par module (plus rapide) Â» ; Recettes par 48 sous 900 px ; titres de Planifier en questions (Â« Que veux-tu produire ? Â»â¦), noms courts gardÃ©s pour Â« Revenir Ã  Â» ; pollution : unitÃ© du jeu %/h gardÃ©e, bulle explicative. | 2026-10-25 |
| S35 Remarques | Maquette `maquette/remarques.html` validÃ©e (Â« ok pour tout Â», 2026-10-25) : Â« ð¤ Envoyer mes corrections Â» dans Contribuer et dans la barre Â« â Corriger Â» de Recettes, Â« ð¤ Envoyer mes relevÃ©s Â» dans l'Ã©diteur, qui ouvrent la fenÃªtre en type Â« Correction Â» avec le fichier de l'export joint ; Â« Mes remarques Â» avec Ã©tat, pastille de rÃ©ponse nouvelle et Â« Oublier Â» ; nÂ° court montrÃ©, numÃ©ro secret cachÃ© ; ð¬ sur la 1re ligne au tÃ©lÃ©phone, fenÃªtre en feuille ; Ã©tape 8 / 9 de la visite ; message Discord par un webhook que l'utilisateur crÃ©e et colle lui-mÃªme (`npm run remarques:discord`). Quand le site renvoie au Discord, c'est celui **du jeu** (https://discord.com/invite/SWERdzfdNF), en mentionnant **@orange** (corrigÃ© en S36 : le pseudo Discord est **@orangentleman**). | 2026-10-25 |
| S36 Remarques | Maquette `maquette/tableau.html` validÃ©e en deux tours (Â« Tout me va Â», 2026-10-25) : tableau de bord `/tableau/` en franÃ§ais seulement ; ouvrir une remarque nouvelle la marque Â« Lue Â», filtre Â« Ã traiter Â» par dÃ©faut ; Â« Enregistrer et crÃ©er un sujetâ¦ Â» pour une remarque sans sujet ; rÃ©ponse possible Ã  tous les joueurs d'un sujet ; textes publics d'un sujet (titre, description, rÃ©ponse) en franÃ§ais et en anglais, remplis par un bouton **ð Traduire automatiquement** (corrigeable), marquÃ©s Â« Traduit automatiquement Â» pour les visiteurs tant qu'ils ne sont pas relus ; Â« Traduire en franÃ§ais Â» sur une remarque ; traducteur **DeepL**, offre gratuite (Â« Developer Â» depuis 2026 : 1 million de caractÃ¨res en tout, et non plus Â« API Free Â», 500 000 par mois), appelÃ© par le service, clÃ© crÃ©Ã©e et collÃ©e par l'utilisateur ; Propositions : **votes â² / â¼ comme sur Reddit** (modifiables et retirables), score = remarques + â² â â¼, Â« N joueurs l'ont demandÃ© Â» = remarques + â² ; la fenÃªtre Remarque indique la **langue dÃ©clarÃ©e** de la remarque (menu franÃ§ais / anglais, langue du site par dÃ©faut) ; les 11 remarques d'essai sont gardÃ©es (Â« pertinentes Â»). | 2026-10-25 |
| S17 Sources et BAS | Industrialist Calculator (Pollywrath, MIT) est la 2e source, aprÃ¨s Miraheze et avant Fandom. Fluid Pipe2 = 2 cases. Les infobulles des ports disent ce qui y passe (BAS-03) â l'Ã©diteur les structurera (S38). Le partage d'une jonction suit la rÃ¨gle des tuyaux dÃ©jÃ  donnÃ©e (BAS-05). Mois courant, pollution globale, Satellite buff : vraies mÃ©caniques du wiki, Ã  intÃ©grer (S40). | 2026-10-26 |
| S17 Mindustry | 1re maquette refusÃ©e le 2026-10-26 : tout calquer sur Mindustry (remplace Q14-6 et Q14-7). Menu de pose en bas Ã  droite (infos au survol, gardÃ©es au clic, **?** = fiche ; grille ; catÃ©gories du jeu ; tiers tout Ã  droite ; outils sous la grille) ; bÃ¢timents non relevÃ©s grisÃ©s, clic â complÃ©ter ; glisser = ligne sans diagonale ; tuyaux dans le menu, variantes dans le cadre d'infos, longueur 1 par dÃ©faut, longueurs auto au glisser (dÃ©sactivables), virages et croisements posÃ©s seuls, pose par-dessus qui recoupe ; zone supprimÃ©e au relÃ¢chement ; ZQSD / WASD ; pas de boutons d'outils sur le cÃ´tÃ© ; tous les outils de Mindustry + Liaisons ; rÃ¨gles des tuyaux = rÃ©ponse BAS-02. DÃ©tail : PLAN-BAC-A-SABLE.md Â§ 1. | 2026-10-26 |
| S17 Bac Ã  sable | Q14 (dÃ©tail dans [PLAN-BAC-A-SABLE.md](PLAN-BAC-A-SABLE.md) Â§ 1) : stats d'abord, sur la grille du jeu ; une machine sans ports relevÃ©s ne se pose pas ; partir d'un plan calculÃ© en lot Ã  part ; partage par fichier et par lien (Â« petit Â» = adresse â¤ 2 000 caractÃ¨res) ; â° panneau latÃ©ral, tiroir horizontal au tÃ©lÃ©phone, machines par chapitre et catÃ©gorie comme dans le jeu (BAS-01) ; gestes de Mindustry, pas l'aspect ; calcul automatique et fluide pendant la pose, recette dÃ©duite des liaisons, Â« ? Â» si plusieurs, recette visible sur la machine ; liaisons fausses refusÃ©es, tuyau saturÃ© avec une autre texture ; nom Â« Bac Ã  sable Â» / Â« Sandbox Â». | 2026-10-26 |
| S10 Maquette | ValidÃ©e (`maquette/interfaces.html`) : section Â« Interface Â» dans l'Ã©diteur de bÃ¢timents ; â rÃ©glage Ã  faire dans la liste de construction, la barre du bas du schÃ©ma, Â« Comment c'est calculÃ© Â» et le plan de pose ; Quarry Â« dÃ©finitif Â» ; Ã©cran de la Chemical Plant dans la barre du bas, par plan, avec Â« âº 1Ã Â». Les crafts de la Chemical Plant ne sont plus Â« Ã  vÃ©rifier Â» (valeurs du wiki Ã  1Ã, seul l'Ã©cran varie). | 2026-10-17 |
| S40 Recherche | RÃ©ponses du 2026-10-27 : masquer la recherche actuelle d'abord (S46) ; refonte complÃ¨te (chiffres et saisie), journal et temps de jeu gardÃ©s ; rÃ¨gle absente du wiki â prise chez Industrialist Calculator, marquÃ©e et notÃ©e dans `a-verifier.md` ; pollution et mois dans des lots Ã  part (S50) ; difficultÃ© ajoutÃ©e (S51, Â« si tu veux Â») ; maquette en 1er lot (S47) ; **items par station gardÃ©s** (ils changent la vitesse, Pollywrath les compte aussi). | 2026-10-27 |
| S47 Maquette recherche | RÃ©ponses du 2026-10-27 (maquette `recherche-refonte.html` validÃ©e telle quelle) : un groupe = nombre de stations identiques + items communs ; contrÃ´le Â« â comme en jeu Â» sous la saisie ; rÃ©glages de partie (pollution, mois, difficultÃ©) dans Â« Ma recherche Â». | 2026-10-27 |

## 6. Journal des sessions

- **2026-10-16** : plan Ã©crit (ce fichier), aucune modification du code. Point de dÃ©part : commit
  `6c1e7fd`, 242 tests. RÃ©ponses Q1 Ã  Q10 reÃ§ues et reportÃ©es dans les lots ; S1 lancÃ©e.
- **2026-10-16, S1** (`d949b25`, 243 tests, dÃ©ployÃ©) : plot supprimÃ©, le tuyau touche le bÃ¢timent ; 6 relevÃ©s intÃ©grÃ©s (35 bÃ¢timents, 124 ports) ; test Â« une sortie part d'un port de sortie Â».
  Mesures : 15 Craft Assemblers 66 Ã 15 â 66 Ã 13 ; maquette recalculÃ©e v8 87 Ã 96 â 81 Ã 101, tuyaux 1 246 â 1 123, croisements 76 â 75, Ã©lectricitÃ© 5 085 â 3 595 $.
  Ã surveiller : Â« module par module Â» 87 Ã 96 â 82 Ã 104 (+2 %), croisements 69 â 74, surtout le vrai relevÃ© de l'Ingot Molder (plot seul : 82 Ã 101, 71) ; `redesign` Â« milieu Â» plante sur un module repliÃ© (limite dÃ©jÃ  lÃ ).
- **2026-10-16, S11** (250 tests, non dÃ©ployÃ© : le site ne change pas) : `data/modular.json` (ferme d'arbres, moteur diesel, turbine ; chaque valeur sourcÃ©e Miraheze/Fandom, datÃ©e) et son test de forme ; 16 questions MOD-01 Ã  MOD-16 dans `a-verifier.md` ; mÃ©thode de relevÃ© dans RELEVES.md.
  TrouvÃ© : rÃ¨gles de portÃ©e et de contact, comptes de blocs, consommations (200 kMF par arbre, 3 arroseurs par rÃ©servoir, 44 Ã  46 arbres par arroseur), tableaux du moteur (6 cylindres, 32 cylindres) et des turbines (sob_ad). Hors des deux wikis, rien de chiffrÃ© sur Internet.
  Manque pour S12-S13 : aucun rayon de portÃ©e Ã©crit (arroseur dÃ©duit des images : 12 Ã  14 cases), critÃ¨re de portÃ©e, rythme rÃ©el du rÃ©colteur, formule du moteur diesel, ports des blocs.
- **2026-10-16, S11 (suite)** (253 tests, dÃ©ployÃ©) : rÃ©ponses MOD reportÃ©es dans `modular.json` â portÃ©es depuis le bord du bloc, en cases : contrÃ´leur 58, arroseur 10, rÃ©colteur 23 (arbres et sortie), rÃ©servoir infini ; le cercle doit toucher le bloc ; arrosage Miraheze ; chaque rÃ©servoir alimentÃ© en eau ; moteurs collables.
  10 relevÃ©s intÃ©grÃ©s (46 bÃ¢timents : chimie, Quarry, ferme d'arbres ; Farm Harvester ni port ni prise). Ãditeur : case Â« Sans port Â» (`noPorts`). Turbine : deux montages du guide de la Coal Power Plant ; ses chiffres seront signalÃ©s Â« non fiables Â» sur le site (S13).
  Restent : prise de l'arroseur, nombre maximal d'arbres par rÃ©colteur, tout le moteur diesel (MOD-11, 12, 14, 15).
- **2026-10-16, S2** (`accb04b`, fusionnÃ© avec S11 en `9be3f00`, 252 tests, dÃ©ployÃ©) : `passages` dans module.ts (colonne libre entre deux machines, sinon machines Ã©cartÃ©es d'une case ; le tuyau traverse la file de poteaux) et `passageOptions` ; dans le plan de pose, choix Â« Sortie d'un collecteur central Â» (par les bouts par dÃ©faut ; les passages qui Ã©largissent le module Ã  part, en option).
  Mesures, maquette recalculÃ©e : 81 Ã 101 inchangÃ©, tuyaux 1 123 â 1 115, croisements 75 â 74, Ã©lectricitÃ© 3 595 $ inchangÃ©e ; Steel Ingot â Steel Plate 43 â 11 cases ajoutÃ©es (passages Steel Ingot et Iron Ingot vers le haut, entre les hauts-fourneaux 1 et 2). Les passages sont essayÃ©s Ã  placement Ã©gal et gardÃ©s seulement s'ils raccourcissent sans ajouter de croisement (seul, le meilleur faisait â40 cases mais +1 croisement ; en le laissant entrer dans le recuit : 83 Ã 104, rejetÃ©). Aucun passage Ã©largissant ne tient Ã  sa place dans la maquette.
  Ã surveiller : pas de passage pour les modules repliÃ©s (tuyaux principaux) ni pour les collecteurs parallÃ¨les ; dans le site, le choix du passage n'est pas encore guidÃ© par les voisins (ce sera S3) ; Â« module par module Â» inchangÃ© (82 Ã 104, 74 croisements).
- **2026-10-16, S3** (`1919f4e`, 255 tests, dÃ©ployÃ©) : `src/engine/build/factory.ts` (`factoryInput`, `designFactory`, pur, sans DOM) ; la maquette l'appelle (rÃ©sumÃ© et HTML identiques au caractÃ¨re prÃ¨s). Web Worker de Vite (`factory.worker.ts`, `factory-job.ts`) avec avancement et annulation ; rÃ©sultat gardÃ© tant que plan, prioritÃ©s, relevÃ©s et parcelle ne changent pas. Plans de pose : entrÃ©e Â« Toute l'usine Â» (vue de dessus navigable qui s'ouvre en entier, parcelle, Â« proposition Â», liaisons et passages repliÃ©s). Passage guidÃ© par les voisins : dans le plan de pose d'un module, les passages gardÃ©s par l'usine sont marquÃ©s â (par les bouts reste le dÃ©faut).
  Mesures (Crankshaft 60/min, Â« Forme ramassÃ©e Â» d'abord) : 81 Ã 101, 1 115 cases, 74 croisements, 3 595 $ â identiques Ã  la maquette, sur le site aussi. Temps : 13 s sous Node, 12 Ã  21 s dans le navigateur ; page jamais bloquÃ©e (pause la plus longue 118 ms, au dessin final). Avec Â« Place au sol Â» d'abord (dÃ©faut du site) : 131 Ã 54, 1 012 cases, 71 croisements, mais 12 635 $ d'Ã©lectricitÃ©, 7 s.
  Ã surveiller : un module seul ne prend qu'un passage alors que l'usine peut en garder deux (Blast Furnace : Steel Ingot et Iron Ingot), et le passage conseillÃ© peut Ã©largir le module seul (Iron Ingot : 27 Ã 26) mais pas celui de l'usine (autre disposition interne) ; sans parcelle renseignÃ©e, le placement n'a pas de limite ; le rÃ©sultat est perdu au rechargement de la page ; le site ne montre que le mode recalculÃ© (les options sont pour S4).
- **2026-10-17, S4** (`6502c62`, 259 tests, dÃ©ployÃ©) : `src/engine/build/flow.ts` (sens du flux de chaque liaison, testÃ©) ; dans Â« Toute l'usine Â», barre d'options de la maquette (recalculÃ© par dÃ©faut / module par module, liaisons collÃ©es, Tout afficher, RÃ©seau Ã©lectrique, cÃ¢bles vers chaque machine ; un calcul gardÃ© par rÃ©glage) et bouton Â« Afficher les liaisons Â» (aussi dans le plan d'une Ã©tape et dans le panneau) ; clic sur un tuyau â ses liaisons, sur un cÃ¢ble â ce qu'il alimente ; survol d'un module (cadre Ã©clairÃ©, bulle) ; clic â panneau Ã  droite (`#objet/pose/usine-entiere/<Ã©tape>`, â Retour, â¶ plein Ã©cran), dans la version de l'usine (recalculÃ©e, tournÃ©e, tuyaux qui traversent), machines â Ã©diteur de bÃ¢timents (S5 rebranchera vers la fiche) ; lien Â« voir sa version dans l'usine Â» depuis le plan d'une Ã©tape ; liste Â« Machines Ã  complÃ©ter Â» (demande en cours de lot).
  Mesures inchangÃ©es : recalculÃ©e 81 Ã 101, 1 115 cases, 74 croisements, 3 595 $ ; module par module 82 Ã 104, 74 croisements ; Â« coller Â» ne colle rien dans cette chaÃ®ne (comme la maquette, le rÃ©sumÃ© le dit).
  Ã surveiller : l'ordre de pose d'un module tournÃ© garde les directions d'avant la rotation (signalÃ© dans le panneau) ; changer de calcul pendant un autre l'annule ; le panneau reprend les couleurs de l'usine, pas celles du plan seul.
- **2026-10-17, complÃ©ment de S4 (demande de l'utilisateur : retirer les appendices)** (259 tests, dÃ©ployÃ©) : en mode recalculÃ©, une fois la disposition finale choisie, `pruneDeadEnds` (factory.ts) retire les tuyaux qui ne mÃ¨nent nulle part, piÃ¨ce par piÃ¨ce depuis le bout. Une liaison compte si elle mÃ¨ne Ã  une piÃ¨ce de la mÃªme ressource, Ã  une machine, Ã  un emplacement rÃ©servÃ© ou au raccord d'un collecteur que l'usine ne relie pas. Un tÃ© qui perd une branche devient un tuyau droit ou un coude, et les piÃ¨ces et le prix des modules sont recomptÃ©s (`withPieces`, module.ts). Le rÃ©sumÃ© donne le nombre de cases retirÃ©es.
  Mesures (Crankshaft 60/min) : Â« Forme ramassÃ©e Â» d'abord 1 115 â 1 090 cases, 74 â 73 croisements (maquette rÃ©gÃ©nÃ©rÃ©e) ; Â« Place au sol Â» d'abord 1 012 â 1 009 cases, 71 â 70 croisements ; Ã©lectricitÃ© inchangÃ©e. Aussi : la vue de dÃ©part d'un cadre se recalcule s'il Ã©tait presque sans largeur au premier dessin (page en arriÃ¨re-plan).
- **2026-10-17, S5** (`731c9e0`, 274 tests, dÃ©ployÃ©) : onglet Â« Recettes Â» (`recipes-view.ts`, `recipes-store.ts`) : recherche, tuiles ou lignes triables (nom, valeur, RP), fiches objet (Sources, Utilisations) et machine (crafts), tout cliquable, `#recettes/<objet|machine>/<id>` ; â  â la valeur dans Â« Valeurs Ã  vÃ©rifier Â» (`#donnees/verifier/<recette|machine>/<id>/<champ>`, champ Ã©clairÃ©), aussi depuis le dÃ©tail du plan ; cadenas si la recherche manque ; machines du plan de pose et du panneau de module â leur fiche. 312 vignettes du wiki (`scripts/fetch-images.ts`, `data/images.json`, 4,7 Mo), image choisie par le joueur (export `mes-images.json`) ; 19 descriptions d'objets du wiki, sinon recopiÃ©es (correction `items.description`).
  TÃ¢che Â« Steel Plate â sa machine Â» : taper Â« steel pl Â», EntrÃ©e, un clic sur la machine (3 gestes, ~12 s avec la latence de l'outil) ; vÃ©rifiÃ©e sur ordinateur et tÃ©lÃ©phone. Valeurs des captures du jeu identiques Ã  nos donnÃ©es (Crankshaft 754 $, 35Ã RP, 15 s / 4 kMF/s et 5 s / 200 kMF/s ; Chemical Reactor 750 000 $).
  Ã surveiller : les objets n'ont pas de â  cliquable (rien de corrigeable pour eux dans Â« DonnÃ©es Â» : le dÃ©tail s'affiche Ã  la place) ; en lignes, les prix sont arrondis (Â« 750 k$ Â», valeur exacte au survol et dans la fiche) ; pied de page corrigÃ© (Miraheze est en CC BY-NC-SA 4.0).
- **2026-10-17, S6** (`17a59bd`, 292 tests, dÃ©ployÃ©) : maquette validÃ©e (`maquette/recettes-corriger.html`, dÃ©cisions S6 au Â§ 5). `overrides.json` : sections `added` (objets, crafts) et `removed` (crafts), validÃ©es par `buildGameData` (refus motivÃ© : machine ou objet inconnu, pas de sortie, quantitÃ© â¤ 0, durÃ©e â¤ 0, sans source) ; nouvelles corrections : machine d'un craft (sa recherche suit) et facteur RP. Fiche en mode Â« â Corriger Â» : cases pour prix, RP et prix d'achat ; par craft â Modifier, â N'existe pas en jeu (barrÃ©, âº RÃ©tablir), remplacer par un craft corrigÃ© ; + Ajouter un craft manquant (noms du jeu, objet inconnu crÃ©Ã© sur place), + Objet manquant ; â  â la valeur dans ce mode ; DonnÃ©es âº Mes corrections liste ajouts et retraits ; export et import dans le mÃªme fichier.
  Parcours rÃ©el (Crankshaft 60/min, recherche complÃ¨te, parcelle 200 Ã 200) : retirer le craft du Craft Assembler fait passer le plan de 15 Craft Assemblers Ã  5 Advanced Assemblers ; un craft de test ajoutÃ© (valeurs fictives, effacÃ© ensuite) est choisi (1 Craft Assembler, 23 machines au lieu de 109) ; l'export contient `added` et `removed`, et l'import les rÃ©tablit.
  Ã surveiller : un craft existant ne change que ses quantitÃ©s (entrÃ©e manquante ou en trop : le remplacer) ; un retrait inscrit dans `data/overrides.json` ne se rÃ©tablit pas depuis le site ; pas de machine manquante (Ã©diteur de bÃ¢timents) ; les dates affichÃ©es sont en UTC (comme ailleurs sur le site).
- **2026-10-17, S7** (`1a7200b`, 302 tests, dÃ©ployÃ©) : maquette validÃ©e (`maquette/schema-calcul.html`). `calc-view.ts` : un bloc sÃ©lectionnÃ© ouvre Â« Comment c'est calculÃ© Â» sous la barre du bas â ligne du craft (rendu de Recettes), Â« Voir dans Recettes â¸ Â» (`#recettes/<objet|machine>/<id>/<craft>`, craft mis en Ã©vidence et centrÃ©), puis dÃ©bit d'une machine (sortie nette, Â« (17 â 2) Â» si le craft consomme son produit), demande (flÃ¨ches + objectif ou surplus), machines exactes â arrondies, utilisation, Ã©nergie (moyenne et pointe), entrÃ©es et sous-produits ; Ã©tiquette de source par valeur (wiki, relevÃ© en jeu, ta correction, â  â la valeur en mode Â« â Corriger Â»). FlÃ¨che : produit par, consommÃ© par, besoin de l'arrivÃ©e, part du dÃ©part au prorata quand plusieurs blocs produisent l'objet. Cas particuliers : matiÃ¨re premiÃ¨re, arbres (durÃ©e de pousse), production existante, installations composÃ©es (bÃ¢timents arrondis un par un), non produit.
  Parcours rÃ©el (Crankshaft 60/min, recherches du plan dÃ©bloquÃ©es : 148 machines, â 61 arbres) : refait Ã  la main Steel Ingot (6 Ã 60 Ã· 5 s = 72/min ; 360 Ã· 72 = 5 Blast Furnace ; Iron Ingot 360 Ã 2 Ã· 6 = 120/min, comme la flÃ¨che) et Coke Fuel (60 Ã· 72 = 0,8333 â 1 ; 0,8333 Ã 15 kMF/s = 12,5 kMF/s ; Coal 60 Ã 4 Ã· 6 = 40/min, comme la flÃ¨che) ; lien vers Recettes et â  des arbres vÃ©rifiÃ©s ; tÃ©lÃ©phone sans dÃ©bordement. Tests : sur la chaÃ®ne Â« tout dÃ©bloquÃ© Â», chaque dÃ©bit, compte, entrÃ©e et flÃ¨che se refait avec les valeurs affichÃ©es (Coke Fuel â Steel Ingot : 60 Ã 98,96 % = 59,37/min).
  Ã surveiller : pour les arbres, la ligne du craft montre la durÃ©e des donnÃ©es (6 min) alors que le calcul prend la pousse selon la pollution (362,72 s), la phrase l'explique ; les Ã©tapes d'Ã©nergie et de dÃ©pollution ont un panneau plus court (machines Â« d'aprÃ¨s l'optimisation Â») ; captures d'Ã©cran impossibles dans cette session (fenÃªtre masquÃ©e), parcours fait par le DOM.

- **2026-10-17, S8** (311 tests, dÃ©ployÃ©) : maquette validÃ©e (`maquette/schema-machines.html`, dÃ©cisions S8 au Â§ 5). Moteur : `SolveRequest.fixedMachines` (Ã©tape â nombre) et `onlyRecipes` ; `solveFixed` garde les recettes du plan, tente d'abord une rÃ¨gle de trois (juste sans production existante), puis encadre le dÃ©bit (fausse position, ou dichotomie si une borne bute sur le budget ou la pollution) ; `Plan.fixed` donne le dÃ©bit obtenu, l'Ã©tape qui limite et l'utilisation de chaque Ã©tape fixÃ©e, et les Ã©tapes fixÃ©es gardent leur nombre de machines. Dans le site, la barre du bas a Â« Machines : [â] N [+] Â» (molette, flÃ¨ches, nombre tapÃ©), avec un bandeau Â« Production obtenue â¦ limitÃ©e par â¦ Â» et Â« Revenir au calcul Â» au-dessus des onglets. Dans le schÃ©ma, un bloc fixÃ© a un cadre en tirets, celui qui limite est en orange. Â« Comment c'est calculÃ© Â» ajoute Â« Nombre fixÃ© Â» et Â« Production obtenue Â». Le rÃ©glage est gardÃ© au rechargement, et tout le plan le suit.
  Parcours rÃ©el (Crankshaft 60/min, recherches du plan) : 4 Blast Furnace au lieu de 5 â 48/min (60 Ã 4 Ã· 5) ; en plus, 10 Craft Assembler au lieu de 15 â 40/min, Steel Ingot utilisÃ© Ã  83,3 % ; molette â 12 â 48/min ; rÃ©glage gardÃ© au rechargement ; liste de construction Ã  12 Craft Assembler ; Â« Revenir au calcul Â» remet 60/min. Tests : Ã©tape seule (45/min), deux Ã©tapes (37,5/min, 83,3 %), production existante (67,5/min), clÃ© absente, objectif argent.
  Ã surveiller : chaque rÃ©glage refait un ou deux calculs (â 50 ms chacun), et jusqu'Ã  une vingtaine quand le budget ou la pollution limitent ; libÃ©rer un bloc suppose de revenir au nombre du calcul sans rÃ©glage (ou de vider le champ) ; pour une Ã©tape Ã  plusieurs recettes, le rÃ©glage suit la recette (clÃ© `objet@recette`).
- **2026-10-17, S9** (332 tests, dÃ©ployÃ©) : maquette validÃ©e (`maquette/filtre-machines.html`, dÃ©cisions S9 au Â§ 5). Moteur : `SolveRequest.machines = { mode: "exclure" | "seulement", ids, noExtraction }` (`machine-filter.ts`), appliquÃ© dans le Chooser (crafts, gÃ©nÃ©rateurs, Scrubbers ; pas les dÃ©pÃ´ts de vente) : un craft Ã©cartÃ© a le statut Â« Ã©cartÃ©e Â», un objet sans machine permise la raison Â« machine Ã©cartÃ©e Â» et le message Â« Aucune machine permise ne fabrique X â¦ Â» ; une recette forcÃ©e sur une machine Ã©cartÃ©e est ignorÃ©e avec sa raison. Extraction = catÃ©gorie Â« Extractors Â» du wiki et arbres. Site : ligne Â« Machines Â» repliÃ©e sous Â« PrioritÃ©s Â» (Toutes / Toutes saufâ¦ / Seulementâ¦, recherche avec liste, machines du plan en raccourcis, extraction d'office en Â« Seulementâ¦ Â»), un filtre par plan (`machineFilters`, clÃ© `objet|<objet>`, `Ã©nergie`, `argent`) gardÃ© au rechargement ; note Â« Filtre de machines â¦ Retirer le filtre Â» et Â« Permettre â¦ Â» dans la rÃ©ponse ; Â« Ne plus utiliser â¦ â Â» dans la barre du bas du schÃ©ma.
  Parcours rÃ©el (Crankshaft 60/min, progression du navigateur) : sans filtre 119 machines, â 61 arbres ; Blast Furnace Ã©cartÃ©e (tapÃ©e dans la recherche) â 115 machines, â 31 arbres, Steel Ingot et Coke Fuel sur 1 Blast Furnace MK2 ; + Blast Furnace MK2 â Â« Aucune machine permise ne fabrique Steel Ingot (360/min manquent) Â», 26 machines ; Â« Permettre Blast Furnace MK2 Â» â 115 ; Â« Seulementâ¦ Â» reprend les 6 machines du plan, Tree Ã©cartÃ© â 189 machines, sans arbre ; Â« Ne plus utiliser Blast Furnace Â» depuis le schÃ©ma ; gardÃ© au rechargement ; Gear sans filtre, retour au Crankshaft avec le sien ; tÃ©lÃ©phone sans dÃ©bordement.
  Ã surveiller : Â« Seulementâ¦ Â» ne reprend les machines du plan que si sa liste est vide (une liste dÃ©jÃ  choisie est gardÃ©e) ; le filtre de l'objectif RP n'existe pas (le mode Â« dÃ©bloquer ce qui manque Ã  mon plan Â» prend celui de l'objet) ; les machines fixÃ©es dans le schÃ©ma (S8) restent rÃ©glÃ©es mÃªme si le filtre fait disparaÃ®tre leur bloc (Â« rÃ©glage sans effet Â»).
- **2026-10-17, S10** (350 tests, dÃ©ployÃ©) : recherche Miraheze (pages et moteur de recherche du wiki) et Fandom ; maquette validÃ©e (`maquette/interfaces.html`, dÃ©cisions S10 au Â§ 5). `data/interfaces.json` : 20 machines, chacune sourcÃ©e â levier Â« bottle Â» / Â« container Â» des deux mouleurs, Ã©cran dÃ©finitif de la Quarry, Ã©cran chiffrÃ© de la Chemical Plant (Resource Input, Resource Output, Power Input), et les interfaces sans effet (logique, centrales, Mineshaft Drillâ¦) avec leur raison ; doutes IF-01 Ã  IF-06 dans `a-verifier.md`, mÃ©thode dans RELEVES.md. Moteur (`interfaces.ts`) : position Ã  mettre pour un craft ; rÃ©glages chiffrÃ©s appliquÃ©s aux crafts (`applyMachineSettings`, original gardÃ© dans `screen.base`) ; les crafts de la Chemical Plant ne sont plus Â« Ã  vÃ©rifier Â» (valeurs Ã  1Ã). Site : â dans la liste de construction, la barre du bas du schÃ©ma, Â« Comment c'est calculÃ© Â» et le plan de pose (et le panneau d'un module de l'usine) ; cases de l'Ã©cran dans la barre du bas, par plan (`machineSettings`), Â« âº 1Ã Â» ; Ã©diteur de bÃ¢timents : section Â« Interface Â» (type, oÃ¹, dÃ©finitif, rÃ©glages Ã  positions avec leurs crafts ou chiffrÃ©s), â dans la liste, enregistrÃ©e Ã  part des ports, exportÃ©e avec les relevÃ©s (clÃ© `interfaces`).
  Parcours rÃ©el (navigateur intÃ©grÃ©) : Crankshaft inchangÃ© (115 machines, â 31 arbres, filtre de S9 laissÃ© dans ce navigateur, aucune pastille) ; Gearbox 60/min â 4 Industrial Plastic Molder Â« â levier sur Â« container Â» Â» (liste, schÃ©ma, panneau, plan de pose) ; Hardened Plastic Casing calculÃ©e sans Â« valeurs Ã  vÃ©rifier Â» (1 Chemical Plant) ; Ã©cran 1,67 / 2 / 4 â 1 200 /min par machine au lieu de 600, gardÃ© au rechargement, Â« âº 1Ã Â» le retire ; Clay Brick â Quarry Â« Soil & Clay Â» Â« dÃ©finitif Â» ; Ã©diteur : position renommÃ©e â le plan la suit, Â« Oublier Â» revient au dÃ©pÃ´t ; tÃ©lÃ©phone sans dÃ©bordement.
  Ã surveiller : l'interface a son propre bouton Â« Enregistrer l'interface Â» (la maquette disait Â« avec le relevÃ© Â» : sÃ©parÃ© pour ne pas crÃ©er un relevÃ© de ports vide) ; l'Ã©cran vaut pour toutes les Chemical Plant d'un plan (pas Ã©tape par Ã©tape) ; la ligne du craft dans Â« Comment c'est calculÃ© Â» montre les quantitÃ©s multipliÃ©es.
- **2026-10-18, S12** (365 tests, dÃ©ployÃ©) : maquette validÃ©e (`maquette/modulaires.html`, dÃ©cisions S12 au Â§ 5). DonnÃ©es (`modular.json`) : faces obligatoires de chaque bloc par contact (`facesRequired`), ligne du moteur (`order`), volant placÃ© comme un vilebrequin sans face obligatoire (rÃ©ponse du 2026-10-18), blocs desservis par le rÃ©servoir, l'arroseur et le rÃ©colteur (`serves`), questions encore ouvertes (`meta.openQuestions`) ; MOD-17 (bord Â« devant Â» d'un bloc) dans `a-verifier.md`, mÃ©thode dans RELEVES.md. Moteur pur `src/engine/modular.ts` (faces, portÃ©es, grille d'arbres, correction Ã  garder). Ãditeur de bÃ¢timents : repÃ¨re â¬¡ ferme / moteur / turbine dans la liste (la recherche Â« ferme Â» trouve les 6 blocs) ; section Â« Ensemble modulaire Â» : chaÃ®ne avec le bloc Ã©clairÃ©, tableau des faces (obligatoire ou facultatif, puces cliquables vers chaque bloc, sources, â  sur les questions ouvertes), champ Â« Devant, sur la grille du relevÃ© Â» ; pour la ferme, portÃ©e (depuis le bord et depuis le centre), forme, ce que le bloc dessert, de qui il doit Ãªtre Ã  portÃ©e, et la portÃ©e dessinÃ©e sur une grille d'arbres ; Â« â Corriger Â» gardÃ© dans le navigateur, exportÃ© avec les relevÃ©s (clÃ© `modular`).
  Parcours rÃ©el (navigateur intÃ©grÃ©, ordinateur et tÃ©lÃ©phone) : arroseur 44 arbres en grille, comme les deux wikis (Â« â cohÃ©rent Â») ; portÃ©e passÃ©e Ã  12 â 48 et Â« â  les wikis disent 44 Â» ; rÃ©colteur 168 emplacements, contrÃ´leur 776 ; vilebrequin Â« derriÃ¨re Â» dÃ©cochÃ© â gardÃ© au rechargement, repÃ¨re â, Â« Oublier Â» revient au dÃ©pÃ´t ; puce Â« Controller Â» â sa fiche ; turbine et volant affichÃ©s ; pas de dÃ©bordement Ã  375 px (en-tÃªte du tableau et repÃ¨re Â« moteur Â» raccourcis pour Ã§a).
  Ã surveiller : la maquette annonÃ§ait la ferme du guide en repÃ¨re dans le cercle du contrÃ´leur, remplacÃ©e par la grille (placement exact du guide non Ã©crit) ; pour les blocs posÃ©s sur un cÃ´tÃ© (cylindreâ¦), la ligne Â« CÃ´tÃ©s Â» veut dire Â« contre le cÃ´tÃ© d'un vilebrequin Â» ; l'export n'a pas Ã©tÃ© cliquÃ© (tÃ©lÃ©chargement), il est couvert par un test aller-retour.
- **2026-10-18, S13** (382 tests, dÃ©ployÃ©) : Q12 posÃ©e et validÃ©e (Â« Oui Ã  tout Â», dÃ©cisions S13 au Â§ 5 ; maquette en texte). Moteur pur `src/engine/modular-calc.ts`, qui ne lit que `modular.json`. Ferme : `farmRates`, `farmBlocks`, `farmOutput` (bois, eau, Ã©lectricitÃ©, ce qui limite, blocs manquants). Moteur diesel : `dieselConfigs` et `dieselLookup` (8 configurations relevÃ©es ; les autres Â« Ã  relever Â»). Turbine : `turbineReliability` (Â« non fiable Â», hors du calcul). `applyModular`, appelÃ© dans `buildGameData` (`RawFiles.modular`) : l'arbre devient une ferme. PiÃ¨ces par arbre : 1/44 d'arroseur, 1/132 de rÃ©servoir, 1/22 de rÃ©colteur ; contrÃ´leur et sortie une fois par ferme (`perFarm`). L'eau et l'Ã©lectricitÃ© suivent la pousse (`evalRecipe`). Les moteurs deviennent des installations Ã©nergÃ©tiques, comptÃ©es en moteurs entiers (`wholeUnits`). AjoutÃ© aussi : arbres toujours rÃ©glables dans le schÃ©ma (S8), blocs de la ferme comptÃ©s comme bÃ¢timents. Filtre S9 : en Â« Seulementâ¦ Â», les blocs suivent l'arbre ; Ã©carter un rÃ©colteur Ã©carte la ferme. Site : ligne Â« Ferme d'arbres Â» dans la liste de construction, Â« Comment c'est calculÃ© Â» (arroseurs, rÃ©servoirs, rÃ©colteurs â  MOD-09, contrÃ´leur et sortie, Ã©lectricitÃ©, eau), craft de l'arbre Â« 200 kMF par coupe Â» dans Recettes. Objectif Ã©nergie : moteur diesel parmi les centrales, turbine Â« non fiable Â» dans la liste des non calculÃ©es. Ãditeur de bÃ¢timents : bloc Â« Calcul Â» sous Â« Ensemble modulaire Â» (ferme : blocs saisis â Oak Log/min, limite, eau, Ã©lectricitÃ©, Â« Au plus juste Â» ; moteur : rÃ©glages â configuration relevÃ©e ou Â« Ã  relever Â», puces des 8 configurations ; turbine : non fiable).
  Parcours rÃ©el (navigateur intÃ©grÃ©, ordinateur et tÃ©lÃ©phone 375 px) : Oak Log 30/min â 91 arbres + 3 arroseurs + 1 rÃ©servoir + 5 rÃ©colteurs + 1 contrÃ´leur + 1 sortie, 50,2 kMF/s, Water 122/min, 1 Water Pump2 ; panneau refait Ã  la main (30 Ã· 0,3308 = 90,68 ; 90,68 Ã 200 kMF Ã· 362,72 s = 50 kMF/s). Ãnergie 2 MMF/s, filtre rÃ©duit au diesel (essai, retirÃ© ensuite) : 1 moteur 32 cylindres, Refined Diesel 3,69/min (0,6693 Ã 0,092 Ã 60). Ãditeur : guide 88 arbres â 29,11/min, 118,8 L/min, 48,52 kMF/s ; 120 arbres â limite Â« arroseurs Â», Â« Au plus juste Â» â 3 / 1 / 6 ; 7 cylindres â Â« Ã relever Â» ; turbine Â« non fiable Â». Tests : ferme du guide (2 arroseurs, 1 rÃ©servoir, 4 rÃ©colteurs), limites, solveur, arbres fixÃ©s, filtre, moteurs, 84 500 $ du montage simple.
  Ã surveiller : l'eau se compte au prorata des arbres (3 arroseurs posÃ©s pour 91 arbres en boivent 178 L/min, le plan en compte 122) ; tous les plans avec du bois changent (eau, Ã©lectricitÃ©, blocs, prix) ; le 32 cylindres a une liste de blocs incomplÃ¨te (MOD-14), son prix est donc trop bas ; le tableau Ã  6 cylindres est supposÃ© Ã  l'accÃ©lÃ©rateur 100 % ; la taille maximale d'une ferme n'est pas connue (une seule ferme jusqu'Ã  S14) ; le bloc Â« Calcul Â» de l'Ã©diteur n'est pas gardÃ© au rechargement.
- **2026-10-18, S14** (391 tests, dÃ©ployÃ©) : Q15 posÃ©e (maquette `maquette/modulaires-pose.html`, calculÃ©e avec les rÃ¨gles du jeu), rÃ©ponses et dÃ©cisions S14 au Â§ 5. RelevÃ©s du 2026-10-18 intÃ©grÃ©s (46 bÃ¢timents, corrections de l'utilisateur) ; `modular.json` : le contrÃ´leur porte des blocs de cÃ´tÃ©, un bloc par cÃ´tÃ©, longueur sans effet sur la puissance, MOD-17 close (champ Â« Devant Â» retirÃ© de l'Ã©diteur). Moteur pur `src/engine/build/assembly.ts` : ferme (carrÃ©s de 7 Ã 7 autour de chaque arroseur, rÃ©colteurs dans les trous, contrÃ´leur au centre, sorties et rÃ©servoirs avec un passage libre pour leur tuyau, au besoin Ã  travers le bois en replaÃ§ant les arbres, chaÃ®ne de poteaux du bord jusqu'Ã  la prise, plusieurs fermes Ã©cartÃ©es au-delÃ  d'environ 600 arbres) et moteur diesel (ligne contrÃ´leur â vilebrequins â gÃ©nÃ©rateur, blocs de cÃ´tÃ© des deux cÃ´tÃ©s, le moins de vilebrequins). Le calcul compte les blocs de la ferme d'aprÃ¨s ce plan (`farmCounts`, appelÃ© par le solveur) et ceux du moteur au plus court (6 cylindres : 4 vilebrequins, 68 500 $ au lieu de 84 500 $). Site : groupe Â« Ensembles modulaires Â» dans les plans de pose (dessin, Â« Afficher les portÃ©es Â», clic sur un bloc â son cercle et ce qu'il dessert, choix du poteau, ordre de pose, piÃ¨ces, hypothÃ¨ses) ; Â« Toute l'usine Â» leur donne leur vraie place et les ouvre dans le panneau.
  Parcours rÃ©el (navigateur intÃ©grÃ©, DOM : captures impossibles, fenÃªtre masquÃ©e) : Oak Log 30/min â ferme de 91 arbres, 3 arroseurs, 1 rÃ©servoir, 5 rÃ©colteurs, 2 sorties, 1 contrÃ´leur, 2 MV Pole, 81 Ã 62 cases, 12 940 $ ; liste de construction identique (2 sorties) ; HMVT â 1 poteau, une place libre, 22 780 $ ; clic sur un rÃ©colteur â ses 22 arbres et sa sortie ; Â« Toute l'usine Â» : la ferme Ã  81 Ã 62 au lieu de 12 Ã 12, clic â panneau. Ãnergie 2 MMF/s, filtre (essai, retirÃ©) : 2 moteurs de 6 cylindres, rapport 14, 12 Ã 12 cases, 137 000 $. TÃ©lÃ©phone 375 px sans dÃ©bordement. Guide Miraheze (88 arbres) refait par le moteur : 2 arroseurs, 4 rÃ©colteurs, 2 sorties, comme le guide.
  Ã surveiller : la capacitÃ© d'une ferme (environ 600 arbres) se calcule en quelques secondes et n'est affichÃ©e que quand il faut plusieurs fermes ; la liaison Water â ferme n'est pas tracÃ©e dans Â« Toute l'usine Â» (comme avant : place sans port) ; Crankshaft 60/min (â 31 arbres dans ce navigateur) : la ferme passe de 12 Ã 12 Ã  36 Ã 38 cases dans l'usine, et les mesures du site changent (pas celles de la maquette, calculÃ©e sans modulaires) ; le 32 cylindres n'est couvert que par les tests (le solveur lui prÃ©fÃ¨re le 6 cylindres) ; les piÃ¨ces de tuyau fluide de tier III n'ont pas le mÃªme id partout (`pipe-fluid-turn2`â¦ dans logistics.json et le catalogue, `fluid-pipe-turn2`â¦ dans machines.json et les relevÃ©s) : Ã  vÃ©rifier.
- **2026-10-18, S18** (397 tests, dÃ©ployÃ©) : Q16 posÃ©e et validÃ©e (dÃ©cisions S18 au Â§ 5). Moteur : `DieselReading`, `parseDieselReading`, `dieselConfigs(file, relevÃ©s)` (un relevÃ© remplace la configuration aux mÃªmes rÃ©glages et carburant), `dieselPick` (meilleur rapport production/consommation, moins de place, meilleure production Ã©nergÃ©tique, ou configuration imposÃ©e ; complÃ©ment du mÃªme jour : Â« le moins cher Â» remplacÃ©, rÃ©ponses Q16 dÃ©taillÃ©es), `SolveRequest.diesel` (seule la configuration choisie parmi les moteurs) ; volants posÃ©s dans la ligne (`designDiesel`). Site : Ã©diteur du moteur, carburant dans Â« Calcul Â», tableau des configurations (wiki ou relevÃ© en jeu, L par MMF, â), formulaire Â« RelevÃ© de configuration Â» gardÃ© dans le navigateur, exportÃ© et importÃ© (clÃ© `diesel`) ; barre du bas du schÃ©ma (carburant, critÃ¨re, configuration), Â« â Panneau du contrÃ´leur : rapport â¦ accÃ©lÃ©rateur â¦ Â» dans la liste, le plan de pose et Â« Comment c'est calculÃ© Â» ; un choix par plan (`dieselChoice`).
  Parcours rÃ©el (navigateur intÃ©grÃ©, DOM) : relevÃ© de test (Diesel, valeurs fictives, effacÃ© ensuite) â dans le tableau et le calcul ; Ã©nergie 2 MMF/s, autres centrales Ã©cartÃ©es : 1 moteur 32 cylindres (le moins de carburant), â rapport 14, 59 % ; carburant Diesel â 3 moteurs du relevÃ©, rapport 16, 100 %, dans le plan de pose et Â« Comment c'est calculÃ© Â» ; Â« moins de place Â» â 2 moteurs de 6 cylindres, rapport 13 ; Â« meilleure production Ã©nergÃ©tique Â» â 32 cylindres. TÃ©lÃ©phone 375 px : la barre passe Ã  la ligne.
  Ã surveiller : le dÃ©faut change les plans d'Ã©nergie au diesel (32 cylindres au lieu de 6, liste de blocs incomplÃ¨te MOD-14) ; la page du schÃ©ma dÃ©borde dÃ©jÃ  Ã  375 px (608 px de large sans la barre, d'avant S18) ; un 2áµ gÃ©nÃ©rateur relevÃ© est comptÃ© dans le prix mais le dessin n'en pose qu'un ; l'Ã©diteur garde les donnÃ©es du chargement pour les noms et prix.
- **2026-10-18, recherche R13** (sans code, non dÃ©ployÃ©) : vitesse des RP et plafond souple. Les formules du wiki retrouvent la capture du Research Tracking Panel (4 RS3 Ã  deux Crankshaft supposÃ©s, liquide de valeur 0,1 supposÃ©) ; Â« Max RP before â¦ Â» = 3 Ã seuil. Questions RP-01 Ã  RP-09 (`a-verifier.md`), mÃ©thode dans RELEVES.md, lot S20 proposÃ© (Q17, place Ã  valider).
- **2026-10-19, S19** (402 tests, dÃ©ployÃ©) : Q18 posÃ©e avec la maquette `maquette/editeur-simplifie.html` (inventaire de l'Ã©diteur : garder, dÃ©placer, replier, retirer), rÃ©ponses et dÃ©cisions S19 au Â§ 5. Aucun changement de format : `ports.json`, l'export et l'import restent les mÃªmes ; seule nouveautÃ©, la clÃ© facultative `sides` d'une correction modulaire (cÃ´tÃ©s rÃ©glÃ©s Ã  part, leur rÃ©union reste la face Â« side Â»). ModÃ¨le : `faceBoxes`, `toggleFaceBlock`, `setFaceRequired`, `splitSides` (buildings-model.ts), `withSides` et `SideSplit` (modular.ts), `entryChanged`, `sameSize`. Ãditeur rÃ©Ã©crit : une case par face autour de la grille (devant en haut, derriÃ¨re en bas, cÃ´tÃ©s liÃ©s par dÃ©faut, option Â« CÃ´tÃ©s rÃ©glÃ©s Ã  part Â»), modifiÃ©e sur place ; bulle Ã  cÃ´tÃ© du port cliquÃ© (type, sens, info-bulle, supprimer) ; option Â« Pose : Bulle Â» (clic sur une case vide â bulle), Â« Outils Â» par dÃ©faut ; un seul Â« Enregistrer Â» (seulement ce qui a changÃ©, Â« â non enregistrÃ© : â¦ Â» tant qu'il reste quelque chose) et un seul Â« Oublier Â» ; portÃ©e de la ferme sur une ligne et Â« â¯ PortÃ©e Â» dessinÃ©e dans la grille ; Interface, Capture, Remarques, Â« Ã savoir Â» et Â« Calcul Â» repliÃ©s (configurations du moteur ouvertes d'office sur le contrÃ´leur). RetirÃ©s : lÃ©gende, formulaire sous la grille, champ Â« Ce que le jeu affiche Â» (gardÃ© dans les donnÃ©es), chaÃ®ne, tableau des faces, Â« ContrÃ´le Â» de la portÃ©e, taille du wiki quand elle est identique. RELEVES.md suit.
  Parcours rÃ©el (navigateur intÃ©grÃ©, DOM : captures impossibles, fenÃªtre masquÃ©e ; valeurs de test, effacÃ©es ensuite) : Crankshaft (manquant) â port fluide posÃ© dans la marge, bulle Ã  cÃ´tÃ©, sens passÃ© Ã  sortie, info-bulle ; case Â« CÃ´tÃ©s Â» â cÃ´tÃ©s rÃ©glÃ©s Ã  part, Cylinder retirÃ© Ã  gauche, droite obligatoire ; Â« Enregistrer Â» â Â« relevÃ© (encore incomplet), faces Â», correction gardÃ©e avec `sides` et rechargÃ©e Ã  l'identique ; mode Bulle : case vide du haut â Â« Nouveau port Â», objet Â« les deux Â» posÃ©, corps â prise â¡ ou logique ; arroseur : portÃ©e 10 cases, cercle de 12 cases depuis le centre dans la grille, correction Ã  11 â Â« â non enregistrÃ© : portÃ©e Â», Annuler ; contrÃ´leur : configurations ouvertes d'office ; Press : bulle avec l'info-bulle relevÃ©e ; 375 px sans dÃ©bordement (le tableau des configurations dÃ©file dans son repli).
  Ã surveiller : le clic sur un bouton Â« Pose Â» avait d'abord changÃ© de page (attribut `data-pose` dÃ©jÃ  pris par le site, renommÃ© `data-posemode`) ; la bulle suit le glisser et la molette, mais reste Ã  placer Ã  la main si la page dÃ©file sous elle ; le relevÃ© d'un bÃ¢timent manquant n'est enregistrÃ© que si l'on a posÃ© ou cochÃ© quelque chose ; l'export n'a pas Ã©tÃ© cliquÃ© (tÃ©lÃ©chargement), il est couvert par un test aller-retour avec `sides`.
- **2026-10-20, S20** (422 tests, dÃ©ployÃ©) : Q17 (points 2 Ã  4) et Q19 (maquette `maquette/recherche-rp.html`) posÃ©es et validÃ©es, dÃ©cisions S20 au Â§ 5. Moteur pur `src/engine/research-balance.ts` : `rateAt`, `timeToReach`, `balanceAfter` (formule exacte `exactBalance` pour un seul seuil des tiers 1 Ã  3, Simpson sinon), `nearlyZero` (Â« Max RP Â»), `balanceTimeline`, `researchModel` (niveau rapide : le panneau, grandeurs du tier retrouvÃ©es par les formules inverses `tierSumFromPanel` ; niveau dÃ©taillÃ© : groupes de stations et contrÃ´leurs, contrÃ´les Â« comme en jeu Â»), `withAddedStations` et `proposeAddStations` (Â« + N stations aux tiennes Â»). `research-points.ts` : `TierSum`, `tierRate`, `tierCap`, `groupSum` ; `evaluateStations` et `designResearch` acceptent les stations du joueur (`base`) : une installation du mÃªme tier s'y ajoute (gain rÃ©el, seuil du tier entier). Site : boÃ®te Â« Ma recherche Â» dans Mon usine (RP et RP/s dÃ©placÃ©s), RP estimÃ©s avec le plafond partout (`currentRp` prend les tiers), puce d'en-tÃªte Ã  la vitesse rÃ©elle (Â« â  seuil Â»), objectif recherche avec le vrai seuil, colonne et bloc Â« + N stations aux tiennes Â», Â« Comment c'est calculÃ© Â» (vitesse et seuil). Saisie gardÃ©e dans `player.research` (export compris). Wiki (Research System, texte de l'utilisateur) : Â« average RPx Â» contredit la somme de la page Research Station3 ; la capture tranche pour la somme (RP-10). Nouveaux doutes RP-10 Ã  RP-12.
  Parcours rÃ©el (navigateur intÃ©grÃ©, 371 px de large) : capture saisie au niveau rapide â seuil dans 19 min, 1,3 Ã seuil dans 30 min (25,26 RP/s), 2 Ã seuil 1 h 58 (5,04 RP/s), Â« Max RP Â» 230 625 (â avec 231 000) ; saisie avancÃ©e de 2 h (stockage modifiÃ© pour l'essai) â â 154 229 RP, 4,96 RP/s (9,8 %), Â« seuil dÃ©passÃ© depuis 1 h 41 Â», en ligne droite le site aurait comptÃ© 382 682 ; niveau dÃ©taillÃ© (4 RS3 Crankshaft + Crankshaft, 2 contrÃ´leurs Light Oil) â 47,47 â, 76 875 â, 2,93 â, 230 626 â, 1Ê³áµ ligne â. Objectif Â« Foundry en 15 min Â» (Foundry dÃ©cochÃ©e pour l'essai, recochÃ©e ensuite) : Ã  ton rythme 30 min, + 7 stations aux tiennes 14 min (11 stations, 87,09 RP/s + 5,38, seuil 121 563, 700 000 $, 84 Crankshaft/min), installation neuve 15 min. Aucune erreur en console.
  Ã surveiller : l'Ã©cart avec un relevÃ© en jeu aprÃ¨s le seuil (RP-04, critÃ¨re < 2 %) n'est pas mesurÃ©, faute de relevÃ© ; tout repose encore sur deux suppositions (deux Crankshaft, liquide de valeur 0,1) et sur un seuil par tier (RP-05) ; les paraboles d'une installation neuve s'ajoutent telles quelles (le log des liquides de tous les contrÃ´leurs n'est pas recombinÃ©) ; Â« 1,3 Ã seuil Â» remplace le Â« 100 000 Â» d'exemple de la maquette (ligne utile au relevÃ© RP-04).
- **2026-10-20, aprÃ¨s S20** : nouveau retour R14 (graphe de l'Ã©volution des RP avec l'historique des changements) ; Q20 posÃ©e et rÃ©pondue ; lot S21 Ã©crit au Â§ 3, placÃ© avant S15. Q21 rÃ©pondue le mÃªme jour : les RP ne montent qu'en jeu, le lot commence par l'interrupteur Â« Je joue / Je ne joue plus Â» et compte en temps de jeu. Aucun code.
- **2026-10-20, S21** (437 tests, dÃ©ployÃ©) : Q22 posÃ©e avec la maquette `maquette/historique-rp.html` (journal d'exemple calculÃ© par le moteur sur la capture du 2026-10-18), rÃ©ponses et dÃ©cisions S21 au Â§ 5. Moteur pur `src/engine/rp-history.ts` : horloge de jeu (`gameNow`, `setPlaying`, `stopAtLastSeen`, `needsRecall`), journal (`addEvent` : relevÃ©s, configurations, dÃ©penses, frappes fondues sous 2 min de jeu, configuration identique non notÃ©e ; `prune` : 90 jours de jeu, points de dÃ©part gardÃ©s ; `removeEvent`), courbe par morceaux (`rpHistory`, `rpAtGame`, `readingGap`, `realTimeAt`). Site : interrupteur Â« Je joue / Je ne joue plus Â» en haut de Â« Ma recherche Â» et bouton â¶/â¸ dans l'en-tÃªte ; RP, Â« seuil atteint dans â¦ de jeu Â», chronologies de l'objectif recherche en temps de jeu (heure rÃ©elle seulement Â« si tu continues Â») ; rappel Â« Tu jouais encore ? Â» Ã  la rÃ©ouverture (arrÃªt Ã  la fermeture par dÃ©faut) ; deux graphiques SVG (`src/ui/rp-chart.ts`, palette contrÃ´lÃ©e par le validateur du skill dataviz) avec prÃ©vision, pointillÃ© au-delÃ  de maintenant, relevÃ©s, seuil, repÃ¨res â/$ numÃ©rotÃ©s, reconnexions, info-bulle au survol, au toucher et au clavier ; journal repliÃ© avec â. Journal sous la clÃ© `ind-calc:v1:rp-journal`, exportÃ© avec la partie (clÃ© facultative `history` ; un ancien fichier s'importe et commence un journal neuf). Ã la mise Ã  jour, le dernier relevÃ© devient le premier point, hors jeu.
  Parcours rÃ©el (navigateur intÃ©grÃ©, â 371 px et 1 280 px ; durÃ©es de jeu simulÃ©es en reculant l'horloge enregistrÃ©e, valeurs de test) : capture saisie â Â« Hors jeu Â», RP figÃ©s ; â¶ Je joue + 1 h â 128 752 RP, seuil dÃ©passÃ© depuis 41 min de jeu ; relevÃ© 129 500 / 10,4 tapÃ© au clavier â un seul Ã©vÃ©nement (+0,5 % sur la prÃ©vision) ; Foundry rendue puis redÃ©bloquÃ©e dans l'arbre â deux repÃ¨res $ ; 5áµ station du tier 3 (54,27 RP/s, seuil 85 534) â un seul repÃ¨re â Â« stations 4 â 5, RP/s 47,47 â 54,27, seuil 76 875 â 85 534 Â» ; relevÃ© 204 000 (â1,9 %) ; â¸ puis 9 h hors jeu â 204 010 RP inchangÃ©s au rechargement ; reconnexion â² ; info-bulles au toucher ; export interceptÃ© (clÃ© `history`, 10 Ã©vÃ©nements) puis import â journal identique ; site fermÃ© 8 h pendant Â« Je joue Â» â question, arrÃªt Ã  la fermeture sans rÃ©ponse, Â« Je joue toujours Â» rÃ©tablit la session. Aucune erreur en console.
  Ã surveiller : le bouton de l'en-tÃªte et celui de Â« Ma recherche Â» Ã©taient redessinÃ©s toutes les 5 s (clic perdu) : seul le texte change dÃ©sormais ; sur tÃ©lÃ©phone, l'en-tÃªte ne montre que la puce Â« recherches Â» et le bouton â¶/â¸ (la puce RP est masquÃ©e, comme avant) ; le rappel ne sait pas si le tÃ©lÃ©phone Ã©tait en veille avec le jeu ouvert (il demande) ; l'Ã©cart avec un vrai relevÃ© aprÃ¨s le seuil (RP-04) reste Ã  mesurer en jeu.
- **2026-10-20, S15** (437 tests, sans code du site, non dÃ©ployÃ©) : tour du site page par page (navigateur intÃ©grÃ©, captures, et DOM quand la capture Ã©chouait) ; Q23 : cinq parcours guidÃ©s par l'utilisateur, Claude Ã  la souris (A arrivÃ©e, B 60 Crankshaft/min et construire, C quand aurai-je les RP, D poser un module, E valeur fausse), rÃ©actions notÃ©es mot pour mot dans `REVUE.md` avec gestes et blocages, sur une partie vide (serveur `calculateur-neuf`, port 5179) puis sur la progression exportÃ©e de l'utilisateur ; 27 dÃ©fauts classÃ©s (graves G1-G4, gÃªnants M1-M12, finition F1-F11) ; maquette `maquette/revue.html` validÃ©e (Q24) avec une fenÃªtre d'orientation au lieu de l'accueil ; nouveau retour R15 (remarques des joueurs) placÃ© dans S16 ; rÃ©organisation dÃ©coupÃ©e en S22 Ã  S29, avant S16.
  Mesures : de la partie vide au plan de pose total, 5 clics et une dizaine de crans de molette ; Â« quand aurai-je assez de RP pour Research Station 4 Â» : 7 gestes, rÃ©ponse au 4áµ niveau (4 h 37 de jeu) ; valeur Ã  vÃ©rifier du Crankshaft : 4 gestes depuis le schÃ©ma.
  Ã surveiller : Â« Des RP Â» affiche d'office un plan absurde (27 156 stations, G1) jusqu'Ã  S22 ; les tuyaux Â« sans destination Â» vus par l'utilisateur ne sont pas encore identifiÃ©s (capture demandÃ©e pour S27) ; les relevÃ©s de bÃ¢timents du 2026-10-20 envoyÃ©s par l'utilisateur Ã©taient dÃ©jÃ  intÃ©grÃ©s ; les serveurs du navigateur intÃ©grÃ© peuvent Ãªtre arrÃªtÃ©s par l'application en cours de session (relancer avec `preview_start`).
- **2026-10-20, S22** (439 tests, dÃ©ployÃ© ; lancÃ© dans la session de S15 Ã  la demande de l'utilisateur) : fiche d'une recherche dans l'arbre (`research-view.ts`, `rpEta` dans main.ts) : Â« â durÃ©e de jeu Ã  ton rythme Â» sous Â« il te manque â¦ Â» (mÃªme calcul que la chronologie : `balanceTimeline`, depuis les RP estimÃ©s, chaque prÃ©requis dÃ©pense son coÃ»t ; Â« en ligne droite Â» quand le seuil n'est pas saisi ; sinon un lien vers Ma recherche), et Â« L'avoir plus vite â¸ Â» qui rÃ¨gle l'objectif recherche sur elle. Objectif recherche : Â« dÃ©bloquer une recherche Â» par dÃ©faut et en premier dans la liste, vitesse vide par dÃ©faut (`rpRate: null`, Â« Indique la vitesse voulue Â») : plus aucun plan d'office ; la rÃ©ponse commence par Â« Ã ton rythme : â â¦ de jeu. Â».
  Parcours C refait (partie de l'utilisateur, 17 000 RP Ã  14 RP/s) : arbre â Research Station 4 â Â« â 4 h 37 min de jeu Ã  ton rythme Â» en 3 gestes (7 avant, au 4áµ niveau) ; Â« L'avoir plus vite â¸ Â» â Â« Ã ton rythme : â 4 h 37 min de jeu. Pour dÃ©bloquer Research Station 4 en 1 h 00 min : 26 Ã Research Station3â¦ Â». Aucune erreur en console.
  Ã surveiller : les joueurs qui avaient dÃ©jÃ  le but Â« atteindre une vitesse Â» gardent leur rÃ©glage (50 RP/s) ; dans ce but, le plafond automatique vise toujours la recherche la plus chÃ¨re qu'il reste (5 M de RP), d'oÃ¹ des installations Ã©normes : Ã  revoir avec l'utilisateur (calcul, Â§ 0 rÃ¨gle 5).
- **2026-10-20, S23** (441 tests, dÃ©ployÃ©) : menu Planifier Â· Arbre Â· Recettes Â· Mon usine Â· Contribuer ; page Accueil retirÃ©e (`#accueil` et toute adresse inconnue â Planifier ; l'encadrÃ© Â« PremiÃ¨re visite Â» passe en haut de Planifier) ; Â« DonnÃ©es Â» devient Â« Contribuer Â» (`#contribuer`, les adresses `#donneesâ¦` restent lues). Objectifs vides par dÃ©faut (`settings.entered` : un objectif devient rempli dÃ¨s qu'on y saisit un objet, une quantitÃ©, une puissance ou un revenu ; les rÃ©glages d'avant S23 sont considÃ©rÃ©s remplis) : exemples en grisÃ©, une phrase, ni rÃ©sultat ni onglets ; la quantitÃ© 60 n'apparaÃ®t qu'une fois l'objet choisi. Onglets du rÃ©sultat masquÃ©s quand il n'y a rien (objectif recherche sans plan). PrioritÃ©s par dÃ©faut d'un objet : place âº machines âº Ã©nergie âº prix (les prioritÃ©s dÃ©jÃ  enregistrÃ©es ne changent pas). Chiffres de la rÃ©ponse : cases au sol, machines, Ã©nergie, prix ; la pollution passe en tÃªte de DÃ©tails (objet, argent ; l'Ã©nergie la garde). En-tÃªte : bouton Â« â page prÃ©cÃ©dente Â» retirÃ©, Â« â¶ Je joue Â» / Â« â¸ En jeu Â» Ã©crit, Â« Â· hors jeu Â» retirÃ© de la puce (le bouton le dit), en-tÃªte jusqu'Ã  1 280 px ; rappel Â« Tu jouais encore ? Â» en bandeau sous l'en-tÃªte (â = arrÃªtÃ© Ã  la fermeture).
  Parcours A refait (partie vide, port 5181) : page d'arrivÃ©e vide en 0 geste ; Â« Crankshaft Â» tapÃ© â 60 apparaÃ®t, Â« ne peut pas encore Ãªtre produit Â» ; Â« C'est fait, je les ai dÃ©bloquÃ©es Â» â 158 machines, chiffres 3 996 cases Â· 158 machines Â· 609,2 kMF/s Â· 426 k$. `#accueil` â `#objet`, `#donnees/batiments` â Contribuer. Bandeau de rappel simulÃ© (2 h) : affichÃ© sous l'en-tÃªte. En-tÃªte sur une ligne Ã  1 366 px (partie de l'utilisateur, Arbre, trois puces) ; tÃ©lÃ©phone 375 px sans dÃ©bordement.
  Ã surveiller : au tÃ©lÃ©phone, le menu dÃ©file et Â« Contribuer Â» est coupÃ© Ã  droite (comme Â« DonnÃ©es Â» avant) ; les joueurs existants gardent leurs objectifs remplis et leurs anciennes prioritÃ©s (Ã©nergie d'abord) : seul un nouveau joueur a le nouvel ordre ; le titre de la page reste Â« Produire un objet Â» (la maquette disait Â« Que veux-tu produire ? Â»).
- **2026-10-20, S24** (442 tests, dÃ©ployÃ©) : modÃ¨le donnÃ© par l'utilisateur (visite guidÃ©e de son site de philosophie), maquette `maquette/orientation.html` validÃ©e (Q25 : bulle fixe en bas, dÃ©tail qui entre dans les vues). `src/ui/tour.ts` : voile, projecteur, bulle fixe en bas, l'essentiel (8 Ã©tapes) puis Â« Oui, le dÃ©tail â¶ Â» / Â« Non merci Â» ; dÃ©tail en 8 Ã©tapes qui ouvrent le schÃ©ma, l'usine complÃ¨te (module par module), les prioritÃ©s, le filtre de machines, Ma recherche, l'arbre et les recettes ; Ãchap ferme ; clic dans le sombre seulement Ã  la derniÃ¨re Ã©tape. Bouton Â« ? Â» dans l'en-tÃªte (visite complÃ¨te). Ouverture automatique Ã  la premiÃ¨re visite seulement (partie vide, clÃ© `ind-calc:v1:visite`). Pendant la visite, la page montre un exemple (60 Crankshaft/min, toutes les recherches, sans filtre) : rien n'est enregistrÃ© (`saveSettings` suspendu), la progression et les rÃ©glages reviennent Ã  l'identique Ã  la fin.
  Parcours rÃ©el : partie de l'utilisateur, Â« ? Â» â 16 Ã©tapes, schÃ©ma dessinÃ©, usine calculÃ©e (73 Ã 133 cases, 12 modules) et Ã©clairÃ©e ; Ã  la fin, rÃ©glages enregistrÃ©s identiques, 128 recherches, retour sur Mon usine. Partie neuve (port 5183) : la visite s'ouvre seule, 8 Ã©tapes puis le choix ; Â« Non merci Â» â page vide, comme avant.
  Ã surveiller : l'usine de l'exemple est encore cadrÃ©e sur la parcelle quand elle est renseignÃ©e (S25) ; les captures du navigateur intÃ©grÃ© Ã©chouaient (fenÃªtre masquÃ©e) : parcours fait par le DOM ; les joueurs existants ne voient la visite que par Â« ? Â».
- **2026-10-20, S24 bis** (retours de l'utilisateur sur la visite en ligne, 442 tests, dÃ©ployÃ©) : 1 Â« si ya rien comme objet, la ligne qui est ciblÃ©e est juste vide Â» â l'exemple se dessine dÃ¨s le dÃ©part (la page n'Ã©tait pas redessinÃ©e quand l'adresse restait `#objet`) ; 2 l'Åil ne suit pas le premier projecteur avec la bulle fixe â le projecteur part de la bulle et glisse vers sa cible, puis pulse Ã  chaque Ã©tape, et un bouton Â« Bulle fixe â / Bulle qui suit â Â» dans le coin de la bulle (choix gardÃ©, `ind-calc:v1:visite-bulle`) ; 3 et 5 Â« le site nous empÃªche d'interagir pour expÃ©rimenter Â» â quatre volets autour du projecteur : la vue Ã©clairÃ©e reste utilisable (schÃ©ma, usine, prioritÃ©s, filtre, arbre, recettes : Â« Essaie : â¦ Â») ; Â« Marquer comme dÃ©bloquÃ©e Â» n'enregistre rien pendant la visite ; 4 l'usine : l'avancement du calcul s'affiche dans la bulle, la page ne dÃ©file plus pendant la visite (`html.touring`), le projecteur se recale sur le dessin ; arbre et recettes Ã©clairÃ©s en entier (`.rs-workspace`, `#rc-layout`) ; 6 dÃ©filement des recettes corrigÃ© par le blocage de la page ; 7 Â« plus tard lors de l'ajout du systÃ¨me de proposition et de remarque [â¦] faudra le mettre dans le tuto Â» â notÃ© dans S16 (R15).
  ContrÃ´lÃ© par le DOM, 1 366 Ã 768 : 16 Ã©tapes, cibles sous l'en-tÃªte et au-dessus de la bulle, avancement de l'usine affichÃ© pendant â 4,5 s puis projecteur sur le dessin, bulle qui suit sous la cible, fin : page dÃ©bloquÃ©e, partie intacte. PiÃ¨ge : `overflow: hidden` sur `body` dÃ©croche l'en-tÃªte collant (seulement sur `html`).
- **2026-10-20, S24 ter** (442 tests, dÃ©ployÃ©) : retour Â« toujours un peu boguÃ© au niveau des craft, on a du mal Ã  bien dÃ©filer et tout voir. Et j'ai fait boguer au niveau du schÃ©ma en sÃ©lectionnant un Ã©lÃ©ment, en me dÃ©plaÃ§ant puis en le dÃ©sÃ©lectionnant Â» â aux Ã©tapes oÃ¹ l'on essaie (schÃ©ma, usine, rÃ©glages, arbre, recettes), la page dÃ©file normalement ; elle n'est figÃ©e qu'aux Ã©tapes oÃ¹ l'on regarde ; le projecteur suit sa cible en continu (dÃ©filement, page qui grandit quand un bloc est sÃ©lectionnÃ©, calcul de l'usine), Ã©claire seulement la partie visible (entre l'en-tÃªte et la bulle) et laisse un voile plein quand la cible est sortie de l'Ã©cran. ContrÃ´lÃ© (DOM, 1 366 Ã 768) : bloc sÃ©lectionnÃ©, dÃ©filÃ© de 300 px aller-retour, dÃ©sÃ©lectionnÃ© : projecteur sur le cadre Ã  chaque fois ; recettes dÃ©filÃ©es de 400 px.
- **2026-10-20, S25** (442 tests, dÃ©ployÃ©) : onglets du rÃ©sultat Usine (ex-Â« Plans de pose Â», ouvert sur toute l'usine), SchÃ©ma, Liste des machines, DÃ©tails ; onglet ouvert par dÃ©faut : Usine, calcul module par module par dÃ©faut (nouveaux joueurs ; les rÃ©glages enregistrÃ©s sont gardÃ©s). Panneau : le dessin d'abord, au-dessus la liste Â« Vue Â» et trois boutons (Tout afficher, RÃ©seau Ã©lectrique, Afficher les liaisons) ; Â« CÃ¢bles Â» retirÃ© ; calcul, liaisons collÃ©es, disposition des modules (ex-Â« PrioritÃ©s du plan Â») et tuyaux de tier III dans Â« Plus d'options Â». Dessin cadrÃ© sur l'usine, la parcelle en repÃ¨re. Liste Â« Modules Â» sous le dessin avec Â« posÃ© â Â» (gardÃ© par plan avec la liste Ã  cocher, clÃ© `posÃ©:`), le module cochÃ© se grise. Pendant un recalcul, l'ancienne usine reste affichÃ©e, estompÃ©e, avec l'avancement par-dessus : la page ne bouge plus. Liaison vers une place rÃ©servÃ©e (eau de la ferme) : une note avec les noms du jeu (Â« Water : Water â Oak Log Â»), plus en rouge.
  Parcours D refait (port 5181, Crankshaft 60/min, 14 recherches) : onglet Usine en 1 geste, dessin Ã  738 px sous la barre, mesures identiques Ã  S15 (recalculÃ©e 72 Ã 139 cases, 1 130 cases de tuyau, 102 croisements, 609,2 kMF/s ; module par module 1 274 cases, 100 croisements) ; module Crankshaft cochÃ© â grisÃ©, gardÃ© au rechargement ; recalcul : 0 px de dÃ©calage ; tÃ©lÃ©phone 375 px sans dÃ©bordement.
  Ã surveiller : les joueurs existants gardent leur onglet et leur calcul enregistrÃ©s (recalculÃ©) ; Â« Tout dÃ©cocher Â» de la liste garde les modules posÃ©s ; l'ordre de pose reste celui du calcul (S26).
- **2026-10-20, S26** (444 tests, dÃ©ployÃ©) : l'ordre de pose d'un module est rangÃ© par Ã©tape du joueur (bÃ¢timents, tuyaux, Ã©lectricitÃ©, logique quand il y en a), chacune avec sa touche du mode construction (1 Â« & Â», 3 Â« " Â», 2 Â« Ã© Â» en AZERTY) ; Â« l'onglet 3 du mode construction Â» devient Â« en mode tuyaux (touche 3) Â» (`phaseOf`, `phasedOrder`, `renderOrder` dans module-view.ts, sans toucher au moteur). Dans l'usine, les directions tournent avec le module (`turnOrderText` : Ã  gauche, par le haut, vers le haut, au-dessus et au-dessous, les uns sous les autresâ¦, sens horaire) ; l'avertissement Â« dÃ©crit le module avant sa rotation Â» est retirÃ©. Panneau d'un module : Â« Module posÃ© â Â» en tÃªte (mÃªme rÃ©glage que la liste sous l'usine), ordre de pose repliÃ©.
  ContrÃ´lÃ© : 12 modules de l'usine Crankshaft (module par module, 7 tournÃ©s) ouverts un par un ; Crankshaft et Liquid Iron : bÃ¢timents, tuyaux, Ã©lectricitÃ© avec leurs touches, Â« posÃ© Â» cochÃ© ou non comme dans la liste. Tests : rangement de phrases rÃ©elles du moteur, quatre rotations et aller-retour.
  Ã surveiller : le classement repose sur la forme des phrases du moteur (un test le garde) ; les ensembles modulaires (ferme, moteur) gardent leur ordre de pose d'avant ; aucune Ã©tape Â« logique Â» n'existe encore dans les modules.
- **2026-10-23, S27** (445 tests, dÃ©ployÃ©) : capture de l'utilisateur (usine recalculÃ©e, Atmospheric Distillation Plant â Light Oil, bouts de tuyau gris sans destination) : ce sont les sous-produits que la chaÃ®ne n'utilise pas (Residue, Heavy Oil, Naphtha, Gasolineâ¦), dont le collecteur s'arrÃªtait au bord du module. Moteur (`factory.ts`) : `factoryInput` liste ce qu'il faut Ã©vacuer (tout le sous-produit, ou son surplus aprÃ¨s les liaisons, boucles comprises : les mÃªmes quantitÃ©s que Â« Ã Ã©vacuer Â» de la rÃ©ponse) ; aprÃ¨s la pose, chaque produit part par un tuyau jusqu'au bord de l'usine (le plus proche, ou celui choisi) : en module par module depuis un bout rÃ©servÃ© devant la sortie (avant les liaisons, pour qu'aucun tuyau n'y passe), en recalculÃ© depuis le collecteur du module ou, s'il a Ã©tÃ© retirÃ© (produit en partie consommÃ©), depuis le tuyau qui part dÃ©jÃ  vers un client ; `FactoryPlan.evacs`. Site : tracÃ© et flÃ¨che au bord avec le nom du produit, liste Â« Ã Ã©vacuer Â» sous les modules avec le bord au choix (gardÃ© par plan, `settings.evacSides`), dans la clÃ© du calcul. Demande en passant : glisser un cadre (schÃ©ma, usine, arbre, Ã©diteur) ne sÃ©lectionne plus de texte (`user-select: none`, comme le graphe du site de philosophie de l'utilisateur, et sur toute la page pendant le glisser) ; Ã©tiquette Â« ta parcelle Â» dÃ©placÃ©e en bas Ã  gauche.
  ContrÃ´lÃ© : Light Oil 60/min sur la progression de l'utilisateur (prioritÃ©s place âº machines âº Ã©nergie) : Â« Ã Ã©vacuer : Heavy Oil 53,3/min, Residue 20/min Â» dans la rÃ©ponse comme dans la liste, deux tuyaux tracÃ©s jusqu'au bord en recalculÃ© et en module par module, aucune liaison non tracÃ©e ; Residue mis Â« en haut Â» â gardÃ© et recalculÃ©. Test moteur : Light Oil (toutes recherches), les deux modes, bord le plus proche et bord imposÃ©, case finale sur le bon bord.
  Ã surveiller : le plan exact de la capture n'a pas Ã©tÃ© reproduit (autres rÃ©glages dans le navigateur de l'utilisateur) : Ã  revÃ©rifier chez lui ; le produit final (objectif) n'a pas de tuyau vers le bord ; les mesures du Crankshaft ne changent pas (aucun sous-produit inutilisÃ© dans ce plan).
- **2026-10-23, S28** (452 tests avec S27, dÃ©ployÃ©) : maquette dÃ©jÃ  validÃ©e (Ã©crans 3 et 5 de `maquette/revue.html`, Q24). **Ton plan** (`plan-bar.ts`) entre la rÃ©ponse et les onglets : prioritÃ©s (â = ordre par dÃ©faut s'il a changÃ©), machines permises (â = toutes), machines fixÃ©es (S8), recettes choisies, Ã©cran des machines (S10), moteur diesel (S18), options avancÃ©es ; chaque pastille ouvre son rÃ©glage (formulaire dÃ©pliÃ©, ou le bloc dans le schÃ©ma), â l'annule ; Â« â  N valeurs Ã  vÃ©rifier â¾ Â» liste chaque valeur douteuse du plan en mots de joueur (Â« sortie Gear â 20 (Miraheze) ou 10 (Fandom) Â») et mÃ¨ne Ã  la correction (fiche en mode Â« â Corriger Â», la case sÃ©lectionnÃ©e ; sinon Contribuer). Les notes Â« recettes choisies Â» et Â« filtre de machines Â» de la rÃ©ponse sont retirÃ©es (dans la barre). **Barre du bloc** : â  en clair, puis Â« Tu peux rÃ©gler : Â» machines, recette (nouveau : comme DÃ©tails), Ã©cran, moteur, Â« Ne plus utiliser Â» ; Â« Voir le module dans l'usine â¸ Â» ouvre son panneau dans l'usine. **â  cliquable** sur le bloc du schÃ©ma, la ligne de la liste, le module de l'usine et son panneau. **SchÃ©ma** : la vue de dÃ©part montre toute la chaÃ®ne (place gardÃ©e pour les boutons de zoom) ; â¤¢ y revient (â retirÃ©, en double) ; les boutons du cadre n'entament plus de glisser ; de loin (moins de 75 %), les blocs n'affichent que le nom et les machines en gros et les Ã©tiquettes des flÃ¨ches au survol.
  ContrÃ´lÃ© (navigateur intÃ©grÃ©, 1 366 Ã 768 et 375 px, partie neuve sur un second serveur) : parcours E en 2 gestes depuis le rÃ©sultat (Â« â  2 valeurs Ã  vÃ©rifier Â» â ligne Oak Log â fiche en mode Corriger, case de la sortie sÃ©lectionnÃ©e) ; chaque rÃ©glage S8, S9, S10, S18 et une recette choisie, posÃ©s puis annulÃ©s par â ; Â« Voir le module dans l'usine Â» ouvre le panneau du Crankshaft. FusionnÃ© avec S27 (liste Â« Ã Ã©vacuer Â» sous les modules gardÃ©e, â  des modules ajoutÃ©s).
  Ã surveiller : le Crankshaft n'a plus de valeur Ã  vÃ©rifier (durÃ©e et Ã©nergie relevÃ©es en jeu le 2026-10-12, `overrides.json`), le parcours E s'est fait sur la valeur douteuse du plan (Oak Log) ; sur une longue chaÃ®ne (10 colonnes), la vue complÃ¨te tombe Ã  35 % : noms lisibles (â 9 px), machines petites ; les textes des doutes gardent les rÃ©fÃ©rences du projet (Â« MOD-09 Â») jusqu'Ã  S29.
- **2026-10-24, S27 bis** (452 tests, dÃ©ployÃ© ; a43b994 puis ce bilan) : retours de l'utilisateur aprÃ¨s S27. 1 Â« sur chaque tuyaux d'Ã©vacuation on a une section qui est coupÃ©e au niveau de la sortie du module, c'est juste un oublie de reconnexion Â» â la case oÃ¹ le tuyau d'Ã©vacuation se raccorde (bout devant la sortie, ou collecteur) fait partie du tracÃ©. 2 Â« dans un module, quand on clique sur un tuyau ou qu'on le survol on a aucune info dessus Â» â infobulle sur chaque machine, prise, tuyau (produit, collecteur ou liaison, dÃ©bit, tuyau et sa limite, piÃ¨ce), bout de tuyau et poteau d'un module, aussi dans le panneau d'un module de l'usine ; le clic garde ce texte avec â. 3 Â« Le calcul est trÃ¨s lourd pour les grosses machine (10min Ã§a commence Ã  faire) [â¦] sans dÃ©naturer le calcul attention Â» â le calcul est le mÃªme, il va plus vite : placement (carte des places libres, scores prÃ©calculÃ©s par rotation), tracÃ© des liaisons (file de prioritÃ©, chercheur sur des tableaux de nombres qui lit la grille une fois par case, sens en nombres), et un tour de tracÃ© qui referait exactement le prÃ©cÃ©dent n'est plus refait ; chaque usine calculÃ©e est gardÃ©e dans le navigateur (IndexedDB, les 12 derniÃ¨res, refaite si le code du calcul ou les donnÃ©es changent : `__FACTORY_VERSION__` dans vite.config.ts) et la rouvrir est immÃ©diat (Â« gardÃ©e dans ce navigateur : reprise sans recalcul Â»).
  ContrÃ´lÃ© : empreinte exacte du rÃ©sultat (modules, cases et liaisons de chaque tuyau, liaisons, Ã©vacuations, poteaux, chiffres) identique avant et aprÃ¨s sur 8 plans (Crankshaft Ã3, Gearbox Ã2, Light Oil Ã2, Steel Plate) et sur Electric Motor 60/min recalculÃ© (48 modules, 486 machines). Temps : Gearbox 60/min recalculÃ© 22,6 s avant S27 bis â 5,7 s ; Electric Motor : plus de 30 min avant S27 bis (arrÃªtÃ©), 453 s avec a43b994 â 145 s (passages entre machines 414 s â 105 s ; placement 23 s). Navigateur (Light Oil 60/min, Â« Tout afficher Â») : Residue et Heavy Oil sortent du collecteur sans coupure, en module par module et en recalculÃ© ; page rechargÃ©e â usine reprise aussitÃ´t ; survol et clic d'un tuyau du module Light Oil (Â« Steam â collecteur d'entrÃ©e de Light Oil, 6,67/s Â· tuyau tier III (jusqu'Ã  120/s) Â· PiÃ¨ce : tuyau droit Â»).
  Ã surveiller : Electric Motor recalculÃ© reste long au premier calcul, presque tout dans l'essai des passages entre machines (chaque essai refait le tracÃ© de toute l'usine) ; son usine (386 Ã 160) ne tient pas sur la parcelle et garde 14 liaisons non tracÃ©es, comme avant ces changements (mÃªme rÃ©sultat), donc aucun passage n'y est jamais gardÃ©.
- **2026-10-24, S29** (458 tests, dÃ©ployÃ©) : maquette dÃ©jÃ  validÃ©e (Ã©cran 7 et tableau 8 de `maquette/revue.html`, Q24). **Mon usine en deux onglets** : Â« Ma partie Â» (`#usine` : recherches dÃ©bloquÃ©es et Â« dÃ©penser ses RP Â», machines spÃ©ciales repliÃ©es derriÃ¨re leur compte, ressources et parcelle, production en place, transfÃ©rer) et Â« Ma recherche Â» (`#usine/recherche`, S20 et S21) ; le champ des RP garde le dernier relevÃ©, Ã  cÃ´tÃ© Â« RelevÃ© il y a 3 h 35 min de jeu (saisi le â¦) Â· â 226 237 RP maintenant Â» ; la puce RP de l'en-tÃªte, l'arbre, la visite et l'objectif RP mÃ¨nent Ã  Ma recherche. **Arbre** : option Â« DÃ©bloquer : Panneau / Bulle Â» (Panneau par dÃ©faut, choix gardÃ©, `ind-calc:v1:arbre-bulle`) ; en mode bulle, un clic sur une recherche ouvre Ã  cÃ´tÃ© d'elle une bulle (prix, Ã©tat, durÃ©e Ã  ton rythme, mÃªmes boutons que le panneau, â ou Ãchap), qui suit le glisser et le zoom. **Vocabulaire** : plus d'identifiant de craft (Â« Craft blast_furnace_09 Â» dans Comment c'est calculÃ©, Â« Recette â¦ Â» dans Contribuer, `recipes/â¦` dans Mes corrections), plus de nom de champ (`durationS` dans â Corriger), plus de rÃ©fÃ©rence du projet (RP-04 Ã  RP-12 â Â« supposÃ© Â», MOD-xx â Â« Ã  relever en jeu Â», Â« Ã  m'envoyer Â», `data/overrides.json`) ; noms numÃ©rotÃ©s avec une espace (dÃ©cision S29 Noms, Â§ 5) ; l'Ã©nergie en Â« 4 kMF/s Â» partout, aussi dans les â  et les cases Ã  corriger (Â« 4 k Â» se lit 4 000 MF/s) ; Â« DÃ©bit voisin mieux rempli Â» â Â« Ã 108/min au lieu de 60/min, tes machines tournent Ã  95 % (85 % ici) Â» (Light Oil) ; Â« Recherche manquante pour Craft Assembler (4 825 RP) Â» et Â« Ã dÃ©bloquer pour tout ce plan (9 735 RP en tout) Â» ; Â« Partie importÃ©e : N/146 recherches dÃ©bloquÃ©es Â», le mÃªme compte que l'en-tÃªte (non essayÃ© avec un vrai fichier). Test `vocabulaire.test.ts` : plans Crankshaft, Light Oil, Steel Plate (toutes recherches et partie neuve), panneau de chaque bloc, valeurs Ã  vÃ©rifier, fiches et arbre, avec les vraies donnÃ©es : aucun identifiant Ã  plusieurs morceaux, nom de champ, rÃ©fÃ©rence ni nom collÃ©.
  ContrÃ´lÃ© (navigateur intÃ©grÃ©) : Ma partie 1 915 px et Ma recherche 1 994 px au tÃ©lÃ©phone (375 px, partie d'essai, au-delÃ  du seuil), sans dÃ©bordement ; bulle ouverte sur Water Pump 2, son bouton ouvre le mÃªme dialogue que le panneau (annulÃ©), elle suit le glisser ; partie neuve (port 5187) : 60 Crankshaft/min tapÃ©s, les deux nombres de RP nommÃ©s ; 17 vues parcourues sans identifiant ni rÃ©fÃ©rence. Empreintes de l'usine identiques sur les 8 plans (les noms ne changent pas le calcul).
  Ã surveiller : en mode Â« DÃ©taillÃ© Â» ou avec beaucoup de stations, Ma recherche peut repasser au-dessus de 2 000 px au tÃ©lÃ©phone ; la pollution reste en Â« %/h Â» (F4, pas de mot proposÃ© dans la maquette) ; j'ai d'abord modifiÃ© deux fichiers avec `sed` (mÃªme contenu), la rÃ¨gle de l'utilisateur est Write/Edit.
- **2026-10-24, S16** (458 tests, sans code du site, non dÃ©ployÃ©) : Q13, Q26 (remarques) et Q27 (accessibilitÃ©) posÃ©es puis rÃ©pondues (Â« complÃ¨tement ok pour touuuut Â», pseudo Orangentleman, relecture par l'utilisateur, rÃ©fÃ©rence mindustryschematics.com, tableau de bord et Propositions finis avant de poster le lien, salon Discord rÃ©servÃ©) ; tour du site en nouveau venu (port 5189, `calculateur-public`, 1 366 et 375 px, clair et sombre, contrastes et cibles mesurÃ©s par le DOM) â 12 points P1 Ã  P12 ; [PLAN-PUBLIC.md](PLAN-PUBLIC.md) (traduction, forme, visiteurs, remarques, service sur le Pi, lots, risques) ; maquette `maquette/public.html` validÃ©e (Q28) ; lots S30 Ã  S37 placÃ©s au Â§ 2, S17 aprÃ¨s S37.
  Mesures : â 1 400 textes en dur dans `src/ui`, 800 dans `src/engine`, 55 dans `index.html` ; contrastes trop faibles : bouton principal en sombre 2,4:1, â  de Recettes en clair 3,9:1 ; au tÃ©lÃ©phone, menu coupÃ© sur les six pages, 11 cibles sous 24 px sur Planifier et 19 sur Ma partie, Recettes 10 500 px ; aucune erreur en console ; Node 24 et â 630 Mo libres sur le Pi (lecture seule, rien modifiÃ©).
  Ã surveiller : les mots anglais du jeu (case, parcelle, modes de construction) sont Ã  chercher sur le wiki au dÃ©but de S30 ; les textes SVG (schÃ©ma, usine, arbre) faussent la mesure automatique des contrastes : contrÃ´le Ã  l'Åil en S33 ; le service des remarques demandera un rechargement de nginx sur le Pi (accord avant, S34).
- **2026-10-24, S30** (470 tests, dÃ©ployÃ©) : glossaire validÃ© (Â« ok pour tout Â», Q29) ; `src/i18n/` (`fr.ts` source, `en.ts` du type de `fr` : une clÃ© oubliÃ©e fait Ã©chouer `npm run typecheck`, essayÃ© ; `t()` avec trous et `Intl.PluralRules` ; `dom.ts` pour les `data-i18n` d'`index.html`) ; bouton FR / EN dans l'en-tÃªte, langue du navigateur au premier passage puis choix gardÃ© (`ind-calc:v1:langue`), page redessinÃ©e sur place ; nombres, $, %, durÃ©es et dates selon la langue (`format.ts`, `fmtDate`) ; traduits : squelette, `<title>`, description, en-tÃªte, menu, pied de page, rappel Â« Tu jouais encore ? Â», Planifier (formulaire, prioritÃ©s, filtre de machines, options avancÃ©es, rÃ©ponse et chiffres, barre Â« Ton plan Â», machines fixÃ©es, noms des onglets et textes fixes des cadres).
  ContrÃ´lÃ© (navigateur intÃ©grÃ©, 1 366 et 375 px) : FR â EN â FR sans recharger, choix gardÃ© au rechargement, `<html lang>` et titre suivent ; sur les quatre objectifs en anglais, il ne reste en franÃ§ais que le contenu des onglets (S31) et les notes des donnÃ©es et du moteur (S32) ; en-tÃªte sur une ligne Ã  1 366 px dans les deux langues ; aucune erreur en console. 12 tests nouveaux (`src/i18n/i18n.test.ts` : langue de dÃ©part, pluriels, nombres, mÃªmes clÃ©s et mÃªmes trous, pas de franÃ§ais dans `en.ts`, clÃ©s d'`index.html`).
  Ã surveiller : la saisie des nombres lit encore la virgule comme dÃ©cimale (`parseInput`, Â« 1,234 Â» en anglais donne 1,234) : Ã  rÃ©gler en S31 avec les vues qui l'utilisent ; le nom franÃ§ais reste Â« Calculateur Industrialist Â» jusqu'Ã  S33 ; la dÃ©tection de la langue du navigateur n'a Ã©tÃ© essayÃ©e que par test (le navigateur intÃ©grÃ© est en franÃ§ais).
- **2026-10-18, aprÃ¨s S13** : deux nouveaux retours (R11, R12) ajoutÃ©s au plan sous forme de lots de planification, sans code : S16 (site en anglais et ergonomie, pour le Discord) et S17 (bac Ã  sable : construire sa chaÃ®ne, tracÃ© des tuyaux Ã  la Mindustry). Questions Q13 et Q14 Ã  poser au dÃ©but de ces lots. Ordre : S14, S15, S16, S17.
- **2026-10-25, S31** (479 tests, dÃ©ployÃ©) : toutes les vues de `src/ui` passent par `t()` (1 594 clÃ©s dans 8 catalogues `src/i18n/vues/*.fr.ts` / `.en.ts`), visite comprise (Ã©tapes = clÃ©s), textes fixes d'`index.html` des quatre autres pages balisÃ©s, Ã©diteur de bÃ¢timents redessinÃ© au changement de langue (`buildings.refresh()`) ; restes de S30 rÃ©glÃ©s (`parseNum` pour `parseInput`, `parseEnergy`, `readNum`, `parseOptional`â¦ ; `pluralFr` / `joinFr` retirÃ©s au profit des pluriels du catalogue et de `joinList`). Test `src/ui/traduction.test.ts` : aucun texte franÃ§ais Ã©crit en dur dans `src/ui` (chaÃ®nes et morceaux de gabarits, exceptions listÃ©es : codes du moteur, fichiers exportÃ©s), chaque texte franÃ§ais d'`index.html` porte sa clÃ©, et en anglais les vues de `vocabulaire.test.ts` ne montrent ni accent ni mot franÃ§ais (noms du jeu et textes S32 mis de cÃ´tÃ©).
  ContrÃ´lÃ© (navigateur intÃ©grÃ©, 1 366 et 375 px) : visite jouÃ©e en entier en anglais (16 Ã©tapes) ; repÃ©rage automatique du franÃ§ais visible (textes, infobulles, titres SVG) sur Planifier (objets, Ã©nergie, RP ; 4 onglets, chaque bloc du schÃ©ma, usine complÃ¨te, module seul et dans l'usine, ferme d'arbres), Mon usine (deux onglets, saisie rapide et dÃ©taillÃ©e, historique), Arbre, Recettes (fiches, mode Corriger, erreurs du formulaire, lignes), Contribuer (toutes les valeurs, 5 bÃ¢timents) : rien hors S32 ; Â« 15,000 Â» lu 15 000 en anglais ; FR â EN sur place ; aucun dÃ©bordement Ã  375 px ; aucune erreur en console.
  Ã surveiller : textes du moteur et des donnÃ©es visibles en franÃ§ais en anglais (ordre de pose, avertissements, contrÃ´les Â« comme en jeu Â», noms d'installation du moteur diesel, gabarit Â« double rangÃ©e Â») : S32 ; la touche AZERTY Â« Ã© Â» reste citÃ©e en anglais ; Â« Contribute Â» coupÃ© Ã  droite au tÃ©lÃ©phone (P6, S33) ; dÃ©cision de visite automatique (Â« Tu sais t'orienter Â») contrÃ´lÃ©e par le code seulement.
- **2026-10-25, S32** (484 tests, dÃ©ployÃ©) : aucun message du moteur n'est Ã©crit en dur : 273 morceaux de phrase de `src/engine` et `src/engine/build` deviennent des codes (202 clÃ©s `eng.*`), y compris l'ordre de pose (Ã©tape du joueur lue sur le code, plus sur la phrase), les avertissements du calcul, les contrÃ´les Â« comme en jeu Â» de Ma recherche, les noms d'installation du moteur diesel et de la ferme, les gabarits, la pousse des arbres, les rÃ©glages des interfaces et les erreurs des fichiers de corrections. 211 notes des donnÃ©es affichÃ©es traduites (`data/i18n/en.json` : 143 textes + 9 notes Ã©crites par le site ; rÃ¨gles pour les gabarits des scripts) ; `frText` / `frRaw` retirÃ©s ; exceptions du test Â« rien d'oubliÃ© Â» rÃ©duites aux identifiants internes et aux notes des fichiers exportÃ©s. Tests nouveaux : `src/i18n/data-notes.test.ts` (aucune note affichÃ©e sans traduction, aucune traduction orpheline ou en franÃ§ais, marque Â« (FR) Â»), S26 rÃ©Ã©crit sur les codes (mÃªmes phrases franÃ§aises, rotation, anglais).
  ContrÃ´lÃ© : empreintes SHA-256 du moteur avant / aprÃ¨s sur 8 usines (Crankshaft Ã3, Gearbox Ã2, Light Oil Ã2, Steel Plate ; modules, tuyaux, poteaux, passages, avancement) et sur 12 plans, les modulaires, la recherche et les interfaces, avec les messages rÃ©Ã©crits en franÃ§ais : identiques, sauf deux phrases voulues (consigne de l'onglet 3 telle que le site l'affichait ; Â« 157 700,45 $ Â» avec sÃ©parateur de milliers) ; ordre de pose rangÃ© comme avant (test S26). Navigateur intÃ©grÃ© (1 366 et 375 px, FR et EN) : usine entiÃ¨re et module tournÃ©, ferme d'arbres, 117 valeurs Ã  vÃ©rifier, fiches Recettes (Boiler, Firebox, moteur diesel, mouleur, Quarry), Ã©diteur de bÃ¢timents (blocs de la ferme et du moteur, interfaces), Mon usine, Ma recherche, objectifs Ã©nergie, RP, argent, arbre : aucun texte franÃ§ais ni Â« (FR) Â» en anglais, aucune erreur en console.
  CorrigÃ© ensuite Ã  la demande de l'utilisateur : la valeur Â« parts Â» de la ferme d'arbres (Contribuer) s'affichait Â« [object Object] Â» (dÃ©faut antÃ©rieur) ; elle s'Ã©crit Â« 1 Ã Tree + 1/44 Ã Tree Farm Sprinkler + â¦ par ferme Â» (test dans traduction.test.ts).
  Ã surveiller : sÃ©parateur Â« ; Â» franÃ§ais entre deux autres valeurs (Â« Other: â¦ ; â¦ Â») ; une collecte d'un objet Â« Logic â¦ Â» n'est plus rangÃ©e Ã  tort dans l'Ã©tape Logique (l'ancien classement lisait le mot Â« logic Â» dans la phrase) ; la touche AZERTY Â« Ã© Â» reste citÃ©e en anglais (S31).
- **2026-10-25, S33** (516 tests, dÃ©ployÃ©) : nom Â« Planificateur Industrialist Â» / Â« Industrialist Production Planner Â» partout (en-tÃªte, onglet, `site.webmanifest`), Â« Non officiel Â» Ã  cÃ´tÃ© du nom ; pied de page en deux lignes (auteur, donnÃ©es et licences) ; aperÃ§u des liens en anglais (`og:*`, en_US + fr_FR, nouvelle `og-image.png` tirÃ©e de `scripts/og-image.html`) ; contrastes : jeton `--on-accent` (texte sombre sur l'orange en sombre, 6,8:1 au lieu de 2,4:1), `--warn` clair `#8a5700` (5,4:1 au lieu de 3,9:1), test `src/ui/contraste.test.ts` (15 paires Ã 2 thÃ¨mes) ; contour du Â« RP Â» de l'arbre Ã©paissi ; en-tÃªte au tÃ©lÃ©phone sans dÃ©filement ; cibles â¥ 24 px au tÃ©lÃ©phone ; Recettes par 48 sous 900 px ; calcul long (temps Ã©coulÃ©, Â« ArrÃªter Â», passage au module par module ; le bouton de la boÃ®te posÃ©e sur l'ancienne usine, qui ne faisait rien, est branchÃ©) ; titres de Planifier en questions ; bulle de la pollution ; cadres du schÃ©ma et de l'usine renvoyant Ã  la Â« Liste des machines Â».
  ContrÃ´lÃ© (navigateur intÃ©grÃ©, port 5193, 375 px et 1 366 px, sombre et clair, FR et EN, mesure par le DOM) : sur les six pages, 0 cible sous 24 px au tÃ©lÃ©phone (avant : 42 sur Planifier avec l'Usine, 12 sur Mon usine, 4 sur Contribuer), menu entier, aucun dÃ©bordement, aucun texte HTML sous 4,5:1 ; textes SVG mesurÃ©s contre leur pastille (usine 27, schÃ©ma 82 : tous â¥ 4,5:1 ; arbre : le Â« RP Â» cyan ne tient que par son contour, Ã©paissi puis vu Ã  l'Åil) ; Recettes 2 349 px au tÃ©lÃ©phone (avant 10 491), Â« Afficher 48 de plus Â» garde le focus sur la premiÃ¨re tuile ajoutÃ©e ; calcul recalculÃ© : Â« ArrÃªter Â» dans la boÃ®te et dans l'en-tÃªte, focus sur Â« Relancer Â», Â« module par module Â» bascule l'option ; Ãchap ferme la fenÃªtre de confirmation et rend le focus au bouton ; schÃ©ma dÃ©placÃ© et zoomÃ© au clavier ; titre de l'onglet et `<html lang>` suivent la langue.
  AperÃ§u Discord vu par l'utilisateur dans son salon rÃ©servÃ© : Â« L'aperÃ§u Discord est bon. Â»
  Ã surveiller : au tÃ©lÃ©phone, l'ordre au Tab suit le DOM (nom, menu, mon usine, FR / EN, ?) et non les lignes affichÃ©es (FR / EN et ? sont sur la 1re ligne) ; la Â« Liste des modules Â» n'existe que dans l'Usine ; `index.html` reste en franÃ§ais avant le script (seuls les `og:*` sont en anglais).
- **2026-10-25, S34** (535 tests, service installÃ© sur le Pi ; site redÃ©ployÃ© sans changement visible) : `server/` (`service.ts` accÃ¨s publics et `/api/admin/`, `base.ts` SQLite + purge des empreintes Ã  24 h + copie de la nuit sans empreinte, `securite.ts` scrypt et HMAC, `remarques.ts` point d'entrÃ©e, `hacher.ts`) ; `server/service.test.ts` (19 tests, horloge simulÃ©e) ; `npm run remarques` + proxy `/api/` de Vite ; `scripts/pi/remarques.sh` (compte, unitÃ©, nginx de l'Industrialist, rien dÃ©marrÃ© ni rechargÃ©), `controle-myprism.sh`, `mot-de-passe.ps1` (`npm run remarques:mot-de-passe`), `relire-remarques.ps1`, `npm run deploy:remarques`.
  ContrÃ´lÃ© : en local par le navigateur (envoi, relecture par l'accÃ¨s rÃ©servÃ©, 6áµ refusÃ©e, cookie invisible au JS) ; en ligne par `https://industrialist.myprisme.fr/api/` (201, 6áµ â 429, autre Origin â 403, admin sans session â 401, relecture des 5 remarques d'essai par l'utilisateur avec son mot de passe) ; MyPrism identique avant / aprÃ¨s (PID, heures de dÃ©marrage, empreintes des fichiers). nginx rechargÃ© une fois et service dÃ©marrÃ©, avec accord.
  AprÃ¨s le bilan, avec l'accord de l'utilisateur : `cgroup_enable=memory` ajoutÃ© Ã  `/boot/firmware/cmdline.txt` et Pi redÃ©marrÃ© ; les `MemoryMax` sont maintenant appliquÃ©s (remarques 63 Mo sur 64, dont 30 Mo de cache de fichiers, aucun oom_kill, rÃ©ponses en 2 ms ; MyPrism sans limite, fichiers identiques, unitÃ©s actives).
  Ã surveiller : `NetworkManager-wait-online` Ã©choue au dÃ©marrage (aucun journal du dÃ©marrage prÃ©cÃ©dent pour savoir si c'est nouveau ; sans effet visible, tout est actif). Un +1 n'est unique que pendant 24 h cÃ´tÃ© service (l'empreinte s'efface ensuite) : S36 doit aussi le retenir dans le navigateur. La saisie masquÃ©e par `ssh -t` dans le terminal de l'application n'a pas marchÃ© (deux Ã©checs) : le mot de passe se tape sur le PC. 5 remarques d'essai restent dans la base (Ã  supprimer depuis le tableau de bord en S36).
- **2026-10-25, S35** (545 tests, service et site en ligne, `e95e2fa`) : maquette `maquette/remarques.html` validÃ©e (ce que S16 ne couvrait pas) ; Â« ð¬ Remarque Â» dans l'en-tÃªte et le pied de page, fenÃªtre `<dialog>` (`src/ui/remarques-view.ts`, `remarques.ts`, catalogue `vues/remarques.*.ts`) : type, texte, pseudo, case piÃ¨ge, page + plan + version (`__SITE_VERSION__`) joints, brouillon gardÃ©, renvoi au Discord du jeu avec @orange ; Â« Mes remarques Â» (nÂ° court, Ã©tat, rÃ©ponse, pastille, Â« Oublier Â», relu Ã  l'ouverture et une fois par jour) ; Â« ð¤ Envoyer mes corrections Â» (Contribuer, â Corriger) et Â« ð¤ Envoyer mes relevÃ©s Â» (Ã©diteur), fichier de l'export joint, Â« EnvoyÃ©es leâ¦ Â» ; Ã©tape 8 / 9 de la visite ; service : nÂ° court renvoyÃ©, `server/discord.ts` (webhook relu Ã  chaque remarque, sans mention, 300 caractÃ¨res), `npm run remarques:discord` (adresse collÃ©e par l'utilisateur, `/etc/industrialist-remarques/discord`).
  ContrÃ´lÃ© : en local (envoi, correction avec fichier complet, rÃ©ponse et pastille, service arrÃªtÃ© â message et texte gardÃ©s, trois boutons d'envoi, FR / EN, 375 et 360 px) ; en ligne, une remarque de chaque type (nÂ° 6 Ã  9) et une correction (nÂ° 10) reÃ§ues avec page, langue et version, la 6áµ refusÃ©e, rÃ©ponse d'essai lue dans Â« Mes remarques Â» ; webhook posÃ© par l'utilisateur, nÂ° 11 postÃ© et vu par l'utilisateur dans son salon (Â« le message nÂ° 11 est bien dans le salon Â»). Service redÃ©marrÃ© avec accord, nginx non rechargÃ©, MyPrism identique avant / aprÃ¨s.
  Ã surveiller : au tÃ©lÃ©phone, le logo est cachÃ© sous 400 px pour que ð¬ tienne sur la 1re ligne (une ligne jusqu'Ã  360 px) ; sur ordinateur Ã  1 366 px, avec une partie avancÃ©e (RP et Â« Je joue Â»), Â« ? Â» et ð¬ passent sur une 2áµ ligne (Â« ? Â» y passait dÃ©jÃ  avant) ; 11 remarques d'essai dans la base (nÂ° 1 Ã  11), Ã  supprimer en S36 ; le lien Â« Ouvrir dans le tableau de bord Â» du message Discord (`/tableau/#nÂ°`) ne marchera qu'avec S36 ; la rÃ©ponse d'essai du nÂ° 6 a Ã©tÃ© Ã©crite directement dans la base.
- **2026-10-26, S36** (565 tests, service redÃ©marrÃ© et site en ligne, `994756f`) : maquette `maquette/tableau.html` validÃ©e en deux tours (dÃ©cision S36 Remarques : votes comme sur Reddit au lieu du +1, traduction automatique, sujet crÃ©Ã© depuis la rÃ©ponse, langue dÃ©clarÃ©e) ; `/tableau/` (`src/tableau/`, page du build servie par nginx sans rÃ©glage nouveau) : entrÃ©e, boÃ®te (filtres, Â« Ã traiter Â», ouvrir = Â« Lue Â», Ã©tats), ranger, rÃ©pondre, Â« Enregistrer et crÃ©er un sujetâ¦ Â», sujets bilingues (Ã©tat, publication, rÃ©ponse Ã  tous les joueurs du sujet), corrections en JSON, export, suppression confirmÃ©e, `/tableau/#nÂ°` ; `#propositions` (`src/ui/propositions*.ts`) : votes â² / â¼ modifiables, identifiant de vote du navigateur, un vote par adresse et par sujet sur 24 h, 60 votes par heure, texte dans la langue du visiteur, Â« Traduit automatiquement Â» ; `server/traducteur.ts` (DeepL, `npm run remarques:traducteur`, traducteur d'essai en local) ; base : colonnes ajoutÃ©es sans perte, +1 devenus des votes â² ; fenÃªtre Remarque : langue dÃ©clarÃ©e, pseudo @orangentleman.
  ContrÃ´lÃ© : en local (nÂ° 1 envoyÃ©e du site en anglais, nÂ° 2 et 3 par l'API ; mauvais mot de passe refusÃ© ; traduction d'essai ; rÃ©ponse ; sujet crÃ©Ã© et publiÃ© depuis la rÃ©ponse ; 3 remarques rangÃ©es ; Ã©tat Â« PrÃ©vu Â» ; rÃ©ponse envoyÃ©e aux 2 autres joueurs ; Propositions Â« 3 joueurs l'ont demandÃ© Â» ; â², retrait, â¼, â² ; 2áµ navigateur Ã  la mÃªme adresse refusÃ© ; rÃ©ponse lue dans Â« My feedback Â» en anglais ; 375 px sans dÃ©bordement ni cible sous 24 px). En ligne : `/tableau/` et `/api/propositions` en 200, `/api/admin/` en 401 sans mot de passe, page Propositions vide affichÃ©e. Service mis Ã  jour puis redÃ©marrÃ© avec accord (51 Mo sur 64), nginx non rechargÃ©, MyPrism identique avant / aprÃ¨s.
  Ã surveiller : le parcours en ligne avec ton mot de passe (ranger, rÃ©pondre, publier, voter) reste Ã  faire par toi ou en S37 : je ne tape pas ton mot de passe ; la traduction n'a tournÃ© qu'avec le traducteur d'essai : DeepL a renommÃ© son offre gratuite (Â« Developer Â», 1 million de caractÃ¨res en tout, au lieu de Â« API Free Â» 500 000 par mois), la clÃ© reste Ã  crÃ©er et le suffixe Â« :fx Â» des clÃ©s gratuites est Ã  vÃ©rifier sur la vraie clÃ© ; les 11 remarques d'essai de S34-S35 sont gardÃ©es (dÃ©cision S36) ; le bundle principal dÃ©passe 1 000 ko (1 577 ko, dÃ©jÃ  1 567 ko avant S36).
  AprÃ¨s le bilan (2026-10-26) : clÃ© DeepL (offre Developer) posÃ©e par l'utilisateur ; essai sur le Pi par le code du service, sans lire la clÃ© : elle finit par Â« :fx Â» (api-free.deepl.com) et Â« Partager un plan par un lien Â» donne Â« Share a map via a link Â» (Â« plan Â» mal compris : la relecture avant publication est utile).
  Parcours en ligne (2026-10-26), l'utilisateur connectÃ© lui-mÃªme dans le navigateur intÃ©grÃ© (mot de passe jamais vu) : remarque nÂ° 10 envoyÃ©e du site en anglais ; l'utilisateur l'a rÃ©pondue, rangÃ©e dans un sujet crÃ©Ã© depuis elle, traduit par DeepL, publiÃ© (Â« PrÃ©vu Â»), et a votÃ© â² ; il a aussi supprimÃ© les remarques d'essai de S34-S35 (nÂ° 2 Ã  9, 10 et 11 d'avant). CÃ´tÃ© joueur : Propositions montre le sujet (score 2, Â« 2 joueurs l'ont demandÃ© Â»), le vote du navigateur intÃ©grÃ© est refusÃ© (Â« dÃ©jÃ  donnÃ© depuis cette connexion Â» : mÃªme connexion que celui de l'utilisateur, protection attendue), Â« Mes remarques Â» montre la rÃ©ponse et Â« SupprimÃ©e par l'auteur Â».
  Vu pendant le parcours : un nÂ° supprimÃ© est redonnÃ© Ã  la remarque suivante (SQLite sans AUTOINCREMENT : deux Â« nÂ° 10 Â» dans Â« Mes remarques Â», et un lien Discord `/tableau/#10` ancien ouvrirait l'autre) ; Â« 1 remarques Â» sans accord du pluriel sur Propositions. CorrigÃ©s avec accord (`afb15fb`, 566 tests) : le dernier numÃ©ro donnÃ© est gardÃ© dans `reglages` (`prochainNumero`, remarques et sujets), Â« 1 remarque Â» / Â« 1 request Â» ; service mis Ã  jour et redÃ©marrÃ©, site redÃ©ployÃ©, MyPrism identique. Le prochain numÃ©ro de remarque sera 11 (l'ancien nÂ° 11, supprimÃ© avant la correction, n'Ã©tait pas gardÃ©).
- **2026-10-26, S37** (566 tests, dÃ©ployÃ©, `853e155`) : rÃ©pÃ©tition gÃ©nÃ©rale en anglais sur le site en ligne, partie vide (stockage effacÃ©, langue EN), au clavier et Ã  375 px. Relecture de tout l'anglais : 10 pages et la visite entiÃ¨re lues, aucun mot franÃ§ais ni identifiant visible ; anglais clair. Parcours A (visite jouÃ©e en entier, puis partie vide), B (Crankshaft tapÃ© au clavier â Â« can't be made yet Â», Â« Done, I unlocked them Â» â 3 996 cases Â· 158 machines Â· 609,2 kMF/s Â· 426 k$, comme en S27), C (Foundry : chemin et Â« 276,350 RP Â»), D (module Craft Assembler : ordre de pose, piÃ¨ces Ã  acheter), E (â  Oak Log â Â« fix â¸ Â» â fiche Â« â Fix Â» en anglais). Remarque nÂ° 11 (idÃ©e, en anglais, pseudo Â« S37-test Â») envoyÃ©e du site en ligne : reÃ§ue, Ãchap ferme la fenÃªtre et le focus revient au bouton ð¬. Propositions au tÃ©lÃ©phone : sujet publiÃ©, traduit, votes ; aucune page ne dÃ©borde Ã  375 px.
  CorrigÃ© : aprÃ¨s la visite, l'usine de l'exemple (13 modules, Advanced Assembler) restait affichÃ©e sous un plan impossible jusqu'au rechargement (`renderPose` vide dÃ©sormais la liste des modules, la barre et les options) ; Â« ; Â» Ã  la franÃ§aise dans les listes en anglais (`semi()` dans `format.ts`, 7 vues) ; ordre de pose Â« Place 3 Ã MV Pole Â», Â« Place the 15 Ã Craft Assembler Â» (noms du jeu sans pluriel).
  Ã surveiller (peut attendre) : la suite du tour de la nÂ° 11 dans le tableau de bord (sujet, rÃ©ponse, publication) demande ton mot de passe, dÃ©jÃ  faite par toi en S36 avec la nÂ° 10 ; le message Discord de la nÂ° 11 est Ã  voir dans le salon ; Â« prerequisite(s) Â», Â« record(s) Â» : pluriels en Â« (s) Â», comme en franÃ§ais ; Â« (âÃ©â on AZERTY) Â» reste en anglais ; Ã  la fin de la visite le focus retombe sur la page ; l'ordre de pose montre Build 1, Pipe 3, Wire 2 (ordre de S26) ; bundle principal > 1 000 ko. Verdict : prÃªt pour le Discord dÃ¨s ta relecture de l'anglais.
- **2026-10-26, S17** (sans code du site, non dÃ©ployÃ©) : Q14 posÃ©e en 10 points et rÃ©pondue (dÃ©cision S17 Bac Ã  sable, Â§ 5) ; [PLAN-BAC-A-SABLE.md](PLAN-BAC-A-SABLE.md) : dÃ©cisions, modÃ¨le Mindustry (ce qu'on garde, ce qui ne s'applique pas), gestes ordinateur et tÃ©lÃ©phone, calcul d'un montage libre (rÃ©seaux, recettes dÃ©duites, point fixe des dÃ©bits, bilan, liaisons fausses, fluiditÃ© : < 16 ms par geste Ã  200 machines), ponts, lots **B1 Ã  B7** avec leurs critÃ¨res de fin, risques ; maquette cliquable `maquette/bac-a-sable.html` (vraies machines tirÃ©es des fichiers du jeu par `bac-a-sable.gen.mjs`) : â° par chapitre et catÃ©gorie, pose, R, dÃ©placer, tuyaux tracÃ©s au glisser, gomme, Ctrl+Z, recette dÃ©duite ou Â« ? Â», tuyau saturÃ© hachurÃ©, statistiques, lien mesurÃ© ; doutes BAS-01 Ã  BAS-03 dans `data/a-verifier.md`.
  ContrÃ´lÃ© (serveur `calculateur`, port 5173) : exemple Press (Iron Ingot) â Roller : le Roller dÃ©duit sa recette seul, 30 Iron Coil/min en sortie, 15 Iron Ingot/min Ã  fournir, 2 750 MF/s, aucune erreur en console.
  Ã surveiller : seules 31 machines sont posables (ports et recettes connus) ; maquette en attente de validation par l'utilisateur ; aucun lot B lancÃ©.
- **2026-10-26, S17 (2e tour)** (sans code du site, non dÃ©ployÃ©) : 1re maquette refusÃ©e (Â« Ã§a ne va pas du tout Â», s'inspirer Ã  100 % de Mindustry ; dÃ©cision S17 Mindustry, Â§ 5). Lecture du code source de Mindustry (Binding, DesktopInput, MobileInput, InputHandler, Placement, PlacementFragment, Conveyor) et de la page wiki Building System. Maquette refaite : menu de pose de Mindustry (cadre d'infos au survol, gardÃ© au clic, **?** = fiche ; grille, catÃ©gories, tiers Ã  droite ; schÃ©mas, base de donnÃ©es, arbre, liaisons sous la grille) ; bÃ¢timents non relevÃ©s grisÃ©s avec Â« ComplÃ©ter Â» ; pose en ligne sans diagonale ; tuyaux par famille, variantes, longueurs automatiques, virages, tÃ© et croisements non rusty posÃ©s seuls, piÃ¨ce posÃ©e sur un tuyau qui le recoupe ; zone supprimÃ©e au clic droit glissÃ© ; touches physiques (ZQSD en AZERTY), molette qui tourne, pipette, F/Z/X/T, F6, C, J, chiffres, flÃ¨ches ; tÃ©lÃ©phone (appui long, ð¨ â¬ â³ â) ; calcul par flot maximal avec limite par piÃ¨ce. [PLAN-BAC-A-SABLE.md](PLAN-BAC-A-SABLE.md) rÃ©Ã©crit (commandes, rÃ¨gles des tuyaux, lots **B1 Ã  B8**). RÃ©ponses BAS-01 (en partie) et BAS-02 notÃ©es ; BAS-03 Ã  BAS-06 ouverts. Parcours des sites signalÃ©s par l'utilisateur : industrialist-calculator.pages.dev et son dÃ©pÃ´t (MIT, planificateur en graphe) ; idÃ©es retenues au Â§ 6 du plan, leurs donnÃ©es servent de contrÃ´le et ne sont pas une source.
  ContrÃ´lÃ© (navigateur intÃ©grÃ©, port 5173, 1 366 Ã 768) : exemple 1, Press â Roller, 30 Iron Coil/min ; exemple 2, 5 Roller Ã  80 % et le tuyau de tier I saturÃ© (7,5/s pour 6/s) hachurÃ© ; exemple 3, 20 cases de tier III en 5 Long Pipe2, croisement objet Ã fluide posÃ© seul, Long Pipe2 coupÃ© en Pipe2 + Short Pipe2. Aucune erreur sur la page.
  Ã surveiller : 55 bÃ¢timents sur 220 et 32 piÃ¨ces de tuyau sur 43 sont posables ; la maquette n'a pas Ã©tÃ© essayÃ©e Ã  la souris par moi au-delÃ  des exemples (glisser, zone, F) ; maquette en attente de validation.
- **2026-10-26, S17 (3e tour)** (sans code du site, non dÃ©ployÃ©) : rÃ©ponses de l'utilisateur. Captures du menu Build (tiers I Ã  IV, non exhaustives) â catÃ©gories du jeu dans la maquette : Pipes, Logic, Power, Decorations, Factories, Modular, Misc, Extractors, Tanks (BAS-01). Fluid Pipe2 = 2 cases â `data/ports.json` corrigÃ© (BAS-04). Partage d'une jonction = la rÃ¨gle dÃ©jÃ  donnÃ©e (BAS-05). BAS-03 : les infobulles des ports â la maquette s'en sert, et l'Ã©diteur devra les structurer (R16, S38). Industrialist Calculator devient la 2e source (Â§ 0, rÃ¨gle 3). Bugs de la maquette corrigÃ©s : clignotement au survol (le cadre d'infos Ã©largissait le menu), lien Â« ComplÃ©ter Â» vers `#contribuer/batiments/<id>` ou message quand la piÃ¨ce n'est pas dans l'Ã©diteur (R17). Nouveaux retours R16 Ã  R18, lots S38 Ã  S40. La comparaison avec Pollywrath (`b37d7de`) est sur la branche `claude/inspiring-dubinsky-44c62c`, pas dans `main`.
  ContrÃ´lÃ© (1 366 Ã 768) : survol de chaque bouton de la grille dans chaque tier et chaque catÃ©gorie, largeur du menu et position du bouton inchangÃ©es ; mÃªmes chiffres sur les trois exemples ; infobulle Â« Input for Crude Oil/heavy Oil/â¦ Â» affichÃ©e dans la fiche de l'Advanced Oil Separator.
- **2026-10-27, S41 (1er pas : icÃ´nes)** (569 tests, dÃ©ployÃ©) : inventaire de chaque Ã©moji servant d'icÃ´ne (â 60 symboles ; la typographie Ã â â â¥ â â â¦ reste du texte) ; maquette `maquette/icones.html` validÃ©e le 2026-10-26 (jeu Lucide ISC recopiÃ© sans paquet npm, correspondance complÃ¨te, ð de la visite retirÃ©, chevron aprÃ¨s le mot). `src/ui/icons.ts` (notice ISC, 52 icÃ´nes, `icon()`, `iconAt()` pour les dessins, `withIcons()` / `noIcons()`) ; dans les catalogues FR et EN, chaque Ã©moji devient un jeton `{i:nom}` dessinÃ© en SVG dans le HTML et retirÃ© des attributs ; `data-ic` dans `index.html` (icÃ´ne remise Ã  chaque traduction) ; ports de l'Ã©diteur, â  du schÃ©ma, tableau de l'auteur et maquette du bac Ã  sable (Pipes : la goutte des liquides de Mindustry) passÃ©s aux icÃ´nes ; â  garde la couleur d'alerte ; nouveau `icons.test.ts` (chaque jeton existe, plus d'Ã©moji dans les catalogues).
  ContrÃ´lÃ© (serveur `calculateur`) : 8 pages en FR et en EN, panneau d'un bloc du schÃ©ma et usine entiÃ¨re ouverts : aucun jeton ni Ã©moji visible, aucun dans un attribut ; 1 366 px en sombre et 375 px en clair : pas de dÃ©filement horizontal, icÃ´nes de 13 Ã  21 px ; Ã©diteur de bÃ¢timents (ports) et bac Ã  sable sans erreur en console. Deux dÃ©fauts vus et corrigÃ©s : une rÃ¨gle `.rc-arrow svg` grossissait la marque Â« corrigÃ©e Â» Ã  72 px, et les icÃ´nes dans les dessins prenaient la taille du texte (`iconAt` fixe la sienne).
  Restent en caractÃ¨res, en attendant S44 (R23, menu dÃ©roulant maison) : â de l'option conseillÃ©e et â  dans les listes de recettes ; â² des reconnexions du graphique des RP (le mÃªme triangle que la lÃ©gende). Nouveaux retours : R23 (S44) et R24 (S45, visite principale puis une visite par usage) ; numÃ©ros pris aprÃ¨s R20 Ã  R22 et S42, S43, ajoutÃ©s en parallÃ¨le par la session S17.
- **2026-10-27, S42** (573 tests, dÃ©ployÃ© le 2026-10-31 par l'utilisateur, version 20261031-021338) : mesurÃ© en ligne (ordinateur) : chargement 0,17 s (cache), 1er calcul â 50 ms, onglets 1 Ã  18 ms ; le lent est Â« Toute l'usine Â» : Crankshaft 2,7 s, Electric Motor 6 Ã  8 min (73 000 recherches de tuyau). Placement des modules accÃ©lÃ©rÃ© sans changer un plan (`factory-s42.test.ts`, empreintes de 3 usines) ; dÃ©cision de l'utilisateur : limite de 20 s (`budgetMs`) sur les essais facultatifs, plan Â« abrÃ©gÃ© Â» signalÃ© avec un bouton Â« Continuer le calcul Â» (calcul complet). Electric Motor : 34 s au lieu de 6 Ã  8 min.
  Ã surveiller : le plan abrÃ©gÃ© d'Electric Motor est bien moins bon (1 145 Ã 73, 6 liaisons sans tuyau) ; un seul essai de placement peut dÃ©jÃ  dÃ©passer 20 s ; tÃ©lÃ©phone non mesurÃ© (volet du navigateur cachÃ©, mesures faussÃ©es) ; pas de parcours au navigateur aprÃ¨s la correction (quota) ; bundle principal toujours 1 580 ko.
- **2026-10-27, S40** (plan, sans code, non dÃ©ployÃ©) : questions posÃ©es, rÃ©ponses au Â§ 5. Pollywrath compte bien les items des stations. Refonte de la recherche dÃ©coupÃ©e en S46 Ã  S51 (Â§ 3, Â« S40 Â») : masquer, maquette, moteur, interface, pollution et mois, difficultÃ©.
- **2026-10-31, B1** (moteur sans Ã©cran, non dÃ©ployÃ©) : `src/engine/sandbox/` repris de `compute()` de la maquette, pur et typÃ© : catalogue par `buildGameData` (overrides compris) + ports, tuyaux, Ã©lectricitÃ©, portÃ©es ; ports tournÃ©s (2 cases des grands tuyaux, prises posÃ©es dessus) ; raccords face Ã  face ; voies des croisements ; recettes par `items`, puis `tip`, Â« ? Â» sinon ; flot maximal limitÃ© par piÃ¨ce, partage Ã©gal, saturation ; un flux par prise, cÃ¢bles orientÃ©s, `transfer` par prise, (1,0)/(0,1), Â« continuer sans courant Â» ; bilan avec revenu (`sellValue`) et alertes regroupÃ©es, structurÃ©es pour Ãªtre traduites en B3.
  Tests (`sandbox.test.ts`, 17) : 30 Iron Coil/min et 15 Iron Ingot/min ; 5 Roller Ã  80 %, 7,5/s pour 6/s, piÃ¨ces saturÃ©es du 5e tÃ© au bout ; croisement objet Ã fluide sans mÃ©lange ; Â« ? Â», tuyau mÃ©langÃ©, piÃ¨ce non relevÃ©e, deux entrÃ©es face Ã  face, grand tuyau seulement sur un port de 2 cases ; Roller servi par les deux prises d'un LV (4 800 MF/s sur 6 250).
  Ã surveiller : recettes aux quantitÃ©s inconnues Ã©cartÃ©es ; les exemples sans cÃ¢bles signalent Â« sans courant Â», comme la maquette ; le tracÃ© des tuyaux reste pour B2.
- **2026-10-31, B1 (retours)** (moteur sans Ã©cran, non dÃ©ployÃ©) : liaisons entre machines collÃ©es (mÃªme deux entrÃ©es) choisies port Ã  port par le joueur (`Layout.routes`, `routeError`, `machineLinks`), sortie collÃ©e Ã  entrÃ©e raccordÃ©e seule par dÃ©faut ; portÃ©e d'un cÃ¢ble = celle du bÃ¢timent d'oÃ¹ il part (gÃ©nÃ©rateur non relevÃ© : cÃ¢ble Ã  la main avec avertissement) ; recettes incomplÃ¨tes gardÃ©es avec ce qui leur manque, complÃ©tÃ©es par le joueur (`withFills`, `filled`). Menu dÃ©roulant maison avec Â« Ã  complÃ©ter Â» prÃ©vu en B3 (PLAN-BAC-A-SABLE.md Â§ 9). Tests : 23. Choix Ã  confirmer : BAS-07 et BAS-08 dans `data/a-verifier.md`.
- **2026-10-31, B2** (moteur sans Ã©cran, non dÃ©ployÃ©) : `src/engine/sandbox/path.ts` repris de la maquette : chemin A* (+8 par virage, machines bloquantes, croisement ou autre type traversÃ© tout droit seulement), ligne droite (Ctrl), ouvertures voulues, raccord aux ports qui regardent les bouts, fusion (coude, tÃ©, croix) ou croisement avec les tuyaux posÃ©s, droits du plus long au plus court (longueur auto ou limitÃ©e), croisements jamais rusty, gomme sur un rectangle, piÃ¨ce posÃ©e d'un clic, `applyPlan` (cÃ¢bles et liaisons des bÃ¢timents retirÃ©s supprimÃ©s). PiÃ¨ce non relevÃ©e (coude, tÃ©, croix fluide du tier III) posÃ©e avec ses ouvertures (`Placed.open`), signalÃ©e Â« Ã  complÃ©ter Â». Tests (`path.test.ts`, 8) : 20 cases de tier III = 5 Long Pipe2 ; gomme : Long Pipe2 â Pipe2 + Short Pipe2 ; tÃ© posÃ© seul en arrivant sur un tuyau ; refus Ã  travers une machine, contournÃ©e par A* ; croisements objet/objet et objet Ã fluide sans mÃ©lange ; exemple 1 tracÃ© par A* = 30 Iron Coil/min. Grands tuyaux (tier IV) pas encore tracÃ©s, comme dans la maquette. Rappel pour B3 : le menu dÃ©roulant maison survole la page (PLAN-BAC-A-SABLE.md Â§ 9).
- **2026-10-31, B3** (Ã©cran, non dÃ©ployÃ©) : page Â« Bac Ã  sable / Sandbox Â» (#bac, dans le menu du site), plein Ã©cran sous l'en-tÃªte, reprise de la maquette validÃ©e (`src/ui/sandbox-view.ts`, `sandbox-draw.ts`, `sandbox-model.ts`, `src/sandbox.css`, catalogues `vues/bac.*.ts`). Calcul : le moteur B1/B2 seulement (`computeSandbox`, `machineLinks`/`clickRoute`, `powerWires`/`autoConnect`, `withFills`/`stillMissing`, `pipePath`/`pipePlan`/`explicitPlan`/`rectPlan`/`applyPlan`). Menu de pose (cadre d'infos, grille, catÃ©gories, tiers, outils), pose en ligne, rotation, clic droit, zone, ZQSD/WASD par position de touche, pipette, fiche Â« ? Â», base de donnÃ©es, statistiques (unitÃ© /s, /min, /h ; revenu ; clic sur Â« Ce qui limite Â» = centrer), Liaisons, pastilles F6, cÃ¢bles (portÃ©e du bÃ¢timent de dÃ©part, gÃ©nÃ©rateur non relevÃ© : posÃ© avec avertissement), schÃ©mas F/Z/X/T, touches rÃ©assignables, rÃ©glages, exemples, Ctrl+Z/Y, tÃ©lÃ©phone (un doigt, deux doigts, appui long). Ports : clic sur un port libre = grille filtrÃ©e (fournisseurs ou utilisateurs) ; **glisser depuis un port libre = un tuyau**, mÃªme avec une machine en main ; clic sur un port puis un port de la machine collÃ©e = liaison, refus expliquÃ©, 2e geste identique = retrait. Recettes : **menu dÃ©roulant maison flottant** (fermÃ© au clic ailleurs ou Ãchap), recettes incomplÃ¨tes Â« Ã  complÃ©ter Â» â fiche de complÃ©tion â recette choisie, Â« Proposer ces chiffres Â» vers la fenÃªtre Remarque. Moteur : voies d'un croisement rÃ©glables (`Placed.pair`, test). Le montage est gardÃ© dans le navigateur ; #bac/<code> charge un montage partagÃ©. Navigateur, FR et EN : chaque ligne du Â§ 3 ; **Press + Roller en 9 gestes** (Press, poser, Roller, poser, glisser du port de sortie au Roller, lÃ¢cher, clic sur la Press, menu, recette : 30 Iron Coil/min) ; cibles â¥ 24 px Ã  375 px ; contrastes testÃ©s (`contraste.test.ts`). Doutes : BAS-09 (rÃ©glages de voies en jeu), BAS-10 (oscillation des recettes entre deux machines collÃ©es dans les deux sens, moteur).
- **2026-10-31, B4** (fluiditÃ©, non dÃ©ployÃ©) : **calcul par Ã®lots** (`computeSandbox(â¦, cache)`, `sandboxCache()`) : le montage se dÃ©coupe en Ã®lots (ports face Ã  face, cÃ¢bles, liaisons, chevauchements), chaque Ã®lot est calculÃ© seul et gardÃ© tant qu'il ne change pas ; le bilan et les alertes sont assemblÃ©s dans l'ordre du calcul d'un seul tenant. ComparÃ© Ã  l'ancien calcul sur 1 920 Ã©tats (12 suites de 80 gestes au hasard, avec et sans Â« continuer sans courant Â») et sur 200 machines : identiques, Ã  2Â·10â»Â¹â¶ prÃ¨s sur 3 Ã©tats (0,7999999999999998 au lieu de 0,8). Mesures (200 machines, 2 200 cases, 100 Ã®lots) : calcul complet 18 ms, **un geste 3 ms**. A* du tracÃ© sur tableaux typÃ©s (mÃªme parcours : 300 chemins au hasard identiques), 11,5 â 8,2 ms sur un tracÃ© d'un bout Ã  l'autre. Ãcran : dessin par bÃ¢timent (seuls ceux qui changent sont refaits), aperÃ§u et cadre d'infos **une fois par image** pendant un glisser, hauteur du menu lue une fois par image et Ã©crite seulement si elle change (elle refaisait le style de tout le plan : pose 41 â 12 ms sur 1 400 bÃ¢timents). **Worker** (`src/ui/sandbox.worker.ts`) : dÃ¨s qu'un calcul sur place dÃ©passe 8 ms (la moitiÃ© d'une image), les suivants partent dans le worker, et reviennent quand ils redeviennent courts. **Vue compacte** sous 12 px par case : pavÃ©s, pastille d'Ã©tat agrandie, tuyaux sans ports. Test `perf.test.ts` : moins de 16 ms par geste (gomme, 20 cases de glisser, pose, calcul) Ã  200 machines et 2 000 cases, et un seul Ã®lot recalculÃ©. Navigateur (souris Ã  250 Hz, 808 mouvements) : 268 images, la plus longue 17,1 ms, aucune au-delÃ  de 20 ms, aucune tÃ¢che longue ; pose 8,8 ms. Limite : un seul rÃ©seau de 200 machines coÃ»te 160 ms Ã  calculer ; le worker garde le glisser Ã  60 images/s, mais l'arrivÃ©e du rÃ©sultat coÃ»te une image (33 ms).

## 7. Gestion des sessions

La session de dÃ©part (celle qui a Ã©crit ce plan) joue le **gestionnaire** : elle lance chaque
session de lot avec une suggestion de tÃ¢che (une puce Ã  cliquer), une Ã  la fois, dans l'ordre du
Â§ 2. Une session de lot ne lance pas la suivante : elle se termine par son bilan et attend le feu
vert de l'utilisateur. L'utilisateur revient alors voir le gestionnaire, qui relit le Â§ 6, vÃ©rifie
le dernier commit sur `origin/main` et propose la session suivante.

Chaque session de lot :
- part d'une copie Ã  jour : `origin/main` contient ce plan et le travail des lots prÃ©cÃ©dents
  (la branche `main` locale peut Ãªtre en retard) ;
- suit le Â§ 0, du dÃ©but Ã  la fin ;
- met Ã  jour le Â§ 2 (Ã©tat), le Â§ 6 (bilan) et la mÃ©moire `prochaine-session`.
- **2026-10-27, S38** : bulle de port de l'Ã©diteur : bloc Â« Ce qui passe ici Â» (maquette `maquette/ports-objets.html`, validÃ©e ; l'utilisateur prÃ©cise que ce n'est pas le style voulu, Ã  reprendre plus tard avec le reste du site). Cases parmi les objets ou fluides des recettes de la machine, selon le sens ; infobulle relevÃ©e reprise (noms reconnus cochÃ©s d'avance, noms inconnus en orange) ; champ `items` du port, donc enregistrÃ©, exportÃ© et importÃ©. Tests `portCandidates` et `tipSuggest`.
- **2026-10-27, S46** (code, dÃ©ployÃ©) : recherche masquÃ©e par le drapeau `RECHERCHE_EN_REFONTE` (`src/ui/flags.ts`, mettre `false` pour la remontrer) : onglet Â« Ma recherche Â» et objectif Â« Des RP Â» affichent Â« Recherche en refonte Â» (FR/EN, clÃ© `rs.refonte`), puce RP de l en-tÃªte et RP de l arbre masquÃ©s.
- DonnÃ©es du joueur (relevÃ©s, journal S21, export) non touchÃ©es ; 571 tests verts sans adaptation ; capture faite dans le navigateur.
- Suite : S47 (maquette) sur feu vert ; S48 et S49 retirent le drapeau.
- **2026-10-27, S47** : maquette `maquette/recherche-refonte.html` (saisie par tier, contrÃ´le de la recopie du panneau, rÃ©glages de partie avec sources). Chiffres des cases = exemples. 3 questions Ã  valider en bas de la maquette ; non dÃ©ployÃ©e.
- **2026-10-27, S47 validÃ©e** : l utilisateur approuve la maquette `recherche-refonte.html` telle quelle (Â« c est bon pour moi Â») ; les 3 questions prennent donc les choix proposÃ©s : groupe = nombre + items communs, contrÃ´le sous la saisie, rÃ©glages de partie dans Â« Ma recherche Â». S48 peut dÃ©marrer sur feu vert.
- **2026-10-31, S48** (moteur, dÃ©ployÃ©, recherche toujours masquÃ©e) : le moteur S20 couvrait dÃ©jÃ  vitesse et plafond par tier avec les items, circuits RS4 sous le plafond et bonus 78 Ã logââ(R + 1) % ; ajout de l efficacitÃ© linÃ©aire des paraboles sur S + â(S Ã R) sans arrondi (`dishesExact`, `dishEfficiency`, source : Industrialist Calculator).
- Tests : capture du 2026-10-18 et mÃªme cas chez Industrialist Calculator â mÃªme rÃ©sultat (+2,93 RP/s) ; bonus RS4 : le wiki donne 1,2 fois le leur, on garde le wiki ; Ã©carts notÃ©s dans `a-verifier.md` (S48). Journal et donnÃ©es joueur non touchÃ©s.
- Suite : S49 (interface d aprÃ¨s la maquette, retrait du drapeau).
- **2026-10-31, S49** (code, dÃ©ployÃ©) : Â« Ma recherche Â» d'aprÃ¨s la maquette S47 : un tableau par tier (groupe = nombre de stations + items, Â« + un groupe diffÃ©rent Â», vitesse et seuil calculÃ©s, source), paraboles (contrÃ´leurs, liquide, paraboles posÃ©es, efficacitÃ© marquÃ©e Â« source : Industrialist Calculator Â»), contrÃ´le de la 1Ê³áµ ligne sous la saisie (Â« â comme en jeu Â» sous 2 %, sinon l'Ã©cart), panneau recopiÃ© repliÃ© et facultatif. Le choix rapide / dÃ©taillÃ© disparaÃ®t : des stations dÃ©crites priment, sinon le panneau ; anciennes saisies relues sans perte. Drapeau `RECHERCHE_EN_REFONTE` retirÃ© (puce RP, objectif Â« Des RP Â», arbre).
- Parcours dans le navigateur (FR, EN, ordinateur, tÃ©lÃ©phone 375 px) avec la capture du 2026-10-18 : 47,47 RP/s, seuil 76 875, +2,93 des paraboles, Â« â comme en jeu Â» ; 50,4 â 45 RP/s donne Â« Ãcart de 12 % Â». RÃ©glages de partie (pollution, mois, difficultÃ©) pas encore affichÃ©s : ils arrivent avec S50 et S51.
- Reste : un relevÃ© en jeu aprÃ¨s le seuil, Ã  comparer (critÃ¨re < 2 % de S20), par l'utilisateur.
