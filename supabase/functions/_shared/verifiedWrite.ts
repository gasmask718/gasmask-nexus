// ═══════════════════════════════════════════════════════════════════════════
// VERIFIED WRITE (edge runtime) — Deno mirror of src/lib/verifiedMutation.ts
// ═══════════════════════════════════════════════════════════════════════════
//
// Same bug class: PostgREST answers an RLS-rejected write with 204 / zero rows
// and `error === null`. Every `if (error)` guard passes and the caller believes
// the row landed. Forcing `.select()` makes the affected-row count observable.
//
// Usage (identical calling convention to the frontend helper):
//
//   await verifiedInsert(supabase, 'log ambassador SMS', (c) =>
//     c.from('ambassador_activity_log').insert({ ... })
//   );
//
// Throws VerifiedWriteError on a db error OR on zero rows affected.
// ═══════════════════════════════════════════════════════════════════════════

export class VerifiedWriteError extends Error {
  readonly kind: "db_error" | "zero_rows";
  readonly operation: string;
  readonly cause?: unknown;

  constructor(args: {
    kind: "db_error" | "zero_rows";
    operation: string;
    message: string;
    cause?: unknown;
  }) {
    super(args.message);
    this.name = "VerifiedWriteError";
    this.kind = args.kind;
    this.operation = args.operation;
    this.cause = args.cause;
  }
}

// deno-lint-ignore no-explicit-any
type AnyClient = any;

async function runVerified(
  client: AnyClient,
  operation: string,
  build: (c: AnyClient) => AnyClient,
  opts?: { allowZeroRows?: boolean },
): Promise<unknown[]> {
  const { data, error, count } = await build(client).select("*", { count: "exact" });

  if (error) {
    console.error(`[VERIFIED_WRITE:${operation}] db error`, error);
    throw new VerifiedWriteError({
      kind: "db_error",
      operation,
      message: `"${operation}" failed: ${error.message ?? "database error"}`,
      cause: error,
    });
  }

  const rows: unknown[] = data ?? [];
  const affected = count ?? rows.length;

  if (affected === 0 && !opts?.allowZeroRows) {
    console.error(
      `[VERIFIED_WRITE:${operation}] wrote 0 rows — the database accepted the ` +
        `request but no row matched. Almost always an RLS policy rejection, a ` +
        `missing GRANT, or a target row that does not exist.`,
    );
    throw new VerifiedWriteError({
      kind: "zero_rows",
      operation,
      message:
        `"${operation}" did not change any records (0 rows). Nothing was saved.`,
    });
  }

  return rows;
}

export function verifiedInsert<T = unknown>(
  client: AnyClient,
  operation: string,
  build: (c: AnyClient) => AnyClient,
): Promise<T[]> {
  return runVerified(client, operation, build) as Promise<T[]>;
}

export function verifiedUpdate<T = unknown>(
  client: AnyClient,
  operation: string,
  build: (c: AnyClient) => AnyClient,
  opts?: { allowZeroRows?: boolean },
): Promise<T[]> {
  return runVerified(client, operation, build, opts) as Promise<T[]>;
}

export function verifiedDelete<T = unknown>(
  client: AnyClient,
  operation: string,
  build: (c: AnyClient) => AnyClient,
  opts?: { allowZeroRows?: boolean },
): Promise<T[]> {
  return runVerified(client, operation, build, opts) as Promise<T[]>;
}

/** Non-throwing variant for fire-and-forget logging paths that must not break
 *  the caller, but must still surface a loud, greppable failure. */
export async function verifiedInsertSoft(
  client: AnyClient,
  operation: string,
  build: (c: AnyClient) => AnyClient,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await runVerified(client, operation, build);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[VERIFIED_WRITE_SOFT:${operation}] ${msg}`);
    return { ok: false, error: msg };
  }
}
