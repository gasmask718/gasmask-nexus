import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shared-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const secret = req.headers.get('x-shared-secret')
    const expected = Deno.env.get('UT_OS_SHARED_SECRET');
    const ok = !!expected && !!secret && secret === expected;
    if (!ok) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()

    const { data: existing } = await supabase
      .from('event_halls')
      .select('id')
      .eq('contact_email', body.contact_email)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Email already exists', code: 'DUPLICATE' }),
        { status: 409, headers: corsHeaders }
      )
    }

    const { error: insertError } = await supabase
      .from('event_halls')
      .insert({
        name: body.hall_name || body.name,
        description: body.description,
        tagline: body.tagline,
        address: body.address,
        city: body.city,
        state: body.state,
        zip_code: body.zip_code,
        capacity_min: body.capacity_min,
        capacity_max: body.capacity_max,
        price_per_hour: body.price_per_hour,
        price_per_day: body.price_per_day,
        contact_name: body.contact_name,
        contact_email: body.contact_email,
        contact_phone: body.contact_phone,
        instagram_handle: body.instagram_handle,
        website_url: body.website_url,
        amenities: body.amenities,
        event_types: body.event_types,
        status: 'pending'
      })

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: corsHeaders }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
