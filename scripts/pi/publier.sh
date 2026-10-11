#!/usr/bin/env bash
# Publie une version du site sur le Pi (installé en /usr/local/sbin/industrialist-publier).
#
#   sudo industrialist-publier <dossier-du-build>   met en ligne une nouvelle version
#   sudo industrialist-publier --retour             revient à la version précédente
#   sudo industrialist-publier --liste              liste les versions
#
# La bascule est atomique (lien symbolique) : aucun service n'est redémarré.
set -euo pipefail
RACINE=/srv/industrialist
GARDER=5
[[ $EUID -eq 0 ]] || { echo "À lancer avec sudo." >&2; exit 1; }

versions() { find "$RACINE/versions" -mindepth 1 -maxdepth 1 -type d -name '20*' -printf '%f\n' | sort; }
basculer() {
  ln -sfn "$RACINE/versions/$1" "$RACINE/www.tmp"
  mv -Tf "$RACINE/www.tmp" "$RACINE/www"
  echo "En ligne : $1"
}
verifier() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8090/)
  [[ $code == 200 ]] || { echo "Le site ne répond pas correctement (HTTP $code)." >&2; return 1; }
  echo "Vérification locale : HTTP 200"
}

case "${1:-}" in
  --liste)
    actuelle=$(basename "$(readlink -f "$RACINE/www")")
    versions | while read -r v; do [[ $v == "$actuelle" ]] && echo "* $v (en ligne)" || echo "  $v"; done
    ;;
  --retour)
    actuelle=$(basename "$(readlink -f "$RACINE/www")")
    precedente=$(versions | grep -B1 -x "$actuelle" | head -n1)
    [[ -n $precedente && $precedente != "$actuelle" ]] || { echo "Pas de version précédente." >&2; exit 1; }
    basculer "$precedente"
    verifier
    ;;
  "" | -*)
    echo "Usage : sudo industrialist-publier <dossier-du-build> | --retour | --liste" >&2
    exit 1
    ;;
  *)
    source_dir=$1
    [[ -f $source_dir/index.html ]] || { echo "Pas d'index.html dans $source_dir : build incomplet ?" >&2; exit 1; }
    version=$(date +%Y%m%d-%H%M%S)
    cible="$RACINE/versions/$version"
    cp -r "$source_dir" "$cible"
    chown -R root:root "$cible"
    find "$cible" -type d -exec chmod 755 {} + -o -type f -exec chmod 644 {} +
    basculer "$version"
    if ! verifier; then
      echo "Échec : retour à la version précédente." >&2
      precedente=$(versions | grep -B1 -x "$version" | head -n1)
      [[ -n $precedente && $precedente != "$version" ]] && basculer "$precedente"
      exit 1
    fi
    # Ménage : on garde les $GARDER dernières versions (et la page d'attente disparaît).
    versions | head -n -"$GARDER" | while read -r v; do rm -rf "${RACINE:?}/versions/$v"; done
    rm -rf "$RACINE/versions/attente"
    ;;
esac
