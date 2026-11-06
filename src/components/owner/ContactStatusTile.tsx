import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '0%');

export function ContactStatusTile() {
  const q = useQuery({
    queryKey: ['contact-status-overview'],
    queryFn: async () => { const { data, error } = await (supabase as any).rpc('contact_status_overview'); if (error) throw error; return data as { contacts: number; verified: number; saved: number; invites_sent: number; accounts_created: number }; },
  });
  const d = q.data;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Store contacts</CardTitle></CardHeader>
      <CardContent>
        {q.error ? <p className="text-sm text-destructive">{(q.error as Error).message}</p> : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div><div className="text-2xl font-bold">{d ? pct(d.verified, d.contacts) : '–'}</div><div className="text-xs text-muted-foreground">Verified numbers{d ? ` (${d.verified}/${d.contacts})` : ''}</div></div>
            <div><div className="text-2xl font-bold">{d ? pct(d.saved, d.contacts) : '–'}</div><div className="text-xs text-muted-foreground">Saved in a phone{d ? ` (${d.saved})` : ''}</div></div>
            <div><div className="text-2xl font-bold">{d?.invites_sent ?? '–'}</div><div className="text-xs text-muted-foreground">Portal invites sent</div></div>
            <div><div className="text-2xl font-bold">{d?.accounts_created ?? '–'}</div><div className="text-xs text-muted-foreground">Portal accounts</div></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
