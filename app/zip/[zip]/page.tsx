import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GradeCard, ReportBody, SystemCard } from "@/components/Report";
import { ZipForm } from "@/components/ZipForm";
import { getSystems, getZip, isZip } from "@/lib/data";
import { gradeSystem } from "@/lib/grade";
import { LINKS } from "@/lib/site";
import { titleCase } from "@/lib/text";

export const revalidate = 86400;
export const dynamicParams = true;
export const generateStaticParams = () => ["77005", "10021", "19104", "78701"].map((zip) => ({ zip }));

const MAX_SYSTEMS = 12;
type Props = { params: Promise<{ zip: string }> };

async function load(zip: string) {
  const record = await getZip(zip);
  const systems = record ? await getSystems(record.systems.slice(0, MAX_SYSTEMS).map((s) => s.pwsid)) : [];
  return { record, systems: systems.map((system) => ({ system, grade: gradeSystem(system) })) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { zip } = await params;
  if (!isZip(zip)) return {};
  const { record, systems } = await load(zip);
  const place = record?.city ? `${record.city}, ${record.state}` : `ZIP ${zip}`;
  const top = systems[0];
  const pinned = top && record!.systems[0].match !== "county";
  return {
    title: pinned ? `${place} ${zip} tap water: grade ${top.grade.letter}` : `Tap water in ${place} ${zip}`,
    description: pinned
      ? `${titleCase(top.system.name)} serves ZIP ${zip}. See its violations, lead and PFAS results, and how its ${top.grade.letter} grade was calculated from EPA data.`
      : `Water systems, violations, lead and PFAS results for ZIP ${zip}, from EPA data.`,
    alternates: { canonical: `/zip/${zip}` },
    robots: systems.length === 0 ? { index: false } : undefined,
    openGraph: pinned ? { images: [`/share/${top.system.pwsid}?zip=${zip}&format=og`] } : undefined,
  };
}

function PrivateWells({ state }: { state?: string | null }) {
  return (
    <div className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed">
      <p className="font-semibold">On a private well?</p>
      <p className="mt-1">
        Private wells are not regulated by EPA and do not appear in this data. Testing is the owner&apos;s
        responsibility.{" "}
        <a className="link" href={LINKS.stateWellPrograms}>
          Find well testing information for {state ?? "your state"}
        </a>{" "}
        or read{" "}
        <a className="link" href={LINKS.privateWells}>
          EPA&apos;s private well guidance
        </a>
        .
      </p>
    </div>
  );
}

export default async function ZipPage({ params }: Props) {
  const { zip } = await params;
  if (!isZip(zip)) notFound();
  const { record, systems } = await load(zip);
  const place = record?.city ? `${record.city}, ${record.state}` : null;

  if (!record || systems.length === 0) {
    return (
      <div className="pt-6">
        <h1 className="text-3xl font-bold">No public water system found for {zip}</h1>
        <p className="mt-3 leading-relaxed">
          EPA&apos;s records don&apos;t link a community water system to this ZIP code. That can happen when a ZIP is
          only for PO boxes, when the area relies on private wells, or when the utility hasn&apos;t reported the ZIP
          codes it serves. Your water bill names your supplier.
        </p>
        <PrivateWells state={record?.state} />
        <div className="mt-8 max-w-sm">
          <p className="mb-2 text-sm font-medium">Try another ZIP code</p>
          <ZipForm size="sm" />
        </div>
      </div>
    );
  }

  const countyOnly = record.systems[0].match === "county";
  if (countyOnly) {
    return (
      <div className="pt-6">
        <h1 className="text-3xl font-bold">Water systems near {place ?? zip}</h1>
        <p className="mt-3 leading-relaxed">
          We couldn&apos;t match ZIP {zip} to a specific water system. These are the largest systems in your county;
          yours may be one of them, or you may be on a private well. Your water bill names your supplier.
        </p>
        <div className="mt-6 space-y-3">
          {systems.map(({ system, grade }) => (
            <SystemCard key={system.pwsid} system={system} grade={grade} />
          ))}
        </div>
        <PrivateWells state={record.state} />
      </div>
    );
  }

  const [primary, ...others] = systems;
  const refs = new Map(record.systems.map((s) => [s.pwsid, s]));
  const note = (pwsid: string) => {
    const ref = refs.get(pwsid);
    if (!ref) return undefined;
    if (ref.match === "reported") return "lists this ZIP in its service area";
    return ref.share != null && ref.share >= 0.005 ? `covers about ${Math.round(ref.share * 100)}% of this ZIP` : "covers a small part of this ZIP";
  };
  const hidden = record.systems.length - systems.length;

  return (
    <div className="pt-2">
      <p className="mb-3 text-sm text-muted">
        Water report for ZIP {zip}
        {others.length > 0 && (
          <>
            {" · "}
            <a className="link" href="#others">
              {others.length + hidden} other system{others.length + hidden === 1 ? "" : "s"} may serve this ZIP
            </a>
          </>
        )}
      </p>
      <GradeCard system={primary.system} grade={primary.grade} place={place} shareUrl={`/zip/${zip}`} zip={zip} />
      {others.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          More than one water system serves ZIP {zip}. This is the one covering the most of it. Check your water bill
          to confirm which is yours.
        </p>
      )}
      <ReportBody system={primary.system} grade={primary.grade} />
      {others.length > 0 && (
        <section id="others" className="mt-10 scroll-mt-6">
          <h2 className="text-xl font-bold">Other systems that may serve {zip}</h2>
          <div className="mt-3 space-y-3">
            {others.map(({ system, grade }) => (
              <SystemCard key={system.pwsid} system={system} grade={grade} note={note(system.pwsid)} />
            ))}
          </div>
          {hidden > 0 && <p className="mt-2 text-sm text-muted">And {hidden} smaller systems not shown.</p>}
        </section>
      )}
      {(record.coverage ?? 1) < 0.5 && <PrivateWells state={record.state} />}
      <div className="mt-10 max-w-sm">
        <p className="mb-2 text-sm font-medium">Check another ZIP code</p>
        <ZipForm size="sm" />
      </div>
      <p className="mt-6 text-sm">
        <Link className="link" href="/methodology">
          How grades are calculated
        </Link>
      </p>
    </div>
  );
}
