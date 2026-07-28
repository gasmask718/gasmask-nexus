/**
 * ContactPhoneNote — a small, inline-editable note that lives NEXT TO a
 * contact's phone number. Field context like "owner's cell — best after 6pm"
 * or "clerk, forwards to owner".
 *
 * Canonical column: public.store_contacts.phone_note
 * Real errors are surfaced (no silent failures).
 */
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StickyNote, Check, X, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  contactId: string;
  phoneNote: string | null | undefined;
  /** Query keys to invalidate so the note repaints everywhere. */
  invalidateKeys?: unknown[][];
  className?: string;
  readOnly?: boolean;
}

export function ContactPhoneNote({
  contactId,
  phoneNote,
  invalidateKeys = [],
  className,
  readOnly = false,
}: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phoneNote ?? '');

  useEffect(() => {
    if (!editing) setValue(phoneNote ?? '');
  }, [phoneNote, editing]);

  const save = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase
        .from('store_contacts')
        .update({ phone_note: next.trim() || null })
        .eq('id', contactId);
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      toast.success('Number note saved');
      setEditing(false);
      invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      qc.invalidateQueries({ queryKey: ['store-contacts'] });
    },
    onError: (e: any) => {
      // Surface the REAL error — never swallow it.
      toast.error('Could not save number note', {
        description: e?.message || String(e),
      });
    },
  });

  if (readOnly) {
    if (!phoneNote) return null;
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground italic', className)}>
        <StickyNote className="h-3 w-3" />
        {phoneNote}
      </span>
    );
  }

  if (editing) {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save.mutate(value);
            if (e.key === 'Escape') { setEditing(false); setValue(phoneNote ?? ''); }
          }}
          placeholder="e.g. owner's cell — best after 6pm"
          className="h-7 text-xs w-64"
          maxLength={140}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          disabled={save.isPending}
          onClick={() => save.mutate(value)}
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => { setEditing(false); setValue(phoneNote ?? ''); }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={cn(
        'inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 transition-colors',
        phoneNote
          ? 'text-muted-foreground italic hover:bg-muted'
          : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted',
        className,
      )}
      title="Note about this number"
    >
      <StickyNote className="h-3 w-3" />
      {phoneNote || 'add note'}
      <Pencil className="h-2.5 w-2.5 opacity-50" />
    </button>
  );
}
