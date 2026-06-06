// Neighborhood lockdown — toggles lockdown and auto-generates visit triggers
// for stores in the neighborhood that aren't actively flowing (don't-have / dormant).
// Clearing the lockdown cancels its still-pending lockdown_sweep triggers.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  action: "start" | "stop" | "refresh";
  neighborhood: string;
  user_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { action, neighborhood, user_id } = (await req.json()) as Body;
    if (!action || !neighborhood) {
      return new Response(JSON.stringify({ error: "action+neighborhood required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "stop") {
      // Cancel pending lockdown_sweep triggers in this neighborhood
      const { data: trigs } = await supabase
        .from("gasmask_visit_triggers")
        .select("id, source_record_id")
        .eq("trigger_type", "lockdown_sweep")
        .eq("status", "pending")
        .ilike("trigger_notes", `%neighborhood:${neighborhood}%`);
      const cancelledIds = (trigs ?? []).map(t => t.id);
      if (cancelledIds.length > 0) {
        await supabase.from("gasmask_visit_triggers")
          .update({ status: "cancelled", completion_notes: "Lockdown cleared" })
          .in("id", cancelledIds);
      }
      await supabase.from("neighborhood_lockdowns")
        .update({ cleared_at: new Date().toISOString() })
        .eq("neighborhood_name", neighborhood)
        .is("cleared_at", null);
      return new Response(JSON.stringify({ success: true, cancelled: cancelledIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // start / refresh: ensure lockdown row, then create triggers
    // Baseline counts
    const { data: nbStores } = await supabase
      .from("stores")
      .select("id, name, address, address_city, address_state, phone, relationship_status, last_order_at")
      .eq("neighborhood", neighborhood)
      .is("deleted_at", null);

    const all = nbStores ?? [];
    const have = all.filter((s: any) =>
      s.relationship_status === "active" ||
      (s.last_order_at && Date.now() - new Date(s.last_order_at).getTime() < 90 * 86400 * 1000),
    );
    const dontHave = all.filter((s: any) => !have.find(h => h.id === s.id));

    if (action === "start") {
      await supabase.from("neighborhood_lockdowns")
        .upsert({
          neighborhood_name: neighborhood,
          started_at: new Date().toISOString(),
          started_by: user_id ?? null,
          cleared_at: null,
          baseline_have: have.length,
          baseline_total: all.length,
        }, { onConflict: "neighborhood_name" });
    }

    // Dedupe: skip stores that already have a pending lockdown trigger
    const { data: existing } = await supabase
      .from("gasmask_visit_triggers")
      .select("store_id")
      .eq("trigger_type", "lockdown_sweep")
      .eq("status", "pending")
      .ilike("trigger_notes", `%neighborhood:${neighborhood}%`);
    const existingIds = new Set((existing ?? []).map((t: any) => t.store_id));

    const toCreate = dontHave
      .filter(s => !existingIds.has(s.id))
      .map((s: any) => ({
        store_id: s.id,
        store_name: s.name ?? "Unknown",
        store_address: s.address,
        store_city: s.address_city,
        store_state: s.address_state,
        store_phone: s.phone,
        trigger_source: "neighborhood_lockdown",
        trigger_type: "lockdown_sweep",
        floor_source: "floor5_territory",
        urgency: "high",
        priority_score: 80,
        trigger_notes: `Lockdown sweep — neighborhood:${neighborhood}`,
        source_record_type: "neighborhood_lockdown",
      }));

    let inserted = 0;
    if (toCreate.length > 0) {
      const { error: insErr, count } = await supabase
        .from("gasmask_visit_triggers")
        .insert(toCreate, { count: "exact" });
      if (insErr) throw insErr;
      inserted = count ?? toCreate.length;
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      total: all.length,
      have: have.length,
      dont_have: dontHave.length,
      triggers_created: inserted,
      triggers_skipped: toCreate.length === 0 ? dontHave.length : 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
