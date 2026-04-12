import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { pickup_datetime, vehicle_category } = await req.json();

    // Get all available drivers
    const { data: drivers } = await supabase
      .from('tt_drivers')
      .select('id,full_name,phone,rating,vehicle_id,vehicle_make,vehicle_model,license_plate,status')
      .in('status', ['available', 'off_duty']);

    if (!drivers?.length) {
      return new Response(JSON.stringify({ available_drivers: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If pickup_datetime provided, exclude drivers with overlapping dispatches
    let availableDriverIds = drivers.map(d => d.id);

    if (pickup_datetime) {
      const pickupTime = new Date(pickup_datetime);
      const twoHoursBefore = new Date(pickupTime.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const twoHoursAfter = new Date(pickupTime.getTime() + 2 * 60 * 60 * 1000).toISOString();

      const { data: busyDispatches } = await supabase
        .from('tt_dispatches')
        .select('driver_id')
        .in('status', ['assigned', 'en_route', 'arrived', 'in_progress'])
        .not('driver_id', 'is', null);

      if (busyDispatches?.length) {
        const busyIds = new Set(busyDispatches.map(d => d.driver_id));
        availableDriverIds = availableDriverIds.filter(id => !busyIds.has(id));
      }
    }

    const available_drivers = drivers
      .filter(d => availableDriverIds.includes(d.id))
      .map(d => ({
        driver_id: d.id,
        name: d.full_name,
        rating: d.rating,
        vehicle_id: d.vehicle_id,
        vehicle_name: d.vehicle_make ? `${d.vehicle_make} ${d.vehicle_model}` : 'N/A',
        license_plate: d.license_plate,
        status: d.status,
      }));

    return new Response(JSON.stringify({ available_drivers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('tt-get-driver-availability error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
