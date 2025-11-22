import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    // Fetch all stores with recent visit logs
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, name')
      .eq('status', 'active');

    if (storesError) throw storesError;

    const predictions = [];
    const alerts = [];

    for (const store of stores || []) {
      // Get visit logs for this store in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: visits, error: visitsError } = await supabase
        .from('visit_logs')
        .select('visit_datetime, products_delivered, inventory_levels')
        .eq('store_id', store.id)
        .gte('visit_datetime', thirtyDaysAgo.toISOString())
        .order('visit_datetime', { ascending: true });

      if (visitsError) {
        console.error('Error fetching visits:', visitsError);
        continue;
      }

      if (!visits || visits.length < 2) continue;

      // Calculate velocity (boxes delivered per day)
      let totalBoxes = 0;
      let deliveryCount = 0;

      visits.forEach(visit => {
        if (visit.products_delivered) {
          const products = visit.products_delivered as any[];
          products.forEach(p => {
            totalBoxes += (p.quantity || 0);
          });
          deliveryCount++;
        }
      });

      const daysSinceFirst = Math.max(1, 
        (new Date().getTime() - new Date(visits[0].visit_datetime).getTime()) / (1000 * 60 * 60 * 24)
      );

      const velocity = totalBoxes / daysSinceFirst;

      // Get current inventory levels
      const lastVisit = visits[visits.length - 1];
      let currentBoxes = 0;
      
      if (lastVisit.inventory_levels) {
        const inventory = lastVisit.inventory_levels as any;
        Object.values(inventory).forEach((level: any) => {
          // Convert inventory level to approximate boxes
          const boxes = level === 'full' ? 10 : 
                       level === 'threeQuarters' ? 7 : 
                       level === 'half' ? 5 : 
                       level === 'quarter' ? 2 : 0;
          currentBoxes += boxes;
        });
      }

      // Predict stockout date
      const daysUntilStockout = velocity > 0 ? currentBoxes / velocity : 999;
      const predictedStockoutDate = new Date();
      predictedStockoutDate.setDate(predictedStockoutDate.getDate() + Math.floor(daysUntilStockout));

      // Calculate urgency score (0-100)
      const urgencyScore = Math.min(100, Math.max(0, 
        100 - (daysUntilStockout * 10)
      ));

      predictions.push({
        store_id: store.id,
        velocity,
        predicted_stockout_date: predictedStockoutDate.toISOString().split('T')[0],
        urgency_score: Math.round(urgencyScore),
        current_boxes: currentBoxes
      });

      // Create alerts for urgent situations
      if (urgencyScore > 70) {
        alerts.push({
          store_id: store.id,
          alert_type: 'urgent_reorder',
          urgency_score: Math.round(urgencyScore),
          predicted_date: predictedStockoutDate.toISOString().split('T')[0],
          message: `${store.name} needs restock in ${Math.floor(daysUntilStockout)} days`
        });
      }
    }

    // Update store_product_state with predictions
    for (const pred of predictions) {
      const { error } = await supabase
        .from('store_product_state')
        .update({
          velocity_boxes_per_day: pred.velocity,
          predicted_stockout_date: pred.predicted_stockout_date,
          urgency_score: pred.urgency_score,
          last_velocity_calculation: new Date().toISOString()
        })
        .eq('store_id', pred.store_id);

      if (error) console.error('Update error:', error);
    }

    // Insert new alerts
    if (alerts.length > 0) {
      const { error: alertsError } = await supabase
        .from('inventory_alerts')
        .insert(alerts);

      if (alertsError) console.error('Alerts error:', alertsError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        predictions: predictions.length,
        alerts: alerts.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});