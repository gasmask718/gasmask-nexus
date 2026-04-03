const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Smart local-presence routing for Brandaro
const getLocalNumber = (toNumber: string, defaultFrom: string): string => {
  const areaCode = toNumber.replace(/\D/g, '').substring(1, 4)

  if (['809', '829', '849'].includes(areaCode)) return Deno.env.get('BRANDARO_DR_NUMBER') || defaultFrom
  if (['305', '754', '786', '407', '561', '321', '941', '727', '813', '904'].includes(areaCode)) return Deno.env.get('BRANDARO_FL_NUMBER') || defaultFrom
  if (['214', '713', '832', '512', '281', '972', '469', '817', '210', '361'].includes(areaCode)) return Deno.env.get('BRANDARO_TX_NUMBER') || defaultFrom
  if (['213', '310', '323', '415', '619', '818', '626', '949', '714', '562'].includes(areaCode)) return Deno.env.get('BRANDARO_CA_NUMBER') || defaultFrom
  if (['848', '201', '732', '908', '973', '551', '609'].includes(areaCode)) return Deno.env.get('BRANDARO_NJ_NUMBER') || defaultFrom
  if (['404', '470', '678', '770', '706', '762'].includes(areaCode)) return Deno.env.get('BRANDARO_GA_NUMBER') || defaultFrom
  return defaultFrom
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      to_number,
      lead_name,
      lead_id,
      business,
      agent_type,
      campaign_id,
      agent_id_override
    } = await req.json()

    if (!to_number) {
      return new Response(JSON.stringify({ success: false, error: 'to_number is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ═══ Credential Validation ═══
    const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
    const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || ''
    const ELEVENLABS_KEY = Deno.env.get('ELEVENLABS_API_KEY') || ''
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

    if (!ELEVENLABS_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ELEVENLABS_API_KEY is not configured.',
        credential_issue: true
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Agent routing map by business and type
    const agentRouting: Record<string, Record<string, string>> = {
      unforgettable_times: {
        partner: Deno.env.get('UT_PARTNER_AGENT_ID') || '',
        concierge: Deno.env.get('UT_CONCIERGE_AGENT_ID') || '',
        ambassador: Deno.env.get('UT_AMBASSADOR_AGENT_ID') || '',
        default: Deno.env.get('UT_PARTNER_AGENT_ID') || ''
      },
      real_estate: {
        qualifier: Deno.env.get('RE_QUALIFIER_AGENT_ID') || '',
        specialist: Deno.env.get('RE_SPECIALIST_AGENT_ID') || '',
        closer: Deno.env.get('RE_CLOSER_AGENT_ID') || '',
        default: Deno.env.get('RE_QUALIFIER_AGENT_ID') || ''
      },
      surplus_funds: {
        client: Deno.env.get('SF_CLIENT_AGENT_ID') || '',
        attorney: Deno.env.get('SF_ATTORNEY_AGENT_ID') || '',
        default: Deno.env.get('SF_CLIENT_AGENT_ID') || ''
      },
      top_tier: {
        concierge: Deno.env.get('TT_CONCIERGE_AGENT_ID') || '',
        ambassador: Deno.env.get('TT_AMBASSADOR_AGENT_ID') || '',
        default: Deno.env.get('TT_CONCIERGE_AGENT_ID') || ''
      },
      brandaro: {
        sales: Deno.env.get('BRANDARO_SALES_AGENT_ID') || '',
        closer: Deno.env.get('BRANDARO_CLOSER_AGENT_ID') || '',
        relationship: Deno.env.get('BRANDARO_REL_AGENT_ID') || '',
        sales_es: Deno.env.get('BRANDARO_ES_CLOSER_ID') || '',
        relationship_es: Deno.env.get('BRANDARO_ES_REL_ID') || '',
        default: Deno.env.get('BRANDARO_SALES_AGENT_ID') || ''
      },
      playboxxx: {
        manager: Deno.env.get('PLAYBOXXX_MANAGER_ID') || '',
        affiliate: Deno.env.get('PLAYBOXXX_AFFILIATE_ID') || '',
        production: Deno.env.get('PLAYBOXXX_PRODUCTION_ID') || '',
        default: Deno.env.get('PLAYBOXXX_MANAGER_ID') || ''
      },
      iclean: {
        booking: Deno.env.get('ICLEAN_BOOKING_AGENT_ID') || '',
        default: Deno.env.get('ICLEAN_BOOKING_AGENT_ID') || ''
      },
      gasmask: {
        sales: Deno.env.get('DC_SALES_AGENT_ID') || '',
        followup: Deno.env.get('DC_FOLLOWUP_AGENT_ID') || '',
        reactivation: Deno.env.get('DC_REACTIVATION_AGENT_ID') || '',
        default: Deno.env.get('DC_SALES_AGENT_ID') || ''
      }
    }

    const phoneMap: Record<string, string> = {
      unforgettable_times: Deno.env.get('UT_PHONE_NUMBER') || '+18484004179',
      real_estate: Deno.env.get('RE_PHONE_NUMBER') || '+18484004179',
      surplus_funds: Deno.env.get('SF_PHONE_NUMBER') || '+18484004179',
      top_tier: Deno.env.get('TT_PHONE_NUMBER') || '+18484004179',
      brandaro: Deno.env.get('BRANDARO_PHONE_NUMBER') || '+18484004179',
      playboxxx: Deno.env.get('PLAYBOXXX_PHONE_NUMBER') || '+18484004179',
      iclean: Deno.env.get('ICLEAN_PHONE_NUMBER') || '+18484004179',
      gasmask: Deno.env.get('GASMASK_PHONE_NUMBER') || '+18484004179'
    }

    const biz = business || 'gasmask'
    const businessAgents = agentRouting[biz] || agentRouting.gasmask
    const agentId = agent_id_override || businessAgents[agent_type] || businessAgents.default
    const defaultFrom = phoneMap[biz] || '+18484004179'

    const fromNumber = biz === 'brandaro'
      ? getLocalNumber(to_number, defaultFrom)
      : defaultFrom

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}">
      <Parameter name="xi-api-key" value="${ELEVENLABS_KEY}"/>
      <Parameter name="caller_name" value="${lead_name || 'there'}"/>
      <Parameter name="lead_id" value="${lead_id || ''}"/>
    </Stream>
  </Connect>
</Response>`

    const form = new URLSearchParams({
      To: to_number,
      From: fromNumber,
      Twiml: twiml,
      StatusCallback: `${SUPABASE_URL}/functions/v1/dc-call-status`,
      StatusCallbackMethod: 'POST',
      StatusCallbackEvent: 'initiated ringing answered completed',
      MachineDetection: 'DetectMessageEnd',
      AsyncAmdStatusCallback: `${SUPABASE_URL}/functions/v1/dc-amd-callback`,
      AsyncAmdStatusCallbackMethod: 'POST',
      Record: 'true',
      RecordingStatusCallback: `${SUPABASE_URL}/functions/v1/twilio-recording-callback`,
      RecordingStatusCallbackMethod: 'POST'
    })

    const callResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: form
      }
    )

    const callData = await callResp.json()

    if (!callResp.ok) {
      console.error('Twilio call failed:', callData)
      return new Response(JSON.stringify({ success: false, error: 'Call failed', details: callData }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    await fetch(`${SUPABASE_URL}/rest/v1/dc_call_logs`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        call_sid: callData.sid,
        to_number,
        from_number: fromNumber,
        lead_name: lead_name || null,
        lead_id: lead_id || null,
        campaign_id: campaign_id || null,
        direction: 'outbound',
        agent_id: agentId,
        business: biz,
        status: callData.status || 'initiated'
      })
    })

    return new Response(JSON.stringify({
      success: true,
      call_sid: callData.sid,
      status: callData.status,
      agent_id: agentId,
      from: fromNumber
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('dc-outbound-call error:', err)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
