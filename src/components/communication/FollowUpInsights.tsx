import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, RefreshCw, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface FollowUpInsightsProps {
  entityType: 'store' | 'wholesaler' | 'influencer';
  entityId: string;
}

export const FollowUpInsights = ({ entityType, entityId }: FollowUpInsightsProps) => {
  const { data: insights, isLoading, refetch } = useQuery({
    queryKey: ['communication-insights', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('communication-insights', {
        body: { entityType, entityId },
      });

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warning':
        return <Badge variant="default" className="bg-yellow-500">Warning</Badge>;
      case 'info':
        return <Badge variant="secondary">Info</Badge>;
      default:
        return <Badge variant="outline">Normal</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Communication Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Communication Insights
          </span>
          <Button onClick={() => refetch()} variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardTitle>
        <CardDescription>AI-powered communication recommendations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics */}
        {insights?.metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b">
            <div>
              <div className="text-xs text-muted-foreground">Days Since Contact</div>
              <div className="text-2xl font-bold">{insights.metrics.daysSinceLastContact}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Communications</div>
              <div className="text-2xl font-bold">{insights.metrics.totalCommunications}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Last 30 Days</div>
              <div className="text-2xl font-bold">{insights.metrics.last30DaysCount}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Response Rate</div>
              <div className="text-2xl font-bold">{insights.metrics.responseRate}%</div>
            </div>
          </div>
        )}

        {/* Insights */}
        {insights?.insights && insights.insights.length > 0 ? (
          <div className="space-y-3">
            {insights.insights.map((insight: any, index: number) => (
              <div key={index} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(insight.type)}
                    <span className="font-semibold">{insight.action.replace(/_/g, ' ').toUpperCase()}</span>
                  </div>
                  {getTypeBadge(insight.type)}
                </div>
                <p className="text-sm text-muted-foreground">{insight.reason}</p>
                {insight.suggestedMessage && (
                  <div className="mt-2 p-3 bg-muted rounded-lg">
                    <p className="text-sm italic">"{insight.suggestedMessage}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p>All communication looks good! No immediate action needed.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
