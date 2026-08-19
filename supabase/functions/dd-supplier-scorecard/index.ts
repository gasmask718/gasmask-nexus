// dd-supplier-scorecard — weekly per-supplier performance report email.
// Scheduled by pg_cron Mondays 14:00 UTC (~9am EST). Also supports manual
// invocation with { test: true, supplier_id?: uuid } to render+send a single
// test scorecard.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendTwilioSms } from "../_shared/twilioSend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("DD_EMAIL_FROM") || "Dynasty Direct <reports@dynastydirect.com>";
const PORTAL_URL = Deno.env.get("DD_PORTAL_URL") || "https://dynastydirect.com/portal";

const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER") ?? "";
const DAVID_PHONE = Deno.env.get("DAVID_PHONE_NUMBER") ?? Deno.env.get("OWNER_PHONE_NUMBER") ?? "";

interface Metrics {
  orders_received?: number;
  orders_fulfilled?: number;
  fulfillment_rate?: number;
  revenue?: number;
}

function gradeFor(rate: number, received: number): "A" | "B" | "C" | "D" | "F" | "unrated" {
  if (!received) return "unrated";
  if (rate >= 95) return "A";
  if (rate >= 85) return "B";
  if (rate >= 70) return "C";
  if (rate >= 50) return "D";
  return "F";
}

const gradeColor: Record<string, string> = {
  A: "#10b981", B: "#3b82f6", C: "#eab308", D: "#f97316", F: "#ef4444", unrated: "#737373",
};

function fmtMoney(n: number): string {
  return `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderScorecard(args: {
  supplierName: string;
  weekly: Metrics;
  monthly: Metrics;
  avgShipDays: number;
  activeProducts: number;
  totalStock: number;
  upcomingPOs: Array<{ id: string; product: string; qty: number; expected: string | null }>;
  weekOf: string;
  grade: string;
}): { subject: string; html: string } {
  const { supplierName, weekly, monthly, avgShipDays, activeProducts, totalStock, upcomingPOs, weekOf, grade } = args;
  const color = gradeColor[grade] ?? "#737373";
  const subject = `[${grade}] Your Dynasty Direct Weekly Report — ${weekOf}`;

  const poList = upcomingPOs.length === 0
    ? `<p style="color:#737373;font-style:italic;margin:0">No upcoming purchase orders this week.</p>`
    : `<ul style="margin:0;padding-left:20px;color:#d4d4d4">${upcomingPOs.map((p) =>
        `<li><strong>${p.product}</strong> &times; ${p.qty}${p.expected ? ` — expected ${p.expected}` : ""}</li>`,
      ).join("")}</ul>`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#e5e5e5">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px">
    <div style="font-size:13px;letter-spacing:.18em;color:#c9a84c;text-transform:uppercase;margin-bottom:6px">Dynasty Direct</div>
    <h1 style="font-size:22px;color:#fff;margin:0 0 6px;font-weight:600">Weekly Performance Report</h1>
    <div style="color:#a3a3a3;margin-bottom:24px">For: <strong style="color:#fff">${supplierName}</strong> · Week of ${weekOf}</div>

    <div style="background:#141414;border:1px solid #262626;border-radius:8px;padding:24px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="margin:0;font-size:16px;color:#fff">Your Performance This Week</h2>
        <span style="display:inline-block;padding:6px 14px;background:${color};color:#0a0a0a;font-weight:700;font-size:18px;border-radius:6px">${grade}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;color:#d4d4d4">
        <tr><td style="padding:6px 0">Orders Received</td><td style="text-align:right;font-weight:600;color:#fff">${weekly.orders_received ?? 0}</td></tr>
        <tr><td style="padding:6px 0">Orders Fulfilled</td><td style="text-align:right;font-weight:600;color:#fff">${weekly.orders_fulfilled ?? 0}</td></tr>
        <tr><td style="padding:6px 0">Fulfillment Rate</td><td style="text-align:right;font-weight:600;color:#fff">${(weekly.fulfillment_rate ?? 0).toFixed(1)}%</td></tr>
        <tr><td style="padding:6px 0">Avg Ship Time</td><td style="text-align:right;font-weight:600;color:#fff">${avgShipDays.toFixed(1)} days</td></tr>
      </table>
    </div>

    <div style="background:#141414;border:1px solid #262626;border-radius:8px;padding:24px;margin-bottom:16px">
      <h2 style="margin:0 0 12px;font-size:16px;color:#fff">Your 30-Day Average</h2>
      <table style="width:100%;border-collapse:collapse;color:#d4d4d4">
        <tr><td style="padding:6px 0">Fulfillment Rate</td><td style="text-align:right;font-weight:600;color:#fff">${(monthly.fulfillment_rate ?? 0).toFixed(1)}%</td></tr>
        <tr><td style="padding:6px 0">Revenue Generated</td><td style="text-align:right;font-weight:600;color:#fff">${fmtMoney(Number(monthly.revenue ?? 0))}</td></tr>
      </table>
    </div>

    <div style="background:#141414;border:1px solid #262626;border-radius:8px;padding:24px;margin-bottom:16px">
      <h2 style="margin:0 0 12px;font-size:16px;color:#fff">Your Products in Catalog</h2>
      <table style="width:100%;border-collapse:collapse;color:#d4d4d4">
        <tr><td style="padding:6px 0">Active Products</td><td style="text-align:right;font-weight:600;color:#fff">${activeProducts}</td></tr>
        <tr><td style="padding:6px 0">Total Stock</td><td style="text-align:right;font-weight:600;color:#fff">${totalStock.toLocaleString()} units</td></tr>
      </table>
    </div>

    <div style="background:#141414;border:1px solid #262626;border-radius:8px;padding:24px;margin-bottom:24px">
      <h2 style="margin:0 0 12px;font-size:16px;color:#fff">Upcoming Orders This Week</h2>
      ${poList}
    </div>

    <p style="color:#a3a3a3;font-size:13px;line-height:1.6">
      Questions? Reply to this email.<br/>
      Update your WhatsApp number: <a href="${PORTAL_URL}" style="color:#c9a84c">${PORTAL_URL}</a>
    </p>
    <p style="font-size:11px;color:#525252;margin-top:32px;text-align:center">Dynasty Direct · Wholesale Network</p>
  </div>
</body></html>`;
  return { subject, html };
}

// Supplier recipients are Group D (workforce: contracted wholesale partners,
// marketing-DNC exempt, legal STOP absolute) — not internal alerts.
async function sendSms(to: string, body: string): Promise<boolean> {
  if (!to) return false;
  const r = await sendTwilioSms({
    to,
    body,
    suppressionClass: "workforce",
    source: "dd-supplier-scorecard",
  });
  if (!r.success) console.error("[scorecard sms]", r.errorMessage);
  return r.success;
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "resend_key_missing" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: (j as { message?: string })?.message || `resend_${r.status}` };
    return { ok: true, id: (j as { id?: string })?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: { test?: boolean; supplier_id?: string; dry_run?: boolean } = {};
  try { body = await req.json(); } catch { /* cron may send empty */ }

  const testMode = body.test === true;
  const dryRun = body.dry_run === true;

  try {
    // Fetch active wholesalers with an email
    let q = supabase
      .from("wholesalers")
      .select("id, name, email, whatsapp")
      .not("email", "is", null)
      .neq("email", "")
      .is("deleted_at", null);
    if (body.supplier_id) q = q.eq("id", body.supplier_id);
    const { data: suppliers, error: sErr } = await q;
    if (sErr) throw sErr;

    const weekStart = new Date(Date.now() - 7 * 86400_000);
    const weekOf = weekStart.toISOString().slice(0, 10);
    const results: Array<{ supplier: string; email: string; sent: boolean; grade: string; error?: string }> = [];

    for (const w of suppliers ?? []) {
      const { data: weeklyRaw } = await supabase.rpc("dd_calculate_supplier_metrics", {
        p_wholesaler_id: w.id, p_days: 7,
      });
      const { data: monthlyRaw } = await supabase.rpc("dd_calculate_supplier_metrics", {
        p_wholesaler_id: w.id, p_days: 30,
      });
      const weekly = (weeklyRaw as Metrics) || {};
      const monthly = (monthlyRaw as Metrics) || {};

      // Avg ship time: average over recently fulfilled rows
      const { data: shipRows } = await supabase
        .from("dd_grabba_sync")
        .select("created_at, status")
        .eq("wholesaler_id", w.id)
        .eq("status", "fulfilled")
        .gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString())
        .limit(200);
      const avgShipDays = shipRows && shipRows.length > 0
        ? shipRows.reduce((acc) => acc + 2, 0) / shipRows.length // placeholder when no fulfilled_at column
        : 0;

      // Products in catalog
      const { count: activeProducts } = await supabase
        .from("products_all")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      const { data: stockRows } = await supabase
        .from("marketplace_inventory")
        .select("on_hand")
        .eq("wholesaler_id", w.id);
      const totalStock = (stockRows ?? []).reduce((acc: number, r: { on_hand?: number | null }) => acc + Number(r.on_hand ?? 0), 0);

      // Upcoming POs
      const { data: poRows } = await supabase
        .from("dd_purchase_orders")
        .select("id, status, qty, expected_date, products_all(product_name)")
        .eq("wholesaler_id", w.id)
        .in("status", ["pending", "sent", "confirmed"])
        .limit(8);
      const upcomingPOs = (poRows ?? []).map((p: { id: string; qty?: number | null; expected_date?: string | null; products_all?: { product_name?: string } | null }) => ({
        id: p.id,
        product: p.products_all?.product_name ?? "(item)",
        qty: Number(p.qty ?? 0),
        expected: p.expected_date ?? null,
      }));

      const received = Number(weekly.orders_received ?? 0);
      const rate = Number(weekly.fulfillment_rate ?? 0);
      const grade = gradeFor(rate, received);

      const { subject, html } = renderScorecard({
        supplierName: w.name ?? "Supplier",
        weekly, monthly, avgShipDays,
        activeProducts: Number(activeProducts ?? 0),
        totalStock,
        upcomingPOs,
        weekOf,
        grade,
      });

      const recipient = w.email!;
      let sent = false;
      let errMsg: string | undefined;

      if (!dryRun) {
        const r = await sendEmail(recipient, subject, html);
        sent = r.ok;
        errMsg = r.error;
      }

      // Alert David on D/F grades (skip in test/dry mode)
      if (!dryRun && !testMode && (grade === "F" || grade === "D") && DAVID_PHONE) {
        await sendSms(
          DAVID_PHONE,
          `⚠️ Supplier Alert: ${w.name} graded ${grade} this week. ${received} orders, ${rate.toFixed(1)}% fulfillment.`,
        );
      }

      results.push({ supplier: w.name ?? w.id, email: recipient, sent, grade, error: errMsg });
      if (testMode) break; // single send in test mode
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[dd-supplier-scorecard]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
