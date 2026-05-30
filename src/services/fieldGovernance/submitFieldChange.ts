/**
 * Submit Field Change - Core Governance Function
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * FIELD GOVERNANCE - SINGLE AUTHORITATIVE ENTRY POINT
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This is the ONLY function that may insert into field_submissions.
 * Direct database writes from field roles are forbidden.
 * 
 * NON-NEGOTIABLE RULE:
 * Any action performed by a driver, biker, or ambassador MUST first exist
 * as a row in field_submissions. If the system allows a mutation without
 * that row, the implementation is invalid.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  FieldSubmissionPayload,
  FieldGovernanceResult,
  FieldRole,
  getSubmissionSource,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// GOVERNANCE MODE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * STRICT MODE: When true, field role submissions are PENDING ONLY.
 * The actual mutation is NOT applied until admin approves.
 */
export const GOVERNANCE_STRICT_MODE = true;

/**
 * Submit a field change through the governance pipeline.
 * 
 * This function:
 * 1. Creates a field_submissions record
 * 2. In STRICT mode, change is PENDING (not applied until admin approves)
 * 3. Returns the submission ID for tracking
 * 
 * IMPORTANT: This is the ONLY function that inserts into field_submissions.
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
    // Validate required fields (store_id is optional for brand-new store proposals)
    if (!payload.store_id && payload.entity_type !== 'new_store') {
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
      store_id: payload.store_id ?? null,
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

    // In STRICT mode, return pending_review - mutation NOT applied
    // Admin must approve to apply the change
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
 * Governed field mutation wrapper (STRICT MODE AWARE)
 * 
 * In STRICT mode:
 * - Creates submission record with pending_review status
 * - Does NOT execute mutationFn
 * - Returns null result with pending status
 * 
 * @param payload - The field change payload
 * @param userId - The user ID of the submitter
 * @param role - The role of the submitter
 * @param mutationFn - The actual mutation function (only called if NOT strict mode)
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

  // In STRICT mode, do NOT execute mutation - wait for admin approval
  if (GOVERNANCE_STRICT_MODE) {
    console.log(`⏳ Field submission ${governanceResult.submissionId} awaiting admin approval (STRICT MODE)`);
    return {
      result: null,
      governance: governanceResult,
    };
  }

  // Legacy mode only: auto-execute the mutation
  try {
    const result = await mutationFn();

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
