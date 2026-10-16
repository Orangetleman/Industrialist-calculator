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
- **4 rotations** pour tous les bâtiments, par quarts de tour : pas de 45° (d'où les pièces
  Light et Inclined Light). Le calculateur déduit les rotations : il suffit de relever le
  bâtiment posé sans rotation.
- Les **câbles électriques** ne sont pas gênés par les obstacles : seule compte la position
  approximative de la prise.

## La méthode : l'éditeur de bâtiments du site

Page **Données**, onglet « Éditeur de bâtiments » de https://industrialist.myprisme.fr (ancienne adresse `#batiments` redirigée) :

1. En jeu, pose le bâtiment **sans le faire pivoter** et prends **une capture vue de dessus**.
   Les entrées et sorties sont visibles sans activer les onglets de connexion.
2. Sur le site, choisis le bâtiment dans la liste. Sa taille du wiki est déjà proposée ;
   ajuste largeur et hauteur, ou échange-les avec ⇄.
3. Ouvre « Capture d'écran en fond » et charge ta capture. Elle **reste dans ton navigateur**.
4. **Caler sur 2 coins** (proposé dès le chargement) : clique le coin haut-gauche du bâtiment
   sur la capture, puis son coin bas-droit. La capture se met à l'échelle toute seule. Zoome
   avant de cliquer pour être précis ; si les proportions ne collent pas, l'éditeur le dit
   (largeur et hauteur inversées, le plus souvent).
5. Pour retoucher : mode **✥ Capture** (en bas à gauche de la grille). On glisse la capture,
   la molette l'agrandit (Maj + molette : plus fin), les flèches la décalent d'un dixième de
   case. En mode **✎ Ports**, on se déplace et on zoome comme dans l'arbre de recherche.
6. Pose les ports :
   - **Port objet** ou **Port fluide**, sens **entrée**, **sortie** ou **les deux** (poteaux,
     stockages) : clique dans la marge, en face du plot de la capture ;
   - **Prise ⚡** : clique sur le corps, à peu près au-dessus du boîtier jaune (la demi-case
     suffit). Sens **sortie** pour un générateur, **les deux** pour un poteau ;
   - **Logique** : dans la marge ou sur le corps selon le bâtiment ;
   - clique ensuite sur un port pour ajouter **l'info-bulle du jeu**. Avec la gomme, un clic sur
     un port le retire. Aucun port ne dépasse du bâtiment : le tuyau se branche sur la case juste
     à côté du bord (l'ancien champ « Plot » a été retiré le 2026-10-16).
   - Pas de prise électrique (Boiler, Firebox…) : coche **Sans prise électrique**.
7. Le relevé est **complet** dès que l'empreinte, les ports et la prise (ou « sans prise ») sont
   là. **Enregistrer le relevé**, puis **Exporter mes relevés** quand tu en as plusieurs.
   Envoie-moi le fichier : je l'intègre à `data/ports.json`. Une fois intégré, la copie locale
   est retirée de ton navigateur toute seule.

N'importe qui peut s'en servir pour ajouter un bâtiment, et l'export fonctionne de la même façon.

## Températures de vapeur (énergie)

La puissance d'une Large Turbine dépend de la température de la vapeur. Le wiki ne la donne que
pour la Firebox (vers 190 °C). Pour calculer les autres installations, il me faut, en jeu, la
température de la vapeur en sortie du Boiler, une fois stabilisée :

- Firebox, pour confirmer les 190 °C ;
- Industrial Firebox (eau chauffée à 300 °C) ;
- Geothermal Well (trois puits en chaîne) ;
- Gas Burner, si possible.

Indique aussi comment l'eau usée du Boiler est branchée (renvoyée ou non dans sa seconde
entrée).

## Sans le site : la fiche texte

Si c'est plus simple sur le moment, envoie la capture vue de dessus avec, pour chaque port qui ne
se voit pas bien, une ligne :

```
type    | sens    | côté   | case | info-bulle du jeu
objet   | entrée  | bas    | 1    | input for metal ingot
énergie | entrée  | dessus | 1,2  |
```

- **type** : objet, fluide, énergie, logique.
- **sens** : entrée, sortie, les deux.
- **côté** : haut, bas, gauche, droite de la capture, ou `dessus` pour un boîtier posé sur la
  machine.
- **case** : numéro le long du bord, depuis la gauche (bords haut et bas) ou depuis le haut
  (bords gauche et droit). Pour un boîtier sur le dessus : `colonne,ligne`, une demi-case étant
  permise.

Je déduis le reste de la capture.

## Déjà relevés

16 bâtiments (voir `data/ports.json`) :
- toute la ligne Vilebrequin, sauf la ferme d'arbres : Press, Roller, Craft Assembler, Iron
  Drill, Coal Drill, Grinder, Industrial Kiln, Blast Furnace ;
- énergie : Boiler, Firebox, Large Turbine, Steam Turbine, LV Pole, MV Pole ;
- logistique : Small Item Storage Silo, Truck Depot.

À confirmer : le Truck Depot et le Small Item Storage Silo ont-ils une prise électrique ? (Le
wiki laisse le champ vide.)

Prochains utiles :
- ferme d'arbres : Tree Farm Controller, Tree Farm Output, Tree Farm Sprinkler, Tree Farm
  Water Tank, Farm Harvester ;
- énergie : Gas Burner, Electric Water Heater, Geothermal Well, Industrial Firebox ;
- poteaux : Small MV Pole, Advanced MV Pole, HMVT ;
- stockage et vente : Medium Item Storage Silo, Small Fluid Storage Silo, Van Depot.
