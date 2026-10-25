#!/usr/bin/env bash
# Installe (ou met à jour) le service des remarques sur le Pi, à côté de MyPrism, sans y toucher.
# Relançable sans risque. Ne démarre, ne redémarre et ne recharge RIEN : les commandes à lancer, après accord,
# sont affichées à la fin.
#
#   sudo bash remarques.sh <dossier-contenant-server/>
#
# - compte système industrialist-remarques, sans connexion possible ;
# - code en lecture seule dans /opt/industrialist-remarques, données dans /var/lib/industrialist-remarques ;
# - unité systemd industrialist-remarques (MemoryMax=64M, droits réduits), sur 127.0.0.1:8091 ;
# - nginx de l'Industrialist (et seulement lui) : /api/ passé au service ;
# - /usr/local/sbin/industrialist-remarques-mot-de-passe : l'utilisateur y tape lui-même le mot de passe.
set -euo pipefail

NOM=industrialist-remarques
PORT=8091
CODE=/opt/$NOM
DONNEES=/var/lib/$NOM
REGLAGES=/etc/$NOM
SITE=/etc/nginx/sites-available/industrialist
SNIPPET=/etc/nginx/snippets/industrialist-api.conf

[[ $EUID -eq 0 ]] || { echo "À lancer avec sudo." >&2; exit 1; }
SOURCE=${1:-}
[[ -f $SOURCE/server/remarques.ts ]] || { echo "Usage : sudo bash remarques.sh <dossier contenant server/remarques.ts>" >&2; exit 1; }
NODE=$(command -v node) || { echo "node introuvable." >&2; exit 1; }
[[ $("$NODE" -p 'process.versions.node.split(".")[0]') -ge 24 ]] || { echo "Node 24 ou plus est nécessaire." >&2; exit 1; }
[[ -f $SITE ]] || { echo "$SITE absent : lancer d'abord installer.sh." >&2; exit 1; }

echo "== compte du service"
id -u $NOM >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin $NOM

echo "== code ($CODE)"
install -d -m 755 -o root -g root "$CODE"
for f in "$SOURCE"/server/*.ts; do
  [[ $f == *.test.ts ]] && continue
  install -m 644 -o root -g root "$f" "$CODE/"
done

echo "== réglages ($REGLAGES)"
install -d -m 750 -o root -g $NOM "$REGLAGES"
if [[ ! -f $REGLAGES/reglages.env ]]; then
  cat >"$REGLAGES/reglages.env" <<EOF
# Réglages du service des remarques. Après une modification : sudo systemctl restart $NOM
REMARQUES_ORIGINES=https://industrialist.myprisme.fr,http://myprism.local:8090
# REMARQUES_FERMEES=1
EOF
  chown root:$NOM "$REGLAGES/reglages.env"
  chmod 640 "$REGLAGES/reglages.env"
fi

cat >/usr/local/sbin/$NOM-mot-de-passe <<EOF
#!/usr/bin/env bash
# Choisit le mot de passe du tableau de bord (tapé deux fois, jamais affiché, gardé haché par scrypt).
# Pris en compte à la connexion suivante, sans redémarrage.
set -euo pipefail
[[ \$EUID -eq 0 ]] || { echo "À lancer avec sudo." >&2; exit 1; }
ecrire() {
  umask 027
  printf '%s\n' "\$1" >$REGLAGES/mot-de-passe.tmp
  chown root:$NOM $REGLAGES/mot-de-passe.tmp
  mv -f $REGLAGES/mot-de-passe.tmp $REGLAGES/mot-de-passe
  echo "Mot de passe enregistré (haché)."
}
# --ligne : la ligne déjà hachée arrive sur l'entrée standard (scripts/pi/mot-de-passe.ps1, haché sur le PC).
if [[ \${1:-} == --ligne ]]; then
  read -r ligne; ligne=\${ligne%\$'\r'}
  [[ \$ligne =~ ^scrypt\\\$[0-9]+\\\$[0-9]+\\\$[0-9]+\\\$[A-Za-z0-9_-]+\\\$[A-Za-z0-9_-]+\$ ]] || { echo "Ligne hachée invalide : rien n'a changé." >&2; exit 1; }
  ecrire "\$ligne"
  exit 0
fi
# Une ligne vide est ignorée : un mot de passe collé arrive souvent avec son retour à la ligne, suivi d'Entrée.
# Les marques d'un collage (\e[200~ … \e[201~) sont retirées.
lire() {
  local v=""
  while [[ -z \$v ]]; do
    read -rsp "\$1" v; echo >&2
    v=\${v//\$'\e[200~'/}; v=\${v//\$'\e[201~'/}; v=\${v%\$'\r'}
  done
  printf '%s' "\$v"
}
un=\$(lire "Mot de passe du tableau de bord (10 caractères au moins), puis Entrée : ")
deux=\$(lire "Encore une fois, puis Entrée : ")
[[ "\$un" == "\$deux" ]] || { echo "Les deux ne sont pas identiques : rien n'a changé." >&2; exit 1; }
ligne=\$(printf '%s' "\$un" | $NODE --disable-warning=ExperimentalWarning $CODE/hacher.ts)
unset un deux
ecrire "\$ligne"
EOF
chmod 750 /usr/local/sbin/$NOM-mot-de-passe

# S35 : l'adresse du webhook du salon Discord réservé, collée par l'utilisateur sur le PC (scripts/pi/discord.ps1)
# et reçue ici sur l'entrée standard (jamais en argument). Relue par le service à chaque remarque : pas de redémarrage.
cat >/usr/local/sbin/$NOM-discord <<EOF
#!/usr/bin/env bash
# Range l'adresse du webhook Discord (une ligne sur l'entrée standard) ; --retirer la supprime.
set -euo pipefail
[[ \$EUID -eq 0 ]] || { echo "À lancer avec sudo." >&2; exit 1; }
if [[ \${1:-} == --retirer ]]; then rm -f $REGLAGES/discord; echo "Webhook retiré : plus de message Discord."; exit 0; fi
read -r ligne; ligne=\${ligne%\$'\r'}
[[ \$ligne =~ ^https://(canary\.|ptb\.)?discord(app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+\$ ]] || { echo "Ce n'est pas une adresse de webhook Discord : rien n'a changé." >&2; exit 1; }
umask 027
printf '%s\n' "\$ligne" >$REGLAGES/discord.tmp
chown root:$NOM $REGLAGES/discord.tmp
mv -f $REGLAGES/discord.tmp $REGLAGES/discord
echo "Webhook Discord enregistré."
EOF
chmod 750 /usr/local/sbin/$NOM-discord

# S36 : la clé DeepL de l'auteur (traduction automatique du tableau de bord), collée sur le PC
# (scripts/pi/traducteur.ps1) et reçue ici sur l'entrée standard. Relue à chaque traduction : pas de redémarrage.
cat >/usr/local/sbin/$NOM-traducteur <<EOF
#!/usr/bin/env bash
# Range la clé DeepL (une ligne sur l'entrée standard) ; --retirer la supprime.
set -euo pipefail
[[ \$EUID -eq 0 ]] || { echo "À lancer avec sudo." >&2; exit 1; }
if [[ \${1:-} == --retirer ]]; then rm -f $REGLAGES/deepl; echo "Clé retirée : plus de traduction automatique."; exit 0; fi
read -r ligne; ligne=\${ligne%\$'\r'}
[[ \$ligne =~ ^[A-Za-z0-9-]{20,80}(:fx)?\$ ]] || { echo "Ce n'est pas une clé DeepL : rien n'a changé." >&2; exit 1; }
umask 027
printf '%s\n' "\$ligne" >$REGLAGES/deepl.tmp
chown root:$NOM $REGLAGES/deepl.tmp
mv -f $REGLAGES/deepl.tmp $REGLAGES/deepl
echo "Clé DeepL enregistrée."
EOF
chmod 750 /usr/local/sbin/$NOM-traducteur

echo "== unité systemd"
cat >/etc/systemd/system/$NOM.service <<EOF
[Unit]
Description=Service des remarques du calculateur Industrialist (127.0.0.1:$PORT)
After=network.target

[Service]
User=$NOM
Group=$NOM
Environment=REMARQUES_DONNEES=$DONNEES
Environment=REMARQUES_MOT_DE_PASSE=$REGLAGES/mot-de-passe
Environment=REMARQUES_PORT=$PORT
Environment=REMARQUES_DISCORD=$REGLAGES/discord
Environment=REMARQUES_DEEPL=$REGLAGES/deepl
EnvironmentFile=-$REGLAGES/reglages.env
ExecStart=$NODE --disable-warning=ExperimentalWarning --max-old-space-size=32 $CODE/remarques.ts
StateDirectory=$NOM
StateDirectoryMode=0700
Restart=on-failure
RestartSec=5
Nice=5
MemoryMax=64M
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
RestrictSUIDSGID=yes
RestrictNamespaces=yes
RestrictRealtime=yes
LockPersonality=yes
CapabilityBoundingSet=
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
SystemCallArchitectures=native
UMask=0077

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable $NOM.service

echo "== nginx de l'Industrialist : /api/"
cat >"$SNIPPET" <<EOF
# Service des remarques (scripts/pi/remarques.sh) : /api/ passé à 127.0.0.1:$PORT.
location /api/ {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header Connection "";
    client_max_body_size 300k;
    proxy_read_timeout 15s;
}
EOF
if ! grep -q 'industrialist-api' "$SITE"; then
  cp -p "$SITE" "$SITE.avant-remarques"
  sed -i 's|^    location / {|    include snippets/industrialist-api*.conf;  # /api/ (service des remarques)\n    location / {|' "$SITE"
fi
grep -q 'industrialist-api' "$SITE" || { echo "Impossible d'ajouter /api/ à $SITE." >&2; exit 1; }
nginx -t

echo "== terminé (rien n'a été démarré ni rechargé)"
cat <<EOF
À lancer après accord :
  sudo $NOM-mot-de-passe              # l'utilisateur tape lui-même le mot de passe
  sudo systemctl restart $NOM         # (re)démarre le service
  sudo systemctl reload nginx         # une seule fois, pour /api/
EOF
