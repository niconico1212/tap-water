import type { MetadataRoute } from "next";
import { getMeta, getStateCities, getStateSystems } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { STATE_NAMES } from "@/lib/text";

export const revalidate = 86400;

// One sitemap for the fixed pages, then one per state (cities + systems).
export async function generateSitemaps() {
  return [{ id: "core" }, ...Object.keys(STATE_NAMES).map((id) => ({ id }))];
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  const lastModified = (await getMeta())?.built_at;
  const entry = (path: string, priority: number) => ({ url: `${SITE_URL}${path}`, lastModified, priority });
  if (id === "core") {
    return [
      entry("/", 1),
      entry("/methodology", 0.5),
      entry("/states", 0.5),
      ...Object.keys(STATE_NAMES).map((s) => entry(`/state/${s.toLowerCase()}`, 0.6)),
    ];
  }
  if (!STATE_NAMES[id]) return [];
  const [cities, systems] = await Promise.all([getStateCities(id), getStateSystems(id)]);
  return [
    ...cities.map((c) => entry(`/water/${c.slug}`, 0.8)),
    ...(systems ?? []).map((s) => entry(`/system/${s.pwsid}`, 0.6)),
  ];
}
