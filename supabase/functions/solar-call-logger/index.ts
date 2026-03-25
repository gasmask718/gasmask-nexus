import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { call_sid, lead_id, transcript, duration, outcome, contact_id } = await req.json();
    if (!call_sid) throw new Error("call_sid required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Score intent from transcript + outcome
    let intentScore = 50; // baseline
    const lowerTranscript = (transcript || "").toLowerCase();
    const lowerOutcome = (outcome || "").toLowerCase();

    // Positive signals
    if (lowerTranscript.includes("yes") || lowerTranscript.includes("interested")) intentScore += 15;
    if (lowerTranscript.includes("appointment") || lowerTranscript.includes("schedule")) intentScore += 20;
    if (lowerTranscript.includes("bill") || lowerTranscript.includes("electric")) intentScore += 10;
    if (lowerTranscript.includes("homeowner") || lowerTranscript.includes("own")) intentScore += 10;
    if (lowerOutcome === "interested" || lowerOutcome === "booked") intentScore += 25;
    if (lowerOutcome === "callback") intentScore += 10;

    // Negative signals
    if (lowerTranscript.includes("not interested")) intentScore -= 30;
    if (lowerTranscript.includes("renting") || lowerTranscript.includes("renter")) intentScore -= 20;
    if (lowerTranscript.includes("do not call")) intentScore -= 40;
    if (lowerOutcome === "not_interested" || lowerOutcome === "wrong_number") intentScore -= 30;
    if (lowerOutcome === "no_answer" || lowerOutcome === "voicemail") intentScore -= 10;

    intentScore = Math.max(0, Math.min(100, intentScore));

    // Map outcome to lead status
    const statusMap: Record<string, string> = {
      interested: "qualified",
      booked: "booked",
      callback: "contacted",
      not_interested: "lost",
      no_answer: "contacted",
      voicemail: "contacted",
      wrong_number: "lost",
    };

    const leadStatus = statusMap[lowerOutcome] || "contacted";

    // Update solar_interactions with call result
    if (lead_id) {
      await supabase.from("solar_interactions").insert({
        lead_id,
        interaction_type: "call_result",
        channel: "phone",
        direction: "outbound",
        summary: `Call ${outcome || "completed"} | Intent: ${intentScore} | Duration: ${duration || 0}s`,
        ai_generated: true,
        metadata: {
          call_sid,
          duration,
          outcome: outcome || "completed",
          intent_score: intentScore,
          has_transcript: !!transcript,
        },
      });

      // Update lead
      await supabase.from("solar_leads").update({
        status: leadStatus,
        lead_score: intentScore,
      }).eq("id", lead_id);

      console.log(`📊 Lead ${lead_id} scored: ${intentScore} → status: ${leadStatus}`);
    }

    // Update outreach contact if applicable
    if (contact_id) {
      const contactStatus = intentScore > 70 ? "interested" : intentScore < 30 ? "not_interested" : "contacted";
      await supabase.from("solar_outreach_contacts").update({
        outreach_status: contactStatus,
        last_contacted: new Date().toISOString(),
      }).eq("id", contact_id);
    }

    // Trigger follow-up actions based on intent
    if (intentScore > 80 && lead_id) {
      // High intent → trigger booking notification
      await supabase.from("solar_notifications").insert({
        lead_id,
        type: "high_intent",
        message: `🔥 HIGH INTENT (${intentScore}) — Lead ready for booking after AI call`,
        seen: false,
      });

      // Schedule booking follow-up via solar-followup-engine
      try {
        await supabase.functions.invoke("solar-followup-engine", {
          body: { action: "process_intent", lead_id },
        });
      } catch (e) {
        console.warn("Follow-up engine trigger failed:", e);
      }
    } else if (intentScore < 50 && lead_id) {
      // Low intent → schedule nurture follow-ups
      try {
        await supabase.functions.invoke("solar-followup-engine", {
          body: { action: "schedule_followups", lead_id },
        });
      } catch (e) {
        console.warn("Follow-up scheduling failed:", e);
      }
    }

    // Auto SMS follow-up for no-answer / voicemail
    if ((lowerOutcome === "no_answer" || lowerOutcome === "voicemail") && lead_id) {
      const { data: lead } = await supabase
        .from("solar_leads")
        .select("phone, full_name")
        .eq("id", lead_id)
        .single();

      if (lead?.phone) {
        await supabase.from("solar_followups").insert({
          lead_id,
          message: `Hey${lead.full_name ? ` ${lead.full_name.split(" ")[0]}` : ""} — tried reaching you about reducing your electric bill. Want me to check if your home qualifies? Reply YES to learn more.`,
          channel: "sms",
          status: "pending",
          send_time: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min delay
          attempt_number: 1,
        });
        console.log(`📱 SMS follow-up scheduled for no-answer lead ${lead_id}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      intent_score: intentScore,
      lead_status: leadStatus,
      actions_triggered: intentScore > 80 ? ["booking_notification", "intent_processing"] :
        intentScore < 50 ? ["nurture_sequence"] :
        lowerOutcome === "no_answer" ? ["sms_followup"] : [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("❌ solar-call-logger error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
