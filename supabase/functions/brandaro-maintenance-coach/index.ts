// AI Maintenance Coach — analyzes a Brandaro client and inserts maintenance tasks + upsell opportunities.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SYSTEM_PROMPT = `You are Brandaro's "Maintenance Coach" — an AI ops analyst for a digital-marketing agency.

Given a Brandaro client's profile, active products, recent invoices and recent communication signals, your job is to surface:
  1. Concrete maintenance / fulfillment tasks the team owes this client THIS MONTH (deliverables, change requests, billing follow-ups).
  2. Upsell opportunities — additional products from the catalogue this client is most likely to buy next, with a clear reasoning.

You MUST call the "emit_recommendations" tool exactly once. Do NOT respond in plain text.
Be concrete, action-oriented, and conservative — only flag what truly needs attention.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "emit_recommendations",
    description: "Emit maintenance tasks and upsell opportunities for the client.",
    parameters: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              task_type: {
                type: "string",
                enum: ["monthly_deliverable", "change_request", "billing_alert", "ai_upsell", "manual"],
              },
              title: { type: "string" },
              description: { type: "string" },
              priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
              reasoning: { type: "string" },
            },
            required: ["task_type", "title", "priority", "reasoning"],
            additionalProperties: false,
          },
        },
        upsells: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_sku: { type: "string", description: "SKU from the catalogue (e.g. BRN-SEO-LOCAL)." },
              reasoning: { type: "string" },
              estimated_value: { type: "number" },
            },
            required: ["product_sku", "reasoning"],
            additionalProperties: false,
          },
        },
        summary: { type: "string", description: "2-3 sentence executive summary." },
      },
      required: ["tasks", "upsells", "summary"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id } = await req.json();
    if (!lead_id) {
      return json({ error: "lead_id required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const [leadRes, productsRes, clientProductsRes, invoicesRes] = await Promise.all([
      supabase.from("brandaro_leads_master").select("*").eq("id", lead_id).maybeSingle(),
      supabase.from("brandaro_products").select("id, sku, name, category, product_type, price").eq("is_active", true),
      supabase
        .from("brandaro_client_products")
        .select("*, product:brandaro_products(sku, name, category, product_type)")
        .eq("lead_id", lead_id),
      supabase
        .from("brandaro_client_invoices")
        .select("invoice_number, status, total, amount_paid, issued_at, due_at, paid_at")
        .eq("lead_id", lead_id)
        .order("issued_at", { ascending: false })
        .limit(10),
    ]);

    if (leadRes.error || !leadRes.data) {
      return json({ error: "Lead not found" }, 404);
    }

    const ctx = {
      client: leadRes.data,
      active_products: clientProductsRes.data ?? [],
      recent_invoices: invoicesRes.data ?? [],
      catalogue: productsRes.data ?? [],
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Client context:\n\n${JSON.stringify(ctx, null, 2)}` },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "emit_recommendations" } },
      }),
    });

    if (aiResp.status === 429) return json({ error: "Rate limited, try again shortly." }, 429);
    if (aiResp.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      return json({ error: "AI gateway error" }, 500);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "No structured response from AI" }, 500);

    const args = JSON.parse(toolCall.function.arguments || "{}");
    const tasks = Array.isArray(args.tasks) ? args.tasks : [];
    const upsells = Array.isArray(args.upsells) ? args.upsells : [];

    // Insert tasks
    const insertedTasks = tasks.length
      ? await supabase
          .from("brandaro_maintenance_tasks")
          .insert(
            tasks.map((t: any) => ({
              lead_id,
              task_type: t.task_type,
              title: t.title,
              description: t.description ?? null,
              priority: t.priority ?? "normal",
              ai_generated: true,
              ai_reasoning: t.reasoning,
              status: "open",
            }))
          )
          .select()
      : { data: [], error: null };

    // Resolve product SKUs to ids
    const skuMap = new Map(
      (productsRes.data ?? []).map((p: any) => [p.sku, p])
    );
    const upsellRows = upsells
      .map((u: any) => {
        const product = skuMap.get(u.product_sku);
        if (!product) return null;
        return {
          lead_id,
          product_id: product.id,
          stage: "suggested",
          reasoning: u.reasoning,
          estimated_value: u.estimated_value ?? product.price,
          ai_generated: true,
        };
      })
      .filter(Boolean);

    const insertedUpsells = upsellRows.length
      ? await supabase.from("brandaro_upsell_opportunities").insert(upsellRows).select()
      : { data: [], error: null };

    return json({
      summary: args.summary,
      tasks_created: insertedTasks.data?.length ?? 0,
      upsells_created: insertedUpsells.data?.length ?? 0,
      tasks: insertedTasks.data,
      upsells: insertedUpsells.data,
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
