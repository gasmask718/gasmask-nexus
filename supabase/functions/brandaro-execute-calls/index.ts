import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || Deno.env.get("TWILIO_FROM_NUMBER");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");

    const useGateway = !!(LOVABLE_API_KEY && TWILIO_API_KEY);
    const useDirect = !!(twilioSid && twilioAuth);

    if (!useGateway && !useDirect) {
      throw new Error("No Twilio credentials available");
    }
    if (!TWILIO_FROM) {
      throw new Error("No Twilio FROM number configured");
    }

    const bodyText = await req.text();
    let body: Record<string, unknown> = {};
    try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { body = {}; }

    const batchSize = Number(body.batch_size) || 10;
    const dryRun = body.dry_run === true;

    console.log(`📞 Starting call execution (batch=${batchSize}, dryRun=${dryRun})`);

    // Get active queue items with lead details
    const { data: queue, error: queueErr } = await supabase
      .from("brandaro_call_queue")
      .select(`
        id, lead_id, priority_score, retry_count, is_active,
        brandaro_qualified_leads!inner(business_name, phone_number, lead_status)
      `)
      .eq("is_active", true)
      .order("priority_score", { ascending: false })
      .limit(batchSize);

    if (queueErr) {
      // Fallback: query without join
      console.warn("Join failed, using fallback query:", queueErr.message);
    }

    // Fallback: if join fails, get queue + leads separately
    let callItems: Array<{
      queue_id: string;
      lead_id: string;
      business_name: string;
      phone: string;
      priority: number;
      retry_count: number;
    }> = [];

    if (queue?.length) {
      callItems = queue.map((q: any) => ({
        queue_id: q.id,
        lead_id: q.lead_id,
        business_name: q.brandaro_qualified_leads?.business_name || "Unknown",
        phone: q.brandaro_qualified_leads?.phone_number || "",
        priority: q.priority_score || 0,
        retry_count: q.retry_count || 0,
      }));
    } else {
      // Fallback: separate queries
      const { data: queueOnly } = await supabase
        .from("brandaro_call_queue")
        .select("id, lead_id, priority_score, retry_count")
        .eq("is_active", true)
        .order("priority_score", { ascending: false })
        .limit(batchSize);

      if (queueOnly?.length) {
        const leadIds = queueOnly.map(q => q.lead_id).filter(Boolean);
        const { data: leads } = await supabase
          .from("brandaro_qualified_leads")
          .select("id, business_name, phone_number")
          .in("id", leadIds);

        const leadMap = new Map((leads || []).map(l => [l.id, l]));

        callItems = queueOnly.map(q => {
          const lead = leadMap.get(q.lead_id);
          return {
            queue_id: q.id,
            lead_id: q.lead_id,
            business_name: lead?.business_name || "Unknown",
            phone: lead?.phone_number || "",
            priority: q.priority_score || 0,
            retry_count: q.retry_count || 0,
          };
        });
      }
    }

    if (!callItems.length) {
      return new Response(JSON.stringify({ calls_initiated: 0, message: "No items in call queue" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let initiated = 0;
    let failed = 0;
    const results: Array<{ queue_id: string; status: string; error?: string }> = [];

    for (const item of callItems) {
      if (!item.phone) {
        results.push({ queue_id: item.queue_id, status: "skipped", error: "No phone number" });
        // Deactivate from queue
        await supabase.from("brandaro_call_queue").update({ is_active: false }).eq("id", item.queue_id);
        failed++;
        continue;
      }

      if (dryRun) {
        results.push({ queue_id: item.queue_id, status: "dry_run" });
        initiated++;
        continue;
      }

      try {
        // Initiate call via Twilio
        const twimlUrl = `${supabaseUrl}/functions/v1/brandaro-call-twiml?lead_id=${item.lead_id}`;

        let response: Response;
        if (useGateway) {
          response = await fetch(`${GATEWAY_URL}/Calls.json`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": TWILIO_API_KEY!,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: item.phone,
              From: TWILIO_FROM,
              Url: twimlUrl,
              StatusCallback: `${supabaseUrl}/functions/v1/brandaro-call-status`,
              Timeout: "30",
            }),
          });
        } else {
          const authHeader = btoa(`${twilioSid}:${twilioAuth}`);
          response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${authHeader}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: item.phone,
              From: TWILIO_FROM,
              Url: twimlUrl,
              StatusCallback: `${supabaseUrl}/functions/v1/brandaro-call-status`,
              Timeout: "30",
            }),
          });
        }

        const data = await response.json();

        if (response.ok) {
          // Log call
          await supabase.from("brandaro_call_logs").insert({
            lead_id: item.lead_id,
            campaign_id: null,
            call_attempt_number: (item.retry_count || 0) + 1,
            call_timestamp: new Date().toISOString(),
            call_outcome: "initiated",
            phone_used: TWILIO_FROM,
          });

          // Update queue
          await supabase.from("brandaro_call_queue").update({
            is_active: false,
            retry_count: (item.retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          }).eq("id", item.queue_id);

          // Update lead last_call_at
          await supabase.from("brandaro_qualified_leads").update({
            last_call_at: new Date().toISOString(),
            call_attempts: (item.retry_count || 0) + 1,
          }).eq("id", item.lead_id);

          results.push({ queue_id: item.queue_id, status: "initiated" });
          initiated++;
        } else {
          results.push({ queue_id: item.queue_id, status: "failed", error: data.message || "Twilio error" });
          failed++;
        }

        // Pace calls: 500ms between
        await new Promise(r => setTimeout(r, 500));

      } catch (callErr: unknown) {
        const errMsg = callErr instanceof Error ? callErr.message : "Unknown";
        results.push({ queue_id: item.queue_id, status: "failed", error: errMsg });
        failed++;
      }
    }

    console.log(`✅ Call execution complete: ${initiated} initiated, ${failed} failed`);

    return new Response(JSON.stringify({
      calls_initiated: initiated,
      calls_failed: failed,
      total_processed: callItems.length,
      dry_run: dryRun,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("❌ Call execution error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
