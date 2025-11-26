import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Brain, AlertCircle, TrendingUp, Target, Zap } from 'lucide-react';

interface AIIntelligenceFeedProps {
  expanded?: boolean;
}

export function AIIntelligenceFeed({ expanded = false }: AIIntelligenceFeedProps) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  useEffect(() => {
    fetchIntelligence();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('ai-intelligence')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_recommendations' },
        () => fetchIntelligence()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchIntelligence = async () => {
    try {
      const [{ data: recs }, { data: health }] = await Promise.all([
        supabase
          .from('ai_recommendations')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('ai_system_health')
          .select('*')
          .order('snapshot_time', { ascending: false })
          .limit(1)
          .single(),
      ]);

      setRecommendations(recs || []);
      setSystemHealth(health);
    } catch (error) {
      console.error('Error fetching intelligence:', error);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'alert': return AlertCircle;
      case 'opportunity': return TrendingUp;
      case 'warning': return AlertCircle;
      default: return Brain;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Dynasty Intelligence Feed
        </h3>
        {systemHealth && (
          <Badge variant="outline">
            Health Score: {systemHealth.overall_health_score}%
          </Badge>
        )}
      </div>

      <ScrollArea className={expanded ? "h-[600px]" : "h-[400px]"}>
        <div className="space-y-3">
          {recommendations.length > 0 ? (
            recommendations.map((rec) => {
              const Icon = getCategoryIcon(rec.category);
              return (
                <div
                  key={rec.id}
                  className="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{rec.title}</p>
                        <Badge variant={getSeverityColor(rec.severity) as any}>
                          {rec.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                      {rec.reasoning && (
                        <p className="text-xs text-muted-foreground italic">
                          AI Reasoning: {rec.reasoning}
                        </p>
                      )}
                      {rec.confidence_score && (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${rec.confidence_score}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {rec.confidence_score}% confidence
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No active AI recommendations</p>
              <p className="text-xs mt-1">System running smoothly</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {expanded && systemHealth?.insights && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="font-semibold mb-2">System Insights</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Stores Health</p>
              <p className="font-bold">{systemHealth.stores_health_avg}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Routes Efficiency</p>
              <p className="font-bold">{systemHealth.routes_efficiency_score}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Communication</p>
              <p className="font-bold">{systemHealth.communication_health_score}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Inventory</p>
              <p className="font-bold">{systemHealth.inventory_health_score}%</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}