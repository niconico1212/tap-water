# Build: "What's In Your Tap Water" — ZIP lookup + letter grade

## What it is
User enters a ZIP code → sees the water system(s) serving them, recent violations, lead/copper results, PFAS results, and a simple letter grade, explained in plain English. A shareable "report card" image is the growth hook ("Houston got a C+. Check yours.").

## Stack
- Next.js + TypeScript + Tailwind on Vercel.
- **Do not hit the EPA API live on each page view** — Envirofacts is slow and flaky. Instead:
  - An ingestion script (Python or Node, in `/pipeline`) pulls the data, builds a precomputed JSON per ZIP (or per state shard), and writes it to `/public/data` or object storage.
  - A scheduled GitHub Action reruns it weekly.
- Pre-render a static page per water system and per major city (`/water/houston-tx`) for SEO — this is the main long-term traffic source.
- `<AdSlot />` placeholder component, no ads yet.

## Data sources (all free, public, keyless — verify each and document in `/pipeline/SOURCES.md`)
1. **EPA SDWIS via Envirofacts REST API** — tables WATER_SYSTEM, GEOGRAPHIC_AREA (ZIPs/counties served), VIOLATION, ENFORCEMENT_ACTION, LCR_SAMPLE_RESULT (lead & copper 90th percentile). Bulk download from EPA ECHO "SDWA Data Downloads" may be easier than paging the API — check both and pick the more reliable one.
2. **ZIP → water system mapping**: SDWIS ZIP-served data is incomplete. Check whether EPA's Community Water System Service Area Boundaries dataset is available and use it with a ZIP polygon overlay (Census ZCTA) as the primary match, falling back to SDWIS ZIP/county served. Show "systems that may serve you" when ambiguous.
3. **UCMR 5 (PFAS + lithium)** occurrence data from EPA — compare against the 2024 PFAS MCLs (check current regulatory status of those limits before using them as the benchmark; if they've changed, use the current values and note it).
4. Do NOT scrape or reuse EWG's database — it isn't openly licensed.

## Grade (transparent, on a /methodology page)
- Score from: health-based violations in last 5 years (heaviest weight), unresolved violations, lead 90th percentile vs 15 ppb action level, PFAS detections vs MCLs, monitoring/reporting violations (light weight).
- Map to A–F. Every point deduction must be visible on the page ("−15: Health-based violation for total coliform, 2024").
- Label it clearly as "an informational grade based on EPA-reported data, not a safety certification." Never say "your water is unsafe/safe." Link to the utility's Consumer Confidence Report and EPA contact.
- Handle edge cases: private wells (not in EPA data — say so and link to state well-testing info), no systems found, multiple systems.

## UI
- Home: big ZIP input, nothing else above the fold.
- Results: grade card on top (shareable), then plain-English sections: "Violations", "Lead & copper", "PFAS ('forever chemicals')", "What you can do" (generic, e.g. certified filter types — NSF/ANSI 53 for lead, 58 for PFAS; verify certifications).
- Share image 1080x1350: city, utility name, big letter grade, 2–3 key facts, site URL.
- Shareable URL `/zip/77005`.

## Done means
- Pipeline runs end-to-end for at least TX, NY, PA, CA; then all states.
- Tests for the grading function with fixtures.
- Spot-check 10 ZIPs (incl. 77005, 10021, 19104, 78701) against EPA's own SDWIS search and note results in `/pipeline/VALIDATION.md`.
- Deployed on Vercel.

Work in steps: (1) explore data sources and show me sample records for ZIP 77005, (2) pipeline, (3) grading + tests, (4) UI, (5) share image + SEO pages, (6) deploy. Stop after step 1 so I can review the data.
