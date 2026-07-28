import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Phone,
  MessageSquare,
  Send,
  Loader2,
  PhoneMissed,
  PhoneIncoming,
  PhoneOutgoing,
  Lock,
} from 'lucide-react';
import {
  useFieldStoreComms,
  useSendFieldSms,
  useStartFieldCall,
  type FieldCommEntry,
} from '@/hooks/useFieldStoreComms';
import { formatDistanceToNow } from 'date-fns';

interface StoreCommsPanelProps {
  storeId: string;
  storeName: string;
  storePhone?: string | null;
}

function when(entry: FieldCommEntry) {
  const ts = entry.sent_at || entry.started_at || entry.created_at;
  if (!ts) return '';
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return '';
  }
}

function duration(entry: FieldCommEntry) {
  const secs = entry.call_duration ?? entry.duration_seconds;
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function CallRow({ entry }: { entry: FieldCommEntry }) {
  const inbound = entry.direction === 'inbound';
  const missed =
    entry.status === 'no-answer' ||
    entry.status === 'missed' ||
    entry.status === 'failed' ||
    entry.outcome === 'missed';
  const Icon = missed ? PhoneMissed : inbound ? PhoneIncoming : PhoneOutgoing;
  const dur = duration(entry);

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${missed ? 'text-destructive' : 'text-muted-foreground'}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {inbound ? 'Incoming call' : 'Outgoing call'}
          </span>
          {missed && (
            <Badge variant="destructive" className="text-[10px]">
              Missed
            </Badge>
          )}
          {dur && <span className="text-xs text-muted-foreground">{dur}</span>}
          <span className="ml-auto text-xs text-muted-foreground">{when(entry)}</span>
        </div>
        {entry.summary && (
          <p className="mt-1 text-xs text-muted-foreground">{entry.summary}</p>
        )}
        {entry.transcription && (
          <p className="mt-1 rounded bg-muted/50 p-2 text-xs italic text-muted-foreground">
            “{entry.transcription}”
          </p>
        )}
        {entry.notes && <p className="mt-1 text-xs text-muted-foreground">{entry.notes}</p>}
      </div>
    </div>
  );
}

function TextRow({ entry }: { entry: FieldCommEntry }) {
  const inbound = entry.direction === 'inbound';
  return (
    <div className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 ${
          inbound ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm">
          {entry.message_content || entry.summary || '(no content)'}
        </p>
        <p
          className={`mt-1 text-[10px] ${
            inbound ? 'text-muted-foreground' : 'text-primary-foreground/70'
          }`}
        >
          {when(entry)}
          {entry.delivery_status ? ` · ${entry.delivery_status}` : ''}
        </p>
      </div>
    </div>
  );
}

/**
 * Field-portal call + text panel for a single ASSIGNED store.
 * Reads the recording-free scoped view; writes go through field-portal-comms
 * which re-verifies assignment server-side.
 */
export function StoreCommsPanel({ storeId, storeName, storePhone }: StoreCommsPanelProps) {
  const [draft, setDraft] = useState('');
  const { data: entries = [], isLoading, error } = useFieldStoreComms(storeId);
  const sendSms = useSendFieldSms(storeId);
  const startCall = useStartFieldCall(storeId);

  const texts = entries
    .filter((e) => e.channel === 'sms' || e.channel === 'whatsapp')
    .slice()
    .reverse();
  const calls = entries.filter((e) => e.channel === 'voice' || e.channel === 'call');

  const noPhone = !storePhone;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Calls & Texts — {storeName}</CardTitle>
          <Button
            size="sm"
            onClick={() => startCall.mutate({ to_phone: storePhone })}
            disabled={noPhone || startCall.isPending}
          >
            {startCall.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Phone className="mr-1 h-4 w-4" />
            )}
            Call store
          </Button>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Calls and texts go out from the business number. Recordings are not available in
          the field portal.
        </p>
      </CardHeader>

      <CardContent>
        {error && (
          <p className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {(error as Error).message}
          </p>
        )}

        <Tabs defaultValue="texts">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="texts" className="text-xs">
              <MessageSquare className="mr-1 h-3.5 w-3.5" />
              Texts ({texts.length})
            </TabsTrigger>
            <TabsTrigger value="calls" className="text-xs">
              <Phone className="mr-1 h-3.5 w-3.5" />
              Calls ({calls.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="texts" className="space-y-3 pt-3">
            <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : texts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No texts with this store yet.
                </p>
              ) : (
                texts.map((e) => <TextRow key={e.id} entry={e} />)
              )}
            </div>

            <div className="flex items-end gap-2 border-t border-border pt-3">
              <Textarea
                value={draft}
                onChange={(ev) => setDraft(ev.target.value)}
                placeholder={
                  noPhone ? 'No phone number on file for this store' : 'Type a message…'
                }
                rows={2}
                maxLength={1600}
                disabled={noPhone}
                className="resize-none"
              />
              <Button
                onClick={() =>
                  sendSms.mutate(
                    { message: draft.trim(), to_phone: storePhone },
                    { onSuccess: () => setDraft('') },
                  )
                }
                disabled={noPhone || !draft.trim() || sendSms.isPending}
                aria-label="Send text"
              >
                {sendSms.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="calls" className="space-y-2 pt-3">
            <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : calls.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No calls with this store yet.
                </p>
              ) : (
                calls.map((e) => <CallRow key={e.id} entry={e} />)
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
