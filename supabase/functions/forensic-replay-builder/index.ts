import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReplayRequest {
  session_id: string;
  business_id: string;
  replayed_by?: string;
  replay_purpose?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { session_id, business_id, replayed_by, replay_purpose }: ReplayRequest = await req.json();

    // Gather all data sources for the session
    const [
      sessionResult,
      predictionsResult,
      auditEventsResult,
      decisionsResult,
      stateTransitionsResult,
      trustScoreResult
    ] = await Promise.all([
      supabase.from('ai_call_sessions').select('*').eq('id', session_id).single(),
      supabase.from('ai_call_predictions').select('*').eq('session_id', session_id).order('created_at'),
      supabase.from('ai_audit_events').select('*').eq('session_id', session_id).order('created_at'),
      supabase.from('ai_call_decisions').select('*').eq('session_id', session_id).order('created_at'),
      supabase.from('call_state_transitions').select('*').eq('session_id', session_id).order('created_at'),
      supabase.from('trust_calibration_scores').select('*').eq('business_id', business_id).order('calculated_at', { ascending: false }).limit(1)
    ]);

    const session = sessionResult.data;
    const predictions = predictionsResult.data || [];
    const auditEvents = auditEventsResult.data || [];
    const decisions = decisionsResult.data || [];
    const stateTransitions = stateTransitionsResult.data || [];
    const trustScore = trustScoreResult.data?.[0];

    if (!session) {
      throw new Error('Session not found');
    }

    // Create forensic replay session
    const { data: replaySession, error: replayError } = await supabase
      .from('forensic_replay_sessions')
      .insert({
        business_id,
        original_session_id: session_id,
        replayed_by,
        replay_purpose,
        row_hash: generateHash(session_id + new Date().toISOString())
      })
      .select()
      .single();

    if (replayError) throw replayError;

    // Build frame-by-frame reconstruction
    const allEvents = [
      ...stateTransitions.map(t => ({ ...t, type: 'state_transition', ts: new Date(t.created_at).getTime() })),
      ...predictions.map(p => ({ ...p, type: 'prediction', ts: new Date(p.created_at).getTime() })),
      ...auditEvents.map(a => ({ ...a, type: 'audit_event', ts: new Date(a.created_at).getTime() })),
      ...decisions.map(d => ({ ...d, type: 'decision', ts: new Date(d.created_at).getTime() }))
    ].sort((a, b) => a.ts - b.ts);

    const frames = [];
    const startTime = allEvents.length > 0 ? allEvents[0].ts : Date.now();

    for (let i = 0; i < allEvents.length; i++) {
      const event = allEvents[i];
      const frame = {
        replay_session_id: replaySession.id,
        original_session_id: session_id,
        frame_number: i,
        timestamp_ms: event.ts - startTime,
        call_state: determineCallState(event),
        speaker_allowed: determineSpeakerAllowed(event),
        actual_speaker: determineActualSpeaker(event),
        confidence_level: event.confidence_score || event.confidence_at_decision || null,
        trust_score: trustScore?.overall_trust_score || null,
        kill_switch_active: event.type === 'state_transition' && event.to_state === 'kill_switch_active',
        lock_applied: event.type === 'decision' && event.decision_type === 'lock_applied',
        interruption_detected: event.type === 'audit_event' && event.event_type === 'interruption',
        transcript_fragment: event.transcript_snapshot || null,
        state_metadata: {
          event_type: event.type,
          event_id: event.id,
          raw_data: event
        }
      };
      frames.push(frame);
    }

    // Batch insert frames
    if (frames.length > 0) {
      const { error: framesError } = await supabase
        .from('forensic_call_frames')
        .insert(frames);
      
      if (framesError) throw framesError;
    }

    // Build timeline summary
    const timeline = {
      total_duration_ms: frames.length > 0 ? frames[frames.length - 1].timestamp_ms : 0,
      total_frames: frames.length,
      ai_speaking_frames: frames.filter(f => f.actual_speaker === 'ai').length,
      human_speaking_frames: frames.filter(f => f.actual_speaker === 'human').length,
      blocked_frames: frames.filter(f => f.speaker_allowed === 'none').length,
      interruption_count: frames.filter(f => f.interruption_detected).length,
      kill_switch_activations: frames.filter(f => f.kill_switch_active).length,
      confidence_breaches: frames.filter(f => f.confidence_level && f.confidence_level < 60).length,
      min_confidence: Math.min(...frames.filter(f => f.confidence_level).map(f => f.confidence_level)),
      max_confidence: Math.max(...frames.filter(f => f.confidence_level).map(f => f.confidence_level)),
      state_changes: [...new Set(frames.map(f => f.call_state))].length
    };

    return new Response(
      JSON.stringify({
        success: true,
        replay_session_id: replaySession.id,
        timeline,
        frame_count: frames.length,
        data_sources: {
          predictions: predictions.length,
          audit_events: auditEvents.length,
          decisions: decisions.length,
          state_transitions: stateTransitions.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Replay builder error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function determineCallState(event: any): string {
  if (event.type === 'state_transition') {
    return event.to_state || 'unknown';
  }
  if (event.type === 'decision') {
    if (event.decision_type === 'escalate') return 'escalation_pending';
    if (event.decision_type === 'handoff') return 'human_active';
    return 'ai_speaking';
  }
  if (event.type === 'audit_event') {
    return event.event_type || 'unknown';
  }
  return 'ai_speaking';
}

function determineSpeakerAllowed(event: any): string {
  if (event.type === 'state_transition') {
    if (event.to_state === 'kill_switch_active') return 'none';
    if (event.to_state === 'human_active') return 'human';
    if (event.to_state === 'ai_speaking') return 'ai';
  }
  if (event.type === 'decision' && event.decision_type === 'handoff') return 'human';
  return 'ai';
}

function determineActualSpeaker(event: any): string {
  if (event.type === 'state_transition') {
    if (event.to_state === 'human_active') return 'human';
    if (event.to_state === 'ai_speaking') return 'ai';
    return 'none';
  }
  return 'ai';
}

function generateHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}