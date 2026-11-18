import Link from "next/link";
import { ZipForm } from "@/components/ZipForm";
import { getTopCities } from "@/lib/data";
import { DISCLAIMER } from "@/lib/site";

export default async function Home() {
  const cities = (await getTopCities()).slice(0, 24);
  return (
    <>
      <section className="flex min-h-[calc(100dvh-4.5rem)] flex-col items-center justify-center text-center">
        <h1 className="max-w-xl text-4xl font-black tracking-tight sm:text-5xl">What&apos;s in your tap water?</h1>
        <p className="mt-4 max-w-md text-lg text-muted">
          Enter your ZIP code for a plain-English report card on your water system.
        </p>
        <div className="mt-8 w-full max-w-sm">
          <ZipForm />
        </div>
        <p className="mt-6 max-w-sm text-xs text-muted">{DISCLAIMER}</p>
      </section>
      {cities.length > 0 && (
        <section className="pb-8">
          <h2 className="text-lg font-bold">Popular cities</h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            {cities.map((c) => (
              <li key={c.slug}>
                <Link className="link" href={`/water/${c.slug}`}>
                  {c.city}, {c.state}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
