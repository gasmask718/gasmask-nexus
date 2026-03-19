import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id, durable_url } = await req.json();
    if (!lead_id || !durable_url) {
      return new Response(JSON.stringify({ error: "lead_id and durable_url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: lead } = await supabase
      .from("brandaro_qualified_leads")
      .select("business_name, city, state, industry, phone_number")
      .eq("id", lead_id)
      .single();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: `You are a website sales specialist for Brandaro Digital.
A lead is interested. You built them a live demo website on Durable.co.
Create a pitch SMS and 3 objection responses.
SMS rules: Max 3 sentences. Use their business name naturally. Include the URL naturally. End with a yes/no question. Not salesy. No exclamation points.
Objection responses: 1-2 sentences each. Calm and helpful. Not pushy.
Return ONLY valid JSON, no explanation:
{"pitch_sms":"...","objections":{"expensive":"...","not_ready":"...","thinking":"..."}}`,
        messages: [{
          role: "user",
          content: `Business: ${lead?.business_name}\nCity: ${lead?.city}, ${lead?.state}\nIndustry: ${lead?.industry}\nDemo URL: ${durable_url}`,
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error [${response.status}]: ${errText}`);
    }

    const aiData = await response.json();
    let result: { pitch_sms: string; objections: Record<string, string> };
    try {
      result = JSON.parse(aiData.content[0].text.trim());
    } catch {
      throw new Error("Failed to parse AI pitch response");
    }

    // Save demo_url to lead record
    await supabase
      .from("brandaro_qualified_leads")
      .update({ demo_url: durable_url })
      .eq("id", lead_id);

    // Store pitch in pending messages
    await supabase.from("brandaro_pending_messages").insert({
      lead_id,
      lead_name: lead?.business_name,
      phone_number: lead?.phone_number,
      message_body: result.pitch_sms,
      message_type: "pitch",
      ai_agent: "website-pitch-writer",
      status: "pending",
      objection_responses: result.objections,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Pitch writer error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
