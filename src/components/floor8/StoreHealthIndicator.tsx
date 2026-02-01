/**
 * Store Health Indicator Component
 * Displays health status with visible rules and SLA indicators
 */
import { AlertTriangle, CheckCircle2, XCircle, Clock, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  HealthCalculationResult, 
  STORE_HEALTH_RULES,
  VISIT_CADENCE_OPTIONS,
  DEFAULT_VISIT_CADENCE 
} from '@/lib/storeHealthRules';

interface StoreHealthIndicatorProps {
  healthResult: HealthCalculationResult;
  showDetails?: boolean;
  showCadence?: boolean;
  expectedCadenceDays?: number;
  compact?: boolean;
}

export function StoreHealthIndicator({
  healthResult,
  showDetails = false,
  showCadence = false,
  expectedCadenceDays,
  compact = false,
}: StoreHealthIndicatorProps) {
  const { status, rule, daysSinceVisit, daysSinceOrder, visitOverdue, visitOverdueDays } = healthResult;
  
  const Icon = status === 'healthy' ? CheckCircle2 : status === 'at_risk' ? AlertTriangle : XCircle;
  
  const cadence = expectedCadenceDays 
    ? VISIT_CADENCE_OPTIONS.find(c => c.daysInterval === expectedCadenceDays) || DEFAULT_VISIT_CADENCE
    : DEFAULT_VISIT_CADENCE;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn(rule.color, rule.bgColor, 'cursor-help')}
            >
              <Icon className="h-3 w-3 mr-1" />
              {rule.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{rule.label}</p>
              <p className="text-xs text-muted-foreground">{rule.description}</p>
              {daysSinceVisit !== null && (
                <p className="text-xs">Last visit: {daysSinceVisit} days ago</p>
              )}
              {daysSinceOrder !== null && (
                <p className="text-xs">Last order: {daysSinceOrder} days ago</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-2">
      {/* Health Status Badge */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(rule.color, rule.bgColor, 'font-medium')}
        >
          <Icon className="h-3 w-3 mr-1" />
          {rule.label}
        </Badge>
        
        {showCadence && (
          <Badge variant="outline" className="text-muted-foreground">
            <Calendar className="h-3 w-3 mr-1" />
            {cadence.label} cadence
          </Badge>
        )}
      </div>

      {showDetails && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>{rule.description}</p>
          
          <div className="flex flex-wrap gap-3 mt-2">
            {/* Days since visit */}
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>
                Visit: {daysSinceVisit !== null ? `${daysSinceVisit}d ago` : 'Never'}
              </span>
              {visitOverdue && visitOverdueDays > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                  {visitOverdueDays}d overdue
                </Badge>
              )}
            </div>
            
            {/* Days since order */}
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                Order: {daysSinceOrder !== null ? `${daysSinceOrder}d ago` : 'Never'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Health Rules Reference Card
 * Displays all health rules for visibility
 */
export function HealthRulesReference() {
  return (
    <div className="p-4 rounded-lg border bg-muted/30">
      <h4 className="text-sm font-semibold mb-3">Store Health Rules</h4>
      <div className="space-y-2">
        {Object.values(STORE_HEALTH_RULES).map((rule) => {
          const Icon = rule.status === 'healthy' ? CheckCircle2 : rule.status === 'at_risk' ? AlertTriangle : XCircle;
          return (
            <div key={rule.status} className="flex items-start gap-2 text-xs">
              <Icon className={cn('h-4 w-4 mt-0.5', rule.color)} />
              <div>
                <span className={cn('font-medium', rule.color)}>{rule.label}:</span>
                <span className="text-muted-foreground ml-1">{rule.description}</span>
              </div>
            </div>
          );
        })}
      </div>
      
      <h4 className="text-sm font-semibold mb-2 mt-4">Visit Cadence Options</h4>
      <div className="flex flex-wrap gap-2">
        {VISIT_CADENCE_OPTIONS.map((cadence) => (
          <Badge key={cadence.id} variant="outline" className="text-xs">
            {cadence.label} ({cadence.daysInterval}d)
          </Badge>
        ))}
      </div>
    </div>
  );
}
