import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { dry_run } = await req.json().catch(() => ({ dry_run: false }));

    // Find pending follow-ups that are due
    const { data: pendingFollowups, error } = await supabase
      .from("brandaro_followups")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(20);

    if (error) throw error;

    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, pending: pendingFollowups?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const fu of pendingFollowups || []) {
      try {
        // Get lead info for destination
        const { data: lead } = await supabase
          .from("brandaro_qualified_leads")
          .select("phone, business_name")
          .eq("id", fu.lead_id)
          .single();

        if (!lead?.phone) {
          await supabase.from("brandaro_followups")
            .update({ status: "failed" })
            .eq("id", fu.id);
          failed++;
          continue;
        }

        // Build message
        const templates: Record<number, string> = {
          1: `Hi! Your free website preview for ${lead.business_name} is ready. Check it out and let us know what you think!`,
          2: `Just following up — we saved your ${lead.business_name} website preview. Want us to make any changes?`,
          3: `Last reminder: Your custom website preview for ${lead.business_name} is still available. Ready to go live? Reply YES!`,
        };
        const message = fu.message_template || templates[fu.sequence_step] || templates[1];

        // Send via brandaro-send-demo function pattern
        const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioFrom = Deno.env.get("BRANDARO_TWILIO_NUMBER") || Deno.env.get("TWILIO_FROM_NUMBER");

        let sendOk = false;

        if (twilioSid && twilioAuth && twilioFrom && fu.channel === "sms") {
          const resp = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Authorization": "Basic " + btoa(`${twilioSid}:${twilioAuth}`),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({ To: lead.phone, From: twilioFrom, Body: message }),
            }
          );
          sendOk = resp.ok;
          await resp.text();
        }

        // Update follow-up status
        await supabase.from("brandaro_followups")
          .update({
            status: sendOk ? "sent" : "failed",
            sent_at: sendOk ? new Date().toISOString() : null,
          })
          .eq("id", fu.id);

        // Log message
        await supabase.from("brandaro_message_log").insert({
          lead_id: fu.lead_id,
          demo_id: fu.demo_id,
          proposal_id: fu.proposal_id,
          channel: fu.channel || "sms",
          provider: "twilio",
          destination: lead.phone,
          message_body: message,
          send_status: sendOk ? "sent" : "failed",
          sent_at: sendOk ? new Date().toISOString() : null,
        });

        if (sendOk) sent++;
        else failed++;
      } catch (err) {
        console.error("Follow-up send error:", err);
        failed++;
        await supabase.from("brandaro_job_failures").insert({
          job_type: "send_followup",
          entity_type: "followup",
          entity_id: fu.id,
          last_error: err.message,
          retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, total: pendingFollowups?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Follow-up worker error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
