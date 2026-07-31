import { useStoreCallHistory, type StoreCallEntry } from "@/hooks/useStoreCallHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  MessageSquare,
  Bot,
  User,
  Loader2,
  PlayCircle,
} from "lucide-react";

const fmtPhone = (v?: string | null) => {
  const d = (v || "").replace(/\D/g, "").slice(-10);
  if (d.length !== 10) return v || "Unknown";
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

const fmtDuration = (s?: number | null) => {
  if (!s && s !== 0) return null;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

function EntryRow({ e }: { e: StoreCallEntry }) {
  const Icon =
    e.channel === "sms"
      ? MessageSquare
      : e.direction === "inbound"
        ? PhoneIncoming
        : PhoneOutgoing;

  return (
    <li className="rounded-md border border-border/60 p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{fmtPhone(e.phone)}</span>
          <Badge variant={e.isAI ? "secondary" : "outline"} className="text-[10px] gap-1">
            {e.isAI ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {e.isAI ? "AI" : "Human"}
          </Badge>
        </div>
        <time className="text-[11px] text-muted-foreground shrink-0">
          {new Date(e.occurredAt).toLocaleString()}
        </time>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {e.direction && (
          <Badge variant="outline" className="text-[10px] capitalize">
            {e.direction}
          </Badge>
        )}
        {e.disposition && (
          <Badge variant="secondary" className="text-[10px] capitalize">
            {String(e.disposition).replace(/_/g, " ")}
          </Badge>
        )}
        {fmtDuration(e.durationSeconds) && (
          <Badge variant="outline" className="text-[10px]">
            {fmtDuration(e.durationSeconds)}
          </Badge>
        )}
        {e.recordingUrl && (
          <a
            href={e.recordingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            <PlayCircle className="h-3 w-3" /> Recording
          </a>
        )}
      </div>

      {e.summary && <p className="text-xs text-muted-foreground line-clamp-3">{e.summary}</p>}
      {e.transcript && (
        <p className="text-xs text-muted-foreground/80 line-clamp-2 italic">{e.transcript}</p>
      )}
    </li>
  );
}

/**
 * StoreCallHistoryPanel — every call and text for this store in ONE list,
 * AI and human together, newest first.
 */
export function StoreCallHistoryPanel({
  storeId,
  limit = 100,
}: {
  storeId: string;
  limit?: number;
}) {
  const { data: entries = [], isLoading, error } = useStoreCallHistory(storeId, limit);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          Call &amp; Message History
          {entries.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {entries.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No calls or texts logged for this store yet.
          </p>
        ) : (
          <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {entries.map((e) => (
              <EntryRow key={e.id} e={e} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default StoreCallHistoryPanel;
