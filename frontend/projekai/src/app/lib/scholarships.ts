/** Target programs. `value` is what the API stores in scholarshipTarget. */
export interface Scholarship {
  slug: string;
  value: string;
  name: string;
}

export const SCHOLARSHIPS: Scholarship[] = [
  { slug: "lpdp", value: "LPDP RI 2026", name: "LPDP" },
  { slug: "fulbright", value: "Fulbright", name: "Fulbright" },
  { slug: "chevening", value: "Chevening", name: "Chevening" },
  { slug: "erasmus", value: "Erasmus Mundus", name: "Erasmus Mundus" },
  { slug: "daad", value: "DAAD", name: "DAAD" },
  { slug: "aas", value: "AAS (Australia Awards)", name: "Australia Awards (AAS)" },
  { slug: "djarum", value: "Djarum Beasiswa Plus", name: "Djarum Beasiswa Plus" },
  { slug: "other", value: "Umum / Lainnya", name: "" },
];

export function scholarshipBySlug(slug: string | null): Scholarship | undefined {
  return SCHOLARSHIPS.find((s) => s.slug === slug);
}

export function scholarshipByValue(value: string | null | undefined): Scholarship | undefined {
  return SCHOLARSHIPS.find((s) => s.value === value);
}
