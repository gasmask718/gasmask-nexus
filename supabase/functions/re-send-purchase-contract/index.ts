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

  const DOCUSIGN_INTEGRATION_KEY = Deno.env.get('DOCUSIGN_INTEGRATION_KEY');
  const DOCUSIGN_SECRET_KEY = Deno.env.get('DOCUSIGN_SECRET_KEY');
  const DOCUSIGN_ACCOUNT_ID = Deno.env.get('DOCUSIGN_ACCOUNT_ID');
  const DOCUSIGN_BASE_URL = Deno.env.get('DOCUSIGN_BASE_URL') || 'https://na4.docusign.net/restapi';
  const DOCUSIGN_TEMPLATE_PURCHASE_ID = Deno.env.get('DOCUSIGN_TEMPLATE_PURCHASE_ID');

  if (!DOCUSIGN_INTEGRATION_KEY || !DOCUSIGN_ACCOUNT_ID || !DOCUSIGN_TEMPLATE_PURCHASE_ID) {
    return new Response(JSON.stringify({ error: 'DocuSign not configured. Add DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_TEMPLATE_PURCHASE_ID secrets.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { lead_id } = await req.json();
    if (!lead_id) throw new Error('lead_id required');

    const { data: lead, error } = await supabase.from('re_leads')
      .select('*').eq('id', lead_id).single();
    if (error || !lead) throw new Error('Lead not found');

    const closeDate = new Date();
    closeDate.setDate(closeDate.getDate() + 30);

    // Get DocuSign access token via JWT grant
    const tokenRes = await fetch(`${DOCUSIGN_BASE_URL.replace('/restapi', '')}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: DOCUSIGN_SECRET_KEY || '',
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) throw new Error('Failed to get DocuSign access token');

    // Create envelope from template
    const envelopeBody = {
      templateId: DOCUSIGN_TEMPLATE_PURCHASE_ID,
      status: 'sent',
      templateRoles: [{
        roleName: 'Seller',
        name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Property Owner',
        email: lead.email || undefined,
        tabs: {
          textTabs: [
            { tabLabel: 'SellerName', value: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() },
            { tabLabel: 'PropertyAddress', value: lead.property_address },
            { tabLabel: 'City', value: lead.city || '' },
            { tabLabel: 'State', value: lead.state || '' },
            { tabLabel: 'Zip', value: lead.zip || '' },
            { tabLabel: 'PurchasePrice', value: String(lead.asking_price || lead.arv ? Math.round((lead.arv || 0) * 0.70 - (lead.estimated_repairs || 0)) : 0) },
            { tabLabel: 'EarnestMoney', value: '500' },
            { tabLabel: 'CloseDate', value: closeDate.toISOString().split('T')[0] },
            { tabLabel: 'InspectionPeriod', value: '10' },
            { tabLabel: 'BuyerName', value: 'Dynasty Property Group LLC' },
          ],
        },
        smsAuthentication: lead.phone ? { senderProvidedNumbers: [lead.phone] } : undefined,
      }],
    };

    const envRes = await fetch(
      `${DOCUSIGN_BASE_URL}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(envelopeBody),
      }
    );

    const envData = await envRes.json();
    if (!envRes.ok) throw new Error(`DocuSign error: ${JSON.stringify(envData)}`);

    // Update lead
    await supabase.from('re_leads').update({
      status: 'offer_made',
      docusign_envelope_id: envData.envelopeId,
      contract_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', lead_id);

    // SMS seller
    if (lead.phone) {
      await supabase.functions.invoke('send-sms', {
        body: {
          to: lead.phone,
          message: `Your purchase agreement for ${lead.property_address} is ready to sign — check your email or text message. - Dynasty Property Group`,
        },
      });
    }

    // SMS David
    const DAVID_PHONE = Deno.env.get('DAVID_PHONE');
    if (DAVID_PHONE) {
      await supabase.functions.invoke('send-sms', {
        body: {
          to: DAVID_PHONE,
          message: `📄 Contract sent: ${lead.property_address}, ${lead.state} | Seller: ${lead.first_name} ${lead.last_name} | Envelope: ${envData.envelopeId}`,
        },
      });
    }

    return new Response(JSON.stringify({
      success: true, envelope_id: envData.envelopeId,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('DocuSign error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
