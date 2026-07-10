// scraper-ingest — Supabase Edge Function (runs inside Lovable Cloud)
//
// Receives scraped county data from the Railway Python scraper via HTTPS POST,
// checks a shared secret, then writes with service_role (auto-injected here).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed, use POST" }, 405);
  }

  // --- 1. Authenticate the caller -----------------------------------------
  const providedSecret = req.headers.get("x-scraper-secret");
  const expectedSecret = Deno.env.get("SCRAPER_INGEST_SECRET");
  const env = Deno.env.toObject();
  console.log("[scraper-ingest] ping test:", Deno.env.get("PING_TEST_ONLY"));
  console.log("[scraper-ingest] all env keys:", Object.keys(env));
  console.log("[scraper-ingest] literal lookup name:", JSON.stringify("SCRAPER_INGEST_SECRET"));
  console.log("[scraper-ingest] env propagation probe", {
    envKeyCount: Object.keys(env).length,
    deploymentIdPresent: !!env.DENO_DEPLOYMENT_ID,
    executionIdPresent: !!env.SB_EXECUTION_ID,
    regionPresent: !!env.DENO_REGION,
    defaultBackendSecretsPresent: {
      SUPABASE_URL: !!env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY: !!env.SUPABASE_ANON_KEY,
    },
    existingUserSecretPresent: {
      PUBLIC_SITE_WEBHOOK_SECRET: !!env.PUBLIC_SITE_WEBHOOK_SECRET,
      PUBLIC_SITE_WEBHOOK_SECRET_length: env.PUBLIC_SITE_WEBHOOK_SECRET?.length ?? 0,
    },
    newlyCreatedSecretsPresent: {
      SCRAPER_INGEST_SECRET: !!env.SCRAPER_INGEST_SECRET,
      SCRAPER_INGEST_SECRET_length: env.SCRAPER_INGEST_SECRET?.length ?? 0,
      PING_TEST_ONLY: !!env.PING_TEST_ONLY,
      PING_TEST_ONLY_length: env.PING_TEST_ONLY?.length ?? 0,
    },
  });
  const configuredSecretNames = [
    "ADMIN_ALERT_EMAIL", "ADMIN_ALERT_PHONE", "ANTHROPIC_API_KEY", "AWS_ACCESS_KEY_ID", "AWS_POLLY_REGION",
    "AWS_SECRET_ACCESS_KEY", "BIZTEXT_API_KEY", "BIZTEXT_ID", "BIZTEXT_PW", "BIZTEXT_TOKEN",
    "BLAND_API_KEY", "BLAND_INBOUND_NUMBER", "BRANDARO_CLOSER_AGENT_ID", "BRANDARO_ES_CLOSER_ID", "BRANDARO_ES_REL_ID",
    "BRANDARO_REL_AGENT_ID", "BRANDARO_SALES_AGENT_ID", "BRANDARO_STRIPE_WEBHOOK_SECRET", "BRANDARO_TWILIO_ACCOUNT_SID", "BRANDARO_TWILIO_API_KEY_SECRET",
    "BRANDARO_TWILIO_API_KEY_SID", "BRANDARO_TWILIO_AUTH_TOKEN", "BRANDARO_TWILIO_TWIML_APP_SID", "BRANDARO_TWIML_APP_SID", "BRANDARO_TWIML_REQUEST_URL",
    "BRANDARO_TWIML_STATUS_CALLBACK_URL", "DAVID_PHONE_NUMBER", "DC_BLAND_WEBHOOK_SECRET", "DC_FOLLOWUP_AGENT_ID", "DC_INBOUND_AGENT_ID",
    "DC_PHONE_NUMBER", "DC_REACTIVATION_AGENT_ID", "DC_SALES_AGENT_ID", "DD_ANTHROPIC_API_KEY", "DD_GUEST_USER_ID",
    "DD_UNSUBSCRIBE_SECRET", "DEV_PHONE_LOCK", "DEV_TEST_PHONE", "DYNASTY_OS_API_KEY", "DYNASTY_RECOVERY_WEBHOOK_SECRET",
    "DYNASTY_UBEN_SYNC_KEY", "ELEVENLABS_AGENT_ID", "ELEVENLABS_API_KEY", "FRONTEND_BASE_URL", "GASMASK_DNC_TOOL_SECRET",
    "GASMASK_PHONE_NUMBER", "GOOGLE_DRIVE_API_KEY", "GOOGLE_PLACES_API_KEY", "ICLEAN_BOOKING_AGENT_ID", "LIVE_HANDOFF_NUMBER",
    "LOVABLE_API_KEY", "MAPBOX_PUBLIC_TOKEN", "ODDS_API_KEY", "OUTSCRAPER_API_KEY", "PING_TEST_ONLY",
    "PLAYBOXXX_AFFILIATE_ID", "PLAYBOXXX_MANAGER_ID", "PUBLIC_SITE_ANON_KEY", "PUBLIC_SITE_ORIGIN", "PUBLIC_SITE_SERVICE_ROLE_KEY",
    "PUBLIC_SITE_WEBHOOK_SECRET", "RESEND_API_KEY", "RE_CLOSER_AGENT_ID", "RE_QUALIFIER_AGENT_ID", "RE_REAL_ESTATE_WEBHOOK_SECRET",
    "RE_SPECIALIST_AGENT_ID", "SCRAPER_INGEST_SECRET", "SENDGRID_API_KEY", "SF_ATTORNEY_AGENT_ID", "SF_CLIENT_AGENT_ID",
    "SPORTSDATAIO_API_KEY", "STRIPE_CONNECT_CLIENT_ID", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "T4_BOOTSTRAP_TOKEN",
    "TT_AMBASSADOR_AGENT_ID", "TT_CONCIERGE_AGENT_ID", "TT_PHONE_NUMBER", "TT_SMS_BRIDGE_SECRET", "TWILIO_ACCOUNT_SID",
    "TWILIO_API_KEY", "TWILIO_API_SECRET", "TWILIO_API_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER",
    "TWILIO_MESSAGING_SERVICE_SID", "TWILIO_PHONE_NUMBER", "TWILIO_SHARED_NUMBER", "TWILIO_TWIML_APP_SID", "TWILIO_WEBHOOK_AUTH_TOKEN",
    "UBEN_SYNC_API_KEY", "UT_AMBASSADOR_AGENT_ID", "UT_CONCIERGE_AGENT_ID", "UT_PARTNER_AGENT_ID", "VA_GMAIL_APP_PASSWORD",
    "VA_GMAIL_USER", "VIATOR_API_KEY", "VITE_SPORTSDATAIO_NBA_KEY", "YELP_API_KEY", "YOUR_PHONE_NUMBER",
  ];
  console.log("[scraper-ingest] configured-vs-runtime secret probe", {
    configuredSecretCount: configuredSecretNames.length,
    configuredSecretsPresentInRuntime: configuredSecretNames.filter((key) => key in env).length,
    configuredSecretsMissingFromRuntime: configuredSecretNames.filter((key) => !(key in env)),
  });
  console.log("[scraper-ingest] auth debug", {
    expectedSecretPresent: !!expectedSecret,
    expectedSecretLength: expectedSecret?.length ?? 0,
    providedSecretPresent: !!providedSecret,
    providedSecretLength: providedSecret?.length ?? 0,
    match: !!expectedSecret && providedSecret === expectedSecret,
  });
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  // --- 2. Parse and validate the payload ----------------------------------
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Body must be valid JSON" }, 400);
  }

  const { source_id, county, state, source_url, pdf_hash, leads } = payload;
  if (!source_id || !county || !state || !Array.isArray(leads)) {
    return json(
      { error: "Required fields: source_id, county, state, leads (array). pdf_hash is optional but recommended." },
      400
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // --- 3. Hash check: skip the write entirely if nothing changed ---------
  if (pdf_hash) {
    const { data: stateRow } = await supabase
      .from("scraper_state")
      .select("last_value")
      .eq("source_id", source_id)
      .maybeSingle();

    if (stateRow && stateRow.last_value === pdf_hash) {
      await supabase.from("scraper_state").update({
        last_run_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        last_new_records: 0,
      }).eq("source_id", source_id);

      return json({ status: "unchanged", new_records: 0 }, 200);
    }
  }

  // --- 4. Insert leads, ignoring anything already seen (dedupe_key) ------
  const rows = leads.map((lead: Record<string, unknown>) => ({
    source_id, county, state, source_url,
    ...lead,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("raw_scraper_leads")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id");

  if (insertError) {
    await supabase.from("scraper_runs").insert({
      source_id,
      status: "failure",
      error_message: insertError.message,
      finished_at: new Date().toISOString(),
    });
    await supabase.from("scraper_state").upsert({
      source_id, county, state, monitor_type: "hash",
      last_run_at: new Date().toISOString(),
      consecutive_failures: 1,
      last_error: insertError.message,
    });
    return json({ error: insertError.message }, 500);
  }

  const newCount = inserted?.length ?? 0;

  // --- 5. Record state + run log ------------------------------------------
  await supabase.from("scraper_state").upsert({
    source_id, county, state, monitor_type: "hash",
    last_value: pdf_hash ?? null,
    last_run_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    last_new_records: newCount,
    consecutive_failures: 0,
    last_error: null,
  });

  await supabase.from("scraper_runs").insert({
    source_id,
    status: "success",
    new_records: newCount,
    finished_at: new Date().toISOString(),
  });

  return json({ status: "success", new_records: newCount, total_sent: rows.length }, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
