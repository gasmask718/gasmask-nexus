export const DP_TIERS = [
  {
    value: "foundation",
    label: "Foundation",
    entryFeeCents: 500_000,
    mrrCents: 49_700,
    maxPlatforms: 2,
    commissionRate: 5,
  },
  {
    value: "equity",
    label: "Equity",
    entryFeeCents: 1_500_000,
    mrrCents: 99_700,
    maxPlatforms: 4,
    commissionRate: 7,
  },
  {
    value: "sovereign",
    label: "Sovereign",
    entryFeeCents: 5_000_000,
    mrrCents: 199_700,
    maxPlatforms: 8,
    commissionRate: 10,
  },
] as const;

export type DPTierValue = (typeof DP_TIERS)[number]["value"];

export const DP_PLATFORMS = [
  { slug: "toptier", label: "TopTier Experience" },
  { slug: "unforgettable", label: "Unforgettable Times" },
  { slug: "playboxxx", label: "Playboxxx" },
  { slug: "gasmask", label: "GasMask Distribution" },
  { slug: "iclean", label: "iClean WeClean" },
  { slug: "brandaro", label: "Brandaro Digital" },
  { slug: "dynasty-connect", label: "Dynasty Connect" },
  { slug: "uben", label: "UBEN" },
] as const;

export function getTier(value: string) {
  return DP_TIERS.find((t) => t.value === value);
}
