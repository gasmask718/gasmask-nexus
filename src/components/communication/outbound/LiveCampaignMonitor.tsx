import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, Phone, PhoneOff, AlertTriangle, CheckCircle2, 
  XCircle, Pause, Play, Shield, Target, TrendingUp, Users,
  Loader2, RefreshCw
} from 'lucide-react';
import { useOutboundCampaigns, useCampaignAction, useKillSwitchStatus, useTriggerKillSwitch } from '@/hooks/useOutboundCampaigns';
import { useBusiness } from '@/contexts/BusinessContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

export function LiveCampaignMonitor() {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id || null;
  
  const { data: campaigns, isLoading, refetch } = useOutboundCampaigns(businessId);
  const { data: killSwitchStatus } = useKillSwitchStatus('business', businessId || undefined);
  const campaignAction = useCampaignAction();
  const triggerKillSwitch = useTriggerKillSwitch();
  
  const [liveCampaigns, setLiveCampaigns] = useState<any[]>([]);

  useEffect(() => {
    if (campaigns) {
      setLiveCampaigns(campaigns.filter(c => c.status === 'active'));
    }
  }, [campaigns]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!businessId) return;

    const channel = supabase
      .channel('campaign-monitor')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'outbound_campaigns',
        filter: `business_id=eq.${businessId}`,
      }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, refetch]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      active: { variant: 'default', icon: Activity },
      paused: { variant: 'secondary', icon: Pause },
      halted: { variant: 'destructive', icon: XCircle },
      completed: { variant: 'outline', icon: CheckCircle2 },
      draft: { variant: 'outline', icon: Target },
      approved: { variant: 'secondary', icon: Shield },
    };
    const config = variants[status] || variants.draft;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const handleEmergencyHalt = async () => {
    if (!businessId) return;
    
    if (confirm('EMERGENCY HALT: This will immediately stop ALL outbound campaigns for this business. Continue?')) {
      await triggerKillSwitch.mutateAsync({
        scope: 'business',
        business_id: businessId,
        triggered_by: 'manual',
        reason: 'Emergency halt triggered from monitor',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Status Bar */}
      <Card className={killSwitchStatus?.operational ? 'border-green-500/50' : 'border-red-500 bg-red-50 dark:bg-red-950/20'}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${killSwitchStatus?.operational ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                {killSwitchStatus?.operational ? (
                  <Shield className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                )}
              </div>
              <div>
                <h3 className="font-semibold">
                  {killSwitchStatus?.operational ? 'System Operational' : 'SYSTEM HALTED'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {killSwitchStatus?.operational 
                    ? `${liveCampaigns.length} active campaigns running`
                    : 'All outbound calls stopped'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleEmergencyHalt}
                disabled={!killSwitchStatus?.operational}
                className="gap-2"
              >
                <PhoneOff className="h-4 w-4" />
                Emergency Halt
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Campaigns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {campaigns?.map((campaign) => (
          <Card key={campaign.id} className={campaign.status === 'active' ? 'border-primary/50' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{campaign.name}</CardTitle>
                  <CardDescription>{campaign.campaign_type.replace('_', ' ')}</CardDescription>
                </div>
                {getStatusBadge(campaign.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {campaign.calls_made} / {campaign.total_targets || '?'} calls
                  </span>
                </div>
                <Progress 
                  value={campaign.total_targets ? (campaign.calls_made / campaign.total_targets) * 100 : 0} 
                />
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-muted/50 rounded">
                  <Phone className="h-4 w-4 mx-auto text-blue-600 mb-1" />
                  <p className="text-lg font-bold">{campaign.calls_made}</p>
                  <p className="text-xs text-muted-foreground">Calls</p>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <TrendingUp className="h-4 w-4 mx-auto text-green-600 mb-1" />
                  <p className="text-lg font-bold">{campaign.conversions}</p>
                  <p className="text-xs text-muted-foreground">Converts</p>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <Users className="h-4 w-4 mx-auto text-amber-600 mb-1" />
                  <p className="text-lg font-bold">{campaign.escalations}</p>
                  <p className="text-xs text-muted-foreground">Escalated</p>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <XCircle className="h-4 w-4 mx-auto text-red-600 mb-1" />
                  <p className="text-lg font-bold">{campaign.opt_outs}</p>
                  <p className="text-xs text-muted-foreground">Opt-outs</p>
                </div>
              </div>

              {/* Warning indicators */}
              {campaign.kill_switch_triggered && (
                <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm p-2 rounded flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Kill switch triggered
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {campaign.status === 'active' && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => campaignAction.mutate({ action: 'pause', campaign_id: campaign.id })}
                    disabled={campaignAction.isPending}
                  >
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </Button>
                )}
                {campaign.status === 'paused' && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => campaignAction.mutate({ action: 'resume', campaign_id: campaign.id })}
                    disabled={campaignAction.isPending}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </Button>
                )}
                {['active', 'paused'].includes(campaign.status) && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => campaignAction.mutate({ action: 'halt', campaign_id: campaign.id })}
                    disabled={campaignAction.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Halt
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!campaigns || campaigns.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No campaigns found</p>
            <p className="text-sm">Create a campaign to start outbound calling</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
