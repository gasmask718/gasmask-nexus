import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LearningProposal {
  business_id: string;
  proposal_type: 'phrasing_variant' | 'playbook_sequence' | 'escalation_timing' | 'objection_handling' | 'tone_adjustment' | 'script_refinement';
  title: string;
  description: string;
  source_calls?: string[];
  source_metrics?: Record<string, unknown>;
  evidence_summary?: string;
  expected_benefit: string;
  expected_improvement_pct?: number;
  risk_assessment: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  affects_speech?: boolean;
  affects_timing?: boolean;
  affects_escalation?: boolean;
  affects_routing?: boolean;
  current_artifact: Record<string, unknown>;
  proposed_artifact: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...params } = await req.json();

    switch (action) {
      case 'propose': {
        // AI proposes an improvement (read-only, never applied)
        const proposal = params as LearningProposal;
        
        // Compute artifact diff
        const artifactDiff = computeDiff(proposal.current_artifact, proposal.proposed_artifact);
        
        // Generate proposal hash for immutability
        const proposalHash = await generateHash({
          ...proposal,
          artifact_diff: artifactDiff,
          timestamp: new Date().toISOString()
        });

        const { data, error } = await supabase
          .from('ai_learning_proposals')
          .insert({
            ...proposal,
            artifact_diff: artifactDiff,
            proposal_hash: proposalHash,
            status: 'proposed'
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ 
            success: true, 
            proposal: data,
            message: 'Proposal created. AI cannot apply this - human approval required.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list_proposals': {
        const { business_id, status } = params;
        
        let query = supabase
          .from('ai_learning_proposals')
          .select('*')
          .order('created_at', { ascending: false });

        if (business_id) query = query.eq('business_id', business_id);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, proposals: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'archive_proposal': {
        const { proposal_id } = params;
        
        const { data: proposal } = await supabase
          .from('ai_learning_proposals')
          .select('status')
          .eq('id', proposal_id)
          .single();

        if (proposal?.status === 'promoted') {
          throw new Error('Cannot archive a promoted proposal');
        }

        const { error } = await supabase
          .from('ai_learning_proposals')
          .update({ status: 'archived' })
          .eq('id', proposal_id);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, message: 'Proposal archived' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'generate_ai_proposals': {
        // AI analyzes recent calls and generates improvement proposals
        const { business_id } = params;
        
        // Get recent successful calls for analysis
        const { data: recentCalls } = await supabase
          .from('ai_call_logs')
          .select('*')
          .eq('business_id', business_id)
          .eq('outcome', 'success')
          .order('created_at', { ascending: false })
          .limit(50);

        // Get current playbooks
        const { data: playbooks } = await supabase
          .from('sales_playbooks')
          .select('*')
          .eq('business_id', business_id)
          .eq('is_active', true);

        // Generate proposals based on patterns
        const proposals: Partial<LearningProposal>[] = [];

        // Example: Propose timing adjustment if calls are consistently shorter
        if (recentCalls && recentCalls.length > 10) {
          const avgDuration = recentCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / recentCalls.length;
          
          if (avgDuration < 120) {
            proposals.push({
              business_id,
              proposal_type: 'escalation_timing',
              title: 'Faster Initial Engagement',
              description: 'Analysis shows successful calls average under 2 minutes. Propose faster qualification.',
              expected_benefit: 'Reduce call time while maintaining conversion',
              expected_improvement_pct: 15,
              risk_assessment: 'Low risk - based on observed successful patterns',
              risk_level: 'low',
              affects_timing: true,
              current_artifact: { avg_call_time: 180, escalation_delay: 30 },
              proposed_artifact: { avg_call_time: 120, escalation_delay: 20 }
            });
          }
        }

        // Insert generated proposals
        for (const proposal of proposals) {
          const artifactDiff = computeDiff(
            proposal.current_artifact || {},
            proposal.proposed_artifact || {}
          );
          
          const proposalHash = await generateHash({
            ...proposal,
            artifact_diff: artifactDiff,
            timestamp: new Date().toISOString()
          });

          await supabase
            .from('ai_learning_proposals')
            .insert({
              ...proposal,
              artifact_diff: artifactDiff,
              proposal_hash: proposalHash,
              status: 'proposed',
              evidence_summary: `Based on analysis of ${recentCalls?.length || 0} recent successful calls`
            });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            proposals_generated: proposals.length,
            message: 'AI-generated proposals created. Human review required.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('AI Learning Engine Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function computeDiff(current: Record<string, unknown>, proposed: Record<string, unknown>): Record<string, unknown> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  
  const allKeys = new Set([...Object.keys(current), ...Object.keys(proposed)]);
  
  for (const key of allKeys) {
    if (JSON.stringify(current[key]) !== JSON.stringify(proposed[key])) {
      diff[key] = { from: current[key], to: proposed[key] };
    }
  }
  
  return diff;
}

async function generateHash(data: unknown): Promise<string> {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(JSON.stringify(data));
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
