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
    const { lead_id, business_name, city, industry, call_attempts } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: `You are a local business outreach specialist for Brandaro Digital.
We help small businesses get online with websites, Google Business profiles, and social media.
Write a first-touch SMS to a small business owner who currently has no website.
Rules:
- Sound like a helpful neighbor, NOT a salesperson
- Max 2 sentences total
- Use their business name naturally
- Do NOT use exclamation points
- Do NOT say "I came across your business"
- If call_attempts > 0, briefly acknowledge you tried reaching them
- End with a soft question, not a hard sell
- Return ONLY the SMS text, nothing else, no quotes`,
        messages: [{
          role: "user",
          content: `Business name: ${business_name}\nCity: ${city}\nIndustry: ${industry}\nPrevious call attempts: ${call_attempts || 0}`,
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error [${response.status}]: ${errText}`);
    }

    const aiData = await response.json();
    const smsText = aiData.content[0].text.trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: lead } = await supabase
      .from("brandaro_qualified_leads")
      .select("business_name, phone_number")
      .eq("id", lead_id)
      .single();

    await supabase.from("brandaro_pending_messages").insert({
      lead_id,
      lead_name: lead?.business_name || business_name,
      phone_number: lead?.phone_number,
      message_body: smsText,
      message_type: "sms",
      ai_agent: "sms-writer",
      status: "pending",
    });

    return new Response(JSON.stringify({ sms_text: smsText, status: "pending_approval" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("SMS writer error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
