/**
 * Dynasty Direct — Contact Inbox
 *
 * Minimal inbox for /contact form submissions written by the dd-contact
 * edge function. List → read → reply (mailto) → mark handled.
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Inbox, Mail, Check, RotateCcw, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DDShell } from '@/components/dynasty-direct/DDShell';
import { DDPageHeader } from '@/components/dynasty-direct/DDPageHeader';
import { DDSkeleton, DDErrorCard, DDEmpty } from '@/components/dynasty-direct/DDStates';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Status = 'new' | 'handled' | 'archived';
interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  source: string | null;
  status: Status;
  created_at: string;
}

export default function DynastyDirectMessages() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'new' | 'handled' | 'all'>('new');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['dd-contact-messages'],
    queryFn: async (): Promise<ContactMessage[]> => {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('id,name,email,message,source,status,created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ContactMessage[];
    },
    refetchInterval: 30_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase
        .from('contact_messages')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === 'handled' ? 'Marked handled' : 'Reopened');
      qc.invalidateQueries({ queryKey: ['dd-contact-messages'] });
      qc.invalidateQueries({ queryKey: ['dd-hub-kpis'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Update failed'),
  });

  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    if (tab === 'all') return rows;
    return rows.filter((r) => r.status === tab);
  }, [q.data, tab]);

  const selected = filtered.find((r) => r.id === selectedId)
    ?? q.data?.find((r) => r.id === selectedId)
    ?? null;

  const counts = useMemo(() => {
    const rows = q.data ?? [];
    return {
      new: rows.filter((r) => r.status === 'new').length,
      handled: rows.filter((r) => r.status === 'handled').length,
      all: rows.length,
    };
  }, [q.data]);

  return (
    <DDShell>
      <DDPageHeader
        icon={Inbox}
        title="Contact Inbox"
        purpose="Inbound messages from the public /contact form. Read, reply via email, mark handled."
        crumbs={[{ label: 'Contact Inbox' }]}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <TabsList>
          <TabsTrigger value="new">New <Badge variant="secondary" className="ml-2">{counts.new}</Badge></TabsTrigger>
          <TabsTrigger value="handled">Handled <Badge variant="secondary" className="ml-2">{counts.handled}</Badge></TabsTrigger>
          <TabsTrigger value="all">All <Badge variant="secondary" className="ml-2">{counts.all}</Badge></TabsTrigger>
        </TabsList>
      </Tabs>

      {q.isLoading ? (
        <DDSkeleton rows={5} />
      ) : q.error ? (
        <DDErrorCard error={q.error} onRetry={() => q.refetch()} />
      ) : filtered.length === 0 ? (
        <DDEmpty
          icon={Inbox}
          title={tab === 'new' ? 'Inbox clear' : 'Nothing here'}
          description={tab === 'new'
            ? 'No new messages. New submissions to the public /contact form land here automatically.'
            : 'No messages match this filter.'}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr] gap-4">
          <Card>
            <CardContent className="p-0 divide-y">
              {filtered.map((m) => {
                const active = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-accent/40 transition-colors',
                      active && 'bg-accent',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm truncate">{m.name || m.email}</div>
                      {m.status === 'new' && (
                        <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30" variant="outline">new</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.message}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      {m.source ? ` · ${m.source}` : ''}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              {!selected ? (
                <div className="text-sm text-muted-foreground text-center py-16">
                  Select a message to read.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{selected.name || '—'}</div>
                      <a
                        href={`mailto:${selected.email}`}
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {selected.email}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(selected.created_at).toLocaleString()}
                        {selected.source ? ` · ${selected.source}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button asChild size="sm">
                        <a
                          href={`mailto:${selected.email}?subject=${encodeURIComponent('Re: your message to Dynasty Direct')}&body=${encodeURIComponent(`\n\n---\nOn ${new Date(selected.created_at).toLocaleString()} you wrote:\n${selected.message}`)}`}
                        >
                          <Mail className="h-3.5 w-3.5 mr-1" />Reply
                        </a>
                      </Button>
                      {selected.status === 'new' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus.mutate({ id: selected.id, status: 'handled' })}
                          disabled={updateStatus.isPending}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />Mark handled
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus.mutate({ id: selected.id, status: 'new' })}
                          disabled={updateStatus.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap break-words">
                    {selected.message}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DDShell>
  );
}
