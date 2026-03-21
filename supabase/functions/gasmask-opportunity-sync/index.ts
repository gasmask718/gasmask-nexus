import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results = {
    store_intel: 0,
    opportunities: 0,
    messaging: 0,
    dialer: 0,
    overdue_followups: 0,
    declining_health: 0,
    total_triggers_created: 0,
    skipped_duplicates: 0,
  };

  const createTrigger = async (payload: any) => {
    // Check for duplicate
    const { data: existing } = await supabase
      .from("gasmask_visit_triggers")
      .select("id")
      .eq("store_name", payload.store_name)
      .eq("trigger_type", payload.trigger_type)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (existing) {
      results.skipped_duplicates++;
      return null;
    }

    const { data } = await supabase
      .from("gasmask_visit_triggers")
      .insert(payload)
      .select("id")
      .single();

    if (data) results.total_triggers_created++;
    return data;
  };

  try {
    // ═══════════════════════════════════════
    // SOURCE 1: TUBE INTEL — store signals
    // ═══════════════════════════════════════
    const { data: tubeSignals } = await supabase
      .from("tube_intel")
      .select(`
        id, store_id, brand_id,
        needs_order, bring_samples, bring_starter_kit,
        needs_switch, switch_quantity, owner_interested,
        last_updated_at,
        store:store_master!store_id (
          id, store_name, address, city, state, phone
        )
      `)
      .or("needs_order.eq.true,bring_samples.eq.true,bring_starter_kit.eq.true,needs_switch.eq.true")
      .gte("last_updated_at", new Date(Date.now() - 7 * 86400000).toISOString());

    for (const signal of tubeSignals || []) {
      const store = signal.store as any;
      if (!store?.store_name) continue;

      let triggerType = "follow_up";
      const notes: string[] = [];
      let urgency = "normal";

      if (signal.needs_order) { triggerType = "restock"; notes.push("Needs order"); urgency = "high"; }
      if (signal.bring_samples) { triggerType = "first_visit"; notes.push("Bring samples"); }
      if (signal.bring_starter_kit) { triggerType = "first_visit"; notes.push("Bring starter kit"); }
      if (signal.needs_switch) {
        triggerType = "merchandising";
        notes.push(`Switch tubes${signal.switch_quantity ? ` (${signal.switch_quantity})` : ""}`);
        urgency = "high";
      }

      await createTrigger({
        store_name: store.store_name,
        store_city: store.city,
        store_state: store.state,
        store_phone: store.phone,
        store_address: store.address,
        trigger_source: "Store Intelligence — Auto Sync",
        trigger_type: triggerType,
        floor_source: "floor1_crm",
        urgency,
        priority_score: urgency === "high" ? 7 : 5,
        trigger_notes: notes.join(" · "),
        source_record_id: signal.id,
        source_record_type: "tube_intel",
        status: "pending",
      });
      results.store_intel++;
    }

    // ═══════════════════════════════════════
    // SOURCE 2: HUMAN-CREATED OPPORTUNITIES
    // ═══════════════════════════════════════
    const { data: humanOpps } = await supabase
      .from("store_opportunities")
      .select(`
        id, store_id, opportunity_text, source, created_at,
        store:store_master!store_id (
          id, store_name, address, city, state, phone
        )
      `)
      .eq("is_completed", false)
      .gte("created_at", new Date(Date.now() - 3 * 86400000).toISOString());

    for (const opp of humanOpps || []) {
      const store = opp.store as any;
      if (!store?.store_name) continue;

      await createTrigger({
        store_name: store.store_name,
        store_city: store.city,
        store_state: store.state,
        store_phone: store.phone,
        store_address: store.address,
        trigger_source: "Opportunities — Human Created",
        trigger_type: "follow_up",
        floor_source: "floor1_crm",
        urgency: "normal",
        priority_score: 5,
        trigger_notes: opp.opportunity_text,
        source_record_id: opp.id,
        source_record_type: "store_opportunity",
        status: "pending",
      });
      results.opportunities++;
    }

    // ═══════════════════════════════════════
    // SOURCE 3: GASMASK INBOUND SMS REPLIES
    // ═══════════════════════════════════════
    const { data: inboundMessages } = await supabase
      .from("communication_messages")
      .select("*")
      .eq("direction", "inbound")
      .gte("created_at", new Date(Date.now() - 24 * 3600000).toISOString())
      .order("created_at", { ascending: false });

    for (const msg of inboundMessages || []) {
      if (!msg.phone_number) continue;

      const normalize = (p: string) => p.replace(/\D/g, "").slice(-10);
      const { data: matchedStore } = await supabase
        .from("stores")
        .select("*")
        .ilike("phone", `%${normalize(msg.phone_number)}`)
        .limit(1)
        .maybeSingle();

      if (!matchedStore) continue;

      const body = (msg.content || "").toLowerCase();
      const isInterested = ["yes", "interested", "sure", "ok", "when", "how much", "tell me", "send", "need", "order"]
        .some((kw) => body.includes(kw));
      if (!isInterested) continue;

      await createTrigger({
        store_name: matchedStore.name,
        store_city: matchedStore.address_city,
        store_state: matchedStore.address_state,
        store_phone: matchedStore.phone,
        store_address: matchedStore.address_street,
        trigger_source: "GasMask Messaging — Inbound Reply",
        trigger_type: "follow_up",
        floor_source: "floor3_comms",
        urgency: "high",
        priority_score: 8,
        trigger_notes: `Store replied: "${(msg.content || "").substring(0, 200)}"`,
        source_record_id: msg.id,
        source_record_type: "communication_message",
        status: "pending",
      });
      results.messaging++;
    }

    // ═══════════════════════════════════════
    // SOURCE 4: OVERDUE STORES (14+ days)
    // ═══════════════════════════════════════
    const { data: overdueStores } = await supabase
      .from("stores")
      .select("*")
      .eq("status", "active")
      .not("last_visit_date", "is", null)
      .lt("last_visit_date", new Date(Date.now() - 14 * 86400000).toISOString())
      .order("last_visit_date", { ascending: true })
      .limit(50);

    for (const store of overdueStores || []) {
      const daysSince = Math.floor(
        (Date.now() - new Date(store.last_visit_date || 0).getTime()) / 86400000
      );

      await createTrigger({
        store_name: store.name,
        store_city: store.address_city,
        store_state: store.address_state,
        store_phone: store.phone,
        store_address: store.address_street,
        trigger_source: "Auto Sync — Overdue Visit",
        trigger_type: "follow_up",
        floor_source: "floor1_crm",
        urgency: daysSince > 30 ? "high" : "normal",
        priority_score: daysSince > 30 ? 7 : 5,
        trigger_notes: `Last visit ${daysSince} days ago — overdue`,
        source_record_id: store.id,
        source_record_type: "store",
        status: "pending",
      });
      results.overdue_followups++;
    }

    // ═══════════════════════════════════════
    // SOURCE 5: DECLINING HEALTH SCORES
    // ═══════════════════════════════════════
    const { data: decliningStores } = await supabase
      .from("stores")
      .select("*")
      .eq("status", "active")
      .not("health_score", "is", null)
      .lt("health_score", 40)
      .order("health_score", { ascending: true })
      .limit(30);

    for (const store of decliningStores || []) {
      await createTrigger({
        store_name: store.name,
        store_city: store.address_city,
        store_state: store.address_state,
        store_phone: store.phone,
        store_address: store.address_street,
        trigger_source: "Account Health — Low Score",
        trigger_type: "urgent_visit",
        floor_source: "floor1_crm",
        urgency: (store.health_score || 0) < 20 ? "critical" : "high",
        priority_score: (store.health_score || 0) < 20 ? 10 : 7,
        trigger_notes: `Health score dropped to ${store.health_score}/100 — urgent intervention needed`,
        source_record_id: store.id,
        source_record_type: "store",
        status: "pending",
      });
      results.declining_health++;
    }

    console.log("[OPP-SYNC] Complete:", results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[OPP-SYNC] Error:", e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
