// Offline-tolerant stop actions + GPS breadcrumbs. Actions get a client id up front, so a
// replay after signal returns is a no-op on the server (route_stop_action is idempotent).
import { supabase } from '@/integrations/supabase/client';

const Q = 'gm-route-action-queue-v1';
const G = 'gm-route-gps-buffer-v1';
const sb = supabase as any;

export interface QueuedAction {
  p_client_id: string; p_stop_id: string; p_outcome: string; p_note?: string | null; p_follow_up?: string | null;
  p_lat?: number | null; p_lng?: number | null; p_photo_path?: string | null; p_happened_at: string;
}
const read = <T,>(k: string): T[] => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const write = (k: string, v: unknown[]) => localStorage.setItem(k, JSON.stringify(v));

export const pendingActions = () => read<QueuedAction>(Q);

/** Send now; if offline / network fails, keep it queued. Server errors (bad access etc.) are thrown. */
export async function submitAction(a: Omit<QueuedAction, 'p_client_id' | 'p_happened_at'>): Promise<{ queued: boolean; data?: any }> {
  const full: QueuedAction = { ...a, p_client_id: crypto.randomUUID(), p_happened_at: new Date().toISOString() };
  if (!navigator.onLine) { write(Q, [...read<QueuedAction>(Q), full]); return { queued: true }; }
  try {
    const { data, error } = await sb.rpc('route_stop_action', full);
    if (error) throw Object.assign(new Error(error.message), { server: true });
    return { queued: false, data };
  } catch (e: any) {
    if (e?.server) throw e;
    write(Q, [...read<QueuedAction>(Q), full]);
    return { queued: true };
  }
}

let flushing = false;
export async function flushActions(): Promise<{ sent: number; failed: string[] }> {
  if (flushing || !navigator.onLine) return { sent: 0, failed: [] };
  flushing = true; let sent = 0; const failed: string[] = [];
  try {
    for (const a of read<QueuedAction>(Q)) {
      const { error } = await sb.rpc('route_stop_action', a);
      if (error && /fetch|network/i.test(error.message)) break;
      if (error) failed.push(error.message);
      write(Q, read<QueuedAction>(Q).filter((x) => x.p_client_id !== a.p_client_id));
      if (!error) sent++;
    }
  } finally { flushing = false; }
  return { sent, failed };
}

export function bufferGps(lat: number, lng: number, accuracy: number | null) {
  const buf = read<any>(G);
  const lastAt = buf.length ? new Date(buf[buf.length - 1].at).getTime() : 0;
  if (Date.now() - lastAt < 45_000) return; // at most ~1 point per 45s
  write(G, [...buf.slice(-1500), { lat, lng, accuracy, at: new Date().toISOString() }]);
}
export async function flushGps() {
  if (!navigator.onLine) return 0;
  const buf = read<any>(G); if (!buf.length) return 0;
  const batch = buf.slice(0, 500);
  const { data, error } = await sb.rpc('route_log_gps', { p_points: batch });
  if (error) return 0;
  write(G, read<any>(G).slice(batch.length));
  return data as number;
}
