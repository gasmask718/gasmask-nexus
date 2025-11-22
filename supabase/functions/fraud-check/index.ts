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

    // Fetch recent visit logs for analysis
    const { data: visits, error: visitError } = await supabase
      .from('visit_logs')
      .select('*, stores(*), profiles(*)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (visitError) throw visitError;

    const fraudFlags = [];

    for (const visit of visits || []) {
      // Check 1: Visit duration too short (less than 2 minutes)
      const visitDuration = visit.visit_datetime ? 
        (new Date().getTime() - new Date(visit.visit_datetime).getTime()) / 1000 / 60 : 0;
      
      if (visitDuration < 2 && visit.visit_type === 'delivery') {
        fraudFlags.push({
          driver_id: visit.user_id,
          store_id: visit.store_id,
          route_stop_id: null,
          type: 'suspicious_duration',
          severity: 'medium',
          message: `Visit completed in under 2 minutes at ${visit.stores?.name}`,
          timestamp: new Date().toISOString()
        });
      }

      // Check 2: No photos uploaded for delivery
      if (visit.visit_type === 'delivery' && (!visit.photos || visit.photos.length === 0)) {
        fraudFlags.push({
          driver_id: visit.user_id,
          store_id: visit.store_id,
          route_stop_id: null,
          type: 'missing_photos',
          severity: 'high',
          message: `No delivery photos uploaded at ${visit.stores?.name}`,
          timestamp: new Date().toISOString()
        });
      }

      // Check 3: Cash collected but no products delivered
      if (visit.cash_collected && visit.cash_collected > 0 && 
          (!visit.products_delivered || Object.keys(visit.products_delivered).length === 0)) {
        fraudFlags.push({
          driver_id: visit.user_id,
          store_id: visit.store_id,
          route_stop_id: null,
          type: 'cash_mismatch',
          severity: 'high',
          message: `Cash collected ($${visit.cash_collected}) but no products logged at ${visit.stores?.name}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Check 4: Driver idle patterns - check location updates
    const { data: locations, error: locError } = await supabase
      .from('drivers_live_location')
      .select('*, profiles(*)');

    if (locError) throw locError;

    for (const loc of locations || []) {
      const lastUpdate = new Date(loc.updated_at).getTime();
      const now = new Date().getTime();
      const hoursSinceUpdate = (now - lastUpdate) / 1000 / 60 / 60;

      if (hoursSinceUpdate > 4) {
        fraudFlags.push({
          driver_id: loc.driver_id,
          store_id: null,
          route_stop_id: null,
          type: 'idle_driver',
          severity: 'low',
          message: `Driver ${loc.profiles?.name} hasn't updated location in ${Math.floor(hoursSinceUpdate)} hours`,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Insert fraud flags
    if (fraudFlags.length > 0) {
      const { error: insertError } = await supabase
        .from('fraud_flags')
        .insert(fraudFlags);

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        flagsCreated: fraudFlags.length,
        flags: fraudFlags 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fraud check error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});