/**
 * dd-bulk-generate-descriptions
 *
 * Batch regenerator for products_all AI copy. Invokes dd-generate-description
 * per product with concurrency, so a browser tab cannot stall the job.
 *
 * Body:
 *   {
 *     product_ids?: uuid[],       // explicit list
 *     filter?: 'missing' | 'all', // when product_ids omitted (default 'missing')
 *     limit?: number,             // safety cap (default 200, max 1000)
 *     concurrency?: number,       // default 4, max 8
 *   }
 *
 * Always returns HTTP 200 with:
 *   { processed, succeeded, failed, errors: [{ product_id, error }] }
 */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      product_ids,
      filter = 'missing',
      limit: rawLimit = 200,
      concurrency: rawConc = 4,
    } = body ?? {};

    const limit = Math.min(Math.max(1, Number(rawLimit) || 200), 1000);
    const concurrency = Math.min(Math.max(1, Number(rawConc) || 4), 8);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let ids: string[] = Array.isArray(product_ids) ? product_ids.filter(Boolean) : [];
    if (ids.length === 0) {
      let q = supabase.from('products_all').select('id').neq('status', 'deleted').limit(limit);
      if (filter === 'missing') q = q.is('description_generated_at', null);
      const { data, error } = await q;
      if (error) return ok({ error: error.message, processed: 0, succeeded: 0, failed: 0, errors: [] });
      ids = (data ?? []).map((r: { id: string }) => r.id);
    } else {
      ids = ids.slice(0, limit);
    }

    const errors: Array<{ product_id: string; error: string }> = [];
    let succeeded = 0;
    let failed = 0;

    const runOne = async (product_id: string) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/dd-generate-description`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ product_id, persist: true }),
        });
        const json = await res.json().catch(() => ({}));
        if (json?.error) {
          failed++;
          errors.push({ product_id, error: String(json.error) });
        } else {
          succeeded++;
        }
      } catch (e) {
        failed++;
        errors.push({ product_id, error: (e as Error).message ?? 'invoke_failed' });
      }
    };

    // Simple concurrency pool
    let cursor = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (cursor < ids.length) {
        const i = cursor++;
        await runOne(ids[i]);
      }
    });
    await Promise.all(workers);

    return ok({ processed: ids.length, succeeded, failed, errors });
  } catch (e) {
    return ok({ error: (e as Error).message ?? 'unknown_error', processed: 0, succeeded: 0, failed: 0, errors: [] });
  }
});
