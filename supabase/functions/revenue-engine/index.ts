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

    const { action, storeId, businessId, verticalId } = await req.json();

    if (action === 'score_store') {
      return await scoreStore(supabase, storeId);
    } else if (action === 'score_all') {
      return await scoreAllStores(supabase, businessId, verticalId);
    } else if (action === 'generate_recommendations') {
      return await generateRecommendations(supabase, businessId, verticalId);
    } else if (action === 'sync_to_followup') {
      return await syncToFollowUp(supabase, storeId);
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    console.error('Revenue Engine error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function scoreStore(supabase: any, storeId: string) {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch store data
  const { data: store } = await supabase
    .from('store_master')
    .select('*, businesses(*), brand_verticals(*)')
    .eq('id', storeId)
    .single();

  if (!store) {
    return new Response(JSON.stringify({ error: 'Store not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Fetch orders (using invoices as proxy)
  const { data: invoices30d } = await supabase
    .from('invoices')
    .select('total, created_at')
    .eq('store_id', storeId)
    .gte('created_at', thirtyDaysAgo);

  const { data: invoices90d } = await supabase
    .from('invoices')
    .select('total, created_at')
    .eq('store_id', storeId)
    .gte('created_at', ninetyDaysAgo);

  // Fetch call analytics for sentiment
  const { data: callAnalytics } = await supabase
    .from('call_analytics')
    .select('sentiment_score')
    .eq('store_id', storeId)
    .gte('created_at', thirtyDaysAgo);

  // Fetch follow-ups
  const { data: followUps } = await supabase
    .from('follow_up_queue')
    .select('id')
    .eq('store_id', storeId)
    .gte('created_at', thirtyDaysAgo);

  // Fetch deals
  const { data: deals } = await supabase
    .from('deals')
    .select('id, status')
    .eq('store_id', storeId)
    .gte('created_at', ninetyDaysAgo);

  // Calculate metrics
  const revenue30d = (invoices30d || []).reduce((sum: number, inv: { total?: number }) => sum + (Number(inv.total) || 0), 0);
  const revenue90d = (invoices90d || []).reduce((sum: number, inv: { total?: number }) => sum + (Number(inv.total) || 0), 0);
  const orderCount30d = (invoices30d || []).length;
  const orderCount90d = (invoices90d || []).length;
  const avgOrderValue = orderCount90d > 0 ? revenue90d / orderCount90d : 0;

  // Last order
  const sortedInvoices = (invoices90d || []).sort((a: { created_at?: string }, b: { created_at?: string }) => 
    new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
  );
  const lastOrderAt = sortedInvoices[0]?.created_at || null;

  // Calculate days since last order
  const daysSinceLastOrder = lastOrderAt 
    ? Math.floor((Date.now() - new Date(lastOrderAt).getTime()) / (24 * 60 * 60 * 1000))
    : 999;

  // Sentiment score (average from call analytics)
  const rawSentiments = (callAnalytics || []).map((c: { sentiment_score?: number | null }) => c.sentiment_score);
  const sentimentScores: number[] = rawSentiments.filter((s: number | null | undefined): s is number => typeof s === 'number');
  const avgSentiment = sentimentScores.length > 0 
    ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length 
    : 0;

  // Deal activity
  const openDeals = (deals || []).filter((d: { status?: string }) => d.status === 'open' || d.status === 'negotiating').length;
  const wonDeals = (deals || []).filter((d: { status?: string }) => d.status === 'won').length;
  const dealActivityScore = Math.min(100, (openDeals * 10) + (wonDeals * 20));

  // Follow-up intensity
  const followUpIntensity = Math.min(100, (followUps || []).length * 10);

  // Communication score (mock based on store status)
  const communicationScore = store.status === 'active' ? 70 : store.status === 'prospect' ? 40 : 20;

  // HEAT SCORE calculation
  let heatScore = 50; // baseline
  heatScore += Math.min(20, revenue30d / 500); // revenue bonus
  heatScore += daysSinceLastOrder < 7 ? 15 : daysSinceLastOrder < 14 ? 10 : daysSinceLastOrder < 30 ? 5 : 0;
  heatScore += communicationScore * 0.1;
  heatScore += (avgSentiment + 100) / 20; // sentiment from -100 to 100 mapped to 0-10
  heatScore += dealActivityScore * 0.1;
  heatScore = Math.min(100, Math.max(0, heatScore));

  // CHURN RISK calculation
  let churnRisk = 20; // baseline
  churnRisk += daysSinceLastOrder > 60 ? 40 : daysSinceLastOrder > 30 ? 25 : daysSinceLastOrder > 14 ? 10 : 0;
  churnRisk += avgSentiment < -30 ? 20 : avgSentiment < 0 ? 10 : 0;
  churnRisk -= communicationScore * 0.2;
  churnRisk = Math.min(100, Math.max(0, churnRisk));

  // ORDER PROBABILITY 7D
  let orderProb7d = 30; // baseline
  if (orderCount30d > 0) {
    const avgDaysBetweenOrders = 30 / orderCount30d;
    orderProb7d = daysSinceLastOrder >= avgDaysBetweenOrders * 0.8 ? 70 : 40;
  }
  orderProb7d += heatScore * 0.2;
  orderProb7d -= churnRisk * 0.3;
  orderProb7d = Math.min(100, Math.max(0, orderProb7d));

  // Predicted next order date
  const avgOrderCycle = orderCount90d > 1 ? 90 / orderCount90d : 14;
  const predictedNextOrderAt = lastOrderAt 
    ? new Date(new Date(lastOrderAt).getTime() + avgOrderCycle * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Restock window
  const restockWindowStart = predictedNextOrderAt 
    ? new Date(new Date(predictedNextOrderAt).getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const restockWindowEnd = predictedNextOrderAt 
    ? new Date(new Date(predictedNextOrderAt).getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Tags
  const tags: string[] = [];
  if (heatScore >= 80) tags.push('hot');
  if (churnRisk >= 70) tags.push('churn_risk');
  if (revenue90d >= 5000) tags.push('high_value');
  if (orderProb7d >= 70) tags.push('likely_to_order');
  if (avgSentiment < -20) tags.push('negative_sentiment');

  // Upsert score
  const scoreData = {
    store_id: storeId,
    business_id: store.business_id,
    vertical_id: store.vertical_id,
    snapshot_date: today,
    heat_score: heatScore,
    churn_risk: churnRisk,
    order_prob_7d: orderProb7d,
    avg_order_value: avgOrderValue,
    revenue_30d: revenue30d,
    revenue_90d: revenue90d,
    order_count_30d: orderCount30d,
    order_count_90d: orderCount90d,
    last_order_at: lastOrderAt,
    predicted_next_order_at: predictedNextOrderAt,
    restock_window_start: restockWindowStart,
    restock_window_end: restockWindowEnd,
    communication_score: communicationScore,
    sentiment_score: avgSentiment,
    deal_activity_score: dealActivityScore,
    follow_up_intensity: followUpIntensity,
    tags
  };

  const { data: score, error } = await supabase
    .from('store_revenue_scores')
    .upsert(scoreData, { onConflict: 'store_id,snapshot_date' })
    .select()
    .single();

  if (error) {
    console.error('Error saving score:', error);
  }

  return new Response(JSON.stringify({ success: true, score: scoreData }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function scoreAllStores(supabase: any, businessId?: string, verticalId?: string) {
  let query = supabase.from('store_master').select('id').eq('status', 'active');
  
  if (businessId) query = query.eq('business_id', businessId);
  if (verticalId) query = query.eq('vertical_id', verticalId);

  const { data: stores } = await query;
  const results = [];

  for (const store of (stores || [])) {
    const response = await scoreStore(supabase, store.id);
    const result = await response.json();
    results.push({ storeId: store.id, ...result });
  }

  return new Response(JSON.stringify({ success: true, scored: results.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function generateRecommendations(supabase: any, businessId?: string, verticalId?: string) {
  const today = new Date().toISOString().split('T')[0];
  
  let query = supabase
    .from('store_revenue_scores')
    .select('*, store_master(*)')
    .eq('snapshot_date', today);

  if (businessId) query = query.eq('business_id', businessId);
  if (verticalId) query = query.eq('vertical_id', verticalId);

  const { data: scores } = await query;
  const recommendations = [];

  for (const score of (scores || [])) {
    let priority = 5;
    let reason = '';
    let recommendedAction = '';
    let notes = '';

    // High heat + high order probability
    if (score.heat_score >= 80 && score.order_prob_7d >= 60) {
      priority = 1;
      reason = 'hot_store_restock';
      recommendedAction = 'ai_call';
      notes = `Hot store ready to order. Heat: ${score.heat_score}, 7-day prob: ${score.order_prob_7d}%`;
    }
    // High churn risk
    else if (score.churn_risk >= 70) {
      priority = 1;
      reason = 'churn_risk';
      recommendedAction = 'manual_call';
      notes = `High churn risk (${score.churn_risk}%). Needs personal attention.`;
    }
    // High value at risk
    else if (score.revenue_90d >= 5000 && score.churn_risk >= 50) {
      priority = 2;
      reason = 'high_value_at_risk';
      recommendedAction = 'manual_call';
      notes = `High-value store ($${score.revenue_90d} in 90d) showing risk signs.`;
    }
    // In restock window
    else if (score.restock_window_start && new Date(score.restock_window_start) <= new Date()) {
      priority = 2;
      reason = 'restock_window';
      recommendedAction = 'ai_text';
      notes = `Store is in restock window. Good time to reach out.`;
    }
    // Moderate heat
    else if (score.heat_score >= 60) {
      priority = 3;
      reason = 'moderate_opportunity';
      recommendedAction = 'ai_text';
      notes = `Moderate opportunity. Heat: ${score.heat_score}`;
    }
    else {
      continue; // No recommendation needed
    }

    const recData = {
      store_id: score.store_id,
      business_id: score.business_id,
      vertical_id: score.vertical_id,
      score_snapshot_id: score.id,
      priority,
      reason,
      recommended_action: recommendedAction,
      recommended_brand: score.store_master?.preferred_brand || null,
      notes,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    const { data: rec } = await supabase
      .from('store_revenue_recommendations')
      .insert(recData)
      .select()
      .single();

    if (rec) recommendations.push(rec);
  }

  return new Response(JSON.stringify({ success: true, recommendations: recommendations.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function syncToFollowUp(supabase: any, storeId: string) {
  const { data: recs } = await supabase
    .from('store_revenue_recommendations')
    .select('*')
    .eq('store_id', storeId)
    .eq('synced_to_followup', false)
    .order('priority', { ascending: true });

  const synced = [];

  for (const rec of (recs || [])) {
    const followUpData = {
      store_id: rec.store_id,
      business_id: rec.business_id,
      vertical_id: rec.vertical_id,
      reason: `revenue_engine_${rec.reason}`,
      recommended_action: rec.recommended_action,
      priority: rec.priority,
      context: {
        source: 'revenue_engine_v1',
        recommendation_id: rec.id,
        notes: rec.notes,
        recommended_brand: rec.recommended_brand,
        recommended_offer: rec.recommended_offer
      },
      due_at: rec.priority <= 2 
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      status: 'pending'
    };

    const { data: followUp } = await supabase
      .from('follow_up_queue')
      .insert(followUpData)
      .select()
      .single();

    if (followUp) {
      await supabase
        .from('store_revenue_recommendations')
        .update({ synced_to_followup: true, followup_id: followUp.id })
        .eq('id', rec.id);

      synced.push(followUp);
    }
  }

  return new Response(JSON.stringify({ success: true, synced: synced.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
