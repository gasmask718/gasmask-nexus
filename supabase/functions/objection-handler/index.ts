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
    const { lead_id, objection_text, current_stage } = await req.json();
    if (!lead_id || !objection_text) {
      return new Response(JSON.stringify({ error: "lead_id and objection_text required" }), {
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
      .select("business_name, phone_number, service_interest")
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
        max_tokens: 400,
        system: `You are a sales closer for Brandaro Digital.
Services: Website ($299), Google Business Setup ($149), Social Media Setup ($99), Full Bundle ($499), Monthly ($49/mo).
A lead has responded with an objection. Keep them engaged.
Rules: Calm and helpful. Never pushy. Max 2 sentences per option. Offer a smaller step if needed.
Return ONLY valid JSON:
{"option_a":"direct address of objection","option_b":"softer smaller ask alternative"}`,
        messages: [{
          role: "user",
          content: `Business: ${lead?.business_name}\nCurrent stage: ${current_stage}\nService they showed interest in: ${lead?.service_interest || "website"}\nTheir objection: "${objection_text}"`,
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error [${response.status}]: ${errText}`);
    }

    const aiData = await response.json();
    let result: { option_a: string; option_b: string };
    try {
      result = JSON.parse(aiData.content[0].text.trim());
    } catch {
      throw new Error("Failed to parse AI objection response");
    }

    // Store both options in pending messages
    await supabase.from("brandaro_pending_messages").insert([
      {
        lead_id,
        lead_name: lead?.business_name,
        phone_number: lead?.phone_number,
        message_body: result.option_a,
        message_type: "objection_response",
        ai_agent: "objection-handler",
        status: "pending",
      },
      {
        lead_id,
        lead_name: lead?.business_name,
        phone_number: lead?.phone_number,
        message_body: result.option_b,
        message_type: "objection_response",
        ai_agent: "objection-handler",
        status: "pending",
      },
    ]);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Objection handler error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
