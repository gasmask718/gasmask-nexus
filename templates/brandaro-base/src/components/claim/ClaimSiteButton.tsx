import { useState } from "react";
import { getClaimConfig, primaryTier, formatPrice } from "@/lib/claimConfig";
import { useClaimCheckout } from "@/hooks/useClaimCheckout";
import { ClaimTiersModal, Spinner } from "./ClaimTiersModal";

/**
 * ClaimSiteButton — "Get This Site — $499".
 *
 * This is Brandaro's voice, not the demo business's. It is intentionally
 * styled in Brandaro slate/white and NEVER inherits VITE_COLOR_PRIMARY, so it
 * can't be confused with the prospect-facing "Request a Free Quote" CTAs.
 *
 * variant="bar"     -> compact, for the existing sticky bar
 * variant="section" -> full block, for the end of the page
 *
 * Renders nothing at all unless the claim config is complete.
 */
export function ClaimSiteButton({ variant = "section" }: { variant?: "bar" | "section" }) {
  const config = getClaimConfig();
  const { startCheckout, pending, isPending, error } = useClaimCheckout();
  const [tiersOpen, setTiersOpen] = useState(false);
  const [email, setEmail] = useState("");

  if (!config) return null;

  const tier = primaryTier(config);
  const price = formatPrice(tier.amount_cents);
  const label = price ? `Get This Site — ${price}` : "Get This Site";
  const busy = pending === tier.tier;
  const hasUpgrades = config.tiers.length > 1;

  const buy = () => startCheckout(tier.tier, email);

  if (variant === "bar") {
    return (
      <>
        <div className="brandaro-claim flex flex-col items-stretch gap-1">
          <button
            type="button"
            onClick={buy}
            disabled={isPending}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-slate-900/10 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Spinner label="Starting…" /> : label}
          </button>
          {hasUpgrades && (
            <button
              type="button"
              onClick={() => setTiersOpen(true)}
              className="text-center text-[11px] font-medium text-slate-500 underline-offset-2 transition hover:text-slate-800 hover:underline"
            >
              See Pro &amp; Custom
            </button>
          )}
          {error && (
            <p role="alert" className="max-w-[16rem] text-[11px] font-medium text-red-600">
              {error}
            </p>
          )}
        </div>
        <ClaimTiersModal open={tiersOpen} onClose={() => setTiersOpen(false)} />
      </>
    );
  }

  return (
    <>
      <section className="brandaro-claim border-t border-slate-200 bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Built by Brandaro Digital
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            Like what you see? It&apos;s yours.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-slate-600">
            This site is live and ready. Claim it and we&apos;ll put it on your own domain, fully
            set up — usually within a few business days.
          </p>

          <div className="mx-auto mt-8 max-w-sm space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com (optional)"
              aria-label="Email (optional)"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
            <button
              type="button"
              onClick={buy}
              disabled={isPending}
              className="w-full rounded-lg bg-slate-900 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Spinner label="Starting checkout…" /> : label}
            </button>

            {hasUpgrades && (
              <button
                type="button"
                onClick={() => setTiersOpen(true)}
                className="text-sm text-slate-500 underline-offset-2 transition hover:text-slate-800 hover:underline"
              >
                Need e-commerce, booking, or custom pages? See Pro &amp; Custom
              </button>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </p>
            )}

            <p className="pt-1 text-xs text-slate-400">
              One-time payment, secured by Stripe. No account needed.
            </p>
          </div>
        </div>
      </section>
      <ClaimTiersModal open={tiersOpen} onClose={() => setTiersOpen(false)} />
    </>
  );
}
