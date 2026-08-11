/**
 * errText — one legible string for any thrown value.
 *
 * Supabase/Postgrest rejections are plain objects, not Errors, so the common
 * `err instanceof Error ? err.message : String(err)` pattern collapses them
 * into "[object Object]" and hides the actual database error. This does not.
 *
 *   PostgrestError -> "message (code 42703) | details: ... | hint: ..."
 *   Error          -> "message\n<stack>"
 *   anything else  -> JSON.stringify, with a circular-ref safe fallback
 */
export function errText(err: unknown): string {
  if (err === null) return "null";
  if (err === undefined) return "undefined";

  if (typeof err === "string") return err;
  if (typeof err !== "object") return String(err);

  const e = err as Record<string, unknown>;

  if (err instanceof Error) {
    return err.stack ? `${err.name}: ${err.message}\n${err.stack}` : `${err.name}: ${err.message}`;
  }

  // PostgrestError / PostgrestException shape: { message, code, details, hint }
  const hasPgShape =
    typeof e.message === "string" &&
    ("code" in e || "details" in e || "hint" in e);

  if (hasPgShape) {
    const parts = [String(e.message)];
    if (e.code != null && e.code !== "") parts.push(`(code ${String(e.code)})`);
    let out = parts.join(" ");
    if (e.details != null && e.details !== "") out += ` | details: ${stringify(e.details)}`;
    if (e.hint != null && e.hint !== "") out += ` | hint: ${stringify(e.hint)}`;
    return out;
  }

  if (typeof e.message === "string") return e.message;

  return stringify(err);
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_k, v) => {
      if (typeof v === "object" && v !== null) {
        if (seen.has(v as object)) return "[Circular]";
        seen.add(v as object);
      }
      if (typeof v === "bigint") return v.toString();
      return v;
    }) ?? String(value);
  } catch {
    try {
      return String(value);
    } catch {
      return "[unserializable]";
    }
  }
}
