// UT -> Dynasty OS transaction ingest (PIPE-01)
// Auth: Authorization: Bearer ${UT_INGEST_SECRET}
// Append-only. Refunds arrive as a NEW transaction_id with transaction_type 'refund',
// a negative amount, and original_transaction_id (top level or in metadata).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { errText } from "../_shared/errText.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UT_TYPES = ['booking', 'shop_order', 'kit_order', 'refund'] as const;
type UtType = typeof UT_TYPES[number];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'method_not_allowed' }, 405);

  const expected = Deno.env.get('UT_INGEST_SECRET');
  if (!expected) return json({ success: false, error: 'ingest_not_configured' }, 503);

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== expected) return json({ success: false, error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: 'invalid_json' }, 400);
  }

  const errors: string[] = [];
  const transaction_id = typeof body.transaction_id === 'string' ? body.transaction_id.trim() : '';
  const transaction_type = String(body.transaction_type ?? '') as UtType;
  const amountRaw = body.amount;
  const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw);
  const occurredRaw = body.occurred_at ? String(body.occurred_at) : '';
  const occurred = occurredRaw ? new Date(occurredRaw) : null;

  if (!transaction_id) errors.push('transaction_id is required');
  if (!UT_TYPES.includes(transaction_type)) errors.push(`transaction_type must be one of ${UT_TYPES.join('|')}`);
  if (!Number.isFinite(amount)) errors.push('amount must be a number');
  if (transaction_type === 'refund' && Number.isFinite(amount) && amount >= 0) {
    errors.push('refund amount must be negative');
  }
  if (!occurred || isNaN(occurred.getTime())) errors.push('occurred_at must be an ISO timestamp');
  if (errors.length) return json({ success: false, error: 'validation_failed', details: errors }, 400);

  const isRefund = amount < 0;
  const bodyMeta = (typeof body.metadata === 'object' && body.metadata ? body.metadata as Record<string, unknown> : {});
  const originalId = body.original_transaction_id ?? bodyMeta.original_transaction_id;
  if (transaction_type === 'refund' && !originalId) {
    return json({
      success: false,
      error: 'validation_failed',
      details: ['refund requires original_transaction_id (top level or metadata)'],
    }, 400);
  }
  const entityId = body.entity_id == null ? null : String(body.entity_id);
  const metadata: Record<string, unknown> = {
    ...bodyMeta,
    ut_transaction_type: transaction_type,
  };
  if (originalId) metadata.original_transaction_id = String(originalId);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const row = {
    source_system: 'unforgettable_times',
    external_transaction_id: transaction_id,
    transaction_type: isRefund ? 'expense' : 'income',
    category: 'Unforgettable Times',
    subcategory: transaction_type,
    amount,
    currency: typeof body.currency === 'string' ? body.currency : 'USD',
    occurred_at: occurred!.toISOString(),
    transaction_date: occurred!.toISOString().slice(0, 10),
    description: typeof body.description === 'string' ? body.description : `UT ${transaction_type} ${transaction_id}`,
    entity_type: typeof body.entity_type === 'string' ? body.entity_type : transaction_type,
    entity_id: entityId,
    brand: 'Unforgettable Times',
    region: typeof body.region === 'string' ? body.region : null,
    customer_email: typeof body.customer_email === 'string' ? body.customer_email : null,
    line_items: body.line_items ?? null,
    metadata,
  };

  const { data, error } = await supabase
    .from('business_transactions')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    // Unique index on (source_system, external_transaction_id) => idempotent replay
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('business_transactions')
        .select('id')
        .eq('source_system', 'unforgettable_times')
        .eq('external_transaction_id', transaction_id)
        .maybeSingle();
      return json({ success: true, id: existing?.id ?? null, duplicate: true });
    }
    console.error('ut-ingest insert failed', errText(error));
    return json({ success: false, error: error.message }, 500);
  }

  return json({ success: true, id: data.id, duplicate: false });
});
