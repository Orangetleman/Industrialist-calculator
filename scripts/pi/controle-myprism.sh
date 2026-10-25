#!/usr/bin/env bash
# Photographie de MyPrism, à lancer avant et après une intervention sur le Pi, puis à comparer (diff) :
# état et processus de ses unités (un redémarrage changerait le PID et l'heure de démarrage), empreintes de ses
# fichiers de configuration et de ses unités, et du code de ~/myprism (hors base de données et journaux).
# Ne modifie rien.
#
#   bash controle-myprism.sh > avant.txt   …   bash controle-myprism.sh > apres.txt && diff avant.txt apres.txt
set -uo pipefail
MAISON=/home/myprism/myprism

for u in myprism.service cloudflared-myprism.service myprism-sauvegarde.timer; do
  systemctl show "$u" -p Id -p ActiveState -p SubState -p MainPID -p ActiveEnterTimestamp | paste -sd ' '
done
sudo find /etc/cloudflared /etc/systemd/system -maxdepth 1 -type f \( -path '/etc/cloudflared/*' -o -name 'myprism*' -o -name 'cloudflared-myprism*' \) -exec sha256sum {} + | sort -k2
echo "code de ~/myprism : $(find "$MAISON" -type f -not -path '*/node_modules/*' -not -path '*/.git/*' \
  -not -name '*.db*' -not -name '*.sqlite*' -not -name '*.log' -printf '%P %s %T@\n' | sort | sha256sum | cut -c1-16)"
