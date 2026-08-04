import { useState } from "react";
import { createPortal } from "react-dom";
import { getClaimConfig, formatPrice, tierBlurb } from "@/lib/claimConfig";
import { useClaimCheckout } from "@/hooks/useClaimCheckout";

/**
 * ClaimTiersModal — the "Pro & Custom" escape hatch.
 *
 * Brandaro-branded on purpose (slate/white, Brandaro wordmark). It must read
 * as the agency talking to the buyer, never as the demo business.
 */
export function ClaimTiersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const config = getClaimConfig();
  const { startCheckout, pending, isPending, error } = useClaimCheckout();
  const [email, setEmail] = useState("");

  if (!config || !open) return null;

  return createPortal(
    <div
      className="brandaro-claim fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brandaro-tiers-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Brandaro Digital
            </p>
            <h2 id="brandaro-tiers-title" className="mt-1 text-xl font-bold text-slate-900">
              Choose your package
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-lg p-2 text-2xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            &times;
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          {config.tiers.map((t) => {
            const price = formatPrice(t.amount_cents);
            const busy = pending === t.tier;
            return (
              <div
                key={t.tier}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-slate-300"
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-900">{t.label}</span>
                    {price && <span className="text-sm font-medium text-slate-500">{price}</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{tierBlurb(t.tier)}</p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startCheckout(t.tier, email)}
                  className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? <Spinner label="Starting…" /> : price ? `Buy ${price}` : "Buy"}
                </button>
              </div>
            );
          })}

          <div className="pt-1">
            <label
              htmlFor="brandaro-tier-email"
              className="text-xs font-medium uppercase tracking-wide text-slate-400"
            >
              Email (optional)
            </label>
            <input
              id="brandaro-tier-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
            <p className="mt-1 text-xs text-slate-400">
              Just pre-fills checkout — you can enter it on the next screen instead.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </div>

        <p className="border-t border-slate-200 px-6 py-4 text-xs text-slate-400">
          Secure one-time payment via Stripe. Hosting is billed separately after launch.
        </p>
      </div>
    </div>,
    document.body,
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
    </span>
  );
}
