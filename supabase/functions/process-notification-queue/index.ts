import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/sendEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Template Builder ──────────────────────────────────────────
interface TemplateResult {
  subject: string;
  html: string;
}

function buildNotificationTemplate(
  eventType: string,
  payload: Record<string, unknown>,
  portalBaseUrl: string
): TemplateResult {
  const orderRef = (payload.order_id as string)?.slice(0, 8)?.toUpperCase() || "N/A";
  const portalLink = `${portalBaseUrl}/portal/store`;
  const ordersLink = `${portalBaseUrl}/orders`;

  const button = (href: string, label: string) =>
    `<a href="${href}" style="display:inline-block;padding:12px 24px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;margin-top:16px;">${label}</a>`;

  const wrap = (title: string, body: string, cta: string) => `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
  <tr><td style="background:#111827;padding:24px 32px;">
    <h1 style="color:#ffffff;margin:0;font-size:18px;">Dynasty Marketplace</h1>
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="color:#111827;margin:0 0 16px;">${title}</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 8px;">Order Reference: <strong>#${orderRef}</strong></p>
    ${body}
    <div style="margin-top:24px;">${cta}</div>
  </td></tr>
  <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">This is an automated notification. Do not reply to this email. All communication should happen through the secure portal.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  switch (eventType) {
    case "fulfillment_required":
      return {
        subject: `Action Required: New Order #${orderRef} Needs Fulfillment`,
        html: wrap(
          "New Order Ready for Fulfillment",
          `<p style="color:#4b5563;line-height:1.6;">A new order has been paid and is waiting for you to ship. Please prepare and ship this order within 48 hours to maintain your fulfillment rating.</p>
           <p style="color:#4b5563;line-height:1.6;">Order Total: <strong>$${Number(payload.total || 0).toFixed(2)}</strong></p>`,
          button(portalLink, "View Fulfillment Queue")
        ),
      };

    case "order_shipped":
      return {
        subject: `Your Order #${orderRef} Has Shipped`,
        html: wrap(
          "Your Order Has Shipped! 📦",
          `<p style="color:#4b5563;line-height:1.6;">Great news — your order is on the way.</p>
           ${payload.tracking_number ? `<p style="color:#4b5563;">Tracking: <strong>${payload.tracking_number}</strong> (${payload.carrier || "Standard"})</p>` : ""}`,
          button(ordersLink, "Track Your Order")
        ),
      };

    case "order_delivered":
      return {
        subject: `Your Order #${orderRef} Has Been Delivered`,
        html: wrap(
          "Order Delivered ✓",
          `<p style="color:#4b5563;line-height:1.6;">Your order has been marked as delivered. If you have any issues, you can open a dispute through your order page within the settlement window.</p>`,
          button(ordersLink, "View Order Details")
        ),
      };

    case "payout_approved":
      return {
        subject: `Payout Approved: $${Number(payload.net_amount || 0).toFixed(2)} for Order #${orderRef}`,
        html: wrap(
          "Payout Approved 💰",
          `<p style="color:#4b5563;line-height:1.6;">Your payout of <strong>$${Number(payload.net_amount || 0).toFixed(2)}</strong> has been approved and will be processed in the next payment cycle.</p>`,
          button(portalLink, "View Payout Ledger")
        ),
      };

    case "payout_paid":
      return {
        subject: `Payment Sent: $${Number(payload.net_amount || 0).toFixed(2)} for Order #${orderRef}`,
        html: wrap(
          "Payment Sent ✅",
          `<p style="color:#4b5563;line-height:1.6;">A payment of <strong>$${Number(payload.net_amount || 0).toFixed(2)}</strong> has been sent to your account.</p>
           ${payload.paid_at ? `<p style="color:#4b5563;">Paid at: ${new Date(payload.paid_at as string).toLocaleDateString()}</p>` : ""}`,
          button(portalLink, "View Payment History")
        ),
      };

    case "dispute_opened":
      return {
        subject: `⚠️ Dispute Opened on Order #${orderRef}`,
        html: wrap(
          "Dispute Opened",
          `<p style="color:#4b5563;line-height:1.6;">A dispute has been opened on one of your orders. Your payout for this order is now on hold pending resolution.</p>
           ${payload.dispute_reason ? `<p style="color:#4b5563;">Reason: <strong>${payload.dispute_reason}</strong></p>` : ""}
           <p style="color:#dc2626;font-weight:600;">Do not contact the customer directly. All communication must go through the platform.</p>`,
          button(portalLink, "View Dispute Details")
        ),
      };

    case "new_message":
      return {
        subject: `New Message on Order #${orderRef}`,
        html: wrap(
          "You Have a New Message",
          `<p style="color:#4b5563;line-height:1.6;">A ${payload.sender_role === "vendor" ? "seller" : payload.sender_role === "customer" ? "customer" : "team member"} sent you a message regarding your order.</p>
           <div style="background:#f3f4f6;border-radius:6px;padding:16px;margin:12px 0;">
             <p style="color:#374151;margin:0;font-style:italic;">"${payload.preview || "..."}"</p>
           </div>`,
          button(payload.sender_role === "vendor" ? ordersLink : portalLink, "Reply in Portal")
        ),
      };

    default:
      return {
        subject: `Notification for Order #${orderRef}`,
        html: wrap(
          "Platform Notification",
          `<p style="color:#4b5563;line-height:1.6;">You have a new notification. Please check your portal for details.</p>`,
          button(portalLink, "Open Portal")
        ),
      };
  }
}

// ── Main Handler ──────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const frontendBaseUrl = Deno.env.get("FRONTEND_BASE_URL") || "https://gasmask-os-nexus.lovable.app";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending events (batch of 50)
    const { data: events, error: fetchError } = await supabase
      .from("notification_events")
      .select("*")
      .eq("sent_status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("Failed to fetch events:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending events" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${events.length} notification events`);

    let sent = 0;
    let failed = 0;

    for (const event of events) {
      try {
        // Resolve user email
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name, first_name")
          .eq("id", event.user_id)
          .single();

        if (!profile?.email) {
          console.warn(`No email for user ${event.user_id}, marking failed`);
          await supabase
            .from("notification_events")
            .update({ sent_status: "failed", retry_count: event.retry_count + 1 })
            .eq("id", event.id);
          failed++;
          continue;
        }

        // Build template
        const template = buildNotificationTemplate(
          event.event_type,
          event.payload_json || {},
          frontendBaseUrl
        );

        // Send via Gmail SMTP (nodemailer)
        const sendResult = await sendEmail({
          from: "Dynasty Marketplace <Sales@brandarodigital.com>",
          to: [profile.email],
          subject: template.subject,
          html: template.html,
        });

        if (!sendResult.success) {
          throw new Error(sendResult.error || "nodemailer send failed");
        }

        // Mark sent
        await supabase
          .from("notification_events")
          .update({ sent_status: "sent", sent_at: new Date().toISOString() })
          .eq("id", event.id);

        sent++;
        console.log(`✓ Sent ${event.event_type} to ${profile.email}`);
      } catch (err) {
        const newRetry = (event.retry_count || 0) + 1;
        const newStatus = newRetry > 3 ? "failed" : "pending";

        await supabase
          .from("notification_events")
          .update({ sent_status: newStatus, retry_count: newRetry })
          .eq("id", event.id);

        failed++;
        console.error(`✗ Failed ${event.event_type} for user ${event.user_id}:`, err instanceof Error ? err.message : String(err));
      }
    }

    const result = { processed: events.length, sent, failed, timestamp: new Date().toISOString() };
    console.log("Queue processing complete:", result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("Notification queue error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
