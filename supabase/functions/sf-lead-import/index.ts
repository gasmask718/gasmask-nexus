import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { sendOpsAlert } from "../_shared/opsAlert.ts";

interface IncomingLead {
  claimant_first_name?: string;
  claimant_last_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  property_address?: string;
  address?: string;
  property_county?: string;
  county?: string;
  property_state?: string;
  state?: string;
  surplus_amount?: number;
  case_number?: string;
  court_case_number?: string;
  sale_date?: string;
  foreclosure_date?: string;
  source?: string;
}

async function attomEnrich(address: string, county: string, state: string) {
  const key = Deno.env.get("ATTOM_API_KEY");
  if (!key) return null;
  try {
    const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?address1=${encodeURIComponent(address)}&address2=${encodeURIComponent(`${county}, ${state}`)}`;
    const res = await fetch(url, { headers: { apikey: key, accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const prop = data?.property?.[0];
    if (!prop) return null;
    return {
      owner_name: prop?.owner?.owner1?.fullname ?? null,
      owner_mailing_address: prop?.owner?.mailingaddressoneline ?? null,
      owner_phone: prop?.owner?.phone ?? null,
      owner_email: prop?.owner?.email ?? null,
    };
  } catch (_e) {
    return null;
  }
}

// Internal ops notification (Group A). Email-first: this is a staff status
// report, not customer traffic, so it never touches the SMS suppression path
// and never queues behind campaign volume.
async function notifyOps(message: string) {
  await sendOpsAlert({
    source: "sf-lead-import",
    subject: "SF Lead Import Complete",
    message,
    severity: "info",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const leads: IncomingLead[] = Array.isArray(body?.leads) ? body.leads : [];
    const sourceTag: string = body?.source ?? leads[0]?.source ?? "api";

    let inserted = 0;
    let skipped = 0;
    const insertedIdsWithPhone: string[] = [];
    const stateCounts: Record<string, number> = {};

    for (const raw of leads) {
      const first_name = raw.claimant_first_name ?? raw.first_name ?? "";
      const last_name = raw.claimant_last_name ?? raw.last_name ?? "";
      const property_address = raw.property_address ?? raw.address ?? "";
      const county = raw.property_county ?? raw.county ?? "Unknown";
      const state = raw.property_state ?? raw.state ?? "";
      const court_case_number = raw.court_case_number ?? raw.case_number ?? null;
      const foreclosure_date = raw.foreclosure_date ?? raw.sale_date ?? null;
      const lead_source = raw.source ?? sourceTag;

      if (!property_address || !state) { skipped++; continue; }

      // Dedup
      const { data: existing } = await supabase
        .from("surplus_funds_leads")
        .select("id")
        .eq("property_address", property_address)
        .eq("county", county)
        .eq("state", state)
        .maybeSingle();
      if (existing?.id) { skipped++; continue; }

      // ATTOM enrichment
      let phone = raw.phone ?? null;
      let email = raw.email ?? null;
      const attom = await attomEnrich(property_address, county, state);
      if (!phone && attom?.owner_phone) phone = attom.owner_phone;
      if (!email && attom?.owner_email) email = attom.owner_email;

      const status = phone ? "new" : "skip_trace_pending";

      const { data: insRow, error: insErr } = await supabase
        .from("surplus_funds_leads")
        .insert({
          first_name,
          last_name,
          phone,
          email,
          address: property_address,
          property_address,
          county,
          state,
          surplus_amount: raw.surplus_amount ?? null,
          court_case_number,
          foreclosure_date,
          lead_source,
          status,
        })
        .select("id, phone, state")
        .single();

      if (insErr || !insRow) { skipped++; continue; }
      inserted++;
      stateCounts[state] = (stateCounts[state] || 0) + 1;
      if (insRow.phone) insertedIdsWithPhone.push(insRow.id);
    }

    // Trigger campaign
    let callsTriggered = 0;
    if (insertedIdsWithPhone.length > 0) {
      const mostCommonState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "US";
      const date = new Date().toISOString().slice(0, 10);
      const { error: invErr } = await supabase.functions.invoke("sf-trigger-bland-campaign", {
        body: {
          lead_ids: insertedIdsWithPhone,
          campaign_name: `SF_Auto_${mostCommonState}_${date}`,
          state: mostCommonState,
        },
      });
      if (!invErr) callsTriggered = insertedIdsWithPhone.length;
    }

    // Log
    await supabase.from("re_automation_log").insert({
      automation_type: "sf-lead-import",
      status: "completed",
      leads_processed: leads.length,
      leads_imported: inserted,
      leads_skipped: skipped,
      source: sourceTag,
      states: Object.keys(stateCounts),
      metadata: { calls_triggered: callsTriggered },
      completed_at: new Date().toISOString(),
    });

    // SMS David
    if (inserted > 0) {
      await notifyOps(
        `📋 SF Lead Import Complete!\nNew leads: ${inserted}\nSkipped (dupes): ${skipped}\nCalls starting: ${callsTriggered}\nSource: ${sourceTag}`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        leads_received: leads.length,
        leads_inserted: inserted,
        leads_skipped_duplicate: skipped,
        calls_triggered: callsTriggered,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
