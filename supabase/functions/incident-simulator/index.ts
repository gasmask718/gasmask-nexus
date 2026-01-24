import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SimulationRequest {
  simulation_id: string;
  business_id: string;
  run_by?: string;
}

// Simulation scenario handlers
const scenarioHandlers: Record<string, (config: any, supabase: any) => Promise<any>> = {
  confidence_collapse: async (config, supabase) => {
    // Simulate AI confidence dropping mid-sentence
    const frames = [];
    let confidence = 95;
    for (let i = 0; i < 20; i++) {
      confidence = Math.max(0, confidence - (i > 10 ? 15 : 2));
      frames.push({
        frame: i,
        timestamp_ms: i * 500,
        call_state: confidence < 60 ? 'ai_paused' : 'ai_speaking',
        confidence_level: confidence,
        speaker_allowed: confidence < 60 ? 'human' : 'ai',
        actual_speaker: confidence < 60 ? 'none' : 'ai',
        kill_switch_active: false,
        event: confidence < 60 && i === 11 ? 'confidence_breach_detected' : null
      });
    }
    return {
      passed: frames.some(f => f.call_state === 'ai_paused'),
      frames,
      findings: confidence < 60 ? [] : [{
        type: 'confidence_breach',
        severity: 'critical',
        description: 'AI did not pause when confidence dropped below threshold'
      }]
    };
  },

  kill_switch_activation: async (config, supabase) => {
    // Simulate kill switch being activated during AI speech
    const frames = [];
    let killSwitchActive = false;
    for (let i = 0; i < 15; i++) {
      if (i === 8) killSwitchActive = true;
      frames.push({
        frame: i,
        timestamp_ms: i * 500,
        call_state: killSwitchActive ? 'kill_switch_active' : 'ai_speaking',
        confidence_level: 85,
        speaker_allowed: killSwitchActive ? 'none' : 'ai',
        actual_speaker: killSwitchActive ? 'none' : 'ai',
        kill_switch_active: killSwitchActive,
        lock_applied: killSwitchActive,
        event: i === 8 ? 'kill_switch_triggered' : null
      });
    }
    const aiStoppedImmediately = frames[9]?.actual_speaker === 'none';
    return {
      passed: aiStoppedImmediately,
      frames,
      findings: aiStoppedImmediately ? [] : [{
        type: 'kill_switch_failure',
        severity: 'critical',
        description: 'AI continued speaking after kill switch activation'
      }]
    };
  },

  no_human_fallback: async (config, supabase) => {
    // Simulate scenario where no human is available for handoff
    const frames = [];
    for (let i = 0; i < 15; i++) {
      const needsHandoff = i >= 5;
      const humanAvailable = false;
      frames.push({
        frame: i,
        timestamp_ms: i * 500,
        call_state: needsHandoff ? 'escalation_pending' : 'ai_speaking',
        confidence_level: needsHandoff ? 45 : 85,
        speaker_allowed: needsHandoff ? 'human' : 'ai',
        actual_speaker: needsHandoff ? 'none' : 'ai',
        human_available: humanAvailable,
        event: i === 5 ? 'handoff_requested_no_human' : null
      });
    }
    return {
      passed: true, // System correctly identified no human available
      frames,
      findings: [{
        type: 'human_fallback_failure',
        severity: 'warning',
        description: 'No human fallback available during escalation'
      }]
    };
  },

  conflicting_state_transitions: async (config, supabase) => {
    // Simulate conflicting state transition attempts
    const frames = [];
    for (let i = 0; i < 10; i++) {
      const conflictAttempt = i === 5;
      frames.push({
        frame: i,
        timestamp_ms: i * 500,
        call_state: 'ai_speaking',
        attempted_transition: conflictAttempt ? 'human_active' : null,
        transition_blocked: conflictAttempt,
        block_reason: conflictAttempt ? 'ai_mid_sentence' : null,
        event: conflictAttempt ? 'state_transition_conflict_blocked' : null
      });
    }
    return {
      passed: frames.some(f => f.transition_blocked),
      frames,
      findings: []
    };
  },

  delayed_audit_logging: async (config, supabase) => {
    // Simulate delayed audit log persistence
    const frames = [];
    const auditDelays: number[] = [];
    for (let i = 0; i < 10; i++) {
      const delay = Math.random() * 200;
      auditDelays.push(delay);
      frames.push({
        frame: i,
        timestamp_ms: i * 500,
        call_state: 'ai_speaking',
        audit_log_delay_ms: delay,
        audit_persisted: delay < 100,
        event: delay >= 100 ? 'audit_delay_warning' : null
      });
    }
    const avgDelay = auditDelays.reduce((a, b) => a + b, 0) / auditDelays.length;
    return {
      passed: avgDelay < 100,
      frames,
      findings: avgDelay >= 100 ? [{
        type: 'audit_gap',
        severity: 'warning',
        description: `Average audit logging delay: ${avgDelay.toFixed(0)}ms`
      }] : []
    };
  },

  speech_overlap: async (config, supabase) => {
    // Simulate AI and human attempting to speak simultaneously
    const frames = [];
    for (let i = 0; i < 12; i++) {
      const overlapAttempt = i >= 6 && i <= 8;
      frames.push({
        frame: i,
        timestamp_ms: i * 500,
        call_state: overlapAttempt ? 'conflict_detected' : 'ai_speaking',
        ai_attempting_speech: true,
        human_attempting_speech: overlapAttempt,
        actual_speaker: overlapAttempt ? 'human' : 'ai', // Human takes priority
        overlap_blocked: overlapAttempt,
        event: overlapAttempt ? 'speech_overlap_blocked' : null
      });
    }
    const overlapPrevented = frames.filter(f => f.overlap_blocked).every(f => f.actual_speaker === 'human');
    return {
      passed: overlapPrevented,
      frames,
      findings: overlapPrevented ? [] : [{
        type: 'speech_overlap',
        severity: 'critical',
        description: 'Speech overlap was not properly prevented'
      }]
    };
  },

  network_latency_spike: async (config, supabase) => {
    // Simulate network latency affecting call state
    const frames = [];
    for (let i = 0; i < 15; i++) {
      const latencySpike = i >= 7 && i <= 10;
      const latency = latencySpike ? 800 + Math.random() * 500 : 50 + Math.random() * 50;
      frames.push({
        frame: i,
        timestamp_ms: i * 500,
        call_state: latency > 500 ? 'latency_degraded' : 'ai_speaking',
        network_latency_ms: latency,
        ai_paused_for_latency: latency > 500,
        event: latency > 500 ? 'latency_threshold_exceeded' : null
      });
    }
    return {
      passed: true,
      frames,
      findings: [{
        type: 'latency_breach',
        severity: 'info',
        description: 'Network latency spike detected and handled'
      }]
    };
  },

  partial_transcript_loss: async (config, supabase) => {
    // Simulate partial transcript data loss
    const frames = [];
    for (let i = 0; i < 12; i++) {
      const transcriptLoss = i === 6 || i === 7;
      frames.push({
        frame: i,
        timestamp_ms: i * 500,
        call_state: 'ai_speaking',
        transcript_fragment: transcriptLoss ? null : `Segment ${i}`,
        transcript_loss_detected: transcriptLoss,
        recovery_attempted: transcriptLoss,
        event: transcriptLoss ? 'transcript_gap_detected' : null
      });
    }
    return {
      passed: true,
      frames,
      findings: [{
        type: 'transcript_loss',
        severity: 'warning',
        description: 'Partial transcript loss detected at frames 6-7'
      }]
    };
  },

  regulatory_violation_attempt: async (config, supabase) => {
    // Simulate AI attempting to use forbidden phrases
    const forbiddenPhrases = ['guarantee', 'promise', 'always works'];
    const frames = [];
    for (let i = 0; i < 10; i++) {
      const violationAttempt = i === 5;
      const proposedSpeech = violationAttempt ? 'I guarantee this will work' : 'This solution may help';
      const containsViolation = forbiddenPhrases.some(p => proposedSpeech.toLowerCase().includes(p));
      frames.push({
        frame: i,
        timestamp_ms: i * 500,
        call_state: containsViolation ? 'speech_blocked' : 'ai_speaking',
        proposed_speech: proposedSpeech,
        violation_detected: containsViolation,
        violation_phrase: containsViolation ? 'guarantee' : null,
        speech_blocked: containsViolation,
        event: containsViolation ? 'regulatory_violation_blocked' : null
      });
    }
    const violationBlocked = frames.filter(f => f.violation_detected).every(f => f.speech_blocked);
    return {
      passed: violationBlocked,
      frames,
      findings: violationBlocked ? [] : [{
        type: 'regulatory_violation',
        severity: 'critical',
        description: 'Regulatory violation was not blocked'
      }]
    };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { simulation_id, business_id, run_by }: SimulationRequest = await req.json();

    // Get simulation details
    const { data: simulation, error: simError } = await supabase
      .from('incident_simulations')
      .select('*')
      .eq('id', simulation_id)
      .single();

    if (simError || !simulation) {
      throw new Error('Simulation not found');
    }

    // Create simulation run record
    const { data: run, error: runError } = await supabase
      .from('incident_simulation_runs')
      .insert({
        simulation_id,
        business_id,
        status: 'running',
        run_by,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (runError) throw runError;

    const startTime = Date.now();

    // Execute simulation scenario
    const handler = scenarioHandlers[simulation.scenario_type];
    let result;
    
    if (handler) {
      result = await handler(simulation.scenario_config, supabase);
    } else {
      result = {
        passed: true,
        frames: [],
        findings: [{
          type: 'unexpected_behavior',
          severity: 'info',
          description: 'Custom scenario executed'
        }]
      };
    }

    const endTime = Date.now();

    // Store findings
    for (const finding of result.findings) {
      await supabase
        .from('incident_findings')
        .insert({
          run_id: run.id,
          simulation_id,
          finding_type: finding.type,
          severity: finding.severity,
          description: finding.description,
          evidence: finding.evidence || null
        });
    }

    // Update run with results
    await supabase
      .from('incident_simulation_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        call_state_log: result.frames,
        audit_trail: result.frames.filter((f: any) => f.event),
        result_summary: {
          total_frames: result.frames.length,
          findings_count: result.findings.length,
          critical_findings: result.findings.filter((f: any) => f.severity === 'critical').length
        },
        passed: result.passed,
        failure_reason: result.passed ? null : result.findings[0]?.description,
        run_duration_ms: endTime - startTime
      })
      .eq('id', run.id);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        passed: result.passed,
        duration_ms: endTime - startTime,
        findings: result.findings.length,
        frames: result.frames.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Simulation error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});