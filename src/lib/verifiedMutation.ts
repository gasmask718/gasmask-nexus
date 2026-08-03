// ═══════════════════════════════════════════════════════════════════════════════
// VERIFIED MUTATION — Guarantees a write actually wrote something
// ═══════════════════════════════════════════════════════════════════════════════
//
// THE BUG CLASS THIS EXISTS TO KILL:
//
//   const { error } = await supabase.from('stores')
//     .update({ sells_flowers: true }).eq('id', storeId);
//   if (error) throw error;          // <-- never fires
//   toast.success('Saved!');         // <-- lies
//
// When an RLS policy rejects the row, PostgREST does NOT return an error. It
// returns 204 No Content with zero rows affected. `error` is null. Every
// `if (error)` guard in the codebase passes, and the UI reports success for a
// write that never happened.
//
// Audit (2026-08-03): 1,307 update/delete call sites across 622 files perform
// no result check whatsoever. This wrapper is the shared fix.
//
// USAGE — the only change needed at a call site is wrapping the builder:
//
//   await verifiedUpdate('mark store as flower seller', () =>
//     supabase.from('store_master')
//       .update({ sells_flowers: true })
//       .eq('id', storeId)
//   );
//
// Throws a VerifiedMutationError on:
//   - a real Postgres/PostgREST error
//   - zero rows affected (the silent-loss case)
//
// ═══════════════════════════════════════════════════════════════════════════════

import { parseRLSError } from './rls-error-handler';

export class VerifiedMutationError extends Error {
  readonly kind: 'db_error' | 'zero_rows';
  readonly operation: string;
  readonly title: string;
  readonly cause?: unknown;

  constructor(args: {
    kind: 'db_error' | 'zero_rows';
    operation: string;
    title: string;
    message: string;
    cause?: unknown;
  }) {
    super(args.message);
    this.name = 'VerifiedMutationError';
    this.kind = args.kind;
    this.operation = args.operation;
    this.title = args.title;
    this.cause = args.cause;
  }
}

/**
 * Anything with a `.select()` that resolves to `{ data, error, count }`.
 * Matches a PostgrestFilterBuilder without importing supabase-js internals.
 */
interface SelectableBuilder {
  select: (columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated' }) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string; code?: string; details?: string | null } | null;
    count: number | null;
  }>;
}

async function runVerified<B extends SelectableBuilder>(
  operation: string,
  buildQuery: () => B,
  opts?: { allowZeroRows?: boolean },
): Promise<{ rows: unknown[]; count: number }> {
  const builder = buildQuery();

  // Forcing `.select()` is what makes the row count observable at all.
  // Without it PostgREST replies 204 and the client cannot tell a successful
  // no-op from an RLS rejection.
  const { data, error, count } = await builder.select('*', { count: 'exact' });

  if (error) {
    const parsed = parseRLSError(error);
    console.error(`[VERIFIED_MUTATION:${operation}] db error`, error);
    throw new VerifiedMutationError({
      kind: 'db_error',
      operation,
      title: parsed.title,
      message: parsed.description,
      cause: error,
    });
  }

  const rows = data ?? [];
  const affected = count ?? rows.length;

  if (affected === 0 && !opts?.allowZeroRows) {
    console.error(
      `[VERIFIED_MUTATION:${operation}] wrote 0 rows — the database accepted the ` +
        `request but no row matched, which almost always means an RLS policy ` +
        `rejected it or the target row does not exist.`,
    );
    throw new VerifiedMutationError({
      kind: 'zero_rows',
      operation,
      title: 'Nothing was saved',
      message:
        `"${operation}" did not change any records. You may not have permission ` +
        `to edit this, or the record no longer exists. Nothing was saved — please ` +
        `retry or contact an admin.`,
    });
  }

  return { rows, count: affected };
}

/** UPDATE that throws if zero rows were changed. */
export async function verifiedUpdate<T = unknown>(
  operation: string,
  buildQuery: () => SelectableBuilder,
  opts?: { allowZeroRows?: boolean },
): Promise<T[]> {
  const { rows } = await runVerified(operation, buildQuery, opts);
  return rows as T[];
}

/** DELETE that throws if zero rows were removed. */
export async function verifiedDelete<T = unknown>(
  operation: string,
  buildQuery: () => SelectableBuilder,
  opts?: { allowZeroRows?: boolean },
): Promise<T[]> {
  const { rows } = await runVerified(operation, buildQuery, opts);
  return rows as T[];
}

/** INSERT that throws if the row was not persisted. */
export async function verifiedInsert<T = unknown>(
  operation: string,
  buildQuery: () => SelectableBuilder,
): Promise<T[]> {
  const { rows } = await runVerified(operation, buildQuery);
  return rows as T[];
}

/**
 * Toast-friendly message extraction, so call sites can surface the real reason
 * instead of a generic "failed".
 */
export function mutationErrorMessage(err: unknown): string {
  if (err instanceof VerifiedMutationError) return err.message;
  if (err instanceof Error) return parseRLSError(err).description;
  return 'Something went wrong. Please try again.';
}
