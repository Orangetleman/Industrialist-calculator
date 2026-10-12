# Relever un bâtiment en jeu

Le wiki ne dit pas où se trouvent les entrées et sorties des machines. C'est pourtant
indispensable pour dessiner des plans de construction. Ce qui suit est fait pour prendre
**une minute par bâtiment**.

## Ce qui est déjà acquis

Relevé en jeu le 2026-10-12 :

- **1 case = 1 Short Pipe** (2 × 2 studs). On ne peut pas placer un objet entre deux cases. Les
  tailles des machines du wiki sont en cases, mais pas toujours dans l'ordre largeur × hauteur
  de la vue de dessus (l'Iron Drill fait « 6x2 » sur le wiki et 2 × 6 à l'écran). C'est pourquoi
  l'empreinte se relève **telle qu'on la voit**.
- Les **câbles électriques** ne sont pas gênés par les obstacles : seule compte la position
  approximative de la prise.
- À confirmer : le nombre de rotations d'un bâtiment (4 quarts de tour ?).

## La méthode : l'éditeur de bâtiments du site

Onglet **Bâtiments** de https://industrialist.myprisme.fr :

1. En jeu, pose le bâtiment **sans le faire pivoter** et prends **une capture vue de dessus**.
   Les entrées et sorties sont visibles sans activer les onglets de connexion.
2. Sur le site, choisis le bâtiment dans la liste. Sa taille du wiki est déjà proposée ;
   ajuste largeur et hauteur, ou échange-les avec ⇄.
3. Ouvre « Capture d'écran en fond » et charge ta capture. Elle **reste dans ton navigateur**.
   Règle l'échelle pour qu'un Short Pipe fasse une case, puis cale le bâtiment sur le rectangle
   bleu.
4. Pose les ports :
   - **Port objet** ou **Port fluide**, sens **entrée** ou **sortie** : clique dans la marge grise,
     en face du plot de la capture ;
   - **Prise ⚡** : clique sur le corps, à peu près au-dessus du boîtier jaune (la demi-case
     suffit) ;
   - **Logique** : dans la marge ou sur le corps selon le bâtiment ;
   - clique ensuite sur un port pour ajouter **l'info-bulle du jeu** (ex. « Input for Coal or
     coke Fuel ») et, si besoin, la longueur du plot.
5. **Enregistrer le relevé**, puis **Exporter mes relevés** quand tu en as plusieurs. Envoie-moi
   le fichier, ou dépose-le : je l'intègre à `data/ports.json`.

L'éditeur signale ce qui manque (empreinte, prise électrique, port hors du bord). N'importe qui
peut s'en servir pour ajouter un bâtiment, et l'export fonctionne de la même façon.

## Sans le site : la fiche texte

Si c'est plus simple sur le moment, envoie la capture vue de dessus avec, pour chaque port qui ne
se voit pas bien, une ligne :

```
type    | sens    | côté   | case | info-bulle du jeu
objet   | entrée  | bas    | 1    | input for metal ingot
énergie | entrée  | dessus | 1,2  |
```

- **type** : objet, fluide, énergie, logique.
- **côté** : haut, bas, gauche, droite de la capture, ou `dessus` pour un boîtier posé sur la
  machine.
- **case** : numéro le long du bord, depuis la gauche (bords haut et bas) ou depuis le haut
  (bords gauche et droit). Pour un boîtier sur le dessus : `colonne,ligne`, une demi-case étant
  permise.

Je déduis le reste de la capture.

## Déjà relevés

Press, Iron Drill, Coal Drill, Grinder, Industrial Kiln et Blast Furnace (voir `data/ports.json`).

Prochains utiles :
- Roller, Craft Assembler ;
- Boiler, Firebox, Large Turbine, Steam Turbine ;
- poteaux LV et MV ;
- Small Item Storage Silo, Truck Depot.
