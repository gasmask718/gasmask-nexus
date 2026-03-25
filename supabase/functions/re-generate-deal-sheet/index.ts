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
    const { deal_id } = await req.json();
    if (!deal_id) throw new Error('deal_id required');

    const { data: deal, error } = await supabase.from('re_deals')
      .select('*').eq('id', deal_id).single();
    if (error || !deal) throw new Error('Deal not found');

    // Get lead data for extra details
    let lead = null;
    if (deal.lead_id) {
      const { data } = await supabase.from('re_leads')
        .select('*').eq('id', deal.lead_id).single();
      lead = data;
    }

    const spread = (deal.arv || 0) - (deal.purchase_price || 0) - (deal.estimated_repairs || 0);
    const spreadPercent = deal.arv ? ((spread / deal.arv) * 100).toFixed(1) : '0';

    // Generate HTML deal sheet
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Deal Sheet - ${deal.property_address}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
  .header { background: #3B6D11; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
  .header h1 { margin: 0; font-size: 24px; }
  .header p { margin: 5px 0 0; opacity: 0.9; }
  .section { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
  .section h2 { color: #3B6D11; margin-top: 0; font-size: 18px; border-bottom: 2px solid #3B6D11; padding-bottom: 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .field { }
  .field label { font-size: 12px; color: #666; text-transform: uppercase; }
  .field .value { font-size: 16px; font-weight: bold; }
  .highlight { background: #f0f7e6; padding: 16px; border-radius: 8px; border-left: 4px solid #3B6D11; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #f5f5f5; font-size: 12px; text-transform: uppercase; }
  .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 14px; }
  .badge-a { background: #dcfce7; color: #166534; }
  .badge-b { background: #fef3c7; color: #92400e; }
  .badge-c { background: #fee2e2; color: #991b1b; }
</style>
</head>
<body>
  <div class="header">
    <h1>OFF-MARKET INVESTMENT OPPORTUNITY</h1>
    <p>Dynasty Property Group LLC | Confidential Deal Sheet</p>
  </div>

  <div class="section">
    <h2>Property Overview</h2>
    <div class="grid">
      <div class="field"><label>Address</label><div class="value">${deal.property_address}</div></div>
      <div class="field"><label>City / State / Zip</label><div class="value">${deal.city || ''}, ${deal.state || ''} ${deal.zip || ''}</div></div>
      <div class="field"><label>Property Type</label><div class="value">${deal.property_type || 'SFR'}</div></div>
      <div class="field"><label>Bedrooms / Bathrooms</label><div class="value">${lead?.bedrooms || 'N/A'} BR / ${lead?.bathrooms || 'N/A'} BA</div></div>
      <div class="field"><label>Sq Ft</label><div class="value">${lead?.sqft ? lead.sqft.toLocaleString() : 'N/A'}</div></div>
      <div class="field"><label>Year Built</label><div class="value">${lead?.year_built || 'N/A'}</div></div>
      <div class="field"><label>Condition</label><div class="value">${lead?.condition || 'As-Is'}</div></div>
      <div class="field"><label>Deal Score</label><div class="value"><span class="badge badge-${(deal.deal_score || 'c').toLowerCase()}">${deal.deal_score || 'C'}</span></div></div>
    </div>
  </div>

  <div class="section highlight">
    <h2>The Numbers</h2>
    <div class="grid">
      <div class="field"><label>After Repair Value (ARV)</label><div class="value">$${(deal.arv || 0).toLocaleString()}</div></div>
      <div class="field"><label>Purchase Price</label><div class="value">$${(deal.purchase_price || 0).toLocaleString()}</div></div>
      <div class="field"><label>Estimated Repairs</label><div class="value">$${(deal.estimated_repairs || 0).toLocaleString()}</div></div>
      <div class="field"><label>Assignment Fee</label><div class="value">$${(deal.assignment_fee_target || 0).toLocaleString()}</div></div>
      <div class="field"><label>Total Investment</label><div class="value">$${((deal.purchase_price || 0) + (deal.estimated_repairs || 0) + (deal.assignment_fee_target || 0)).toLocaleString()}</div></div>
      <div class="field"><label>Spread</label><div class="value">${spreadPercent}%</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Terms</h2>
    <div class="grid">
      <div class="field"><label>Contract Date</label><div class="value">${deal.contract_date || 'TBD'}</div></div>
      <div class="field"><label>Close Date</label><div class="value">${deal.close_date_target || 'TBD'}</div></div>
      <div class="field"><label>Earnest Money</label><div class="value">$${(deal.earnest_money || 500).toLocaleString()}</div></div>
      <div class="field"><label>Title Company</label><div class="value">${deal.title_company || 'TBD'}</div></div>
      <div class="field"><label>Sale Type</label><div class="value">As-Is, Cash, Assignment Allowed</div></div>
    </div>
  </div>

  ${deal.comps && Array.isArray(deal.comps) && deal.comps.length > 0 ? `
  <div class="section">
    <h2>Comparable Sales</h2>
    <table>
      <tr><th>Address</th><th>Sale Price</th><th>Sq Ft</th><th>Beds/Baths</th><th>Sale Date</th></tr>
      ${deal.comps.map((c: any) => `
        <tr><td>${c.address || 'N/A'}</td><td>$${(c.price || 0).toLocaleString()}</td><td>${c.sqft || 'N/A'}</td><td>${c.beds || ''}/${c.baths || ''}</td><td>${c.date || 'N/A'}</td></tr>
      `).join('')}
    </table>
  </div>` : ''}

  <div class="footer">
    <p>Dynasty Property Group LLC | Confidential — For intended recipient only</p>
    <p>Contact: deals@dynastypropertygroup.com</p>
  </div>
</body>
</html>`;

    // Store as HTML file in Supabase Storage
    const fileName = `deal-sheet-${deal_id}.html`;
    const { error: uploadError } = await supabase.storage
      .from('re-deal-sheets')
      .upload(fileName, html, {
        contentType: 'text/html',
        upsert: true,
      });

    // If bucket doesn't exist, create it
    if (uploadError?.message?.includes('not found') || uploadError?.message?.includes('Bucket')) {
      await supabase.storage.createBucket('re-deal-sheets', { public: true });
      await supabase.storage.from('re-deal-sheets').upload(fileName, html, {
        contentType: 'text/html', upsert: true,
      });
    }

    const { data: urlData } = supabase.storage.from('re-deal-sheets').getPublicUrl(fileName);
    const dealSheetUrl = urlData?.publicUrl;

    // Update deal with URL
    await supabase.from('re_deals').update({
      deal_sheet_url: dealSheetUrl,
    }).eq('id', deal_id);

    return new Response(JSON.stringify({
      success: true, deal_sheet_url: dealSheetUrl,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Deal sheet error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
