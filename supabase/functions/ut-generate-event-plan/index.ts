import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { errText } from "../_shared/errText.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { prompt, event_type, city, guest_count } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ error: "prompt required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Query matching vendors
    let query = supabase.from("ut_vendors").select("id, business_name, vendor_type, price_per_hour, price_per_day, price_flat_rate, city, state, rating").eq("status", "active");
    if (event_type) {
      const typeMap: Record<string, string> = { wedding: "venue", birthday: "venue", corporate: "venue", concert: "entertainment" };
      const vType = typeMap[event_type] || "venue";
      query = query.eq("vendor_type", vType);
    }
    if (city) query = query.ilike("city", `%${city}%`);
    const { data: vendors } = await query.limit(20);

    const vendorContext = (vendors || []).map(v =>
      `${v.business_name} (${v.vendor_type}) in ${v.city}, ${v.state} — Rating: ${v.rating}, Hourly: $${v.price_per_hour || "N/A"}, Daily: $${v.price_per_day || "N/A"}`
    ).join("\n");

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: `You are an expert event planner for Unforgettable Times. Given the user's request, create a detailed event plan and recommend specific vendors from our platform. Available vendors:\n${vendorContext}\n\nReturn a JSON object with: { "plan": "detailed plan text", "vendors": [{ "id": "uuid", "name": "string", "category": "string", "price": number, "reason": "why recommended" }] }`,
        messages: [{ role: "user", content: `${prompt}${guest_count ? ` for ${guest_count} guests` : ""}${city ? ` in ${city}` : ""}` }]
      })
    });

    const aiData = await aiRes.json();
    const content = aiData.content?.[0]?.text || "{}";
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { plan: content, vendors: [] };
    } catch {
      parsed = { plan: content, vendors: [] };
    }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("generate-event-plan error:", errText(error));
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
