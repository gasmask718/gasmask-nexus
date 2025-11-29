import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Brain, TrendingUp, AlertTriangle } from "lucide-react";
import { useAIRecommendations, useStoreQualityScores } from "@/hooks/useAIEngine";
import { Skeleton } from "@/components/ui/skeleton";

export function AICRMInsights() {
  const { data: storeScores, isLoading: scoresLoading } = useStoreQualityScores();
  const { data: recommendations, isLoading: recsLoading } = useAIRecommendations("store");

  const isLoading = scoresLoading || recsLoading;

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
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

  const topStores = storeScores?.sort((a, b) => b.overallScore - a.overallScore).slice(0, 5) || [];

  return (
    <div className="space-y-4">
      {/* Top Priority Stores */}
      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-blue-500" />
            AI Store Quality Scores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topStores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No store data available yet
              </p>
            ) : (
              topStores.map((store) => (
                <div key={store.storeId} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div>
                    <span className="font-medium">{store.storeName}</span>
                    <p className="text-xs text-muted-foreground">{store.recommendation}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i <= Math.round(store.overallScore / 20) ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`}
                        />
                      ))}
                    </div>
                    <Badge variant="outline">{store.overallScore}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              AI CRM Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recommendations.slice(0, 5).map((rec) => (
                <div key={rec.id} className="p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{rec.title}</span>
                    <Badge
                      variant="outline"
                      className={
                        rec.severity === 'error'
                          ? 'border-red-500 text-red-500'
                          : rec.severity === 'warn'
                          ? 'border-amber-500 text-amber-500'
                          : 'border-blue-500 text-blue-500'
                      }
                    >
                      {Math.round((rec.confidence || 0) * 100)}% conf
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AICRMInsights;