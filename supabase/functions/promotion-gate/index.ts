import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      case 'check_sentinel_gate': {
        const { proposal_id } = params;
        
        // Get the proposal
        const { data: proposal, error: proposalError } = await supabase
          .from('ai_learning_proposals')
          .select('*')
          .eq('id', proposal_id)
          .single();

        if (proposalError || !proposal) {
          throw new Error('Proposal not found');
        }

        if (proposal.status !== 'simulation_passed') {
          throw new Error('Proposal must pass simulation before Sentinel gate check');
        }

        // Check Sentinel status
        const { data: sentinelStatus } = await supabase
          .from('sentinel_status')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Check for unresolved drifts
        const { count: unresolvedDrifts } = await supabase
          .from('compliance_drift_events')
          .select('*', { count: 'exact', head: true })
          .eq('is_resolved', false);

        // Check for active containments
        const { count: activeContainments } = await supabase
          .from('sentinel_containment_actions')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // Check baseline stability
        const { data: recentEvaluations } = await supabase
          .from('sentinel_evaluations')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(24); // Last 24 evaluations

        let baselineStableHours = 0;
        if (recentEvaluations && recentEvaluations.length > 0) {
          const allCompliant = recentEvaluations.every(e => e.overall_status === 'compliant');
          if (allCompliant) {
            const oldest = new Date(recentEvaluations[recentEvaluations.length - 1].created_at);
            const now = new Date();
            baselineStableHours = (now.getTime() - oldest.getTime()) / (1000 * 60 * 60);
          }
        }

        const requiredStableHours = 24;
        
        // Determine if gate passes
        const rejectionReasons: string[] = [];
        
        if (sentinelStatus?.current_status !== 'compliant') {
          rejectionReasons.push(`Sentinel status is ${sentinelStatus?.current_status || 'unknown'}, must be compliant`);
        }
        
        if ((unresolvedDrifts || 0) > 0) {
          rejectionReasons.push(`${unresolvedDrifts} unresolved drift(s) exist`);
        }
        
        if ((activeContainments || 0) > 0) {
          rejectionReasons.push(`${activeContainments} active containment(s) in effect`);
        }
        
        if (baselineStableHours < requiredStableHours) {
          rejectionReasons.push(`Baseline stable for only ${baselineStableHours.toFixed(1)}h, requires ${requiredStableHours}h`);
        }

        const gatePassed = rejectionReasons.length === 0;

        // Record gate check
        const { data: gateRecord, error: gateError } = await supabase
          .from('sentinel_promotion_gates')
          .insert({
            proposal_id,
            sentinel_status: sentinelStatus?.current_status || 'unknown',
            unresolved_drifts: unresolvedDrifts || 0,
            active_containments: activeContainments || 0,
            baseline_stable_hours: baselineStableHours,
            required_stable_hours: requiredStableHours,
            gate_passed: gatePassed,
            rejection_reasons: rejectionReasons,
            evaluation_snapshot: {
              sentinel_status: sentinelStatus,
              recent_evaluations: recentEvaluations?.slice(0, 5)
            }
          })
          .select()
          .single();

        if (gateError) throw gateError;

        // Update proposal status
        const newStatus = gatePassed ? 'sentinel_approved' : 'sentinel_rejected';
        await supabase
          .from('ai_learning_proposals')
          .update({ status: newStatus })
          .eq('id', proposal_id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            gate_passed: gatePassed,
            gate_record: gateRecord,
            rejection_reasons: rejectionReasons,
            message: gatePassed 
              ? 'Sentinel gate passed. Ready for human approval.'
              : `Sentinel gate blocked: ${rejectionReasons.join('; ')}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'human_approve': {
        const { 
          proposal_id, 
          approver_id, 
          approver_email, 
          approver_role,
          approval_reason,
          scope_description,
          permission_scope,
          valid_until,
          rollback_instructions,
          rollback_contact
        } = params;

        // Verify proposal is sentinel approved
        const { data: proposal } = await supabase
          .from('ai_learning_proposals')
          .select('*')
          .eq('id', proposal_id)
          .single();

        if (!proposal) {
          throw new Error('Proposal not found');
        }

        if (proposal.status !== 'sentinel_approved') {
          throw new Error('Proposal must be Sentinel-approved before human approval');
        }

        // Verify approver is human (not AI)
        if (approver_role === 'ai_agent' || approver_role === 'automated') {
          throw new Error('AI cannot self-promote. Human approval required.');
        }

        // Build approval payload
        const approvalPayload = {
          proposal_id,
          proposal_hash: proposal.proposal_hash,
          approver_id,
          approver_email,
          approver_role,
          approval_reason,
          scope_description,
          approved_at: new Date().toISOString()
        };

        // Generate cryptographic signature
        const signatureHash = await generateSignatureHash(approvalPayload);

        // Create approval record
        const { data: approval, error: approvalError } = await supabase
          .from('promotion_approvals')
          .insert({
            proposal_id,
            approver_id,
            approver_email,
            approver_role,
            approval_reason,
            scope_description,
            permission_scope: permission_scope || {},
            valid_until: valid_until || null,
            is_time_bounded: !!valid_until,
            rollback_instructions,
            rollback_contact,
            approval_payload: approvalPayload,
            signature_hash: signatureHash,
            signature_algorithm: 'SHA-256'
          })
          .select()
          .single();

        if (approvalError) throw approvalError;

        // Update proposal status
        await supabase
          .from('ai_learning_proposals')
          .update({ status: 'approved', is_immutable: true })
          .eq('id', proposal_id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            approval,
            signature_hash: signatureHash,
            message: 'Human approval recorded. Ready for promotion.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'promote': {
        const { proposal_id, approval_id } = params;

        // Get proposal and approval
        const { data: proposal } = await supabase
          .from('ai_learning_proposals')
          .select('*')
          .eq('id', proposal_id)
          .single();

        const { data: approval } = await supabase
          .from('promotion_approvals')
          .select('*')
          .eq('id', approval_id)
          .single();

        if (!proposal || !approval) {
          throw new Error('Proposal or approval not found');
        }

        if (proposal.status !== 'approved') {
          throw new Error('Proposal must be approved before promotion');
        }

        if (approval.is_revoked) {
          throw new Error('Approval has been revoked');
        }

        // Get version number
        const { count: existingVersions } = await supabase
          .from('ai_promotions')
          .select('*', { count: 'exact', head: true })
          .eq('affected_artifact_type', proposal.proposal_type);

        const versionNumber = (existingVersions || 0) + 1;

        // Generate rollback hash
        const rollbackHash = await generateSignatureHash({
          proposal_id,
          approval_id,
          previous_snapshot: proposal.current_artifact,
          timestamp: new Date().toISOString()
        });

        // Generate promotion hash
        const promotionHash = await generateSignatureHash({
          proposal_id,
          approval_id,
          new_snapshot: proposal.proposed_artifact,
          version_number: versionNumber,
          timestamp: new Date().toISOString()
        });

        // Set watch mode duration (48 hours)
        const watchModeUntil = new Date();
        watchModeUntil.setHours(watchModeUntil.getHours() + 48);

        // Create promotion record
        const { data: promotion, error: promotionError } = await supabase
          .from('ai_promotions')
          .insert({
            proposal_id,
            approval_id,
            business_id: proposal.business_id,
            promotion_scope: proposal.description,
            affected_artifact_type: proposal.proposal_type,
            version_number: versionNumber,
            previous_snapshot: proposal.current_artifact,
            new_snapshot: proposal.proposed_artifact,
            promotion_diff: proposal.artifact_diff,
            watch_mode_active: true,
            watch_mode_until: watchModeUntil.toISOString(),
            elevated_sensitivity: true,
            rollback_hash: rollbackHash,
            promotion_hash: promotionHash
          })
          .select()
          .single();

        if (promotionError) throw promotionError;

        // Update proposal status
        await supabase
          .from('ai_learning_proposals')
          .update({ status: 'promoted' })
          .eq('id', proposal_id);

        // Create initial watch event
        await supabase
          .from('promotion_watch_events')
          .insert({
            promotion_id: promotion.id,
            event_type: 'metric_check',
            severity: 'info',
            metrics_snapshot: { status: 'watch_mode_started' },
            action_taken: 'Elevated sensitivity enabled for 48 hours'
          });

        return new Response(
          JSON.stringify({ 
            success: true, 
            promotion,
            message: 'Promotion complete. Watch mode active for 48 hours.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'rollback': {
        const { promotion_id, rollback_reason, rolled_back_by } = params;

        // Get promotion
        const { data: promotion } = await supabase
          .from('ai_promotions')
          .select('*, ai_learning_proposals(*)')
          .eq('id', promotion_id)
          .single();

        if (!promotion) {
          throw new Error('Promotion not found');
        }

        if (promotion.is_rolled_back) {
          throw new Error('Promotion already rolled back');
        }

        // Perform rollback
        const { error: rollbackError } = await supabase
          .from('ai_promotions')
          .update({
            is_rolled_back: true,
            rolled_back_at: new Date().toISOString(),
            rolled_back_by,
            rollback_reason,
            watch_mode_active: false
          })
          .eq('id', promotion_id);

        if (rollbackError) throw rollbackError;

        // Update proposal status
        await supabase
          .from('ai_learning_proposals')
          .update({ status: 'rolled_back' })
          .eq('id', promotion.proposal_id);

        // Create rollback watch event
        await supabase
          .from('promotion_watch_events')
          .insert({
            promotion_id,
            event_type: 'auto_rollback',
            severity: 'critical',
            metrics_snapshot: { rollback_reason },
            triggered_rollback: true,
            action_taken: 'Promotion rolled back, previous version restored'
          });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Rollback complete. Previous version restored.',
            previous_snapshot: promotion.previous_snapshot
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Promotion Gate Error:', error);
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

async function generateSignatureHash(data: unknown): Promise<string> {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(JSON.stringify(data));
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
