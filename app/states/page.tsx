import type { Metadata } from "next";
import Link from "next/link";
import { STATE_NAMES } from "@/lib/text";

export const metadata: Metadata = {
  title: "Tap water quality by state",
  description: "Browse water systems and cities in every U.S. state and territory.",
  alternates: { canonical: "/states" },
};

export default function StatesPage() {
  return (
    <div className="pt-6">
      <h1 className="text-3xl font-bold">Browse by state</h1>
      <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {Object.entries(STATE_NAMES).map(([code, name]) => (
          <li key={code}>
            <Link className="link" href={`/state/${code.toLowerCase()}`}>
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
