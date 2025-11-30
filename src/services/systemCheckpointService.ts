// src/services/systemCheckpointService.ts
import departmentRegistry from '@/modules/RegisterDepartments';
import type { ModuleDiagnostics } from '@/modules/RegisterDepartments';

const STORAGE_KEY = 'dynasty_os_system_checkpoints_v1';

export interface SystemCheckpoint {
  id: string;
  label: string;
  createdAt: string;
  diagnostics: ModuleDiagnostics;
  notes?: string;
  version?: string;
}

function loadAllCheckpoints(): SystemCheckpoint[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SystemCheckpoint[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.error('[SystemCheckpoint] Failed to load checkpoints', err);
    return [];
  }
}

function saveAllCheckpoints(checkpoints: SystemCheckpoint[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checkpoints));
  } catch (err) {
    console.error('[SystemCheckpoint] Failed to save checkpoints', err);
  }
}

/**
 * Capture the current Dynasty OS module diagnostics as a checkpoint payload
 */
export function captureCurrentDiagnostics(): ModuleDiagnostics {
  return departmentRegistry.getDiagnostics();
}

/**
 * Create and persist a new checkpoint
 */
export function createCheckpoint(label = 'Auto Checkpoint', notes?: string): SystemCheckpoint {
  const diagnostics = captureCurrentDiagnostics();

  const checkpoint: SystemCheckpoint = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    createdAt: new Date().toISOString(),
    diagnostics,
    notes,
    version: '1.0.0',
  };

  const existing = loadAllCheckpoints();
  // Keep only the last 20, plus new one
  const next = [checkpoint, ...existing].slice(0, 20);
  saveAllCheckpoints(next);

  console.log('💾 Dynasty OS checkpoint saved:', checkpoint);
  return checkpoint;
}

/**
 * Return all checkpoints, newest first
 */
export function getCheckpoints(): SystemCheckpoint[] {
  return loadAllCheckpoints();
}

/**
 * Get the latest checkpoint if any
 */
export function getLatestCheckpoint(): SystemCheckpoint | null {
  const all = loadAllCheckpoints();
  return all.length > 0 ? all[0] : null;
}

/**
 * "Reset" here means:
 * - we return the last diagnostics so the UI can show them
 * - you can optionally plug this into a more advanced restore system later
 */
export function restoreLatestCheckpoint(): SystemCheckpoint | null {
  const latest = getLatestCheckpoint();
  if (!latest) return null;

  console.log('⏪ Dynasty OS restore requested from checkpoint:', latest);
  // For now, this is read-only data. Actual "replay" of state is up to the UI.
  // This avoids doing anything dangerous automatically.
  return latest;
}

/**
 * Clear all checkpoints (if you ever need a fresh start)
 */
export function clearAllCheckpoints() {
  saveAllCheckpoints([]);
  console.log('🧹 Cleared all Dynasty OS checkpoints');
}
