// src/hooks/useVersionControl.ts
import { useCallback, useMemo, useState } from 'react';
import {
  createVersion,
  getVersions,
  getLatestVersion,
  restoreVersion,
  clearAllVersions,
  VersionRecord,
  diffVersions,
} from '@/services/versionControlService';

export function useVersionControl() {
  const [versions, setVersions] = useState<VersionRecord[]>(() => getVersions());
  const latest = useMemo(() => getLatestVersion(), []);

  const refresh = useCallback(() => {
    setVersions(getVersions());
  }, []);

  const saveVersion = useCallback(
    (label: string, opts?: { notes?: string; tag?: string }) => {
      const v = createVersion(label, {
        notes: opts?.notes,
        tag: opts?.tag,
        type: 'manual',
      });
      setVersions(prev => [v, ...prev]);
      return v;
    },
    []
  );

  const restore = useCallback((id: string) => {
    return restoreVersion(id);
  }, []);

  const clearAll = useCallback(() => {
    clearAllVersions();
    setVersions([]);
  }, []);

  const compare = useCallback((aId: string, bId: string) => {
    const list = getVersions();
    const a = list.find(v => v.meta.id === aId);
    const b = list.find(v => v.meta.id === bId);
    if (!a || !b) return null;
    return diffVersions(a, b);
  }, []);

  return {
    versions,
    latest,
    refresh,
    saveVersion,
    restore,
    clearAll,
    compare,
  };
}

export default useVersionControl;
