# Data sources

Verified 2026-11-18. All are free, public and keyless. Sample records for ZIP 77005 are in `samples/77005/`.

## 1. SDWIS (systems, violations, enforcement, lead & copper)

**Chosen: EPA ECHO "SDWA Data Downloads" bulk zip.**

- URL: `https://echo.epa.gov/files/echodownloads/SDWA_latest_downloads.zip`
- 558 MB zipped, 5.2 GB unzipped, 11 CSVs. File dated 2026-10-14, data is submission quarter 2026Q3. Refreshed quarterly.
- Files we need:
  - `SDWA_PUB_WATER_SYSTEMS.csv` — one row per system (name, type, population, source, contact).
  - `SDWA_VIOLATIONS_ENFORCEMENT.csv` (4.1 GB) — one row per violation × enforcement action, so it must be de-duplicated on `PWSID + VIOLATION_ID`. Has `IS_HEALTH_BASED_IND`, `VIOLATION_STATUS` (Resolved / Archived / Addressed / Unaddressed), `NON_COMPL_PER_BEGIN_DATE`, `CALCULATED_RTC_DATE`.
  - `SDWA_LCR_SAMPLES.csv` — lead/copper 90th percentile with sampling period dates, in mg/L.
  - `SDWA_GEOGRAPHIC_AREAS.csv` — county / city / ZIP served.
  - `SDWA_REF_CODE_VALUES.csv` — decodes violation, contaminant and rule codes to plain text.

**Not chosen: Envirofacts REST API** (`https://data.epa.gov/efservice/<TABLE>/<COL>/<VAL>/JSON`).
It worked in testing (1–3 s per call), but a national build needs hundreds of thousands of paged calls, and `LCR_SAMPLE_RESULT` carries no sampling dates without a second join to `LCR_SAMPLE`. The bulk file has the dates joined in and is one download. Envirofacts stays useful for spot checks.

Quirks found:

- Violation rows can have a blank `NON_COMPL_PER_BEGIN_DATE` (16 of 284 rows in the sample); fall back to `COMPL_PER_BEGIN_DATE`.
- `VIOLATION_STATUS` is blank on some old violations.
- Copper (`CU90`) rows are sparse compared with lead (`PB90`); many systems have lead rows only.
- `POPULATION_SERVED_COUNT` differs between SDWIS (Houston 2,970,543) and the service-area layer (2,202,531). Use SDWIS.

## 2. ZIP → water system

**Primary: EPA service area boundaries overlaid on Census ZCTAs.**

- Boundaries: `https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Water_System_Boundaries/FeatureServer/0`
  - 44,615 community water system polygons. Query + Extract enabled, 2,000 records per page, GeoJSON supported.
  - `Symbology_Field` / `Method_Details` say whether a boundary came from the system or state, or was modelled. Modelled ones are estimates, so we should carry this through as a confidence flag.
- ZCTAs: Census TIGER/Line `https://www2.census.gov/geo/tiger/TIGER2024/ZCTA520/tl_2024_us_zcta520.zip` (529 MB national shapefile). TIGERweb layer 2 serves single ZCTAs for spot checks.
- Pipeline plan: download both once, do the overlay locally, and keep the share of each ZCTA's area covered by each system so tiny slivers can be dropped or ranked last.

**Fallbacks:**

- UCMR 5 `UCMR5_ZIPCodes.txt` — ZIPs reported by the systems themselves, but only for systems in UCMR 5 (mostly those serving over 3,300 people).
- SDWIS `SDWA_GEOGRAPHIC_AREAS.csv` — weak for ZIPs. Only 6,840 of 414,573 systems report any ZIP served. County served is well populated (412,350 rows) and is the last-resort match.

ZIP 77005 shows the difference: SDWIS ZIP-served returns nothing, UCMR 5 returns three systems, and the boundary overlay returns four.

## 3. UCMR 5 (PFAS + lithium)

- URL: `https://www.epa.gov/system/files/other-files/2023-08/ucmr5-occurrence-data.zip` (13.5 MB zipped; the path says 2023-08 but the file is updated in place, last modified 2026-10-15).
- `UCMR5_All.txt` — 319 MB, tab-delimited, **Latin-1 encoded** (the `µ` in `µg/L` breaks UTF-8 readers). One row per sample × contaminant. `AnalyticalResultsSign` is `=` for a detection and `<` for below the reporting limit. Values are in µg/L, so multiply by 1,000 for ppt.
- `UCMR5_ZIPCodes.txt` — PWSID → ZIP.
- Sampling ran 2023–2025 and EPA has described the 2026 release as final, so this is a fixed snapshot, not ongoing monitoring. Small systems mostly were not sampled (Southside Place has no rows).

### PFAS benchmark status

The April 2024 rule is still the regulation in force:

| Contaminant | MCL |
|---|---|
| PFOA | 4.0 ppt |
| PFOS | 4.0 ppt |
| PFHxS | 10 ppt |
| PFNA | 10 ppt |
| HFPO-DA (GenX) | 10 ppt |
| Mixture of PFHxS, PFNA, HFPO-DA, PFBS | Hazard Index 1 |

In May 2026 EPA proposed keeping PFOA and PFOS at 4 ppt with an optional compliance extension from 2029 to 2031, and rescinding the PFHxS, PFNA, GenX and Hazard Index limits. As of the sources read (dated up to October 2026) neither proposal was final. This comes from secondary sources and must be re-checked against the Federal Register before launch.

Two things the grade must respect:

- MCL compliance is judged on a running annual average, and enforcement has not started. A single UCMR 5 result above 4 ppt is "a result above the federal limit", not a violation.
- If the rescission is finalised, only PFOA and PFOS remain as federal benchmarks.

## 4. Not used

EWG's Tap Water Database — not openly licensed.
