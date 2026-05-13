import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Public short-link redirect: /p/:code
 * Resolves the code via SECURITY DEFINER RPC, increments the click counter,
 * and forwards the visitor (typically an SMS recipient) to the underlying URL.
 */
export default function ShortLinkRedirect() {
  const { code } = useParams<{ code: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) {
        setError("Missing link code.");
        return;
      }
      const { data, error } = await supabase.rpc("resolve_short_link", { p_code: code });
      if (cancelled) return;
      if (error) {
        setError("This link could not be opened. Please contact the sender.");
        return;
      }
      if (!data) {
        setError("This link has expired or is invalid.");
        return;
      }
      window.location.replace(data as unknown as string);
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="text-center max-w-md">
        {error ? (
          <>
            <h1 className="text-xl font-semibold mb-2">Link unavailable</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </>
        ) : (
          <>
            <div className="mx-auto w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Opening secure link…</p>
          </>
        )}
      </div>
    </div>
  );
}
