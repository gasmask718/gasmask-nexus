/**
 * WORKER COMMUNICATION TAB
 * 
 * Communication history panel for worker profile dialog.
 * Shows:
 * - Last contact timestamp
 * - Contact frequency
 * - Communication type breakdown
 * - Quick action buttons
 * - Recent communications list
 * - Performance-communication correlation insights
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  MessageSquare,
  Phone,
  Clock,
  Calendar,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  XCircle,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Info,
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useProductionCommunications } from '@/hooks/useProductionPortal';
import { useWorkerSkillProfiles } from '@/hooks/useWorkerPerformance';
import { useMessage } from '@/components/communication/MessageProvider';
import { ProductionWorker } from '@/hooks/useProductionPortal';

interface WorkerCommunicationTabProps {
  worker: ProductionWorker;
  officeId: string;
}

const CHANNEL_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  sms: { label: 'SMS', icon: <MessageSquare className="h-4 w-4" />, color: 'text-blue-600' },
  whatsapp: { label: 'WhatsApp', icon: <MessageSquare className="h-4 w-4" />, color: 'text-emerald-600' },
  call: { label: 'Call', icon: <Phone className="h-4 w-4" />, color: 'text-purple-600' },
};

const STATUS_CONFIG: Record<string, { color: string }> = {
  queued: { color: 'bg-muted text-muted-foreground' },
  sent: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  delivered: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  failed: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  read: { color: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800/30 dark:text-emerald-200' },
};

interface InsightItem {
  id: string;
  severity: 'warning' | 'info' | 'success';
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function WorkerCommunicationTab({ worker, officeId }: WorkerCommunicationTabProps) {
  const { data: allCommunications = [] } = useProductionCommunications(officeId, 500);
  const { data: profiles = [] } = useWorkerSkillProfiles(officeId);
  const { initiateMessage } = useMessage();

  // Get this worker's profile
  const workerProfile = useMemo(() => 
    profiles.find(p => p.worker_id === worker.id),
    [profiles, worker.id]
  );

  // Filter communications for this worker
  const workerCommunications = useMemo(() => {
    return allCommunications.filter((c: any) => c.worker_id === worker.id);
  }, [allCommunications, worker.id]);

  // Stats
  const stats = useMemo(() => {
    if (workerCommunications.length === 0) {
      return {
        lastContact: null,
        lastContactAgo: null,
        daysSinceContact: null,
        totalContacts: 0,
        last7Days: 0,
        last30Days: 0,
        byChannel: { sms: 0, whatsapp: 0, call: 0 },
        inbound: 0,
        outbound: 0,
        missedCount: 0,
      };
    }

    const sorted = [...workerCommunications].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const lastContact = new Date(sorted[0].created_at);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const byChannel = { sms: 0, whatsapp: 0, call: 0 };
    let inbound = 0;
    let outbound = 0;
    let last7Days = 0;
    let last30Days = 0;
    let missedCount = 0;

    workerCommunications.forEach((c: any) => {
      if (byChannel.hasOwnProperty(c.channel)) {
        byChannel[c.channel as keyof typeof byChannel]++;
      }
      if (c.direction === 'inbound') inbound++;
      else outbound++;
      if (new Date(c.created_at) >= sevenDaysAgo) last7Days++;
      if (new Date(c.created_at) >= thirtyDaysAgo) last30Days++;
      if (c.status === 'failed') missedCount++;
    });

    return {
      lastContact,
      lastContactAgo: formatDistanceToNow(lastContact, { addSuffix: true }),
      daysSinceContact: differenceInDays(now, lastContact),
      totalContacts: workerCommunications.length,
      last7Days,
      last30Days,
      byChannel,
      inbound,
      outbound,
      missedCount,
    };
  }, [workerCommunications]);

  // Performance-Communication Correlation Insights
  const insights = useMemo<InsightItem[]>(() => {
    const result: InsightItem[] = [];
    
    if (!workerProfile) return result;

    const hasDecliningTrend = workerProfile.trend_speed === 'declining' || workerProfile.trend_quality === 'declining';
    const hasNoCommunication = stats.daysSinceContact === null || stats.daysSinceContact > 10;
    const hasLowCommunication = stats.last7Days < 2;
    const hasRecentCommunication = stats.last7Days >= 3;
    const isImproving = workerProfile.trend_speed === 'improving' || workerProfile.trend_quality === 'improving';

    // Critical: Declining performance + no communication
    if (hasDecliningTrend && hasNoCommunication) {
      result.push({
        id: 'declining-no-contact',
        severity: 'warning',
        icon: <AlertTriangle className="h-4 w-4" />,
        title: 'Declining performance with no recent contact',
        description: `No outbound communication in ${stats.daysSinceContact ?? 'over 10'} days during declining ${workerProfile.trend_speed === 'declining' ? 'speed' : 'quality'} trend. Consider reaching out.`,
      });
    }

    // Warning: Declining performance + low communication
    if (hasDecliningTrend && hasLowCommunication && !hasNoCommunication) {
      result.push({
        id: 'declining-low-contact',
        severity: 'warning',
        icon: <TrendingDown className="h-4 w-4" />,
        title: 'Low engagement during performance decline',
        description: `Only ${stats.last7Days} contact(s) in the past week while performance is declining. Increased coaching may help.`,
      });
    }

    // Positive: Improvement after recent contact
    if (isImproving && hasRecentCommunication) {
      result.push({
        id: 'improvement-with-contact',
        severity: 'success',
        icon: <CheckCircle className="h-4 w-4" />,
        title: 'Improvement correlated with engagement',
        description: `${stats.last7Days} contacts in the past week coincides with improving ${workerProfile.trend_speed === 'improving' ? 'speed' : 'quality'} trend.`,
      });
    }

    // Info: All outbound, no responses
    if (stats.inbound === 0 && stats.outbound > 5) {
      result.push({
        id: 'no-responses',
        severity: 'info',
        icon: <ArrowUpRight className="h-4 w-4" />,
        title: 'No inbound responses recorded',
        description: `${stats.outbound} outbound contacts but no inbound responses logged. Consider trying a different channel.`,
      });
    }

    // Info: High missed/failed rate
    if (stats.missedCount > 3 && stats.missedCount / stats.totalContacts > 0.3) {
      result.push({
        id: 'high-failure-rate',
        severity: 'warning',
        icon: <XCircle className="h-4 w-4" />,
        title: 'High communication failure rate',
        description: `${stats.missedCount} of ${stats.totalContacts} communications failed. Verify contact information.`,
      });
    }

    return result;
  }, [workerProfile, stats]);

  const handleQuickAction = (channel: 'sms' | 'whatsapp' | 'call') => {
    const phone = worker.phone || worker.whatsapp;
    if (!phone) return;

    initiateMessage({
      destinationPhone: phone,
      entityType: 'other',
      entityId: worker.id,
      entityName: worker.full_name,
      channel: channel === 'call' ? 'sms' : channel,
    });
  };

  const hasPhone = !!(worker.phone || worker.whatsapp);

  // Determine engagement label
  const getEngagementLabel = () => {
    if (stats.daysSinceContact === null) return null;
    if (stats.daysSinceContact <= 3) return { label: 'Recently Contacted', color: 'bg-emerald-100 text-emerald-800' };
    if (stats.daysSinceContact <= 7) return { label: 'Active', color: 'bg-blue-100 text-blue-800' };
    if (stats.daysSinceContact <= 14) return { label: 'Low Communication', color: 'bg-amber-100 text-amber-800' };
    return { label: 'Missed Follow-ups', color: 'bg-red-100 text-red-800' };
  };

  const engagementLabel = getEngagementLabel();

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="text-sm">Quick Actions</CardTitle>
          {!hasPhone && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              No phone on file
            </Badge>
          )}
          {engagementLabel && (
            <Badge className={cn("text-xs", engagementLabel.color)}>
              {engagementLabel.label}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleQuickAction('sms')}
            disabled={!hasPhone}
          >
            <MessageSquare className="h-4 w-4 mr-2 text-blue-600" />
            Text
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleQuickAction('whatsapp')}
            disabled={!hasPhone}
          >
            <MessageSquare className="h-4 w-4 mr-2 text-emerald-600" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleQuickAction('call')}
            disabled={!hasPhone}
          >
            <Phone className="h-4 w-4 mr-2 text-purple-600" />
            Call
          </Button>
        </div>
      </Card>

      {/* Performance-Communication Insights */}
      {insights.length > 0 && (
        <Card className="p-4">
          <CardTitle className="text-sm mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Performance-Communication Insights
          </CardTitle>
          <div className="space-y-2">
            {insights.map(insight => (
              <Alert 
                key={insight.id}
                variant={insight.severity === 'warning' ? 'destructive' : 'default'}
                className={cn(
                  "py-2",
                  insight.severity === 'success' && 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20',
                  insight.severity === 'info' && 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20'
                )}
              >
                {insight.icon}
                <AlertTitle className="text-sm">{insight.title}</AlertTitle>
                <AlertDescription className="text-xs">{insight.description}</AlertDescription>
              </Alert>
            ))}
          </div>
        </Card>
      )}

      {/* Stats Overview */}
      <Card className="p-4">
        <CardTitle className="text-sm mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Contact Summary
        </CardTitle>
        
        {stats.lastContact ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Last Contact</p>
                <p className="font-semibold">{stats.lastContactAgo}</p>
                <p className="text-xs text-muted-foreground">
                  {format(stats.lastContact, 'MMM d, yyyy')}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Total Contacts</p>
                <p className="text-2xl font-bold">{stats.totalContacts}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.last7Days} in 7d • {stats.last30Days} in 30d
                </p>
              </div>
            </div>

            <Separator className="my-3" />

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">By Channel</p>
              <div className="flex gap-2">
                {Object.entries(stats.byChannel).map(([channel, count]) => (
                  <Badge 
                    key={channel} 
                    variant="secondary" 
                    className={cn("text-xs", CHANNEL_CONFIG[channel]?.color)}
                  >
                    {CHANNEL_CONFIG[channel]?.icon}
                    <span className="ml-1">{count}</span>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> Outbound: {stats.outbound}
              </span>
              <span className="flex items-center gap-1">
                <ArrowDownLeft className="h-3 w-3" /> Inbound: {stats.inbound}
              </span>
              {stats.missedCount > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-3 w-3" /> Failed: {stats.missedCount}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No communication history</p>
            <p className="text-xs mt-1">Start by sending a message to this worker</p>
          </div>
        )}
      </Card>

      {/* Recent Communications */}
      {workerCommunications.length > 0 && (
        <Card className="p-4">
          <CardTitle className="text-sm mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Communications
          </CardTitle>
          
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {workerCommunications.slice(0, 10).map((comm: any) => {
                const channelConfig = CHANNEL_CONFIG[comm.channel] || CHANNEL_CONFIG.sms;
                const statusConfig = STATUS_CONFIG[comm.status] || STATUS_CONFIG.queued;
                const isInbound = comm.direction === 'inbound';

                return (
                  <div 
                    key={comm.id} 
                    className={cn(
                      "p-2 rounded-lg border text-sm",
                      isInbound && "border-l-4 border-l-accent"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isInbound ? (
                          <ArrowDownLeft className="h-3 w-3 text-accent" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3 text-primary" />
                        )}
                        <span className={cn('flex items-center gap-1', channelConfig.color)}>
                          {channelConfig.icon}
                          <span className="text-xs">{channelConfig.label}</span>
                        </span>
                        <Badge className={cn('text-[10px]', statusConfig.color)}>
                          {comm.status}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(comm.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {comm.message_body && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {comm.message_body}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* Data Governance Notice */}
      <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2">
        <Info className="h-4 w-4" />
        Communication insights are observational patterns, not automated conclusions.
      </div>
    </div>
  );
}
