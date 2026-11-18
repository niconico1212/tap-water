export const SITE_NAME = "What's In Your Tap Water";

/** Canonical origin. Set NEXT_PUBLIC_SITE_URL once a custom domain exists. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

export const DISCLAIMER =
  "An informational grade based on EPA-reported data, not a safety certification.";

export const LINKS = {
  ccr: "https://www.epa.gov/ccr/ccr-information-consumers",
  ccrSearch: "https://sdwis.epa.gov/ords/safewater/f?p=136:102",
  hotline: "https://www.epa.gov/ground-water-and-drinking-water/safe-drinking-water-hotline",
  privateWells: "https://www.epa.gov/privatewells",
  stateWellPrograms: "https://www.epa.gov/privatewells/private-drinking-water-well-programs-your-state",
  pfasFilters: "https://www.epa.gov/water-research/identifying-drinking-water-filters-certified-reduce-pfas",
  lead: "https://www.epa.gov/ground-water-and-drinking-water/basic-information-about-lead-drinking-water",
  pfasRule: "https://www.epa.gov/sdwa/and-polyfluoroalkyl-substances-pfas",
  facilityReport: (pwsid: string) => `https://echo.epa.gov/detailed-facility-report?fid=${pwsid}&sys=SDWIS`,
};
