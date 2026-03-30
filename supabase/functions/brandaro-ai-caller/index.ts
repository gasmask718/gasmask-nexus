import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const bodyText = await req.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    const { batch_size = 5, language_filter } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");
    const ELEVENLABS_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      throw new Error("Twilio credentials not configured");
    }

    // Fetch leads that haven't been AI-called recently
    let query = supabase
      .from("brandaro_leads_master")
      .select("id, business_name, phone, language, region, intent_score")
      .not("phone", "is", null)
      .order("intent_score", { ascending: false })
      .limit(batch_size);

    if (language_filter) {
      query = query.eq("language", language_filter);
    }

    const { data: leads, error: leadsError } = await query;
    if (leadsError) throw leadsError;

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ message: "No leads to call", called: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out recently called leads (24h)
    const leadIds = leads.map((l: any) => l.id);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentCalls } = await supabase
      .from("brandaro_ai_calls")
      .select("lead_id")
      .in("lead_id", leadIds)
      .gte("created_at", oneDayAgo);

    const recentlyCalledIds = new Set((recentCalls || []).map((c: any) => c.lead_id));
    const eligibleLeads = leads.filter((l: any) => !recentlyCalledIds.has(l.id));

    const results: any[] = [];

    for (const lead of eligibleLeads) {
      try {
        const { data: callRecord, error: insertErr } = await supabase
          .from("brandaro_ai_calls")
          .insert({
            lead_id: lead.id,
            language: lead.language || "spanish",
            status: "initiating",
            called_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertErr) {
          console.error(`Failed to create call record for ${lead.id}:`, insertErr);
          continue;
        }

        // Build TwiML URL for ElevenLabs bridge
        const twimlUrl = `${supabaseUrl}/functions/v1/brandaro-ai-caller-twiml?lead_id=${lead.id}&language=${lead.language || "spanish"}&call_record_id=${callRecord.id}`;

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
        const twilioResponse = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: lead.phone,
            From: TWILIO_FROM_NUMBER,
            Url: twimlUrl,
            StatusCallback: `${supabaseUrl}/functions/v1/brandaro-ai-call-status?call_record_id=${callRecord.id}`,
            StatusCallbackEvent: "initiated ringing answered completed",
          }),
        });

        const twilioData = await twilioResponse.json();

        if (!twilioResponse.ok) {
          await supabase
            .from("brandaro_ai_calls")
            .update({ status: "failed", outcome: JSON.stringify(twilioData) })
            .eq("id", callRecord.id);
          results.push({ lead_id: lead.id, status: "failed", error: twilioData.message });
          continue;
        }

        await supabase
          .from("brandaro_ai_calls")
          .update({ call_sid: twilioData.sid, status: "initiated" })
          .eq("id", callRecord.id);

        results.push({ lead_id: lead.id, status: "initiated", call_sid: twilioData.sid });

        // 3s pacing between calls
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (callErr) {
        console.error(`Error calling lead ${lead.id}:`, callErr);
        results.push({ lead_id: lead.id, status: "error", error: String(callErr) });
      }
    }

    return new Response(
      JSON.stringify({
        total_eligible: eligibleLeads.length,
        results,
        called: results.filter((r) => r.status === "initiated").length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Caller error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
