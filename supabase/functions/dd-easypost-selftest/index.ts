// dd-easypost-selftest — throwaway diagnostic: proves the EasyPost key
// resolves and authenticates by requesting a rate for a real dd_box_sizes box.
// Never buys a label. Never returns the key.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getEasyPostKey } from '../_shared/ddShipping.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const key = await getEasyPostKey(supabase);
    if (!key) return json({ ok: false, key_resolved: false, reason: 'no easypost key in dd_ai_config or env' });

    const { data: box } = await supabase
      .from('dd_box_sizes')
      .select('box_name,length_in,width_in,height_in')
      .eq('is_active', true)
      .order('sort_order')
      .limit(1)
      .maybeSingle();
    if (!box) return json({ ok: false, reason: 'no active box in dd_box_sizes' });

    const body = {
      shipment: {
        to_address: { street1: '417 Montgomery St', city: 'San Francisco', state: 'CA', zip: '94104', country: 'US' },
        from_address: { street1: '179 N Harbor Dr', city: 'Redondo Beach', state: 'CA', zip: '90277', country: 'US' },
        parcel: {
          length: Number(box.length_in), width: Number(box.width_in), height: Number(box.height_in), weight: 16,
        },
      },
    };
    const res = await fetch('https://api.easypost.com/v2/shipments', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(key + ':'), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(txt); } catch { /* raw */ }

    return json({
      ok: res.ok,
      key_resolved: true,
      key_mode: key.startsWith('EZTK') ? 'test' : key.startsWith('EZAK') ? 'production' : 'unknown',
      key_prefix: key.slice(0, 4),
      http_status: res.status,
      box: box.box_name,
      rates: (parsed?.rates ?? []).map((r: any) => ({ carrier: r.carrier, service: r.service, rate: r.rate })),
      error: parsed?.error ?? (res.ok ? null : txt.slice(0, 400)),
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
