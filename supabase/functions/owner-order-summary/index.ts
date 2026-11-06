// Daily 8pm New York owner summary of field order requests.
// Invoked hourly by pg_cron at 00:00 and 01:00 UTC; only acts when it is the 20:00 hour in New York
// (covers DST). Dedupe keys on the ATTEMPT (communication_logs idempotency key), never on success.
// Recipients are fixed owner contacts (internal class). Text goes through twilioSend; email via Resend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendTwilioSms } from "../_shared/twilioSend.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const OWNER_PHONE = "+17183089391";
const OWNER_EMAIL = "gasmaskapprovedllc@gmail.com";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function nyParts(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: { force?: boolean; date?: string } = {};
  try { body = await req.json(); } catch { /* cron body */ }
  // force/date only for owner-authenticated manual runs
  if (body.force) {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") || "";
    const { data: u } = await sb.auth.getUser(token);
    const { data: ok } = u?.user ? await sb.rpc("field_order_is_owner", { p_user: u.user.id }) : { data: false };
    if (!ok) return json({ error: "Owner only" }, 403);
  }
  const ny = nyParts();
  if (!body.force && ny.hour !== 20) return json({ skipped: "not 8pm New York", ny });
  const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : ny.date;

  const { data: s, error } = await sb.rpc("field_order_daily_summary", { p_date: date });
  if (error) return json({ error: error.message }, 500);
  const brands = Object.entries((s?.brands || {}) as Record<string, number>).map(([n, b]) => `${n} ${b}`).join(", ") || "none";
  const text = `GasMask orders ${date}: ${s.requests} requests, ${s.stores} stores, ${s.ambassadors} ambassadors. Boxes: ${brands}.`;
  const out: Record<string, unknown> = { date, summary: s };

  for (const channel of ["sms", "email"] as const) {
    const key = `owner-order-summary-${date}-${channel}`;
    const { data: claimed, error: ce } = await sb.from("communication_logs").upsert({
      channel, direction: "outbound", summary: text, recipient_phone: channel === "sms" ? OWNER_PHONE : null,
      idempotency_key: key, delivery_status: "queued", metadata: { source: "owner-order-summary", date, to: channel === "email" ? OWNER_EMAIL : OWNER_PHONE },
    }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id");
    if (ce) { out[channel] = { error: ce.message }; continue; }
    if (!claimed?.length) { out[channel] = "already attempted"; continue; }
    const id = claimed[0].id;
    if (channel === "sms") {
      const r = await sendTwilioSms({ to: OWNER_PHONE, body: text, suppressionClass: "internal", source: "owner-order-summary" });
      await sb.from("communication_logs").update({ delivery_status: r.success ? "sent_to_provider" : "failed", error_code: r.errorCode, metadata: { source: "owner-order-summary", date, sid: r.sid, error: r.errorMessage } }).eq("id", id);
      out.sms = { success: r.success, errorCode: r.errorCode, error: r.errorMessage };
    } else {
      const key2 = Deno.env.get("RESEND_API_KEY");
      if (!key2) { await sb.from("communication_logs").update({ delivery_status: "failed", error_code: "no_email_key" }).eq("id", id); out.email = { error: "email key missing" }; continue; }
      const html = `<h2>GasMask order requests — ${date}</h2><p>${s.requests} requests · ${s.stores} stores · ${s.ambassadors} ambassadors</p><ul>${Object.entries((s.brands || {}) as Record<string, number>).map(([n, b]) => `<li>${n}: ${b} boxes</li>`).join("")}</ul>`;
      const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key2}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: Deno.env.get("DD_EMAIL_FROM") || "Dynasty Direct <orders@dynastydirect.com>", to: [OWNER_EMAIL], subject: `GasMask orders ${date}`, html }) });
      const rb = await res.text();
      await sb.from("communication_logs").update({ delivery_status: res.ok ? "sent_to_provider" : "failed", error_code: res.ok ? null : String(res.status), metadata: { source: "owner-order-summary", date, provider: "resend", response: rb.slice(0, 500) } }).eq("id", id);
      out.email = { ok: res.ok, status: res.status, body: rb.slice(0, 300) };
    }
  }
  return json(out);
});
