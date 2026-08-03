/**
 * StoreQuickNotes — Lightweight notes block that writes to `store_notes`,
 * the same table the profile "ALL NOTES" section reads. Quick notes are
 * prefixed with `[quick]` so they can be visually distinguished but stay
 * in the single unified stream. Also stamps store_master.updated_at.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, StickyNote, Trash2 } from 'lucide-react';
import { verifiedInsert, verifiedUpdate, mutationErrorMessage } from '@/lib/verifiedMutation';
import { DeleteConfirmModal } from '@/components/crud/DeleteConfirmModal';
import { Button as UIButton } from '@/components/ui/button';
import { toast } from 'sonner';
import { dynastyStampWithRelative } from '@/lib/dates';

interface Props {
  storeId: string;
  compact?: boolean;
  limit?: number;
}

const QUICK_PREFIX = '[quick]';

export function StoreQuickNotes({ storeId, compact = false, limit = 3 }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; text: string } | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['store-notes-quick', storeId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_notes')
        .select('id, note_text, created_by, created_at')
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = (data || []) as Array<{
        id: string;
        note_text: string;
        created_by: string | null;
        created_at: string;
      }>;
      // Defensive: always newest-first regardless of server ordering.
      // Many legacy/imported notes share an identical created_at (bulk import),
      // so tie-break on a leading date written inside the note text
      // (e.g. "• 10/10/2025 - Paid 140$").
      const textDate = (t: string): number => {
        const m = t.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
        if (!m) return 0;
        const [, mm, dd, yy] = m;
        const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
        const d = new Date(year, Number(mm) - 1, Number(dd));
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };
      return rows.slice().sort((a, b) => {
        const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (diff !== 0) return diff;
        return textDate(b.note_text || '') - textDate(a.note_text || '');
      });
    },
    staleTime: 30_000,
  });

  const authorIds = Array.from(new Set(notes.map((n) => n.created_by).filter(Boolean))) as string[];
  const { data: authors = {} } = useQuery({
    queryKey: ['store-notes-quick-authors', authorIds.sort().join(',')],
    queryFn: async () => {
      if (!authorIds.length) return {};
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', authorIds);
      if (error) throw error;
      return Object.fromEntries((data || []).map((p: any) => [p.id, p.name])) as Record<string, string>;
    },
    enabled: authorIds.length > 0,
    staleTime: 5 * 60_000,
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
      // Profile "ALL NOTES" section reads store_notes keyed by store_master.id
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

  const headingClass = compact
    ? 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'
    : 'text-xs font-semibold uppercase tracking-wider text-muted-foreground';

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
        <ul className="space-y-1.5">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5"
            >
              <p className={(compact ? 'text-xs' : 'text-sm') + ' whitespace-pre-wrap break-words leading-relaxed text-foreground [overflow-wrap:anywhere]'}>
                {n.note_text}
              </p>
              <div className="mt-0.5 flex items-start justify-between gap-2">
                <p className="text-[10px] leading-relaxed text-muted-foreground break-words [overflow-wrap:anywhere]">
                  {(n.created_by && authors[n.created_by]) || n.created_by || 'unknown'} ·{' '}
                  {dynastyStampWithRelative(n.created_at)}
                </p>
                <UIButton
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Delete note"
                  className="h-5 w-5 shrink-0"
                  onClick={() => setPendingDelete({ id: n.id, text: n.note_text })}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </UIButton>
              </div>
            </li>
          ))}
        </ul>
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
    </div>
  );
}
