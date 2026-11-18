"""Fetch the raw source files into pipeline/.cache. See SOURCES.md for what each one is."""
from __future__ import annotations

import json
import shutil
import time
import urllib.parse
import urllib.request
from pathlib import Path

CACHE = Path(__file__).resolve().parent.parent / ".cache"
UA = {"User-Agent": "tap-water-pipeline"}

FILES = {
    "sdwa.zip": "https://echo.epa.gov/files/echodownloads/SDWA_latest_downloads.zip",
    "ucmr5.zip": "https://www.epa.gov/system/files/other-files/2023-08/ucmr5-occurrence-data.zip",
    "zcta.zip": "https://www2.census.gov/geo/tiger/TIGER2024/ZCTA520/tl_2024_us_zcta520.zip",
    "zcta_county.txt": "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt",
    "geonames_us.zip": "https://download.geonames.org/export/zip/US.zip",
}
BOUNDARIES = "boundaries.geojsonl"
BOUNDARY_QUERY = (
    "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/"
    "Water_System_Boundaries/FeatureServer/0/query"
)
PAGE = 500


def _open(url: str, tries: int = 5):
    for attempt in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300)
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(2 ** (attempt + 1))


def fetch(name: str, url: str, force: bool) -> None:
    dest = CACHE / name
    if dest.exists() and not force:
        print(f"  {name}: cached")
        return
    tmp = dest.with_suffix(dest.suffix + ".part")
    with _open(url) as r, open(tmp, "wb") as f:
        shutil.copyfileobj(r, f, 1 << 20)
    tmp.rename(dest)
    print(f"  {name}: {dest.stat().st_size / 1e6:.0f} MB")


def fetch_boundaries(force: bool) -> None:
    """Page through EPA's service-area layer. Geometry is simplified to ~10 m,
    which is plenty for measuring overlap with ZIP code areas."""
    dest = CACHE / BOUNDARIES
    if dest.exists() and not force:
        print(f"  {BOUNDARIES}: cached")
        return
    tmp = dest.with_suffix(".part")
    offset = n = 0
    with open(tmp, "w") as out:
        while True:
            q = urllib.parse.urlencode({
                "where": "1=1",
                "outFields": "PWSID,Symbology_Field",
                "orderByFields": "OBJECTID",
                "resultOffset": offset,
                "resultRecordCount": PAGE,
                "outSR": 4326,
                "geometryPrecision": 5,
                "maxAllowableOffset": 0.0001,
                "f": "geojson",
            })
            with _open(f"{BOUNDARY_QUERY}?{q}") as r:
                page = json.load(r)
            if "error" in page:
                raise RuntimeError(f"boundary service error at offset {offset}: {page['error']}")
            feats = page.get("features", [])
            for feat in feats:
                if feat.get("geometry"):
                    out.write(json.dumps(feat, separators=(",", ":")) + "\n")
                    n += 1
            offset += len(feats)
            more = page.get("exceededTransferLimit") or (page.get("properties") or {}).get("exceededTransferLimit")
            if not feats or not more:
                break
    tmp.rename(dest)
    print(f"  {BOUNDARIES}: {n} polygons")


def download_all(force: bool = False) -> None:
    CACHE.mkdir(exist_ok=True)
    for name, url in FILES.items():
        fetch(name, url, force)
    fetch_boundaries(force)
