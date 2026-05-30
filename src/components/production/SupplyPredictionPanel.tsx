/**
 * SUPPLY PREDICTION PANEL
 * 
 * Displays AI-driven supply forecasts with urgency indicators,
 * reorder dates, and explainable reasoning.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  useSupplyPredictions,
  useRunSupplyPrediction,
  type SupplyPrediction,
} from '@/hooks/useSupplyPredictions';
import {
  Brain,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Package,
  Calendar,
  ChevronDown,
  ShoppingCart,
  Loader2,
  Info,
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const URGENCY_CONFIG = {
  critical: {
    label: 'Critical',
    color: 'bg-destructive/10 text-destructive border-destructive/30',
    icon: AlertCircle,
    barColor: 'bg-destructive',
  },
  warning: {
    label: 'Warning',
    color: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: AlertTriangle,
    barColor: 'bg-amber-500',
  },
  normal: {
    label: 'Normal',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: CheckCircle,
    barColor: 'bg-emerald-500',
  },
  surplus: {
    label: 'Surplus',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: TrendingUp,
    barColor: 'bg-blue-500',
  },
};

const MATERIAL_ICONS: Record<string, string> = {
  tobacco: '🍂',
  tubes: '🔧',
  stickers: '🏷️',
  bags: '👜',
  boxes: '📦',
};

interface Props {
  officeId: string;
}

export function SupplyPredictionPanel({ officeId }: Props) {
  const { data: predictions = [], isLoading } = useSupplyPredictions(officeId);
  const runPrediction = useRunSupplyPrediction();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const criticalCount = predictions.filter((p) => p.urgency === 'critical').length;
  const warningCount = predictions.filter((p) => p.urgency === 'warning').length;
  const lastPredicted = predictions[0]?.predicted_at;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Supply Forecast
            </CardTitle>
            <CardDescription className="mt-1">
              {lastPredicted
                ? `Last updated ${format(parseISO(lastPredicted), 'MMM d, yyyy, h:mm a')}`
                : 'No predictions yet — run your first forecast'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} Critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge className="bg-amber-100 text-amber-800 text-xs">
                {warningCount} Warning
              </Badge>
            )}
            <Button
              onClick={() => runPrediction.mutate(officeId)}
              disabled={runPrediction.isPending}
              size="sm"
            >
              {runPrediction.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Run Forecast
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading predictions...
          </div>
        ) : predictions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium mb-1">No predictions available</p>
            <p className="text-xs">Click "Run Forecast" to analyze your supply levels</p>
          </div>
        ) : (
          <div className="space-y-3">
            {predictions.map((pred) => (
              <PredictionCard
                key={pred.id}
                prediction={pred}
                isExpanded={expandedItems.has(pred.id)}
                onToggle={() => toggleExpand(pred.id)}
              />
            ))}
          </div>
        )}

        {predictions.length > 0 && (
          <div className="mt-4 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>
              Predictions are advisory only. Based on {predictions[0]?.data_points_used || 0} batch
              data points. Confidence: {Math.round(predictions[0]?.confidence_score || 0)}%.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PredictionCard({
  prediction,
  isExpanded,
  onToggle,
}: {
  prediction: SupplyPrediction;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = URGENCY_CONFIG[prediction.urgency] || URGENCY_CONFIG.normal;
  const UrgencyIcon = config.icon;
  const materialIcon = MATERIAL_ICONS[prediction.material_type] || '📦';

  const daysUntilStockout = prediction.predicted_stockout_date
    ? differenceInDays(parseISO(prediction.predicted_stockout_date), new Date())
    : null;

  // Stock health percentage (0-100 scale, where 30+ days = 100%)
  const stockHealth = daysUntilStockout !== null
    ? Math.min(100, Math.max(0, (daysUntilStockout / 30) * 100))
    : 100;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className={cn('rounded-lg border p-3 transition-colors', config.color)}>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{materialIcon}</span>
                <div>
                  <p className="font-medium capitalize">{prediction.material_type}</p>
                  <p className="text-xs opacity-75">
                    Stock: {prediction.current_stock} | Rate: {prediction.daily_consumption_rate}/day
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <UrgencyIcon className="h-4 w-4" />
                <Badge variant="outline" className="text-xs">
                  {config.label}
                </Badge>
                {daysUntilStockout !== null && daysUntilStockout < 999 && (
                  <span className="text-xs font-mono font-bold">
                    {daysUntilStockout}d
                  </span>
                )}
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')}
                />
              </div>
            </div>

            {/* Stock health bar */}
            <div className="mt-2">
              <Progress value={stockHealth} className="h-1.5" />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-3 pt-3 border-t border-current/10 space-y-2 text-sm">
            {/* AI Reasoning */}
            {prediction.ai_reasoning && (
              <div className="flex gap-2">
                <Brain className="h-4 w-4 mt-0.5 shrink-0 opacity-70" />
                <p className="text-xs leading-relaxed">{prediction.ai_reasoning}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-2">
              {prediction.predicted_stockout_date && (
                <div className="flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Stockout: {format(parseISO(prediction.predicted_stockout_date), 'MMM d, yyyy')}</span>
                </div>
              )}
              {prediction.recommended_reorder_date && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Calendar className="h-3 w-3" />
                  <span>Reorder by: {format(parseISO(prediction.recommended_reorder_date), 'MMM d, yyyy')}</span>
                </div>
              )}
              {prediction.recommended_order_quantity && (
                <div className="flex items-center gap-1.5 text-xs">
                  <ShoppingCart className="h-3 w-3" />
                  <span>Order qty: {prediction.recommended_order_quantity}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs">
                <Package className="h-3 w-3" />
                <span>Confidence: {Math.round(prediction.confidence_score)}%</span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
