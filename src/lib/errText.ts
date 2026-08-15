/**
 * MIRRORED FILE — two copies, one source of truth.
 *
 *   canonical : supabase/functions/_shared/errText.ts   (edit this one)
 *   generated : src/lib/errText.ts                      (do not edit)
 *
 * The Deno edge runtime cannot import from src/, and the browser bundle cannot
 * import a .ts path with an extension, so the same code has to exist twice.
 * `npm run sync:errtext` regenerates the mirror from the canonical file; the
 * prebuild step runs the same script in --check mode and fails the build if
 * the two have drifted. Do not hand-edit the mirror — it will be overwritten.
 */

/**
 * errText — one legible string for any thrown value. Never throws.
 *
 * Supabase/Postgrest rejections are plain objects, not Errors, so the common
 * `err instanceof Error ? err.message : String(err)` pattern collapses them
 * into "[object Object]" and hides the actual database error. This does not.
 *
 *   PostgrestError     -> "message (code 23505) | details: ... | hint: ..."
 *   Stripe error       -> "[stripe card_error/card_declined decline_code=...] message"
 *   FunctionsHttpError -> "[edge 402] Edge Function returned a non-2xx status code"
 *                         (use errTextAsync to also pull the response body)
 *   Error              -> "Name: message\n<stack>"
 *   string             -> itself
 *   anything else      -> JSON, truncated, never "[object Object]"
 *
 * Two hard rules:
 *  1. It must never throw. A helper that fails inside a catch block turns a
 *     logged error into a lost one. The whole body is wrapped.
 *  2. Output is capped and says so — "… [truncated, N chars total]" — rather
 *     than silently cutting a row or a stack into a 40KB log line.
 */

export const ERR_TEXT_MAX = 2000;

export function errText(err: unknown, max: number = ERR_TEXT_MAX): string {
  try {
    return truncate(build(err), max);
  } catch (helperFailure) {
    // Last resort: never let the helper swallow the original error.
    try {
      return `[errText failed: ${String((helperFailure as any)?.message ?? helperFailure)}] ${Object.prototype.toString.call(err)}`;
    } catch {
      return "[errText failed]";
    }
  }
}

/**
 * Async companion for supabase.functions.invoke() rejections. FunctionsHttpError
 * hides the real cause in error.context (a Response); reading it requires an
 * await, so it cannot happen inside the sync errText. Everything else falls
 * straight through to errText.
 */
export async function errTextAsync(err: unknown, max: number = ERR_TEXT_MAX): Promise<string> {
  try {
    const ctx = (err as any)?.context;
    if (ctx && typeof ctx.text === "function") {
      const status = ctx.status ?? "?";
      let body = "";
      try {
        body = await ctx.text();
      } catch {
        body = "";
      }
      let detail: unknown = body;
      if (body) {
        try {
          const parsed = JSON.parse(body);
          detail = parsed?.error ?? parsed?.message ?? parsed?.errors ?? parsed;
        } catch {
          /* not JSON — keep raw */
        }
      }
      const rendered = typeof detail === "string" ? detail : stringify(detail);
      return truncate(`[edge ${status}] ${rendered || "(empty body)"}`, max);
    }
  } catch {
    /* fall through to sync rendering */
  }
  return errText(err, max);
}

function build(err: unknown): string {
  if (err === null) return "null";
  if (err === undefined) return "undefined";
  if (typeof err === "string") return err;
  if (typeof err !== "object") return String(err);

  const e = err as Record<string, unknown>;

  // Stripe: { type: 'StripeCardError' | 'card_error', code, decline_code, message }
  const stripeType = typeof e.type === "string" ? e.type : "";
  const looksStripe =
    stripeType.startsWith("Stripe") ||
    stripeType.endsWith("_error") ||
    (typeof e.rawType === "string" && !!e.rawType) ||
    ("decline_code" in e && e.decline_code != null);
  if (looksStripe) {
    const tags = [stripeType || String(e.rawType ?? "stripe_error")];
    if (e.code != null && e.code !== "") tags.push(`code=${String(e.code)}`);
    if (e.decline_code != null && e.decline_code !== "") tags.push(`decline_code=${String(e.decline_code)}`);
    if (e.statusCode != null) tags.push(`status=${String(e.statusCode)}`);
    const msg = typeof e.message === "string" ? e.message : stringify(err);
    return `[stripe ${tags.join(" ")}] ${msg}`;
  }

  // FunctionsHttpError: the wrapper message is useless on its own; at minimum
  // surface the status. errTextAsync pulls the body.
  const ctx = e.context as { status?: unknown } | undefined;
  if (ctx && typeof ctx === "object" && "status" in ctx) {
    const msg = typeof e.message === "string" ? e.message : "edge function error";
    return `[edge ${String(ctx.status ?? "?")}] ${msg} (body not read — use errTextAsync)`;
  }

  if (err instanceof Error) {
    const head = `${err.name}: ${err.message}`;
    const extra = renderCause(e.cause);
    const stack = typeof err.stack === "string" && err.stack ? `\n${err.stack}` : "";
    return `${head}${extra}${stack}`;
  }

  // PostgrestError shape: { message, code, details, hint }. The code is the
  // useful part — 23505 names the failure class, "duplicate key value" doesn't.
  const hasPgShape =
    typeof e.message === "string" && ("code" in e || "details" in e || "hint" in e);
  if (hasPgShape) {
    let out = String(e.message);
    if (e.code != null && e.code !== "") out += ` (code ${String(e.code)})`;
    if (e.details != null && e.details !== "") out += ` | details: ${stringify(e.details)}`;
    if (e.hint != null && e.hint !== "") out += ` | hint: ${stringify(e.hint)}`;
    return out;
  }

  if (typeof e.message === "string" && e.message) return e.message;

  return stringify(err);
}

function renderCause(cause: unknown): string {
  if (cause === null || cause === undefined) return "";
  try {
    const rendered = typeof cause === "string" ? cause : build(cause);
    return rendered ? ` | cause: ${rendered.split("\n")[0]}` : "";
  } catch {
    return "";
  }
}

function truncate(value: string, max: number): string {
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : ERR_TEXT_MAX;
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}… [truncated, ${value.length} chars total]`;
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  const seen = new WeakSet<object>();
  try {
    return (
      JSON.stringify(value, (_k, v) => {
        if (typeof v === "object" && v !== null) {
          if (seen.has(v as object)) return "[Circular]";
          seen.add(v as object);
        }
        if (typeof v === "bigint") return v.toString();
        if (typeof v === "function") return "[Function]";
        return v;
      }) ?? String(value)
    );
  } catch {
    try {
      return String(value);
    } catch {
      return "[unserializable]";
    }
  }
}
