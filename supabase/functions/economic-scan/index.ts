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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Economic Scan: Starting comprehensive analysis...');

    // Gather economic data
    const [orders, invoices, inventory, stores, hubs] = await Promise.all([
      supabase.from('store_orders').select('*').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('invoices').select('*'),
      supabase.from('inventory_stores').select('*, stores(name, address_city), products(name)'),
      supabase.from('stores').select('*, store_wallet(*)'),
      supabase.from('wholesale_hubs').select('*'),
    ]);

    const economicData = {
      orders: {
        total: orders.data?.length || 0,
        totalRevenue: orders.data?.reduce((sum, o) => sum + o.total_amount, 0) || 0,
        avgOrderValue: (orders.data?.reduce((sum, o) => sum + o.total_amount, 0) || 0) / (orders.data?.length || 1),
        deliveredCount: orders.data?.filter(o => o.status === 'delivered').length || 0,
      },
      invoices: {
        total: invoices.data?.length || 0,
        unpaid: invoices.data?.filter(i => i.payment_status === 'unpaid').length || 0,
        overdue: invoices.data?.filter(i => i.payment_status === 'overdue').length || 0,
        totalOutstanding: invoices.data?.filter(i => i.payment_status !== 'paid').reduce((sum, i) => sum + (i.total_amount - i.amount_paid), 0) || 0,
      },
      inventory: {
        total: inventory.data?.length || 0,
        criticalStock: inventory.data?.filter(i => i.quantity_current <= i.reorder_point).length || 0,
        stockoutRisk: inventory.data?.filter(i => i.predicted_stockout_date && new Date(i.predicted_stockout_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length || 0,
      },
      stores: {
        total: stores.data?.length || 0,
        withDebt: stores.data?.filter(s => s.store_wallet && s.store_wallet.length > 0 && s.store_wallet[0].balance < 0).length || 0,
      },
      hubs: {
        total: hubs.data?.length || 0,
      },
    };

    console.log('Economic data gathered:', economicData);

    // Call Lovable AI for economic analysis
    const prompt = `You are an economic analysis AI for GasMask OS. Analyze this financial data:

ORDERS (Last 30 Days):
- Total Orders: ${economicData.orders.total}
- Total Revenue: $${economicData.orders.totalRevenue.toFixed(2)}
- Average Order Value: $${economicData.orders.avgOrderValue.toFixed(2)}
- Delivered: ${economicData.orders.deliveredCount}

INVOICES:
- Total: ${economicData.invoices.total}
- Unpaid: ${economicData.invoices.unpaid}
- Overdue: ${economicData.invoices.overdue}
- Outstanding Amount: $${economicData.invoices.totalOutstanding.toFixed(2)}

INVENTORY:
- Critical Stock Items: ${economicData.inventory.criticalStock}
- Stockout Risk (7 days): ${economicData.inventory.stockoutRisk}

STORES:
- Total: ${economicData.stores.total}
- With Outstanding Debt: ${economicData.stores.withDebt}

ANALYSIS REQUIRED:
1. Calculate overall economic health score (0-100)
2. Identify top risks to cash flow
3. Find growth opportunities
4. Provide action items for immediate attention
5. Predict bottlenecks
6. Generate 7-day and 30-day forecasts

Return structured JSON with: economicScore, topRisks, topOpportunities, actionItems, systemBottlenecks, predictions7Days, predictions30Days`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a financial analysis AI. Return analysis as structured JSON with economicScore, topRisks, topOpportunities, actionItems, systemBottlenecks, predictions7Days, and predictions30Days.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = JSON.parse(aiData.choices[0].message.content);

    console.log('Economic analysis complete:', analysis);

    return new Response(JSON.stringify({
      success: true,
      economicData,
      analysis,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in economic-scan:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
