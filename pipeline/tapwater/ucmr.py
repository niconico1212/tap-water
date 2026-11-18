"""UCMR 5 (2023-2025) PFAS and lithium results, summarised per water system."""
from __future__ import annotations

import csv
import io
import zipfile
from collections import defaultdict
from datetime import datetime

from .download import CACHE

# 2024 PFAS rule, in ppt. See SOURCES.md for regulatory status.
# "proposed_rescission" marks the limits EPA proposed withdrawing in May 2026.
MCL_PPT = {
    "PFOA": {"mcl": 4.0, "proposed_rescission": False},
    "PFOS": {"mcl": 4.0, "proposed_rescission": False},
    "PFHxS": {"mcl": 10.0, "proposed_rescission": True},
    "PFNA": {"mcl": 10.0, "proposed_rescission": True},
    "HFPO-DA": {"mcl": 10.0, "proposed_rescission": True},
}
# Hazard Index = sum(concentration / health-based water concentration), limit 1.
HAZARD_INDEX_PPT = {"PFHxS": 10.0, "PFNA": 10.0, "HFPO-DA": 10.0, "PFBS": 2000.0}


def _open(member: str):
    z = zipfile.ZipFile(CACHE / "ucmr5.zip")
    # The files are Latin-1 (the micro sign in "µg/L" is not valid UTF-8).
    return csv.DictReader(io.TextIOWrapper(z.open(member), encoding="latin-1", newline=""), delimiter="\t")


def load_zip_codes(systems) -> dict[str, set[str]]:
    out = defaultdict(set)
    for r in _open("UCMR5_ZIPCodes.txt"):
        if r["PWSID"] in systems and len(r["ZIPCODE"]) >= 5:
            out[r["ZIPCODE"][:5]].add(r["PWSID"])
    return out


def load_results(systems: dict[str, dict]) -> None:
    """Fill system['pfas'] and system['lithium'].

    `max_ppt` is the highest single result. `max_location_avg_ppt` is the highest
    average at any one sampling location with non-detects counted as zero, which
    is the closest thing in this data to the running annual average that MCL
    compliance is actually judged on.
    """
    # pwsid -> contaminant -> location -> [values]; non-detects are 0.0
    data = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    mrl = defaultdict(dict)
    dates = defaultdict(list)
    samples = defaultdict(lambda: defaultdict(dict))  # pwsid -> (location, date) -> {contaminant: ppt}
    for r in _open("UCMR5_All.txt"):
        pwsid = r["PWSID"]
        if pwsid not in systems:
            continue
        detected = r["AnalyticalResultsSign"] == "="
        try:
            value = float(r["AnalyticalResultValue"]) if detected else 0.0
            limit = float(r["MRL"])
        except ValueError:
            continue
        name = r["Contaminant"]
        if name != "lithium":  # lithium stays in µg/L; PFAS go to ppt (ng/L)
            value, limit = value * 1000, limit * 1000
        loc = (r["FacilityID"], r["SamplePointID"])
        data[pwsid][name][loc].append(value)
        mrl[pwsid][name] = limit
        try:
            d = datetime.strptime(r["CollectionDate"], "%m/%d/%Y").date().isoformat()
        except ValueError:
            continue
        dates[pwsid].append(d)
        if name in HAZARD_INDEX_PPT:
            samples[pwsid][(loc, d)][name] = value

    for pwsid, s in systems.items():
        if pwsid not in data:
            s["pfas"] = {"sampled": False}
            s["lithium"] = None
            continue
        chems = []
        for name, locs in data[pwsid].items():
            if name == "lithium":
                continue
            values = [v for vs in locs.values() for v in vs]
            detections = sum(v > 0 for v in values)
            if not detections and name not in MCL_PPT:
                continue  # unregulated and never found: nothing to show
            chems.append({
                "name": name,
                "samples": len(values),
                "detections": detections,
                "max_ppt": round(max(values), 2),
                "max_location_avg_ppt": round(max(sum(vs) / len(vs) for vs in locs.values()), 2),
                "reporting_limit_ppt": round(mrl[pwsid][name], 2),
                **({"mcl_ppt": MCL_PPT[name]["mcl"],
                    "proposed_rescission": MCL_PPT[name]["proposed_rescission"]} if name in MCL_PPT else {}),
            })
        chems.sort(key=lambda c: (c["name"] not in MCL_PPT, -c["detections"], c["name"]))
        hi = [sum(v / HAZARD_INDEX_PPT[n] for n, v in parts.items()) for parts in samples[pwsid].values()]
        s["pfas"] = {
            "sampled": True,
            "first_sample": min(dates[pwsid], default=None),
            "last_sample": max(dates[pwsid], default=None),
            "max_hazard_index": round(max(hi), 3) if hi else None,
            "chemicals": chems,
        }
        li = data[pwsid].get("lithium")
        if li:
            values = [v for vs in li.values() for v in vs]
            s["lithium"] = {"samples": len(values), "detections": sum(v > 0 for v in values),
                            "max_ugl": round(max(values), 1), "reporting_limit_ugl": mrl[pwsid]["lithium"]}
        else:
            s["lithium"] = None
