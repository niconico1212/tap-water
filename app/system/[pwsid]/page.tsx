import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GradeCard, ReportBody } from "@/components/Report";
import { ZipForm } from "@/components/ZipForm";
import { getSystem, getTopCities } from "@/lib/data";
import { gradeSystem } from "@/lib/grade";
import { STATE_NAMES, titleCase } from "@/lib/text";

export const revalidate = 86400;
export const dynamicParams = true;

// Pre-render the systems behind the biggest cities; the rest render on first visit.
export async function generateStaticParams() {
  return (await getTopCities()).slice(0, 200).map((c) => ({ pwsid: c.pwsid }));
}

type Props = { params: Promise<{ pwsid: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pwsid } = await params;
  const system = await getSystem(pwsid);
  if (!system) return {};
  const grade = gradeSystem(system);
  const name = titleCase(system.name);
  return {
    title: `${name} water quality: grade ${grade.letter}`,
    description: `${name} (${STATE_NAMES[system.state] ?? system.state}) water report: violations, lead and PFAS results from EPA data, and how its ${grade.letter} grade was calculated.`,
    alternates: { canonical: `/system/${pwsid}` },
    openGraph: { images: [`/share/${pwsid}?format=og`] },
  };
}

export default async function SystemPage({ params }: Props) {
  const { pwsid } = await params;
  const system = await getSystem(pwsid);
  if (!system) notFound();
  const grade = gradeSystem(system);
  return (
    <div className="pt-2">
      <GradeCard system={system} grade={grade} shareUrl={`/system/${pwsid}`} />
      <ReportBody system={system} grade={grade} />
      <div className="mt-10 max-w-sm">
        <p className="mb-2 text-sm font-medium">Not your water system? Check your ZIP code</p>
        <ZipForm size="sm" />
      </div>
    </div>
  );
}
