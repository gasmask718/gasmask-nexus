import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { verifiedInsert } from '@/lib/verifiedMutation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { fieldStamp } from '@/lib/dates';
import { toast } from 'sonner';

interface InternalNote {
  id: string;
  note: string;
  author_name: string | null;
  created_at: string;
}

/**
 * Admin/owner-only internal notes on an idea submission.
 * Stored in `idea_internal_notes`, which is RLS-restricted to admin/owner —
 * submitters cannot read these rows at the database level, not just in the UI.
 */
export function IdeaInternalNotes({
  ideaId,
  ideaTitle,
}: {
  ideaId: string;
  ideaTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const qc = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['idea-internal-notes', ideaId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('idea_internal_notes')
        .select('id, note, author_name, created_at')
        .eq('idea_id', ideaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as InternalNote[];
    },
  });

  const addNote = useMutation({
    mutationFn: async (note: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error('Not signed in.');
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', userId)
        .maybeSingle();

      return verifiedInsert('Add internal note', () =>
        supabase
          .from('idea_internal_notes')
          .insert({
            idea_id: ideaId,
            author_id: userId,
            author_name: profile?.name ?? auth.user?.email ?? null,
            note,
          })
          .select('id') as never,
      );
    },
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['idea-internal-notes', ideaId] });
      toast.success('Internal note added');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Internal notes">
          <Lock className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Internal notes</DialogTitle>
          <DialogDescription>
            Admin/owner only — the submitter cannot read these. Idea: {ideaTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Internal triage note, not visible to the submitter…"
            rows={3}
          />
          <Button
            size="sm"
            disabled={!draft.trim() || addNote.isPending}
            onClick={() => addNote.mutate(draft.trim())}
          >
            {addNote.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add note
          </Button>
        </div>

        <div className="max-h-64 space-y-3 overflow-y-auto border-t pt-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && notes.length === 0 && (
            <p className="text-sm text-muted-foreground">No internal notes yet.</p>
          )}
          {notes.map((n) => (
            <div key={n.id} className="rounded-md bg-muted/40 p-2">
              <p className="whitespace-pre-wrap text-sm">{n.note}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.author_name || 'Unknown'} · {fieldStamp(n.created_at)}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
