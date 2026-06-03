import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const sales = Deno.env.get("DC_SALES_AGENT_ID") || "";
  const followup = Deno.env.get("DC_FOLLOWUP_AGENT_ID") || "";
  const reactivation = Deno.env.get("DC_REACTIVATION_AGENT_ID") || "";
  const inbound = Deno.env.get("DC_INBOUND_AGENT_ID") || "";
  const phone = Deno.env.get("GASMASK_PHONE_NUMBER") || Deno.env.get("DC_PHONE_NUMBER") || "+18484004179";

  const rows = [
    { business: "gasmask", name: "GasMask Sales", agent_type: "outbound", agent_id: sales, phone_number: phone, is_active: !!sales },
    { business: "gasmask", name: "GasMask Follow-up", agent_type: "outbound", agent_id: followup, phone_number: phone, is_active: !!followup },
    { business: "gasmask", name: "GasMask Reactivation", agent_type: "outbound", agent_id: reactivation, phone_number: phone, is_active: !!reactivation },
    { business: "gasmask", name: "GasMask Inbound", agent_type: "inbound", agent_id: inbound, phone_number: phone, is_active: !!inbound },
  ].filter((r) => r.agent_id);

  const results: any[] = [];
  for (const r of rows) {
    // upsert by (business, agent_id)
    const { data: existing } = await supabase
      .from("dc_agents")
      .select("id")
      .eq("business", r.business)
      .eq("agent_id", r.agent_id)
      .maybeSingle();
    if (existing) {
      const { data, error } = await supabase.from("dc_agents").update(r).eq("id", existing.id).select().single();
      results.push({ action: "updated", row: data, error: error?.message });
    } else {
      const { data, error } = await supabase.from("dc_agents").insert(r).select().single();
      results.push({ action: "inserted", row: data, error: error?.message });
    }
  }

  // Activate + relabel the GasMask phone number row
  const { data: phoneUpdate, error: phoneErr } = await supabase
    .from("dc_phone_numbers")
    .update({
      is_active: true,
      assigned_agent_id: sales || null,
      assigned_agent_name: "GasMask Sales",
      elevenlabs_agent_name: "GasMask Sales",
      display_name: "GasMask Main Line",
    })
    .eq("phone_number", phone)
    .select();

  return new Response(
    JSON.stringify({
      seeded: results,
      phone_update: phoneUpdate,
      phone_error: phoneErr?.message,
      env_presence: { sales: !!sales, followup: !!followup, reactivation: !!reactivation, inbound: !!inbound },
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
