import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const statusColor: Record<string, string> = {
  dominated: 'bg-green-500',
  in_progress: 'bg-amber-500',
  untouched: 'bg-muted-foreground',
};

const statusLabel: Record<string, string> = {
  dominated: 'Dominated',
  in_progress: 'In Progress',
  untouched: 'Untouched',
};

export default function TerritoryNeighborhoods() {
  const { data: neighborhoods, isLoading } = useQuery({
    queryKey: ['territory-neighborhood-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_territory_neighborhood_kpis')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Neighborhoods</h1>
        <p className="text-muted-foreground text-sm">Coverage and domination status by neighborhood</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : neighborhoods && neighborhoods.length > 0 ? (
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3">Neighborhood</th>
                    <th className="text-left py-2 px-3">City</th>
                    <th className="text-right py-2 px-3">Addresses</th>
                    <th className="text-right py-2 px-3">Verified</th>
                    <th className="text-right py-2 px-3">Candidates</th>
                    <th className="text-right py-2 px-3">Unknown</th>
                    <th className="py-2 px-3 w-40">Coverage</th>
                    <th className="text-center py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {neighborhoods.map((n: any) => (
                    <tr key={n.neighborhood_id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{n.name}</td>
                      <td className="py-2 px-3 text-muted-foreground">{n.city}, {n.state}</td>
                      <td className="py-2 px-3 text-right">{n.total_addresses}</td>
                      <td className="py-2 px-3 text-right text-green-500">{n.verified_store_count}</td>
                      <td className="py-2 px-3 text-right text-amber-500">{n.candidate_count}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{n.unknown_count}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <Progress value={Number(n.coverage_percentage) || 0} className="h-2 flex-1" />
                          <span className="text-xs w-10 text-right">{n.coverage_percentage}%</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge className={`${statusColor[n.domination_status] || 'bg-muted-foreground'} text-white text-xs`}>
                          {statusLabel[n.domination_status] || n.domination_status}
                        </Badge>
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
            No neighborhoods defined yet. Create neighborhoods in the territory system to begin tracking.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
