import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, Brain } from "lucide-react";
import { useAIPredictions } from "@/hooks/useAIEngine";
import { Skeleton } from "@/components/ui/skeleton";

export function AIInventoryWatch() {
  const { data: predictions, isLoading } = useAIPredictions();

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
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

  const projections = predictions?.inventoryProjections || [];

  return (
    <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="h-5 w-5 text-purple-500" />
          AI Inventory Watch
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {projections.map((item) => (
            <div
              key={item.brand}
              className={`p-3 rounded-lg border ${
                item.urgency === 'critical'
                  ? 'bg-red-500/10 border-red-500/30'
                  : item.urgency === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-emerald-500/10 border-emerald-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {item.urgency === 'critical' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                  <span className="font-medium capitalize">{item.brand}</span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    item.urgency === 'critical'
                      ? 'border-red-500 text-red-500'
                      : item.urgency === 'warning'
                      ? 'border-amber-500 text-amber-500'
                      : 'border-emerald-500 text-emerald-500'
                  }
                >
                  {item.daysUntilDepletion} days left
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {item.urgency === 'critical'
                  ? 'Reorder immediately'
                  : item.urgency === 'warning'
                  ? 'Plan restock soon'
                  : 'Inventory healthy'}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default AIInventoryWatch;