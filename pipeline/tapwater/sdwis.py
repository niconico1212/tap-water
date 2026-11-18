"""Read the ECHO SDWA bulk download straight out of the zip (no 5 GB extract)."""
from __future__ import annotations

import csv
import io
import zipfile
from collections import defaultdict
from datetime import date, datetime

from .download import CACHE

OPEN_STATUSES = {"Addressed", "Unaddressed"}


def rows(member: str):
    """Yield (header_index, row) for each CSV row of a file inside sdwa.zip."""
    with zipfile.ZipFile(CACHE / "sdwa.zip") as z, z.open(member) as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="latin-1", newline=""))
        idx = {name: i for i, name in enumerate(next(reader))}
        for row in reader:
            yield idx, row


def iso(s: str) -> str | None:
    s = s.strip()
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], "%m/%d/%Y").date().isoformat()
    except ValueError:
        return None


def num(s: str) -> float | None:
    try:
        return float(s)
    except ValueError:
        return None


def system_state(pwsid: str, mailing_state: str) -> str:
    """State PWSIDs start with the postal code. Tribal and EPA-run systems start
    with a region number, so fall back to the mailing address state."""
    return pwsid[:2] if pwsid[:2].isalpha() else (mailing_state or "").upper()


def load_ref() -> dict[tuple[str, str], str]:
    return {(r[i["VALUE_TYPE"]], r[i["VALUE_CODE"]]): r[i["VALUE_DESCRIPTION"]]
            for i, r in rows("SDWA_REF_CODE_VALUES.csv")}


def load_systems(states: set[str] | None, ref) -> dict[str, dict]:
    """Active community water systems. Non-community systems (schools, campgrounds,
    businesses with their own well) don't serve homes and are left out."""
    out = {}
    for i, r in rows("SDWA_PUB_WATER_SYSTEMS.csv"):
        if r[i["PWS_TYPE_CODE"]] != "CWS" or r[i["PWS_ACTIVITY_CODE"]] != "A":
            continue
        pwsid = r[i["PWSID"]]
        state = system_state(pwsid, r[i["STATE_CODE"]])
        if states and state not in states:
            continue
        src = r[i["PRIMARY_SOURCE_CODE"]]
        out[pwsid] = {
            "pwsid": pwsid,
            "name": r[i["PWS_NAME"]].strip(),
            "state": state,
            "population": int(num(r[i["POPULATION_SERVED_COUNT"]]) or 0),
            "connections": int(num(r[i["SERVICE_CONNECTIONS_COUNT"]]) or 0),
            "source": {"code": src, "label": ref.get(("PRIMARY_SOURCE_CODE", src), src) if src else None},
            "owner": ref.get(("OWNER_TYPE_CODE", r[i["OWNER_TYPE_CODE"]])),
            "wholesaler": r[i["IS_WHOLESALER_IND"]] == "Y",
            # Utility contact only. ADMIN_NAME / EMAIL_ADDR are an individual's details; not published.
            "contact": {"phone": r[i["PHONE_NUMBER"]] or None, "city": r[i["CITY_NAME"]].title() or None},
        }
    return out


def load_geography(systems: dict[str, dict]):
    """Returns (zip -> set of pwsid, county fips -> set of pwsid) and fills
    system['counties'] with county names."""
    from .geo import STATE_FIPS

    zips, counties = defaultdict(set), defaultdict(set)
    names = defaultdict(set)
    for i, r in rows("SDWA_GEOGRAPHIC_AREAS.csv"):
        pwsid = r[i["PWSID"]]
        s = systems.get(pwsid)
        if not s:
            continue
        kind = r[i["AREA_TYPE_CODE"]]
        if kind == "ZC" and len(r[i["ZIP_CODE_SERVED"]]) >= 5:
            zips[r[i["ZIP_CODE_SERVED"]][:5]].add(pwsid)
        elif kind == "CN":
            if r[i["COUNTY_SERVED"]]:
                names[pwsid].add(r[i["COUNTY_SERVED"]])
            code, st = r[i["ANSI_ENTITY_CODE"]], STATE_FIPS.get(s["state"])
            if st and len(code) == 3 and code.isdigit():
                counties[st + code].add(pwsid)
    for pwsid, s in systems.items():
        s["counties"] = sorted(names.get(pwsid, ()))
    return zips, counties


def load_violations(systems: dict[str, dict], ref, today: date, years: int = 10) -> None:
    """Fill system['violations'] (recent or still open, newest first) and
    system['violation_counts'] (all-time).

    The file has one row per violation x enforcement action, so each violation
    is counted once and keeps only its most recent enforcement action.
    """
    cutoff = today.replace(year=today.year - years).isoformat()
    seen: set[str] = set()
    kept: dict[str, dict] = {}
    counts = defaultdict(lambda: {"total": 0, "health_based": 0})
    for i, r in rows("SDWA_VIOLATIONS_ENFORCEMENT.csv"):
        pwsid = r[i["PWSID"]]
        if pwsid not in systems:
            continue
        key = pwsid + "|" + r[i["VIOLATION_ID"]]
        enf_date = iso(r[i["ENFORCEMENT_DATE"]])
        if key in kept:
            v = kept[key]
            if enf_date and (not v["enforcement"] or enf_date > v["enforcement"]["date"]):
                v["enforcement"] = _enforcement(i, r, ref, enf_date)
            continue
        if key in seen:
            continue
        seen.add(key)
        health = r[i["IS_HEALTH_BASED_IND"]] == "Y"
        counts[pwsid]["total"] += 1
        counts[pwsid]["health_based"] += health
        begin = iso(r[i["NON_COMPL_PER_BEGIN_DATE"]]) or iso(r[i["COMPL_PER_BEGIN_DATE"]])
        status = r[i["VIOLATION_STATUS"]] or None
        if not (status in OPEN_STATUSES or (begin and begin >= cutoff)):
            continue
        vcode, ccode, cat = r[i["VIOLATION_CODE"]], r[i["CONTAMINANT_CODE"]], r[i["VIOLATION_CATEGORY_CODE"]]
        kept[key] = {
            "pwsid": pwsid,
            "id": r[i["VIOLATION_ID"]],
            "begin": begin,
            "end": iso(r[i["NON_COMPL_PER_END_DATE"]]) or iso(r[i["COMPL_PER_END_DATE"]]),
            "resolved_on": iso(r[i["CALCULATED_RTC_DATE"]]),
            "status": status,
            "health_based": health,
            "category": cat,
            "category_label": ref.get(("VIOLATION_CATEGORY_CODE", cat), cat),
            "type": ref.get(("VIOLATION_CODE", vcode), vcode),
            "contaminant": ref.get(("CONTAMINANT_CODE", ccode), ccode) or None,
            "rule": ref.get(("RULE_CODE", r[i["RULE_CODE"]])),
            "public_notice_tier": int(num(r[i["PUBLIC_NOTIFICATION_TIER"]]) or 0) or None,
            "enforcement": _enforcement(i, r, ref, enf_date) if enf_date else None,
        }
    by_system = defaultdict(list)
    for v in kept.values():
        by_system[v.pop("pwsid")].append(v)
    for pwsid, s in systems.items():
        vs = sorted(by_system.get(pwsid, ()), key=lambda v: (v["begin"] or "", v["id"]), reverse=True)
        s["violations"] = vs
        s["violation_counts"] = {
            **counts[pwsid],
            "open": sum(v["status"] in OPEN_STATUSES for v in vs),
            "listed_since": cutoff,
        }


def _enforcement(i, r, ref, enf_date):
    code = r[i["ENFORCEMENT_ACTION_TYPE_CODE"]]
    return {
        "date": enf_date,
        "action": ref.get(("ENFORCEMENT_ACTION_TYPE_CODE", code), code),
        "category": r[i["ENF_ACTION_CATEGORY"]] or None,
    }


def load_lead_copper(systems: dict[str, dict], today: date, years: int = 10) -> None:
    """Fill system['lead_copper']: one entry per sampling period, newest first.
    Lead is converted to ppb (action level 15), copper stays in mg/L (action level 1.3)."""
    cutoff = today.replace(year=today.year - years).isoformat()
    periods: dict[tuple, dict] = {}
    for i, r in rows("SDWA_LCR_SAMPLES.csv"):
        pwsid = r[i["PWSID"]]
        code = r[i["CONTAMINANT_CODE"]]
        value = num(r[i["SAMPLE_MEASURE"]])
        end = iso(r[i["SAMPLING_END_DATE"]])
        if pwsid not in systems or code not in ("PB90", "CU90") or value is None or not end:
            continue
        unit = r[i["UNIT_OF_MEASURE"]].strip().lower()
        mgl = value / 1000 if unit in ("ug/l", "µg/l", "ppb") else value
        p = periods.setdefault((pwsid, r[i["SAMPLING_START_DATE"]], end), {
            "start": iso(r[i["SAMPLING_START_DATE"]]), "end": end, "lead_ppb": None, "copper_mgl": None})
        if code == "PB90":
            p["lead_ppb"] = max(p["lead_ppb"] or 0, round(mgl * 1000, 3))
        else:
            p["copper_mgl"] = max(p["copper_mgl"] or 0, round(mgl, 4))
    by_system = defaultdict(list)
    for (pwsid, _, _), p in periods.items():
        by_system[pwsid].append(p)
    for pwsid, s in systems.items():
        ps = sorted(by_system.get(pwsid, ()), key=lambda p: (p["end"], p["start"] or ""), reverse=True)
        # Always keep the latest result, however old, plus everything in the window.
        s["lead_copper"] = [p for n, p in enumerate(ps) if n == 0 or p["end"] >= cutoff]
