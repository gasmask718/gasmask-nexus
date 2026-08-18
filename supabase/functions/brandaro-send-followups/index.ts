import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errText } from "../_shared/errText.ts";
import { sendSms } from "../_shared/sendSms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * brandaro-send-followups
 * 
 * Cron-driven worker that sends pending follow-up messages via Twilio SMS
 * and SendGrid email. Runs every minute.
 * 
 * Also handles close acceleration nudges for demo_viewed pipeline entries.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    if (body.dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    // ─── 1. Fetch pending follow-ups that are due ───────────────
    const { data: pending, error: fetchErr } = await supabase
      .from("brandaro_followup_sequences")
      .select("*, brandaro_qualified_leads:lead_id(phone_number, email, business_name)")
      .eq("status", "pending")
      .eq("sent", false)
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchErr) throw fetchErr;

    let sentCount = 0;
    let failedCount = 0;

    for (const followup of (pending || [])) {
      const lead = followup.brandaro_qualified_leads;
      if (!lead) {
        await markFailed(supabase, followup.id, "Lead not found");
        failedCount++;
        continue;
      }

      try {
        if (followup.channel === "sms") {
          const phone = lead.phone_number;
          if (!phone) {
            await markFailed(supabase, followup.id, "No phone number");
            failedCount++;
            continue;
          }

          // Append Calendly link on 2nd+ follow-up attempt
          let messageContent = followup.message_content;
          const attemptNumber = followup.retry_count || 0;
          if (attemptNumber >= 2) {
            const calendlyLink = Deno.env.get("CALENDLY_LINK") || "https://calendly.com/brandarodigital-sales/website-strategy-call";
            messageContent += ` P.S. You can also grab a quick 15-min call here to see your demo live: ${calendlyLink}`;
          }

          const result = await sendBrandaroSms(
            phone,
            messageContent,
            `brandaro-fus-${followup.id}-${followup.retry_count || 0}`,
            "brandaro_followup_sequence",
            { followup_id: followup.id, lead_id: followup.lead_id, business_name: lead.business_name },
          );
          
          await supabase.from("brandaro_followup_sequences").update({
            status: "sent",
            sent: true,
            sent_at: now,
            provider_message_id: result.sid || null,
          }).eq("id", followup.id);

          sentCount++;
        } else if (followup.channel === "email") {
          const email = lead.email;
          if (!email) {
            await markFailed(supabase, followup.id, "No email address");
            failedCount++;
            continue;
          }

          const result = await sendSendGridEmail(email, lead.business_name, followup.message_content);

          await supabase.from("brandaro_followup_sequences").update({
            status: "sent",
            sent: true,
            sent_at: now,
            provider_message_id: result.messageId || null,
          }).eq("id", followup.id);

          sentCount++;
        }
      } catch (sendErr: unknown) {
        const reason = errText(sendErr);
        console.error(`Follow-up ${followup.id} send failed:`, reason);
        
        const retryCount = (followup.retry_count || 0) + 1;
        if (retryCount >= 3) {
          await markFailed(supabase, followup.id, `Max retries: ${reason}`);
        } else {
          // Retry with exponential backoff: 5min, 30min
          const backoffMinutes = retryCount === 1 ? 5 : 30;
          await supabase.from("brandaro_followup_sequences").update({
            retry_count: retryCount,
            scheduled_at: new Date(Date.now() + backoffMinutes * 60000).toISOString(),
          }).eq("id", followup.id);
        }
        failedCount++;
      }
    }

    // ─── 2. Close Acceleration Nudges ───────────────────────────
    // Phase 12: If demo_viewed but no response, send nudge
    const { data: viewedDeals } = await supabase
      .from("brandaro_close_pipeline")
      .select("*, brandaro_qualified_leads:lead_id(phone_number, email, business_name)")
      .eq("stage", "demo_viewed")
      .lt("nudge_count", 3)
      .or(`last_nudge_at.is.null,last_nudge_at.lt.${new Date(Date.now() - 2 * 3600000).toISOString()}`);

    let nudgesSent = 0;

    const nudgeMessages = [
      "What do you think? Want me to get this live for you? 🚀",
      "Just checking in — your custom site is ready to launch whenever you are.",
      "Last chance — we can get this live for you today. Want to move forward?",
    ];

    for (const deal of (viewedDeals || [])) {
      const lead = deal.brandaro_qualified_leads;
      if (!lead?.phone_number) continue;

      const nudgeIdx = Math.min(deal.nudge_count || 0, nudgeMessages.length - 1);
      const msg = nudgeMessages[nudgeIdx];

      try {
        await sendBrandaroSms(
          lead.phone_number,
          msg,
          `brandaro-nudge-${deal.id}-${deal.nudge_count || 0}`,
          "brandaro_close_nudge",
          { deal_id: deal.id, lead_id: deal.lead_id, business_name: lead.business_name },
        );
        
        await supabase.from("brandaro_close_pipeline").update({
          nudge_count: (deal.nudge_count || 0) + 1,
          last_nudge_at: now,
          urgency_level: (deal.nudge_count || 0) >= 1 ? "high" : "normal",
        }).eq("id", deal.id);

        nudgesSent++;
      } catch (e) {
        console.error(`Nudge failed for deal ${deal.id}:`, errText(e));
      }
    }

    // ─── 3. Payment Push (Phase 13) ─────────────────────────────
    // If stage is "negotiating" and no payment link sent, create one
    const { data: negotiating } = await supabase
      .from("brandaro_close_pipeline")
      .select("*, brandaro_qualified_leads:lead_id(phone_number, email, business_name)")
      .eq("stage", "negotiating")
      .is("payment_link_sent_at", null);

    let paymentPushed = 0;

    for (const deal of (negotiating || [])) {
      const lead = deal.brandaro_qualified_leads;
      if (!lead?.phone_number || deal.payment_link_url) continue;

      // Generate real Stripe payment link via brandaro-create-payment-link
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        
        const linkRes = await fetch(`${supabaseUrl}/functions/v1/brandaro-create-payment-link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            deal_id: deal.id,
            lead_id: deal.lead_id,
            package_tier: deal.package_tier || "starter",
            send_sms: true,
          }),
        });

        if (linkRes.ok) {
          paymentPushed++;
          console.log(`💳 Payment link created for deal ${deal.id}`);
        } else {
          const bodyText = await linkRes.text();
          console.error(`Payment link creation failed for deal ${deal.id}:`, bodyText);
        }
      } catch (e) {
        console.error(`Payment push failed for deal ${deal.id}:`, errText(e));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      followups_sent: sentCount,
      followups_failed: failedCount,
      nudges_sent: nudgesSent,
      payment_pushes: paymentPushed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = errText(err);
    console.error("brandaro-send-followups error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

});

// ─── HELPERS ──────────────────────────────────────────────────────────

async function markFailed(supabase: any, id: string, reason: string) {
  await supabase.from("brandaro_followup_sequences").update({
    status: "failed",
    failure_reason: reason,
  }).eq("id", id);
}

/**
 * Routes through the canonical `send-sms` function so DNC/suppression,
 * idempotency, cooldowns and the outbound_messages audit trail all apply.
 * Throws on failure to preserve the caller's retry/backoff behavior.
 */
async function sendBrandaroSms(
  to: string,
  body: string,
  idempotencyKey: string,
  purpose: string,
  metadata?: Record<string, unknown>,
): Promise<{ sid?: string }> {
  const result = await sendSms({
    to: normalizePhone(to),
    body,
    idempotencyKey,
    from: Deno.env.get("BRANDARO_TWILIO_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER") || undefined,
    purpose,
    skipCooldown: true,
    metadata,
  });

  if (!result.success) {
    throw new Error(
      `SMS send failed (${result.status}): ${result.errorMessage || result.errorCode || "unknown"}`,
    );
  }

  return { sid: result.providerMessageId ?? undefined };
}

async function sendSendGridEmail(to: string, businessName: string, content: string): Promise<{ messageId?: string }> {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  if (!apiKey) throw new Error("SendGrid API key not configured");

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: "hello@brandaro.com", name: "Brandaro" },
      subject: `${businessName} — Your Custom Website Preview`,
      content: [{
        type: "text/html",
        value: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#0ea5e9">Hey ${businessName}!</h2>
          <p style="font-size:16px;line-height:1.6">${content}</p>
          <p style="font-size:14px;color:#666;margin-top:20px">— The Brandaro Team</p>
        </div>`,
      }],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`SendGrid failed [${response.status}]: ${bodyText}`);
  }

  return { messageId: response.headers.get("X-Message-Id") || undefined };
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.startsWith("+")) return phone;
  return `+${digits}`;
}
