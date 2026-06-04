// Drains review_summary_jobs and invokes dd-ai-review-summary for each (debounced 2-min cron).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: jobs } = await admin
    .from('review_summary_jobs')
    .select('product_id, enqueued_at')
    .lte('enqueued_at', new Date(Date.now() - 60_000).toISOString()) // 1-min debounce
    .order('enqueued_at', { ascending: true })
    .limit(25);

  const results: any[] = [];
  for (const job of jobs ?? []) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/dd-ai-review-summary`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: job.product_id }),
      });
      results.push({ product_id: job.product_id, status: r.status });
    } catch (e) {
      results.push({ product_id: job.product_id, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ drained: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
