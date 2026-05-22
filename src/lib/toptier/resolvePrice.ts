/**
 * TopTier price resolution — single source of truth (mirrors public.tt_resolve_price).
 *
 * Rule: explicit `customerPrice` wins. Otherwise, if both `partnerCost` and
 * `markupPct` are present, derived = round(partnerCost * (1 + markupPct/100), 2).
 * Otherwise null (quote-pattern services that price at quote time).
 */
export type PriceInput = {
  partnerCost?: number | null;
  customerPrice?: number | null;
  markupPct?: number | null;
};

export type ResolvedPrice = {
  customerPrice: number | null;
  margin: number | null;
  marginPct: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function resolvePrice(input: PriceInput): ResolvedPrice {
  const { partnerCost = null, customerPrice = null, markupPct = null } = input;

  let cp: number | null = null;
  if (customerPrice != null) {
    cp = Number(customerPrice);
  } else if (partnerCost != null && markupPct != null) {
    cp = round2(Number(partnerCost) * (1 + Number(markupPct) / 100));
  }

  if (cp == null || partnerCost == null) {
    return { customerPrice: cp, margin: null, marginPct: null };
  }

  const margin = round2(cp - Number(partnerCost));
  const marginPct =
    Number(partnerCost) === 0 ? null : round2((margin / Number(partnerCost)) * 100);

  return { customerPrice: cp, margin, marginPct };
}
