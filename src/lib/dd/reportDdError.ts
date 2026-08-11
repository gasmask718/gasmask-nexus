import { supabase } from "@/integrations/supabase/client";

export type DdErrorSource =
  | "wholesaler-product-save"
  | "wholesaler-bulk-upload"
  | "dd-checkout-client";

/**
 * Reports a browser-side Dynasty Direct failure into dd_error_log so it lands
 * in the same monitoring + SMS escalation pipeline as the edge functions.
 * Fire-and-forget: never throws, never blocks the UI.
 */
export function reportDdError(
  source: DdErrorSource,
  message: string,
  context: Record<string, unknown> = {},
): void {
  try {
    void supabase.functions
      .invoke("dd-log-error", {
        body: {
          source,
          message: String(message ?? "unknown").slice(0, 2000),
          severity: "error",
          context: { path: window.location.pathname, ...context },
        },
      })
      .catch(() => undefined);
  } catch {
    /* monitoring must never break the path it watches */
  }
}
