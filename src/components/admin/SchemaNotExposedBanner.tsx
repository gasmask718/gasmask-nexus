import { AlertCircle } from "lucide-react";

/**
 * Shown on any Dynasty Partners admin page that performs writes.
 * Renders unconditionally as a persistent reminder — once David adds
 * `partners` to Supabase exposed schemas, writes stop erroring and this
 * banner becomes a no-op reminder that can be removed at will.
 */
export function SchemaNotExposedBanner() {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-6 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-semibold text-amber-300 text-sm">
          Partners schema write access
        </p>
        <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
          Read operations work via public <code>dp_*</code> wrapper views.
          Write operations (create partner, approve, record sale, payouts)
          require the <code>partners</code> schema to be added to the backend's
          exposed schemas list. If a write below fails with a{" "}
          <code>PGRST106</code> / “schema not exposed” error, that is the fix.
          The UI stays deployed and activates automatically the moment the
          schema is exposed.
        </p>
      </div>
    </div>
  );
}

export default SchemaNotExposedBanner;

/**
 * Detect the "schema not exposed" PostgREST error so callers can surface a
 * friendly toast instead of the raw error string.
 */
export function isSchemaNotExposedError(err: any): boolean {
  if (!err) return false;
  const code = err.code ?? err?.error?.code;
  const msg = String(err.message ?? err?.error?.message ?? "").toLowerCase();
  return (
    code === "PGRST106" ||
    msg.includes("schema") && (msg.includes("not exposed") || msg.includes("not found") || msg.includes("does not exist"))
  );
}
