import { describe, expect, it } from "vitest";
import fixtures from "./__fixtures__/zip77005.json";
import { gradeSystem, letterFor, RULES } from "./grade";
import type { Violation, WaterSystem } from "./types";

const AS_OF = new Date("2026-11-18T00:00:00Z");
const real = fixtures as unknown as Record<string, WaterSystem>;

function system(over: Partial<WaterSystem> = {}): WaterSystem {
  return {
    pwsid: "ZZ0000001", name: "TEST WATER", state: "TX", population: 1000, connections: 400,
    source: { code: "GW", label: "Ground water" }, owner: "Local government", wholesaler: false,
    contact: { phone: null, city: null }, counties: [], boundary: null, zips: [],
    violations: [],
    violation_counts: { total: 0, health_based: 0, open: 0, listed_since: "2021-11-18" },
    lead_copper: [{ start: "2025-01-01", end: "2025-12-31", lead_ppb: 2, copper_mgl: null }],
    pfas: { sampled: true, first_sample: "2023-01-01", last_sample: "2024-01-01", max_hazard_index: 0, chemicals: [] },
    lithium: null,
    ...over,
  };
}

function violation(over: Partial<Violation> = {}): Violation {
  return {
    id: "1", begin: "2024-03-01", status: "Resolved", health_based: true, category: "MCL",
    type: "Maximum Contaminant Level Violation, Monthly (TCR)", contaminant: "COLIFORM (TCR)", ...over,
  };
}

const total = (g: ReturnType<typeof gradeSystem>) => g.deductions.reduce((n, d) => n + d.points, 0);

describe("letterFor", () => {
  it("maps scores to letters at the boundaries", () => {
    expect([100, 97, 96, 93, 90, 89, 80, 77, 70, 60, 59, 0].map(letterFor)).toEqual(
      ["A+", "A+", "A", "A", "A-", "B+", "B-", "C+", "C-", "D-", "F", "F"]);
  });
});

describe("gradeSystem", () => {
  it("gives a clean system 100 with no deductions", () => {
    const g = gradeSystem(system(), AS_OF);
    expect(g).toMatchObject({ score: 100, letter: "A+", deductions: [], notes: [] });
  });

  it("score always equals 100 minus the visible deductions", () => {
    for (const s of Object.values(real)) {
      const g = gradeSystem(s, AS_OF);
      expect(g.score).toBe(Math.max(0, 100 - total(g)));
    }
  });

  it("deducts 15 for a health-based violation and names it", () => {
    const g = gradeSystem(system({ violations: [violation()] }), AS_OF);
    expect(g.score).toBe(85);
    expect(g.deductions[0]).toMatchObject({ points: 15, category: "health" });
    expect(g.deductions[0].label).toBe(
      "Health-based violation: Maximum Contaminant Level Violation, Monthly (TCR) (Coliform (TCR)), 2024");
  });

  it("ignores resolved violations older than five years", () => {
    const g = gradeSystem(system({ violations: [violation({ begin: "2021-11-17" })] }), AS_OF);
    expect(g.score).toBe(100);
  });

  it("caps health-based deductions and says how many were not counted", () => {
    const vs = Array.from({ length: 5 }, (_, i) => violation({ id: String(i) }));
    const g = gradeSystem(system({ violations: vs }), AS_OF);
    expect(g.score).toBe(100 - RULES.healthViolation.cap);
    expect(g.deductions.at(-1)).toMatchObject({ points: 0 });
    expect(g.deductions.at(-1)!.label).toContain("2 more not counted");
  });

  it("deducts again for an unresolved violation, even an old one", () => {
    const old = violation({ begin: "2015-01-01", status: "Unaddressed", health_based: false, category: "MR" });
    expect(gradeSystem(system({ violations: [old] }), AS_OF).score).toBe(95);
    const recent = violation({ status: "Addressed" });
    expect(gradeSystem(system({ violations: [recent] }), AS_OF).score).toBe(100 - 15 - 10);
  });

  it("weights monitoring violations lightly and caps them", () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) =>
      violation({ id: String(i), health_based: false, category: "MON" }));
    expect(gradeSystem(system({ violations: mk(1) }), AS_OF).score).toBe(98);
    expect(gradeSystem(system({ violations: mk(30) }), AS_OF).score).toBe(90);
  });

  it("grades lead against the 15 ppb action level", () => {
    const lead = (ppb: number) => gradeSystem(
      system({ lead_copper: [{ start: "2025-01-01", end: "2025-12-31", lead_ppb: ppb, copper_mgl: null }] }), AS_OF);
    expect(lead(15).score).toBe(92); // not above the action level, but near it
    expect(lead(10).score).toBe(100);
    expect(lead(15.1).score).toBe(80);
    expect(lead(15.1).deductions[0].label).toContain("above the 15 ppb action level (2025)");
  });

  it("counts an earlier lead exceedance only when the latest result is fine", () => {
    const periods = [
      { start: "2026-01-01", end: "2026-06-30", lead_ppb: 3, copper_mgl: null },
      { start: "2023-01-01", end: "2025-12-31", lead_ppb: 22, copper_mgl: null },
    ];
    expect(gradeSystem(system({ lead_copper: periods }), AS_OF).score).toBe(92);
    periods[0].lead_ppb = 18;
    expect(gradeSystem(system({ lead_copper: periods }), AS_OF).score).toBe(80);
  });

  it("notes missing lead data without deducting", () => {
    const g = gradeSystem(system({ lead_copper: [] }), AS_OF);
    expect(g.score).toBe(100);
    expect(g.notes[0]).toContain("No lead results");
  });

  it("separates PFAS averages above the limit, single results above it, and detections below it", () => {
    const chem = (max: number, avg: number) => ({
      name: "PFOS", samples: 8, detections: max > 0 ? 3 : 0, max_ppt: max, max_location_avg_ppt: avg,
      reporting_limit_ppt: 4, mcl_ppt: 4, proposed_rescission: false,
    });
    const pfas = (max: number, avg: number) => gradeSystem(system({
      pfas: { sampled: true, first_sample: null, last_sample: null, max_hazard_index: 0, chemicals: [chem(max, avg)] },
    }), AS_OF).score;
    expect(pfas(0, 0)).toBe(100);
    expect(pfas(4, 2)).toBe(98);
    expect(pfas(5.4, 2.7)).toBe(93);
    expect(pfas(9, 6)).toBe(85);
  });

  it("ignores unregulated PFAS and caps the PFAS total", () => {
    const names = ["PFOA", "PFOS", "PFHxS", "PFNA"];
    const chemicals = names.map((name) => ({
      name, samples: 4, detections: 4, max_ppt: 50, max_location_avg_ppt: 40, reporting_limit_ppt: 4, mcl_ppt: 4,
    }));
    chemicals.push({ name: "PFBA", samples: 4, detections: 4, max_ppt: 99, max_location_avg_ppt: 99, reporting_limit_ppt: 5 } as never);
    const g = gradeSystem(system({
      pfas: { sampled: true, first_sample: null, last_sample: null, max_hazard_index: 3, chemicals },
    }), AS_OF);
    expect(g.score).toBe(100 - RULES.pfas.cap);
    expect(g.deductions.some((d) => d.label.includes("PFBA"))).toBe(false);
  });

  it("does not treat untested PFAS as clean or dirty", () => {
    const g = gradeSystem(system({ pfas: { sampled: false } }), AS_OF);
    expect(g.score).toBe(100);
    expect(g.notes[0]).toContain("not part of EPA's 2023–2025 PFAS testing");
  });

  it("never goes below zero", () => {
    const vs = [
      ...Array.from({ length: 9 }, (_, i) => violation({ id: `h${i}`, status: "Unaddressed" })),
      ...Array.from({ length: 9 }, (_, i) => violation({ id: `m${i}`, health_based: false })),
    ];
    const g = gradeSystem(system({
      violations: vs,
      lead_copper: [{ start: null, end: "2025-12-31", lead_ppb: 40, copper_mgl: 2 }],
      pfas: { sampled: true, first_sample: null, last_sample: null, max_hazard_index: 5, chemicals: [
        { name: "PFOA", samples: 1, detections: 1, max_ppt: 9, max_location_avg_ppt: 9, reporting_limit_ppt: 4, mcl_ppt: 4 },
        { name: "PFOS", samples: 1, detections: 1, max_ppt: 9, max_location_avg_ppt: 9, reporting_limit_ppt: 4, mcl_ppt: 4 },
      ] },
    }), AS_OF);
    expect(g.score).toBe(0);
    expect(g.letter).toBe("F");
  });
});

describe("real records for ZIP 77005 (SDWIS 2026Q3)", () => {
  const grade = (id: string) => gradeSystem(real[id], AS_OF);

  it("City of Houston: one resolved turbidity violation", () => {
    const g = grade("TX1010013");
    expect(g).toMatchObject({ score: 85, letter: "B" });
    expect(g.deductions.map((d) => d.category)).toEqual(["health"]);
  });

  it("City of West University Place: two open violations and a PFOS result above 4 ppt", () => {
    const g = grade("TX1010027");
    expect(g).toMatchObject({ score: 77, letter: "C+" });
    expect(g.deductions.map((d) => [d.category, d.points])).toEqual(
      [["open", 5], ["open", 5], ["pfas", 7], ["pfas", 2], ["monitoring", 4]]);
  });

  it("Rice University: E. coli and lead-rule violations, earlier lead and copper exceedances", () => {
    const g = grade("TX1010908");
    expect(g).toMatchObject({ score: 30, letter: "F" });
    expect(g.deductions.filter((d) => d.category === "health").reduce((n, d) => n + d.points, 0)).toBe(45);
    expect(g.deductions.find((d) => d.category === "lead")!.label).toContain("20.1 ppb");
    expect(g.deductions.find((d) => d.category === "copper")!.points).toBe(5);
  });

  it("City of Southside Place: nothing on record, PFAS untested", () => {
    const g = grade("TX1010023");
    expect(g).toMatchObject({ score: 100, letter: "A+", deductions: [] });
    expect(g.notes).toHaveLength(1);
  });
});
