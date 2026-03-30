import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Step 1: Run the pipeline test
    console.log("MONITOR: Running pipeline test...");
    const testResp = await fetch(`${supabaseUrl}/functions/v1/run-ut-ambassador-pipeline-test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({}),
    });
    const testData = await testResp.json();
    console.log("MONITOR: Pipeline result:", testData.success ? "PASS" : "FAIL");

    // Step 2: Check alert throttle (30 min)
    let alertSent = false;
    if (!testData.success) {
      const { data: recentAlert } = await supabase
        .from("pipeline_health_logs")
        .select("created_at")
        .eq("alert_sent", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      const shouldAlert = !recentAlert || new Date(recentAlert.created_at) < thirtyMinsAgo;

      if (shouldAlert) {
        // Step 3: Send SMS alert via Twilio
        console.log("MONITOR: Sending failure alert SMS...");
        const adminPhone = Deno.env.get("DAVID_PHONE_NUMBER") || Deno.env.get("YOUR_PHONE_NUMBER");
        const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");

        if (adminPhone && twilioSid && twilioAuth && twilioFrom) {
          try {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
            const smsResp = await fetch(twilioUrl, {
              method: "POST",
              headers: {
                Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: adminPhone,
                From: twilioFrom,
                Body: `🚨 UT Ambassador Pipeline FAILURE\n\nFailure Point: ${testData.failure_point || "unknown"}\nTime: ${new Date().toLocaleString()}\n\nImmediate action required.`,
              }),
            });
            const smsBody = await smsResp.text();
            alertSent = smsResp.ok;
            console.log("MONITOR: SMS alert result:", smsResp.ok ? "SENT" : "FAILED", smsBody);
          } catch (smsErr) {
            console.error("MONITOR: SMS error:", smsErr);
          }
        } else {
          console.warn("MONITOR: Missing Twilio or admin phone config, skipping SMS alert");
        }
      } else {
        console.log("MONITOR: Alert throttled (last alert < 30 min ago)");
      }
    }

    // Step 4: Log to pipeline_health_logs
    const { error: logErr } = await supabase.from("pipeline_health_logs").insert({
      success: testData.success ?? false,
      failure_point: testData.failure_point || null,
      steps: testData.steps || {},
      alert_sent: alertSent,
    });

    if (logErr) console.error("MONITOR: Failed to log health check:", logErr);

    // Step 5: Auto-heal null statuses
    const { data: nullStatus } = await supabase
      .from("unforgettable_ambassadors")
      .select("id")
      .is("status", null);

    if (nullStatus && nullStatus.length > 0) {
      console.log(`MONITOR: Auto-healing ${nullStatus.length} records with null status`);
      await supabase
        .from("unforgettable_ambassadors")
        .update({ status: "pending" })
        .is("status", null);
    }

    return new Response(JSON.stringify({
      success: testData.success,
      failure_point: testData.failure_point || null,
      alert_sent: alertSent,
      auto_healed: nullStatus?.length || 0,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("MONITOR: Critical error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
