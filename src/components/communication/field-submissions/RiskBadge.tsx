// ═══════════════════════════════════════════════════════════════════════════════
// RISK BADGE
// Displays risk score with tooltip showing reasons
// ═══════════════════════════════════════════════════════════════════════════════

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertTriangle, ShieldAlert, ShieldCheck, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RiskBadgeProps {
  score: number | null;
  reasons?: string[] | null;
  showLabel?: boolean;
}

export function RiskBadge({ score, reasons, showLabel = false }: RiskBadgeProps) {
  const numScore = score ?? 0;
  
  // Determine risk level
  let level: 'low' | 'medium' | 'high' | 'critical';
  let Icon = ShieldCheck;
  let colorClass = 'text-green-600 bg-green-500/10 border-green-500/30';
  let label = 'Low Risk';
  
  if (numScore >= 70) {
    level = 'critical';
    Icon = ShieldAlert;
    colorClass = 'text-destructive bg-destructive/10 border-destructive/30';
    label = 'Critical';
  } else if (numScore >= 50) {
    level = 'high';
    Icon = AlertTriangle;
    colorClass = 'text-orange-600 bg-orange-500/10 border-orange-500/30';
    label = 'High Risk';
  } else if (numScore >= 25) {
    level = 'medium';
    Icon = Shield;
    colorClass = 'text-amber-600 bg-amber-500/10 border-amber-500/30';
    label = 'Medium';
  } else {
    level = 'low';
  }

  const hasReasons = reasons && reasons.length > 0;

  const badge = (
    <Badge 
      variant="outline" 
      className={cn("gap-1 cursor-default", colorClass)}
    >
      <Icon className="h-3 w-3" />
      {showLabel ? label : numScore}
    </Badge>
  );

  if (!hasReasons) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <div className="font-medium text-sm">{label} ({numScore})</div>
            <ul className="text-xs space-y-0.5">
              {reasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-muted-foreground">•</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
