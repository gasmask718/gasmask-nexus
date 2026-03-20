import { supabase } from '@/integrations/supabase/client';

export interface VisitTriggerPayload {
  store_id?: string;
  store_name: string;
  store_address?: string;
  store_city?: string;
  store_state?: string;
  store_phone?: string;
  trigger_source: string;
  trigger_type:
    | 'restock' | 'urgent_visit' | 'follow_up' | 'audit'
    | 'prospecting' | 'first_visit' | 'pickup' | 'complaint'
    | 'escalation' | 'ai_flag' | 'merchandising' | 'compliance'
    | 'collection' | 'training' | 'other';
  floor_source:
    | 'floor1_crm' | 'floor2_inventory' | 'floor3_comms'
    | 'floor4_delivery' | 'floor5_territory' | 'floor9_ai_ops'
    | 'penthouse' | 'manual';
  urgency?: 'critical' | 'high' | 'normal' | 'low';
  priority_score?: number;
  trigger_notes?: string;
  source_record_id?: string;
  source_record_type?: string;
}

export async function fireVisitTrigger(
  payload: VisitTriggerPayload
): Promise<{ success: boolean; id?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('gasmask-route-agent', {
      body: { action: 'create_trigger', ...payload },
    });
    if (error) throw error;
    return { success: true, id: data?.trigger?.id };
  } catch (err: any) {
    console.error('[visitTrigger]', err.message);
    return { success: false };
  }
}
