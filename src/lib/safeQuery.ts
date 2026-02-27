// ═══════════════════════════════════════════════════════════════════════════════
// SAFE QUERY — Wrapper that prevents silent data failures in execution paths
// ═══════════════════════════════════════════════════════════════════════════════

export interface SafeQueryResult<T> {
  data: T;
  error: Error | null;
  failed: boolean;
}

/**
 * Wraps a Supabase query so failures are never silently swallowed.
 * Emits a custom event for execution-layer listeners.
 */
export async function safeQuery<T>(
  name: string,
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<SafeQueryResult<T>> {
  try {
    const { data, error } = await queryFn();

    if (error) {
      console.error(`[SAFE_QUERY:${name}]`, error);

      // Emit global event so execution readiness can react
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('execution:data_error', {
            detail: { source: name, error: error.message || String(error) },
          })
        );
      }

      return { data: null as unknown as T, error: new Error(error.message || String(error)), failed: true };
    }

    return { data: data as T, error: null, failed: false };
  } catch (err: any) {
    console.error(`[SAFE_QUERY:${name}] EXCEPTION`, err);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('execution:data_error', {
          detail: { source: name, error: err?.message || String(err) },
        })
      );
    }

    return { data: null as unknown as T, error: err, failed: true };
  }
}

/**
 * Normalizes a store row from DB to a consistent UI shape.
 */
export function normalizeStore(store: any): { id: string; name: string; phone: string | null; address?: string } | null {
  if (!store) return null;
  return {
    id: store.id,
    name: store.store_name ?? store.name ?? 'Unknown',
    phone: store.phone ?? null,
    address: store.address ?? undefined,
  };
}
