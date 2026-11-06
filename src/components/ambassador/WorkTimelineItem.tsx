import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { signedStorageUrl } from '@/lib/storageLinks';
import { money, type WorkItem } from '@/lib/myWork';
import { MapPin, Play } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = { visit: 'Visit', count: 'Count', note: 'Note', order: 'Order', money: 'Money', contact: 'Contact', new_store: 'New store', status: 'Change', voice: 'Voice' };

export function WorkTimelineItem({ item, onOpenStore, hideStore }: { item: WorkItem; onOpenStore?: (id: string) => void; hideStore?: boolean }) {
  const [audio, setAudio] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const time = new Date(item.at).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
  const play = async () => {
    try { setAudio(await signedStorageUrl('store-voice-notes', item.extra?.path)); } catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="secondary">{TYPE_LABEL[item.type] || item.type}</Badge>
          <span className="font-medium truncate">{item.title}</span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{time}</span>
      </div>
      {!hideStore && item.store_id && (
        <button type="button" className="text-left w-full min-h-10" onClick={() => onOpenStore?.(item.store_id!)}>
          <div className="font-semibold text-primary">{item.store_name || 'Store'}</div>
          {item.store_address && <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{item.store_address}</div>}
        </button>
      )}
      {item.detail && <p className="text-sm whitespace-pre-wrap break-words">{item.type === 'voice' ? `“${item.detail}”` : item.detail}</p>}
      <div className="flex flex-wrap gap-2 items-center">
        {item.amount != null && <Badge>{money(item.amount)}</Badge>}
        {item.status && <Badge variant="outline">{item.status}</Badge>}
        {item.type === 'voice' && item.extra?.path && !audio && <Button size="sm" variant="outline" className="h-10" onClick={() => void play()}><Play className="h-4 w-4" />Play recording</Button>}
      </div>
      {audio && <audio controls src={audio} className="w-full" />}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
