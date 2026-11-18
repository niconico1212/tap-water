#!/usr/bin/env python3
"""Spot-check the built data against EPA's live SDWIS (Envirofacts) API and
write pipeline/VALIDATION.md.

    python pipeline/validate.py
"""
from __future__ import annotations

import json
import time
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
API = "https://data.epa.gov/efservice"
ZIPS = ["77005", "10021", "19104", "78701", "90210", "60614", "33101", "98101", "85001", "02139"]
ALL_SYSTEMS_FOR = {"77005"}  # check every system here, not just the first


def api(path: str):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(f"{API}/{path}/JSON", timeout=120) as r:
                return json.load(r)
        except Exception:
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))


def ours(pwsid: str, since: str):
    s = json.loads((DATA / "systems" / f"{pwsid[:5]}.json").read_text())[pwsid]
    recent = [v for v in s["violations"] if (v.get("begin") or "") >= since]
    lead = next((p["lead_ppb"] for p in s["lead_copper"] if p["lead_ppb"] is not None), None)
    return {"name": s["name"], "population": s["population"], "violations": len(recent),
            "health": sum(v["health_based"] for v in recent), "lead": lead}


def epa(pwsid: str, since: str):
    ws = api(f"WATER_SYSTEM/PWSID/{pwsid}")[0]
    seen, recent = set(), []
    for v in api(f"VIOLATION/PWSID/{pwsid}"):
        if v["violation_id"] in seen:
            continue
        seen.add(v["violation_id"])
        if (v.get("compl_per_begin_date") or "")[:10] >= since:
            recent.append(v)
    ends = {s["sample_id"]: (s.get("sampling_end_date") or "")[:10] for s in api(f"LCR_SAMPLE/PWSID/{pwsid}")}
    pb = [(ends.get(r["sample_id"], ""), r["sample_measure"]) for r in api(f"LCR_SAMPLE_RESULT/PWSID/{pwsid}")
          if r["contaminant_code"] == "PB90" and r["sample_measure"] is not None]
    lead = round(max(pb)[1] * 1000, 3) if pb else None
    return {"name": ws["pws_name"], "population": ws["population_served_count"], "violations": len(recent),
            "health": sum(v["is_health_based_ind"] == "Y" for v in recent), "lead": lead}


def main():
    today = date.today()
    since = today.replace(year=today.year - 5).isoformat()
    meta = json.loads((DATA / "meta.json").read_text())
    rows, mismatches = [], []
    for z in ZIPS:
        rec = json.loads((DATA / "zips" / f"{z[:3]}.json").read_text()).get(z)
        systems = rec["systems"] if z in ALL_SYSTEMS_FOR else rec["systems"][:1]
        for ref in systems:
            a, b = ours(ref["pwsid"], since), epa(ref["pwsid"], since)
            diffs = [k for k in a if a[k] != b[k]]
            if diffs:
                mismatches.append((z, ref["pwsid"], {k: (a[k], b[k]) for k in diffs}))
            cell = lambda k: str(a[k]) if a[k] == b[k] else f"**{a[k]} vs {b[k]}**"
            rows.append(f"| {z} | {rec['city']}, {rec['state']} | {ref['pwsid']} | {a['name'].title()} | {ref['match']} | "
                        f"{cell('population')} | {cell('violations')} | {cell('health')} | {cell('lead')} | "
                        f"{'match' if not diffs else 'differs'} |")
            print(z, ref["pwsid"], "OK" if not diffs else diffs, flush=True)

    out = [
        "# Validation",
        "",
        f"Checked {today.isoformat()} by `pipeline/validate.py`. Each row compares our built record with EPA's live "
        "SDWIS data from the Envirofacts API (`data.epa.gov/efservice`), the same database behind EPA's SDWIS search.",
        "",
        f"Our data: SDWIS bulk file dated {meta['sources']['sdwis']}. Violations are counted once per violation ID, "
        f"with a compliance period starting on or after {since}. Lead is the 90th percentile from the most recent "
        "sampling period, in ppb. Where a cell shows two numbers, the first is ours and the second is EPA's live value.",
        "",
        "| ZIP | Place | PWSID | System | ZIP match | Population | Violations (5 yr) | Health-based | Latest lead (ppb) | Result |",
        "|---|---|---|---|---|---|---|---|---|---|",
        *rows,
        "",
        f"**{len(rows) - len(mismatches)} of {len(rows)} systems match on every field.**",
        "",
    ]
    if mismatches:
        out += ["## Differences", ""]
        out += [f"- {z} {p}: " + "; ".join(f"{k}: ours {a!r}, EPA {b!r}" for k, (a, b) in d.items())
                for z, p, d in mismatches]
        out += ["", "Small differences are expected when Envirofacts has been refreshed since the bulk file was cut.", ""]
    out += [
        "## What this does and does not check",
        "",
        "- It confirms the pipeline reads, de-duplicates and date-filters SDWIS records the same way EPA's own API reports them.",
        "- It confirms the system matched to each ZIP exists in SDWIS under that ID and name.",
        "- It does not independently confirm that the system physically serves the ZIP. That rests on EPA's service-area map.",
        "- PFAS figures come from a separate EPA file (UCMR 5) that Envirofacts does not serve, so they are not compared here.",
        "",
    ]
    (ROOT / "pipeline" / "VALIDATION.md").write_text("\n".join(out))
    print(f"{len(rows) - len(mismatches)}/{len(rows)} match")


if __name__ == "__main__":
    main()
