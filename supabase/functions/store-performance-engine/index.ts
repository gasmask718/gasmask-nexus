import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StoreMetrics {
  storeId: string;
  dailySales: number;
  weeklySales: number;
  monthlySales: number;
  sellThroughRate: number;
  restockFrequency: number;
  inventoryAgeDays: number;
  driverVisitCount: number;
  communicationScore: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting store performance engine...');

    // Fetch all active stores
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, name, status, created_at')
      .eq('status', 'active');

    if (storesError) throw storesError;
    if (!stores || stores.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active stores to analyze', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing ${stores.length} stores...`);

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const snapshots = [];
    const storeUpdates = [];

    for (const store of stores) {
      try {
        // Fetch orders
        const { data: dailyOrders } = await supabase
          .from('store_orders')
          .select('total_amount')
          .eq('store_id', store.id)
          .gte('created_at', oneDayAgo.toISOString());

        const { data: weeklyOrders } = await supabase
          .from('store_orders')
          .select('total_amount')
          .eq('store_id', store.id)
          .gte('created_at', sevenDaysAgo.toISOString());

        const { data: monthlyOrders } = await supabase
          .from('store_orders')
          .select('total_amount')
          .eq('store_id', store.id)
          .gte('created_at', thirtyDaysAgo.toISOString());

        // Fetch check-ins (driver visits)
        const { data: checkIns } = await supabase
          .from('route_stops')
          .select('id, completed_at')
          .eq('store_id', store.id)
          .not('completed_at', 'is', null)
          .gte('completed_at', thirtyDaysAgo.toISOString());

        // Fetch communication events
        const { data: communications } = await supabase
          .from('communication_events')
          .select('id, created_at')
          .eq('store_id', store.id)
          .gte('created_at', thirtyDaysAgo.toISOString());

        // Fetch inventory data
        const { data: inventory } = await supabase
          .from('inventory_stores')
          .select('last_delivery_date, updated_at')
          .eq('store_id', store.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        // Calculate metrics
        const dailySales = dailyOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
        const weeklySales = weeklyOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
        const monthlySales = monthlyOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
        
        const driverVisitCount = checkIns?.length || 0;
        const communicationCount = communications?.length || 0;
        
        // Calculate sell-through rate (simplified)
        const sellThroughRate = weeklySales > 0 ? Math.min(100, (weeklySales / 1000) * 100) : 0;
        
        // Calculate restock frequency (times restocked in last 30 days)
        const restockFrequency = Math.floor(driverVisitCount / 4);
        
        // Calculate inventory age
        const lastDelivery = inventory?.last_delivery_date 
          ? new Date(inventory.last_delivery_date) 
          : new Date(store.created_at);
        const inventoryAgeDays = Math.floor((now.getTime() - lastDelivery.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate communication score (0-100)
        const communicationScore = Math.min(100, communicationCount * 5);
        
        // Calculate days since last check-in
        const lastCheckIn = checkIns && checkIns.length > 0 
          ? new Date(checkIns[0].completed_at!)
          : new Date(store.created_at);
        const daysSinceCheckIn = Math.floor((now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60 * 24));

        const metrics: StoreMetrics = {
          storeId: store.id,
          dailySales: Math.round(dailySales),
          weeklySales: Math.round(weeklySales),
          monthlySales: Math.round(monthlySales),
          sellThroughRate: Math.round(sellThroughRate * 10) / 10,
          restockFrequency,
          inventoryAgeDays,
          driverVisitCount,
          communicationScore,
        };

        // Call Lovable AI for performance scoring
        const aiPrompt = `You are GasMask Store Performance AI. Analyze this store's metrics and provide a performance score (0-100), risk score (0-100), and recommendation.

Store: ${store.name}
Daily Sales: $${metrics.dailySales}
Weekly Sales: $${metrics.weeklySales}
Monthly Sales: $${metrics.monthlySales}
Sell-Through Rate: ${metrics.sellThroughRate}%
Driver Visits (30d): ${metrics.driverVisitCount}
Communication Score: ${metrics.communicationScore}/100
Days Since Last Check-in: ${daysSinceCheckIn}
Inventory Age: ${metrics.inventoryAgeDays} days

Return JSON only:
{
  "performanceScore": <0-100>,
  "riskScore": <0-100>,
  "recommendation": "<specific action recommendation>"
}`;

        const aiResponse = await fetch('https://api.lovable.app/v1/ai/chat', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{ role: 'user', content: aiPrompt }],
          }),
        });

        let performanceScore = 50;
        let riskScore = 0;
        let aiRecommendation = 'Maintain current operations';

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              performanceScore = parsed.performanceScore || 50;
              riskScore = parsed.riskScore || 0;
              aiRecommendation = parsed.recommendation || aiRecommendation;
            }
          } catch (parseError) {
            console.error('AI JSON parse error:', parseError);
          }
        }

        // Calculate tier based on performance score
        let tier = 'Standard';
        if (performanceScore > 85) tier = 'Platinum';
        else if (performanceScore >= 70) tier = 'Gold';
        else if (performanceScore >= 55) tier = 'Silver';
        else if (performanceScore < 35 || daysSinceCheckIn > 14 || (monthlySales === 0 && daysSinceCheckIn > 21)) {
          tier = 'At-Risk';
          riskScore = Math.max(riskScore, 70);
        }

        // Create snapshot
        snapshots.push({
          store_id: store.id,
          daily_sales: metrics.dailySales,
          weekly_sales: metrics.weeklySales,
          monthly_sales: metrics.monthlySales,
          sell_through_rate: metrics.sellThroughRate,
          restock_frequency: metrics.restockFrequency,
          inventory_age_days: metrics.inventoryAgeDays,
          driver_visit_count: metrics.driverVisitCount,
          communication_score: metrics.communicationScore,
          performance_score: performanceScore,
          risk_score: riskScore,
          ai_recommendation: aiRecommendation,
        });

        // Prepare store update
        storeUpdates.push({
          id: store.id,
          performance_tier: tier,
          performance_score: performanceScore,
          last_performance_update: now.toISOString(),
        });

      } catch (storeError) {
        console.error(`Error processing store ${store.id}:`, storeError);
      }
    }

    // Insert snapshots in batch
    if (snapshots.length > 0) {
      const { error: snapshotError } = await supabase
        .from('store_performance_snapshots')
        .insert(snapshots);

      if (snapshotError) {
        console.error('Error inserting snapshots:', snapshotError);
      }
    }

    // Update stores in batch
    for (const update of storeUpdates) {
      await supabase
        .from('stores')
        .update({
          performance_tier: update.performance_tier,
          performance_score: update.performance_score,
          last_performance_update: update.last_performance_update,
        })
        .eq('id', update.id);
    }

    console.log(`Successfully processed ${snapshots.length} stores`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Analyzed ${snapshots.length} stores`,
        processed: snapshots.length,
        snapshots: snapshots.slice(0, 5), // Return sample
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Store performance engine error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});