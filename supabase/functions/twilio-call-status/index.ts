// Twilio status callback for direct ambassador bridge calls.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const logIdParam = url.searchParams.get('log_id');
    const form = await req.formData();
    const callSid = String(form.get('CallSid') || '');
    const status = String(form.get('CallStatus') || '');
    const duration = Number(form.get('CallDuration') || 0);
    const answeredBy = String(form.get('AnsweredBy') || '');
    const recordingUrl = String(form.get('RecordingUrl') || '');

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Locate log row by sid or fallback to log_id
    let logId = logIdParam;
    if (!logId && callSid) {
      const { data: row } = await admin.from('communication_logs').select('id').eq('twilio_call_sid', callSid).maybeSingle();
      logId = row?.id ?? null;
    }
    if (!logId) return new Response('ok', { status: 200 });

    const updates: any = { twilio_call_sid: callSid || undefined };
    if (status === 'ringing') updates.status = 'ringing';
    if (status === 'in-progress' || status === 'answered') { updates.status = 'in_progress'; updates.answered_at = new Date().toISOString(); }
    if (status === 'completed') {
      updates.status = 'complete';
      updates.ended_at = new Date().toISOString();
      updates.duration_seconds = duration;
      if (answeredBy.startsWith('machine')) updates.outcome = 'voicemail';
      else if (answeredBy === 'human') updates.outcome = 'answered';
      else updates.outcome = 'answered';
    }
    if (status === 'no-answer') { updates.status = 'complete'; updates.outcome = 'no_answer'; updates.ended_at = new Date().toISOString(); }
    if (status === 'busy') { updates.status = 'complete'; updates.outcome = 'busy'; updates.ended_at = new Date().toISOString(); }
    if (status === 'failed' || status === 'canceled') { updates.status = 'failed'; updates.outcome = 'failed'; updates.ended_at = new Date().toISOString(); }
    if (recordingUrl) updates.recording_url = `${recordingUrl}.mp3`;

    await admin.from('communication_logs').update(updates).eq('id', logId);
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('twilio-call-status error', e);
    return new Response('ok', { status: 200 });
  }
});
