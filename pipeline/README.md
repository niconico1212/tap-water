# Data pipeline

Turns EPA and Census downloads into the static JSON the site reads. The site never calls EPA at request time.

```bash
pip install -r pipeline/requirements.txt
```

```bash
python pipeline/build.py --states TX,NY,PA,CA
```

```bash
python pipeline/build.py
```

Raw downloads (about 1.2 GB) are kept in `pipeline/.cache` and reused on the next run; pass `--force-download` to refresh them. `.github/workflows/refresh-data.yml` runs the full build every Monday and commits `public/data` when it changes.

## Output

| Path | Contents |
|---|---|
| `public/data/zips/770.json` | Every ZIP starting `770`, each with its city, state and the systems that serve it |
| `public/data/systems/TX101.json` | Full records for every system whose PWSID starts `TX101` |
| `public/data/states/TX.json` | One-line summary of each system in the state, largest first |
| `public/data/meta.json` | Build time, source dates, counts |

To look up a ZIP: read `zips/<first 3 digits>.json`, take the entry, then read `systems/<first 5 chars of PWSID>.json` for each system.

### ZIP entry

`systems` is ordered best match first. `match` says how the system was linked to the ZIP:

- `boundary` — EPA's service-area polygon overlaps the ZIP. `share` is the fraction of the ZIP's area it covers.
- `reported` — the utility listed this ZIP itself (UCMR 5 or SDWIS), but no polygon overlap was found.
- `county` — nothing else matched; these are the largest systems in the ZIP's county. Low confidence.

`coverage` is the fraction of the ZIP inside any mapped service area. Low coverage usually means open land or private wells.

### System record

- `violations` — each violation once, newest first, limited to the last 5 years plus anything still open. Empty fields are omitted. `category` is `MCL`, `MRDL`, `TT` (treatment technique), `MON`, `RPT`, `MR` or `Other`. `status` is `Resolved`, `Archived`, `Addressed` (formal enforcement under way) or `Unaddressed`.
- `violation_counts` — all-time totals.
- `lead_copper` — 90th percentile per sampling period. Lead in ppb (action level 15), copper in mg/L (action level 1.3).
- `pfas.sampled` — `false` means the system was not part of UCMR 5, which is different from "nothing found".
- `pfas.chemicals` — every regulated PFAS plus any other PFAS that was detected. `max_location_avg_ppt` averages each sampling location with non-detects as zero.
- `boundary` — how EPA produced the service-area polygon, or `null` if there is none.

Only active community water systems are included. Individual contact names and email addresses from SDWIS are not published.

See `SOURCES.md` for where each file comes from.
