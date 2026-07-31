/**
 * demo-webhook-selftest  (TEMPORARY — diagnostic only)
 *
 * Stripe has no API for emitting synthetic events, so this function builds a
 * checkout.session.completed payload, signs it with DEMO_STRIPE_WEBHOOK_SECRET
 * exactly the way Stripe does (t=<ts>,v1=HMAC-SHA256("<ts>.<body>")), and POSTs
 * it to demo-stripe-webhook. Proves signature verification + all downstream
 * provisioning logic without touching the Stripe dashboard.
 *
 * Body: { demo_id, tier?, amount_cents?, customer_email?, business_name? }
 */

const enc = new TextEncoder();

async function stripeSignature(payload: string, secret: string, ts: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${payload}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${ts},v1=${hex}`;
}

Deno.serve(async (req) => {
  try {
    const input = await req.json().catch(() => ({}));
    const demo_id: string | undefined = input.demo_id;
    if (!demo_id) {
      return new Response(JSON.stringify({ error: "demo_id required" }), { status: 400 });
    }
    const tier = input.tier ?? "starter";
    const amount_cents = input.amount_cents ?? 49900;

    const secret =
      Deno.env.get("DEMO_STRIPE_WEBHOOK_SECRET") || Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!secret) {
      return new Response(JSON.stringify({ error: "no webhook secret configured" }), {
        status: 500,
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const event = {
      id: `evt_selftest_${now}`,
      object: "event",
      api_version: "2025-08-27.basil",
      created: now,
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_test_selftest_${now}`,
          object: "checkout.session",
          amount_total: amount_cents,
          currency: "usd",
          mode: "payment",
          payment_status: "paid",
          status: "complete",
          customer_details: {
            email: input.customer_email ?? "selftest@brandarodigital.com",
            name: input.customer_name ?? "Selftest Customer",
          },
          metadata: {
            demo_id,
            tier,
            business_name: input.business_name ?? "Selftest Business",
            customer_email: input.customer_email ?? "selftest@brandarodigital.com",
          },
        },
      },
    };

    const body = JSON.stringify(event);
    const sig = await stripeSignature(body, secret, now);

    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/demo-stripe-webhook`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body,
    });
    const text = await resp.text();

    // Control: same payload with a deliberately bad signature must be rejected.
    const badResp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": `t=${now},v1=deadbeef` },
      body,
    });
    const badText = await badResp.text();

    return new Response(
      JSON.stringify({
        event_id: event.id,
        session_id: (event.data.object as any).id,
        signed_post: { status: resp.status, body: text },
        bad_signature_control: { status: badResp.status, body: badText },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message }), { status: 500 });
  }
});
