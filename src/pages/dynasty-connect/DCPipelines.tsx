import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Phone, Target, TrendingUp } from 'lucide-react';

const PIPELINES = [
  { key: 'gasmask', name: 'GasMask Wholesale', agent: 'GasMask — Inventory Check', color: 'text-red-400', callAs: 'GasMask Wholesale' },
  { key: 'brandaro', name: 'Brandaro Digital', agent: 'DC — Sales Outreach', color: 'text-purple-400', callAs: 'Brandaro Digital' },
  { key: 'iclean', name: 'iClean WeClean', agent: 'DC — Sales Outreach', color: 'text-cyan-400', callAs: 'iClean WeClean' },
  { key: 'toptier', name: 'Top Tier Experience', agent: 'DC — Follow-up', color: 'text-blue-400', callAs: 'Top Tier Experience' },
  { key: 'unforgettable', name: 'Unforgettable Times', agent: 'DC — Follow-up', color: 'text-yellow-400', callAs: 'Unforgettable Times' },
  { key: 'external', name: 'External Clients', agent: 'Custom', color: 'text-gray-400', callAs: 'Client Business Name' },
];

export default function DCPipelines() {
  const { data: campaigns = [] } = useQuery({
    queryKey: ['dc-pipeline-campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_campaigns')
        .select('id, name, status, target_segment, total_targets, completed_calls, conversion_count');
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" /> Business Pipelines
        </h1>
        <p className="text-sm text-muted-foreground">
          Each Dynasty business runs through Dynasty Connect as a separate pipeline
        </p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {PIPELINES.map((pipe) => {
          const pipeCampaigns = campaigns.filter((c: any) =>
            (c.target_segment || '').toLowerCase().includes(pipe.key) ||
            (c.name || '').toLowerCase().includes(pipe.key)
          );
          const totalCalls = pipeCampaigns.reduce((s: number, c: any) => s + (c.completed_calls || 0), 0);
          const totalConversions = pipeCampaigns.reduce((s: number, c: any) => s + (c.conversion_count || 0), 0);

          return (
            <Card key={pipe.key}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-base flex items-center gap-2 ${pipe.color}`}>
                  <Building2 className="h-4 w-4" />
                  {pipe.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground">Calls as: "{pipe.callAs}"</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-lg font-bold">{pipeCampaigns.length}</p>
                    <p className="text-xs text-muted-foreground">Campaigns</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-lg font-bold">{totalCalls}</p>
                    <p className="text-xs text-muted-foreground">Calls</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-lg font-bold">{totalConversions}</p>
                    <p className="text-xs text-muted-foreground">Conversions</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{pipe.agent}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
