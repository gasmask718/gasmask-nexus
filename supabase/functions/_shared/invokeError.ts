// supabase.functions.invoke() collapses every non-2xx response into the string
// "Edge Function returned a non-2xx status code" and stashes the real body on
// error.context. That opacity is how an upstream 401/402 stayed invisible for
// days. Use this everywhere an invoke() error is logged or persisted.
export async function invokeErrorDetail(error: any): Promise<string> {
  const base = error?.message ?? 'unknown_invoke_error';
  const ctx = error?.context;
  if (!ctx || typeof ctx.text !== 'function') return base;
  try {
    const body = await ctx.text();
    if (!body) return `${base} [status ${ctx.status ?? '?'}]`;
    let detail: unknown = body;
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.error ?? parsed?.message ?? parsed?.errors ?? body;
    } catch { /* not JSON — use raw */ }
    if (typeof detail !== 'string') detail = JSON.stringify(detail);
    return `[status ${ctx.status ?? '?'}] ${String(detail).slice(0, 500)}`;
  } catch {
    return base;
  }
}
