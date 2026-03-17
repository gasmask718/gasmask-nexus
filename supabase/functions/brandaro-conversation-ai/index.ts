import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Objection patterns and response templates
const OBJECTION_MAP: Record<string, { type: string; responses: string[] }> = {
  "too expensive|cost too much|can't afford|out of budget|price is high": {
    type: "price_objection",
    responses: [
      "I totally understand budget concerns. Most of our clients see a 3-5x return within the first 6 months through new customer leads. Would it help if I showed you how we've helped similar businesses?",
      "We offer flexible payment options. Plus, without a professional website, you're likely losing $500-2000/month in missed customers who can't find you online.",
    ],
  },
  "not interested|no thanks|don't need|pass on this": {
    type: "not_interested",
    responses: [
      "No pressure at all! Just curious — are you currently getting leads from your online presence? Many business owners don't realize how many customers search online before visiting.",
      "Completely understand. Would it be okay if I sent you a quick case study of a similar business we helped? No obligation, just something to consider.",
    ],
  },
  "later|not now|busy|next month|next year|maybe later": {
    type: "timing_objection",
    responses: [
      "Timing makes sense! Just so you know, every month without a website means potential customers going to competitors. I'll check back — when would be a better time?",
      "No rush! I'll make a note. In the meantime, your demo site is still live if you want to share it with anyone for feedback.",
    ],
  },
  "already have|got a website|have a site|existing website": {
    type: "existing_solution",
    responses: [
      "That's great you already have a presence! We actually specialize in upgrades — modern, mobile-first designs that load fast and convert better. Want me to do a free audit of your current site?",
      "Awesome! How's it performing for you? We've helped businesses increase their leads by 40% just by modernizing their design and SEO. Happy to do a free comparison.",
    ],
  },
};

function detectObjection(text: string): { type: string; response: string } | null {
  const lower = text.toLowerCase();
  for (const [patterns, data] of Object.entries(OBJECTION_MAP)) {
    const parts = patterns.split("|");
    if (parts.some(p => lower.includes(p))) {
      const response = data.responses[Math.floor(Math.random() * data.responses.length)];
      return { type: data.type, response };
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, message_text, channel = "sms" } = await req.json();
    if (!lead_id || !message_text) {
      return new Response(JSON.stringify({ error: "lead_id and message_text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Detect objection
    const objection = detectObjection(message_text);

    // Store inbound message
    await supabase.from("brandaro_conversations").insert({
      lead_id,
      direction: "inbound",
      message_text,
      objection_type: objection?.type || null,
      channel,
    });

    if (!objection) {
      // No recognized objection — store and flag for human review
      return new Response(JSON.stringify({
        ok: true,
        objection_detected: false,
        action: "human_review",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store AI response
    await supabase.from("brandaro_conversations").insert({
      lead_id,
      direction: "outbound",
      message_text: objection.response,
      objection_type: objection.type,
      ai_response: objection.response,
      response_effectiveness: "pending",
      channel,
    });

    // Send the response via SMS if channel is sms
    if (channel === "sms") {
      const { data: lead } = await supabase
        .from("brandaro_qualified_leads")
        .select("phone")
        .eq("id", lead_id)
        .single();

      if (lead?.phone) {
        try {
          await supabase.functions.invoke("send-sms", {
            body: { to: lead.phone, message: objection.response },
          });
        } catch (smsErr: any) {
          console.error("SMS send error:", smsErr.message);
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      objection_detected: true,
      objection_type: objection.type,
      response_sent: objection.response,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Conversation AI error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
