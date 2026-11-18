// Shapes of the JSON written by pipeline/build.py. See pipeline/README.md.

export type MatchKind = "boundary" | "reported" | "county";

export interface ZipSystemRef {
  pwsid: string;
  name: string;
  population: number;
  match: MatchKind;
  share?: number;
}

export interface ZipRecord {
  zip: string;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  coverage: number | null;
  systems: ZipSystemRef[];
}

export interface Violation {
  id: string;
  begin?: string;
  end?: string;
  resolved_on?: string;
  status?: "Resolved" | "Archived" | "Addressed" | "Unaddressed";
  health_based: boolean;
  category: string;
  type: string;
  contaminant?: string;
  rule?: string;
  enforcement?: { date: string; action: string; category: string | null };
}

export interface LeadCopperPeriod {
  start: string | null;
  end: string;
  lead_ppb: number | null;
  copper_mgl: number | null;
}

export interface PfasChemical {
  name: string;
  samples: number;
  detections: number;
  max_ppt: number;
  max_location_avg_ppt: number;
  reporting_limit_ppt: number;
  mcl_ppt?: number;
  proposed_rescission?: boolean;
}

export type Pfas =
  | { sampled: false }
  | {
      sampled: true;
      first_sample: string | null;
      last_sample: string | null;
      max_hazard_index: number | null;
      chemicals: PfasChemical[];
    };

export interface WaterSystem {
  pwsid: string;
  name: string;
  state: string;
  population: number;
  connections: number;
  source: { code: string; label: string | null };
  owner: string | null;
  wholesaler: boolean;
  contact: { phone: string | null; city: string | null };
  counties: string[];
  boundary: string | null;
  zips: string[];
  violations: Violation[];
  violation_counts: { total: number; health_based: number; open: number; listed_since: string };
  lead_copper: LeadCopperPeriod[];
  pfas: Pfas;
  lithium: { samples: number; detections: number; max_ugl: number; reporting_limit_ugl: number } | null;
}

export interface StateSystemSummary {
  pwsid: string;
  name: string;
  population: number;
  city: string | null;
  zips: number;
}

export interface CityRecord {
  slug: string;
  city: string;
  state: string;
  pwsid: string;
  zips: string[];
  population: number;
}

export interface Meta {
  built_at: string;
  sources: { sdwis: string | null; ucmr5: string | null };
  counts: { systems: number; zips: number; systems_with_pfas_data: number };
}
