# Plan mobile

Demande (2026-11-25) : « un chantier dédié à la "refonte"/"création" de l'interface mobile. Car pour le
moment ce qu'on a […] c'est quelque chose d'utilisable, pas d'agréable ni d'ergonomique, ni adapté au
support ».

Phase 1 : audit, conception, maquette ([maquette/mobile.html](maquette/mobile.html)). **Rien n'est codé.**
Règles : [PLAN-ACTION.md](PLAN-ACTION.md) § 0 ; la version ordinateur ne change pas sans proposition.

## 1. Audit (main `0585374`)

Méthode : Chrome sans fenêtre, toucher émulé (vrais événements tactiles du navigateur, un et deux doigts),
360×800, 390×844, 844×390, 768×1024, 1024×768 ; 17 vues mesurées par format. Plan d'essai :
Crankshaft 60/min, tout débloqué (82 machines, 13 étapes). Captures : [maquette/img/mobile/](maquette/img/mobile/).

**Limites.** L'émulation ne remplace pas un téléphone : ni épaisseur du doigt, ni clavier virtuel, ni barres
du navigateur, ni encoche, ni Safari, ni vraie puissance de calcul. Voir § 2.

### Bloquant

| # | Constat | Mesure |
| --- | --- | --- |
| M1 | **Pincer ne zoome pas** dans le schéma, l'usine, l'arbre et l'éditeur de bâtiments ; dans l'usine, l'arbre et l'éditeur, le dessin saute de côté. Le bac à sable, lui, zoome. Cause : `PanZoom` (`canvas.ts`) ne suit qu'un doigt. | zoom 55 → 55, 36 → 36, 100 → 100, 73 → 73 |
| M2 | **Le dessin arrête le défilement.** Balayer dans un dessin déplace le dessin, jamais la page ; le cadre prend presque toute la largeur. | page : 0 px dans le schéma, l’usine, l’arbre et l’éditeur |
| M3 | **Le résultat est sous la page.** Il faut défiler avant de voir quoi que ce soit du plan. | schéma à 1 257 px, usine à 1 334 px, éditeur de bâtiments à 1 275 px (écran : 844) |
| M4 | **« Premiers pas » couvre le bas de l'écran**, sur toutes les pages, jusqu'à « Masquer ». | environ 38 % de l'écran à 390×844 |
| M5 | **Tablette et paysage débordent.** L'en-tête sur une ligne élargit la page : le navigateur dézoome tout Planifier ; petits débordements ailleurs. | Planifier : 1 013 px pour 768 et 844 ; autres pages : 1 045 px pour 1 024 |

### Gênant

| # | Constat | Mesure |
| --- | --- | --- |
| M6 | Cibles trop petites. | 68 à 76 sur 76 sous 40 px dans Planifier (360×800), dont 13 sous 24 px |
| M7 | En-tête fixe de quatre lignes, en haut, loin du pouce ; six liens serrés. | 143 px, soit 17 % de 844 |
| M8 | Au moins 2 champs sous 16 px sur Planifier et Recettes, 27 dans Ma recherche : iOS zoome à la saisie. | `zoomIOS` : 1 à 27 par page |
| M9 | Page très longue. | liste 4 157 px, éditeur de bâtiments 8 641 px, Méthodes 7 089 px |
| M10 | Schéma horizontal : deux nœuds à peine visibles, texte minuscule, boutons du bas coupés (« Grouper »). | zoom 55 % |
| M11 | Onglets du résultat et tableaux coupés à droite, sans indice. | 457 px pour 336 ; tableaux 440 à 640 pour 302 |
| M12 | Bac à sable : le pupitre prend le bas, les catégories débordent à 360 ; en paysage, il recouvre la barre du haut. | dessin en paysage : 305 px, en partie couvert |
| M13 | Infobulles `title`, « molette pour zoomer », « Ctrl K », « R » : sans effet au doigt. | 369 éléments `title` |
| M14 | Choix d'objet : bonne base (liste avec images), mais lignes fines et défilement interne ; sa hauteur avec un clavier est à voir sur téléphone. | voir capture 3 |
| M15 | Partager : le panneau s'ouvre dans la page, pas de feuille de partage du téléphone. | capture 3 |
| M16 | Réglages : poignées et flèches trop petites pour l'ordre des priorités. | capture 2 |
| M17 | Profondeur : écran → en-tête → objectif → étapes → onglets → dessin. | trois niveaux d'onglets empilés |

### Ce qui marche

Calcul rapide ici ; schéma visible en environ 1,8 s avec processeur ralenti 4× (indicatif) ; tiroir des
réglages, choix d'objet, partage, pincement du bac à sable (géré à part dans `sandbox-view.ts`).

## 2. À essayer sur un vrai téléphone

1. Pincer dans Schéma, Usine, Arbre, Bac à sable.
2. Faire défiler Planifier avec le pouce, en passant sur le dessin.
3. Saisir une quantité puis un objet : le clavier cache-t-il le champ ou la liste ? La page zoome-t-elle (iPhone) ?
4. Arriver au schéma d'un plan : nombre de gestes, main droite seule.
5. Poser et relier deux machines dans le bac à sable.
6. Tourner le téléphone pendant un plan.
7. Calculer une grosse usine : durée, chauffe, page rechargée en arrière-plan.
8. La maquette, directions A et B, à une main. Noter modèle, système et navigateur.

## 3. Principes

1. **Un écran, une tâche.** Le plan remplit l'écran ; l'objectif se replie dans l'en-tête (52 px).
2. **Le pouce d'abord** : navigation et action principale en bas. Cibles de 44 px au moins, 48 visés.
3. **Panneau bas à trois crans** (aperçu, moitié, plein) ; jamais deux panneaux empilés. En paysage : rail à gauche, panneau à droite.
4. **Les dessins n'ont pas de page à faire défiler.** Un doigt déplace, deux doigts zooment, toucher choisit, un bouton montre tout. L'élément choisi reste au-dessus du panneau.
5. **Toucher, pas survoler ni glisser.** Relier = toucher la source puis la cible. Poser = viser au centre, puis « Poser ».
6. **Champs à 16 px**, clavier numérique, hauteur suivie avec `visualViewport`.
7. **Retour** du téléphone ferme d'abord le panneau, puis change de vue.
8. Charte Plasma, volets à plat, aucun texte parasite (R28) ; texte utile de 14 px au moins.
9. **Même moteur, mêmes données, mêmes adresses.** Le mobile est une présentation, pas un second site.

Critère de bascule proposé : largeur < 900 px, ou pointeur grossier avec hauteur < 500 px. Une tablette
en paysage garde la version ordinateur, débordements corrigés.

(Plusieurs lignes ci-dessous et les § 4 et 5 sont remplacés par les décisions du § 7.)

### Ce que je simplifierais, franchement

| Outil | Téléphone |
| --- | --- |
| Étapes, bilan, recettes, partage, Ma partie | Complet, écran prioritaire |
| Schéma | Lecture par défaut, disposé de haut en bas ; « Modifier » : nombre, recette, relier, supprimer. Pas de groupes ni de sélection multiple |
| Usine et modules | Consultation et « posé » ; pas d'édition |
| Bac à sable | Poser, relier, tourner, effacer ; gros montages et schémas multiples : ordinateur ou tablette conseillés |
| Arbre | Liste cherchable d'abord, arbre dessiné en second |
| Contribuer : valeurs | Complet |
| Contribuer : éditeur de bâtiments | Lecture seule, « M'envoyer le lien » (dessiner des ports au doigt n'est pas fiable) |
| Méthodes, Propositions | Complets, avec sommaire |
| Import, export, fichier figé | Conservés, dans Partager |

## 4. Maquette

[maquette/mobile.html](maquette/mobile.html). Sur téléphone : plein écran ; sur ordinateur : choix du format.

- **A · Onglets** : cinq pages toujours en bas (Planifier, Recettes, Bac à sable, Ma partie, Plus) ; vues du plan en haut du dessin. Plus connu ; changer de vue oblige à monter le pouce.
- **B · Dock** : le bas contient les vues du plan (Étapes, Schéma, Usine, Bilan) et un bouton Menu. Plus de place, vues au pouce ; changer de page coûte deux touches et les pages se voient moins.

Ma recommandation : **A**. Les nouveaux joueurs voient tout le site ; la bande de vues se touche au besoin,
et un balayage horizontal sur Étapes / Bilan peut s'y ajouter.

Noms, nombre de machines et bilan : relevés sur le site. Le plan de l'usine, les liaisons de machine, les
ports du bac à sable et les fiches de recette sont schématiques. Les totaux ne se recalculent pas.
Essayée au toucher émulé (cocher, pincer, glisser le panneau, modifier, relier, chercher, poser) dans trois
formats, plus quelques clics souris. Le panneau du navigateur était caché : fluidité non jugée, et aucun
essai sur un vrai téléphone.

## 5. Lots

Une session = un lot, accord entre chaque. Le style mobile va dans un nouveau `src/mobile.css`, sous la
condition de bascule : c'est ce qui protège l'ordinateur et limite les conflits.

| Lot | Contenu | Fichiers | Dépend de |
| --- | --- | --- | --- |
| **MB1** Corrections sans refonte | Débordements tablette (M5), champs 16 px (M8), « Premiers pas » replié (M4), textes « molette » (M13) | `styles.css` (règles de petit écran), `steps` dans `tour.ts`, catalogues | — |
| **MB2** Gestes | Pincement dans `PanZoom` ; essai à deux doigts, test pur | `canvas.ts`, puis contrôle de `graph-view.ts`, `buildings.ts` | — |
| **MB3** Ossature | Barre du bas, en-tête court, panneau bas générique, retour, hauteur avec clavier | nouveaux `mobile-shell.ts`, `sheet.ts`, `mobile.css` ; `index.html`, `route.ts` (petits ajouts) | choix A / B |
| **MB4** Planifier | Objectif replié, Étapes, Bilan, réglages et choix en panneau | `main.ts`, `plan-bar.ts`, `item-palette.ts`, `prio-list.ts` | MB3 |
| **MB5** Schéma | Vertical, lecture / modifier, relier par deux touches | `graph-view.ts` | MB2, MB3 |
| **MB6** Usine | Dessin plein, fiche du module, « posé » | `factory-view.ts`, `main.ts` | MB2, MB4 |
| **MB7** Bac à sable | Quatre outils, viseur, paysage | `sandbox-view.ts`, `sandbox.css` | MB3 |
| **MB8** Recettes, Ma partie, Arbre | Listes, fiches en panneau, tableaux en lignes | `recipes-view.ts`, `research-*.ts` | MB3 |
| **MB9** Reste | Contribuer, Méthodes, Propositions, remarque, partage du téléphone | `share-view.ts`, `buildings.ts`, `methods-view.ts` | MB3 |
| **MB10** Tutoriel et parcours réel | Étapes propres au mobile (`tour.ts` réutilisé), parcours chronométrés, téléphone réel | `tour.ts`, catalogues | tous |

Indépendants : MB1 et MB2 tout de suite ; après MB3, MB5, MB7, MB8 et MB9 peuvent avancer séparément.
MB4 et MB6 touchent tous deux `main.ts` : jamais en même temps.

Conflits : les branches de partage P1 à P5 contrôlées n'ont plus d'écart avec `main` (contrôle du 2026-11-25) ;
MB9 relit tout de même `share-view.ts`. L'éditeur de graphe (G1 à G6) est terminé. Le nucléaire est une
étude : avant MB4, vérifier s'il touche `main.ts`.

## 6. Validation

Communs à tous les lots : captures ordinateur (1400×900 et 1920×1080) avant / après identiques, ou écart
accepté ; `npm test` ; FR et EN ; thème clair et sombre ; vrais clics et toucher émulé à deux doigts.

1. Aucun débordement horizontal de page dans les cinq formats.
2. Cibles de 44 px au moins (hors liens dans le texte) ; champs de 16 px au moins.
3. Commandes fixes : 130 px au plus en portrait (aujourd'hui 143, plus « Premiers pas »), panneau bas replié non compté.
4. Plan visible sans défiler ; schéma atteint en deux touches au plus.
5. Pincer zoome les cinq dessins ; aucun saut de plus de 5 px au centre des doigts.
6. Schéma Crankshaft : libellés d'au moins 12 px réels à la vue de départ.
7. Choisir un objet et une quantité au clavier ouvert : champ, résultats et bouton visibles (sur un vrai téléphone).
8. Aucune action disponible seulement au survol, au clic droit ou au clavier.
9. « Retour » ferme le panneau sans perdre le plan ; une rotation conserve la vue et la sélection.
10. Lecteur d'écran et clavier : panneaux nommés, focus rendu à la fermeture ; contraste testé.
11. Parcours « Crankshaft 60/min → cocher une étape → partager » mesuré avant / après, accepté par l'utilisateur sur son téléphone.

## 7. Décisions (2026-11-25)

1. **Navigation B, dock.** Boutons du plan dans l'ordre **Usine, Schéma, Étapes, Bilan**, puis Menu.
2. **Tablette : version mobile**, en portrait comme en paysage (rail à gauche, panneau à droite). Critère de
   bascule du § 3 remplacé : largeur < 900 px, ou pointeur grossier à toute largeur.
3. Menu de B (Planifier, Recettes, Bac à sable, Ma partie, Contribuer, Plus). **Contribuer devient une interface à
   part** avec ses boutons en bas : Postes, Bâtiments, Valeurs (à vérifier), Envois.
4. Schéma : proposition acceptée.
5. Schéma de haut en bas, accepté ; **deux liens ne se superposent jamais** (sortie, couloir et entrée propres,
   liseré aux croisements). S'appuie sur `graph-route.ts`.
6. Bac à sable : viseur et deux touches ; **menu de pose en arbre** (T1 › Pipes › Fluid pipes › Short), en miettes
   qu'on retouche ; annuler / rétablir dans un coin du dessin ; affichage, réglages, exemples, schémas et vider derrière « ⋯ ».
7. **Éditeur de bâtiments fonctionnel** au téléphone (remplace la lecture seule du § 3 et du § 5).
8. Ouverture : réponse « en Q.3 », comprise comme **Usine**, le premier bouton.
9. « Premiers pas » dans Plus avec pastille, et **un bouton « Y aller » par ligne**, qui ouvre l'endroit et le montre.
10. MB1 et MB2 : accord.
11. Essais sur **Chrome Android** ; Safari iPhone hors périmètre.

Maquette v2 : B seule, avec tout ce qui précède. Dans l'arbre de pose, les tiers, catégories et pièces viennent des
données du site (bâtiments de taille connue).
Les tailles de l'éditeur et les postes sont des exemples.

### Reste à confirmer

- **« Postes »** : compris comme les propositions des joueurs (lire, voter, envoyer une remarque) ? [oui]
- Maquette v2 acceptée, et MB3 (ossature) peut commencer ? [oui]

## 8. Bilans

- **MB1** (2026-11-25) : plus de débordement aux six largeurs mesurées ; en-tête à la ligne de 761 à 1 060 px ; champs à
  16 px au toucher ; « Premiers pas » repliée en une ligne de 185 × 46 px (non montrée dans le bac à sable) ; aides sans
  « molette » au toucher. Les bulles (`title`) et l'aide « ? » gardent leur texte : MB3 et suivants.
- **MB2** (2026-11-25) : pincement dans `PanZoom` (`pinchStep`, testé) : schéma 55 → 155 → 52, usine 36 → 109 → 36,
  arbre 100 → 183 → 61, éditeur 73 → 219 → 73. Un nœud saisi au début d'un pincement reste à sa place.
  Vérifié au toucher émulé ; à essayer sur Chrome Android.
