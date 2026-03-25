import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FOLLOWUP_SEQUENCES = [
  { day: 1, message: "Hey — your solar savings report is ready. Want me to walk you through it?" },
  { day: 2, message: "Quick question — are you still interested in lowering your electric bill?" },
  { day: 5, message: "Programs in your area are limited — want to check your eligibility before they change?" },
  { day: 10, message: "Last chance to see what your home qualifies for — still worth a quick look?" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, lead_id, intent_score } = body;

    // === ACTION: schedule_followups — schedule full sequence for a lead
    if (action === "schedule_followups") {
      // Cancel any existing pending followups
      await supabase
        .from("solar_followups")
        .update({ status: "cancelled" })
        .eq("lead_id", lead_id)
        .eq("status", "pending");

      const now = new Date();
      const followups = FOLLOWUP_SEQUENCES.map((seq, idx) => ({
        lead_id,
        message: seq.message,
        channel: "sms",
        status: "pending",
        send_time: new Date(now.getTime() + seq.day * 86400000).toISOString(),
        attempt_number: idx + 1,
      }));

      const { error } = await supabase.from("solar_followups").insert(followups);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, scheduled: followups.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ACTION: cancel_followups — when lead replies
    if (action === "cancel_followups") {
      const { error } = await supabase
        .from("solar_followups")
        .update({ status: "cancelled" })
        .eq("lead_id", lead_id)
        .eq("status", "pending");

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ACTION: process_intent — auto-actions based on intent score
    if (action === "process_intent") {
      const actions: string[] = [];

      if (intent_score > 80) {
        // HIGH INTENT — create notification + booking prompt
        await supabase.from("solar_notifications").insert({
          lead_id,
          type: "high_intent",
          message: `🔥 High-intent lead (score: ${intent_score}) — ready for booking or closer takeover`,
        });
        actions.push("high_intent_notification");

        // Also create booking_needed notification
        await supabase.from("solar_notifications").insert({
          lead_id,
          type: "booking_needed",
          message: "Lead shows strong buying signals — push for appointment booking",
        });
        actions.push("booking_prompt");

        // Cancel nurture followups since lead is hot
        await supabase
          .from("solar_followups")
          .update({ status: "cancelled" })
          .eq("lead_id", lead_id)
          .eq("status", "pending");
        actions.push("cancelled_nurture");

      } else if (intent_score >= 50) {
        // WARM — continue AI conversation, soft follow-up
        await supabase.from("solar_notifications").insert({
          lead_id,
          type: "followup_trigger",
          message: `Warm lead (score: ${intent_score}) — continue AI engagement`,
        });
        actions.push("warm_followup");

      } else {
        // COLD — schedule nurture sequence
        await supabase.from("solar_notifications").insert({
          lead_id,
          type: "followup_trigger",
          message: `Low intent (score: ${intent_score}) — nurture sequence scheduled`,
        });
        actions.push("nurture_scheduled");
      }

      return new Response(JSON.stringify({ success: true, actions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ACTION: book_appointment
    if (action === "book_appointment") {
      const { scheduled_time, partner_id, meeting_link, notes } = body;

      const { data, error } = await supabase
        .from("solar_appointments")
        .insert({
          lead_id,
          scheduled_time,
          partner_id: partner_id || null,
          meeting_link: meeting_link || null,
          notes: notes || null,
          status: "scheduled",
        })
        .select()
        .single();

      if (error) throw error;

      // Update lead status
      await supabase.from("solar_leads").update({ status: "booked" }).eq("id", lead_id);

      // Cancel pending follow-ups
      await supabase
        .from("solar_followups")
        .update({ status: "cancelled" })
        .eq("lead_id", lead_id)
        .eq("status", "pending");

      // Create confirmation notification
      await supabase.from("solar_notifications").insert({
        lead_id,
        type: "booking_needed",
        message: `✅ Appointment booked for ${new Date(scheduled_time).toLocaleString()}`,
      });

      // Schedule reminders (24h and 1h before)
      const appointmentTime = new Date(scheduled_time);
      const reminder24h = new Date(appointmentTime.getTime() - 86400000);
      const reminder1h = new Date(appointmentTime.getTime() - 3600000);
      const now = new Date();

      const reminders = [];
      if (reminder24h > now) {
        reminders.push({
          lead_id,
          message: "Reminder: your solar consultation is scheduled for tomorrow.",
          channel: "sms",
          status: "pending",
          send_time: reminder24h.toISOString(),
          attempt_number: 1,
        });
      }
      if (reminder1h > now) {
        reminders.push({
          lead_id,
          message: `Your consultation starts soon — here's your link: ${meeting_link || "We'll call you directly"}`,
          channel: "sms",
          status: "pending",
          send_time: reminder1h.toISOString(),
          attempt_number: 1,
        });
      }
      if (reminders.length > 0) {
        await supabase.from("solar_followups").insert(reminders);
      }

      return new Response(JSON.stringify({ success: true, appointment: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ACTION: escalate — route to human closer
    if (action === "escalate") {
      const { reason } = body;
      await supabase.from("solar_notifications").insert({
        lead_id,
        type: "escalation",
        message: `🚨 ESCALATION: ${reason || "High-value lead needs human closer"}`,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Solar followup engine error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
