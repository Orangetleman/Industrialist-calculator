# Version publique : anglais, forme, remarques des joueurs (S16)

> Lot S16 du [plan d'action](PLAN-ACTION.md), 2026-10-24, commit de départ `822f9e3` (458 tests).
> **Plan sans code.** But : donner le lien au serveur Discord du jeu sans avoir honte. Le site doit
> être clair pour un joueur qui ne connaît pas le projet, en français et en anglais, complet et sans
> erreur visible, avec un moyen pour les joueurs d'envoyer leurs remarques.
> Décisions de l'utilisateur : Q13, Q26, Q27 (§ 4 et § 5 du plan d'action). Maquette :
> [`maquette/public.html`](maquette/public.html), validée le 2026-10-24 (Q28 : « ok pour tout »).

## 1. État des lieux (2026-10-24, après S22 à S29)

Tour fait comme un nouveau venu : partie vide sur un serveur à part (port 5189, entrée
`calculateur-public` de `.claude/launch.json`, fichier non suivi), navigateur intégré, 1 366 × 768
puis 375 px, thème clair et sombre. Contrastes et tailles de cible mesurés par le DOM.

### Ce que la réorganisation a réglé

Les 27 défauts de [REVUE.md](REVUE.md) (§ 3) ont chacun leur lot, S22 à S29, tous faits et déployés.
Planifier s'ouvre vide, la fenêtre d'orientation s'ouvre seule, l'Usine passe en premier, il y a la
barre « Ton plan » et les ⚠ sont cliquables. Aucun identifiant interne ne s'affiche
(`vocabulaire.test.ts`). Aucune erreur en console sur les six pages.

### Ce qui reste avant une version publique

| # | Constat | Où | Lot |
| --- | --- | --- | --- |
| P1 | Tout le texte est en français, écrit en dur : environ 1 400 textes dans `src/ui`, 800 dans `src/engine` (messages du moteur : « File de poteaux … », avertissements des plans de pose), 55 dans `index.html`, plus les notes des données (`ports.json` 93, `machines.json` 44, `interfaces.json` 40, `modular.json` 26…). Les nombres et les dates sont écrits en `fr-FR` à 5 endroits (`format.ts`, `main.ts`, `research-mine.ts`, `rp-chart.ts`, `module.ts`). | partout | S30 à S32 |
| P2 | Le nom du site varie : « Calculateur Industrialist » dans l'en-tête, « Calculateur de production » dans le titre de l'onglet, « Calculateur de production — Industrialist (Roblox) » dans l'aperçu Discord. Aucune mention « outil de fan, non officiel », aucun auteur. | en-tête, `<title>`, `og:*` | S33 |
| P3 | L'aperçu des liens (`og:title`, `og:description`, `og:image` en 1 200 × 630) existe déjà, mais en français seulement (`og:locale` fr_FR). | `index.html` | S33 |
| P4 | Le pied de page est un seul long paragraphe (wikis, licences, pousse des arbres, Recipe Book). Il ne dit ni qui a fait le site, ni où envoyer une remarque. | toutes les pages | S33, S35 |
| P5 | En thème sombre, le bouton orange « Renseigner mon usine » a un texte blanc à 2,4:1 (il faut 4,5:1). En thème clair, les ⚠ orangés de Recettes sont à 3,9:1. | Planifier, Recettes | S33 |
| P6 | Au téléphone, le menu défile : « Contribuer » est coupé à droite sur toutes les pages (déjà noté en S23). | en-tête | S33 |
| P7 | Au téléphone, il y a des cibles de moins de 24 px : 11 sur Planifier (dont « Options avancées », « Mon usine »), 19 sur Ma partie (cases de l'arbre, « Réinitialiser la parcelle »), et les liens du pied de page partout. | Planifier, Mon usine | S33 |
| P8 | Au téléphone, Recettes fait 10 500 px (toutes les tuiles d'un coup). | Recettes | S33 |
| P9 | Contribuer, sur une partie vide, affiche « Celles du dernier calcul 0 » et « Aucune valeur douteuse dans cette chaîne », alors qu'il n'y a pas encore de calcul. Les corrections restent dans le navigateur ou partent dans un fichier exporté, et aucune ne remonte toute seule. | Contribuer | S35 |
| P10 | Le calcul de l'usine recalculée reste long sur les grosses chaînes (Electric Motor 60/min : 145 s, S27 bis), et un visiteur ne sait pas s'il peut l'arrêter. | Usine | S33 |
| P11 | Restes de la revue : pollution en « %/h » (F4, aucun mot proposé) ; Ma recherche au-delà de 2 000 px au téléphone en mode Détaillé ; titre « Produire un objet » (la maquette disait « Que veux-tu produire ? »). | Planifier, Mon usine | S33 |
| P12 | Lecteurs d'écran : chaque bouton visible a un nom, la page a un lien d'évitement et des repères (`header`, `nav`, `main`, `footer`), et le contour au clavier existe. Ce qu'on n'a pas vérifié : l'annonce d'une réponse recalculée (`aria-live`), l'ordre du clavier dans les fenêtres, l'usage du schéma et de l'usine au clavier. | partout | S33 |

Le schéma, l'usine et l'arbre sont dessinés en SVG. La mesure automatique des contrastes s'y
trompe : elle compare le texte au fond de la page au lieu du rectangle de la pastille. Il faut donc
les contrôler à l'œil en S33.

### Référence donnée par l'utilisateur : mindustryschematics.com

Ce qu'on peut reprendre :
- **« (Unofficial) » dans l'en-tête**, à côté du nom ;
- **une image d'abord** : chaque montage est une vignette, et l'image dit plus que le texte ;
- **des votes visibles** (▲ ▼ et un compteur) sous chaque élément : c'est le modèle du +1 de la page
  « Propositions » ;
- une recherche et des étiquettes en haut de la liste ;
- un thème sombre proche du jeu ;
- un bouton d'ajout bien en vue, en bas.

Ce qui ne s'applique pas ici : les comptes (« Login »), puisque nos joueurs restent anonymes, et le
partage de montages, qui relève de S17 (bac à sable).

## 2. La traduction

### Méthode (sans dépendance)

- **Catalogue par langue** : `src/i18n/fr.ts` (la source) et `src/i18n/en.ts`, avec des clés par
  écran (`plan.title`, `usine.evac.side`…). Une fonction `t(clé, valeurs)` remplit les trous
  (`{n} machines`) et accorde le pluriel avec `Intl.PluralRules`.
- **Rien ne peut être oublié** : le type de `en.ts` est `typeof fr`. Une clé absente de l'anglais
  empêche donc la compilation (`npm run typecheck`, déjà dans `build`).
- **Langue** : celle du navigateur au premier passage (français si `navigator.language` commence par
  `fr`, sinon anglais), puis le bouton **FR / EN** de l'en-tête. Le choix est gardé
  (`ind-calc:v1:langue`). Changer de langue redessine la page sur place : on ne perd ni la saisie, ni
  l'usine calculée.
- **`<html lang>`**, le titre de l'onglet et `aria-label` suivent la langue.
- **Adresses** : les mêmes dans les deux langues (`#objet`, `#recettes`, `#usine/recherche`…,
  décision S16 Langues). Elles ne sont jamais montrées comme du texte.
- **Nombres et dates** : un seul module (`format.ts`) les écrit selon la langue, avec
  `Intl.NumberFormat` et `Intl.DateTimeFormat` (`1 234,5` en français, `1,234.5` en anglais). Les
  unités du jeu restent celles du jeu : MF/s, kMF/s, $, RP, RP/s, /min. Pour « case » (unité de
  place au sol), il faut le mot anglais du jeu : il est demandé dans le glossaire (Q28).
- **Glossaire** français → anglais : celui de la maquette (écran 5) est accepté (Q28). Au début de
  S30, on cherche sur le wiki les mots du jeu qui manquent (case, parcelle, noms des modes de
  construction), et on note la source de chacun. Ce qui reste douteux va dans `data/a-verifier.md`.
  **Fait en S30** (Q29, décision S30 Glossaire) : case → cell, parcelle → build area, outils Build /
  Wire / Pipe / Delete, pollution en %/h ; doutes TR-01 à TR-03 dans `a-verifier.md`. Le catalogue
  est `src/i18n/` ; les textes fixes d'`index.html` portent leur clé (`data-i18n`, `data-i18n-html`,
  `data-i18n-attr`).

### Ce qui se traduit, et où

| Origine | Exemple | Lot |
| --- | --- | --- |
| `index.html` (squelette, en-tête, formulaires, pied de page) | « Produire un objet », « Quantité » | S30 |
| `src/ui/*.ts` (toutes les vues) | « Tu peux régler : », « Module posé ✓ », la visite (`tour.ts`) | S31 |
| Messages du moteur (`src/engine`, `src/engine/build`) | « File de poteaux … : alimente-la par N lignes séparées » | S32 |
| Textes des données (notes, doutes, descriptions saisies) | note d'un port relevé, « Miraheze 15 ou Fandom 17,2 » | S32 |

- **Moteur** : il renverra un **code et des valeurs** (`{ code: "pole.overload", n: 3, … }`) au lieu
  d'une phrase, et c'est le site qui la traduit. Les phrases du moteur servent aussi au classement de
  l'ordre de pose (`phaseOf`, S26) : ce classement passera aux codes. Le calcul ne change pas : les
  empreintes de l'usine (méthode de S27 bis, 8 plans) sont identiques avant et après.
- **Données** : les noms du jeu (objets, machines, recherches) restent en anglais dans les deux
  langues, comme en jeu. Les notes en français ont une traduction dans `data/i18n/en.json`, rangée
  par fichier, identifiant et champ. Une note sans traduction s'affiche en français avec la marque
  « (FR) », et un test les compte.
- **Ce qui reste en français** : le code, les commentaires, les fichiers du dépôt (`PLAN-*.md`,
  `a-verifier.md`), les fichiers exportés (clés JSON inchangées) et les maquettes.
- **Test « rien d'oublié »** : en anglais, les mêmes vues que `vocabulaire.test.ts` (plans
  Crankshaft, Light Oil, Steel Plate, panneau de chaque bloc, fiches, arbre, Mon usine, Contribuer)
  ne contiennent ni lettre accentuée, ni mot français courant (une liste : « le », « la », « des »,
  « pour », « avec », « machines à »…). Les noms du jeu sont exclus.
- **Relecture** : l'utilisateur relit l'anglais (S37). Les joueurs signalent une erreur de
  traduction par une remarque de type « Traduction » (S35), qui part avec la page et le texte
  sélectionné.

## 3. La forme et l'accessibilité

Chaque point a un critère vérifiable. On contrôle tout sur les six pages, à 1 366 px et à 375 px, en
thème clair et en sombre, en français et en anglais.

| Point | Critère de réussite |
| --- | --- |
| Nom et mentions | Un seul nom partout : « Industrialist Production Planner » en anglais, « Planificateur Industrialist » en français. La mention « Non officiel / Unofficial » est à côté du nom, dans l'en-tête. Le pied de page tient en 3 lignes : « Outil de fan, non officiel, par Orangentleman », les crédits du wiki (CC BY-NC-SA 4.0, Miraheze, Fandom), et les liens « Remarque » et « Propositions ». |
| Aperçu Discord | `og:title`, `og:description` et `og:image` en anglais, avec `og:locale` en_US et l'alternative fr_FR. L'aperçu est vérifié en collant le lien dans le salon réservé. |
| Contrastes | Texte normal à 4,5:1 au moins et gros texte à 3:1, dans les deux thèmes. Le bouton principal et les ⚠ sont corrigés, et le SVG est contrôlé à l'œil. Un test garde la paire de couleurs de chaque jeton (`--accent` sur son fond…). |
| Cibles | Aucune cible de moins de 24 × 24 px à 375 px, sauf les liens dans une phrase (mesure par le DOM, comme dans ce lot). |
| Menu au téléphone | Les cinq entrées tiennent à 375 px, sans défilement, en français comme en anglais (libellés courts ou icônes). |
| Recettes au téléphone | La page fait moins de 3 000 px : liste par pages, ou « afficher plus ». |
| Clavier | Chaque page se fait au clavier : Tab dans un ordre logique, Échap ferme les fenêtres, et le focus revient au bouton qui les a ouvertes. Le schéma et l'usine se déplacent aux flèches et se zooment avec + et −. |
| Lecteur d'écran | La nouvelle réponse est annoncée (`aria-live="polite"` sur la phrase de réponse). Chaque fenêtre a un titre (`aria-labelledby`). Le schéma et l'usine ont un résumé texte et renvoient à la liste des machines, qui en est la version lisible (décision S16 Accessibilité). |
| Calcul long | Pendant le calcul de l'usine, on voit l'avancement, un bouton « Arrêter », et une phrase qui propose le calcul module par module, plus rapide. |
| Messages d'erreur | Aucun message technique à l'écran. Si le service des remarques ne répond pas, le site le dit en une phrase et garde le texte du joueur. |
| Restes de la revue | Un mot pour la pollution, à choisir avec l'utilisateur (P11). Le titre devient « Que veux-tu produire ? » si l'utilisateur le veut (P11). |

## 4. Ce qu'on montre aux visiteurs

- **Tout reste visible** (décision S16 Public). « Contribuer » se présente comme **« Aider à corriger
  le site »** : en tête de la page, une phrase dit à quoi servent les valeurs à vérifier et
  l'éditeur de bâtiments, et que les corrections partent vers l'auteur.
- Les **valeurs incertaines** gardent leur ⚠ sobre et cliquable (S28). Aucune n'est mise en avant
  sur la page d'arrivée.
- La page **Propositions** (publique) est dans le pied de page et dans la fenêtre « Remarque »,
  mais pas dans le menu principal.
- Le **tableau de bord** de l'utilisateur n'a aucun lien sur le site : on y entre par son adresse
  (`/tableau/`), avec un mot de passe.

## 5. Les remarques des joueurs (R15)

### Ce que voit un joueur

- Un bouton **« 💬 Remarque »** dans l'en-tête (à côté de « ? ») et un lien dans le pied de page.
- Une fenêtre qui demande :
  - le **type** : erreur de valeur, bogue, idée, traduction ;
  - le **texte**, 2 000 caractères au plus ;
  - un **pseudo Discord**, facultatif.

  La page, la langue, la version du site et le plan affiché (son résumé, pas la partie) partent
  avec, et c'est écrit sous le champ. Une case cachée sert de piège à robots.
- **« Envoyer ma correction »** dans Contribuer, dans le mode « ✎ Corriger » et dans l'éditeur de
  bâtiments (Q26.6). La correction part en pièce jointe d'une remarque de type « correction », avec
  le même contenu que l'export d'aujourd'hui. Elle reste aussi dans le navigateur, comme avant.
- **« Mes remarques »** : le site garde dans le navigateur les numéros des remarques envoyées, et
  montre la réponse de l'auteur quand il en a écrit une. Il n'y a pas de compte.
- La page **« Propositions »** (`#propositions`) montre les sujets publiés par l'auteur, avec leur
  état (proposé, prévu, fait, refusé), sa réponse, « N joueurs l'ont demandé » et un bouton
  **+1**, un par visiteur et par sujet.
- **Une étape « Remarques » dans la visite d'orientation** (`src/ui/tour.ts`), à la fin de
  l'essentiel (demande du 2026-10-20).

### Ce que voit l'utilisateur (tableau de bord)

- L'adresse `/tableau/`, une page à part du site, protégée par un mot de passe. Un visiteur ne la
  charge jamais.
- **Boîte de réception** : les remarques nouvelles d'abord, filtrées par type, par état et par
  langue, avec la page d'où elles viennent (un lien qui la rouvre).
- **Sujets** : on range une remarque dans un sujet, nouveau ou existant. Le sujet compte ses
  demandes et ses +1, et se trie par « le plus demandé ».
- **Répondre** : à la remarque (le joueur le voit dans « Mes remarques ») ou au sujet (visible sur
  Propositions s'il est publié).
- **Publier, ou non**, un sujet. Rien n'est public sans ce geste.
- **Corrections** : on voit leur contenu, on peut **télécharger le JSON** et l'intégrer par
  l'import qui existe déjà (`data/ports.json`, `overrides.json` : intégration à la main, comme
  aujourd'hui).
- Supprimer une remarque (abus) : définitif, après confirmation.
- **Discord** : chaque remarque nouvelle poste un message court dans le salon réservé du serveur
  de l'utilisateur (type, premières lignes, lien vers le tableau de bord), par un **webhook du salon**
  (Q28) : l'utilisateur le crée dans les réglages du salon et colle son adresse sur le Pi. Rien ne
  change au bot de MyPrism.

### Le service sur le Pi

- **`industrialist-remarques`** : un petit service **Node 24** (déjà installé sur le Pi), **sans
  dépendance**, avec `node:http`, `node:sqlite` et `node:crypto`. Il est écrit en TypeScript, lancé
  directement par Node, et ses fonctions sont testées par Vitest sur le PC.
- Il écoute sur `127.0.0.1:8091`. Le nginx de l'Industrialist (et seulement lui :
  `/etc/nginx/sites-available/industrialist`) passe `/api/` au service et sert `/tableau/`. Il faut
  recharger nginx une fois (`systemctl reload nginx`) : **demandé à l'utilisateur avant**.
- Il a son compte système, son unité systemd (`MemoryMax=64M`, droits réduits) et ses données dans
  `/var/lib/industrialist-remarques/` (une base SQLite). Une copie est faite chaque nuit dans le même
  dossier (7 gardées), et le tableau de bord peut tout exporter en JSON.
- **MyPrism n'est jamais touché** : ni `~/myprism`, ni `/etc/cloudflared`, ni les unités
  `myprism*` et `cloudflared-myprism`. Le tunnel `industrialist` sert déjà le site, et `/api/`
  passe par lui sans réglage nouveau. Un contrôle avant et après vérifie que les unités de MyPrism
  sont actives et que leurs fichiers n'ont pas changé.
- **Accès** :
  - publics : `POST /api/remarques`, `GET /api/remarques/<n°>` (réponse à une remarque, par son
    numéro secret), `GET /api/propositions`, `POST /api/propositions/<id>/plus1` ;
  - réservés : `/api/admin/…` (connexion, liste, sujets, réponse, publication, export).
- **Anti-abus** (Q26.5) :
  - 5 remarques par heure et par visiteur, et 2 000 caractères au plus ;
  - une case piège contre les robots ;
  - un seul +1 par visiteur et par sujet ;
  - rien de public sans l'accord de l'auteur ;
  - le visiteur est reconnu par l'adresse que donne Cloudflare (`CF-Connecting-IP`), jamais
    gardée en clair : seulement une empreinte salée, effacée au bout de 24 h.
- **Sécurité** :
  - un mot de passe chiffré avec `scrypt`, dans un fichier lisible seulement par le service ;
  - un cookie de session `HttpOnly`, `Secure`, `SameSite=Strict`, et un contrôle de l'en-tête
    `Origin` sur chaque écriture ;
  - les textes reçus sont affichés comme du texte, jamais comme du HTML ;
  - le service garde le temps de réponse et le nombre de requêtes, sans aucun contenu personnel.
- **Données personnelles** : seulement le pseudo, s'il est donné. Une phrase sous le formulaire le
  dit, et dit combien de temps les remarques sont gardées (jusqu'à leur suppression par l'auteur).
- **En local** : `npm run remarques` lance le même service sur le PC (sur une base de test), et le
  serveur de développement lui passe `/api/` (réglage `server.proxy` de Vite, sans dépendance).

## 6. Les lots

Ils sont placés au § 2 du plan d'action, après S16 et avant S17. Chaque lot suit le § 0 : questions
au début, maquette si l'interface change, parcours réel, tests, déploiement. **Le lien n'est posté
sur le Discord qu'après S37** (décision S16 Publication : le tableau de bord et la page Propositions
doivent être finis).

| Lot | Contenu | Taille | Dépend de |
| --- | --- | --- | --- |
| S30 | Traduction (1/3) : glossaire validé, catalogue et `t()`, bouton FR / EN, langue du navigateur, nombres et dates selon la langue ; `index.html`, en-tête, menu, pied de page, Planifier traduits | moyenne | maquette S16 |
| S31 | Traduction (2/3) : toutes les vues (`src/ui`), visite comprise ; test « rien d'oublié » | grosse | S30 |
| S32 | Traduction (3/3) : messages du moteur en codes, notes des données (`data/i18n/en.json`) ; empreintes de l'usine identiques | grosse | S31 |
| S33 | Forme publique : nom, mentions, pied de page, aperçu Discord, contrastes, cibles, menu et Recettes au téléphone, clavier, lecteur d'écran, calcul long, restes de la revue | moyenne | S30 |
| S34 | Remarques (1/3) : le service (code, tests, `npm run remarques`), puis sa mise en place sur le Pi après accord (nginx rechargé, MyPrism contrôlé) | moyenne | maquette S16 |
| S35 | Remarques (2/3) : côté joueur (bouton, fenêtre, « Envoyer ma correction », « Mes remarques », étape de la visite, message Discord) | moyenne | S30, S34 |
| S36 | Remarques (3/3) : tableau de bord de l'utilisateur et page publique Propositions (+1) | moyenne à grosse | S35 |
| S37 | Répétition générale : relecture de l'anglais par l'utilisateur, parcours A à E en anglais sur une partie vide (ordinateur et téléphone), remarque envoyée de bout en bout, corrections ; puis feu vert pour poster le lien | moyenne | S30 à S36 |

Pourquoi cet ordre :
- **Le socle de la traduction d'abord (S30)** : les textes ajoutés ensuite (forme, remarques)
  entrent directement dans les deux catalogues, et on ne traduit rien deux fois.
- **S31 avant S32** : les vues appellent `t()` avant que le moteur passe aux codes, et chaque lot
  garde des tests verts.
- **S33 peut suivre S30** : la forme ne dépend pas de la traduction complète, mais ses textes
  nouveaux (nom, pied de page) passent par le catalogue.
- **S34 ne touche que des fichiers nouveaux** (`server/`, scripts du Pi). Il peut se faire en même
  temps que S31 à S33 si l'utilisateur le veut, dans sa propre session.
- **S37 en dernier** : on montre le site au Discord quand tout est fini, relu et essayé de bout en
  bout.
- **S17 (bac à sable) après S37** : c'est une nouvelle fonction, à penser sur le site public.

### Critères de fin de chaque lot

- **S30** : le bouton FR / EN change l'en-tête, le menu, le pied de page et Planifier sans recharger
  la page, et le choix est gardé. Un navigateur en anglais arrive en anglais. Une clé absente de
  `en.ts` fait échouer `npm run typecheck`. Tests verts.
- **S31** : le test « rien d'oublié » passe sur toutes les vues de `vocabulaire.test.ts`, en
  anglais, et la visite est jouée en entier en anglais. Tests verts. **Fait le 2026-10-25** (catalogues par écran dans
  `src/i18n/vues/`, test `src/ui/traduction.test.ts`, bilan au § 6 du plan d'action).
- **S32** : aucun message du moteur n'est écrit en dur. Les empreintes des 8 plans sont identiques
  (S27 bis) et l'ordre de pose est rangé comme avant (test de S26). Chaque note des données
  affichée a sa traduction, sinon la marque « (FR) » est comptée par un test. Tests verts.
- **S33** : tous les critères du § 3 sont mesurés sur les six pages, dans les deux tailles, les deux
  thèmes et les deux langues, et notés dans le bilan. L'aperçu est vu dans le salon réservé. Tests
  verts.
- **S34** : en local, une remarque envoyée est relue par l'accès réservé, la 6ᵉ dans l'heure est
  refusée, et l'empreinte d'IP est effacée au bout de 24 h (test, horloge simulée). Sur le Pi, la
  même chose passe par `https://industrialist.myprisme.fr/api/`, et les unités de MyPrism sont
  actives et inchangées avant et après.
- **S35** : depuis le site en ligne, une remarque de chaque type et une correction arrivent, avec
  leur page. Le message apparaît dans le salon Discord. La réponse se lit dans « Mes remarques ». Si
  le service est arrêté, le site le dit et garde le texte. Tests verts.
- **S36** : depuis le tableau de bord, on range 3 remarques dans un sujet, on répond, on publie ;
  le sujet apparaît sur Propositions avec « 3 joueurs l'ont demandé ». Un +1 compte une fois par
  visiteur. Sans mot de passe, `/api/admin/` refuse tout. Tests verts.
- **S37** : les remarques de l'utilisateur sur l'anglais sont corrigées. Les parcours A à E passent
  en anglais sans texte français ni identifiant. Une remarque fait le tour complet : envoi, Discord,
  sujet, réponse, publication. L'utilisateur donne le feu vert pour poster le lien.

## 7. Risques

- **Taille de la traduction** : environ 2 300 textes, plus les notes des données. S31 et S32 sont
  gros. Si un lot approche de la limite de la session, on s'arrête à un point propre (§ 0, règle 7) :
  vue par vue, chaque morceau est utilisable.
- **Phrases du moteur** : le classement de l'ordre de pose (S26) lit leur forme. Le passage aux
  codes doit garder le test de S26 vert.
- **Mots du jeu en anglais** : sans le bon mot du jeu, le texte sonne faux pour les joueurs. Le
  glossaire est validé avant S30, et les doutes vont dans `data/a-verifier.md`.
- **Le Pi** (1 Go de RAM, environ 630 Mo disponibles le 2026-10-24) : le service est limité à 64 Mo.
  Un abus massif est arrêté par la limite par visiteur. Cloudflare protège déjà le tunnel.
- **Spam après la publication** : la modération est manuelle, donc rien n'est public sans l'auteur.
  Si le volume devient trop grand, on peut fermer les envois d'un réglage du service
  (`REMARQUES_FERMEES=1`), sans toucher au site.
