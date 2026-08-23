/**
 * dd-reorder-nudges  (cron-driven, also callable on-demand)
 *
 * Finds wholesalers with marketplace_inventory at or below reorder_point,
 * groups the low SKUs per supplier, drafts an SMS via AI, and writes one
 * draft per supplier into communication_drafts (status='draft', ai_generated=true).
 *
 * Respects:
 *   - cooldown (no nudge if one drafted/sent within COOLDOWN_HOURS)
 *   - per-supplier daily cap
 *   - DNC (contact_compliance.dnc=true) — skipped, never queued
 *   - auto_send flag (drafts-only by default; flip in client constants for now)
 *
 * POST { dry_run?: boolean, only_wholesaler_id?: uuid } -> { processed, drafted, skipped, items: [...] }
 *
 * Marked as AI-generated via `ai_generated=true` and a leading "[AI draft]" tag
 * the operator can strip before sending.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { outreachAllowed } from "../_shared/outreachGate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MODEL = "google/gemini-3-flash-preview";
const COOLDOWN_HOURS = 24;
const PER_SUPPLIER_DAILY_CAP = 1;
const MAX_SUPPLIERS_PER_RUN = 50;
const BODY_MAX = 320;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // OUTREACH GATE (2026-08-23): even though this writes DRAFTS by default, it
  // is one flag away from auto-send — gated with everything else.
  if (!(await outreachAllowed("dd_reorder_nudges"))) {
    return new Response(JSON.stringify({ ok: true, gated: true, switch: "dd_reorder_nudges", processed: 0, drafted: 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty for cron */ }
  const dryRun = !!body.dry_run;
  const onlyId: string | undefined = body.only_wholesaler_id;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. find low-stock inventory rows; group by wholesaler.
  let invQ = supabase
    .from("marketplace_inventory")
    .select("wholesaler_id, product_id, quantity_available, reorder_point")
    .not("reorder_point", "is", null);
  if (onlyId) invQ = invQ.eq("wholesaler_id", onlyId);
  const { data: invRows, error: invErr } = await invQ;
  if (invErr) return j({ error: invErr.message }, 500);

  const lowBySupplier = new Map<string, Array<{ product_id: string; qty: number; reorder: number }>>();
  for (const r of invRows ?? []) {
    const reorder = r.reorder_point ?? 10;
    if (r.quantity_available <= reorder) {
      const list = lowBySupplier.get(r.wholesaler_id) ?? [];
      list.push({ product_id: r.product_id, qty: r.quantity_available, reorder });
      lowBySupplier.set(r.wholesaler_id, list);
    }
  }
  const supplierIds = [...lowBySupplier.keys()].slice(0, MAX_SUPPLIERS_PER_RUN);

  if (supplierIds.length === 0) {
    return j({ processed: 0, drafted: 0, skipped: 0, note: "no low-stock suppliers", items: [] });
  }

  // 2. profiles + recent draft check (cooldown).
  const [{ data: profiles }, { data: recentDrafts }] = await Promise.all([
    supabase.from("wholesaler_profiles")
      .select("id, company_name, contact_name, phone, email, status, routing_paused")
      .in("id", supplierIds),
    supabase.from("communication_drafts")
      .select("entity_id, created_at, automation_source")
      .eq("entity_type", "wholesaler")
      .eq("automation_source", "dd-reorder-nudges")
      .in("entity_id", supplierIds)
      .gte("created_at", new Date(Date.now() - COOLDOWN_HOURS * 3600_000).toISOString()),
  ]);

  const recentCount = new Map<string, number>();
  for (const d of recentDrafts ?? []) {
    recentCount.set(d.entity_id, (recentCount.get(d.entity_id) ?? 0) + 1);
  }
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  // 3. resolve product names + DNC check, then draft.
  const allProductIds = supplierIds.flatMap((id) => (lowBySupplier.get(id) ?? []).map((r) => r.product_id));
  const { data: productRows } = await supabase
    .from("products_all" as any)
    .select("id, name")
    .in("id", allProductIds.length ? allProductIds : ["00000000-0000-0000-0000-000000000000"]);
  const productMap = new Map<string, string>(
    (productRows ?? []).map((p: any) => [p.id, p.name ?? "product"]),
  );

  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  const items: any[] = [];
  let drafted = 0, skipped = 0;

  for (const wid of supplierIds) {
    const profile = profileMap.get(wid);
    if (!profile) { items.push({ wholesaler_id: wid, skipped: "no profile" }); skipped++; continue; }
    if (profile.status !== "verified") { items.push({ wholesaler_id: wid, skipped: `status=${profile.status}` }); skipped++; continue; }
    if (profile.routing_paused) { items.push({ wholesaler_id: wid, skipped: "routing_paused" }); skipped++; continue; }
    if (!profile.phone) { items.push({ wholesaler_id: wid, skipped: "no phone" }); skipped++; continue; }

    // cooldown / daily cap
    if ((recentCount.get(wid) ?? 0) >= PER_SUPPLIER_DAILY_CAP) {
      items.push({ wholesaler_id: wid, skipped: "cooldown" }); skipped++; continue;
    }

    // DNC check
    const phoneDigits = profile.phone.replace(/\D/g, "");
    if (phoneDigits.length >= 10) {
      const e164 = phoneDigits.startsWith("1") ? `+${phoneDigits}` : `+1${phoneDigits.slice(-10)}`;
      const { data: dnc } = await supabase
        .from("contact_compliance")
        .select("dnc")
        .eq("phone_e164", e164)
        .eq("dnc", true)
        .limit(1);
      if (dnc && dnc.length > 0) {
        items.push({ wholesaler_id: wid, skipped: "dnc" }); skipped++; continue;
      }
    }

    const lows = lowBySupplier.get(wid) ?? [];
    const enriched = lows.map((r) => ({
      name: productMap.get(r.product_id) ?? "product",
      qty: r.qty,
      reorder: r.reorder,
    }));

    const aiBody = await draftNudge(aiKey, profile, enriched);
    const body = `[AI draft] ${aiBody}`.slice(0, BODY_MAX);

    if (!dryRun) {
      const { error: insErr } = await supabase.from("communication_drafts").insert({
        channel: "sms",
        body,
        recipient_phone: profile.phone,
        recipient_name: profile.contact_name || profile.company_name,
        entity_type: "wholesaler",
        entity_id: wid,
        ai_generated: true,
        automation_source: "dd-reorder-nudges",
        context_data: { low_skus: enriched, generated_at: new Date().toISOString() },
        status: "draft",
        requires_approval: true,
      });
      if (insErr) {
        items.push({ wholesaler_id: wid, error: insErr.message }); skipped++; continue;
      }
    }
    drafted++;
    items.push({
      wholesaler_id: wid,
      company: profile.company_name,
      low_count: enriched.length,
      preview: body,
    });
  }

  return j({ processed: supplierIds.length, drafted, skipped, dry_run: dryRun, items });
});

async function draftNudge(
  key: string | undefined,
  profile: any,
  lows: Array<{ name: string; qty: number; reorder: number }>,
): Promise<string> {
  const fallback = `Hi ${profile.contact_name || profile.company_name} — heads up, ${lows.length} of your SKUs on Dynasty Direct are at/below reorder point (${lows.slice(0, 3).map((l) => `${l.name}: ${l.qty}/${l.reorder}`).join(", ")}${lows.length > 3 ? "…" : ""}). Reply RESTOCK to get back in queue.`;
  if (!key) return fallback;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: `Write a short B2B SMS (single segment, <=200 chars) nudging a supplier to restock low SKUs on the Dynasty Direct marketplace. Warm, direct, no emojis. End with a clear next step ("reply RESTOCK" or "log in to restock"). Operator will review before sending.` },
          { role: "user", content: `Supplier: ${profile.company_name} (${profile.contact_name || "team"})\nLow SKUs:\n${lows.slice(0, 5).map((l) => `- ${l.name}: ${l.qty} on hand / reorder at ${l.reorder}`).join("\n")}${lows.length > 5 ? `\n(+ ${lows.length - 5} more)` : ""}` },
        ],
      }),
    });
    if (!resp.ok) return fallback;
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || fallback;
  } catch { return fallback; }
}

const j = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
