import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Brain } from "lucide-react";
import { useAIForecast } from "@/hooks/useAIEngine";
import { Skeleton } from "@/components/ui/skeleton";

export function AIFinanceForecast() {
  const { data: forecasts, isLoading } = useAIForecast();

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="h-5 w-5 text-green-500" />
          AI Brand Profit Forecast
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {forecasts?.map((forecast) => {
            const TrendIcon = forecast.trend === 'rising' ? TrendingUp 
              : forecast.trend === 'declining' ? TrendingDown : Minus;
            const trendColor = forecast.trend === 'rising' ? 'text-green-500' 
              : forecast.trend === 'declining' ? 'text-red-500' : 'text-gray-400';

            return (
              <div key={forecast.brand} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{forecast.brand}</span>
                  <div className="flex items-center gap-2">
                    <TrendIcon className={`h-4 w-4 ${trendColor}`} />
                    <Badge variant="outline" className={trendColor.replace('text-', 'border-')}>
                      {forecast.trend === 'rising' ? 'Rising' : forecast.trend === 'declining' ? 'Declining' : 'Stable'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>This week: {forecast.currentWeek?.toLocaleString()}</span>
                  <span>Next week: {forecast.nextWeek?.toLocaleString()}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Confidence: {Math.round(forecast.confidence * 100)}%
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default AIFinanceForecast;