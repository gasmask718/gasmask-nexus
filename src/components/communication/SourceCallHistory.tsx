import { useCallHistoryForSource, type SourceCall } from "@/hooks/useCallHistoryForSource";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, PlayCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface SourceCallHistoryProps {
  sourceTable: string;
  sourceId: string;
  title?: string;
  limit?: number;
}

/**
 * SourceCallHistory — drop-in panel for any hub record (store profile, lead detail).
 * Renders the bidirectional call history for this record, with link to the
 * Finished Calls detail view.
 */
export function SourceCallHistory({
  sourceTable,
  sourceId,
  title = "AI Call History",
  limit = 25,
}: SourceCallHistoryProps) {
  const { data: calls = [], isLoading } = useCallHistoryForSource(sourceTable, sourceId, { limit });

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Loading call history…</div>
      </Card>
    );
  }

  if (calls.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <div className="text-sm text-muted-foreground">No calls placed yet.</div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">{title}</h3>
          <Badge variant="secondary" className="text-xs">{calls.length}</Badge>
        </div>
      </div>
      <ul className="space-y-2">
        {calls.map((c: SourceCall) => (
          <li key={c.id} className="border rounded p-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[11px] text-muted-foreground">
                {c.call_started_at ? new Date(c.call_started_at).toLocaleString() : "—"}
              </div>
              <div className="flex items-center gap-1">
                {c.business_unit && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{c.business_unit}</Badge>
                )}
                {c.outcome && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{c.outcome}</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span>
                {c.direction === "inbound" ? "← in" : "→ out"} · {c.to_number || c.from_number || "?"}
                {c.duration_seconds ? ` · ${c.duration_seconds}s` : ""}
              </span>
              <div className="flex items-center gap-1">
                {c.recording_url && (
                  <a href={c.recording_url} target="_blank" rel="noreferrer" title="Play recording">
                    <PlayCircle className="h-3.5 w-3.5 text-primary" />
                  </a>
                )}
                {c.call_id && (
                  <Button asChild variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Link to={`/dynasty-connect/finished-calls?call=${c.call_id}`} title="Open in Finished Calls">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            {c.transcript && (
              <div className="text-[11px] text-muted-foreground line-clamp-2">
                {c.transcript.slice(0, 200)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default SourceCallHistory;
