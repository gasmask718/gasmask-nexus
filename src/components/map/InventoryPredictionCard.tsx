import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Calendar } from "lucide-react";

interface InventoryPredictionCardProps {
  storeName: string;
  urgencyScore: number;
  predictedStockoutDate: string | null;
  velocity: number;
}

export function InventoryPredictionCard({
  storeName,
  urgencyScore,
  predictedStockoutDate,
  velocity
}: InventoryPredictionCardProps) {
  const getUrgencyColor = (score: number) => {
    if (score >= 80) return "text-red-500";
    if (score >= 50) return "text-yellow-500";
    return "text-green-500";
  };

  const getUrgencyBadge = (score: number) => {
    if (score >= 80) return <Badge variant="destructive">Urgent</Badge>;
    if (score >= 50) return <Badge variant="secondary">Moderate</Badge>;
    return <Badge variant="outline">Low</Badge>;
  };

  const daysUntilStockout = predictedStockoutDate 
    ? Math.ceil((new Date(predictedStockoutDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Card className="p-3 bg-gradient-to-br from-background to-muted/30">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">INVENTORY FORECAST</p>
          <h4 className="font-semibold">{storeName}</h4>
        </div>
        {getUrgencyBadge(urgencyScore)}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Urgency Score</p>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${getUrgencyColor(urgencyScore)}`}>
              {urgencyScore}
            </span>
            <span className="text-muted-foreground">/100</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Velocity</p>
          <div className="flex items-center gap-1">
            {velocity > 2 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : velocity > 0.5 ? (
              <TrendingUp className="h-4 w-4 text-yellow-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className="font-semibold">{velocity.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">boxes/day</span>
          </div>
        </div>

        {predictedStockoutDate && (
          <div className="col-span-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Predicted Stockout</p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {new Date(predictedStockoutDate).toLocaleDateString()}
              </span>
              {daysUntilStockout !== null && daysUntilStockout < 7 && (
                <Badge variant="destructive" className="ml-auto">
                  {daysUntilStockout} days
                </Badge>
              )}
            </div>
          </div>
        )}

        {urgencyScore >= 70 && (
          <div className="col-span-2 mt-2 p-2 bg-destructive/10 rounded-md flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-xs text-destructive font-medium">
              Restock needed urgently
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}