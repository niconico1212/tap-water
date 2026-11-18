import type { Metadata } from "next";
import { getMeta } from "@/lib/data";
import { LETTERS, RULES } from "@/lib/grade";
import { DISCLAIMER, LINKS } from "@/lib/site";
import { formatDate, formatNumber } from "@/lib/text";

export const metadata: Metadata = {
  title: "How the water grades are calculated",
  description: "The full scoring method behind every letter grade: what counts, how many points, and where the data comes from.",
  alternates: { canonical: "/methodology" },
};

const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="mt-10 text-xl font-bold">{children}</h2>;

export default async function Methodology() {
  const meta = await getMeta();
  const r = RULES;
  const rows: [string, string, string][] = [
    [
      "Health-based violations",
      `−${r.healthViolation.points} each, up to −${r.healthViolation.cap}`,
      `A contaminant limit or required treatment step was not met, with the violation starting in the last ${r.windowYears} years. This carries the most weight.`,
    ],
    [
      "Unresolved violations",
      `−${r.openViolation.healthBased} each if health-based, −${r.openViolation.other} otherwise, up to −${r.openViolation.cap}`,
      "Any violation EPA still lists as not returned to compliance, however old. This is on top of the deduction for the violation itself.",
    ],
    [
      "Lead",
      `−${r.lead.aboveActionLevel} above ${r.lead.actionLevelPpb} ppb; −${r.lead.nearActionLevel} above ${r.lead.nearPpb} ppb; −${r.lead.earlierExceedance} for an earlier exceedance`,
      `Based on the most recent 90th percentile result from home tap sampling, compared with EPA's ${r.lead.actionLevelPpb} ppb action level. If the latest result is fine but an earlier one in the last ${r.windowYears} years was above the action level, a smaller deduction applies.`,
    ],
    [
      "Copper",
      `−${r.copper.aboveActionLevel} above ${r.copper.actionLevelMgl} mg/L`,
      "Most recent 90th percentile copper result against EPA's action level.",
    ],
    [
      "PFAS",
      `−${r.pfas.averageAboveLimit} per chemical averaging above its limit; −${r.pfas.singleResultAboveLimit} for a single result above; −${r.pfas.detectedBelowLimit} if detected below; −${r.pfas.hazardIndexAboveOne} for a Hazard Index above 1; up to −${r.pfas.cap}`,
      "Results from EPA's 2023–2025 national testing (UCMR 5), compared with the federal limits set in 2024. Only the PFAS that have a federal limit count.",
    ],
    [
      "Monitoring and reporting violations",
      `−${r.monitoringViolation.points} each, up to −${r.monitoringViolation.cap}`,
      `A required test or report was late or missing in the last ${r.windowYears} years. Light weight, because it says nothing about what was in the water.`,
    ],
  ];
  return (
    <article className="pt-6 leading-relaxed">
      <h1 className="text-3xl font-bold">How the grades are calculated</h1>
      <p className="mt-4 rounded-xl border border-line bg-surface p-4 font-medium">
        {DISCLAIMER} A grade summarises a utility&apos;s compliance record. It cannot tell you what is coming out of
        your own tap, and it is not a statement about whether water is fit to drink.
      </p>

      <H2>The score</H2>
      <p className="mt-3">
        Every water system starts at 100. Points are taken off using the table below, and each deduction is listed on
        the system&apos;s page with the specific record behind it. The score cannot go below zero.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">What</th>
              <th className="px-4 py-2 font-medium">Points</th>
              <th className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {rows.map(([what, points, detail]) => (
              <tr key={what}>
                <td className="px-4 py-3 font-semibold">{what}</td>
                <td className="px-4 py-3 whitespace-normal">{points}</td>
                <td className="px-4 py-3">{detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Letter grades</H2>
      <ul className="mt-3 grid grid-cols-3 gap-2 text-sm sm:grid-cols-5">
        {LETTERS.map(([min, letter], i) => (
          <li key={letter} className="rounded-lg border border-line bg-surface px-3 py-2">
            <strong>{letter}</strong>{" "}
            <span className="text-muted">
              {min}–{i === 0 ? 100 : LETTERS[i - 1][0] - 1}
            </span>
          </li>
        ))}
      </ul>

      <H2>What the grade leaves out</H2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <strong>Untested PFAS.</strong> EPA&apos;s PFAS testing covered large systems and a sample of small ones
          {meta ? ` (${formatNumber(meta.counts.systems_with_pfas_data)} of ${formatNumber(meta.counts.systems)} systems here)` : ""}.
          A system that was not tested loses no points for PFAS, and its page says so.
        </li>
        <li>
          <strong>Contaminants below legal limits.</strong> Routine test results that met the limits are not in the
          federal data used here. Your utility&apos;s Consumer Confidence Report has them.
        </li>
        <li>
          <strong>Your home&apos;s plumbing.</strong> Lead mostly comes from service lines and fixtures, so two homes
          on the same system can differ.
        </li>
        <li>
          <strong>Private wells.</strong> They are not regulated by EPA and are not in this data.{" "}
          <a className="link" href={LINKS.stateWellPrograms}>
            State well testing programs
          </a>
        </li>
      </ul>

      <H2>PFAS limits and their legal status</H2>
      <p className="mt-3">
        The benchmarks are the limits EPA finalised in April 2024: 4 parts per trillion for PFOA and PFOS, 10 ppt for
        PFHxS, PFNA and HFPO-DA (GenX), and a Hazard Index of 1 for mixtures. In May 2026 EPA proposed keeping the
        PFOA and PFOS limits and withdrawing the others. Until a final rule changes them, the 2024 limits are the ones
        in force and the ones used here. Utilities are not required to meet them before 2029, and compliance is
        judged on a yearly average, so a result above a limit is not a violation.{" "}
        <a className="link" href={LINKS.pfasRule}>
          EPA&apos;s current PFAS page
        </a>
      </p>

      <H2>Matching ZIP codes to water systems</H2>
      <p className="mt-3">
        ZIP codes and water systems don&apos;t line up. We overlay EPA&apos;s map of water system service areas on
        Census ZIP code areas and list every system that covers a meaningful part of the ZIP, largest share first. If
        the map has nothing, we use ZIP codes the utility reported itself, and as a last resort the largest systems in
        the county, clearly labelled. Some service-area boundaries are estimates. Your water bill is the final word on
        who supplies you.
      </p>

      <H2>Data sources</H2>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>
          EPA Safe Drinking Water Information System, via ECHO bulk downloads
          {meta?.sources.sdwis ? ` (data as of ${formatDate(meta.sources.sdwis)})` : ""}: systems, violations,
          enforcement, lead and copper.
        </li>
        <li>EPA Fifth Unregulated Contaminant Monitoring Rule (UCMR 5): PFAS and lithium.</li>
        <li>EPA Community Water System Service Area Boundaries.</li>
        <li>U.S. Census Bureau ZIP Code Tabulation Areas; GeoNames postal codes (CC BY 4.0) for place names.</li>
      </ul>
      <p className="mt-3 text-sm text-muted">
        Data is refreshed weekly; EPA updates its national files quarterly, so a recent violation can take months to
        appear. Only active community water systems are included. Spotted an error? EPA&apos;s record for each system
        is linked from its page.
      </p>
    </article>
  );
}
