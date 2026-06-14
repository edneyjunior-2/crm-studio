#!/usr/bin/env bash
# Loop visual: tira screenshot de uma URL com Chrome headless para revisão.
# Uso: scripts/shot.sh <url> <saida.png> [largura] [altura]
#   ex.: scripts/shot.sh http://localhost:3000/ /tmp/home.png 1440 2600
#        scripts/shot.sh http://localhost:3000/ /tmp/home-mobile.png 390 1800
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL="${1:?informe a URL}"
OUT="${2:?informe o arquivo de saida .png}"
W="${3:-1440}"
H="${4:-2600}"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size="${W},${H}" \
  --screenshot="$OUT" "$URL" >/dev/null 2>&1
echo "ok: $OUT (${W}x${H})"
