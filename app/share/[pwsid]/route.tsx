import { ImageResponse } from "next/og";
import { getCity, getSystem, getZip } from "@/lib/data";
import { gradeTone, keyFacts, TONE_HEX } from "@/lib/facts";
import { gradeSystem } from "@/lib/grade";
import { SITE_HOST } from "@/lib/site";
import { titleCase } from "@/lib/text";

// Report-card image. Default is 1080x1350 (portrait, for social posts);
// ?format=og gives 1200x630 for link previews.
export async function GET(req: Request, { params }: { params: Promise<{ pwsid: string }> }) {
  const { pwsid } = await params;
  const url = new URL(req.url);
  const system = await getSystem(pwsid);
  if (!system) return new Response("Not found", { status: 404 });

  const zip = url.searchParams.get("zip");
  const citySlug = url.searchParams.get("city");
  const zipRecord = zip ? await getZip(zip) : null;
  const city = citySlug ? await getCity(citySlug) : null;
  const place =
    (zipRecord?.city && `${zipRecord.city}, ${zipRecord.state}`) ||
    (city && `${city.city}, ${city.state}`) ||
    (system.contact.city ? `${system.contact.city}, ${system.state}` : system.state);

  const grade = gradeSystem(system);
  const color = TONE_HEX[gradeTone(grade.letter)];
  const facts = keyFacts(system, grade);
  const og = url.searchParams.get("format") === "og";
  const [width, height] = og ? [1200, 630] : [1080, 1350];
  const name = titleCase(system.name);

  const badge = (size: number) => (
    <div
      style={{
        width: size, height: size, borderRadius: size * 0.18, background: "#ffffff", color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * (grade.letter.length > 1 ? 0.56 : 0.68), fontWeight: 900, letterSpacing: -4,
      }}
    >
      {grade.letter}
    </div>
  );
  const factList = (fontSize: number) => (
    <div style={{ display: "flex", flexDirection: "column", gap: fontSize * 0.45 }}>
      {facts.map((fact) => (
        <div key={fact} style={{ display: "flex", alignItems: "center", fontSize, color: "#e6f0fb" }}>
          <div style={{ width: fontSize * 0.36, height: fontSize * 0.36, borderRadius: 99, background: "#7cc4ff", marginRight: fontSize * 0.5 }} />
          {fact}
        </div>
      ))}
    </div>
  );
  const footer = (fontSize: number) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: fontSize * 1.25, fontWeight: 700, color: "#ffffff" }}>{`Check yours at ${SITE_HOST}`}</div>
      <div style={{ fontSize, color: "#a9c3df" }}>
        {"Informational grade based on EPA-reported data. Not a safety certification."}
      </div>
    </div>
  );
  const frame = {
    width: "100%", height: "100%", display: "flex", color: "#ffffff",
    background: "linear-gradient(160deg, #0a2540 0%, #0b4a8f 100%)", fontFamily: "sans-serif",
  } as const;

  const image = og ? (
    <div style={{ ...frame, padding: 60, alignItems: "center", gap: 56 }}>
      {badge(360)}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 22 }}>
        <div style={{ fontSize: 26, letterSpacing: 4, color: "#7cc4ff", fontWeight: 700 }}>TAP WATER REPORT CARD</div>
        <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>{place}</div>
        <div style={{ fontSize: 30, color: "#cfe1f5" }}>{name}</div>
        {factList(26)}
        {footer(18)}
      </div>
    </div>
  ) : (
    <div style={{ ...frame, flexDirection: "column", padding: 80, justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 32, letterSpacing: 6, color: "#7cc4ff", fontWeight: 700 }}>TAP WATER REPORT CARD</div>
        <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05 }}>{place}</div>
        <div style={{ fontSize: 40, color: "#cfe1f5" }}>{name}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>{badge(460)}</div>
      {factList(38)}
      {footer(26)}
    </div>
  );

  return new ImageResponse(image, {
    width,
    height,
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
