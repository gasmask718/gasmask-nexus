import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendOpsAlert } from "../_shared/opsAlert.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProductInput {
  product_name: string;
  supplier_cost: number;
  supplier_rating?: number;
  total_orders?: number;
  shipping_days?: number;
  category?: string;
  supplier_url?: string;
  supplier_product_id?: string;
  product_image?: string;
  ship_from?: string;
}

interface ScoredProduct extends ProductInput {
  ai_score: number;
  margin_score: number;
  demand_score: number;
  competition_score: number;
  niche_alignment_score: number;
  shipping_score: number;
  ai_reasoning: string;
  suggested_sell_price: number;
  profit_margin: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");
  const DAVID_PHONE_NUMBER = Deno.env.get("DAVID_PHONE_NUMBER");

  if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing required environment variables" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Create run log entry
  const { data: runLog, error: runLogError } = await supabase
    .from("ai_scoring_runs")
    .insert({ run_status: "running", products_analyzed: 0 })
    .select("id")
    .single();

  if (runLogError || !runLog) {
    console.error("Failed to create run log:", runLogError);
    return new Response(
      JSON.stringify({ error: "Failed to create run log" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const runId = runLog.id;

  try {
    // Parse input — accept body products or default to empty
    let bodyText = "";
    try { bodyText = await req.text(); } catch { /* empty body is fine */ }
    let body: { products?: ProductInput[] } = {};
    try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { body = {}; }

    const products: ProductInput[] = body.products || [];

    if (products.length === 0) {
      // Update run log
      await supabase.from("ai_scoring_runs").update({
        run_status: "completed",
        products_analyzed: 0,
        products_scored: 0,
        products_approved: 0,
        completed_at: new Date().toISOString(),
      }).eq("id", runId);

      return new Response(
        JSON.stringify({ success: true, message: "No products to score", run_id: runId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Score products in batches of 20
    const BATCH_SIZE = 20;
    const allScored: ScoredProduct[] = [];

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);

      const systemPrompt = `You are an AI product scoring agent for Unforgettable Times USA, an event rental and party supply dropshipping store. Your job is to analyze products and score them 1-10 on how well they will sell.

Scoring criteria:
- Profit margin potential (supplier cost vs sellable price)
- Demand velocity (orders and reviews)
- Competition level (lower is better)
- Event/party niche alignment (must be relevant to events, parties, weddings, celebrations)
- Shipping time (under 15 days preferred)`;

      const userPrompt = `Score these products. For each product, return:
- ai_score (1-10 overall)
- margin_score (1-10)
- demand_score (1-10)
- competition_score (1-10)
- niche_alignment_score (1-10)
- shipping_score (1-10)
- ai_reasoning (brief explanation)
- suggested_sell_price (USD)
- profit_margin (percentage as decimal, e.g. 0.45 for 45%)

Products:
${JSON.stringify(batch, null, 2)}`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_scored_products",
                description: "Return the array of scored products",
                parameters: {
                  type: "object",
                  properties: {
                    scored_products: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          product_name: { type: "string" },
                          ai_score: { type: "integer", minimum: 1, maximum: 10 },
                          margin_score: { type: "integer", minimum: 1, maximum: 10 },
                          demand_score: { type: "integer", minimum: 1, maximum: 10 },
                          competition_score: { type: "integer", minimum: 1, maximum: 10 },
                          niche_alignment_score: { type: "integer", minimum: 1, maximum: 10 },
                          shipping_score: { type: "integer", minimum: 1, maximum: 10 },
                          ai_reasoning: { type: "string" },
                          suggested_sell_price: { type: "number" },
                          profit_margin: { type: "number" },
                        },
                        required: [
                          "product_name", "ai_score", "margin_score", "demand_score",
                          "competition_score", "niche_alignment_score", "shipping_score",
                          "ai_reasoning", "suggested_sell_price", "profit_margin",
                        ],
                      },
                    },
                  },
                  required: ["scored_products"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_scored_products" } },
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`AI Gateway error (${aiResponse.status}):`, errText);
        if (aiResponse.status === 429) {
          // Wait and retry on rate limit
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        throw new Error(`AI Gateway returned ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();

      // Extract tool call result
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        console.error("No tool call in AI response:", JSON.stringify(aiData));
        continue;
      }

      let parsed: { scored_products: ScoredProduct[] };
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse tool call arguments:", e);
        continue;
      }

      // Merge AI scores back with original product data
      for (const scored of parsed.scored_products) {
        const original = batch.find(
          (p) => p.product_name.toLowerCase() === scored.product_name.toLowerCase()
        );
        if (original) {
          allScored.push({ ...original, ...scored });
        } else {
          allScored.push(scored);
        }
      }
    }

    // Save to trending_products
    let approvedCount = 0;
    const inserts = allScored.map((p) => {
      const status = p.ai_score >= 8 ? "approved" : "pending";
      if (status === "approved") approvedCount++;
      return {
        product_name: p.product_name,
        supplier: p.supplier_url ? "autods" : null,
        supplier_product_id: p.supplier_product_id || null,
        supplier_url: p.supplier_url || null,
        product_image: p.product_image || null,
        category: p.category || null,
        supplier_cost: p.supplier_cost || null,
        suggested_sell_price: p.suggested_sell_price || null,
        profit_margin: p.profit_margin ? Math.round(p.profit_margin * 100) / 100 : null,
        supplier_rating: p.supplier_rating || null,
        total_orders: p.total_orders || null,
        shipping_days: p.shipping_days || null,
        ship_from: p.ship_from || null,
        ai_score: Math.min(10, Math.max(1, p.ai_score)),
        margin_score: p.margin_score || null,
        demand_score: p.demand_score || null,
        competition_score: p.competition_score || null,
        niche_alignment_score: p.niche_alignment_score || null,
        shipping_score: p.shipping_score || null,
        ai_reasoning: p.ai_reasoning || null,
        status,
        source: "autods",
      };
    });

    if (inserts.length > 0) {
      const { error: insertError } = await supabase
        .from("trending_products")
        .insert(inserts);

      if (insertError) {
        console.error("Failed to insert scored products:", insertError);
        throw new Error(`DB insert failed: ${insertError.message}`);
      }
    }

    // Find top scorer
    const topProduct = allScored.reduce(
      (best, p) => (p.ai_score > (best?.ai_score || 0) ? p : best),
      allScored[0]
    );

    // Update run log
    await supabase.from("ai_scoring_runs").update({
      run_status: "completed",
      products_analyzed: products.length,
      products_scored: allScored.length,
      products_approved: approvedCount,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    // Group A internal notification: email-first ops channel.
    await sendOpsAlert({
      source: "dropship-product-scorer",
      severity: "info",
      subject: "Dropship scan complete",
      message: `Products analyzed: ${products.length}\nApproved for publishing: ${approvedCount}\nTop scorer: ${topProduct?.product_name || "N/A"} (${topProduct?.ai_score || 0}/10)`,
      context: { run_id: runId, analyzed: products.length, approved: approvedCount },
    });


    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        products_analyzed: products.length,
        products_scored: allScored.length,
        products_approved: approvedCount,
        top_scorer: topProduct
          ? { name: topProduct.product_name, score: topProduct.ai_score }
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scoring run failed:", error);

    // Update run log with failure
    await supabase.from("ai_scoring_runs").update({
      run_status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Scoring run failed",
        run_id: runId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
