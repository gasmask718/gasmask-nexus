import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, Brain, Sparkles } from "lucide-react";
import { useGrabbaIntelligence } from "@/hooks/useGrabbaIntelligence";
import { GRABBA_BRAND_CONFIG, type GrabbaBrand } from "@/config/grabbaSkyscraper";

const trendIcons = {
  rising: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
};

const trendColors = {
  rising: 'text-green-500',
  stable: 'text-blue-500',
  declining: 'text-red-500',
};

export function AIForecastSummary() {
  const { data, isLoading } = useGrabbaIntelligence();
  const forecasts = data?.brandForecasts || [];

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Demand Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-muted/30 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          AI Demand Forecast
        </CardTitle>
        <CardDescription>7-day brand demand predictions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {forecasts.map((forecast) => {
          const config = GRABBA_BRAND_CONFIG[forecast.brand];
          const TrendIcon = trendIcons[forecast.trend];
          
          return (
            <div
              key={forecast.brand}
              className={`p-4 rounded-lg border bg-gradient-to-r ${config?.gradient || ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{config?.icon}</span>
                  <span className="font-semibold">{config?.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendIcon className={`h-4 w-4 ${trendColors[forecast.trend]}`} />
                  <span className={`text-sm font-medium ${trendColors[forecast.trend]}`}>
                    {forecast.growthRate > 0 ? '+' : ''}{forecast.growthRate}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">This Week</p>
                  <p className="text-xl font-bold">{forecast.currentWeekDemand.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Next Week (Predicted)</p>
                  <p className="text-xl font-bold text-primary flex items-center gap-1">
                    {forecast.nextWeekPrediction.toLocaleString()}
                    <Sparkles className="h-4 w-4 text-purple-500" />
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Confidence</span>
                  <span className="font-medium">{Math.round(forecast.confidenceScore * 100)}%</span>
                </div>
                <Progress value={forecast.confidenceScore * 100} className="h-1.5" />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
