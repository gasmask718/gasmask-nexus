const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const callSid = formData.get('CallSid') as string
    const callStatus = formData.get('CallStatus') as string
    const callDuration = formData.get('CallDuration') as string

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    await fetch(
      `${SUPABASE_URL}/rest/v1/dc_call_logs?call_sid=eq.${callSid}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: callStatus,
          duration_seconds: parseInt(callDuration || '0'),
          updated_at: new Date().toISOString()
        })
      }
    )

    return new Response('OK', { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error('dc-call-status error:', err)
    return new Response('OK', { status: 200, headers: corsHeaders })
  }
})
