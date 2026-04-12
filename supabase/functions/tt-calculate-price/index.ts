import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { vehicle_id, vehicle_category, distance_miles, pickup_datetime, passenger_count } = await req.json();

    if (!distance_miles) {
      return new Response(JSON.stringify({ error: 'distance_miles required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get pricing rule
    let query = supabase.from('tt_pricing_rules').select('*').eq('is_active', true);
    if (vehicle_id) query = query.eq('vehicle_id', vehicle_id);
    else if (vehicle_category) query = query.eq('vehicle_category', vehicle_category);
    
    const { data: rules } = await query.limit(1);
    const rule = rules?.[0];

    if (!rule) {
      return new Response(JSON.stringify({ error: 'No pricing rule found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Calculate base subtotal
    let subtotal = Number(rule.base_rate) + (distance_miles * Number(rule.per_mile_rate));

    // Determine surge multiplier
    let surge_multiplier = Number(rule.surge_multiplier) || 1.0;
    if (pickup_datetime) {
      const dt = new Date(pickup_datetime);
      const hour = dt.getHours();
      const dayOfWeek = dt.getDay();
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      const isRushHour = isWeekday && ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19));
      if (isRushHour) surge_multiplier = Math.max(surge_multiplier, 1.25);
    }

    subtotal *= surge_multiplier;

    // Enforce minimum
    const minimum_applied = subtotal < Number(rule.minimum_fare);
    const estimated_total = Math.max(subtotal, Number(rule.minimum_fare));

    return new Response(JSON.stringify({
      base_rate: Number(rule.base_rate),
      distance_miles,
      per_mile_rate: Number(rule.per_mile_rate),
      surge_multiplier,
      subtotal: Math.round(subtotal * 100) / 100,
      minimum_applied,
      estimated_total: Math.round(estimated_total * 100) / 100,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('tt-calculate-price error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
