# Plan — partage d'un design par lien (étude, rien de codé)

Demande (mot pour mot) : « refonte du système de partage d'une recette : il doit être simple, efficace, rapide,
via un lien, et doit comprendre tous les éléments d'un design (graphe + usine + paramétrage). […] ne dégradant
pas d'un millimètre le design original et en n'utilisant pas le stockage distant. Le .msch est bien mais pas assez clair. »

## 1. Ce qu'il faut encoder (inventaire)

| Bloc | Où | Contenu |
|---|---|---|
| Réglages | `src/ui/state.ts` `Settings` | objectif, objet, mode débit/machines, débit + unité, critères par objectif, recettes forcées, machines fixées, filtres/réglages machines, diesel, Mineshaft, imports Pollywrath, côtés d'évacuation, énergie, pollution, budget, production existante, tier III, priorités de pose, vue usine, recherche (rpMode…) |
| Graphe | `src/engine/graph/model.ts` + `graph-edit.ts` (`StoredGraphEdit`) | nœuds (recette, machines décimal, fixé, réglages, x, y, groupe, ajouté), arêtes (de, vers, objet), cible, débit, groupes, graphe résolu, liens étape ↔ nœud |
| Usine / plan de pose | calculée (`engine/build`) à partir des deux blocs ci-dessus + données du jeu | n'est **pas** stockée aujourd'hui : elle se recalcule |
| Bac à sable / schéma | `engine/sandbox/layout.ts` `Layout` | blocs (u, id, x, y, r 0–3, choix, côtés ouverts, voies), câbles (a, ia, b, ib, p/g), liaisons, chiffres saisis (`fills`) |
| Hors design (non partagé) | progression, « Ma partie », journal RP, images, langue, thème | propre au joueur |

Existant : liens `.msch` du bac à sable (base64 du fichier, refusés au-delà de 2000 caractères), plans
enregistrés en localStorage (`saved-plans`, sans lien), fichier graphe JSON (`graph/file.ts`).

## 2. Méthode (« magouilles mathématiques », sans serveur, sans dépendance)

1. **Ne transmettre que ce qui n'est pas recalculable** : réglages + graphe (+ bac à sable s'il est inclus).
   L'usine se recalcule à l'ouverture. Pour garantir « pas un millimètre » malgré une mise à jour du site, le lien
   porte une **empreinte** (8 octets) du plan de pose calculé chez l'auteur : si l'empreinte diffère à l'ouverture,
   on le dit (« le site a changé depuis ce lien ») au lieu d'afficher autre chose en silence (voir question 2).
2. **Format binaire maison, versionné** (1er octet = version ; les anciennes versions restent lisibles à vie) :
   - ids de recettes / objets / bâtiments → **indice** dans une table figée par version de format
     (table ajoutée en fin seulement, jamais réordonnée) ; un id inconnu de la table s'écrit en clair (repli) ;
   - entiers en **varint zigzag** ; coordonnées en **delta** du précédent (nœuds triés par position) ;
   - rotation sur **2 bits** collée à l'indice de bâtiment ; type de câble sur 1 bit ;
   - ids `n1, n2…` → leur numéro ; ids d'arête **non stockés** (`from>to:item` se reconstruit) ;
   - réglages : un **bitmap de présence** puis seulement les champs ≠ `DEFAULT_SETTINGS` ;
   - décimaux : machines par quarts quand c'est exact, sinon float64 brut (aucun arrondi caché).
3. **deflate-raw natif** (`CompressionStream`, déjà employé par `msch.ts`), puis **base64url**, placé dans le
   **fragment** : `https://industrialist.myprisme.fr/#d=1.<données>` — le fragment n'est jamais envoyé au serveur.

### Tailles mesurées (script `scripts/etude/mesure-partage.cjs`, designs *synthétiques* aux vraies recettes de `data/recipes.json`)

| Design | JSON brut | JSON + deflate (lien) | Binaire maison + deflate (lien) |
|---|---|---|---|
| petit : 5 nœuds, 30 blocs, 10 câbles | 2 582 o | ~970 car. | **~230 car.** |
| moyen : 25 nœuds, 250 blocs, 80 câbles | 18 516 o | ~4 000 car. | **~1 360 car.** |
| gros : 80 nœuds, 900 blocs, 300 câbles | 65 197 o | ~12 000 car. | **~4 700 car.** |

Sans bac à sable (usine recalculée), le graphe seul tient en quelques centaines de caractères même pour le gros.
Les positions aléatoires compressent moins bien qu'un vrai design aligné : ces chiffres sont un plafond.
À refaire au lot P1 sur de vrais designs enregistrés.

### Limites pratiques
- Navigateurs : Chrome/Firefox/Edge acceptent des URL de plusieurs centaines de milliers de caractères.
- **Discord** : message limité à 2 000 caractères (4 000 avec Nitro) → c'est la vraie limite.
- Au-delà de ~1 900 caractères : on propose le **fichier** (même contenu binaire, extension `.indus`) en plus du lien.

## 3. Garantie « pas un millimètre »
- Test aller-retour `decode(encode(d))` **égal en profondeur** à `d` sur : designs enregistrés réels (fixtures à
  constituer), graphes de tests G1–G6, schémas du bac à sable, plus 1 000 designs aléatoires (fuzz).
- Test de **non-régression des liens** : des liens figés dans `tests/fixtures/liens-v1.txt` doivent toujours
  s'ouvrir à l'identique après chaque évolution.
- À l'ouverture : comparaison de l'empreinte du plan de pose (point 2.1).

## 4. Clarté de l'export .msch (ce qui n'est pas clair)
1. Trois boutons proches (code, fichier, lien) sans dire à quoi sert chacun ni lequel choisir.
2. Le nom « .msch » vient de Mindustry ; Mindustry ne l'ouvre pas (noms Industrialist) → trompeur.
3. Le lien est refusé au-delà de 2 000 caractères sans explication ni alternative proposée.
4. Le schéma ne contient que le bac à sable : ni graphe, ni réglages.
Décision (2026-11-24) : le `.msch` est **remplacé jusqu'au bout** : plus aucun bouton, mot ni mention à l'écran.
Seule reste, invisible, la lecture des anciens liens et fichiers `.msch` (convertis en design à l'ouverture).

## 5. Maquette

```
 En-tête de Planifier :      [ Partager ⤴ ]
                                  │ clic
                                  ▼
 ┌ Partager ce design ──────────────────────────────┐
 │ ✓ Lien copié  (1 240 caractères — passe sur Discord) │
 │ https://industrialist.myprisme.fr/#d=1.eJyFk…    │
 │ Contient : ☑ graphe ☑ réglages ☑ bac à sable      │
 │ ▸ Plus d'options : fichier .indus · code texte     │
 └──────────────────────────────────────────────────┘

 À l'ouverture d'un lien :
 ┌ Design partagé : « Vilebrequin 60/s » ───────────┐
 │ [aperçu miniature du graphe]                      │
 │ 12 machines · 3 étapes · crankshaft 60/s          │
 │ ⚠ remplacera votre plan en cours (gardé dans       │
 │   « Plans enregistrés »)                           │
 │      [ Ouvrir ]   [ Annuler ]                      │
 └──────────────────────────────────────────────────┘
```

## 5 bis. Décisions de l'utilisateur (2026-11-24)
1. Le lien contient graphe + réglages + bac à sable (case cochée par défaut).
2. Site changé depuis le lien → on prévient et on ouvre quand même. On **dit au joueur** : « pour un design
   indestructible, qui ne vieillit pas avec les mises à jour du site, téléchargez-le ». Le **fichier** porte la
   version du site qui l'a créé ; à l'ouverture, la dernière version du site capable de le traiter le génère avec le
   moteur correspondant (voir question A).
3. Lien de plus de ~1 900 caractères → on propose le fichier, avec ce même message.
4. `.msch` : plus affiché nulle part (§ 4).
5. Ouvrir un lien alors qu'une page du site est ouverte → confirmation ; le design importé est enregistré et
   affiché ; le design précédent n'est pas perdu : il reste dans les designs avec la mention **« design actif,
   non enregistré »**. Les designs se rangent dans un **explorateur façon IDE** (dossiers, renommer, glisser,
   supprimer avec corbeille), voir maquette `maquette/partage.html`.
6. P0 (maquette cliquable) : accord.

### Question A ouverte : « le moteur correspondant »
Proposition : le fichier contient **aussi l'usine calculée telle quelle** (blocs, positions, câbles), donc il
s'affiche à l'identique sans rien recalculer, à vie. Pour la recalculer avec l'ancien moteur, chaque version
déployée reste servie sur le Pi sous `/v/<version>/` (c'est le site lui-même, pas un stockage de données) et le
fichier propose « ouvrir avec la version d'origine ».

### Question A tranchée (2026-11-24) : les deux
- Le fichier `.indus` peut contenir l'usine figée ; **au téléchargement, une case** « Inclure l'usine figée »
  (cochée par défaut) : décochée, le fichier est bien plus léger et l'usine sera recalculée par la version du site
  qui a créé le fichier.
- Chaque version déployée reste servie sur le Pi sous `/v/<version>/`.

### Gestionnaire de designs : un vrai gestionnaire de fichiers
- Jamais deux fois le même nom dans un dossier (majuscules et espaces autour ignorés). Renommer vers un nom pris :
  message rouge sous le champ, on reste dans le champ. Créer, dupliquer, déplacer, importer, restaurer vers un nom
  pris : suffixe automatique « (2) », « (3) »… et un message qui le dit.
- Comme VS Code : un clic choisit, double clic ouvre, F2 renomme, Suppr met à la corbeille, Entrée ouvre ;
  dossiers d'abord puis ordre alphabétique ; glisser vers un dossier ou vers le titre (racine) ; corbeille avec
  « Restaurer » (retour au dossier d'origine) et « Vider » (confirmation, irréversible).

## 6. Lots (une session = un lot, validation entre lots)
- **P0** — Maquette cliquable dans `maquette/` (bouton, fenêtre, aperçu) ; validation.
- **P1** — Codec pur `src/engine/share/` (binaire v1, tables d'ids, varint, deflate, base64url) + tests aller-retour,
  fuzz, liens figés ; mesures sur vrais designs.
- **P2** — Bouton Partager + ouverture du lien (confirmation, design importé enregistré, précédent gardé en « design actif »).
- **P2 bis** — Explorateur de designs façon IDE (dossiers, renommer, glisser, corbeille), reprend « Plans enregistrés ».
- **P3** — Empreinte du plan de pose et message « le site a changé ».
- **P4** — Fichier `.indus` versionné (version du site + usine figée), retrait de toute trace du .msch à l'écran, anciens codes toujours lus.
- **P5** — Parcours réel chronométré à la souris (panneau visible), déploiement.

## 7. Ne pas toucher
L'import / export lié à Industrialist Calculator (`graph/pollywrath-export.ts`, `pollywrath-graph.ts`, `groups.ts`
et `ui/pollywrath-import.ts`) ainsi que les fichiers du graphe (`src/engine/graph/`, `ui/graph-edit.ts`, `ui/graph-view.ts`)
sont à une autre session et restent tels quels. Le codec de partage ne fait que **lire** le graphe
(`Graph`, `StoredGraphEdit`), dans son propre dossier `src/engine/share/`. Si un champ du graphe change, on ajoute une
version du format, sans modifier leur code.
