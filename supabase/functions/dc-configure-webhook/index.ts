const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone_number, phone_number_id } = await req.json()

    if (!phone_number) {
      return new Response(JSON.stringify({ success: false, error: 'phone_number is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
    const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || ''
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    if (!TWILIO_SID.startsWith('AC') || TWILIO_SID.length < 34) {
      return new Response(JSON.stringify({
        success: false,
        error: 'TWILIO_ACCOUNT_SID appears invalid — verify it starts with AC and is copied exactly from your Twilio console.',
        credential_issue: true
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!TWILIO_TOKEN || TWILIO_TOKEN.length < 32) {
      return new Response(JSON.stringify({
        success: false,
        error: 'TWILIO_AUTH_TOKEN missing or invalid — copy it directly from your Twilio console dashboard.',
        credential_issue: true
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Step 1: Look up the phone number SID from Twilio
    const lookupResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phone_number)}`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
        }
      }
    )

    const lookupData = await lookupResp.json()

    // Detect auth failures explicitly
    if (lookupResp.status === 401) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Twilio credentials rejected (401). Your TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is incorrect. Go to console.twilio.com → Account → copy the exact Account SID (starts with AC) and Auth Token, then update them in your backend secrets.',
        credential_issue: true
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!lookupResp.ok || !lookupData.incoming_phone_numbers?.length) {
      return new Response(JSON.stringify({
        success: false,
        error: `Phone number ${phone_number} not found in your Twilio account. Make sure it's purchased and active.`,
        details: lookupData
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const numberSid = lookupData.incoming_phone_numbers[0].sid
    const webhookUrl = `${SUPABASE_URL}/functions/v1/dc-inbound-call`

    // Step 2: Update the webhook
    const updateResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers/${numberSid}.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          VoiceUrl: webhookUrl,
          VoiceMethod: 'POST',
          StatusCallback: `${SUPABASE_URL}/functions/v1/dc-call-status`,
          StatusCallbackMethod: 'POST'
        })
      }
    )

    const updateData = await updateResp.json()

    if (!updateResp.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to update Twilio webhook',
        details: updateData
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Step 3: Update db record
    if (phone_number_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/dc_phone_numbers?id=eq.${phone_number_id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          twilio_webhook_configured: true,
          twilio_sid: numberSid,
          webhook_url: webhookUrl
        })
      })
    }

    return new Response(JSON.stringify({
      success: true,
      number_sid: numberSid,
      webhook_url: webhookUrl,
      message: `Webhook configured for ${phone_number}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('dc-configure-webhook error:', err)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
