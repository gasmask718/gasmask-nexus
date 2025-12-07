import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCommunicationIntelligence } from "@/hooks/useCommunicationIntelligence";
import { TrendingUp, TrendingDown, Minus, Store, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface EngagementScoresPanelProps {
  businessId?: string;
}

export default function EngagementScoresPanel({ businessId }: EngagementScoresPanelProps) {
  const { engagementScores, engagementLoading } = useCommunicationIntelligence(businessId);

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case "improving": return <TrendingUp className="text-green-500" size={14} />;
      case "declining": return <TrendingDown className="text-red-500" size={14} />;
      default: return <Minus className="text-muted-foreground" size={14} />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const getProgressColor = (score: number) => {
    if (score >= 70) return "bg-green-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (engagementLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading engagement scores...</div>;
  }

  const avgScore = engagementScores.length > 0
    ? Math.round(engagementScores.reduce((sum, e) => sum + e.score, 0) / engagementScores.length)
    : 0;

  const lowEngagement = engagementScores.filter(e => e.score < 40);
  const highEngagement = engagementScores.filter(e => e.score >= 70);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average Score</p>
                <p className={cn("text-3xl font-bold", getScoreColor(avgScore))}>{avgScore}</p>
              </div>
              <Activity className="text-primary" size={32} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Engagement</p>
                <p className="text-3xl font-bold text-green-500">{highEngagement.length}</p>
              </div>
              <TrendingUp className="text-green-500" size={32} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Needs Attention</p>
                <p className="text-3xl font-bold text-red-500">{lowEngagement.length}</p>
              </div>
              <TrendingDown className="text-red-500" size={32} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Store List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store size={20} />
            Store Engagement Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {engagementScores.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No engagement data available</p>
          ) : (
            <div className="space-y-4">
              {engagementScores.map((engagement) => (
                <div key={engagement.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">
                        {engagement.store?.store_name || "Unknown Store"}
                      </p>
                      {getTrendIcon(engagement.sentiment_trend)}
                      {engagement.sentiment_trend && (
                        <Badge variant="outline" className="text-xs">
                          {engagement.sentiment_trend}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={engagement.score} 
                        className="h-2 flex-1"
                      />
                      <span className={cn("text-sm font-medium w-10", getScoreColor(engagement.score))}>
                        {engagement.score}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {engagement.last_contact && (
                      <p>Last: {new Date(engagement.last_contact).toLocaleDateString()}</p>
                    )}
                    {engagement.response_rate !== null && (
                      <p>Response: {engagement.response_rate}%</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
