import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { brand, timeframe = 'today' } = await req.json();

    // Calculate date range
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate = startOfToday;

    if (timeframe === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Fetch today's revenue from visit logs
    const { data: visitLogs } = await supabaseClient
      .from('visit_logs')
      .select('cash_collected')
      .gte('visit_datetime', startDate.toISOString());

    const totalRevenue = visitLogs?.reduce((sum, log) => sum + (log.cash_collected || 0), 0) || 0;

    // Fetch orders
    const { data: orders, count: ordersCount } = await supabaseClient
      .from('wholesale_orders')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    // Fetch deliveries
    const { data: routes } = await supabaseClient
      .from('routes')
      .select('status')
      .gte('date', startDate.toISOString().split('T')[0])
      .eq('status', 'completed');

    const deliveriesCompleted = routes?.length || 0;

    // Fetch new stores
    const { count: newStoresCount } = await supabaseClient
      .from('stores')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    // Fetch communication volume
    const { data: comms } = await supabaseClient
      .from('communication_logs')
      .select('channel')
      .gte('created_at', startDate.toISOString());

    const commVolume = {
      sms: comms?.filter(c => c.channel === 'sms').length || 0,
      email: comms?.filter(c => c.channel === 'email').length || 0,
      ai_call: comms?.filter(c => c.channel === 'ai_call').length || 0,
      va_call: comms?.filter(c => c.channel === 'va_call').length || 0,
      total: comms?.length || 0,
    };

    // Fetch automations triggered
    const { count: automationsTriggered } = await supabaseClient
      .from('automation_logs')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    // Fetch new signups across brands
    const { count: newSignups } = await supabaseClient
      .from('crm_contacts')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    // Fetch driver/biker activity
    const { data: checkins } = await supabaseClient
      .from('route_checkins')
      .select('*')
      .gte('checkin_time', startDate.toISOString());

    const driverActivity = checkins?.length || 0;

    // Brand-specific data if brand is provided
    let brandData = null;
    if (brand) {
      const { data: brandStores } = await supabaseClient
        .from('store_brand_accounts')
        .select('*, store_master(*)')
        .eq('brand', brand);

      const { data: brandComms } = await supabaseClient
        .from('communication_logs')
        .select('*')
        .eq('brand', brand)
        .gte('created_at', startDate.toISOString());

      const { data: brandOrders } = await supabaseClient
        .from('wholesale_orders')
        .select('total_amount')
        .eq('brand', brand)
        .gte('created_at', startDate.toISOString());

      const brandRevenue = brandOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

      brandData = {
        activeAccounts: brandStores?.length || 0,
        revenue: brandRevenue,
        communicationVolume: brandComms?.length || 0,
        orders: brandOrders?.length || 0,
        topStores: brandStores?.slice(0, 10) || [],
      };
    }

    return new Response(JSON.stringify({
      success: true,
      timeframe,
      metrics: {
        totalRevenue,
        ordersToday: ordersCount || 0,
        deliveriesCompleted,
        newStores: newStoresCount || 0,
        communicationVolume: commVolume,
        automationsTriggered: automationsTriggered || 0,
        newSignups: newSignups || 0,
        driverActivity,
      },
      brandData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ceo-dashboard-metrics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});