/**
 * Claim CTA configuration — read from build-time env vars injected by
 * Dynasty OS (_shared/vercelDeploy.ts) into each industry's Vercel project.
 *
 * NOTHING here is hardcoded: prices, tiers and the checkout endpoint all
 * arrive as env vars so a price change in brandaro_stripe_config propagates
 * on the next demo generation without touching this repo.
 */

export interface ClaimTier {
  tier: "starter" | "pro" | "custom";
  label: string;
  amount_cents: number | null;
}

export interface ClaimConfig {
  demoId: string;
  checkoutUrl: string;
  tiers: ClaimTier[];
}

const TIER_BLURBS: Record<string, string> = {
  starter: "Everything on this page, live on your own domain.",
  pro: "Adds online booking, e-commerce, and extra pages.",
  custom: "Fully bespoke build with custom features and integrations.",
};

export function tierBlurb(tier: string): string {
  return TIER_BLURBS[tier] ?? "";
}

/** "$499" — or null when the amount hasn't been configured yet. */
export function formatPrice(amountCents: number | null | undefined): string | null {
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents) || amountCents <= 0) {
    return null;
  }
  const dollars = amountCents / 100;
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Returns null whenever the CTA must NOT render. A dead "Get This Site"
 * button is worse than no button, so every precondition is checked here
 * and every consumer just does `if (!config) return null`.
 */
export function getClaimConfig(): ClaimConfig | null {
  const env = import.meta.env as Record<string, string | undefined>;

  if (env.VITE_CLAIM_ENABLED !== "1") return null;

  const demoId = (env.VITE_DEMO_ID ?? "").trim();
  const checkoutUrl = (env.VITE_CHECKOUT_URL ?? "").trim();
  if (!demoId || !checkoutUrl) return null;

  let tiers: ClaimTier[] = [];
  try {
    const parsed = JSON.parse(env.VITE_CLAIM_TIERS_JSON ?? "[]");
    if (Array.isArray(parsed)) {
      tiers = parsed.filter(
        (t): t is ClaimTier =>
          !!t && typeof t.tier === "string" && ["starter", "pro", "custom"].includes(t.tier),
      );
    }
  } catch {
    tiers = [];
  }

  if (tiers.length === 0) return null;

  return { demoId, checkoutUrl, tiers };
}

export function primaryTier(config: ClaimConfig): ClaimTier {
  return config.tiers.find((t) => t.tier === "starter") ?? config.tiers[0];
}
