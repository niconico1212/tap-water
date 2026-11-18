# What's In Your Tap Water

Enter a ZIP code, see which water systems serve it, their EPA violations, lead and PFAS results, and a letter grade with every deduction shown.

- `app/`, `components/`, `lib/` — Next.js site (TypeScript, Tailwind).
- `lib/grade.ts` — the grading rules. `/methodology` renders them from the same constants.
- `pipeline/` — Python pipeline that builds `public/data` from EPA and Census files. See `pipeline/README.md`, `pipeline/SOURCES.md` and `pipeline/VALIDATION.md`.
- `.github/workflows/refresh-data.yml` — reruns the pipeline every Monday and commits the result.

## Run locally

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

## Routes

| Route | What |
|---|---|
| `/` | ZIP input |
| `/zip/77005` | Report for a ZIP: main system in full, others as cards |
| `/system/TX1010013` | Report for one water system |
| `/water/houston-tx` | City page (the city's main system) |
| `/state/tx`, `/states` | Browse lists |
| `/methodology` | How grades work |
| `/share/TX1010013?zip=77005` | 1080×1350 report-card PNG; add `&format=og` for 1200×630 |
| `/sitemap/core.xml`, `/sitemap/TX.xml` | Sitemaps, one per state |

## Deploy on Vercel

1. Merge this branch into the repository's default branch (the weekly data refresh only runs from the default branch).
2. In Vercel, choose **Add New → Project**, import the repository and accept the detected Next.js settings. No environment variables are required.
3. After adding a custom domain, set `NEXT_PUBLIC_SITE_URL` (for example `https://example.com`) so share images, canonical links and sitemaps use it.

How data reaches pages: the 500 largest cities, their systems and all state pages are pre-rendered at build time. Every other ZIP, system and city page renders on first visit and is cached for a day. Those on-demand renders fetch JSON from the site's own `/data/...` static files, because `public/data` (about 180 MB) is too large to bundle into a function. If Vercel Deployment Protection is on, preview deployments read data from the production URL.
