import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { callId } = await req.json();
    if (!callId) throw new Error('callId is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const apiKey = Deno.env.get('BLAND_API_KEY');
    if (!apiKey) throw new Error('BLAND_API_KEY not configured');

    console.log('[SYNC BLAND CALL]', callId);
    const blandResponse = await fetch(`https://api.bland.ai/v1/calls/${callId}`, {
      headers: { 'Authorization': apiKey },
    });

    if (!blandResponse.ok) {
      const errText = await blandResponse.text();
      throw new Error(`Bland API error ${blandResponse.status}: ${errText}`);
    }

    const blandData = await blandResponse.json();
    console.log('[BLAND DATA RECEIVED]', { callId, hasRecording: !!blandData.recording_url, hasTranscript: !!blandData.concatenated_transcript });

    // Upsert into history
    const { data: existing } = await supabase
      .from('dynasty_call_history')
      .select('id')
      .eq('call_id', callId)
      .maybeSingle();

    const patch = {
      phone_number: blandData.to,
      from_number: blandData.from,
      status: 'completed',
      ended_at: blandData.completed_at || blandData.end_at || new Date().toISOString(),
      duration: blandData.call_length || blandData.corrected_duration,
      recording_url: blandData.recording_url,
      call_summary: blandData.concatenated_transcript || blandData.summary,
      variables: {
        analysis: blandData.analysis,
        corrected_duration: blandData.corrected_duration,
        answered_by: blandData.answered_by,
        call_ended_by: blandData.call_ended_by,
      },
    };

    if (existing) {
      await supabase.from('dynasty_call_history').update(patch).eq('call_id', callId);
    } else {
      await supabase.from('dynasty_call_history').insert({
        call_id: callId,
        started_at: blandData.created_at || new Date().toISOString(),
        ...patch,
      });
    }

    // Sync transcripts
    if (Array.isArray(blandData.transcripts)) {
      for (const t of blandData.transcripts) {
        const ts = t.created_at ? new Date(t.created_at).getTime() : Date.now();
        await supabase.from('dynasty_call_transcripts').insert({
          call_id: callId,
          timestamp: ts,
          speaker: t.user === 'user' ? 'prospect' : 'ai',
          text: t.text || '',
        }).then(() => {}, () => {});
      }
    }

    // Mirror to dynasty_ai_calls
    await supabase.from('dynasty_ai_calls').update({
      duration_seconds: blandData.call_length || blandData.corrected_duration,
      transcript: blandData.concatenated_transcript,
      recording_url: blandData.recording_url,
      outcome: 'completed',
    }).eq('call_id', callId);

    return new Response(JSON.stringify({ success: true, synced: true, data: blandData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[SYNC ERROR]', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
