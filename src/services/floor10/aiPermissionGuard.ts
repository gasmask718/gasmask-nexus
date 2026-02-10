/**
 * FLOOR 10 — AI Execution Engine
 * 
 * Core Principle: AI execution is a 3-step ritual — no shortcuts.
 * 
 * 1. Intent Declaration (no side effects)
 * 2. Permission Check (Floor 9.2 RPC)
 * 3. Execution (only if allowed=true, only the declared action)
 * 
 * Post-execution: mandatory logging to ai_decision_log.
 * 
 * FORBIDDEN BEHAVIORS:
 * - Multiple actions per check
 * - Re-checking permissions mid-action
 * - Retrying denied actions
 * - Escalating permissions
 * - Caching permission decisions
 */

import { supabase } from '@/integrations/supabase/client';

// ============= TYPES =============

export interface AIIntent {
  /** One of the 8 pre-declared action keys */
  actionKey: string;
  /** The neighborhood this action targets */
  neighborhoodId: string;
  /** Human-readable description of what AI intends to do */
  description: string;
  /** Payload for execution — declared upfront, immutable after check */
  payload?: Record<string, unknown>;
}

export interface PermissionVerdict {
  allowed: boolean;
  reason: string;
  source: 'commitment' | 'default_deny';
}

export interface ExecutionResult {
  success: boolean;
  intentDeclared: AIIntent;
  permissionVerdict: PermissionVerdict;
  executionOutput?: unknown;
  error?: string;
  timestamp: string;
}

// Pre-declared action keys — AI is restricted to ONLY these
const ALLOWED_ACTION_KEYS = [
  'scout_address',
  'call_store',
  'send_follow_up',
  'suggest_promotion',
  'analyze_gaps',
  'observe_only',
  'ingest_addresses',
  'summarize_activity',
] as const;

export type AllowedActionKey = typeof ALLOWED_ACTION_KEYS[number];

// ============= STEP 1: INTENT DECLARATION =============

/**
 * Declares AI intent. No side effects. Returns a frozen intent object.
 * Validates the action key is in the allowlist before proceeding.
 */
export function declareIntent(
  actionKey: string,
  neighborhoodId: string,
  description: string,
  payload?: Record<string, unknown>
): AIIntent {
  // Validate action key is in allowlist
  if (!ALLOWED_ACTION_KEYS.includes(actionKey as AllowedActionKey)) {
    throw new Error(
      `FORBIDDEN: Action key '${actionKey}' is not in the allowed actions list. ` +
      `Allowed: ${ALLOWED_ACTION_KEYS.join(', ')}`
    );
  }

  if (!neighborhoodId) {
    throw new Error('FORBIDDEN: neighborhood_id is required for all AI actions');
  }

  // Return frozen intent — immutable after declaration
  return Object.freeze({
    actionKey,
    neighborhoodId,
    description,
    payload: payload ? Object.freeze({ ...payload }) : undefined,
  });
}

// ============= STEP 2: PERMISSION CHECK (Floor 9.2 RPC) =============

/**
 * Calls the Floor 9.2 RPC to check if AI is allowed to perform the declared action.
 * This is the ONLY permission gate. No client-side fallback logic.
 * The RPC also logs the attempt (Floor 9.3).
 */
export async function checkPermission(intent: AIIntent): Promise<PermissionVerdict> {
  const { data, error } = await supabase.rpc('can_ai_perform_action', {
    p_action_key: intent.actionKey,
    p_neighborhood_id: intent.neighborhoodId,
  });

  if (error) {
    console.error('[Floor 10] Permission check RPC failed:', error.message);
    return {
      allowed: false,
      reason: `rpc_failure: ${error.message}`,
      source: 'default_deny',
    };
  }

  const result = data as unknown as Record<string, unknown>;
  return {
    allowed: Boolean(result?.allowed),
    reason: String(result?.reason || 'no_reason'),
    source: (String(result?.source || 'default_deny')) as PermissionVerdict['source'],
  };
}

// ============= STEP 3: GUARDED EXECUTION =============

/**
 * The full 3-step ritual. This is the ONLY way AI should execute actions.
 * 
 * 1. Intent is validated (action key allowlist)
 * 2. Permission is checked via RPC (server-side, logged)
 * 3. Executor runs ONLY if allowed=true
 * 
 * Returns a complete audit trail regardless of outcome.
 */
export async function executeGuarded(
  intent: AIIntent,
  executor: (intent: AIIntent) => Promise<unknown>
): Promise<ExecutionResult> {
  const timestamp = new Date().toISOString();

  // Step 2: Permission Check
  const verdict = await checkPermission(intent);

  // If denied → STOP. No retry. No escalation.
  if (!verdict.allowed) {
    return {
      success: false,
      intentDeclared: intent,
      permissionVerdict: verdict,
      error: `DENIED: ${verdict.reason}`,
      timestamp,
    };
  }

  // Step 3: Execute ONLY the declared action
  try {
    const output = await executor(intent);

    // Post-execution: log success (supplementary client-side log)
    await logExecutionOutcome(intent, verdict, true);

    return {
      success: true,
      intentDeclared: intent,
      permissionVerdict: verdict,
      executionOutput: output,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown execution error';

    // Post-execution: log failure
    await logExecutionOutcome(intent, verdict, false, errorMsg);

    return {
      success: false,
      intentDeclared: intent,
      permissionVerdict: verdict,
      error: errorMsg,
      timestamp,
    };
  }
}

// ============= POST-EXECUTION LOGGING =============

/**
 * Supplementary client-side log after execution.
 * The RPC already logs the permission check (Floor 9.3),
 * this adds the execution outcome.
 */
async function logExecutionOutcome(
  intent: AIIntent,
  verdict: PermissionVerdict,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase.from('ai_decision_log').insert([{
      ai_agent: 'floor10_executor',
      action_key: intent.actionKey,
      neighborhood_id: intent.neighborhoodId,
      permission_allowed: verdict.allowed,
      permission_source: verdict.source,
      blocked_reason: errorMessage || null,
      decision_payload: JSON.parse(JSON.stringify({
        phase: 'post_execution',
        ai_agent: 'floor10_executor',
        intent_description: intent.description,
        execution_success: success,
        error: errorMessage || null,
        verdict,
      })),
      actor: 'ai',
      enforcement_source: 'v_ai_effective_permissions',
    }]);
  } catch (logError) {
    // Log failures must not crash execution
    console.error('[Floor 10] Post-execution log failed:', logError);
  }
}

// ============= CONVENIENCE: FULL RITUAL IN ONE CALL =============

/**
 * Shorthand for the complete 3-step ritual:
 *   declareIntent → checkPermission → execute
 */
export async function aiAct(
  actionKey: string,
  neighborhoodId: string,
  description: string,
  executor: (intent: AIIntent) => Promise<unknown>,
  payload?: Record<string, unknown>
): Promise<ExecutionResult> {
  const intent = declareIntent(actionKey, neighborhoodId, description, payload);
  return executeGuarded(intent, executor);
}
