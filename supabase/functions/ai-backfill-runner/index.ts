import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');

  try {
    const body = await req.json().catch(() => ({}));
    const action: string = body.action || 'scan';
    const jobType: 'notes' | 'invoices' = body.job_type || 'notes';

    // SCAN: counts only, no writes
    if (action === 'scan') {
      const { count: notesNeeded } = await supabase
        .from('store_master')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .or('notes.is.null,notes.eq.');
      const { data: deliveredOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('status', 'delivered')
        .limit(1000);
      const orderIds = (deliveredOrders || []).map((o: any) => o.id);
      let invoicesNeeded = 0;
      if (orderIds.length > 0) {
        const { data: existing } = await supabase
          .from('invoices').select('order_id').in('order_id', orderIds);
        const covered = new Set((existing || []).map((i: any) => i.order_id));
        invoicesNeeded = orderIds.filter(id => !covered.has(id)).length;
      }
      return new Response(JSON.stringify({ notes_needed: notesNeeded || 0, invoices_needed: invoicesNeeded }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // RUN: process a batch (capped)
    const { data: job } = await supabase
      .from('ai_backfill_jobs').select('*').eq('job_type', jobType).limit(1).single();
    if (!job) return new Response(JSON.stringify({ error: 'job not found' }), { status: 404, headers: corsHeaders });
    if (job.status === 'paused') {
      return new Response(JSON.stringify({ skipped: true, reason: 'paused' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cap = Math.min(job.per_run_cap || 50, body.cap || 50);
    await supabase.from('ai_backfill_jobs').update({ status: 'running', last_run_at: new Date().toISOString() }).eq('id', job.id);

    let scanned = 0, generated = 0, failed = 0;

    if (jobType === 'notes') {
      const { data: stores } = await supabase
        .from('store_master')
        .select('id, store_name, notes')
        .eq('is_active', true)
        .or('notes.is.null,notes.eq.')
        .limit(cap);
      for (const s of stores || []) {
        scanned++;
        try {
          // Gather context
          const { data: comms } = await supabase
            .from('communication_logs')
            .select('direction, content, created_at')
            .eq('store_id', s.id).order('created_at', { ascending: false }).limit(10);
          const { data: orders } = await supabase
            .from('orders').select('id, total, status, created_at')
            .eq('store_id', s.id).order('created_at', { ascending: false }).limit(5);
          const context = `Store: ${s.store_name}\nRecent comms:\n${JSON.stringify(comms || [])}\nRecent orders:\n${JSON.stringify(orders || [])}`;

          let summary = `[AI] Store has ${comms?.length || 0} recent communications and ${orders?.length || 0} recent orders.`;
          if (lovableKey) {
            const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lovableKey}` },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash-lite',
                messages: [
                  { role: 'system', content: 'Summarize this store relationship in 3 short sentences. Be factual.' },
                  { role: 'user', content: context },
                ],
              }),
            });
            const j = await r.json();
            summary = j.choices?.[0]?.message?.content?.trim() || summary;
          }

          // Append-only: never overwrite existing notes
          const tagged = `\n\n--- AI Generated (${new Date().toISOString().slice(0, 10)}) ---\n${summary}`;
          const newNotes = (s.notes && s.notes.trim()) ? `${s.notes}${tagged}` : tagged.trim();
          await supabase.from('store_master').update({ notes: newNotes, ai_generated: true }).eq('id', s.id);

          await supabase.from('ai_backfill_items').insert({
            job_id: job.id, entity_type: 'store_note', entity_id: s.id,
            status: 'generated', output: { summary },
          });
          generated++;
        } catch (e: any) {
          failed++;
          await supabase.from('ai_backfill_items').insert({
            job_id: job.id, entity_type: 'store_note', entity_id: s.id,
            status: 'failed', error: String(e?.message || e),
          });
        }
      }
    }

    if (jobType === 'invoices') {
      const { data: deliveredOrders } = await supabase
        .from('orders').select('id, store_id, total, total_amount').eq('status', 'delivered').limit(500);
      const orderIds = (deliveredOrders || []).map((o: any) => o.id);
      const { data: existing } = await supabase.from('invoices').select('order_id').in('order_id', orderIds);
      const covered = new Set((existing || []).map((i: any) => i.order_id));
      const missing = (deliveredOrders || []).filter((o: any) => !covered.has(o.id)).slice(0, cap);

      for (const o of missing) {
        scanned++;
        try {
          const total = o.total ?? o.total_amount ?? 0;
          const { data: inv, error } = await supabase.from('invoices').insert({
            order_id: o.id, store_id: o.store_id,
            total, total_amount: total, subtotal: total,
            status: 'draft_ai',
            ai_generated: true,
          }).select('id').single();
          if (error) throw error;
          await supabase.from('ai_backfill_items').insert({
            job_id: job.id, entity_type: 'invoice', entity_id: inv.id,
            status: 'generated', output: { order_id: o.id, total },
          });
          generated++;
        } catch (e: any) {
          failed++;
          await supabase.from('ai_backfill_items').insert({
            job_id: job.id, entity_type: 'invoice', entity_id: o.id,
            status: 'failed', error: String(e?.message || e),
          });
        }
      }
    }

    await supabase.from('ai_backfill_jobs').update({
      status: 'pending',
      scanned_count: (job.scanned_count || 0) + scanned,
      generated_count: (job.generated_count || 0) + generated,
      failed_count: (job.failed_count || 0) + failed,
      last_run_at: new Date().toISOString(),
    }).eq('id', job.id);

    return new Response(JSON.stringify({ scanned, generated, failed, job_id: job.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
