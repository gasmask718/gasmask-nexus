import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, TrendingUp, MapPin, DollarSign, Clock } from "lucide-react";
import { useGrabbaIntelligence } from "@/hooks/useGrabbaIntelligence";
import { format } from "date-fns";

const categoryIcons: Record<string, React.ElementType> = {
  'Brand Performance': TrendingUp,
  'Geographic Intelligence': MapPin,
  'Financial Health': DollarSign,
  'Operations': Clock,
};

const categoryColors: Record<string, string> = {
  'Brand Performance': 'bg-purple-500/10 border-purple-500/30 text-purple-500',
  'Geographic Intelligence': 'bg-green-500/10 border-green-500/30 text-green-500',
  'Financial Health': 'bg-amber-500/10 border-amber-500/30 text-amber-500',
  'Operations': 'bg-blue-500/10 border-blue-500/30 text-blue-500',
};

export function AIInsightsPanel() {
  const { data, isLoading } = useGrabbaIntelligence();
  const insights = data?.insights || [];

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-indigo-500/5 to-violet-500/5 border-indigo-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-muted/30 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-indigo-500/5 to-violet-500/5 border-indigo-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          AI Insights
        </CardTitle>
        <CardDescription>Auto-generated intelligence from your data</CardDescription>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Analyzing data patterns...</p>
            <p className="text-sm">Insights will appear as more data is collected</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {insights.map((insight, index) => {
                const Icon = categoryIcons[insight.category] || Sparkles;
                const colorClass = categoryColors[insight.category] || 'bg-gray-500/10 border-gray-500/30 text-gray-500';
                
                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${colorClass.split(' ').slice(0, 2).join(' ')}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${colorClass.split(' ')[0]}`}>
                        <Icon className={`h-4 w-4 ${colorClass.split(' ')[2]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {insight.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(insight.confidence * 100)}% confidence
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {insight.insight}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Based on {insight.dataPoints} data points • {format(insight.generatedAt, 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
