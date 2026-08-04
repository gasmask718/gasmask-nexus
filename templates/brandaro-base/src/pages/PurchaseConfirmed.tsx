import { useEffect, useRef, useState } from "react";

/**
 * PurchaseConfirmed — the page a PAYING CUSTOMER lands on after Stripe.
 *
 * Route: /purchase-confirmed?demo_id=...&session=cs_...
 *
 * This replaces sending buyers to the generic lead-intake /thanks page.
 * A buyer must never see "we'll get back to you about your quote" after
 * paying $499.
 *
 * The Stripe webhook is what actually marks the demo paid, and it can land a
 * second or two after the redirect — so this polls briefly rather than
 * declaring failure on the first "processing" response.
 */

interface StatusResponse {
  status: "paid" | "processing" | "not_found" | "mismatch";
  business_name?: string | null;
  tier?: string | null;
  amount?: number | null;
  customer_email?: string | null;
  intake_url?: string | null;
  support_email?: string | null;
  error?: string;
}

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 8; // ~20s before we stop waiting on the webhook

function useQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    demoId: (params.get("demo_id") ?? "").trim(),
    session: (params.get("session") ?? params.get("session_id") ?? "").trim(),
  };
}

export default function PurchaseConfirmed() {
  const { demoId, session } = useQueryParams();
  const [state, setState] = useState<StatusResponse | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(true);
  const polls = useRef(0);

  const statusUrl = (import.meta.env.VITE_PURCHASE_STATUS_URL as string | undefined)?.trim();

  useEffect(() => {
    if (!demoId || !session) {
      setWaiting(false);
      setFailed("This link is missing its order details.");
      return;
    }
    if (!statusUrl) {
      setWaiting(false);
      setFailed(null);
      // No status endpoint configured — still confirm the purchase optimistically
      // rather than alarming a customer who has genuinely just paid.
      setState({ status: "paid" });
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      polls.current += 1;
      try {
        const res = await fetch(statusUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ demo_id: demoId, session }),
        });
        const payload: StatusResponse = await res.json();
        if (cancelled) return;

        if (payload.status === "paid") {
          setState(payload);
          setWaiting(false);
          return;
        }
        if (payload.status === "mismatch" || payload.status === "not_found") {
          setState(payload);
          setWaiting(false);
          return;
        }
        if (polls.current >= MAX_POLLS) {
          setState(payload);
          setWaiting(false);
          return;
        }
        timer = window.setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        if (polls.current >= MAX_POLLS) {
          setWaiting(false);
          setFailed("We couldn't reach our servers to confirm the order.");
          return;
        }
        timer = window.setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [demoId, session, statusUrl]);

  const supportEmail = state?.support_email || "support@brandarodigital.com";

  return (
    <main className="brandaro-claim min-h-screen bg-slate-50 px-6 py-16">
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Brandaro Digital
        </p>

        {waiting && (
          <>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">Confirming your payment…</h1>
            <p className="mt-3 flex items-center gap-3 text-slate-600">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
              This only takes a moment. Please don&apos;t close this page.
            </p>
          </>
        )}

        {!waiting && failed && (
          <>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">
              We couldn&apos;t load your order
            </h1>
            <p className="mt-3 text-slate-600">
              {failed} If your card was charged, your order is safe — email{" "}
              <a className="font-medium text-slate-900 underline" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>{" "}
              and we&apos;ll sort it out right away.
            </p>
          </>
        )}

        {!waiting && !failed && state?.status === "paid" && (
          <>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-lg text-emerald-700">
                ✓
              </span>
              <h1 className="text-2xl font-bold text-slate-900">Payment received</h1>
            </div>
            <p className="mt-4 text-slate-600">
              {state.business_name ? (
                <>
                  <span className="font-semibold text-slate-900">{state.business_name}</span> is now
                  yours.
                </>
              ) : (
                <>Your site is now yours.</>
              )}{" "}
              A receipt is on its way
              {state.customer_email ? ` to ${state.customer_email}` : ""}.
            </p>

            {(state.tier || state.amount) && (
              <dl className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                {state.tier && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Package</dt>
                    <dd className="font-medium capitalize text-slate-900">{state.tier}</dd>
                  </div>
                )}
                {typeof state.amount === "number" && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Paid</dt>
                    <dd className="font-medium text-slate-900">
                      ${state.amount.toLocaleString("en-US")}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
              What happens next
            </h2>
            <ol className="mt-3 space-y-3 text-slate-600">
              <NextStep n={1}>
                <strong className="text-slate-900">Tell us your details.</strong> We&apos;ll send a
                short form for your domain, logo, hours, and any copy changes.
              </NextStep>
              <NextStep n={2}>
                <strong className="text-slate-900">We build and launch.</strong> Your site goes live
                on your own domain, typically within a few business days.
              </NextStep>
              <NextStep n={3}>
                <strong className="text-slate-900">You approve.</strong> We walk you through it and
                make final tweaks before handover.
              </NextStep>
            </ol>

            {state.intake_url && (
              <a
                href={state.intake_url}
                className="mt-8 block rounded-lg bg-slate-900 px-6 py-4 text-center text-base font-semibold text-white transition hover:bg-slate-700"
              >
                Start setup — 2 minutes
              </a>
            )}

            <p className="mt-6 text-sm text-slate-500">
              Questions? Email{" "}
              <a className="font-medium text-slate-900 underline" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
              .
            </p>
          </>
        )}

        {!waiting && !failed && state?.status === "processing" && (
          <>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">Your payment went through</h1>
            <p className="mt-3 text-slate-600">
              We&apos;re still finalising your order on our side — this can take a minute. You
              don&apos;t need to do anything, and you&apos;ll get a confirmation email shortly. You
              can safely close this page.
            </p>
          </>
        )}

        {!waiting && !failed && (state?.status === "mismatch" || state?.status === "not_found") && (
          <>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">We couldn&apos;t match this order</h1>
            <p className="mt-3 text-slate-600">
              This confirmation link doesn&apos;t match an order we can find. If you were charged,
              nothing is lost — email{" "}
              <a className="font-medium text-slate-900 underline" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>{" "}
              with your receipt and we&apos;ll fix it immediately.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function NextStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
