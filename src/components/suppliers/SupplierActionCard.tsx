import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, Eye, ArrowRight } from 'lucide-react';

interface SupplierActionCardProps {
  item: any;
  onSelect: (supplier: string) => void;
}

const riskTierColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200',
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  warning: 'bg-yellow-500/20 text-yellow-400',
  info: 'bg-blue-500/20 text-blue-400',
};

const windowIcons: Record<string, React.ReactNode> = {
  immediate: <AlertCircle className="h-4 w-4 text-red-500" />,
  near_term: <Clock className="h-4 w-4 text-orange-500" />,
  monitor: <Eye className="h-4 w-4 text-muted-foreground" />,
};

export function SupplierActionCard({ item, onSelect }: SupplierActionCardProps) {
  const isImmediate = item.recommended_contact_window === 'immediate';

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/40 transition-colors">
      <div className="mt-1 flex-shrink-0">
        {windowIcons[item.recommended_contact_window] || windowIcons.monitor}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm">{item.supplier_name}</p>
          <span className="text-xs text-muted-foreground">·</span>
          <p className="text-xs text-muted-foreground truncate">{item.product_name}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={riskTierColors[item.risk_tier] || riskTierColors.low}>
            Risk: {Number(item.contract_risk_index || 0).toFixed(0)}
          </Badge>
          {item.forecast_severity && (
            <Badge className={severityColors[item.forecast_severity] || severityColors.info}>
              {item.forecast_severity}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {item.recommended_action?.replace(/_/g, ' ')}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {item.summary_reason}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span className="text-xs font-mono text-muted-foreground">#{item.priority_rank}</span>
        <Button
          size="sm"
          variant={isImmediate ? 'default' : 'outline'}
          className="text-xs"
          onClick={() => onSelect(item.supplier_name)}
        >
          {isImmediate ? 'Review Now' : 'Details'}
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
