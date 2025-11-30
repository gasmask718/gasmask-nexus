// src/services/versionControlService.ts
import { getModuleDiagnostics } from '@/modules';
import { getNavigationSnapshot } from '@/services/navigationSnapshotService';

const STORAGE_KEY = 'dynasty_os_versions_v1';

export interface VersionMetadata {
  id: string;
  label: string;
  createdAt: string;
  createdBy?: string;
  notes?: string;
  // semantic flags
  type: 'manual' | 'auto' | 'system';
  tag?: string; // e.g. "pre-refactor", "post-launch"
}

export interface VersionPayload {
  diagnostics: ReturnType<typeof getModuleDiagnostics>;
  navSnapshot: ReturnType<typeof getNavigationSnapshot>;
}

export interface VersionRecord {
  meta: VersionMetadata;
  payload: VersionPayload;
}

function loadVersions(): VersionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VersionRecord[];
    return parsed.sort(
      (a, b) =>
        new Date(b.meta.createdAt).getTime() - new Date(a.meta.createdAt).getTime()
    );
  } catch (err) {
    console.error('Failed to load Dynasty OS versions:', err);
    return [];
  }
}

function saveVersions(versions: VersionRecord[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
}

export function createVersion(
  label: string,
  options?: { notes?: string; type?: VersionMetadata['type']; tag?: string; createdBy?: string }
): VersionRecord {
  const now = new Date().toISOString();

  // Build payload from live OS
  const diagnostics = getModuleDiagnostics();
  const navSnapshot = getNavigationSnapshot();

  const version: VersionRecord = {
    meta: {
      id: `v_${now}_${Math.random().toString(36).slice(2, 8)}`,
      label,
      createdAt: now,
      type: options?.type || 'manual',
      tag: options?.tag,
      notes: options?.notes,
      createdBy: options?.createdBy,
    },
    payload: {
      diagnostics,
      navSnapshot,
    },
  };

  const existing = loadVersions();
  const updated = [version, ...existing].slice(0, 100); // keep last 100
  saveVersions(updated);

  console.log('📌 Dynasty OS version created:', version.meta);
  return version;
}

export function getVersions(): VersionRecord[] {
  return loadVersions();
}

export function getLatestVersion(): VersionRecord | null {
  const all = loadVersions();
  return all[0] ?? null;
}

/**
 * "Restore" here is logical – it returns the version record
 * so you or a dev can realign navigation / modules to this snapshot.
 * We do NOT mutate routes at runtime.
 */
export function restoreVersion(id: string): VersionRecord | null {
  const all = loadVersions();
  const found = all.find(v => v.meta.id === id) ?? null;
  if (!found) return null;

  console.log('⏪ Dynasty OS restore requested for version:', found.meta);
  return found;
}

/**
 * Very simple diff: shows route & module count changes between two versions.
 * You can extend this later to a full-blown diff UI.
 */
export function diffVersions(a: VersionRecord, b: VersionRecord) {
  const dA = a.payload.diagnostics;
  const dB = b.payload.diagnostics;

  return {
    modulesDiff: dB.totalModules - dA.totalModules,
    routesDiff: dB.totalRoutes - dA.totalRoutes,
    sidebarDiff: dB.totalSidebarItems - dA.totalSidebarItems,
    aModules: dA.moduleList.map(m => m.basePath),
    bModules: dB.moduleList.map(m => m.basePath),
  };
}

export function clearAllVersions() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
  console.log('🧹 Cleared all Dynasty OS version history');
}
