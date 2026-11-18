#!/usr/bin/env python3
"""Build the site's precomputed data from EPA and Census sources.

    python pipeline/build.py                      # all states
    python pipeline/build.py --states TX,NY,PA,CA # a subset
    python pipeline/build.py --skip-download      # reuse pipeline/.cache as-is

Output (all under public/data):
    zips/770.json       every ZIP starting 770 -> the systems that serve it
    systems/TX101.json  full records for every system whose PWSID starts TX101
    states/TX.json      one-line summary of every system in the state
    meta.json           build date, source dates, counts
"""
from __future__ import annotations

import argparse
import json
import shutil
import time
import zipfile
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

from tapwater import download, geo, sdwis, ucmr

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data"
SYSTEM_SHARD = 5  # PWSID prefix length: state + first three digits


def write(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), sort_keys=True, ensure_ascii=False))


def zip_member_date(name: str, member_prefix: str) -> str | None:
    with zipfile.ZipFile(download.CACHE / name) as z:
        ds = [i.date_time for i in z.infolist() if i.filename.startswith(member_prefix)]
    return date(*max(ds)[:3]).isoformat() if ds else None


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--states", help="comma-separated postal codes; default is everything")
    ap.add_argument("--skip-download", action="store_true")
    ap.add_argument("--force-download", action="store_true", help="re-fetch even if cached")
    args = ap.parse_args()
    states = {s.strip().upper() for s in args.states.split(",")} if args.states else None
    today = date.today()
    t0 = time.time()

    def step(msg):
        print(f"[{time.time() - t0:5.0f}s] {msg}", flush=True)

    if not args.skip_download:
        step("downloading sources")
        download.download_all(args.force_download)

    step("water systems")
    ref = sdwis.load_ref()
    systems = sdwis.load_systems(states, ref)
    if not systems:
        raise SystemExit("no systems matched; check --states")
    sdwis_zips, county_systems = sdwis.load_geography(systems)
    step(f"  {len(systems)} active community systems; reading violations")
    sdwis.load_violations(systems, ref, today)
    step("lead and copper")
    sdwis.load_lead_copper(systems, today)
    step("UCMR 5")
    ucmr.load_results(systems)
    ucmr_zips = ucmr.load_zip_codes(systems)
    step("service-area overlay")
    overlaps = geo.overlay(systems)
    step("ZIP index")
    zips = geo.build_zip_index(systems, overlaps, [ucmr_zips, sdwis_zips], county_systems)
    if states:  # a partial build only knows about its own states
        zips = {z: v for z, v in zips.items() if v["systems"]}

    step("writing")
    for sub in ("zips", "systems", "states"):
        shutil.rmtree(OUT / sub, ignore_errors=True)
    shards = defaultdict(dict)
    for z, rec in zips.items():
        shards[z[:3]][z] = rec
    for prefix, recs in shards.items():
        write(OUT / "zips" / f"{prefix}.json", recs)

    served = defaultdict(list)
    for z, rec in zips.items():
        for e in rec["systems"]:
            if e["match"] != "county":
                served[e["pwsid"]].append(z)
    shards, by_state = defaultdict(dict), defaultdict(list)
    for pwsid, s in systems.items():
        s["zips"] = sorted(served.get(pwsid, ()))
        shards[pwsid[:SYSTEM_SHARD]][pwsid] = s
        by_state[s["state"] or "XX"].append({
            "pwsid": pwsid, "name": s["name"], "population": s["population"],
            "city": s["contact"]["city"], "zips": len(s["zips"])})
    for prefix, recs in shards.items():
        write(OUT / "systems" / f"{prefix}.json", recs)
    for st, recs in by_state.items():
        write(OUT / "states" / f"{st}.json", sorted(recs, key=lambda r: (-r["population"], r["pwsid"])))

    matches = defaultdict(int)
    for rec in zips.values():
        matches[rec["systems"][0]["match"] if rec["systems"] else "none"] += 1
    write(OUT / "meta.json", {
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "states": sorted(states) if states else "all",
        "system_shard_prefix": SYSTEM_SHARD,
        "sources": {
            "sdwis": zip_member_date("sdwa.zip", "SDWA_PUB_WATER_SYSTEMS"),
            "ucmr5": zip_member_date("ucmr5.zip", "UCMR5_All"),
        },
        "counts": {
            "systems": len(systems),
            "systems_with_boundary": sum(bool(s["boundary"]) for s in systems.values()),
            "systems_with_pfas_data": sum(s["pfas"]["sampled"] for s in systems.values()),
            "zips": len(zips),
            "zips_by_best_match": dict(matches),
        },
    })
    size = sum(f.stat().st_size for f in OUT.rglob("*.json")) / 1e6
    step(f"done: {len(systems)} systems, {len(zips)} ZIPs, {size:.0f} MB in {OUT.relative_to(ROOT)}")
    print("   best match per ZIP:", dict(matches))


if __name__ == "__main__":
    main()
