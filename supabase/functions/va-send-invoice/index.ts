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

  const ctaBlock =
    invoice.payment_type === "split" && (invoice.deposit_payment_link || invoice.final_payment_link)
      ? `<div style="text-align:center;padding:8px 0 4px">
          ${invoice.deposit_payment_link ? ctaButton(invoice.deposit_payment_link, `Brandaro Digital Pay — 50% Deposit ($${fmtMoney(invoice.deposit_amount)})`, true) : ""}
          ${invoice.final_payment_link ? ctaButton(invoice.final_payment_link, `Brandaro Digital Pay — Final 50% ($${fmtMoney(invoice.final_amount)})`, false) : ""}
          <p style="margin:12px 0 0;color:#64748b;font-size:12px;line-height:1.5">50% deposit starts the work. Final 50% due on completion.</p>
        </div>`
      : invoice.payment_link
      ? `<div style="text-align:center;padding:8px 0 4px">
          ${ctaButton(invoice.payment_link, `Brandaro Digital Pay — $${fmtMoney(invoice.total)}`, true)}
          <p style="margin:12px 0 0;color:#64748b;font-size:12px">Powered by Brandaro Digital Pay · Secure checkout</p>
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

    if (channel === "email") {
      const html = renderEmailHtml(invoice, lead);
      const subject = `Invoice ${invoice.invoice_number || ""} from Brandaro - $${Number(invoice.total || 0).toFixed(2)}`;
      const plainLines = [
        `Brandaro invoice ${invoice.invoice_number || ""}`.trim(),
        `Amount due: $${fmtMoney(invoice.total)}`,
        invoice.due_date ? `Due: ${new Date(invoice.due_date).toLocaleDateString("en-US")}` : "",
        invoice.payment_link ? `Brandaro Digital Pay: ${invoice.payment_link}` : "",
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
      const fromNumber =
        Deno.env.get("BRANDARO_TWILIO_NUMBER") ||
        Deno.env.get("TWILIO_FROM_NUMBER") ||
        Deno.env.get("TWILIO_PHONE_NUMBER");
      const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

      if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
        const errMsg = "Twilio SMS not configured (need ACCOUNT_SID + AUTH_TOKEN + (FROM number or MESSAGING_SERVICE_SID))";
        await supabase.from("va_invoices").update({ last_send_error: errMsg }).eq("id", invoice.id);
        return new Response(JSON.stringify({ error: errMsg }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
      const longLink =
        invoice.payment_type === 'split'
          ? (invoice.deposit_payment_link || invoice.final_payment_link || invoice.payment_link)
          : invoice.payment_link;

      // Wrap the Stripe checkout URL in a branded short link so the SMS shows
      // a clean "Brandaro Digital" URL that redirects to Stripe on click.
      // The /p/:code redirect is handled by ShortLinkRedirect.tsx via the
      // resolve_short_link RPC, which also tracks click attribution.
      let smsLink: string | null = null;
      if (longLink) {
        try {
          const { data: shortCode, error: slErr } = await supabase.rpc("create_short_link", {
            p_target_url: longLink,
            p_kind: "invoice_payment_stripe_direct",
            p_invoice_id: invoice.id,
            p_lead_id: invoice.lead_id || null,
            p_session_id: null,
            p_context: { source: "va-send-invoice", channel: "sms", va_id: userId, direct_stripe: true, brand: "Brandaro Digital" },
            p_expires_at: null,
          });
          if (slErr) throw slErr;
          if (shortCode) {
            const origin = Deno.env.get("PUBLIC_APP_ORIGIN") || "https://gasmask-os-nexus.lovable.app";
            smsLink = `${origin}/p/${shortCode}`;
          }
        } catch (e) {
          console.warn("create_short_link failed, falling back to direct Stripe URL:", (e as Error).message);
          smsLink = longLink;
        }
      }

      const smsBody = smsLink
        ? `Brandaro Digital Pay — $${total} invoice ready. Tap to pay securely: ${smsLink}`
        : `Brandaro Digital Pay — $${total} invoice ${invoice.invoice_number || ""} ready.`;

      const twilioParams: Record<string, string> = { To: recipient, Body: smsBody };
      if (messagingServiceSid && !fromNumber) twilioParams.MessagingServiceSid = messagingServiceSid;
      else if (fromNumber) twilioParams.From = fromNumber;

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
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
