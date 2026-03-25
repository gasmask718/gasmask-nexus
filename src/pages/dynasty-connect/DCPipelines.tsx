import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Building2, Phone, DollarSign, Bot, ChevronDown, Eye, BarChart3, Settings, AlertTriangle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AGENTS = [
  { id: 'agent_0301kmdmp16aevv8svr78pbr75n8', name: 'DC — Sales Outreach' },
  { id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3', name: 'DC — Follow-up' },
  { id: 'agent_5901kmdnb01sfzs9hp76mz806813', name: 'DC — Reactivation' },
  { id: 'agent_8601khrh92krfgrrdj6gqcdpwate', name: 'GasMask — Inventory Check' },
];

const agentName = (id: string) => AGENTS.find(a => a.id === id)?.name || '—';

const FALLBACK_PIPELINES = [
  { id: '1', business_name: 'GasMask Wholesale', caller_id: '+18484004179', pipeline_type: 'internal', default_agent_id: 'agent_8601khrh92krfgrrdj6gqcdpwate', status: 'active', description: 'Wholesale distributor + retailer outreach', monthly_rate: null },
  { id: '2', business_name: 'Brandaro Digital', caller_id: '+18484004179', pipeline_type: 'internal', default_agent_id: 'agent_0301kmdmp16aevv8svr78pbr75n8', status: 'active', description: 'Lead gen for digital agency clients', monthly_rate: null },
  { id: '3', business_name: 'iClean WeClean', caller_id: '+18484004179', pipeline_type: 'internal', default_agent_id: 'agent_0301kmdmp16aevv8svr78pbr75n8', status: 'active', description: 'Residential + commercial cleaning outreach', monthly_rate: null },
  { id: '4', business_name: 'Top Tier Experience', caller_id: '+18484004179', pipeline_type: 'internal', default_agent_id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3', status: 'active', description: 'Luxury transport + corporate event outreach', monthly_rate: null },
  { id: '5', business_name: 'Unforgettable Times', caller_id: '+18484004179', pipeline_type: 'internal', default_agent_id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3', status: 'active', description: 'Event services + vendor outreach', monthly_rate: null },
];

const pipelineColor = (t: string) => {
  if (t === 'internal') return 'bg-primary/10 text-primary border-primary';
  if (t === 'external') return 'bg-amber-500/10 text-amber-500 border-amber-500';
  return '';
};

const outcomeIsWin = (o: string) => ['booked', 'interested'].includes(o);

export default function DCPipelines() {
  const navigate = useNavigate();
  const [externalOpen, setExternalOpen] = useState(false);

  const { data: dbPipelines = [] } = useQuery({
    queryKey: ['dc-business-pipelines'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('dc_business_pipelines')
        .select('*')
        .order('pipeline_type', { ascending: true });
      return data || [];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['dc-pipeline-campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_campaigns')
        .select('id, name, status, target_segment, completed_calls, conversion_count, flow_id');
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
        .limit(1000);
      return data || [];
    },
  });

  const pipelines = dbPipelines.length > 0 ? dbPipelines : FALLBACK_PIPELINES;
  const internal = pipelines.filter((p: any) => p.pipeline_type === 'internal');
  const external = pipelines.filter((p: any) => p.pipeline_type === 'external');

  const getStats = (pipe: any) => {
    const nameKey = (pipe.business_name || '').toLowerCase().split(' ')[0];
    const pipeCampaigns = campaigns.filter((c: any) =>
      (c.target_segment || '').toLowerCase().includes(nameKey) ||
      (c.name || '').toLowerCase().includes(nameKey)
    );
    const activeCampaigns = pipeCampaigns.filter((c: any) => c.status === 'active').length;
    const agentId = pipe.default_agent_id;
    const agentCalls = agentId ? callLogs.filter((c: any) => c.persona_id === agentId) : [];
    const monthCalls = agentCalls.length;
    const wins = agentCalls.filter((c: any) => outcomeIsWin(c.outcome || '')).length;
    const winRate = monthCalls > 0 ? ((wins / monthCalls) * 100).toFixed(1) : '0.0';
    return { activeCampaigns, monthCalls, winRate, totalCampaigns: pipeCampaigns.length };
  };

  const isGasMask = (name: string) => name.toLowerCase().includes('gasmask') || name.toLowerCase().includes('gas mask');

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

      {/* Internal Pipelines Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Badge variant="outline" className={pipelineColor('internal')}>Internal</Badge>
          Dynasty-Owned Brands
        </h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {internal.map((pipe: any) => {
            const stats = getStats(pipe);
            return (
              <PipelineCard
                key={pipe.id}
                pipe={pipe}
                stats={stats}
                isGasMask={isGasMask(pipe.business_name)}
                onViewCampaigns={() => navigate('/dynasty-connect/campaigns')}
                onViewCalls={() => navigate('/dynasty-connect/intelligence')}
              />
            );
          })}
        </div>
      </div>

      {/* External Clients Section */}
      <Collapsible open={externalOpen} onOpenChange={setExternalOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              External Clients ({external.length})
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${externalOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          {external.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No external clients onboarded yet.</p>
                <p className="text-xs mt-1">Add a pipeline with type "external" to onboard a client.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {external.map((pipe: any) => {
                const stats = getStats(pipe);
                return (
                  <PipelineCard
                    key={pipe.id}
                    pipe={pipe}
                    stats={stats}
                    isGasMask={false}
                    onViewCampaigns={() => navigate('/dynasty-connect/campaigns')}
                    onViewCalls={() => navigate('/dynasty-connect/intelligence')}
                  />
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function PipelineCard({
  pipe,
  stats,
  isGasMask,
  onViewCampaigns,
  onLaunch,
}: {
  pipe: any;
  stats: { activeCampaigns: number; monthCalls: number; winRate: string; totalCampaigns: number };
  isGasMask: boolean;
  onViewCampaigns: () => void;
  onLaunch: () => void;
}) {
  return (
    <Card>
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
        {pipe.description && (
          <CardDescription className="text-xs">{pipe.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/50 rounded p-2">
            <p className="text-lg font-bold">{stats.activeCampaigns}</p>
            <p className="text-[10px] text-muted-foreground">Active Campaigns</p>
          </div>
          <div className="bg-muted/50 rounded p-2">
            <p className="text-lg font-bold">{stats.monthCalls}</p>
            <p className="text-[10px] text-muted-foreground">Calls This Month</p>
          </div>
          <div className="bg-muted/50 rounded p-2">
            <p className="text-lg font-bold">{stats.winRate}%</p>
            <p className="text-[10px] text-muted-foreground">Win Rate</p>
          </div>
        </div>

        {/* Agent Assigned */}
        <div className="flex items-center gap-2 bg-muted/30 rounded p-2">
          <Bot className="h-4 w-4 text-primary" />
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{agentName(pipe.default_agent_id)}</p>
            <p className="text-[10px] text-muted-foreground truncate">{pipe.default_agent_id || 'No agent assigned'}</p>
          </div>
        </div>

        {/* Caller ID */}
        {pipe.caller_id && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" /> Calls prospects as: <span className="font-mono text-foreground">{pipe.caller_id}</span>
          </p>
        )}

        {/* Monthly Rate for External */}
        {pipe.pipeline_type === 'external' && pipe.monthly_rate != null && (
          <div className="flex items-center gap-1 text-xs">
            <DollarSign className="h-3 w-3 text-green-500" />
            <span className="text-green-500 font-medium">${pipe.monthly_rate}/mo</span>
          </div>
        )}

        {/* GasMask Callout */}
        {isGasMask && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded p-2">
            <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              GasMask cold outreach handled here. Store relationship management stays in Grabba Floor 2 Communication Hub (separate system).
            </p>
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onViewCampaigns}>
            <Eye className="h-3 w-3 mr-1" /> Campaigns
          </Button>
          <Button size="sm" className="flex-1 text-xs bg-[#0F6E56] hover:bg-[#0F6E56]/80" onClick={onLaunch}>
            <BarChart3 className="h-3 w-3 mr-1" /> Launch
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
