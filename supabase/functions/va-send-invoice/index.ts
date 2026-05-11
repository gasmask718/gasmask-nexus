import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function renderEmailHtml(invoice: any, lead: any): string {
  const lineItemsHtml = (invoice.line_items || [])
    .map(
      (i: any) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">${i.description || ""}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">$${Number(i.price || 0).toFixed(2)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0f172a">
  <div style="background:linear-gradient(135deg,#0891b2,#0e7490);color:white;padding:24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:22px">Invoice ${invoice.invoice_number || ""}</h1>
    <p style="margin:4px 0 0;opacity:.9">From Brandaro</p>
  </div>
  <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-top:none">
    <p style="margin:0 0 8px"><strong>Bill to:</strong> ${invoice.customer_name || lead?.business_name || ""}</p>
    ${invoice.service_type ? `<p style="margin:0 0 8px"><strong>Service:</strong> ${invoice.service_type}</p>` : ""}
    ${invoice.due_date ? `<p style="margin:0 0 8px"><strong>Due:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>` : ""}
    <table style="width:100%;border-collapse:collapse;margin-top:16px;background:white;border-radius:8px;overflow:hidden">
      <thead><tr style="background:#0f172a;color:white">
        <th style="padding:10px;text-align:left">Description</th>
        <th style="padding:10px;text-align:right">Price</th>
      </tr></thead>
      <tbody>${lineItemsHtml}</tbody>
      <tfoot><tr style="background:#f1f5f9">
        <td style="padding:12px;font-weight:bold">Total</td>
        <td style="padding:12px;text-align:right;font-weight:bold;font-size:18px;color:#0891b2">$${Number(invoice.total || 0).toFixed(2)}</td>
      </tr></tfoot>
    </table>
    ${
      invoice.payment_type === 'split' && (invoice.deposit_payment_link || invoice.final_payment_link)
        ? `<div style="text-align:center;margin:24px 0">
        ${invoice.deposit_payment_link ? `<a href="${invoice.deposit_payment_link}" style="display:inline-block;background:#0891b2;color:white;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:4px">Pay 50% Deposit ($${Number(invoice.deposit_amount || 0).toFixed(2)})</a>` : ''}
        ${invoice.final_payment_link ? `<a href="${invoice.final_payment_link}" style="display:inline-block;background:#0f172a;color:white;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:4px">Pay Final 50% ($${Number(invoice.final_amount || 0).toFixed(2)})</a>` : ''}
        <p style="margin-top:8px;color:#475569;font-size:12px">Pay 50% now to start the project. Final 50% on completion.</p>
      </div>`
        : invoice.payment_link
        ? `<div style="text-align:center;margin:24px 0">
        <a href="${invoice.payment_link}" style="display:inline-block;background:#0891b2;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Pay Invoice</a>
      </div>`
        : ""
    }
    ${invoice.notes ? `<p style="margin-top:16px;color:#475569;font-size:14px"><em>${invoice.notes}</em></p>` : ""}
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px">Powered by Brandaro</p>
</body></html>`;
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
      if (channel === "email") recipient = lead?.email || "";
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
      const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_KEY) {
        return new Response(JSON.stringify({ error: "Email is not configured (RESEND_API_KEY missing)" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const html = renderEmailHtml(invoice, lead);
      const subject = `Invoice ${invoice.invoice_number || ""} from Brandaro - $${Number(invoice.total || 0).toFixed(2)}`;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Brandaro <invoices@resend.dev>",
          to: [recipient],
          subject,
          html,
        }),
      });

      if (!resendRes.ok) {
        const errText = await resendRes.text();
        sendResult = { ok: false, error: `Resend error: ${errText}` };
      } else {
        sendResult = { ok: true };
      }
    } else {
      const accountSid = Deno.env.get("BRANDARO_TWILIO_ACCOUNT_SID");
      const authToken = Deno.env.get("BRANDARO_TWILIO_AUTH_TOKEN");
      const fromNumber = Deno.env.get("BRANDARO_TWILIO_NUMBER");

      if (!accountSid || !authToken || !fromNumber) {
        return new Response(JSON.stringify({ error: "Brandaro Twilio not configured for SMS" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const smsBody =
        `Invoice ${invoice.invoice_number || ""} from Brandaro\n` +
        `Total: $${Number(invoice.total || 0).toFixed(2)}\n` +
        (invoice.payment_link ? `Pay: ${invoice.payment_link}` : "");

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: recipient,
            From: fromNumber,
            Body: smsBody,
          }),
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
