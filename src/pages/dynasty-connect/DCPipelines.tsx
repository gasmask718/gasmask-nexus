import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Phone, DollarSign } from 'lucide-react';

const AGENTS = [
  { id: 'agent_0301kmdmp16aevv8svr78pbr75n8', name: 'DC — Sales Outreach' },
  { id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3', name: 'DC — Follow-up' },
  { id: 'agent_5901kmdnb01sfzs9hp76mz806813', name: 'DC — Reactivation' },
  { id: 'agent_8601khrh92krfgrrdj6gqcdpwate', name: 'GasMask — Inventory Check' },
];

const agentName = (id: string) => AGENTS.find(a => a.id === id)?.name || '—';

const FALLBACK_PIPELINES = [
  { business_name: 'GasMask Wholesale', caller_id: '+18484004179', pipeline_type: 'internal', default_agent_id: 'agent_8601khrh92krfgrrdj6gqcdpwate' },
  { business_name: 'Brandaro Digital', caller_id: '+18484004179', pipeline_type: 'internal', default_agent_id: 'agent_0301kmdmp16aevv8svr78pbr75n8' },
  { business_name: 'iClean WeClean', caller_id: '+18484004179', pipeline_type: 'internal', default_agent_id: 'agent_0301kmdmp16aevv8svr78pbr75n8' },
  { business_name: 'Top Tier Experience', caller_id: '+18484004179', pipeline_type: 'internal', default_agent_id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3' },
  { business_name: 'Unforgettable Times', caller_id: '+18484004179', pipeline_type: 'internal', default_agent_id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3' },
  { business_name: 'External Clients', caller_id: null, pipeline_type: 'external', default_agent_id: null },
];

const pipelineColor = (t: string) => {
  if (t === 'internal') return 'bg-primary/10 text-primary border-primary';
  if (t === 'external') return 'bg-amber-500/10 text-amber-500 border-amber-500';
  return '';
};

export default function DCPipelines() {
  const { data: dbPipelines = [] } = useQuery({
    queryKey: ['dc-business-pipelines'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('dc_business_pipelines')
        .select('*');
      return data || [];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['dc-pipeline-campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_campaigns')
        .select('id, name, status, target_segment, total_targets, completed_calls, conversion_count, flow_id');
      return data || [];
    },
  });

  const { data: callLogs = [] } = useQuery({
    queryKey: ['dc-pipeline-call-logs'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from('ai_call_logs')
        .select('persona_id, outcome, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .limit(500);
      return data || [];
    },
  });

  const pipelines = dbPipelines.length > 0 ? dbPipelines : FALLBACK_PIPELINES;

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
        {pipelines.map((pipe: any, idx: number) => {
          const name = (pipe.business_name || '').toLowerCase();
          const pipeCampaigns = campaigns.filter((c: any) =>
            (c.target_segment || '').toLowerCase().includes(name.split(' ')[0]) ||
            (c.name || '').toLowerCase().includes(name.split(' ')[0])
          );
          const activeCampaigns = pipeCampaigns.filter((c: any) => c.status === 'active');
          const totalCompleted = pipeCampaigns.reduce((s: number, c: any) => s + (c.completed_calls || 0), 0);
          const totalConversions = pipeCampaigns.reduce((s: number, c: any) => s + (c.conversion_count || 0), 0);
          const convRate = totalCompleted > 0 ? ((totalConversions / totalCompleted) * 100).toFixed(1) : '0';

          // Calls this month for this agent
          const agentId = pipe.default_agent_id;
          const monthCalls = agentId ? callLogs.filter((c: any) => c.persona_id === agentId).length : 0;

          return (
            <Card key={pipe.id || idx}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {pipe.business_name}
                  </CardTitle>
                  <Badge variant="outline" className={pipelineColor(pipe.pipeline_type || 'internal')}>
                    {pipe.pipeline_type || 'internal'}
                  </Badge>
                </div>
                {pipe.caller_id && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {pipe.caller_id}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-lg font-bold">{activeCampaigns.length}</p>
                    <p className="text-[10px] text-muted-foreground">Active</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-lg font-bold">{monthCalls}</p>
                    <p className="text-[10px] text-muted-foreground">Month</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-lg font-bold">{totalCompleted}</p>
                    <p className="text-[10px] text-muted-foreground">Calls</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-lg font-bold">{convRate}%</p>
                    <p className="text-[10px] text-muted-foreground">Conv</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {agentName(pipe.default_agent_id)}
                  </Badge>
                  {pipe.monthly_rate && (
                    <Badge variant="outline" className="text-xs text-green-500 border-green-500">
                      <DollarSign className="h-3 w-3 mr-0.5" />{pipe.monthly_rate}/mo
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
