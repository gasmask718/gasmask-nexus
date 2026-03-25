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

  const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
  const DYNASTY_RE_EMAIL = Deno.env.get('DYNASTY_RE_EMAIL') || 'deals@dynastypropertygroup.com';

  try {
    const { deal_id } = await req.json();
    if (!deal_id) throw new Error('deal_id required');

    const { data: deal, error } = await supabase.from('re_deals')
      .select('*').eq('id', deal_id).single();
    if (error || !deal) throw new Error('Deal not found');

    // Get lead for extra property details
    let lead = null;
    if (deal.lead_id) {
      const { data } = await supabase.from('re_leads').select('*').eq('id', deal.lead_id).single();
      lead = data;
    }

    // Find matching buyers: state matches AND price within buy box
    const { data: allBuyers } = await supabase.from('re_buyers')
      .select('*').eq('status', 'active');

    const matchingBuyers = (allBuyers || []).filter(b => {
      const stateMatch = b.states && b.states.includes(deal.state);
      const priceMatch = (!b.buy_box_min || deal.purchase_price >= b.buy_box_min) &&
                         (!b.buy_box_max || deal.purchase_price <= b.buy_box_max);
      return stateMatch && priceMatch;
    });

    if (matchingBuyers.length === 0) {
      return new Response(JSON.stringify({ success: true, buyers_contacted: 0, message: 'No matching buyers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let emailsSent = 0;
    let smsSent = 0;

    const subject = `OFF-MARKET ${deal.state} Deal — ${lead?.bedrooms || ''}BR/${lead?.bathrooms || ''}BA ${deal.city || ''} — ARV $${(deal.arv || 0).toLocaleString()} | Ask $${(deal.purchase_price || 0).toLocaleString()}`;

    const emailBody = `
<h2>Off-Market Investment Opportunity</h2>
<p><strong>${deal.property_address}, ${deal.city}, ${deal.state} ${deal.zip}</strong></p>
<ul>
  <li>ARV: $${(deal.arv || 0).toLocaleString()}</li>
  <li>Purchase Price: $${(deal.purchase_price || 0).toLocaleString()}</li>
  <li>Estimated Repairs: $${(deal.estimated_repairs || 0).toLocaleString()}</li>
  <li>Assignment Fee: $${(deal.assignment_fee_target || 0).toLocaleString()}</li>
  <li>Property Type: ${deal.property_type || 'SFR'}</li>
  <li>Close Date: ${deal.close_date_target || 'Flexible'}</li>
</ul>
${deal.deal_sheet_url ? `<p><a href="${deal.deal_sheet_url}">View Full Deal Sheet</a></p>` : ''}
<p>Reply to this email or call to lock in this deal.</p>
<p>— Dynasty Property Group LLC</p>`;

    for (const buyer of matchingBuyers) {
      // Email via SendGrid
      if (buyer.email && SENDGRID_API_KEY) {
        try {
          const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SENDGRID_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: buyer.email, name: buyer.name }] }],
              from: { email: DYNASTY_RE_EMAIL, name: 'Dynasty Property Group' },
              subject,
              content: [{ type: 'text/html', value: emailBody }],
            }),
          });
          if (res.ok || res.status === 202) emailsSent++;
        } catch (e) {
          console.error(`Email to ${buyer.name} failed:`, e);
        }
      }

      // Log blast
      await supabase.from('re_buyer_blast_log').insert({
        deal_id: deal.id,
        buyer_id: buyer.id,
        channel: 'email',
        status: 'sent',
      });
    }

    // SMS top 5 buyers
    const top5 = matchingBuyers.slice(0, 5).filter(b => b.phone);
    for (const buyer of top5) {
      try {
        await supabase.functions.invoke('send-sms', {
          body: {
            to: buyer.phone,
            message: `🏠 OFF-MARKET: ${deal.property_address}, ${deal.state} | ARV: $${(deal.arv || 0).toLocaleString()} | Ask: $${(deal.purchase_price || 0).toLocaleString()} | Reply YES for details — Dynasty Property Group`,
          },
        });
        smsSent++;
        await supabase.from('re_buyer_blast_log').insert({
          deal_id: deal.id, buyer_id: buyer.id, channel: 'sms', status: 'sent',
        });
      } catch (e) {
        console.error(`SMS to ${buyer.name} failed:`, e);
      }
    }

    // SMS David
    const DAVID_PHONE = Deno.env.get('DAVID_PHONE');
    if (DAVID_PHONE) {
      await supabase.functions.invoke('send-sms', {
        body: {
          to: DAVID_PHONE,
          message: `📤 Buyer blast sent for ${deal.property_address}: ${matchingBuyers.length} matching buyers, ${emailsSent} emails, ${smsSent} SMS`,
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      buyers_contacted: matchingBuyers.length,
      emails_sent: emailsSent,
      sms_sent: smsSent,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Buyer blast error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
