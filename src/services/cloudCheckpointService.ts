// src/services/cloudCheckpointService.ts
import { supabase } from '@/integrations/supabase/client';
import type { SystemCheckpoint } from '@/services/systemCheckpointService';
import type { Json } from '@/integrations/supabase/types';

export interface CloudCheckpointRecord {
  id: string;
  owner_id: string;
  checkpoint_type: string;
  label: string | null;
  notes: string | null;
  snapshot_data: Json;
  created_at: string;
}

export async function saveCheckpointToCloud(
  checkpoint: SystemCheckpoint,
  ownerId: string
): Promise<CloudCheckpointRecord | null> {
  try {
    const { data, error } = await supabase
      .from('cloud_checkpoints')
      .insert([{
        owner_id: ownerId,
        checkpoint_type: checkpoint.label?.includes('Auto') ? 'auto' : 'manual',
        label: checkpoint.label ?? null,
        notes: checkpoint.notes ?? null,
        snapshot_data: JSON.parse(JSON.stringify(checkpoint.diagnostics)) as Json,
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to save checkpoint to cloud:', error.message);
      return null;
    }

    console.log('☁️ Saved checkpoint to cloud:', data.id);
    return data as CloudCheckpointRecord;
  } catch (err) {
    console.error('❌ Cloud checkpoint error:', err);
    return null;
  }
}

export async function fetchCloudCheckpoints(
  ownerId: string
): Promise<CloudCheckpointRecord[]> {
  const { data, error } = await supabase
    .from('cloud_checkpoints')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('❌ Failed to fetch cloud checkpoints:', error.message);
    return [];
  }

  return (data as CloudCheckpointRecord[]) ?? [];
}

export async function deleteCloudCheckpoint(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('cloud_checkpoints')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('❌ Failed to delete cloud checkpoint:', error.message);
    return false;
  }

  console.log('🗑️ Deleted cloud checkpoint:', id);
  return true;
}
