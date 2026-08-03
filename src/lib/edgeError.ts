import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * supabase.functions.invoke() collapses every non-2xx response into the generic
 * "Edge Function returned a non-2xx status code" message, which is what made
 * real Twilio/Bland call failures look like nothing happened. This pulls the
 * actual error body off the response so the UI can show the provider's reason.
 */
export async function readEdgeError(error: unknown, fallback = "Unknown error"): Promise<string> {
  if (!error) return fallback;
  if (error instanceof FunctionsHttpError) {
    try {
      const text = await error.context.text();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          return parsed?.error || parsed?.message || text;
        } catch {
          return text;
        }
      }
    } catch {
      /* fall through */
    }
  }
  return (error as any)?.message || fallback;
}
