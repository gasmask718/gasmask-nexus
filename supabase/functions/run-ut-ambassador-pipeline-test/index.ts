import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    steps: {},
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const testEmail = `pipeline+${Date.now()}@test.com`;
    const testPayload = {
      full_name: "Pipeline Test User",
      email: testEmail,
      phone: "1234567890",
      state: "NY",
    };

    // STEP 1: Call submit edge function
    console.log("STEP 1: Calling submit-ut-ambassador...");
    const submitResp = await fetch(`${supabaseUrl}/functions/v1/submit-ut-ambassador`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(testPayload),
    });
    const submitData = await submitResp.json();
    results.steps.edge_function = {
      passed: submitResp.ok,
      status: submitResp.status,
      response: submitData,
    };
    console.log("STEP 1 result:", submitResp.ok ? "PASS" : "FAIL", submitData);

    if (!submitResp.ok) {
      results.success = false;
      results.failure_point = "edge_function";
      return respond(results);
    }

    // STEP 2: Verify DB insert
    console.log("STEP 2: Verifying DB insert...");
    const { data: dbRecord, error: dbErr } = await supabase
      .from("unforgettable_ambassadors")
      .select("*")
      .eq("email", testEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    results.steps.db_insert = {
      passed: !!dbRecord && !dbErr,
      record_found: !!dbRecord,
      status_value: dbRecord?.status,
      referral_code: dbRecord?.referral_code,
      error: dbErr?.message,
    };
    console.log("STEP 2 result:", dbRecord ? "PASS" : "FAIL");

    if (!dbRecord) {
      results.success = false;
      results.failure_point = "db_insert";
      return respond(results);
    }

    // STEP 3: Verify/normalize status
    console.log("STEP 3: Checking status...");
    const rawStatus = dbRecord.status;
    const needsNormalize = !rawStatus || !["pending", "active", "suspended"].includes(rawStatus);
    if (needsNormalize) {
      await supabase
        .from("unforgettable_ambassadors")
        .update({ status: "pending" })
        .eq("id", dbRecord.id);
    }
    results.steps.status_check = {
      passed: true,
      raw_status: rawStatus,
      normalized: needsNormalize,
    };

    // STEP 4: Simulate approval
    console.log("STEP 4: Simulating approval...");
    const refLink = `https://unforgettabletimesusa.com?ref=${dbRecord.referral_code}`;
    const { error: approveErr } = await supabase
      .from("unforgettable_ambassadors")
      .update({
        status: "active",
        approved_at: new Date().toISOString(),
        active_referral_link: refLink,
      })
      .eq("id", dbRecord.id);

    results.steps.approval = {
      passed: !approveErr,
      error: approveErr?.message,
    };
    console.log("STEP 4 result:", approveErr ? "FAIL" : "PASS");

    // STEP 5: Verify approval persisted
    console.log("STEP 5: Verifying approval...");
    const { data: updated } = await supabase
      .from("unforgettable_ambassadors")
      .select("status")
      .eq("id", dbRecord.id)
      .single();

    results.steps.approval_verify = {
      passed: updated?.status === "active",
      current_status: updated?.status,
    };

    // STEP 6: Test Twilio SMS (non-blocking)
    console.log("STEP 6: Testing Twilio SMS...");
    let smsPassed = false;
    try {
      const smsResp = await fetch(`${supabaseUrl}/functions/v1/ambassador-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          event: "approved",
          ambassador_id: dbRecord.id,
          referral_code: dbRecord.referral_code,
          name: "Pipeline Test User",
          phone: testPayload.phone,
        }),
      });
      const smsData = await smsResp.json();
      smsPassed = smsResp.ok && !smsData.error;
      results.steps.sms = {
        passed: smsPassed,
        status: smsResp.status,
        response: smsData,
      };
    } catch (smsErr: any) {
      results.steps.sms = { passed: false, error: smsErr.message };
    }
    console.log("STEP 6 result:", smsPassed ? "PASS" : "FAIL (non-fatal)");

    // STEP 7: Cleanup test record
    console.log("STEP 7: Cleaning up test record...");
    await supabase
      .from("unforgettable_ambassadors")
      .delete()
      .eq("id", dbRecord.id);
    results.steps.cleanup = { passed: true };

    // Final
    const allCritical = [
      results.steps.edge_function?.passed,
      results.steps.db_insert?.passed,
      results.steps.approval?.passed,
      results.steps.approval_verify?.passed,
    ];
    results.success = allCritical.every(Boolean);
    results.test_email = testEmail;
    results.sms_sent = smsPassed;

    console.log("PIPELINE TEST COMPLETE:", results.success ? "ALL PASS ✅" : "FAILURES DETECTED ❌");

    return respond(results);
  } catch (err: any) {
    console.error("Pipeline test error:", err);
    results.success = false;
    results.error = err.message;
    return respond(results);
  }
});

function respond(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
