/**
 * dd-draft-outreach
 *
 * Compose a re-engage / onboard / general outreach message for a supplier.
 * Returns the AI draft; the caller decides whether to push to communication_drafts.
 * Never auto-sends.
 *
 * POST { wholesaler_id, intent: 'reengage'|'onboard'|'restock'|'check-in', channel: 'sms'|'email' }
 *   -> { body, subject?, model, context_used, ai_generated: true }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MODEL = "google/gemini-3-flash-preview";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { wholesaler_id, intent = "check-in", channel = "sms" } = await req.json();
    if (!wholesaler_id) return j({ error: "wholesaler_id required" }, 400);
    if (!["sms", "email"].includes(channel)) return j({ error: "bad channel" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Context: profile + last order + product count + inventory low-count.
    const { data: w, error: wErr } = await supabase
      .from("wholesaler_profiles")
      .select("id, company_name, contact_name, phone, email, status, routing_paused, created_at")
      .eq("id", wholesaler_id)
      .single();
    if (wErr || !w) return j({ error: wErr?.message ?? "supplier not found" }, 404);

    const [{ data: lastOrder }, { count: productCount }, { data: lowInv }] = await Promise.all([
      supabase.from("marketplace_orders")
        .select("created_at, total")
        .eq("wholesaler_id", wholesaler_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("products_all" as any)
        .select("id", { count: "exact", head: true })
        .eq("wholesaler_id", wholesaler_id),
      supabase.from("marketplace_inventory")
        .select("quantity_available, reorder_point")
        .eq("wholesaler_id", wholesaler_id)
        .lte("quantity_available", 10),
    ]);

    const context = {
      company: w.company_name,
      contact: w.contact_name,
      status: w.status,
      routing_paused: w.routing_paused,
      onboarded_days_ago: daysAgo(w.created_at),
      last_order_days_ago: lastOrder ? daysAgo(lastOrder.created_at) : null,
      product_count: productCount ?? 0,
      low_stock_skus: lowInv?.length ?? 0,
    };

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return j({ error: "LOVABLE_API_KEY not configured" }, 500);

    const system = `You write supplier-facing outreach for Dynasty Direct, a multi-vendor wholesale marketplace.

Channel: ${channel.toUpperCase()}
Intent: ${intent}
Style: warm, direct, business-to-business. No emojis. No links unless the operator adds them later.
Constraints:
- ${channel === "sms" ? "Plain text. Aim for 1 SMS segment (~160 chars), max 320." : "Short email, 3–6 lines. Include a subject line."}
- Address the contact by name if available; otherwise greet the company.
- Be specific: reference their context (days since last order, low-stock SKUs, status, etc.) only when relevant.
- Operator will edit before sending — leave a clear ask / next step.

${channel === "email"
  ? `Return JSON: { "subject": "<short>", "body": "<email body>" }`
  : `Return JSON: { "body": "<sms text>" }`}`;

    const userPrompt = `Compose a ${intent} ${channel} for this supplier:
${JSON.stringify(context, null, 2)}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      if (resp.status === 429) return j({ error: "rate limited" }, 429);
      if (resp.status === 402) return j({ error: "credits exhausted" }, 402);
      return j({ error: `ai gateway ${resp.status}` }, 502);
    }
    const data = await resp.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");

    return j({
      body: String(parsed.body ?? "").trim(),
      subject: parsed.subject ? String(parsed.subject).trim() : undefined,
      model: MODEL,
      ai_generated: true,
      context_used: context,
    });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

const daysAgo = (iso: string | null) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;
const j = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
