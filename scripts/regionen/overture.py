"""Fetches the boundaries of one region from Overture Maps (theme "divisions").

Overture is built from OpenStreetMap and other open data. Every area knows its parent
(parent_division_id), worldwide: country > Bundesland > Kreis/kreisfreie Stadt > Stadtbezirk > Stadtteil.
A region is a root area plus its children down to a given depth, e.g. Köln (depth 2): Köln > 9 Bezirke > Stadtteile.

Usage:  python3 -I scripts/regionen/overture.py regionen/koeln.json .region-cache/koeln-overture.geojson
Needs:  pip install pyarrow shapely
"""

import json
import os
import sys

os.environ.setdefault("AWS_CA_BUNDLE", "/root/.ccr/ca-bundle.crt")

import pyarrow.compute as pc  # noqa: E402
import pyarrow.dataset as ds  # noqa: E402
import pyarrow.fs as fs  # noqa: E402
from shapely import wkb  # noqa: E402
from shapely.geometry import Point, mapping  # noqa: E402

RELEASE = "2026-11-18.0"
# Small named places (squares, single buildings) are not areas you explore street by street.
SKIP_SUBTYPES = {"microhood"}
# When areas of the same depth overlap, keep the one most likely to be an official district.
PREFERENCE = ["county", "localadmin", "locality", "borough", "macrohood", "neighborhood"]


def name_of(names, sprache):
    common = names.get("common") or []
    for key, value in common if isinstance(common, list) else common.items():
        if key == sprache:
            return value
    return names["primary"]


def box_filter(w, s, e, n):
    return (pc.field("bbox", "xmin") >= w) & (pc.field("bbox", "xmax") <= e) & (pc.field("bbox", "ymin") >= s) & (pc.field("bbox", "ymax") <= n)


def main():
    config_path, out_path = sys.argv[1], sys.argv[2]
    config = json.load(open(config_path, encoding="utf-8"))
    wurzel = config["wurzel"]
    tiefe = int(config.get("tiefe", 2))
    sprache = config.get("sprache", "de")
    release = config.get("overture", RELEASE)

    proxy = os.environ.get("HTTPS_PROXY")
    s3 = fs.S3FileSystem(anonymous=True, region="us-west-2", **({"proxy_options": proxy} if proxy else {}))
    base = f"overturemaps-us-west-2/release/{release}/theme=divisions"
    areas = ds.dataset(f"{base}/type=division_area/", filesystem=s3, format="parquet")
    divisions = ds.dataset(f"{base}/type=division/", filesystem=s3, format="parquet")
    area_cols = ["division_id", "subtype", "names", "geometry", "is_land"]

    # 1. Root area: right type, right name, contains the given point.
    lon, lat = wurzel["punkt"]
    near = (
        (pc.field("bbox", "xmin") <= lon) & (pc.field("bbox", "xmax") >= lon)
        & (pc.field("bbox", "ymin") <= lat) & (pc.field("bbox", "ymax") >= lat)
        & (pc.field("subtype") == wurzel["ebene"])
    )
    root = None
    for row in areas.to_table(filter=near, columns=area_cols).to_pylist():
        geom = wkb.loads(row["geometry"])
        if row["is_land"] and wurzel["name"] in {row["names"]["primary"], name_of(row["names"], sprache)} and geom.contains(Point(lon, lat)):
            root = (row, geom)
            break
    if not root:
        sys.exit(f"Wurzelgebiet {wurzel['name']} ({wurzel['ebene']}) nicht gefunden")
    root_row, root_geom = root
    w, s, e, n = root_geom.bounds
    pad = 0.02

    # 2. Family tree below the root.
    rows = divisions.to_table(filter=box_filter(w - pad, s - pad, e + pad, n + pad), columns=["id", "subtype", "parent_division_id"]).to_pylist()
    children = {}
    for r in rows:
        children.setdefault(r["parent_division_id"], []).append(r)
    depth_of = {root_row["division_id"]: 0}
    parent_of = {}
    frontier = [root_row["division_id"]]
    for depth in range(1, tiefe + 1):
        nxt = []
        for pid in frontier:
            for c in children.get(pid, []):
                if c["subtype"] in SKIP_SUBTYPES:
                    continue
                depth_of[c["id"]] = depth
                parent_of[c["id"]] = pid
                nxt.append(c["id"])
        frontier = nxt

    # 3. Their areas (places without an area, e.g. hamlets mapped as a point, drop out here).
    wanted = set(depth_of)
    found = {}
    for row in areas.to_table(filter=box_filter(w - pad, s - pad, e + pad, n + pad), columns=area_cols).to_pylist():
        if row["division_id"] in wanted and row["is_land"] and row["division_id"] not in found:
            found[row["division_id"]] = (row, wkb.loads(row["geometry"]))

    # 4. Same depth must not overlap: a smaller area inside a sibling of the same depth is dropped.
    keep = {}
    for did, (row, geom) in found.items():
        keep.setdefault(depth_of[did], []).append((did, row, geom))
    features = []
    counts = {}
    for depth, items in sorted(keep.items()):
        items.sort(key=lambda x: (PREFERENCE.index(x[1]["subtype"]) if x[1]["subtype"] in PREFERENCE else 99, -x[2].area))
        chosen = []
        for did, row, geom in items:
            p = geom.representative_point()
            if any(g.contains(p) for _, _, g in chosen):
                continue
            chosen.append((did, row, geom))
        for did, row, geom in chosen:
            parent = parent_of.get(did)
            features.append({
                "type": "Feature",
                "properties": {
                    "id": did,
                    "name": name_of(row["names"], sprache),
                    "rang": depth,
                    "eltern": parent if parent in found else None,
                    "art": row["subtype"],
                },
                "geometry": mapping(geom),
            })
        counts[depth] = len(chosen)

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    json.dump({"type": "FeatureCollection", "features": features}, open(out_path, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"{config['name']}: " + ", ".join(f"Ebene {d}: {c}" for d, c in sorted(counts.items())) + f" (Overture {release})")


if __name__ == "__main__":
    main()
