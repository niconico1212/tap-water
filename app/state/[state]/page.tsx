import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStateCities, getStateSystems } from "@/lib/data";
import { formatNumber, STATE_NAMES, titleCase } from "@/lib/text";

export const revalidate = 86400;
export const dynamicParams = true;
export const generateStaticParams = () => Object.keys(STATE_NAMES).map((s) => ({ state: s.toLowerCase() }));

const MAX_LISTED = 400;
type Props = { params: Promise<{ state: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params;
  const name = STATE_NAMES[state.toUpperCase()];
  if (!name) return {};
  return {
    title: `${name} tap water quality by city and water system`,
    description: `Report cards for every community water system in ${name}: violations, lead and PFAS results from EPA data.`,
    alternates: { canonical: `/state/${state}` },
  };
}

export default async function StatePage({ params }: Props) {
  const { state } = await params;
  const code = state.toUpperCase();
  const name = STATE_NAMES[code];
  const systems = name && state === state.toLowerCase() ? await getStateSystems(code) : null;
  if (!name || !systems) notFound();
  const cities = (await getStateCities(code)).sort((a, b) => b.population - a.population || a.city.localeCompare(b.city));
  return (
    <div className="pt-6">
      <h1 className="text-3xl font-bold">{name} tap water</h1>
      <p className="mt-3 text-muted">
        {formatNumber(systems.length)} community water systems report to EPA in {name}.
      </p>
      <h2 className="mt-8 text-xl font-bold">Cities</h2>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {cities.slice(0, 150).map((c) => (
          <li key={c.slug}>
            <Link className="link" href={`/water/${c.slug}`}>
              {c.city}
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-xl font-bold">Water systems, largest first</h2>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface text-sm">
        {systems.slice(0, MAX_LISTED).map((s) => (
          <li key={s.pwsid} className="flex justify-between gap-4 px-4 py-2">
            <Link className="link" href={`/system/${s.pwsid}`}>
              {titleCase(s.name)}
            </Link>
            <span className="shrink-0 text-muted">{formatNumber(s.population)} people</span>
          </li>
        ))}
      </ul>
      {systems.length > MAX_LISTED && (
        <p className="mt-3 text-sm text-muted">
          Showing the {MAX_LISTED} largest of {formatNumber(systems.length)} systems. Enter a ZIP code on the home page
          to find a smaller one.
        </p>
      )}
    </div>
  );
}
