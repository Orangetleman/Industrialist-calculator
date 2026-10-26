# Bac à sable : construire sa chaîne et voir ses statistiques (S17)

Retour R12. Ce plan ne code rien : il fixe ce qu'on construira, dans quel ordre, et à quoi on saura
que chaque lot est fini. Maquette : [`maquette/bac-a-sable.html`](maquette/bac-a-sable.html). Elle se
lance avec `npm run dev` puis `/maquette/bac-a-sable.html`. Ses données sont tirées des fichiers du
jeu par `maquette/bac-a-sable.gen.mjs`.

Le calculateur part d'un objectif et pose l'usine. Le bac à sable fait l'inverse : le joueur pose ses
machines et ses tuyaux, et le site lui dit ce que donne son montage.

## 1. Décisions (Q14, 2026-10-26)

| # | Décision |
| --- | --- |
| 1 | Les statistiques d'abord, sur un plan fidèle au jeu, pour que le montage se refasse en jeu. |
| 2 | La grille du jeu : mêmes cases et mêmes tuyaux que les plans de pose (1 case = 1 Short Pipe). |
| 3 | Les machines gardent la taille et les ports relevés. **Une machine dont les ports ne sont pas relevés ne peut pas être posée.** Le panneau dit combien attendent un relevé et renvoie vers Contribuer. |
| 4 | Partir d'un plan calculé pour le modifier : oui, dans un lot à part (B6). |
| 5 | Partager : un fichier (export et import) et un lien. Le lien n'est proposé que s'il reste « petit », ce qui se mesure : son adresse compressée fait au plus 2 000 caractères, longueur sûre pour Discord et les navigateurs. La maquette l'affiche (bouton « Lien ») : Press + Roller tiennent en quelques centaines de caractères. Au-delà, seul le fichier est proposé. |
| 6 | Un bouton ☰ ouvre le panneau des machines, rangées **par chapitre puis par catégorie, comme dans le jeu** (ordre exact à relever : BAS-01). Une recherche en haut. Au téléphone, c'est un tiroir par le bas qui **défile horizontalement**. Le clic droit ne sert qu'à effacer. |
| 7 | De Mindustry, on reprend les gestes, pas l'aspect. |
| 8 | **Calcul automatique pendant la pose.** Chaque machine est supposée tourner à plein ; le calcul se refait à chaque changement de disposition. Les tuyaux ne contiennent pas d'objets : ils montrent **ce qu'ils doivent transporter**, déduit de ce qui y est branché. Une machine qui reçoit des liaisons **en déduit sa recette**. Si plusieurs recettes vont avec les mêmes entrées, un indicateur (pastille « ? ») demande de choisir. La recette retenue reste visible sur la machine, sans clic droit. **Le calcul ne doit jamais ralentir le joueur** (§ 4). |
| 9 | Les liaisons fausses sont refusées au tracé (type de tuyau, port de l'autre type). Un tuyau qui dépasse sa capacité **change de texture** sur le plan (hachures rouge et orange dans la maquette), en plus de la ligne dans les statistiques. |
| 10 | Les noms : `PLAN-BAC-A-SABLE.md`, `maquette/bac-a-sable.html`, et « Bac à sable » / « Sandbox » dans le menu, à côté de Planifier. |

## 2. Le modèle Mindustry : ce qu'on garde

Cette partie s'appuie sur ce qu'on sait du jeu et sur sa page de wiki « Conveyor ». Les gestes sont
à revoir en jouant avant B2.

| Geste dans Mindustry | Dans le bac à sable | Pourquoi |
| --- | --- | --- |
| Glisser pour poser une ligne de convoyeurs, le sens suit le geste | Glisser avec l'outil tuyau : une case par case traversée, coudes posés seuls | Le cœur de R12 |
| La ligne fait un coude en L entre le départ et le pointeur | Pareil : d'abord en x, puis en y (la maquette le fait). Ctrl pendant le glisser pour inverser le coude (B2) | Garde des tracés propres |
| R tourne la pièce avant de la poser | R tourne la machine portée ou sélectionnée | Même touche que Mindustry |
| Clic droit glissé : efface ce qu'on survole (ou une zone) | Clic droit glissé : efface tuyaux et machines ; zone au rectangle avec Maj (B3) | Effacer vite |
| Croisements (junction) et ponts | Un croisement objet × fluide se pose avec la pièce non rusty du jeu, jamais de rusty ([feedback-priorites]) ; refusé au tracé dans la maquette | Les pièces existent et ont un prix |
| Le sens du convoyeur porte le flux | **Ne s'applique pas** : un tuyau d'Industrialist n'a pas de sens propre, le flux va des sorties vers les entrées (`flow.ts`) | Règle du jeu |
| Pas de limite de longueur | **Ne s'applique pas tel quel** : la longueur et le débit des tuyaux comptent. Le tuyau de tier I fait 6/s, la valeur du wiki. | Critère validé (§ 0, règle 5) |
| Schémas (copier une zone, la coller) | Ctrl+C / Ctrl+V d'une sélection (B3) | Répéter un module |

## 3. Les gestes

| Action | Ordinateur | Téléphone |
| --- | --- | --- |
| Ouvrir les machines | ☰ | ☰, tiroir horizontal |
| Poser | clic sur une machine du panneau, puis clic sur le plan (Maj : en poser plusieurs) | toucher la machine, puis toucher le plan |
| Tourner | R, ou le bouton du panneau de la machine | bouton « Tourner » |
| Déplacer | glisser la machine (outil ⬚) | appui long puis glisser |
| Copier | Ctrl+C / Ctrl+V | bouton « Copier » de la sélection |
| Effacer | clic droit glissé, outil ⌫ (E), Suppr | outil ⌫ |
| Tracer un tuyau | outil objet (O) ou fluide (F), glisser | outil, puis glisser du doigt |
| Prolonger | repartir d'un bout de tuyau existant | pareil |
| Couper | gomme sur une case | pareil |
| Annuler, rétablir | Ctrl+Z, Ctrl+Y | boutons ↶ ↷ |
| Se déplacer | glisser sur le vide, ou bouton du milieu | un doigt sur le vide |
| Zoomer | molette, + / − | pincer |
| Choisir la recette | pastille « ? », puis le menu du panneau | pareil |

## 4. Le calcul d'un montage libre

Le principe est celui de la maquette (`compute()`, environ 120 lignes). Le moteur le refera proprement
dans `src/engine/sandbox/`, en module pur et testé.

1. **Réseaux** : des cases de tuyau reliées entre elles. On réutilise le format de `route.ts`
   (`PipeCell` : réseau et liaisons) et `flowArrows` (`flow.ts`) pour le sens du flux.
2. **Raccords** : la case devant un port porte un tuyau du même type (règle des plans de pose, à
   confirmer : BAS-02).
3. **Ce que porte un tuyau** : les sorties de la recette des machines qui y versent. Le port de chaque
   sortie vient de `interfaces.json` quand il est connu ; sinon il est marqué « à vérifier » (BAS-03).
   La maquette, elle, répartit dans l'ordre.
4. **Recette d'une machine** : les recettes dont les entrées contiennent tout ce qui arrive. Une seule
   → retenue ; plusieurs → « ? » ; aucune → ⚠. Le choix du joueur est gardé tant qu'il reste possible.
   Le réglage d'interface (S10) s'applique comme dans le calculateur.
5. **Débits** : chaque machine tourne à une fraction f entre 0 et 1, freinée par trois choses : une
   entrée qui manque, une sortie qui déborde, un tuyau trop petit. On calcule un point fixe, en
   partant de 1. Une entrée non branchée est fournie de l'extérieur et devient une « entrée du
   montage ». Une sortie non branchée devient une « sortie du montage ». Le moteur calcule le débit
   **branche par branche** : la maquette prend le total d'un réseau.
6. **Bilan** : sorties et entrées du montage par minute, énergie (somme de f × MF/s), prix (machines,
   plus les pièces de tuyau au prix du catalogue), place au sol (rectangle et cases), pollution
   (`pollution.ts`), machine qui limite et sa raison, tuyaux saturés ou mélangés.
7. **Liaisons fausses** : un mauvais type ou un port de l'autre type est refusé au tracé, avec un
   message. Deux objets dans un même tuyau rendent le tuyau rouge et apparaissent dans « Ce qui
   limite ». Une boucle est permise : le point fixe la calcule, et le flux sans sens est signalé
   (comme dans `flow.ts`).

**Fluidité** (décision 8, exigence de l'utilisateur) :
- le calcul est **incrémental** : un geste ne recalcule que les réseaux touchés et ce qui en dépend ;
  le reste est gardé ;
- pendant un glisser, seul le tracé est redessiné ; les statistiques se recalculent à la fin du geste,
  ou au plus une fois par image ;
- au-delà d'un seuil mesuré en B4, le calcul part dans un worker, comme l'usine aujourd'hui
  (`factory.worker.ts`), et l'écran affiche le dernier résultat ;
- dessin : on garde le SVG de la maquette tant qu'il tient ; on passe à un canvas (`canvas.ts` existe
  déjà) si la mesure de B4 le demande ;
- budget, vérifié par un test de performance : **moins de 16 ms par geste avec 200 machines et
  2 000 cases de tuyau**, sur l'ordinateur de l'utilisateur.

## 5. Les ponts avec l'existant

- **Depuis le calculateur** (B6) : « Modifier dans le bac à sable » sur un module ou sur toute l'usine
  copie ses machines, ses recettes et ses tuyaux (`FactoryPlan`) dans un montage.
- **Comparer** (B6) : en partant d'un plan calculé, le bandeau compare le montage au plan conseillé
  (débit, énergie, place, prix).
- **Garder** (B5) : montages enregistrés dans le navigateur (`ind-calc:v1:bac`), export et import en
  JSON, lien `#bac/…` s'il fait au plus 2 000 caractères (décision 5).
- **Ma partie** : les machines non débloquées restent posables, marquées 🔒 (le bac à sable sert aussi
  à préparer la suite). Option « seulement mes machines » (B5).
- **Remarques** : le montage est joint à une remarque, comme le plan aujourd'hui.

## 6. Les lots

Un lot par session, maquette d'abord quand l'écran change, feu vert entre deux lots.

| Lot | Contenu | Critère de fin |
| --- | --- | --- |
| **B1** Moteur du montage | `src/engine/sandbox/` pur : montage (machines, cases, liaisons), réseaux, raccords, recettes déduites, débits (point fixe), bilan. Aucun écran. | Tests : Press + Roller = 30 Iron Coil/min et 15 Iron Ingot/min à fournir ; recette ambiguë → « ? » ; tuyau saturé ; tuyau mélangé ; boucle ; machine sans ports refusée. Les valeurs viennent des fichiers du jeu. |
| **B2** Le plus petit montage utile | Page « Bac à sable » / « Sandbox » (FR et EN) ; ☰ par chapitre et catégorie ; poser, tourner, effacer ; tracer un tuyau au glisser ; recette sur la machine ; statistiques à droite. | Parcours réel au navigateur : depuis un plan vierge, Press + Roller + un tuyau en moins de 10 gestes, statistiques justes ; téléphone 375 px sans débordement ; contrastes et cibles comme en S33. |
| **B3** Gestes complets | Déplacer, copier et coller, effacer une zone, prolonger et couper un tuyau, annuler et rétablir, croisement non rusty, inversion du coude, touch (pincer, appui long). | Chaque geste du § 3 fait une fois au navigateur (ordinateur et téléphone) ; Ctrl+Z ramène exactement l'état d'avant (test). |
| **B4** Fluidité | Calcul incrémental, recalcul en fin de geste, worker au-delà du seuil, canvas si besoin. | Test de performance : moins de 16 ms par geste à 200 machines et 2 000 cases ; aucune image perdue pendant un glisser (mesure au navigateur). |
| **B5** Garder et partager | Enregistrer plusieurs montages, export et import en fichier, lien ≤ 2 000 caractères, 🔒 et « seulement mes machines ». | Un montage exporté, réimporté puis ouvert par lien donne la même empreinte (test) ; lien refusé au-delà de 2 000 caractères, avec un message. |
| **B6** Ponts | Depuis un module ou l'usine vers le bac à sable ; comparaison au plan conseillé. | L'usine Crankshaft 60/min ouverte dans le bac à sable redonne ses chiffres (débit, énergie, place, prix) ; une machine retirée change la comparaison comme prévu. |
| **B7** Visite et remarques | Étapes « Bac à sable » dans la visite ; montage joint aux remarques ; textes anglais relus. | Parcours d'un nouveau venu en anglais, au clavier, comme S37. |

B1 et B2 suffisent pour un premier usage. Les lots suivants s'ajoutent un par un.

## 7. Risques

- **Machines posables** : seules **31 machines** ont leurs ports et des recettes dans le dépôt
  (`bac-a-sable.gen.mjs`). Toutes les autres sont refusées (décision 3). Le bac à sable vaut donc ce
  que valent les relevés : il faudra en faire d'autres (Contribuer → Bâtiments).
- **Règles de jeu mal connues** : le raccord d'un tuyau à un port (BAS-02) ; le port de chaque sortie
  (BAS-03) ; l'ordre du menu de construction (BAS-01). Ils se demandent, ils ne se supposent pas.
- **Performance** : traitée en B4, avec une mesure. Elle reste le risque principal au téléphone.
- **Quantité de code** : environ la taille de l'éditeur de bâtiments, plus un moteur de la taille de
  `flow.ts`. Le moteur reste séparé de l'écran, et on réutilise `route.ts`, `flow.ts`, `catalog.ts`,
  `pollution.ts` et `canvas.ts`.
- **Valeurs corrigées** : la maquette lit les recettes du wiki sans `overrides.json`. Le moteur, lui,
  passera par `buildGameData`, comme le calculateur.
- **Ce que la maquette simplifie** : le débit est compté par réseau et non par branche ; les sorties
  sont réparties dans l'ordre ; pas de croisement ; pas d'électricité. Tout est repris en B1 à B3.
