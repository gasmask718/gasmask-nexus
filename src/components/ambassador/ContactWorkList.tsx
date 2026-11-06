import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Phone } from 'lucide-react';
import { rpc } from '@/lib/myWork';

export const CONTACT_FILTERS = [
  { v: 'no_verified', l: 'No verified number' },
  { v: 'not_saved', l: "Hasn't saved our number" },
  { v: 'invite_not_sent', l: 'Invite not sent' },
  { v: 'invited_not_signed', l: 'Invited, not signed up' },
] as const;

/** My Work: "who to work" lists by contact status, over this ambassador's own stores. */
export function ContactWorkList({ ambassadorId, onOpenStore }: { ambassadorId: string; onOpenStore: (id: string) => void }) {
  const [filter, setFilter] = useState<string>('no_verified');
  const q = useQuery({
    queryKey: ['my-work', 'contacts', ambassadorId, filter],
    queryFn: async () => { const { data, error } = await rpc('contact_work_list', { p_ambassador_id: ambassadorId, p_filter: filter, p_limit: 200 }); if (error) throw error; return data as { stores: { store_id: string; store_name: string; store_address: string; phone: string | null }[]; total_stores: number }; },
  });
  const rows = q.data?.stores || [];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">Contacts to work</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {CONTACT_FILTERS.map(f => <Button key={f.v} size="sm" className="h-auto min-h-10 whitespace-normal" variant={filter === f.v ? 'default' : 'outline'} onClick={() => setFilter(f.v)}>{f.l}</Button>)}
        </div>
        {q.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
        {q.data && <p className="text-xs text-muted-foreground">{rows.length}{rows.length === 200 ? '+' : ''} of your {q.data.total_stores} stores</p>}
        <div className="max-h-80 overflow-y-auto space-y-1">
          {rows.map(r => (
            <div key={r.store_id} className="flex items-center justify-between gap-2 rounded border p-2">
              <button type="button" className="text-left min-w-0" onClick={() => onOpenStore(r.store_id)}><div className="font-medium truncate">{r.store_name}</div><div className="text-xs text-muted-foreground truncate">{r.store_address}</div></button>
              {r.phone && <Button asChild size="icon" variant="outline" className="h-11 w-11 shrink-0"><a href={`tel:${r.phone}`} aria-label="Call store"><Phone className="h-4 w-4" /></a></Button>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
