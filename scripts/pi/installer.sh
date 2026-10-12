#!/usr/bin/env bash
# Installe l'hébergement du calculateur sur le Raspberry Pi, à côté de MyPrism, sans y toucher.
# Relançable sans risque (idempotent).
#
#   sudo bash installer.sh <ID-du-tunnel> [fichier-identifiants.json]
#
# - nginx sert /srv/industrialist/www sur le port 8090 (réseau local + tunnel) ;
# - un tunnel Cloudflare séparé (service cloudflared-industrialist, utilisateur dédié)
#   publie https://industrialist.myprisme.fr ;
# - rien n'est modifié dans ~/myprism, /etc/cloudflared ni les unités myprism*.
set -euo pipefail

NOM=industrialist
DOMAINE=industrialist.myprisme.fr
PORT=8090
METRIQUES=127.0.0.1:20242 # MyPrism utilise déjà 20241
RACINE=/srv/$NOM
CONF_TUNNEL=/etc/cloudflared-$NOM

[[ $EUID -eq 0 ]] || { echo "À lancer avec sudo." >&2; exit 1; }
TUNNEL_ID=${1:-}
IDENTIFIANTS=${2:-}
[[ $TUNNEL_ID =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] || { echo "Usage : sudo bash installer.sh <ID-du-tunnel> [identifiants.json]" >&2; exit 1; }
CLOUDFLARED=$(command -v cloudflared) || { echo "cloudflared introuvable." >&2; exit 1; }

echo "== nginx"
if ! dpkg -s nginx >/dev/null 2>&1; then
  # Empêche nginx de démarrer pendant l'installation avec son site par défaut (port 80).
  printf '#!/bin/sh\nexit 101\n' >/usr/sbin/policy-rc.d
  chmod 755 /usr/sbin/policy-rc.d
  trap 'rm -f /usr/sbin/policy-rc.d' EXIT
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nginx
  rm -f /usr/sbin/policy-rc.d
  trap - EXIT
fi
rm -f /etc/nginx/sites-enabled/default
# Un seul processus de travail suffit largement (Pi à 1 Go de mémoire).
sed -i -E 's/^(\s*worker_processes)\s+[^;]+;/\1 1;/' /etc/nginx/nginx.conf

install -d -m 755 /etc/nginx/snippets
cat >/etc/nginx/snippets/$NOM-entetes.conf <<'EOF'
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "SAMEORIGIN" always;
EOF

cat >/etc/nginx/sites-available/$NOM <<EOF
# Calculateur de production Industrialist (site statique). Installé par scripts/pi/installer.sh.
server {
    listen $PORT;          # réseau local (http://myprism.local:$PORT) et tunnel (127.0.0.1)
    listen [::]:$PORT;
    server_name _;
    server_tokens off;

    root $RACINE/www;
    index index.html;

    access_log off;        # ménage la carte microSD
    error_log /var/log/nginx/$NOM-erreurs.log warn;

    gzip on;
    gzip_min_length 1024;
    gzip_types text/css application/javascript application/json image/svg+xml;

    # Fichiers du build : leur nom change à chaque version, on peut les garder longtemps.
    location /assets/ {
        include snippets/$NOM-entetes.conf;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files \$uri =404;
    }
    location = /site.webmanifest {
        types { }
        default_type application/manifest+json;
        include snippets/$NOM-entetes.conf;
        add_header Cache-Control "no-cache";
    }
    location / {
        include snippets/$NOM-entetes.conf;
        add_header Cache-Control "no-cache";
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
ln -sfn /etc/nginx/sites-available/$NOM /etc/nginx/sites-enabled/$NOM

echo "== dossier du site"
install -d -m 755 "$RACINE" "$RACINE/versions"
if [[ ! -e $RACINE/www ]]; then
  # Page d'attente tant qu'aucune version n'a été publiée.
  install -d -m 755 "$RACINE/versions/attente"
  echo '<!doctype html><meta charset="utf-8"><title>Calculateur de production</title><p>Installation en cours…</p>' >"$RACINE/versions/attente/index.html"
  ln -sfn "$RACINE/versions/attente" "$RACINE/www"
fi
install -m 755 "$(dirname "$0")/publier.sh" /usr/local/sbin/$NOM-publier

nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "== utilisateur dédié au tunnel"
id -u $NOM >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin $NOM

echo "== tunnel Cloudflare séparé"
install -d -m 750 -o root -g $NOM "$CONF_TUNNEL"
if [[ -n $IDENTIFIANTS ]]; then
  install -m 640 -o root -g $NOM "$IDENTIFIANTS" "$CONF_TUNNEL/$TUNNEL_ID.json"
fi
[[ -f $CONF_TUNNEL/$TUNNEL_ID.json ]] || { echo "Identifiants du tunnel absents : $CONF_TUNNEL/$TUNNEL_ID.json" >&2; exit 1; }
cat >"$CONF_TUNNEL/config.yml" <<EOF
# Tunnel du calculateur Industrialist (séparé de celui de MyPrism). Installé par scripts/pi/installer.sh.
tunnel: $TUNNEL_ID
credentials-file: $CONF_TUNNEL/$TUNNEL_ID.json
metrics: $METRIQUES
ingress:
  - hostname: $DOMAINE
    service: http://127.0.0.1:$PORT
  - service: http_status:404
EOF
chown root:$NOM "$CONF_TUNNEL/config.yml"
chmod 640 "$CONF_TUNNEL/config.yml"

cat >/etc/systemd/system/cloudflared-$NOM.service <<EOF
[Unit]
Description=Tunnel Cloudflare du calculateur Industrialist ($DOMAINE)
After=network-online.target nginx.service
Wants=network-online.target

[Service]
User=$NOM
Group=$NOM
ExecStart=$CLOUDFLARED --no-autoupdate --config $CONF_TUNNEL/config.yml tunnel run
Restart=always
RestartSec=5
Nice=5
MemoryMax=150M
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable cloudflared-$NOM.service
systemctl restart cloudflared-$NOM.service

echo "== terminé"
systemctl --no-pager --lines=0 status nginx cloudflared-$NOM | grep -E '●|Active:'
