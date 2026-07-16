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
import { Loader2, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

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

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['store-notes-quick', storeId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_notes')
        .select('id, note_text, created_by, created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        note_text: string;
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

      const { error } = await supabase.from('store_notes').insert({
        store_id: storeId,
        note_text: `${QUICK_PREFIX} ${trimmed}`,
        created_by: user?.id ?? null,
      } as any);
      if (error) throw error;

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
                {n.note_text}
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
