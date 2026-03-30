import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log("⚙️ Seeding Brandaro automation rules...");

    // Check if rules already exist
    const { data: existing } = await supabase
      .from("brandaro_automations")
      .select("id")
      .limit(1);

    if (existing?.length) {
      return new Response(JSON.stringify({ message: "Automation rules already exist", seeded: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rules = [
      {
        name: "Send Form Link on Interest",
        trigger_event: "lead_status_changed",
        trigger_condition: { new_status: "interested" },
        action_type: "send_sms",
        action_config: {
          template: "Hey {business_name}! Great chatting with you. Here's a quick form to get started: {form_link}",
          delay_minutes: 0,
        },
        is_active: true,
      },
      {
        name: "Form Reminder After 2 Hours",
        trigger_event: "form_not_submitted",
        trigger_condition: { wait_minutes: 120 },
        action_type: "send_sms",
        action_config: {
          template: "Hey {business_name}, just a quick reminder to fill out your website form when you get a chance! It only takes 2 minutes: {form_link}",
          delay_minutes: 120,
        },
        is_active: true,
      },
      {
        name: "Auto Update Status on Form Submit",
        trigger_event: "form_submitted",
        trigger_condition: {},
        action_type: "update_status",
        action_config: { new_status: "form_completed" },
        is_active: true,
      },
      {
        name: "Follow Up After Preview Sent",
        trigger_event: "preview_sent",
        trigger_condition: { wait_hours: 24 },
        action_type: "send_sms",
        action_config: {
          template: "Hey {business_name}! Did you get a chance to check out your website preview? Let me know what you think! 🚀",
          delay_minutes: 1440,
        },
        is_active: true,
      },
      {
        name: "Callback Reminder",
        trigger_event: "callback_scheduled",
        trigger_condition: {},
        action_type: "send_sms",
        action_config: {
          template: "Just a reminder — we have a call scheduled for {callback_time}. Talk soon! 📞",
          delay_minutes: 0,
        },
        is_active: true,
      },
      {
        name: "Close Follow-Up After Payment Link",
        trigger_event: "payment_link_sent",
        trigger_condition: { wait_hours: 48 },
        action_type: "send_sms",
        action_config: {
          template: "Hey {business_name}! Just checking in — did you have any questions about the payment? Happy to help! 💪",
          delay_minutes: 2880,
        },
        is_active: true,
      },
    ];

    const { error } = await supabase.from("brandaro_automations").insert(rules);
    if (error) throw error;

    console.log(`✅ Seeded ${rules.length} automation rules`);

    return new Response(JSON.stringify({
      seeded: rules.length,
      rules: rules.map(r => r.name),
      message: "Automation rules seeded successfully",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("❌ Seed automations error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
