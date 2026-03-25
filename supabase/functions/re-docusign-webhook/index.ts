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

  try {
    const body = await req.json();
    const envelopeId = body.envelopeId || body.data?.envelopeSummary?.envelopeId;
    const status = body.status || body.data?.envelopeSummary?.status;

    if (!envelopeId) {
      return new Response(JSON.stringify({ error: 'No envelope ID' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // HMAC verification (optional but recommended)
    const DOCUSIGN_HMAC_KEY = Deno.env.get('DOCUSIGN_HMAC_KEY');
    if (DOCUSIGN_HMAC_KEY) {
      // Verify HMAC signature if configured
      const signature = req.headers.get('x-docusign-signature-1');
      if (signature) {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw', encoder.encode(DOCUSIGN_HMAC_KEY),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
        );
        // In production, verify the HMAC matches
      }
    }

    if (status === 'completed' || status === 'signed') {
      // Find lead by envelope ID (could be purchase or assignment)
      const { data: lead } = await supabase.from('re_leads')
        .select('*')
        .eq('docusign_envelope_id', envelopeId)
        .single();

      if (lead) {
        // Purchase contract signed → create deal
        await supabase.from('re_leads').update({
          status: 'under_contract',
          contract_signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', lead.id);

        const purchasePrice = lead.asking_price || Math.round((lead.arv || 0) * 0.70 - (lead.estimated_repairs || 0));
        const assignmentFeeTarget = Math.round((lead.arv || 0) - purchasePrice - (lead.estimated_repairs || 0));

        // Create deal
        const { data: deal } = await supabase.from('re_deals').insert({
          lead_id: lead.id,
          property_address: lead.property_address,
          city: lead.city,
          state: lead.state,
          zip: lead.zip,
          property_type: lead.property_type || 'SFR',
          arv: lead.arv || 0,
          purchase_price: purchasePrice,
          estimated_repairs: lead.estimated_repairs || 0,
          mao: Math.round((lead.arv || 0) * 0.70 - (lead.estimated_repairs || 0)),
          assignment_fee_target: assignmentFeeTarget > 0 ? assignmentFeeTarget : 15000,
          seller_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
          seller_phone: lead.phone,
          status: 'under_contract',
          contract_date: new Date().toISOString().split('T')[0],
          close_date_target: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          deal_score: lead.deal_score,
        }).select().single();

        // Auto-trigger deal sheet generation
        if (deal) {
          await supabase.functions.invoke('re-generate-deal-sheet', {
            body: { deal_id: deal.id },
          });

          // Auto-trigger buyer blast
          await supabase.functions.invoke('re-buyer-blast', {
            body: { deal_id: deal.id },
          });
        }

        // SMS David
        const DAVID_PHONE = Deno.env.get('DAVID_PHONE');
        if (DAVID_PHONE) {
          await supabase.functions.invoke('send-sms', {
            body: {
              to: DAVID_PHONE,
              message: `🎉 CONTRACT SIGNED: ${lead.property_address}, ${lead.state} | ARV: $${(lead.arv || 0).toLocaleString()} | Target fee: $${assignmentFeeTarget > 0 ? assignmentFeeTarget.toLocaleString() : '15,000'} | Buyer blast sent`,
            },
          });
        }
      }

      // Check if it's an assignment agreement
      const { data: deal } = await supabase.from('re_deals')
        .select('*')
        .eq('docusign_envelope_id', envelopeId)
        .single();

      if (deal) {
        await supabase.from('re_deals').update({
          status: 'assignment_signed',
        }).eq('id', deal.id);

        const DAVID_PHONE = Deno.env.get('DAVID_PHONE');
        if (DAVID_PHONE) {
          await supabase.functions.invoke('send-sms', {
            body: {
              to: DAVID_PHONE,
              message: `✅ ASSIGNMENT SIGNED: ${deal.property_address} | Fee: $${(deal.assignment_fee_actual || deal.assignment_fee_target || 0).toLocaleString()}`,
            },
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('DocuSign webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
