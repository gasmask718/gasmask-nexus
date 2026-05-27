import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

/**
 * Ensures the invoice has live Stripe Checkout URL(s) persisted before sending.
 * - payment_type 'full'  → guarantees `payment_link`
 * - payment_type 'split' → guarantees `deposit_payment_link` + `final_payment_link`
 * If links are already present, this is a no-op. If missing, sessions are created
 * via Stripe and written back to va_invoices so every Email/SMS link is a real
 * Stripe pay URL backed by the database.
 */
async function ensureStripePaymentLinks(
  supabase: any,
  invoice: any,
  origin: string,
): Promise<{ invoice: any; error?: string }> {
  const paymentType: "full" | "split" =
    invoice.payment_type === "split" ? "split" : "full";

  const needsFull = paymentType === "full" && !invoice.payment_link;
  const needsSplit =
    paymentType === "split" &&
    (!invoice.deposit_payment_link || !invoice.final_payment_link);

  if (!needsFull && !needsSplit) return { invoice };

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return { invoice, error: "STRIPE_SECRET_KEY not configured — cannot create payment link" };
  }
  const total = Number(invoice.total || 0);
  if (!(total > 0)) {
    return { invoice, error: "Invoice total must be greater than 0 to generate a Stripe payment link" };
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const depositPercent = Math.min(Math.max(Number(invoice.deposit_percent || 50), 1), 99);
  const depositAmount = round2((total * depositPercent) / 100);
  const finalAmount = round2(total - depositAmount);

  const customerEmail = invoice.customer_email || undefined;
  const productLabel = invoice.service_type
    ? `${invoice.service_type} — ${invoice.customer_name}`
    : `Invoice ${invoice.invoice_number || ""} — ${invoice.customer_name}`;

  const buildSession = async (
    phase: "full" | "deposit" | "final",
    amount: number,
  ) => {
    const label =
      phase === "deposit"
        ? `${productLabel} (Deposit)`
        : phase === "final"
          ? `${productLabel} (Final Payment)`
          : productLabel;

    return await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: label },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      success_url: `${origin}/pay/${invoice.id}?paid=${phase}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pay/${invoice.id}?cancelled=${phase}`,
      metadata: {
        invoice_id: invoice.id,
        va_id: invoice.va_id ?? "",
        phase,
      },
    });
  };

  try {
    const update: Record<string, unknown> = {
      payment_type: paymentType,
      deposit_percent: depositPercent,
    };

    if (paymentType === "full") {
      const session = await buildSession("full", total);
      update.full_session_id = session.id;
      update.payment_link = session.url;
      update.deposit_amount = null;
      update.final_amount = null;
      invoice.payment_link = session.url;
    } else {
      const [dep, fin] = await Promise.all([
        buildSession("deposit", depositAmount),
        buildSession("final", finalAmount),
      ]);
      update.deposit_session_id = dep.id;
      update.final_session_id = fin.id;
      update.deposit_payment_link = dep.url;
      update.final_payment_link = fin.url;
      update.payment_link = dep.url;
      update.deposit_amount = depositAmount;
      update.final_amount = finalAmount;
      invoice.deposit_payment_link = dep.url;
      invoice.final_payment_link = fin.url;
      invoice.payment_link = dep.url;
      invoice.deposit_amount = depositAmount;
      invoice.final_amount = finalAmount;
    }

    const { error: updErr } = await supabase
      .from("va_invoices")
      .update(update)
      .eq("id", invoice.id);
    if (updErr) throw updErr;

    return { invoice };
  } catch (e: any) {
    return { invoice, error: `Stripe checkout session failed: ${e?.message || String(e)}` };
  }
}

/**
 * Syncs the invoice to Stripe as a real Stripe Customer + Stripe Invoice.
 * - Upserts a Stripe Customer keyed by email/phone (persists stripe_customer_id)
 * - Creates a draft Stripe Invoice with one invoice item per line (or single total)
 * - Finalizes the invoice so Stripe issues a hosted invoice URL + PDF
 * - Persists stripe_invoice_id, stripe_invoice_url, stripe_invoice_pdf,
 *   stripe_invoice_status, stripe_synced_at on va_invoices
 * - For "full" payment_type, the hosted Stripe Invoice URL is also written into
 *   `payment_link` so SMS/email use the real Stripe-hosted pay page.
 * - For "split" payment_type we still rely on the Checkout sessions created by
 *   ensureStripePaymentLinks (deposit / final), and only attach the Stripe
 *   invoice as a record-of-truth.
 */
async function syncInvoiceToStripe(
  supabase: any,
  invoice: any,
): Promise<{ invoice: any; error?: string }> {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return { invoice, error: "STRIPE_SECRET_KEY not configured — cannot sync to Stripe" };
  }
  const total = Number(invoice.total || 0);
  if (!(total > 0)) {
    return { invoice, error: "Invoice total must be greater than 0 to sync with Stripe" };
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  try {
    // 1) Resolve / create Stripe customer
    let customerId: string | undefined = invoice.stripe_customer_id || undefined;

    if (!customerId) {
      const email = (invoice.customer_email || "").trim();
      if (email) {
        const found = await stripe.customers.list({ email, limit: 1 });
        if (found.data.length) customerId = found.data[0].id;
      }
    }

    if (!customerId) {
      const created = await stripe.customers.create({
        name: invoice.customer_name || undefined,
        email: invoice.customer_email || undefined,
        phone: invoice.customer_phone || undefined,
        metadata: {
          va_invoice_id: invoice.id,
          va_id: invoice.va_id ?? "",
          lead_id: invoice.lead_id ?? "",
        },
      });
      customerId = created.id;
    }

    // 2) Reuse an existing draft invoice if we have one and it's still editable
    let stripeInvoice: any = null;
    if (invoice.stripe_invoice_id) {
      try {
        const existing = await stripe.invoices.retrieve(invoice.stripe_invoice_id);
        if (existing.status === "draft") stripeInvoice = existing;
        else stripeInvoice = existing; // finalized/paid → just refresh fields
      } catch (_) {
        stripeInvoice = null; // recreate
      }
    }

    if (!stripeInvoice || stripeInvoice.status !== "draft") {
      // Create line items first then the invoice (Stripe pulls pending items)
      const items: Array<{ description: string; price: number }> =
        Array.isArray(invoice.line_items) && invoice.line_items.length
          ? invoice.line_items.map((li: any, idx: number) => ({
              description: String(li.description || `Item ${idx + 1}`),
              price: Number(li.price || 0),
            }))
          : [{ description: invoice.service_type || "Service", price: total }];

      // If we're recreating because previous was finalized/paid, skip creating a new one
      if (stripeInvoice && stripeInvoice.status !== "draft") {
        // already finalized — keep the existing one as the source of truth
      } else {
        for (const it of items) {
          if (!(it.price > 0)) continue;
          await stripe.invoiceItems.create({
            customer: customerId!,
            currency: "usd",
            unit_amount: Math.round(it.price * 100),
            quantity: 1,
            description: it.description,
            metadata: { va_invoice_id: invoice.id },
          });
        }

        const dueDays = invoice.due_date
          ? Math.max(
              1,
              Math.ceil(
                (new Date(invoice.due_date).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : 14;

        stripeInvoice = await stripe.invoices.create({
          customer: customerId!,
          collection_method: "send_invoice",
          days_until_due: dueDays,
          description: invoice.service_type || undefined,
          footer: invoice.notes || undefined,
          auto_advance: false,
          metadata: {
            va_invoice_id: invoice.id,
            va_id: invoice.va_id ?? "",
            lead_id: invoice.lead_id ?? "",
            invoice_number: invoice.invoice_number ?? "",
            payment_type: invoice.payment_type ?? "full",
          },
        });
      }
    }

    // 3) Finalize so a hosted URL + PDF exist
    if (stripeInvoice.status === "draft") {
      stripeInvoice = await stripe.invoices.finalizeInvoice(stripeInvoice.id);
    }

    // 4) Persist everything to the DB
    const update: Record<string, unknown> = {
      stripe_customer_id: customerId,
      stripe_invoice_id: stripeInvoice.id,
      stripe_invoice_url: stripeInvoice.hosted_invoice_url ?? null,
      stripe_invoice_pdf: stripeInvoice.invoice_pdf ?? null,
      stripe_invoice_status: stripeInvoice.status ?? null,
      stripe_synced_at: new Date().toISOString(),
      stripe_sync_error: null,
    };

    // For "full" pay, prefer the Stripe-hosted invoice URL as the canonical link
    if ((invoice.payment_type || "full") === "full" && stripeInvoice.hosted_invoice_url) {
      update.payment_link = stripeInvoice.hosted_invoice_url;
      invoice.payment_link = stripeInvoice.hosted_invoice_url;
    }

    Object.assign(invoice, update);

    const { error: updErr } = await supabase
      .from("va_invoices")
      .update(update)
      .eq("id", invoice.id);
    if (updErr) throw updErr;

    return { invoice };
  } catch (e: any) {
    const msg = `Stripe sync failed: ${e?.message || String(e)}`;
    await supabase
      .from("va_invoices")
      .update({ stripe_sync_error: msg })
      .eq("id", invoice.id);
    return { invoice, error: msg };
  }
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  invoice_id?: string;
  invoiceId?: string;
  channel?: "email" | "sms";
  method?: "email" | "sms";
  recipient?: string;
}

function escapeHtml(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmtMoney(n: any): string {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function sendInvoiceEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const gmailUser = Deno.env.get("VA_GMAIL_USER");
  const gmailPass = Deno.env.get("VA_GMAIL_APP_PASSWORD");
  const replyTo = Deno.env.get("BRANDARO_EMAIL_REPLY_TO") || "hello@brandaro.com";
  const fromOverride = Deno.env.get("BRANDARO_EMAIL_FROM");
  const senderIsResendSandbox = fromOverride ? /@resend\.dev>?\s*$/i.test(fromOverride) : true;

  // PRIMARY: Nodemailer via Gmail SMTP
  if (gmailUser && gmailPass) {
    try {
      const { default: nodemailer } = await import("npm:nodemailer@6.9.14");
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: gmailUser, pass: gmailPass },
      });

      const fromHeader = fromOverride && !senderIsResendSandbox
        ? fromOverride
        : `"Brandaro" <${gmailUser}>`;

      const info = await transporter.sendMail({
        from: fromHeader,
        to: params.to,
        replyTo,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });

      console.log("nodemailer sent:", info.messageId);
      return { ok: true };
    } catch (e: any) {
      console.error("Nodemailer send failed:", e?.message || e);
      return { ok: false, error: `Nodemailer error: ${e?.message || String(e)}` };
    }
  }

  return {
    ok: false,
    error: "Email not configured. Set VA_GMAIL_USER and VA_GMAIL_APP_PASSWORD secrets to send invoices via Nodemailer (Gmail SMTP).",
  };
}

function renderEmailHtml(invoice: any, lead: any): string {
  const items = invoice.line_items || [];
  const lineItemsHtml = items
    .map(
      (i: any, idx: number) => `
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #eef2f7;color:#0f172a;font-size:14px;line-height:1.4">${escapeHtml(i.description || `Item ${idx + 1}`)}</td>
          <td style="padding:14px 16px;border-bottom:1px solid #eef2f7;color:#0f172a;font-size:14px;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums">$${fmtMoney(i.price)}</td>
        </tr>`,
    )
    .join("");

  const billTo = escapeHtml(invoice.customer_name || lead?.business_name || lead?.full_name || "Customer");
  const invNum = escapeHtml(invoice.invoice_number || "");
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
  const issueDate = new Date(invoice.created_at || Date.now()).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const ctaButton = (href: string, label: string, primary = true) => `
    <a href="${escapeHtml(href)}"
       style="display:inline-block;background:${primary ? "#0f172a" : "#ffffff"};color:${primary ? "#ffffff" : "#0f172a"};border:1px solid #0f172a;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:6px 4px">
      ${escapeHtml(label)}
    </a>`;

  const payHref =
    invoice.payment_link ||
    invoice.deposit_payment_link ||
    invoice.final_payment_link ||
    "";

  const ctaBlock = payHref
    ? `<div style="text-align:center;padding:8px 0 4px">
      ${ctaButton(payHref, `Brandaro Digital Pay — $${fmtMoney(invoice.total)}`, true)}
      <p style="margin:12px 0 0;color:#64748b;font-size:12px">Powered by Brandaro Digital Pay · Secure Stripe checkout</p>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${invNum}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Invoice ${invNum} from Brandaro — $${fmtMoney(invoice.total)} due ${dueDate || "soon"}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06)">

        <!-- Header -->
        <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #eef2f7">
          <table role="presentation" width="100%"><tr>
            <td style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#0f172a">Brandaro</td>
            <td align="right" style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">Invoice</td>
          </tr></table>
        </td></tr>

        <!-- Amount + Meta -->
        <tr><td style="padding:28px 32px 20px">
          <p style="margin:0;color:#64748b;font-size:13px">Amount due</p>
          <p style="margin:4px 0 18px;font-size:36px;font-weight:700;letter-spacing:-0.02em;color:#0f172a;font-variant-numeric:tabular-nums">$${fmtMoney(invoice.total)}</p>
          <table role="presentation" width="100%" style="font-size:13px;color:#475569">
            <tr>
              <td style="padding:4px 0"><span style="color:#94a3b8">Invoice</span> &nbsp;<strong style="color:#0f172a">#${invNum || "—"}</strong></td>
              <td align="right" style="padding:4px 0"><span style="color:#94a3b8">Issued</span> &nbsp;${escapeHtml(issueDate)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0"><span style="color:#94a3b8">Bill to</span> &nbsp;<strong style="color:#0f172a">${billTo}</strong></td>
              ${dueDate ? `<td align="right" style="padding:4px 0"><span style="color:#94a3b8">Due</span> &nbsp;<strong style="color:#0f172a">${escapeHtml(dueDate)}</strong></td>` : "<td></td>"}
            </tr>
            ${invoice.service_type ? `<tr><td colspan="2" style="padding:4px 0"><span style="color:#94a3b8">Service</span> &nbsp;${escapeHtml(invoice.service_type)}</td></tr>` : ""}
          </table>
        </td></tr>

        <!-- Line items -->
        ${items.length ? `<tr><td style="padding:0 32px 20px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef2f7;border-radius:10px;overflow:hidden">
            <thead>
              <tr style="background:#f8fafc">
                <th align="left" style="padding:10px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;font-weight:600">Description</th>
                <th align="right" style="padding:10px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;font-weight:600">Amount</th>
              </tr>
            </thead>
            <tbody>${lineItemsHtml}</tbody>
            <tfoot>
              <tr style="background:#f8fafc">
                <td style="padding:14px 16px;font-weight:600;color:#0f172a;font-size:14px">Total</td>
                <td style="padding:14px 16px;text-align:right;font-weight:700;color:#0f172a;font-size:16px;font-variant-numeric:tabular-nums">$${fmtMoney(invoice.total)}</td>
              </tr>
            </tfoot>
          </table>
        </td></tr>` : ""}

        <!-- CTA -->
        ${ctaBlock ? `<tr><td style="padding:8px 32px 24px">${ctaBlock}</td></tr>` : ""}

        <!-- Notes -->
        ${invoice.notes ? `<tr><td style="padding:0 32px 24px">
          <div style="background:#f8fafc;border-left:3px solid #0f172a;padding:12px 16px;border-radius:6px;color:#475569;font-size:13px;line-height:1.55">${escapeHtml(invoice.notes)}</div>
        </td></tr>` : ""}

        <!-- Footer -->
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #eef2f7;text-align:center;color:#94a3b8;font-size:12px;line-height:1.5">
          Questions? Just reply to this email.<br>
          <span style="color:#cbd5e1">Sent by Brandaro</span>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = (await req.json()) as Body;
    const invoiceId = body.invoice_id || body.invoiceId;
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channel = (body.channel || body.method || "email") as "email" | "sms";

    const { data: invoice, error: invErr } = await supabase
      .from("va_invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("va_id", userId)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let lead: any = null;
    if (invoice.lead_id) {
      const { data } = await supabase
        .from("brandaro_qualified_leads")
        .select("business_name, email, phone_number, full_name")
        .eq("id", invoice.lead_id)
        .maybeSingle();
      lead = data;
    }

    // GUARANTEE every outbound message carries a real Stripe Checkout URL.
    // Creates sessions on-demand and persists them to va_invoices so the DB
    // is the single source of truth for payment links.
    const origin =
      Deno.env.get("PUBLIC_APP_ORIGIN") ||
      req.headers.get("origin") ||
      "https://gasmask-os-nexus.lovable.app";
    const ensured = await ensureStripePaymentLinks(supabase, invoice, origin.replace(/\/$/, ""));
    if (ensured.error) {
      await supabase.from("va_invoices")
        .update({ last_send_error: ensured.error })
        .eq("id", invoice.id);
      return new Response(JSON.stringify({ error: ensured.error }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync to Stripe as a real Customer + Invoice (record-of-truth in Stripe).
    // For full-pay invoices this also swaps payment_link to the hosted Stripe URL.
    // Non-fatal: if Stripe sync fails we still send using the Checkout link.
    const synced = await syncInvoiceToStripe(supabase, invoice);
    if (synced.error) {
      console.warn("[va-send-invoice] Stripe sync warning:", synced.error);
    }

    let recipient = body.recipient || "";
    if (!recipient) {
      if (channel === "email") recipient = invoice.customer_email || lead?.email || "";
      else recipient = lead?.phone_number || "";
    }

    if (!recipient) {
      const errMsg = `No ${channel === "email" ? "email address" : "phone number"} on file for this customer`;
      await supabase.from("va_invoices")
        .update({ last_send_error: errMsg })
        .eq("id", invoice.id);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sendResult: { ok: boolean; error?: string } = { ok: false };

    const directStripePayUrl =
      invoice.payment_link ||
      invoice.deposit_payment_link ||
      invoice.final_payment_link ||
      "";

    if (channel === "email") {
      const html = renderEmailHtml(invoice, lead);
      const subject = `Invoice ${invoice.invoice_number || ""} from Brandaro - $${Number(invoice.total || 0).toFixed(2)}`;
      const plainLines = [
        `Brandaro invoice ${invoice.invoice_number || ""}`.trim(),
        `Amount due: $${fmtMoney(invoice.total)}`,
        invoice.due_date ? `Due: ${new Date(invoice.due_date).toLocaleDateString("en-US")}` : "",
        ...(directStripePayUrl ? [`Brandaro Digital Pay: ${directStripePayUrl}`] : []),
      ].filter(Boolean);
      sendResult = await sendInvoiceEmail({
        to: recipient,
        subject,
        html,
        text: plainLines.join("\n"),
      });
    } else {
      const accountSid = Deno.env.get("BRANDARO_TWILIO_ACCOUNT_SID") || Deno.env.get("TWILIO_ACCOUNT_SID");
      const authToken = Deno.env.get("BRANDARO_TWILIO_AUTH_TOKEN") || Deno.env.get("TWILIO_AUTH_TOKEN");
      // Prefer API Key (SK + Secret) auth — more robust and rotatable.
      const apiKeySid =
        Deno.env.get("BRANDARO_TWILIO_API_KEY_SID") || Deno.env.get("TWILIO_API_KEY_SID") || Deno.env.get("TWILIO_API_SID");
      const apiKeySecret =
        Deno.env.get("BRANDARO_TWILIO_API_KEY_SECRET") || Deno.env.get("TWILIO_API_KEY_SECRET") || Deno.env.get("TWILIO_API_SECRET");
      const fromNumber =
        Deno.env.get("BRANDARO_TWILIO_NUMBER") ||
        Deno.env.get("TWILIO_FROM_NUMBER") ||
        Deno.env.get("TWILIO_PHONE_NUMBER");
      const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

      // Resolve which credential pair to use for Basic auth.
      const useApiKey = !!(apiKeySid && apiKeySecret && apiKeySid.startsWith("SK"));
      const basicUser = useApiKey ? apiKeySid! : (accountSid || "");
      const basicPass = useApiKey ? apiKeySecret! : (authToken || "");
      const credsOk = !!(accountSid && accountSid.startsWith("AC") && basicUser && basicPass);

      if (!credsOk || (!fromNumber && !messagingServiceSid)) {
        const errMsg =
          `Twilio SMS not configured. accountSid_present=${!!accountSid} accountSid_AC=${!!(accountSid && accountSid.startsWith("AC"))} ` +
          `auth_mode=${useApiKey ? "api_key" : "auth_token"} basic_user_present=${!!basicUser} basic_pass_present=${!!basicPass} ` +
          `from_present=${!!fromNumber} messaging_service_present=${!!messagingServiceSid}. ` +
          `Ensure BRANDARO_TWILIO_ACCOUNT_SID starts with "AC" and is paired with the matching BRANDARO_TWILIO_AUTH_TOKEN, ` +
          `or set BRANDARO_TWILIO_API_KEY_SID (SK...) + BRANDARO_TWILIO_API_KEY_SECRET from the SAME Twilio account.`;
        console.error("[va-send-invoice]", errMsg);
        await supabase.from("va_invoices").update({ last_send_error: errMsg }).eq("id", invoice.id);
        return new Response(JSON.stringify({ error: errMsg }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[va-send-invoice] twilio auth mode:", useApiKey ? "api_key (SK)" : "auth_token", "account:", (accountSid || "").slice(0, 6) + "…");

      // Normalize recipient to E.164 (default US +1 if 10 digits)
      let toNumber = String(recipient).trim();
      if (!toNumber.startsWith("+")) {
        const digits = toNumber.replace(/\D/g, "");
        if (digits.length === 10) toNumber = `+1${digits}`;
        else if (digits.length === 11 && digits.startsWith("1")) toNumber = `+${digits}`;
        else toNumber = `+${digits}`;
      }
      recipient = toNumber;

      const total = fmtMoney(invoice.total);

      // For SMS, shorten the Stripe Checkout URL through the
      // create_short_link RPC so the recipient sees a compact
      // branded link instead of the full cs_live_… URL. Falls back
      // to the direct Stripe URL if shortening fails.
      let smsLink = directStripePayUrl;
      if (smsLink) {
        try {
          const { data: shortCode, error: shortErr } = await supabase.rpc("create_short_link", {
            p_url: smsLink,
            p_purpose: "invoice_payment",
            p_invoice_id: invoice.id,
          });
          if (!shortErr && shortCode) {
            const base = Deno.env.get("PUBLIC_APP_URL") || "https://gasmask-os-nexus.lovable.app";
            smsLink = `${base.replace(/\/$/, "")}/p/${shortCode}`;
          }
        } catch (_e) {
          // keep direct Stripe URL on failure
        }
      }

      // SMS is plain text — most carriers auto-linkify the URL using the
      // text immediately preceding it as the preview label. Placing the
      // label "Brandaro Digital Pay" right before the URL ensures the
      // tappable link is presented as "Brandaro Digital Pay" to the
      // recipient instead of the raw URL.
      const smsBody = smsLink
        ? `Your $${total} invoice ${invoice.invoice_number || ""} is ready.\nBrandaro Digital Pay: ${smsLink}`
        : `Brandaro Digital Pay — $${total} invoice ${invoice.invoice_number || ""} ready.`;


      const twilioParams: Record<string, string> = { To: recipient, Body: smsBody };
      if (messagingServiceSid && !fromNumber) twilioParams.MessagingServiceSid = messagingServiceSid;
      else if (fromNumber) twilioParams.From = fromNumber;

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(`${basicUser}:${basicPass}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(twilioParams),
        },
      );

      if (!twilioRes.ok) {
        const errText = await twilioRes.text();
        sendResult = { ok: false, error: `Twilio error: ${errText}` };
      } else {
        sendResult = { ok: true };
      }
    }

    if (!sendResult.ok) {
      await supabase.from("va_invoices")
        .update({ last_send_error: sendResult.error || "Unknown send error" })
        .eq("id", invoice.id);
      return new Response(JSON.stringify({ error: sendResult.error }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sentAt = new Date().toISOString();
    const { data: logRow } = await supabase
      .from("va_invoice_logs")
      .insert({
        invoice_id: invoice.id,
        sent_via: channel,
        sent_to: recipient,
        sent_at: sentAt,
      })
      .select("id")
      .single();

    await supabase
      .from("va_invoices")
      .update({
        status: invoice.status === "paid" ? "paid" : "sent",
        sent_at: sentAt,
        last_send_error: null,
      })
      .eq("id", invoice.id);

    return new Response(
      JSON.stringify({ success: true, log_id: logRow?.id, sent_to: recipient, channel }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[va-send-invoice] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
