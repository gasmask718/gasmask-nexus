/**
 * Intent Engine - Phase 4: Controlled Autonomy & Intent Resolution
 * Client-side intent submission and autonomy envelope management
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// Intent envelope structure
export interface IntentEnvelope {
  origin_action_ids: string[];
  portal_type: 'driver' | 'biker';
  user_id: string;
  device_id: string;
  assignment_id?: string;
  shift_id?: string;
  intent_type: string;
  confidence_level: number;
  constraints_seen: string[];
  proposed_effect: Record<string, unknown>;
  supporting_evidence: Record<string, unknown>;
  client_timestamp: string;
  expires_at?: string;
}

// Autonomy envelope structure (cached from server)
export interface AutonomyEnvelope {
  id: string;
  envelope_name: string;
  portal_type: 'driver' | 'biker';
  allowed_intent_types: string[];
  decision_thresholds: Record<string, number>;
  max_impact: Record<string, number>;
  required_evidence: string[];
  valid_until?: string;
  is_active: boolean;
}

// Intent resolution result
export interface IntentResolution {
  success: boolean;
  intent_id: string;
  outcome: 'accepted' | 'modified' | 'deferred' | 'rejected' | 'escalated';
  resolution_id?: string;
  reason_codes: string[];
  explanation: string;
  error?: string;
}

// RPC response shape from resolve_intent
interface ResolveIntentRpcResponse {
  success?: boolean;
  outcome?: string;
  resolution_id?: string;
  reason_codes?: string[];
  explanation?: string;
}

// Raw resolution row from database join
interface RawResolutionRow {
  outcome?: string;
  reason_codes?: string[];
  explanation?: string;
  was_auto_resolved?: boolean;
  override_by?: string;
  override_reason?: string;
}

// Cache for autonomy envelopes
let autonomyCache: AutonomyEnvelope[] = [];
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch and cache autonomy envelopes for current device
 */
export async function fetchAutonomyEnvelopes(
  deviceId: string,
  portalType: 'driver' | 'biker'
): Promise<AutonomyEnvelope[]> {
  const now = Date.now();
  
  // Return cached if fresh
  if (autonomyCache.length > 0 && (now - cacheTimestamp) < CACHE_TTL) {
    return autonomyCache;
  }

  const { data, error } = await supabase
    .from('autonomy_envelopes')
    .select('*')
    .eq('portal_type', portalType)
    .eq('is_active', true)
    .or(`device_id.is.null,device_id.eq.${deviceId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch autonomy envelopes:', error);
    return autonomyCache; // Return stale cache on error
  }

  // Map database rows to AutonomyEnvelope interface
  autonomyCache = (data || []).map(row => ({
    id: row.id,
    envelope_name: row.envelope_name,
    portal_type: row.portal_type as 'driver' | 'biker',
    allowed_intent_types: row.allowed_intent_types || [],
    decision_thresholds: (row.decision_thresholds as Record<string, number>) || {},
    max_impact: (row.max_impact as Record<string, number>) || {},
    required_evidence: row.required_evidence || [],
    valid_until: row.valid_until || undefined,
    is_active: row.is_active ?? true,
  }));
  cacheTimestamp = now;
  
  return autonomyCache;
}

/**
 * Check if an intent type is allowed by current autonomy
 */
export function checkLocalAutonomy(
  intentType: string,
  proposedEffect: Record<string, unknown>
): { allowed: boolean; reason?: string; envelope?: AutonomyEnvelope } {
  const envelope = autonomyCache.find(e => 
    e.allowed_intent_types.includes(intentType)
  );

  if (!envelope) {
    return { allowed: false, reason: 'no_matching_envelope' };
  }

  // Check time validity
  if (envelope.valid_until && new Date(envelope.valid_until) < new Date()) {
    return { allowed: false, reason: 'envelope_expired' };
  }

  // Check impact limits
  if (envelope.max_impact) {
    for (const [key, limit] of Object.entries(envelope.max_impact)) {
      const value = proposedEffect[key];
      if (typeof value === 'number' && value > limit) {
        return { allowed: false, reason: `exceeds_${key}_limit` };
      }
    }
  }

  return { allowed: true, envelope };
}

/**
 * Submit an intent envelope to the Core OS
 */
export async function submitIntent(
  intent: IntentEnvelope
): Promise<IntentResolution> {
  // First, insert the intent and let the database generate the intent_id
  const { data: insertedData, error: insertError } = await supabase
    .from('intent_envelopes')
    .insert({
      origin_action_ids: intent.origin_action_ids,
      portal_type: intent.portal_type,
      user_id: intent.user_id,
      device_id: intent.device_id,
      assignment_id: intent.assignment_id,
      shift_id: intent.shift_id,
      intent_type: intent.intent_type,
      confidence_level: intent.confidence_level,
      constraints_seen: intent.constraints_seen,
      proposed_effect: intent.proposed_effect as Json,
      supporting_evidence: intent.supporting_evidence as Json,
      client_timestamp: intent.client_timestamp,
      expires_at: intent.expires_at,
      status: 'pending',
    })
    .select('intent_id')
    .single();

  if (insertError || !insertedData) {
    return {
      success: false,
      intent_id: '',
      outcome: 'rejected',
      reason_codes: ['insert_failed'],
      explanation: insertError?.message || 'Failed to insert intent',
      error: insertError?.message,
    };
  }

  const intentId = insertedData.intent_id;

  // Trigger resolution
  const { data, error: resolveError } = await supabase
    .rpc('resolve_intent', { p_intent_id: intentId });

  if (resolveError) {
    return {
      success: false,
      intent_id: intentId,
      outcome: 'deferred',
      reason_codes: ['resolution_failed'],
      explanation: resolveError.message,
      error: resolveError.message,
    };
  }

  // Safely parse RPC response
  const rpcResult = data as ResolveIntentRpcResponse | null;
  const outcome = (rpcResult?.outcome || 'deferred') as IntentResolution['outcome'];
  
  return {
    success: rpcResult?.success ?? false,
    intent_id: intentId,
    outcome,
    resolution_id: rpcResult?.resolution_id,
    reason_codes: rpcResult?.reason_codes || [],
    explanation: rpcResult?.explanation || '',
  };
}

/**
 * Get resolution status for an intent
 */
export async function getIntentStatus(intentId: string): Promise<{
  status: string;
  resolution?: IntentResolution;
}> {
  const { data, error } = await supabase
    .from('intent_envelopes')
    .select(`
      status,
      intent_id,
      intent_resolutions (
        outcome,
        reason_codes,
        explanation,
        was_auto_resolved,
        override_by,
        override_reason
      )
    `)
    .eq('intent_id', intentId)
    .single();

  if (error || !data) {
    return { status: 'unknown' };
  }

  // Handle the joined resolution data
  const resolutions = data.intent_resolutions as RawResolutionRow[] | null;
  const rawResolution = resolutions?.[0];

  if (!rawResolution) {
    return { status: data.status };
  }

  return {
    status: data.status,
    resolution: {
      success: rawResolution.outcome === 'accepted' || rawResolution.outcome === 'modified',
      intent_id: data.intent_id,
      outcome: (rawResolution.outcome || 'deferred') as IntentResolution['outcome'],
      reason_codes: rawResolution.reason_codes || [],
      explanation: rawResolution.explanation || '',
    },
  };
}

/**
 * Clear autonomy cache (call on logout or device change)
 */
export function clearAutonomyCache(): void {
  autonomyCache = [];
  cacheTimestamp = 0;
}
