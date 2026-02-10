import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const interestColor: Record<string, string> = {
  interested: 'bg-green-500 text-white',
  warm: 'bg-amber-500 text-white',
  cold: 'bg-muted text-muted-foreground',
};

export default function TerritoryCandidates() {
  const { data: candidates, isLoading } = useQuery({
    queryKey: ['territory-store-candidates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_store_candidates')
        .select('*, territory_addresses(full_address, city, state)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Store Candidates</h1>
        <p className="text-muted-foreground text-sm">Addresses believed to be stores — not yet CRM-approved</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : candidates && candidates.length > 0 ? (
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3">Store Name (Guess)</th>
                    <th className="text-left py-2 px-3">Address</th>
                    <th className="text-center py-2 px-3">Tobacco</th>
                    <th className="text-center py-2 px-3">Interest</th>
                    <th className="text-center py-2 px-3">Source</th>
                    <th className="text-left py-2 px-3">Next Action</th>
                    <th className="text-left py-2 px-3">Last Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c: any) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{c.store_name_guess || '—'}</td>
                      <td className="py-2 px-3 max-w-[200px] truncate text-muted-foreground">
                        {c.territory_addresses?.full_address || '—'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="outline" className="text-xs capitalize">{c.sells_tobacco || 'unknown'}</Badge>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge className={`${interestColor[c.interest_level] || 'bg-muted'} text-xs`}>
                          {c.interest_level || 'unknown'}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="secondary" className="text-xs">{c.source?.replace('_', ' ') || '—'}</Badge>
                      </td>
                      <td className="py-2 px-3 text-xs capitalize">{c.next_action?.replace('_', ' ') || '—'}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {c.last_contacted_at ? new Date(c.last_contacted_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No store candidates yet. Scout addresses to discover potential stores.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
