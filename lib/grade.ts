import type { PfasChemical, Violation, WaterSystem } from "./types";
import { tidy } from "./text";

/**
 * The grade. Every system starts at 100 and loses points for what EPA's records
 * show. Every deduction is returned as a line item so the page can show it.
 *
 * The numbers below are the whole methodology; /methodology renders this table.
 */
export const RULES = {
  windowYears: 5,
  healthViolation: { points: 15, cap: 45 },
  openViolation: { healthBased: 10, other: 5, cap: 20 },
  monitoringViolation: { points: 2, cap: 10 },
  lead: {
    actionLevelPpb: 15,
    nearPpb: 10,
    aboveActionLevel: 20,
    nearActionLevel: 8,
    earlierExceedance: 8,
  },
  copper: { actionLevelMgl: 1.3, aboveActionLevel: 5 },
  pfas: { averageAboveLimit: 15, singleResultAboveLimit: 7, detectedBelowLimit: 2, hazardIndexAboveOne: 10, cap: 30 },
} as const;

export const LETTERS: [min: number, letter: string][] = [
  [97, "A+"], [93, "A"], [90, "A-"],
  [87, "B+"], [83, "B"], [80, "B-"],
  [77, "C+"], [73, "C"], [70, "C-"],
  [67, "D+"], [63, "D"], [60, "D-"],
  [0, "F"],
];

export type DeductionCategory = "health" | "open" | "lead" | "copper" | "pfas" | "monitoring";

export interface Deduction {
  points: number; // positive number of points removed
  category: DeductionCategory;
  label: string;
}

export interface Grade {
  score: number;
  letter: string;
  deductions: Deduction[];
  /** Things that did not change the score but that a reader should know. */
  notes: string[];
  /** Violation counts behind the score (before caps). */
  counts: { health: number; monitoring: number; open: number };
  /** Start of the look-back window, YYYY-MM-DD. */
  since: string;
}

export function letterFor(score: number): string {
  return LETTERS.find(([min]) => score >= min)![1];
}

const year = (iso?: string | null) => (iso ? iso.slice(0, 4) : "date unknown");

function describe(v: Violation): string {
  const subject = v.contaminant ?? v.rule;
  return `${tidy(v.type)}${subject ? ` (${tidy(subject)})` : ""}, ${year(v.begin)}`;
}

/** Push line items, shrinking the ones that would take a group past its cap. */
function addCapped(out: Deduction[], items: Deduction[], cap: number) {
  let used = 0;
  let dropped = 0;
  for (const item of items) {
    const points = Math.min(item.points, cap - used);
    if (points <= 0) {
      dropped++;
      continue;
    }
    used += points;
    out.push({ ...item, points });
  }
  if (dropped > 0) {
    out.push({
      points: 0,
      category: items[0].category,
      label: `${dropped} more not counted: this category is capped at ${cap} points`,
    });
  }
}

export function gradeSystem(system: WaterSystem, asOf: Date = new Date()): Grade {
  const deductions: Deduction[] = [];
  const notes: string[] = [];
  const cutoff = new Date(asOf);
  cutoff.setFullYear(cutoff.getFullYear() - RULES.windowYears);
  const since = cutoff.toISOString().slice(0, 10);
  const today = asOf.toISOString().slice(0, 10);
  const isOpen = (v: Violation) => v.status === "Addressed" || v.status === "Unaddressed";
  const recent = system.violations.filter((v) => v.begin && v.begin >= since && v.begin <= today);

  // 1. Health-based violations in the window (heaviest weight).
  addCapped(
    deductions,
    recent
      .filter((v) => v.health_based)
      .map((v) => ({
        points: RULES.healthViolation.points,
        category: "health" as const,
        label: `Health-based violation: ${describe(v)}`,
      })),
    RULES.healthViolation.cap,
  );

  // 2. Violations still open, whatever their age.
  addCapped(
    deductions,
    system.violations.filter(isOpen).map((v) => ({
      points: v.health_based ? RULES.openViolation.healthBased : RULES.openViolation.other,
      category: "open" as const,
      label: `Still unresolved: ${describe(v)}`,
    })),
    RULES.openViolation.cap,
  );

  // 3. Lead and copper.
  const periods = system.lead_copper; // newest first
  const latest = periods[0];
  if (!latest || latest.lead_ppb == null) {
    notes.push("No lead results on file with EPA for this system.");
  } else {
    const { actionLevelPpb, nearPpb } = RULES.lead;
    const when = `${year(latest.start)}–${year(latest.end)}`.replace(/^(\d{4})–\1$/, "$1");
    if (latest.lead_ppb > actionLevelPpb) {
      deductions.push({
        points: RULES.lead.aboveActionLevel,
        category: "lead",
        label: `Lead 90th percentile of ${latest.lead_ppb} ppb is above the ${actionLevelPpb} ppb action level (${when})`,
      });
    } else if (latest.lead_ppb > nearPpb) {
      deductions.push({
        points: RULES.lead.nearActionLevel,
        category: "lead",
        label: `Lead 90th percentile of ${latest.lead_ppb} ppb is within ${actionLevelPpb - nearPpb} ppb of the action level (${when})`,
      });
    }
    const earlier = periods
      .slice(1)
      .find((p) => p.end >= since && p.lead_ppb != null && p.lead_ppb > actionLevelPpb);
    if (earlier && latest.lead_ppb <= actionLevelPpb) {
      deductions.push({
        points: RULES.lead.earlierExceedance,
        category: "lead",
        label: `Earlier lead result of ${earlier.lead_ppb} ppb was above the action level (${year(earlier.end)})`,
      });
    }
  }
  const copper = periods.find((p) => p.copper_mgl != null && p.end >= since);
  if (copper && copper.copper_mgl! > RULES.copper.actionLevelMgl) {
    deductions.push({
      points: RULES.copper.aboveActionLevel,
      category: "copper",
      label: `Copper 90th percentile of ${copper.copper_mgl} mg/L is above the ${RULES.copper.actionLevelMgl} mg/L action level (${year(copper.end)})`,
    });
  }

  // 4. PFAS, against the federal limits.
  if (!system.pfas.sampled) {
    notes.push("This system was not part of EPA's 2023–2025 PFAS testing, so PFAS is not reflected in the grade.");
  } else {
    const items: Deduction[] = [];
    for (const c of system.pfas.chemicals) {
      const item = pfasDeduction(c);
      if (item) items.push(item);
    }
    const hi = system.pfas.max_hazard_index;
    if (hi != null && hi > 1) {
      items.push({
        points: RULES.pfas.hazardIndexAboveOne,
        category: "pfas",
        label: `PFAS mixture Hazard Index of ${hi} is above the limit of 1`,
      });
    }
    items.sort((a, b) => b.points - a.points);
    addCapped(deductions, items, RULES.pfas.cap);
  }

  // 5. Monitoring and reporting violations (light weight).
  const paperwork = recent.filter((v) => !v.health_based);
  if (paperwork.length > 0) {
    const points = Math.min(paperwork.length * RULES.monitoringViolation.points, RULES.monitoringViolation.cap);
    const n = paperwork.length;
    deductions.push({
      points,
      category: "monitoring",
      label: `${n} monitoring or reporting violation${n === 1 ? "" : "s"} since ${year(since)}`,
    });
  }

  const score = Math.max(0, 100 - deductions.reduce((sum, d) => sum + d.points, 0));
  const counts = {
    health: recent.filter((v) => v.health_based).length,
    monitoring: paperwork.length,
    open: system.violations.filter(isOpen).length,
  };
  return { score, letter: letterFor(score), deductions, notes, counts, since };
}

function pfasDeduction(c: PfasChemical): Deduction | null {
  if (c.mcl_ppt == null || c.detections === 0) return null;
  const limit = `${c.mcl_ppt} ppt federal limit`;
  if (c.max_location_avg_ppt > c.mcl_ppt) {
    return {
      points: RULES.pfas.averageAboveLimit,
      category: "pfas",
      label: `${c.name} averaged ${c.max_location_avg_ppt} ppt at one sampling location, above the ${limit}`,
    };
  }
  if (c.max_ppt > c.mcl_ppt) {
    return {
      points: RULES.pfas.singleResultAboveLimit,
      category: "pfas",
      label: `${c.name} result of ${c.max_ppt} ppt was above the ${limit} (the location's average was below it)`,
    };
  }
  return {
    points: RULES.pfas.detectedBelowLimit,
    category: "pfas",
    label: `${c.name} detected at up to ${c.max_ppt} ppt, below the ${limit}`,
  };
}
