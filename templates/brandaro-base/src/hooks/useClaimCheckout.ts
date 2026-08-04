import { useState, useCallback } from "react";
import { getClaimConfig } from "@/lib/claimConfig";

type Tier = "starter" | "pro" | "custom";

/**
 * useClaimCheckout — posts to demo-stripe-checkout and hands the buyer to Stripe.
 *
 * Deliberate behaviours:
 *  - `pending` is the tier currently in flight, so only the clicked button
 *    spins and every button is disabled (no double-submit, no double-charge).
 *  - Server errors ("This demo has already been purchased") are surfaced
 *    verbatim. Nothing here fails silently.
 *  - No email gate. Stripe Checkout collects the email; the optional field
 *    only pre-fills it.
 */
export function useClaimCheckout() {
  const [pending, setPending] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = useCallback(
    async (tier: Tier, email?: string) => {
      const config = getClaimConfig();
      if (!config || pending) return;

      setPending(tier);
      setError(null);

      try {
        const res = await fetch(config.checkoutUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            demo_id: config.demoId,
            tier,
            customer_email: email?.trim() || undefined,
          }),
        });

        let payload: { checkout_url?: string; error?: string } = {};
        try {
          payload = await res.json();
        } catch {
          payload = { error: `Checkout failed (${res.status}). Please try again.` };
        }

        if (payload.checkout_url) {
          // Keep the spinner up through the redirect — the page is leaving.
          window.location.href = payload.checkout_url;
          return;
        }

        setError(payload.error || "Checkout could not be started. Please try again.");
        setPending(null);
      } catch {
        setError("Network error — please check your connection and try again.");
        setPending(null);
      }
    },
    [pending],
  );

  return {
    startCheckout,
    pending,
    isPending: pending !== null,
    error,
    clearError: () => setError(null),
  };
}
