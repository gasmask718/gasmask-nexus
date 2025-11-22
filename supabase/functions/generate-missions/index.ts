import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split('T')[0];

    // Check if mission already exists for today
    const { data: existing } = await supabase
      .from('daily_missions')
      .select('id')
      .eq('date', today)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: 'Mission already exists for today' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create today's mission
    const { data: mission, error: missionError } = await supabase
      .from('daily_missions')
      .insert({ date: today })
      .select()
      .single();

    if (missionError) throw missionError;

    const missionItems = [];

    // 1. Get 3 stores with lowest inventory
    const { data: lowInventory } = await supabase
      .from('store_product_state')
      .select('*, stores(*)')
      .eq('last_inventory_level', 'empty')
      .limit(3);

    for (const item of lowInventory || []) {
      missionItems.push({
        mission_id: mission.id,
        category: 'low_inventory',
        store_id: item.store_id,
        priority: 10,
        reason: `${item.stores?.name} is out of stock`
      });
    }

    // 2. Get 3 stores predicted to run out soon
    const { data: stockouts } = await supabase
      .from('inventory_alerts')
      .select('*, stores(*)')
      .eq('alert_type', 'stockout_prediction')
      .eq('is_resolved', false)
      .order('urgency_score', { ascending: false })
      .limit(3);

    for (const alert of stockouts || []) {
      missionItems.push({
        mission_id: mission.id,
        category: 'predicted_stockout',
        store_id: alert.store_id,
        priority: 9,
        reason: `${alert.stores?.name} predicted to run out soon`
      });
    }

    // 3. Get 3 best prospects
    const { data: prospects } = await supabase
      .from('stores')
      .select('*')
      .eq('status', 'prospect')
      .limit(3);

    for (const store of prospects || []) {
      missionItems.push({
        mission_id: mission.id,
        category: 'prospect',
        store_id: store.id,
        priority: 8,
        reason: `Follow up with prospect: ${store.name}`
      });
    }

    // 4. Get 3 worst failing stores
    const { data: failing } = await supabase
      .from('stores')
      .select('*')
      .eq('status', 'needsFollowUp')
      .limit(3);

    for (const store of failing || []) {
      missionItems.push({
        mission_id: mission.id,
        category: 'failing_store',
        store_id: store.id,
        priority: 7,
        reason: `Needs attention: ${store.name}`
      });
    }

    // 5. Get 3 influencers to reach out to
    const { data: influencers } = await supabase
      .from('influencers')
      .select('*')
      .eq('status', 'target')
      .order('score', { ascending: false })
      .limit(3);

    for (const influencer of influencers || []) {
      missionItems.push({
        mission_id: mission.id,
        category: 'influencer_outreach',
        influencer_id: influencer.id,
        priority: 6,
        reason: `Reach out to @${influencer.username} (${influencer.followers.toLocaleString()} followers)`
      });
    }

    // 6. Get 3 wholesale hubs
    const { data: hubs } = await supabase
      .from('wholesale_hubs')
      .select('*')
      .eq('status', 'active')
      .order('rating', { ascending: false })
      .limit(3);

    for (const hub of hubs || []) {
      missionItems.push({
        mission_id: mission.id,
        category: 'wholesale_hub',
        hub_id: hub.id,
        priority: 5,
        reason: `Restock opportunity at ${hub.name}`
      });
    }

    // Insert all mission items
    if (missionItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('mission_items')
        .insert(missionItems);

      if (itemsError) throw itemsError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        mission: mission,
        itemsCreated: missionItems.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Mission generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});