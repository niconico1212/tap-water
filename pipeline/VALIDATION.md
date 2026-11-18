# Validation

Checked 2026-11-18 by `pipeline/validate.py`. Each row compares our built record with EPA's live SDWIS data from the Envirofacts API (`data.epa.gov/efservice`), the same database behind EPA's SDWIS search.

Our data: SDWIS bulk file dated 2026-10-13. Violations are counted once per violation ID, with a compliance period starting on or after 2021-11-18. Lead is the 90th percentile from the most recent sampling period, in ppb. Where a cell shows two numbers, the first is ours and the second is EPA's live value.

| ZIP | Place | PWSID | System | ZIP match | Population | Violations (5 yr) | Health-based | Latest lead (ppb) | Result |
|---|---|---|---|---|---|---|---|---|---|
| 77005 | Houston, TX | TX1010013 | City Of Houston | boundary | 2970543 | 1 | 1 | 5.0 | match |
| 77005 | Houston, TX | TX1010027 | City Of West University Place | boundary | 19200 | 2 | 0 | 0 | match |
| 77005 | Houston, TX | TX1010908 | Rice University | boundary | 8415 | 13 | 4 | 2.35 | match |
| 77005 | Houston, TX | TX1010023 | City Of Southside Place | boundary | 2457 | 0 | 0 | 0 | match |
| 10021 | New York, NY | NY7003493 | New York City System | boundary | 8271000 | 0 | 0 | 10.0 | match |
| 19104 | Philadelphia, PA | PA1510001 | Philadelphia Water Department | boundary | 1600000 | 5 | 0 | 2.0 | match |
| 78701 | Austin, TX | TX2270001 | City Of Austin Water & Wastewater | boundary | 1115323 | 1 | 1 | 0 | match |
| 90210 | Beverly Hills, CA | CA1910067 | Los Angeles-City, Dept. Of Water & Power | boundary | 3875566 | 0 | 0 | 3.9 | match |
| 60614 | Chicago, IL | IL0316000 | Chicago | boundary | 2721308 | 9 | 0 | 6.4 | match |
| 33101 | Miami, FL | FL4130871 | Mdwasa - Main System | boundary | 2377460 | 6 | 0 | 3.1 | match |
| 98101 | Seattle, WA | WA5377050 | Seattle Public Utilities | boundary | 1161961 | 0 | 0 | 1.6 | match |
| 85001 | Phoenix, AZ | AZ0407025 | Phoenix City Of | reported | 1695000 | 2 | 0 | 2.74 | match |
| 02139 | Cambridge, MA | MA3049000 | Cambridge Water Department | boundary | 118214 | 0 | 0 | 8.0 | match |

**13 of 13 systems match on every field.**

## What this does and does not check

- It confirms the pipeline reads, de-duplicates and date-filters SDWIS records the same way EPA's own API reports them.
- It confirms the system matched to each ZIP exists in SDWIS under that ID and name.
- It does not independently confirm that the system physically serves the ZIP. That rests on EPA's service-area map.
- PFAS figures come from a separate EPA file (UCMR 5) that Envirofacts does not serve, so they are not compared here.
