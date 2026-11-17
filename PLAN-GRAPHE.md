# Éditeur de graphe : plan (lot G0)

Écrit le 2026-11-17, à la suite de la remarque n°16 (red_draggy) et de l'import des graphes
d'Industrialist Calculator (commits 35483e9 et 708ea55). Ce plan ne code rien : il fixe ce qu'on
construit, dans quel ordre, et à quoi on saura que chaque lot est fini. Maquette :
[`maquette/editeur-graphe.html`](maquette/editeur-graphe.html), à ouvrir avec `npm run dev` puis
`/maquette/editeur-graphe.html`. Les règles du § 0 de [PLAN-ACTION.md](PLAN-ACTION.md) s'appliquent à
chaque lot.

## 1. Pourquoi

Le site répond « je demande, il propose ». Industrialist Calculator (Pollywrath, MIT) fait l'inverse :
« j'assemble, il équilibre ». Les joueurs préfèrent assembler (R22 : « you can assemble the sheet
yourself »), et ils connaissent déjà ses gestes. Notre Schéma est une image calculée avec une fiche à
côté : on ne peut ni ajouter une recette, ni en remplacer une d'un geste, ni couper une branche, ni
relier deux étapes. Le joueur red_draggy l'a dit autrement : notre proposition n'est pas toujours
optimale, et il voudrait partir de son propre graphe.

Décision de l'utilisateur (2026-11-17) : **pas de reprise de leur code** (trop contraignant pour la
charte du site) ; **refaire entièrement ou presque l'interface du graphe** en s'inspirant de leur
éditeur ; construire quelque chose d'adapté à notre site ; **ensuite** recoller notre génération de plan
sur ce modèle ; **mentionner l'inspiration** quelque part sur le site, discrètement.

## 2. Décisions prises

| # | Décision | Date |
| --- | --- | --- |
| 1 | L'éditeur **remplace** l'onglet Schéma : une seule vue du graphe. L'image calculée d'aujourd'hui disparaît à la fin de G4. | 2026-11-17 |
| 2 | Deux calculs distincts : **l'équilibre en direct** à chaque geste (nombre × recette : manques, excédents, puissance, pollution, prix, cases), sans solveur ; et **« Recalculer »**, geste explicite, qui renvoie le graphe au solveur sous forme de contraintes et montre l'écart avant d'appliquer. Le solveur ne se relance jamais tout seul. | 2026-11-17 |
| 3 | Fond du canevas : **charbon profond** (plus sombre et plus marqué que le fond actuel des dessins), semé de **petites croix** disposées comme les points du canevas de Pollywrath, pas de grille. | 2026-11-17 |
| 4 | Format de fichier : le nôtre (JSON simple), avec **import et export** vers le format d'Industrialist Calculator par la table `data/pollywrath-map.json`. Un joueur passe d'un site à l'autre dans les deux sens. Les recettes sans équivalent sont signalées, jamais inventées. | 2026-11-17 |
| 5 | Mention : une ligne discrète dans le pied de page et sur la page Méthodes, « Éditeur inspiré d'Industrialist Calculator (Pollywrath) », avec le lien. Rien de plus visible. | 2026-11-17 |
| 6 | Son apparence reste à lui (or sur charbon, filets dorés, barre d'outils à libellés). On garde notre charte (Plasma Chantier, Audiowide, volets à plat, bulles, icônes flottantes). On reprend des **gestes**, pas un style. | 2026-11-17 |
| 7 | Pas de dépendance nouvelle : SVG pour les arêtes, HTML pour les nœuds, `canvas.ts` pour le déplacement et le zoom, `flow-layout.ts` pour la disposition automatique. | règle § 0 |

## 3. Les gestes retenus (et d'où ils viennent)

| Geste | Chez eux | Chez nous (maquette) |
| --- | --- | --- |
| Le nœud montre sa recette au débit courant | titre, machine, nombre en gros, cycle / puissance / pollution, lignes d'entrées à gauche et de sorties à droite | même structure ; entrées en cyan `--in`, sorties en mauve `--out` (S59) ; nombre en orange |
| Prises sur les bords, arêtes de prise à prise | carrés colorés, un par ligne | boutons de port, comme au bac à sable (S57) ; un glisser d'une sortie vers une entrée relie ; au doigt, un appui sur chaque prise |
| **Cliquer une ligne d'entrée** ouvre les recettes capables de la produire | sélecteur déjà filtré, onglets Producer / Consumer / Outlet / Power & Heat | palette S61 étendue aux recettes : onglets Produire / Consommer / Énergie, chaque recette dessinée (entrées → machine → sorties) |
| Manques et excédents en direct | tableau de bord à gauche, rouge / vert | volet droit, catégorie « Équilibre » ; un manque a un bouton « Produire › » qui ouvre le sélecteur filtré |
| Marquer une cible | outil Target, Maj temporaire | pastille cible sur le nœud, Maj + clic ; la cible fixe l'objet et le débit de la phrase d'objectif |
| Compute avec aperçu | nombres proposés, puis Apply | « Recalculer » (orange) : fenêtre avant / après par nœud, Appliquer ou Annuler |
| Éditeur de nœud | menu ⋯ : nombre, ordre des prises, Apply to chain, réglages spéciaux | la bulle S67 : nombre (− / + / saisie, molette), « Mettre la chaîne à l'échelle », recette, écrans S10, diesel S18, Mineshaft, « Fixer ce nombre » (S8), Supprimer |
| Modes temporaires | Alt = supprimer, Ctrl = multi, Maj = cible | identiques, rappelés en bas du canevas quand la touche est enfoncée |
| Annuler / rétablir | Ctrl Z / Ctrl Y | identiques, historique du document |
| Disposition automatique | Layout | « Ranger » : `flow-layout.ts` (de l'extraction à l'objectif, sans chevauchement) ; un nœud déplacé à la main reste où on l'a mis jusqu'au prochain « Ranger » |
| Groupes | multi-sélection → Add Group, repliables avec prises mandataires | G5, mêmes règles |
| Sauvegardes locales et fichier | Saves, export JSON | plans enregistrés (S64) élargis au graphe ; fichier ; import / export de leur format |
| Unité | /sec, /min, /h, par cycle | le réglage « par seconde / par minute » du site, appliqué au graphe |

Ce qu'on ne reprend pas : leurs thèmes de couleurs, la gestion de leurs données (Data manager), leur
panneau Research (nous avons l'Arbre et Ma recherche), l'édition des coudes des arêtes (les arêtes se
tracent seules, orthogonales ; à revoir seulement si les joueurs le demandent).

## 4. Architecture

Un **document graphe** devient l'état central de Planifier :

```
Graph = { nodes: Node[], edges: Edge[], target: nodeId | null, rate: /min }
Node  = { id, recipeId, machines (décimal permis, affiché entier si réglage), fixed?, settings?, x, y, group? }
Edge  = { from: nodeId, fromPort: item, to: nodeId, toPort: item }
```

Trois choses y écrivent : le solveur (la proposition : plan → graphe, chaque étape devient un nœud,
chaque flux une arête), le joueur (ses gestes, chacun une commande annulable), un fichier (ouvrir,
importer). Tout le reste le lit : rail des étapes, tableau de bord, Usine, plans de pose.

- **Équilibre** (`src/engine/graph/balance.ts`) : pour chaque nœud, débits = machines × recette ÷ durée ;
  pour chaque produit, offre = sorties reliées, demande = entrées reliées ; manque si demande > offre,
  excédent sinon ; totaux (puissance, pollution, prix, cases, nombre de machines). Pur, testé, instantané.
- **Recalculer** (`src/engine/graph/solve-from-graph.ts`) : le graphe devient une requête pour
  `solve()` : `onlyRecipes` = recettes du graphe (les sous-produits suivent, commit 708ea55),
  `fixedMachines` = nœuds fixés, cible et débit = nœud cible. Le résultat est comparé nœud par nœud
  (avant / après) ; « Appliquer » écrit les nombres dans le document, ajoute les nœuds que le solveur a
  dû créer (signalés comme tels), et retire ceux qu'il n'utilise plus seulement si le joueur le coche.
- **Rendu** (`src/ui/graph-view.ts`) : nœuds en HTML (texte net à tout zoom, accessibles au clavier),
  arêtes en SVG dessous, le tout dans un « monde » déplacé et zoomé par `canvas.ts`. Au dézoom
  (< 0,5), les lignes d'entrées et de sorties s'effacent et le nœud ne garde que machine, nombre et
  produit ; les étiquettes des arêtes disparaissent. Test de charge : 400 nœuds, glisser fluide.
- **Fichier** (`src/engine/graph/file.ts`) : notre JSON ; `pollywrath-import.ts` (déjà fait) et
  `pollywrath-export.ts` (table inversée) pour l'échange.

## 5. Lots

| Lot | Contenu | Fini quand | Taille |
| --- | --- | --- | --- |
| **G0** | Ce plan et la maquette `editeur-graphe.html` dans notre charte : canevas charbon à croix, nœud avec prises, bulle d'un nœud, sélecteur filtré par un clic sur une entrée, équilibre dans le volet droit, outils flottants, aperçu du recalcul, modes temporaires, téléphone | maquette validée par l'utilisateur | petite |
| **G1** | Modèle de graphe (moteur pur, tests) : document, commandes annulables, équilibre, fichier, plan → graphe, graphe → requête du solveur, export Pollywrath | tests ; plan Gearbox → graphe → équilibre nul ; aller-retour fichier ; export relu par notre import | moyenne |
| **G2** | Canevas : rendu des nœuds et arêtes, déplacement, zoom, sélection, glisser un nœud (les arêtes suivent), « Ranger », détail selon le zoom, test de charge | la proposition s'affiche dans l'éditeur à la place de l'image ; 400 nœuds fluides | moyenne |
| **G3** | Édition : ajouter (palette étendue), clic sur une entrée → producteurs, relier des prises (souris et doigt), supprimer, nombre dans la bulle, remplacer une recette, cible, modes temporaires, raccourcis, annuler / rétablir | chaque geste a un test ; parcours : construire Gearbox à la main depuis un canevas vide | grande |
| **G4** | Raccord : « Recalculer » avec aperçu ; rail, tableau de bord, Usine, plans de pose lisent le graphe ; l'onglet Schéma d'avant disparaît ; plans enregistrés élargis | le plan Gearbox modifié à la main se recalcule, se pose et s'exporte en .msch | grande |
| **G5** | Confort : groupes repliables, import / export du format Pollywrath depuis l'éditeur, réglages spéciaux dans la bulle, tutoriel mis à jour, anglais, mention de l'inspiration | parcours FR / EN ; tutoriel « Modifier la proposition » | moyenne |
| **G6** | Parcours réel et nettoyage : tâches de joueur chronométrées (ordinateur, téléphone), retrait de l'ancien code du schéma, bilan | mesures notées ici ; code mort retiré | petite |

Un lot par session, dans cet ordre ; chaque lot se termine par tests, parcours dans le navigateur,
commit, `npm run deploy`, bilan au § 7, puis feu vert.

## 6. Questions

Réglées le 2026-11-17 : l'éditeur remplace l'onglet Schéma (oui) ; équilibre en direct, solveur sur
demande avec aperçu (oui) ; croix au lieu d'une grille, fond charbon profond (demande de l'utilisateur).

À trancher sur la maquette (G0) :

1. Les arêtes portent-elles le produit et le débit en étiquette (comme aujourd'hui), ou seulement le
   débit sur les lignes du nœud (comme chez eux) ? [Étiquette courte sur l'arête, débit sur les lignes du
   nœud ; l'étiquette s'efface au dézoom.]
2. Un nœud dont le nombre n'est pas entier : affiché tel quel (8,33) ou arrondi vers le haut avec le
   taux d'utilisation ? [Entier vers le haut, utilisation en petit ; l'exact dans la bulle.]
3. Quand le joueur relie une sortie à une entrée d'un autre produit : refusé au tracé (comme le bac à
   sable, Q14-9) ? [Oui, la prise refuse et clignote.]

## 7. Journal

- **2026-11-17, G0** : plan écrit ; maquette fonctionnelle vérifiée dans le navigateur à 1400 px et à 375 px (équilibre, liaison des prises à la souris et au doigt, sélecteur filtré, recalcul, bulle, modes temporaires). Non déployée (serveur de développement seulement). En attente de validation ; les 3 questions du § 6 se tranchent dessus.
