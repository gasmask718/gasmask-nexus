import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const DOCUSIGN_INTEGRATION_KEY = Deno.env.get('DOCUSIGN_INTEGRATION_KEY')
  const DOCUSIGN_SECRET_KEY = Deno.env.get('DOCUSIGN_SECRET_KEY')
  const DOCUSIGN_ACCOUNT_ID = Deno.env.get('DOCUSIGN_ACCOUNT_ID')
  const DOCUSIGN_BASE_URL = Deno.env.get('DOCUSIGN_BASE_URL') || 'https://na4.docusign.net/restapi'
  const DOCUSIGN_TEMPLATE_SF_CLAIM_ID = Deno.env.get('DOCUSIGN_TEMPLATE_SF_CLAIM_ID')

  try {
    const { case_id, contract_type } = await req.json()
    if (!case_id) throw new Error('case_id required')

    const { data: sfCase, error: caseErr } = await supabase
      .from('surplus_funds_cases')
      .select('*')
      .eq('id', case_id)
      .single()
    if (caseErr || !sfCase) throw new Error('Case not found')

    if (!DOCUSIGN_INTEGRATION_KEY || !DOCUSIGN_ACCOUNT_ID || !DOCUSIGN_TEMPLATE_SF_CLAIM_ID) {
      return new Response(
        JSON.stringify({
          error:
            'DocuSign not configured. Add DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_TEMPLATE_SF_CLAIM_ID secrets.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // DocuSign JWT token
    const tokenRes = await fetch(
      `${DOCUSIGN_BASE_URL.replace('/restapi', '')}/oauth/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: DOCUSIGN_SECRET_KEY || '',
        }),
      },
    )
    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token
    if (!accessToken) throw new Error('Failed to get DocuSign access token')

    const envelopeBody = {
      templateId: DOCUSIGN_TEMPLATE_SF_CLAIM_ID,
      status: 'sent',
      templateRoles: [
        {
          roleName: 'Claimant',
          name: sfCase.client_name || 'Claimant',
          email: sfCase.client_email || undefined,
          tabs: {
            textTabs: [
              { tabLabel: 'ClaimantName', value: sfCase.client_name || '' },
              { tabLabel: 'PropertyAddress', value: sfCase.property_address || '' },
              { tabLabel: 'County', value: sfCase.county || '' },
              { tabLabel: 'State', value: sfCase.state || '' },
              { tabLabel: 'CourtCaseNumber', value: sfCase.court_case_number || '' },
              { tabLabel: 'SurplusAmount', value: String(sfCase.surplus_amount ?? '') },
              { tabLabel: 'OurPercentage', value: String(sfCase.our_percentage ?? '') },
            ],
          },
        },
      ],
    }

    const envRes = await fetch(
      `${DOCUSIGN_BASE_URL}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(envelopeBody),
      },
    )
    const envData = await envRes.json()
    if (!envRes.ok) throw new Error(`DocuSign error: ${JSON.stringify(envData)}`)

    const { data: contract, error: insErr } = await supabase
      .from('surplus_funds_contracts')
      .insert({
        case_id,
        lead_id: sfCase.lead_id,
        claimant_name: sfCase.client_name,
        claimant_email: sfCase.client_email,
        claimant_phone: sfCase.client_phone,
        state: sfCase.state,
        surplus_amount: sfCase.surplus_amount,
        our_percentage: sfCase.our_percentage,
        contract_type: contract_type || 'claim_agreement',
        status: 'sent',
        docusign_envelope_id: envData.envelopeId,
      })
      .select('id')
      .single()
    if (insErr) throw insErr

    await supabase
      .from('surplus_funds_cases')
      .update({ status: 'contract_sent', updated_at: new Date().toISOString() })
      .eq('id', case_id)

    if (sfCase.client_phone) {
      await supabase.functions.invoke('send-sms', {
        body: {
          to: sfCase.client_phone,
          message: `Your surplus funds claim agreement is ready to sign — check your email. - Dynasty Recovery`,
        },
      })
    }

    const DAVID_PHONE = Deno.env.get('DAVID_PHONE')
    if (DAVID_PHONE) {
      await supabase.functions.invoke('send-sms', {
        body: {
          to: DAVID_PHONE,
          message: `📄 SF contract sent: ${sfCase.client_name} | ${sfCase.state} | Envelope: ${envData.envelopeId}`,
        },
      })
    }

    return new Response(
      JSON.stringify({ success: true, contract_id: contract.id, envelope_id: envData.envelopeId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('sf-send-contract error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
