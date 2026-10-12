# Relever un bâtiment en jeu

Le wiki ne dit pas où se trouvent les entrées et sorties des machines. C'est pourtant
indispensable pour dessiner des plans de construction. Cette fiche décrit **comment les relever
en jeu** et **comment me les transmettre**, en quelques minutes par bâtiment.

Tu peux m'envoyer le relevé directement dans la conversation (texte + captures). Plus tard,
l'éditeur de ports de l'outil fera la même chose sans passer par moi.

## 0. Une seule fois : l'unité de la grille

À faire une fois, sur un terrain plat et dégagé :

1. Pose une **Press** sans la faire pivoter.
2. Pose à côté, bord à bord, une ligne de **Short Pipe** (tuyau tier I le plus court) le long du
   **grand côté** de la Press, puis une autre le long du **petit côté**.
3. Note :
   - combien de Short Pipes tiennent le long de chaque côté ;
   - combien de **cases de la grille** du sol couvre la Press (largeur × profondeur, en vue de
     dessus) ;
   - combien de cases couvre un Short Pipe ;
   - si le placement « saute » de case en case, ou peut se décaler d'une demi-case ;
   - la touche de rotation et le nombre de positions (4 quarts de tour ?).

Ça me permet de relier les unités du wiki : les tuyaux en « studs », la portée des poteaux en
« tuiles », et les tailles des machines.

## 1. Préparer le relevé d'un bâtiment

1. Pose le bâtiment **sans le faire pivoter** (orientation par défaut), sur un terrain plat.
2. Place la caméra **à la verticale, au-dessus**, comme sur tes captures, avec la grille visible.
   Par convention, la capture définit les côtés : **haut / bas / gauche / droite** de l'écran.
3. Prends **trois captures** de cette même vue :
   - **A** : outil de construction normal (la machine et la grille) ;
   - **B** : **onglet 2** (connexions électriques et logiques) sélectionné, avec les vecteurs
     visibles ;
   - **C** : **onglet 3** (connexions de tuyaux) sélectionné, avec les vecteurs visibles.

## 2. Remplir la fiche

Recopie ce bloc et complète-le. Laisse `?` quand tu ne sais pas : c'est mieux que de deviner.

```
BÂTIMENT : Press
EMPREINTE : 4 x 2 cases        (largeur à l'écran x hauteur à l'écran, sans rotation)
ROTATION : 4 positions ?       (si différent pour ce bâtiment)

PORTS (un par ligne) :
  type    | sens    | côté   | case | ce que le jeu affiche
  objet   | entrée  | bas    | 1    | flèche bleue vers le haut
  objet   | sortie  | bas    | 4    | flèche bleue vers le bas
  énergie | entrée  | dessus | 1,2  | boîtier jaune, 1 nœud
  logique | ?       | ?      | ?    | ?

REMARQUES : (ex. la sortie déborde d'une case, le boîtier électrique est haut,
            le port n'accepte qu'un item précis…)
```

**Comment remplir les colonnes :**

- **type** : `objet`, `fluide`, `énergie` ou `logique`.
- **sens** : `entrée`, `sortie`, ou `les deux` (certains ports logiques).
- **côté** : `haut`, `bas`, `gauche`, `droite` pour un port sur un bord ; `dessus` pour un
  boîtier posé sur la machine (énergie le plus souvent).
- **case** :
  - pour un port sur un bord, le numéro de la case le long de ce bord, en comptant **depuis la
    gauche** (bords haut et bas) ou **depuis le haut** (bords gauche et droit), à partir de 1 ;
  - pour un boîtier sur le dessus, `colonne,ligne` depuis le coin haut-gauche de la machine.
- **ce que le jeu affiche** : la couleur et le sens de la flèche (onglet 3), le nombre et la
  couleur des nœuds électriques (onglet 2), et tout texte affiché au survol ou dans le panneau
  d'information : item accepté, capacité, débit, consommation.

**Le cas des prises électriques.** Elles sont souvent sur le dessus, et la machine peut gêner le
câble selon sa taille et la position du poteau. Note donc aussi dans REMARQUES :
- la **hauteur approximative** du boîtier (bas, mi-hauteur, au sommet) ;
- si un câble a été **refusé ou coupé** par un obstacle, avec la distance et la position du
  poteau à ce moment-là.

## 3. Me l'envoyer

Envoie la fiche et les trois captures A, B et C. Je les transforme en relevé daté (source « relevé
en jeu »), intégré aux données et exportable comme les autres corrections. Tu peux en envoyer
plusieurs d'un coup.

**Par où commencer** : les machines de la chaîne du Crankshaft et de l'énergie, soit environ
15 bâtiments :
- Iron Drill, Coal Drill, Grinder, Industrial Kiln, Blast Furnace, Press, Roller, Craft Assembler ;
- Boiler, Firebox, Large Turbine, Steam Turbine ;
- LV Pole, MV Pole, Small Item Storage Silo, Truck Depot.

## 4. Ce que je fais de ces relevés

- Chaque port devient une donnée sourcée `jeu` avec sa date, dans `data/ports.json`, via les
  corrections.
- Les plans de construction (phase E4) s'en servent pour raccorder tuyaux, câbles et logique.
  Un bâtiment sans relevé est dessiné avec des ports **supposés**, clairement marqués « à
  vérifier ».
- En cas de doute (une capture qui contredit la fiche), je te pose la question au lieu de
  trancher.
