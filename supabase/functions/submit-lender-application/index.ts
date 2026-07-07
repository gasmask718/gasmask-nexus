import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface Payload {
  client_id: string;
  lender_match_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const payload = (await req.json().catch(() => ({}))) as Partial<Payload>;
    const { client_id, lender_match_id } = payload;

    if (!client_id || !lender_match_id) {
      return json({ error: 'client_id and lender_match_id are required' }, 400);
    }

    const { data: match, error: matchErr } = await supabase
      .from('funding_client_lender_matches')
      .select(`
        *,
        funding_lender_database:lender_id (
          lender_name, product_name, prequal_url,
          has_soft_pull_prequal, category, max_amount
        ),
        funding_clients:client_id (
          full_name, credit_score_estimate, monthly_revenue
        )
      `)
      .eq('id', lender_match_id)
      .maybeSingle();

    if (matchErr || !match) {
      return json({ error: `Match not found: ${matchErr?.message ?? 'no row'}` }, 400);
    }

    const lender = (match as any).funding_lender_database ?? {};
    const lender_name = lender.lender_name ?? 'Unknown lender';
    const product_name = lender.product_name ?? '';
    const prequal_url = lender.prequal_url ?? '';
    const max_amount = lender.max_amount ?? 0;
    const match_score = (match as any).match_score ?? '—';

    if (lender.has_soft_pull_prequal === false) {
      return json({
        error: 'Lender requires hard pull. Manual application required.',
        prequal_url,
        lender_name,
      });
    }

    const today = new Date();
    const dueDate = new Date(today.getTime() + 3 * 86400_000)
      .toISOString()
      .slice(0, 10);

    const { error: remErr } = await supabase.from('client_reminders').insert({
      client_id,
      title: `Complete prequal — ${lender_name}`,
      reminder_type: 'application_deadline',
      due_date: dueDate,
      priority: 'high',
      description:
        `Product: ${product_name}\n` +
        `URL: ${prequal_url}\n` +
        `Max: $${max_amount}`,
    });
    if (remErr) {
      return json({ error: `Failed to create reminder: ${remErr.message}` });
    }

    const { error: updErr } = await supabase
      .from('funding_client_lender_matches')
      .update({ status: 'applied', applied_at: new Date().toISOString() })
      .eq('id', lender_match_id);
    if (updErr) {
      return json({ error: `Failed to update match: ${updErr.message}` });
    }

    const { error: noteErr } = await supabase.from('client_notes').insert({
      client_id,
      note_type: 'funding',
      title: `Application initiated — ${lender_name}`,
      content:
        `Product: ${product_name}\n` +
        `URL: ${prequal_url}\n` +
        `Match score: ${match_score}\n` +
        `Max amount: $${max_amount}\n` +
        `Status: Applied`,
      is_pinned: false,
      created_by: 'Auto-Submit',
    });
    if (noteErr) {
      return json({ error: `Failed to create note: ${noteErr.message}` });
    }

    return json({
      client_id,
      lender_name,
      product_name,
      status: 'task_created',
      prequal_url,
      reminder_created: true,
      due_date: dueDate,
    });
  } catch (err) {
    console.error('submit-lender-application error:', err);
    return json({ error: (err as Error).message });
  }
});
