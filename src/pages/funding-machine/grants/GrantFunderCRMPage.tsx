import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Handshake, Users, Sparkles } from 'lucide-react';

const GOLD = '#C9A84C';

type Row = { relationship_status: string | null };

export default function GrantFunderCRMPage() {
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [relationships, setRelationships] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('grant_funders')
        .select('relationship_status')
        .eq('is_active', true);
      if (!error && data) {
        const rows = data as Row[];
        setTotal(rows.length);
        setRelationships(rows.filter(r => r.relationship_status === 'relationship').length);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center gap-3">
          <Handshake className="h-7 w-7" style={{ color: GOLD }} />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GOLD }}>🤝 Funder CRM</h1>
            <p className="text-sm text-zinc-400">Grant funder relationships and contact management</p>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Total Funders</p>
                  {loading ? (
                    <Skeleton className="h-8 w-16 mt-2 bg-zinc-800" />
                  ) : (
                    <p className="text-2xl font-bold mt-2" style={{ color: GOLD }}>{total}</p>
                  )}
                </div>
                <div className="p-2 rounded-lg" style={{ background: `${GOLD}20` }}>
                  <Users className="h-5 w-5" style={{ color: GOLD }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Active Relationships</p>
                  {loading ? (
                    <Skeleton className="h-8 w-16 mt-2 bg-zinc-800" />
                  ) : (
                    <p className="text-2xl font-bold mt-2 text-emerald-400">{relationships}</p>
                  )}
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Handshake className="h-5 w-5 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {!loading && total === 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-8 text-center text-sm text-zinc-400">
              No funders yet — funders will appear here once the Funder CRM build completes.
            </CardContent>
          </Card>
        )}

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Sparkles className="h-5 w-5" style={{ color: GOLD }} />
              Full Funder CRM coming soon
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400">
            Tables are ready. Build in progress — filters, funder cards, slide-over detail,
            interaction logging, and add-funder modal ship in the next drop.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
