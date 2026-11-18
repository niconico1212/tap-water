import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GradeCard, ReportBody } from "@/components/Report";
import { ZipForm } from "@/components/ZipForm";
import { getCity, getSystem, getTopCities } from "@/lib/data";
import { gradeSystem } from "@/lib/grade";
import { STATE_NAMES, titleCase } from "@/lib/text";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getTopCities()).map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const city = await getCity(slug);
  const system = city ? await getSystem(city.pwsid) : null;
  return city && system ? { city, system, grade: gradeSystem(system) } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return {};
  const { city, system, grade } = data;
  return {
    title: `${city.city}, ${city.state} tap water quality: grade ${grade.letter}`,
    description: `Is there lead or PFAS in ${city.city} tap water? See ${titleCase(system.name)}'s violations, test results and ${grade.letter} grade, based on EPA data.`,
    alternates: { canonical: `/water/${slug}` },
    openGraph: { images: [`/share/${system.pwsid}?city=${slug}&format=og`] },
  };
}

export default async function CityPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { city, system, grade } = data;
  const state = STATE_NAMES[city.state] ?? city.state;
  return (
    <div className="pt-2">
      <p className="mb-3 text-sm text-muted">
        <Link className="link" href={`/state/${city.state.toLowerCase()}`}>
          {state}
        </Link>{" "}
        · {city.city} tap water
      </p>
      <GradeCard system={system} grade={grade} place={`${city.city}, ${city.state}`} shareUrl={`/water/${slug}`} />
      <p className="mt-3 text-sm text-muted">
        {titleCase(system.name)} is the main water system for {city.city}. Parts of the city may be served by other
        systems; enter your ZIP code to check.
      </p>
      <div className="mt-3 max-w-sm">
        <ZipForm size="sm" />
      </div>
      <ReportBody system={system} grade={grade} />
      <section className="mt-10">
        <h2 className="text-xl font-bold">{city.city} ZIP codes</h2>
        <p className="mt-3 text-sm leading-7">
          {city.zips.map((z, i) => (
            <span key={z}>
              {i > 0 && ", "}
              <Link className="link" href={`/zip/${z}`}>
                {z}
              </Link>
            </span>
          ))}
        </p>
      </section>
    </div>
  );
}
