// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UP TRIGGER SERVICE — Connects follow-ups to AI/VA task systems
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import type { FollowUpQueueItem } from '@/hooks/useFollowUps';

export interface TriggerResult {
  success: boolean;
  message: string;
  taskId?: string;
}

/**
 * Trigger an AI Call via the auto dialer queue
 */
export async function triggerAICall(followUp: FollowUpQueueItem): Promise<TriggerResult> {
  try {
    const client = supabase as any;
    
    // Create a campaign target for immediate call
    const { data, error } = await client
      .from('campaign_targets')
      .insert({
        store_id: followUp.store_id,
        campaign_id: null, // Direct call, not part of a campaign
        priority: followUp.priority || 3,
        status: 'pending',
        context: {
          source: 'follow_up_engine',
          follow_up_id: followUp.id,
          reason: followUp.reason,
          ...((followUp.context as Record<string, unknown>) || {}),
        },
      })
      .select()
      .single();

    if (error) throw error;

    // Mark follow-up as triggered
    await supabase
      .from('follow_up_queue')
      .update({ status: 'completed' })
      .eq('id', followUp.id);

    return {
      success: true,
      message: 'AI call queued successfully',
      taskId: data?.id,
    };
  } catch (error) {
    console.error('Failed to trigger AI call:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to queue AI call',
    };
  }
}

/**
 * Trigger an AI Text via the auto texter queue
 */
export async function triggerAIText(followUp: FollowUpQueueItem): Promise<TriggerResult> {
  try {
    const client = supabase as any;
    
    // Get store phone number
    const { data: store } = await supabase
      .from('store_master')
      .select('phone, store_name')
      .eq('id', followUp.store_id)
      .single();

    if (!store?.phone) {
      return {
        success: false,
        message: 'Store has no phone number',
      };
    }

    // Create outbound message
    const { data, error } = await client
      .from('sms_logs')
      .insert({
        phone_number: store.phone,
        store_id: followUp.store_id,
        business_id: followUp.business_id,
        direction: 'outbound',
        status: 'pending',
        message: `Follow-up: ${followUp.reason?.replace(/_/g, ' ')}`,
        ai_generated: true,
        metadata: {
          source: 'follow_up_engine',
          follow_up_id: followUp.id,
          reason: followUp.reason,
        },
      })
      .select()
      .single();

    if (error) throw error;

    // Mark follow-up as completed
    await supabase
      .from('follow_up_queue')
      .update({ status: 'completed' })
      .eq('id', followUp.id);

    return {
      success: true,
      message: 'AI text queued successfully',
      taskId: data?.id,
    };
  } catch (error) {
    console.error('Failed to trigger AI text:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to queue AI text',
    };
  }
}

/**
 * Create a VA task for manual call
 */
export async function triggerManualCall(followUp: FollowUpQueueItem): Promise<TriggerResult> {
  try {
    const { data, error } = await supabase
      .from('va_tasks')
      .insert({
        task_type: 'manual_call',
        description: `Follow-up call: ${followUp.reason?.replace(/_/g, ' ')} - ${followUp.store?.name || 'Unknown Store'}`,
        priority: followUp.priority || 3,
        status: 'pending',
        store_id: followUp.store_id,
        ai_instructions: {
          source: 'follow_up_engine',
          follow_up_id: followUp.id,
          reason: followUp.reason,
          recommended_action: 'manual_call',
          context: followUp.context,
        },
      })
      .select()
      .single();

    if (error) throw error;

    // Mark follow-up as completed
    await supabase
      .from('follow_up_queue')
      .update({ status: 'completed' })
      .eq('id', followUp.id);

    return {
      success: true,
      message: 'Manual call task created for VA',
      taskId: data?.id,
    };
  } catch (error) {
    console.error('Failed to create VA call task:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create VA task',
    };
  }
}

/**
 * Create a VA task for manual text
 */
export async function triggerManualText(followUp: FollowUpQueueItem): Promise<TriggerResult> {
  try {
    const { data, error } = await supabase
      .from('va_tasks')
      .insert({
        task_type: 'manual_text',
        description: `Follow-up text: ${followUp.reason?.replace(/_/g, ' ')} - ${followUp.store?.name || 'Unknown Store'}`,
        priority: followUp.priority || 3,
        status: 'pending',
        store_id: followUp.store_id,
        ai_instructions: {
          source: 'follow_up_engine',
          follow_up_id: followUp.id,
          reason: followUp.reason,
          recommended_action: 'manual_text',
          context: followUp.context,
        },
      })
      .select()
      .single();

    if (error) throw error;

    // Mark follow-up as completed
    await supabase
      .from('follow_up_queue')
      .update({ status: 'completed' })
      .eq('id', followUp.id);

    return {
      success: true,
      message: 'Manual text task created for VA',
      taskId: data?.id,
    };
  } catch (error) {
    console.error('Failed to create VA text task:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create VA task',
    };
  }
}

/**
 * Main trigger function - routes to correct handler based on recommended action
 */
export async function triggerFollowUp(followUp: FollowUpQueueItem): Promise<TriggerResult> {
  switch (followUp.recommended_action) {
    case 'ai_call':
      return triggerAICall(followUp);
    case 'ai_text':
      return triggerAIText(followUp);
    case 'manual_call':
      return triggerManualCall(followUp);
    case 'manual_text':
      return triggerManualText(followUp);
    default:
      return {
        success: false,
        message: `Unknown action type: ${followUp.recommended_action}`,
      };
  }
}
