import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { WorkTimelineItem } from '@/components/ambassador/WorkTimelineItem';
import { nyDate, rpc, type WorkItem, type WorkSummary } from '@/lib/myWork';

/** "My history with this store" — only renders for a signed-in user linked to an ambassador. */
export function MyStoreHistory({ storeId }: { storeId: string }) {
  const me = useQuery({ queryKey: ['my-work', 'me'], queryFn: async () => { const { data, error } = await rpc('ambassador_work_me'); if (error) throw error; return data as { my_ambassador_id: string | null }; } });
  const amb = me.data?.my_ambassador_id;
  const q = useQuery({
    enabled: !!amb, queryKey: ['my-work', 'store', amb, storeId],
    queryFn: async () => {
      const [f, s] = await Promise.all([
        rpc('ambassador_work_feed', { p_ambassador_id: amb, p_store_id: storeId, p_limit: 100 }),
        rpc('ambassador_work_summary', { p_ambassador_id: amb, p_from: '2000-01-01', p_to: nyDate(0), p_store_id: storeId }),
      ]);
      if (f.error) throw f.error; if (s.error) throw s.error;
      return { items: (f.data?.items || []) as WorkItem[], summary: s.data as WorkSummary };
    },
  });
  if (!amb) return null;
  const last = q.data?.summary.last_interaction; const next = q.data?.summary.follow_ups[0];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">My history with this store</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {q.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {q.error && <p className="text-destructive text-sm">{(q.error as Error).message}</p>}
        {q.data && <>
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div><span className="font-medium">Last time:</span> {last ? `${last.title} · ${new Date(last.at).toLocaleString('en-US', { timeZone: 'America/New_York' })}` : 'No history yet'}</div>
            <div><span className="font-medium">Next follow-up:</span> {next ? next.note : 'None noted'}</div>
          </div>
          <div className="max-h-[28rem] overflow-y-auto space-y-2">
            {q.data.items.map(i => <WorkTimelineItem key={i.item_id + i.at} item={i} hideStore />)}
          </div>
        </>}
      </CardContent>
    </Card>
  );
}
