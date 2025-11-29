// ═══════════════════════════════════════════════════════════════════════════════
// AI COMMAND LOGGING HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

export interface AiCommandLogEntry {
  inputText: string;
  parsedIntent: Record<string, unknown>;
  status: 'planned' | 'executed' | 'error';
  errorMessage?: string;
  affectedEntityType?: string;
  affectedEntityIds?: string[];
}

export interface AiCommandLog {
  id: string;
  user_id: string;
  input_text: string;
  parsed_intent: Record<string, unknown>;
  status: string;
  error_message: string | null;
  affected_entity_type: string | null;
  affected_entity_ids: string[] | null;
  created_at: string;
  executed_at: string | null;
}

export async function logAiCommand(options: AiCommandLogEntry): Promise<string | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    const { data, error } = await (supabase as any)
      .from('ai_command_logs')
      .insert({
        user_id: userId,
        input_text: options.inputText,
        parsed_intent: options.parsedIntent,
        status: options.status,
        error_message: options.errorMessage || null,
        affected_entity_type: options.affectedEntityType || null,
        affected_entity_ids: options.affectedEntityIds || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to log AI command:', error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error('Error logging AI command:', err);
    return null;
  }
}

export async function updateAiCommandStatus(
  id: string,
  status: 'planned' | 'executed' | 'error',
  errorMessage?: string,
  affectedEntityIds?: string[]
): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = { status };
    
    if (status === 'executed') {
      updateData.executed_at = new Date().toISOString();
    }
    
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }
    
    if (affectedEntityIds) {
      updateData.affected_entity_ids = affectedEntityIds;
    }

    const { error } = await (supabase as any)
      .from('ai_command_logs')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Failed to update AI command status:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error updating AI command status:', err);
    return false;
  }
}

export async function fetchUserCommandLogs(limit = 50): Promise<AiCommandLog[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('ai_command_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch command logs:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching command logs:', err);
    return [];
  }
}
