import Link from "next/link";
import { gradeTone, keyFacts } from "@/lib/facts";
import { RULES, type Grade } from "@/lib/grade";
import { DISCLAIMER, LINKS, SITE_URL } from "@/lib/site";
import { formatDate, formatNumber, STATE_NAMES, tidy, titleCase } from "@/lib/text";
import type { Violation, WaterSystem } from "@/lib/types";
import { AdSlot } from "./AdSlot";
import { ShareButtons } from "./ShareButtons";

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

export function GradeBadge({ letter, size = "md" }: { letter: string; size?: "md" | "lg" }) {
  return (
    <span
      className={`tone-${gradeTone(letter)} inline-flex shrink-0 items-center justify-center rounded-2xl bg-[var(--tone-bg)] font-black text-[var(--tone)] ${
        size === "lg" ? "h-32 w-32 text-7xl sm:h-36 sm:w-36" : "h-12 w-12 text-xl"
      }`}
      aria-label={`Grade ${letter}`}
    >
      {letter}
    </span>
  );
}

export function GradeCard({
  system,
  grade,
  place,
  shareUrl,
  zip,
}: {
  system: WaterSystem;
  grade: Grade;
  place?: string | null;
  shareUrl: string;
  zip?: string;
}) {
  const name = titleCase(system.name);
  const imageUrl = `/share/${system.pwsid}${zip ? `?zip=${zip}` : ""}`;
  const where = place ?? (system.contact.city ? `${system.contact.city}, ${system.state}` : STATE_NAMES[system.state]);
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
      <div className="flex items-center gap-5">
        <GradeBadge letter={grade.letter} size="lg" />
        <div className="min-w-0">
          {where && <p className="text-sm font-medium text-muted">{where}</p>}
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{name}</h1>
          <p className="mt-1 text-sm text-muted">
            Score {grade.score} out of 100 · serves about {formatNumber(system.population)} people
          </p>
        </div>
      </div>
      <ul className="mt-5 grid gap-2 sm:grid-cols-3">
        {keyFacts(system, grade).map((fact) => (
          <li key={fact} className="rounded-lg bg-bg px-3 py-2 text-sm font-medium">
            {fact}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">
        {DISCLAIMER}{" "}
        <Link href="/methodology" className="link">
          How grades work
        </Link>
      </p>
      <div className="mt-4">
        <ShareButtons
          url={`${SITE_URL}${shareUrl}`}
          imageUrl={imageUrl}
          text={`${where ? `${where.split(",")[0]}'s water` : name} got a ${grade.letter}. Check yours.`}
        />
      </div>
    </div>
  );
}

export function Deductions({ grade }: { grade: Grade }) {
  return (
    <Section id="grade" title="How this grade was calculated">
      <p>
        Every system starts at 100. Points come off for what EPA&apos;s records show over the last{" "}
        {RULES.windowYears} years.
      </p>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        <li className="flex gap-4 px-4 py-3">
          <span className="w-12 shrink-0 text-right font-mono font-semibold">100</span>
          <span>Starting score</span>
        </li>
        {grade.deductions.map((d, i) => (
          <li key={i} className="flex gap-4 px-4 py-3">
            <span className="w-12 shrink-0 text-right font-mono font-semibold text-[var(--bad)]">
              {d.points > 0 ? `−${d.points}` : ""}
            </span>
            <span className={d.points === 0 ? "text-muted" : ""}>{d.label}</span>
          </li>
        ))}
        {grade.deductions.length === 0 && (
          <li className="flex gap-4 px-4 py-3 text-muted">
            <span className="w-12 shrink-0" />
            <span>No deductions.</span>
          </li>
        )}
        <li className="flex gap-4 px-4 py-3 font-bold">
          <span className="w-12 shrink-0 text-right font-mono">{grade.score}</span>
          <span>Final score: {grade.letter}</span>
        </li>
      </ul>
      {grade.notes.map((note) => (
        <p key={note} className="text-sm text-muted">
          Note: {note}
        </p>
      ))}
    </Section>
  );
}

function statusText(v: Violation): string {
  switch (v.status) {
    case "Resolved":
      return v.resolved_on ? `Resolved ${formatDate(v.resolved_on)}` : "Resolved";
    case "Addressed":
      return "Not yet resolved; formal enforcement is under way";
    case "Unaddressed":
      return "Not yet resolved";
    case "Archived":
      return "Archived by EPA";
    default:
      return "Status not reported";
  }
}

function ViolationItem({ v }: { v: Violation }) {
  const open = v.status === "Addressed" || v.status === "Unaddressed";
  const subject = v.contaminant ?? v.rule;
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <p className="font-semibold">{tidy(v.type)}</p>
        <p className="text-sm text-muted">{formatDate(v.begin)}</p>
      </div>
      <p className="text-sm text-muted">
        {subject ? `${tidy(subject)} · ` : ""}
        {v.health_based ? "Health-based" : "Monitoring or reporting"} ·{" "}
        <span className={open ? "font-semibold text-[var(--bad)]" : ""}>{statusText(v)}</span>
      </p>
    </li>
  );
}

export function Violations({ system, grade }: { system: WaterSystem; grade: Grade }) {
  const { health, monitoring, open } = grade.counts;
  const inWindow = system.violations.filter((v) => (v.begin ?? "") >= grade.since);
  const older = system.violations.filter((v) => (v.begin ?? "") < grade.since);
  const sorted = [...inWindow].sort((a, b) => Number(b.health_based) - Number(a.health_based));
  const first = sorted.slice(0, 8);
  const rest = [...sorted.slice(8), ...older];
  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;
  return (
    <Section id="violations" title="Violations">
      <p>
        {health + monitoring === 0
          ? `EPA records show no violations for this system in the last ${RULES.windowYears} years.`
          : `In the last ${RULES.windowYears} years EPA records show ${plural(health, "health-based violation")} and ${plural(monitoring, "monitoring or reporting violation")}.`}{" "}
        {open > 0 && `${plural(open, "violation")} ${open === 1 ? "is" : "are"} still listed as unresolved. `}
        Since records began, the system has had {plural(system.violation_counts.total, "violation")} in total,{" "}
        {system.violation_counts.health_based} of them health-based.
      </p>
      <p className="text-sm text-muted">
        A health-based violation means a contaminant limit or a required treatment step was not met. A monitoring or
        reporting violation means a test or a report was late or missing; it says nothing about what was in the water.
      </p>
      {first.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {first.map((v) => (
            <ViolationItem key={v.id} v={v} />
          ))}
        </ul>
      )}
      {rest.length > 0 && (
        <details className="rounded-xl border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 font-medium">Show {rest.length} more</summary>
          <ul className="divide-y divide-line border-t border-line">
            {rest.map((v) => (
              <ViolationItem key={v.id} v={v} />
            ))}
          </ul>
        </details>
      )}
    </Section>
  );
}

function Meter({ value, limit, unit }: { value: number; limit: number; unit: string }) {
  const max = Math.max(limit * 1.5, value * 1.1);
  const over = value > limit;
  return (
    <div className={over ? "tone-bad" : "tone-good"}>
      <div className="relative h-3 overflow-hidden rounded-full bg-bg">
        <div className="h-full rounded-full bg-[var(--tone)]" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
      </div>
      <div className="relative h-5 text-xs text-muted">
        <span className="absolute -top-4 h-4 w-0.5 bg-[var(--ink)]" style={{ left: `${(limit / max) * 100}%` }} />
        <span className="absolute -translate-x-1/2" style={{ left: `${(limit / max) * 100}%` }}>
          {limit} {unit}
        </span>
      </div>
    </div>
  );
}

export function LeadCopper({ system }: { system: WaterSystem }) {
  const periods = system.lead_copper;
  const latest = periods[0];
  const range = (p: (typeof periods)[number]) =>
    p.start ? `${formatDate(p.start)} to ${formatDate(p.end)}` : `Ending ${formatDate(p.end)}`;
  return (
    <Section id="lead" title="Lead & copper">
      {!latest || latest.lead_ppb == null ? (
        <p>EPA has no lead sampling results on file for this system.</p>
      ) : (
        <>
          <p>
            In the most recent round of home tap sampling, the 90th percentile lead level was{" "}
            <strong>{latest.lead_ppb} ppb</strong>. That means 9 out of 10 homes tested were at or below that level.
            EPA&apos;s action level is {RULES.lead.actionLevelPpb} ppb; above it, a utility has to take steps to reduce
            lead.
          </p>
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="mb-2 text-sm font-medium">
              Lead, {range(latest)}: {latest.lead_ppb} ppb
            </p>
            <Meter value={latest.lead_ppb} limit={RULES.lead.actionLevelPpb} unit="ppb action level" />
          </div>
        </>
      )}
      {periods.length > 1 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Sampling period</th>
                <th className="px-4 py-2 font-medium">Lead (ppb)</th>
                <th className="px-4 py-2 font-medium">Copper (mg/L)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {periods.slice(0, 6).map((p) => (
                <tr key={`${p.start}-${p.end}`}>
                  <td className="px-4 py-2">{range(p)}</td>
                  <td className={`px-4 py-2 ${(p.lead_ppb ?? 0) > RULES.lead.actionLevelPpb ? "font-bold text-[var(--bad)]" : ""}`}>
                    {p.lead_ppb ?? "–"}
                  </td>
                  <td className={`px-4 py-2 ${(p.copper_mgl ?? 0) > RULES.copper.actionLevelMgl ? "font-bold text-[var(--bad)]" : ""}`}>
                    {p.copper_mgl ?? "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-muted">
        Lead usually comes from pipes and fixtures between the water main and the tap, so levels differ from home to
        home. These numbers describe the homes the utility sampled, not yours. The copper action level is{" "}
        {RULES.copper.actionLevelMgl} mg/L; EPA&apos;s data often lists copper only when it was reported.{" "}
        <a className="link" href={LINKS.lead}>
          EPA: lead in drinking water
        </a>
      </p>
    </Section>
  );
}

export function PfasSection({ system }: { system: WaterSystem }) {
  const pfas = system.pfas;
  if (!pfas.sampled) {
    return (
      <Section id="pfas" title="PFAS (“forever chemicals”)">
        <p>
          This system was not part of EPA&apos;s 2023–2025 national PFAS testing (UCMR 5), which covered all large
          systems and only a sample of small ones. That means there is no EPA result to show. It does not mean PFAS
          were looked for and not found.
        </p>
        <p className="text-sm text-muted">
          Your utility&apos;s Consumer Confidence Report or your state drinking water agency may have newer PFAS
          results.
        </p>
      </Section>
    );
  }
  const regulated = pfas.chemicals.filter((c) => c.mcl_ppt != null);
  const others = pfas.chemicals.filter((c) => c.mcl_ppt == null);
  const above = regulated.filter((c) => c.max_ppt > c.mcl_ppt!);
  const found = regulated.filter((c) => c.detections > 0);
  return (
    <Section id="pfas" title="PFAS (“forever chemicals”)">
      <p>
        This system was tested for 29 PFAS under EPA&apos;s national monitoring program (UCMR 5) between{" "}
        {formatDate(pfas.first_sample)} and {formatDate(pfas.last_sample)}.{" "}
        {above.length > 0
          ? `At least one result for ${above.map((c) => c.name).join(" and ")} was above the federal limit.`
          : found.length > 0
            ? "Some regulated PFAS were detected, all below the federal limits."
            : "None of the PFAS that have federal limits were detected."}
      </p>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Chemical</th>
              <th className="px-4 py-2 font-medium">Highest result</th>
              <th className="px-4 py-2 font-medium">Highest location average</th>
              <th className="px-4 py-2 font-medium">Federal limit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {regulated.map((c) => (
              <tr key={c.name}>
                <td className="px-4 py-2 font-medium">
                  {c.name}
                  {c.proposed_rescission ? " *" : ""}
                </td>
                <td className={`px-4 py-2 ${c.max_ppt > c.mcl_ppt! ? "font-bold text-[var(--bad)]" : ""}`}>
                  {c.detections ? `${c.max_ppt} ppt` : "Not detected"}
                </td>
                <td className={`px-4 py-2 ${c.max_location_avg_ppt > c.mcl_ppt! ? "font-bold text-[var(--bad)]" : ""}`}>
                  {c.detections ? `${c.max_location_avg_ppt} ppt` : "–"}
                </td>
                <td className="px-4 py-2">{c.mcl_ppt} ppt</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">
        A result above a limit is not a violation. The limits apply to a yearly average, and utilities do not have to
        meet them until 2029 at the earliest. * In May 2026 EPA proposed withdrawing the limits for PFHxS, PFNA and
        HFPO-DA (GenX) while keeping PFOA and PFOS at 4 ppt; the 2024 limits shown here remain in effect until a final
        rule says otherwise.{" "}
        <a className="link" href={LINKS.pfasRule}>
          EPA: PFAS rule status
        </a>
      </p>
      {others.length > 0 && (
        <p className="text-sm">
          Also detected, with no federal limit: {others.map((c) => `${c.name} (up to ${c.max_ppt} ppt)`).join(", ")}.
        </p>
      )}
      {system.lithium && system.lithium.detections > 0 && (
        <p className="text-sm">
          The same testing found lithium at up to {system.lithium.max_ugl} µg/L. Lithium has no federal limit; EPA
          uses a health reference level of 10 µg/L to decide what to study further.
        </p>
      )}
    </Section>
  );
}

export function WhatYouCanDo({ system }: { system: WaterSystem }) {
  return (
    <Section id="next" title="What you can do">
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Read your utility&apos;s annual water quality report.</strong> Every community water system must
          publish a Consumer Confidence Report by July 1 each year.{" "}
          <a className="link" href={LINKS.ccrSearch}>
            Find it on EPA&apos;s site
          </a>{" "}
          or{" "}
          <a className="link" href={LINKS.ccr}>
            learn how to read one
          </a>
          .
        </li>
        <li>
          <strong>Ask the utility.</strong>{" "}
          {system.contact.phone
            ? `${titleCase(system.name)} lists ${system.contact.phone} with EPA.`
            : "The number is on your water bill."}{" "}
          They can tell you whether your address has a lead service line.
        </li>
        <li>
          <strong>If you want a filter for lead,</strong> look for one certified to NSF/ANSI Standard 53 for lead
          reduction (or Standard 58 for reverse osmosis systems). Check that the packaging names lead specifically.
        </li>
        <li>
          <strong>If you want a filter for PFAS,</strong> look for certification to NSF/ANSI Standard 53 or Standard
          58 with a PFAS reduction claim. Not every certified filter covers PFAS.{" "}
          <a className="link" href={LINKS.pfasFilters}>
            EPA&apos;s guide to PFAS filters
          </a>
        </li>
        <li>
          <strong>Have a question about drinking water rules?</strong> EPA&apos;s Safe Drinking Water Hotline is
          800-426-4791.{" "}
          <a className="link" href={LINKS.hotline}>
            Hotline details
          </a>
        </li>
      </ul>
    </Section>
  );
}

export function SystemFacts({ system }: { system: WaterSystem }) {
  const rows: [string, React.ReactNode][] = [
    ["EPA system ID", system.pwsid],
    ["People served", formatNumber(system.population)],
    ["Water source", system.source.label ?? "Not reported"],
    ["Owner", system.owner ?? "Not reported"],
    ["Counties served", system.counties.join(", ") || "Not reported"],
  ];
  return (
    <Section id="about" title="About this water system">
      <dl className="grid gap-x-6 gap-y-2 rounded-xl border border-line bg-surface p-4 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {system.zips.length > 0 && (
        <p className="text-sm">
          ZIP codes:{" "}
          {system.zips.slice(0, 60).map((z, i) => (
            <span key={z}>
              {i > 0 && ", "}
              <Link className="link" href={`/zip/${z}`}>
                {z}
              </Link>
            </span>
          ))}
          {system.zips.length > 60 && ` and ${system.zips.length - 60} more`}
        </p>
      )}
      <p className="text-sm">
        <a className="link" href={LINKS.facilityReport(system.pwsid)}>
          See EPA&apos;s own record for this system
        </a>
      </p>
    </Section>
  );
}

/** Everything below the grade card, shared by ZIP, system and city pages. */
export function ReportBody({ system, grade }: { system: WaterSystem; grade: Grade }) {
  return (
    <>
      <Deductions grade={grade} />
      <Violations system={system} grade={grade} />
      <AdSlot id="report-mid" />
      <LeadCopper system={system} />
      <PfasSection system={system} />
      <WhatYouCanDo system={system} />
      <SystemFacts system={system} />
      <AdSlot id="report-end" />
    </>
  );
}

export function SystemCard({
  system,
  grade,
  note,
}: {
  system: WaterSystem;
  grade: Grade;
  note?: string;
}) {
  return (
    <Link
      href={`/system/${system.pwsid}`}
      className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 hover:border-accent"
    >
      <GradeBadge letter={grade.letter} />
      <span className="min-w-0">
        <span className="block font-semibold">{titleCase(system.name)}</span>
        <span className="block text-sm text-muted">
          Serves about {formatNumber(system.population)} people{note ? ` · ${note}` : ""}
        </span>
      </span>
    </Link>
  );
}
