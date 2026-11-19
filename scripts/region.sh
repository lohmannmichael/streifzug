#!/usr/bin/env bash
# Adds or rebuilds a region.
#   npm run region -- koeln                 rebuild an existing region (regionen/koeln.json)
#   npm run region -- "Hameln"              find a new place by name, write its config, build it
#   npm run region -- "New York" --land US  narrow the search (also: --ebene locality|county|region|country, --tiefe 0|1|2)
set -euo pipefail
eingabe="${1:?Ort oder Region fehlt, z. B.: npm run region -- \"Hameln\"}"
shift || true
if [[ -f "regionen/$eingabe.json" ]]; then
  id="$eingabe"
else
  id="$(python3 -I scripts/regionen/finden.py "$eingabe" "$@" | tee /dev/stderr | tail -1)"
fi
python3 -I scripts/regionen/overture.py "regionen/$id.json" ".region-cache/$id-overture.geojson"
NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1 npx tsx scripts/region.ts "$id"
