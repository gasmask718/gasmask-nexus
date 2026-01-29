import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useInfluencerMetricsAggregate } from "@/hooks/useInfluencerAnalytics";
import { 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  TrendingUp,
  Trophy,
  Target
} from "lucide-react";
import { format } from "date-fns";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfluencerKPIDrilldown } from "./InfluencerKPIDrilldown";

interface InfluencerAnalyticsDashboardProps {
  influencerId: string;
}

type DrilldownType = 'exposures' | 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'posts';

const milestones = [
  { key: 'milestone_1m_reached_at', label: '1M Exposures', value: 1000000 },
  { key: 'milestone_10m_reached_at', label: '10M Exposures', value: 10000000 },
  { key: 'milestone_50m_reached_at', label: '50M Exposures', value: 50000000 },
  { key: 'milestone_100m_reached_at', label: '100M Exposures', value: 100000000 },
];

export function InfluencerAnalyticsDashboard({ influencerId }: InfluencerAnalyticsDashboardProps) {
  const { data: metrics, isLoading, error, refetch } = useInfluencerMetricsAggregate(influencerId);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownType, setDrilldownType] = useState<DrilldownType>('exposures');

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(2)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const openDrilldown = (type: DrilldownType) => {
    setDrilldownType(type);
    setDrilldownOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="kpi-grid" count={4} />
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load analytics"
        description="We couldn't load the analytics data. Please try again."
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  const metricsData = metrics || {
    total_exposures: 0,
    total_views: 0,
    total_impressions: 0,
    total_reach: 0,
    total_likes: 0,
    total_comments: 0,
    total_shares: 0,
    total_saves: 0,
    avg_engagement_rate: 0,
    post_count: 0,
  };

  const hasNoData = metricsData.post_count === 0;

  const kpiCards = [
    { 
      label: 'Total Exposures', 
      value: formatNumber(metricsData.total_exposures), 
      icon: Eye,
      description: 'Views + Impressions + Reach',
      drilldown: 'exposures' as DrilldownType,
    },
    { 
      label: 'Total Views', 
      value: formatNumber(metricsData.total_views), 
      icon: Eye,
      description: 'Video & content views',
      drilldown: 'views' as DrilldownType,
    },
    { 
      label: 'Engagement Rate', 
      value: `${(metricsData.avg_engagement_rate || 0).toFixed(2)}%`, 
      icon: TrendingUp,
      description: 'Avg across all posts',
      drilldown: null,
    },
    { 
      label: 'Posts', 
      value: metricsData.post_count.toString(), 
      icon: Target,
      description: 'Total branded content',
      drilldown: 'posts' as DrilldownType,
    },
  ];

  const engagementCards = [
    { label: 'Likes', value: metricsData.total_likes, icon: Heart, color: 'text-red-500', drilldown: 'likes' as DrilldownType },
    { label: 'Comments', value: metricsData.total_comments, icon: MessageCircle, color: 'text-blue-500', drilldown: 'comments' as DrilldownType },
    { label: 'Shares', value: metricsData.total_shares, icon: Share2, color: 'text-green-500', drilldown: 'shares' as DrilldownType },
    { label: 'Saves', value: metricsData.total_saves, icon: Bookmark, color: 'text-purple-500', drilldown: 'saves' as DrilldownType },
  ];

  if (hasNoData) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No analytics data yet"
        description="Analytics will appear here once posts are tracked and metrics are synced."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Main KPIs - Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card 
            key={kpi.label}
            className={kpi.drilldown ? "cursor-pointer hover:border-primary transition-colors" : ""}
            onClick={() => kpi.drilldown && openDrilldown(kpi.drilldown)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <kpi.icon className="h-4 w-4" />
                <span className="text-sm">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
              {kpi.drilldown && (
                <p className="text-xs text-primary mt-1">Click to drill down →</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Engagement Breakdown - Clickable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Engagement Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {engagementCards.map((item) => (
              <div 
                key={item.label} 
                className="text-center p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => openDrilldown(item.drilldown)}
              >
                <item.icon className={`h-6 w-6 mx-auto mb-2 ${item.color}`} />
                <p className="text-xl font-bold">{formatNumber(item.value)}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-xs text-primary mt-1">View details →</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {milestones.map((milestone) => {
              const reached = metrics?.[milestone.key as keyof typeof metrics];
              const isAchieved = !!reached;
              const progress = Math.min(100, (metricsData.total_exposures / milestone.value) * 100);

              return (
                <div 
                  key={milestone.key}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    isAchieved 
                      ? 'border-yellow-500 bg-yellow-500/10' 
                      : 'border-muted bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Trophy className={`h-5 w-5 ${isAchieved ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                    {isAchieved && (
                      <Badge variant="default" className="bg-yellow-500 text-black text-xs">
                        Achieved
                      </Badge>
                    )}
                  </div>
                  <p className={`font-semibold ${isAchieved ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {milestone.label}
                  </p>
                  {isAchieved && reached ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(reached as string), 'MMM d, yyyy')}
                    </p>
                  ) : (
                    <div className="mt-2">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{progress.toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Drilldown Dialog */}
      <InfluencerKPIDrilldown
        influencerId={influencerId}
        type={drilldownType}
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
      />
    </div>
  );
}
