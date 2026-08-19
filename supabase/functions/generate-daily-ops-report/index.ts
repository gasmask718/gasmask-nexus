// Daily Ops Report — collects yesterday's TopTier metrics, sends SMS digest +
// HTML email, and logs the report row. Triggered by pg_cron at 7 AM UTC.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendEmail } from "../_shared/sendEmail.ts";
import { sendTwilioSms } from "../_shared/twilioSend.ts";

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Allow override for backfill: { report_date: "YYYY-MM-DD" }
    let bodyJson: any = {};
    try { bodyJson = await req.json(); } catch { /* empty body ok */ }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const yesterday = bodyJson.report_date
      ? new Date(`${bodyJson.report_date}T00:00:00Z`)
      : new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const dayAfter = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000);
    const reportDate = yesterday.toISOString().split("T")[0];

    // === Bookings yesterday ===
    const { data: bookings } = await supabase
      .from("tt_bookings")
      .select("id, service_type, service_name, status, total_price, created_at, scheduled_at")
      .gte("created_at", yesterday.toISOString())
      .lt("created_at", dayAfter.toISOString());

    const list = bookings || [];
    const totalBookings = list.length;
    const confirmedBookings = list.filter((b: any) => b.status === "confirmed").length;
    const declinedBookings = list.filter((b: any) => b.status === "declined" || b.status === "cancelled").length;
    const pendingBookings = list.filter((b: any) => b.status === "pending").length;
    const completedBookings = list.filter((b: any) => b.status === "completed").length;
    const revenue = list
      .filter((b: any) => ["confirmed", "completed"].includes(b.status))
      .reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);

    const byService: Record<string, number> = {};
    for (const b of list) {
      const key = (b as any).service_name || (b as any).service_type || "other";
      byService[key] = (byService[key] || 0) + 1;
    }

    // === SLA breaches: still pending > 1h old ===
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { data: slaBreaches } = await supabase
      .from("tt_bookings")
      .select("id")
      .eq("status", "pending")
      .lt("created_at", oneHourAgo.toISOString());

    // === Upcoming today ===
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const { data: todayBookings } = await supabase
      .from("tt_bookings")
      .select("id")
      .eq("status", "confirmed")
      .gte("scheduled_at", today.toISOString())
      .lt("scheduled_at", tomorrow.toISOString());

    const metrics = {
      report_date: reportDate,
      bookings: {
        total: totalBookings,
        confirmed: confirmedBookings,
        declined: declinedBookings,
        pending: pendingBookings,
        completed: completedBookings,
        by_service: byService,
      },
      revenue,
      alerts: {
        sla_breaches: slaBreaches?.length || 0,
      },
      today: {
        upcoming_bookings: todayBookings?.length || 0,
      },
    };

    // === SMS summary (concise, <300 chars typically) ===
    const smsLines = [
      `📊 TopTier Daily — ${reportDate}`,
      `Bookings: ${totalBookings} (${confirmedBookings}✓ ${declinedBookings}✗ ${pendingBookings}⏳)`,
      `Revenue: ${fmtMoney(revenue)}`,
    ];
    if (slaBreaches?.length) smsLines.push(`⚠ ${slaBreaches.length} SLA breach(es)`);
    smsLines.push(`Today: ${todayBookings?.length || 0} confirmed`);
    const smsBody = smsLines.join("\n");

    // === Email HTML digest ===
    const serviceRows = Object.entries(byService)
      .map(([s, c]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${s}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right"><strong>${c}</strong></td></tr>`)
      .join("");

    const alertsHtml = slaBreaches?.length
      ? `<div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:16px 0;border-radius:4px">
           <strong style="color:#991b1b">⚠ Action Required</strong>
           <div style="color:#7f1d1d;margin-top:4px">${slaBreaches.length} pending booking(s) past 1-hour SLA</div>
         </div>`
      : "";

    const emailBody = `<!doctype html><html><body style="margin:0;font-family:-apple-system,'Segoe UI',sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <div style="background:#0a0a0a;color:#fff;padding:24px">
      <h1 style="margin:0;font-size:22px;font-weight:700">TopTier Daily Ops Report</h1>
      <div style="opacity:.7;font-size:14px;margin-top:4px">${reportDate}</div>
    </div>
    <div style="padding:24px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr>
          <td style="padding:12px;background:#f8fafc;border-radius:6px;text-align:center;width:50%">
            <div style="font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:.5px">Bookings</div>
            <div style="font-size:28px;font-weight:700;margin-top:4px">${totalBookings}</div>
            <div style="font-size:12px;color:#475569;margin-top:4px">${confirmedBookings} confirmed · ${declinedBookings} declined · ${pendingBookings} pending · ${completedBookings} completed</div>
          </td>
          <td style="width:8px"></td>
          <td style="padding:12px;background:#f8fafc;border-radius:6px;text-align:center;width:50%">
            <div style="font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:.5px">Revenue</div>
            <div style="font-size:28px;font-weight:700;margin-top:4px;color:#059669">${fmtMoney(revenue)}</div>
            <div style="font-size:12px;color:#475569;margin-top:4px">confirmed + completed</div>
          </td>
        </tr>
      </table>

      ${alertsHtml}

      ${serviceRows ? `<h2 style="font-size:14px;text-transform:uppercase;color:#64748b;letter-spacing:.5px;margin:20px 0 8px">Bookings by Service</h2>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:6px;overflow:hidden">${serviceRows}</table>` : ""}

      <h2 style="font-size:14px;text-transform:uppercase;color:#64748b;letter-spacing:.5px;margin:20px 0 8px">Today</h2>
      <div style="background:#f8fafc;padding:12px;border-radius:6px"><strong>${todayBookings?.length || 0}</strong> confirmed bookings scheduled</div>
    </div>
    <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;text-align:center">
      TopTier Experience · Dynasty Connect LLC · Daily automated report
    </div>
  </div>
</body></html>`;

    // === Send ===
    const adminPhone = Deno.env.get("ADMIN_ALERT_PHONE");
    const adminEmail = Deno.env.get("ADMIN_ALERT_EMAIL");
    const sentTo: string[] = [];

    if (adminPhone) {
      // Group A: staff-owned constant. In-process send, class stated
      // explicitly — send-sms now refuses an unclassified send.
      const r = await sendTwilioSms({
        to: adminPhone,
        body: smsBody,
        suppressionClass: "internal",
        source: "generate-daily-ops-report",
      });
      if (r.success) sentTo.push(`sms:${adminPhone}`);
      else console.error("sms send failed", r.errorMessage);
    }

    if (adminEmail) {
      try {
        const r = await sendEmail({
          to: adminEmail,
          subject: `📊 TopTier Daily Ops Report — ${reportDate}`,
          html: emailBody,
        });
        if (r.success) sentTo.push(`email:${adminEmail}`);
        else console.error("email failed", r.error);
      } catch (e) { console.error("email send failed", e); }
    }

    // === Log ===
    await supabase.from("daily_ops_reports").upsert({
      report_date: reportDate,
      metrics,
      email_body: emailBody,
      sms_body: smsBody,
      sent_to: sentTo,
      generated_at: new Date().toISOString(),
    }, { onConflict: "report_date" });

    return new Response(JSON.stringify({ ok: true, metrics, sent_to: sentTo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-daily-ops-report error", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
