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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { storeId } = await req.json();

    // Fetch store data
    const { data: store } = await supabase
      .from('stores')
      .select('*, store_product_state(*), route_insights(*)')
      .eq('id', storeId)
      .single();

    if (!store) {
      throw new Error('Store not found');
    }

    // Fetch recent communication events
    const { data: communications } = await supabase
      .from('communication_events')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch recent visit logs
    const { data: visits } = await supabase
      .from('visit_logs')
      .select('*')
      .eq('store_id', storeId)
      .order('visit_datetime', { ascending: false })
      .limit(5);

    // Calculate priority score (0-100)
    let priorityScore = 50; // Base score
    let riskLevel = 'green';
    let recommendedAction = 'Visit';
    let reasoning = [];

    // Factor 1: Days since last contact
    const lastComm = communications?.[0];
    const daysSinceContact = lastComm 
      ? Math.floor((Date.now() - new Date(lastComm.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    if (daysSinceContact > 30) {
      priorityScore += 30;
      riskLevel = 'red';
      reasoning.push('No contact in over 30 days');
    } else if (daysSinceContact > 14) {
      priorityScore += 15;
      riskLevel = 'yellow';
      reasoning.push('No contact in 2+ weeks');
    } else if (daysSinceContact > 7) {
      priorityScore += 5;
      reasoning.push('Week since last contact');
    }

    // Factor 2: Store status
    if (store.status === 'prospect') {
      priorityScore += 20;
      recommendedAction = 'Call';
      reasoning.push('Prospect status - needs activation');
    } else if (store.status === 'needsFollowUp') {
      priorityScore += 25;
      recommendedAction = 'Visit';
      reasoning.push('Flagged for follow-up');
    } else if (store.status === 'inactive') {
      priorityScore += 15;
      recommendedAction = 'Text';
      reasoning.push('Inactive store - needs re-engagement');
    }

    // Factor 3: Inventory analysis
    const lowInventory = store.store_product_state?.filter(
      (sps: any) => sps.last_inventory_level === 'empty' || sps.last_inventory_level === 'quarter'
    ).length || 0;

    if (lowInventory > 2) {
      priorityScore += 10;
      reasoning.push(`${lowInventory} products low on inventory`);
    }

    // Factor 4: Route difficulty
    const routeInsights = store.route_insights?.[0];
    if (routeInsights && routeInsights.visit_success_rate < 0.5) {
      priorityScore += 10;
      riskLevel = riskLevel === 'green' ? 'yellow' : riskLevel;
      reasoning.push('Low visit success rate');
    }

    // Factor 5: Recent negative sentiment
    const negativeFlags = visits?.filter((v: any) => 
      v.flags?.some((f: string) => f.includes('negative') || f.includes('complaint'))
    ).length || 0;

    if (negativeFlags > 0) {
      priorityScore += 15;
      riskLevel = 'yellow';
      reasoning.push('Recent negative feedback');
    }

    // Cap priority score
    priorityScore = Math.min(100, Math.max(0, priorityScore));

    // Determine risk level based on final score
    if (priorityScore >= 75) {
      riskLevel = 'red';
    } else if (priorityScore >= 50) {
      riskLevel = 'yellow';
    } else {
      riskLevel = 'green';
    }

    // Generate suggested message
    let suggestedMessage = '';
    if (store.status === 'prospect') {
      suggestedMessage = `Hi ${store.primary_contact_name || 'there'}! This is ${store.name}. We'd love to discuss bringing GasMask products to your location. Are you available for a quick chat this week?`;
    } else if (daysSinceContact > 14) {
      suggestedMessage = `Hey ${store.primary_contact_name || 'there'}! Just checking in on ${store.name}. How are inventory levels? Need a restock?`;
    } else if (lowInventory > 2) {
      suggestedMessage = `Hi! Noticed you might be running low on several products. Want to schedule a delivery this week?`;
    } else {
      suggestedMessage = `Quick check-in for ${store.name}. Everything running smoothly? Let us know if you need anything!`;
    }

    // Calculate suggested date (3-7 days from now based on priority)
    const daysUntilFollowup = priorityScore >= 75 ? 1 : priorityScore >= 50 ? 3 : 7;
    const suggestedDate = new Date();
    suggestedDate.setDate(suggestedDate.getDate() + daysUntilFollowup);

    // Save recommendation
    const recommendation = {
      store_id: storeId,
      priority_score: priorityScore,
      risk_level: riskLevel,
      recommended_action: recommendedAction,
      suggested_message: suggestedMessage,
      suggested_date: suggestedDate.toISOString().split('T')[0],
      reasoning: reasoning.join('; '),
    };

    const { data: saved } = await supabase
      .from('followup_recommendations')
      .upsert(recommendation, { onConflict: 'store_id' })
      .select()
      .single();

    return new Response(
      JSON.stringify(saved),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});