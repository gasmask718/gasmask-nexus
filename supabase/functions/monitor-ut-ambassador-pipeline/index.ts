import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendOpsAlert } from "../_shared/opsAlert.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Auto-heal status normalization map
const STATUS_HEAL_MAP: Record<string, string> = {
  "": "pending",
  "new": "pending",
  "pending_review": "pending",
  "approved": "active",
  "inactive": "suspended",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Parse body safely
  let bodyText = "";
  try { bodyText = await req.text(); } catch {}
  let body: any = {};
  try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { body = {}; }

  const checkType = body.check_type || "health_check";

  try {
    // Step 1: Run the pipeline test
    console.log(`MONITOR [${checkType}]: Running pipeline test...`);
    
    let testData: any = { success: false, failure_point: "test_invocation_failed" };
    try {
      const testResp = await fetch(`${supabaseUrl}/functions/v1/run-ut-ambassador-pipeline-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({}),
      });
      testData = await testResp.json();
    } catch (fetchErr) {
      console.error("MONITOR: Pipeline test fetch failed, retrying once...", fetchErr);
      // Retry once
      try {
        await new Promise(r => setTimeout(r, 2000));
        const retryResp = await fetch(`${supabaseUrl}/functions/v1/run-ut-ambassador-pipeline-test`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
          body: JSON.stringify({}),
        });
        testData = await retryResp.json();
      } catch {
        console.error("MONITOR: Retry also failed");
      }
    }

    console.log(`MONITOR [${checkType}]: Pipeline result:`, testData.success ? "PASS" : "FAIL");

    // Step 2: Auto-heal status normalization
    const autoHealDetails: { id: string; from: string; to: string }[] = [];

    // Fetch all ambassadors with problematic statuses
    const { data: allAmbs } = await supabase
      .from("unforgettable_ambassadors")
      .select("id, status");

    if (allAmbs) {
      for (const amb of allAmbs) {
        const raw = (amb.status || "").trim().toLowerCase();
        const healTo = STATUS_HEAL_MAP[raw];
        if (healTo && raw !== healTo) {
          autoHealDetails.push({ id: amb.id, from: raw || "(null)", to: healTo });
        }
        // Also catch actual null
        if (amb.status === null) {
          autoHealDetails.push({ id: amb.id, from: "(null)", to: "pending" });
        }
      }

      // Batch heal
      for (const heal of autoHealDetails) {
        await supabase
          .from("unforgettable_ambassadors")
          .update({ status: heal.to })
          .eq("id", heal.id);
      }

      if (autoHealDetails.length > 0) {
        console.log(`MONITOR: Auto-healed ${autoHealDetails.length} records`);
      }
    }

    // Step 3: Failure escalation logic
    let severity = "low";
    let recurringFailureKey: string | null = null;

    if (!testData.success) {
      recurringFailureKey = testData.failure_point || "unknown";
      
      // Check recent failures with same failure_point in last 2 hours
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: recentFailures } = await supabase
        .from("pipeline_health_logs")
        .select("id")
        .eq("success", false)
        .eq("recurring_failure_key", recurringFailureKey)
        .gte("created_at", twoHoursAgo);

      const failCount = (recentFailures?.length || 0) + 1; // +1 for current
      if (failCount >= 3) severity = "high";
      else if (failCount >= 2) severity = "medium";
    }

    // Step 4: Alert logic with config table
    let alertSent = false;
    if (!testData.success) {
      // Load config
      const { data: alertConfig } = await supabase
        .from("system_alert_config")
        .select("*")
        .eq("system_name", "ut_ambassador_pipeline")
        .maybeSingle();

      const alertsEnabled = alertConfig?.alerts_enabled ?? true;
      const throttleMinutes = alertConfig?.sms_throttle_minutes ?? 30;
      const configPhone = alertConfig?.alert_phone;

      if (alertsEnabled) {
        const { data: recentAlert } = await supabase
          .from("pipeline_health_logs")
          .select("created_at")
          .eq("alert_sent", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const throttleCutoff = new Date(Date.now() - throttleMinutes * 60 * 1000);
        const shouldAlert = !recentAlert || new Date(recentAlert.created_at) < throttleCutoff;

        if (shouldAlert) {
          console.log(`MONITOR: Sending failure alert (severity: ${severity})...`);
          const smsBody = severity === "high"
            ? `HIGH PRIORITY: UT Ambassador Pipeline repeatedly failing at [${testData.failure_point || "unknown"}]\n\nSeverity: HIGH\nOccurrences: 3+ in 2 hours\nTime: ${new Date().toLocaleString()}\n\nImmediate action required.`
            : `UT Ambassador Pipeline FAILURE\n\nFailure Point: ${testData.failure_point || "unknown"}\nSeverity: ${severity.toUpperCase()}\nTime: ${new Date().toLocaleString()}\n\nAction required.`;
          // Group A: email-first internal alert. Previously a direct Twilio
          // POST to DAVID_PHONE_NUMBER on the dead credential.
          const alertRes = await sendOpsAlert({
            source: "monitor-ut-ambassador-pipeline",
            severity: severity === "high" ? "critical" : "error",
            subject: `UT ambassador pipeline failure (${severity})`,
            message: smsBody,
            context: { failure_point: testData.failure_point ?? null, severity, configured_phone: configPhone ?? null },
          });
          alertSent = alertRes.emailSent || alertRes.smsSent;
          console.log("MONITOR: alert result:", alertSent ? "SENT" : "FAILED", alertRes.errors);
        } else {
          console.log("MONITOR: Alert throttled");
        }
      }
    }

    // Step 5: Log to pipeline_health_logs
    const { error: logErr } = await supabase.from("pipeline_health_logs").insert({
      success: testData.success ?? false,
      failure_point: testData.failure_point || null,
      steps: testData.steps || {},
      alert_sent: alertSent,
      check_type: checkType,
      severity,
      recurring_failure_key: recurringFailureKey,
      auto_heal_count: autoHealDetails.length,
      auto_heal_details: autoHealDetails.length > 0 ? autoHealDetails : {},
    });

    if (logErr) console.error("MONITOR: Failed to log health check:", logErr);

    // Step 6: Log to system_operation_logs
    await supabase.from("system_operation_logs").insert({
      system_name: "ut_ambassador_pipeline",
      operation_type: checkType,
      success: testData.success ?? false,
      details: {
        failure_point: testData.failure_point || null,
        severity,
        alert_sent: alertSent,
        auto_healed: autoHealDetails.length,
      },
    });

    return new Response(JSON.stringify({
      success: testData.success,
      check_type: checkType,
      failure_point: testData.failure_point || null,
      severity,
      alert_sent: alertSent,
      auto_healed: autoHealDetails.length,
      auto_heal_details: autoHealDetails,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("MONITOR: Critical error:", err);

    // Log critical failure
    try {
      await supabase.from("system_operation_logs").insert({
        system_name: "ut_ambassador_pipeline",
        operation_type: checkType,
        success: false,
        details: { error: err.message, critical: true },
      });
    } catch {}

    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
