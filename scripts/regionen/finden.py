"""Finds a place by name in Overture Maps and writes its region config regionen/<id>.json.

Picks the most likely match: towns and municipalities before states and countries (unless --ebene is given),
then the largest population. Close spellings are suggested when nothing matches exactly (e.g. "Emmertal" -> "Emmerthal").

Usage:  python3 -I scripts/regionen/finden.py "Hameln" [--land DE] [--ebene locality] [--tiefe 1]
Prints the chosen id on the last line.
"""

import argparse
import difflib
import json
import os
import re
import sys
import unicodedata

os.environ.setdefault("AWS_CA_BUNDLE", "/root/.ccr/ca-bundle.crt")

import pyarrow.compute as pc  # noqa: E402
import pyarrow.dataset as ds  # noqa: E402
import pyarrow.fs as fs  # noqa: E402
from shapely import wkb  # noqa: E402

RELEASE = "2026-11-18.0"
EBENEN = ["locality", "localadmin", "county", "region", "country"]  # preference without --ebene


def slug(name):
    s = name.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("name")
    p.add_argument("--land", help="ISO-Ländercode, z. B. DE, US")
    p.add_argument("--ebene", choices=EBENEN)
    p.add_argument("--tiefe", default="auto")
    p.add_argument("--id")
    args = p.parse_args()

    proxy = os.environ.get("HTTPS_PROXY")
    s3 = fs.S3FileSystem(anonymous=True, region="us-west-2", **({"proxy_options": proxy} if proxy else {}))
    data = ds.dataset(f"overturemaps-us-west-2/release/{RELEASE}/theme=divisions/type=division/", filesystem=s3, format="parquet")
    ebenen = [args.ebene] if args.ebene else EBENEN
    cols = ["id", "subtype", "class", "names", "country", "population", "geometry"]

    def suche(bedingung):
        f = bedingung & pc.field("subtype").isin(ebenen)
        if args.land:
            f = f & (pc.field("country") == args.land.upper())
        return data.to_table(filter=f, columns=cols).to_pylist()

    treffer = suche(pc.field("names", "primary") == args.name)
    if not treffer:
        # Close spellings: same first three letters, then rank by similarity.
        nahe = suche(pc.starts_with(pc.utf8_lower(pc.field("names", "primary")), args.name[:3].lower()))
        namen = sorted({r["names"]["primary"] for r in nahe})
        vorschlaege = difflib.get_close_matches(args.name, namen, n=5, cutoff=0.75)
        if not vorschlaege:
            sys.exit(f"Kein Ort namens „{args.name}“ gefunden.")
        print(f"„{args.name}“ nicht gefunden, nehme „{vorschlaege[0]}“ (weitere: {', '.join(vorschlaege[1:]) or 'keine'})")
        treffer = [r for r in nahe if r["names"]["primary"] == vorschlaege[0]]

    treffer.sort(key=lambda r: (ebenen.index(r["subtype"]), -(r["population"] or 0)))
    for r in treffer[:5]:
        print(f"  {r['subtype']:<10} {r['country']}  {r['population'] or '-':>9}  {r['names']['primary']}")
    wahl = treffer[0]
    punkt = wkb.loads(wahl["geometry"])
    rid = args.id or slug(wahl["names"]["primary"])
    tiefe = args.tiefe if args.tiefe == "auto" else int(args.tiefe)
    konfig = {
        "id": rid,
        "name": wahl["names"]["primary"],
        "wurzel": {"ebene": wahl["subtype"], "name": wahl["names"]["primary"], "punkt": [round(punkt.x, 5), round(punkt.y, 5)]},
        "tiefe": tiefe,
    }
    os.makedirs("regionen", exist_ok=True)
    with open(f"regionen/{rid}.json", "w", encoding="utf-8") as f:
        json.dump(konfig, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Gewählt: {wahl['names']['primary']} ({wahl['subtype']}, {wahl['country']}, {wahl['population'] or 'Einwohner unbekannt'}) -> regionen/{rid}.json")
    print(rid)


if __name__ == "__main__":
    main()
