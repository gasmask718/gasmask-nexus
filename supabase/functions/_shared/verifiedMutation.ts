// Deno port of src/lib/verifiedMutation.ts — same contract:
// forces .select('*', { count: 'exact' }) so a 204/zero-row write can never
// masquerade as success.

export class VerifiedMutationError extends Error {
  readonly kind: "db_error" | "zero_rows";
  readonly operation: string;
  constructor(args: { kind: "db_error" | "zero_rows"; operation: string; message: string }) {
    super(args.message);
    this.name = "VerifiedMutationError";
    this.kind = args.kind;
    this.operation = args.operation;
  }
}

interface SelectableBuilder {
  select: (
    columns?: string,
    options?: { count?: "exact" | "planned" | "estimated" },
  ) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
    count: number | null;
  }>;
}

export async function verifiedUpdate<T = unknown>(
  operation: string,
  buildQuery: () => SelectableBuilder,
): Promise<T[]> {
  const { data, error, count } = await buildQuery().select("*", { count: "exact" });

  if (error) {
    throw new VerifiedMutationError({
      kind: "db_error",
      operation,
      message: `${operation}: ${error.message}`,
    });
  }

  const rows = data ?? [];
  const affected = count ?? rows.length;

  if (affected === 0) {
    throw new VerifiedMutationError({
      kind: "zero_rows",
      operation,
      message: `"${operation}" changed 0 rows — no matching record, or a policy rejected the write.`,
    });
  }

  return rows as T[];
}
