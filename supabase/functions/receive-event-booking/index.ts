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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()

    // Validate required fields
    if (!body.name || !body.email || !body.phone) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, email, phone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const insertPayload = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      event_type: body.event_type || null,
      event_date: body.event_date || null,
      city: body.city || null,
      guest_count: body.guest_count || null,
      budget: body.budget || null,
      preferences: body.preferences || null,
      package_name: body.package_name || null,
      full_price: body.full_price || 0,
      deposit_amount: body.deposit_amount || 0,
      deposit_paid: body.deposit_paid || false,
      stripe_payment_intent_id: body.stripe_payment_intent_id || null,
      ai_plan: body.ai_plan || null,
      status: body.status || 'pending_payment',
    }

    const { data: inserted, error: insertError } = await supabase
      .from('ut_event_bookings')
      .insert(insertPayload)
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send admin SMS alert (non-blocking)
    try {
      const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
      const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
      const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER') || Deno.env.get('TWILIO_PHONE_NUMBER')

      if (accountSid && authToken && fromNumber) {
        const smsBody = `💰 NEW EVENT BOOKING\nEvent: ${body.event_type || 'N/A'}\nDate: ${body.event_date || 'TBD'}\nCity: ${body.city || 'N/A'}\nGuests: ${body.guest_count || 'N/A'}\nPackage: ${body.package_name || 'Custom'}\nDeposit Due: $${body.deposit_amount || 0}\nName: ${body.name}\nPhone: ${body.phone}\nEmail: ${body.email}`

        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
        const credentials = btoa(`${accountSid}:${authToken}`)

        await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: '+19295007046',
            From: fromNumber,
            Body: smsBody,
          }),
        })
      }
    } catch (smsErr) {
      console.error('SMS alert failed (non-blocking):', smsErr)
    }

    return new Response(
      JSON.stringify({ success: true, id: inserted?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
