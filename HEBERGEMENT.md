# Hébergement sur le Raspberry Pi

Le calculateur est un **site statique** (HTML, CSS, JS issus de `npm run build`) : rien ne
s'exécute côté serveur. Il est hébergé sur le Raspberry Pi de MyPrism, **à côté** de MyPrism et
sans rien partager avec lui. Installé le 2026-10-12.

| Adresse | Pour qui |
| --- | --- |
| https://industrialist.myprisme.fr | partout (public) |
| http://myprism.local:8090 | réseau local seulement (plus direct) |

La progression est gardée **par adresse** dans le navigateur : pour passer de l'une à l'autre,
onglet Recherche → « Exporter ma progression », puis « Importer… » sur l'autre adresse.

## Mettre à jour le site

Depuis le PC, dans le dossier du projet :

```bash
npm run deploy
```

C'est un raccourci vers `scripts/pi/deployer.ps1`, lancé avec une autorisation d'exécution valable
pour ce seul lancement : Windows bloque par défaut les scripts PowerShell, et rien n'est modifié
dans la configuration du PC. Pour lancer le script directement, il faut soit
`powershell -ExecutionPolicy Bypass -File .\scripts\pi\deployer.ps1`, soit avoir autorisé les
scripts locaux (`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`).

Le script lance les tests et le build, envoie `dist/`, puis bascule le site d'un coup sur la
nouvelle version. Aucun service n'est redémarré, et MyPrism n'est pas concerné. Les 5 dernières
versions sont gardées sur le Pi.

```bash
npm run deploy:retour
```

Revient à la version précédente.

```bash
ssh myprism@myprism.local sudo industrialist-publier --liste
```

Liste les versions présentes et indique celle en ligne.

## Ce qui est installé sur le Pi

| Élément | Détail |
| --- | --- |
| `nginx` (paquet Debian) | Sert `/srv/industrialist/www` sur le **port 8090** (toutes les interfaces : réseau local + tunnel). Configuration : `/etc/nginx/sites-available/industrialist`. Un seul processus de travail ; journal des accès coupé pour ménager la carte microSD ; erreurs dans `/var/log/nginx/industrialist-erreurs.log`. Le site par défaut de nginx (port 80) est désactivé. |
| `cloudflared-industrialist.service` | Tunnel Cloudflare **séparé** de celui de MyPrism : tunnel `industrialist`, configuration `/etc/cloudflared-industrialist/config.yml`, identifiants `…/<id>.json` (lisibles seulement par root et l'utilisateur `industrialist`). Métriques sur `127.0.0.1:20242` (MyPrism utilise 20241). Tourne sous l'utilisateur système `industrialist`, sans connexion possible, avec un service systemd verrouillé (`ProtectSystem`, `ProtectHome`, `MemoryMax=150M`). |
| `/srv/industrialist/` | `versions/<date>/` (les builds) et `www` (lien vers la version en ligne), appartenant à root, en lecture seule pour nginx. |
| `/usr/local/sbin/industrialist-publier` | Copie de `scripts/pi/publier.sh` : publication, retour en arrière, liste des versions. |

Rien n'a été modifié dans `~/myprism`, `/etc/cloudflared` ni dans les unités `myprism*`.

### Le service des remarques (S34, installé le 2026-10-25)

| Élément | Détail |
| --- | --- |
| `industrialist-remarques.service` | Node 24, sans dépendance (`server/*.ts`, lancé directement par Node), sur `127.0.0.1:8091`. Compte système `industrialist-remarques` sans connexion possible ; unité verrouillée (`ProtectSystem=strict`, `ProtectHome`, `CapabilityBoundingSet=` vide…), `MemoryMax=64M` et tas de Node plafonné à 32 Mo. |
| `/opt/industrialist-remarques/` | Le code (root, lecture seule). |
| `/var/lib/industrialist-remarques/` | La base `remarques.db` et une copie par nuit (`copie-AAAA-MM-JJ.db`, 7 gardées, sans empreinte d'IP). Dossier en 700, au compte du service. |
| `/etc/industrialist-remarques/` | `reglages.env` (origines admises, `REMARQUES_FERMEES=1` pour fermer les envois) et `mot-de-passe` (haché par scrypt, lisible seulement par root et le service). |
| nginx | `/etc/nginx/snippets/industrialist-api.conf` (`/api/` → 127.0.0.1:8091), inclus par le site de l'Industrialist seulement. L'ancienne version du site est gardée dans `industrialist.avant-remarques`. |

**Contrôle de la mémoire** : le noyau des Raspberry Pi le désactive par défaut (`cgroup_disable=memory`), et
les `MemoryMax` restaient alors sans effet. Le 2026-10-25, avec l'accord de l'utilisateur, `cgroup_enable=memory`
a été ajouté à la fin de `/boot/firmware/cmdline.txt` (ancienne version : `cmdline.txt.avant-memoire`), puis le Pi
a été redémarré. Les limites sont maintenant appliquées. Les unités de MyPrism n'en ont aucune, donc rien ne change
pour elles. Mesuré après le redémarrage : remarques 63 Mo sur 64 (30 Mo de mémoire propre, 30 Mo de fichiers en
cache que le noyau reprend au besoin ; aucun arrêt pour manque de mémoire, réponses en 2 ms), tunnel de
l'Industrialist 43 Mo sur 150. Si `memory.events` du service montrait un jour des `oom_kill`, il faudrait relever
`MemoryMax` (par exemple à 96M).

Mettre à jour le service (code, unité, nginx), **sans rien redémarrer ni recharger** :

```bash
npm run deploy:remarques
```

Puis, sur le Pi, après accord : `sudo systemctl restart industrialist-remarques` (et `sudo systemctl reload nginx`
si le fichier de nginx a changé).

Choisir le mot de passe du tableau de bord : il se tape sur le PC (une `*` par caractère) et y est haché ; seule
la ligne hachée part vers le Pi. Il est pris en compte sans redémarrage.

```bash
npm run remarques:mot-de-passe
```

**Message Discord (S35)** : chaque remarque gardée poste un message court dans le salon réservé de l'utilisateur,
par un **webhook du salon** (le bot de MyPrism n'est pas touché). L'utilisateur crée le webhook (Modifier le salon ›
Intégrations › Webhooks › Nouveau webhook, « Copier l'URL du webhook »), puis le colle lui-même, masqué, sur le PC ;
l'adresse part vers le Pi par l'entrée standard de ssh et est rangée dans `/etc/industrialist-remarques/discord`
(root et le service seulement). Le service la relit à chaque remarque : pas de redémarrage. Le message ne mentionne
personne, coupe le texte à 300 caractères, et un Discord injoignable n'empêche jamais l'envoi.

```bash
npm run remarques:discord
```

(`npm run remarques:discord -- -Retirer` supprime le webhook : plus de message.)

Relire les dernières remarques en attendant le tableau de bord (S36) :

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pi/relire-remarques.ps1
```

Contrôler MyPrism avant et après une intervention : `bash controle-myprism.sh > avant.txt`, puis
`diff avant.txt apres.txt` (état et PID des unités, empreintes de leurs fichiers, code de `~/myprism`).

**En local** : `npm run remarques` lance le même service sur une base de test (`.remarques-local/`, non suivi),
avec les origines du serveur de développement. `npm run dev` lui passe `/api/`. Le mot de passe d'essai local est
`essai-local` (créé haché à la première fois ; il ne sert qu'à cette base de test).

**Ressources** (mesurées à l'installation) : environ 51 Mo de mémoire au total (tunnel 40 Mo,
nginx 11 Mo) sur les 990 Mo du Pi, et un processeur au repos hors des visites. Le site pèse
moins de 1 Mo par version.

**Sauvegardes** : le site n'a rien à sauvegarder sur le Pi. Le code est dans git sur le PC, et la
progression comme les corrections de chacun restent dans son navigateur. Seules les remarques des joueurs
vivent sur le Pi (`/var/lib/industrialist-remarques/`, avec ses 7 copies de la nuit). Le tableau de bord pourra
tout exporter en JSON (S36).

**Mises à jour de sécurité** : nginx est un paquet Debian, mis à jour par `unattended-upgrades`
comme le reste du système.

## Réinstaller (Pi neuf ou carte refaite)

1. Sur le PC, le tunnel existe déjà : son identifiant est dans `cloudflared tunnel list` (nom
   `industrialist`) et ses identifiants dans `%USERPROFILE%\.cloudflared\<id>.json`.
2. Puis :

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\pi\deployer.ps1 -Installer -TunnelId <id>
```

`scripts/pi/installer.sh` peut être relancé sans risque.

### Recréer le tunnel de zéro

Attention : le `config.yml` du PC désigne le tunnel de MyPrism, et `cloudflared` s'en sert même
quand on nomme un autre tunnel. Pour l'entrée DNS, il faut donc passer un fichier de
configuration vide et l'**identifiant** du tunnel :

```powershell
cloudflared tunnel create industrialist
```

```powershell
Set-Content "$env:TEMP\vide.yml" "# vide"; cloudflared --config "$env:TEMP\vide.yml" tunnel route dns --overwrite-dns <id> industrialist.myprisme.fr
```

## Désinstaller

```bash
sudo systemctl disable --now cloudflared-industrialist nginx
```

```bash
sudo rm -rf /etc/cloudflared-industrialist /srv/industrialist /etc/systemd/system/cloudflared-industrialist.service /usr/local/sbin/industrialist-publier /etc/nginx/sites-enabled/industrialist && sudo userdel industrialist
```

Puis, sur le PC : `cloudflared tunnel delete industrialist` et supprimer l'entrée DNS
`industrialist` dans le tableau de bord Cloudflare.
