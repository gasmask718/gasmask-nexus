import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Play, Loader2, Lock } from "lucide-react";

/**
 * RecordingPlayer — plays a Twilio recording through the access-controlled
 * play-twilio-recording proxy. The session token rides in the query string
 * because <audio src> cannot send an Authorization header.
 */
export function RecordingPlayer({
  recordingUrl,
  recordingSid,
  compact = false,
}: {
  recordingUrl?: string | null;
  recordingSid?: string | null;
  compact?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projectUrl] = useState(() => import.meta.env.VITE_SUPABASE_URL as string);

  useEffect(() => {
    setSrc(null);
    setError(null);
  }, [recordingUrl, recordingSid]);

  if (!recordingUrl && !recordingSid) return null;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("Sign in to listen to recordings");
        return;
      }
      const params = new URLSearchParams({ token });
      if (recordingSid) {
        params.set("sid", recordingSid);
        params.set("fmt", "mp3");
      } else if (recordingUrl) {
        params.set("url", recordingUrl);
      }
      setSrc(`${projectUrl}/functions/v1/play-twilio-recording?${params.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <p className="flex items-center gap-1 text-xs text-destructive">
        <Lock className="h-3 w-3" /> {error}
      </p>
    );
  }

  if (!src) {
    return (
      <Button variant="outline" size="sm" onClick={load} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Play className="mr-2 h-3 w-3" />}
        {compact ? "Play" : "Play recording"}
      </Button>
    );
  }

  return (
    <audio
      controls
      preload="none"
      src={src}
      className="h-9 w-full max-w-md"
      onError={() => setError("Recording unavailable")}
    />
  );
}
