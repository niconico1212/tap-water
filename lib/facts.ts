import { RULES, type Grade } from "./grade";
import type { WaterSystem } from "./types";

/** Two or three short, factual lines for the grade card and share image. */
export function keyFacts(system: WaterSystem, grade: Grade): string[] {
  const facts: string[] = [];
  const health = grade.counts.health;
  facts.push(
    health === 0
      ? `No health-based violations in ${RULES.windowYears} years`
      : `${health} health-based violation${health === 1 ? "" : "s"} in ${RULES.windowYears} years`,
  );
  const lead = system.lead_copper[0]?.lead_ppb;
  facts.push(lead == null ? "Lead: no results on file" : `Lead: ${lead} ppb (action level ${RULES.lead.actionLevelPpb})`);
  if (!system.pfas.sampled) {
    facts.push("PFAS: no EPA test data");
  } else {
    const regulated = system.pfas.chemicals.filter((c) => c.mcl_ppt != null);
    const above = regulated.filter((c) => c.max_ppt > c.mcl_ppt!);
    const found = regulated.filter((c) => c.detections > 0);
    facts.push(
      above.length > 0
        ? `PFAS: ${above.map((c) => c.name).join(", ")} result above federal limit`
        : found.length > 0
          ? "PFAS: detected, below federal limits"
          : "PFAS: no regulated PFAS detected",
    );
  }
  return facts;
}

export type Tone = "good" | "ok" | "warn" | "bad";

export function gradeTone(letter: string): Tone {
  const l = letter[0];
  return l === "A" ? "good" : l === "B" ? "ok" : l === "C" ? "warn" : "bad";
}

/** Hex colours, shared by the CSS-free share image. */
export const TONE_HEX: Record<Tone, string> = {
  good: "#15803d",
  ok: "#0e7490",
  warn: "#b45309",
  bad: "#b91c1c",
};
