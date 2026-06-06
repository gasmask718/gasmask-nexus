// DD lifecycle email processor.
// Cron: every 5 min. Batch 50, attempts<5.
// - Resend send only when RESEND_API_KEY is present (graceful exit otherwise).
// - Suppression-checked at send time (suppressions or capture-unsubscribes).
// - Win-back dedupe at send time: skip if customer placed a newer paid order
//   after the win-back's reference order was placed.
// - Idempotent: sent_at gate + idempotency_key unique.
// - Branded templates use only safe fields (same surface as lookup_guest_order).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BATCH = 50;
const MAX_ATTEMPTS = 5;
const PAID_FAMILY = ["paid", "captured", "succeeded", "completed"];

type Job = {
  id: string;
  template: string;
  recipient_email: string;
  order_id: string | null;
  user_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
};

const FROM = "Dynasty Direct <hello@dynasty-direct.com>";

function fmtMoney(n: unknown): string {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return `$${v.toFixed(2)}`;
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function shell(origin: string, title: string, body: string, unsubUrl: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #eef0f4">
          <a href="${origin}" style="text-decoration:none;color:#0f172a;font-weight:700;font-size:18px">Dynasty Direct</a>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${title}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #eef0f4;color:#64748b;font-size:12px;line-height:1.6">
          Dynasty Direct · <a href="${origin}" style="color:#64748b">${origin.replace(/^https?:\/\//,"")}</a><br/>
          You're receiving this because you placed an order with us.
          <a href="${unsubUrl}" style="color:#64748b;text-decoration:underline">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

async function renderTemplate(
  origin: string,
  unsubUrl: string,
  job: Job,
  sb: ReturnType<typeof createClient>,
): Promise<{ subject: string; html: string } | null> {
  // Pull safe order payload via the lookup RPC's underlying tables
  // (same safe surface; no shipping_label_url, no PII beyond city/state).
  let order: any = null;
  let items: any[] = [];
  let trackingUrl: string | null = null;

  if (job.order_id) {
    const { data: o } = await sb
      .from("marketplace_orders")
      .select("id, total, subtotal, shipping_cost, tax_amount, shipping_address, created_at")
      .eq("id", job.order_id)
      .maybeSingle();
    order = o;

    const { data: it } = await sb
      .from("marketplace_order_items")
      .select("product_name, qty, price_each")
      .eq("order_id", job.order_id);
    items = (it as any[]) ?? [];

    const { data: fs } = await sb
      .from("marketplace_fulfillments")
      .select("carrier, tracking_number")
      .eq("order_id", job.order_id)
      .order("created_at", { ascending: false })
      .limit(1);
    const f = (fs as any[])?.[0];
    if (f?.tracking_number) {
      const tn = encodeURIComponent(f.tracking_number);
      const c = (f.carrier || "").toLowerCase();
      trackingUrl = c.includes("usps")
        ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tn}`
        : c.includes("ups")
        ? `https://www.ups.com/track?tracknum=${tn}`
        : c.includes("fedex")
        ? `https://www.fedex.com/fedextrack/?trknbr=${tn}`
        : c.includes("dhl")
        ? `https://www.dhl.com/en/express/tracking.html?AWB=${tn}`
        : null;
    }
  }

  const orderShort = order ? String(order.id).slice(0, 8).toUpperCase() : "";
  const orderUrl = order ? `${origin}/order/${order.id}` : origin;

  const itemRows = items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eef0f4">${i.product_name} <span style="color:#64748b">× ${i.qty}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #eef0f4">${fmtMoney(i.price_each)}</td></tr>`,
    )
    .join("");

  if (job.template === "order_confirmation") {
    if (!order) return null;
    return {
      subject: `Order ${orderShort} confirmed — thanks!`,
      html: shell(
        origin,
        `Thanks for your order`,
        `<p>We've got your order <strong>#${orderShort}</strong>. We'll email you again when it ships.</p>
         <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">${itemRows}
           <tr><td style="padding:10px 0;color:#64748b">Subtotal</td><td align="right">${fmtMoney(order.subtotal)}</td></tr>
           <tr><td style="padding:6px 0;color:#64748b">Shipping</td><td align="right">${fmtMoney(order.shipping_cost)}</td></tr>
           <tr><td style="padding:6px 0;color:#64748b">Tax</td><td align="right">${fmtMoney(order.tax_amount)}</td></tr>
           <tr><td style="padding:10px 0;font-weight:700">Total</td><td align="right" style="font-weight:700">${fmtMoney(order.total)}</td></tr>
         </table>
         <p><a href="${orderUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">View order</a></p>`,
        unsubUrl,
      ),
    };
  }

  if (job.template === "order_shipped") {
    return {
      subject: `Your order ${orderShort} is on the way`,
      html: shell(
        origin,
        `Your order is on the way`,
        `<p>Good news — order <strong>#${orderShort}</strong> has shipped${
          (job.payload as any).carrier ? ` via ${String((job.payload as any).carrier)}` : ""
        }.</p>
         ${
           trackingUrl
             ? `<p><a href="${trackingUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Track package</a></p>`
             : `<p>Tracking: <strong>${String((job.payload as any).tracking_number ?? "")}</strong></p>`
         }
         <p style="margin-top:16px"><a href="${orderUrl}" style="color:#0f172a">View order details →</a></p>`,
        unsubUrl,
      ),
    };
  }

  if (job.template === "review_request") {
    return {
      subject: `How was order ${orderShort}?`,
      html: shell(
        origin,
        `Quick favor?`,
        `<p>Your order should have arrived by now. A short review helps other shoppers and helps us pick what to carry next.</p>
         <p><a href="${orderUrl}?review=1" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Leave a review</a></p>`,
        unsubUrl,
      ),
    };
  }

  if (job.template === "win_back") {
    return {
      subject: `We miss you — 10% off your next order`,
      html: shell(
        origin,
        `Come back for 10% off`,
        `<p>It's been a minute. Here's <strong>10% off</strong> your next order — code <strong>COMEBACK10</strong> at checkout.</p>
         <p><a href="${origin}/products" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Shop now</a></p>`,
        unsubUrl,
      ),
    };
  }

  return null;
}

async function unsubscribeUrl(origin: string, email: string): Promise<string> {
  const secret = Deno.env.get("DD_UNSUBSCRIBE_SECRET") ?? Deno.env.get("SHARED_SECRET");
  const ts = Math.floor(Date.now() / 1000).toString();
  const emailLower = email.toLowerCase();
  if (!secret) return `${origin}/unsubscribe`;
  const sig = await hmacHex(secret, `${emailLower}.${ts}`);
  const projectRef = Deno.env.get("SUPABASE_URL")!.match(/https:\/\/([^.]+)\./)?.[1] ?? "";
  const fnUrl = `https://${projectRef}.supabase.co/functions/v1/dd-email-unsubscribe`;
  const qs = new URLSearchParams({ email: emailLower, ts, sig });
  return `${fnUrl}?${qs.toString()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const origin = (Deno.env.get("PUBLIC_SITE_ORIGIN") || "https://dynasty-connect-market.lovable.app").replace(/\/+$/, "");

  // Pull a batch of due jobs.
  const { data: jobs, error: qErr } = await sb
    .from("email_jobs")
    .select("id, template, recipient_email, order_id, user_id, payload, attempts")
    .is("sent_at", null)
    .is("skipped_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(BATCH);

  if (qErr) {
    return new Response(JSON.stringify({ ok: false, error: qErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const queue = (jobs as Job[]) ?? [];

  // Graceful exit when RESEND_API_KEY missing — leave jobs queued for next run.
  if (!resendKey) {
    return new Response(
      JSON.stringify({ ok: true, sent: 0, skipped: 0, queued: queue.length, note: "RESEND_API_KEY not set" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let sent = 0, skipped = 0, failed = 0;

  for (const job of queue) {
    const emailLower = job.recipient_email.toLowerCase();

    // Suppression check at send time.
    const { data: sup } = await sb
      .from("dd_email_suppressions")
      .select("email_lower")
      .eq("email_lower", emailLower)
      .maybeSingle();
    if (sup) {
      await sb.from("email_jobs").update({
        skipped_at: new Date().toISOString(),
        skipped_reason: "suppressed",
      }).eq("id", job.id);
      skipped++;
      continue;
    }
    const { data: unsub } = await sb
      .from("email_captures")
      .select("id")
      .ilike("email", emailLower)
      .not("unsubscribed_at", "is", null)
      .limit(1);
    if (unsub && unsub.length > 0) {
      await sb.from("email_jobs").update({
        skipped_at: new Date().toISOString(),
        skipped_reason: "unsubscribed",
      }).eq("id", job.id);
      skipped++;
      continue;
    }

    // Win-back dedupe at send time: skip if a newer paid order exists for the recipient.
    if (job.template === "win_back" && job.order_id) {
      const placedAt = (job.payload as any)?.placed_at;
      if (placedAt) {
        const { data: newer } = await sb
          .from("marketplace_orders")
          .select("id")
          .ilike("customer_email", emailLower)
          .in("payment_status", PAID_FAMILY)
          .gt("created_at", placedAt)
          .neq("id", job.order_id)
          .limit(1);
        if (newer && newer.length > 0) {
          await sb.from("email_jobs").update({
            skipped_at: new Date().toISOString(),
            skipped_reason: "newer_order_exists",
          }).eq("id", job.id);
          skipped++;
          continue;
        }
      }
    }

    // Render
    const unsubUrl = await unsubscribeUrl(origin, emailLower);
    const rendered = await renderTemplate(origin, unsubUrl, job, sb);
    if (!rendered) {
      await sb.from("email_jobs").update({
        attempts: job.attempts + 1,
        last_error: "template_render_failed_or_order_missing",
      }).eq("id", job.id);
      failed++;
      continue;
    }

    // Send via Resend
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [emailLower],
          subject: rendered.subject,
          html: rendered.html,
          headers: { "List-Unsubscribe": `<${unsubUrl}>` },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        await sb.from("email_jobs").update({
          attempts: job.attempts + 1,
          last_error: `resend_${resp.status}: ${errText.slice(0, 500)}`,
        }).eq("id", job.id);
        failed++;
        continue;
      }

      await sb.from("email_jobs").update({
        sent_at: new Date().toISOString(),
        attempts: job.attempts + 1,
      }).eq("id", job.id);
      sent++;
    } catch (e: any) {
      await sb.from("email_jobs").update({
        attempts: job.attempts + 1,
        last_error: `exception: ${String(e?.message ?? e).slice(0, 500)}`,
      }).eq("id", job.id);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, picked: queue.length, sent, skipped, failed }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
