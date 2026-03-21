import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { asset_type, store_id, lead_id, brand, product_name, custom_data } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const CANVA_TOKEN = Deno.env.get('CANVA_BOT_USER_TOKEN');
    if (!CANVA_TOKEN) {
      return new Response(JSON.stringify({ success: false, error: 'CANVA_BOT_USER_TOKEN not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build context from store/lead data
    let context: Record<string, string> = { ...(custom_data || {}) };

    if (store_id) {
      const { data: store } = await supabase
        .from('store_master')
        .select('store_name, phone, city, state, address')
        .eq('id', store_id)
        .single();
      if (store) Object.assign(context, store);
    }

    if (lead_id) {
      const { data: lead } = await supabase
        .from('outreach_leads')
        .select('store_name, contact_name, phone, city, state')
        .eq('id', lead_id)
        .single();
      if (lead) Object.assign(context, lead);
    }

    // Find matching Canva template
    let query = supabase
      .from('canva_templates')
      .select('*')
      .eq('asset_type', asset_type)
      .eq('is_active', true);

    if (brand) query = query.eq('brand', brand);

    const { data: template } = await query.maybeSingle();

    // Create asset record
    const { data: assetRecord } = await supabase
      .from('generated_assets')
      .insert({
        store_id: store_id || null,
        lead_id: lead_id || null,
        asset_type,
        brand: brand || null,
        product_name: product_name || null,
        status: template?.canva_template_id ? 'generating' : 'failed',
        metadata: {
          ...context,
          ...(template ? {} : { error: 'No Canva template configured for this asset type' }),
        },
      })
      .select()
      .single();

    if (!template?.canva_template_id) {
      return new Response(JSON.stringify({
        success: false,
        error: `No Canva template found for ${asset_type}${brand ? ` / ${brand}` : ''}. Add one in the Canva Templates section.`,
        asset_id: assetRecord?.id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build autofill data from template placeholder fields
    const autofillData: Record<string, any> = {};
    const fields = (template.placeholder_fields as any[]) || [];

    const valueMap: Record<string, string> = {
      store_name: context.store_name || context.name || 'Your Store',
      phone: context.phone || '',
      city: context.city || '',
      state: context.state || '',
      address: context.address || '',
      contact_name: context.contact_name || '',
      product_name: product_name || '',
      brand: brand || '',
      price: context.price || '',
      date: new Date().toLocaleDateString(),
      tagline: getTagline(brand || ''),
      website: 'dynastyos.com',
    };

    for (const field of fields) {
      const name = (field as any).name;
      autofillData[name] = { type: 'text', text: valueMap[name] || '' };
    }

    // Call Canva Autofill API
    const autofillResponse = await fetch('https://api.canva.com/rest/v1/autofills', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CANVA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_template_id: template.canva_template_id,
        title: `${context.store_name || 'Store'} — ${asset_type} — ${new Date().toLocaleDateString()}`,
        data: autofillData,
      }),
    });

    if (!autofillResponse.ok) {
      const errText = await autofillResponse.text();
      console.error('Canva autofill error:', autofillResponse.status, errText);
      await supabase.from('generated_assets')
        .update({ status: 'failed', metadata: { ...context, canva_error: errText } })
        .eq('id', assetRecord!.id);

      return new Response(JSON.stringify({
        success: false,
        error: `Canva API error: ${autofillResponse.status}`,
        asset_id: assetRecord?.id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const autofillResult = await autofillResponse.json();
    const jobId = autofillResult.job?.id;

    // Poll for autofill completion
    let designId: string | null = null;
    let editUrl: string | null = null;

    if (jobId) {
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const statusRes = await fetch(`https://api.canva.com/rest/v1/autofills/${jobId}`, {
          headers: { 'Authorization': `Bearer ${CANVA_TOKEN}` },
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.job?.status === 'success') {
            designId = statusData.job?.result?.design?.id || null;
            editUrl = statusData.job?.result?.design?.urls?.edit_url || null;
            break;
          }
          if (statusData.job?.status === 'failed') break;
        }
      }
    }

    if (!designId) {
      await supabase.from('generated_assets').update({ status: 'failed' }).eq('id', assetRecord!.id);
      return new Response(JSON.stringify({ success: false, error: 'Canva autofill did not complete', asset_id: assetRecord?.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Export design
    let exportUrl: string | null = null;
    const exportRes = await fetch(`https://api.canva.com/rest/v1/exports`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CANVA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ design_id: designId, format: { type: 'pdf' } }),
    });

    if (exportRes.ok) {
      const exportData = await exportRes.json();
      const exportJobId = exportData.job?.id;
      if (exportJobId) {
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 3000));
          const statusRes = await fetch(`https://api.canva.com/rest/v1/exports/${exportJobId}`, {
            headers: { 'Authorization': `Bearer ${CANVA_TOKEN}` },
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.job?.status === 'success') {
              exportUrl = statusData.job?.urls?.[0] || null;
              break;
            }
            if (statusData.job?.status === 'failed') break;
          }
        }
      }
    }

    // Update asset record
    await supabase.from('generated_assets').update({
      canva_design_id: designId,
      canva_edit_url: editUrl,
      canva_export_url: exportUrl,
      status: exportUrl ? 'ready' : 'generating',
      updated_at: new Date().toISOString(),
    }).eq('id', assetRecord!.id);

    // Log to instinct log
    await supabase.from('ai_instinct_log').insert({
      action_type: 'canva_asset_generated',
      reasoning: `Generated ${asset_type} for ${context.store_name || 'store'} — brand: ${brand}`,
      input_data: { store_id, lead_id, asset_type, brand },
      decision_path: { canva_design_id: designId, status: exportUrl ? 'ready' : 'generating' },
      confidence_score: 1.0,
    });

    return new Response(JSON.stringify({
      success: true,
      asset_id: assetRecord!.id,
      canva_design_id: designId,
      canva_edit_url: editUrl,
      canva_export_url: exportUrl,
      status: exportUrl ? 'ready' : 'generating',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('Canva generation error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getTagline(brand: string): string {
  const taglines: Record<string, string> = {
    'GasMask': 'Premium Quality Every Time',
    'HotScalati': 'The Bold Choice',
    'HotMama': 'Feel the Heat',
    'Grabba R Us': 'Your Grabba Source',
    'Hot Scolatti': 'Rich & Bold Flavor',
    'HotScalati Bros': 'Bold Flavor. $1.',
  };
  return taglines[brand] || 'Dynasty Quality';
}
