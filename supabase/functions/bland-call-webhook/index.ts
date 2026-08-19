// Bland.ai webhook: writes transcript, analyzes via Anthropic Haiku.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifiedInsertSoft } from "../_shared/verifiedWrite.ts";
import { isHealthProbe, healthProbeResponse } from "../_shared/healthProbe.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Liveness probe from comms-health-monitor — answer, never persist.
    if (isHealthProbe(payload)) return healthProbeResponse("bland-call-webhook", {});
    const callId = payload.call_id || payload.c_id;
    const metaLogId = payload.metadata?.log_id;
    if (!callId && !metaLogId) return new Response('missing identifiers', { status: 400 });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Lightweight signature: bland_call_id must match an existing pending log
    let logId = metaLogId;
    if (!logId) {
      const { data: row } = await admin.from('communication_logs').select('id').eq('bland_call_id', callId).maybeSingle();
      logId = row?.id;
    }
    if (!logId) return new Response('no matching log', { status: 404 });

    const transcript = payload.concatenated_transcript || payload.transcript || (Array.isArray(payload.transcripts) ? payload.transcripts.map((t: any) => `${t.user}: ${t.text}`).join('\n') : '');
    const summary = payload.summary || null;
    const recording = payload.recording_url || null;
    const duration = Number(payload.call_length || payload.duration || 0);
    const completed = String(payload.completed || payload.status || '');

    let outcome = 'answered';
    const answeredBy = String(payload.answered_by || '');
    if (answeredBy === 'voicemail' || /voicemail/i.test(completed)) outcome = 'voicemail';
    else if (/no.?answer/i.test(completed)) outcome = 'no_answer';
    else if (/busy/i.test(completed)) outcome = 'busy';

    await admin.from('communication_logs').update({
      transcript, summary, recording_url: recording,
      duration_seconds: Math.round(duration * 60) || duration,
      ended_at: new Date().toISOString(),
      status: 'complete', outcome,
      transcript_status: transcript ? 'processing' : 'failed',
    }).eq('id', logId);

    // Sentiment + action items via Haiku
    if (transcript && ANTHROPIC_KEY) {
      try {
        const ana = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 600,
            system: 'Analyze sales call transcripts. Return ONLY raw JSON, no prose, no markdown.',
            messages: [{ role: 'user', content: `Analyze this transcript and return JSON with keys: sentiment ("positive"|"neutral"|"negative"), action_items (array of strings), order_intent (boolean), follow_up_required (boolean), follow_up_reason (string).\n\nTranscript:\n${transcript.slice(0, 8000)}` }],
          }),
        });
        const aj = await ana.json();
        const text = aj?.content?.[0]?.text || '{}';
        const cleaned = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        await admin.from('communication_logs').update({
          sentiment: parsed.sentiment || null,
          action_items: parsed.action_items || [],
          order_intent: !!parsed.order_intent,
          follow_up_required: !!parsed.follow_up_required,
          follow_up_date: parsed.follow_up_required ? new Date(Date.now() + 2 * 86400000).toISOString() : null,
          transcript_status: 'complete',
        }).eq('id', logId);

        if (parsed.order_intent) {
          const { data: row } = await admin.from('communication_logs').select('ambassador_id, store_id').eq('id', logId).maybeSingle();
          if (row) await verifiedInsertSoft(admin, 'log ambassador order intent', (c: any) => c.from('ambassador_activity_log').insert({ ambassador_id: row.ambassador_id, store_id: row.store_id, action_type: 'order_intent_detected', metadata: { log_id: logId } }));
        }
      } catch (anaErr) {
        console.error('Haiku analysis failed', anaErr);
        await admin.from('communication_logs').update({ transcript_status: 'failed' }).eq('id', logId);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('bland-webhook error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
