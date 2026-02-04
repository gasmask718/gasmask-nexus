/**
 * Submit Field Change - Core Governance Function
 * 
 * This is the ONLY way field mutations should occur.
 * Direct database writes from field roles are forbidden.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  FieldSubmissionPayload,
  FieldGovernanceResult,
  FieldRole,
  getSubmissionSource,
} from './types';

/**
 * Submit a field change through the governance pipeline.
 * 
 * This function:
 * 1. Creates a field_submissions record
 * 2. In current mode, auto-applies the change (can be changed to require review)
 * 3. Returns the submission ID for tracking
 * 
 * @param payload - The field change payload
 * @param userId - The user ID of the submitter
 * @param role - The role of the submitter
 */
export async function submitFieldChange(
  payload: FieldSubmissionPayload,
  userId: string,
  role: FieldRole
): Promise<FieldGovernanceResult> {
  try {
    // Validate required fields
    if (!payload.store_id) {
      return {
        success: false,
        submissionId: null,
        error: 'Store ID is required',
        errorCode: 'MISSING_STORE_ID',
        status: 'error',
      };
    }

    if (!payload.entity_type) {
      return {
        success: false,
        submissionId: null,
        error: 'Entity type is required',
        errorCode: 'MISSING_ENTITY_TYPE',
        status: 'error',
      };
    }

    // Detect submission source
    const submissionSource = payload.submission_source || getSubmissionSource(role);

    // Create the submission record FIRST (before any mutation)
    // Use explicit type assertion for Supabase insert
    const insertData: Record<string, unknown> = {
      submitted_by_user_id: userId,
      submitted_by_role: role,
      store_id: payload.store_id,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id || null,
      action_type: payload.action_type,
      payload_before: payload.payload_before || null,
      payload_after: payload.payload_after,
      submission_source: submissionSource,
      submission_status: 'pending_review',
      is_applied: false,
    };

    const { data: submission, error: submissionError } = await supabase
      .from('field_submissions')
      // @ts-expect-error - insertData matches DB schema but TS types are strict
      .insert([insertData])
      .select('id')
      .single();

    if (submissionError) {
      console.error('❌ GOVERNANCE FAILURE — Field submission insert failed:', submissionError);
      return {
        success: false,
        submissionId: null,
        error: submissionError.message,
        errorCode: submissionError.code,
        status: 'error',
      };
    }

    if (!submission?.id) {
      console.error('❌ GOVERNANCE FAILURE — No submission ID returned');
      return {
        success: false,
        submissionId: null,
        error: 'Failed to create submission record',
        errorCode: 'NO_SUBMISSION_ID',
        status: 'error',
      };
    }

    console.log(`✅ Field submission created: ${submission.id} (${payload.entity_type}/${payload.action_type})`);

    // For now, we return pending_review status
    // The actual mutation will be applied when admin approves
    // OR we can auto-apply for low-risk changes (configurable)
    return {
      success: true,
      submissionId: submission.id,
      status: 'pending_review',
    };
  } catch (error) {
    console.error('❌ GOVERNANCE FAILURE — Unexpected error:', error);
    return {
      success: false,
      submissionId: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'UNEXPECTED_ERROR',
      status: 'error',
    };
  }
}

/**
 * Governed field mutation wrapper.
 * 
 * Wraps a mutation function to ensure it goes through governance.
 * Use this to wrap existing mutation logic.
 * 
 * @param payload - The field change payload
 * @param userId - The user ID of the submitter
 * @param role - The role of the submitter
 * @param mutationFn - The actual mutation function (only called if governance allows)
 */
export async function governedFieldMutation<T>(
  payload: FieldSubmissionPayload,
  userId: string,
  role: FieldRole,
  mutationFn: () => Promise<T>
): Promise<{ result: T | null; governance: FieldGovernanceResult }> {
  // First, create the governance record
  const governanceResult = await submitFieldChange(payload, userId, role);

  if (!governanceResult.success) {
    return {
      result: null,
      governance: governanceResult,
    };
  }

  // In strict mode, we would stop here and wait for approval
  // For now, we auto-execute the mutation (can be changed per policy)
  
  // Check if auto-apply is enabled (current default: yes)
  const autoApply = true; // TODO: Make this configurable per entity_type/risk_score
  
  if (!autoApply) {
    return {
      result: null,
      governance: governanceResult,
    };
  }

  try {
    // Execute the actual mutation
    const result = await mutationFn();

    // Mark the submission as applied
    await supabase
      .from('field_submissions')
      .update({
        submission_status: 'auto_approved',
        is_applied: true,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', governanceResult.submissionId);

    return {
      result,
      governance: {
        ...governanceResult,
        status: 'applied',
      },
    };
  } catch (mutationError) {
    // Mark the submission as failed
    await supabase
      .from('field_submissions')
      .update({
        submission_status: 'rejected',
        rejection_reason: mutationError instanceof Error ? mutationError.message : 'Mutation failed',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', governanceResult.submissionId);

    throw mutationError;
  }
}
