import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { lead_id } = await req.json();

    if (!lead_id) {
      return new Response(JSON.stringify({ error: 'lead_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch VA native calls (brandaro_calls + brandaro_call_insights)
    const { data: vaCalls } = await supabase
      .from('brandaro_calls')
      .select(`
        id,
        call_status,
        duration_seconds,
        transcript,
        outcome,
        ai_handled,
        created_at,
        brandaro_call_insights (
          ai_summary,
          intent_level,
          sentiment,
          objections,
          services_requested,
          closing_angle,
          ai_recommended_next
        )
      `)
      .eq('lead_id', lead_id)
      .order('created_at', { ascending: false });

    // Fetch Dynasty Connect calls
    const { data: dcCalls } = await supabase
      .from('dynasty_ai_calls')
      .select(`
        call_id,
        duration_seconds,
        transcript,
        recording_url,
        outcome,
        lead_quality,
        call_started_at,
        call_ended_at,
        created_at,
        dynasty_call_analysis (
          overall_score,
          rapport_score,
          qualification_score,
          closing_score,
          energy_score,
          what_went_well,
          what_to_improve,
          best_moment,
          worst_moment,
          specific_coaching,
          customer_sentiment,
          recommended_followup,
          callback_timing
        )
      `)
      .eq('source_lead_id', lead_id)
      .order('created_at', { ascending: false });

    // Normalize into unified format
    const unified = [
      ...(vaCalls || []).map((c: any) => ({
        call_system: 'va_native',
        call_id: c.id,
        call_date: c.created_at,
        duration_seconds: c.duration_seconds,
        outcome: c.outcome,
        transcript: c.transcript,
        recording_url: null,
        analysis: c.brandaro_call_insights?.[0] ? {
          summary: c.brandaro_call_insights[0].ai_summary,
          lead_quality: c.brandaro_call_insights[0].intent_level,
          sentiment: c.brandaro_call_insights[0].sentiment,
          objections: c.brandaro_call_insights[0].objections,
          next_action: c.brandaro_call_insights[0].ai_recommended_next,
        } : null,
      })),
      ...(dcCalls || []).map((c: any) => ({
        call_system: 'dynasty_connect',
        call_id: c.call_id,
        call_date: c.created_at,
        duration_seconds: c.duration_seconds,
        outcome: c.outcome,
        transcript: c.transcript,
        recording_url: c.recording_url,
        lead_quality: c.lead_quality,
        analysis: c.dynasty_call_analysis?.[0] ? {
          overall_score: c.dynasty_call_analysis[0].overall_score,
          rapport_score: c.dynasty_call_analysis[0].rapport_score,
          qualification_score: c.dynasty_call_analysis[0].qualification_score,
          closing_score: c.dynasty_call_analysis[0].closing_score,
          what_went_well: c.dynasty_call_analysis[0].what_went_well,
          what_to_improve: c.dynasty_call_analysis[0].what_to_improve,
          specific_coaching: c.dynasty_call_analysis[0].specific_coaching,
          sentiment: c.dynasty_call_analysis[0].customer_sentiment,
          next_action: c.dynasty_call_analysis[0].recommended_followup,
        } : null,
      })),
    ].sort((a, b) => new Date(b.call_date).getTime() - new Date(a.call_date).getTime());

    return new Response(JSON.stringify({
      success: true,
      lead_id,
      total_calls: unified.length,
      va_calls: (vaCalls || []).length,
      dc_calls: (dcCalls || []).length,
      calls: unified,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('get-unified-call-history error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
