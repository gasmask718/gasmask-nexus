import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Phone, MessageSquare, Mail, MapPin, MessageCircle, TrendingUp, Users, Eye, EyeOff } from "lucide-react";
import { format, subDays } from "date-fns";

interface CommunicationStatsProps {
  entityType: "store" | "wholesaler" | "influencer";
  entityId: string;
}

interface CommunicationRecord {
  id: string;
  date: string;
  channel: string;
  type: 'interaction' | 'visit';
  direction?: string;
  outcome?: string;
  subject?: string;
  summary?: string;
  responsive: boolean;
}

export const CommunicationStats = ({ entityType, entityId }: CommunicationStatsProps) => {
  const [showTable, setShowTable] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['communication-stats', entityType, entityId],
    queryFn: async () => {
      const now = new Date();
      const sevenDaysAgo = subDays(now, 7);
      const thirtyDaysAgo = subDays(now, 30);

      // Fetch contact interactions
      const { data: interactions } = await supabase
        .from('contact_interactions')
        .select(`
          id,
          channel,
          direction,
          outcome,
          subject,
          summary,
          created_at,
          created_by_user_id
        `)
        .eq('store_id', entityId)
        .order('created_at', { ascending: false });

      // Fetch visit logs (in-person visits)
      const { data: visits } = await supabase
        .from('visit_logs')
        .select(`
          id,
          visit_type,
          visit_datetime,
          created_at,
          customer_response,
          user:profiles(name)
        `)
        .eq('store_id', entityId)
        .in('visit_type', ['delivery', 'inventoryCheck', 'followUp', 'order'])
        .order('created_at', { ascending: false });

      // Combine all communications
      const allComms: CommunicationRecord[] = [];

      // Add interactions
      if (interactions) {
        interactions.forEach((interaction) => {
          const isResponsive = interaction.outcome === 'SUCCESS' || 
                              interaction.outcome === 'PENDING' ||
                              interaction.direction === 'INBOUND';
          
          allComms.push({
            id: interaction.id,
            date: interaction.created_at,
            channel: interaction.channel,
            type: 'interaction',
            direction: interaction.direction,
            outcome: interaction.outcome,
            subject: interaction.subject,
            summary: interaction.summary,
            responsive: isResponsive,
          });
        });
      }

      // Add visits (in-person)
      if (visits) {
        visits.forEach((visit) => {
          const visitDate = visit.visit_datetime || visit.created_at;
          const isResponsive = !!visit.customer_response;
          
          allComms.push({
            id: visit.id,
            date: visitDate,
            channel: 'IN_PERSON',
            type: 'visit',
            subject: visit.visit_type || 'Visit',
            summary: visit.customer_response || undefined,
            responsive: isResponsive,
          });
        });
      }

      // Add canonical communication log entries (SMS / calls / email)
      if (logs) {
        const seenLogIds = new Set(allComms.map((c) => c.id));
        logs.forEach((log) => {
          if (seenLogIds.has(log.id)) return;
          const raw = (log.channel || 'sms').toUpperCase();
          const channel =
            raw === 'IN-PERSON' || raw === 'VISIT' ? 'IN_PERSON'
            : raw === 'AI_CALL' || raw === 'VOICE' ? 'CALL'
            : raw;

          allComms.push({
            id: log.id,
            date: log.created_at,
            channel,
            type: 'interaction',
            direction: (log.direction || '').toUpperCase(),
            outcome: log.outcome || undefined,
            subject: log.event_type || undefined,
            summary: log.summary || log.message_content || undefined,
            responsive: log.direction === 'inbound',
          });
        });
      }


      // Sort by date (most recent first)
      allComms.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Filter by date ranges
      const last7Days = allComms.filter(c => new Date(c.date) >= sevenDaysAgo);
      const last30Days = allComms.filter(c => new Date(c.date) >= thirtyDaysAgo);

      // Calculate engagement score
      const mostRecent = allComms[0];
      let engagementScore: 'green' | 'yellow' | 'red' = 'red';
      if (mostRecent) {
        const daysSince = Math.floor((now.getTime() - new Date(mostRecent.date).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince <= 3) engagementScore = 'green';
        else if (daysSince <= 14) engagementScore = 'yellow';
      }

      // Group by channel type
      const channelStats = {
        IN_PERSON: { count: 0, lastDate: null as string | null, lastResponsive: null as boolean | null },
        SMS: { count: 0, lastDate: null as string | null, lastResponsive: null as boolean | null },
        CALL: { count: 0, lastDate: null as string | null, lastResponsive: null as boolean | null },
      };

      allComms.forEach((comm) => {
        let channelKey: keyof typeof channelStats | null = null;
        
        if (comm.channel === 'IN_PERSON') {
          channelKey = 'IN_PERSON';
        } else if (comm.channel === 'SMS' || comm.channel === 'WHATSAPP') {
          channelKey = 'SMS';
        } else if (comm.channel === 'CALL') {
          channelKey = 'CALL';
        }

        if (channelKey) {
          channelStats[channelKey].count++;
          if (!channelStats[channelKey].lastDate || new Date(comm.date) > new Date(channelStats[channelKey].lastDate!)) {
            channelStats[channelKey].lastDate = comm.date;
            channelStats[channelKey].lastResponsive = comm.responsive;
          }
        }
      });

      return {
        total: allComms.length,
        last7Days: last7Days.length,
        last30Days: last30Days.length,
        channelStats,
        mostRecent: mostRecent?.date,
        engagementScore,
        allComms,
      };
    },
    enabled: !!entityId && entityType === 'store',
    refetchInterval: 30000,
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'CALL': return <Phone className="h-4 w-4" />;
      case 'SMS':
      case 'WHATSAPP': return <MessageSquare className="h-4 w-4" />;
      case 'EMAIL': return <Mail className="h-4 w-4" />;
      case 'IN_PERSON': return <Users className="h-4 w-4" />;
      default: return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'CALL': return 'By Phone';
      case 'SMS':
      case 'WHATSAPP': return 'By Text';
      case 'IN_PERSON': return 'In Person';
      default: return channel;
    }
  };

  const getEngagementBadge = (score: 'green' | 'yellow' | 'red') => {
    const variants = {
      green: 'default',
      yellow: 'secondary',
      red: 'destructive',
    } as const;

    const labels = {
      green: 'Active',
      yellow: 'Moderate',
      red: 'Inactive',
    };

    return <Badge variant={variants[score]}>{labels[score]}</Badge>;
  };

  const getResponsiveBadge = (responsive: boolean | null) => {
    if (responsive === null) return null;
    return (
      <Badge variant={responsive ? 'default' : 'secondary'} className="ml-2">
        {responsive ? '✓ Responsive' : '✗ Not Responsive'}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Communication Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Communication Stats</span>
          {getEngagementBadge(stats.engagementScore)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-primary">{stats.last7Days}</div>
            <div className="text-xs text-muted-foreground">Last 7 Days</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{stats.last30Days}</div>
            <div className="text-xs text-muted-foreground">Last 30 Days</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Lifetime</div>
          </div>
        </div>

        {/* Breakdown by Type */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Breakdown by Type</div>
          
          {/* In Person */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border">
            <div className="flex items-center gap-2">
              {getChannelIcon('IN_PERSON')}
              <span className="font-medium">In Person</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {stats.channelStats.IN_PERSON.lastDate && (
                <>
                  <span className="text-muted-foreground">
                    Last: {format(new Date(stats.channelStats.IN_PERSON.lastDate), 'MMM d, yyyy')}
                  </span>
                  {getResponsiveBadge(stats.channelStats.IN_PERSON.lastResponsive)}
                </>
              )}
              {!stats.channelStats.IN_PERSON.lastDate && (
                <span className="text-muted-foreground">No contact</span>
              )}
            </div>
          </div>

          {/* By Text */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border">
            <div className="flex items-center gap-2">
              {getChannelIcon('SMS')}
              <span className="font-medium">By Text</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {stats.channelStats.SMS.lastDate && (
                <>
                  <span className="text-muted-foreground">
                    Last: {format(new Date(stats.channelStats.SMS.lastDate), 'MMM d, yyyy')}
                  </span>
                  {getResponsiveBadge(stats.channelStats.SMS.lastResponsive)}
                </>
              )}
              {!stats.channelStats.SMS.lastDate && (
                <span className="text-muted-foreground">No contact</span>
              )}
            </div>
          </div>

          {/* By Phone */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border">
            <div className="flex items-center gap-2">
              {getChannelIcon('CALL')}
              <span className="font-medium">By Phone</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {stats.channelStats.CALL.lastDate && (
                <>
                  <span className="text-muted-foreground">
                    Last: {format(new Date(stats.channelStats.CALL.lastDate), 'MMM d, yyyy')}
                  </span>
                  {getResponsiveBadge(stats.channelStats.CALL.lastResponsive)}
                </>
              )}
              {!stats.channelStats.CALL.lastDate && (
                <span className="text-muted-foreground">No contact</span>
              )}
            </div>
          </div>
        </div>

        {/* Table View Toggle */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm font-medium">Communication History</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTable(!showTable)}
          >
            {showTable ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Hide Details
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </>
            )}
          </Button>
        </div>

        {/* Table View */}
        {showTable && (
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.allComms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No communication records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.allComms.map((comm) => (
                      <TableRow key={comm.id}>
                        <TableCell className="text-sm">
                          {format(new Date(comm.date), 'MMM d, yyyy h:mm a')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {comm.type === 'visit' ? 'Visit' : 'Interaction'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getChannelIcon(comm.channel)}
                            <span className="text-sm">{getChannelLabel(comm.channel)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {comm.subject || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={comm.responsive ? 'default' : 'secondary'}>
                            {comm.responsive ? '✓ Responsive' : '✗ Not Responsive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
