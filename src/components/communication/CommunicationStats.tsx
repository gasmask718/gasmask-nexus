import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageSquare, Mail, MapPin, MessageCircle, TrendingUp } from "lucide-react";
import { format, subDays } from "date-fns";

interface CommunicationStatsProps {
  entityType: "store" | "wholesaler" | "influencer";
  entityId: string;
}

export const CommunicationStats = ({ entityType, entityId }: CommunicationStatsProps) => {
  const { data: stats } = useQuery({
    queryKey: ['communication-stats', entityType, entityId],
    queryFn: async () => {
      const now = new Date();
      const sevenDaysAgo = subDays(now, 7);
      const thirtyDaysAgo = subDays(now, 30);

      const { data: allComms } = await supabase
        .from('communication_events')
        .select('*, profiles(name)')
        .eq('linked_entity_type', entityType)
        .eq('linked_entity_id', entityId)
        .order('created_at', { ascending: false });

      if (!allComms) return null;

      const last7Days = allComms.filter(c => new Date(c.created_at) >= sevenDaysAgo);
      const last30Days = allComms.filter(c => new Date(c.created_at) >= thirtyDaysAgo);

      // Calculate engagement score based on most recent communication
      const mostRecent = allComms[0];
      let engagementScore: 'green' | 'yellow' | 'red' = 'red';
      if (mostRecent) {
        const daysSince = Math.floor((now.getTime() - new Date(mostRecent.created_at).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince <= 3) engagementScore = 'green';
        else if (daysSince <= 14) engagementScore = 'yellow';
      }

      // Count by type
      const typeBreakdown = last30Days.reduce((acc, comm) => {
        const channel = comm.channel || 'other';
        acc[channel] = (acc[channel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Top communicator this month
      const userCounts = last30Days.reduce((acc, comm) => {
        if (comm.user_id) {
          acc[comm.user_id] = (acc[comm.user_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const topUserId = Object.entries(userCounts).sort(([,a], [,b]) => b - a)[0]?.[0];
      const topUser = allComms.find(c => c.user_id === topUserId)?.profiles;

      return {
        total: allComms.length,
        last7Days: last7Days.length,
        last30Days: last30Days.length,
        typeBreakdown,
        mostRecent: mostRecent?.created_at,
        engagementScore,
        topUser: topUser?.name,
      };
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'visit': return <MapPin className="h-4 w-4" />;
      case 'whatsapp': return <MessageCircle className="h-4 w-4" />;
      default: return <TrendingUp className="h-4 w-4" />;
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

        <div className="space-y-2">
          <div className="text-sm font-medium">Breakdown by Type</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.typeBreakdown).map(([type, count]) => (
              <Badge key={type} variant="outline" className="gap-1">
                {getChannelIcon(type)}
                <span className="capitalize">{type}</span>
                <span className="text-muted-foreground">({count})</span>
              </Badge>
            ))}
          </div>
        </div>

        {stats.mostRecent && (
          <div className="text-sm">
            <span className="text-muted-foreground">Last contact: </span>
            <span className="font-medium">
              {format(new Date(stats.mostRecent), 'MMM d, yyyy')}
            </span>
          </div>
        )}

        {stats.topUser && (
          <div className="text-sm">
            <span className="text-muted-foreground">Top communicator: </span>
            <span className="font-medium">{stats.topUser}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};