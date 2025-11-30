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
import departmentRegistry from '@/modules/RegisterDepartments';

export interface UseSystemCheckpointsResult {
  checkpoints: SystemCheckpoint[];
  latestCheckpoint: SystemCheckpoint | null;
  isAutoSaving: boolean;
  lastAutoSaveAt: string | null;

  // actions
  saveManualCheckpoint: (label?: string, notes?: string) => void;
  triggerAutoCheckpoint: () => void;
  restoreLast: () => SystemCheckpoint | null;
  clearAll: () => void;
}

/**
 * Auto-saves Dynasty OS diagnostics every N minutes (admin-only via Layout)
 */
export function useSystemCheckpoints(autoIntervalMinutes = 10): UseSystemCheckpointsResult {
  const [checkpoints, setCheckpoints] = useState<SystemCheckpoint[]>(() => getCheckpoints());
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(true);

  const latestCheckpoint = useMemo(
    () => (checkpoints.length > 0 ? checkpoints[0] : null),
    [checkpoints]
  );

  const refresh = useCallback(() => {
    setCheckpoints(getCheckpoints());
  }, []);

  const saveManualCheckpoint = useCallback(
    (label?: string, notes?: string) => {
      const cp = createCheckpoint(label, notes);
      setCheckpoints(prev => [cp, ...prev]);
    },
    []
  );

  const triggerAutoCheckpoint = useCallback(() => {
    const cp = createCheckpoint('Auto Checkpoint');
    setCheckpoints(prev => [cp, ...prev]);
    setLastAutoSaveAt(cp.createdAt);
  }, []);

  const restoreLast = useCallback(() => {
    const restored = restoreLatestCheckpoint();
    return restored;
  }, []);

  const clearAll = useCallback(() => {
    clearAllCheckpoints();
    setCheckpoints([]);
    setLastAutoSaveAt(null);
  }, []);

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

  return {
    checkpoints,
    latestCheckpoint,
    isAutoSaving,
    lastAutoSaveAt,
    saveManualCheckpoint,
    triggerAutoCheckpoint,
    restoreLast,
    clearAll,
  };
}

export default useSystemCheckpoints;
