/**
 * StoreQuickNotes — Lightweight notes block for the store profile.
 *
 * READS: v_store_notes_clean (canonical clean view) — grouped by observed_on
 * (the real date the thing happened), newest first. Each note shows the
 * category as a colored chip, written_on (small/grey), and a warning icon when
 * date_confidence === 'import' (date inferred from import). Author and edit
 * metadata are merged from store_notes because the view does not carry them.
 *
 * WRITES: still inserts to store_notes with a [quick] prefix so quick notes
 * stay in the unified stream.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, StickyNote, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { verifiedInsert, verifiedUpdate, mutationErrorMessage } from '@/lib/verifiedMutation';
import { DeleteConfirmModal } from '@/components/crud/DeleteConfirmModal';
import { Button as UIButton } from '@/components/ui/button';
import { toast } from 'sonner';
import { dynastyDateAbsolute, dynastyDateTime } from '@/lib/dates';
import { AddNoteModal } from './AddNoteModal';
import { format, parseISO } from 'date-fns';
import { CATEGORY_CHIP } from './BrandScopedNotesSection';

interface Props {
  storeId: string;
  storeName?: string;
  compact?: boolean;
  limit?: number;
}

const QUICK_PREFIX = '[quick]';

interface CleanQuickNote {
  id: string;
  store_id: string;
  observed_on: string | null;
  date_confidence: string | null;
  written_on: string | null;
  source: string | null;
  edited_at: string | null;
  edited_by: string | null;
  category: string | null;
  note_text: string;
  raw_note: string | null;
  created_by: string | null;
  created_at: string | null;
  author_name: string | null;
}

const categoryChipClass = (category?: string | null) =>
  CATEGORY_CHIP[(category || '').toLowerCase()] || 'bg-muted text-muted-foreground border-border';

const formatDayHeader = (d: string | null) =>
  d ? format(parseISO(d), 'MMM d, yyyy') : 'Undated';

export function StoreQuickNotes({ storeId, storeName: storeNameProp, compact = false, limit = 3 }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; text: string } | null>(null);
  const [editingNote, setEditingNote] = useState<CleanQuickNote | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const { data: storeName = storeNameProp || '' } = useQuery({
    queryKey: ['store-name-for-quick-notes', storeId],
    queryFn: async () => {
      if (storeNameProp) return storeNameProp;
      const { data, error } = await supabase
        .from('store_master')
        .select('store_name')
        .eq('id', storeId)
        .single();
      if (error) throw error;
      return data?.store_name || '';
    },
    enabled: !!storeId && !storeNameProp,
    staleTime: 5 * 60_000,
  });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['store-notes-quick', storeId, limit],
    queryFn: async () => {
      // Fetch the canonical clean view plus the author metadata it doesn't carry.
      const [cleanRes, metaRes] = await Promise.all([
        supabase
          .from('v_store_notes_clean')
          .select('id, store_id, observed_on, date_confidence, written_on, source, edited_at, edited_by, category, note_text, raw_note')
          .eq('store_id', storeId)
          .order('observed_on', { ascending: false })
          .limit(limit),
        supabase
          .from('store_notes')
          .select('id, created_by, created_at, profile:profiles(name)')
          .eq('store_id', storeId)
          .is('deleted_at', null),
      ]);

      if (cleanRes.error) throw cleanRes.error;
      if (metaRes.error) throw metaRes.error;

      const metaById = new Map<string, any>((metaRes.data || []).map((m: any) => [m.id, m]));
      const rows = ((cleanRes.data || []) as any[]).map((n) => {
        const meta = metaById.get(n.id);
        return {
          ...n,
          created_by: meta?.created_by ?? null,
          created_at: meta?.created_at ?? null,
          author_name: meta?.profile?.name || meta?.created_by || null,
        } as CleanQuickNote;
      });

      // Newest-first by observed_on; undated sinks to the bottom.
      return rows.sort((a, b) => {
        const aDate = a.observed_on ? new Date(a.observed_on).getTime() : 0;
        const bDate = b.observed_on ? new Date(b.observed_on).getTime() : 0;
        return bDate - aDate;
      });
    },
    staleTime: 30_000,
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const trimmed = body.trim();
      if (!trimmed) throw new Error('Note is empty');
      const nowIso = new Date().toISOString();

      await verifiedInsert('Add quick note', () =>
        supabase
          .from('store_notes')
          .insert({
            store_id: storeId,
            note_text: `${QUICK_PREFIX} ${trimmed}`,
            created_by: user?.id ?? null,
          } as any)
          .select('id') as never,
      );

      await supabase
        .from('store_master')
        .update({ updated_at: nowIso, updated_by: user?.id ?? null } as any)
        .eq('id', storeId);
    },
    onSuccess: () => {
      setBody('');
      toast.success('Note added');
      qc.invalidateQueries({ queryKey: ['store-notes-quick', storeId] });
      qc.invalidateQueries({ queryKey: ['store-notes'] });
    },
    onError: (e: any) => toast.error(mutationErrorMessage(e)),
  });

  /** Soft delete — the row is kept, only hidden. RLS: author or admin. */
  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      await verifiedUpdate('Delete note', () =>
        supabase
          .from('store_notes')
          .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null } as any)
          .eq('id', id)
          .is('deleted_at', null)
          .select('id') as never,
      );
    },
    onSuccess: () => {
      toast.success('Note deleted');
      qc.invalidateQueries({ queryKey: ['store-notes-quick', storeId] });
      qc.invalidateQueries({ queryKey: ['store-notes'] });
    },
    onError: (e: any) => toast.error(mutationErrorMessage(e)),
  });

  const handleEdit = (note: CleanQuickNote) => {
    setEditingNote(note);
    setEditModalOpen(true);
  };

  const headingClass = compact
    ? 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'
    : 'text-xs font-semibold uppercase tracking-wider text-muted-foreground';

  // Group notes by observed_on date for date headers.
  const grouped = notes.reduce<Record<string, CleanQuickNote[]>>((acc, note) => {
    const key = note.observed_on || '__undated__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(note);
    return acc;
  }, {});
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === '__undated__') return 1;
    if (b === '__undated__') return -1;
    return new Date(b).getTime() - new Date(a).getTime();
  });

  return (
    <div className={compact ? 'space-y-2 border-t border-border/50 pt-3' : 'space-y-3'}>
      <div className="flex items-center gap-1.5">
        <StickyNote className={compact ? 'h-3.5 w-3.5 text-muted-foreground' : 'h-4 w-4 text-primary'} />
        <p className={headingClass}>Quick notes</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : notes.length === 0 ? (
        <p className={compact ? 'text-xs italic text-muted-foreground' : 'text-sm italic text-muted-foreground'}>
          No notes yet
        </p>
      ) : (
        <div className="space-y-3">
          {groupKeys.map((key) => (
            <div key={key} className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {formatDayHeader(key === '__undated__' ? null : key)}
              </p>
              <ul className="space-y-1.5">
                {grouped[key].map((n) => (
                  <li
                    key={n.id}
                    className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5"
                  >
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${categoryChipClass(n.category)}`}>
                        {n.category || 'NOTE'}
                      </Badge>
                      {n.date_confidence === 'import' && (
                        <span title="Date inferred from import">
                          <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                        </span>
                      )}
                    </div>
                    <p className={(compact ? 'text-xs' : 'text-sm') + ' mt-1 whitespace-pre-wrap break-words leading-relaxed text-foreground [overflow-wrap:anywhere]'}>
                      {n.note_text}
                    </p>
                    <div className="mt-0.5 flex items-start justify-between gap-2">
                      <p className="text-[10px] leading-relaxed text-muted-foreground break-words [overflow-wrap:anywhere]">
                        {n.author_name || 'unknown'} · {n.written_on ? `Written ${dynastyDateAbsolute(n.written_on)}` : dynastyDateTime(n.created_at)}
                        {n.edited_at && (
                          <span className="text-amber-600"> · edited</span>
                        )}
                      </p>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <UIButton
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Edit note"
                          className="h-5 w-5"
                          onClick={() => handleEdit(n)}
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                        </UIButton>
                        <UIButton
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Delete note"
                          className="h-5 w-5"
                          onClick={() => setPendingDelete({ id: n.id, text: n.note_text })}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </UIButton>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a quick note…"
          rows={compact ? 2 : 3}
          className={compact ? 'text-xs' : 'text-sm'}
        />
        <div className="flex justify-end">
          <Button
            size={compact ? 'sm' : 'default'}
            onClick={() => addNote.mutate()}
            disabled={addNote.isPending || !body.trim()}
            className={compact ? 'h-7 text-xs' : ''}
          >
            {addNote.isPending ? 'Saving…' : 'Add note'}
          </Button>
        </div>
      </div>

      <DeleteConfirmModal
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete note"
        description="This note will be removed from the store profile. The record is kept for audit and can be restored by an admin."
        itemName={pendingDelete?.text?.slice(0, 60)}
        onConfirm={async () => {
          if (pendingDelete) await deleteNote.mutateAsync(pendingDelete.id);
        }}
      />

      {storeName && (
        <AddNoteModal
          open={editModalOpen}
          onOpenChange={(open) => {
            setEditModalOpen(open);
            if (!open) setEditingNote(null);
          }}
          storeId={storeId}
          storeName={storeName}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['store-notes-quick', storeId] });
            qc.invalidateQueries({ queryKey: ['store-notes'] });
          }}
          editingNote={
            editingNote
              ? {
                  id: editingNote.id,
                  note_text: editingNote.note_text,
                  created_at: editingNote.created_at || undefined,
                }
              : null
          }
        />
      )}
    </div>
  );
}
