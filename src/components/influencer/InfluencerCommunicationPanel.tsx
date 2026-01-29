import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConversationInbox } from "@/components/communication/ConversationInbox";
import { useCommunicationStats } from "@/hooks/useCommunications";
import { 
  MessageCircle, 
  TrendingUp, 
  ArrowDownLeft, 
  ArrowUpRight,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface InfluencerCommunicationPanelProps {
  influencerId: string;
  influencerName: string;
  isEditable?: boolean;
}

export function InfluencerCommunicationPanel({
  influencerId,
  influencerName,
  isEditable = true,
}: InfluencerCommunicationPanelProps) {
  const { data: stats, isLoading: statsLoading } = useCommunicationStats('influencer', influencerId);
  const [activeTab, setActiveTab] = useState("inbox");

  const getEngagementLevel = () => {
    if (!stats?.lastContact) return { label: 'No Contact', variant: 'destructive' as const };
    const daysSince = Math.floor(
      (Date.now() - new Date(stats.lastContact).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince <= 3) return { label: 'Active', variant: 'default' as const };
    if (daysSince <= 14) return { label: 'Moderate', variant: 'secondary' as const };
    return { label: 'Inactive', variant: 'destructive' as const };
  };

  const engagement = getEngagementLevel();

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm">Total Messages</span>
            </div>
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ArrowDownLeft className="h-4 w-4 text-green-500" />
              <span className="text-sm">Inbound</span>
            </div>
            <p className="text-2xl font-bold">{stats?.inbound || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ArrowUpRight className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Outbound</span>
            </div>
            <p className="text-2xl font-bold">{stats?.outbound || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Last 7 Days</span>
            </div>
            <p className="text-2xl font-bold">{stats?.last7Days || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Last Contact</span>
            </div>
            <div className="flex items-center gap-2">
              {stats?.lastContact ? (
                <>
                  <span className="text-sm font-medium">
                    {formatDistanceToNow(new Date(stats.lastContact), { addSuffix: true })}
                  </span>
                  <Badge variant={engagement.variant}>{engagement.label}</Badge>
                </>
              ) : (
                <Badge variant="destructive">Never</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channel Breakdown */}
      {stats?.byChannel && Object.keys(stats.byChannel).length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Channel Distribution</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byChannel).map(([channel, count]) => (
                <Badge key={channel} variant="outline" className="text-sm">
                  {channel.replace('_', ' ')}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversation Inbox */}
      <ConversationInbox
        entityType="influencer"
        entityId={influencerId}
        entityName={influencerName}
        isEditable={isEditable}
      />
    </div>
  );
}
