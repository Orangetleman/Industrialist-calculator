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

### Tailles mesurées au lot P1 (2026-11-24, codec réel `src/engine/share/`, vrais designs du site)

Mesure : `$env:MESURE = "1"; npx vitest run src/engine/share/mesure.test.ts` (designs de `tests/share-designs.ts` :
plan du site tout débloqué → graphe retouché comme en G3–G5 + réglages, et son usine convertie en bac à sable
comme l'export .msch actuel, 220 × 160). Longueurs de l'adresse complète `https://industrialist.myprisme.fr/#d=1.…`.

| Design | JSON brut | JSON + deflate | **Lien sans bac à sable** | **Lien avec bac à sable** | Fichier `.indus` avec usine figée |
|---|---|---|---|---|---|
| petit : Gearbox 120/min, 33 nœuds, 59 arêtes, 4 451 blocs, 634 câbles | 283 400 o | 44 856 car. | **954 car.** | **10 553 car.** | 14 981 o |
| moyen : Crankshaft 600/min, 27 nœuds, 51 arêtes, 5 653 blocs, 484 câbles | 345 817 o | 54 863 car. | **866 car.** | **10 697 car.** | 15 233 o |
| gros : Crankshaft 3 600/min, 29 nœuds, 49 arêtes, 22 749 blocs, 5 365 câbles | 1 540 239 o | 214 416 car. | **878 car.** | **35 650 car.** | 53 393 o |

Ce que ça change par rapport à l'étude (chiffres synthétiques de 30 à 900 blocs) :
- **Graphe + réglages : toujours sous 1 000 caractères**, même pour le gros → passe sur Discord.
- **Une usine en bac à sable compte des milliers de blocs** (chaque case de tuyau est un bloc) : 10 000 à 36 000
  caractères, donc jamais sur Discord. Le binaire maison divise quand même par 4 à 6 le JSON compressé.
- Un petit montage fait à la main (une dizaine de blocs) ajoute moins de 100 caractères (lien figé « bac-à-sable »).
- Le fichier `.indus` avec usine figée reste léger : 15 à 53 Ko.
→ Question B (§ 5 bis, tranchée) : case cochée par défaut, et si seul le bac à sable fait dépasser, on propose le lien sans lui ou le fichier.

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

### Question B tranchée (2026-11-24) : bac à sable dans le lien — la proposition est retenue (à faire en P2)
Une usine convertie en bac à sable fait 10 000 à 36 000 caractères : avec la case « bac à sable » cochée par défaut,
presque tout lien dépasserait 1 900 caractères et basculerait vers le fichier. Proposition : la case reste cochée
par défaut, mais si le lien dépasse 1 900 caractères à cause du seul bac à sable, la fenêtre le dit (« sans le bac
à sable : 900 caractères, passe sur Discord ») et propose les deux : lien sans bac à sable, ou fichier complet.
Décision de l'utilisateur : « Oui, ta proposition ».

### Gestionnaire de designs : un vrai gestionnaire de fichiers
- Jamais deux fois le même nom dans un dossier (majuscules et espaces autour ignorés). Renommer vers un nom pris :
  message rouge sous le champ, on reste dans le champ. Créer, dupliquer, déplacer, importer, restaurer vers un nom
  pris : suffixe automatique « (2) », « (3) »… et un message qui le dit.
- Comme VS Code : un clic choisit, double clic ouvre, F2 renomme, Suppr met à la corbeille, Entrée ouvre ;
  dossiers d'abord puis ordre alphabétique ; glisser vers un dossier ou vers le titre (racine) ; corbeille avec
  « Restaurer » (retour au dossier d'origine) et « Vider » (confirmation, irréversible).

### Conflits de noms : les options de l'Explorateur de Windows (2026-11-24)
Déplacer, restaurer, ouvrir un lien vers un dossier où le nom existe déjà ouvre la fenêtre « Conflit de noms » :
- design : **Remplacer le design dans la destination** (l'ancien part à la corbeille, rien n'est détruit),
  **Ignorer ce design**, **Comparer les informations des deux designs** (date, machines, taille, « plus récent »,
  « plus volumineux » ; cocher l'un, l'autre ou les deux → les deux gardés, l'arrivant numéroté « (2) ») ;
- dossier : **Fusionner les dossiers** (chaque doublon repose la question), **Ignorer ce dossier**, **Conserver les deux** ;
- « Effectuer cette action pour les N conflits suivants » quand il y en a plusieurs ; Annuler arrête tout ;
  les éléments ignorés restent à leur place. La corbeille, elle, garde tout sans question.
- Le renommage garde son message rouge sous le champ (pas de fenêtre).

### Design affiché supprimé
Un design dans la corbeille ne s'ouvre pas (« Restaurez-le pour l'ouvrir »). Si le design affiché part à la
corbeille ou est supprimé, un nouveau design vide s'ouvre aussitôt : jamais de page cassée, Partager marche toujours.

## 6. Lots (une session = un lot, validation entre lots)
- **P0** — Maquette cliquable dans `maquette/` (bouton, fenêtre, aperçu) ; validation.
- **P1** — Codec pur `src/engine/share/` (binaire v1, tables d'ids, varint, deflate, base64url) + tests aller-retour,
  fuzz, liens figés ; mesures sur vrais designs. **Fait le 2026-11-24** (§ 2 : tailles réelles ; question B).
- **P2** — Bouton Partager + ouverture du lien (confirmation, design importé enregistré, précédent gardé en « design actif »).
  **Fait le 2026-11-24** : `src/ui/share-design.ts` (pur, testé) et `src/ui/share-view.ts`. Les plans enregistrés
  portent le design entier au format du lien (`d`, 50 au plus) ; le reçu est enregistré (nom libre, « (2) ») et
  affiché ; le précédent est gardé avec « design actif, non enregistré » s'il n'y est pas déjà à l'identique.
  Un design sans bac à sable laisse le montage du bac à sable en place. Un ancien lien `#bac/<code>` ne change
  que le bac à sable (réglages et graphe gardés). La partie « fichier » de la fenêtre attend P4.
- **P2 bis** — Explorateur de designs façon IDE (dossiers, renommer, glisser, corbeille), reprend « Plans enregistrés ».
  **Fait le 2026-11-24** : `src/ui/designs-model.ts` (arbre pur, testé) et `designs-view.ts`, stockage `ind-calc:v1:designs`.
  « Mes designs » a sa zone fixe en bas du volet gauche. Pastille = non enregistré : quitter un design garde son travail en
  cours dans le design (« Revenir à l'enregistrement » l'abandonne). Un design neuf suit le nom de son objectif jusqu'à ce
  qu'il soit enregistré ou renommé. Un lien reçu va dans « Reçus ». Les anciens plans enregistrés sont repris une fois, leur
  ancienne liste reste intacte dans le navigateur. Stockage plein : on le dit et rien n'est perdu ni quitté.
- **P3** — Empreinte du plan de pose et message « le site a changé ».
  **Fait le 2026-11-24** : § 6 bis ; `src/engine/share/print.ts`, champ `print` du codec, `checkNotes` de `share-design.ts`.
- **P4** — Fichier `.indus` versionné (version du site + usine figée), retrait de toute trace du .msch à l'écran, anciens codes toujours lus.
- **P5** — Parcours réel chronométré à la souris (panneau visible), déploiement.

## 6 bis. L'empreinte (P3)
- **8 octets** (16 chiffres hexadécimaux), deux FNV-1a 32 bits, champ optionnel en fin de corps (drapeau 16, format
  toujours v1 : les liens figés se lisent inchangés ; rien n'avait encore été déployé). Coût : moins de 16 caractères.
  - 4 octets « plan » : étapes (clé, recette, machine, nombre) et liaisons (de, vers, objet) ;
  - 4 octets « pose » : taille de l'usine, modules (position, taille, rotation, machines, pièces de tuyau, poteaux), tuyaux
    entre modules, liaisons, évacuations, étapes collées, arrivée électrique, poteaux et prises, câbles et relais.
- Listes triées, aucun texte affiché : ni la langue ni l'ordre interne ne comptent. Pas de pose (zéros) tant que l'usine
  n'est pas calculée, ou si le calcul a été abrégé par ses 20 s (il dépend alors de l'ordinateur).
- **Partager** : le lien est prêt tout de suite (empreinte du plan) ; l'usine finit en arrière-plan, le lien se complète et
  se recopie tant que la fenêtre est ouverte.
- **Ouvrir** : l'usine du design reçu se recalcule en arrière-plan sans être affichée (résultat gardé, donc pas refait après) ;
  on peut ouvrir sans attendre, une différence se dit alors par un message.
  - identique : « Vérifié » (même si la version du site diffère : pas d'alerte fausse) ;
  - différente : alerte (machines, ou seulement la pose), phrase de la maquette si la version est plus ancienne, conseil du fichier ;
  - même plan, pose pas comparable, ou pas d'empreinte : mention neutre ; version différente non vérifiée : phrase de la maquette.
- L'usine comparée est celle que le joueur **verrait** : elle dépend aussi de sa partie (recherches, pollution, mois,
  corrections, parcelle, relevés). L'alerte le dit. Chez un joueur sans aucune recherche, le plan peut être vide.
- Le plan enregistré à l'ouverture ne garde pas l'empreinte (elle a servi).

### Questions C et D tranchées (2026-11-24)
- **C. Oui, avant P4** : le lien porte le profil de l'auteur, avec une session de lecture (§ 6 ter).
- **D. Oui** : P4 augmente le numéro de version à chaque déploiement, avec les `/v/<version>/`.

## 6 ter. Profil dans le lien et session de lecture (P3 bis, maquette `maquette/session-lecture.html` validée le 2026-11-24)
Décision de l'utilisateur : à l'ouverture, deux choix.
1. **Imprimer le profil du lien sur sa partie.** Proposé : on coche ce qui est repris, la partie d'avant reste récupérable.
2. **Session de lecture** : parallèle, enfermée dans le design et gérée dans le gestionnaire ; tant que ce design est
   actif, le site se comporte comme si le profil du lien était le sien, avec une **indication claire** (proposé : bandeau
   collant, cadre autour de la page, puces teintées, étiquette « lecture » dans le gestionnaire, titre de l'onglet).
   Ce qu'on y change (recherches…) reste dans le design, jamais dans sa partie.

Profil (proposé) : recherches (débloquées, objets faits, machines possédées), « Ma partie » (pollution, mois **résolu chez
l'auteur**, igloo, difficulté, argent, RP, parcelle, ma recherche), corrections, relevés de ports, d'interfaces et diesel.
Jamais : langue, thème, images, journal des RP, remarques, pseudo. Recherches en bitmap (149 → 19 octets, ≈ 26 caractères) ;
le reste à mesurer sur de vrais profils. Un lien sans profil s'ouvre comme aujourd'hui.

Idée « données en hexa » : regardée, pas retenue. Un caractère hexa porte 4 bits, un caractère base64url (déjà en place,
après le binaire maison et deflate) 6 bits : les mêmes octets feraient 1,5 fois plus long en hexa.

**P3 bis a fait le 2026-11-24** : champ `profile` du codec (drapeau 32, toujours v1), `src/engine/share/nodes-v1.ts` (recherches
figées), `assembleProfile` de `share-design.ts`. Pas encore branché : tant que le site ne sait pas ouvrir une session de
lecture, les liens n'emportent pas de profil. Mois et RP sont résolus chez l'auteur (RP du moment, sans heure de relevé).

Coût mesuré (`$env:PROFIL = "1"; npx vitest run src/ui/share-profile --disable-console-intercept`), sur un lien de 918 caractères
(données seules) : neuf **+38**, une recherche sur deux **+59**, tout débloqué **+43**, avec « Ma recherche » remplie à vide
**+219**, avec un relevé de ports local **+534**. Les relevés faits à la main sont donc le seul poids : s'ils font dépasser
1 900 caractères, proposer le lien sans eux ou le fichier, comme pour le bac à sable (question B).
Décision (2026-11-24) : oui, **mais prévenir des conséquences** de ne pas partager les contributions liées au design (corrections,
relevés) : la fenêtre doit dire ce qui manquera et l'effet chez le lecteur (recettes ou ports supposés, plan et pose
recalculés différents, alerte d'empreinte), avant de copier le lien allégé. À faire avec P3 bis c.

**P3 bis b fait le 2026-11-24** : `src/ui/profile-store.ts` aiguille les 7 clés du profil (recherches, « Ma partie », journal des RP,
corrections, ports, interfaces, diesel). Pendant une lecture elles vont dans `ind-calc:v1:lecture` (relu au rechargement), puis
dans le design (`w`/`d`) quand on le quitte ou l'enregistre ; les clés du joueur ne sont plus écrites, sauf l'heure de « Je joue ».
Restent au joueur : réglages d'affichage, notes, images, corrections de blocs modulaires. Bandeau, cadre, puces, étiquette
« lecture », titre de l'onglet ; « Revenir à ma partie » rouvre le design d'avant. L'essai d'empreinte se fait avec le profil du lien.
En lecture, « Envoyer mes corrections / relevés » est masqué (ce sont ceux de l'auteur). Un lien qui porte un profil s'ouvre pour
l'instant toujours en session de lecture ; partager depuis une session garde son profil. La pose suit aussi les corrections et
les relevés diesel (`currentPorts().sig`) : deux profils ne partagent jamais une usine gardée.

Lot restant : **P3 bis c** Partager avec son propre profil, fenêtre à deux choix, impression, parcours réel ; puis P4.

## 7. Ne pas toucher
L'import / export lié à Industrialist Calculator (`graph/pollywrath-export.ts`, `pollywrath-graph.ts`, `groups.ts`
et `ui/pollywrath-import.ts`) ainsi que les fichiers du graphe (`src/engine/graph/`, `ui/graph-edit.ts`, `ui/graph-view.ts`)
sont à une autre session et restent tels quels. Le codec de partage ne fait que **lire** le graphe
(`Graph`, `StoredGraphEdit`), dans son propre dossier `src/engine/share/`. Si un champ du graphe change, on ajoute une
version du format, sans modifier leur code.
