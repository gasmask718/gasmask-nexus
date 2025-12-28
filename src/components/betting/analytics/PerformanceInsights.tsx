import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, TrendingUp, TrendingDown, Target } from 'lucide-react';

interface PerformanceInsightsProps {
  insights: string[];
}

export function PerformanceInsights({ insights }: PerformanceInsightsProps) {
  if (insights.length === 0) {
    return null;
  }

  const getIcon = (insight: string) => {
    if (insight.includes('ROI') || insight.includes('outperform')) {
      return insight.includes('-') ? <TrendingDown className="h-4 w-4 text-red-500" /> : <TrendingUp className="h-4 w-4 text-green-500" />;
    }
    if (insight.includes('win rate')) return <Target className="h-4 w-4 text-primary" />;
    return <Lightbulb className="h-4 w-4 text-amber-500" />;
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          Performance Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {insights.map((insight, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              {getIcon(insight)}
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
