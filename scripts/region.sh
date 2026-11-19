#!/usr/bin/env bash
# Builds one region end to end: boundaries from Overture, then streets and totals.
# Usage: npm run region -- <id>   (config in regionen/<id>.json)
set -euo pipefail
id="${1:?Region fehlt, z. B.: npm run region -- koeln}"
python3 -I scripts/regionen/overture.py "regionen/$id.json" ".region-cache/$id-overture.geojson"
NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1 npx tsx scripts/region.ts "$id"
