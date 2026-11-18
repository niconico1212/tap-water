"""ZIP code -> water system matching.

Order of preference:
  1. "boundary"  EPA service-area polygon overlaps the Census ZIP code area (ZCTA)
  2. "reported"  the system itself listed the ZIP (UCMR 5 or SDWIS)
  3. "county"    last resort when nothing else matched: largest systems in the county
"""
from __future__ import annotations

import csv
import io
import zipfile
from collections import defaultdict

from .download import BOUNDARIES, CACHE

STATE_FIPS = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06", "CO": "08", "CT": "09", "DE": "10",
    "DC": "11", "FL": "12", "GA": "13", "HI": "15", "ID": "16", "IL": "17", "IN": "18", "IA": "19",
    "KS": "20", "KY": "21", "LA": "22", "ME": "23", "MD": "24", "MA": "25", "MI": "26", "MN": "27",
    "MS": "28", "MO": "29", "MT": "30", "NE": "31", "NV": "32", "NH": "33", "NJ": "34", "NM": "35",
    "NY": "36", "NC": "37", "ND": "38", "OH": "39", "OK": "40", "OR": "41", "PA": "42", "RI": "44",
    "SC": "45", "SD": "46", "TN": "47", "TX": "48", "UT": "49", "VT": "50", "VA": "51", "WA": "53",
    "WV": "54", "WI": "55", "WY": "56", "AS": "60", "GU": "66", "MP": "69", "PR": "72", "VI": "78",
}

# A system is kept for a ZIP if it covers at least 1% of the ZIP's area, or if at
# least 10% of the system's own area is inside the ZIP (small systems in big ZIPs).
MIN_ZIP_SHARE = 0.01
MIN_SYSTEM_SHARE = 0.10
COUNTY_FALLBACK_LIMIT = 8
MIN_COUNTY_PART = 0.20


def overlay(systems: dict[str, dict]) -> dict[str, list[dict]]:
    """Intersect service areas with ZCTAs. Returns zip -> [{pwsid, share}], and
    records how each boundary was produced on system['boundary']."""
    import geopandas as gpd
    import shapely

    areas = gpd.read_file(CACHE / BOUNDARIES, columns=["PWSID", "Symbology_Field"])
    areas = areas[areas["PWSID"].isin(systems.keys())]
    for pwsid, method in zip(areas["PWSID"], areas["Symbology_Field"]):
        systems[pwsid]["boundary"] = method or "Unknown"
    for s in systems.values():
        s.setdefault("boundary", None)
    if areas.empty:
        return {}

    # Equal-area projection so shares are comparable everywhere, including AK/HI/PR.
    areas = areas.to_crs(6933)
    # buffer(0) repairs self-intersections and drops stray lines/points.
    areas["geometry"] = areas.geometry.buffer(0)
    areas = areas[~areas.geometry.is_empty]
    areas = areas.dissolve(by="PWSID").reset_index()[["PWSID", "geometry"]]
    areas["sys_area"] = areas.geometry.area

    zcta = gpd.read_file(f"zip://{CACHE / 'zcta.zip'}", columns=["ZCTA5CE20"]).to_crs(6933)
    zcta["geometry"] = zcta.geometry.buffer(0)
    zcta["zip_area"] = zcta.geometry.area

    pairs = gpd.sjoin(zcta, areas[["PWSID", "geometry"]], predicate="intersects")
    sys_geom = areas.set_index("PWSID").geometry
    inter = shapely.area(shapely.intersection(
        pairs.geometry.values, sys_geom.loc[pairs["PWSID"]].values))
    pairs = pairs.assign(
        zip_share=inter / pairs["zip_area"].values,
        sys_share=inter / areas.set_index("PWSID")["sys_area"].loc[pairs["PWSID"]].values,
    )
    pairs = pairs[(pairs.zip_share >= MIN_ZIP_SHARE) | (pairs.sys_share >= MIN_SYSTEM_SHARE)]

    out = defaultdict(list)
    for z, pwsid, share in zip(pairs["ZCTA5CE20"], pairs["PWSID"], pairs["zip_share"]):
        out[z].append({"pwsid": pwsid, "share": round(min(float(share), 1.0), 3)})
    return out


def load_zcta_counties() -> dict[str, list[str]]:
    """ZCTA -> county FIPS codes holding at least MIN_COUNTY_PART of its land,
    biggest part first. Every ZCTA gets at least its largest county."""
    parts = defaultdict(list)
    with open(CACHE / "zcta_county.txt", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f, delimiter="|"):
            if r["GEOID_ZCTA5_20"] and r["GEOID_COUNTY_20"]:
                parts[r["GEOID_ZCTA5_20"]].append(
                    (int(r["AREALAND_PART"] or 0) + int(r["AREAWATER_PART"] or 0), r["GEOID_COUNTY_20"]))
    out = {}
    for z, ps in parts.items():
        ps.sort(reverse=True)
        total = sum(a for a, _ in ps) or 1
        out[z] = [c for n, (a, c) in enumerate(ps) if n == 0 or a / total >= MIN_COUNTY_PART]
    return out


def load_places() -> dict[str, dict]:
    """ZIP -> city name, state and centroid, from GeoNames (CC BY 4.0)."""
    out = {}
    with zipfile.ZipFile(CACHE / "geonames_us.zip") as z:
        for line in io.TextIOWrapper(z.open("US.txt"), encoding="utf-8"):
            c = line.rstrip("\n").split("\t")
            if len(c) > 10 and len(c[1]) == 5:
                out.setdefault(c[1], {"city": c[2], "state": c[4],
                                      "lat": round(float(c[9]), 4), "lng": round(float(c[10]), 4)})
    return out


def build_zip_index(systems, overlaps, reported: list[dict[str, set[str]]], county_systems) -> dict[str, dict]:
    places, zcta_counties = load_places(), load_zcta_counties()
    fips_state = {v: k for k, v in STATE_FIPS.items()}

    def entry(pwsid, match, share=None):
        s = systems[pwsid]
        e = {"pwsid": pwsid, "name": s["name"], "population": s["population"], "match": match}
        if share is not None:
            e["share"] = share
        return e

    index = {}
    all_zips = set(overlaps) | set(zcta_counties) | {z for src in reported for z in src}
    for z in sorted(all_zips):
        found = sorted((entry(o["pwsid"], "boundary", o["share"]) for o in overlaps.get(z, ())),
                       key=lambda e: (-e["share"], -e["population"], e["pwsid"]))
        have = {e["pwsid"] for e in found}
        extra = {p for src in reported for p in src.get(z, ())} - have
        found += sorted((entry(p, "reported") for p in extra), key=lambda e: (-e["population"], e["pwsid"]))
        counties = zcta_counties.get(z, [])
        if not found:
            pool = {p for c in counties for p in county_systems.get(c, ())}
            found = sorted((entry(p, "county") for p in pool),
                           key=lambda e: (-e["population"], e["pwsid"]))[:COUNTY_FALLBACK_LIMIT]
        place = places.get(z, {})
        state = place.get("state") or (fips_state.get(counties[0][:2]) if counties else None)
        if not found and not state:
            continue
        index[z] = {
            "zip": z,
            "city": place.get("city"),
            "state": state,
            "lat": place.get("lat"),
            "lng": place.get("lng"),
            # Share of the ZIP's area inside any mapped service area. A low number
            # usually means farmland, parks or homes on private wells.
            "coverage": round(min(sum(e.get("share", 0) for e in found), 1.0), 3) if z in zcta_counties else None,
            "systems": found,
        }
    return index
