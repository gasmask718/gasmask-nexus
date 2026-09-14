import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Loader2, Pencil, User, X } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Primary contact, editable in place at the top of the account.
 *
 * Canonical source: store_contacts.is_primary (renamed in place, never
 * duplicated) with store_master.contact_name / stores.primary_contact_name
 * kept in sync by set_store_primary_contact().
 */
interface Props {
  storeId: string;
  fallbackName?: string | null;
}

export function PrimaryContactInline({ storeId, fallbackName }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const { data: primary } = useQuery({
    queryKey: ['store-primary-contact', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_contacts')
        .select('id, name, phone')
        .eq('store_id', storeId)
        .eq('is_primary', true)
        .is('deleted_at', null)
        .order('created_at')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as { id: string; name: string; phone: string | null } | null;
    },
  });

  const name = primary?.name?.trim() || fallbackName?.trim() || '';

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  const save = useMutation({
    mutationFn: async (newName: string) => {
      const { data, error } = await (supabase as any).rpc('set_store_primary_contact', {
        _store_id: storeId,
        _name: newName,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Primary contact updated');
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['store-primary-contact', storeId] });
      qc.invalidateQueries({ queryKey: ['store-executive-summary'] });
      qc.invalidateQueries({ queryKey: ['store-contacts'] });
      qc.invalidateQueries({ queryKey: ['store-detail'] });
    },
    onError: (e: any) => toast.error(e.message || 'Could not update the primary contact'),
  });

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="primary-contact-inline">
      <User className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs uppercase tracking-wide text-muted-foreground">Primary contact</span>
      {editing ? (
        <>
          <Input
            autoFocus
            value={draft}
            maxLength={120}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) save.mutate(draft.trim());
              if (e.key === 'Escape') setEditing(false);
            }}
            className="h-8 w-56"
            aria-label="Primary contact name"
            data-testid="primary-contact-input"
          />
          <Button
            size="sm"
            disabled={!draft.trim() || save.isPending}
            onClick={() => save.mutate(draft.trim())}
            data-testid="primary-contact-save"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancel">
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="font-semibold" data-testid="primary-contact-name">
            {name || 'Not assigned'}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2"
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
            data-testid="primary-contact-edit"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="text-xs">Edit</span>
          </Button>
        </>
      )}
    </div>
  );
}
