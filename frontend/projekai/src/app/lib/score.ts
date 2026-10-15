/** One band table for every score label in the product. */
export type BandKey = "exceptional" | "veryGood" | "good" | "fair" | "revise";

export const BANDS: { key: BandKey; min: number }[] = [
  { key: "exceptional", min: 91 },
  { key: "veryGood", min: 76 },
  { key: "good", min: 51 },
  { key: "fair", min: 26 },
  { key: "revise", min: 0 },
];

export function bandOf(score: number): { key: BandKey; min: number; max: number } {
  const i = BANDS.findIndex((b) => score >= b.min);
  const band = BANDS[i === -1 ? BANDS.length - 1 : i];
  const max = i <= 0 ? 100 : BANDS[i - 1].min - 1;
  return { ...band, max };
}
