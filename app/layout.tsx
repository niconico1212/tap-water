import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getMeta } from "@/lib/data";
import { DISCLAIMER, SITE_NAME, SITE_URL } from "@/lib/site";
import { formatDate } from "@/lib/text";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: look up your water by ZIP code`, template: `%s | ${SITE_NAME}` },
  description:
    "Enter your ZIP code to see who supplies your tap water, its recent violations, lead and PFAS results, and a plain-English letter grade based on EPA data.",
  openGraph: { siteName: SITE_NAME, type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const meta = await getMeta();
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-bold tracking-tight">
            💧 {SITE_NAME}
          </Link>
          <nav className="flex gap-4 text-sm text-muted">
            <Link href="/states" className="hover:text-ink">
              States
            </Link>
            <Link href="/methodology" className="hover:text-ink">
              Methodology
            </Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-3xl space-y-2 px-4 py-6 text-sm text-muted">
            <p>{DISCLAIMER} For questions about your water, contact your utility.</p>
            <p>
              Data: U.S. EPA Safe Drinking Water Information System
              {meta?.sources.sdwis ? ` (as of ${formatDate(meta.sources.sdwis)})` : ""}, EPA UCMR 5, EPA water system
              service areas, U.S. Census Bureau, GeoNames (CC BY 4.0). Not affiliated with EPA.
            </p>
            <p className="flex gap-4">
              <Link className="link" href="/methodology">
                Methodology
              </Link>
              <Link className="link" href="/states">
                Browse by state
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
