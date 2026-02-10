import { usePinnedNotes } from '@/hooks/usePinnedNotes';
import { AlertTriangle, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PinnedNotesSnapshotPanelProps {
  storeId: string;
}

/**
 * Read-only pinned notes panel for Delivery Memory Snapshot.
 * Renders above contacts/payments. Cannot be edited in field views.
 */
export function PinnedNotesSnapshotPanel({ storeId }: PinnedNotesSnapshotPanelProps) {
  const { pinnedNotes, isLoading } = usePinnedNotes(storeId);

  if (isLoading || pinnedNotes.length === 0) return null;

  return (
    <div className="p-2.5 rounded-lg border-2 border-amber-500/40 bg-amber-500/10 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Pin className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
          ⚠️ Important Store Notes
        </span>
        <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-600">
          {pinnedNotes.length} pinned
        </Badge>
      </div>
      {pinnedNotes.map((note) => (
        <div key={note.id} className="flex items-start gap-1.5 text-xs">
          <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0 mt-0.5" />
          <span className="font-medium text-foreground">{note.note_text}</span>
        </div>
      ))}
    </div>
  );
}
