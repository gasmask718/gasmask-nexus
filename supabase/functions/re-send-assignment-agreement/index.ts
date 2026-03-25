import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const DOCUSIGN_ACCOUNT_ID = Deno.env.get('DOCUSIGN_ACCOUNT_ID');
  const DOCUSIGN_BASE_URL = Deno.env.get('DOCUSIGN_BASE_URL') || 'https://na4.docusign.net/restapi';
  const DOCUSIGN_SECRET_KEY = Deno.env.get('DOCUSIGN_SECRET_KEY');
  const DOCUSIGN_TEMPLATE_ASSIGNMENT_ID = Deno.env.get('DOCUSIGN_TEMPLATE_ASSIGNMENT_ID');

  if (!DOCUSIGN_ACCOUNT_ID || !DOCUSIGN_TEMPLATE_ASSIGNMENT_ID) {
    return new Response(JSON.stringify({ error: 'DocuSign assignment template not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { deal_id, buyer_id } = await req.json();
    if (!deal_id) throw new Error('deal_id required');

    const { data: deal } = await supabase.from('re_deals').select('*').eq('id', deal_id).single();
    if (!deal) throw new Error('Deal not found');

    let buyer = null;
    if (buyer_id) {
      const { data } = await supabase.from('re_buyers').select('*').eq('id', buyer_id).single();
      buyer = data;
    } else if (deal.buyer_id) {
      const { data } = await supabase.from('re_buyers').select('*').eq('id', deal.buyer_id).single();
      buyer = data;
    }

    if (!buyer) throw new Error('Buyer not found — assign buyer to deal first');

    // Get access token
    const tokenRes = await fetch(`${DOCUSIGN_BASE_URL.replace('/restapi', '')}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: DOCUSIGN_SECRET_KEY || '',
      }),
    });
    const { access_token } = await tokenRes.json();
    if (!access_token) throw new Error('Failed to get DocuSign token');

    const envelopeBody = {
      templateId: DOCUSIGN_TEMPLATE_ASSIGNMENT_ID,
      status: 'sent',
      templateRoles: [
        {
          roleName: 'Assignor',
          name: 'Dynasty Property Group LLC',
          email: Deno.env.get('DYNASTY_RE_EMAIL') || 'deals@dynastypropertygroup.com',
          tabs: {
            textTabs: [
              { tabLabel: 'Assignor', value: 'Dynasty Property Group LLC' },
              { tabLabel: 'AssignorAddress', value: '' },
              { tabLabel: 'PropertyAddress', value: deal.property_address },
              { tabLabel: 'OriginalContractDate', value: deal.contract_date || '' },
              { tabLabel: 'OriginalPurchasePrice', value: String(deal.purchase_price || 0) },
              { tabLabel: 'AssignmentFee', value: String(deal.assignment_fee_target || deal.assignment_fee_actual || 0) },
              { tabLabel: 'CloseDate', value: deal.close_date_target || '' },
              { tabLabel: 'EarnestMoneyCredit', value: String(deal.earnest_money || 0) },
            ],
          },
        },
        {
          roleName: 'Assignee',
          name: buyer.name || deal.buyer_name,
          email: buyer.email || deal.buyer_email,
          tabs: {
            textTabs: [
              { tabLabel: 'Assignee', value: buyer.name || deal.buyer_name || '' },
              { tabLabel: 'AssigneeAddress', value: '' },
            ],
          },
        },
      ],
    };

    const envRes = await fetch(
      `${DOCUSIGN_BASE_URL}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(envelopeBody),
      }
    );

    const envData = await envRes.json();
    if (!envRes.ok) throw new Error(`DocuSign: ${JSON.stringify(envData)}`);

    await supabase.from('re_deals').update({
      docusign_envelope_id: envData.envelopeId,
      buyer_id: buyer.id,
      buyer_name: buyer.name,
      buyer_email: buyer.email,
      assignment_fee_actual: deal.assignment_fee_target,
    }).eq('id', deal_id);

    const DAVID_PHONE = Deno.env.get('DAVID_PHONE');
    if (DAVID_PHONE) {
      await supabase.functions.invoke('send-sms', {
        body: {
          to: DAVID_PHONE,
          message: `📋 Assignment agreement sent: ${deal.property_address} → ${buyer.name} | Fee: $${(deal.assignment_fee_target || 0).toLocaleString()}`,
        },
      });
    }

    return new Response(JSON.stringify({
      success: true, envelope_id: envData.envelopeId,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Assignment agreement error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
