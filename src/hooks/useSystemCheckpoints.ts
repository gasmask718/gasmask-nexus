// src/hooks/useSystemCheckpoints.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createCheckpoint,
  getCheckpoints,
  getLatestCheckpoint,
  restoreLatestCheckpoint,
  clearAllCheckpoints,
  SystemCheckpoint,
} from '@/services/systemCheckpointService';
import { saveCheckpointToCloud, fetchCloudCheckpoints, CloudCheckpointRecord } from '@/services/cloudCheckpointService';
import { useAuth } from '@/contexts/AuthContext';
import departmentRegistry from '@/modules/RegisterDepartments';

export interface UseSystemCheckpointsResult {
  checkpoints: SystemCheckpoint[];
  latestCheckpoint: SystemCheckpoint | null;
  isAutoSaving: boolean;
  lastAutoSaveAt: string | null;
  cloudCheckpoints: CloudCheckpointRecord[];
  isSyncingCloud: boolean;

  // actions
  saveManualCheckpoint: (label?: string, notes?: string) => void;
  triggerAutoCheckpoint: () => void;
  restoreLast: () => SystemCheckpoint | null;
  clearAll: () => void;
  syncFromCloud: () => Promise<void>;
}

/**
 * Auto-saves Dynasty OS diagnostics every N minutes (admin-only via Layout)
 * Now with cloud backup support
 */
export function useSystemCheckpoints(autoIntervalMinutes = 10): UseSystemCheckpointsResult {
  const { user } = useAuth();
  const ownerId = user?.id;
  
  const [checkpoints, setCheckpoints] = useState<SystemCheckpoint[]>(() => getCheckpoints());
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(true);
  const [cloudCheckpoints, setCloudCheckpoints] = useState<CloudCheckpointRecord[]>([]);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const latestCheckpoint = useMemo(
    () => (checkpoints.length > 0 ? checkpoints[0] : null),
    [checkpoints]
  );

  const refresh = useCallback(() => {
    setCheckpoints(getCheckpoints());
  }, []);

  const saveManualCheckpoint = useCallback(
    async (label?: string, notes?: string) => {
      const cp = createCheckpoint(label, notes);
      setCheckpoints(prev => [cp, ...prev]);

      // Cloud backup
      if (ownerId) {
        saveCheckpointToCloud(cp, ownerId);
      }
    },
    [ownerId]
  );

  const triggerAutoCheckpoint = useCallback(() => {
    const cp = createCheckpoint('Auto Checkpoint');
    setCheckpoints(prev => [cp, ...prev]);
    setLastAutoSaveAt(cp.createdAt);

    // Cloud backup
    if (ownerId) {
      saveCheckpointToCloud(cp, ownerId);
    }
  }, [ownerId]);

  const restoreLast = useCallback(() => {
    const restored = restoreLatestCheckpoint();
    return restored;
  }, []);

  const clearAll = useCallback(() => {
    clearAllCheckpoints();
    setCheckpoints([]);
    setLastAutoSaveAt(null);
  }, []);

  const syncFromCloud = useCallback(async () => {
    if (!ownerId) return;
    setIsSyncingCloud(true);
    try {
      const cloudData = await fetchCloudCheckpoints(ownerId);
      setCloudCheckpoints(cloudData);
      console.log('☁️ Synced', cloudData.length, 'checkpoints from cloud');
    } catch (err) {
      console.error('Failed to sync from cloud:', err);
    } finally {
      setIsSyncingCloud(false);
    }
  }, [ownerId]);

  useEffect(() => {
    if (!isAutoSaving) return;
    const intervalMs = autoIntervalMinutes * 60 * 1000;

    const id = setInterval(() => {
      // tiny safety check: only save if there is at least one module registered
      const diagnostics = departmentRegistry.getDiagnostics();
      if (diagnostics.totalModules > 0) {
        triggerAutoCheckpoint();
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [isAutoSaving, autoIntervalMinutes, triggerAutoCheckpoint]);

  // Initial cloud sync - only run once when ownerId is set
  useEffect(() => {
    if (ownerId) {
      syncFromCloud();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]); // Intentionally exclude syncFromCloud to prevent re-runs

  return {
    checkpoints,
    latestCheckpoint,
    isAutoSaving,
    lastAutoSaveAt,
    cloudCheckpoints,
    isSyncingCloud,
    saveManualCheckpoint,
    triggerAutoCheckpoint,
    restoreLast,
    clearAll,
    syncFromCloud,
  };
}

export default useSystemCheckpoints;
