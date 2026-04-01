import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const callSid = formData.get('CallSid') as string
    const answeredBy = formData.get('AnsweredBy') as string

    console.log(`📞 AMD Callback: CallSid=${callSid}, AnsweredBy=${answeredBy}`)

    const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
    const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const isMachine = ['machine_start', 'machine_end_beep',
      'machine_end_silence', 'machine_end_other', 'fax'].includes(answeredBy)

    if (isMachine) {
      console.log(`🤖 Machine detected (${answeredBy}) — hanging up call ${callSid}`)

      // Hang up immediately
      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls/${callSid}.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({ Status: 'completed' })
        }
      )

      // Log as voicemail
      await fetch(
        `${SUPABASE_URL}/rest/v1/dc_call_logs?call_sid=eq.${callSid}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            status: 'voicemail',
            answered_by: answeredBy,
            outcome: 'voicemail_skipped'
          })
        }
      )
    } else {
      console.log(`👤 Human detected — letting AI speak on call ${callSid}`)

      // Human answered
      await fetch(
        `${SUPABASE_URL}/rest/v1/dc_call_logs?call_sid=eq.${callSid}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            status: 'connected',
            answered_by: answeredBy
          })
        }
      )
    }

    return new Response('OK', { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error('dc-amd-callback error:', err)
    return new Response('OK', { status: 200, headers: corsHeaders })
  }
})
