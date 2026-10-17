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
   - Pas de port objet, fluide ni logique (Tree, Farm Harvester…) : coche **Sans port**.
7. Le relevé est **complet** dès que l'empreinte, les ports (ou « sans port ») et la prise (ou « sans prise ») sont
   là. **Enregistrer le relevé**, puis **Exporter mes relevés** quand tu en as plusieurs.
   Envoie-moi le fichier : je l'intègre à `data/ports.json`. Une fois intégré, la copie locale
   est retirée de ton navigateur toute seule.

N'importe qui peut s'en servir pour ajouter un bâtiment, et l'export fonctionne de la même façon.

### L'interface d'une machine (S10)

Sous les ports, la section **Interface** note ce que la machine propose quand on s'en approche
(« [E] Interact », un levier, un écran). Rien pour le placement : seulement le réglage.

1. **Type** : fenêtre de réglages, levier, choix direct sur la machine, ou bouton ; **Où** (sur
   le côté, écran à l'avant…) ; **Choix définitif** si le choix ne se change plus après la pose.
2. Pour chaque **réglage**, son nom et sa sorte :
   - **un choix parmi des positions** : le texte du jeu de chaque position, et les crafts que la
     machine fait dans cette position (cases à cocher) ;
   - **un nombre** : sa valeur par défaut et ce qu'il multiplie dans tous les crafts (entrées,
     sorties ou énergie), comme l'écran de la Chemical Plant ;
   - **sans effet sur le calcul** (porte logique, panneau…) : dire pourquoi.
3. **Enregistrer l'interface**. Elle sert tout de suite aux plans (« ⚙ levier sur … ») et part
   avec **Exporter mes relevés** (clé `interfaces`, à intégrer à `data/interfaces.json`).

Les interfaces déjà connues (wiki et tes réponses) sont dans `data/interfaces.json` ; un ⚙ les
marque dans la liste des bâtiments.

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

## Machines modulaires (portées, réglages)

Ce que les wikis ne disent pas est listé dans `data/a-verifier.md` (questions MOD-01 à MOD-16).
Tout se fait en **mode bac à sable** si tu en as un, sinon avec quelques blocs bon marché
(arbre 80 $, arroseur 200 $). La portée est un cercle : on mesure donc **en ligne droite** depuis
le bloc, puis **en diagonale** pour vérifier.

Pour compter les cases, pose une rangée de Short Pipes (1 case chacun) depuis le bord du bloc,
ou prends une capture vue de dessus : je compte sur l'image.

Avant tout : quand tu poses ou sélectionnes un contrôleur, un arroseur ou un récolteur, le jeu
affiche-t-il un **cercle de portée** ? Si oui, une capture vue de dessus de ce cercle suffit pour
chaque bloc (MOD-01, 03, 05).

### Ferme d'arbres

1. **Arroseur (MOD-03, MOD-04)** : un contrôleur, un réservoir rempli, un arroseur. Pose une
   ligne d'arbres collés les uns aux autres depuis l'arroseur, vers la droite, sur 5 arbres.
   Attends un cycle (environ 35 s) : note **le dernier arbre qui reste vert** (les autres
   brunissent). Recommence en décalant toute la ligne **d'une case** vers l'extérieur : le dernier
   arbre vert change-t-il ? C'est ce qui dit si l'arbre doit être touché ou avoir son centre dans
   le cercle.
2. **Récolteur (MOD-05, MOD-06)** : même chose avec des arbres mûrs autour d'un récolteur :
   quel est le plus loin qu'il coupe ? Puis éloigne la sortie case par case : à partir de quand
   le récolteur ne dépose plus ?
3. **Contrôleur (MOD-01, MOD-02)** : éloigne l'arroseur (avec ses arbres) du contrôleur, une case
   à la fois, jusqu'à ce que les arbres ne soient plus arrosés. Fais pareil avec le réservoir.
4. **Arrosage (MOD-07, MOD-08)** : niveau du réservoir avant et après 5 minutes avec un seul
   arroseur, sans pompe branchée (le réservoir affiche son niveau par paliers de 100 L). Avec un
   deuxième réservoir **vide** et 4 arroseurs : le quatrième arrose-t-il ?
5. **Rythme (MOD-09)** : une ferme connue (par exemple le guide du wiki : 88 arbres, 4 récolteurs),
   un Item Rate Meter ou un compteur de stock sur la sortie pendant 10 minutes, et un Power Rate
   Calculator sur le câble du contrôleur. Note aussi la pollution du monde.

### Moteur diesel

6. **Réglages (MOD-12, MOD-14)** : le montage simple du wiki (1 contrôleur, 8 vilebrequins,
   6 cylindres, 1 air, 1 échappement, 1 carburant, 1 générateur), un Diesel Engine Info Panel et un
   Power Rate Calculator2 en sortie. Pour quelques réglages, une ligne par essai :

   ```
   cylindres | air/carburant | accélérateur | couple (MT) | carburant (L/s) | puissance (MF/s) | diesel utilisé
   6         | 14            | 100          |             |                 |                  | Refined Diesel
   ```

   Ajoute ensuite des cylindres par 3 jusqu'à ce que l'Info Panel signale un manque d'air ou
   d'échappement (seuil de MOD-14).
7. **Faces (MOD-11, MOD-13)** : une capture vue de dessus du montage, une autre avec le volant
   posé ; et la distance la plus courte entre deux moteurs qui marchent tous les deux.
8. **Devant (MOD-17)** : pour chaque bloc du moteur (et de la turbine si tu en as une), pose-le
   sans le faire pivoter, comme pour son relevé de ports, à côté d'un bloc déjà posé dans la
   chaîne. Le bord tourné vers le générateur (ou vers la Turbine Output) est « devant ». Note-le
   dans l'éditeur de bâtiments, section « Ensemble modulaire », champ « Devant, sur la grille du
   relevé » : il s'enregistre tout de suite et part avec « Exporter mes relevés ».

### Turbine

9. Seulement si tu as une turbine : pour chaque turbine, débit et température de la vapeur,
   nombre de HPT et de LPT, puissance affichée (MOD-16).

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

46 bâtiments (liste complète : `data/ports.json`), dont :
- toute la ligne Vilebrequin, ferme d'arbres comprise (Tree, Tree Farm Controller, Tree Farm
  Output, Tree Farm Sprinkler, Tree Farm Water Tank ; Farm Harvester : ni port ni prise) ;
- énergie : Boiler, Firebox, Large Turbine, Steam Turbine, LV Pole, MV Pole ;
- chimie et pétrole (relevés du 2026-10-13 au 2026-10-16) : Steam Cracking Plant, Advanced Oil
  Separator, Oxidation Plant, Chemical Reactor, Oil Fracking Tower, Quarry ;
- logistique : Small Item Storage Silo, Truck Depot.

À confirmer : le Truck Depot, le Small Item Storage Silo et le Tree Farm Sprinkler ont-ils une
prise électrique ? (Ni prise ni « Sans prise électrique » dans leur relevé.)

Prochains utiles :
- énergie : Gas Burner, Electric Water Heater, Geothermal Well, Industrial Firebox ;
- poteaux : Small MV Pole, Advanced MV Pole, HMVT ;
- stockage et vente : Medium Item Storage Silo, Small Fluid Storage Silo, Van Depot.
