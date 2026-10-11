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

**Ressources** (mesurées à l'installation) : environ 51 Mo de mémoire au total (tunnel 40 Mo,
nginx 11 Mo) sur les 990 Mo du Pi, et un processeur au repos hors des visites. Le site pèse
moins de 1 Mo par version.

**Sauvegardes** : il n'y a rien à sauvegarder sur le Pi. Le code est dans git sur le PC, et la
progression comme les corrections de chacun restent dans son navigateur.

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
