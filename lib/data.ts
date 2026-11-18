import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { SITE_URL } from "./site";
import type { CityRecord, Meta, StateSystemSummary, WaterSystem, ZipRecord } from "./types";

// turbopackIgnore keeps the bundler from tracing all of public/data into every function.
const DATA_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "data");

/**
 * Read one precomputed JSON file.
 *
 * At build time and in local dev the file is on disk. On Vercel, pages rendered
 * on demand run in a function that does not contain public/data (it is too big),
 * so they fetch the same file from the site's own static hosting instead.
 */
const load = cache(async <T,>(rel: string): Promise<T | null> => {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, rel), "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  if (process.env.VERCEL !== "1") return null; // locally, a missing file really is missing
  const res = await fetch(`${SITE_URL}/data/${rel}`, { next: { revalidate: 86400 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`data fetch failed: ${rel} (${res.status})`);
  return (await res.json()) as T;
});

export const isZip = (s: string) => /^\d{5}$/.test(s);
export const isPwsid = (s: string) => /^[A-Z0-9]{9}$/.test(s);
export const isState = (s: string) => /^[A-Z]{2}$/.test(s);

export async function getZip(zip: string): Promise<ZipRecord | null> {
  if (!isZip(zip)) return null;
  const shard = await load<Record<string, ZipRecord>>(`zips/${zip.slice(0, 3)}.json`);
  return shard?.[zip] ?? null;
}

export async function getSystem(pwsid: string): Promise<WaterSystem | null> {
  if (!isPwsid(pwsid)) return null;
  const shard = await load<Record<string, WaterSystem>>(`systems/${pwsid.slice(0, 5)}.json`);
  return shard?.[pwsid] ?? null;
}

export async function getSystems(pwsids: string[]): Promise<WaterSystem[]> {
  const found = await Promise.all(pwsids.map(getSystem));
  return found.filter((s): s is WaterSystem => s !== null);
}

export async function getCity(slug: string): Promise<CityRecord | null> {
  const state = slug.slice(-2).toUpperCase();
  if (!/^[a-z0-9-]+-[a-z]{2}$/.test(slug)) return null;
  const shard = await load<Record<string, CityRecord>>(`cities/${state}.json`);
  return shard?.[slug] ?? null;
}

export async function getStateCities(state: string): Promise<CityRecord[]> {
  if (!isState(state)) return [];
  return Object.values((await load<Record<string, CityRecord>>(`cities/${state}.json`)) ?? {});
}

export async function getStateSystems(state: string): Promise<StateSystemSummary[] | null> {
  return isState(state) ? load<StateSystemSummary[]>(`states/${state}.json`) : null;
}

export const getTopCities = async () => (await load<CityRecord[]>("top-cities.json")) ?? [];

export const getMeta = () => load<Meta>("meta.json");
