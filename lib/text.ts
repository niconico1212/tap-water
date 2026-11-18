// Small formatting helpers for EPA's shouty, abbreviation-heavy text.

const KEEP_UPPER = new Set([
  "PWS", "MUD", "WSC", "SUD", "PUD", "WCID", "MWD", "ID", "LLC", "INC", "HOA", "MHP", "RV", "US", "USA", "II", "III", "IV",
  "RTCR", "TCR", "GWR", "SWTR", "LCR", "LSL", "OCCT", "SOWT", "CCR", "DBP", "TTHM", "HAA5", "MCL", "MRDL", "PN", "WQP", "PFAS",
  "NE", "NW", "SE", "SW", "FWSD", "WD", "CSD", "PSD", "MDWASA", "DWP", "LADWP", "NYC", "DC",
]);
const LOWER = new Set(["of", "and", "the", "for", "in", "at", "to", "or", "on", "a"]);

/** "CITY OF WEST UNIVERSITY PLACE" -> "City of West University Place". */
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|-|\/|\(|\)|,)/)
    .map((w, i) => {
      const up = w.toUpperCase();
      if (KEEP_UPPER.has(up.replace(/\./g, ""))) return up;
      if (i > 0 && LOWER.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join("")
    .replace(/\bE\. Coli\b/gi, "E. coli")
    .replace(/\bMc([a-z])/g, (_, c) => "Mc" + c.toUpperCase());
}

/** Title-case only strings that arrive in all caps; leave mixed case alone. */
export function tidy(s: string): string {
  return /[a-z]/.test(s) ? s.replace(/\bE\. COLI\b/g, "E. coli") : titleCase(s);
}

export const formatNumber = (n: number) => n.toLocaleString("en-US");

export function formatDate(iso?: string | null): string {
  if (!iso) return "date unknown";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  });
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-");
}

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  PR: "Puerto Rico", VI: "U.S. Virgin Islands", GU: "Guam", AS: "American Samoa", MP: "Northern Mariana Islands",
};
