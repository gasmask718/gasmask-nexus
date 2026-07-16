/**
 * StoreQuickNotes — Lightweight notes block over account_notes.
 * Same component used in the store card Quick View AND on the profile,
 * so notes are truly one shared surface.
 *
 * Writes: account_notes (entity_type='store', entity_id=storeId, note_type='quick')
 * Also stamps store_master.updated_at + updated_by so freshness signals move.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  storeId: string;
  /** Compact = card surface (small text, no card chrome). */
  compact?: boolean;
  /** How many recent notes to show. Default 3. */
  limit?: number;
}

export function StoreQuickNotes({ storeId, compact = false, limit = 3 }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [body, setBody] = useState('');

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['store-quick-notes', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_notes' as any)
        .select('id, note_body, note_type, created_by, created_at')
        .eq('entity_type', 'store')
        .eq('entity_id', storeId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        note_body: string;
        note_type: string | null;
        created_by: string | null;
        created_at: string;
      }>;
    },
    staleTime: 30_000,
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const trimmed = body.trim();
      if (!trimmed) throw new Error('Note is empty');
      const nowIso = new Date().toISOString();

      const { error } = await supabase.from('account_notes' as any).insert({
        entity_type: 'store',
        entity_id: storeId,
        note_body: trimmed,
        note_type: 'quick',
        created_by: user?.email || user?.id || 'system',
      } as any);
      if (error) throw error;

      // Move freshness signals on the store record
      await supabase
        .from('store_master')
        .update({ updated_at: nowIso, updated_by: user?.id ?? null } as any)
        .eq('id', storeId);
    },
    onSuccess: () => {
      setBody('');
      toast.success('Note added');
      qc.invalidateQueries({ queryKey: ['store-quick-notes', storeId] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to add note'),
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
              <p className={compact ? 'text-xs text-foreground whitespace-pre-wrap' : 'text-sm text-foreground whitespace-pre-wrap'}>
                {n.note_body}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {n.created_by || 'unknown'} ·{' '}
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </p>
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
    </div>
  );
}
