// Highway hub one-time / repeatable CSV import endpoint.
// Scope: writes ONLY to public.hw_leads. No other table is touched.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-import-token',
};

interface Row {
  bucket: number | null;
  business_name: string;
  license_number: string | null;
  license_type: string | null;
  license_status: string | null;
  state: string;
  city: string | null;
  address: string | null;
  already_delivers: boolean;
  phone: string | null;
  email: string | null;
  website: string | null;
  lat: number | null;
  long: number | null;
  source: string | null;
  medical_flag: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const token = req.headers.get('x-import-token');
  if (!token || token !== Deno.env.get('HW_IMPORT_TOKEN')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { rows } = (await req.json()) as { rows: Row[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'no rows' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    let inserted = 0;
    let updated = 0;
    const failed: { row: Row; error: string }[] = [];

    const withPhone = rows.filter((r) => r.phone);
    const noPhone = rows.filter((r) => !r.phone);

    // Rows WITH a phone: the unique dedupe index (state, business_name, phone) is a valid
    // upsert target, so a plain upsert is idempotent.
    if (withPhone.length) {
      const keys = withPhone.map((r) => `${r.state}|${r.business_name}|${r.phone}`);
      const { data: existing, error: exErr } = await supabase
        .from('hw_leads')
        .select('state,business_name,phone')
        .in('phone', withPhone.map((r) => r.phone!));
      if (exErr) throw exErr;
      const existingKeys = new Set(
        (existing ?? []).map((e: any) => `${e.state}|${e.business_name}|${e.phone}`),
      );
      const preExisting = keys.filter((k) => existingKeys.has(k)).length;

      const { error } = await supabase
        .from('hw_leads')
        .upsert(withPhone, { onConflict: 'state,business_name,phone' });
      if (error) {
        for (const r of withPhone) failed.push({ row: r, error: error.message });
      } else {
        updated += preExisting;
        inserted += withPhone.length - preExisting;
      }
    }

    // Rows WITHOUT a phone: the partial unique index does not cover them, so match manually.
    for (const r of noPhone) {
      const { data: found, error: findErr } = await supabase
        .from('hw_leads')
        .select('id')
        .eq('state', r.state)
        .eq('business_name', r.business_name)
        .is('phone', null)
        .maybeSingle();
      if (findErr) {
        failed.push({ row: r, error: findErr.message });
        continue;
      }
      if (found) {
        const { error } = await supabase.from('hw_leads').update(r).eq('id', found.id);
        if (error) failed.push({ row: r, error: error.message });
        else updated++;
      } else {
        const { error } = await supabase.from('hw_leads').insert(r);
        if (error) failed.push({ row: r, error: error.message });
        else inserted++;
      }
    }

    return new Response(JSON.stringify({ inserted, updated, failed_count: failed.length, failed: failed.slice(0, 20) }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
