import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, DollarSign, TrendingUp, ThumbsUp, ThumbsDown, CalendarClock, AlertTriangle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';

export default function CampaignIntelligencePage() {
  const { currentBusiness } = useBusiness();

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaign-intelligence', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_campaigns')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: 10000,
  });

  // Queue stats per campaign
  const { data: queueStats = {} } = useQuery({
    queryKey: ['campaign-queue-stats', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outbound_call_queue')
        .select('campaign_id, status')
        .eq('business_id', currentBusiness?.id);
      if (error) throw error;
      const stats: Record<string, { total: number; completed: number; dialed: number }> = {};
      (data || []).forEach(q => {
        const cid = (q as any).campaign_id || 'uncategorized';
        if (!stats[cid]) stats[cid] = { total: 0, completed: 0, dialed: 0 };
        stats[cid].total++;
        if (q.status === 'completed') stats[cid].completed++;
        if (q.status !== 'queued') stats[cid].dialed++;
      });
      return stats;
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: 10000,
  });

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'paused': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'completed': return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="w-full min-h-full space-y-6">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">SIMULATION DATA — Campaign metrics reflect simulated outcomes</p>
      </div>

      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6" /> Campaign Intelligence
        </h2>
        <p className="text-muted-foreground">ROI, outcomes, and follow-up tracking per campaign</p>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No Campaigns Yet</h3>
            <p className="text-sm text-muted-foreground">Create a campaign in the Bulk Dialer to start tracking ROI</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {campaigns.map(campaign => {
            const qs = (queueStats as any)[campaign.id] || { total: 0, completed: 0, dialed: 0 };
            const revenue = Number((campaign as any).total_revenue) || 0;
            const positive = Number((campaign as any).total_positive_outcomes) || 0;
            const negative = Number((campaign as any).total_negative_outcomes) || 0;
            const followups = Number((campaign as any).total_followups) || 0;
            const totalOutcomes = positive + negative;
            const closeRate = totalOutcomes > 0 ? ((positive / totalOutcomes) * 100).toFixed(1) : '0';
            const revenuePerDial = qs.dialed > 0 ? (revenue / qs.dialed).toFixed(2) : '0';
            const progress = qs.total > 0 ? (qs.completed / qs.total) * 100 : 0;

            return (
              <Card key={campaign.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <Badge variant="outline" className={statusColor(campaign.status || 'draft')}>
                      {campaign.status || 'draft'}
                    </Badge>
                  </div>
                  {campaign.description && (
                    <p className="text-xs text-muted-foreground">{campaign.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{qs.completed} / {qs.total} completed</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg text-center">
                      <DollarSign className="h-4 w-4 mx-auto mb-1 text-green-500" />
                      <p className="text-lg font-bold text-green-600">${revenue.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Total Revenue</p>
                    </div>
                    <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg text-center">
                      <TrendingUp className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                      <p className="text-lg font-bold text-blue-600">${revenuePerDial}</p>
                      <p className="text-[10px] text-muted-foreground">Rev / Dial</p>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <ThumbsUp className="h-4 w-4 mx-auto mb-1 text-green-500" />
                      <p className="text-lg font-bold">{positive}</p>
                      <p className="text-[10px] text-muted-foreground">Positive ({closeRate}%)</p>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <ThumbsDown className="h-4 w-4 mx-auto mb-1 text-red-500" />
                      <p className="text-lg font-bold">{negative}</p>
                      <p className="text-[10px] text-muted-foreground">Negative</p>
                    </div>
                  </div>

                  {followups > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarClock className="h-4 w-4" />
                      {followups} follow-up(s) generated
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
